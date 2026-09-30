/**
 * 목록 화면의 라우트 파라미터에서 목록이 읽는 것만 고른다 - 이 저장소가 더한 판단(원본에 없다).
 *
 * Expo Router 는 이동이 싣는 값도 라우트 파라미터에 섞는다. `router.dismissTo(주소, { withAnchor: true })`
 * (로그인·가입 뒤 복귀)는 잎 화면까지 `initial: false` 를 싣고, 그 값을 거르는 곳이 없어
 * `useLocalSearchParams()` 가 문자열 `'false'` 로 돌려준다(expo-router 57 의 `global-state/getNavigationAction.js`
 * 가 싣고 `useScreens.js` 가 그대로 넘긴다). 백엔드로는 가지 않지만(`view.ts` 의 `listQuery` 도 JSON:API 문법만
 * 고른다), 정렬·필터 적용·필터 지우기 주소는 남의 파라미터를 그대로 옮기므로(`view.ts` 의 `carriedParams`) 그
 * 값이 다음 목록 화면으로 따라간다. 원본(Next.js)은 손으로 친 남의 파라미터를 주소에 남기지만, 이 앱의 라우트
 * 파라미터에는 사용자가 친 것만 있지 않다.
 *
 * 이름이 정해진 파라미터만 읽는 화면(상세의 `id`)은 이 함수 없이 이름으로 꺼낸다 - 파라미터 전체를 펼치거나
 * 돌지 않는다.
 */

import { toBackendQuery } from '@/lib/jsonapi/query'

/** 라우트 파라미터 - `useLocalSearchParams()` 가 주는 모양. 값이 없는 키가 올 수 있다. */
type RouteParams = Readonly<Record<string, string | string[] | undefined>>

/**
 * 라우트 파라미터 가운데 JSON:API 쿼리 파라미터(`filter[…]`·`sort`·`page[…]`·`include` - `toBackendQuery` 가
 * 고르는 것)만 남긴다. 목록 화면은 라우트 파라미터를 이 함수에 먼저 통과시키고 `view.ts` 의 판단 함수에 넘긴다.
 * 값이 여럿이면 배열로, 하나면 문자열로 둔다(`useLocalSearchParams()` 와 같은 모양).
 */
export function listRouteParams(params: RouteParams): RouteParams {
  const defined: Record<string, string | string[]> = {}
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined) defined[name] = value
  }
  const kept = toBackendQuery(defined)
  const picked: Record<string, string | string[]> = {}
  for (const name of new Set(kept.keys())) {
    const values = kept.getAll(name)
    picked[name] = values.length === 1 ? (values[0] ?? '') : values
  }
  return picked
}

/** 이름마다 값들을 모은다 - 같은 이름의 값은 나온 순서대로다. */
function valuesByName(entries: Iterable<readonly [string, string]>): Map<string, string[]> {
  const grouped = new Map<string, string[]>()
  for (const [name, value] of entries) {
    const values = grouped.get(name)
    if (values === undefined) grouped.set(name, [value])
    else values.push(value)
  }
  return grouped
}

/**
 * 이동할 목록 주소가 지금 화면과 같은 조건인가. 같은데도 `router.push` 하면 같은 목록 화면이 한 벌 더 쌓여 뒤로 가기가
 * 같은 조건을 두 번 보여 준다 - 필터를 바꾸지 않고 "적용" 을 누르거나 걸린 필터가 없는데 "필터 지우기" 를 누르면 그렇다.
 *
 * 경로가 같고 쿼리를 푼 파라미터가 같으면 같다. 파라미터의 순서와 퍼센트 인코딩의 모양(`[` 를 `%5B` 로 쓰든 말든, 공백을
 * `+` 로 쓰든 `%20` 으로 쓰든)은 보지 않고, 한 이름에 값이 여럿이면 그 순서는 본다. 지금의 조건은 `listRouteParams` 를 거친
 * 값이다 - 이동이 싣는 값과 남의 파라미터는 조건이 아니다.
 */
export function isCurrentListHref(href: string, path: string, params: RouteParams): boolean {
  const at = href.indexOf('?')
  if ((at < 0 ? href : href.slice(0, at)) !== path) return false

  const target = valuesByName(new URLSearchParams(at < 0 ? '' : href.slice(at + 1)).entries())
  const current = valuesByName(
    Object.entries(listRouteParams(params)).flatMap(([name, value]) =>
      (Array.isArray(value) ? value : [value]).map((entry): [string, string] => [
        name,
        entry ?? '',
      ]),
    ),
  )

  if (target.size !== current.size) return false
  for (const [name, values] of target) {
    const others = current.get(name)
    if (others === undefined || others.length !== values.length) return false
    if (values.some((value, position) => value !== others[position])) return false
  }
  return true
}
