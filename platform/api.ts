import { getLocales } from 'expo-localization'

import { variantProfile } from '@/lib/config/app-variant'
import { acceptLanguageFromLocales } from '@/lib/jsonapi/accept-language'
import {
  request,
  withAcceptLanguage,
  type JsonApiResult,
  type RequestOptions,
} from '@/lib/jsonapi/client'
import { httpFailureLine } from '@/lib/jsonapi/failure-log'
import type { JsonApiSend } from '@/lib/jsonapi/send'
import { startupVariant } from '@/platform/config'

/**
 * 기기의 언어 목록(getLocales)으로 만든 Accept-Language 값 - 부를 때마다 다시 읽는다(앱이 켜진 채
 * 언어를 바꿔도 다음 요청이 따른다). 쓸 태그가 없으면 null 이다. 조립 규칙은
 * lib/jsonapi/accept-language.ts 가 갖는다.
 */
export function deviceAcceptLanguage(): string | null {
  return acceptLanguageFromLocales(getLocales().map((locale) => locale.languageTag))
}

/**
 * 앱의 API 클라이언트 - 모든 백엔드 요청이 이 함수를 지난다(스펙 8.4·9.4).
 *
 * Accept-Language 를 싣는 자리가 **여기 하나**다. 값은 요청마다 기기 언어(deviceAcceptLanguage)다.
 * 호출자가 언어를 정했으면 그 값을 싣는다 - 기기 언어로 덮지 않는다. 언어를 정하는 호출자는 계약
 * 실험실(lib/lab/run.ts)뿐이다: 언어 협상 실험이 같은 오류를 ko·en 으로 비교하고(스펙 8.6), 나머지
 * 실험은 결과의 "보낸 요청 헤더" 에 적으려고 기기 언어를 명시해 싣는다.
 *
 * e2e 변형은 2xx 가 아닌 결과를 표식과 함께 기기 로그에 남긴다 - E2E 하네스가 플로가 선언하지
 * 않은 4xx·5xx 를 실패로 만드는 재료다(스펙 11.3). 어느 변형이 남기는지는 변형 표가 정한다.
 */
export const apiRequest: JsonApiSend = async <T>(
  path: string,
  options: RequestOptions = {},
): Promise<JsonApiResult<T>> => {
  const result = await request<T>(
    path,
    withAcceptLanguage(options, options.acceptLanguage ?? deviceAcceptLanguage()),
  )
  if (!result.ok && variantProfile(startupVariant()).logsHttpFailures) {
    console.info(httpFailureLine(options.method ?? 'GET', path, result.status, result.errors))
  }
  return result
}
