/**
 * 쓰기(생성·수정)의 판단 전부 - Task 2, `lib/resources/view.ts` 의 쓰기 짝.
 *
 * `app/(app)/examples/actions.ts` 의 Server Action 은 이 파일의 순수 함수를
 * **배선만** 한다 - `FormData` -> JSON:API 요청 문서, 응답 오류 -> 폼 화면
 * 상태, 실패 뒤 무엇을 할지가 전부 여기 있다. `lib/auth/flow.ts` 가 D2 에서
 * 한 역할의 자원 판(版)이다 - 그 파일과 같은 근거를 그대로 든다: Server
 * Action 은 요청 스코프가 필요해 단위 테스트에서 부를 수 없으므로, 판단이
 * Action 안에 남으면 그만큼이 관측 불가가 된다.
 *
 * ## `lib/resources/AGENTS.md` 의 규칙을 그대로 지킨다
 *
 * JSX 도 fetch 도 없다. **`request()` 를 부르지 않는다** - 이 파일은 보낼
 * 문서를 조립하고 받은 오류를 해석할 뿐이고, 실제로 부르는 것은 Task 5·6·7
 * 의 Server Action 이다.
 *
 * ## 계획 정정(R7) - `initialFormValues` 의 두 번째 인자
 *
 * 계획서 §5 Task 2 는 `initialFormValues(resource, view: DetailView | null)`
 * 라고 적었지만 **틀렸다.** `DetailView`(`view.ts:1653`)의 `fields[].values`
 * 는 **표시 문자열**이다 - enum 은 이미 라벨(`활성`)이고 `datetime` 은 이미
 * `formatDateTime` 을 지난 값이다. 게다가 관계 필드에는 id 가 없고 이름만
 * 있다. 그대로 구현하면 수정 화면이 `<option value="활성">` 을 고르려 하고
 * 저장할 때마다 422 가 난다.
 *
 * 그래서 두 번째 인자를 `detailView` 와 **같은 입력**인
 * `JsonApiResult<SingleDocument> | null` 로 바꾼다 - 수정 화면이 응답 문서를
 * 한 번만 읽어 표시(`detailView`)와 폼 초기값(`initialFormValues`)을 둘 다
 * 만든다. 원값과 관계 id 는 그 응답에만 있다.
 *
 * (template-typescript-expo) 입력이 `FormData` 가 아니라 화면이 들고 있는 폼 상태 객체
 * (`ResourceFormValues`)다(스펙 6.2) - `readFormValues` 를 빼고 그 객체를 만들고 고치는 순수
 * 함수(`newFormValues`·`withAttribute`·`withRelationshipChoice`)를 더했다. 관계 선택기가 그릴
 * 것(`relationshipTargets`·`relationshipChoice`)도 여기 있다 - 원본에서는
 * `app/(app)/examples/relationship-lists.ts` 와 `components/resource/relationship-picker.tsx` 가
 * 하던 판단이고, 이 앱에는 컴포넌트 시험이 없어서(스펙 11.1) lib 에 둔다. 요청을 보내는 쓰기
 * 흐름(원본의 Server Action 자리)은 `write.ts` 다.
 */

import { UNUSABLE_RESPONSE_MESSAGE } from '@/lib/auth/form-state'
import type { JsonApiResult } from '@/lib/jsonapi/client'
import type {
  ErrorObject,
  RelationshipObject,
  ResourceIdentifier,
  ResourceObject,
  SingleDocument,
} from '@/lib/jsonapi/document'
import { actionForErrors, groupErrors, type FieldErrors } from '@/lib/jsonapi/errors'
import {
  formAttributes,
  isRequiredAttribute,
  type AttributeDefinition,
  type RelationshipDefinition,
  type ResourceDefinition,
} from './define'
import { resourceByType } from './index'
import type { ReferenceList } from './view'

/**
 * 폼 하나가 들고 있는 값.
 *
 * `attributes` 의 값이 전부 문자열인 것은 선택이 아니라 사실이다 -
 * `FormData` 가 주는 값은 전부 문자열(또는 파일)이다. 이 모양을 지키지
 * 않으면(예: 테스트 픽스처가 `{ probeScore: 42 }` 처럼 숫자를 쓰면)
 * 프로덕션과 다른 세계를 테스트하는 것이다 - D3 의 Blocker 가 정확히 이
 * 자리(타입 변종)에서 났다.
 *
 * `relationships` 가 id 배열인 이유: to-one 은 `<select>` 하나(0 또는 1개),
 * to-many 는 체크박스 목록(0개 이상)이라, 두 모양을 한 타입으로 표현하면
 * `withRelationshipChoice`·`writeDocument` 가 cardinality 하나로만 갈라 쓸 수 있다.
 * (template-typescript-expo) 이 앱에서 값을 만드는 것은 `FormData` 가 아니라 화면의 입력이다 -
 * TextInput 의 값도 문자열이다.
 */
export interface ResourceFormValues {
  /** 속성 이름 → 폼이 받은 문자열. **전부 문자열이다** - FormData 가 그렇다. */
  readonly attributes: Readonly<Record<string, string>>
  /** 관계 이름 → 고른 id 들. to-one 은 0개나 1개, to-many 는 0개 이상. */
  readonly relationships: Readonly<Record<string, readonly string[]>>
}

/**
 * 폼 화면 하나의 상태.
 *
 * 세 오류 통은 `groupErrors`(`lib/jsonapi/errors.ts`)의 세 버킷을 그대로
 * 옮긴 것이다(계획서 §3 판정 6) - **`actionForErrors` 는 화면 전체의
 * 행동**(로그아웃·notFound·transport)을 고르는 것이지 오류를 어디 그릴지
 * 고르는 것이 아니다. 오류의 자리는 포인터를 보는 `groupErrors` 가 정한다.
 * 자세한 근거는 아래 `formStateFromErrors` 주석에 있다.
 */
export interface ResourceFormState {
  readonly documentErrors: readonly string[]
  readonly fieldErrors: Readonly<Record<string, readonly string[]>>
  readonly relationshipErrors: Readonly<Record<string, readonly string[]>>
  readonly submitted: ResourceFormValues
}

/**
 * 아직 제출하지 않은 폼의 상태. `useActionState` 의 초기값이다
 * (`lib/auth/form-state.ts` 의 `IDLE_AUTH_FORM_STATE` 와 같은 자리) -
 * **자원을 모른다**(어느 속성·관계가 있는지는 이 상수가 알 수 없다), 그래서
 * `submitted` 도 빈 레코드다. 특정 자원의 초기값이 필요하면 `initialFormValues`
 * 를 쓴다.
 */
export const IDLE_RESOURCE_FORM_STATE: ResourceFormState = {
  documentErrors: [],
  fieldErrors: {},
  relationshipErrors: {},
  submitted: { attributes: {}, relationships: {} },
}

/* ------------------------------------------------------------------------- *
 * (template-typescript-expo) 폼 상태 객체 - 원본의 `FormData -> ResourceFormValues` 자리
 * ------------------------------------------------------------------------- */

/**
 * 생성 화면의 첫 값 - `initialFormValues(resource, null)` 에서 **필수 enum 만 첫 값을 고른 채로**
 * 시작한다.
 *
 * 원본의 생성 화면은 enum 을 빈 보기 없는 소재 `<select>` 로 그렸고, 브라우저는 그런 `<select>` 의
 * 첫 `<option>` 을 고른 채로 그려 그 값을 보냈다(`components/resource/resource-form.tsx` 의 "알려진
 * 한계" 절). 이 앱의 선택 칸에는 그런 기본이 없어 같은 동작을 값으로 옮긴다 - 옮기지 않으면
 * 사용자가 고르지 않은 필수 enum 이 빈 문자열로 나가 422 가 된다. 선택인 enum(`nullable`)은
 * 빈 값(보내면 `null`)으로 둔다.
 */
export function newFormValues(resource: ResourceDefinition): ResourceFormValues {
  const empty = initialFormValues(resource, null)
  const attributes: Record<string, string> = { ...empty.attributes }
  for (const [name, attribute] of formAttributes(resource)) {
    if (attribute.kind === 'enum' && isRequiredAttribute(attribute)) {
      attributes[name] = attribute.values[0]?.value ?? ''
    }
  }
  return { attributes, relationships: empty.relationships }
}

/**
 * 속성 하나의 입력을 바꾼 새 폼 값. 값을 검증하지 않는다 - 정본 검증자는 백엔드다(스펙 9.2).
 * 빈 문자열의 뜻은 보낼 때 `writeDocument` 가 정한다.
 */
export function withAttribute(
  values: ResourceFormValues,
  name: string,
  raw: string,
): ResourceFormValues {
  return { ...values, attributes: { ...values.attributes, [name]: raw } }
}

/**
 * 관계 하나의 선택을 바꾼 새 폼 값 - `ResourceFormValues.relationships` 의 "to-one 은 0개나 1개"
 * 계약을 여기서 지킨다. `null` 은 그 관계를 비운다.
 *
 * - to-one: `id` 를 고른다(앞의 선택을 바꾼다).
 * - to-many: `id` 하나를 켜고 끈다 - 켜면 **끝에 붙이고** 끄면 빼며, 나머지의 순서는 그대로다.
 *   폼은 선택을 다시 정렬하지 않는다(스펙 8.1 의 "순서 유지") - 보내는 순서는 사용자가 고른
 *   순서, 수정 화면에서는 응답이 준 순서다. 화면에 보이는 순서는 백엔드가 정한다.
 */
export function withRelationshipChoice(
  values: ResourceFormValues,
  name: string,
  relationship: RelationshipDefinition,
  id: string | null,
): ResourceFormValues {
  const current = values.relationships[name] ?? []
  let next: readonly string[]
  if (id === null) next = []
  else if (relationship.cardinality === 'one') next = [id]
  else next = current.includes(id) ? current.filter((chosen) => chosen !== id) : [...current, id]
  return { ...values, relationships: { ...values.relationships, [name]: next } }
}

/* ------------------------------------------------------------------------- *
 * (template-typescript-expo) 관계 선택기 - 원본의 relationship-lists.ts · relationship-picker.tsx 가
 * 하던 판단
 * ------------------------------------------------------------------------- */

/**
 * 관계마다 선택기가 목록을 가져올 대상 자원 - 원본 `relationshipLists` 의 앞 절반.
 *
 * `resource.relationships` 를 그대로 돈다 - 관계 이름 리터럴이 없어서 선언에 관계를 더하면 생성·
 * 수정 화면이 함께 따라온다. 대상은 선언의 `relationship.type` 으로 등록부에서 찾는다. 여기
 * 들어오는 type 은 응답이 아니라 우리 선언에서 온다 - 등록부에 없으면 데이터의 상태가 아니라
 * 선언의 오류라 조용히 물러서지 않고 던진다(게이트에서는 `test/unit/resources/invariants.ts` 의
 * `relationship-type` 규칙이 먼저 잡는다).
 */
export function relationshipTargets(
  resource: ResourceDefinition,
): readonly (readonly [string, ResourceDefinition])[] {
  return Object.entries(resource.relationships).map(([name, relationship]) => {
    const target = resourceByType(relationship.type)
    if (target === undefined) {
      throw new Error(
        `${resource.type}: 관계 '${name}' 의 대상 type '${relationship.type}' 이 등록부에 없다`,
      )
    }
    return [name, target] as const
  })
}

/** 선택기의 보기 하나. `listed` 가 거짓이면 참조 목록에 없는 선택이다 - 라벨 자리에 id 가 온다. */
export interface RelationshipOption {
  readonly id: string
  readonly label: string
  readonly selected: boolean
  readonly listed: boolean
}

/** 관계 선택기가 그릴 것. */
export interface RelationshipChoice {
  /** 폼에 그릴 선택 - 선택 순서 그대로다(to-one 은 0개나 1개). */
  readonly chosen: readonly RelationshipOption[]
  /** 시트에 그릴 보기 - 목록 순서 그대로이고, 목록에 없는 선택이 끝에 붙는다. */
  readonly options: readonly RelationshipOption[]
  /** 목록에 없는 선택이 있다 - 선택기가 안내를 그린다. */
  readonly hasUnlisted: boolean
}

/**
 * 참조 목록과 고른 id 들 → 선택기가 그릴 것 - 원본 `RelationshipPicker` 의 판단.
 *
 * ## 목록 밖 선택을 반드시 그린다
 *
 * 목록(`list.options`)은 참조 조회의 응답에서, 선택(`selected`)은 수정 화면의 상세 응답에서 온다.
 * 둘이 어긋나는 실재 경로가 둘이다 - 참조 조회가 실패해 목록이 비었거나, 참조 자원이
 * `REFERENCE_PAGE_SIZE` 를 넘어 잘렸다(`view.ts` 의 `referenceList`). 그 선택을 그리지 않으면
 * 사용자는 무엇이 골라져 있는지 모른 채 저장한다. 그래서 목록에 없는 선택을 보기 끝에 붙이고
 * (`listed: false`) 화면이 그 사실을 알린다. 라벨은 지어낼 수 없다 - 이 화면은 그 이름을 가진
 * 적이 없어 id 를 그대로 쓴다.
 *
 * (원본은 보기가 없으면 그 선택이 제출에서 빠져 관계가 지워졌다. 이 앱의 폼 값은 화면이 들고
 * 있는 객체라 빠지지 않는다 - 그래도 보여야 사용자가 해제할 수 있다.)
 *
 * to-one 은 첫 id 하나만 뜻이 있다. 같은 id 가 두 번 오거나 빈 문자열이 섞여도 한 번만, 빈 것은
 * 빼고 그린다.
 */
export function relationshipChoice(
  relationship: RelationshipDefinition,
  list: ReferenceList,
  selected: readonly string[],
): RelationshipChoice {
  const unique = [...new Set(selected)].filter((id) => id !== '')
  const effective = relationship.cardinality === 'one' ? unique.slice(0, 1) : unique
  const chosenIds = new Set(effective)
  const labels = new Map(list.options.map((option) => [option.id, option.label]))

  const chosen = effective.map((id): RelationshipOption => {
    const label = labels.get(id)
    return label === undefined
      ? { id, label: id, selected: true, listed: false }
      : { id, label, selected: true, listed: true }
  })
  const unlisted = chosen.filter((option) => !option.listed)
  const listed = list.options.map((option): RelationshipOption => ({
    id: option.id,
    label: option.label,
    selected: chosenIds.has(option.id),
    listed: true,
  }))

  return { chosen, options: [...listed, ...unlisted], hasUnlisted: unlisted.length > 0 }
}

/* ------------------------------------------------------------------------- *
 * ResourceFormValues -> JSON:API 요청 문서
 * ------------------------------------------------------------------------- */

/**
 * 속성 값 하나를 와이어 값으로.
 *
 * **순서가 중요하다 - 빈 문자열 판정이 kind 판정보다 먼저다.** 안 그러면
 * nullable 인 `int` 속성의 빈 문자열이 `Number('')`(= `0`)을 거쳐 "0점"이
 * 되어 버린다 - "값 없음"과 "0"은 다른 뜻이다(실측: `score: "42"` 는 타입
 * 오류로 422 인데, 빈 문자열을 그대로 `Number` 에 넣으면 `0`으로 둔갑해
 * "필수인데 비었다"는 오류를 프론트가 조용히 감춘다).
 *
 * `nullable: false` 인데 빈 문자열이면 **그대로 빈 문자열을 보낸다** -
 * 프론트가 "필수인데 비었다"를 판정해 막지 않는다. 스펙 8.1 의 "허용목록에
 * 없는 것도 그대로 보내고 백엔드가 거절하게 둔다"와 같은 규율이다. 백엔드가
 * 422 로 거절하고 그 오류가 화면에 뜬다 - 조용히 틀리지 않는다.
 */
function attributeWireValue(attribute: AttributeDefinition, raw: string): unknown {
  if (raw === '') return attribute.nullable ? null : ''
  return attribute.kind === 'int' ? Number(raw) : raw
}

/**
 * 관계 하나를 와이어 값으로. **`type` 은 `relationship.type`(선언)에서
 * 온다 - 경로 이름도 `resource.type` 도 아니다.** 그 값을 바꿔 쓰면 409
 * `TYPE_MISMATCH` 다(실측 - 경로 이름 `categories` 를 쓰면 그렇게 됐고,
 * 올바른 값은 `exampleCategories` 다).
 *
 * to-many 는 **순서를 지키며 중복을 제거한다** - `Set` 은 삽입 순서를
 * 보존하므로 `[...new Set(ids)]` 가 그 둘을 동시에 만족한다. 중복 태그 id 는
 * 세 백엔드 모두 400 으로 거절한다(2026-10-02 실측,
 * `docs/superpowers/notes/2026-10-01-d7-measurements.md` 의 K4). NestJS 는
 * 예전에 중복을 조용히 제거했지만, 지금은 어느 백엔드에서도 거절되지 않도록 보내기 전에 제거한다.
 */
function relationshipWireValue(
  relationship: RelationshipDefinition,
  ids: readonly string[],
): unknown {
  if (relationship.cardinality === 'one') {
    const id = ids[0]
    return { data: id === undefined ? null : { type: relationship.type, id } }
  }
  return { data: [...new Set(ids)].map((id) => ({ type: relationship.type, id })) }
}

/**
 * 폼 값 하나를 JSON:API 요청 문서로. **판단 규칙 여섯**(브리핑 Step 3, 전부
 * 실측 근거):
 *
 * ① 속성은 `formAttributes` 로 화이트리스트한다 - `readOnly` 를 보내면
 *    422 다. 응답 문서를 그대로 되돌려 보내는 편집 폼이 깨지는 이유다.
 * ② 값 변환은 kind 가 정한다 - `int` 는 `Number(...)`, 나머지는 문자열
 *    그대로(`attributeWireValue`).
 * ③ 빈 문자열의 뜻은 nullable 이 정한다(`attributeWireValue`).
 * ④ 관계는 cardinality 가 정한다(`relationshipWireValue`) - type 은 선언에서.
 * ⑤ to-many 는 순서를 지키며 중복을 제거한다(`relationshipWireValue`).
 * ⑥ `id` 가 있으면 담는다(PATCH), 없으면 담지 않는다 - POST 에 `data.id` 를
 *    담으면 403 이다(실측).
 *
 * **`relationships` 키는 관계가 하나라도 선언돼 있을 때만 담는다.** 빈
 * 객체 `{}` 는 422 다(실측, `source.pointer` = `/data/relationships`) -
 * 관계가 없는 자원(참조 자원)은 `resource.relationships` 자체가 비어
 * 있으므로 이 조건 하나로 저절로 빠진다. 선언된 관계가 하나라도 있으면
 * (값을 하나도 안 골랐어도, 즉 `{data: null}`·`{data: []}` 뿐이어도) 그
 * 관계들은 키를 갖는다 - `{probeOwner: {data: null}}` 은 "이 관계를
 * 비운다"는 뜻의 정상적인 JSON:API 표현이라 위 W-3 의 "빈 객체" 와 다르다.
 */
export function writeDocument(
  resource: ResourceDefinition,
  values: ResourceFormValues,
  id?: string,
): { readonly data: Record<string, unknown> } {
  const attributes: Record<string, unknown> = {}
  for (const [name, attribute] of formAttributes(resource)) {
    attributes[name] = attributeWireValue(attribute, values.attributes[name] ?? '')
  }

  // 선언된 관계만 돈다 - `values.relationships` 에 선언에 없는 키가 섞여
  // 있어도(있을 수 없는 값이지만 방어적으로) 조용히 무시된다. `type` 의
  // 출처도 이 루프가 보장한다 - relationship.type 은 언제나 선언에서 온다.
  const relationshipEntries = Object.entries(resource.relationships).map(
    ([name, relationship]) =>
      [name, relationshipWireValue(relationship, values.relationships[name] ?? [])] as const,
  )

  const data: Record<string, unknown> = { type: resource.type }
  if (id !== undefined) data.id = id
  data.attributes = attributes
  if (relationshipEntries.length > 0) data.relationships = Object.fromEntries(relationshipEntries)

  return { data }
}

/* ------------------------------------------------------------------------- *
 * 오류 -> 화면 상태·행동
 * ------------------------------------------------------------------------- */

/**
 * "지금은 쓸 수 없다"는 상태. `lib/auth/form-state.ts` 의
 * `unusableResponseState` 와 같은 자리다 - **문구를 복제하지 않고
 * `UNUSABLE_RESPONSE_MESSAGE` 를 그대로 가져다 쓴다**(정본은 그 파일).
 *
 * 호출부 둘: `formStateFromErrors` 가 문구 없는 오류 배열을 만났을 때, 그리고
 * (이 파일 밖) 생성 Action 이 `createdId` 로 새 id 를 못 찾았을 때(2xx 인데
 * 계약이 깨진 응답) - 아래 `createdId` 주석 참고.
 */
export function unusableFormState(submitted: ResourceFormValues): ResourceFormState {
  return {
    documentErrors: [UNUSABLE_RESPONSE_MESSAGE],
    fieldErrors: {},
    relationshipErrors: {},
    submitted,
  }
}

function isEmptyErrors(grouped: FieldErrors): boolean {
  return (
    grouped.document.length === 0 &&
    Object.keys(grouped.attributes).length === 0 &&
    Object.keys(grouped.relationships).length === 0
  )
}

/**
 * 오류 배열을 폼 화면 상태로. **`groupErrors` 를 그대로 쓴다** - 포인터
 * 파싱을 다시 만들지 않는다. 그 함수가 이미 RFC 6901 이스케이프까지
 * 다룬다.
 *
 * 세 버킷이 그대로 옮겨간다: `document` → `documentErrors`, `attributes`
 * → `fieldErrors`, `relationships` → `relationshipErrors`.
 *
 * ## `actionForErrors` 와 답이 갈리는 것처럼 보이는 자리 - 역할이 다르다
 *
 * `RELATIONSHIP_RESOURCE_NOT_FOUND` 는 `actionForCode`(`errors.ts`)에서
 * `'banner'` 로 떨어지지만, `groupErrors` 는 그 오류의 `source.pointer`
 * (`/data/relationships/category/data/id`)를 보고 관계 버킷에 넣는다 -
 * **그것이 옳다.** `actionForErrors` 는 **화면 전체의 행동**(로그아웃·
 * notFound·transport 중 무엇을 할지)을 고르는 함수이지 오류를 **어디에
 * 그릴지**를 정하는 함수가 아니다. 오류의 자리는 오직 포인터로
 * `groupErrors` 가 정한다(계획서 §3 판정 6). 두 함수가 다른 질문에 답하고
 * 있을 뿐이라, 답이 갈리는 것은 결함이 아니다.
 *
 * ## 문구가 하나도 없으면 - `lib/auth/flow.ts` 와 같은 방어
 *
 * `authFormStateFromErrors` 와 같은 이유로 하나 더 방어한다: 오류를
 * 받았는데 문구가 하나도 없으면(예: `{"errors":[{}]}` - `client.ts` 의
 * `isErrorDocument` 는 이것을 통과시킨다) 빈 배너를 그리는 대신
 * `unusableFormState` 로 물러선다. 안 그러면 사용자는 거절만 당하고 아무
 * 설명도 못 본다 - `groupErrors` 가 "문구 없는 오류는 항목을 만들지
 * 않는다"고 스스로 적어 둔 대가를 여기서 갚는다.
 */
export function formStateFromErrors(
  errors: readonly ErrorObject[],
  submitted: ResourceFormValues,
): ResourceFormState {
  const grouped = groupErrors(errors)
  if (isEmptyErrors(grouped)) return unusableFormState(submitted)

  return {
    documentErrors: grouped.document,
    fieldErrors: grouped.attributes,
    relationshipErrors: grouped.relationships,
    submitted,
  }
}

/**
 * 진단용 문자열 - 사용자에게 보이지 않는다(Action 이 `app/error.tsx` 로
 * 던질 때 콘솔에만 남긴다). `view.ts` 의 비공개 `diagnosticOf` 와 같은
 * 모양을 다시 둔다 - 그 함수는 가져올 수 없는 비공개 함수이고, 이 파일이
 * `view.ts` 를 몰라도 되는 편이 낫다(둘은 각자 `lib/jsonapi/AGENTS.md` 의
 * 같은 계층일 뿐 서로의 소비자가 아니다). 네 줄짜리 진단 포맷을 복제하는
 * 비용이 굳이 이름 하나를 export 하는 결합보다 싸다.
 */
function diagnosticOf(errors: readonly ErrorObject[]): string {
  return errors.map((error) => `${error.status ?? '?'} ${error.code ?? '?'}`).join(', ')
}

/**
 * 쓰기 실패를 화면 행동으로(계획서 §3 판정 6 의 갈래). 브리핑에 시그니처만
 * 있고 본문은 없던 두 함수 중 하나 - Task 5 의 생성 Action 이 필요로
 * 한다. **Action 안에서 이 분기를 하면 그만큼이 단위 테스트에서 관측
 * 불가가 된다**(그래서 여기 둔다).
 *
 * **`redirect()`·`notFound()` 를 여기서 직접 부르지 않는다.**
 * `next/navigation` 은 `app/` 의 것이고 이 디렉터리는 라우팅을 모른다
 * (`lib/resources/AGENTS.md`). `DetailView` 의 `kind: 'notFound'`
 * (`view.ts:1646-1652`)가 같은 선례다 - "판정은 값으로, 행동은 화면이
 * 한다". `transport` 도 값으로 통일한다 - `view.ts` 의 `listView`·
 * `detailView` 는 그 갈래를 직접 `throw` 하지만, 이 함수는 라우팅도
 * 예외 발생도 하지 않는 순수 판정만 남기고 **Action 이 `diagnostic` 으로
 * 직접 던지게** 한다.
 *
 * 갈래(계획서 §3 판정 6):
 * ```
 * actionForErrors(errors) === 'transport'      → { kind: 'transport', diagnostic }
 * actionForErrors(errors) === 'destroySession' → { kind: 'destroySession' }
 * actionForErrors(errors) === 'notFound'       → { kind: 'notFound' }
 *   (RESOURCE_NOT_FOUND 뿐이다 - 수정 대상 자체가 없다는 뜻. 고른 분류가
 *   없다는 뜻의 RELATIONSHIP_RESOURCE_NOT_FOUND 와 혼동하면 안 된다 -
 *   그건 actionForCode 상으로는 'banner' 라 아래 "그 외" 로 떨어지고,
 *   formStateFromErrors 가 포인터를 보고 관계 버킷에 넣는다.)
 * 그 외('fieldErrors'|'banner')                 → { kind: 'formState', state }
 * ```
 * 마지막 갈래가 `'fieldErrors'`·`'banner'` 를 가르지 않는 이유는
 * `formStateFromErrors` 의 "역할이 다르다" 절과 같다 - 실제 배치는
 * `actionForErrors` 가 아니라 `groupErrors` 가 포인터로 정한다.
 */
export type WriteFailure =
  | { kind: 'formState'; state: ResourceFormState }
  | { kind: 'destroySession' }
  | { kind: 'notFound' }
  | { kind: 'transport'; diagnostic: string }

export function decideWriteFailure(
  errors: readonly ErrorObject[],
  submitted: ResourceFormValues,
): WriteFailure {
  const action = actionForErrors(errors)
  if (action === 'transport') return { kind: 'transport', diagnostic: diagnosticOf(errors) }
  if (action === 'destroySession') return { kind: 'destroySession' }
  if (action === 'notFound') return { kind: 'notFound' }
  return { kind: 'formState', state: formStateFromErrors(errors, submitted) }
}

/**
 * 생성 응답에서 새 id 를. **없으면 `undefined`** - 2xx 인데 `data` 가
 * 없거나(`204`·`data: null`) `id` 가 없는 것은 계약 위반이라, 이 함수는
 * 그 상황을 지어내지 않고 있는 그대로 알린다. 호출부(생성 Action)가
 * `undefined` 를 보면 `unusableFormState` 로 다룬다 - 브리핑에 시그니처만
 * 있던 두 함수 중 나머지 하나다.
 */
export function createdId(document: SingleDocument): string | undefined {
  return document.data?.id
}

/* ------------------------------------------------------------------------- *
 * 응답 문서 -> 폼 초기값 (수정 화면)
 * ------------------------------------------------------------------------- */

/**
 * `JsonApiResult<SingleDocument>` 에서 자원 객체를 꺼낸다. 실패·본문 없음
 * (204)·`data: null`(계약 위반)은 전부 `null` 로 접는다.
 *
 * **이 함수는 오류를 배치하지 않는다.** 수정 화면은 이 값을 쓰기 전에
 * 반드시 `detailView` 로 notFound·배너·transport 를 먼저 걸러야 하고
 * (같은 `result` 를 두 함수에 넘긴다 - R7), 그 확인을 통과하지 못한
 * `result` 로 `initialFormValues` 가 불려도 던지지 않고 "빈 값" 으로
 * 물러선다 - 순수 함수가 소비자의 실수로 죽는 것보다 안전한 쪽이다.
 * `detailView`(`view.ts`)와 같은 이유로 `document !== null` 로 좁힌다 -
 * `status` 로는 `JsonApiResult` 의 판별자가 섞여 있어 좁혀지지 않는다.
 */
function documentObject(result: JsonApiResult<SingleDocument> | null): ResourceObject | null {
  if (result === null) return null
  if (!result.ok) return null
  if (result.document === null) return null
  return result.document.data
}

/**
 * 응답 값 하나를 폼이 받을 수 있는 원값 문자열로. **표시 문자열이 아니다** -
 * `view.ts` 의 `formatAttributeValue` 와 정반대 방향이다. enum 은 백엔드가
 * 이미 라벨이 아니라 원래 값(`active`)을 주므로 그대로 문자열화하면 되고
 * (라벨을 붙이는 것은 화면이 **읽을 때만** 하는 일이라 `EnumValue` 조회가
 * 여기 필요 없다), `int` 는 `Number` 를 문자열로 되돌린다. 이 변환을
 * 폼 입력이 만드는 모양(전부 문자열)과 맞춰야 `<select>`·`<input>` 이 기존
 * 값을 그대로 고른 채로 그려진다(R7 이 이 함수가 필요해진 이유).
 *
 * `datetime` 은 이 함수를 지나가지 않는다 - `formAttributes` 가 이미
 * `readOnly` 인 그 속성을 걸러내기 때문이다(오늘 선언에서 `datetime` 은
 * 전부 `readOnly: true`). 그 전제가 깨져(쓰기 가능한 `datetime` 속성이
 * 생겨) 이 함수에 닿아도 원문 문자열을 그대로 돌려주므로 죽지는 않는다 -
 * `formatDateTime` 처럼 다시 포맷하지 않을 뿐이다.
 */
function rawAttributeValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value)
  }
  return JSON.stringify(value) ?? ''
}

/**
 * `Array.isArray` 는 `ResourceIdentifier | readonly ResourceIdentifier[]`
 * 를 음성 분기에서 좁히지 못한다(`lib/jsonapi/normalize.ts` 의
 * `isIdentifierArray` 와 같은 TS 제약 - 그 함수는 비공개라 가져올 수 없어
 * 같은 모양으로 다시 둔다). 런타임 검사는 `Array.isArray` 그대로 쓰고
 * 반환 타입만 직접 선언해서 우회한다.
 */
function isIdentifierArray(
  data: ResourceIdentifier | readonly ResourceIdentifier[],
): data is readonly ResourceIdentifier[] {
  return Array.isArray(data)
}

/**
 * 관계 하나의 선택된 id 들. **linkage 만 읽는다 - `resolveToOne`·
 * `resolveToMany`(`lib/jsonapi/normalize.ts`)를 쓰지 않는다.** 그 둘은
 * `included` 색인이 있어야 하고 **표시 이름**을 만드는 함수다(`relatedText`
 * 의 재료, 그 파일 머리말). 폼이 되돌릴 값은 **id 뿐**이고, id 는
 * `data.relationships[name].data` 의 linkage 에 `include` 여부와 무관하게
 * 그대로 있다 - 그래서 이 함수는 `included` 유무에 기대지 않는다
 * (`detailRequest` 가 `include` 를 반드시 실어야 하는 것과는 다른 이유다 -
 * 그건 **표시 이름** 을 위해서다).
 */
function relationshipIds(relationship: RelationshipObject | undefined): readonly string[] {
  const data = relationship?.data
  if (data === undefined || data === null) return []
  return isIdentifierArray(data) ? data.map((identifier) => identifier.id) : [data.id]
}

/**
 * 폼의 초기값. `result` 가 `null` 이면 생성 화면의 빈 값이고, 아니면 수정
 * 화면이 기존 값을 채운다 - **`detailView` 와 같은 입력을 받는다**(계획
 * 정정 R7, 이 파일 머리말). 응답 문서를 한 번만 읽어 표시와 폼 초기값을
 * 둘 다 만들 수 있다.
 *
 * `formAttributes` 로 속성을 화이트리스트하므로 **`datetime` 은 담기지
 * 않는다**(읽기 전용이라 폼에 없다 - `rawAttributeValue` 의 그 절 참고).
 */
export function initialFormValues(
  resource: ResourceDefinition,
  result: JsonApiResult<SingleDocument> | null,
): ResourceFormValues {
  const object = documentObject(result)

  const attributes: Record<string, string> = {}
  for (const [name] of formAttributes(resource)) {
    attributes[name] = object === null ? '' : rawAttributeValue(object.attributes?.[name])
  }

  const relationships: Record<string, readonly string[]> = {}
  for (const name of Object.keys(resource.relationships)) {
    relationships[name] = object === null ? [] : relationshipIds(object.relationships?.[name])
  }

  return { attributes, relationships }
}
