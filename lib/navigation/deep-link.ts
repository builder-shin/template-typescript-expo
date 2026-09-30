/**
 * 밖에서 들어온 딥링크를 앱 안 주소로 바꾸는 판단 - 스펙 8.2("딥링크 하나로 같은 목록이 재현된다").
 *
 * Expo Router 57.0.24 는 밖에서 들어온 URL 을 앱 안 주소(`router.push(주소)`)와 다르게 푼다.
 * `build/fork/extractPathFromURL.js` 의 `fromDeepLink` 가 쿼리를 `searchParams` 로 한 번 디코딩한 값에
 * `safeDecodeURIComponent` 를 한 번 더 걸고, 다시 인코딩하지 않은 채 `이름=값` 을 `&` 로 이어 붙인다. 그 문자열을
 * 라우터가 다시 풀면 값의 `+` 는 공백이, `&` 는 다음 파라미터의 시작이, `#` 은 조각(fragment)의 시작이 된다 -
 * 값에 그런 글자가 든 목록 딥링크가 조건을 재현하지 못한다(docs/superpowers/notes/2026-09-30-d3-measurements.md
 * 의 L1).
 *
 * `/` 로 시작하는 주소는 `fromDeepLink` 가 그대로 돌려준다(상대 주소라 `new URL(주소)` 가 던지고, 그 갈래가 주소를
 * 그대로 준다). 그래서 이 앱의 scheme 으로 들어온 링크를 `/` 로 시작하는 앱 안 주소로 바꿔 넘기면 딥링크가 앱 안의
 * 이동과 같은 해석을 지난다. 쿼리와 조각은 받은 글자 그대로 둔다 - 풀지도 다시 인코딩하지도 않는다.
 * `app/+native-intent.tsx` 가 이 함수를 라우터에 잇는다.
 */

/** `<scheme>://<나머지>` - scheme 의 글자는 RFC 3986 3.1 을 따른다. */
const SCHEME_URL = /^([A-Za-z][A-Za-z0-9+.-]*):\/\/(.*)$/s

/**
 * 개발 클라이언트가 이 앱의 scheme 으로도 보내는 링크의 호스트(`<scheme>://expo-development-client/?url=…`). Expo
 * Router 의 `fromDeepLink` 가 이 호스트를 알아보고 `url` 파라미터(개발 서버의 주소)를 따로 푼다 - 앱 안 주소로 바꾸면
 * 그 갈래를 지나지 못한다.
 */
const DEV_CLIENT_HOST = 'expo-development-client'

/**
 * 이 앱의 scheme(`schemes`, 대소문자를 가리지 않는다)으로 들어온 링크 `<scheme>://<호스트>/<경로>?<쿼리>` 를
 * `/<호스트>/<경로>?<쿼리>` 로 바꾼다. `<scheme>:///…` 처럼 호스트 자리가 빈 모양은 앞의 `/` 를 하나로 모은다.
 *
 * 이 앱의 scheme 이 아닌 주소 - `https://…`, 개발 클라이언트의 `exp+…://expo-development-client/?url=…`, 이미
 * 앱 안 주소인 `/…` - 와, 이 앱의 scheme 이어도 호스트가 `expo-development-client` 인 링크는 그대로 돌려준다.
 * 그런 주소는 Expo Router 가 원래대로 푼다.
 */
export function appPathFromDeepLink(url: string, schemes: readonly string[]): string {
  const match = SCHEME_URL.exec(url)
  if (match === null) return url
  const [, scheme = '', rest = ''] = match
  const own = schemes.some((known) => known.toLowerCase() === scheme.toLowerCase())
  if (!own) return url
  const host = /^[^/?#]*/.exec(rest)?.[0] ?? ''
  if (host.toLowerCase() === DEV_CLIENT_HOST) return url
  return `/${rest.replace(/^\/+/, '')}`
}

/**
 * 앱 설정의 `scheme`(`Constants.expoConfig.scheme` - 문자열 하나이거나 배열)을 목록으로 바꾼다. 없으면 빈 목록이다
 * - 그때는 어떤 딥링크도 바꾸지 않는다.
 */
export function schemesFromConfig(scheme: unknown): readonly string[] {
  if (typeof scheme === 'string') return [scheme]
  if (Array.isArray(scheme)) {
    return scheme.filter((entry): entry is string => typeof entry === 'string')
  }
  return []
}
