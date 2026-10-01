import { MutationObserver, QueryClient } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { submitOnce } from '@/queries/submit-once'

/**
 * 제출 한 번 가드(queries/submit-once.ts). 실제 QueryClient 의 쓰기로 잰다 - 가드가 기대는 것은 "mutate() 가
 * 돌아오기 전에 그 쓰기가 캐시에서 진행 중이다" 라는 TanStack Query 의 동작이라 가짜로는 잴 수 없다.
 *
 * 키는 실전 값이 아니다(probe).
 */
const KEY = ['probe', 'write'] as const
const OTHER_KEY = ['probe', 'other'] as const
const client = new QueryClient()

afterEach(() => {
  client.clear()
})

/** 끝을 손으로 정하는 쓰기 하나 - `settle` 을 부를 때까지 진행 중이다. */
function manualWrite(mutationKey: readonly string[], fails = false) {
  let settle: () => void = () => undefined
  const gate = new Promise<void>((resolve, reject) => {
    settle = fails ? () => reject(new Error('probe-failure')) : resolve
  })
  const observer = new MutationObserver(client, { mutationKey, mutationFn: () => gate })
  let running: Promise<unknown> = Promise.resolve()
  return {
    submit: vi.fn(() => {
      running = observer.mutate().catch(() => undefined)
    }),
    settle: async () => {
      settle()
      await running
    },
  }
}

describe('submitOnce', () => {
  it('같은 키의 쓰기가 진행 중이면 둘째 제출을 버린다 - mutate() 가 돌아온 바로 그 틱에도', async () => {
    const write = manualWrite([...KEY])
    expect(submitOnce(client, KEY, write.submit)).toBe(true)
    expect(submitOnce(client, KEY, write.submit)).toBe(false)
    expect(write.submit).toHaveBeenCalledTimes(1)
    await write.settle()
  })

  it('쓰기가 끝나면 다시 제출한다 - 실패로 끝나도 같다', async () => {
    const write = manualWrite([...KEY], true)
    submitOnce(client, KEY, write.submit)
    await write.settle()
    expect(submitOnce(client, KEY, write.submit)).toBe(true)
    expect(write.submit).toHaveBeenCalledTimes(2)
    await write.settle()
  })

  it('다른 키의 쓰기는 막지 않는다', async () => {
    const write = manualWrite([...KEY])
    const other = manualWrite([...OTHER_KEY])
    submitOnce(client, KEY, write.submit)
    expect(submitOnce(client, OTHER_KEY, other.submit)).toBe(true)
    await write.settle()
    await other.settle()
  })
})
