import { describe, expect, it } from 'vitest'
import {
  SESSION_STORAGE_KEY,
  restoreSession,
  serializeSession,
  storedSessionFrom,
  type StoredSession,
} from '@/lib/auth/session-store'

/**
 * 세션의 저장 모양과 복원 판단(스펙 7.1). 픽스처는 실전값이 아니다 - access·refresh 가 서로
 * 다르고, 수명(137초·8641초)은 실전(900·2592000)과 다르다. 같으면 두 필드를 바꿔 배선해도
 * 초록이다.
 */
const NOW = 1_800_000_000_000

const PROBE: StoredSession = {
  accessToken: 'probe-access-token',
  refreshToken: 'probe-refresh-token',
  accessExpiresAt: NOW + 137_000,
  refreshExpiresAt: NOW + 8_641_000,
}

describe('storedSessionFrom', () => {
  it('refresh 만료 시각은 받은 시각에 refreshExpiresIn 을 더한 것이다 - access 쪽은 그대로다', () => {
    expect(
      storedSessionFrom(
        {
          accessToken: 'probe-access-token',
          refreshToken: 'probe-refresh-token',
          accessExpiresAt: NOW + 137_000,
        },
        8641,
        NOW,
      ),
    ).toEqual(PROBE)
  })
})

describe('serializeSession', () => {
  it('항목 하나에 네 필드만 쓴다 - 호출자 객체의 다른 필드가 저장소로 새지 않는다', () => {
    const leaky = { ...PROBE, probeLeak: 'probe-leak-value' }
    const written = serializeSession(leaky)
    expect(written).not.toContain('probe-leak-value')
    expect(Object.keys(JSON.parse(written) as Record<string, unknown>)).toEqual([
      'accessToken',
      'refreshToken',
      'accessExpiresAt',
      'refreshExpiresAt',
    ])
  })
})

describe('restoreSession - 앱이 켜질 때', () => {
  it('쓴 것을 그대로 되살린다', () => {
    expect(restoreSession(serializeSession(PROBE), NOW)).toEqual(PROBE)
  })

  it('저장된 값이 없으면 null 이다', () => {
    expect(restoreSession(null, NOW)).toBeNull()
  })

  it.each([
    ['JSON 이 아니다', '{probe'],
    ['배열이다', '[]'],
    ['null 이다', 'null'],
    ['문자열이다', '"probe"'],
    ['refresh 가 빠졌다', JSON.stringify({ ...PROBE, refreshToken: undefined })],
    ['access 가 빈 문자열이다', JSON.stringify({ ...PROBE, accessToken: '' })],
    ['만료 시각이 문자열이다', JSON.stringify({ ...PROBE, accessExpiresAt: String(NOW) })],
    ['refresh 만료 시각이 null 이다', JSON.stringify({ ...PROBE, refreshExpiresAt: null })],
  ])('%s → null - 로그아웃 상태로 시작한다', (_label, raw) => {
    expect(restoreSession(raw, NOW)).toBeNull()
  })

  it('refresh 가 이미 만료됐으면 null 이다 - 경계 포함', () => {
    expect(restoreSession(serializeSession({ ...PROBE, refreshExpiresAt: NOW }), NOW)).toBeNull()
    const justAlive = { ...PROBE, refreshExpiresAt: NOW + 1 }
    expect(restoreSession(serializeSession(justAlive), NOW)).toEqual(justAlive)
  })

  it('access 만 만료된 세션은 되살린다 - 다음 인증 요청이 회전한다(스펙 7.2)', () => {
    const accessExpired = { ...PROBE, accessExpiresAt: NOW - 1 }
    expect(restoreSession(serializeSession(accessExpired), NOW)).toEqual(accessExpired)
  })

  it('저장된 값에 다른 필드가 있어도 네 필드만 되살린다', () => {
    const raw = JSON.stringify({ ...PROBE, probeLeak: 'probe-leak-value' })
    expect(restoreSession(raw, NOW)).toEqual(PROBE)
  })
})

describe('SESSION_STORAGE_KEY', () => {
  it('SecureStore 가 받는 글자만 쓴다 - 영숫자와 . - _', () => {
    expect(SESSION_STORAGE_KEY).toMatch(/^[A-Za-z0-9._-]+$/)
  })
})
