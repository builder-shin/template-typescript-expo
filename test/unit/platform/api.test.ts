import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'

import type { AppVariant } from '@/lib/config/app-variant'
import type { JsonApiResult, RequestOptions } from '@/lib/jsonapi/client'
import { apiRequest, deviceAcceptLanguage } from '@/platform/api'

/**
 * platform/api.ts 의 배선(스펙 9.4·11.3). 언어 조립(accept-language.ts)·실패 한 줄(failure-log.ts)·
 * 변형 표(app-variant.ts)의 판단은 각자의 시험이 재고, 여기서는 apiRequest 가 그것들을 **부르는지**를
 * 잰다 - Accept-Language 를 싣는 자리가 이 함수 하나라서, 언어 인자를 null 로 바꾸는 뮤턴트가 판단의
 * 시험을 모두 통과한다.
 *
 * 기기 모듈(expo-localization)·설정 자리(platform/config.ts)·네트워크(request)는 가짜로 바꾼다.
 * request 만 가짜이고 withAcceptLanguage 와 나머지 client.ts 는 진짜다.
 */
const mocks = vi.hoisted(() => ({
  getLocales: vi.fn<() => { languageTag: string }[]>(),
  startupVariant: vi.fn<() => AppVariant>(),
  request: vi.fn<(path: string, options?: RequestOptions) => Promise<JsonApiResult<unknown>>>(),
}))

vi.mock('expo-localization', () => ({ getLocales: mocks.getLocales }))
vi.mock('@/platform/config', () => ({ startupVariant: mocks.startupVariant }))
vi.mock('@/lib/jsonapi/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/jsonapi/client')>()),
  request: mocks.request,
}))

const KO_EN = 'ko-KR,en-US;q=0.9'
const SUCCESS: JsonApiResult<unknown> = { ok: true, status: 200, document: { data: null } }
const NO_CONTENT: JsonApiResult<unknown> = { ok: true, status: 204, document: null }
const CONFLICT: JsonApiResult<unknown> = {
  ok: false,
  status: 409,
  errors: [{ status: '409', code: 'EMAIL_ALREADY_REGISTERED' }],
}

/** request 에 실제로 넘어간 옵션(호출마다 하나). */
function sentOptions(): (RequestOptions | undefined)[] {
  return mocks.request.mock.calls.map(([, options]) => options)
}

let info: MockInstance<typeof console.info>

beforeEach(() => {
  mocks.getLocales.mockReset().mockReturnValue([{ languageTag: 'ko-KR' }, { languageTag: 'en-US' }])
  mocks.startupVariant.mockReset().mockReturnValue('production')
  mocks.request.mockReset().mockResolvedValue(SUCCESS)
  info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('apiRequest - Accept-Language 를 싣는 유일한 자리(스펙 9.4)', () => {
  it('기기 언어 목록으로 만든 Accept-Language 를 모든 요청에 싣는다', async () => {
    await apiRequest('/api/v1/probe')
    await apiRequest('/api/v1/probe', { method: 'POST' })

    expect(mocks.request).toHaveBeenNthCalledWith(1, '/api/v1/probe', { acceptLanguage: KO_EN })
    expect(mocks.request).toHaveBeenNthCalledWith(2, '/api/v1/probe', {
      method: 'POST',
      acceptLanguage: KO_EN,
    })
  })

  it('호출자가 넘긴 옵션은 그대로 싣고 언어만 더한다 - 호출자의 객체는 건드리지 않는다', async () => {
    const controller = new AbortController()
    const options: RequestOptions = {
      method: 'PATCH',
      body: { probe: 1 },
      accessToken: 'probe-access-token',
      query: new URLSearchParams({ page: '2' }),
      signal: controller.signal,
    }

    await apiRequest('/api/v1/probe', options)

    const [sent] = sentOptions()
    expect(sent).toEqual({ ...options, acceptLanguage: KO_EN })
    expect(sent?.query).toBe(options.query)
    expect(sent?.signal).toBe(controller.signal)
    expect(options).not.toHaveProperty('acceptLanguage')
  })

  it('요청마다 기기 언어를 다시 읽는다 - 앱이 켜진 채 언어를 바꿔도 다음 요청이 따른다', async () => {
    await apiRequest('/api/v1/probe')
    mocks.getLocales.mockReturnValue([{ languageTag: 'en-GB' }])
    await apiRequest('/api/v1/probe')

    expect(sentOptions().map((options) => options?.acceptLanguage)).toEqual([KO_EN, 'en-GB'])
  })

  it('호출자가 언어를 정했으면 그 값을 싣는다 - 기기 언어로 덮지 않는다(계약 실험실의 언어 협상, 스펙 8.6)', async () => {
    await apiRequest('/api/v1/probe', { method: 'POST', acceptLanguage: 'probe-lang' })

    expect(sentOptions()).toEqual([{ method: 'POST', acceptLanguage: 'probe-lang' }])
  })

  it('deviceAcceptLanguage 는 apiRequest 가 싣는 기기 언어 값이다 - 쓸 태그가 없으면 null', async () => {
    await apiRequest('/api/v1/probe')

    expect(deviceAcceptLanguage()).toBe(KO_EN)
    expect(sentOptions()[0]?.acceptLanguage).toBe(deviceAcceptLanguage())
    mocks.getLocales.mockReturnValue([])
    expect(deviceAcceptLanguage()).toBeNull()
  })

  it.each([
    ['빈 목록', []],
    ['쓸 수 없는 태그뿐', [{ languageTag: '' }, { languageTag: '@@' }]],
  ])('기기 언어가 %s 이면 옵션을 건드리지 않는다 - 헤더를 싣지 않는다', async (_label, locales) => {
    mocks.getLocales.mockReturnValue(locales)
    const options: RequestOptions = { method: 'DELETE', accessToken: 'probe-access-token' }

    await apiRequest('/api/v1/probe', options)
    await apiRequest('/api/v1/probe')

    const [withOptions, withoutOptions] = sentOptions()
    expect(withOptions).toEqual(options)
    expect(withOptions).not.toHaveProperty('acceptLanguage')
    expect(withoutOptions).toEqual({})
  })

  it('요청의 결과를 그대로 돌려준다 - 성공도 실패도', async () => {
    mocks.request.mockResolvedValueOnce(SUCCESS).mockResolvedValueOnce(CONFLICT)

    await expect(apiRequest('/api/v1/probe')).resolves.toBe(SUCCESS)
    await expect(apiRequest('/api/v1/probe')).resolves.toBe(CONFLICT)
  })
})

describe('apiRequest - e2e 변형의 실패 표식(스펙 11.3)', () => {
  it('e2e 는 2xx 가 아닌 결과를 표식과 함께 한 줄로 남긴다', async () => {
    mocks.startupVariant.mockReturnValue('e2e')
    mocks.request.mockResolvedValue(CONFLICT)

    const result = await apiRequest('/api/v1/auth/register', { method: 'POST' })

    expect(result).toBe(CONFLICT)
    expect(info).toHaveBeenCalledTimes(1)
    expect(info).toHaveBeenCalledWith(
      '[e2e-http] 409 POST /api/v1/auth/register EMAIL_ALREADY_REGISTERED',
    )
  })

  it('메서드를 주지 않으면 GET 으로, 백엔드에 닿지 못한 요청은 상태 0 으로 적는다', async () => {
    mocks.startupVariant.mockReturnValue('e2e')
    mocks.request.mockResolvedValue({
      ok: false,
      status: 0,
      errors: [{ code: 'NETWORK_ERROR' }],
    })

    await apiRequest('/health/ready')

    expect(info).toHaveBeenCalledTimes(1)
    expect(info).toHaveBeenCalledWith('[e2e-http] 0 GET /health/ready NETWORK_ERROR')
  })

  it.each(['development', 'preview', 'production'] as const)(
    '%s 는 실패해도 남기지 않는다',
    async (variant) => {
      mocks.startupVariant.mockReturnValue(variant)
      mocks.request.mockResolvedValue(CONFLICT)

      await expect(apiRequest('/api/v1/auth/register', { method: 'POST' })).resolves.toBe(CONFLICT)

      expect(info).not.toHaveBeenCalled()
    },
  )

  it.each([SUCCESS, NO_CONTENT])('e2e 라도 2xx(%j)는 남기지 않는다', async (result) => {
    mocks.startupVariant.mockReturnValue('e2e')
    mocks.request.mockResolvedValue(result)

    await expect(apiRequest('/api/v1/probe')).resolves.toBe(result)

    expect(info).not.toHaveBeenCalled()
  })

  it('한 줄에 토큰·본문·쿼리·문구를 싣지 않는다 - 로그에 자격증명이 남지 않는다', async () => {
    mocks.startupVariant.mockReturnValue('e2e')
    mocks.request.mockResolvedValue({
      ok: false,
      status: 401,
      errors: [
        {
          code: 'INVALID_CREDENTIALS',
          title: 'probe-title-text',
          detail: 'probe-detail-text',
          source: { pointer: '/data/attributes/email' },
        },
      ],
    })

    await apiRequest('/api/v1/auth/login', {
      method: 'POST',
      accessToken: 'probe-access-token',
      body: { data: { attributes: { email: 'probe@example.test', password: 'probe-password' } } },
      query: new URLSearchParams({ email: 'probe@example.test' }),
    })

    // 인자가 정확히 한 줄이다 - 옵션이나 결과를 함께 넘기지 않는다.
    expect(info).toHaveBeenCalledTimes(1)
    expect(info).toHaveBeenCalledWith('[e2e-http] 401 POST /api/v1/auth/login INVALID_CREDENTIALS')
    const logged = JSON.stringify(info.mock.calls)
    for (const secret of [
      'probe-access-token',
      'probe-password',
      'probe@example.test',
      'probe-title-text',
      'probe-detail-text',
    ]) {
      expect(logged).not.toContain(secret)
    }
  })
})
