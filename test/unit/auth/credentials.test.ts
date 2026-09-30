import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  LOGIN_ENDPOINT,
  LOGIN_TYPE,
  REGISTER_ENDPOINT,
  REGISTER_TYPE,
  interpretSignInResult,
  interpretSignUpResult,
  loginDocument,
  registerDocument,
  signIn,
  signUp,
  signUpThenSignIn,
  type Credentials,
} from '@/lib/auth/credentials'
import { EMAIL_FIELD, PASSWORD_FIELD } from '@/lib/auth/form-state'
import type { AuthTokensDocument } from '@/lib/auth/rotation'
import {
  JSONAPI_MEDIA_TYPE,
  request,
  withAcceptLanguage,
  type JsonApiResult,
  type RequestOptions,
} from '@/lib/jsonapi/client'
import type { JsonApiSend } from '@/lib/jsonapi/send'

/**
 * 가입·로그인의 요청 조립과 응답 해석.
 *
 * 픽스처 값을 전부 실전에서 나올 수 없는 값으로 잡았다(flow.test.ts 상단의
 * 같은 이유). 특히:
 *
 *   - email 과 password 의 **값이 서로 다르다** - 같으면 두 필드를 바꿔
 *     배선해도 초록이다.
 *   - accessToken 과 refreshToken 의 값이 서로 다르다 - 같은 이유다.
 *     (실측 픽스처 AUTH_TOKENS 는 둘 다 'header.payload.signature' 라 이
 *     배선을 구별하지 못한다.)
 *   - expiresIn(137) != refreshExpiresIn(8641) 이고 둘 다 실전값(900 /
 *     2592000)이 아니다.
 *   - BACKEND_URL 도 실전 예시(http://api:4000, http://localhost:4000)가 아니다.
 */

const PROBE_BACKEND = 'http://probe-backend:4321'

const PROBE_CREDENTIALS: Credentials = {
  email: 'probe-email-value',
  password: 'probe-password-value',
}

const PROBE_EXPIRES_IN = 137
const PROBE_REFRESH_EXPIRES_IN = 8641
const PROBE_NOW = 1_500_000_000_000
/**
 * 브라우저가 실제로 보낼 법한 값(`ko-KR,ko;q=0.9,en;q=0.8`)을 쓰지 않는다 -
 * 그러면 "헤더를 전달했다"와 "우연히 기본값이 같다"가 구별되지 않는다.
 * 어느 브라우저도 어느 기본값도 만들 수 없는 값을 쓴다.
 */
const PROBE_ACCEPT_LANGUAGE = 'xx-ZZ,qq;q=0.3'

/**
 * (template-typescript-expo) 앱의 API 클라이언트(platform/api.ts)가 하듯 Accept-Language 를 싣는
 * 전송. 이 파일의 함수는 요청을 주입받은 전송으로만 내보낸다(스펙 9.4) - request 를 직접 부르면
 * 헤더가 빠져 아래 단언들이 죽는다.
 */
function sendWithLanguage(acceptLanguage: string): JsonApiSend {
  return <T>(path: string, options: RequestOptions = {}) =>
    request<T>(path, withAcceptLanguage(options, acceptLanguage))
}

const probeSend = sendWithLanguage(PROBE_ACCEPT_LANGUAGE)

function tokensDocument(): AuthTokensDocument {
  return {
    data: {
      type: 'authTokens',
      id: 'probe-refresh-jti',
      attributes: {
        accessToken: 'probe-access-token',
        refreshToken: 'probe-refresh-token',
        tokenType: 'ProbeBearer',
        expiresIn: PROBE_EXPIRES_IN,
        refreshExpiresIn: PROBE_REFRESH_EXPIRES_IN,
      },
    },
  }
}

describe('요청 문서', () => {
  it('가입은 users, 로그인은 authCredentials 다 - 실측된 계약', () => {
    expect(registerDocument(PROBE_CREDENTIALS).data.type).toBe('users')
    expect(loginDocument(PROBE_CREDENTIALS).data.type).toBe('authCredentials')
    expect(REGISTER_TYPE).not.toBe(LOGIN_TYPE)
  })

  it('attributes 는 두 엔드포인트가 같다 - 정본이 스키마 하나를 공유한다', () => {
    const attributes = { email: 'probe-email-value', password: 'probe-password-value' }
    expect(registerDocument(PROBE_CREDENTIALS).data.attributes).toEqual(attributes)
    expect(loginDocument(PROBE_CREDENTIALS).data.attributes).toEqual(attributes)
  })

  it('와이어 attribute 이름이 입력 이름 상수와 같다', () => {
    // 이 둘이 갈라지면 백엔드가 `/data/attributes/email` 로 돌려준 오류가
    // 어느 입력에도 붙지 못하고 소리 없이 사라진다 - 타입도 빌드도 못 잡는다.
    expect(Object.keys(registerDocument(PROBE_CREDENTIALS).data.attributes)).toEqual([
      EMAIL_FIELD,
      PASSWORD_FIELD,
    ])
  })

  it('엔드포인트가 서로 다르고 정본의 접두사를 쓴다', () => {
    expect(REGISTER_ENDPOINT).toBe('/api/v1/auth/register')
    expect(LOGIN_ENDPOINT).toBe('/api/v1/auth/login')
  })
})

describe('interpretSignUpResult', () => {
  it('2xx 면 created 다 - 본문을 보지 않는다', () => {
    expect(interpretSignUpResult({ ok: true, status: 201, document: {} })).toEqual({
      kind: 'created',
    })
  })

  it('본문 없는 2xx 도 created 다 - 계정은 만들어졌다', () => {
    expect(interpretSignUpResult({ ok: true, status: 204, document: null })).toEqual({
      kind: 'created',
    })
  })

  it('거절이면 오류를 그대로 넘긴다', () => {
    const errors = [{ status: '409', code: 'EMAIL_ALREADY_REGISTERED', detail: 'probe-conflict' }]
    expect(interpretSignUpResult({ ok: false, status: 409, errors })).toEqual({
      kind: 'rejected',
      errors,
    })
  })
})

describe('interpretSignInResult', () => {
  it('토큰 문서를 Session 과 refreshExpiresIn 으로 나눠 싣는다', () => {
    const result: JsonApiResult<AuthTokensDocument> = {
      ok: true,
      status: 200,
      document: tokensDocument(),
    }

    expect(interpretSignInResult(result, PROBE_NOW)).toEqual({
      kind: 'signedIn',
      session: {
        accessToken: 'probe-access-token',
        refreshToken: 'probe-refresh-token',
        // expiresIn 이지 refreshExpiresIn 이 아니다. 둘을 바꾸면 이 값이 달라진다.
        accessExpiresAt: PROBE_NOW + PROBE_EXPIRES_IN * 1000,
      },
      // 쿠키 maxAge 로 갈 값이다. Session 에는 없으므로 여기서 따로 실어야
      // writeSession 을 부를 수 있다.
      refreshExpiresIn: PROBE_REFRESH_EXPIRES_IN,
    })
  })

  it('본문 없는 2xx 는 malformed 다 - 세션을 만들 재료가 없다', () => {
    const result: JsonApiResult<AuthTokensDocument> = { ok: true, status: 204, document: null }
    expect(interpretSignInResult(result, PROBE_NOW)).toEqual({ kind: 'malformed' })
  })

  it('거절이면 오류를 그대로 넘긴다', () => {
    const errors = [{ status: '401', code: 'INVALID_CREDENTIALS', detail: 'probe-credentials' }]
    expect(interpretSignInResult({ ok: false, status: 401, errors }, PROBE_NOW)).toEqual({
      kind: 'rejected',
      errors,
    })
  })
})

describe('signUp / signIn - 실제 fetch 호출', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    process.env.BACKEND_URL = PROBE_BACKEND
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  function jsonApiResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': JSONAPI_MEDIA_TYPE },
    })
  }

  /**
   * 실제로 나간 요청 **전체**를 뽑는다.
   *
   * 헤더를 하나만 골라 확인하지 않고 맵 전체를 돌려주는 이유: 한 필드만
   * 단언하면 나머지는 지켜지지 않는다. 아래 테스트들은 이 맵을 통째로
   * `toEqual` 로 비교하므로 헤더가 하나 사라지거나 늘거나 이름이 바뀌면
   * 전부 깨진다.
   */
  function sentRequest(index = 0): {
    url: string
    method: string | undefined
    headers: Record<string, string>
    body: unknown
  } {
    const [url, init] = fetchMock.mock.calls[index] as [string, RequestInit]
    const headers: Record<string, string> = {}
    new Headers(init.headers).forEach((value, name) => {
      headers[name] = value
    })
    return {
      url: String(url),
      method: init.method,
      headers,
      body: init.body === undefined ? undefined : JSON.parse(init.body as string),
    }
  }

  it('signUp 은 register 엔드포인트에 users 문서와 Accept-Language 를 보낸다', async () => {
    fetchMock.mockResolvedValue(jsonApiResponse({ data: { type: 'users', id: 'probe-id' } }, 201))

    const outcome = await signUp(PROBE_CREDENTIALS, probeSend)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(sentRequest()).toEqual({
      url: `${PROBE_BACKEND}/api/v1/auth/register`,
      method: 'POST',
      headers: {
        accept: JSONAPI_MEDIA_TYPE,
        'content-type': JSONAPI_MEDIA_TYPE,
        'accept-language': PROBE_ACCEPT_LANGUAGE,
      },
      body: {
        data: {
          type: 'users',
          attributes: { email: 'probe-email-value', password: 'probe-password-value' },
        },
      },
    })
    expect(outcome).toEqual({ kind: 'created' })
  })

  it('signIn 은 login 엔드포인트에 authCredentials 문서와 Accept-Language 를 보낸다', async () => {
    // 이 테스트가 없으면 signUp/signIn 이 서로의 문서 조립기를 부르도록
    // 바꿔치기해도(둘의 attributes 가 같아서) 아무것도 안 깨진다.
    fetchMock.mockResolvedValue(jsonApiResponse(tokensDocument()))

    const outcome = await signIn(PROBE_CREDENTIALS, probeSend, PROBE_NOW)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(sentRequest()).toEqual({
      url: `${PROBE_BACKEND}/api/v1/auth/login`,
      method: 'POST',
      headers: {
        accept: JSONAPI_MEDIA_TYPE,
        'content-type': JSONAPI_MEDIA_TYPE,
        'accept-language': PROBE_ACCEPT_LANGUAGE,
      },
      body: {
        data: {
          type: 'authCredentials',
          attributes: { email: 'probe-email-value', password: 'probe-password-value' },
        },
      },
    })

    expect(outcome).toEqual({
      kind: 'signedIn',
      session: {
        accessToken: 'probe-access-token',
        refreshToken: 'probe-refresh-token',
        accessExpiresAt: PROBE_NOW + PROBE_EXPIRES_IN * 1000,
      },
      refreshExpiresIn: PROBE_REFRESH_EXPIRES_IN,
    })
  })

  it('가입 흐름은 두 호출에 같은 자격증명과 같은 Accept-Language 를 싣는다', async () => {
    // 리뷰 RM5: 이 두 호출이 Server Action 안에 흩어져 있을 때는 두 번째만
    // acceptLanguage 를 null 로 바꿔도 258개 전부 초록이었다. 증상은 오류가
    // 아니라 "en 사용자가 가입에 성공한 뒤 한국어 오류를 본다"라 눈에도
    // 타입에도 걸리지 않는다.
    fetchMock
      .mockResolvedValueOnce(jsonApiResponse({ data: { type: 'users', id: 'probe-id' } }, 201))
      .mockResolvedValueOnce(jsonApiResponse(tokensDocument()))

    const outcome = await signUpThenSignIn(PROBE_CREDENTIALS, probeSend, PROBE_NOW)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const first = sentRequest(0)
    const second = sentRequest(1)

    // 순서: register 가 먼저다(스펙 7.4). 뒤집히면 존재하지 않는 계정으로
    // 로그인을 시도하고 401 을 받는다.
    expect(first.url).toBe(`${PROBE_BACKEND}/api/v1/auth/register`)
    expect(second.url).toBe(`${PROBE_BACKEND}/api/v1/auth/login`)

    // 같은 언어. 한쪽만 확인하면 다른 쪽이 지켜지지 않는다.
    expect(first.headers['accept-language']).toBe(PROBE_ACCEPT_LANGUAGE)
    expect(second.headers['accept-language']).toBe(PROBE_ACCEPT_LANGUAGE)
    expect(first.headers['accept-language']).toBe(second.headers['accept-language'])

    // 같은 자격증명.
    const expectedAttributes = { email: 'probe-email-value', password: 'probe-password-value' }
    expect(first.body).toEqual({ data: { type: 'users', attributes: expectedAttributes } })
    expect(second.body).toEqual({
      data: { type: 'authCredentials', attributes: expectedAttributes },
    })

    expect(outcome).toEqual({
      kind: 'signedUp',
      signIn: {
        kind: 'signedIn',
        session: {
          accessToken: 'probe-access-token',
          refreshToken: 'probe-refresh-token',
          accessExpiresAt: PROBE_NOW + PROBE_EXPIRES_IN * 1000,
        },
        refreshExpiresIn: PROBE_REFRESH_EXPIRES_IN,
      },
    })
  })

  it('가입 흐름에서 Accept-Language 가 없으면 두 호출 모두 헤더가 없다', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonApiResponse({ data: { type: 'users', id: 'probe-id' } }, 201))
      .mockResolvedValueOnce(jsonApiResponse(tokensDocument()))

    await signUpThenSignIn(PROBE_CREDENTIALS, request, PROBE_NOW)

    expect(Object.keys(sentRequest(0).headers)).not.toContain('accept-language')
    expect(Object.keys(sentRequest(1).headers)).not.toContain('accept-language')
  })

  it('가입이 거절되면 로그인을 아예 부르지 않는다', async () => {
    // 계정이 없는데 로그인을 부르면 401 이 나고, 화면은 "가입 실패"가 아니라
    // "자격증명 오류"를 보여주게 된다.
    fetchMock.mockResolvedValue(
      jsonApiResponse(
        { errors: [{ status: '409', code: 'EMAIL_ALREADY_REGISTERED', detail: 'probe-conflict' }] },
        409,
      ),
    )

    const outcome = await signUpThenSignIn(PROBE_CREDENTIALS, probeSend, PROBE_NOW)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(outcome).toEqual({
      kind: 'signUpRejected',
      errors: [{ status: '409', code: 'EMAIL_ALREADY_REGISTERED', detail: 'probe-conflict' }],
    })
  })

  it('Accept-Language 가 없으면 그 헤더만 빠지고 나머지는 그대로다', async () => {
    // `headers().get()` 은 헤더가 없으면 null 을 준다. 빈 문자열을 보내거나
    // 키를 undefined 로 두는 것과 결과가 다르다 - client.ts 가
    // `!== undefined` 로 분기하므로 키가 있으면 빈 헤더가 실제로 나간다.
    fetchMock.mockResolvedValue(jsonApiResponse(tokensDocument()))

    await signIn(PROBE_CREDENTIALS, request, PROBE_NOW)

    const sent = sentRequest()
    expect(sent.headers).toEqual({
      accept: JSONAPI_MEDIA_TYPE,
      'content-type': JSONAPI_MEDIA_TYPE,
    })
    expect(Object.keys(sent.headers)).not.toContain('accept-language')
    // 헤더가 빠졌다고 나머지가 흔들리지 않는다.
    expect(sent.url).toBe(`${PROBE_BACKEND}/api/v1/auth/login`)
    expect(sent.method).toBe('POST')
  })

  it('빈 문자열은 그대로 전달한다 - 프론트가 브라우저 헤더를 편집하지 않는다', async () => {
    fetchMock.mockResolvedValue(jsonApiResponse(tokensDocument()))

    await signIn(PROBE_CREDENTIALS, sendWithLanguage(''), PROBE_NOW)

    expect(sentRequest().headers).toEqual({
      accept: JSONAPI_MEDIA_TYPE,
      'content-type': JSONAPI_MEDIA_TYPE,
      'accept-language': '',
    })
  })

  it('네트워크가 죽어도 던지지 않고 rejected 로 돌아온다', async () => {
    // client.ts 의 계약(어떤 입력으로도 던지지 않는다)이 여기까지 이어지는지
    // 확인한다 - Server Action 이 던지면 폼이 통째로 error.tsx 로 대체돼
    // 사용자가 입력한 값이 사라진다.
    fetchMock.mockRejectedValue(new TypeError('fetch failed'))

    const signUpOutcome = await signUp(PROBE_CREDENTIALS, probeSend)
    const signInOutcome = await signIn(PROBE_CREDENTIALS, probeSend, PROBE_NOW)

    expect(signUpOutcome.kind).toBe('rejected')
    expect(signInOutcome.kind).toBe('rejected')
  })

  it('로그인은 한 번만 부른다 - 401 에 재시도하지 않는다', async () => {
    // 스펙 7.2: 재시도는 refresh 재사용을 만든다. client.ts 도 재시도하지
    // 않지만, 이 계층이 "실패했으니 한 번 더"를 얹지 않는지는 별개다.
    fetchMock.mockResolvedValue(
      jsonApiResponse(
        { errors: [{ status: '401', code: 'INVALID_CREDENTIALS', detail: 'probe' }] },
        401,
      ),
    )

    await signIn(PROBE_CREDENTIALS, probeSend, PROBE_NOW)

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
