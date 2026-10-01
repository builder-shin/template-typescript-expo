import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { sessionRejected } from '@/lib/resources/write'
import { queryClient } from '@/platform/query-client'

/**
 * platform/query-client.ts 의 인증 오류 처리 - 스펙 9.2 의 "한 곳". 쓰기 흐름(lib/resources/write.ts)이
 * 세션 거절을 던지면 쓰기 캐시의 onError 가 기기 세션을 지운다. 판정(isSessionRejected)은 write.test.ts
 * 가 재고, 여기서는 그 판정이 세션 관리자에 **이어져 있는지**를 잰다 - 이 배선이 빠지면 판정의 시험은
 * 모두 통과하는데 세션 거절을 받은 쓰기 화면이 그대로 남는다.
 *
 * 기기 모듈(react-native·NetInfo)과 세션 관리자는 가짜로 바꾼다. Query 캐시와 쓰기는 진짜다.
 */
const mocks = vi.hoisted(() => ({ signOut: vi.fn<() => Promise<void>>() }))

vi.mock('react-native', () => ({ AppState: { addEventListener: vi.fn() } }))
vi.mock('@react-native-community/netinfo', () => ({ default: { addEventListener: vi.fn() } }))
vi.mock('@/platform/session', () => ({ sessionManager: { signOut: mocks.signOut } }))

/** 쓰기 하나를 진짜 쓰기 캐시로 돌린다 - 실패는 삼킨다(onError 가 불렸는지만 본다). */
async function runWrite(mutationFn: () => Promise<unknown>): Promise<void> {
  const mutation = queryClient.getMutationCache().build(queryClient, { mutationFn })
  await mutation.execute(undefined).catch(() => undefined)
}

beforeEach(() => {
  mocks.signOut.mockReset().mockResolvedValue()
})

afterEach(() => {
  queryClient.clear()
  vi.restoreAllMocks()
})

describe('queryClient 의 쓰기 캐시 - 인증 오류 처리(스펙 9.2)', () => {
  it('쓰기가 세션 거절을 던지면 기기 세션을 지운다', async () => {
    await runWrite(() => Promise.reject(sessionRejected()))
    expect(mocks.signOut).toHaveBeenCalledTimes(1)
  })

  it('다른 실패와 성공에는 세션을 건드리지 않는다', async () => {
    await runWrite(() => Promise.reject(new Error('probe-failure')))
    await runWrite(() => Promise.resolve('probe-success'))
    expect(mocks.signOut).not.toHaveBeenCalled()
  })

  it('세션을 지우다 저장소가 실패해도 던지지 않고 이름과 문구만 기기 로그에 남긴다', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    mocks.signOut.mockRejectedValue(new Error('probe-storage'))
    await runWrite(() => Promise.reject(sessionRejected()))
    await vi.waitFor(() => {
      expect(logged).toHaveBeenCalledTimes(1)
    })
    expect(String(logged.mock.calls[0]?.[0])).toContain('Error: probe-storage')
  })
})
