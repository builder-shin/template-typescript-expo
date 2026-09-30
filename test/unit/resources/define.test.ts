/**
 * `defineResource` · `parseSortToken` · 구조적 불변식 검사기 자체를 잰다.
 *
 * **이 파일에는 실제 자원이 하나도 나오지 않는다.** 전부 `probe*` 픽스처다.
 * `expect(EXAMPLE.type).toBe('examples')` 같은 테스트는 선언을 그대로 베낀
 * 것이라 아무것도 지키지 않는다 - 규칙을 지키려면 규칙이 **임의의** 선언에
 * 대해 무엇을 하는지 재야 한다. 실제 선언에 규칙을 적용하는 것은
 * `resources.test.ts` 가 한다.
 *
 * 픽스처의 값은 프로덕션 상수와 하나도 겹치지 않는다(`probeWidgets` ·
 * `/probe/api/widgets` · `probeName` ...). 겹치면 "계산했다" 와 "베꼈다" 가
 * 구별되지 않는다.
 */

import { describe, expect, it } from 'vitest'
import { FILTER_OPERATORS, type FilterOperator } from '@/lib/jsonapi/query'
import {
  defineResource,
  type AttributeDefinition,
  type ResourceDefinition,
} from '@/lib/resources/define'
import { checkRegistry, checkResource, queryVocabulary, rulesOf } from './invariants'

/** 검사기가 통과시켜야 하는 임의의 자원. 아래 모든 "깨진" 픽스처의 출발점이다. */
function probeWidget() {
  return defineResource({
    type: 'probeWidgets',
    path: '/probe/api/widgets',
    attributes: {
      probeName: {
        kind: 'string',
        label: 'PROBE 이름',
        readOnly: false,
        nullable: false,
        listed: true,
        minLength: 2,
        maxLength: 9,
      },
      probeCount: {
        kind: 'int',
        label: 'PROBE 수',
        readOnly: false,
        nullable: false,
        listed: true,
        min: 3,
        max: 7,
      },
      probeMode: {
        kind: 'enum',
        label: 'PROBE 모드',
        readOnly: false,
        nullable: true,
        listed: false,
        values: [
          { value: 'probeOn', label: 'PROBE 켬' },
          { value: 'probeOff', label: 'PROBE 끔' },
        ],
      },
      probeMadeAt: {
        kind: 'datetime',
        label: 'PROBE 시각',
        readOnly: true,
        nullable: false,
        listed: true,
      },
    },
    relationships: {
      probeOwner: { cardinality: 'one', type: 'probeOwners', label: 'PROBE 주인' },
      probeMarks: { cardinality: 'many', type: 'probeMarkers', label: 'PROBE 표식' },
    },
    queryOnlyFields: ['probeHiddenAt'],
    filters: {
      probeName: ['contains'],
      'probeOwner.id': ['isNull'],
      probeHiddenAt: ['gte'],
    },
    sorts: ['probeName', 'probeCount', 'probeHiddenAt'],
    defaultSort: '-probeCount',
    includes: ['probeOwner'],
    writable: true,
  })
}

function probeOwners() {
  return defineResource({
    type: 'probeOwners',
    path: '/probe/api/owners',
    attributes: {
      probeLabel: {
        kind: 'string',
        label: 'PROBE 라벨',
        readOnly: false,
        nullable: false,
        listed: true,
      },
    },
    relationships: {},
    filters: { probeLabel: ['exact'] },
    sorts: ['probeLabel'],
    defaultSort: 'probeLabel',
    includes: [],
    writable: true,
  })
}

function probeMarkers() {
  return defineResource({
    type: 'probeMarkers',
    path: '/probe/api/markers',
    attributes: {
      probeLabel: {
        kind: 'string',
        label: 'PROBE 라벨',
        readOnly: false,
        nullable: false,
        listed: true,
      },
    },
    relationships: {},
    filters: { probeLabel: ['exact'] },
    sorts: ['probeLabel'],
    defaultSort: 'probeLabel',
    includes: [],
    writable: true,
  })
}

/** 온전한 픽스처를 한 자리만 망가뜨린다. 출력 타입이 넓어서 캐스트가 필요 없다. */
function broken(patch: Partial<ResourceDefinition>): ResourceDefinition {
  return { ...probeWidget(), ...patch }
}

describe('defineResource — 선언을 그대로 실어 나른다', () => {
  it('선언한 필드를 하나도 잃지 않고 돌려준다', () => {
    const widget = probeWidget()

    // type 과 path 를 서로 다른 값으로 두고 둘 다 잰다 - 한쪽만 재면 두 필드가
    // 뒤바뀐 배선(path: input.type)을 볼 수 없다.
    expect(widget.type).toBe('probeWidgets')
    expect(widget.path).toBe('/probe/api/widgets')
    // 맵은 키만 재면 안 된다 - 그러면 label · nullable · readOnly · listed ·
    // cardinality · 문자열 길이가 defineResource 를 통과하는 것을 아무도 보지
    // 않게 된다(리뷰 I-1: 그 여섯을 고정하는 뮤턴트가 전부 살아남았다).
    // readOnly 와 listed 는 true 자리와 false 자리를 둘 다 재야 한다 - 한쪽만
    // 재면 "전부 그 값으로 고정" 뮤턴트와 구별되지 않는다. 그래서 probeMode
    // 하나만 listed: false 다.
    expect(widget.attributes).toEqual({
      probeName: {
        kind: 'string',
        label: 'PROBE 이름',
        readOnly: false,
        nullable: false,
        listed: true,
        minLength: 2,
        maxLength: 9,
      },
      probeCount: {
        kind: 'int',
        label: 'PROBE 수',
        readOnly: false,
        nullable: false,
        listed: true,
        min: 3,
        max: 7,
      },
      probeMode: {
        kind: 'enum',
        label: 'PROBE 모드',
        readOnly: false,
        nullable: true,
        listed: false,
        values: [
          { value: 'probeOn', label: 'PROBE 켬' },
          { value: 'probeOff', label: 'PROBE 끔' },
        ],
      },
      probeMadeAt: {
        kind: 'datetime',
        label: 'PROBE 시각',
        readOnly: true,
        nullable: false,
        listed: true,
      },
    })
    expect(widget.relationships).toEqual({
      probeOwner: { cardinality: 'one', type: 'probeOwners', label: 'PROBE 주인' },
      probeMarks: { cardinality: 'many', type: 'probeMarkers', label: 'PROBE 표식' },
    })
    expect(widget.filters).toEqual({
      probeName: ['contains'],
      'probeOwner.id': ['isNull'],
      probeHiddenAt: ['gte'],
    })
    expect(widget.sorts).toEqual(['probeName', 'probeCount', 'probeHiddenAt'])
    expect(widget.defaultSort).toBe('-probeCount')
    expect(widget.includes).toEqual(['probeOwner'])
    expect(widget.queryOnlyFields).toEqual(['probeHiddenAt'])
    // writable 은 자원 단위 필드다(D4 Task 1) - 속성 맵과 달리 논리형 하나라
    // 값을 뒤집는 뮤턴트가 있을 수 있다.
    expect(widget.writable).toBe(true)
  })

  it('속성의 선언 순서를 보존한다', () => {
    // 목록 화면이 이 순서로 열을 그린다. Object.keys 가 삽입 순서를 지키는
    // 것에 기대므로 그 기대를 여기서 한 번 못 박는다.
    expect(Object.keys(probeWidget().attributes)).toEqual([
      'probeName',
      'probeCount',
      'probeMode',
      'probeMadeAt',
    ])
  })

  it('queryOnlyFields 를 생략하면 undefined 가 아니라 빈 배열이다', () => {
    // 소비자가 `?? []` 를 반복하지 않아도 되는 것이 이 정규화의 전부다.
    expect(probeOwners().queryOnlyFields).toEqual([])
  })

  it('속성의 제약을 kind 마다 그대로 들고 있다', () => {
    const attributes = probeWidget().attributes
    const count = attributes['probeCount']
    const mode = attributes['probeMode']

    // kind 로 좁히면 단언 없이 제약을 읽을 수 있어야 한다 - 판별 유니온이
    // 하는 일이 그것이다.
    expect(count?.kind === 'int' ? [count.min, count.max] : null).toEqual([3, 7])
    expect(mode?.kind === 'enum' ? mode.values : null).toEqual([
      { value: 'probeOn', label: 'PROBE 켬' },
      { value: 'probeOff', label: 'PROBE 끔' },
    ])
  })

  it('enum 값은 값과 라벨을 함께 갖는다', () => {
    const resource = defineResource({
      type: 'probeThings',
      path: '/probe/api/things',
      attributes: {
        probeMode: {
          kind: 'enum',
          label: 'PROBE 모드',
          readOnly: false,
          nullable: false,
          listed: true,
          values: [
            { value: 'probeOn', label: 'PROBE 켬' },
            { value: 'probeOff', label: 'PROBE 끔' },
          ],
        },
      },
      relationships: {},
      filters: { probeMode: ['exact'] },
      sorts: ['probeMode'],
      defaultSort: 'probeMode',
      includes: [],
      writable: true,
    })
    const mode = resource.attributes.probeMode
    expect(mode?.kind === 'enum' ? mode.values.map((v) => v.label) : null).toEqual([
      'PROBE 켬',
      'PROBE 끔',
    ])
    expect(resource.writable).toBe(true)
  })
})

describe('queryVocabulary — 조회에 쓸 수 있는 이름의 출처 셋', () => {
  it('속성 · queryOnlyFields · 관계의 .id 를 전부 모은다', () => {
    expect([...queryVocabulary(probeWidget())].sort()).toEqual([
      'probeCount',
      'probeHiddenAt',
      'probeMadeAt',
      'probeMarks.id',
      'probeMode',
      'probeName',
      'probeOwner.id',
    ])
  })

  it('관계 이름 자체는 어휘가 아니다 - .id 가 붙은 것만이다', () => {
    // filter[probeOwner] 는 이 계약에 없다. R-4 가 준 이름은 category.id 다.
    const vocabulary = queryVocabulary(probeWidget())
    expect(vocabulary.has('probeOwner')).toBe(false)
    expect(vocabulary.has('probeOwner.id')).toBe(true)
  })
})

describe('구조적 불변식 — 검사기가 실제로 무엇을 거절하는가', () => {
  it('온전한 선언에는 어긋난 자리가 없다', () => {
    // 아래 모든 "깨진" 테스트가 의미를 가지려면 출발점이 깨끗해야 한다.
    expect(checkResource(probeWidget())).toEqual([])
  })

  it('정렬 키가 어휘에 없으면 잡는다', () => {
    // defaultSort 인 probeCount 를 남겨 둔다 - 빼면 default-sort 까지 같이
    // 울려서 이 테스트가 무엇을 잡았는지 흐려진다.
    const violations = checkResource(
      broken({ sorts: ['probeName', 'probeCount', 'probeNeverDeclared'] }),
    )
    expect(rulesOf(violations)).toEqual(['sort-key'])
  })

  it('queryOnlyFields 에서 온 정렬 키는 통과시킨다', () => {
    // 참조 자원의 createdAt 이 사는 자리다 - 정렬은 되는데 속성이 아니다.
    expect(
      checkResource(broken({ sorts: ['probeHiddenAt'], defaultSort: 'probeHiddenAt' })),
    ).toEqual([])
  })

  it('정렬 키가 두 번 있으면 잡는다', () => {
    expect(
      rulesOf(checkResource(broken({ sorts: ['probeName', 'probeCount', 'probeName'] }))),
    ).toEqual(['sort-duplicate'])
  })

  it('필터 키가 어휘에 없으면 잡는다', () => {
    expect(rulesOf(checkResource(broken({ filters: { probeNeverDeclared: ['exact'] } })))).toEqual([
      'filter-key',
    ])
  })

  it('관계에서 온 필터 키(.id)는 통과시킨다', () => {
    expect(checkResource(broken({ filters: { 'probeMarks.id': ['in'] } }))).toEqual([])
  })

  it('FILTER_OPERATORS 에 없는 연산자를 잡는다', () => {
    // 타입이 이미 막지만(아래 "타입이 잡는 것" 참고) 캐스트로 뚫리는 자리다.
    const notAnOperator = ['probeBetween'] as unknown as readonly FilterOperator[]
    expect(rulesOf(checkResource(broken({ filters: { probeName: notAnOperator } })))).toEqual([
      'filter-operator',
    ])
  })

  it('연산자가 하나도 없는 필터를 잡는다', () => {
    expect(rulesOf(checkResource(broken({ filters: { probeName: [] } })))).toEqual([
      'filter-operator-empty',
    ])
  })

  it('같은 연산자가 두 번 있는 필터를 잡는다', () => {
    expect(
      rulesOf(checkResource(broken({ filters: { probeName: ['contains', 'contains'] } }))),
    ).toEqual(['filter-operator-duplicate'])
  })

  it('defaultSort 가 sorts 에 없으면 잡는다', () => {
    expect(rulesOf(checkResource(broken({ defaultSort: '-probeMadeAt' })))).toEqual([
      'default-sort',
    ])
  })

  it('defaultSort 의 - 를 벗겨서 비교한다', () => {
    // '-probeName' 을 통째로 sorts 에서 찾으면 온전한 선언이 어긋난 것으로
    // 보인다. 이 테스트가 그 실수를 잡는다.
    expect(checkResource(broken({ defaultSort: '-probeName' }))).toEqual([])
    expect(checkResource(broken({ defaultSort: 'probeName' }))).toEqual([])
  })

  it('include 가 관계 이름이 아니면 잡는다', () => {
    // 속성 이름은 include 가 될 수 없다 - 관계만 된다.
    expect(rulesOf(checkResource(broken({ includes: ['probeName'] })))).toEqual(['include-name'])
  })

  it('include 가 두 번 있으면 잡는다', () => {
    // 중복 include 는 백엔드가 400 INVALID_INCLUDE 로 거절한다(R-8).
    expect(rulesOf(checkResource(broken({ includes: ['probeOwner', 'probeOwner'] })))).toEqual([
      'include-duplicate',
    ])
  })

  it('enum 에 값이 하나도 없으면 잡는다', () => {
    // 타입은 values 가 있는지만 본다 - [] 는 통과한다. 그대로 두면 폼이 옵션
    // 없는 <select> 를 그리고 사용자는 필수 필드를 채울 수 없다.
    const noValues = broken({
      attributes: {
        ...probeWidget().attributes,
        probeMode: {
          kind: 'enum',
          label: 'PROBE 모드',
          readOnly: false,
          nullable: true,
          listed: false,
          values: [],
        },
      },
    })
    expect(rulesOf(checkResource(noValues))).toEqual(['enum-values-empty'])
  })

  it('enum 값이 두 번 있으면 잡는다', () => {
    // 라벨을 일부러 다르게 둔다 - 중복 판정이 value 만 보는지, 객체 전체를
    // 보는지를 이 자리가 가른다. 라벨까지 같았다면 "전체가 같아야 중복" 으로
    // 잘못 구현해도 이 테스트를 통과한다.
    const repeated = broken({
      attributes: {
        ...probeWidget().attributes,
        probeMode: {
          kind: 'enum',
          label: 'PROBE 모드',
          readOnly: false,
          nullable: true,
          listed: false,
          values: [
            { value: 'probeOn', label: 'PROBE 켬' },
            { value: 'probeOn', label: 'PROBE 켬 둘째' },
          ],
        },
      },
    })
    expect(rulesOf(checkResource(repeated))).toEqual(['enum-values-duplicate'])
  })

  it('enum 값의 라벨이 비어 있으면 잡는다', () => {
    // 값은 있는데 사람이 읽을 라벨이 없다 - <option> 이 빈 글자로 그려진다.
    const emptyLabel = broken({
      attributes: {
        ...probeWidget().attributes,
        probeMode: {
          kind: 'enum',
          label: 'PROBE 모드',
          readOnly: false,
          nullable: true,
          listed: false,
          values: [
            { value: 'probeOn', label: 'PROBE 켬' },
            { value: 'probeOff', label: '' },
          ],
        },
      },
    })
    expect(rulesOf(checkResource(emptyLabel))).toEqual(['enum-label-empty'])
  })

  it('값은 다른데 라벨이 같은 enum 을 잡는다', () => {
    // <select> 는 값으로 옵션을 구별하지 사람은 라벨로 구별한다. 값은 서로
    // 달라 값 중복(enum-values-duplicate)에는 안 걸리지만, 라벨이 같으면
    // 화면에는 똑같이 보이는 옵션 둘이 뜬다.
    const duplicateLabel = broken({
      attributes: {
        ...probeWidget().attributes,
        probeMode: {
          kind: 'enum',
          label: 'PROBE 모드',
          readOnly: false,
          nullable: true,
          listed: false,
          values: [
            { value: 'probeOn', label: 'PROBE 상태' },
            { value: 'probeOff', label: 'PROBE 상태' },
          ],
        },
      },
    })
    expect(rulesOf(checkResource(duplicateLabel))).toEqual(['enum-label-duplicate'])
  })

  it('대조군 - 값도 라벨도 다르면 라벨 중복을 잡지 않는다', () => {
    // 위 테스트와 값의 모양(개수·자리)은 같고 라벨만 서로 다르게 바꾼다 -
    // 검사기가 실제로 라벨을 비교하는지, 아니면 조건과 무관하게 위반을
    // 내는 뮤턴트(예: 무조건 push)가 숨어 있는지를 이 대조가 가른다.
    const uniqueLabels = broken({
      attributes: {
        ...probeWidget().attributes,
        probeMode: {
          kind: 'enum',
          label: 'PROBE 모드',
          readOnly: false,
          nullable: true,
          listed: false,
          values: [
            { value: 'probeOn', label: 'PROBE 상태 켬' },
            { value: 'probeOff', label: 'PROBE 상태 끔' },
          ],
        },
      },
    })
    expect(checkResource(uniqueLabels)).toEqual([])
  })

  it('목록에 그릴 속성이 하나도 없으면 잡는다', () => {
    // 타입은 각 속성의 listed 가 boolean 인지만 본다 - "적어도 하나" 는 보지
    // 못한다. 전부 false 면 목록 화면이 열 없는 표를 그리고, 행이 몇 건 오든
    // 화면에는 아무것도 없다.
    const attributes = Object.fromEntries(
      Object.entries(probeWidget().attributes).map(([name, attribute]) => [
        name,
        { ...attribute, listed: false },
      ]),
    )
    expect(rulesOf(checkResource(broken({ attributes })))).toEqual(['listed-empty'])
  })

  it('속성 하나만 listed 여도 통과한다', () => {
    // 위 테스트가 "전부 false 를 잡는다" 를 재고 이 테스트가 "하나면 충분하다"
    // 를 잰다 - 규칙을 `every` 가 아니라 `some` 으로 뒤집는 뮤턴트가 앞의
    // 테스트만으로는 살아남는다.
    const entries = Object.entries(probeWidget().attributes)
    const attributes = Object.fromEntries(
      entries.map(([name, attribute], position) => [
        name,
        { ...attribute, listed: position === entries.length - 1 },
      ]),
    )
    expect(checkResource(broken({ attributes }))).toEqual([])
  })

  it('writable 인데 폼이 그릴 속성이 하나도 없으면 잡는다', () => {
    // 전부 readOnly 면 formAttributes(define.ts)가 빈다 - "쓸 수 있다" 면서
    // 쓸 칸이 하나도 없는 선언이다.
    const attributes = Object.fromEntries(
      Object.entries(probeWidget().attributes).map(([name, attribute]) => [
        name,
        { ...attribute, readOnly: true },
      ]),
    )
    expect(rulesOf(checkResource(broken({ writable: true, attributes })))).toEqual([
      'writable-form-fields',
    ])
  })

  it('writable: false 면 폼이 그릴 속성이 없어도 통과한다', () => {
    // 위 테스트가 "writable 인데 없으면 잡는다" 를 재고 이 테스트가 "writable
    // 이 아니면 상관없다" 를 잰다 - 조건을 무시하고 무조건 잡는 뮤턴트가 앞의
    // 테스트만으로는 살아남는다.
    const attributes = Object.fromEntries(
      Object.entries(probeWidget().attributes).map(([name, attribute]) => [
        name,
        { ...attribute, readOnly: true },
      ]),
    )
    expect(checkResource(broken({ writable: false, attributes }))).toEqual([])
  })

  it('sorts 가 비면 defaultSort 규칙이 이미 잡는다', () => {
    // sorts-empty 규칙을 따로 두지 않은 이유다 - defaultSort 는 반드시 sorts
    // 안에 있어야 하므로 빈 sorts 는 그 규칙만으로 통과할 수 없다. 규칙을
    // 하나 더 두면 같은 조건에 메시지만 둘이 된다.
    expect(rulesOf(checkResource(broken({ sorts: [] })))).toEqual(['default-sort'])
  })

  it('queryOnlyFields 가 속성과 겹치면 잡는다', () => {
    // 속성이면 이미 어휘에 있다. 겹친다는 것은 둘 중 하나가 틀렸다는 뜻이다.
    // 원래 있던 probeHiddenAt 을 남겨 둔다 - 빼면 그것을 쓰는 필터·정렬이
    // 어휘 밖으로 밀려나 다른 규칙까지 울린다.
    const violations = checkResource(broken({ queryOnlyFields: ['probeHiddenAt', 'probeName'] }))
    expect(rulesOf(violations)).toEqual(['query-only-overlaps-attribute'])
  })

  it('속성 이름과 관계 이름이 겹치면 잡는다 - 폼의 DOM id 가 중복된다', () => {
    // `AttributeField` 와 `RelationshipPicker` 가 둘 다 `id={name}` ·
    // `${name}-error` 를 쓴다(브랜치 리뷰 Minor-3). 관계를 `probeName` 으로
    // 갈아 끼우면 그 이름이 속성에도 있다.
    const violations = checkResource(
      broken({
        relationships: {
          probeName: { cardinality: 'one', type: 'probeOwners', label: 'PROBE 겹침' },
          probeMarks: { cardinality: 'many', type: 'probeMarkers', label: 'PROBE 표식' },
        },
        // 원래 관계(probeOwner)가 사라지므로 그것을 쓰던 필터·include 도 함께
        // 옮긴다 - 안 옮기면 filter-key·include-name 까지 울려 이 규칙 하나를
        // 재는 것이 흐려진다.
        filters: { probeName: ['contains'], 'probeName.id': ['isNull'], probeHiddenAt: ['gte'] },
        includes: ['probeName'],
      }),
    )
    expect(rulesOf(violations)).toEqual(['attribute-relationship-name-clash'])
  })

  it('속성과 관계의 이름이 서로 다르면 통과한다', () => {
    // 온전한 픽스처(probeName·probeCount·... 대 probeOwner·probeMarks)가
    // 이미 그 세계다 - 규칙이 정상 선언을 거절하지 않는다는 것을 잰다.
    expect(rulesOf(checkResource(probeWidget()))).toEqual([])
  })

  it('type 이 비어 있으면 잡는다', () => {
    expect(rulesOf(checkResource(broken({ type: '' })))).toEqual(['type-empty'])
  })

  it("path 가 '/' 로 시작하지 않으면 잡는다", () => {
    expect(rulesOf(checkResource(broken({ path: 'probe/api/widgets' })))).toEqual(['path-shape'])
  })

  it('어긋난 자리가 여럿이면 여럿 다 돌려준다', () => {
    // 첫 위반에서 멈추면 게이트를 여러 번 돌려야 한다.
    const violations = rulesOf(
      checkResource(broken({ sorts: ['probeNeverDeclared'], includes: ['probeName'] })),
    )
    expect(violations).toContain('sort-key')
    expect(violations).toContain('include-name')
    expect(violations).toContain('default-sort')
  })
})

describe('등록부 불변식 — 자원 하나만 봐서는 볼 수 없는 것', () => {
  it('서로를 가리키는 온전한 등록부에는 어긋난 자리가 없다', () => {
    expect(checkRegistry([probeWidget(), probeOwners(), probeMarkers()])).toEqual([])
  })

  it('관계의 대상 type 이 등록부에 없으면 잡는다', () => {
    // 가장 값진 검사다. 오타를 내도 아무도 던지지 않고 resourceByType 이
    // undefined 를 돌려주며, 화면에는 "링크 없는 이름" 이 그려진다 - 눈으로는
    // 정상과 구별되지 않는다.
    expect(rulesOf(checkRegistry([probeWidget(), probeOwners()]))).toEqual(['relationship-type'])
  })

  it('type 이 두 번 등록되면 잡는다', () => {
    // resourceByType 의 Map 은 나중 것으로 조용히 덮는다.
    const violations = rulesOf(checkRegistry([probeOwners(), probeOwners()]))
    expect(violations).toContain('duplicate-type')
  })

  it('type 은 다른데 path 가 같으면 잡는다', () => {
    // 파일을 복사해 새 자원을 만들며 type 만 고치고 path 를 그대로 두는 실수는
    // duplicate-type 에 걸리지 않는다. 두 검사가 서로를 대신하지 못한다.
    const twin: ResourceDefinition = { ...probeMarkers(), path: probeOwners().path }
    const violations = rulesOf(checkRegistry([probeOwners(), twin]))
    expect(violations).toContain('duplicate-path')
    expect(violations).not.toContain('duplicate-type')
  })

  it('각 자원의 불변식도 함께 잰다', () => {
    const violations = rulesOf(
      checkRegistry([{ ...probeOwners(), sorts: ['probeNeverDeclared'] }, probeMarkers()]),
    )
    expect(violations).toContain('sort-key')
  })
})

describe('타입이 잡는 것 — 이 블록을 재는 것은 vitest 가 아니라 pnpm typecheck 다', () => {
  /*
   * `@ts-expect-error` 는 그 줄에 오류가 **없으면** TS2578 로 죽는다. 즉 아래
   * 각 줄은 "타입이 이것을 거절한다" 를 게이트 [1/9] 이 실제로 재는 것이다.
   * 타입이 나중에 느슨해지면 typecheck 가 먼저 빨개진다.
   *
   * 런타임 검사기와 겹치는 자리는 일부러 두 번 잰다 - 캐스트로 타입을 뚫고
   * 들어온 선언은 검사기만 남기 때문이다.
   */

  it('defaultSort 는 sorts 안의 이름이어야 한다', () => {
    const widget = defineResource({
      type: 'probeTyped',
      path: '/probe/api/typed',
      attributes: {
        probeName: {
          kind: 'string',
          label: 'PROBE 이름',
          readOnly: false,
          nullable: false,
          listed: true,
        },
        probeCount: {
          kind: 'int',
          label: 'PROBE 수',
          readOnly: false,
          nullable: false,
          listed: true,
        },
      },
      relationships: {},
      filters: { probeName: ['exact'] },
      sorts: ['probeName'],
      // @ts-expect-error probeCount 는 sorts 에 없다
      defaultSort: '-probeCount',
      includes: [],
      writable: true,
    })

    // 타입을 뚫고 들어와도 런타임 검사기가 같은 자리를 잡는다.
    expect(rulesOf(checkResource(widget))).toEqual(['default-sort'])
  })

  it('정렬 키는 어휘 밖의 이름일 수 없다', () => {
    const widget = defineResource({
      type: 'probeTyped',
      path: '/probe/api/typed',
      attributes: {
        probeName: {
          kind: 'string',
          label: 'PROBE 이름',
          readOnly: false,
          nullable: false,
          listed: true,
        },
      },
      relationships: {},
      filters: { probeName: ['exact'] },
      // @ts-expect-error probeNeverDeclared 는 속성도 queryOnlyFields 도 아니다
      sorts: ['probeName', 'probeNeverDeclared'],
      defaultSort: 'probeName',
      includes: [],
      writable: true,
    })

    expect(rulesOf(checkResource(widget))).toEqual(['sort-key'])
  })

  it('필터 키는 어휘 밖의 이름일 수 없다', () => {
    const widget = defineResource({
      type: 'probeTyped',
      path: '/probe/api/typed',
      attributes: {
        probeName: {
          kind: 'string',
          label: 'PROBE 이름',
          readOnly: false,
          nullable: false,
          listed: true,
        },
      },
      relationships: {},
      // @ts-expect-error probeNeverDeclared 는 속성도 queryOnlyFields 도 아니다
      filters: { probeNeverDeclared: ['exact'] },
      sorts: ['probeName'],
      defaultSort: 'probeName',
      includes: [],
      writable: true,
    })

    expect(rulesOf(checkResource(widget))).toEqual(['filter-key'])
  })

  it('필터 연산자는 FILTER_OPERATORS 안의 것이어야 한다', () => {
    defineResource({
      type: 'probeTyped',
      path: '/probe/api/typed',
      attributes: {
        probeName: {
          kind: 'string',
          label: 'PROBE 이름',
          readOnly: false,
          nullable: false,
          listed: true,
        },
      },
      relationships: {},
      // @ts-expect-error 'probeBetween' 은 FilterOperator 가 아니다
      filters: { probeName: ['probeBetween'] },
      sorts: ['probeName'],
      defaultSort: 'probeName',
      includes: [],
      writable: true,
    })

    // 이 배선의 반대편 - FILTER_OPERATORS 가 실제로 그 여덟을 담고 있는지는
    // lib/jsonapi 의 테스트가 잰다. 여기서는 선언이 그 목록과 묶여 있다는
    // 사실만 잰다.
    expect(FILTER_OPERATORS).toContain('exact')
  })

  it('관계가 없는 자원은 include 를 선언할 수 없다', () => {
    // R-5: 참조 자원에 ?include= 를 붙이는 것 자체가 400 이다. relationships 가
    // 비면 keyof R 이 never 라 [] 외에는 아무것도 쓸 수 없다.
    defineResource({
      type: 'probeTyped',
      path: '/probe/api/typed',
      attributes: {
        probeName: {
          kind: 'string',
          label: 'PROBE 이름',
          readOnly: false,
          nullable: false,
          listed: true,
        },
      },
      relationships: {},
      filters: { probeName: ['exact'] },
      sorts: ['probeName'],
      defaultSort: 'probeName',
      // @ts-expect-error 관계가 하나도 없으므로 include 는 [] 뿐이다
      includes: ['probeOwner'],
      writable: true,
    })

    expect(probeOwners().includes).toEqual([])
  })

  it('include 는 관계 이름이어야 한다 - 속성 이름은 안 된다', () => {
    defineResource({
      type: 'probeTyped',
      path: '/probe/api/typed',
      attributes: {
        probeName: {
          kind: 'string',
          label: 'PROBE 이름',
          readOnly: false,
          nullable: false,
          listed: true,
        },
      },
      relationships: {
        probeOwner: { cardinality: 'one', type: 'probeOwners', label: 'PROBE 주인' },
      },
      filters: { probeName: ['exact'] },
      sorts: ['probeName'],
      defaultSort: 'probeName',
      // @ts-expect-error probeName 은 속성이지 관계가 아니다
      includes: ['probeName'],
      writable: true,
    })

    expect(probeWidget().includes).toEqual(['probeOwner'])
  })

  it("kind: 'enum' 은 values 없이 선언할 수 없다", () => {
    defineResource({
      type: 'probeTyped',
      path: '/probe/api/typed',
      attributes: {
        // @ts-expect-error enum 인데 values 가 없다
        probeMode: {
          kind: 'enum',
          label: 'PROBE 모드',
          readOnly: false,
          nullable: false,
          listed: true,
        },
      },
      relationships: {},
      filters: { probeMode: ['exact'] },
      sorts: ['probeMode'],
      defaultSort: 'probeMode',
      includes: [],
      writable: true,
    })

    const mode = probeWidget().attributes['probeMode']
    expect(mode?.kind === 'enum' ? mode.values.length : 0).toBe(2)
  })

  it('속성은 label · readOnly · nullable · listed 를 하나도 생략할 수 없다', () => {
    // 넷을 한 번에 빼고 재면 안 된다 - 하나만 선택적으로 느슨해져도 나머지가
    // 여전히 오류를 내서 @ts-expect-error 가 계속 쓰이고, 느슨해진 자리는
    // 보이지 않는다(뮤테이션 T6 가 실제로 그렇게 살아남았다). 하나씩 뺀다.
    const missing: AttributeDefinition[] = [
      // @ts-expect-error readOnly 가 없다
      { kind: 'string', label: 'PROBE 이름', nullable: false, listed: true },
      // @ts-expect-error nullable 이 없다
      { kind: 'string', label: 'PROBE 이름', readOnly: false, listed: true },
      // @ts-expect-error label 이 없다
      { kind: 'string', readOnly: false, nullable: false, listed: true },
      // @ts-expect-error listed 가 없다 - 기본값에 숨으면 새 속성이 아무 결정
      // 없이 목록에 끼거나 빠진다(define.ts 의 AttributeBase.listed).
      { kind: 'string', label: 'PROBE 이름', readOnly: false, nullable: false },
      // @ts-expect-error kind 가 없다
      { label: 'PROBE 이름', readOnly: false, nullable: false, listed: true },
    ]

    expect(missing).toHaveLength(5)
    expect(probeOwners().attributes['probeLabel']?.readOnly).toBe(false)
  })
})
