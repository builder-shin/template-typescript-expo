import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  interpretRotationOutcome,
  rotateSession,
  type AuthTokensDocument,
} from '@/lib/auth/rotation'
import {
  JSONAPI_MEDIA_TYPE,
  request,
  withAcceptLanguage,
  type JsonApiResult,
  type RequestOptions,
} from '@/lib/jsonapi/client'
import type { JsonApiSend } from '@/lib/jsonapi/send'

const NOW = 1_800_000_000_000 // 고정 시각. Date.now() 를 스텁하지 않고 주입한다(tokens.test.ts 와 같은 관례).

describe('interpretRotationOutcome', () => {
  function okResult(
    attributes: AuthTokensDocument['data']['attributes'],
  ): JsonApiResult<AuthTokensDocument> {
    return {
      ok: true,
      status: 200,
      document: { data: { type: 'authTokens', id: 'jti', attributes } },
    }
  }

  it('성공 응답 → rotated, sessionFromTokenDocument 로 만든 세션과 refreshExpiresIn 을 싣는다', () => {
    const outcome = interpretRotationOutcome(
      okResult({
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
        tokenType: 'Bearer',
        expiresIn: 900,
        refreshExpiresIn: 2_592_000,
      }),
      NOW,
    )
    expect(outcome).toEqual({
      kind: 'rotated',
      session: {
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
        accessExpiresAt: NOW + 900_000,
      },
      refreshExpiresIn: 2_592_000,
    })
  })

  it('expiresIn·refreshExpiresIn 을 둘 다 실전값이 아닌 값으로 줘도 그대로 반영한다 - 상수 하드코딩 가드(배선층 전체)', () => {
    // 리뷰 지적(F1, 재리뷰): 이 파일의 세 곳(여기·rotateSession 테스트·
    // proxy.test.ts) + tokens.test.ts 전부가 실전값(expiresIn:900,
    // refreshExpiresIn:2_592_000)을 입력으로 써서, interpretRotationOutcome
    // 안의 두 배선 지점 - `refreshExpiresIn: attributes.refreshExpiresIn`과
    // `sessionFromTokenDocument(attributes, now)`(attributes 를 통째로
    // 넘겨 그 안의 expiresIn 이 다시 accessExpiresAt 으로 배선된다) - 를
    // 각각 상수로 하드코딩해도 어떤 테스트도 못 잡았다(뮤테이션 실측:
    // 0/177, 이어서 0/180). Task 2 의 session.test.ts 가 겪은 것과 같은
    // 함정이 이 파일에서 두 번(처음엔 refreshExpiresIn 만, 재리뷰가
    // expiresIn 배선까지) 재발했다 - **첫 수정 때 "지적된 그 필드"만 보고
    // attributes 를 통과하는 나머지 필드는 안 봤기 때문이다.**
    //
    // 교훈을 규칙으로 반영한다: 배선 지점을 지키는 테스트는 그 지점을
    // 통과하는 *모든* 필드를 실전값과 다른 값으로 고정한다 - 하나만
    // 고정하면 나머지가 그대로 뚫려 있다. attributes 의 accessToken·
    // refreshToken·tokenType 은 "그럴듯한 실전 하드코드 기본값"이 없는
    // 고유 문자열이라(항상 매 테스트가 서로 다른 값을 쓴다) 같은 위험이
    // 없다 - 위험한 것은 이 저장소가 실제로 반복 사용하는 두 "라운드
    // 넘버" 상수(900 초 access, 2,592,000 초 refresh)뿐이라 그 둘만 바꾼다.
    //
    // sessionFromTokenDocument 자신의 expiresIn 추출 로직(tokens.ts)은
    // tokens.test.ts 가 0 이라는 다른 값으로 이미 방어한다 - 무가드였던
    // 것은 그 앞 단계, 즉 이 함수가 attributes 를 조립해 넘기는 배선
    // 지점이다.
    const outcome = interpretRotationOutcome(
      okResult({
        accessToken: 'a',
        refreshToken: 'r',
        tokenType: 'Bearer',
        expiresIn: 300,
        refreshExpiresIn: 86_400,
      }),
      NOW,
    )
    expect(outcome.kind).toBe('rotated')
    if (outcome.kind !== 'rotated') throw new Error('unreachable')
    expect(outcome.session.accessExpiresAt).toBe(NOW + 300_000)
    expect(outcome.refreshExpiresIn).toBe(86_400)
  })

  it('TOKEN_REVOKED(401) → destroy - 재사용 감지로 세션이 진짜 죽은 경우(실측)', () => {
    const result: JsonApiResult<AuthTokensDocument> = {
      ok: false,
      status: 401,
      errors: [
        {
          status: '401',
          code: 'TOKEN_REVOKED',
          title: '토큰 폐기됨',
          detail: '이미 사용된 refresh 토큰입니다.',
        },
      ],
    }
    const outcome = interpretRotationOutcome(result, NOW)
    expect(outcome.kind).toBe('destroy')
    if (outcome.kind !== 'destroy') throw new Error('unreachable')
    expect(outcome.reason).toMatch(/TOKEN_REVOKED/)
  })

  it('다른 거절 코드(422 VALIDATION_ERROR)도 destroy - 4xx 거절이면 코드와 무관하게 파기한다', () => {
    // 판단(보고서 참고): "백엔드가 응답해서 거절했다"는 사실 자체가 결론이다.
    // 재시도하지 않는 정책 아래, 이 refreshToken 은 다음 요청에서도 똑같이
    // 거절된다 - code 별 특별 취급은 새 거절 코드가 추가될 때마다 이 함수를
    // 고쳐야 한다는 뜻이라 오히려 깨지기 쉽다.
    const result: JsonApiResult<AuthTokensDocument> = {
      ok: false,
      status: 422,
      errors: [{ status: '422', code: 'VALIDATION_ERROR', title: '유효하지 않은 요청' }],
    }
    expect(interpretRotationOutcome(result, NOW).kind).toBe('destroy')
  })

  it('네트워크 실패(status 0) → unreachable, destroy 가 아니다', () => {
    // 판단(보고서 참고): 세션이 죽었다는 증거가 없다. 파기하면 백엔드가
    // 잠깐 죽었을 때 회전이 필요했던 모든 사용자가 로그아웃된다.
    const result: JsonApiResult<AuthTokensDocument> = {
      ok: false,
      status: 0,
      errors: [
        {
          status: '0',
          code: 'NETWORK_ERROR',
          title: '네트워크 오류',
          detail: '백엔드에 연결할 수 없습니다.',
        },
      ],
    }
    const outcome = interpretRotationOutcome(result, NOW)
    expect(outcome.kind).toBe('unreachable')
    if (outcome.kind !== 'unreachable') throw new Error('unreachable')
    expect(outcome.reason).toMatch(/NETWORK_ERROR/)
  })

  it.each([500, 502, 503, 504, 408, 429])(
    '(template-typescript-expo) 백엔드가 토큰을 판정하지 않은 응답(%i) → unreachable - 세션을 파기하지 않는다',
    (status) => {
      const result: JsonApiResult<AuthTokensDocument> = {
        ok: false,
        status,
        errors: [{ status: String(status), code: 'NON_JSONAPI_RESPONSE' }],
      }
      const outcome = interpretRotationOutcome(result, NOW)
      expect(outcome.kind).toBe('unreachable')
      if (outcome.kind !== 'unreachable') throw new Error('unreachable')
      expect(outcome.reason).toContain(`status ${status}`)
    },
  )

  it.each([400, 403, 404, 409])(
    '(template-typescript-expo) 그 밖의 4xx(%i) 는 원본대로 destroy 다',
    (status) => {
      const result: JsonApiResult<AuthTokensDocument> = {
        ok: false,
        status,
        errors: [{ status: String(status), code: 'PROBE_REJECTED' }],
      }
      expect(interpretRotationOutcome(result, NOW).kind).toBe('destroy')
    },
  )

  it('200 인데 본문이 없다(204 갈래) → destroy - 계약 위반에 대한 방어', () => {
    // client.ts 의 JsonApiResult<T> 는 204 갈래를 status 로 좁히지 못한다
    // (document !== null 로 좁혀야 한다 - 이 저장소의 실측 계약). /auth/refresh
    // 는 200 을 낸다고 알려져 있지만(계획 문서 실측표), 계약이 깨졌을 때
    // attributes 없이 sessionFromTokenDocument 를 불러 TypeError 로 던지는
    // 대신 명시적으로 파기한다.
    const brokenResult: JsonApiResult<AuthTokensDocument> = {
      ok: true,
      status: 204,
      document: null,
    }
    const outcome = interpretRotationOutcome(brokenResult, NOW)
    expect(outcome.kind).toBe('destroy')
  })
})

describe('rotateSession — 실제 fetch 호출', () => {
  // 실전 예시 값(`http://api:4000` · `http://localhost:4000`, .env.example)을
  // 쓰지 않는다 - 픽스처가 실전값과 같으면 "설정에서 읽었다"와 "박아
  // 넣었다"가 구별되지 않는다. 오늘은 settings.ts 가 BACKEND_URL 누락 시
  // 던져서(기본값 없음) 우연히 무해하지만, 그 보호는 이 파일 밖에 있다.
  const BACKEND = 'http://probe-backend:4321'
  /** 어느 브라우저도 어느 기본값도 만들 수 없는 값 - 전달과 우연을 구별한다. */
  const PROBE_ACCEPT_LANGUAGE = 'xx-ZZ,qq;q=0.3'
  /** (template-typescript-expo) 앱의 API 클라이언트처럼 Accept-Language 를 싣는 전송(스펙 9.4). */
  const probeSend: JsonApiSend = <T>(path: string, options: RequestOptions = {}) =>
    request<T>(path, withAcceptLanguage(options, PROBE_ACCEPT_LANGUAGE))
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    process.env.BACKEND_URL = BACKEND
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

  function headerMap(init: RequestInit): Record<string, string> {
    const headers: Record<string, string> = {}
    new Headers(init.headers).forEach((value, name) => {
      headers[name] = value
    })
    return headers
  }

  it('POST /api/v1/auth/refresh 에 refreshTokens 문서를 정확히 한 번 보낸다', async () => {
    fetchMock.mockResolvedValue(
      jsonApiResponse({
        data: {
          type: 'authTokens',
          id: 'jti-2',
          attributes: {
            accessToken: 'rotated-access',
            refreshToken: 'rotated-refresh',
            tokenType: 'Bearer',
            expiresIn: 900,
            refreshExpiresIn: 2_592_000,
          },
        },
      }),
    )

    const outcome = await rotateSession('old-refresh-token', probeSend, NOW)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(String(url)).toBe(`${BACKEND}/api/v1/auth/refresh`)
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({
      data: { type: 'refreshTokens', attributes: { refreshToken: 'old-refresh-token' } },
    })
    // 회전 호출도 브라우저의 Accept-Language 를 그대로 실어 보낸다(스펙 9.2).
    // 헤더 맵 전체를 비교한다 - 하나만 골라 보면 나머지는 지켜지지 않는다.
    expect(headerMap(init)).toEqual({
      accept: JSONAPI_MEDIA_TYPE,
      'content-type': JSONAPI_MEDIA_TYPE,
      'accept-language': PROBE_ACCEPT_LANGUAGE,
    })

    expect(outcome).toEqual({
      kind: 'rotated',
      session: {
        accessToken: 'rotated-access',
        refreshToken: 'rotated-refresh',
        accessExpiresAt: NOW + 900_000,
      },
      refreshExpiresIn: 2_592_000,
    })
  })

  it('TOKEN_REVOKED 응답 → destroy, 재시도하지 않는다(정확히 1회)', async () => {
    fetchMock.mockResolvedValue(
      jsonApiResponse(
        { errors: [{ status: '401', code: 'TOKEN_REVOKED', title: '토큰 폐기됨' }] },
        401,
      ),
    )

    const outcome = await rotateSession('reused-refresh-token', probeSend, NOW)

    expect(outcome.kind).toBe('destroy')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('Accept-Language 가 없으면 그 헤더만 빠진다', async () => {
    // proxy 는 `request.headers.get('accept-language')` 를 그대로 넘기므로
    // 헤더가 없는 요청에서는 null 이 온다.
    fetchMock.mockResolvedValue(
      jsonApiResponse({ errors: [{ status: '401', code: 'TOKEN_REVOKED' }] }, 401),
    )

    await rotateSession('old-refresh-token', request, NOW)

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(headerMap(init)).toEqual({
      accept: JSONAPI_MEDIA_TYPE,
      'content-type': JSONAPI_MEDIA_TYPE,
    })
  })

  it('fetch 가 던지면(네트워크 실패) → unreachable, 재시도하지 않는다(정확히 1회)', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'))

    const outcome = await rotateSession('refresh-token', probeSend, NOW)

    expect(outcome.kind).toBe('unreachable')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('(template-typescript-expo) 프록시가 준 HTML 502 → unreachable, 재시도하지 않는다(정확히 1회)', async () => {
    fetchMock.mockResolvedValue(
      new Response('<html>probe bad gateway</html>', {
        status: 502,
        headers: { 'content-type': 'text/html' },
      }),
    )

    const outcome = await rotateSession('refresh-token', probeSend, NOW)

    expect(outcome.kind).toBe('unreachable')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
