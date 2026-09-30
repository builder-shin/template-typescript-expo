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
 *   - 저장소가 실패해도 메모리의 세션 상태가 먼저다. 백엔드가 이미 내준 토큰(로그인·회전)은 쓰기에
 *     실패해도 메모리에 세우고(버리면 폐기된 옛 refresh 만 남는다), 로그아웃은 못 지워도 메모리를 비운 뒤
 *     캐시 비움과 폐기 요청을 끝낸다. 오류는 그 뒤에 호출자에게 거절로 간다 - 호출자는 삼키지 말고
 *     알리되, 화면 이동은 거절이 아니라 `status()` 를 따른다.
 *   - 저장소가 늦어도 메모리가 먼저다. 쓰기와 지우기는 한 줄로 세운다 - 나중에 부른 지우기가 먼저 부른
 *     쓰기보다 앞서 끝나 지운 세션이 저장소에 남는 일이 없다. 세션을 세우거나 지우는 일이 시작될 때마다
 *     `generation` 을 올리고, 저장소나 전송을 기다린 뒤에는 그 값을 다시 본다 - 그 사이 로그아웃이나 새
 *     로그인이 있었으면 늦게 끝난 쓰기·회전은 세션을 되살리지 않는다. 회전은 지금 세션이 세워진 세대를
 *     달고 출발하므로, 로그인의 쓰기가 끝나기 전에 옛 세션이 시작한 회전도 결과를 버린다. `signOut()` 은
 *     메모리부터 비운다.
 *   - `logout()` 은 진행 중인 회전이 있으면 끝나길 기다린 뒤(결과는 보지 않는다) 폐기한다 - 회전이
 *     새 refresh 를 냈다면 폐기할 것은 그것이다.
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
   * 앱이 켜질 때 부른다. 되살릴 수 없는 값은 저장소에서 지운다. 던지지 않는다. 읽는 동안 다시 부르면 같은
   * Promise 를 돌려주고(저장소는 한 번만 읽는다 - 루트의 효과가 개발 모드(StrictMode)에서 두 번 돌아도
   * 안전하다), 끝난 뒤에 부르면 처음 읽은 값이 아니라 지금의 세션을 돌려준다.
   */
  restore: () => Promise<StoredSession | null>
  status: () => SessionStatus
  current: () => StoredSession | null
  /**
   * 상태가 바뀔 때마다 부른다 - 복원이 끝날 때도(restoring 을 벗어나는 유일한 신호다). 돌려준 함수로
   * 구독을 끊는다. 구독자가 던져도 나머지 구독자는 불리고, 던진 것은 `console.error` 로 남는다.
   */
  subscribe: (listener: () => void) => () => void
  /**
   * 로그인·가입이 받은 토큰으로 세션을 세운다 - 저장소에 먼저 쓰고 그다음 알린다. 쓰기가 실패하면
   * 메모리에는 세우고(서버가 이미 내준 토큰이다) 그 오류로 거절한다.
   */
  establish: (session: Session, refreshExpiresIn: number) => Promise<void>
  /**
   * 인증이 필요한 요청이 실을 access token. 세션이 없으면 null 이다 - 쓰기 훅은 요청하지 않고
   * 로그인으로 보낸다(스펙 7.3 의 두 번째 겹). 만료까지 60초 이하면 회전한다. 회전한 세션을 저장소에
   * 쓰지 못하면 새 세션은 메모리에 두고 그 오류로 거절한다 - 다음 호출은 새 access 를 받는다.
   */
  getAccessToken: () => Promise<string | null>
  /**
   * 기기 세션을 지운다 - 인증 오류를 받았을 때(스펙 9.2). 백엔드를 부르지 않는다. 메모리는 곧바로
   * signedOut 이 되고, 저장소를 지우지 못하면 그 오류로 거절한다.
   */
  signOut: () => Promise<void>
  /**
   * 로그아웃(스펙 7.4) - 기기 세션과 캐시(`clearCaches`)를 먼저 비우고 refresh 폐기를 요청한다.
   * 요청이 실패해도 기기 쪽은 이미 비어 있다(logout.ts 의 endSession). 진행 중인 회전이 있으면 먼저 끝나길
   * 기다린다 - 가장 새 refresh 를 폐기하려는 것이다. 저장소를 지우지 못해도 메모리는 signedOut 이고 캐시
   * 비움과 폐기 요청은 이어서 한다 - 못 지운 항목이 남았어도 폐기가 그 refresh 를 죽여 둔다. 그 오류는 끝에
   * 거절로 나간다.
   */
  logout: (clearCaches: () => void) => Promise<LogoutOutcome>
}

export function createSessionManager({ storage, send, now }: SessionManagerDeps): SessionManager {
  let session: StoredSession | null = null
  let status: SessionStatus = 'restoring'
  let rotation: Promise<string | null> | null = null
  // 세션을 세우거나 지우는 일이 시작될 때마다 늘린다. 회전이나 쓰기가 끝났을 때 값이 바뀌어 있으면 그 사이에
  // 로그아웃이나 새 로그인이 있었던 것이다 - 늦게 끝난 결과로 덮어쓰지 않는다(로그아웃한 세션이 되살아나지 않게).
  let generation = 0
  // 지금 세션이 세워진 시점의 generation. 회전은 이 값을 달고 출발한다. 로그인은 쓰기가 끝나야 세션이 바뀌므로
  // 그 쓰기 창 안에서는 generation 이 이미 앞서 있다 - 그 창에서 옛 세션이 시작한 회전은 응답이 로그인의 쓰기보다
  // 먼저 오든 나중에 오든 걸러진다.
  let sessionGeneration = 0
  // 복원은 저장소를 한 번만 읽는다 - 읽는 동안의 호출은 이 Promise 를 같이 기다린다.
  let restoring: Promise<StoredSession | null> | null = null
  let restoreDone = false
  // 저장소의 쓰기와 지우기를 한 줄로 세운다. 앞의 것이 실패해도 줄은 이어진다.
  let storageQueue: Promise<void> = Promise.resolve()
  const listeners = new Set<() => void>()

  function queued(operation: () => Promise<void>): Promise<void> {
    const done = storageQueue.then(operation)
    storageQueue = done.catch(() => undefined)
    return done
  }

  function publish(next: StoredSession | null): void {
    session = next
    sessionGeneration = generation
    status = next === null ? 'signedOut' : 'signedIn'
    for (const listener of listeners) {
      try {
        listener()
      } catch (error) {
        // 구독자 하나가 던져도 나머지 구독자와 이 호출은 멀쩡해야 한다 - 던진 것은 개발자가 보게 남긴다.
        console.error('[session] 구독자가 던졌다 - 나머지 구독자는 계속 부른다:', error)
      }
    }
  }

  async function readStored(): Promise<StoredSession | null> {
    let restored: StoredSession | null = null
    try {
      const raw = await storage.read()
      restored = restoreSession(raw, now())
      if (restored === null && raw !== null) await queued(() => storage.clear())
    } catch {
      // 읽지 못한 세션(기기 키 저장소가 항목을 풀지 못하는 경우 등)은 없는 것과 같다 - 로그아웃
      // 상태로 시작한다(스펙 7.1).
    }
    restoreDone = true
    publish(restored)
    return restored
  }

  async function save(next: StoredSession, startedIn: number): Promise<void> {
    try {
      await queued(() => storage.write(serializeSession(next)))
    } finally {
      // 쓰기가 실패해도 메모리에는 세운다 - 백엔드가 이미 이 토큰을 내줬고(회전이면 옛 refresh 는
      // 폐기됐다) 버리면 사용자가 갇힌다. 다만 쓰는 동안 세대가 바뀌었으면(로그아웃이나 새 로그인)
      // 세우지 않는다. 오류는 호출자에게 그대로 간다.
      if (generation === startedIn) publish(next)
    }
  }

  async function signOut(): Promise<void> {
    generation += 1
    // 메모리부터 비운다 - 저장소를 기다리는 동안 늦게 끝나는 회전이 옛 access 를 돌려주거나 세션을
    // 되살리지 못하게, 그리고 저장소를 못 지워도 메모리는 로그아웃이 되게. 못 지운 항목은 다음 실행에서
    // 되살아날 수 있다 - logout() 이 폐기를 이어서 요청하는 까닭이다. 오류는 호출자에게 그대로 간다.
    publish(null)
    await queued(() => storage.clear())
  }

  async function rotate(current: StoredSession): Promise<string | null> {
    // 회전하는 세션이 세워진 세대를 단다(지금의 generation 이 아니다) - 그 뒤에 세션을 바꾸는 일이 시작됐다면,
    // 로그인의 쓰기가 아직 끝나지 않아 이 세션이 그대로여도, 이 회전은 옛 세션의 것이라 결과를 버린다.
    const startedIn = sessionGeneration
    // 요청을 보내기 직전의 시각을 만료의 기준으로 쓴다 - 응답이 늦게 와도 만료가 늦게 잡히지 않는다.
    const at = now()
    const outcome = await rotateSession(current.refreshToken, send, at)
    // 그 사이 로그아웃이나 새 로그인이 있었으면 이 결과는 쓸 데가 없다 - 지금 세션의 access 를 돌려준다.
    if (generation !== startedIn) return session?.accessToken ?? null
    if (outcome.kind === 'rotated') {
      const next = storedSessionFrom(outcome.session, outcome.refreshExpiresIn, at)
      await save(next, startedIn)
      // 쓰는 동안 세션이 바뀌었을 수 있다 - 세워진 세션(next, 아니면 그 사이의 새 세션)의 access 를 돌려준다.
      return session?.accessToken ?? null
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
      // 끝난 뒤의 호출은 처음 읽은 값이 아니라 지금의 세션을 돌려준다.
      if (restoreDone) return Promise.resolve(session)
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
      await save(storedSessionFrom(tokens, refreshExpiresIn, now()), generation)
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
    logout: async (clearCaches) => {
      // 진행 중인 회전이 있으면 끝나길 기다린다(결과는 보지 않는다) - 회전이 새 refresh 를 냈다면 폐기할
      // 것은 그것이다. 기다린 뒤에 세션을 잡는다: 아래 endSession 의 인자가 세션을 잡고, 그 첫 동작인
      // signOut 이 곧바로 세대를 올린다.
      if (rotation !== null) await rotation.catch(() => undefined)
      // 저장소를 못 지워도 signOut 이 메모리를 이미 signedOut 으로 만들었다. 캐시 비움과 폐기 요청은
      // 이어서 하고, 저장소 오류는 그것을 다 끝낸 뒤에 던진다.
      const failures: unknown[] = []
      const outcome = await endSession(session ?? undefined, send, async () => {
        try {
          await signOut()
        } catch (error) {
          failures.push(error)
        }
        clearCaches()
      })
      if (failures.length > 0) throw failures[0]
      return outcome
    },
  }
}
