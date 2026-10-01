import { MutationObserver, QueryClient, shouldThrowError } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { JsonApiResult, RequestOptions } from '@/lib/jsonapi/client'
import { PROBE_LAB_EXAMPLE_ID } from '@/lib/lab/run'
import { EXAMPLE } from '@/lib/resources'
import { isSessionRejected } from '@/lib/resources/write'
import { labExperimentMutationOptions } from '@/queries/lab'

/**
 * 실험 하나의 쓰기 옵션(queries/lab.ts) - 훅과 시험이 함께 쓴다. TanStack Query 의 MutationObserver 로 그대로 돌려
 * 셋을 잰다: 던져진 것이 오류 경계로 가는지(`throwOnError`), 훅이 꽂는 세션 관리자·API 클라이언트·기기 언어의
 * 배선(`LAB_DEPS`), 그리고 실험 id 가 실행부와 쓰기 키에 닿는지. 훅 자체는 시험하지 않는다(스펙 11.1) - 훅은 이
 * 옵션을 `useMutation` 에 넘길 뿐이다.
 *
 * 세션 관리자와 API 클라이언트만 가짜다 - 실행부(lib/lab/run.ts)·쓰기의 토큰 길(lib/resources/write.ts)과 Query
 * 캐시는 진짜다. 실험마다의 갈래는 test/unit/lab/run.test.ts 가 잰다.
 */
const mocks = vi.hoisted(() => ({
  send: vi.fn<(path: string, options?: RequestOptions) => Promise<JsonApiResult<unknown>>>(),
  language: vi.fn<() => string | null>(),
  getAccessToken: vi.fn<() => Promise<string | null>>(),
  current: vi.fn<() => { accessExpiresAt: number } | null>(),
}))

vi.mock('@/platform/api', () => ({ apiRequest: mocks.send, deviceAcceptLanguage: mocks.language }))
vi.mock('@/platform/session', () => ({
  sessionManager: { getAccessToken: mocks.getAccessToken, current: mocks.current },
}))

const TOKEN = 'probe-access'
const LANGUAGE = 'probe-lang'

let client: QueryClient

beforeEach(() => {
  client = new QueryClient()
  mocks.send.mockReset().mockResolvedValue({ ok: true, status: 201, document: { data: null } })
  mocks.language.mockReset().mockReturnValue(LANGUAGE)
  mocks.getAccessToken.mockReset().mockResolvedValue(TOKEN)
  mocks.current.mockReset().mockReturnValue({ accessExpiresAt: Date.now() + 900_000 })
})

afterEach(() => {
  client.clear()
  vi.restoreAllMocks()
})

/** 실험 하나를 돌려, 상태와 결과와 오류와 "훅이 이 오류를 렌더 중에 다시 던지는가" 를 돌려준다. */
async function run(id: string) {
  const observer = new MutationObserver(client, labExperimentMutationOptions(id))
  await observer.mutate().catch(() => undefined)
  const { status, error, data } = observer.getCurrentResult()
  // `useMutation` 이 렌더 중에 하는 판단 그대로다 - 거짓이면 오류는 `mutate()` 가 삼킨다.
  const surfaced = error !== null && shouldThrowError(observer.options.throwOnError, [error])
  return { status, error, data, surfaced }
}

describe('실험의 throwOnError - 결함만 오류 경계로 간다', () => {
  it('세션 거절이 아닌 예외는 결함이다 - 오류 경계로 간다', async () => {
    mocks.send.mockRejectedValue(new Error('probe-defect'))

    const { status, error, surfaced } = await run('invalidFilter')

    expect(status).toBe('error')
    expect(error?.message).toBe('probe-defect')
    expect(surfaced).toBe(true)
    // 훅이 실험 id 를 실행부에 넘겼다 - invalidFilter 는 세션이 필요 없어 토큰을 묻지 않고 목록 경로로 나간다
    // (putUpsert 였다면 토큰을 묻고 한 건의 경로로 나간다).
    expect(mocks.getAccessToken).not.toHaveBeenCalled()
    expect(mocks.send.mock.calls[0]?.[0]).toBe(EXAMPLE.path)
  })

  it('세션 거절은 오류 경계로 가지 않는다 - 쓰기 캐시의 onError 와 화면의 콜백이 받는다', async () => {
    mocks.getAccessToken.mockResolvedValue(null)

    const { status, error, surfaced } = await run('putUpsert')

    expect(status).toBe('error')
    expect(isSessionRejected(error)).toBe(true)
    expect(surfaced).toBe(false)
    expect(mocks.send).not.toHaveBeenCalled()
  })
})

describe('배선 - 세션 관리자·API 클라이언트·기기 언어', () => {
  it('세션 관리자의 토큰과 기기 언어를 실어 보내고 결과를 돌려준다 - 키는 실험마다 다르다', async () => {
    const { status, data } = await run('putUpsert')

    expect(status).toBe('success')
    expect(data?.kind).toBe('result')
    expect(mocks.send).toHaveBeenCalledTimes(1)
    expect(mocks.send.mock.calls[0]?.[0]).toBe(`${EXAMPLE.path}/${PROBE_LAB_EXAMPLE_ID}`)
    expect(mocks.send.mock.calls[0]?.[1]).toMatchObject({
      method: 'PUT',
      accessToken: TOKEN,
      acceptLanguage: LANGUAGE,
    })
    expect(labExperimentMutationOptions('putUpsert').mutationKey).toEqual(['lab', 'putUpsert'])
    // 키는 실험 id 를 따른다 - 다른 id 로도 재야 고정된 키를 잡는다.
    const otherKey = labExperimentMutationOptions('invalidFilter').mutationKey
    expect(otherKey).toEqual(['lab', 'invalidFilter'])
  })

  it('세션 관리자의 지금 세션이 이미 만료됐으면 보내지 않는다 - unusable 이고 오류가 아니다(만료 가드)', async () => {
    mocks.current.mockReturnValue({ accessExpiresAt: Date.now() - 1 })

    const { status, data, surfaced } = await run('putUpsert')

    expect(status).toBe('success')
    expect(data).toEqual({ kind: 'unusable' })
    expect(surfaced).toBe(false)
    expect(mocks.send).not.toHaveBeenCalled()
  })
})
