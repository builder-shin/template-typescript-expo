import type { JsonApiSend } from '@/lib/jsonapi/send'
import { endSession, type LogoutOutcome } from './logout'
import { rotateSession } from './rotation'
import {
  restoreSession,
  serializeSession,
  storedSessionFrom,
  type SessionStorage,
  type StoredSession,
} from './session-store'
import { isAccessExpiring, type Session } from './tokens'

/**
 * 세션 관리자 - 회전이 일어나는 유일한 자리(스펙 7.2).
 *
 * 백엔드는 회전할 때 구 refresh token 을 즉시 폐기하고, 폐기된 토큰을 다시 내밀면 그 사용자의
 * 세션을 전부 끊는다(rotation.ts 머리말의 실측). 동시 요청이 각자 회전하면 두 번째부터
 * TOKEN_REVOKED 로 실패해 사용자가 이유 없이 로그아웃된다. 그래서:
 *
 *   - 인증이 필요한 요청은 전부 `getAccessToken()` 을 지난다.
 *   - 진행 중인 회전이 있으면 새 호출은 그 Promise 를 같이 기다린다 - refresh 요청은 한 번이다.
 *   - 회전에 성공하면 새 세션을 저장소에 **먼저** 쓰고 그다음 돌려준다. 거꾸로면 쓰기 전에 앱이
 *     죽었을 때 이미 폐기된 옛 refresh 만 남는다.
 *   - 401 을 받았을 때 회전해서 재시도하지 않는다. 인증 오류를 받은 호출자는 `signOut()` 하고
 *     로그인으로 보낸다(스펙 9.2).
 *   - 백그라운드 타이머를 두지 않는다. 앱이 다시 앞으로 나올 때의 재조회가 이 경로를 지나며
 *     필요하면 회전한다.
 *
 * 저장소·전송·시계를 주입받는다 - 앱에서는 platform/session.ts 가 SecureStore·API 클라이언트·
 * Date.now 를 꽂고, 시험은 가짜를 꽂아 node 에서 잰다.
 */

/** restoring 은 앱이 켜질 때 저장소를 읽는 동안이다 - 앱은 그동안 스플래시를 유지한다(스펙 7.1). */
export type SessionStatus = 'restoring' | 'signedIn' | 'signedOut'

export interface SessionManagerDeps {
  storage: SessionStorage
  send: JsonApiSend
  now: () => number
}

/**
 * 멤버를 메서드가 아니라 함수 속성으로 적는다 - useSyncExternalStore 에 `manager.subscribe` 를
 * 그대로 넘기므로 this 에 기대지 않아야 한다.
 */
export interface SessionManager {
  /**
   * 앱이 켜질 때 부른다. 되살릴 수 없는 값은 저장소에서 지운다. 던지지 않는다. 다시 불러도 저장소를
   * 다시 읽지 않고 첫 결과를 돌려준다 - 루트의 효과가 개발 모드(StrictMode)에서 두 번 돌아도 안전하다.
   */
  restore: () => Promise<StoredSession | null>
  status: () => SessionStatus
  current: () => StoredSession | null
  /** 상태가 바뀔 때마다 부른다. 돌려준 함수로 구독을 끊는다. */
  subscribe: (listener: () => void) => () => void
  /** 로그인·가입이 받은 토큰으로 세션을 세운다 - 저장소에 먼저 쓰고 그다음 알린다. */
  establish: (session: Session, refreshExpiresIn: number) => Promise<void>
  /**
   * 인증이 필요한 요청이 실을 access token. 세션이 없으면 null 이다 - 쓰기 훅은 요청하지 않고
   * 로그인으로 보낸다(스펙 7.3 의 두 번째 겹). 만료까지 60초 이하면 회전한다.
   */
  getAccessToken: () => Promise<string | null>
  /** 기기 세션을 지운다 - 인증 오류를 받았을 때(스펙 9.2). 백엔드를 부르지 않는다. */
  signOut: () => Promise<void>
  /**
   * 로그아웃(스펙 7.4) - 기기 세션과 캐시(`clearCaches`)를 먼저 비우고 refresh 폐기를 요청한다.
   * 요청이 실패해도 기기 쪽은 이미 비어 있다(logout.ts 의 endSession).
   */
  logout: (clearCaches: () => void) => Promise<LogoutOutcome>
}

export function createSessionManager({ storage, send, now }: SessionManagerDeps): SessionManager {
  let session: StoredSession | null = null
  let status: SessionStatus = 'restoring'
  let rotation: Promise<string | null> | null = null
  // 세션을 세우거나 지울 때마다 늘린다. 회전이 끝났을 때 값이 바뀌어 있으면 그 사이에 로그아웃이나
  // 새 로그인이 있었던 것이다 - 늦게 온 회전 결과로 덮어쓰지 않는다(로그아웃한 세션이 되살아나지 않게).
  let generation = 0
  // 복원은 한 번만 한다 - 두 번째 호출부터는 첫 호출의 Promise 를 그대로 돌려준다.
  let restoring: Promise<StoredSession | null> | null = null
  const listeners = new Set<() => void>()

  function publish(next: StoredSession | null): void {
    session = next
    status = next === null ? 'signedOut' : 'signedIn'
    for (const listener of listeners) listener()
  }

  async function readStored(): Promise<StoredSession | null> {
    let restored: StoredSession | null = null
    try {
      const raw = await storage.read()
      restored = restoreSession(raw, now())
      if (restored === null && raw !== null) await storage.clear()
    } catch {
      // 읽지 못한 세션(기기 키 저장소가 항목을 풀지 못하는 경우 등)은 없는 것과 같다 - 로그아웃
      // 상태로 시작한다(스펙 7.1).
    }
    publish(restored)
    return restored
  }

  async function save(next: StoredSession): Promise<void> {
    await storage.write(serializeSession(next))
    publish(next)
  }

  async function signOut(): Promise<void> {
    generation += 1
    await storage.clear()
    publish(null)
  }

  async function rotate(current: StoredSession): Promise<string | null> {
    const startedIn = generation
    const at = now()
    const outcome = await rotateSession(current.refreshToken, send, at)
    if (generation !== startedIn) return session?.accessToken ?? null
    if (outcome.kind === 'rotated') {
      const next = storedSessionFrom(outcome.session, outcome.refreshExpiresIn, at)
      await save(next)
      return next.accessToken
    }
    if (outcome.kind === 'destroy') {
      await signOut()
      return null
    }
    // unreachable - 백엔드가 판정을 내지 못했다. 세션이 죽었다는 증거가 없으므로 건드리지 않고
    // 지금 access 를 돌려준다(스펙 7.2).
    return current.accessToken
  }

  return {
    restore: () => {
      restoring ??= readStored()
      return restoring
    },
    status: () => status,
    current: () => session,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    establish: async (tokens, refreshExpiresIn) => {
      generation += 1
      await save(storedSessionFrom(tokens, refreshExpiresIn, now()))
    },
    getAccessToken: () => {
      const current = session
      if (current === null) return Promise.resolve(null)
      if (!isAccessExpiring(current, now())) return Promise.resolve(current.accessToken)
      if (rotation === null) {
        rotation = rotate(current).finally(() => {
          rotation = null
        })
      }
      return rotation
    },
    signOut,
    logout: (clearCaches) =>
      endSession(session ?? undefined, send, async () => {
        await signOut()
        clearCaches()
      }),
  }
}
