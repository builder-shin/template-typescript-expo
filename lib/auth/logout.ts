/**
 * 로그아웃 - 스펙 7.4 의 세 번째 흐름, Task 6.
 *
 * credentials.ts · rotation.ts 와 같은 모양이다: 백엔드를 실제로 부르는 얇은
 * 함수(revokeSession)와 그 응답을 해석하는 **순수 함수**
 * (interpretLogoutResult)를 나눈다. 그리고 이 파일은 `next/headers` 를
 * 모른다 - 쿠키를 지우는 것은 인자로 받은 콜백이 한다(endSession). 그
 * 덕분에 로그아웃의 판단 전부가 vitest 에서 관측된다.
 *
 * ## 실측 (2026-09-06, 정본 FastAPI @ 6ee53a3 를 로컬 컨테이너로 띄워 캡처)
 *
 * **이 파일이 실제로 내보내는 요청 그대로** 캡처했다 - accept·content-type 이
 * `application/vnd.api+json`, `accept-language` 를 실은 POST 다.
 *
 * ```
 * POST /auth/logout {data:{type:"refreshTokens",attributes:{refreshToken}}}
 *   -> 204, 본문 0바이트, Content-Type 헤더 없음
 * POST /auth/logout (같은 토큰 두 번째)             -> 204        <- 멱등이다
 * POST /auth/logout (Authorization: Bearer 를 얹어) -> 204        <- 무시된다
 * POST /auth/logout {data:{type:"refreshToken"}}    -> 422 VALIDATION_ERROR
 *                                                      source.pointer=/data/type
 * GET  /users/me   (로그아웃 전에 받은 access 토큰) -> 200        <- 여전히 통과한다
 * POST /auth/refresh (로그아웃한 refresh 토큰)      -> 401
 * ```
 *
 * **이 표는 유효한 refresh 토큰만 다룬다.** 유효하지 않거나 이미 만료된
 * 토큰으로 로그아웃하면 정본은 401 을 낸다 - 소스 판독 기준이다
 * (`logout_refresh_session` -> `_load_verified_refresh_session` 이
 * `RefreshSessionError` 를 돌려주고 컨트롤러가 그대로 던진다,
 * `app/auth/refresh_sessions.py`). **HTTP 로는 재지 않았다** - 백엔드를 다시
 * 띄우는 비용이 이 한 칸보다 크다고 판단했다. 위의 "멱등이다"도 그래서
 * *유효한* 토큰에 한정된 서술이다. 코드는 이 갈래를 이미 옳게 다룬다:
 * `notRevoked` + 로그로 수렴하고 쿠키는 그 전에 이미 지워졌다.
 *
 * ## ⚠️ 로그아웃해도 access 토큰은 살아 있다
 *
 * 위 표의 `GET /users/me -> 200` 이 그것이다. access 토큰은 **stateless JWT**
 * 라 백엔드가 폐기할 수단이 없다 - 만료(기본 900초)까지 유효하다. 백엔드
 * `logout` 호출이 하는 일은 refresh 세션을 폐기해 **재발급을 막는 것**뿐이고,
 * 그것은 위 표의 마지막 줄(401)이 확인해 준다.
 *
 * **그래서 로그아웃의 실질은 프론트가 쿠키를 지우는 것이다.** 나중에
 * "로그아웃했는데 왜 그 access 토큰이 아직 먹히지"를 조사하는 사람은 여기를
 * 읽으면 된다 - 버그가 아니라 stateless JWT 의 성질이다. 900초 뒤에 만료된다.
 *
 * ## 멱등이다 - 재시도도 중복 클릭 방어도 넣지 않았다
 *
 * 같은 refresh 토큰으로 두 번 불러도 둘 다 204 다(위 표). 정본 소스가 그
 * 이유를 보여준다 - `logout_refresh_session` 은 `revoked_at = revoked_at or now`
 * 로 이미 폐기된 세션을 그대로 통과시킨다(회전 쪽 `rotate_refresh_session` 이
 * 폐기된 토큰에 TOKEN_REVOKED 를 내는 것과 다르다,
 * `app/auth/refresh_sessions.py`). 그래서 이 파일에는 재시도도, 중복 제출을
 * 막는 상태도 없다 - 없어도 옳게 동작한다.
 *
 * ## 요청 문서 모양을 rotation.ts 와 공유하지 않는다 (판단)
 *
 * 정본은 refresh 와 logout 에 **같은 스키마 하나**(`RefreshTokenResource`,
 * `app/schemas/auth.py`)를 쓴다. 그러니 한 곳으로 묶고 싶어지지만 묶지
 * 않았다 - 묶으면 "두 엔드포인트가 같은 모양을 쓴다"는 계약을 지킬 자리가
 * 사라진다(같은 함수를 부르니 당연히 같아진다). 각자 자기 리터럴을 갖게
 * 두고, 대신 두 호출이 실제로 내보내는 본문이 같은지를 테스트가 fetch
 * 수준에서 비교한다(logout.test.ts 의 "refresh 와 같은 요청 문서를 쓴다").
 * 정본이 스키마를 나누는 날 그 테스트가 먼저 깨진다.
 */

import type { JsonApiResult } from '@/lib/jsonapi/client'
import type { JsonApiSend } from '@/lib/jsonapi/send'
import type { Session } from './tokens'

/** 정본의 공개 표면(스펙 2.1). refresh·login 과 같은 접두사다. */
export const LOGOUT_ENDPOINT = '/api/v1/auth/logout'

/**
 * 요청 문서의 `data.type`. refresh 와 같다 - 정본이 스키마를 공유한다(실측).
 *
 * 복수형이다. 단수형(`refreshToken`)으로 보내면 422 VALIDATION_ERROR 가
 * `source.pointer=/data/type` 과 함께 돌아온다(위 실측표) - 즉 이 한 글자가
 * 틀리면 로그아웃이 조용히가 아니라 매번 실패한다.
 */
export const LOGOUT_TYPE = 'refreshTokens'

/**
 * 로그아웃 뒤 사용자를 보내는 곳.
 *
 * `LOGIN_PATH`(guard.ts)가 아니라 홈이다. 방금 스스로 나간 사람에게 곧바로
 * 로그인 폼을 들이미는 것은 "왜 다시 들어오라는 거지"가 되고, 로그아웃은
 * 실패가 아니라 성공한 행동이라 오류 화면 계열의 목적지가 어울리지 않는다.
 *
 * **이 경로는 보호 경로가 아니어야 한다.** 보호 경로를 넣으면 proxy.ts 가
 * 곧바로 `/login?next=<여기>` 로 되돌려 보내, 로그아웃한 사용자가 로그인
 * 화면에 떨어지고 심지어 "로그아웃한 그 페이지로 돌아가라"는 next 까지
 * 달린다. 그 결합은 logout.test.ts 가 `isProtectedPath` 로 직접 확인한다 -
 * 이 파일에서 `@/proxy` 를 import 하면 lib/ 가 라우팅 계층을 거꾸로
 * 의존하게 된다(스펙 4장, flow.ts 의 authLinkHref 주석과 같은 이유).
 */
export const POST_LOGOUT_PATH = '/'

/** refresh 토큰을 담는 요청 문서 - refresh 와 logout 이 같은 모양이다(실측). */
export interface RefreshTokenDocument {
  data: { type: string; attributes: { refreshToken: string } }
}

export function logoutDocument(refreshToken: string): RefreshTokenDocument {
  return { data: { type: LOGOUT_TYPE, attributes: { refreshToken } } }
}

export type LogoutOutcome =
  /** 백엔드가 refresh 세션을 폐기했다. 이제 이 토큰으로는 재발급이 안 된다. */
  | { kind: 'revoked' }
  /**
   * 폐기하지 못했다 - 백엔드가 거절했거나(4xx·5xx) 아예 닿지 못했다(네트워크).
   *
   * 두 경우를 갈래로 나누지 않는다. rotation.ts 는 destroy/unreachable 을
   * 나누는데 그건 **다음 동작이 갈리기 때문**이다(쿠키를 지울지 말지).
   * 로그아웃은 어느 쪽이든 하는 일이 같다 - 쿠키는 이미 지워졌다. 구별이
   * 필요한 쪽은 조사하는 사람이고, 그 재료는 `reason` 이 싣는다.
   */
  | { kind: 'notRevoked'; reason: string }
  /** 지울 refresh 토큰이 애초에 없었다 - 백엔드를 **부르지 않았다.** */
  | { kind: 'noSession' }

/**
 * 로그아웃 응답 해석. **본문을 보지 않는다.**
 *
 * 정상 응답은 204(본문 없음, Content-Type 헤더도 없음 - 실측)라 볼 본문이
 * 애초에 없다. 그래서 `result.ok` 하나로 가른다 - 백엔드가 나중에 200 에
 * 문서를 실어 주더라도 우리가 쓸 것이 없으므로 같은 결론이다.
 *
 * 실패를 `status === 0`(client.ts 가 합성한 오류 - 백엔드가 판정을 내지
 * 못함)으로 한 번 더 가르는 것은 `reason` 문구를 위해서다. 판단이 갈리지
 * 않는다는 점은 위 LogoutOutcome 주석 참고.
 */
export function interpretLogoutResult(result: JsonApiResult<unknown>): LogoutOutcome {
  if (result.ok) return { kind: 'revoked' }

  if (result.status === 0) {
    return {
      kind: 'notRevoked',
      reason: `백엔드에 닿지 못했다: ${result.errors[0]?.code ?? 'UNKNOWN'}`,
    }
  }

  return {
    kind: 'notRevoked',
    reason: `백엔드가 거절했다(status ${result.status}, code ${result.errors[0]?.code ?? 'UNKNOWN'})`,
  }
}

/**
 * 백엔드에 refresh 세션 폐기를 요청하는 유일한 자리.
 *
 * `session` 이 없으면 부르지 않는다 - 보낼 refresh 토큰이 없다. (쿠키가
 * 이미 만료됐거나 사용자가 두 탭에서 연달아 로그아웃하면 실제로 이 상태가
 * 된다.)
 *
 * **access 토큰을 싣지 않는다.** 정본의 logout 라우트에는 인증 의존성이
 * 없다 - 폐기할 대상을 본문의 refresh 토큰이 스스로 지목하기 때문이다
 * (`AuthController.logout`, 실측). 굳이 Bearer 를 붙이면 이미 로그아웃
 * 하려는 토큰을 헤더로 한 번 더 내보내는 것뿐이다.
 *
 * `send` 에 **기본값이 없다** - credentials.ts 와 같은 이유다(template-typescript-expo 스펙
 * 9.4 - Accept-Language 는 주입받은 전송이 싣는다). 기본값을 두면 새 호출자가 조용히 빠뜨리고,
 * 그 증상은 오류가 아니라 "사용자가 자기 언어가 아닌 문구를 본다"라 타입도 테스트도 못 잡는다.
 *
 * 실패를 여기서 로그로 남긴다. proxy.ts 는 같은 성격의 로그를 호출부에
 * 뒀지만 그 호출부(proxy())는 테스트가 직접 부를 수 있다 - 로그아웃의
 * 호출부는 Server Action 이라 부를 수 없으므로, 거기 두면 "실패했을 때만
 * 남긴다"는 조건이 통째로 관측 불가가 된다. 남길 값어치도 있다: 폐기에
 * 실패한 refresh 토큰은 만료(기본 30일)까지 재발급에 쓸 수 있는 상태로
 * 남는다.
 */
export async function revokeSession(
  session: Session | undefined,
  send: JsonApiSend,
): Promise<LogoutOutcome> {
  if (session === undefined) return { kind: 'noSession' }

  const result = await send<unknown>(LOGOUT_ENDPOINT, {
    method: 'POST',
    body: logoutDocument(session.refreshToken),
  })

  const outcome = interpretLogoutResult(result)
  if (outcome.kind === 'notRevoked') {
    console.warn(`[logout] refresh 토큰 폐기 실패 - 만료까지 유효하게 남는다: ${outcome.reason}`)
  }
  return outcome
}

/**
 * 로그아웃 전체 - **쿠키를 먼저 지우고** 백엔드에 폐기를 알린다.
 *
 * ## 순서가 이 함수의 전부다 (브리핑 Step 2)
 *
 * 백엔드 호출의 성패와 무관하게 쿠키는 지워진다. 그것을 `try/finally` 로
 * 표현하지 않고 **순서로** 표현했다 - 지우는 것이 먼저면 아래에서 무엇이
 * 일어나든(4xx 거절, 네트워크 실패, 심지어 `BACKEND_URL` 이 비어 있어
 * `getSettings()` 가 던지는 배포 설정 오류까지) 로그아웃은 이미 끝나 있다.
 * `finally` 는 "예외를 넘어서도 실행된다"만 보장하지만, 순서는 "실행되지
 * 않을 경로가 아예 없다"를 보장한다.
 *
 * **마지막 갈래(예외)는 실측했다**(2026-09-06, 라운드 1 리뷰의 지적). 그
 * 단정은 두 부분으로 나뉜다 - (1) `clearLocal` 이 **끝난 뒤에** 예외가
 * 나가는가, (2) 그렇게 만든 쿠키 삭제를 Next 가 예외 응답에도 싣는가.
 * (1)은 logout.test.ts 가 고정한다(스파이의 `completed()`). (2)는
 * `BACKEND_URL` 없이 `next start` 를 띄우고 로그아웃 폼을 제출해 쟀다:
 * 응답이 **500 인데도** `Set-Cookie: session_access=; Expires=Thu, 01 Jan
 * 1970 ...` 이 두 쿠키 모두에 실려 나갔다. 즉 배포 설정이 깨진 상태에서도
 * 사용자는 오류 화면을 보되 로그아웃은 된다.
 *
 * 근거: 네트워크가 죽었다고 로그아웃이 안 되면 사용자는 자기 브라우저에
 * 갇힌다 - 공용 컴퓨터에서 자리를 뜨는 사람에게 이건 실질적인 피해다.
 * 반대 방향의 손해는 훨씬 작다. 쿠키만 지워지고 폐기가 실패하면 그 refresh
 * 토큰이 만료까지 살아 있지만, **그 토큰은 브라우저에서 이미 사라져** 누가
 * 훔쳐 갔을 때만 문제가 되고, 그 경우라면 폐기 호출도 이미 늦었다.
 *
 * ## clearLocal 을 인자로 받는다
 *
 * (template-typescript-expo) 원본에서 이 인자는 두 세션 쿠키를 지우는 `clearCookies` 였다. 이
 * 저장소에서는 기기 쪽 전부 - SecureStore 의 세션 항목과 Query 캐시(스펙 7.4) - 를 비우는
 * 함수다. 부르는 곳은 lib/auth/session-manager.ts 의 `logout()` 하나다.
 *
 * 저장 매체를 여기서 직접 부르면 이 파일이 expo-secure-store 를 의존하게 되어 vitest 에서 부를
 * 수 없다 - 그러면 위 "순서" 계약 전체가 관측 불가가 된다. 인자로 받으면 시험이 스파이를 넘겨
 * **네 갈래 전부**(폐기 성공 · 백엔드 거절 · 네트워크 실패 · 세션 없음)에서 실제로 불렸는지,
 * 그리고 요청보다 **먼저** 끝났는지를 잰다.
 *
 * 기본값을 두지 않는다 - `send` 와 같은 이유이고, 기본값을 두는 순간 위의 import 제약이 깨진다.
 */
export async function endSession(
  session: Session | undefined,
  send: JsonApiSend,
  clearLocal: () => Promise<void>,
): Promise<LogoutOutcome> {
  await clearLocal()
  return revokeSession(session, send)
}
