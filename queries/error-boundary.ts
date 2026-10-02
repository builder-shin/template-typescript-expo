import type { QueryClient } from '@tanstack/react-query'

/**
 * 오류 경계의 "다시 시도" - 조회 캐시를 비운 뒤 경계를 푼다(스펙 9.3 의 D8 정정). 루트 레이아웃의 `ErrorBoundary`
 * (app/_layout.tsx)가 경계의 `retry` 대신 부른다.
 *
 * 경계로 오는 결함 가운데 문구 없는 오류 문서·본문 없는 성공 응답은 판정한 응답이라 조회의 결과 값으로 캐시에 들고, 화면이
 * 렌더 중에 그 값을 읽어 던진다(lib/resources/screen-state.ts). 경계의 `retry` 는 요청을 다시 보내지 않고 경계의 상태만
 * 지운다 - 캐시를 두면 다시 그린 화면이 같은 값을 읽어 같은 결함을 요청 없이 다시 던진다. 구독자 없는 화면 조회는
 * `gcTime`(`SCREEN_QUERY_GC_TIME` 30분 - resource-options.ts) 동안 남아, 그 시간 안에 같은 화면에 다시 들어가도 그렇다.
 * 비우면 다시 그린 화면이 다시 부른다 - 판정한 결함은 같은 답이라 다시 경계로 오지만, 백엔드가 고쳐졌으면 앱을 다시 켜지
 * 않아도 풀린다.
 *
 * 조회 캐시만 비운다 - 로그아웃과 같은 범위다(이 디렉터리의 AGENTS.md). 쓰기의 상태는 훅을 쥔 컴포넌트가 다시 그려지며
 * 새로 시작한다.
 */
export function retryWithClearedQueries(
  client: QueryClient,
  retry: () => Promise<void>,
): Promise<void> {
  client.removeQueries()
  return retry()
}
