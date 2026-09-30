import { useSyncExternalStore } from 'react'

import { createSessionManager, type SessionStatus } from '@/lib/auth/session-manager'
import { apiRequest } from '@/platform/api'
import { secureSessionStorage } from '@/platform/secure-session-storage'

/**
 * 앱의 세션 관리자 하나(스펙 7.2) - 회전·저장·로그아웃이 전부 이 인스턴스를 지난다. 판단은
 * lib/auth/session-manager.ts 에 있고, 여기서는 저장 매체(SecureStore)·API 클라이언트·시계를
 * 꽂는다.
 *
 * 하나뿐이라 Context 로 내려보낼 값이 없다 - 화면은 useSessionStatus() 로 상태를 읽는다.
 */
export const sessionManager = createSessionManager({
  storage: secureSessionStorage,
  send: apiRequest,
  now: () => Date.now(),
})

/** 세션 상태(restoring · signedIn · signedOut)를 React 에 잇는다. */
export function useSessionStatus(): SessionStatus {
  return useSyncExternalStore(sessionManager.subscribe, sessionManager.status)
}
