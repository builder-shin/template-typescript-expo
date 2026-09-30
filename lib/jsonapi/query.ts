/**
 * JSON:API 쿼리 파라미터 직렬화.
 *
 * 이 파일이 강제하는 것은 JSON:API 의 파라미터 문법이지 자원의 필터·정렬
 * 정책이 아니다. 스펙 3장("allowlist 강제")과 8.1("허용목록에 없는 파라미터는
 * 그대로 보낸다")은 서로 다른 allowlist 를 말한다.
 *
 * - 문법: filter[...] · sort · include · page[...] 네 가족만 백엔드로 나간다.
 *   utm_source 같은 남의 파라미터는 도달하지 않는다.
 * - 정책: filter[존재하지않는필드] 는 문법상 올바르므로 그대로 나가고,
 *   백엔드가 INVALID_FILTER 로 거절하며, 그 오류를 화면이 띄운다. 프론트가
 *   미리 걸러내면 백엔드 계약이 실제로 어떻게 반응하는지 볼 수 없게 된다.
 *
 * lib/jsonapi/ 는 자원 정책을 알 수 없으므로(스펙 4장) 다른 해석이 애초에
 * 불가능하다.
 *
 * 커서 문자열은 만들지 않는다(스펙 8.3). 백엔드가 links.next·links.prev 를
 * opaque 하게 발행하므로 프론트는 링크를 따라가기만 한다.
 */

export const FILTER_OPERATORS = [
  'exact',
  'contains',
  'gt',
  'gte',
  'lt',
  'lte',
  'in',
  'isNull',
] as const
export type FilterOperator = (typeof FILTER_OPERATORS)[number]

/** 정렬 파라미터의 이름. 만드는 쪽과 읽는 쪽이 같은 문자열을 써야 한다. */
export const SORT_PARAMETER = 'sort'

/** include 파라미터의 이름. */
export const INCLUDE_PARAMETER = 'include'

/** page 는 키 집합이 닫혀 있다. page[offset] 은 다른 방언이지 이 계약이 아니다. */
const PAGE_KEY_LIST = ['number', 'size', 'totals', 'after', 'before'] as const
export type PageKey = (typeof PAGE_KEY_LIST)[number]
const PAGE_KEYS: ReadonlySet<string> = new Set(PAGE_KEY_LIST)

/**
 * page 파라미터 하나의 이름.
 *
 * `buildQuery`(쿼리를 만드는 쪽)와 백엔드가 준 링크에서 page 조각을 꺼내는 쪽
 * (`lib/resources/view.ts` 의 페이지 이동)이 **같은 이름 규칙**을 써야 한다.
 * 한쪽만 고치면 링크를 따라가는 쪽이 자기가 찾는 파라미터를 못 찾아서, 버튼은
 * 켜져 있는데 눌러도 같은 쪽에 머문다 - 오류가 아니라 **아무 일도 일어나지
 * 않는** 모양이라 화면만 봐서는 원인을 알 수 없다. `filterParameter` 가 필터
 * 쪽에서 같은 이유로 존재한다.
 */
export function pageParameter(key: PageKey): string {
  return `page[${key}]`
}

/**
 * 결과 집합 안의 **위치**를 가리키는 page 키들. 나머지 둘(`size`·`totals`)은
 * 위치가 아니라 표현 방식이다.
 *
 * offset 모드의 `number` 와 커서 모드의 `after`·`before` 가 한 집합인 이유:
 * 셋 다 "어떤 결과 집합의 몇 번째" 를 뜻하므로 **그 집합이 달라지면 전부
 * 무의미해진다.** 커서는 특히 그렇다 - base64url 안에 정렬 서명이 들어 있어
 * 정렬이 바뀌면 같은 커서가 400 이 된다(스펙 8.3).
 */
const PAGE_POSITION_KEYS: ReadonlySet<string> = new Set(['number', 'after', 'before'])

const FILTER_PATTERN = /^filter\[([^[\]]+)\](?:\[([^[\]]+)\])?$/
const PAGE_PATTERN = /^page\[([^[\]]+)\]$/

/** `page[...]` 의 키. 이 파일이 아는 키가 아니면 `null`(예: `page[offset]`). */
function pageKeyOf(name: string): string | null {
  const match = PAGE_PATTERN.exec(name)
  if (match === null || match[1] === undefined) return null
  return PAGE_KEYS.has(match[1]) ? match[1] : null
}

function isJsonApiParameter(name: string): boolean {
  if (name === SORT_PARAMETER || name === INCLUDE_PARAMETER) return true
  if (isFilterParameter(name)) return true
  return pageKeyOf(name) !== null
}

function toSearchParams(
  input: URLSearchParams | Record<string, string | string[]>,
): URLSearchParams {
  if (input instanceof URLSearchParams) return input
  const params = new URLSearchParams()
  for (const [name, value] of Object.entries(input)) {
    if (Array.isArray(value)) {
      for (const item of value) params.append(name, item)
    } else {
      params.append(name, value)
    }
  }
  return params
}

/**
 * 들어온 쿼리에서 JSON:API 문법에 맞는 것만 골라 백엔드로 넘길 쿼리를 만든다.
 * 값은 손대지 않는다 - 빈 값도, 중복도 그대로 보낸다. 백엔드가 판정한다.
 */
export function toBackendQuery(
  input: URLSearchParams | Record<string, string | string[]>,
): URLSearchParams {
  const source = toSearchParams(input)
  const out = new URLSearchParams()
  for (const [name, value] of source.entries()) {
    if (isJsonApiParameter(name)) out.append(name, value)
  }
  return out
}

/**
 * 이 쿼리에 `filter[...]` 가족이 하나라도 있는가.
 *
 * 화면이 **"아직 아무것도 없다"** 와 **"필터가 걸려 0건이다"** 를 구별하는 데
 * 쓴다. 두 상태는 사용자가 해야 할 일이 다르다 - 앞은 자료를 만드는 것이고
 * 뒤는 필터를 지우는 것이다. 구별하지 않으면 필터를 걸어 둔 채 빈 화면을 보는
 * 사람이 자료가 없다고 오해한다.
 *
 * **`filter` 만 본다.** `sort` 는 결과 수를 바꾸지 않고, `page` 는 바꾸지만
 * 그것은 "범위를 벗어난 페이지" 라는 또 다른 상태라 페이지네이션을 만드는
 * 쪽이 자기 문맥으로 다룰 일이다. **D3 Task 5 가 그 자리를 채웠다** -
 * `lib/resources/view.ts` 의 `paginationView` 가 첫 쪽이 아님을 알려주고,
 * `components/resource/resource-table.tsx` 가 그때 다른 빈 상태를 그린다.
 * (범위를 벗어난 쪽은 오류가 아니라 **0건 200** 이다 - 2026-09-07 정본 실측.)
 *
 * 이 함수가 여기 있는 이유는 판정 근거가 **JSON:API 의 파라미터 문법**이기
 * 때문이다 - 어떤 자원인지 몰라도 정의된다(이 파일 머리말).
 */
export function hasFilterParams(params: URLSearchParams): boolean {
  for (const name of params.keys()) {
    if (isFilterParameter(name)) return true
  }
  return false
}

/**
 * 이 파라미터가 `filter[...]` 가족인가.
 *
 * **모르는 연산자도 참이다**(`filter[f][bogus]`). 판정 근거가 **문법**이지
 * 정책이 아니기 때문이다(이 파일 머리말) - 이름의 모양이 필터면 필터다.
 *
 * "필터 지우기" 가 이것을 쓴다. 그 컨트롤은 필터 바가 그릴 수 있는 것만이
 * 아니라 **URL 에 있는 필터 전부**를 지워야 한다 - 바가 표현하지 못하는 필터를
 * 남기면 사용자가 지우기를 눌러도 조건이 남고, 그것을 없앨 컨트롤이 화면에
 * 하나도 없다. `filterQuery`(다음 조건으로 이동)와는 판정이 다르다 - 그쪽은
 * 바가 **소유한** 이름만 다시 쓰고 나머지는 그대로 옮긴다(스펙 8.1).
 */
export function isFilterParameter(name: string): boolean {
  return FILTER_PATTERN.test(name)
}

/**
 * 이 파라미터가 `page[...]` 가족인가 - **이 계약이 아는 키만** 참이다.
 *
 * 백엔드가 준 링크의 page 조각을 화면 URL 로 옮길 때, 옛 page 값을 먼저 버리는
 * 데 쓴다. 버리지 않고 더하면 같은 파라미터가 두 번 나가서 400 이다.
 *
 * **`page[offset]` 같은 모르는 키는 거짓이다.** 그것은 이 계약의 page 가 아니라
 * 다른 방언이거나 손으로 친 값이다. `isJsonApiParameter` 가 **같은 집합**을
 * 쓰므로 그런 키는 백엔드에 **닿지 않는다** - 실측:
 *
 * ```ts
 * toBackendQuery({ 'page[offset]': '5', 'page[number]': '2' })
 * // → "page%5Bnumber%5D=2"      page[offset] 은 사라진다
 * ```
 *
 * **위 `isFilterParameter` 와 비대칭이고 그것이 의도다.** 모르는 *연산자*
 * (`filter[f][bogus]`)는 통과해서 백엔드가 `INVALID_FILTER` 로 판정하는데,
 * 모르는 *page 키* 는 여기서 걸러진다. 근거는 이 파일 머리말의 구분이다 -
 * `filter[...]` 는 **문법이 맞고 정책만 모르는** 이름이라 판정이 백엔드의
 * 것이고, `page[offset]` 은 **문법 자체가 이 계약에 없다**(page 는 키 집합이
 * 닫혀 있다 - 위 `PAGE_KEY_LIST`). 스펙 8.1 의 "허용목록에 없는 파라미터는
 * 그대로 보낸다" 는 정책 allowlist 를 말하는 것이지 문법을 말하지 않는다.
 *
 * 이 동작은 D3 Task 5 이전부터 그랬다 - 그 태스크는 판정을 함수로 뽑았을 뿐
 * 집합을 바꾸지 않았다.
 */
export function isPageParameter(name: string): boolean {
  return pageKeyOf(name) !== null
}

/**
 * 이 파라미터가 결과 집합 안의 **위치**를 가리키는가.
 *
 * 조건을 바꾸는 화면(필터·정렬)이 새 URL 을 만들 때 무엇을 버려야 하는지를
 * 판정하는 데 쓴다. 조건이 바뀌면 결과 집합이 달라지므로 옛 위치는 뜻을
 * 잃는다 - `page[number]=5` 를 그대로 들고 가면 다섯째 쪽이 없는 결과에서
 * **빈 목록**이 나오고, 사용자는 조건에 맞는 자료가 없다고 오해한다.
 * 커서(`page[after]`·`page[before]`)는 더 나빠서 400 이 될 수도 있다.
 *
 * 이 판정이 여기 있는 이유는 근거가 **JSON:API 의 page 문법**이기 때문이다 -
 * 어떤 자원인지 몰라도 정의된다(이 파일 머리말, `hasFilterParams` 와 같은
 * 자리다). *언제* 버릴지는 화면의 결정이라 여기서 정하지 않는다.
 */
export function isPagePositionParameter(name: string): boolean {
  const key = pageKeyOf(name)
  return key !== null && PAGE_POSITION_KEYS.has(key)
}

/**
 * 필터 하나의 쿼리 파라미터 이름.
 *
 * `exact` 만 연산자 세그먼트를 생략한다 - **`filter[f]=v` 와
 * `filter[f][exact]=v` 는 백엔드가 완전히 같게 읽는다**(실측 R-6). 짧은 쪽이
 * 공유하기 좋다.
 *
 * `buildQuery`(URL 을 만드는 쪽)와 화면(URL 에서 컨트롤 값을 되읽는 쪽)이
 * **같은 이름 규칙**을 써야 한다. 한쪽만 고치면 화면이 자기가 만든
 * 파라미터를 못 찾아서, 필터를 걸 때마다 옛 값이 지워지지 않고 쌓인다 -
 * 그리고 같은 필드+같은 연산자가 두 번 나가면 그게 400 이다(R-6).
 * 그래서 규칙을 이 함수 하나에 둔다.
 */
export function filterParameter(name: string, operator: FilterOperator): string {
  return operator === 'exact' ? `filter[${name}]` : `filter[${name}][${operator}]`
}

const FILTER_OPERATOR_SET: ReadonlySet<string> = new Set(FILTER_OPERATORS)

function isFilterOperator(value: string): value is FilterOperator {
  return FILTER_OPERATOR_SET.has(value)
}

/**
 * 파라미터 이름을 **중복 판정 키**로 접는다. 필터가 아니거나 모르는 연산자면
 * 원래 이름 그대로다.
 *
 * ## 왜 필요한가 - `exact` 는 이름이 둘이다
 *
 * `filter[f]` 와 `filter[f][exact]` 는 서로 다른 문자열인데 **백엔드는 같은
 * 필터로 읽는다**(R-6, 정본 소스의 `operator = raw_operator or "exact"`).
 * 그리고 백엔드가 중복을 세는 단위는 이름이 아니라 **(필드, 연산자)** 라,
 * 두 이름이 한 요청에 함께 나가면 그것이 400 이다.
 *
 * 즉 "이 파라미터를 내가 이미 만들고 있는가" 를 **이름으로** 판정하면
 * 별칭 하나가 빠져나간다: 화면이 `filter[f]` 를 만드는데 URL 에 손으로 친
 * `filter[f][exact]` 가 있으면 둘 다 나가서 **400 이 고착된다**(다시 눌러도
 * 같은 오류라 빠져나오는 길이 "필터 지우기" 뿐이다).
 *
 * 접은 뒤 비교하면 그 별칭이 닫힌다. 모르는 연산자(`filter[f][bogus]`)는 접지
 * 않고 그대로 둔다 - 화면이 만들 수 있는 이름이 아니므로 소유일 수 없고,
 * 스펙 8.1 대로 백엔드까지 가서 판정받아야 한다.
 */
export function canonicalFilterParameter(parameter: string): string {
  const match = FILTER_PATTERN.exec(parameter)
  if (match === null || match[1] === undefined) return parameter
  const operator = match[2] ?? 'exact'
  if (!isFilterOperator(operator)) return parameter
  return filterParameter(match[1], operator)
}

/**
 * 필터 하나의 입력. **연산자로 판별되는 합집합이다.**
 *
 * ## 왜 `isNull` 만 따로 떼어 놓았는가 (D3 Task 4 리뷰 라운드 1 의 Blocker)
 *
 * `isNull` 의 직렬화는 아래에서 **truthy 검사**로 이뤄지는데, 화면의 폼은
 * 값을 **문자열**로 준다. 문자열 `'false'` 는 JS 에서 truthy 라 그대로 넘기면
 * `isNull=true` 로 **뒤집혀** 나간다 - 그리고 그것은 백엔드 문법상 유효한
 * 값이라 **200 이 돌아온다.** 오류도 배너도 없이 정확히 여집합이 그려진다.
 *
 * 실제로 그 결함이 이 저장소에 한 번 들어왔고, 게이트 8/8 이 초록이었다.
 * 원인은 `buildQuery` 의 가드가 boolean 픽스처로만 세워져서 **테스트의 세계와
 * 프로덕션의 세계가 서로 다른 타입**이었다는 것이다.
 *
 * 그래서 값 변환이 아니라 **타입**으로 고쳤다. `isNull` 의 `value` 가
 * `boolean` 이면 호출부가 문자열을 넘기는 순간 컴파일이 죽고, 변환은 폼을 읽는
 * 자리(`lib/resources/view.ts` 의 `filterQuery`)에서 한 번만 일어난다.
 * 새 연산자가 생겨도 같은 함정이 재발하지 않는다.
 */
export type FilterInput =
  | { name: string; operator: 'isNull'; value: boolean }
  | {
      name: string
      operator: Exclude<FilterOperator, 'isNull'>
      value: string | number | boolean | readonly (string | number)[]
    }

/**
 * 정렬 항 하나. **`descending` 은 `boolean` 이고, 그것이 가드다.**
 *
 * ## 왜 이 한 줄에 주석이 붙는가 (D3 Task 4 의 Blocker 와 같은 함정)
 *
 * 아래 `formatSortToken` 이 `term.descending ? ... : ...` 로 **truthy 검사**를
 * 한다. 문자열 `'false'` 는 JS 에서 truthy 라, 그것이 이 자리에 들어오면
 * **정렬이 정확히 반대로 나가고** 그 토큰은 백엔드 문법상 유효해서 **200 이
 * 돌아온다.** 오류도 배너도 없이 뒤집힌 목록이 그려진다 - `isNull` 필터가
 * 여집합을 그렸던 그 결함과 같은 모양이다(`FilterInput` 주석).
 *
 * 여기서는 `boolean` 이 그 대입을 **컴파일에서** 막는다. 남는 위험은 딱 하나,
 * 호출부가 URL·폼의 문자열을 `Boolean(x)` 나 `!!x` 로 강제 변환해서 넣는
 * 것이다(`Boolean('false') === true`).
 *
 * **그래서 이 저장소의 정렬 UI 에는 방향을 따로 나르는 값이 아예 없다.**
 * 컨트롤이 다루는 값은 처음부터 끝까지 **토큰 문자열**(`'-name'`)이다.
 * `descending` 이 만들어지는 자리는 **둘뿐이고 둘 다 진짜 `boolean` 을 낸다**:
 *
 * 1. 아래 `parseSortToken` 의 `startsWith('-')` - 토큰을 **읽는** 쪽.
 * 2. `lib/resources/view.ts` 의 `sortOptions` 안 한 줄 - 다음 토큰을 **만드는**
 *    쪽(`!current.descending` 또는 속성 `kind` 비교).
 *
 * 즉 **문자열이 건널 경계 자체가 없다.** 두 자리가 서로를 가리키므로 셋째가
 * 생기면 양쪽 주석을 함께 고쳐라.
 *
 * 타입이 다시 느슨해지는 것은 `test/unit/jsonapi/query.test.ts` 의
 * `@ts-expect-error` 한 줄이 `TS2578` 로 스스로 신고한다.
 */
export interface SortTerm {
  name: string
  descending: boolean
}

/**
 * 정렬 토큰의 문법. `'field'` 는 오름차순, `'-field'` 는 내림차순이다.
 * (예시 이름을 일부러 중립적으로 쓴다 - 이 디렉터리에 실제 자원의 필드 이름이
 * 설명 주석으로라도 등장하면 "자원을 모른다" 규칙의 grep 감사를 사람이 매번
 * 판정해야 한다. AGENTS.md 가 그 함정을 실측해 두었다.)
 *
 * 이 문법이 여기 있는 이유: 앞의 `-` 는 **JSON:API 의 정렬 문법**이지 자원의
 * 것이 아니다. 자원마다 다른 값이 아니고, 자원을 하나도 몰라도 정의된다 -
 * 이 디렉터리가 가져도 되는 "JSON:API 문법 자체"에 해당한다(AGENTS.md).
 *
 * URL 의 `?sort=` 값과 백엔드가 받는 값이 모두 이 문자열이므로(스펙 8.1)
 * 화면은 URL 조각을 그대로 `parseSortToken` 에 넣고, 고른 정렬을 URL 로
 * 되돌릴 때 `formatSortToken` 을 쓴다.
 *
 * **두 방향이 한 자리에 붙어 있어야 한다.** 한쪽만 여기 있고 다른 쪽이 다른
 * 디렉터리에 있거나 `buildQuery` 안에 인라인으로 있으면, 문법을 고칠 때 절반만
 * 고치는 일이 생긴다.
 *
 * 어느 쪽도 **검증하지 않는다.** 이름이 그 자원의 정렬 정책에 있는지 보지
 * 않는다 - 이 파일 머리말의 원칙 그대로다. 정책에 없는 정렬은 백엔드가
 * `INVALID_SORT` 로 거절하고 화면이 그 오류를 띄운다.
 */
export function parseSortToken(token: string): SortTerm {
  return token.startsWith('-')
    ? { name: token.slice(1), descending: true }
    : { name: token, descending: false }
}

/** `parseSortToken` 의 역방향. `buildQuery` 가 `sort` 를 직렬화할 때 쓴다. */
export function formatSortToken(term: SortTerm): string {
  return term.descending ? `-${term.name}` : term.name
}

export interface PageInput {
  number?: number
  size?: number
  totals?: boolean
  after?: string
  before?: string
}

export interface QueryInput {
  filters?: readonly FilterInput[]
  sort?: readonly SortTerm[]
  include?: readonly string[]
  page?: PageInput
}

function serializeFilterValue(filter: FilterInput): string {
  if (filter.operator === 'in') {
    const values = Array.isArray(filter.value) ? filter.value : [filter.value]
    if (values.length === 0) {
      throw new Error(`"in" filter needs at least one value (field ${filter.name})`)
    }
    return values.map(String).join(',')
  }
  // `filter.value` 가 여기서는 boolean 이다 - 문자열이 오면 이 truthy 검사가
  // `'false'` 를 뒤집는데, 그 자리를 `FilterInput` 의 타입이 막는다.
  if (filter.operator === 'isNull') return filter.value ? 'true' : 'false'
  return String(filter.value)
}

export function buildQuery(input: QueryInput): URLSearchParams {
  const out = new URLSearchParams()

  for (const filter of input.filters ?? []) {
    out.append(filterParameter(filter.name, filter.operator), serializeFilterValue(filter))
  }

  const sort = input.sort ?? []
  // 빈 배열이면 파라미터를 아예 내지 않는다 - **`sort=` 는 400 이다**(2026-09-07
  // 정본 실측, R-8 의 INVALID_SORT). 쉼표 하나로 묶는 것도 여기서 정한다:
  // `sort` 를 두 번 내는 것도 400 이다(R-4).
  if (sort.length > 0) {
    out.set(SORT_PARAMETER, sort.map(formatSortToken).join(','))
  }

  const include = input.include ?? []
  if (include.length > 0) out.set(INCLUDE_PARAMETER, include.join(','))

  const page = input.page
  if (page !== undefined) {
    if (page.number !== undefined) out.set(pageParameter('number'), String(page.number))
    if (page.size !== undefined) out.set(pageParameter('size'), String(page.size))
    // 켤 때만 낸다 - 백엔드가 COUNT 를 피하려고 만든 계약이다(스펙 8.3).
    //
    // "=== true" 를 Boolean(page.totals) 같은 truthy 검사로 바꿔도 동작은
    // 같다 - 이 비교는 등가 뮤턴트다. PageInput.totals 의 타입이
    // boolean | undefined 라 런타임에 가능한 값이 true·false·undefined
    // 세 가지뿐이고, 이 세 값 전부에서 두 표현이 같은 참/거짓을 낸다(전수
    // 확인됨). 이 등가성은 totals 의 타입이 boolean | undefined 로 닫혀
    // 있다는 전제에만 기댄다 - 나중에 이 필드가 다른 falsy 값(0, '' 등)을
    // 허용하도록 타입이 넓어지면 두 표현은 더 이상 같지 않다.
    if (page.totals === true) out.set(pageParameter('totals'), 'true')
    if (page.after !== undefined) out.set(pageParameter('after'), page.after)
    if (page.before !== undefined) out.set(pageParameter('before'), page.before)
  }

  return out
}

/** 상대 경로 링크를 파싱하기 위한 자리표시자 오리진. 결과(`URLSearchParams`)에는 나타나지 않는다. */
const LINK_PARSE_ORIGIN = 'http://links.invalid'

/**
 * 백엔드가 준 링크 하나(`links.next` 등)의 쿼리만 뽑는다. 절대·상대 URL 둘 다
 * 받는다. 읽을 수 없는 값(URL 문법이 아닌 것)이 와도 던지지 않고 `null`을
 * 준다 - 호출자가 "이 링크는 못 쓴다"로 물러설 수 있게 한다.
 *
 * **두 방향의 소비자가 이 함수 하나를 공유한다** - `lib/resources/view.ts`의
 * `pageHref`·`pageNumberOf`(백엔드 링크 → 이 화면의 주소)와
 * `app/(lab)/contract/actions.ts`의 커서 순회(백엔드 링크 → 다음 백엔드
 * 요청)는 방향이 반대이지만 "링크 문자열에서 쿼리만 뽑는다"는 판단은
 * 하나다. `resourcePath`(`lib/resources/define.ts`)의 주석과 같은 이유로
 * 한 자리에 모았다 - 조립 규칙이 두 곳에 흩어지면 한쪽만 고치는 사고가 난다.
 * 커서 값 자체는 이 함수도 해석하지 않는다(스펙 8.3) - `URLSearchParams`가
 * 쥐는 것은 여전히 opaque 문자열이다.
 */
export function linkQuery(link: string): URLSearchParams | null {
  try {
    return new URL(link, LINK_PARSE_ORIGIN).searchParams
  } catch {
    return null
  }
}
