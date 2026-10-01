import { MutationObserver, QueryClient, shouldThrowError } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { updateCheckMutationOptions } from '@/queries/updates'

/**
 * "업데이트 확인" 의 쓰기 옵션(queries/updates.ts) - 훅과 시험이 함께 쓴다. TanStack Query 의 MutationObserver 로
 * 그대로 돌려 두 가지를 잰다: 훅이 꽂는 expo-updates 의 세 호출(platform/updates.ts 의 `updatesApi`)의 배선과,
 * 던져진 것이 오류 경계로 가는지(`throwOnError`). 훅 자체는 시험하지 않는다(스펙 11.1). 확인의 갈래는
 * test/unit/updates/build-info.test.ts 가 잰다.
 */
const mocks = vi.hoisted(() => ({
  checkForUpdateAsync:
    vi.fn<() => Promise<{ isAvailable: boolean; isRollBackToEmbedded: boolean }>>(),
  fetchUpdateAsync: vi.fn<() => Promise<{ isNew: boolean; isRollBackToEmbedded: boolean }>>(),
  reloadAsync: vi.fn<() => Promise<void>>(),
}))

vi.mock('@/platform/updates', () => ({
  updatesApi: {
    checkForUpdateAsync: mocks.checkForUpdateAsync,
    fetchUpdateAsync: mocks.fetchUpdateAsync,
    reloadAsync: mocks.reloadAsync,
  },
  readBuildInfo: vi.fn(),
}))

let client: QueryClient

beforeEach(() => {
  client = new QueryClient()
  mocks.checkForUpdateAsync
    .mockReset()
    .mockResolvedValue({ isAvailable: true, isRollBackToEmbedded: false })
  mocks.fetchUpdateAsync.mockReset().mockResolvedValue({ isNew: true, isRollBackToEmbedded: false })
  mocks.reloadAsync.mockReset().mockResolvedValue(undefined)
})

afterEach(() => {
  client.clear()
  vi.restoreAllMocks()
})

/** 확인을 한 번 돌려 상태와 결과와 오류를 돌려준다. */
async function run() {
  const observer = new MutationObserver(client, updateCheckMutationOptions())
  await observer.mutate().catch(() => undefined)
  return observer.getCurrentResult()
}

describe('업데이트 확인의 쓰기 옵션 - 스펙 10.6', () => {
  it('expo-updates 의 세 호출을 차례로 부르고 결과를 값으로 돌려준다 - 키는 하나다', async () => {
    const { status, data } = await run()

    expect(status).toBe('success')
    expect(data).toEqual({ kind: 'reloading' })
    expect(mocks.checkForUpdateAsync).toHaveBeenCalledTimes(1)
    expect(mocks.fetchUpdateAsync).toHaveBeenCalledTimes(1)
    expect(mocks.reloadAsync).toHaveBeenCalledTimes(1)
    expect(updateCheckMutationOptions().mutationKey).toEqual(['updates', 'check'])
  })

  it('expo-updates 의 거절은 오류가 아니라 결과 값이다 - 카드가 문구로 그린다', async () => {
    mocks.checkForUpdateAsync.mockRejectedValue(new Error('probe-rejection'))

    const { status, data, error } = await run()

    expect(status).toBe('success')
    expect(data).toEqual({ kind: 'failed', message: 'probe-rejection' })
    expect(error).toBeNull()
    expect(mocks.fetchUpdateAsync).not.toHaveBeenCalled()
  })

  it('던져진 것은 결함이다 - 렌더 중에 다시 던져 오류 경계로 간다(throwOnError)', () => {
    // `useMutation` 이 렌더 중에 하는 판단 그대로다 - 거짓이면 오류는 `mutate()` 가 삼킨다.
    expect(
      shouldThrowError(updateCheckMutationOptions().throwOnError, [new Error('probe-defect')]),
    ).toBe(true)
  })
})
