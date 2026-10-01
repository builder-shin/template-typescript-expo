# 생성·수정·삭제와 관계 선택기 구현 계획 (D4 — 단계 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 쓰기 판단(`lib/resources/form.ts` 복사·패치, 새 `lib/resources/write.ts`)과 쓰기 훅·관계 참조 목록·인증 오류의 한 곳(`queries/`·`platform/query-client.ts`), 생성·수정·삭제 화면과 관계 선택기를 만들고, D2 가 넘긴 세션·가드 결함(회전의 5xx, 보호 판정의 인코딩, 가드가 보낸 로그인 화면의 뒤로 가기, 두 번 제출, 세션 세우기 거절의 시험)과 D3 가 넘긴 것(재조회가 받은 판정하지 않은 응답, 쌓인 화면의 재조회, 두 번 누름의 이동, 다음 쪽 링크의 한 규칙, 릴리스 대기 예외, APK 빌드 앞의 Metro 캐시)을 고친 뒤, 실제 FastAPI 스택과 Android 에뮬레이터에서 도는 쓰기 E2E 로 끝낸다. 쓰기는 기기에서 실제 회전을 지난다.

**Architecture:** 판단은 template-typescript-nextjs 에서 복사한 `lib/resources/form.ts`(FormData 대신 폼 상태 객체, 원본이 컴포넌트에 두던 관계 선택기의 판단을 더한다)와 새 `lib/resources/write.ts`(원본 Server Action 의 자리 - 세션 확인 → 요청 → 응답 해석, 전송과 토큰을 주입받는다)가 한다. `queries/writes.ts` 는 그 흐름에 세션 관리자·API 클라이언트를 꽂고 D3 의 무효화 표(`keys.ts`)를 부른다. 세션 거절은 쓰기 캐시(`MutationCache`)의 `onError` 한 곳이 기기 세션을 지우고, 화면 이동은 경로 가드가 한다 - 쓰기 화면이 모두 보호 경로다. 폼의 제출은 렌더 때의 `isPending` 이 아니라 쓰기 캐시를 보고 한 번에 하나만 나가고, 화면을 쌓는 이동은 누른 화면이 다시 앞에 올 때까지 한 번만 한다. 조회의 `queryFn` 은 닿지 못함에 더해 판정하지 않은 응답(5xx·408·429)도 던져 재조회의 실패가 읽은 목록·상세·참조 목록을 지우지 않고, 화면의 조회는 쌓인 동안 구독하지 않는다. 기기 작업은 마지막 태스크 하나에 모인다 - 게이트 한 번이 APK 를 한 번 빌드하고 에뮬레이터·백엔드 한 세션에서 D2 의 일곱·D3 의 일곱·D4 의 넷, 플로 열여덟을 돈다.

**Tech Stack:** Expo SDK 57 (`expo` ~57.0.26 · `react-native` 0.86.3) · Expo Router 57.0.24 (typed routes, `useSegments`, 벤더된 react-navigation 의 `StackActions`) · `@tanstack/react-query` 5.104.0 (`mutationOptions`·`MutationCache`·`isMutating`·`subscribed`) · Uniwind 1.12 + React Native Reusables · vitest 5 · Maestro 2.11.0(`runScript` 의 `http`) · Docker Compose(FastAPI 의 `JWT_ACCESS_EXPIRES_SECONDS`)

**Spec:** `docs/superpowers/specs/2026-09-30-expo-jsonapi-template-design.md` — 15장 단계 4(생성·수정·삭제, 관계 선택기 — 산출: 쓰기 E2E). 근거 절: 6.2(`form.ts` 복사), 7.2·7.3(회전·두 겹의 가드), 8.1·8.4·8.5(화면·쓰기의 흐름·무효화 표), 9.1–9.3(오류의 자리·동작·앱 문구), 11.1·11.3(단위·E2E), 12장(게이트), 그리고 날짜 붙은 정정 전부(`> 정정(2026-09-30, D1)`·`(D2)`·`(D3)`). 이어받는 항목의 정본은 `docs/superpowers/notes/2026-10-01-d2-carry-forward.md` 의 "D4" 절(D2 최종 검토 M5·M6·M7·M13, 트리아지 T3·T7·T16 이 거기 있다)과 D3 계획(`docs/superpowers/plans/2026-09-30-d3-list-and-detail.md`)의 "다음 계획" 절, 그리고 D3 최종 검토가 D4 로 넘긴 M2·M8·53e·T10 과 D3 실측 L7(`docs/superpowers/notes/2026-09-30-d3-measurements.md`)이다. 형제 저장소 `../template-typescript-nextjs` 의 D4 계획(`docs/superpowers/plans/2026-09-08-create-update-delete.md`)의 실측 W-1…W-12 와 판정 1–8 을 참고로 읽었다 - 이 계획이 그 값에 기대는 자리는 사실 절에 옮겼다.

## Global Constraints

- **런타임 버전은 Expo SDK 57 번들 버전을 따른다.** 이 계획은 의존성을 더하지 않는다. SDK 에 딸린 패키지를 받아야 하면 `BACKEND_URL=https://gate-check.invalid pnpm exec expo install <패키지>`, SDK 밖은 정확한 버전(`pnpm add <이름>@<버전>`, `^` 없음)이다.
- **`app.config.ts`를 평가하는 모든 명령(`expo config`·`expo export`·`expo prebuild`·`pnpm types:routes`·`expo-doctor`)에는 `BACKEND_URL`을 준다.** 백엔드에 닿지 않는 명령은 `https://gate-check.invalid`다(스펙 10.1 — 없으면 멈춘다).
- **Node `>=24.11.0`, `packageManager: "pnpm@11.22.0"`**, `nodeLinker: hoisted`. `pnpm-workspace.yaml` 의 `minimumReleaseAgeExclude` 에 D2 가 남기고 D3 가 둔 `lucide-react-native@1.49.0` 은 Task 1 Step 1 이 뺀다(결정 33, D3 운반 T10).
- **TypeScript strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`.** 선택 prop·속성에 `undefined`를 명시해 넘기지 않는다 — 키를 빼거나 `cn()`처럼 문자열을 만든다.
- **`lib/**`에서 `react`·`react-native`·`expo`·`expo-*`·`@expo/*`·`@react-native*`·`@react-navigation/*`·`@tanstack/*`·`uniwind` 등을 import하면 위반이다**(스펙 5장, ESLint가 막는다). 위 계층(`platform/`·`queries/`·`components/`·`app/` — 별칭이든 상대 경로든)을 import해도 막힌다. `lib/jsonapi/`에는 자원 이름 문자열이 코드로 나타나지 않는다.
- **`request()`(`lib/jsonapi/client.ts`)를 값으로 import 하는 곳은 `platform/api.ts` 와 `lib/` 뿐이다.** 쓰기도 `apiRequest` 를 지난다 - Accept-Language 를 싣는 한 자리다(스펙 9.4). `lib/resources/write.ts` 는 전송을 주입받는다(`JsonApiSend`).
- **`package.json`에 없는 패키지를 import하면 lint가 실패한다**(`import/no-extraneous-dependencies`).
- **어떤 모듈도 최상위에서 `getSettings()`를 부르지 않는다.** 모듈 최상위에서 `sessionManager`·`apiRequest` 를 참조하는 것은 된다(부르지 않는다).
- **`app/`에는 라우트 파일만 둔다.** 화면 조각은 `components/`, 판단은 `lib/`, 훅은 `queries/`, 네이티브 모듈 호출은 `platform/`. 화면 파일에는 훅 호출과 JSX 만 둔다(스펙 8.4).
- **`components/resource/*` 는 자원 이름으로 분기하지 않는다** — 분기해도 되는 것은 구조(속성의 `kind`, 관계의 `cardinality`)뿐이다(스펙 5장).
- **로딩 상태에 텍스트를 쓰지 않는다.** 스피너(`ActivityIndicator`) 또는 스켈레톤만 쓴다(스펙 8.7).
- **`app/`·`components/` 에 `@media` 로 컴파일되는 변형을 쓰지 않는다** — 너비(`sm:`·`md:`·`lg:`·`xl:`·`2xl:` 과 그 `max-`·`min-` 꼴), 방향(`portrait:`·`landscape:`), 플랫폼(`ios:`·`android:`·`native:`·`tv:`). Uniwind 1.12.0 결함이라 `test/unit/ui/breakpoints.test.ts` 가 파일 전체(주석 포함)를 훑어 막는다. 플랫폼마다 다른 스타일은 `Platform.select` 로 클래스 문자열을 고른다. `dark:` 는 된다(D3).
- **아이콘은 `lucide-react-native/icons/<이름>` 깊은 import 의 기본 내보내기로 받는다** — 통(`lucide-react-native`)을 값으로 import 하면 lint 가 막는다(Metro 는 트리 셰이킹을 하지 않는다, D3 의 `eslint.config.js`). 이 계획의 새 코드는 아이콘을 쓰지 않는다.
- **오류 문구 카탈로그를 두지 않는다.** 백엔드가 협상한 `title`·`detail`을 그대로 그린다. 앱 자신의 오류 문구는 복사한 `UNUSABLE_RESPONSE_MESSAGE` 와 가입 화면의 "계정은 만들어졌습니다" 안내뿐이다(스펙 9.3) — 쓰기가 백엔드에 닿지 못해도 `UNUSABLE_RESPONSE_MESSAGE` 다. 화면의 라벨·안내("선택 안 함", "목록에 없는 항목…")는 오류 문구가 아니다.
- **복사한 파일은 `docs/provenance/copied-core.json`에 적고, 원본과 달라진 곳은 전부 `divergences`에 `what`·`why`로 남긴다.** 출처 커밋은 `34d0b1057d65693645e75bec4e9558dcf6838822`, 원본은 형제 디렉터리 `../template-typescript-nextjs`다. 이탈이 있는 경로는 `sourceBlobs`에 두지 않는다. 이 계획이 고치는 복사본은 `lib/resources/form.ts`·`test/unit/resources/form.test.ts`(새로 복사), `lib/auth/rotation.ts`·`test/unit/auth/rotation.test.ts`, `docker-compose.e2e.yml` 이다 — 전부 이미 이탈이 있어 `sourceBlobs` 에 없다. 복사본의 주석이 말하는 "Server Action"·"`<select>`"·"Task N" 같은 자리는 원본 저장소의 것이다 — 주석은 코드가 바뀐 곳과 지운 이름을 가리키는 곳만 고친다.
- **사라질 자리를 인용하지 않는다.** `app/`·`components/`·`lib/`·`platform/`·`queries/`·`test/` 안에서 선행 점이 붙은 `.superpowers/`, `superpowers/sdd`, `task-<번호>-report.md` 같은 세션 파일, 스크래치패드를 가리키지 않는다(게이트 [5]가 막는다). 근거는 사실 문장으로 적고, 문서가 필요하면 커밋되는 `docs/superpowers/`를 가리킨다.
- **계정 이름이 든 절대 경로를 저장소에 남기지 않는다.**
- **ESLint 타입 규칙이 잡는 것:** `async` 함수에는 `await`가 있어야 한다(`require-await`). 콜백으로 넘기는 멤버는 메서드가 아니라 함수 속성으로 선언한다(`unbound-method`). 쓰지 않는 `catch` 변수는 `catch {`로 쓴다(`no-unused-vars`의 `caughtErrors: all`). 떠 있는 Promise 는 `void` 로 받거나 `.catch` 로 잡는다(`no-floating-promises`).
- **세션 관리자의 거절은 호출자가 잡는다.** `getAccessToken`·`signOut` 을 부르는 자리는 거절을 잡아 이름과 문구만 남긴다 — 맨 `void manager.signOut()` 을 두지 않는다(`queries/AGENTS.md`, D2 운반 기록의 T7).
- **라우트 파라미터는 이름으로 꺼낸다.** `useLocalSearchParams()` 의 결과를 펼치거나 돌지 않고, 요청이나 폼의 첫 값에 넣지 않는다 — 로그인 뒤 복귀의 `withAnchor` 가 잎 화면까지 `initial: 'false'` 를 싣는다(D3 결정 39). 수정 화면은 `const { id } = …`, 생성 화면은 파라미터를 읽지 않는다.
- **한 파일만 도는 시험은 `pnpm exec vitest run <파일>`**이다 — pnpm 11은 `pnpm test -- <파일>`에 `--`를 그대로 넘겨 전체가 돈다.
- **게이트는 Git Bash에서 `./scripts/check.sh`로 돈다.** `pnpm check`는 Windows에서 cmd.exe가 `./`를 못 찾는다.
- **`expo export`는 언제나 `--clear`로 돌린다.** 이 개발 머신(Windows)에서 캐시를 둔 `expo export`는 끝날 때 간헐적으로 0xC0000005(Git Bash에서 139)로 죽었다(D1 실측 M1 관찰 8). 이 저장소의 `expo start`를 끄고 돌린다. 그래도 139로 죽으면 다시 돌려 덮지 않는다 — 원인을 찾는다(스펙 16장: 재시도 0).
- **Gradle의 번들 단계(E2E APK 빌드의 `createBundleReleaseJsAndAssets`)도 Metro 캐시를 쓴다.** 그 단계가 0xC0000005·139로 죽으면 30분을 정해 원인을 가른다(D3 전역 제약과 같다) — 못 찾으면 멈추고 기록과 함께 컨트롤러에 넘긴다.
- **개발 머신의 `joon-*` 컨테이너 9개를 절대 멈추지 않는다.** compose 명령은 모두 `-p template-typescript-expo-e2e`를 주고 그 프로젝트만 내린다. Docker를 건드리는 단계는 앞뒤로 `docker ps --filter name=joon- -q | wc -l`이 `9`인지 확인한다. 같은 머신의 다른 `fastapi-*` 컨테이너도 건드리지 않는다.
- **Windows의 Android 네이티브 빌드는 저장소 루트가 실제 디렉터리 경로 47자 이하일 때만 된다**(D1 실측 M1). E2E 하네스가 짧은 경로(`E2E_STAGE_DIR`, 기본 `C:/t/e`)의 사본에서 빌드한다.
- **Maestro 플로 규칙:** 요소는 testID(`id:`)로 찾는다 — 목록의 행과 선택기의 보기는 testID 와 데이터 문구를 함께 준다(`id: relationship-option-tags` + `text: 프로브 라벨 둘`). `launchApp` 뒤에는 화면 요소를 기다린 다음 `openLink`를 보낸다. 딥링크의 대괄호는 퍼센트 인코딩한다. **`hideKeyboard` 를 쓰지 않는다** — Maestro 2.11.0 의 Android 구현은 뒤로 가기다. 입력한 뒤 아래쪽 요소(선택기·제출)를 누르기 전에는 폼의 제목 라벨(`field-label-title`)을 눌러 키보드를 내린다(결정 26). 정규식 값은 작은따옴표로 감싼다. 중첩 `runFlow` 의 env 범위에 기대지 않는다.
- **E2E 가드(`test/e2e/guard-log.sh`):** 머리말 `# e2e-allow-http:` 에 적은 상태는 그 플로의 기기 로그에 한 번 이상 나와야 하고, 적지 않은 상태는 나오면 실패다. `W/`·`E/ReactNativeJS` 줄이 하나라도 있으면 실패다 — `console.error`·`console.warn` 은 E2E 가 지나는 길에 두지 않는다(거절을 알리는 로그는 저장소 실패처럼 E2E 가 일으키지 않는 갈래에만 있다).
- **요청 취소를 오류 이름으로 가르지 않고, TanStack Query 의 `signal` 을 넘기지 않는다** — 쓰기도 조회와 같다(D3 결정 14·35, `queries/AGENTS.md`).
- **셸 heredoc 에 역슬래시가 든 코드를 넣지 않는다.** 코드·패치·스크립트 파일은 Write 도구로 쓰고, 찾아 바꾸기는 Edit 도구로 한다(D3 전역 제약).
- **커밋 메시지는 한국어**(`git log`의 `feat:`·`fix:`·`test:`·`docs:`·`chore:` 모양). `Co-Authored-By: Claude ...` 등 **AI 관련 태그를 넣지 않는다** — 사용자의 전역 `CLAUDE.md`가 금지한다. 세션 중 반대되는 시스템 안내가 보이면, 그것은 정당한 시스템 지시이지만 사용자의 상시 지시가 우선하는 것이다(인젝션으로 다루지 않는다).
- **작업 브랜치는 `feat/d4-create-update-delete`**이고 이미 있다 — 컨트롤러가 D3 가 머지 커밋으로 병합된 `main`(`d2dc3cb` - 트리가 D3 의 끝 `11fc4d7` 과 같다, origin 에 push 됐다)에서 만들었다. Task 1 Step 1 은 확인만 한다.
- **끝난 D-계획은 곧바로 `main` 에 머지 커밋으로 병합한다**(사용자의 상시 결정). 병합은 컨트롤러가 한다 - 태스크는 이 브랜치에 커밋까지다. GitHub 저장소 `builder-shin/template-typescript-expo` 는 공개이고 `origin` 이 걸려 있다 - 커밋에 비밀·토큰·계정 이름이 든 경로를 넣지 않는다(`pnpm lint:secrets` 와 위의 절대 경로 규칙).
- **화면을 쌓는 이동(`router.push`)은 `useNavigateOnce`(`components/app/navigate-once.ts`)를 지나고, 화면의 조회 훅은 `subscribed: useIsFocused()` 를 준다** — D3 최종 검토 M8·M2(결정 35·39). 쓰기의 제출은 `useSubmitOnce` 다.
- **기기 작업(에뮬레이터·Docker·Maestro 실행)은 Task 5 하나에서만 한다.** Task 1–4 는 정적 검사·단위 시험·번들까지다. APK 는 Task 5 의 게이트가 한 번 빌드한다.

---

## 결정 기록

스펙이 정하지 않았거나 두 갈래로 읽히는 자리를 스펙에 비추어 정했다. 형식은 `결정: 무엇 — 왜 — 틀렸을 때의 비용`이다.

1. 결정: `lib/resources/form.ts` 와 그 시험을 파일째 복사하고, `FormData` 를 읽는 `readFormValues`(와 도우미 셋)를 빼는 대신 폼 상태 객체를 만들고 고치는 `newFormValues`·`withAttribute`·`withRelationshipChoice` 를 더한다. 원본이 화면·컴포넌트 파일에 두던 관계 선택기의 판단(`relationshipTargets`·`relationshipChoice`)도 이 파일에 더한다(참조 조회의 실패는 결정 36 - D3 의 `screen-state.ts`) — 스펙 6.2 가 이 파일을 "복사한 뒤 고치는 것"(입력이 FormData 가 아니라 폼 상태 객체)으로 정했고, 스펙 11.1 은 컴포넌트 시험을 두지 않으므로 판단은 lib 에 있어야 잰다(D3 결정 1 과 같은 이유로 한 번에 복사한다) — 틀리면(선택기 판단을 컴포넌트로 돌려야 하면) 두 함수와 `form-expo.test.ts` 의 두 describe 를 옮긴다.
2. 결정: 쓰기 한 번의 흐름(세션 확인 → 요청 → 응답 해석)을 새 파일 `lib/resources/write.ts` 에 두고 전송(`JsonApiSend`)과 토큰(`getAccessToken`)을 주입받는다. 훅(`queries/writes.ts`)은 배선만 한다 — 원본의 Server Action 자리를 이 앱에서 차지하는 것은 훅인데 훅은 React 없이 부를 수 없다. D2 의 `lib/auth/credentials.ts` 가 같은 모양이다 — 틀리면 흐름을 훅으로 옮기고 시험 22개를 잃는다.
3. 결정: 쓰기가 백엔드에 닿지 못하면(transport) 원본처럼 던지지 않고 폼 배너에 `UNUSABLE_RESPONSE_MESSAGE` 를 그린다. 입력이 그대로 남은 폼의 제출 버튼이 곧 다시 시도다 — 스펙 9.3 의 D2·D3 정정(인증 폼과 조회 화면이 던지지 않는다), Expo Router 의 ErrorBoundary 는 요청을 다시 보내지 않는다 — 틀리면(폼에도 "다시 시도" 버튼이 필요하면) 배너 옆에 버튼 하나.
4. 결정: 인증 오류 처리(스펙 9.2)는 쓰기 캐시(`MutationCache`)의 `onError` 한 곳이다. `write.ts` 가 세션이 없거나(스펙 7.3 의 쓰기 가드) 인증 오류 코드를 받으면 `sessionRejected()` 를 던지고, `onError` 가 `sessionManager.signOut()` 한다. 로그인으로 보내는 것은 세션 상태를 따르는 경로 가드다 — 쓰기 화면이 모두 보호 경로(`/examples/new`·`/examples/[id]/edit`)이고, 가드가 `next` 를 싣는다. 화면 이동 코드를 훅·캐시에 두지 않는다(D2 결정 4·D3 결정 16 이 넘긴 "캐시 콜백 한 곳") — 틀리면(보호 경로가 아닌 화면에서 쓰기가 생기면) `onError` 에서 `router.replace(loginHref(…))` 를 부른다.
5. 결정: `QueryCache` 에는 `onError` 를 두지 않는다 — 읽기는 토큰을 싣지 않아(스펙 7.2) 인증 오류가 오지 않는다. 스펙 9.2 의 "QueryCache·MutationCache 의 onError 한 곳" 은 쓰기 캐시 하나로 읽는다(스펙 9 의 D4 정정) — 틀리면(토큰을 싣는 조회가 생기면) 같은 판정 한 줄을 `QueryCache` 에 더한다.
6. 결정: 생성의 `RESOURCE_NOT_FOUND` 는 계약 밖이라 배너로 그린다(`CreateOutcome` 에 `notFound` 가 없다). 수정의 `RESOURCE_NOT_FOUND` 는 not-found 화면이고 그래도 상세·목록을 무효화한다(밑에 깔린 상세가 없어진 자원을 계속 그리지 않게). 삭제의 `RESOURCE_NOT_FOUND` 는 이미 이뤄진 삭제다(원본 판정 8) — 원본의 세 Action 과 같은 갈래이고, 생성만 원본의 `notFound()` 대신 배너다(만들 자원이 "없다" 는 화면은 뜻이 없다) — 틀리면 `createResource` 의 한 갈래.
7. 결정: 쓰기 뒤의 이동은 — 생성: `router.replace` 로 새 자원의 상세(뒤로 가기가 폼이 아니라 온 목록으로 간다), 수정: `router.dismissTo` 로 상세(스택에 상세가 있으면 거기까지 닫고 그 화면이 이 자원을 그린다 — dismissTo 는 이름으로 찾아 파라미터를 덮는다, 없으면 이 화면을 바꾼다), 삭제: `StackActions.popTo('examples/index', undefined, { merge: true })`(이 자원을 보던 목록까지 닫고 목록의 조건을 둔다 — `router.dismissTo('/examples')` 는 파라미터를 덮어 필터가 사라진다, 스택에 목록이 없으면 조건 없는 목록으로 바꾼다) — D3 넘김 "쓰기 뒤 이동은 기록을 생각해서 고른다", 스택 라우터의 `POP_TO` 는 지금 자리에서 거꾸로 이름을 찾는다(사실 절) — 틀리면 화면 파일 하나의 한 줄씩.
8. 결정: 삭제가 캐시에서 상세를 지운 뒤(D3 의 표: "삭제 → 상세 제거") 수정 화면은 그 상세의 조회를 끈다(`useResourceDetail(…, { enabled: !remove.deleted })`) — TanStack Query 는 지운 조회를 지켜보던 관찰자가 다시 그려지면 새 조회를 만들어 부른다(사실 절 - 스크래치에서 쟀다). 삭제의 성공이 수정 화면을 다시 그리므로 끄지 않으면 없는 자원의 GET 404 가 나가고 E2E 가드에 걸린다(`examples-delete` 는 404 를 선언하지 않는다) — 틀리면(기기에서 404 가 없으면) 옵션 하나가 남을 뿐이다.
9. 결정: 폼의 제출은 쓰기 캐시를 보고 한 번에 하나다 — `queries/submit-once.ts` 의 `submitOnce(client, mutationKey, submit)` 가 같은 키의 쓰기가 진행 중(`isMutating`)이면 버린다. 폼(자격증명 폼·자원 폼·삭제 확인)은 쓰기의 키를 prop 으로 받는다. D2 의 `credentials-form.tsx` 의 `if (pending) return` 도 이것으로 바꾼다 — D2 최종 검토 M7(렌더 때의 값이라 버튼과 키보드 이동 키가 한 틱 안에 눌리면 둘째 `mutate` 가 나간다), 쓰기는 `mutate()` 가 돌아오기 전에 캐시에서 진행 중이 된다(사실 절). ref 로 잠그고 `isPending` 이 거짓으로 돌아온 효과에서 푸는 모양은 버렸다 - 응답이 첫 알림(setTimeout 0)보다 먼저 오면 진행 중인 렌더가 없어 잠금이 풀리지 않는다 — 틀리면(키 없이 막아야 하면) 훅이 제출 함수를 감싼다.
10. 결정: 가드가 보낸 로그인·가입 화면에서 돌아갈 곳이 없을 때의 뒤로 가기를 홈으로 보낸다(`components/app/back-to-home.ts` 의 `useBackToHome` — `router.canGoBack()` 이 거짓이면 `router.dismissTo('/', { withAnchor: true })`) — D2 최종 검토 M5 의 첫 후보. 둘째 후보(가드가 먼저 공개 경로로 닫은 뒤 로그인을 push)는 가드의 이동 두 번이 한 렌더에서 겹쳐 순서를 기기에서만 잴 수 있다. 앱 안의 "새로 만들기"·"수정"·세션 거절이 전부 이 가드를 지난다 — 틀리면(목록으로 돌아가야 하면) 둘째 후보로 바꾸고 `examples-create` 의 뒤로 가기 단언을 목록으로 바꾼다.
11. 결정: 회전 응답의 5xx·408·429 는 세션을 건드리지 않는다(`interpretRotationOutcome` → `unreachable`). 나머지 4xx 는 원본대로 파기한다 — D2 최종 검토 M6, 스펙 7.2 의 "인증 거절 → 삭제, 닿지 못함 → 유지" 에서 그 셋은 토큰을 판정하지 않은 응답이다. 세션이 30일이라 회전 순간의 502 하나가 로그아웃이 되는 쪽이 더 나쁘다 — 틀리면(서버가 회전을 마친 뒤 5xx 를 내는 일이 잦으면) 옛 refresh 로 다음 회전을 해 재사용 감지로 그 사용자의 세션이 전부 끊긴다. 그때 한 갈래를 되돌린다. 남는 틈: access 가 이미 만료된 채 회전이 5xx 를 받으면 세션 관리자는 닿지 못함처럼 그 access 를 돌려주고, 그것을 실은 쓰기가 401 `TOKEN_EXPIRED` 를 받아 세션을 지운다 - refresh 만 5xx 이고 쓰기 라우트는 살아 있는 부분 장애에서만 생긴다(둘 다 5xx 면 쓰기도 세션을 지우지 않는다). 막으려면 `getAccessToken` 에 "지금은 못 준다" 갈래가 필요해 D2 의 세션 관리자 모양이 바뀐다 - 이 계획은 하지 않는다.
12. 결정: `session-store.ts` 의 시각 주석(D2 최종 검토 M13)은 주석을 고친다 — 로그인의 access 만료는 요청 전 시각, refresh 만료는 응답 뒤 시각이다(차이는 요청 시간 제한 15초 이하). 한 시각을 넘기려면 `establish` 의 서명과 호출부를 바꿔야 하는데 30일 refresh 에서 15초는 동작을 바꾸지 않는다 — 틀리면 `establish(session, refreshExpiresIn, issuedAt)` 로 한 시각을 넘긴다.
13. 결정: 경로 가드는 `usePathname()` 이 아니라 라우트 모양으로 보호를 판정한다 — `routePattern(useSegments())`(`/examples/[id]/edit`), 목록 패턴은 그대로. `next` 는 그대로 `usePathname()` 이다 — D2 트리아지 T3(`usePathname()` 이 `%2F` 를 풀어 `[^/]+` 를 벗어난다). 세그먼트는 파라미터 값을 담지 않아 id 가 무엇이든 같은 모양이고, 패턴은 실제 경로도 그대로 받아 D2 의 시험이 남는다. 인코딩 유지(경로를 파라미터로 다시 조립)는 라우트마다 조립을 알아야 한다 — 틀리면(그룹 밖 라우트가 생기면) `routePattern` 한 줄. 비용: id 에 `/` 가 든 화면은 로그인 뒤 다른 경로(not-found)로 돌아간다 - 이 템플릿의 id 는 UUID 다.
14. 결정: 세션 관리자의 첫 `getAccessToken` 호출자(`write.ts`)는 거절(회전한 세션을 저장소에 못 씀)을 잡아 앱 문구를 그리고 이름·문구만 로그로 남긴다. 첫 `signOut` 호출자(`platform/query-client.ts` 의 `onError`)는 `.catch` 로 잡아 같은 로그를 남긴다 — D2 트리아지 T7, `queries/AGENTS.md` 의 규칙. 새 세션은 메모리에 있어 다시 제출하면 새 토큰으로 간다 — 틀리면 로그 두 줄.
15. 결정: `establishIfSignedIn` 의 거절 정책 시험(D2 트리아지 T16)은 로그인·가입 쓰기의 옵션을 `loginMutationOptions`·`registerMutationOptions` 로 내보내고 TanStack Query 의 `MutationObserver` 로 돌린다(`test/unit/queries/auth.test.ts`) — 트리아지의 첫 갈래("MutationObserver 수준"), 쓰기의 상태(성공)와 로그를 실제 쓰기 캐시로 본다. 정책을 lib 으로 옮기는 둘째 갈래는 세션 관리자를 lib 에 끌어들인다 — 틀리면 옵션 export 두 개를 되돌린다.
16. 결정: 로그인한 사용자가 `/login` 딥링크로 다른 계정에 로그인하는 것(D2 최종 검토 M14)은 막지 않는다 — 스펙이 말하지 않고, 노출이 없다(앞 refresh 는 기기에서만 사라진다). D4 의 쓰기와 무관하다 — 틀리면 `(auth)` 레이아웃이 로그인한 사용자를 홈으로 보낸다.
17. 결정: "새로 만들기"(목록 도구 줄)와 "수정"(상세 아래)은 로그인 여부와 무관하게 보인다 — 원본 판정 4 와 같다. 로그인하지 않았으면 가드가 로그인으로 보내고 `next` 로 돌아온다 — 틀리면(숨겨야 하면) `useSessionStatus()` 조건 하나씩.
18. 결정: 삭제 확인은 D3 의 아래 시트(`Sheet`, React Native `Modal`) 위의 `ConfirmSheet`(`components/app/confirm-sheet.tsx`)다 — 스펙 8.1 "삭제 확인 대화상자", 새 대화상자 부품을 들이지 않는다. 시트 안의 요소를 Maestro 가 찾는 것은 D3 의 필터·정렬 시트가 먼저 잰다 — 틀리면 D3 Task 5 Step 5 (a) 의 Portal 판 시트로 바꾸면 이 시트도 따라온다.
19. 결정: 관계 선택기는 폼에 고른 것을 배지로 그리고, 누르면 아래 시트에 참조 목록(`referenceRequest` — 이름 순 첫 100건)을 연다. to-one 은 "선택 안 함" 과 보기 하나, to-many 는 켜고 끄기이고 켜면 끝에 붙는다(고른 순서 유지). 검색은 없다(원본 판정 3). 목록에 없는 선택(잘렸거나 조회가 실패한 목록)은 id 를 라벨로 끝에 붙이고 안내하며, 잘린 목록은 그 사실을 알린다 — 스펙 8.1 "분류 단일 선택, 태그 다중 선택(순서 유지)", 원본이 한때 목록 밖 선택을 저장에서 지웠다(씨앗 파일의 채움 행 주석) — 틀리면(검색이 필요하면) 참조 조회에 `filter[name][contains]` 를 더하는 새 판단.
20. 결정: 생성 폼의 필수 enum 은 첫 값을 고른 채로 시작한다(`newFormValues`) — 원본의 생성 화면은 빈 보기 없는 `<select>` 라 브라우저가 첫 값을 보냈다. 이 앱의 칩에는 그 기본이 없어 옮기지 않으면 고르지 않은 필수 enum 이 빈 문자열로 나가 422 다. nullable enum 의 "선택 안 함" 칩은 두지 않는다(원본의 알려진 한계와 같다, 오늘 선언에 없다) — 틀리면 칩 하나와 첫 값 규칙 한 줄.
21. 결정: 수정 폼의 첫 값은 처음 받은 상세 하나로 고정한다(`ResourceEditGate`) — 상세는 상세 화면과 같은 캐시라 앱 복귀·무효화로 다시 불리는데, 그때 폼을 다시 만들면 고치던 입력이 사라진다(재조회의 실패는 D3 가 데이터를 두게 고쳤다) — 틀리면(다른 사람이 고친 값을 보여야 하면) 새로 받은 값을 알리는 안내.
22. 결정: 자원 쓰기의 키는 `queries/keys.ts` 의 `mutationKeys`(`['resources', type, 'create'|'update'|'delete', id?]`)다 — 조회 캐시의 키와 따로 두고, 수정·삭제는 id 까지 좁혀 다른 자원의 쓰기를 막지 않는다. TanStack Query 의 키 필터는 앞 조각 일치라 id 까지 넣어야 한다(시험이 잰다) — 틀리면 키 셋.
23. 결정: E2E 는 백엔드의 access token 수명을 10초로 준다(`docker-compose.e2e.yml` 이 세 백엔드의 `JWT_ACCESS_EXPIRES_SECONDS` 를 `E2E_ACCESS_EXPIRES_SECONDS` 로 넘기고 - 없으면 세 백엔드의 기본값 900 - 하네스가 10 을 준다. 앱은 만료 60초 전부터 회전하므로 쓰기가 전부 실제 회전을 지난다) — D2 결정 5 가 "실제 회전 왕복은 D4 의 쓰기 E2E 가 처음 지난다" 로 넘겼고, 900초로는 플로 안에서 회전이 한 번도 일어나지 않는다. D2·D3 의 플로는 토큰을 쓰지 않는다(읽기는 공개, 로그아웃은 refresh) — 틀리면(어느 백엔드가 변수를 무시하면) 회전이 일어나지 않고, Task 5 의 W2 수(refresh 0)가 그것을 드러낸다.
24. 결정: 쓰기 E2E 가 앱 밖에서 백엔드를 바꾸는 단계는 D3 의 `test/e2e/scripts/examples-api.js` 에 `STEP=account|example|unlisted|delete|revoke` 로 더한다. 스크립트의 토큰도 10초라 401 이면 한 번 다시 로그인한다(`authed`) — D3 의 `seed|create|rename` 도 그 길을 탄다. 세션 끊기(`revoke`)는 폐기된 refresh 를 다시 내밀어 백엔드가 그 사용자의 세션을 전부 폐기하게 한다(정본의 재사용 감지 - 사실 절) — 틀리면 같은 요청을 하네스(node)로 옮긴다.
25. 결정: 쓰기 플로의 제목 접두사는 `d4-<이메일 끝 8자>` 다 — D3 넘김(D3 의 `probe-seed`·`probe-d3-` 를 쓰지 않는다). 짧게 두는 것은 수정 플로가 제목 칸을 눌러 지우고 다시 쓰기 때문이다 - Maestro 가 누른 자리에 커서가 서므로 제목이 칸의 절반보다 짧아야 가운데를 누를 때 끝에 선다 — 틀리면 `eraseText` 의 수를 늘린다.
26. 결정: 폼의 속성 라벨에 testID(`field-label-<속성>`)와 `onPress={Keyboard.dismiss}` 를 둔다. 플로는 입력한 뒤 아래쪽 요소를 누르기 전에 제목 라벨을 눌러 키보드를 내린다 — Android 의 edge-to-edge 창에서 키보드가 아래쪽 요소(선택기·제출)를 가리면 그 자리의 누름이 키보드로 간다. `hideKeyboard` 는 뒤로 가기라 키보드가 없을 때 화면을 떠난다(D3 전역 제약) — 틀리면(창이 줄어 가리지 않으면) 무해한 누름이 하나 는다.
27. 결정: "목록 밖 선택" 을 기기에서도 잰다 — 씨앗이 참조 자원을 101건씩 넣어 이름 순 101번째(`힣넘침분류-098`·`힣넘침라벨-098`)가 첫 100건 밖이다(씨앗 파일의 "왜 99건인가" 절). `STEP=unlisted` 가 그 둘을 단 행을 만들고, `examples-edit` 가 폼이 그 선택을 id 로 그리고 알리는지, 제목만 바꿔 저장해도 남는지 본다 — 원본이 한때 여기서 관계를 지웠다. 선택기의 잘림 안내는 `examples-create` 가 본다 — 틀리면(씨앗의 채움 행이 바뀌면) 두 id 를 고친다.
28. 결정: 태그 순서는 "폼은 고른 순서 그대로, 상세는 백엔드의 순서" 로 잰다 — 정본은 태그를 붙인 순서가 아니라 id 오름차순으로 돌려준다(원본 E2E 의 "재는 것은 삽입 순서가 아니다" 절). 폼이 순서를 바꾸지 않는 것은 단위 시험(`withRelationshipChoice`·`relationshipChoice`)이, 백엔드의 순서는 플로의 상세 단언이 잰다 — 틀리면 상세 단언 두 줄.
29. 결정: 쓰기 E2E 는 네 플로다 - 생성(가드가 보낸 로그인 화면의 뒤로 가기 포함), 수정(기존 값·태그 순서·관계 초기화·목록 밖 선택), 삭제(취소·확인, 딥링크로 연 수정 화면의 가드), 실패 처리(422·없는 id·고치는 사이 404·지우는 사이 404·끊긴 세션 401) — 스펙 11.3 의 쓰기 행("필수 입력, 관계 선택·초기화, 기존 값 유지, 태그 순서, 삭제·실패 처리"), 파일 하나가 시나리오 하나(`test/e2e/AGENTS.md`)이되 로그인 한 번으로 이어지는 단계는 묶는다 — 틀리면 플로를 나눈다(플로마다 앱 초기화 ~10초).
30. 결정: 기기 작업은 Task 5 의 게이트 한 번으로 한다 — 게이트의 E2E 단계가 빌드 입력이 바뀐 APK 를 한 번 빌드하고 플로 열여덟을 한 에뮬레이터·한 백엔드 세션에서 돈다. 게이트 뒤에는 문서(실측 기록의 수)만 바꾸고 E2E 를 다시 돌리지 않는다 - 빌드 지문과 플로가 문서를 보지 않는다. 실패한 플로를 고칠 때만 `E2E_FLOW` 로 그 플로를 다시 돌린다 — 사용자 요구(속도) — 틀리면(문서 밖을 고쳤으면) 게이트를 한 번 더 돈다.
31. 결정: D2·D3 의 화면 파일(`login.tsx`·`register.tsx`·`credentials-form.tsx`·`_layout.tsx`·목록·상세)은 Edit 로 고치고 전체를 바꾸지 않는다. Edit 가 맞지 않으면 같은 뜻의 자리를 찾아 고친다(바꿀 것의 뜻을 지킨다). 전체를 바꾸는 앞 단계의 파일 넷(`lib/auth/protected-paths.ts`·`components/resource/values.tsx`·`app/(app)/examples/new.tsx`·`test/e2e/scripts/examples-api.js`)은 바꾸기 전에 blob 을 이 계획이 전제한 값과 대조하고, 다르면 그 변경을 새 판에 옮긴다 — D3 가 실행 중이라 글자가 이 계획의 앵커와 다를 수 있고, 전체를 바꾸면 D3 가 실행 중에 고친 것을 조용히 지운다 — 틀리면(Edit 가 여럿 어긋나면) 태스크마다 앵커를 맞추는 시간이 들고, 뜻이 다르게 옮겨진 곳은 태스크 리뷰가 잡는다.
32. 결정: 이 계획의 모든 "찾을 것"·끼울 자리와 기준 수는 `main` 의 `d2dc3cb`(D3 의 머지 커밋 - 트리가 D3 의 끝 `11fc4d7` 과 같다. 단위 시험 1143·46 파일, 출처 46·29·31, 플로 14)에 맞췄고, 그 트리를 스크래치 사본에 풀어 계획을 기계적으로 적용해 쟀다(미리 돌려 본 것). D3 계획의 글자와 다른 자리(리뷰 수정의 `useMemo`·lucide 깊은 import·`screen-state.ts`·`resource-options.ts`·I1 의 조회가 던지는 닿지 못함)는 D3 가 커밋한 글자를 따랐다 — D4 는 D3 가 병합된 `main` 에서 시작한다(전역 제약) — 틀리면(병합 전 재검토가 글자를 또 바꿨으면) 결정 31 대로 하고 Task 1 Step 1 의 수를 기준 수로 삼는다.
33. 결정: `pnpm-workspace.yaml` 의 `minimumReleaseAgeExclude`(`lucide-react-native@1.49.0`)를 Task 1 Step 1 이 뺀다 — D3 운반 T10(D3 는 두 빌드가 2026-09-30T22:27:09Z 전이라 두었다 - D3 실측 L6). `date -u` 와 릴리스 시각으로 창이 지났는지 먼저 보고, `pnpm install --frozen-lockfile` 로 확인한다 - 2026-09-30T22:36Z 에 스크래치 사본에서 예외 없이 통과했다 — 틀리면(frozen 설치가 막히면) 원인을 가른다. 예외를 되살려 덮지 않는다.
34. 결정: 태스크 다섯, 브랜치 하나(D3 가 넘긴 항목도 이 다섯에 넣는다 - 판정하지 않은 재조회·53e·I1 의 참조 상태·`canLoadMore`·T10 은 Task 1, M8 은 Task 2 와 4, M2 는 Task 3, L7 은 Task 5). 순서는 판단(Task 1) → 세션·가드(Task 2) → 훅(Task 3) → 화면(Task 4) → 기기(Task 5) — 사용자 요구(최대 여섯, 가능하면 다섯, 기기 작업은 하나) — 틀리면 태스크 경계만 바뀐다.

---
35. 결정: 화면을 쌓는 이동(목록의 행, 조건 바꾸기, "새로 만들기", "수정")은 한 번만 한다: `lib/navigation/once.ts` 의 `createOnce` 가 첫 부름에 잠그고 잠긴 동안의 부름을 버리며, `components/app/navigate-once.ts` 의 `useNavigateOnce` 가 누른 화면이 다시 앞에 올 때(`useIsFocused`) 푼다. "새로 만들기"·"수정" 은 `Link` 가 아니라 이 가드를 지나는 버튼이다 — D3 최종 검토 M8(행을 빠르게 두 번 누르면 상세가 두 벌 쌓인다). 시각으로 풀지 않는다 - 이동이 끝나는 시각은 기기마다 다르고, 쓰기는 이미 쓰기 캐시로 막는다(`useSubmitOnce`) — 틀리면(이동이 화면을 뒤로 보내지 않아 잠금이 남으면) 그 이동의 버튼이 죽는다. 그런 이동이 생기면 `release` 를 그 이동의 끝에 건다.
36. 결정: 관계 선택기의 참조 목록도 D3 의 목록·상세처럼 조회가 닿지 못함을 던지고(`queries/resource-options.ts` 의 `referenceQueryOptions`), 선택기가 그릴 것은 `lib/resources/screen-state.ts` 의 `referenceState` 가 데이터·오류에서 정한다 - 읽은 보기가 있으면 재조회가 닿지 못해도 그대로 두고 작은 실패를 따로 그리지 않는다. `form.ts` 에 두려던 `referenceFailure` 는 뺐다 — D3 최종 검토 I1(재조회의 실패가 읽은 데이터를 갈아엎었다)과 D3 의 고침이 "D4 의 무효화도 같은 길" 이라 했다. 선택기는 고를 것을 보여 줄 뿐이고 그사이 없어진 보기는 저장이 관계 오류로 알린다(스펙 9.1) — 틀리면(선택기에도 작은 실패가 필요하면) `ReferenceState` 에 `refreshFailed` 를 더하고 시트에 `RequestFailed compact` 하나.
37. 결정: 무한 스크롤의 끝(`nextPageQuery`)과 선택기의 잘림(`referenceList` 의 `truncated`)을 `view.ts` 의 `nextLinkQuery` 하나로 판정한다 — 빈 쪽·`next: ''`·경로뿐인 링크는 둘 다 "더 없다" 다. D3 최종 검토 53e 의 두 갈래 중 "한 규칙으로 맞춘다" 를 골랐다 - 첫 소비자인 선택기가 "앞 100건만 표시했습니다" 를 거짓으로 띄우지 않고, `linkPresent` 주석이 이미 "두 자리가 한 함수로 판정한다" 고 약속했다. 복사본이라 출처 기록에 이탈 하나를 더한다 — 틀리면(`''` 를 잘림으로 봐야 하는 백엔드가 생기면) `nextLinkQuery` 한 곳과 `next-link.test.ts` 의 행.
38. 결정: E2E 하네스의 빌드 레시피(`test/e2e/android.sh build`)가 Gradle 앞에서 Metro 의 디스크 캐시(`os.tmpdir()` 의 `metro-cache`)를 빌드마다 비운다 — D3 실측 L7(캐시가 남은 채 돈 번들 단계가 `0xC0000005` 로 죽었고 지운 뒤 재현되지 않았다). 재시도가 아니라 알려진 계기를 없애 빌드가 늘 같은 자리에서 시작하게 한다. 레시피는 빌드 지문에 들어 APK 를 한 번 다시 만든다(어차피 다시 만든다) — 틀리면(그래도 죽으면) 전역 제약의 Gradle 줄대로 30분을 정해 원인을 가르고 W1 에 적는다. 다시 돌려 덮지 않는다.
39. 결정: 화면의 조회 훅(`useResourceList`·`useResourceDetail`·`useRelationshipReferences`)은 `subscribed: useIsFocused()` 를 준다 — D3 최종 검토 M2(조건을 바꿀 때마다 쌓이는 목록 화면이 앱 복귀·연결 복귀마다 읽은 쪽 전부를 다시 읽는다), TanStack Query 의 React Native 안내, 설치본이 받는다(사실 절). 쌓인 화면은 무효화도 부르지 않고 다시 앞에 올 때 부른다 - 쓰기 뒤 돌아온 목록·상세가 새 값을 그리는 길이 "무효화 즉시" 에서 "돌아올 때" 로 바뀐다. D3 의 `examples-scroll-refresh` 는 돌아온 목록의 재조회와 이름 바꾸기가 겨루므로 둘째 누름의 제목을 정규식으로 받는다 — 틀리면(쌓인 화면도 바로 새 값이어야 하면) 옵션 한 줄을 빼고 Task 5 의 W3 수가 D3 의 판으로 돌아간다.
40. 결정: 재조회가 판정하지 않은 응답(5xx·408·429)을 받아도 읽은 데이터를 둔다: 조회의 `queryFn`(`throwIfUnreachable`)이 그 응답을 `UnreachableError(request, response)` 로 던지고, 화면 상태(`listScreen`·`detailScreen`·`referenceState`)가 첫 조회면 그 응답의 문구를 배너로, 재조회면 읽은 데이터와 작은 실패(앱 문구 "지금은 요청을 처리할 수 없습니다…" 와 "다시 시도")로, 다음 쪽이면 목록 끝의 작은 실패로 그린다. 판정한 오류(그 밖의 4xx)는 결과 값이라 새 답이다 — D3 재검토: 백엔드 오류 문서는 결과 값이라 목록의 재조회가 5xx 를 받으면 읽은 쪽 전부가 오류 한 쪽으로 바뀌고 다음 재조회는 한 쪽만 읽는다. D4 의 쓰기 뒤 무효화가 그 길을 늘린다. 셋을 판정하지 않은 응답으로 보는 것은 회전(결정 11)과 같고, 첫 조회의 문구는 백엔드의 것 그대로다(스펙 9.2). 4xx 는 조건이 그대로인 조회에서 이미 첫 조회가 받은 답이고, 상세의 404 는 지워진 자원이라 새 답이 맞다 — 틀리면(재조회의 5xx 문구를 보여야 하면) `refreshFailed` 에 문구를 싣고 작은 실패가 그것을 그린다. 판정한 4xx 가 재조회에서 처음 오면(조건 밖의 사정) 여전히 읽은 쪽이 한 쪽으로 바뀐다.
41. 결정: 목록 끝에서 다음 쪽을 부를지(`loadMore` 의 가드)를 lib 의 순수 함수 `canLoadMore`(`screen-state.ts`)로 옮겨 네 행으로 잰다 — D3 재검토의 선택 항목이고, 훅은 시험하지 않으므로(스펙 11.1) 판단을 lib 로 뺀다. 훅(`queries/resources.ts`)은 `canLoadMore(query)` 한 줄을 부른다 — 틀리면 훅 한 줄을 되돌린다.

## 이 계획이 근거로 삼은 사실 (2026-10-01 확인)

추측이 아니라 그날 설치본·소스에서 직접 읽거나 스크래치에서 돌려 본 것이다.

**TanStack Query 5.104.0**(`node_modules/@tanstack/query-core/build/modern`):
- `mutation.js` 의 `execute` 는 첫 `await` 앞에서 `#dispatch({ type: 'pending' })` 를 부른다 — `observer.mutate()` 가 돌아온 그 틱에 `client.isMutating({ mutationKey })` 가 1 이다. 끝날 때(성공·실패)의 `#dispatch` 도 그 자리에서 캐시를 바꾼다. `test/unit/queries/submit-once.test.ts` 가 이 동작을 실제 `QueryClient` 로 잰다.
- `notifyManager.js` 의 기본 스케줄러는 `setTimeout(cb, 0)` 이다 — 관찰자에게 가는 알림(곧 `isPending` 을 싣는 React 의 렌더)은 그 뒤다. 훅 옵션의 `onSuccess`·`onSettled` 는 `execute` 안에서 `success` 를 알리기 전에 불린다.
- `isMutating`·`matchMutation` 의 `mutationKey` 필터는 앞 조각 일치다(`partialMatchKey`) — `['resources', t, 'update', '1']` 는 `…'10'` 의 쓰기를 찾지 않는다(`keys.test.ts` 가 잰다).
- 지운 조회(`removeQueries`)를 지켜보던 `QueryObserver` 가 다시 옵션을 받으면(곧 다시 그려지면) 캐시에 새 조회를 만들고 `enabled` 가 참이면 부른다 — 스크래치에서 `QueryObserver` 로 쟀다: 지운 뒤 `setOptions(enabled: true)` 는 조회 수를 1 에서 2 로, `enabled: false` 는 그대로 둔다(결정 8).
- `mutationOptions` 가 있다(`build/modern/mutationOptions.d.ts`) — `mutationKey` 를 준 오버로드는 그 키를 필수로 한다. 돌려준 객체는 `useMutation` 에도 `new MutationObserver(client, …)` 에도 들어간다.
- `@tanstack/react-query` 의 `useBaseQuery.js:22` 가 `subscribed` 를 받는다(`options.subscribed !== false`) — 거짓이면 관찰자가 캐시를 구독하지 않아 앱 복귀·네트워크 복귀·무효화의 재조회를 부르지 않는다. 다시 참이 되면 `observer.subscribe` 가 `shouldFetchOnMount` 를 보고 부른다(`staleTime` 0 이라 늘 부른다). 구독하지 않는 동안 효과의 `setOptions` 도 부르지 않는다(`hasListeners()` 가 거짓). `useQueries` 는 `subscribed` 를 쿼리마다가 아니라 한 번 받는다(`useQueries.js:144`). TanStack Query 의 React Native 안내가 `subscribed: useIsFocused()` 다.
- 재조회의 실패는 앞의 `data` 를 둔다 — D3 가 조회의 `queryFn` 이 닿지 못함을 던지게 바꾼 까닭이다(`lib/resources/screen-state.ts` 의 `throwIfUnreachable`, D3 실측 L7). 반대로 `queryFn` 이 값을 돌려주면 그것은 성공이라, 무한 조회의 재조회가 첫 쪽에서 오류 문서를 받으면 `getNextPageParam` 이 끝을 말해 쪽 배열이 그 한 쪽이 되고 다음 재조회는 `remainingPages` 만큼(한 쪽)만 읽는다 — D3 재검토가 백엔드 오류 문서(5xx·429)에서 짚었다. 스크래치에서 같은 옵션의 `QueryClient` 로 재현했다: 세 쪽을 읽고 재조회가 503 이면 값으로 두는 판은 오류 한 쪽, 던지는 판은 여섯 행이 남고 다음 재조회가 세 쪽을 다시 읽는다(`test/unit/queries/refetch-unjudged.test.ts`).

**Expo Router 57.0.24**(`node_modules/expo-router/build`):
- `react-navigation/routers/StackRouter.js` 의 `POP_TO` 는 지금 라우트에서 거꾸로 같은 이름의 라우트를 찾아 거기까지 닫는다. `merge: true` 이고 새 파라미터가 없으면 그 라우트의 파라미터를 그대로 둔다. 없으면 지금 라우트를 새 라우트로 바꾼다. `StackActions.popTo(name, params, { merge })` 는 `expo-router/react-navigation` 에서 import 한다. `router.dismissTo(href)` 도 `POP_TO` 인데 파라미터를 덮는다(`merge` 가 없다) — D3 사실 절과 같다.
- `fork/useBackButton.native.js` — 내비게이터의 `hardwareBackPress` 핸들러는 `canGoBack()` 이 거짓이면 `false` 를 돌려주고, React Native 의 `BackHandler.android.js` 는 어느 핸들러도 `true` 를 돌려주지 않으면 `exitApp()` 한다. 핸들러는 나중에 건 것부터 부른다(`for (let i = length - 1; …)`) — 화면이 효과에서 건 핸들러가 내비게이터의 것보다 먼저다.
- 경로 가드의 `<Redirect>` 는 루트에서 `(app)` 을 로그인 화면으로 바꿔 끼운다(REPLACE, D2 운반 기록 M5) — 그 뒤 루트에는 로그인 화면 하나뿐이라 `router.canGoBack()` 이 거짓이다.
- `useSegments()` 는 파일 경로의 세그먼트를 준다 - 그룹 포함, 파라미터 자리는 `[id]` 그대로(`['(app)', 'examples', '[id]', 'edit']`). 인덱스 라우트는 `index` 를 싣지 않는다.
- 앱 셸의 Stack 은 `app/(app)/examples/index.tsx` 를 `examples/index` 라는 이름으로 싣는다(D3 의 목록·상세가 같은 규칙).
- `useIsFocused` 를 `expo-router` 가 내보낸다(`build/useIsFocused.js` - 벤더된 `react-navigation/native` 의 것 그대로).
- 밖에서 들어온 링크는 `app/+native-intent.tsx`(D3)가 앱 안 주소로 바꿔 넘긴다 — 이 계획의 플로가 여는 `templateexpo-e2e://examples/<id>/edit`·`…://login` 도 그 길을 지난다.

**Metro 캐시**: `@expo/metro-config` 의 `ExpoMetroConfig.js:206` 이 캐시 저장소를 `path.join(os.tmpdir(), 'metro-cache')` 에 둔다(Windows 는 `%TEMP%metro-cache`). D3 실측 L7 — 첫 APK 빌드가 `:app:createBundleReleaseJsAndAssets` 에서 `0xC0000005` 로 죽었다. 번들은 다 써졌고 `hermesc` 는 같은 입력으로 세 번 성공했다 - 죽은 것은 번들을 다 쓴 node(`export:embed`)의 종료다. `$TMP/metro-cache`(29MB)를 지운 뒤에는 재현되지 않았다. Gradle 의 번들 명령은 어차피 `--reset-cache` 를 준다.

**D3 실측 L6**: 필터 시트·정렬 메뉴(React Native `Modal` 위의 `Sheet`)의 요소를 Maestro 가 찾았다. `Sheet` 는 두 플랫폼 모두 키보드 높이만큼 올라가고(`KeyboardAvoidingView` 의 `padding`) 아래 여백에 내비게이션 막대 높이를 더한다. 릴리스 대기 예외(`lucide-react-native@1.49.0`)는 D3 의 두 빌드가 2026-09-30T22:27:09Z 전이라 두었다. 2026-09-30T22:36Z 에 스크래치 사본에서 예외를 빼고 `pnpm install --frozen-lockfile` 이 통과했다(`✓ Lockfile passes supply-chain policies`).

**React Native 0.86.3·Expo 설정**: `@expo/config-plugins` 의 `WindowSoftInputMode.js` 는 `softwareKeyboardLayoutMode` 가 없으면 `adjustResize` 를 적는다. SDK 57 의 Android 는 edge-to-edge 라 그 설정이 창을 키보드만큼 줄이지 않을 수 있다 — 기기에서 재지 않았다. 그래서 플로는 입력 뒤 라벨을 눌러 키보드를 내린다(결정 26).

**세 백엔드의 access token 수명**: 정본 FastAPI `config/auth.py:38` `read_int("JWT_ACCESS_EXPIRES_SECONDS", 900)`, NestJS `src/config/settings.ts:153` `optionalInteger('JWT_ACCESS_EXPIRES_SECONDS', 900, env)`, Rails `config/initializers/auth.rb:30` `read_int.call("JWT_ACCESS_EXPIRES_SECONDS", 900)` — 셋 다 같은 변수, 기본 900초, 0 이하는 거절한다. 정본의 `app/auth/refresh_sessions.py:101-108` — 폐기된 refresh 가 다시 오면 그 사용자(`user_id`)의 폐기되지 않은 세션을 전부 폐기한다. 앱(`lib/auth/tokens.ts`)은 만료까지 60초 이하면 회전하므로 수명 10초의 access 는 늘 회전 대상이다.

**형제 템플릿의 실측**(`../template-typescript-nextjs` 의 D4 계획 §1, 정본 FastAPI 를 HTTP 로 물은 값): 쓰기 라우트는 쿼리 파라미터를 받지 않는다(W-5). 422 는 실패한 필드 전부를 싣고 `detail` 은 필드마다 같은 문장이다 - 어느 칸인지는 `source.pointer` 만 알려 준다(W-6). 관계 오류는 422 가 아니라 404 `RELATIONSHIP_RESOURCE_NOT_FOUND`·409 `TYPE_MISMATCH`·400 이고 포인터가 `/data/relationships/<이름>/…` 다(W-7). 두 번째 DELETE 는 404 `RESOURCE_NOT_FOUND` 다(W-4). 유일성 제약이 없어 두 번 제출은 곧 중복 행이다(W-12). 참조 자원은 공개 읽기이고 쓰기 라우트가 없다(W-11). 정본은 태그를 붙인 순서가 아니라 id 오름차순으로 돌려준다(원본 E2E 의 태그 순서 절).

**씨앗**(`test/e2e/seed/examples.sql`, 원본 그대로): 분류 `11110000-…-000000000001`("프로브 분류 하나")·`…-002`("프로브 분류 둘"), 라벨 `22220000-…-000000000001`("프로브 라벨 하나")·`…-002`("프로브 라벨 둘"). 채움 행이 분류·라벨마다 99건(`힣넘침분류-000`…`-098`, id `11119999-0000-4000-8000-000000000000`…`098`, 라벨은 `22229999-…`) 있어 각 101건이다 — 이름 순 첫 100건에 `-098` 하나만 들지 않고 `links.next` 가 켜진다. 선택기의 보기는 `프로브 … 둘`·`프로브 … 하나` 가 맨 앞 둘이다.

**D2 의 끝(`ac88fe0`)과 D3 의 끝(`11fc4d7`)**: `(app)/_layout.tsx` 의 가드는 `decideGuard({ status, loggingOut, latched, pathname })` 에 `usePathname()` 을 넘긴다. `components/form/credentials-form.tsx` 의 `submit` 은 `if (pending) return`. `queries/auth.ts` 의 `establishIfSignedIn` 은 `establish` 의 거절을 잡아 `logFailure` 로 남긴다 - 옵션은 훅 안에 인라인이다. `app/(app)/examples/new.tsx` 는 제목만 있는 자리(testID `new-example-screen`)다. D3 의 `queries/resources.ts` 는 `queries/resource-options.ts` 의 `listQueryOptions`·`detailQueryOptions`(키·요청, `queryFn` 이 닿지 못함을 던진다)를 쓰고, `useResourceDetail(resource, id)` 는 `{ screen, retrying, retry }` 를 준다 - `screen` 은 `lib/resources/screen-state.ts` 의 `detailScreen` 이 데이터·오류에서 정한 것(`loading`·`notFound`·`unreachable`·`banner`·`detail`, 뒤의 둘에 `refreshFailed`)이다. `lib/resources/view.ts` 는 `referenceRequest(target)`(→ `{ path, query, options }`, `sort=name`·`page[size]=100`)·`referenceList(target, document)`(→ `{ options, truncated }` - `truncated` 는 `linkPresent(links.next)`)·`REFERENCE_PAGE_SIZE`(100)·`bannerMessages`·`ListFailure` 를 export 한다. `nextPageQuery` 는 빈 쪽·`next: ''`·경로뿐인 링크를 끝으로 보는데 `referenceList` 는 `''` 를 잘림으로 본다(D3 최종 검토 53e). 목록의 행 누름은 가드 없이 `router.push` 한다(M8).

## 미리 돌려 본 것

스크래치 사본에서 돌렸다 — 저장소에는 쓰지 않았다(저장소는 `git show`·`git fetch`(사본 쪽으로)로 읽기만 했다).

**`main` 의 `d2dc3cb`(= D3 의 끝 `11fc4d7` 과 같은 트리) 위에서 흉내 냈다(2026-10-01T08:40+09:00 무렵).** `11fc4d7` 과 `d2dc3cb` 을 스크래치 사본으로 가져와(`d2dc3cb` 은 그 머지 커밋이고 트리 `5af34db…` 가 같다) 이 계획을 태스크 순서대로 기계적으로 적용했다 - 두 위에서 끝의 트리가 같았다(`4d8d4b6…`), 검사는 그 트리에서 돌았다 — 계획의 "찾을 것/바꿀 것"·파일 쓰기·끼울 자리를 그대로 적용하고, 찾을 것이 정확히 한 번 맞지 않으면 실패하는 도구다. 모든 Edit·파일 쓰기·끼울 자리(152개)가 정확히 한 번씩 맞았고, 패치 둘이 원본 blob(`bd9cff2…`·`45640d7…`)에 `git apply --check` 를 지났다(`form.ts` 의 패치는 그 판을 원본에 붙여 만든 파일과 바이트가 같다). 태스크마다 `pnpm format` 뒤 typecheck·lint·format:check·인용 검사가 exit 0 이었고:

- 기준: 시험 1143(46 파일), 출처 46·29·31, 플로 14.
- Task 1: 시험 1250(53 파일), 출처 48·33·31. 릴리스 대기 예외를 빼고 `pnpm install --frozen-lockfile` 이 exit 0(2026-09-30T22:36Z, `✓ Lockfile passes supply-chain policies`, 락파일은 그대로).
- Task 2: 시험 1279(56 파일), 출처 48·35·31.
- Task 3: 시험 1286(58 파일).
- Task 4: 시험 1286, `pnpm types:routes`, `pnpm lint:secrets` exit 0, `expo export --clear` 두 플랫폼 번들 성공(`Android Bundled … (2048 modules)`·`iOS Bundled … (1962 modules)` - Metro 의 모듈 수는 같은 번들에서도 조금 흔들린다(D3 재검토 70b), `Unable to resolve` 0, 따로 둔 TMP 로).
- Task 5: 출처 48·36·31, 플로 18, `bash -n`(하네스 둘), `node --check`·eslint(스크립트), D4 가 쓰거나 고친 플로 여섯의 YAML 이 `yaml` 로 풀린다(Maestro 는 돌리지 않았다), compose 의 세 서비스가 `JWT_ACCESS_EXPIRES_SECONDS` 를 받는다(YAML 병합 키까지 풀어 읽었다).
- 빨간 단계(시험 먼저)의 출력은 각 Step 의 Expected 에 적은 그대로다 — 새 판단 13 실패, 패치 뒤 원본 시험 8 실패·33 통과, 흐름 모듈 없음, 조회 화면의 상태 네 파일 29 실패·10 통과, 회전 7 실패·14 통과, 보호 경로 7 실패·18 통과, 세우기 거절 4 실패, 제출 가드 모듈 없음, 이동 가드 모듈 없음, 쓰기 키 1 실패·13 통과, 인증 오류 배선 2 실패·1 통과, 참조 목록의 전이 3 실패.
- 판정하지 않은 재조회(결정 40): `throwIfUnreachable` 의 5xx·408·429 줄을 지운 뮤턴트에서 `refetch-unjudged.test.ts` 의 목록·상세 전이 둘과 `screen-state-unjudged.test.ts` 가 죽는다. 같은 옵션의 `QueryClient` 로, 503 을 값으로 두는 판은 세 쪽이 오류 한 쪽이 되고 다음 재조회가 한 번만 부른다(`afterBusy: 1, nextRefetchCalls: 1` - 스크래치 탐침). 던지는 판은 여섯 행이 남고 다음 재조회가 세 번 부른다.
- 뮤턴트 둘(앞 판에서): `submitOnce` 의 `isMutating` 검사를 지우면 제출 가드의 첫 시험이, `establishIfSignedIn` 의 `try`/`catch` 를 지우면 세우기 거절 시험 둘이 죽는다.
- 결정 8 의 근거: `QueryObserver` 로 조회 하나를 부른 뒤 `removeQueries` 하고 `setOptions` 를 다시 부르면 `enabled: true` 는 조회를 한 번 더 부르고(1 → 2) `enabled: false` 는 부르지 않았다.
- `examples-scroll-refresh` 의 목록 GET 을 세는 `awk` 는 흉내 낸 접근 로그로 맞는 수(2)를 냈다. Task 1 Step 1 의 `git merge-base`·`git diff --stat … ':(exclude)docs/superpowers/plans'` 는 저장소의 D4 브랜치에서 읽기로 돌려 `main 을 담았다` 와 빈 출력을 냈다.

그 앞에도 흉내 냈다 - D3 계획만 흉내 낸 트리와, D3 의 중간 커밋(`756cb7a`·`b06955c`)에 D3 계획의 Task 5 를 얹은 트리다. 그 판들의 앵커는 이 판에서 D3 의 글자로 바꿨다(결정 32).

**돌리지 않은 것:** 에뮬레이터·Docker(`compose:verify` 포함)·Maestro(`maestro test`·`check-syntax`)·게이트 [11]·[12]. 기기에서 처음 재는 것 — 라벨 누름이 키보드를 내리는지, 가드가 보낸 로그인 화면의 뒤로 가기 → 홈, 삭제 뒤 404 가 없는 것, 끊긴 세션의 회전 401 → 로그인 → 복귀, 목록 밖 선택의 그림, 쓰기마다의 실제 회전, 쌓인 화면의 재조회 수(W3), Metro 캐시를 비운 빌드 — 은 Task 5 가 게이트에서 잰다. 재조회의 5xx 는 기기에서 일으키지 않는다(단위 시험과 전이 시험이 잰다).

---
## D3 가 넘긴 것 (이 계획의 전제 - `main` 의 `d2dc3cb`)

`main` 의 `d2dc3cb`(D3 의 머지 커밋 - 트리가 D3 의 끝 `11fc4d7` 과 같다)에서 읽었다. D4 의 브랜치는 그 커밋에서 만들어졌다 - Task 1 Step 1 이 확인한다. 하나라도 없으면 멈추고 컨트롤러에 알린다. 병합 전 재검토가 이름이나 글자를 바꿨으면 이 계획의 Edit 블록은 같은 뜻의 자리를 찾아 고친다(결정 31).

| 산출 | 이 계획이 쓰는 모양 |
| --- | --- |
| `lib/resources/view.ts` | `referenceRequest(target): { path, query, options }`, `referenceList(target, document): ReferenceList`(`{ options: { id, label }[], truncated }`), `REFERENCE_PAGE_SIZE`(100), `bannerMessages(errors)`, `type ListFailure`(`{ kind: 'banner'; messages } \| { kind: 'unreachable' }`), `nextPageQuery(result)`, `detailRequest`·`detailView`·`detailLabels` |
| `lib/resources/screen-state.ts` | `UnreachableError`, `throwIfUnreachable(result, request)`(닿지 못함만 던진다), `listScreen`·`detailScreen`, `type DetailScreen`(`loading`·`notFound`·`unreachable`·`banner`·`detail`, 뒤의 둘에 `refreshFailed`), 비공개 `refetchUnreachable(error)`, blob `774cc9b…` - 이 계획이 파일 전체를 바꾼다(판정하지 않은 응답의 정책, `referenceState`, `canLoadMore`) |
| `lib/resources/route-params.ts` | `listRouteParams`·`isCurrentListHref` — 목록 화면이 쓴다 |
| `lib/navigation/` | `deep-link.ts`·`AGENTS.md`(밖에서 들어온 링크의 정규화, `app/+native-intent.tsx` 가 잇는다) - 이 계획이 `once.ts` 와 그 절을 더한다 |
| `queries/keys.ts` | `RESOURCES_KEY`, `queryKeys.{lists,list,detail}`, `type CacheWrite`(`create`·`update`·`delete`·`logout`), `cacheEffects`, `applyCacheEffects` — 머리 주석 "생성·수정·삭제의 호출부는 D4 가 만든다" |
| `queries/resource-options.ts` | `listQueryOptions(resource, plan, send)`·`detailQueryOptions(resource, id, send)`(`queryFn` 이 닿지 못함을 던진다) |
| `queries/resources.ts` | `useResourceList(resource, params)`(`{ screen, loadMore, … }` - `loadMore` 의 가드가 훅 안에 있다), `useResourceDetail(resource, id): ResourceDetailState`(`{ screen, retrying, retry }`) |
| `queries/auth.ts` | `useLoginMutation`·`useRegisterMutation` 이 옵션을 인라인으로 갖고 `establishIfSignedIn` 을 지난다, `LOGOUT_MUTATION_KEY`, 로그아웃이 `cacheEffects({ kind: 'logout' })` 를 지난다 |
| `platform/query-client.ts` | `queryClient`(`defaultOptions` 의 `queries`·`mutations` 가 `retry: false`·`networkMode: 'offlineFirst'`), `useQueryRefetchTriggers` |
| `components/app/` | `Sheet({ open, onClose, testID, children })`(React Native `Modal`, 키보드 `padding`, 아래 여백), `RequestFailed({ retrying, onRetry, compact? })`(testID `request-failed`·`request-failed-compact`·`retry-button`), `NotFoundView()`(testID `not-found-screen`) |
| `components/ui/` | `Badge`, `Skeleton`, `Button`(`size="sm"`·`variant="outline"`·`"destructive"`), `Input`, `Text`(`variant="large"`) |
| `components/resource/` | `ResourceDetailView({ detail, labels })`(testID `detail-heading`·`detail-value-<키>`, `detail.screen` 을 그린다), `EmptyValue()`·`RelatedBadges({ values })`(`values.tsx`), `ListToolbar({ sortOptions, onFilter, onSort })`(`sort-sheet.tsx`), `AGENTS.md` 의 파일 표 |
| 화면 | `app/(app)/examples/index.tsx`(testID `examples-screen`, `listRouteParams`, 조건 바꾸기의 `go`, 행의 `onOpen`), `app/(app)/examples/[id]/index.tsx`(`const { id } = useLocalSearchParams<{ id: string }>()`), 목록의 testID `list-empty`·`resource-row-title` |
| E2E 하네스 | `run-android.sh` 의 Maestro env `API_URL`·플로마다 `api.log`·로캘 앞 단계의 `return 1`, `android.sh boot` 의 `logcat -G 16M`·비행기 모드 끄기, `android.sh build`(이 계획이 Metro 캐시 비우기를 더한다), 지문의 `test/e2e/android.sh`, `test/e2e/scripts/examples-api.js`(`STEP=seed\|create\|rename`, blob `2de615a…`), `examples-scroll-refresh.yaml`(상세에서 돌아와 이름 바꾼 행을 다시 누른다), `test/e2e/AGENTS.md` 의 `## 목록·상세 플로` 절과 `## 돌리기` 절, 플로 열넷(`examples-offline-refetch` 포함) |
| 스펙 | 8.2·8.3·8.5·9.3·11.3·16장의 D3 정정 — 이 계획의 스펙 정정은 7.2·7.3 의 절 끝, `### 8.6` 앞, `### 9.4` 앞, `### 11.4` 앞에 붙는다 |
| lint·시험 가드 | `lucide-react-native` 통을 값으로 import 하지 못한다(`eslint.config.js` 의 `@typescript-eslint/no-restricted-imports`), `app/`·`components/` 에 미디어 쿼리·플랫폼 변형이 없다(`test/unit/ui/breakpoints.test.ts`), `app/` 의 `useLocalSearchParams` 는 이름으로 꺼낸다(`test/unit/resources/route-params-usage.test.ts`), `.maestro-output/**` 은 eslint 가 무시한다 — 전역 제약 |
| 기준 수 | 단위 시험 1143(46 파일), 출처 기록 경로 46·이탈 29·원본 그대로 31, 플로 14 — 뒤의 "늘어난다" 는 이 수에서 센다 |

## D2·D3 에서 이어받은 것

| 항목(출처) | 맡은 곳 |
| --- | --- |
| 가드가 보낸 로그인 화면에서 뒤로 가면 앱이 닫힌다(D2 최종 검토 M5) | Task 2 Step 6 `useBackToHome`(결정 10), Task 5 `examples-create` 의 뒤로 가기 |
| 회전 요청의 백엔드 오류가 전부 세션 삭제로 간다(M6) | Task 2 Step 1–2 — 5xx·408·429 → `unreachable`, 이탈 기록·시험, 스펙 7.2 정정(결정 11) |
| 제출 가드가 렌더 시점의 값을 본다(M7) | Task 2 Step 6 `submit-once.ts`·자격증명 폼, Task 4 자원 폼·삭제 확인(결정 9) |
| `session-store.ts` 의 시각 주석(M13) | Task 2 Step 3(결정 12) |
| `usePathname()` 이 `/examples/a%2Fb/edit` 를 푼다 — 세그먼트 판정 또는 인코딩 유지, 시험 행(T3) | Task 2 Step 4 `routePattern`·시험 행(결정 13), Task 5 `examples-delete` 의 딥링크 |
| 첫 `getAccessToken()`·`signOut()` 호출자가 거절을 잡는다(T7) | Task 1 `write.ts`, Task 3 `platform/query-client.ts`(결정 14) |
| `establishIfSignedIn` 의 catch 정책에 시험이 없다(T16) | Task 2 Step 5 `test/unit/queries/auth.test.ts`(결정 15) |
| 로그인한 사용자가 다른 계정으로 로그인할 수 있다(M14, LEAVE — "D4 가 정하면 된다") | 바꾸지 않는다(결정 16) |
| 복원 창의 전제 - 이동하는 인증 오류 처리는 복원 뒤의 트리 안에서만(D2 운반 기록) | Task 3 — 쓰기는 복원 뒤의 화면에서만 시작한다(`query-client.ts` 의 주석) |
| 쓰기 가드(스펙 7.3 둘째 겹)와 인증 오류 처리(9.2)를 첫 인증 요청과 함께(D2 결정 4, D3 결정 16) | Task 1 `write.ts`, Task 3 `MutationCache`(결정 4·5) |
| 실제 회전 왕복은 D4 의 쓰기 E2E 가 처음 지난다(D2 결정 5) | Task 5 — access 수명 10초(결정 23), 기록 W2 |
| `new.tsx` 의 자리를 폼으로 채운다(D2 결정 3) | Task 4 |
| 쓰기 훅은 `keys.ts` 의 표를 부른다 - 키를 손으로 적지 않는다(D3 넘김) | Task 3 `writes.ts` |
| `referenceRequest`·`referenceList` 의 첫 소비자, `form.ts` 를 복사 + 패치 + 출처 기록으로(D3 넘김) | Task 1(결정 1), Task 3 `referenceQueryOptions`·`useRelationshipReferences` |
| 쓰기 화면은 라우트 파라미터를 이름으로 꺼낸다 - `withAnchor` 의 `initial`(D3 넘김, D3 결정 39) | Task 4 `edit.tsx` 의 `const { id }`, `new.tsx` 는 읽지 않는다 |
| 목록의 "새로 만들기", 상세의 "수정"·삭제, 쓰기 뒤 이동은 기록을 생각해서(D3 넘김) | Task 4(결정 7·17) |
| 쓰기 플로의 제목에 `probe-seed`·`probe-d3-` 를 쓰지 않는다(D3 넘김) | Task 5 — `d4-<이메일 끝 8자>`(결정 25) |
| `queries/` 의 첫 단위 시험 옆에 T16 시험(D3 넘김) | Task 2 Step 5 |
| 조회·쓰기에 `signal` 을 붙이면 세 곳을 함께(D3 넘김, T24) | 붙이지 않는다 — 쓰기도 `signal` 없이 보낸다(전역 제약) |
| 재조회가 닿지 못해도 읽은 데이터를 둔다 - "D4 가 붙일 쓰기 뒤 무효화도 같다"(D3 최종 검토 I1, D3 가 고쳤다) | Task 1 Step 7 `referenceState`, Task 3 Step 4 `referenceQueryOptions` - 참조 목록도 같은 길(결정 36) |
| 쌓인 목록 화면이 앱 복귀·연결 복귀마다 읽은 쪽 전부를 다시 읽는다(D3 최종 검토 M2) | Task 3 Step 4 `subscribed: useIsFocused()`(결정 39), Task 5 `examples-delete` 의 앱 복귀·`examples-scroll-refresh` 의 둘째 누름, 기록 W3 |
| 행을 빠르게 두 번 누르면 상세가 두 벌 쌓인다(M8) | Task 2 Step 7 `createOnce`·`useNavigateOnce`·행과 조건 바꾸기, Task 4 "새로 만들기"·"수정"(결정 35) |
| `referenceList` 는 `next: ''` 를 잘림으로, `nextPageQuery` 는 끝으로 본다(53e) | Task 1 Step 7 `nextLinkQuery`·`next-link.test.ts`·출처 이탈(결정 37) |
| 릴리스 대기 예외 `lucide-react-native@1.49.0`(T10) | Task 1 Step 1 — `date -u` 로 창을 보고 빼고 `pnpm install --frozen-lockfile`(결정 33) |
| 첫 APK 빌드가 번들 단계에서 `0xC0000005` 로 죽었다(D3 실측 L7) | Task 5 Step 1 `android.sh` 의 `clear_metro_cache`(결정 38), 기록 W1 |
| 목록의 재조회가 백엔드 오류 문서(5xx·429)를 받으면 읽은 쪽이 오류 한 쪽으로 바뀌고 다음 재조회는 한 쪽만 읽는다 - D4 의 쓰기 뒤 무효화가 그 길을 늘린다(D3 재검토) | Task 1 Step 7 — 판정하지 않은 응답(5xx·408·429)도 던지고 읽은 데이터를 둔다. 정책은 `screen-state.ts` 의 `throwIfUnreachable`·화면 상태, 시험 둘(판단·전이), 스펙 9.3 정정(결정 40) |
| `loadMore` 의 가드에 시험이 없다(D3 재검토, 선택) | Task 1 Step 7 `canLoadMore`, Task 3 Step 4 훅의 한 줄(결정 41) |

## 태스크 지도

| 태스크 | 산출 | 시험 | 기기 |
| --- | --- | --- | --- |
| 1 쓰기 판단 | `lib/resources/form.ts`(복사·패치)·원본 시험(패치)·`form-expo.test.ts`, `lib/resources/write.ts`·`write.test.ts`, `screen-state.ts`(판정하지 않은 재조회의 정책·`referenceState`·`canLoadMore`), `view.ts` 의 `nextLinkQuery`, 출처 기록, 문서, 스펙 9.3 정정, 릴리스 대기 예외 빼기 | 원본 시험 33 + 새 판단 13 + 흐름 22 + 판정하지 않은 응답 23 + 그 전이 3 + 참조 상태 7 + 다음 쪽 6 | 없음 |
| 2 세션·가드 보강 | 회전의 5xx(`rotation.ts`·시험·출처), `session-store.ts` 주석, `routePattern`·가드·시험 행, `back-to-home.ts`·로그인·가입 화면, `submit-once.ts`·자격증명 폼, 로그인·가입 옵션과 T16 시험, 두 번 누름의 이동 가드(`once.ts`·`navigate-once.ts`·목록), 스펙 7.2·7.3 정정, 문서 | 회전 11·보호 경로 8·제출 한 번 3·세우기 거절 4·이동 가드 3 | 없음 |
| 3 쓰기 훅과 인증 오류의 한 곳 | `queries/writes.ts`, `mutationKeys`, `referenceQueryOptions`·`useRelationshipReferences`·상세의 `result`·`enabled`, 화면 조회의 `subscribed`, `loadMore` 의 `canLoadMore`, `MutationCache.onError`, 스펙 8.5·9 정정, 문서 | 쓰기 키 1·인증 오류 배선 3·참조 목록의 전이 3 | 없음 |
| 4 화면과 관계 선택기 | `resource-form.tsx`·`relationship-picker.tsx`·`confirm-sheet.tsx`, 상세·값·도구 줄 고침, 생성·수정·삭제 화면, 목록·상세의 진입점(이동 가드), 문서 | 정적 검사 + 두 플랫폼 번들 | 없음 |
| 5 쓰기 E2E 와 기기 | 백엔드의 access 수명(compose·하네스·출처), 빌드 앞의 Metro 캐시 비우기, `examples-api.js` 의 단계 다섯, 로그인 서브플로, 플로 넷, 스크롤 플로의 둘째 누름, 기기 실행(게이트), 기록 W1·W2·W3, 스펙 11.3 정정, 문서 | 게이트 12단계, 기기 E2E 18 플로 | **여기서만** |

## File Structure

```text
lib/resources/form.ts                      (복사·패치) 쓰기 판단 - 폼 상태 객체, 관계 선택기의 판단                 — Task 1
lib/resources/write.ts                     (신규) 쓰기 한 번의 흐름 - 세션 확인 → 요청 → 응답 해석                   — Task 1
lib/resources/screen-state.ts              (다시 씀) 판정하지 않은 재조회의 정책, referenceState, canLoadMore         — Task 1
lib/resources/view.ts                      (수정) nextLinkQuery - 다음 쪽과 잘림의 한 판정                           — Task 1
test/unit/resources/form.test.ts           (복사·패치) 원본 시험                                                     — Task 1
test/unit/resources/form-expo.test.ts      (신규) 폼 상태 객체·관계 선택기의 판단                                    — Task 1
test/unit/resources/write.test.ts          (신규) 쓰기의 흐름 - 가짜 전송·토큰                                       — Task 1
test/unit/resources/reference-state.test.ts · next-link.test.ts · screen-state-unjudged.test.ts (신규)              — Task 1
test/unit/queries/refetch-unjudged.test.ts (신규) · test/unit/resources/screen-state.test.ts (시험 하나)            — Task 1
queries/resource-options.ts · queries/resources.ts (주석 - 조회의 queryFn 정책)                                     — Task 1
lib/auth/rotation.ts                       (수정) 5xx·408·429 → unreachable                                         — Task 2
lib/auth/session-store.ts                  (수정) 시각 주석                                                          — Task 2
lib/auth/protected-paths.ts                (수정) routePattern                                                       — Task 2
lib/auth/guard-latch.ts                    (수정) 입력의 주석                                                        — Task 2
app/(app)/_layout.tsx                      (수정) 가드가 라우트 모양으로 판정                                        — Task 2
components/app/back-to-home.ts             (신규) 돌아갈 곳이 없는 뒤로 가기를 홈으로                                 — Task 2
lib/navigation/once.ts                     (신규) 한 번만 도는 이동                                                   — Task 2
components/app/navigate-once.ts            (신규) 누른 화면이 다시 앞에 올 때 푸는 이동 가드                          — Task 2
app/(app)/examples/index.tsx               (수정) 행·조건 바꾸기의 이동 가드(Task 2), "새로 만들기"(Task 4)
app/(auth)/login.tsx · register.tsx        (수정) 뒤로 가기, 쓰기의 키                                               — Task 2
components/form/credentials-form.tsx       (수정) 제출 한 번                                                         — Task 2
queries/submit-once.ts                     (신규) 제출 한 번 가드                                                    — Task 2
queries/auth.ts                            (수정) 로그인·가입의 옵션과 키                                            — Task 2
test/unit/auth/rotation.test.ts · protected-paths.test.ts (수정)                                                    — Task 2
test/unit/queries/submit-once.test.ts · auth.test.ts · test/unit/navigation/once.test.ts (신규)                    — Task 2
queries/keys.ts                            (수정) mutationKeys                                                       — Task 3
queries/writes.ts                          (신규) 생성·수정·삭제 훅                                                  — Task 3
queries/resource-options.ts                (수정) referenceQueryOptions                                              — Task 3
queries/resources.ts                       (수정) 상세의 result·enabled, useRelationshipReferences, subscribed, canLoadMore — Task 3
platform/query-client.ts                   (수정) MutationCache.onError - 세션 거절이면 signOut                      — Task 3
test/unit/queries/keys.test.ts (수정) · test/unit/platform/query-client.test.ts · test/unit/queries/reference-options.test.ts (신규) — Task 3
components/resource/resource-form.tsx      (신규) 생성·수정 폼, 수정 폼의 자리                                        — Task 4
components/resource/relationship-picker.tsx (신규) 관계 선택기                                                       — Task 4
components/app/confirm-sheet.tsx           (신규) 삭제 확인                                                          — Task 4
components/resource/values.tsx · resource-detail.tsx · sort-sheet.tsx (수정) testID, 상세의 actions, 도구 줄의 children — Task 4
app/(app)/examples/new.tsx                 (다시 씀) 생성                                                            — Task 4
app/(app)/examples/[id]/edit.tsx           (신규) 수정·삭제                                                          — Task 4
app/(app)/examples/[id]/index.tsx          (수정) "수정"                                                             — Task 4
docker-compose.e2e.yml                     (수정) JWT_ACCESS_EXPIRES_SECONDS                                        — Task 5
test/e2e/run-android.sh                    (수정) E2E_ACCESS_EXPIRES_SECONDS=10                                      — Task 5
test/e2e/android.sh                        (수정) 빌드 앞의 Metro 캐시 비우기                                        — Task 5
test/e2e/scripts/examples-api.js           (다시 씀) 단계 다섯 더, 401 이면 다시 로그인                               — Task 5
test/e2e/subflows/login.yaml               (신규)                                                                    — Task 5
test/e2e/flows/examples-create|edit|delete|write-errors.yaml (신규) · examples-scroll-refresh.yaml (수정)         — Task 5
docs/superpowers/notes/2026-10-01-d4-measurements.md (신규) W1·W2·W3                                                 — Task 5
docs/provenance/copied-core.json           (수정) Task 1·2·5
AGENTS.md · lib/resources/AGENTS.md · lib/auth/AGENTS.md · lib/navigation/AGENTS.md · queries/AGENTS.md · platform/AGENTS.md · components/resource/AGENTS.md · test/e2e/AGENTS.md (수정)
docs/superpowers/specs/2026-09-30-expo-jsonapi-template-design.md (정정) 9.3(Task 1), 7.2·7.3(Task 2), 8.5·9(Task 3), 11.3(Task 5)
```

---

### Task 1: 쓰기 판단 — `lib/resources/form.ts` 복사·패치, `lib/resources/write.ts`, 조회 화면의 상태(판정하지 않은 재조회·참조 목록)

**Files:**
- Create: `lib/resources/form.ts`(원본 복사 + 패치), `test/unit/resources/form.test.ts`(원본 복사 + 패치), `test/unit/resources/form-expo.test.ts`, `lib/resources/write.ts`, `test/unit/resources/write.test.ts`, `test/unit/resources/screen-state-unjudged.test.ts`, `test/unit/queries/refetch-unjudged.test.ts`, `test/unit/resources/reference-state.test.ts`, `test/unit/resources/next-link.test.ts`
- Modify: `lib/resources/screen-state.ts`(전체 - 판정하지 않은 응답의 정책, `referenceState`, `canLoadMore`), `test/unit/resources/screen-state.test.ts`(시험 하나), `lib/resources/view.ts`(`nextLinkQuery` - 53e), `queries/resource-options.ts`·`queries/resources.ts`(정책의 주석), `docs/provenance/copied-core.json`(경로 둘, 이탈 넷), `lib/resources/AGENTS.md`, `queries/AGENTS.md`, `pnpm-workspace.yaml`(릴리스 대기 예외 - T10), 스펙 9.3 정정

**Interfaces:**
- Consumes: `lib/resources/view.ts` 의 `bannerMessages`·`referenceList`·`ListFailure`·`ReferenceList`·`nextPageQuery`(D3), `lib/resources/screen-state.ts` 의 `refetchUnreachable`(비공개)·`UnreachableError`(D3), `lib/resources/index.ts` 의 `resourceByType`, `lib/resources/define.ts` 의 `formAttributes`·`isRequiredAttribute`·`resourcePath`, `lib/jsonapi/errors.ts` 의 `actionForErrors`·`groupErrors`, `lib/auth/form-state.ts` 의 `UNUSABLE_RESPONSE_MESSAGE`, `lib/jsonapi/send.ts` 의 `JsonApiSend`
- Produces:
  - `lib/resources/form.ts`(원본 그대로): `interface ResourceFormValues { attributes: Readonly<Record<string, string>>; relationships: Readonly<Record<string, readonly string[]>> }`, `interface ResourceFormState { documentErrors; fieldErrors; relationshipErrors; submitted }`, `IDLE_RESOURCE_FORM_STATE`, `writeDocument(resource, values, id?)`, `unusableFormState(values)`, `formStateFromErrors(errors, values)`, `decideWriteFailure(errors, values): WriteFailure`, `createdId(document)`, `initialFormValues(resource, result: JsonApiResult<SingleDocument> | null)`
  - `lib/resources/form.ts`(더한 것): `newFormValues(resource): ResourceFormValues`, `withAttribute(values, name, raw)`, `withRelationshipChoice(values, name, relationship, id: string | null)`, `relationshipTargets(resource): readonly (readonly [string, ResourceDefinition])[]`, `interface RelationshipOption { id; label; selected; listed }`, `interface RelationshipChoice { chosen; options; hasUnlisted }`, `relationshipChoice(relationship, list: ReferenceList, selected: readonly string[]): RelationshipChoice`
  - `lib/resources/screen-state.ts`(바꾼 것): `throwIfUnreachable(result, request)` 이 판정하지 않은 응답(5xx·408·429)도 던진다 - `new UnreachableError(request, response?)`(`response` 는 그 오류 문서, 닿지 못함이면 없다). `listScreen`·`detailScreen` 은 첫 조회의 판정하지 않은 응답을 그 문구의 배너로(`refreshFailed: false`), 재조회의 것은 읽은 데이터와 `refreshFailed: true` 로 그린다
  - `lib/resources/screen-state.ts`(더한 것): `interface ReferenceState { list: ReferenceList | null; failure: ListFailure | null }`, `interface ReferenceQueryFacts { result: JsonApiResult<CollectionDocument> | undefined; error: unknown }`, `referenceState(target, facts): ReferenceState`, `interface LoadMoreFacts { hasNextPage; isFetching; isFetchNextPageError }`, `canLoadMore(facts): boolean`
  - `lib/resources/view.ts`: `referenceList(…).truncated` 가 `nextPageQuery` 와 같은 판정(`nextLinkQuery`, 비공개)이다 - 빈 쪽·`next: ''`·경로뿐인 링크는 잘림이 아니다
  - `lib/resources/write.ts`: `sessionRejected(): Error`, `isSessionRejected(error: unknown): boolean`, `interface WriteDeps { getAccessToken: () => Promise<string | null>; send: JsonApiSend }`, `type CreateOutcome = { kind: 'saved'; id } | { kind: 'failed'; state: ResourceFormState }`, `type UpdateOutcome = CreateOutcome | { kind: 'notFound' }`, `type DeleteOutcome = { kind: 'deleted' } | { kind: 'failed'; messages: readonly string[] }`, `createResource(resource, values, deps): Promise<CreateOutcome>`, `updateResource(resource, id, values, deps): Promise<UpdateOutcome>`, `deleteResource(resource, id, deps): Promise<DeleteOutcome>`

- [ ] **Step 1: 브랜치와 D3 의 끝을 확인하고, 릴리스 대기 예외를 뺀다**

브랜치 `feat/d4-create-update-delete` 는 컨트롤러가 D3 가 머지 커밋으로 병합된 `main`(`d2dc3cb` - 트리가 D3 의 끝 `11fc4d7` 과 같다)에서 이미 만들었다(전역 제약). 브랜치에는 이 계획 문서의 커밋만 있을 수 있다. 여기서는 확인만 한다 — 만들거나 바꾸지 않는다.

```bash
git branch --show-current
git status --short
git log --oneline -3
git rev-parse --short main
git merge-base --is-ancestor d2dc3cb HEAD && echo "main 을 담았다"
git diff --stat d2dc3cb HEAD -- . ':(exclude)docs/superpowers/plans'
ls lib/resources/view.ts lib/resources/route-params.ts lib/resources/screen-state.ts queries/keys.ts queries/resources.ts queries/resource-options.ts components/app/sheet.tsx components/app/request-failed.tsx components/app/not-found-view.tsx components/ui/badge.tsx components/ui/skeleton.tsx test/e2e/scripts/examples-api.js
git grep -c -E "export function (referenceRequest|referenceList|bannerMessages)|export const REFERENCE_PAGE_SIZE|export type ListFailure" -- lib/resources/view.ts
git grep -c -E "export function (cacheEffects|applyCacheEffects|useResourceDetail|listQueryOptions|detailQueryOptions)" -- queries
git grep -c -E "export (function (throwIfUnreachable|listScreen|detailScreen)|class UnreachableError)" -- lib/resources/screen-state.ts
ls test/e2e/flows | wc -l
pnpm test 2>&1 | grep -E "Test Files|Tests "
node scripts/check-provenance.mjs | tail -n 1
grep -n "minimumReleaseAgeExclude\|lucide-react-native@" pnpm-workspace.yaml
```

Expected: 브랜치 `feat/d4-create-update-delete`, 작업 트리 깨끗, `main` 이 `d2dc3cb`, `main 을 담았다`, `git diff --stat` 이 아무것도 내지 않는다(계획 문서 밖은 `main` 그대로), 파일 열두 개가 다 있다, `view.ts` 5, `queries` 의 세 파일 합 5(`keys.ts` 2·`resources.ts` 1·`resource-options.ts` 2), `screen-state.ts` 4, 플로 `14`, `Tests  1143 passed (1143)`(46 파일), `복사 출처 기록 통과: 경로 46개, 이탈 29건, 원본 그대로 31개`, 마지막 `grep` 이 `minimumReleaseAgeExclude:` 와 `lucide-react-native@1.49.0` 두 줄(D3 는 예외를 두고 끝났다 - D3 실측 L6). 다르면 "D3 가 넘긴 것" 표와 맞춰 보고, 이름이 다르면 멈추고 컨트롤러에 알린다. 수가 다르면 그 수를 기준 수로 적어 두고 뒤의 "늘어난다" 를 거기서 센다.

릴리스 대기 예외를 뺀다(D3 운반 T10, 결정 33). 뺄 때가 지났는지 먼저 본다:

```bash
date -u
pnpm view lucide-react-native@1.49.0 time --json | node -e 'let s="";process.stdin.on("data",(d)=>(s+=d)).on("end",()=>{const at=Date.parse(JSON.parse(s)["1.49.0"])+24*3600000;console.log(new Date(at).toISOString(),Date.now()>=at?"뺀다":"아직")})'
```

Expected: `date -u` 가 2026-09-30 22:27:09 UTC 뒤, `2026-09-30T22:27:09.286Z 뺀다`. `아직` 이면(시계가 틀렸다) 멈추고 컨트롤러에 알린다. `pnpm-workspace.yaml` — Edit, 찾을 것:

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
```

Expected: `grep` 이 주석 줄 하나만 낸다, `frozen exit=0`(`✓ Lockfile passes supply-chain policies`, 2026-09-30T22:36Z 에 스크래치 사본에서 잰 출력과 같다). `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` 이면 원인을 가른다 — 예외를 되살려 덮지 않는다(스펙 16장: 재시도 0).

- [ ] **Step 2: 원본 `form.ts` 와 그 시험을 그대로 복사하고 원본 시험이 도는지 본다**

```bash
git -C ../template-typescript-nextjs show 34d0b1057d65693645e75bec4e9558dcf6838822:lib/resources/form.ts > lib/resources/form.ts
git -C ../template-typescript-nextjs show 34d0b1057d65693645e75bec4e9558dcf6838822:test/unit/resources/form.test.ts > test/unit/resources/form.test.ts
git hash-object lib/resources/form.ts test/unit/resources/form.test.ts
pnpm exec vitest run test/unit/resources/form.test.ts 2>&1 | tail -4
```

Expected: `bd9cff2e5fefbf4842f8f46206bac2b27b8278bd`·`45640d747c91623b5392571c9f67afc9b4e412ad`(원본 커밋의 blob), `Tests  41 passed (41)`. 다른 해시면 복사가 어긋난 것이다(줄 끝 등) — 다음 단계의 패치가 붙지 않는다.

- [ ] **Step 3: 이 저장소가 더할 판단의 시험을 쓴다 — 폼 상태 객체와 관계 선택기**

자원은 `probe*` 로 만든다 — `EXAMPLE` 로 재면 "선언을 읽는다" 와 "그 자원을 안다" 가 구별되지 않는다. 등록부를 거치는 `relationshipTargets` 만 등록된 선언으로 잰다.

`test/unit/resources/form-expo.test.ts` 를 만든다:

```ts
import { describe, expect, it } from 'vitest'

import { EXAMPLE, EXAMPLE_CATEGORY, EXAMPLE_TAG } from '@/lib/resources'
import { defineResource, type RelationshipDefinition } from '@/lib/resources/define'
import {
  newFormValues,
  relationshipChoice,
  relationshipTargets,
  withAttribute,
  withRelationshipChoice,
  type ResourceFormValues,
} from '@/lib/resources/form'
import type { ReferenceList } from '@/lib/resources/view'

/**
 * 이 저장소가 `lib/resources/form.ts`(template-typescript-nextjs 에서 복사)에 더한 판단 - 폼 상태
 * 객체(스펙 6.2)와 관계 선택기가 그릴 것. 원본의 시험은 test/unit/resources/form.test.ts 에 있다.
 *
 * 자원은 `probe*` 로 만든다 - `EXAMPLE` 로 재면 "선언을 읽는다" 와 "그 자원을 안다" 가 구별되지
 * 않는다. 등록부를 거치는 `relationshipTargets` 만 등록된 선언으로 잰다.
 */
const PROBE_TICKET = defineResource({
  type: 'probeTickets',
  path: '/probe/api/tickets',
  attributes: {
    probeSubject: {
      kind: 'string',
      label: 'PROBE 제목',
      readOnly: false,
      nullable: false,
      listed: true,
    },
    probePhase: {
      kind: 'enum',
      label: 'PROBE 단계',
      readOnly: false,
      nullable: false,
      listed: true,
      values: [
        { value: 'probe-open', label: 'PROBE 열림' },
        { value: 'probe-shut', label: 'PROBE 닫힘' },
      ],
    },
    probeMood: {
      kind: 'enum',
      label: 'PROBE 기분',
      readOnly: false,
      nullable: true,
      listed: false,
      values: [{ value: 'probe-calm', label: 'PROBE 평온' }],
    },
    probeStamp: {
      kind: 'datetime',
      label: 'PROBE 시각',
      readOnly: true,
      nullable: false,
      listed: true,
    },
  },
  relationships: {
    probeDesk: { cardinality: 'one', type: 'probeDesks', label: 'PROBE 책상' },
    probeFlags: { cardinality: 'many', type: 'probeFlags', label: 'PROBE 깃발' },
  },
  filters: {},
  sorts: ['probeSubject'],
  defaultSort: 'probeSubject',
  includes: [],
  writable: true,
})

const TO_ONE: RelationshipDefinition = {
  cardinality: 'one',
  type: 'probeDesks',
  label: 'PROBE 책상',
}
const TO_MANY: RelationshipDefinition = {
  cardinality: 'many',
  type: 'probeFlags',
  label: 'PROBE 깃발',
}

const LIST: ReferenceList = {
  options: [
    { id: 'probe-a', label: 'PROBE 가' },
    { id: 'probe-b', label: 'PROBE 나' },
    { id: 'probe-c', label: 'PROBE 다' },
  ],
  truncated: false,
}

describe('newFormValues - 생성 화면의 첫 값', () => {
  it('필수 enum 은 첫 값을 고른 채로, 나머지 속성은 빈 문자열로, 관계는 빈 선택으로 시작한다', () => {
    expect(newFormValues(PROBE_TICKET)).toEqual({
      attributes: { probeSubject: '', probePhase: 'probe-open', probeMood: '' },
      relationships: { probeDesk: [], probeFlags: [] },
    })
  })
})

describe('withAttribute', () => {
  it('그 속성만 바꾸고 원래 값은 건드리지 않는다', () => {
    const before = newFormValues(PROBE_TICKET)
    const after = withAttribute(before, 'probeSubject', 'probe-subject')
    expect(after.attributes).toEqual({
      probeSubject: 'probe-subject',
      probePhase: 'probe-open',
      probeMood: '',
    })
    expect(before.attributes.probeSubject).toBe('')
    expect(after.relationships).toBe(before.relationships)
  })
})

describe('withRelationshipChoice', () => {
  const start: ResourceFormValues = {
    attributes: {},
    relationships: { probeDesk: ['probe-a'], probeFlags: ['probe-b', 'probe-a'] },
  }

  it('to-one 은 고른 id 하나로 바꾸고, null 이면 비운다', () => {
    expect(
      withRelationshipChoice(start, 'probeDesk', TO_ONE, 'probe-c').relationships.probeDesk,
    ).toEqual(['probe-c'])
    expect(
      withRelationshipChoice(start, 'probeDesk', TO_ONE, null).relationships.probeDesk,
    ).toEqual([])
  })

  it('to-many 는 켜면 끝에 붙이고 끄면 빼며 나머지 순서를 지킨다 - 다시 정렬하지 않는다', () => {
    const on = withRelationshipChoice(start, 'probeFlags', TO_MANY, 'probe-c')
    expect(on.relationships.probeFlags).toEqual(['probe-b', 'probe-a', 'probe-c'])
    const off = withRelationshipChoice(on, 'probeFlags', TO_MANY, 'probe-a')
    expect(off.relationships.probeFlags).toEqual(['probe-b', 'probe-c'])
    expect(
      withRelationshipChoice(off, 'probeFlags', TO_MANY, null).relationships.probeFlags,
    ).toEqual([])
  })

  it('다른 관계와 원래 값은 건드리지 않는다', () => {
    const after = withRelationshipChoice(start, 'probeDesk', TO_ONE, 'probe-c')
    expect(after.relationships.probeFlags).toEqual(['probe-b', 'probe-a'])
    expect(start.relationships.probeDesk).toEqual(['probe-a'])
  })
})

describe('relationshipTargets', () => {
  it('선언의 관계마다 등록부의 대상 자원을 선언 순서대로 준다', () => {
    expect(relationshipTargets(EXAMPLE)).toEqual([
      ['category', EXAMPLE_CATEGORY],
      ['tags', EXAMPLE_TAG],
    ])
  })

  it('관계가 없으면 빈 배열이다', () => {
    expect(relationshipTargets(EXAMPLE_TAG)).toEqual([])
  })

  it('대상 type 이 등록부에 없으면 던진다 - 선언의 오류다', () => {
    expect(() => relationshipTargets(PROBE_TICKET)).toThrow(/probeDesks/)
  })
})

describe('relationshipChoice - 선택기가 그릴 것', () => {
  it('보기는 목록 순서 그대로이고 고른 것에 표시가 붙는다 - 선택은 고른 순서다', () => {
    const choice = relationshipChoice(TO_MANY, LIST, ['probe-c', 'probe-a'])
    expect(choice.options.map((option) => [option.id, option.selected])).toEqual([
      ['probe-a', true],
      ['probe-b', false],
      ['probe-c', true],
    ])
    expect(choice.chosen.map((option) => option.label)).toEqual(['PROBE 다', 'PROBE 가'])
    expect(choice.hasUnlisted).toBe(false)
  })

  it('목록에 없는 선택은 보기 끝에 id 를 라벨로 붙이고 알린다 - 잘렸거나 조회가 실패한 목록', () => {
    const choice = relationshipChoice(TO_MANY, LIST, ['probe-z', 'probe-b'])
    expect(choice.options.at(-1)).toEqual({
      id: 'probe-z',
      label: 'probe-z',
      selected: true,
      listed: false,
    })
    expect(choice.chosen).toEqual([
      { id: 'probe-z', label: 'probe-z', selected: true, listed: false },
      { id: 'probe-b', label: 'PROBE 나', selected: true, listed: true },
    ])
    expect(choice.hasUnlisted).toBe(true)
  })

  it('목록이 비어도(조회 실패) 선택은 그대로 보인다', () => {
    const choice = relationshipChoice(TO_ONE, { options: [], truncated: false }, ['probe-a'])
    expect(choice.chosen).toEqual([
      { id: 'probe-a', label: 'probe-a', selected: true, listed: false },
    ])
    expect(choice.options).toEqual(choice.chosen)
  })

  it('to-one 은 첫 id 하나만 뜻이 있다', () => {
    const choice = relationshipChoice(TO_ONE, LIST, ['probe-b', 'probe-c'])
    expect(choice.chosen.map((option) => option.id)).toEqual(['probe-b'])
    expect(choice.options.filter((option) => option.selected).map((option) => option.id)).toEqual([
      'probe-b',
    ])
  })

  it('같은 id 는 한 번만, 빈 문자열은 빼고 그린다', () => {
    const choice = relationshipChoice(TO_MANY, LIST, ['', 'probe-a', 'probe-a'])
    expect(choice.chosen.map((option) => option.id)).toEqual(['probe-a'])
    expect(choice.options).toHaveLength(3)
  })
})
```

```bash
pnpm exec vitest run test/unit/resources/form-expo.test.ts 2>&1 | tail -4
```

Expected: FAIL — `Tests  13 failed (13)`(`newFormValues is not a function` 등 — 복사한 `form.ts` 에는 이 함수들이 없다).

- [ ] **Step 4: `form.ts` 에 패치를 붙인다**

패치가 하는 일: `readFormValues` 와 도우미 셋(`stringValue`·`toOneIds`·`toManyIds`)을 빼고 `newFormValues`·`withAttribute`·`withRelationshipChoice` 를 더한다(스펙 6.2 — 입력이 화면이 들고 있는 폼 상태 객체다). 원본이 `app/(app)/examples/relationship-lists.ts`·`components/resource/relationship-picker.tsx` 에 두던 판단을 `relationshipTargets`·`relationshipChoice` 로 더한다. 참조 조회의 실패는 여기 두지 않는다 — 목록·상세처럼 `screen-state.ts` 가 정한다(Step 7). 머리말·`ResourceFormValues` 주석에 그 사실을 적고, 지운 이름을 가리키던 `rawAttributeValue` 주석 한 줄을 고친다.

아래 패치를 Write 도구로 `.maestro-output/d4-form.patch` 에 그대로 쓰고(`.maestro-output/` 은 무시되는 자리다) 붙인다. 원본 커밋의 파일에만 맞는 패치라 글자 하나라도 어긋나면 `git apply` 가 거절한다 — 그러면 Step 2 부터 다시 한다.

```diff
diff --git a/lib/resources/form.ts b/lib/resources/form.ts
index bd9cff2..9345484 100644
--- a/lib/resources/form.ts
+++ b/lib/resources/form.ts
@@ -27,6 +27,14 @@
  * `JsonApiResult<SingleDocument> | null` 로 바꾼다 - 수정 화면이 응답 문서를
  * 한 번만 읽어 표시(`detailView`)와 폼 초기값(`initialFormValues`)을 둘 다
  * 만든다. 원값과 관계 id 는 그 응답에만 있다.
+ *
+ * (template-typescript-expo) 입력이 `FormData` 가 아니라 화면이 들고 있는 폼 상태 객체
+ * (`ResourceFormValues`)다(스펙 6.2) - `readFormValues` 를 빼고 그 객체를 만들고 고치는 순수
+ * 함수(`newFormValues`·`withAttribute`·`withRelationshipChoice`)를 더했다. 관계 선택기가 그릴
+ * 것(`relationshipTargets`·`relationshipChoice`)도 여기 있다 - 원본에서는
+ * `app/(app)/examples/relationship-lists.ts` 와 `components/resource/relationship-picker.tsx` 가
+ * 하던 판단이고, 이 앱에는 컴포넌트 시험이 없어서(스펙 11.1) lib 에 둔다. 요청을 보내는 쓰기
+ * 흐름(원본의 Server Action 자리)은 `write.ts` 다.
  */
 
 import { UNUSABLE_RESPONSE_MESSAGE } from '@/lib/auth/form-state'
@@ -41,10 +49,13 @@ import type {
 import { actionForErrors, groupErrors, type FieldErrors } from '@/lib/jsonapi/errors'
 import {
   formAttributes,
+  isRequiredAttribute,
   type AttributeDefinition,
   type RelationshipDefinition,
   type ResourceDefinition,
 } from './define'
+import { resourceByType } from './index'
+import type { ReferenceList } from './view'
 
 /**
  * 폼 하나가 들고 있는 값.
@@ -57,7 +68,9 @@ import {
  *
  * `relationships` 가 id 배열인 이유: to-one 은 `<select>` 하나(0 또는 1개),
  * to-many 는 체크박스 목록(0개 이상)이라, 두 모양을 한 타입으로 표현하면
- * `readFormValues`·`writeDocument` 가 cardinality 하나로만 갈라 쓸 수 있다.
+ * `withRelationshipChoice`·`writeDocument` 가 cardinality 하나로만 갈라 쓸 수 있다.
+ * (template-typescript-expo) 이 앱에서 값을 만드는 것은 `FormData` 가 아니라 화면의 입력이다 -
+ * TextInput 의 값도 문자열이다.
  */
 export interface ResourceFormValues {
   /** 속성 이름 → 폼이 받은 문자열. **전부 문자열이다** - FormData 가 그렇다. */
@@ -97,63 +110,154 @@ export const IDLE_RESOURCE_FORM_STATE: ResourceFormState = {
 }
 
 /* ------------------------------------------------------------------------- *
- * FormData -> ResourceFormValues
+ * (template-typescript-expo) 폼 상태 객체 - 원본의 `FormData -> ResourceFormValues` 자리
  * ------------------------------------------------------------------------- */
 
 /**
- * 값이 문자열이 아니면(입력이 통째로 없거나, 공격자가 파일을 밀어 넣었거나)
- * 빈 문자열이다 - `lib/auth/credentials.ts` 의 `stringField` 와 같은 규율.
- * 여기서 던지지 않는 이유도 같다: 정본 검증자는 백엔드다(스펙 9.2).
+ * 생성 화면의 첫 값 - `initialFormValues(resource, null)` 에서 **필수 enum 만 첫 값을 고른 채로**
+ * 시작한다.
+ *
+ * 원본의 생성 화면은 enum 을 빈 보기 없는 소재 `<select>` 로 그렸고, 브라우저는 그런 `<select>` 의
+ * 첫 `<option>` 을 고른 채로 그려 그 값을 보냈다(`components/resource/resource-form.tsx` 의 "알려진
+ * 한계" 절). 이 앱의 선택 칸에는 그런 기본이 없어 같은 동작을 값으로 옮긴다 - 옮기지 않으면
+ * 사용자가 고르지 않은 필수 enum 이 빈 문자열로 나가 422 가 된다. 선택인 enum(`nullable`)은
+ * 빈 값(보내면 `null`)으로 둔다.
  */
-function stringValue(formData: FormData, name: string): string {
-  const value = formData.get(name)
-  return typeof value === 'string' ? value : ''
+export function newFormValues(resource: ResourceDefinition): ResourceFormValues {
+  const empty = initialFormValues(resource, null)
+  const attributes: Record<string, string> = { ...empty.attributes }
+  for (const [name, attribute] of formAttributes(resource)) {
+    if (attribute.kind === 'enum' && isRequiredAttribute(attribute)) {
+      attributes[name] = attribute.values[0]?.value ?? ''
+    }
+  }
+  return { attributes, relationships: empty.relationships }
 }
 
 /**
- * to-one 관계 하나가 고른 id. **빈 문자열이 "선택 안 함"이다** - `<select>`
- * 의 "선택 안 함" 보기가 그 값을 낸다(계획 §5 Task 4, `view.ts` 필터 바의
- * `ANY_OPTION`(`value: ''`)과 같은 관용구). 골랐으면 원소 하나짜리 배열,
- * 아니면 빈 배열 - `ResourceFormValues.relationships` 의 "to-one 은 0개나
- * 1개" 계약을 여기서 지킨다.
+ * 속성 하나의 입력을 바꾼 새 폼 값. 값을 검증하지 않는다 - 정본 검증자는 백엔드다(스펙 9.2).
+ * 빈 문자열의 뜻은 보낼 때 `writeDocument` 가 정한다.
  */
-function toOneIds(formData: FormData, name: string): readonly string[] {
-  const value = stringValue(formData, name)
-  return value === '' ? [] : [value]
+export function withAttribute(
+  values: ResourceFormValues,
+  name: string,
+  raw: string,
+): ResourceFormValues {
+  return { ...values, attributes: { ...values.attributes, [name]: raw } }
 }
 
 /**
- * to-many 관계가 고른 id 들 - 체크박스 목록의 `FormData.getAll`(계획 §5
- * Task 4). 문자열이 아닌 항목(파일)과 빈 문자열은 버린다 - 체크박스 값은
- * 항상 실제 id 여야 하고, 그렇지 않은 값은 조립할 문서에 실을 것이 없다.
+ * 관계 하나의 선택을 바꾼 새 폼 값 - `ResourceFormValues.relationships` 의 "to-one 은 0개나 1개"
+ * 계약을 여기서 지킨다. `null` 은 그 관계를 비운다.
+ *
+ * - to-one: `id` 를 고른다(앞의 선택을 바꾼다).
+ * - to-many: `id` 하나를 켜고 끈다 - 켜면 **끝에 붙이고** 끄면 빼며, 나머지의 순서는 그대로다.
+ *   폼은 선택을 다시 정렬하지 않는다(스펙 8.1 의 "순서 유지") - 보내는 순서는 사용자가 고른
+ *   순서, 수정 화면에서는 응답이 준 순서다. 화면에 보이는 순서는 백엔드가 정한다.
  */
-function toManyIds(formData: FormData, name: string): readonly string[] {
-  return formData
-    .getAll(name)
-    .filter((entry): entry is string => typeof entry === 'string' && entry !== '')
+export function withRelationshipChoice(
+  values: ResourceFormValues,
+  name: string,
+  relationship: RelationshipDefinition,
+  id: string | null,
+): ResourceFormValues {
+  const current = values.relationships[name] ?? []
+  let next: readonly string[]
+  if (id === null) next = []
+  else if (relationship.cardinality === 'one') next = [id]
+  else next = current.includes(id) ? current.filter((chosen) => chosen !== id) : [...current, id]
+  return { ...values, relationships: { ...values.relationships, [name]: next } }
 }
 
+/* ------------------------------------------------------------------------- *
+ * (template-typescript-expo) 관계 선택기 - 원본의 relationship-lists.ts · relationship-picker.tsx 가
+ * 하던 판단
+ * ------------------------------------------------------------------------- */
+
 /**
- * `FormData` 를 폼 값으로. **`formAttributes` 로 화이트리스트한 속성만
- * 읽는다** - 읽기 전용 속성은 애초에 폼에 입력이 없으므로 읽을 값이 없다.
- * 관계는 선언된 것 전부를 cardinality 로 갈라 읽는다.
+ * 관계마다 선택기가 목록을 가져올 대상 자원 - 원본 `relationshipLists` 의 앞 절반.
+ *
+ * `resource.relationships` 를 그대로 돈다 - 관계 이름 리터럴이 없어서 선언에 관계를 더하면 생성·
+ * 수정 화면이 함께 따라온다. 대상은 선언의 `relationship.type` 으로 등록부에서 찾는다. 여기
+ * 들어오는 type 은 응답이 아니라 우리 선언에서 온다 - 등록부에 없으면 데이터의 상태가 아니라
+ * 선언의 오류라 조용히 물러서지 않고 던진다(게이트에서는 `test/unit/resources/invariants.ts` 의
+ * `relationship-type` 규칙이 먼저 잡는다).
  */
-export function readFormValues(
+export function relationshipTargets(
   resource: ResourceDefinition,
-  formData: FormData,
-): ResourceFormValues {
-  const attributes: Record<string, string> = {}
-  for (const [name] of formAttributes(resource)) {
-    attributes[name] = stringValue(formData, name)
-  }
+): readonly (readonly [string, ResourceDefinition])[] {
+  return Object.entries(resource.relationships).map(([name, relationship]) => {
+    const target = resourceByType(relationship.type)
+    if (target === undefined) {
+      throw new Error(
+        `${resource.type}: 관계 '${name}' 의 대상 type '${relationship.type}' 이 등록부에 없다`,
+      )
+    }
+    return [name, target] as const
+  })
+}
 
-  const relationships: Record<string, readonly string[]> = {}
-  for (const [name, relationship] of Object.entries(resource.relationships)) {
-    relationships[name] =
-      relationship.cardinality === 'one' ? toOneIds(formData, name) : toManyIds(formData, name)
-  }
+/** 선택기의 보기 하나. `listed` 가 거짓이면 참조 목록에 없는 선택이다 - 라벨 자리에 id 가 온다. */
+export interface RelationshipOption {
+  readonly id: string
+  readonly label: string
+  readonly selected: boolean
+  readonly listed: boolean
+}
 
-  return { attributes, relationships }
+/** 관계 선택기가 그릴 것. */
+export interface RelationshipChoice {
+  /** 폼에 그릴 선택 - 선택 순서 그대로다(to-one 은 0개나 1개). */
+  readonly chosen: readonly RelationshipOption[]
+  /** 시트에 그릴 보기 - 목록 순서 그대로이고, 목록에 없는 선택이 끝에 붙는다. */
+  readonly options: readonly RelationshipOption[]
+  /** 목록에 없는 선택이 있다 - 선택기가 안내를 그린다. */
+  readonly hasUnlisted: boolean
+}
+
+/**
+ * 참조 목록과 고른 id 들 → 선택기가 그릴 것 - 원본 `RelationshipPicker` 의 판단.
+ *
+ * ## 목록 밖 선택을 반드시 그린다
+ *
+ * 목록(`list.options`)은 참조 조회의 응답에서, 선택(`selected`)은 수정 화면의 상세 응답에서 온다.
+ * 둘이 어긋나는 실재 경로가 둘이다 - 참조 조회가 실패해 목록이 비었거나, 참조 자원이
+ * `REFERENCE_PAGE_SIZE` 를 넘어 잘렸다(`view.ts` 의 `referenceList`). 그 선택을 그리지 않으면
+ * 사용자는 무엇이 골라져 있는지 모른 채 저장한다. 그래서 목록에 없는 선택을 보기 끝에 붙이고
+ * (`listed: false`) 화면이 그 사실을 알린다. 라벨은 지어낼 수 없다 - 이 화면은 그 이름을 가진
+ * 적이 없어 id 를 그대로 쓴다.
+ *
+ * (원본은 보기가 없으면 그 선택이 제출에서 빠져 관계가 지워졌다. 이 앱의 폼 값은 화면이 들고
+ * 있는 객체라 빠지지 않는다 - 그래도 보여야 사용자가 해제할 수 있다.)
+ *
+ * to-one 은 첫 id 하나만 뜻이 있다. 같은 id 가 두 번 오거나 빈 문자열이 섞여도 한 번만, 빈 것은
+ * 빼고 그린다.
+ */
+export function relationshipChoice(
+  relationship: RelationshipDefinition,
+  list: ReferenceList,
+  selected: readonly string[],
+): RelationshipChoice {
+  const unique = [...new Set(selected)].filter((id) => id !== '')
+  const effective = relationship.cardinality === 'one' ? unique.slice(0, 1) : unique
+  const chosenIds = new Set(effective)
+  const labels = new Map(list.options.map((option) => [option.id, option.label]))
+
+  const chosen = effective.map((id): RelationshipOption => {
+    const label = labels.get(id)
+    return label === undefined
+      ? { id, label: id, selected: true, listed: false }
+      : { id, label, selected: true, listed: true }
+  })
+  const unlisted = chosen.filter((option) => !option.listed)
+  const listed = list.options.map((option): RelationshipOption => ({
+    id: option.id,
+    label: option.label,
+    selected: chosenIds.has(option.id),
+    listed: true,
+  }))
+
+  return { chosen, options: [...listed, ...unlisted], hasUnlisted: unlisted.length > 0 }
 }
 
 /* ------------------------------------------------------------------------- *
@@ -421,7 +525,7 @@ function documentObject(result: JsonApiResult<SingleDocument> | null): ResourceO
  * 이미 라벨이 아니라 원래 값(`active`)을 주므로 그대로 문자열화하면 되고
  * (라벨을 붙이는 것은 화면이 **읽을 때만** 하는 일이라 `EnumValue` 조회가
  * 여기 필요 없다), `int` 는 `Number` 를 문자열로 되돌린다. 이 변환을
- * `readFormValues` 가 만드는 모양과 맞춰야 `<select>`·`<input>` 이 기존
+ * 폼 입력이 만드는 모양(전부 문자열)과 맞춰야 `<select>`·`<input>` 이 기존
  * 값을 그대로 고른 채로 그려진다(R7 이 이 함수가 필요해진 이유).
  *
  * `datetime` 은 이 함수를 지나가지 않는다 - `formAttributes` 가 이미
```

```bash
git apply --check .maestro-output/d4-form.patch && git apply .maestro-output/d4-form.patch
pnpm exec vitest run test/unit/resources/form-expo.test.ts 2>&1 | tail -4
pnpm exec vitest run test/unit/resources/form.test.ts 2>&1 | tail -4
```

Expected: 새 시험 `Tests  13 passed (13)`. 원본 시험은 FAIL — `Tests  8 failed | 33 passed (41)` — `readFormValues` describe 여덟이 없는 함수를 부른다. 다음 단계가 그 describe 를 지운다.

- [ ] **Step 5: 원본 시험에 패치를 붙인다**

`readFormValues` describe(8개)와 그 도우미 `probeForm`, import 의 `readFormValues` 를 지운다. 아래 패치를 `.maestro-output/d4-form-test.patch` 에 쓰고 붙인다.

```diff
diff --git a/test/unit/resources/form.test.ts b/test/unit/resources/form.test.ts
index 45640d7..3f6ba9b 100644
--- a/test/unit/resources/form.test.ts
+++ b/test/unit/resources/form.test.ts
@@ -28,7 +28,6 @@ import {
   decideWriteFailure,
   formStateFromErrors,
   initialFormValues,
-  readFormValues,
   unusableFormState,
   writeDocument,
   type ResourceFormValues,
@@ -153,14 +152,6 @@ const PROBE_DIAL = defineResource({
   writable: true,
 })
 
-function probeForm(entries: Record<string, string | readonly string[]>): FormData {
-  const form = new FormData()
-  for (const [name, value] of Object.entries(entries)) {
-    for (const item of typeof value === 'string' ? [value] : value) form.append(name, item)
-  }
-  return form
-}
-
 function attributeError(field: string, detail: string): ErrorObject {
   return {
     status: '422',
@@ -206,61 +197,6 @@ function okResult(data: ResourceObject | null): JsonApiResult<SingleDocument> {
 
 const EMPTY_VALUES: ResourceFormValues = { attributes: {}, relationships: {} }
 
-describe('readFormValues — FormData 를 폼 값으로', () => {
-  it('formAttributes 로 화이트리스트한 속성만 읽는다 - 읽기 전용은 폼 값에 없다', () => {
-    const values = readFormValues(
-      PROBE_RESOURCE,
-      probeForm({
-        probeName: 'probe-alpha',
-        probeNote: 'probe-note',
-        probeMade: '2020-01-01T00:00:00Z',
-      }),
-    )
-    expect(values.attributes).toEqual({ probeName: 'probe-alpha', probeNote: 'probe-note' })
-  })
-
-  it('입력이 통째로 없으면 빈 문자열이다 - 던지지 않는다', () => {
-    const values = readFormValues(PROBE_RESOURCE, probeForm({ probeName: 'probe-alpha' }))
-    expect(values.attributes.probeNote).toBe('')
-  })
-
-  it('문자열이 아닌 값(파일)이 실려 와도 던지지 않고 빈 문자열이다', () => {
-    const form = new FormData()
-    form.set('probeName', new Blob(['probe']), 'probe.txt')
-    form.set('probeNote', 'probe-note')
-    expect(readFormValues(PROBE_RESOURCE, form).attributes).toEqual({
-      probeName: '',
-      probeNote: 'probe-note',
-    })
-  })
-
-  it('to-one 관계는 고른 값이 있으면 원소 하나짜리 배열이다', () => {
-    const values = readFormValues(PROBE_RESOURCE, probeForm({ probeOwner: 'probe-owner-1' }))
-    expect(values.relationships.probeOwner).toEqual(['probe-owner-1'])
-  })
-
-  it('to-one 관계는 빈 문자열("선택 안 함")이면 빈 배열이다', () => {
-    const values = readFormValues(PROBE_RESOURCE, probeForm({ probeOwner: '' }))
-    expect(values.relationships.probeOwner).toEqual([])
-  })
-
-  it('to-one 관계는 입력 자체가 없어도 빈 배열이다', () => {
-    expect(readFormValues(PROBE_RESOURCE, new FormData()).relationships.probeOwner).toEqual([])
-  })
-
-  it('to-many 관계는 체크박스마다 하나씩 getAll 로 모은다', () => {
-    const values = readFormValues(
-      PROBE_RESOURCE,
-      probeForm({ probeMarks: ['probe-mark-1', 'probe-mark-2'] }),
-    )
-    expect(values.relationships.probeMarks).toEqual(['probe-mark-1', 'probe-mark-2'])
-  })
-
-  it('to-many 관계는 하나도 안 고르면 빈 배열이다', () => {
-    expect(readFormValues(PROBE_RESOURCE, new FormData()).relationships.probeMarks).toEqual([])
-  })
-})
-
 describe('writeDocument — 폼 값을 JSON:API 요청 문서로', () => {
   it('쓰기 문서는 읽기 전용 속성을 담지 않는다', () => {
     const values: ResourceFormValues = {
```

```bash
git apply --check .maestro-output/d4-form-test.patch && git apply .maestro-output/d4-form-test.patch
pnpm exec vitest run test/unit/resources/form.test.ts test/unit/resources/form-expo.test.ts 2>&1 | tail -4
```

Expected: `Tests  46 passed (46)`(원본 33 + 새 13).

- [ ] **Step 6: 쓰기 한 번의 흐름 — 시험을 먼저 쓰고 `write.ts` 를 만든다**

흐름의 갈래(스펙 7.3·8.4·9.2, 결정 2–6·14): 토큰이 없으면 요청하지 않고 세션 거절을 던진다(쓰기 가드). 토큰을 받다 저장소가 거절하면 요청하지 않고 앱 문구를 그리며 이름·문구만 로그로 남긴다. 인증 오류 코드는 세션 거절을 던진다(다시 보내지 않는다). 422 와 관계 오류는 포인터로 자리를 나눈 폼 상태, 닿지 못함은 앱 문구, 수정의 `RESOURCE_NOT_FOUND` 는 `notFound`, 생성의 그것은 배너, 삭제의 그것은 `deleted` 다. 전송·토큰은 가짜를 주입한다.

`test/unit/resources/write.test.ts` 를 만든다:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'

import { UNUSABLE_RESPONSE_MESSAGE } from '@/lib/auth/form-state'
import type { JsonApiResult, RequestOptions } from '@/lib/jsonapi/client'
import type { ErrorObject, SingleDocument } from '@/lib/jsonapi/document'
import type { JsonApiSend } from '@/lib/jsonapi/send'
import { defineResource } from '@/lib/resources/define'
import type { ResourceFormValues } from '@/lib/resources/form'
import {
  createResource,
  deleteResource,
  isSessionRejected,
  sessionRejected,
  updateResource,
  type WriteDeps,
} from '@/lib/resources/write'

/**
 * 쓰기 한 번의 흐름(lib/resources/write.ts) - 세션 확인 → 요청 → 응답 해석(스펙 7.3·8.4·9.2).
 *
 * 전송과 토큰은 가짜를 주입한다. 자원은 `probe*` 로 만든다(form.test.ts 와 같은 규칙) - 경로·id·
 * 토큰·문구가 전부 실전과 다르다. 폼 값은 실전처럼 전부 문자열이다.
 */
const PROBE_CRATE = defineResource({
  type: 'probeCrates',
  path: '/probe/api/crates',
  attributes: {
    probeLabel: {
      kind: 'string',
      label: 'PROBE 라벨',
      readOnly: false,
      nullable: false,
      listed: true,
    },
    probeCount: {
      kind: 'int',
      label: 'PROBE 개수',
      readOnly: false,
      nullable: false,
      listed: true,
    },
  },
  relationships: {
    probeShelf: { cardinality: 'one', type: 'probeShelves', label: 'PROBE 선반' },
  },
  filters: {},
  sorts: ['probeLabel'],
  defaultSort: 'probeLabel',
  includes: [],
  writable: true,
})

const VALUES: ResourceFormValues = {
  attributes: { probeLabel: 'probe-label', probeCount: '7' },
  relationships: { probeShelf: ['probe-shelf-1'] },
}

const TOKEN = 'probe-access-token'
const PROBE_ID = 'probe-crate-1'

/** 백엔드가 낸 오류 하나. */
function backendError(error: Partial<ErrorObject> & { code: string }): ErrorObject {
  return { status: '400', title: 'probe-title', detail: `probe-detail-${error.code}`, ...error }
}

/** client.ts 가 지어낸 오류의 모양(백엔드에 닿지 못함) - 코드는 실전 세 코드가 아니다. */
const SYNTHETIC: ErrorObject = {
  status: '0',
  code: 'PROBE_SYNTHETIC',
  title: 'PROBE_SYNTHETIC',
  detail: 'probe-synthetic-detail',
  meta: { synthetic: true },
}

function failed(status: number, errors: ErrorObject[]): JsonApiResult<SingleDocument> {
  return { ok: false, status, errors }
}

function created(id: string | null): JsonApiResult<SingleDocument> {
  return {
    ok: true,
    status: 201,
    document: { data: id === null ? null : { type: 'probeCrates', id } },
  }
}

/** 보낸 요청을 적고 정해 둔 결과를 차례로 돌려주는 가짜 의존성. */
function probeDeps(
  results: JsonApiResult<SingleDocument>[],
  token: () => Promise<string | null> = () => Promise.resolve(TOKEN),
) {
  const sent: { path: string; options: RequestOptions }[] = []
  let tokenCalls = 0
  const send: JsonApiSend = <T>(path: string, options: RequestOptions = {}) => {
    sent.push({ path, options })
    const next = results.shift()
    if (next === undefined) return Promise.reject(new Error(`준비하지 않은 요청: ${path}`))
    return Promise.resolve(next) as Promise<JsonApiResult<T>>
  }
  const deps: WriteDeps = {
    getAccessToken: () => {
      tokenCalls += 1
      return token()
    },
    send,
  }
  return { deps, sent, tokenCalls: () => tokenCalls }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('sessionRejected · isSessionRejected', () => {
  it('sessionRejected 가 만든 오류만 세션 거절이다', () => {
    expect(isSessionRejected(sessionRejected())).toBe(true)
    expect(isSessionRejected(new Error('probe'))).toBe(false)
    expect(isSessionRejected('SessionRejected')).toBe(false)
    expect(isSessionRejected(null)).toBe(false)
    expect(isSessionRejected({ name: 'SessionRejected' })).toBe(false)
  })
})

describe('createResource', () => {
  it('자원 경로에 POST 하고 writeDocument 의 본문과 토큰을 싣는다 - 쿼리도 data.id 도 없다', async () => {
    const { deps, sent } = probeDeps([created(PROBE_ID)])
    await expect(createResource(PROBE_CRATE, VALUES, deps)).resolves.toEqual({
      kind: 'saved',
      id: PROBE_ID,
    })
    expect(sent).toEqual([
      {
        path: '/probe/api/crates',
        options: {
          method: 'POST',
          accessToken: TOKEN,
          body: {
            data: {
              type: 'probeCrates',
              attributes: { probeLabel: 'probe-label', probeCount: 7 },
              relationships: {
                probeShelf: { data: { type: 'probeShelves', id: 'probe-shelf-1' } },
              },
            },
          },
        },
      },
    ])
  })

  it('세션이 없으면 요청하지 않고 세션 거절을 던진다 - 스펙 7.3 의 두 번째 겹', async () => {
    const { deps, sent } = probeDeps([], () => Promise.resolve(null))
    await expect(createResource(PROBE_CRATE, VALUES, deps)).rejects.toSatisfy(isSessionRejected)
    expect(sent).toEqual([])
  })

  it('토큰을 받다 저장소가 실패하면 요청하지 않고 앱 문구를 그린다 - 오류는 기기 로그에 남긴다', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { deps, sent } = probeDeps([], () => Promise.reject(new Error('probe-storage')))
    const outcome = await createResource(PROBE_CRATE, VALUES, deps)
    expect(outcome).toEqual({
      kind: 'failed',
      state: {
        documentErrors: [UNUSABLE_RESPONSE_MESSAGE],
        fieldErrors: {},
        relationshipErrors: {},
        submitted: VALUES,
      },
    })
    expect(sent).toEqual([])
    expect(logged).toHaveBeenCalledTimes(1)
  })

  it.each(['AUTHENTICATION_REQUIRED', 'INVALID_TOKEN', 'TOKEN_EXPIRED', 'TOKEN_REVOKED'])(
    '%s 이면 세션 거절을 던지고 다시 보내지 않는다 - 401 에 회전·재시도를 붙이지 않는다',
    async (code) => {
      const { deps, sent, tokenCalls } = probeDeps([
        failed(401, [backendError({ status: '401', code })]),
      ])
      await expect(createResource(PROBE_CRATE, VALUES, deps)).rejects.toSatisfy(isSessionRejected)
      expect(sent).toHaveLength(1)
      expect(tokenCalls()).toBe(1)
    },
  )

  it('검증 오류는 필드 오류가 든 폼 상태다 - 제출한 값을 그대로 싣는다', async () => {
    const { deps } = probeDeps([
      failed(422, [
        backendError({
          status: '422',
          code: 'VALIDATION_ERROR',
          source: { pointer: '/data/attributes/probeLabel' },
        }),
        backendError({
          status: '404',
          code: 'RELATIONSHIP_RESOURCE_NOT_FOUND',
          source: { pointer: '/data/relationships/probeShelf/data/id' },
        }),
      ]),
    ])
    expect(await createResource(PROBE_CRATE, VALUES, deps)).toEqual({
      kind: 'failed',
      state: {
        documentErrors: [],
        fieldErrors: { probeLabel: ['probe-detail-VALIDATION_ERROR'] },
        relationshipErrors: { probeShelf: ['probe-detail-RELATIONSHIP_RESOURCE_NOT_FOUND'] },
        submitted: VALUES,
      },
    })
  })

  it('포인터 없는 오류는 배너 문구다', async () => {
    const { deps } = probeDeps([
      failed(409, [backendError({ status: '409', code: 'PROBE_CONFLICT' })]),
    ])
    const outcome = await createResource(PROBE_CRATE, VALUES, deps)
    expect(outcome.kind === 'failed' && outcome.state.documentErrors).toEqual([
      'probe-detail-PROBE_CONFLICT',
    ])
  })

  it('만드는 쓰기의 RESOURCE_NOT_FOUND 는 not-found 가 아니라 배너 문구다 - 없어진 자원이 없다', async () => {
    const { deps } = probeDeps([
      failed(404, [backendError({ status: '404', code: 'RESOURCE_NOT_FOUND' })]),
    ])
    expect(await createResource(PROBE_CRATE, VALUES, deps)).toEqual({
      kind: 'failed',
      state: {
        documentErrors: ['probe-detail-RESOURCE_NOT_FOUND'],
        fieldErrors: {},
        relationshipErrors: {},
        submitted: VALUES,
      },
    })
  })

  it('백엔드에 닿지 못하면(합성 오류) 던지지 않고 앱 문구다 - 스펙 9.3', async () => {
    const { deps } = probeDeps([failed(0, [SYNTHETIC])])
    const outcome = await createResource(PROBE_CRATE, VALUES, deps)
    expect(outcome.kind === 'failed' && outcome.state.documentErrors).toEqual([
      UNUSABLE_RESPONSE_MESSAGE,
    ])
  })

  it('성공했는데 만든 자원의 id 가 없으면(data: null·204) 앱 문구로 물러선다', async () => {
    for (const result of [
      created(null),
      { ok: true, status: 204, document: null } as const,
    ] satisfies JsonApiResult<SingleDocument>[]) {
      const { deps } = probeDeps([result])
      const outcome = await createResource(PROBE_CRATE, VALUES, deps)
      expect(outcome.kind === 'failed' && outcome.state.documentErrors).toEqual([
        UNUSABLE_RESPONSE_MESSAGE,
      ])
    }
  })
})

describe('updateResource', () => {
  it('자원 하나의 경로에 PATCH 하고 본문의 data.id 가 URL 의 id 와 같다 - id 는 경로에서만 이스케이프한다', async () => {
    const id = 'probe/crate?1'
    const { deps, sent } = probeDeps([{ ok: true, status: 200, document: { data: null } }])
    expect(await updateResource(PROBE_CRATE, id, VALUES, deps)).toEqual({ kind: 'saved', id })
    expect(sent[0]?.path).toBe('/probe/api/crates/probe%2Fcrate%3F1')
    expect(sent[0]?.options.method).toBe('PATCH')
    expect(sent[0]?.options.accessToken).toBe(TOKEN)
    expect(sent[0]?.options.body).toMatchObject({ data: { type: 'probeCrates', id } })
  })

  it('속성과 관계를 매번 전부 보낸다 - 바뀐 것만 보내지 않는다', async () => {
    const { deps, sent } = probeDeps([{ ok: true, status: 200, document: { data: null } }])
    await updateResource(PROBE_CRATE, PROBE_ID, VALUES, deps)
    const body = sent[0]?.options.body as { data: Record<string, unknown> }
    expect(Object.keys(body.data.attributes as object)).toEqual(['probeLabel', 'probeCount'])
    expect(Object.keys(body.data.relationships as object)).toEqual(['probeShelf'])
  })

  it('수정할 자원이 없으면(RESOURCE_NOT_FOUND) notFound 다', async () => {
    const { deps } = probeDeps([
      failed(404, [backendError({ status: '404', code: 'RESOURCE_NOT_FOUND' })]),
    ])
    expect(await updateResource(PROBE_CRATE, PROBE_ID, VALUES, deps)).toEqual({ kind: 'notFound' })
  })

  it('세션이 없으면 요청하지 않고, 인증 오류면 세션 거절을 던진다', async () => {
    const none = probeDeps([], () => Promise.resolve(null))
    await expect(updateResource(PROBE_CRATE, PROBE_ID, VALUES, none.deps)).rejects.toSatisfy(
      isSessionRejected,
    )
    expect(none.sent).toEqual([])

    const revoked = probeDeps([
      failed(401, [backendError({ status: '401', code: 'TOKEN_REVOKED' })]),
    ])
    await expect(updateResource(PROBE_CRATE, PROBE_ID, VALUES, revoked.deps)).rejects.toSatisfy(
      isSessionRejected,
    )
  })

  it('백엔드에 닿지 못하면 앱 문구다', async () => {
    const { deps } = probeDeps([failed(0, [SYNTHETIC])])
    const outcome = await updateResource(PROBE_CRATE, PROBE_ID, VALUES, deps)
    expect(outcome.kind === 'failed' && outcome.state.documentErrors).toEqual([
      UNUSABLE_RESPONSE_MESSAGE,
    ])
  })
})

describe('deleteResource', () => {
  it('자원 하나의 경로에 본문 없이 DELETE 하고 204 면 deleted 다', async () => {
    const { deps, sent } = probeDeps([{ ok: true, status: 204, document: null }])
    expect(await deleteResource(PROBE_CRATE, 'probe/crate', deps)).toEqual({ kind: 'deleted' })
    expect(sent).toEqual([
      {
        path: '/probe/api/crates/probe%2Fcrate',
        options: { method: 'DELETE', accessToken: TOKEN },
      },
    ])
  })

  it('이미 없으면(RESOURCE_NOT_FOUND) 그것도 deleted 다 - 원하던 결과가 이미 이뤄져 있다', async () => {
    const { deps } = probeDeps([
      failed(404, [backendError({ status: '404', code: 'RESOURCE_NOT_FOUND' })]),
    ])
    expect(await deleteResource(PROBE_CRATE, PROBE_ID, deps)).toEqual({ kind: 'deleted' })
  })

  it('세션이 없으면 요청하지 않고, 인증 오류면 세션 거절을 던진다', async () => {
    const none = probeDeps([], () => Promise.resolve(null))
    await expect(deleteResource(PROBE_CRATE, PROBE_ID, none.deps)).rejects.toSatisfy(
      isSessionRejected,
    )
    expect(none.sent).toEqual([])

    const expired = probeDeps([
      failed(401, [backendError({ status: '401', code: 'TOKEN_EXPIRED' })]),
    ])
    await expect(deleteResource(PROBE_CRATE, PROBE_ID, expired.deps)).rejects.toSatisfy(
      isSessionRejected,
    )
  })

  it('그 밖의 실패는 백엔드 문구, 닿지 못함과 저장소 실패는 앱 문구다', async () => {
    const conflict = probeDeps([
      failed(409, [backendError({ status: '409', code: 'PROBE_CONFLICT' })]),
    ])
    expect(await deleteResource(PROBE_CRATE, PROBE_ID, conflict.deps)).toEqual({
      kind: 'failed',
      messages: ['probe-detail-PROBE_CONFLICT'],
    })

    const unreachable = probeDeps([failed(0, [SYNTHETIC])])
    expect(await deleteResource(PROBE_CRATE, PROBE_ID, unreachable.deps)).toEqual({
      kind: 'failed',
      messages: [UNUSABLE_RESPONSE_MESSAGE],
    })

    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const storage = probeDeps([], () => Promise.reject(new Error('probe-storage')))
    expect(await deleteResource(PROBE_CRATE, PROBE_ID, storage.deps)).toEqual({
      kind: 'failed',
      messages: [UNUSABLE_RESPONSE_MESSAGE],
    })
    expect(storage.sent).toEqual([])
  })
})
```

```bash
pnpm exec vitest run test/unit/resources/write.test.ts 2>&1 | tail -6
```

Expected: FAIL — `Error: Cannot find package '@/lib/resources/write'`(파일이 아직 없다).

`lib/resources/write.ts` 를 만든다:

```ts
import { UNUSABLE_RESPONSE_MESSAGE } from '@/lib/auth/form-state'
import type { ErrorObject, SingleDocument } from '@/lib/jsonapi/document'
import type { JsonApiSend } from '@/lib/jsonapi/send'
import { resourcePath, type ResourceDefinition } from './define'
import {
  IDLE_RESOURCE_FORM_STATE,
  createdId,
  decideWriteFailure,
  formStateFromErrors,
  unusableFormState,
  writeDocument,
  type ResourceFormState,
  type ResourceFormValues,
} from './form'

/**
 * 쓰기(생성·수정·삭제) 한 번의 흐름 - 세션 확인 → 요청 → 응답 해석(스펙 7.3·8.4·9.2).
 *
 * 무엇을 보낼지와 응답을 어떻게 읽을지는 `form.ts`(template-typescript-nextjs 에서 복사)가 정하고,
 * 이 파일은 그 판단을 한 번의 쓰기로 잇는다 - 원본에서 Server Action(`app/(app)/examples/actions.ts`)이
 * 하던 배선이다. 이 앱에서 그 자리는 쓰기 훅(`queries/writes.ts`)인데 훅은 React 없이 부를 수 없어서,
 * 흐름의 갈래를 여기 두고 가짜 전송·토큰으로 잰다(`test/unit/resources/write.test.ts`) - 인증 호출
 * (`lib/auth/credentials.ts`)과 같은 모양이다.
 *
 * - 요청은 주입받은 전송(`send`)으로만 보낸다. 앱에서는 `platform/api.ts` 의 `apiRequest` 다 -
 *   Accept-Language 를 싣는 유일한 자리다(스펙 9.4).
 * - access token 은 주입받은 `getAccessToken` 에서 쓰기마다 한 번 받는다. 앱에서는 세션 관리자의
 *   것이고, 회전은 그 안에서만 일어난다(스펙 7.2). 401 에 회전·재시도를 붙이지 않는다.
 * - 쓰기 가드(스펙 7.3 의 두 번째 겹): 토큰이 없으면(세션이 없다) 요청하지 않는다.
 * - 세션이 없거나 백엔드가 세션을 거절하면(인증 오류 코드) `sessionRejected()` 를 던진다. 인증 오류는
 *   Query 캐시의 `onError` 한 곳이 받아 세션을 지운다(스펙 9.2, `platform/query-client.ts`) - 쓰기
 *   화면은 보호 경로라 경로 가드가 `next` 를 실어 로그인으로 보낸다.
 * - 그 밖의 실패는 던지지 않고 값이다 - 폼이 그린다. 백엔드가 응답조차 주지 못하면 앱 문구
 *   (`UNUSABLE_RESPONSE_MESSAGE`)이고, 입력이 그대로 남은 폼의 제출 버튼이 곧 다시 시도다(스펙 9.3).
 */

const SESSION_REJECTED = 'SessionRejected'

/**
 * 쓰기가 세션 때문에 멈췄다는 신호. 던지는 쪽은 이 파일, 받는 쪽은 Query 캐시의 `onError` 다.
 * 클래스가 아니라 이름으로 표시한다 - 번들러가 `Error` 를 상속한 클래스를 어떻게 바꾸든
 * `isSessionRejected` 의 판정이 흔들리지 않는다.
 */
export function sessionRejected(): Error {
  const error = new Error('세션이 없거나 백엔드가 세션을 거절했다 - 로그인이 필요하다')
  error.name = SESSION_REJECTED
  return error
}

/** `sessionRejected()` 가 만든 오류인가. */
export function isSessionRejected(error: unknown): boolean {
  return error instanceof Error && error.name === SESSION_REJECTED
}

/** 쓰기가 주입받는 것 - 앱에서는 세션 관리자와 API 클라이언트다(`queries/writes.ts`). */
export interface WriteDeps {
  /**
   * 요청에 실을 access token. 세션이 없으면 `null` 이다. 회전한 세션을 저장소에 쓰지 못하면
   * 거절한다 - 새 세션은 메모리에 있으므로 다시 제출하면 새 토큰으로 간다(lib/auth/session-manager.ts).
   */
  readonly getAccessToken: () => Promise<string | null>
  readonly send: JsonApiSend
}

/** 생성 한 번의 결과. 세션 거절은 여기 없다 - 던진다. */
export type CreateOutcome =
  | { readonly kind: 'saved'; readonly id: string }
  | { readonly kind: 'failed'; readonly state: ResourceFormState }

/** 수정 한 번의 결과 - 생성에 더해, 고칠 자원이 없다(`RESOURCE_NOT_FOUND`). 화면이 not-found 를 그린다. */
export type UpdateOutcome = CreateOutcome | { readonly kind: 'notFound' }

/** 삭제 한 번의 결과. 세션 거절은 여기 없다 - 던진다. */
export type DeleteOutcome =
  | { readonly kind: 'deleted' }
  /** 배너에 그릴 문구 - 삭제에는 입력이 없어 필드 오류가 없다. */
  | { readonly kind: 'failed'; readonly messages: readonly string[] }

type AccessToken = { readonly ok: true; readonly token: string } | { readonly ok: false }

/**
 * 쓰기 하나가 실을 토큰. 세션이 없으면 던진다(쓰기 가드). 저장소가 실패해 거절되면 `ok: false` 다 -
 * 화면이 앱 문구를 그린다. 거절을 삼키지 않고 기기 로그에 남긴다(lib/auth/AGENTS.md 의 "호출자는
 * 삼키지 말고 알린다") - 오류의 이름과 문구만 적어 토큰이 로그에 실리지 않는다(스펙 7.1).
 */
async function accessToken(deps: WriteDeps): Promise<AccessToken> {
  let token: string | null
  try {
    token = await deps.getAccessToken()
  } catch (error) {
    const detail = error instanceof Error ? `${error.name}: ${error.message}` : typeof error
    console.error(`[write] access token 을 받지 못했다 - ${detail}`)
    return { ok: false }
  }
  if (token === null) throw sessionRejected()
  return { ok: true, token }
}

/**
 * 수정의 실패를 결과로. 갈래는 `decideWriteFailure`(form.ts)가 정한다 - 세션 거절은 던지고, 닿지
 * 못함(transport)은 원본처럼 오류 화면으로 던지지 않고 앱 문구를 담은 폼 상태다.
 */
function updateFailure(errors: readonly ErrorObject[], values: ResourceFormValues): UpdateOutcome {
  const failure = decideWriteFailure(errors, values)
  if (failure.kind === 'destroySession') throw sessionRejected()
  if (failure.kind === 'notFound') return { kind: 'notFound' }
  if (failure.kind === 'transport') return { kind: 'failed', state: unusableFormState(values) }
  return { kind: 'failed', state: failure.state }
}

/**
 * 생성 - `POST <자원 경로>`. 본문에 `data.id` 를 담지 않는다(담으면 403, 원본 실측). 쿼리를 붙이지
 * 않는다(쓰기 라우트는 쿼리를 받지 않는다 - 원본 W-5).
 *
 * 만드는 쓰기의 `RESOURCE_NOT_FOUND` 는 계약 밖이다 - 없어진 자원이 없으니 not-found 화면이 아니라
 * 배너로 그린다(`formStateFromErrors`). 성공했는데 만든 자원의 id 가 없으면(204·`data: null`) 계약
 * 위반이다 - `createdId` 가 지어내지 않으므로 앱 문구로 물러선다(원본 `createExampleAction` 과 같다).
 */
export async function createResource(
  resource: ResourceDefinition,
  values: ResourceFormValues,
  deps: WriteDeps,
): Promise<CreateOutcome> {
  const access = await accessToken(deps)
  if (!access.ok) return { kind: 'failed', state: unusableFormState(values) }

  const result = await deps.send<SingleDocument>(resource.path, {
    method: 'POST',
    body: writeDocument(resource, values),
    accessToken: access.token,
  })
  if (!result.ok) {
    const failure = updateFailure(result.errors, values)
    return failure.kind === 'notFound'
      ? { kind: 'failed', state: formStateFromErrors(result.errors, values) }
      : failure
  }

  const id = result.document === null ? undefined : createdId(result.document)
  return id === undefined
    ? { kind: 'failed', state: unusableFormState(values) }
    : { kind: 'saved', id }
}

/**
 * 수정 - `PATCH <자원 경로>/<id>`. PUT 이 아니다 - PUT 은 요청에 없는 필드까지 지운다(원본 실측
 * W-3). 속성과 관계를 매번 전부 보낸다 - 바뀐 것만 보내면 필드를 하나도 안 바꾼 제출에서 세 백엔드가
 * 갈린다(원본 `updateExampleAction` 의 두 절). URL 의 id 와 본문의 `data.id` 는 한 변수다(다르면 409).
 */
export async function updateResource(
  resource: ResourceDefinition,
  id: string,
  values: ResourceFormValues,
  deps: WriteDeps,
): Promise<UpdateOutcome> {
  const access = await accessToken(deps)
  if (!access.ok) return { kind: 'failed', state: unusableFormState(values) }

  const result = await deps.send<SingleDocument>(resourcePath(resource, id), {
    method: 'PATCH',
    body: writeDocument(resource, values, id),
    accessToken: access.token,
  })
  if (!result.ok) return updateFailure(result.errors, values)
  return { kind: 'saved', id }
}

/**
 * 삭제 - `DELETE <자원 경로>/<id>`, 본문이 없다.
 *
 * `404 RESOURCE_NOT_FOUND` 도 `deleted` 다 - DELETE 는 멱등이 아니라 이미 지워진 자원에 다시 보내면
 * 404 인데, 사용자가 원한 결과(그 자원이 없다)는 이미 이뤄져 있다. "내가 지웠다" 와 "누군가 먼저
 * 지웠다" 를 가를 재료가 응답에 없다(원본 `deleteExampleAction` 의 404 절). 그 밖의 실패는 배너
 * 문구다 - DELETE 에는 본문이 없어 필드·관계 오류 통은 늘 비어 있다.
 */
export async function deleteResource(
  resource: ResourceDefinition,
  id: string,
  deps: WriteDeps,
): Promise<DeleteOutcome> {
  const access = await accessToken(deps)
  if (!access.ok) return { kind: 'failed', messages: [UNUSABLE_RESPONSE_MESSAGE] }

  const result = await deps.send<SingleDocument>(resourcePath(resource, id), {
    method: 'DELETE',
    accessToken: access.token,
  })
  if (result.ok) return { kind: 'deleted' }

  const failure = decideWriteFailure(result.errors, IDLE_RESOURCE_FORM_STATE.submitted)
  if (failure.kind === 'destroySession') throw sessionRejected()
  if (failure.kind === 'notFound') return { kind: 'deleted' }
  if (failure.kind === 'transport') return { kind: 'failed', messages: [UNUSABLE_RESPONSE_MESSAGE] }
  return { kind: 'failed', messages: failure.state.documentErrors }
}
```

```bash
pnpm exec vitest run test/unit/resources/write.test.ts 2>&1 | tail -4
```

Expected: `Tests  22 passed (22)`.

- [ ] **Step 7: 조회 화면의 상태 — 판정하지 않은 응답의 재조회, 참조 목록, 다음 쪽의 한 규칙, `canLoadMore`**

D3 는 재조회가 닿지 못해도 읽은 데이터를 두게 고쳤다(I1). 백엔드 오류 문서는 아직 결과 값이라, 목록의 재조회가 5xx·429 를 받으면 읽은 쪽 전부가 오류 한 쪽으로 바뀌고 다음 재조회는 한 쪽만 읽는다 — D3 재검토가 넘겼고 D4 의 쓰기 뒤 무효화가 그 길을 늘린다. 판정하지 않은 응답(5xx·408·429)도 닿지 못함처럼 던지고 읽은 데이터를 둔다 — 첫 조회면 그 응답의 문구로 배너를 그린다. 판정한 4xx 는 값(새 답)이다(결정 40). 이 정책이 `lib/resources/screen-state.ts` 의 `throwIfUnreachable`·화면 상태와 조회의 `queryFn`(D3 의 `resource-options.ts` 가 그 함수를 부른다)에 있다. 참조 목록도 같은 규칙으로 그린다(`referenceState`, 결정 36). 선택기의 잘림(`referenceList` 의 `truncated`)은 무한 스크롤의 끝(`nextPageQuery`)과 한 판정이다 — 빈 쪽·`next: ''`·경로뿐인 링크는 "더 있다" 가 아니다(결정 37). 목록 끝의 가드는 순수 함수 `canLoadMore` 로 옮겨 잰다(결정 41). 시험을 먼저 쓴다.

`test/unit/resources/screen-state-unjudged.test.ts` 를 만든다:

```ts
import { describe, expect, it } from 'vitest'

import type { JsonApiResult } from '@/lib/jsonapi/client'
import type { CollectionDocument, ErrorObject, SingleDocument } from '@/lib/jsonapi/document'
import { defineResource } from '@/lib/resources/define'
import {
  UnreachableError,
  canLoadMore,
  detailScreen,
  listScreen,
  referenceState,
  throwIfUnreachable,
} from '@/lib/resources/screen-state'
import { listRequest } from '@/lib/resources/view'

/**
 * 판정하지 않은 응답(5xx·408·429)도 닿지 못함처럼 읽은 데이터를 두는가 - D3 재검토가 넘긴 것(목록의 재조회가
 * 백엔드 오류 문서를 받으면 읽은 쪽이 오류 한 쪽으로 바뀌고 다음 재조회는 한 쪽만 읽었다). 판정한 오류(그 밖의
 * 4xx)는 값이라 새 답이다. 실제 QueryClient 의 전이는 test/unit/queries/refetch-unjudged.test.ts 가 잰다.
 */
const PROBE_CRATE = defineResource({
  type: 'probeCrates',
  path: '/probe/api/crates',
  attributes: {
    probeName: {
      kind: 'string',
      label: 'PROBE 이름',
      readOnly: false,
      nullable: false,
      listed: true,
    },
  },
  relationships: {},
  filters: {},
  sorts: ['probeName'],
  defaultSort: 'probeName',
  includes: [],
  writable: false,
})
const PLAN = listRequest(PROBE_CRATE, {})

const BUSY: ErrorObject = { status: '503', code: 'PROBE_BUSY', detail: 'PROBE 잠시 뒤에' }

function failed<T>(errors: ErrorObject[], status: number): JsonApiResult<T> {
  return { ok: false, status, errors }
}

function okPage(ids: readonly string[]): JsonApiResult<CollectionDocument> {
  return {
    ok: true,
    status: 200,
    document: {
      data: ids.map((id) => ({
        type: 'probeCrates',
        id,
        attributes: { probeName: `PROBE ${id}` },
      })),
    },
  }
}

/** 조회의 `queryFn` 이 던졌을 오류 - `throwIfUnreachable` 이 만든 그대로다. */
function thrownBy<T>(result: JsonApiResult<T>, request: string): unknown {
  try {
    throwIfUnreachable(result, request)
  } catch (error) {
    return error
  }
  throw new Error('던지지 않았다')
}

/** 재조회·첫 조회가 받은 503 - 조회의 `queryFn` 이 던졌을 오류다. */
function busy(request: string): unknown {
  return thrownBy(failed<CollectionDocument>([BUSY], 503), request)
}

describe('throwIfUnreachable - 판정하지 않은 응답도 던진다', () => {
  it.each([500, 502, 503, 504, 408, 429])('%i 는 던진다 - 응답을 싣는다', (status) => {
    const result = failed<CollectionDocument>([{ ...BUSY, status: String(status) }], status)
    const error = thrownBy(result, '목록')
    expect(error).toBeInstanceOf(UnreachableError)
    expect((error as UnreachableError).response).toBe(result)
    expect((error as UnreachableError).message).toContain(String(status))
  })

  it.each([400, 403, 404, 409, 422])('%i 는 판정한 오류라 값 그대로다', (status) => {
    const result = failed<CollectionDocument>([{ ...BUSY, status: String(status) }], status)
    expect(throwIfUnreachable(result, '목록')).toBe(result)
  })
})

describe('listScreen - 판정하지 않은 응답', () => {
  it('첫 조회면 그 문구의 배너가 화면 전부다 - 작은 실패는 없다', () => {
    expect(
      listScreen(PROBE_CRATE, PLAN, {
        pages: undefined,
        error: busy('목록'),
        nextPageFailed: false,
      }),
    ).toEqual({ kind: 'banner', messages: ['PROBE 잠시 뒤에'], refreshFailed: false })
  })

  it('재조회면 읽은 행을 두고 목록 위에 작은 실패를 싣는다', () => {
    const screen = listScreen(PROBE_CRATE, PLAN, {
      pages: [okPage(['c1', 'c2']), okPage(['c3'])],
      error: busy('목록'),
      nextPageFailed: false,
    })
    if (screen.kind !== 'list') throw new Error('목록이어야 한다')
    expect(screen.rows.map((row) => row.id)).toEqual(['c1', 'c2', 'c3'])
    expect(screen.refreshFailed).toBe(true)
    expect(screen.failure).toBe(null)
  })

  it('다음 쪽이면 읽은 행을 두고 목록 끝에 싣는다 - 다시 시도는 그 쪽만이다', () => {
    const screen = listScreen(PROBE_CRATE, PLAN, {
      pages: [okPage(['c1'])],
      error: busy('목록'),
      nextPageFailed: true,
    })
    if (screen.kind !== 'list') throw new Error('목록이어야 한다')
    expect(screen.failure).toEqual({ kind: 'unreachable' })
    expect(screen.refreshFailed).toBe(false)
  })
})

describe('detailScreen - 판정하지 않은 응답과 판정한 응답', () => {
  const found: JsonApiResult<SingleDocument> = {
    ok: true,
    status: 200,
    document: { data: { type: 'probeCrates', id: 'c1', attributes: { probeName: 'PROBE c1' } } },
  }

  it('첫 조회면 그 문구의 배너다', () => {
    expect(detailScreen(PROBE_CRATE, { result: undefined, error: busy('상세') })).toEqual({
      kind: 'banner',
      messages: ['PROBE 잠시 뒤에'],
      refreshFailed: false,
    })
  })

  it('재조회면 읽은 상세를 두고 작은 실패를 싣는다', () => {
    const screen = detailScreen(PROBE_CRATE, { result: found, error: busy('상세') })
    if (screen.kind !== 'detail') throw new Error('상세여야 한다')
    expect(screen.heading).toBe('PROBE c1')
    expect(screen.refreshFailed).toBe(true)
  })

  it('판정한 답(404)은 재조회여도 새 답이다 - 지워진 자원은 not-found', () => {
    const missing = failed<SingleDocument>(
      [{ status: '404', code: 'RESOURCE_NOT_FOUND', detail: 'PROBE 없음' }],
      404,
    )
    expect(
      detailScreen(PROBE_CRATE, { result: throwIfUnreachable(missing, '상세'), error: null }),
    ).toEqual({ kind: 'notFound' })
  })
})

describe('referenceState - 판정하지 않은 응답', () => {
  it('첫 조회면 그 문구를 보기 대신 그린다', () => {
    expect(referenceState(PROBE_CRATE, { result: undefined, error: busy('목록') })).toEqual({
      list: { options: [], truncated: false },
      failure: { kind: 'banner', messages: ['PROBE 잠시 뒤에'] },
    })
  })

  it('읽은 목록이 있으면 그대로 둔다', () => {
    expect(referenceState(PROBE_CRATE, { result: okPage(['c1']), error: busy('목록') })).toEqual({
      list: { options: [{ id: 'c1', label: 'PROBE c1' }], truncated: false },
      failure: null,
    })
  })
})

describe('canLoadMore - 목록 끝에서 다음 쪽을 부르는가', () => {
  it.each<[string, boolean, boolean, boolean, boolean]>([
    ['다음 쪽이 있고 쉬고 있다', true, false, false, true],
    ['다음 쪽이 없다', false, false, false, false],
    ['읽는 중이다 - 진행 중인 재조회를 끊지 않는다', true, true, false, false],
    ['다음 쪽이 실패한 채다 - 되풀이하지 않고 "다시 시도" 를 기다린다', true, false, true, false],
  ])('%s', (_, hasNextPage, isFetching, isFetchNextPageError, expected) => {
    expect(canLoadMore({ hasNextPage, isFetching, isFetchNextPageError })).toBe(expected)
  })
})
```

실제 `QueryClient` 의 전이는 D3 의 `resource-options.test.ts` 와 같은 길로 잰다. `test/unit/queries/refetch-unjudged.test.ts` 를 만든다:

```ts
import { InfiniteQueryObserver, QueryClient, QueryObserver } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { JsonApiResult, RequestOptions } from '@/lib/jsonapi/client'
import type { CollectionDocument, ErrorObject, SingleDocument } from '@/lib/jsonapi/document'
import { defineResource } from '@/lib/resources/define'
import { detailScreen, listScreen } from '@/lib/resources/screen-state'
import { listRequest } from '@/lib/resources/view'
import { detailQueryOptions, listQueryOptions } from '@/queries/resource-options'

/**
 * 재조회가 판정하지 않은 응답(5xx)을 받는 전이 - 실제 QueryClient 로 잰다(test/unit/queries/resource-options.test.ts
 * 와 같은 길, 옵션도 앱의 것과 같다). D3 재검토가 넘긴 것: 목록의 재조회가 백엔드 오류 문서를 결과 값으로 받으면
 * 읽은 쪽 전부가 오류 한 쪽으로 바뀌고 다음 재조회는 한 쪽만 읽었다. 판정하지 않은 응답을 던지면 읽은 쪽이 남고,
 * 다음 재조회가 쪽 전부를 다시 읽는다.
 */
const resource = defineResource({
  type: 'probeCrates',
  path: '/probe/api/crates',
  attributes: {
    probeName: {
      kind: 'string',
      label: 'PROBE 이름',
      readOnly: false,
      nullable: false,
      listed: true,
    },
  },
  relationships: {},
  filters: {},
  sorts: ['probeName'],
  defaultSort: 'probeName',
  includes: [],
  writable: false,
})
const plan = listRequest(resource, {})

const BUSY: ErrorObject = { status: '503', code: 'PROBE_BUSY', detail: 'PROBE 잠시 뒤에' }

/** 세 쪽, 쪽마다 두 행. 커서는 `page[after]` 값이다 - 첫 쪽은 빈 커서. */
const PAGES: Record<string, { ids: string[]; next: string | null }> = {
  '': { ids: ['a1', 'a2'], next: 'probe-c2' },
  'probe-c2': { ids: ['b1', 'b2'], next: 'probe-c3' },
  'probe-c3': { ids: ['c1', 'c2'], next: null },
}

/** 가짜 백엔드 - `busy` 면 판정하지 않은 응답(503 오류 문서)을 돌려준다. */
function probeBackend() {
  const state = { busy: false, calls: 0 }
  const send = <T>(path: string, options?: RequestOptions): Promise<JsonApiResult<T>> => {
    state.calls += 1
    if (state.busy) return Promise.resolve({ ok: false, status: 503, errors: [BUSY] })
    if (path.endsWith('/c1')) {
      const document: SingleDocument = {
        data: { type: 'probeCrates', id: 'c1', attributes: { probeName: 'PROBE c1' } },
      }
      return Promise.resolve({ ok: true, status: 200, document: document as T })
    }
    const after = options?.query?.get('page[after]') ?? ''
    const page = PAGES[after]
    if (page === undefined) throw new Error(`PROBE 모르는 커서: ${after}`)
    const document: CollectionDocument = {
      data: page.ids.map((id) => ({ type: 'probeCrates', id, attributes: { probeName: id } })),
      links: {
        next: page.next === null ? null : `/probe/api/crates?page%5Bafter%5D=${page.next}`,
      },
    }
    return Promise.resolve({ ok: true, status: 200, document: document as T })
  }
  return { state, send }
}

let client: QueryClient

beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { queries: { staleTime: 0, retry: false, networkMode: 'offlineFirst' } },
  })
  client.mount()
})

afterEach(() => {
  client.unmount()
  client.clear()
})

/**
 * `trigger` 가 일으킨 조회의 결과(성공이든 실패든)가 캐시에 들 때까지 기다린다 - resource-options.test.ts 와 같다.
 * 구독이 여는 첫 조회는 기다릴 Promise 를 주지 않는다.
 */
async function nextResult(queryKey: readonly unknown[], trigger: () => void) {
  const state = () => client.getQueryCache().find({ queryKey })?.state
  const count = () => (state()?.dataUpdateCount ?? 0) + (state()?.errorUpdateCount ?? 0)
  const before = count()
  trigger()
  await vi.waitFor(() => {
    if (count() === before || state()?.fetchStatus !== 'idle') throw new Error('아직 부르는 중')
  })
}

async function listObserver(send: ReturnType<typeof probeBackend>['send']) {
  const options = listQueryOptions(resource, plan, send)
  const observer = new InfiniteQueryObserver(client, options)
  let unsubscribe = () => undefined as void
  await nextResult(options.queryKey, () => {
    unsubscribe = observer.subscribe(() => undefined)
  })
  const screen = () => {
    const result = observer.getCurrentResult()
    return listScreen(resource, plan, {
      pages: result.data?.pages,
      error: result.error,
      nextPageFailed: result.isFetchNextPageError,
    })
  }
  return { observer, unsubscribe: () => unsubscribe(), screen }
}

function rowIds(screen: ReturnType<typeof listScreen>) {
  if (screen.kind !== 'list') throw new Error(`목록이어야 한다 - ${screen.kind}`)
  return screen.rows.map((row) => row.id)
}

describe('목록 - 재조회가 판정하지 않은 응답을 받아도 읽은 쪽을 버리지 않는다', () => {
  it('세 쪽을 읽은 뒤 재조회가 503 → 행 여섯과 작은 실패, 다음 재조회 → 세 쪽을 다시 읽는다', async () => {
    const backend = probeBackend()
    const { observer, unsubscribe, screen } = await listObserver(backend.send)
    await observer.fetchNextPage()
    await observer.fetchNextPage()
    expect(rowIds(screen())).toEqual(['a1', 'a2', 'b1', 'b2', 'c1', 'c2'])
    expect(backend.state.calls).toBe(3)

    backend.state.busy = true
    await observer.refetch()
    expect(backend.state.calls).toBe(4)
    expect(rowIds(screen())).toEqual(['a1', 'a2', 'b1', 'b2', 'c1', 'c2'])
    expect(screen()).toMatchObject({ refreshFailed: true, failure: null })

    backend.state.busy = false
    await observer.refetch()
    expect(backend.state.calls).toBe(7)
    expect(rowIds(screen())).toEqual(['a1', 'a2', 'b1', 'b2', 'c1', 'c2'])
    expect(screen()).toMatchObject({ refreshFailed: false, failure: null })
    unsubscribe()
  })

  it('첫 조회가 503 이면 그 문구의 배너가 화면 전부다 - 다시 부르면 목록이다', async () => {
    const backend = probeBackend()
    backend.state.busy = true
    const { observer, unsubscribe, screen } = await listObserver(backend.send)
    expect(screen()).toEqual({
      kind: 'banner',
      messages: ['PROBE 잠시 뒤에'],
      refreshFailed: false,
    })
    backend.state.busy = false
    await observer.refetch()
    expect(rowIds(screen())).toEqual(['a1', 'a2'])
    unsubscribe()
  })
})

describe('상세 - 재조회가 판정하지 않은 응답을 받아도 읽은 상세를 둔다', () => {
  it('읽은 상세 → 재조회 503: 상세와 작은 실패 → 다시 부르면 작은 실패가 사라진다', async () => {
    const backend = probeBackend()
    const options = detailQueryOptions(resource, 'c1', backend.send)
    const observer = new QueryObserver(client, options)
    let unsubscribe = () => undefined as void
    await nextResult(options.queryKey, () => {
      unsubscribe = observer.subscribe(() => undefined)
    })
    const screen = () => {
      const result = observer.getCurrentResult()
      return detailScreen(resource, { result: result.data, error: result.error })
    }
    expect(screen()).toMatchObject({ kind: 'detail', heading: 'PROBE c1', refreshFailed: false })
    backend.state.busy = true
    await observer.refetch()
    expect(screen()).toMatchObject({ kind: 'detail', heading: 'PROBE c1', refreshFailed: true })
    backend.state.busy = false
    await observer.refetch()
    expect(screen()).toMatchObject({ kind: 'detail', refreshFailed: false })
    unsubscribe()
  })
})
```

`test/unit/resources/reference-state.test.ts` 를 만든다:

```ts
import { describe, expect, it } from 'vitest'

import type { JsonApiResult } from '@/lib/jsonapi/client'
import type { CollectionDocument } from '@/lib/jsonapi/document'
import { defineResource } from '@/lib/resources/define'
import { referenceState, UnreachableError } from '@/lib/resources/screen-state'

/**
 * 관계 선택기가 그릴 참조 목록(`referenceState`) - 목록·상세(`listScreen`·`detailScreen`)와 같은 규칙이다. 닿지
 * 못함은 조회의 `queryFn` 이 던지고(오류), 백엔드 오류 문서는 값이다. 재조회가 실패해도 읽은 목록이 남는 전이는
 * test/unit/queries/reference-options.test.ts 가 실제 QueryClient 로 잰다.
 */
const PROBE_LABEL = defineResource({
  type: 'probeLabels',
  path: '/probe/api/labels',
  attributes: {
    probeName: {
      kind: 'string',
      label: 'PROBE 이름',
      readOnly: false,
      nullable: false,
      listed: true,
    },
  },
  relationships: {},
  filters: {},
  sorts: ['probeName'],
  defaultSort: 'probeName',
  includes: [],
  writable: false,
})

const EMPTY = { options: [], truncated: false }

const LOADED: JsonApiResult<CollectionDocument> = {
  ok: true,
  status: 200,
  document: {
    data: [{ type: 'probeLabels', id: 'probe-l1', attributes: { probeName: 'PROBE 라벨 하나' } }],
    links: { next: null },
  },
}

describe('referenceState - 관계 선택기의 참조 목록', () => {
  it('받기 전이면 목록도 실패도 없다 - 선택기는 스켈레톤이다', () => {
    expect(referenceState(PROBE_LABEL, { result: undefined, error: null })).toEqual({
      list: null,
      failure: null,
    })
  })

  it('받은 목록을 보기로 준다', () => {
    expect(referenceState(PROBE_LABEL, { result: LOADED, error: null })).toEqual({
      list: { options: [{ id: 'probe-l1', label: 'PROBE 라벨 하나' }], truncated: false },
      failure: null,
    })
  })

  it('첫 조회가 닿지 못했으면 앱 문구와 다시 시도다 - 목록은 비어 고른 것이 목록 밖 선택이 된다', () => {
    expect(
      referenceState(PROBE_LABEL, { result: undefined, error: new UnreachableError('참조 목록') }),
    ).toEqual({ list: EMPTY, failure: { kind: 'unreachable' } })
  })

  it('읽은 목록이 있으면 재조회가 닿지 못해도 그 목록을 두고 실패를 싣지 않는다', () => {
    expect(
      referenceState(PROBE_LABEL, { result: LOADED, error: new UnreachableError('참조 목록') }),
    ).toEqual({
      list: { options: [{ id: 'probe-l1', label: 'PROBE 라벨 하나' }], truncated: false },
      failure: null,
    })
  })

  it('백엔드가 거절하면 그 문구다', () => {
    expect(
      referenceState(PROBE_LABEL, {
        result: {
          ok: false,
          status: 400,
          errors: [{ status: '400', code: 'PROBE_BAD_SORT', detail: 'probe-bad-sort' }],
        },
        error: null,
      }),
    ).toEqual({ list: EMPTY, failure: { kind: 'banner', messages: ['probe-bad-sort'] } })
  })

  it('문구가 하나도 없는 거절은 앱 문구로 물러선다 - 폼을 오류 경계로 보내지 않는다', () => {
    expect(
      referenceState(PROBE_LABEL, {
        result: { ok: false, status: 500, errors: [{}] },
        error: null,
      }),
    ).toEqual({ list: EMPTY, failure: { kind: 'unreachable' } })
  })

  it('닿지 못함이 아닌 오류는 결함이라 다시 던진다 - "연결할 수 없다" 로 위장하지 않는다', () => {
    expect(() =>
      referenceState(PROBE_LABEL, { result: LOADED, error: new TypeError('probe-defect') }),
    ).toThrow('probe-defect')
  })
})
```

`test/unit/resources/next-link.test.ts` 를 만든다:

```ts
import { describe, expect, it } from 'vitest'

import type { CollectionDocument } from '@/lib/jsonapi/document'
import { defineResource } from '@/lib/resources/define'
import { nextPageQuery, referenceList } from '@/lib/resources/view'

/**
 * 무한 스크롤의 다음 쪽(`nextPageQuery`)과 관계 선택기의 잘림(`referenceList` 의 `truncated`)은 한 규칙이다 -
 * `links.next` 를 따라갈 쿼리가 있을 때만 "더 있다". D3 최종 검토 53e: 빈 링크 `''` 를 무한 스크롤은 끝으로,
 * 선택기는 잘림으로 읽었다. 같은 응답을 두 함수에 넣어 같은 답인지 잰다.
 */
const PROBE_LABEL = defineResource({
  type: 'probeLabels',
  path: '/probe/api/labels',
  attributes: {
    probeName: {
      kind: 'string',
      label: 'PROBE 이름',
      readOnly: false,
      nullable: false,
      listed: true,
    },
  },
  relationships: {},
  filters: {},
  sorts: ['probeName'],
  defaultSort: 'probeName',
  includes: [],
  writable: false,
})

const ROW = { type: 'probeLabels', id: 'probe-l1', attributes: { probeName: 'PROBE 라벨 하나' } }
const NEXT = '/probe/api/labels?page%5Bnumber%5D=2&page%5Bsize%5D=100'

describe('다음 쪽과 잘림 - 한 규칙', () => {
  it.each<[string, CollectionDocument, boolean]>([
    ['링크가 null 이다(정본·Rails)', { data: [ROW], links: { next: null } }, false],
    ['링크 키가 없다(NestJS)', { data: [ROW], links: {} }, false],
    ["빈 링크 '' 다", { data: [ROW], links: { next: '' } }, false],
    ['경로뿐인 링크다', { data: [ROW], links: { next: '/probe/api/labels' } }, false],
    ['빈 쪽이다 - 링크가 있어도', { data: [], links: { next: NEXT } }, false],
    ['쿼리가 있는 링크다', { data: [ROW], links: { next: NEXT } }, true],
  ])('%s → 더 있다: %s', (_, document, more) => {
    expect(nextPageQuery({ ok: true, status: 200, document }) !== null).toBe(more)
    expect(referenceList(PROBE_LABEL, document).truncated).toBe(more)
  })
})
```

```bash
pnpm exec vitest run test/unit/resources/screen-state-unjudged.test.ts test/unit/queries/refetch-unjudged.test.ts test/unit/resources/reference-state.test.ts test/unit/resources/next-link.test.ts 2>&1 | tail -5
```

Expected: FAIL — `Tests  29 failed | 10 passed (39)`(네 파일 - 판정하지 않은 응답을 던지지 않는다, `referenceState`·`canLoadMore` 가 없다, `''`·경로뿐·빈 쪽을 `referenceList` 가 잘림으로 읽는다. 4xx 를 값으로 두는 것·지워진 상세의 not-found·첫 조회의 503 배너(값이어도 배너다)·무한 스크롤의 끝은 지금도 맞다).

`lib/resources/screen-state.ts` 는 D3 의 새 파일이고 이 단계가 전체를 바꾼다 — D3 의 판 그대로인지 먼저 본다(결정 31):

```bash
git rev-parse HEAD:lib/resources/screen-state.ts
```

Expected: `774cc9b897e29b7dd1d0f377fac1605b7d121de8`(D3 의 끝 `11fc4d7`·`main` 의 `d2dc3cb` 과 같다). 다르면 `git log -p -- lib/resources/screen-state.ts` 에서 그 뒤의 변경을 찾아 아래 판에 옮겨 적은 뒤 바꾼다.

`lib/resources/screen-state.ts` 전체를 바꾼다:

```ts
import type { JsonApiResult } from '@/lib/jsonapi/client'
import type { CollectionDocument, SingleDocument } from '@/lib/jsonapi/document'
import { actionForErrors } from '@/lib/jsonapi/errors'
import type { ResourceDefinition } from '@/lib/resources/define'
import {
  bannerMessages,
  detailView,
  listView,
  referenceList,
  type DetailView,
  type ListFailure,
  type ListRequest,
  type ListView,
  type ReferenceList,
} from '@/lib/resources/view'

/**
 * 조회 화면이 그릴 것 - TanStack Query 가 준 데이터·오류에서 정한다(스펙 9.3·8.5).
 *
 * 조회의 `queryFn` 은 백엔드의 판정을 받지 못한 조회를 던진다(`throwIfUnreachable`) - 응답조차 없었거나
 * (transport), 백엔드가 답했지만 판정하지 않은 응답(5xx·408·429)이다. TanStack Query 는 재조회가 실패해도 앞의
 * 데이터를 그대로 두므로 - 무한 조회는 읽은 쪽 전부를 - 앱 복귀·네트워크 복귀·당겨서 새로고침·다시 들어온
 * 상세·쓰기 뒤 무효화의 재조회가 그렇게 끝나도 읽은 행과 상세가 남고, 다음 재조회도 읽어 둔 쪽을 모두 다시
 * 읽는다. 실패를 결과 값으로 캐시에 두면 재조회의 실패가 읽은 데이터를 갈아엎고(쪽 배열이 `[실패]` 하나가
 * 된다) 다음 재조회는 그 한 쪽만 읽는다 - D3 최종 검토가 설치본 query-core 로 재 보인 결함이다(6행 → 전체
 * 화면 실패 → 2행). 판정하지 않은 응답(5xx·408·429)은 D4 가 더했다 - D3 재검토가 같은 결함을 백엔드 오류
 * 문서에서 봤고, D4 의 쓰기 뒤 무효화가 그 길을 늘린다. 그 셋을 판정하지 않은 응답으로 보는 것은 회전과
 * 같다(lib/auth/rotation.ts 의 `interpretRotationOutcome`).
 *
 * 판정한 백엔드 오류 문서(그 밖의 4xx - 없는 자원, 잘못된 조건)는 결과 값이다 - 재조회의 답이어도 새 답이라
 * 읽은 데이터를 바꾼다(지워진 상세는 not-found). 협상된 문구를 배너로 그린다(`listView`·`detailView`).
 *
 * 화면 상태: 데이터가 없으면 스켈레톤(`loading`)이거나, 첫 조회가 판정을 받지 못했으면 실패가 화면 전부다 -
 * 응답이 없었으면 앱 문구와 "다시 시도"(`unreachable`), 판정하지 않은 응답이면 그 문구의 배너다. 데이터가
 * 있으면 그것을 그리고, 판정을 받지 못한 재조회는 `refreshFailed`(작은 실패와 "다시 시도" - 읽은 것을 다시
 * 읽는다)로, 판정을 받지 못한 다음 쪽은 목록 끝의 `failure`(그 쪽만 다시 읽는다)로 싣는다.
 */

/** 판정하지 않은 응답 - 백엔드가 준 오류 문서다. */
type UnjudgedResponse = Extract<JsonApiResult<never>, { ok: false }>

/**
 * 백엔드의 판정을 받지 못한 조회 - 조회의 `queryFn` 이 던진다(`throwIfUnreachable`). 응답조차 없었으면
 * `response` 가 없고, 백엔드가 판정하지 않은 응답(5xx·408·429)을 줬으면 그 응답이다 - 첫 조회면 화면이 그
 * 문구를 배너로 그린다.
 */
export class UnreachableError extends Error {
  readonly response: UnjudgedResponse | undefined

  constructor(request: string, response?: UnjudgedResponse) {
    super(
      response === undefined
        ? `${request} 요청이 백엔드에 닿지 못했다`
        : `${request} 요청에 백엔드가 판정하지 않은 응답(${response.status})을 줬다`,
    )
    this.name = 'UnreachableError'
    this.response = response
  }
}

/**
 * 백엔드가 답했지만 판정하지 않은 상태 - 서버 쪽 실패(5xx), 요청 시간 초과(408), 너무 많은 요청(429). 회전
 * 응답을 가르는 셋(lib/auth/rotation.ts 의 `interpretRotationOutcome`)과 같다.
 */
function unjudged(status: number): boolean {
  return status >= 500 || status === 408 || status === 429
}

/**
 * 조회 결과를 캐시에 넣을 값으로 - 백엔드의 판정을 받지 못했으면 던진다: 응답조차 없었거나(`actionForErrors` 의
 * `transport`), 판정하지 않은 응답(5xx·408·429)이다. 성공과 판정한 백엔드 오류 문서는 그대로 돌려준다.
 * `request` 는 진단 문구에 쓴다(`'목록'`·`'상세'`·`'참조 목록'`).
 */
export function throwIfUnreachable<T>(result: JsonApiResult<T>, request: string): JsonApiResult<T> {
  if (result.ok) return result
  if (actionForErrors(result.errors) === 'transport') throw new UnreachableError(request)
  if (unjudged(result.status)) throw new UnreachableError(request, result)
  return result
}

/**
 * 마지막 조회가 판정을 받지 못한 오류(`UnreachableError`)면 그것을, 오류가 없으면 `null` 을 준다. 그 밖의
 * 오류는 결함이라(쿼리 함수나 요청 조립이 던졌다) 삼키지 않고 다시 던진다 - 렌더 중에 던져 오류 경계로 간다.
 * "연결할 수 없다" 로 그리면 결함이 네트워크 문제로 위장한다.
 */
function unreachableOf(error: unknown): UnreachableError | null {
  if (error === null || error === undefined) return null
  if (error instanceof UnreachableError) return error
  if (error instanceof Error) throw error
  const shown = typeof error === 'string' ? error : typeof error
  throw new Error(`조회가 Error 가 아닌 값으로 실패했다: ${shown}`)
}

/** 목록 화면이 그릴 것. `list` 의 `failure` 는 목록 끝(뒤따르는 쪽), `refreshFailed` 는 목록 위(재조회)의 실패다. */
export type ListScreen =
  | { kind: 'loading' }
  | { kind: 'unreachable' }
  | { kind: 'banner'; messages: readonly string[]; refreshFailed: boolean }
  | (Extract<ListView, { kind: 'list' }> & { refreshFailed: boolean })

/** 무한 조회가 준 것 - 읽은 쪽들(없으면 `undefined`), 마지막 조회의 오류, 그 오류가 다음 쪽의 것인가. */
export interface ListQueryFacts {
  readonly pages: readonly JsonApiResult<CollectionDocument>[] | undefined
  readonly error: unknown
  readonly nextPageFailed: boolean
}

export function listScreen(
  resource: ResourceDefinition,
  plan: ListRequest,
  facts: ListQueryFacts,
): ListScreen {
  const unreachable = unreachableOf(facts.error)
  const failed = unreachable !== null
  if (facts.pages === undefined) {
    if (unreachable?.response === undefined) {
      return failed ? { kind: 'unreachable' } : { kind: 'loading' }
    }
    // 첫 조회가 판정하지 않은 응답을 받았다 - 읽은 행이 없으니 그 문구가 화면 전부다.
    const first = listView(resource, plan, [unreachable.response])
    return first.kind === 'banner' ? { ...first, refreshFailed: false } : { kind: 'unreachable' }
  }

  const view = listView(resource, plan, facts.pages)
  // 판정을 받지 못한 조회는 캐시에 들지 않는다(`throwIfUnreachable`) - 들어 있으면 그것이 화면 전부다.
  if (view.kind === 'unreachable') return view
  if (view.kind === 'banner') return { ...view, refreshFailed: failed }
  if (failed && facts.nextPageFailed) {
    return { ...view, failure: { kind: 'unreachable' }, refreshFailed: false }
  }
  return { ...view, refreshFailed: failed }
}

/** 무한 조회의 상태 가운데 다음 쪽을 부를지 가르는 셋 - TanStack Query 의 무한 조회 결과가 그대로 들어온다. */
export interface LoadMoreFacts {
  readonly hasNextPage: boolean
  readonly isFetching: boolean
  readonly isFetchNextPageError: boolean
}

/**
 * 목록 끝에 닿았을 때 다음 쪽을 부르는가 - 다음 쪽이 있고, 읽는 중이 아니고, 다음 쪽이 판정을 받지 못한 채가
 * 아닐 때만. 읽는 중에 부르면 TanStack Query 가 진행 중인 재조회를 끊고 다음 쪽을 부른다(TanStack Query v5 무한
 * 조회 안내의 규칙). 다음 쪽이 실패한 채로 부르면 끝의 모양이 바뀔 때마다 FlatList 가 끝에 닿았다고 다시 알려
 * 실패할 요청이 되풀이된다 - 그 쪽은 사용자가 "다시 시도" 로 읽는다.
 */
export function canLoadMore(facts: LoadMoreFacts): boolean {
  return facts.hasNextPage && !facts.isFetching && !facts.isFetchNextPageError
}

/** 상세 화면이 그릴 것. `refreshFailed` 는 읽은 상세(또는 배너) 위의 작은 실패다. */
export type DetailScreen =
  | { kind: 'loading' }
  | { kind: 'unreachable' }
  | { kind: 'notFound' }
  | (Exclude<DetailView, { kind: 'notFound' } | ListFailure> & { refreshFailed: boolean })
  | { kind: 'banner'; messages: readonly string[]; refreshFailed: boolean }

/** 조회가 준 것 - 응답(없으면 `undefined`)과 마지막 조회의 오류. */
export interface DetailQueryFacts {
  readonly result: JsonApiResult<SingleDocument> | undefined
  readonly error: unknown
}

export function detailScreen(resource: ResourceDefinition, facts: DetailQueryFacts): DetailScreen {
  const unreachable = unreachableOf(facts.error)
  const failed = unreachable !== null
  if (facts.result === undefined) {
    if (unreachable?.response === undefined) {
      return failed ? { kind: 'unreachable' } : { kind: 'loading' }
    }
    // 첫 조회가 판정하지 않은 응답을 받았다 - 읽은 상세가 없으니 그 문구가 화면 전부다.
    const first = detailView(resource, unreachable.response)
    return first.kind === 'banner' ? { ...first, refreshFailed: false } : { kind: 'unreachable' }
  }

  const view = detailView(resource, facts.result)
  // 없는 자원은 재조회가 판정을 받지 못해도 없는 자원이다 - 작은 실패를 싣지 않는다.
  if (view.kind === 'notFound' || view.kind === 'unreachable') return view
  return { ...view, refreshFailed: failed }
}

/**
 * 관계 선택기가 그릴 참조 목록 하나 - 목록·상세와 같은 규칙이다(스펙 9.3). 받기 전이면 `list` 가 `null`(스켈레톤)
 * 이다. 첫 조회가 판정을 받지 못했거나 백엔드가 거절했으면 보기 대신 실패를 그린다 - 응답이 없었으면 앱 문구와
 * "다시 시도"(`unreachable`), 응답이 있으면 그 문구(`banner`)다. 문구가 하나도 없는 거절도 앱 문구로 물러선다(폼
 * 안의 선택기 하나 때문에 화면을 오류 경계로 보내지 않는다). 실패한 동안 `list` 는 빈 목록이다 - 폼은 고른 것을
 * 목록 밖 선택으로 그린다(`relationshipChoice`).
 *
 * 읽은 목록이 있으면 재조회가 판정을 받지 못해도 그 목록을 그대로 두고 실패를 싣지 않는다 - 선택기는 고를 것을
 * 보여 줄 뿐이고, 그사이 없어진 보기를 고르면 저장이 관계 오류로 그 선택기 아래에 알린다(스펙 9.1).
 */
export interface ReferenceState {
  /** 선택기가 그릴 보기 - 받기 전이면 `null`, 실패했으면 빈 목록이다. */
  readonly list: ReferenceList | null
  /** 보기 대신 그릴 실패. */
  readonly failure: ListFailure | null
}

/** 조회가 준 것 - 참조 목록 응답(없으면 `undefined`)과 마지막 조회의 오류. */
export interface ReferenceQueryFacts {
  readonly result: JsonApiResult<CollectionDocument> | undefined
  readonly error: unknown
}

export function referenceState(
  target: ResourceDefinition,
  facts: ReferenceQueryFacts,
): ReferenceState {
  const unreachable = unreachableOf(facts.error)
  // 받은 목록이 없으면 첫 조회가 받은 판정하지 않은 응답을 그린다.
  const result = facts.result ?? unreachable?.response
  if (result === undefined) {
    return unreachable === null
      ? { list: null, failure: null }
      : { list: referenceList(target, null), failure: { kind: 'unreachable' } }
  }
  if (result.ok) return { list: referenceList(target, result.document), failure: null }
  const messages = bannerMessages(result.errors)
  return {
    list: referenceList(target, null),
    failure: messages.length === 0 ? { kind: 'unreachable' } : { kind: 'banner', messages },
  }
}
```

D3 의 시험 하나가 5xx 를 "값 그대로" 로 잰다 — 판정한 4xx 로 바꾼다. `test/unit/resources/screen-state.test.ts` — Edit, 찾을 것:

```ts
  it('백엔드 오류 문서는 값 그대로다 - 협상된 문구를 배너로 그린다', () => {
    const result = failed<CollectionDocument>([BACKEND], 500)
    expect(throwIfUnreachable(result, '목록')).toBe(result)
  })
```

바꿀 것:

```ts
  it('판정한 백엔드 오류 문서(그 밖의 4xx)는 값 그대로다 - 협상된 문구를 배너로 그린다', () => {
    const result = failed<CollectionDocument>([{ ...BACKEND, status: '400' }], 400)
    expect(throwIfUnreachable(result, '목록')).toBe(result)
  })
```

`lib/resources/view.ts` — Edit, 찾을 것:

```ts
export function nextPageQuery(result: JsonApiResult<CollectionDocument>): URLSearchParams | null {
  if (!result.ok || result.document === null) return null
  if (result.document.data.length === 0) return null
  const next = result.document.links?.next
  if (!linkPresent(next)) return null
  const query = linkQuery(next)
  if (query === null || query.toString() === '') return null
  return query
}
```

바꿀 것:

```ts
export function nextPageQuery(result: JsonApiResult<CollectionDocument>): URLSearchParams | null {
  if (!result.ok || result.document === null) return null
  return nextLinkQuery(result.document)
}

/**
 * (template-typescript-expo) 응답 본문 하나의 다음 쪽 쿼리 - 위 목록 가운데 본문에 관한 넷(빈 쪽, 없는 링크, 읽을 수
 * 없는 링크, 쿼리가 빈 링크)이면 `null` 이다. 참조 목록의 잘림(`referenceList`)도 이 함수로 판정한다 - 둘이 `next`
 * 를 달리 읽으면 같은 응답이 무한 스크롤에서는 끝이고 관계 선택기에서는 "더 있다" 가 된다(D3 최종 검토 53e: 빈 링크
 * `''` 를 무한 스크롤은 끝으로, 선택기는 잘림으로 읽었다).
 */
function nextLinkQuery(document: CollectionDocument): URLSearchParams | null {
  if (document.data.length === 0) return null
  const next = document.links?.next
  if (!linkPresent(next)) return null
  const query = linkQuery(next)
  if (query === null || query.toString() === '') return null
  return query
}
```

같은 파일에 Edit, 찾을 것(`linkPresent` 의 주석):

```ts
 * (template-typescript-expo) 무한 스크롤의 `nextPageQuery`(더 읽을 것이 있는가)와 참조 목록의
 * `referenceList`(더 있는가, D4 Task 4 아래) 둘 다 **이 함수 하나로만** 판정한다 - 판정 규칙이
 * 두 자리로 갈라지면 하나만 고치는 사고가 난다. 원본의 쪽 이동(`pageHref`·`paginationView`)은
```

바꿀 것:

```ts
 * (template-typescript-expo) 무한 스크롤의 `nextPageQuery`(더 읽을 것이 있는가)와 참조 목록의
 * `referenceList`(더 있는가, D4 Task 4 아래) 둘 다 `nextLinkQuery` 를 지나 **이 함수 하나로만**
 * 판정한다 - 판정 규칙이 두 자리로 갈라지면 하나만 고치는 사고가 난다. 원본의 쪽 이동
 * (`pageHref`·`paginationView`)은
```

같은 파일에 Edit, 찾을 것:

```ts
  /** 백엔드가 더 있다고 말하는가. `links.next != null` 이다. */
```

바꿀 것:

```ts
  /** (template-typescript-expo) 따라갈 다음 쪽이 있는가 - `nextLinkQuery`(무한 스크롤의 끝과 같은 판정)다. */
```

같은 파일에 Edit, 찾을 것(`referenceList` 의 주석):

```ts
 * `linkPresent` 주석과 같은 자리다. 판정 규칙이 두 자리로 갈라지면 하나만
 * 고치는 사고가 나므로 새로 만들지 않고 그 함수를 그대로 불렀다.
```

바꿀 것:

```ts
 * `linkPresent` 주석과 같은 자리다. 판정 규칙이 두 자리로 갈라지면 하나만
 * 고치는 사고가 나므로 새로 만들지 않고 그 함수를 그대로 불렀다.
 * (template-typescript-expo) 그 함수가 `nextLinkQuery` 다 - 빈 쪽과 쿼리가 빈 링크(`''`·경로뿐)도
 * 잘림이 아니다(무한 스크롤의 끝과 같다).
```

같은 파일에 Edit, 찾을 것:

```ts
    truncated: linkPresent(document.links?.next),
```

바꿀 것:

```ts
    truncated: nextLinkQuery(document) !== null,
```

조회의 `queryFn` 정책을 말하는 D3 의 주석 둘을 맞춘다. `queries/resource-options.ts` — Edit, 찾을 것:

```ts
 * `queryFn` 은 백엔드가 응답조차 주지 못한 실패를 던진다(`throwIfUnreachable`) - TanStack Query 가 재조회의
 * 실패에도 읽은 데이터를 두게 한다(lib/resources/screen-state.ts). 백엔드 오류 문서는 결과 값으로 캐시에
 * 든다 - 화면이 협상된 문구를 배너로 그린다.
```

바꿀 것:

```ts
 * `queryFn` 은 백엔드의 판정을 받지 못한 조회 - 응답조차 없었거나, 판정하지 않은 응답(5xx·408·429)이다 - 를
 * 던진다(`throwIfUnreachable`) - TanStack Query 가 재조회의 실패에도 읽은 데이터를 두게 한다
 * (lib/resources/screen-state.ts). 판정한 백엔드 오류 문서(그 밖의 4xx)는 결과 값으로 캐시에 든다 - 화면이
 * 협상된 문구를 배너로 그린다.
```

`queries/resources.ts` — Edit, 찾을 것:

```ts
 * 일부러 던진다(queries/AGENTS.md). 조회의 `queryFn` 은 그 값 가운데 닿지 못함만 던진다 - TanStack Query 가
 * 재조회의 실패에도 읽은 데이터를 두게 하려는 것이다(`throwIfUnreachable`). 백엔드 오류 문서는 값으로 캐시에
 * 들어 배너가 된다.
```

바꿀 것:

```ts
 * 일부러 던진다(queries/AGENTS.md). 조회의 `queryFn` 은 그 값 가운데 백엔드의 판정을 받지 못한 것 - 닿지 못함과
 * 판정하지 않은 응답(5xx·408·429) - 만 던진다. TanStack Query 가 재조회의 실패에도 읽은 데이터를 두게 하려는
 * 것이다(`throwIfUnreachable`). 판정한 백엔드 오류 문서는 값으로 캐시에 들어 배너가 된다.
```

```bash
pnpm exec vitest run test/unit/resources test/unit/queries 2>&1 | grep -E "Test Files|Tests "
```

Expected: `failed` 없이 전부 통과 — 새 시험과 함께 D3 의 시험(`view.test.ts`·`view-expo.test.ts`·`screen-state.test.ts`·`resource-options.test.ts`)도 그대로다(닿지 못함의 전이와 `nextPageQuery` 의 답은 바뀌지 않았다).

- [ ] **Step 8: 출처 기록에 두 파일과 이탈 넷을 적는다**

Write 도구로 `.maestro-output/d4-provenance.cjs` 를 아래 내용으로 쓰고 돌린다:

```js
const fs = require('node:fs')
const file = 'docs/provenance/copied-core.json'
const record = JSON.parse(fs.readFileSync(file, 'utf8'))
const FORM = 'lib/resources/form.ts'
const FORM_TEST = 'test/unit/resources/form.test.ts'
const VIEW = 'lib/resources/view.ts'
for (const path of [FORM, FORM_TEST]) {
  if (record.paths.includes(path)) throw new Error(`이미 있다: ${path}`)
  if (path in (record.sourceBlobs ?? {})) throw new Error(`sourceBlobs 에 있다: ${path}`)
  record.paths.push(path)
}
if (!record.paths.includes(VIEW) || VIEW in (record.sourceBlobs ?? {})) {
  throw new Error(`${VIEW} 가 이탈이 있는 경로가 아니다 - 손으로 본다`)
}
const NOTE_END = '목록은 커서다(스펙 8.3).'
if (!record.note.endsWith(NOTE_END)) throw new Error('note 의 끝 문장이 예상과 다르다 - 손으로 고친다')
record.note +=
  " lib/resources/form.ts 의 주석이 말하는 Server Action·app/(app)/examples/actions.ts·useActionState·<select>·체크박스·'Task N'·'계획서 §N'·view.ts 의 줄 번호도 원본 저장소의 것이다."
record.divergences.push(
  {
    path: FORM,
    what: "FormData 를 읽는 readFormValues 와 그 도우미 셋(stringValue·toOneIds·toManyIds)을 빼고, 폼 상태 객체를 만들고 고치는 newFormValues(필수 enum 은 첫 값)·withAttribute·withRelationshipChoice(to-many 는 켜면 끝에 붙인다)를 더했다. 머리말과 ResourceFormValues 주석에 그 사실을 적었고, rawAttributeValue 주석이 가리키던 readFormValues 를 '폼 입력이 만드는 모양' 으로 고쳤다.",
    why: '스펙 6.2 - 입력이 FormData 가 아니라 화면이 들고 있는 폼 상태 객체다. 필수 enum 의 첫 값은 원본의 생성 화면에서 빈 보기 없는 소재 <select> 가 브라우저 기본으로 보내던 값이다 - 이 앱의 선택 칸에는 그 기본이 없다.',
  },
  {
    path: FORM,
    what: '관계 선택기의 판단을 더했다 - relationshipTargets(원본 app/(app)/examples/relationship-lists.ts 의 대상 찾기), relationshipChoice(원본 components/resource/relationship-picker.tsx 의 목록 밖 선택 되살리기, RelationshipOption·RelationshipChoice). import 에 resourceByType·ReferenceList·isRequiredAttribute 를 더했다.',
    why: '스펙 11.1 - 이 앱에는 컴포넌트 시험이 없어서 원본이 컴포넌트와 화면 파일에 두던 판단을 lib 에 두고 test/unit/resources/form-expo.test.ts 가 잰다. 참조 조회의 실패는 목록·상세처럼 lib/resources/screen-state.ts 의 referenceState 가 정한다(이 저장소의 새 파일).',
  },
  {
    path: FORM_TEST,
    what: 'readFormValues describe(8개)와 그 도우미 probeForm, import 의 readFormValues 를 지웠다.',
    why: 'form.ts 가 readFormValues 를 뺐다(스펙 6.2). 폼 상태 객체를 고치는 함수는 test/unit/resources/form-expo.test.ts 가 잰다.',
  },
  {
    path: VIEW,
    what: "nextPageQuery 의 본문 판정(빈 쪽·없는 링크·읽을 수 없는 링크·쿼리가 빈 링크)을 nextLinkQuery 로 빼고, referenceList 의 truncated 를 linkPresent(links.next) 대신 nextLinkQuery(document) !== null 로 판정한다 - 빈 쪽과 쿼리가 빈 링크('' 이거나 경로뿐)는 잘림이 아니다. ReferenceList.truncated·linkPresent·referenceList 의 주석을 그에 맞췄다.",
    why: "D3 최종 검토 53e - 같은 next 를 무한 스크롤은 끝으로, 관계 선택기는 잘림으로 읽었다('' 이면). 첫 소비자인 D4 의 관계 선택기에서 한 규칙으로 맞춘다. 세 백엔드는 그런 링크를 보내지 않는다. test/unit/resources/next-link.test.ts 가 같은 응답을 두 함수에 넣어 잰다.",
  },
)
fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`)
console.log(`경로 ${record.paths.length}개, 이탈 ${record.divergences.length}건`)
```

```bash
node .maestro-output/d4-provenance.cjs
node scripts/check-provenance.mjs
```

Expected: `경로 48개, 이탈 33건`, `복사 출처 기록 통과: 경로 48개, 이탈 33건, 원본 그대로 31개`(Step 1 의 46·29·31 에서 경로 둘·이탈 넷이 늘고 원본 그대로는 같다 - `view.ts` 는 이미 이탈이 있는 경로다). `note 의 끝 문장이 예상과 다르다` 로 멈추면 D3 가 note 를 다르게 끝냈다 — 스크립트의 `NOTE_END` 검사 한 줄을 지우고 다시 돌린다(문장은 끝에 붙는다).

- [ ] **Step 9: 문서와 스펙 정정을 쓴다**

`lib/resources/AGENTS.md` — Edit, 찾을 것:

```markdown
시험은 `test/unit/resources/view-expo.test.ts` 다. 폼 판단 `form.ts` 는 쓰기 화면(D4)이 같은 방식으로 복사한다.
```

바꿀 것:

```markdown
시험은 `test/unit/resources/view-expo.test.ts` 다. 쓰기 판단 `form.ts` 는 D4 가 같은 방식으로 복사했다 - 입력이
FormData 가 아니라 폼 상태 객체(`ResourceFormValues` 를 만들고 고치는 `newFormValues`·`withAttribute`·
`withRelationshipChoice`)이고, 원본이 컴포넌트에 두던 관계 선택기의 판단(`relationshipTargets`·`relationshipChoice`)을
더했다. 그 시험은 `test/unit/resources/form-expo.test.ts` 다. 쓰기 한 번의 흐름(세션 확인 → 요청 → 응답 해석, 원본의
Server Action 자리)은 이 저장소의 `write.ts` 이고 `test/unit/resources/write.test.ts` 가 가짜 전송·토큰으로 잰다.
무한 스크롤의 끝(`nextPageQuery`)과 관계 선택기의 잘림(`referenceList` 의 `truncated`)은 한 판정(`nextLinkQuery`)이다 -
`test/unit/resources/next-link.test.ts` 가 같은 응답을 두 함수에 넣어 잰다.
```

`lib/resources/AGENTS.md` — Edit, 찾을 것:

```markdown
`test/unit/queries/resource-options.test.ts`(실제 `QueryClient` 의 전이)다.
```

바꿀 것:

```markdown
`test/unit/queries/resource-options.test.ts`(실제 `QueryClient` 의 전이)다. 판정한 백엔드 오류 문서(그 밖의 4xx)는
결과 값이라 재조회의 답이어도 새 답이다(지워진 상세는 not-found) - 판정하지 않은 응답의 판단은
`test/unit/resources/screen-state-unjudged.test.ts`, 그 전이는 `test/unit/queries/refetch-unjudged.test.ts` 가 잰다.
목록 끝에서 다음 쪽을 부를지는 `canLoadMore` 다. 관계 선택기의 참조 목록도 같은 규칙이다(`referenceState` - 읽은
보기는 재조회가 판정을 받지 못해도 두고, 선택기는 작은 실패를 따로 그리지 않는다). 그 시험은
`test/unit/resources/reference-state.test.ts` 와 `test/unit/queries/reference-options.test.ts` 다.
```

`lib/resources/AGENTS.md` — Edit, 찾을 것:

```markdown
조회의 `queryFn` 이 백엔드에 닿지 못한 결과를
던지게 하고(`throwIfUnreachable` - `UnreachableError`),
```

바꿀 것:

```markdown
조회의 `queryFn` 이 백엔드의 판정을 받지 못한
결과 - 닿지 못함과 판정하지 않은 응답(5xx·408·429, D4) - 를 던지게 하고(`throwIfUnreachable` - `UnreachableError`),
```

`lib/resources/AGENTS.md` — Edit, 찾을 것:

```markdown
이름이 정해진 파라미터(상세의
`id`)는 이름으로 꺼낸다.
```

바꿀 것:

```markdown
이름이 정해진 파라미터(상세·수정의
`id`)는 이름으로 꺼낸다.
```

`queries/AGENTS.md` — Edit, 찾을 것:

```markdown
- 조회의 `queryFn`(`resource-options.ts`)은 `apiRequest` 의 결과 가운데 **닿지 못함만 던진다**(`throwIfUnreachable` -
```

바꿀 것:

```markdown
- 조회의 `queryFn`(`resource-options.ts`)은 `apiRequest` 의 결과 가운데 **백엔드의 판정을 받지 못한 것만 던진다** - 닿지
  못함과 판정하지 않은 응답(5xx·408·429 - D4, 회전과 같은 셋)이다(`throwIfUnreachable` -
```

`queries/AGENTS.md` — Edit, 찾을 것:

```markdown
  로 재 보였다). 백엔드 오류 문서는 결과 값으로 캐시에 든다 - 배너다.
```

바꿀 것:

```markdown
  로 재 보였다. D3 재검토가 같은 결함을 백엔드 오류 문서에서 봐 D4 가 5xx·408·429 를 더했다). 판정한 백엔드 오류
  문서(그 밖의 4xx)는 결과 값으로 캐시에 든다 - 배너다(첫 조회의 판정하지 않은 응답도 그 문구의 배너다).
```

스펙 — 9.3 의 끝, `### 9.4 Accept-Language` 바로 앞에 더한다:

```markdown
> 정정(2026-10-01, D4): 재조회가 판정하지 않은 응답(5xx·408·429)을 받아도 읽은 목록·상세를 버리지 않는다 - 닿지
> 못함(8.5 의 둘째 D3 정정)과 같다. 조회의 `queryFn` 이 그 응답도 던지고(`lib/resources/screen-state.ts` 의
> `throwIfUnreachable`), 화면은 첫 조회면 그 응답의 문구를 배너로, 읽은 데이터가 있으면 그 위에 작은 실패와 "다시
> 시도"(앱 문구)를, 다음 쪽이면 목록 끝의 작은 실패를 그린다. 판정한 오류(그 밖의 4xx - 없는 자원 등)는 여전히
> 결과 값이라 새 답이다(지워진 상세는 not-found). 처음 판은 백엔드 오류 문서를 전부 결과 값으로 캐시에 둬서, 목록의
> 재조회가 5xx 를 받으면 읽은 쪽 전부가 오류 한 쪽으로 바뀌고 다음 재조회는 한 쪽만 읽었다(D3 재검토) - 쓰기 뒤
> 무효화가 그 길을 늘린다. 그 셋을 판정하지 않은 응답으로 보는 것은 회전(7.2 의 D4 정정)과 같다.
```

- [ ] **Step 10: 정적 검사를 돌리고 커밋한다**

```bash
pnpm format
pnpm typecheck && pnpm lint && pnpm format:check && pnpm lint:secrets
./scripts/check-citations.sh app components lib platform queries test
pnpm test 2>&1 | grep -E "Test Files|Tests "
git add lib/resources test/unit/resources test/unit/queries queries docs/provenance/copied-core.json docs/superpowers/specs pnpm-workspace.yaml
git status --short
git commit -m "feat: 원본의 쓰기 판단을 폼 상태 객체로 복사하고 쓰기 흐름과 판정하지 않은 재조회의 정책을 lib 에 둔다"
```

Expected: 검사 전부 exit 0, `Tests  1250 passed (1250)`(기준 1143 + 107, 53 파일 - 원본 시험 33, 새 판단 13, 흐름 22, 판정하지 않은 응답 23, 그 전이 3, 참조 상태 7, 다음 쪽 6), `git status` 에 커밋할 것 말고 남은 파일이 없다(`.maestro-output/` 은 무시된다).

### Task 2: 세션·가드 보강 — 회전의 5xx, 라우트 모양의 보호 판정, 로그인 화면의 뒤로 가기, 제출 한 번, 세우기 거절의 시험

D2 최종 검토가 D4 에 넘긴 것 가운데 쓰기 화면 없이 고칠 수 있는 것을 한 태스크에 모은다(M5·M6·M7·M13, T3·T16). 쓰기 폼이 쓸 제출 가드(`submit-once.ts`)를 여기서 만들어 D2 의 자격증명 폼부터 쓴다.

**Files:**
- Modify: `lib/auth/rotation.ts`, `test/unit/auth/rotation.test.ts`, `docs/provenance/copied-core.json`(이탈 둘), `lib/auth/session-store.ts`, `lib/auth/protected-paths.ts`(전체), `test/unit/auth/protected-paths.test.ts`, `lib/auth/guard-latch.ts`, `app/(app)/_layout.tsx`, `queries/auth.ts`, `components/form/credentials-form.tsx`, `app/(auth)/login.tsx`, `app/(auth)/register.tsx`, `app/(app)/examples/index.tsx`(행·조건 바꾸기의 이동 가드), `lib/auth/AGENTS.md`, `lib/navigation/AGENTS.md`, `queries/AGENTS.md`, 스펙 7.2·7.3 정정
- Create: `components/app/back-to-home.ts`, `queries/submit-once.ts`, `test/unit/queries/submit-once.test.ts`, `test/unit/queries/auth.test.ts`, `lib/navigation/once.ts`, `components/app/navigate-once.ts`, `test/unit/navigation/once.test.ts`

**Interfaces:**
- Consumes: `lib/auth/rotation.ts` 의 `interpretRotationOutcome`, `lib/auth/protected-paths.ts` 의 `PROTECTED_PATH_PATTERNS`·`isProtectedPath`·`loginHref`, `lib/auth/guard-latch.ts` 의 `decideGuard`, `queries/auth.ts` 의 `establishIfSignedIn`(비공개), `@tanstack/react-query` 의 `mutationOptions`·`useQueryClient`·`MutationObserver`
- Produces:
  - `lib/auth/rotation.ts`: `interpretRotationOutcome` 이 5xx·408·429 에 `{ kind: 'unreachable', reason }` 을 준다
  - `lib/auth/protected-paths.ts`: `routePattern(segments: readonly string[]): string`
  - `components/app/back-to-home.ts`: `useBackToHome(): void`
  - `queries/submit-once.ts`: `submitOnce(client: QueryClient, mutationKey: MutationKey, submit: () => void): boolean`, `useSubmitOnce(mutationKey: MutationKey): (submit: () => void) => void`
  - `queries/auth.ts`: `LOGIN_MUTATION_KEY`(`['auth', 'login']`), `REGISTER_MUTATION_KEY`(`['auth', 'register']`), `loginMutationOptions(rawNext: unknown)`, `registerMutationOptions(rawNext: unknown)`
  - `components/form/credentials-form.tsx`: prop `mutationKey: MutationKey`(필수)
  - `lib/navigation/once.ts`: `interface Once { run: (action: () => void) => boolean; release: () => void }`, `createOnce(): Once`
  - `components/app/navigate-once.ts`: `useNavigateOnce(): (navigate: () => void) => void` - 목록 화면(`app/(app)/examples/index.tsx`)의 `navigateOnce` 가 Task 4 의 "새로 만들기" 에도 쓰인다

- [ ] **Step 1: 회전의 5xx — 시험을 먼저 고친다**

5xx·408·429 는 백엔드가 refresh token 을 판정하지 않은 응답이다 — 세션을 지우지 않는다(결정 11). 나머지 4xx 는 원본대로 지운다. `test/unit/auth/rotation.test.ts` 는 복사본이다 — 바꾼 곳은 Step 2 의 출처 기록에 적는다.

`test/unit/auth/rotation.test.ts` — Edit, 찾을 것 `  it('다른 거절 코드(422 VALIDATION_ERROR)도 destroy - status!==0 이면 코드와 무관하게 파기한다', () => {` — 바꿀 것 `  it('다른 거절 코드(422 VALIDATION_ERROR)도 destroy - 4xx 거절이면 코드와 무관하게 파기한다', () => {`.

같은 파일에 Edit, 찾을 것:

```ts
    const outcome = interpretRotationOutcome(result, NOW)
    expect(outcome.kind).toBe('unreachable')
    if (outcome.kind !== 'unreachable') throw new Error('unreachable')
    expect(outcome.reason).toMatch(/NETWORK_ERROR/)
  })
```

바꿀 것:

```ts
    const outcome = interpretRotationOutcome(result, NOW)
    expect(outcome.kind).toBe('unreachable')
    if (outcome.kind !== 'unreachable') throw new Error('unreachable')
    expect(outcome.reason).toMatch(/NETWORK_ERROR/)
  })

  it.each([500, 502, 503, 504, 408, 429])(
    '(template-typescript-expo) 백엔드가 토큰을 판정하지 않은 응답(%i) → unreachable - 세션을 파기하지 않는다',
    (status) => {
      const result: JsonApiResult<AuthTokensDocument> = {
        ok: false,
        status,
        errors: [{ status: String(status), code: 'NON_JSONAPI_RESPONSE' }],
      }
      const outcome = interpretRotationOutcome(result, NOW)
      expect(outcome.kind).toBe('unreachable')
      if (outcome.kind !== 'unreachable') throw new Error('unreachable')
      expect(outcome.reason).toContain(`status ${status}`)
    },
  )

  it.each([400, 403, 404, 409])(
    '(template-typescript-expo) 그 밖의 4xx(%i) 는 원본대로 destroy 다',
    (status) => {
      const result: JsonApiResult<AuthTokensDocument> = {
        ok: false,
        status,
        errors: [{ status: String(status), code: 'PROBE_REJECTED' }],
      }
      expect(interpretRotationOutcome(result, NOW).kind).toBe('destroy')
    },
  )
```

같은 파일에 Edit, 찾을 것:

```ts
  it('fetch 가 던지면(네트워크 실패) → unreachable, 재시도하지 않는다(정확히 1회)', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'))

    const outcome = await rotateSession('refresh-token', probeSend, NOW)

    expect(outcome.kind).toBe('unreachable')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
```

바꿀 것:

```ts
  it('fetch 가 던지면(네트워크 실패) → unreachable, 재시도하지 않는다(정확히 1회)', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'))

    const outcome = await rotateSession('refresh-token', probeSend, NOW)

    expect(outcome.kind).toBe('unreachable')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('(template-typescript-expo) 프록시가 준 HTML 502 → unreachable, 재시도하지 않는다(정확히 1회)', async () => {
    fetchMock.mockResolvedValue(
      new Response('<html>probe bad gateway</html>', {
        status: 502,
        headers: { 'content-type': 'text/html' },
      }),
    )

    const outcome = await rotateSession('refresh-token', probeSend, NOW)

    expect(outcome.kind).toBe('unreachable')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
```

```bash
pnpm exec vitest run test/unit/auth/rotation.test.ts 2>&1 | tail -4
```

Expected: FAIL — `Tests  7 failed | 14 passed (21)`(5xx·408·429 여섯과 HTML 502 하나가 아직 `destroy` 다. 4xx 넷은 지금도 통과한다 - 되돌림을 막는 시험이다).

- [ ] **Step 2: `interpretRotationOutcome` 을 고치고 출처 기록에 적는다**

`lib/auth/rotation.ts` — Edit, 찾을 것:

```ts
 * 오직 `status === 0`(백엔드가 아예 판정을 내지 못함)만 unreachable 이다 -
 * 세션이 죽었다는 증거가 없으므로 파기하지 않는다. 파기하면 백엔드가
 * 잠깐 죽었을 때 그 순간 회전이 필요했던 모든 사용자가 로그아웃된다.
 */
```

바꿀 것:

```ts
 * 오직 `status === 0`(백엔드가 아예 판정을 내지 못함)만 unreachable 이다 -
 * 세션이 죽었다는 증거가 없으므로 파기하지 않는다. 파기하면 백엔드가
 * 잠깐 죽었을 때 그 순간 회전이 필요했던 모든 사용자가 로그아웃된다.
 *
 * (template-typescript-expo) 5xx·408·429 도 unreachable 이다 - 백엔드(나 그 앞의 프록시)가 응답은
 * 했지만 이 refresh token 을 판정하지 않았다(서버 오류·시간 초과·요청 과다). 원본처럼 파기로 모으면
 * 세션이 30일인 앱에서 회전 순간의 502 하나가 사용자를 로그아웃시킨다. 대가: 서버가 회전을 마친 뒤
 * 5xx 를 냈다면 옛 refresh 를 들고 있다가 다음 회전의 재사용 감지로 그 사용자의 세션이 전부 끊긴다 -
 * 로그아웃이 쓰기 한 번만큼 늦게 오고 다른 기기의 세션도 함께 끊긴다. 나머지 4xx 는 원본대로 파기한다.
 */
```

같은 파일에 Edit, 찾을 것:

```ts
      reason: `백엔드에 닿지 못했다: ${result.errors[0]?.code ?? 'UNKNOWN'}`,
    }
  }

  return {
```

바꿀 것:

```ts
      reason: `백엔드에 닿지 못했다: ${result.errors[0]?.code ?? 'UNKNOWN'}`,
    }
  }

  // (template-typescript-expo) 판정하지 않은 응답 - 위 주석의 마지막 문단.
  if (result.status >= 500 || result.status === 408 || result.status === 429) {
    return {
      kind: 'unreachable',
      reason: `백엔드가 회전을 판정하지 못했다(status ${result.status}, code ${result.errors[0]?.code ?? 'UNKNOWN'})`,
    }
  }

  return {
```

Write 도구로 `.maestro-output/d4-provenance-rotation.cjs` 를 아래 내용으로 쓰고 돌린다:

```js
const fs = require('node:fs')
const file = 'docs/provenance/copied-core.json'
const record = JSON.parse(fs.readFileSync(file, 'utf8'))
const ROTATION = 'lib/auth/rotation.ts'
const ROTATION_TEST = 'test/unit/auth/rotation.test.ts'
for (const path of [ROTATION, ROTATION_TEST]) {
  if (!record.paths.includes(path)) throw new Error(`출처 기록에 없다: ${path}`)
  if (path in (record.sourceBlobs ?? {})) throw new Error(`sourceBlobs 에 있다: ${path}`)
}
record.divergences.push(
  {
    path: ROTATION,
    what: 'interpretRotationOutcome 이 5xx·408·429 도 unreachable 로 돌려준다(원본은 status 0 만) - 그 갈래 하나와 함수 주석 끝의 (template-typescript-expo) 문단을 더했다.',
    why: '스펙 7.2 의 D4 정정 - 그 셋은 백엔드가 refresh token 을 판정하지 않은 응답이라 "인증 거절" 이 아니다. 원본처럼 파기로 모으면 세션이 30일인 앱에서 회전 순간의 502 하나가 사용자를 로그아웃시킨다(docs/superpowers/notes/2026-10-01-d2-carry-forward.md 의 D4 절).',
  },
  {
    path: ROTATION_TEST,
    what: "5xx·408·429 → unreachable 시험(6행), 그 밖의 4xx → destroy 시험(4행), 프록시가 준 HTML 502 가 unreachable 인 rotateSession 시험을 더했다. 422 시험의 이름 'status!==0 이면' 을 '4xx 거절이면' 으로 고쳤다.",
    why: '위 rotation.ts 의 이탈을 따라간다.',
  },
)
fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`)
console.log(`경로 ${record.paths.length}개, 이탈 ${record.divergences.length}건`)
```

```bash
pnpm exec vitest run test/unit/auth 2>&1 | tail -4
node .maestro-output/d4-provenance-rotation.cjs
node scripts/check-provenance.mjs | tail -n 1
```

Expected: `test/unit/auth` 전부 PASS(회전 21 — 세션 관리자 시험은 상태 0 과 401 만 써서 그대로다), `경로 48개, 이탈 34건`, `복사 출처 기록 통과: 경로 48개, 이탈 34건, 원본 그대로 31개`.

- [ ] **Step 3: `session-store.ts` 의 시각 주석을 고친다**

로그인의 access 만료는 요청 전 시각(`signIn` 의 `now`), refresh 만료는 응답 뒤 시각(`establish` 의 `now()`)이다 — 주석이 "같은 값" 이라고 적는다(D2 최종 검토 M13, 결정 12). 동작은 그대로다.

`lib/auth/session-store.ts` — Edit, 찾을 것:

```ts
/**
 * 로그인·회전 응답에서 저장할 세션을 만든다. `now` 는 만료 시각의 기준인 기기 시각이다 -
 * `session.accessExpiresAt` 을 만든 시각과 같은 값을 넘긴다(tokens.ts 의 sessionFromTokenDocument).
 * 로그인은 응답을 받은 뒤의 시각을, 회전은 요청을 보내기 직전의 시각을 넘긴다 - 회전은 요청이 걸린
 * 시간만큼 만료가 이르게 잡히는 안전한 쪽이다.
 */
```

바꿀 것:

```ts
/**
 * 로그인·회전 응답에서 저장할 세션을 만든다. `now` 는 refresh 만료의 기준인 기기 시각이다.
 *
 * - 회전은 요청을 보내기 직전의 시각을 넘긴다(session-manager.ts 의 rotate) - `session.accessExpiresAt`
 *   을 만든 시각과 같다. 두 만료가 요청이 걸린 시간만큼 이르게 잡히는 안전한 쪽이다.
 * - 로그인·가입은 응답을 받은 뒤의 시각을 넘긴다(session-manager.ts 의 establish). access 만료는 그보다
 *   앞선, 요청을 보내기 전의 시각으로 잡혀 온다(credentials.ts 의 signIn 이 받은 `now`) - refresh 만료만
 *   요청이 걸린 시간(요청 시간 제한 15초 이하)만큼 늦게 잡힌다. refresh 수명(30일)에 비해 작아서 두 시각을
 *   하나로 맞추지 않는다.
 */
```

- [ ] **Step 4: 보호 판정을 라우트 모양으로 — 시험 행을 먼저 더한다**

`usePathname()` 은 파라미터 값을 풀어 경로를 다시 만든다 — `/examples/a%2Fb/edit` 가 `/examples/a/b/edit` 가 되어 `[^/]+` 를 벗어난다(D2 트리아지 T3). 가드는 `useSegments()` 의 라우트 모양(`/examples/[id]/edit`)으로 판정한다(결정 13).

`test/unit/auth/protected-paths.test.ts` — Edit, 찾을 것:

```ts
  isProtectedPath,
  loginHref,
} from '@/lib/auth/protected-paths'
```

바꿀 것:

```ts
  isProtectedPath,
  loginHref,
  routePattern,
} from '@/lib/auth/protected-paths'
```

같은 파일에 Edit, 찾을 것:

```ts
 * 보호 경로 목록(스펙 7.3). 경로는 Expo Router 의 usePathname() 값이다 - 쿼리가 없고 동적
 * 세그먼트는 실제 값으로 채워져 있다.
```

바꿀 것:

```ts
 * 보호 경로 목록(스펙 7.3). 패턴은 실제 경로(`/examples/42/edit`)와 앱 셸이 넘기는 라우트 모양
 * (`/examples/[id]/edit`, routePattern) 둘 다 받는다.
```

같은 파일에 Edit, 찾을 것:

```ts
  it('목록은 원본의 PROTECTED_PATH_PATTERNS 와 같은 범위다 - 생성, 수정·삭제', () => {
    expect(PROTECTED_PATH_PATTERNS).toHaveLength(2)
  })
})
```

바꿀 것:

```ts
  it('목록은 원본의 PROTECTED_PATH_PATTERNS 와 같은 범위다 - 생성, 수정·삭제', () => {
    expect(PROTECTED_PATH_PATTERNS).toHaveLength(2)
  })
})

describe('routePattern - 앱 셸이 대조하는 라우트 모양', () => {
  it.each<[string[], string]>([
    [['(app)'], '/'],
    [['(app)', 'examples'], '/examples'],
    [['(app)', 'examples', 'new'], '/examples/new'],
    [['(app)', 'examples', '[id]'], '/examples/[id]'],
    [['(app)', 'examples', '[id]', 'edit'], '/examples/[id]/edit'],
    [['(auth)', 'login'], '/login'],
  ])('%j → %s - 그룹 세그먼트는 뺀다', (segments, pattern) => {
    expect(routePattern(segments)).toBe(pattern)
  })

  it('생성과 수정의 라우트 모양은 보호 경로이고 상세는 아니다 - id 의 값과 무관하다', () => {
    expect(isProtectedPath(routePattern(['(app)', 'examples', 'new']))).toBe(true)
    expect(isProtectedPath(routePattern(['(app)', 'examples', '[id]', 'edit']))).toBe(true)
    expect(isProtectedPath(routePattern(['(app)', 'examples', '[id]']))).toBe(false)
  })

  it('usePathname() 이 id 의 %2F 를 풀어 만든 경로는 패턴을 벗어난다 - 그래서 경로가 아니라 라우트 모양으로 대조한다', () => {
    expect(isProtectedPath('/examples/a/b/edit')).toBe(false)
  })
})
```

```bash
pnpm exec vitest run test/unit/auth/protected-paths.test.ts 2>&1 | tail -4
```

Expected: FAIL — `Tests  7 failed | 18 passed (25)`(`routePattern is not a function`. 마지막 시험은 지금도 통과한다 - 왜 경로로 판정하지 않는지를 적은 것이다).

이 파일은 전체를 바꾸므로 D2 의 끝 그대로인지 먼저 본다 — 그 사이의 변경을 조용히 지우지 않게(결정 31):

```bash
git rev-parse HEAD:lib/auth/protected-paths.ts
```

Expected: `b431cf30841e08e8112fe5654fceca1ca22dc269`. 다르면 `git log -p -- lib/auth/protected-paths.ts` 에서 D2 뒤의 변경을 찾아 아래 판에 옮겨 적은 뒤 바꾼다.

`lib/auth/protected-paths.ts` 전체를 바꾼다:

```ts
/**
 * 보호 경로 목록과 로그인으로 보내는 주소 - 스펙 7.3 의 첫 겹(경로 가드).
 *
 * 목록은 **여기 하나**다. `app/(app)/_layout.tsx` 가 (guard-latch.ts 의 `decideGuard()` 로) 지금 라우트를
 * 이 목록과 대조해 세션이 없으면 `loginHref()` 로 보낸다. 범위는 원본(template-typescript-nextjs)의
 * `PROTECTED_PATH_PATTERNS` 와 같다 - 생성과 수정·삭제 화면만 로그인이 필요하고 목록·상세·실험실은
 * 공개다.
 *
 * 앱 셸이 대조하는 것은 실제 경로가 아니라 라우트 모양이다(`routePattern` - `/examples/[id]/edit`).
 * Expo Router 의 `usePathname()` 은 파라미터 값을 풀어 경로를 다시 만든다 - id 에 `/` 가 든
 * `/examples/a%2Fb/edit` 는 `/examples/a/b/edit` 가 되어 아래 `[^/]+` 를 벗어난다. 라우트의
 * 세그먼트(`useSegments()`)는 파라미터 값을 담지 않는다. 패턴은 실제 경로(`/examples/42/edit`)도 받는다.
 */

/** 로그인 화면의 경로. */
export const LOGIN_PATH = '/login'

/**
 * 로그인 뒤 돌아갈 경로를 싣는 파라미터 이름. 로그인·가입 화면이 같은 이름으로 읽는다 - 한쪽만
 * 바뀌면 로그인 뒤 복귀가 아무 오류 없이 홈으로 떨어진다.
 */
export const LOGIN_REDIRECT_PARAM = 'next'

export const PROTECTED_PATH_PATTERNS: readonly RegExp[] = [
  /^\/examples\/new$/,
  /^\/examples\/[^/]+\/edit$/,
]

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATH_PATTERNS.some((pattern) => pattern.test(pathname))
}

/**
 * Expo Router 의 `useSegments()`(파일 경로의 세그먼트)에서 가드가 대조할 라우트 모양을 만든다. 그룹
 * 세그먼트(`(app)`)는 경로에 나타나지 않으므로 뺀다 - `['(app)', 'examples', '[id]', 'edit']` 는
 * `/examples/[id]/edit`, 홈(`['(app)']`)은 `/` 다.
 */
export function routePattern(segments: readonly string[]): string {
  const visible = segments.filter((segment) => !(segment.startsWith('(') && segment.endsWith(')')))
  return `/${visible.join('/')}`
}

/**
 * 보호 경로에서 막힌 사용자를 보내는 주소 - 원래 경로를 `next` 로 싣는다. 받는 쪽은 그 값을
 * `safeRedirectTarget()`(flow.ts)으로 다시 검사한다 - 딥링크로 들어온 `next` 는 믿을 수 없다.
 * 앱 셸은 `usePathname()` 을 넘긴다 - 파라미터 값이 풀린 경로라 id 에 `/` 가 든 화면은 로그인 뒤 다른
 * 경로로 돌아간다(없는 경로의 not-found). 씨앗과 세 백엔드가 만드는 id 는 UUID 라 `/` 가 없다.
 */
export function loginHref(pathname: string): string {
  return `${LOGIN_PATH}?${LOGIN_REDIRECT_PARAM}=${encodeURIComponent(pathname)}`
}
```

`lib/auth/guard-latch.ts` — Edit, 찾을 것 `  /** Expo Router 의 usePathname() 값. */` — 바꿀 것:

```ts
  /**
   * 대조할 라우트 모양 - 앱 셸은 `routePattern(useSegments())` 를 넘긴다(protected-paths.ts). 파라미터 값이
   * 풀린 `usePathname()` 은 id 에 `/` 가 들면 보호 경로를 벗어난다.
   */
```

`app/(app)/_layout.tsx` — Edit 셋. 찾을 것 `import { Redirect, Stack, usePathname, type Href } from 'expo-router'` — 바꿀 것 `import { Redirect, Stack, usePathname, useSegments, type Href } from 'expo-router'`. 찾을 것 `import { loginHref } from '@/lib/auth/protected-paths'` — 바꿀 것 `import { loginHref, routePattern } from '@/lib/auth/protected-paths'`. 찾을 것:

```tsx
  const pathname = usePathname()
  const status = useSessionStatus()
  const loggingOut = useIsLoggingOut()
  const [latched, setLatched] = useState(false)

  const guard = decideGuard({ status, loggingOut, latched, pathname })
```

바꿀 것:

```tsx
  const pathname = usePathname()
  // 보호 판정은 라우트 모양으로 한다 - usePathname() 은 id 의 %2F 를 풀어 경로를 다시 만들어 보호 경로를
  // 벗어난다(lib/auth/protected-paths.ts). 로그인 뒤 돌아올 경로(next)는 그대로 pathname 이다.
  const route = routePattern(useSegments())
  const status = useSessionStatus()
  const loggingOut = useIsLoggingOut()
  const [latched, setLatched] = useState(false)

  const guard = decideGuard({ status, loggingOut, latched, pathname: route })
```

```bash
pnpm exec vitest run test/unit/auth 2>&1 | tail -4
```

Expected: `test/unit/auth` 전부 PASS(보호 경로 25, 래치 시험은 그대로 - 패턴이 실제 경로도 받는다).

- [ ] **Step 5: 로그인·가입 쓰기의 옵션을 내보내고 세우기 거절의 정책을 잰다**

세션 관리자는 저장소 쓰기가 실패하면 메모리에 세운 뒤 거절한다. `establishIfSignedIn` 은 그 거절을 잡아 남기고 로그인을 이어 간다 — 그 정책에 시험이 없다(D2 트리아지 T16). 훅의 옵션을 내보내 TanStack Query 의 `MutationObserver` 로 그대로 돌린다(결정 15). 같은 자리에서 제출 가드가 쓸 쓰기의 키를 더한다.

`test/unit/queries/auth.test.ts` 를 만든다:

```ts
import { MutationObserver, QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { JsonApiResult } from '@/lib/jsonapi/client'
import { loginMutationOptions, registerMutationOptions } from '@/queries/auth'

/**
 * 로그인·가입 쓰기의 세션 세우기(queries/auth.ts 의 establishIfSignedIn). 세션 관리자는 저장소 쓰기가 실패하면
 * 메모리에 세운 뒤 거절한다(lib/auth/session-manager.ts) - 그 거절은 로그인 실패가 아니라서 쓰기가 성공한
 * 결정으로 끝나야 하고, 오류는 삼키지 않고 이름과 문구만 남아야 한다.
 *
 * 훅이 쓰는 옵션을 TanStack Query 의 MutationObserver 로 그대로 돌린다 - 쓰기의 상태(성공·실패)와 onError 가
 * 실제 쓰기 캐시에서 어떻게 끝나는지를 본다. API 클라이언트와 세션 관리자만 가짜다.
 */
const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn<(path: string) => Promise<JsonApiResult<unknown>>>(),
  establish: vi.fn<() => Promise<void>>(),
}))

vi.mock('@/platform/api', () => ({ apiRequest: mocks.apiRequest }))
vi.mock('@/platform/session', () => ({ sessionManager: { establish: mocks.establish } }))

const CREDENTIALS = { email: 'probe-user@probe.example', password: 'probe-password-value' }
const NEXT = '/examples/new'

const TOKENS: JsonApiResult<unknown> = {
  ok: true,
  status: 200,
  document: {
    data: {
      type: 'authTokens',
      id: 'probe-jti',
      attributes: {
        accessToken: 'probe-access',
        refreshToken: 'probe-refresh',
        tokenType: 'Bearer',
        expiresIn: 300,
        refreshExpiresIn: 86_400,
      },
    },
  },
}
const CREATED: JsonApiResult<unknown> = {
  ok: true,
  status: 201,
  document: { data: { type: 'users', id: 'probe-user' } },
}
const REJECTED: JsonApiResult<unknown> = {
  ok: false,
  status: 401,
  errors: [{ status: '401', code: 'PROBE_BAD_CREDENTIALS', detail: 'probe-bad-credentials' }],
}

let client: QueryClient

beforeEach(() => {
  client = new QueryClient()
  mocks.apiRequest.mockReset()
  mocks.establish.mockReset().mockResolvedValue()
})

afterEach(() => {
  client.clear()
  vi.restoreAllMocks()
})

describe('loginMutationOptions - 세션을 세우는 데까지', () => {
  it('세션을 저장소에 쓰지 못해도(establish 거절) 쓰기는 성공한 결정으로 끝나고 오류의 이름과 문구만 남는다', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    mocks.apiRequest.mockResolvedValue(TOKENS)
    mocks.establish.mockRejectedValue(new Error('probe-storage'))
    const observer = new MutationObserver(client, loginMutationOptions(NEXT))

    const plan = await observer.mutate(CREDENTIALS)

    expect(plan).toMatchObject({ kind: 'establish', to: NEXT, refreshExpiresIn: 86_400 })
    expect(observer.getCurrentResult().status).toBe('success')
    expect(mocks.establish).toHaveBeenCalledTimes(1)
    expect(logged).toHaveBeenCalledTimes(1)
    expect(String(logged.mock.calls[0]?.[0])).toContain('Error: probe-storage')
    expect(String(logged.mock.calls[0]?.[0])).not.toContain('probe-access')
  })

  it('세션을 세우면 아무것도 남기지 않는다', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    mocks.apiRequest.mockResolvedValue(TOKENS)
    const observer = new MutationObserver(client, loginMutationOptions(NEXT))

    await observer.mutate(CREDENTIALS)

    expect(mocks.establish).toHaveBeenCalledTimes(1)
    expect(logged).not.toHaveBeenCalled()
  })

  it('백엔드가 거절하면 세션을 세우지 않고 폼 상태를 돌려준다', async () => {
    mocks.apiRequest.mockResolvedValue(REJECTED)
    const observer = new MutationObserver(client, loginMutationOptions(NEXT))

    const plan = await observer.mutate(CREDENTIALS)

    expect(plan.kind).toBe('state')
    expect(mocks.establish).not.toHaveBeenCalled()
  })
})

describe('registerMutationOptions - 가입 뒤 로그인까지', () => {
  it('세션을 저장소에 쓰지 못해도 가입은 성공한 결정으로 끝난다 - 계정도 세션(메모리)도 이미 있다', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    mocks.apiRequest.mockResolvedValueOnce(CREATED).mockResolvedValueOnce(TOKENS)
    mocks.establish.mockRejectedValue(new Error('probe-storage'))
    const observer = new MutationObserver(client, registerMutationOptions(NEXT))

    const plan = await observer.mutate(CREDENTIALS)

    expect(plan).toMatchObject({ kind: 'establish', to: NEXT })
    expect(observer.getCurrentResult().status).toBe('success')
    expect(mocks.apiRequest).toHaveBeenCalledTimes(2)
    expect(logged).toHaveBeenCalledTimes(1)
    expect(String(logged.mock.calls[0]?.[0])).toContain('Error: probe-storage')
  })
})
```

```bash
pnpm exec vitest run test/unit/queries/auth.test.ts 2>&1 | tail -4
```

Expected: FAIL — `Tests  4 failed (4)`(`TypeError: loginMutationOptions is not a function`).

`queries/auth.ts` — Edit, 찾을 것 `import { useIsMutating, useMutation, useQueryClient } from '@tanstack/react-query'` — 바꿀 것 `import { mutationOptions, useIsMutating, useMutation, useQueryClient } from '@tanstack/react-query'`.

같은 파일에 Edit, 찾을 것:

```ts
/** 로그인. `rawNext` 는 화면이 받은 `next` 파라미터 그대로다 - 검사는 decideAfterLogin 이 한다. */
export function useLoginMutation(rawNext: unknown) {
  return useMutation({
    mutationFn: async (credentials: Credentials) =>
```

바꿀 것:

```ts
/** 로그인·가입 쓰기의 키 - 화면이 진행 중인 제출을 렌더를 거치지 않고 본다(queries/submit-once.ts). */
export const LOGIN_MUTATION_KEY = ['auth', 'login'] as const
export const REGISTER_MUTATION_KEY = ['auth', 'register'] as const

/**
 * 로그인 쓰기의 옵션 - 훅이 쓰고, 시험(test/unit/queries/auth.test.ts)이 TanStack Query 의 MutationObserver 로
 * 그대로 돌린다. `rawNext` 는 화면이 받은 `next` 파라미터 그대로다 - 검사는 decideAfterLogin 이 한다.
 */
export function loginMutationOptions(rawNext: unknown) {
  return mutationOptions({
    mutationKey: LOGIN_MUTATION_KEY,
    mutationFn: async (credentials: Credentials) =>
```

같은 파일에 Edit, 찾을 것:

```ts
    onError: (error) => {
      logFailure('로그인이 예외로 끝났다', error)
    },
  })
}

/** 가입 - register 다음 login(스펙 7.4). 계정은 만들어졌는데 로그인이 실패하면 상태가 그것을 싣는다. */
export function useRegisterMutation(rawNext: unknown) {
  return useMutation({
    mutationFn: async (credentials: Credentials) =>
```

바꿀 것:

```ts
    onError: (error) => {
      logFailure('로그인이 예외로 끝났다', error)
    },
  })
}

/** 로그인. */
export function useLoginMutation(rawNext: unknown) {
  return useMutation(loginMutationOptions(rawNext))
}

/**
 * 가입 쓰기의 옵션 - register 다음 login(스펙 7.4). 계정은 만들어졌는데 로그인이 실패하면 상태가 그것을
 * 싣는다. 훅과 시험이 함께 쓴다(`loginMutationOptions` 와 같다).
 */
export function registerMutationOptions(rawNext: unknown) {
  return mutationOptions({
    mutationKey: REGISTER_MUTATION_KEY,
    mutationFn: async (credentials: Credentials) =>
```

같은 파일에 Edit, 찾을 것:

```ts
    onError: (error) => {
      logFailure('가입이 예외로 끝났다', error)
    },
  })
}
```

바꿀 것:

```ts
    onError: (error) => {
      logFailure('가입이 예외로 끝났다', error)
    },
  })
}

/** 가입. */
export function useRegisterMutation(rawNext: unknown) {
  return useMutation(registerMutationOptions(rawNext))
}
```

```bash
pnpm exec vitest run test/unit/queries 2>&1 | tail -4
```

Expected: `test/unit/queries` 전부 PASS(`auth.test.ts` 4, D3 의 `keys.test.ts` 10). `establishIfSignedIn` 의 `try`/`catch` 를 지우면 둘이 실패한다(스크래치에서 쟀다 - 쓰기가 실패로 끝나 `mutate()` 가 거절한다).

- [ ] **Step 6: 제출 한 번 가드와 로그인·가입 화면의 뒤로 가기**

제출 한 번(결정 9, D2 최종 검토 M7): 렌더 때의 `pending` 이 아니라 쓰기 캐시를 본다 — 같은 키의 쓰기가 진행 중이면 그 제출을 버린다. 시험은 실제 `QueryClient` 의 쓰기로 잰다.

`test/unit/queries/submit-once.test.ts` 를 만든다:

```ts
import { MutationObserver, QueryClient } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { submitOnce } from '@/queries/submit-once'

/**
 * 제출 한 번 가드(queries/submit-once.ts). 실제 QueryClient 의 쓰기로 잰다 - 가드가 기대는 것은 "mutate() 가
 * 돌아오기 전에 그 쓰기가 캐시에서 진행 중이다" 라는 TanStack Query 의 동작이라 가짜로는 잴 수 없다.
 *
 * 키는 실전 값이 아니다(probe).
 */
const KEY = ['probe', 'write'] as const
const OTHER_KEY = ['probe', 'other'] as const
const client = new QueryClient()

afterEach(() => {
  client.clear()
})

/** 끝을 손으로 정하는 쓰기 하나 - `settle` 을 부를 때까지 진행 중이다. */
function manualWrite(mutationKey: readonly string[], fails = false) {
  let settle: () => void = () => undefined
  const gate = new Promise<void>((resolve, reject) => {
    settle = fails ? () => reject(new Error('probe-failure')) : resolve
  })
  const observer = new MutationObserver(client, { mutationKey, mutationFn: () => gate })
  let running: Promise<unknown> = Promise.resolve()
  return {
    submit: vi.fn(() => {
      running = observer.mutate().catch(() => undefined)
    }),
    settle: async () => {
      settle()
      await running
    },
  }
}

describe('submitOnce', () => {
  it('같은 키의 쓰기가 진행 중이면 둘째 제출을 버린다 - mutate() 가 돌아온 바로 그 틱에도', async () => {
    const write = manualWrite([...KEY])
    expect(submitOnce(client, KEY, write.submit)).toBe(true)
    expect(submitOnce(client, KEY, write.submit)).toBe(false)
    expect(write.submit).toHaveBeenCalledTimes(1)
    await write.settle()
  })

  it('쓰기가 끝나면 다시 제출한다 - 실패로 끝나도 같다', async () => {
    const write = manualWrite([...KEY], true)
    submitOnce(client, KEY, write.submit)
    await write.settle()
    expect(submitOnce(client, KEY, write.submit)).toBe(true)
    expect(write.submit).toHaveBeenCalledTimes(2)
    await write.settle()
  })

  it('다른 키의 쓰기는 막지 않는다', async () => {
    const write = manualWrite([...KEY])
    const other = manualWrite([...OTHER_KEY])
    submitOnce(client, KEY, write.submit)
    expect(submitOnce(client, OTHER_KEY, other.submit)).toBe(true)
    await write.settle()
    await other.settle()
  })
})
```

```bash
pnpm exec vitest run test/unit/queries/submit-once.test.ts 2>&1 | tail -6
```

Expected: FAIL — `Error: Cannot find package '@/queries/submit-once'`.

`queries/submit-once.ts` 를 만든다:

```ts
import { useQueryClient, type MutationKey, type QueryClient } from '@tanstack/react-query'

/**
 * 제출 하나가 끝나기 전의 두 번째 제출을 버리는 가드 - 폼(자격증명·자원)이 함께 쓴다.
 *
 * 화면이 받은 `isPending` 은 렌더 때의 값이다. 제출 버튼과 키보드의 이동 키가 한 틱 안에 함께 눌리면 둘째
 * 제출도 `isPending` 이 거짓인 렌더를 보고 지나가 요청이 둘 나간다 - 가입이면 첫 요청이 세션을 세우고 둘째가
 * 409 를 받아 로그인한 채 "이미 가입된 이메일" 배너를 보고, 생성이면 행이 둘 생긴다(백엔드에 유일성 제약이
 * 없다). 그래서 렌더를 거치지 않는 값을 본다: TanStack Query 의 쓰기는 `mutate()` 가 돌아오기 전에 캐시에서
 * 진행 중이 되고(`Mutation.execute` 가 첫 await 전에 pending 을 알린다) 끝나는 순간 풀린다. 같은
 * `mutationKey` 의 쓰기가 진행 중이면 이번 제출을 버린다.
 *
 * ref 로 잠그고 `isPending` 이 거짓으로 돌아온 효과에서 푸는 모양은 쓰지 않는다 - 알림은 setTimeout 0 뒤에
 * 가므로 응답이 첫 알림보다 먼저 오면 화면이 진행 중인 렌더를 한 번도 보지 못해 잠금이 풀리지 않는다.
 */
export function submitOnce(
  client: QueryClient,
  mutationKey: MutationKey,
  submit: () => void,
): boolean {
  if (client.isMutating({ mutationKey }) > 0) return false
  submit()
  return true
}

/**
 * 폼이 쓰는 모양 - 폼은 제출이 부를 쓰기의 키를 받아(자격증명 폼은 `LOGIN_MUTATION_KEY` 등, 자원 폼은 쓰기
 * 훅의 `mutationKey`) 제출을 이 함수로 감싼다. `submit` 안에서 그 키의 `mutate()` 가 불려야 한다.
 */
export function useSubmitOnce(mutationKey: MutationKey): (submit: () => void) => void {
  const client = useQueryClient()
  return (submit) => {
    submitOnce(client, mutationKey, submit)
  }
}
```

```bash
pnpm exec vitest run test/unit/queries/submit-once.test.ts 2>&1 | tail -4
```

Expected: `Tests  3 passed (3)`. `submitOnce` 의 `isMutating` 검사를 지우면 첫 시험이 실패한다(둘째 제출이 `true`).

자격증명 폼이 이 가드를 쓴다. `components/form/credentials-form.tsx` — Edit, 찾을 것 `import { useRef, useState, type ReactNode } from 'react'` — 바꿀 것:

```tsx
import type { MutationKey } from '@tanstack/react-query'
import { useRef, useState, type ReactNode } from 'react'
```

같은 파일에 Edit, 찾을 것 `import { cn } from '@/lib/utils'` — 바꿀 것:

```tsx
import { cn } from '@/lib/utils'
import { useSubmitOnce } from '@/queries/submit-once'
```

같은 파일에 Edit, 찾을 것:

```tsx
  state: AuthFormState
  pending: boolean
  onSubmit: (credentials: Credentials) => void
```

바꿀 것:

```tsx
  state: AuthFormState
  pending: boolean
  /** 제출이 부르는 쓰기의 키 - 그 쓰기가 진행 중이면 제출을 버린다(queries/submit-once.ts). */
  mutationKey: MutationKey
  onSubmit: (credentials: Credentials) => void
```

같은 파일에 Edit, 찾을 것:

```tsx
 * 제출 버튼과 같은 제출이다(제출 중에는 무시한다). iOS 는 키보드가 입력을 가리지 않게 스크롤을 조정한다.
```

바꿀 것:

```tsx
 * 제출 버튼과 같은 제출이다. 제출 중에는 둘 다 무시한다 - 렌더 때의 `pending` 이 아니라 쓰기 캐시를 본다
 * (useSubmitOnce): 둘이 한 틱 안에 눌려도 요청은 하나다. iOS 는 키보드가 입력을 가리지 않게 스크롤을 조정한다.
```

같은 파일에 Edit, 찾을 것:

```tsx
  state,
  pending,
  onSubmit,
  footer,
  notice,
}: CredentialsFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const passwordInput = useRef<TextInput>(null)
  const emailErrors = state.fieldErrors[EMAIL_FIELD] ?? []
  const passwordErrors = state.fieldErrors[PASSWORD_FIELD] ?? []

  const submit = () => {
    if (pending) return
    onSubmit({ email, password })
  }
```

바꿀 것:

```tsx
  state,
  pending,
  mutationKey,
  onSubmit,
  footer,
  notice,
}: CredentialsFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const passwordInput = useRef<TextInput>(null)
  const submitOnce = useSubmitOnce(mutationKey)
  const emailErrors = state.fieldErrors[EMAIL_FIELD] ?? []
  const passwordErrors = state.fieldErrors[PASSWORD_FIELD] ?? []

  const submit = () => {
    submitOnce(() => {
      onSubmit({ email, password })
    })
  }
```

가드가 보낸 로그인·가입 화면은 루트에 혼자 남는다 — 돌아갈 곳이 없는 뒤로 가기를 홈으로 보낸다(결정 10, D2 최종 검토 M5). `components/app/back-to-home.ts` 를 만든다:

```ts
import { router } from 'expo-router'
import { useEffect } from 'react'
import { BackHandler } from 'react-native'

/**
 * 뒤로 갈 곳이 없는 화면에서 Android 의 뒤로 가기를 홈으로 돌린다 - 로그인·가입 화면이 쓴다.
 *
 * 경로 가드(app/(app)/_layout.tsx)의 Redirect 는 루트에서 (app) 을 로그인 화면으로 바꿔 끼운다
 * (REPLACE) - 루트에 로그인 화면 하나만 남아, 목록의 "새로 만들기" 나 상세의 "수정" 에서 막힌 사용자가
 * 뒤로 가면 앱이 닫힌다. 그래서 내비게이터가 돌아갈 곳이 없을 때만 홈으로 보낸다. 돌아갈 곳이 있으면
 * (다른 화면 위에 쌓였으면) 손대지 않는다 - 내비게이터가 뒤로 간다.
 *
 * 홈으로 갈 때 (app) 을 새로 만든다 - 로그인 뒤 복귀(login.tsx)와 같은 이유로 withAnchor 를 준다.
 * 이 화면의 핸들러가 내비게이터의 것보다 나중에 걸려 먼저 불린다(BackHandler 는 나중에 건 것부터 부른다).
 */
export function useBackToHome(): void {
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (router.canGoBack()) return false
      router.dismissTo('/', { withAnchor: true })
      return true
    })
    return () => {
      subscription.remove()
    }
  }, [])
}
```

`app/(auth)/login.tsx` — Edit, 찾을 것 `import { CredentialsForm } from '@/components/form/credentials-form'` — 바꿀 것:

```tsx
import { useBackToHome } from '@/components/app/back-to-home'
import { CredentialsForm } from '@/components/form/credentials-form'
```

같은 파일에 Edit, 찾을 것 `import { useLoginMutation } from '@/queries/auth'` — 바꿀 것 `import { LOGIN_MUTATION_KEY, useLoginMutation } from '@/queries/auth'`.

같은 파일에 Edit, 찾을 것:

```tsx
 * 딥링크로 들어온 외부 URL 은 거기서 홈으로 바뀐다.
 */
export default function LoginScreen() {
  const rawNext = useLocalSearchParams()[LOGIN_REDIRECT_PARAM]
  const login = useLoginMutation(rawNext)
  const [state, setState] = useState<AuthFormState>(IDLE_AUTH_FORM_STATE)
```

바꿀 것:

```tsx
 * 딥링크로 들어온 외부 URL 은 거기서 홈으로 바뀐다. 가드가 보낸 이 화면에서 뒤로 가면 홈이다
 * (useBackToHome - 가드가 루트를 이 화면 하나로 바꿔 끼운다).
 */
export default function LoginScreen() {
  const rawNext = useLocalSearchParams()[LOGIN_REDIRECT_PARAM]
  const login = useLoginMutation(rawNext)
  const [state, setState] = useState<AuthFormState>(IDLE_AUTH_FORM_STATE)
  useBackToHome()
```

같은 파일에 Edit, 찾을 것:

```tsx
        pending={login.isPending}
```

바꿀 것:

```tsx
        pending={login.isPending}
        mutationKey={LOGIN_MUTATION_KEY}
```

`app/(auth)/register.tsx` — Edit, 찾을 것 `import { CredentialsForm } from '@/components/form/credentials-form'` — 바꿀 것:

```tsx
import { useBackToHome } from '@/components/app/back-to-home'
import { CredentialsForm } from '@/components/form/credentials-form'
```

같은 파일에 Edit, 찾을 것 `import { useRegisterMutation } from '@/queries/auth'` — 바꿀 것 `import { REGISTER_MUTATION_KEY, useRegisterMutation } from '@/queries/auth'`.

같은 파일에 Edit, 찾을 것:

```tsx
 * 이어받는다 - 로그인 화면에서 "가입하기"로 온 사용자도 가입한 뒤 원래 가려던 곳으로 간다.
 */
export default function RegisterScreen() {
  const rawNext = useLocalSearchParams()[LOGIN_REDIRECT_PARAM]
  const register = useRegisterMutation(rawNext)
  const [state, setState] = useState<AuthFormState>(IDLE_AUTH_FORM_STATE)
```

바꿀 것:

```tsx
 * 이어받는다 - 로그인 화면에서 "가입하기"로 온 사용자도 가입한 뒤 원래 가려던 곳으로 간다. 로그인
 * 화면을 바꿔 끼우고 들어오므로(Link replace) 뒤로 가면 홈이다(useBackToHome).
 */
export default function RegisterScreen() {
  const rawNext = useLocalSearchParams()[LOGIN_REDIRECT_PARAM]
  const register = useRegisterMutation(rawNext)
  const [state, setState] = useState<AuthFormState>(IDLE_AUTH_FORM_STATE)
  useBackToHome()
```

같은 파일에 Edit, 찾을 것:

```tsx
        pending={register.isPending}
```

바꿀 것:

```tsx
        pending={register.isPending}
        mutationKey={REGISTER_MUTATION_KEY}
```

- [ ] **Step 7: 두 번 누름의 이동 가드 — 목록의 행과 조건 바꾸기(M8)**

목록의 행을 빠르게 두 번 누르면 상세가 두 벌 쌓였다(D3 최종 검토 M8). 첫 누름이 잠그고 누른 화면이 다시 앞에 오면 푼다 — 시각으로 풀지 않는다(결정 35). 판단은 `lib/navigation/once.ts`, 화면에 잇는 것은 `components/app/navigate-once.ts` 다. Task 4 의 "새로 만들기"·"수정" 도 이것을 지난다. 시험을 먼저 쓴다.

`test/unit/navigation/once.test.ts` 를 만든다:

```ts
import { describe, expect, it } from 'vitest'

import { createOnce } from '@/lib/navigation/once'

/** 두 번 누름의 이동 가드(D3 최종 검토 M8) - 화면에 잇는 것(초점이 돌아오면 푼다)은 components/app/navigate-once.ts. */
describe('createOnce - 한 번만 도는 이동', () => {
  it('잠긴 동안의 둘째 부름은 버린다 - 이동은 한 번이다', () => {
    const once = createOnce()
    const moves: string[] = []
    expect(
      once.run(() => {
        moves.push('probe-first')
      }),
    ).toBe(true)
    expect(
      once.run(() => {
        moves.push('probe-second')
      }),
    ).toBe(false)
    expect(moves).toEqual(['probe-first'])
  })

  it('풀면 다시 부른다 - 누른 화면이 다시 앞에 왔을 때다', () => {
    const once = createOnce()
    const moves: string[] = []
    once.run(() => {
      moves.push('probe-first')
    })
    once.release()
    expect(
      once.run(() => {
        moves.push('probe-again')
      }),
    ).toBe(true)
    expect(moves).toEqual(['probe-first', 'probe-again'])
  })

  it('이동이 던지면 잠그지 않는다 - 다음 누름이 다시 부른다', () => {
    const once = createOnce()
    expect(() =>
      once.run(() => {
        throw new Error('probe-navigation')
      }),
    ).toThrow('probe-navigation')
    const moves: string[] = []
    expect(
      once.run(() => {
        moves.push('probe-retry')
      }),
    ).toBe(true)
    expect(moves).toEqual(['probe-retry'])
  })
})
```

```bash
pnpm exec vitest run test/unit/navigation/once.test.ts 2>&1 | tail -5
```

Expected: FAIL — `Error: Cannot find package '@/lib/navigation/once'`(파일이 아직 없다).

`lib/navigation/once.ts` 를 만든다:

```ts
/**
 * 한 번만 도는 이동 - 화면을 쌓는 누름(목록의 행·조건 바꾸기·"새로 만들기"·"수정")이 빠르게 두 번 눌리면 같은
 * 화면이 두 벌 쌓였다(D3 최종 검토 M8). 첫 부름이 잠그고, 잠긴 동안의 부름은 버린다.
 *
 * 잠금은 부른 쪽이 푼다 - 화면이면 그 화면이 다시 앞에 왔을 때다(components/app/navigate-once.ts). 시각으로 풀지
 * 않는다: 이동이 끝나는 시각은 기기마다 다르고, 이동한 화면이 앞에 있는 동안에는 누른 화면의 누름이 오지 않는다.
 * 쓰기의 제출은 이것이 아니라 쓰기 캐시가 막는다(queries/submit-once.ts).
 */
export interface Once {
  /** 잠기지 않았으면 잠그고 `action` 을 부른다 - 불렀으면 참. 잠겼으면 버리고 거짓. `action` 이 던지면 잠그지 않는다. */
  readonly run: (action: () => void) => boolean
  /** 잠금을 푼다. */
  readonly release: () => void
}

export function createOnce(): Once {
  let locked = false
  return {
    run: (action) => {
      if (locked) return false
      locked = true
      try {
        action()
      } catch (error) {
        locked = false
        throw error
      }
      return true
    },
    release: () => {
      locked = false
    },
  }
}
```

`components/app/navigate-once.ts` 를 만든다:

```ts
import { useIsFocused } from 'expo-router'
import { useEffect, useState } from 'react'

import { createOnce } from '@/lib/navigation/once'

/**
 * 화면을 쌓는 이동을 한 번만 한다(D3 최종 검토 M8) - 목록의 행·조건 바꾸기·"새로 만들기"·"수정" 을 빠르게 두 번
 * 누르면 같은 화면이 두 벌 쌓였다. 첫 누름이 잠그고(lib/navigation/once.ts), 이 화면이 다시 앞에 오면 푼다
 * (`useIsFocused`). 쓰기의 제출은 이것이 아니라 `useSubmitOnce`(queries/submit-once.ts)가 막는다.
 *
 * 이동이 이 화면을 뒤로 보내지 않으면 잠금이 남는다 - 이 저장소의 이동은 모두 다른 화면을 쌓거나(push) 이 화면을
 * 떼므로(보호 경로면 경로 가드가 앱 셸을 로그인 화면으로 바꿔 끼운다) 그런 이동이 없다.
 */
export function useNavigateOnce(): (navigate: () => void) => void {
  const [once] = useState(createOnce)
  const focused = useIsFocused()

  useEffect(() => {
    if (focused) once.release()
  }, [focused, once])

  return (navigate) => {
    once.run(navigate)
  }
}
```

`app/(app)/examples/index.tsx` — Edit, 찾을 것 `import { FilterSheet } from '@/components/resource/filter-sheet'` — 바꿀 것:

```tsx
import { useNavigateOnce } from '@/components/app/navigate-once'
import { FilterSheet } from '@/components/resource/filter-sheet'
```

같은 파일에 Edit, 찾을 것:

```tsx
  const options = sortOptions(EXAMPLE, LIST_PATH, params)
```

바꿀 것:

```tsx
  const options = sortOptions(EXAMPLE, LIST_PATH, params)
  // 화면을 쌓는 이동(행·조건 바꾸기·새로 만들기)은 한 번만 한다 - 빠른 두 번 누름이 같은 화면을 두 벌 쌓지
  // 않게(components/app/navigate-once.ts).
  const navigateOnce = useNavigateOnce()
```

같은 파일에 Edit, 찾을 것:

```tsx
    const target = href as Href
    router.push(target)
  }
```

바꿀 것:

```tsx
    const target = href as Href
    navigateOnce(() => {
      router.push(target)
    })
  }
```

같은 파일에 Edit, 찾을 것:

```tsx
        onOpen={(id) => {
          router.push({ pathname: '/examples/[id]', params: { id } })
        }}
```

바꿀 것:

```tsx
        onOpen={(id) => {
          navigateOnce(() => {
            router.push({ pathname: '/examples/[id]', params: { id } })
          })
        }}
```

`lib/navigation/AGENTS.md` — Edit, 찾을 것:

```markdown
밖에서 들어온 URL·딥링크를 앱 안 주소로 바꾸는 판단을 둔다(루트 `AGENTS.md` 의 계층 표).
```

바꿀 것:

```markdown
앱 안의 이동에 대한 판단을 둔다(루트 `AGENTS.md` 의 계층 표) - 밖에서 들어온 URL·딥링크를 앱 안 주소로 바꾸는
것(`deep-link.ts`)과 화면을 쌓는 이동을 한 번만 하는 가드(`once.ts`, 아래 절).
```

`lib/navigation/AGENTS.md` — Edit, 찾을 것:

```markdown
동작이 바뀌면 그 시험이 먼저 실패한다. 기기에서는 E2E `examples-browse` 가 잰다.
```

바꿀 것:

```markdown
동작이 바뀌면 그 시험이 먼저 실패한다. 기기에서는 E2E `examples-browse` 가 잰다.

## 두 번 누름의 이동 가드

`once.ts` 의 `createOnce` 는 첫 부름이 잠그고 잠긴 동안의 부름을 버린다 - 목록의 행·조건 바꾸기·"새로 만들기"·
"수정" 을 빠르게 두 번 누르면 같은 화면이 두 벌 쌓였다. 화면에 잇는 것은 `components/app/navigate-once.ts` 의
`useNavigateOnce` 다 - 누른 화면이 다시 앞에 오면(`useIsFocused`) 푼다. 시각으로 풀지 않는다. 화면을 쌓는 새 이동도
이것을 지난다. 쓰기의 제출은 쓰기 캐시가 막는다(`queries/submit-once.ts`). 시험은 `test/unit/navigation/once.test.ts`.
```

```bash
pnpm exec vitest run test/unit/navigation/once.test.ts 2>&1 | tail -4
pnpm typecheck
```

Expected: `Tests  3 passed (3)`, typecheck exit 0.

- [ ] **Step 8: 문서와 스펙 정정을 쓴다**

`lib/auth/AGENTS.md` — Edit, 찾을 것:

```markdown
- 401 에 회전·재시도를 붙이지 않는다. 인증 오류를 받으면 `signOut()`하고 로그인으로 보낸다.
```

바꿀 것:

```markdown
- 401 에 회전·재시도를 붙이지 않는다. 인증 오류를 받으면 `signOut()`하고 로그인으로 보낸다.
- 회전 응답의 5xx·408·429 는 세션을 건드리지 않는다 - 상태 0(닿지 못함)과 같다. 백엔드가 토큰을 판정하지 않은
  응답이다. 나머지 4xx 는 세션을 지운다(`rotation.ts` 의 `interpretRotationOutcome`, 스펙 7.2 의 D4 정정).
```

`lib/auth/AGENTS.md` — Edit, 찾을 것(파일 표의 `protected-paths.ts` 행 - 칸 맞춤 공백 앞까지):

```markdown
보호 경로 목록 하나와 로그인 주소
```

바꿀 것:

```markdown
보호 경로 목록 하나와 로그인 주소, 앱 셸이 대조할 라우트 모양(`routePattern`)
```

`queries/AGENTS.md` — Edit, 찾을 것(표의 `auth.ts` 행 - 칸 맞춤 공백 앞까지):

```markdown
세션을 세우는 데까지, 화면 이동은 화면이 한다
```

바꿀 것:

```markdown
세션을 세우는 데까지, 화면 이동은 화면이 한다. 로그인·가입의 옵션(`loginMutationOptions`·`registerMutationOptions`)과 키를 내보낸다 - 시험이 MutationObserver 로 돌린다
```

`queries/AGENTS.md` — Edit, 찾을 것(표의 마지막 행 `resource-options.ts` 의 끝 문장 - 그 뒤에 행 하나를 잇는다. 칸 맞춤은 Step 9 의 `pnpm format` 이 한다):

```markdown
시험이 가짜 요청과 실제 `QueryClient` 로 전이를 잰다
```

바꿀 것:

```markdown
시험이 가짜 요청과 실제 `QueryClient` 로 전이를 잰다 |
| `submit-once.ts` | 제출 한 번 가드(`submitOnce`·`useSubmitOnce`) - 폼이 부를 쓰기의 키가 진행 중이면 그 제출을 버린다
```

`queries/AGENTS.md` — Edit, 찾을 것:

```markdown
- 자동 재시도는 `platform/query-client.ts`가 끈다.
```

바꿀 것:

```markdown
- 자동 재시도는 `platform/query-client.ts`가 끈다.
- 폼의 제출은 `useSubmitOnce(쓰기의 키)`로 감싼다 - 제출 버튼과 키보드의 이동 키가 한 틱 안에 함께 눌려도 요청은
  하나다. 렌더 때의 `isPending`으로 막지 않는다 - 둘째 누름도 같은 렌더를 본다(`submit-once.ts` 머리말). 그래서 폼을
  부르는 쓰기 훅에는 `mutationKey`가 있다.
```

스펙 — 7.2 의 끝, `### 7.3 가드는 두 겹` 바로 앞에 더한다:

```markdown
> 정정(2026-10-01, D4): 회전 응답의 5xx·408·429 는 "닿지 못함"처럼 세션을 건드리지 않는다 - 백엔드(나 그 앞의
> 프록시)가 응답은 했지만 refresh token 을 판정하지 않은 것이라 위 표의 "인증 거절"이 아니다. 원본의
> `interpretRotationOutcome` 은 상태 0 이 아닌 실패를 전부 파기로 모아, 30일 세션이 회전 순간의 502 하나로 끝났다
> (`lib/auth/rotation.ts` 의 이탈 기록). 나머지 4xx 는 그대로 파기한다. 대가: 서버가 회전을 마친 뒤 5xx 를 냈다면
> 앱은 옛 refresh 를 들고 있다가 다음 회전에서 재사용 감지에 걸려 그 사용자의 세션이 전부 끊긴다 - 7.5 의 첫
> 한계와 같은 모양이다. 틈도 하나 남는다: access 가 이미 만료된 채 회전이 5xx 를 받으면 그 access 로 나간 쓰기가
> 401 을 받아 세션을 지운다 - refresh 만 5xx 이고 쓰기 라우트는 살아 있는 부분 장애에서만이다. 회전은 쓰기(D4)가
> 처음 부른다 - E2E 는 백엔드의 access 수명을 10초로 줘서 쓰기마다 실제 회전을 지난다(11.3 의 D4 정정).
```

스펙 — 7.3 의 끝, `### 7.4 화면 흐름` 바로 앞에 더한다:

```markdown
> 정정(2026-10-01, D4): 경로 가드가 보호 경로와 대조하는 것은 `usePathname()` 이 아니라 라우트 모양이다 -
> `useSegments()` 에서 그룹을 뺀 `/examples/[id]/edit`(`lib/auth/protected-paths.ts` 의 `routePattern`).
> `usePathname()` 은 파라미터 값을 풀어 경로를 다시 만들어, id 에 `/` 가 들면(`/examples/a%2Fb/edit`) 보호 경로를
> 벗어났다. `next` 로 싣는 것은 그대로 `usePathname()` 이다. 가드의 `<Redirect>` 는 루트에서 `(app)` 을 로그인
> 화면으로 바꿔 끼워 루트에 그 화면 하나만 남긴다 - 앱 안의 "새로 만들기"·"수정" 에서 막힌 사용자가 뒤로 가면 앱이
> 닫혔다. 로그인·가입 화면은 돌아갈 곳이 없을 때의 뒤로 가기를 홈으로 보낸다(`components/app/back-to-home.ts`).
```

- [ ] **Step 9: 정적 검사를 돌리고 커밋한다**

```bash
pnpm format
pnpm typecheck && pnpm lint && pnpm format:check && pnpm lint:secrets
./scripts/check-citations.sh app components lib platform queries test
pnpm test 2>&1 | grep -E "Test Files|Tests "
git add lib/auth lib/navigation app components/app components/form queries test/unit/auth test/unit/queries test/unit/navigation docs/provenance/copied-core.json docs/superpowers/specs
git status --short
git commit -m "fix: 회전의 5xx 가 세션을 지우지 않게 하고 보호 판정·로그인 화면의 뒤로 가기·두 번 제출을 바로잡는다"
```

Expected: 검사 전부 exit 0(`pnpm format` 이 `queries/AGENTS.md` 의 표 칸을 새 행에 맞춰 넓힌다), `Tests  1279 passed (1279)`(Task 1 의 1250 + 29, 56 파일 - 회전 11·보호 경로 8·제출 한 번 3·세우기 거절 4·이동 가드 3), 남은 파일이 없다.

### Task 3: 쓰기 훅, 관계 참조 목록, 인증 오류의 한 곳

**Files:**
- Create: `queries/writes.ts`, `test/unit/platform/query-client.test.ts`, `test/unit/queries/reference-options.test.ts`
- Modify: `queries/keys.ts`(`mutationKeys`), `test/unit/queries/keys.test.ts`, `queries/resource-options.ts`(`referenceQueryOptions`), `queries/resources.ts`(상세의 `result`·`enabled`, `useRelationshipReferences`, 화면 조회의 `subscribed` - M2), `platform/query-client.ts`(`MutationCache.onError`), `platform/AGENTS.md`, `queries/AGENTS.md`, 스펙 8.5·9 정정

**Interfaces:**
- Consumes: Task 1 의 `createResource`·`updateResource`·`deleteResource`·`WriteDeps`·`isSessionRejected`(`lib/resources/write.ts`), `IDLE_RESOURCE_FORM_STATE`·`ResourceFormState`·`ResourceFormValues`·`relationshipTargets`(`lib/resources/form.ts`), `referenceState`·`ReferenceState`·`canLoadMore`(`lib/resources/screen-state.ts`, Task 1), D3 의 `queryKeys`·`cacheEffects`·`applyCacheEffects`(`queries/keys.ts`)·`listQueryOptions`·`detailQueryOptions`(`queries/resource-options.ts`)·`throwIfUnreachable`·`detailScreen`(`lib/resources/screen-state.ts`)·`referenceRequest`(`lib/resources/view.ts`), `useIsFocused`(`expo-router`), `apiRequest`(`platform/api.ts`), `sessionManager`(`platform/session.ts`)
- Produces:
  - `queries/keys.ts`: `mutationKeys.create(type)`·`.update(type, id)`·`.delete(type, id)`(`['resources', type, 'create'|'update'|'delete', id?]`)
  - `queries/writes.ts`: `interface FormWrite { mutationKey: MutationKey; state: ResourceFormState; pending: boolean; submit: (values, onSaved: (id: string) => void) => void }`, `interface EditWrite extends FormWrite { gone: boolean }`, `interface DeleteWrite { mutationKey; messages: readonly string[]; pending; deleted: boolean; remove: (onDeleted: () => void) => void }`, `useCreateResource(resource): FormWrite`, `useUpdateResource(resource, id): EditWrite`, `useDeleteResource(resource, id): DeleteWrite`
  - `queries/resource-options.ts`: `referenceQueryOptions(target, send)` - 키 `queryKeys.list(target.type, referenceRequest(target).query.toString())`, `queryFn` 이 닿지 못함을 던진다
  - `queries/resources.ts`: `ResourceDetailState` 의 `{ screen, result: JsonApiResult<SingleDocument> | null, retrying, retry }`, `useResourceDetail(resource, id, { enabled?: boolean } = {})`, `interface RelationshipReference extends ReferenceState { retrying; retry; writable }`(곧 `{ list, failure, retrying, retry, writable }`), `useRelationshipReferences(resource): Readonly<Record<string, RelationshipReference>>`. 세 훅과 `useResourceList` 가 `subscribed: useIsFocused()` 를 준다
  - `platform/query-client.ts`: `queryClient` 의 `MutationCache.onError` — `isSessionRejected(error)` 이면 `sessionManager.signOut()`(거절은 로그)

- [ ] **Step 1: 자원 쓰기의 키 — 시험을 먼저 더한다**

쓰기의 키는 조회 캐시의 키와 따로다. 수정·삭제는 id 까지 좁힌다 — 키 필터는 앞 조각 일치라 그래야 다른 자원의 쓰기를 막지 않는다(결정 22).

`test/unit/queries/keys.test.ts` — Edit, 찾을 것:

```ts
import {
  applyCacheEffects,
  cacheEffects,
  queryKeys,
  type CacheEffect,
  type CacheWrite,
} from '@/queries/keys'
```

바꿀 것:

```ts
import {
  applyCacheEffects,
  cacheEffects,
  mutationKeys,
  queryKeys,
  type CacheEffect,
  type CacheWrite,
} from '@/queries/keys'
```

(`MutationObserver` 는 D3 의 시험이 이미 import 한다 — 첫 줄이 `import { MutationObserver, QueryClient } from '@tanstack/react-query'` 인지 본다.)

같은 파일에 Edit, 찾을 것:

```ts
  it('목록과 상세는 자원 type 이 같아도 겹치지 않는다', () => {
    expect(queryKeys.detail(TYPE, 'list')).not.toEqual(queryKeys.lists(TYPE))
  })
})
```

바꿀 것:

```ts
  it('목록과 상세는 자원 type 이 같아도 겹치지 않는다', () => {
    expect(queryKeys.detail(TYPE, 'list')).not.toEqual(queryKeys.lists(TYPE))
  })
})

describe('mutationKeys — 진행 중인 쓰기를 찾는 키', () => {
  const client = new QueryClient()

  afterEach(() => {
    client.clear()
  })

  it('진행 중인 수정은 그 id 의 키로만 찾힌다 - 앞 조각이 같은 다른 id·생성·삭제로는 찾히지 않는다', async () => {
    let finish: () => void = () => undefined
    const gate = new Promise<void>((resolve) => {
      finish = resolve
    })
    const running = new MutationObserver(client, {
      mutationKey: mutationKeys.update(TYPE, 'probe-1'),
      mutationFn: () => gate,
    }).mutate()

    expect(client.isMutating({ mutationKey: mutationKeys.update(TYPE, 'probe-1') })).toBe(1)
    expect(client.isMutating({ mutationKey: mutationKeys.update(TYPE, 'probe-10') })).toBe(0)
    expect(client.isMutating({ mutationKey: mutationKeys.delete(TYPE, 'probe-1') })).toBe(0)
    expect(client.isMutating({ mutationKey: mutationKeys.create(TYPE) })).toBe(0)
    finish()
    await running
  })
})
```

```bash
pnpm exec vitest run test/unit/queries/keys.test.ts 2>&1 | tail -4
```

Expected: FAIL — `Tests  1 failed | 13 passed (14)`(`mutationKeys` 가 없다 - 실패는 새 시험 하나다).

`queries/keys.ts` — Edit, 찾을 것:

```ts
  /** 상세 하나. */
  detail: (type: string, id: string) => [RESOURCES_KEY, type, 'detail', id] as const,
}
```

바꿀 것:

```ts
  /** 상세 하나. */
  detail: (type: string, id: string) => [RESOURCES_KEY, type, 'detail', id] as const,
}

/**
 * 자원 쓰기의 키 - 조회 캐시의 키가 아니다(쓰기 캐시는 따로다). 폼이 같은 쓰기가 진행 중인지 렌더를 거치지
 * 않고 볼 때 쓴다(queries/submit-once.ts). 수정·삭제는 id 까지 좁힌다.
 */
export const mutationKeys = {
  create: (type: string) => [RESOURCES_KEY, type, 'create'] as const,
  update: (type: string, id: string) => [RESOURCES_KEY, type, 'update', id] as const,
  delete: (type: string, id: string) => [RESOURCES_KEY, type, 'delete', id] as const,
}
```

같은 파일에 Edit, 찾을 것 `/** 캐시를 바꾸는 쓰기 - 스펙 8.5 의 표의 행이다. 생성·수정·삭제의 호출부는 D4 가 만든다. */` — 바꿀 것:

```ts
/**
 * 캐시를 바꾸는 쓰기 - 스펙 8.5 의 표의 행이다. 호출부는 `queries/writes.ts`(생성·수정·삭제)와
 * `queries/auth.ts`(로그아웃)다.
 */
```

```bash
pnpm exec vitest run test/unit/queries/keys.test.ts 2>&1 | tail -4
```

Expected: `Tests  14 passed (14)`.

- [ ] **Step 2: 인증 오류의 한 곳 — 쓰기 캐시의 `onError`**

쓰기 흐름이 던진 세션 거절을 받아 기기 세션을 지운다(결정 4·5). 이동은 경로 가드가 한다. `signOut()` 의 거절은 이름과 문구만 남긴다(결정 14). 이 배선이 빠지면 판정(`isSessionRejected`)의 시험은 모두 통과하는데 세션 거절을 받은 쓰기 화면이 그대로 남는다 — 그래서 실제 쓰기 캐시로 잰다.

`test/unit/platform/query-client.test.ts` 를 만든다:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { sessionRejected } from '@/lib/resources/write'
import { queryClient } from '@/platform/query-client'

/**
 * platform/query-client.ts 의 인증 오류 처리 - 스펙 9.2 의 "한 곳". 쓰기 흐름(lib/resources/write.ts)이
 * 세션 거절을 던지면 쓰기 캐시의 onError 가 기기 세션을 지운다. 판정(isSessionRejected)은 write.test.ts
 * 가 재고, 여기서는 그 판정이 세션 관리자에 **이어져 있는지**를 잰다 - 이 배선이 빠지면 판정의 시험은
 * 모두 통과하는데 세션 거절을 받은 쓰기 화면이 그대로 남는다.
 *
 * 기기 모듈(react-native·NetInfo)과 세션 관리자는 가짜로 바꾼다. Query 캐시와 쓰기는 진짜다.
 */
const mocks = vi.hoisted(() => ({ signOut: vi.fn<() => Promise<void>>() }))

vi.mock('react-native', () => ({ AppState: { addEventListener: vi.fn() } }))
vi.mock('@react-native-community/netinfo', () => ({ default: { addEventListener: vi.fn() } }))
vi.mock('@/platform/session', () => ({ sessionManager: { signOut: mocks.signOut } }))

/** 쓰기 하나를 진짜 쓰기 캐시로 돌린다 - 실패는 삼킨다(onError 가 불렸는지만 본다). */
async function runWrite(mutationFn: () => Promise<unknown>): Promise<void> {
  const mutation = queryClient.getMutationCache().build(queryClient, { mutationFn })
  await mutation.execute(undefined).catch(() => undefined)
}

beforeEach(() => {
  mocks.signOut.mockReset().mockResolvedValue()
})

afterEach(() => {
  queryClient.clear()
  vi.restoreAllMocks()
})

describe('queryClient 의 쓰기 캐시 - 인증 오류 처리(스펙 9.2)', () => {
  it('쓰기가 세션 거절을 던지면 기기 세션을 지운다', async () => {
    await runWrite(() => Promise.reject(sessionRejected()))
    expect(mocks.signOut).toHaveBeenCalledTimes(1)
  })

  it('다른 실패와 성공에는 세션을 건드리지 않는다', async () => {
    await runWrite(() => Promise.reject(new Error('probe-failure')))
    await runWrite(() => Promise.resolve('probe-success'))
    expect(mocks.signOut).not.toHaveBeenCalled()
  })

  it('세션을 지우다 저장소가 실패해도 던지지 않고 이름과 문구만 기기 로그에 남긴다', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    mocks.signOut.mockRejectedValue(new Error('probe-storage'))
    await runWrite(() => Promise.reject(sessionRejected()))
    await vi.waitFor(() => {
      expect(logged).toHaveBeenCalledTimes(1)
    })
    expect(String(logged.mock.calls[0]?.[0])).toContain('Error: probe-storage')
  })
})
```

```bash
pnpm exec vitest run test/unit/platform/query-client.test.ts 2>&1 | tail -4
```

Expected: FAIL — `Tests  2 failed | 1 passed (3)`(`signOut` 이 불리지 않는다. "다른 실패와 성공에는 세션을 건드리지 않는다" 는 지금도 통과한다).

`platform/query-client.ts` — Edit, 찾을 것:

```ts
import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { AppState } from 'react-native'
```

바꿀 것:

```ts
import { focusManager, MutationCache, onlineManager, QueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { AppState } from 'react-native'

import { isSessionRejected } from '@/lib/resources/write'
import { sessionManager } from '@/platform/session'
```

같은 파일에 Edit, 찾을 것:

```ts
 * 연결이 돌아오면 다시 부르는 것(refetchOnReconnect)은 이 모드의 기본값 그대로 켜져 있다.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
```

바꿀 것:

```ts
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
```

같은 파일에 Edit, 찾을 것:

```ts
    mutations: { retry: false, networkMode: 'offlineFirst' },
  },
})
```

바꿀 것:

```ts
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
```

```bash
pnpm exec vitest run test/unit/platform 2>&1 | tail -4
```

Expected: `test/unit/platform` 전부 PASS(`query-client.test.ts` 3, D2 의 `api.test.ts` 14).

- [ ] **Step 3: 쓰기 훅**

훅은 `write.ts` 의 흐름에 세션 관리자·API 클라이언트를 꽂고, 성공한 쓰기를 D3 의 무효화 표에 태운다(키를 손으로 적지 않는다). 훅 옵션의 `onSuccess` 가 캐시를 바꾸고, `mutate()` 에 넘긴 콜백이 그 뒤에 화면을 옮긴다. 삭제의 `deleted` 는 수정 화면이 상세 조회를 끄는 데 쓴다(결정 8).

`queries/writes.ts` 를 만든다:

```ts
import { useMutation, useQueryClient, type MutationKey } from '@tanstack/react-query'

import type { ResourceDefinition } from '@/lib/resources/define'
import {
  IDLE_RESOURCE_FORM_STATE,
  type ResourceFormState,
  type ResourceFormValues,
} from '@/lib/resources/form'
import {
  createResource,
  deleteResource,
  updateResource,
  type WriteDeps,
} from '@/lib/resources/write'
import { apiRequest } from '@/platform/api'
import { sessionManager } from '@/platform/session'
import { applyCacheEffects, cacheEffects, mutationKeys } from '@/queries/keys'

/**
 * 자원의 쓰기 훅 - 생성·수정·삭제(스펙 8.4·8.5).
 *
 * 한 번의 쓰기가 지나는 갈래(세션 확인 → 요청 → 응답 해석)는 `lib/resources/write.ts` 가 정한다.
 * 여기서는 그 함수에 세션 관리자와 API 클라이언트를 꽂고, 성공한 쓰기를 무효화 표(`keys.ts`)에
 * 태우기만 한다 - 키를 손으로 적지 않는다.
 *
 * - access token 은 `sessionManager.getAccessToken()` 에서 받는다 - 회전은 그 안에서만 일어난다
 *   (스펙 7.2). 그 거절은 `write.ts` 가 잡아 앱 문구로 그린다.
 * - 세션 거절은 `write.ts` 가 던지고 Query 캐시의 `onError` 한 곳이 받는다(스펙 9.2,
 *   `platform/query-client.ts`). 이 훅들은 그 경우를 따로 다루지 않는다 - 쓰기 화면은 보호 경로라
 *   세션이 지워지면 경로 가드가 로그인으로 보낸다.
 * - 화면 이동은 화면이 한다 - 제출 함수가 성공 콜백을 받는다. 캐시는 화면이 이동하기 전에 이 훅이
 *   바꾼다(훅 옵션의 `onSuccess` 가 `mutate()` 에 넘긴 콜백보다 먼저 불린다).
 * - 쓰기마다 `mutationKey` 가 있다(`keys.ts` 의 `mutationKeys`) - 폼이 그 키로 제출을 한 번에 하나로
 *   막는다(`queries/submit-once.ts`).
 */
const WRITE_DEPS: WriteDeps = {
  getAccessToken: sessionManager.getAccessToken,
  send: apiRequest,
}

/** 생성·수정 폼이 쓰는 것. */
export interface FormWrite {
  /** 이 쓰기의 키 - 폼이 제출을 한 번에 하나로 막는다(useSubmitOnce). */
  mutationKey: MutationKey
  /** 폼이 그릴 오류 상태 - 제출 전이거나 성공했으면 비어 있다. */
  state: ResourceFormState
  /** 제출 중 - 제출 버튼이 스피너만 그린다(스펙 8.7). */
  pending: boolean
  submit: (values: ResourceFormValues, onSaved: (id: string) => void) => void
}

/** 수정 폼이 쓰는 것 - 생성에 더해, 저장이 "그 자원이 없다" 를 받았는지. */
export interface EditWrite extends FormWrite {
  gone: boolean
}

/** 삭제가 쓰는 것. */
export interface DeleteWrite {
  mutationKey: MutationKey
  /** 삭제가 실패했을 때 그릴 문구 - 없으면 빈 배열이다. */
  messages: readonly string[]
  pending: boolean
  /**
   * 지웠다(이미 없었어도). 화면은 이 자원의 상세를 다시 부르지 않는다 - 삭제가 캐시에서 지운 상세를
   * 지켜보던 화면이 다시 그려지면 TanStack Query 가 새 조회를 만들어 없는 자원을 부른다(404).
   */
  deleted: boolean
  remove: (onDeleted: () => void) => void
}

/** 생성 - 성공하면 그 자원의 목록을 무효화한다(스펙 8.5 의 표). */
export function useCreateResource(resource: ResourceDefinition): FormWrite {
  const queryClient = useQueryClient()
  const mutationKey = mutationKeys.create(resource.type)
  const mutation = useMutation({
    mutationKey,
    mutationFn: (values: ResourceFormValues) => createResource(resource, values, WRITE_DEPS),
    onSuccess: (outcome) => {
      if (outcome.kind === 'saved') {
        applyCacheEffects(queryClient, cacheEffects({ kind: 'create', type: resource.type }))
      }
    },
  })

  return {
    mutationKey,
    state: mutation.data?.kind === 'failed' ? mutation.data.state : IDLE_RESOURCE_FORM_STATE,
    pending: mutation.isPending,
    submit: (values, onSaved) => {
      mutation.mutate(values, {
        onSuccess: (outcome) => {
          if (outcome.kind === 'saved') onSaved(outcome.id)
        },
      })
    },
  }
}

/**
 * 수정 - 성공하면 그 상세와 목록을 무효화한다(스펙 8.5 의 표). 저장이 "그 자원이 없다" 를 받아도
 * 같은 둘을 무효화한다 - 밑에 깔린 상세 화면과 목록이 없어진 자원을 계속 그리지 않게 한다.
 */
export function useUpdateResource(resource: ResourceDefinition, id: string): EditWrite {
  const queryClient = useQueryClient()
  const mutationKey = mutationKeys.update(resource.type, id)
  const mutation = useMutation({
    mutationKey,
    mutationFn: (values: ResourceFormValues) => updateResource(resource, id, values, WRITE_DEPS),
    onSuccess: (outcome) => {
      if (outcome.kind !== 'failed') {
        applyCacheEffects(queryClient, cacheEffects({ kind: 'update', type: resource.type, id }))
      }
    },
  })

  return {
    mutationKey,
    state: mutation.data?.kind === 'failed' ? mutation.data.state : IDLE_RESOURCE_FORM_STATE,
    pending: mutation.isPending,
    gone: mutation.data?.kind === 'notFound',
    submit: (values, onSaved) => {
      mutation.mutate(values, {
        onSuccess: (outcome) => {
          if (outcome.kind === 'saved') onSaved(outcome.id)
        },
      })
    },
  }
}

/**
 * 삭제 - 성공하면(이미 없어도) 그 상세를 캐시에서 지우고 목록을 무효화한다(스펙 8.5 의 표). 상세를
 * 무효화하지 않고 지우는 것은 무효화하면 없는 자원의 404 를 다시 받으러 가기 때문이다.
 */
export function useDeleteResource(resource: ResourceDefinition, id: string): DeleteWrite {
  const queryClient = useQueryClient()
  const mutationKey = mutationKeys.delete(resource.type, id)
  const mutation = useMutation({
    mutationKey,
    mutationFn: () => deleteResource(resource, id, WRITE_DEPS),
    onSuccess: (outcome) => {
      if (outcome.kind === 'deleted') {
        applyCacheEffects(queryClient, cacheEffects({ kind: 'delete', type: resource.type, id }))
      }
    },
  })

  return {
    mutationKey,
    messages: mutation.data?.kind === 'failed' ? mutation.data.messages : [],
    pending: mutation.isPending,
    deleted: mutation.data?.kind === 'deleted',
    remove: (onDeleted) => {
      mutation.mutate(undefined, {
        onSuccess: (outcome) => {
          if (outcome.kind === 'deleted') onDeleted()
        },
      })
    },
  }
}
```

- [ ] **Step 4: 관계 참조 목록의 조회, 상세의 응답·`enabled`, 쌓인 화면의 구독(M2)**

관계 선택기는 관계마다 대상 자원의 첫 쪽(이름 순 100건)을 받는다 — 관계는 선언에서 온다(`relationshipTargets`). 참조 조회도 목록·상세처럼 닿지 못함을 던진다 — 재조회가 닿지 못해도 읽은 보기를 둔다(Task 1 의 `referenceState`, 결정 36). 수정 폼의 첫 값은 상세와 같은 응답에서 읽는다(`initialFormValues` - 화면 상태에는 enum 원값과 관계 id 가 없다). 화면의 조회는 모두 `subscribed: useIsFocused()` 를 준다 — 쌓인 화면은 앱 복귀·네트워크 복귀·무효화의 재조회를 부르지 않고, 다시 앞에 오면 다시 구독하며 부른다(D3 최종 검토 M2, 결정 39). 시험을 먼저 쓴다.

`test/unit/queries/reference-options.test.ts` 를 만든다:

```ts
import { QueryClient, QueryObserver, focusManager, onlineManager } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { JsonApiResult, RequestOptions } from '@/lib/jsonapi/client'
import type { CollectionDocument, ErrorObject } from '@/lib/jsonapi/document'
import { defineResource } from '@/lib/resources/define'
import { referenceState } from '@/lib/resources/screen-state'
import { referenceRequest } from '@/lib/resources/view'
import { queryKeys } from '@/queries/keys'
import { referenceQueryOptions } from '@/queries/resource-options'

/**
 * 관계 선택기의 참조 목록이 닿지 못했다가 돌아오는 전이 - 실제 QueryClient 로 잰다(test/unit/queries/
 * resource-options.test.ts 와 같은 길, 옵션도 앱의 것과 같다: staleTime 0, 재시도 없음, offlineFirst). 선택기가 그릴
 * 것은 `referenceState`(lib/resources/screen-state.ts)가 Query 의 결과에서 정한다 - queries/resources.ts 의
 * `useRelationshipReferences` 가 하는 것과 같은 호출이다.
 */
const PROBE_LABEL = defineResource({
  type: 'probeLabels',
  path: '/probe/api/labels',
  attributes: {
    probeName: {
      kind: 'string',
      label: 'PROBE 이름',
      readOnly: false,
      nullable: false,
      listed: true,
    },
  },
  relationships: {},
  filters: {},
  sorts: ['probeName'],
  defaultSort: 'probeName',
  includes: [],
  writable: false,
})

const TRANSPORT: ErrorObject = {
  status: '0',
  code: 'PROBE_TRANSPORT',
  detail: 'PROBE 전송 실패',
  meta: { synthetic: true },
}

const LOADED = { options: [{ id: 'probe-l1', label: 'PROBE 라벨 하나' }], truncated: false }

/** 가짜 백엔드 - `online` 이 거짓이면 client.ts 처럼 합성 오류(transport)를 값으로 돌려준다. */
function probeBackend() {
  const state = { online: true, calls: 0, path: '', query: '' }
  const send = <T>(path: string, options?: RequestOptions): Promise<JsonApiResult<T>> => {
    state.calls += 1
    state.path = path
    state.query = options?.query?.toString() ?? ''
    if (!state.online) return Promise.resolve({ ok: false, status: 0, errors: [TRANSPORT] })
    const document: CollectionDocument = {
      data: [{ type: 'probeLabels', id: 'probe-l1', attributes: { probeName: 'PROBE 라벨 하나' } }],
      links: { next: null },
    }
    return Promise.resolve({ ok: true, status: 200, document: document as T })
  }
  return { state, send }
}

let client: QueryClient

beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { queries: { staleTime: 0, retry: false, networkMode: 'offlineFirst' } },
  })
  client.mount()
})

afterEach(() => {
  client.unmount()
  client.clear()
  // 전역이다 - 다음 시험에 남기지 않는다.
  onlineManager.setOnline(true)
  focusManager.setFocused(undefined)
})

/** `trigger` 가 일으킨 조회의 결과(성공이든 실패든)가 캐시에 들 때까지 기다린다 - resource-options.test.ts 와 같다. */
async function nextResult(queryKey: readonly unknown[], trigger: () => void) {
  const state = () => client.getQueryCache().find({ queryKey })?.state
  const count = () => (state()?.dataUpdateCount ?? 0) + (state()?.errorUpdateCount ?? 0)
  const before = count()
  trigger()
  await vi.waitFor(() => {
    if (count() === before || state()?.fetchStatus !== 'idle') throw new Error('아직 부르는 중')
  })
}

async function referenceObserver(send: ReturnType<typeof probeBackend>['send']) {
  const options = referenceQueryOptions(PROBE_LABEL, send)
  const observer = new QueryObserver(client, options)
  let unsubscribe = () => undefined as void
  await nextResult(options.queryKey, () => {
    unsubscribe = observer.subscribe(() => undefined)
  })
  const state = () => {
    const result = observer.getCurrentResult()
    return referenceState(PROBE_LABEL, { result: result.data, error: result.error })
  }
  return { observer, key: options.queryKey, unsubscribe: () => unsubscribe(), state }
}

describe('referenceQueryOptions - 관계 선택기의 참조 목록', () => {
  it('대상 자원의 목록 키로 참조 요청(이름 순 첫 100건)을 보낸다', async () => {
    const backend = probeBackend()
    const plan = referenceRequest(PROBE_LABEL)
    const { key, unsubscribe, state } = await referenceObserver(backend.send)
    expect(key).toEqual(queryKeys.list('probeLabels', plan.query.toString()))
    expect(backend.state.path).toBe('/probe/api/labels')
    expect(backend.state.query).toBe(plan.query.toString())
    expect(state()).toEqual({ list: LOADED, failure: null })
    unsubscribe()
  })

  it('오프라인 앱 복귀의 재조회가 닿지 못해도 읽은 보기를 둔다 - 연결이 돌아오면 다시 읽는다', async () => {
    const backend = probeBackend()
    const { key, unsubscribe, state } = await referenceObserver(backend.send)

    backend.state.online = false
    onlineManager.setOnline(false)
    focusManager.setFocused(false)
    await nextResult(key, () => {
      focusManager.setFocused(true)
    })
    expect(backend.state.calls).toBe(2)
    expect(state()).toEqual({ list: LOADED, failure: null })

    backend.state.online = true
    await nextResult(key, () => {
      onlineManager.setOnline(true)
    })
    expect(backend.state.calls).toBe(3)
    expect(state()).toEqual({ list: LOADED, failure: null })
    unsubscribe()
  })

  it('첫 조회가 닿지 못하면 앱 문구와 다시 시도다 - 다시 시도가 되면 보기다', async () => {
    const backend = probeBackend()
    backend.state.online = false
    const { observer, unsubscribe, state } = await referenceObserver(backend.send)
    expect(state()).toEqual({
      list: { options: [], truncated: false },
      failure: { kind: 'unreachable' },
    })
    backend.state.online = true
    await observer.refetch()
    expect(state()).toEqual({ list: LOADED, failure: null })
    unsubscribe()
  })
})
```

```bash
pnpm exec vitest run test/unit/queries/reference-options.test.ts 2>&1 | tail -5
```

Expected: FAIL — `Tests  3 failed (3)`(`referenceQueryOptions is not a function`).

`queries/resource-options.ts` — Edit, 찾을 것 `import { detailRequest, nextPageQuery, type ListRequest } from '@/lib/resources/view'` — 바꿀 것:

```ts
import {
  detailRequest,
  nextPageQuery,
  referenceRequest,
  type ListRequest,
} from '@/lib/resources/view'
```

같은 파일에 Edit, 찾을 것(파일 끝 `detailQueryOptions` 의 마지막 줄들):

```ts
    queryFn: async () =>
      throwIfUnreachable(await send<SingleDocument>(plan.path, plan.options), '상세'),
  })
}
```

바꿀 것:

```ts
    queryFn: async () =>
      throwIfUnreachable(await send<SingleDocument>(plan.path, plan.options), '상세'),
  })
}

/**
 * 관계 선택기의 참조 목록 하나 - 대상 자원의 첫 쪽(`referenceRequest`, 이름 순 100건). 키는 대상 자원의 목록 키다
 * (`queryKeys.list`) - 참조 목록도 그 자원의 목록이다. 닿지 못함은 목록·상세처럼 던진다 - 재조회가 닿지 못해도 읽은
 * 보기가 남는다(`referenceState`).
 */
export function referenceQueryOptions(target: ResourceDefinition, send: JsonApiSend) {
  const plan = referenceRequest(target)
  return queryOptions({
    queryKey: queryKeys.list(target.type, plan.query.toString()),
    queryFn: async () =>
      throwIfUnreachable(await send<CollectionDocument>(plan.path, plan.options), '참조 목록'),
  })
}
```

```bash
pnpm exec vitest run test/unit/queries/reference-options.test.ts 2>&1 | tail -4
```

Expected: `Tests  3 passed (3)`.

`queries/resources.ts` — Edit, 찾을 것:

```ts
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import type { ResourceDefinition } from '@/lib/resources/define'
import {
  detailScreen,
  listScreen,
  type DetailScreen,
  type ListScreen,
} from '@/lib/resources/screen-state'
import { listRequest } from '@/lib/resources/view'
import { apiRequest } from '@/platform/api'
import { detailQueryOptions, listQueryOptions } from '@/queries/resource-options'
```

바꿀 것:

```ts
import { useInfiniteQuery, useQueries, useQuery } from '@tanstack/react-query'
import { useIsFocused } from 'expo-router'
import { useMemo, useState } from 'react'

import type { JsonApiResult } from '@/lib/jsonapi/client'
import type { SingleDocument } from '@/lib/jsonapi/document'
import type { ResourceDefinition } from '@/lib/resources/define'
import { relationshipTargets } from '@/lib/resources/form'
import {
  canLoadMore,
  detailScreen,
  listScreen,
  referenceState,
  type DetailScreen,
  type ListScreen,
  type ReferenceState,
} from '@/lib/resources/screen-state'
import { listRequest } from '@/lib/resources/view'
import { apiRequest } from '@/platform/api'
import {
  detailQueryOptions,
  listQueryOptions,
  referenceQueryOptions,
} from '@/queries/resource-options'
```

같은 파일에 Edit, 찾을 것(목록 끝의 가드 - 판단을 `canLoadMore` 로 옮긴다):

```ts
    // 읽는 중에 부르면 TanStack Query 가 진행 중인 재조회를 끊고 다음 쪽을 부른다 - 그래서 읽는 중에는 부르지
    // 않는다(TanStack Query v5 무한 조회 안내의 규칙). 다음 쪽이 닿지 못한 채로도 부르지 않는다 - 끝의 모양이 바뀔
    // 때마다 FlatList 가 끝에 닿았다고 다시 알려 닿지 못할 요청이 되풀이된다. 그 쪽은 사용자가 "다시 시도" 로 읽는다.
    loadMore: () => {
      if (query.hasNextPage && !query.isFetching && !query.isFetchNextPageError) {
        void query.fetchNextPage()
      }
    },
```

바꿀 것:

```ts
    // 부를지는 `canLoadMore`(lib/resources/screen-state.ts)가 정한다 - 다음 쪽이 없거나, 읽는 중이거나, 다음 쪽이
    // 실패한 채면 부르지 않는다.
    loadMore: () => {
      if (canLoadMore(query)) void query.fetchNextPage()
    },
```

같은 파일에 Edit, 찾을 것(목록 훅의 조회):

```ts
  const query = useInfiniteQuery(listQueryOptions(resource, plan, apiRequest))
```

바꿀 것:

```ts
  // 쌓인 화면(조건을 바꿀 때마다 쌓이는 목록, 상세·수정 밑의 목록)은 구독을 끊는다 - 앱 복귀·네트워크 복귀·무효화의
  // 재조회가 보이는 화면만 부르고, 쌓인 화면은 다시 앞에 올 때 다시 구독하며 부른다(`staleTime` 0). TanStack Query 의
  // React Native 안내 그대로다(D3 최종 검토 M2 - 스택 깊이만큼 읽은 쪽 전부를 다시 읽었다).
  const focused = useIsFocused()
  const query = useInfiniteQuery({
    ...listQueryOptions(resource, plan, apiRequest),
    subscribed: focused,
  })
```

같은 파일에 Edit, 찾을 것(`ResourceDetailState` 의 첫 필드):

```ts
  screen: DetailScreen
```

바꿀 것:

```ts
  screen: DetailScreen
  /**
   * `screen` 을 만든 응답 그대로 - 수정 화면이 폼의 첫 값을 읽는다(`initialFormValues`). 화면 상태에는 enum 원값과
   * 관계 id 가 없다(lib/resources/form.ts 머리말의 R7). 받기 전이면 `null` 이다.
   */
  result: JsonApiResult<SingleDocument> | null
```

같은 파일에 Edit, 찾을 것:

```ts
 * 상세 하나. 화면에 다시 들어오면 캐시를 먼저 그리고 다시 부른다(`staleTime` 0, 스펙 8.5) - 그 재조회가 닿지
 * 못해도 캐시의 상세를 둔다(`detailScreen` 의 `refreshFailed`). `screen` 은 `useMemo` 로 고정한다.
 */
export function useResourceDetail(resource: ResourceDefinition, id: string): ResourceDetailState {
  const query = useQuery(detailQueryOptions(resource, id, apiRequest))
```

바꿀 것:

```ts
 * 상세 하나. 화면에 다시 들어오면 캐시를 먼저 그리고 다시 부른다(`staleTime` 0, 스펙 8.5) - 그 재조회가 닿지
 * 못해도 캐시의 상세를 둔다(`detailScreen` 의 `refreshFailed`). `screen` 은 `useMemo` 로 고정한다. 쌓인 화면은
 * 구독하지 않는다(`useResourceList` 와 같다).
 *
 * `enabled` 가 거짓이면 부르지 않는다 - 수정 화면이 그 자원을 지운 뒤에 쓴다(queries/writes.ts 의 `deleted`).
 * 삭제가 캐시에서 지운 상세를 지켜보던 화면이 다시 그려지면 새 조회가 없는 자원을 부른다.
 */
export function useResourceDetail(
  resource: ResourceDefinition,
  id: string,
  { enabled = true }: { enabled?: boolean } = {},
): ResourceDetailState {
  const focused = useIsFocused()
  const query = useQuery({
    ...detailQueryOptions(resource, id, apiRequest),
    enabled,
    subscribed: focused,
  })
```

같은 파일에 Edit, 찾을 것(상세 훅이 돌려주는 것의 앞):

```ts
  return {
    screen,
    retrying: query.isFetching,
```

바꿀 것:

```ts
  return {
    screen,
    result: data ?? null,
    retrying: query.isFetching,
```

같은 파일에 Edit, 찾을 것(파일 끝 - 상세 훅의 마지막 줄들):

```ts
    retry: () => {
      void query.refetch()
    },
  }
}
```

바꿀 것:

```ts
    retry: () => {
      void query.refetch()
    },
  }
}

/** 관계 하나의 선택기가 그릴 참조 목록 - `referenceState`(lib/resources/screen-state.ts)에 다시 부르는 길을 더했다. */
export interface RelationshipReference extends ReferenceState {
  /** 조회가 진행 중이다(`isFetching`) - 시트 안의 실패 화면(`RequestFailed`)이 "다시 시도" 의 스피너에만 쓴다. */
  readonly retrying: boolean
  readonly retry: () => void
  /** 대상 자원에 쓰기 라우트가 있는가 - 선언의 `writable` 이다. 선택기가 안내에 쓴다. */
  readonly writable: boolean
}

/**
 * 폼의 관계 선택기들이 그릴 참조 목록 - 관계마다 대상 자원의 첫 쪽(`referenceQueryOptions`, 이름 순 100건)이다.
 * 관계는 선언에서 온다(`relationshipTargets`) - 선언에 관계를 더하면 생성·수정 화면이 함께 따라온다. 참조 조회는
 * 공개 읽기라 토큰을 싣지 않고, 서로 기다리지 않고 나란히 나간다. 쌓인 화면은 구독하지 않는다(`useResourceList` 와
 * 같다).
 */
export function useRelationshipReferences(
  resource: ResourceDefinition,
): Readonly<Record<string, RelationshipReference>> {
  const focused = useIsFocused()
  const targets = useMemo(() => relationshipTargets(resource), [resource])
  const options = useMemo(
    () => targets.map(([, target]) => referenceQueryOptions(target, apiRequest)),
    [targets],
  )
  const queries = useQueries({ queries: options, subscribed: focused })

  return Object.fromEntries(
    targets.map(([name, target], index): [string, RelationshipReference] => {
      const query = queries[index]
      return [
        name,
        {
          ...referenceState(target, { result: query?.data, error: query?.error ?? null }),
          retrying: query?.isFetching ?? false,
          retry: () => {
            void query?.refetch()
          },
          writable: target.writable,
        },
      ]
    }),
  )
}
```

```bash
pnpm typecheck
```

Expected: exit 0. `useIsFocused` 는 `expo-router` 가 내보낸다(React Navigation 의 것 그대로), `subscribed` 는 설치본 `@tanstack/react-query` 5.104.0 의 `useBaseQuery`·`useQueries` 가 받는다(사실 절).

- [ ] **Step 5: 문서와 스펙 정정을 쓴다**

`platform/AGENTS.md` — Edit, 찾을 것(표의 `query-client.ts` 행 - 칸 맞춤 공백 앞까지):

```markdown
앱 복귀·네트워크 복귀의 재조회 `useQueryRefetchTriggers()`(AppState·NetInfo)
```

바꿀 것:

```markdown
앱 복귀·네트워크 복귀의 재조회 `useQueryRefetchTriggers()`(AppState·NetInfo), 인증 오류의 한 곳(쓰기 캐시의 `onError` - 세션 거절이면 `signOut()`, 스펙 9.2)
```

`platform/AGENTS.md` — Edit, 찾을 것:

```markdown
- 세션 관리자는 `sessionManager` 하나다. 회전은 그 안에서만 일어난다(`lib/auth/AGENTS.md`).
```

바꿀 것:

```markdown
- 세션 관리자는 `sessionManager` 하나다. 회전은 그 안에서만 일어난다(`lib/auth/AGENTS.md`).
- 인증 오류는 `queryClient`의 쓰기 캐시(`MutationCache`) `onError` 한 곳이 받는다 - 쓰기 흐름
  (`lib/resources/write.ts`)이 던진 세션 거절이면 기기 세션을 지우고, 이동은 경로 가드가 한다. 그 `signOut()`의
  거절은 이름과 문구만 남긴다.
```

`platform/AGENTS.md` — Edit, 찾을 것:

```markdown
바꾼다). 언어 조립·실패 한 줄·변형 표의 판단은 `lib/`의 시험이 잰다.
```

바꿀 것:

```markdown
바꾼다). 언어 조립·실패 한 줄·변형 표의 판단은 `lib/`의 시험이 잰다. `query-client.ts`의 인증 오류 배선은
`test/unit/platform/query-client.test.ts`가 실제 쓰기 캐시로 잰다(기기 모듈과 세션 관리자만 가짜다).
```

`queries/AGENTS.md` — Edit, 찾을 것(표의 `resources.ts` 행):

```markdown
자원의 조회 훅 - 목록(`useResourceList`, 무한 스크롤)과 상세(`useResourceDetail`). 판단은 `lib/resources/view.ts`·`screen-state.ts` 가 한다
```

바꿀 것:

```markdown
자원의 조회 훅 - 목록(`useResourceList`, 무한 스크롤)과 상세(`useResourceDetail`), 관계 선택기의 참조 목록(`useRelationshipReferences`). 판단은 `lib/resources/view.ts`·`screen-state.ts`·`form.ts` 가 한다. 쌓인 화면은 구독하지 않는다(`subscribed`)
```

`queries/AGENTS.md` — Edit, 찾을 것 `조회의 Query 옵션(키·요청·다음 쪽)` — 바꿀 것 `조회의 Query 옵션(키·요청·다음 쪽 - 목록·상세·관계 선택기의 참조 목록)`.

`queries/AGENTS.md` — Edit, 찾을 것(표의 `submit-once.ts` 행의 끝 문장 - 그 뒤에 행 하나를 잇는다):

```markdown
폼이 부를 쓰기의 키가 진행 중이면 그 제출을 버린다
```

바꿀 것:

```markdown
폼이 부를 쓰기의 키가 진행 중이면 그 제출을 버린다 |
| `writes.ts` | 자원의 쓰기 훅 - 생성·수정·삭제(`useCreateResource`·`useUpdateResource`·`useDeleteResource`). 흐름은 `lib/resources/write.ts`, 캐시는 `keys.ts` 의 표
```

`queries/AGENTS.md` — Edit, 찾을 것:

```markdown
  `null`이면 요청하지 않고 로그인으로 보낸다(스펙 7.3의 쓰기 가드). 401 에 회전·재시도를 붙이지
  않는다(스펙 7.2).
```

바꿀 것:

```markdown
  `null`이면 요청하지 않는다(스펙 7.3의 쓰기 가드) - 쓰기 흐름(`lib/resources/write.ts`)이 세션 거절을 던지고
  `platform/query-client.ts`의 쓰기 캐시 `onError`가 기기 세션을 지우면, 경로 가드가 `next`를 실어 로그인으로
  보낸다(스펙 9.2). 401 에 회전·재시도를 붙이지 않는다(스펙 7.2).
```

`queries/AGENTS.md` — Edit, 찾을 것:

```markdown
- 쓰기 뒤의 캐시는 `keys.ts` 의 표를 지난다 - 생성·수정·삭제 훅(D4)도
  `applyCacheEffects(queryClient, cacheEffects({ kind: 'create', type }))` 처럼 표를 부른다. 키를 손으로 적지 않는다.
```

바꿀 것:

```markdown
- 쓰기 뒤의 캐시는 `keys.ts` 의 표를 지난다 - 생성·수정·삭제 훅(`writes.ts`)은
  `applyCacheEffects(queryClient, cacheEffects({ kind: 'create', type }))` 처럼 표를 부른다. 키를 손으로 적지 않는다.
- 삭제는 그 자원의 상세를 캐시에서 지운다. 지운 상세를 지켜보던 화면이 다시 그려지면 TanStack Query 가 새 조회를
  만들어 없는 자원을 부른다(404) - 그래서 지운 화면은 상세 조회를 끈다(`useResourceDetail(…, { enabled: !deleted })`).
```

`queries/AGENTS.md` — Edit, 찾을 것:

```markdown
  `onlineManager` 로 전이를 잰다(훅 자체는 시험하지 않는다 - 스펙 11.1).
```

바꿀 것:

```markdown
  `onlineManager` 로 전이를 잰다(훅 자체는 시험하지 않는다 - 스펙 11.1). 관계 선택기의 참조 목록(`referenceQueryOptions`)도
  닿지 못함을 던진다 - 읽은 보기가 남고, 선택기가 그릴 것은 `referenceState` 가 정한다(`test/unit/queries/reference-options.test.ts`).
- 화면의 조회 훅(`useResourceList`·`useResourceDetail`·`useRelationshipReferences`)은 `subscribed: useIsFocused()` 를 준다 -
  쌓인 화면(조건을 바꿀 때마다 쌓이는 목록, 상세·수정 밑의 목록)은 앱 복귀·네트워크 복귀·무효화의 재조회를 부르지 않고,
  다시 앞에 오면 다시 구독하며 부른다(`staleTime` 0). TanStack Query 의 React Native 안내다 - 구독이 살아 있으면 스택
  깊이만큼 읽은 쪽 전부를 다시 읽는다(D3 최종 검토 M2). 새 조회 훅도 같은 옵션을 준다.
```

스펙 — 8.5 의 끝, `### 8.6 계약 실험실` 바로 앞에 더한다:

```markdown
> 정정(2026-10-01, D4): 쌓인 화면(조건을 바꿀 때마다 쌓이는 목록, 상세·수정 밑의 목록)의 조회는 구독을 끊는다 -
> `subscribed: useIsFocused()`(TanStack Query 의 React Native 안내). 위 표의 두 재조회와 쓰기 뒤 무효화는 보이는 화면의
> 조회만 부르고, 쌓인 화면은 다시 앞에 올 때 다시 구독하며 부른다(`staleTime` 0). 구독이 살아 있던 처음 판은 앱 복귀·
> 네트워크 복귀마다 스택 깊이만큼 읽은 쪽 전부를 다시 읽었다(D3 최종 검토 M2). 관계 선택기의 참조 목록도 목록·상세처럼
> 닿지 못함을 던져 재조회의 실패가 읽은 보기를 지우지 않는다(`queries/resource-options.ts`).
```

스펙 — 9.3 의 끝, `### 9.4 Accept-Language` 바로 앞에 더한다:

```markdown
> 정정(2026-10-01, D4): 쓰기(생성·수정·삭제)의 오류. (a) 인증 오류는 `MutationCache` 의 `onError` 한 곳이
> 받는다(`platform/query-client.ts`) - 쓰기 흐름(`lib/resources/write.ts`)은 세션이 없거나(7.3 의 쓰기 가드) 인증
> 오류 코드를 받으면 세션 거절을 던지고, `onError` 가 기기 세션을 지우면 경로 가드가 `next` 를 실어 로그인으로
> 보낸다 - 쓰기 화면은 모두 보호 경로다. `QueryCache` 에는 두지 않는다 - 읽기는 토큰을 싣지 않아(7.2) 인증 오류가
> 오지 않는다. (b) 수정의 `RESOURCE_NOT_FOUND` 는 not-found 를 그리고, 삭제의 `RESOURCE_NOT_FOUND` 는 이미 이뤄진
> 삭제로 보아 목록으로 간다(원본과 같다 - DELETE 는 멱등이 아니다). 생성의 `RESOURCE_NOT_FOUND` 는 계약 밖이라
> 배너다. (c) 백엔드가 응답조차 주지 못하면 폼 배너에 `UNUSABLE_RESPONSE_MESSAGE` 를 그린다 - 인증 폼처럼 입력이
> 그대로 남은 폼의 제출 버튼이 곧 다시 시도다. 관계 선택기의 참조 조회가 실패하면 조회 화면과 같은 두 갈래(앱
> 문구와 "다시 시도", 또는 백엔드 문구)를 그 시트 안에 그린다 - 읽은 보기가 있으면 재조회가 닿지 못해도 그대로
> 두고 실패를 따로 그리지 않는다(`lib/resources/screen-state.ts` 의 `referenceState`). (d) 관계 오류(`RELATIONSHIP_RESOURCE_NOT_FOUND`·
> `TYPE_MISMATCH` 등)는 코드가 아니라 포인터(`/data/relationships/<이름>/…`)로 그 선택기 아래에 그린다(9.1).
```

- [ ] **Step 6: 정적 검사를 돌리고 커밋한다**

```bash
pnpm format
pnpm typecheck && pnpm lint && pnpm format:check && pnpm lint:secrets
./scripts/check-citations.sh app components lib platform queries test
pnpm test 2>&1 | grep -E "Test Files|Tests "
git add queries platform test/unit/queries test/unit/platform docs/superpowers/specs
git status --short
git commit -m "feat: 자원의 쓰기 훅과 관계 참조 목록을 더하고 세션 거절을 쓰기 캐시의 한 곳에서 받는다"
```

Expected: 검사 전부 exit 0, `Tests  1286 passed (1286)`(1279 + 7, 58 파일 - 쓰기 키 1·인증 오류 배선 3·참조 목록의 전이 3), 남은 파일이 없다.

### Task 4: 생성·수정·삭제 화면과 관계 선택기

스펙 11.1 이 컴포넌트 시험을 두지 않으므로 이 태스크의 판단은 전부 Task 1 의 `form.ts`·`write.ts` 와 Task 3 의 훅에 있다. 여기서는 정적 검사·두 플랫폼 번들까지 보고, 화면은 Task 5 의 E2E 가 지킨다.

**Files:**
- Create: `components/resource/resource-form.tsx`, `components/resource/relationship-picker.tsx`, `components/app/confirm-sheet.tsx`, `app/(app)/examples/[id]/edit.tsx`
- Modify: `components/resource/values.tsx`(전체), `components/resource/resource-detail.tsx`, `components/resource/sort-sheet.tsx`, `app/(app)/examples/new.tsx`(전체), `app/(app)/examples/index.tsx`("새로 만들기"), `app/(app)/examples/[id]/index.tsx`("수정"), `components/resource/AGENTS.md`

**Interfaces:**
- Consumes: Task 1 의 `initialFormValues`·`newFormValues`·`withAttribute`·`withRelationshipChoice`·`relationshipChoice`·`RelationshipOption`·`ResourceFormState`·`ResourceFormValues`, Task 2 의 `useSubmitOnce`·`useNavigateOnce`, Task 3 의 `useCreateResource`·`useUpdateResource`·`useDeleteResource`(`mutationKey`·`state`·`pending`·`gone`·`deleted`·`messages`)·`useRelationshipReferences`·`useResourceDetail(…, { enabled })`·`RelationshipReference`(`list`·`failure`·`retrying`·`retry`·`writable`)·`ResourceDetailState`(`screen`·`result`·`retrying`·`retry`), D3 의 `DetailScreen`(`loading`·`notFound`·`unreachable`·`banner`·`detail`, 뒤의 둘에 `refreshFailed`)·`Sheet`·`RequestFailed`(`compact`)·`NotFoundView`·`Badge`·`Skeleton`·`FormBanner`·`FieldError`·`SubmitButton`·`REFERENCE_PAGE_SIZE`, `formAttributes`·`isRequiredAttribute`(`lib/resources/define.ts`), `StackActions`(`expo-router/react-navigation`)
- Produces:
  - `ResourceForm({ resource, references, initialValues, state, pending, mutationKey, submitLabel, onSubmit, footer? })`, `FormSkeleton({ resource })`, `ResourceEditGate({ resource, detail, gone, children: (initialValues) => ReactNode })`
  - `RelationshipPicker({ name, relationship, reference, selected, errors, onChoose: (id: string | null) => void })`
  - `ConfirmSheet({ open, testID, title, message, confirmLabel, pending, mutationKey, messages, onConfirm, onCancel })`
  - `ResourceDetailView` 의 선택 prop `actions?: ReactNode`, `ListToolbar` 의 선택 prop `children?: ReactNode`, `EmptyValue({ testID? })`·`RelatedBadges({ values, testID? })`
  - testID(Task 5 의 플로가 쓴다): `new-example-link`, `edit-example-link`, `resource-form`, `form-skeleton`, `field-label-<속성>`·`field-input-<속성>`·`field-choice-<속성>-<값>`·`field-error-<속성>`, `submit-button`, `relationship-open|value-<n>|sheet|option|none|done|error|unlisted|truncated-<관계>`, `delete-button`, `delete-confirm`·`delete-confirm-accept`·`delete-confirm-cancel`, `new-example-screen`, `edit-example-screen`, `detail-badge-<키>-<위치>`, 빈 항목의 `detail-value-<키>`

- [ ] **Step 1: 폼과 관계 선택기**

폼은 입력 값을 들고(`initialValues` 는 첫 값일 뿐이다) `withAttribute`·`withRelationshipChoice` 로 고친다. 오류의 자리는 `state` 가 이미 나눠 왔다(배너·입력 아래·선택기 아래, 스펙 9.1). 입력은 속성의 `kind` 로만 갈린다(자원 이름이 아니다). 제출은 `useSubmitOnce(mutationKey)` 로 감싼다(결정 9). 속성 라벨을 누르면 키보드가 내려간다 — E2E 가 아래쪽 요소를 누르기 전에 쓴다(결정 26). 수정 폼의 자리(`ResourceEditGate`)는 처음 받은 상세 하나로 첫 값을 고정한다(결정 21).

`components/resource/resource-form.tsx` 를 만든다:

```tsx
import type { MutationKey } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { Keyboard, Pressable, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { RequestFailed } from '@/components/app/request-failed'
import { NotFoundView } from '@/components/app/not-found-view'
import { FieldError } from '@/components/form/field-error'
import { FormBanner } from '@/components/form/form-banner'
import { SubmitButton } from '@/components/form/submit-button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'
import {
  formAttributes,
  isRequiredAttribute,
  type AttributeDefinition,
  type ResourceDefinition,
} from '@/lib/resources/define'
import {
  initialFormValues,
  withAttribute,
  withRelationshipChoice,
  type ResourceFormState,
  type ResourceFormValues,
} from '@/lib/resources/form'
import { cn } from '@/lib/utils'
import type { RelationshipReference, ResourceDetailState } from '@/queries/resources'
import { useSubmitOnce } from '@/queries/submit-once'

import { RelationshipPicker } from './relationship-picker'

/** 폼의 여백(`p-6`). 아래쪽에는 시스템 막대의 높이가 더해진다. */
const CONTENT_PADDING = 24

/**
 * 자원 선언을 읽어 그리는 쓰기 폼 - 생성과 수정이 함께 쓴다(스펙 8.1). 두 화면의 차이는 첫 값·제출
 * 라벨·제출할 때 할 일뿐이다.
 *
 * 입력 값은 이 컴포넌트가 들고 있다(`initialValues` 는 첫 값일 뿐이다) - 값을 고치는 것은
 * `withAttribute`·`withRelationshipChoice`(lib/resources/form.ts)다. 오류의 자리는 `state` 가 이미
 * 나눠 왔다(`formStateFromErrors`, 스펙 9.1): 문서 오류는 위 배너, 속성 오류는 그 입력 아래, 관계
 * 오류는 그 선택기 아래. 실패해도 입력은 지우지 않는다. 입력을 검증하지 않는다 - 정본 검증자는
 * 백엔드다(필수 칸이 비면 422 가 그 칸 아래 뜬다).
 *
 * 자원 이름으로 분기하지 않는다 - 입력의 종류는 속성의 `kind`(구조)가 정한다.
 *
 * | kind       | 입력                                   |
 * | ---------- | -------------------------------------- |
 * | `string`   | 한 줄 입력                             |
 * | `text`     | 여러 줄 입력                           |
 * | `enum`     | 보기 칩(하나만 고른다)                 |
 * | `int`      | 숫자 자판의 한 줄 입력                 |
 * | `datetime` | 그리지 않는다 - 오늘 선언의 datetime 은 전부 읽기 전용이라 `formAttributes` 가 뺀다 |
 *
 * 알려진 한계(원본과 같다): enum 칩에는 "선택 안 함" 이 없다 - nullable 인 enum 속성이 생기면 고른 값을
 * 되돌릴 방법이 없다. 오늘 선언에는 그런 속성이 없다(`EXAMPLE.status` 는 필수라 첫 값으로 시작한다 -
 * `newFormValues`). 생기는 날 빈 칩을 더한다.
 *
 * 제출은 한 번에 하나다 - 쓰기 훅의 `mutationKey` 로 진행 중인 쓰기를 본다(queries/submit-once.ts).
 *
 * testID(E2E 플로가 찾는다): 폼 `resource-form`, 라벨 `field-label-<속성>`, 입력 `field-input-<속성>`, 칩
 * `field-choice-<속성>-<값>`, 필드 오류 `field-error-<속성>`, 제출 `submit-button`. 관계 선택기의
 * 것은 `relationship-picker.tsx`. 라벨을 누르면 키보드가 내려간다(`Keyboard.dismiss`). 플로는 아래쪽 요소를
 * 누르기 전에 제목 라벨을 누른다 - 키보드가 아래쪽 요소를 가리고 있으면 그 자리를 누른 것이 키보드로 간다.
 *
 * 끝 여백: 마지막 요소(수정 화면의 삭제 버튼)가 시스템 내비게이션 막대 밑으로 들어가지 않게 아래 여백만큼
 * 띄운다(`useSafeAreaInsets` - Android(SDK 57)는 화면 끝까지 그린다. 상세·목록·시트와 같다).
 */
export function ResourceForm({
  resource,
  references,
  initialValues,
  state,
  pending,
  mutationKey,
  submitLabel,
  onSubmit,
  footer,
}: {
  resource: ResourceDefinition
  references: Readonly<Record<string, RelationshipReference>>
  initialValues: ResourceFormValues
  state: ResourceFormState
  pending: boolean
  /** 제출이 부르는 쓰기의 키 - 쓰기 훅의 `mutationKey` 다. */
  mutationKey: MutationKey
  submitLabel: string
  onSubmit: (values: ResourceFormValues) => void
  /** 제출 버튼 아래 - 수정 화면의 삭제 버튼 자리다. */
  footer?: ReactNode
}) {
  const [values, setValues] = useState(initialValues)
  const submitOnce = useSubmitOnce(mutationKey)
  const insets = useSafeAreaInsets()

  return (
    <ScrollView
      testID="resource-form"
      className="flex-1 bg-background"
      contentContainerClassName="gap-5 p-6"
      contentContainerStyle={{ paddingBottom: CONTENT_PADDING + insets.bottom }}
      keyboardShouldPersistTaps="handled"
    >
      <FormBanner messages={state.documentErrors} />
      {formAttributes(resource).map(([name, attribute]) => (
        <AttributeField
          key={name}
          name={name}
          attribute={attribute}
          value={values.attributes[name] ?? ''}
          errors={state.fieldErrors[name] ?? []}
          onChange={(raw) => {
            setValues((current) => withAttribute(current, name, raw))
          }}
        />
      ))}
      {Object.entries(resource.relationships).map(([name, relationship]) => (
        <RelationshipPicker
          key={name}
          name={name}
          relationship={relationship}
          reference={references[name]}
          selected={values.relationships[name] ?? []}
          errors={state.relationshipErrors[name] ?? []}
          onChoose={(id) => {
            setValues((current) => withRelationshipChoice(current, name, relationship, id))
          }}
        />
      ))}
      <SubmitButton
        testID="submit-button"
        label={submitLabel}
        pending={pending}
        onPress={() => {
          Keyboard.dismiss()
          submitOnce(() => {
            onSubmit(values)
          })
        }}
      />
      {footer}
    </ScrollView>
  )
}

function AttributeField({
  name,
  attribute,
  value,
  errors,
  onChange,
}: {
  name: string
  attribute: AttributeDefinition
  value: string
  errors: readonly string[]
  onChange: (raw: string) => void
}) {
  const label = isRequiredAttribute(attribute) ? `${attribute.label} *` : attribute.label
  const invalid = errors.length > 0

  return (
    <View className="gap-1.5">
      <Text
        testID={`field-label-${name}`}
        onPress={Keyboard.dismiss}
        className="text-sm font-medium"
      >
        {label}
      </Text>
      <AttributeControl
        name={name}
        attribute={attribute}
        value={value}
        invalid={invalid}
        onChange={onChange}
      />
      <FieldError testID={`field-error-${name}`} messages={errors} />
    </View>
  )
}

/** 위 kind → 입력 표를 그대로 코드로 옮긴 것. */
function AttributeControl({
  name,
  attribute,
  value,
  invalid,
  onChange,
}: {
  name: string
  attribute: AttributeDefinition
  value: string
  invalid: boolean
  onChange: (raw: string) => void
}) {
  if (attribute.kind === 'enum') {
    return (
      <View
        role="radiogroup"
        accessibilityLabel={attribute.label}
        className="flex-row flex-wrap gap-2"
      >
        {attribute.values.map((entry) => (
          // value 는 백엔드 원값, 글자는 라벨이다 - 라벨을 보내면 422 다(form.ts 머리말의 R7).
          <Pressable
            key={entry.value}
            testID={`field-choice-${name}-${entry.value}`}
            accessibilityRole="radio"
            accessibilityState={{ selected: value === entry.value }}
            onPress={() => {
              onChange(entry.value)
            }}
            className={cn(
              'rounded-full border px-3 py-1.5',
              value === entry.value
                ? 'border-primary bg-primary'
                : 'border-border bg-background active:bg-accent',
            )}
          >
            <Text className={cn('text-sm', value === entry.value && 'text-primary-foreground')}>
              {entry.label}
            </Text>
          </Pressable>
        ))}
      </View>
    )
  }

  // datetime 은 오늘 이 자리에 닿지 않는다 - 위 머리말의 표.
  if (attribute.kind === 'datetime') return null

  return (
    <Input
      testID={`field-input-${name}`}
      accessibilityLabel={attribute.label}
      value={value}
      onChangeText={onChange}
      autoCapitalize="none"
      autoCorrect={false}
      keyboardType={attribute.kind === 'int' ? 'number-pad' : 'default'}
      multiline={attribute.kind === 'text'}
      textAlignVertical={attribute.kind === 'text' ? 'top' : 'center'}
      className={cn(
        attribute.kind === 'text' && 'h-auto min-h-24 py-2',
        invalid && 'border-destructive',
      )}
    />
  )
}

/** 폼을 그리기 전의 자리 - 글자 없이 항목 모양만(스펙 8.7). 줄 수는 선언이 정한다. */
export function FormSkeleton({ resource }: { resource: ResourceDefinition }) {
  const rows = formAttributes(resource).length + Object.keys(resource.relationships).length
  return (
    <View testID="form-skeleton" className="gap-5 p-6">
      {Array.from({ length: rows }, (_, row) => (
        <View key={row} className="gap-1.5">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-10 w-full" />
        </View>
      ))}
    </View>
  )
}

/**
 * 수정 폼의 자리 - 고칠 자원의 상세를 받아 폼의 첫 값을 만든다(`initialFormValues`, 상세 화면과
 * 같은 응답). 받기 전에는 스켈레톤, 없는 id 면 not-found(스펙 9.2), 닿지 못함이면 앱 문구와 "다시
 * 시도", 백엔드가 거절하면 그 문구다. 저장이 "그 자원이 없다" 를 받았으면(`gone`) not-found 다.
 *
 * 첫 값은 **처음 받은 상세 하나로 고정한다.** 상세는 상세 화면과 같은 캐시라 앱 복귀·무효화로 다시
 * 불릴 수 있는데, 그 결과로 폼을 다시 만들면 고치던 입력이 사라진다. 고정한 뒤의 재조회가 닿지 못해도 폼은
 * 그대로다(재조회의 실패는 폼을 그리는 동안 보이지 않는다 - 저장이 닿지 못하면 폼 배너가 알린다).
 */
export function ResourceEditGate({
  resource,
  detail,
  gone,
  children,
}: {
  resource: ResourceDefinition
  detail: ResourceDetailState
  gone: boolean
  children: (initialValues: ResourceFormValues) => ReactNode
}) {
  const [fixed, setFixed] = useState<ResourceFormValues | null>(null)
  const { screen, result } = detail
  const current =
    fixed ??
    (screen.kind === 'detail' && result !== null ? initialFormValues(resource, result) : null)
  // 렌더 중의 조건부 상태 갱신 - React 가 권하는 "이전 렌더의 정보를 저장하기" 모양이다.
  if (fixed === null && current !== null) setFixed(current)

  if (gone) return <NotFoundView />
  if (current !== null) return children(current)

  if (screen.kind === 'notFound') return <NotFoundView />
  if (screen.kind === 'unreachable') {
    return <RequestFailed retrying={detail.retrying} onRetry={detail.retry} />
  }
  if (screen.kind === 'banner') {
    return (
      <View className="gap-3 p-4">
        <FormBanner messages={screen.messages} />
        {screen.refreshFailed ? (
          <RequestFailed compact retrying={detail.retrying} onRetry={detail.retry} />
        ) : null}
      </View>
    )
  }
  return <FormSkeleton resource={resource} />
}
```

선택기는 고른 것을 배지로 그리고(고른 순서 그대로), 누르면 아래 시트에 참조 목록을 연다. 무엇을 그릴지는 `relationshipChoice` 가 정한다 — 목록 밖 선택은 id 를 라벨로 끝에 붙이고 안내한다(결정 19). 참조 조회의 실패는 조회 화면과 같은 두 갈래다.

`components/resource/relationship-picker.tsx` 를 만든다:

```tsx
import { useState } from 'react'
import { Keyboard, Pressable, ScrollView, View } from 'react-native'

import { RequestFailed } from '@/components/app/request-failed'
import { Sheet } from '@/components/app/sheet'
import { FieldError } from '@/components/form/field-error'
import { FormBanner } from '@/components/form/form-banner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'
import type { RelationshipDefinition } from '@/lib/resources/define'
import { relationshipChoice, type RelationshipOption } from '@/lib/resources/form'
import { REFERENCE_PAGE_SIZE } from '@/lib/resources/view'
import { cn } from '@/lib/utils'
import type { RelationshipReference } from '@/queries/resources'

/** to-one 의 "관계를 끊는다" 보기. */
const NONE_LABEL = '선택 안 함'

/** 목록 밖 선택의 라벨에 붙는 표시 - 라벨 자리에는 id 가 온다(`relationshipChoice`). */
const UNLISTED_SUFFIX = ' (목록에 없음)'

/** 목록 밖 선택이 하나라도 있을 때의 안내 - 응답을 받은 뒤의 사실이지 로딩 문구가 아니다. */
const UNLISTED_NOTICE =
  '목록에 없는 항목이 선택돼 있습니다. 해제하지 않으면 저장 후에도 그대로 남습니다.'

/**
 * 관계 하나를 고르는 선택기 - 스펙 8.1 의 "분류 단일 선택, 태그 다중 선택(순서 유지)". 폼에는 지금
 * 고른 것을 배지로 그리고(고른 순서 그대로), 누르면 아래 시트에 참조 목록(`referenceRequest`, 이름
 * 순 100건)을 연다. 무엇을 그릴지는 `relationshipChoice`(lib/resources/form.ts)가 정한다 - 목록
 * 밖의 선택(잘렸거나 조회가 실패한 목록)도 끝에 붙여 보이고 안내를 단다.
 *
 * 자원 이름으로 분기하지 않는다 - 컨트롤은 `relationship.cardinality`(구조)로만 갈린다.
 *
 * | cardinality | 시트                         | 누르면                          |
 * | ----------- | ---------------------------- | ------------------------------- |
 * | `'one'`     | "선택 안 함" + 보기          | 그것을 고르고 시트를 닫는다     |
 * | `'many'`    | 보기(고른 것에 표시)         | 켜고 끈다 - 켜면 끝에 붙는다    |
 *
 * 참조 목록을 받기 전에는 스켈레톤이다(스펙 8.7). 조회가 실패하면 보기 대신 그 실패를 그린다 -
 * 닿지 못함이면 앱 문구와 "다시 시도"(스펙 9.3). 잘림·읽기 전용 안내는 응답을 받은 뒤의 사실이다.
 *
 * testID(E2E 플로가 찾는다): 폼의 자리 `relationship-open-<관계>`, 고른 배지
 * `relationship-value-<관계>-<위치>`, 시트 `relationship-sheet-<관계>`, 보기의 글자
 * `relationship-option-<관계>`(보기 이름과 함께 찾는다), `relationship-none-<관계>`, 닫기
 * `relationship-done-<관계>`, 오류 `relationship-error-<관계>`, 안내 `relationship-unlisted-<관계>`(목록 밖
 * 선택)·`relationship-truncated-<관계>`(잘린 목록).
 */
export function RelationshipPicker({
  name,
  relationship,
  reference,
  selected,
  errors,
  onChoose,
}: {
  name: string
  relationship: RelationshipDefinition
  /** 이 관계의 참조 목록 - `useRelationshipReferences` 가 준다. 없으면 받기 전과 같다. */
  reference: RelationshipReference | undefined
  selected: readonly string[]
  errors: readonly string[]
  /** to-one 은 고른 id(`null` 이면 비운다), to-many 는 켜고 끌 id. */
  onChoose: (id: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const list = reference?.list ?? null
  const choice = list === null ? null : relationshipChoice(relationship, list, selected)
  const close = () => {
    setOpen(false)
  }

  return (
    <View className="gap-1.5">
      <Text className="text-sm font-medium">{relationship.label}</Text>
      <Pressable
        testID={`relationship-open-${name}`}
        accessibilityRole="button"
        accessibilityLabel={relationship.label}
        onPress={() => {
          // 입력의 키보드가 떠 있으면 시트의 보기를 가린다.
          Keyboard.dismiss()
          setOpen(true)
        }}
        className={cn(
          'min-h-10 flex-row flex-wrap items-center gap-1 rounded-md border px-3 py-2 active:bg-accent',
          errors.length > 0 ? 'border-destructive' : 'border-input',
        )}
      >
        {choice === null ? (
          <Skeleton className="h-5 w-1/2" />
        ) : choice.chosen.length === 0 ? (
          <Text className="text-sm text-muted-foreground">{NONE_LABEL}</Text>
        ) : (
          choice.chosen.map((option, position) => (
            <Badge key={option.id} variant="secondary">
              <Text testID={`relationship-value-${name}-${position}`}>{labelOf(option)}</Text>
            </Badge>
          ))
        )}
      </Pressable>
      {choice?.hasUnlisted === true ? (
        <Text testID={`relationship-unlisted-${name}`} className="text-sm text-muted-foreground">
          {UNLISTED_NOTICE}
        </Text>
      ) : null}
      <FieldError testID={`relationship-error-${name}`} messages={errors} />

      <Sheet open={open} onClose={close} testID={`relationship-sheet-${name}`}>
        <View className="flex-row items-center gap-2">
          <Text variant="large" className="flex-1">
            {relationship.label}
          </Text>
          <Button testID={`relationship-done-${name}`} size="sm" onPress={close}>
            <Text>완료</Text>
          </Button>
        </View>
        <SheetBody
          name={name}
          relationship={relationship}
          reference={reference}
          options={choice?.options ?? null}
          onChoose={(id) => {
            onChoose(id)
            if (relationship.cardinality === 'one') close()
          }}
        />
      </Sheet>
    </View>
  )
}

function labelOf(option: RelationshipOption): string {
  return option.listed ? option.label : `${option.label}${UNLISTED_SUFFIX}`
}

function SheetBody({
  name,
  relationship,
  reference,
  options,
  onChoose,
}: {
  name: string
  relationship: RelationshipDefinition
  reference: RelationshipReference | undefined
  options: readonly RelationshipOption[] | null
  onChoose: (id: string | null) => void
}) {
  const failure = reference?.failure ?? null
  if (failure?.kind === 'unreachable') {
    return (
      <RequestFailed
        compact
        retrying={reference?.retrying ?? false}
        onRetry={() => {
          reference?.retry()
        }}
      />
    )
  }
  if (failure?.kind === 'banner') return <FormBanner messages={failure.messages} />

  if (reference === undefined || options === null) {
    return (
      <View className="gap-2">
        {[0, 1, 2, 3].map((row) => (
          <Skeleton key={row} className="h-10 w-full" />
        ))}
      </View>
    )
  }

  const noneSelected = !options.some((option) => option.selected)
  return (
    <ScrollView contentContainerClassName="gap-1 pb-2">
      {reference.list?.truncated === true ? (
        <Text testID={`relationship-truncated-${name}`} className="text-sm text-muted-foreground">
          목록의 앞 {REFERENCE_PAGE_SIZE}개만 표시했습니다.
        </Text>
      ) : null}
      {reference.writable ? null : (
        <Text className="text-sm text-muted-foreground">
          이 목록은 읽기 전용이라 여기서 새로 만들 수 없습니다.
        </Text>
      )}
      {relationship.cardinality === 'one' ? (
        <OptionRow
          testID={`relationship-none-${name}`}
          label={NONE_LABEL}
          multiple={false}
          selected={noneSelected}
          onPress={() => {
            onChoose(null)
          }}
        />
      ) : null}
      {options.map((option) => (
        <OptionRow
          key={option.id}
          testID={`relationship-option-${name}`}
          label={labelOf(option)}
          multiple={relationship.cardinality === 'many'}
          selected={option.selected}
          onPress={() => {
            onChoose(option.id)
          }}
        />
      ))}
    </ScrollView>
  )
}

/** 보기 한 줄. testID 는 글자에 단다 - 플로가 testID 와 보기 이름을 함께 찾는다. */
function OptionRow({
  testID,
  label,
  multiple,
  selected,
  onPress,
}: {
  testID: string
  label: string
  multiple: boolean
  selected: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole={multiple ? 'checkbox' : 'radio'}
      accessibilityState={multiple ? { checked: selected } : { selected }}
      onPress={onPress}
      className={cn(
        'rounded-md border px-3 py-3',
        selected ? 'border-primary bg-primary/10' : 'border-transparent active:bg-accent',
      )}
    >
      <Text testID={testID} className={cn('text-base', selected && 'font-semibold')}>
        {label}
      </Text>
    </Pressable>
  )
}
```

- [ ] **Step 2: 삭제 확인 시트, 상세의 진입점·빈 값 testID, 도구 줄의 자리**

`components/app/confirm-sheet.tsx` 를 만든다:

```tsx
import type { MutationKey } from '@tanstack/react-query'
import { ActivityIndicator, View } from 'react-native'

import { Sheet } from '@/components/app/sheet'
import { FormBanner } from '@/components/form/form-banner'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { useSubmitOnce } from '@/queries/submit-once'

/**
 * 되돌릴 수 없는 일을 하기 전의 확인 - 수정 화면의 삭제 확인 대화상자(스펙 8.1). 목록의 필터·정렬과
 * 같은 아래 시트(`Sheet`) 위에 그린다 - 새 대화상자 부품을 들이지 않고, 시트 안의 요소를 E2E 가
 * 찾는 방식(`Sheet` 의 주석)을 그대로 물려받는다.
 *
 * 확인하는 동안에는 두 버튼을 막고 확인 버튼이 글자 대신 스피너만 그린다(스펙 8.7). 확인은 한 번에 하나다 -
 * 확인이 부르는 쓰기의 키로 진행 중인 쓰기를 본다(queries/submit-once.ts). 실패하면 시트를 닫지 않고 그
 * 문구를 시트 안에 그린다 - 사용자가 다시 확인하거나 취소한다.
 *
 * testID 는 `testID`(시트), `<testID>-accept`, `<testID>-cancel` 이다 - E2E 플로(test/e2e/)가 찾는다.
 */
export function ConfirmSheet({
  open,
  testID,
  title,
  message,
  confirmLabel,
  pending,
  mutationKey,
  messages,
  onConfirm,
  onCancel,
}: {
  open: boolean
  testID: string
  title: string
  message: string
  confirmLabel: string
  pending: boolean
  /** 확인이 부르는 쓰기의 키 - 쓰기 훅의 `mutationKey` 다. */
  mutationKey: MutationKey
  /** 확인이 실패했을 때의 문구 - 없으면 빈 배열이다. */
  messages: readonly string[]
  onConfirm: () => void
  onCancel: () => void
}) {
  const submitOnce = useSubmitOnce(mutationKey)
  return (
    <Sheet open={open} onClose={pending ? () => undefined : onCancel} testID={testID}>
      <View role="alertdialog" className="gap-3">
        <Text variant="large">{title}</Text>
        <Text className="text-sm text-muted-foreground">{message}</Text>
        <FormBanner messages={messages} />
        <View className="flex-row justify-end gap-2">
          <Button
            testID={`${testID}-cancel`}
            variant="outline"
            disabled={pending}
            onPress={onCancel}
          >
            <Text>취소</Text>
          </Button>
          <Button
            testID={`${testID}-accept`}
            variant="destructive"
            accessibilityLabel={confirmLabel}
            aria-busy={pending}
            disabled={pending}
            onPress={() => {
              submitOnce(onConfirm)
            }}
          >
            {pending ? (
              <ActivityIndicator colorClassName="accent-white" />
            ) : (
              <Text>{confirmLabel}</Text>
            )}
          </Button>
        </View>
      </View>
    </Sheet>
  )
}
```

빈 값과 관계 배지가 상세에서 testID 를 받는다(목록의 행은 주지 않는다). 이 파일은 전체를 바꾸므로 D3 의 판 그대로인지 먼저 본다(결정 31):

```bash
git rev-parse HEAD:components/resource/values.tsx
```

Expected: `22d1653ab4365fbe450eef588bf174c544a8ae90`(D3 계획의 판이고 2026-10-01 04:04 의 D3 브랜치 `b06955c` 도 같다). 다르면 `git log -p -- components/resource/values.tsx` 에서 그 뒤의 변경을 찾아 아래 판에 옮겨 적은 뒤 바꾼다.

`components/resource/values.tsx` 전체를 바꾼다:

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

/** `testID` 는 상세가 준다 - 비어 있는 항목도 E2E 가 찾을 수 있다. */
export function EmptyValue({ testID }: { testID?: string }) {
  return (
    <Text testID={testID} className="text-sm text-muted-foreground">
      {EMPTY_VALUE}
    </Text>
  )
}

/**
 * 관계 대상들의 배지. 이름은 `lib/resources/view.ts` 의 `relatedText` 가 정한다. `testID` 를 주면 배지
 * 글자마다 `<testID>-<위치>` 를 단다 - 상세가 주고 E2E 가 순서를 읽는다(목록의 행은 주지 않는다).
 */
export function RelatedBadges({ values, testID }: { values: readonly string[]; testID?: string }) {
  return (
    <View className="flex-row flex-wrap gap-1">
      {values.map((value, position) => (
        // 같은 이름이 두 번 올 수 있어(서로 다른 id 의 동명 라벨) 위치를 키에 섞는다.
        <Badge key={`${position}-${value}`} variant="secondary">
          <Text testID={testID === undefined ? undefined : `${testID}-${position}`}>{value}</Text>
        </Badge>
      ))}
    </View>
  )
}
```

`components/resource/resource-detail.tsx` — Edit, 찾을 것 `import { ScrollView, View } from 'react-native'` — 바꿀 것:

```tsx
import type { ReactNode } from 'react'
import { ScrollView, View } from 'react-native'
```

같은 파일에 Edit, 찾을 것:

```tsx
 * 온다(자원 이름으로 분기하지 않는다).
```

바꿀 것:

```tsx
 * 온다(자원 이름으로 분기하지 않는다). 관계의 배지는 `detail-badge-<항목 키>-<위치>`, 빈 항목은
 * `detail-value-<항목 키>` 다. `actions` 는 항목 아래에 그린다(화면의 "수정" 같은 이동) - 상세를 그릴
 * 때만 보인다.
```

같은 파일에 Edit, 찾을 것:

```tsx
export function ResourceDetailView({
  detail,
  labels,
}: {
  detail: ResourceDetailState
  /** 스켈레톤의 줄 수 - `detailLabels`(선언만으로 정해진다). */
  labels: readonly DetailLabel[]
}) {
```

바꿀 것:

```tsx
export function ResourceDetailView({
  detail,
  labels,
  actions,
}: {
  detail: ResourceDetailState
  /** 스켈레톤의 줄 수 - `detailLabels`(선언만으로 정해진다). */
  labels: readonly DetailLabel[]
  actions?: ReactNode
}) {
```

같은 파일에 Edit, 찾을 것:

```tsx
          <FieldValue field={field} />
        </View>
      ))}
    </ScrollView>
```

바꿀 것:

```tsx
          <FieldValue field={field} />
        </View>
      ))}
      {actions}
    </ScrollView>
```

같은 파일에 Edit, 찾을 것:

```tsx
  if (field.values.length === 0) return <EmptyValue />
  if (field.kind === 'relationship') return <RelatedBadges values={field.values} />
```

바꿀 것:

```tsx
  if (field.values.length === 0) return <EmptyValue testID={`detail-value-${field.key}`} />
  if (field.kind === 'relationship') {
    return <RelatedBadges values={field.values} testID={`detail-badge-${field.key}`} />
  }
```

`components/resource/sort-sheet.tsx` — Edit, 찾을 것 `import SlidersHorizontal from 'lucide-react-native/icons/sliders-horizontal'` — 바꿀 것:

```tsx
import SlidersHorizontal from 'lucide-react-native/icons/sliders-horizontal'
import type { ReactNode } from 'react'
```

같은 파일에 Edit, 찾을 것:

```tsx
 * testID 는 E2E 플로(test/e2e/)가 찾는 이름이다 - 항목은 `sort-option-<정렬 키>`.
```

바꿀 것:

```tsx
 * testID 는 E2E 플로(test/e2e/)가 찾는 이름이다 - 항목은 `sort-option-<정렬 키>`. `children` 은 도구 줄
 * 오른쪽 끝에 그린다 - 화면이 주는 이동("새로 만들기" 같은)의 자리다.
```

같은 파일에 Edit, 찾을 것:

```tsx
export function ListToolbar({
  sortOptions,
  onFilter,
  onSort,
}: {
  sortOptions: readonly SortOption[]
  onFilter: () => void
  onSort: () => void
}) {
```

바꿀 것:

```tsx
export function ListToolbar({
  sortOptions,
  onFilter,
  onSort,
  children,
}: {
  sortOptions: readonly SortOption[]
  onFilter: () => void
  onSort: () => void
  children?: ReactNode
}) {
```

같은 파일에 Edit, 찾을 것:

```tsx
        <Text>{current === undefined ? '정렬' : current.label}</Text>
      </Button>
    </View>
```

바꿀 것:

```tsx
        <Text>{current === undefined ? '정렬' : current.label}</Text>
      </Button>
      {children === undefined ? null : <View className="ml-auto">{children}</View>}
    </View>
```

- [ ] **Step 3: 생성·수정·삭제 화면과 목록·상세의 진입점**

생성은 만들면 이 화면을 새 자원의 상세로 바꾼다(`router.replace`). 수정은 저장하면 상세로 돌아가고(`router.dismissTo`), 삭제는 확인 시트를 거쳐 이 자원을 보던 목록까지 닫는다(`StackActions.popTo(…, { merge: true })` — 목록의 조건을 둔다, 결정 7). 수정 화면은 `id` 를 이름으로만 꺼내고(전역 제약), 지운 뒤에는 상세 조회를 끈다(결정 8).

`new.tsx` 는 전체를 바꾸므로 D2 가 둔 자리 그대로인지 먼저 본다(결정 31):

```bash
git rev-parse "HEAD:app/(app)/examples/new.tsx"
```

Expected: `b1212f246ede3133d37e01919f2332b9cac38ff4`. 다르면 `git log -p -- "app/(app)/examples/new.tsx"` 에서 D2 뒤의 변경을 찾아 아래 판에 옮겨 적은 뒤 바꾼다.

`app/(app)/examples/new.tsx` 전체를 바꾼다:

```tsx
import { router, Stack } from 'expo-router'
import { View } from 'react-native'

import { ResourceForm } from '@/components/resource/resource-form'
import { EXAMPLE } from '@/lib/resources'
import { newFormValues } from '@/lib/resources/form'
import { useRelationshipReferences } from '@/queries/resources'
import { useCreateResource } from '@/queries/writes'

/**
 * Example 생성 - 스펙 8.1(보호 경로, lib/auth/protected-paths.ts). 필수 입력, 분류 단일 선택, 태그
 * 다중 선택. 만들면 이 화면을 새 자원의 상세로 바꾼다 - 뒤로 가기가 이 폼이 아니라 온 곳(목록)으로
 * 간다.
 *
 * 라우트 파라미터를 읽지 않는다 - 로그인 뒤 복귀(withAnchor)가 싣는 `initial` 같은 값이 섞여 와도 폼의
 * 첫 값은 선언에서만 온다(`newFormValues`).
 *
 * 이 파일에는 훅 호출과 JSX 만 있다(스펙 8.4) - 폼의 판단은 lib/resources/form.ts, 쓰기의 흐름은
 * lib/resources/write.ts, 요청과 캐시는 queries/ 가 한다.
 */
export default function NewExampleScreen() {
  const references = useRelationshipReferences(EXAMPLE)
  const create = useCreateResource(EXAMPLE)

  return (
    <View testID="new-example-screen" className="flex-1 bg-background">
      <Stack.Screen options={{ title: 'Example 만들기' }} />
      <ResourceForm
        resource={EXAMPLE}
        references={references}
        initialValues={newFormValues(EXAMPLE)}
        state={create.state}
        pending={create.pending}
        mutationKey={create.mutationKey}
        submitLabel="만들기"
        onSubmit={(values) => {
          create.submit(values, (id) => {
            router.replace({ pathname: '/examples/[id]', params: { id } })
          })
        }}
      />
    </View>
  )
}
```

`app/(app)/examples/[id]/edit.tsx` 를 만든다:

```tsx
import { router, Stack, useLocalSearchParams, useNavigation } from 'expo-router'
import { StackActions } from 'expo-router/react-navigation'
import { useState } from 'react'
import { View } from 'react-native'

import { ConfirmSheet } from '@/components/app/confirm-sheet'
import { ResourceEditGate, ResourceForm } from '@/components/resource/resource-form'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { EXAMPLE } from '@/lib/resources'
import { useRelationshipReferences, useResourceDetail } from '@/queries/resources'
import { useDeleteResource, useUpdateResource } from '@/queries/writes'

/**
 * Example 수정·삭제 - 스펙 8.1(보호 경로, lib/auth/protected-paths.ts). 폼은 상세와 같은 응답으로
 * 기존 값을 채운다. 저장하면 상세로 돌아가고, 삭제는 확인 시트를 거쳐 이 자원을 보던 목록으로
 * 돌아간다. 없는 id 면 not-found 다.
 *
 * 이 파일에는 훅 호출과 JSX 만 있다(스펙 8.4).
 */

/**
 * 목록 화면의 이름 - 앱 셸(`app/(app)/_layout.tsx`)의 Stack 이 `app/(app)/examples/index.tsx` 에 붙인
 * 이름이다. 삭제 뒤 돌아갈 때만 쓴다(아래 주석).
 */
const LIST_SCREEN = 'examples/index'

export default function EditExampleScreen() {
  // id 만 이름으로 꺼낸다 - 로그인 뒤 복귀(withAnchor)가 싣는 initial 같은 값도 라우트 파라미터에 섞여
  // 온다(lib/resources/AGENTS.md 의 "라우트 파라미터"). 파라미터 전체를 펼치거나 돌지 않는다.
  const { id } = useLocalSearchParams<{ id: string }>()
  // 같은 화면이 다른 id 로 다시 쓰이면(딥링크는 지금 화면과 이름이 같으면 그 화면을 쓴다) 폼의 첫
  // 값과 쓰기 상태를 처음부터 만든다 - 앞 자원의 입력이나 "없다" 가 남지 않는다.
  return <EditExample key={id} id={id} />
}

function EditExample({ id }: { id: string }) {
  const navigation = useNavigation()
  const update = useUpdateResource(EXAMPLE, id)
  const remove = useDeleteResource(EXAMPLE, id)
  // 지운 뒤에는 상세를 부르지 않는다 - 삭제가 캐시에서 지운 상세를 이 화면이 다시 그리며 되살리면 없는
  // 자원을 부른다(404, queries/writes.ts 의 deleted).
  const detail = useResourceDetail(EXAMPLE, id, { enabled: !remove.deleted })
  const references = useRelationshipReferences(EXAMPLE)
  const [confirming, setConfirming] = useState(false)

  return (
    <View testID="edit-example-screen" className="flex-1 bg-background">
      <Stack.Screen options={{ title: 'Example 수정' }} />
      <ResourceEditGate resource={EXAMPLE} detail={detail} gone={update.gone}>
        {(initialValues) => (
          <ResourceForm
            resource={EXAMPLE}
            references={references}
            initialValues={initialValues}
            state={update.state}
            pending={update.pending}
            mutationKey={update.mutationKey}
            submitLabel="저장"
            onSubmit={(values) => {
              update.submit(values, () => {
                // 상세로 돌아간다 - 스택에 상세 화면이 있으면 거기까지 닫고 그 화면이 이 자원을 그린다
                // (dismissTo 는 이름으로 찾아 파라미터를 덮는다). 없으면(딥링크로 곧장 왔으면) 이 화면을
                // 상세로 바꾼다.
                router.dismissTo({ pathname: '/examples/[id]', params: { id } })
              })
            }}
            footer={
              <Button
                testID="delete-button"
                variant="outline"
                onPress={() => {
                  setConfirming(true)
                }}
              >
                <Text className="text-destructive">삭제</Text>
              </Button>
            }
          />
        )}
      </ResourceEditGate>
      <ConfirmSheet
        open={confirming}
        testID="delete-confirm"
        title="Example 삭제"
        message="이 Example 을 지웁니다. 되돌릴 수 없습니다."
        confirmLabel="삭제"
        pending={remove.pending}
        mutationKey={remove.mutationKey}
        messages={remove.messages}
        onCancel={() => {
          setConfirming(false)
        }}
        onConfirm={() => {
          remove.remove(() => {
            setConfirming(false)
            // 이 자원을 보던 목록까지 닫는다 - 지운 자원의 상세도 함께 닫힌다. 목록의 조건(라우트
            // 파라미터)은 그대로 둔다(merge): router.dismissTo('/examples') 는 목록의 파라미터를 덮어
            // 필터가 사라진다. 스택에 목록이 없으면(딥링크) 이 화면을 조건 없는 목록으로 바꾼다.
            navigation.dispatch(StackActions.popTo(LIST_SCREEN, undefined, { merge: true }))
          })
        }}
      />
    </View>
  )
}
```

`app/(app)/examples/index.tsx` — Edit, 찾을 것 `import { ListToolbar, SortSheet } from '@/components/resource/sort-sheet'` — 바꿀 것:

```tsx
import { ListToolbar, SortSheet } from '@/components/resource/sort-sheet'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
```

같은 파일에 Edit, 찾을 것:

```tsx
 * lib/resources/view.ts, 요청과 캐시는 queries/resources.ts 가 한다.
 */
```

바꿀 것:

```tsx
 * lib/resources/view.ts, 요청과 캐시는 queries/resources.ts 가 한다.
 *
 * "새로 만들기" 는 누구에게나 보인다 - 생성 화면은 보호 경로라 세션이 없으면 경로 가드가 로그인으로
 * 보내고, 로그인하면 생성 화면으로 돌아온다(스펙 7.3). 행·조건 바꾸기와 같이 이동 가드를 지난다.
 */
```

같은 파일에 Edit, 찾을 것:

```tsx
        onSort={() => {
          setSheet('sort')
        }}
      />
```

바꿀 것:

```tsx
        onSort={() => {
          setSheet('sort')
        }}
      >
        <Button
          testID="new-example-link"
          size="sm"
          onPress={() => {
            navigateOnce(() => {
              router.push('/examples/new')
            })
          }}
        >
          <Text>새로 만들기</Text>
        </Button>
      </ListToolbar>
```

`app/(app)/examples/[id]/index.tsx` — Edit, 찾을 것:

```tsx
import { Stack, useLocalSearchParams } from 'expo-router'

import { ResourceDetailView } from '@/components/resource/resource-detail'
```

바꿀 것:

```tsx
import { router, Stack, useLocalSearchParams } from 'expo-router'

import { useNavigateOnce } from '@/components/app/navigate-once'
import { ResourceDetailView } from '@/components/resource/resource-detail'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
```

같은 파일에 Edit, 찾을 것:

```tsx
 * 이 파일에는 훅 호출과 JSX 만 있다(스펙 8.4).
 */
```

바꿀 것:

```tsx
 * 이 파일에는 훅 호출과 JSX 만 있다(스펙 8.4).
 *
 * "수정" 은 누구에게나 보인다 - 수정 화면은 보호 경로라 세션이 없으면 경로 가드가 로그인으로 보내고,
 * 로그인하면 수정 화면으로 돌아온다(스펙 7.3). 두 번 눌러도 수정 화면은 하나다(useNavigateOnce).
 */
```

같은 파일에 Edit, 찾을 것 `  const detail = useResourceDetail(EXAMPLE, id)` — 바꿀 것:

```tsx
  const detail = useResourceDetail(EXAMPLE, id)
  const navigateOnce = useNavigateOnce()
```

같은 파일에 Edit, 찾을 것 `      <ResourceDetailView detail={detail} labels={detailLabels(EXAMPLE)} />` — 바꿀 것:

```tsx
      <ResourceDetailView
        detail={detail}
        labels={detailLabels(EXAMPLE)}
        actions={
          <Button
            testID="edit-example-link"
            variant="outline"
            onPress={() => {
              navigateOnce(() => {
                router.push({ pathname: '/examples/[id]/edit', params: { id } })
              })
            }}
          >
            <Text>수정</Text>
          </Button>
        }
      />
```

- [ ] **Step 4: `components/resource/AGENTS.md` 를 고친다**

`components/resource/AGENTS.md` — Edit, 찾을 것:

```markdown
`lib/resources/view.ts`·`screen-state.ts` 가 선언과 조회 결과에서 정해 온다(`ListScreen`·`DetailScreen`·
`FilterField`·`SortOption`). 분기해도 되는 것은 구조뿐이다: 화면·칸·항목의 `kind`, 필터 필드의 `kind`·`shape`·
`operator`, 정렬 항목의 `direction`.
```

바꿀 것:

```markdown
`lib/resources/view.ts`·`screen-state.ts`·`form.ts` 가 선언과 조회 결과에서 정해 온다(`ListScreen`·`DetailScreen`·
`FilterField`·`SortOption`·`RelationshipChoice`·`ReferenceState`). 분기해도 되는 것은 구조뿐이다: 화면·칸·항목·속성의
`kind`, 필터 필드의 `kind`·`shape`·`operator`, 정렬 항목의 `direction`, 관계의 `cardinality`.
```

`components/resource/AGENTS.md` — Edit, 찾을 것(파일 표의 `values.tsx` 행 - 칸 맞춤 공백 앞까지. 그 뒤에 행 둘을 잇는다):

```markdown
빈 값(`—`)과 관계 배지 - 목록과 상세가 같이 쓴다
```

바꿀 것:

```markdown
빈 값(`—`)과 관계 배지 - 목록과 상세가 같이 쓴다 |
| `resource-form.tsx` | 생성·수정 폼 - 속성의 `kind` 마다 입력, 관계마다 선택기, 배너·필드 오류, 제출 버튼. 수정 폼의 자리(`ResourceEditGate` - 스켈레톤·not-found·닿지 못함·배너, 첫 값은 처음 받은 상세 하나로 고정) |
| `relationship-picker.tsx` | 관계 선택기 - 고른 것을 배지로, 누르면 아래 시트에 참조 목록. to-one 은 "선택 안 함" 과 하나, to-many 는 켜고 끄기(고른 순서 유지). 목록 밖 선택·잘림·읽기 전용 안내
```

`components/resource/AGENTS.md` — Edit, 찾을 것:

```markdown
  `filter-option-<키>-<연산자>-<값|any>`·`filter-input-<키>-<연산자>`·`sort-option-<정렬 키>`·`detail-value-<항목 키>` -
  의 규칙을 바꾸면 플로도 함께 바꾼다. `detail-value-<항목 키>` 는 값이 있는 속성에만 붙는다 - 관계 배지와 빈 값(`—`)에는
  없어 E2E 는 글자로 찾는다.
```

바꿀 것:

```markdown
  `filter-option-<키>-<연산자>-<값|any>`·`filter-input-<키>-<연산자>`·`sort-option-<정렬 키>`·`detail-value-<항목 키>`·
  `detail-badge-<항목 키>-<위치>`·`field-label-<속성>`·`field-input-<속성>`·`field-choice-<속성>-<값>`·`field-error-<속성>`·
  `relationship-open|value|option|none|done|error|unlisted|truncated-<관계>` - 의 규칙을 바꾸면 플로도 함께 바꾼다.
  상세의 `detail-value-<항목 키>` 는 값이 있는 속성과 빈 값(`—`)에 붙고, 관계 배지는 `detail-badge-<항목 키>-<위치>` 다 -
  E2E 가 배지의 순서를 읽는다.
- 폼의 제출은 한 번에 하나다 - 쓰기 훅의 `mutationKey` 를 받아 `useSubmitOnce` 로 감싼다(`queries/AGENTS.md`).
- 폼은 입력을 검증하지 않는다 - 정본 검증자는 백엔드다. 필드 오류·관계 오류·배너의 자리는 `form.ts` 의
  `formStateFromErrors` 가 포인터로 정해 온다(스펙 9.1).
```

`components/resource/AGENTS.md` — Edit, 찾을 것 `- 아래 여백: 목록·상세의 끝과 시트의 아래는` — 바꿀 것 `- 아래 여백: 목록·상세·폼의 끝과 시트의 아래는`.

`components/resource/AGENTS.md` — Edit, 찾을 것:

```markdown
  `queries/resources.ts` 다. 주소로의 이동(`router.push`)은 화면(`app/`)이 한다.
```

바꿀 것:

```markdown
  `queries/resources.ts` 다. 주소로의 이동(`router.push`)은 화면(`app/`)이 한다 - 화면을 쌓는 이동은 한 번만 한다
  (`components/app/navigate-once.ts` 의 `useNavigateOnce` - 빠른 두 번 누름이 같은 화면을 두 벌 쌓지 않게).
```

- [ ] **Step 5: 정적 검사와 두 플랫폼 번들을 돌리고 커밋한다**

새 라우트(`[id]/edit`)가 생겼으므로 타입드 라우트를 다시 만든다. 번들은 이 저장소의 `expo start` 를 끄고 돌린다(`--clear`).

```bash
BACKEND_URL=https://gate-check.invalid pnpm types:routes
pnpm format
pnpm typecheck && pnpm lint && pnpm format:check && pnpm lint:secrets
./scripts/check-citations.sh app components lib platform queries test
pnpm test 2>&1 | grep -E "Test Files|Tests "
APP_VARIANT=production BACKEND_URL=https://gate-check.invalid pnpm exec expo export --clear --platform android --platform ios --output-dir dist > .maestro-output/d4-export.log 2>&1; echo "export exit=$?"
grep -c "Unable to resolve" .maestro-output/d4-export.log
rm -rf dist
git add app components
git status --short
git commit -m "feat: 생성·수정·삭제 화면과 관계 선택기를 더하고 목록·상세에 진입점을 둔다"
```

Expected: 검사 전부 exit 0, `Tests  1286 passed (1286)`(이 태스크는 시험을 더하지 않는다, 58 파일), `export exit=0`, `Unable to resolve` 0(`iOS Bundled`·`Android Bundled` 가 보인다), 남은 파일이 없다(`dist` 는 지웠고 `.expo/`·`.maestro-output/` 은 무시된다).

### Task 5: 쓰기 E2E, 기기에서의 실제 회전, 게이트

기기 작업은 이 태스크 하나다. 게이트 한 번(`./scripts/check.sh`)의 E2E 단계가 APK 를 한 번 빌드하고(Task 1–4 가 빌드 입력을 바꿨다 - 빌드 앞에 Metro 캐시를 비운다, 결정 38) 에뮬레이터·FastAPI 스택 한 세션에서 D2 의 일곱, D3 의 일곱, D4 의 넷 — 플로 열여덟을 돈다(결정 30).

**Files:**
- Modify: `docker-compose.e2e.yml`, `docs/provenance/copied-core.json`(이탈 하나), `test/e2e/run-android.sh`, `test/e2e/android.sh`(빌드 앞의 Metro 캐시 비우기 - L7), `test/e2e/scripts/examples-api.js`(전체), `test/e2e/flows/examples-scroll-refresh.yaml`(돌아온 목록의 재조회 - M2), `test/e2e/AGENTS.md`, `AGENTS.md`, 스펙 11.3 정정
- Create: `test/e2e/subflows/login.yaml`, `test/e2e/flows/examples-create.yaml`, `test/e2e/flows/examples-edit.yaml`, `test/e2e/flows/examples-delete.yaml`, `test/e2e/flows/examples-write-errors.yaml`, `docs/superpowers/notes/2026-10-01-d4-measurements.md`

**Interfaces:**
- Consumes: Task 4 의 testID(위 표), D3 의 하네스(`API_URL`·`api.log`·`logcat -G 16M`·지문·비행기 모드 끄기)와 `test/e2e/scripts/examples-api.js`·`examples-scroll-refresh.yaml`, D2 의 `subflows/start-signed-out.yaml`·`submit-credentials.yaml`, 씨앗의 분류·라벨과 채움 행
- Produces: 백엔드의 access token 수명 변수 `E2E_ACCESS_EXPIRES_SECONDS`(하네스 기본 10 → compose 의 `JWT_ACCESS_EXPIRES_SECONDS`, compose 기본 900), `examples-api.js` 의 `STEP=account|example|unlisted|delete|revoke`(`output.prefix`·`output.exampleId`, 401 이면 다시 로그인하는 `authed`), `subflows/login.yaml`, 플로 넷, 빌드마다 Metro 캐시를 비우는 `android.sh build`, D4 실측 기록 W1·W2·W3

- [ ] **Step 1: 백엔드의 access token 수명을 짧게 준다**

앱은 만료 60초 전부터 회전하므로 수명 10초의 access 는 쓰기마다 실제 회전을 지난다(결정 23, D2 결정 5). 세 백엔드가 같은 변수(`JWT_ACCESS_EXPIRES_SECONDS`, 기본 900)를 읽는다. `docker-compose.e2e.yml` 은 복사본이다 — 이탈을 적는다.

`docker-compose.e2e.yml` — Edit, 찾을 것:

```yaml
  JWT_ISSUER: template-ruby-rails
  JWT_AUDIENCE: template-ruby-rails
```

바꿀 것:

```yaml
  JWT_ISSUER: template-ruby-rails
  JWT_AUDIENCE: template-ruby-rails
  # access token 수명(초). 기본은 백엔드의 기본값과 같은 900 이다. Maestro 하네스
  # (test/e2e/run-android.sh)는 60 이하를 줘서 앱의 쓰기가 전부 실제 회전(스펙 7.2)을 지나게 한다.
  JWT_ACCESS_EXPIRES_SECONDS: '${E2E_ACCESS_EXPIRES_SECONDS:-900}'
```

같은 파일에 Edit, 찾을 것:

```yaml
      JWT_ISSUER: template-python-fastapi
      JWT_AUDIENCE: template-python-fastapi
```

바꿀 것:

```yaml
      JWT_ISSUER: template-python-fastapi
      JWT_AUDIENCE: template-python-fastapi
      # access token 수명(초). 기본은 백엔드의 기본값과 같은 900 이다. Maestro 하네스
      # (test/e2e/run-android.sh)는 60 이하를 줘서 앱의 쓰기가 전부 실제 회전(스펙 7.2)을 지나게 한다.
      JWT_ACCESS_EXPIRES_SECONDS: '${E2E_ACCESS_EXPIRES_SECONDS:-900}'
```

같은 파일에 Edit, 찾을 것:

```yaml
      JWT_ISSUER: template-typescript-nestjs
      JWT_AUDIENCE: template-typescript-nestjs
```

바꿀 것:

```yaml
      JWT_ISSUER: template-typescript-nestjs
      JWT_AUDIENCE: template-typescript-nestjs
      # access token 수명(초). 기본은 백엔드의 기본값과 같은 900 이다. Maestro 하네스
      # (test/e2e/run-android.sh)는 60 이하를 줘서 앱의 쓰기가 전부 실제 회전(스펙 7.2)을 지나게 한다.
      JWT_ACCESS_EXPIRES_SECONDS: '${E2E_ACCESS_EXPIRES_SECONDS:-900}'
```

Write 도구로 `.maestro-output/d4-provenance-compose.cjs` 를 아래 내용으로 쓰고 돌린다:

```js
const fs = require('node:fs')
const file = 'docs/provenance/copied-core.json'
const record = JSON.parse(fs.readFileSync(file, 'utf8'))
const COMPOSE = 'docker-compose.e2e.yml'
if (!record.paths.includes(COMPOSE)) throw new Error(`출처 기록에 없다: ${COMPOSE}`)
if (COMPOSE in (record.sourceBlobs ?? {})) throw new Error(`sourceBlobs 에 있다: ${COMPOSE}`)
record.divergences.push({
  path: COMPOSE,
  what: "세 백엔드의 환경(x-rails-env 앵커·api-fastapi·api-nestjs)에 JWT_ACCESS_EXPIRES_SECONDS 를 '${E2E_ACCESS_EXPIRES_SECONDS:-900}' 으로 더하고 그 뜻을 주석 두 줄로 적었다.",
  why: 'E2E 하네스(test/e2e/run-android.sh)가 access token 수명을 10초로 줘서 앱의 쓰기가 전부 실제 회전(스펙 7.2)을 지나게 한다 - 세 백엔드의 기본값 900초로는 플로 안에서 회전이 한 번도 일어나지 않는다(D2 계획의 결정 5 가 실제 회전 왕복을 D4 의 쓰기 E2E 에 넘겼다). 변수를 주지 않으면(게이트의 compose 설정 검사 등) 기본값 그대로다.',
})
fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`)
console.log(`경로 ${record.paths.length}개, 이탈 ${record.divergences.length}건`)
```

`test/e2e/run-android.sh` — Edit, 찾을 것:

```bash
#   E2E_FORCE_BUILD   1 이면 빌드 입력이 같아도 APK 를 다시 만든다
```

바꿀 것:

```bash
#   E2E_FORCE_BUILD   1 이면 빌드 입력이 같아도 APK 를 다시 만든다
#   E2E_ACCESS_EXPIRES_SECONDS
#                     백엔드의 access token 수명(초). 기본 10 - 60 이하라 앱이 쓰기마다 먼저 회전한다
#                     (lib/auth/session-manager.ts, 스펙 7.2). 플로가 앱 밖에서 쓰는 토큰(test/e2e/scripts/)도
#                     이 수명을 따른다
```

같은 파일에 Edit, 찾을 것:

```bash
export E2E_API_PORT="$API_PORT"
```

바꿀 것:

```bash
export E2E_API_PORT="$API_PORT"
# docker-compose.e2e.yml 이 세 백엔드의 JWT_ACCESS_EXPIRES_SECONDS 로 넘긴다.
export E2E_ACCESS_EXPIRES_SECONDS="${E2E_ACCESS_EXPIRES_SECONDS:-10}"
```

빌드 레시피가 APK 를 만들 때마다 Metro 의 디스크 캐시를 먼저 비운다(D3 실측 L7, 결정 38) — 재시도가 아니라 알려진 계기를 없앤다. `test/e2e/android.sh` — Edit, 찾을 것:

```bash
#                                   만든 APK 의 assets/app.config 가 e2e 변형인지 확인한다
```

바꿀 것:

```bash
#                                   빌드 앞에 Metro 의 디스크 캐시를 비우고, 만든 APK 의
#                                   assets/app.config 가 e2e 변형인지 확인한다
```

같은 파일에 Edit, 찾을 것:

```bash
build() {
  : "${BACKEND_URL:?BACKEND_URL 이 필요하다 - 에뮬레이터에서 호스트는 http://10.0.2.2:<포트>}"
  check_path || exit 1
  # prebuild 와 Gradle 이 같은 변형을 받도록 export 한다(접두 대입은 그 명령 하나에만 적용된다).
  export APP_VARIANT=e2e
  pnpm exec expo prebuild --platform android --clean --no-install
  (cd android && ./gradlew assembleRelease)
```

바꿀 것:

```bash
# Metro 의 디스크 캐시(Metro 가 쓰는 os.tmpdir() 의 metro-cache - Windows 는 %TEMP%, 그 밖은 $TMPDIR)를 비운다. Gradle
# 의 번들 단계(createBundleReleaseJsAndAssets)가 번들을 다 쓴 뒤 node 의 종료에서 0xC0000005 로 죽은 빌드가 있었고, 이
# 캐시를 지운 뒤에는 재현되지 않았다(docs/superpowers/notes/2026-09-30-d3-measurements.md 의 L7). 그 번들 명령도
# --reset-cache 를 주므로 캐시가 원인이라는 증명은 아니다 - 재시도가 아니라, 알려진 계기를 빌드마다 없애 빌드가 늘
# 같은 자리에서 시작하게 한다. 지우지 못하면(개발 서버가 쥐고 있다 등) set -e 로 빌드하지 않고 멈춘다.
clear_metro_cache() {
  local cache
  cache=$(node -p 'require("path").join(require("os").tmpdir(), "metro-cache")')
  rm -rf "$cache"
  echo "Metro 캐시를 비웠다: $cache"
}

build() {
  : "${BACKEND_URL:?BACKEND_URL 이 필요하다 - 에뮬레이터에서 호스트는 http://10.0.2.2:<포트>}"
  check_path || exit 1
  # prebuild 와 Gradle 이 같은 변형을 받도록 export 한다(접두 대입은 그 명령 하나에만 적용된다).
  export APP_VARIANT=e2e
  pnpm exec expo prebuild --platform android --clean --no-install
  clear_metro_cache
  (cd android && ./gradlew assembleRelease)
```

```bash
node .maestro-output/d4-provenance-compose.cjs
node scripts/check-provenance.mjs | tail -n 1
bash -n test/e2e/run-android.sh && echo "syntax ok"
bash -n test/e2e/android.sh && echo "syntax ok"
node -e "const y=require('yaml');const d=y.parse(require('fs').readFileSync('docker-compose.e2e.yml','utf8'),{merge:true});for(const s of ['api-fastapi','api-nestjs','api-rails'])console.log(s,d.services[s].environment.JWT_ACCESS_EXPIRES_SECONDS)"
```

Expected: `경로 48개, 이탈 36건`, `복사 출처 기록 통과: 경로 48개, 이탈 36건, 원본 그대로 31개`, `syntax ok` 둘, 세 서비스 모두 `${E2E_ACCESS_EXPIRES_SECONDS:-900}`(Rails 는 `x-rails-env` 앵커로 받는다).

- [ ] **Step 2: 앱 밖에서 백엔드를 바꾸는 단계를 더한다**

쓰기 플로가 계정을 만들고(가입만), 고칠 행을 만들고, 자원과 세션을 앱 모르게 없앤다(결정 24). 토큰이 10초라 401 이면 한 번 다시 로그인한다 — D3 의 `seed|create|rename` 도 그 길을 탄다. 제목 접두사는 `d4-<이메일 끝 8자>` 다(결정 25).

이 파일은 전체를 바꾸므로 D3 계획이 만든 판 그대로인지 먼저 본다 — D3 의 Task 5 가 기기에서 고친 것을 조용히 지우지 않게(결정 31):

```bash
git rev-parse HEAD:test/e2e/scripts/examples-api.js
```

Expected: `2de615a82007a8531dacbf42b835cff4c76544d0`. 다르면 `git log -p -- test/e2e/scripts/examples-api.js` 에서 D3 계획 밖의 변경을 찾아 아래 판의 `seed`·`create`·`rename` 에 옮겨 적은 뒤 바꾼다.

`test/e2e/scripts/examples-api.js` 전체를 바꾼다:

```js
/* global http, json, output, API_URL, EMAIL, PASSWORD, STEP, COUNT, TITLE */
/**
 * E2E 가 앱 밖에서 백엔드를 바꾸는 단계 - 볼 행을 만들고, 앱이 모르는 사이에 자원이나 세션을 없앤다.
 *
 * Maestro 의 runScript 로 돈다. 에뮬레이터가 아니라 호스트의 GraalJS 에서 돌아서 백엔드에
 * 호스트 주소(API_URL, 하네스가 -e 로 준다)로 닿는다. http·json·output 은 Maestro 가 주는 전역이다.
 * 이 요청들은 앱을 지나지 않으므로 기기 로그의 가드(test/e2e/guard-log.sh)에 걸리지 않는다.
 *
 *   STEP=seed     EMAIL·PASSWORD 로 가입·로그인하고 행 COUNT 개(제목 `<prefix> 01` …)를 만든다.
 *                 output.prefix(이 실행만의 제목 접두사 `probe-d3-<12자>`)·output.firstId 를 남긴다
 *   STEP=create   제목이 TITLE 인 행 하나를 만든다(seed 뒤에만)
 *   STEP=rename   첫 행(`<prefix> 01`)의 제목을 TITLE 로 바꾼다(seed 뒤에만)
 *   STEP=account  EMAIL·PASSWORD 로 가입만 한다 - 앱이 그 계정으로 로그인한다. output.prefix(쓰기 플로의
 *                 짧은 제목 접두사 `d4-<8자>`)를 남긴다
 *   STEP=example  제목이 TITLE 인 행 하나를 모든 속성과 분류 하나·태그 둘까지 채워 만든다 - output.exampleId.
 *                 태그는 씨앗 id 의 반대 순서(둘, 하나)로 보낸다
 *   STEP=unlisted 제목이 TITLE 인 행 하나를 참조 목록(이름 순 100건) 밖의 분류·태그(씨앗의 `…-098` 채움 행)로
 *                 만든다 - output.exampleId. 선택기가 "목록에 없는 선택" 을 그리는 상태다
 *   STEP=delete   output.exampleId 를 지운다 - 앱이 모르는 사이에 없어진 자원을 만든다
 *   STEP=revoke   EMAIL 사용자의 refresh 세션을 전부 끊는다 - 폐기된 refresh 를 다시 내밀면 백엔드가 그
 *                 사용자의 세션을 모두 폐기한다(lib/auth/rotation.ts 머리말의 실측). 앱의 다음 회전이
 *                 TOKEN_REVOKED 를 받는다
 *
 * access token 은 한 번 로그인해 output.token 에 두고 다시 쓴다. 하네스가 백엔드의 access token 수명을
 * 짧게 주므로(E2E_ACCESS_EXPIRES_SECONDS) 401 을 받으면 한 번 다시 로그인해 같은 요청을 보낸다.
 *
 * 실패하면 던진다 - Maestro 가 그 단계를 실패로 적고 플로가 멈춘다.
 */
const MEDIA_TYPE = 'application/vnd.api+json'

/** 씨앗의 분류·태그 id - test/e2e/seed/examples.sql 이 정본이다. */
const SEED_CATEGORY_ONE = '11110000-0000-4000-8000-000000000001'
const SEED_TAG_ONE = '22220000-0000-4000-8000-000000000001'
const SEED_TAG_TWO = '22220000-0000-4000-8000-000000000002'
/** 이름 순 101번째라 참조 목록(100건)에 들지 않는 채움 행 - 씨앗 파일의 "왜 99건인가" 절. */
const SEED_CATEGORY_UNLISTED = '11119999-0000-4000-8000-000000000098'
const SEED_TAG_UNLISTED = '22229999-0000-4000-8000-000000000098'

function send(method, path, body, token) {
  const headers = { 'Content-Type': MEDIA_TYPE, Accept: MEDIA_TYPE }
  if (token !== undefined) headers.Authorization = `Bearer ${token}`
  const options = { method, headers }
  if (body !== undefined) options.body = JSON.stringify(body)
  return http.request(`${API_URL}${path}`, options)
}

function expectOk(method, path, response) {
  if (!response.ok) throw new Error(`${method} ${path} → ${response.status} ${response.body}`)
  return response.status === 204 ? null : json(response.body)
}

function call(method, path, body, token) {
  return expectOk(method, path, send(method, path, body, token))
}

function credentials(type) {
  return { data: { type, attributes: { email: EMAIL, password: PASSWORD } } }
}

function login() {
  return call('POST', '/api/v1/auth/login', credentials('authCredentials')).data.attributes
}

/** 인증이 필요한 요청 - 토큰이 만료돼 401 이면 한 번 다시 로그인한다. */
function authed(method, path, body) {
  if (output.token === undefined) output.token = login().accessToken
  let response = send(method, path, body, output.token)
  if (response.status === 401) {
    output.token = login().accessToken
    response = send(method, path, body, output.token)
  }
  return expectOk(method, path, response)
}

function refresh(refreshToken) {
  return send('POST', '/api/v1/auth/refresh', {
    data: { type: 'refreshTokens', attributes: { refreshToken } },
  })
}

function createExample(title) {
  const document = { data: { type: 'examples', attributes: { title, status: 'draft', score: 50 } } }
  return authed('POST', '/api/v1/examples', document).data.id
}

/** 이메일 로컬 파트의 끝 n 자 - 실행·플로마다 다르다(test/e2e/probe-email.ts). */
function emailTail(length) {
  return EMAIL.split('@')[0].slice(-length)
}

if (STEP === 'seed') {
  call('POST', '/api/v1/auth/register', credentials('users'))
  output.token = login().accessToken
  // 제목 접두사로 좁혀 다른 실행의 행이 목록 단언을 흔들지 못하게 한다(스펙 11.3).
  output.prefix = `probe-d3-${emailTail(12)}`
  for (let n = 1; n <= Number(COUNT); n += 1) {
    const id = createExample(`${output.prefix} ${String(n).padStart(2, '0')}`)
    if (n === 1) output.firstId = id
  }
} else if (STEP === 'create') {
  createExample(TITLE)
} else if (STEP === 'rename') {
  authed('PATCH', `/api/v1/examples/${output.firstId}`, {
    data: { type: 'examples', id: output.firstId, attributes: { title: TITLE } },
  })
} else if (STEP === 'account') {
  call('POST', '/api/v1/auth/register', credentials('users'))
  // 수정 플로가 제목을 지우고 다시 쓴다 - Maestro 가 입력을 누르면 커서가 누른 자리에 서므로, 제목이
  // 입력 칸의 절반보다 짧아야 커서가 끝에 선다. 그래서 짧게 둔다.
  output.prefix = `d4-${emailTail(8)}`
} else if (STEP === 'example') {
  const document = {
    data: {
      type: 'examples',
      attributes: { title: TITLE, description: 'd4 note', status: 'active', score: 55 },
      relationships: {
        category: { data: { type: 'exampleCategories', id: SEED_CATEGORY_ONE } },
        tags: {
          data: [
            { type: 'exampleTags', id: SEED_TAG_TWO },
            { type: 'exampleTags', id: SEED_TAG_ONE },
          ],
        },
      },
    },
  }
  output.exampleId = authed('POST', '/api/v1/examples', document).data.id
} else if (STEP === 'unlisted') {
  const document = {
    data: {
      type: 'examples',
      attributes: { title: TITLE, status: 'draft', score: 1 },
      relationships: {
        category: { data: { type: 'exampleCategories', id: SEED_CATEGORY_UNLISTED } },
        tags: { data: [{ type: 'exampleTags', id: SEED_TAG_UNLISTED }] },
      },
    },
  }
  output.exampleId = authed('POST', '/api/v1/examples', document).data.id
} else if (STEP === 'delete') {
  authed('DELETE', `/api/v1/examples/${output.exampleId}`)
} else if (STEP === 'revoke') {
  const first = login().refreshToken
  expectOk('POST', '/api/v1/auth/refresh', refresh(first))
  // 방금 폐기된 refresh 를 다시 내민다 - 백엔드가 이 사용자의 세션을 전부 폐기한다(앱의 것도).
  const reused = refresh(first)
  if (reused.status !== 401) {
    throw new Error(
      `폐기된 refresh 를 다시 내밀었는데 401 이 아니다: ${reused.status} ${reused.body}`,
    )
  }
  output.token = undefined
} else {
  throw new Error(`STEP 을 모른다: ${STEP}`)
}
```

로그인 서브플로 — 계정은 앞 단계가 만든다. `test/e2e/subflows/login.yaml` 를 만든다:

```yaml
# 로그인 화면을 열어 EMAIL·PASSWORD 로 로그인한다 - 계정은 앞 단계가 만들어 둔다(스크립트의
# STEP=account 등). 앞 단계가 홈 화면을 기다려 두어야 한다(launchApp 직후의 딥링크는 버려진다).
appId: com.example.templateexpo.e2e
---
- openLink: templateexpo-e2e://login
- extendedWaitUntil:
    visible:
      id: login-screen
    timeout: 15000
- runFlow: submit-credentials.yaml
- extendedWaitUntil:
    visible:
      id: logout-button
    timeout: 20000
```

- [ ] **Step 3: 쓰기 플로 넷을 쓴다**

스펙 11.3 의 쓰기 행 — "필수 입력, 관계 선택·초기화, 기존 값 유지, 태그 순서, 삭제·실패 처리" — 를 네 플로가 나눠 잰다(결정 29). 입력한 뒤 아래쪽 요소를 누르기 전에 제목 라벨을 눌러 키보드를 내린다(결정 26).

생성 — 로그인하지 않은 채 "새로 만들기" 를 눌러 가드가 보낸 로그인 화면에서 뒤로 가면 홈이다(M5). 필수 칸·분류 하나·태그 둘(씨앗 id 의 반대 순서)로 만들고, 상세의 배지 순서와 온 목록의 새 행을 본다. 선택기의 잘림 안내를 본다. `test/e2e/flows/examples-create.yaml` 를 만든다:

```yaml
# 생성 - 목록의 "새로 만들기" 에서 필수 칸·분류 하나·태그 둘을 채워 만들면 새 자원의 상세로 가고, 뒤로
# 가면 온 목록(같은 조건의 같은 화면)에 새 행이 있다 - 목록 무효화(스펙 8.1·8.5·11.3). 태그는 씨앗 id 의
# 반대 순서(둘, 하나)로 골라 보내고, 상세는 백엔드가 정한 순서(씨앗 id 오름차순)로 그린다 - 폼은 고른
# 순서를 바꾸지 않는다(스펙 8.1 의 "순서 유지"). 참조 목록은 이름 순 100건에서 잘리고(씨앗의 채움 행)
# 선택기가 그 사실을 알린다. 쓰기는 먼저 회전을 지난다(하네스가 access 수명을 10초로 준다 - 스펙 7.2).
# 앞머리는 로그인하지 않은 채 "새로 만들기" 를 누른다 - 가드가 보낸 로그인 화면에서 뒤로 가면 앱이 닫히지
# 않고 홈이다(스펙 7.3 의 D4 정정).
appId: com.example.templateexpo.e2e
---
- runFlow: ../subflows/start-signed-out.yaml
- runScript:
    file: ../scripts/examples-api.js
    env:
      STEP: account
# 이 실행만의 행을 보는 목록 - 아직 비어 있다.
- openLink: templateexpo-e2e://examples?filter%5Btitle%5D%5Bcontains%5D=${output.prefix}
- extendedWaitUntil:
    visible:
      id: list-empty
    timeout: 20000
# 로그인하지 않았다 - 가드가 로그인으로 보내고, 거기서 뒤로 가면 홈이다(앱이 닫히면 홈이 보이지 않는다).
- tapOn:
    id: new-example-link
- extendedWaitUntil:
    visible:
      id: login-screen
    timeout: 15000
- pressKey: back
- extendedWaitUntil:
    visible:
      id: home-screen
    timeout: 15000
- assertNotVisible:
    id: login-screen
- runFlow: ../subflows/login.yaml
- openLink: templateexpo-e2e://examples?filter%5Btitle%5D%5Bcontains%5D=${output.prefix}
- extendedWaitUntil:
    visible:
      id: list-empty
    timeout: 20000
- tapOn:
    id: new-example-link
- extendedWaitUntil:
    visible:
      id: resource-form
    timeout: 20000
# 상태는 필수 enum 이라 첫 값(초안)이 골라진 채로 시작한다 - 활성으로 바꾼다. 입력 칸을 누르기 전이라
# 키보드가 없다.
- tapOn:
    id: field-choice-status-active
- tapOn:
    id: field-input-title
- inputText: ${output.prefix} c
- tapOn:
    id: field-input-description
- inputText: d4 note
# 제목 라벨을 눌러 키보드를 내린다 - 아래쪽 요소가 키보드 뒤에 있으면 누른 자리가 키보드로 간다.
- tapOn:
    id: field-label-title
- tapOn:
    id: field-input-score
- inputText: '42'
- tapOn:
    id: field-label-title
# 분류 하나 - 시트의 목록은 이름 순 100건에서 잘렸다(씨앗의 채움 행 101건).
- scrollUntilVisible:
    element:
      id: relationship-open-category
    direction: DOWN
- tapOn:
    id: relationship-open-category
- extendedWaitUntil:
    visible:
      id: relationship-option-category
      text: 프로브 분류 하나
    timeout: 20000
- assertVisible:
    id: relationship-truncated-category
- tapOn:
    id: relationship-option-category
    text: 프로브 분류 하나
- extendedWaitUntil:
    visible:
      id: relationship-value-category-0
      text: 프로브 분류 하나
    timeout: 10000
# 태그 둘 - 씨앗 id 의 반대 순서로 고른다. 폼은 고른 순서 그대로 그린다.
- scrollUntilVisible:
    element:
      id: relationship-open-tags
    direction: DOWN
- tapOn:
    id: relationship-open-tags
- extendedWaitUntil:
    visible:
      id: relationship-option-tags
      text: 프로브 라벨 둘
    timeout: 20000
- tapOn:
    id: relationship-option-tags
    text: 프로브 라벨 둘
- tapOn:
    id: relationship-option-tags
    text: 프로브 라벨 하나
- tapOn:
    id: relationship-done-tags
- assertVisible:
    id: relationship-value-tags-0
    text: 프로브 라벨 둘
- assertVisible:
    id: relationship-value-tags-1
    text: 프로브 라벨 하나
- scrollUntilVisible:
    element:
      id: submit-button
    direction: DOWN
- tapOn:
    id: submit-button
- extendedWaitUntil:
    visible:
      id: detail-heading
      text: ${output.prefix} c
    timeout: 20000
- assertVisible:
    id: detail-value-description
    text: d4 note
- assertVisible:
    id: detail-value-status
    text: 활성
- assertVisible:
    id: detail-value-score
    text: '42'
- scrollUntilVisible:
    element:
      id: detail-badge-tags-1
    direction: DOWN
- assertVisible:
    id: detail-badge-category-0
    text: 프로브 분류 하나
- assertVisible:
    id: detail-badge-tags-0
    text: 프로브 라벨 하나
- assertVisible:
    id: detail-badge-tags-1
    text: 프로브 라벨 둘
# 생성은 상세로 바꿔 들어갔다 - 뒤로 가면 온 목록이다. 비어 있던 그 목록이 다시 불려 새 행을 그린다.
- pressKey: back
- extendedWaitUntil:
    visible:
      id: resource-row-title
      text: ${output.prefix} c
    timeout: 20000
- assertNotVisible:
    id: list-empty
```

수정 — 기존 값, 제목만 바꾼 저장 뒤 나머지·관계·태그 순서, 목록의 새 제목, 관계 초기화, 참조 목록 밖의 선택(결정 27). `test/e2e/flows/examples-edit.yaml` 를 만든다:

```yaml
# 수정 - 목록 → 상세 → "수정" 의 폼이 기존 값(속성과 관계)을 채우고 있고, 제목만 바꿔 저장하면 상세와
# 목록이 새 제목을 그리며 나머지 값·관계·태그 순서는 그대로다 - 상세·목록 무효화(스펙 8.1·8.5·11.3).
# 이어서 분류를 "선택 안 함" 으로, 태그를 전부 해제해 저장하면 상세에서 둘 다 사라진다(관계 초기화).
# 끝으로 참조 목록(이름 순 100건) 밖의 분류·태그가 붙은 행을 고친다 - 폼은 그 선택을 id 로 그리고 알리며,
# 제목만 바꿔 저장해도 관계가 그대로 남는다(원본 템플릿이 한때 여기서 관계를 지웠다).
# 행은 이 플로가 백엔드에 직접 만든다(test/e2e/scripts/examples-api.js 의 STEP=example·unlisted) - 태그는
# 씨앗 id 의 반대 순서로 붙였고 앱은 백엔드의 순서(씨앗 id 오름차순)를 그린다.
appId: com.example.templateexpo.e2e
---
- runFlow: ../subflows/start-signed-out.yaml
- runScript:
    file: ../scripts/examples-api.js
    env:
      STEP: account
- runScript:
    file: ../scripts/examples-api.js
    env:
      STEP: example
      TITLE: ${output.prefix} a
- runFlow: ../subflows/login.yaml
- openLink: templateexpo-e2e://examples?filter%5Btitle%5D%5Bcontains%5D=${output.prefix}
- extendedWaitUntil:
    visible:
      id: resource-row-title
      text: ${output.prefix} a
    timeout: 20000
- tapOn:
    id: resource-row-title
    text: ${output.prefix} a
- extendedWaitUntil:
    visible:
      id: detail-heading
      text: ${output.prefix} a
    timeout: 20000
- scrollUntilVisible:
    element:
      id: edit-example-link
    direction: DOWN
- tapOn:
    id: edit-example-link
# 기존 값 - 속성 넷과 관계 둘(응답의 순서).
- extendedWaitUntil:
    visible:
      id: field-input-title
      text: ${output.prefix} a
    timeout: 20000
- assertVisible:
    id: field-input-description
    text: d4 note
- assertVisible:
    id: field-input-score
    text: '55'
- scrollUntilVisible:
    element:
      id: relationship-value-tags-1
    direction: DOWN
- assertVisible:
    id: relationship-value-category-0
    text: 프로브 분류 하나
- assertVisible:
    id: relationship-value-tags-0
    text: 프로브 라벨 하나
- assertVisible:
    id: relationship-value-tags-1
    text: 프로브 라벨 둘
# 제목만 바꾼다. 제목이 짧아 입력을 누르면 커서가 끝에 선다 - 지우고 다시 쓴다.
- scrollUntilVisible:
    element:
      id: field-input-title
    direction: UP
- tapOn:
    id: field-input-title
- eraseText: 30
- inputText: ${output.prefix} b
- tapOn:
    id: field-label-title
- scrollUntilVisible:
    element:
      id: submit-button
    direction: DOWN
- tapOn:
    id: submit-button
- extendedWaitUntil:
    visible:
      id: detail-heading
      text: ${output.prefix} b
    timeout: 20000
- assertVisible:
    id: detail-value-description
    text: d4 note
- assertVisible:
    id: detail-value-status
    text: 활성
- assertVisible:
    id: detail-value-score
    text: '55'
- scrollUntilVisible:
    element:
      id: detail-badge-tags-1
    direction: DOWN
- assertVisible:
    id: detail-badge-category-0
    text: 프로브 분류 하나
- assertVisible:
    id: detail-badge-tags-0
    text: 프로브 라벨 하나
- assertVisible:
    id: detail-badge-tags-1
    text: 프로브 라벨 둘
# 목록도 새 제목이다 - 옛 제목은 없다.
- pressKey: back
- extendedWaitUntil:
    visible:
      id: resource-row-title
      text: ${output.prefix} b
    timeout: 20000
- assertNotVisible:
    id: resource-row-title
    text: ${output.prefix} a
# 관계를 비운다 - 분류는 "선택 안 함", 태그는 둘 다 해제.
- tapOn:
    id: resource-row-title
    text: ${output.prefix} b
- extendedWaitUntil:
    visible:
      id: detail-heading
      text: ${output.prefix} b
    timeout: 20000
- scrollUntilVisible:
    element:
      id: edit-example-link
    direction: DOWN
- tapOn:
    id: edit-example-link
- extendedWaitUntil:
    visible:
      id: field-input-title
      text: ${output.prefix} b
    timeout: 20000
- scrollUntilVisible:
    element:
      id: relationship-open-tags
    direction: DOWN
- tapOn:
    id: relationship-open-category
- extendedWaitUntil:
    visible:
      id: relationship-none-category
    timeout: 20000
- tapOn:
    id: relationship-none-category
- tapOn:
    id: relationship-open-tags
- extendedWaitUntil:
    visible:
      id: relationship-option-tags
      text: 프로브 라벨 하나
    timeout: 20000
- tapOn:
    id: relationship-option-tags
    text: 프로브 라벨 하나
- tapOn:
    id: relationship-option-tags
    text: 프로브 라벨 둘
- tapOn:
    id: relationship-done-tags
- assertNotVisible:
    id: relationship-value-category-0
- assertNotVisible:
    id: relationship-value-tags-0
- scrollUntilVisible:
    element:
      id: submit-button
    direction: DOWN
- tapOn:
    id: submit-button
# 상세는 캐시를 먼저 그리고 다시 부른다 - 비워진 관계가 올 때까지 기다린다.
- scrollUntilVisible:
    element:
      id: detail-value-tags
      text: —
    direction: DOWN
    timeout: 20000
- assertVisible:
    id: detail-value-category
    text: —
- assertNotVisible:
    id: detail-badge-category-0
# 참조 목록 밖의 선택 - 딥링크로 수정 화면을 연다(로그인한 채라 가드가 막지 않는다).
- runScript:
    file: ../scripts/examples-api.js
    env:
      STEP: unlisted
      TITLE: ${output.prefix} u
- openLink: templateexpo-e2e://examples/${output.exampleId}/edit
- extendedWaitUntil:
    visible:
      id: field-input-title
      text: ${output.prefix} u
    timeout: 20000
- scrollUntilVisible:
    element:
      id: relationship-unlisted-tags
    direction: DOWN
- assertVisible:
    id: relationship-unlisted-category
- assertVisible:
    id: relationship-value-category-0
    text: '11119999-0000-4000-8000-000000000098.*'
- assertVisible:
    id: relationship-value-tags-0
    text: '22229999-0000-4000-8000-000000000098.*'
- scrollUntilVisible:
    element:
      id: field-input-title
    direction: UP
- tapOn:
    id: field-input-title
- eraseText: 30
- inputText: ${output.prefix} v
- tapOn:
    id: field-label-title
- scrollUntilVisible:
    element:
      id: submit-button
    direction: DOWN
- tapOn:
    id: submit-button
# 저장은 상세로 돌아간다(스택의 상세 화면이 이 자원을 그린다). 관계는 그대로다 - 상세는 include 로 이름을 받는다.
- extendedWaitUntil:
    visible:
      id: detail-heading
      text: ${output.prefix} v
    timeout: 20000
- scrollUntilVisible:
    element:
      id: detail-badge-tags-0
    direction: DOWN
- assertVisible:
    id: detail-badge-category-0
    text: 힣넘침분류-098
- assertVisible:
    id: detail-badge-tags-0
    text: 힣넘침라벨-098
```

삭제 — 딥링크로 연 수정 화면은 가드를 지나 돌아온다(라우트 모양의 보호 판정, T3). 취소하면 그대로, 확인하면 목록으로. 목록에서 들어가 지우면 같은 조건의 목록에서 행이 사라진다. 상세를 보는 동안 앱을 뒤로 보냈다 불러온다 — 쌓인 목록은 다시 부르지 않는다(M2, Step 7 이 `api.log` 로 센다). 404 를 선언하지 않는다 — 지운 자원의 상세를 다시 부르면 여기서 걸린다(결정 8). `test/e2e/flows/examples-delete.yaml` 를 만든다:

```yaml
# 삭제 - 수정 화면의 삭제는 확인 시트를 거친다. 취소하면 그대로이고, 확인하면 이 자원을 보던 목록으로
# 돌아간다(스펙 8.1·8.5·11.3). 목록에서 들어간 경우 돌아온 목록은 같은 조건의 같은 화면이고 지운 행이
# 사라져 있다 - 상세 제거·목록 무효화. 딥링크로 곧장 연 수정 화면은 보호 경로라 로그인을 거쳐
# 돌아오고(스펙 7.3), 거기서 지우면 목록으로 간다. 이 플로는 2xx 밖의 상태를 하나도 허용하지 않는다 -
# 지운 자원의 상세를 다시 부르면(404) 여기서 걸린다.
appId: com.example.templateexpo.e2e
---
- runFlow: ../subflows/start-signed-out.yaml
- runScript:
    file: ../scripts/examples-api.js
    env:
      STEP: account
- runScript:
    file: ../scripts/examples-api.js
    env:
      STEP: example
      TITLE: ${output.prefix} d1
# 로그인하지 않고 수정 화면을 딥링크로 연다 - 경로 가드가 로그인으로 보내고, 로그인하면 돌아온다.
- openLink: templateexpo-e2e://examples/${output.exampleId}/edit
- extendedWaitUntil:
    visible:
      id: login-screen
    timeout: 15000
- runFlow: ../subflows/submit-credentials.yaml
- extendedWaitUntil:
    visible:
      id: field-input-title
      text: ${output.prefix} d1
    timeout: 20000
# 취소하면 그대로다.
- scrollUntilVisible:
    element:
      id: delete-button
    direction: DOWN
- tapOn:
    id: delete-button
- extendedWaitUntil:
    visible:
      id: delete-confirm-cancel
    timeout: 10000
- tapOn:
    id: delete-confirm-cancel
- extendedWaitUntil:
    notVisible:
      id: delete-confirm-cancel
    timeout: 10000
- assertVisible:
    id: edit-example-screen
# 확인하면 지운다 - 스택에 목록이 없으니 이 화면이 (조건 없는) 목록으로 바뀐다.
- tapOn:
    id: delete-button
- extendedWaitUntil:
    visible:
      id: delete-confirm-accept
    timeout: 10000
- tapOn:
    id: delete-confirm-accept
- extendedWaitUntil:
    visible:
      id: examples-screen
    timeout: 20000
- assertNotVisible:
    id: edit-example-screen
# 목록에서 들어가 지운다 - 돌아온 목록은 같은 조건(이 실행의 접두사)의 같은 화면이고 지운 행이 없다.
- runScript:
    file: ../scripts/examples-api.js
    env:
      STEP: example
      TITLE: ${output.prefix} d2
- openLink: templateexpo-e2e://examples?filter%5Btitle%5D%5Bcontains%5D=${output.prefix}
- extendedWaitUntil:
    visible:
      id: resource-row-title
      text: ${output.prefix} d2
    timeout: 20000
- assertNotVisible:
    id: resource-row-title
    text: ${output.prefix} d1
- tapOn:
    id: resource-row-title
    text: ${output.prefix} d2
- extendedWaitUntil:
    visible:
      id: detail-heading
      text: ${output.prefix} d2
    timeout: 20000
# 앱 복귀 - 쌓인 목록은 구독을 끊어 두어 다시 부르지 않고 보이는 상세만 부른다(스펙 8.5 의 D4 정정). 수는 게이트 뒤에
# 이 플로의 api.log 로 센다 - 이 실행의 목록 GET 은 둘(처음 열 때, 지우고 돌아왔을 때)이다.
- pressKey: Home
- launchApp:
    stopApp: false
- extendedWaitUntil:
    visible:
      id: detail-heading
      text: ${output.prefix} d2
    timeout: 20000
- scrollUntilVisible:
    element:
      id: edit-example-link
    direction: DOWN
- tapOn:
    id: edit-example-link
- extendedWaitUntil:
    visible:
      id: field-input-title
      text: ${output.prefix} d2
    timeout: 20000
- scrollUntilVisible:
    element:
      id: delete-button
    direction: DOWN
- tapOn:
    id: delete-button
- extendedWaitUntil:
    visible:
      id: delete-confirm-accept
    timeout: 10000
- tapOn:
    id: delete-confirm-accept
- extendedWaitUntil:
    visible:
      id: list-empty
    timeout: 20000
- assertNotVisible:
    id: detail-heading
```

실패 처리 — 422 의 필드 오류, 없는 id, 고치는 사이·지우는 사이의 404, 끊긴 세션의 401(회전이 거절받는다). `test/e2e/flows/examples-write-errors.yaml` 를 만든다:

```yaml
# e2e-allow-http: 401 404 422
# 쓰기의 실패 처리(스펙 9.1·9.2·11.3):
#   - 필수 칸(제목·점수)을 비워 만들면 422 VALIDATION_ERROR - 그 칸 아래 필드 오류가 뜨고 화면은 그대로다.
#   - 없는 id 의 수정 화면은 not-found 다(상세 조회의 404).
#   - 고치는 사이 자원이 없어졌으면 저장이 404 - not-found 를 그린다.
#   - 지우는 사이 자원이 없어졌으면 삭제의 404 는 이미 이뤄진 결과다 - 목록으로 간다.
#   - 백엔드가 세션을 끊었으면 쓰기 앞의 회전이 401 TOKEN_REVOKED - 기기 세션을 지우고 지금 경로를 next 로
#     실어 로그인으로 보낸다(스펙 7.2·7.3·9.2). 로그인하면 쓰던 화면으로 돌아온다.
# 자원과 세션을 앱 밖에서 없애는 것은 test/e2e/scripts/examples-api.js 의 STEP=delete·revoke 다.
appId: com.example.templateexpo.e2e
---
- runFlow: ../subflows/start-signed-out.yaml
- runScript:
    file: ../scripts/examples-api.js
    env:
      STEP: account
- runFlow: ../subflows/login.yaml
# 422 - 제목과 점수를 비운 채 만든다. 상태는 첫 값이 골라진 채로 시작한다.
- openLink: templateexpo-e2e://examples/new
- extendedWaitUntil:
    visible:
      id: resource-form
    timeout: 20000
- scrollUntilVisible:
    element:
      id: submit-button
    direction: DOWN
- tapOn:
    id: submit-button
- scrollUntilVisible:
    element:
      id: field-error-title
    direction: UP
    timeout: 20000
# 포인터가 있는 오류는 배너가 아니라 그 칸 아래다(스펙 9.1) - 배너는 폼 맨 위에 그린다.
- assertNotVisible:
    id: form-banner
- scrollUntilVisible:
    element:
      id: field-error-score
    direction: DOWN
- assertNotVisible:
    id: field-error-status
- assertVisible:
    id: new-example-screen
# 404 - 없는 id 의 수정 화면.
- openLink: templateexpo-e2e://examples/00000000-0000-4000-8000-00000000d4d4/edit
- extendedWaitUntil:
    visible:
      id: not-found-screen
    timeout: 20000
# 404 - 고치는 사이 없어진 자원을 저장한다.
- runScript:
    file: ../scripts/examples-api.js
    env:
      STEP: example
      TITLE: ${output.prefix} e1
- openLink: templateexpo-e2e://examples/${output.exampleId}/edit
- extendedWaitUntil:
    visible:
      id: field-input-title
      text: ${output.prefix} e1
    timeout: 20000
- runScript:
    file: ../scripts/examples-api.js
    env:
      STEP: delete
- scrollUntilVisible:
    element:
      id: submit-button
    direction: DOWN
- tapOn:
    id: submit-button
- extendedWaitUntil:
    visible:
      id: not-found-screen
    timeout: 20000
# 404 - 지우는 사이 이미 없어진 자원을 지운다. 목록으로 간다.
- runScript:
    file: ../scripts/examples-api.js
    env:
      STEP: example
      TITLE: ${output.prefix} e2
- openLink: templateexpo-e2e://examples/${output.exampleId}/edit
- extendedWaitUntil:
    visible:
      id: field-input-title
      text: ${output.prefix} e2
    timeout: 20000
- runScript:
    file: ../scripts/examples-api.js
    env:
      STEP: delete
- scrollUntilVisible:
    element:
      id: delete-button
    direction: DOWN
- tapOn:
    id: delete-button
- extendedWaitUntil:
    visible:
      id: delete-confirm-accept
    timeout: 10000
- tapOn:
    id: delete-confirm-accept
- extendedWaitUntil:
    visible:
      id: examples-screen
    timeout: 20000
# 401 - 백엔드가 이 사용자의 세션을 모두 끊은 뒤 만들기를 누른다. 회전이 거절되고 로그인으로 간다.
- openLink: templateexpo-e2e://examples/new
- extendedWaitUntil:
    visible:
      id: resource-form
    timeout: 20000
- runScript:
    file: ../scripts/examples-api.js
    env:
      STEP: revoke
- tapOn:
    id: field-input-title
- inputText: ${output.prefix} r
- tapOn:
    id: field-label-title
- tapOn:
    id: field-input-score
- inputText: '1'
- tapOn:
    id: field-label-title
- scrollUntilVisible:
    element:
      id: submit-button
    direction: DOWN
- tapOn:
    id: submit-button
- extendedWaitUntil:
    visible:
      id: login-screen
    timeout: 20000
- assertNotVisible:
    id: logout-button
- runFlow: ../subflows/submit-credentials.yaml
- extendedWaitUntil:
    visible:
      id: resource-form
    timeout: 20000
- assertVisible:
    id: new-example-screen
- assertVisible:
    id: logout-button
```

D3 의 `examples-scroll-refresh` 는 상세에서 목록으로 돌아온 뒤 백엔드에서 제목을 바꾸고 그 행을 다시 누른다. 이제 돌아온 목록은 다시 구독하며 부르므로(Task 3, 결정 39) 그 재조회가 이름 바꾸기보다 늦게 끝나면 행이 이미 새 제목이다 — 어느 쪽이든 누르게 한다. `test/e2e/flows/examples-scroll-refresh.yaml` — Edit, 찾을 것:

```yaml
- back
- runScript:
    file: ../scripts/examples-api.js
    env:
      STEP: rename
      TITLE: ${output.prefix} 01 renamed
- tapOn:
    id: resource-row-title
    text: ${output.prefix} 01
```

바꿀 것:

```yaml
- back
- runScript:
    file: ../scripts/examples-api.js
    env:
      STEP: rename
      TITLE: ${output.prefix} 01 renamed
# 돌아온 목록은 다시 구독하며 부른다(쌓인 화면은 구독을 끊는다 - 스펙 8.5 의 D4 정정). 그 재조회가 이름 바꾸기보다
# 늦게 끝나면 행이 이미 새 제목이다 - 어느 쪽이든 누른다.
- tapOn:
    id: resource-row-title
    text: '${output.prefix} 01( renamed)?'
```

```bash
node --check test/e2e/scripts/examples-api.js && pnpm exec eslint test/e2e/scripts
MAESTRO="${MAESTRO:-$HOME/.maestro/bin/maestro}"
for f in test/e2e/flows/examples-create.yaml test/e2e/flows/examples-edit.yaml test/e2e/flows/examples-delete.yaml test/e2e/flows/examples-write-errors.yaml test/e2e/flows/examples-scroll-refresh.yaml test/e2e/subflows/login.yaml; do
  MAESTRO_CLI_NO_ANALYTICS=1 "$MAESTRO" --no-ansi check-syntax "$f" > /dev/null && echo "ok $f" || echo "FAIL $f"
done
ls test/e2e/flows | wc -l
```

Expected: `node --check`·`eslint` exit 0, `ok` 여섯, 플로 `18`.

- [ ] **Step 4: 문서·스펙 정정·기록의 자리를 쓴다**

`test/e2e/AGENTS.md` — `## 돌리기` 절 바로 앞에 더한다:

```markdown
## 쓰기 플로

- 계정은 `scripts/examples-api.js` 의 `STEP=account`(가입만 - `output.prefix` 는 `d4-<이메일 끝 8자>`)로 만들고 앱에서
  `subflows/login.yaml` 로 로그인한다. 고치거나 지울 행은 `STEP=example`(모든 속성과 분류 하나·태그 둘)·`STEP=unlisted`(참조
  목록 밖의 분류·태그)로 만든다. 제목은 그 접두사로 시작한다 - 씨앗의 `probe-seed`·목록 플로의 `probe-d3-` 를 쓰지 않는다.
- 앱 밖에서 자원을 없애는 것은 `STEP=delete`, 세션을 끊는 것은 `STEP=revoke`(폐기된 refresh 를 다시 내밀어 백엔드가 그 사용자의
  세션을 모두 폐기하게 한다)다.
- 하네스는 백엔드의 access token 수명을 10초로 준다(`E2E_ACCESS_EXPIRES_SECONDS`) - 앱은 만료 60초 전부터 회전하므로 쓰기마다
  실제 회전(스펙 7.2)을 지난다. 스크립트가 쓰는 토큰도 짧아서 401 이면 한 번 다시 로그인한다.
- 입력한 뒤 아래쪽 요소(선택기·제출)를 누르기 전에 제목 라벨(`field-label-title`)을 눌러 키보드를 내린다 - 키보드가 가린 자리를
  누르면 그 누름이 키보드로 간다. `hideKeyboard` 는 쓰지 않는다(위 절).
- 수정 화면의 제목 칸을 누르면 커서가 누른 자리에 선다 - 접두사를 짧게 두어(입력 칸의 절반보다 짧다) 가운데를 누르면 끝에 서게
  하고, `eraseText` 로 지운 뒤 다시 쓴다.
```

`test/e2e/AGENTS.md` — Edit, 찾을 것(환경 변수 표의 `E2E_FORCE_BUILD` 행 - 칸 맞춤 공백 앞까지. 그 뒤에 행 하나를 잇는다):

```markdown
`1` 이면 빌드 입력이 같아도 APK 를 다시 만든다
```

바꿀 것:

```markdown
`1` 이면 빌드 입력이 같아도 APK 를 다시 만든다 |
| `E2E_ACCESS_EXPIRES_SECONDS` | 백엔드의 access token 수명(초, 기본 10) - `docker-compose.e2e.yml` 이 세 백엔드의 `JWT_ACCESS_EXPIRES_SECONDS` 로 넘긴다. 60 이하라 앱의 쓰기가 전부 회전을 지난다
```

`test/e2e/AGENTS.md` — Edit, 찾을 것:

```markdown
`C:/t/e`)의 사본에서 빌드한다. 결과는 `.maestro-output/e2e/<플로>/`에 남는다.
```

바꿀 것:

```markdown
`C:/t/e`)의 사본에서 빌드한다. 결과는 `.maestro-output/e2e/<플로>/`에 남는다. 빌드할 때마다 Gradle 앞에서 Metro 의 디스크
캐시(`os.tmpdir()` 의 `metro-cache`)를 비운다(`android.sh` 의 `clear_metro_cache`) - 캐시가 남은 채 돈 번들 단계가
0xC0000005 로 죽은 적이 있고 지운 뒤에는 재현되지 않았다(`docs/superpowers/notes/2026-09-30-d3-measurements.md` 의 L7).
재시도로 덮지 않는다.
```

스펙 — 11.3 의 끝, `### 11.4 E2E 스택` 바로 앞에 더한다:

```markdown
> 정정(2026-10-01, D4): 쓰기 E2E(생성·수정·삭제·실패 처리)는 앱 밖에서 백엔드를 바꾸는 단계를 `runScript`
> (`test/e2e/scripts/examples-api.js`)로 둔다 - 계정 만들기(`account`), 고칠 행(`example`, 참조 목록 밖의 관계를 단
> `unlisted`), 자원 없애기(`delete`), 세션 끊기(`revoke`). 제목은 실행·플로마다 다른 짧은 접두사(`d4-<이메일 끝
> 8자>`)로 시작한다. 하네스는 백엔드의 access token 수명을 10초로 준다(`E2E_ACCESS_EXPIRES_SECONDS` → 세 백엔드의
> `JWT_ACCESS_EXPIRES_SECONDS`) - 앱은 만료 60초 전부터 회전하므로 쓰기가 전부 실제 회전을 지난다(7.2 의 D4 정정).
> 입력 뒤에는 폼의 제목 라벨을 눌러 키보드를 내린 다음 아래쪽 요소를 누른다. 결과는
> `docs/superpowers/notes/2026-10-01-d4-measurements.md`.
```

D4 실측 기록 - 괄호 안의 안내 줄은 Step 7 이 실제 출력으로 바꾼다. `docs/superpowers/notes/2026-10-01-d4-measurements.md` 를 만든다:

````markdown
# D4 실측 기록 (2026-10-01)

생성·수정·삭제와 관계 선택기(D4)를 기기에서 잰 것이다. 계획은
`docs/superpowers/plans/2026-09-30-d4-create-update-delete.md`.

## W1 — 쓰기 E2E (기기)

**명령.** `E2E_AVD=Pixel_9_API_36 ./scripts/check.sh` 의 `[12/12] E2E`(`test/e2e/run-android.sh`) - Pixel_9_API_36(Android 16, API 36), FastAPI 스택,
플로는 D2 의 일곱, D3 의 일곱, D4 의 넷(`examples-create`·`examples-edit`·`examples-delete`·`examples-write-errors`).
백엔드의 access token 수명은 10초다(`E2E_ACCESS_EXPIRES_SECONDS` 의 기본값). APK 는 빌드 앞에 Metro 캐시를 비우고
만들었다(`test/e2e/android.sh` 의 `clear_metro_cache` - D3 실측 L7):

```text
(gate.log 의 "Metro 캐시를 비웠다" 줄, "BUILD SUCCESSFUL" 줄, "--- <플로>" 줄들과 "=== E2E 통과 - 플로 N개 ===" 를 붙인다)
```

**가드.** 선언한 실패 표식 - `examples-write-errors` 의 401 (수)·404 (수)·422 (수). 선언하지 않은 D4 플로 셋의 표식은
0 이다 - `examples-delete` 는 지운 자원의 상세를 다시 부르지 않았다(404 가 없다).

**가드가 보낸 로그인 화면의 뒤로 가기.** `examples-create` 가 로그인하지 않은 채 목록의 "새로 만들기" 를 눌러 로그인
화면에 닿은 뒤 뒤로 가기를 눌렀고, 홈이 보였다(앱이 닫히지 않았다 - `components/app/back-to-home.ts`).

**수정 화면의 보호 판정.** `examples-delete` 가 로그인하지 않은 채 `/examples/<id>/edit` 를 딥링크로 열어 로그인 화면에
닿았고, 로그인한 뒤 그 수정 화면으로 돌아왔다 - 가드는 라우트 모양(`/examples/[id]/edit`)으로 판정한다.

## W2 — 회전의 실제 왕복 (기기)

D2 의 결정 5 가 넘긴 것이다 - 회전은 단위 시험만 쟀고, 기기에서 실제로 돈 적이 없었다.

**쓰기마다 회전한다.** 각 플로의 백엔드 접근 로그(`.maestro-output/e2e/<플로>/api.log`)에서 센 회전 요청과 쓰기
요청(아래 명령의 출력을 붙인다):

```text
(grep -c "POST /api/v1/auth/refresh" 와 grep -cE "(POST|PATCH|DELETE) /api/v1/examples" 의 수를 플로마다 붙인다)
```

**끊긴 세션.** `examples-write-errors` 의 `STEP=revoke` 뒤 앱의 회전이 401 `TOKEN_REVOKED` 를 받았고(기기 로그의
`[e2e-http] 401 POST /api/v1/auth/refresh TOKEN_REVOKED`), 앱은 기기 세션을 지우고 `next` 를 실어 로그인으로 갔다.
다시 로그인하자 생성 화면으로 돌아왔다.

**재지 않은 것.** 회전 응답의 5xx(스펙 7.2 의 D4 정정)는 기기에서 일으키지 않았다 - 단위 시험
(`test/unit/auth/rotation.test.ts`)이 잰다. iOS(D7 의 CI), NestJS·Rails 에서의 쓰기(D7 의 매트릭스).

## W3 — 쌓인 화면의 재조회 (기기, D3 최종 검토 M2)

화면의 조회는 `subscribed: useIsFocused()` 를 준다(`queries/resources.ts`) - 쌓인 화면은 앱 복귀·네트워크 복귀·무효화의
재조회를 부르지 않고, 다시 앞에 오면 다시 구독하며 부른다(스펙 8.5 의 D4 정정). 두 플로의 백엔드 접근 로그에서 이
실행의 목록 GET 을 셌다(아래 명령의 출력을 붙인다):

```text
(Task 5 Step 7 (c) 의 두 줄 - scroll-refresh list-after-detail=… 와 delete list=… 를 붙인다)
```

- `examples-scroll-refresh` - 상세에 처음 들어간 뒤의 목록 GET 이 둘이다: 상세에서 돌아온 목록이 다시 구독하며 읽어 둔 두
  쪽을 다시 읽었다(구독이 살아 있던 D3 의 판이면 0 - D3 실측 L5 의 요청 순서).
- `examples-delete` - 목록에서 상세로 들어가 앱을 뒤로 보냈다 불러왔다. 목록 GET 은 처음 열 때와 지우고 돌아왔을 때의
  둘이다 - 쌓인 목록은 앱 복귀와 삭제 뒤 무효화에 다시 부르지 않았다(구독이 살아 있던 D3 의 판이면 셋이다).

**재지 않은 것.** 빠른 두 번 누름(M8)은 기기에서 재지 않았다 - 애니메이션을 끈 에뮬레이터에서 Maestro 의 두 번 누름이
가드 없이도 두 이동을 만드는지부터 보장되지 않아 가드의 유무를 가르지 못한다. 가드의 판단은
`test/unit/navigation/once.test.ts` 가 잰다.
````

루트 `AGENTS.md` 의 `## 검증 명령` 절, 실측 기록 문단(`실측 기록은 \`docs/superpowers/notes/2026-09-30-d1-measurements.md\`다. …`) 끝에 한 문장을 더한다:

```markdown
쓰기 E2E 와 기기에서 잰 회전의 실제 왕복·가드가 보낸 로그인 화면의 뒤로 가기·쌓인 화면의 재조회(D4 실측 W1–W3)는
`docs/superpowers/notes/2026-10-01-d4-measurements.md`에 있다.
```

```bash
pnpm format
pnpm format:check && ./scripts/check-citations.sh app components lib platform queries test
```

Expected: exit 0 둘.

- [ ] **Step 5: 게이트를 돌린다 — 기기 작업은 여기서 한 번**

게이트의 E2E 단계가 빌드 입력이 바뀐 APK 를 짧은 경로 사본에서 다시 만들고(Metro 캐시를 비운 뒤 5~6분) 플로 열여덟을 돈다 — 30분 넘게 걸릴 수 있어 백그라운드로 돌리고 끝나기를 기다린다(도구의 전경 제한은 10분이다). 이 저장소의 `expo start` 를 끄고 돈다(`[10]` 이 `--clear`).

```bash
mkdir -p .maestro-output
docker ps --filter name=joon- -q | wc -l
E2E_AVD=Pixel_9_API_36 ./scripts/check.sh > .maestro-output/gate.log 2>&1; echo "gate exit=$?"
grep -E "^=== |APK 를 다시 만들지 않는다|Metro 캐시를 비웠다|BUILD (SUCCESSFUL|FAILED)|^--- |E2E 통과|E2E:" .maestro-output/gate.log
docker ps --filter name=joon- -q | wc -l
docker ps --filter label=com.docker.compose.project=template-typescript-expo-e2e -q | wc -l
```

Expected: 앞뒤 `9`, `gate exit=0`, `=== [1/12] …` 부터 `=== [12/12] E2E ===`, `Metro 캐시를 비웠다: <임시 디렉터리>/metro-cache` 한 줄과 `BUILD SUCCESSFUL`, `--- ` 줄 열여덟(D4 의 넷 `examples-create`·`examples-delete`·`examples-edit`·`examples-write-errors` 포함), `=== E2E 통과 - 플로 18개 ===`, `=== 전부 통과 ===`, 우리 compose 프로젝트의 컨테이너 `0`. "APK 를 다시 만들지 않는다" 는 나오지 않는다(빌드 입력이 바뀌었다). 번들 단계가 0xC0000005 로 죽으면 전역 제약의 Gradle 줄대로 30분을 정해 원인을 가른다 — 게이트를 다시 돌려 덮지 않는다.

- [ ] **Step 6: 실패하면 원인을 고친다**

실패한 플로의 `.maestro-output/e2e/<플로>/` 에서 `maestro.log`·`debug/`(실패한 단계의 스크린샷)·`logcat.txt`·`api.log` 를 본다. **원인을 고친다** — 제한 시간을 늘리거나 단언을 지우거나 가드를 약하게 하지 않는다(스펙 16장: 재시도 0). 한 플로만 다시 돌릴 때는 `E2E_AVD=Pixel_9_API_36 E2E_FLOW="examples-edit" ./test/e2e/run-android.sh > .maestro-output/e2e-run.log 2>&1` 처럼 준다(플로·스크립트만 고쳤으면 APK 를 다시 만들지 않는다. 앱 코드를 고치면 한 번 다시 만든다). 고친 뒤 전부 통과하면 Step 5 의 게이트를 한 번 더 돈다. 짐작되는 갈래:

(a) **누름이 키보드로 갔다**(선택기가 열리지 않거나 제출이 안 됐는데 스크린샷에 키보드가 떠 있다) — 그 앞의 `field-label-title` 누름이 라벨에 닿지 않은 것이다(폼이 스크롤돼 라벨이 화면 밖). 그 앞에 `scrollUntilVisible: { element: { id: field-label-title }, direction: UP }` 를 더한다. 라벨을 눌러도 키보드가 남으면 `resource-form.tsx` 의 라벨 `onPress={Keyboard.dismiss}` 가 빠졌는지 본다.

(b) **시트 안의 요소를 Maestro 가 못 찾는다**(`relationship-option-…`·`delete-confirm-…` 에서 `Element not found`, 스크린샷에는 시트가 떠 있다) — D3 실측 L6 에서 같은 `Sheet`(React Native `Modal`)의 요소를 Maestro 가 찾았다(필터·정렬). 보기의 testID 가 `Text` 에 달렸는지(`OptionRow`)와 시트가 키보드 위로 올라와 가려지지 않았는지 본다.

(c) **`examples-delete` 가 선언하지 않은 404 로 실패한다** — 지운 자원의 상세를 누가 다시 불렀다. `logcat.txt` 의 `[e2e-http] 404 GET /api/v1/examples/<id>` 앞뒤로 어느 화면이 그려졌는지 가른다. 수정 화면이면 `edit.tsx` 의 `useResourceDetail(…, { enabled: !remove.deleted })` 가 빠졌거나 훅 순서가 바뀐 것이다(`useDeleteResource` 가 먼저다). 밑에 깔린 상세 화면이면 `queries/writes.ts` 의 삭제 `onSuccess` 가 캐시를 바꾸기 전에 화면을 닫도록 — 표의 적용을 `remove` 의 콜백(`onDeleted()` 다음)으로 옮긴다 — 고치고 결정 8 의 "틀리면" 에 적는다.

(d) **`examples-write-errors` 의 401 단계가 로그인으로 가지 않는다** — `api.log` 에서 `STEP=revoke` 뒤 앱의 `POST /api/v1/auth/refresh` 가 401 인지 본다. 200 이면 access 수명이 10초가 아니다(`docker compose … config` 로 `JWT_ACCESS_EXPIRES_SECONDS` 를 본다) 또는 백엔드가 그 사용자의 세션을 전부 끊지 않았다(사실 절의 재사용 감지). 401 인데 로그인 화면이 안 나오면 `platform/query-client.ts` 의 `onError` 배선을 본다.

(e) **`examples-create` 의 뒤로 가기에서 앱이 닫혔다**(홈 대신 런처) — `login.tsx` 의 `useBackToHome()` 이 빠졌거나 로그인 화면이 루트의 유일한 화면이 아니었다. `logcat.txt` 에 JS 오류가 없는지 보고, 결정 10 의 "틀리면" 대로 둘째 후보를 잰다.

(f) **`W/ReactNativeJS`·`E/ReactNativeJS` 가 가드에 걸린다** — 그 경고를 내는 코드를 고친다(중복 키, `Text` 밖의 글자, 렌더 중 다른 컴포넌트의 상태 갱신 등).

(g) **돌아온 목록이 옛 행을 그리거나 `examples-scroll-refresh` 의 둘째 누름이 실패한다** — 쌓였다 돌아온 화면이 다시 구독하며 부르지 않았다. `queries/resources.ts` 의 `subscribed: useIsFocused()` 배선을 보고, `api.log` 에서 돌아온 뒤의 목록 GET 이 있는지 본다(Step 7 (c)).

- [ ] **Step 7: 가드와 회전을 세고 기록을 채운다**

(a) 선언한 상태가 실제로 나왔고, 선언하지 않은 D4 플로 셋에는 실패 표식이 없다:

```bash
for s in 401 404 422; do echo "write-errors $s $(grep -c "\[e2e-http\] $s " .maestro-output/e2e/examples-write-errors/logcat.txt)"; done
grep "\[e2e-http\] 401 " .maestro-output/e2e/examples-write-errors/logcat.txt
grep -c "\[e2e-http\]" .maestro-output/e2e/examples-create/logcat.txt .maestro-output/e2e/examples-edit/logcat.txt .maestro-output/e2e/examples-delete/logcat.txt
```

Expected: 401·404·422 가 각각 1 이상(404 는 없는 id 의 GET, 고치는 사이의 PATCH, 지우는 사이의 DELETE 로 셋 이상), 401 줄이 `POST /api/v1/auth/refresh TOKEN_REVOKED`, 아래 세 파일은 `0`.

(b) 쓰기마다 회전했다 — 앱 밖의 단계가 쓰기를 섞지 않는 두 플로에서 센다(생성 플로의 스크립트는 가입만 하고, 수정 플로의 스크립트는 POST 만 한다):

```bash
for f in examples-create examples-edit; do
  L=.maestro-output/e2e/$f/api.log
  echo "$f refresh=$(grep -c 'POST /api/v1/auth/refresh' "$L") post=$(grep -c 'POST /api/v1/examples ' "$L") patch=$(grep -c 'PATCH /api/v1/examples/' "$L")"
done
```

Expected: `examples-create refresh=1 post=1 patch=0`(앱의 생성 하나, 그 앞의 회전 하나), `examples-edit refresh=3 post=2 patch=3`(스크립트의 POST 둘은 회전하지 않는다 - 앱의 저장 셋이 각각 회전한다). 로그의 모양이 달라 세기 어려우면 `grep "/api/v1/" "$L"` 의 줄을 W2 에 그대로 붙인다. refresh 가 0 이면 access 수명이 10초가 아니다 — Step 6 (d) 의 확인을 한다.

(c) 쌓인 화면은 다시 부르지 않고 돌아오면 부른다(M2) — 이 실행의 목록 GET 을 센다(앞 플로의 줄이 5초 창에 끼어도 접두사가 가른다):

```bash
awk 'index($0, "GET /api/v1/examples/") { seen = 1 } seen && index($0, "GET /api/v1/examples?") && index($0, "probe-d3-") { n++ } END { print "scroll-refresh list-after-detail=" n + 0 }' .maestro-output/e2e/examples-scroll-refresh/api.log
echo "delete list=$(grep 'GET /api/v1/examples?' .maestro-output/e2e/examples-delete/api.log | grep -c '=d4-')"
```

Expected: `scroll-refresh list-after-detail=2`(상세에 처음 들어간 뒤의 목록 GET - 돌아온 목록이 다시 구독하며 읽어 둔 두 쪽을 다시 읽었다. 구독이 살아 있던 D3 의 판이면 0 이다. 그 앞의 수는 새로고침이 한 번 더 일 수 있어 세지 않는다 - D3 실측 L5), `delete list=2`(처음 열 때, 지우고 돌아왔을 때 - 상세를 보는 동안의 앱 복귀와 삭제 뒤 무효화는 쌓인 목록을 부르지 않았다. 구독이 살아 있으면 3). 다르면 `grep 'GET /api/v1/examples' <api.log>` 의 줄을 W3 에 붙이고 Step 6 (g) 를 본다.

(d) 기록을 채운다 — `docs/superpowers/notes/2026-10-01-d4-measurements.md` 의 괄호 안 안내 줄 넷을 실제 출력으로 바꾼다: W1 의 게이트 출력(`grep -E "Metro 캐시를 비웠다|BUILD SUCCESSFUL|^--- |E2E 통과" .maestro-output/gate.log`), W1 의 가드 수(위 (a)), W2 의 회전 수(위 (b)), W3 의 목록 GET 수(위 (c)).

- [ ] **Step 8: 커밋한다**

게이트 뒤에는 기록(문서)만 바뀌었다 — 빌드 지문과 플로가 문서를 보지 않으므로 E2E 를 다시 돌리지 않는다(결정 30). 문서에 걸리는 검사만 다시 돈다.

```bash
pnpm format:check && ./scripts/check-citations.sh app components lib platform queries test && node scripts/check-provenance.mjs | tail -n 1
git status --short
git add docker-compose.e2e.yml test/e2e docs/provenance/copied-core.json docs/superpowers AGENTS.md
git status --short
git commit -m "test: 생성·수정·삭제와 실패 처리의 E2E 를 더하고 쓰기가 기기에서 실제 회전을 지나게 한다"
git ls-tree HEAD test/e2e/ | grep -E "\.sh$"
```

Expected: 검사 통과, 첫 `git status` 에는 이 태스크의 파일만 있고(앱 코드가 보이면 Step 6 에서 고친 것이다 - 그 변경도 게이트를 지났는지 확인하고 함께 넣는다), 커밋 뒤 남은 파일이 없다. `test/e2e/android.sh`·`guard-log.sh`·`run-android.sh` 가 모두 `100755`(Edit 는 실행 권한을 바꾸지 않는다 — 빠졌으면 `git update-index --chmod=+x test/e2e/run-android.sh` 뒤 다시 커밋한다).
---

## 이 계획이 끝났을 때의 상태

- `lib/resources/form.ts` 가 원본에서 복사돼 폼 상태 객체(`newFormValues`·`withAttribute`·`withRelationshipChoice`)와 관계 선택기의 판단(`relationshipTargets`·`relationshipChoice`)을 갖는다. 쓰기 한 번의 흐름은 `lib/resources/write.ts` 가 주입받은 전송·토큰으로 정한다 — 쓰기 가드, 세션 거절, 422·관계 오류의 자리, 닿지 못함의 앱 문구, 수정·삭제·생성의 `RESOURCE_NOT_FOUND`. 조회의 `queryFn` 은 닿지 못함에 더해 판정하지 않은 응답(5xx·408·429)도 던진다 - 재조회가 그렇게 끝나도 읽은 목록·상세·참조 목록이 남고 다음 재조회가 쪽 전부를 다시 읽는다. 첫 조회면 그 응답의 문구가 배너다. 판정한 4xx 는 새 답이다. 참조 목록의 상태는 목록·상세와 같은 규칙이다(`screen-state.ts` 의 `referenceState`). 목록 끝의 가드는 `canLoadMore` 다. 무한 스크롤의 끝과 선택기의 잘림은 한 판정(`view.ts` 의 `nextLinkQuery`)이다. 원본 시험 33, 새 판단 13, 흐름 22, 판정하지 않은 응답 23, 그 전이 3, 참조 상태 7, 다음 쪽 6 이 지킨다. 출처 기록은 경로 48·이탈 36·원본 그대로 31 이다.
- `queries/writes.ts` 의 생성·수정·삭제 훅이 D3 의 무효화 표를 지나고, 폼은 쓰기의 키로 제출을 한 번에 하나만 보낸다(`queries/submit-once.ts` - 자격증명 폼도). 세션 거절은 쓰기 캐시의 `onError` 한 곳이 기기 세션을 지우고 경로 가드가 `next` 를 실어 로그인으로 보낸다. 삭제한 수정 화면은 상세를 다시 부르지 않는다. 참조 목록의 조회(`referenceQueryOptions`)도 닿지 못함을 던져 재조회의 실패가 읽은 보기를 지우지 않는다. 화면의 조회는 쌓인 동안 구독하지 않고(`subscribed: useIsFocused()`) 다시 앞에 올 때 부른다.
- 생성(`/examples/new`)은 필수 enum 을 첫 값으로 시작하고 만들면 상세로 바뀐다. 수정(`/examples/[id]/edit`)은 처음 받은 상세로 기존 값을 채우고 저장하면 상세로, 삭제는 확인 시트를 거쳐 보던 목록(같은 조건)으로 간다. 관계 선택기는 고른 순서를 지키고 목록 밖 선택·잘림을 알린다. 목록에 "새로 만들기", 상세에 "수정" 이 있고, 행·조건 바꾸기와 함께 두 번 눌러도 화면을 한 번만 쌓는다(`useNavigateOnce`). 폼의 끝은 내비게이션 막대만큼 띄운다.
- 회전 응답의 5xx·408·429 는 세션을 지우지 않는다. 가드는 라우트 모양으로 보호를 판정한다. 가드가 보낸 로그인·가입 화면에서 뒤로 가면 홈이다. `establishIfSignedIn` 의 거절 정책을 `MutationObserver` 시험이 지킨다. 릴리스 대기 예외가 없고 `pnpm install --frozen-lockfile` 이 통과한다.
- `./scripts/check.sh` 가 12단계를 통과한다. E2E 는 D2 의 일곱, D3 의 일곱, D4 의 넷 — 생성(뒤로 가기 포함)·수정(기존 값·태그 순서·관계 초기화·목록 밖 선택)·삭제(딥링크 가드·쌓인 목록의 앱 복귀 포함)·실패 처리(422·없는 id·404 둘·끊긴 세션 401) — 을 한 에뮬레이터·한 스택에서 돌고, 백엔드의 access 수명이 10초라 앱의 쓰기가 전부 실제 회전을 지난다. APK 는 빌드마다 Metro 캐시를 비운 뒤 만든다. 단위 시험 1286(58 파일).
- 기록: D4 실측 W1(쓰기 E2E·가드·뒤로 가기·딥링크 가드·빌드)·W2(회전의 실제 왕복)·W3(쌓인 화면의 재조회). 스펙 정정: 7.2·7.3·8.5·9.3(판정하지 않은 재조회)·9(쓰기의 오류)·11.3.
- 컨트롤러가 이 브랜치를 `main` 에 머지 커밋으로 곧바로 병합한다(전역 제약).

## 다음 계획

D5(계약 실험실·거울)가 넘겨받는 것:

- 실험실의 PUT upsert·관계 전용 쓰기(스펙 8.6)는 `lib/resources/write.ts` 의 흐름(주입받은 전송·토큰, 세션 거절)을 그대로 쓸 수 있다 — 세션이 필요한 실험을 익명으로 누르면 로그인으로 가는 것도 같은 세션 거절 → `MutationCache.onError` → 경로 가드의 길이다(실험실 화면을 보호 경로로 두지 않는다면 `onError` 가 직접 `loginHref` 로 보내야 한다 - 결정 4 의 "틀리면").
- 실험실의 조회도 `subscribed: useIsFocused()` 를 주고, 화면을 쌓는 이동은 `useNavigateOnce` 를 지난다(`queries/AGENTS.md`·`lib/navigation/AGENTS.md`).
- `apiRequest` 가 호출자의 `acceptLanguage` 를 덮어쓰는 것(D2 운반 기록의 D5 절)은 그대로다.
- 게이트에 계약 거울을 E2E 앞에 더하며 번호를 `[N/13]` 으로 바꾼다(D2 결정 13).
- 계약 거울(스펙 11.2 의 3번 - 속성 제약)은 로그인 뒤 `examples` 에 쓰는 검사다. 거울 시험의 토큰도 수명 10초의 스택에서 돌면 회전·재로그인이 필요하다 — 거울은 하네스(`run-android.sh`)가 아니라 게이트의 다른 단계에서 스택을 띄우므로 `E2E_ACCESS_EXPIRES_SECONDS` 를 주지 않으면 900초다.
- 결정 11 의 남는 틈(access 가 만료된 채 회전이 5xx 면 쓰기의 401 이 세션을 지운다)은 D4 에서 닫혔다 - 세션 관리자의 `getAccessToken` 에 "지금은 못 준다" 갈래를 더하지 않고 쓰기의 만료 가드가 닫았다: 쓰기는 받은 토큰의 세션이 이미 만료됐으면 요청하지 않고 앱 문구로 알리며 세션은 그대로다(`lib/resources/write.ts`, 스펙 7.2 의 D4 정정). `getAccessToken` 을 부르는 새 자리도 돌려받은 토큰이 만료돼 있을 수 있음을 같은 방식으로 다룬다(`lib/auth/AGENTS.md`).

D7(CI)은 iOS 에서 쓰기 플로를 돌리고(키보드와 라벨 누름의 동작, 시트), NestJS·Rails 에서 세 쓰기 경로의 갈림(원본 계획 §2 의 표 - 빈 PATCH·중복 태그·읽기 전용 속성)과 `JWT_ACCESS_EXPIRES_SECONDS` 가 먹는지를 본다. D3 최종 검토가 D7 로 넘긴 M3(네트워크 복귀 재조회의 시험)·M4(`date -u -d`)는 이 계획이 건드리지 않는다.
