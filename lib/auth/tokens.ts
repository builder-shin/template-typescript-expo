/**
 * access 만료 판정.
 *
 * JWT 를 디코드하지 않는다. 백엔드의 authTokens 문서가 expiresIn(초)을
 * 실어 오므로(실측), 발급 시각에 더해 절대 만료 시각을 쿠키에 함께
 * 저장해 두면 된다. 파서를 들이면 서명 검증을 안 하는 파서가 신뢰의
 * 근거처럼 보이게 되고, 그건 이 계층이 할 일이 아니다.
 *
 * 회전하지 않는다 - 회전은 proxy.ts 한 곳에서만 일어난다(스펙 7.2).
 */

export interface AuthTokenAttributes {
  accessToken: string
  refreshToken: string
  tokenType: string
  expiresIn: number
  refreshExpiresIn: number
}

export interface Session {
  accessToken: string
  refreshToken: string
  /** epoch ms. 이 시각 이후로는 백엔드가 TOKEN_EXPIRED 를 낸다. */
  accessExpiresAt: number
}

/**
 * 만료 임박 판정의 여유. 스펙 7.2 가 "<=60초"로 정한다.
 *
 * 이 값이 요청 처리 시간보다 넉넉해야 한다 - 프록시가 "아직 40초 남았다"고
 * 판단해 통과시킨 요청이 백엔드에 닿기 전에 만료되면 401 이 나고, 그것을
 * 회전으로 처리하려는 코드가 refresh 재사용을 만든다.
 */
export const ACCESS_EXPIRY_LEEWAY_MS = 60_000

export function sessionFromTokenDocument(
  attributes: AuthTokenAttributes,
  now: number = Date.now(),
): Session {
  return {
    accessToken: attributes.accessToken,
    refreshToken: attributes.refreshToken,
    accessExpiresAt: now + attributes.expiresIn * 1000,
  }
}

export function isAccessExpiring(session: Session, now: number = Date.now()): boolean {
  return session.accessExpiresAt - now <= ACCESS_EXPIRY_LEEWAY_MS
}
