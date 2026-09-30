# 목록·상세 구현 계획 (D3 — 단계 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `queries/`(캐시 키·무효화 표·조회 훅)와 목록(무한 스크롤·필터 시트·정렬 메뉴·딥링크·당겨서 새로고침·빈 결과)·상세(관계 배지·UTC 시각·not-found) 화면을 만들고, 실제 FastAPI 스택과 Android 에뮬레이터에서 도는 목록·상세 E2E 로 끝낸다. 네이티브 HTTP 캐시 아래의 신선도를 기기에서 잰다.

**Architecture:** 판단은 template-typescript-nextjs 에서 복사한 `lib/resources/view.ts` 가 한다 - 원본에서 offset 쪽 이동을 빼고 커서 목록(`listQuery`·`nextPageQuery`·쪽 배열의 `listView`), 폼 상태 객체(`FilterFormValues`), 던지지 않는 닿지 못함(`unreachable`)으로 고친다. `queries/` 는 그 결정을 TanStack Query 에 잇기만 하고(`useInfiniteQuery`·`useQuery`, 요청은 D2 의 `apiRequest`), 화면(`app/`)에는 훅 호출과 JSX 만 둔다. 조건을 바꾸는 이동은 `router.push` 라 뒤로 가기가 이전 조건을 되살린다. 기기 작업은 마지막 태스크 하나에 모인다 - APK 를 한 번 빌드하고 에뮬레이터·백엔드 한 세션에서 D2 의 플로 일곱과 D3 의 여섯(목록·상세 다섯, 앱 안 인증 링크 하나)을 돈다.

**Tech Stack:** Expo SDK 57 (`expo` ~57.0.26 · `react-native` 0.86.3) · Expo Router 57.0.24 (typed routes) · `@tanstack/react-query` 5.104.0 · `@react-native-community/netinfo` 12.0.1 · Uniwind 1.12 + React Native Reusables(`badge`·`skeleton`) · vitest 5 · Maestro 2.11.0(`runScript` 의 `http`) · Docker Compose

**Spec:** `docs/superpowers/specs/2026-09-30-expo-jsonapi-template-design.md` — 8장(화면과 데이터 흐름) 전체, 9.1–9.3, 5장(계층 소유권), 6.2(view.ts 복사), 11.1·11.3(목록·상세 행), 12장, 15장 단계 3, 16장(Uniwind 결함). 날짜 붙은 정정 `> 정정(2026-09-30, D1)`·`(D2)` 이 앞의 본문을 고친다. 이어받는 항목의 정본은 `docs/superpowers/notes/2026-09-30-d1-carry-forward.md` 의 "D3" 절, D2 계획(`docs/superpowers/plans/2026-09-30-d2-session-and-auth.md`)의 "다음 계획" 절, 그리고 D2 가 끝에 커밋한 `docs/superpowers/notes/2026-10-01-d2-carry-forward.md` 의 "D3" 절이다. 마지막 것은 D2 최종 검토(2026-09-30)가 D3 에 넘긴 다섯 — M9 logcat 버퍼, M10 APK 지문의 빌드 레시피, M11 앱 안 인증 링크, T10 릴리스 대기 예외, T24 클라이언트 타이머 가드 — 에 둘(가드의 "나올 수 있는 상태" 선언, `run_flow` 의 `|| return 1`)을 더한다. 이 계획은 D2 의 끝(`feat/d2-session-auth` 의 `ac88fe0`)을 기준으로 앵커를 맞췄다.

## Global Constraints

- **런타임 버전은 Expo SDK 57 번들 버전을 따른다.** SDK에 딸린 패키지는 `BACKEND_URL=https://gate-check.invalid pnpm exec expo install <패키지>`로 받는다. SDK 밖의 패키지는 정확한 버전으로 고정한다(`pnpm add <이름>@<버전>`, `^` 없음).
- **`app.config.ts`를 평가하는 모든 명령(`expo install`·`expo config`·`expo export`·`expo prebuild`·`pnpm types:routes`·`expo-doctor`)에는 `BACKEND_URL`을 준다.** 백엔드에 닿지 않는 명령은 `https://gate-check.invalid`다(스펙 10.1 — 없으면 멈춘다).
- **`expo install`이 `app.json`을 만들면 지운다.** 플러그인은 `app.config.ts`에만 적는다(정본은 하나다). 설정 플러그인이 있는 패키지는 설치 뒤 `Cannot automatically write to dynamic config`로 exit 1이 난다 — 설치는 된 것이다.
- **Node `>=24.11.0`, `packageManager: "pnpm@11.22.0"`**, `nodeLinker: hoisted`. `pnpm add`가 `pnpm-workspace.yaml`의 `minimumReleaseAgeExclude`에 항목을 스스로 적으면 그대로 둔다(없으면 `--frozen-lockfile`이 막힌다). 릴리스로부터 24시간이 지난 항목은 다음 의존성 변경 때 빼고 `pnpm install --frozen-lockfile`로 확인한다 — D3 에서는 Task 2 Step 3 이다(결정 34).
- **TypeScript strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`.** 선택 prop·속성에 `undefined`를 명시해 넘기지 않는다 — 키를 빼거나 `cn()`처럼 문자열을 만든다.
- **`lib/**`에서 `react`·`react-native`·`expo`·`expo-*`·`@expo/*`·`@react-native*`·`@react-navigation/*`·`@tanstack/*`·`uniwind` 등을 import하면 위반이다**(스펙 5장, ESLint가 막는다). 위 계층(`platform/`·`queries/`·`components/`·`app/` — 별칭이든 상대 경로든)을 import해도 막힌다. `lib/jsonapi/`에는 자원 이름 문자열이 코드로 나타나지 않는다.
- **`package.json`에 없는 패키지를 import하면 lint가 실패한다**(`import/no-extraneous-dependencies`). hoisted 링커가 전이 의존성을 풀어 주더라도 쓰는 패키지는 선언한다.
- **어떤 모듈도 최상위에서 `getSettings()`를 부르지 않는다.** 요청으로 이어지는 훅(Query·AppState·NetInfo)은 루트 레이아웃의 `STARTUP.ok` 갈래 안의 자식(`AppRoot`)에 둔다(`platform/AGENTS.md`의 "부팅 순서").
- **`app/`에는 라우트 파일만 둔다.** 화면 조각은 `components/`, 판단은 `lib/`, 훅은 `queries/`, 네이티브 모듈 호출은 `platform/`. 화면 파일에는 훅 호출과 JSX 만 둔다(스펙 8.4) — 쿼리·주소 조립, 응답 → 화면 상태는 `lib/resources/view.ts` 가 한다.
- **로딩 상태에 텍스트를 쓰지 않는다.** 스피너(`ActivityIndicator`) 또는 스켈레톤만 쓴다(스펙 8.7).
- **오류 문구 카탈로그를 두지 않는다.** 백엔드가 협상한 `title`·`detail`을 그대로 그린다. 앱 자신의 문구는 복사한 `UNUSABLE_RESPONSE_MESSAGE`와 가입 화면의 "계정은 만들어졌습니다" 안내 둘뿐이다(스펙 9.3) — 조회 화면의 닿지 못함도 `UNUSABLE_RESPONSE_MESSAGE` 를 쓴다.
- **복사한 파일은 `docs/provenance/copied-core.json`에 적고, 원본과 달라진 곳은 전부 `divergences`에 `what`·`why`로 남긴다.** 출처 커밋은 `34d0b1057d65693645e75bec4e9558dcf6838822`, 원본은 형제 디렉터리 `../template-typescript-nextjs`다. 이탈이 있는 경로는 `sourceBlobs`에 두지 않는다. 복사본의 주석이 말하는 "page.tsx"·"RSC"·"headers()"·"app/error.tsx"·"D3 Task N" 같은 자리는 원본 저장소의 것이다 — 주석은 코드가 바뀐 곳만 고친다.
- **사라질 자리를 인용하지 않는다.** `app/`·`components/`·`lib/`·`platform/`·`queries/`·`test/` 안에서 선행 점이 붙은 `.superpowers/`, `superpowers/sdd`, `task-<번호>-report.md` 같은 세션 파일, 스크래치패드를 가리키지 않는다(게이트 [5]가 막는다). 근거는 사실 문장으로 적고, 문서가 필요하면 커밋되는 `docs/superpowers/`를 가리킨다.
- **계정 이름이 든 절대 경로를 저장소에 남기지 않는다.** 저장소는 상대 경로로 가리킨다.
- **ESLint 타입 규칙이 잡는 것:** `async` 함수에는 `await`가 있어야 한다(`require-await`). 콜백으로 넘기는 멤버는 메서드가 아니라 함수 속성으로 선언한다(`unbound-method`). 쓰지 않는 `catch` 변수는 `catch {`로 쓴다(`no-unused-vars`의 `caughtErrors: all`). 떠 있는 Promise 는 `void` 로 받는다(`no-floating-promises`).
- **한 파일만 도는 시험은 `pnpm exec vitest run <파일>`**이다 — pnpm 11은 `pnpm test -- <파일>`에 `--`를 그대로 넘겨 전체가 돈다.
- **게이트는 Git Bash에서 `./scripts/check.sh`로 돈다.** `pnpm check`는 Windows에서 cmd.exe가 `./`를 못 찾는다.
- **`expo export`는 언제나 `--clear`로 돌린다.** 이 개발 머신(Windows)에서 캐시를 둔 `expo export`는 결과를 다 쓴 뒤 종료할 때 간헐적으로 0xC0000005(Git Bash에서 139)로 죽었고 `--clear`를 주면 죽지 않았다(D1 실측 기록 M1 관찰 8). `--clear`는 `os.tmpdir()/metro-cache`를 지우므로 이 저장소의 `expo start`를 끄고 돌린다. 그래도 139로 죽으면 다시 돌려 덮지 않는다 — 원인을 찾는다(스펙 16장: 재시도 0).
- **Gradle의 번들 단계(E2E APK 빌드의 `createBundleReleaseJsAndAssets`)도 Metro 캐시를 쓴다.** 그 단계가 0xC0000005·139로 죽으면 30분을 정해 원인을 가른다 — 죽은 것이 `node`(`export:embed`)인지 `hermesc`인지 보고, `node`면 Metro 캐시(`$TMP/metro-cache`)를 지우고 `E2E_FORCE_BUILD=1`로 한 번 빌드해 재현되는지 본다. 30분 안에 못 찾으면 멈추고 기록과 함께 컨트롤러에 넘긴다 — 재시도로 덮지 않는다.
- **개발 머신의 `joon-*` 컨테이너 9개를 절대 멈추지 않는다.** compose 명령은 모두 `-p template-typescript-expo-e2e`를 주고 그 프로젝트만 내린다. Docker를 건드리는 단계는 앞뒤로 `docker ps --filter name=joon- -q | wc -l`이 `9`인지 확인한다. 같은 머신의 다른 `fastapi-*` 컨테이너도 건드리지 않는다.
- **Windows의 Android 네이티브 빌드는 저장소 루트가 실제 디렉터리 경로 47자 이하일 때만 된다**(D1 실측 M1 — 이 저장소 위치는 74자). `subst`는 쓸 수 없다. E2E 하네스(D2)가 짧은 경로(`E2E_STAGE_DIR`, 기본 `C:/t/e`)의 사본에서 빌드한다.
- **Maestro 플로 규칙(D1 실측 M8·M3, 이 계획의 사실 절):** 요소는 testID(`id:`)로 찾는다 — 목록의 행은 testID 와 데이터 문구(제목)를 함께 준다(`id: resource-row-title` + `text:`). `launchApp` 뒤에는 화면 요소를 기다린 다음 `openLink`를 보낸다. 딥링크의 대괄호는 퍼센트 인코딩한다(`filter%5Btitle%5D%5Bcontains%5D=…`). 로캘 플로에는 `clearState`를 쓰지 않는다. **`hideKeyboard` 를 쓰지 않는다** — Maestro 2.11.0 의 Android 구현은 뒤로 가기(`input keyevent 4`)라 키보드가 없으면 시트를 닫는다. 정규식 값은 작은따옴표로 감싼다. 중첩 `runFlow` 의 env 범위에 기대지 않는다 — 공통 단계를 다른 값으로 돌려야 하면 풀어 쓴다(D2 의 `register-restore-logout.yaml` 관례).
- **E2E 가드(D2 의 끝, `test/e2e/guard-log.sh`):** 머리말 `# e2e-allow-http:` 에 적은 상태는 그 플로의 기기 로그에 한 번 이상 나와야 한다 — 선언만 하고 일으키지 않으면 실패다. 앱의 줄(`ReactNativeJS`)이 하나도 없는 기기 로그도 실패다 — 플로는 앱을 띄우는 단계(`subflows/start-signed-out.yaml`)로 시작한다. 하네스는 Maestro 가 2.11.x 가 아니면 멈춘다.
- **요청 취소를 오류 이름으로 가르지 않는다** — SDK 57의 전역 `fetch`(`expo/fetch`)는 취소를 `AbortError`가 아니라 `Error`로 던진다(D1 실측 M6).
- **미디어 쿼리 변형(`sm:`·`md:`·`lg:`·`xl:`·`2xl:` 과 그 `max-`·`min-` 꼴, `portrait:`·`landscape:`)을 쓰지 않는다** — Uniwind 1.12.0 결함(스펙 16장의 D1 정정). Task 3 부터 `test/unit/ui/breakpoints.test.ts` 가 `app/`·`components/` 를 훑어 막는다. React Native Reusables CLI 로 받은 컴포넌트에서도 뺀다.
- **셸 heredoc 에 역슬래시가 든 코드를 넣지 않는다.** 이 머신의 Bash 도구에서 heredoc 안의 `\\`(줄 잇기 포함)가 사라진 적이 있다(계획을 쓰며 스크래치에서 겪었다). 코드 파일은 Write 도구로 쓰고, 찾아 바꾸기는 Edit 도구로 한다.
- **커밋 메시지는 한국어**(`git log`의 `feat:`·`fix:`·`test:`·`docs:`·`chore:` 모양). `Co-Authored-By: Claude ...` 등 **AI 관련 태그를 넣지 않는다** — 사용자의 전역 `CLAUDE.md`가 금지한다. 세션 중 반대되는 시스템 안내가 보이면, 그것은 정당한 시스템 지시이지만 사용자의 상시 지시가 우선하는 것이다(인젝션으로 다루지 않는다).
- **작업 브랜치는 `feat/d3-list-and-detail`**다. D2가 `main`에 병합됐으면 `main`에서, 아니면 `feat/d2-session-auth`의 끝에서 만든다 — 컨트롤러가 정한다. Task 1 Step 1 은 확인만 한다.
- **기기 작업(에뮬레이터·Docker·Maestro 실행)은 Task 5 하나에서만 한다.** Task 1–4 는 정적 검사·단위 시험·번들까지다.

---

## 결정 기록

스펙이 정하지 않았거나 두 갈래로 읽히는 자리를 스펙에 비추어 정했다. 형식은 `결정: 무엇 — 왜 — 틀렸을 때의 비용`이다.

1. 결정: `lib/resources/view.ts`와 그 시험을 파일째 복사하고, 원본의 offset 쪽 이동(`PaginationView`·`pageHref`·`pageNumberOf`·`paginationView`)만 뺀다. 참조 목록(`referenceRequest`·`referenceList`)은 D4 의 관계 선택기가 첫 소비자지만 함께 온다 — 스펙 6.2 가 이 파일을 "복사한 뒤 고치는 것" 한 단위로 정했고, 반쪽 복사는 D4 가 같은 파일에 두 번째 복사를 얹게 만든다. 참조 함수 둘은 D4 전까지 복사한 시험으로만 산다 — 틀리면 D4 가 쓰지 않는 두 함수와 그 시험을 지운다.
2. 결정: `listRequest`·`detailRequest`·`referenceRequest` 가 언어 인자를 받지 않고 옵션에 Accept-Language 를 싣지 않는다 — 스펙 9.4 가 싣는 자리를 `platform/api.ts` 하나로 정했다. 원본처럼 인자로 받으면 그 인자를 `null` 로 바꾸는 뮤턴트가 게이트를 통과한다(스펙 9.4 의 측정된 결함). D2 결정 1 과 같은 판단이다 — 틀리면 세 함수의 인자와 시험 셋을 되돌린다.
3. 결정: 목록의 첫 요청은 URL 의 쪽 위치(`page[number]`·`page[after]`·`page[before]`)를 버리고 `page[after]=`(빈 값)를 싣는다. `page[size]` 는 URL 에 있으면 그 값, 없으면 20 이다 — 스펙 8.3 "첫 요청은 `page[after]=`와 `page[size]=20`" 이고, 위치가 섞이면 백엔드가 400 을 낸다. 쪽 크기는 위치가 아니라 "어떻게 보여 줄 것인가" 라서 원본 `filterQuery`·`sortQuery` 처럼 남긴다 — 틀리면(쪽 크기도 고정해야 하면) `listQuery` 한 줄과 시험 하나.
4. 결정: 다음 쪽은 응답 `links.next` 의 쿼리를 **그대로** 따라간다(`nextPageQuery` = `linkQuery(next)`) — 스펙 8.3 의 문장 그대로이고, 정본의 링크는 원래 쿼리(filter·sort·include)를 보존하고 page 조각만 바꾼다(원본 계획 R-7, 이 계획의 사실 절의 `build_pagination_links`). 커서를 만들거나 해석하는 코드가 없다 — 틀리면(어느 백엔드의 링크가 include 를 빠뜨리면 2쪽부터 배지가 id 로 그려진다 — D7 매트릭스가 볼 자리다) `nextPageQuery` 한 함수가 우리 쿼리에 링크의 page 조각만 얹도록 바꾼다.
5. 결정: 빈 쪽은 `links.next` 가 있어도 끝이다 — NestJS 는 커서 모드의 끝에서도 `next` 에 커서를 채워 보낸다(원본 계획 R-10①). 커서 목록에서 빈 쪽 뒤에 읽을 행은 없다 — 틀리면 한 줄과 시험 하나.
6. 결정: 조회 화면에서 백엔드가 응답조차 주지 못하면(transport) 던지지 않고 `{ kind: 'unreachable' }` 을 돌려주고, 화면이 `UNUSABLE_RESPONSE_MESSAGE` 와 "다시 시도" 를 그린다 — 스펙 9.3("그때는 다시 시도 버튼을 함께"), D2 결정 23 이 그 버튼을 조회 화면에 두라고 넘겼다. 원본처럼 던지면 Expo Router 의 ErrorBoundary 로 가는데 그 화면은 요청을 다시 보내지 않는다. 문구 없는 오류 문서·본문 없는 성공 응답 같은 계약 위반은 여전히 던진다 — 틀리면 `failureOf` 한 줄과 시험 셋.
7. 결정: 쪽은 `apiRequest` 의 결과 값(`JsonApiResult`) 그대로 쌓고, `listView` 가 쪽 배열에서 화면 상태를 정한다. 뒤따르는 쪽의 실패는 읽은 행을 두고 목록 끝에 그리고, "다시 시도" 는 목록 전체를 다시 부른다(`refetch` — TanStack Query v5 는 모든 쪽을 새 커서로 다시 읽는다) — `apiRequest` 는 던지지 않고(D2) 판단을 lib 에 두려면 결과가 값이어야 한다 — 틀리면(실패한 쪽만 다시 부르고 싶으면) 쿼리 함수가 실패를 던지게 바꾸고 `fetchNextPage` 로 다시 시도한다.
8. 결정: 쪽을 이을 때 같은 id 는 처음 나온 행만 남긴다 — 쪽을 읽는 사이 정렬 값이 바뀐 행이 두 쪽에 걸리면 FlatList 의 키가 겹치고, React 의 중복 키 오류는 `E/ReactNativeJS` 로 E2E 가드에 걸린다 — 틀리면 세 줄.
9. 결정: 조건을 바꾸는 이동(필터 적용·필터 지우기·정렬)은 `router.push(주소)` 다 — 스펙 8.2 "뒤로 가기가 이전 조건을 되살린다". 스택 라우터의 PUSH 는 이름이 같아도 새 화면을 쌓는다. `router.setParams` 는 지금 화면의 파라미터를 바꿀 뿐 기록을 남기지 않고, `router.dismissTo` 는 이름만 맞춰 옛 목록으로 돌아가 파라미터를 덮는다(사실 절) — 틀리면(목록 화면이 쌓이는 것이 싫으면) `router.setParams` 로 바꾸고 스펙 8.2 를 고친다.
10. 결정: 목록 주소의 인코딩 규칙은 `URLSearchParams` 의 퍼센트 인코딩 그대로다(`filter%5Bstatus%5D=…`, 원본 `hrefWithQuery`). 새 인코딩 코드를 두지 않고, 문서와 E2E 의 딥링크도 이 모양으로 쓴다. 규칙은 `filterHref` 주석과 D3 실측 기록 L1 에, 왕복은 단위 시험에 둔다 — D1 실측 M2 가 이 모양의 두 단계 키(`filter[title][contains]`)를 쟀고, 인코딩하지 않은 링크는 한 단계 키만 쟀다. `useLocalSearchParams` 의 두 번째 디코딩(값 안의 `%XX`)은 알고 넘어간다 — 틀리면 `hrefWithQuery` 한 줄과 왕복 시험.
11. 결정: 캐시 키(`['resources', type, 'list'|'detail', …]`)와 무효화 표(생성·수정·삭제·로그아웃 네 행)를 `queries/keys.ts` 의 순수 함수로 두고, 로그아웃이 그 표를 지나게 바꾼다. 생성·수정·삭제 행의 호출부는 D4 가 만든다 — 스펙 8.5 "캐시 키와 무효화 표는 `queries/`의 순수 함수로 두고 단위 테스트로 고정한다", D2 의 "다음 계획" 이 표와 로그아웃 이전을 D3 에 넘겼다. 표는 실제 `QueryClient` 로 잰다 — 틀리면 D4 가 표의 행을 고친다(시험이 같이 바뀐다).
12. 결정: TanStack Query 의 `networkMode` 는 조회·쓰기 모두 `offlineFirst` 다 — 기본값 `online` 은 NetInfo 가 끊겼다고 하면 요청을 멈춰 둬서 첫 조회의 스켈레톤·쓰기의 스피너가 연결이 돌아올 때까지 돈다(스펙 9.3 의 앱 문구와 다시 시도가 오지 않는다). `always` 는 `refetchOnReconnect` 의 기본값이 꺼진다(TanStack Query v5 문서). `offlineFirst` 는 한 번은 보내고, 멈추는 것은 재시도뿐인데 재시도는 꺼져 있다. D2 의 인증 쓰기(로그인·가입·로그아웃)는 훅에 `networkMode: 'always'` 를 직접 적었다 — 훅의 값이 기본값보다 앞서므로 그대로 두고, 재시도가 꺼진 쓰기에서 `always` 와 `offlineFirst` 는 같게 돈다. D2 가 그 자리에 "앞으로 NetInfo 에 물리면" 이라고 적은 주석·문서는 D3 가 물리므로 지금 일로 고친다(Task 2 Step 4·6) — 틀리면 옵션 두 줄.
13. 결정: NetInfo 의 `isConnected` 가 `null`(아직 모름)이면 연결된 것으로 본다 — 끊김→연결을 지어내면 앱이 켜지자마자 조회를 한 번 더 부른다 — 틀리면 식 하나.
14. 결정: 조회에 TanStack Query 의 `signal` 을 넘기지 않는다. 그래서 D2 결정 31 의 `client.ts` 타이머 가드도 더하지 않는다(T24 — 결정 35) — 끊은 요청은 `apiRequest` 가 상태 0 실패로 기록해 e2e 가드(선언하지 않은 HTTP 실패)에 걸리고, 조회는 작아서 화면을 떠난 뒤 끝까지 받아도 잃는 것이 없다(최대 15초) — 틀리면 `signal` 을 넘기고, `apiRequest` 의 기록 조건에 호출자 취소를 빼고, 타이머 가드 한 줄을 더한다.
15. 결정: 무한 스크롤은 `hasNextPage && !isFetching` 일 때만 다음 쪽을 부른다 — TanStack Query v5 의 무한 조회 안내("재조회 중 fetchNextPage 는 진행 중인 재조회를 끊는다"). 재조회 중에 끝에 닿은 호출 하나는 버려지고 FlatList 는 내용 길이가 바뀔 때까지 다시 알리지 않는다 — 틀리면 사용자가 조금 더 굴려야 다음 쪽이 온다.
16. 결정: 인증 오류 처리(`QueryCache`·`MutationCache` 의 `onError`, 스펙 9.2)는 D3 도 배선하지 않는다 — D3 의 요청은 전부 공개 읽기라 인증 오류가 오지 않는다(원본 계획 R-9). D2 결정 4 대로 첫 인증 요청을 만드는 D4 의 몫이다 — 틀리면 D4 가 캐시 콜백 한 곳을 더한다.
17. 결정: Uniwind 1.12.0 의 `@media` 블록 결함은 **미디어 쿼리 변형을 쓰지 않는 것**으로 대응한다(패치·다른 버전이 아니다). 받은 컴포넌트(`button`·`input`·`text`)의 변형을 빼고 `test/unit/ui/breakpoints.test.ts` 가 `app/`·`components/` 를 훑어 막는다 — 패치는 Metro 변환기 안쪽(`dist/metro/transformer.cjs` 의 `parseRuleRec`)을 고치고 그 결과를 번들로 확인하는 시험까지 템플릿 사용자에게 넘긴다. 고쳐진 릴리스는 없다(npm `latest` 1.12.0). 앱은 모바일이고 변형들은 shadcn 의 데스크톱 밀도 조정이다 — 틀리면(태블릿 배치가 필요하면) 고쳐진 Uniwind 릴리스에서 시험을 지우고 컴포넌트를 CLI 로 다시 받는다.
18. 결정: 스켈레톤과 배지는 React Native Reusables CLI(0.7.1, `--styling-library uniwind`)로 받는다. 받은 `skeleton.tsx` 는 두 곳을 고친다 — `React.RefAttributes<View>` 를 떼고(`exactOptionalPropertyTypes` 아래 reanimated `Animated.View` 의 ref 타입과 맞지 않아 typecheck 실패) 효과의 의존성에 `sv` 를 적는다(`react-hooks/exhaustive-deps` 경고). reanimated 의 `Animated.View` 에 `className` 이 닿는 것은 Uniwind 의 Metro 해석기가 `react-native` 를 모든 비-RN 모듈에서 Uniwind 컴포넌트로 바꿔 주기 때문이다(사실 절) — 틀리면 스켈레톤을 정적 `View` 로 바꾼다.
19. 결정: 내비게이션 테마의 색을 `global.css` 토큰의 sRGB 값으로 맞추고, 표를 import 없는 `platform/nav-colors.ts` 로 떼어 `test/unit/ui/nav-colors.test.ts` 가 토큰과 맞댄다(OKLab 변환 - D1 이 기기에서 읽은 색 넷으로 변환을 고정). 다크의 헤더(`card`)가 `#0a0a0a` 에서 `#171717` 이 된다 — D1 운반 "dark card·primary·border, notification 을 맞춘다". 틀리면(헤더를 배경과 같게 두고 싶으면) `NAV_COLOR_TOKENS.card` 를 `background` 로 바꾼다.
20. 결정: `components.json` 의 `hooks` 별칭을 `@/queries` 에서 `@/components/hooks` 로 바꾼다 — React Native Reusables 의 훅은 UI 도우미라 `queries/`(데이터)의 소유가 아니다. `platform/` 은 Expo 모듈 호출 자리다 — 틀리면 별칭 한 줄.
21. 결정: 소음 셋의 판정 — (a) prebuild 의 `userInterfaceStyle: Install expo-system-ui` 경고: `expo-system-ui` 를 설치하지 않는다(D1 이 다크 모드가 JS 쪽에서 도는 것을 쟀고, Android 에서 `automatic` 은 설치해도 시스템을 따르는 것 그대로다. iOS 는 `UIUserInterfaceStyle` 에 그 값이 들어가 필요하다). (b) React Native Reusables `doctor` 의 두 건(테마 파일 `lib/theme.ts` 가 없다 — 이 저장소는 `platform/theme.ts`, `tailwindcss-animate` 가 없다 — Tailwind v3 플러그인이고 이 저장소는 v4 용 `tw-animate-css`): 둘 다 고치지 않는다. (c) `expo export` 의 0 B 웹 CSS(`global-d41d8cd98f00b204e9800998ecf8427e.css`, 빈 문자열의 MD5): 앱에 실리지 않는 산출물이라 둔다. 판정은 D3 실측 기록 L4 에 남긴다 — 틀리면 해당 한 항목.
22. 결정: 필터 시트와 정렬 메뉴는 React Native `Modal` 위의 아래 시트(`components/app/sheet.tsx`)다. 필터 시트의 "적용"·"필터 지우기" 는 시트 머리 줄에 둔다 — React Native Reusables 에는 시트가 없고, 아래쪽 버튼은 입력의 키보드에 가려 E2E 가 `hideKeyboard`(= Android 뒤로 가기)를 써야 하는데 키보드가 없으면 시트가 닫힌다. `Modal` 은 Android 에서 별도 Dialog 창인데 Maestro 는 다른 창(권한 대화상자 등)의 요소도 찾는다 — 틀리면(시트 안 요소를 Maestro 가 못 찾으면) Task 5 Step 5 의 Portal 판으로 바꾼다.
23. 결정: 목록의 행은 표가 아니라 카드다 — 첫 칸(대표 속성, `displayAttribute`)이 제목, 나머지 칸은 "이름 값", 관계 칸은 배지 — 폰 폭에 열 여섯이 들어가지 않는다. 분기는 칸의 `kind` 뿐이다(자원 이름이 아니다) — 틀리면 `resource-row.tsx` 한 파일.
24. 결정: 빈 결과("조건에 맞는 항목이 없습니다."·"아직 등록된 항목이 없습니다.")와 not-found("페이지를 찾을 수 없습니다" 등)의 문구는 template-typescript-nextjs 의 것을 그대로 쓴다 — 스펙 8.1 이 화면의 내용으로 적은 상태의 문구이고, 9.3 의 "앱 자신의 문구" 는 백엔드가 응답하지 못한 때의 오류 문구다. D2 의 제목·라벨 문구와 같은 층위다 — 틀리면 문구 다섯 줄.
25. 결정: 없는 id 의 상세는 같은 주소에서 `NotFoundView` 를 그리고, `app/+not-found.tsx`(없는 경로)도 같은 조각을 쓴다. `+not-found.tsx` 를 D3 가 만든다 — Next.js 의 `notFound()` 가 같은 주소에서 not-found 화면을 그리는 것과 같고, 스펙 4장의 트리에 있는 파일 중 not-found 상태를 처음 만드는 단계가 D3 다 — 틀리면 상세가 `router.replace` 로 옮겨 가게 한 줄.
26. 결정: 홈에 목록으로 가는 버튼 하나를 더한다(testID `home-examples-link`). 실험실 진입(D5)·빌드 정보 카드(D6)는 만들지 않는다 — 스펙 4장 "홈 — 목록·실험실 진입" 의 목록 쪽만 D3 의 범위다 — 틀리면 버튼 한 개.
27. 결정: E2E 가 씨앗 밖에서 필요한 행(무한 스크롤의 25건, 새로고침·앱 복귀·상세 재진입이 볼 새 행과 바뀐 제목)은 플로가 Maestro `runScript`(호스트의 GraalJS `http`)로 백엔드에 직접 만든다 — `test/e2e/scripts/examples-api.js`, 하네스가 `API_URL` 을 넘긴다. 씨앗은 여섯 건이라 첫 쪽(20건)을 넘지 못하고, 앱에는 쓰기 화면이 없다(D4). 씨앗 SQL 을 늘리면 원본 그대로인 복사본(`sourceBlobs`)을 고치고 D5 매트릭스가 공유할 씨앗이 흔들린다. 제목은 `probe-d3-<이메일 끝 12자>` 로 시작해 실행·플로마다 다르다 — 틀리면 같은 요청을 하네스(node)로 옮긴다.
28. 결정: 목록·상세의 신선도(D1 운반 "네이티브 HTTP 캐시와 함께 확인한다")는 D2 의 H1 판정과 무관하게 E2E 가 기기에서 잰다 — 당겨서 새로고침·앱 복귀·상세 재진입이 목록을 연 뒤 백엔드에서 바뀐 것을 받아야 한다. `client.ts` 에 `Cache-Control: no-cache` 를 무조건 싣지 않는다(D2 결정 33 의 "틀리면" 갈래를 지금 택하지 않는다) — 수명을 주지 않는 응답은 OkHttp 가 검증 없이 다시 쓰지 않는다. 틀리면(E2E 가 옛 응답을 보면) Task 5 Step 5 의 대응대로 D2 계획 Task 6 Step 5 의 "수명이 있으면" 묶음을 적용한다.
29. 결정: UTC 시각은 단위 시험(`vitest.config.mjs` 의 `TZ: 'Asia/Seoul'`)이 지키고, E2E 는 기기 화면에 UTC 문자열(`2026-04-06 05:06`)이 그려지는지 본다 — 에뮬레이터의 시간대를 하네스가 바꾸는 길은 `user` 빌드에서 root 가 막혀 있다(D1 실측 M3 의 `setprop` 시도) — 틀리면(기기가 UTC 라서 로컬 시각 결함을 E2E 가 못 보는 것) 단위 시험이 막는다.
30. 결정: 브랜치는 `feat/d3-list-and-detail` 하나, 태스크 다섯. 기기 작업은 Task 5 하나다 — APK 는 Task 5 에서 한 번 빌드되고(화면을 고치면 다시), 에뮬레이터와 FastAPI 스택은 하네스 한 번에 한 번 떠서 D2 의 플로 일곱과 D3 의 플로 여섯이 차례로 돈다. 마지막 게이트 실행은 지문이 같아 빌드하지 않는다 — 사용자 요구(속도), 스펙 16장의 "앱을 한 번 빌드해 공유" — 틀리면 태스크 경계만 바뀐다.
31. 결정: 기기 로그의 링 버퍼를 `android.sh boot` 가 `"$ADB" logcat -G 16M` 으로 넓힌다(D2 최종 검토 M9). 새로 부팅한 기기와 이미 켜진 기기 모두 — 재부팅하면 기본 크기로 돌아가서 부팅을 기다린 뒤 공통 끝부분에 둔다. 하네스는 플로마다 로그를 비우고(`logcat -c`) 끝에 모으는데, 기본 버퍼가 긴 플로(`examples-scroll-refresh` 의 스크롤 25행·새로고침·앱 복귀) 하나를 다 담지 못하면 앞쪽의 W·E 줄이 밀려나 가드가 가짜로 통과하고, 선언한 `[e2e-http]` 줄이 밀려나 가짜로 실패한다. 크기는 검토가 적은 값이다 — 틀리면(그 기기의 logd 가 값을 거절하면 `set -e` 로 boot 가 멈춘다) 값을 `8M` 으로 낮추거나 `-b main` 으로 좁힌다.
32. 결정: APK 지문에 빌드 레시피 `test/e2e/android.sh` 를 따로 더한다(`sha1sum test/e2e/android.sh`, D2 최종 검토 M10). 지문의 파일 목록은 `git ls-files … ':!test'` 인데 git 의 제외 pathspec 은 같은 명령의 포함 pathspec 보다 앞서서(사실 절) 목록에 이름을 더하는 것으로는 들어오지 않는다. 이 저장소에서 `prebuild` 인자와 `APP_VARIANT` 가 거기 있다 — 틀리면(레시피가 아닌 부분, 예컨대 `wait-text` 를 고쳐도 다시 빌드된다) 5~6분 빌드 한 번이 는다.
33. 결정: 앱 안의 로그인·가입 링크(D2 최종 검토 M11)는 새 플로 `test/e2e/flows/auth-links.yaml` 이 누른다 — 보호 경로 → 로그인 → `register-link` → `login-link` → `register-link` → 가입 → `next` 의 화면. 링크를 두 번 건너도 `next` 가 이어져야(`authLinkHref`) 가입 뒤 홈이 아니라 막혔던 화면에 닿는다. 복귀한 화면에서 뒤로 가면 홈이 나와야 한다 — D2 가 끝에 로그인·가입 뒤 복귀에 `withAnchor` 를 주고 로그인 쪽만 `guard-return.yaml` 로 쟀으므로, 이 플로가 가입 쪽을 잰다. `guard-return.yaml` 에 잇지 않는다 — D2 가 끝에 그 파일을 고쳤고, 플로 하나가 시나리오 하나다(`test/e2e/AGENTS.md`). 가입은 이 플로의 `EMAIL` 로 한다 — 새 플로라 앞 사용자가 없다(운반 기록의 `OTHER_EMAIL` 은 `guard-return` 에 이을 때의 말이다). 계정 생성 안내의 링크는 가입이 되고 자동 로그인만 실패해야 보여 기기에서 일으키지 않는다 — 같은 `Link asChild` + `Text` 모양을 `login-link` 가 잰다. 목록·상세와 무관한 플로라 D3 의 범위를 넓히지만, 기기 세션을 새로 열지 않는 한 걸음이라 여기서 한다 — 틀리면 플로 파일 하나를 지운다.
34. 결정: `pnpm-workspace.yaml` 의 `minimumReleaseAgeExclude` 에 남은 `lucide-react-native@1.49.0`(D2 최종 검토 T10)은 D3 의 첫 의존성 변경(Task 2 Step 3, NetInfo)에서 뺀다 — 단 릴리스(`2026-09-29T22:27:09Z`, npm 의 `time`)로부터 24시간이 지났을 때만. 그 전에 빼면 pnpm 11 이 `--frozen-lockfile` 설치를 막는다(스크래치에서 재 봤다 — 사실 절). 아직이면 NetInfo 만 설치하고 빼기는 Task 5 Step 1(기기 빌드 앞 — 지문에 들어가는 파일이라 빌드 뒤에 바꾸면 게이트가 다시 빌드한다)로 미룬다. 목록이 비면 키와 주석의 "아래는" 을 함께 지우고 규칙만 남긴다 — 빈 목록 키는 다음에 pnpm 이 적을 자리를 헷갈리게 한다 — 틀리면 예외 한 줄을 되살린다.
35. 결정: 클라이언트 타이머 가드(`client.ts` 의 타이머 콜백에서 `if (controller.signal.aborted) return`, D2 최종 검토 T24)는 D3 에서도 더하지 않는다 — 조건("조회에 signal 을 붙일 때")이 D3 에서 생기지 않는다(결정 14). 대신 그 조건과 할 일을 `queries/AGENTS.md` 에 규칙으로 적어(Task 2 Step 6) 계획에서 계획으로 넘기지 않고 저장소가 들고 있게 한다 — signal 을 처음 넘기는 사람이 타이머 가드 한 줄·시험 하나·이탈 기록 한 줄과 `apiRequest` 의 기록 조건(호출자 취소는 `[e2e-http] 0` 으로 남기지 않는다)을 함께 고친다 — 틀리면(지금 더해야 하면) 그 셋을 Task 2 에 더한다.
36. 결정: D2 의 끝에 맞춰 앵커를 다시 잡았다 — `queries/AGENTS.md`·`platform/AGENTS.md` 의 표는 Prettier 가 칸을 맞춘 모양이고(Task 3 의 `theme.ts` 행은 Task 2 의 `pnpm format` 이 칸을 넓힌 뒤의 모양), `run-android.sh` 의 기기 로그 줄은 `|| logcat_rc=$?` 로 끝나며, `test/e2e/AGENTS.md` 의 `boot` 문단은 `ac88fe0` 에서 "그 기기가 실기기면" 으로 바뀌었다. 계획의 모든 "찾을 것"·끼울 자리·"고친 뒤의 파일" 을 스크래치에 푼 `ac88fe0` 에 태스크 순서대로 적용해 한 번씩만 맞는 것을 확인했다(미리 돌려 본 것) — 틀리면(그 뒤 D2 가 글자를 더 바꾸면) 같은 뜻의 자리를 찾아 고친다.
37. 결정: 가드에 "나올 수도 있는 상태" 선언(예: `# e2e-allow-http-optional:`, D2 운반 기록)을 더하지 않는다 — D3 의 플로가 일으키는 2xx 밖의 상태는 둘 다 정해져 있다: `examples-empty-notfound` 의 404(형식이 맞는 없는 UUID 도, 형식이 틀린 id 도 FastAPI 가 `RESOURCE_NOT_FOUND` 404 로 준다 — 정본의 `coerce_model_id`)와 `examples-invalid-filter-en` 의 400. 타이밍에 따라 나오는 상태의 대표인 재조회 도중의 취소는 D3 가 `signal` 을 넘기지 않아(결정 14) 생기지 않는다 — 틀리면(기기에서 선언하지 않은 상태가 가끔 나오면) 그 상태가 왜 나오는지부터 고치고, 고칠 수 없는 것만 그 선언을 `guard-log.sh`·시험·`test/e2e/AGENTS.md` 에 더한다.
38. 결정: `run_flow` 의 로캘 앞 단계 둘(`pm clear`·`set-app-locales`)이 실패하면 그 플로를 실패로 친다(D2 운반 기록 — "`run-android.sh` 를 만질 때 두 줄에 `|| return 1`"). D3 가 이 파일을 어차피 고치고, D3 의 `examples-invalid-filter-en` 도 로캘 플로다 — `set -e` 가 꺼진 `||` 문맥이라 지금은 실패가 넘어가고 en·ko 단언이 늦게 드러낸다 — 틀리면(성공인데 0 이 아닌 값을 주는 기기면) 그 `if` 를 원래 두 줄로 되돌린다.

---

## 이 계획이 근거로 삼은 사실 (2026-09-30 확인)

추측이 아니라 그날 설치본·소스에서 직접 읽은 것이다.

**Expo Router 57.0.24**(`node_modules/expo-router/build`):
- `link/href.js` 의 `resolveHref` — 문자열 href 는 그대로, 객체 href 의 `params` 는 `${key}=${encodeURIComponent(value)}`(키는 인코딩하지 않는다).
- `fork/getStateFromPath-forks.js` 의 `parseQueryParams` — `new URL(주소, 'file:').searchParams` 에서 이름마다 `getAll`, 값이 하나면 문자열. `hooks/useLocalSearchParams.js` — 값마다 `decodeURIComponent` 를 한 번 더(실패하면 그대로). 딥링크도 `router.push(주소)` 도 `getStateFromPath` 를 지난다(`global-state/getNavigationAction.js`).
- `global-state/router.js` 의 `setParams` 는 `navigationRef.current.setParams(params)` 다(기록을 남기지 않는다). `push` 는 `PUSH`, `dismissTo` 는 `POP_TO` 다.
- `react-navigation/routers/StackRouter.js` — `PUSH` 는 이름이 같아도 새 라우트를 쌓는다. `NAVIGATE` 는 지금 라우트와 이름이 같으면 그 라우트를 쓴다. `POP_TO` 는 이름으로 찾고(없으면 지금 화면을 바꾼다) 파라미터를 덮는다.
- 타입드 라우트(`pnpm types:routes` → `.expo/types/router.d.ts`)의 `Href` 는 `/examples${'?'…}` 같은 템플릿 리터럴이다 — 런타임에 만든 문자열은 단언이 필요하고, 리터럴 `'/examples'` 는 `satisfies Href` 로 잰다.

**react-native-screens 4.26.2**(`android/.../ScreenStack.kt`): 맨 위 화면이 반투명이 아니면 그 아래 화면의 fragment 를 `transaction.remove` 로 뗀다 — 쌓인 옛 목록 화면의 뷰는 UI 계층에 남지 않는다(Maestro 의 `assertNotVisible` 이 아래 화면에 속지 않는다).

**React Native 0.86.3**: `@react-native/virtualized-lists/Lists/VirtualizedList.js` 의 `_maybeCallOnEdgeReached` 는 끝에서 `onEndReachedThreshold × 보이는 길이` 안에 들면 **내용 길이마다 한 번** `onEndReached` 를 부른다 — 내용이 화면보다 짧아도 부른다. Android `Modal` 은 별도 Dialog 창이고 `SOFT_INPUT_ADJUST_RESIZE` 를 건다(`ReactModalHostView.kt`).

**TanStack Query v5**(context7, v5.90 문서): 무한 조회는 `hasNextPage && !isFetching && fetchNextPage()` 로 부르라고 안내한다. `refetch` 는 모든 쪽을 첫 쪽부터 `getNextPageParam` 으로 다시 읽는다. `networkMode` — `online`(기본)은 오프라인이면 멈추고, `always` 는 `refetchOnReconnect` 기본값이 `false`, `offlineFirst` 는 한 번 보내고 재시도만 멈춘다. React Native 는 `focusManager.setFocused(AppState === 'active')`, `onlineManager.setEventListener(NetInfo.addEventListener(…))` 로 잇는다.

**Uniwind 1.12.0**: `dist/metro/index.cjs` 의 해석기는 `react-native` 코어 밖의 모든 모듈에서 `react-native` import 를 Uniwind 컴포넌트로 바꾼다 — reanimated 의 `Animated.View` 도 Uniwind 의 `View` 를 감싸 `className` 이 닿는다. `FlatList`·`Modal`·`RefreshControl`·`ActivityIndicator` 의 Uniwind 판이 있다(`src/components/native/`). 결함 자리는 `dist/metro/transformer.cjs` 의 `parseRuleRec` 의 `media` 갈래 — 안쪽 규칙마다 `this.declarationConfig = this.getDeclarationConfig()` 로 `mediaQueries` 를 비운다.

**Maestro 2.11.0**(`~/.maestro/lib`): `maestro-client.jar` 의 `maestro/js/GraalJsHttp` 가 `get`·`post`·`put`·`delete`·`request(url, {method, headers, body})` 를 주고, `GraalJsEngine` 의 `output` 은 한 플로의 `runScript` 사이에 이어진다. `maestro/drivers/AndroidDriver$hideKeyboard$1` 은 `input keyevent 4`(뒤로 가기)다. `launchApp: { stopApp: false }` 는 떠 있는 앱을 앞으로 불러온다(문서).

**정본 FastAPI**(`../template-python-fastapi` `3c4eee3`): `app/jsonapi/query.py` 의 `build_pagination_links` — 커서 모드의 `next` 는 page 가 아닌 원래 파라미터를 보존하고 `page[after]=<커서>`·`page[size]` 를 붙이며, 더 없으면(`has_more` 거짓) `null` 이다. 쪽 크기 기본 20, 최대 100. `app/schemas/example.py` 의 생성은 `title`(1–200)·`status`·`score`(0–100)가 필수다.

**씨앗**(`test/e2e/seed/examples.sql`, 원본 그대로): `probe-seed alpha`…`foxtrot` 여섯 건. 순서 — `-createdAt`(기본) alpha charlie echo foxtrot bravo delta, `title` alpha…foxtrot, `-score` foxtrot bravo delta echo alpha charlie. bravo 는 분류 "프로브 분류 하나"·라벨 "프로브 라벨 하나"·여러 줄 설명·상태 active·점수 77·생성 `2026-04-02T05:06:07+00:00`·수정 `2026-04-15T01:02:03+00:00` 이다.

**React Native Reusables CLI 0.7.1**: `add badge skeleton --styling-library uniwind --yes` 는 두 파일을 만들고 `text.tsx` 덮어쓰기를 묻는다(`printf 'n\n' |` 로 "아니오"). `package.json` 은 그대로다(`@rn-primitives/slot`·`react-native-reanimated` 가 이미 있다). 받은 `skeleton.tsx` 는 typecheck(TS2375, ref)에서 실패하고 lint 경고 하나(`exhaustive-deps`)를 낸다. `doctor` 는 두 건을 낸다.

**의존성**: `@react-native-community/netinfo` 12.0.1 = SDK 57 `bundledNativeModules.json` 의 값, 2026-02-14 릴리스(릴리스 대기 예외가 필요 없다). 설정 플러그인이 없다.

**D2 의 끝(`94be9bb` 와 그 위의 `ac88fe0`, 스크래치에 풀어 읽었다 — 2026-09-30T16:30Z–17:10Z)**:
- `ac88fe0` 는 로그인·가입 뒤 복귀를 `router.dismissTo(target, { withAnchor: true })` 로 바꿨다 — 경로 가드의 `<Redirect>` 가 루트에서 `(app)` 을 로그인 화면으로 바꿔 끼우므로 복귀할 때 `(app)` 이 새로 만들어지고, 앵커가 없으면 뒤로 가기가 앱을 닫았다(D2 실측 H3). `guard-return.yaml` 이 로그인 쪽의 뒤로 가기 → 홈을 잰다. 같은 커밋이 D2 운반 기록 `docs/superpowers/notes/2026-10-01-d2-carry-forward.md`, 스펙 9.3 끝의 D2 정정(인증 폼의 앱 문구 둘, "다시 시도" 버튼은 조회 화면에), `test/e2e/AGENTS.md` 의 환경 변수 표(`TMPDIR`·`BACKEND_URL`)·`boot` 문단("그 기기가 실기기면")·입력기 복구 문단, 하네스의 Maestro 버전 읽기를 더했다.
- 하네스 `run-android.sh` 는 Maestro 가 2.11.x 인지 보고, `logcat -c` 가 실패하면 그 플로를 실패로 치며, 기기 로그를 `"$ADB" logcat -d -v brief -s ReactNativeJS:V AndroidRuntime:E >"$out/logcat.txt" 2>&1 || logcat_rc=$?` 로 모아 실패를 따로 센다. 로캘 플로는 자판 없는 입력기로 바꿔 돌고 되돌린다. 빌드 지문(`build_fingerprint`)은 `git ls-files -z -co --exclude-standard -- . ':!test' ':!docs' ':!scripts' ':!*.md'` 의 파일 내용과 `BACKEND_URL` 이다.
- `guard-log.sh` 는 `ReactNativeJS` 줄이 하나도 없는 로그와, 머리말에 선언했는데 로그에 없는 상태를 실패로 본다. `android.sh boot` 는 부팅을 기다린 뒤(이미 켜진 기기도 같은 끝부분을 지난다) 애니메이션 배율 셋과 자동 완성을 끈다 — 링 버퍼는 건드리지 않는다.
- 플로 일곱(`guard-return`·`login-error-en`·`login-error-ko`·`logout-from-protected`·`register-conflict`·`register-invalid`·`register-restore-logout`). 단위 시험 768(34 파일), 출처 기록 경로 44·이탈 19·원본 그대로 31. 게이트 12단계, `[12/12] E2E` 는 `env -u E2E_FLOW ./test/e2e/run-android.sh`.
- `queries/auth.ts` 의 인증 쓰기 훅은 `networkMode: 'always'`(`NETWORK_MODE`, 주석이 "D3 가 onlineManager 를 NetInfo 에 물리면" 을 앞일로 적었다)·`gcTime: 1000` 이고, 로그아웃 콜백은 그대로 `queryClient.removeQueries()` 다. `useIsLoggingOut` 이 더해졌다.
- 로그인·가입 화면의 `register-link`·`login-link` 는 `Link href={authLinkHref(…)} replace asChild` 안의 `Text` 다. 자격증명 폼(`components/form/credentials-form.tsx`)은 `ScrollView` 이고 이메일 칸에 자동 포커스가 없다 — 화면이 열릴 때 키보드가 링크를 가리지 않는다. 보호 경로는 `/examples/new`(`new-example-screen`)와 `/examples/<id>/edit` 뿐이고 목록·상세는 공개다(`lib/auth/protected-paths.ts`).
- 정본 FastAPI 의 상세는 id 를 `str` 로 받아 `coerce_model_id` 가 UUID 로 바꾸고, 바꾸지 못하면 404 `RESOURCE_NOT_FOUND` 를 던진다(`app/controllers/concerns/document_parsing.py`) — 형식이 틀린 id 도 422 가 아니라 404 다.
- RN 0.86 의 `AppRegistryImpl.js` 는 앱을 띄울 때 `console.log('Running "main"')`(개발 빌드는 뒤에 파라미터)을 남긴다 — e2e 변형(릴리스)의 기기 로그에도 `I/ReactNativeJS … Running "main"` 이 한 번 있다.

**git 2.x pathspec**: `git ls-files -- . ':!test' 'test/e2e/android.sh'` 는 `test/e2e/android.sh` 를 내지 않는다 — 제외 pathspec 이 같은 명령의 포함 pathspec 보다 앞선다(스크래치 저장소에서 확인). 제외된 디렉터리의 파일을 지문에 넣으려면 따로 해시한다.

**pnpm 11.22.0 의 릴리스 대기**: `--frozen-lockfile` 설치도 락파일 항목을 `minimumReleaseAge`(1440분)로 검사한다. `94be9bb` 사본에서 `lucide-react-native@1.49.0` 예외를 빼고 2026-09-30T16:37Z 에 돌리면 exit 1 — `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION … lucide-react-native@1.49.0 was published at 2026-09-29T22:12:46.000Z, within the minimumReleaseAge cutoff`. npm 의 `time["1.49.0"]` 은 `2026-09-29T22:27:09.286Z` 다 — 늦은 쪽에 24시간을 더한 `2026-09-30T22:27:09Z` 뒤에 뺀다.

## 미리 돌려 본 것

스크래치 사본에서 돌렸다 — 저장소에는 쓰지 않았다(저장소는 `git archive`·`git show` 로 읽기만 했다).

**D2 의 끝 위에서 계획 전체를 흉내 냈다(2026-09-30T17Z 무렵).** `git archive ac88fe0` 을 스크래치에 풀고 `pnpm install --frozen-lockfile` 한 뒤 태스크 순서대로 돌렸다. 파일 조작은 이 계획 파일에서 모든 "찾을 것/바꿀 것"·파일 쓰기·끼울 자리·덧붙이기·"고친 뒤의 파일" 을 뽑아 적용하는 스크립트로 했다 — 찾을 것이 정확히 한 번 맞지 않거나 고친 파일이 "고친 뒤의 파일" 과 다르면 실패다. 셸 단계(원본 복사, 패치 둘, 출처 스크립트, `expo install`, React Native Reusables CLI, `pnpm format`, 검사)는 계획의 명령 그대로다. 같은 흉내를 `94be9bb` 에서 먼저 돌려 어긋난 앵커 넷(`queries/AGENTS.md` 의 표·로그아웃 문단, `run-android.sh` 의 기기 로그 줄, Task 3 의 `theme.ts` 행)을 고쳤고, `ac88fe0` 에서 `test/e2e/AGENTS.md` 의 `boot` 문단을 고쳤다.

- 기준: 단위 시험 768, 출처 기록 44·19·31, 플로 7.
- Task 1: 원본 시험 176 통과 → 새 시험 21 실패·3 통과 → view 패치 뒤 원본 시험 46 실패 → 두 패치 뒤 182 통과. 출처 46·28·31. 정적 검사 통과, 시험 950.
- Task 2: `expo install` 이 `"@react-native-community/netinfo": "12.0.1"` 을 적고 락파일에 NetInfo 항목만 더했다. 예외를 뺀 `pnpm-workspace.yaml` 은 Edit 가 맞고 YAML 로 읽히지만, 아직 24시간 전이라 `pnpm install --frozen-lockfile` 이 `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` 으로 막혔다(되돌리고 진행 — 결정 34 의 `아직` 갈래). 정적 검사·`expo-doctor`(21/21) 통과, 시험 960.
- Task 3: 변형 시험 1 실패 → 뺀 뒤 통과. CLI 가 두 파일을 만들고 `text.tsx` 를 건너뛰었다(받은 `badge.tsx` 는 이 계획의 것과 같다). 스켈레톤 Edit 뒤 "고친 뒤의 파일" 과 같다. `doctor` 두 건. 정적 검사 통과, 시험 966.
- Task 4: 파일 쓰기와 홈의 Edit 셋 뒤 "고친 뒤의 파일" 과 같다. 정적 검사 통과, `expo export --clear` 두 플랫폼 번들 성공(`Unable to resolve` 0, 따로 둔 TMP 로 — 저장소의 Metro 캐시를 건드리지 않으려고).
- Task 5: 하네스 Edit 전부 맞았고 `bash -n` 통과. 지문 시험 — 레시피를 고치면 바뀐다 `yes`, 플로만 고치면 `no`(D2 의 원래 `build_fingerprint` 로는 레시피를 고쳐도 `no` — M10 을 재현한다). 플로 여섯 `maestro check-syntax` 통과, 플로 13. 정적 검사·`expo config` 네 변형 통과, 시험 966, 출처 46·28·31.
- 앞 판(`2c9c853` 위의 사본)에서: 뮤턴트 넷(빈 쪽 판정·중복 제거·위치 버리기·커서 입구)이 각각 시험을 죽였다(view 코드는 그 뒤 바뀌지 않았다). CLI 명령을 두 번 돌려 같은 결과를 보았다.
- 돌리지 않은 것: 에뮬레이터·Docker(`compose:verify` 포함)·`maestro test`·게이트 [11]·[12]. `runScript` 가 백엔드에 실제로 행을 만드는지, 시트 안의 요소를 Maestro 가 찾는지, `logcat -G 16M` 이 먹는지, 가입 쪽 복귀의 앵커, 앱 안 링크의 탭은 Task 5 가 처음 잰다. 릴리스 대기 예외를 뺀 설치가 통과하는 것은 2026-09-30T22:27Z 뒤에만 잴 수 있다.

---

## D2 가 넘겨야 하는 것 (이 계획의 전제)

Task 1 Step 1 이 확인한다. 하나라도 없으면 멈추고 컨트롤러에 알린다.

| 산출 | 이 계획이 쓰는 모양 |
| --- | --- |
| `platform/api.ts` | `apiRequest: JsonApiSend` — 던지지 않고 결과를 돌려준다, Accept-Language 를 싣는다, e2e 변형은 2xx 밖의 결과를 `[e2e-http]` 로 기록 |
| `platform/query-client.ts` | `export const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 0, retry: false }, mutations: { retry: false } } })` — Task 2 가 파일째 바꾼다 |
| `queries/auth.ts` | `useLogoutMutation` 이 `sessionManager.logout(() => { queryClient.removeQueries() })` 를 부른다, 인증 쓰기의 `NETWORK_MODE = 'always'` 와 그 주석 — Task 2 가 콜백을 표로 바꾸고 주석을 지금 일로 고친다 |
| `queries/AGENTS.md`·`platform/AGENTS.md` | Prettier 가 칸을 맞춘 파일 표(`auth.ts` 행에 `useIsLoggingOut`), `queries/AGENTS.md` 의 로그아웃 문단("로그아웃은 Query 캐시를 전부 비운다(스펙 8.5). 조회 캐시만 비운다…")과 `networkMode: 'always'` 문단, `platform/AGENTS.md` 의 부팅 순서 문단("세션·Query, 앞으로의 AppState·NetInfo") |
| `pnpm-workspace.yaml` | `minimumReleaseAgeExclude` 에 `lucide-react-native@1.49.0` 하나와 그 위의 주석 — Task 2 Step 3(또는 Task 5 Step 1)이 뺀다 |
| `app/_layout.tsx` | `AppRoot` 가 `const ready = useSessionStatus() !== 'restoring'` 로 시작하고 `queryClient` 를 `@/platform/query-client` 에서 가져온다 |
| `app/(app)/_layout.tsx`·`app/(app)/index.tsx` | 앱 셸 Stack(`unstable_settings = { anchor: 'index' }`), 홈의 testID `home-screen`, 제목 `<Text variant="h3">template-typescript-expo</Text>` |
| `components/form/form-banner.tsx` | `FormBanner({ messages })`, testID `form-banner`·`form-banner-message` |
| `components/ui/input.tsx` | CLI 판에 `placeholderClassName` 한 곳만 고친 것(클래스에 `sm:h-9`, web 갈래에 `md:text-sm`) |
| `lib/auth/form-state.ts` | `UNUSABLE_RESPONSE_MESSAGE` |
| E2E 하네스 | `test/e2e/run-android.sh`(`flows/*.yaml` 전부, 머리말 `# e2e-allow-http:`·`# e2e-app-locale:`, env `EMAIL`·`OTHER_EMAIL`·`PASSWORD`, `local … out rc=0 logcat_rc=0`, 로캘 앞 단계 두 줄 `pm clear`·`set-app-locales`, 기기 로그 줄 `… || logcat_rc=$?`, `build_fingerprint` 의 `':!test'`), `test/e2e/android.sh`(`boot` 끝의 `autofill_service null`), `test/e2e/subflows/start-signed-out.yaml`·`submit-credentials.yaml`, `test/e2e/guard-log.sh`(`ReactNativeJS` 줄과 선언한 상태가 필수), `test/e2e/AGENTS.md`(`## 돌리기` 절, 빌드 입력 문단, `ac88fe0` 의 `boot` 문단 "그 기기가 실기기면"), 플로 일곱, 게이트 `[12/12] E2E` |
| 로그인·가입·보호 경로 | testID `login-screen`·`register-screen`·`register-link`·`login-link`·`email-input`·`password-input`·`submit-button`·`logout-button`·`home-screen`, 보호 경로 `/examples/new` 의 `new-example-screen`, 로그인·가입 뒤 `dismissTo(…, { withAnchor: true })`(`ac88fe0`) — Task 5 의 `auth-links.yaml` 이 쓴다 |
| D2 실측 기록 H1 | `docs/superpowers/notes/2026-09-30-d2-measurements.md` 의 판정 문장(세 백엔드의 캐시 머리글) |
| 의존성 | `@tanstack/react-query` 5.104.0 |
| 기준 수 | 단위 시험 768, 출처 기록 경로 44·이탈 19·원본 그대로 31(`94be9bb`·`ac88fe0`) — 뒤의 "늘어난다" 는 이 수에서 센다 |
| D2 운반 기록 | `docs/superpowers/notes/2026-10-01-d2-carry-forward.md` 의 "D3" 절 — 이 계획이 맡은 자리는 아래 "D1·D2 에서 이어받은 것" 표 |

D2 가 실행 중에 위 파일의 글자를 바꿨으면, 이 계획의 Edit 블록은 같은 뜻의 자리를 찾아 고친다(바꿀 것의 뜻을 지킨다).

## D1·D2 에서 이어받은 것

| 항목(출처) | 맡은 곳 |
| --- | --- |
| Uniwind 1.12.0 `@media` 결함 — 패치·버전·`sm:` 회피 중 하나(D1 운반 D3 절, D1 판정 R18, D2 다음 계획) | Task 3 — 회피(결정 17) |
| `components.json` 의 `"hooks": "@/queries"`(D1 운반) | Task 3 Step 5(결정 20) |
| `platform/theme.ts` 의 색과 `global.css` 토큰의 어긋남(D1 운반) | Task 3 Step 4(결정 19) |
| 목록·상세의 신선도를 네이티브 HTTP 캐시와 함께(D1 운반, D2 결정 29·33) | Task 5 Step 4·5 — E2E `examples-scroll-refresh`, 기록 L5(결정 28) |
| 소음 셋 — `userInterfaceStyle`, React Native Reusables CLI 의 잠재 문제, 0 B 웹 CSS(D1 운반) | Task 3 Step 6(결정 21) |
| AppState→`focusManager`, NetInfo→`onlineManager`(D2 결정 7) | Task 2 Step 4 |
| 캐시 키와 무효화 표, 로그아웃의 캐시 비움을 표로(D2 다음 계획) | Task 2 Step 1–4(결정 11) |
| 조회 플로는 `test/e2e/flows/` 에(D2 다음 계획) | Task 5 Step 2 |
| TanStack Query 취소를 붙이면 `client.ts` 타이머 가드(D2 결정 31, D2 최종 검토 T24) | 붙이지 않는다(결정 14) — 조건과 할 일을 `queries/AGENTS.md` 에 규칙으로(Task 2 Step 6, 결정 35) |
| logcat 링 버퍼 크기(D2 최종 검토 M9) | Task 5 Step 1 — `android.sh boot` 의 `logcat -G 16M`, `test/e2e/AGENTS.md`(결정 31) |
| 빌드 레시피가 APK 지문에 없다(D2 최종 검토 M10) | Task 5 Step 1 — `build_fingerprint` 에 `test/e2e/android.sh`(결정 32) |
| 앱 안 로그인·가입 링크를 기기에서 누른 적 없다(D2 최종 검토 M11) | Task 5 Step 2 — `auth-links.yaml`(결정 33) |
| `minimumReleaseAgeExclude` 의 `lucide-react-native@1.49.0`(D2 최종 검토 T10) | Task 2 Step 3, 24시간 전이면 Task 5 Step 1(결정 34) |
| 인증 쓰기의 "앞으로 NetInfo 에 물리면"(D2 의 `queries/auth.ts`·`queries/AGENTS.md`) | Task 2 Step 4·6 — 지금 일로 고친다(결정 12) |
| 가드의 HTTP 선언은 정확한 집합 — "나올 수 있음" 선언을 더할지(D2 운반 기록) | 더하지 않는다(결정 37) |
| `run_flow` 의 `pm clear`·`set-app-locales` 에 `\|\| return 1`(D2 최종 검토 T18c, D2 운반 기록) | Task 5 Step 1 (6)(결정 38) |
| 로그인·가입 뒤 복귀의 `withAnchor`(D2 의 끝 `ac88fe0`) — 가입 쪽은 기기에서 재지 않았다 | Task 5 Step 2 — `auth-links.yaml` 의 뒤로 가기 → 홈(결정 33) |
| 조회 화면의 "다시 시도"(D2 결정 23) | Task 1(결정 6)·Task 4 |
| 대괄호 키의 인코딩 규칙(스펙 8.2, D1 M2) | Task 1(결정 10), 기록 L1 |

---

## 태스크 지도

| 태스크 | 산출 | 시험 | 기기 |
| --- | --- | --- | --- |
| 1 목록·상세 판단 | `lib/resources/view.ts`(복사·고침), 원본 시험(고침), `view-expo.test.ts`, 출처 기록, 실측 기록 L1, 스펙 8.2·8.3·9.3 정정 | 원본 시험 158 + 새 시험 24, 뮤턴트 넷 | 없음 |
| 2 queries 와 재조회 | `queries/keys.ts`·`resources.ts`, 로그아웃의 표, `platform/query-client.ts`(offlineFirst·재조회), NetInfo, 릴리스 대기 예외 빼기(T10), 스펙 8.5 정정 | 표 시험 10(실제 QueryClient), `pnpm install --frozen-lockfile` | 없음 |
| 3 UI 기반 | 미디어 변형 제거와 시험, `badge`·`skeleton`, 테마 색 표와 시험, `components.json`, 소음 판정(L2–L4), 스펙 16장 정정 | 변형 시험 3, 색 시험 3 | 없음 |
| 4 목록·상세 화면 | `components/app` 셋, `components/resource` 여섯, 목록·상세·not-found 라우트, 홈의 진입 버튼 | 정적 검사 + 번들 | 없음 |
| 5 E2E 와 신선도 | 하네스 `API_URL`·플로마다 `api.log`·링 버퍼 16M(M9)·지문의 빌드 레시피(M10), `examples-api.js`, 플로 여섯(목록·상세 다섯 + `auth-links`, M11), 기기 실행, 기록 L5·L6, 스펙 11.3 정정, 게이트 | 지문 시험(클론), 기기 E2E 13 플로 + 게이트 | **여기서만** |

## File Structure

```text
lib/resources/view.ts                      (복사·고침) 목록·상세·필터·정렬 판단 - 커서, 폼 상태, unreachable   — Task 1
test/unit/resources/view.test.ts           (복사·고침) 원본 시험                                                — Task 1
test/unit/resources/view-expo.test.ts      (신규) 커서·쪽 배열·폼 상태·라우트 파라미터 왕복                      — Task 1
queries/keys.ts                            (신규) 캐시 키, 무효화 표, 표 적용                                    — Task 2
queries/resources.ts                       (신규) useResourceList·useResourceDetail                             — Task 2
queries/auth.ts                            (수정) 로그아웃이 표를 지난다, NETWORK_MODE 주석을 지금 일로           — Task 2
platform/query-client.ts                   (다시 씀) offlineFirst, useQueryRefetchTriggers                       — Task 2
app/_layout.tsx                            (수정) AppRoot 가 재조회 훅을 부른다                                   — Task 2
test/unit/queries/keys.test.ts             (신규)                                                                — Task 2
package.json·pnpm-lock.yaml                (수정) NetInfo 12.0.1                                                 — Task 2
pnpm-workspace.yaml                        (수정) 릴리스 대기 예외 lucide-react-native@1.49.0 빼기(T10)          — Task 2(늦으면 Task 5)
components/ui/button.tsx·input.tsx·text.tsx (수정) 미디어 쿼리 변형 제거                                          — Task 3
components/ui/badge.tsx·skeleton.tsx       (CLI) 스켈레톤 두 곳 고침                                              — Task 3
platform/nav-colors.ts                     (신규) 내비게이션 색 표 - global.css 토큰의 sRGB                        — Task 3
platform/theme.ts                          (수정) 색을 nav-colors 에서                                           — Task 3
test/unit/ui/breakpoints.test.ts·nav-colors.test.ts (신규)                                                        — Task 3
components.json                            (수정) hooks 별칭                                                     — Task 3
components/app/request-failed.tsx·not-found-view.tsx·sheet.tsx (신규)                                            — Task 4
components/resource/values.tsx·resource-row.tsx·resource-list.tsx·resource-detail.tsx·filter-sheet.tsx·sort-sheet.tsx·AGENTS.md (신규) — Task 4
app/(app)/examples/index.tsx               (신규) 목록                                                           — Task 4
app/(app)/examples/[id]/index.tsx          (신규) 상세                                                           — Task 4
app/+not-found.tsx                         (신규) 없는 경로                                                      — Task 4
app/(app)/index.tsx                        (수정) 홈의 목록 진입 버튼                                            — Task 4
test/e2e/run-android.sh                    (수정) Maestro 에 API_URL, 플로마다 백엔드 접근 로그(api.log), 지문에 빌드 레시피(M10), 로캘 앞 단계의 실패 — Task 5
test/e2e/android.sh                        (수정) boot 가 기기 로그 링 버퍼를 16M 로(M9)                          — Task 5
test/e2e/scripts/examples-api.js           (신규) runScript 의 행 만들기                                         — Task 5
test/e2e/flows/examples-*.yaml             (신규) 목록·상세 플로 다섯                                            — Task 5
test/e2e/flows/auth-links.yaml             (신규) 앱 안의 로그인·가입 링크(M11)                                   — Task 5
docs/superpowers/notes/2026-09-30-d3-measurements.md (신규) L1(Task 1)·L2–L4(Task 3)·L5–L6(Task 5)
docs/provenance/copied-core.json           (수정) Task 1
AGENTS.md · lib/resources/AGENTS.md · queries/AGENTS.md · platform/AGENTS.md · test/e2e/AGENTS.md (수정)
docs/superpowers/specs/2026-09-30-expo-jsonapi-template-design.md (정정) 8.2·8.3·9.3(Task 1), 8.5(Task 2), 16장(Task 3), 11.3(Task 5)
```

---

### Task 1: 목록·상세 판단 — `lib/resources/view.ts` 복사, 커서·폼 상태·닿지 못함

**Files:**
- Create: `lib/resources/view.ts`(원본 복사 + 패치), `test/unit/resources/view.test.ts`(원본 복사 + 패치), `test/unit/resources/view-expo.test.ts`, `docs/superpowers/notes/2026-09-30-d3-measurements.md`
- Modify: `docs/provenance/copied-core.json`, `lib/resources/AGENTS.md`, `AGENTS.md`, `docs/superpowers/specs/2026-09-30-expo-jsonapi-template-design.md`(8.2·8.3·9.3 정정)

**Interfaces:**
- Consumes: D1 의 `lib/jsonapi/query.ts`(`toBackendQuery`·`isPagePositionParameter`·`pageParameter`·`linkQuery`·`buildQuery`·`INCLUDE_PARAMETER`), `lib/jsonapi/errors.ts`(`actionForErrors`·`groupErrors`), `lib/jsonapi/client.ts` 의 `JsonApiResult`·`RequestOptions`(타입만), `lib/resources/define.ts`·`index.ts`
- Produces (`lib/resources/view.ts`, 원본에서 바뀌거나 더한 것만):
  - `LIST_PAGE_SIZE = 20`
  - `listQuery(resource, searchParams): URLSearchParams` — 위치 파라미터를 버리고 `page[after]=`, 없으면 `page[size]=20`, 관계가 있으면 `include`
  - `listRequest(resource: ResourceDefinition, searchParams: SearchParams): ListRequest` — `{ path, query, options: { query } }`
  - `type ListFailure = { kind: 'banner'; messages: readonly string[] } | { kind: 'unreachable' }`
  - `type ListView = { kind: 'list'; columns; rows; filtered: boolean; failure: ListFailure | null } | ListFailure`
  - `listView(resource, plan: ListRequest, pages: readonly JsonApiResult<CollectionDocument>[]): ListView`
  - `nextPageQuery(result: JsonApiResult<CollectionDocument>): URLSearchParams | null`
  - `type FilterFormValues = Readonly<Record<string, readonly string[]>>`
  - `filterQuery(fields, searchParams, form: FilterFormValues): URLSearchParams`
  - `filterFormValues(fields: readonly FilterField[]): FilterFormValues`
  - `filterHref(path: string, fields, searchParams, form: FilterFormValues): string`
  - `detailRequest(resource: ResourceDefinition, id: string): DetailRequest` — `{ path, options: { query } }`
  - `type DetailView = { kind: 'detail'; heading: string; fields: readonly DetailField[] } | { kind: 'notFound' } | ListFailure`
  - `referenceRequest(target: ResourceDefinition): ReferenceRequest`
  - 그대로: `listColumns`·`listRows`·`displayAttribute`·`formatAttributeValue`·`bannerMessages`·`filterFields`·`filterFieldsKey`·`sortOptions`(`SortOption { key; label; href; direction }`)·`currentSortToken`·`clearFiltersHref(path, searchParams): string`·`detailLabels`·`detailFields`·`detailView(resource, result)`·`referenceList`·`ANY_FILTER_LABEL`·`type FilterField`·`type FilterOption`·`type ListRow`·`type ListCell`·`type ListColumn`·`type DetailField`·`type DetailLabel`
  - 뺀 것: `PaginationView`·`pageHref`·`paginationView`

- [ ] **Step 1: 브랜치와 D2 산출물을 확인한다**

컨트롤러가 브랜치를 만들어 두었으면 확인만 한다.

```bash
git branch --show-current
git log --oneline -3
git status --short
for f in platform/api.ts platform/query-client.ts platform/session.ts queries/auth.ts components/form/form-banner.tsx components/ui/input.tsx lib/auth/form-state.ts test/e2e/run-android.sh test/e2e/android.sh test/e2e/guard-log.sh test/e2e/subflows/start-signed-out.yaml docs/superpowers/notes/2026-09-30-d2-measurements.md; do test -e "$f" && echo "ok $f" || echo "MISSING $f"; done
grep -n "\[12/12\] E2E" scripts/check.sh
grep -n "UNUSABLE_RESPONSE_MESSAGE =" lib/auth/form-state.ts
grep -n '"@tanstack/react-query"' package.json
grep -n "lucide-react-native@1.49.0" pnpm-workspace.yaml
grep -c "logcat_rc" test/e2e/run-android.sh
ls test/e2e/flows | wc -l
node scripts/check-provenance.mjs
pnpm test 2>&1 | grep -E "^ +Tests "
```

Expected: `feat/d3-list-and-detail`, 작업 트리가 깨끗하다, `ok …` 열두 줄(`MISSING` 없음), `[12/12] E2E` 한 줄, 문구 상수 한 줄, `"@tanstack/react-query": "5.104.0"`, 예외 한 줄(D2 가 먼저 뺐으면 없다 — 그러면 Task 2 Step 3 의 빼기를 건너뛴다), `logcat_rc` 가 1 이상, 플로 `7`, 출처 기록 통과(D2 의 끝 `ac88fe0` 에서 경로 44·이탈 19·원본 그대로 31 — 다르면 그 수를 적어 두고 뒤의 기대값을 그만큼 옮긴다), 시험 `768 passed`(같다). 파일이 없거나 게이트·의존성이 어긋나면 멈추고 컨트롤러에 알린다.

- [ ] **Step 2: 원본 두 파일을 그대로 복사하고 이 저장소에서 도는지 본다**

```bash
SRC=../template-typescript-nextjs
REV=34d0b1057d65693645e75bec4e9558dcf6838822
for f in lib/resources/view.ts test/unit/resources/view.test.ts; do git -C "$SRC" show "$REV:$f" > "$f"; done
pnpm exec vitest run test/unit/resources/view.test.ts 2>&1 | tail -4
```

Expected: PASS 176 — 원본의 판단이 D1 에서 복사한 `lib/jsonapi`·`lib/resources` 위에서 그대로 돈다.

- [ ] **Step 3: 이 저장소가 더하는 판단의 시험을 쓰고 실패를 본다**

`test/unit/resources/view-expo.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import type { JsonApiResult } from '@/lib/jsonapi/client'
import type { CollectionDocument, ErrorObject } from '@/lib/jsonapi/document'
import { defineResource } from '@/lib/resources/define'
import {
  LIST_PAGE_SIZE,
  clearFiltersHref,
  filterFields,
  filterFormValues,
  filterHref,
  filterQuery,
  listQuery,
  listRequest,
  listView,
  nextPageQuery,
  sortOptions,
} from '@/lib/resources/view'

/**
 * 이 저장소가 `lib/resources/view.ts`(template-typescript-nextjs 에서 복사)에 더한 판단 - 커서
 * 목록(스펙 8.3), 쪽 여럿의 목록 상태, 필터 시트의 폼 상태(스펙 6.2), 라우트 파라미터 왕복(스펙
 * 8.2). 원본의 시험은 test/unit/resources/view.test.ts 에 있다.
 *
 * 자원은 `probe*` 로 만든다 - `EXAMPLE` 로 재면 "선언을 읽는다" 와 "그 자원을 안다" 가 구별되지
 * 않는다(view.test.ts 머리말과 같은 규칙).
 */
function probeShelf() {
  return defineResource({
    type: 'probeShelves',
    path: '/probe/api/shelves',
    attributes: {
      probeTitle: {
        kind: 'string',
        label: 'PROBE 제목',
        readOnly: false,
        nullable: false,
        listed: true,
      },
      probeState: {
        kind: 'enum',
        label: 'PROBE 상태',
        readOnly: false,
        nullable: false,
        listed: true,
        values: [
          { value: 'probe-open', label: 'PROBE 열림' },
          { value: 'probe-shut', label: 'PROBE 닫힘' },
        ],
      },
      probeSize: {
        kind: 'int',
        label: 'PROBE 크기',
        readOnly: false,
        nullable: false,
        listed: true,
      },
      probeMadeAt: {
        kind: 'datetime',
        label: 'PROBE 시각',
        readOnly: true,
        nullable: false,
        listed: true,
      },
    },
    relationships: {
      probeOwner: { cardinality: 'one', type: 'probeOwners', label: 'PROBE 주인' },
    },
    filters: {
      probeTitle: ['contains'],
      probeState: ['in'],
      probeSize: ['gte', 'lte'],
      probeMadeAt: ['gte', 'lte'],
      'probeOwner.id': ['isNull'],
    },
    sorts: ['probeTitle', 'probeSize'],
    defaultSort: '-probeSize',
    includes: ['probeOwner'],
    writable: true,
  })
}

const PATH = '/probe/shelves'

/** 행 하나. 제목만 채운다 - 행 변환의 세부는 view.test.ts 가 잰다. */
function probeRow(id: string) {
  return { type: 'probeShelves', id, attributes: { probeTitle: `PROBE ${id}` } }
}

function okPage(
  ids: readonly string[],
  links?: Record<string, string | null>,
): JsonApiResult<CollectionDocument> {
  return {
    ok: true,
    status: 200,
    document: { data: ids.map(probeRow), ...(links === undefined ? {} : { links }) },
  }
}

function failedPage(errors: ErrorObject[]): JsonApiResult<CollectionDocument> {
  return { ok: false, status: 0, errors }
}

/** client.ts 가 합성한 오류의 표시 - 코드 문자열이 아니라 표시로 판정한다(view.test.ts 와 같다). */
const UNREACHABLE: ErrorObject = {
  status: '0',
  code: 'PROBE_TRANSPORT',
  detail: 'PROBE 전송 실패',
  meta: { synthetic: true },
}

/** 정본 모양의 커서 링크(백엔드 경로, 원래 쿼리를 보존하고 page 계열만 바꾼다). */
const NEXT_LINK =
  '/probe/api/shelves?filter%5BprobeTitle%5D%5Bcontains%5D=PROBE&include=probeOwner&page%5Bafter%5D=cHJvYmUtY3Vyc29y&page%5Bsize%5D=20'

describe('listQuery — 커서의 입구 (스펙 8.3)', () => {
  it('첫 요청은 page[after] 빈 값과 쪽 크기 20 이다', () => {
    const query = listQuery(probeShelf(), {})
    expect(query.get('page[after]')).toBe('')
    expect(query.get('page[size]')).toBe('20')
    expect(LIST_PAGE_SIZE).toBe(20)
  })

  it('URL 의 쪽 번호·커서는 버린다 - offset 과 cursor 가 섞이면 400 이다', () => {
    const query = listQuery(probeShelf(), {
      'page[number]': '3',
      'page[after]': 'probe-stale-cursor',
      'page[before]': '',
    })
    expect(query.has('page[number]')).toBe(false)
    expect(query.has('page[before]')).toBe(false)
    expect(query.getAll('page[after]')).toEqual([''])
  })

  it('URL 의 쪽 크기는 남긴다 - 위치가 아니라 "한 쪽에 몇 개" 다', () => {
    expect(listQuery(probeShelf(), { 'page[size]': '2' }).getAll('page[size]')).toEqual(['2'])
  })
})

describe('nextPageQuery — links.next 를 그대로 따라간다', () => {
  it('다음 링크의 쿼리를 그대로 준다 - 커서를 해석하지 않는다', () => {
    const next = nextPageQuery(okPage(['s1', 's2'], { self: '/x', next: NEXT_LINK }))
    expect(next?.get('page[after]')).toBe('cHJvYmUtY3Vyc29y')
    expect(next?.get('page[size]')).toBe('20')
    expect(next?.get('filter[probeTitle][contains]')).toBe('PROBE')
    expect(next?.get('include')).toBe('probeOwner')
  })

  it('next 가 null 이면 끝이다 (정본·Rails 모양)', () => {
    expect(nextPageQuery(okPage(['s1'], { self: '/x', next: null }))).toBe(null)
  })

  it('next 키가 아예 없어도 끝이다 (NestJS 모양, R-10①)', () => {
    // 엄격 비교(`!== null`)로 판정하면 `undefined !== null` 이 참이라 끝이 오지 않는다.
    expect(nextPageQuery(okPage(['s1'], { self: '/x', first: '/x' }))).toBe(null)
    expect(nextPageQuery(okPage(['s1']))).toBe(null)
  })

  it('빈 쪽은 끝이다 - next 에 커서가 있어도 (NestJS 의 경계)', () => {
    expect(nextPageQuery(okPage([], { self: '/x', next: NEXT_LINK }))).toBe(null)
  })

  it('실패한 쪽과 본문 없는 응답 뒤로는 읽지 않는다', () => {
    expect(nextPageQuery(failedPage([UNREACHABLE]))).toBe(null)
    expect(nextPageQuery({ ok: true, status: 204, document: null })).toBe(null)
  })

  it('읽을 수 없는 링크는 끝이다 - 던지지 않는다', () => {
    expect(nextPageQuery(okPage(['s1'], { next: 'http://[probe' }))).toBe(null)
  })
})

describe('listView — 쪽 여럿을 한 목록으로', () => {
  const plan = listRequest(probeShelf(), {})

  it('읽은 쪽을 순서대로 잇는다', () => {
    const view = listView(probeShelf(), plan, [okPage(['s1', 's2']), okPage(['s3'])])
    if (view.kind !== 'list') throw new Error('목록이어야 한다')
    expect(view.rows.map((row) => row.id)).toEqual(['s1', 's2', 's3'])
    expect(view.failure).toBe(null)
  })

  it('같은 id 는 처음 나온 행만 남긴다 - 목록의 키가 겹치지 않는다', () => {
    const view = listView(probeShelf(), plan, [okPage(['s1', 's2']), okPage(['s2', 's3'])])
    if (view.kind !== 'list') throw new Error('목록이어야 한다')
    expect(view.rows.map((row) => row.id)).toEqual(['s1', 's2', 's3'])
  })

  it('첫 쪽이 닿지 못하면 화면 전부가 unreachable 이다', () => {
    expect(listView(probeShelf(), plan, [failedPage([UNREACHABLE])])).toEqual({
      kind: 'unreachable',
    })
  })

  it('뒤따르는 쪽이 닿지 못하면 읽은 행은 두고 failure 에 싣는다', () => {
    const view = listView(probeShelf(), plan, [okPage(['s1']), failedPage([UNREACHABLE])])
    if (view.kind !== 'list') throw new Error('목록이어야 한다')
    expect(view.rows.map((row) => row.id)).toEqual(['s1'])
    expect(view.failure).toEqual({ kind: 'unreachable' })
  })

  it('뒤따르는 쪽의 백엔드 오류는 그 문구의 배너다', () => {
    const view = listView(probeShelf(), plan, [
      okPage(['s1']),
      failedPage([{ status: '400', code: 'PROBE_PAGE', detail: 'PROBE 쪽 오류' }]),
    ])
    if (view.kind !== 'list') throw new Error('목록이어야 한다')
    expect(view.failure).toEqual({ kind: 'banner', messages: ['PROBE 쪽 오류'] })
  })

  it('뒤따르는 쪽의 오류에 문구가 없으면 던진다 - 빈 배너를 그리지 않는다', () => {
    expect(() =>
      listView(probeShelf(), plan, [okPage(['s1']), failedPage([{ status: '400' }])]),
    ).toThrow()
  })
})

describe('filterFormValues — 시트를 열 때의 값', () => {
  const params = {
    'filter[probeTitle][contains]': 'PROBE 조각',
    'filter[probeState][in]': 'probe-open,probe-shut',
    'filter[probeSize][gte]': '10',
    'filter[probeMadeAt][lte]': '2026-04-02T23:59:59.999999+00:00',
    'filter[probeOwner.id][isNull]': 'true',
    sort: '-probeSize',
  }

  it('컨트롤마다 URL 의 값을 파라미터 이름으로 담는다', () => {
    expect(filterFormValues(filterFields(probeShelf(), params))).toEqual({
      'filter[probeTitle][contains]': ['PROBE 조각'],
      'filter[probeState][in]': ['probe-open', 'probe-shut'],
      'filter[probeSize][gte]': ['10'],
      'filter[probeSize][lte]': [],
      'filter[probeMadeAt][gte]': [],
      // 날짜 입력이 그릴 수 있는 UTC 날짜로 접힌다(filterFields 의 규칙).
      'filter[probeMadeAt][lte]': ['2026-04-02'],
      'filter[probeOwner.id][isNull]': ['true'],
    })
  })

  it('그대로 적용하면 URL 의 조건이 다시 나온다', () => {
    const fields = filterFields(probeShelf(), params)
    expect(filterQuery(fields, params, filterFormValues(fields)).toString()).toBe(
      new URLSearchParams(params).toString(),
    )
  })

  it('URL 이 비면 모든 값이 비어 있다', () => {
    const values = filterFormValues(filterFields(probeShelf(), {}))
    expect(Object.values(values).every((entry) => entry.length === 0)).toBe(true)
  })
})

describe('filterHref — 적용이 갈 주소', () => {
  it('이 화면의 주소에 필터 쿼리를 붙인다', () => {
    const fields = filterFields(probeShelf(), {})
    expect(filterHref(PATH, fields, {}, { 'filter[probeState][in]': ['probe-open'] })).toBe(
      `${PATH}?filter%5BprobeState%5D%5Bin%5D=probe-open`,
    )
  })

  it('조건이 없으면 경로 그대로다 - ? 를 남기지 않는다', () => {
    expect(filterHref(PATH, filterFields(probeShelf(), {}), {}, {})).toBe(PATH)
  })
})

/**
 * Expo Router 57 이 주소에서 라우트 파라미터를 꺼내는 순서 그대로다(2026-09-30, expo-router
 * 57.0.24 설치본의 build/ 에서 읽었다):
 *
 * 1. `fork/getStateFromPath-forks.js` 의 `parseQueryParams` - `new URL(주소, 'file:')` 의
 *    `searchParams` 에서 이름마다 `getAll`, 값이 하나면 문자열
 * 2. `hooks/useLocalSearchParams.js` - 값마다 `decodeURIComponent` 를 한 번 더(실패하면 그대로)
 *
 * 딥링크도 앱 안의 이동(`router.push(주소)`)도 이 해석을 지난다. 기기 위의 확인은 D1 실측 M2
 * (인코딩한 대괄호 키의 딥링크)와 E2E 의 딥링크 플로다.
 */
function routeParamsOf(href: string): Record<string, string | string[]> {
  const searchParams = new URL(href, 'file:').searchParams
  const params: Record<string, string | string[]> = {}
  for (const name of new Set(searchParams.keys())) {
    const values = searchParams.getAll(name).map(decodeOnceMore)
    const [only] = values
    params[name] = values.length === 1 && only !== undefined ? only : values
  }
  return params
}

function decodeOnceMore(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

describe('라우트 파라미터 왕복 - 이 앱의 주소 인코딩 규칙 (스펙 8.2)', () => {
  it('대괄호 키가 평평한 키로 돌아오고, 같은 백엔드 쿼리가 다시 나온다', () => {
    const params = {
      'filter[probeTitle][contains]': 'PROBE 조각',
      'filter[probeState][in]': 'probe-open,probe-shut',
      sort: 'probeTitle',
    }
    const fields = filterFields(probeShelf(), params)
    const href = filterHref(PATH, fields, params, filterFormValues(fields))
    expect(routeParamsOf(href)).toEqual(params)
    expect(listQuery(probeShelf(), routeParamsOf(href)).toString()).toBe(
      listQuery(probeShelf(), params).toString(),
    )
  })

  it('값의 공백·쉼표·&·=·+·#·한글이 그대로 돌아온다', () => {
    const value = 'PROBE a b,c&d=e+f#가'
    const fields = filterFields(probeShelf(), {})
    const href = filterHref(PATH, fields, {}, { 'filter[probeTitle][contains]': [value] })
    expect(routeParamsOf(href)['filter[probeTitle][contains]']).toBe(value)
  })

  it('정렬 메뉴와 필터 지우기의 주소도 같은 규칙으로 돌아온다', () => {
    const params = { 'filter[probeTitle][contains]': 'PROBE', sort: 'probeTitle' }
    const sortHref = sortOptions(probeShelf(), PATH, params).find(
      (option) => option.key === 'probeSize',
    )?.href
    expect(routeParamsOf(sortHref ?? '')).toEqual({
      'filter[probeTitle][contains]': 'PROBE',
      sort: '-probeSize',
    })
    expect(routeParamsOf(clearFiltersHref(PATH, params))).toEqual({ sort: 'probeTitle' })
  })

  it('알고 넘어가는 한계 - 값 안의 %XX 는 라우터가 한 번 더 풀어 바뀐다', () => {
    // useLocalSearchParams 의 두 번째 decodeURIComponent 때문이다. 풀 수 없는 % 는 그대로 남는다.
    const fields = filterFields(probeShelf(), {})
    const lossy = filterHref(PATH, fields, {}, { 'filter[probeTitle][contains]': ['PROBE %41'] })
    const kept = filterHref(PATH, fields, {}, { 'filter[probeTitle][contains]': ['PROBE 100%'] })
    expect(routeParamsOf(lossy)['filter[probeTitle][contains]']).toBe('PROBE A')
    expect(routeParamsOf(kept)['filter[probeTitle][contains]']).toBe('PROBE 100%')
  })
})
```

```bash
pnpm exec vitest run test/unit/resources/view-expo.test.ts 2>&1 | tail -4
```

Expected: FAIL — 21 실패·3 통과(`nextPageQuery is not a function` 등 — 아직 원본이다).

- [ ] **Step 4: `view.ts` 에 패치를 붙인다**

아래 패치를 Write 도구로 `.maestro-output/d3-view.patch` 에 그대로 쓰고(`.maestro-output/` 은 무시되는 자리다) 붙인다. 원본 커밋의 파일에만 맞는 패치라 글자 하나라도 어긋나면 `git apply` 가 거절한다 — 그러면 Step 2 부터 다시 한다.

```diff
diff --git a/lib/resources/view.ts b/lib/resources/view.ts
index 70dec3f..2dbb8e8 100644
--- a/lib/resources/view.ts
+++ b/lib/resources/view.ts
@@ -24,19 +24,18 @@
  * 붙이려면 응답을 읽는 쪽(`normalize` · `errors`)이 필요하다. 반대 방향은
  * 여전히 금지다 - `lib/jsonapi/` 는 자원을 모른다.
  *
- * `listRequest` 가 `withAcceptLanguage`(client.ts)를 부르는 것도 위반이 아니다 -
- * 그 함수는 **옵션 객체를 만드는 순수 함수**이지 네트워크를 부르지 않는다.
- * 이 디렉터리가 금하는 것은 `fetch`·`request()` 호출이고(`AGENTS.md`), 실제
- * 요청은 `page.tsx` 가 `request()` 로 보낸다. client.ts 의 그 함수 주석이
- * "D3 의 읽기 경로도 같은 함수를 쓴다" 고 그 자리를 미리 적어 두었다.
+ * (template-typescript-expo) 요청 옵션에 `Accept-Language` 를 싣지 않는다 - 그 헤더를 싣는
+ * 자리는 앱의 API 클라이언트 한 곳이다(`platform/api.ts`, 스펙 9.4). 목록은 커서로 끝까지
+ * 따라가고(스펙 8.3, `listQuery`·`nextPageQuery`), 백엔드가 응답조차 주지 못하면 던지지 않고
+ * `unreachable` 을 돌려준다 - 화면이 앱 문구와 "다시 시도" 를 그린다(스펙 9.3, `ListFailure`).
+ * 필터 시트의 값은 `FormData` 가 아니라 폼 상태 객체다(스펙 6.2, `FilterFormValues`).
  */
 
-import { withAcceptLanguage, type JsonApiResult, type RequestOptions } from '@/lib/jsonapi/client'
+import type { JsonApiResult, RequestOptions } from '@/lib/jsonapi/client'
 import {
   isCollectionDocument,
   type CollectionDocument,
   type ErrorObject,
-  type Links,
   type RelationshipObject,
   type ResourceIdentifier,
   type ResourceObject,
@@ -58,7 +57,6 @@ import {
   hasFilterParams,
   INCLUDE_PARAMETER,
   isFilterParameter,
-  isPageParameter,
   isPagePositionParameter,
   linkQuery,
   pageParameter,
@@ -132,8 +130,22 @@ export type ListView =
       columns: readonly ListColumn[]
       rows: readonly ListRow[]
       filtered: boolean
+      /**
+       * (template-typescript-expo) 뒤따르는 쪽을 읽다 실패했으면 그 실패, 아니면 `null`. 이미
+       * 읽은 행은 그대로 둔다 - 화면은 목록 끝에 실패와 "다시 시도" 를 그린다.
+       */
+      failure: ListFailure | null
     }
-  | { kind: 'banner'; messages: readonly string[] }
+  | ListFailure
+
+/**
+ * (template-typescript-expo) 목록·상세 대신 그리는 실패 둘. `banner` 는 백엔드가 협상한
+ * 문구이고(스펙 9.2), `unreachable` 은 백엔드가 응답조차 주지 못한 것(네트워크 실패·타임아웃)이라
+ * 문구를 앱이 갖고 "다시 시도" 를 함께 그린다(스펙 9.3). 원본은 뒤엣것을 던져 `app/error.tsx`
+ * 로 보냈다 - 이 앱에서 렌더 중 예외는 Expo Router 의 ErrorBoundary 가 받는데, 그 화면은 요청을
+ * 다시 보내지 않는다.
+ */
+export type ListFailure = { kind: 'banner'; messages: readonly string[] } | { kind: 'unreachable' }
 
 /** 목록에 그리는 속성만, 선언 순서 그대로. */
 function listedAttributes(
@@ -363,6 +375,12 @@ export function listRows(
   return document.data.map((object) => ({ id: object.id, cells: cellsOf(resource, object, index) }))
 }
 
+/**
+ * (template-typescript-expo) 목록 한 쪽의 크기 - 스펙 8.3. 한 화면을 채우고 세 백엔드의 상한
+ * 100 안에 든다. URL 에 `page[size]` 가 있으면 그 값이 이긴다(`listQuery`).
+ */
+export const LIST_PAGE_SIZE = 20
+
 /**
  * 목록 요청의 백엔드 쿼리.
  *
@@ -421,6 +439,15 @@ export function listQuery(
   searchParams: SearchParams,
 ): URLSearchParams {
   const query = toBackendQuery(withoutUndefined(searchParams))
+  // (template-typescript-expo) 목록은 커서다(스펙 8.3) - 위치는 이 화면이 정한다. 무한 스크롤은
+  // 언제나 처음부터 읽으므로 URL 에 실린 쪽 번호·커서는 버리고 커서의 입구(`page[after]=`)를
+  // 싣는다. 남기면 offset 과 cursor 가 섞여 400 이다. 쪽 크기는 위치가 아니라 "한 쪽에 몇
+  // 개" 라서 URL 에 있으면 그 값을 쓴다.
+  for (const name of [...query.keys()]) {
+    if (isPagePositionParameter(name)) query.delete(name)
+  }
+  query.set(pageParameter('after'), '')
+  if (!query.has(pageParameter('size'))) query.set(pageParameter('size'), String(LIST_PAGE_SIZE))
   if (resource.includes.length > 0) query.set(INCLUDE_PARAMETER, resource.includes.join(','))
   return query
 }
@@ -491,11 +518,7 @@ export interface ListRequest {
  *   2026-09-07 실측). D5 의 매트릭스가 볼 자리는 이 **줄**이 아니라 NestJS
  *   쪽의 **조용한 증상**이다.
  */
-export function listRequest(
-  resource: ResourceDefinition,
-  searchParams: SearchParams,
-  acceptLanguage: string | null,
-): ListRequest {
+export function listRequest(resource: ResourceDefinition, searchParams: SearchParams): ListRequest {
   const query = listQuery(resource, searchParams)
   return {
     path: resource.path,
@@ -503,11 +526,9 @@ export function listRequest(
     // 읽기는 완전 공개라 accessToken 을 넣지 않는다(R-9). 넣으면 이 화면이
     // 세션에 결합되는데 백엔드는 그 헤더를 아예 파싱하지 않는다.
     //
-    // `withAcceptLanguage` 는 `lib/jsonapi/` 의 것이다 - 이 저장소가
-    // `exactOptionalPropertyTypes` 라 "헤더가 없다" 를 키 삭제로만 표현할 수
-    // 있고, 그 관용구를 한 자리에 모아 둔 함수다(client.ts). 여기서 다시
-    // 만들면 그 판단이 두 벌이 된다.
-    options: withAcceptLanguage({ query }, acceptLanguage),
+    // (template-typescript-expo) Accept-Language 도 넣지 않는다 - 앱의 API 클라이언트
+    // (`platform/api.ts`)가 모든 요청에 싣는다(스펙 9.4).
+    options: { query },
   }
 }
 
@@ -555,6 +576,10 @@ function diagnosticOf(errors: readonly ErrorObject[]): string {
  *
  * ## 던지는 자리 셋 - 전부 `app/error.tsx` 로 간다
  *
+ * (template-typescript-expo) 첫째는 던지지 않는다 - `{ kind: 'unreachable' }` 을 돌려주고
+ * 화면이 앱 문구와 "다시 시도" 를 그린다(스펙 9.3, `ListFailure`). 남은 둘은 이 앱에서 Expo
+ * Router 의 ErrorBoundary 로 간다.
+ *
  * 1. **`'transport'`** - 백엔드가 응답조차 주지 못했다. D2 가 세운 계약이다
  *    (스펙 9.2). 합성 코드 문자열을 비교하지 않고 `actionForErrors` 의 분류로
  *    판정한다(`lib/jsonapi/AGENTS.md`).
@@ -585,33 +610,82 @@ function diagnosticOf(errors: readonly ErrorObject[]): string {
  * **`page.tsx` 가 같은 `plan` 변수를 `request()` 와 여기에 재사용하는 코드
  * 관례**다. 같은 종류의 무방비이고, `listRequest` 주석의 "남는 무방비" 절이
  * 그 범위를 갖는다.
+ *
+ * ## 쪽 여럿을 한 목록으로 (template-typescript-expo)
+ *
+ * 무한 스크롤이 읽은 쪽들을 순서대로 잇는다(스펙 8.3). 첫 쪽이 실패하면 그 실패가 화면 전부이고,
+ * 뒤따르는 쪽이 실패하면 읽은 행은 두고 `failure` 에 싣는다. 실패한 쪽 뒤에는 쪽이 없다 -
+ * `nextPageQuery` 가 실패한 쪽에서 `null` 을 준다. 같은 id 는 처음 나온 행만 남긴다 - 쪽을
+ * 읽는 사이 정렬 값이 바뀐 행은 두 쪽에 걸릴 수 있고, 목록의 키가 겹치면 React 가 오류를 낸다.
  */
 export function listView(
   resource: ResourceDefinition,
   plan: ListRequest,
-  result: JsonApiResult<CollectionDocument>,
+  pages: readonly JsonApiResult<CollectionDocument>[],
 ): ListView {
-  if (!result.ok) {
-    if (actionForErrors(result.errors) === 'transport') {
-      throw new Error(`목록 요청이 백엔드에 닿지 못했다: ${diagnosticOf(result.errors)}`)
+  const rows: ListRow[] = []
+  const seen = new Set<string>()
+  let failure: ListFailure | null = null
+
+  for (const [position, result] of pages.entries()) {
+    if (!result.ok) {
+      failure = failureOf('목록', result.errors)
+      if (position === 0) return failure
+      break
     }
-    const messages = bannerMessages(result.errors)
-    if (messages.length === 0) {
-      throw new Error(`목록 요청이 문구 없는 오류로 실패했다: ${diagnosticOf(result.errors)}`)
+
+    if (result.document === null) {
+      throw new Error(`목록 요청이 본문 없는 응답을 받았다: ${result.status}`)
     }
-    return { kind: 'banner', messages }
-  }
 
-  if (result.document === null) {
-    throw new Error(`목록 요청이 본문 없는 응답을 받았다: ${result.status}`)
+    for (const row of listRows(resource, result.document)) {
+      if (seen.has(row.id)) continue
+      seen.add(row.id)
+      rows.push(row)
+    }
   }
 
   return {
     kind: 'list',
     columns: listColumns(resource),
-    rows: listRows(resource, result.document),
+    rows,
     filtered: hasFilterParams(plan.query),
+    failure,
+  }
+}
+
+/**
+ * (template-typescript-expo) 오류 응답 하나 → 화면이 그릴 실패. 배너에 그릴 문구가 하나도 없으면
+ * 던진다 - 빈 배너는 아무 설명 없는 빈 화면이다(`listView` 의 "던지는 자리").
+ */
+function failureOf(request: string, errors: readonly ErrorObject[]): ListFailure {
+  if (actionForErrors(errors) === 'transport') return { kind: 'unreachable' }
+  const messages = bannerMessages(errors)
+  if (messages.length === 0) {
+    throw new Error(`${request} 요청이 문구 없는 오류로 실패했다: ${diagnosticOf(errors)}`)
   }
+  return { kind: 'banner', messages }
+}
+
+/**
+ * (template-typescript-expo) 무한 스크롤의 다음 요청 쿼리 - 응답의 `links.next` 가 담은 쿼리
+ * 그대로다(스펙 8.3). 커서를 만들지도 해석하지도 않는다 - `linkQuery` 가 문자열을 옮길 뿐이다.
+ *
+ * 더 읽을 것이 없으면 `null` 이다:
+ *
+ * - **링크가 없다.** 정본·Rails 는 `null` 로, NestJS 는 키를 지워서 말한다(R-10①) - 판정은
+ *   `linkPresent` 하나다.
+ * - **이 쪽이 비었다.** NestJS 는 커서 모드의 끝에서도 `next` 에 커서를 채워 보낸다(R-10①).
+ *   빈 쪽 뒤에 읽을 행은 없다 - 그 링크를 따라가면 빈 쪽을 한 번 더 부를 뿐이다.
+ * - **이 쪽이 실패했거나 본문이 없다.** 실패한 쪽 뒤로는 읽지 않는다(`listView` 의 `failure`).
+ * - **링크를 읽을 수 없다.** `linkQuery` 가 `null` 을 준다 - 던지지 않는다.
+ */
+export function nextPageQuery(result: JsonApiResult<CollectionDocument>): URLSearchParams | null {
+  if (!result.ok || result.document === null) return null
+  if (result.document.data.length === 0) return null
+  const next = result.document.links?.next
+  if (!linkPresent(next)) return null
+  return linkQuery(next)
 }
 
 /* ------------------------------------------------------------------------- *
@@ -1053,12 +1127,16 @@ export function filterFieldsKey(fields: readonly FilterField[]): string {
     .join('&')
 }
 
+/**
+ * (template-typescript-expo) 필터 시트가 들고 있는 값 - 파라미터 이름 → 값들. 원본의 `FormData`
+ * 자리다(스펙 6.2: 입력이 `FormData` 가 아니라 폼 상태 객체다). 한 이름에 값이 여럿인 것은
+ * 다중 선택이다 - `FormData.getAll` 과 같은 모양이다.
+ */
+export type FilterFormValues = Readonly<Record<string, readonly string[]>>
+
 /** 폼에서 이 이름의 값들. 공백만인 값과 빈 값은 **없는 것으로 친다.** */
-function formValues(form: FormData, name: string): readonly string[] {
-  return form
-    .getAll(name)
-    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
-    .filter((value) => value !== '')
+function formValues(form: FilterFormValues, name: string): readonly string[] {
+  return (form[name] ?? []).map((entry) => entry.trim()).filter((value) => value !== '')
 }
 
 /**
@@ -1129,7 +1207,7 @@ function formValues(form: FormData, name: string): readonly string[] {
 export function filterQuery(
   fields: readonly FilterField[],
   searchParams: SearchParams,
-  form: FormData,
+  form: FilterFormValues,
 ): URLSearchParams {
   const filters: FilterInput[] = []
   const owned = new Set<string>()
@@ -1196,6 +1274,46 @@ export function filterQuery(
   return query
 }
 
+/**
+ * (template-typescript-expo) 필터 시트를 열 때의 값 - 지금 URL 이 담은 조건 중 컨트롤이 그릴 수
+ * 있는 것. 원본에서는 입력의 `defaultValue` 가 이 일을 했다. 그대로 `filterQuery` 에 넘기면 URL
+ * 의 조건이 다시 나온다(시험이 고정한다).
+ */
+export function filterFormValues(fields: readonly FilterField[]): FilterFormValues {
+  const values: Record<string, readonly string[]> = {}
+  for (const field of fields) {
+    if (field.kind === 'select') {
+      values[field.parameter] = field.selected
+    } else if (field.kind === 'text') {
+      values[field.parameter] = field.value === '' ? [] : [field.value]
+    } else {
+      for (const bound of [field.lower, field.upper]) {
+        if (bound !== null) values[bound.parameter] = bound.value === '' ? [] : [bound.value]
+      }
+    }
+  }
+  return values
+}
+
+/**
+ * (template-typescript-expo) 필터 시트의 "적용" 이 갈 주소 - 이 화면의 주소에 `filterQuery` 를
+ * 붙인다. 원본에서는 `filter-bar.tsx` 가 같은 조립을 했다. 이 앱에는 컴포넌트 시험이 없어서
+ * (스펙 11.1) 조립을 여기 둔다.
+ *
+ * 주소의 인코딩은 `hrefWithQuery` 의 것이다 - 키와 값을 퍼센트 인코딩한다(`filter%5B...`).
+ * Expo Router 57 은 그 모양의 딥링크에서 대괄호 키를 평평한 키로 되살린다(D1 실측 M2). 앱 안의
+ * 이동도 같은 해석을 지난다 - 왕복은 test/unit/resources/view-expo.test.ts 가 라우터의 해석 순서
+ * 그대로 잰다.
+ */
+export function filterHref(
+  path: string,
+  fields: readonly FilterField[],
+  searchParams: SearchParams,
+  form: FilterFormValues,
+): string {
+  return hrefWithQuery(path, filterQuery(fields, searchParams, form))
+}
+
 /* ------------------------------------------------------------------------- *
  * 정렬 메뉴와 페이지 이동 (D3 Task 5)
  * ------------------------------------------------------------------------- */
@@ -1404,164 +1522,19 @@ export function sortOptions(
 }
 
 /**
- * 페이지 이동이 그릴 것 전부. **주소는 전부 이 화면의 주소**이지 백엔드 경로가
- * 아니다.
- *
- * 갈 수 없는 방향은 `null` 이다 - 컴포넌트는 `null` 이면 그 버튼을 그리지
- * 않는다. 비활성 버튼으로 두지 않은 이유: 눌러도 아무 일이 없는 버튼은 화면이
- * 멈춘 것처럼 보이고, 어차피 세 백엔드가 "없음" 을 서로 다르게 표현해서
- * (아래 `pageHref`) 있고 없고가 유일하게 믿을 수 있는 신호다.
- */
-export interface PaginationView {
-  /** 첫 쪽 주소. **첫 쪽에 있으면 `null`** - 아래 `paginationView` 참고. */
-  readonly first: string | null
-  readonly previous: string | null
-  readonly next: string | null
-  /** 지금 몇 쪽인가. 백엔드가 말해 주지 않으면(커서 모드 등) `null`. */
-  readonly page: number | null
-}
-
-/**
- * 백엔드가 준 링크 하나 → **이 화면의 주소.** 갈 수 없으면 `null`.
- *
- * ## `!= null` 이다 (`!== null` 이 아니다) — R-10①
- *
- * 없는 링크를 **정본과 Rails 는 `null` 로 주고 NestJS 는 키째 지운다.**
- * 지워진 키를 읽으면 `undefined` 이고, `undefined !== null` 은 **참**이라
- * 엄격 비교로 판정하면 NestJS 에서 "다음" 버튼이 **언제나 켜진다.** 눌러도
- * 같은 쪽에 머물거나 400 이 난다.
- *
- * **정본 픽스처만으로는 이 줄을 지킬 수 없다** - 정본은 언제나 다섯 키를 다
- * 보내므로 `!=` 와 `!==` 가 완전히 같게 동작한다. 그래서 테스트에 **NestJS
- * 모양**(prev·next·last 키가 아예 없는 `links`)을 따로 만들었다
- * (test/unit/resources/view.test.ts). 그 픽스처가 이 줄이 존재하는 이유다.
- *
- * ## 링크에서 가져오는 것은 **`page[...]` 뿐이다**
- *
- * 백엔드 링크는 `/api/v1/examples?...` 로 **백엔드 경로**다. 그대로 `href` 에
- * 쓰면 화면이 API 로 이동해 JSON 이 뜬다. 그리고 그 쿼리에는 이 화면이 소유하지
- * 않는 것도 섞여 있다 - `include` 는 요청마다 선언에서 다시 실리므로
- * (`listQuery`) 주소창에 남을 이유가 없다.
- *
- * 그래서 **지금 화면 URL 을 바탕으로 삼고, 링크에서는 위치만 가져온다.** 옛
- * `page[...]` 를 먼저 전부 버리는 것이 핵심이다 - 남겨 두면 같은 파라미터가
- * 두 번 나가서 400 이다. 링크의 page 조각은 그 자체로 완결돼 있다: 정본은
- * 요청하지 않은 `page[number]`·`page[size]` 까지 채워서 주고, `page[totals]`
- * 를 켰으면 그것도 함께 보존한다(2026-09-07 실측).
- *
- * **커서를 만들지도 파싱하지도 않는다**(스펙 8.3). `page[after]` 가 있으면
- * 값을 들여다보지 않고 문자열 그대로 옮긴다 - 이 함수는 offset 모드와 커서
- * 모드를 구별조차 하지 않는다.
- */
-/**
- * 링크가 "있다" 는 뜻인가. **`!= null` 이다(`!== null` 이 아니다)** - 바로 위
- * 문단의 근거 그대로다(R-10①). `pageHref`(이 화면 주소로 바꿀 값이 있는가)와
- * 참조 목록의 `referenceList`(더 있는가, D4 Task 4 아래) 둘 다 **이 함수
- * 하나로만** 판정한다 - 판정 규칙이 두 자리로 갈라지면 하나만 고치는 사고가
- * 난다.
+ * 링크가 "있다" 는 뜻인가. **`!= null` 이다(`!== null` 이 아니다)** - 없는 링크를 정본과
+ * Rails 는 `null` 로 주고 NestJS 는 키째 지운다(R-10①). 지워진 키는 `undefined` 라, 엄격
+ * 비교로 판정하면 NestJS 에서 언제나 "있다" 가 된다.
+ *
+ * (template-typescript-expo) 무한 스크롤의 `nextPageQuery`(더 읽을 것이 있는가)와 참조 목록의
+ * `referenceList`(더 있는가, D4 Task 4 아래) 둘 다 **이 함수 하나로만** 판정한다 - 판정 규칙이
+ * 두 자리로 갈라지면 하나만 고치는 사고가 난다. 원본의 쪽 이동(`pageHref`·`paginationView`)은
+ * offset 목록의 것이라 뺐다(스펙 8.3: 목록은 커서다).
  */
 function linkPresent(link: string | null | undefined): link is string {
   return link != null
 }
 
-export function pageHref(
-  path: string,
-  searchParams: SearchParams,
-  link: string | null | undefined,
-): string | null {
-  if (!linkPresent(link)) return null
-
-  const source = linkQuery(link)
-  if (source === null) return null
-
-  const query = carriedParams(searchParams, isPageParameter)
-  for (const [name, value] of source.entries()) {
-    if (isPageParameter(name)) query.append(name, value)
-  }
-  return hrefWithQuery(path, query)
-}
-
-/**
- * `links.self` 가 말하는 쪽 번호. 없거나 1 이상의 정수가 아니면 `null`.
- *
- * **요청한 값이 아니라 응답의 `self` 를 읽는다.** 우리가 보낸 쿼리에는
- * `page[number]` 가 아예 없을 수 있고(첫 쪽), 그때도 백엔드는 `self` 에
- * `page[number]=1` 을 채워서 준다(실측). 즉 `self` 쪽이 **실제로 서빙된 쪽**을
- * 말한다.
- *
- * 커서 모드에는 `page[number]` 가 없으므로 `null` 이 되고, 화면은 쪽 번호를
- * 그리지 않는다 - 커서 모드에 없는 개념을 지어내지 않는다.
- */
-function pageNumberOf(self: string | null | undefined): number | null {
-  if (self == null) return null
-
-  const source = linkQuery(self)
-  if (source === null) return null
-
-  const raw = source.get(pageParameter('number'))
-  if (raw === null) return null
-
-  const value = Number(raw)
-  return Number.isInteger(value) && value >= 1 ? value : null
-}
-
-/**
- * 응답 하나 → 페이지 이동이 그릴 것.
- *
- * ## 쿼리가 아니라 응답을 받는다
- *
- * 어디로 갈 수 있는지는 **백엔드만 안다** - 우리가 보낸 쿼리로는 다음 쪽이
- * 있는지 알 수 없다(총 개수를 받지 않으므로). 그래서 링크를 따라간다(스펙 8.3).
- *
- * `result` 를 통째로 받는 이유는 `page.tsx` 에서 갈래를 없애기 위해서다.
- * 오류이거나 본문이 없으면 링크가 없고, 그때 이 함수는 전부 `null` 을 낸다 -
- * 화면은 조건 없이 부르고 컴포넌트가 아무것도 그리지 않는다. 그 판정을
- * `page.tsx` 에 두면 RSC 라 아무 테스트도 보지 못한다(이 파일 머리말).
- *
- * ## `first` 는 첫 쪽에서 `null` 이다
- *
- * 링크에는 언제나 `first` 가 들어 있다(정본은 첫 쪽에서도 준다 - 실측). 그것을
- * 그대로 내면 첫 쪽에서 "처음으로" 버튼이 떠서, 눌러도 같은 자리인 버튼이
- * 생긴다. **뒤로 갈 수 없으면 처음으로 갈 이유도 없다**는 것이 판정이고,
- * `previous` 하나로 둘을 묶으면 커서 모드에서도 그대로 맞는다.
- *
- * 이 값은 빈 목록의 문구도 정한다 - `first` 가 `null` 이 아니면 "첫 쪽이
- * 아니다" 라는 뜻이라, 0건이 **범위를 벗어난 쪽**인지 자료가 없는 것인지
- * 구별된다(`resource-table.tsx`). 범위를 벗어난 쪽은 400 이 아니라 **0건
- * 200** 이라(2026-09-07 실측) 그 구별이 없으면 7건짜리 목록의 9쪽이
- * "아직 등록된 항목이 없습니다" 라고 말한다.
- *
- * ## "마지막 쪽으로" 를 만들지 않았다
- *
- * **`links.last` 는 기본값에서 언제나 `null` 이다**(R-7, 2026-09-07 재확인).
- * 백엔드가 COUNT 를 피하려고 그렇게 만들었고, 채우려면 요청마다
- * `page[totals]=true` 를 보내야 한다 - 스펙 8.3 이 **기본으로 켜지 말라**고
- * 못박은 그 파라미터다(실제로 켜 보면 `meta.totalCount` 가 생기고 `last` 가
- * 채워진다 - 실측).
- *
- * 그 대가로 사는 것이 버튼 하나뿐이다. 이 화면은 총 개수를 어디에도 표시하지
- * 않으므로(`listQuery` 의 같은 절) COUNT 의 결과 중 쓰는 것이 없다. 뒤집힐
- * 조건: 이 화면이 총 개수나 전체 쪽 수를 실제로 표시하기로 하는 날 -
- * 그때는 이미 켜야 하므로 버튼도 함께 온다.
- */
-export function paginationView(
-  path: string,
-  searchParams: SearchParams,
-  result: JsonApiResult<CollectionDocument>,
-): PaginationView {
-  // `document !== null` 로 좁힌다 - `status` 로는 좁혀지지 않는다(`listView`).
-  const links: Links | undefined =
-    result.ok && result.document !== null ? result.document.links : undefined
-  const previous = pageHref(path, searchParams, links?.prev)
-
-  return {
-    first: previous === null ? null : pageHref(path, searchParams, links?.first),
-    previous,
-    next: pageHref(path, searchParams, links?.next),
-    page: pageNumberOf(links?.self),
-  }
-}
-
 /**
  * "필터 지우기" 가 갈 주소.
  *
@@ -1652,8 +1625,9 @@ export interface DetailField extends DetailLabel {
  */
 export type DetailView =
   | { kind: 'detail'; heading: string; fields: readonly DetailField[] }
-  | { kind: 'banner'; messages: readonly string[] }
   | { kind: 'notFound' }
+  // (template-typescript-expo) 배너와 닿지 못함 - 목록과 같은 두 실패다(`ListFailure`).
+  | ListFailure
 
 /**
  * 상세 요청 하나. **`ListRequest` 와 달리 `query` 를 따로 들지 않는다** -
@@ -1829,16 +1803,13 @@ export function detailFields(
  * 열었다.** 프레임워크의 URL 디코딩 단계라 이 템플릿이 손댈 자리가 아니다 -
  * 사실로 기록만 한다.
  */
-export function detailRequest(
-  resource: ResourceDefinition,
-  id: string,
-  acceptLanguage: string | null,
-): DetailRequest {
+export function detailRequest(resource: ResourceDefinition, id: string): DetailRequest {
   const query = buildQuery({ include: resource.includes })
   return {
     path: resourcePath(resource, id),
     // 읽기는 완전 공개라 accessToken 을 넣지 않는다(R-9). `listRequest` 와 같다.
-    options: withAcceptLanguage({ query }, acceptLanguage),
+    // (template-typescript-expo) Accept-Language 는 `platform/api.ts` 가 싣는다(스펙 9.4).
+    options: { query },
   }
 }
 
@@ -1885,6 +1856,9 @@ export function detailRequest(
  *
  * ## 던지는 자리 넷
  *
+ * (template-typescript-expo) `'transport'` 는 던지지 않고 `{ kind: 'unreachable' }` 이다 -
+ * `listView` 와 같다(`ListFailure`). 404 판정보다 앞선다(`actionForErrors` 의 우선순위).
+ *
  * `listView` 의 셋(transport · 본문 없는 성공 응답 · 문구 없는 오류 문서)에
  * **`data: null`** 이 하나 더 붙는다. 단건 GET 에서 "자원이 없다" 를 말하는
  * 방법은 404 뿐이고(R-8), 200 인데 `data` 가 `null` 인 것은 계약 밖이다. 그것을
@@ -1906,17 +1880,8 @@ export function detailView(
   result: JsonApiResult<SingleDocument>,
 ): DetailView {
   if (!result.ok) {
-    const action = actionForErrors(result.errors)
-    if (action === 'transport') {
-      throw new Error(`상세 요청이 백엔드에 닿지 못했다: ${diagnosticOf(result.errors)}`)
-    }
-    if (action === 'notFound') return { kind: 'notFound' }
-
-    const messages = bannerMessages(result.errors)
-    if (messages.length === 0) {
-      throw new Error(`상세 요청이 문구 없는 오류로 실패했다: ${diagnosticOf(result.errors)}`)
-    }
-    return { kind: 'banner', messages }
+    if (actionForErrors(result.errors) === 'notFound') return { kind: 'notFound' }
+    return failureOf('상세', result.errors)
   }
 
   if (result.document === null) {
@@ -2002,22 +1967,14 @@ export interface ReferenceRequest {
  *
  * 선택기는 "첫 쪽" 만 본다 - 쪽 이동 UI 가 없다(W-11 의 귀결: 넘치면 잘림을
  * 알릴 뿐 다음 쪽으로 가는 길을 만들지 않는다). `page[number]` 를 생략하면
- * 백엔드가 1 로 채운다(`pageNumberOf` 주석의 같은 실측).
+ * 백엔드가 1 로 채운다(원본 `pageNumberOf` 주석의 같은 실측 - 이 앱은 그 함수를 뺐다).
  *
  * ## `accessToken` 이 없다 - 공개 읽기다(W-11)
  *
  * 참조 자원 조회는 인증이 필요 없다 - `listRequest`·`detailRequest` 와 같은
  * 이유(R-9)로 넣지 않는다.
  */
-export function referenceRequest(
-  target: ResourceDefinition,
-  // `listRequest`·`detailRequest` 와 같은 타입이다 - `headers().get(...)` 이
-  // 주는 값을 그대로 받는다. 브리핑의 스케치는 `string` 이라고만 적었지만,
-  // `withAcceptLanguage` 자체가 `string | null | undefined` 를 받도록
-  // 만들어진 이유가 바로 이 호출부들이라 그것과 갈라 둘 이유가 없다(계획서의
-  // 스케치와 의도적으로 어긋난 자리).
-  acceptLanguage: string | null,
-): ReferenceRequest {
+export function referenceRequest(target: ResourceDefinition): ReferenceRequest {
   const query = buildQuery({
     sort: [{ name: 'name', descending: false }],
     page: { size: REFERENCE_PAGE_SIZE },
@@ -2026,7 +1983,8 @@ export function referenceRequest(
     path: target.path,
     query,
     // 읽기는 완전 공개라 accessToken 을 넣지 않는다(R-9, W-11).
-    options: withAcceptLanguage({ query }, acceptLanguage),
+    // (template-typescript-expo) Accept-Language 는 `platform/api.ts` 가 싣는다(스펙 9.4).
+    options: { query },
   }
 }
 
@@ -2042,7 +2000,7 @@ export function referenceRequest(
  * `truncated: false`. 이 자리를 던지게 바꾸면 참조 자원 하나의 결함이 쓰기
  * 화면 전체를 `app/error.tsx` 로 보낸다.
  *
- * ## 잘림 판정은 `pageHref` 와 같은 함수를 공유한다(R-10①)
+ * ## 잘림 판정은 `nextPageQuery` 와 같은 함수를 공유한다(R-10①)
  *
  * 없는 `next` 를 정본·Rails 는 `null` 로 주고 NestJS 는 키째 지운다 - 위
  * `linkPresent` 주석과 같은 자리다. 판정 규칙이 두 자리로 갈라지면 하나만
```

```bash
git apply --check .maestro-output/d3-view.patch && git apply .maestro-output/d3-view.patch
pnpm exec vitest run test/unit/resources/view-expo.test.ts 2>&1 | tail -4
pnpm exec vitest run test/unit/resources/view.test.ts 2>&1 | tail -4
```

Expected: 새 시험 PASS 24. 원본 시험은 FAIL(46 실패·130 통과) — 원본 시험이 언어 인자·응답 하나의 `listView`·쪽 이동을 부른다. 다음 단계가 고친다.

- [ ] **Step 5: 원본 시험에 패치를 붙이고 새 시험이 무는지 본다**

아래 패치를 `.maestro-output/d3-view-test.patch` 에 쓰고 붙인다.

```diff
diff --git a/test/unit/resources/view.test.ts b/test/unit/resources/view.test.ts
index 112924d..437c37e 100644
--- a/test/unit/resources/view.test.ts
+++ b/test/unit/resources/view.test.ts
@@ -13,7 +13,8 @@
  */
 
 import { describe, expect, it } from 'vitest'
-import type { ErrorObject, SingleDocument } from '@/lib/jsonapi/document'
+import type { JsonApiResult } from '@/lib/jsonapi/client'
+import type { CollectionDocument, ErrorObject, SingleDocument } from '@/lib/jsonapi/document'
 import { filterParameter, parseSortToken } from '@/lib/jsonapi/query'
 import { defineResource, type AttributeDefinition } from '@/lib/resources/define'
 import { EXAMPLE_CATEGORY } from '@/lib/resources'
@@ -35,13 +36,12 @@ import {
   listRequest,
   listRows,
   listView,
-  pageHref,
-  paginationView,
   REFERENCE_PAGE_SIZE,
   referenceList,
   referenceRequest,
   sortOptions,
   type FilterField,
+  type FilterFormValues,
   type SortOption,
 } from '@/lib/resources/view'
 
@@ -343,6 +343,8 @@ describe('listQuery — 나가는 쿼리 전체', () => {
       ['filter[probeTitle][contains]', 'PROBE 조각'],
       ['sort', '-probeTitle'],
       ['page[size]', '3'],
+      // (template-typescript-expo) 커서의 입구 - 목록은 커서다(스펙 8.3).
+      ['page[after]', ''],
       ['include', 'probeOwner,probeMarks'],
     ])
   })
@@ -350,7 +352,7 @@ describe('listQuery — 나가는 쿼리 전체', () => {
   it('URL 에 이미 include 가 있으면 붙이지 않고 덮는다', () => {
     // append 하면 중복 include 가 되어 백엔드가 400 으로 거절한다(R-8).
     const query = listQuery(probeGadget(), { include: 'probeOwner' })
-    expect([...query.entries()]).toEqual([['include', 'probeOwner,probeMarks']])
+    expect(query.getAll('include')).toEqual(['probeOwner,probeMarks'])
   })
 
   it('page[totals] 를 켜지 않는다', () => {
@@ -366,30 +368,28 @@ describe('listQuery — 나가는 쿼리 전체', () => {
 
   it('관계가 없는 자원에는 include 를 붙이지 않는다', () => {
     // 참조 자원에 ?include= 를 붙이는 것 자체가 400 이다(R-5).
-    expect([...listQuery(probeLeaflet(), {}).entries()]).toEqual([])
+    expect(listQuery(probeLeaflet(), {}).has('include')).toBe(false)
   })
 
   it('관계가 없는 자원이어도 URL 의 include 는 그대로 보낸다', () => {
     // 스펙 8.1: 프론트가 미리 걸러내면 백엔드 계약이 어떻게 반응하는지 볼 수
     // 없게 된다. 덮을 것이 없으므로 그대로 나간다.
-    expect([...listQuery(probeLeaflet(), { include: 'probeNothing' }).entries()]).toEqual([
-      ['include', 'probeNothing'],
+    expect(listQuery(probeLeaflet(), { include: 'probeNothing' }).getAll('include')).toEqual([
+      'probeNothing',
     ])
   })
 
   it('값이 undefined 인 파라미터를 떨어뜨린다', () => {
     const query = listQuery(probeLeaflet(), { sort: undefined, 'filter[probeLabel]': 'PROBE' })
-    expect([...query.entries()]).toEqual([['filter[probeLabel]', 'PROBE']])
+    expect(query.has('sort')).toBe(false)
+    expect(query.getAll('filter[probeLabel]')).toEqual(['PROBE'])
   })
 
   it('같은 이름이 여럿인 파라미터를 그대로 실어 보낸다', () => {
     // 백엔드는 중복 sort 를 400 으로 거절한다(R-8). 프론트가 미리 손보지
     // 않는 것이 스펙 8.1 이다.
     const query = listQuery(probeLeaflet(), { sort: ['probeLabel', '-probeLabel'] })
-    expect([...query.entries()]).toEqual([
-      ['sort', 'probeLabel'],
-      ['sort', '-probeLabel'],
-    ])
+    expect(query.getAll('sort')).toEqual(['probeLabel', '-probeLabel'])
   })
 })
 
@@ -539,37 +539,39 @@ describe('listRequest — 화면이 부르는 조립 전부', () => {
    * `toEqual` 로 고정한다 - 값은 전부 실전과 다른 `probe*` 다.
    */
   it('경로 · 쿼리 · 옵션 셋을 한꺼번에 만든다', () => {
-    const plan = listRequest(
-      probeGadget(),
-      { 'filter[probeTitle][contains]': 'PROBE 조각', utm_source: 'probe-campaign' },
-      'probe-lang',
-    )
+    const plan = listRequest(probeGadget(), {
+      'filter[probeTitle][contains]': 'PROBE 조각',
+      utm_source: 'probe-campaign',
+    })
 
     expect(plan.path).toBe('/probe/api/gadgets')
     expect([...plan.query.entries()]).toEqual([
       ['filter[probeTitle][contains]', 'PROBE 조각'],
+      ['page[after]', ''],
+      ['page[size]', '20'],
       ['include', 'probeOwner,probeMarks'],
     ])
-    expect(plan.options).toEqual({ query: plan.query, acceptLanguage: 'probe-lang' })
+    // (template-typescript-expo) 옵션에 Accept-Language 가 없다 - platform/api.ts 가 싣는다.
+    expect(plan.options).toEqual({ query: plan.query })
     // 옵션에 실린 쿼리가 **같은 객체**여야 한다 - 두 벌이면 화면이 보낸 것과
     // `filtered` 판정이 갈릴 수 있고, 그 어긋남은 RSC 라 아무도 못 본다.
     expect(plan.options.query).toBe(plan.query)
   })
 
   it('accessToken 을 넣지 않는다 - 읽기는 완전 공개다(R-9)', () => {
-    expect(listRequest(probeGadget(), {}, 'probe-lang').options.accessToken).toBeUndefined()
+    expect(listRequest(probeGadget(), {}).options.accessToken).toBeUndefined()
   })
 
-  it('Accept-Language 가 없으면 키 자체를 빼고 옵션을 만든다', () => {
-    // exactOptionalPropertyTypes 라 `{acceptLanguage: undefined}` 는 "없음" 이
-    // 아니다 - client.ts 의 withAcceptLanguage 가 그 구별을 소유한다.
-    expect('acceptLanguage' in listRequest(probeGadget(), {}, null).options).toBe(false)
+  it('Accept-Language 를 싣지 않는다 - 앱의 API 클라이언트 한 곳이 싣는다(스펙 9.4)', () => {
+    // (template-typescript-expo) 조립 함수가 언어를 인자로 받으면 그 인자를 null 로 바꾸는
+    // 뮤턴트가 게이트를 통과한다(원본 저장소의 측정). 싣는 자리는 platform/api.ts 하나다.
+    expect('acceptLanguage' in listRequest(probeGadget(), {}).options).toBe(false)
   })
 
   it('경로를 선언에서 가져온다 - type 에서 유도하지 않는다(R-1)', () => {
     // probeLeaflet 의 path 에는 type 이 들어 있지 않다. 한쪽만 재면 두 필드가
     // 뒤바뀐 배선을 볼 수 없다.
-    expect(listRequest(probeLeaflet(), {}, null).path).toBe(probeLeaflet().path)
+    expect(listRequest(probeLeaflet(), {}).path).toBe(probeLeaflet().path)
     expect(probeLeaflet().path).not.toContain(probeLeaflet().type)
   })
 })
@@ -582,8 +584,14 @@ describe('listView — 응답에서 화면 상태로', () => {
     options: {},
   })
 
+  /** (template-typescript-expo) 쪽 하나짜리 목록 - 원본의 `listView` 는 응답 하나를 받았다. */
+  const listViewOf = (
+    request: ReturnType<typeof plan>,
+    result: JsonApiResult<CollectionDocument>,
+  ) => listView(probeGadget(), request, [result])
+
   it('성공 응답을 목록으로 만든다', () => {
-    const view = listView(probeGadget(), plan(), {
+    const view = listViewOf(plan(), {
       ok: true,
       status: 200,
       document: probeDocument(),
@@ -592,22 +600,23 @@ describe('listView — 응답에서 화면 상태로', () => {
     expect(view.columns).toEqual(listColumns(probeGadget()))
     expect(view.rows.map((row) => row.id)).toEqual(['probe-g1', 'probe-g2'])
     expect(view.filtered).toBe(false)
+    expect(view.failure).toBe(null)
   })
 
   it('빈 목록도 열은 그대로 갖는다', () => {
-    const view = listView(probeGadget(), plan(), { ok: true, status: 200, document: { data: [] } })
+    const view = listViewOf(plan(), { ok: true, status: 200, document: { data: [] } })
     if (view.kind !== 'list') throw new Error('목록이어야 한다')
     expect(view.rows).toEqual([])
     expect(view.columns.length).toBeGreaterThan(0)
   })
 
   it('필터가 걸린 쿼리였는지 화면에 알려준다', () => {
-    const filtered = listView(probeGadget(), plan('filter[probeTitle][contains]=PROBE'), {
+    const filtered = listViewOf(plan('filter[probeTitle][contains]=PROBE'), {
       ok: true,
       status: 200,
       document: { data: [] },
     })
-    const unfiltered = listView(probeGadget(), plan('sort=probeTitle'), {
+    const unfiltered = listViewOf(plan('sort=probeTitle'), {
       ok: true,
       status: 200,
       document: { data: [] },
@@ -618,7 +627,7 @@ describe('listView — 응답에서 화면 상태로', () => {
   })
 
   it('백엔드 오류는 배너다', () => {
-    const view = listView(probeGadget(), plan(), {
+    const view = listViewOf(plan(), {
       ok: false,
       status: 400,
       errors: [probeError()],
@@ -626,12 +635,13 @@ describe('listView — 응답에서 화면 상태로', () => {
     expect(view).toEqual({ kind: 'banner', messages: ['PROBE 조회 오류'] })
   })
 
-  it('합성 오류(transport)는 던져서 error.tsx 로 보낸다', () => {
+  it('합성 오류(transport)는 unreachable 이다 - 화면이 앱 문구와 다시 시도를 그린다', () => {
     // 스펙 9.2 · D2 의 계약. 배너로 그리면 "백엔드에 닿지 못했다" 를 화면이
-    // 정상 오류인 것처럼 보여준다.
-    expect(() =>
-      listView(probeGadget(), plan(), { ok: false, status: 0, errors: [probeSyntheticError()] }),
-    ).toThrow()
+    // 정상 오류인 것처럼 보여준다. (template-typescript-expo) 원본은 던져서 error.tsx 로
+    // 보냈다 - 이 앱은 던지지 않고 스펙 9.3 의 "다시 시도" 를 그린다.
+    expect(listViewOf(plan(), { ok: false, status: 0, errors: [probeSyntheticError()] })).toEqual({
+      kind: 'unreachable',
+    })
   })
 
   it('합성 여부는 code 문자열이 아니라 표시로 판정한다', () => {
@@ -639,7 +649,7 @@ describe('listView — 응답에서 화면 상태로', () => {
     // 위 테스트와 이 테스트가 같은 답을 낸다.
     const withoutMarker: ErrorObject = { ...probeSyntheticError() }
     delete withoutMarker.meta
-    const view = listView(probeGadget(), plan(), {
+    const view = listViewOf(plan(), {
       ok: false,
       status: 0,
       errors: [withoutMarker],
@@ -651,16 +661,14 @@ describe('listView — 응답에서 화면 상태로', () => {
     // 배너를 그려도 FormBanner 가 빈 배열에 null 이라 사용자는 아무 설명 없는
     // 빈 화면을 본다.
     expect(() =>
-      listView(probeGadget(), plan(), { ok: false, status: 400, errors: [{ status: '400' }] }),
+      listViewOf(plan(), { ok: false, status: 400, errors: [{ status: '400' }] }),
     ).toThrow()
   })
 
   it('본문 없는 성공 응답(204)은 던진다', () => {
     // 컬렉션 GET 에 올 수 없는 응답이다. 빈 목록으로 다루면 깨진 백엔드가
     // "자료 없음" 으로 위장한다.
-    expect(() =>
-      listView(probeGadget(), plan(), { ok: true, status: 204, document: null }),
-    ).toThrow()
+    expect(() => listViewOf(plan(), { ok: true, status: 204, document: null })).toThrow()
   })
 })
 
@@ -824,12 +832,14 @@ function fieldById(
   return field
 }
 
-function probeForm(entries: Record<string, string | readonly string[]>): FormData {
-  const form = new FormData()
-  for (const [name, value] of Object.entries(entries)) {
-    for (const item of typeof value === 'string' ? [value] : value) form.append(name, item)
-  }
-  return form
+/** (template-typescript-expo) 원본은 FormData 를 만들었다 - 이 앱의 폼 값은 상태 객체다(스펙 6.2). */
+function probeForm(entries: Record<string, string | readonly string[]>): FilterFormValues {
+  return Object.fromEntries(
+    Object.entries(entries).map(([name, value]) => [
+      name,
+      typeof value === 'string' ? [value] : value,
+    ]),
+  )
 }
 
 describe('filterFields — 선언이 컨트롤을 정한다', () => {
@@ -1562,223 +1572,6 @@ describe('sortOptions — 선언이 항목을 정한다', () => {
   })
 })
 
-/**
- * **정본 모양**의 링크(R-10①). 다섯 키가 전부 있고 없는 것은 `null` 이다.
- *
- * 값은 실제 정본이 내는 모양 그대로다 - 원래 쿼리를 보존하고 `page` 계열만
- * 갈아 끼우며, 요청하지 않은 `page[number]`·`page[size]` 까지 채워서 준다
- * (2026-09-07 실측). 경로는 백엔드 경로이지 화면 경로가 아니다.
- */
-function canonicalLinks(number: number, hasPrev: boolean, hasNext: boolean) {
-  const at = (page: number) =>
-    `/probe/api/dials?include=probeOwner&page[number]=${page}&page[size]=3`
-  return {
-    self: at(number),
-    first: at(1),
-    prev: hasPrev ? at(number - 1) : null,
-    next: hasNext ? at(number + 1) : null,
-    // 기본값에서는 언제나 null 이다 - 백엔드가 COUNT 를 피한다(R-7, 재확인).
-    last: null,
-  }
-}
-
-function okResult(links: Record<string, string | null> | undefined) {
-  return {
-    ok: true as const,
-    status: 200,
-    document: { data: [], ...(links === undefined ? {} : { links }) },
-  }
-}
-
-describe('pageHref — 백엔드 링크를 화면 주소로', () => {
-  it('링크의 page 조각만 가져오고 나머지는 지금 URL 에서 온다', () => {
-    // 백엔드 링크는 `/probe/api/dials?...` 로 **백엔드 경로**다. 그대로 href 에
-    // 쓰면 화면이 API 로 이동해 JSON 이 뜬다. 그리고 링크에 실린 include 는 이
-    // 화면이 매 요청마다 선언에서 다시 싣는 값이라 주소창에 남을 이유가 없다.
-    expect(
-      pageHref(
-        DIAL_PATH,
-        { 'filter[probeName][contains]': 'PROBE 조각', sort: '-probeCount' },
-        '/probe/api/dials?include=probeOwner&page[number]=2&page[size]=3',
-      ),
-    ).toBe(
-      `${DIAL_PATH}?${new URLSearchParams([
-        ['filter[probeName][contains]', 'PROBE 조각'],
-        ['sort', '-probeCount'],
-        ['page[number]', '2'],
-        ['page[size]', '3'],
-      ]).toString()}`,
-    )
-  })
-
-  it('지금 URL 에 있던 page 값을 먼저 버린다', () => {
-    // 남겨 두고 더하면 같은 파라미터가 두 번 나가서 400 이다.
-    const href = pageHref(
-      DIAL_PATH,
-      { 'page[number]': '9', 'page[size]': '99', 'page[totals]': 'true' },
-      '/probe/api/dials?page[number]=2&page[size]=3',
-    )
-    expect([...new URLSearchParams(href?.split('?')[1] ?? '').entries()]).toEqual([
-      ['page[number]', '2'],
-      ['page[size]', '3'],
-    ])
-  })
-
-  it('커서를 파싱하지 않고 문자열 그대로 옮긴다', () => {
-    // 스펙 8.3 - 커서는 opaque 다. 이 함수는 offset 모드와 커서 모드를
-    // 구별조차 하지 않는다.
-    const href = pageHref(DIAL_PATH, {}, '/probe/api/dials?page[after]=cHJvYmUtY3Vyc29y')
-    expect(new URLSearchParams(href?.split('?')[1] ?? '').get('page[after]')).toBe(
-      'cHJvYmUtY3Vyc29y',
-    )
-  })
-
-  it('링크가 없으면 null 이다 — null 도 undefined 도', () => {
-    // **이 줄이 R-10① 의 가드다.** 정본·Rails 는 없는 링크를 `null` 로 주고
-    // NestJS 는 **키째 지운다**(`undefined`). `!== null` 로 판정하면
-    // `undefined !== null` 이 참이라 NestJS 에서 버튼이 언제나 켜진다.
-    expect(pageHref(DIAL_PATH, {}, null)).toBe(null)
-    expect(pageHref(DIAL_PATH, {}, undefined)).toBe(null)
-  })
-
-  it('읽을 수 없는 링크는 null 이다 - 던지지 않는다', () => {
-    // 던지면 이동 버튼 하나 때문에 목록 전체가 죽는다.
-    expect(pageHref(DIAL_PATH, {}, 'http://[probe')).toBe(null)
-  })
-
-  it('page 조각이 없는 링크는 지금 조건만 남긴다', () => {
-    expect(pageHref(DIAL_PATH, { sort: '-probeCount' }, '/probe/api/dials')).toBe(
-      `${DIAL_PATH}?sort=-probeCount`,
-    )
-  })
-
-  it('경로를 박지 않았다', () => {
-    expect(pageHref('/probe/elsewhere', {}, '/probe/api/dials?page[number]=2')).toBe(
-      '/probe/elsewhere?page%5Bnumber%5D=2',
-    )
-  })
-})
-
-describe('paginationView — 링크를 따라간다', () => {
-  it('가운데 쪽에서는 세 방향이 다 있다', () => {
-    const view = paginationView(DIAL_PATH, {}, okResult(canonicalLinks(2, true, true)))
-    expect(view.page).toBe(2)
-    expect(view.previous).toBe(`${DIAL_PATH}?page%5Bnumber%5D=1&page%5Bsize%5D=3`)
-    expect(view.next).toBe(`${DIAL_PATH}?page%5Bnumber%5D=3&page%5Bsize%5D=3`)
-    expect(view.first).toBe(`${DIAL_PATH}?page%5Bnumber%5D=1&page%5Bsize%5D=3`)
-  })
-
-  it('첫 쪽에서는 처음·이전이 없다', () => {
-    // 링크에는 first 가 언제나 들어 있다(정본은 첫 쪽에서도 준다 - 실측).
-    // 그대로 내면 눌러도 같은 자리인 버튼이 생긴다.
-    const view = paginationView(DIAL_PATH, {}, okResult(canonicalLinks(1, false, true)))
-    expect(view.previous).toBe(null)
-    expect(view.first).toBe(null)
-    expect(view.next).not.toBe(null)
-  })
-
-  it('마지막 쪽에서는 다음이 없다', () => {
-    const view = paginationView(DIAL_PATH, {}, okResult(canonicalLinks(3, true, false)))
-    expect(view.next).toBe(null)
-    expect(view.previous).not.toBe(null)
-  })
-
-  it('**NestJS 모양** — 없는 링크의 키가 아예 없어도 버튼이 켜지지 않는다', () => {
-    // **이 픽스처가 `!= null` 가드가 존재하는 이유다.** 정본은 언제나 다섯 키를
-    // 다 보내므로 `!=` 와 `!==` 가 완전히 같게 동작한다 - 정본 픽스처만 쓰면 이
-    // 가드는 속이 빈다(R-10①). NestJS 는 없는 항목을 **키째 지운다**:
-    //
-    //   정본·Rails: {"self","first","prev","next","last"}  — 없는 것은 null
-    //   NestJS:     {"self","first"}                       — 세 키가 없다
-    //
-    // `undefined !== null` 이 참이라, 엄격 비교로 판정하면 "다음" 이 언제나
-    // 켜지고 눌러도 같은 쪽에 머문다.
-    const view = paginationView(
-      DIAL_PATH,
-      {},
-      okResult({
-        self: '/probe/api/dials?page[number]=1&page[size]=3',
-        first: '/probe/api/dials?page[number]=1&page[size]=3',
-      }),
-    )
-    expect(view.next).toBe(null)
-    expect(view.previous).toBe(null)
-    expect(view.first).toBe(null)
-    expect(view.page).toBe(1)
-  })
-
-  it('links 자체가 없어도 던지지 않는다', () => {
-    expect(paginationView(DIAL_PATH, {}, okResult(undefined))).toEqual({
-      first: null,
-      previous: null,
-      next: null,
-      page: null,
-    })
-  })
-
-  it('오류 응답에는 이동할 곳이 없다', () => {
-    // 화면은 조건 없이 이 함수를 부르고 컴포넌트가 아무것도 그리지 않는다.
-    // 그 판정을 page.tsx 에 두면 RSC 라 아무 테스트도 보지 못한다.
-    expect(
-      paginationView(DIAL_PATH, {}, { ok: false, status: 400, errors: [{ code: 'PROBE_BAD' }] }),
-    ).toEqual({ first: null, previous: null, next: null, page: null })
-  })
-
-  it('본문 없는 응답에도 이동할 곳이 없다', () => {
-    expect(paginationView(DIAL_PATH, {}, { ok: true, status: 204, document: null })).toEqual({
-      first: null,
-      previous: null,
-      next: null,
-      page: null,
-    })
-  })
-
-  it('쪽 번호는 요청이 아니라 응답의 self 에서 온다', () => {
-    // 첫 쪽에서는 우리가 보낸 쿼리에 page[number] 가 아예 없는데 백엔드는
-    // self 에 채워서 준다(실측). self 쪽이 **실제로 서빙된 쪽**을 말한다.
-    expect(
-      paginationView(DIAL_PATH, { 'page[number]': '77' }, okResult(canonicalLinks(2, true, true)))
-        .page,
-    ).toBe(2)
-  })
-
-  it('self 에 쪽 번호가 없으면 쪽을 그리지 않는다', () => {
-    // 커서 모드에는 쪽 번호라는 개념이 없다. 없는 것을 지어내지 않는다.
-    expect(
-      paginationView(
-        DIAL_PATH,
-        {},
-        okResult({ self: '/probe/api/dials?page[after]=cHJvYmU', prev: null, next: null }),
-      ).page,
-    ).toBe(null)
-  })
-
-  it('쪽 번호가 1 이상의 정수가 아니면 그리지 않는다', () => {
-    for (const raw of ['0', '-2', 'probe', '1.5', '']) {
-      expect(
-        paginationView(DIAL_PATH, {}, okResult({ self: `/probe/api/dials?page[number]=${raw}` }))
-          .page,
-      ).toBe(null)
-    }
-  })
-
-  it('지금 조건이 이동 주소에 그대로 실린다', () => {
-    const view = paginationView(
-      DIAL_PATH,
-      { 'filter[probeName][contains]': 'PROBE 조각', sort: '-probeCount', probeStray: 'probe-x' },
-      okResult(canonicalLinks(2, true, true)),
-    )
-    const query = new URLSearchParams(view.next?.split('?')[1] ?? '')
-    expect(query.get('filter[probeName][contains]')).toBe('PROBE 조각')
-    expect(query.get('sort')).toBe('-probeCount')
-    expect(query.get('probeStray')).toBe('probe-x')
-    expect(query.get('page[number]')).toBe('3')
-    // include 는 링크에 실려 있지만 화면 주소에는 남지 않는다 - 요청마다
-    // 선언에서 다시 실린다(`listQuery`).
-    expect(query.has('include')).toBe(false)
-  })
-})
-
 describe('clearFiltersHref — 필터 지우기가 갈 곳', () => {
   it('아무 조건도 없으면 경로 그대로다 - ? 를 남기지 않는다', () => {
     expect(clearFiltersHref(DIAL_PATH, {})).toBe(DIAL_PATH)
@@ -1986,46 +1779,45 @@ describe('detailFields — 자원 객체를 항목들로', () => {
 
 describe('detailRequest — 화면이 부르는 조립 전부', () => {
   it('경로 · 쿼리 · 옵션을 한꺼번에 만든다', () => {
-    const plan = detailRequest(probeGadget(), 'probe-g1', 'probe-lang')
+    const plan = detailRequest(probeGadget(), 'probe-g1')
 
     expect(plan.path).toBe('/probe/api/gadgets/probe-g1')
     expect(plan.options.query?.toString()).toBe('include=probeOwner%2CprobeMarks')
-    expect(plan.options.acceptLanguage).toBe('probe-lang')
+    // (template-typescript-expo) 옵션은 쿼리 하나다 - Accept-Language 는 platform/api.ts 가 싣는다.
+    expect(Object.keys(plan.options)).toEqual(['query'])
   })
 
   it('쿼리에 include 말고는 아무것도 없다 (R-8)', () => {
     // **단건 URL 은 include 말고 어떤 파라미터도 받지 않는다** - `page[size]=2`
     // 조차 400 이다. 목록처럼 URL 의 쿼리를 옮기면 상세가 통째로 배너가 된다.
-    const plan = detailRequest(probeGadget(), 'probe-g1', null)
+    const plan = detailRequest(probeGadget(), 'probe-g1')
     expect([...(plan.options.query ?? [])].map(([name]) => name)).toEqual(['include'])
   })
 
   it('관계가 없는 자원에는 include 도 싣지 않는다 (R-5)', () => {
     // 참조 자원에 `?include=` 를 붙이는 것 자체가 400 이다.
-    expect(detailRequest(probeLeaflet(), 'probe-l1', null).options.query?.toString()).toBe('')
+    expect(detailRequest(probeLeaflet(), 'probe-l1').options.query?.toString()).toBe('')
   })
 
   it('경로를 선언에서 가져온다 - type 에서 유도하지 않는다 (R-1)', () => {
-    expect(detailRequest(probeLeaflet(), 'probe-l1', null).path).toBe(
-      `${probeLeaflet().path}/probe-l1`,
-    )
+    expect(detailRequest(probeLeaflet(), 'probe-l1').path).toBe(`${probeLeaflet().path}/probe-l1`)
     expect(probeLeaflet().path).not.toContain(probeLeaflet().type)
   })
 
   it('id 를 경로 세그먼트로 이스케이프한다', () => {
     // id 는 URL 세그먼트에서 오는 사용자 입력이다. 그대로 이어 붙이면 `?` 뒤가
     // 쿼리가 되어 백엔드에 없는 파라미터를 주입한다.
-    const plan = detailRequest(probeGadget(), 'probe/g1?probeInjected=1', null)
+    const plan = detailRequest(probeGadget(), 'probe/g1?probeInjected=1')
     expect(plan.path).toBe('/probe/api/gadgets/probe%2Fg1%3FprobeInjected%3D1')
   })
 
   it('accessToken 을 넣지 않는다 - 읽기는 완전 공개다 (R-9)', () => {
-    const plan = detailRequest(probeGadget(), 'probe-g1', 'probe-lang')
+    const plan = detailRequest(probeGadget(), 'probe-g1')
     expect(plan.options.accessToken).toBeUndefined()
   })
 
-  it('Accept-Language 가 없으면 키 자체를 빼고 옵션을 만든다', () => {
-    expect('acceptLanguage' in detailRequest(probeGadget(), 'probe-g1', null).options).toBe(false)
+  it('Accept-Language 를 싣지 않는다 - 앱의 API 클라이언트 한 곳이 싣는다(스펙 9.4)', () => {
+    expect('acceptLanguage' in detailRequest(probeGadget(), 'probe-g1').options).toBe(false)
   })
 })
 
@@ -2111,22 +1903,23 @@ describe('detailView — 응답에서 화면 상태로', () => {
     })
   })
 
-  it('합성 오류(transport)는 던져서 error.tsx 로 보낸다', () => {
-    expect(() =>
+  it('합성 오류(transport)는 unreachable 이다 - 화면이 다시 시도를 그린다', () => {
+    // (template-typescript-expo) 원본은 던져서 error.tsx 로 보냈다(스펙 9.3).
+    expect(
       detailView(probeGadget(), { ok: false, status: 0, errors: [probeSyntheticError()] }),
-    ).toThrow()
+    ).toEqual({ kind: 'unreachable' })
   })
 
   it('404 와 transport 가 겹치면 transport 가 이긴다', () => {
     // `actionForErrors` 의 우선순위를 실제로 지나가는지 잰다 - code 문자열을
     // 직접 비교하는 구현이었다면 이 배열에서 404 로 접힌다.
-    expect(() =>
+    expect(
       detailView(probeGadget(), {
         ok: false,
         status: 0,
         errors: [probeNotFoundError(), probeSyntheticError()],
       }),
-    ).toThrow()
+    ).toEqual({ kind: 'unreachable' })
   })
 
   it('문구가 하나도 없는 오류 문서는 던진다', () => {
@@ -2148,14 +1941,15 @@ describe('detailView — 응답에서 화면 상태로', () => {
 
 describe('referenceRequest — 선택기가 부를 조립(D4 Task 4)', () => {
   it('경로 · 쿼리(page[size]=100, sort=name) · 옵션을 한꺼번에 만든다', () => {
-    const plan = referenceRequest(probeLeaflet(), 'probe-lang')
+    const plan = referenceRequest(probeLeaflet())
 
     expect(plan.path).toBe('/probe/api/leaflets')
     expect([...plan.query.entries()]).toEqual([
       ['sort', 'name'],
       ['page[size]', '100'],
     ])
-    expect(plan.options).toEqual({ query: plan.query, acceptLanguage: 'probe-lang' })
+    // (template-typescript-expo) 옵션에 Accept-Language 가 없다 - platform/api.ts 가 싣는다.
+    expect(plan.options).toEqual({ query: plan.query })
     // listRequest 와 같은 이유로 같은 객체인지도 잰다 - 두 벌이면 실제로 나간
     // 쿼리와 이 값이 갈릴 수 있다.
     expect(plan.options.query).toBe(plan.query)
@@ -2166,22 +1960,20 @@ describe('referenceRequest — 선택기가 부를 조립(D4 Task 4)', () => {
     // 함수는 리터럴 'name' 을 낸다. defaultSort 를 읽는 구현이었다면 이
     // 자리에서 'probeLabel' 이 나왔을 것이다.
     expect(probeLeaflet().defaultSort).toBe('probeLabel')
-    expect(referenceRequest(probeLeaflet(), null).query.get('sort')).toBe('name')
+    expect(referenceRequest(probeLeaflet()).query.get('sort')).toBe('name')
   })
 
   it('REFERENCE_PAGE_SIZE 는 100 이다 - 실측 상한을 넘기면 조용히 100 으로 깎인다(W-11)', () => {
     expect(REFERENCE_PAGE_SIZE).toBe(100)
-    expect(referenceRequest(probeLeaflet(), null).query.get('page[size]')).toBe('100')
+    expect(referenceRequest(probeLeaflet()).query.get('page[size]')).toBe('100')
   })
 
   it('accessToken 을 넣지 않는다 - 참조 자원 읽기는 완전 공개다(W-11)', () => {
-    expect(referenceRequest(probeLeaflet(), 'probe-lang').options.accessToken).toBeUndefined()
+    expect(referenceRequest(probeLeaflet()).options.accessToken).toBeUndefined()
   })
 
-  it('Accept-Language 가 없으면 키 자체를 뺀다', () => {
-    // exactOptionalPropertyTypes 라 `{acceptLanguage: undefined}` 는 "없음" 이
-    // 아니다 - withAcceptLanguage(client.ts)가 그 구별을 소유한다.
-    expect('acceptLanguage' in referenceRequest(probeLeaflet(), null).options).toBe(false)
+  it('Accept-Language 를 싣지 않는다 - 앱의 API 클라이언트 한 곳이 싣는다(스펙 9.4)', () => {
+    expect('acceptLanguage' in referenceRequest(probeLeaflet()).options).toBe(false)
   })
 })
 
@@ -2219,8 +2011,9 @@ describe('referenceList — 참조 목록 응답에서 선택기 보기로(D4 Ta
     // 다 보내므로 `!=` 와 `!==` 가 완전히 같게 동작한다 - 정본 픽스처만 쓰면
     // 이 가드는 속이 빈다. NestJS 는 없는 항목을 키째 지운다: `undefined
     // !== null` 이 참이라, 엄격 비교로 판정하면 언제나 "잘렸다" 가 된다.
-    // `pageHref` 의 NestJS 픽스처(위 paginationView 구역)와 같은 자리 -
-    // 판정 자체는 `linkPresent` 하나를 공유한다(view.ts 주석).
+    // (template-typescript-expo) 원본은 여기서 쪽 이동(`pageHref`)의 NestJS 픽스처를 가리켰다 -
+    // 쪽 이동을 뺀 이 앱에서는 `nextPageQuery` 의 NestJS 모양 시험(view-expo.test.ts)이 같은
+    // 판정(`linkPresent` 하나)을 잰다.
     const list = referenceList(probeLeaflet(), probeCollection({ self: '...', first: '...' }))
     expect(list.truncated).toBe(false)
   })
```

```bash
git apply --check .maestro-output/d3-view-test.patch && git apply .maestro-output/d3-view-test.patch
pnpm exec vitest run test/unit/resources/view.test.ts test/unit/resources/view-expo.test.ts 2>&1 | tail -4
```

Expected: PASS 182(158 + 24).

새 판단의 뮤턴트 넷이 시험에 걸리는지 한 번 본다(커밋하지 않는다 — 끝에 원래대로 돌린다):

```bash
node - <<'EOF'
const fs = require('node:fs')
const { execSync } = require('node:child_process')
const file = 'lib/resources/view.ts'
const original = fs.readFileSync(file, 'utf8')
const mutants = [
  'if (result.document.data.length === 0) return null',
  'if (seen.has(row.id)) continue',
  'if (isPagePositionParameter(name)) query.delete(name)',
  "query.set(pageParameter('after'), '')",
]
try {
  for (const line of mutants) {
    if (!original.includes(line)) throw new Error(`없는 줄: ${line}`)
    fs.writeFileSync(file, original.replace(line, '// mutant'))
    let out = ''
    try {
      out = execSync('pnpm exec vitest run test/unit/resources 2>&1', { encoding: 'utf8' })
    } catch (error) {
      out = String(error.stdout)
    }
    console.log(/Tests\s+\d+ failed/.test(out) ? 'killed ' : 'SURVIVED', line)
  }
} finally {
  fs.writeFileSync(file, original)
}
EOF
git diff --stat -- lib/resources/view.ts
```

Expected: `killed` 네 줄, 마지막 `git diff` 는 복사 뒤 패치까지의 변경만 보인다(뮤턴트가 남지 않았다).

- [ ] **Step 6: 출처 기록에 두 파일과 이탈 아홉을 적는다**

Write 도구로 `.maestro-output/d3-provenance.cjs` 를 아래 내용으로 쓰고 돌린다:

```js
const fs = require('node:fs')
const file = 'docs/provenance/copied-core.json'
const record = JSON.parse(fs.readFileSync(file, 'utf8'))
const VIEW = 'lib/resources/view.ts'
const VIEW_TEST = 'test/unit/resources/view.test.ts'
for (const path of [VIEW, VIEW_TEST]) {
  if (record.paths.includes(path)) throw new Error(`이미 있다: ${path}`)
  record.paths.push(path)
}
const OLD_NOTE = 'test/e2e/*.spec.ts, lib/resources/view.ts, 원본 루트 AGENTS.md'
if (!record.note.includes(OLD_NOTE)) throw new Error('note 의 문장이 예상과 다르다 - 손으로 고친다')
record.note = record.note.replace(OLD_NOTE, 'test/e2e/*.spec.ts, 원본 루트 AGENTS.md')
record.note +=
  " lib/resources/view.ts 의 주석이 말하는 page.tsx·RSC·headers()·app/error.tsx·filter-bar.tsx·loading.tsx·'Task N' 같은 자리도 원본 저장소의 것이다. lib/jsonapi/query.ts 의 주석이 가리키는 view.ts 의 쪽 이동(paginationView)은 이 저장소의 view.ts 에서 뺐다 - 목록은 커서다(스펙 8.3)."
record.divergences.push(
  {
    path: VIEW,
    what: 'listRequest·detailRequest·referenceRequest 가 acceptLanguage 인자를 받지 않고 옵션에 Accept-Language 를 싣지 않는다(withAcceptLanguage import 를 뺐다). 머리말의 그 설명 문단과 세 함수의 옵션 주석을 고쳤다.',
    why: '스펙 9.4 - Accept-Language 를 싣는 자리는 앱의 API 클라이언트(platform/api.ts) 한 곳이다. 조립 함수가 언어를 인자로 받으면 그 인자를 null 로 바꾸는 뮤턴트가 게이트를 통과한다(원본 저장소의 측정). 인증 호출이 전송을 주입받게 한 D2 의 결정과 같은 이유다.',
  },
  {
    path: VIEW,
    what: "목록을 커서로 바꿨다 - listQuery 가 URL 의 쪽 위치 파라미터(page[number]·page[after]·page[before])를 버리고 page[after]=(빈 값)를 싣고, URL 에 page[size] 가 없으면 LIST_PAGE_SIZE(20)를 싣는다. 다음 쿼리를 정하는 nextPageQuery 를 더했다(links.next 의 쿼리 그대로, 링크가 없거나 빈 쪽·실패한 쪽이면 null). offset 쪽 이동(PaginationView·pageHref·pageNumberOf·paginationView)을 뺐고, 쓰지 않게 된 import 둘(isPageParameter·Links)을 뺐다. linkPresent 의 주석을 그 소비자(nextPageQuery·referenceList)에 맞게 고쳤다.",
    why: '스펙 8.3 - 목록은 cursor 다(원본은 offset). 첫 요청은 page[after]= 와 page[size]=20, 다음은 links.next 의 query 를 그대로 따라가고 커서를 만들거나 해석하지 않는다. 빈 쪽을 끝으로 보는 것은 NestJS 가 커서 모드의 끝에서도 next 에 커서를 채워 보내기 때문이다(원본 계획의 R-10①).',
  },
  {
    path: VIEW,
    what: "listView 가 응답 하나가 아니라 쪽 배열을 받는다 - 쪽의 행을 순서대로 잇고 같은 id 는 처음 것만 남기며, 뒤따르는 쪽의 실패는 failure 에 싣는다(ListView 에 failure, ListFailure 타입). listView·detailView 가 닿지 못함(transport)을 던지지 않고 { kind: 'unreachable' } 을 돌려준다(공통 failureOf). DetailView 가 ListFailure 를 받는다.",
    why: "스펙 8.3 의 무한 스크롤과 스펙 9.3 - 백엔드가 응답조차 주지 못하면 앱 문구와 '다시 시도' 를 그린다. 원본은 던져서 app/error.tsx 로 보냈지만 이 앱에서 렌더 중 예외를 받는 Expo Router 의 ErrorBoundary 는 요청을 다시 보내지 않는다. 같은 id 를 한 번만 두는 것은 쪽을 읽는 사이 정렬 값이 바뀐 행이 두 쪽에 걸리면 목록의 키가 겹치기 때문이다.",
  },
  {
    path: VIEW,
    what: '필터의 입력이 FormData 가 아니라 FilterFormValues(파라미터 이름 → 값들)다 - formValues·filterQuery 의 타입을 바꿨다. 시트를 열 때의 값을 만드는 filterFormValues 와 적용 주소를 만드는 filterHref 를 더했다.',
    why: '스펙 6.2 - 입력이 FormData 가 아니라 폼 상태 객체다. filterHref 는 원본의 filter-bar.tsx 가 하던 주소 조립이다 - 이 앱에는 컴포넌트 시험이 없어서(스펙 11.1) 조립을 lib 에 둔다.',
  },
  {
    path: VIEW,
    what: "주석만 고쳤다 - referenceList 의 '잘림 판정은 pageHref 와 같은 함수를 공유한다' 를 nextPageQuery 로, referenceRequest 주석의 pageNumberOf 참조를 '원본 pageNumberOf 주석의 같은 실측 - 이 앱은 그 함수를 뺐다' 로 바꿨다.",
    why: '뺀 함수를 가리키는 주석이 이 파일 안에서 죽은 참조가 되지 않게 한다.',
  },
  {
    path: VIEW_TEST,
    what: "listRequest·detailRequest·referenceRequest 호출에서 언어 인자를 뺐고 옵션이 쿼리 하나인지 잰다. 'Accept-Language 가 없으면 키 자체를 뺀다' 시험 셋을 '싣지 않는다' 로 바꿨다.",
    why: '위 view.ts 의 Accept-Language 이탈을 따라간다.',
  },
  {
    path: VIEW_TEST,
    what: 'listQuery·listRequest 시험의 기대값에 커서의 입구(page[after]=·page[size]=20)가 들어간다. 쿼리 전체를 비교하던 listQuery 시험 다섯은 그 시험이 재는 파라미터만 본다(getAll·has).',
    why: 'view.ts 의 커서 이탈을 따라간다. 커서의 입구 자체는 test/unit/resources/view-expo.test.ts 가 잰다.',
  },
  {
    path: VIEW_TEST,
    what: 'listView 시험이 쪽 하나짜리 배열로 부른다(listViewOf). transport 시험 셋(listView 하나·detailView 둘)이 던지는지가 아니라 unreachable 인지 잰다. 성공 시험이 failure 가 null 인지 잰다. probeForm 이 FormData 대신 FilterFormValues 를 만든다.',
    why: 'view.ts 의 쪽 배열·unreachable·폼 상태 이탈을 따라간다.',
  },
  {
    path: VIEW_TEST,
    what: '쪽 이동 시험(pageHref 7개·paginationView 11개)과 그 도우미(canonicalLinks·okResult)를 지웠다. referenceList 시험 주석의 pageHref NestJS 픽스처 참조를 view-expo.test.ts 로 고쳤다.',
    why: 'view.ts 가 offset 쪽 이동을 뺐다(스펙 8.3). 같은 판정(linkPresent)의 NestJS 모양은 view-expo.test.ts 의 nextPageQuery 시험이 잰다.',
  },
)
fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`)
console.log(`경로 ${record.paths.length}개, 이탈 ${record.divergences.length}건`)
```

```bash
node .maestro-output/d3-provenance.cjs
node scripts/check-provenance.mjs
```

Expected: 경로가 둘, 이탈이 아홉 늘고 원본 그대로 수는 Step 1 과 같다(`복사 출처 기록 통과: 경로 46개, 이탈 28건, 원본 그대로 31개` — D2 의 끝 44·19·31 에서). `note 의 문장이 예상과 다르다` 로 멈추면 `note` 에서 `lib/resources/view.ts` 를 "이 저장소에 없다" 는 목록에서 빼는 뜻으로 손으로 고치고 다시 돌린다.

- [ ] **Step 7: 문서와 스펙 정정을 쓴다**

`lib/resources/AGENTS.md` — Edit, 찾을 것:

```markdown
목록·상세·폼 판단(`view.ts`·`form.ts`)은 그것을 쓰는 화면이 생길 때 같은 방식으로 복사한다.
```

바꿀 것:

```markdown
목록·상세 판단 `view.ts` 는 D3 가 복사했다 - 목록을 커서로(`listQuery`·`nextPageQuery`), 필터 입력을 폼
상태 객체로(`FilterFormValues`·`filterFormValues`·`filterHref`), 백엔드에 닿지 못함을 던지지 않는
`unreachable` 로 고쳤고 offset 쪽 이동을 뺐다. 요청 조립(`listRequest`·`detailRequest`·`referenceRequest`)은
Accept-Language 를 싣지 않는다 - 싣는 자리는 `platform/api.ts` 하나다(스펙 9.4). 이 저장소가 더한 판단의
시험은 `test/unit/resources/view-expo.test.ts` 다. 폼 판단 `form.ts` 는 쓰기 화면(D4)이 같은 방식으로 복사한다.

## 목록 주소의 인코딩

앱이 만드는 목록 주소(정렬·필터 적용·필터 지우기)는 `hrefWithQuery` 의 `URLSearchParams` 직렬화 그대로
키와 값을 퍼센트 인코딩한다(`filter%5Bstatus%5D=…`). Expo Router 57 은 그 모양의 대괄호 키를 평평한 키로
되살린다. 새 인코딩 코드를 만들지 않는다 - 규칙과 한계는 `docs/superpowers/notes/2026-09-30-d3-measurements.md`
의 L1.
```

루트 `AGENTS.md` — Edit, 찾을 것:

```markdown
  `listRequest()`·`detailRequest()`·`referenceRequest()`가 한다(`view.ts`를 복사할 때 들어온다).
```

바꿀 것:

```markdown
  `listRequest()`·`detailRequest()`·`referenceRequest()`(`lib/resources/view.ts`)가 한다.
```

`docs/superpowers/notes/2026-09-30-d3-measurements.md` 를 만든다:

````markdown
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
````

스펙 — 8.2 끝(`### 8.3 페이지네이션 배정` 바로 앞)에 더한다:

```markdown

> 정정(2026-09-30, D3): 대괄호 키의 인코딩 규칙 - 앱이 만드는 목록 주소(정렬 메뉴·필터 시트·필터 지우기)는
> `URLSearchParams` 의 직렬화 그대로 키와 값을 퍼센트 인코딩한다(`filter%5Bstatus%5D=active`). 0단계 실측
> M2 가 그 모양의 딥링크에서 두 단계 키까지 평평한 키로 돌아오는 것을 쟀고, 앱 안의 이동(`router.push(주소)`)도
> 같은 해석을 지난다. 인코딩하지 않은 링크는 한 단계 키만 쟀으므로 문서와 E2E 의 딥링크는 인코딩한 모양으로
> 쓴다. `useLocalSearchParams` 가 값을 한 번 더 디코딩해 값 안의 `%XX` 는 바뀐다(알고 넘어간다). 조건을 바꾸는
> 이동은 `router.push` 다 - 새 목록 화면이 쌓여 뒤로 가기가 이전 조건을 되살린다(`router.setParams` 는 기록을
> 남기지 않는다). 규칙·왕복 시험·근거는 `lib/resources/view.ts` 의 `filterHref`,
> `test/unit/resources/view-expo.test.ts`, `docs/superpowers/notes/2026-09-30-d3-measurements.md` 의 L1.
```

8.3 끝(`### 8.4 데이터 흐름` 바로 앞)에 더한다:

```markdown

> 정정(2026-09-30, D3): URL 에 실린 쪽 위치(`page[number]`·`page[after]`·`page[before]`)는 보내지 않는다 -
> 무한 스크롤은 언제나 커서의 입구에서 시작한다. `page[size]` 는 URL 에 있으면 그 값이다(없으면 20). 다음 쪽은
> `links.next` 의 쿼리 그대로이고, 빈 쪽을 받으면 링크가 있어도 끝이다 - NestJS 는 커서 모드의 끝에서도
> `next` 를 채워 보낸다. 판단은 `lib/resources/view.ts` 의 `listQuery`·`nextPageQuery`·`listView`(쪽 배열).
```

9.3 끝(`### 9.4 Accept-Language` 바로 앞)에 더한다:

```markdown

> 정정(2026-09-30, D3): 조회 화면에서 백엔드가 응답조차 주지 못하면 던지지 않는다 - `listView`·`detailView` 가
> `unreachable` 을 돌려주고 화면이 `UNUSABLE_RESPONSE_MESSAGE`(복사본, 앱 문구 하나)와 "다시 시도" 를 그린다.
> `ErrorBoundary` 는 요청을 다시 보내지 않아 그 자리가 될 수 없다. 문구 없는 오류 문서·본문 없는 성공 응답 같은
> 계약 위반만 던져 `ErrorBoundary` 로 간다. 무한 스크롤의 뒤따르는 쪽이 실패하면 읽은 행은 두고 목록 끝에
> 그린다.
```

- [ ] **Step 8: 정적 검사를 돌린다**

```bash
pnpm exec prettier --write test/unit/resources/view-expo.test.ts docs/provenance/copied-core.json
pnpm typecheck && pnpm lint && pnpm format:check && pnpm lint:secrets
./scripts/check-citations.sh app components lib platform queries test
node scripts/check-provenance.mjs
pnpm test 2>&1 | tail -4
```

Expected: 전부 exit 0. `pnpm test` 는 Step 1 때의 수에서 182 가 늘어난다(원본 시험 158, 새 시험 24 — 768 이면 950).

- [ ] **Step 9: 커밋한다**

```bash
git add lib/resources/view.ts lib/resources/AGENTS.md test/unit/resources docs/provenance/copied-core.json docs/superpowers/notes/2026-09-30-d3-measurements.md docs/superpowers/specs AGENTS.md
git status --short
git commit -m "feat: Next.js 템플릿의 목록·상세 판단을 복사하고 커서 목록·폼 상태·닿지 못함으로 고친다"
```

---

### Task 2: `queries/` — 캐시 키·무효화 표, 조회 훅, 앱 복귀·네트워크 복귀 재조회

**Files:**
- Create: `queries/keys.ts`, `queries/resources.ts`, `test/unit/queries/keys.test.ts`
- Modify: `platform/query-client.ts`(파일째), `queries/auth.ts`(로그아웃 콜백, `NETWORK_MODE` 주석), `app/_layout.tsx`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`(릴리스 대기 예외 빼기 — T10), `queries/AGENTS.md`, `platform/AGENTS.md`, 스펙 8.5 정정

**Interfaces:**
- Consumes: Task 1 의 `listRequest`·`listView`·`nextPageQuery`·`detailRequest`·`detailView`·`type ListView`·`type DetailView`; D2 의 `apiRequest: JsonApiSend`(`platform/api.ts`), `queryClient`(`platform/query-client.ts`), `useLogoutMutation`(`queries/auth.ts`)
- Produces:
  - `queries/keys.ts`: `RESOURCES_KEY = 'resources'`, `queryKeys.lists(type)`·`queryKeys.list(type, query)`·`queryKeys.detail(type, id)`, `type CacheWrite = { kind: 'create'; type } | { kind: 'update'; type; id } | { kind: 'delete'; type; id } | { kind: 'logout' }`, `type CacheEffect`, `cacheEffects(write): readonly CacheEffect[]`, `applyCacheEffects(client: QueryClient, effects): void`
  - `queries/resources.ts`: `useResourceList(resource, params): ResourceListState`(`view: ListView | null`·`loadingMore`·`refreshing`·`retrying`·`loadMore()`·`refresh()`·`retry()`), `useResourceDetail(resource, id): ResourceDetailState`(`view: DetailView | null`·`retrying`·`retry()`)
  - `platform/query-client.ts`: `queryClient`(`networkMode: 'offlineFirst'`), `useQueryRefetchTriggers(): void`

- [ ] **Step 1: 캐시 키와 무효화 표의 시험을 쓰고 실패를 본다**

`test/unit/queries/keys.test.ts`:

```ts
import { QueryClient } from '@tanstack/react-query'
import { afterEach, describe, expect, it } from 'vitest'

import { applyCacheEffects, cacheEffects, queryKeys, type CacheWrite } from '@/queries/keys'

/**
 * 캐시 키와 쓰기 뒤의 무효화 표(스펙 8.5). 표는 값으로 고정하고, 표가 캐시에 하는 일은 실제
 * QueryClient 로 잰다 - 키의 모양이 어긋나면(앞 조각이 다르면) 무효화가 아무것도 건드리지 않고도
 * 조용히 끝나기 때문이다.
 *
 * 자원 type 은 실전 값이 아니다(probe*).
 */
const TYPE = 'probeCrates'
const OTHER = 'probeBins'

describe('queryKeys', () => {
  it('목록 하나의 키는 그 자원의 목록 전부의 키로 시작한다', () => {
    expect(queryKeys.list(TYPE, 'probe=1').slice(0, 3)).toEqual([...queryKeys.lists(TYPE)])
  })

  it('목록과 상세는 자원 type 이 같아도 겹치지 않는다', () => {
    expect(queryKeys.detail(TYPE, 'list')).not.toEqual(queryKeys.lists(TYPE))
  })
})

describe('cacheEffects — 스펙 8.5 의 표', () => {
  it.each<[string, CacheWrite, unknown]>([
    [
      '생성 → 목록 무효화',
      { kind: 'create', type: TYPE },
      [{ action: 'invalidate', queryKey: queryKeys.lists(TYPE) }],
    ],
    [
      '수정 → 상세 + 목록 무효화',
      { kind: 'update', type: TYPE, id: 'probe-1' },
      [
        { action: 'invalidate', queryKey: queryKeys.detail(TYPE, 'probe-1') },
        { action: 'invalidate', queryKey: queryKeys.lists(TYPE) },
      ],
    ],
    [
      '삭제 → 상세 제거 + 목록 무효화',
      { kind: 'delete', type: TYPE, id: 'probe-1' },
      [
        { action: 'remove', queryKey: queryKeys.detail(TYPE, 'probe-1') },
        { action: 'invalidate', queryKey: queryKeys.lists(TYPE) },
      ],
    ],
    ['로그아웃 → 캐시 전체 비움', { kind: 'logout' }, [{ action: 'removeAll' }]],
  ])('%s', (_label, write, expected) => {
    expect(cacheEffects(write)).toEqual(expected)
  })
})

describe('applyCacheEffects — 표를 실제 캐시에 옮긴다', () => {
  const client = new QueryClient()

  afterEach(() => {
    client.clear()
  })

  function seed(): void {
    client.setQueryData(queryKeys.list(TYPE, 'probe=a'), 'probe-list-a')
    client.setQueryData(queryKeys.list(TYPE, 'probe=b'), 'probe-list-b')
    client.setQueryData(queryKeys.list(OTHER, 'probe=a'), 'probe-other-list')
    client.setQueryData(queryKeys.detail(TYPE, 'probe-1'), 'probe-detail-1')
    client.setQueryData(queryKeys.detail(TYPE, 'probe-2'), 'probe-detail-2')
  }

  function invalidated(queryKey: readonly string[]): boolean | undefined {
    return client.getQueryCache().find({ queryKey, exact: true })?.state.isInvalidated
  }

  it('생성은 그 자원의 목록만 무효화한다 - 다른 자원과 상세는 두고', () => {
    seed()
    applyCacheEffects(client, cacheEffects({ kind: 'create', type: TYPE }))
    expect(invalidated(queryKeys.list(TYPE, 'probe=a'))).toBe(true)
    expect(invalidated(queryKeys.list(TYPE, 'probe=b'))).toBe(true)
    expect(invalidated(queryKeys.list(OTHER, 'probe=a'))).toBe(false)
    expect(invalidated(queryKeys.detail(TYPE, 'probe-1'))).toBe(false)
  })

  it('수정은 그 상세와 목록을 무효화한다', () => {
    seed()
    applyCacheEffects(client, cacheEffects({ kind: 'update', type: TYPE, id: 'probe-1' }))
    expect(invalidated(queryKeys.detail(TYPE, 'probe-1'))).toBe(true)
    expect(invalidated(queryKeys.detail(TYPE, 'probe-2'))).toBe(false)
    expect(invalidated(queryKeys.list(TYPE, 'probe=a'))).toBe(true)
  })

  it('삭제는 그 상세를 지우고 목록을 무효화한다', () => {
    seed()
    applyCacheEffects(client, cacheEffects({ kind: 'delete', type: TYPE, id: 'probe-1' }))
    expect(client.getQueryData(queryKeys.detail(TYPE, 'probe-1'))).toBeUndefined()
    expect(client.getQueryData(queryKeys.detail(TYPE, 'probe-2'))).toBe('probe-detail-2')
    expect(invalidated(queryKeys.list(TYPE, 'probe=b'))).toBe(true)
  })

  it('로그아웃은 캐시를 전부 비운다', () => {
    seed()
    applyCacheEffects(client, cacheEffects({ kind: 'logout' }))
    expect(client.getQueryCache().getAll()).toEqual([])
  })
})
```

```bash
pnpm exec vitest run test/unit/queries/keys.test.ts 2>&1 | tail -4
```

Expected: FAIL — `@/queries/keys` 가 없다.

- [ ] **Step 2: 키와 표를 쓴다**

`queries/keys.ts`:

```ts
import type { QueryClient } from '@tanstack/react-query'

/**
 * Query 캐시의 키와 쓰기 뒤의 무효화 표 - 스펙 8.5. 순수 함수이고 단위 시험이 고정한다
 * (test/unit/queries/keys.test.ts). React 와 네트워크를 모른다 - `applyCacheEffects` 만
 * `QueryClient` 를 받아 표를 캐시에 옮긴다.
 *
 * 키는 `[RESOURCES_KEY, 자원 type, 'list' | 'detail', …]` 모양이다. 앞 조각이 같은 키를 한 번에
 * 무효화할 수 있게 자원 → 종류 → 조건 순서로 좁아진다.
 */
export const RESOURCES_KEY = 'resources'

export const queryKeys = {
  /** 자원 하나의 목록 전부 - 조건(백엔드 쿼리)마다 캐시가 하나씩이다. */
  lists: (type: string) => [RESOURCES_KEY, type, 'list'] as const,
  /** 목록 하나. `query` 는 첫 요청의 백엔드 쿼리 문자열이다(`listRequest`). */
  list: (type: string, query: string) => [RESOURCES_KEY, type, 'list', query] as const,
  /** 상세 하나. */
  detail: (type: string, id: string) => [RESOURCES_KEY, type, 'detail', id] as const,
}

/** 캐시를 바꾸는 쓰기 - 스펙 8.5 의 표의 행이다. 생성·수정·삭제의 호출부는 D4 가 만든다. */
export type CacheWrite =
  | { kind: 'create'; type: string }
  | { kind: 'update'; type: string; id: string }
  | { kind: 'delete'; type: string; id: string }
  | { kind: 'logout' }

/** 쓰기 하나가 캐시에 하는 일. `removeAll` 은 캐시 전체를 비운다. */
export type CacheEffect =
  | { action: 'invalidate'; queryKey: readonly string[] }
  | { action: 'remove'; queryKey: readonly string[] }
  | { action: 'removeAll' }

/**
 * 쓰기 → 캐시에 할 일(스펙 8.5 의 표 그대로).
 *
 * | 쓰기 | 무효화 |
 * | --- | --- |
 * | 생성 | 해당 자원 목록 |
 * | 수정 | 해당 상세 + 목록 |
 * | 삭제 | 해당 상세 제거 + 목록 |
 * | 로그아웃 | Query 캐시 전체 비움 |
 *
 * 무효화는 지금 보이는 조회를 다시 부르고, 제거는 없어진 자원의 상세를 캐시에서 지운다 - 삭제한
 * 자원의 상세를 무효화하면 404 를 다시 받으러 간다.
 */
export function cacheEffects(write: CacheWrite): readonly CacheEffect[] {
  switch (write.kind) {
    case 'create':
      return [{ action: 'invalidate', queryKey: queryKeys.lists(write.type) }]
    case 'update':
      return [
        { action: 'invalidate', queryKey: queryKeys.detail(write.type, write.id) },
        { action: 'invalidate', queryKey: queryKeys.lists(write.type) },
      ]
    case 'delete':
      return [
        { action: 'remove', queryKey: queryKeys.detail(write.type, write.id) },
        { action: 'invalidate', queryKey: queryKeys.lists(write.type) },
      ]
    case 'logout':
      return [{ action: 'removeAll' }]
  }
}

/** 표의 일을 캐시에 옮긴다. 무효화는 기다리지 않는다 - 다시 부르는 것은 화면의 일이다. */
export function applyCacheEffects(client: QueryClient, effects: readonly CacheEffect[]): void {
  for (const effect of effects) {
    if (effect.action === 'invalidate') {
      void client.invalidateQueries({ queryKey: effect.queryKey })
    } else if (effect.action === 'remove') {
      client.removeQueries({ queryKey: effect.queryKey, exact: true })
    } else {
      client.removeQueries()
    }
  }
}
```

```bash
pnpm exec vitest run test/unit/queries/keys.test.ts
```

Expected: PASS 10.

- [ ] **Step 3: NetInfo 를 설치하고, 릴리스 대기 예외를 뺀다**

D3 의 첫 의존성 변경이다 — D2 가 남긴 릴리스 대기 예외(`lucide-react-native@1.49.0`)를 여기서 뺀다(결정 34). 먼저 뺄 때가 됐는지 본다:

```bash
pnpm view lucide-react-native@1.49.0 time --json | node -e 'let s="";process.stdin.on("data",(d)=>(s+=d)).on("end",()=>{const at=Date.parse(JSON.parse(s)["1.49.0"])+24*3600000;console.log(new Date(at).toISOString(),Date.now()>=at?"뺀다":"아직")})'
```

Expected: `2026-09-30T22:27:09.286Z 뺀다`. `아직` 이면 아래 `pnpm-workspace.yaml` 의 Edit 를 건너뛰고 NetInfo 만 설치한다 — 빼기는 Task 5 Step 1 이 같은 명령으로 다시 본다. Step 1 에서 예외가 이미 없었으면 이 확인과 Edit 를 건너뛴다.

NetInfo 를 설치한다:

```bash
BACKEND_URL=https://gate-check.invalid pnpm exec expo install @react-native-community/netinfo; echo "expo install exit=$?"
ls app.json 2>/dev/null && rm app.json
grep -n '"@react-native-community/netinfo"' package.json
```

Expected: `expo install exit=0`(설정 플러그인이 없는 패키지다), `app.json` 이 없다, `"@react-native-community/netinfo": "12.0.1"`(SDK 57 의 값 — D2 의 끝 사본에서 `expo install` 이 범위 없이 이렇게 적었고, 락파일에는 NetInfo 항목만 더해졌다).

`pnpm-workspace.yaml` — Edit, 찾을 것:

```yaml
# pnpm 11 은 릴리스 후 1일(minimumReleaseAge, 기본 1440분)이 지나지 않은 버전이 락파일에 있으면 설치를
# 막는다(ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION). 아래는 설치할 때 그 창 안에 있어 pnpm 이 스스로 적은
# 예외다. 릴리스로부터 하루가 지나면 없어도 설치되므로 다음 의존성 변경 때 뺀다
# (`pnpm view <이름>@<버전> time --json` 으로 릴리스 시각을 본다).
minimumReleaseAgeExclude:
  - lucide-react-native@1.49.0
```

바꿀 것:

```yaml
# pnpm 11 은 릴리스 후 1일(minimumReleaseAge, 기본 1440분)이 지나지 않은 버전이 락파일에 있으면
# --frozen-lockfile 설치도 막는다(ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION). 그 창 안의 버전을 설치하면 pnpm 이
# 여기에 minimumReleaseAgeExclude 를 스스로 적는다 - 그대로 두고, 릴리스로부터 하루가 지난 뒤의 다음 의존성
# 변경 때 뺀다(`pnpm view <이름>@<버전> time --json` 으로 릴리스 시각을 본다).
```

```bash
grep -n "minimumReleaseAgeExclude\|lucide-react-native@" pnpm-workspace.yaml
pnpm install --frozen-lockfile; echo "frozen exit=$?"
pnpm peers check; echo "peers exit=$?"
```

Expected: `grep` 이 주석 줄 하나만 낸다(키와 예외가 없다 — NetInfo 는 2026-02 릴리스라 pnpm 이 예외를 적지 않는다), `frozen exit=0`, `peers exit=0`. `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` 이 나면 위 확인이 틀린 것이다 — 예외를 되살리고(키 한 줄과 항목 한 줄) Task 5 Step 1 로 미룬다.

- [ ] **Step 4: Query 캐시에 네트워크 모드와 재조회를 잇고, 로그아웃이 표를 지나게 한다**

`platform/query-client.ts` 전체를 바꾼다:

```ts
import NetInfo from '@react-native-community/netinfo'
import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { AppState } from 'react-native'

/**
 * 앱의 Query 캐시 하나(스펙 8.5). 조회·쓰기 모두 자동 재시도를 끈다 - 백엔드 클라이언트
 * (client.ts)가 재시도하지 않는 것과 같은 태도이고, 재시도가 회전 중인 refresh 를 다시 내밀지
 * 않게 한다(스펙 7.2). staleTime 0 은 기본값이지만 스펙 8.5 의 값이라 적어 둔다.
 *
 * networkMode 는 offlineFirst 다. 기본값 online 은 onlineManager 가 끊겼다고 하면 요청을 보내지
 * 않고 멈춰 둔다 - 첫 조회라면 스켈레톤이, 쓰기라면 제출 버튼의 스피너가 연결이 돌아올 때까지
 * 돈다. offlineFirst 는 요청을 한 번 보내고, 실패는 client.ts 가 NETWORK_ERROR 결과로 돌려준다 -
 * 화면이 앱 문구와 "다시 시도" 를 그린다(스펙 9.3). 멈추는 것은 재시도뿐인데 재시도는 꺼져 있다.
 * 연결이 돌아오면 다시 부르는 것(refetchOnReconnect)은 이 모드의 기본값 그대로 켜져 있다.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 0, retry: false, networkMode: 'offlineFirst' },
    mutations: { retry: false, networkMode: 'offlineFirst' },
  },
})

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
```

`app/_layout.tsx` — Edit, 찾을 것:

```tsx
import { queryClient } from '@/platform/query-client'
```

바꿀 것:

```tsx
import { queryClient, useQueryRefetchTriggers } from '@/platform/query-client'
```

`app/_layout.tsx` — Edit, 찾을 것:

```tsx
function AppRoot({ scheme }: { scheme: 'light' | 'dark' }) {
  const ready = useSessionStatus() !== 'restoring'
```

바꿀 것:

```tsx
function AppRoot({ scheme }: { scheme: 'light' | 'dark' }) {
  const ready = useSessionStatus() !== 'restoring'

  // 앱 복귀·네트워크 복귀 때 다시 부른다(스펙 8.5, platform/query-client.ts).
  useQueryRefetchTriggers()
```

`queries/auth.ts` — Edit, 찾을 것:

```ts
import { sessionManager } from '@/platform/session'
```

바꿀 것:

```ts
import { sessionManager } from '@/platform/session'
import { applyCacheEffects, cacheEffects } from '@/queries/keys'
```

`queries/auth.ts` — Edit, 찾을 것:

```ts
      sessionManager.logout(() => {
        queryClient.removeQueries()
      }),
```

바꿀 것:

```ts
      sessionManager.logout(() => {
        applyCacheEffects(queryClient, cacheEffects({ kind: 'logout' }))
      }),
```

D2 가 인증 쓰기의 네트워크 모드에 "D3 가 onlineManager 를 NetInfo 에 물리면" 이라고 앞일로 적어 둔 주석을 지금 일로 고친다(결정 12). `queries/auth.ts` — Edit, 찾을 것:

```ts
/**
 * 인증 쓰기는 오프라인이어도 멈추지 않는다. 기본값('online')은 onlineManager 가 오프라인이면 mutationFn 을
 * 부르지 않고 멈춰 두면서 진행 중으로 센다 - D3 가 onlineManager 를 NetInfo 에 물리면 오프라인 로그아웃은
 * 기기 세션을 지우지 못한 채 스피너가 끝나지 않고, 로그인·가입은 실패 대신 멈춘다. 'always' 는 그냥
 * 보낸다: 닿지 못하면 API 클라이언트가 만든 transport 오류가 오고, 로그아웃은 기기 쪽을 이미 비운 뒤라 폐기만
 * 실패한다.
 */
```

바꿀 것:

```ts
/**
 * 인증 쓰기는 오프라인이어도 멈추지 않는다. TanStack Query 의 기본값('online')은 onlineManager 가 오프라인이면
 * mutationFn 을 부르지 않고 멈춰 두면서 진행 중으로 센다 - onlineManager 는 NetInfo 에 물려 있어
 * (platform/query-client.ts) 오프라인 로그아웃은 기기 세션을 지우지 못한 채 스피너가 끝나지 않고, 로그인·가입은
 * 실패 대신 멈춘다. 'always' 는 그냥 보낸다: 닿지 못하면 API 클라이언트가 만든 transport 오류가 오고, 로그아웃은
 * 기기 쪽을 이미 비운 뒤라 폐기만 실패한다. 앱의 기본값(offlineFirst)도 재시도가 꺼져 있어 한 번은 보내지만, 이
 * 쓰기는 기본값에 기대지 않게 모드를 여기에 적는다.
 */
```

- [ ] **Step 5: 조회 훅을 쓴다**

`queries/resources.ts`:

```ts
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import type { CollectionDocument, SingleDocument } from '@/lib/jsonapi/document'
import type { ResourceDefinition } from '@/lib/resources/define'
import {
  detailRequest,
  detailView,
  listRequest,
  listView,
  nextPageQuery,
  type DetailView,
  type ListView,
} from '@/lib/resources/view'
import { apiRequest } from '@/platform/api'
import { queryKeys } from '@/queries/keys'

/**
 * 자원의 조회 훅 - 목록(무한 스크롤)과 상세(스펙 8.4).
 *
 * 판단은 `lib/resources/view.ts` 가 한다 - 무엇을 요청할지(`listRequest`·`detailRequest`), 다음 쪽이
 * 어디인지(`nextPageQuery`), 응답을 어떤 화면 상태로 그릴지(`listView`·`detailView`). 여기서는 그
 * 결정을 TanStack Query 에 잇기만 한다. 요청은 전부 `apiRequest`(platform/api.ts)를 지난다 - 그
 * 자리가 Accept-Language 를 싣는다(스펙 9.4).
 *
 * `apiRequest` 는 던지지 않는다 - 백엔드 오류도 닿지 못함도 결과 값이다. 그래서 Query 의 오류
 * 상태를 쓰지 않고 결과를 view 함수에 넘긴다. 뒤따르는 쪽의 실패도 한 쪽으로 쌓이고, 그 뒤로는
 * 읽지 않는다(`nextPageQuery` 가 `null`).
 */

/** 라우트 파라미터 - `useLocalSearchParams()` 가 주는 모양. */
type RouteParams = Readonly<Record<string, string | string[] | undefined>>

export interface ResourceListState {
  /** 첫 쪽을 받기 전이면 `null` - 화면은 스켈레톤을 그린다(스펙 8.7). */
  view: ListView | null
  /** 다음 쪽을 읽는 중 - 목록 끝에 스피너만 그린다(스펙 8.7). */
  loadingMore: boolean
  /** 사용자가 당겨서 새로고침하는 중. 앱 복귀·네트워크 복귀의 재조회는 여기 들지 않는다. */
  refreshing: boolean
  /** 실패한 목록을 다시 부르는 중 - "다시 시도" 버튼이 스피너를 그린다. */
  retrying: boolean
  /** 목록 끝에 닿았을 때 - 다음 쪽이 있고 읽는 중이 아닐 때만 읽는다. */
  loadMore: () => void
  refresh: () => void
  retry: () => void
}

/**
 * 목록 - 라우트 파라미터가 곧 쿼리다(스펙 8.2). 첫 쪽은 커서의 입구에서 시작하고, 다음 쪽은
 * 응답의 `links.next` 를 따라간다(스펙 8.3). 쪽 인자는 백엔드 쿼리 문자열이다 - 첫 쪽은
 * `listRequest` 의 쿼리, 다음 쪽은 `nextPageQuery` 의 쿼리.
 */
export function useResourceList(
  resource: ResourceDefinition,
  params: RouteParams,
): ResourceListState {
  const plan = listRequest(resource, params)
  const query = useInfiniteQuery({
    queryKey: queryKeys.list(resource.type, plan.query.toString()),
    initialPageParam: plan.query.toString(),
    queryFn: ({ pageParam }) =>
      apiRequest<CollectionDocument>(plan.path, { query: new URLSearchParams(pageParam) }),
    getNextPageParam: (lastPage) => nextPageQuery(lastPage)?.toString(),
  })
  const [refreshing, setRefreshing] = useState(false)

  return {
    view: query.data === undefined ? null : listView(resource, plan, query.data.pages),
    loadingMore: query.isFetchingNextPage,
    refreshing,
    retrying: query.isFetching && !refreshing,
    // 읽는 중에 부르면 TanStack Query 가 진행 중인 재조회를 끊고 다음 쪽을 부른다 - 그래서
    // 읽는 중에는 부르지 않는다(TanStack Query v5 무한 조회 안내의 규칙).
    loadMore: () => {
      if (query.hasNextPage && !query.isFetching) void query.fetchNextPage()
    },
    refresh: () => {
      setRefreshing(true)
      void query.refetch().finally(() => {
        setRefreshing(false)
      })
    },
    retry: () => {
      void query.refetch()
    },
  }
}

export interface ResourceDetailState {
  /** 응답을 받기 전이면 `null` - 화면은 스켈레톤을 그린다(스펙 8.7). */
  view: DetailView | null
  retrying: boolean
  retry: () => void
}

/**
 * 상세 하나. `id` 는 라우트의 동적 세그먼트 그대로다 - 이스케이프는 `detailRequest` 가 한다.
 * 화면에 다시 들어오면 캐시를 먼저 그리고 다시 부른다(`staleTime` 0, 스펙 8.5).
 */
export function useResourceDetail(resource: ResourceDefinition, id: string): ResourceDetailState {
  const plan = detailRequest(resource, id)
  const query = useQuery({
    queryKey: queryKeys.detail(resource.type, id),
    queryFn: () => apiRequest<SingleDocument>(plan.path, plan.options),
  })

  return {
    view: query.data === undefined ? null : detailView(resource, query.data),
    retrying: query.isFetching,
    retry: () => {
      void query.refetch()
    },
  }
}
```

- [ ] **Step 6: 문서와 스펙 정정을 쓴다**

`queries/AGENTS.md` — Edit, 찾을 것(표의 `auth.ts` 행 — 가장 긴 행이라 칸 맞춤 공백이 없다):

```markdown
| `auth.ts` | 가입·로그인·로그아웃 쓰기 훅과 로그아웃 진행 여부(`useIsLoggingOut`). `lib/auth/flow.ts`의 결정을 실행만 한다 - 세션을 세우는 데까지, 화면 이동은 화면이 한다 |
```

바꿀 것(Prettier 가 표의 칸을 다시 맞춘다):

```markdown
| `auth.ts` | 가입·로그인·로그아웃 쓰기 훅과 로그아웃 진행 여부(`useIsLoggingOut`). `lib/auth/flow.ts`의 결정을 실행만 한다 - 세션을 세우는 데까지, 화면 이동은 화면이 한다 |
| `keys.ts` | 캐시 키(`['resources', type, 'list' \| 'detail', …]`)와 쓰기 뒤 무효화 표(`cacheEffects`), 표를 캐시에 옮기는 `applyCacheEffects`(스펙 8.5). 시험이 표와 실제 `QueryClient` 로 잰다 |
| `resources.ts` | 자원의 조회 훅 - 목록(`useResourceList`, 무한 스크롤)과 상세(`useResourceDetail`). 판단은 `lib/resources/view.ts` 가 한다 |
```

`queries/AGENTS.md` — Edit, 찾을 것:

```markdown
- 로그아웃은 Query 캐시를 전부 비운다(스펙 8.5). 조회 캐시만 비운다(`removeQueries`) - mutation 캐시는
```

바꿀 것:

```markdown
- 로그아웃은 Query 캐시를 전부 비운다(스펙 8.5) - `keys.ts` 무효화 표의 `logout` 행을 지난다. 조회 캐시만
  비운다(`removeQueries`) - mutation 캐시는
```

`queries/AGENTS.md` — Edit, 찾을 것(D2 가 앞일로 적은 네트워크 모드 문단):

```markdown
- 인증 쓰기(로그인·가입·로그아웃)는 `networkMode: 'always'`다. 기본값('online')은 `onlineManager`가 오프라인이면
  `mutationFn`을 부르지 않고 멈춰 두면서 진행 중으로 센다 - 앞으로 `onlineManager`를 NetInfo 에 물리면 오프라인
  로그아웃이 기기 세션을 지우지 못한 채 스피너가 끝나지 않는다. 기기 쪽을 비워야 하는 쓰기는 같은 옵션을 준다.
- 자동 재시도는 `platform/query-client.ts`가 끈다.
```

바꿀 것:

```markdown
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
```

`platform/AGENTS.md` — Edit, 찾을 것(표의 `query-client.ts` 행):

```markdown
| `query-client.ts`           | Query 캐시 `queryClient` 하나와 기본 옵션(스펙 8.5)                                                                   |
```

바꿀 것:

```markdown
| `query-client.ts` | Query 캐시 `queryClient` 하나와 기본 옵션(스펙 8.5, `networkMode: 'offlineFirst'`), 앱 복귀·네트워크 복귀의 재조회 `useQueryRefetchTriggers()`(AppState·NetInfo) |
```

`platform/AGENTS.md` — Edit, 찾을 것:

```markdown
- 요청으로 이어질 수 있는 훅(세션·Query, 앞으로의 AppState·NetInfo)은 루트 레이아웃의 `STARTUP.ok`
```

바꿀 것:

```markdown
- 요청으로 이어질 수 있는 훅(세션·Query·AppState·NetInfo - `useQueryRefetchTriggers`)은 루트 레이아웃의 `STARTUP.ok`
```

스펙 — 8.5 의 무효화 표 뒤, `### 8.6 계약 실험실` 바로 앞에 더한다:

```markdown

> 정정(2026-09-30, D3): TanStack Query 의 `networkMode` 는 조회·쓰기 모두 `offlineFirst` 다. 기본값 `online` 은
> NetInfo 가 끊겼다고 하면 요청을 보내지 않고 멈춰 둬서, 첫 조회의 스켈레톤·쓰기의 스피너가 연결이 돌아올 때까지
> 돈다 - 9.3 의 "네트워크 실패 → 앱 문구와 다시 시도" 가 오지 않는다. `offlineFirst` 는 요청을 한 번 보내고
> (실패는 `request()` 가 결과로 준다) 연결이 돌아오면 다시 부른다. NetInfo 의 `isConnected` 가 `null` 이면
> 연결된 것으로 본다. 요청에 TanStack Query 의 `signal` 을 넘기지 않는다. 캐시 키와 무효화 표는 `queries/keys.ts`
> 이고 로그아웃도 그 표를 지난다. 배선은 `platform/query-client.ts`.
```

- [ ] **Step 7: 정적 검사를 돌린다**

번들은 화면이 생기는 Task 4 에서 한 번 돈다.

```bash
pnpm format
BACKEND_URL=https://gate-check.invalid pnpm types:routes
pnpm typecheck && pnpm lint && pnpm format:check && pnpm lint:secrets
./scripts/check-citations.sh app components lib platform queries test
pnpm test 2>&1 | tail -4
BACKEND_URL=https://gate-check.invalid pnpm exec expo-doctor
```

Expected: 전부 exit 0. 시험은 10 늘어난다(960). expo-doctor 는 모든 검사 통과(NetInfo 12.0.1 이 SDK 57 의 값과 같다).

- [ ] **Step 8: 커밋한다**

```bash
git add queries platform/query-client.ts platform/AGENTS.md app/_layout.tsx package.json pnpm-lock.yaml pnpm-workspace.yaml test/unit/queries docs/superpowers/specs
git status --short
git commit -m "feat: 캐시 키와 무효화 표, 자원 조회 훅을 두고 앱 복귀·네트워크 복귀 때 다시 부른다"
```

---

### Task 3: UI 기반 — Uniwind 결함 대응, 배지·스켈레톤, 테마 색, 설정 소음

**Files:**
- Create: `test/unit/ui/breakpoints.test.ts`, `test/unit/ui/nav-colors.test.ts`, `platform/nav-colors.ts`, `components/ui/badge.tsx`·`components/ui/skeleton.tsx`(CLI)
- Modify: `components/ui/button.tsx`, `components/ui/text.tsx`, `components/ui/input.tsx`, `platform/theme.ts`, `components.json`, `AGENTS.md`, `platform/AGENTS.md`, `docs/superpowers/notes/2026-09-30-d3-measurements.md`(L2–L4), 스펙 16장 정정

**Interfaces:**
- Consumes: D1 의 `components/ui/button.tsx`·`text.tsx`·`icon.tsx`, D2 의 `components/ui/input.tsx`, `global.css` 의 `@variant light`·`@variant dark` 토큰
- Produces: `Badge`(`@/components/ui/badge`, `variant: 'default' | 'secondary' | 'destructive' | 'outline'`, 안의 `Text` 가 배지 글자 색을 받는다), `Skeleton`(`@/components/ui/skeleton`, `className` 으로 크기), `NAV_COLORS`·`NAV_COLOR_TOKENS`(`@/platform/nav-colors`), 규칙 "app/·components/ 에 미디어 쿼리 변형이 없다"(시험)

- [ ] **Step 1: 미디어 쿼리 변형의 시험을 쓰고 실패를 본다**

`test/unit/ui/breakpoints.test.ts`:

```ts
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * 화면 코드에 미디어 쿼리 변형(`sm`·`md`·`lg`·`xl`·`2xl` 과 그 `max-`·`min-` 꼴, `portrait`·
 * `landscape`)이 없다.
 *
 * Uniwind 1.12.0 은 한 `@media` 블록 안에서 첫 규칙만 조건(minWidth)을 지키고 둘째 규칙부터
 * 조건을 잃는다 - 그 규칙은 폰(411dp)에서도 적용된다(docs/superpowers/notes/2026-09-30-d1-measurements.md
 * 의 M1 절: React Native Reusables Button 의 기본 크기가 폰에서 40dp 가 아니라 36dp). 고쳐진
 * 릴리스가 없어(npm latest 1.12.0) 이 저장소는 그 변형을 쓰지 않는다 - React Native Reusables
 * CLI 로 받은 컴포넌트에서도 뺀다(docs/superpowers/notes/2026-09-30-d3-measurements.md).
 *
 * 문자열이 아니라 파일 전체를 훑는다 - 클래스 문자열은 `cn()`·`cva()`·템플릿 리터럴 어디에나 있다.
 * 객체 키(`sm: …`)는 콜론 뒤에 공백이 있어 걸리지 않는다.
 */
const ROOTS = ['app', 'components']

const MEDIA_VARIANT =
  /(?<![\w-])(?:(?:max|min)-\[[^\]\s]*\]|(?:(?:max|min)-)?(?:sm|md|lg|xl|2xl)|portrait|landscape):(?=\S)/g

function sourceFiles(root: string): string[] {
  return readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(ts|tsx)$/.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name))
}

function mediaVariants(text: string): string[] {
  return [...text.matchAll(MEDIA_VARIANT)].map((match) => match[0])
}

describe('미디어 쿼리 변형 - Uniwind 1.12.0 의 결함', () => {
  it('app/·components/ 에 없다', () => {
    const found = ROOTS.flatMap(sourceFiles).flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .flatMap((line, index) =>
          mediaVariants(line).map((variant) => `${file}:${index + 1}: ${variant}`),
        ),
    )
    expect(found).toEqual([])
  })

  it('검사가 변형을 실제로 잡는다', () => {
    expect(
      mediaVariants(
        "'h-10 sm:h-9' 'md:text-sm' 'max-sm:p-2' 'min-[400px]:p-2' 'xl:w-4' 'portrait:flex-col'",
      ),
    ).toEqual(['sm:', 'md:', 'max-sm:', 'min-[400px]:', 'xl:', 'portrait:'])
  })

  it('크기 이름과 선택자 변형, 객체 키는 잡지 않는다', () => {
    expect(
      mediaVariants(
        "'shadow-sm text-sm rounded-sm dark:bg-muted [&>svg]:size-4 [a&]:hover:bg-accent' { sm: '' }",
      ),
    ).toEqual([])
  })
})
```

```bash
pnpm exec vitest run test/unit/ui/breakpoints.test.ts 2>&1 | tail -20
```

Expected: FAIL 1(검사 자체의 시험 둘은 통과) — 걸린 줄에 `components/ui/button.tsx` 의 `sm:` 다섯, `components/ui/text.tsx` 의 셋, `components/ui/input.tsx` 의 `sm:`·`md:` 가 보인다.

- [ ] **Step 2: 받은 컴포넌트에서 미디어 쿼리 변형을 뺀다**

`components/ui/button.tsx` — Edit, 찾을 것:

```tsx
      size: {
        default: cn('h-10 px-4 py-2 sm:h-9', Platform.select({ web: 'has-[>svg]:px-3' })),
        sm: cn('h-9 gap-1.5 rounded-md px-3 sm:h-8', Platform.select({ web: 'has-[>svg]:px-2.5' })),
        lg: cn('h-11 rounded-md px-6 sm:h-10', Platform.select({ web: 'has-[>svg]:px-4' })),
        icon: 'h-10 w-10 sm:h-9 sm:w-9',
      },
```

바꿀 것:

```tsx
      // 원본과 다른 곳: 크기마다 붙은 640dp 이상의 변형(원본의 h-9 등)을 뺐다. Uniwind 1.12.0 은 한
      // 미디어 블록의 둘째 규칙부터 조건을 잃어 그 변형이 폰에서도 적용된다(D1 실측 M1) -
      // test/unit/ui/breakpoints.test.ts 가 다시 들어오는 것을 막는다.
      size: {
        default: cn('h-10 px-4 py-2', Platform.select({ web: 'has-[>svg]:px-3' })),
        sm: cn('h-9 gap-1.5 rounded-md px-3', Platform.select({ web: 'has-[>svg]:px-2.5' })),
        lg: cn('h-11 rounded-md px-6', Platform.select({ web: 'has-[>svg]:px-4' })),
        icon: 'h-10 w-10',
      },
```

`components/ui/text.tsx` — Edit, 찾을 것:

```tsx
        p: 'mt-3 leading-7 sm:mt-6',
        blockquote: 'mt-4 border-l-2 pl-3 italic sm:mt-6 sm:pl-6',
```

바꿀 것:

```tsx
        // 원본과 다른 곳: 640dp 이상의 여백 변형을 뺐다 - button.tsx 의 같은 주석(Uniwind 1.12.0).
        p: 'mt-3 leading-7',
        blockquote: 'mt-4 border-l-2 pl-3 italic',
```

`components/ui/input.tsx` — Edit 셋. 첫째, 찾을 것:

```tsx
// 원본과 다른 한 곳: 원본은 placeholderClassName 을 구조 분해해 버린다. 그 prop 은 NativeWind 의 것이라
// Uniwind 의 TextInputProps(uniwind/types.d.ts)에 없어 타입 검사가 실패한다 - 받지 않는다.
```

바꿀 것:

```tsx
// 원본과 다른 곳 둘: 원본은 placeholderClassName 을 구조 분해해 버린다. 그 prop 은 NativeWind 의 것이라
// Uniwind 의 TextInputProps(uniwind/types.d.ts)에 없어 타입 검사가 실패한다 - 받지 않는다. 그리고
// 640dp·768dp 이상의 변형을 뺐다 - button.tsx 의 같은 주석(Uniwind 1.12.0).
```

둘째, 찾을 것 ` shadow-sm shadow-black/5 sm:h-9',` — 바꿀 것 ` shadow-sm shadow-black/5',`. 셋째, 찾을 것 ` transition-[color,box-shadow] md:text-sm',` — 바꿀 것 ` transition-[color,box-shadow]',`.

```bash
pnpm exec vitest run test/unit/ui/breakpoints.test.ts
grep -rnE "(^|[ '\"\`])(sm|md):[^ ]" components app || echo "변형 없음"
```

Expected: PASS 3, `변형 없음`.

- [ ] **Step 3: 배지와 스켈레톤을 받는다**

```bash
printf 'n\n' | BACKEND_URL=https://gate-check.invalid pnpm dlx @react-native-reusables/cli@0.7.1 add badge skeleton --styling-library uniwind --yes
pnpm exec prettier --write components/ui/badge.tsx components/ui/skeleton.tsx
git status --short
```

Expected: `Created 2 files`(`skeleton.tsx`·`badge.tsx`), `text.tsx` 는 덮어쓰기를 물어 "no" 로 건너뛴다(`Skipped 1 file`). `git status` 에 새 파일 둘뿐이다(`package.json`·`text.tsx` 는 그대로). 받은 `badge.tsx` 는 Prettier 뒤 아래와 같다 — 고치지 않는다:

```tsx
import { TextClassContext } from '@/components/ui/text'
import { cn } from '@/lib/utils'
import { Slot } from '@rn-primitives/slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { Platform, View } from 'react-native'

const badgeVariants = cva(
  cn(
    'border-border group shrink-0 flex-row items-center justify-center gap-1 overflow-hidden rounded-full border px-2 py-0.5',
    Platform.select({
      web: 'focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive w-fit whitespace-nowrap transition-[color,box-shadow] focus-visible:ring-[3px] [&>svg]:pointer-events-none [&>svg]:size-3',
    }),
  ),
  {
    variants: {
      variant: {
        default: cn(
          'bg-primary border-transparent',
          Platform.select({ web: '[a&]:hover:bg-primary/90' }),
        ),
        secondary: cn(
          'bg-secondary border-transparent',
          Platform.select({ web: '[a&]:hover:bg-secondary/90' }),
        ),
        destructive: cn(
          'bg-destructive border-transparent',
          Platform.select({ web: '[a&]:hover:bg-destructive/90' }),
        ),
        outline: Platform.select({ web: '[a&]:hover:bg-accent [a&]:hover:text-accent-foreground' }),
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

const badgeTextVariants = cva('text-xs font-medium', {
  variants: {
    variant: {
      default: 'text-primary-foreground',
      secondary: 'text-secondary-foreground',
      destructive: 'text-white',
      outline: 'text-foreground',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
})

type BadgeProps = React.ComponentProps<typeof View> &
  React.RefAttributes<View> & {
    asChild?: boolean
  } & VariantProps<typeof badgeVariants>

function Badge({ className, variant, asChild, ...props }: BadgeProps) {
  const Component = asChild ? Slot : View
  return (
    <TextClassContext.Provider value={badgeTextVariants({ variant })}>
      <Component className={cn(badgeVariants({ variant }), className)} {...props} />
    </TextClassContext.Provider>
  )
}

export { Badge, badgeTextVariants, badgeVariants }
export type { BadgeProps }
```

받은 `skeleton.tsx` 는 두 곳을 고친다(결정 18). Edit, 찾을 것:

```tsx
function Skeleton({
  className,
  ...props
}: React.ComponentProps<typeof View> & React.RefAttributes<View>) {
```

바꿀 것:

```tsx
// 원본과 다른 곳 둘: ref 를 받지 않는다 - 원본의 React.RefAttributes<View> 는 exactOptionalPropertyTypes
// 아래에서 reanimated Animated.View 의 ref 타입과 맞지 않아 타입 검사가 실패한다(스켈레톤에 ref 를 걸
// 자리가 없다). 효과의 의존성에 sv 를 적는다 - 빠지면 react-hooks/exhaustive-deps 경고다.
function Skeleton({ className, ...props }: React.ComponentProps<typeof View>) {
```

Edit, 찾을 것 `  }, [])` — 바꿀 것 `  }, [sv])`. 고친 뒤의 파일:

```tsx
import { cn } from '@/lib/utils'
import { View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import * as React from 'react'

const duration = 1000

// 원본과 다른 곳 둘: ref 를 받지 않는다 - 원본의 React.RefAttributes<View> 는 exactOptionalPropertyTypes
// 아래에서 reanimated Animated.View 의 ref 타입과 맞지 않아 타입 검사가 실패한다(스켈레톤에 ref 를 걸
// 자리가 없다). 효과의 의존성에 sv 를 적는다 - 빠지면 react-hooks/exhaustive-deps 경고다.
function Skeleton({ className, ...props }: React.ComponentProps<typeof View>) {
  const sv = useSharedValue(1)

  React.useEffect(() => {
    sv.value = withRepeat(withTiming(0.5, { duration }), -1, true)
  }, [sv])

  const style = useAnimatedStyle(
    () => ({
      opacity: sv.value,
    }),
    [sv],
  )
  return (
    <Animated.View
      style={style}
      className={cn('bg-secondary dark:bg-muted rounded-md', className)}
      {...props}
    />
  )
}

export { Skeleton }
```

CLI 가 받은 파일이 위와 클래스 문자열까지 다르면(레지스트리가 바뀌었으면) 받은 것을 두고 위 두 곳만 고친다. 미디어 쿼리 변형이 들어 있으면 Step 2 처럼 뺀다.

- [ ] **Step 4: 내비게이션 테마의 색을 토큰에 맞춘다**

`test/unit/ui/nav-colors.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { NAV_COLOR_TOKENS, NAV_COLORS } from '@/platform/nav-colors'

/**
 * 내비게이션 테마의 색이 global.css 의 토큰과 같다. 토큰은 `oklch()` 이고 테마는 sRGB 16진수라
 * 사람이 옮겨 적는다 - 옮겨 적은 값은 반드시 어긋난다(D1 운반 기록: dark 의 card·primary·border,
 * 두 notification 이 어긋나 있었다).
 *
 * 변환은 CSS Color 4 의 OKLab → 선형 sRGB 행렬과 sRGB 감마다. 기기 위의 값으로 변환을 맞댄다 -
 * D1 실측 M1 이 화면 캡처에서 읽은 색(흰 화면의 버튼 #171717·글자 #0a0a0a, 다크의 버튼 #e5e5e5).
 */
function oklchToHex(lightness: number, chroma: number, hue: number, alpha?: number): string {
  const a = chroma * Math.cos((hue * Math.PI) / 180)
  const b = chroma * Math.sin((hue * Math.PI) / 180)
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
  const channel = (value: number): string => {
    const clamped = Math.min(1, Math.max(0, value))
    const encoded = clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055
    return Math.round(encoded * 255)
      .toString(16)
      .padStart(2, '0')
  }
  const opacity =
    alpha === undefined
      ? ''
      : Math.round(alpha * 255)
          .toString(16)
          .padStart(2, '0')
  return `#${linear.map(channel).join('')}${opacity}`
}

/** global.css 의 `@variant <이름> { … }` 블록에서 `--color-*` 토큰을 16진수로. */
function tokens(variant: 'light' | 'dark'): Record<string, string> {
  const css = readFileSync('global.css', 'utf8')
  const start = css.indexOf(`@variant ${variant} {`)
  const block = css.slice(start, css.indexOf('}', start))
  const found: Record<string, string> = {}
  const pattern =
    /--color-([\w-]+):\s*oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+)%)?\)/g
  for (const [, name, l, c, h, percent] of block.matchAll(pattern)) {
    if (name === undefined || l === undefined || c === undefined || h === undefined) continue
    found[name] = oklchToHex(
      Number(l),
      Number(c),
      Number(h),
      percent === undefined ? undefined : Number(percent) / 100,
    )
  }
  return found
}

describe('oklch → sRGB 변환', () => {
  it('D1 실측 M1 이 기기에서 읽은 색과 같다', () => {
    expect(oklchToHex(0.205, 0, 0)).toBe('#171717')
    expect(oklchToHex(0.145, 0, 0)).toBe('#0a0a0a')
    expect(oklchToHex(0.922, 0, 0)).toBe('#e5e5e5')
    expect(oklchToHex(0.985, 0, 0)).toBe('#fafafa')
  })
})

describe('NAV_COLORS - global.css 토큰과 같다', () => {
  it.each(['light', 'dark'] as const)('%s', (variant) => {
    const css = tokens(variant)
    const expected = Object.fromEntries(
      Object.entries(NAV_COLOR_TOKENS).map(([color, token]) => [color, css[token]]),
    )
    expect(NAV_COLORS[variant]).toEqual(expected)
  })
})
```

```bash
pnpm exec vitest run test/unit/ui/nav-colors.test.ts 2>&1 | tail -4
```

Expected: FAIL — `@/platform/nav-colors` 가 없다.

`platform/nav-colors.ts`:

```ts
/**
 * 내비게이션 테마(Stack 헤더·화면 배경)의 색 - global.css 의 토큰을 sRGB 로 옮긴 값이다. React
 * Native 는 `oklch()` 를 읽지 못해서 토큰을 그대로 쓸 수 없다.
 *
 * `NAV_COLOR_TOKENS` 가 색마다 어느 토큰을 옮겼는지 적는다(`card` 는 헤더 배경, `notification`
 * 은 배지 색). global.css 의 토큰을 바꾸면 test/unit/ui/nav-colors.test.ts 가 이 표와 어긋난 곳을
 * 알린다. 이 파일은 import 가 없다 - 그 시험이 node 에서 읽는다.
 */
export const NAV_COLORS = {
  light: {
    background: '#ffffff',
    border: '#e5e5e5',
    card: '#ffffff',
    notification: '#e7000b',
    primary: '#171717',
    text: '#0a0a0a',
  },
  dark: {
    background: '#0a0a0a',
    border: '#ffffff1a',
    card: '#171717',
    notification: '#ff6467',
    primary: '#e5e5e5',
    text: '#fafafa',
  },
} as const

/** 내비게이션 색 → global.css 의 `--color-*` 토큰 이름. */
export const NAV_COLOR_TOKENS = {
  background: 'background',
  border: 'border',
  card: 'card',
  notification: 'destructive',
  primary: 'primary',
  text: 'foreground',
} as const
```

`platform/theme.ts` 전체를 바꾼다:

```ts
import { DarkTheme, DefaultTheme, type Theme } from 'expo-router'

import { NAV_COLORS } from '@/platform/nav-colors'

/**
 * Stack 헤더·배경이 global.css 의 토큰과 같은 색을 쓰게 하는 내비게이션 테마. 색 값은
 * platform/nav-colors.ts 에 있다 - 토큰과 같은지를 시험이 node 에서 재도록 import 없는 파일로 뺐다.
 *
 * React Native Reusables 템플릿은 이 파일을 lib/theme.ts 에 두지만, expo-router 를
 * import 하므로 이 저장소에서는 lib/ 에 둘 수 없다(스펙 5장).
 */
export const NAV_THEME: Record<'light' | 'dark', Theme> = {
  light: { ...DefaultTheme, colors: NAV_COLORS.light },
  dark: { ...DarkTheme, colors: NAV_COLORS.dark },
}
```

```bash
pnpm exec vitest run test/unit/ui
```

Expected: PASS 6(변형 3, 색 3). 바뀐 값: light `notification` `hsl(0 84.2% 60.2%)` → `#e7000b`, dark `border` `hsl(0 0% 14.9%)` → `#ffffff1a`, `card` `hsl(0 0% 3.9%)` → `#171717`, `notification` `hsl(0 70.9% 59.4%)` → `#ff6467`, `primary` `hsl(0 0% 98%)` → `#e5e5e5`. 나머지 일곱은 값이 같다(표기만 16진수).

- [ ] **Step 5: `components.json` 의 훅 별칭을 바꾼다**

`components.json` — Edit, 찾을 것 `    "hooks": "@/queries"` — 바꿀 것 `    "hooks": "@/components/hooks"`.

- [ ] **Step 6: React Native Reusables 의 진단을 받아 소음 셋을 판정한다**

```bash
printf 'n\nn\nn\n' | BACKEND_URL=https://gate-check.invalid pnpm dlx @react-native-reusables/cli@0.7.1 doctor 2>&1 | sed 's/\x1b\[[0-9;?]*[a-zA-Z]//g' | tr '\r' '\n' | grep -v '^\s*$' | tail -12
git status --short
```

Expected: `Diagnosis` 아래 두 건 — `Missing Files (1) • Theme`, `Missing Dependencies (1) … tailwindcss-animate`. 설치를 물으면 "no" 다. `git status` 가 바뀌지 않았다(진단은 아무것도 쓰지 않는다). 다른 건이 나오면 그 출력을 L4 에 그대로 적고 항목마다 판정을 적는다.

- [ ] **Step 7: 기록·문서·스펙 정정을 쓴다**

`docs/superpowers/notes/2026-09-30-d3-measurements.md` 끝에 더한다(Step 6 의 출력이 위 Expected 와 같다는 전제다 — 다르면 L4 의 둘째 항목을 실제 출력으로 바꾼다):

````markdown

## L2 — Uniwind 1.12.0 의 미디어 블록 결함에 대한 대응 (스펙 16장, D1 실측 M1)

**정한 것.** 미디어 쿼리 변형(`sm:`·`md:`·`lg:`·`xl:`·`2xl:` 과 그 `max-`·`min-` 꼴, `portrait:`·`landscape:`)을
쓰지 않는다. `test/unit/ui/breakpoints.test.ts` 가 `app/`·`components/` 의 `.ts`·`.tsx` 를 훑어 막는다(객체
키 `sm: …` 는 콜론 뒤 공백으로 가른다).

**뺀 것.** React Native Reusables 에서 받은 세 파일 - `button.tsx` 크기 넷의 `sm:h-9`·`sm:h-8`·`sm:h-10`·
`sm:h-9 sm:w-9`, `text.tsx` 의 `p` 변형 `sm:mt-6` 과 `blockquote` 변형 `sm:mt-6 sm:pl-6`, `input.tsx` 의 `sm:h-9`
와 web 갈래의 `md:text-sm`. 폰에서 버튼 기본 높이가 40dp 로 돌아간다(D1 은 36dp 를 쟀다). 파일마다 "원본과
다른 곳" 주석이 있다.

**버린 선택지.**

- **패치**(`pnpm patch uniwind@1.12.0`): 결함은 `node_modules/uniwind/dist/metro/transformer.cjs` 의
  `parseRuleRec` 에서 `media` 규칙의 안쪽 규칙마다 `this.declarationConfig = this.getDeclarationConfig()` 로
  `mediaQueries` 를 비우는 한 줄이다. 고칠 수는 있지만 Metro 변환기의 안쪽을 고치는 패치를 템플릿 사용자가
  떠안고, 고친 결과는 번들을 풀어 봐야 잴 수 있다.
- **다른 버전**: npm `latest` 가 1.12.0(2026-09-04)이다. 고쳐진 릴리스가 없다.

**대가.** 640dp 이상(태블릿·펼친 폴더블)도 폰과 같은 크기를 쓴다. 되살릴 조건: 고쳐진 Uniwind 릴리스 - 그때
시험을 지우고 컴포넌트를 CLI 로 다시 받는다.

## L3 — 내비게이션 테마의 색 (D1 운반)

`platform/theme.ts` 의 색이 옛 shadcn 팔레트(hsl)라 `global.css` 의 토큰(oklch)과 어긋났다. 색 표를 import 없는
`platform/nav-colors.ts` 로 떼고, `test/unit/ui/nav-colors.test.ts` 가 토큰을 sRGB 로 바꿔 맞댄다(OKLab →
선형 sRGB 행렬과 sRGB 감마. D1 실측 M1 이 기기 화면에서 읽은 넷 - `#171717`·`#0a0a0a`·`#e5e5e5`·`#fafafa` - 으로
변환을 고정했다).

| 테마 | 색 | 토큰 | 옛 값 | 새 값 |
| --- | --- | --- | --- | --- |
| light | `notification` | `--color-destructive` `oklch(0.577 0.245 27.325)` | `hsl(0 84.2% 60.2%)` | `#e7000b` |
| dark | `border` | `--color-border` `oklch(1 0 0 / 10%)` | `hsl(0 0% 14.9%)` | `#ffffff1a` |
| dark | `card`(헤더 배경) | `--color-card` `oklch(0.205 0 0)` | `hsl(0 0% 3.9%)` | `#171717` |
| dark | `notification` | `--color-destructive` `oklch(0.704 0.191 22.216)` | `hsl(0 70.9% 59.4%)` | `#ff6467` |
| dark | `primary` | `--color-primary` `oklch(0.922 0 0)` | `hsl(0 0% 98%)` | `#e5e5e5` |

나머지 일곱(light 의 `background`·`border`·`card`·`primary`·`text`, dark 의 `background`·`text`)은 값이 같고
표기만 16진수가 됐다. 다크 모드의 헤더가 화면 배경(`#0a0a0a`)과 갈라진다 - 토큰의 `card` 가 그렇게 정했다.

## L4 — 소음 셋의 판정 (D1 운반)

- **prebuild 의 `» android: userInterfaceStyle: Install expo-system-ui in your project to enable this feature.`** -
  `expo-system-ui` 를 설치하지 않는다. `app.config.ts` 의 `userInterfaceStyle: 'automatic'` 은 iOS 의
  `UIUserInterfaceStyle` 에 들어가 필요하고, Android 에서는 설치해도 시스템 설정을 따르는 것 그대로다. D1 실측
  M1 이 다크 모드가 JS 쪽(Uniwind·내비게이션 테마·상태 표시줄)에서 도는 것을 쟀다. 경고는 남는다.
- **React Native Reusables CLI 의 "Potential issues"** - `printf 'n\nn\nn\n' | pnpm dlx @react-native-reusables/cli@0.7.1 doctor`
  (Task 3 Step 6)의 진단은 두 건이다: `Missing Files (1) • Theme`(CLI 는 `lib/theme.ts` 를 찾는다 - 이 저장소는
  expo-router 를 import 하는 그 파일을 `platform/theme.ts` 에 둔다, 스펙 5장)과 `Missing Dependencies (1)`
  (`tailwindcss-animate` - Tailwind v3 플러그인이고 이 저장소는 v4 용 `tw-animate-css` 를 쓴다). 둘 다 고치지
  않는다. D1 이 본 "4 Potential issues" 는 그 뒤 두 건으로 줄었다(`add` 가 "2 Potential issues" 를 낸다).
- **`expo export` 의 `web bundles (1)` 0 B CSS**(`_expo/static/css/global-d41d8cd98f00b204e9800998ecf8427e.css`) -
  이름의 해시가 빈 문자열의 MD5 다. 루트 레이아웃의 `import '@/global.css'` 를 Uniwind 가 네이티브에서는 JS 로
  바꾸고 CLI 는 빈 CSS 산출물만 적는다. 앱에 실리지 않고 `dist/` 는 커밋하지 않는다 - 둔다.
- **`components.json` 의 `"hooks": "@/queries"`** - `@/components/hooks` 로 바꿨다. React Native Reusables 의 훅은
  UI 도우미라 `queries/`(데이터)의 소유가 아니다.
````

루트 `AGENTS.md` 의 `## 로딩 표현` 절 바로 앞에 더한다:

```markdown
## React Native Reusables 컴포넌트

`components/ui/` 는 React Native Reusables CLI 로 받는다 -
`printf 'n\n' | BACKEND_URL=https://gate-check.invalid pnpm dlx @react-native-reusables/cli@0.7.1 add <이름> --styling-library uniwind --yes`
(이미 있는 `text.tsx` 등의 덮어쓰기는 "아니오"). 받은 파일에서 미디어 쿼리 변형(`sm:`·`md:` 등)을 뺀다 -
Uniwind 1.12.0 이 한 미디어 블록의 둘째 규칙부터 조건을 잃어 폰에서도 적용한다.
`test/unit/ui/breakpoints.test.ts` 가 `app/`·`components/` 를 훑어 막는다. 받은 파일을 고친 곳은 그 파일에
"원본과 다른 곳" 주석으로 남긴다. 근거는 `docs/superpowers/notes/2026-09-30-d3-measurements.md` 의 L2.
```

`platform/AGENTS.md` — Edit, 찾을 것(표의 `theme.ts` 행 — Task 2 의 `pnpm format` 이 `query-client.ts` 행에 맞춰 칸을 넓힌 뒤의 모양이다. 공백 수가 다르면 파일의 그 행을 통째로 바꾼다):

```markdown
| `theme.ts`                  | 내비게이션 테마                                                                                                                                                  |
```

바꿀 것:

```markdown
| `theme.ts` | 내비게이션 테마. 색은 `nav-colors.ts` |
| `nav-colors.ts` | 내비게이션 색 - `global.css` 토큰의 sRGB 값. import 가 없다 - `test/unit/ui/nav-colors.test.ts` 가 토큰과 맞댄다 |
```

스펙 — 16장 끝(`## 17. 완료 조건` 바로 앞 — D2 의 정정 다음)에 더한다:

```markdown

> 정정(2026-09-30, D3): 위 Uniwind 결함의 대응은 **미디어 쿼리 변형을 쓰지 않는 것**이다. `app/`·`components/`
> 에서 `sm:`·`md:` 같은 브레이크포인트 변형과 `max-`·`min-` 꼴, `portrait:`·`landscape:` 를
> `test/unit/ui/breakpoints.test.ts` 가 막고, React Native Reusables 에서 받은 컴포넌트(`button`·`input`·`text`)의
> 변형을 뺐다. 패치는 Metro 변환기 안쪽을 고쳐야 하고, 고쳐진 릴리스는 아직 없다(npm `latest` 1.12.0). 폰과
> 태블릿이 같은 크기를 쓴다. 근거는 `docs/superpowers/notes/2026-09-30-d3-measurements.md` 의 L2.
```

- [ ] **Step 8: 정적 검사를 돌린다**

```bash
pnpm format
pnpm typecheck && pnpm lint && pnpm format:check && pnpm lint:secrets
./scripts/check-citations.sh app components lib platform queries test
pnpm test 2>&1 | tail -4
```

Expected: 전부 exit 0, ESLint 경고 0. 시험은 6 늘어난다(966).

- [ ] **Step 9: 커밋한다**

```bash
git add components/ui platform/nav-colors.ts platform/theme.ts platform/AGENTS.md components.json test/unit/ui AGENTS.md docs/superpowers/notes/2026-09-30-d3-measurements.md docs/superpowers/specs
git status --short
git commit -m "feat: 미디어 쿼리 변형을 빼 Uniwind 결함을 피하고 배지·스켈레톤과 토큰에 맞춘 테마 색을 둔다"
```

---

### Task 4: 목록·상세 화면

**Files:**
- Create: `components/app/request-failed.tsx`, `components/app/not-found-view.tsx`, `components/app/sheet.tsx`, `components/resource/values.tsx`, `components/resource/resource-row.tsx`, `components/resource/resource-list.tsx`, `components/resource/resource-detail.tsx`, `components/resource/filter-sheet.tsx`, `components/resource/sort-sheet.tsx`, `components/resource/AGENTS.md`, `app/(app)/examples/index.tsx`, `app/(app)/examples/[id]/index.tsx`, `app/+not-found.tsx`
- Modify: `app/(app)/index.tsx`

**Interfaces:**
- Consumes: Task 1 의 view 함수·타입, Task 2 의 `useResourceList`·`useResourceDetail`·`ResourceListState`·`ResourceDetailState`, Task 3 의 `Badge`·`Skeleton`, D2 의 `FormBanner`·`Input`·`UNUSABLE_RESPONSE_MESSAGE`, D1 의 `Button`·`Text`·`Icon`, `EXAMPLE`(`@/lib/resources`)
- Produces:
  - 라우트: `/examples`(목록, 라우트 파라미터가 곧 쿼리), `/examples/[id]`(상세), `+not-found`
  - testID(Task 5 의 플로가 찾는다): `home-examples-link`, `examples-screen`, `resource-list`, `resource-row`, `resource-row-title`, `list-skeleton`, `list-empty`, `empty-clear-filters`, `list-footer-spinner`, `request-failed`, `retry-button`, `filter-button`, `sort-button`, `filter-sheet`, `filter-apply`, `filter-clear`, `filter-option-<키>-<연산자>-<값|any>`, `filter-input-<키>-<연산자>`, `sort-sheet`, `sort-option-<정렬 키>`, `detail-screen`, `detail-heading`, `detail-value-<항목 키>`, `detail-skeleton`, `not-found-screen`, `not-found-home`
  - `Sheet({ open, onClose, testID, children })`(`components/app/sheet.tsx`), `RequestFailed({ retrying, onRetry, compact? })`, `NotFoundView()`

- [ ] **Step 1: 앱 전체의 조각 셋을 쓴다**

`components/app/request-failed.tsx`:

```tsx
import { ActivityIndicator, View } from 'react-native'

import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { UNUSABLE_RESPONSE_MESSAGE } from '@/lib/auth/form-state'
import { cn } from '@/lib/utils'

/**
 * 백엔드가 응답조차 주지 못했을 때(네트워크 실패·타임아웃)의 자리 - 스펙 9.3 의 앱 문구와 "다시
 * 시도". 문구는 복사한 `UNUSABLE_RESPONSE_MESSAGE` 하나다 - 앱 자신의 문구를 새로 만들지 않는다.
 * 다시 부르는 동안에는 버튼이 글자 대신 스피너만 그린다(스펙 8.7).
 *
 * `compact` 는 목록 끝(뒤따르는 쪽의 실패)에 둘 때다 - 화면을 채우지 않는다.
 */
export function RequestFailed({
  retrying,
  onRetry,
  compact = false,
}: {
  retrying: boolean
  onRetry: () => void
  compact?: boolean
}) {
  return (
    <View
      testID="request-failed"
      className={cn('items-center gap-3 p-6', !compact && 'flex-1 justify-center')}
    >
      <Text className="text-center text-sm text-muted-foreground">{UNUSABLE_RESPONSE_MESSAGE}</Text>
      <Button
        testID="retry-button"
        variant="outline"
        accessibilityLabel="다시 시도"
        aria-busy={retrying}
        disabled={retrying}
        onPress={onRetry}
      >
        {retrying ? (
          <ActivityIndicator colorClassName="accent-foreground" />
        ) : (
          <Text>다시 시도</Text>
        )}
      </Button>
    </View>
  )
}
```

`components/app/not-found-view.tsx`:

```tsx
import { Link } from 'expo-router'
import { View } from 'react-native'

import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'

/**
 * 가리키는 것이 없을 때의 화면 - 없는 경로(`app/+not-found.tsx`)와 없는 자원의 상세(백엔드의
 * `RESOURCE_NOT_FOUND`, 스펙 9.2)가 함께 쓴다. 문구는 template-typescript-nextjs 의
 * `app/not-found.tsx` 와 같다.
 *
 * "홈으로 이동" 은 홈까지 닫는다(`dismissTo`) - 쌓인 화면 위에 홈을 한 벌 더 쌓지 않는다.
 */
export function NotFoundView() {
  return (
    <View
      testID="not-found-screen"
      className="flex-1 items-center justify-center gap-4 bg-background p-6"
    >
      <Text variant="h4" className="text-center">
        페이지를 찾을 수 없습니다
      </Text>
      <Text className="text-center text-sm text-muted-foreground">
        요청하신 페이지가 존재하지 않거나 이동되었습니다.
      </Text>
      <Link href="/" dismissTo asChild>
        <Button testID="not-found-home">
          <Text>홈으로 이동</Text>
        </Button>
      </Link>
    </View>
  )
}
```

`components/app/sheet.tsx`:

```tsx
import type { ReactNode } from 'react'
import { KeyboardAvoidingView, Modal, Platform, Pressable, View } from 'react-native'

/**
 * 화면 아래에서 올라오는 시트 - React Native 의 `Modal` 위에 둔다. 목록의 필터 시트와 정렬 메뉴가
 * 쓴다(스펙 8.1). React Native Reusables 에는 시트가 없어서 이 저장소가 만든다.
 *
 * 배경을 누르거나 Android 뒤로 가기를 누르면 닫힌다(`onRequestClose`). 머리 줄(제목·버튼)은
 * 쓰는 쪽이 그린다 - 입력이 든 시트는 버튼을 위에 두어 키보드가 가리지 않게 한다. iOS 는 키보드가
 * 올라오면 시트를 밀어 올린다 - Android 는 창이 스스로 줄어든다.
 */
export function Sheet({
  open,
  onClose,
  testID,
  children,
}: {
  open: boolean
  onClose: () => void
  testID: string
  children: ReactNode
}) {
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-end bg-black/50"
      >
        <Pressable className="flex-1" accessibilityLabel="닫기" onPress={onClose} />
        <View
          testID={testID}
          className="gap-3 rounded-t-2xl bg-background p-4 pb-8"
          style={{ maxHeight: '85%' }}
        >
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}
```

- [ ] **Step 2: 자원 UI 를 쓴다**

`components/resource/values.tsx`:

```tsx
import { View } from 'react-native'

import { Badge } from '@/components/ui/badge'
import { Text } from '@/components/ui/text'

/**
 * 목록의 칸과 상세의 항목이 함께 쓰는 값 조각 - template-typescript-nextjs 의
 * `components/resource/values.tsx` 를 React Native 로 옮긴 것이다. 같은 관계가 두 화면에서 다르게
 * 그려지면 그것이 결함이다.
 */

/** 값이 없음. 빈 칸 대신 그린다 - 비어 있다는 것이 보여야 한다. */
const EMPTY_VALUE = '—'

export function EmptyValue() {
  return <Text className="text-sm text-muted-foreground">{EMPTY_VALUE}</Text>
}

/** 관계 대상들의 배지. 이름은 `lib/resources/view.ts` 의 `relatedText` 가 정한다. */
export function RelatedBadges({ values }: { values: readonly string[] }) {
  return (
    <View className="flex-row flex-wrap gap-1">
      {values.map((value, position) => (
        // 같은 이름이 두 번 올 수 있어(서로 다른 id 의 동명 라벨) 위치를 키에 섞는다.
        <Badge key={`${position}-${value}`} variant="secondary">
          <Text>{value}</Text>
        </Badge>
      ))}
    </View>
  )
}
```

`components/resource/resource-row.tsx`:

```tsx
import { Pressable, View } from 'react-native'

import { Text } from '@/components/ui/text'
import type { ListCell, ListColumn, ListRow } from '@/lib/resources/view'

import { EmptyValue, RelatedBadges } from './values'

/**
 * 목록의 행 하나 - 표의 줄이 아니라 카드다(폰 폭에 열 여섯이 들어가지 않는다). 첫 칸(자원을
 * 대표하는 속성, `displayAttribute`)이 제목이고 나머지 칸은 "이름 값" 으로 잇는다. 관계 칸은
 * 배지다(`kind` 로 가른다 - 자원 이름이 아니라 구조다).
 *
 * 행 전체가 상세로 가는 버튼이다. 주소 규칙은 화면이 갖는다(`onOpen`).
 * testID 는 E2E 플로(test/e2e/)가 찾는 이름이다 - 바꾸면 플로도 함께 바꾼다.
 */
export function ResourceRow({
  columns,
  row,
  onOpen,
}: {
  columns: readonly ListColumn[]
  row: ListRow
  onOpen: (id: string) => void
}) {
  const [title, ...rest] = row.cells
  const labels = new Map(columns.map((column) => [column.key, column.label]))

  return (
    <Pressable
      testID="resource-row"
      accessibilityRole="button"
      onPress={() => {
        onOpen(row.id)
      }}
      className="gap-2 border-b border-border bg-background px-4 py-3 active:bg-accent"
    >
      {title === undefined || title.values.length === 0 ? (
        <EmptyValue />
      ) : (
        <Text testID="resource-row-title" className="text-base font-semibold">
          {title.values.join(' ')}
        </Text>
      )}
      <View className="flex-row flex-wrap gap-x-4 gap-y-1">
        {rest.map((cell) => (
          <CellEntry key={cell.key} label={labels.get(cell.key) ?? cell.key} cell={cell} />
        ))}
      </View>
    </Pressable>
  )
}

function CellEntry({ label, cell }: { label: string; cell: ListCell }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <Text className="text-xs text-muted-foreground">{label}</Text>
      {cell.values.length === 0 ? (
        <EmptyValue />
      ) : cell.kind === 'relationship' ? (
        <RelatedBadges values={cell.values} />
      ) : (
        <Text className="text-sm">{cell.values.join(' ')}</Text>
      )}
    </View>
  )
}
```

`components/resource/resource-list.tsx`:

```tsx
import { Link, type Href } from 'expo-router'
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native'

import { RequestFailed } from '@/components/app/request-failed'
import { FormBanner } from '@/components/form/form-banner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'
import type { ListFailure } from '@/lib/resources/view'
import type { ResourceListState } from '@/queries/resources'

import { ResourceRow } from './resource-row'

/**
 * 자원 목록 - 스펙 8.1 의 목록 화면 몸통. 무엇을 그릴지는 `listView`(lib/resources/view.ts)가 이미
 * 정해 왔다: 스켈레톤(첫 쪽 전) · 닿지 못함(앱 문구와 다시 시도) · 배너(백엔드 문구) · 목록.
 *
 * - 무한 스크롤: 끝에 닿으면 `loadMore` 를 부르고, 읽는 동안 끝에 스피너만 그린다(스펙 8.7).
 *   목록이 화면을 채우지 못하면 FlatList 가 곧바로 끝에 닿았다고 알려 다음 쪽을 이어 읽는다.
 * - 당겨서 새로고침: 사용자가 당긴 동안만 도는 스피너다 - 앱 복귀의 재조회는 돌리지 않는다.
 * - 빈 결과: 필터가 걸린 0건이면 "필터 지우기" 를 준다(필터 시트의 것과 같은 주소).
 *
 * testID 는 E2E 플로(test/e2e/)가 찾는 이름이다 - 바꾸면 플로도 함께 바꾼다.
 */
export function ResourceListView({
  list,
  clearFiltersHref,
  onOpen,
}: {
  list: ResourceListState
  /** 필터를 지운 같은 화면의 주소 - `clearFiltersHref`(lib/resources/view.ts)의 결과. */
  clearFiltersHref: Href
  onOpen: (id: string) => void
}) {
  const { view } = list
  if (view === null) return <ListSkeleton />
  if (view.kind === 'unreachable') {
    return <RequestFailed retrying={list.retrying} onRetry={list.retry} />
  }
  if (view.kind === 'banner') {
    return (
      <View className="p-4">
        <FormBanner messages={view.messages} />
      </View>
    )
  }

  return (
    <FlatList
      testID="resource-list"
      data={view.rows}
      keyExtractor={(row) => row.id}
      renderItem={({ item }) => <ResourceRow columns={view.columns} row={item} onOpen={onOpen} />}
      onEndReached={list.loadMore}
      onEndReachedThreshold={0.5}
      refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} />}
      ListEmptyComponent={
        <EmptyList filtered={view.filtered} clearFiltersHref={clearFiltersHref} />
      }
      ListFooterComponent={<ListFooter list={list} failure={view.failure} />}
      contentContainerClassName="grow"
    />
  )
}

function EmptyList({ filtered, clearFiltersHref }: { filtered: boolean; clearFiltersHref: Href }) {
  return (
    <View testID="list-empty" className="flex-1 items-center justify-center gap-3 p-8">
      <Text className="text-center text-sm text-muted-foreground">
        {filtered ? '조건에 맞는 항목이 없습니다.' : '아직 등록된 항목이 없습니다.'}
      </Text>
      {filtered ? (
        // push 다 - 뒤로 가기가 필터를 걸었던 목록으로 돌아간다(스펙 8.2).
        <Link href={clearFiltersHref} push asChild>
          <Button testID="empty-clear-filters" variant="outline">
            <Text>필터 지우기</Text>
          </Button>
        </Link>
      ) : null}
    </View>
  )
}

function ListFooter({ list, failure }: { list: ResourceListState; failure: ListFailure | null }) {
  if (failure?.kind === 'unreachable') {
    return <RequestFailed compact retrying={list.retrying} onRetry={list.retry} />
  }
  if (failure?.kind === 'banner') {
    return (
      <View className="p-4">
        <FormBanner messages={failure.messages} />
      </View>
    )
  }
  if (!list.loadingMore) return null
  return (
    <View className="items-center p-4">
      <ActivityIndicator testID="list-footer-spinner" colorClassName="accent-muted-foreground" />
    </View>
  )
}

/** 첫 쪽을 받기 전의 자리 - 글자 없이 행 모양만(스펙 8.7). */
const SKELETON_ROWS = 6

function ListSkeleton() {
  return (
    <View testID="list-skeleton" className="gap-5 p-4">
      {Array.from({ length: SKELETON_ROWS }, (_, row) => (
        <View key={row} className="gap-2">
          <Skeleton className="h-5 w-3/5" />
          <Skeleton className="h-4 w-4/5" />
        </View>
      ))}
    </View>
  )
}
```

`components/resource/resource-detail.tsx`:

```tsx
import { ScrollView, View } from 'react-native'

import { RequestFailed } from '@/components/app/request-failed'
import { NotFoundView } from '@/components/app/not-found-view'
import { FormBanner } from '@/components/form/form-banner'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'
import type { DetailField, DetailLabel } from '@/lib/resources/view'
import type { ResourceDetailState } from '@/queries/resources'

import { EmptyValue, RelatedBadges } from './values'

/**
 * 자원 상세 - 스펙 8.1 의 상세 화면 몸통. 무엇을 그릴지는 `detailView`(lib/resources/view.ts)가
 * 정해 왔다: 스켈레톤 · 상세 · not-found(없는 id, 스펙 9.2) · 닿지 못함 · 배너.
 *
 * 항목은 선언 순서 그대로 속성 전부와 관계 전부다(`detailFields` - 목록의 `listed` 를 따르지
 * 않는다). 시각은 UTC 다(`formatAttributeValue`). 여러 줄 본문은 줄바꿈을 그대로 그린다.
 *
 * testID 는 E2E 플로(test/e2e/)가 찾는 이름이다 - `detail-value-<항목 키>` 의 키는 자원 선언에서
 * 온다(자원 이름으로 분기하지 않는다).
 */
export function ResourceDetailView({
  detail,
  labels,
}: {
  detail: ResourceDetailState
  /** 스켈레톤의 줄 수 - `detailLabels`(선언만으로 정해진다). */
  labels: readonly DetailLabel[]
}) {
  const { view } = detail
  if (view === null) return <DetailSkeleton labels={labels} />
  if (view.kind === 'notFound') return <NotFoundView />
  if (view.kind === 'unreachable') {
    return <RequestFailed retrying={detail.retrying} onRetry={detail.retry} />
  }
  if (view.kind === 'banner') {
    return (
      <View className="p-4">
        <FormBanner messages={view.messages} />
      </View>
    )
  }

  return (
    <ScrollView
      testID="detail-screen"
      className="flex-1 bg-background"
      contentContainerClassName="gap-4 p-4"
    >
      <Text testID="detail-heading" variant="h3">
        {view.heading}
      </Text>
      {view.fields.map((field) => (
        <View key={field.key} className="gap-1">
          <Text className="text-sm font-medium text-muted-foreground">{field.label}</Text>
          <FieldValue field={field} />
        </View>
      ))}
    </ScrollView>
  )
}

function FieldValue({ field }: { field: DetailField }) {
  if (field.values.length === 0) return <EmptyValue />
  if (field.kind === 'relationship') return <RelatedBadges values={field.values} />
  return (
    <Text testID={`detail-value-${field.key}`} className="text-base">
      {field.values.join(' ')}
    </Text>
  )
}

/** 응답을 받기 전의 자리 - 글자 없이 항목 모양만(스펙 8.7). 줄 수는 선언이 정한다. */
function DetailSkeleton({ labels }: { labels: readonly DetailLabel[] }) {
  return (
    <View testID="detail-skeleton" className="gap-4 p-4">
      <Skeleton className="h-8 w-3/5" />
      {labels.map((label) => (
        <View key={label.key} className="gap-1.5">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-5 w-3/4" />
        </View>
      ))}
    </View>
  )
}
```

`components/resource/filter-sheet.tsx`:

```tsx
import { useState } from 'react'
import { Pressable, ScrollView, View } from 'react-native'

import { Sheet } from '@/components/app/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Text } from '@/components/ui/text'
import {
  filterFieldsKey,
  filterFormValues,
  type FilterField,
  type FilterFormValues,
  type FilterOption,
} from '@/lib/resources/view'
import { cn } from '@/lib/utils'

/**
 * 필터 시트 - 스펙 8.1. 무엇을 그릴지는 `filterFields`(lib/resources/view.ts)가 선언에서 정해
 * 왔다: 다중 선택(enum + in) · 단일 선택(enum + exact, isNull) · 텍스트(contains·exact) ·
 * 범위(비교 연산자). 자원 이름은 이 파일에 없다.
 *
 * 시트는 URL 의 조건에서 시작하고(`filterFormValues`), "적용" 에서만 URL 을 바꾼다 - 닫으면
 * 적용하지 않은 입력을 버린다. 값 → 주소 변환(`filterHref`)은 화면이 한다. 입력을 검증하지
 * 않는다 - 규칙의 정본은 백엔드다(스펙 9.2).
 *
 * "적용"·"필터 지우기" 는 시트 머리 줄에 둔다 - 입력에 키보드가 올라와도 가리지 않는다.
 *
 * testID 는 선언에서 만든다: 보기 `filter-option-<키>-<연산자>-<값|any>`, 입력
 * `filter-input-<키>-<연산자>`. E2E 플로(test/e2e/)가 찾는 이름이다.
 */
export function FilterSheet({
  open,
  fields,
  onApply,
  onClear,
  onClose,
}: {
  open: boolean
  fields: readonly FilterField[]
  onApply: (values: FilterFormValues) => void
  onClear: () => void
  onClose: () => void
}) {
  return (
    <Sheet open={open} onClose={onClose} testID="filter-sheet">
      {/* 열 때마다 URL 의 값으로 다시 만든다 - 조건이 바뀐 URL 에서는 열쇠도 바뀐다. */}
      {open ? (
        <FilterForm
          key={filterFieldsKey(fields)}
          fields={fields}
          onApply={onApply}
          onClear={onClear}
        />
      ) : null}
    </Sheet>
  )
}

type SetValues = (parameter: string, values: readonly string[]) => void

function FilterForm({
  fields,
  onApply,
  onClear,
}: {
  fields: readonly FilterField[]
  onApply: (values: FilterFormValues) => void
  onClear: () => void
}) {
  const [values, setValues] = useState<FilterFormValues>(() => filterFormValues(fields))
  const set: SetValues = (parameter, next) => {
    setValues((current) => ({ ...current, [parameter]: next }))
  }

  return (
    <>
      <View className="flex-row items-center gap-2">
        <Text variant="large" className="flex-1">
          필터
        </Text>
        <Button testID="filter-clear" variant="outline" size="sm" onPress={onClear}>
          <Text>필터 지우기</Text>
        </Button>
        <Button
          testID="filter-apply"
          size="sm"
          onPress={() => {
            onApply(values)
          }}
        >
          <Text>적용</Text>
        </Button>
      </View>
      <ScrollView contentContainerClassName="gap-5 pb-2" keyboardShouldPersistTaps="handled">
        {fields.map((field) => (
          <FieldControl key={field.id} field={field} values={values} onChange={set} />
        ))}
      </ScrollView>
    </>
  )
}

function FieldControl({
  field,
  values,
  onChange,
}: {
  field: FilterField
  values: FilterFormValues
  onChange: SetValues
}) {
  if (field.kind === 'select') {
    const chosen = values[field.parameter] ?? []
    return (
      <View className="gap-2">
        <Text className="text-sm font-medium">{field.label}</Text>
        <View className="flex-row flex-wrap gap-2">
          {field.options.map((option) => (
            <OptionChip
              key={option.value}
              testID={`filter-option-${field.key}-${field.operator}-${option.value === '' ? 'any' : option.value}`}
              option={option}
              multiple={field.multiple}
              // 단일 선택의 "전체"(값 '')는 아무것도 고르지 않은 상태다.
              selected={option.value === '' ? chosen.length === 0 : chosen.includes(option.value)}
              onPress={() => {
                if (!field.multiple) {
                  onChange(field.parameter, option.value === '' ? [] : [option.value])
                } else if (chosen.includes(option.value)) {
                  onChange(
                    field.parameter,
                    chosen.filter((value) => value !== option.value),
                  )
                } else {
                  onChange(field.parameter, [...chosen, option.value])
                }
              }}
            />
          ))}
        </View>
      </View>
    )
  }

  if (field.kind === 'text') {
    return (
      <View className="gap-2">
        <Text className="text-sm font-medium">{field.label}</Text>
        <Input
          testID={`filter-input-${field.key}-${field.operator}`}
          accessibilityLabel={field.label}
          value={values[field.parameter]?.[0] ?? ''}
          onChangeText={(text) => {
            onChange(field.parameter, [text])
          }}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
    )
  }

  return (
    <View className="gap-2">
      <Text className="text-sm font-medium">{field.label}</Text>
      <View className="flex-row items-center gap-2">
        {[field.lower, field.upper].map((bound, index) =>
          bound === null ? null : (
            <Input
              key={bound.parameter}
              testID={`filter-input-${field.key}-${bound.operator}`}
              accessibilityLabel={`${field.label} ${index === 0 ? '최소' : '최대'}`}
              // 날짜는 날짜 입력이 그리는 모양 그대로 쓴다 - 경계 순간으로 바꾸는 것은 filterQuery 다.
              placeholder={field.shape === 'date' ? 'YYYY-MM-DD' : ''}
              keyboardType={field.shape === 'number' ? 'number-pad' : 'default'}
              value={values[bound.parameter]?.[0] ?? ''}
              onChangeText={(text) => {
                onChange(bound.parameter, [text])
              }}
              className="flex-1"
            />
          ),
        )}
      </View>
    </View>
  )
}

function OptionChip({
  testID,
  option,
  multiple,
  selected,
  onPress,
}: {
  testID: string
  option: FilterOption
  multiple: boolean
  selected: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole={multiple ? 'checkbox' : 'radio'}
      accessibilityState={multiple ? { checked: selected } : { selected }}
      onPress={onPress}
      className={cn(
        'rounded-full border px-3 py-1.5',
        selected ? 'border-primary bg-primary' : 'border-border bg-background active:bg-accent',
      )}
    >
      <Text className={cn('text-sm', selected && 'text-primary-foreground')}>{option.label}</Text>
    </Pressable>
  )
}
```

`components/resource/sort-sheet.tsx`:

```tsx
import { ArrowDown, ArrowUp, ArrowUpDown, SlidersHorizontal } from 'lucide-react-native'
import { Pressable, View } from 'react-native'

import { Sheet } from '@/components/app/sheet'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { Text } from '@/components/ui/text'
import type { SortOption } from '@/lib/resources/view'
import { cn } from '@/lib/utils'

/**
 * 목록 위의 도구 줄과 정렬 메뉴 - 스펙 8.1. 항목과 누르면 갈 주소는 `sortOptions`
 * (lib/resources/view.ts)가 선언에서 정해 왔다. 지금 걸린 항목(`direction` 이 있는 것)은 방향
 * 화살표를 달고, 누르면 방향이 뒤집힌 주소로 간다.
 *
 * 정렬 메뉴와 필터 시트는 오류 상태에서도 연다 - 잘못된 조건의 URL 에서 빠져나갈 수단이다.
 * testID 는 E2E 플로(test/e2e/)가 찾는 이름이다 - 항목은 `sort-option-<정렬 키>`.
 */
export function ListToolbar({
  sortOptions,
  onFilter,
  onSort,
}: {
  sortOptions: readonly SortOption[]
  onFilter: () => void
  onSort: () => void
}) {
  const current = sortOptions.find((option) => option.direction !== null)

  return (
    <View className="flex-row gap-2 border-b border-border px-4 py-2">
      <Button testID="filter-button" variant="outline" size="sm" onPress={onFilter}>
        <Icon as={SlidersHorizontal} className="size-4" />
        <Text>필터</Text>
      </Button>
      <Button testID="sort-button" variant="outline" size="sm" onPress={onSort}>
        <Icon as={ArrowUpDown} className="size-4" />
        <Text>{current === undefined ? '정렬' : current.label}</Text>
      </Button>
    </View>
  )
}

export function SortSheet({
  open,
  options,
  onPick,
  onClose,
}: {
  open: boolean
  options: readonly SortOption[]
  onPick: (href: string) => void
  onClose: () => void
}) {
  return (
    <Sheet open={open} onClose={onClose} testID="sort-sheet">
      <Text variant="large">정렬</Text>
      {options.map((option) => (
        <Pressable
          key={option.key}
          testID={`sort-option-${option.key}`}
          accessibilityRole="button"
          accessibilityState={{ selected: option.direction !== null }}
          onPress={() => {
            onPick(option.href)
          }}
          className="flex-row items-center justify-between rounded-md px-3 py-3 active:bg-accent"
        >
          <Text className={cn(option.direction !== null && 'font-semibold')}>{option.label}</Text>
          {option.direction === null ? null : (
            <Icon as={option.direction === 'asc' ? ArrowUp : ArrowDown} className="size-4" />
          )}
        </Pressable>
      ))}
    </Sheet>
  )
}
```

`components/resource/AGENTS.md`:

````markdown
# components/resource/ 작업 지침

자원 선언을 읽어 그리는 획일 UI 다(스펙 5장). **자원 이름으로 분기하지 않는다** - 무엇을 그릴지는
`lib/resources/view.ts` 가 선언에서 정해 온다(`ListView`·`DetailView`·`FilterField`·`SortOption`). 분기해도 되는
것은 구조뿐이다: 칸·항목의 `kind`, 필터 필드의 `kind`·`shape`·`operator`, 정렬 항목의 `direction`.

| 파일 | 그리는 것 |
| --- | --- |
| `resource-list.tsx` | 목록 - 스켈레톤·닿지 못함·배너·행 목록·빈 결과, 끝의 스피너와 뒤따르는 쪽의 실패, 당겨서 새로고침 |
| `resource-row.tsx` | 행 하나(카드) - 첫 칸이 제목, 나머지는 "이름 값", 관계 칸은 배지 |
| `resource-detail.tsx` | 상세 - 스켈레톤·not-found·닿지 못함·배너·항목 목록 |
| `filter-sheet.tsx` | 필터 시트 - 다중·단일 선택, 텍스트, 범위. "적용"·"필터 지우기" 는 머리 줄에 |
| `sort-sheet.tsx` | 목록 위 도구 줄(필터·정렬 버튼)과 정렬 메뉴 |
| `values.tsx` | 빈 값(`—`)과 관계 배지 - 목록과 상세가 같이 쓴다 |

- 판단을 두지 않는다. 쿼리·주소 조립과 응답 → 화면 상태는 `lib/resources/view.ts`, 요청과 캐시는
  `queries/resources.ts` 다. 주소로의 이동(`router.push`)은 화면(`app/`)이 한다.
- 로딩에 글자를 쓰지 않는다 - 첫 로딩은 스켈레톤, 더 읽기·당겨서 새로고침·다시 시도는 스피너(스펙 8.7).
- 백엔드가 응답조차 주지 못한 자리(`unreachable`)는 `components/app/request-failed.tsx` 가 그린다 - 앱 문구
  하나(`UNUSABLE_RESPONSE_MESSAGE`)와 "다시 시도"(스펙 9.3).
- testID 는 E2E 플로(`test/e2e/flows/examples-*.yaml`)가 찾는 이름이다. 선언에서 만드는 이름 -
  `filter-option-<키>-<연산자>-<값|any>`·`filter-input-<키>-<연산자>`·`sort-option-<정렬 키>`·`detail-value-<항목 키>` -
  의 규칙을 바꾸면 플로도 함께 바꾼다.
- 클래스에 미디어 쿼리 변형(`sm:` 등)을 쓰지 않는다 - 루트 `AGENTS.md` 의 "React Native Reusables 컴포넌트".
````

- [ ] **Step 3: 화면을 쓴다**

`app/(app)/examples/index.tsx`:

```tsx
import { router, Stack, useLocalSearchParams, type Href } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'

import { FilterSheet } from '@/components/resource/filter-sheet'
import { ResourceListView } from '@/components/resource/resource-list'
import { ListToolbar, SortSheet } from '@/components/resource/sort-sheet'
import { EXAMPLE } from '@/lib/resources'
import { clearFiltersHref, filterFields, filterHref, sortOptions } from '@/lib/resources/view'
import { useResourceList } from '@/queries/resources'

/**
 * Example 목록 - 스펙 8.1·8.2·8.3. 라우트 파라미터가 곧 쿼리다: 딥링크 하나로 같은 목록이
 * 재현되고, 조건을 바꾸면 새 목록 화면을 쌓아 뒤로 가기가 이전 조건을 되살린다(`router.push`).
 *
 * 이 파일에는 훅 호출과 JSX 만 있다(스펙 8.4) - 쿼리 조립·행 변환·오류 갈래는
 * lib/resources/view.ts, 요청과 캐시는 queries/resources.ts 가 한다.
 */

/** 이 화면의 주소. 필터·정렬을 바꾼 주소는 이 경로에 쿼리를 붙인 것이다. */
const LIST_PATH = '/examples' satisfies Href

export default function ExamplesScreen() {
  const params = useLocalSearchParams()
  const list = useResourceList(EXAMPLE, params)
  const [sheet, setSheet] = useState<'filter' | 'sort' | null>(null)
  const fields = filterFields(EXAMPLE, params)
  const options = sortOptions(EXAMPLE, LIST_PATH, params)
  // lib 가 만든 앱 안 주소다 - 타입드 라우트가 모르는 문자열이라 단언한다. 단언은 변수에 담는다
  // (D2 의 login.tsx 와 같은 이유 - prop 자리의 단언은 새 체크아웃의 lint 가 막는다).
  const clearHref = clearFiltersHref(LIST_PATH, params) as Href

  const go = (href: string) => {
    setSheet(null)
    const target = href as Href
    router.push(target)
  }

  return (
    <View testID="examples-screen" className="flex-1 bg-background">
      <Stack.Screen options={{ title: 'Example' }} />
      <ListToolbar
        sortOptions={options}
        onFilter={() => {
          setSheet('filter')
        }}
        onSort={() => {
          setSheet('sort')
        }}
      />
      <ResourceListView
        list={list}
        clearFiltersHref={clearHref}
        onOpen={(id) => {
          router.push({ pathname: '/examples/[id]', params: { id } })
        }}
      />
      <FilterSheet
        open={sheet === 'filter'}
        fields={fields}
        onApply={(values) => {
          go(filterHref(LIST_PATH, fields, params, values))
        }}
        onClear={() => {
          go(clearFiltersHref(LIST_PATH, params))
        }}
        onClose={() => {
          setSheet(null)
        }}
      />
      <SortSheet
        open={sheet === 'sort'}
        options={options}
        onPick={go}
        onClose={() => {
          setSheet(null)
        }}
      />
    </View>
  )
}
```

`app/(app)/examples/[id]/index.tsx`:

```tsx
import { Stack, useLocalSearchParams } from 'expo-router'

import { ResourceDetailView } from '@/components/resource/resource-detail'
import { EXAMPLE } from '@/lib/resources'
import { detailLabels } from '@/lib/resources/view'
import { useResourceDetail } from '@/queries/resources'

/**
 * Example 상세 - 스펙 8.1. 없는 id(형식이 틀린 id 도 같다)는 not-found 를 그린다(스펙 9.2).
 * 이 파일에는 훅 호출과 JSX 만 있다(스펙 8.4).
 */
export default function ExampleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const detail = useResourceDetail(EXAMPLE, id)

  return (
    <>
      <Stack.Screen
        options={{ title: detail.view?.kind === 'detail' ? detail.view.heading : 'Example' }}
      />
      <ResourceDetailView detail={detail} labels={detailLabels(EXAMPLE)} />
    </>
  )
}
```

`app/+not-found.tsx`:

```tsx
import { Stack } from 'expo-router'

import { NotFoundView } from '@/components/app/not-found-view'

/** 앱에 없는 경로 - 딥링크로 들어온 모르는 주소도 여기 온다. */
export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: '찾을 수 없음' }} />
      <NotFoundView />
    </>
  )
}
```

`app/(app)/index.tsx` — Edit 셋. 찾을 것 `import { Stack } from 'expo-router'` — 바꿀 것 `import { Link, Stack } from 'expo-router'`. 찾을 것 `import { Text } from '@/components/ui/text'` — 바꿀 것:

```tsx
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
```

찾을 것:

```tsx
      <Text variant="h3">template-typescript-expo</Text>
```

바꿀 것:

```tsx
      <Text variant="h3">template-typescript-expo</Text>
      <Link href="/examples" asChild>
        <Button testID="home-examples-link">
          <Text>Example 목록</Text>
        </Button>
      </Link>
```

고친 뒤의 파일:

```tsx
import { Link, Stack } from 'expo-router'
import { View } from 'react-native'

import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'

export default function HomeScreen() {
  return (
    <View
      testID="home-screen"
      className="flex-1 items-center justify-center gap-4 bg-background p-6"
    >
      <Stack.Screen options={{ title: '홈' }} />
      <Text variant="h3">template-typescript-expo</Text>
      <Link href="/examples" asChild>
        <Button testID="home-examples-link">
          <Text>Example 목록</Text>
        </Button>
      </Link>
    </View>
  )
}
```

- [ ] **Step 4: 정적 검사와 번들을 돌린다**

이 저장소의 `expo start` 를 끄고 돈다(`--clear`).

```bash
pnpm format
BACKEND_URL=https://gate-check.invalid pnpm types:routes
pnpm typecheck && pnpm lint && pnpm format:check && pnpm lint:secrets
./scripts/check-citations.sh app components lib platform queries test
pnpm test 2>&1 | tail -4
APP_VARIANT=production BACKEND_URL=https://gate-check.invalid pnpm exec expo export --clear --platform android --platform ios --output-dir dist 2>&1 | tail -8
```

Expected: 전부 exit 0. 타입드 라우트에 `/examples`·`/examples/[id]` 가 생겨 `LIST_PATH satisfies Href` 와 `router.push({ pathname: '/examples/[id]', … })` 가 검사된다. 타입 오류가 `Href` 에서 나면 런타임에 만든 문자열의 단언이 빠진 자리다 — 단언은 변수에 담는다(D2 의 login.tsx 와 같은 이유). 번들에 `Unable to resolve module` 이 없다(NetInfo·reanimated·lucide 아이콘까지 끌어온다). `web bundles (1)` 의 0 B CSS 는 L4 의 판정대로 둔다.

- [ ] **Step 5: 커밋한다**

화면의 기기 동작은 Task 5 의 E2E 가 잰다(스펙 11.1 — 컴포넌트 단위 시험을 두지 않는다).

```bash
git add components app
git status --short
git commit -m "feat: 무한 스크롤·필터 시트·정렬 메뉴의 목록과 관계 배지·not-found 의 상세 화면을 더한다"
```

---

### Task 5: 목록·상세 E2E, 신선도 실측, 하네스 보강, 게이트

**Files:**
- Create: `test/e2e/scripts/examples-api.js`, `test/e2e/flows/examples-browse.yaml`, `test/e2e/flows/examples-sort-filter.yaml`, `test/e2e/flows/examples-empty-notfound.yaml`, `test/e2e/flows/examples-scroll-refresh.yaml`, `test/e2e/flows/examples-invalid-filter-en.yaml`, `test/e2e/flows/auth-links.yaml`
- Modify: `test/e2e/run-android.sh`(API_URL·`api.log`·빌드 지문 — M10·로캘 앞 단계의 실패), `test/e2e/android.sh`(링 버퍼 — M9), `test/e2e/AGENTS.md`, `AGENTS.md`, `docs/superpowers/notes/2026-09-30-d3-measurements.md`(L5·L6), 스펙 11.3 정정, (Task 2 에서 미뤘으면) `pnpm-workspace.yaml`

**Interfaces:**
- Consumes: Task 4 의 testID·라우트, D2 의 하네스(`flows/*.yaml`·머리말·env·`start-signed-out.yaml`·가드·`android.sh`·`build_fingerprint`)와 게이트 `[12/12]`, D2 실측 기록 H1, 씨앗 `probe-seed` 여섯 건, D2 의 로그인·가입 testID
- Produces: 하네스의 Maestro env `API_URL`(`http://127.0.0.1:$API_PORT`)와 플로마다의 백엔드 접근 로그 `.maestro-output/e2e/<플로>/api.log`, 기기 로그 링 버퍼 16MiB(`android.sh boot`), 빌드 지문의 레시피(`test/e2e/android.sh`), `test/e2e/scripts/examples-api.js`(`STEP=seed|create|rename`, `output.prefix`·`output.token`·`output.firstId`), 플로 여섯(목록·상세 다섯, `auth-links`), D3 실측 기록 L5·L6

- [ ] **Step 1: 하네스를 고친다 — 백엔드 주소, 플로마다의 접근 로그, 빌드 지문, 기기 로그 버퍼, 로캘 앞 단계**

(0) Task 2 Step 3 에서 릴리스 대기 예외를 `아직` 으로 남겼으면, 그 단계의 시각 확인 명령, `pnpm-workspace.yaml` 의 Edit, 마지막 확인 명령(`grep`·`pnpm install --frozen-lockfile`·`pnpm peers check`)을 여기서 한다(NetInfo 설치는 다시 하지 않는다) — `pnpm-workspace.yaml` 은 빌드 지문에 드는 파일이라 이 태스크의 첫 빌드(Step 4) 앞이어야 한다. 그래도 `아직` 이면 두고 L6 에 "T10 은 D4 의 첫 의존성 변경으로" 라고 적는다.

(1) Maestro 에 백엔드 주소를 넘긴다. `test/e2e/run-android.sh` — Edit, 찾을 것:

```bash
# 플로에는 EMAIL·OTHER_EMAIL(플로마다 새로 만든다 - test/e2e/probe-email.ts)과 PASSWORD 가 env 로
# 들어간다. OTHER_EMAIL 은 한 플로 안에서 두 번째 사용자가 필요할 때 쓴다.
```

바꿀 것:

```bash
# 플로에는 EMAIL·OTHER_EMAIL(플로마다 새로 만든다 - test/e2e/probe-email.ts)과 PASSWORD 가 env 로
# 들어간다. OTHER_EMAIL 은 한 플로 안에서 두 번째 사용자가 필요할 때 쓴다. API_URL 은 호스트에서
# 백엔드에 닿는 주소다 - 플로의 runScript(test/e2e/scripts/)가 앱을 거치지 않고 행을 만들 때 쓴다.
```

`test/e2e/run-android.sh` — Edit, 찾을 것:

```bash
    -e "EMAIL=$email" -e "OTHER_EMAIL=$other_email" -e "PASSWORD=$E2E_PASSWORD" "$flow" >"$out/maestro.log" 2>&1 || rc=$?
```

바꿀 것:

```bash
    -e "EMAIL=$email" -e "OTHER_EMAIL=$other_email" -e "PASSWORD=$E2E_PASSWORD" \
    -e "API_URL=http://127.0.0.1:$API_PORT" "$flow" >"$out/maestro.log" 2>&1 || rc=$?
```

(2) 플로마다 그 플로 동안의 백엔드 접근 로그(uvicorn 의 요청 줄)를 `api.log` 로 남긴다 — Step 5 의 원인 가르기와 Step 6 의 신선도 확인이 읽는다. 같은 파일에 Edit 넷을 더한다. 첫째, 찾을 것:

```bash
# 결과(Maestro 출력·디버그 기록·기기 로그)는 플로마다 .maestro-output/e2e/<플로>/ 에 남는다.
```

바꿀 것:

```bash
# 결과(Maestro 출력·디버그 기록·기기 로그·그 플로 동안의 백엔드 접근 로그 api.log)는 플로마다
# .maestro-output/e2e/<플로>/ 에 남는다.
```

둘째, 찾을 것 `  local flow=$1 name locale allowed email other_email out rc=0 logcat_rc=0` — 바꿀 것 `  local flow=$1 name locale allowed email other_email out since rc=0 logcat_rc=0`.

셋째, 찾을 것:

```bash
  echo "--- $name${locale:+ ($locale)}"
```

바꿀 것:

```bash
  echo "--- $name${locale:+ ($locale)}"
  # 백엔드 접근 로그를 이 플로의 몫만 남긴다 - 5초 앞에서 자른다(호스트와 Docker 의 시계 차이).
  since=$(date -u -d '5 seconds ago' +%Y-%m-%dT%H:%M:%SZ)
```

넷째, 찾을 것:

```bash
  "$ADB" logcat -d -v brief -s ReactNativeJS:V AndroidRuntime:E >"$out/logcat.txt" 2>&1 || logcat_rc=$?
```

바꿀 것:

```bash
  "$ADB" logcat -d -v brief -s ReactNativeJS:V AndroidRuntime:E >"$out/logcat.txt" 2>&1 || logcat_rc=$?
  # 백엔드 접근 로그는 원인을 가르는 기록일 뿐 가드가 아니다 - 모으지 못해도 플로를 실패로 치지 않는다.
  compose --profile fastapi logs --no-color --since "$since" api-fastapi >"$out/api.log" 2>&1 || true
```

(3) 빌드 지문에 빌드 레시피를 넣는다(결정 32). `test/e2e/run-android.sh` — Edit, 찾을 것:

```bash
# 빌드에 들어가는 파일의 지문 - 시험·문서·스크립트·마크다운을 뺀 추적·미추적(무시 제외) 파일의
# 이름과 내용, 그리고 앱이 볼 백엔드 주소. 플로만 고친 실행은 APK 를 다시 만들지 않는다.
build_fingerprint() {
  {
    git ls-files -z -co --exclude-standard -- . ':!test' ':!docs' ':!scripts' ':!*.md' |
      existing_files | xargs -0 sha1sum
```

바꿀 것:

```bash
# 빌드에 들어가는 파일의 지문 - 시험·문서·스크립트·마크다운을 뺀 추적·미추적(무시 제외) 파일의
# 이름과 내용, 빌드 레시피, 그리고 앱이 볼 백엔드 주소. 플로만 고친 실행은 APK 를 다시 만들지 않는다.
# 빌드 레시피(test/e2e/android.sh - prebuild 인자와 APP_VARIANT)는 test/ 안에 있어 위 목록의 제외에
# 걸린다(git 의 제외 pathspec 은 포함 pathspec 보다 앞선다) - 따로 더한다. 빠지면 레시피를 고쳐도 낡은
# APK 가 조용히 다시 쓰인다.
build_fingerprint() {
  {
    git ls-files -z -co --exclude-standard -- . ':!test' ':!docs' ':!scripts' ':!*.md' |
      existing_files | xargs -0 sha1sum
    sha1sum test/e2e/android.sh
```

(4) 기기 로그의 링 버퍼를 넓힌다(결정 31). `test/e2e/android.sh` — Edit, 찾을 것:

```bash
#                                   죽으면 에뮬레이터 로그의 꼬리를 내고 실패한다. 기기가 여럿인데
#                                   ANDROID_SERIAL 이 없으면 곧바로 실패한다
```

바꿀 것:

```bash
#                                   죽으면 에뮬레이터 로그의 꼬리를 내고 실패한다. 기기가 여럿인데
#                                   ANDROID_SERIAL 이 없으면 곧바로 실패한다. 끝으로 기기 로그의 링
#                                   버퍼를 16MiB 로 넓힌다(이미 켜진 기기도)
```

`test/e2e/android.sh` — Edit, 찾을 것:

```bash
  "$ADB" shell settings put secure autofill_service null
}
```

바꿀 것:

```bash
  "$ADB" shell settings put secure autofill_service null
  # 기기 로그의 링 버퍼를 넓힌다. 하네스는 플로마다 로그를 비우고 끝에 모으는데, 기본 크기는 긴 플로
  # (목록의 무한 스크롤 등) 하나를 다 담지 못할 수 있다 - 앞쪽 줄이 밀려나면 W·E 줄을 놓쳐 가드가 가짜로
  # 통과하고, 선언한 [e2e-http] 줄을 놓쳐 가짜로 실패한다. 재부팅하면 기본 크기로 돌아가므로 부팅할
  # 때마다(이미 켜진 기기여도) 정한다.
  "$ADB" logcat -G 16M
}
```

(5) 두 변경을 하네스 문서에 적는다. `test/e2e/AGENTS.md` — Edit, 찾을 것:

```markdown
빌드 입력(시험·문서·스크립트를 뺀 파일)이 지난번과 같으면 APK 를 다시 만들지 않는다 - 플로만
```

바꿀 것:

```markdown
빌드 입력(시험·문서·스크립트를 뺀 파일과, `test/` 안에 있지만 빌드 레시피인 `test/e2e/android.sh`)이 지난번과
같으면 APK 를 다시 만들지 않는다 - 플로만
```

`test/e2e/AGENTS.md` — Edit, 찾을 것(D2 의 끝 `ac88fe0` 의 `boot` 문단 끝):

```markdown
전환과 "비밀번호 저장" 대화상자가 단언을 흔들지 않게) - 그 기기가 실기기면(`ANDROID_SERIAL`로 골랐든 하나뿐이라 그대로
쓰였든) 끝난 뒤 기기 설정에서 손으로 되돌린다.
```

바꿀 것:

```markdown
전환과 "비밀번호 저장" 대화상자가 단언을 흔들지 않게) - 그 기기가 실기기면(`ANDROID_SERIAL`로 골랐든 하나뿐이라 그대로
쓰였든) 끝난 뒤 기기 설정에서 손으로 되돌린다. 기기 로그의 링 버퍼도 16MiB 로 넓힌다(`logcat -G 16M`, 재부팅하면
기본 크기로 돌아간다) - 하네스는 플로마다 로그를 비우고 끝에 모으므로, 버퍼가 긴 플로 하나를 다 담지 못하면 앞쪽의
경고·오류 줄을 놓쳐 가드가 가짜로 통과하고 선언한 `[e2e-http]` 줄을 놓쳐 가짜로 실패한다.
```

(6) 로캘 플로의 앞 단계 둘이 실패를 넘기지 않게 한다(결정 38). `run_flow` 는 `||` 문맥에서 불려 `set -e` 가 꺼져 있다. `test/e2e/run-android.sh` — Edit, 찾을 것:

```bash
    "$ADB" shell pm clear "$APP_ID" >/dev/null
    "$ADB" shell cmd locale set-app-locales "$APP_ID" --locales "$locale"
```

바꿀 것:

```bash
    if ! "$ADB" shell pm clear "$APP_ID" >/dev/null ||
      ! "$ADB" shell cmd locale set-app-locales "$APP_ID" --locales "$locale"; then
      echo "E2E: $name 앞에서 앱 상태를 지우거나 앱별 언어를 정하지 못했다(pm clear·set-app-locales)" >&2
      return 1
    fi
```

(7) 확인한다. 지문은 저장소를 클론한 임시 사본에서 잰다 — 레시피를 고치면 지문이 바뀌고 플로만 고치면 그대로여야 한다:

```bash
bash -n test/e2e/run-android.sh && bash -n test/e2e/android.sh && echo "syntax ok"
grep -n 'API_URL=http\|--since "\$since"\|sha1sum test/e2e/android.sh' test/e2e/run-android.sh
grep -n 'logcat -G 16M' test/e2e/android.sh
date -u -d '5 seconds ago' +%Y-%m-%dT%H:%M:%SZ
tmp=$(mktemp -d)
git clone -q . "$tmp/r"
cp test/e2e/run-android.sh test/e2e/android.sh "$tmp/r/test/e2e/"
(
  cd "$tmp/r"
  eval "$(sed -n '/^existing_files() {/,/^}/p;/^build_fingerprint() {/,/^}/p' test/e2e/run-android.sh)"
  APP_BACKEND_URL=http://10.0.2.2:4100
  a=$(build_fingerprint)
  echo '# probe' >>test/e2e/android.sh
  b=$(build_fingerprint)
  echo '# probe' >>test/e2e/flows/guard-return.yaml
  c=$(build_fingerprint)
  echo "레시피를 고치면 바뀐다: $([ "$a" != "$b" ] && echo yes || echo no) / 플로만 고치면 바뀐다: $([ "$b" != "$c" ] && echo yes || echo no)"
)
rm -rf "$tmp"
```

Expected: `syntax ok`, `run-android.sh` 의 세 줄(`API_URL` 줄은 줄 끝의 `\` 로 앞 줄과 이어진다), `android.sh` 의 한 줄, 시각 한 줄(Git Bash 의 GNU `date` 가 `-d` 를 받는다), `레시피를 고치면 바뀐다: yes / 플로만 고치면 바뀐다: no`. 링 버퍼는 Step 4 가 기기에서 확인한다.

- [ ] **Step 2: 행을 만드는 스크립트와 플로 여섯을 쓴다**

`test/e2e/scripts/examples-api.js`:

```js
/* global http, json, output, API_URL, EMAIL, PASSWORD, STEP, COUNT, TITLE */
/**
 * 목록·상세 E2E 가 볼 행을 백엔드에 직접 만든다 - 앱에는 아직 쓰기 화면이 없다(D4 가 만든다).
 *
 * Maestro 의 runScript 로 돈다. 에뮬레이터가 아니라 호스트의 GraalJS 에서 돌아서 백엔드에
 * 호스트 주소(API_URL, 하네스가 -e 로 준다)로 닿는다. http·json·output 은 Maestro 가 주는 전역이다.
 * 이 요청들은 앱을 지나지 않으므로 기기 로그의 가드(test/e2e/guard-log.sh)에 걸리지 않는다.
 *
 *   STEP=seed    EMAIL·PASSWORD 로 가입·로그인하고 행 COUNT 개(제목 `<prefix> 01` …)를 만든다.
 *                output.prefix(이 실행만의 제목 접두사)·output.token·output.firstId 를 남긴다
 *   STEP=create  제목이 TITLE 인 행 하나를 만든다(seed 뒤에만)
 *   STEP=rename  첫 행(`<prefix> 01`)의 제목을 TITLE 로 바꾼다(seed 뒤에만)
 *
 * 실패하면 던진다 - Maestro 가 그 단계를 실패로 적고 플로가 멈춘다.
 */
const MEDIA_TYPE = 'application/vnd.api+json'

function call(method, path, body, token) {
  const headers = { 'Content-Type': MEDIA_TYPE, Accept: MEDIA_TYPE }
  if (token !== undefined) headers.Authorization = `Bearer ${token}`
  const response = http.request(`${API_URL}${path}`, {
    method,
    headers,
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(`${method} ${path} → ${response.status} ${response.body}`)
  return json(response.body)
}

function createExample(title) {
  const document = { data: { type: 'examples', attributes: { title, status: 'draft', score: 50 } } }
  return call('POST', '/api/v1/examples', document, output.token).data.id
}

if (STEP === 'seed') {
  const credentials = (type) => ({
    data: { type, attributes: { email: EMAIL, password: PASSWORD } },
  })
  call('POST', '/api/v1/auth/register', credentials('users'))
  output.token = call(
    'POST',
    '/api/v1/auth/login',
    credentials('authCredentials'),
  ).data.attributes.accessToken
  // 실행·플로마다 다른 이메일(test/e2e/probe-email.ts)의 끝 12자 - 다른 실행의 행이 목록 단언을
  // 흔들지 못한다(제목 접두사로 좁힌다, 스펙 11.3).
  output.prefix = `probe-d3-${EMAIL.split('@')[0].slice(-12)}`
  for (let n = 1; n <= Number(COUNT); n += 1) {
    const id = createExample(`${output.prefix} ${String(n).padStart(2, '0')}`)
    if (n === 1) output.firstId = id
  }
} else if (STEP === 'create') {
  createExample(TITLE)
} else if (STEP === 'rename') {
  call(
    'PATCH',
    `/api/v1/examples/${output.firstId}`,
    { data: { type: 'examples', id: output.firstId, attributes: { title: TITLE } } },
    output.token,
  )
} else {
  throw new Error(`STEP 을 모른다: ${STEP}`)
}
```

`test/e2e/flows/examples-browse.yaml`:

```yaml
# 홈에서 목록으로, 딥링크의 필터·정렬로 좁힌 목록의 행·관계 배지·UTC 시각, 행을 눌러 상세의 여러 줄
# 설명·두 시각·배지, 뒤로 가기(스펙 8.1·8.2·11.3). 행은 씨앗(test/e2e/seed/examples.sql)의
# probe-seed 여섯 건이다 - 제목 접두사로 좁혀 다른 플로의 행을 보지 않는다.
appId: com.example.templateexpo.e2e
---
- runFlow: ../subflows/start-signed-out.yaml
- tapOn:
    id: home-examples-link
- extendedWaitUntil:
    visible:
      id: resource-list
    timeout: 20000
- back
- extendedWaitUntil:
    visible:
      id: home-screen
    timeout: 10000
# 딥링크가 조건을 그대로 재현한다 - 제목 순서(sort=title)의 씨앗 여섯 건.
- openLink: templateexpo-e2e://examples?filter%5Btitle%5D%5Bcontains%5D=probe-seed&sort=title
- extendedWaitUntil:
    visible:
      id: resource-row-title
      text: probe-seed alpha
    timeout: 20000
- assertVisible:
    text: probe-seed bravo
    below:
      text: probe-seed alpha
- assertVisible:
    text: probe-seed charlie
    below:
      text: probe-seed bravo
# 관계 배지(분류·태그)와 UTC 시각 - alpha 는 2026-04-06T05:06:07+00:00 에 만들어졌다.
- assertVisible: 프로브 분류 하나
- assertVisible: 프로브 라벨 둘
- assertVisible: 2026-04-06 05:06
# 상세 - 목록에 없는 설명(여러 줄)과 수정 시각까지 그린다.
- tapOn:
    id: resource-row-title
    text: probe-seed bravo
- extendedWaitUntil:
    visible:
      id: detail-heading
      text: probe-seed bravo
    timeout: 20000
- assertVisible:
    id: detail-value-description
    text: '프로브 설명 첫 줄\n프로브 설명 둘째 줄'
- assertVisible:
    id: detail-value-status
    text: 활성
- assertVisible:
    id: detail-value-createdAt
    text: 2026-04-02 05:06
- assertVisible:
    id: detail-value-updatedAt
    text: 2026-04-15 01:02
- assertVisible: 프로브 분류 하나
- assertVisible: 프로브 라벨 하나
- back
- extendedWaitUntil:
    visible:
      id: resource-row-title
      text: probe-seed alpha
    timeout: 10000
```

`test/e2e/flows/examples-sort-filter.yaml`:

```yaml
# 정렬 메뉴와 필터 시트가 조건을 바꾸고, 뒤로 가기가 이전 조건을 되살린다(스펙 8.1·8.2).
# 씨앗 여섯 건의 순서(test/e2e/seed/examples.sql 머리말의 표):
#   -createdAt(기본) alpha charlie echo foxtrot bravo delta
#   -score           foxtrot bravo delta echo alpha charlie
# 두 순서가 갈리는 쌍으로만 단언한다 - 둘 다에서 참인 쌍은 아무것도 재지 않는다. 여섯째 행은 폰
# 화면 끝에 걸릴 수 있어 다섯째 행까지만 쓴다.
appId: com.example.templateexpo.e2e
---
- runFlow: ../subflows/start-signed-out.yaml
- openLink: templateexpo-e2e://examples?filter%5Btitle%5D%5Bcontains%5D=probe-seed
- extendedWaitUntil:
    visible:
      id: resource-row-title
      text: probe-seed alpha
    timeout: 20000
- assertVisible:
    text: probe-seed foxtrot
    below:
      text: probe-seed alpha
# 점수를 처음 누르면 높은 것부터다.
- tapOn:
    id: sort-button
- tapOn:
    id: sort-option-score
- extendedWaitUntil:
    visible:
      text: probe-seed alpha
      below:
        text: probe-seed foxtrot
    timeout: 20000
- assertVisible:
    text: probe-seed echo
    below:
      text: probe-seed delta
# 뒤로 가기 - 기본 정렬의 목록으로 돌아간다.
- back
- extendedWaitUntil:
    visible:
      text: probe-seed foxtrot
      below:
        text: probe-seed alpha
    timeout: 10000
- assertVisible:
    text: probe-seed bravo
    below:
      text: probe-seed echo
# 필터 시트: 상태 활성 + 점수 70 이상 - bravo(활성·77)만 남는다. delta 는 활성이지만 63,
# foxtrot 은 94 지만 보관이다. 제목 접두사는 시트가 URL 에서 이어받는다.
- tapOn:
    id: filter-button
- extendedWaitUntil:
    visible:
      id: filter-sheet
    timeout: 10000
- tapOn:
    id: filter-option-status-in-active
- tapOn:
    id: filter-input-score-gte
- inputText: '70'
# "적용" 은 시트 머리 줄에 있다 - 키보드를 내리지 않는다(Maestro 의 hideKeyboard 는 Android 에서
# 뒤로 가기라, 키보드가 없으면 시트를 닫는다).
- tapOn:
    id: filter-apply
- extendedWaitUntil:
    visible:
      id: resource-row-title
      text: probe-seed bravo
    timeout: 20000
- assertNotVisible:
    id: resource-row-title
    text: probe-seed delta
- assertNotVisible:
    id: resource-row-title
    text: probe-seed foxtrot
# 뒤로 가기 - 필터 없는(제목 접두사만 있는) 목록으로 돌아간다. charlie 는 보관·0점이라 위 필터에
# 걸리지 않던 행이다.
- back
- extendedWaitUntil:
    visible:
      id: resource-row-title
      text: probe-seed charlie
    timeout: 10000
```

`test/e2e/flows/examples-empty-notfound.yaml`:

```yaml
# e2e-allow-http: 404
# 빈 결과와 필터 지우기, 없는 id 의 not-found(스펙 8.1·9.2), 없는 경로(app/+not-found.tsx).
# 없는 id 는 형식이 맞는 UUID 든 틀린 값이든 같은 404 RESOURCE_NOT_FOUND 다.
appId: com.example.templateexpo.e2e
---
- runFlow: ../subflows/start-signed-out.yaml
- openLink: templateexpo-e2e://examples?filter%5Btitle%5D%5Bcontains%5D=probe-d3-nothing-matches
- extendedWaitUntil:
    visible:
      id: list-empty
    timeout: 20000
- assertNotVisible:
    id: resource-row
# 필터 지우기 - 조건 없는 목록이다. 씨앗이 있으므로 행이 보인다.
- tapOn:
    id: empty-clear-filters
- extendedWaitUntil:
    visible:
      id: resource-row
    timeout: 20000
- assertNotVisible:
    id: list-empty
- openLink: templateexpo-e2e://examples/00000000-0000-4000-8000-00000000d3d3
- extendedWaitUntil:
    visible:
      id: not-found-screen
    timeout: 20000
- tapOn:
    id: not-found-home
- extendedWaitUntil:
    visible:
      id: home-screen
    timeout: 10000
- openLink: templateexpo-e2e://examples/probe-not-a-uuid
- extendedWaitUntil:
    visible:
      id: not-found-screen
    timeout: 20000
- openLink: templateexpo-e2e://probe-no-such-route
- extendedWaitUntil:
    visible:
      id: not-found-screen
    timeout: 20000
```

`test/e2e/flows/examples-scroll-refresh.yaml`:

```yaml
# 무한 스크롤(스펙 8.3), 당겨서 새로고침, 앱 복귀의 재조회(스펙 8.5), 다시 들어온 상세의 재조회 -
# 셋 다 목록을 연 뒤 백엔드에서 바뀐 것이 화면에 와야 한다. 네이티브 HTTP 캐시(OkHttp)가 옛
# 응답을 주면 여기서 실패한다(docs/superpowers/notes/2026-09-30-d3-measurements.md).
# 행은 이 플로가 백엔드에 직접 만든다(test/e2e/scripts/examples-api.js) - 제목이 이 실행만의
# 접두사로 시작해 다른 플로의 행을 보지 않는다.
appId: com.example.templateexpo.e2e
---
- runFlow: ../subflows/start-signed-out.yaml
- runScript:
    file: ../scripts/examples-api.js
    env:
      STEP: seed
      COUNT: '25'
- openLink: templateexpo-e2e://examples?filter%5Btitle%5D%5Bcontains%5D=${output.prefix}&sort=title
- extendedWaitUntil:
    visible:
      id: resource-row-title
      text: ${output.prefix} 01
    timeout: 20000
# 첫 쪽은 20건이다 - 25번째 행은 끝에 닿아 다음 쪽을 읽어야 나타난다.
- scrollUntilVisible:
    element:
      id: resource-row-title
      text: ${output.prefix} 25
    direction: DOWN
    timeout: 30000
- assertNotVisible:
    id: list-footer-spinner
# 당겨서 새로고침 - 목록을 연 뒤 만든 행(제목 순서의 맨 앞)이 나타난다.
- scrollUntilVisible:
    element:
      id: resource-row-title
      text: ${output.prefix} 01
    direction: UP
    timeout: 30000
- runScript:
    file: ../scripts/examples-api.js
    env:
      STEP: create
      TITLE: ${output.prefix} 00
- swipe:
    start: 50%, 35%
    end: 50%, 85%
    duration: 1000
- extendedWaitUntil:
    visible:
      id: resource-row-title
      text: ${output.prefix} 00
    timeout: 20000
# 앱 복귀 - 뒤로 보냈다 앞으로 불러오면 당기지 않아도 다시 부른다(AppState → focusManager).
- runScript:
    file: ../scripts/examples-api.js
    env:
      STEP: create
      TITLE: ${output.prefix} 000
- pressKey: Home
- launchApp:
    stopApp: false
- extendedWaitUntil:
    visible:
      id: resource-row-title
      text: ${output.prefix} 000
    timeout: 20000
# 상세 - 다시 들어오면 캐시를 그린 뒤 다시 부른다(staleTime 0). 백엔드에서 바꾼 제목이 나타난다.
- tapOn:
    id: resource-row-title
    text: ${output.prefix} 01
- extendedWaitUntil:
    visible:
      id: detail-heading
      text: ${output.prefix} 01
    timeout: 20000
- back
- runScript:
    file: ../scripts/examples-api.js
    env:
      STEP: rename
      TITLE: ${output.prefix} 01 renamed
- tapOn:
    id: resource-row-title
    text: ${output.prefix} 01
- extendedWaitUntil:
    visible:
      id: detail-heading
      text: ${output.prefix} 01 renamed
    timeout: 20000
```

`test/e2e/flows/examples-invalid-filter-en.yaml`:

```yaml
# e2e-app-locale: en-US
# e2e-allow-http: 400
# 정책에 없는 필터 연산자는 막지 않고 보낸다 - 백엔드의 400 INVALID_FILTER 가 배너로 뜬다(스펙 8.2).
# 문구는 기기 언어를 따른다: 영어 쪽에 한글이 없다(스펙 9.4) - 목록의 요청도 Accept-Language 를
# 싣는 한 자리(platform/api.ts)를 지난다. 헤더가 빠지면 백엔드가 ko 로 떨어져 여기서 실패한다.
appId: com.example.templateexpo.e2e
---
# clearState 를 쓰지 않는다 - 하네스가 정한 앱별 언어가 지워진다(D1 실측 M3).
- launchApp
- extendedWaitUntil:
    visible:
      id: home-screen
    timeout: 30000
- openLink: templateexpo-e2e://examples?filter%5Btitle%5D%5Bprobe%5D=probe-d3
- extendedWaitUntil:
    visible:
      id: form-banner-message
    timeout: 20000
- assertNotVisible:
    id: form-banner-message
    text: '[\s\S]*[\uAC00-\uD7A3][\s\S]*'
- assertVisible:
    id: form-banner-message
    text: '[\s\S]*[A-Za-z][\s\S]*'
# 잘못된 조건의 화면에서도 필터·정렬을 열 수 있다 - 빠져나갈 수단이다.
- assertVisible:
    id: filter-button
- assertVisible:
    id: sort-button
```

앱 안의 로그인·가입 링크를 누르는 플로(결정 33, D2 최종 검토 M11) — `test/e2e/flows/auth-links.yaml`:

```yaml
# 앱 안의 로그인·가입 링크를 기기에서 누른다(스펙 7.3·7.4). 다른 플로는 로그인·가입 화면에 딥링크로 들어간다.
# 보호 경로 → 로그인 → "가입하기"(register-link) → "로그인"(login-link) → 다시 "가입하기" → 가입 → next 의 화면.
# 링크는 next 를 이어받는다(lib/auth/flow.ts 의 authLinkHref) - 두 번 건넌 뒤에도 이어져야 가입한 사용자가 홈이
# 아니라 막혔던 화면에 닿는다. 계정 생성 안내의 링크는 가입이 되고 자동 로그인만 실패해야 보여 여기서 일으키지
# 않는다 - 같은 Link asChild + Text 모양을 login-link 가 잰다.
appId: com.example.templateexpo.e2e
---
- runFlow: ../subflows/start-signed-out.yaml
# 보호 경로를 딥링크로 연다 - 경로 가드가 next 를 싣고 로그인으로 보낸다.
- openLink: templateexpo-e2e://examples/new
- extendedWaitUntil:
    visible:
      id: login-screen
    timeout: 15000
- tapOn:
    id: register-link
- extendedWaitUntil:
    visible:
      id: register-screen
    timeout: 15000
- tapOn:
    id: login-link
- extendedWaitUntil:
    visible:
      id: login-screen
    timeout: 15000
- tapOn:
    id: register-link
- extendedWaitUntil:
    visible:
      id: register-screen
    timeout: 15000
- runFlow: ../subflows/submit-credentials.yaml
# 가입은 로그인까지 이어지고(스펙 7.4) 링크 두 번을 건넌 next 로 간다.
- extendedWaitUntil:
    visible:
      id: new-example-screen
    timeout: 20000
- assertVisible:
    id: logout-button
# 복귀한 화면 아래에 홈이 깔려 있다 - 가입 화면의 dismissTo 도 withAnchor 를 준다(guard-return 은 로그인 화면 쪽을
# 잰다). 가입 화면이 사라지며 키보드도 내려가 있어 뒤로 가기는 화면을 닫는다.
- pressKey: back
- extendedWaitUntil:
    visible:
      id: home-screen
    timeout: 15000
- assertVisible:
    id: logout-button
```

`test/e2e/AGENTS.md` — `## 돌리기` 절 바로 앞에 더한다:

````markdown
## 목록·상세 플로

- 목록의 행은 testID 와 데이터 문구를 함께 준다(`id: resource-row-title` + `text: probe-seed alpha`). 행의 제목은
  백엔드의 데이터라 로캘과 무관하다 - 오류 문구와 다르다.
- 딥링크의 대괄호는 퍼센트 인코딩한다(`filter%5Btitle%5D%5Bcontains%5D=…`) - 앱이 만드는 주소와 같은 모양이다
  (`docs/superpowers/notes/2026-09-30-d3-measurements.md` 의 L1).
- 순서는 `below:` 로 잰다. 비교하는 두 정렬에서 **답이 갈리는 쌍**만 쓴다 - 둘 다에서 참인 쌍은 아무것도 재지
  않는다. 폰 화면에 행이 다섯 넘게 들어간다고 기대지 않는다.
- `hideKeyboard` 를 쓰지 않는다 - Maestro 2.11.0 의 Android 구현은 뒤로 가기라 키보드가 없으면 시트를 닫는다. 입력이
  든 시트는 버튼을 머리 줄에 둔다.
- 행이 씨앗으로 모자라면 `runScript` 로 백엔드에 직접 만든다 - `scripts/examples-api.js`(`STEP=seed|create|rename`).
  스크립트는 호스트의 GraalJS 에서 돌고, 하네스가 넘기는 `API_URL`(호스트에서 백엔드에 닿는 주소)로 요청한다.
  앱을 지나지 않으므로 기기 로그의 가드에 걸리지 않는다. 만든 행의 제목은 `output.prefix`
  (`probe-d3-<이메일 끝 12자>`)로 시작한다 - 실행·플로마다 달라 다른 플로의 행을 보지 않는다.
- 씨앗의 접두사 `probe-seed` 는 읽기 전용이다 - 그 접두사로 행을 만들지 않는다.
- 하네스는 플로마다 그 플로 동안의 백엔드 접근 로그를 `.maestro-output/e2e/<플로>/api.log` 로 남긴다 - 화면이 옛 값을
  그릴 때 요청이 서버에 닿았는지(네이티브 HTTP 캐시인지 앱이 다시 부르지 않은 것인지) 이 로그로 가른다.
````

```bash
pnpm exec prettier --write test/e2e
node --check test/e2e/scripts/examples-api.js && pnpm exec eslint test/e2e/scripts
MAESTRO="${MAESTRO:-$HOME/.maestro/bin/maestro}"
for f in test/e2e/flows/examples-*.yaml test/e2e/flows/auth-links.yaml; do MAESTRO_CLI_NO_ANALYTICS=1 "$MAESTRO" --no-ansi check-syntax "$f" >/dev/null && echo "ok $f"; done
```

Expected: ESLint 0건, `ok …` 여섯 줄.

- [ ] **Step 3: D2 의 캐시 머리글 판정을 읽는다**

```bash
grep -n "^\*\*판정\.\*\*" docs/superpowers/notes/2026-09-30-d2-measurements.md
git grep -n "cache-control" -- lib/jsonapi/client.ts
```

Expected: 판정 한 줄. 첫째 갈래("신선도 수명을 주지 않는다")면 `client.ts` 에 `cache-control` 이 없다. 둘째 갈래면 D2 가 GET 에 `Cache-Control: no-cache` 를 실었다(D2 결정 33) — 어느 쪽이든 이 태스크의 `examples-scroll-refresh` 가 기기에서 신선도를 잰다(결정 28). 판정 문장을 Step 7 의 L5 에 옮긴다.

- [ ] **Step 4: E2E 를 돌린다**

첫 실행은 Task 2–4 로 빌드 입력이 바뀌어 짧은 경로 사본의 설치(NetInfo 가 새로 들어온다)와 네이티브 빌드(5~6분)가 겹친다 — 백그라운드로 돌리고 끝나기를 기다린다(도구의 전경 제한은 10분이다). 플로는 D2 의 일곱과 D3 의 여섯(목록·상세 다섯, `auth-links`)이다.

```bash
mkdir -p .maestro-output
docker ps --filter name=joon- -q | wc -l
E2E_AVD=Pixel_9_API_36 ./test/e2e/run-android.sh > .maestro-output/e2e-run.log 2>&1; echo "e2e exit=$?"
tail -30 .maestro-output/e2e-run.log
docker ps --filter name=joon- -q | wc -l
docker ps --filter label=com.docker.compose.project=template-typescript-expo-e2e -q | wc -l
"$ANDROID_HOME/platform-tools/adb" logcat -g
```

Expected: 앞뒤 `9`, `e2e exit=0`, 마지막 줄 `=== E2E 통과 - 플로 13개 ===`(D2 의 일곱 + D3 의 여섯 — Task 1 Step 1 에서 D2 의 수가 달랐으면 그 수 + 6), 우리 compose 프로젝트의 컨테이너 `0`, `logcat -g` 의 버퍼마다 16 MiB(`main: ring buffer is 16 MiB …` — 판에 따라 `16Mb`). 16 MiB 가 아니면 `android.sh boot` 의 `logcat -G` 가 먹지 않은 것이다 — 그 출력을 L6 에 적고 결정 31 의 "틀리면" 대로 고친다.

- [ ] **Step 5: 실패하면 원인을 고친다**

실패한 플로의 `.maestro-output/e2e/<플로>/` 에서 `maestro.log`·`debug/`(스크린샷)·`logcat.txt` 를 본다. **원인을 고친다** — 제한 시간을 늘리거나 단언을 지우거나 가드를 약하게 하지 않는다(스펙 16장: 재시도 0). 앱 코드를 고치면 지문이 바뀌어 다음 실행이 다시 빌드한다. 한 플로만 다시 돌릴 때는 `E2E_FLOW="examples-sort-filter"` 처럼 준다. 이미 아는 갈래 셋:

(a) **시트 안의 요소를 Maestro 가 못 찾는다**(`filter-option-…`·`sort-option-…` 에서 `Element not found` 인데 스크린샷에는 시트가 떠 있다) — `Modal` 의 별도 창을 Maestro 가 보지 못하는 것이다(결정 22). `components/app/sheet.tsx` 전체를 아래 Portal 판으로 바꾼다 — 루트의 `PortalHost`(D1·D2 의 `app/_layout.tsx`)에 같은 창으로 그리고, Android 뒤로 가기는 `BackHandler` 로 닫는다. 사용하는 쪽(`filter-sheet.tsx`·`sort-sheet.tsx`)은 고치지 않는다.

```tsx
import { Portal } from '@rn-primitives/portal'
import { useEffect, type ReactNode } from 'react'
import { BackHandler, KeyboardAvoidingView, Platform, Pressable, View } from 'react-native'

/**
 * 화면 아래에서 올라오는 시트 - 루트의 PortalHost 에 같은 창으로 그린다. 목록의 필터 시트와 정렬
 * 메뉴가 쓴다(스펙 8.1). React Native 의 Modal(별도 창)은 E2E 의 Maestro 가 창 안의 요소를 찾지
 * 못해 쓰지 않는다(docs/superpowers/notes/2026-09-30-d3-measurements.md 의 L6).
 *
 * 배경을 누르거나 Android 뒤로 가기를 누르면 닫힌다. 머리 줄(제목·버튼)은 쓰는 쪽이 그린다.
 */
export function Sheet({
  open,
  onClose,
  testID,
  children,
}: {
  open: boolean
  onClose: () => void
  testID: string
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose()
      return true
    })
    return () => {
      subscription.remove()
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <Portal name={testID}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="absolute inset-0 justify-end bg-black/50"
      >
        <Pressable className="flex-1" accessibilityLabel="닫기" onPress={onClose} />
        <View
          testID={testID}
          className="gap-3 rounded-t-2xl bg-background p-4 pb-8"
          style={{ maxHeight: '85%' }}
        >
          {children}
        </View>
      </KeyboardAvoidingView>
    </Portal>
  )
}
```

바꿨으면 `pnpm typecheck && pnpm lint` 뒤 E2E 를 다시 돌리고, L6 에 "Modal 을 Portal 로 바꿨다 - 그 이유(출력 한 줄)" 를 적는다. 결정 22 의 "틀리면" 갈래다.

(b) **`examples-scroll-refresh` 의 새로고침·앱 복귀·재진입 단계가 새 값을 못 본다** — 요청이 백엔드에 닿았는지부터 가른다. 그 플로의 백엔드 접근 로그(Step 1 의 `api.log`)에서 앱의 GET 을 본다:

```bash
grep "GET /api/v1/examples" .maestro-output/e2e/examples-scroll-refresh/api.log
```

단계마다 GET 이 찍히는데 화면이 옛 값이면 네이티브 HTTP 캐시가 옛 응답을 준 것이다 — D2 계획 Task 6 Step 5 의 "수명이 있으면" 묶음(`request()` 가 GET 에 `Cache-Control: no-cache` 를 싣는다, 시험 둘, 이탈 기록 둘)을 그대로 적용하고 다시 돌린다(결정 28 의 "틀리면" 갈래). GET 이 찍히지 않으면 앱이 다시 부르지 않은 것이다 — `platform/query-client.ts` 의 재조회 배선(`useQueryRefetchTriggers` 가 `AppRoot` 에서 불리는가)과 `staleTime` 을 본다. 어느 쪽이든 원인과 고친 것을 L5 에 적는다.

(c) **`W/ReactNativeJS`·`E/ReactNativeJS` 가 가드에 걸린다** — 그 경고를 내는 코드를 고친다(중복 키, `Text` 밖의 글자 등).

- [ ] **Step 6: 가드와 신선도가 실제로 무는지 보고, 화면을 눈으로 본다**

(a) 선언한 상태가 기기 로그에 실제로 있고, 선언하지 않은 D3 플로에는 실패 표식이 없다:

```bash
for pair in examples-empty-notfound:404 examples-invalid-filter-en:400; do
  f=${pair%%:*}; s=${pair##*:}; echo "$f $(grep -c "\[e2e-http\] $s " ".maestro-output/e2e/$f/logcat.txt")"
done
grep -c "\[e2e-http\]" .maestro-output/e2e/examples-browse/logcat.txt .maestro-output/e2e/examples-sort-filter/logcat.txt .maestro-output/e2e/examples-scroll-refresh/logcat.txt .maestro-output/e2e/auth-links/logcat.txt
grep -c 'Running "main"' .maestro-output/e2e/examples-scroll-refresh/logcat.txt
wc -l < .maestro-output/e2e/examples-scroll-refresh/logcat.txt
```

Expected: 위 두 줄은 1 이상(없는 id 둘이면 404 가 둘 — 가드도 선언한 상태가 한 번은 나와야 통과시킨다), 아래 네 파일은 `0`. 가장 긴 플로(`examples-scroll-refresh`)의 기기 로그에 앱이 뜰 때의 줄(`Running "main"`)이 1 이상 남아 있다 — 플로의 첫머리가 링 버퍼에서 밀려나지 않았다(결정 31). 줄 수는 L6 에 적는다.

(b) 신선도 단계의 요청이 서버에 닿았다 — `examples-scroll-refresh` 의 백엔드 접근 로그에서 앱의 GET 을 센다(runScript 의 요청은 POST·PATCH 라 섞이지 않는다):

```bash
L=.maestro-output/e2e/examples-scroll-refresh/api.log
grep -c 'GET /api/v1/examples?' "$L"
grep -c 'GET /api/v1/examples/' "$L"
grep -cE 'POST /api/v1/examples |PATCH /api/v1/examples/' "$L"
```

Expected: 목록 GET 이 여섯 이상(첫 쪽·둘째 쪽, 새로고침의 두 쪽, 앱 복귀의 두 쪽), 상세 GET 이 둘 이상(첫 진입, 재진입에서 캐시를 그린 뒤 다시 부른 것), 쓰기가 스물여덟(행 25 + 새 행 2 + 이름 바꾸기 1). 로그의 모양이 달라 세기 어려우면 `grep "/api/v1/examples" "$L"` 의 줄을 그대로 L5 에 붙인다.

(c) 화면을 눈으로 본다 — 에뮬레이터를 켠 채로:

```bash
ADB="$ANDROID_HOME/platform-tools/adb"
docker ps --filter name=joon- -q | wc -l
docker compose -p template-typescript-expo-e2e -f docker-compose.e2e.yml --profile fastapi up -d --wait
"$ADB" shell am start -a android.intent.action.VIEW -d 'templateexpo-e2e://examples?filter%5Btitle%5D%5Bcontains%5D=probe-seed&sort=title' com.example.templateexpo.e2e
test/e2e/android.sh wait-text 'probe-seed alpha' > /dev/null
"$ADB" exec-out screencap -p > .maestro-output/d3-list-light.png
"$ADB" shell cmd uimode night yes
test/e2e/android.sh wait-text 'probe-seed alpha' > /dev/null
"$ADB" exec-out screencap -p > .maestro-output/d3-list-dark.png
"$ADB" shell cmd uimode night no
docker compose -p template-typescript-expo-e2e -f docker-compose.e2e.yml --profile fastapi --profile nestjs --profile rails down -v --remove-orphans
docker ps --filter name=joon- -q | wc -l
```

(`wait-text` 는 D2 의 기기 도우미다 - 문구가 화면에 나올 때까지 60초 안에서 기다린다. 다크로 바꾼 직후의 캡처가 전환 중이면 한 번 더 찍는다.)

Read 도구로 두 PNG 를 연다. 확인할 것: 행이 카드로 그려지고 제목 순서가 alpha, bravo, charlie …, 관계 배지와 `2026-04-06 05:06` 이 보인다, 도구 줄의 버튼 높이가 40dp(1080 폭 화면에서 약 105px — D1 은 `sm:` 결함으로 95px 를 쟀다), 다크의 헤더 배경이 `#171717`·화면 배경이 `#0a0a0a`(Task 3 의 색). 본 것을 L6 에 적는다. 마지막 `9`.

- [ ] **Step 7: 기록·문서·스펙 정정을 쓴다**

`docs/superpowers/notes/2026-09-30-d3-measurements.md` 끝에 더한다 — 괄호 안의 안내 줄은 실제 출력과 판정으로 바꾼다:

````markdown

## L5 — 네이티브 HTTP 캐시 아래의 목록·상세 신선도 (기기, D1 운반)

**왜 재는가.** SDK 57 의 `expo/fetch` 는 네이티브 HTTP 캐시(Android OkHttp·iOS URLCache)를 거치고, 그 캐시는
요청의 `cache` 옵션이 아니라 응답 머리글을 따른다(D1 실측 M6). D2 가 세 백엔드가 싣는 머리글을 쟀다(D2 실측
H1). 앱의 GET 은 D3 가 처음이다.

**D2 의 판정.** (Task 5 Step 3 에서 읽은 D2 실측 H1 의 "**판정.**" 문장을 그대로 옮긴다)

**기기에서 잰 것.** `test/e2e/flows/examples-scroll-refresh.yaml` 이 목록을 연 뒤 백엔드에 직접(`runScript`) 행을
만들고 제목을 바꾼다. 세 단계가 새 값을 받았다 - 당겨서 새로고침(`<접두사> 00`), 앱을 뒤로 보냈다 불러온
재조회(`<접두사> 000`, AppState → focusManager), 상세 재진입(`<접두사> 01 renamed`, 캐시를 그린 뒤 다시 부른다).
그 플로의 백엔드 접근 로그(`.maestro-output/e2e/examples-scroll-refresh/api.log`, 하네스가 플로마다 남긴다)에서
센 요청(Task 5 Step 6 (b)):

```text
(Step 6 (b) 의 세 grep -c 의 수 - 목록 GET·상세 GET·쓰기 - 를 붙인다. 셀 수 없었으면 요청 줄을 그대로 붙인다)
```

**판정.** (둘 중 맞는 것 하나를 쓴다)
- `네이티브 HTTP 캐시가 목록·상세의 새 값을 가리지 않는다 - 단계마다 요청이 백엔드에 닿았고 화면이 새 값을 그렸다. client.ts 는 Cache-Control 을 싣지 않는다(D2 H1 이 첫째 갈래일 때) / D2 가 실은 no-cache 로 그렇다(둘째 갈래일 때).`
- `네이티브 HTTP 캐시가 옛 응답을 줬다(<단계>, <근거 출력>) - D2 계획 Task 6 Step 5 의 "수명이 있으면" 묶음으로 request() 의 GET 에 Cache-Control: no-cache 를 실었다(Task 5 Step 5 (b)). 그 뒤 세 단계가 새 값을 받았다.`

**재지 않은 것.** iOS URLCache(D7 의 CI), NestJS·Rails 의 머리글 아래에서의 기기 동작(D7 의 매트릭스).

## L6 — 목록·상세 E2E 와 화면 (기기)

**명령.** `E2E_AVD=Pixel_9_API_36 ./test/e2e/run-android.sh`(Task 5 Step 4) - Pixel_9_API_36(Android 16, API
36), FastAPI 스택, 플로는 D2 의 일곱과 D3 의 여섯(목록·상세 다섯, `auth-links`).

```text
(e2e-run.log 의 "--- <플로>" 줄들과 마지막 "=== E2E 통과 - 플로 N개 ===" 를 붙인다)
```

**가드.** 선언한 실패 표식 - `examples-empty-notfound` 의 404 (수), `examples-invalid-filter-en` 의 400 (수).
선언하지 않은 D3 플로 넷의 표식은 0 이다(Task 5 Step 6 (a)).

**기기 로그의 링 버퍼.** `android.sh boot` 가 `logcat -G 16M` 으로 넓힌다 - 하네스가 플로마다 로그를 비우고 끝에
모으므로, 버퍼가 긴 플로 하나를 다 담지 못하면 앞쪽 줄이 밀려나 가드가 가짜로 통과하거나 실패한다. 실행 뒤의
`adb logcat -g`: (출력을 붙인다). 가장 긴 플로 `examples-scroll-refresh` 의 기기 로그는 (수)줄이고 앱이 뜰 때의
줄(`Running "main"`)이 남아 있다.

**빌드 지문.** 빌드 레시피 `test/e2e/android.sh` 가 지문에 든다 - 레시피를 고치면 APK 를 다시 만들고 플로만
고치면 만들지 않는 것을 클론한 사본에서 확인했다(Task 5 Step 1 (7)).

**앱 안의 인증 링크.** `auth-links` 가 보호 경로 → 로그인 → 가입하기 → 로그인 → 가입하기 → 가입 → 막혔던
화면(`/examples/new`)을 지났다 - 두 링크가 `next` 를 이어받는다. 계정 생성 안내의 링크는 가입이 되고 자동
로그인만 실패해야 보여 기기에서 누르지 않았다.

**릴리스 대기 예외.** `pnpm-workspace.yaml` 의 `lucide-react-native@1.49.0` 을 (Task 2 Step 3 / Task 5 Step 1)
에서 뺐고 `pnpm install --frozen-lockfile` 이 통과했다. (아직 24시간 전이라 두었으면 그렇게 적고 D4 의 첫 의존성
변경으로 넘긴다.)

**화면**(Task 5 Step 6 (c) 의 두 캡처): (본 것을 적는다 - 카드 행과 제목 순서, 배지와 UTC 시각, 도구 줄 버튼의
높이(px), 다크 헤더와 화면 배경의 색)

**시트.** 필터 시트·정렬 메뉴(React Native `Modal`)의 요소를 Maestro 가 찾았다 / 찾지 못해 Portal 판으로
바꿨다(Task 5 Step 5 (a), 그 출력 한 줄). (맞는 것 하나를 쓴다)
````

스펙 — 11.3 의 D1 정정(로캘 전환) 다음, `### 11.4 E2E 스택` 바로 앞에 더한다:

```markdown

> 정정(2026-09-30, D3): 목록·상세 E2E 가 씨앗(`probe-seed`) 말고 필요한 행 - 무한 스크롤의 25건, 새로고침·앱
> 복귀·상세 재진입이 볼 새 행과 바뀐 제목 - 은 플로가 Maestro 의 `runScript`(호스트의 GraalJS `http`)로 백엔드에
> 직접 만든다(`test/e2e/scripts/examples-api.js`). 앱에는 쓰기 화면이 아직 없다(D4). 하네스가 호스트의 백엔드
> 주소를 `API_URL` 로 넘긴다. 제목은 실행·플로마다 다른 접두사(`probe-d3-<이메일 끝 12자>`)로 시작해 목록 단언을
> 좁힌다. 같은 플로가 네이티브 HTTP 캐시 아래의 신선도(당겨서 새로고침·앱 복귀·상세 재진입이 백엔드의 새 값을
> 받는다)를 기기에서 잰다 - 결과는 `docs/superpowers/notes/2026-09-30-d3-measurements.md` 의 L5. 딥링크의
> 대괄호는 퍼센트 인코딩한다(8.2 의 D3 정정).
```

루트 `AGENTS.md` 의 `## 검증 명령` 절 끝, 실측 기록 문단(`실측 기록은 \`docs/superpowers/notes/2026-09-30-d1-measurements.md\`다. …`) 끝에 한 문장을 더한다:

```markdown
목록 주소의 인코딩 규칙, Uniwind 결함의 대응, 네이티브 HTTP 캐시 아래의 신선도(D3 실측 L1–L6)는
`docs/superpowers/notes/2026-09-30-d3-measurements.md`에 있다.
```

- [ ] **Step 8: 게이트 전체를 돌린다**

E2E 가 빌드 없이 돌아야 한다(지문이 Step 4 의 마지막 빌드와 같다 — 그 뒤로는 시험·문서·스크립트만 바뀌었다). 10분을 넘길 수 있다 — 백그라운드로 돌린다. 이 저장소의 `expo start` 를 끄고 돈다(`[10]` 이 `--clear`).

```bash
pnpm format
docker ps --filter name=joon- -q | wc -l
E2E_AVD=Pixel_9_API_36 ./scripts/check.sh > .maestro-output/gate.log 2>&1; echo "gate exit=$?"
grep -E "^=== |APK 를 다시 만들지 않는다|E2E 통과" .maestro-output/gate.log
docker ps --filter name=joon- -q | wc -l
```

Expected: 앞뒤 `9`, `gate exit=0`, `=== [1/12] …` 부터 `=== [12/12] E2E ===`, `빌드 입력이 지난번과 같다 - APK 를 다시 만들지 않는다`, `=== E2E 통과 - 플로 13개 ===`, `=== 전부 통과 ===`. 빌드가 다시 일어나면 Step 4 뒤에 빌드 입력(앱 코드·설정)이 바뀐 것이다 — `git status` 로 무엇이 바뀌었는지 보고, 의도한 변경이면 그 빌드로 E2E 가 통과해야 한다.

- [ ] **Step 9: 커밋한다**

```bash
git add test/e2e docs/superpowers/notes/2026-09-30-d3-measurements.md docs/superpowers/specs AGENTS.md pnpm-workspace.yaml
git status --short
git commit -m "test: 목록·상세와 앱 안 인증 링크의 E2E 를 더하고 기기 로그 버퍼와 빌드 지문을 바로잡으며 신선도를 기기에서 잰다"
git ls-tree HEAD test/e2e/ | grep -E "\.sh$"
```

Expected: `test/e2e/android.sh`·`guard-log.sh`·`run-android.sh` 가 모두 `100755`(Edit 는 실행 권한을 바꾸지 않는다 — 빠졌으면 `git update-index --chmod=+x test/e2e/run-android.sh` 뒤 다시 커밋한다).

---

## 이 계획이 끝났을 때의 상태

- `lib/resources/view.ts` 가 원본에서 복사돼 목록을 커서로 읽는다 — 첫 요청은 커서의 입구, 다음은 `links.next` 그대로, 빈 쪽이나 실패한 쪽에서 멈춘다. 필터 입력은 폼 상태 객체이고, 백엔드에 닿지 못하면 던지지 않고 `unreachable` 을 돌려준다. 원본 시험 158 과 이 저장소의 시험 24 가 지킨다. 출처 기록에 두 파일과 이탈 아홉이 있다.
- `queries/` 에 캐시 키·무효화 표(실제 `QueryClient` 로 잰다)와 목록·상세 조회 훅이 있고, 로그아웃이 표를 지난다. Query 캐시는 `offlineFirst` 이고 앱 복귀(AppState)·네트워크 복귀(NetInfo)에 다시 부른다.
- 목록(`/examples`)은 라우트 파라미터가 곧 쿼리다 — 딥링크가 조건을 재현하고, 필터 시트·정렬 메뉴·필터 지우기가 새 목록 화면을 쌓아 뒤로 가기가 이전 조건을 되살린다. 무한 스크롤·당겨서 새로고침·빈 결과·닿지 못함의 다시 시도가 있다. 상세(`/examples/[id]`)는 관계 배지·UTC 시각·여러 줄 설명을 그리고, 없는 id 와 없는 경로는 not-found 다.
- `app/`·`components/` 에 미디어 쿼리 변형이 없고 시험이 막는다. 버튼·입력이 폰에서 40dp 다. 내비게이션 테마의 색이 `global.css` 토큰과 같고 시험이 맞댄다.
- `./scripts/check.sh` 가 12단계를 통과한다. E2E 는 D2 의 일곱과 D3 의 여섯 — 목록·상세, 정렬·필터·뒤로 가기, 빈 결과·not-found, 무한 스크롤·새로고침·앱 복귀·상세 재진입의 신선도, 잘못된 필터의 영어 배너, 앱 안의 로그인·가입 링크 — 을 한 에뮬레이터·한 스택에서 돈다.
- 하네스는 기기 로그의 링 버퍼를 16MiB 로 넓히고(`android.sh boot`), 빌드 레시피(`test/e2e/android.sh`)를 APK 지문에 넣는다. 플로마다 백엔드 접근 로그(`api.log`)를 남긴다.
- `pnpm-workspace.yaml` 에 릴리스 대기 예외가 없다(24시간 전이라 남겼으면 L6 에 적혀 있다). 조회에 `signal` 을 넘길 때 함께 고칠 것(타이머 가드·실패 표식)은 `queries/AGENTS.md` 에 규칙으로 있다.
- 기록: D3 실측 L1(인코딩 규칙)·L2(Uniwind 대응)·L3(테마 색)·L4(소음 판정)·L5(신선도)·L6(E2E 와 화면).

## 다음 계획

D4(생성·수정·삭제)가 넘겨받는 것:

- 쓰기 훅은 `queries/keys.ts` 의 표를 부른다 — 생성 `cacheEffects({ kind: 'create', type })`, 수정 `{ kind: 'update', type, id }`, 삭제 `{ kind: 'delete', type, id }`. 키를 손으로 적지 않는다.
- 인증 오류 처리(스펙 9.2, D2 결정 4·이 계획 결정 16)와 쓰기 가드(스펙 7.3 둘째 겹)는 D4 의 첫 인증 요청과 함께 붙인다.
- `lib/resources/view.ts` 의 `referenceRequest`·`referenceList` 가 관계 선택기의 첫 소비자를 기다린다(결정 1). `lib/resources/form.ts` 를 같은 방식(복사 + 패치 + 출처 기록)으로 가져온다.
- 목록 화면의 "새로 만들기" 와 상세의 "수정"·삭제는 D4 가 더한다. 쓰기 뒤 이동은 D3 의 조건 변경과 같은 이유로 기록을 생각해서 고른다.
- E2E 의 쓰기 플로는 제목에 D3 의 접두사(`probe-seed`·`probe-d3-`)를 쓰지 않는다.
- `queries/` 의 첫 단위 시험(`test/unit/queries/keys.test.ts`, 실제 `QueryClient`)이 생겼다 — D2 최종 검토가 D4 에 넘긴 `establishIfSignedIn` 의 거절 처리 시험(T16)을 그 옆에 둘 수 있다.
- 릴리스 대기 예외를 D3 에서 빼지 못했으면(L6) D4 의 첫 의존성 변경에서 뺀다. 조회·쓰기에 `signal` 을 붙이면 `queries/AGENTS.md` 의 규칙대로 세 곳을 함께 고친다(T24).

D5 는 계약 거울을 E2E 앞에 더하며 게이트 번호를 `[N/13]` 으로 바꾼다(D2 결정 13). D7 은 iOS 에서 목록·상세 플로를 돌리고, NestJS·Rails 에서 `nextPageQuery`(결정 4·5)와 쪽 크기를 본다.
