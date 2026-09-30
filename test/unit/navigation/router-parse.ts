/**
 * Expo Router 57 이 앱 안 주소에서 라우트 파라미터를 꺼내는 순서 그대로다(2026-09-30, expo-router
 * 57.0.24 설치본의 build/ 에서 읽었다). 목록 주소의 왕복 시험(test/unit/resources/view-expo.test.ts)과
 * 딥링크 정규화 시험(test/unit/navigation/deep-link.test.ts)이 같은 모형을 쓴다.
 *
 * 1. `fork/getStateFromPath-forks.js` 의 `parseQueryParams` - `new URL(주소, 'file:')` 의
 *    `searchParams` 에서 이름마다 `getAll`, 값이 하나면 문자열
 * 2. `hooks/useLocalSearchParams.js` - 값마다 `decodeURIComponent` 를 한 번 더(실패하면 그대로)
 *
 * 앱 안의 이동(`router.push(주소)`)이 이 해석을 지난다. 밖에서 들어온 딥링크는 Expo Router 가 먼저
 * 다르게 풀므로(`fork/extractPathFromURL.js` 의 `fromDeepLink` - 값을 두 번 디코딩하고 다시 인코딩하지 않는다)
 * `app/+native-intent.tsx` 가 `lib/navigation/deep-link.ts` 로 앱 안 주소로 바꿔 이 해석에 넘긴다. 기기 위의
 * 확인은 D1 실측 M2(인코딩한 대괄호 키의 딥링크)와 E2E 의 딥링크 플로다.
 *
 * 조각(`#…`)은 `parseQueryParams` 가 이름이 `#` 인 파라미터로 따로 싣는다 - 여기서는 쿼리만 꺼낸다.
 */
export function routeParamsOf(href: string): Record<string, string | string[]> {
  const searchParams = new URL(href, 'file:').searchParams
  const params: Record<string, string | string[]> = {}
  for (const name of new Set(searchParams.keys())) {
    const values = searchParams.getAll(name).map(decodeOnceMore)
    const [only] = values
    params[name] = values.length === 1 && only !== undefined ? only : values
  }
  return params
}

function decodeOnceMore(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}
