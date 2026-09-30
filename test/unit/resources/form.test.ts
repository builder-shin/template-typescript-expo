/**
 * `lib/resources/form.ts` 의 판단 전부 - 쓰기의 조립·오류 배치·초기값.
 *
 * **자원은 전부 `probe*` 로 만든다**(`define.test.ts`·`view.test.ts` 와 같은
 * 관례) - 실제 선언(`EXAMPLE`)을 넘겨 재면 "선언을 읽는다"와 "그 자원을
 * 안다"가 구별되지 않는다.
 *
 * **속 빈 가드(테스트가 구별해야 할 두 세계가 우연히 같아지는 결함) 두 가지를
 * 여기서 지킨다:**
 *
 * 1. **값 변종 금지** - `ResourceFormValues.attributes` 는 실전에서 전부
 *    문자열이다(`FormData` 가 그렇다). 이 파일의 모든 픽스처도 문자열로
 *    쓴다 - `{ probeScore: 42 }` 처럼 숫자를 쓰면 프로덕션과 다른 세계를
 *    테스트하는 것이다(D3 의 Blocker 가 정확히 이 자리에서 났다).
 * 2. **배선 지점을 지키는 테스트는 그 지점을 통과하는 모든 값을 실전과
 *    다르게 고정한다** - 오류의 `detail`·필드 이름·id 값을 전부 `PROBE_`
 *    접두사로 둔다.
 */

import { describe, expect, it } from 'vitest'
import { UNUSABLE_RESPONSE_MESSAGE } from '@/lib/auth/form-state'
import type { JsonApiResult } from '@/lib/jsonapi/client'
import type { ErrorObject, ResourceObject, SingleDocument } from '@/lib/jsonapi/document'
import { defineResource } from '@/lib/resources/define'
import {
  IDLE_RESOURCE_FORM_STATE,
  createdId,
  decideWriteFailure,
  formStateFromErrors,
  initialFormValues,
  unusableFormState,
  writeDocument,
  type ResourceFormValues,
} from '@/lib/resources/form'

/** 브리핑이 지정한 픽스처 그대로 - 문자열 속성 둘(하나는 nullable) + 읽기 전용 datetime, 관계 둘. */
const PROBE_RESOURCE = defineResource({
  type: 'probeWidgets',
  path: '/probe/api/widgets',
  attributes: {
    probeName: {
      kind: 'string',
      label: 'PROBE 이름',
      readOnly: false,
      nullable: false,
      listed: true,
    },
    probeNote: {
      kind: 'text',
      label: 'PROBE 메모',
      readOnly: false,
      nullable: true,
      listed: false,
    },
    probeMade: {
      kind: 'datetime',
      label: 'PROBE 생성',
      readOnly: true,
      nullable: false,
      listed: true,
    },
  },
  relationships: {
    probeOwner: { cardinality: 'one', type: 'probeOwners', label: 'PROBE 주인' },
    probeMarks: { cardinality: 'many', type: 'probeMarks', label: 'PROBE 표식' },
  },
  filters: {},
  sorts: ['probeName'],
  defaultSort: 'probeName',
  includes: [],
  writable: true,
})

/**
 * int 속성 둘(하나는 nullable) + 관계 없음 - `writeDocument` 의 규칙 ②③과
 * "관계 없으면 키를 뺀다"를 재는 전용 픽스처. `PROBE_RESOURCE` 를 확장하지
 * 않는 이유: 그 픽스처의 "읽기 전용만 걸러낸다" 테스트가 정확한 키 집합을
 * 단언하므로, 속성을 더하면 그 테스트가 깨진다.
 */
const PROBE_GAUGE = defineResource({
  type: 'probeGauges',
  path: '/probe/api/gauges',
  attributes: {
    probeScore: {
      kind: 'int',
      label: 'PROBE 점수',
      readOnly: false,
      nullable: false,
      listed: true,
      // min·max 를 3·97 로 둔다 - lib/resources/example.ts:58-59 의 실제
      // score(0·100)와 값이 같으면 "선언에서 읽었다"와 "0·100 을 박았다"가
      // 구별되지 않는다(값 변종 - 픽스처가 프로덕션 상수와 같은 값이면
      // "계산했다"와 "하드코딩했다"가 구별되지 않는다). 이 파일은 이 값을 직접
      // 읽는 소비자가 없어(Task 2 는 min·max 를 안 쓴다) 오늘은 무해하지만,
      // Task 3(`ResourceFields`)가 <input min max> 를 그리며 첫 소비자가
      // 되는 순간부터는 이 값이 그 구별을 지킨다.
      min: 3,
      max: 97,
    },
    probeWeight: {
      kind: 'int',
      label: 'PROBE 무게',
      readOnly: false,
      nullable: true,
      listed: true,
    },
  },
  relationships: {},
  filters: {},
  sorts: ['probeScore'],
  defaultSort: 'probeScore',
  includes: [],
  writable: true,
})

/**
 * enum 속성(값과 라벨이 다르다) + 관계 둘(to-one·to-many) - `initialFormValues`
 * 가 표시 문자열이 아니라 원값을 담는지, 관계 id 를 included 없이 읽는지
 * 재는 전용 픽스처.
 */
const PROBE_DIAL = defineResource({
  type: 'probeDials',
  path: '/probe/api/dials',
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
    probeStamp: {
      kind: 'datetime',
      label: 'PROBE 시각',
      readOnly: true,
      nullable: false,
      listed: true,
    },
  },
  relationships: {
    probeGroup: { cardinality: 'one', type: 'probeGroups', label: 'PROBE 그룹' },
    probePeers: { cardinality: 'many', type: 'probePeers', label: 'PROBE 동료' },
  },
  filters: {},
  sorts: ['probeMode'],
  defaultSort: 'probeMode',
  includes: [],
  writable: true,
})

function attributeError(field: string, detail: string): ErrorObject {
  return {
    status: '422',
    code: 'VALIDATION_ERROR',
    title: 'probe-title',
    detail,
    source: { pointer: `/data/attributes/${field}` },
  }
}

function relationshipNotFoundError(field: string, detail: string): ErrorObject {
  return {
    status: '404',
    code: 'RELATIONSHIP_RESOURCE_NOT_FOUND',
    title: 'probe-title',
    detail,
    source: { pointer: `/data/relationships/${field}/data/id` },
  }
}

function notFoundError(detail: string): ErrorObject {
  return { status: '404', code: 'RESOURCE_NOT_FOUND', title: 'probe-title', detail }
}

function sessionError(detail: string): ErrorObject {
  return { status: '401', code: 'TOKEN_EXPIRED', title: 'probe-title', detail }
}

/** client.ts 가 합성한 오류의 모양 - code 를 실제 세 코드가 아닌 값으로 둔다(flow.test.ts 와 같은 규율). */
function syntheticError(detail: string): ErrorObject {
  return {
    status: '0',
    code: 'PROBE_SYNTHETIC',
    title: 'PROBE_SYNTHETIC',
    detail,
    meta: { cause: 'probe cause', synthetic: true },
  }
}

function okResult(data: ResourceObject | null): JsonApiResult<SingleDocument> {
  return { ok: true, status: 200, document: { data } }
}

const EMPTY_VALUES: ResourceFormValues = { attributes: {}, relationships: {} }

describe('writeDocument — 폼 값을 JSON:API 요청 문서로', () => {
  it('쓰기 문서는 읽기 전용 속성을 담지 않는다', () => {
    const values: ResourceFormValues = {
      attributes: { probeName: 'probe-a', probeNote: '', probeMade: '2020-01-01T00:00:00Z' },
      relationships: {},
    }
    const document = writeDocument(PROBE_RESOURCE, values)
    const attributes = document.data.attributes as Record<string, unknown>
    expect(Object.keys(attributes)).toEqual(['probeName', 'probeNote'])
  })

  it('관계의 type 은 선언에서 온다 - 경로 이름이 아니다 (to-many 중복도 순서를 지키며 제거된다)', () => {
    const document = writeDocument(PROBE_RESOURCE, {
      attributes: { probeName: 'probe-a', probeNote: '' },
      relationships: { probeOwner: ['owner-1'], probeMarks: ['mark-2', 'mark-2', 'mark-3'] },
    })
    expect(document.data.relationships).toEqual({
      probeOwner: { data: { type: 'probeOwners', id: 'owner-1' } },
      probeMarks: {
        data: [
          { type: 'probeMarks', id: 'mark-2' },
          { type: 'probeMarks', id: 'mark-3' },
        ],
      },
    })
  })

  it('선언에 없는 관계 값은 무시한다 - 화이트리스트는 관계에도 적용된다', () => {
    const document = writeDocument(PROBE_RESOURCE, {
      attributes: { probeName: 'probe-a', probeNote: '' },
      relationships: { probeGhost: ['probe-ghost-1'] },
    })
    expect(document.data.relationships).toEqual({
      probeOwner: { data: null },
      probeMarks: { data: [] },
    })
  })

  it('int 는 숫자로 바뀐다', () => {
    const document = writeDocument(PROBE_GAUGE, {
      attributes: { probeScore: '42', probeWeight: '7' },
      relationships: {},
    })
    const attributes = document.data.attributes as Record<string, unknown>
    expect(attributes.probeScore).toBe(42)
    expect(typeof attributes.probeScore).toBe('number')
  })

  it("int 인 빈 문자열은 0 이 아니라 빈 문자열이다 - Number('') 의 함정", () => {
    // nullable: false 인 probeScore 에 빈 문자열을 그대로 두면 "0점"이 아니라
    // "값 없음"이 백엔드에 도달해야 한다. Number('') 는 0 이라 이 경계를
    // 놓치면 조용히 통과한다.
    const document = writeDocument(PROBE_GAUGE, {
      attributes: { probeScore: '', probeWeight: '' },
      relationships: {},
    })
    const attributes = document.data.attributes as Record<string, unknown>
    expect(attributes.probeScore).toBe('')
    expect(attributes.probeScore).not.toBe(0)
    // nullable: true 인 probeWeight 는 같은 빈 문자열이 null 이다.
    expect(attributes.probeWeight).toBeNull()
  })

  it('관계가 하나도 선언되지 않은 자원은 relationships 키 자체가 없다', () => {
    const document = writeDocument(PROBE_GAUGE, {
      attributes: { probeScore: '10', probeWeight: '' },
      relationships: {},
    })
    expect('relationships' in document.data).toBe(false)
  })

  it('id 를 주면 담는다(PATCH) - 안 주면 담지 않는다(POST)', () => {
    const values: ResourceFormValues = {
      attributes: { probeName: 'probe-a', probeNote: '' },
      relationships: {},
    }
    expect('id' in writeDocument(PROBE_RESOURCE, values).data).toBe(false)
    expect(writeDocument(PROBE_RESOURCE, values, 'probe-existing-id').data.id).toBe(
      'probe-existing-id',
    )
  })

  it('data.type 은 언제나 담는다', () => {
    const values: ResourceFormValues = {
      attributes: { probeName: 'probe-a', probeNote: '' },
      relationships: {},
    }
    expect(writeDocument(PROBE_RESOURCE, values).data.type).toBe('probeWidgets')
  })
})

describe('unusableFormState', () => {
  it('UNUSABLE_RESPONSE_MESSAGE 하나만 문서 오류에 담고 제출값을 보존한다', () => {
    const submitted: ResourceFormValues = {
      attributes: { probeName: 'probe-kept' },
      relationships: { probeOwner: ['probe-owner-1'] },
    }
    expect(unusableFormState(submitted)).toEqual({
      documentErrors: [UNUSABLE_RESPONSE_MESSAGE],
      fieldErrors: {},
      relationshipErrors: {},
      submitted,
    })
  })
})

describe('formStateFromErrors — groupErrors 의 세 버킷을 그대로 옮긴다', () => {
  it('속성 오류는 fieldErrors 로 간다', () => {
    const state = formStateFromErrors(
      [attributeError('probeName', 'probe-attribute-detail')],
      EMPTY_VALUES,
    )
    expect(state.fieldErrors).toEqual({ probeName: ['probe-attribute-detail'] })
    expect(state.documentErrors).toEqual([])
    expect(state.relationshipErrors).toEqual({})
  })

  it('관계의 404 도 필드 오류로 배치된다 - 배너가 아니다', () => {
    const state = formStateFromErrors(
      [relationshipNotFoundError('probeOwner', 'PROBE 상세')],
      EMPTY_VALUES,
    )
    expect(state.relationshipErrors.probeOwner).toEqual(['PROBE 상세'])
    expect(state.documentErrors).toEqual([])
  })

  it('to-many 의 인덱스가 든 포인터도 관계 이름으로 모인다', () => {
    const state = formStateFromErrors(
      [
        {
          status: '404',
          code: 'RELATIONSHIP_RESOURCE_NOT_FOUND',
          detail: 'PROBE 상세',
          source: { pointer: '/data/relationships/probeMarks/data/1/id' },
        },
      ],
      EMPTY_VALUES,
    )
    expect(state.relationshipErrors.probeMarks).toEqual(['PROBE 상세'])
  })

  it('포인터가 /data 뿐이면 배너로 간다', () => {
    const state = formStateFromErrors(
      [
        {
          status: '422',
          code: 'VALIDATION_ERROR',
          detail: 'PROBE 상세',
          source: { pointer: '/data' },
        },
      ],
      EMPTY_VALUES,
    )
    expect(state.documentErrors).toEqual(['PROBE 상세'])
  })

  it('문구가 하나도 없는 오류 배열이면 빈 배너 대신 UNUSABLE_RESPONSE_MESSAGE 다', () => {
    // client.ts 의 isErrorDocument 는 `{"errors":[{}]}` 를 통과시킨다 -
    // 그대로 그리면 사용자는 거절만 당하고 아무 설명도 못 본다
    // (lib/auth/flow.ts 의 authFormStateFromErrors 와 같은 방어).
    expect(formStateFromErrors([{}], EMPTY_VALUES)).toEqual(unusableFormState(EMPTY_VALUES))
  })

  it('실패해도 제출한 값을 그대로 돌려준다', () => {
    const submitted: ResourceFormValues = {
      attributes: { probeName: 'probe-kept' },
      relationships: {},
    }
    const state = formStateFromErrors([attributeError('probeName', 'probe-detail')], submitted)
    expect(state.submitted).toEqual(submitted)
  })
})

describe('decideWriteFailure — 계획서 §3 판정 6 의 갈래', () => {
  it('transport 는 값으로 돌아온다 - 던지지 않는다', () => {
    const failure = decideWriteFailure([syntheticError('probe-transport')], EMPTY_VALUES)
    expect(failure.kind).toBe('transport')
    if (failure.kind !== 'transport') throw new Error('unreachable')
    expect(failure.diagnostic).toContain('PROBE_SYNTHETIC')
  })

  it('세션 코드는 destroySession 이다', () => {
    expect(decideWriteFailure([sessionError('probe-session')], EMPTY_VALUES)).toEqual({
      kind: 'destroySession',
    })
  })

  it('RESOURCE_NOT_FOUND(수정 대상 자체가 없음)는 notFound 다', () => {
    expect(decideWriteFailure([notFoundError('probe-not-found')], EMPTY_VALUES)).toEqual({
      kind: 'notFound',
    })
  })

  it('RELATIONSHIP_RESOURCE_NOT_FOUND(고른 분류가 없음)는 notFound 가 아니라 formState 다', () => {
    // 위험 자리 ⑧: "404 면 notFound()" 는 틀린 규칙이다. actionForCode 는
    // 이 코드를 'banner' 로 분류하지만 groupErrors 가 포인터를 보고 관계
    // 버킷에 넣으므로 이 함수는 formState 로 떨어져야 한다.
    const failure = decideWriteFailure(
      [relationshipNotFoundError('probeOwner', 'probe-relationship-detail')],
      EMPTY_VALUES,
    )
    expect(failure.kind).toBe('formState')
    if (failure.kind !== 'formState') throw new Error('unreachable')
    expect(failure.state.relationshipErrors).toEqual({ probeOwner: ['probe-relationship-detail'] })
  })

  it('그 외(속성 검증 오류)는 formState 다', () => {
    const submitted: ResourceFormValues = { attributes: { probeName: '' }, relationships: {} }
    const failure = decideWriteFailure(
      [attributeError('probeName', 'probe-field-detail')],
      submitted,
    )
    expect(failure).toEqual({
      kind: 'formState',
      state: {
        documentErrors: [],
        fieldErrors: { probeName: ['probe-field-detail'] },
        relationshipErrors: {},
        submitted,
      },
    })
  })
})

describe('createdId', () => {
  it('생성된 자원의 id 를 그대로 돌려준다', () => {
    const document: SingleDocument = {
      data: { type: 'probeWidgets', id: 'probe-new-id', attributes: {} },
    }
    expect(createdId(document)).toBe('probe-new-id')
  })

  it('data 가 null 이면 undefined 다 - 계약 위반이므로 호출부가 unusable 로 다룬다', () => {
    expect(createdId({ data: null })).toBeUndefined()
  })
})

describe('IDLE_RESOURCE_FORM_STATE', () => {
  it('제출 전 상태는 모든 통이 비어 있다', () => {
    expect(IDLE_RESOURCE_FORM_STATE).toEqual({
      documentErrors: [],
      fieldErrors: {},
      relationshipErrors: {},
      submitted: { attributes: {}, relationships: {} },
    })
  })
})

describe('initialFormValues — 계획 정정 R7 (JsonApiResult 를 받는다, DetailView 가 아니다)', () => {
  it('result 가 null 이면 생성 화면의 빈 값이다', () => {
    expect(initialFormValues(PROBE_DIAL, null)).toEqual({
      attributes: { probeMode: '' },
      relationships: { probeGroup: [], probePeers: [] },
    })
  })

  it('datetime 은 읽기 전용이라 폼 값에 없다', () => {
    expect(Object.keys(initialFormValues(PROBE_DIAL, null).attributes)).not.toContain('probeStamp')
  })

  it('enum 은 라벨이 아니라 백엔드 원값을 담는다 - DetailView 와 반대 방향', () => {
    const object: ResourceObject = {
      type: 'probeDials',
      id: 'probe-1',
      attributes: { probeMode: 'probeOn' },
    }
    // '프로브 켬' 같은 라벨이 아니라 원값 그대로다 - 이걸 라벨로 채우면
    // <select> 가 그 값을 가진 <option> 을 못 찾고, 저장 시 그대로 보내면
    // 422 다(계획 정정 R7 이 이 함수를 만든 이유).
    expect(initialFormValues(PROBE_DIAL, okResult(object)).attributes.probeMode).toBe('probeOn')
  })

  it('int 는 문자열로 되돌아온다', () => {
    const object: ResourceObject = {
      type: 'probeGauges',
      id: 'probe-1',
      attributes: { probeScore: 77, probeWeight: null },
    }
    const values = initialFormValues(PROBE_GAUGE, okResult(object))
    expect(values.attributes.probeScore).toBe('77')
    expect(values.attributes.probeWeight).toBe('')
  })

  it('관계 id 를 included 없이 linkage 에서 직접 꺼낸다', () => {
    const object: ResourceObject = {
      type: 'probeDials',
      id: 'probe-1',
      attributes: { probeMode: 'probeOn' },
      relationships: {
        probeGroup: { data: { type: 'probeGroups', id: 'probe-group-9' } },
        probePeers: {
          data: [
            { type: 'probePeers', id: 'probe-peer-1' },
            { type: 'probePeers', id: 'probe-peer-2' },
          ],
        },
      },
      // included 를 아예 안 준다 - resolveToOne/resolveToMany 를 썼다면
      // 색인이 없어 여기서 이름도 id 도 못 읽었을 것이다.
    }
    const values = initialFormValues(PROBE_DIAL, okResult(object))
    expect(values.relationships.probeGroup).toEqual(['probe-group-9'])
    expect(values.relationships.probePeers).toEqual(['probe-peer-1', 'probe-peer-2'])
  })

  it('관계가 비어 있으면(null·빈 배열) 빈 배열이다', () => {
    const object: ResourceObject = {
      type: 'probeDials',
      id: 'probe-1',
      attributes: { probeMode: 'probeOn' },
      relationships: {
        probeGroup: { data: null },
        probePeers: { data: [] },
      },
    }
    const values = initialFormValues(PROBE_DIAL, okResult(object))
    expect(values.relationships.probeGroup).toEqual([])
    expect(values.relationships.probePeers).toEqual([])
  })

  it('응답 객체에 relationships 키 자체가 없어도 던지지 않고 관계마다 빈 배열이다', () => {
    // documentObject(465-469행)·initialFormValues(493행)의 `object.relationships?.[name]`
    // 이 지키는 자리 - `?.` 를 빼면 relationships 키가 아예 없는 응답에서
    // `Cannot read properties of undefined`로 던진다. PROBE_DIAL 은 관계를
    // 둘 선언하고 있어(probeGroup·probePeers) 이 루프가 실제로 도는 픽스처를
    // 쓴다 - 관계가 없는 자원을 쓰면 `Object.keys(resource.relationships)`
    // 가 애초에 비어 이 옵셔널 체이닝 자체를 지나가지 않는다.
    const object: ResourceObject = {
      type: 'probeDials',
      id: 'probe-1',
      attributes: { probeMode: 'probeOn' },
      // relationships 키 자체가 없다 - `{ data: null }` 도 아니고 `{}` 도
      // 아니다. included 없이 보내는 일부 백엔드 응답, 또는 컬렉션
      // 엔드포인트에서 그대로 재사용한 객체가 이 모양일 수 있다.
    }
    expect(initialFormValues(PROBE_DIAL, okResult(object)).relationships).toEqual({
      probeGroup: [],
      probePeers: [],
    })
  })

  it('실패 응답이면 빈 값으로 물러선다 - notFound·배너 판정은 detailView 의 몫이다', () => {
    const failed: JsonApiResult<SingleDocument> = { ok: false, status: 404, errors: [] }
    expect(initialFormValues(PROBE_DIAL, failed)).toEqual(initialFormValues(PROBE_DIAL, null))
  })

  it('본문 없는 204 도 빈 값으로 물러선다', () => {
    const noBody: JsonApiResult<SingleDocument> = { ok: true, status: 204, document: null }
    expect(initialFormValues(PROBE_DIAL, noBody)).toEqual(initialFormValues(PROBE_DIAL, null))
  })

  it('data 가 null 인 계약 위반 응답도 빈 값으로 물러선다', () => {
    expect(initialFormValues(PROBE_DIAL, okResult(null))).toEqual(
      initialFormValues(PROBE_DIAL, null),
    )
  })
})
