import { MutationObserver, QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { JsonApiResult } from '@/lib/jsonapi/client'
import {
  LOGIN_MUTATION_KEY,
  REGISTER_MUTATION_KEY,
  loginMutationOptions,
  registerMutationOptions,
} from '@/queries/auth'
import { submitOnce } from '@/queries/submit-once'

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

/**
 * 쓰기의 키 - 자격증명 폼의 제출 가드(queries/submit-once.ts)가 진행 중인 제출을 찾는 이름. 폼은 키를 받아(화면이
 * `LOGIN_MUTATION_KEY`·`REGISTER_MUTATION_KEY` 를 넘긴다) 같은 키의 쓰기가 진행 중이면 제출을 버린다. 옵션에서 키가 빠지거나
 * 바뀌면 쓰기가 캐시에 다른 이름으로 올라 가드가 아무 오류 없이 꺼진다 - 그래서 옵션이 만든 쓰기를 가드가 실제로 찾는지
 * 본다. 화면이 그 상수를 폼에 넘기는 배선과 버튼·키보드 이동 키의 감싸기는 컴포넌트 시험이 없어(스펙 11.1) 여기서 재지
 * 못한다 - 기기에서 두 번 제출을 누르는 E2E 만 잴 수 있다.
 */
describe('쓰기의 키 - 제출 한 번 가드가 진행 중인 제출을 찾는 이름', () => {
  it.each([
    {
      name: '로그인',
      options: loginMutationOptions,
      own: LOGIN_MUTATION_KEY,
      other: REGISTER_MUTATION_KEY,
      // 붙잡아 둔 첫 요청의 답 - 로그인은 그 요청이 로그인이다
      firstAnswer: TOKENS,
    },
    {
      name: '가입',
      options: registerMutationOptions,
      own: REGISTER_MUTATION_KEY,
      other: LOGIN_MUTATION_KEY,
      // 가입은 첫 요청이 가입이고, 이어서 부르는 로그인은 바로 답한다
      firstAnswer: CREATED,
    },
  ])(
    '$name 쓰기가 진행 중인 동안 가드는 같은 키의 제출을 버리고 다른 쓰기의 키는 비어 있다',
    async ({ options, own, other, firstAnswer }) => {
      let answer: (result: JsonApiResult<unknown>) => void = () => undefined
      mocks.apiRequest
        .mockReturnValueOnce(
          new Promise<JsonApiResult<unknown>>((resolve) => {
            answer = resolve
          }),
        )
        .mockResolvedValue(TOKENS)
      const observer = new MutationObserver(client, options(NEXT))
      const running = observer.mutate(CREDENTIALS)
      const submit = vi.fn()

      expect(submitOnce(client, own, submit)).toBe(false)
      expect(submit).not.toHaveBeenCalled()
      expect(client.isMutating({ mutationKey: other })).toBe(0)

      answer(firstAnswer)
      await running

      // 끝나면 풀린다 - 같은 키로 다시 제출할 수 있다
      expect(submitOnce(client, own, submit)).toBe(true)
      expect(submit).toHaveBeenCalledTimes(1)
    },
  )
})
