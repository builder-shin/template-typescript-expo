import { describe, expect, it } from 'vitest'

import { createOnce } from '@/lib/navigation/once'

/** 두 번 누름의 이동 가드(D3 최종 검토 M8) - 화면에 잇는 것(초점이 돌아오면 푼다)은 components/app/navigate-once.ts. */
describe('createOnce - 한 번만 도는 이동', () => {
  it('잠긴 동안의 둘째 부름은 버린다 - 이동은 한 번이다', () => {
    const once = createOnce()
    const moves: string[] = []
    expect(
      once.run(() => {
        moves.push('probe-first')
      }),
    ).toBe(true)
    expect(
      once.run(() => {
        moves.push('probe-second')
      }),
    ).toBe(false)
    expect(moves).toEqual(['probe-first'])
  })

  it('풀면 다시 부른다 - 누른 화면이 다시 앞에 왔을 때다', () => {
    const once = createOnce()
    const moves: string[] = []
    once.run(() => {
      moves.push('probe-first')
    })
    once.release()
    expect(
      once.run(() => {
        moves.push('probe-again')
      }),
    ).toBe(true)
    expect(moves).toEqual(['probe-first', 'probe-again'])
  })

  it('이동이 던지면 잠그지 않는다 - 다음 누름이 다시 부른다', () => {
    const once = createOnce()
    expect(() =>
      once.run(() => {
        throw new Error('probe-navigation')
      }),
    ).toThrow('probe-navigation')
    const moves: string[] = []
    expect(
      once.run(() => {
        moves.push('probe-retry')
      }),
    ).toBe(true)
    expect(moves).toEqual(['probe-retry'])
  })
})
