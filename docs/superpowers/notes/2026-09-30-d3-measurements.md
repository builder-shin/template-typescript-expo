# D3 실측 기록 (2026-09-30)

D3(목록·상세)를 구현하며 정하고 잰 것이다. 명령과 출력을 함께 적는다. L1 은 Task 1, L2–L4 는 Task 3,
L5·L6 은 Task 5 가 적었다.

## L1 — 목록 주소의 인코딩 규칙 (스펙 8.2)

**정한 것.** 앱이 만드는 목록 주소(정렬 메뉴·필터 시트의 "적용"·"필터 지우기")는 `URLSearchParams` 의
직렬화 그대로 키와 값을 퍼센트 인코딩한다 - `filter%5Bstatus%5D%5Bin%5D=draft%2Cactive`. 조립은
`lib/resources/view.ts` 의 `hrefWithQuery`(원본 그대로)와 그것을 부르는 `filterHref`(이 저장소가 더했다)·
`sortOptions`·`clearFiltersHref` 다. 인코딩을 위한 코드를 따로 두지 않는다 - 원본의 조립이 이미 이 모양이다.
문서와 E2E 의 딥링크도 같은 모양으로 쓴다.

**근거.**

- D1 실측 M2: 인코딩한 딥링크(`%5B`·`%5D`)의 대괄호 키가 켜진 앱·꺼진 앱 모두에서 평평한 키로 돌아왔다 -
  두 단계 키(`filter[title][contains]`)까지. `router.setParams` 도 같았다. 인코딩하지 않은 링크는 한 단계
  키(`filter[status]`)만 쟀다.
- expo-router 57.0.24 설치본(`node_modules/expo-router/build`)에서 주소 → 라우트 파라미터는 두 단계다.
  `fork/getStateFromPath-forks.js` 의 `parseQueryParams` 가 `new URL(주소, 'file:').searchParams` 에서 이름마다
  `getAll`(값이 하나면 문자열)을 하고, `hooks/useLocalSearchParams.js` 가 값마다 `decodeURIComponent` 를 한 번
  더 한다(실패하면 그대로). 앱 안의 이동(`router.push(주소)`)도 `global-state/getNavigationAction.js` 에서 같은
  `getStateFromPath` 를 지난다.
- 조건을 바꾸는 이동은 `router.push` 다. 스택 라우터의 PUSH 는 이름이 같아도 새 화면을 쌓는다
  (`react-navigation/routers/StackRouter.js`). `router.setParams` 는 `navigationRef.setParams` 로 지금 화면의
  파라미터를 바꿀 뿐 기록을 남기지 않는다 - 스펙 8.2 의 "뒤로 가기가 이전 조건을 되살린다" 를 지키지 못한다.

**시험.** `test/unit/resources/view-expo.test.ts` 의 "라우트 파라미터 왕복" 이 위 두 단계를 그대로 흉내 내,
`filterHref`·`sortOptions`·`clearFiltersHref` 의 주소가 같은 파라미터와 같은 백엔드 쿼리로 돌아오는지 잰다
(값의 공백·쉼표·`&`·`=`·`+`·`#`·한글 포함).

**알고 넘어가는 한계.** 값 안의 `%XX` 는 라우터의 두 번째 디코딩으로 바뀐다(`PROBE %41` → `PROBE A`). 풀 수
없는 `%`(`100%`)는 그대로 남는다. 제목 검색어에 `%41` 같은 값을 쓰는 경우만 해당하고, Expo Router 의 동작이라
고치지 않는다 - 시험이 이 동작을 고정한다.

**재지 않은 것.** iOS, 인코딩하지 않은 두 단계 키의 딥링크, 메신저·브라우저가 링크를 다시 인코딩하는 경우.
