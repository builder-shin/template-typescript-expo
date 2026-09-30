import { QueryClient } from '@tanstack/react-query'

/**
 * 앱의 Query 캐시 하나(스펙 8.5). 조회·쓰기 모두 자동 재시도를 끈다 - 백엔드 클라이언트
 * (client.ts)가 재시도하지 않는 것과 같은 태도이고, 재시도가 회전 중인 refresh 를 다시 내밀지
 * 않게 한다(스펙 7.2). staleTime 0 은 기본값이지만 스펙 8.5 의 값이라 적어 둔다.
 *
 * 앱 복귀·네트워크 복귀 때의 재조회(focusManager·onlineManager)는 조회 화면과 함께 붙인다.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 0, retry: false },
    mutations: { retry: false },
  },
})
