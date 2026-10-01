import NetInfo from '@react-native-community/netinfo'
import { focusManager, MutationCache, onlineManager, QueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { AppState } from 'react-native'

import { isSessionRejected } from '@/lib/resources/write'
import { sessionManager } from '@/platform/session'

/**
 * 앱의 Query 캐시 하나(스펙 8.5). 조회·쓰기 모두 자동 재시도를 끈다 - 백엔드 클라이언트
 * (client.ts)가 재시도하지 않는 것과 같은 태도이고, 재시도가 회전 중인 refresh 를 다시 내밀지
 * 않게 한다(스펙 7.2). staleTime 0 은 기본값이지만 스펙 8.5 의 값이라 적어 둔다.
 *
 * networkMode 는 offlineFirst 다. 기본값 online 은 onlineManager 가 끊겼다고 하면 요청을 보내지
 * 않고 멈춰 둔다 - 첫 조회라면 스켈레톤이, 쓰기라면 제출 버튼의 스피너가 연결이 돌아올 때까지
 * 돈다. offlineFirst 는 요청을 한 번 보내고, 실패는 client.ts 가 NETWORK_ERROR 결과로 돌려준다 - 조회의
 * queryFn 이 그것을 던져(queries/resource-options.ts) 읽은 데이터는 남고, 화면이 앱 문구와 "다시 시도" 를
 * 그린다(스펙 9.3). 멈추는 것은 재시도뿐인데 재시도는 꺼져 있다.
 * 연결이 돌아오면 다시 부르는 것(refetchOnReconnect)은 이 모드의 기본값 그대로 켜져 있다.
 *
 * 인증 오류는 쓰기 캐시(MutationCache)의 onError 한 곳이 받는다(스펙 9.2). 쓰기 흐름
 * (lib/resources/write.ts)은 세션이 없거나 백엔드가 세션을 거절하면 세션 거절을 던지고, 여기서 기기
 * 세션을 지운다. 화면 이동은 세션 상태를 따르는 경로 가드(app/(app)/_layout.tsx)가 한다 - 쓰기
 * 화면은 보호 경로라 지금 경로를 next 로 실어 로그인으로 보낸다. 조회 캐시(QueryCache)에는 두지
 * 않는다 - 읽기는 토큰을 싣지 않아(스펙 7.2) 인증 오류가 오지 않는다. 쓰기는 세션 복원이 끝난 뒤의
 * 화면에서만 시작되므로 복원 중에 signOut 을 부르는 일이 없다(lib/auth/session-manager.ts 의 세대 번호).
 */
export const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (error) => {
      if (isSessionRejected(error)) signOutRejectedSession()
    },
  }),
  defaultOptions: {
    queries: { staleTime: 0, retry: false, networkMode: 'offlineFirst' },
    mutations: { retry: false, networkMode: 'offlineFirst' },
  },
})

/**
 * 세션 거절 뒤에 기기 세션을 지운다. signOut 은 메모리를 먼저 비우고(경로 가드가 곧바로 로그인으로
 * 보낸다) 저장소를 지우지 못하면 거절한다 - 그 거절을 떠 있게 두지 않고 이름과 문구만 남긴다
 * (lib/auth/AGENTS.md 의 "호출자는 삼키지 말고 알린다"). 못 지운 항목은 다음 실행에서 되살아날 수 있다 -
 * 백엔드가 거절한 세션이라 다음 쓰기의 회전이 다시 거절받아 지운다.
 */
function signOutRejectedSession(): void {
  sessionManager.signOut().catch((cause: unknown) => {
    const detail = cause instanceof Error ? `${cause.name}: ${cause.message}` : typeof cause
    console.error(`[session] 세션 거절 뒤 저장된 세션을 지우지 못했다 - ${detail}`)
  })
}

/**
 * 앱이 앞으로 나올 때와 네트워크가 돌아올 때 다시 부른다(스펙 8.5) - AppState → focusManager,
 * NetInfo → onlineManager. React Native 에는 브라우저의 visibilitychange·online 이벤트가 없어
 * TanStack Query 가 스스로 알지 못한다.
 *
 * 루트 레이아웃의 AppRoot 가 부른다 - 요청으로 이어지는 훅은 설정 검증이 통과한 갈래에만 둔다
 * (platform/AGENTS.md 의 "부팅 순서").
 */
export function useQueryRefetchTriggers(): void {
  useEffect(() => {
    const appState = AppState.addEventListener('change', (status) => {
      focusManager.setFocused(status === 'active')
    })
    onlineManager.setEventListener((setOnline) =>
      NetInfo.addEventListener((state) => {
        // isConnected 가 null 이면 아직 모르는 것이다 - 끊겼다고 보지 않는다. 끊김→연결을 지어내면
        // 앱이 켜지자마자 조회를 한 번 더 부른다.
        setOnline(state.isConnected !== false)
      }),
    )
    return () => {
      appState.remove()
      // 새 리스너를 걸면 onlineManager 가 앞의 것(NetInfo 구독)을 푼다.
      onlineManager.setEventListener(() => undefined)
    }
  }, [])
}
