import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * 씨앗 두 벌이 같은 것을 넣는가 - `test/e2e/seed/examples.sql` ↔
 * `examples.rails.sql`.
 *
 * ## 왜 이 검사가 필요한가
 *
 * D5 Task 4 가 Rails 전용 씨앗을 더하면서 씨앗이 **두 벌**이 됐다. 그
 * 디렉터리의 `README.md` 가 계약을 스스로 적는다:
 *
 * > `examples.sql` 을 고치면 **`examples.rails.sql` 도 같이 고쳐야 한다** -
 * > 자동으로 동기화되지 않는다. id·값·시각이 어긋나면 세 백엔드가 같은
 * > 시나리오에서 다른 결과를 내고, **그 차이가 진짜 백엔드 드리프트인지
 * > 씨앗이 갈려서인지 구별할 수 없게 된다.**
 *
 * **그 비용을 정확히 예언해 놓고 가드는 없었다**(브랜치 리뷰 I-5). 매트릭스의
 * 유일한 산출물이 "오늘 세 백엔드가 어디서 갈리는가" 인데, 씨앗이 갈린 순간
 * Rails 칸의 빨강이 백엔드 드리프트처럼 보이고 조사하는 사람은 백엔드
 * 저장소를 뒤진다.
 *
 * 이 저장소는 같은 실패 모양에 같은 처방을 한 전례가 있다 - 루트 `AGENTS.md`
 * 의 "이 규칙은 사람의 기억에 두었다가 실패했다 … 그래서 게이트로 옮겼다".
 * 여기가 그 처방이다. **도커도 새 인프라도 필요 없다** - 두 파일을 읽는
 * 텍스트 검사다.
 *
 * ## 무엇을 정본으로 삼는가
 *
 * 테이블 이름 매핑은 `test/e2e/seed/README.md` 의 표다. Rails 만 분류·라벨·
 * 조인 테이블의 이름이 다르고, **헷갈리는 자리는 조인 테이블**이다 - 정본은
 * 그것을 `example_tags` 라 부르고 Rails 는 `example_taggings` 라 부르는데,
 * `example_tags` 라는 이름은 Rails 에서 **라벨 레코드 테이블**로 이미 쓰이고
 * 있다. 아래 매핑이 그 표를 그대로 옮긴 것이다.
 *
 * ## 무엇을 예외로 두는가 - 하나뿐이다
 *
 * Rails 전용 "0) 하우스키핑" `DELETE` 두 줄. `bin/rails db:prepare` 가
 * `db/seeds.rb` 로 만든 행을 지우는 절이라 정본에는 대응이 없다(그 파일의
 * 0) 절 주석이 근거를 갖는다). 그 밖의 차이는 전부 실패다.
 */

/** 이 파일은 `<루트>/test/unit/e2e/seed-mirror.test.ts` 다 - 세 계단 위가 저장소 루트다. */
const SEED_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'e2e', 'seed')

/**
 * Rails 테이블 이름 → 정본 이름. `test/e2e/seed/README.md` 의 표가 정본이다.
 * **`example_tags` 가 양쪽에 있고 뜻이 다르다** - Rails 에서는 라벨 레코드,
 * 정본에서는 조인 테이블이다. 그래서 이름 하나씩 통째로 바꾸고(부분 문자열
 * 치환이 아니다) 순서에 기대지 않는다.
 */
const RAILS_TO_CANONICAL: Readonly<Record<string, string>> = {
  example_categories: 'categories',
  example_tags: 'tags',
  example_taggings: 'example_tags',
}

function readSeed(name: string): string {
  return readFileSync(resolve(SEED_DIR, name), 'utf8')
}

/**
 * 주석을 걷어내고 `;` 로 끊어 문장 목록으로.
 *
 * **전제:** 이 두 파일의 문자열 리터럴에는 `--` 도 `;` 도 없다(값은 전부
 * `프로브`·`probe-seed`·`힣넘침` 접두사와 UUID·시각이다). 그 전제가 깨지면
 * 이 파서는 조용히 통과하는 쪽이 아니라 문장이 갈라지며 **빨개지는** 쪽으로
 * 틀린다.
 */
function statements(sql: string): string[] {
  return (
    sql
      // `\r\n` 도 받는다 - 줄 끝의 `\r` 이 남으면 `--.*$` 가 그 줄에 걸리지
      // 않아 주석이 통째로 살아남는다(정규식의 `.` 는 `\r` 을 안 먹는다).
      .split(/\r?\n/)
      .map((line) => line.replace(/--.*$/, ''))
      .join('\n')
      .split(';')
      .map((statement) => statement.replace(/\s+/g, ' ').trim())
      .filter((statement) => statement !== '')
  )
}

function insertsOf(sql: string, rename: Readonly<Record<string, string>> = {}): string[] {
  return statements(sql)
    .filter((statement) => statement.toUpperCase().startsWith('INSERT INTO '))
    .map((statement) =>
      statement.replace(/^INSERT INTO (\w+)/i, (whole, table: string) => {
        const canonical = rename[table]
        return canonical === undefined ? whole : `INSERT INTO ${canonical}`
      }),
    )
}

const CANONICAL_SQL = readSeed('examples.sql')
const RAILS_SQL = readSeed('examples.rails.sql')

const CANONICAL_INSERTS = insertsOf(CANONICAL_SQL)
const RAILS_INSERTS = insertsOf(RAILS_SQL, RAILS_TO_CANONICAL)

describe('씨앗 두 벌 - 이 검사가 실제로 무언가를 읽었는가', () => {
  it('두 파일에서 INSERT 를 실제로 뽑았다 - 0건이면 아래 비교가 전부 헛돈다', () => {
    expect(CANONICAL_INSERTS.length, 'examples.sql').toBeGreaterThan(0)
    expect(RAILS_INSERTS.length, 'examples.rails.sql').toBeGreaterThan(0)
  })

  it('이름 매핑이 실제로 일을 한다 - 안 하면 두 벌은 어차피 다르다', () => {
    // 매핑 없이 뽑으면 Rails 쪽은 정본과 다르다(테이블 이름이 다르므로).
    // 이 단언이 없으면 "매핑이 통째로 사라졌는데 우연히 통과" 를 구별 못 한다.
    expect(insertsOf(RAILS_SQL)).not.toEqual(RAILS_INSERTS)
    expect(RAILS_SQL).toContain('INSERT INTO example_taggings')
    expect(CANONICAL_SQL).toContain('INSERT INTO example_tags')
  })

  it('주석은 비교에 섞이지 않는다 - 두 파일의 주석은 원래 다르다', () => {
    expect(CANONICAL_INSERTS.join('\n')).not.toContain('--')
    expect(RAILS_INSERTS.join('\n')).not.toContain('--')
  })

  /*
   * ★ **이 파서가 두 파일을 통째로 읽었는가.** 위 단언들은 "뽑은 것끼리
   * 같은가" 만 보므로, 파서가 문장을 **조용히 흘리면** 비교 대상이 그만큼
   * 줄어든 채로 초록이 된다 - 실측으로 확인했다: 주석 제거를 지우는 뮤턴트를
   * 걸면 두 파일에서 각각 INSERT 가 여섯이 아니라 **하나씩**만 잡히고, 그
   * 하나가 우연히 서로 같아서 **위 단언들이 전부 통과한다.** 나머지 다섯의
   * 드리프트는 그대로 안 보이게 된다.
   *
   * 그래서 남는 것이 없어야 한다 - 두 파일의 모든 문장은 INSERT · DELETE ·
   * BEGIN · COMMIT 넷 중 하나다.
   */
  it('두 파일의 모든 문장이 분류된다 - 하나라도 못 읽으면 그만큼이 비교에서 빠진다', () => {
    const classified = /^(?:INSERT INTO |DELETE FROM |BEGIN$|COMMIT$)/i
    for (const [name, sql] of [
      ['examples.sql', CANONICAL_SQL],
      ['examples.rails.sql', RAILS_SQL],
    ] as const) {
      const unread = statements(sql).filter((statement) => !classified.test(statement))
      expect(unread, `${name} 에서 읽지 못한 문장`).toEqual([])
    }
  })

  it('README 의 네 테이블이 전부 비교 대상이다', () => {
    const tableOf = (statement: string): string | undefined =>
      /^INSERT INTO (\w+)/i.exec(statement)?.[1]
    const expected = new Set(['categories', 'tags', 'examples', 'example_tags'])
    expect(new Set(CANONICAL_INSERTS.map(tableOf)), 'examples.sql').toEqual(expected)
    expect(new Set(RAILS_INSERTS.map(tableOf)), 'examples.rails.sql(이름 매핑 후)').toEqual(
      expected,
    )
  })
})

describe('씨앗 두 벌이 같은 행을 넣는다', () => {
  it('INSERT 문장 수가 같다', () => {
    expect(RAILS_INSERTS.length, '정본과 Rails 의 INSERT 문장 수').toBe(CANONICAL_INSERTS.length)
  })

  it('테이블 이름을 정본으로 맞추면 INSERT 문장이 완전히 같다 - 컬럼·값·시각까지', () => {
    // 순서까지 같아야 한다고 요구하지 않는다(파일 안의 절 순서는 각자의 사정
    // 이다) - 집합으로 본다. 어긋난 문장은 아래 두 단언이 이름으로 보여준다.
    const canonicalOnly = CANONICAL_INSERTS.filter(
      (statement) => !RAILS_INSERTS.includes(statement),
    )
    const railsOnly = RAILS_INSERTS.filter((statement) => !CANONICAL_INSERTS.includes(statement))

    expect(canonicalOnly, 'examples.sql 에만 있는 INSERT').toEqual([])
    expect(railsOnly, 'examples.rails.sql 에만 있는 INSERT').toEqual([])
  })
})

describe('두 벌의 유일한 차이 - Rails 의 하우스키핑', () => {
  it('정본에는 DELETE 가 하나도 없다', () => {
    expect(statements(CANONICAL_SQL).filter((s) => s.toUpperCase().startsWith('DELETE'))).toEqual(
      [],
    )
  })

  /*
   * `bin/rails db:prepare` 가 `db/seeds.rb` 로 만든 행을 지우는 절이다 -
   * 정본·NestJS 에는 그 스크립트가 이 compose 흐름에서 돌지 않아 대응이 없다
   * (`examples.rails.sql` 의 "0) 하우스키핑" 절이 근거를 갖는다). **이것이
   * 허용되는 유일한 차이다** - 개수를 못박아 두어야 "예외 목록이 조용히
   * 자라는" 모양이 되지 않는다.
   */
  it('Rails 의 DELETE 는 하우스키핑 둘뿐이고, 우리 id 접두사가 아닌 행만 지운다', () => {
    const deletes = statements(RAILS_SQL).filter((s) => s.toUpperCase().startsWith('DELETE'))
    expect(deletes).toHaveLength(2)
    for (const statement of deletes) {
      expect(statement, '우리 행을 지우지 않는다 - NOT LIKE 로 남의 것만 지운다').toContain(
        'NOT LIKE',
      )
    }
  })
})
