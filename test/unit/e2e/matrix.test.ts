import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  backendKind,
  KNOWN_DIVERGENCES,
  knownDivergenceReason,
  reportKnownDivergences,
  type KnownDivergence,
} from '@/test/e2e/matrix'
import { BASH_TIMEOUT_MS, resolveBash } from '../support/bash'

/**
 * 매트릭스의 판단 셋을 단위에서 지킨다 - `test/e2e/matrix.ts`.
 *
 * E2E 는 백엔드 스택과 기기가 있어야 돌고, 매트릭스는 CI 에서만 세 갈래로 돈다(스펙 13장). 그 두 조건 밖에서도
 * 재야 하는 것이 여기 있다.
 *
 * ## 왜 `backendKind()` 의 던지기가 이 파일의 첫 자리인가
 *
 * `docker compose --profile <존재하지 않는 값>` 은 에러 없이 끝나고 프로파일이 붙지 않은 `db`·`redis` 만 뜬
 * 부분 스택으로 조용히 해석된다(원본 저장소의 실측). 그래서 CI 매트릭스의 `BACKEND_KIND` 오타 하나가 백엔드가
 * 아예 없는 스택 위의 실행을 만들 수 있었다 - "세 백엔드를 커버한다" 는 주장이 조용히 거짓이 되는 길이다. 이
 * 저장소에서는 하네스 스크립트(`test/contract/run.sh`·`test/e2e/run-android.sh`)가 도커·기기를 건드리기 전에
 * `backendKind()` 를 부른다 - 그 배선을 아래 "하네스의 BACKEND_KIND 배선" 절이 스크립트를 실제로 돌려 잰다.
 *
 * ## 목록이 0건인 동안 이 파일이 재는 것
 *
 * `KNOWN_DIVERGENCES` 가 비었으므로 "각 항목이 …" 형태의 단언은 아무것도 돌지 않는다. 그래서 세 가지를 한다.
 *
 * 1. `knownDivergenceReason`·`reportKnownDivergences` 는 프로브 목록을 넘겨 함수 자체를 구동한다.
 * 2. 실제 목록이 빈 배열인지 직접 단언하고, 항목의 식별자·이유 불변식은 정상·없는 식별자·빈 이유 프로브로 잰다.
 * 3. 계약 거울의 `it.fails` 호출 수가 실측된 드리프트 수와 같은지 대조한다.
 *
 * ## 원본과 다른 것
 *
 * 원본은 Playwright 의 `--list` 로 식별자의 제목 경로까지 맞대고 `stack.ts` 의 모듈 평가를 잰다. 이 저장소의
 * 하네스는 Maestro 플로(`test/e2e/flows/<이름>.yaml`)와 vitest 계약 거울(`test/contract/mirror.test.ts`)이라
 * 식별자는 그 파일이 실재하는지까지만 재고, 배선은 bash 스크립트를 실제로 돌려 잰다.
 *
 * ## 여기서 잴 수 없는 것
 *
 * `fail-fast: false`(CI 의 매트릭스)는 GitHub Actions 의 동작이라 이 저장소 안에서 잴 자리가 없다.
 */

/** 이 파일은 `<루트>/test/unit/e2e/matrix.test.ts` 다 - 세 계단 위가 저장소 루트다. */
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

/** 계약 거울이 사는 곳. `it.fails` 를 세는 범위이기도 하다. */
const CONTRACT_DIR = resolve(REPO_ROOT, 'test', 'contract')

/** Maestro 플로가 사는 곳의 부모 - 식별자 `flows/<이름>.yaml` 이 여기서 풀린다. */
const E2E_DIR = resolve(REPO_ROOT, 'test', 'e2e')

/** `KnownDivergence.test` 가 쓰는 구분자. 원본과 같다. */
const TITLE_SEPARATOR = ' › '

/** 알려진 백엔드 셋 밖의 값. 프로덕션 상수와 겹치지 않아야 이 시험이 무언가를 잰다. */
const UNKNOWN_KIND = 'probe-lab-unknown'

/** 알려진 셋. `BACKEND_KINDS` 는 내보내지 않으므로 여기서 한 번 적는다. */
const BACKENDS = ['fastapi', 'nestjs', 'rails'] as const

/** 실재하는 식별자 하나 - 검사기의 참 쪽을 구동한다. 이 플로가 사라지면 이 시험이 죽는다(의도다). */
const REAL_IDENTIFIER = 'flows/examples-browse.yaml'

/**
 * 프로브 드리프트 목록. 프로덕션 목록이 아니다 - 두 함수가 목록을 인자로 받는 이유가 이것이다. 값은 전부
 * `probe-lab` 접두사라 실전값과 겹치지 않는다. 실측·예상을 하나씩 둔다.
 */
const PROBE_DIVERGENCES: readonly KnownDivergence[] = [
  {
    backend: 'rails',
    test: `mirror.test.ts${TITLE_SEPARATOR}probe-lab 실측 자리`,
    reason: 'probe-lab 실측된 이유',
    owner: 'backend',
    verified: true,
  },
  {
    backend: 'nestjs',
    test: 'flows/probe-lab-flow.yaml',
    reason: 'probe-lab 예상만 한 이유',
    owner: 'frontend',
    verified: false,
  },
]

/** 위 목록의 첫 항목(실측). 인덱스 접근을 한 곳으로 모은다. */
const PROBE_VERIFIED = PROBE_DIVERGENCES[0] as KnownDivergence

/**
 * 식별자가 실재하는 시험을 가리키는가 - 이 저장소의 두 소비자에 맞춘 검사다. `flows/<이름>.yaml` 은 그 플로
 * 파일이, `<파일> › …` 는 `test/contract/` 의 그 파일이 있어야 한다. 제목 경로까지는 보지 않는다(원본과 다른 것).
 */
function identifierResolves(identifier: string): boolean {
  if (identifier.startsWith('flows/')) {
    return identifier.endsWith('.yaml') && existsSync(join(E2E_DIR, identifier))
  }
  const [file, ...titles] = identifier.split(TITLE_SEPARATOR)
  if (file === undefined || titles.length === 0) return false
  return existsSync(join(CONTRACT_DIR, file))
}

/** 알려진 어긋남 한 항목은 실재하는 시험과 비어 있지 않은 이유를 가져야 한다. */
function knownDivergenceIsValid(divergence: KnownDivergence): boolean {
  return identifierResolves(divergence.test) && divergence.reason.length > 0
}

/**
 * 소스에서 줄 맨 앞의 `it.fails(`·`test.fails(` 호출만 센다. 주석은 ` * ` 로 시작하므로 문서에서 그 이름을
 * 언급하는 자리에 걸리지 않는다.
 */
function countExpectedFailures(source: string): number {
  return (source.match(/^\s*(?:it|test)\.fails\(/gm) ?? []).length
}

/** `test/contract` 아래의 시험 파일 전부. */
function contractTestFiles(): string[] {
  return readdirSync(CONTRACT_DIR).filter((name) => name.endsWith('.test.ts'))
}

describe('backendKind()', () => {
  const original = process.env.BACKEND_KIND

  afterEach(() => {
    if (original === undefined) delete process.env.BACKEND_KIND
    else process.env.BACKEND_KIND = original
  })

  it('알려진 셋이 아니면 던진다 - 이것이 없으면 부분 스택이 조용히 초록이 된다', () => {
    process.env.BACKEND_KIND = UNKNOWN_KIND
    expect(() => backendKind()).toThrow(UNKNOWN_KIND)
  })

  it('빈 문자열도 던진다 - 셸에서 `BACKEND_KIND=` 로 비우는 것이 흔한 오타다', () => {
    process.env.BACKEND_KIND = ''
    expect(() => backendKind()).toThrow()
  })

  it('안 주면 정본이다 - 로컬 게이트가 인자 없이 돌아야 한다(스펙 12장)', () => {
    delete process.env.BACKEND_KIND
    expect(backendKind()).toBe('fastapi')
  })

  it.each(BACKENDS)('%s 는 그대로 통과한다', (kind) => {
    process.env.BACKEND_KIND = kind
    expect(backendKind()).toBe(kind)
  })
})

describe('KNOWN_DIVERGENCES', () => {
  const valid: KnownDivergence = { ...PROBE_VERIFIED, test: REAL_IDENTIFIER }

  it('오늘 0건이다 - 세 백엔드가 실제로 통일돼 있다', () => {
    expect(KNOWN_DIVERGENCES).toEqual([])
    expect(KNOWN_DIVERGENCES.every(knownDivergenceIsValid)).toBe(true)
  })

  it('실재하는 시험과 이유를 가진 프로브 항목은 통과한다', () => {
    expect.hasAssertions()
    expect(knownDivergenceIsValid(valid)).toBe(true)
  })

  it('없는 시험을 가리키는 프로브 항목은 실패한다', () => {
    expect.hasAssertions()
    expect(knownDivergenceIsValid({ ...valid, test: 'flows/probe-lab-missing.yaml' })).toBe(false)
  })

  it('이유가 빈 프로브 항목은 실패한다 - 근거 없는 드리프트는 "고쳤는지" 를 판단할 수 없다', () => {
    expect.hasAssertions()
    expect(knownDivergenceIsValid({ ...valid, reason: '' })).toBe(false)
  })
})

describe('identifierResolves()', () => {
  it('실재하는 플로와 계약 거울 파일에는 참이다', () => {
    expect(identifierResolves(REAL_IDENTIFIER)).toBe(true)
    expect(
      identifierResolves(`mirror.test.ts${TITLE_SEPARATOR}② 응답의 속성 키 집합이 선언과 같다`),
    ).toBe(true)
  })

  it('이 검사기가 헛돌지 않는다 - 없는 파일·모양이 틀린 식별자는 거짓이다', () => {
    expect(identifierResolves('flows/probe-lab-missing.yaml')).toBe(false)
    expect(identifierResolves('flows/examples-browse')).toBe(false)
    expect(identifierResolves(`probe-lab.test.ts${TITLE_SEPARATOR}제목`)).toBe(false)
    expect(identifierResolves('mirror.test.ts')).toBe(false)
  })
})

describe('knownDivergenceReason()', () => {
  it('그 백엔드의 그 시험이면 이유를 돌려준다', () => {
    expect(knownDivergenceReason('rails', PROBE_VERIFIED.test, PROBE_DIVERGENCES)).toBe(
      PROBE_VERIFIED.reason,
    )
  })

  it('백엔드가 다르면 없다 - 정본에서 Rails 의 드리프트를 기대하면 안 된다', () => {
    expect(knownDivergenceReason('fastapi', PROBE_VERIFIED.test, PROBE_DIVERGENCES)).toBeUndefined()
  })

  it('시험이 다르면 없다', () => {
    expect(
      knownDivergenceReason(
        'rails',
        `mirror.test.ts${TITLE_SEPARATOR}probe-lab 없는 시험`,
        PROBE_DIVERGENCES,
      ),
    ).toBeUndefined()
  })

  it('목록을 안 주면 프로덕션 목록을 본다 - 오늘은 0건이라 언제나 undefined 다', () => {
    expect(knownDivergenceReason('rails', PROBE_VERIFIED.test)).toBeUndefined()
  })
})

describe('reportKnownDivergences()', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  /** 이 백엔드에 대해 찍힌 줄 전부를 하나의 문자열로 모은다. */
  function capture(
    backend: (typeof BACKENDS)[number],
    divergences?: readonly KnownDivergence[],
  ): string {
    const lines: string[] = []
    vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      lines.push(args.map(String).join(' '))
    })
    if (divergences === undefined) reportKnownDivergences(backend)
    else reportKnownDivergences(backend, divergences)
    return lines.join('\n')
  }

  it.each(BACKENDS)(
    '%s 는 오늘 0건이라고 찍는다 - 침묵은 "안 돌았다" 와 구별되지 않는다',
    (backend) => {
      expect(capture(backend)).toContain('없음')
    },
  )

  it('이 백엔드에 걸린 항목 전부를 찍는다 - 매 실행 CI 로그에 남는 것이 매트릭스의 산출물이다', () => {
    const output = capture('rails', PROBE_DIVERGENCES)
    for (const divergence of PROBE_DIVERGENCES.filter((entry) => entry.backend === 'rails')) {
      expect(output).toContain(divergence.test)
      expect(output).toContain(divergence.reason)
    }
    expect(output).toContain('1건')
  })

  it('다른 백엔드의 항목은 섞이지 않는다', () => {
    expect(capture('nestjs', PROBE_DIVERGENCES)).not.toContain(PROBE_VERIFIED.test)
  })

  /*
   * '미실측' 은 '실측' 을 부분 문자열로 포함한다. 그래서 대괄호까지 포함한 표시를 각 항목의 verified 와
   * 맞댄다(원본과 같은 판단).
   */
  const VERIFIED_MARK = '[실측,'
  const PREDICTED_MARK = '[예상(미실측),'

  it('부분 문자열 함정이 실재한다 - 이 검사가 왜 대괄호까지 보는지', () => {
    expect('미실측'.includes('실측'), "'실측' 으로는 둘을 못 가른다").toBe(true)
    expect(PREDICTED_MARK.includes(VERIFIED_MARK), '대괄호까지 보면 갈린다').toBe(false)
  })

  it('실측과 예상을 구별해서 찍는다 - 둘이 같은 글자로 나오면 로그가 거짓말을 한다', () => {
    for (const backend of BACKENDS) {
      const lines = capture(backend, PROBE_DIVERGENCES).split('\n')
      for (const divergence of PROBE_DIVERGENCES.filter((entry) => entry.backend === backend)) {
        const line = lines.find((candidate) => candidate.includes(divergence.test)) ?? ''
        const [expected, forbidden] = divergence.verified
          ? [VERIFIED_MARK, PREDICTED_MARK]
          : [PREDICTED_MARK, VERIFIED_MARK]
        expect(line, divergence.test).toContain(expected)
        expect(line, divergence.test).not.toContain(forbidden)
      }
    }
  })
})

/** 백엔드를 띄우는 하네스 스크립트 - 모두 도커·기기·백엔드를 건드리기 전에 종류를 검증해야 한다. */
const HARNESS_SCRIPTS = ['test/contract/run.sh', 'test/e2e/run-android.sh'] as const

/** 검증 앞에 오면 안 되는 부수 효과 - 도커·기기·시뮬레이터·패키지 관리자·파일 지우기. */
const SIDE_EFFECT =
  /^\s*(?:[^#\n]*\s)?(?:docker|compose|adb|"\$ADB"|xcrun|brew|git clone|rm -rf)\s/m

/** 하네스의 검증 줄 - `BACKEND_KIND=$(node … backendKind() …) || exit 1`. */
const VALIDATION = /^BACKEND_KIND=\$\(node [\s\S]*?backendKind\(\)[\s\S]*?\) \|\| exit 1$/m

/**
 * 스크립트에서 검증 줄만 떼어 저장소 루트에서 돌린다. 스크립트 전체를 돌리지 않는다 - 검증이 빠진 판이 되면
 * 스크립트가 도커·기기를 실제로 건드린다.
 */
function runValidation(script: string, kind: string) {
  const snippet = VALIDATION.exec(readFileSync(resolve(REPO_ROOT, script), 'utf8'))?.[0]
  if (snippet === undefined) throw new Error(`${script} 에 검증 줄이 없다`)
  return spawnSync(resolveBash(), ['-c', `${snippet}\nprintf '%s' "$BACKEND_KIND"`], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: { ...process.env, BACKEND_KIND: kind },
    timeout: BASH_TIMEOUT_MS,
  })
}

/**
 * 하네스가 `backendKind()` 를 실제로 부르는가 - 위 `backendKind()` 절은 "그 함수가 던진다" 만 지킨다. 위험한
 * 것은 스크립트가 그 값을 검증하지 않고 compose 프로파일이나 백엔드 이름으로 쓰는 것이다. 소스에서 검증 줄이
 * 부수 효과보다 먼저인지 보고, 그 줄을 떼어 돌려 모르는 값에서 멈추고 아는 값을 그대로 넘기는지 본다.
 */
describe('하네스의 BACKEND_KIND 배선', () => {
  it.each(HARNESS_SCRIPTS)('%s 는 부수 효과보다 먼저 검증한다', (script) => {
    const source = readFileSync(resolve(REPO_ROOT, script), 'utf8')
    const validation = source.search(VALIDATION)
    expect(validation, '검증 줄이 없다').toBeGreaterThan(-1)
    const sideEffect = source.search(SIDE_EFFECT)
    expect(sideEffect, '부수 효과가 하나도 없다 - 이 검사가 헛돈다').toBeGreaterThan(-1)
    expect(validation).toBeLessThan(sideEffect)
  })

  it.each(HARNESS_SCRIPTS)('%s 의 검증은 모르는 값에서 멈추고 아는 값을 넘긴다', (script) => {
    const unknown = runValidation(script, UNKNOWN_KIND)
    expect(unknown.status, unknown.stderr).toBe(1)
    expect(unknown.stderr).toContain(UNKNOWN_KIND)
    const rails = runValidation(script, 'rails')
    expect(rails.status, rails.stderr).toBe(0)
    expect(rails.stdout).toBe('rails')
  })

  it('부수 효과 찾기가 헛돌지 않는다 - 주석 속 이름은 세지 않는다', () => {
    expect('# docker 를 쓴다\n'.search(SIDE_EFFECT)).toBe(-1)
    expect('compose_down\n'.search(SIDE_EFFECT)).toBe(-1)
    expect('  docker compose up\n'.search(SIDE_EFFECT)).toBeGreaterThan(-1)
    expect('xcrun simctl boot x\n'.search(SIDE_EFFECT)).toBeGreaterThan(-1)
  })
})

/**
 * 계약 거울의 `it.fails` 가 목록과 정확히 맞물려 있는가 - 드리프트 없이 `it.fails` 만 남기면 그 시험은 어떤
 * 이유로 실패해도 초록이 되고, 드리프트를 적고 배선을 잊으면 그 칸이 그냥 빨개진다. 0 에서도 무언가를 잰다.
 * 플로(`flows/…`)의 드리프트는 하네스가 소비하지 않는다 - 목록에 플로를 적는 날 하네스 배선과 이 절을 함께 넓힌다.
 */
describe('it.fails 배선', () => {
  it('세는 검사기가 헛돌지 않는다 - 있으면 세고, 주석은 세지 않는다', () => {
    expect(countExpectedFailures("  it.fails('제목', () => {})\n")).toBe(1)
    expect(countExpectedFailures('it.fails(a)\n  test.fails(b)\n')).toBe(2)
    expect(countExpectedFailures(' * `it.fails()` 를 쓰지 마라\n')).toBe(0)
    expect(countExpectedFailures('   // it.fails 는 조용하지 않다\n')).toBe(0)
  })

  it('계약 거울 파일을 실제로 읽는다 - 목록이 비어도 이 검사는 돈다', () => {
    expect(contractTestFiles()).toContain('mirror.test.ts')
  })

  it('it.fails 호출 수가 계약 거울에 걸린 실측 드리프트 수와 같다', () => {
    const wired = KNOWN_DIVERGENCES.filter(
      (divergence) => divergence.verified && !divergence.test.startsWith('flows/'),
    ).length
    const calls = contractTestFiles().reduce(
      (total, file) =>
        total + countExpectedFailures(readFileSync(join(CONTRACT_DIR, file), 'utf8')),
      0,
    )
    expect(calls, 'test/contract 전체의 it.fails 호출 개수').toBe(wired)
  })
})
