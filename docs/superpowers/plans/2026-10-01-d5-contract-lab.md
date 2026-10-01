# 계약 실험실과 계약 거울 구현 계획 (D5 — 단계 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 손으로 옮긴 자원 선언이 실제 백엔드와 어긋나면 게이트가 빨개지게 하고(계약 거울 `test/contract/`, 게이트 `[12/13]` - 드리프트 감지), 실무 화면이 쓰지 않는 여섯 백엔드 표면을 원본 응답 그대로 보이는 계약 실험실(`/contract`)을 만들어, 실제 FastAPI 스택과 Android 에뮬레이터의 게이트 한 번으로 둘 다 잰다.

**Architecture:** 실험 정의와 결과 표현은 template-typescript-nextjs 의 `app/(lab)/contract/` 에서 `lib/lab/` 로 옮겨 복사하고, 원본 Server Action(`actions.ts`)의 자리는 새 `lib/lab/run.ts` 가 차지한다 - 쓰기의 의존성(D4 의 `WriteDeps` - 전송·토큰·지금의 세션·시계)에 기기 언어를 더해 주입받아 node 에서 잰다. 세션이 필요한 실험은 D4 의 쓰기와 같은 길로 토큰을 받고(`write.ts` 의 `accessToken` - 세션 가드와 만료 가드), 세션이 없거나 백엔드가 거절하면 D4 의 세션 거절을 던진다. 쓰기 캐시의 `onError` 가 기기 세션을 지우고 공개 경로인 실험실 화면이 스스로 로그인으로 보낸다(화면을 쌓는 이동이라 `useNavigateOnce` 를 지난다). 실험실의 쓰기 훅은 D4 의 쓰기 훅처럼 세션 거절 말고 던져진 것을 오류 경계로 보낸다. API 클라이언트는 호출자가 정한 언어를 덮지 않는다(언어 협상 실험). 계약 거울은 복사해 둔 `lib/resources/mirror.ts` 의 프로브를 `fetch` 로 실제 백엔드에 보내는 별도 vitest 설정이고, `test/contract/run.sh` 가 스택을 띄워 게이트의 E2E 앞에서 돈다. 기기 작업은 마지막 태스크 하나에 모인다 - 드리프트 실증 한 번(스택만)과 게이트 한 번(APK 빌드 한 번, 에뮬레이터·백엔드 한 세션에서 플로 스물 - D4 의 끝 열여덟과 둘).

**Tech Stack:** Expo SDK 57 (`expo` ~57.0.26 · `react-native` 0.86.3) · Expo Router 57.0.24 (typed routes) · `@tanstack/react-query` 5.104.0 · Uniwind 1.12 + React Native Reusables · vitest 5.0.2(단위 설정과 계약 거울 설정 둘) · Node 24 의 `fetch` · Maestro 2.11.0 · Docker Compose

**Spec:** `docs/superpowers/specs/2026-09-30-expo-jsonapi-template-design.md` — 15장 단계 5(계약 실험실, 계약 거울 — 산출: 드리프트 감지). 근거 절: 4장(`(lab)/contract.tsx`·`lib/lab/`), 5장(계층 소유), 6.2·6.3(복사 대상과 출처 기록), 7.2·7.3(읽기는 토큰 없이, 실험실은 공개, 익명의 로그인 이동), 8.1(홈의 실험실 진입), 8.3·8.6(offset 은 실험실이 실증한다), 8.7(로딩 표현), 9.2·9.4(인증 오류의 동작, Accept-Language 의 한 자리), 11.2(계약 거울의 검사 넷), 11.3(실험실 E2E), 12장(게이트 12·13단계), 그리고 날짜 붙은 정정 전부. 이어받는 항목의 정본은 `docs/superpowers/notes/2026-10-01-d2-carry-forward.md` 의 "D5" 절(M8 - `apiRequest` 가 호출자의 `acceptLanguage` 를 덮는다, 게이트 번호를 바꿀 자리)과 D3·D4 계획의 "다음 계획" 절이다. 형제 저장소 `../template-typescript-nextjs` 의 계약 실험실·매트릭스 계획(`docs/superpowers/plans/2026-09-08-contract-lab-and-matrix.md`)의 실측 M-1…M-10 과 판정 1–3 을 참고로 읽었다.

## Global Constraints

- **런타임 버전은 Expo SDK 57 번들 버전을 따른다.** 이 계획은 의존성을 더하지 않는다(`package.json` 에는 스크립트 `test:contract` 하나만 더한다).
- **`app.config.ts`를 평가하는 모든 명령(`expo config`·`expo export`·`expo prebuild`·`pnpm types:routes`·`expo-doctor`)에는 `BACKEND_URL`을 준다.** 백엔드에 닿지 않는 명령은 `https://gate-check.invalid`다(스펙 10.1 — 없으면 멈춘다).
- **Node `>=24.11.0`, `packageManager: "pnpm@11.22.0"`**, `nodeLinker: hoisted`.
- **TypeScript strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`.** 선택 prop·속성에 `undefined`를 명시해 넘기지 않는다 — 키를 빼거나 `cn()`처럼 문자열을 만든다.
- **`lib/**`에서 `react`·`react-native`·`expo`·`expo-*`·`@expo/*`·`@react-native*`·`@react-navigation/*`·`@tanstack/*`·`uniwind` 등을 import하면 위반이다**(스펙 5장, ESLint가 막는다). 위 계층(`platform/`·`queries/`·`components/`·`app/` — 별칭이든 상대 경로든)을 import해도 막힌다. `lib/jsonapi/`에는 자원 이름 문자열이 코드로 나타나지 않는다.
- **`request()`(`lib/jsonapi/client.ts`)를 값으로 import 하는 곳은 `platform/api.ts` 와 `lib/` 뿐이다.** 실험실도 `apiRequest` 를 지난다 - `lib/lab/run.ts` 는 전송을 주입받는다(`JsonApiSend`). 계약 거울(`test/contract/`)은 앱의 클라이언트를 쓰지 않고 `fetch` 로 원본 응답을 받는다(결정 12).
- **`package.json`에 없는 패키지를 import하면 lint가 실패한다**(`import/no-extraneous-dependencies`).
- **어떤 모듈도 최상위에서 `getSettings()`를 부르지 않는다.** 모듈 최상위에서 `sessionManager`·`apiRequest` 를 참조하는 것은 된다(부르지 않는다).
- **`app/`에는 라우트 파일만 둔다.** 화면 조각은 `components/`, 판단은 `lib/`, 훅은 `queries/`, 네이티브 모듈 호출은 `platform/`. 화면 파일에는 훅 호출과 JSX 만 둔다(스펙 8.4).
- **로딩 상태에 텍스트를 쓰지 않는다.** 스피너(`ActivityIndicator` - `SubmitButton`) 또는 스켈레톤만 쓴다(스펙 8.7).
- **`app/`·`components/` 에 `@media` 로 컴파일되는 변형을 쓰지 않는다** — 너비(`sm:`·`md:`·`lg:`·`xl:`·`2xl:` 과 그 `max-`·`min-` 꼴), 방향(`portrait:`·`landscape:`), 플랫폼(`ios:`·`android:`·`native:`·`tv:`). `test/unit/ui/breakpoints.test.ts` 가 파일 전체(주석 포함)를 훑어 막는다. 플랫폼마다 다른 스타일은 `Platform.select` 로 고른다. `dark:` 는 된다.
- **아이콘은 `lucide-react-native/icons/<이름>` 깊은 import 의 기본 내보내기로 받는다** — 이 계획의 새 코드는 아이콘을 쓰지 않는다.
- **오류 문구 카탈로그를 두지 않는다.** 실험실은 백엔드의 원본 응답을 가공하지 않고 그린다(`lib/lab/result.ts` 의 `bodyText`). 앱 자신의 오류 문구는 복사한 `UNUSABLE_RESPONSE_MESSAGE` 뿐이다 - 실험이 요청 없이 끝났을 때(받은 토큰의 세션이 이미 만료됐거나 토큰을 받지 못함 - `unusable`) 카드가 그린다.
- **복사한 파일은 `docs/provenance/copied-core.json`에 적고, 원본과 달라진 곳은 전부 `divergences`에 `what`·`why`로 남긴다.** 출처 커밋은 `34d0b1057d65693645e75bec4e9558dcf6838822`, 원본은 형제 디렉터리 `../template-typescript-nextjs`다. 이탈이 있는 경로는 `sourceBlobs`에 두지 않는다. 이 계획이 복사하는 것은 `lib/lab/experiments.ts`·`lib/lab/result.ts`·`test/unit/lab/experiments.test.ts`·`test/unit/lab/result.test.ts` 넷이다(결정 2). 복사본의 주석이 말하는 `actions.ts`·`'use server'`·`page.tsx`·"브리핑"·"판정 N" 같은 자리는 원본 저장소의 것이다 — 주석은 코드가 바뀐 곳과 옮긴 파일의 이름을 가리키는 곳만 고친다.
- **사라질 자리를 인용하지 않는다.** `app/`·`components/`·`lib/`·`platform/`·`queries/`·`test/` 안에서 선행 점이 붙은 `.superpowers/`, `superpowers/sdd`, `task-<번호>-report.md` 같은 세션 파일, 스크래치패드를 가리키지 않는다(게이트 [5]가 막는다). 근거는 사실 문장으로 적고, 문서가 필요하면 커밋되는 `docs/superpowers/`를 가리킨다.
- **계정 이름이 든 절대 경로를 저장소에 남기지 않는다.**
- **ESLint 타입 규칙이 잡는 것:** `async` 함수에는 `await`가 있어야 한다(`require-await`). 콜백으로 넘기는 멤버는 메서드가 아니라 함수 속성으로 선언한다(`unbound-method`). 쓰지 않는 `catch` 변수는 `catch {`로 쓴다(`no-unused-vars`의 `caughtErrors: all`). 떠 있는 Promise 는 `void` 로 받거나 `.catch` 로 잡는다(`no-floating-promises`).
- **세션 관리자의 거절은 호출자가 잡는다.** 실험실의 토큰 거절은 쓰기와 같은 길(`lib/resources/write.ts` 의 `accessToken`)이 잡아 이름과 문구만 기기 로그에 남기고, 실험은 요청 없이 `unusable` 로 끝난다 — 맨 `void manager.signOut()` 을 두지 않는다(`queries/AGENTS.md`).
- **세션이 필요한 요청은 D4 의 쓰기와 같은 길로 토큰을 받는다** — `lib/resources/write.ts` 의 `accessToken`(세션 가드, 만료 가드, 저장소 실패의 로그 - 스펙 7.2 의 D4 정정). 받은 토큰의 세션이 이미 만료됐으면 보내지 않는다: 회전이 판정을 받지 못하면 세션 관리자는 만료된 access 를 그대로 돌려주고, 그것을 실은 요청은 TOKEN_EXPIRED 로 세션을 지운다(D4 의 `b4ca428`).
- **쓰기 훅은 `throwOnError: (error) => !isSessionRejected(error)` 를 준다**(`queries/AGENTS.md` - "새 쓰기 훅도 같은 옵션을 준다"). 세션 거절은 쓰기 캐시의 `onError` 가 받고, 그 밖에 `mutationFn` 안에서 던져진 것은 결함이라 렌더 중에 다시 던져 오류 경계로 간다.
- **화면을 쌓는 이동(`router.push`)은 `useNavigateOnce`(`components/app/navigate-once.ts`)를 지난다**(D4 결정 35) - 홈의 실험실 진입과 실험실의 로그인 이동이 그렇다. 화면의 조회 훅은 `subscribed: useIsFocused()` 를 준다 - 실험실에는 조회 훅이 없다(결정 22).
- **한 파일만 도는 시험은 `pnpm exec vitest run <파일>`**이다 — pnpm 11은 `pnpm test -- <파일>`에 `--`를 그대로 넘겨 전체가 돈다. 계약 거울은 `pnpm test:contract`(`vitest.contract.config.mjs`)로만 돈다 - `pnpm test` 는 `test/unit/**` 만 본다.
- **게이트는 Git Bash에서 `./scripts/check.sh`로 돈다.** `pnpm check`는 Windows에서 cmd.exe가 `./`를 못 찾는다.
- **`expo export`는 언제나 `--clear`로 돌린다.** 이 개발 머신(Windows)에서 캐시를 둔 `expo export`는 끝날 때 간헐적으로 0xC0000005(Git Bash에서 139)로 죽었다(D1 실측 M1 관찰 8). 이 저장소의 `expo start`를 끄고, `TEMP`·`TMP` 를 `.maestro-output/` 안의 따로 만든 디렉터리로 돌린다(다른 Metro 와 임시 캐시를 나누지 않는다). D4 실측(`docs/superpowers/notes/2026-10-01-d4-measurements.md` 의 "`expo export` 의 139")은 그렇게 해도 출력(`Exported: …`)을 다 쓴 뒤 끝날 때 한 번 139 로 죽은 것을 적었다 - 캐시만이 방아쇠가 아니다. 그래도 139로 죽으면 다시 돌려 덮지 않는다 — 출력과 함께 기록에 적고 원인을 찾는다(스펙 16장: 재시도 0). 진단으로 다시 돌린 결과는 통과로 세지 않는다.
- **Gradle의 번들 단계(E2E APK 빌드의 `createBundleReleaseJsAndAssets`)도 Metro 캐시를 쓴다.** 그 단계가 0xC0000005·139로 죽으면 30분을 정해 원인을 가른다(D3·D4 전역 제약과 같다) — 못 찾으면 멈추고 기록과 함께 컨트롤러에 넘긴다.
- **개발 머신의 `joon-*` 컨테이너 9개를 절대 멈추지 않는다.** compose 명령은 모두 `-p template-typescript-expo-e2e`를 주고 그 프로젝트만 내린다(`test/contract/run.sh`·`test/e2e/run-android.sh` 가 그렇게 한다). Docker를 건드리는 단계는 앞뒤로 `docker ps --filter name=joon- -q | wc -l`이 `9`인지 확인한다. 같은 머신의 다른 `fastapi-*` 컨테이너도 건드리지 않는다.
- **Windows의 Android 네이티브 빌드는 저장소 루트가 실제 디렉터리 경로 47자 이하일 때만 된다**(D1 실측 M1). E2E 하네스가 짧은 경로(`E2E_STAGE_DIR`, 기본 `C:/t/e`)의 사본에서 빌드한다.
- **Maestro 플로 규칙:** 요소는 testID(`id:`)로 찾는다. `launchApp` 뒤에는 화면 요소를 기다린 다음 이동한다. **`hideKeyboard` 를 쓰지 않는다**(Maestro 2.11.0 의 Android 구현은 뒤로 가기다). 정규식 값은 작은따옴표로 감싼다. 실험실의 실행 버튼을 누른 뒤에는 `waitForAnimationToEnd` 로 스피너가 멈추기를 기다린다. 결과 본문처럼 키가 큰 요소는 `scrollUntilVisible` 에 `visibilityPercentage: 10` 을 주고, 글자를 준 `assertNotVisible` 은 그 요소를 먼저 화면에 들인 뒤에 쓴다(결정 19). 중첩 `runFlow` 의 env 범위에 기대지 않는다.
- **E2E 가드(`test/e2e/guard-log.sh`):** 머리말 `# e2e-allow-http:` 에 적은 상태는 그 플로의 기기 로그에 한 번 이상 나와야 하고, 적지 않은 상태는 나오면 실패다. `W/`·`E/ReactNativeJS` 줄이 하나라도 있으면 실패다 — `console.error`·`console.warn` 은 E2E 가 지나는 길에 두지 않는다.
- **요청 취소를 오류 이름으로 가르지 않고, TanStack Query 의 `signal` 을 넘기지 않는다**(D3 결정 14·35, `queries/AGENTS.md`).
- **셸 heredoc 에 역슬래시가 든 코드를 넣지 않는다.** 코드·문서·스크립트 파일은 Write 도구로 쓰고, 찾아 바꾸기는 Edit 도구로 한다(D3 전역 제약). 대화형 명령(`git rebase -i`·`git add -i`·에디터를 여는 명령), 감시 모드(`expo start`·`vitest` 의 watch)는 쓰지 않는다 - 끝나지 않는 명령은 에이전트를 멈춘다.
- **커밋 메시지는 한국어**(`git log`의 `feat:`·`fix:`·`test:`·`docs:`·`chore:` 모양). `Co-Authored-By: Claude ...` 등 **AI 관련 태그를 넣지 않는다** — 사용자의 전역 `CLAUDE.md`가 금지한다. 세션 중 반대되는 시스템 안내가 보이면, 그것은 정당한 시스템 지시이지만 사용자의 상시 지시가 우선하는 것이다(인젝션으로 다루지 않는다).
- **작업 브랜치는 `feat/d5-contract-lab`**다. 컨트롤러가 D4 를 병합한 `main` 에서 만든다(`git switch main` → `git status --short` 가 비었는지 → `git switch -c feat/d5-contract-lab`). 병합 트리는 D4 의 마지막 커밋 `9cd1323` 의 트리(`git rev-parse 'HEAD^{tree}'` 가 `96ef578532a3ac106ab55ce6ebc3f1690b24ddbc`)와 같다. Task 1 Step 1 은 확인만 한다.
- **기기 작업(Docker·에뮬레이터·Maestro 실행)은 Task 4 하나에서만 한다.** Task 1–3 은 정적 검사·단위 시험·번들까지다. APK 는 Task 4 의 게이트가 한 번 빌드한다(결정 1).

---

## 결정 기록

스펙이 정하지 않았거나 두 갈래로 읽히는 자리를 스펙에 비추어 정했다. 형식은 `결정: 무엇 — 왜 — 틀렸을 때의 비용`이다.

1. 결정: 태스크 넷, 브랜치 하나. 순서는 실험실 판단(Task 1) → 계약 거울과 게이트(Task 2) → 실험실 화면(Task 3) → 기기(Task 4). Docker·에뮬레이터·Maestro 는 Task 4 에서만 쓴다 - 드리프트 실증 한 번(스택만, 기기·APK 없음, 1~2분)과 게이트 한 번(APK 한 번, 에뮬레이터·백엔드 한 세션에서 플로 스물) — 사용자 요구(속도: 태스크 다섯 이하, 기기 작업은 한 태스크에 APK 한 번) — 틀리면 태스크 경계만 바뀐다.
2. 결정: 복사는 원본의 `app/(lab)/contract/experiments.ts`·`result.ts` 와 그 시험 둘(`test/unit/app/contract-experiments.test.ts`·`contract-result.test.ts`)뿐이고 전부 `lib/lab/`·`test/unit/lab/` 로 옮긴다. `result.ts` 는 내용이 원본과 같아 `sourceBlobs` 에 원본 경로의 blob(`8a389e2…`)을 적고, 옮긴 경로는 출처 기록의 `note` 에 적는다. 나머지 셋은 이탈을 적는다(`offsetWalk`·import 경로) — 스펙 6.2 의 표가 그 둘(+시험)만 적는다. 원본의 `actions.ts`(Server Action)·`page.tsx`·`result-view.tsx`·`layout.tsx` 와 `test/unit/components/contract-result.test.ts`(renderToStaticMarkup 컴포넌트 시험)는 `app/**` 의 화면·DOM 이라 복사하지 않는다(스펙 6.2 의 "복사하지 않는 것", 11.1 의 "컴포넌트 단위 테스트는 두지 않는다") — 틀리면(실행부도 복사본으로 적어야 하면) `lib/lab/run.ts` 를 경로에 더하고 이탈을 여럿 적는다.
3. 결정: 원본 Server Action 의 자리는 새 파일 `lib/lab/run.ts` 다 - 쓰기가 받는 것(D4 의 `WriteDeps` - 전송 `send`·토큰 `getAccessToken`·지금의 세션 `currentSession`·시계 `now`)에 기기 언어(`deviceLanguage`)를 더해 주입받고 `test/unit/lab/run.test.ts` 가 가짜로 잰다. D4 의 `lib/resources/write.ts` 와 같은 모양이다. 스펙 5장의 `lib/lab/` 는 "세션" 을 소유하지 않는다 - 토큰을 주는 함수를 받을 뿐 세션 관리자를 부르지 않는다(스펙 8.6 의 D5 정정에 적는다) — 판단은 node 에서 재야 한다(스펙 11.1). 훅에 두면 실험마다의 갈래를 MutationObserver 를 거쳐 재야 하고(훅의 시험은 배선과 결함의 갈래만 본다 - 결정 27) 요청 조립이 `queries/` 에 들어온다(스펙 5장 위반) — 틀리면 실행부를 옮기고 시험 32 를 잃는다.
4. 결정: 세션이 필요한 셋(`putUpsert`·`relationshipWrite`·`acceptLanguage`)의 가드는 `run.ts` 의 `switch` 에 적고 `experiments.ts` 의 `needsSession` 을 읽지 않는다. `run.test.ts` 가 `EXPERIMENTS` 를 돌며 둘이 같은지 잰다(세션 없이 누르면 요청 없이 거절 / 세션 없이 돌고 토큰을 묻지 않음) — 원본의 판정: 데이터 파일 하나의 실수로 가드가 풀리지 않게 한다 — 틀리면 분기를 `needsSession` 으로 바꾸는 한 줄.
5. 결정: 세션이 없거나 백엔드가 세션을 거절하면(스펙 9.2 의 네 코드) `run.ts` 가 D4 의 `sessionRejected()` 를 던진다. 기기 세션을 지우는 것은 D4 의 쓰기 캐시 `onError` 한 곳이고(스펙 9.2), 로그인으로 보내는 것은 실험실 화면이 `mutate` 의 호출별 `onError` 에서 `router.push(loginHref(pathname))` 로 한다 - 실험실은 공개 경로라 경로 가드가 보내지 않는다(스펙 7.3). 그 이동은 화면에 하나인 `useNavigateOnce` 를 지난다 - 세션이 필요한 실험 둘이 잇달아 거절돼도 로그인 화면은 하나다(D4 결정 35). 로그인하면 로그인 화면의 `dismissTo(next)` 가 실험실로 되돌린다 — D4 넘김("실험실 화면을 보호 경로로 두지 않는다면 `onError` 가 직접 `loginHref` 로 보내야 한다"). 이동을 전역 `onError` 에 두면 `platform/` 이 지금 경로와 라우터를 알아야 하고, 보호 경로의 쓰기 화면은 가드가 이미 보낸다 — 틀리면(전역에서 보내야 하면) `query-client.ts` 의 `onError` 에 이동 한 갈래.
6. 결정(D2 운반 M8): `apiRequest` 는 호출자가 준 `acceptLanguage` 를 덮지 않는다 - 기기 언어는 호출자가 주지 않을 때만 싣는다. 기기 언어를 만드는 함수 `deviceAcceptLanguage()` 를 내보내고, 실험실은 모든 요청에 그 값을 명시해 실어 결과의 "보낸 요청 헤더" 에 적는다(언어 협상 실험만 `ko`·`en`). `test/unit/platform/api.test.ts` 에 두 행을 더한다 — 스펙 8.6 의 언어 협상 실험은 같은 오류를 두 언어로 받아야 하는데 덮으면 둘 다 기기 언어다. 원본 `result.ts` 의 원칙("보낸 요청 헤더가 거짓이 되지 않는다")도 지킨다. 호출부마다 언어를 넘기던 원본의 결함(스펙 9.4 - `null` 뮤턴트)은 돌아오지 않는다 - 실험실 밖의 호출은 여전히 언어를 넘기지 않는다 — 틀리면(덮어야 하면) 실험실이 `request()` 를 `lib/` 에서 직접 불러야 한다(스펙 9.4 의 "모든 요청이 그 클라이언트를 지난다" 위반).
7. 결정: offset 순회는 `examples` 를 쪽당 3건(`page[number]=1&page[size]=3`)으로 시작해 `links.next` 가 `null` 이거나 키가 없을 때까지 그 쿼리 그대로 따라가고, 상한 20회에 걸리면 맺음말에 적는다. 빈 쪽이라도 링크가 있으면 따라간다 — 스펙 8.6 의 문장 그대로다. 3 은 원본 커서 순회의 쪽 크기로 씨앗 여섯 행이면 두 쪽이다 — 틀리면 상수 하나.
8. 결정: 페이지 총합의 두 요청은 모두 쪽당 1건(`page[size]=1`)이다(원본은 쪽 크기를 주지 않았다 - 기본 20건). 켠 요청에만 `meta.totalCount` 가 오는 것은 쪽 크기와 무관하고, 한 건이면 두 본문이 폰 화면 한두 장에 들어 E2E 가 두 본문을 화면에 들일 수 있다 — 틀리면 상수 하나.
9. 결정: 관계 전용 쓰기의 태그 조회(1단계)는 토큰 없이 보낸다(원본은 토큰을 실었다) — 스펙 7.2 "읽기는 공개이므로 토큰 없이 보낸다" — 틀리면 옵션 한 줄.
10. 결정: 결과 화면은 `parseCombinedSteps`(복사본)로 단계마다 머리글과 본문을 갈라 각각 testID 를 단다(`lab-step-heading-<id>-<n>`·`lab-step-body-<id>-<n>`) — Maestro 는 화면 글자를 파싱할 수 없어서 단계의 본문끼리 보려면 요소가 갈려 있어야 한다. 원본 E2E 가 이 파서로 머리글을 걷어낸 이유(머리글이 남으면 본문이 같아도 조각이 늘 다르다)와 같다 — 틀리면 결과를 한 덩어리로 그리고 E2E 의 단계 단언을 잃는다.
11. 결정: 원본 응답은 고정폭 글꼴로 그리되 글꼴은 `Platform.select({ ios: 'Menlo', default: 'monospace' })` 의 `style` 이다 — Tailwind 의 `font-mono` 는 쉼표로 이은 CSS 글꼴 목록이라 글꼴 이름 하나를 받는 네이티브 `fontFamily` 가 될 수 없다(`node_modules/tailwindcss/theme.css` 의 `--font-mono`). 플랫폼마다 다른 스타일은 `Platform.select` 로 고르는 규칙(루트 `AGENTS.md`)을 따른다 — 틀리면 글꼴 한 줄.
12. 결정: 계약 거울은 앱의 `request()` 를 쓰지 않고 `fetch` 로 원본 응답(상태·파싱한 본문)을 받는다(`test/contract/backend.ts`) — 원본 `mirror.spec.ts` 가 Playwright 의 요청 컨텍스트로 원본을 본 것과 같다. 거울이 재는 것은 선언과 백엔드이지 앱의 클라이언트가 아니고, `request()` 는 설정 자리(`getSettings`)와 합성 오류를 끼워 넣는다 — 틀리면 도우미 한 곳을 `request()` 로 바꾼다.
13. 결정: `test/contract/mirror.test.ts` 는 원본 `test/e2e/mirror.spec.ts` 의 검사 넷을 옮긴 새 파일이라 출처 기록에 넣지 않는다 — 스펙 6.2 의 복사 표에 없고(11.2 는 "검사 넷을 옮긴다"), Playwright 에서 vitest 로 틀이 바뀌어 그대로인 줄이 없다. 판단(`lib/resources/mirror.ts`)은 이미 원본 그대로인 복사본(`sourceBlobs`)이다 — 틀리면 경로 하나와 이탈 여럿.
14. 결정: ③ 속성 제약은 `beforeAll` 에서 한 번 가입·로그인한 토큰으로 다섯을 잰다(원본은 시험마다 가입했다). 원본의 판정대로 선언을 넘긴 값만 보낸다 - 행을 만들지 않고, 선언이 백엔드보다 좁은 쪽(`maxLength` 를 줄이면 백엔드가 받는다)을 잡는다 — 요청 수가 줄고 원본의 명제는 그대로다. 선언이 넓은 쪽(백엔드가 먼저 막는다)은 이 검사가 잡지 못한다 - 원본과 같은 한계이고 스펙 11.2 의 D5 정정에 적는다 — 틀리면 경계값을 보내는 시험(행이 생긴다)을 더한다.
15. 결정: 거울은 `test/contract/run.sh` 가 스택을 따로 띄우고 내린다 - E2E 와 같은 compose 프로젝트(`template-typescript-expo-e2e`)·같은 포트이고, access 수명은 백엔드 기본값 900초로 못박는다(E2E 하네스는 10초). 게이트의 `[12/13]` 과 `[13/13]` 이 각자 띄운다 — 스택을 넘기면 E2E 가 앞 단계의 수명·행을 물려받고, E2E 하네스는 늘 새 스택에서 시작한다(`compose_down` 먼저). 대가는 스택 기동 한 번(수십 초) — 틀리면 게이트가 한 스택을 두 단계에 넘기는 모양으로 바꾼다.
16. 결정: 거울의 vitest 는 설정을 따로 둔다(`vitest.contract.config.mjs`, `pnpm test:contract`). 주소는 `CONTRACT_API_URL` 이고 기본값을 두지 않는다 — 단위(`pnpm test`)는 백엔드 없이 돌아야 하고, 주소 없이 돌리면 스택 없이 돈 것이라 첫 요청에서 그 사실을 알리고 실패한다(필수 값에 암묵적 기본값을 두지 않는 스펙 10.1 의 태도) — 틀리면 환경 변수 하나.
17. 결정: 원본의 `test/e2e/matrix.ts`(+ 시험)는 D5 가 복사하지 않는다 - 백엔드 종류(`BACKEND_KIND`) 검증은 세 백엔드 매트릭스(CI, D7)의 것이다. D5 의 거울과 실험실은 FastAPI 하나로 돈다(스펙 12장: 로컬 게이트는 FastAPI 하나) — 스펙 6.2 가 그 행을 "하네스가 Maestro 다" 로 적어 매트릭스 하네스와 묶었고, D1 계획은 D5 에 `lib/lab/` 만 배정했다 — 틀리면 D7 이 복사하며 `test/contract/run.sh` 에 프로파일 선택을 더한다(다음 계획 절).
18. 결정: 드리프트 감지의 실증은 자원 선언에 어긋남 둘(`title.maxLength` 200 → 100, `filters.title` 에 `gt`)을 넣고 `./test/contract/run.sh` 를 한 번 돌려 정확히 두 시험이 죽는 것(`Tests  2 failed | 87 passed (89)`)을 본 뒤 되돌린다. 게이트보다 먼저 한다 — 스펙 15장 단계 5 의 산출이 "드리프트 감지" 이고, 한 번도 빨개지지 않은 가드는 있으나 마나다(원본 인용 검사가 겪은 일). 두 축(조회 정책 ①, 속성 제약 ③)을 한 번에 재고, 나머지 87 이 통과해 스택·가입이 성했다는 것도 함께 잰다 — 틀리면(한 번에 둘이 서로를 가리면) 변이마다 한 번씩 돌린다(1~2분씩).
19. 결정: 실험실 E2E 는 플로 둘 - 로그인하지 않은 채(`contract-lab-anonymous`)와 로그인한 뒤(`contract-lab-signed-in`)다. 세션이 필요한 셋의 익명 이동은 셋 다 잰다(원본 판정: 셋이 각자 가드를 갖는다). 실행을 누른 뒤에는 스피너(`ActivityIndicator`)가 멈추기를 `waitForAnimationToEnd` 로 기다린다 - 도는 동안 `scrollUntilVisible` 이 화면을 밀면 늦게 온 결과가 화면 위쪽에 끼어 아래로 찾는 스크롤이 지나친다. 결과 본문은 길어서 단언할 요소를 `scrollUntilVisible` 로 들이고, 키가 큰 본문에는 `visibilityPercentage: 10`(Maestro 2.11.0 의 기본은 100 - `maestro-orchestra-models.jar` 의 `ScrollUntilVisibleCommand`)을 준다. 글자를 준 `assertNotVisible` 은 그 요소가 화면에 있을 때만 뜻이 있어 먼저 들인다 — 스펙 11.3 "여섯 실험(8.6), 익명의 로그인 이동" — 틀리면(기기에서 보이는 판정이 다르면) Task 4 의 갈래대로 고친다.
20. 결정: 홈에 실험실 진입(`home-lab-link`, "계약 실험실", outline 버튼)을 목록 진입 아래에 둔다. `Link` 가 아니라 `useNavigateOnce` 를 지나 `router.push('/contract')` 하는 버튼이다 - 화면을 쌓는 이동은 한 번만 한다(D4 결정 35 - D4 의 "새로 만들기"·"수정" 과 같다). 목록 진입(`Link`)은 D2 의 모양 그대로 둔다 - D4 가 바꾸지 않았고 이 계획의 범위 밖이다 — 스펙 8.1 "홈 — 목록·실험실 진입" — 틀리면(목록 진입도 같은 가드를 지나야 하면) 그 `Link` 를 같은 버튼으로 바꾸는 Edit 하나.
21. 결정: 실험실 라우트는 `app/(lab)/contract.tsx` 하나이고 그룹 레이아웃이 없다 - 루트 Stack 의 기본 머리글(뒤로 가기)과 화면이 정한 제목을 쓰고, 로그아웃 버튼이 없다 — 스펙 4장의 트리 그대로이고, 원본의 실험실도 세션 바를 두지 않았다(로그인 여부와 무관하게 같은 화면 - 세션 안내가 실증의 일부다) — 틀리면 `(lab)/_layout.tsx` 하나.
22. 결정: 실험의 결과는 조회 캐시에 두지 않는다 - 실험마다 `useMutation`(키 `['lab', <id>]`)이고 화면을 떠나면 사라진다. 조회가 아니라서 화면 조회의 `subscribed: useIsFocused()`(D4)를 줄 자리도 없다. 한 번에 하나만 돈다(D4 의 `useSubmitOnce`) — 실험은 누를 때마다 새로 부르는 쓰기이고(PUT·관계 쓰기), 로그아웃이 비우는 조회 캐시에 원본 응답을 남기지 않는다. 결과에는 토큰이 없다(`authorization` 은 가린다 - 시험이 잰다) — 틀리면 캐시 키.
23. 결정: 이 계획의 모든 "찾을 것"·끼울 자리는 D4 의 마지막 커밋 `9cd1323`(D4 완료 - `main` 에 병합되는 트리 `96ef5785…`)에 맞췄다. 그 앞의 실제 커밋 `71057c5`·`538b84b`·`3627679`·`9106de5` 에서도 같은 연산이 모두 맞았다 - 트리를 `git archive`·`git diff` 로 꺼내 이 문서를 태스크 순서대로 기계적으로 적용했다(사실 절). Task 1 Step 1 이 `main` 의 트리를 확인한다 - 다르면(병합 뒤 다른 것이 들어왔으면) "D4 의 끝에서 다시 본 자리" 표의 자리부터 보고, 글자가 바뀐 자리는 같은 뜻의 자리를 찾아 고친다(D4 결정 31). 전체를 바꾸는 `scripts/check.sh` 는 바꾸기 전에 blob 을 대조한다(`45a57dc…` - D2 의 끝부터 D3·D4 가 건드리지 않았다) — 틀리면(Edit 가 여럿 어긋나면) 앵커를 맞추는 시간이 들고, 뜻이 다르게 옮겨진 곳은 태스크 리뷰가 잡는다.
24. 결정: 게이트 `[12/13]` 이 변이 없이 실패하면(선언과 지금의 백엔드가 이미 어긋났다) 시험을 느슨하게 하지 않고 멈춰 기록과 함께 컨트롤러에 넘긴다 - 선언(`lib/resources/*.ts`)은 원본 그대로인 복사본이라 고치면 이탈을 적어야 하고, 어느 쪽이 맞는지는 백엔드 소스를 읽어 정한다 — 스택의 백엔드 이미지는 GitHub `main` 에서 빌드한다(스펙 11.4). 계획을 쓰며 정본 FastAPI(`3c4eee3`)의 조회 정책·스키마를 읽어 `examples` 의 선언과 같음을 확인했다(사실 절) — 틀리면(백엔드가 바뀌었으면) 그것이 이 계획이 잡으려던 드리프트다.
25. 결정: 스펙 정정은 8.6(실험실의 모양), 9.4(호출자의 언어), 11.2(거울의 모양), 11.3(실험실 E2E), 12장(13단계)에 붙인다 - 각 절 끝(다음 제목 바로 앞) — 스펙과 달라졌거나 스펙이 정하지 않은 자리이고, 정정은 날짜 붙은 인용 블록이다(스펙 0장) — 틀리면 문장.
26. 결정: 세션이 필요한 셋은 D4 의 쓰기와 같은 길로 토큰을 받는다 - `lib/resources/write.ts` 의 `accessToken`(세션이 없으면 세션 거절을 던지고, 저장소가 실패하거나 받은 토큰의 세션이 이미 만료됐으면 `{ ok: false }`)을 `export` 해 `run.ts` 가 부르고, `ok: false` 면 요청 없이 `{ kind: 'unusable' }` 로 끝나 카드가 앱 문구(`UNUSABLE_RESPONSE_MESSAGE`)를 그린다. `LabDeps` 는 `WriteDeps` 를 넓힌다(지금의 세션 `currentSession`·시계 `now` - 앱에서는 `sessionManager.current`·`Date.now`) — D4 의 만료 가드(`b4ca428`, 스펙 7.2 의 D4 정정): 회전이 판정을 받지 못하면 세션 관리자가 만료된 access 를 그대로 돌려주고, 그것을 실은 요청은 TOKEN_EXPIRED 로 세션을 지운다 - 실험실의 PUT 한 번이 로그아웃이 된다. E2E 는 access 수명이 10초라(D4 Task 5) 실험마다 회전을 지난다. 가드를 실험실에 한 벌 더 두면 둘이 갈라진다 — 틀리면(실험실이 만료된 토큰을 그대로 보내 원본 401 을 보여야 하면) `withToken` 이 `getAccessToken` 을 직접 부르는 세 줄, 시험 넷, `write.ts` 의 `export` 한 단어.
27. 결정: 실험실의 쓰기 훅은 `throwOnError: (error) => !isSessionRejected(error)` 를 준다 - 세션 거절은 쓰기 캐시의 `onError` 와 화면의 호출별 콜백이 받고, 그 밖에 던져진 것(실행부는 응답을 전부 결과로 옮기므로 결함이다 - 설정 오류처럼 `request()` 가 일부러 던지는 것)은 렌더 중에 다시 던져 오류 경계로 간다. 훅의 옵션(`labExperimentMutationOptions`)을 내보내 `test/unit/queries/lab.test.ts` 가 D4 의 `writes.test.ts` 처럼 MutationObserver 로 돌린다(결함·세션 거절의 갈래와 세션 관리자·API 클라이언트·기기 언어의 배선, 넷) — D4 `538b84b` 의 `queries/AGENTS.md`: "새 쓰기 훅도 같은 옵션을 준다". 예외를 훅의 `onError` 가 로그로 남기고 카드가 앱 문구를 그리는 모양은 배포에 고정된 설정 오류를 "요청을 처리할 수 없다" 배너로 삼킨다 — 틀리면 옵션 한 줄과 시험 둘.

---

## 이 계획이 근거로 삼은 사실 (2026-10-01 확인)

추측이 아니라 그날 원본·설치본·백엔드 소스에서 직접 읽거나 스크래치에서 돌려 본 것이다.

**원본(template-typescript-nextjs `34d0b10`)의 실험실**:
- `app/(lab)/contract/experiments.ts`(blob `ffc364a…`, 72줄)는 `Experiment { id, title, proves, needsSession }` 여섯의 데이터다 - `putUpsert`·`relationshipWrite`·`cursorWalk`·`pageTotals`·`acceptLanguage`·`invalidFilter`, 세션이 필요한 것은 `putUpsert`·`relationshipWrite`·`acceptLanguage`.
- `app/(lab)/contract/result.ts`(blob `8a389e2…`, 237줄)는 `ExperimentResult`·`RawStep`·`requestHeaders`(authorization 은 `Bearer <redacted>`)·`displayPath`·`bodyText`(오류는 `{errors}` 로 다시 감싼다, 204 는 "본문 없음" 문장)·`singleStepResult`·`stepHeading`·`combinedStepsResult`·`parseCombinedSteps`·`COMBINED_NOTE_PREFIX` 를 갖는다. import 는 `@/lib/jsonapi/client` 의 `JSONAPI_MEDIA_TYPE`·`JsonApiResult` 하나 - 이 저장소에서도 같은 별칭이라 `lib/lab/` 로 옮겨도 한 글자도 바뀌지 않는다(스크래치에서 blob 이 같았다).
- 두 시험(blob `a4af27d…`·`91376c4…`)은 `@/app/(lab)/contract/…` 를 import 한다 - 21개·26개.
- `app/(lab)/contract/actions.ts`(Server Action)는 실험마다 요청을 만들고 `requireSession()` 을 세 case 에 하드코딩하며, 세션이 죽은 오류(`actionForErrors` 가 `destroySession`)면 쿠키를 지우고 `/login` 으로 보낸다. PUT 대상은 고정 id `55550000-0000-4000-8000-000000000001`, 커서 순회는 쪽당 3건·상한 20회(`MAX_CURSOR_REQUESTS`), 언어 협상은 제목이 빈 본문(`minLength` 위반, 422)을 `ko` 다음 `en` 으로 보낸다. 태그 조회에도 토큰을 실었다.
- `test/e2e/mirror.spec.ts` 의 검사 넷: ① `mirrorProbes` 를 자원마다 전부, ② `page[size]=1` 의 `data[0].attributes` 키와 `attributeKeys`, ③ `examples` 에 로그인 뒤 POST - `maxLength+1`·`max+1`·`min-1`·선언 밖 status(2xx 가 아닌지, 422·포인터인지 둘로 나눔), ④ `exact` 가 선언된 enum 값마다 GET 2xx. 오류는 `code`·`source` 만 본다.

**이 저장소(D4 의 마지막 커밋 `9cd1323` - `main` 에 병합되는 트리)**: `lib/resources/mirror.ts`·`test/unit/resources/mirror.test.ts` 는 D1 이 원본 그대로 복사했다(`sourceBlobs`). `lib/resources/write.ts`(D4)가 `sessionRejected()`·`isSessionRejected()`·`WriteSession`·`WriteDeps`(`getAccessToken`·`currentSession`·`now`·`send`)를 내보내고, 토큰을 받는 `accessToken(deps)` 는 내보내지 않는다 - 세션이 없으면 세션 거절을 던지고, 저장소가 실패하면 `[write] access token 을 받지 못했다 - <이름>: <문구>` 한 줄(`lib/auth/error-detail.ts` 의 `errorDetail`)을 남기고 `{ ok: false }`, 받은 토큰의 세션이 이미 만료됐으면(`accessExpiresAt <= now()`) 로그 없이 `{ ok: false }` 다(D4 의 `b4ca428`, 스펙 7.2 의 D4 정정). `queries/writes.ts` 의 `WRITE_DEPS` 가 `currentSession: sessionManager.current`·`now: () => Date.now()` 를 꽂고, 쓰기 옵션이 `throwOnError` 로 세션 거절이 아닌 것만 오류 경계로 보내며 내보내진다 - `test/unit/queries/writes.test.ts` 가 `vi.mock('@/platform/api')`·`vi.mock('@/platform/session')` 과 `MutationObserver`·`shouldThrowError` 로 돈다. `platform/query-client.ts` 의 쓰기 캐시 `MutationCache.onError` 가 세션 거절이면 `sessionManager.signOut()` 한다. `queries/submit-once.ts` 의 `useSubmitOnce(mutationKey)`, `components/app/navigate-once.ts` 의 `useNavigateOnce()` - 첫 부름이 잠그고 누른 화면이 다시 앞에 오면(`useIsFocused`) 푼다. 루트 레이아웃(`app/_layout.tsx`)은 `ErrorBoundary` 를 내보내고, 세션 복원이 끝나기 전에는 아무 화면도 그리지 않는다(`AppRoot`) - 공개 경로인 실험실도 복원 뒤에만 그려지므로 쓰기 캐시의 `signOut` 이 복원과 겹치지 않는다. 홈(`app/(app)/index.tsx`, blob `538fbc4…`)은 D2 의 모양 그대로 `Link href="/examples"` 하나다. `platform/api.ts`(D2, blob `84b4d6c…`)의 `apiRequest` 는 `withAcceptLanguage(options, acceptLanguageFromLocales(tags))` 로 **호출자가 준 언어를 덮는다**(D2 운반 M8). `lib/auth/protected-paths.ts` 의 `loginHref(pathname)` 는 `/login?next=<인코딩한 경로>`, 로그인 화면은 `router.dismissTo(next, { withAnchor: true })` 로 돌아가고, 뒤로 갈 화면이 있으면 "홈으로" 를 그리지 않는다(헤더의 `canGoBack`). `components/form/submit-button.tsx` 의 `SubmitButton({ testID, label, pending, onPress })` 는 도는 동안 `ActivityIndicator` 만 그린다. `test/e2e/scripts/examples-api.js` 의 `STEP=account` 는 `EMAIL`·`PASSWORD` 로 가입만 하고 `output.prefix` 를 남긴다. 하네스(`test/e2e/run-android.sh`)가 `E2E_ACCESS_EXPIRES_SECONDS` 를 기본 10 으로 내보내고 `docker-compose.e2e.yml` 이 세 백엔드의 `JWT_ACCESS_EXPIRES_SECONDS` 로 넘긴다(기본 900 - 스펙 11.3 의 D4 정정). 플로는 18(D2 일곱·D3 일곱·D4 넷 - `examples-create`·`-delete`·`-edit`·`-write-errors`, 이름 순으로 실험실 플로 뒤)이다. D4 의 쓰기 플로는 빠른 두 번 누름을 `repeat: 2` 로 재는데, 둘째 누름이 다음 화면의 같은 자리에 닿을 수 있어 그 자리에 누를 것이 없는 곳에서만 쓴다(`test/e2e/AGENTS.md` 의 `## 쓰기 플로`) - 홈의 실험실 진입 자리에는 실험실의 첫 카드가 오므로 이 계획의 플로는 쓰지 않는다. 씨앗(`test/e2e/seed/examples.sql`)의 `examples` 는 여섯 행이다(분류·태그에는 참조 목록 밖의 채움 행이 있다). 출처 기록은 경로 48·이탈 37·원본 그대로 31 이다(D4 가 `docker-compose.e2e.yml`·`view.ts` 의 이탈을 더했다). `vitest.config.mjs` 의 `include` 는 `test/unit/**/*.test.ts` 다. `test/tsconfig.json` 은 `test/**/*.ts` 를 `node` 타입과 함께 검사한다. 게이트는 `[12/12] E2E` 까지이고 `scripts/check.sh` 의 blob 은 `45a57dc…`(D2 의 끝과 같다). D4 실측은 `expo export --clear` 가 `TEMP`·`TMP` 를 갈라도 출력을 다 쓴 뒤 한 번 139 로 죽은 것을 적었다(진단으로 다시 돌린 둘은 exit 0).

**정본 FastAPI(`template-python-fastapi` `3c4eee3`)**:
- `app/schemas/example.py` 의 `EXAMPLE_QUERY_POLICY` - 필터 `title`(exact·contains)·`status`(exact·in)·`score`(exact·gt·gte·lt·lte·in)·`category.id`(exact·in·isNull)·`createdAt`(exact·gt·gte·lt·lte), 정렬 `title`·`status`·`score`·`createdAt`·`updatedAt`. 제목 1–200자, 점수 0–100, 상태 `draft`·`active`·`archived`(`app/models/example.py`). 이 저장소의 `lib/resources/example.ts` 와 같다. 분류 정책은 `name`(exact·contains), 정렬 `name`·`createdAt`.
- `app/controllers/api/v1/examples_controller.py` - `enable_upsert = True`(PUT upsert).
- `app/jsonapi/query.py` - 기본 쪽 크기 20·상한 100. offset 링크는 페이지가 아닌 파라미터와 `page[totals]`·`page[number]`·`page[size]` 를 싣고, 더 없으면 `next` 가 `null` 이다(`build_pagination_links`). `page[totals]=true` 를 켠 요청에만 총합을 센다.

**Maestro 2.11.0**(`~/.maestro/lib/`): YAML `scrollUntilVisible` 은 `visibilityPercentage`(정수)·`centerElement`·`timeout`·`speed` 를 받는다(`maestro-orchestra.jar` 의 `YamlScrollUntilVisible`). 기본 시간 제한 20000ms, 기본 보이는 비율 100(`maestro-orchestra-models.jar` 의 `ScrollUntilVisibleCommand`). `waitForAnimationToEnd` 는 `timeout` 을 받는다(`YamlWaitForAnimationToEndCommand`). `check-syntax` 명령이 있다(`maestro-cli-2.11.0.jar` 의 `CheckSyntaxCommand`).

**Tailwind 4.3.3**(`node_modules/tailwindcss/theme.css`): `--font-mono` 는 `ui-monospace, SFMono-Regular, Menlo, …, monospace` 의 목록이다.

**계약 거울의 크기**(스크래치에서 vitest 의 JSON 보고로 셌다): 시험 89 - ① 프로브 77(`examples` 51·`exampleCategories` 13·`exampleTags` 13), ② 3, ③ 5, ④ 4(enum 값 셋과 "잴 enum 이 하나 이상"). 닿지 않는 주소(`http://127.0.0.1:9`)로 돌리면 `Tests  83 failed | 1 passed | 5 skipped (89)`(③ 의 다섯은 준비 단계의 가입이 실패해 건너뛴다) - 백엔드 없이는 초록이 되지 않는다.

## 미리 돌려 본 것

스크래치 사본에서 돌렸다 — 저장소에는 쓰지 않았다(저장소와 형제 저장소는 `git show`·`git archive`·`git diff`·`git log`·`git rev-parse` 로 읽기만 했다).

**바탕 트리.** D4 브랜치의 `71057c5` 를 `git archive` 로 꺼내 `pnpm install --frozen-lockfile` 했고, 그 위에 `538b84b`·`3627679`·`9106de5`·`9cd1323` 까지의 `git diff` 를 차례로 얹었다(`package.json`·잠금 파일은 그대로다) - 다섯 트리의 해시가 저장소의 다섯 커밋과 같다(`a183286…`·`126a1ff…`·`0ac420a…`·`4d418ec…`·`96ef578…`). 앞의 네 트리에서 typecheck·lint·format:check·인용·출처 검사가 exit 0 이었고, `9cd1323`(`9106de5` 에서 D4 실측 기록과 플로 둘의 주석만 바뀌었다)에서는 format:check·출처·단위를 다시 돌려 통과했다. `9cd1323` 에서 단위 시험 1440(64 파일), 출처 기록 48·37·31, 플로 18, blob 셋(`platform/api.ts`·`scripts/check.sh`·홈)은 전제 표와 같다.

**이 계획을 그 위에서 글자 그대로.** 트리마다 새 가지를 만들어 이 문서를 D4 작가의 도구(`sim.mjs` - 계획의 Edit·파일 쓰기·끼울 자리·덧붙이기를 적용하고 찾을 것이 정확히 한 번 맞지 않으면 실패한다)로 태스크 순서대로 적용하고, 각 Step 의 명령(원본 `git show`·출처 스크립트·`pnpm format`·`types:routes`)을 그 자리에서 돌렸다. 연산 60개(Edit 33·끼울 자리 6·파일 쓰기 19·덧붙이기 2)가 다섯 트리에서 모두 적용됐다 - Edit 와 끼울 자리는 하나도 빠짐없이 정확히 한 번씩 맞았다. 태스크마다 `pnpm format` 뒤 typecheck·lint·format:check·인용·출처가 exit 0 이었고, `9106de5` 위에서:

- Task 1: 빨간 단계 `Test Files  4 failed (4)`·`Tests  2 failed | 14 passed (16)`(세 파일은 `Cannot find package '@/lib/lab/experiments'`·`'@/lib/lab/result'`, `api.test.ts` 는 새 두 행), 초록 `Tests  95 passed (95)`, 전체 `67 passed`·`1521 passed`, 출처 52·40·32.
- Task 2: 거울을 주소 없이 돌리면 `CONTRACT_API_URL 이 없다` 와 `Tests  83 failed | 1 passed | 5 skipped (89)`, 단위 1521 그대로(거울이 `pnpm test` 에 섞이지 않는다), 바꾸기 전 `check.sh` 의 blob `45a57dc`, `bash -n` 둘.
- Task 3: 훅의 옵션 시험이 빨강(`Cannot find package '@/queries/lab'`, `Tests  no tests`) → 초록(`Tests  4 passed (4)`), 타입드 라우트에 `/contract`, 전체 `68 passed`·`1525 passed`, `lint:secrets` 통과. `expo export --clear`(TEMP·TMP 를 따로 두고 - Task 3 Step 8 의 명령 그대로) 두 플랫폼 번들이 exit 0·`Exported: dist`·`Unable to resolve` 0 이었다. 괄호 안의 모듈 수는 같은 커밋을 여섯 번 묶는 동안 Android 1974–2065·iOS 1841–1972 로 흔들렸다 - D1 실측 M5 의 번들 절이 적은 그대로라 기대값에 넣지 않는다.
- Task 4: 플로 20(바탕 18 + 둘), 문서·기록 뼈대의 format·인용 검사.

앞의 세 트리에서도 연산과 검사의 결과가 같았고 단위 시험만 바탕만큼 달랐다(`3627679` 1503·1507, `538b84b` 1498·1502, `71057c5` 1467·1471). 마지막 글자로 다시 적용한 트리는 검사를 돈 트리와 해시까지 같았다. `9cd1323` 위의 결과는 `9106de5` 위의 결과와 그 커밋이 바꾼 세 파일 밖에서 같다 - 이 계획의 연산은 그 세 파일에 없다.

**뮤턴트**(`9106de5` 위). 새 갈래마다 하나씩 넣어 시험이 잡는지 봤다 - 모두 죽었다: 실험실이 `accessToken` 대신 `getAccessToken` 을 직접 부르면(만료 가드를 지나지 않는다) 5개, `unusable` 대신 빈 토큰으로 보내면 5개, `putUpsert` 가 토큰 없이 돌면 4개, `dieIfSessionDead` 의 몸통을 지우면 6개, 훅이 결함을 오류 경계로 보내지 않으면(`throwOnError: false`)·세션 거절까지 보내면(`true`)·지금의 세션을 꽂지 않으면·기기 언어를 꽂지 않으면 각 1개.

**돌리지 않은 것:** Docker·에뮬레이터·`maestro test`·게이트 [9]·[11]–[13]. 거울이 실제 백엔드에서 초록인지(89 통과)와 변이 둘에 정확히 두 시험이 죽는지, 실험실 플로 둘(access 수명 10초의 회전 아래에서 만료 가드가 실험을 막지 않는지까지)은 Task 4 가 처음 잰다.

---

## D3·D4 가 넘겨야 하는 것 (이 계획의 전제)

Task 1 Step 1 이 확인한다. 하나라도 없으면 멈추고 컨트롤러에 알린다. 표는 D4 의 마지막 커밋 `9cd1323` 에서 다시 확인했다 - `main` 의 트리가 그것과 다르면 이 계획의 Edit 블록은 같은 뜻의 자리를 찾아 고친다(결정 23).

| 산출 | 이 계획이 쓰는 모양 |
| --- | --- |
| `lib/resources/write.ts`(D4) | `sessionRejected(): Error`, `isSessionRejected(error: unknown): boolean`, `WriteSession { accessExpiresAt }`, `WriteDeps { getAccessToken; currentSession; now; send }`, 그리고 내보내지 않은 `async function accessToken(deps: WriteDeps): Promise<AccessToken>`(세션이 없으면 세션 거절을 던지고, 저장소가 실패하거나 받은 토큰의 세션이 이미 만료됐으면 `{ ok: false }` - Task 1 이 `export` 한다) |
| `platform/query-client.ts`(D4) | 쓰기 캐시 `MutationCache({ onError })` 가 `isSessionRejected` 면 `sessionManager.signOut()` - 주석에 "화면은 보호 경로라 지금 경로를 next 로 실어 로그인으로 보낸다. 조회 캐시(QueryCache)에는 두지" 한 줄 |
| `queries/submit-once.ts`(D4) | `useSubmitOnce(mutationKey: MutationKey): (submit: () => void) => void` |
| `components/app/navigate-once.ts`(D4) | `useNavigateOnce(): (navigate: () => void) => void` - 첫 부름이 잠그고 그 화면이 다시 앞에 오면 푼다 |
| `platform/session.ts`(D2·D4) | `sessionManager.getAccessToken`, `sessionManager.current: () => StoredSession \| null`(`accessExpiresAt` 를 갖는다 - `WriteSession` 에 맞는다) |
| `queries/writes.ts`·`test/unit/queries/writes.test.ts`(D4) | 쓰기 옵션이 `throwOnError` 로 세션 거절이 아닌 것만 오류 경계로 보내고 내보내진다 - 시험이 `MutationObserver`·`shouldThrowError`(`@tanstack/react-query` 5.104)로 돈다. Task 3 의 훅과 시험이 같은 모양이다 |
| `platform/api.ts`(D2, 그 뒤로 그대로) | blob `84b4d6c…` - `apiRequest` 가 `const tags = getLocales()…` 뒤에 `withAcceptLanguage(options, acceptLanguageFromLocales(tags))` |
| `test/unit/platform/api.test.ts`(D2) | `KO_EN`·`mocks.getLocales`·`sentOptions()`, 시험 "요청마다 기기 언어를 다시 읽는다" 의 끝 줄 `expect(sentOptions().map((options) => options?.acceptLanguage)).toEqual([KO_EN, 'en-GB'])` - 14개 |
| `lib/auth/protected-paths.ts`(D2·D4) | `loginHref(pathname: string): string` |
| 로그인 화면(D2·D4) | testID `login-screen`, 성공하면 `router.dismissTo(plan.to, { withAnchor: true })`, `useBackToHome()`(돌아갈 곳이 있으면 손대지 않는다) |
| `components/form/`(D2) | `SubmitButton({ testID, label, pending, onPress })`, `FormBanner({ messages })` |
| `components/ui/text.tsx` | `Text` 가 `variant`(`large` 등)·`className`·`style` 을 받는다 |
| 홈(`app/(app)/index.tsx`, D2 뒤로 그대로) | blob `538fbc4…` - `home-screen`, `import { Link, Stack } from 'expo-router'`, `Link href="/examples"` 안의 `Button testID="home-examples-link"` 와 `<Text>Example 목록</Text>` |
| `scripts/check.sh` | blob `45a57dc…` - 정적 단계 열하나 뒤 `[12/12] E2E` |
| `test/unit/scripts/check-citations.test.ts` | 주석 넷의 `[5/12]`(9·28·64·149 줄 부근) |
| `lib/config/AGENTS.md` | "게이트 [8/12]이 그것을 잡는다." |
| `docs/provenance/copied-core.json` | `note` 의 "(이 저장소의 게이트에서는 [5/12])" 와 끝 문장 "…view.ts 의 줄 번호도 원본 저장소의 것이다.", 인용 시험 이탈의 `what` 에 "이 저장소의 [5/12] 로 바꿨다." |
| E2E 하네스(D2–D4) | `test/e2e/run-android.sh`(플로 전부를 이름 순으로, 머리말 `# e2e-allow-http:`, access 수명 `E2E_ACCESS_EXPIRES_SECONDS` 기본 10 - D4 Task 5), `subflows/start-signed-out.yaml`·`submit-credentials.yaml`(testID `email-input`·`password-input`·`submit-button`), `scripts/examples-api.js` 의 `STEP=account`(D4 Task 5) |
| 문서의 자리 | `AGENTS.md`(표의 `lib/lab/` 행 "실험 정의, 결과 표현", "`platform/config.ts`가 한다." 로 끝나는 문단, "복사 출처 · unit · … · compose · E2E).", "`git ls-tree HEAD scripts/ test/e2e/`에서", "`test/e2e/guard-log.sh` 다섯이", "E2E 플로를 쓰는 규칙과 하네스의 환경 변수는 `test/e2e/AGENTS.md`에 있다.", "실측 기록은" 문단), `platform/AGENTS.md`(표의 `api.ts` 행, 인증 오류 문단, `## 검증` 절), `queries/AGENTS.md`(표의 `resources.ts` 행), `lib/resources/AGENTS.md`(`## 선언은 데이터다` 절), `test/e2e/AGENTS.md`(`## 돌리기` 절) |
| 스펙 | 제목 `### 8.7 로딩 표현`·`## 10. 설정·빌드·배포`·`### 11.3 E2E — Maestro`·`### 11.4 E2E 스택`·`## 13. CI (GitHub Actions)` 가 한 번씩 |
| 기준 수 | D4 의 마지막 커밋 `9cd1323` 에서 셌다: 단위 시험 1440(64 파일), 출처 기록 경로 48·이탈 37·원본 그대로 31, 플로 18. D4 가 끝날 때 수가 또 바뀌었으면 그 수에서 센다 - 이 계획은 시험 +85·파일 +4, 경로 +4·이탈 +3·원본 그대로 +1, 플로 +2 를 더한다 |

## D4 의 끝에서 다시 본 자리

D4 는 `9cd1323` 에서 끝났고 `main` 에 병합된다 - 병합 트리는 `9cd1323` 의 트리(`96ef5785…`)와 같다(`9106de5` 뒤로는 D4 실측 기록과 `examples-create`·`examples-write-errors` 플로의 주석만 바뀌었다 - 이 계획이 건드리지 않는 파일이다). 앞 판이 "병합 뒤 다시 볼 자리" 로 모았던 자리를 그 트리에서 다시 봤다 - 이 계획의 연산이 모두 정확히 한 번 맞았고 뜻도 그대로다. `main` 의 트리가 `9cd1323` 와 다르면(Task 1 Step 1) 이 표의 자리부터 본다.

| 이 계획의 자리 | `9cd1323` 에서 본 것 |
| --- | --- |
| Task 1 Step 4 - `write.ts` 의 `accessToken` 을 내보내는 Edit | 로그 줄이 `errorDetail`(`lib/auth/error-detail.ts`)로 바뀌었고 함수 이름·시그니처와 바로 위의 ` */` 는 그대로다 - Edit 가 맞는다. 저장소 실패의 로그는 그대로 한 줄이다(실행부 시험이 `console.error` 한 번을 잰다) |
| Task 1 Step 6·Task 2 Step 6 - 출처 기록 스크립트 둘 | `note` 의 끝 문장과 `[5/12]` 두 곳이 그대로다. 바탕 48·37·31(D4 가 `docker-compose.e2e.yml`·`view.ts` 의 이탈을 더했다) → 52·40·32 |
| Task 2 Step 4 - `run.sh` 의 `E2E_ACCESS_EXPIRES_SECONDS=900` 과 그 주석 | 하네스가 그 변수를 기본 10 으로 내보내고(`run-android.sh`) compose 가 세 백엔드에 `${E2E_ACCESS_EXPIRES_SECONDS:-900}` 으로 넘긴다 - 주석이 맞다 |
| Task 3 Step 6 - 홈의 Edit 넷 | 홈 blob `538fbc4…` 그대로 - D4 는 홈을 바꾸지 않았다(목록 진입은 `Link`) |
| Task 3 Step 6 - `query-client.ts` 주석, Step 9 - `platform/AGENTS.md` 인증 오류 문단 | 로그 줄만 `errorDetail` 로 바뀌었고 Edit 가 찾는 두 줄은 그대로다 |
| Task 3 Step 9 - `queries/AGENTS.md` 의 행 | 표가 다시 맞춰졌고 `writes.ts` 행이 `resetUnlessPending` 을 적는다 - Edit 는 `resources.ts` 행 이름만 보고 `pnpm format` 이 칸을 맞춘다 |
| Task 1 Step 7·Task 2 Step 7·Task 3 Step 9·Task 4 Step 2 - 루트 `AGENTS.md` | 계층 표가 다시 맞춰졌고(`components/app/` 이 이동 도우미 `useNavigateOnce`·`useBackToHome` 을 적는다) 실측 기록 문단에 D4 의 문장이 들어왔다 - Edit 일곱과 문단 끝 덧붙이기가 맞고, D5 의 문장은 D4 의 것 뒤에 붙는다 |
| Task 4 Step 1 - `contract-lab-signed-in` 의 `runScript` | `examples-api.js` 의 `STEP=account` 는 가입만 하고 `output.prefix` 를 남긴다 - D4 의 쓰기 플로와 같은 모양이다 |
| Task 4 Step 2 - `test/e2e/AGENTS.md` 의 `## 돌리기` 앞 | D4 의 `## 쓰기 플로` 절 뒤, `## 돌리기` 앞에 붙는다 |
| 스펙의 끼울 자리 다섯과 Task 4 의 11.2 Edit | D4 가 8.5·9.3 에 정정을 더하고 11.3 의 정정을 두 번 늘렸다 - 다섯 제목이 한 번씩이고 D5 의 정정은 각 절의 끝, D4 의 것 뒤에 붙는다 |
| 수 | 플로 18 → 20, 단위 1440(64 파일) → 1521(67)·1525(68), 출처 48·37·31 → 52·40·32 |

## D2·D3·D4 에서 이어받은 것

| 항목(출처) | 맡은 곳 |
| --- | --- |
| `apiRequest` 가 호출자가 준 `acceptLanguage` 를 덮는다 - 존중할지 덮을지 정하고 `api.test.ts` 에 고정(D2 운반 M8) | Task 1 - 존중한다, 시험 두 행(결정 6), 스펙 9.4 정정 |
| 계약 거울을 E2E 앞에 더하며 게이트를 `[N/13]` 으로 - `scripts/check.sh`, 인용 시험의 주석 넷, `lib/config/AGENTS.md`, 출처 기록의 `note` 와 인용 시험 이탈의 `what`(D2 운반·D2 결정 13·D3·D4 다음 계획) | Task 2 |
| 실험실의 PUT upsert·관계 쓰기는 `write.ts` 의 흐름(주입받은 전송·토큰, 세션 거절)을 쓴다 - 실험실이 공개 경로면 `onError` 가 직접 `loginHref` 로(D4 다음 계획) | Task 1 `run.ts` 가 `write.ts` 의 `accessToken`(만료 가드까지)을 부른다(결정 3·5·26), Task 3 화면의 호출별 `onError` |
| 새 쓰기 훅은 `throwOnError: (error) => !isSessionRejected(error)`(D4 `538b84b` 의 `queries/AGENTS.md`) | Task 3 `queries/lab.ts` 와 그 시험(결정 27) |
| 화면을 쌓는 이동은 `useNavigateOnce`, 화면의 조회 훅은 `subscribed: useIsFocused()`(D4 결정 35, D4 다음 계획) | Task 3 - 홈의 실험실 진입과 실험실의 로그인 이동(결정 5·20). 실험실에는 조회 훅이 없다(결정 22) |
| 거울의 토큰은 E2E 하네스 밖에서 스택을 띄우면 900초다(D4 다음 계획) | Task 2 `run.sh` 가 900 을 못박는다(결정 15) |
| `lib/lab/` 를 복사(D1 계획 "D5: lib/lab/") | Task 1(결정 2) |
| `test/unit/resources/mirror.test.ts` 는 프로브의 구조만 고정한다 - HTTP 거울은 D5(`lib/resources/AGENTS.md`) | Task 2 `test/contract/`, 그 문단을 고친다 |

## 태스크 지도

| 태스크 | 산출 | 시험 | 기기 |
| --- | --- | --- | --- |
| 1 실험실 판단 | `lib/lab/experiments.ts`·`result.ts`(복사)·`run.ts`, 시험 셋, `write.ts` 의 `accessToken` 내보내기, `platform/api.ts` 의 호출자 언어와 `deviceAcceptLanguage`, 출처 기록, `lib/lab/AGENTS.md`, 스펙 9.4 정정 | 복사 시험 21·26, 실행부 32, API 클라이언트 +2 | 없음 |
| 2 계약 거울과 게이트 | `test/contract/`(`run.sh`·`mirror.test.ts`·`backend.ts`·`AGENTS.md`), `vitest.contract.config.mjs`, `test:contract`, `scripts/check.sh` 13단계, 번호를 옮길 자리, 스펙 11.2·12 정정 | 거울 89(스택이 없으면 전부 실패 - 여기서는 그것을 본다) | 없음 |
| 3 실험실 화면 | `queries/lab.ts`(+ 시험), `components/lab/experiment-card.tsx`, `app/(lab)/contract.tsx`, 홈 진입, 문서, 스펙 8.6 정정 | 훅의 옵션 4 + 정적 검사 + 두 플랫폼 번들 | 없음 |
| 4 기기 | 플로 둘, `test/e2e/AGENTS.md` 절, 드리프트 실증(변이 둘 → 두 시험이 죽는다), 게이트 13단계, 기록 C1–C3, 스펙 11.2·11.3 정정 | 거울 89, 기기 E2E 20 플로 | **여기서만** |

## File Structure

```text
lib/lab/experiments.ts                     (복사·패치) 여섯 실험의 데이터 - 커서 순회 → offset 순회              — Task 1
lib/lab/result.ts                          (복사, 원본 그대로) 원본 응답 → 결과, 단계의 결합과 파싱              — Task 1
lib/lab/run.ts                             (신규) 실험 하나를 요청으로 - 쓰기의 의존성과 기기 언어를 주입받는다     — Task 1
lib/lab/AGENTS.md                          (신규)                                                                 — Task 1
test/unit/lab/experiments.test.ts · result.test.ts (복사·패치) import 경로, offsetWalk                          — Task 1
test/unit/lab/run.test.ts                  (신규) 실험마다의 요청·결과·세션 가드·만료 가드·offset 순회             — Task 1
lib/resources/write.ts                     (수정) accessToken 을 내보낸다 - 실험실이 같은 길로 토큰을 받는다       — Task 1
platform/api.ts                            (수정) 호출자의 언어를 덮지 않는다, deviceAcceptLanguage              — Task 1
test/unit/platform/api.test.ts             (수정) 두 행                                                          — Task 1
test/contract/run.sh                       (신규, 100755) 스택을 띄우고 거울을 돈다                                — Task 2
test/contract/mirror.test.ts · backend.ts · AGENTS.md (신규) 검사 넷, fetch 도우미                             — Task 2
vitest.contract.config.mjs                 (신규) 거울의 vitest 설정                                             — Task 2
package.json                               (수정) test:contract                                                  — Task 2
scripts/check.sh                           (다시 씀) 13단계 - [12/13] 계약 거울                                   — Task 2
test/unit/scripts/check-citations.test.ts · lib/config/AGENTS.md (수정) 게이트 번호                              — Task 2
queries/lab.ts                             (신규) 실험 하나의 쓰기 훅과 그 옵션                                   — Task 3
test/unit/queries/lab.test.ts              (신규) 훅의 옵션 - 결함·세션 거절의 갈래와 배선                        — Task 3
components/lab/experiment-card.tsx         (신규) 실험 카드와 결과                                                 — Task 3
app/(lab)/contract.tsx                     (신규) 계약 실험실 화면                                                 — Task 3
app/(app)/index.tsx                        (수정) 홈의 실험실 진입                                                — Task 3
platform/query-client.ts                   (수정) 주석 - 실험실의 세션 거절                                       — Task 3
test/e2e/flows/contract-lab-anonymous.yaml · contract-lab-signed-in.yaml (신규)                                  — Task 4
docs/superpowers/notes/2026-10-01-d5-measurements.md (신규) C1–C3                                                 — Task 4
docs/provenance/copied-core.json           (수정) Task 1·2
AGENTS.md · platform/AGENTS.md · queries/AGENTS.md · lib/resources/AGENTS.md · test/e2e/AGENTS.md (수정)
docs/superpowers/specs/2026-09-30-expo-jsonapi-template-design.md (정정) 9.4(Task 1), 11.2·12(Task 2), 8.6(Task 3), 11.3(Task 4)
```

---

### Task 1: 실험실 판단 — `lib/lab/` 복사·패치, 실행부 `run.ts`, API 클라이언트의 호출자 언어

**Files:**
- Create(복사): `lib/lab/experiments.ts`(패치)·`lib/lab/result.ts`(원본 그대로), `test/unit/lab/experiments.test.ts`·`test/unit/lab/result.test.ts`(패치)
- Create: `lib/lab/run.ts`, `test/unit/lab/run.test.ts`, `lib/lab/AGENTS.md`
- Modify: `lib/resources/write.ts`(`accessToken` 을 내보낸다), `platform/api.ts`, `test/unit/platform/api.test.ts`, `docs/provenance/copied-core.json`, `platform/AGENTS.md`, `AGENTS.md`, 스펙(9.4 정정)

**Interfaces:**
- Consumes: `JsonApiSend`(`lib/jsonapi/send.ts`), `withAcceptLanguage`·`JsonApiResult`·`RequestOptions`(`lib/jsonapi/client.ts`), `actionForErrors`(`lib/jsonapi/errors.ts`), `buildQuery`·`linkQuery`(`lib/jsonapi/query.ts`), `EXAMPLE`·`EXAMPLE_TAG`(`lib/resources`), `resourcePath`(`lib/resources/define.ts`), D4 의 `lib/resources/write.ts` - `sessionRejected()`·`isSessionRejected()`·`WriteDeps`(`getAccessToken`·`currentSession`·`now`·`send`)·`WriteSession`, 그리고 이 태스크가 내보내는 `accessToken(deps: WriteDeps): Promise<{ ok: true; token: string } | { ok: false }>`(세션이 없으면 세션 거절을 던진다 - 저장소 실패·만료 가드는 `ok: false`), `acceptLanguageFromLocales`(`lib/jsonapi/accept-language.ts`).
- Produces:
  - `lib/lab/experiments.ts`: `interface Experiment { readonly id: string; readonly title: string; readonly proves: string; readonly needsSession: boolean }`, `EXPERIMENTS: readonly Experiment[]` - id 는 `putUpsert`·`relationshipWrite`·`offsetWalk`·`pageTotals`·`acceptLanguage`·`invalidFilter`.
  - `lib/lab/result.ts`(원본 그대로): `ExperimentResult { request: { method; path; body? }; status: number; headers: Record<string, string>; body: string }`, `RawStep`, `requestHeaders`, `displayPath`, `bodyText`, `singleStepResult`, `stepHeading`, `combinedStepsResult(steps, summaryPath, note?)`, `parseCombinedSteps(body): { steps: { heading; body }[]; note: string | undefined }`, `COMBINED_NOTE_PREFIX`.
  - `lib/lab/run.ts`: `interface LabDeps extends WriteDeps { deviceLanguage: () => string | null }`, `type LabOutcome = { kind: 'result'; result: ExperimentResult } | { kind: 'unusable' }`, `runExperiment(id: string, deps: LabDeps): Promise<LabOutcome>`(세션이 없거나 백엔드가 세션을 거절하면 `sessionRejected()` 를 던진다. 받은 토큰을 쓸 수 없으면 - 만료 가드·저장소 실패 - 요청 없이 `unusable`), `PROBE_LAB_EXAMPLE_ID`, `MAX_OFFSET_REQUESTS`(20), `OFFSET_PAGE_SIZE`(3), `TOTALS_PAGE_SIZE`(1).
  - `platform/api.ts`: `deviceAcceptLanguage(): string | null`, `apiRequest` 가 `options.acceptLanguage` 를 덮지 않는다.

- [ ] **Step 1: 브랜치와 전제를 확인한다**

```bash
git branch --show-current
git rev-parse 'HEAD^{tree}'
git status --short
for f in lib/resources/write.ts platform/query-client.ts queries/submit-once.ts components/app/navigate-once.ts lib/auth/protected-paths.ts components/form/submit-button.tsx components/form/form-banner.tsx lib/resources/mirror.ts test/e2e/scripts/examples-api.js test/e2e/subflows/start-signed-out.yaml test/e2e/subflows/submit-credentials.yaml; do [ -f "$f" ] && echo "ok $f" || echo "MISSING $f"; done
grep -c "export function sessionRejected\|export function isSessionRejected" lib/resources/write.ts
grep -c "^async function accessToken(deps: WriteDeps): Promise<AccessToken> {" lib/resources/write.ts
grep -c "readonly currentSession: () => WriteSession | null\|readonly now: () => number" lib/resources/write.ts
grep -c "export function useNavigateOnce" components/app/navigate-once.ts
grep -c "isSessionRejected(error)" platform/query-client.ts
grep -c "export function useSubmitOnce" queries/submit-once.ts
grep -c "export function loginHref" lib/auth/protected-paths.ts
grep -c "STEP === 'account'" test/e2e/scripts/examples-api.js
git hash-object platform/api.ts scripts/check.sh 'app/(app)/index.tsx'
grep -c "\[12/12\] E2E" scripts/check.sh
ls lib/lab test/contract 2>/dev/null | wc -l
ls test/e2e/flows | wc -l
node scripts/check-provenance.mjs
pnpm test 2>&1 | grep -E "Test Files|Tests "
```

Expected: `feat/d5-contract-lab`, 트리 `96ef578532a3ac106ab55ce6ebc3f1690b24ddbc`(D4 의 마지막 커밋 `9cd1323` 의 트리 - D4 를 병합한 `main` 이 그대로다), 작업 트리가 깨끗하다, `ok …` 열한 줄(`MISSING` 없음), 수 `2`·`1`·`2`·`1`·`1`·`1`·`1`·`1`(write.ts 의 두 export, 내보내지 않은 `accessToken`, `WriteDeps` 의 `currentSession`·`now`, 그 아래로 차례대로), blob 셋이 `84b4d6c800d073324fdf5ee3a6de729b9618744a`(api.ts)·`45a57dcff11774e1a1f9235302eaf7e71fb9ec53`(check.sh)·`538fbc428981d68a694ef8959c8e1fe394de75f9`(홈), `[12/12] E2E` `1`, `lib/lab`·`test/contract` 없음 `0`, 플로 `18`, 출처 `경로 48개, 이탈 37건, 원본 그대로 31개`, 시험 `64 passed`·`1440 passed`. 트리가 다르면 D4 병합 뒤에 다른 것이 들어온 것이다 - `git log --oneline 9cd1323..HEAD` 로 보고, 그것이 건드린 파일이 "D4 의 끝에서 다시 본 자리" 표의 자리와 겹치면 그 Edit 가 맞는 자리를 찾아 고친다(결정 23). blob 이 다르면 그 파일이 바뀐 것이다 - `git log --oneline -3 -- <파일>` 로 무엇이 바뀌었는지 본다. 수가 다르면 적어 두고 뒤의 기대값을 그만큼 옮긴다 - 이 계획은 단위 시험 +81(Task 1)·+4(Task 3), 출처 경로 +4·이탈 +3·원본 그대로 +1, 플로 +2 를 더한다. 파일이 없으면 멈추고 컨트롤러에 알린다.

- [ ] **Step 2: 시험을 먼저 쓴다 - 원본 시험 둘을 옮겨 오고, 실행부와 API 클라이언트의 시험을 쓴다**

원본 시험 둘을 옮겨 온다:

```bash
N=../template-typescript-nextjs
R=34d0b1057d65693645e75bec4e9558dcf6838822
mkdir -p test/unit/lab
git -C "$N" show "$R:test/unit/app/contract-experiments.test.ts" > test/unit/lab/experiments.test.ts
git -C "$N" show "$R:test/unit/app/contract-result.test.ts" > test/unit/lab/result.test.ts
git hash-object test/unit/lab/experiments.test.ts test/unit/lab/result.test.ts
```

Expected: `a4af27d0eaacbbbad9f50e8255333095bbe7e52e`, `91376c4cfe1fbb4acc0d7b4bbbbc019d276277ef`(원본 blob 그대로).

`test/unit/lab/experiments.test.ts` — Edit, 찾을 것 `import { EXPERIMENTS, type Experiment } from '@/app/(lab)/contract/experiments'` — 바꿀 것 `import { EXPERIMENTS, type Experiment } from '@/lib/lab/experiments'`

같은 파일에 Edit, 찾을 것 `cursorWalk: false,` — 바꿀 것 `offsetWalk: false,`

`test/unit/lab/result.test.ts` — Edit, 찾을 것:

```ts
} from '@/app/(lab)/contract/result'

/**
 * 계약 실험실의 **순수 판단 다섯** - `app/(lab)/contract/result.ts`.
```

바꿀 것:

```ts
} from '@/lib/lab/result'

/**
 * 계약 실험실의 **순수 판단 다섯** - `lib/lab/result.ts`.
```

`test/unit/lab/run.test.ts` 를 만든다:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { JsonApiResult, RequestOptions } from '@/lib/jsonapi/client'
import type { ErrorObject } from '@/lib/jsonapi/document'
import type { JsonApiSend } from '@/lib/jsonapi/send'
import { EXPERIMENTS } from '@/lib/lab/experiments'
import { COMBINED_NOTE_PREFIX, parseCombinedSteps, type ExperimentResult } from '@/lib/lab/result'
import {
  MAX_OFFSET_REQUESTS,
  OFFSET_PAGE_SIZE,
  PROBE_LAB_EXAMPLE_ID,
  TOTALS_PAGE_SIZE,
  runExperiment,
  type LabDeps,
} from '@/lib/lab/run'
import { EXAMPLE, EXAMPLE_TAG } from '@/lib/resources'
import { isSessionRejected, type WriteSession } from '@/lib/resources/write'

/**
 * 계약 실험실의 실행부(lib/lab/run.ts) - 실험마다 무엇을 보내고, 응답을 어떻게 결과로 옮기고, 세션을 어떻게
 * 다루는가(스펙 8.6·7.3·9.2).
 *
 * 전송·토큰·지금의 세션·시계·기기 언어는 가짜를 주입한다 - 토큰과 언어는 실전과 다른 값이다. 경로와 본문은
 * 실험이 실제로 부르는 자원(`EXAMPLE`·`EXAMPLE_TAG`)의 것이다 - 실험실은 그 자원에 묶여 있다(스펙 8.6). 토큰을
 * 받는 길(세션 가드·만료 가드·저장소 실패)은 쓰기의 것이라(`lib/resources/write.ts` 의 `accessToken`) 판정의
 * 갈래는 `test/unit/resources/write.test.ts` 가 재고, 여기서는 세션이 필요한 실험이 모두 그 길을 지나는지 잰다.
 */
const TOKEN = 'probe-access-token'
const DEVICE_LANGUAGE = 'probe-lang,probe-other;q=0.9'
const RELATIONSHIPS_PATH = `${EXAMPLE.path}/${PROBE_LAB_EXAMPLE_ID}/relationships/tags`

/** 가짜 시계가 서 있는 시각 - 세션의 access 만료는 이 시각을 기준으로 잡는다. */
const NOW = 1_800_000_000_000
const LIVE_SESSION: WriteSession = { accessExpiresAt: NOW + 60_000 }
/** 회전이 판정을 받지 못해 세션 관리자가 지금의 access 를 그대로 돌려준 세션 - 이미 만료됐다(스펙 7.2). */
const EXPIRED_SESSION: WriteSession = { accessExpiresAt: NOW - 1 }

const SESSION_IDS = EXPERIMENTS.filter((e) => e.needsSession).map((e) => e.id)
const SESSIONLESS_IDS = EXPERIMENTS.filter((e) => !e.needsSession).map((e) => e.id)

type Respond = (path: string, options: RequestOptions) => JsonApiResult<unknown>

interface SentRequest {
  readonly path: string
  readonly options: RequestOptions
}

interface ProbeOptions {
  /** 세션 관리자의 `getAccessToken` - 기본은 늘 `TOKEN` 이다. */
  readonly token?: () => Promise<string | null>
  /** 기기 언어 - 기본은 `DEVICE_LANGUAGE`, `null` 이면 쓸 태그가 없다. */
  readonly language?: string | null
  /** 세션 관리자의 `current` - 기본은 아직 만료되지 않은 세션이다. */
  readonly session?: WriteSession | null
}

/** 보낸 요청을 적고 `respond` 가 정한 결과를 돌려주는 가짜 의존성. */
function probeDeps(respond: Respond, options: ProbeOptions = {}) {
  const sent: SentRequest[] = []
  let tokenCalls = 0
  const token = options.token ?? (() => Promise.resolve(TOKEN))
  const language = options.language === undefined ? DEVICE_LANGUAGE : options.language
  const session = options.session === undefined ? LIVE_SESSION : options.session
  const send: JsonApiSend = <T>(path: string, requestOptions: RequestOptions = {}) => {
    sent.push({ path, options: requestOptions })
    return Promise.resolve(respond(path, requestOptions)) as Promise<JsonApiResult<T>>
  }
  const deps: LabDeps = {
    send,
    getAccessToken: () => {
      tokenCalls += 1
      return token()
    },
    currentSession: () => session,
    now: () => NOW,
    deviceLanguage: () => language,
  }
  return { deps, sent, tokenCalls: () => tokenCalls }
}

/** 응답으로 끝난 실험의 결과 - `unusable` 로 끝났으면 시험이 실패한다. */
async function resultOf(id: string, deps: LabDeps): Promise<ExperimentResult> {
  const outcome = await runExperiment(id, deps)
  if (outcome.kind !== 'result') throw new Error(`${id} 가 결과 없이 ${outcome.kind} 로 끝났다`)
  return outcome.result
}

function ok(status: number, document: unknown = { data: null }): JsonApiResult<unknown> {
  return { ok: true, status, document }
}

const NO_CONTENT: JsonApiResult<unknown> = { ok: true, status: 204, document: null }

function failure(status: number, code: string): JsonApiResult<unknown> {
  const error: ErrorObject = { status: String(status), code, title: 'probe-title', detail: 'probe' }
  return { ok: false, status, errors: [error] }
}

/** 컬렉션 한 쪽 - `next` 가 `undefined` 면 links 에 키가 없다(NestJS 의 모양). */
function page(ids: readonly string[], next?: string | null): JsonApiResult<unknown> {
  const data = ids.map((id) => ({ type: 'probeRows', id }))
  if (next === undefined) return ok(200, { data, links: {} })
  return ok(200, { data, links: { next } })
}

/** 어떤 요청에도 성공하는 백엔드 - 세션 가드만 재는 시험이 쓴다. */
const ANYTHING_OK: Respond = (_path, options) => {
  if (options.method === 'DELETE' || options.method === 'POST') return NO_CONTENT
  if (options.method === 'PUT') return ok(201)
  return page(['probe-row-1'], null)
}

function queryOf(request: SentRequest | undefined): Record<string, string> {
  return Object.fromEntries(request?.options.query ?? new URLSearchParams())
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('runExperiment - 세션 가드(스펙 7.3)', () => {
  it.each(SESSION_IDS)('%s 는 세션이 없으면 요청하지 않고 세션 거절을 던진다', async (id) => {
    const { deps, sent } = probeDeps(ANYTHING_OK, { token: () => Promise.resolve(null) })

    const outcome = runExperiment(id, deps)

    await expect(outcome).rejects.toSatisfy(isSessionRejected)
    expect(sent).toEqual([])
  })

  it.each(SESSION_IDS)(
    '%s 는 받은 토큰의 세션이 이미 만료됐으면 요청하지 않고 unusable 로 끝난다 - 세션 거절이 아니다(만료 가드)',
    async (id) => {
      const { deps, sent, tokenCalls } = probeDeps(ANYTHING_OK, { session: EXPIRED_SESSION })

      expect(await runExperiment(id, deps)).toEqual({ kind: 'unusable' })
      expect(tokenCalls()).toBe(1)
      expect(sent).toEqual([])
    },
  )

  it.each(SESSIONLESS_IDS)(
    '%s 는 세션 없이 돈다 - 토큰을 묻지 않고 싣지 않으며 세션의 만료를 보지 않는다',
    async (id) => {
      const { deps, sent, tokenCalls } = probeDeps(ANYTHING_OK, {
        token: () => Promise.resolve(null),
        session: EXPIRED_SESSION,
      })

      expect((await runExperiment(id, deps)).kind).toBe('result')
      expect(tokenCalls()).toBe(0)
      expect(sent.length).toBeGreaterThan(0)
      for (const request of sent) expect(request.options).not.toHaveProperty('accessToken')
    },
  )

  it('토큰을 받다 저장소가 실패하면 요청하지 않고 unusable 로 끝난다 - 던지지 않고 오류는 기기 로그에 남는다', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { deps, sent } = probeDeps(ANYTHING_OK, {
      token: () => Promise.reject(new Error('probe-storage-failure')),
    })

    expect(await runExperiment('putUpsert', deps)).toEqual({ kind: 'unusable' })
    expect(sent).toEqual([])
    expect(logged).toHaveBeenCalledTimes(1)
  })

  it('세션이 필요한 실험은 토큰을 한 번만 받는다 - 회전은 세션 관리자 안에서 한 번이다', async () => {
    const { deps, tokenCalls } = probeDeps(ANYTHING_OK)

    await runExperiment('relationshipWrite', deps)

    expect(tokenCalls()).toBe(1)
  })
})

describe('putUpsert', () => {
  it('고정 id 로 PUT 하고 원본 응답을 그대로 결과로 옮긴다 - 토큰 원문은 결과에 없다', async () => {
    const document = { data: { type: 'examples', id: PROBE_LAB_EXAMPLE_ID, probeDial: 7 } }
    const { deps, sent } = probeDeps(() => ok(201, document))

    const result = await resultOf('putUpsert', deps)

    expect(sent).toHaveLength(1)
    expect(sent[0]?.path).toBe(`${EXAMPLE.path}/${PROBE_LAB_EXAMPLE_ID}`)
    expect(sent[0]?.options).toMatchObject({
      method: 'PUT',
      accessToken: TOKEN,
      acceptLanguage: DEVICE_LANGUAGE,
      body: { data: { type: EXAMPLE.type, id: PROBE_LAB_EXAMPLE_ID } },
    })
    expect(result.status).toBe(201)
    expect(JSON.parse(result.body)).toEqual(document)
    expect(result.request.method).toBe('PUT')
    expect(result.headers).toMatchObject({
      authorization: 'Bearer <redacted>',
      'accept-language': DEVICE_LANGUAGE,
    })
    expect(JSON.stringify(result)).not.toContain(TOKEN)
  })

  it.each(['AUTHENTICATION_REQUIRED', 'INVALID_TOKEN', 'TOKEN_EXPIRED', 'TOKEN_REVOKED'])(
    '백엔드가 세션을 거절하면(%s) 세션 거절을 던진다',
    async (code) => {
      const { deps } = probeDeps(() => failure(401, code))

      await expect(runExperiment('putUpsert', deps)).rejects.toSatisfy(isSessionRejected)
    },
  )

  it('세션 밖의 실패는 던지지 않고 그대로 보인다', async () => {
    const { deps } = probeDeps(() => failure(422, 'VALIDATION_ERROR'))

    const result = await resultOf('putUpsert', deps)

    expect(result.status).toBe(422)
    expect(JSON.parse(result.body)).toEqual({
      errors: [expect.objectContaining({ code: 'VALIDATION_ERROR' })],
    })
  })
})

describe('relationshipWrite', () => {
  const TAG_ID = 'probe-tag-1'
  const tagsThenNoContent: Respond = (path) =>
    path === EXAMPLE_TAG.path
      ? ok(200, { data: [{ type: EXAMPLE_TAG.type, id: TAG_ID }] })
      : NO_CONTENT

  it('태그 하나를 토큰 없이 찾고, 그 태그를 붙였다 뗀다 - 세 단계가 결과에 다 보인다', async () => {
    const { deps, sent } = probeDeps(tagsThenNoContent)

    const result = await resultOf('relationshipWrite', deps)

    expect(sent.map((request) => [request.options.method ?? 'GET', request.path])).toEqual([
      ['GET', EXAMPLE_TAG.path],
      ['POST', RELATIONSHIPS_PATH],
      ['DELETE', RELATIONSHIPS_PATH],
    ])
    expect(queryOf(sent[0])).toEqual({ 'page[size]': '1' })
    expect(sent[0]?.options).not.toHaveProperty('accessToken')
    const linkage = { data: [{ type: EXAMPLE_TAG.type, id: TAG_ID }] }
    expect(sent[1]?.options).toMatchObject({ body: linkage, accessToken: TOKEN })
    expect(sent[2]?.options).toMatchObject({ body: linkage, accessToken: TOKEN })

    const { steps } = parseCombinedSteps(result.body)
    expect(steps).toHaveLength(3)
    expect(steps[1]?.heading).toContain('(상태 204)')
    expect(steps[2]?.heading).toContain('(상태 204)')
    expect(result.request).toEqual({ method: 'GET + POST + DELETE', path: RELATIONSHIPS_PATH })
    expect(result.headers.authorization).toBe('Bearer <redacted>')
  })

  it('태그가 하나도 없으면 조회 한 단계와 그 사실만 보이고 쓰지 않는다', async () => {
    const { deps, sent } = probeDeps(() => ok(200, { data: [] }))

    const result = await resultOf('relationshipWrite', deps)

    expect(sent).toHaveLength(1)
    const { steps, note } = parseCombinedSteps(result.body)
    expect(steps).toHaveLength(1)
    expect(note).toContain('태그가 하나도 없어')
  })

  it('조회가 실패하면 그 한 단계만 보이고 쓰지 않는다', async () => {
    const { deps, sent } = probeDeps(() => failure(0, 'PROBE_UNREACHABLE'))

    const result = await resultOf('relationshipWrite', deps)

    expect(sent).toHaveLength(1)
    expect(parseCombinedSteps(result.body).steps).toHaveLength(1)
    expect(result.status).toBe(0)
  })

  it('추가가 세션 거절을 받으면 던지고 제거를 보내지 않는다', async () => {
    const { deps, sent } = probeDeps((path, options) =>
      options.method === 'POST' ? failure(401, 'TOKEN_REVOKED') : tagsThenNoContent(path, options),
    )

    await expect(runExperiment('relationshipWrite', deps)).rejects.toSatisfy(isSessionRejected)
    expect(sent.map((request) => request.options.method ?? 'GET')).toEqual(['GET', 'POST'])
  })
})

describe('offsetWalk - page[number]=1 에서 links.next 만 따라간다(스펙 8.6)', () => {
  it('첫 요청은 1쪽이고, 다음은 백엔드가 준 링크의 쿼리 그대로다 - 링크가 없으면 끝이다', async () => {
    const next = `${EXAMPLE.path}?probe=kept&page%5Bnumber%5D=2&page%5Bsize%5D=${OFFSET_PAGE_SIZE}`
    const { deps, sent } = probeDeps((_path, options) =>
      options.query?.get('page[number]') === '1'
        ? page(['probe-row-1', 'probe-row-2', 'probe-row-3'], next)
        : page(['probe-row-4'], null),
    )

    const result = await resultOf('offsetWalk', deps)

    expect(sent).toHaveLength(2)
    expect(sent.every((request) => request.path === EXAMPLE.path)).toBe(true)
    expect(queryOf(sent[0])).toEqual({
      'page[number]': '1',
      'page[size]': String(OFFSET_PAGE_SIZE),
    })
    expect(queryOf(sent[1])).toEqual({
      probe: 'kept',
      'page[number]': '2',
      'page[size]': String(OFFSET_PAGE_SIZE),
    })
    const { steps, note } = parseCombinedSteps(result.body)
    expect(steps).toHaveLength(2)
    expect(note).toContain('컬렉션 끝에 닿았다')
    expect(note).toContain('총 2쪽')
    expect(result.body).toContain(`${COMBINED_NOTE_PREFIX}links.next가`)
  })

  it('links 에 next 키가 없어도 끝이다(NestJS 는 없는 링크의 키를 지운다)', async () => {
    const { deps, sent } = probeDeps(() => page(['probe-row-1']))

    const result = await resultOf('offsetWalk', deps)

    expect(sent).toHaveLength(1)
    expect(parseCombinedSteps(result.body).note).toContain('컬렉션 끝에 닿았다')
  })

  it(`링크가 끝나지 않으면 ${MAX_OFFSET_REQUESTS}회에서 멈추고 그 사실을 적는다`, async () => {
    const { deps, sent } = probeDeps(() => page([], `${EXAMPLE.path}?page%5Bnumber%5D=9`))

    const result = await resultOf('offsetWalk', deps)

    expect(sent).toHaveLength(MAX_OFFSET_REQUESTS)
    const { steps, note } = parseCombinedSteps(result.body)
    expect(steps).toHaveLength(MAX_OFFSET_REQUESTS)
    expect(note).toContain(`${MAX_OFFSET_REQUESTS}회 상한에 걸려 멈췄다`)
  })

  it('오류 응답을 받으면 그 쪽에서 멈추고 몇 번째였는지 적는다', async () => {
    const { deps, sent } = probeDeps((_path, options) =>
      options.query?.get('page[number]') === '1'
        ? page(['probe-row-1'], `${EXAMPLE.path}?page%5Bnumber%5D=2`)
        : failure(500, 'PROBE_BROKEN'),
    )

    const result = await resultOf('offsetWalk', deps)

    expect(sent).toHaveLength(2)
    expect(result.status).toBe(500)
    expect(parseCombinedSteps(result.body).note).toContain('2번째 요청에서 오류 응답')
  })

  it('읽을 수 없는 링크에서 멈춘다', async () => {
    const { deps, sent } = probeDeps(() => page(['probe-row-1'], 'http://['))

    const result = await resultOf('offsetWalk', deps)

    expect(sent).toHaveLength(1)
    expect(parseCombinedSteps(result.body).note).toContain('links.next를 읽을 수 없어')
  })
})

describe('pageTotals', () => {
  it('끈 요청과 켠 요청을 차례로 보낸다 - 켠 요청에만 page[totals]=true 가 있다', async () => {
    const { deps, sent } = probeDeps(() => page(['probe-row-1'], null))

    const result = await resultOf('pageTotals', deps)

    expect(sent.map(queryOf)).toEqual([
      { 'page[size]': String(TOTALS_PAGE_SIZE) },
      { 'page[size]': String(TOTALS_PAGE_SIZE), 'page[totals]': 'true' },
    ])
    expect(parseCombinedSteps(result.body).steps).toHaveLength(2)
  })
})

describe('acceptLanguage - 같은 검증 오류를 ko·en 으로(스펙 8.6)', () => {
  it('기기 언어가 아니라 ko 다음 en 을 명시해 같은 본문을 보낸다', async () => {
    const { deps, sent } = probeDeps(() => failure(422, 'VALIDATION_ERROR'))

    const result = await resultOf('acceptLanguage', deps)

    expect(sent.map((request) => request.options.acceptLanguage)).toEqual(['ko', 'en'])
    expect(sent.map((request) => request.options.method)).toEqual(['POST', 'POST'])
    expect(sent[0]?.options.body).toEqual(sent[1]?.options.body)
    expect(sent[0]?.options).toMatchObject({
      accessToken: TOKEN,
      body: { data: { type: EXAMPLE.type, attributes: { title: '' } } },
    })
    const { steps } = parseCombinedSteps(result.body)
    expect(steps.map((step) => step.heading)).toEqual([
      expect.stringContaining('(상태 422)'),
      expect.stringContaining('(상태 422)'),
    ])
    expect(result.headers['accept-language']).toBe('en')
  })

  it('첫 요청이 세션 거절을 받으면 던지고 둘째를 보내지 않는다', async () => {
    const { deps, sent } = probeDeps(() => failure(401, 'INVALID_TOKEN'))

    await expect(runExperiment('acceptLanguage', deps)).rejects.toSatisfy(isSessionRejected)
    expect(sent).toHaveLength(1)
  })
})

describe('invalidFilter', () => {
  it('정책에 없는 filter[title][gt] 로 한 번 부르고 원본 오류를 그대로 보인다', async () => {
    const { deps, sent } = probeDeps(() => failure(400, 'INVALID_FILTER'))

    const result = await resultOf('invalidFilter', deps)

    expect(sent).toHaveLength(1)
    expect(queryOf(sent[0])).toEqual({ 'filter[title][gt]': 'probe-lab' })
    expect(result.status).toBe(400)
    expect(result.request.path).toBe(`${EXAMPLE.path}?filter%5Btitle%5D%5Bgt%5D=probe-lab`)
    expect(result.body).toContain('INVALID_FILTER')
  })
})

describe('기기 언어', () => {
  it('기기 언어가 없으면 헤더를 싣지도 적지도 않는다', async () => {
    const { deps, sent } = probeDeps(() => failure(400, 'INVALID_FILTER'), { language: null })

    const result = await resultOf('invalidFilter', deps)

    expect(sent[0]?.options).not.toHaveProperty('acceptLanguage')
    expect(result.headers).not.toHaveProperty('accept-language')
  })
})

describe('모르는 실험', () => {
  it('모르는 실험 id 는 요청하지 않고 그 사실을 결과로 보인다', async () => {
    const { deps, sent } = probeDeps(ANYTHING_OK)

    const result = await resultOf('probeUnknown', deps)

    expect(sent).toEqual([])
    expect(result.body).toContain('알 수 없는 실험 id: probeUnknown')
  })
})
```

`test/unit/platform/api.test.ts` — Edit, 찾을 것 `import { apiRequest } from '@/platform/api'` — 바꿀 것 `import { apiRequest, deviceAcceptLanguage } from '@/platform/api'`

같은 파일에 Edit, 찾을 것:

```ts
    expect(sentOptions().map((options) => options?.acceptLanguage)).toEqual([KO_EN, 'en-GB'])
  })
```

바꿀 것:

```ts
    expect(sentOptions().map((options) => options?.acceptLanguage)).toEqual([KO_EN, 'en-GB'])
  })

  it('호출자가 언어를 정했으면 그 값을 싣는다 - 기기 언어로 덮지 않는다(계약 실험실의 언어 협상, 스펙 8.6)', async () => {
    await apiRequest('/api/v1/probe', { method: 'POST', acceptLanguage: 'probe-lang' })

    expect(sentOptions()).toEqual([{ method: 'POST', acceptLanguage: 'probe-lang' }])
  })

  it('deviceAcceptLanguage 는 apiRequest 가 싣는 기기 언어 값이다 - 쓸 태그가 없으면 null', async () => {
    await apiRequest('/api/v1/probe')

    expect(deviceAcceptLanguage()).toBe(KO_EN)
    expect(sentOptions()[0]?.acceptLanguage).toBe(deviceAcceptLanguage())
    mocks.getLocales.mockReturnValue([])
    expect(deviceAcceptLanguage()).toBeNull()
  })
```

- [ ] **Step 3: 시험이 실패하는지 본다**

```bash
pnpm exec vitest run test/unit/lab test/unit/platform/api.test.ts 2>&1 | grep -E "FAIL|Cannot find package|×|Test Files|Tests "
```

Expected: `test/unit/lab/` 의 세 파일이 `Error: Cannot find package '@/lib/lab/…'` 로 실패하고(`run.test.ts` 가 쓰는 `WriteSession` 은 D4 의 것이라 이미 있다), `api.test.ts` 는 새 두 행이 실패한다 - 하나는 보낸 언어가 `probe-lang` 이 아니라 기기 언어(`AssertionError`), 하나는 `TypeError: deviceAcceptLanguage is not a function`. `Test Files  4 failed (4)`, `Tests  2 failed | 14 passed (16)`.

- [ ] **Step 4: 원본 둘을 옮겨 오고 실행부와 API 클라이언트를 쓴다**

```bash
N=../template-typescript-nextjs
R=34d0b1057d65693645e75bec4e9558dcf6838822
mkdir -p lib/lab
git -C "$N" show "$R:app/(lab)/contract/experiments.ts" > lib/lab/experiments.ts
git -C "$N" show "$R:app/(lab)/contract/result.ts" > lib/lab/result.ts
git hash-object lib/lab/experiments.ts lib/lab/result.ts
```

Expected: `ffc364a165391a6a6a084fd41cc3af47f25ad017`, `8a389e226964326ab28b8816d07c8a6d4449cb15`. `result.ts` 는 이대로 둔다 - import 가 `@/lib/jsonapi/client` 하나라 이 저장소에서도 그대로 풀린다.

`lib/resources/write.ts` — Edit(실험실이 쓰기와 같은 길로 토큰을 받게 `accessToken` 을 내보낸다 - 결정 26. 함수 몸통과 위의 주석은 그대로다), 찾을 것:

```ts
 */
async function accessToken(deps: WriteDeps): Promise<AccessToken> {
```

바꿀 것:

```ts
 *
 * 계약 실험실의 세션이 필요한 실험도 이 길로 토큰을 받는다(lib/lab/run.ts) - 가드를 두 벌 두지 않는다.
 */
export async function accessToken(deps: WriteDeps): Promise<AccessToken> {
```

`lib/lab/experiments.ts` — Edit, 찾을 것:

```ts
    id: 'cursorWalk',
    title: '커서 순회',
    proves:
      'page[after]로 시작해 links.next만 따라가면 opaque 커서로 컬렉션 끝까지 순회할 수 있다 - 프론트는 커서 문자열을 만들지도 해석하지도 않는다.',
```

바꿀 것:

```ts
    id: 'offsetWalk',
    title: 'offset 순회',
    proves:
      'page[number]=1로 시작해 links.next만 따라가면 offset 페이지로 컬렉션 끝까지 순회할 수 있다 - 프론트는 다음 쪽 번호를 셈하지 않고 백엔드가 준 링크를 그대로 따른다. 한 번에 최대 20회이고, 상한에 걸리면 그 사실을 결과에 적는다.',
```

`lib/lab/run.ts` 를 만든다:

```ts
import { withAcceptLanguage, type JsonApiResult, type RequestOptions } from '@/lib/jsonapi/client'
import type { CollectionDocument, SingleDocument } from '@/lib/jsonapi/document'
import { actionForErrors } from '@/lib/jsonapi/errors'
import { buildQuery, linkQuery } from '@/lib/jsonapi/query'
import type { JsonApiSend } from '@/lib/jsonapi/send'
import { EXAMPLE, EXAMPLE_TAG } from '@/lib/resources'
import { resourcePath } from '@/lib/resources/define'
import { accessToken, sessionRejected, type WriteDeps } from '@/lib/resources/write'
import {
  bodyText,
  combinedStepsResult,
  displayPath,
  requestHeaders,
  singleStepResult,
  type ExperimentResult,
  type RawStep,
} from './result'

/**
 * 계약 실험실의 실행부 - 실험 하나를 실제 요청으로 돌려 원본 응답을 결과로 옮긴다(스펙 8.6).
 *
 * 원본(template-typescript-nextjs)에서는 Server Action(`app/(lab)/contract/actions.ts`)이 하던 일이다.
 * 이 앱에서 그 자리는 쓰기 훅(`queries/lab.ts`)인데 훅은 React 없이 부를 수 없어서, 실험마다의 요청과 갈래를
 * 여기 두고 가짜 전송·토큰으로 잰다(`test/unit/lab/run.test.ts`) - 쓰기 흐름(`lib/resources/write.ts`)과 같은
 * 모양이다. 무엇을 실증하는지는 `experiments.ts`, 응답을 결과로 옮기는 판단은 `result.ts`(둘 다 복사본)다.
 *
 * - **원본을 가공하지 않는다.** 응답의 상태·본문은 `result.ts` 의 `bodyText` 로만 옮긴다. 오류 분류
 *   (`actionForErrors`)를 쓰는 자리는 세션이 죽었을 때 로그인으로 보내는 한 곳뿐이다(`dieIfSessionDead`).
 * - 요청은 주입받은 전송(`send`)으로만 보낸다 - 앱에서는 `platform/api.ts` 의 `apiRequest` 다(스펙 9.4).
 * - 요청마다 기기 언어(`deviceLanguage`)를 명시해 싣고 "보낸 요청 헤더" 에도 그 값을 적는다 - API 클라이언트는
 *   호출자가 정한 언어를 덮지 않으므로(스펙 9.4 의 D5 정정) 화면에 적힌 헤더가 실제로 나간 헤더다. 언어 협상
 *   실험만 기기 언어 대신 `ko`·`en` 을 직접 정한다.
 * - 세션이 필요한 셋(`putUpsert`·`relationshipWrite`·`acceptLanguage`)은 요청 전에 쓰기와 같은 길로 토큰을
 *   받는다(`lib/resources/write.ts` 의 `accessToken` - 가드를 두 벌 두지 않는다). 세션이 없으면 요청하지 않고
 *   세션 거절을 던진다. 받은 토큰의 세션이 이미 만료됐거나(만료 가드 - 회전이 판정을 받지 못해 지금의 access 가
 *   그대로 돌아왔다, 스펙 7.2) 토큰을 받지 못했으면(회전한 세션을 저장소에 못 씀) 요청하지 않고 `unusable` 로
 *   끝난다 - 던지지 않으니 세션은 그대로이고, 화면이 앱 문구를 그리며 실행 버튼이 곧 다시 시도다. 만료된 토큰을
 *   실어 보내면 백엔드가 TOKEN_EXPIRED 를 내고 세션이 지워진다 - 회전의 502 하나가 실험 한 번 늦게 로그아웃이 된다.
 * - 백엔드가 세션을 거절해도(인증 오류 코드) 세션 거절을 던진다. 받는 쪽은 쓰기 캐시(`MutationCache`)의
 *   `onError`(기기 세션을 지운다 - `platform/query-client.ts`)와 실험실 화면(로그인으로 보낸다 - 실험실은 공개
 *   경로라 경로 가드가 보내지 않는다, 스펙 7.3).
 * - 그 셋은 `experiments.ts` 의 `needsSession` 을 읽지 않고 아래 분기에 적는다 - 원본과 같이 데이터 파일 하나의
 *   실수로 가드가 풀리지 않게 한다. 둘이 어긋나면 시험이 잡는다.
 * - 읽기는 토큰 없이 보낸다(스펙 7.2) - 관계 전용 쓰기의 태그 조회도 그렇다.
 * - 토큰은 실험마다 한 번 받는다(회전은 세션 관리자 안에서만 일어난다 - 스펙 7.2).
 */

/**
 * 이 실험실이 만드는 유일한 행. `putUpsert` 가 만들고(고정 UUID 라 여러 번 눌러도 행이 하나다 - 그 자체가
 * upsert 의 실증이다) `relationshipWrite` 가 같은 행에 태그를 붙였다 뗀다. 값은 원본과 같다.
 */
export const PROBE_LAB_EXAMPLE_ID = '55550000-0000-4000-8000-000000000001'

/**
 * `putUpsert` 의 PUT 본문 - 설명과 관계를 뺐다. PUT 은 전체 교체라 요청에 없는 필드를 지운다 - 이 실험이
 * 실증하는 것이 그 동작이다(원본과 같다).
 */
const PROBE_LAB_UPSERT_BODY = {
  data: {
    type: EXAMPLE.type,
    id: PROBE_LAB_EXAMPLE_ID,
    attributes: { title: 'probe-lab PUT upsert 대상', status: 'draft', score: 0 },
  },
} as const

/** `acceptLanguage` 가 보내는, 늘 422 인 본문 - 제목이 `minLength: 1` 을 어겨 행이 만들어지지 않는다. */
const PROBE_LAB_INVALID_BODY = {
  data: { type: EXAMPLE.type, attributes: { title: '', status: 'draft', score: 0 } },
} as const

/** offset 순회가 한 번에 낼 수 있는 최대 요청 수(스펙 8.6 - 원본의 커서 순회 상한과 같다). */
export const MAX_OFFSET_REQUESTS = 20

/** offset 순회의 쪽 크기 - 씨앗 여섯 건만으로도 두 쪽을 지난다(원본의 커서 순회와 같은 값). */
export const OFFSET_PAGE_SIZE = 3

/**
 * 페이지 총합의 쪽 크기. 켠 요청과 끈 요청의 차이(`meta.totalCount`)는 쪽 크기와 무관하다 - 한 건만 받아 폰
 * 화면에 두 본문을 나란히 담는다.
 */
export const TOTALS_PAGE_SIZE = 1

/**
 * 실행부가 주입받는 것 - 쓰기가 받는 것(전송·토큰·지금의 세션·시계 - `lib/resources/write.ts` 의 `WriteDeps`)에
 * 기기 언어를 더했다. 앱에서는 API 클라이언트·세션 관리자·기기 언어다(`queries/lab.ts`).
 */
export interface LabDeps extends WriteDeps {
  /** 기기 언어로 만든 `Accept-Language` 값. 쓸 태그가 없으면 `null` - 헤더를 싣지 않는다. */
  readonly deviceLanguage: () => string | null
}

/**
 * 실험 한 번이 끝난 모양. `result` 는 실제로 나간 요청과 원본 응답이다. `unusable` 은 요청을 보내지 않았다는
 * 뜻이다 - 받은 토큰의 세션이 이미 만료됐거나 토큰을 받지 못했다(이 파일 머리말). 화면이 앱 문구를 그린다.
 * 세션 거절은 여기 없다 - 던진다.
 */
export type LabOutcome =
  { readonly kind: 'result'; readonly result: ExperimentResult } | { readonly kind: 'unusable' }

/** 요청 하나를 보내고, 원본을 그대로 옮긴 조각(RawStep)으로 만든다. */
async function performCall<T>(
  send: JsonApiSend,
  label: string,
  path: string,
  options: RequestOptions,
): Promise<{ step: RawStep; result: JsonApiResult<T> }> {
  const result = await send<T>(path, options)
  const step: RawStep = {
    label,
    method: options.method ?? 'GET',
    path: displayPath(path, options.query),
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body, null, 2) }),
    status: result.status,
    headers: requestHeaders(
      options.body !== undefined,
      options.acceptLanguage,
      options.accessToken !== undefined,
    ),
    bodyText: bodyText(result),
  }
  return { step, result }
}

/**
 * 세션이 필요한 실험을 토큰 하나로 돌린다. 토큰은 쓰기와 같은 길로 받는다(`accessToken`) - 세션이 없으면 거기서
 * 세션 거절이 던져지고, 받은 토큰을 쓸 수 없으면(만료 가드·토큰을 받지 못함) 요청하지 않고 `unusable` 이다.
 */
async function withToken(
  deps: LabDeps,
  run: (token: string) => Promise<ExperimentResult>,
): Promise<LabOutcome> {
  const access = await accessToken(deps)
  if (!access.ok) return { kind: 'unusable' }
  return { kind: 'result', result: await run(access.token) }
}

/** 세션이 필요 없는 실험 - 토큰을 묻지 않는다(회전도 없다). */
async function withoutToken(run: () => Promise<ExperimentResult>): Promise<LabOutcome> {
  return { kind: 'result', result: await run() }
}

/**
 * 백엔드가 세션을 거절했으면(인증 오류 코드 - 스펙 9.2) 세션 거절을 던진다. 인가를 판정하는 자리가 아니다 -
 * 백엔드가 이미 내린 판정을 앱 전역의 규약(기기 세션을 지우고 로그인으로)으로 옮길 뿐이다.
 */
function dieIfSessionDead(result: JsonApiResult<unknown>): void {
  if (!result.ok && actionForErrors(result.errors) === 'destroySession') throw sessionRejected()
}

async function runPutUpsert(deps: LabDeps, token: string): Promise<ExperimentResult> {
  const { step, result } = await performCall<SingleDocument>(
    deps.send,
    'PUT upsert',
    resourcePath(EXAMPLE, PROBE_LAB_EXAMPLE_ID),
    withAcceptLanguage(
      { method: 'PUT', body: PROBE_LAB_UPSERT_BODY, accessToken: token },
      deps.deviceLanguage(),
    ),
  )
  dieIfSessionDead(result)
  return singleStepResult(step)
}

/**
 * `.../relationships/tags` 의 POST(추가)·DELETE(제거). 태그에는 쓰기 라우트가 없어 먼저 있는 태그 하나를
 * 조회한다 - 그 조회도 실제로 나간 요청이라 결과에 보인다. 대상 행이 아직 없으면(= `putUpsert` 를 먼저 누르지
 * 않았으면) POST 가 실패 응답을 내고, 그것도 그대로 보인다.
 */
async function runRelationshipWrite(deps: LabDeps, token: string): Promise<ExperimentResult> {
  const language = deps.deviceLanguage()
  const relationshipsPath = `${resourcePath(EXAMPLE, PROBE_LAB_EXAMPLE_ID)}/relationships/tags`

  const lookup = await performCall<CollectionDocument>(
    deps.send,
    '1단계 — GET (관계 쓰기에 쓸 태그를 찾는다)',
    EXAMPLE_TAG.path,
    withAcceptLanguage({ query: buildQuery({ page: { size: 1 } }) }, language),
  )
  // document 로 좁힌다 - status 가 아니라(client.ts 의 JsonApiResult 주석).
  if (!lookup.result.ok || lookup.result.document === null) {
    return combinedStepsResult([lookup.step], relationshipsPath)
  }
  const firstTag = lookup.result.document.data[0]
  if (firstTag === undefined) {
    return combinedStepsResult(
      [lookup.step],
      relationshipsPath,
      '태그가 하나도 없어 2·3단계(POST·DELETE)를 실행할 수 없다.',
    )
  }

  const body = { data: [{ type: EXAMPLE_TAG.type, id: firstTag.id }] }
  const added = await performCall<unknown>(
    deps.send,
    '2단계 — POST (태그 추가)',
    relationshipsPath,
    withAcceptLanguage({ method: 'POST', body, accessToken: token }, language),
  )
  dieIfSessionDead(added.result)
  const removed = await performCall<unknown>(
    deps.send,
    '3단계 — DELETE (같은 태그 제거)',
    relationshipsPath,
    withAcceptLanguage({ method: 'DELETE', body, accessToken: token }, language),
  )
  dieIfSessionDead(removed.result)
  return combinedStepsResult([lookup.step, added.step, removed.step], relationshipsPath)
}

/**
 * `page[number]=1` 로 시작해 `links.next` 만 따라간다 - 다음 쪽 번호를 셈하지 않는다. 여섯 중 유일하게 끝없이
 * 돌 수 있는 실험이라 `MAX_OFFSET_REQUESTS` 로 상한을 두고, 걸리면 그 사실을 맺음말에 적는다(스펙 8.6). 빈 쪽이
 * 와도 링크가 있으면 따라간다 - 상한까지 가는 것이 그 백엔드의 원본 동작이다.
 */
async function runOffsetWalk(deps: LabDeps): Promise<ExperimentResult> {
  const language = deps.deviceLanguage()
  const steps: RawStep[] = []
  let query = buildQuery({ page: { number: 1, size: OFFSET_PAGE_SIZE } })
  let outcome: 'end' | 'cap' | 'error' | 'unparseable-link' = 'cap'

  while (steps.length < MAX_OFFSET_REQUESTS) {
    const call = await performCall<CollectionDocument>(
      deps.send,
      `${steps.length + 1}쪽`,
      EXAMPLE.path,
      withAcceptLanguage({ query }, language),
    )
    steps.push(call.step)
    if (!call.result.ok || call.result.document === null) {
      outcome = 'error'
      break
    }
    const next = call.result.document.links?.next
    // NestJS 는 없는 링크의 키를 지우고 정본·Rails 는 null 로 둔다 - 둘 다 끝이다.
    if (next === undefined || next === null) {
      outcome = 'end'
      break
    }
    const parsed = linkQuery(next)
    if (parsed === null) {
      outcome = 'unparseable-link'
      break
    }
    query = parsed
  }

  const note = {
    end: `links.next가 더 이상 없어 컬렉션 끝에 닿았다 - 총 ${steps.length}쪽(쪽당 최대 ${OFFSET_PAGE_SIZE}건)을 거쳤다.`,
    cap: `${MAX_OFFSET_REQUESTS}회 상한에 걸려 멈췄다 - links.next가 더 남아 있었을 수 있다(이 실행에서는 확인하지 않았다).`,
    error: `${steps.length}번째 요청에서 오류 응답을 받아 순회를 멈췄다 - 위 마지막 단계의 상태·본문이 그 오류다.`,
    'unparseable-link': `${steps.length}번째 응답의 links.next를 읽을 수 없어 순회를 멈췄다.`,
  }[outcome]

  return combinedStepsResult(steps, EXAMPLE.path, note)
}

/** `page[totals]` 를 끈 요청과 켠 요청을 나란히 보인다 - 둘 다 보여야 "켠 요청에만" 이 실증된다. */
async function runPageTotals(deps: LabDeps): Promise<ExperimentResult> {
  const language = deps.deviceLanguage()
  const off = await performCall<CollectionDocument>(
    deps.send,
    '1단계 — GET (page[totals] 없음)',
    EXAMPLE.path,
    withAcceptLanguage({ query: buildQuery({ page: { size: TOTALS_PAGE_SIZE } }) }, language),
  )
  const on = await performCall<CollectionDocument>(
    deps.send,
    '2단계 — GET (page[totals]=true)',
    EXAMPLE.path,
    withAcceptLanguage(
      { query: buildQuery({ page: { size: TOTALS_PAGE_SIZE, totals: true } }) },
      language,
    ),
  )
  return combinedStepsResult([off.step, on.step], EXAMPLE.path)
}

/**
 * 같은 검증 오류를 ko·en 으로 나란히 보인다. 이 실험만 기기 언어를 쓰지 않는다 - 비교가 목적이라 두 값을
 * 직접 정한다. API 클라이언트는 호출자가 정한 언어를 덮지 않는다(스펙 9.4 의 D5 정정).
 */
async function runAcceptLanguage(deps: LabDeps, token: string): Promise<ExperimentResult> {
  const ko = await performCall<SingleDocument>(
    deps.send,
    '1단계 — POST (Accept-Language: ko)',
    EXAMPLE.path,
    { method: 'POST', body: PROBE_LAB_INVALID_BODY, accessToken: token, acceptLanguage: 'ko' },
  )
  dieIfSessionDead(ko.result)
  const en = await performCall<SingleDocument>(
    deps.send,
    '2단계 — POST (Accept-Language: en)',
    EXAMPLE.path,
    { method: 'POST', body: PROBE_LAB_INVALID_BODY, accessToken: token, acceptLanguage: 'en' },
  )
  dieIfSessionDead(en.result)
  return combinedStepsResult([ko.step, en.step], EXAMPLE.path)
}

/** 제목은 `exact`·`contains` 만 정책에 있다(`lib/resources/example.ts`) - `gt` 는 문법은 맞지만 정책에 없다. */
async function runInvalidFilter(deps: LabDeps): Promise<ExperimentResult> {
  const query = buildQuery({ filters: [{ name: 'title', operator: 'gt', value: 'probe-lab' }] })
  const { step } = await performCall<CollectionDocument>(
    deps.send,
    'GET (정책에 없는 filter[title][gt])',
    EXAMPLE.path,
    withAcceptLanguage({ query }, deps.deviceLanguage()),
  )
  return singleStepResult(step)
}

/**
 * 실험 하나를 돌린다. 세션이 필요한 셋만 토큰을 받는다 - 나머지 셋은 세션을 건드리지 않는다(회전도 없다).
 * 세션이 없거나 백엔드가 세션을 거절하면 세션 거절을 던진다(`lib/resources/write.ts` 의 `sessionRejected`).
 * 받은 토큰을 쓸 수 없으면 요청 없이 `unusable` 이다.
 */
export function runExperiment(id: string, deps: LabDeps): Promise<LabOutcome> {
  switch (id) {
    case 'offsetWalk':
      return withoutToken(() => runOffsetWalk(deps))
    case 'pageTotals':
      return withoutToken(() => runPageTotals(deps))
    case 'invalidFilter':
      return withoutToken(() => runInvalidFilter(deps))
    case 'putUpsert':
      return withToken(deps, (token) => runPutUpsert(deps, token))
    case 'relationshipWrite':
      return withToken(deps, (token) => runRelationshipWrite(deps, token))
    case 'acceptLanguage':
      return withToken(deps, (token) => runAcceptLanguage(deps, token))
    default:
      return Promise.resolve({
        kind: 'result',
        result: {
          request: { method: '?', path: '?' },
          status: 0,
          headers: {},
          body: `알 수 없는 실험 id: ${id}`,
        },
      })
  }
}
```

`platform/api.ts` — Edit, 찾을 것:

```ts
/**
 * 앱의 API 클라이언트 - 모든 백엔드 요청이 이 함수를 지난다(스펙 8.4·9.4).
 *
 * Accept-Language 를 싣는 자리가 **여기 하나**다. 값은 요청마다 기기의 언어 목록(getLocales)에서
 * 만든다 - 앱이 켜진 채 언어를 바꿔도 다음 요청이 따른다. 조립 규칙은
 * lib/jsonapi/accept-language.ts 가 갖는다.
```

바꿀 것:

```ts
/**
 * 기기의 언어 목록(getLocales)으로 만든 Accept-Language 값 - 부를 때마다 다시 읽는다(앱이 켜진 채
 * 언어를 바꿔도 다음 요청이 따른다). 쓸 태그가 없으면 null 이다. 조립 규칙은
 * lib/jsonapi/accept-language.ts 가 갖는다.
 */
export function deviceAcceptLanguage(): string | null {
  return acceptLanguageFromLocales(getLocales().map((locale) => locale.languageTag))
}

/**
 * 앱의 API 클라이언트 - 모든 백엔드 요청이 이 함수를 지난다(스펙 8.4·9.4).
 *
 * Accept-Language 를 싣는 자리가 **여기 하나**다. 값은 요청마다 기기 언어(deviceAcceptLanguage)다.
 * 호출자가 언어를 정했으면 그 값을 싣는다 - 기기 언어로 덮지 않는다. 언어를 정하는 호출자는 계약
 * 실험실(lib/lab/run.ts)뿐이다: 언어 협상 실험이 같은 오류를 ko·en 으로 비교하고(스펙 8.6), 나머지
 * 실험은 결과의 "보낸 요청 헤더" 에 적으려고 기기 언어를 명시해 싣는다.
```

같은 파일에 Edit, 찾을 것:

```ts
  const tags = getLocales().map((locale) => locale.languageTag)
  const result = await request<T>(
    path,
    withAcceptLanguage(options, acceptLanguageFromLocales(tags)),
  )
```

바꿀 것:

```ts
  const result = await request<T>(
    path,
    withAcceptLanguage(options, options.acceptLanguage ?? deviceAcceptLanguage()),
  )
```

- [ ] **Step 5: 시험이 통과하는지 본다**

```bash
pnpm exec vitest run test/unit/lab test/unit/platform/api.test.ts 2>&1 | grep -E "Test Files|Tests "
```

Expected: `Test Files  4 passed (4)`, `Tests  95 passed (95)`(실험 데이터 21·결과 26·실행부 32·API 클라이언트 16).

- [ ] **Step 6: 출처 기록에 넷을 더한다**

`.maestro-output/d5-provenance-lab.cjs` 를 만든다:

```js
const fs = require('node:fs')
const file = 'docs/provenance/copied-core.json'
const record = JSON.parse(fs.readFileSync(file, 'utf8'))
const EXPERIMENTS = 'lib/lab/experiments.ts'
const RESULT = 'lib/lab/result.ts'
const EXPERIMENTS_TEST = 'test/unit/lab/experiments.test.ts'
const RESULT_TEST = 'test/unit/lab/result.test.ts'
for (const path of [EXPERIMENTS, RESULT, EXPERIMENTS_TEST, RESULT_TEST]) {
  if (record.paths.includes(path)) throw new Error(`이미 있다: ${path}`)
  record.paths.push(path)
}
// result.ts 는 원본(app/(lab)/contract/result.ts)과 내용이 같다 - 옮긴 자리만 다르다.
record.sourceBlobs[RESULT] = '8a389e226964326ab28b8816d07c8a6d4449cb15'
const NOTE_END = 'view.ts 의 줄 번호도 원본 저장소의 것이다.'
if (!record.note.endsWith(NOTE_END)) throw new Error('note 의 끝 문장이 예상과 다르다 - 손으로 고친다')
record.note +=
  " lib/lab/ 의 experiments.ts·result.ts 는 원본의 app/(lab)/contract/ 에서, 그 시험 둘(test/unit/lab/experiments.test.ts·result.test.ts)은 원본의 test/unit/app/contract-experiments.test.ts·contract-result.test.ts 에서 옮겼다 - 이 저장소의 app/ 에는 라우트 파일만 둔다(스펙 4장). result.ts 는 옮긴 자리만 다르고 내용이 원본과 같아서 sourceBlobs 의 값이 원본 경로(app/(lab)/contract/result.ts)의 blob 이다. 그 파일들의 주석이 말하는 actions.ts·runExperiment·'use server'·page.tsx·result-view.tsx·useActionState·test/e2e/contract-lab.spec.ts·test/unit/components/contract-result.test.ts·브리핑·판정 N·스펙 8.5 도 원본 저장소의 것이다 - 이 저장소에서 실험의 실행부는 lib/lab/run.ts, 화면은 app/(lab)/contract.tsx 와 components/lab/experiment-card.tsx, E2E 는 test/e2e/flows/contract-lab-*.yaml 이다."
record.divergences.push(
  {
    path: EXPERIMENTS,
    what: "원본의 app/(lab)/contract/experiments.ts 에서 옮겼다. 커서 순회 실험(id cursorWalk, '커서 순회')을 offset 순회(id offsetWalk, 'offset 순회')로 바꾸고, proves 를 page[number]=1 에서 links.next 를 따라가는 문장과 20회 상한으로 고쳤다.",
    why: '스펙 8.3·8.6 - 이 앱의 목록은 커서라 실험실이 offset 을 실증한다(원본은 반대다). app/ 에는 라우트 파일만 둔다(스펙 4장).',
  },
  {
    path: EXPERIMENTS_TEST,
    what: "원본의 test/unit/app/contract-experiments.test.ts 에서 옮겼다. import 를 '@/app/(lab)/contract/experiments' 에서 '@/lib/lab/experiments' 로, EXPECTED_NEEDS_SESSION 의 cursorWalk 를 offsetWalk 로 바꿨다.",
    why: 'experiments.ts 가 lib/lab/ 로 옮겨졌고 커서 순회가 offset 순회로 바뀌었다(스펙 8.6).',
  },
  {
    path: RESULT_TEST,
    what: "원본의 test/unit/app/contract-result.test.ts 에서 옮겼다. import 와 머리말이 가리키는 파일을 app/(lab)/contract/result 에서 lib/lab/result 로 바꿨다.",
    why: 'result.ts 가 lib/lab/ 로 옮겨졌다(스펙 4장 - app/ 에는 라우트 파일만 둔다).',
  },
)
fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`)
console.log(`경로 ${record.paths.length}개, 이탈 ${record.divergences.length}건`)
```

```bash
node .maestro-output/d5-provenance-lab.cjs
node scripts/check-provenance.mjs
```

Expected: `경로 52개, 이탈 40건`, `복사 출처 기록 통과: 경로 52개, 이탈 40건, 원본 그대로 32개`(`lib/lab/result.ts` 가 원본 그대로에 든다 - 옮긴 경로의 내용이 원본 blob 과 같다).

- [ ] **Step 7: 문서와 스펙 정정을 쓴다**

`lib/lab/AGENTS.md` 를 만든다:

```markdown
# lib/lab/ 작업 지침

계약 실험실(스펙 8.6)의 실험 정의와 결과 표현, 실험을 요청으로 돌리는 실행부다. JSX·fetch·네이티브 모듈을
갖지 않는다 - 요청은 주입받은 전송으로만 보낸다.

| 파일             | 역할                                                                                                       |
| ---------------- | ---------------------------------------------------------------------------------------------------------- |
| `experiments.ts` | 여섯 실험의 id·제목·실증하는 계약·세션 필요 여부 - 순수 데이터(복사본)                                     |
| `result.ts`      | 원본 응답을 결과로 옮기는 판단 - 보낸 요청 헤더(토큰은 가린다)·본문 직렬화·여러 단계의 결합과 파싱(복사본) |
| `run.ts`         | 실험 하나를 실제 요청으로 돌린다 - 전송·토큰·지금의 세션·시계·기기 언어를 주입받는다(이 저장소의 것)       |

## 복사본이다

`experiments.ts`·`result.ts` 는 `template-typescript-nextjs` 의 `app/(lab)/contract/` 에서 옮겨 복사했다 - 이
저장소의 `app/` 에는 라우트 파일만 둔다(스펙 4장). 커서 순회 실험이 offset 순회로 바뀌었다(`experiments.ts`,
스펙 8.3·8.6). 출처와 이탈은 `docs/provenance/copied-core.json`. 두 파일의 주석이 말하는 `actions.ts`·
`page.tsx`·`result-view.tsx`·`'use server'` 는 원본 저장소의 것이다 - 이 저장소에서 그 자리는 `run.ts`,
`app/(lab)/contract.tsx`, `components/lab/experiment-card.tsx` 다.

## 원본을 가공하지 않는다

실험실의 목적은 각 실험이 백엔드의 원본 응답을 그대로 보이는 것이다. 응답의 상태·본문은 `result.ts` 의
`bodyText` 로만 옮긴다 - 오류 문구를 다시 쓰거나 필드별로 나누는 판단(`groupErrors`·`formStateFromErrors`)을
결과에 쓰지 않는다. 본문은 파싱한 뒤 다시 직렬화한 JSON 이라 키 순서와 공백이 원본과 다를 수 있다 - 화면이
그 사실을 적는다. 여러 단계의 결과는 `combinedStepsResult` 가 붙이고 `parseCombinedSteps` 가 정확히 그만큼을
떼어 낸다 - 화면과 E2E 는 단계의 본문만 본다.

## 세션

- 세션이 필요한 셋(`putUpsert`·`relationshipWrite`·`acceptLanguage`)은 `run.ts` 의 분기에 적는다 -
  `experiments.ts` 의 `needsSession` 을 읽지 않는다(데이터 하나의 실수로 가드가 풀리지 않게). 둘이 어긋나면
  `test/unit/lab/run.test.ts` 가 잡는다.
- 그 셋은 쓰기와 같은 길로 토큰을 받는다(`lib/resources/write.ts` 의 `accessToken`) - 가드를 두 벌 두지 않는다.
  세션이 없으면 요청하지 않고 세션 거절(`sessionRejected`)을 던진다. 받은 토큰의 세션이 이미 만료됐거나(만료
  가드 - 회전이 판정을 받지 못해 지금의 access 가 그대로 돌아왔다, 스펙 7.2) 토큰을 받지 못하면(회전한 세션을
  저장소에 못 씀) 요청하지 않고 `unusable` 로 끝난다 - 세션은 그대로이고 카드가 앱 문구를 그린다.
- 백엔드가 세션을 거절하면(인증 오류 코드) 세션 거절을 던진다. 받는 쪽은 쓰기 캐시(`MutationCache`)의
  `onError`(기기 세션을 지운다)와 실험실 화면(로그인으로 보낸다 - 실험실은 공개 경로라 경로 가드가 보내지 않는다).
- 세션 거절 말고 실행부가 던지는 것은 결함이다 - 응답은 오류든 닿지 못함이든 전부 결과로 옮긴다. 훅
  (`queries/lab.ts`)이 결함을 오류 경계로 보낸다.
- 읽기는 토큰 없이 보낸다(스펙 7.2). 세션이 필요 없는 셋은 토큰을 묻지도 않는다 - 회전도 일어나지 않는다.

## 언어

요청마다 기기 언어를 명시해 싣고 "보낸 요청 헤더" 에도 그 값을 적는다 - API 클라이언트(`platform/api.ts`)는
호출자가 정한 언어를 덮지 않는다(스펙 9.4 의 D5 정정). 언어 협상 실험만 `ko`·`en` 을 직접 정한다.

## 검증

`test/unit/lab/` 의 셋 - `experiments.test.ts`·`result.test.ts`(복사본)와 `run.test.ts`(가짜 전송·토큰·세션·
시계·언어로 실험마다의 요청과 결과, 세션 가드와 만료 가드, offset 순회의 끝·상한·오류). 훅의 배선과 결함의
갈래는 `test/unit/queries/lab.test.ts` 가, 실제 요청·로그인 이동·단계의 본문은 E2E
(`test/e2e/flows/contract-lab-*.yaml`)가 잰다.
```

`platform/AGENTS.md` — Edit(표의 `api.ts` 행 - 칸 맞춤 공백은 뒤의 `pnpm format` 이 다시 맞춘다), 찾을 것:

```markdown
Accept-Language 를 싣는 유일한 자리(스펙 9.4), e2e 변형의 실패 표식
```

바꿀 것:

```markdown
Accept-Language 를 싣는 유일한 자리(스펙 9.4) - 값은 기기 언어(`deviceAcceptLanguage`)이고 호출자가 정했으면 그 값이다(계약 실험실). e2e 변형의 실패 표식
```

같은 파일에 Edit(`## 검증` 절), 찾을 것:

```markdown
`api.ts`의 배선 - 요청마다 기기 언어로 Accept-Language 를 싣는 것, e2e 변형에서만 실패 표식을 남기는
```

바꿀 것:

```markdown
`api.ts`의 배선 - 요청마다 기기 언어로 Accept-Language 를 싣는 것, 호출자가 정한 언어는 덮지 않는 것, e2e 변형에서만 실패 표식을 남기는
```

`AGENTS.md` — Edit, 찾을 것 `| 실험 정의, 결과 표현` — 바꿀 것 `| 실험 정의, 실험의 실행(전송·토큰을 주입받는다), 결과 표현`

스펙 — `## 10. 설정·빌드·배포` 바로 앞에 더한다:

```markdown
> 정정(2026-10-01, D5): 헤더를 싣는 자리는 그대로 `platform/api.ts` 의 `apiRequest` 하나지만, 호출자가 옵션에 언어
> (`acceptLanguage`)를 정했으면 그 값을 싣는다 - 기기 언어로 덮지 않는다. 8.6 의 언어 협상 실험이 같은 쓰기 오류를
> `ko`·`en` 으로 비교하려면 두 값을 명시해야 한다. 언어를 정하는 호출자는 계약 실험실(`lib/lab/run.ts`)뿐이다 - 나머지
> 실험도 결과에 "보낸 요청 헤더" 를 적으려고 기기 언어(`deviceAcceptLanguage`)를 명시해 싣고, 그 밖의 요청은 전부
> 언어를 넘기지 않아 기기 언어가 실린다. 호출부마다 언어를 넘기던 원본의 모양으로 돌아간 것이 아니다.
> `test/unit/platform/api.test.ts` 가 두 동작을 잰다.
```

- [ ] **Step 8: 검사하고 커밋한다**

```bash
pnpm format
pnpm typecheck && pnpm lint && pnpm format:check && ./scripts/check-citations.sh app components lib platform queries test && node scripts/check-provenance.mjs | tail -n 1
pnpm test 2>&1 | grep -E "Test Files|Tests "
git status --short
git add lib/lab test/unit/lab lib/resources/write.ts platform/api.ts test/unit/platform/api.test.ts docs/provenance/copied-core.json platform/AGENTS.md AGENTS.md docs/superpowers/specs
git commit -m "feat: Next.js 템플릿의 실험실 판단을 lib/lab 으로 옮겨 복사하고 쓰기의 토큰 길을 지나는 실행부를 두며 API 클라이언트가 호출자의 언어를 덮지 않게 한다"
```

Expected: 검사 전부 exit 0, `Test Files  67 passed (67)`·`Tests  1521 passed (1521)`(Step 1 의 수 + 파일 3·시험 81), 커밋 뒤 남은 파일이 없다(`.maestro-output/` 은 git 이 무시한다).

---

### Task 2: 계약 거울 — `test/contract/`, 게이트 `[12/13]`

**Files:**
- Create: `test/contract/mirror.test.ts`, `test/contract/backend.ts`, `test/contract/run.sh`(100755), `test/contract/AGENTS.md`, `vitest.contract.config.mjs`
- Modify: `package.json`(스크립트 `test:contract`), `scripts/check.sh`(다시 씀 - 13단계), `test/unit/scripts/check-citations.test.ts`(주석 넷), `lib/config/AGENTS.md`, `lib/resources/AGENTS.md`, `AGENTS.md`, `docs/provenance/copied-core.json`, 스펙(11.2·12 정정)

**Interfaces:**
- Consumes: `mirrorProbes(resource)`·`attributeKeys(resource)`·`MirrorProbe`(`lib/resources/mirror.ts`, 원본 그대로), `RESOURCES`·`EXAMPLE`(`lib/resources`), `buildQuery`(`lib/jsonapi/query.ts`), `isCollectionDocument`·`isErrorDocument`·`ErrorObject`(`lib/jsonapi/document.ts`), `JSONAPI_MEDIA_TYPE`(`lib/jsonapi/client.ts`), `REGISTER_ENDPOINT`·`LOGIN_ENDPOINT`·`registerDocument`·`loginDocument`·`Credentials`(`lib/auth/credentials.ts`), `probeEmail(prefix, label)`(`test/e2e/probe-email.ts`), `docker-compose.e2e.yml` 의 FastAPI 프로파일(호스트 `E2E_API_PORT`, 기본 4100).
- Produces: `pnpm test:contract`(환경 변수 `CONTRACT_API_URL` 필수), `./test/contract/run.sh`(스택을 띄우고 돌고 내린다 - 게이트 `[12/13]`), `backend.ts` 의 `getFrom(path, query)`·`postTo(path, body, accessToken | null)`·`isSuccess(status)`·`registerAndLogin(credentials): Promise<string>`·`BackendResponse { status; body }`. 게이트가 13단계다 - E2E 는 `[13/13]`.

- [ ] **Step 1: 거울의 설정과 스크립트를 쓴다**

`vitest.contract.config.mjs` 를 만든다:

```js
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * 계약 거울(스펙 11.2)의 vitest 설정 - 실제 백엔드에 HTTP 로 건다. 단위 시험(vitest.config.mjs)과 따로 둔다:
 * 단위는 백엔드 없이 돌아야 하고, 이것은 스택이 떠 있어야 돈다. test/contract/run.sh 가 스택을 띄우고
 * `pnpm test:contract` 로 부른다.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/contract/**/*.test.ts'],
    // 요청 하나가 느린 스택을 만나도 기본값(5초)에 잘리지 않게 한다 - 가입·로그인이 든 준비 단계도 같다.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
})
```

`package.json` — Edit, 찾을 것:

```json
    "test": "vitest run",
```

바꿀 것:

```json
    "test": "vitest run",
    "test:contract": "vitest run --config vitest.contract.config.mjs",
```

- [ ] **Step 2: 거울을 쓴다 - 백엔드 도우미와 검사 넷**

`test/contract/backend.ts` 를 만든다:

```ts
import {
  LOGIN_ENDPOINT,
  REGISTER_ENDPOINT,
  loginDocument,
  registerDocument,
  type Credentials,
} from '@/lib/auth/credentials'
import { JSONAPI_MEDIA_TYPE } from '@/lib/jsonapi/client'

/**
 * 계약 거울이 백엔드에 닿는 자리 - 앱의 API 클라이언트(`request()`)를 지나지 않고 `fetch` 로 원본 응답(상태와
 * 파싱한 본문)을 받는다. 거울이 재는 것은 선언과 백엔드의 관계이지 앱의 클라이언트가 아니다.
 *
 * 주소는 `CONTRACT_API_URL` 이다 - `test/contract/run.sh` 가 스택을 띄우고 호스트에서 API 에 닿는 주소를 준다.
 * 기본값을 두지 않는다: 값이 없으면 스택 없이 돌린 것이라 곧바로 그 사실을 알리고 멈춘다.
 */
function baseUrl(): string {
  const url = process.env.CONTRACT_API_URL
  if (url === undefined || url === '') {
    throw new Error(
      'CONTRACT_API_URL 이 없다 - 계약 거울은 test/contract/run.sh 로 돈다(스택을 띄우고 이 주소를 준다)',
    )
  }
  return url.replace(/\/+$/, '')
}

/** 백엔드가 준 것 그대로 - 상태와, JSON 이면 파싱한 본문(아니면 글자 그대로, 비었으면 null). */
export interface BackendResponse {
  readonly status: number
  readonly body: unknown
}

export function isSuccess(status: number): boolean {
  return status >= 200 && status < 300
}

async function exchange(
  method: string,
  path: string,
  query: URLSearchParams | null,
  body: unknown,
  accessToken: string | null,
): Promise<BackendResponse> {
  const qs = query?.toString() ?? ''
  const headers: Record<string, string> = { accept: JSONAPI_MEDIA_TYPE }
  if (body !== undefined) headers['content-type'] = JSONAPI_MEDIA_TYPE
  if (accessToken !== null) headers.authorization = `Bearer ${accessToken}`
  const response = await fetch(`${baseUrl()}${path}${qs === '' ? '' : `?${qs}`}`, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const text = await response.text()
  let parsed: unknown = null
  if (text !== '') {
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = text
    }
  }
  return { status: response.status, body: parsed }
}

/** 공개 읽기 - 토큰을 싣지 않는다(스펙 7.2). */
export function getFrom(path: string, query: URLSearchParams): Promise<BackendResponse> {
  return exchange('GET', path, query, undefined, null)
}

/** 쓰기 - 토큰은 있으면 싣는다. */
export function postTo(
  path: string,
  body: unknown,
  accessToken: string | null,
): Promise<BackendResponse> {
  return exchange('POST', path, null, body, accessToken)
}

function accessTokenOf(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null) return undefined
  const data = (body as { data?: { attributes?: { accessToken?: unknown } } }).data
  const token = data?.attributes?.accessToken
  return typeof token === 'string' ? token : undefined
}

/** 가입하고 로그인해 access token 을 받는다 - 문서 모양은 앱의 것(`lib/auth/credentials.ts`)을 쓴다. */
export async function registerAndLogin(credentials: Credentials): Promise<string> {
  const registered = await postTo(REGISTER_ENDPOINT, registerDocument(credentials), null)
  if (!isSuccess(registered.status)) {
    throw new Error(
      `계약 거울의 가입이 실패했다 - ${registered.status} ${JSON.stringify(registered.body)}`,
    )
  }
  const loggedIn = await postTo(LOGIN_ENDPOINT, loginDocument(credentials), null)
  const token = accessTokenOf(loggedIn.body)
  if (!isSuccess(loggedIn.status) || token === undefined) {
    throw new Error(
      `계약 거울의 로그인이 실패했다 - ${loggedIn.status} ${JSON.stringify(loggedIn.body)}`,
    )
  }
  return token
}
```

`test/contract/mirror.test.ts` 를 만든다:

```ts
import { beforeAll, describe, expect, it } from 'vitest'

import { isCollectionDocument, isErrorDocument, type ErrorObject } from '@/lib/jsonapi/document'
import { buildQuery } from '@/lib/jsonapi/query'
import { EXAMPLE, RESOURCES } from '@/lib/resources'
import { attributeKeys, mirrorProbes } from '@/lib/resources/mirror'
import { probeEmail } from '@/test/e2e/probe-email'

import { getFrom, isSuccess, postTo, registerAndLogin, type BackendResponse } from './backend'

/**
 * 계약 거울 - 손으로 옮긴 자원 선언(`lib/resources/*.ts`)이 실제 백엔드의 계약과 같은가(스펙 11.2).
 *
 * 선언의 `filters`·`sorts`·`attributes` 는 백엔드 조회 정책과 시리얼라이저를 손으로 베낀 거울이라 반드시
 * 어긋난다. 이 파일은 복사한 `lib/resources/mirror.ts` 가 계산한 프로브와 속성 키를 실제 백엔드에 보내 맞댄다
 * - 선언을 백엔드보다 넓히거나 좁히면(연산자·정렬을 열거나 닫으면, 속성 이름이나 제약을 바꾸면) 게이트
 * `[12/13]` 이 빨개진다. 원본(template-typescript-nextjs)의 `test/e2e/mirror.spec.ts` 의 검사 넷을 vitest 로
 * 옮긴 것이다 - Playwright 의 요청 컨텍스트 대신 `fetch`(`./backend.ts`)로 원본 응답을 받는다.
 *
 * 1. 조회 정책 - 선언된 (필드, 연산자)·정렬은 2xx, 선언에 없는 연산자는 `INVALID_FILTER`, 선언에 없는 정렬은
 *    `INVALID_SORT` 와 그 `source.parameter`.
 * 2. 응답 `data[0].attributes` 의 키 집합이 선언(`attributeKeys`)과 같다 - 씨앗이 0건이면 잴 것이 없어 실패다.
 * 3. 속성 제약 - `examples` 에만, 로그인한 뒤 POST 로. `maxLength`·`min`·`max`·enum 을 넘기면 422 와 그 필드를
 *    가리키는 `source.pointer`. 참조 자원은 쓰기 라우트가 없어 이 검사가 성립하지 않는다. 넘긴 값만 보내므로
 *    행이 만들어지지 않는다 - 선언이 백엔드보다 좁은 쪽을 잡는다(`maxLength` 를 줄이면 백엔드가 받아 2xx 다).
 * 4. 선언된 enum 값 각각이 백엔드의 어휘에 있다 - `exact` 필터로 물어 2xx(0건이어도 된다).
 *
 * 오류는 `code`·`source` 만 본다 - 문구(`title`·`detail`)는 세 백엔드가 갈린다. 모든 값은 선언에서 읽는다 -
 * 상수로 박으면 선언을 바꾸는 뮤턴트가 살아남는다.
 */

/** 이 파일이 만드는 값의 접두사 - 실험실(`probe-lab`)과 같다. 실전 값과 겹치지 않는다. */
const PROBE_PREFIX = 'probe-lab'

/** 정본의 비밀번호 하한(12자)을 넘기는 값. */
const PROBE_PASSWORD = `${PROBE_PREFIX}-password-value`

function errorsOf(response: BackendResponse): readonly ErrorObject[] {
  return isErrorDocument(response.body) ? response.body.errors : []
}

describe.each(RESOURCES.map((resource) => [resource.type, resource] as const))(
  '① 선언된 조회 정책이 백엔드와 같다 - %s',
  (_type, resource) => {
    it.each(mirrorProbes(resource).map((probe) => [probe.label, probe] as const))(
      '%s',
      async (label, probe) => {
        const response = await getFrom(probe.path, probe.query)
        const expected = probe.expect

        if (expected.kind === 'ok') {
          expect(
            isSuccess(response.status),
            `[${label}] 2xx 를 기대했다 - 실제 ${response.status}`,
          ).toBe(true)
          return
        }

        const errors = errorsOf(response)
        const matched = errors.find((error) => error.code === expected.code)
        expect(
          { code: matched?.code, parameter: matched?.source?.parameter },
          `[${label}] status=${response.status} errors=${JSON.stringify(errors)}`,
        ).toEqual({ code: expected.code, parameter: expected.parameter })
      },
    )
  },
)

describe('② 응답의 속성 키 집합이 선언과 같다', () => {
  it.each(RESOURCES.map((resource) => [resource.type, resource] as const))(
    '%s',
    async (type, resource) => {
      const response = await getFrom(resource.path, buildQuery({ page: { size: 1 } }))

      expect(
        isSuccess(response.status),
        `[${type}] page[size]=1 이 실패했다 - ${response.status}`,
      ).toBe(true)
      const body = response.body
      if (!isCollectionDocument(body)) throw new Error(`[${type}] 응답이 컬렉션 문서가 아니다`)
      // 0건이면 건너뛰지 않고 실패한다 - 씨앗이 없으면 이 검사는 아무것도 재지 못한다.
      const first = body.data[0]
      if (first === undefined) {
        throw new Error(`[${type}] 씨앗이 0건이다 - test/e2e/seed/ 가 비어 있으면 잴 것이 없다`)
      }
      expect(Object.keys(first.attributes ?? {}).sort(), `[${type}] attributes 키 집합`).toEqual(
        [...attributeKeys(resource)].sort(),
      )
    },
  )
})

/* ------------------------------------------------------------------------- *
 * ③ 속성 제약 - examples 에만, 로그인한 뒤
 * ------------------------------------------------------------------------- */

const title = EXAMPLE.attributes.title
const score = EXAMPLE.attributes.score
const status = EXAMPLE.attributes.status
if (title?.kind !== 'string' || title.maxLength === undefined) {
  throw new Error(
    "EXAMPLE.attributes.title 이 maxLength 가 있는 kind: 'string' 이 아니다 - ③ 의 전제",
  )
}
if (score?.kind !== 'int' || score.min === undefined || score.max === undefined) {
  throw new Error("EXAMPLE.attributes.score 가 min·max 가 있는 kind: 'int' 가 아니다 - ③ 의 전제")
}
if (status?.kind !== 'enum' || status.values[0] === undefined) {
  throw new Error("EXAMPLE.attributes.status 가 값이 있는 kind: 'enum' 이 아니다 - ③ 의 전제")
}
const TITLE_MAX_LENGTH = title.maxLength
const SCORE_MIN = score.min
const SCORE_MAX = score.max
const VALID_STATUS = status.values[0].value
/** 선언에 없는 status - 선언된 첫 값에서 만든다(선언을 바꾸면 이 값도 따라간다). */
const UNDECLARED_STATUS = `${VALID_STATUS}-${PROBE_PREFIX}-not-declared`

interface AttributeOverrides {
  readonly title?: string
  readonly score?: number
  readonly status?: string
}

/** 검사하는 속성 하나만 어긋나고 나머지는 유효하다. 관계는 선언된 것 전부를 비운다. */
function exampleBody(overrides: AttributeOverrides): unknown {
  const relationships = Object.fromEntries(
    Object.entries(EXAMPLE.relationships).map(([name, relationship]) => [
      name,
      { data: relationship.cardinality === 'one' ? null : [] },
    ]),
  )
  return {
    data: {
      type: EXAMPLE.type,
      attributes: {
        title: overrides.title ?? `${PROBE_PREFIX}-mirror-constraint`,
        description: null,
        status: overrides.status ?? VALID_STATUS,
        score: overrides.score ?? Math.round((SCORE_MIN + SCORE_MAX) / 2),
      },
      relationships,
    },
  }
}

/** `maxLength` 를 정확히 하나 넘기는 제목. */
function overlongTitle(): string {
  return `${PROBE_PREFIX}-`.padEnd(TITLE_MAX_LENGTH + 1, 'a')
}

describe('③ 속성 제약 - examples 에만, 로그인한 뒤', () => {
  let accessToken = ''

  beforeAll(async () => {
    accessToken = await registerAndLogin({
      email: probeEmail(`${PROBE_PREFIX}-mirror`, 'constraints'),
      password: PROBE_PASSWORD,
    })
  })

  async function expectValidationErrorAt(overrides: AttributeOverrides, pointer: string) {
    const response = await postTo(EXAMPLE.path, exampleBody(overrides), accessToken)
    const errors = errorsOf(response)
    expect(response.status, `422 를 기대했다 - errors=${JSON.stringify(errors)}`).toBe(422)
    const matched = errors.find((error) => error.source?.pointer === pointer)
    expect(matched?.code, `source.pointer=${pointer} 인 오류 - ${JSON.stringify(errors)}`).toBe(
      'VALIDATION_ERROR',
    )
  }

  it('title 이 maxLength 보다 한 글자 길면 422', async () => {
    await expectValidationErrorAt({ title: overlongTitle() }, '/data/attributes/title')
  })

  it('score 가 max 보다 크면 422', async () => {
    await expectValidationErrorAt({ score: SCORE_MAX + 1 }, '/data/attributes/score')
  })

  it('score 가 min 보다 작으면 422', async () => {
    await expectValidationErrorAt({ score: SCORE_MIN - 1 }, '/data/attributes/score')
  })

  // 거부하는가(세 백엔드 공통)와 어떤 모양으로 거부하는가(422·포인터)를 나눈다 - 원본과 같다. 401 을 먼저
  // 배제한다: 없으면 인증이 깨진 세계와 선언 밖 값이 거부된 세계가 같아진다.
  it('status 가 선언에 없는 값이면 행이 만들어지지 않는다', async () => {
    const response = await postTo(
      EXAMPLE.path,
      exampleBody({ status: UNDECLARED_STATUS }),
      accessToken,
    )

    expect(response.status, '401 이 왔다 - 재는 것이 거울이 아니라 인증이다').not.toBe(401)
    expect(isSuccess(response.status), `선언 밖 status 로 2xx 가 왔다 - ${response.status}`).toBe(
      false,
    )
  })

  it('status 가 선언에 없는 값이면 422', async () => {
    await expectValidationErrorAt({ status: UNDECLARED_STATUS }, '/data/attributes/status')
  })
})

/* ------------------------------------------------------------------------- *
 * ④ 선언된 enum 값 각각이 백엔드의 어휘에 있다
 * ------------------------------------------------------------------------- */

/**
 * ③ 은 선언에 없는 값이 거부되는지를, 이것은 선언된 값이 각각 받아들여지는지를 잰다 - 서로 다른 명제다.
 * `exact` 가 선언된 enum 속성만 돈다(아니면 그 요청은 애초에 400 이어야 한다). 0건 2xx 도 통과다 - 재는 것은
 * 그 값이 어휘에 있는가이지 그 값의 행이 있는가가 아니다.
 */
const ENUM_PROBES = RESOURCES.flatMap((resource) =>
  Object.entries(resource.attributes).flatMap(([field, attribute]) => {
    if (attribute.kind !== 'enum') return []
    if (!(resource.filters[field] ?? []).includes('exact')) return []
    return attribute.values.map(
      (value) =>
        [`${resource.type} ${field}=${value.value}`, resource, field, value.value] as const,
    )
  }),
)

describe('④ 선언된 enum 값 각각이 백엔드의 어휘에 있다', () => {
  it('잴 enum 이 하나 이상이다 - 없으면 이 절은 아무것도 재지 않는다', () => {
    expect(ENUM_PROBES.length).toBeGreaterThan(0)
  })

  it.each(ENUM_PROBES)('%s', async (label, resource, field, value) => {
    const response = await getFrom(
      resource.path,
      buildQuery({ filters: [{ name: field, operator: 'exact', value }] }),
    )

    expect(isSuccess(response.status), `[${label}] 2xx 를 기대했다 - 실제 ${response.status}`).toBe(
      true,
    )
  })
})
```

- [ ] **Step 3: 백엔드 없이 돌려 거울이 초록으로 속지 않는지 본다**

거울의 초록은 Task 4 가 실제 스택에서 잰다. 여기서는 스택 없이 돌린 거울이 통과하지 않는다는 것과, 단위 시험이 거울을 돌지 않는다는 것을 본다.

```bash
pnpm test:contract 2>&1 | grep -E "CONTRACT_API_URL 이 없다|Tests " | sort -u
CONTRACT_API_URL=http://127.0.0.1:9 pnpm test:contract 2>&1 | grep -E "fetch failed|Tests " | sort -u
pnpm test 2>&1 | grep -E "Test Files|Tests "
```

Expected: 첫째는 `Error: CONTRACT_API_URL 이 없다 - 계약 거울은 test/contract/run.sh 로 돈다(…)` 와 `Tests  83 failed | 1 passed | 5 skipped (89)`, 둘째는 `TypeError: fetch failed` 와 같은 수(통과하는 하나는 "잴 enum 이 하나 이상이다", 건너뛰는 다섯은 준비 단계의 가입이 실패한 ③), 셋째는 `67 passed`·`1521 passed`(Task 1 뒤의 수 그대로 - 거울이 단위에 섞이지 않는다). 포트 9 에 무엇이 떠 있으면 둘째의 오류 문장이 다를 수 있다 - 수가 같으면 된다.

- [ ] **Step 4: 스택을 띄우고 거울을 도는 스크립트를 쓴다**

`test/contract/run.sh` 를 만든다:

```bash
#!/usr/bin/env bash
# 계약 거울 게이트 단계 - FastAPI 스택을 띄우고 test/contract 를 돈다(스펙 11.2·12장).
#
#   test/contract/run.sh
#
# 순서: 이 저장소의 compose 프로젝트를 내린다 → FastAPI 프로파일을 띄워 준비될 때까지 기다린다 → 자원 선언과
# 백엔드를 HTTP 로 맞댄다(vitest.contract.config.mjs) → 내린다(실패해도 내린다). 앱도 기기도 쓰지 않는다 - E2E
# (test/e2e/run-android.sh)보다 먼저 돌아 선언이 백엔드와 어긋나면 빨리 멈춘다.
#
# ## 환경 변수
#
#   E2E_API_PORT   백엔드를 여는 호스트 포트. 기본 4100(docker-compose.e2e.yml·E2E 하네스와 같은 값)
#
# 스택은 E2E 와 같은 compose 프로젝트(template-typescript-expo-e2e)다 - 그 프로젝트만 띄우고 내린다. 개발
# 머신의 다른 스택을 건드리지 않는다.
set -euo pipefail
cd "$(dirname "$0")/../.."

readonly PROJECT=template-typescript-expo-e2e
readonly API_PORT="${E2E_API_PORT:-4100}"

export E2E_API_PORT="$API_PORT"
# access token 은 백엔드 기본 수명(900초)으로 둔다 - 거울은 한 번 로그인한 토큰으로 속성 제약을 잰다. E2E
# 하네스는 이 변수를 10 으로 준다(test/e2e/run-android.sh) - 셸에 그 값이 남아 있어도 여기서는 쓰지 않는다.
export E2E_ACCESS_EXPIRES_SECONDS=900

fail() {
  echo "계약 거울: $*" >&2
  exit 1
}

compose() {
  docker compose -p "$PROJECT" -f docker-compose.e2e.yml "$@"
}

# 내릴 때는 세 프로파일을 모두 준다 - down 도 활성 프로파일만 대상으로 삼는다(compose 머리말).
compose_down() {
  compose --profile fastapi --profile nestjs --profile rails down -v --remove-orphans >/dev/null 2>&1 || true
}

command -v docker >/dev/null || fail "docker 가 없다"
docker info >/dev/null 2>&1 || fail "Docker 데몬에 닿지 못한다 - Docker 를 켠다"
command -v curl >/dev/null || fail "curl 이 없다"

trap compose_down EXIT
compose_down
compose --profile fastapi up -d --build --wait
curl -fsS "http://127.0.0.1:$API_PORT/health/ready" >/dev/null ||
  fail "FastAPI 가 127.0.0.1:$API_PORT 에서 준비되지 않았다"

CONTRACT_API_URL="http://127.0.0.1:$API_PORT" pnpm test:contract
```

```bash
chmod +x test/contract/run.sh
bash -n test/contract/run.sh && echo "syntax ok"
```

Expected: `syntax ok`. 이 스크립트는 Task 4 에서 처음 돈다 - 여기서 부르지 않는다(Docker 는 Task 4 에서만).

- [ ] **Step 5: 게이트를 13단계로 바꾼다**

바꾸기 전에 D3·D4 가 게이트를 고치지 않았는지 본다:

```bash
git hash-object scripts/check.sh
```

Expected: `45a57dcff11774e1a1f9235302eaf7e71fb9ec53`. 다르면 `git log -p -3 -- scripts/check.sh` 로 무엇이 바뀌었는지 보고 그 변경을 아래 새 판에 옮긴 뒤 쓴다.

`scripts/check.sh` 전체를 바꾼다:

```bash
#!/usr/bin/env bash
# 단일 검증 게이트 - 스펙 12장. 이 명령이 통과하면 통과다.
#
#   ./scripts/check.sh
#
# 형제 템플릿들의 scripts/check.sh 와 같은 계약이다. 정적 단계 열하나 뒤에 계약 거울(FastAPI 스택 +
# test/contract)과 E2E(Android 에뮬레이터 + FastAPI)를 돈다. 계약 거울은 앱도 기기도 쓰지 않아 E2E
# 앞에서 돈다 - 자원 선언이 백엔드와 어긋나면 APK 를 만들기 전에 멈춘다.
#
# ## 전제 조건
#
#   1. `pnpm install --frozen-lockfile` 이 끝나 있어야 한다.
#   2. Docker 가 돌고 있어야 한다 - [11]·[12]·[13] 이 쓴다.
#   3. [9] expo-doctor 는 네트워크가 필요하다(의존성 호환 목록을 받아 온다).
#   4. [10] 이 Metro·Uniwind 캐시를 지운다(--clear) - 돌리기 전에 이 저장소의 expo start 를 끈다.
#   5. [13] E2E 는 Android SDK(ANDROID_HOME), Maestro 2.11(PATH 또는 ~/.maestro/bin/maestro), 그리고
#      켜진 기기나 부팅할 AVD 이름(E2E_AVD)이 필요하다. 빠진 것이 있으면 무엇이 빠졌는지 알리고
#      멈춘다. Windows 에서 저장소 경로가 47자를 넘으면 짧은 경로(E2E_STAGE_DIR, 기본 C:/t/e)의
#      사본에서 APK 를 만든다 - test/e2e/run-android.sh 머리말.
#
# ## 설정을 평가하는 단계가 쓰는 BACKEND_URL
#
# [1]·[8]·[9]·[10] 은 app.config.ts 를 평가하므로 BACKEND_URL 이 필요하다(스펙 10.1 - 없으면
# 멈춘다). [9] expo-doctor 는 `expo config` 를 불러 설정을 평가한다(2026-09-30 실측: 값이 없으면
# `expo config --json --full` 이 exit 1 로 죽는다). 이 단계들은 백엔드에 닿지 않으므로 닿을 수
# 없는 주소(.invalid, RFC 6761)를 명시적으로 준다. https 라서 네 변형 모두의 규칙을 통과한다.
#
# ## 인용 단계가 훑는 대상
#
# 아래 [5] 의 대상 목록은 test/unit/scripts/check-citations.test.ts 가 이 파일의 소스를
# 읽어 그대로 맞댄다 - 대상을 바꾸려면 두 자리를 함께 고친다. scripts/ 와 docs/ 와 루트
# AGENTS.md 는 대상이 될 수 없다 - 규칙을 적으려면 금지된 패턴의 이름을 적어야 한다.
set -euo pipefail

cd "$(dirname "$0")/.."

GATE_BACKEND_URL='https://gate-check.invalid'

echo "=== [1/13] typecheck ==="
BACKEND_URL="$GATE_BACKEND_URL" pnpm types:routes
pnpm typecheck

echo "=== [2/13] lint ==="
pnpm lint

echo "=== [3/13] format ==="
pnpm format:check

# package.json 의 스크립트 이름이 secretlint 이면 node_modules/.bin/secretlint 를 가려서 [9] 의
# expo-doctor 가 package.json 검사에서 실패한다 - 그래서 스크립트 이름은 lint:secrets 다.
echo "=== [4/13] secretlint ==="
pnpm lint:secrets

echo "=== [5/13] 인용 ==="
./scripts/check-citations.sh app components lib platform queries test

echo "=== [6/13] 복사 출처 ==="
node scripts/check-provenance.mjs

echo "=== [7/13] unit ==="
pnpm test

echo "=== [8/13] 설정 ==="
for variant in development preview production e2e; do
  echo "--- APP_VARIANT=$variant"
  APP_VARIANT="$variant" BACKEND_URL="$GATE_BACKEND_URL" pnpm exec expo config --type public --json >/dev/null
done

echo "=== [9/13] 의존성 호환 ==="
BACKEND_URL="$GATE_BACKEND_URL" pnpm exec expo-doctor

# 이 개발 머신(Windows)에서 캐시를 둔 expo export 는 대개 결과를 다 쓴 뒤 종료할 때 간헐적으로
# 0xC0000005(Git Bash 에서는 139)로 죽었고 --clear 를 주면 죽지 않았다(실측 기록의 M1 관찰 8: 26회 중
# 13회, 10회 중 0회). 그래서 준다.
echo "=== [10/13] 번들 ==="
APP_VARIANT=production BACKEND_URL="$GATE_BACKEND_URL" pnpm exec expo export --clear --platform android --platform ios --output-dir dist

# 세 프로파일 전부를 정적 검증한다 - 프로파일을 안 주면 프로파일이 붙은 서비스 아홉이
# 활성 집합에서 빠져 한 번도 검증되지 않는다(원본 저장소의 실측). 이 단계는 YAML 문법·
# 참조 무결성·프로파일 소속까지만 본다 - 빌드 컨텍스트가 실재하는지는 보지 않는다.
echo "=== [11/13] compose ==="
pnpm compose:verify

# 자원 선언(lib/resources)이 백엔드의 계약과 같은지 실제 FastAPI 스택에 HTTP 로 맞댄다(스펙 11.2). 이 저장소의
# compose 프로젝트만 띄우고 내린다.
echo "=== [12/13] 계약 거울 ==="
./test/contract/run.sh

# 앱의 흐름을 실제 기기와 실제 백엔드로 잰다(스펙 11.3). 이 저장소의 compose 프로젝트만 띄우고
# 내린다. E2E_FLOW 로 일부만 도는 것은 개발용이다 - 게이트는 언제나 전부 돈다.
echo "=== [13/13] E2E ==="
env -u E2E_FLOW ./test/e2e/run-android.sh

echo "=== 전부 통과 ==="
```

```bash
bash -n scripts/check.sh && echo "syntax ok"
grep -n '^echo "=== \[' scripts/check.sh | tail -n 3
git ls-files -s scripts/check.sh
```

Expected: `syntax ok`, `[11/13] compose`·`[12/13] 계약 거울`·`[13/13] E2E` 세 줄, 모드 `100755`(Write 도구는 모드를 바꾸지 않는다 - 바뀌었으면 `git update-index --chmod=+x scripts/check.sh`).

- [ ] **Step 6: 게이트 번호를 옮길 자리를 고친다**

`test/unit/scripts/check-citations.test.ts` — Edit, 찾을 것 `게이트 [5/12] 의 몸통이다.` — 바꿀 것 `게이트 [5/13] 의 몸통이다.`

같은 파일에 Edit, 찾을 것 `금지 인용을 리터럴로 적으면 이 파일이 [5/12] 에 걸린다.` — 바꿀 것 `금지 인용을 리터럴로 적으면 이 파일이 [5/13] 에 걸린다.`

같은 파일에 Edit, 찾을 것:

```ts
 * 게이트가 `[5/12]` 에서 넘기는 대상 여섯.
```

바꿀 것:

```ts
 * 게이트가 `[5/13]` 에서 넘기는 대상 여섯.
```

같은 파일에 Edit, 찾을 것:

```ts
 * `scripts/check.sh` 의 `[5/12]` 호출에 실제로 적힌 인자들.
```

바꿀 것:

```ts
 * `scripts/check.sh` 의 `[5/13]` 호출에 실제로 적힌 인자들.
```

`lib/config/AGENTS.md` — Edit, 찾을 것 `게이트 [8/12]이 그것을 잡는다.` — 바꿀 것 `게이트 [8/13]이 그것을 잡는다.`

`.maestro-output/d5-provenance-gate.cjs` 를 만든다:

```js
const fs = require('node:fs')
const file = 'docs/provenance/copied-core.json'
const record = JSON.parse(fs.readFileSync(file, 'utf8'))
const OLD_NOTE = '(이 저장소의 게이트에서는 [5/12])'
if (record.note.split(OLD_NOTE).length !== 2) throw new Error(`note 에 ${OLD_NOTE} 가 한 번 있어야 한다`)
record.note = record.note.replace(OLD_NOTE, '(이 저장소의 게이트에서는 [5/13])')
const CITATIONS_TEST = 'test/unit/scripts/check-citations.test.ts'
const OLD_WHAT = '이 저장소의 [5/12] 로 바꿨다.'
const matches = record.divergences.filter(
  (divergence) => divergence.path === CITATIONS_TEST && divergence.what.includes(OLD_WHAT),
)
if (matches.length !== 1) throw new Error(`${CITATIONS_TEST} 의 [5/12] 이탈이 하나여야 한다: ${matches.length}`)
matches[0].what = matches[0].what.replace(OLD_WHAT, '이 저장소의 [5/13] 로 바꿨다.')
fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`)
console.log(`경로 ${record.paths.length}개, 이탈 ${record.divergences.length}건`)
```

```bash
node .maestro-output/d5-provenance-gate.cjs
node scripts/check-provenance.mjs
grep -rn "5/12\]\|8/12\]\|12/12\]" scripts test lib AGENTS.md docs/provenance || echo "옛 번호 없음"
```

Expected: `경로 52개, 이탈 40건`, `복사 출처 기록 통과: 경로 52개, 이탈 40건, 원본 그대로 32개`(수는 Task 1 뒤와 같다 - 문장만 고친다), `옛 번호 없음`.

- [ ] **Step 7: 문서와 스펙 정정을 쓴다**

`test/contract/AGENTS.md` 를 만든다:

````markdown
# test/contract/ 작업 지침

계약 거울이 산다(스펙 11.2) - 손으로 옮긴 자원 선언(`lib/resources/*.ts`)을 실제 백엔드에 HTTP 로 맞대는
vitest 다. 게이트의 `[12/13]` 이 `run.sh` 하나로 돈다.

| 파일             | 역할                                                                                     |
| ---------------- | ---------------------------------------------------------------------------------------- |
| `run.sh`         | FastAPI 스택을 띄우고 `pnpm test:contract` 를 돈 뒤 내린다(실패해도 내린다)              |
| `mirror.test.ts` | 검사 넷 - 조회 정책 양방향·응답 속성 키·속성 제약(`examples`, 로그인 뒤)·enum 값의 실재  |
| `backend.ts`     | 백엔드에 닿는 자리 - `fetch` 로 원본 응답(상태·파싱한 본문)을 받는다. 가입·로그인 도우미 |

- 프로브와 속성 키는 복사한 `lib/resources/mirror.ts` 가 계산한다 - 이 디렉터리는 그것을 보내고 맞대기만 한다.
  새 자원은 `lib/resources/index.ts` 의 `RESOURCES` 에 더하면 ①·②·④ 가 저절로 잰다. ③ 은 쓰기 라우트가 있는
  `examples` 에만 있다.
- 앱의 API 클라이언트(`request()`)를 쓰지 않는다 - 재는 것은 선언과 백엔드의 관계이지 앱의 클라이언트가 아니다.
- 모든 기대값은 선언에서 읽는다(`maxLength`·`min`·`max`·enum 값) - 상수로 박으면 선언을 바꾸는 뮤턴트가 산다.
- 오류는 `code`·`source` 만 본다 - 문구는 세 백엔드가 갈린다.
- 단위 시험(`pnpm test`)은 이 디렉터리를 돌지 않는다(`vitest.config.mjs` 의 `include`). 이 디렉터리는
  `vitest.contract.config.mjs` 로만 돈다.

## 돌리기

```bash
./test/contract/run.sh                                                # 스택을 띄우고 돈다(게이트 [12/13])
CONTRACT_API_URL=http://127.0.0.1:4100 pnpm test:contract           # 이미 떠 있는 스택에 - 개발용
```

| 변수               | 뜻                                                                                                    |
| ------------------ | ----------------------------------------------------------------------------------------------------- |
| `E2E_API_PORT`     | 백엔드를 여는 호스트 포트(기본 4100, `docker-compose.e2e.yml`·E2E 하네스와 같다) - `run.sh` 가 읽는다 |
| `CONTRACT_API_URL` | 호스트에서 백엔드에 닿는 주소 - `run.sh` 가 준다. 없으면 시험이 곧바로 그 사실을 알리고 실패한다      |

스택은 E2E 와 같은 compose 프로젝트(`template-typescript-expo-e2e`)이고 그 프로젝트만 띄우고 내린다. access
token 수명은 백엔드 기본값(900초)이다 - E2E 하네스가 주는 10초(`E2E_ACCESS_EXPIRES_SECONDS`)를 쓰지 않는다.
````

`lib/resources/AGENTS.md` — Edit(`## 선언은 데이터다` 절), 찾을 것:

```markdown
반드시 어긋나므로 계약 거울 테스트(스펙 11.2)가 양방향으로 잡게 되어 있다. 그 HTTP
테스트(`test/contract/`)는 아직 없다 - 지금의 `test/unit/resources/mirror.test.ts`는
프로브가 만들어지는 구조만 고정하고, 선언과 백엔드의 어긋남은 잡지 못한다.
```

바꿀 것:

```markdown
반드시 어긋나므로 계약 거울(스펙 11.2)이 실제 백엔드에 HTTP 로 맞대어 양방향으로 잡는다 - 게이트
`[12/13]` 의 `test/contract/mirror.test.ts` 다. `RESOURCES` 에 더한 자원은 조회 정책·응답 속성 키·enum 값을
저절로 잰다(속성 제약은 쓰기 라우트가 있는 `examples` 에만 있다). `test/unit/resources/mirror.test.ts` 는
프로브가 만들어지는 구조를 고정한다.
```

`AGENTS.md` — Edit, 찾을 것 `복사 출처 · unit · 설정 · 의존성 호환 · 번들 · compose · E2E).` — 바꿀 것 `복사 출처 · unit · 설정 · 의존성 호환 · 번들 · compose · 계약 거울 · E2E).`

같은 파일에 Edit, 찾을 것:

```markdown
`git ls-tree HEAD scripts/ test/e2e/`에서
```

바꿀 것:

```markdown
`git ls-tree HEAD scripts/ test/e2e/ test/contract/`에서
```

같은 파일에 Edit, 찾을 것:

```markdown
`test/e2e/guard-log.sh` 다섯이 `100755`인지
```

바꿀 것:

```markdown
`test/e2e/guard-log.sh`·`test/contract/run.sh` 여섯이 `100755`인지
```

같은 파일에 Edit, 찾을 것:

```markdown
E2E 플로를 쓰는 규칙과 하네스의 환경 변수는 `test/e2e/AGENTS.md`에 있다.
```

바꿀 것:

```markdown
E2E 플로를 쓰는 규칙과 하네스의 환경 변수는 `test/e2e/AGENTS.md`에, 계약 거울의 규칙과 돌리는 법은
`test/contract/AGENTS.md`에 있다.
```

스펙 — `### 11.3 E2E — Maestro` 바로 앞에 더한다:

```markdown
> 정정(2026-10-01, D5): 계약 거울은 `test/contract/mirror.test.ts` 다. 게이트 `[12/13]` 의 `test/contract/run.sh` 가
> FastAPI 스택을 띄워 `pnpm test:contract`(`vitest.contract.config.mjs` - 단위 시험과 설정이 따로다)로 돌리고 내린다.
> 앱의 API 클라이언트를 지나지 않고 `fetch` 로 원본 응답을 받는다(`test/contract/backend.ts`, 주소는
> `CONTRACT_API_URL`). 1 의 정렬도 양방향이다 - 선언에 없는 정렬은 `INVALID_SORT`(복사한 `mirror.ts` 가 원본의
> 판정대로 넓혀 두었다). 3 은 선언된 제약을 넘긴 값만 보내 행을 만들지 않는다 - 선언이 백엔드보다 좁은 쪽
> (`maxLength` 를 줄이면 백엔드가 그 값을 받는다)을 잡고, 넓은 쪽은 잡지 못한다(원본과 같다). 한 번 가입·로그인한
> 토큰으로 잰다 - access 수명은 백엔드 기본값이다(E2E 하네스의 10초를 쓰지 않는다).
```

스펙 — `## 13. CI (GitHub Actions)` 바로 앞에 더한다:

```markdown
> 정정(2026-10-01, D5): 게이트가 13단계가 됐다 - 계약 거울이 `[12/13]`(`test/contract/run.sh`), E2E 가 `[13/13]` 이다.
> 두 단계는 같은 compose 프로젝트(`template-typescript-expo-e2e`)를 각자 띄우고 내린다 - 거울은 백엔드 기본 access
> 수명으로, E2E 는 10초(11.3 의 D4 정정)로 띄우므로 스택을 나눠 쓰지 않는다. 거울은 기기가 없어도 돌아 E2E 의 APK
> 빌드 전에 선언의 어긋남을 알린다.
```

- [ ] **Step 8: 검사하고 커밋한다**

```bash
pnpm format
pnpm typecheck && pnpm lint && pnpm format:check && ./scripts/check-citations.sh app components lib platform queries test && node scripts/check-provenance.mjs | tail -n 1
pnpm test 2>&1 | grep -E "Test Files|Tests "
git status --short
git add test/contract vitest.contract.config.mjs package.json scripts/check.sh test/unit/scripts/check-citations.test.ts lib/config/AGENTS.md lib/resources/AGENTS.md AGENTS.md docs/provenance/copied-core.json docs/superpowers/specs
git commit -m "test: 자원 선언을 실제 백엔드에 맞대는 계약 거울을 더하고 게이트의 E2E 앞 [12/13] 단계로 붙인다"
git ls-tree HEAD scripts/ test/e2e/ test/contract/ | grep -E "\.sh$"
```

Expected: 검사 전부 exit 0, `67 passed`·`1521 passed`(인용 시험이 `check.sh` 의 `[5/13]` 인자와 대상 목록을 맞댄다), 커밋 뒤 남은 파일이 없다, `.sh` 여섯이 모두 `100755`(`scripts/check.sh`·`scripts/check-citations.sh`·`test/e2e/android.sh`·`test/e2e/guard-log.sh`·`test/e2e/run-android.sh`·`test/contract/run.sh`) - 빠진 것은 `git update-index --chmod=+x <파일>` 뒤 커밋을 고친다(`git commit --amend --no-edit`).

---

### Task 3: 계약 실험실 화면 — `queries/lab.ts`, `components/lab/`, `app/(lab)/contract.tsx`, 홈 진입

**Files:**
- Create: `queries/lab.ts`, `test/unit/queries/lab.test.ts`, `components/lab/experiment-card.tsx`, `app/(lab)/contract.tsx`
- Modify: `app/(app)/index.tsx`(홈의 실험실 진입), `platform/query-client.ts`(주석), `platform/AGENTS.md`, `queries/AGENTS.md`, `AGENTS.md`, 스펙(8.6 정정)

**Interfaces:**
- Consumes: Task 1 의 `runExperiment`·`LabDeps`·`LabOutcome`·`PROBE_LAB_EXAMPLE_ID`(`lib/lab/run.ts`), `EXPERIMENTS`·`Experiment`(`lib/lab/experiments.ts`), `ExperimentResult`·`parseCombinedSteps`(`lib/lab/result.ts`), `apiRequest`·`deviceAcceptLanguage`(`platform/api.ts`); D4 의 `isSessionRejected`(`lib/resources/write.ts`)·`useSubmitOnce`(`queries/submit-once.ts`)·`useNavigateOnce`(`components/app/navigate-once.ts`)·쓰기 캐시의 `onError`(세션 거절이면 `signOut`)·`sessionManager.current`; D2 의 `sessionManager.getAccessToken`, `loginHref`, `SubmitButton`, `FormBanner`, `UNUSABLE_RESPONSE_MESSAGE`(`lib/auth/form-state.ts`); TanStack Query 의 `mutationOptions`·`MutationObserver`·`shouldThrowError`.
- Produces: 라우트 `/contract`(testID `lab-screen`, 제목 "계약 실험실"), 홈의 `home-lab-link`. 실험마다 testID - `lab-card-<id>`, `lab-session-note-<id>`(세션이 필요한 셋), `lab-run-<id>`, `lab-result-<id>`, `lab-request-<id>`, `lab-status-<id>`, `lab-header-<id>-<헤더 이름>`, `lab-sent-body-<id>`, 여러 단계면 `lab-step-heading-<id>-<n>`·`lab-step-body-<id>-<n>`(0부터), 한 단계면 `lab-body-<id>`, 맺음말 `lab-note-<id>`. `queries/lab.ts`: `labExperimentMutationOptions(id: string)`(키 `['lab', id]`, `throwOnError: (error) => !isSessionRejected(error)`), `useLabExperiment(id: string): LabExperiment { mutationKey; result: ExperimentResult | null; pending; failed(요청 없이 끝났다 - `unusable`); run(onSessionRejected: () => void) }`.

- [ ] **Step 1: 훅의 옵션 시험을 먼저 쓴다**

훅 자체는 시험하지 않는다(스펙 11.1) - 훅이 `useMutation` 에 넘기는 옵션을 D4 의 `test/unit/queries/writes.test.ts` 처럼 MutationObserver 로 그대로 돌린다(결정 27). 세션 관리자와 API 클라이언트만 가짜다.

`test/unit/queries/lab.test.ts` 를 만든다:

```ts
import { MutationObserver, QueryClient, shouldThrowError } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { JsonApiResult, RequestOptions } from '@/lib/jsonapi/client'
import { PROBE_LAB_EXAMPLE_ID } from '@/lib/lab/run'
import { EXAMPLE } from '@/lib/resources'
import { isSessionRejected } from '@/lib/resources/write'
import { labExperimentMutationOptions } from '@/queries/lab'

/**
 * 실험 하나의 쓰기 옵션(queries/lab.ts) - 훅과 시험이 함께 쓴다. TanStack Query 의 MutationObserver 로 그대로 돌려
 * 두 가지를 잰다: 던져진 것이 오류 경계로 가는지(`throwOnError`)와 훅이 꽂는 세션 관리자·API 클라이언트·기기 언어의
 * 배선(`LAB_DEPS`). 훅 자체는 시험하지 않는다(스펙 11.1) - 훅은 이 옵션을 `useMutation` 에 넘길 뿐이다.
 *
 * 세션 관리자와 API 클라이언트만 가짜다 - 실행부(lib/lab/run.ts)·쓰기의 토큰 길(lib/resources/write.ts)과 Query
 * 캐시는 진짜다. 실험마다의 갈래는 test/unit/lab/run.test.ts 가 잰다.
 */
const mocks = vi.hoisted(() => ({
  send: vi.fn<(path: string, options?: RequestOptions) => Promise<JsonApiResult<unknown>>>(),
  language: vi.fn<() => string | null>(),
  getAccessToken: vi.fn<() => Promise<string | null>>(),
  current: vi.fn<() => { accessExpiresAt: number } | null>(),
}))

vi.mock('@/platform/api', () => ({ apiRequest: mocks.send, deviceAcceptLanguage: mocks.language }))
vi.mock('@/platform/session', () => ({
  sessionManager: { getAccessToken: mocks.getAccessToken, current: mocks.current },
}))

const TOKEN = 'probe-access'
const LANGUAGE = 'probe-lang'

let client: QueryClient

beforeEach(() => {
  client = new QueryClient()
  mocks.send.mockReset().mockResolvedValue({ ok: true, status: 201, document: { data: null } })
  mocks.language.mockReset().mockReturnValue(LANGUAGE)
  mocks.getAccessToken.mockReset().mockResolvedValue(TOKEN)
  mocks.current.mockReset().mockReturnValue({ accessExpiresAt: Date.now() + 900_000 })
})

afterEach(() => {
  client.clear()
  vi.restoreAllMocks()
})

/** 실험 하나를 돌려, 상태와 결과와 오류와 "훅이 이 오류를 렌더 중에 다시 던지는가" 를 돌려준다. */
async function run(id: string) {
  const observer = new MutationObserver(client, labExperimentMutationOptions(id))
  await observer.mutate().catch(() => undefined)
  const { status, error, data } = observer.getCurrentResult()
  // `useMutation` 이 렌더 중에 하는 판단 그대로다 - 거짓이면 오류는 `mutate()` 가 삼킨다.
  const surfaced = error !== null && shouldThrowError(observer.options.throwOnError, [error])
  return { status, error, data, surfaced }
}

describe('실험의 throwOnError - 결함만 오류 경계로 간다', () => {
  it('세션 거절이 아닌 예외는 결함이다 - 오류 경계로 간다', async () => {
    mocks.send.mockRejectedValue(new Error('probe-defect'))

    const { status, error, surfaced } = await run('invalidFilter')

    expect(status).toBe('error')
    expect(error?.message).toBe('probe-defect')
    expect(surfaced).toBe(true)
  })

  it('세션 거절은 오류 경계로 가지 않는다 - 쓰기 캐시의 onError 와 화면의 콜백이 받는다', async () => {
    mocks.getAccessToken.mockResolvedValue(null)

    const { status, error, surfaced } = await run('putUpsert')

    expect(status).toBe('error')
    expect(isSessionRejected(error)).toBe(true)
    expect(surfaced).toBe(false)
    expect(mocks.send).not.toHaveBeenCalled()
  })
})

describe('배선 - 세션 관리자·API 클라이언트·기기 언어', () => {
  it('세션 관리자의 토큰과 기기 언어를 실어 보내고 결과를 돌려준다 - 키는 실험마다 다르다', async () => {
    const { status, data } = await run('putUpsert')

    expect(status).toBe('success')
    expect(data?.kind).toBe('result')
    expect(mocks.send).toHaveBeenCalledTimes(1)
    expect(mocks.send.mock.calls[0]?.[0]).toBe(`${EXAMPLE.path}/${PROBE_LAB_EXAMPLE_ID}`)
    expect(mocks.send.mock.calls[0]?.[1]).toMatchObject({
      method: 'PUT',
      accessToken: TOKEN,
      acceptLanguage: LANGUAGE,
    })
    expect(labExperimentMutationOptions('putUpsert').mutationKey).toEqual(['lab', 'putUpsert'])
  })

  it('세션 관리자의 지금 세션이 이미 만료됐으면 보내지 않는다 - unusable 이고 오류가 아니다(만료 가드)', async () => {
    mocks.current.mockReturnValue({ accessExpiresAt: Date.now() - 1 })

    const { status, data, surfaced } = await run('putUpsert')

    expect(status).toBe('success')
    expect(data).toEqual({ kind: 'unusable' })
    expect(surfaced).toBe(false)
    expect(mocks.send).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 시험이 실패하는지 본다**

```bash
pnpm exec vitest run test/unit/queries/lab.test.ts 2>&1 | grep -E "FAIL|Cannot find package|Test Files|Tests "
```

Expected: `Error: Cannot find package '@/queries/lab' …` 로 파일이 실패한다 - `Test Files  1 failed (1)`, `Tests  no tests`.

- [ ] **Step 3: 실험 하나의 쓰기 훅을 쓴다**

`queries/lab.ts` 를 만든다:

```ts
import { mutationOptions, useMutation, type MutationKey } from '@tanstack/react-query'

import type { ExperimentResult } from '@/lib/lab/result'
import { runExperiment, type LabDeps } from '@/lib/lab/run'
import { isSessionRejected } from '@/lib/resources/write'
import { apiRequest, deviceAcceptLanguage } from '@/platform/api'
import { sessionManager } from '@/platform/session'

/**
 * 계약 실험실의 실험 하나를 돌리는 쓰기 훅(스펙 8.6).
 *
 * 실험마다 무엇을 보내고 응답을 어떻게 결과로 옮기는지는 `lib/lab/run.ts` 가 정한다. 여기서는 그 함수에 API
 * 클라이언트·세션 관리자·기기 언어를 꽂기만 한다. 결과는 캐시에 두지 않는다 - 조회가 아니라 누를 때마다 새로
 * 부르는 실험이라 쓰기(`useMutation`)의 결과로 들고, 화면을 떠나면 사라진다. 훅이 쓰는 옵션
 * (`labExperimentMutationOptions`)은 내보낸다 - 시험(test/unit/queries/lab.test.ts)이 MutationObserver 로 그대로 돌린다.
 *
 * - access token 은 쓰기와 같은 길로 받는다 - 세션 관리자의 토큰에 더해 지금의 세션(`current`)과 시계를 꽂는다.
 *   회전이 판정을 받지 못해 돌아온 토큰이 이미 만료됐거나 토큰을 받지 못했으면 실행부가 보내지 않고(만료 가드)
 *   카드가 앱 문구를 그린다(`failed`).
 * - 세션 거절(세션이 없거나 백엔드가 세션을 거절했다)은 쓰기 캐시(`MutationCache`)의 `onError` 한 곳이 받아 기기
 *   세션을 지운다(`platform/query-client.ts`, 스펙 9.2). 로그인으로 보내는 것은 화면이 넘긴 콜백이다 - 실험실은
 *   공개 경로라 경로 가드가 보내지 않는다(스펙 7.3).
 * - 세션 거절 말고 던져진 것은 결함이다 - 실행부는 응답을 전부 결과로 옮긴다(`apiRequest` 는 던지지 않고, 설정
 *   오류만 일부러 던진다 - `queries/AGENTS.md`). 결함은 훅이 렌더 중에 다시 던져 오류 경계로 보낸다(`throwOnError`,
 *   자원의 쓰기 훅과 같다). 던지지 않으면 `mutate()` 가 삼켜 카드가 아무 말 없이 멈춘다.
 * - 쓰기마다 키가 있다(`['lab', <실험 id>]`) - 화면이 그 키로 한 번에 하나만 돌린다(`queries/submit-once.ts`).
 */
const LAB_DEPS: LabDeps = {
  send: apiRequest,
  getAccessToken: sessionManager.getAccessToken,
  currentSession: sessionManager.current,
  now: () => Date.now(),
  deviceLanguage: deviceAcceptLanguage,
}

/** 실험 카드가 쓰는 것. */
export interface LabExperiment {
  /** 이 실험의 쓰기 키 - 카드가 한 번에 하나만 돌린다(useSubmitOnce). */
  mutationKey: MutationKey
  /** 마지막으로 끝난 실행의 결과. 돌리기 전이거나 도는 중이거나 결과 없이 끝났으면 null 이다. */
  result: ExperimentResult | null
  /** 도는 중 - 실행 버튼이 스피너만 그린다(스펙 8.7). */
  pending: boolean
  /** 받은 토큰을 쓸 수 없어 요청하지 않고 끝났다(만료 가드·토큰을 받지 못함) - 카드가 앱 문구를 그린다. */
  failed: boolean
  /** 실험을 돌린다. 세션 거절로 끝나면 `onSessionRejected` 를 부른다(화면이 로그인으로 보낸다). */
  run: (onSessionRejected: () => void) => void
}

/** 실험 하나의 쓰기 옵션 - 결과를 캐시에 옮기지 않는다. 세션 거절이 아닌 예외는 오류 경계로 간다. */
export function labExperimentMutationOptions(id: string) {
  return mutationOptions({
    mutationKey: ['lab', id],
    mutationFn: () => runExperiment(id, LAB_DEPS),
    throwOnError: (error) => !isSessionRejected(error),
  })
}

/** `lib/lab/experiments.ts` 의 실험 하나. */
export function useLabExperiment(id: string): LabExperiment {
  const options = labExperimentMutationOptions(id)
  const mutation = useMutation(options)

  return {
    mutationKey: options.mutationKey,
    result: mutation.data?.kind === 'result' ? mutation.data.result : null,
    pending: mutation.isPending,
    failed: mutation.data?.kind === 'unusable',
    run: (onSessionRejected) => {
      mutation.mutate(undefined, {
        onError: (error) => {
          if (isSessionRejected(error)) onSessionRejected()
        },
      })
    },
  }
}
```

- [ ] **Step 4: 시험이 통과하는지 본다**

```bash
pnpm exec vitest run test/unit/queries/lab.test.ts 2>&1 | grep -E "Test Files|Tests "
```

Expected: `Test Files  1 passed (1)`, `Tests  4 passed (4)`.

- [ ] **Step 5: 실험 카드를 쓴다**

`components/lab/experiment-card.tsx` 를 만든다:

```tsx
import { Platform, View } from 'react-native'

import { FormBanner } from '@/components/form/form-banner'
import { SubmitButton } from '@/components/form/submit-button'
import { Text } from '@/components/ui/text'
import { UNUSABLE_RESPONSE_MESSAGE } from '@/lib/auth/form-state'
import type { Experiment } from '@/lib/lab/experiments'
import { parseCombinedSteps, type ExperimentResult } from '@/lib/lab/result'

/**
 * 원본 응답을 그리는 고정폭 글꼴. Tailwind 의 `font-mono` 는 여러 글꼴을 쉼표로 이은 CSS 목록이라 네이티브의
 * fontFamily 가 될 수 없다 - 플랫폼마다 있는 이름 하나를 고른다(AGENTS.md: 플랫폼마다 다른 스타일은
 * Platform.select).
 */
const MONOSPACE = Platform.select({ ios: 'Menlo', default: 'monospace' })

/**
 * 계약 실험실의 실험 하나 - 설명, 세션 안내, 실행 버튼, 결과(스펙 8.6).
 *
 * 세션이 필요한 실험도 버튼을 숨기지 않는다 - 로그인하지 않은 채 누르면 로그인으로 가는 것이 이 화면이
 * 실증하는 계약의 일부다(스펙 7.3). 누르기 전에 그렇게 된다는 것을 문구로 알린다.
 *
 * testID 는 E2E 플로(test/e2e/flows/contract-lab-*.yaml)가 찾는 이름이다 - 끝에 실험 id 가 붙는다.
 */
export function ExperimentCard({
  experiment,
  result,
  pending,
  failed,
  onRun,
}: {
  experiment: Experiment
  result: ExperimentResult | null
  pending: boolean
  failed: boolean
  onRun: () => void
}) {
  return (
    <View
      testID={`lab-card-${experiment.id}`}
      className="gap-3 rounded-lg border border-border p-4"
    >
      <View className="gap-1">
        <Text variant="large">{experiment.title}</Text>
        <Text className="text-sm text-muted-foreground">{experiment.proves}</Text>
      </View>
      {experiment.needsSession ? (
        <Text
          testID={`lab-session-note-${experiment.id}`}
          className="text-sm text-muted-foreground"
        >
          로그인이 필요합니다. 로그인하지 않은 채 누르면 로그인 화면으로 이동합니다.
        </Text>
      ) : null}
      <SubmitButton
        testID={`lab-run-${experiment.id}`}
        label={`${experiment.title} 실행`}
        pending={pending}
        onPress={onRun}
      />
      {failed ? <FormBanner messages={[UNUSABLE_RESPONSE_MESSAGE]} /> : null}
      {result === null ? null : <ResultView id={experiment.id} result={result} />}
    </View>
  )
}

/**
 * 결과 - 요청·상태·보낸 요청 헤더·보낸 본문·응답 본문. 판단은 `lib/lab/` 가 끝냈고 여기서는 옮겨 그리기만 한다.
 *
 * 헤더는 응답 헤더가 아니라 이 실험실이 보낸 요청 헤더다(`authorization` 은 값을 가린다 - `result.ts`). 응답
 * 본문은 파싱한 뒤 다시 직렬화한 JSON 이라 키 순서와 공백이 원본과 다를 수 있다 - 그 사실을 화면에 적는다.
 * 여러 단계인 실험은 `parseCombinedSteps` 로 단계마다 머리글과 본문을 갈라 그린다 - 본문 칸에는 백엔드가 준
 * 것만 있어서 E2E 가 단계의 본문끼리 비교할 수 있다(원본 E2E 가 이 파서를 쓴 이유와 같다).
 */
function ResultView({ id, result }: { id: string; result: ExperimentResult }) {
  const headers = Object.entries(result.headers)
  const { steps, note } = parseCombinedSteps(result.body)

  return (
    <View
      testID={`lab-result-${id}`}
      className="gap-3 rounded-md border border-border bg-muted p-3"
    >
      <View className="gap-1">
        <Text className="text-xs font-medium text-muted-foreground">요청</Text>
        <Text testID={`lab-request-${id}`} className="text-xs" style={{ fontFamily: MONOSPACE }}>
          {`${result.request.method} ${result.request.path}`}
        </Text>
        <Text className="text-xs font-medium text-muted-foreground">상태</Text>
        <Text testID={`lab-status-${id}`} className="text-xs" style={{ fontFamily: MONOSPACE }}>
          {String(result.status)}
        </Text>
      </View>

      {headers.length === 0 ? null : (
        <View className="gap-1">
          <Text className="text-xs font-medium text-muted-foreground">보낸 요청 헤더</Text>
          {headers.map(([name, value]) => (
            <Text
              key={name}
              testID={`lab-header-${id}-${name}`}
              className="text-xs"
              style={{ fontFamily: MONOSPACE }}
            >
              {`${name}: ${value}`}
            </Text>
          ))}
        </View>
      )}

      {result.request.body === undefined ? null : (
        <View className="gap-1">
          <Text className="text-xs font-medium text-muted-foreground">보낸 본문</Text>
          <Text
            testID={`lab-sent-body-${id}`}
            className="text-xs"
            style={{ fontFamily: MONOSPACE }}
          >
            {result.request.body}
          </Text>
        </View>
      )}

      <View className="gap-2">
        <Text className="text-xs font-medium text-muted-foreground">
          응답 본문 — 파싱 후 다시 직렬화한 값이다. 키 순서와 공백은 원본과 다를 수 있다.
        </Text>
        {steps.length === 0 ? (
          <Text testID={`lab-body-${id}`} className="text-xs" style={{ fontFamily: MONOSPACE }}>
            {result.body}
          </Text>
        ) : (
          steps.map((step, index) => (
            <View key={step.heading} className="gap-1">
              <Text
                testID={`lab-step-heading-${id}-${index}`}
                className="text-xs font-semibold"
                style={{ fontFamily: MONOSPACE }}
              >
                {step.heading}
              </Text>
              <Text
                testID={`lab-step-body-${id}-${index}`}
                className="text-xs"
                style={{ fontFamily: MONOSPACE }}
              >
                {step.body}
              </Text>
            </View>
          ))
        )}
        {note === undefined ? null : (
          <Text testID={`lab-note-${id}`} className="text-xs text-muted-foreground">
            {note}
          </Text>
        )}
      </View>
    </View>
  )
}
```

- [ ] **Step 6: 실험실 화면과 홈 진입을 쓴다**

`app/(lab)/contract.tsx` 를 만든다:

```tsx
import { Stack, router, usePathname, type Href } from 'expo-router'
import { ScrollView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useNavigateOnce } from '@/components/app/navigate-once'
import { ExperimentCard } from '@/components/lab/experiment-card'
import { Text } from '@/components/ui/text'
import { loginHref } from '@/lib/auth/protected-paths'
import { EXPERIMENTS, type Experiment } from '@/lib/lab/experiments'
import { useLabExperiment } from '@/queries/lab'
import { useSubmitOnce } from '@/queries/submit-once'

/** 본문의 여백(`p-4`). 아래쪽에는 시스템 막대의 높이가 더해진다. */
const CONTENT_PADDING = 16

/**
 * 계약 실험실 - 스펙 8.6. 실무 화면이 쓰지 않는 여섯 백엔드 표면을 모으고, 각 실험이 원본 JSON 응답을 그대로
 * 보인다. 무엇을 실증하는지는 `lib/lab/experiments.ts`, 무엇을 부르는지는 `lib/lab/run.ts`, 어떻게 그리는지는
 * `components/lab/experiment-card.tsx` 다. 이 파일에는 훅 호출과 JSX 만 있다(스펙 8.4).
 *
 * 공개 경로다 - 로그인 여부와 무관하게 같은 화면이다(스펙 7.3). 세션이 필요한 실험을 로그인하지 않은 채
 * 누르면 로그인으로 보내고(`next` 는 이 화면), 로그인하면 돌아온다. 경로 가드는 보호 경로만 보므로 그 이동은
 * 여기서 한다. 기기 세션을 지우는 것은 쓰기 캐시(`MutationCache`)의 `onError` 다(`platform/query-client.ts`).
 * 로그인 화면을 쌓는 이동은 화면에 하나인 가드를 지난다(`useNavigateOnce`) - 세션이 필요한 실험 둘이 잇달아
 * 거절돼도 로그인 화면은 하나다. 이 화면이 다시 앞에 오면 풀린다.
 *
 * 실험마다 따로 도는 쓰기가 있다(`ExperimentRunner`) - 하나를 눌러도 다른 결과가 사라지지 않는다. 훅을 반복문
 * 안에서 부르지 않도록 실험마다 컴포넌트를 둔다.
 */
export default function ContractLabScreen() {
  const insets = useSafeAreaInsets()
  const pathname = usePathname()
  const navigateOnce = useNavigateOnce()
  const toLogin = () => {
    navigateOnce(() => {
      // loginHref 는 런타임에 만든 앱 안 경로다 - 타입드 라우트가 모르는 문자열이라 단언한다. 단언은
      // 변수에 담는다(app/(app)/_layout.tsx 와 같은 이유 - 새 체크아웃의 lint).
      const target = loginHref(pathname) as Href
      router.push(target)
    })
  }

  return (
    <>
      <Stack.Screen options={{ title: '계약 실험실' }} />
      <ScrollView
        testID="lab-screen"
        className="flex-1 bg-background"
        contentContainerClassName="gap-6 p-4"
        contentContainerStyle={{ paddingBottom: CONTENT_PADDING + insets.bottom }}
      >
        <Text className="text-sm text-muted-foreground">
          실무 화면이 쓰지 않는 여섯 백엔드 표면을 모았다. 각 버튼은 응답을 가공하지 않고 그대로
          보여 준다.
        </Text>
        {EXPERIMENTS.map((experiment) => (
          <ExperimentRunner
            key={experiment.id}
            experiment={experiment}
            onSessionRejected={toLogin}
          />
        ))}
      </ScrollView>
    </>
  )
}

function ExperimentRunner({
  experiment,
  onSessionRejected,
}: {
  experiment: Experiment
  onSessionRejected: () => void
}) {
  const lab = useLabExperiment(experiment.id)
  const submitOnce = useSubmitOnce(lab.mutationKey)

  return (
    <ExperimentCard
      experiment={experiment}
      result={lab.result}
      pending={lab.pending}
      failed={lab.failed}
      onRun={() => {
        submitOnce(() => {
          lab.run(onSessionRejected)
        })
      }}
    />
  )
}
```

홈의 실험실 진입은 `Link` 가 아니라 `useNavigateOnce` 를 지나는 버튼이다(결정 20). 목록 진입(`Link`)은 그대로 둔다.

`app/(app)/index.tsx` — Edit(홈의 실험실 진입, 결정 20), 찾을 것 `import { Link, Stack } from 'expo-router'` — 바꿀 것 `import { Link, Stack, router } from 'expo-router'`

같은 파일에 Edit, 찾을 것 `import { Button } from '@/components/ui/button'` — 바꿀 것:

```tsx
import { useNavigateOnce } from '@/components/app/navigate-once'
import { Button } from '@/components/ui/button'
```

같은 파일에 Edit, 찾을 것:

```tsx
export default function HomeScreen() {
  return (
```

바꿀 것:

```tsx
export default function HomeScreen() {
  // 실험실을 쌓는 이동은 한 번만 한다 - 빠른 두 번 누름이 실험실을 두 벌 쌓지 않게(components/app/navigate-once.ts).
  const navigateOnce = useNavigateOnce()

  return (
```

같은 파일에 Edit, 찾을 것:

```tsx
          <Text>Example 목록</Text>
        </Button>
      </Link>
```

바꿀 것:

```tsx
          <Text>Example 목록</Text>
        </Button>
      </Link>
      <Button
        testID="home-lab-link"
        variant="outline"
        onPress={() => {
          navigateOnce(() => {
            router.push('/contract')
          })
        }}
      >
        <Text>계약 실험실</Text>
      </Button>
```

`platform/query-client.ts` — Edit, 찾을 것:

```ts
 * 화면은 보호 경로라 지금 경로를 next 로 실어 로그인으로 보낸다. 조회 캐시(QueryCache)에는 두지
```

바꿀 것:

```ts
 * 화면은 보호 경로라 지금 경로를 next 로 실어 로그인으로 보낸다. 계약 실험실(lib/lab/run.ts)도 같은 거절을
 * 던지는데, 실험실은 공개 경로라 그 화면(app/(lab)/contract.tsx)이 로그인으로 보낸다. 조회 캐시(QueryCache)에는 두지
```

- [ ] **Step 7: 타입드 라우트를 만들고 정적 검사를 돈다**

```bash
BACKEND_URL=https://gate-check.invalid pnpm types:routes
grep -c "/contract" .expo/types/router.d.ts
pnpm format
pnpm typecheck && pnpm lint && pnpm format:check && ./scripts/check-citations.sh app components lib platform queries test
pnpm test 2>&1 | grep -E "Test Files|Tests "
```

Expected: 타입드 라우트에 `/contract` 가 있다(1 이상 - 홈의 `router.push('/contract')` 가 그 타입을 쓴다), 검사 전부 exit 0, `68 passed`·`1525 passed`(Task 1 뒤의 수 + 파일 1·시험 4) - `test/unit/ui/breakpoints.test.ts`(미디어 쿼리 변형 없음)와 `route-params-usage.test.ts`(이 화면은 라우트 파라미터를 읽지 않는다)가 새 파일을 훑고 통과한다.

- [ ] **Step 8: 두 플랫폼 번들을 만든다**

이 저장소의 `expo start` 를 끄고 돈다(`--clear` 가 Metro 캐시를 지운다). `TEMP`·`TMP` 는 `.maestro-output/` 안의 따로 만든 디렉터리다(전역 제약 - `pwd -W` 가 Node 에 줄 Windows 경로를 낸다).

```bash
mkdir -p .maestro-output/export-tmp
EXPORT_TMP="$(cd .maestro-output/export-tmp && pwd -W)"
TEMP="$EXPORT_TMP" TMP="$EXPORT_TMP" APP_VARIANT=production BACKEND_URL=https://gate-check.invalid pnpm exec expo export --clear --platform android --platform ios --output-dir dist > .maestro-output/export.log 2>&1; echo "export exit=$?"
grep -E "Bundled|Exported|Unable to resolve|Error" .maestro-output/export.log
pnpm lint:secrets && echo "secretlint ok"
```

Expected: `export exit=0`, `iOS Bundled …`·`Android Bundled …` 두 줄, `Exported: dist`, `Unable to resolve`·`Error` 없음, `secretlint ok`. 괄호 안의 모듈 수는 판정에 쓰지 않는다 - 같은 트리에서도 실행마다 다르다(D1 실측 M5 의 번들 절. 이 계획을 쓰며 같은 커밋을 여섯 번 묶어 Android 1974–2065·iOS 1841–1972 를 봤다). `export exit=139` 면 다시 돌려 덮지 않는다 - `Exported: dist` 가 있으면(출력을 다 쓴 뒤 끝날 때 죽었다) D4 실측의 그 139 다: `tail -n 20 .maestro-output/export.log` 와 함께 기록에 적고 컨트롤러에 알린다(전역 제약).

- [ ] **Step 9: 문서와 스펙 정정을 쓴다**

`platform/AGENTS.md` — Edit(인증 오류 문단), 찾을 것:

```markdown
(`lib/resources/write.ts`)이 던진 세션 거절이면 기기 세션을 지우고, 이동은 경로 가드가 한다.
```

바꿀 것:

```markdown
(`lib/resources/write.ts`)·계약 실험실(`lib/lab/run.ts`)이 던진 세션 거절이면 기기 세션을 지우고, 이동은 경로
  가드가 한다 - 공개 경로인 실험실은 그 화면(`app/(lab)/contract.tsx`)이 로그인으로 보낸다.
```

`queries/AGENTS.md` — Edit(표의 `resources.ts` 행 앞에 행 하나 - 칸 맞춤 공백은 뒤의 `pnpm format` 이 다시 맞춘다), 찾을 것:

```markdown
| `resources.ts`
```

바꿀 것:

```markdown
| `lab.ts` | 계약 실험실의 실험 하나를 돌리는 쓰기 훅(`useLabExperiment`). 판단은 `lib/lab/run.ts` 가 한다 - 결과는 캐시에 두지 않고, 세션 거절이면 화면이 넘긴 콜백이 로그인으로 보낸다. 훅이 쓰는 옵션(`labExperimentMutationOptions`)을 내보낸다 - 시험이 MutationObserver 로 돌린다 |
| `resources.ts`
```

`AGENTS.md` — Edit(계층 표의 `components/resource/` 행 앞에 행 하나 - 칸 맞춤 공백은 뒤의 `pnpm format` 이 다시 맞춘다), 찾을 것:

```markdown
| `components/resource/` |
```

바꿀 것:

```markdown
| `components/lab/` | 계약 실험실의 조각 - 실험 카드와 결과 표시 | 요청, 세션, 자원 이름으로 분기 |
| `components/resource/` |
```

같은 파일에 Edit(표 아래 설명 문단의 끝), 찾을 것:

```markdown
`platform/config.ts`가 한다.
```

바꿀 것:

```markdown
`platform/config.ts`가 한다. `components/lab/`도 스펙의 트리에 없다 - 계약 실험실 화면(`app/(lab)/contract.tsx`)의
조각이 자원 UI 도 폼 조각도 아니어서 따로 뒀다.
```

스펙 — `### 8.7 로딩 표현` 바로 앞에 더한다:

```markdown
> 정정(2026-10-01, D5): 실험실의 모양. (a) 실험 정의(`experiments.ts`)와 결과 표현(`result.ts`)은 원본의
> `app/(lab)/contract/` 에서 `lib/lab/` 로 옮겨 복사했고, 원본의 Server Action(`actions.ts`) 자리는 `lib/lab/run.ts` 다 -
> 전송·토큰·지금의 세션·시계·기기 언어를 주입받아 node 에서 잰다. `lib/lab/` 이 세션을 소유하는 것은 아니다 - 토큰을
> 주는 함수를 받을 뿐이다. 화면은 `app/(lab)/contract.tsx`, 실험 카드는 `components/lab/experiment-card.tsx`, 훅은
> `queries/lab.ts` 다. (b) 세션이 필요한 실험을 로그인하지 않은 채 누르면 요청하지 않고 `/login?next=/contract` 로
> 간다. 실험실은 공개 경로라 경로 가드가 아니라 실험실 화면이 보낸다 - 기기 세션을 지우는 것은 쓰기 캐시의
> `onError` 다(9 의 D4 정정). 백엔드가 세션을 거절해도(9.2 의 코드) 같다. 토큰은 쓰기와 같은 길로 받는다
> (`lib/resources/write.ts` 의 `accessToken`) - 받은 토큰의 세션이 이미 만료됐으면(7.2 의 D4 만료 가드) 요청하지 않고
> 앱 문구를 그린다. 세션 거절 말고 던져진 것은 결함이라 쓰기 훅처럼 오류 경계로 간다. (c) offset 순회는 쪽당
> 3건이고, 페이지 총합은 두 요청 모두 쪽당 1건이다 - 켠 요청에만 `meta.totalCount` 가 오는 것은 쪽 크기와 무관하고,
> 폰 화면에 두 본문을 담는다. 관계 전용 쓰기의 태그 조회는 토큰 없이 보낸다(7.2). (d) 결과는 단계마다 머리글과
> 본문을 갈라 그린다(`parseCombinedSteps`) - 언어 협상의 E2E 는 ko 단계의 본문에 한글이 있고 en 단계의 본문에
> 없는지 본다(9.4 와 같은 판정).
```

- [ ] **Step 10: 검사하고 커밋한다**

```bash
pnpm format
pnpm format:check && ./scripts/check-citations.sh app components lib platform queries test && pnpm lint
git status --short
git add queries/lab.ts test/unit/queries/lab.test.ts components/lab "app/(lab)" "app/(app)/index.tsx" platform/query-client.ts platform/AGENTS.md queries/AGENTS.md AGENTS.md docs/superpowers/specs
git commit -m "feat: 여섯 실험의 원본 응답을 그대로 보이는 계약 실험실 화면과 홈의 진입을 더한다"
```

Expected: 검사 전부 exit 0, 커밋 뒤 남은 파일이 없다(`dist/`·`.expo/` 는 git 이 무시한다).

---

### Task 4: 실험실 E2E, 드리프트 감지 실증, 게이트 13단계 (기기)

**Files:**
- Create: `test/e2e/flows/contract-lab-anonymous.yaml`, `test/e2e/flows/contract-lab-signed-in.yaml`, `docs/superpowers/notes/2026-10-01-d5-measurements.md`
- Modify: `test/e2e/AGENTS.md`, `test/contract/AGENTS.md`, `AGENTS.md`, 스펙(11.2 에 한 문장, 11.3 정정)
- 잠시 고쳤다 되돌림: `lib/resources/example.ts`(드리프트 실증 - 커밋하지 않는다)

**Interfaces:**
- Consumes: Task 2 의 `./test/contract/run.sh`·`./scripts/check.sh`(13단계), Task 3 의 testID(`home-lab-link`·`lab-screen`·`lab-run-<id>`·`lab-status-<id>`·`lab-header-<id>-<이름>`·`lab-step-heading-<id>-<n>`·`lab-step-body-<id>-<n>`·`lab-body-<id>`·`lab-note-<id>`·`lab-result-<id>`·`lab-session-note-<id>`), D2 의 `subflows/start-signed-out.yaml`·`submit-credentials.yaml`·`login-screen`, D4 Task 5 의 `scripts/examples-api.js` `STEP=account`, 하네스의 머리말 `# e2e-allow-http:`.
- Produces: 플로 20(D2 일곱·D3 일곱·D4 넷·D5 둘), 기록 C1–C3, 게이트 13단계의 통과.

- [ ] **Step 1: 실험실 플로 둘을 쓴다**

`test/e2e/flows/contract-lab-anonymous.yaml` 를 만든다:

```yaml
# e2e-allow-http: 400
# 계약 실험실을 로그인하지 않은 채(스펙 8.6·7.3). 세션이 필요한 셋은 요청하지 않고 로그인 화면으로 가고, 뒤로
# 가면 실험실이다(결과가 생기지 않는다). 나머지 셋은 원본 응답을 그대로 보인다 - 정책에 없는 필터 연산자는
# 400 INVALID_FILTER 의 원본 문서(그 400 을 선언한다), 페이지 총합은 켠 요청의 본문에만 totalCount, offset 순회는
# page[number]=1 에서 links.next 를 끝까지 따라가 두 쪽 이상을 지난다(씨앗 여섯 행, 쪽당 셋 - 이 플로는 이름 순으로
# 목록·쓰기 플로보다 먼저 돈다). 결과의 본문은 길어서 단언할 요소를 먼저 화면에 들인다. 실행을 누른 뒤에는 스피너가
# 멈추기를 기다린 다음(waitForAnimationToEnd) 스크롤한다 - 도는 동안 스크롤하면 결과가 화면 위쪽에 끼어 아래로 찾는
# 스크롤이 지나칠 수 있다.
appId: com.example.templateexpo.e2e
---
- runFlow: ../subflows/start-signed-out.yaml
- tapOn:
    id: home-lab-link
- extendedWaitUntil:
    visible:
      id: lab-screen
    timeout: 15000
# 세션이 필요한 셋 - 누르기 전에 안내가 있고, 누르면 로그인 화면이다.
- assertVisible:
    id: lab-session-note-putUpsert
- tapOn:
    id: lab-run-putUpsert
- extendedWaitUntil:
    visible:
      id: login-screen
    timeout: 15000
- pressKey: back
- extendedWaitUntil:
    visible:
      id: lab-run-putUpsert
    timeout: 15000
- assertNotVisible:
    id: lab-result-putUpsert
- scrollUntilVisible:
    element:
      id: lab-run-relationshipWrite
    direction: DOWN
- tapOn:
    id: lab-run-relationshipWrite
- extendedWaitUntil:
    visible:
      id: login-screen
    timeout: 15000
- pressKey: back
- extendedWaitUntil:
    visible:
      id: lab-run-relationshipWrite
    timeout: 15000
- assertNotVisible:
    id: lab-result-relationshipWrite
- scrollUntilVisible:
    element:
      id: lab-run-acceptLanguage
    direction: DOWN
- assertVisible:
    id: lab-session-note-acceptLanguage
- tapOn:
    id: lab-run-acceptLanguage
- extendedWaitUntil:
    visible:
      id: login-screen
    timeout: 15000
- pressKey: back
- extendedWaitUntil:
    visible:
      id: lab-run-acceptLanguage
    timeout: 15000
- assertNotVisible:
    id: lab-result-acceptLanguage
# 정책에 없는 필터 연산자 - 400 과 INVALID_FILTER, 그 source.parameter 가 filter[title][gt] 다.
- scrollUntilVisible:
    element:
      id: lab-run-invalidFilter
    direction: DOWN
- tapOn:
    id: lab-run-invalidFilter
- waitForAnimationToEnd:
    timeout: 20000
- scrollUntilVisible:
    element:
      id: lab-status-invalidFilter
      text: '400'
    direction: DOWN
    timeout: 20000
- scrollUntilVisible:
    element:
      id: lab-body-invalidFilter
      text: '[\s\S]*INVALID_FILTER[\s\S]*'
    direction: DOWN
    visibilityPercentage: 10
- assertVisible:
    id: lab-body-invalidFilter
    text: '[\s\S]*filter\[title\]\[gt\][\s\S]*'
# 페이지 총합 - 끈 요청(0)과 켠 요청(1). 둘 다 200 이고, 켠 요청의 본문에만 totalCount 가 있다. 끈 쪽의 부정
# 단언은 그 본문이 화면에 있을 때만 뜻이 있다 - 먼저 들인다.
- scrollUntilVisible:
    element:
      id: lab-run-pageTotals
    direction: UP
- tapOn:
    id: lab-run-pageTotals
- waitForAnimationToEnd:
    timeout: 20000
- scrollUntilVisible:
    element:
      id: lab-step-heading-pageTotals-0
      text: '.*\(상태 200\)'
    direction: DOWN
    timeout: 20000
- scrollUntilVisible:
    element:
      id: lab-step-body-pageTotals-0
    direction: DOWN
    visibilityPercentage: 10
- assertNotVisible:
    id: lab-step-body-pageTotals-0
    text: '[\s\S]*totalCount[\s\S]*'
- scrollUntilVisible:
    element:
      id: lab-step-heading-pageTotals-1
      text: '.*\(상태 200\)'
    direction: DOWN
- scrollUntilVisible:
    element:
      id: lab-step-body-pageTotals-1
      text: '[\s\S]*totalCount[\s\S]*'
    direction: DOWN
    visibilityPercentage: 10
# offset 순회 - 1쪽·2쪽이 200 이고, 맺음말이 끝에 닿았다고 적는다.
- scrollUntilVisible:
    element:
      id: lab-run-offsetWalk
    direction: UP
- tapOn:
    id: lab-run-offsetWalk
- waitForAnimationToEnd:
    timeout: 20000
- scrollUntilVisible:
    element:
      id: lab-step-heading-offsetWalk-0
      text: '.*\(상태 200\)'
    direction: DOWN
    timeout: 20000
- scrollUntilVisible:
    element:
      id: lab-step-heading-offsetWalk-1
      text: '.*\(상태 200\)'
    direction: DOWN
    timeout: 30000
- scrollUntilVisible:
    element:
      id: lab-note-offsetWalk
      text: '.*컬렉션 끝에 닿았다.*'
    direction: DOWN
    timeout: 30000
```

`test/e2e/flows/contract-lab-signed-in.yaml` 를 만든다:

```yaml
# e2e-allow-http: 422
# 계약 실험실의 세션이 필요한 셋(스펙 8.6·7.3). 로그인하지 않은 채 PUT upsert 를 누르면 로그인으로 가고, 로그인하면
# 실험실로 돌아온다(next=/contract). PUT upsert 는 같은 id 로 두 번 - 201(생성) 다음 200(교체). 관계 전용 쓰기는
# 태그 추가·제거가 둘 다 204 이고, 보낸 요청 헤더에 토큰 원문이 없다. 언어 협상은 같은 쓰기 오류(422 둘 - 그것을
# 선언한다)를 ko·en 으로 받는다 - ko 단계의 본문에 한글이 있고 en 단계의 본문에는 없다(스펙 9.4 와 같은 판정).
# 하네스가 access 수명을 10초로 주므로 실험마다 먼저 회전한다(스펙 7.2).
appId: com.example.templateexpo.e2e
---
- runFlow: ../subflows/start-signed-out.yaml
- runScript:
    file: ../scripts/examples-api.js
    env:
      STEP: account
- tapOn:
    id: home-lab-link
- extendedWaitUntil:
    visible:
      id: lab-screen
    timeout: 15000
- tapOn:
    id: lab-run-putUpsert
- extendedWaitUntil:
    visible:
      id: login-screen
    timeout: 15000
- runFlow: ../subflows/submit-credentials.yaml
# 로그인하면 next(/contract)로 돌아온다 - 실험실은 로그인 화면 밑에 그대로 있었다.
- extendedWaitUntil:
    visible:
      id: lab-run-putUpsert
    timeout: 20000
- assertNotVisible:
    id: login-screen
# PUT upsert - 없는 id 로 201, 같은 id 로 다시 200.
- tapOn:
    id: lab-run-putUpsert
- extendedWaitUntil:
    visible:
      id: lab-status-putUpsert
      text: '201'
    timeout: 20000
- tapOn:
    id: lab-run-putUpsert
- extendedWaitUntil:
    visible:
      id: lab-status-putUpsert
      text: '200'
    timeout: 20000
# 관계 전용 쓰기 - 조회·추가·제거의 세 단계, 추가와 제거가 204. 보낸 헤더의 토큰은 가려져 있다.
- scrollUntilVisible:
    element:
      id: lab-run-relationshipWrite
    direction: DOWN
- tapOn:
    id: lab-run-relationshipWrite
- waitForAnimationToEnd:
    timeout: 20000
- scrollUntilVisible:
    element:
      id: lab-step-heading-relationshipWrite-1
      text: '.*\(상태 204\)'
    direction: DOWN
    timeout: 20000
- scrollUntilVisible:
    element:
      id: lab-step-heading-relationshipWrite-2
      text: '.*\(상태 204\)'
    direction: DOWN
- scrollUntilVisible:
    element:
      id: lab-header-relationshipWrite-authorization
      text: 'authorization: Bearer <redacted>'
    direction: UP
# 언어 협상 - 같은 422 를 ko·en 으로. 본문의 문구는 백엔드가 협상한 언어다.
- scrollUntilVisible:
    element:
      id: lab-run-acceptLanguage
    direction: DOWN
- tapOn:
    id: lab-run-acceptLanguage
- waitForAnimationToEnd:
    timeout: 20000
- scrollUntilVisible:
    element:
      id: lab-step-heading-acceptLanguage-0
      text: '.*\(상태 422\)'
    direction: DOWN
    timeout: 20000
- scrollUntilVisible:
    element:
      id: lab-step-body-acceptLanguage-0
      text: '[\s\S]*[\uAC00-\uD7A3][\s\S]*'
    direction: DOWN
    visibilityPercentage: 10
- scrollUntilVisible:
    element:
      id: lab-step-heading-acceptLanguage-1
      text: '.*\(상태 422\)'
    direction: DOWN
- scrollUntilVisible:
    element:
      id: lab-step-body-acceptLanguage-1
      text: '[\s\S]*VALIDATION_ERROR[\s\S]*'
    direction: DOWN
    visibilityPercentage: 10
- assertNotVisible:
    id: lab-step-body-acceptLanguage-1
    text: '[\s\S]*[\uAC00-\uD7A3][\s\S]*'
```

- [ ] **Step 2: 문서·스펙 정정·기록의 자리를 쓴다**

`test/e2e/AGENTS.md` — `## 돌리기` 절 바로 앞에 더한다:

```markdown
## 계약 실험실 플로

- 실험실(`/contract`)은 홈의 `home-lab-link` 로 연다. testID 끝에 실험 id 가 붙는다
  (`components/lab/experiment-card.tsx`) - 실행 버튼 `lab-run-<id>`, 결과 `lab-result-<id>`, 상태 `lab-status-<id>`, 보낸
  헤더 `lab-header-<id>-<이름>`, 여러 단계의 머리글·본문 `lab-step-heading-<id>-<순서>`·`lab-step-body-<id>-<순서>`(0부터),
  한 단계 결과의 본문 `lab-body-<id>`, 맺음말 `lab-note-<id>`.
- 실행 버튼을 누른 뒤에는 스피너가 멈추기를 기다린다(`waitForAnimationToEnd`) - 도는 동안 스크롤하면 결과가 화면 위쪽에
  끼어 아래로 찾는 `scrollUntilVisible` 이 지나칠 수 있다.
- 결과의 본문은 길다(offset 순회는 쪽마다 수십 줄) - 단언할 요소를 `scrollUntilVisible` 로 화면에 들인 뒤에 본다. 본문처럼
  키가 큰 요소는 `visibilityPercentage: 10` 을 준다. 글자를 준 `assertNotVisible` 은 그 요소가 화면에 있을 때만 뜻이 있다 -
  먼저 요소를 들인다.
- 언어 협상은 문구를 문자열로 찾지 않는다 - ko 단계의 본문에 완성형 한글이 있고 en 단계의 본문에 없는지 본다(로캘
  플로와 같은 판정, 스펙 9.4).
- PUT upsert 의 행은 고정 id(`lib/lab/run.ts` 의 `PROBE_LAB_EXAMPLE_ID`)라 한 스택에서 처음 누르면 201, 다음부터 200 이다 -
  그 행을 만드는 플로는 `contract-lab-signed-in` 하나다. offset 순회는 씨앗 여섯 행에서 두 쪽이다 - 실험실 플로는 이름
  순으로 목록·쓰기 플로보다 먼저 돈다(뒤에 행이 늘어도 20쪽 상한 안이면 끝에 닿는다).
```

`test/contract/AGENTS.md` 끝에 더한다:

```markdown
거울이 선언의 어긋남을 잡는지는 선언을 일부러 바꿔 재 보았다 - `docs/superpowers/notes/2026-10-01-d5-measurements.md` 의 C1.
```

`docs/superpowers/specs/2026-09-30-expo-jsonapi-template-design.md` — Edit(Task 2 가 11.2 끝에 붙인 D5 정정의 마지막 줄), 찾을 것:

```markdown
> 토큰으로 잰다 - access 수명은 백엔드 기본값이다(E2E 하네스의 10초를 쓰지 않는다).
```

바꿀 것:

```markdown
> 토큰으로 잰다 - access 수명은 백엔드 기본값이다(E2E 하네스의 10초를 쓰지 않는다). 거울이 선언의 어긋남을
> 잡는지는 선언을 일부러 바꿔 재 보았다 - `docs/superpowers/notes/2026-10-01-d5-measurements.md` 의 C1.
```

스펙 — `### 11.4 E2E 스택` 바로 앞에 더한다:

```markdown
> 정정(2026-10-01, D5): 실험실 E2E 는 플로 둘이다 - 로그인하지 않은 채(`contract-lab-anonymous`: 세션이 필요한 셋의
> 로그인 이동과 뒤로 가기, 정책에 없는 필터 연산자의 400, 페이지 총합, offset 순회의 끝)와 로그인한 뒤
> (`contract-lab-signed-in`: 로그인 이동 → `next` 복귀, PUT upsert 201·200, 관계 전용 쓰기 204·204 와 가린 토큰, 언어
> 협상의 422 둘 - ko 본문에 한글이 있고 en 본문에 없다). 결과의 단계마다 testID 가 있어 단계의 본문끼리 본다. 결과는
> `docs/superpowers/notes/2026-10-01-d5-measurements.md` 의 C3.
```

D5 실측 기록 - 괄호 안의 안내 줄은 Step 6 이 실제 출력으로 바꾼다. `docs/superpowers/notes/2026-10-01-d5-measurements.md` 를 만든다:

````markdown
# D5 실측 기록 (2026-10-01)

계약 거울과 계약 실험실(D5)을 실제 FastAPI 스택과 기기에서 잰 것이다. 계획은
`docs/superpowers/plans/2026-10-01-d5-contract-lab.md`.

## C1 — 계약 거울이 선언의 어긋남을 잡는다 (드리프트 감지)

**명령.** 자원 선언 `lib/resources/example.ts` 에 어긋남 둘을 일부러 넣고 `./test/contract/run.sh` 를 돌렸다 -
`title` 의 `maxLength` 200 → 100(선언이 백엔드보다 좁다), `filters.title` 에 `gt` 를 더했다(백엔드가 닫은 연산자를
선언이 연다). 돌린 뒤 `git checkout -- lib/resources/example.ts` 로 되돌렸다.

```text
(run.sh 출력의 실패한 시험 이름 두 줄과 "Tests  2 failed | 87 passed (89)" 줄을 붙인다)
```

거울이 잡은 것: ① `examples filter title gt`(선언은 2xx 를 기대했는데 백엔드는 400 `INVALID_FILTER`), ③ `title 이
maxLength 보다 한 글자 길면 422`(101자 제목을 백엔드가 받았다). 나머지 87 은 그대로 통과했다 - 스택·가입·로그인은 성했다.

## C2 — 게이트 13단계

**명령.** `E2E_AVD=Pixel_9_API_36 ./scripts/check.sh` - Pixel_9_API_36(Android 16, API 36), FastAPI 스택.

```text
(gate.log 의 "=== [12/13]" 절의 vitest 요약 줄과, "--- <플로>" 줄들, "=== E2E 통과 - 플로 N개 ===" 를 붙인다)
```

계약 거울은 시험 89 - ① 조회 정책 프로브 77(`examples` 51·`exampleCategories` 13·`exampleTags` 13), ② 응답 속성 키
3, ③ 속성 제약 5, ④ enum 값 4(값 셋과 "잴 enum 이 하나 이상"). E2E 는 D2 의 일곱, D3 의 일곱, D4 의 넷, D5 의 둘이다.

## C3 — 계약 실험실 (기기)

**가드.** 선언한 실패 표식 - `contract-lab-anonymous` 의 400(정책에 없는 필터 연산자) (수), `contract-lab-signed-in`
의 422(언어 협상 ko·en) (수). 세션이 필요한 셋을 로그인하지 않은 채 눌렀을 때 요청이 나가지 않았다 - 그 플로의
백엔드 접근 로그에 `PUT`·`/relationships/tags`·`POST /api/v1/examples` 가 없다.

```text
(아래 Step 의 grep 출력을 붙인다)
```

**로그인 이동과 복귀.** `contract-lab-signed-in` 이 로그인하지 않은 채 PUT upsert 를 눌러 로그인 화면에 닿았고,
로그인한 뒤 실험실로 돌아와(`next=/contract`) 같은 실험을 201·200 으로 돌렸다.

**재지 않은 것.** iOS(D7 의 CI), NestJS·Rails 에서의 거울과 실험실(D7 의 매트릭스 - `test/contract/run.sh` 는 지금
FastAPI 프로파일만 띄운다).
````

루트 `AGENTS.md` 의 `## 검증 명령` 절, 실측 기록 문단(`실측 기록은 \`docs/superpowers/notes/2026-09-30-d1-measurements.md\`다. …`) 끝에 한 문장을 더한다:

```markdown
계약 거울의 드리프트 감지와 게이트 13단계, 계약 실험실의 기기 E2E(D5 실측 C1–C3)는
`docs/superpowers/notes/2026-10-01-d5-measurements.md`에 있다.
```

```bash
pnpm format
pnpm format:check && ./scripts/check-citations.sh app components lib platform queries test
ls test/e2e/flows | wc -l
maestro check-syntax test/e2e/flows/contract-lab-anonymous.yaml && maestro check-syntax test/e2e/flows/contract-lab-signed-in.yaml && echo "flows ok"
```

Expected: exit 0 둘, 플로 `20`, `flows ok`(Maestro 가 PATH 에 없으면 `~/.maestro/bin/maestro`).

- [ ] **Step 3: 드리프트 감지를 실증한다 - 선언에 어긋남 둘을 넣고 거울을 돈다**

거울이 어긋남을 실제로 잡는지 본다(결정 18). 스택만 쓴다 - 기기·APK 는 쓰지 않는다. 이 저장소의 compose 프로젝트만 띄우고 내린다.

`.maestro-output/d5-drift.cjs` 를 만든다:

```js
// 계약 거울의 드리프트 실증(D5 Task 4) - 자원 선언에 어긋남 둘을 넣는다. 거울을 돈 뒤
// `git checkout -- lib/resources/example.ts` 로 되돌린다.
const fs = require('node:fs')
const file = 'lib/resources/example.ts'
let text = fs.readFileSync(file, 'utf8')
const mutations = [
  ['      maxLength: 200,', '      maxLength: 100,'],
  ["    title: ['exact', 'contains'],", "    title: ['exact', 'contains', 'gt'],"],
]
for (const [from, to] of mutations) {
  if (text.split(from).length !== 2) throw new Error(`한 번 맞아야 한다: ${from}`)
  text = text.replace(from, to)
}
fs.writeFileSync(file, text)
console.log('선언에 어긋남 둘을 넣었다 - title 의 maxLength 100, filters.title 에 gt')
```

```bash
docker ps --filter name=joon- -q | wc -l
node .maestro-output/d5-drift.cjs
git diff --stat
./test/contract/run.sh > .maestro-output/drift.log 2>&1; echo "run.sh exit=$?"
git checkout -- lib/resources/example.ts
git status --short lib/resources
grep -E "FAIL|Tests " .maestro-output/drift.log | sort -u
docker ps --filter name=joon- -q | wc -l
docker ps --filter label=com.docker.compose.project=template-typescript-expo-e2e -q | wc -l
```

Expected: 앞뒤 `9`, `lib/resources/example.ts | 4 ++--`, `run.sh exit=1`, 되돌린 뒤 `lib/resources` 에 바뀐 파일이 없다, 실패가 정확히 둘 - `… ① 선언된 조회 정책이 백엔드와 같다 - examples > examples filter title gt` 와 `… ③ 속성 제약 - examples 에만, 로그인한 뒤 > title 이 maxLength 보다 한 글자 길면 422` - 이고 `Tests  2 failed | 87 passed (89)`, 우리 compose 프로젝트의 컨테이너 `0`(스크립트가 내렸다). 스택 기동이 실패하면(`FastAPI 가 … 준비되지 않았다`) `docker compose -p template-typescript-expo-e2e -f docker-compose.e2e.yml --profile fastapi logs --no-color api-fastapi | tail -n 40` 으로 원인을 본다. 실패가 셋 이상이면 Step 5 (a) 다 - 어긋남을 넣지 않은 자리까지 죽은 것이다.

- [ ] **Step 4: 게이트를 돌린다 — 기기 작업은 여기서 한 번**

게이트의 `[12/13]` 이 스택을 띄워 거울을 돌고(89 통과), `[13/13]` 이 빌드 입력이 바뀐 APK 를 짧은 경로 사본에서 한 번 만든 뒤(5~6분) 새 스택에서 플로 스물을 돈다 — 30분 넘게 걸릴 수 있어 백그라운드로 돌리고 끝나기를 기다린다(도구의 전경 제한은 10분이다). 이 저장소의 `expo start` 를 끄고 돈다(`[10]` 이 `--clear`).

```bash
mkdir -p .maestro-output
docker ps --filter name=joon- -q | wc -l
E2E_AVD=Pixel_9_API_36 ./scripts/check.sh > .maestro-output/gate.log 2>&1; echo "gate exit=$?"
grep -E "^=== |Test Files|Tests |APK 를 다시 만들지 않는다|^--- |E2E 통과|E2E:|계약 거울:" .maestro-output/gate.log
docker ps --filter name=joon- -q | wc -l
docker ps --filter label=com.docker.compose.project=template-typescript-expo-e2e -q | wc -l
```

Expected: 앞뒤 `9`, `gate exit=0`, `=== [1/13] …` 부터 `=== [13/13] E2E ===`, `[7/13]` 의 `1525 passed`(Task 3 의 수), `[12/13]` 의 `Tests  89 passed (89)`, `--- ` 줄 스물(`contract-lab-anonymous`·`contract-lab-signed-in` 포함 - 이름 순이라 `auth-links` 다음이다), `=== E2E 통과 - 플로 20개 ===`, `=== 전부 통과 ===`, 우리 compose 프로젝트의 컨테이너 `0`. "APK 를 다시 만들지 않는다" 는 나오지 않는다(앱 코드가 바뀌었다).

- [ ] **Step 5: 실패하면 원인을 고친다**

실패한 플로의 `.maestro-output/e2e/<플로>/` 에서 `maestro.log`·`debug/`(실패한 단계의 스크린샷)·`logcat.txt`·`api.log` 를 본다. **원인을 고친다** — 제한 시간을 늘리거나 단언을 지우거나 가드를 약하게 하지 않는다(스펙 16장: 재시도 0). 한 플로만 다시 돌릴 때는 `E2E_AVD=Pixel_9_API_36 E2E_FLOW="contract-lab-signed-in" ./test/e2e/run-android.sh > .maestro-output/e2e-run.log 2>&1` 처럼 준다(플로만 고쳤으면 APK 를 다시 만들지 않는다. 앱 코드를 고치면 한 번 다시 만든다). 고친 뒤 전부 통과하면 Step 4 의 게이트를 한 번 더 돈다. 짐작되는 갈래:

(a) **`[12/13]` 이 어긋남 없이 실패한다** — 선언과 지금의 백엔드(GitHub `main` 에서 빌드한 이미지)가 이미 어긋났다. 이 계획이 잡으려던 드리프트다. 시험을 느슨하게 하지 않고, 선언(`lib/resources/*.ts` - 원본 그대로인 복사본)도 고치지 않는다 - 실패한 시험 이름과 메시지(기대·실제 상태와 `errors`)를 `.maestro-output/gate.log` 에서 모아 멈추고 컨트롤러에 넘긴다(결정 24). 거울 도우미의 결함(모든 시험이 같은 오류로 죽는다 - 주소·헤더)이면 `test/contract/backend.ts` 를 고친다.

(b) **본문·머리글 요소를 못 찾는다**(`lab-step-body-…`·`lab-step-heading-…` 에서 `Element not found`, 스크린샷에는 결과가 떠 있다) — 스크롤 방향이나 순서의 문제다. 스크린샷에서 그 요소가 위에 있었는지 아래에 있었는지 보고 `scrollUntilVisible` 의 `direction` 을 고치거나 앞에 그 요소 위·아래의 머리글로 가는 단계를 더한다. 키가 큰 본문인데 `visibilityPercentage` 가 없으면 더한다(결정 19). 단언의 글자(정규식)는 바꾸지 않는다.

(c) **로그인 화면에서 뒤로 갔는데 실험실이 아니다**(앱이 닫히거나 홈) — 실험실이 로그인을 쌓지 못한 것이다. `app/(lab)/contract.tsx` 의 `router.push(target)` 가 불렸는지(`logcat.txt` 의 JS 오류), 로그인 화면의 `useBackToHome` 이 `router.canGoBack()` 을 참으로 봤는지 본다.

(d) **로그인한 뒤 실험실로 돌아오지 않는다**(`contract-lab-signed-in` 이 로그인 뒤 `lab-run-putUpsert` 를 못 찾는다) — 실험실이 로그인으로 보낼 때 `next` 에 `/contract` 를 실었는지(`app/(lab)/contract.tsx` 의 `loginHref(pathname)` - `usePathname()` 이 `/contract` 인지) 보고, 로그인 화면의 `dismissTo` 가 스택에서 `(lab)/contract` 를 찾았는지 본다. 없으면 로그인 화면이 실험실을 바꿔 끼운 것이다 - 기록 C3 에 적고 컨트롤러에 넘긴다.

(e) **선언하지 않은 상태로 가드에 걸린다** — `contract-lab-anonymous` 에 401·403 이면 세션이 필요한 실험이 요청을 보낸 것이다(`lib/lab/run.ts` 의 `withToken` - `write.ts` 의 `accessToken` 을 지나는지). `contract-lab-signed-in` 에 401 이면 회전 뒤 토큰이 실리지 않았거나, 토큰 하나로 둘·셋을 보내는 실험(관계 쓰기·언어 협상)이 access 수명 10초 안에 끝나지 않은 것이다 - `api.log` 의 `POST /api/v1/auth/refresh` 와 그 뒤 요청의 시각을 본다. 뒤쪽이면 하네스의 수명을 늘리지 않고(D4 의 회전 E2E 가 그 값에 기댄다) 기록과 함께 컨트롤러에 넘긴다. 404 면 관계 쓰기의 대상 행이 없다 - PUT upsert 가 먼저 돌았는지 본다.

(f) **en 단계의 본문에 한글이 있다** — API 클라이언트가 호출자의 언어를 덮었다(`platform/api.ts` 의 `options.acceptLanguage ??` 가 빠졌다 - Task 1 의 시험이 먼저 잡아야 한다) 또는 백엔드가 그 오류 문구를 협상하지 않는다 - 화면의 두 본문은 `debug/` 의 스크린샷에서 읽는다. 백엔드 쪽이면 기록 C3 에 적고 컨트롤러에 넘긴다.

(g) **offset 순회가 끝에 닿지 않고 상한에 걸렸다** — 행이 60 을 넘었다(쪽당 3건 × 20회). 실험실 플로보다 먼저 도는 플로가 행을 만들었는지(`ls test/e2e/flows` 의 이름 순) 본다.

(h) **`W/ReactNativeJS`·`E/ReactNativeJS` 가 가드에 걸린다** — 그 경고를 내는 코드를 고친다(중복 키, `Text` 밖의 글자, 글꼴 이름 등). `console.error` 가 `[write] access token 을 받지 못했다` 면 실험실이 토큰을 받지 못한 것이다 - 저장소 오류라 `logcat.txt` 의 앞 줄을 본다. 실험실이 오류 화면(오류 경계)으로 바뀌었으면 실행부가 결함을 던진 것이다(결정 27) - `logcat.txt` 의 JS 오류를 본다.

(i) **로그인한 뒤 세션이 필요한 실험의 카드가 결과 대신 앱 문구("지금은 요청을 처리할 수 없습니다…")를 그린다** — 만료 가드가 요청을 보내지 않은 것이다(결정 26). 하네스의 access 수명이 10초라 실험마다 회전하는데, 그 회전이 판정을 받지 못했다 - `api.log` 의 `POST /api/v1/auth/refresh` 상태(5xx·408·429)나 빠진 줄을 본다. 앱이 아니라 스택의 문제이므로 기록과 함께 컨트롤러에 넘긴다.

- [ ] **Step 6: 가드와 기록을 채운다**

(a) 선언한 상태가 나왔고, 로그인하지 않은 채 누른 세션이 필요한 셋은 요청을 보내지 않았다:

```bash
grep "\[e2e-http\]" .maestro-output/e2e/contract-lab-anonymous/logcat.txt
grep -c "\[e2e-http\] 422 " .maestro-output/e2e/contract-lab-signed-in/logcat.txt
grep -cE "PUT /api/v1/examples/|/relationships/tags|POST /api/v1/examples " .maestro-output/e2e/contract-lab-anonymous/api.log
grep -E "PUT /api/v1/examples/|/relationships/tags|POST /api/v1/auth/refresh" .maestro-output/e2e/contract-lab-signed-in/api.log
```

Expected: 첫째는 한 줄 `[e2e-http] 400 GET /api/v1/examples INVALID_FILTER`, 둘째 `2`, 셋째 `0`, 넷째는 `PUT …/55550000-0000-4000-8000-000000000001` 둘(201 다음 200), `POST`·`DELETE …/relationships/tags` 가 204, 그리고 실험마다 앞선 회전(`POST /api/v1/auth/refresh` 200). 로그의 모양이 달라 세기 어려우면 `grep "/api/v1/" <api.log>` 의 줄을 그대로 붙인다.

(b) 기록을 채운다 — `docs/superpowers/notes/2026-10-01-d5-measurements.md` 의 괄호 안 안내 줄 셋을 실제 출력으로 바꾼다: C1 은 Step 3 의 `grep -E "FAIL|Tests " .maestro-output/drift.log | sort -u`, C2 는 `grep -E "Test Files|Tests |^--- |E2E 통과" .maestro-output/gate.log` 가운데 `[12/13]` 절의 요약과 플로 줄, C3 은 위 (a) 의 출력. C3 의 "(수)" 두 자리에 400·422 의 수를 적는다.

- [ ] **Step 7: 커밋한다**

게이트 뒤에는 기록(문서)만 바뀌었다 — 빌드 지문과 플로와 거울이 문서를 보지 않으므로 게이트를 다시 돌리지 않는다. 문서에 걸리는 검사만 다시 돈다.

```bash
pnpm format:check && ./scripts/check-citations.sh app components lib platform queries test && node scripts/check-provenance.mjs | tail -n 1
git status --short
git add test/e2e docs/superpowers test/contract/AGENTS.md AGENTS.md
git status --short
git commit -m "test: 계약 실험실의 E2E 둘을 더하고 계약 거울이 선언의 어긋남을 잡는 것과 게이트 13단계를 기기에서 잰다"
git ls-tree HEAD scripts/ test/e2e/ test/contract/ | grep -E "\.sh$"
```

Expected: 검사 통과(`경로 52개, 이탈 40건, 원본 그대로 32개`), 첫 `git status` 에는 이 태스크의 파일만 있고(`lib/resources/example.ts` 가 보이면 Step 3 의 되돌리기가 빠졌다 - `git checkout -- lib/resources/example.ts`. 앱 코드가 보이면 Step 5 에서 고친 것이다 - 그 변경도 게이트를 지났는지 확인하고 함께 넣는다), 커밋 뒤 남은 파일이 없다. `.sh` 여섯이 모두 `100755`.

---

## 이 계획이 끝났을 때의 상태

- `lib/lab/` 에 원본에서 옮겨 복사한 실험 정의(`experiments.ts` - 커서 순회가 offset 순회로)와 결과 표현(`result.ts` - 원본 그대로), 그리고 실험 하나를 쓰기의 의존성과 기기 언어로 돌리는 실행부(`run.ts`)가 있다. 세션이 필요한 셋은 D4 의 쓰기와 같은 길로 토큰을 받는다(`write.ts` 의 `accessToken`) - 세션이 없거나 백엔드가 거절하면 요청 없이(또는 그 자리에서) 세션 거절을 던지고, 받은 토큰의 세션이 이미 만료됐으면 요청 없이 앱 문구를 그린다. 시험 79(복사본 21·26, 실행부 32)가 지킨다. 출처 기록은 경로 52·이탈 40·원본 그대로 32 다.
- `apiRequest` 는 호출자가 정한 언어를 덮지 않고, `deviceAcceptLanguage()` 가 기기 언어를 만든다 - 실험실만 언어를 정한다.
- 계약 거울(`test/contract/`)이 자원 선언을 실제 FastAPI 에 맞댄다 - 조회 정책 양방향 77·응답 속성 키 3·속성 제약 5·enum 값 4, 시험 89. 게이트 `[12/13]` 이 `test/contract/run.sh` 로 스택을 띄워 돌고, 선언을 일부러 어긋나게 하면 정확히 그 시험이 죽는다(기록 C1).
- 계약 실험실(`/contract`, 홈의 `home-lab-link`)이 여섯 실험의 원본 응답을 단계마다 머리글·본문으로 갈라 보이고, 세션이 필요한 실험을 로그인하지 않은 채 누르면 로그인으로 갔다가 돌아온다. 홈의 진입과 로그인 이동은 한 번만 쌓이고(`useNavigateOnce`), 실험실의 쓰기 훅은 결함을 오류 경계로 보낸다(`test/unit/queries/lab.test.ts` 넷).
- `./scripts/check.sh` 가 13단계를 통과한다. E2E 는 D2 의 일곱, D3 의 일곱, D4 의 넷, D5 의 둘 - 실험실을 로그인 전(세션 셋의 로그인 이동, 400 `INVALID_FILTER`, 페이지 총합, offset 순회의 끝)과 로그인 뒤(next 복귀, PUT upsert 201·200, 관계 쓰기 204·204, 언어 협상의 ko·en) - 를 한 에뮬레이터·한 스택에서 돈다.
- 기록: D5 실측 C1(드리프트 감지)·C2(게이트 13단계)·C3(실험실 E2E). 스펙 정정: 8.6·9.4·11.2·11.3·12.

## 다음 계획

D6(EAS·OTA)은 홈에 빌드 정보 카드를 더한다 - 이 계획이 목록 진입 아래에 둔 실험실 진입(`home-lab-link`) 아래나 위에 둔다(홈의 `testID` 들을 E2E 가 쓴다). 홈의 목록 진입은 D4 뒤에도 D2 의 `Link` 다 - 실험실 진입처럼 `useNavigateOnce` 를 지나게 할지는 D6 이 정한다(결정 20).

D7(CI)이 넘겨받는 것:

- 계약 거울은 지금 FastAPI 프로파일만 띄운다(`test/contract/run.sh`). 세 백엔드 매트릭스는 원본의 `test/e2e/matrix.ts`(+ 시험 - `BACKEND_KIND` 검증과 알려진 드리프트 목록, 스펙 6.2)를 복사하며 `run.sh` 에 프로파일 선택을 더한다(결정 17). 원본 계획은 NestJS 의 참조 자원이 속성을 더 내는 드리프트를 적었고(M-2 ①), 원본의 `matrix.ts` 는 2026-09-09 에 알려진 드리프트를 0건으로 적었다 - 매트릭스의 첫 실행에서 ② 가 다시 잰다.
- 거울의 ③ 은 선언이 백엔드보다 넓은 쪽을 잡지 못한다(결정 14 - 원본과 같은 한계). NestJS 의 참조 자원 이름 길이(원본 계획 M-2 ②)는 쓰기 라우트가 없어 HTTP 로 잴 수 없다.
- iOS 에서 실험실 플로 둘(스크롤·키가 큰 본문의 보이는 판정)과 고정폭 글꼴(`Menlo`)을 본다.
- 게이트를 1–11단계만 돌리는 길(D2 운반)은 이제 1–12단계(거울까지)가 CI `checks` 잡의 후보다 - 거울은 Docker 만 있으면 돈다.
