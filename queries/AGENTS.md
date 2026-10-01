# queries/ 작업 지침

TanStack Query 의 캐시 키, 조회·쓰기 훅, 쓰기 후 무효화를 소유한다(스펙 5장·8.5). JSX 를 두지
않고 쿼리 문자열을 조립하지 않는다 - 요청 조립은 `lib/resources`가, 요청은 `platform/api.ts`의
`apiRequest`가 한다.

| 파일                  | 역할                                                                                                                                                                                                                                                                                    |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth.ts`             | 가입·로그인·로그아웃 쓰기 훅과 로그아웃 진행 여부(`useIsLoggingOut`). `lib/auth/flow.ts`의 결정을 실행만 한다 - 세션을 세우는 데까지, 화면 이동은 화면이 한다. 로그인·가입의 옵션(`loginMutationOptions`·`registerMutationOptions`)과 키를 내보낸다 - 시험이 MutationObserver 로 돌린다 |
| `keys.ts`             | 캐시 키(`['resources', type, 'list' \| 'detail', …]`)와 쓰기 뒤 무효화 표(`cacheEffects`), 표를 캐시에 옮기는 `applyCacheEffects`(스펙 8.5). 시험이 표와 실제 `QueryClient` 로 잰다                                                                                                     |
| `resources.ts`        | 자원의 조회 훅 - 목록(`useResourceList`, 무한 스크롤)과 상세(`useResourceDetail`). 판단은 `lib/resources/view.ts`·`screen-state.ts` 가 한다                                                                                                                                             |
| `resource-options.ts` | 조회의 Query 옵션(키·요청·다음 쪽) - `queryFn` 이 닿지 못함을 던진다. React·기기 모듈을 모른다 - 시험이 가짜 요청과 실제 `QueryClient` 로 전이를 잰다                                                                                                                                   |
| `submit-once.ts`      | 제출 한 번 가드(`submitOnce`·`useSubmitOnce`) - 폼이 부를 쓰기의 키가 진행 중이면 그 제출을 버린다                                                                                                                                                                                      |

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
  닿지 못하면 조회의 `queryFn` 이 던진다(아래) - 읽은 데이터는 남는다. `onlineManager`는 NetInfo 에, `focusManager`는
  AppState 에 물려 있다(`useQueryRefetchTriggers`). 인증 쓰기(로그인·가입·로그아웃)는 훅에 `networkMode: 'always'`를 직접 적는다 -
  TanStack Query 의 기본값('online')이면 오프라인에서 `mutationFn`을 부르지 않고 멈춰 두면서 진행 중으로 세어,
  오프라인 로그아웃이 기기 세션을 지우지 못한 채 스피너가 끝나지 않는다. 기기 쪽을 비워야 하는 쓰기는 같은 옵션을 준다.
- 자동 재시도는 `platform/query-client.ts`가 끈다.
- 폼의 제출은 `useSubmitOnce(쓰기의 키)`로 감싼다 - 제출 버튼과 키보드의 이동 키가 한 틱 안에 함께 눌려도 요청은
  하나다. 렌더 때의 `isPending`으로 막지 않는다 - 둘째 누름도 같은 렌더를 본다(`submit-once.ts` 머리말). 그래서 폼을
  부르는 쓰기 훅에는 `mutationKey`가 있다.
- 쓰기 뒤의 캐시는 `keys.ts` 의 표를 지난다 - 생성·수정·삭제 훅(D4)도
  `applyCacheEffects(queryClient, cacheEffects({ kind: 'create', type }))` 처럼 표를 부른다. 키를 손으로 적지 않는다.
- `apiRequest` 는 던지지 않는다 - 백엔드 오류도 닿지 못함도 결과 값이다. 설정 오류는 예외다: `request()` 가 일부러
  던진다(`lib/jsonapi/client.ts` 머리말 - 배포에 고정된 결함을 "연결할 수 없다" 배너로 삼키지 않으려는 것). 조회 훅은
  그 예외를 다루지 않는다 - 설정 검증을 통과한 갈래(`STARTUP.ok`)에서만 도는 훅이라 여기까지 오지 않는다
  (`platform/AGENTS.md` 의 부팅 순서).
- 조회의 `queryFn`(`resource-options.ts`)은 `apiRequest` 의 결과 가운데 **백엔드의 판정을 받지 못한 것만 던진다** - 닿지
  못함과 판정하지 않은 응답(5xx·408·429 - D4, 회전과 같은 셋)이다(`throwIfUnreachable` -
  `UnreachableError`). TanStack Query 는 재조회가 실패해도 앞의 `data` 를 두므로 - 무한 조회는 읽은 쪽 전부를 - 앱
  복귀·네트워크 복귀·당겨서 새로고침·다시 들어온 상세·쓰기 뒤 무효화의 재조회가 닿지 못해도 읽은 목록과 상세가 남고,
  연결이 돌아온 뒤의 재조회도 읽어 둔 쪽을 모두 다시 읽는다. 닿지 못함을 결과 값으로 캐시에 두면 재조회의 실패가 읽은
  데이터를 갈아엎는다(쪽 배열이 `[실패]` 하나가 되고 다음 재조회는 그 한 쪽만 읽는다 - D3 최종 검토가 설치본 query-core
  로 재 보였다. D3 재검토가 같은 결함을 백엔드 오류 문서에서 봐 D4 가 5xx·408·429 를 더했다). 판정한 백엔드 오류
  문서(그 밖의 4xx)는 결과 값으로 캐시에 든다 - 배너다(첫 조회의 판정하지 않은 응답도 그 문구의 배너다). 화면 상태는 Query 의 데이터·오류에서
  `listScreen`·`detailScreen`(`lib/resources/screen-state.ts`)이 정한다 - 닿지 못함이 아닌 오류는 결함이라 렌더 중에
  다시 던져 오류 경계로 보낸다. `test/unit/queries/resource-options.test.ts` 가 실제 `QueryClient` 와 `focusManager`·
  `onlineManager` 로 전이를 잰다(훅 자체는 시험하지 않는다 - 스펙 11.1).
- 요청에 TanStack Query 의 `signal` 을 넘기지 않는다 - 끊은 요청은 e2e 변형에서 상태 0 실패(`[e2e-http] 0`)로
  기록돼 E2E 가드에 걸리고, 조회는 작아서 화면을 떠난 뒤 끝까지 받아도 잃는 것이 없다. 넘기게 되면 세 곳을 함께
  고친다: `apiRequest`(`platform/api.ts`)가 호출자가 끊은 요청을 실패 표식으로 남기지 않게, `lib/jsonapi/client.ts` 의
  타이머 콜백이 이미 끊긴 요청에 `timedOut` 을 세우지 않게(`if (controller.signal.aborted) return` - 시험 하나와
  출처 기록의 이탈 한 줄), 그리고 이 문단.
