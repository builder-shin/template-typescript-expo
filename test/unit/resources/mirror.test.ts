/**
 * `lib/resources/mirror.ts` - "이 선언이 참이려면 백엔드에 무엇을 물어야
 * 하는가"를 계산하는 순수 함수를 잰다.
 *
 * **이 파일에는 실제 자원이 하나도 나오지 않는다 - 아래 "라벨의 전역
 * 유일성" 절 하나만 예외다(그 자리에 이유를 적었다).** `define.test.ts`·
 * `view.test.ts`와 같은 원칙이다 - `EXAMPLE`을 넘겨 재면 "계산했다"와
 * "선언을 그대로 베꼈다"가 구별되지 않는다. `PROBE_RESOURCE`의 값은 어느
 * 실제 자원의 값과도 겹치지 않는다(`probeGadgets`·`/probe/api/gadgets`·
 * `min: 3, max: 97`...) - 프로덕션 상수(`examples`·`200`·`0`·`100`·
 * `draft`·`active`·`archived`)를 쓰지 않는다. 실제 선언에
 * `mirrorProbes`·`attributeKeys`를 적용해 실제 백엔드와 대조하는 것은
 * `test/e2e/mirror.spec.ts`(Task 2)가 한다 - 이 파일이 지키는 것은 구조뿐이다.
 *
 * `PROBE_RESOURCE`는 브리핑의 최소 픽스처(`probeName`·`probeRank`)에 세
 * 필드를 더했다 - `probeStage`(enum)·`probeSeenAt`(datetime)·
 * `probeExternalRef`(queryOnlyFields). 셋 다 `probeValueForField`
 * (`mirror.ts`)가 갈라 처리하는 자리이고, 최소 픽스처만으로는 그 자리들을
 * 지나가는 뮤턴트가 죽지 않는다 - 아래 "값 생성" 절의 테스트들이 그 자리를
 * 겨냥한다.
 */

import { describe, expect, it } from 'vitest'
import { filterParameter, SORT_PARAMETER } from '@/lib/jsonapi/query'
import { RESOURCES } from '@/lib/resources'
import { defineResource } from '@/lib/resources/define'
import { attributeKeys, mirrorProbes } from '@/lib/resources/mirror'

const PROBE_RESOURCE = defineResource({
  type: 'probeGadgets',
  path: '/probe/api/gadgets',
  attributes: {
    probeName: {
      kind: 'string',
      label: 'PROBE 이름',
      readOnly: false,
      nullable: false,
      listed: true,
    },
    probeRank: {
      kind: 'int',
      label: 'PROBE 등급',
      readOnly: false,
      nullable: false,
      listed: true,
      min: 3,
      max: 97,
    },
    // enum 값 생성(`values[0].value`)을 겨냥한 필드 - M3.
    probeStage: {
      kind: 'enum',
      label: 'PROBE 단계',
      readOnly: false,
      nullable: false,
      listed: false,
      values: [
        { value: 'probeStarted', label: 'PROBE 시작' },
        { value: 'probeFinished', label: 'PROBE 종료' },
      ],
    },
    // UTC 오프셋 요구(실측)를 겨냥한 필드.
    probeSeenAt: {
      kind: 'datetime',
      label: 'PROBE 관측',
      readOnly: true,
      nullable: false,
      listed: false,
    },
  },
  relationships: { probeOwner: { cardinality: 'one', type: 'probeOwners', label: 'PROBE 주인' } },
  // `attributeKeys`가 이것을 걸러내는가(M4)와, 필터 값 생성이 "속성 없음"
  // 갈래로 물러서는가를 겨냥한 필드.
  queryOnlyFields: ['probeExternalRef'],
  filters: {
    probeName: ['exact', 'contains'],
    'probeOwner.id': ['exact', 'isNull'],
    probeStage: ['exact'],
    probeSeenAt: ['gte'],
    probeExternalRef: ['exact'],
  },
  sorts: ['probeName', 'probeRank'],
  defaultSort: '-probeRank',
  includes: ['probeOwner'],
  writable: true,
})

describe('mirrorProbes', () => {
  it('선언된 (필터, 연산자) 조합이 전부 나온다', () => {
    const ok = mirrorProbes(PROBE_RESOURCE).filter((p) => p.expect.kind === 'ok')
    const t = PROBE_RESOURCE.type
    expect(ok.map((p) => p.label)).toEqual(
      expect.arrayContaining([
        `${t} filter probeName exact`,
        `${t} filter probeName contains`,
        `${t} filter probeOwner.id exact`,
        `${t} filter probeOwner.id isNull`,
        `${t} sort probeName`,
        `${t} sort -probeName`,
        `${t} sort probeRank`,
        `${t} sort -probeRank`,
      ]),
    )
  })

  it('선언에 없는 연산자는 INVALID_FILTER 를 기대한다', () => {
    const bad = mirrorProbes(PROBE_RESOURCE).filter(
      (p) => p.expect.kind === 'error' && p.expect.code === 'INVALID_FILTER',
    )
    // probeName 은 gt 를 선언하지 않았다
    expect(bad.some((p) => p.query.toString().includes('filter%5BprobeName%5D%5Bgt%5D'))).toBe(true)
  })

  it('선언에 없는 sort 는 INVALID_SORT 를 기대한다 - 판정 1', () => {
    const bad = mirrorProbes(PROBE_RESOURCE).filter(
      (p) => p.expect.kind === 'error' && p.expect.code === 'INVALID_SORT',
    )
    expect(bad).toHaveLength(1)
    expect(bad[0]?.query.get('sort')).toBeTruthy()
  })

  // --- 값 생성 - kind·필드 갈래마다 (브리핑 Step 3) ---

  it('enum 필터 값은 선언의 첫 값을 쓴다 - M3', () => {
    const probe = mirrorProbes(PROBE_RESOURCE).find(
      (p) => p.label === `${PROBE_RESOURCE.type} filter probeStage exact`,
    )
    expect(probe?.expect.kind).toBe('ok')
    expect(probe?.query.get(filterParameter('probeStage', 'exact'))).toBe('probeStarted')
  })

  it('datetime 필터 값은 UTC 오프셋을 갖는다', () => {
    const probe = mirrorProbes(PROBE_RESOURCE).find(
      (p) => p.label === `${PROBE_RESOURCE.type} filter probeSeenAt gte`,
    )
    const value = probe?.query.get(filterParameter('probeSeenAt', 'gte')) ?? ''
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/)
  })

  it('관계 id 필터 값은 UUID 모양이다', () => {
    const probe = mirrorProbes(PROBE_RESOURCE).find(
      (p) => p.label === `${PROBE_RESOURCE.type} filter probeOwner.id exact`,
    )
    const value = probe?.query.get(filterParameter('probeOwner.id', 'exact')) ?? ''
    expect(value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  })

  it('queryOnlyFields 필터는 문자열 값으로 물러선다', () => {
    const probe = mirrorProbes(PROBE_RESOURCE).find(
      (p) => p.label === `${PROBE_RESOURCE.type} filter probeExternalRef exact`,
    )
    expect(probe?.expect.kind).toBe('ok')
    expect(probe?.query.get(filterParameter('probeExternalRef', 'exact'))).toBeTruthy()
  })

  it('isNull 필터 값은 true 또는 false 문자열이다 - 빈 값이 아니다 - M1', () => {
    const probe = mirrorProbes(PROBE_RESOURCE).find(
      (p) => p.label === `${PROBE_RESOURCE.type} filter probeOwner.id isNull`,
    )
    const value = probe?.query.get(filterParameter('probeOwner.id', 'isNull'))
    expect(value === 'true' || value === 'false').toBe(true)
  })

  it('in 연산자 값은 쉼표로 이어진 값 둘이다', () => {
    // probeName 은 in 을 선언하지 않았다 - 값 생성은 선언 여부와 무관하게 같은
    // 규칙을 따르므로 INVALID_FILTER 프로브로도 이 성질을 잴 수 있다.
    const probe = mirrorProbes(PROBE_RESOURCE).find(
      (p) => p.label === `${PROBE_RESOURCE.type} filter probeName in`,
    )
    const value = probe?.query.get(filterParameter('probeName', 'in')) ?? ''
    const parts = value.split(',')
    expect(parts).toHaveLength(2)
    expect(parts[0]).not.toBe('')
    expect(parts[1]).not.toBe('')
  })

  it('필터 프로브는 절대 빈 값을 만들지 않는다', () => {
    // 실측: 빈 필터 값은 연산자와 무관하게 전부 400 이다 - 값 하나라도
    // 비면 "선언된 조합은 2xx" 검사가 통과할 수 없다(브리핑 ②).
    for (const probe of mirrorProbes(PROBE_RESOURCE)) {
      for (const [key, value] of probe.query.entries()) {
        if (key.startsWith('filter[')) expect(value.length).toBeGreaterThan(0)
      }
    }
  })

  // --- expect.parameter - Task 2 가 source.parameter 와 대조할 값 ---

  it('선언에 없는 연산자 프로브의 parameter 는 실제 쿼리 파라미터 이름과 같다', () => {
    const probe = mirrorProbes(PROBE_RESOURCE).find(
      (p) => p.label === `${PROBE_RESOURCE.type} filter probeName gt`,
    )
    expect(probe?.expect).toEqual({
      kind: 'error',
      code: 'INVALID_FILTER',
      parameter: filterParameter('probeName', 'gt'),
    })
  })

  it('선언에 없는 sort 프로브의 parameter 는 sort 파라미터 이름이다', () => {
    const probe = mirrorProbes(PROBE_RESOURCE).find(
      (p) => p.expect.kind === 'error' && p.expect.code === 'INVALID_SORT',
    )
    expect(probe?.expect).toEqual({
      kind: 'error',
      code: 'INVALID_SORT',
      parameter: SORT_PARAMETER,
    })
  })
})

/**
 * 이 describe 블록만 `PROBE_RESOURCE`가 아니라 **실제 `RESOURCES`**를 쓴다 -
 * 이 파일 머리말의 "실제 자원이 하나도 나오지 않는다"는 원칙의 유일한
 * 예외다(Task 1 리뷰 Important-1).
 *
 * 재는 것 자체가 **여러 자원 사이의 관계**(라벨이 서로 겹치지 않는가)라서,
 * 자원 하나짜리 합성 픽스처로는 애초에 성립하지 않는다 - 겹칠 상대가
 * 없다. `exampleCategories`·`exampleTags`는 `filters`·`sorts`가 글자
 * 하나 다르지 않게 같다(`category.ts`·`tag.ts` 머리말이 스스로 그렇게
 * 적는다) - 라벨에 `resource.type`을 넣지 않으면 이 둘이 만드는 13개
 * 라벨이 바이트 단위로 겹치고, `MIRROR_ABSENT_SORT_FIELD`(자원과 무관한
 * 전역 상수)의 `INVALID_SORT` 라벨은 `examples`까지 포함해 세 자원
 * 전부에서 겹친다. `label`의 존재 이유가 "실패 메시지가 이것으로 무엇이
 * 어긋났는지 말한다"(`mirror.ts`의 `MirrorProbe.label` 주석)인데, 겹치면
 * `test/e2e/mirror.spec.ts`의 77개 프로브 중 어느 것이 죽었는지 라벨
 * 하나로 식별할 수 없게 된다 - 그 실패 메시지가 실제로 무력해지는지는
 * 합성 픽스처가 아니라 **오늘 등록된 진짜 자원들**로만 확인된다.
 */
describe('mirrorProbes 라벨의 전역 유일성', () => {
  it('RESOURCES 전체에서 라벨이 겹치지 않는다', () => {
    const labels = RESOURCES.flatMap((resource) =>
      mirrorProbes(resource).map((probe) => probe.label),
    )
    expect(new Set(labels).size).toBe(labels.length)
  })
})

describe('attributeKeys', () => {
  it('선언 순서 그대로 속성 이름만 돌려준다', () => {
    expect(attributeKeys(PROBE_RESOURCE)).toEqual([
      'probeName',
      'probeRank',
      'probeStage',
      'probeSeenAt',
    ])
  })

  it('queryOnlyFields 를 포함하지 않는다 - M4', () => {
    expect(attributeKeys(PROBE_RESOURCE)).not.toContain('probeExternalRef')
  })
})
