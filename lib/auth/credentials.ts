/**
 * 가입·로그인 호출과 그 응답의 해석 - 스펙 7.4, Task 5.
 *
 * rotation.ts 와 같은 모양이다: 백엔드를 실제로 부르는 얇은 함수(signUp·
 * signIn)와, 그 결과를 해석하는 **순수 함수**(interpretSignUpResult·
 * interpretSignInResult)를 나눈다. 해석이 순수해야 fetch 를 스텁하지 않고
 * "무엇을 어디로 배선했는지"를 테스트가 잴 수 있다.
 *
 * ## 실측 (2026-09-06, 정본 FastAPI @ 6ee53a3 를 로컬 컨테이너로 띄워 캡처)
 *
 * ```
 * POST /api/v1/auth/register  {data:{type:"users",attributes:{email,password}}}
 *   -> 201  {data:{type:"users",id,attributes:{email,isActive,createdAt,updatedAt},
 *            links:{self:"/api/v1/users/me"}}}          <- 토큰이 없다
 *   -> 409  EMAIL_ALREADY_REGISTERED   (source 없음 - 문서 오류)
 *   -> 422  VALIDATION_ERROR x N       (source.pointer=/data/attributes/<name>)
 *
 * POST /api/v1/auth/login     {data:{type:"authCredentials",attributes:{email,password}}}
 *   -> 200  {data:{type:"authTokens",id,attributes:{accessToken,refreshToken,
 *            tokenType:"Bearer",expiresIn:900,refreshExpiresIn:2592000}}}
 *   -> 401  INVALID_CREDENTIALS        (source 없음 - 문서 오류. 어느 필드가
 *                                       틀렸는지 알려주지 않는 것이 의도다)
 * ```
 *
 * **두 엔드포인트의 요청 attributes 는 같다** - 정본이 `CredentialsAttributes`
 * 하나를 register 와 login 양쪽 스키마에 쓴다(app/schemas/auth.py). 화면이
 * 두 폼에 같은 컴포넌트를 쓰는 근거가 여기 있다.
 *
 * 이 캡처가 rotation.ts 가 **추측으로 남겨 뒀던** refresh 본문 모양
 * (`{data:{type:"refreshTokens",attributes:{refreshToken}}}`)도 함께 확인해
 * 준다 - 정본 스키마가 정확히 그 모양이다(RefreshTokenResource).
 *
 * (D2 Task 7 부기) 그 모양은 그 뒤 **실제 HTTP 왕복**으로도 확인됐다 -
 * rotation.ts 의 해당 절과 test/e2e/auth.spec.ts 의 회전 테스트.
 */

import type { JsonApiResult } from '@/lib/jsonapi/client'
import type { ErrorObject } from '@/lib/jsonapi/document'
import type { JsonApiSend } from '@/lib/jsonapi/send'
import { EMAIL_FIELD, PASSWORD_FIELD } from './form-state'
import type { AuthTokensDocument } from './rotation'
import { sessionFromTokenDocument, type Session } from './tokens'

/** 정본의 공개 표면(스펙 2.1). rotation.ts 의 `/api/v1/auth/refresh` 와 같은 접두사다. */
export const REGISTER_ENDPOINT = '/api/v1/auth/register'
export const LOGIN_ENDPOINT = '/api/v1/auth/login'

/** 요청 문서의 `data.type`. 가입과 로그인이 서로 다르다 - 실측. */
export const REGISTER_TYPE = 'users'
export const LOGIN_TYPE = 'authCredentials'

export interface Credentials {
  email: string
  password: string
}

/** 요청 문서 - 두 엔드포인트가 `type` 만 다르고 attributes 는 같다(실측). */
export interface CredentialsDocument {
  data: { type: string; attributes: Credentials }
}

/**
 * attributes 의 키를 리터럴이 아니라 EMAIL_FIELD/PASSWORD_FIELD 로 쓴다 -
 * 입력 `name`·FormData 키·와이어 attribute 이름이 한 상수에서 나오게 해서
 * 셋이 어긋나는 것 자체를 구조적으로 막는다(form-state.ts 주석).
 */
function credentialsDocument(type: string, credentials: Credentials): CredentialsDocument {
  return {
    data: {
      type,
      attributes: { [EMAIL_FIELD]: credentials.email, [PASSWORD_FIELD]: credentials.password },
    },
  }
}

export function registerDocument(credentials: Credentials): CredentialsDocument {
  return credentialsDocument(REGISTER_TYPE, credentials)
}

export function loginDocument(credentials: Credentials): CredentialsDocument {
  return credentialsDocument(LOGIN_TYPE, credentials)
}

export type SignUpOutcome =
  /** 201. 계정이 만들어졌다 - **토큰은 없다.** 로그인을 한 번 더 불러야 한다. */
  | { kind: 'created' }
  /** 백엔드가 거절했다(409·422) 또는 client.ts 가 합성했다(네트워크 실패 등). */
  | { kind: 'rejected'; errors: readonly ErrorObject[] }

export type SignInOutcome =
  | { kind: 'signedIn'; session: Session; refreshExpiresIn: number }
  | { kind: 'rejected'; errors: readonly ErrorObject[] }
  /** 2xx 인데 본문이 없다(204) - 계약 위반이다. 세션을 만들 재료가 없다. */
  | { kind: 'malformed' }

/**
 * 가입 응답 해석. **본문을 보지 않는다.**
 *
 * 응답 문서(`data.type=users`)에 우리가 쓸 것이 하나도 없다 - 토큰이 없고
 * (실측), 이어지는 로그인은 사용자가 방금 입력한 자격증명을 그대로 다시
 * 쓴다. 그래서 "2xx 인가"만 본다 - 본문이 비어 있어도(계약 위반이지만)
 * 계정은 만들어진 것이므로 created 가 맞다.
 */
export function interpretSignUpResult(result: JsonApiResult<unknown>): SignUpOutcome {
  return result.ok ? { kind: 'created' } : { kind: 'rejected', errors: result.errors }
}

/**
 * 로그인 응답 해석.
 *
 * `refreshExpiresIn` 을 session 과 **나란히** 실어 보낸다 - Session 에는
 * 그 값이 없는데(쿠키 maxAge 를 정하는 데만 쓴다) writeSession 은 그것을
 * 따로 받는다(session.ts). 여기서 attributes 째로 들고 나오지 않으면
 * 호출부가 문서를 다시 뒤져야 한다.
 *
 * `document !== null` 로 좁힌다 - `status === 204` 로는 좁혀지지 않는다
 * (client.ts 의 JsonApiResult 계약, tsc 실측).
 */
export function interpretSignInResult(
  result: JsonApiResult<AuthTokensDocument>,
  now: number = Date.now(),
): SignInOutcome {
  if (!result.ok) return { kind: 'rejected', errors: result.errors }
  if (result.document === null) return { kind: 'malformed' }

  const attributes = result.document.data.attributes
  return {
    kind: 'signedIn',
    session: sessionFromTokenDocument(attributes, now),
    refreshExpiresIn: attributes.refreshExpiresIn,
  }
}

/**
 * `send` 는 **기본값이 없다** - 호출자가 반드시 넘긴다(template-typescript-expo 스펙 9.4).
 *
 * 앱에서는 platform/api.ts 의 apiRequest 가 들어온다 - Accept-Language 를 싣는 자리는 그 한
 * 곳이다. 기본값(`request`)을 두면 새 호출자가 "안 넘겨도 되는 것"으로 읽고 조용히 빠뜨리고,
 * 그 결과는 오류가 아니라 **사용자가 자기 언어가 아닌 문구를 보는 것**이라 타입도 시험도 잡지
 * 못한다.
 */
export type RegistrationOutcome =
  /** 가입 자체가 거절됐다 - 로그인은 **부르지 않았다**(계정이 없으니 부를 이유가 없다). */
  | { kind: 'signUpRejected'; errors: readonly ErrorObject[] }
  /** 계정은 만들어졌다. `signIn` 은 이어서 부른 로그인의 결과다(성공했을 수도, 아닐 수도). */
  | { kind: 'signedUp'; signIn: SignInOutcome }

/**
 * 가입 흐름 전체 - register 다음에 login(스펙 7.4).
 *
 * 두 호출을 한 함수로 묶은 이유는 **둘 사이의 계약을 관측 가능하게 만들기 위해서**다. 따로
 * 부르면 "두 호출이 같은 자격증명과 같은 전송(`send`)을 쓴다"는 사실을 지킬 자리가 없다 - 원본
 * 저장소의 리뷰가 실제로 확인했다: 두 번째 호출의 언어 인자만 `null` 로 바꿔도 테스트 258개 중
 * 0개가 실패했다(RM5). 증상은 오류가 아니라 "en 사용자가 가입에 성공한 뒤 한국어 오류 문구를
 * 본다"라, 아무것도 깨지지 않은 것처럼 보인다.
 *
 * 여기 묶고 나면 한 시험이 두 요청을 통째로 본다.
 */
export async function signUpThenSignIn(
  credentials: Credentials,
  send: JsonApiSend,
  now: number = Date.now(),
): Promise<RegistrationOutcome> {
  const signUpOutcome = await signUp(credentials, send)
  if (signUpOutcome.kind === 'rejected') {
    return { kind: 'signUpRejected', errors: signUpOutcome.errors }
  }
  // 같은 credentials, 같은 send - 위에서 받은 인자를 그대로 쓴다.
  return { kind: 'signedUp', signIn: await signIn(credentials, send, now) }
}

export async function signUp(credentials: Credentials, send: JsonApiSend): Promise<SignUpOutcome> {
  const result = await send<unknown>(REGISTER_ENDPOINT, {
    method: 'POST',
    body: registerDocument(credentials),
  })
  return interpretSignUpResult(result)
}

export async function signIn(
  credentials: Credentials,
  send: JsonApiSend,
  now: number = Date.now(),
): Promise<SignInOutcome> {
  const result = await send<AuthTokensDocument>(LOGIN_ENDPOINT, {
    method: 'POST',
    body: loginDocument(credentials),
  })
  return interpretSignInResult(result, now)
}
