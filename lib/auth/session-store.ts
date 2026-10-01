import type { Session } from './tokens'

/**
 * 세션의 저장 모양과 복원 판단 - 스펙 7.1.
 *
 * 세션은 저장소 항목 **하나**에 JSON 으로 둔다. 회전은 두 토큰을 한꺼번에 바꾸는데, 항목이
 * 둘이면 두 쓰기 사이에 앱이 종료될 때 새 refresh 를 잃을 수 있다.
 *
 * 저장 매체(SecureStore)는 이 파일이 모른다 - `SessionStorage` 모양만 정하고, 앱에서는
 * platform/secure-session-storage.ts 가, 시험에서는 메모리 가짜가 그 모양을 채운다.
 */

/** 저장소 항목의 키. SecureStore 키는 영숫자와 `.`·`-`·`_` 만 받는다. */
export const SESSION_STORAGE_KEY = 'auth.session'

/** 저장되는 세션 - tokens.ts 의 Session 에 refresh 만료 시각을 더한다. */
export interface StoredSession extends Session {
  /** epoch ms. 이 시각 이후로는 refresh 로 회전할 수 없다 - 되살리지 않는다. */
  refreshExpiresAt: number
}

/**
 * 세션 항목 하나를 읽고 쓰고 지우는 저장 매체. 멤버를 함수 속성으로 적는다 - 호출자가 떼어
 * 넘겨도 this 에 기대지 않는다.
 */
export interface SessionStorage {
  read: () => Promise<string | null>
  write: (value: string) => Promise<void>
  clear: () => Promise<void>
}

/**
 * 로그인·회전 응답에서 저장할 세션을 만든다. `now` 는 refresh 만료의 기준인 기기 시각이다.
 *
 * - 회전은 요청을 보내기 직전의 시각을 넘긴다(session-manager.ts 의 rotate) - `session.accessExpiresAt`
 *   을 만든 시각과 같다. 두 만료가 요청이 걸린 시간만큼 이르게 잡히는 안전한 쪽이다.
 * - 로그인·가입은 응답을 받은 뒤의 시각을 넘긴다(session-manager.ts 의 establish). access 만료는 그보다
 *   앞선 시각으로 잡혀 온다 - 로그인은 요청을 보내기 전의 시각(credentials.ts 의 signIn 이 받은 `now`),
 *   가입은 가입 요청을 보내기 전의 시각이다(signUpThenSignIn 이 한 번 잡은 `now` 를 이어지는 로그인에도
 *   넘긴다). refresh 만료는 그보다 늦은 시각을 기준으로 잡힌다 - 두 기준의 차이는 로그인이 요청 하나(요청
 *   시간 제한 15초 이하), 가입이 요청 둘(30초 이하)이 걸린 시간이다. refresh 수명(30일)에 비해 작아서 두
 *   시각을 하나로 맞추지 않는다.
 */
export function storedSessionFrom(
  session: Session,
  refreshExpiresIn: number,
  now: number,
): StoredSession {
  return {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    accessExpiresAt: session.accessExpiresAt,
    refreshExpiresAt: now + refreshExpiresIn * 1000,
  }
}

/** 네 필드만 정해진 순서로 쓴다 - 호출자가 넘긴 객체의 다른 필드가 저장소로 새지 않는다. */
export function serializeSession(session: StoredSession): string {
  return JSON.stringify({
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    accessExpiresAt: session.accessExpiresAt,
    refreshExpiresAt: session.refreshExpiresAt,
  })
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value !== ''
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/**
 * 앱이 켜질 때 저장된 값을 세션으로 되살린다. 되살릴 수 없으면 `null` - 로그아웃 상태로 시작한다.
 *
 * `null` 이 되는 경우: 저장된 값이 없다 · JSON 이 아니다 · 필드가 빠졌거나 모양이 다르다 ·
 * refresh 가 이미 만료됐다. access 만 만료된 세션은 되살린다 - 다음 인증 요청이 회전한다(스펙 7.2).
 */
export function restoreSession(raw: string | null, now: number): StoredSession | null {
  if (raw === null) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null

  const { accessToken, refreshToken, accessExpiresAt, refreshExpiresAt } = parsed as Record<
    string,
    unknown
  >
  if (
    !isNonEmptyString(accessToken) ||
    !isNonEmptyString(refreshToken) ||
    !isFiniteNumber(accessExpiresAt) ||
    !isFiniteNumber(refreshExpiresAt)
  ) {
    return null
  }
  if (refreshExpiresAt <= now) return null
  return { accessToken, refreshToken, accessExpiresAt, refreshExpiresAt }
}
