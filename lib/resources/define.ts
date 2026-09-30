/**
 * 자원 선언의 형태(스펙 5.1).
 *
 * 이 파일은 타입과 생성자만 갖는다. 값은 `example.ts` · `category.ts` ·
 * `tag.ts` 가 갖고, "그 값들이 존재한다"는 사실은 `index.ts` 가 갖는다.
 *
 * ## 이 선언은 백엔드 정책을 손으로 베낀 거울이다
 *
 * `filters` · `sorts` · `defaultSort` · `includes` 는 백엔드의 조회 정책을
 * 손으로 옮긴 것이다(스펙 5.1). 손으로 유지되는 거울은 반드시 어긋나므로 계약
 * 거울 테스트(스펙 10.2, D5)가 양방향으로 잡는다. 이 파일이 할 수 있는 일은
 * "어긋날 수 있는 자리"를 타입으로 최대한 좁혀 두는 것뿐이다 - 값이 백엔드와
 * 맞는지는 타입이 알 수 없다.
 *
 * ## 타입이 지키는 것 - 컴파일에서 죽는 오타
 *
 * - `filters` 의 연산자는 `FilterOperator` 다. `lib/jsonapi/query.ts` 가 실제로
 *   받는 것과 같은 타입이라 `'containss'` 는 컴파일되지 않는다.
 * - `sorts` · `filters` 의 키는 자유 문자열이 아니라 `QueryField` 어휘에서만
 *   나온다.
 * - `defaultSort` 는 그 자원의 `sorts` 안에 있어야 한다(`SortToken<S>`).
 * - `includes` 는 그 자원의 관계 이름이어야 한다. 관계가 없는 자원은
 *   `keyof R` 이 `never` 라 `[]` 말고는 아무것도 쓸 수 없다 - R-5 의 "참조
 *   자원의 include 는 빈 집합" 이 타입으로 강제된다.
 *
 * 타입이 지키지 못하는 것은 `test/unit/resources/invariants.ts` 의 구조적
 * 불변식이 런타임에서 지킨다. 둘은 겹치지만 겹침이 낭비는 아니다 - 타입은
 * 나중에 넓어질 수 있고, 넓어지는 순간 불변식만 남는다.
 *
 * ## JSX 도 fetch 도 없다
 *
 * 스펙 4장이 이 디렉터리에 배정한 것은 선언뿐이다. 선언은 데이터이므로 이
 * 디렉터리의 어떤 파일도 화면을 그리거나 네트워크를 부르지 않는다.
 *
 * ## 만들지 않기로 정한 것 - forms
 *
 * 스펙 5.1 의 형태에는 `forms: { create, update }` 가 있다. **만들지 않았고,
 * 앞으로도 만들지 않는다**(D4 판정 1 - 스펙 5.1·5.2 에 정정 註가 달려 있다).
 * 쓰기가 끝난 지금도 그 필드가 필요해지지 않았다:
 *
 * - 폼이 그릴 속성은 `formAttributes`(= `readOnly === false`), 필수는
 *   `isRequiredAttribute`(= `readOnly === false && nullable === false`)가
 *   이 파일에서 유도한다.
 * - 제약(`maxLength`·`minLength`·`min`·`max`·`values`)은 이미 `attributes`
 *   선언에 있다 - 스키마를 따로 두면 **같은 제약의 두 번째 거울**이 생긴다.
 *
 * 근거·전제·되살릴 조건 전부는
 * `docs/superpowers/plans/2026-09-08-create-update-delete.md` §3 판정 1.
 */

import type { FilterOperator } from '@/lib/jsonapi/query'

/**
 * 속성의 종류. R-2 를 표현하기에 충분한 최소 집합이다.
 *
 * `string` 과 `text` 는 JSON 타입이 같고 화면 표현만 다르다(한 줄 입력 대
 * 여러 줄). 백엔드가 둘을 구별하지 않으므로 이 구별은 프론트의 표시 결정이지
 * 계약의 거울이 아니다.
 */
export type AttributeKind = 'string' | 'text' | 'enum' | 'int' | 'datetime'

/** 종류와 무관하게 모든 속성이 갖는 것. 다섯 다 필수다 - 기본값에 숨지 않는다. */
interface AttributeBase {
  /** 화면에 보이는 이름. 백엔드에서 오지 않는다. */
  label: string
  /** 서버가 만드는 값이라 폼이 보낼 수 없는가(R-2 의 "읽기 전용" 열). */
  readOnly: boolean
  /** `null` 이 실제로 올 수 있는가. 화면이 빈 값을 그릴 준비를 해야 한다. */
  nullable: boolean
  /**
   * 목록 화면의 열로 그리는가.
   *
   * **왜 선언이 갖는가(D3 Task 3 의 판단).** 목록이 여섯 속성을 다 그릴
   * 필요는 없다 - 긴 본문은 표를 망가뜨리고, 서로 겹치는 시각 둘을 나란히
   * 그리는 것은 낭비다. 그런데 "어느 것을 뺄까" 는 **그 자원에 대한 지식**
   * 이다. 그 판단을 화면이나 `components/resource/` 가 하면 자원 이름·필드
   * 이름으로 분기하게 되어 스펙 4장을 어긴다(`components/resource/*` 에
   * 자원별 분기 금지). `kind` 로 대신하는 것(예: `text` 는 뺀다)도 답이 될 수
   * 없다 - 같은 `datetime` 둘 중 하나만 빼는 것 같은 판단을 표현하지 못한다.
   *
   * 그래서 `label` 옆에 둔다. 라벨과 같은 층위 - 둘 다 "이 속성을 사람에게
   * 어떻게 보일 것인가" 이고, 백엔드에서 오지 않는다.
   *
   * **선택 필드가 아니라 필수다.** 기본값을 두면 새 속성이 아무 결정 없이
   * 목록에 끼거나 빠지고, 그 결정이 어디서 났는지 읽는 사람이 알 수 없다.
   *
   * `false` 로 둔 속성도 상세 화면·폼에서는 그대로 쓰인다 - 이 표시가 말하는
   * 것은 **목록의 열**뿐이다.
   *
   * **이 값에는 백엔드 쪽 정본이 없다.** 이 파일 머리말은 선언을 "백엔드
   * 정책을 손으로 베낀 거울" 이라 부르고 어긋남은 D5 의 계약 거울 테스트가
   * 잡는다고 적는데, `listed` 에는 그 백스톱이 **해당되지 않는다** - 백엔드는
   * 어느 열을 보일지 모르므로 물어볼 대상이 없다. `AttributeBase` 에서
   * 유일하게 사람의 판단이 정본인 필드이고, 값이 옳은지는 `listed-empty`
   * 불변식(`test/unit/resources/invariants.ts`)과 사람의 눈이 전부다.
   */
  listed: boolean
}

/**
 * enum 값 하나. `value` 는 **백엔드가 주고받는 값 그대로**이고 `label` 이 사람이
 * 읽는 것이다.
 *
 * **왜 병렬 레코드가 아닌가.** 라벨을 `valueLabels: Record<string,string>` 로
 * 따로 두면 값과 라벨이 두 자리가 되어, 값 하나를 지울 때 라벨이 남고 값 하나를
 * 더할 때 라벨이 빈다. 그 어긋남은 타입도 빌드도 잡지 못한다. 한 배열에 묶으면
 * 그럴 자리 자체가 없다.
 *
 * `value` 는 백엔드 정책의 거울이고 `label` 은 아니다 - `AttributeBase.listed`
 * 와 같은 층위로, 사람의 판단이 정본이다. D5 의 계약 거울 테스트가 볼 것은
 * `value` 쪽뿐이다.
 */
export type EnumValue = { readonly value: string; readonly label: string }

/**
 * 속성 하나의 선언.
 *
 * `kind` 로 갈라지는 판별 유니온이라 종류마다 필요한 제약만 붙는다 -
 * `kind: 'enum'` 인데 `values` 가 없으면 컴파일되지 않고, 소비자는 `kind` 로
 * 좁히기만 하면 `values` 를 단언 없이 읽는다.
 */
export type AttributeDefinition =
  | (AttributeBase & { kind: 'string'; minLength?: number; maxLength?: number })
  | (AttributeBase & { kind: 'text'; minLength?: number; maxLength?: number })
  | (AttributeBase & { kind: 'enum'; values: readonly EnumValue[] })
  | (AttributeBase & { kind: 'int'; min?: number; max?: number })
  | (AttributeBase & { kind: 'datetime' })

/** 관계 하나의 선언. `type` 은 대상 자원의 JSON:API type 이다(경로가 아니다). */
export interface RelationshipDefinition {
  cardinality: 'one' | 'many'
  type: string
  label: string
}

/** 속성 이름 → 선언. 선언 순서가 곧 화면의 기본 표시 순서다. */
export type AttributeMap = Readonly<Record<string, AttributeDefinition>>

/** 관계 이름 → 선언. JSON:API `relationships` 의 키와 같다. */
export type RelationshipMap = Readonly<Record<string, RelationshipDefinition>>

/**
 * 조회(필터·정렬)에 쓸 수 있는 필드 이름의 어휘. 세 갈래에서 나온다.
 *
 * 1. **선언된 속성 이름.** 대부분이 여기서 나온다.
 * 2. **`queryOnlyFields`.** 백엔드 조회 정책에는 있는데 속성으로 노출되지 않는
 *    이름. 참조 자원의 `createdAt` 이 실제로 그렇다(R-5) - 정렬은 되는데 값을
 *    받을 수 없다. 이것을 속성으로 선언해 버리면 목록 화면이 언제나 비어 있는
 *    열을 그리게 되므로 거울이 거짓이 된다.
 * 3. **`` `${관계이름}.id` ``.** FK 필터는 속성이 아니라 관계 이름으로
 *    노출된다 - Example 의 `category.id` 가 그렇다(R-4). 관계 선언에서
 *    유도하므로 `'categorie.id'` 같은 오타가 컴파일에서 죽는다.
 *
 * 1·3 은 다른 선언에서 유도되므로 오타가 죽는다. 2 는 자유 문자열이라 죽지
 * 않는다 - 죽지 않는 자리를 한 곳에 몰아 두면 "여기 적힌 이름은 백엔드에만
 * 근거가 있다" 가 선언을 읽는 사람 눈에 보인다.
 *
 * 정렬과 필터가 같은 어휘를 쓴다. 실제 정책은 둘이 다르지만(R-4: `updatedAt`
 * 은 정렬만, `description` 은 둘 다 안 됨) 그 차이는 어휘가 아니라 `sorts` 와
 * `filters` 에 무엇을 적었는가로 표현된다.
 */
export type QueryField<A extends AttributeMap, R extends RelationshipMap, E extends string> =
  (keyof A & string) | E | `${keyof R & string}.id`

/**
 * 정렬 토큰. `'title'` 은 오름차순, `'-title'` 은 내림차순이다.
 *
 * URL 의 `?sort=` 값과 백엔드가 받는 값이 모두 이 문자열이므로(스펙 8.1)
 * 선언도 같은 표현을 쓴다.
 *
 * **문법 자체는 이 디렉터리의 것이 아니다.** 앞의 `-` 는 JSON:API 정렬 문법이고,
 * 변환 함수 둘(`parseSortToken` · `formatSortToken`)은 `lib/jsonapi/query.ts` 에
 * `SortTerm` · `buildQuery` 와 함께 있다. **여기 다시 만들지 마라** - 문법이
 * 두 디렉터리로 갈라지면 고칠 때 절반만 고치게 된다.
 *
 * 이 **타입**만 여기 남는 이유: `F` 가 그 자원의 `sorts` 라서 자원을 안다.
 * `defaultSort` 를 그 자원의 정렬 키로 묶는 것이 이 타입이 하는 전부다.
 */
export type SortToken<F extends string> = F | `-${F}`

/**
 * `defineResource` 가 받는 것. 타입 인자는 전부 추론된다 - 선언하는 쪽은
 * `defineResource({ ... })` 라고만 쓴다.
 */
export interface ResourceInput<
  A extends AttributeMap,
  R extends RelationshipMap,
  E extends string,
  S extends QueryField<A, R, E>,
> {
  /** JSON:API 자원 타입. 응답 문서의 `data.type` 과 같아야 한다. */
  type: string
  /**
   * 이 자원의 URL. **`type` 에서 유도하지 마라**(R-1): `exampleCategories` 의
   * 경로는 `/api/v1/categories` 다. 두 값은 서로 독립이라 둘 다 적는다.
   */
  path: string
  attributes: A
  relationships: R
  /** 조회 정책에는 있으나 속성이 아닌 이름. 없으면 생략한다. `QueryField` 참고. */
  queryOnlyFields?: readonly E[]
  /**
   * 필드 이름 → 그 필드에 허용된 연산자. 백엔드 정책의 거울이다.
   *
   * `NoInfer<E>` 가 없으면 이 자리가 `E` 의 추론 지점이 되어, 어휘에 없는
   * 필터 이름을 적을 때마다 `E` 가 그 이름을 삼켜서 오타가 컴파일된다.
   * `queryOnlyFields` 만 `E` 를 정하게 둔다 - 그것이 "죽지 않는 이름을 한 곳에
   * 몰아 둔다" 는 `QueryField` 의 취지다.
   */
  filters: Partial<Readonly<Record<QueryField<A, R, NoInfer<E>>, readonly FilterOperator[]>>>
  sorts: readonly S[]
  /** 반드시 `sorts` 안의 이름이어야 한다. `NoInfer` 로 여기서는 `S` 를 추론하지 않는다. */
  defaultSort: SortToken<NoInfer<S>>
  /**
   * `?include=` 로 걸 수 있는 관계 이름. 중첩 경로(`category.parent`)는 이
   * 계약에 없다(R-4) - 필요해지면 이 타입을 넓히는 자리다.
   */
  includes: readonly (keyof R & string)[]
  /**
   * 이 자원에 쓰기 라우트가 있는가.
   *
   * **속성 단위의 `readOnly` 와 다른 층위다.** `readOnly` 는 "이 값을 서버가
   * 만드는가" 이고, 이것은 "이 자원을 만들거나 지울 수 있는가" 다. 참조 자원
   * 둘(`exampleCategories`·`exampleTags`)은 속성이 쓰기 가능해 보이지만 자원
   * 자체에 쓰기 라우트가 없다(스펙 6.2, 실측: `POST /api/v1/categories` → 405).
   *
   * **소비자는 관계 선택기다.** 이 표시가 없으면 선택기가 "새 분류 만들기" 를
   * 노출할 수 있고, 누르면 세 백엔드가 서로 다른 오류를 낸다(정본 405
   * `HTTP_ERROR` / NestJS 404 `HTTP_ERROR` / Rails 404 `RESOURCE_NOT_FOUND`).
   *
   * **선택 필드가 아니라 필수다.** `listed` 와 같은 이유 - 기본값을 두면 새
   * 자원이 아무 결정 없이 쓰기 가능해지거나 불가능해진다.
   */
  writable: boolean
}

/**
 * 선언 하나. 소비자(`app/` · `components/resource/`)가 읽는 형태다.
 *
 * 선언할 때의 정밀한 타입(어느 키가 실재하는가)은 `ResourceInput` 이 갖고,
 * 여기서는 문자열로 넓힌다. 이유 둘:
 *
 * 1. `RESOURCES` 가 서로 다른 자원을 한 배열에 담으려면 공통 타입이 필요하다.
 * 2. 넓은 쪽이 오히려 정직하다 - `filters` 에는 `category.id` 처럼 속성이 아닌
 *    키가 들어 있어서 `attributes[키]` 조회는 실제로 빗나갈 수 있다.
 *    `noUncheckedIndexedAccess` 가 그 자리에 `undefined` 를 주고, 소비자는
 *    분기를 쓰게 된다. 정밀한 타입은 그 분기가 필요 없는 것처럼 보이게 만든다.
 */
export interface ResourceDefinition {
  readonly type: string
  readonly path: string
  readonly attributes: AttributeMap
  readonly relationships: RelationshipMap
  readonly queryOnlyFields: readonly string[]
  readonly filters: Readonly<Record<string, readonly FilterOperator[]>>
  readonly sorts: readonly string[]
  readonly defaultSort: string
  readonly includes: readonly string[]
  readonly writable: boolean
}

/**
 * 선언을 만든다. 하는 일은 타입을 붙이고 `queryOnlyFields` 를 정규화하는 것뿐
 * 이다 - 검증하지 않는다.
 *
 * 런타임 검증을 두지 않는 이유: 선언은 전부 정적이라 잘못된 선언은 코드가
 * 도는 순간이 아니라 게이트에서 잡혀야 한다. import 시점에 던지면 단위
 * 테스트도 화면도 같이 죽어서 무엇이 틀렸는지 오히려 안 보인다. 구조적
 * 불변식은 `test/unit/resources/invariants.ts` 가 잰다.
 *
 * 필드를 하나 더할 때 고칠 자리는 `ResourceInput` · `ResourceDefinition` · 이
 * 함수 셋이다. 펼침(spread) 대신 필드를 하나씩 적는 이유가 그것이다 - 새
 * 필드는 반드시 이 함수를 지나가고, 지나갈 때 정규화가 필요한지 보게 된다.
 */
export function defineResource<
  A extends AttributeMap,
  R extends RelationshipMap,
  E extends string = never,
  S extends QueryField<A, R, E> = QueryField<A, R, E>,
>(input: ResourceInput<A, R, E, S>): ResourceDefinition {
  return {
    type: input.type,
    path: input.path,
    attributes: input.attributes,
    relationships: input.relationships,
    // 생략은 "조회 전용 필드가 없다"는 뜻이다. 소비자가 `?? []` 를 반복하지
    // 않도록 여기서 한 번만 편다.
    queryOnlyFields: input.queryOnlyFields ?? [],
    // `Partial<...>` 의 `| undefined` 는 "키는 있는데 값이 undefined" 를
    // 뜻하는데, 그런 선언은 `ResourceInput` 으로 만들 수 없다. 그대로 두면
    // `Object.entries(filters)` 를 도는 소비자마다 일어날 수 없는 분기를 쓰게
    // 되므로 여기서 좁힌다. 없는 키를 인덱스로 읽는 쪽은
    // `noUncheckedIndexedAccess` 가 여전히 `undefined` 를 준다.
    filters: input.filters as Readonly<Record<string, readonly FilterOperator[]>>,
    sorts: input.sorts,
    defaultSort: input.defaultSort,
    includes: input.includes,
    writable: input.writable,
  }
}

/**
 * 자원 하나의 **백엔드 경로**. 목록 경로 아래에 id 세그먼트 하나를 더한다.
 *
 * ## 화면 경로가 아니다
 *
 * `app/(app)/examples/paths.ts` 의 `detailPath` 와 혼동하지 마라 - 저쪽은
 * 브라우저 주소(`/examples/<id>`)이고 이쪽은 백엔드 요청 경로
 * (`resource.path` = `/api/v1/examples` 아래)다. 두 값은 우연히 닮았을 뿐
 * 서로 다른 세계이고, 소유자도 다르다(화면 경로는 `app/`, 자원 경로는 선언).
 *
 * ## `encodeURIComponent` 를 쓰는 이유
 *
 * `id` 에 `/` 나 `?` 가 섞이면 세그먼트 하나가 둘이 되거나 쿼리가 시작돼
 * **다른 라우트로 요청이 나간다.** 오늘 실전 id 는 UUID 라 차이가 없지만,
 * 이 값은 `params.id`(사용자가 주소창에 무엇이든 넣을 수 있다)에서 오기도
 * 한다 - 자세한 실측은 `lib/resources/view.ts` 의 `detailRequest` 주석.
 *
 * **한 자리에 모은 이유**(브랜치 리뷰 Minor-4): 같은 조립이
 * `detailRequest`(조회) · `updateExampleAction`(PATCH) ·
 * `deleteExampleAction`(DELETE) 세 곳에 흩어져 있었다. 이스케이프 규칙이
 * 바뀌는 날 셋을 다 고쳐야 하고, 하나만 고치면 조회는 되는데 저장이 404 가
 * 나는 식으로 갈린다.
 */
export function resourcePath(resource: ResourceDefinition, id: string): string {
  return `${resource.path}/${encodeURIComponent(id)}`
}

/**
 * 폼이 그리는 속성 - 선언 순서 그대로.
 *
 * `readOnly` 인 속성은 폼이 **보내서도 안 된다**: 정본은 `createdAt` 을 받으면
 * 무시하지 않고 422 를 낸다(실측). 응답 문서를 그대로 되돌려 보내는 편집 폼이
 * 깨지는 이유가 이것이고, 그래서 쓰기 문서는 이 목록으로 화이트리스트 조립한다.
 */
export function formAttributes(
  resource: ResourceDefinition,
): readonly (readonly [string, AttributeDefinition])[] {
  return Object.entries(resource.attributes).filter(([, attribute]) => !attribute.readOnly)
}

/**
 * 이 속성이 생성 시 필수인가.
 *
 * **`nullable` 에서 유도하는 것은 전제 위에 서 있다** - *"생성 시 필수 ⟺ 응답에서
 * null 불가"*. 오늘 정본의 여섯 속성에서 참이다(계획서 §3 판정 1 의 표).
 * 참이 아닌 속성이 생기는 날 선언에 `required` 를 더해라. 그 전까지 세 번째
 * 플래그는 `readOnly`·`nullable` 과 조용히 모순될 자리만 만든다.
 *
 * 전제가 깨져도 **조용히 틀리지 않는다** - 폼이 필수 칸을 선택으로 그리면
 * 백엔드가 422 를 내고 그 오류가 화면에 뜬다.
 */
export function isRequiredAttribute(attribute: AttributeDefinition): boolean {
  return !attribute.readOnly && !attribute.nullable
}
