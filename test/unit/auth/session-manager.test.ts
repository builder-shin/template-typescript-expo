import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AuthTokensDocument } from '@/lib/auth/rotation'
import { createSessionManager } from '@/lib/auth/session-manager'
import { serializeSession, type SessionStorage, type StoredSession } from '@/lib/auth/session-store'
import { ACCESS_EXPIRY_LEEWAY_MS } from '@/lib/auth/tokens'
import type { JsonApiResult, RequestOptions } from '@/lib/jsonapi/client'
import type { JsonApiSend } from '@/lib/jsonapi/send'

/**
 * 세션 관리자 - 회전이 일어나는 유일한 자리(스펙 7.2). 저장소·전송·시계를 가짜로 꽂아 잰다.
 *
 * 픽스처는 실전에서 나올 수 없는 값이다 - 옛 토큰과 새 토큰, access 와 refresh 가 서로 다르고,
 * expiresIn(137)·refreshExpiresIn(8641)은 실전값(900·2592000)이 아니다. 같으면 "새 값을 썼다"와
 * "옛 값을 그대로 뒀다"가 구별되지 않는다.
 */

const NOW = 1_800_000_000_000
const REFRESH_PATH = '/api/v1/auth/refresh'
const LOGOUT_PATH = '/api/v1/auth/logout'

/** 저장된 옛 세션. access 는 `accessMs` 뒤에 만료된다. */
function oldSession(accessMs: number): StoredSession {
  return {
    accessToken: 'probe-access-old',
    refreshToken: 'probe-refresh-old',
    accessExpiresAt: NOW + accessMs,
    refreshExpiresAt: NOW + 8_641_000,
  }
}

/** 회전이 성공했을 때 저장돼야 하는 새 세션. */
const ROTATED_SESSION: StoredSession = {
  accessToken: 'probe-access-new',
  refreshToken: 'probe-refresh-new',
  accessExpiresAt: NOW + 137_000,
  refreshExpiresAt: NOW + 8_641_000,
}

const ROTATED: JsonApiResult<AuthTokensDocument> = {
  ok: true,
  status: 200,
  document: {
    data: {
      type: 'authTokens',
      id: 'probe-jti',
      attributes: {
        accessToken: 'probe-access-new',
        refreshToken: 'probe-refresh-new',
        tokenType: 'ProbeBearer',
        expiresIn: 137,
        refreshExpiresIn: 8641,
      },
    },
  },
}

const REVOKED: JsonApiResult<unknown> = {
  ok: false,
  status: 401,
  errors: [{ status: '401', code: 'TOKEN_REVOKED' }],
}

const UNREACHABLE: JsonApiResult<unknown> = {
  ok: false,
  status: 0,
  errors: [{ status: '0', code: 'NETWORK_ERROR', meta: { synthetic: true } }],
}

const LOGGED_OUT: JsonApiResult<unknown> = { ok: true, status: 204, document: null }

/** 가짜 전송이 차례로 돌려줄 응답. Promise 면 시험이 푸는 시점에 응답이 온다. */
type ScriptedResponse = JsonApiResult<unknown> | Promise<JsonApiResult<unknown>>

/**
 * 관리자 하나와 그 가짜 저장소·전송. `log` 가 저장소 쓰기·지우기와 요청을 불린 순서대로 모은다 -
 * "저장이 반환보다 먼저", "기기 쪽을 비운 뒤에 요청" 같은 순서를 한 배열로 잰다.
 */
function harness(stored: StoredSession | null, ...responses: ScriptedResponse[]) {
  const log: string[] = []
  const sent: { path: string; options: RequestOptions }[] = []
  let value: string | null = stored === null ? null : serializeSession(stored)
  const storage: SessionStorage = {
    read: () => Promise.resolve(value),
    write: (next) => {
      log.push('write')
      value = next
      return Promise.resolve()
    },
    clear: () => {
      log.push('clear')
      value = null
      return Promise.resolve()
    },
  }
  const send: JsonApiSend = <T>(path: string, options: RequestOptions = {}) => {
    log.push(`send ${path}`)
    sent.push({ path, options })
    const next = responses.shift()
    if (next === undefined) return Promise.reject(new Error(`준비하지 않은 요청: ${path}`))
    return Promise.resolve(next) as Promise<JsonApiResult<T>>
  }
  const manager = createSessionManager({ storage, send, now: () => NOW })
  return { manager, storage, log, sent, stored: () => value }
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve: (value: T) => void = () => undefined
  const promise = new Promise<T>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

/** 대기 중인 Promise 연쇄가 한 바퀴 돌게 한다. */
function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

describe('restore - 앱이 켜질 때(스펙 7.1)', () => {
  it('저장된 세션을 되살리고 signedIn 이 된다 - 그 전에는 restoring 이다', async () => {
    const h = harness(oldSession(600_000))
    expect(h.manager.status()).toBe('restoring')
    await expect(h.manager.restore()).resolves.toEqual(oldSession(600_000))
    expect(h.manager.status()).toBe('signedIn')
    expect(h.manager.current()).toEqual(oldSession(600_000))
    expect(h.log).toEqual([])
  })

  it('저장된 값이 없으면 signedOut 이고 저장소를 건드리지 않는다', async () => {
    const h = harness(null)
    await expect(h.manager.restore()).resolves.toBeNull()
    expect(h.manager.status()).toBe('signedOut')
    expect(h.log).toEqual([])
  })

  it('되살릴 수 없는 값(refresh 만료)은 지우고 signedOut 으로 시작한다', async () => {
    const h = harness({ ...oldSession(600_000), refreshExpiresAt: NOW })
    await expect(h.manager.restore()).resolves.toBeNull()
    expect(h.manager.status()).toBe('signedOut')
    expect(h.log).toEqual(['clear'])
    expect(h.stored()).toBeNull()
  })

  it('저장소를 읽다가 던져도 던지지 않고 signedOut 이다', async () => {
    const h = harness(null)
    h.storage.read = () => Promise.reject(new Error('probe keystore failure'))
    await expect(h.manager.restore()).resolves.toBeNull()
    expect(h.manager.status()).toBe('signedOut')
  })

  it('다시 불러도 저장소를 한 번만 읽고 첫 결과를 돌려준다 - 개발 모드의 StrictMode 는 효과를 두 번 돌린다', async () => {
    const h = harness(oldSession(600_000))
    const read = vi.spyOn(h.storage, 'read')
    const [first, second] = await Promise.all([h.manager.restore(), h.manager.restore()])
    expect(second).toBe(first)
    await expect(h.manager.restore()).resolves.toBe(first)
    expect(read).toHaveBeenCalledTimes(1)
  })
})

describe('establish - 로그인·가입이 받은 토큰', () => {
  it('저장소에 먼저 쓰고, 알릴 때는 이미 저장돼 있다', async () => {
    const h = harness(null)
    await h.manager.restore()
    const storedWhenNotified: (string | null)[] = []
    h.manager.subscribe(() => {
      storedWhenNotified.push(h.stored())
    })

    await h.manager.establish(
      {
        accessToken: 'probe-access-new',
        refreshToken: 'probe-refresh-new',
        accessExpiresAt: NOW + 137_000,
      },
      8641,
    )

    expect(storedWhenNotified).toEqual([serializeSession(ROTATED_SESSION)])
    expect(h.manager.current()).toEqual(ROTATED_SESSION)
    expect(h.manager.status()).toBe('signedIn')
  })
})

describe('getAccessToken - 회전은 한 곳에서, 한 번에 하나만(스펙 7.2)', () => {
  it('세션이 없으면 null 이고 백엔드를 부르지 않는다', async () => {
    const h = harness(null)
    await h.manager.restore()
    await expect(h.manager.getAccessToken()).resolves.toBeNull()
    expect(h.sent).toEqual([])
  })

  it('만료까지 60초보다 넉넉하면 지금 access 를 돌려주고 회전하지 않는다', async () => {
    const h = harness(oldSession(ACCESS_EXPIRY_LEEWAY_MS + 1))
    await h.manager.restore()
    await expect(h.manager.getAccessToken()).resolves.toBe('probe-access-old')
    expect(h.sent).toEqual([])
  })

  it('만료까지 60초 이하면(경계 포함) refresh 로 회전하고 새 세션을 저장한 뒤 새 access 를 돌려준다', async () => {
    const h = harness(oldSession(ACCESS_EXPIRY_LEEWAY_MS), ROTATED)
    await h.manager.restore()

    await expect(h.manager.getAccessToken()).resolves.toBe('probe-access-new')

    expect(h.sent).toHaveLength(1)
    expect(h.sent[0]?.path).toBe(REFRESH_PATH)
    expect(h.sent[0]?.options.body).toEqual({
      data: { type: 'refreshTokens', attributes: { refreshToken: 'probe-refresh-old' } },
    })
    // 회전 요청에 access 를 싣지 않는다 - 본문의 refresh 가 스스로 지목한다.
    expect(h.sent[0]?.options.accessToken).toBeUndefined()
    expect(h.manager.current()).toEqual(ROTATED_SESSION)
    expect(h.stored()).toBe(serializeSession(ROTATED_SESSION))
  })

  it('동시에 두 번 불러도 refresh 요청은 한 번이고 둘 다 새 access 를 받는다', async () => {
    const response = deferred<JsonApiResult<unknown>>()
    const h = harness(oldSession(0), response.promise)
    await h.manager.restore()

    const first = h.manager.getAccessToken()
    const second = h.manager.getAccessToken()
    await settle()
    expect(h.sent).toHaveLength(1)

    response.resolve(ROTATED)
    await expect(Promise.all([first, second])).resolves.toEqual([
      'probe-access-new',
      'probe-access-new',
    ])
    expect(h.sent).toHaveLength(1)
  })

  it('새 세션을 저장소에 다 쓴 뒤에야 돌려준다', async () => {
    const h = harness(oldSession(0), ROTATED)
    await h.manager.restore()
    const write = deferred<undefined>()
    h.storage.write = () => {
      h.log.push('write')
      return write.promise
    }

    let returned = false
    const token = h.manager.getAccessToken().then((value) => {
      returned = true
      return value
    })
    await settle()
    expect(h.log).toEqual([`send ${REFRESH_PATH}`, 'write'])
    expect(returned).toBe(false)

    write.resolve(undefined)
    await expect(token).resolves.toBe('probe-access-new')
    expect(returned).toBe(true)
  })

  it('회전이 거절되면(401 등) 세션을 지우고 null 이다 - 로그아웃을 알린다', async () => {
    const h = harness(oldSession(0), REVOKED)
    await h.manager.restore()
    const notified: string[] = []
    h.manager.subscribe(() => {
      notified.push(h.manager.status())
    })

    await expect(h.manager.getAccessToken()).resolves.toBeNull()

    expect(h.log).toEqual([`send ${REFRESH_PATH}`, 'clear'])
    expect(h.manager.current()).toBeNull()
    expect(notified).toEqual(['signedOut'])
  })

  it('백엔드에 닿지 못하면 세션을 건드리지 않고 지금 access 를 돌려준다', async () => {
    const h = harness(oldSession(0), UNREACHABLE)
    await h.manager.restore()

    await expect(h.manager.getAccessToken()).resolves.toBe('probe-access-old')

    expect(h.log).toEqual([`send ${REFRESH_PATH}`])
    expect(h.manager.current()).toEqual(oldSession(0))
    expect(h.manager.status()).toBe('signedIn')
  })

  it('회전이 끝나면 다음 호출은 새 access 를 회전 없이 받는다', async () => {
    const h = harness(oldSession(0), ROTATED)
    await h.manager.restore()
    await h.manager.getAccessToken()
    await expect(h.manager.getAccessToken()).resolves.toBe('probe-access-new')
    expect(h.sent).toHaveLength(1)
  })

  it('회전하는 동안 로그아웃하면 늦게 온 회전 결과가 세션을 되살리지 않는다', async () => {
    const response = deferred<JsonApiResult<unknown>>()
    const h = harness(oldSession(0), response.promise)
    await h.manager.restore()

    const token = h.manager.getAccessToken()
    await settle()
    await h.manager.signOut()
    response.resolve(ROTATED)

    await expect(token).resolves.toBeNull()
    expect(h.manager.current()).toBeNull()
    expect(h.stored()).toBeNull()
    expect(h.log).toEqual([`send ${REFRESH_PATH}`, 'clear'])
  })
})

describe('signOut - 인증 오류를 받았을 때(스펙 9.2)', () => {
  it('저장소를 지우고 signedOut 을 알린다 - 백엔드는 부르지 않는다', async () => {
    const h = harness(oldSession(600_000))
    await h.manager.restore()
    const notified: string[] = []
    h.manager.subscribe(() => {
      notified.push(h.manager.status())
    })

    await h.manager.signOut()

    expect(h.log).toEqual(['clear'])
    expect(h.sent).toEqual([])
    expect(notified).toEqual(['signedOut'])
  })

  it('구독을 끊으면 더 알리지 않는다', async () => {
    const h = harness(oldSession(600_000))
    await h.manager.restore()
    const listener = vi.fn()
    const unsubscribe = h.manager.subscribe(listener)
    unsubscribe()
    await h.manager.signOut()
    expect(listener).not.toHaveBeenCalled()
  })
})

describe('logout - 기기 쪽을 먼저 비우고 refresh 폐기를 요청한다(스펙 7.4)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('저장소와 캐시를 비운 뒤에 옛 refresh 로 폐기를 요청한다', async () => {
    const h = harness(oldSession(600_000), LOGGED_OUT)
    await h.manager.restore()

    const outcome = await h.manager.logout(() => {
      h.log.push('caches')
    })

    expect(outcome).toEqual({ kind: 'revoked' })
    expect(h.log).toEqual(['clear', 'caches', `send ${LOGOUT_PATH}`])
    expect(h.sent[0]?.options.body).toEqual({
      data: { type: 'refreshTokens', attributes: { refreshToken: 'probe-refresh-old' } },
    })
    expect(h.manager.status()).toBe('signedOut')
  })

  it('백엔드가 거절해도 기기 쪽은 이미 비어 있다', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const h = harness(oldSession(600_000), REVOKED)
    await h.manager.restore()

    const outcome = await h.manager.logout(() => {
      h.log.push('caches')
    })

    expect(outcome.kind).toBe('notRevoked')
    expect(h.log).toEqual(['clear', 'caches', `send ${LOGOUT_PATH}`])
    expect(h.stored()).toBeNull()
    expect(h.manager.current()).toBeNull()
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('세션이 없어도 기기 쪽을 비우고 백엔드는 부르지 않는다', async () => {
    const h = harness(null)
    await h.manager.restore()

    const outcome = await h.manager.logout(() => {
      h.log.push('caches')
    })

    expect(outcome).toEqual({ kind: 'noSession' })
    expect(h.log).toEqual(['clear', 'caches'])
  })
})
