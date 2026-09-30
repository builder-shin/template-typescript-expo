import { describe, expect, it } from 'vitest'
import { isAccessExpiring, sessionFromTokenDocument } from '@/lib/auth/tokens'

const NOW = 1_800_000_000_000 // 고정 시각. Date.now() 를 스텁하지 않고 주입한다.

describe('sessionFromTokenDocument', () => {
  it('expiresIn 을 절대 만료 시각으로 바꾼다', () => {
    // 백엔드가 expiresIn(초)을 문서에 실어 온다 - JWT 를 디코드할 필요가 없다.
    const session = sessionFromTokenDocument(
      {
        accessToken: 'a',
        refreshToken: 'r',
        tokenType: 'Bearer',
        expiresIn: 900,
        refreshExpiresIn: 2592000,
      },
      NOW,
    )
    expect(session).toEqual({ accessToken: 'a', refreshToken: 'r', accessExpiresAt: NOW + 900_000 })
  })

  it('expiresIn 이 0 이어도 만들어진다', () => {
    // 이미 만료된 세션도 표현할 수 있어야 회전 판정이 그것을 본다.
    const s = sessionFromTokenDocument(
      {
        accessToken: 'a',
        refreshToken: 'r',
        tokenType: 'Bearer',
        expiresIn: 0,
        refreshExpiresIn: 1,
      },
      NOW,
    )
    expect(s.accessExpiresAt).toBe(NOW)
  })
})

describe('isAccessExpiring', () => {
  const at = (msFromNow: number) => ({
    accessToken: 'a',
    refreshToken: 'r',
    accessExpiresAt: NOW + msFromNow,
  })

  it('만료까지 60초를 넘게 남았으면 회전하지 않는다', () => {
    expect(isAccessExpiring(at(61_000), NOW)).toBe(false)
  })

  it('만료가 60초 이내로 임박하면 회전한다', () => {
    // 스펙 7.2: access 만료가 임박(<=60초)하면 프록시가 회전한다.
    expect(isAccessExpiring(at(60_000), NOW)).toBe(true)
    expect(isAccessExpiring(at(1_000), NOW)).toBe(true)
  })

  it('이미 만료됐으면 회전한다', () => {
    expect(isAccessExpiring(at(0), NOW)).toBe(true)
    expect(isAccessExpiring(at(-10_000), NOW)).toBe(true)
  })
})
