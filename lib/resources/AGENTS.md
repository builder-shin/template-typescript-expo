# lib/resources/ 작업 지침

자원 선언과 그 판단을 소유한다(스펙 5장). JSX·fetch·네이티브 모듈을 갖지 않는다.

## 복사본이다

`define.ts`·`example.ts`·`category.ts`·`tag.ts`·`index.ts`·`mirror.ts`는
`template-typescript-nextjs`에서 복사했다. 출처와 이탈은 `docs/provenance/copied-core.json`.
목록·상세 판단 `view.ts` 는 D3 가 복사했다 - 목록을 커서로(`listQuery`·`nextPageQuery`), 필터 입력을 폼
상태 객체로(`FilterFormValues`·`filterFormValues`·`filterHref`), 백엔드에 닿지 못함을 던지지 않는
`unreachable` 로 고쳤고 offset 쪽 이동을 뺐다. 요청 조립(`listRequest`·`detailRequest`·`referenceRequest`)은
Accept-Language 를 싣지 않는다 - 싣는 자리는 `platform/api.ts` 하나다(스펙 9.4). 이 저장소가 더한 판단의
시험은 `test/unit/resources/view-expo.test.ts` 다. 쓰기 판단 `form.ts` 는 D4 가 같은 방식으로 복사했다 - 입력이
FormData 가 아니라 폼 상태 객체(`ResourceFormValues` 를 만들고 고치는 `newFormValues`·`withAttribute`·
`withRelationshipChoice`)이고, 원본이 컴포넌트에 두던 관계 선택기의 판단(`relationshipTargets`·`relationshipChoice`)을
더했다. 그 시험은 `test/unit/resources/form-expo.test.ts` 다. 쓰기 한 번의 흐름(세션 확인 → 요청 → 응답 해석, 원본의
Server Action 자리)은 이 저장소의 `write.ts` 이고 `test/unit/resources/write.test.ts` 가 가짜 전송·토큰으로 잰다.
회전이 판정을 받지 못한 채 이미 만료된 access 가 돌아오면(만료 가드, 스펙 7.2) `write.ts` 는 요청하지 않고 앱 문구의
값을 돌려준다 - 생성·수정은 `unusableFormState`, 삭제는 `messages` - 던지지 않으니 세션은 그대로다(실제 세션 관리자와 이어
`test/unit/resources/write-session.test.ts` 가 잰다).
무한 스크롤의 끝(`nextPageQuery`)과 관계 선택기의 잘림(`referenceList` 의 `truncated`)은 한 판정(`nextLinkQuery`)이다 -
`test/unit/resources/next-link.test.ts` 가 같은 응답을 두 함수에 넣어 잰다.

## 조회 화면의 상태

`screen-state.ts` 는 이 저장소의 새 파일이다(복사본이 아니다). 조회의 `queryFn` 이 백엔드의 판정을 받지 못한
결과 - 닿지 못함과 판정하지 않은 응답(5xx·408·429, D4) - 를 던지게 하고(`throwIfUnreachable` - `UnreachableError`), TanStack Query 가 준 데이터·오류에서 화면이 그릴 것을 정한다
(`listScreen`·`detailScreen`). 재조회가 닿지 못해도 읽은 목록·상세를 두고 작은 실패를 싣는다 - 실패를 결과 값으로
캐시에 두면 재조회의 실패가 읽은 쪽을 갈아엎는다(스펙 8.5·9.3 의 D3 정정). `view.ts` 의 `listView`·`detailView` 는
그대로 쓴다 - 닿지 못함이 캐시에 들지 않을 뿐이다. 시험은 `test/unit/resources/screen-state.test.ts`(판단)와
`test/unit/queries/resource-options.test.ts`(실제 `QueryClient` 의 전이)다. 판정한 백엔드 오류 문서(그 밖의 4xx)는
결과 값이라 재조회의 답이어도 새 답이다(지워진 상세는 not-found) - 판정하지 않은 응답의 판단은
`test/unit/resources/screen-state-unjudged.test.ts`, 그 전이는 `test/unit/queries/refetch-unjudged.test.ts` 가 잰다.
목록 끝에서 다음 쪽을 부를지는 `canLoadMore` 다. 관계 선택기의 참조 목록도 같은 규칙이다(`referenceState` - 읽은
보기는 재조회가 판정을 받지 못해도 두고, 선택기는 작은 실패를 따로 그리지 않는다). 그 시험은
`test/unit/resources/reference-state.test.ts` 와 `test/unit/queries/reference-options.test.ts` 다.

## 목록 주소의 인코딩

앱이 만드는 목록 주소(정렬·필터 적용·필터 지우기)는 `hrefWithQuery` 의 `URLSearchParams` 직렬화 그대로
키와 값을 퍼센트 인코딩한다(`filter%5Bstatus%5D=…`). Expo Router 57 은 그 모양의 대괄호 키를 평평한 키로
되살린다. 새 인코딩 코드를 만들지 않는다 - 규칙과 한계는 `docs/superpowers/notes/2026-09-30-d3-measurements.md`
의 L1.

## 라우트 파라미터

목록 화면은 라우트 파라미터를 `route-params.ts` 의 `listRouteParams` 로 거른 뒤 판단 함수에 넘긴다 - Expo
Router 는 이동이 싣는 값(로그인·가입 뒤 복귀의 `withAnchor` 가 싣는 `initial`)도 라우트 파라미터에 섞고,
정렬·필터 주소는 남의 파라미터를 그대로 옮긴다(`view.ts` 의 `carriedParams`). 이름이 정해진 파라미터(상세·수정의
`id`)는 이름으로 꺼낸다. 어느 화면도 라우트 파라미터 전체를 펼치거나 돌지 않는다.
`test/unit/resources/route-params-usage.test.ts` 가 `app/` 을 훑어 이 규칙을 막는다 - `useLocalSearchParams` 의
호출은 `listRouteParams(…)` 안이거나, 이름으로 구조 분해하거나, 키 하나를 바로 읽는 것이어야 한다.

`isCurrentListHref` 는 이동할 목록 주소가 지금 화면의 조건과 같은지 본다 - 같으면 화면이 `router.push` 하지 않고 시트만
닫는다(같은 목록 화면이 한 벌 더 쌓이지 않게).

## 선언은 데이터다

`filters`·`sorts`는 백엔드 조회 정책을 **손으로 베낀 거울**이다. 손으로 유지되는 거울은
반드시 어긋나므로 계약 거울(스펙 11.2)이 실제 백엔드에 HTTP 로 맞대어 잡는다 - 게이트 `[12/13]` 의
`test/contract/mirror.test.ts` 다. 선언된 조회 정책이 백엔드에서 받아들여지는지, 선언된 필드의 선언 밖 연산자와
고정된 가짜 이름의 정렬이 거부되는지, 응답 속성의 키 집합과 선언된 enum 값이 맞는지를 잰다(속성 제약은 쓰기
라우트가 있는 `examples` 에만 있다). **어긋남을 전부 잡지는 않는다** - 선언에서 정렬이나 필터 필드를 빼는 쪽처럼
못 잡는 것은 `test/contract/AGENTS.md` 의 "잡지 못하는 것"에 있다. `RESOURCES` 에 더한 자원은 이 검사를 저절로
받는다. `test/unit/resources/mirror.test.ts` 는 프로브가 만들어지는 구조를 고정한다.

## 명시적 등록

`index.ts`의 `RESOURCES`는 손으로 채우는 배열이다. 여기 없으면 그 자원은 존재하지 않는
것과 같다. 새 자원은 선언 파일을 만들고 이 배열에 손으로 더한다.
