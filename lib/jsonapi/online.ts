/**
 * 기기의 연결 상태에서 TanStack Query 의 온라인 여부를 정한다(스펙 8.5) - platform/query-client.ts 가 NetInfo 의
 * isConnected 를 넘긴다. 연결이 돌아오는 것(오프라인 → 온라인)이 재조회의 계기다.
 *
 * null 은 아직 모르는 것이다 - 끊겼다고 보지 않는다. 앱이 켜진 직후 NetInfo 가 처음 알리기 전의 값이 null 이라,
 * 그것을 끊김으로 보면 곧 이어지는 연결 알림이 끊김 → 연결을 지어내 앱이 켜지자마자 조회를 한 번 더 부른다. 끊겼다고
 * 확실히 말할 때(false)만 오프라인이다.
 */
export function isOnline(isConnected: boolean | null): boolean {
  return isConnected !== false
}
