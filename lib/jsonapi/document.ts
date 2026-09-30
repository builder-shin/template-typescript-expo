/**
 * JSON:API 1.1 문서의 타입과 판별.
 *
 * 이 파일은 자원을 모른다 - 'examples' 같은 자원 이름 문자열이 여기 나타나면
 * 계층 위반이다(스펙 4장). 백엔드 템플릿들의 app/jsonapi/ 와 마주 보는 계층이다.
 *
 * 타입은 실제 정본 응답을 캡처해서 맞췄다(test/fixtures/documents.ts). 특히:
 * - ErrorObject.status 는 숫자가 아니라 문자열이다("422").
 * - links 의 없는 항목은 키가 사라지는 게 아니라 null 이다.
 * - source 는 통째로 없을 수 있다(RESOURCE_NOT_FOUND).
 */

export type Meta = Record<string, unknown>
export type Attributes = Record<string, unknown>

/** 없는 링크는 키 삭제가 아니라 null 로 온다. */
export type Links = Record<string, string | null>

export interface RelationshipLinks {
  self?: string | null
  related?: string | null
}

export interface JsonApiInfo {
  version?: string
  meta?: Meta
}

export interface ResourceIdentifier {
  type: string
  id: string
}

export interface RelationshipObject {
  /**
   * to-one 은 객체 또는 null, to-many 는 배열. 키 자체가 없을 수도 있다.
   *
   * 배열은 `readonly`다 - 클라이언트 입장에서 관계 데이터는 읽기 전용이고,
   * `test/fixtures/documents.ts`의 `as const` 픽스처가 만드는 readonly 튜플을
   * 캐스팅 없이 그대로 받아들이려면 이래야 한다(mutable `ResourceIdentifier[]`로
   * 두면 `as never` 캐스팅이 필요해진다 - normalize.ts의 타입가드 참고).
   */
  data?: ResourceIdentifier | readonly ResourceIdentifier[] | null
  links?: RelationshipLinks
  meta?: Meta
}

export interface ResourceObject {
  type: string
  id: string
  attributes?: Attributes
  relationships?: Record<string, RelationshipObject>
  links?: Links
  meta?: Meta
}

export interface ErrorSource {
  pointer?: string
  parameter?: string
  header?: string
}

export interface ErrorObject {
  /** 문자열이다. "422" 처럼 온다. */
  status?: string
  code?: string
  title?: string
  detail?: string
  source?: ErrorSource
  meta?: Meta
}

export interface ErrorDocument {
  errors: ErrorObject[]
  jsonapi?: JsonApiInfo
  meta?: Meta
  links?: Links
}

interface DataDocumentBase {
  included?: ResourceObject[]
  links?: Links
  meta?: Meta
  jsonapi?: JsonApiInfo
}

export interface SingleDocument extends DataDocumentBase {
  data: ResourceObject | null
}

export interface CollectionDocument extends DataDocumentBase {
  data: ResourceObject[]
}

export type DataDocument = SingleDocument | CollectionDocument
export type JsonApiDocument = DataDocument | ErrorDocument

/**
 * 배열을 레코드로 오인하지 않도록 배제한다.
 *
 * 이 배제는 현재 아무 테스트로도 구별되지 않는다 - 지운다고 지금 테스트가
 * 깨지지는 않는다. 이 함수를 소비하는 네 곳(isErrorDocument·
 * isCollectionDocument·isSingleDocument·isResourceObject)이 전부 이 함수를
 * 통과한 직후 .errors/.data/.type/.id 라는 이름 있는 속성을 확인하는데,
 * JSON.parse 가 만드는 배열은 그런 이름 있는 속성을 가질 수 없어서 실제
 * JSON 응답으로는 이 분기가 있으나 없으나 같은 결과가 나온다. 그래도
 * 남겨 두는 이유는, 이름 있는 속성 확인 없이 이 함수의 결과만으로 "배열이
 * 아니다"를 곧바로 신뢰할 미래의 소비자를 위해서다 - 그런 소비자가 생기는
 * 순간 이 배제가 실제로 의미를 갖는다.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * `normalize.ts` 에 같은 이름의 **공개** 함수가 있다. 합치지 마라 - 질문이
 * 다르다. 여기서는 아직 아무것도 모르는 `unknown` 에 대해 "자원 객체처럼
 * 생겼는가" 를 묻고, 그 질문에는 식별자 객체도 `true` 다(식별자도 type·id 가
 * 문자열이다). 저쪽은 이미 둘 중 하나임이 확정된 값에 대해 "어느 쪽인가" 를
 * 묻는다.
 */
function isResourceObject(value: unknown): value is ResourceObject {
  return isRecord(value) && typeof value.type === 'string' && typeof value.id === 'string'
}

/**
 * JSON:API 는 errors 를 "비어 있지 않은 배열"로 규정한다. 빈 배열을 오류로
 * 받아들이면 무엇이 잘못됐는지 아무도 모르는 오류가 만들어지므로 거절한다.
 *
 * 원소 하나하나가 레코드인지도 확인한다(실측된 접합부 결함) - 그러지 않으면
 * `{"errors":[null]}` 같은 계약 위반 응답이 이 술어를 통과해 client.ts 가
 * `[null]`을 `ErrorObject[]`로 그대로 반환하고, errors.ts 의 groupErrors·
 * actionForErrors 가 `null.detail`·`null.code`를 읽다가 TypeError 로 던진다.
 * 원소 하나라도 레코드가 아니면 배열 전체를 거절한다 - 부분적으로만 올바른
 * 배열을 통과시키면 호출자가 나머지 원소만 믿고 인덱스를 놓칠 수 있다.
 *
 * 필드 각각의 타입(status 가 문자열인지 등)까지는 검사하지 않는다 - ErrorObject
 * 의 모든 필드가 선택이라 `{}`도 구조적으로 유효한 오류 객체이고(actionForErrors·
 * groupErrors 둘 다 `{}`를 이미 안전하게 다룬다), 이 술어가 보장해야 할 것은
 * "다운스트림이 던지지 않는다"이지 "필드가 스펙대로 채워졌다"가 아니다.
 */
export function isErrorDocument(value: unknown): value is ErrorDocument {
  return (
    isRecord(value) &&
    Array.isArray(value.errors) &&
    value.errors.length > 0 &&
    value.errors.every(isRecord)
  )
}

export function isCollectionDocument(value: unknown): value is CollectionDocument {
  return isRecord(value) && !isErrorDocument(value) && Array.isArray(value.data)
}

export function isSingleDocument(value: unknown): value is SingleDocument {
  if (!isRecord(value) || isErrorDocument(value)) return false
  return value.data === null || isResourceObject(value.data)
}
