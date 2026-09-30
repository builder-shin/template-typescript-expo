import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { JSONAPI_MEDIA_TYPE, request } from '@/lib/jsonapi/client'
import { actionForErrors } from '@/lib/jsonapi/errors'
import { ERROR_VALIDATION } from '../../fixtures/documents'

/**
 * D2 Task 4, 인수인계 18번이 요구하는 "합성 오류를 백엔드 오류와 구별하는
 * 수단"은 client.ts(표시를 남긴다)와 errors.ts(표시를 읽어 'transport'를
 * 고른다) 두 파일에 걸쳐 있다. client.test.ts 는 client.ts 만, errors.test.ts
 * 는 errors.ts 만 각자 단위로 잰다 - 두 파일을 실제로 이어 붙였을 때도
 * 옳은지는 어느 쪽도 확인하지 않는다(예: 한쪽이 쓰는 meta 키 이름과 다른
 * 쪽이 읽는 키 이름이 어긋나도 각자의 단위 테스트는 독립적으로 계속
 * green 일 수 있다). 이 파일은 그 이음매를 잰다 - request() 가 만든 진짜
 * JsonApiResult 를 실제로 actionForErrors 에 넣어 본다.
 */

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

describe('request() → actionForErrors 이음매', () => {
  it('네트워크 실패는 request() 를 거쳐 transport 로 분류된다', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'))
    const result = await request('/api/v1/examples')
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    expect(actionForErrors(result.errors)).toBe('transport')
  })

  it('조립 실패(순환 참조 바디)는 request() 를 거쳐 transport 로 분류된다', async () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular
    const result = await request('/api/v1/examples', { method: 'POST', body: circular })
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    expect(actionForErrors(result.errors)).toBe('transport')
  })

  it('JSON 이 아닌 응답은 request() 를 거쳐 transport 로 분류된다', async () => {
    fetchMock.mockResolvedValue(
      new Response('<html>502</html>', { status: 502, headers: { 'content-type': 'text/html' } }),
    )
    const result = await request('/api/v1/examples')
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    expect(actionForErrors(result.errors)).toBe('transport')
  })

  it('실제 백엔드 검증 오류는 request() 를 거쳐도 transport 가 아니다(음성 대조군)', async () => {
    // 표시가 모든 오류에 번져 실제 백엔드 오류까지 삼키면, 세션 파기·notFound·
    // 필드 오류가 전부 배너/폼 대신 error.tsx 로 새 나간다 - 그 반대를 확인한다.
    fetchMock.mockResolvedValue(jsonApiResponse(ERROR_VALIDATION, 422))
    const result = await request('/api/v1/examples', { method: 'POST', body: {} })
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    expect(actionForErrors(result.errors)).toBe('fieldErrors')
  })
})
