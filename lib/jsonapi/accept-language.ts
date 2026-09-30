/**
 * 기기의 언어 목록으로 `Accept-Language` 값을 만든다 - 스펙 9.4.
 *
 * 입력은 expo-localization 의 `getLocales()` 가 주는 BCP 47 태그들이다(앞이 우선). 앞에서부터
 * 품질값을 1, 0.9, 0.8 … 로 낮춰 붙인다 - 세 백엔드 모두 품질값을 1순위, 등장 순서를 뒤 순위로
 * 삼아 기본 하위 태그로 ko·en 을 고른다(2026-09-30 확인: FastAPI `resolve_language`, NestJS
 * `language.ts`, Rails `jsonapi_errors.rb`). 태그를 고치지 않는다 - `ko-KR` 에서 `ko` 를 가려
 * 읽는 것은 백엔드의 몫이다.
 *
 * 형식에 맞지 않는 태그는 뺀다 - 헤더에 개행 같은 값이 들어가면 요청 조립이 실패한다(client.ts 의
 * REQUEST_ASSEMBLY_FAILED). 쓸 태그가 하나도 없으면 null 이다 - 헤더를 싣지 않는다.
 */

/** 품질값이 0 이 되기 전까지 - 1, 0.9 … 0.1 의 열 개. q=0 은 "받지 않는다"는 뜻이다(RFC 9110). */
export const MAX_ACCEPT_LANGUAGE_TAGS = 10

const LANGUAGE_TAG = /^[A-Za-z]{1,8}(?:-[A-Za-z0-9]{1,8})*$/

export function acceptLanguageFromLocales(tags: readonly string[]): string | null {
  const seen = new Set<string>()
  const chosen: string[] = []
  for (const raw of tags) {
    const tag = raw.trim()
    if (!LANGUAGE_TAG.test(tag)) continue
    const key = tag.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    chosen.push(tag)
    if (chosen.length === MAX_ACCEPT_LANGUAGE_TAGS) break
  }
  if (chosen.length === 0) return null
  return chosen
    .map((tag, index) => (index === 0 ? tag : `${tag};q=${((10 - index) / 10).toFixed(1)}`))
    .join(',')
}
