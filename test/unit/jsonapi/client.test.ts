import { getEventListeners } from 'node:events'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import {
  JSONAPI_MEDIA_TYPE,
  REQUEST_TIMEOUT_MS,
  isSyntheticError,
  request,
  withAcceptLanguage,
} from '@/lib/jsonapi/client'
import { COLLECTION_EMPTY, ERROR_NOT_FOUND, SINGLE_CREATED } from '../../fixtures/documents'

// 실전 예시 값(`http://api:4000` · `http://localhost:4000`, .env.example)을
// 쓰지 않는다 - 픽스처가 실전값과 같으면 "설정에서 읽었다"와 "박아 넣었다"가
// 구별되지 않는다(rotation.test.ts 가 먼저 이 관례를 세웠다). 오늘은
// settings.ts 가 BACKEND_URL 누락 시 던져서(기본값 없음) 우연히 무해하지만,
// 그 보호는 이 파일 밖에 있다.
const BACKEND = 'http://probe-backend:4321'

function jsonApiResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': JSONAPI_MEDIA_TYPE },
  })
}

// `ReturnType<typeof vi.fn>` 은 vitest 5 에서 `Mock<Procedure | Constructable>` 다. 그 void 갈래
// 때문에 Promise 를 돌려주는 mockImplementation 을 @typescript-eslint/no-misused-promises 가
// 오탐하므로, fetch 시그니처로 좁힌다.
let fetchMock: Mock<(url: string, init: RequestInit) => Promise<Response>>

beforeEach(() => {
  process.env.BACKEND_URL = BACKEND
  fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

/** fetch 가 실제로 받은 (url, init) 을 꺼낸다. */
function lastCall(): [string, RequestInit] {
  const call = fetchMock.mock.calls.at(-1)
  if (call === undefined) throw new Error('fetch was not called')
  return [String(call[0]), call[1] ?? {}]
}

function headerOf(init: RequestInit, name: string): string | null {
  return new Headers(init.headers).get(name)
}

describe('request — 요청 조립', () => {
  it('backendUrl 앞에 경로를 붙인다', async () => {
    fetchMock.mockResolvedValue(jsonApiResponse(COLLECTION_EMPTY))
    await request('/api/v1/examples')
    expect(lastCall()[0]).toBe(`${BACKEND}/api/v1/examples`)
  })

  it('query 를 붙인다', async () => {
    fetchMock.mockResolvedValue(jsonApiResponse(COLLECTION_EMPTY))
    await request('/api/v1/examples', { query: new URLSearchParams({ 'page[size]': '5' }) })
    expect(lastCall()[0]).toBe(`${BACKEND}/api/v1/examples?page%5Bsize%5D=5`)
  })

  it('빈 query 는 물음표를 남기지 않는다', async () => {
    fetchMock.mockResolvedValue(jsonApiResponse(COLLECTION_EMPTY))
    await request('/api/v1/examples', { query: new URLSearchParams() })
    expect(lastCall()[0]).toBe(`${BACKEND}/api/v1/examples`)
  })

  it('Accept 에 JSON:API 미디어 타입을 파라미터 없이 보낸다', async () => {
    // 백엔드는 미디어 타입에 파라미터가 붙으면 415 로 거절한다.
    fetchMock.mockResolvedValue(jsonApiResponse(COLLECTION_EMPTY))
    await request('/api/v1/examples')
    expect(headerOf(lastCall()[1], 'accept')).toBe(JSONAPI_MEDIA_TYPE)
  })

  it('본문이 없으면 Content-Type 을 보내지 않는다', async () => {
    // 본문 없는 요청에 Content-Type 을 붙이면 백엔드가 415 로 거절할 수 있다.
    fetchMock.mockResolvedValue(jsonApiResponse(COLLECTION_EMPTY))
    await request('/api/v1/examples')
    expect(headerOf(lastCall()[1], 'content-type')).toBeNull()
    expect(lastCall()[1].body).toBeUndefined()
  })

  it('본문이 있으면 직렬화하고 Content-Type 을 붙인다', async () => {
    fetchMock.mockResolvedValue(jsonApiResponse(SINGLE_CREATED, 201))
    const body = { data: { type: 'examples', attributes: { title: 'x' } } }
    await request('/api/v1/examples', { method: 'POST', body })
    const [, init] = lastCall()
    expect(init.method).toBe('POST')
    expect(headerOf(init, 'content-type')).toBe(JSONAPI_MEDIA_TYPE)
    expect(init.body).toBe(JSON.stringify(body))
  })

  it('accessToken 이 있으면 Bearer 로 붙인다', async () => {
    fetchMock.mockResolvedValue(jsonApiResponse(COLLECTION_EMPTY))
    await request('/api/v1/examples', { accessToken: 'abc' })
    expect(headerOf(lastCall()[1], 'authorization')).toBe('Bearer abc')
  })

  it('accessToken 이 없으면 Authorization 을 보내지 않는다', async () => {
    fetchMock.mockResolvedValue(jsonApiResponse(COLLECTION_EMPTY))
    await request('/api/v1/examples')
    expect(headerOf(lastCall()[1], 'authorization')).toBeNull()
  })

  it('acceptLanguage 를 그대로 전달한다', async () => {
    fetchMock.mockResolvedValue(jsonApiResponse(COLLECTION_EMPTY))
    await request('/api/v1/examples', { acceptLanguage: 'en' })
    expect(headerOf(lastCall()[1], 'accept-language')).toBe('en')
  })

  it('cache 옵션을 넘기지 않는다 - RN fetch polyfill 이 URL 을 바꾼다', async () => {
    // RN 0.86.3 의 fetch 는 whatwg-fetch 3.6.20 이고, 그 Request 는 cache 가
    // no-store·no-cache 인 GET 의 URL 끝에 `_=<시각>` 을 붙인다(fetch.js:398-407).
    // JSON:API 요청 URL 은 백엔드의 쿼리 문법 검사를 거치므로 바뀌면 안 된다.
    fetchMock.mockResolvedValue(jsonApiResponse(COLLECTION_EMPTY))
    await request('/api/v1/examples')
    expect(lastCall()[1].cache).toBeUndefined()
    expect(lastCall()[0]).toBe(`${BACKEND}/api/v1/examples`)
  })

  // 아래 4개는 뮤테이션 검증 중 스스로 찾은 공백을 메운다.

  it('accessToken 이 빈 문자열이어도 Bearer 로 붙인다', async () => {
    // "제공됨"의 기준은 undefined 여부이지 truthy 여부가 아니다 - acceptLanguage·
    // signal·body 등 이 함수의 다른 모든 선택 필드와 같은 기준(!== undefined)이다.
    // 이 기준을 truthy 검사로 바꿔도(`if (options.accessToken)`) 브리핑의 17개는
    // 전부 green 이었다 - accessToken: '' 을 넘기는 테스트가 없었기 때문이다.
    fetchMock.mockResolvedValue(jsonApiResponse(COLLECTION_EMPTY))
    await request('/api/v1/examples', { accessToken: '' })
    // Headers 가 HTTP 스펙대로 값의 앞뒤 공백을 잘라내므로 'Bearer '(끝 공백)가
    // 아니라 'Bearer'로 읽힌다 - 실측으로 확인했다(node -e 로 재현됨).
    expect(headerOf(lastCall()[1], 'authorization')).toBe('Bearer')
  })

  it('acceptLanguage 가 빈 문자열이어도 그대로 전달한다', async () => {
    // 위와 같은 기준(!== undefined) - truthy 검사로 바꿔도 브리핑 17개는 green 이었다.
    fetchMock.mockResolvedValue(jsonApiResponse(COLLECTION_EMPTY))
    await request('/api/v1/examples', { acceptLanguage: '' })
    expect(headerOf(lastCall()[1], 'accept-language')).toBe('')
  })

  it('method 를 지정하지 않으면 GET 이다', async () => {
    // 브리핑 17개 중 기본 method 값을 확인하는 테스트가 없었다 - `?? 'GET'`을
    // `?? 'POST'`로 바꿔도 17개가 전부 green 이었다.
    fetchMock.mockResolvedValue(jsonApiResponse(COLLECTION_EMPTY))
    await request('/api/v1/examples')
    expect(lastCall()[1].method).toBe('GET')
  })

  it('호출자 signal 이 끊기면 요청도 끊긴다', async () => {
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'))
          })
        }),
    )
    const controller = new AbortController()
    const pending = request('/api/v1/examples', { signal: controller.signal })
    controller.abort()
    const result = await pending
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors[0]?.code).toBe('NETWORK_ERROR')
  })

  it('이미 끊긴 signal 을 주면 요청이 시작부터 끊겨 있다', async () => {
    fetchMock.mockResolvedValue(jsonApiResponse(COLLECTION_EMPTY))
    const controller = new AbortController()
    controller.abort()
    await request('/api/v1/examples', { signal: controller.signal })
    expect(lastCall()[1].signal?.aborted).toBe(true)
  })
})

describe('request — 응답 해석', () => {
  it('2xx 는 ok 로 문서를 돌려준다', async () => {
    fetchMock.mockResolvedValue(jsonApiResponse(COLLECTION_EMPTY))
    const result = await request<typeof COLLECTION_EMPTY>('/api/v1/examples')
    expect(result).toEqual({ ok: true, status: 200, document: COLLECTION_EMPTY })
  })

  it('오류 문서를 errors 로 돌려준다', async () => {
    fetchMock.mockResolvedValue(jsonApiResponse(ERROR_NOT_FOUND, 404))
    const result = await request('/api/v1/examples/x')
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.status).toBe(404)
    expect(result.errors[0]?.code).toBe('RESOURCE_NOT_FOUND')
  })

  it('204 는 문서 없이 ok 다', async () => {
    // 로그아웃이 204 를 낸다. 본문을 파싱하려 들면 던진다.
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    const result = await request('/api/v1/auth/logout', { method: 'POST' })
    expect(result).toEqual({ ok: true, status: 204, document: null })
  })

  it('본문이 JSON 이 아닌 오류 응답도 errors 로 만든다', async () => {
    // 리버스 프록시가 502 HTML 을 낼 수 있다. 여기서 던지면 화면이 흰 페이지가 된다.
    fetchMock.mockResolvedValue(
      new Response('<html>502</html>', { status: 502, headers: { 'content-type': 'text/html' } }),
    )
    const result = await request('/api/v1/examples')
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.status).toBe(502)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]?.status).toBe('502')
  })

  it('2xx 인데 본문이 오류 문서면 오류로 다룬다', async () => {
    // 상태 코드와 본문이 어긋나는 백엔드를 만나면 본문을 믿는다.
    fetchMock.mockResolvedValue(jsonApiResponse(ERROR_NOT_FOUND, 200))
    const result = await request('/api/v1/examples')
    expect(result.ok).toBe(false)
  })

  it('오류 문서 모양인데 원소가 오류 객체가 아니면 던지지 않고 합성 오류로 다룬다', async () => {
    // 실측된 접합부 결함(document.ts 의 isErrorDocument가 원소를 검사하지
    // 않던 시절): 계약을 어긴 백엔드/중간 프록시가 {"errors":[null]}을 500으로
    // 내면 isErrorDocument가 통과시켜 [null]을 그대로 돌려줬고, 바로 다음 줄에서
    // actionForErrors/groupErrors가 TypeError로 던졌다. request() 자체는 결코
    // 던지지 않아야 하므로, 이 모양은 오류 문서로 인정하지 않고 다른 비-JSON:API
    // 오류 응답과 같은 경로(합성 오류)로 떨어져야 한다.
    fetchMock.mockResolvedValue(jsonApiResponse({ errors: [null] }, 500))
    const result = await request('/api/v1/examples')
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.status).toBe(500)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]?.code).toBe('NON_JSONAPI_RESPONSE')
  })

  it('재시도하지 않는다', async () => {
    // 스펙 7.2: 회전은 미들웨어에서만 일어난다. 여기서 재시도하면 여러 서버
    // 컴포넌트가 동시에 회전을 시도해 TOKEN_REVOKED 로 로그아웃된다.
    fetchMock.mockResolvedValue(jsonApiResponse(ERROR_NOT_FOUND, 401))
    await request('/api/v1/examples')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('네트워크 실패를 던지지 않고 errors 로 만든다', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'))
    const result = await request('/api/v1/examples')
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.status).toBe(0)
    expect(result.errors[0]?.code).toBe('NETWORK_ERROR')
  })

  // 아래 5개는 뮤테이션 검증 중 스스로 찾은 공백을 메운다.

  it('상태 코드가 오류인데 본문이 JSON:API 오류 문서가 아니면 합성한 오류로 다룬다', async () => {
    // 일부 백엔드/프록시가 5xx 를 내면서 JSON:API 오류 문서 모양이 아닌 평범한
    // JSON 을 줄 수 있다. 이 분기(!response.ok 폴백) 전체를 지워도 브리핑
    // 17개는 전부 green 이었다 - 이 상황(상태 오류 + JSON 파싱 성공 + 오류
    // 문서 아님)을 지나는 테스트가 하나도 없었기 때문이다.
    fetchMock.mockResolvedValue(jsonApiResponse({ message: 'internal server error' }, 500))
    const result = await request('/api/v1/examples')
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.status).toBe(500)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]?.code).toBe('NON_JSONAPI_RESPONSE')
  })

  it('2xx 성공 응답은 실제 상태 코드를 그대로 담는다', async () => {
    // status: response.status 를 status: 200 으로 고정해도 브리핑 17개는
    // 전부 green 이었다 - 200 이외의 2xx(201 Created 등)로 ok:true 결과의
    // status 를 확인하는 테스트가 없었기 때문이다.
    fetchMock.mockResolvedValue(jsonApiResponse(SINGLE_CREATED, 201))
    const result = await request<typeof SINGLE_CREATED>('/api/v1/examples')
    expect(result).toEqual({ ok: true, status: 201, document: SINGLE_CREATED })
  })

  it('JSON 이 아닌 응답의 합성 오류는 code 도 채운다', async () => {
    // 브리핑의 502 테스트는 errors[0].status 만 확인했다 - code 를 다른
    // 문자열로 바꿔치기해도 그 테스트는 green 이었다.
    fetchMock.mockResolvedValue(
      new Response('<html>502</html>', { status: 502, headers: { 'content-type': 'text/html' } }),
    )
    const result = await request('/api/v1/examples')
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.errors[0]?.code).toBe('NON_JSONAPI_RESPONSE')
  })

  it('네트워크 실패의 원문 예외 메시지는 detail 이 아니라 meta 로 간다', async () => {
    // 실측된 결함(S3, 수정 전): detail 이 error.message('fetch failed')를 그대로
    // 담아 groupErrors(...).document 가 그 영어 원문을 그대로 사용자 배너에
    // 띄웠다. detail 은 항상 고정 문구여야 하고(스펙 9.2 가 허용하는, 프론트가
    // 소유하는 세 문장 중 하나), 원문 예외 메시지는 디버깅을 위해 meta 에만
    // 남긴다 - 완전히 버리지는 않는다.
    fetchMock.mockRejectedValue(new TypeError('fetch failed'))
    const result = await request('/api/v1/examples')
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.errors[0]?.detail).toBe('The backend could not be reached.')
    expect(result.errors[0]?.title).toBe('NETWORK_ERROR')
    expect(result.errors[0]?.meta?.cause).toBe('fetch failed')
  })

  it('Error 가 아닌 값으로 실패해도 기본 문구를 쓴다', async () => {
    // fetch 는 Promise 를 reject 하므로 이론상 Error 가 아닌 값으로도 실패할
    // 수 있다(예: 오래된 폴리필, 문자열 reject). error instanceof Error 의
    // false 분기를 지나는 테스트가 브리핑에는 없었다.
    fetchMock.mockRejectedValue('boom')
    const result = await request('/api/v1/examples')
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.status).toBe(0)
    expect(result.errors[0]?.code).toBe('NETWORK_ERROR')
    expect(result.errors[0]?.detail).toBe('The backend could not be reached.')
  })
})

describe('request — 조립 중 예외를 던지지 않는다', () => {
  // 리뷰(라운드 2)가 프로브로 찾았다: fetch 호출 전 요청 조립
  // (JSON.stringify·headers.set)이 동기적으로 던질 수 있는데 그 던짐을 감싸는
  // try/catch 가 없었다. acceptLanguage 는 스펙 9.2 에 따라 미들웨어가 브라우저의
  // Accept-Language 헤더를 그대로 전달하는 값이라 D2 연결 후에는 공격자가 제어할
  // 수 있는 입력이다 - 여기서 던지면 정확히 이 모듈이 막으려던 흰 페이지가 된다.
  // fetch 는 아예 호출되지 않아야 한다 - 조립에 실패한 요청을 보낼 이유가 없다.

  it('본문이 순환 참조면 던지지 않고 errors 로 만든다', async () => {
    fetchMock.mockResolvedValue(jsonApiResponse(COLLECTION_EMPTY))
    const circular: Record<string, unknown> = {}
    circular.self = circular
    const result = await request('/api/v1/examples', { method: 'POST', body: circular })
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.status).toBe(0)
    expect(result.errors[0]?.code).toBe('REQUEST_ASSEMBLY_FAILED')
    expect(fetchMock).not.toHaveBeenCalled()
    // S3: detail 은 고정 문구이고, JSON.stringify 가 던진 원문("Converting
    // circular structure to JSON...")은 사용자 대면 필드가 아니라 meta 로 간다.
    expect(result.errors[0]?.detail).toBe('The request could not be assembled.')
    expect(result.errors[0]?.meta?.cause).toContain('circular structure')
  })

  it('acceptLanguage 에 개행이 섞여도 던지지 않고 errors 로 만든다', async () => {
    // Headers.set 이 CR/LF 를 담은 값을 거절한다(HTTP 헤더 분할 공격 방어).
    fetchMock.mockResolvedValue(jsonApiResponse(COLLECTION_EMPTY))
    const result = await request('/api/v1/examples', {
      acceptLanguage: 'en\r\nX-Injected: evil',
    })
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.status).toBe(0)
    expect(result.errors[0]?.code).toBe('REQUEST_ASSEMBLY_FAILED')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('accessToken 에 잘못된 값이 와도 던지지 않고 errors 로 만든다', async () => {
    fetchMock.mockResolvedValue(jsonApiResponse(COLLECTION_EMPTY))
    const result = await request('/api/v1/examples', {
      accessToken: 'abc\r\ninjected: header',
    })
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.status).toBe(0)
    expect(result.errors[0]?.code).toBe('REQUEST_ASSEMBLY_FAILED')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('request — 합성 오류에는 표시가 붙는다(meta.synthetic, D2 Task 4 인수인계 18번)', () => {
  // errors.ts 의 actionForErrors 가 이 표시로 'transport' 를 고르고,
  // 화면은 그걸로 error.tsx 라우팅 여부를 정한다. 표시가 실제로 판정
  // 수단인지(코드 문자열이 아니라)는 errors.test.ts 가 확인한다 - 여기서는
  // client.ts 가 네 호출부 전부에서 실제로 표시를 남기는지만 확인한다.

  it('REQUEST_ASSEMBLY_FAILED 에 표시가 붙는다', async () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular
    const result = await request('/api/v1/examples', { method: 'POST', body: circular })
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.errors[0]?.meta?.synthetic).toBe(true)
  })

  it('NETWORK_ERROR 에 표시가 붙는다', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'))
    const result = await request('/api/v1/examples')
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.errors[0]?.meta?.synthetic).toBe(true)
  })

  it('NON_JSONAPI_RESPONSE 에 표시가 붙는다(JSON 파싱 실패 경로)', async () => {
    fetchMock.mockResolvedValue(
      new Response('<html>502</html>', { status: 502, headers: { 'content-type': 'text/html' } }),
    )
    const result = await request('/api/v1/examples')
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.errors[0]?.meta?.synthetic).toBe(true)
  })

  it('NON_JSONAPI_RESPONSE 에 표시가 붙는다(오류 문서 아닌 JSON 본문 경로)', async () => {
    // 이 경로는 synthesizeError 에 cause 를 넘기지 않는다 - cause 가 없으면
    // meta 자체를 안 만들던 과거 코드로 돌아가면 이 표시도 같이 사라진다.
    fetchMock.mockResolvedValue(jsonApiResponse({ message: 'internal server error' }, 500))
    const result = await request('/api/v1/examples')
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.errors[0]?.meta?.synthetic).toBe(true)
  })

  it('실제 백엔드 오류 문서에는 표시가 붙지 않는다', async () => {
    // "합성됐다"는 뜻이지 "오류다"라는 뜻이 아니다 - 백엔드가 낸 진짜 오류에도
    // 표시가 붙으면 actionForErrors 가 전부 transport 로 오분류해서 실제
    // 세션 파기·notFound·필드 오류가 화면 대신 error.tsx 로 전부 새 나간다.
    fetchMock.mockResolvedValue(jsonApiResponse(ERROR_NOT_FOUND, 404))
    const result = await request('/api/v1/examples/x')
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.errors[0]?.meta?.synthetic).toBeUndefined()
  })
})

describe('withAcceptLanguage', () => {
  /**
   * 이 함수가 있는 이유는 `exactOptionalPropertyTypes` 다 - "헤더가 없다"를
   * `{ acceptLanguage: undefined }` 로 표현할 수 없어서 키 자체를 빼야 한다.
   * 그 판단을 호출부마다 반복하지 않게 한 곳으로 모았고, 이 테스트가 그
   * 판단을 지킨다.
   *
   * 값은 어느 브라우저도 어느 기본값도 만들 수 없는 것을 쓴다.
   */
  const PROBE_ACCEPT_LANGUAGE = 'xx-ZZ,qq;q=0.3'
  const PROBE_OPTIONS = { method: 'PROBE-METHOD', body: { probe: 'probe-body' } }

  it('값이 있으면 나머지 옵션을 건드리지 않고 얹는다', () => {
    expect(withAcceptLanguage(PROBE_OPTIONS, PROBE_ACCEPT_LANGUAGE)).toEqual({
      method: 'PROBE-METHOD',
      body: { probe: 'probe-body' },
      acceptLanguage: PROBE_ACCEPT_LANGUAGE,
    })
  })

  it('null 이면 키 자체가 없다 - undefined 를 담아 두는 것과 다르다', () => {
    // client.ts 는 `!== undefined` 로 분기하므로 키가 있으면 헤더가 실제로
    // 나간다. "없음"은 키의 부재로만 표현된다.
    const result = withAcceptLanguage(PROBE_OPTIONS, null)
    expect('acceptLanguage' in result).toBe(false)
    expect(result).toEqual(PROBE_OPTIONS)
  })

  it('undefined 여도 키 자체가 없다', () => {
    expect('acceptLanguage' in withAcceptLanguage(PROBE_OPTIONS, undefined)).toBe(false)
  })

  it('빈 문자열은 지우지 않고 그대로 얹는다 - 브라우저 헤더를 편집하지 않는다', () => {
    // 값을 판단하기 시작하면 "무엇을 정상으로 볼 것인가"가 프론트에 생긴다.
    // 백엔드가 빈 값을 기본 언어로 처리하므로 걸러 낼 이유가 없다.
    expect(withAcceptLanguage(PROBE_OPTIONS, '').acceptLanguage).toBe('')
  })

  it('원본 옵션 객체를 변경하지 않는다', () => {
    // 호출부가 만든 리터럴을 그 자리에서 오염시키면, 같은 객체를 재사용하는
    // 미래의 호출부에서 헤더가 유령처럼 따라붙는다.
    const original = { method: 'PROBE-METHOD' }
    withAcceptLanguage(original, PROBE_ACCEPT_LANGUAGE)
    expect(original).toEqual({ method: 'PROBE-METHOD' })
  })
})

describe('request — 타임아웃(스펙 8.5)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  /** 응답하지 않다가 signal 이 끊기면 AbortError 로 거절하는 fetch. */
  function hangUntilAborted(): void {
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'))
          })
        }),
    )
  }

  it('REQUEST_TIMEOUT_MS 는 15초다', () => {
    expect(REQUEST_TIMEOUT_MS).toBe(15_000)
  })

  it('시간이 다 되면 끊고 REQUEST_TIMEOUT 을 합성한다', async () => {
    hangUntilAborted()
    const pending = request('/api/v1/examples')
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS)
    const result = await pending
    expect(result).toMatchObject({ ok: false, status: 0 })
    if (result.ok) throw new Error('끊기지 않았다')
    const [error] = result.errors
    expect(error?.code).toBe('REQUEST_TIMEOUT')
    expect(error?.detail).toBe('The backend did not respond in time.')
    expect(error !== undefined && isSyntheticError(error)).toBe(true)
  })

  it('시간이 다 되기 전에는 끊지 않는다', async () => {
    hangUntilAborted()
    let settled = false
    const pending = request('/api/v1/examples').then((result) => {
      settled = true
      return result
    })
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS - 1)
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await pending
    expect(settled).toBe(true)
  })

  it('본문을 읽다가 멈춰도 끊는다', async () => {
    fetchMock.mockImplementation((_url: string, init: RequestInit) =>
      Promise.resolve({
        status: 200,
        ok: true,
        json: () =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => {
              reject(new DOMException('aborted', 'AbortError'))
            })
          }),
      } as unknown as Response),
    )
    const pending = request('/api/v1/examples')
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS)
    const result = await pending
    if (result.ok) throw new Error('끊기지 않았다')
    expect(result.errors[0]?.code).toBe('REQUEST_TIMEOUT')
  })

  it('끝난 요청은 타이머를 남기지 않는다', async () => {
    fetchMock.mockResolvedValue(jsonApiResponse(COLLECTION_EMPTY))
    await request('/api/v1/examples')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('실패한 요청도 타이머를 남기지 않는다', async () => {
    fetchMock.mockRejectedValue(new TypeError('probe network failure'))
    await request('/api/v1/examples')
    expect(vi.getTimerCount()).toBe(0)
  })

  // 호출자 signal 은 요청보다 오래 살 수 있다(같은 signal 로 여러 번 부르는 호출자). 리스너가
  // 남으면 늦은 abort 가 이미 끝난 요청의 컨트롤러까지 닿고, 요청마다 리스너가 쌓인다.

  it('끝난 요청은 호출자 signal 에 리스너를 남기지 않는다', async () => {
    fetchMock.mockResolvedValue(jsonApiResponse(COLLECTION_EMPTY))
    const caller = new AbortController()
    await request('/api/v1/examples', { signal: caller.signal })
    expect(getEventListeners(caller.signal, 'abort')).toHaveLength(0)
    caller.abort()
    expect(lastCall()[1].signal?.aborted).toBe(false)
  })

  it('실패한 요청도 호출자 signal 에 리스너를 남기지 않는다', async () => {
    fetchMock.mockRejectedValue(new TypeError('probe network failure'))
    const caller = new AbortController()
    await request('/api/v1/examples', { signal: caller.signal })
    expect(getEventListeners(caller.signal, 'abort')).toHaveLength(0)
    caller.abort()
    expect(lastCall()[1].signal?.aborted).toBe(false)
  })
})
