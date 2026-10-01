import { MutationObserver, QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { JsonApiResult } from '@/lib/jsonapi/client'
import { loginMutationOptions, registerMutationOptions } from '@/queries/auth'

/**
 * 로그인·가입 쓰기의 세션 세우기(queries/auth.ts 의 establishIfSignedIn). 세션 관리자는 저장소 쓰기가 실패하면
 * 메모리에 세운 뒤 거절한다(lib/auth/session-manager.ts) - 그 거절은 로그인 실패가 아니라서 쓰기가 성공한
 * 결정으로 끝나야 하고, 오류는 삼키지 않고 이름과 문구만 남아야 한다.
 *
 * 훅이 쓰는 옵션을 TanStack Query 의 MutationObserver 로 그대로 돌린다 - 쓰기의 상태(성공·실패)와 onError 가
 * 실제 쓰기 캐시에서 어떻게 끝나는지를 본다. API 클라이언트와 세션 관리자만 가짜다.
 */
const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn<(path: string) => Promise<JsonApiResult<unknown>>>(),
  establish: vi.fn<() => Promise<void>>(),
}))

vi.mock('@/platform/api', () => ({ apiRequest: mocks.apiRequest }))
vi.mock('@/platform/session', () => ({ sessionManager: { establish: mocks.establish } }))

const CREDENTIALS = { email: 'probe-user@probe.example', password: 'probe-password-value' }
const NEXT = '/examples/new'

const TOKENS: JsonApiResult<unknown> = {
  ok: true,
  status: 200,
  document: {
    data: {
      type: 'authTokens',
      id: 'probe-jti',
      attributes: {
        accessToken: 'probe-access',
        refreshToken: 'probe-refresh',
        tokenType: 'Bearer',
        expiresIn: 300,
        refreshExpiresIn: 86_400,
      },
    },
  },
}
const CREATED: JsonApiResult<unknown> = {
  ok: true,
  status: 201,
  document: { data: { type: 'users', id: 'probe-user' } },
}
const REJECTED: JsonApiResult<unknown> = {
  ok: false,
  status: 401,
  errors: [{ status: '401', code: 'PROBE_BAD_CREDENTIALS', detail: 'probe-bad-credentials' }],
}

let client: QueryClient

beforeEach(() => {
  client = new QueryClient()
  mocks.apiRequest.mockReset()
  mocks.establish.mockReset().mockResolvedValue()
})

afterEach(() => {
  client.clear()
  vi.restoreAllMocks()
})

describe('loginMutationOptions - 세션을 세우는 데까지', () => {
  it('세션을 저장소에 쓰지 못해도(establish 거절) 쓰기는 성공한 결정으로 끝나고 오류의 이름과 문구만 남는다', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    mocks.apiRequest.mockResolvedValue(TOKENS)
    mocks.establish.mockRejectedValue(new Error('probe-storage'))
    const observer = new MutationObserver(client, loginMutationOptions(NEXT))

    const plan = await observer.mutate(CREDENTIALS)

    expect(plan).toMatchObject({ kind: 'establish', to: NEXT, refreshExpiresIn: 86_400 })
    expect(observer.getCurrentResult().status).toBe('success')
    expect(mocks.establish).toHaveBeenCalledTimes(1)
    expect(logged).toHaveBeenCalledTimes(1)
    expect(String(logged.mock.calls[0]?.[0])).toContain('Error: probe-storage')
    expect(String(logged.mock.calls[0]?.[0])).not.toContain('probe-access')
  })

  it('세션을 세우면 아무것도 남기지 않는다', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    mocks.apiRequest.mockResolvedValue(TOKENS)
    const observer = new MutationObserver(client, loginMutationOptions(NEXT))

    await observer.mutate(CREDENTIALS)

    expect(mocks.establish).toHaveBeenCalledTimes(1)
    expect(logged).not.toHaveBeenCalled()
  })

  it('백엔드가 거절하면 세션을 세우지 않고 폼 상태를 돌려준다', async () => {
    mocks.apiRequest.mockResolvedValue(REJECTED)
    const observer = new MutationObserver(client, loginMutationOptions(NEXT))

    const plan = await observer.mutate(CREDENTIALS)

    expect(plan.kind).toBe('state')
    expect(mocks.establish).not.toHaveBeenCalled()
  })
})

describe('registerMutationOptions - 가입 뒤 로그인까지', () => {
  it('세션을 저장소에 쓰지 못해도 가입은 성공한 결정으로 끝난다 - 계정도 세션(메모리)도 이미 있다', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    mocks.apiRequest.mockResolvedValueOnce(CREATED).mockResolvedValueOnce(TOKENS)
    mocks.establish.mockRejectedValue(new Error('probe-storage'))
    const observer = new MutationObserver(client, registerMutationOptions(NEXT))

    const plan = await observer.mutate(CREDENTIALS)

    expect(plan).toMatchObject({ kind: 'establish', to: NEXT })
    expect(observer.getCurrentResult().status).toBe('success')
    expect(mocks.apiRequest).toHaveBeenCalledTimes(2)
    expect(logged).toHaveBeenCalledTimes(1)
    expect(String(logged.mock.calls[0]?.[0])).toContain('Error: probe-storage')
  })
})
