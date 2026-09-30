import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AuthTokensDocument } from '@/lib/auth/rotation'
import { createSessionManager, type SessionStatus } from '@/lib/auth/session-manager'
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

/** 두 번째 회전의 응답 - 첫 회전이 준 토큰과 서로 다르다. */
const ROTATED_AGAIN: JsonApiResult<AuthTokensDocument> = {
  ok: true,
  status: 200,
  document: {
    data: {
      type: 'authTokens',
      id: 'probe-jti-again',
      attributes: {
        accessToken: 'probe-access-newer',
        refreshToken: 'probe-refresh-newer',
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
 * "저장이 반환보다 먼저", "기기 쪽을 비운 뒤에 요청" 같은 순서를 한 배열로 잰다. 시계는 `NOW` 에 서 있고
 * `advance` 로만 움직인다.
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
  let clock = NOW
  const manager = createSessionManager({ storage, send, now: () => clock })
  return {
    manager,
    storage,
    log,
    sent,
    stored: () => value,
    advance: (ms: number) => {
      clock += ms
    },
  }
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

/**
 * 저장소의 쓰기를 붙잡아 둔다 - 돌려준 `release` 를 부르면 그때 원래 쓰기가 일어난다(`log` 에도 그때
 * 남는다). 느린 키 저장소에서 쓰기가 끝나기 전에 다른 일이 끼는 경우를 만든다.
 */
function holdWrites(storage: SessionStorage): () => void {
  const gate = deferred<undefined>()
  const land = storage.write
  storage.write = (value) => gate.promise.then(() => land(value))
  return () => {
    gate.resolve(undefined)
  }
}

/** `holdWrites` 의 지우기 판. */
function holdClears(storage: SessionStorage): () => void {
  const gate = deferred<undefined>()
  const land = storage.clear
  storage.clear = () => gate.promise.then(() => land())
  return () => {
    gate.resolve(undefined)
  }
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

  it('복원이 끝난 뒤 다시 부르면 처음 읽은 값이 아니라 지금의 세션을 돌려준다', async () => {
    const h = harness(oldSession(600_000))
    await expect(h.manager.restore()).resolves.toEqual(oldSession(600_000))

    await h.manager.signOut()
    await expect(h.manager.restore()).resolves.toBeNull()

    await h.manager.establish(
      {
        accessToken: 'probe-access-new',
        refreshToken: 'probe-refresh-new',
        accessExpiresAt: NOW + 137_000,
      },
      8641,
    )
    await expect(h.manager.restore()).resolves.toEqual(ROTATED_SESSION)
  })

  // 앱 루트는 status 가 restoring 을 벗어날 때 스플래시를 닫는다 - 복원이 끝났다는 알림이 그 유일한 신호다.
  const finished: [string, SessionStatus, StoredSession | null][] = [
    ['저장된 세션이 있으면', 'signedIn', oldSession(600_000)],
    ['저장된 값이 없으면', 'signedOut', null],
  ]
  it.each(finished)(
    '%s 복원이 끝날 때 restoring → %s 를 구독자에게 한 번 알린다',
    async (_label, expected, stored) => {
      const h = harness(stored)
      const seen: SessionStatus[] = []
      h.manager.subscribe(() => {
        seen.push(h.manager.status())
      })
      expect(h.manager.status()).toBe('restoring')

      await h.manager.restore()

      expect(seen).toEqual([expected])
    },
  )
})

describe('subscribe - 구독자 하나가 던져도', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('나머지 구독자를 부르고 복원과 로그아웃은 멀쩡하다 - 던진 것은 남긴다', async () => {
    const report = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const h = harness(oldSession(600_000))
    const thrown = new Error('probe listener failure')
    h.manager.subscribe(() => {
      throw thrown
    })
    const after = vi.fn()
    h.manager.subscribe(after)

    await expect(h.manager.restore()).resolves.toEqual(oldSession(600_000))
    expect(after).toHaveBeenCalledTimes(1)
    expect(report).toHaveBeenCalledTimes(1)
    expect(report.mock.calls[0]).toContain(thrown)

    await h.manager.signOut()
    expect(after).toHaveBeenCalledTimes(2)
    expect(h.manager.status()).toBe('signedOut')
    await expect(h.manager.restore()).resolves.toBeNull()
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

  it('저장소에 쓰지 못해도 새 세션을 메모리에 세우고 그 오류로 거절한다 - 서버가 이미 내준 토큰을 버리지 않는다', async () => {
    const h = harness(null)
    await h.manager.restore()
    h.storage.write = () => Promise.reject(new Error('probe keystore write failure'))
    const notified: string[] = []
    h.manager.subscribe(() => {
      notified.push(h.manager.status())
    })

    await expect(
      h.manager.establish(
        {
          accessToken: 'probe-access-new',
          refreshToken: 'probe-refresh-new',
          accessExpiresAt: NOW + 137_000,
        },
        8641,
      ),
    ).rejects.toThrow('probe keystore write failure')

    expect(h.manager.current()).toEqual(ROTATED_SESSION)
    expect(h.manager.status()).toBe('signedIn')
    expect(notified).toEqual(['signedIn'])
  })

  it('쓰는 동안 로그아웃하면 늦게 끝난 쓰기가 세션을 세우지 않고 저장소는 지워진 채 끝난다', async () => {
    const h = harness(null)
    await h.manager.restore()
    const release = holdWrites(h.storage)

    const establishing = h.manager.establish(
      {
        accessToken: 'probe-access-new',
        refreshToken: 'probe-refresh-new',
        accessExpiresAt: NOW + 137_000,
      },
      8641,
    )
    await settle()
    const signingOut = h.manager.signOut()
    release()
    await Promise.all([establishing, signingOut])

    expect(h.manager.current()).toBeNull()
    expect(h.manager.status()).toBe('signedOut')
    expect(h.stored()).toBeNull()
    expect(h.log).toEqual(['write', 'clear'])
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

  it('회전이 끝난 뒤 새 access 가 다시 만료 임박이 되면 다시 회전한다 - 끝난 회전을 붙들고 있지 않는다', async () => {
    const h = harness(oldSession(0), ROTATED, ROTATED_AGAIN)
    await h.manager.restore()
    await expect(h.manager.getAccessToken()).resolves.toBe('probe-access-new')

    h.advance(137_000)

    await expect(h.manager.getAccessToken()).resolves.toBe('probe-access-newer')
    expect(h.sent).toHaveLength(2)
    // 두 번째 회전은 첫 회전이 준 refresh 를 낸다.
    expect(h.sent[1]?.options.body).toEqual({
      data: { type: 'refreshTokens', attributes: { refreshToken: 'probe-refresh-new' } },
    })
    expect(h.manager.current()).toEqual({
      accessToken: 'probe-access-newer',
      refreshToken: 'probe-refresh-newer',
      accessExpiresAt: NOW + 137_000 + 137_000,
      refreshExpiresAt: NOW + 137_000 + 8_641_000,
    })
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

  it('회전하는 동안 새 로그인이 세워지면 늦게 온 회전 결과가 새 세션을 덮지 않는다', async () => {
    const response = deferred<JsonApiResult<unknown>>()
    const h = harness(oldSession(0), response.promise)
    await h.manager.restore()

    const token = h.manager.getAccessToken()
    await settle()
    await h.manager.establish(
      {
        accessToken: 'probe-access-login',
        refreshToken: 'probe-refresh-login',
        accessExpiresAt: NOW + 137_000,
      },
      8641,
    )
    response.resolve(ROTATED)

    const loggedIn: StoredSession = {
      accessToken: 'probe-access-login',
      refreshToken: 'probe-refresh-login',
      accessExpiresAt: NOW + 137_000,
      refreshExpiresAt: NOW + 8_641_000,
    }
    await expect(token).resolves.toBe('probe-access-login')
    expect(h.manager.current()).toEqual(loggedIn)
    expect(h.stored()).toBe(serializeSession(loggedIn))
  })

  it('회전 뒤 저장소에 쓰지 못해도 새 세션을 메모리에 두고 그 오류로 거절한다 - 다음 호출은 옛 refresh 를 다시 내지 않는다', async () => {
    const h = harness(oldSession(0), ROTATED)
    await h.manager.restore()
    h.storage.write = () => Promise.reject(new Error('probe keystore write failure'))

    await expect(h.manager.getAccessToken()).rejects.toThrow('probe keystore write failure')

    expect(h.manager.current()).toEqual(ROTATED_SESSION)
    expect(h.manager.status()).toBe('signedIn')
    await expect(h.manager.getAccessToken()).resolves.toBe('probe-access-new')
    expect(h.sent).toHaveLength(1)
  })

  it('회전의 쓰기가 끝나기 전에 로그아웃하면 늦게 끝난 쓰기가 세션을 되살리지 않고 저장소는 지워진 채 끝난다', async () => {
    const h = harness(oldSession(0), ROTATED)
    await h.manager.restore()
    const release = holdWrites(h.storage)

    const token = h.manager.getAccessToken()
    await settle()
    const signingOut = h.manager.signOut()
    await settle()
    // 메모리는 곧바로 로그아웃이다. 지우기는 먼저 시작한 쓰기 뒤에 줄을 선다.
    expect(h.manager.current()).toBeNull()
    expect(h.manager.status()).toBe('signedOut')
    expect(h.log).toEqual([`send ${REFRESH_PATH}`])

    release()
    await expect(token).resolves.toBeNull()
    await signingOut

    expect(h.manager.current()).toBeNull()
    expect(h.manager.status()).toBe('signedOut')
    expect(h.stored()).toBeNull()
    expect(h.log).toEqual([`send ${REFRESH_PATH}`, 'write', 'clear'])
  })

  it('로그아웃이 저장소를 지우는 동안 회전 응답이 오면 옛 access 를 돌려주지 않는다', async () => {
    const response = deferred<JsonApiResult<unknown>>()
    const h = harness(oldSession(0), response.promise)
    await h.manager.restore()
    const release = holdClears(h.storage)

    const token = h.manager.getAccessToken()
    await settle()
    const signingOut = h.manager.signOut()
    response.resolve(ROTATED)

    await expect(token).resolves.toBeNull()
    expect(h.manager.current()).toBeNull()

    release()
    await signingOut
    expect(h.stored()).toBeNull()
    expect(h.log).toEqual([`send ${REFRESH_PATH}`, 'clear'])
  })

  // 로그인(establish)의 쓰기가 붙잡혀 있는 동안에는 옛 세션이 아직 세션이라 getAccessToken 이 그것을 회전한다. 그
  // 회전은 옛 세션의 것이다 - 응답이 로그인의 쓰기보다 먼저 오든 나중에 오든 새 로그인을 덮어쓰거나 로그아웃시키지
  // 않는다.
  const inLoginWindow: [string, string, JsonApiResult<unknown>][] = [
    ['옛 세션의 회전이 성공해도', '먼저', ROTATED],
    ['옛 세션의 회전이 성공해도', '나중에', ROTATED],
    ['옛 세션의 refresh 가 거절돼도', '먼저', REVOKED],
    ['옛 세션의 refresh 가 거절돼도', '나중에', REVOKED],
  ]
  it.each(inLoginWindow)(
    '로그인의 쓰기 창 안에서 시작된 회전이라면 %s 응답이 쓰기보다 %s 오면 새 로그인이 남는다',
    async (_label, order, result) => {
      const response = deferred<JsonApiResult<unknown>>()
      const h = harness(oldSession(0), response.promise)
      await h.manager.restore()
      const release = holdWrites(h.storage)

      const establishing = h.manager.establish(
        {
          accessToken: 'probe-access-login',
          refreshToken: 'probe-refresh-login',
          accessExpiresAt: NOW + 137_000,
        },
        8641,
      )
      await settle()
      const token = h.manager.getAccessToken()
      await settle()
      expect(h.sent).toHaveLength(1)

      if (order === '먼저') {
        response.resolve(result)
        await settle()
        release()
      } else {
        release()
        await establishing
        response.resolve(result)
      }
      await Promise.all([establishing, token])

      const loggedIn: StoredSession = {
        accessToken: 'probe-access-login',
        refreshToken: 'probe-refresh-login',
        accessExpiresAt: NOW + 137_000,
        refreshExpiresAt: NOW + 8_641_000,
      }
      expect(h.manager.current()).toEqual(loggedIn)
      expect(h.manager.status()).toBe('signedIn')
      expect(h.stored()).toBe(serializeSession(loggedIn))
      // 쓰기는 로그인의 것 하나뿐이고 지우기는 없다 - 옛 세션의 회전은 저장소를 건드리지 않았다.
      expect(h.log).toEqual([`send ${REFRESH_PATH}`, 'write'])
    },
  )

  it('establish 로 세운 세션도 만료가 임박하면 회전한다 - 로그인 뒤의 첫 회전이 걸러지지 않는다', async () => {
    const h = harness(null, ROTATED)
    await h.manager.restore()
    await h.manager.establish(
      {
        accessToken: 'probe-access-login',
        refreshToken: 'probe-refresh-login',
        accessExpiresAt: NOW + 137_000,
      },
      8641,
    )
    h.advance(137_000)

    await expect(h.manager.getAccessToken()).resolves.toBe('probe-access-new')

    expect(h.sent[0]?.options.body).toEqual({
      data: { type: 'refreshTokens', attributes: { refreshToken: 'probe-refresh-login' } },
    })
    // 회전은 움직인 시계를 기준으로 새 세션을 저장한다.
    const rotated: StoredSession = {
      accessToken: 'probe-access-new',
      refreshToken: 'probe-refresh-new',
      accessExpiresAt: NOW + 137_000 + 137_000,
      refreshExpiresAt: NOW + 137_000 + 8_641_000,
    }
    expect(h.manager.current()).toEqual(rotated)
    expect(h.stored()).toBe(serializeSession(rotated))
  })

  it('저장 실패로 거절된 회전 뒤에 새 access 가 다시 만료 임박이 되면 다시 회전한다 - 거절을 붙들고 있지 않는다', async () => {
    const h = harness(oldSession(0), ROTATED, ROTATED_AGAIN)
    await h.manager.restore()
    const working = h.storage.write
    h.storage.write = () => Promise.reject(new Error('probe keystore write failure'))
    await expect(h.manager.getAccessToken()).rejects.toThrow('probe keystore write failure')

    h.storage.write = working
    h.advance(137_000)

    await expect(h.manager.getAccessToken()).resolves.toBe('probe-access-newer')
    expect(h.sent).toHaveLength(2)
    // 저장에 실패해도 메모리의 새 세션이 남았으므로 두 번째 회전은 그 refresh 를 낸다.
    expect(h.sent[1]?.options.body).toEqual({
      data: { type: 'refreshTokens', attributes: { refreshToken: 'probe-refresh-new' } },
    })
    expect(h.stored()).toBe(
      serializeSession({
        accessToken: 'probe-access-newer',
        refreshToken: 'probe-refresh-newer',
        accessExpiresAt: NOW + 137_000 + 137_000,
        refreshExpiresAt: NOW + 137_000 + 8_641_000,
      }),
    )
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

  it('저장소를 지우지 못해도 메모리는 signedOut 이고 캐시를 비우고 폐기를 요청한 뒤 그 오류로 거절한다', async () => {
    const h = harness(oldSession(600_000), LOGGED_OUT)
    await h.manager.restore()
    h.storage.clear = () => {
      h.log.push('clear')
      return Promise.reject(new Error('probe keystore clear failure'))
    }
    const notified: string[] = []
    h.manager.subscribe(() => {
      notified.push(h.manager.status())
    })

    await expect(
      h.manager.logout(() => {
        h.log.push('caches')
      }),
    ).rejects.toThrow('probe keystore clear failure')

    expect(h.manager.current()).toBeNull()
    expect(h.manager.status()).toBe('signedOut')
    expect(notified).toEqual(['signedOut'])
    // 못 지운 항목이 남았을 수 있다 - 옛 refresh 를 폐기해 다음 실행에서 되살아나도 죽어 있게 한다.
    expect(h.log).toEqual(['clear', 'caches', `send ${LOGOUT_PATH}`])
    expect(h.sent[0]?.options.body).toEqual({
      data: { type: 'refreshTokens', attributes: { refreshToken: 'probe-refresh-old' } },
    })
  })

  it('진행 중인 회전이 있으면 끝나길 기다린 뒤 그 회전이 낸 새 refresh 를 폐기한다', async () => {
    const response = deferred<JsonApiResult<unknown>>()
    const h = harness(oldSession(0), response.promise, LOGGED_OUT)
    await h.manager.restore()

    const token = h.manager.getAccessToken()
    await settle()
    const loggingOut = h.manager.logout(() => {
      h.log.push('caches')
    })
    await settle()
    // 회전이 끝나기 전에는 아무것도 비우지 않는다.
    expect(h.manager.status()).toBe('signedIn')
    expect(h.log).toEqual([`send ${REFRESH_PATH}`])

    response.resolve(ROTATED)

    await expect(loggingOut).resolves.toEqual({ kind: 'revoked' })
    await expect(token).resolves.toBe('probe-access-new')
    expect(h.log).toEqual([
      `send ${REFRESH_PATH}`,
      'write',
      'clear',
      'caches',
      `send ${LOGOUT_PATH}`,
    ])
    expect(h.sent[1]?.options.body).toEqual({
      data: { type: 'refreshTokens', attributes: { refreshToken: 'probe-refresh-new' } },
    })
    expect(h.manager.current()).toBeNull()
    expect(h.stored()).toBeNull()
  })

  it('기다리는 회전이 저장 실패로 거절돼도 그 결과와 무관하게 새 refresh 를 폐기한다', async () => {
    const response = deferred<JsonApiResult<unknown>>()
    const h = harness(oldSession(0), response.promise, LOGGED_OUT)
    await h.manager.restore()
    h.storage.write = () => Promise.reject(new Error('probe keystore write failure'))

    const token = h.manager.getAccessToken()
    const tokenRejected = expect(token).rejects.toThrow('probe keystore write failure')
    await settle()
    const loggingOut = h.manager.logout(() => {
      h.log.push('caches')
    })
    await settle()
    response.resolve(ROTATED)

    await expect(loggingOut).resolves.toEqual({ kind: 'revoked' })
    await tokenRejected
    expect(h.sent[1]?.options.body).toEqual({
      data: { type: 'refreshTokens', attributes: { refreshToken: 'probe-refresh-new' } },
    })
    expect(h.manager.current()).toBeNull()
  })
})
