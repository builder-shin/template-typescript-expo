/**
 * 목록 화면의 판단 전부 - `lib/resources/view.ts`.
 *
 * **자원은 `probe*` 로 만든다.** `EXAMPLE` 을 넘겨 재면 "선언을 읽는다" 와
 * "그 자원을 안다" 가 구별되지 않는다. 실제 선언에 이 함수들을 적용하는 것은
 * 화면이 하고, 그 자리는 E2E 가 지킨다.
 *
 * **예외가 하나 있다** - 관계 대상 type 은 `EXAMPLE_CATEGORY.type` 을 쓴다.
 * `relatedText` 가 **프로덕션 등록부**(`resourceByType`)를 지나가는 함수라,
 * 등록되지 않은 type 만으로는 "찾았을 때" 갈래를 아예 밟을 수 없기 때문이다.
 * 값(이름·id)은 전부 `PROBE` 이고, type 도 문자열을 박지 않고 선언에서
 * 꺼낸다.
 */

import { describe, expect, it } from 'vitest'
import type { JsonApiResult } from '@/lib/jsonapi/client'
import type { CollectionDocument, ErrorObject, SingleDocument } from '@/lib/jsonapi/document'
import { filterParameter, parseSortToken } from '@/lib/jsonapi/query'
import { defineResource, type AttributeDefinition } from '@/lib/resources/define'
import { EXAMPLE_CATEGORY } from '@/lib/resources'
import {
  bannerMessages,
  clearFiltersHref,
  currentSortToken,
  detailFields,
  detailLabels,
  detailRequest,
  detailView,
  displayAttribute,
  filterFields,
  filterFieldsKey,
  filterQuery,
  formatAttributeValue,
  listColumns,
  listQuery,
  listRequest,
  listRows,
  listView,
  REFERENCE_PAGE_SIZE,
  referenceList,
  referenceRequest,
  sortOptions,
  type FilterField,
  type FilterFormValues,
  type SortOption,
} from '@/lib/resources/view'

/** 목록에 그리는 속성 셋 + 그리지 않는 하나, 관계 둘(하나는 등록되지 않은 대상). */
function probeGadget() {
  return defineResource({
    type: 'probeGadgets',
    path: '/probe/api/gadgets',
    attributes: {
      probeTitle: {
        kind: 'string',
        label: 'PROBE 제목',
        readOnly: false,
        nullable: false,
        listed: true,
      },
      // 목록에서 빠지는 자리. 이것이 열에 나타나면 "선언을 읽는다" 가 거짓이다.
      probeNote: {
        kind: 'text',
        label: 'PROBE 메모',
        readOnly: false,
        nullable: true,
        listed: false,
      },
      probeCount: {
        kind: 'int',
        label: 'PROBE 수',
        readOnly: false,
        nullable: false,
        listed: true,
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
      // 등록된 대상 - relatedText 가 선언을 찾아 이름을 읽는 갈래.
      probeOwner: { cardinality: 'one', type: EXAMPLE_CATEGORY.type, label: 'PROBE 주인' },
      // 등록되지 않은 대상 - resourceByType 이 undefined 를 주는 갈래.
      probeMarks: { cardinality: 'many', type: 'probeNeverRegistered', label: 'PROBE 표식' },
    },
    filters: { probeTitle: ['contains'] },
    sorts: ['probeTitle'],
    defaultSort: '-probeTitle',
    includes: ['probeOwner', 'probeMarks'],
    writable: true,
  })
}

/** 관계가 없는 자원 - include 를 실을 것이 없다(참조 자원의 모양, R-5). */
function probeLeaflet() {
  return defineResource({
    type: 'probeLeaflets',
    path: '/probe/api/leaflets',
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
    // 참조 자원의 모양(R-5) - 쓰기 라우트가 없다.
    writable: false,
  })
}

/**
 * **같은 순간**을 세 백엔드가 각자의 형식으로 쓴 것(R-10③).
 * 정본은 마이크로초 UTC, NestJS 는 밀리초 `Z`, Rails 는 `+09:00` 이다.
 */
const SAME_INSTANT = {
  canonical: '2026-09-06T21:10:17.293192+00:00',
  nest: '2026-09-06T21:10:17.293Z',
  rails: '2026-09-07T06:10:17.293+09:00',
} as const

const DATETIME = probeGadget().attributes['probeMadeAt']
if (DATETIME === undefined) throw new Error('probeMadeAt 이 있어야 한다')

function probeDocument() {
  return {
    data: [
      {
        type: 'probeGadgets',
        id: 'probe-g1',
        attributes: {
          probeTitle: 'PROBE 첫째',
          probeNote: 'PROBE 메모 본문',
          // 0 이다. 빈 값 판정을 truthy 로 쓰면 여기서 칸이 사라진다.
          probeCount: 0,
          probeMadeAt: SAME_INSTANT.canonical,
        },
        relationships: {
          probeOwner: { data: { type: EXAMPLE_CATEGORY.type, id: 'probe-c1' } },
          probeMarks: {
            data: [
              { type: 'probeNeverRegistered', id: 'probe-m1' },
              { type: 'probeNeverRegistered', id: 'probe-m2' },
            ],
          },
        },
      },
      {
        type: 'probeGadgets',
        id: 'probe-g2',
        attributes: {
          probeTitle: 'PROBE 둘째',
          // probeNote 가 아예 없다 - 목록에 안 쓰이므로 아무 차이도 없어야 한다.
          probeCount: 7,
          probeMadeAt: SAME_INSTANT.rails,
        },
        relationships: {
          probeOwner: { data: null },
          probeMarks: { data: [] },
        },
      },
    ],
    included: [
      {
        type: EXAMPLE_CATEGORY.type,
        id: 'probe-c1',
        // 이름 자리의 키는 그 자원의 선언이 정한다 - displayAttribute 로 꺼낸다.
        attributes: { [displayAttributeName(EXAMPLE_CATEGORY.type)]: 'PROBE 분류 이름' },
      },
    ],
  }
}

/** 등록된 자원의 이름 속성 키. 문자열을 박지 않으려고 선언에서 꺼낸다. */
function displayAttributeName(type: string): string {
  if (type !== EXAMPLE_CATEGORY.type) throw new Error('이 헬퍼는 분류 자원 전용이다')
  const display = displayAttribute(EXAMPLE_CATEGORY)
  if (display === undefined) throw new Error('분류 자원에 목록 속성이 있어야 한다')
  return display[0]
}

describe('displayAttribute — 자원을 대표하는 한 속성', () => {
  it('listed 인 첫 속성을 고른다', () => {
    expect(displayAttribute(probeGadget())?.[0]).toBe('probeTitle')
  })

  it('첫 속성이 listed 가 아니면 건너뛴다', () => {
    // 이 자리가 `[0]` 과 `listed 인 첫 것` 을 실제로 가른다 - 등록된 세 자원은
    // 우연히 첫 속성이 곧 첫 listed 라 이 구별을 하지 못한다.
    const gadget = probeGadget()
    const shifted = {
      ...gadget,
      attributes: {
        probeHidden: {
          kind: 'string' as const,
          label: 'PROBE 숨김',
          readOnly: false,
          nullable: false,
          listed: false,
        },
        ...gadget.attributes,
      },
    }
    expect(Object.keys(shifted.attributes)[0]).toBe('probeHidden')
    expect(displayAttribute(shifted)?.[0]).toBe('probeTitle')
  })

  it('목록에 그릴 속성이 하나도 없으면 undefined 다', () => {
    const gadget = probeGadget()
    const none = {
      ...gadget,
      attributes: Object.fromEntries(
        Object.entries(gadget.attributes).map(([name, attribute]) => [
          name,
          { ...attribute, listed: false },
        ]),
      ),
    }
    expect(displayAttribute(none)).toBeUndefined()
  })
})

describe('listColumns — 열은 선언이 정한다', () => {
  it('listed 인 속성 다음에 관계 전부를, 선언 순서 그대로', () => {
    expect(listColumns(probeGadget())).toEqual([
      { key: 'probeTitle', label: 'PROBE 제목' },
      { key: 'probeCount', label: 'PROBE 수' },
      { key: 'probeMadeAt', label: 'PROBE 시각' },
      { key: 'probeOwner', label: 'PROBE 주인' },
      { key: 'probeMarks', label: 'PROBE 표식' },
    ])
  })

  it('listed 가 아닌 속성은 열이 되지 않는다', () => {
    expect(listColumns(probeGadget()).map((column) => column.key)).not.toContain('probeNote')
  })

  it('관계가 없는 자원은 속성 열만 갖는다', () => {
    expect(listColumns(probeLeaflet())).toEqual([{ key: 'probeLabel', label: 'PROBE 라벨' }])
  })
})

describe('formatAttributeValue', () => {
  it('없는 값은 빈 문자열이다', () => {
    const title = probeGadget().attributes['probeTitle']
    if (title === undefined) throw new Error('probeTitle 이 있어야 한다')
    expect(formatAttributeValue(title, null)).toBe('')
    expect(formatAttributeValue(title, undefined)).toBe('')
  })

  it('0 은 빈 값이 아니다', () => {
    const count = probeGadget().attributes['probeCount']
    if (count === undefined) throw new Error('probeCount 가 있어야 한다')
    expect(formatAttributeValue(count, 0)).toBe('0')
  })

  it('세 백엔드의 서로 다른 표현이 같은 순간이면 같은 문자열이 된다', () => {
    // R-10③. 셋 다 유효한 ISO 8601 이고 가리키는 순간이 같다.
    const formatted = [SAME_INSTANT.canonical, SAME_INSTANT.nest, SAME_INSTANT.rails].map((raw) =>
      formatAttributeValue(DATETIME, raw),
    )
    expect(formatted).toEqual(['2026-09-06 21:10', '2026-09-06 21:10', '2026-09-06 21:10'])
  })

  it('문자열을 자르는 구현과 실제로 다른 답을 낸다', () => {
    // 이 단언이 없으면 `slice(0, 10)` 뮤턴트가 위 테스트만으로는… 죽기는 하지만,
    // **왜** 죽는지가 테스트에 남지 않는다. Rails 의 +09:00 에서 하루가
    // 어긋난다는 것이 이 자리의 전부다.
    expect(SAME_INSTANT.rails.slice(0, 10)).toBe('2026-09-07')
    expect(formatAttributeValue(DATETIME, SAME_INSTANT.rails).slice(0, 10)).toBe('2026-09-06')
  })

  it('날짜로 읽을 수 없는 값은 원문 그대로 보여준다', () => {
    // 지어내지 않는다 - 거울이 어긋난 것을 화면에서 볼 수 있어야 한다.
    expect(formatAttributeValue(DATETIME, 'PROBE 날짜 아님')).toBe('PROBE 날짜 아님')
  })

  it('그 밖의 kind 는 값을 문자열로만 바꾼다', () => {
    const title = probeGadget().attributes['probeTitle']
    if (title === undefined) throw new Error('probeTitle 이 있어야 한다')
    expect(formatAttributeValue(title, 'PROBE 값')).toBe('PROBE 값')
  })

  it('enum 은 값이 아니라 선언의 라벨을 보여준다', () => {
    // 목록·상세·폼의 <select> 가 같은 라벨을 써야 한다는 것이 D4 Task 1 의
    // 목적이다 - 값(`probe-live`)을 그대로 보여주면 그 약속이 깨진다.
    const status: AttributeDefinition = {
      kind: 'enum',
      label: 'PROBE 상태',
      readOnly: false,
      nullable: false,
      listed: true,
      values: [
        { value: 'probe-draft', label: 'PROBE 초안' },
        { value: 'probe-live', label: 'PROBE 공개' },
      ],
    }
    expect(formatAttributeValue(status, 'probe-live')).toBe('PROBE 공개')
  })

  it('선언에 없는 enum 값은 원문 그대로 보여준다', () => {
    // 거울이 어긋난 경우(D4 Task 1) - `formatDateTime` 이 파싱 못 한 값을
    // 원문 그대로 두는 것과 같은 판단이다. 라벨을 못 찾았다고 빈칸이나
    // 예외로 감추면 어긋난 사실이 화면에서 사라진다.
    const status: AttributeDefinition = {
      kind: 'enum',
      label: 'PROBE 상태',
      readOnly: false,
      nullable: false,
      listed: true,
      values: [{ value: 'probe-draft', label: 'PROBE 초안' }],
    }
    expect(formatAttributeValue(status, 'probe-unknown')).toBe('probe-unknown')
  })
})

describe('listQuery — 나가는 쿼리 전체', () => {
  it('JSON:API 문법만 통과시키고 include 를 반드시 싣는다', () => {
    // 쿼리 **전체**를 고정한다. 일부만 재면 include 가 빠져도 아무도 모른다.
    //
    // ⚠️ 예전 주석은 그 이유로 "정본에서는 화면이 똑같아 보인다(R-10②)" 를
    // 들었는데 **거짓이다** - 이름은 `included` 에만 있어서 include 를 빼면
    // 정본에서도 배지가 UUID 가 된다(D3 Task 7 실측, `lib/resources/view.ts`
    // 의 `listQuery` 주석의 표). 이 단언이 필요한 이유는 그것과 무관하게
    // 유효하다: **여기가 나가는 쿼리를 통째로 고정하는 유일한 자리다.**
    const query = listQuery(probeGadget(), {
      'filter[probeTitle][contains]': 'PROBE 조각',
      sort: '-probeTitle',
      'page[size]': '3',
      utm_source: 'probe-campaign',
    })
    expect([...query.entries()]).toEqual([
      ['filter[probeTitle][contains]', 'PROBE 조각'],
      ['sort', '-probeTitle'],
      ['page[size]', '3'],
      // (template-typescript-expo) 커서의 입구 - 목록은 커서다(스펙 8.3).
      ['page[after]', ''],
      ['include', 'probeOwner,probeMarks'],
    ])
  })

  it('URL 에 이미 include 가 있으면 붙이지 않고 덮는다', () => {
    // append 하면 중복 include 가 되어 백엔드가 400 으로 거절한다(R-8).
    const query = listQuery(probeGadget(), { include: 'probeOwner' })
    expect(query.getAll('include')).toEqual(['probeOwner,probeMarks'])
  })

  it('page[totals] 를 켜지 않는다', () => {
    // 스펙 8.3: 총 개수를 실제로 표시하는 화면에서만 켠다. 이 화면은 어디에도
    // 표시하지 않는다.
    expect(listQuery(probeGadget(), {}).has('page[totals]')).toBe(false)
  })

  it('sort 를 스스로 붙이지 않는다', () => {
    // 정렬 UI 가 없는 동안에는 백엔드의 기본 정렬을 그대로 쓴다.
    expect(listQuery(probeGadget(), {}).has('sort')).toBe(false)
  })

  it('관계가 없는 자원에는 include 를 붙이지 않는다', () => {
    // 참조 자원에 ?include= 를 붙이는 것 자체가 400 이다(R-5).
    expect(listQuery(probeLeaflet(), {}).has('include')).toBe(false)
  })

  it('관계가 없는 자원이어도 URL 의 include 는 그대로 보낸다', () => {
    // 스펙 8.1: 프론트가 미리 걸러내면 백엔드 계약이 어떻게 반응하는지 볼 수
    // 없게 된다. 덮을 것이 없으므로 그대로 나간다.
    expect(listQuery(probeLeaflet(), { include: 'probeNothing' }).getAll('include')).toEqual([
      'probeNothing',
    ])
  })

  it('값이 undefined 인 파라미터를 떨어뜨린다', () => {
    const query = listQuery(probeLeaflet(), { sort: undefined, 'filter[probeLabel]': 'PROBE' })
    expect(query.has('sort')).toBe(false)
    expect(query.getAll('filter[probeLabel]')).toEqual(['PROBE'])
  })

  it('같은 이름이 여럿인 파라미터를 그대로 실어 보낸다', () => {
    // 백엔드는 중복 sort 를 400 으로 거절한다(R-8). 프론트가 미리 손보지
    // 않는 것이 스펙 8.1 이다.
    const query = listQuery(probeLeaflet(), { sort: ['probeLabel', '-probeLabel'] })
    expect(query.getAll('sort')).toEqual(['probeLabel', '-probeLabel'])
  })
})

describe('relatedText 를 지나는 관계 칸', () => {
  it('등록된 자원은 그 선언이 정한 속성으로 이름을 그린다', () => {
    const rows = listRows(probeGadget(), probeDocument())
    expect(rows[0]?.cells.find((cell) => cell.key === 'probeOwner')?.values).toEqual([
      'PROBE 분류 이름',
    ])
  })

  it('to-many 관계의 대상들도 같은 규칙으로 그린다', () => {
    // 이 픽스처의 표식들은 included 에 없으므로 자원 객체가 아니다 - 즉
    // 여기서 밟는 것은 `isResourceObject` 갈래이지 등록부 갈래가 아니다.
    // 등록부 갈래는 아래 테스트가 따로 밟는다.
    const rows = listRows(probeGadget(), probeDocument())
    expect(rows[0]?.cells.find((cell) => cell.key === 'probeMarks')?.values).toEqual([
      'probe-m1',
      'probe-m2',
    ])
  })

  it('included 에 있어도 등록되지 않은 type 이면 id 로 물러선다', () => {
    // **`resourceByType` 이 실제로 `undefined` 를 돌려주는 유일한 자리다.**
    // hydrate 된 객체라 `isResourceObject` 가 참이므로 앞의 갈래가 가려 주지
    // 못한다 - 그래서 위 테스트만으로는 `resourceByType(t)!` 뮤턴트가
    // 살아남았다(실측, 커밋 58d0ecc 위에서 M17).
    //
    // 속성을 일부러 실어 둔다: 등록되지 않은 자원의 이름을 지어내면(예:
    // `attributes.name` 을 넘겨짚으면) 이 단언이 죽는다. 어느 속성이 이름인지
    // 아는 것은 선언뿐이고, 선언이 없으면 우리는 모른다.
    const rows = listRows(probeGadget(), {
      ...probeDocument(),
      included: [
        {
          type: 'probeNeverRegistered',
          id: 'probe-m1',
          attributes: { name: 'PROBE 지어내면 안 되는 이름' },
        },
      ],
    })
    expect(rows[0]?.cells.find((cell) => cell.key === 'probeMarks')?.values).toEqual([
      'probe-m1',
      'probe-m2',
    ])
  })

  it('included 에 없는 대상도 id 로 물러선다', () => {
    const document = probeDocument()
    const rows = listRows(probeGadget(), { ...document, included: [] })
    expect(rows[0]?.cells.find((cell) => cell.key === 'probeOwner')?.values).toEqual(['probe-c1'])
  })

  it('이름 자리가 비어 있으면 id 로 물러선다', () => {
    const document = probeDocument()
    const rows = listRows(probeGadget(), {
      ...document,
      included: [{ type: EXAMPLE_CATEGORY.type, id: 'probe-c1', attributes: {} }],
    })
    expect(rows[0]?.cells.find((cell) => cell.key === 'probeOwner')?.values).toEqual(['probe-c1'])
  })
})

describe('listRows — 자원 객체를 행으로', () => {
  it('열 순서 그대로 칸을 만든다', () => {
    const rows = listRows(probeGadget(), probeDocument())
    expect(rows[0]).toEqual({
      id: 'probe-g1',
      cells: [
        { key: 'probeTitle', kind: 'attribute', values: ['PROBE 첫째'] },
        { key: 'probeCount', kind: 'attribute', values: ['0'] },
        { key: 'probeMadeAt', kind: 'attribute', values: ['2026-09-06 21:10'] },
        { key: 'probeOwner', kind: 'relationship', values: ['PROBE 분류 이름'] },
        { key: 'probeMarks', kind: 'relationship', values: ['probe-m1', 'probe-m2'] },
      ],
    })
  })

  it('비어 있는 관계는 빈 배열이다 - to-one 도 to-many 도', () => {
    const rows = listRows(probeGadget(), probeDocument())
    expect(rows[1]).toEqual({
      id: 'probe-g2',
      cells: [
        { key: 'probeTitle', kind: 'attribute', values: ['PROBE 둘째'] },
        { key: 'probeCount', kind: 'attribute', values: ['7'] },
        { key: 'probeMadeAt', kind: 'attribute', values: ['2026-09-06 21:10'] },
        { key: 'probeOwner', kind: 'relationship', values: [] },
        { key: 'probeMarks', kind: 'relationship', values: [] },
      ],
    })
  })

  it('행의 순서와 개수를 응답 그대로 유지한다', () => {
    expect(listRows(probeGadget(), probeDocument()).map((row) => row.id)).toEqual([
      'probe-g1',
      'probe-g2',
    ])
  })

  it('data 가 비면 행도 없다', () => {
    expect(listRows(probeGadget(), { data: [] })).toEqual([])
  })
})

/** 백엔드가 낸 오류 하나. 문구는 전부 PROBE 라 실제 카탈로그와 겹치지 않는다. */
function probeError(patch: Partial<ErrorObject> = {}): ErrorObject {
  return { status: '400', code: 'PROBE_QUERY', detail: 'PROBE 조회 오류', ...patch }
}

describe('bannerMessages — 세 통을 전부 편다', () => {
  it('문서 오류를 그대로 낸다', () => {
    expect(bannerMessages([probeError()])).toEqual(['PROBE 조회 오류'])
  })

  it('필드에 붙은 오류도 버리지 않는다', () => {
    // 목록에는 오류를 붙일 입력이 없다. 문서 통만 그리면 이 문구가 사라진다.
    const messages = bannerMessages([
      probeError({ detail: 'PROBE 문서' }),
      probeError({ detail: 'PROBE 속성', source: { pointer: '/data/attributes/probeTitle' } }),
      probeError({ detail: 'PROBE 관계', source: { pointer: '/data/relationships/probeOwner' } }),
    ])
    expect(messages).toEqual(['PROBE 문서', 'PROBE 속성', 'PROBE 관계'])
  })

  it('문구가 하나도 없는 오류는 항목을 만들지 않는다', () => {
    expect(bannerMessages([{ status: '400' }])).toEqual([])
  })
})

/** 백엔드가 응답조차 주지 못했을 때 client.ts 가 남기는 표시. */
function probeSyntheticError(): ErrorObject {
  return {
    status: '0',
    // 실제 합성 코드 셋(NETWORK_ERROR 등)과 일부러 다르다 - 판정이 코드
    // 문자열이 아니라 표시로 이뤄지는지 재려면 코드가 겹치면 안 된다.
    code: 'PROBE_TRANSPORT',
    detail: 'PROBE 전송 실패',
    meta: { synthetic: true },
  }
}

describe('listRequest — 화면이 부르는 조립 전부', () => {
  /**
   * **이 하나가 `page.tsx` 의 몸통을 대신 지킨다**(리뷰 라운드 1, Important-1).
   * 예전에는 화면이 `listQuery` · `withAcceptLanguage` · `path` 를 각각 불렀고
   * 그 셋을 지우는 뮤턴트가 게이트 8/8 초록으로 살아남았다. 세 값을 한 번에
   * `toEqual` 로 고정한다 - 값은 전부 실전과 다른 `probe*` 다.
   */
  it('경로 · 쿼리 · 옵션 셋을 한꺼번에 만든다', () => {
    const plan = listRequest(probeGadget(), {
      'filter[probeTitle][contains]': 'PROBE 조각',
      utm_source: 'probe-campaign',
    })

    expect(plan.path).toBe('/probe/api/gadgets')
    expect([...plan.query.entries()]).toEqual([
      ['filter[probeTitle][contains]', 'PROBE 조각'],
      ['page[after]', ''],
      ['page[size]', '20'],
      ['include', 'probeOwner,probeMarks'],
    ])
    // (template-typescript-expo) 옵션에 Accept-Language 가 없다 - platform/api.ts 가 싣는다.
    expect(plan.options).toEqual({ query: plan.query })
    // 옵션에 실린 쿼리가 **같은 객체**여야 한다 - 두 벌이면 화면이 보낸 것과
    // `filtered` 판정이 갈릴 수 있고, 그 어긋남은 RSC 라 아무도 못 본다.
    expect(plan.options.query).toBe(plan.query)
  })

  it('accessToken 을 넣지 않는다 - 읽기는 완전 공개다(R-9)', () => {
    expect(listRequest(probeGadget(), {}).options.accessToken).toBeUndefined()
  })

  it('Accept-Language 를 싣지 않는다 - 앱의 API 클라이언트 한 곳이 싣는다(스펙 9.4)', () => {
    // (template-typescript-expo) 조립 함수가 언어를 인자로 받으면 그 인자를 null 로 바꾸는
    // 뮤턴트가 게이트를 통과한다(원본 저장소의 측정). 싣는 자리는 platform/api.ts 하나다.
    expect('acceptLanguage' in listRequest(probeGadget(), {}).options).toBe(false)
  })

  it('경로를 선언에서 가져온다 - type 에서 유도하지 않는다(R-1)', () => {
    // probeLeaflet 의 path 에는 type 이 들어 있지 않다. 한쪽만 재면 두 필드가
    // 뒤바뀐 배선을 볼 수 없다.
    expect(listRequest(probeLeaflet(), {}).path).toBe(probeLeaflet().path)
    expect(probeLeaflet().path).not.toContain(probeLeaflet().type)
  })
})

describe('listView — 응답에서 화면 상태로', () => {
  /** 쿼리만 다른 요청 하나. `listView` 는 이 안의 `query` 만 읽는다. */
  const plan = (search = '') => ({
    path: probeGadget().path,
    query: new URLSearchParams(search),
    options: {},
  })

  /** (template-typescript-expo) 쪽 하나짜리 목록 - 원본의 `listView` 는 응답 하나를 받았다. */
  const listViewOf = (
    request: ReturnType<typeof plan>,
    result: JsonApiResult<CollectionDocument>,
  ) => listView(probeGadget(), request, [result])

  it('성공 응답을 목록으로 만든다', () => {
    const view = listViewOf(plan(), {
      ok: true,
      status: 200,
      document: probeDocument(),
    })
    if (view.kind !== 'list') throw new Error('목록이어야 한다')
    expect(view.columns).toEqual(listColumns(probeGadget()))
    expect(view.rows.map((row) => row.id)).toEqual(['probe-g1', 'probe-g2'])
    expect(view.filtered).toBe(false)
    expect(view.failure).toBe(null)
  })

  it('빈 목록도 열은 그대로 갖는다', () => {
    const view = listViewOf(plan(), { ok: true, status: 200, document: { data: [] } })
    if (view.kind !== 'list') throw new Error('목록이어야 한다')
    expect(view.rows).toEqual([])
    expect(view.columns.length).toBeGreaterThan(0)
  })

  it('필터가 걸린 쿼리였는지 화면에 알려준다', () => {
    const filtered = listViewOf(plan('filter[probeTitle][contains]=PROBE'), {
      ok: true,
      status: 200,
      document: { data: [] },
    })
    const unfiltered = listViewOf(plan('sort=probeTitle'), {
      ok: true,
      status: 200,
      document: { data: [] },
    })
    if (filtered.kind !== 'list' || unfiltered.kind !== 'list') throw new Error('목록이어야 한다')
    expect(filtered.filtered).toBe(true)
    expect(unfiltered.filtered).toBe(false)
  })

  it('백엔드 오류는 배너다', () => {
    const view = listViewOf(plan(), {
      ok: false,
      status: 400,
      errors: [probeError()],
    })
    expect(view).toEqual({ kind: 'banner', messages: ['PROBE 조회 오류'] })
  })

  it('합성 오류(transport)는 unreachable 이다 - 화면이 앱 문구와 다시 시도를 그린다', () => {
    // 스펙 9.2 · D2 의 계약. 배너로 그리면 "백엔드에 닿지 못했다" 를 화면이
    // 정상 오류인 것처럼 보여준다. (template-typescript-expo) 원본은 던져서 error.tsx 로
    // 보냈다 - 이 앱은 던지지 않고 스펙 9.3 의 "다시 시도" 를 그린다.
    expect(listViewOf(plan(), { ok: false, status: 0, errors: [probeSyntheticError()] })).toEqual({
      kind: 'unreachable',
    })
  })

  it('합성 여부는 code 문자열이 아니라 표시로 판정한다', () => {
    // 같은 문서에서 meta 만 뺀 것이다. 코드 문자열로 판정하는 구현이었다면
    // 위 테스트와 이 테스트가 같은 답을 낸다.
    const withoutMarker: ErrorObject = { ...probeSyntheticError() }
    delete withoutMarker.meta
    const view = listViewOf(plan(), {
      ok: false,
      status: 0,
      errors: [withoutMarker],
    })
    expect(view).toEqual({ kind: 'banner', messages: ['PROBE 전송 실패'] })
  })

  it('문구가 하나도 없는 오류 문서는 던진다', () => {
    // 배너를 그려도 FormBanner 가 빈 배열에 null 이라 사용자는 아무 설명 없는
    // 빈 화면을 본다.
    expect(() =>
      listViewOf(plan(), { ok: false, status: 400, errors: [{ status: '400' }] }),
    ).toThrow()
  })

  it('본문 없는 성공 응답(204)은 던진다', () => {
    // 컬렉션 GET 에 올 수 없는 응답이다. 빈 목록으로 다루면 깨진 백엔드가
    // "자료 없음" 으로 위장한다.
    expect(() => listViewOf(plan(), { ok: true, status: 204, document: null })).toThrow()
  })
})

/**
 * 필터 바가 쓰는 순수 함수들(D3 Task 4).
 *
 * **화면(`components/resource/filter-bar.tsx`)은 훅을 쓴다 - `useRouter` 가
 * 라우터 컨텍스트를 요구해 vitest 에서 던진다.** 그래서 판단을 전부 여기로
 * 뺐다: 선언 → 컨트롤 매핑도, 컨트롤 값 → 쿼리 변환도 이 파일이 잰다. 화면에
 * 남은 것은 이 값들을 마크업으로 옮기는 일뿐이고 그쪽은
 * `test/unit/components/filter-bar.test.ts` 가 `renderToStaticMarkup` 으로
 * 잰다.
 */

/**
 * 필터 정책만 넓게 편 자원. 컨트롤 사다리의 **모든 갈래**가 여기 하나에 있다.
 *
 * 실제 자원(`EXAMPLE`)으로 재면 안 되는 이유가 둘이다. 하나는 늘 그 이유 -
 * "선언을 읽는다" 와 "그 자원을 안다" 가 구별되지 않는다. 다른 하나는 이
 * 태스크에만 있는 것으로, `EXAMPLE.filters` 에는 **밟히지 않는 갈래가 많다**
 * (하한만 있는 필드도, 배타 연산자만 있는 필드도, 컨트롤을 만들 수 없는
 * 조합도 없다).
 */
function probeSieve() {
  return defineResource({
    attributes: {
      probeName: {
        kind: 'string',
        label: 'PROBE 이름',
        readOnly: false,
        nullable: false,
        listed: true,
      },
      probeState: {
        kind: 'enum',
        label: 'PROBE 상태',
        readOnly: false,
        nullable: false,
        listed: true,
        values: [
          { value: 'probe-open', label: 'PROBE 열림' },
          { value: 'probe-shut', label: 'PROBE 닫힘' },
          { value: 'probe-gone', label: 'PROBE 사라짐' },
        ],
      },
      probeGrade: {
        kind: 'enum',
        label: 'PROBE 등급',
        readOnly: false,
        nullable: false,
        listed: true,
        values: [
          { value: 'probe-hi', label: 'PROBE 높음' },
          { value: 'probe-lo', label: 'PROBE 낮음' },
        ],
      },
      // enum 인데 값 목록을 쓸 연산자가 없다 - 사다리 아래로 내려간다.
      probeTone: {
        kind: 'enum',
        label: 'PROBE 색조',
        readOnly: false,
        nullable: false,
        listed: true,
        values: [
          { value: 'probe-warm', label: 'PROBE 따뜻함' },
          { value: 'probe-cold', label: 'PROBE 차가움' },
        ],
      },
      probeSize: {
        kind: 'int',
        label: 'PROBE 크기',
        readOnly: false,
        nullable: false,
        listed: true,
      },
      probeMadeAt: {
        kind: 'datetime',
        label: 'PROBE 시각',
        readOnly: true,
        nullable: false,
        listed: true,
      },
      probeFrom: {
        kind: 'int',
        label: 'PROBE 하한만',
        readOnly: false,
        nullable: false,
        listed: true,
      },
      probeUntil: {
        kind: 'int',
        label: 'PROBE 상한만',
        readOnly: false,
        nullable: false,
        listed: true,
      },
      probeExact: {
        kind: 'string',
        label: 'PROBE 정확',
        readOnly: false,
        nullable: false,
        listed: true,
      },
      // 허용 연산자가 `in` 뿐인데 값 목록이 없다 - 컨트롤을 만들 수 없다.
      probeMute: {
        kind: 'string',
        label: 'PROBE 벙어리',
        readOnly: false,
        nullable: false,
        listed: true,
      },
      // filters 에 아예 없다 - 속성이라고 컨트롤이 생기지 않는다.
      probeOff: {
        kind: 'string',
        label: 'PROBE 무필터',
        readOnly: false,
        nullable: false,
        listed: true,
      },
    },
    relationships: {
      probeOwner: { cardinality: 'one', type: 'probeOwners', label: 'PROBE 주인' },
    },
    // 조회 정책에는 있는데 속성이 아닌 이름(R-5 의 모양).
    queryOnlyFields: ['probeGhost'],
    filters: {
      probeName: ['contains', 'exact'],
      probeState: ['exact', 'in'],
      probeGrade: ['exact'],
      probeTone: ['contains'],
      probeSize: ['exact', 'gt', 'gte', 'lt', 'lte', 'in'],
      probeMadeAt: ['gte', 'lte'],
      probeFrom: ['gte'],
      probeUntil: ['lt'],
      probeExact: ['exact'],
      probeMute: ['in'],
      // 속성이 아니라 관계에서 나온 필터 키다(QueryField).
      'probeOwner.id': ['exact', 'in', 'isNull'],
      probeGhost: ['isNull'],
    },
    type: 'probeSieves',
    path: '/probe/api/sieves',
    sorts: ['probeName'],
    defaultSort: 'probeName',
    includes: ['probeOwner'],
    writable: true,
  })
}

function sieveFields(searchParams: Record<string, string | string[] | undefined> = {}) {
  return filterFields(probeSieve(), searchParams)
}

/** id 로 컨트롤 하나. 없으면 던진다 - 단언이 조용히 통과하지 않도록. */
function fieldById(
  id: string,
  searchParams: Record<string, string | string[] | undefined> = {},
): FilterField {
  const field = sieveFields(searchParams).find((candidate) => candidate.id === id)
  if (field === undefined) throw new Error(`컨트롤 ${id} 이 없다`)
  return field
}

/** (template-typescript-expo) 원본은 FormData 를 만들었다 - 이 앱의 폼 값은 상태 객체다(스펙 6.2). */
function probeForm(entries: Record<string, string | readonly string[]>): FilterFormValues {
  return Object.fromEntries(
    Object.entries(entries).map(([name, value]) => [
      name,
      typeof value === 'string' ? [value] : value,
    ]),
  )
}

describe('filterFields — 선언이 컨트롤을 정한다', () => {
  it('필터 키 순서대로, 조합마다 정해진 컨트롤을 만든다', () => {
    // 목록 **전체**를 고정한다. 하나씩만 재면 컨트롤이 하나 더 생기거나
    // 사라져도(예: 사다리 순서가 뒤집혀 범위가 텍스트가 되어도) 안 죽는다.
    expect(sieveFields().map((field) => [field.id, field.kind, field.label])).toEqual([
      ['filter[probeName][contains]', 'text', 'PROBE 이름'],
      ['filter[probeState][in]', 'select', 'PROBE 상태'],
      ['filter[probeGrade]', 'select', 'PROBE 등급'],
      ['filter[probeTone][contains]', 'text', 'PROBE 색조'],
      ['probeSize:range', 'range', 'PROBE 크기'],
      ['probeMadeAt:range', 'range', 'PROBE 시각'],
      ['probeFrom:range', 'range', 'PROBE 하한만'],
      ['probeUntil:range', 'range', 'PROBE 상한만'],
      ['filter[probeExact]', 'text', 'PROBE 정확'],
      ['filter[probeOwner.id][isNull]', 'select', 'PROBE 주인 유무'],
      ['filter[probeGhost][isNull]', 'select', 'probeGhost 유무'],
    ])
  })

  it('id 가 서로 겹치지 않는다', () => {
    // 한 필터 키가 컨트롤을 둘 만들 수 있어서(값 + isNull) 겹칠 수 있다.
    const ids = sieveFields().map((field) => field.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('enum + in 은 다중 선택이고 보기가 선언의 값들이다', () => {
    const field = fieldById('filter[probeState][in]')
    if (field.kind !== 'select') throw new Error('선택이어야 한다')
    expect(field.multiple).toBe(true)
    expect(field.operator).toBe('in')
    expect(field.options).toEqual([
      { value: 'probe-open', label: 'PROBE 열림' },
      { value: 'probe-shut', label: 'PROBE 닫힘' },
      { value: 'probe-gone', label: 'PROBE 사라짐' },
    ])
  })

  it('enum + exact 만이면 단일 선택이고 맨 앞에 "전체" 가 붙는다', () => {
    // "전체" 의 값이 빈 문자열이라 고르면 파라미터가 사라진다. 다중 선택에는
    // 그 보기가 없다 - 거기서는 전부 해제가 곧 "전체" 다.
    const field = fieldById('filter[probeGrade]')
    if (field.kind !== 'select') throw new Error('선택이어야 한다')
    expect(field.multiple).toBe(false)
    expect(field.options).toEqual([
      { value: '', label: '전체' },
      { value: 'probe-hi', label: 'PROBE 높음' },
      { value: 'probe-lo', label: 'PROBE 낮음' },
    ])
  })

  it('enum 이어도 값 목록을 쓸 연산자가 없으면 사다리 아래로 내려간다', () => {
    // enum 이라는 사실만으로 컨트롤을 없애면 그 필터를 쓸 길이 사라진다.
    const field = fieldById('filter[probeTone][contains]')
    expect(field.kind).toBe('text')
  })

  it('비교 연산자가 있으면 범위다 - exact·in 이 함께 있어도', () => {
    // probeSize 에는 exact·in 도 있다. 사다리 순서가 뒤집히면 여기서 죽는다.
    const field = fieldById('probeSize:range')
    if (field.kind !== 'range') throw new Error('범위여야 한다')
    expect(field.shape).toBe('number')
    expect(field.lower?.operator).toBe('gte')
    expect(field.upper?.operator).toBe('lte')
    expect(field.lower?.parameter).toBe('filter[probeSize][gte]')
    expect(field.upper?.parameter).toBe('filter[probeSize][lte]')
  })

  it('datetime 범위는 날짜 입력이다', () => {
    const field = fieldById('probeMadeAt:range')
    if (field.kind !== 'range') throw new Error('범위여야 한다')
    expect(field.shape).toBe('date')
  })

  it('허용된 쪽만 그린다 - 하한만 · 상한만', () => {
    const lowerOnly = fieldById('probeFrom:range')
    const upperOnly = fieldById('probeUntil:range')
    if (lowerOnly.kind !== 'range' || upperOnly.kind !== 'range') throw new Error('범위여야 한다')
    expect(lowerOnly.upper).toBeNull()
    expect(upperOnly.lower).toBeNull()
    // 포함하는 연산자가 없으면 배타 연산자를 쓴다.
    expect(upperOnly.upper?.operator).toBe('lt')
  })

  it('contains 가 exact 보다 앞선다', () => {
    // probeName 에는 둘 다 있다. exact 를 골랐다면 id 가 `filter[probeName]` 이다.
    const field = fieldById('filter[probeName][contains]')
    expect(field.kind).toBe('text')
    expect(sieveFields().some((candidate) => candidate.id === 'filter[probeName]')).toBe(false)
  })

  it('exact 뿐이면 연산자 세그먼트 없는 이름을 쓴다', () => {
    // `filter[f]` 와 `filter[f][exact]` 는 백엔드가 같게 읽는다(R-6). 이름
    // 규칙의 정본은 lib/jsonapi/query.ts 의 filterParameter 다.
    const field = fieldById('filter[probeExact]')
    if (field.kind !== 'text') throw new Error('텍스트여야 한다')
    expect(field.parameter).toBe(filterParameter('probeExact', 'exact'))
    expect(field.parameter).not.toContain('exact]')
  })

  it('속성 선언이 없는 필터 키에는 값 컨트롤을 만들지 않는다', () => {
    // `probeOwner.id` 는 관계에서 온 이름이라 kind 를 알 수 없다.
    const ids = sieveFields().map((field) => field.id)
    expect(ids).not.toContain('filter[probeOwner.id]')
    expect(ids).not.toContain('filter[probeOwner.id][in]')
    expect(ids).toContain('filter[probeOwner.id][isNull]')
  })

  it('isNull 컨트롤은 보기 셋을 갖고 라벨이 값 컨트롤과 다르다', () => {
    const field = fieldById('filter[probeOwner.id][isNull]')
    if (field.kind !== 'select') throw new Error('선택이어야 한다')
    expect(field.multiple).toBe(false)
    expect(field.options).toEqual([
      { value: '', label: '전체' },
      { value: 'true', label: '값 없음' },
      { value: 'false', label: '값 있음' },
    ])
  })

  it('관계에서 온 필터 키의 라벨은 그 관계의 라벨이다', () => {
    // 날것(`probeOwner.id`)이 화면에 뜨면 안 된다 - 그 이름은 조회 정책의 것이다.
    expect(fieldById('filter[probeOwner.id][isNull]').label).toBe('PROBE 주인 유무')
  })

  it('속성도 관계도 아닌 필터 키는 이름 그대로 쓴다', () => {
    // queryOnlyFields 는 백엔드에만 근거가 있는 이름이라 붙일 라벨이 없다.
    expect(fieldById('filter[probeGhost][isNull]').label).toBe('probeGhost 유무')
  })

  it('filters 에 없는 속성은 컨트롤을 만들지 않는다', () => {
    expect(sieveFields().some((field) => field.key === 'probeOff')).toBe(false)
  })

  it('만들 수 없는 연산자 조합은 컨트롤 없이 지나간다', () => {
    // 값 목록 없는 `in`. 손으로 친 URL 은 그대로 나가므로 길이 막히지는 않는다.
    expect(sieveFields().some((field) => field.key === 'probeMute')).toBe(false)
  })
})

describe('filterFields — URL 이 컨트롤의 값을 정한다', () => {
  it('컨트롤이 자기 파라미터의 값을 읽는다', () => {
    const field = fieldById('filter[probeName][contains]', {
      'filter[probeName][contains]': 'PROBE 조각',
    })
    if (field.kind !== 'text') throw new Error('텍스트여야 한다')
    expect(field.value).toBe('PROBE 조각')
  })

  it('다중 선택은 쉼표로 묶인 값을 나눠 읽는다', () => {
    // R-6: 다중 선택의 URL 표현은 반복이 아니라 쉼표다.
    const field = fieldById('filter[probeState][in]', {
      'filter[probeState][in]': 'probe-open,probe-gone',
    })
    if (field.kind !== 'select') throw new Error('선택이어야 한다')
    expect(field.selected).toEqual(['probe-open', 'probe-gone'])
  })

  it('보기에 없는 값과 중복은 버린다', () => {
    const field = fieldById('filter[probeState][in]', {
      'filter[probeState][in]': 'probe-open,probe-nowhere,probe-open',
    })
    if (field.kind !== 'select') throw new Error('선택이어야 한다')
    expect(field.selected).toEqual(['probe-open'])
  })

  it('단일 선택도 보기 안의 값만 고른 것으로 본다', () => {
    const chosen = fieldById('filter[probeGrade]', { 'filter[probeGrade]': 'probe-lo' })
    const unknown = fieldById('filter[probeGrade]', { 'filter[probeGrade]': 'probe-nowhere' })
    if (chosen.kind !== 'select' || unknown.kind !== 'select') throw new Error('선택이어야 한다')
    expect(chosen.selected).toEqual(['probe-lo'])
    expect(unknown.selected).toEqual([])
  })

  it('숫자 범위는 URL 의 값을 그대로 쓴다', () => {
    const field = fieldById('probeSize:range', {
      'filter[probeSize][gte]': '11',
      'filter[probeSize][lte]': '97',
    })
    if (field.kind !== 'range') throw new Error('범위여야 한다')
    expect([field.lower?.value, field.upper?.value]).toEqual(['11', '97'])
  })

  it('날짜 범위는 순간을 UTC 날짜로 접는다 - 문자열을 자르지 않는다', () => {
    // R-10③: 세 백엔드의 표현이 다르고, Rails 의 +09:00 을 slice(0,10) 하면
    // 하루가 어긋난다. 아래 두 값은 **같은 순간**이다.
    const field = fieldById('probeMadeAt:range', {
      'filter[probeMadeAt][gte]': '2026-09-06T21:10:17.293192+00:00',
      'filter[probeMadeAt][lte]': '2026-09-07T06:10:17.293+09:00',
    })
    if (field.kind !== 'range') throw new Error('범위여야 한다')
    expect([field.lower?.value, field.upper?.value]).toEqual(['2026-09-06', '2026-09-06'])
    // 자르는 구현과 실제로 다른 답을 낸다.
    expect('2026-09-07T06:10:17.293+09:00'.slice(0, 10)).toBe('2026-09-07')
  })

  it('날짜로 읽을 수 없는 값은 비워 둔다', () => {
    // `<input type="date">` 가 그릴 수 없는 값이라 브라우저가 어차피 비운다.
    const field = fieldById('probeMadeAt:range', {
      'filter[probeMadeAt][gte]': 'PROBE 날짜 아님',
    })
    if (field.kind !== 'range') throw new Error('범위여야 한다')
    expect(field.lower?.value).toBe('')
  })

  it('URL 이 비면 모든 컨트롤이 빈 값이다', () => {
    for (const field of sieveFields()) {
      if (field.kind === 'select') expect(field.selected).toEqual([])
      else if (field.kind === 'text') expect(field.value).toBe('')
      else expect([field.lower?.value ?? '', field.upper?.value ?? '']).toEqual(['', ''])
    }
  })
})

describe('filterFieldsKey — 입력을 다시 만들게 하는 열쇠', () => {
  it('값이 다르면 열쇠가 다르다', () => {
    // 이 열쇠가 굳으면 뒤로 가기를 해도 칸에 지운 조건이 남는다.
    expect(filterFieldsKey(sieveFields({ 'filter[probeName][contains]': 'PROBE 하나' }))).not.toBe(
      filterFieldsKey(sieveFields({ 'filter[probeName][contains]': 'PROBE 둘' })),
    )
    expect(filterFieldsKey(sieveFields({ 'filter[probeState][in]': 'probe-open' }))).not.toBe(
      filterFieldsKey(sieveFields()),
    )
    expect(filterFieldsKey(sieveFields({ 'filter[probeSize][lte]': '97' }))).not.toBe(
      filterFieldsKey(sieveFields()),
    )
  })

  it('값이 같으면 열쇠도 같다', () => {
    expect(filterFieldsKey(sieveFields())).toBe(filterFieldsKey(sieveFields()))
  })

  it('컨트롤이 달라지면 값이 같아도 열쇠가 다르다', () => {
    expect(filterFieldsKey(sieveFields())).not.toBe(
      filterFieldsKey(filterFields(probeLeaflet(), {})),
    )
  })
})

describe('filterQuery — 컨트롤 값에서 다음 URL 로', () => {
  it('채운 컨트롤만 파라미터가 된다', () => {
    const query = filterQuery(
      sieveFields(),
      {},
      probeForm({
        'filter[probeName][contains]': 'PROBE 조각',
        'filter[probeState][in]': ['probe-open', 'probe-gone'],
        'filter[probeSize][gte]': '11',
        'filter[probeGrade]': '',
        'filter[probeExact]': '',
      }),
    )
    expect([...query.entries()]).toEqual([
      ['filter[probeName][contains]', 'PROBE 조각'],
      // 반복이 아니라 쉼표 하나다 - 반복하면 400 이다(R-6).
      ['filter[probeState][in]', 'probe-open,probe-gone'],
      ['filter[probeSize][gte]', '11'],
    ])
  })

  it('아무것도 채우지 않으면 빈 쿼리다', () => {
    expect([...filterQuery(sieveFields(), {}, probeForm({})).entries()]).toEqual([])
  })

  it('다중 선택을 전부 해제해도 던지지 않는다', () => {
    // **빈 배열을 buildQuery 에 주면 Error 다**(R-11③). 해제 = 파라미터 제거라야
    // 이 자리를 밟지 않는다. URL 에 값이 있던 상태에서 해제하는 것이 실제 경로다.
    const fields = sieveFields({ 'filter[probeState][in]': 'probe-open,probe-gone' })
    const query = filterQuery(
      fields,
      { 'filter[probeState][in]': 'probe-open,probe-gone' },
      probeForm({}),
    )
    expect([...query.entries()]).toEqual([])
  })

  it('빈 값과 공백만인 값은 파라미터를 만들지 않는다', () => {
    // 빈 값을 실어 보내면 백엔드가 400 이다(2026-09-07 정본 실측):
    // filter[title]= · filter[title][contains]= · filter[score][gte]= 전부.
    const query = filterQuery(
      sieveFields(),
      {},
      probeForm({
        'filter[probeName][contains]': '   ',
        'filter[probeSize][gte]': '',
        'filter[probeMadeAt][lte]': ' ',
      }),
    )
    expect([...query.entries()]).toEqual([])
  })

  it('값의 앞뒤 공백을 떼고 보낸다', () => {
    const query = filterQuery(
      sieveFields(),
      {},
      probeForm({ 'filter[probeName][contains]': '  PROBE 조각  ' }),
    )
    expect(query.get('filter[probeName][contains]')).toBe('PROBE 조각')
  })

  it('날짜는 그 날의 경계 순간이 된다 - offset 을 반드시 붙인다', () => {
    // 날짜 입력 값(`2026-09-01`)을 그대로 보내면 400 이고, offset 없는
    // `...T00:00:00` 도 400 이다(R-6, 2026-09-07 정본으로 재확인).
    const query = filterQuery(
      sieveFields(),
      {},
      probeForm({
        'filter[probeMadeAt][gte]': '2026-09-01',
        'filter[probeMadeAt][lte]': '2026-09-30',
      }),
    )
    expect([...query.entries()]).toEqual([
      ['filter[probeMadeAt][gte]', '2026-09-01T00:00:00+00:00'],
      // 상한을 그 날의 시작으로 두면 고른 날이 통째로 빠진다.
      ['filter[probeMadeAt][lte]', '2026-09-30T23:59:59.999999+00:00'],
    ])
  })

  it('숫자 범위는 값을 손대지 않는다', () => {
    const query = filterQuery(
      sieveFields(),
      {},
      probeForm({ 'filter[probeSize][gte]': '11', 'filter[probeSize][lte]': '97' }),
    )
    expect([...query.entries()]).toEqual([
      ['filter[probeSize][gte]', '11'],
      ['filter[probeSize][lte]', '97'],
    ])
  })

  it('날짜 모양이 아닌 값은 그대로 보낸다 - 판정은 백엔드가 한다', () => {
    const query = filterQuery(
      sieveFields(),
      {},
      probeForm({ 'filter[probeMadeAt][gte]': 'PROBE 날짜 아님' }),
    )
    expect(query.get('filter[probeMadeAt][gte]')).toBe('PROBE 날짜 아님')
  })

  it('같은 필드+같은 연산자를 두 번 내지 않는다', () => {
    // **그것이 400 이다**(R-6). URL 에 있던 옛 값을 남겨 두고 더하면 두 번이 된다.
    const fields = sieveFields({ 'filter[probeState][in]': 'probe-open' })
    const query = filterQuery(
      fields,
      { 'filter[probeState][in]': 'probe-open' },
      probeForm({ 'filter[probeState][in]': 'probe-gone' }),
    )
    expect(query.getAll('filter[probeState][in]')).toEqual(['probe-gone'])
  })

  it('컨트롤을 비우면 URL 에 있던 그 파라미터가 사라진다', () => {
    const query = filterQuery(
      sieveFields({ 'filter[probeName][contains]': 'PROBE 옛것' }),
      { 'filter[probeName][contains]': 'PROBE 옛것' },
      probeForm({ 'filter[probeName][contains]': '' }),
    )
    expect(query.has('filter[probeName][contains]')).toBe(false)
  })

  it('바가 소유하지 않은 파라미터는 그대로 옮긴다 (스펙 8.1)', () => {
    // 정책 밖 필터도 막지 않는다 - 백엔드가 INVALID_FILTER 로 거절하고 그
    // 문구를 화면이 띄운다. 프론트가 걸러내면 계약의 반응을 볼 수 없다.
    const query = filterQuery(
      sieveFields(),
      {
        sort: '-probeName',
        'filter[probeNowhere]': 'PROBE 정책 밖',
        'filter[probeMute][in]': 'PROBE 컨트롤 없음',
        utm_source: 'probe-campaign',
      },
      probeForm({ 'filter[probeName][contains]': 'PROBE 조각' }),
    )
    expect([...query.entries()]).toEqual([
      ['filter[probeName][contains]', 'PROBE 조각'],
      ['sort', '-probeName'],
      ['filter[probeNowhere]', 'PROBE 정책 밖'],
      ['filter[probeMute][in]', 'PROBE 컨트롤 없음'],
      ['utm_source', 'probe-campaign'],
    ])
  })

  it('exact 의 별칭이 소유를 빠져나가지 않는다', () => {
    // 백엔드는 `filter[f]` 와 `filter[f][exact]` 를 **같은 필터**로 읽고(R-6),
    // 중복을 세는 단위가 (필드, 연산자)라 둘이 함께 나가면 400 이다. 소유를
    // 이름으로만 판정하면 손으로 친 별칭이 통과해서, 적용을 누를 때마다 같은
    // 400 이 반복된다 - 빠져나오는 길이 "필터 지우기" 뿐이다.
    const params = { 'filter[probeExact][exact]': 'PROBE 손으로' }
    const query = filterQuery(
      sieveFields(params),
      params,
      probeForm({ 'filter[probeExact]': 'PROBE 바가' }),
    )
    expect([...query.entries()]).toEqual([['filter[probeExact]', 'PROBE 바가']])
  })

  it('연산자가 실제로 다르면 손으로 친 것이 그대로 지나간다', () => {
    // 바는 `contains` 를 소유하지 컨트롤이 없는 `exact` 를 소유하지 않는다.
    // 같은 필드에 서로 다른 연산자 둘은 AND 로 허용된다(R-6) - 400 이 아니다.
    const params = { 'filter[probeName][exact]': 'PROBE 손으로' }
    const query = filterQuery(
      sieveFields(params),
      params,
      probeForm({ 'filter[probeName][contains]': 'PROBE 바가' }),
    )
    expect([...query.entries()]).toEqual([
      ['filter[probeName][contains]', 'PROBE 바가'],
      ['filter[probeName][exact]', 'PROBE 손으로'],
    ])
  })

  it('같은 이름이 여럿인 남의 파라미터도 전부 옮긴다', () => {
    const query = filterQuery(sieveFields(), { sort: ['probeName', '-probeName'] }, probeForm({}))
    expect(query.getAll('sort')).toEqual(['probeName', '-probeName'])
  })

  it('값이 undefined 인 파라미터는 떨어뜨린다', () => {
    expect([...filterQuery(sieveFields(), { sort: undefined }, probeForm({})).entries()]).toEqual(
      [],
    )
  })

  it('페이지 위치를 버리고 크기와 정렬은 남긴다', () => {
    // 조건이 바뀌면 옛 위치는 뜻을 잃는다. page[number]=5 가 남으면 다섯째
    // 쪽이 없는 결과에서 빈 목록이 나와 "자료가 없다" 로 오해한다.
    const query = filterQuery(
      sieveFields(),
      {
        'page[number]': '5',
        'page[after]': 'probe-cursor-after',
        'page[before]': 'probe-cursor-before',
        'page[size]': '7',
        'page[totals]': 'true',
        sort: '-probeName',
      },
      probeForm({ 'filter[probeName][contains]': 'PROBE 조각' }),
    )
    expect([...query.entries()]).toEqual([
      ['filter[probeName][contains]', 'PROBE 조각'],
      ['page[size]', '7'],
      ['page[totals]', 'true'],
      ['sort', '-probeName'],
    ])
  })

  it('isNull 삼상태가 URL 에서 세 갈래로 갈린다', () => {
    // **리뷰 라운드 1 의 Blocker.** 폼은 문자열을 준다. `'false'` 를 그대로
    // FilterInput 에 넣으면 serializeFilterValue 의 truthy 검사가 그것을 `true`
    // 로 뒤집는다 - "값 있음" 을 고른 사람이 값이 **없는** 행을 보게 되고,
    // 문법상 유효한 값이라 **200 이라 배너도 뜨지 않는다.**
    const fields = sieveFields()
    const submit = (chosen: string | null) => [
      ...filterQuery(
        fields,
        {},
        chosen === null ? probeForm({}) : probeForm({ 'filter[probeOwner.id][isNull]': chosen }),
      ).entries(),
    ]

    expect(submit(null)).toEqual([])
    expect(submit('true')).toEqual([['filter[probeOwner.id][isNull]', 'true']])
    expect(submit('false')).toEqual([['filter[probeOwner.id][isNull]', 'false']])
  })

  it('범위 컨트롤의 한쪽을 비우면 URL 에 있던 그 끝이 사라진다', () => {
    // 텍스트 컨트롤 판은 위에 있는데 범위 판이 없었다(리뷰 라운드 1 의 Major).
    // 범위는 갈래가 하나 더 있어서(bound === null, 두 끝) 텍스트 판이 대신
    // 지켜 주지 못한다 - 소유 표시를 빈 값 검사 **뒤로** 옮기면 지운 상한이
    // 통과 루프로 되살아나고, 화면의 칸은 비었는데 결과는 여전히 걸려 있다.
    const params = { 'filter[probeSize][gte]': '11', 'filter[probeSize][lte]': '97' }
    const query = filterQuery(
      sieveFields(params),
      params,
      probeForm({ 'filter[probeSize][gte]': '11' }),
    )
    expect([...query.entries()]).toEqual([['filter[probeSize][gte]', '11']])
  })

  it('범위 컨트롤을 양쪽 다 비우면 두 끝이 모두 사라진다', () => {
    const params = { 'filter[probeSize][gte]': '11', 'filter[probeSize][lte]': '97' }
    expect([...filterQuery(sieveFields(params), params, probeForm({})).entries()]).toEqual([])
  })

  it('필터를 하나도 걸지 않아도 페이지 위치는 버린다', () => {
    // "적용" 은 조건이 그대로여도 "이 조건으로 처음부터 보여 달라" 는 뜻이다.
    const query = filterQuery(sieveFields(), { 'page[number]': '5' }, probeForm({}))
    expect([...query.entries()]).toEqual([])
  })
})

/* ------------------------------------------------------------------------- *
 * 정렬 메뉴와 페이지 이동 (D3 Task 5)
 * ------------------------------------------------------------------------- */

/** 이 화면의 주소. 실제 화면 경로(`/examples`)와 겹치지 않는 값을 쓴다. */
const DIAL_PATH = '/probe/dials'

/**
 * 정렬을 재는 자원.
 *
 * 정렬 키를 **네 갈래로** 고른 것이 핵심이다 - 첫 클릭 방향이 `kind` 로
 * 갈리는지 보려면 갈래마다 하나씩 필요하다:
 *
 * - `probeName`(string) · `probeState`(enum) → 오름차순으로 시작
 * - `probeCount`(int) · `probeMadeAt`(datetime) → 내림차순으로 시작
 * - `probeHidden`(속성 없음, `queryOnlyFields`) → 오름차순
 * - `probeOwner.id`(관계에서 온 이름) → 라벨이 관계의 것이어야 한다
 *
 * `defaultSort` 는 **`-probeMadeAt`** 이다. 실제 선언의 `-createdAt` 과 겹치지
 * 않고, 첫 클릭 방향(내림차순)과도 우연히 같아서 그것만으로는 두 규칙이
 * 구별되지 않으므로 아래 테스트가 `probeName` 으로도 잰다.
 */
function probeDial() {
  return defineResource({
    type: 'probeDials',
    path: '/probe/api/dials',
    attributes: {
      probeName: {
        kind: 'string',
        label: 'PROBE 이름',
        readOnly: false,
        nullable: false,
        listed: true,
      },
      probeState: {
        kind: 'enum',
        label: 'PROBE 상태',
        readOnly: false,
        nullable: false,
        listed: true,
        values: [
          { value: 'probe-open', label: 'PROBE 열림' },
          { value: 'probe-shut', label: 'PROBE 닫힘' },
        ],
      },
      probeCount: {
        kind: 'int',
        label: 'PROBE 수',
        readOnly: false,
        nullable: false,
        listed: true,
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
      probeOwner: { cardinality: 'one', type: EXAMPLE_CATEGORY.type, label: 'PROBE 주인' },
    },
    queryOnlyFields: ['probeHidden'],
    filters: { probeName: ['contains'] },
    sorts: ['probeName', 'probeState', 'probeCount', 'probeMadeAt', 'probeHidden', 'probeOwner.id'],
    defaultSort: '-probeMadeAt',
    includes: ['probeOwner'],
    writable: true,
  })
}

/** 이름으로 정렬 항목 하나를 꺼낸다. 없으면 던진다 - 잘못된 키는 오타다. */
function optionFor(options: readonly SortOption[], key: string): SortOption {
  const found = options.find((option) => option.key === key)
  if (found === undefined) throw new Error(`정렬 항목 ${key} 이 있어야 한다`)
  return found
}

describe('currentSortToken — 지금 걸린 정렬', () => {
  it('URL 의 sort 를 그대로 쓴다', () => {
    expect(currentSortToken(probeDial(), { sort: 'probeCount' })).toBe('probeCount')
  })

  it('sort 가 없으면 선언의 defaultSort 다', () => {
    // URL 에 없어도 목록은 정렬돼 있다(백엔드의 기본 정렬). 여기서 빈 값을
    // 내면 메뉴가 아무것도 활성으로 표시하지 않아 화면에 대해 거짓을 말한다.
    expect(currentSortToken(probeDial(), {})).toBe('-probeMadeAt')
  })

  it('빈 sort 도 defaultSort 로 물러선다', () => {
    // `?sort=` 는 **400 이다**(2026-09-07 정본 실측). 그 URL 에서는 배너가 뜨고
    // 메뉴가 빠져나갈 유일한 수단이라, 모든 항목이 정상적인 토큰을 가져야 한다.
    expect(currentSortToken(probeDial(), { sort: '' })).toBe('-probeMadeAt')
  })

  it('값이 여럿이면 첫 번째다', () => {
    // `?sort=a&sort=b` 는 어차피 400 이지만(R-4) 여기서 던지지는 않는다.
    expect(currentSortToken(probeDial(), { sort: ['probeCount', 'probeName'] })).toBe('probeCount')
  })
})

describe('sortOptions — 선언이 항목을 정한다', () => {
  it('선언의 sorts 를 순서 그대로 낸다', () => {
    expect(sortOptions(probeDial(), DIAL_PATH, {}).map((option) => option.key)).toEqual(
      probeDial().sorts,
    )
  })

  it('이름은 속성·관계의 라벨이고, 없으면 키 그대로다', () => {
    // 필터 바와 같은 말을 써야 한다 - 같은 필드가 한쪽에서는 "PROBE 수",
    // 다른 쪽에서는 "probeCount" 로 보이면 사용자는 둘을 같은 것으로 읽지
    // 못한다. 관계에서 온 이름을 키 그대로 두면 `probeOwner.id` 라는 날것이
    // 뜬다 - 그것은 사용자가 아니라 백엔드 조회 정책의 이름이다.
    const options = sortOptions(probeDial(), DIAL_PATH, {})
    expect(optionFor(options, 'probeCount').label).toBe('PROBE 수')
    expect(optionFor(options, 'probeOwner.id').label).toBe('PROBE 주인')
    expect(optionFor(options, 'probeHidden').label).toBe('probeHidden')
  })

  it('지금 걸린 키 하나만 방향을 갖는다', () => {
    const options = sortOptions(probeDial(), DIAL_PATH, { sort: '-probeCount' })
    expect(optionFor(options, 'probeCount').direction).toBe('desc')
    expect(options.filter((option) => option.direction !== null)).toHaveLength(1)
  })

  it('오름차순도 방향으로 표시된다', () => {
    expect(
      optionFor(sortOptions(probeDial(), DIAL_PATH, { sort: 'probeCount' }), 'probeCount')
        .direction,
    ).toBe('asc')
  })

  it('sort 가 없으면 defaultSort 의 키가 활성이다', () => {
    // 백엔드가 자기 기본 정렬로 정렬해 준 결과를 보고 있으므로, 아무것도
    // 활성이 아니면 메뉴가 거짓을 말한다.
    const options = sortOptions(probeDial(), DIAL_PATH, {})
    expect(optionFor(options, 'probeMadeAt').direction).toBe('desc')
    expect(options.filter((option) => option.direction !== null)).toHaveLength(1)
  })

  it('활성 항목을 누르면 방향이 뒤집힌다', () => {
    const options = sortOptions(probeDial(), DIAL_PATH, { sort: '-probeCount' })
    expect(optionFor(options, 'probeCount').href).toBe(`${DIAL_PATH}?sort=probeCount`)
  })

  it('오름차순으로 활성인 항목을 누르면 내림차순이 된다', () => {
    const options = sortOptions(probeDial(), DIAL_PATH, { sort: 'probeCount' })
    expect(optionFor(options, 'probeCount').href).toBe(`${DIAL_PATH}?sort=-probeCount`)
  })

  it('시각과 수는 내림차순으로 시작하고, 글자와 enum 은 오름차순으로 시작한다', () => {
    // "최근 것부터" · "점수 높은 것부터" 가 첫 클릭의 기대값이고, 이름은
    // 사전순이다. 분기의 근거는 `kind` 라 자원 이름이 아니라 구조다.
    const options = sortOptions(probeDial(), DIAL_PATH, { sort: 'probeName' })
    expect(optionFor(options, 'probeMadeAt').href).toBe(`${DIAL_PATH}?sort=-probeMadeAt`)
    expect(optionFor(options, 'probeCount').href).toBe(`${DIAL_PATH}?sort=-probeCount`)
    expect(optionFor(options, 'probeState').href).toBe(`${DIAL_PATH}?sort=probeState`)
  })

  it('속성 선언이 없는 정렬 키는 오름차순으로 시작한다', () => {
    // `queryOnlyFields` 는 무엇인지 알 수 없다(값을 받지도 않는다, R-5).
    expect(optionFor(sortOptions(probeDial(), DIAL_PATH, {}), 'probeHidden').href).toBe(
      `${DIAL_PATH}?sort=probeHidden`,
    )
  })

  it('sort 를 두 번 내지 않는다 - 옛 값을 버리고 다시 쓴다', () => {
    // **`sort` 를 두 번 내면 400 이다**(R-4, 2026-09-07 재확인). 남겨 두고
    // 더하는 구현은 정렬을 바꾸는 족족 오류를 낸다.
    const href = optionFor(
      sortOptions(probeDial(), DIAL_PATH, { sort: ['probeName', '-probeCount'] }),
      'probeState',
    ).href
    expect(new URLSearchParams(href.split('?')[1]).getAll('sort')).toEqual(['probeState'])
  })

  it('정렬을 바꾸면 커서와 쪽 번호를 버리고 크기·필터·남의 것은 남긴다', () => {
    // **커서 안에 정렬 서명이 들어 있어 정렬이 바뀐 커서는 400 이다**(R-7).
    // 이 한 줄이 없으면 정렬을 누르는 순간 목록이 통째로 오류가 된다.
    const href = optionFor(
      sortOptions(probeDial(), DIAL_PATH, {
        'filter[probeName][contains]': 'PROBE 조각',
        'page[number]': '5',
        'page[after]': 'probe-cursor-after',
        'page[before]': 'probe-cursor-before',
        'page[size]': '7',
        'page[totals]': 'true',
        probeStray: 'probe-stray',
        sort: 'probeName',
      }),
      'probeCount',
    ).href
    expect([...new URLSearchParams(href.split('?')[1] ?? '').entries()]).toEqual([
      ['filter[probeName][contains]', 'PROBE 조각'],
      ['page[size]', '7'],
      ['page[totals]', 'true'],
      ['probeStray', 'probe-stray'],
      // 활성이 아니던 int 키라 첫 클릭이 내림차순이다(`firstClickDescending`).
      ['sort', '-probeCount'],
    ])
  })

  it('여러 항으로 된 정렬은 첫 항이 활성이고, 누르면 나머지는 사라진다', () => {
    // `?sort=-probeCount,probeName` 은 유효하다(200, 실측). 목록이 실제로 수
    // 내림차순으로 보이므로 그 항목을 활성으로 표시하는 것은 거짓이 아니다.
    const options = sortOptions(probeDial(), DIAL_PATH, { sort: '-probeCount,probeName' })
    expect(optionFor(options, 'probeCount').direction).toBe('desc')
    expect(optionFor(options, 'probeName').direction).toBe(null)
    expect(optionFor(options, 'probeName').href).toBe(`${DIAL_PATH}?sort=probeName`)
  })

  it('주소가 인자로 받은 경로에서 나온다 - 경로를 박지 않았다', () => {
    for (const option of sortOptions(probeDial(), '/probe/elsewhere', {})) {
      expect(option.href.startsWith('/probe/elsewhere?')).toBe(true)
    }
  })

  it('빈 sort 를 만들 수 있는 항목이 하나도 없다', () => {
    // **`sort=` 는 400 이다**(실측). 어떤 URL 에서 시작하든 모든 항목의 주소가
    // 값 있는 토큰을 가져야 한다 - 정렬을 "끄는" 길이 없다는 것이 그 보장이다.
    for (const params of [{}, { sort: '' }, { sort: 'probeNeverDeclared' }, { sort: '-' }]) {
      for (const option of sortOptions(probeDial(), DIAL_PATH, params)) {
        const token = new URLSearchParams(option.href.split('?')[1] ?? '').get('sort')
        expect(token).not.toBe(null)
        // 방향 접두사를 벗기면 반드시 그 항목의 키다. 빈 토큰도, 남의 키도 아니다.
        expect(parseSortToken(token ?? '')).toEqual({
          name: option.key,
          descending: expect.any(Boolean) as boolean,
        })
      }
    }
  })

  it('정책에 없는 정렬이 URL 에 있어도 항목을 그대로 낸다', () => {
    // 프론트가 미리 걸러내지 않는다(스펙 8.1) - 백엔드가 INVALID_SORT 로
    // 거절하고 화면이 그 문구를 띄운다. 메뉴는 거기서 빠져나갈 수단이다.
    const options = sortOptions(probeDial(), DIAL_PATH, { sort: 'probeNeverDeclared' })
    expect(options).toHaveLength(probeDial().sorts.length)
    expect(options.filter((option) => option.direction !== null)).toEqual([])
  })
})

describe('clearFiltersHref — 필터 지우기가 갈 곳', () => {
  it('아무 조건도 없으면 경로 그대로다 - ? 를 남기지 않는다', () => {
    expect(clearFiltersHref(DIAL_PATH, {})).toBe(DIAL_PATH)
  })

  it('**정렬을 남긴다** - 이름이 "필터 지우기" 다', () => {
    // Task 4 까지는 쿼리 없는 경로로 가서 정렬까지 함께 지웠다. 이름이 말한
    // 것보다 많이 지우는 컨트롤은 거짓말을 한다.
    expect(clearFiltersHref(DIAL_PATH, { sort: '-probeCount' })).toBe(
      `${DIAL_PATH}?sort=-probeCount`,
    )
  })

  it('filter 가족을 전부 지운다 - 바가 그릴 수 없는 것까지', () => {
    // 남기면 지우기를 눌러도 조건이 남는데, 그 필터를 없앨 컨트롤이 화면에
    // 하나도 없다(바가 그리지 못하는 필터라 이 자리에 온 것이다).
    expect(
      clearFiltersHref(DIAL_PATH, {
        'filter[probeName][contains]': 'PROBE 조각',
        'filter[probeNeverDeclared][bogus]': 'PROBE 손으로 친 것',
      }),
    ).toBe(DIAL_PATH)
  })

  it('페이지 위치는 버리고 크기·총계·남의 것은 남긴다', () => {
    // `filterQuery` 와 같은 규칙이다 - 두 길이 갈라지면 안 된다.
    const href = clearFiltersHref(DIAL_PATH, {
      'filter[probeName][contains]': 'PROBE 조각',
      'page[number]': '5',
      'page[after]': 'probe-cursor',
      'page[size]': '7',
      'page[totals]': 'true',
      probeStray: 'probe-x',
      sort: '-probeCount',
    })
    expect([...new URLSearchParams(href.split('?')[1] ?? '').entries()]).toEqual([
      ['page[size]', '7'],
      ['page[totals]', 'true'],
      ['probeStray', 'probe-x'],
      ['sort', '-probeCount'],
    ])
  })

  it('컨트롤을 다 비우고 "적용" 한 것과 같은 곳에 닿는다', () => {
    // 한 화면에 같은 뜻의 길이 둘 있는데 도착지가 다르면 그것이 결함이다.
    // (바가 그릴 수 있는 필터만 URL 에 있을 때의 이야기다 - 위 테스트가 그
    // 밖의 필터에서 둘이 갈리는 것을 따로 고정한다.)
    const params = {
      'filter[probeName][contains]': 'PROBE 조각',
      'page[number]': '5',
      'page[size]': '7',
      sort: '-probeCount',
    }
    const applied = filterQuery(sieveFields(params), params, probeForm({})).toString()
    expect(clearFiltersHref(DIAL_PATH, params)).toBe(`${DIAL_PATH}?${applied}`)
  })

  it('값이 undefined 인 파라미터는 떨어뜨린다', () => {
    expect(clearFiltersHref(DIAL_PATH, { sort: undefined })).toBe(DIAL_PATH)
  })

  it('경로를 박지 않았다', () => {
    expect(clearFiltersHref('/probe/elsewhere', {})).toBe('/probe/elsewhere')
  })
})

/* ------------------------------------------------------------------------- *
 * 상세 화면 (D3 Task 6)
 * ------------------------------------------------------------------------- */

/**
 * 단건 응답 하나. 상세가 지나는 갈래를 전부 담는다 - **목록에서 빠지는
 * 속성**(`probeNote`) · 0 인 정수 · Rails 형식 시각(`+09:00`) · `included` 로
 * 채워진 to-one · `included` 에 **없는** to-many.
 *
 * 마지막이 중요하다: `include` 를 걸어도 백엔드가 담지 않으면 식별자만 온다
 * (R-10②의 NestJS 가 실제로 그렇다). 정본 픽스처만 보면 그 갈래가 죽었는지
 * 알 수 없다.
 */
function probeSingleDocument() {
  return {
    data: {
      type: 'probeGadgets',
      id: 'probe-g1',
      attributes: {
        probeTitle: 'PROBE 첫째',
        // 목록의 열에는 없는 속성이다(`listed: false`). 상세가 이것을 그리는지가
        // "상세는 listed 를 따르지 않는다" 는 결정 그 자체다.
        probeNote: 'PROBE 윗줄\nPROBE 아랫줄',
        probeCount: 0,
        probeMadeAt: SAME_INSTANT.rails,
      },
      relationships: {
        probeOwner: { data: { type: EXAMPLE_CATEGORY.type, id: 'probe-c1' } },
        probeMarks: { data: [{ type: 'probeNeverRegistered', id: 'probe-m1' }] },
      },
    },
    included: [
      {
        type: EXAMPLE_CATEGORY.type,
        id: 'probe-c1',
        attributes: { [displayAttributeName(EXAMPLE_CATEGORY.type)]: 'PROBE 분류 이름' },
      },
    ],
  }
}

describe('detailLabels — 상세는 listed 를 따르지 않는다', () => {
  it('속성 전부와 관계 전부를 선언 순서로 낸다', () => {
    expect(detailLabels(probeGadget())).toEqual([
      { key: 'probeTitle', label: 'PROBE 제목' },
      { key: 'probeNote', label: 'PROBE 메모' },
      { key: 'probeCount', label: 'PROBE 수' },
      { key: 'probeMadeAt', label: 'PROBE 시각' },
      { key: 'probeOwner', label: 'PROBE 주인' },
      { key: 'probeMarks', label: 'PROBE 표식' },
    ])
  })

  it('목록의 열보다 많다 - listed 로 거르면 이 단언이 죽는다', () => {
    // `listed: false` 인 속성은 **상세가 그린다는 전제로** 목록에서 빠졌다
    // (`define.ts` 의 그 필드 주석). 상세까지 거르면 그 속성을 볼 수 있는
    // 화면이 이 앱에 하나도 없어진다.
    const gadget = probeGadget()
    const labelKeys = detailLabels(gadget).map((label) => label.key)
    const columnKeys = listColumns(gadget).map((column) => column.key)

    expect(labelKeys).toContain('probeNote')
    expect(columnKeys).not.toContain('probeNote')
    expect(labelKeys.length).toBeGreaterThan(columnKeys.length)
  })

  it('관계가 없는 자원은 속성만 낸다', () => {
    expect(detailLabels(probeLeaflet())).toEqual([{ key: 'probeLabel', label: 'PROBE 라벨' }])
  })
})

describe('detailFields — 자원 객체를 항목들로', () => {
  it('항목 전부를 종류와 값까지 만든다', () => {
    const document = probeSingleDocument()
    expect(detailFields(probeGadget(), document.data, document.included)).toEqual([
      { key: 'probeTitle', label: 'PROBE 제목', kind: 'string', values: ['PROBE 첫째'] },
      {
        key: 'probeNote',
        label: 'PROBE 메모',
        kind: 'text',
        values: ['PROBE 윗줄\nPROBE 아랫줄'],
      },
      // 0 이다. 빈 값 판정을 truthy 로 쓰면 여기서 값이 사라진다.
      { key: 'probeCount', label: 'PROBE 수', kind: 'int', values: ['0'] },
      // Rails 의 `+09:00` 이다. 문자열을 잘랐다면 날짜가 하루 어긋난다(R-10③).
      { key: 'probeMadeAt', label: 'PROBE 시각', kind: 'datetime', values: ['2026-09-06 21:10'] },
      {
        key: 'probeOwner',
        label: 'PROBE 주인',
        kind: 'relationship',
        values: ['PROBE 분류 이름'],
      },
      // included 에 없는 대상이라 식별자만 왔다 - id 로 물러선다.
      { key: 'probeMarks', label: 'PROBE 표식', kind: 'relationship', values: ['probe-m1'] },
    ])
  })

  it('이름표와 항목의 키·순서가 같다 - 스켈레톤과 화면이 갈라지지 않는다', () => {
    const document = probeSingleDocument()
    expect(
      detailFields(probeGadget(), document.data, document.included).map((field) => field.key),
    ).toEqual(detailLabels(probeGadget()).map((label) => label.key))
  })

  it('속성의 kind 를 선언에서 그대로 가져온다', () => {
    // 전부 `'attribute'` 로 뭉개면 상세가 `text` 를 여러 줄로 그릴 수 없다.
    const document = probeSingleDocument()
    const kinds = detailFields(probeGadget(), document.data, document.included).map(
      (field) => field.kind,
    )
    expect(kinds).toEqual(['string', 'text', 'int', 'datetime', 'relationship', 'relationship'])
  })

  it('included 가 없으면 관계를 식별자 그대로 그린다', () => {
    // **NestJS 가 실제로 이 모양이다**(R-10②) - include 를 걸어도 linkage 를
    // 주지 않으면 여기로 온다. 정본 픽스처만 보면 이 갈래가 죽었는지 모른다.
    const fields = detailFields(probeGadget(), probeSingleDocument().data, undefined)
    expect(fields.find((field) => field.key === 'probeOwner')?.values).toEqual(['probe-c1'])
  })

  it('값이 없는 속성과 빈 관계는 둘 다 빈 배열이다', () => {
    const object = {
      type: 'probeGadgets',
      id: 'probe-g2',
      attributes: { probeTitle: 'PROBE 둘째' },
      relationships: { probeOwner: { data: null }, probeMarks: { data: [] } },
    }
    const fields = detailFields(probeGadget(), object, [])
    expect(fields.find((field) => field.key === 'probeNote')?.values).toEqual([])
    expect(fields.find((field) => field.key === 'probeOwner')?.values).toEqual([])
    expect(fields.find((field) => field.key === 'probeMarks')?.values).toEqual([])
  })

  it('attributes 도 relationships 도 없는 자원에서 던지지 않는다', () => {
    const fields = detailFields(probeGadget(), { type: 'probeGadgets', id: 'probe-g3' }, undefined)
    expect(fields.map((field) => field.values)).toEqual([[], [], [], [], [], []])
  })
})

describe('detailRequest — 화면이 부르는 조립 전부', () => {
  it('경로 · 쿼리 · 옵션을 한꺼번에 만든다', () => {
    const plan = detailRequest(probeGadget(), 'probe-g1')

    expect(plan.path).toBe('/probe/api/gadgets/probe-g1')
    expect(plan.options.query?.toString()).toBe('include=probeOwner%2CprobeMarks')
    // (template-typescript-expo) 옵션은 쿼리 하나다 - Accept-Language 는 platform/api.ts 가 싣는다.
    expect(Object.keys(plan.options)).toEqual(['query'])
  })

  it('쿼리에 include 말고는 아무것도 없다 (R-8)', () => {
    // **단건 URL 은 include 말고 어떤 파라미터도 받지 않는다** - `page[size]=2`
    // 조차 400 이다. 목록처럼 URL 의 쿼리를 옮기면 상세가 통째로 배너가 된다.
    const plan = detailRequest(probeGadget(), 'probe-g1')
    expect([...(plan.options.query ?? [])].map(([name]) => name)).toEqual(['include'])
  })

  it('관계가 없는 자원에는 include 도 싣지 않는다 (R-5)', () => {
    // 참조 자원에 `?include=` 를 붙이는 것 자체가 400 이다.
    expect(detailRequest(probeLeaflet(), 'probe-l1').options.query?.toString()).toBe('')
  })

  it('경로를 선언에서 가져온다 - type 에서 유도하지 않는다 (R-1)', () => {
    expect(detailRequest(probeLeaflet(), 'probe-l1').path).toBe(`${probeLeaflet().path}/probe-l1`)
    expect(probeLeaflet().path).not.toContain(probeLeaflet().type)
  })

  it('id 를 경로 세그먼트로 이스케이프한다', () => {
    // id 는 URL 세그먼트에서 오는 사용자 입력이다. 그대로 이어 붙이면 `?` 뒤가
    // 쿼리가 되어 백엔드에 없는 파라미터를 주입한다.
    const plan = detailRequest(probeGadget(), 'probe/g1?probeInjected=1')
    expect(plan.path).toBe('/probe/api/gadgets/probe%2Fg1%3FprobeInjected%3D1')
  })

  it('accessToken 을 넣지 않는다 - 읽기는 완전 공개다 (R-9)', () => {
    const plan = detailRequest(probeGadget(), 'probe-g1')
    expect(plan.options.accessToken).toBeUndefined()
  })

  it('Accept-Language 를 싣지 않는다 - 앱의 API 클라이언트 한 곳이 싣는다(스펙 9.4)', () => {
    expect('acceptLanguage' in detailRequest(probeGadget(), 'probe-g1').options).toBe(false)
  })
})

/**
 * 백엔드가 없는 id(또는 잘못된 형식의 id)에 내는 오류.
 *
 * `code` 만은 `probe*` 로 바꿀 수 없다 - 이 문자열이 `actionForErrors` 의 분류
 * 기준 그 자체라 바꾸면 재려는 갈래를 아예 밟지 못한다. 나머지 값은 전부
 * probe 다. **`source` 가 통째로 없는 것이 실측이다**(R-8).
 */
function probeNotFoundError(patch: Partial<ErrorObject> = {}): ErrorObject {
  return { status: '404', code: 'RESOURCE_NOT_FOUND', detail: 'PROBE 없음', ...patch }
}

describe('detailView — 응답에서 화면 상태로', () => {
  const okResult = (document: SingleDocument) => ({ ok: true as const, status: 200, document })

  it('성공 응답을 상세로 만든다', () => {
    const document = probeSingleDocument()
    const view = detailView(probeGadget(), okResult(document))
    if (view.kind !== 'detail') throw new Error('상세여야 한다')
    expect(view.fields).toEqual(detailFields(probeGadget(), document.data, document.included))
  })

  it('제목을 대표 속성으로 정한다', () => {
    const view = detailView(probeGadget(), okResult(probeSingleDocument()))
    if (view.kind !== 'detail') throw new Error('상세여야 한다')
    expect(view.heading).toBe('PROBE 첫째')
  })

  it('제목을 응답의 type 이 아니라 인자의 선언으로 정한다', () => {
    // `relatedText(data)` 로 구현하면 등록부를 지나가므로, 백엔드가 type 을 다른
    // 값으로 내는 순간 **제 자원의 선언을 두고도** id 로 물러선다.
    const document = probeSingleDocument()
    const view = detailView(
      probeGadget(),
      okResult({ ...document, data: { ...document.data, type: 'probeNeverRegistered' } }),
    )
    if (view.kind !== 'detail') throw new Error('상세여야 한다')
    expect(view.heading).toBe('PROBE 첫째')
  })

  it('대표 속성이 비어 있으면 제목이 id 다', () => {
    const document = probeSingleDocument()
    const view = detailView(
      probeGadget(),
      okResult({ ...document, data: { ...document.data, attributes: {} } }),
    )
    if (view.kind !== 'detail') throw new Error('상세여야 한다')
    expect(view.heading).toBe('probe-g1')
  })

  it('404 는 notFound 다 - 화면이 not-found.tsx 로 보낸다', () => {
    expect(
      detailView(probeGadget(), { ok: false, status: 404, errors: [probeNotFoundError()] }),
    ).toEqual({ kind: 'notFound' })
  })

  it('detail·title 없는 404 도 notFound 다 - 404 화면이 자기 문구를 갖는다', () => {
    // **이 테스트는 판정 순서를 지키지 못한다**(뮤턴트 M12 로 확인했다).
    // `messageOf` 가 `detail ?? title ?? code` 라 `RESOURCE_NOT_FOUND` 라는
    // code 자체가 문구가 되고, 그래서 "문구가 없으면 던진다" 를 앞으로 옮겨도
    // 이 응답은 그 검사를 그냥 지나간다 - 404 인데 문구가 하나도 없는 오류
    // 배열은 만들 수 없다. 근거와 뒤집힐 조건은 `detailView` 주석이 갖는다.
    //
    // 여기서 실제로 재는 것은 **사람이 읽을 문구가 없는 404 도 404 화면으로
    // 간다**는 것이다 - 배너로 그리면 사용자가 `RESOURCE_NOT_FOUND` 라는
    // 날문자를 본다.
    expect(
      detailView(probeGadget(), {
        ok: false,
        status: 404,
        errors: [{ status: '404', code: 'RESOURCE_NOT_FOUND' }],
      }),
    ).toEqual({ kind: 'notFound' })
  })

  it('그 밖의 백엔드 오류는 배너다', () => {
    // 잘못된 include 가 이리로 온다(400 INVALID_INCLUDE).
    expect(detailView(probeGadget(), { ok: false, status: 400, errors: [probeError()] })).toEqual({
      kind: 'banner',
      messages: ['PROBE 조회 오류'],
    })
  })

  it('합성 오류(transport)는 unreachable 이다 - 화면이 다시 시도를 그린다', () => {
    // (template-typescript-expo) 원본은 던져서 error.tsx 로 보냈다(스펙 9.3).
    expect(
      detailView(probeGadget(), { ok: false, status: 0, errors: [probeSyntheticError()] }),
    ).toEqual({ kind: 'unreachable' })
  })

  it('404 와 transport 가 겹치면 transport 가 이긴다', () => {
    // `actionForErrors` 의 우선순위를 실제로 지나가는지 잰다 - code 문자열을
    // 직접 비교하는 구현이었다면 이 배열에서 404 로 접힌다.
    expect(
      detailView(probeGadget(), {
        ok: false,
        status: 0,
        errors: [probeNotFoundError(), probeSyntheticError()],
      }),
    ).toEqual({ kind: 'unreachable' })
  })

  it('문구가 하나도 없는 오류 문서는 던진다', () => {
    expect(() =>
      detailView(probeGadget(), { ok: false, status: 400, errors: [{ status: '400' }] }),
    ).toThrow()
  })

  it('본문 없는 성공 응답(204)은 던진다', () => {
    expect(() => detailView(probeGadget(), { ok: true, status: 204, document: null })).toThrow()
  })

  it('자원 없는 200(data: null)은 던진다', () => {
    // 단건 GET 에서 "없다" 를 말하는 방법은 404 뿐이다(R-8). notFound 로 접으면
    // 깨진 백엔드가 "없는 자원" 으로 위장한다.
    expect(() => detailView(probeGadget(), okResult({ data: null }))).toThrow()
  })
})

describe('referenceRequest — 선택기가 부를 조립(D4 Task 4)', () => {
  it('경로 · 쿼리(page[size]=100, sort=name) · 옵션을 한꺼번에 만든다', () => {
    const plan = referenceRequest(probeLeaflet())

    expect(plan.path).toBe('/probe/api/leaflets')
    expect([...plan.query.entries()]).toEqual([
      ['sort', 'name'],
      ['page[size]', '100'],
    ])
    // (template-typescript-expo) 옵션에 Accept-Language 가 없다 - platform/api.ts 가 싣는다.
    expect(plan.options).toEqual({ query: plan.query })
    // listRequest 와 같은 이유로 같은 객체인지도 잰다 - 두 벌이면 실제로 나간
    // 쿼리와 이 값이 갈릴 수 있다.
    expect(plan.options.query).toBe(plan.query)
  })

  it('대상의 기본 정렬이 달라도 sort 는 언제나 name 이다 - target.defaultSort 를 읽지 않는다', () => {
    // probeLeaflet 의 기본 정렬은 probeLabel 이다(위 선언) - 그런데도 이
    // 함수는 리터럴 'name' 을 낸다. defaultSort 를 읽는 구현이었다면 이
    // 자리에서 'probeLabel' 이 나왔을 것이다.
    expect(probeLeaflet().defaultSort).toBe('probeLabel')
    expect(referenceRequest(probeLeaflet()).query.get('sort')).toBe('name')
  })

  it('REFERENCE_PAGE_SIZE 는 100 이다 - 실측 상한을 넘기면 조용히 100 으로 깎인다(W-11)', () => {
    expect(REFERENCE_PAGE_SIZE).toBe(100)
    expect(referenceRequest(probeLeaflet()).query.get('page[size]')).toBe('100')
  })

  it('accessToken 을 넣지 않는다 - 참조 자원 읽기는 완전 공개다(W-11)', () => {
    expect(referenceRequest(probeLeaflet()).options.accessToken).toBeUndefined()
  })

  it('Accept-Language 를 싣지 않는다 - 앱의 API 클라이언트 한 곳이 싣는다(스펙 9.4)', () => {
    expect('acceptLanguage' in referenceRequest(probeLeaflet()).options).toBe(false)
  })
})

describe('referenceList — 참조 목록 응답에서 선택기 보기로(D4 Task 4)', () => {
  /** `probeLeaflet` 의 모양(참조 자원, R-5) 응답. `links` 를 주지 않으면 키 자체가 없다. */
  function probeCollection(links?: Record<string, string | null>) {
    return {
      data: [
        { type: 'probeLeaflets', id: 'probe-l1', attributes: { probeLabel: 'PROBE 라벨 하나' } },
        { type: 'probeLeaflets', id: 'probe-l2', attributes: { probeLabel: 'PROBE 라벨 둘' } },
      ],
      ...(links === undefined ? {} : { links }),
    }
  }

  it('옵션은 id 와 displayAttribute 라벨로, 응답 순서 그대로 만든다', () => {
    // 속성 키가 'probeLabel' 이지 'name' 이 아니다 - 이름을 박은 구현이었다면
    // 라벨이 전부 빈 문자열(→ id 로 물러섬, displayText 참고)이 됐을 것이다.
    expect(referenceList(probeLeaflet(), probeCollection()).options).toEqual([
      { id: 'probe-l1', label: 'PROBE 라벨 하나' },
      { id: 'probe-l2', label: 'PROBE 라벨 둘' },
    ])
  })

  it('links.next 가 null 이면 잘리지 않았다 (정본 모양)', () => {
    const list = referenceList(
      probeLeaflet(),
      probeCollection({ self: '...', first: '...', prev: null, next: null, last: null }),
    )
    expect(list.truncated).toBe(false)
  })

  it('links 에 next 키가 아예 없어도 잘리지 않았다 (NestJS 모양) — 이 태스크의 핵심 가드', () => {
    // **이 픽스처가 R-10① 가드가 존재하는 이유다.** 정본은 언제나 다섯 키를
    // 다 보내므로 `!=` 와 `!==` 가 완전히 같게 동작한다 - 정본 픽스처만 쓰면
    // 이 가드는 속이 빈다. NestJS 는 없는 항목을 키째 지운다: `undefined
    // !== null` 이 참이라, 엄격 비교로 판정하면 언제나 "잘렸다" 가 된다.
    // (template-typescript-expo) 원본은 여기서 쪽 이동(`pageHref`)의 NestJS 픽스처를 가리켰다 -
    // 쪽 이동을 뺀 이 앱에서는 `nextPageQuery` 의 NestJS 모양 시험(view-expo.test.ts)이 같은
    // 판정(`linkPresent` 하나)을 잰다.
    const list = referenceList(probeLeaflet(), probeCollection({ self: '...', first: '...' }))
    expect(list.truncated).toBe(false)
  })

  it('links.next 가 있으면 잘렸다', () => {
    const list = referenceList(
      probeLeaflet(),
      probeCollection({ self: '...', next: '/probe/api/leaflets?page[number]=2' }),
    )
    expect(list.truncated).toBe(true)
  })

  it('컬렉션 문서가 아니면(오류 문서) 던지지 않고 빈 목록으로 물러선다', () => {
    // 참조 목록 하나의 결함이 폼 전체를 error.tsx 로 보내면 안 된다 -
    // listView·detailView 와 다른 계약이다(view.ts 머리말).
    expect(referenceList(probeLeaflet(), { errors: [{ code: 'PROBE_BAD' }] })).toEqual({
      options: [],
      truncated: false,
    })
  })

  it('data 가 배열이 아니면(단건 문서 모양) 빈 목록이다 - 던지지 않는다', () => {
    expect(referenceList(probeLeaflet(), { data: null })).toEqual({
      options: [],
      truncated: false,
    })
  })
})
