import type { RelationshipObject, ResourceIdentifier, ResourceObject } from './document'

/**
 * included 색인과 관계 해석.
 *
 * JSON:API 는 included 를 문서 전체에서 중복 없이 한 번만 담으므로, 여러
 * 자원이 같은 관계 대상을 가리키면 색인 하나로 전부 해석된다.
 *
 * 색인 키가 type 과 id 를 함께 쓰는 것은 필수다 - JSON:API 에서 id 는 type
 * 안에서만 유일하고 type 을 가로질러서는 유일하지 않다. id 만으로 색인하면
 * 서로 다른 두 자원이 조용히 서로를 덮어쓴다.
 */

export type ResourceIndex = ReadonlyMap<string, ResourceObject>

/**
 * type 과 id 를 ':' 로 이어 붙인다. type 은 백엔드 스키마가 고정한 자원
 * 이름이고 id 는 UUID·정수 문자열이라(이 저장소의 모든 실측 픽스처가 그렇다)
 * 둘 중 어느 쪽도 ':' 를 담지 않는다 - 담는다면 서로 다른 (type, id) 쌍이
 * 같은 키로 충돌할 수 있지만, 그 전제가 이 저장소의 자원 정의 범위 밖이다.
 */
function keyOf(identifier: ResourceIdentifier): string {
  return `${identifier.type}:${identifier.id}`
}

/**
 * 같은 type+id 를 가진 자원이 여러 번 들어오면(스펙 위반) 나중 값이 이긴다 -
 * Map.set 을 순차 호출하는 구조상 다른 선택지가 없고, 이 저장소는 그 경우를
 * 위한 별도 정책(첫 값 유지·충돌 경고 등)을 요구하지 않는다.
 */
export function indexResources(resources: readonly ResourceObject[] | undefined): ResourceIndex {
  const index = new Map<string, ResourceObject>()
  for (const resource of resources ?? []) index.set(keyOf(resource), resource)
  return index
}

/**
 * **응답 문서의** 자원 식별자 객체가 가질 수 있는 멤버 전부.
 *
 * JSON:API 1.1 은 식별자 객체를 "`type` 을 반드시 갖고, `id` 또는 `lid` 중
 * 하나를 반드시 가지며, `meta` 를 가질 수 있다" 로 규정한다. 반면 자원 객체는
 * `attributes` · `relationships` · `links` 를 더 가질 수 있다. 아래
 * `isResourceObject` 가 기대는 것이 이 비대칭이다.
 *
 * **`meta` 는 이 저장소의 타입이 아니라 명세를 근거로 넣었다.** `document.ts`
 * 의 `ResourceIdentifier` 는 `{type, id}` 뿐이라, 그 파일만 보면 근거 없는
 * 원소로 보인다. 넣어 둔 쪽이 옳다 - 여기 들어오는 값은 타입 선언이 아니라
 * `JSON.parse` 가 만든 것이고, `{type, id, meta}` 인 linkage 를 백엔드가
 * 보내면 그것은 식별자다. 빼면 그 linkage 를 자원 객체로 오판한다.
 *
 * **`lid` 는 일부러 넣지 않았고, 그래서 이 집합은 "요청 문서까지 포함해 닫혀
 * 있다" 가 아니다.** `lid`(local id, 1.1 에서 추가)는 아직 서버에 없는 자원을
 * **요청 문서 안에서** 가리키는 클라이언트 발신 멤버다. 이 파일의 `hydrate`
 * 가 보는 것은 백엔드가 준 **응답**뿐이라 오늘은 도달하지 않는다. **그 전제가
 * 깨지면**(요청 문서를 이 술어에 넣게 되면) `{type, lid}` 인 식별자가 자원
 * 객체로 오판된다 - 그때는 `lid` 를 여기 더해라.
 */
const IDENTIFIER_MEMBERS: ReadonlySet<string> = new Set(['type', 'id', 'meta'])

/**
 * `hydrate` 가 돌려준 값이 **완전한 자원 객체**인가(계획 항목 [25]).
 *
 * `resolveToOne`·`resolveToMany` 의 반환 타입이 `ResourceObject |
 * ResourceIdentifier` 라 첫 소비자(D3 의 목록 화면)가 둘을 구별해야 한다.
 *
 * ## 무엇을 근거로 구별하는가 - "식별자에 올 수 없는 멤버가 있는가"
 *
 * **응답 문서의** 식별자 객체는 위 `IDENTIFIER_MEMBERS` 로 닫혀 있다. 따라서
 * 그 셋 밖의 멤버가 하나라도 있으면 그것은 식별자가 아니라 자원 객체다 -
 * 이 방향에는 **응답만 본다는 전제 아래** 거짓 양성이 없다. 그 전제가 왜
 * 필요한지(`lid`)는 그 집합의 주석에 있다.
 *
 * ## 왜 `'attributes' in x` 가 아닌가
 *
 * `attributes` 는 자원 객체의 **선택** 멤버다. 그래서 `'attributes' in x` 는
 * `relationships` 나 `links` 만 가진 자원 객체를 식별자로 오판하고, 그때
 * 호출자는 실제로 들고 있던 관계·링크를 잃는다. 이 파일의 예전 주석이
 * 경고하던 것이 정확히 그 자리다.
 *
 * ## 남는 거짓 음성이 왜 안전한가
 *
 * 이 술어가 틀리는 유일한 경우는 **멤버가 `{type, id, meta}` 뿐인 자원
 * 객체**다. 그런 객체에는 `attributes` 도 `relationships` 도 `links` 도 없다 -
 * 즉 자원 객체 갈래에서 읽을 것이 애초에 하나도 없고, 두 갈래가 그릴 수 있는
 * 것이 `type` 과 `id` 로 완전히 같다. **구별이 관측 가능한 차이를 만들지 않는
 * 경우에만 틀린다**는 것이 이 근거의 전부다. `'attributes' in x` 의 오판은
 * 그렇지 않다 - 거기서는 잃는 것이 실재한다.
 *
 * **이 안전성은 "두 갈래가 `type`·`id` 밖에 쓰지 않는다" 에 기댄다.** 소비자가
 * 한 갈래에만 무언가를 더 붙이기로 정하는 순간 두 갈래의 결과가 갈리고 위
 * 거짓 음성이 **처음으로 관측 가능해진다.**
 *
 * **D3 Task 6 이 이 문단을 읽고 판단했고, 전제는 그대로다.** 그 태스크가
 * 상세 화면에서 관계 대상에 **링크를 붙이지 않기로** 정했기 때문이다 - 이
 * 앱에는 분류·라벨의 화면이 없고 선언의 `path` 는 백엔드 API 경로라 화면
 * 주소가 아니다(근거는 `lib/resources/view.ts` 의 `detailFields`). 네 갈래가
 * 전부 글자 하나로 남으므로 구별이 여전히 관측 가능한 차이를 만들지 않는다.
 *
 * **다음에 이 전제를 건드릴 사람에게:** 분류·라벨의 화면이 생겨(D4 의 관계
 * 선택기가 후보다) 링크를 붙이게 되면, 링크를 **이 술어의 분기 밖**에서
 * `type` 과 `id` 만으로 만드는 한 전제는 여전히 유지된다. 자원 객체 갈래에만
 * 링크를 붙이는 구현을 고르면 그때 전제가 깨지고, 이 문단의 근거도 함께
 * 갱신해야 한다.
 *
 * `Object.keys` 를 쓰므로 프로토타입 체인이나 심볼 키는 보지 않는다.
 * 여기 들어오는 값은 전부 `JSON.parse` 가 만든 평범한 객체다(client.ts).
 *
 * ## `document.ts` 에도 같은 이름의 함수가 있다 - 합치지 마라
 *
 * 그쪽(비공개)은 `unknown` 을 받아 **"자원 객체처럼 생겼는가"**(type·id 가
 * 문자열인가)를 묻는다. 그 질문에는 식별자도 `true` 다. 여기서는 이미 둘 중
 * 하나임이 타입으로 확정된 값에 대해 **"어느 쪽인가"** 를 묻는다. 질문이 달라서
 * 답도 다르다.
 */
export function isResourceObject(
  value: ResourceObject | ResourceIdentifier,
): value is ResourceObject {
  return Object.keys(value).some((member) => !IDENTIFIER_MEMBERS.has(member))
}

/**
 * include 를 요청하지 않았거나 백엔드가 담지 않은 대상은 included 에 없다.
 * 그때는 식별자를 그대로 돌려준다 - 화면은 최소한 type 과 id 를 갖는다.
 *
 * 결과가 어느 쪽인지는 위 `isResourceObject` 로 판별한다.
 */
function hydrate(
  identifier: ResourceIdentifier,
  index: ResourceIndex,
): ResourceObject | ResourceIdentifier {
  return index.get(keyOf(identifier)) ?? identifier
}

/**
 * `Array.isArray`의 타입 서명은 `arg is any[]`로 고정돼 있어, `RelationshipObject.data`
 * 처럼 유니온에 `readonly ResourceIdentifier[]`가 섞여 있으면 좁히지 못한다(음성
 * 분기에서 배열 쪽을 제대로 제외하지 못해 `hydrate`에 배열이 여전히 섞인 유니온이
 * 넘어간다). 런타임 검사는 `Array.isArray` 그대로 쓰고 반환 타입만 직접 선언해서
 * 우회한다.
 */
function isIdentifierArray(
  data: ResourceIdentifier | readonly ResourceIdentifier[],
): data is readonly ResourceIdentifier[] {
  return Array.isArray(data)
}

export function resolveToOne(
  relationship: RelationshipObject | undefined,
  index: ResourceIndex,
): ResourceObject | ResourceIdentifier | null {
  const data = relationship?.data
  if (data === undefined || data === null) return null
  if (isIdentifierArray(data)) {
    throw new Error('resolveToOne expected a to-one relationship but got an array')
  }
  return hydrate(data, index)
}

export function resolveToMany(
  relationship: RelationshipObject | undefined,
  index: ResourceIndex,
): (ResourceObject | ResourceIdentifier)[] {
  const data = relationship?.data
  if (data === undefined || data === null) return []
  if (!isIdentifierArray(data)) {
    throw new Error('resolveToMany expected a to-many relationship but got a single identifier')
  }
  return data.map((identifier) => hydrate(identifier, index))
}
