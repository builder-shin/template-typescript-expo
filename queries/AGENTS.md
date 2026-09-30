# queries/ 작업 지침

TanStack Query 의 캐시 키, 조회·쓰기 훅, 쓰기 후 무효화를 소유한다(스펙 5장·8.5). JSX 를 두지
않고 쿼리 문자열을 조립하지 않는다 - 요청 조립은 `lib/resources`가, 요청은 `platform/api.ts`의
`apiRequest`가 한다.

| 파일           | 역할                                                                                                                                                                                |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth.ts`      | 가입·로그인·로그아웃 쓰기 훅과 로그아웃 진행 여부(`useIsLoggingOut`). `lib/auth/flow.ts`의 결정을 실행만 한다 - 세션을 세우는 데까지, 화면 이동은 화면이 한다                       |
| `keys.ts`      | 캐시 키(`['resources', type, 'list' \| 'detail', …]`)와 쓰기 뒤 무효화 표(`cacheEffects`), 표를 캐시에 옮기는 `applyCacheEffects`(스펙 8.5). 시험이 표와 실제 `QueryClient` 로 잰다 |
| `resources.ts` | 자원의 조회 훅 - 목록(`useResourceList`, 무한 스크롤)과 상세(`useResourceDetail`). 판단은 `lib/resources/view.ts` 가 한다                                                           |

- 인증이 필요한 요청은 `sessionManager.getAccessToken()`(`platform/session.ts`)으로 토큰을 얻는다.
  `null`이면 요청하지 않고 로그인으로 보낸다(스펙 7.3의 쓰기 가드). 401 에 회전·재시도를 붙이지
  않는다(스펙 7.2).
- 세션 관리자의 `establish`·`getAccessToken`·`signOut`·`logout`은 저장소가 실패하면 메모리 상태를
  먼저 정리한 뒤에 거절한다(`lib/auth/AGENTS.md`). 이 함수를 부르는 훅이 그 거절을 잡아 토큰 없이
  (오류의 이름과 문구만) 로그로 남긴다 - 삼키지 않고, 떠 있는 Promise 로 두지도 않는다. 화면 이동은
  거절이 아니라 세션 상태를 따른다.
- 로그아웃은 Query 캐시를 전부 비운다(스펙 8.5) - `keys.ts` 무효화 표의 `logout` 행을 지난다. 조회 캐시만
  비운다(`removeQueries`) - mutation 캐시는
  변수(평문 비밀번호)와 결과(토큰)를 기본 5분 들고 있으므로, 자격증명이나 토큰을 싣는 쓰기 훅(로그인·
  가입)은 짧은 `gcTime`(1초)을 준다. 화면이 닫혀 구독이 끊기면 그 안에 치워진다. 0 으로 두지 않는다 -
  구독이 없는데 진행 중인 쓰기의 치우기를 query-core 가 같은 시간으로 다시 예약해, 0ms 타이머가 돈다.
- 조회·쓰기의 기본 `networkMode`는 `offlineFirst`다(`platform/query-client.ts`) - 오프라인이어도 한 번은 보내고,
  닿지 못하면 결과 값(transport)이 온다. `onlineManager`는 NetInfo 에, `focusManager`는 AppState 에 물려 있다
  (`useQueryRefetchTriggers`). 인증 쓰기(로그인·가입·로그아웃)는 훅에 `networkMode: 'always'`를 직접 적는다 -
  TanStack Query 의 기본값('online')이면 오프라인에서 `mutationFn`을 부르지 않고 멈춰 두면서 진행 중으로 세어,
  오프라인 로그아웃이 기기 세션을 지우지 못한 채 스피너가 끝나지 않는다. 기기 쪽을 비워야 하는 쓰기는 같은 옵션을 준다.
- 자동 재시도는 `platform/query-client.ts`가 끈다.
- 쓰기 뒤의 캐시는 `keys.ts` 의 표를 지난다 - 생성·수정·삭제 훅(D4)도
  `applyCacheEffects(queryClient, cacheEffects({ kind: 'create', type }))` 처럼 표를 부른다. 키를 손으로 적지 않는다.
- `apiRequest` 는 던지지 않는다 - 백엔드 오류도 닿지 못함도 결과 값이다. 조회 훅은 Query 의 오류 상태를 쓰지 않고
  결과를 view 함수에 넘긴다. 무한 조회의 쪽도 결과 값 그대로 쌓인다(`listView` 가 쪽 배열을 읽는다).
- 요청에 TanStack Query 의 `signal` 을 넘기지 않는다 - 끊은 요청은 e2e 변형에서 상태 0 실패(`[e2e-http] 0`)로
  기록돼 E2E 가드에 걸리고, 조회는 작아서 화면을 떠난 뒤 끝까지 받아도 잃는 것이 없다. 넘기게 되면 세 곳을 함께
  고친다: `apiRequest`(`platform/api.ts`)가 호출자가 끊은 요청을 실패 표식으로 남기지 않게, `lib/jsonapi/client.ts` 의
  타이머 콜백이 이미 끊긴 요청에 `timedOut` 을 세우지 않게(`if (controller.signal.aborted) return` - 시험 하나와
  출처 기록의 이탈 한 줄), 그리고 이 문단.
