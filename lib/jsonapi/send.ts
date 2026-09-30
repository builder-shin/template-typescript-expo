import type { JsonApiResult, RequestOptions } from './client'

/**
 * 백엔드 요청 하나를 보내는 함수의 모양 - `request()`(client.ts)와 같다.
 *
 * 인증 호출(lib/auth 의 가입·로그인·회전·로그아웃)은 `request()` 를 직접 부르지 않고 이 모양의
 * 함수를 인자로 받는다. 앱에서는 platform/api.ts 가 조립한 클라이언트가 들어온다 -
 * Accept-Language 를 싣는 자리가 그 한 곳이다(스펙 9.4). 호출부마다 언어 값을 인자로 넘기던
 * 원본(template-typescript-nextjs)의 모양에서는 그 인자를 null 로 바꾸는 뮤턴트가 게이트를
 * 전부 통과했다.
 */
export type JsonApiSend = <T>(path: string, options?: RequestOptions) => Promise<JsonApiResult<T>>
