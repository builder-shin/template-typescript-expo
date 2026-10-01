# queries/ 작업 지침

TanStack Query 의 캐시 키, 조회·쓰기 훅, 쓰기 후 무효화를 소유한다(스펙 5장·8.5). JSX 를 두지
않고 쿼리 문자열을 조립하지 않는다 - 요청 조립은 `lib/resources`가, 요청은 `platform/api.ts`의
`apiRequest`가 한다.

| 파일                  | 역할                                                                                                                                                                                                                                                                                                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `auth.ts`             | 가입·로그인·로그아웃 쓰기 훅과 로그아웃 진행 여부(`useIsLoggingOut`). `lib/auth/flow.ts`의 결정을 실행만 한다 - 세션을 세우는 데까지, 화면 이동은 화면이 한다. 로그인·가입의 옵션(`loginMutationOptions`·`registerMutationOptions`)과 키를 내보낸다 - 시험이 MutationObserver 로 돌린다                                                                            |
| `keys.ts`             | 캐시 키(`['resources', type, 'list' \| 'detail', …]`)와 쓰기의 키(`mutationKeys` - 수정·삭제는 id 까지 좁힌다), 쓰기 뒤 무효화 표(`cacheEffects`), 표를 캐시에 옮기는 `applyCacheEffects`(스펙 8.5). 시험이 표와 실제 `QueryClient` 로 잰다                                                                                                                        |
| `lab.ts`              | 계약 실험실의 실험 하나를 돌리는 쓰기 훅(`useLabExperiment`). 판단은 `lib/lab/run.ts` 가 한다 - 결과는 캐시에 두지 않고, 세션 거절이면 화면이 넘긴 콜백이 로그인으로 보낸다. 훅이 쓰는 옵션(`labExperimentMutationOptions`)을 내보낸다 - 시험이 MutationObserver 로 돌린다                                                                                         |
| `resources.ts`        | 자원의 조회 훅 - 목록(`useResourceList`, 무한 스크롤)과 상세(`useResourceDetail`), 관계 선택기의 참조 목록(`useRelationshipReferences` - 조회 계획과 결과 합성은 `resource-options.ts`). 판단은 `lib/resources/view.ts`·`screen-state.ts`·`form.ts` 가 한다. 쌓인 화면은 구독하지 않는다(`subscribed`)                                                             |
| `resource-options.ts` | 조회의 Query 옵션(키·요청·다음 쪽 - 목록·상세·관계 선택기의 참조 목록)과 화면 조회의 `gcTime`(`SCREEN_QUERY_GC_TIME`), 폼의 참조 조회들의 계획·결과 합성(`referencePlan`·`combineReferences`·`referencesOf`) - `queryFn` 이 닿지 못함을 던진다. React·기기 모듈을 모른다 - 시험이 가짜 요청과 실제 `QueryClient` 로 전이를 잰다                                    |
| `submit-once.ts`      | 제출 한 번 가드(`submitOnce`·`useSubmitOnce`) - 폼이 부를 쓰기의 키가 진행 중이면 그 제출을 버린다. 폼 말고 삭제 확인 시트와 계약 실험실도 쓴다 - 실험실은 실험마다의 키(`['lab', id]`)로 그 실험의 둘째 누름만 버린다                                                                                                                                             |
| `writes.ts`           | 자원의 쓰기 훅 - 생성·수정·삭제(`useCreateResource`·`useUpdateResource`·`useDeleteResource`). 흐름은 `lib/resources/write.ts`, 캐시는 `keys.ts` 의 표. 훅이 쓰는 옵션(`createResourceMutationOptions`·`updateResourceMutationOptions`·`deleteResourceMutationOptions`)과 삭제 `reset` 의 가드(`resetUnlessPending`)를 내보낸다 - 시험이 MutationObserver 로 돌린다 |

- 인증이 필요한 요청은 `sessionManager.getAccessToken()`(`platform/session.ts`)으로 토큰을 얻는다.
  `null`이면 요청하지 않는다(스펙 7.3의 쓰기 가드) - 쓰기 흐름(`lib/resources/write.ts`)이 세션 거절을 던지고
  `platform/query-client.ts`의 쓰기 캐시 `onError`가 기기 세션을 지우면, 경로 가드가 `next`를 실어 로그인으로
  보낸다(스펙 9.2). 401 에 회전·재시도를 붙이지 않는다(스펙 7.2).
- 세션 관리자의 `establish`·`getAccessToken`·`signOut`·`logout`은 저장소가 실패하면 메모리 상태를
  먼저 정리한 뒤에 거절한다(`lib/auth/AGENTS.md`). 이 함수를 부르는 훅이 그 거절을 잡아 토큰 없이
  (오류의 이름과 문구만 - `errorDetail`) 로그로 남긴다 - 삼키지 않고, 떠 있는 Promise 로 두지도 않는다. 화면 이동은
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
  부르는 쓰기 훅에는 `mutationKey`가 있다. 삭제 훅의 `reset`(확인을 취소할 때)도 같은 키로 쓰기 캐시를 본다 - 진행 중인
  삭제는 지우지 않는다(`resetUnlessPending`): 지우면 `remove()` 에 넘긴 성공 콜백이 불리지 않아 화면이 남는다.
- 계약 실험실의 실행 버튼도 같은 가드를 지난다(`useSubmitOnce(lab.mutationKey)`) - 실험마다 `['lab', id]` 키의 쓰기(`lab.ts`)라 한
  실험의 둘째 누름만 버리고 다른 실험은 막지 않는다. 키에 id 가 없으면 한 실험이 도는 동안 나머지의 실행까지 막힌다
  (`isMutating` 은 앞부분이 맞는 키를 모두 센다) - `test/unit/queries/lab.test.ts` 가 키가 id 를 따르는지 잰다.
- 쓰기 뒤의 캐시는 `keys.ts` 의 표를 지난다 - 생성·수정·삭제 훅(`writes.ts`)은
  `applyCacheEffects(queryClient, cacheEffects({ kind: 'create', type }))` 처럼 표를 부른다. 키를 손으로 적지 않는다.
- 삭제는 그 자원의 상세를 캐시에서 지운다. 지운 상세를 지켜보던 화면이 다시 그려지면 TanStack Query 가 새 조회를
  만들어 없는 자원을 부른다(404) - 그래서 지운 화면은 상세 조회를 끈다(`useResourceDetail(…, { enabled: !deleted })`).
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
  `listScreen`·`detailScreen`·`referenceState`(`lib/resources/screen-state.ts`)가 정한다 - 닿지 못함이 아닌 오류는 결함이라 렌더 중에
  다시 던져 오류 경계로 보낸다(참조 목록도 같다 - 문구 없는 거절은 계약 위반이라 던진다. 다만 `useQueries` 의 `combine` 안이 아니라
  훅이 던진다 - 아래). `test/unit/queries/resource-options.test.ts` 가 실제 `QueryClient` 와 `focusManager`·
  `onlineManager` 로 전이를 잰다(훅 자체는 시험하지 않는다 - 스펙 11.1). 관계 선택기의 참조 목록(`referenceQueryOptions`)도
  닿지 못함을 던진다 - 읽은 보기가 남고, 선택기가 그릴 것은 `referenceState` 가 정한다(`test/unit/queries/reference-options.test.ts`).
- 화면의 조회 훅(`useResourceList`·`useResourceDetail`·`useRelationshipReferences`)은 `subscribed: useIsFocused()` 를 준다 -
  쌓인 화면(조건을 바꿀 때마다 쌓이는 목록, 상세·수정 밑의 목록)은 앱 복귀·네트워크 복귀·무효화의 재조회를 부르지 않고,
  다시 앞에 오면 다시 구독하며 부른다(`staleTime` 0). TanStack Query 의 React Native 안내다 - 구독이 살아 있으면 스택
  깊이만큼 읽은 쪽 전부를 다시 읽는다(D3 최종 검토 M2). 새 조회 훅도 같은 옵션을 준다.
- 구독을 끊은 쌓인 화면의 조회는 구독자가 없다 - TanStack Query 는 구독자 없는 조회를 `gcTime`(기본 5분) 뒤에 캐시에서 지운다.
  그 뒤에 돌아온 화면은 스켈레톤과 첫 쪽부터 다시 읽고 스크롤 위치를 잃는다. 그래서 목록·상세·참조 목록의 옵션은
  `SCREEN_QUERY_GC_TIME`(30분, `resource-options.ts`)을 준다. 대가: 구독자 없는 조회가 읽은 쪽 전부와 함께 그 시간만큼
  메모리에 남는다(조건을 바꿀 때마다 쌓이는 목록마다) - 그 시간이 지나면 기본값일 때처럼 첫 쪽부터 다시 읽는다. 새 화면 조회의
  옵션도 같은 상수를 준다. `test/unit/queries/gc-time.test.ts` 가 옵션의 값과 구독자 없는 조회의 수명을 잰다.
- 폼의 관계 선택기들(`useRelationshipReferences`)은 `useQueries` 에 중복 없는 조회(`referencePlan`)를 넣고 결과를
  `combine`(`combineReferences`)으로 관계에 되돌려 잇는다. 같은 자원을 가리키는 관계가 둘이면 같은 키가 두 번 들어가 TanStack
  Query 가 경고하고 한 조회의 데이터를 나눠 갖는다. `combine` 은 `useCallback` 으로 고정한다 - 그러면 TanStack Query 가 결과가
  바뀔 때만 다시 돌리고 구조 공유해 선택기의 `list` 와 `retry` 가 렌더마다 바뀌지 않는다. 결과는 plain 객체와 배열로 둔다
  (구조 공유는 그것만 이어 붙인다). `test/unit/queries/reference-options.test.ts` 가 계획과 합성을 잰다.
  **`combine` 안에서 던지지 않는다 — 결함은 값으로 돌려주고 훅이 렌더 중에 다시 던진다.** TanStack Query 는 `combine` 을 렌더 밖에서도
  부른다(조회 응답이 도착할 때와 재조회가 시작될 때의 알림) - 거기서 던져진 것은 삼켜진다. 렌더는 오래된 결과를 받아 받기 전
  모양에 영원히 멈추고, 던진 채로는 같은 관찰자의 다른 조회가 요청을 보내지도 못해 형제 선택기까지 얼린다.
  `referenceState` 는 결함에 던지므로(문구 없는 거절, 조회 함수의 결함) `combineReferences` 가 그것을 `{ kind: 'defect' }` 값으로 담고
  훅이 `referencesOf` 로 꺼내 던진다 - 오류 경계로 가는 길은 목록·상세와 같고, 결함이 가시면 다음 합성이 다시 참조 목록이다.
  결함이 가시는 것은 다시 부를 때뿐이다 - 오류 경계의 "다시 시도" 는 다시 부르지 않아 캐시에 든 결함을 그대로 다시 던진다(스펙
  9.3 의 D4 정정).
  새 `combine` 도 던지지 않는다. 시험이 설치본 `QueriesObserver` 에 `useQueries` 가 하는 렌더·커밋 순서를 그대로 돌려 잰다.
- 쓰기의 오류는 값이다 - `write.ts` 는 검증·충돌·없는 자원·닿지 못함 같은 기대한 실패를 값으로 돌려주고, 던지는 것은 세션 거절뿐이다
  (쓰기 캐시의 `onError` 가 받는다). 그 밖에 `mutationFn` 안에서 던져진 것은 결함이다 - 쓰기 훅의 옵션이
  `throwOnError: (error) => !isSessionRejected(error)` 를 줘서 `useMutation` 이 렌더 중에 다시 던지고 오류 경계가 받는다(조회의
  결함과 같다). 주지 않으면 `mutate()` 가 삼켜 훅이 오류를 내보이지 않고 `onError` 도 아무것도 남기지 않아 폼이 아무 말 없이
  멈춘다. 새 쓰기 훅도 같은 옵션을 준다 - `test/unit/queries/writes.test.ts` 가 결함은 던지고 세션 거절은 던지지 않음을 잰다.
- 요청에 TanStack Query 의 `signal` 을 넘기지 않는다 - 끊은 요청은 e2e 변형에서 상태 0 실패(`[e2e-http] 0`)로
  기록돼 E2E 가드에 걸리고, 조회는 작아서 화면을 떠난 뒤 끝까지 받아도 잃는 것이 없다. 넘기게 되면 세 곳을 함께
  고친다: `apiRequest`(`platform/api.ts`)가 호출자가 끊은 요청을 실패 표식으로 남기지 않게, `lib/jsonapi/client.ts` 의
  타이머 콜백이 이미 끊긴 요청에 `timedOut` 을 세우지 않게(`if (controller.signal.aborted) return` - 시험 하나와
  출처 기록의 이탈 한 줄), 그리고 이 문단.
