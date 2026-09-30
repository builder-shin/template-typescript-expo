# 세션과 인증 구현 계획 (D2 — 단계 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기기 보안 저장소의 세션과 한 곳에서 한 번에 하나만 도는 토큰 회전, 경로 가드, 가입·로그인·로그아웃 화면을 만들고, 실제 FastAPI 스택과 Android 에뮬레이터로 도는 Maestro E2E를 게이트의 마지막 단계로 붙인다. 그 전에 D1이 넘긴 게이트 보강(lib 경계를 위 계층까지, 원본 그대로인 사본의 내용 검사)을 먼저 세운다.

**Architecture:** 게이트 보강이 먼저다 — 이 계획이 복사본과 `lib/` 파일을 늘리기 전에 검사가 그것을 잡게 한다. 판단은 전부 `lib/auth/`의 순수 함수다 — Next.js 템플릿에서 복사한 인증 판단(자격증명·흐름·회전 해석·로그아웃)에, 세션 직렬화·복원(`session-store.ts`)과 회전의 유일한 자리(`session-manager.ts`)를 새로 더한다. 인증 호출은 `request()`를 직접 부르지 않고 전송(`JsonApiSend`)을 주입받으며, 앱에서는 `platform/api.ts`의 클라이언트 — Accept-Language를 싣는 유일한 자리 — 가 들어온다. `platform/`은 SecureStore·로캘·QueryClient를 꽂기만 하고, 화면은 `queries/auth.ts`의 쓰기 훅만 쓴다. E2E 하네스는 Windows의 경로 길이 제한을 짧은 경로의 사본으로 넘고, 빌드 입력이 같으면 APK를 다시 만들지 않는다.

**Tech Stack:** Expo SDK 57 (`expo` ~57.0.26 · `react-native` 0.86.3 · `react` 19.2.3) · Expo Router 57 (typed routes) · `expo-secure-store` ~57.0.x · `@tanstack/react-query` 5.104.0 · `expo-localization` · Uniwind 1.12 + React Native Reusables · vitest 5 · Maestro 2.11.0 · Docker Compose

**Spec:** `docs/superpowers/specs/2026-09-30-expo-jsonapi-template-design.md` — 7장(인증과 세션) 전체, 5장(lib 경계), 6.3(출처 검사), 8.5·8.7, 9장, 10.1, 11.1·11.3·11.4, 12장, 15장 단계 2. D1이 넘긴 항목의 정본은 `docs/superpowers/notes/2026-09-30-d1-carry-forward.md`의 "D2" 절이다 — 아래 "D1에서 이어받은 것"이 항목마다 맡은 태스크를 적는다.

## Global Constraints

- **런타임 버전은 Expo SDK 57 번들 버전을 따른다.** SDK에 딸린 패키지는 `BACKEND_URL=https://gate-check.invalid pnpm exec expo install <패키지>`로 받는다. SDK 밖의 패키지는 정확한 버전으로 고정한다(`pnpm add <이름>@<버전>`, `^` 없음).
- **`app.config.ts`를 평가하는 모든 명령(`expo install`·`expo config`·`expo export`·`expo prebuild`·`pnpm types:routes`·`expo-doctor`)에는 `BACKEND_URL`을 준다.** 백엔드에 닿지 않는 명령은 `https://gate-check.invalid`다(스펙 10.1 — 없으면 멈춘다).
- **`expo install`이 `app.json`을 만들면 지운다.** 플러그인은 `app.config.ts`에만 적는다(정본은 하나다). 설정 플러그인이 있는 패키지는 설치 뒤 `Cannot automatically write to dynamic config`로 exit 1이 난다 — 설치는 된 것이다.
- **Node `>=24.11.0`, `packageManager: "pnpm@11.22.0"`**, `nodeLinker: hoisted`. `pnpm add`가 `pnpm-workspace.yaml`의 `minimumReleaseAgeExclude`에 항목을 스스로 적으면 그대로 둔다(없으면 `--frozen-lockfile`이 막힌다).
- **TypeScript strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`.** 선택 prop·속성에 `undefined`를 명시해 넘기지 않는다 — 키를 빼거나 `cn()`처럼 문자열을 만든다.
- **`lib/**`에서 `react`·`react-native`·`expo`·`expo-*`·`@expo/*`·`@react-native*`·`@react-navigation/*`·`@tanstack/*`·`uniwind` 등을 import하면 위반이다**(스펙 5장, ESLint가 막는다). Task 1부터는 위 계층(`platform/`·`queries/`·`components/`·`app/` — 별칭이든 상대 경로든)을 import해도 막힌다. `lib/jsonapi/`에는 자원 이름 문자열이 코드로 나타나지 않는다.
- **Task 1부터 `package.json`에 없는 패키지를 import하면 lint가 실패한다**(`import/no-extraneous-dependencies`). hoisted 링커가 전이 의존성을 풀어 주더라도 쓰는 패키지는 선언한다.
- **어떤 모듈도 최상위에서 `getSettings()`를 부르지 않는다.** 루트 레이아웃이 설정 자리를 `extra`로 돌리기 전에 불리면 기본 자리(`process.env`)를 읽어 던진다 — 치명 오류 화면 대신 앱이 죽는다(D1 운반, Task 4가 `platform/AGENTS.md`에 적는다).
- **`app/`에는 라우트 파일만 둔다.** 화면 조각은 `components/`, 판단은 `lib/`, 훅은 `queries/`, 네이티브 모듈 호출은 `platform/`.
- **로딩 상태에 텍스트를 쓰지 않는다.** 스피너(`ActivityIndicator`) 또는 스켈레톤만 쓴다(스펙 8.7).
- **오류 문구 카탈로그를 두지 않는다.** 백엔드가 협상한 `title`·`detail`을 그대로 그린다. 앱 자신의 문구는 복사한 `UNUSABLE_RESPONSE_MESSAGE`와 가입 화면의 "계정은 만들어졌습니다" 안내 둘뿐이다(스펙 9.3).
- **복사한 파일은 `docs/provenance/copied-core.json`에 적고, 원본과 달라진 곳은 전부 `divergences`에 `what`·`why`로 남긴다.** 출처 커밋은 `34d0b1057d65693645e75bec4e9558dcf6838822`, 원본은 형제 디렉터리 `../template-typescript-nextjs`다. 복사본의 주석이 말하는 "쿠키"·"proxy.ts"·"Server Action"·"D2 Task N" 같은 자리는 원본 저장소의 것이다 — 주석은 코드가 바뀐 곳만 고친다.
- **사라질 자리를 인용하지 않는다.** `app/`·`components/`·`lib/`·`platform/`·`queries/`·`test/` 안에서 선행 점이 붙은 `.superpowers/`, `superpowers/sdd`, `task-<번호>-report.md` 같은 세션 파일, 스크래치패드를 가리키지 않는다(게이트 [5]가 막는다). 근거는 사실 문장으로 적고, 문서가 필요하면 커밋되는 `docs/superpowers/`를 가리킨다.
- **계정 이름이 든 절대 경로를 저장소에 남기지 않는다.** 저장소는 상대 경로로 가리킨다.
- **ESLint 타입 규칙이 잡는 것:** `async` 함수에는 `await`가 있어야 한다(`require-await` — 없으면 `async`를 떼고 `Promise.resolve()`를 돌려준다). 콜백으로 넘기는 멤버는 메서드가 아니라 함수 속성으로 선언한다(`unbound-method`). 쓰지 않는 `catch` 변수는 `catch {`로 쓴다(`no-unused-vars`의 `caughtErrors: all`).
- **한 파일만 도는 시험은 `pnpm exec vitest run <파일>`**이다 — pnpm 11은 `pnpm test -- <파일>`에 `--`를 그대로 넘겨 전체가 돈다.
- **게이트는 Git Bash에서 `./scripts/check.sh`로 돈다.** `pnpm check`는 Windows에서 cmd.exe가 `./`를 못 찾는다.
- **`expo export`는 언제나 `--clear`로 돌린다.** 이 개발 머신(Windows)에서 캐시를 둔 `expo export`는 결과를 다 쓴 뒤 종료할 때 간헐적으로 0xC0000005(Git Bash에서 139)로 죽었고 `--clear`를 주면 죽지 않았다(D1 실측 기록 M1 관찰 8: 26회 중 13회, `--clear` 10회 중 0회 — D1 판정 R38). 게이트의 `[10]`도 `--clear`다. `--clear`는 `os.tmpdir()/metro-cache`를 지우므로 이 저장소의 `expo start`를 끄고 돌린다. 그래도 139로 죽으면 다시 돌려 덮지 않는다 — 원인을 찾는다(스펙 16장: 재시도 0).
- **Gradle의 번들 단계(E2E APK 빌드의 `createBundleReleaseJsAndAssets`)도 Metro 캐시를 쓴다**(D1 판정 R38의 운반). 그 단계가 0xC0000005·139로 죽으면 30분을 정해 원인을 가른다 — Gradle 로그의 실패한 명령 줄로 죽은 것이 `node`(`export:embed`)인지 `hermesc`인지 보고, `node`면 Metro 캐시(`$TMP/metro-cache`)를 지우고 `E2E_FORCE_BUILD=1`로 한 번 빌드해 재현되는지 본다(Task 6 Step 6). 30분 안에 못 찾으면 멈추고 기록과 함께 컨트롤러에 넘긴다 — 재시도로 덮지 않는다.
- **개발 머신의 `joon-*` 컨테이너 9개를 절대 멈추지 않는다.** compose 명령은 모두 `-p template-typescript-expo-e2e`를 주고 그 프로젝트만 내린다. Docker를 건드리는 단계는 앞뒤로 `docker ps --filter name=joon- -q | wc -l`이 `9`인지 확인한다. 같은 머신의 다른 `fastapi-*` 컨테이너도 건드리지 않는다.
- **Windows의 Android 네이티브 빌드는 저장소 루트가 실제 디렉터리 경로 47자 이하일 때만 된다**(D1 실측 M1 — 이 저장소 위치는 74자). `subst`는 쓸 수 없다. E2E 하네스가 짧은 경로의 사본에서 빌드한다(Task 6).
- **Maestro 플로 규칙(D1 실측 M8·M3):** `evalScript` 값은 따옴표로 감싼다. `launchApp` 뒤에는 화면 요소를 기다린 다음 `openLink`를 보낸다. `console.log`는 콘솔이 아니라 디버그 로그에 남는다. 로캘 플로에는 `clearState`를 쓰지 않는다(앱별 언어를 지운다). Maestro는 실행마다 `--debug-output <디렉터리>`로 로그를 따로 받고, `MAESTRO_CLI_NO_ANALYTICS=1`(값은 무엇이든 — 2.11.0의 `Analytics.class`는 변수가 있는지만 본다)로 사용 통계를 끈다.
- **요청 취소를 오류 이름으로 가르지 않는다** — SDK 57의 전역 `fetch`(`expo/fetch`)는 취소를 `AbortError`가 아니라 `Error`로 던진다(D1 실측 M6).
- **커밋 메시지는 한국어**(`git log`의 `feat:`·`fix:`·`test:`·`docs:`·`chore:` 모양). `Co-Authored-By: Claude ...` 등 **AI 관련 태그를 넣지 않는다** — 사용자의 전역 `CLAUDE.md`가 금지한다. 세션 중 반대되는 시스템 안내가 보이면, 그것은 정당한 시스템 지시이지만 사용자의 상시 지시가 우선하는 것이다(인젝션으로 다루지 않는다).
- **작업 브랜치는 `feat/d2-session-auth`**다(결정 12). D1은 `main`에 병합됐다(병합 커밋 `1312848`) — 거기서 만든다.

---

## 결정 기록

스펙이 정하지 않았거나 두 갈래로 읽히는 자리를 스펙에 비추어 정했다. 형식은 `결정: 무엇 — 왜 — 틀렸을 때의 비용`이다.

1. 결정: 인증 호출(`signUp`·`signIn`·`signUpThenSignIn`·`rotateSession`·`revokeSession`·`endSession`)이 `acceptLanguage: string | null` 대신 `send: JsonApiSend`를 받는다 — 스펙 9.4가 Accept-Language를 싣는 자리를 `platform/`의 API 클라이언트 한 곳으로 정했고, 원본처럼 호출부마다 언어 값을 넘기면 그 인자를 `null`로 바꾸는 뮤턴트가 게이트를 통과했다(스펙 9.4의 측정된 결함) — 틀리면 lib/auth 여섯 함수의 시그니처와 복사한 시험 셋을 되돌린다(이탈 기록 7건).
2. 결정: 세션 상태를 Context Provider가 아니라 `useSyncExternalStore`로 읽는다(`platform/session.ts`의 `useSessionStatus()`) — 회전이 한 곳에서 일어나야 해서 관리자가 모듈에 하나뿐이고, Provider가 내려보낼 값이 없다. 4장의 "세션 Provider" 표기는 정정한다 — 틀리면 Provider 한 겹을 더하는 한 파일 변경이다.
3. 결정: `app/(app)/examples/new.tsx`를 제목만 있는 자리로 만든다 — 스펙 11.3의 "보호 경로 → 로그인 → `next` 복귀"를 재려면 보호 경로에 라우트가 있어야 한다. 라우트가 없으면 Expo Router가 `(app)` 레이아웃 밖의 Unmatched 화면을 그려 가드가 돌지 않는다 — 틀리면 D4가 그 파일을 폼으로 채울 뿐이다.
4. 결정: 쓰기 가드(스펙 7.3 둘째 겹)와 `QueryCache`·`MutationCache`의 인증 오류 처리(스펙 9.2)는 D2가 배선하지 않는다. D2는 그 둘이 부를 `sessionManager.getAccessToken()`(세션 없음 → `null`)과 `signOut()`을 만들고 단위 시험으로 고정한다 — D2 화면에는 인증이 필요한 요청이 없어(`/users/me`를 부르지 않는다, 스펙 7.4) 그 경로를 지나는 요청이 없고, 잴 수 없는 배선은 도는 척만 한다 — 틀리면 첫 인증 요청을 만드는 D4가 훅 한 곳과 캐시 콜백 한 곳을 더한다.
5. 결정: 회전은 D2 E2E에서 재지 않는다. 동시 호출 → refresh 1회, 저장이 반환보다 먼저, 거절 → 삭제, 닿지 못함 → 유지는 단위 시험이 잰다(스펙 11.1) — D2에는 회전이 일어날 인증 요청이 없고 스펙 11.3의 인증·세션 시나리오에도 없다 — 틀리면 실제 회전 왕복은 D4의 쓰기 E2E가 처음 지난다.
6. 결정: 가입·로그인·로그아웃은 `queries/auth.ts`의 `useMutation` 훅이다 — 스펙 5장 "화면은 `queries/`의 훅만 쓴다", 8.5의 무효화 표(로그아웃 → Query 캐시 전체 비움)가 `queries/`의 몫이다. `queries/`의 첫 파일이므로 인용 검사 대상에 `queries`를 더한다 — 틀리면 훅 셋을 `platform/`으로 옮긴다.
7. 결정: QueryClient는 D2가 만들되 스펙 8.5의 기본값(재시도 끔·`staleTime` 0)만 둔다. AppState→`focusManager`, NetInfo→`onlineManager`는 조회 화면이 생기는 D3가 붙인다 — 로그아웃이 캐시를 비우고 쓰기 훅이 돌려면 QueryClient가 있어야 하지만, 재조회 배선은 조회가 없으면 잴 수 없다 — 틀리면 D3가 `platform/query-client.ts`에 두 줄을 더한다.
8. 결정: 스피너는 React Native `ActivityIndicator`다(`Loader2` 아이콘이 아니다) — Uniwind 1.12.0에는 `animate-spin` 같은 CSS 애니메이션 처리가 없다(`node_modules/uniwind/dist`에 animation·keyframes 처리가 없고 web용 `Animated` 타입 하나뿐, 2026-09-30 확인). 정지한 아이콘은 스피너가 아니다 — 틀리면 스피너 두 자리를 바꾼다.
9. 결정: 플로가 일부러 일으키는 2xx 밖의 상태와 앱별 언어는 플로 파일 머리말 주석(`# e2e-allow-http: 409`, `# e2e-app-locale: ko-KR`)으로 선언한다 — 스펙 11.3은 "플로가 선언하지 않은 4xx·5xx"라고 적는다. 선언이 플로 옆에 있어야 플로를 고치는 사람이 함께 고친다 — 틀리면 하네스의 표로 옮긴다.
10. 결정: Windows 짧은 경로 빌드는 하네스가 자동으로 한다 — 추적·미추적(무시 제외) 파일을 `E2E_STAGE_DIR`(기본 `C:/t/e`)에 복사하고 그곳의 `node_modules`는 남긴다. 하네스가 만든 표식(`.e2e-stage`)이 없는 비어 있지 않은 디렉터리는 지우지 않는다 — D1 판정(47자 제한, `subst` 불가)이 요구한 자동화다 — 틀리면 사용자가 `E2E_STAGE_DIR`로 다른 곳을 준다.
11. 결정: 빌드 입력의 지문이 지난번과 같으면 APK를 다시 만들지 않는다. 지문은 `test/`·`docs/`·`scripts/`·`*.md`를 뺀 추적·미추적 파일의 이름과 내용, 그리고 앱이 볼 `BACKEND_URL`이다 — 네이티브 빌드는 5~6분이고 게이트는 여러 번 돈다. 플로만 고친 실행은 빌드하지 않는다 — 틀리면(지문이 빠뜨린 입력이 있으면) 낡은 APK로 E2E가 돈다. `E2E_FORCE_BUILD=1`이 탈출구다.
12. 결정: D2는 새 브랜치 `feat/d2-session-auth`를 D1 마무리 결과에서 만든다 — `main`으로 병합됐으면 `main`, 아니면 `feat/d1-skeleton-core`의 끝이다. 컨트롤러가 이미 만들었으면 그대로 쓴다 — 계획마다 브랜치 하나(D1 관례) — 틀리면 이름만 바뀐다.
13. 결정: E2E는 게이트의 `[12/12]`다. 계약 거울(스펙 12장의 12단계)은 D5가 E2E 앞에 더하고 그때 `[13/13]`이 된다 — 도는 척만 하는 단계를 미리 두지 않는다(`check.sh` 머리말의 계약) — 틀리면 번호만 바뀐다.
14. 결정: 로그아웃 뒤 이동은 `useMutation` 옵션의 `onSettled`(훅 수준)에서 `router.dismissTo('/')`로 한다 — 로그아웃 버튼은 로그인 상태에서만 그려져 `signOut`과 함께 사라지고, `mutate()`에 넘긴 호출별 콜백은 언마운트된 호출자에게 불리지 않는다(TanStack Query v5의 문서화된 동작). 성공·실패 모두 이동한다 — 기기 쪽은 이미 비었다 — 틀리면 로그아웃 뒤 홈으로 가지 않는 것을 E2E가 잡는다.
15. 결정: `components/ui/input.tsx`는 React Native Reusables CLI로 받고 `placeholderClassName` 한 곳만 고친다 — 원본 레지스트리의 uniwind `input`은 그 prop을 구조 분해하는데, NativeWind의 prop이라 Uniwind의 `TextInputProps`(`node_modules/uniwind/types.d.ts`)에 없어 typecheck가 실패한다 — 틀리면 CLI 출력 그대로 둔다.
16. 결정: 회전 도중 로그아웃이나 새 로그인이 있으면 늦게 온 회전 결과를 버린다(세대 번호) — 로그아웃한 세션이 늦게 도착한 회전 응답으로 되살아나면 "로그아웃했는데 로그인 상태"가 된다 — 틀리면 그 한 갈래와 시험 하나를 지운다.
17. 결정: E2E 가드의 로그 검사는 `test/e2e/guard-log.sh`로 떼고 vitest로 잰다. 앱이 찍는 한 줄(`lib/jsonapi/failure-log.ts`의 `httpFailureLine`)을 그 시험이 스크립트에 먹여, 앱의 형식과 하네스의 파싱을 한 시험이 맞댄다 — 한 번도 걸리지 않는 가드는 있으나 마나다(원본 인용 검사가 겪은 일) — 틀리면 검사를 `run-android.sh` 안으로 되돌린다.
18. 결정: 인증 화면 이동은 `router.dismissTo(to)`다 — 로그인·가입 화면은 루트 Stack에서 `(app)` 위에 쌓인다. `dismissTo`는 대상이 스택에 있으면 거기까지 닫고, 없으면(가드가 `(app)`을 로그인으로 바꿔 끼운 경우) 현재 화면을 대상으로 바꾼다(expo-router 57.0.24의 `Router` 타입 문서). `replace`는 홈 위에 홈을 한 벌 더 쌓는다 — 틀리면 뒤로 가기가 홈을 한 번 더 지나는 것뿐이다.
19. 결정: 세션 저장 매체의 설정 플러그인은 `['expo-secure-store', { configureAndroidBackup: true, faceIDPermission: false }]`다 — 스펙 7.1의 백업 제외를 명시하고, 생체 인증을 쓰지 않으므로(스펙 1.2) iOS Info.plist에 Face ID 문구를 넣지 않는다(플러그인이 `string | false`를 받는다) — 틀리면 쓰지 않는 문구 한 줄이 Info.plist에 들어간다.
20. 결정: 로그인·가입의 요청은 성공했는데 세션 저장이 던지면(SecureStore 오류) 폼에 `UNUSABLE_RESPONSE_MESSAGE`를 띄운다 — 조용히 멈추지 않는다 — 틀리면 그 드문 경우에 가입 화면이 "계정은 만들어졌습니다"를 띄우지 못한다.
21. 결정: Maestro 플로는 요소를 `testID`(`id:`)로만 찾는다. 로캘 판정만 문구를 본다 — 완성형 한글 음절 `[\uAC00-\uD7A3]`의 유무다 — 오류 문구는 백엔드가 협상한 언어라 문자열로 찾으면 로캘마다 깨진다 — 틀리면 자모만 든 문구를 놓친다(백엔드 문구는 완성형이다).
22. 결정: E2E 에뮬레이터의 자동 완성 서비스를 끈다(`settings put secure autofill_service null`) — 비밀번호 칸이 있는 폼을 제출하면 Android가 "비밀번호를 저장할까요" 대화상자를 띄워 플로의 다음 단계를 가릴 수 있다. 앱의 입력은 자동 완성을 막지 않는다(실사용자의 편의) — 틀리면 에뮬레이터 설정 한 줄이 불필요할 뿐이다.
23. 결정: 인증 폼의 네트워크 실패·타임아웃에는 따로 "다시 시도" 버튼을 두지 않는다 — 스펙 9.3의 앱 문구(`UNUSABLE_RESPONSE_MESSAGE`, 복사본)가 배너에 뜨고, 입력이 그대로 남은 폼의 제출 버튼이 곧 다시 시도다. 9.3의 버튼은 조회 화면의 오류 상태(D3)에 둔다 — 틀리면 배너에 버튼 하나를 더한다.
24. 결정: D1이 넘긴 게이트 보강(lib 경계의 위 계층·`@react-navigation/*`, 원본 그대로인 사본의 내용 검사, 드라이브 문자 경로)을 새 Task 1로 앞세운다 — 이 계획이 `lib/` 파일 여덟과 복사본 열하나를 더하므로, 검사가 먼저 서야 그 파일들이 처음부터 검사를 받는다(D1 운반 기록의 "lib 경계"·"출처 검사") — 틀리면 태스크 순서만 바뀐다.
25. 결정: `import/no-extraneous-dependencies`를 저장소 전체에 기본 옵션(devDependencies는 어디서든 허용)으로 켠다 — hoisted 링커가 선언하지 않은 전이 의존성(`expo-modules-core` 등)을 풀어 주고, 그 import는 번들·시험을 통과한다. 지금 트리의 위반은 0건이다(2026-09-30에 이 설정으로 확인). 앱 코드에서 devDependencies까지 막는 강한 설정은 막을 사례가 없어 쓰지 않는다 — 틀리면(정당한 import가 막히면) 그 패키지를 `package.json`에 선언한다.
26. 결정: 위 계층 패턴은 `@/platform/*`가 아니라 `**/platform/*`처럼 앞에 `**`를 둔다 — 별칭과 상대 경로(`../../platform/api`)를 함께 막는다(ESLint 9.39.5의 `no-restricted-imports`로 두 모양을 확인했고, `@/lib/config/app-variant`·`../jsonapi/client`·`firebase/app` 같은 경로는 통과한다) — 틀리면(대가: `lib/` 안에 `platform`·`queries`·`components`·`app`이라는 디렉터리를 만들 수 없다) 그 디렉터리를 만드는 사람이 패턴을 별칭으로 좁힌다.
27. 결정: 출처 기록에 `sourceBlobs`(경로 → 원본 blob SHA-1)를 더하고 이탈이 없는 경로만 적는다. 검사기는 작업 트리 바이트의 blob SHA-1을 직접 계산한다 — git 없이 돌고(`.gitattributes`의 `eol=lf` 덕에 `git hash-object`와 같다, 시험이 그 동일성을 git으로 잰다), 이탈이 생긴 파일은 항목을 지워야 해서 "고치고 적지 않음"과 "적고 항목을 남김"이 모두 걸린다 — 틀리면 기록의 키 하나와 검사기 한 절을 지운다.
28. 결정: 시작 설정의 판단(extra 읽기, 검증 실패 → 문구)을 `lib/config/startup.ts`로 옮기되, 설정 자리를 바꾸는 `setSettingsSource` 호출과 `expo-constants` 호출은 `platform/config.ts`에 남긴다 — 루트 `AGENTS.md`의 계층 표가 `lib/config/`는 "설정 자리의 바인딩"을 소유하지 않는다고 적는다. 시험은 `platform/config.ts`와 같은 두 줄(`setSettingsSource(() => settingsEnvFromExtra(extra))` → `checkStartupSettings(getSettings)`)로 실패 경로 여섯(유효·빈 extra·extra 없음·문자열 아님·상대 URL·재호출)을 잰다 — 틀리면 바인딩까지 lib로 옮기고 표를 고친다.
29. 결정: 네이티브 HTTP 캐시 운반 중 "E2E는 로그아웃 뒤 다른 사용자로 로그인하면 새 사용자가 보인다를 단언한다"는 그대로 하지 않는다. 대신 (a) 세 백엔드의 `GET /api/v1/users/me`(인증)와 `/api/v1/examples`·`/api/v1/examples/<id>`(공개) 응답 머리글을 재어 D2 실측 기록에 남기고(D3의 "D2가 잰 헤더 기준" 운반이 이것을 읽는다), (b) `register-restore-logout` 플로가 로그아웃 뒤 다른 이메일로 가입해 로그인 상태가 되는 데까지 지난다 — 스펙 7.4가 "헤더는 로그아웃 버튼만, `GET /users/me`는 부르지 않는다"로 정해 누구로 로그인했는지 그리는 화면이 없고, 그런 화면을 만들면 7.4를 어긴다. D2 앱의 요청은 전부 POST라 네이티브 캐시가 저장하지 않고, 읽기는 토큰 없이 보내므로(7.2) 사용자마다 다른 GET도 없다 — 틀리면 스펙 7.4를 고친 뒤 `/users/me`를 그리는 화면 하나와 단언 하나를 더한다.
30. 결정: `pnpm-workspace.yaml`의 `minimumReleaseAgeExclude`는 Task 4의 설치(D2의 첫 의존성 변경) 때 릴리스 후 하루가 지난 항목만 스크립트로 뺀다 — D1 운반 기록은 "다섯은 10:59 UTC 이후"라고 적지만 파일에는 여섯이 있고 가장 늦은 `lucide-react-native@1.49.0`은 2026-09-29 22:27 UTC 릴리스다(레지스트리 확인). 결과가 실행 시각에 달려 있어 시각을 레지스트리(`pnpm view … time --json`)에서 읽어 정한다 — 틀리면 `pnpm install --frozen-lockfile`이 `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`으로 알려 준다.
31. 결정: 클라이언트 타이머 가드(D1 운반의 "선택": 호출자가 이미 끊은 뒤 타이머가 돌면 `timedOut`을 세우지 않는다)는 하지 않는다 — D2의 요청은 어느 것도 호출자 signal을 넘기지 않는다(쓰기 훅·세션 관리자). 끊는 호출자가 없으면 그 창은 열리지 않는다 — 틀리면 조회 화면(D3)이 TanStack Query 취소를 붙일 때 `client.ts` 한 줄·시험 하나·이탈 기록 한 줄을 더한다.
32. 결정: 루트 레이아웃은 설정 검증이 통과했을 때만 스플래시를 잡고(`preventAutoHideAsync`) 세션 복원을 시작하며, 세션 상태 훅과 `QueryClientProvider`는 `STARTUP.ok` 갈래 안의 자식(`AppRoot`)에 둔다 — D1 운반 기록의 "루트 훅은 `STARTUP.ok` 가지 안의 자식에 둔다". 설정이 틀린 앱은 스플래시를 잡지 않아 치명 오류 화면이 곧바로 보인다 — 틀리면 루트 파일 하나의 모양만 바뀐다.

---

## 이 계획이 근거로 삼은 사실 (2026-09-30 확인)

추측이 아니라 그날 소스·설치본·백엔드 코드에서 직접 읽은 것이다.

**Expo Router 57.0.24** (`node_modules/expo-router/build`): `Redirect`(`link/Redirect.d.ts`, `href: Href`, 마운트되자마자 이동), `Stack.Screen`(`layouts/StackClient.d.ts`), `usePathname`·`useLocalSearchParams`·`router`(명령형), `router.dismissTo(href)` — "href까지 닫고, 없으면 현재 화면을 href로 바꾼다"(`global-state/router.d.ts`). 레이아웃의 `unstable_settings`는 `anchor ?? initialRouteName`을 읽는다(`getRoutesCore.js`). 타입드 라우트의 `Href`는 생성된 경로의 합집합이라 런타임에 만든 문자열은 단언이 필요하다. 생성 전에는 `string | HrefObject`다.

**expo-splash-screen 57.0.9**: `preventAutoHideAsync()`(모듈 평가 시점에 부르라는 안내), `hide()`, `hideAsync()`. expo-router는 내비게이션이 준비되면 `internalMaybeHideAsync`를 부르는데, 사용자가 `preventAutoHideAsync`를 불렀으면 네이티브 쪽이 그것을 존중한다.

**expo-secure-store 설정 플러그인**(expo `main`의 `plugin/src/withSecureStore.ts`): `faceIDPermission?: string | false`, `configureAndroidBackup?: boolean`(기본 `true`) — 켜면 `android:fullBackupContent`와 `android:dataExtractionRules`를 SecureStore 제외 규칙으로 건다. API는 `getItemAsync`·`setItemAsync`·`deleteItemAsync(key, options)`, 옵션 `keychainAccessible: AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`.

**Uniwind 1.12.0**(`node_modules/uniwind/types.d.ts`): `TextInputProps`에 `className`·`cursorColorClassName`·`placeholderTextColorClassName` 등이 있고 `placeholderClassName`은 없다. `ActivityIndicatorProps`에 `colorClassName`이 있고 `accent-*` 클래스에서 색을 읽는다(`dist/common/components/native/ActivityIndicator.js`의 `useAccentColor`). `ScrollViewProps`에 `contentContainerClassName`이 있다.

**React Native Reusables의 uniwind `input`**(레지스트리 `packages/registry/src/uniwind/components/ui/input.tsx`): `TextInput`을 감싸고 `{ className, placeholderClassName, ...props }`로 받는다.

**세 백엔드의 Accept-Language**: FastAPI `app/jsonapi/localization.py`의 `resolve_language`, NestJS `src/app/jsonapi/language.ts`, Rails `app/controllers/concerns/jsonapi_errors.rb` 모두 기본 하위 태그(`ko-KR` → `ko`)로 ko·en을 고르고 품질값이 1순위, 등장 순서가 뒤 순위다. 품질값이 없으면 1이다. 헤더가 없거나 고를 것이 없으면 `ko`다. 그래서 `ko-KR,en-US;q=0.9`는 ko, `en-US`는 en이다.

**FastAPI 인증 입력**(`app/schemas/auth.py`): 비밀번호 12~128자, 이메일 254자까지. 없는 이메일로 로그인해도 401 `INVALID_CREDENTIALS`다(원본 E2E의 실측).

**Metro 고정**: hoisted 트리에서 `uniwind`와 `@expo/metro`가 푸는 `metro`·`metro-cache`·`metro-transform-worker`는 같은 파일(`node_modules/metro/package.json` 등, 0.84.5)이고, `@react-native/community-cli-plugin`은 자기 `node_modules`의 0.84.6을 푼다(`createRequire`로 확인).

**Node 24.19.0의 타입 제거**: `node --input-type=module -e "import { probeEmail } from './test/e2e/probe-email.ts'; …" <라벨>`이 `probe-e2e-<라벨>-<uuid>@probe.example`(로컬 파트 64자 이하)을 낸다. `process.argv[1]`이 첫 추가 인자다.

**D1 끝의 저장소**(`main`의 병합 커밋 `1312848`, 2026-09-30 18:47): `scripts/check.sh`는 정적 단계 11개이고 `[5/11]` 인용 단계가 `./scripts/check-citations.sh app components lib platform test`를 부른다. `[10/11]` 번들은 `expo export --clear`이고(D1 판정 R38), 머리말의 전제 조건은 넷이다(넷째: `[10]`이 캐시를 지우니 `expo start`를 끈다). `test/unit/scripts/check-citations.test.ts`의 `GATE_TARGETS`가 [5]의 인자를 맞댄다(정렬 뒤 비교, 주석과 시험 이름에 "다섯"·"`[5/11]`"). 게이트 단계 번호 `[N/11]`은 `check.sh` 말고도 그 시험의 주석, `lib/config/AGENTS.md`(`[8/11]`), 출처 기록의 `note`와 인용 시험 이탈의 `what`(`[5/11]`)에 나온다. 출처 기록은 경로 33개·이탈 10건이고, 이탈이 없는 경로 27개는 모두 원본 커밋의 blob과 같다(작업 트리의 `git hash-object` 대 원본의 `git rev-parse <commit>:<경로>`). 단위 시험 407개, expo-doctor 21/21. `lib/jsonapi/client.ts`는 본문 읽기를 요청 signal과 경주시킨다(`readJson()`, D1 판정 R37) — 공개 표면(`request`·`RequestOptions`·`JsonApiResult`·`withAcceptLanguage`)은 그대로다. D1이 뒤 계획에 넘긴 항목은 `docs/superpowers/notes/2026-09-30-d1-carry-forward.md`에 있다.

**미리 돌려 본 것**: Task 1은 `1312848`과 같은 트리의 사본(node_modules는 실제 설치본을 가리키는 연결)에서 RED(lint 11·출처 17)와 GREEN(lint 41·scripts 89), 저장소 전체 lint 0건, 실제 기록 27/27을 확인했다. Task 2–5의 코드와 Task 6의 가드 스크립트·시험·플로는 `01cdaa2`의 사본에서 tsc 두 프로그램·ESLint·Prettier·vitest(그때 D1의 401개를 포함해 602개)·인용 검사를 통과했다 — 타입드 라우트를 만들기 전과 뒤 모두, 설치하지 않은 두 패키지(`@tanstack/react-query`·`expo-secure-store`)는 타입 모양만 흉내 냈다. 그 전체 트리에 Task 1의 ESLint 설정을 얹어도 위반은 설치하지 않은 두 패키지의 `import/no-unresolved`뿐이었다. Task 2·3은 `1312848` 위에서(Task 1 뒤) 다시 돌려 보았다(인증 시험 148개, 출처 44·17·31). 기기·Docker·Maestro가 필요한 단계는 돌리지 않았다.

**ESLint 규칙 둘**(ESLint 9.39.5·eslint-plugin-import 2.32.0): `no-restricted-imports`의 `group` 패턴 `**/platform/*`는 `@/platform/api`와 `../../platform/api`를 모두 막고 `@/lib/config/app-variant`·`../jsonapi/client`·`firebase/app`은 통과시킨다. `import/no-extraneous-dependencies`는 선언하지 않은 hoisted 패키지(`expo-font`·`expo-modules-core`)를 잡고, 지금 트리에는 위반이 없다. SDK 57의 expo-router는 `@react-navigation/*`에 의존하지 않는다 — 설치본에 없다.

**Maestro 2.11.0**(`~/.maestro/lib/maestro-cli-2.11.0.jar`): `maestro/cli/analytics/Analytics.class`가 `MAESTRO_CLI_NO_ANALYTICS`의 존재만 본다(`System.getenv(…) != null`). `MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED`는 `insights/TestAnalysisManager`가 읽는다.

**세 백엔드의 `/users/me`와 캐시 머리글**(형제 저장소의 소스): FastAPI `users_controller.py`, NestJS `users.controller.ts`, Rails `config/routes.rb`의 `get "users/me"` — 셋 다 `GET /api/v1/users/me`(Bearer)가 있다. 가입은 `{data:{type:"users",attributes:{email,password}}}`, 로그인은 `type:"authCredentials"`에 같은 attributes다(`lib/auth/credentials.ts`의 원본 주석). 세 API 코드 어디에도 `Cache-Control`을 싣는 곳이 없다(Rails의 정적 파일 서버 설정만 있다). 프레임워크 기본값(Rails의 `Rack::ETag`, Express의 ETag)이 무엇을 싣는지는 재지 않았다 — Task 6이 잰다.

**`minimumReleaseAgeExclude`의 여섯**(레지스트리, 2026-09-30 09:50 UTC에 `pnpm view … time --json`): Expo 다섯은 2026-09-29 10:56–10:59 UTC, `lucide-react-native@1.49.0`은 22:27 UTC 릴리스다. 새로 설치할 `@tanstack/react-query@5.104.0`은 2026-09-26, `expo-secure-store`의 최신 57.0.x(57.0.4)는 2026-09-11 릴리스라 예외가 필요 없다.

---

## D1에서 이어받은 것

### 판정 (D1 원장 R1–R38)

| 판정 | 내용 | D2에서 |
| --- | --- | --- |
| R1 | `.superpowers/`는 루트 `.gitignore`에 있다 | 그대로 |
| R2 | 설정을 평가하는 명령에 `BACKEND_URL=https://gate-check.invalid` | Global Constraints, 모든 태스크 |
| R3 | 컨트롤러가 브랜치를 미리 만들면 구현자는 확인만 한다 | Task 1 Step 1 |
| R4 | M7 대체 경로 | 쓰지 않았다(M7 = 예) |
| R5·R6·R15 | pnpm 설정은 `pnpm-workspace.yaml`, 링커는 hoisted | 그대로 |
| R7 | pnpm이 적는 `minimumReleaseAgeExclude`를 받아들인다 | Task 4 설치 |
| R8·R10 | `pnpm peers check`가 깨끗해야 한다 | Task 4 Step 1 |
| R9 | `expo install`이 만든 `app.json`은 지운다 | Task 4 Step 1 |
| R11 | vitest 설정은 `.mjs` | 그대로 |
| R12 | 한 파일 시험은 `pnpm exec vitest run <파일>` | Global Constraints |
| R13 | 빌드 스크립트 허용은 `allowBuilds`에 적는다 | 새 의존성이 묻으면 같은 방식 |
| R14 | lib 경계는 스펙 5장 전체(`@react-native*`, `lib/**` 모든 확장자) | Task 1이 위 계층·`@react-navigation/*`까지 넓힌다. 새 lib 파일이 지킨다 |
| R16 | Windows Android 빌드는 47자 이하 실제 경로, `subst` 불가 — D2가 게이트의 자동 짧은 경로 빌드와 `android.sh`의 경로 길이 검사를 설계한다 | Task 6 |
| R17 | secretlint 스크립트 이름은 `lint:secrets` | 그대로 |
| R18 | Uniwind `@media` 결함(`sm:`)의 대응은 D3가 정한다 | D2는 받은 컴포넌트의 `sm:`를 그대로 두고 새로 쓰지 않는다 |
| R19·R20·R21 | 새 체크아웃 typecheck·lint, 타입 프로그램 둘(앱·시험) | 시험이 import하는 lib 파일의 타이머는 `ReturnType<typeof setTimeout>` — D2 lib에는 타이머가 없다 |
| R22 | 출처 기록의 경로는 저장소 안의 상대 경로·정규 파일 | Task 1이 드라이브 문자 경로도 거절한다. Task 2의 새 경로가 지킨다 |
| R23 | Promise를 돌려주는 `mockImplementation`이 있으면 fetch 목의 타입을 좁힌다 | 복사한 시험은 `mockResolvedValue`만 써서 원본 그대로 둔다 |
| R24 | `client.ts`의 `finally` 정리(호출자 signal 리스너 해제)를 시험으로 고정 | D1에서 끝났다 |
| R25 | 복사한 주석은 원본의 것이다 | Task 2 — 바뀐 코드의 주석만 고친다 |
| R26·R27 | Rails Host 검사, compose 주석 | 해당 없음 |
| R28 | 전역 fetch는 `expo/fetch` | Global Constraints |
| R29 | `components/app/`(앱 전체 화면 조각) | Task 5의 로그아웃 버튼이 여기 산다 |
| R30 | 진행 방식 | 해당 없음 |
| R31·R33·R35 | 최종 리뷰 A의 문서 수정, `.gitignore`의 자격증명 줄, expo-doctor 에도 `BACKEND_URL` | D1에서 끝났다 |
| R32 | 최종 리뷰의 m-2(lib 경계)·m-3(시작 설정 판단과 부팅 순서)·m-10(출처 내용 검사)을 D2가 맡는다 | Task 1(m-2·m-10), Task 4(m-3) |
| R34 | Windows에서 게이트는 Git Bash의 `./scripts/check.sh` | Global Constraints |
| R36 | 리뷰 마이너 G1–G5 | D1에서 끝났다. G5가 남긴 "(미측정 - D2가 잰다)" 다섯 자리는 Task 6이 실측 기록을 가리키게 고친다 |
| R37 | `client.ts`가 본문 읽기를 요청 signal과 경주시킨다 | 그대로 — D2 코드는 `request()`의 공개 표면만 쓴다 |
| R38 | 게이트 `[10]`은 `expo export --clear` — Gradle 번들 단계를 지켜보고 같은 죽음이면 시간을 정해 원인을 찾는다 | Global Constraints, Task 4·5의 번들, Task 6 |

### D1 운반 기록의 "D2" 절

정본은 `docs/superpowers/notes/2026-09-30-d1-carry-forward.md`다. D1 원장의 "Carry to D2"와 "→ D2" 사소한 것이 모두 여기 들어 있다.

| 항목 | 맡은 곳 |
| --- | --- |
| 에뮬레이터에 계측 화면이 든 APK가 남아 있다 — E2E 전에 다시 빌드 | Task 6 — 하네스의 첫 실행은 지문 도장이 없어 반드시 빌드하고, 매 실행 `install -r`한다 |
| `android.sh`: `wait_text`를 `SECONDS` 기한으로, 숨긴 adb 오류를 드러낸다 | Task 6 Step 2 |
| `android.sh`: 기기 둘 이상이고 `ANDROID_SERIAL`이 없으면 곧바로 실패 | Task 6 Step 2 |
| `android.sh`: 빌드 전에 Windows 경로 길이(47자) 검사 | Task 6 Step 2(`check-path`) |
| Maestro 규칙 넷(따옴표·`launchApp` 뒤 대기·디버그 로그·로캘 플로의 `clearState` 금지) | Task 6 플로와 `test/e2e/AGENTS.md` |
| Maestro 로그는 `--debug-output <dir>`로, 분석 끄기 환경 변수를 실행마다 | Task 6 `run-android.sh`(`MAESTRO_CLI_NO_ANALYTICS=1`) |
| 취소 오류를 이름으로 가르지 않는다 | Global Constraints — D2 코드는 오류 이름을 보지 않는다 |
| `getSettings()`는 요청 시점에만 | Global Constraints, Task 4의 `platform/AGENTS.md` |
| 루트 훅은 `STARTUP.ok` 가지 안의 자식에 | Task 4 Step 8(결정 32), `platform/AGENTS.md` |
| `platform/config.ts`의 순수 부분을 `lib/config`로 옮겨 여섯 사례로 시험, 머리 주석 자리 | Task 4 Step 7(결정 28) |
| lib 경계: 위 계층·`@react-navigation/*`, 행마다 `toEqual(libRule())` | Task 1 |
| `import/no-extraneous-dependencies` 검토 | Task 1 — 켠다(결정 25) |
| 출처 검사: 원본 blob SHA, 스펙 6.3 다섯째 규칙 | Task 1 |
| 출처 검사: 드라이브 상대 경로(`C:..\x`) 거절 | Task 1 |
| 네이티브 HTTP 캐시: 세 백엔드의 인증된 GET 머리글 기록 | Task 6 Step 5(결정 29) |
| 네이티브 HTTP 캐시: "다른 사용자로 로그인하면 새 사용자가 보인다" E2E | 결정 29 — 스펙 7.4와 부딪혀 사용자 전환을 지나는 데까지만 한다(Task 6 Step 4) |
| Gradle 번들 단계의 0xC0000005 | Global Constraints, Task 6 Step 6의 실패 처리 |
| `minimumReleaseAgeExclude`를 첫 의존성 변경 때 뺀다 | Task 4 Step 1(결정 30) |
| Metro 중복 고정 옆에 이유 | Task 4 Step 6 |
| 클라이언트 타이머 가드(선택) | 하지 않는다(결정 31) |
| `expo install` 자체가 `BACKEND_URL`을 요구한다(D1 원장) | Global Constraints |

---

## 태스크 지도

| 태스크 | 산출 | 시험 | 기기 |
| --- | --- | --- | --- |
| 1 게이트 보강 | lib 경계(위 계층·`@react-navigation/*`), `import/no-extraneous-dependencies`, 출처 기록의 `sourceBlobs`와 내용 검사·드라이브 문자 경로 거절 | 경계·의존성 시험, 검사기 시험 + 실제 기록 + 한 줄 뮤턴트 | 없음 |
| 2 인증 판단 복사 — 전송 주입 | `lib/auth/` 복사본 다섯, `send.ts`, `protected-paths.ts`, `probe-email.ts` | 복사한 시험(전송 주입으로 고침) + 보호 경로 | 없음 |
| 3 세션 저장소와 세션 관리자 | `session-store.ts`, `session-manager.ts`, `lib/auth/AGENTS.md` | 복원 판단, 회전 동시성·저장 순서·거절·닿지 못함 | 없음 |
| 4 platform 바인딩과 앱 시작 | 시작 설정 판단(`lib/config/startup.ts`), API 클라이언트(Accept-Language 한 곳·e2e 실패 표식), SecureStore, 세션 훅, QueryClient, 스플래시 유지 복원 | 시작 설정, Accept-Language 조립, 실패 표식, 변형 표, 앱 설정, Metro 동일성 + 번들 | 없음 |
| 5 가입·로그인·로그아웃 화면과 경로 가드 | 화면·폼·헤더 버튼·가드·쓰기 훅, 인용 대상 `queries` | 인용 대상 시험 + 정적 검사·번들 | 없음 |
| 6 인증 E2E와 게이트 `[12/12]` | 하네스·가드·플로 여섯·`check.sh` 단계, 세 백엔드의 캐시 머리글 기록 | 가드 스크립트 시험 + 기기 E2E + 전체 게이트 | **여기서만** |

기기 작업은 Task 6 하나에 모인다. APK는 Task 6에서 한 번 빌드되고(화면을 고치면 다시), 마지막 게이트 실행은 지문이 같아 빌드하지 않는다. 에뮬레이터와 백엔드 스택은 하네스 한 번에 한 번 뜨고, 플로 여섯이 그 위에서 차례로 돈다. 세 백엔드의 머리글 측정은 기기 없이 Docker만 쓴다(프로파일마다 한 번 띄우고 내린다).

---

## File Structure

```text
eslint.config.js                     (수정) lib 위 계층·@react-navigation 금지, 선언 안 한 의존성  — Task 1
scripts/check-provenance.mjs         (수정) sourceBlobs 내용 검사, 드라이브 문자 경로 거절         — Task 1
lib/jsonapi/send.ts                  (신규) 전송 함수의 모양 JsonApiSend                         — Task 2
lib/jsonapi/accept-language.ts       (신규) 기기 언어 목록 → Accept-Language                      — Task 4
lib/jsonapi/failure-log.ts           (신규) e2e 실패 표식 한 줄                                   — Task 4
lib/auth/credentials.ts              (복사·수정) 가입·로그인 요청과 해석                          — Task 2
lib/auth/flow.ts                     (복사) 복귀 경로 검사, 폼 오류 상태, 로그인·가입 뒤 결정     — Task 2
lib/auth/form-state.ts               (복사·수정) 폼 입력 이름·상태                                — Task 2
lib/auth/logout.ts                   (복사·수정) 기기 먼저 비우고 refresh 폐기                    — Task 2
lib/auth/rotation.ts                 (복사·수정) 회전 요청과 해석                                 — Task 2
lib/auth/protected-paths.ts          (신규) 보호 경로 목록 하나, 로그인 주소                      — Task 2
lib/auth/session-store.ts            (신규) 저장 모양(항목 하나의 JSON), 복원 판단                — Task 3
lib/auth/session-manager.ts          (신규) 회전의 유일한 자리, 세션 상태                         — Task 3
lib/auth/AGENTS.md                   (신규)                                                       — Task 3
lib/config/app-variant.ts            (수정) 변형 표에 logsHttpFailures                            — Task 4
lib/config/startup.ts                (신규) 시작 설정 판단(extra 읽기, 실패 → 문구)               — Task 4
platform/api.ts                      (신규) 앱의 API 클라이언트                                   — Task 4
platform/secure-session-storage.ts   (신규) 세션 항목의 SecureStore 매체                          — Task 4
platform/session.ts                  (신규) 세션 관리자 하나와 상태 훅                            — Task 4
platform/query-client.ts             (신규) Query 캐시 하나                                       — Task 4
platform/config.ts                   (다시 씀) 판단은 lib/config/startup.ts, startupVariant()     — Task 4
platform/AGENTS.md                   (신규)                                                       — Task 4
app/_layout.tsx                      (수정) STARTUP.ok 자식(AppRoot), 스플래시 유지 복원          — Task 4·5
app/(app)/_layout.tsx                (신규) 앱 셸 Stack, 헤더 로그아웃, 경로 가드                 — Task 5
app/(app)/index.tsx                  (수정) 홈(testID)                                            — Task 5
app/(app)/examples/new.tsx           (신규) 보호 경로의 자리                                      — Task 5
app/(auth)/login.tsx · register.tsx  (신규)                                                       — Task 5
components/ui/input.tsx              (RN Reusables CLI)                                           — Task 5
components/form/field-error.tsx · form-banner.tsx · submit-button.tsx · credentials-form.tsx     — Task 5
components/app/logout-button.tsx     (신규)                                                       — Task 5
queries/auth.ts · queries/AGENTS.md  (신규)                                                       — Task 5
test/e2e/probe-email.ts              (복사) 가입용 이메일                                         — Task 2
test/e2e/android.sh                  (수정) check-path, 기기 여럿, wait-text 기한, 자동 완성 끔   — Task 6
test/e2e/run-android.sh              (신규) E2E 하네스                                            — Task 6
test/e2e/guard-log.sh                (신규) 기기 로그 가드                                        — Task 6
test/e2e/flows/*.yaml                (신규) 플로 여섯                                             — Task 6
test/e2e/subflows/*.yaml             (신규) 공통 단계 넷                                          — Task 6
test/e2e/AGENTS.md                   (신규)                                                       — Task 6
scripts/check.sh                     (수정) [5] 대상에 queries(Task 5), [12/12] E2E(Task 6)
docs/provenance/copied-core.json     (수정) Task 1·2·5·6
docs/superpowers/notes/2026-09-30-d2-measurements.md  (신규) 세 백엔드의 캐시 머리글          — Task 6
```

시험: `test/unit/lint/{lib-boundary,dependencies}.test.ts`·`test/unit/scripts/check-provenance.test.ts`(Task 1), `test/unit/auth/{credentials,flow,logout,rotation}.test.ts`(복사), `test/unit/e2e/probe-email.test.ts`(복사), `test/unit/auth/{protected-paths,session-store,session-manager}.test.ts`, `test/unit/config/startup.test.ts`, `test/unit/jsonapi/{accept-language,failure-log}.test.ts`, `test/unit/deps/metro-pin.test.ts`, `test/unit/e2e/guard-log.test.ts`.

---

### Task 1: 게이트 보강 — lib 경계를 위 계층까지 넓히고, 원본 그대로인 사본의 내용을 잰다

D1이 넘긴 두 가지다(`docs/superpowers/notes/2026-09-30-d1-carry-forward.md`의 "lib 경계"·"출처 검사"). 이 계획이 `lib/` 파일과 복사본을 늘리기 전에 검사가 먼저 선다(결정 24).

**Files:**
- Modify: `eslint.config.js`, `test/unit/lint/lib-boundary.test.ts`, `scripts/check-provenance.mjs`, `test/unit/scripts/check-provenance.test.ts`, `docs/provenance/copied-core.json`, `AGENTS.md`, `lib/jsonapi/AGENTS.md`, `docs/superpowers/specs/2026-09-30-expo-jsonapi-template-design.md`(6.3 정정)
- Create: `test/unit/lint/dependencies.test.ts`

**Interfaces:**
- Consumes: D1의 `eslint.config.js`(lib 블록의 `no-restricted-imports`와 `PLATFORM_MODULE_PATTERNS`), `scripts/check-provenance.mjs`와 그 시험의 도우미(`VALID`·`run`·`runRaw`·`expectListed`·`dir`), 출처 기록(경로 33·이탈 10)
- Produces:
  - 출처 기록의 키 `sourceBlobs: { [경로]: string }` — 이탈이 없는 경로마다 원본 파일의 blob SHA-1(`git -C ../template-typescript-nextjs rev-parse <commit>:<경로>`). 이탈이 있는 경로는 넣지 않는다. Task 2가 그대로 복사한 넷을 여기에 더하고, 복사한 파일에 이탈을 처음 적는 사람은 그 항목을 지운다.
  - 검사기의 통과 줄 `복사 출처 기록 통과: 경로 N개, 이탈 M건, 원본 그대로 K개`
  - ESLint: `lib/**`에서 `**/platform/*`·`**/queries/*`·`**/components/*`·`**/app/*`·`@react-navigation/*` import 금지, 저장소 전체에 `import/no-extraneous-dependencies: 'error'`

- [ ] **Step 1: 작업 브랜치를 만든다**

컨트롤러가 브랜치를 만들어 두었으면 확인만 한다. 없으면 D1이 병합된 `main`에서 만든다.

```bash
git branch --show-current
git switch -c feat/d2-session-auth main   # 위 출력이 feat/d2-session-auth 가 아닐 때만
git log --oneline -1
git status --short
```

Expected: `feat/d2-session-auth`, 작업 트리가 깨끗하다. `main`에 병합 커밋 `1312848`(D1)이 있다.

- [ ] **Step 2: lib 경계와 의존성 선언의 시험을 쓰고 실패를 본다**

`test/unit/lint/lib-boundary.test.ts` — Edit, 찾을 것:

```ts
 * no-restricted-imports 는 import 선언과 export ... from 만 본다. 동적 import() 와
 * require() 는 대상이 아니라서 .cjs 행은 규칙 항목이 걸려 있는지만 잰다.
 */
```

바꿀 것:

```ts
 * no-restricted-imports 는 import 선언, export ... from, TypeScript 의 import x = require(...)
 * 를 본다(ESLint 9.39.5 의 no-restricted-imports.js 가 TSImportEqualsDeclaration 도 잰다). 동적
 * import() 와 require() 호출은 대상이 아니라서 .cjs 행은 규칙 항목이 걸려 있는지만 잰다.
 */
```

Edit — 찾을 것:

```ts
  '@react-native-async-storage/async-storage',
  '@rn-primitives/portal',
```

바꿀 것:

```ts
  '@react-native-async-storage/async-storage',
  '@react-navigation/native',
  '@rn-primitives/portal',
```

Edit — 찾을 것:

```ts
const ALLOWED = ['@/lib/jsonapi/query', './define', 'clsx', 'tailwind-merge']
```

바꿀 것:

```ts
// 위 계층은 별칭과 상대 경로 둘 다 막는다. 깊이가 다른 경로도 하나 둔다.
const UPPER_LAYER = [
  '@/platform/api',
  '@/queries/auth',
  '@/components/ui/button',
  '@/app/_layout',
  '@/platform/deep/probe',
  '../../platform/api',
]

const ALLOWED = [
  '@/lib/jsonapi/query',
  '@/lib/config/app-variant',
  './define',
  '../jsonapi/client',
  'clsx',
  'tailwind-merge',
]
```

Edit — 찾을 것:

```ts
  it.each(LIB_FILES)('%s 에는 no-restricted-imports 가 오류로 걸린다', async (filePath) => {
    expect(severityOf(await restrictionFor(filePath))).toBe(2)
  })
```

바꿀 것:

```ts
  it.each(LIB_FILES)('%s 에는 lib/ 의 no-restricted-imports 가 그대로 걸린다', async (filePath) => {
    const entry = await restrictionFor(filePath)
    expect(severityOf(entry)).toBe(2)
    // 심각도만 보면 뒤의 설정 블록이 어떤 디렉터리에서 패턴을 줄여 덮어써도 통과한다.
    expect(entry).toEqual(await libRule())
  })
```

Edit — 찾을 것:

```ts
  it.each(ALLOWED)('lib/ 에서 %s 는 허용된다', async (moduleName) => {
```

바꿀 것:

```ts
  it.each(UPPER_LAYER)(
    'lib/ 에서 위 계층 %s 를 import 하면 계층 메시지로 막힌다',
    async (moduleName) => {
      const messages = messagesFor(
        await libRule(),
        `import probe from '${moduleName}'\nexport default probe\n`,
      )
      expect(messages.map((message) => message.ruleId)).toEqual(['no-restricted-imports'])
      expect(messages[0]?.message).toMatch(/위 계층/)
    },
  )

  it.each(ALLOWED)('lib/ 에서 %s 는 허용된다', async (moduleName) => {
```

`test/unit/lint/dependencies.test.ts`:

```ts
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

/**
 * 선언하지 않은 패키지의 import 를 막는 규칙(import/no-extraneous-dependencies)을 잰다.
 *
 * pnpm 의 nodeLinker 가 hoisted 라서 전이 의존성도 node_modules 꼭대기에 풀린다 - package.json 에
 * 없는 패키지를 import 해도 번들과 시험이 통과하고, 그 패키지는 상위 패키지가 버전을 올리거나
 * 빼는 순간 사라진다. 표본의 expo-modules-core 는 expo 가 끌어오는 패키지이고 package.json 에는
 * 없다.
 *
 * 가상 파일을 전체 설정으로 lint 하면 타입 인식 규칙의 projectService 가 "프로젝트에 없는 파일"로
 * 죽는다(lib-boundary.test.ts 머리말). 그래서 실재하는 파일 경로에 표본 내용을 주고, ruleFilter
 * 로 이 규칙만 돌린다.
 */
const eslint = new ESLint({
  ruleFilter: ({ ruleId }) => ruleId === 'import/no-extraneous-dependencies',
})

async function ruleIdsFor(source: string, filePath: string): Promise<(string | null)[]> {
  const [result] = await eslint.lintText(source, { filePath })
  return (result?.messages ?? []).map((message) => message.ruleId)
}

// 첫 테스트가 설정 배열과 타입 프로그램을 처음 해석한다 - lib-boundary.test.ts 와 같은 이유로
// 기본 5초를 넘길 수 있다.
describe('선언하지 않은 의존성', { timeout: 60_000 }, () => {
  it.each([
    'platform/theme.ts',
    'app/_layout.tsx',
    'components/ui/text.tsx',
    'lib/config/settings.ts',
  ])('%s 에서 package.json 에 없는 패키지를 import 하면 막힌다', async (filePath) => {
    const source =
      "import { requireNativeModule } from 'expo-modules-core'\nexport const probe = requireNativeModule\n"
    expect(await ruleIdsFor(source, filePath)).toEqual(['import/no-extraneous-dependencies'])
  })

  it('package.json 에 있는 패키지는 통과한다', async () => {
    const source =
      "import { getLocales } from 'expo-localization'\nexport const probe = getLocales\n"
    expect(await ruleIdsFor(source, 'platform/theme.ts')).toEqual([])
  })
})
```

```bash
pnpm exec prettier --write test/unit/lint
pnpm exec vitest run test/unit/lint 2>&1 | grep -E "×|Tests "
```

Expected: FAIL 11 — `@react-navigation/native` 하나, 위 계층 여섯, 선언하지 않은 의존성 넷. 파일 행 여덟(`toEqual(await libRule())`)과 허용 여섯, 선언한 패키지는 통과한다.

- [ ] **Step 3: ESLint 설정을 넓힌다**

`eslint.config.js` — Edit, 찾을 것:

```js
  '@expo/*',
  '@react-native*',
  '@rn-primitives/*',
```

바꿀 것:

```js
  '@expo/*',
  '@react-native*',
  '@react-navigation/*',
  '@rn-primitives/*',
```

Edit — 찾을 것:

```js
  'lucide-react-native',
]
```

바꿀 것:

```js
  'lucide-react-native',
]

/**
 * lib/ 위의 계층(스펙 5장의 소유 표) - lib/ 는 맨 아래 계층이다. 위를 import 하면 시험이 그
 * 모듈을 vi.mock 해서 vitest 까지 통과해도 경계가 무너진다. 앞의 ** 가 별칭(@/platform/…)과
 * 상대 경로(../../platform/…)를 함께 잡는다. test/unit/lint/lib-boundary.test.ts 가 잰다.
 */
const UPPER_LAYER_PATTERNS = ['**/platform/*', '**/queries/*', '**/components/*', '**/app/*']
```

(주석에 `**/`를 쓰지 않는다 — `*/`가 블록 주석을 닫는다.)

Edit — 찾을 것:

```js
    rules: typeCheckedRules,
  },
```

바꿀 것:

```js
    rules: typeCheckedRules,
  },
  {
    // nodeLinker: hoisted 라서 선언하지 않은 전이 의존성(expo-modules-core 등)도 node_modules
    // 꼭대기에서 풀린다. package.json 에 없는 패키지의 import 를 막는다 -
    // test/unit/lint/dependencies.test.ts 가 잰다.
    files: ['**/*.{ts,tsx,js,jsx,mjs,cjs}'],
    rules: { 'import/no-extraneous-dependencies': 'error' },
  },
```

Edit — 찾을 것:

```js
              message:
                'lib/ 는 순수 TypeScript 다(스펙 5장). 네이티브·React 모듈은 platform/ 이나 queries/ 에서 쓴다.',
            },
```

바꿀 것:

```js
              message:
                'lib/ 는 순수 TypeScript 다(스펙 5장). 네이티브·React 모듈은 platform/ 이나 queries/ 에서 쓴다.',
            },
            {
              group: UPPER_LAYER_PATTERNS,
              message:
                'lib/ 는 위 계층(platform·queries·components·app)을 import 하지 않는다(스펙 5장). 위 계층이 lib/ 를 부른다.',
            },
```

```bash
pnpm exec prettier --write eslint.config.js
pnpm exec vitest run test/unit/lint
pnpm lint; echo "lint exit=$?"
```

Expected: PASS 41(lib 경계 36, 의존성 5). `lint exit=0` — 두 규칙의 위반이 지금 트리에 없다(2026-09-30에 이 설정으로 저장소 전체를 돌려 확인했다).

- [ ] **Step 4: 출처 검사의 시험을 쓰고 실패를 본다**

`test/unit/scripts/check-provenance.test.ts` — Edit, 찾을 것:

```ts
import { spawnSync } from 'node:child_process'
```

바꿀 것:

```ts
import { execFileSync, spawnSync } from 'node:child_process'
```

Edit — 찾을 것:

```ts
function run(record: unknown): Result {
  return runRaw(JSON.stringify(record))
}
```

바꿀 것:

```ts
function run(record: unknown): Result {
  return runRaw(JSON.stringify(record))
}

/** git 이 content 에 매기는 blob SHA-1. 검사기의 계산을 되풀이하지 않고 git 에게 묻는다. */
function blobOf(content: string): string {
  return execFileSync('git', ['hash-object', '--stdin'], {
    input: content,
    encoding: 'utf8',
  }).trim()
}
```

Edit — 찾을 것:

```ts
      /divergences\[0\]\.path/,
      /divergences\[0\]\.what/,
    ])
  })

  it('통과하면 경로와 이탈의 개수를 stdout 에 적고 stderr 는 비운다', () => {
    // 경로 수와 이탈 수가 달라야 둘을 바꿔 쓰는 실수가 드러난다.
    writeFileSync(join(dir, 'lib', 'second.ts'), 'export {}\n')
    const result = run({ ...VALID, paths: ['lib/copied.ts', 'lib/second.ts'] })
    expect(result.status).toBe(0)
    expect(result.stderr).toBe('')
    expect(result.stdout).toMatch(/경로 2개, 이탈 1건/)
  })
```

바꿀 것:

```ts
      /divergences\[0\]\.path/,
      /divergences\[0\]\.what/,
      // 이탈이 lib/other.ts 를 가리키므로 lib/copied.ts 는 원본 그대로여야 하는 경로다.
      /원본 blob 이 없다.*lib\/copied\.ts/,
    ])
  })

  it('통과하면 경로·이탈·원본 그대로인 사본의 개수를 stdout 에 적고 stderr 는 비운다', () => {
    // 세 수가 서로 달라야 둘을 바꿔 쓰는 실수가 드러난다.
    writeFileSync(join(dir, 'lib', 'second.ts'), 'export {}\n')
    writeFileSync(join(dir, 'lib', 'third.ts'), 'export const third = 3\n')
    const result = run({
      ...VALID,
      paths: ['lib/copied.ts', 'lib/second.ts', 'lib/third.ts'],
      sourceBlobs: {
        'lib/second.ts': blobOf('export {}\n'),
        'lib/third.ts': blobOf('export const third = 3\n'),
      },
    })
    expect(result.status).toBe(0)
    expect(result.stderr).toBe('')
    expect(result.stdout).toMatch(/경로 3개, 이탈 1건, 원본 그대로 2개/)
  })
```

Edit — 찾을 것:

```ts
  it('paths 의 절대 경로는 실재해도 실패한다', () => {
    const absolute = resolve(dir, 'lib', 'copied.ts')
    const result = run({ ...VALID, paths: ['lib/copied.ts', absolute] })
    expectListed(result, [/절대 경로/])
  })
```

바꿀 것:

```ts
  it('paths 의 절대 경로는 실재해도 실패한다', () => {
    const absolute = resolve(dir, 'lib', 'copied.ts')
    const result = run({ ...VALID, paths: ['lib/copied.ts', absolute] })
    expectListed(result, [/절대 경로/])
  })

  // Windows 에서 C:..\x 는 절대 경로가 아니고 첫 구간이 'C:..' 라 '..' 검사도 지난다. 존재 검사보다
  // 먼저 거절하므로 Linux 에서도 같은 문구가 나온다.
  it.each([
    ['드라이브 상대 경로', 'C:..\\outside.txt'],
    ['드라이브를 붙인 저장소 경로', 'C:lib/copied.ts'],
  ])('paths 의 %s 는 드라이브 문자로 시작한다고 실패한다', (_label, path) => {
    const result = run({ ...VALID, paths: ['lib/copied.ts', path] })
    expectListed(result, [/드라이브 문자/])
  })
```

파일 끝에 더한다:

```ts

/*
 * 형식만 보면 그대로 복사한 파일을 고치고 이탈을 적지 않아도 통과한다. 이탈이 없는 경로는
 * sourceBlobs 에 원본의 blob SHA-1 을 적고, 검사기가 작업 트리의 내용과 맞댄다.
 */
describe('check-provenance: sourceBlobs', () => {
  // lib/copied.ts 는 이탈이 있고(VALID), lib/second.ts 는 원본 그대로인 사본이다.
  const SECOND = 'export const second = 2\n'

  beforeEach(() => {
    writeFileSync(join(dir, 'lib', 'second.ts'), SECOND)
  })

  function withSecond(sourceBlobs: unknown): unknown {
    return { ...VALID, paths: ['lib/copied.ts', 'lib/second.ts'], sourceBlobs }
  }

  it('원본 그대로인 사본의 내용이 원본 blob 과 같으면 통과한다', () => {
    const result = run(withSecond({ 'lib/second.ts': blobOf(SECOND) }))
    expect(result.stderr).toBe('')
    expect(result.status).toBe(0)
    expect(result.stdout).toMatch(/원본 그대로 1개/)
  })

  it('내용이 원본과 다르면 두 SHA 를 적고 실패한다 - 이탈을 적지 않은 수정', () => {
    const original = blobOf('export const second = 1\n')
    const result = run(withSecond({ 'lib/second.ts': original }))
    expectListed(result, [/원본과 다르다.*lib\/second\.ts/])
    expect(result.stderr).toContain(`원본 ${original}, 작업 트리 ${blobOf(SECOND)}`)
  })

  it.each([
    ['항목이 없는', {}],
    ['표 자체가 없는', undefined],
  ])('이탈이 없는 경로의 원본 blob 이 %s 기록은 실패한다', (_label, sourceBlobs) => {
    expectListed(run(withSecond(sourceBlobs)), [/원본 blob 이 없다.*lib\/second\.ts/])
  })

  it('이탈이 있는 경로가 sourceBlobs 에 있으면 실패한다', () => {
    const result = run({ ...VALID, sourceBlobs: { 'lib/copied.ts': blobOf('export {}\n') } })
    expectListed(result, [/이탈이 있는 경로가 sourceBlobs 에 있다.*lib\/copied\.ts/])
  })

  it('sourceBlobs 의 경로가 paths 에 없으면 실패한다', () => {
    const result = run({ ...VALID, sourceBlobs: { 'lib/absent.ts': 'a'.repeat(40) } })
    expectListed(result, [/sourceBlobs 의 경로가 paths 에 없다.*lib\/absent\.ts/])
  })

  it.each([
    ['39자리', 'a'.repeat(39)],
    ['대문자', 'A'.repeat(40)],
    ['숫자', 42],
    ['null', null],
  ])('sourceBlobs 의 값이 %s 이면 형식 위반 하나로 실패한다', (_label, sha) => {
    expectListed(run(withSecond({ 'lib/second.ts': sha })), [
      /sourceBlobs\["lib\/second\.ts"\] 가 40자리 16진수가 아니다/,
    ])
  })

  it.each([
    ['배열', []],
    ['문자열', 'a'.repeat(40)],
    ['null', null],
  ])('sourceBlobs 가 %s 이면 객체가 아니라고 실패한다', (_label, sourceBlobs) => {
    expectListed(run({ ...VALID, sourceBlobs }), [/sourceBlobs 가 객체가 아니다/])
  })

  it('작업 트리의 blob 계산이 git hash-object 와 같다 - 한글과 여러 줄', () => {
    const content = '// 한글 주석\nexport const second = 2\n'
    writeFileSync(join(dir, 'lib', 'second.ts'), content)
    const sha = execFileSync('git', ['hash-object', join(dir, 'lib', 'second.ts')], {
      encoding: 'utf8',
    }).trim()
    expect(run(withSecond({ 'lib/second.ts': sha })).status).toBe(0)
  })
})
```

```bash
pnpm exec prettier --write test/unit/scripts/check-provenance.test.ts
pnpm exec vitest run test/unit/scripts/check-provenance.test.ts 2>&1 | grep -E "Tests "
```

Expected: FAIL 17, PASS 54 — 아직 검사기가 `sourceBlobs`와 드라이브 문자를 모른다. `git`이 PATH에 있어야 한다(`blobOf`가 부른다).

- [ ] **Step 5: 검사기를 바꾼다**

`scripts/check-provenance.mjs` 전체를 바꾼다:

```js
/**
 * 복사 출처 기록을 검사한다(스펙 6.3). 게이트가 부른다.
 *
 *   node scripts/check-provenance.mjs [기록 파일]
 *
 * 기록 파일의 기본값은 docs/provenance/copied-core.json 이고, 경로는 전부 현재
 * 디렉터리 기준이다. paths 는 저장소 안의 일반 파일이어야 한다 - 절대 경로, 드라이브 문자로
 * 시작하는 경로(C:..\x), '..' 구간이 있는 경로는 저장소 밖의 파일도 "실재"하게 만들므로
 * 실재하더라도 막는다. 종료 코드: 0 = 통과, 1 = 위반(무엇이 틀렸는지 stderr 에 전부 적는다).
 *
 * 형식만 보면 그대로 복사한 파일을 고치고 이탈을 적지 않아도 통과한다. 그래서 divergences 가
 * 없는 경로는 sourceBlobs 에 원본 파일의 git blob SHA-1 을 적고, 작업 트리의 파일이 그 값과
 * 같아야 한다. 값은 작업 트리의 바이트로 잰다 - .gitattributes 의 `* text=auto eol=lf` 가
 * 체크아웃을 LF 로 두므로 `git hash-object` 와 같다. 이탈이 있는 경로는 원본과 같을 수 없으므로
 * sourceBlobs 에 두지 않는다.
 *
 * 스펙은 이 검사를 check-provenance.sh 로 적었지만 JSON 을 읽어야 해서 node 로 쓴다.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { isAbsolute } from 'node:path'

const file = process.argv[2] ?? 'docs/provenance/copied-core.json'
const SHA1 = /^[0-9a-f]{40}$/

let record
try {
  record = JSON.parse(readFileSync(file, 'utf8'))
} catch (error) {
  const reason = error instanceof Error ? error.message : String(error)
  console.error(`복사 출처 기록을 읽지 못했다: ${file} (${reason})`)
  process.exit(1)
}

// 최상위가 객체가 아니면 아래의 record.source 부터 잡히지 않은 예외로 죽는다.
if (record === null || typeof record !== 'object' || Array.isArray(record)) {
  console.error(`복사 출처 기록 위반 1건 (${file}):`)
  console.error('- 최상위가 객체가 아니다')
  process.exit(1)
}

const problems = []

if (typeof record.source !== 'string' || record.source.trim() === '') {
  problems.push('source 가 비어 있다')
}
if (typeof record.commit !== 'string' || !SHA1.test(record.commit)) {
  problems.push(`commit 이 40자리 16진수가 아니다: ${JSON.stringify(record.commit)}`)
}

const paths = Array.isArray(record.paths) ? record.paths : []
if (!Array.isArray(record.paths)) problems.push('paths 가 배열이 아니다')
// 저장소 안의 실재하는 파일로 확인된 경로. 내용 검사는 이 경로만 한다.
const files = []
for (const path of paths) {
  if (typeof path !== 'string') {
    problems.push(`paths 의 항목이 문자열이 아니다: ${JSON.stringify(path)}`)
  } else if (isAbsolute(path)) {
    problems.push(
      `paths 의 경로가 절대 경로다(저장소 기준 상대 경로여야 한다): ${JSON.stringify(path)}`,
    )
  } else if (/^[A-Za-z]:/.test(path)) {
    // Windows 의 드라이브 상대 경로(C:..\x)는 절대 경로가 아니고 '..' 구간도 없어(첫 구간이 C:..)
    // 아래 검사를 지나지만, 그 드라이브의 현재 디렉터리 기준이라 저장소 밖을 가리킬 수 있다.
    problems.push(
      `paths 의 경로가 드라이브 문자로 시작한다(저장소 기준 상대 경로여야 한다): ${JSON.stringify(path)}`,
    )
  } else if (path.split(/[\\/]/).includes('..')) {
    problems.push(
      `paths 의 경로에 '..' 구간이 있다(저장소 안으로 정규화해야 한다): ${JSON.stringify(path)}`,
    )
  } else if (!existsSync(path)) {
    problems.push(`paths 의 경로가 실재하지 않는다: ${JSON.stringify(path)}`)
  } else if (!statSync(path).isFile()) {
    problems.push(`paths 의 경로가 파일이 아니다: ${JSON.stringify(path)}`)
  } else {
    files.push(path)
  }
}

const divergences = Array.isArray(record.divergences) ? record.divergences : []
if (!Array.isArray(record.divergences)) problems.push('divergences 가 배열이 아니다')
divergences.forEach((divergence, index) => {
  if (!paths.includes(divergence?.path)) {
    problems.push(
      `divergences[${index}].path 가 paths 에 없다: ${JSON.stringify(divergence?.path)}`,
    )
  }
  for (const key of ['what', 'why']) {
    const value = divergence?.[key]
    if (typeof value !== 'string' || value.trim() === '') {
      problems.push(`divergences[${index}].${key} 가 비어 있다`)
    }
  }
})

/** git 이 파일 내용에 매기는 blob SHA-1 - `git hash-object` 와 같은 계산이다. */
function blobSha(path) {
  const content = readFileSync(path)
  return createHash('sha1').update(`blob ${content.length}\0`).update(content).digest('hex')
}

// sourceBlobs 가 없으면 빈 표로 본다 - 이탈이 없는 경로가 하나라도 있으면 아래에서 걸린다.
const blobs = record.sourceBlobs === undefined ? {} : record.sourceBlobs
const blobsIsTable = blobs !== null && typeof blobs === 'object' && !Array.isArray(blobs)
let unchanged = 0
if (!blobsIsTable) {
  problems.push('sourceBlobs 가 객체가 아니다')
} else {
  for (const [path, sha] of Object.entries(blobs)) {
    if (!paths.includes(path)) {
      problems.push(`sourceBlobs 의 경로가 paths 에 없다: ${JSON.stringify(path)}`)
    } else if (typeof sha !== 'string' || !SHA1.test(sha)) {
      problems.push(
        `sourceBlobs[${JSON.stringify(path)}] 가 40자리 16진수가 아니다: ${JSON.stringify(sha)}`,
      )
    }
  }
  // divergences 를 읽지 못했으면 어느 경로가 원본 그대로인지 모른다 - 위에서 이미 걸렸다.
  if (Array.isArray(record.divergences)) {
    const diverged = new Set(divergences.map((divergence) => divergence?.path))
    for (const path of files) {
      const sha = Object.hasOwn(blobs, path) ? blobs[path] : undefined
      if (diverged.has(path)) {
        if (sha !== undefined) {
          problems.push(
            `이탈이 있는 경로가 sourceBlobs 에 있다(원본과 같을 수 없다 - 항목을 지운다): ${JSON.stringify(path)}`,
          )
        }
      } else if (sha === undefined) {
        problems.push(
          `이탈이 없는 경로에 원본 blob 이 없다(sourceBlobs 에 적는다): ${JSON.stringify(path)}`,
        )
      } else if (typeof sha === 'string' && SHA1.test(sha)) {
        const actual = blobSha(path)
        if (actual === sha) {
          unchanged += 1
        } else {
          problems.push(
            `원본과 다르다 - 이탈을 적거나 원본으로 되돌린다: ${JSON.stringify(path)} (원본 ${sha}, 작업 트리 ${actual})`,
          )
        }
      }
    }
  }
}

if (problems.length > 0) {
  console.error(`복사 출처 기록 위반 ${problems.length}건 (${file}):`)
  for (const problem of problems) console.error(`- ${problem}`)
  process.exit(1)
}

console.log(
  `복사 출처 기록 통과: 경로 ${paths.length}개, 이탈 ${divergences.length}건, 원본 그대로 ${unchanged}개`,
)
```

```bash
pnpm exec prettier --check scripts/check-provenance.mjs
pnpm exec vitest run test/unit/scripts/check-provenance.test.ts 2>&1 | grep -E "×|Tests "
```

Expected: PASS 70, FAIL 1 — `이 저장소의 실제 기록이 통과한다`. 실제 기록에 아직 `sourceBlobs`가 없어 이탈이 없는 경로 27개가 `원본 blob 이 없다`로 걸린다.

- [ ] **Step 6: 기록에 원본 blob을 적고, 검사가 실제로 거는지 본다**

```bash
node - <<'EOF'
const fs = require('node:fs')
const { execFileSync } = require('node:child_process')
const SRC = '../template-typescript-nextjs'
const file = 'docs/provenance/copied-core.json'
const record = JSON.parse(fs.readFileSync(file, 'utf8'))
const diverged = new Set(record.divergences.map((divergence) => divergence.path))
record.sourceBlobs = {}
for (const path of record.paths) {
  if (diverged.has(path)) continue
  record.sourceBlobs[path] = execFileSync('git', ['-C', SRC, 'rev-parse', `${record.commit}:${path}`], {
    encoding: 'utf8',
  }).trim()
}
record.note +=
  ' sourceBlobs 는 원본 그대로인 경로마다 원본 커밋의 blob SHA-1 이다(git -C <원본> rev-parse <commit>:<경로>) - 그 파일을 고치면 divergences 에 적고 sourceBlobs 에서 항목을 지운다.'
fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`)
console.log(`sourceBlobs ${Object.keys(record.sourceBlobs).length}개`)
EOF
node scripts/check-provenance.mjs
pnpm exec vitest run test/unit/scripts 2>&1 | grep -E "Tests "
echo '// probe' >> lib/jsonapi/query.ts
node scripts/check-provenance.mjs; echo "mutant exit=$?"
git checkout -- lib/jsonapi/query.ts
node scripts/check-provenance.mjs
```

Expected: `sourceBlobs 27개`, `복사 출처 기록 통과: 경로 33개, 이탈 10건, 원본 그대로 27개`, 시험 89개 통과(출처 71, 인용 18). 한 줄을 더한 `query.ts`에는 `원본과 다르다 - 이탈을 적거나 원본으로 되돌린다: "lib/jsonapi/query.ts" (원본 …, 작업 트리 …)`와 `mutant exit=1`, 되돌린 뒤 다시 통과. 이탈이 없는 경로 27개가 전부 원본과 같다는 것은 2026-09-30에 `1312848`의 트리로 미리 쟀다.

- [ ] **Step 7: 문서와 스펙 정정을 쓴다**

루트 `AGENTS.md` — Edit, 찾을 것:

```markdown
파일을 고치면 그 파일의 `divergences`에 `what`·`why`를 더한다 -
`node scripts/check-provenance.mjs`가 기록의 형식과 경로를 검사한다.
```

바꿀 것:

```markdown
파일을 고치면 그 파일의 `divergences`에 `what`·`why`를 더한다 -
`node scripts/check-provenance.mjs`가 기록의 형식과 경로를 검사하고, 이탈이 없는 사본은 내용이
원본과 같은지(`sourceBlobs`의 blob SHA-1)까지 잰다. 이탈을 처음 적는 파일은 `sourceBlobs`에서 지운다.
```

`lib/jsonapi/AGENTS.md` — Edit, 찾을 것:

```markdown
`divergences`에 `what`·`why`를 더한다. 게이트가 기록의 형식과 경로를 검사한다.
```

바꿀 것:

```markdown
`divergences`에 `what`·`why`를 더하고, 그 파일이 `sourceBlobs`에 있으면 지운다. 게이트가 기록의
형식과 경로, 그리고 이탈이 없는 사본의 내용이 원본과 같은지를 검사한다.
```

스펙 6.3 끝(D1의 "검사 스크립트는 `scripts/check-provenance.sh`가 아니라 …" 정정 다음, `## 7. 인증과 세션` 바로 앞)에 더한다:

```markdown

> 정정(2026-09-30, D2): 검사가 다섯이 됐다. 5. `divergences`가 없는 경로는 기록의 `sourceBlobs`에 원본
> 파일의 git blob SHA-1(`git rev-parse <commit>:<경로>`)을 적고, 작업 트리의 파일이 그 값과 같아야 한다.
> 이탈이 있는 경로는 `sourceBlobs`에 두지 않는다. 형식만 보는 네 검사로는 그대로 복사한 파일을 고치고
> 이탈을 적지 않아도 게이트가 통과했다. 값은 작업 트리의 바이트로 잰다 - `.gitattributes`의
> `* text=auto eol=lf`가 체크아웃을 LF로 두므로 `git hash-object`와 같다. 3의 "실재한다"는 저장소 안의
> 일반 파일이라는 뜻이다 - 절대 경로, 드라이브 문자로 시작하는 경로, `..` 구간이 있는 경로는 거절한다.
```

- [ ] **Step 8: 정적 검사를 돌린다**

```bash
pnpm format
BACKEND_URL=https://gate-check.invalid pnpm types:routes
pnpm typecheck && pnpm lint && pnpm format:check && pnpm lint:secrets
./scripts/check-citations.sh app components lib platform test
node scripts/check-provenance.mjs
pnpm test 2>&1 | tail -5
```

Expected: 전부 exit 0. 단위 시험은 D1 끝(`1312848`, 407개)보다 30개 많다 — 출처 55→71, lib 경계 27→36, 의존성 5.

- [ ] **Step 9: 커밋한다**

```bash
git add eslint.config.js test/unit/lint scripts/check-provenance.mjs test/unit/scripts/check-provenance.test.ts docs/provenance/copied-core.json AGENTS.md lib/jsonapi/AGENTS.md docs/superpowers/specs
git status --short
git commit -m "feat: lib 경계를 위 계층까지 넓히고 출처 검사가 원본 그대로인 사본의 내용을 잰다"
```

---

### Task 2: 인증 판단 복사 — 전송을 주입받게 고친다

**Files:**
- Create (그대로 복사): `lib/auth/flow.ts`, `test/unit/auth/flow.test.ts`, `test/e2e/probe-email.ts`, `test/unit/e2e/probe-email.test.ts`
- Create (복사 후 수정): `lib/auth/credentials.ts`, `lib/auth/logout.ts`, `lib/auth/rotation.ts`, `lib/auth/form-state.ts`, `test/unit/auth/credentials.test.ts`, `test/unit/auth/logout.test.ts`, `test/unit/auth/rotation.test.ts`
- Create (신규): `lib/jsonapi/send.ts`, `lib/auth/protected-paths.ts`, `test/unit/auth/protected-paths.test.ts`
- Modify: `docs/provenance/copied-core.json`, `lib/jsonapi/AGENTS.md`

**Interfaces:**
- Consumes: Task 1의 출처 기록 키 `sourceBlobs`(원본 그대로인 경로 → 원본 blob SHA-1)와 검사기의 통과 줄; `request<T>(path, options?: RequestOptions): Promise<JsonApiResult<T>>`, `withAcceptLanguage(options, value: string | null | undefined): RequestOptions`, `type RequestOptions`, `type JsonApiResult<T>`(`lib/jsonapi/client.ts`), `sessionFromTokenDocument`·`isAccessExpiring`·`type Session`(`lib/auth/tokens.ts`)
- Produces:
  - `type JsonApiSend = <T>(path: string, options?: RequestOptions) => Promise<JsonApiResult<T>>` — `lib/jsonapi/send.ts`
  - `lib/auth/credentials.ts`: `type Credentials = { email: string; password: string }`, `signUp(credentials, send: JsonApiSend): Promise<SignUpOutcome>`, `signIn(credentials, send, now?: number): Promise<SignInOutcome>`, `signUpThenSignIn(credentials, send, now?: number): Promise<RegistrationOutcome>`
  - `lib/auth/rotation.ts`: `rotateSession(refreshToken: string, send: JsonApiSend, now?: number): Promise<RotationOutcome>`, `type RotationOutcome = { kind: 'rotated'; session: Session; refreshExpiresIn: number } | { kind: 'destroy'; reason: string } | { kind: 'unreachable'; reason: string }`, `interface AuthTokensDocument`
  - `lib/auth/logout.ts`: `revokeSession(session: Session | undefined, send): Promise<LogoutOutcome>`, `endSession(session: Session | undefined, send, clearLocal: () => Promise<void>): Promise<LogoutOutcome>`, `type LogoutOutcome = { kind: 'revoked' } | { kind: 'notRevoked'; reason: string } | { kind: 'noSession' }`, `POST_LOGOUT_PATH = '/'`(리터럴 타입)
  - `lib/auth/flow.ts`: `safeRedirectTarget(raw: unknown, fallback?: string): string`, `authLinkHref(path: string, rawNext: unknown, param: string): string`, `decideAfterLogin(outcome: SignInOutcome, rawNext: unknown, email: string): SignInPlan`, `decideAfterRegistration(outcome: RegistrationOutcome, rawNext: unknown, email: string): SignInPlan`, `type SignInPlan = { kind: 'establish'; to: string; session: Session; refreshExpiresIn: number } | { kind: 'state'; state: AuthFormState }`
  - `lib/auth/form-state.ts`: `EMAIL_FIELD = 'email'`, `PASSWORD_FIELD = 'password'`, `interface AuthFormState { documentErrors: string[]; fieldErrors: Record<string, string[]>; submittedEmail: string; accountCreated: boolean }`, `IDLE_AUTH_FORM_STATE`, `interface AuthFormContext { email: string; accountCreated: boolean }`, `unusableResponseState(context): AuthFormState`, `UNUSABLE_RESPONSE_MESSAGE`
  - `lib/auth/protected-paths.ts`: `LOGIN_PATH = '/login'`, `LOGIN_REDIRECT_PARAM = 'next'`, `PROTECTED_PATH_PATTERNS: readonly RegExp[]`, `isProtectedPath(pathname: string): boolean`, `loginHref(pathname: string): string`
  - `test/e2e/probe-email.ts`: `probeEmail(prefix: string, label: string): string`

- [ ] **Step 1: 브랜치와 앞 태스크를 확인한다**

```bash
git branch --show-current
git log --oneline -1
git status --short
node scripts/check-provenance.mjs
```

Expected: `feat/d2-session-auth`, 마지막 커밋이 Task 1의 것, 작업 트리가 깨끗하다. 검사기가 `원본 그대로 27개`를 적는다 — `sourceBlobs`가 있어야 이 태스크의 Step 11이 그대로 복사한 넷을 거기에 더할 수 있다.

- [ ] **Step 2: 원본 열한 파일을 그대로 복사한다**

```bash
SRC=../template-typescript-nextjs
REV=34d0b1057d65693645e75bec4e9558dcf6838822
copy() { mkdir -p "$(dirname "$1")"; git -C "$SRC" show "$REV:$1" > "$1"; }
for f in lib/auth/credentials.ts lib/auth/flow.ts lib/auth/form-state.ts lib/auth/logout.ts lib/auth/rotation.ts \
         test/unit/auth/credentials.test.ts test/unit/auth/flow.test.ts test/unit/auth/logout.test.ts test/unit/auth/rotation.test.ts \
         test/e2e/probe-email.ts test/unit/e2e/probe-email.test.ts; do
  copy "$f"
done
for f in lib/auth/credentials.ts lib/auth/flow.ts lib/auth/form-state.ts lib/auth/logout.ts lib/auth/rotation.ts \
         test/unit/auth/credentials.test.ts test/unit/auth/flow.test.ts test/unit/auth/logout.test.ts test/unit/auth/rotation.test.ts \
         test/e2e/probe-email.ts test/unit/e2e/probe-email.test.ts; do
  cmp <(git -C "$SRC" show "$REV:$f") "$f" && echo "same $f"
done
```

Expected: `same …` 열한 줄. 이 뒤의 줄 번호는 전부 이 원본 그대로의 파일을 기준으로 한다.

- [ ] **Step 3: 복사한 시험을 그대로 돌려 무엇이 빠졌는지 본다**

```bash
pnpm exec vitest run test/unit/auth test/unit/e2e/probe-email.test.ts 2>&1 | tail -25
```

Expected: FAIL. `@/lib/auth/session`(rotation.ts·rotation.test.ts), `@/app/(auth)/actions`·`@/lib/auth/guard`·`@/proxy`(logout.test.ts)를 찾지 못한다. `credentials.test.ts`(원본 계약 그대로 — rotation은 타입만 가져온다)·`flow.test.ts`·`probe-email.test.ts`·`tokens.test.ts`는 통과한다.

- [ ] **Step 4: 보호 경로 시험을 쓴다**

`test/unit/auth/protected-paths.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { safeRedirectTarget } from '@/lib/auth/flow'
import {
  LOGIN_PATH,
  LOGIN_REDIRECT_PARAM,
  PROTECTED_PATH_PATTERNS,
  isProtectedPath,
  loginHref,
} from '@/lib/auth/protected-paths'

/**
 * 보호 경로 목록(스펙 7.3). 경로는 Expo Router 의 usePathname() 값이다 - 쿼리가 없고 동적
 * 세그먼트는 실제 값으로 채워져 있다.
 */
describe('isProtectedPath', () => {
  it.each(['/examples/new', '/examples/42/edit', '/examples/probe-id/edit'])(
    '%s 는 보호 경로다',
    (pathname) => {
      expect(isProtectedPath(pathname)).toBe(true)
    },
  )

  it.each([
    '/',
    '/examples',
    '/examples/42',
    '/examples/new/extra',
    '/examples/42/edit/extra',
    '/examples//edit',
    '/login',
    '/register',
    '/contract',
  ])('%s 는 공개다', (pathname) => {
    expect(isProtectedPath(pathname)).toBe(false)
  })

  it('목록은 원본의 PROTECTED_PATH_PATTERNS 와 같은 범위다 - 생성, 수정·삭제', () => {
    expect(PROTECTED_PATH_PATTERNS).toHaveLength(2)
  })
})

describe('loginHref', () => {
  it('원래 경로를 next 에 인코딩해 싣는다', () => {
    expect(loginHref('/examples/42/edit')).toBe('/login?next=%2Fexamples%2F42%2Fedit')
  })

  it('받는 쪽이 같은 이름으로 읽으면 원래 경로가 그대로 나온다', () => {
    const [path, query] = loginHref('/probe path/a&b=c').split('?')
    expect(path).toBe(LOGIN_PATH)
    expect(new URLSearchParams(query).get(LOGIN_REDIRECT_PARAM)).toBe('/probe path/a&b=c')
  })

  it('실린 경로는 복귀 검사(safeRedirectTarget)를 통과한다 - 가드와 검사가 같은 모양을 쓴다', () => {
    const query = loginHref('/examples/new').split('?')[1]
    const next = new URLSearchParams(query).get(LOGIN_REDIRECT_PARAM)
    expect(safeRedirectTarget(next, '/probe-fallback')).toBe('/examples/new')
  })

  it('로그인 화면 자신은 보호 경로가 아니다 - 가드가 자기 자신으로 보내며 돌지 않는다', () => {
    expect(isProtectedPath(LOGIN_PATH)).toBe(false)
  })
})
```

- [ ] **Step 5: 복사한 시험 셋을 새 계약(전송 주입)으로 고친다**

세 파일 모두, 언어 값을 넘기던 자리에 **전송**을 넘긴다. 원본의 `PROBE_ACCEPT_LANGUAGE`는 그 값을 싣는 전송(`probeSend`)이 되고, `null`은 헤더를 싣지 않는 `request` 그 자체가 된다. 헤더 맵 전체를 비교하던 원래 단언은 그대로 남는다 — 함수가 주입받은 전송을 쓰지 않고 `request`를 직접 부르면 `accept-language`가 빠져 죽는다.

**(a) `test/unit/auth/credentials.test.ts`**

```bash
F=test/unit/auth/credentials.test.ts
sed -i "/^describe('credentialsFromFormData', () => {\$/,/^})\$/d" "$F"
sed -i '/^  credentialsFromFormData,$/d' "$F"
sed -i -e 's/(PROBE_CREDENTIALS, PROBE_ACCEPT_LANGUAGE/(PROBE_CREDENTIALS, probeSend/g' \
       -e 's/(PROBE_CREDENTIALS, null, PROBE_NOW)/(PROBE_CREDENTIALS, request, PROBE_NOW)/g' \
       -e "s/(PROBE_CREDENTIALS, '', PROBE_NOW)/(PROBE_CREDENTIALS, sendWithLanguage(''), PROBE_NOW)/g" "$F"
grep -c "credentialsFromFormData" "$F"; grep -c "PROBE_ACCEPT_LANGUAGE" "$F"
```

Expected: `0`, 그리고 `PROBE_ACCEPT_LANGUAGE`는 정의 한 줄과 헤더 기대값 네 줄이 남는다(`5`).

Edit — 찾을 것:

```ts
import { JSONAPI_MEDIA_TYPE, type JsonApiResult } from '@/lib/jsonapi/client'
```

바꿀 것:

```ts
import {
  JSONAPI_MEDIA_TYPE,
  request,
  withAcceptLanguage,
  type JsonApiResult,
  type RequestOptions,
} from '@/lib/jsonapi/client'
import type { JsonApiSend } from '@/lib/jsonapi/send'
```

Edit — 찾을 것:

```ts
const PROBE_ACCEPT_LANGUAGE = 'xx-ZZ,qq;q=0.3'
```

바꿀 것:

```ts
const PROBE_ACCEPT_LANGUAGE = 'xx-ZZ,qq;q=0.3'

/**
 * (template-typescript-expo) 앱의 API 클라이언트(platform/api.ts)가 하듯 Accept-Language 를 싣는
 * 전송. 이 파일의 함수는 요청을 주입받은 전송으로만 내보낸다(스펙 9.4) - request 를 직접 부르면
 * 헤더가 빠져 아래 단언들이 죽는다.
 */
function sendWithLanguage(acceptLanguage: string): JsonApiSend {
  return <T>(path: string, options: RequestOptions = {}) =>
    request<T>(path, withAcceptLanguage(options, acceptLanguage))
}

const probeSend = sendWithLanguage(PROBE_ACCEPT_LANGUAGE)
```

**(b) `test/unit/auth/logout.test.ts`**

```bash
F=test/unit/auth/logout.test.ts
sed -i "/^describe('logoutAction 의 관측 한계', () => {\$/,/^})\$/d" "$F"
sed -i -e 's/, PROBE_ACCEPT_LANGUAGE)/, probeSend)/g' \
       -e 's/, PROBE_ACCEPT_LANGUAGE, spy.clear)/, probeSend, spy.clear)/g' \
       -e 's/revokeSession(PROBE_SESSION, null)/revokeSession(PROBE_SESSION, request)/' "$F"
grep -n "logoutAction\|@/proxy\|lib/auth/guard\|, null" "$F"
```

Expected: 원본 2·4·17행의 import 셋과 `fresh.endSession(PROBE_SESSION, null, spy.clear)` 한 줄만 남는다 — 아래 Edit가 고친다.

Edit — 찾을 것(원본 2–4행):

```ts
import { logoutAction } from '@/app/(auth)/actions'
import { LOGIN_ENDPOINT, REGISTER_ENDPOINT } from '@/lib/auth/credentials'
import { LOGIN_PATH } from '@/lib/auth/guard'
```

바꿀 것:

```ts
import { LOGIN_ENDPOINT, REGISTER_ENDPOINT } from '@/lib/auth/credentials'
```

Edit — 찾을 것(원본 14–17행):

```ts
import { rotateSession } from '@/lib/auth/rotation'
import type { Session } from '@/lib/auth/tokens'
import { JSONAPI_MEDIA_TYPE } from '@/lib/jsonapi/client'
import { isProtectedPath } from '@/proxy'
```

바꿀 것:

```ts
import { LOGIN_PATH, isProtectedPath } from '@/lib/auth/protected-paths'
import { rotateSession } from '@/lib/auth/rotation'
import type { Session } from '@/lib/auth/tokens'
import {
  JSONAPI_MEDIA_TYPE,
  request,
  withAcceptLanguage,
  type RequestOptions,
} from '@/lib/jsonapi/client'
import type { JsonApiSend } from '@/lib/jsonapi/send'
```

Edit — 찾을 것:

```ts
const PROBE_ACCEPT_LANGUAGE = 'xx-ZZ,qq;q=0.3'
```

바꿀 것:

```ts
const PROBE_ACCEPT_LANGUAGE = 'xx-ZZ,qq;q=0.3'

/**
 * (template-typescript-expo) 앱의 API 클라이언트(platform/api.ts)처럼 Accept-Language 를 싣는
 * 전송. 로그아웃·회전은 요청을 주입받은 전송으로만 내보낸다(스펙 9.4).
 */
const probeSend: JsonApiSend = <T>(path: string, options: RequestOptions = {}) =>
  request<T>(path, withAcceptLanguage(options, PROBE_ACCEPT_LANGUAGE))
```

Edit — 찾을 것(원본 445–449행):

```ts
      const fresh = await import('@/lib/auth/logout')
      process.env.BACKEND_URL = ''
      const spy = makeClearSpy()

      await expect(fresh.endSession(PROBE_SESSION, null, spy.clear)).rejects.toThrow(/BACKEND_URL/)
```

바꿀 것:

```ts
      const fresh = await import('@/lib/auth/logout')
      // (template-typescript-expo) logout.ts 는 request 를 import 하지 않고 전송을 인자로 받는다 -
      // 새로 들여온 client.ts 의 request 를 넘겨야 비어 있는 설정 캐시를 탄다.
      const freshClient = await import('@/lib/jsonapi/client')
      process.env.BACKEND_URL = ''
      const spy = makeClearSpy()

      await expect(fresh.endSession(PROBE_SESSION, freshClient.request, spy.clear)).rejects.toThrow(
        /BACKEND_URL/,
      )
```

**(c) `test/unit/auth/rotation.test.ts`**

```bash
F=test/unit/auth/rotation.test.ts
sed -i "/^describe('decideRotation', () => {\$/,/^})\$/d" "$F"
sed -i '/^function accessCookie(/,/^}$/d' "$F"
sed -i -e 's/, PROBE_ACCEPT_LANGUAGE, NOW)/, probeSend, NOW)/g' \
       -e "s/('old-refresh-token', null, NOW)/('old-refresh-token', request, NOW)/" "$F"
grep -c "decideRotation\|accessCookie\|ACCESS_EXPIRY_LEEWAY_MS\|encodeAccessCookieValue" "$F"
```

Expected: `3` — 아래 Edit가 지우는 import 셋만 남는다.

Edit — 찾을 것(원본 2–10행):

```ts
import {
  decideRotation,
  interpretRotationOutcome,
  rotateSession,
  type AuthTokensDocument,
} from '@/lib/auth/rotation'
import { encodeAccessCookieValue } from '@/lib/auth/session'
import { ACCESS_EXPIRY_LEEWAY_MS } from '@/lib/auth/tokens'
import { JSONAPI_MEDIA_TYPE, type JsonApiResult } from '@/lib/jsonapi/client'
```

바꿀 것:

```ts
import { interpretRotationOutcome, rotateSession, type AuthTokensDocument } from '@/lib/auth/rotation'
import {
  JSONAPI_MEDIA_TYPE,
  request,
  withAcceptLanguage,
  type JsonApiResult,
  type RequestOptions,
} from '@/lib/jsonapi/client'
import type { JsonApiSend } from '@/lib/jsonapi/send'
```

Edit — 찾을 것(`describe('rotateSession — 실제 fetch 호출'` 안):

```ts
  const PROBE_ACCEPT_LANGUAGE = 'xx-ZZ,qq;q=0.3'
```

바꿀 것:

```ts
  const PROBE_ACCEPT_LANGUAGE = 'xx-ZZ,qq;q=0.3'
  /** (template-typescript-expo) 앱의 API 클라이언트처럼 Accept-Language 를 싣는 전송(스펙 9.4). */
  const probeSend: JsonApiSend = <T>(path: string, options: RequestOptions = {}) =>
    request<T>(path, withAcceptLanguage(options, PROBE_ACCEPT_LANGUAGE))
```

세 파일의 서식을 맞춘다(범위 삭제가 남긴 빈 줄 둘을 하나로 줄인다):

```bash
pnpm exec prettier --write test/unit/auth/credentials.test.ts test/unit/auth/logout.test.ts test/unit/auth/rotation.test.ts test/unit/auth/protected-paths.test.ts
```

- [ ] **Step 6: 시험이 실패하는지 본다**

```bash
pnpm exec vitest run test/unit/auth 2>&1 | tail -20
```

Expected: FAIL — `protected-paths`·`send`가 없고, rotation.ts가 아직 `./session`을 import한다.

- [ ] **Step 7: 전송의 모양과 보호 경로를 쓴다**

`lib/jsonapi/send.ts`:

```ts
import type { JsonApiResult, RequestOptions } from './client'

/**
 * 백엔드 요청 하나를 보내는 함수의 모양 - `request()`(client.ts)와 같다.
 *
 * 인증 호출(lib/auth 의 가입·로그인·회전·로그아웃)은 `request()` 를 직접 부르지 않고 이 모양의
 * 함수를 인자로 받는다. 앱에서는 platform/api.ts 가 조립한 클라이언트가 들어온다 -
 * Accept-Language 를 싣는 자리가 그 한 곳이다(스펙 9.4). 호출부마다 언어 값을 인자로 넘기던
 * 원본(template-typescript-nextjs)의 모양에서는 그 인자를 null 로 바꾸는 뮤턴트가 게이트를
 * 전부 통과했다.
 */
export type JsonApiSend = <T>(path: string, options?: RequestOptions) => Promise<JsonApiResult<T>>
```

`lib/auth/protected-paths.ts`:

```ts
/**
 * 보호 경로 목록과 로그인으로 보내는 주소 - 스펙 7.3 의 첫 겹(경로 가드).
 *
 * 목록은 **여기 하나**다. `app/(app)/_layout.tsx` 가 현재 경로를 이 목록과 대조해 세션이 없으면
 * `loginHref()` 로 보낸다. 범위는 원본(template-typescript-nextjs)의 `PROTECTED_PATH_PATTERNS` 와
 * 같다 - 생성과 수정·삭제 화면만 로그인이 필요하고 목록·상세·실험실은 공개다.
 *
 * 경로는 Expo Router 의 `usePathname()` 값이다 - 쿼리가 없고, 동적 세그먼트는 실제 값으로 채워져
 * 있다(`/examples/42/edit`).
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
 * 보호 경로에서 막힌 사용자를 보내는 주소 - 원래 경로를 `next` 로 싣는다. 받는 쪽은 그 값을
 * `safeRedirectTarget()`(flow.ts)으로 다시 검사한다 - 딥링크로 들어온 `next` 는 믿을 수 없다.
 */
export function loginHref(pathname: string): string {
  return `${LOGIN_PATH}?${LOGIN_REDIRECT_PARAM}=${encodeURIComponent(pathname)}`
}
```

- [ ] **Step 8: 복사한 lib 넷을 새 계약으로 고친다**

**(a) `lib/auth/form-state.ts`** — Edit, 찾을 것(원본 94–100행):

```ts
/**
 * `useActionState` 에 넘길 수 있게 리다이렉트 대상을 이미 bind 한 Server Action.
 * `app/(auth)/actions.ts` 의 두 Action 이 `.bind(null, rawNext)` 를 거쳐 이
 * 모양이 된다.
 */
export type AuthFormAction = (state: AuthFormState, formData: FormData) => Promise<AuthFormState>

```

바꿀 것: (빈 문자열 — 블록을 지운다)

**(b) `lib/auth/credentials.ts`**

Edit — 찾을 것(원본 37–38행):

```ts
import { request, withAcceptLanguage, type JsonApiResult } from '@/lib/jsonapi/client'
import type { ErrorObject } from '@/lib/jsonapi/document'
```

바꿀 것:

```ts
import type { JsonApiResult } from '@/lib/jsonapi/client'
import type { ErrorObject } from '@/lib/jsonapi/document'
import type { JsonApiSend } from '@/lib/jsonapi/send'
```

Edit — 원본 61–82행(`/**`로 시작하는 `` `FormData` 에서 자격증명을 꺼낸다.`` 주석부터 `stringField` 함수를 닫는 `}`와 그 뒤 빈 줄까지)을 지운다. 지운 뒤 `export function credentialsFromFormData`와 `function stringField`가 파일에 없어야 한다.

Edit — 원본 155행(`/**`, 다음 줄이 `` * `acceptLanguage` 는 **기본값이 없다** ``)부터 파일 끝(215행)까지를 다음으로 바꾼다:

```ts
/**
 * `send` 는 **기본값이 없다** - 호출자가 반드시 넘긴다(template-typescript-expo 스펙 9.4).
 *
 * 앱에서는 platform/api.ts 의 apiRequest 가 들어온다 - Accept-Language 를 싣는 자리는 그 한
 * 곳이다. 기본값(`request`)을 두면 새 호출자가 "안 넘겨도 되는 것"으로 읽고 조용히 빠뜨리고,
 * 그 결과는 오류가 아니라 **사용자가 자기 언어가 아닌 문구를 보는 것**이라 타입도 시험도 잡지
 * 못한다.
 */
export type RegistrationOutcome =
  /** 가입 자체가 거절됐다 - 로그인은 **부르지 않았다**(계정이 없으니 부를 이유가 없다). */
  | { kind: 'signUpRejected'; errors: readonly ErrorObject[] }
  /** 계정은 만들어졌다. `signIn` 은 이어서 부른 로그인의 결과다(성공했을 수도, 아닐 수도). */
  | { kind: 'signedUp'; signIn: SignInOutcome }

/**
 * 가입 흐름 전체 - register 다음에 login(스펙 7.4).
 *
 * 두 호출을 한 함수로 묶은 이유는 **둘 사이의 계약을 관측 가능하게 만들기 위해서**다. 따로
 * 부르면 "두 호출이 같은 자격증명과 같은 전송(`send`)을 쓴다"는 사실을 지킬 자리가 없다 - 원본
 * 저장소의 리뷰가 실제로 확인했다: 두 번째 호출의 언어 인자만 `null` 로 바꿔도 테스트 258개 중
 * 0개가 실패했다(RM5). 증상은 오류가 아니라 "en 사용자가 가입에 성공한 뒤 한국어 오류 문구를
 * 본다"라, 아무것도 깨지지 않은 것처럼 보인다.
 *
 * 여기 묶고 나면 한 시험이 두 요청을 통째로 본다.
 */
export async function signUpThenSignIn(
  credentials: Credentials,
  send: JsonApiSend,
  now: number = Date.now(),
): Promise<RegistrationOutcome> {
  const signUpOutcome = await signUp(credentials, send)
  if (signUpOutcome.kind === 'rejected') {
    return { kind: 'signUpRejected', errors: signUpOutcome.errors }
  }
  // 같은 credentials, 같은 send - 위에서 받은 인자를 그대로 쓴다.
  return { kind: 'signedUp', signIn: await signIn(credentials, send, now) }
}

export async function signUp(credentials: Credentials, send: JsonApiSend): Promise<SignUpOutcome> {
  const result = await send<unknown>(REGISTER_ENDPOINT, {
    method: 'POST',
    body: registerDocument(credentials),
  })
  return interpretSignUpResult(result)
}

export async function signIn(
  credentials: Credentials,
  send: JsonApiSend,
  now: number = Date.now(),
): Promise<SignInOutcome> {
  const result = await send<AuthTokensDocument>(LOGIN_ENDPOINT, {
    method: 'POST',
    body: loginDocument(credentials),
  })
  return interpretSignInResult(result, now)
}
```

**(c) `lib/auth/logout.ts`**

Edit — 찾을 것(원본 66행):

```ts
import { request, withAcceptLanguage, type JsonApiResult } from '@/lib/jsonapi/client'
```

바꿀 것:

```ts
import type { JsonApiResult } from '@/lib/jsonapi/client'
import type { JsonApiSend } from '@/lib/jsonapi/send'
```

Edit — 찾을 것(원본 160–162행):

```ts
 * `acceptLanguage` 에 **기본값이 없다** - credentials.ts 와 같은 이유다.
 * 기본값을 두면 새 호출자가 조용히 빠뜨리고, 그 증상은 오류가 아니라
 * "사용자가 자기 언어가 아닌 문구를 본다"라 타입도 테스트도 못 잡는다.
```

바꿀 것:

```ts
 * `send` 에 **기본값이 없다** - credentials.ts 와 같은 이유다(template-typescript-expo 스펙
 * 9.4 - Accept-Language 는 주입받은 전송이 싣는다). 기본값을 두면 새 호출자가 조용히 빠뜨리고,
 * 그 증상은 오류가 아니라 "사용자가 자기 언어가 아닌 문구를 본다"라 타입도 테스트도 못 잡는다.
```

Edit — 찾을 것(원본 171–183행):

```ts
export async function revokeSession(
  session: Session | undefined,
  acceptLanguage: string | null,
): Promise<LogoutOutcome> {
  if (session === undefined) return { kind: 'noSession' }

  const result = await request<unknown>(
    LOGOUT_ENDPOINT,
    withAcceptLanguage(
      { method: 'POST', body: logoutDocument(session.refreshToken) },
      acceptLanguage,
    ),
  )
```

바꿀 것:

```ts
export async function revokeSession(
  session: Session | undefined,
  send: JsonApiSend,
): Promise<LogoutOutcome> {
  if (session === undefined) return { kind: 'noSession' }

  const result = await send<unknown>(LOGOUT_ENDPOINT, {
    method: 'POST',
    body: logoutDocument(session.refreshToken),
  })
```

Edit — 원본 219행(` * ## clearCookies 를 인자로 받는다`)부터 파일 끝(238행)까지를 다음으로 바꾼다:

```ts
 * ## clearLocal 을 인자로 받는다
 *
 * (template-typescript-expo) 원본에서 이 인자는 두 세션 쿠키를 지우는 `clearCookies` 였다. 이
 * 저장소에서는 기기 쪽 전부 - SecureStore 의 세션 항목과 Query 캐시(스펙 7.4) - 를 비우는
 * 함수다. 부르는 곳은 lib/auth/session-manager.ts 의 `logout()` 하나다.
 *
 * 저장 매체를 여기서 직접 부르면 이 파일이 expo-secure-store 를 의존하게 되어 vitest 에서 부를
 * 수 없다 - 그러면 위 "순서" 계약 전체가 관측 불가가 된다. 인자로 받으면 시험이 스파이를 넘겨
 * **네 갈래 전부**(폐기 성공 · 백엔드 거절 · 네트워크 실패 · 세션 없음)에서 실제로 불렸는지,
 * 그리고 요청보다 **먼저** 끝났는지를 잰다.
 *
 * 기본값을 두지 않는다 - `send` 와 같은 이유이고, 기본값을 두는 순간 위의 import 제약이 깨진다.
 */
export async function endSession(
  session: Session | undefined,
  send: JsonApiSend,
  clearLocal: () => Promise<void>,
): Promise<LogoutOutcome> {
  await clearLocal()
  return revokeSession(session, send)
}
```

**(d) `lib/auth/rotation.ts`** — 아래에서 위로 고친다(앞 줄 번호가 흔들리지 않게).

Edit — 원본 224행(` * \`acceptLanguage\` 를 함께 받아 백엔드로 전달한다(스펙 9.2). 회전 실패`)부터 파일 끝(246행)까지를 다음으로 바꾼다:

```ts
 * (template-typescript-expo) 원본은 `acceptLanguage` 를 받아 백엔드로 전달했다. 이 저장소는
 * 요청을 보내는 함수(`send`)를 받는다 - Accept-Language 는 그 함수(앱에서는 platform/api.ts 의
 * apiRequest)가 싣는다(스펙 9.4). 이 함수를 부르는 곳은 lib/auth/session-manager.ts 하나다
 * (스펙 7.2).
 */
export async function rotateSession(
  refreshToken: string,
  send: JsonApiSend,
  now: number = Date.now(),
): Promise<RotationOutcome> {
  const result = await send<AuthTokensDocument>('/api/v1/auth/refresh', {
    method: 'POST',
    body: { data: { type: 'refreshTokens', attributes: { refreshToken } } },
  })
  return interpretRotationOutcome(result, now)
}
```

Edit — 원본 28–113행(`/**` 다음 줄이 ` * 프록시가 이번 요청에 무엇을 할지(브리핑 Step 2).`인 주석부터 `decideRotation`을 닫는 `}`와 그 뒤 빈 줄까지, 다음 줄은 `/** 회전 요청(POST /auth/refresh)의 성공 응답이 …`)을 다음으로 바꾼다:

```ts
/*
 * (template-typescript-expo) 원본의 RotationDecision 과 decideRotation(쿠키 두 개를 읽어 이번
 * 요청에서 회전할지 정하는 프록시용 판단)은 뺐다. 이 저장소에는 쿠키가 없고, 회전할지는
 * lib/auth/session-manager.ts 가 저장된 세션의 isAccessExpiring 으로 정한다(스펙 7.1·7.2).
 */

```

Edit — 찾을 것(원본 19–26행):

```ts
import { request, withAcceptLanguage, type JsonApiResult } from '@/lib/jsonapi/client'
import { decodeAccessCookieValue } from './session'
import {
  isAccessExpiring,
  sessionFromTokenDocument,
  type AuthTokenAttributes,
  type Session,
} from './tokens'
```

바꿀 것:

```ts
import type { JsonApiResult } from '@/lib/jsonapi/client'
import type { JsonApiSend } from '@/lib/jsonapi/send'
import { sessionFromTokenDocument, type AuthTokenAttributes, type Session } from './tokens'
```

```bash
pnpm exec prettier --write lib/auth lib/jsonapi/send.ts
```

- [ ] **Step 9: 시험이 통과하는지 본다**

```bash
pnpm exec vitest run test/unit/auth test/unit/e2e/probe-email.test.ts
```

Expected: PASS. 파일별로 credentials 19 · flow 39 · logout 23 · rotation 10 · protected-paths 17 · tokens 5(기존) · probe-email 12(`it.each` 여섯 줄 포함).

- [ ] **Step 10: 원본과 달라진 곳이 선언한 것뿐인지 본다**

```bash
SRC=../template-typescript-nextjs; REV=34d0b1057d65693645e75bec4e9558dcf6838822
for f in lib/auth/flow.ts test/unit/auth/flow.test.ts test/e2e/probe-email.ts test/unit/e2e/probe-email.test.ts; do
  cmp <(git -C "$SRC" show "$REV:$f") "$f" && echo "same $f"
done
for f in lib/auth/credentials.ts lib/auth/logout.ts lib/auth/rotation.ts lib/auth/form-state.ts \
         test/unit/auth/credentials.test.ts test/unit/auth/logout.test.ts test/unit/auth/rotation.test.ts; do
  echo "=== $f"; diff <(git -C "$SRC" show "$REV:$f") "$f" | grep -c '^[<>]'
done
```

Expected: 넷은 `same`이다. 나머지 일곱은 `diff`를 읽어, 달라진 곳이 Step 5·8에서 선언한 것(import, 지운 블록, 전송으로 바꾼 호출·시그니처, 고친 주석, 더한 도우미)뿐인지 확인한다. 그 밖의 줄이 있으면(prettier가 만든 줄바꿈 말고) 되돌린다.

- [ ] **Step 11: 출처 기록에 더한다**

```bash
node - <<'EOF'
const fs = require('node:fs')
const file = 'docs/provenance/copied-core.json'
const record = JSON.parse(fs.readFileSync(file, 'utf8'))
record.paths.push(
  'lib/auth/credentials.ts',
  'lib/auth/flow.ts',
  'lib/auth/form-state.ts',
  'lib/auth/logout.ts',
  'lib/auth/rotation.ts',
  'test/unit/auth/credentials.test.ts',
  'test/unit/auth/flow.test.ts',
  'test/unit/auth/logout.test.ts',
  'test/unit/auth/rotation.test.ts',
  'test/e2e/probe-email.ts',
  'test/unit/e2e/probe-email.test.ts',
)
record.divergences.push(
  {
    path: 'lib/auth/credentials.ts',
    what: 'credentialsFromFormData 와 그 도우미 stringField 를 뺐다. signUp·signIn·signUpThenSignIn 이 acceptLanguage(string | null) 대신 send(JsonApiSend, lib/jsonapi/send.ts)를 받아 그 함수로 요청을 보낸다 - request·withAcceptLanguage import 를 뺐다. 그 자리의 주석 둘(기본값이 없다는 절, 두 호출을 묶는 이유)을 send 에 맞게 고쳤다.',
    why: 'RN 화면은 FormData 로 제출하지 않고 입력 상태(Credentials)를 그대로 넘긴다(스펙 6.2). Accept-Language 를 싣는 자리는 platform/ 의 API 클라이언트 한 곳이다(스펙 9.4) - 호출부마다 언어 값을 넘기던 원본에서는 그 인자를 null 로 바꾸는 뮤턴트가 게이트를 통과했다. 인증 호출은 그 클라이언트를 주입받는다.',
  },
  {
    path: 'test/unit/auth/credentials.test.ts',
    what: "credentialsFromFormData describe(3개)와 그 import 를 지웠다. signUp·signIn·signUpThenSignIn 호출의 언어 인자를 전송으로 바꿨다 - PROBE_ACCEPT_LANGUAGE 는 그 값을 싣는 전송(probeSend = request + withAcceptLanguage), null 은 request, '' 는 sendWithLanguage('') 다. 그 둘을 만드는 도우미와 import(request·withAcceptLanguage·RequestOptions·JsonApiSend)를 더했다.",
    why: '위 이탈을 따라간다. 헤더 맵 전체를 비교하는 원래 단언이 그대로 남아, 함수가 주입받은 전송을 쓰지 않고 request 를 직접 부르면 accept-language 가 빠져 죽는다.',
  },
  {
    path: 'lib/auth/logout.ts',
    what: 'revokeSession·endSession 이 acceptLanguage 대신 send(JsonApiSend)를 받는다. endSession 의 셋째 인자 이름을 clearCookies 에서 clearLocal 로 바꾸고 그 절의 주석을 고쳤다. request·withAcceptLanguage import 를 뺐다.',
    why: 'Accept-Language 는 주입받은 전송이 싣는다(스펙 9.4). 이 저장소에는 쿠키가 없다 - 로그아웃이 비우는 것은 기기의 세션 항목과 Query 캐시다(스펙 7.4). 부르는 곳은 lib/auth/session-manager.ts 의 logout() 하나다.',
  },
  {
    path: 'test/unit/auth/logout.test.ts',
    what: 'logoutAction import 와 그 관측 한계 describe(1개)를 지웠다. LOGIN_PATH·isProtectedPath 를 lib/auth/guard·@/proxy 대신 lib/auth/protected-paths 에서 가져온다. revokeSession·endSession·rotateSession 의 언어 인자를 전송(probeSend, null 은 request)으로 바꾸고 그 도우미와 import 를 더했다. BACKEND_URL 예외 시험은 새로 들여온 client.ts 의 request 를 넘긴다.',
    why: 'Server Action·proxy.ts·guard.ts 는 복사하지 않았다(스펙 6.2) - 보호 경로 목록은 lib/auth/protected-paths.ts 하나다(스펙 7.3). logout.ts 가 이제 request 를 import 하지 않으므로, 설정 캐시가 빈 새 모듈을 타려면 그 모듈의 request 를 인자로 넘겨야 한다.',
  },
  {
    path: 'lib/auth/rotation.ts',
    what: 'RotationDecision 과 decideRotation 을 빼고 그 자리에 뺀 이유를 적은 주석을 두었다. rotateSession 이 acceptLanguage 대신 send(JsonApiSend)를 받는다. session.ts(decodeAccessCookieValue)·isAccessExpiring·request·withAcceptLanguage import 를 뺐다. rotateSession 주석의 acceptLanguage 절을 send 에 맞게 고쳤다.',
    why: 'decideRotation 은 원본의 쿠키 두 개(session.ts 의 인코딩)를 읽는 프록시용 판단이다. 이 저장소는 세션을 SecureStore 항목 하나에 두고, 회전할지는 lib/auth/session-manager.ts 가 저장된 세션의 isAccessExpiring 으로 정한다(스펙 7.1·7.2). 전송은 credentials.ts 와 같은 이유다(스펙 9.4).',
  },
  {
    path: 'test/unit/auth/rotation.test.ts',
    what: 'decideRotation describe(7개)와 그 도우미(accessCookie)·import(decideRotation·encodeAccessCookieValue·ACCESS_EXPIRY_LEEWAY_MS)를 지웠다. rotateSession 의 언어 인자를 전송(probeSend, null 은 request)으로 바꾸고 그 도우미와 import 를 더했다.',
    why: '위 이탈을 따라간다. 회전할지의 판단은 test/unit/auth/session-manager.test.ts 가 잰다.',
  },
  {
    path: 'lib/auth/form-state.ts',
    what: 'AuthFormAction 타입과 그 주석을 뺐다.',
    why: 'Server Action 모양((state, formData: FormData) => Promise<AuthFormState>)이다(스펙 6.2). RN 화면은 쓰기 훅(queries/auth.ts)의 결과로 폼 상태를 바꾼다.',
  },
)
// 그대로 복사한 넷은 원본 blob 을 적는다 - 검사기가 작업 트리의 내용과 맞댄다(Task 1).
const { execFileSync } = require('node:child_process')
for (const path of [
  'lib/auth/flow.ts',
  'test/unit/auth/flow.test.ts',
  'test/e2e/probe-email.ts',
  'test/unit/e2e/probe-email.test.ts',
]) {
  record.sourceBlobs[path] = execFileSync(
    'git',
    ['-C', '../template-typescript-nextjs', 'rev-parse', `${record.commit}:${path}`],
    { encoding: 'utf8' },
  ).trim()
}
fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`)
EOF
git diff --stat docs/provenance/copied-core.json
node scripts/check-provenance.mjs
```

Expected: 기존 항목은 바뀌지 않고(더한 줄만 보인다) `복사 출처 기록 통과: 경로 44개, 이탈 17건, 원본 그대로 31개`(Task 1 끝의 33·10·27에 경로 11개·이탈 7건·원본 그대로 4개를 더한 값이다). `원본과 다르다`가 나오면 그 파일을 Step 2의 `git show`로 다시 받는다 — 그대로 복사한 넷은 이 태스크에서 고치지 않는다.

- [ ] **Step 12: `lib/jsonapi/AGENTS.md`에 새 파일을 적는다**

파일 끝에 더한다:

````markdown

## 이 저장소가 더한 것

복사본이 아니다 - 출처 기록에 없다.

| 파일 | 역할 |
| --- | --- |
| `send.ts` | 요청을 보내는 함수의 모양(`JsonApiSend`). 인증 호출은 `request()` 대신 이것을 주입받는다 - 앱에서는 `platform/api.ts`의 클라이언트가 들어온다(스펙 9.4) |
````

- [ ] **Step 13: 정적 검사를 돌린다**

```bash
pnpm format
BACKEND_URL=https://gate-check.invalid pnpm types:routes
pnpm typecheck && pnpm lint && pnpm format:check && pnpm lint:secrets
./scripts/check-citations.sh app components lib platform test
pnpm test 2>&1 | tail -5
```

Expected: 전부 exit 0. 단위 시험은 Task 1 끝의 수(D1의 407에 30을 더한 437)에 이 태스크의 새 시험(credentials 19 · flow 39 · logout 23 · rotation 10 · protected-paths 17 · probe-email 12 = 120)을 더한 557개가 통과한다.

- [ ] **Step 14: 커밋한다**

```bash
git add lib/jsonapi/send.ts lib/jsonapi/AGENTS.md lib/auth test/unit/auth test/e2e/probe-email.ts test/unit/e2e/probe-email.test.ts docs/provenance/copied-core.json
git status --short
git commit -m "feat: Next.js 템플릿의 인증 판단을 복사하고 요청 전송을 주입받게 고친다"
```

---

### Task 3: 세션 저장소와 세션 관리자

**Files:**
- Create: `lib/auth/session-store.ts`, `lib/auth/session-manager.ts`, `test/unit/auth/session-store.test.ts`, `test/unit/auth/session-manager.test.ts`, `lib/auth/AGENTS.md`

**Interfaces:**
- Consumes: Task 2의 `JsonApiSend`, `rotateSession`, `endSession`, `type LogoutOutcome`, `type AuthTokensDocument`; `isAccessExpiring`·`ACCESS_EXPIRY_LEEWAY_MS`·`type Session`(`lib/auth/tokens.ts`)
- Produces:
  - `lib/auth/session-store.ts`: `SESSION_STORAGE_KEY = 'auth.session'`, `interface StoredSession extends Session { refreshExpiresAt: number }`, `interface SessionStorage { read: () => Promise<string | null>; write: (value: string) => Promise<void>; clear: () => Promise<void> }`, `storedSessionFrom(session: Session, refreshExpiresIn: number, now: number): StoredSession`, `serializeSession(session: StoredSession): string`, `restoreSession(raw: string | null, now: number): StoredSession | null`
  - `lib/auth/session-manager.ts`: `type SessionStatus = 'restoring' | 'signedIn' | 'signedOut'`, `interface SessionManagerDeps { storage: SessionStorage; send: JsonApiSend; now: () => number }`, `createSessionManager(deps): SessionManager`, `interface SessionManager { restore; status; current; subscribe(listener: () => void): () => void; establish(session: Session, refreshExpiresIn: number): Promise<void>; getAccessToken(): Promise<string | null>; signOut(): Promise<void>; logout(clearCaches: () => void): Promise<LogoutOutcome> }` — 멤버는 전부 함수 속성이다

- [ ] **Step 1: 저장 모양과 복원 판단의 시험을 쓴다**

`test/unit/auth/session-store.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  SESSION_STORAGE_KEY,
  restoreSession,
  serializeSession,
  storedSessionFrom,
  type StoredSession,
} from '@/lib/auth/session-store'

/**
 * 세션의 저장 모양과 복원 판단(스펙 7.1). 픽스처는 실전값이 아니다 - access·refresh 가 서로
 * 다르고, 수명(137초·8641초)은 실전(900·2592000)과 다르다. 같으면 두 필드를 바꿔 배선해도
 * 초록이다.
 */
const NOW = 1_800_000_000_000

const PROBE: StoredSession = {
  accessToken: 'probe-access-token',
  refreshToken: 'probe-refresh-token',
  accessExpiresAt: NOW + 137_000,
  refreshExpiresAt: NOW + 8_641_000,
}

describe('storedSessionFrom', () => {
  it('refresh 만료 시각은 받은 시각에 refreshExpiresIn 을 더한 것이다 - access 쪽은 그대로다', () => {
    expect(
      storedSessionFrom(
        {
          accessToken: 'probe-access-token',
          refreshToken: 'probe-refresh-token',
          accessExpiresAt: NOW + 137_000,
        },
        8641,
        NOW,
      ),
    ).toEqual(PROBE)
  })
})

describe('serializeSession', () => {
  it('항목 하나에 네 필드만 쓴다 - 호출자 객체의 다른 필드가 저장소로 새지 않는다', () => {
    const leaky = { ...PROBE, probeLeak: 'probe-leak-value' }
    const written = serializeSession(leaky)
    expect(written).not.toContain('probe-leak-value')
    expect(Object.keys(JSON.parse(written) as Record<string, unknown>)).toEqual([
      'accessToken',
      'refreshToken',
      'accessExpiresAt',
      'refreshExpiresAt',
    ])
  })
})

describe('restoreSession - 앱이 켜질 때', () => {
  it('쓴 것을 그대로 되살린다', () => {
    expect(restoreSession(serializeSession(PROBE), NOW)).toEqual(PROBE)
  })

  it('저장된 값이 없으면 null 이다', () => {
    expect(restoreSession(null, NOW)).toBeNull()
  })

  it.each([
    ['JSON 이 아니다', '{probe'],
    ['배열이다', '[]'],
    ['null 이다', 'null'],
    ['문자열이다', '"probe"'],
    ['refresh 가 빠졌다', JSON.stringify({ ...PROBE, refreshToken: undefined })],
    ['access 가 빈 문자열이다', JSON.stringify({ ...PROBE, accessToken: '' })],
    ['만료 시각이 문자열이다', JSON.stringify({ ...PROBE, accessExpiresAt: String(NOW) })],
    ['refresh 만료 시각이 null 이다', JSON.stringify({ ...PROBE, refreshExpiresAt: null })],
  ])('%s → null - 로그아웃 상태로 시작한다', (_label, raw) => {
    expect(restoreSession(raw, NOW)).toBeNull()
  })

  it('refresh 가 이미 만료됐으면 null 이다 - 경계 포함', () => {
    expect(restoreSession(serializeSession({ ...PROBE, refreshExpiresAt: NOW }), NOW)).toBeNull()
    const justAlive = { ...PROBE, refreshExpiresAt: NOW + 1 }
    expect(restoreSession(serializeSession(justAlive), NOW)).toEqual(justAlive)
  })

  it('access 만 만료된 세션은 되살린다 - 다음 인증 요청이 회전한다(스펙 7.2)', () => {
    const accessExpired = { ...PROBE, accessExpiresAt: NOW - 1 }
    expect(restoreSession(serializeSession(accessExpired), NOW)).toEqual(accessExpired)
  })

  it('저장된 값에 다른 필드가 있어도 네 필드만 되살린다', () => {
    const raw = JSON.stringify({ ...PROBE, probeLeak: 'probe-leak-value' })
    expect(restoreSession(raw, NOW)).toEqual(PROBE)
  })
})

describe('SESSION_STORAGE_KEY', () => {
  it('SecureStore 가 받는 글자만 쓴다 - 영숫자와 . - _', () => {
    expect(SESSION_STORAGE_KEY).toMatch(/^[A-Za-z0-9._-]+$/)
  })
})
```

```bash
pnpm exec vitest run test/unit/auth/session-store.test.ts 2>&1 | tail -5
```

Expected: FAIL — `@/lib/auth/session-store`가 없다.

- [ ] **Step 2: 저장 모양과 복원 판단을 쓴다**

`lib/auth/session-store.ts`:

```ts
import type { Session } from './tokens'

/**
 * 세션의 저장 모양과 복원 판단 - 스펙 7.1.
 *
 * 세션은 저장소 항목 **하나**에 JSON 으로 둔다. 회전은 두 토큰을 한꺼번에 바꾸는데, 항목이
 * 둘이면 두 쓰기 사이에 앱이 종료될 때 새 refresh 를 잃을 수 있다.
 *
 * 저장 매체(SecureStore)는 이 파일이 모른다 - `SessionStorage` 모양만 정하고, 앱에서는
 * platform/secure-session-storage.ts 가, 시험에서는 메모리 가짜가 그 모양을 채운다.
 */

/** 저장소 항목의 키. SecureStore 키는 영숫자와 `.`·`-`·`_` 만 받는다. */
export const SESSION_STORAGE_KEY = 'auth.session'

/** 저장되는 세션 - tokens.ts 의 Session 에 refresh 만료 시각을 더한다. */
export interface StoredSession extends Session {
  /** epoch ms. 이 시각 이후로는 refresh 로 회전할 수 없다 - 되살리지 않는다. */
  refreshExpiresAt: number
}

/**
 * 세션 항목 하나를 읽고 쓰고 지우는 저장 매체. 멤버를 함수 속성으로 적는다 - 호출자가 떼어
 * 넘겨도 this 에 기대지 않는다.
 */
export interface SessionStorage {
  read: () => Promise<string | null>
  write: (value: string) => Promise<void>
  clear: () => Promise<void>
}

/**
 * 로그인·회전 응답에서 저장할 세션을 만든다. `now` 는 응답을 받은 순간의 기기 시각이다 -
 * `session.accessExpiresAt` 을 만든 시각과 같은 값을 넘긴다(tokens.ts 의 sessionFromTokenDocument).
 */
export function storedSessionFrom(
  session: Session,
  refreshExpiresIn: number,
  now: number,
): StoredSession {
  return {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    accessExpiresAt: session.accessExpiresAt,
    refreshExpiresAt: now + refreshExpiresIn * 1000,
  }
}

/** 네 필드만 정해진 순서로 쓴다 - 호출자가 넘긴 객체의 다른 필드가 저장소로 새지 않는다. */
export function serializeSession(session: StoredSession): string {
  return JSON.stringify({
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    accessExpiresAt: session.accessExpiresAt,
    refreshExpiresAt: session.refreshExpiresAt,
  })
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value !== ''
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/**
 * 앱이 켜질 때 저장된 값을 세션으로 되살린다. 되살릴 수 없으면 `null` - 로그아웃 상태로 시작한다.
 *
 * `null` 이 되는 경우: 저장된 값이 없다 · JSON 이 아니다 · 필드가 빠졌거나 모양이 다르다 ·
 * refresh 가 이미 만료됐다. access 만 만료된 세션은 되살린다 - 다음 인증 요청이 회전한다(스펙 7.2).
 */
export function restoreSession(raw: string | null, now: number): StoredSession | null {
  if (raw === null) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null

  const { accessToken, refreshToken, accessExpiresAt, refreshExpiresAt } = parsed as Record<
    string,
    unknown
  >
  if (
    !isNonEmptyString(accessToken) ||
    !isNonEmptyString(refreshToken) ||
    !isFiniteNumber(accessExpiresAt) ||
    !isFiniteNumber(refreshExpiresAt)
  ) {
    return null
  }
  if (refreshExpiresAt <= now) return null
  return { accessToken, refreshToken, accessExpiresAt, refreshExpiresAt }
}
```

```bash
pnpm exec vitest run test/unit/auth/session-store.test.ts
```

Expected: PASS, 16개.

- [ ] **Step 3: 세션 관리자의 시험을 쓴다**

`test/unit/auth/session-manager.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AuthTokensDocument } from '@/lib/auth/rotation'
import { createSessionManager } from '@/lib/auth/session-manager'
import { serializeSession, type SessionStorage, type StoredSession } from '@/lib/auth/session-store'
import { ACCESS_EXPIRY_LEEWAY_MS } from '@/lib/auth/tokens'
import type { JsonApiResult, RequestOptions } from '@/lib/jsonapi/client'
import type { JsonApiSend } from '@/lib/jsonapi/send'

/**
 * 세션 관리자 - 회전이 일어나는 유일한 자리(스펙 7.2). 저장소·전송·시계를 가짜로 꽂아 잰다.
 *
 * 픽스처는 실전에서 나올 수 없는 값이다 - 옛 토큰과 새 토큰, access 와 refresh 가 서로 다르고,
 * expiresIn(137)·refreshExpiresIn(8641)은 실전값(900·2592000)이 아니다. 같으면 "새 값을 썼다"와
 * "옛 값을 그대로 뒀다"가 구별되지 않는다.
 */

const NOW = 1_800_000_000_000
const REFRESH_PATH = '/api/v1/auth/refresh'
const LOGOUT_PATH = '/api/v1/auth/logout'

/** 저장된 옛 세션. access 는 `accessMs` 뒤에 만료된다. */
function oldSession(accessMs: number): StoredSession {
  return {
    accessToken: 'probe-access-old',
    refreshToken: 'probe-refresh-old',
    accessExpiresAt: NOW + accessMs,
    refreshExpiresAt: NOW + 8_641_000,
  }
}

/** 회전이 성공했을 때 저장돼야 하는 새 세션. */
const ROTATED_SESSION: StoredSession = {
  accessToken: 'probe-access-new',
  refreshToken: 'probe-refresh-new',
  accessExpiresAt: NOW + 137_000,
  refreshExpiresAt: NOW + 8_641_000,
}

const ROTATED: JsonApiResult<AuthTokensDocument> = {
  ok: true,
  status: 200,
  document: {
    data: {
      type: 'authTokens',
      id: 'probe-jti',
      attributes: {
        accessToken: 'probe-access-new',
        refreshToken: 'probe-refresh-new',
        tokenType: 'ProbeBearer',
        expiresIn: 137,
        refreshExpiresIn: 8641,
      },
    },
  },
}

const REVOKED: JsonApiResult<unknown> = {
  ok: false,
  status: 401,
  errors: [{ status: '401', code: 'TOKEN_REVOKED' }],
}

const UNREACHABLE: JsonApiResult<unknown> = {
  ok: false,
  status: 0,
  errors: [{ status: '0', code: 'NETWORK_ERROR', meta: { synthetic: true } }],
}

const LOGGED_OUT: JsonApiResult<unknown> = { ok: true, status: 204, document: null }

/** 가짜 전송이 차례로 돌려줄 응답. Promise 면 시험이 푸는 시점에 응답이 온다. */
type ScriptedResponse = JsonApiResult<unknown> | Promise<JsonApiResult<unknown>>

/**
 * 관리자 하나와 그 가짜 저장소·전송. `log` 가 저장소 쓰기·지우기와 요청을 불린 순서대로 모은다 -
 * "저장이 반환보다 먼저", "기기 쪽을 비운 뒤에 요청" 같은 순서를 한 배열로 잰다.
 */
function harness(stored: StoredSession | null, ...responses: ScriptedResponse[]) {
  const log: string[] = []
  const sent: { path: string; options: RequestOptions }[] = []
  let value: string | null = stored === null ? null : serializeSession(stored)
  const storage: SessionStorage = {
    read: () => Promise.resolve(value),
    write: (next) => {
      log.push('write')
      value = next
      return Promise.resolve()
    },
    clear: () => {
      log.push('clear')
      value = null
      return Promise.resolve()
    },
  }
  const send: JsonApiSend = <T>(path: string, options: RequestOptions = {}) => {
    log.push(`send ${path}`)
    sent.push({ path, options })
    const next = responses.shift()
    if (next === undefined) return Promise.reject(new Error(`준비하지 않은 요청: ${path}`))
    return Promise.resolve(next) as Promise<JsonApiResult<T>>
  }
  const manager = createSessionManager({ storage, send, now: () => NOW })
  return { manager, storage, log, sent, stored: () => value }
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve: (value: T) => void = () => undefined
  const promise = new Promise<T>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

/** 대기 중인 Promise 연쇄가 한 바퀴 돌게 한다. */
function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

describe('restore - 앱이 켜질 때(스펙 7.1)', () => {
  it('저장된 세션을 되살리고 signedIn 이 된다 - 그 전에는 restoring 이다', async () => {
    const h = harness(oldSession(600_000))
    expect(h.manager.status()).toBe('restoring')
    await expect(h.manager.restore()).resolves.toEqual(oldSession(600_000))
    expect(h.manager.status()).toBe('signedIn')
    expect(h.manager.current()).toEqual(oldSession(600_000))
    expect(h.log).toEqual([])
  })

  it('저장된 값이 없으면 signedOut 이고 저장소를 건드리지 않는다', async () => {
    const h = harness(null)
    await expect(h.manager.restore()).resolves.toBeNull()
    expect(h.manager.status()).toBe('signedOut')
    expect(h.log).toEqual([])
  })

  it('되살릴 수 없는 값(refresh 만료)은 지우고 signedOut 으로 시작한다', async () => {
    const h = harness({ ...oldSession(600_000), refreshExpiresAt: NOW })
    await expect(h.manager.restore()).resolves.toBeNull()
    expect(h.manager.status()).toBe('signedOut')
    expect(h.log).toEqual(['clear'])
    expect(h.stored()).toBeNull()
  })

  it('저장소를 읽다가 던져도 던지지 않고 signedOut 이다', async () => {
    const h = harness(null)
    h.storage.read = () => Promise.reject(new Error('probe keystore failure'))
    await expect(h.manager.restore()).resolves.toBeNull()
    expect(h.manager.status()).toBe('signedOut')
  })
})

describe('establish - 로그인·가입이 받은 토큰', () => {
  it('저장소에 먼저 쓰고, 알릴 때는 이미 저장돼 있다', async () => {
    const h = harness(null)
    await h.manager.restore()
    const storedWhenNotified: (string | null)[] = []
    h.manager.subscribe(() => {
      storedWhenNotified.push(h.stored())
    })

    await h.manager.establish(
      {
        accessToken: 'probe-access-new',
        refreshToken: 'probe-refresh-new',
        accessExpiresAt: NOW + 137_000,
      },
      8641,
    )

    expect(storedWhenNotified).toEqual([serializeSession(ROTATED_SESSION)])
    expect(h.manager.current()).toEqual(ROTATED_SESSION)
    expect(h.manager.status()).toBe('signedIn')
  })
})

describe('getAccessToken - 회전은 한 곳에서, 한 번에 하나만(스펙 7.2)', () => {
  it('세션이 없으면 null 이고 백엔드를 부르지 않는다', async () => {
    const h = harness(null)
    await h.manager.restore()
    await expect(h.manager.getAccessToken()).resolves.toBeNull()
    expect(h.sent).toEqual([])
  })

  it('만료까지 60초보다 넉넉하면 지금 access 를 돌려주고 회전하지 않는다', async () => {
    const h = harness(oldSession(ACCESS_EXPIRY_LEEWAY_MS + 1))
    await h.manager.restore()
    await expect(h.manager.getAccessToken()).resolves.toBe('probe-access-old')
    expect(h.sent).toEqual([])
  })

  it('만료까지 60초 이하면(경계 포함) refresh 로 회전하고 새 세션을 저장한 뒤 새 access 를 돌려준다', async () => {
    const h = harness(oldSession(ACCESS_EXPIRY_LEEWAY_MS), ROTATED)
    await h.manager.restore()

    await expect(h.manager.getAccessToken()).resolves.toBe('probe-access-new')

    expect(h.sent).toHaveLength(1)
    expect(h.sent[0]?.path).toBe(REFRESH_PATH)
    expect(h.sent[0]?.options.body).toEqual({
      data: { type: 'refreshTokens', attributes: { refreshToken: 'probe-refresh-old' } },
    })
    // 회전 요청에 access 를 싣지 않는다 - 본문의 refresh 가 스스로 지목한다.
    expect(h.sent[0]?.options.accessToken).toBeUndefined()
    expect(h.manager.current()).toEqual(ROTATED_SESSION)
    expect(h.stored()).toBe(serializeSession(ROTATED_SESSION))
  })

  it('동시에 두 번 불러도 refresh 요청은 한 번이고 둘 다 새 access 를 받는다', async () => {
    const response = deferred<JsonApiResult<unknown>>()
    const h = harness(oldSession(0), response.promise)
    await h.manager.restore()

    const first = h.manager.getAccessToken()
    const second = h.manager.getAccessToken()
    await settle()
    expect(h.sent).toHaveLength(1)

    response.resolve(ROTATED)
    await expect(Promise.all([first, second])).resolves.toEqual([
      'probe-access-new',
      'probe-access-new',
    ])
    expect(h.sent).toHaveLength(1)
  })

  it('새 세션을 저장소에 다 쓴 뒤에야 돌려준다', async () => {
    const h = harness(oldSession(0), ROTATED)
    await h.manager.restore()
    const write = deferred<undefined>()
    h.storage.write = () => {
      h.log.push('write')
      return write.promise
    }

    let returned = false
    const token = h.manager.getAccessToken().then((value) => {
      returned = true
      return value
    })
    await settle()
    expect(h.log).toEqual([`send ${REFRESH_PATH}`, 'write'])
    expect(returned).toBe(false)

    write.resolve(undefined)
    await expect(token).resolves.toBe('probe-access-new')
    expect(returned).toBe(true)
  })

  it('회전이 거절되면(401 등) 세션을 지우고 null 이다 - 로그아웃을 알린다', async () => {
    const h = harness(oldSession(0), REVOKED)
    await h.manager.restore()
    const notified: string[] = []
    h.manager.subscribe(() => {
      notified.push(h.manager.status())
    })

    await expect(h.manager.getAccessToken()).resolves.toBeNull()

    expect(h.log).toEqual([`send ${REFRESH_PATH}`, 'clear'])
    expect(h.manager.current()).toBeNull()
    expect(notified).toEqual(['signedOut'])
  })

  it('백엔드에 닿지 못하면 세션을 건드리지 않고 지금 access 를 돌려준다', async () => {
    const h = harness(oldSession(0), UNREACHABLE)
    await h.manager.restore()

    await expect(h.manager.getAccessToken()).resolves.toBe('probe-access-old')

    expect(h.log).toEqual([`send ${REFRESH_PATH}`])
    expect(h.manager.current()).toEqual(oldSession(0))
    expect(h.manager.status()).toBe('signedIn')
  })

  it('회전이 끝나면 다음 호출은 새 access 를 회전 없이 받는다', async () => {
    const h = harness(oldSession(0), ROTATED)
    await h.manager.restore()
    await h.manager.getAccessToken()
    await expect(h.manager.getAccessToken()).resolves.toBe('probe-access-new')
    expect(h.sent).toHaveLength(1)
  })

  it('회전하는 동안 로그아웃하면 늦게 온 회전 결과가 세션을 되살리지 않는다', async () => {
    const response = deferred<JsonApiResult<unknown>>()
    const h = harness(oldSession(0), response.promise)
    await h.manager.restore()

    const token = h.manager.getAccessToken()
    await settle()
    await h.manager.signOut()
    response.resolve(ROTATED)

    await expect(token).resolves.toBeNull()
    expect(h.manager.current()).toBeNull()
    expect(h.stored()).toBeNull()
    expect(h.log).toEqual([`send ${REFRESH_PATH}`, 'clear'])
  })
})

describe('signOut - 인증 오류를 받았을 때(스펙 9.2)', () => {
  it('저장소를 지우고 signedOut 을 알린다 - 백엔드는 부르지 않는다', async () => {
    const h = harness(oldSession(600_000))
    await h.manager.restore()
    const notified: string[] = []
    h.manager.subscribe(() => {
      notified.push(h.manager.status())
    })

    await h.manager.signOut()

    expect(h.log).toEqual(['clear'])
    expect(h.sent).toEqual([])
    expect(notified).toEqual(['signedOut'])
  })

  it('구독을 끊으면 더 알리지 않는다', async () => {
    const h = harness(oldSession(600_000))
    await h.manager.restore()
    const listener = vi.fn()
    const unsubscribe = h.manager.subscribe(listener)
    unsubscribe()
    await h.manager.signOut()
    expect(listener).not.toHaveBeenCalled()
  })
})

describe('logout - 기기 쪽을 먼저 비우고 refresh 폐기를 요청한다(스펙 7.4)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('저장소와 캐시를 비운 뒤에 옛 refresh 로 폐기를 요청한다', async () => {
    const h = harness(oldSession(600_000), LOGGED_OUT)
    await h.manager.restore()

    const outcome = await h.manager.logout(() => {
      h.log.push('caches')
    })

    expect(outcome).toEqual({ kind: 'revoked' })
    expect(h.log).toEqual(['clear', 'caches', `send ${LOGOUT_PATH}`])
    expect(h.sent[0]?.options.body).toEqual({
      data: { type: 'refreshTokens', attributes: { refreshToken: 'probe-refresh-old' } },
    })
    expect(h.manager.status()).toBe('signedOut')
  })

  it('백엔드가 거절해도 기기 쪽은 이미 비어 있다', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const h = harness(oldSession(600_000), REVOKED)
    await h.manager.restore()

    const outcome = await h.manager.logout(() => {
      h.log.push('caches')
    })

    expect(outcome.kind).toBe('notRevoked')
    expect(h.log).toEqual(['clear', 'caches', `send ${LOGOUT_PATH}`])
    expect(h.stored()).toBeNull()
    expect(h.manager.current()).toBeNull()
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('세션이 없어도 기기 쪽을 비우고 백엔드는 부르지 않는다', async () => {
    const h = harness(null)
    await h.manager.restore()

    const outcome = await h.manager.logout(() => {
      h.log.push('caches')
    })

    expect(outcome).toEqual({ kind: 'noSession' })
    expect(h.log).toEqual(['clear', 'caches'])
  })
})
```

```bash
pnpm exec vitest run test/unit/auth/session-manager.test.ts 2>&1 | tail -5
```

Expected: FAIL — `@/lib/auth/session-manager`가 없다.

- [ ] **Step 4: 세션 관리자를 쓴다**

`lib/auth/session-manager.ts`:

```ts
import type { JsonApiSend } from '@/lib/jsonapi/send'
import { endSession, type LogoutOutcome } from './logout'
import { rotateSession } from './rotation'
import {
  restoreSession,
  serializeSession,
  storedSessionFrom,
  type SessionStorage,
  type StoredSession,
} from './session-store'
import { isAccessExpiring, type Session } from './tokens'

/**
 * 세션 관리자 - 회전이 일어나는 유일한 자리(스펙 7.2).
 *
 * 백엔드는 회전할 때 구 refresh token 을 즉시 폐기하고, 폐기된 토큰을 다시 내밀면 그 사용자의
 * 세션을 전부 끊는다(rotation.ts 머리말의 실측). 동시 요청이 각자 회전하면 두 번째부터
 * TOKEN_REVOKED 로 실패해 사용자가 이유 없이 로그아웃된다. 그래서:
 *
 *   - 인증이 필요한 요청은 전부 `getAccessToken()` 을 지난다.
 *   - 진행 중인 회전이 있으면 새 호출은 그 Promise 를 같이 기다린다 - refresh 요청은 한 번이다.
 *   - 회전에 성공하면 새 세션을 저장소에 **먼저** 쓰고 그다음 돌려준다. 거꾸로면 쓰기 전에 앱이
 *     죽었을 때 이미 폐기된 옛 refresh 만 남는다.
 *   - 401 을 받았을 때 회전해서 재시도하지 않는다. 인증 오류를 받은 호출자는 `signOut()` 하고
 *     로그인으로 보낸다(스펙 9.2).
 *   - 백그라운드 타이머를 두지 않는다. 앱이 다시 앞으로 나올 때의 재조회가 이 경로를 지나며
 *     필요하면 회전한다.
 *
 * 저장소·전송·시계를 주입받는다 - 앱에서는 platform/session.ts 가 SecureStore·API 클라이언트·
 * Date.now 를 꽂고, 시험은 가짜를 꽂아 node 에서 잰다.
 */

/** restoring 은 앱이 켜질 때 저장소를 읽는 동안이다 - 앱은 그동안 스플래시를 유지한다(스펙 7.1). */
export type SessionStatus = 'restoring' | 'signedIn' | 'signedOut'

export interface SessionManagerDeps {
  storage: SessionStorage
  send: JsonApiSend
  now: () => number
}

/**
 * 멤버를 메서드가 아니라 함수 속성으로 적는다 - useSyncExternalStore 에 `manager.subscribe` 를
 * 그대로 넘기므로 this 에 기대지 않아야 한다.
 */
export interface SessionManager {
  /** 앱이 켜질 때 한 번 부른다. 되살릴 수 없는 값은 저장소에서 지운다. 던지지 않는다. */
  restore: () => Promise<StoredSession | null>
  status: () => SessionStatus
  current: () => StoredSession | null
  /** 상태가 바뀔 때마다 부른다. 돌려준 함수로 구독을 끊는다. */
  subscribe: (listener: () => void) => () => void
  /** 로그인·가입이 받은 토큰으로 세션을 세운다 - 저장소에 먼저 쓰고 그다음 알린다. */
  establish: (session: Session, refreshExpiresIn: number) => Promise<void>
  /**
   * 인증이 필요한 요청이 실을 access token. 세션이 없으면 null 이다 - 쓰기 훅은 요청하지 않고
   * 로그인으로 보낸다(스펙 7.3 의 두 번째 겹). 만료까지 60초 이하면 회전한다.
   */
  getAccessToken: () => Promise<string | null>
  /** 기기 세션을 지운다 - 인증 오류를 받았을 때(스펙 9.2). 백엔드를 부르지 않는다. */
  signOut: () => Promise<void>
  /**
   * 로그아웃(스펙 7.4) - 기기 세션과 캐시(`clearCaches`)를 먼저 비우고 refresh 폐기를 요청한다.
   * 요청이 실패해도 기기 쪽은 이미 비어 있다(logout.ts 의 endSession).
   */
  logout: (clearCaches: () => void) => Promise<LogoutOutcome>
}

export function createSessionManager({ storage, send, now }: SessionManagerDeps): SessionManager {
  let session: StoredSession | null = null
  let status: SessionStatus = 'restoring'
  let rotation: Promise<string | null> | null = null
  // 세션을 세우거나 지울 때마다 늘린다. 회전이 끝났을 때 값이 바뀌어 있으면 그 사이에 로그아웃이나
  // 새 로그인이 있었던 것이다 - 늦게 온 회전 결과로 덮어쓰지 않는다(로그아웃한 세션이 되살아나지 않게).
  let generation = 0
  const listeners = new Set<() => void>()

  function publish(next: StoredSession | null): void {
    session = next
    status = next === null ? 'signedOut' : 'signedIn'
    for (const listener of listeners) listener()
  }

  async function save(next: StoredSession): Promise<void> {
    await storage.write(serializeSession(next))
    publish(next)
  }

  async function signOut(): Promise<void> {
    generation += 1
    await storage.clear()
    publish(null)
  }

  async function rotate(current: StoredSession): Promise<string | null> {
    const startedIn = generation
    const at = now()
    const outcome = await rotateSession(current.refreshToken, send, at)
    if (generation !== startedIn) return session?.accessToken ?? null
    if (outcome.kind === 'rotated') {
      const next = storedSessionFrom(outcome.session, outcome.refreshExpiresIn, at)
      await save(next)
      return next.accessToken
    }
    if (outcome.kind === 'destroy') {
      await signOut()
      return null
    }
    // unreachable - 백엔드가 판정을 내지 못했다. 세션이 죽었다는 증거가 없으므로 건드리지 않고
    // 지금 access 를 돌려준다(스펙 7.2).
    return current.accessToken
  }

  return {
    restore: async () => {
      let restored: StoredSession | null = null
      try {
        const raw = await storage.read()
        restored = restoreSession(raw, now())
        if (restored === null && raw !== null) await storage.clear()
      } catch {
        // 읽지 못한 세션(기기 키 저장소가 항목을 풀지 못하는 경우 등)은 없는 것과 같다 - 로그아웃
        // 상태로 시작한다(스펙 7.1).
      }
      publish(restored)
      return restored
    },
    status: () => status,
    current: () => session,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    establish: async (tokens, refreshExpiresIn) => {
      generation += 1
      await save(storedSessionFrom(tokens, refreshExpiresIn, now()))
    },
    getAccessToken: () => {
      const current = session
      if (current === null) return Promise.resolve(null)
      if (!isAccessExpiring(current, now())) return Promise.resolve(current.accessToken)
      if (rotation === null) {
        rotation = rotate(current).finally(() => {
          rotation = null
        })
      }
      return rotation
    },
    signOut,
    logout: (clearCaches) =>
      endSession(session ?? undefined, send, async () => {
        await signOut()
        clearCaches()
      }),
  }
}
```

```bash
pnpm exec vitest run test/unit/auth/session-manager.test.ts
```

Expected: PASS, 19개.

- [ ] **Step 5: 계층 문서를 쓴다**

`lib/auth/AGENTS.md`:

````markdown
# lib/auth/ 작업 지침

세션 모델과 직렬화, 만료 판정, 회전 결정, 자격증명 문서, 보호 경로 목록을 소유한다(스펙 5장).
저장 매체와 화면 이동은 소유하지 않는다 - SecureStore 는 `platform/`, 이동은 `app/`이 한다.

## 회전은 한 곳에서, 한 번에 하나만

백엔드는 회전할 때 구 refresh token 을 즉시 폐기하고, 폐기된 토큰을 다시 내밀면 그 사용자의
세션을 전부 끊는다. 그래서:

- `/api/v1/auth/refresh`를 부르는 코드는 `rotation.ts`의 `rotateSession()` 하나이고, 그것을
  부르는 곳은 `session-manager.ts` 하나다.
- 인증이 필요한 요청은 `getAccessToken()`을 지난다. 진행 중인 회전이 있으면 그 Promise 를 같이
  기다린다. 새 세션은 저장소에 먼저 쓰고 그다음 돌려준다.
- 401 에 회전·재시도를 붙이지 않는다. 인증 오류를 받으면 `signOut()`하고 로그인으로 보낸다.

## 요청은 주입받은 전송으로만

인증 호출은 `request()`를 직접 부르지 않고 `send: JsonApiSend`(`lib/jsonapi/send.ts`)를 받는다.
앱에서는 `platform/api.ts`의 `apiRequest`가 들어온다 - Accept-Language 를 싣는 자리는 그 한
곳이다(스펙 9.4).

## 파일

| 파일 | 역할 |
| --- | --- |
| `tokens.ts` | (복사) access 만료 시각, 60초 여유 판정 |
| `credentials.ts` | (복사·수정) 가입·로그인 요청과 해석, 가입 뒤 로그인 |
| `flow.ts` | (복사) 복귀 경로 검사(`safeRedirectTarget`), 폼 오류 상태, 로그인·가입 뒤의 결정 |
| `form-state.ts` | (복사·수정) 폼 입력 이름과 상태, 쓸 수 없는 응답의 문구 |
| `logout.ts` | (복사·수정) 기기 쪽을 먼저 비우고 refresh 폐기를 요청 |
| `rotation.ts` | (복사·수정) 회전 요청과 응답 해석 |
| `protected-paths.ts` | 보호 경로 목록 하나와 로그인 주소 |
| `session-store.ts` | 저장 모양(항목 하나의 JSON)과 복원 판단 |
| `session-manager.ts` | 회전의 유일한 자리, 세션 상태와 구독 |

(복사) 표시 파일은 `template-typescript-nextjs`에서 복사했다. 출처와 이탈은
`docs/provenance/copied-core.json`이다. 그 주석의 "쿠키"·"proxy.ts"·"Server Action" 같은 자리는
원본 저장소의 것이다.

## 검증

순수 판단은 `test/unit/auth/`가 잰다. 저장 매체·전송·시계는 가짜를 주입한다. 실제 가입·로그인·
로그아웃·세션 복원은 `test/e2e/`의 플로가 잰다.
````

- [ ] **Step 6: 정적 검사를 돌리고 커밋한다**

```bash
pnpm format
pnpm typecheck && pnpm lint && pnpm format:check
./scripts/check-citations.sh app components lib platform test
pnpm exec vitest run test/unit/auth
git add lib/auth test/unit/auth
git status --short
git commit -m "feat: 세션 저장 모양과 회전을 한 곳에서 한 번에 하나만 하는 세션 관리자를 세운다"
```

Expected: 전부 exit 0, `test/unit/auth` 아래 시험 148개(Task 2의 113 + 16 + 19).

---

### Task 4: platform 바인딩 — 시작 설정 판단, API 클라이언트, SecureStore, 앱 시작 복원

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `app.config.ts`, `lib/config/app-variant.ts`, `lib/config/AGENTS.md`, `platform/config.ts`(다시 씀), `app/_layout.tsx`, `lib/jsonapi/AGENTS.md`, `test/unit/config/app-variant.test.ts`, `test/unit/config/app-config.test.ts`, `docs/superpowers/specs/2026-09-30-expo-jsonapi-template-design.md`(4장 정정)
- Create: `lib/config/startup.ts`, `test/unit/config/startup.test.ts`, `lib/jsonapi/accept-language.ts`, `lib/jsonapi/failure-log.ts`, `test/unit/jsonapi/accept-language.test.ts`, `test/unit/jsonapi/failure-log.test.ts`, `test/unit/deps/metro-pin.test.ts`, `platform/api.ts`, `platform/secure-session-storage.ts`, `platform/session.ts`, `platform/query-client.ts`, `platform/AGENTS.md`

**Interfaces:**
- Consumes: Task 2의 `JsonApiSend`, `request`·`withAcceptLanguage`; Task 3의 `createSessionManager`·`SessionStatus`·`SESSION_STORAGE_KEY`·`SessionStorage`; D1의 `getSettings`·`setSettingsSource`·`type Settings`·`type SettingsEnv`(`lib/config/settings.ts`), `parseAppVariant`·`type AppVariant`(`lib/config/app-variant.ts`), `FatalConfig`(`components/app/fatal-config.tsx`), `NAV_THEME`(`platform/theme.ts`)
- Produces:
  - `lib/config/startup.ts`: `type StartupSettings = { ok: true; settings: Settings } | { ok: false; message: string }`, `settingsEnvFromExtra(extra: unknown): SettingsEnv`, `checkStartupSettings(load: () => Settings): StartupSettings`, `variantFromExtra(extra: unknown): AppVariant`
  - `lib/jsonapi/accept-language.ts`: `MAX_ACCEPT_LANGUAGE_TAGS = 10`, `acceptLanguageFromLocales(tags: readonly string[]): string | null`
  - `lib/jsonapi/failure-log.ts`: `HTTP_FAILURE_MARKER = '[e2e-http]'`, `httpFailureLine(method: string, path: string, status: number, errors: readonly ErrorObject[]): string` — 형식 `[e2e-http] <상태> <메서드> <경로> <코드,코드|->`
  - `lib/config/app-variant.ts`: `VariantProfile.logsHttpFailures: boolean`(e2e만 `true`)
  - `platform/config.ts`: `loadStartupSettings(): StartupSettings`(이름과 결과는 D1 그대로), `startupVariant(): AppVariant`
  - `platform/api.ts`: `apiRequest: JsonApiSend`
  - `platform/secure-session-storage.ts`: `secureSessionStorage: SessionStorage`
  - `platform/session.ts`: `sessionManager: SessionManager`, `useSessionStatus(): SessionStatus`
  - `platform/query-client.ts`: `queryClient: QueryClient`
  - 앱 시작: 설정 검증이 통과하면 스플래시를 복원이 끝날 때까지 유지하고, `STARTUP.ok` 갈래의 자식(`AppRoot`)을 `QueryClientProvider`로 감싼다. `app/_layout.tsx`의 `        <Stack />`(여덟 칸 들여쓰기) 한 줄은 Task 5가 고친다.

- [ ] **Step 1: 의존성을 설치하고 지난 릴리스 대기 예외를 뺀다**

```bash
BACKEND_URL=https://gate-check.invalid pnpm exec expo install expo-secure-store; echo "expo install exit=$?"
pnpm add @tanstack/react-query@5.104.0
ls app.json 2>/dev/null && rm app.json
grep -n '"expo-secure-store"\|"@tanstack/react-query"' package.json
pnpm peers check; echo "peers exit=$?"
```

Expected: `expo-secure-store`는 `~57.0.x`로 들어온다(`expo install`은 설치 뒤 `Cannot automatically write to dynamic config`로 exit 1일 수 있다 — 설치는 된 것이다). `@tanstack/react-query`는 `5.104.0`. `app.json`이 없다. `peers exit=0`(`No peer dependency issues found`). 빌드 스크립트 허용을 물으면 `pnpm-workspace.yaml`의 `allowBuilds`에 이유 주석과 함께 적는다.

D2의 첫 의존성 변경이므로 `minimumReleaseAgeExclude`에서 릴리스 후 하루가 지난 항목을 뺀다(결정 30). 스크립트가 항목마다 레지스트리의 릴리스 시각을 읽어 남길지 정하고, 남는 항목이 없으면 블록과 머리 주석을 통째로 지운다. 남으면 주석을 어느 항목에나 맞는 문장으로 바꾼다(pnpm이 이번 설치에서 적은 항목도 같은 규칙을 따른다):

```bash
node - <<'EOF'
const { execSync } = require('node:child_process')
const fs = require('node:fs')

const DAY_MS = 24 * 60 * 60 * 1000
const file = 'pnpm-workspace.yaml'
const lines = fs.readFileSync(file, 'utf8').split('\n')
const start = lines.indexOf('minimumReleaseAgeExclude:')
if (start < 0) {
  console.log('minimumReleaseAgeExclude 가 없다 - 할 일이 없다')
  process.exit(0)
}
let end = start + 1
while (end < lines.length && lines[end].startsWith('  - ')) end += 1
let commentStart = start
while (commentStart > 0 && lines[commentStart - 1].startsWith('#')) commentStart -= 1

const kept = []
for (const line of lines.slice(start + 1, end)) {
  const spec = line.slice(4).replace(/^'|'$/g, '')
  const at = spec.lastIndexOf('@')
  const [name, version] = [spec.slice(0, at), spec.slice(at + 1)]
  const times = JSON.parse(execSync(`pnpm view ${name}@${version} time --json`, { encoding: 'utf8' }))
  const young = Date.now() - Date.parse(times[version]) < DAY_MS
  console.log(`${young ? '남긴다' : '뺀다  '} ${spec} (릴리스 ${times[version]})`)
  if (young) kept.push(line)
}

const block =
  kept.length === 0
    ? []
    : [
        '# pnpm 11 은 릴리스 후 1일(minimumReleaseAge, 기본 1440분)이 지나지 않은 버전이 락파일에 있으면 설치를',
        '# 막는다(ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION). 아래는 설치할 때 그 창 안에 있어 pnpm 이 스스로 적은',
        '# 예외다. 릴리스로부터 하루가 지나면 없어도 설치되므로 다음 의존성 변경 때 뺀다',
        '# (`pnpm view <이름>@<버전> time --json` 으로 릴리스 시각을 본다).',
        'minimumReleaseAgeExclude:',
        ...kept,
      ]
// 블록이 통째로 빠지면 뒤의 빈 줄 하나도 함께 뺀다.
const after = kept.length === 0 && lines[end] === '' ? end + 1 : end
fs.writeFileSync(file, [...lines.slice(0, commentStart), ...block, ...lines.slice(after)].join('\n'))
EOF
git diff pnpm-workspace.yaml
pnpm install --frozen-lockfile; echo "frozen exit=$?"
```

Expected: 항목마다 `뺀다`·`남긴다` 한 줄. 2026-09-30 10:59 UTC가 지났으면 Expo 다섯은 `뺀다`, 22:27 UTC 전이면 `lucide-react-native@1.49.0`은 `남긴다`(레지스트리 시각은 근거 사실 절). `frozen exit=0` — 뺀 항목이 아직 창 안이었다면 `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`이 그 이름을 댄다. 그러면 그 항목만 되돌린다.

- [ ] **Step 2: 앱 설정 시험에 SecureStore 플러그인을 더하고 실패를 본다**

`test/unit/config/app-config.test.ts`의 `describe('app.config.ts - 스펙 10.1·10.2', …)` 안, 마지막 `it` 뒤에 더한다:

```ts
  it('expo-secure-store 플러그인이 세션을 Android 자동 백업에서 빼고 Face ID 문구를 넣지 않는다 - 스펙 7.1', () => {
    const config = evaluate({
      BACKEND_URL: 'https://probe-backend.example',
      APP_VARIANT: 'production',
    })
    const entry = config.plugins?.find(
      (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-secure-store',
    )
    expect(entry).toEqual([
      'expo-secure-store',
      { configureAndroidBackup: true, faceIDPermission: false },
    ])
  })
```

```bash
pnpm exec vitest run test/unit/config/app-config.test.ts 2>&1 | tail -5
```

Expected: FAIL — `entry`가 `undefined`다.

- [ ] **Step 3: `app.config.ts`에 플러그인을 더한다**

Edit — 찾을 것:

```ts
      ['expo-build-properties', { android: { usesCleartextTraffic: profile.allowCleartext } }],
```

바꿀 것:

```ts
      ['expo-build-properties', { android: { usesCleartextTraffic: profile.allowCleartext } }],
      // 세션 항목(SecureStore)을 Android 자동 백업에서 뺀다 - 복원된 백업은 키 저장소의 키가 없어
      // 풀 수 없다. 생체 인증을 쓰지 않으므로(스펙 1.2) Face ID 사용 문구를 넣지 않는다(스펙 7.1).
      ['expo-secure-store', { configureAndroidBackup: true, faceIDPermission: false }],
```

```bash
pnpm exec vitest run test/unit/config/app-config.test.ts
for v in development preview production e2e; do APP_VARIANT=$v BACKEND_URL=https://gate-check.invalid pnpm exec expo config --type public --json >/dev/null && echo "config $v ok"; done
```

Expected: PASS 7개, `config … ok` 넷(플러그인이 설정 평가에서 풀린다).

- [ ] **Step 4: 변형 표에 e2e 실패 표식을 더한다**

`test/unit/config/app-variant.test.ts` — Edit, 찾을 것:

```ts
    expect(variantProfile('development')).toEqual({
      idSuffix: '.dev',
      schemeSuffix: '-dev',
      nameSuffix: ' (Dev)',
      allowCleartext: true,
    })
    expect(variantProfile('preview')).toEqual({
      idSuffix: '.preview',
      schemeSuffix: '-preview',
      nameSuffix: ' (Preview)',
      allowCleartext: false,
    })
    expect(variantProfile('production')).toEqual({
      idSuffix: '',
      schemeSuffix: '',
      nameSuffix: '',
      allowCleartext: false,
    })
    expect(variantProfile('e2e')).toEqual({
      idSuffix: '.e2e',
      schemeSuffix: '-e2e',
      nameSuffix: ' (E2E)',
      allowCleartext: true,
    })
  })
```

바꿀 것:

```ts
    expect(variantProfile('development')).toEqual({
      idSuffix: '.dev',
      schemeSuffix: '-dev',
      nameSuffix: ' (Dev)',
      allowCleartext: true,
      logsHttpFailures: false,
    })
    expect(variantProfile('preview')).toEqual({
      idSuffix: '.preview',
      schemeSuffix: '-preview',
      nameSuffix: ' (Preview)',
      allowCleartext: false,
      logsHttpFailures: false,
    })
    expect(variantProfile('production')).toEqual({
      idSuffix: '',
      schemeSuffix: '',
      nameSuffix: '',
      allowCleartext: false,
      logsHttpFailures: false,
    })
    expect(variantProfile('e2e')).toEqual({
      idSuffix: '.e2e',
      schemeSuffix: '-e2e',
      nameSuffix: ' (E2E)',
      allowCleartext: true,
      logsHttpFailures: true,
    })
  })

  it('HTTP 실패를 기기 로그에 남기는 것은 e2e 뿐이다 - E2E 가드의 재료(스펙 11.3)', () => {
    expect(APP_VARIANTS.filter((variant) => variantProfile(variant).logsHttpFailures)).toEqual([
      'e2e',
    ])
  })
```

```bash
pnpm exec vitest run test/unit/config/app-variant.test.ts 2>&1 | tail -5
```

Expected: FAIL — 프로필에 `logsHttpFailures`가 없다.

`lib/config/app-variant.ts` — Edit, 찾을 것:

```ts
  /** 평문 HTTP 허용 여부. development·e2e 만 허용한다. */
  readonly allowCleartext: boolean
}
```

바꿀 것:

```ts
  /** 평문 HTTP 허용 여부. development·e2e 만 허용한다. */
  readonly allowCleartext: boolean
  /**
   * API 클라이언트가 2xx 가 아닌 결과를 표식과 함께 기기 로그에 남기는가. e2e 만 켠다 - E2E
   * 하네스가 플로가 선언하지 않은 4xx·5xx 를 실패로 만드는 재료다(스펙 11.3).
   */
  readonly logsHttpFailures: boolean
}
```

`lib/config/app-variant.ts` — Edit, 찾을 것:

```ts
const PROFILES: Readonly<Record<AppVariant, VariantProfile>> = {
  development: {
    idSuffix: '.dev',
    schemeSuffix: '-dev',
    nameSuffix: ' (Dev)',
    allowCleartext: true,
  },
  preview: {
    idSuffix: '.preview',
    schemeSuffix: '-preview',
    nameSuffix: ' (Preview)',
    allowCleartext: false,
  },
  production: { idSuffix: '', schemeSuffix: '', nameSuffix: '', allowCleartext: false },
  e2e: { idSuffix: '.e2e', schemeSuffix: '-e2e', nameSuffix: ' (E2E)', allowCleartext: true },
}
```

바꿀 것:

```ts
const PROFILES: Readonly<Record<AppVariant, VariantProfile>> = {
  development: {
    idSuffix: '.dev',
    schemeSuffix: '-dev',
    nameSuffix: ' (Dev)',
    allowCleartext: true,
    logsHttpFailures: false,
  },
  preview: {
    idSuffix: '.preview',
    schemeSuffix: '-preview',
    nameSuffix: ' (Preview)',
    allowCleartext: false,
    logsHttpFailures: false,
  },
  production: {
    idSuffix: '',
    schemeSuffix: '',
    nameSuffix: '',
    allowCleartext: false,
    logsHttpFailures: false,
  },
  e2e: {
    idSuffix: '.e2e',
    schemeSuffix: '-e2e',
    nameSuffix: ' (E2E)',
    allowCleartext: true,
    logsHttpFailures: true,
  },
}
```

```bash
pnpm exec prettier --write lib/config/app-variant.ts test/unit/config/app-variant.test.ts test/unit/config/app-config.test.ts app.config.ts
pnpm exec vitest run test/unit/config
```

Expected: PASS(app-variant 15, app-config 7, settings 그대로).

- [ ] **Step 5: Accept-Language 조립과 실패 표식의 시험을 쓴다**

`test/unit/jsonapi/accept-language.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { MAX_ACCEPT_LANGUAGE_TAGS, acceptLanguageFromLocales } from '@/lib/jsonapi/accept-language'

describe('acceptLanguageFromLocales - 스펙 9.4', () => {
  it('기기 언어 목록의 순서대로 품질값을 낮춰 붙인다 - 앱별 언어 ko-KR 을 준 에뮬레이터의 모양', () => {
    // D1 실측 M3: 앱별 언어가 ko-KR 이면 getLocales() 가 ko-KR, en-US 순서다.
    expect(acceptLanguageFromLocales(['ko-KR', 'en-US'])).toBe('ko-KR,en-US;q=0.9')
  })

  it('하나면 품질값 없이 그대로다', () => {
    expect(acceptLanguageFromLocales(['en-US'])).toBe('en-US')
  })

  it('태그를 고치지 않는다 - 기본 하위 태그를 가려 읽는 것은 백엔드의 몫이다', () => {
    expect(acceptLanguageFromLocales(['zh-Hant-TW'])).toBe('zh-Hant-TW')
  })

  it('앞뒤 공백을 떼고, 대소문자만 다른 중복은 처음 것만 남긴다', () => {
    expect(acceptLanguageFromLocales([' ko-KR ', 'KO-kr', 'en'])).toBe('ko-KR,en;q=0.9')
  })

  it('형식에 맞지 않는 태그는 뺀다 - 헤더에 개행·쉼표·세미콜론이 들어가지 않는다', () => {
    expect(
      acceptLanguageFromLocales(['ko\nKR', 'en,US', 'ja;q=1', '', '   ', 'x'.repeat(9), 'fr-FR']),
    ).toBe('fr-FR')
  })

  it('쓸 태그가 없으면 null 이다 - 헤더를 싣지 않는다', () => {
    expect(acceptLanguageFromLocales([])).toBeNull()
    expect(acceptLanguageFromLocales(['', '@@'])).toBeNull()
  })

  it(`품질값이 0 이 되기 전 ${MAX_ACCEPT_LANGUAGE_TAGS}개까지만 싣는다`, () => {
    const tags = Array.from({ length: 12 }, (_, index) => `x${String.fromCharCode(97 + index)}`)
    const header = acceptLanguageFromLocales(tags) ?? ''
    const entries = header.split(',')
    expect(entries).toHaveLength(MAX_ACCEPT_LANGUAGE_TAGS)
    expect(entries.at(-1)).toBe('xj;q=0.1')
    expect(header).not.toContain('q=0.0')
  })

  it('품질값이 앞에서 뒤로 줄곧 줄어든다', () => {
    const header = acceptLanguageFromLocales(['aa', 'bb', 'cc', 'dd']) ?? ''
    const qualities = header.split(',').map((entry) => Number(entry.split(';q=')[1] ?? '1'))
    expect(qualities).toEqual([1, 0.9, 0.8, 0.7])
  })
})
```

`test/unit/jsonapi/failure-log.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { HTTP_FAILURE_MARKER, httpFailureLine } from '@/lib/jsonapi/failure-log'

describe('httpFailureLine - 스펙 11.3 의 가드가 읽는 한 줄', () => {
  it('표식 · 상태 · 메서드 · 경로 · 오류 코드 순서다', () => {
    expect(
      httpFailureLine('POST', '/api/v1/auth/register', 409, [
        { status: '409', code: 'EMAIL_ALREADY_REGISTERED' },
      ]),
    ).toBe('[e2e-http] 409 POST /api/v1/auth/register EMAIL_ALREADY_REGISTERED')
  })

  it('메서드를 대문자로 적는다', () => {
    expect(httpFailureLine('post', '/probe', 422, [{ code: 'VALIDATION_ERROR' }])).toBe(
      '[e2e-http] 422 POST /probe VALIDATION_ERROR',
    )
  })

  it('오류 코드가 여럿이면 쉼표로 잇고, 코드가 없는 오류는 - 로 적는다', () => {
    expect(
      httpFailureLine('POST', '/probe', 422, [
        { code: 'VALIDATION_ERROR' },
        {},
        { code: 'VALIDATION_ERROR' },
      ]),
    ).toBe('[e2e-http] 422 POST /probe VALIDATION_ERROR,-,VALIDATION_ERROR')
  })

  it('오류가 하나도 없으면 코드 자리에 - 를 적는다', () => {
    expect(httpFailureLine('GET', '/probe', 500, [])).toBe('[e2e-http] 500 GET /probe -')
  })

  it('백엔드에 닿지 못한 요청은 상태 0 이다', () => {
    expect(httpFailureLine('GET', '/health/ready', 0, [{ code: 'NETWORK_ERROR' }])).toBe(
      '[e2e-http] 0 GET /health/ready NETWORK_ERROR',
    )
  })

  it('문구·출처 같은 다른 필드는 적지 않는다 - 로그에 사용자 입력이 새지 않는다', () => {
    const line = httpFailureLine('POST', '/api/v1/auth/login', 401, [
      {
        code: 'INVALID_CREDENTIALS',
        title: 'probe-title-text',
        detail: 'probe-detail-text',
        source: { pointer: '/data/attributes/email' },
      },
    ])
    expect(line).not.toContain('probe-title-text')
    expect(line).not.toContain('probe-detail-text')
    expect(line).not.toContain('/data/attributes/email')
  })

  it('표식은 하네스(test/e2e/guard-log.sh)가 찾는 문자열이다', () => {
    expect(HTTP_FAILURE_MARKER).toBe('[e2e-http]')
  })
})
```

```bash
pnpm exec vitest run test/unit/jsonapi/accept-language.test.ts test/unit/jsonapi/failure-log.test.ts 2>&1 | tail -5
```

Expected: FAIL — 두 모듈이 없다.

- [ ] **Step 6: 두 판단을 쓰고 Metro 고정의 이유를 남긴다**

`lib/jsonapi/accept-language.ts`:

```ts
/**
 * 기기의 언어 목록으로 `Accept-Language` 값을 만든다 - 스펙 9.4.
 *
 * 입력은 expo-localization 의 `getLocales()` 가 주는 BCP 47 태그들이다(앞이 우선). 앞에서부터
 * 품질값을 1, 0.9, 0.8 … 로 낮춰 붙인다 - 세 백엔드 모두 품질값을 1순위, 등장 순서를 뒤 순위로
 * 삼아 기본 하위 태그로 ko·en 을 고른다(2026-09-30 확인: FastAPI `resolve_language`, NestJS
 * `language.ts`, Rails `jsonapi_errors.rb`). 태그를 고치지 않는다 - `ko-KR` 에서 `ko` 를 가려
 * 읽는 것은 백엔드의 몫이다.
 *
 * 형식에 맞지 않는 태그는 뺀다 - 헤더에 개행 같은 값이 들어가면 요청 조립이 실패한다(client.ts 의
 * REQUEST_ASSEMBLY_FAILED). 쓸 태그가 하나도 없으면 null 이다 - 헤더를 싣지 않는다.
 */

/** 품질값이 0 이 되기 전까지 - 1, 0.9 … 0.1 의 열 개. q=0 은 "받지 않는다"는 뜻이다(RFC 9110). */
export const MAX_ACCEPT_LANGUAGE_TAGS = 10

const LANGUAGE_TAG = /^[A-Za-z]{1,8}(?:-[A-Za-z0-9]{1,8})*$/

export function acceptLanguageFromLocales(tags: readonly string[]): string | null {
  const seen = new Set<string>()
  const chosen: string[] = []
  for (const raw of tags) {
    const tag = raw.trim()
    if (!LANGUAGE_TAG.test(tag)) continue
    const key = tag.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    chosen.push(tag)
    if (chosen.length === MAX_ACCEPT_LANGUAGE_TAGS) break
  }
  if (chosen.length === 0) return null
  return chosen
    .map((tag, index) => (index === 0 ? tag : `${tag};q=${((10 - index) / 10).toFixed(1)}`))
    .join(',')
}
```

`lib/jsonapi/failure-log.ts`:

```ts
import type { ErrorObject } from './document'

/**
 * e2e 변형의 API 클라이언트가 2xx 가 아닌 결과를 기기 로그에 남길 때의 한 줄 - 스펙 11.3 의 가드.
 *
 * E2E 하네스(test/e2e/guard-log.sh)가 기기 로그에서 이 표식을 찾아, 플로가 선언하지 않은 상태가
 * 나오면 실패로 만든다. 상태 0 은 백엔드가 응답하지 못한 것(client.ts 가 합성한 오류)이다.
 *
 * 경로와 오류 코드만 적는다 - 쿼리·본문·헤더·문구를 적지 않는다. 토큰과 자격증명이 로그에 남지
 * 않는다(스펙 7.1).
 */
export const HTTP_FAILURE_MARKER = '[e2e-http]'

export function httpFailureLine(
  method: string,
  path: string,
  status: number,
  errors: readonly ErrorObject[],
): string {
  const codes = errors.map((error) => error.code ?? '-').join(',')
  return `${HTTP_FAILURE_MARKER} ${status} ${method.toUpperCase()} ${path} ${codes === '' ? '-' : codes}`
}
```

`test/unit/deps/metro-pin.test.ts`:

```ts
import { realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * package.json 의 devDependencies 가 metro·metro-cache·metro-transform-worker 를 0.84.5 로 고정하는
 * 이유를 잰다 - pnpm-workspace.yaml 끝의 주석이 그 이유를 적는다.
 *
 * uniwind/metro 는 metro 의 Graph 프로토타입을 덮어쓰고 metro-cache 의 FileStore 를 상속한다
 * (docs/superpowers/notes/2026-09-30-d1-measurements.md 의 M1 절). 그 모듈이 Expo 의 번들러
 * (@expo/metro)가 쓰는 것과 **같은 인스턴스**여야 덮어쓰기가 번들에 닿는다. pnpm peers check 는
 * 버전 범위만 보고 이 동일성은 보지 않는다.
 */
const rootRequire = createRequire(resolve('package.json'))

function resolvedFrom(owner: string, dependency: string): string {
  const ownerRequire = createRequire(rootRequire.resolve(`${owner}/package.json`))
  return realpathSync(ownerRequire.resolve(`${dependency}/package.json`))
}

describe('Metro 고정', () => {
  it.each(['metro', 'metro-cache', 'metro-transform-worker'])(
    'uniwind 와 @expo/metro 가 같은 %s 를 쓴다',
    (dependency) => {
      expect(resolvedFrom('uniwind', dependency)).toBe(resolvedFrom('@expo/metro', dependency))
    },
  )
})
```

`pnpm-workspace.yaml` 끝에 더한다:

```yaml

# package.json 의 devDependencies 가 metro·metro-cache·metro-transform-worker 를 0.84.5 로 고정한다.
# Expo 의 번들러(@expo/metro)가 metro 계열을 0.84.5 로 고정해 두었고, uniwind/metro 는 그 metro 의
# Graph 프로토타입을 덮어쓰고 metro-cache 의 FileStore 를 상속한다 - 둘이 같은 인스턴스여야 한다
# (docs/superpowers/notes/2026-09-30-d1-measurements.md 의 M1 절). 고정을 빼면 react-native 의 CLI 가
# 끌어온 0.84.6 이 최상위에 호이스팅될 수 있다. pnpm peers check 는 이 동일성을 보지 않으므로
# test/unit/deps/metro-pin.test.ts 가 잰다.
```

시험이 두 복사본을 가를 수 있는지 한 번 본다(커밋하지 않는다) — react-native CLI의 metro는 다른 파일이어야 한다:

```bash
node -e 'const {createRequire}=require("node:module");const {realpathSync}=require("node:fs");const r=createRequire(process.cwd()+"/package.json");const f=(o,t)=>realpathSync(createRequire(r.resolve(o+"/package.json")).resolve(t+"/package.json"));console.log(f("uniwind","metro")===f("@react-native/community-cli-plugin","metro"))'
pnpm exec vitest run test/unit/jsonapi/accept-language.test.ts test/unit/jsonapi/failure-log.test.ts test/unit/deps/metro-pin.test.ts
```

Expected: `false`(가를 수 있다), 그리고 PASS — accept-language 8 · failure-log 7 · metro-pin 3.

- [ ] **Step 7: 시작 설정의 판단을 `lib/config`로 옮기고 platform 바인딩을 쓴다**

D1의 `platform/config.ts`에서 extra 좁히기와 오류 → 문구 변환은 단위 시험이 없는 유일한 판단이었다(D1 운반, 결정 28). 판단을 `lib/config/startup.ts`로 옮겨 실패 경로를 시험하고, `platform/config.ts`는 `expo-constants`와 설정 자리 바인딩만 남긴다.

`test/unit/config/startup.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'

import { APP_VARIANTS } from '@/lib/config/app-variant'
import { getSettings, setSettingsSource } from '@/lib/config/settings'
import {
  checkStartupSettings,
  settingsEnvFromExtra,
  variantFromExtra,
  type StartupSettings,
} from '@/lib/config/startup'

/**
 * 앱 시작 설정(스펙 10.1). platform/config.ts 의 loadStartupSettings() 는 expo-constants 의
 * extra 로 아래 startWith() 와 같은 두 줄을 부른다 - 자리를 extra 로 돌리고 검증한다. 실패 갈래는
 * 루트 레이아웃이 치명 오류 화면(FatalConfig)으로 그린다.
 */
function startWith(extra: unknown): StartupSettings {
  setSettingsSource(() => settingsEnvFromExtra(extra))
  return checkStartupSettings(getSettings)
}

afterEach(() => {
  // 이 파일의 시험이 자리를 바꿨다 - 다음 시험은 기본 자리(process.env)에서 시작한다.
  setSettingsSource(() => process.env)
  vi.unstubAllEnvs()
})

describe('앱 시작 설정 - 스펙 10.1', () => {
  it('extra.backendUrl 이 절대 URL 이면 통과하고 끝 슬래시를 뗀다', () => {
    expect(startWith({ backendUrl: 'https://probe-backend.example/' })).toEqual({
      ok: true,
      settings: { backendUrl: 'https://probe-backend.example' },
    })
  })

  it.each([
    ['빈 extra', {}],
    ['extra 없음', undefined],
    ['null', null],
    ['문자열이 아닌 backendUrl', { backendUrl: 42 }],
  ])('%s 이면 던지지 않고 BACKEND_URL 이 없다는 문구로 실패한다', (_label, extra) => {
    expect(startWith(extra)).toEqual({ ok: false, message: 'BACKEND_URL is required' })
  })

  it('상대 경로면 절대 URL 이 아니라는 문구로 실패한다', () => {
    expect(startWith({ backendUrl: '/api' })).toEqual({
      ok: false,
      message: 'BACKEND_URL must be an absolute URL (got "/api")',
    })
  })

  it('다시 부르면 새 extra 로 다시 검증한다 - 앞의 결과가 캐시에 남지 않는다', () => {
    expect(startWith({}).ok).toBe(false)
    expect(startWith({ backendUrl: 'https://probe-backend.example' }).ok).toBe(true)
    expect(startWith({}).ok).toBe(false)
  })

  it('실패한 뒤의 getSettings() 도 extra 를 읽는다 - process.env 의 값으로 돌아가지 않는다', () => {
    vi.stubEnv('BACKEND_URL', 'https://probe-env.example')
    expect(startWith({}).ok).toBe(false)
    expect(() => getSettings()).toThrowError('BACKEND_URL is required')
  })

  it('Error 가 아닌 값이 던져져도 문구로 바꾼다', () => {
    const thrown: unknown = 'probe failure'
    expect(
      checkStartupSettings(() => {
        throw thrown
      }),
    ).toEqual({ ok: false, message: 'probe failure' })
  })
})

describe('빌드 변형 - 스펙 10.2', () => {
  it.each(APP_VARIANTS)('extra.appVariant 의 %s 를 돌려준다', (variant) => {
    expect(variantFromExtra({ appVariant: variant })).toBe(variant)
  })

  it.each([
    ['extra 없음', undefined],
    ['문자열이 아닌 값', { appVariant: 1 }],
  ])('%s 이면 기본값 development 다', (_label, extra) => {
    expect(variantFromExtra(extra)).toBe('development')
  })
})
```

```bash
pnpm exec vitest run test/unit/config/startup.test.ts 2>&1 | tail -5
```

Expected: FAIL — `@/lib/config/startup`이 없다.

`lib/config/startup.ts`:

```ts
/**
 * 앱 시작 설정의 판단 - 스펙 10.1·10.2.
 *
 * 빌드가 app.config.ts 의 extra 에 실은 값(backendUrl·appVariant)을 앱이 읽는 모양으로 바꾸고,
 * 시작 검증의 실패를 던지지 않는 결과로 바꾼다. extra 의 모양은 런타임에 모른다 - OTA 로 들어온
 * 설정도 여기를 지난다 - 그래서 문자열이 아닌 값은 없는 것으로 본다.
 *
 * 부르는 곳은 platform/config.ts 하나다. 설정 자리를 바꾸는 바인딩(setSettingsSource)과
 * expo-constants 호출은 거기 있다(루트 AGENTS.md 의 계층 표). app.config.ts 가 이 디렉터리를 직접
 * 실행하므로 import 에는 `.ts` 확장자를 붙인다(lib/config/AGENTS.md).
 */
import { parseAppVariant, type AppVariant } from './app-variant.ts'
import type { Settings, SettingsEnv } from './settings.ts'

/** 시작 검증의 결과. 실패하면 루트 레이아웃이 message 를 치명 오류 화면에 그린다. */
export type StartupSettings = { ok: true; settings: Settings } | { ok: false; message: string }

function extraString(extra: unknown, key: string): string | undefined {
  if (typeof extra !== 'object' || extra === null) return undefined
  const value = (extra as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : undefined
}

/** extra 를 설정 자리의 모양(settings.ts 의 SettingsEnv)으로 바꾼다. */
export function settingsEnvFromExtra(extra: unknown): SettingsEnv {
  return { BACKEND_URL: extraString(extra, 'backendUrl') }
}

/** 설정을 읽어 검증한다. 던지면 그 message 를 담은 실패로 돌려준다 - 앱을 죽이지 않는다. */
export function checkStartupSettings(load: () => Settings): StartupSettings {
  try {
    return { ok: true, settings: load() }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * 빌드가 extra.appVariant 에 실은 변형. 값이 없으면 기본값이고, 목록 밖의 값은 던진다 -
 * app.config.ts 가 빌드 시점에 이미 거절한 값이라 앱에 올 수 없다.
 */
export function variantFromExtra(extra: unknown): AppVariant {
  return parseAppVariant(extraString(extra, 'appVariant'))
}
```

`platform/config.ts` 전체를 바꾼다(머리 주석이 타입 별칭이 아니라 함수에 붙는다 — D1 운반):

```ts
import Constants from 'expo-constants'

import type { AppVariant } from '@/lib/config/app-variant'
import { getSettings, setSettingsSource } from '@/lib/config/settings'
import {
  checkStartupSettings,
  settingsEnvFromExtra,
  variantFromExtra,
  type StartupSettings,
} from '@/lib/config/startup'

/**
 * 설정의 자리를 app.config.ts 의 extra 로 돌리고, 시작할 때 한 번 검증한다(스펙 10.1).
 *
 * 값은 빌드 시점에 이미 검증됐지만 OTA 로 들어온 설정까지 대비해 다시 본다. 실패하면 던지지
 * 않고 결과로 돌려준다 - 루트 레이아웃이 그것을 치명 오류 화면으로 그린다. 판단(extra 읽기,
 * 오류 → 문구)은 lib/config/startup.ts 에 있다.
 *
 * 루트 레이아웃이 모듈 평가 시점에 한 번 부른다. 그보다 먼저 getSettings() 를 부르는 코드는 기본
 * 자리(process.env)를 읽어 던진다 - 그래서 어떤 모듈도 최상위에서 getSettings() 를 부르지 않는다
 * (platform/AGENTS.md).
 */
export function loadStartupSettings(): StartupSettings {
  setSettingsSource(() => settingsEnvFromExtra(Constants.expoConfig?.extra))
  return checkStartupSettings(getSettings)
}

/** 빌드가 extra.appVariant 로 실은 변형(스펙 10.2). 값은 app.config.ts 가 빌드 시점에 검증했다. */
export function startupVariant(): AppVariant {
  return variantFromExtra(Constants.expoConfig?.extra)
}
```

```bash
pnpm exec prettier --write lib/config/startup.ts test/unit/config/startup.test.ts platform/config.ts
pnpm exec vitest run test/unit/config
```

Expected: PASS — startup 15(설정 9·변형 6), app-variant·app-config·settings 그대로.

`platform/api.ts`:

```ts
import { getLocales } from 'expo-localization'

import { variantProfile } from '@/lib/config/app-variant'
import { acceptLanguageFromLocales } from '@/lib/jsonapi/accept-language'
import {
  request,
  withAcceptLanguage,
  type JsonApiResult,
  type RequestOptions,
} from '@/lib/jsonapi/client'
import { httpFailureLine } from '@/lib/jsonapi/failure-log'
import type { JsonApiSend } from '@/lib/jsonapi/send'
import { startupVariant } from '@/platform/config'

/**
 * 앱의 API 클라이언트 - 모든 백엔드 요청이 이 함수를 지난다(스펙 8.4·9.4).
 *
 * Accept-Language 를 싣는 자리가 **여기 하나**다. 값은 요청마다 기기의 언어 목록(getLocales)에서
 * 만든다 - 앱이 켜진 채 언어를 바꿔도 다음 요청이 따른다. 조립 규칙은
 * lib/jsonapi/accept-language.ts 가 갖는다.
 *
 * e2e 변형은 2xx 가 아닌 결과를 표식과 함께 기기 로그에 남긴다 - E2E 하네스가 플로가 선언하지
 * 않은 4xx·5xx 를 실패로 만드는 재료다(스펙 11.3). 어느 변형이 남기는지는 변형 표가 정한다.
 */
export const apiRequest: JsonApiSend = async <T>(
  path: string,
  options: RequestOptions = {},
): Promise<JsonApiResult<T>> => {
  const tags = getLocales().map((locale) => locale.languageTag)
  const result = await request<T>(path, withAcceptLanguage(options, acceptLanguageFromLocales(tags)))
  if (!result.ok && variantProfile(startupVariant()).logsHttpFailures) {
    console.info(httpFailureLine(options.method ?? 'GET', path, result.status, result.errors))
  }
  return result
}
```

`platform/secure-session-storage.ts`:

```ts
import * as SecureStore from 'expo-secure-store'

import { SESSION_STORAGE_KEY, type SessionStorage } from '@/lib/auth/session-store'

/**
 * 세션 항목의 저장 매체 - 기기 보안 저장소(스펙 7.1).
 *
 * iOS 키체인 보관 등급은 AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY 다 - 다른 기기로 옮겨지지 않는다.
 * Android 는 이 옵션을 쓰지 않는다. Android 자동 백업에서 빠지는 것은 app.config.ts 의
 * expo-secure-store 플러그인(configureAndroidBackup)이 맡는다.
 */
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
}

export const secureSessionStorage: SessionStorage = {
  read: () => SecureStore.getItemAsync(SESSION_STORAGE_KEY, OPTIONS),
  write: (value) => SecureStore.setItemAsync(SESSION_STORAGE_KEY, value, OPTIONS),
  clear: () => SecureStore.deleteItemAsync(SESSION_STORAGE_KEY, OPTIONS),
}
```

`platform/session.ts`:

```ts
import { useSyncExternalStore } from 'react'

import { createSessionManager, type SessionStatus } from '@/lib/auth/session-manager'
import { apiRequest } from '@/platform/api'
import { secureSessionStorage } from '@/platform/secure-session-storage'

/**
 * 앱의 세션 관리자 하나(스펙 7.2) - 회전·저장·로그아웃이 전부 이 인스턴스를 지난다. 판단은
 * lib/auth/session-manager.ts 에 있고, 여기서는 저장 매체(SecureStore)·API 클라이언트·시계를
 * 꽂는다.
 *
 * 하나뿐이라 Context 로 내려보낼 값이 없다 - 화면은 useSessionStatus() 로 상태를 읽는다.
 */
export const sessionManager = createSessionManager({
  storage: secureSessionStorage,
  send: apiRequest,
  now: () => Date.now(),
})

/** 세션 상태(restoring · signedIn · signedOut)를 React 에 잇는다. */
export function useSessionStatus(): SessionStatus {
  return useSyncExternalStore(sessionManager.subscribe, sessionManager.status)
}
```

`platform/query-client.ts`:

```ts
import { QueryClient } from '@tanstack/react-query'

/**
 * 앱의 Query 캐시 하나(스펙 8.5). 조회·쓰기 모두 자동 재시도를 끈다 - 백엔드 클라이언트
 * (client.ts)가 재시도하지 않는 것과 같은 태도이고, 재시도가 회전 중인 refresh 를 다시 내밀지
 * 않게 한다(스펙 7.2). staleTime 0 은 기본값이지만 스펙 8.5 의 값이라 적어 둔다.
 *
 * 앱 복귀·네트워크 복귀 때의 재조회(focusManager·onlineManager)는 조회 화면과 함께 붙인다.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 0, retry: false },
    mutations: { retry: false },
  },
})
```

- [ ] **Step 8: 앱 시작에 복원과 스플래시 유지를 배선한다**

`app/_layout.tsx` 전체를 바꾼다:

```tsx
import '@/global.css'

import { PortalHost } from '@rn-primitives/portal'
import { QueryClientProvider } from '@tanstack/react-query'
import { Stack, ThemeProvider } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { useUniwind } from 'uniwind'

import { FatalConfig } from '@/components/app/fatal-config'
import { loadStartupSettings } from '@/platform/config'
import { queryClient } from '@/platform/query-client'
import { sessionManager, useSessionStatus } from '@/platform/session'
import { NAV_THEME } from '@/platform/theme'

export { ErrorBoundary } from 'expo-router'

// 모듈 평가 시점에 한 번 - 어떤 요청보다 먼저 설정 자리를 extra 로 돌린다.
const STARTUP = loadStartupSettings()

// 설정이 맞을 때만 저장된 세션을 읽기 시작하고, 읽는 동안 스플래시를 유지한다(스펙 7.1). 컴포넌트
// 안에서 부르면 스플래시가 이미 내려간 뒤일 수 있어(expo-splash-screen 의 안내) 모듈 평가 시점에
// 부른다. 설정이 틀리면 스플래시를 잡지 않는다 - 치명 오류 화면이 곧바로 보인다. 복원은 던지지
// 않는다(lib/auth/session-manager.ts).
if (STARTUP.ok) {
  void SplashScreen.preventAutoHideAsync()
  void sessionManager.restore()
}

export default function RootLayout() {
  const { theme } = useUniwind()
  const scheme = theme === 'dark' ? 'dark' : 'light'

  if (!STARTUP.ok) {
    return (
      <ThemeProvider value={NAV_THEME[scheme]}>
        <FatalConfig message={STARTUP.message} />
      </ThemeProvider>
    )
  }

  return <AppRoot scheme={scheme} />
}

/**
 * 설정이 맞을 때만 그리는 자식. 세션·Query 처럼 요청으로 이어지는 훅은 여기 둔다 - 루트에 두면
 * 설정 오류(request() 가 던진다)가 ErrorBoundary 로 가서 치명 오류 화면을 가린다(platform/AGENTS.md).
 */
function AppRoot({ scheme }: { scheme: 'light' | 'dark' }) {
  const ready = useSessionStatus() !== 'restoring'

  useEffect(() => {
    if (ready) SplashScreen.hide()
  }, [ready])

  // 복원이 끝날 때까지 아무것도 그리지 않는다 - 스플래시가 덮고 있다. 로그인 여부를 모른 채
  // 그리면 헤더와 경로 가드가 한 번 틀린 상태로 그려진다.
  if (!ready) return null

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={NAV_THEME[scheme]}>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <Stack />
        <PortalHost />
      </ThemeProvider>
    </QueryClientProvider>
  )
}
```

- [ ] **Step 9: 문서와 스펙 정정을 쓴다**

`platform/AGENTS.md`:

````markdown
# platform/ 작업 지침

Expo·React Native 모듈을 부르고 React 에 잇는 자리다(스펙 5장). 판단을 두지 않는다 - 분기가
자라면 `lib/`로 옮기고 여기서는 부르기만 한다.

| 파일 | 역할 |
| --- | --- |
| `config.ts` | 설정 자리를 `app.config.ts`의 `extra`로 돌리고 시작할 때 검증한다. 빌드 변형을 읽는다. 판단은 `lib/config/startup.ts` |
| `api.ts` | 앱의 API 클라이언트 `apiRequest`. Accept-Language 를 싣는 유일한 자리(스펙 9.4), e2e 변형의 실패 표식 |
| `secure-session-storage.ts` | 세션 항목의 SecureStore 저장 매체 |
| `session.ts` | 세션 관리자 `sessionManager` 하나와 상태 훅 `useSessionStatus()` |
| `query-client.ts` | Query 캐시 `queryClient` 하나와 기본 옵션(스펙 8.5) |
| `theme.ts` | 내비게이션 테마 |

- 백엔드 요청은 전부 `apiRequest`를 지난다. `lib/jsonapi/client.ts`의 `request()`를 다른 곳에서
  직접 부르지 않는다.
- 세션 관리자는 `sessionManager` 하나다. 회전은 그 안에서만 일어난다(`lib/auth/AGENTS.md`).

## 부팅 순서

- `getSettings()`는 요청할 때만 부른다. 어떤 모듈도 최상위에서 부르지 않는다 - 루트 레이아웃이
  `loadStartupSettings()`로 설정 자리를 `extra`로 돌리기 전에 불리면 기본 자리(`process.env`)를 읽어
  던지고, 치명 오류 화면(`FatalConfig`) 대신 앱이 죽는다. 앱 런타임의 `process.env`에는
  `BACKEND_URL`이 없다.
- 요청으로 이어질 수 있는 훅(세션·Query, 앞으로의 AppState·NetInfo)은 루트 레이아웃의 `STARTUP.ok`
  갈래 안의 자식(`AppRoot`)에 둔다. 루트에 두면 설정이 틀린 앱에서 `request()`가 던지는 설정 오류가
  ErrorBoundary로 가서 치명 오류 화면을 가린다. 세션 복원과 스플래시 붙잡기도 `STARTUP.ok`일 때만
  시작한다.
````

`lib/jsonapi/AGENTS.md`의 "이 저장소가 더한 것" 표에 두 줄을 더한다:

```markdown
| `accept-language.ts` | 기기 언어 목록 → `Accept-Language` 값. 품질값을 앞에서부터 낮춘다(스펙 9.4) |
| `failure-log.ts` | e2e 변형이 기기 로그에 남기는 실패 한 줄(`[e2e-http] …`). E2E 가드가 읽는다(스펙 11.3) |
```

스펙 4장 끝(`## 5. 계층 소유권` 바로 앞 — D1의 `components/app/` 정정 다음)에 더한다:

```markdown

> 정정(2026-09-30, D2): 루트 `_layout.tsx` 의 "세션 Provider" 는 Context Provider 가 아니다. 회전이 한
> 곳에서 일어나야 해서(7.2) 세션 관리자는 `platform/session.ts` 에 하나뿐이고, Context 로 내려보낼 값이
> 없다. 화면은 `useSessionStatus()`(`useSyncExternalStore`)로 상태를 읽는다. 루트 레이아웃은 설정 검증이
> 통과했을 때만 모듈 평가 시점에 `sessionManager.restore()` 를 부르고 복원이 끝날 때까지 스플래시를
> 유지하며, 그 갈래의 자식을 `QueryClientProvider` 로 감싼다. 시작 설정의 판단은 `lib/config/startup.ts`
> 에 있다(`platform/config.ts` 는 `expo-constants` 와 설정 자리 바인딩만 한다).
```

`lib/config/AGENTS.md` — Edit, 찾을 것:

```markdown
`docs/provenance/copied-core.json`의 `divergences`에 `what`·`why`를 더한다. `app-variant.ts`는 이
저장소의 새 파일이다.
```

바꿀 것:

```markdown
`docs/provenance/copied-core.json`의 `divergences`에 `what`·`why`를 더한다. `app-variant.ts`와
`startup.ts`는 이 저장소의 새 파일이다. `startup.ts`는 앱 시작 설정의 판단(extra 읽기, 검증 실패 →
문구)이고 `platform/config.ts`가 부른다 - 설정 자리를 바꾸는 바인딩(`setSettingsSource` 호출)은 이
디렉터리가 아니라 거기 있다.
```

- [ ] **Step 10: 정적 검사와 번들을 돌린다**

```bash
pnpm format
BACKEND_URL=https://gate-check.invalid pnpm types:routes
pnpm typecheck && pnpm lint && pnpm format:check && pnpm lint:secrets
./scripts/check-citations.sh app components lib platform test
node scripts/check-provenance.mjs
pnpm test 2>&1 | tail -5
for v in development preview production e2e; do APP_VARIANT=$v BACKEND_URL=https://gate-check.invalid pnpm exec expo config --type public --json >/dev/null && echo "config $v ok"; done
BACKEND_URL=https://gate-check.invalid pnpm exec expo-doctor
APP_VARIANT=production BACKEND_URL=https://gate-check.invalid pnpm exec expo export --clear --platform android --platform ios --output-dir dist 2>&1 | tail -8
```

Expected: 전부 exit 0. `config … ok` 넷 — `lib/config/app-variant.ts`는 `app.config.ts`가 Node의 type stripping으로 직접 실행하는 파일이라(`lib/config/AGENTS.md`), 더한 인터페이스 멤버와 값이 그대로 도는지 여기서 확인된다. expo-doctor는 모든 검사 통과. 번들에 `Unable to resolve module`이 없다(루트 레이아웃이 `platform/session` → `api` → `expo-localization`·`expo-secure-store`까지, `platform/config` → `lib/config/startup.ts` → `./app-variant.ts`까지 끌어온다 — `.ts` 확장자 import를 Metro가 푸는지도 여기서 확인된다). `expo export`는 `--clear`다(Global Constraints) — 이 저장소의 `expo start`를 끄고 돌린다.

- [ ] **Step 11: 커밋한다**

```bash
git add package.json pnpm-lock.yaml pnpm-workspace.yaml app.config.ts app/_layout.tsx lib/config lib/jsonapi platform test/unit docs/superpowers/specs
git status --short
git commit -m "feat: 시작 설정 판단을 lib/config 로 옮기고 API 클라이언트·SecureStore·세션 복원을 platform 에 배선한다"
```

---

### Task 5: 가입·로그인·로그아웃 화면과 경로 가드

**Files:**
- Create: `components/ui/input.tsx`, `components/form/field-error.tsx`, `components/form/form-banner.tsx`, `components/form/submit-button.tsx`, `components/form/credentials-form.tsx`, `components/app/logout-button.tsx`, `queries/auth.ts`, `queries/AGENTS.md`, `app/(app)/_layout.tsx`, `app/(app)/examples/new.tsx`, `app/(auth)/login.tsx`, `app/(auth)/register.tsx`
- Modify: `app/(app)/index.tsx`, `app/_layout.tsx`, `scripts/check.sh`, `test/unit/scripts/check-citations.test.ts`, `docs/provenance/copied-core.json`, `AGENTS.md`

**Interfaces:**
- Consumes: Task 2의 `signIn`·`signUpThenSignIn`·`Credentials`, `decideAfterLogin`·`decideAfterRegistration`·`SignInPlan`·`authLinkHref`, `IDLE_AUTH_FORM_STATE`·`unusableResponseState`·`AuthFormState`·`EMAIL_FIELD`·`PASSWORD_FIELD`, `POST_LOGOUT_PATH`·`LogoutOutcome`, `isProtectedPath`·`loginHref`·`LOGIN_REDIRECT_PARAM`; Task 4의 `apiRequest`, `sessionManager`·`useSessionStatus`
- Produces:
  - `queries/auth.ts`: `useLoginMutation(rawNext: unknown)`, `useRegisterMutation(rawNext: unknown)` — `mutate(credentials)`의 결과는 `SignInPlan`(establish면 세션을 이미 세웠다); `useLogoutMutation(onSettled: () => void)` — `mutate()`
  - 화면 testID(Task 6의 플로가 찾는다): `home-screen`, `logout-button`, `login-screen`, `register-screen`, `email-input`, `password-input`, `submit-button`, `email-error`, `password-error`, `form-banner`, `form-banner-message`, `new-example-screen`, `register-link`, `login-link`, `account-created-notice`
  - 딥링크 경로: `/login`, `/register`, `/examples/new`(보호)

- [ ] **Step 1: 인용 검사 대상에 `queries`를 더하는 시험을 먼저 고친다**

```bash
F=test/unit/scripts/check-citations.test.ts
sed -i "s/const GATE_TARGETS = \['app', 'components', 'lib', 'platform', 'test'\] as const/const GATE_TARGETS = ['app', 'components', 'lib', 'platform', 'queries', 'test'] as const/" "$F"
sed -i 's/다섯/여섯/g' "$F"
grep -n "GATE_TARGETS = \|여섯" "$F"
pnpm exec vitest run "$F" 2>&1 | tail -8
```

Expected: `GATE_TARGETS`에 `queries`가 있고 "여섯"이 네 자리. 시험은 FAIL — `check.sh`가 아직 `queries`를 넘기지 않고 `queries/`가 아직 없다.

- [ ] **Step 2: 입력 컴포넌트를 받는다**

```bash
BACKEND_URL=https://gate-check.invalid pnpm dlx @react-native-reusables/cli@0.7.1 add input --styling-library uniwind --yes
git status --short
```

Expected: `components/ui/input.tsx` 하나가 생긴다(`package.json`·`lib/utils.ts`는 그대로). 받은 파일을 다음과 대조하고, **원본과 다른 한 곳** — `placeholderClassName`을 구조 분해하는 것 — 만 고친다. 그 prop은 NativeWind의 것이라 Uniwind의 `TextInputProps`에 없어 typecheck가 실패한다(`node_modules/uniwind/types.d.ts`). 나머지(클래스, `Platform.select`의 web 갈래)는 받은 그대로 둔다. 고친 뒤의 모양:

```tsx
import { cn } from '@/lib/utils'
import { Platform, TextInput } from 'react-native'

// 원본과 다른 한 곳: 원본은 placeholderClassName 을 구조 분해해 버린다. 그 prop 은 NativeWind 의 것이라
// Uniwind 의 TextInputProps(uniwind/types.d.ts)에 없어 타입 검사가 실패한다 - 받지 않는다.
function Input({
  className,
  ...props
}: React.ComponentProps<typeof TextInput> & React.RefAttributes<TextInput>) {
  return (
    <TextInput
      className={cn(
        'dark:bg-input/30 border-input bg-background text-foreground flex h-10 w-full min-w-0 flex-row items-center rounded-md border px-3 py-1 text-base leading-5 shadow-sm shadow-black/5 sm:h-9',
        props.editable === false &&
          cn(
            'opacity-50',
            Platform.select({ web: 'disabled:pointer-events-none disabled:cursor-not-allowed' }),
          ),
        Platform.select({
          web: cn(
            'placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground outline-none transition-[color,box-shadow] md:text-sm',
            'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
            'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
          ),
          native: 'placeholder:text-muted-foreground/50',
        }),
        className,
      )}
      {...props}
    />
  )
}

export { Input }
```

CLI가 받은 파일이 위와 클래스 문자열까지 다르면(레지스트리가 바뀌었으면) 받은 것을 두고 `placeholderClassName`만 고친다. `sm:` 클래스는 R18(D3가 정한다)에 따라 그대로 둔다.

- [ ] **Step 3: 폼 조각을 쓴다**

`components/form/field-error.tsx`:

```tsx
import { View } from 'react-native'

import { Text } from '@/components/ui/text'

/**
 * 입력 하나 아래 그리는 필드 오류 - 스펙 9.1 의 두 갈래 중 "필드" 쪽.
 *
 * 배열을 받는다. 백엔드는 검증 오류를 한 응답에 여러 개 실어 보내고 groupErrors 는 필드별 문구
 * 배열을 돌려준다 - 첫 원소만 그리면 나머지가 소리 없이 사라진다. 문구를 만들지 않는다 - 백엔드가
 * Accept-Language 로 협상한 문구를 그대로 받는다(스펙 9.3).
 *
 * testID 는 문구 Text 마다 단다 - 감싼 View 는 배경이 없어 네이티브 트리에서 납작해질 수 있다.
 */
export function FieldError({ testID, messages }: { testID: string; messages: readonly string[] }) {
  if (messages.length === 0) return null

  return (
    <View className="mt-1.5 gap-0.5">
      {messages.map((message, index) => (
        // 같은 문구가 두 번 올 수 있어 인덱스를 키에 섞는다.
        <Text key={`${index}-${message}`} testID={testID} className="text-sm text-destructive">
          {message}
        </Text>
      ))}
    </View>
  )
}
```

`components/form/form-banner.tsx`:

```tsx
import { View } from 'react-native'

import { Text } from '@/components/ui/text'

/**
 * 폼 위 배너 - 스펙 9.1 의 두 갈래 중 "문서 오류" 쪽. 어떤 오류가 여기로 오는지는
 * lib/auth/flow.ts 의 authFormStateFromErrors 가 정한다(예: source 가 없는 401
 * INVALID_CREDENTIALS · 409 EMAIL_ALREADY_REGISTERED). role="alert" 는 제출 뒤 새로 나타나는
 * 배너를 스크린 리더가 읽게 한다.
 */
export function FormBanner({ messages }: { messages: readonly string[] }) {
  if (messages.length === 0) return null

  return (
    <View
      testID="form-banner"
      role="alert"
      className="gap-1 rounded-lg border border-destructive/40 bg-destructive/10 p-3"
    >
      {messages.map((message, index) => (
        <Text
          key={`${index}-${message}`}
          testID="form-banner-message"
          className="text-sm text-destructive"
        >
          {message}
        </Text>
      ))}
    </View>
  )
}
```

`components/form/submit-button.tsx`:

```tsx
import { ActivityIndicator } from 'react-native'

import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'

/**
 * 폼 제출 버튼 - 제출 중에는 라벨 대신 스피너만 그린다(스펙 8.7, 로딩 상태에 텍스트를 쓰지
 * 않는다). 스피너로 바뀌어도 접근 가능한 이름은 라벨 그대로다(accessibilityLabel).
 *
 * 스피너가 ActivityIndicator 인 이유: Uniwind 1.12 에는 animate-spin 같은 CSS 애니메이션이 없어
 * 아이콘(Loader2)은 돌지 않는다.
 */
export function SubmitButton({
  testID,
  label,
  pending,
  onPress,
}: {
  testID: string
  label: string
  pending: boolean
  onPress: () => void
}) {
  return (
    <Button
      testID={testID}
      accessibilityLabel={label}
      aria-busy={pending}
      disabled={pending}
      onPress={onPress}
    >
      {pending ? (
        <ActivityIndicator colorClassName="accent-primary-foreground" />
      ) : (
        <Text>{label}</Text>
      )}
    </Button>
  )
}
```

`components/form/credentials-form.tsx`:

```tsx
import { useState, type ReactNode } from 'react'
import { ScrollView, View } from 'react-native'

import { FieldError } from '@/components/form/field-error'
import { FormBanner } from '@/components/form/form-banner'
import { SubmitButton } from '@/components/form/submit-button'
import { Input } from '@/components/ui/input'
import { Text } from '@/components/ui/text'
import type { Credentials } from '@/lib/auth/credentials'
import { EMAIL_FIELD, PASSWORD_FIELD, type AuthFormState } from '@/lib/auth/form-state'
import { cn } from '@/lib/utils'

interface CredentialsFormProps {
  /** 화면 전체의 testID(login-screen · register-screen) - E2E 플로가 찾는다. */
  testID: string
  heading: string
  submitLabel: string
  /** 로그인은 current-password, 가입은 new-password - 비밀번호 관리자에게 주는 힌트다. */
  passwordAutoComplete: 'current-password' | 'new-password'
  state: AuthFormState
  pending: boolean
  onSubmit: (credentials: Credentials) => void
  footer: ReactNode
  /** 가입에서만 쓴다 - 계정은 만들어졌는데 이어지는 로그인이 실패했을 때의 안내. */
  notice?: ReactNode
}

/**
 * 가입과 로그인이 함께 쓰는 자격증명 폼. 백엔드가 두 엔드포인트에 같은 attributes 스키마를 쓴다
 * (lib/auth/credentials.ts 머리말) - 두 화면이 갈라지는 날은 그 스키마가 갈라지는 날이다.
 *
 * 오류의 자리는 이 컴포넌트가 정하지 않는다 - `state` 가 이미 나눠 온다(lib/auth/flow.ts 의
 * authFormStateFromErrors, 스펙 9.1). 입력 값은 오류가 나도 지우지 않는다. 입력 검증은 백엔드가
 * 한다 - 여기서 빈 칸이나 길이를 막으면 백엔드 규칙이 반쪽만 복제된다.
 *
 * 키보드가 떠 있어도 제출 버튼이 한 번에 눌리게 keyboardShouldPersistTaps 를 준다.
 * testID 는 E2E 플로(test/e2e/)가 찾는 이름이다 - 바꾸면 플로도 함께 바꾼다.
 */
export function CredentialsForm({
  testID,
  heading,
  submitLabel,
  passwordAutoComplete,
  state,
  pending,
  onSubmit,
  footer,
  notice,
}: CredentialsFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const emailErrors = state.fieldErrors[EMAIL_FIELD] ?? []
  const passwordErrors = state.fieldErrors[PASSWORD_FIELD] ?? []

  return (
    <ScrollView
      testID={testID}
      className="flex-1 bg-background"
      contentContainerClassName="gap-5 p-6"
      keyboardShouldPersistTaps="handled"
    >
      <Text variant="h3">{heading}</Text>
      {notice}
      <FormBanner messages={state.documentErrors} />

      <View className="gap-1.5">
        <Text className="text-sm font-medium">이메일</Text>
        <Input
          testID="email-input"
          accessibilityLabel="이메일"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          className={cn(emailErrors.length > 0 && 'border-destructive')}
        />
        <FieldError testID="email-error" messages={emailErrors} />
      </View>

      <View className="gap-1.5">
        <Text className="text-sm font-medium">비밀번호</Text>
        <Input
          testID="password-input"
          accessibilityLabel="비밀번호"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={passwordAutoComplete}
          textContentType={passwordAutoComplete === 'new-password' ? 'newPassword' : 'password'}
          className={cn(passwordErrors.length > 0 && 'border-destructive')}
        />
        <FieldError testID="password-error" messages={passwordErrors} />
      </View>

      <SubmitButton
        testID="submit-button"
        label={submitLabel}
        pending={pending}
        onPress={() => {
          onSubmit({ email, password })
        }}
      />
      {footer}
    </ScrollView>
  )
}
```

- [ ] **Step 4: 인증 쓰기 훅을 쓴다**

`queries/auth.ts`:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { signIn, signUpThenSignIn, type Credentials } from '@/lib/auth/credentials'
import { decideAfterLogin, decideAfterRegistration, type SignInPlan } from '@/lib/auth/flow'
import type { LogoutOutcome } from '@/lib/auth/logout'
import { apiRequest } from '@/platform/api'
import { sessionManager } from '@/platform/session'

/**
 * 인증 쓰기 훅 - 가입·로그인·로그아웃(스펙 7.4).
 *
 * 판단은 lib/auth 가 한다(무엇을 보낼지, 응답을 어떻게 읽을지, 어디로 돌아갈지). 여기서는 그
 * 결정을 실행만 한다 - 결정이 establish 면 세션을 저장소에 먼저 세우고 결정을 돌려준다. 화면
 * 이동은 화면이 한다.
 */
async function establishIfSignedIn(plan: SignInPlan): Promise<SignInPlan> {
  if (plan.kind === 'establish') {
    await sessionManager.establish(plan.session, plan.refreshExpiresIn)
  }
  return plan
}

/** 로그인. `rawNext` 는 화면이 받은 `next` 파라미터 그대로다 - 검사는 decideAfterLogin 이 한다. */
export function useLoginMutation(rawNext: unknown) {
  return useMutation({
    mutationFn: async (credentials: Credentials) =>
      establishIfSignedIn(
        decideAfterLogin(await signIn(credentials, apiRequest), rawNext, credentials.email),
      ),
  })
}

/** 가입 - register 다음 login(스펙 7.4). 계정은 만들어졌는데 로그인이 실패하면 상태가 그것을 싣는다. */
export function useRegisterMutation(rawNext: unknown) {
  return useMutation({
    mutationFn: async (credentials: Credentials) =>
      establishIfSignedIn(
        decideAfterRegistration(
          await signUpThenSignIn(credentials, apiRequest),
          rawNext,
          credentials.email,
        ),
      ),
  })
}

/**
 * 로그아웃 - 기기 세션과 Query 캐시를 먼저 비우고 refresh 폐기를 요청한다(스펙 7.4·8.5).
 *
 * `onSettled` 를 훅 수준에서 받는다. 로그아웃 버튼은 세션이 지워지는 순간 사라지는데,
 * TanStack Query 는 언마운트된 호출자가 mutate() 에 넘긴 콜백을 부르지 않는다 - 훅 옵션의
 * 콜백은 부른다.
 */
export function useLogoutMutation(onSettled: () => void) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (): Promise<LogoutOutcome> =>
      sessionManager.logout(() => {
        queryClient.removeQueries()
      }),
    onSettled,
  })
}
```

`queries/AGENTS.md`:

````markdown
# queries/ 작업 지침

TanStack Query 의 캐시 키, 조회·쓰기 훅, 쓰기 후 무효화를 소유한다(스펙 5장·8.5). JSX 를 두지
않고 쿼리 문자열을 조립하지 않는다 - 요청 조립은 `lib/resources`가, 요청은 `platform/api.ts`의
`apiRequest`가 한다.

| 파일 | 역할 |
| --- | --- |
| `auth.ts` | 가입·로그인·로그아웃 쓰기 훅. `lib/auth/flow.ts`의 결정을 실행만 한다 - 세션을 세우는 데까지, 화면 이동은 화면이 한다 |

- 인증이 필요한 요청은 `sessionManager.getAccessToken()`(`platform/session.ts`)으로 토큰을 얻는다.
  `null`이면 요청하지 않고 로그인으로 보낸다(스펙 7.3의 쓰기 가드). 401 에 회전·재시도를 붙이지
  않는다(스펙 7.2).
- 로그아웃은 Query 캐시를 전부 비운다(스펙 8.5).
- 자동 재시도는 `platform/query-client.ts`가 끈다.
````

- [ ] **Step 5: 로그아웃 버튼과 앱 셸·가드를 쓴다**

`components/app/logout-button.tsx`:

```tsx
import { router } from 'expo-router'
import { ActivityIndicator } from 'react-native'

import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { POST_LOGOUT_PATH } from '@/lib/auth/logout'
import { useLogoutMutation } from '@/queries/auth'

/**
 * 헤더의 로그아웃 버튼(스펙 7.4). 로그인했을 때만 그린다 - 그 판단은 app/(app)/_layout.tsx 가 한다.
 *
 * 이동은 훅의 onSettled 에서 한다(queries/auth.ts). 서버 호출이 실패해도 기기 쪽은 이미 비었으므로
 * 성공·실패 모두 홈으로 간다. 누르는 동안에는 글자 대신 스피너만 그린다(스펙 8.7).
 */
export function LogoutButton() {
  const logout = useLogoutMutation(() => {
    router.dismissTo(POST_LOGOUT_PATH)
  })

  return (
    <Button
      testID="logout-button"
      variant="ghost"
      size="sm"
      accessibilityLabel="로그아웃"
      aria-busy={logout.isPending}
      disabled={logout.isPending}
      onPress={() => {
        logout.mutate()
      }}
    >
      {logout.isPending ? (
        <ActivityIndicator colorClassName="accent-foreground" />
      ) : (
        <Text>로그아웃</Text>
      )}
    </Button>
  )
}
```

`app/(app)/_layout.tsx`:

```tsx
import { Redirect, Stack, usePathname, type Href } from 'expo-router'

import { LogoutButton } from '@/components/app/logout-button'
import { isProtectedPath, loginHref } from '@/lib/auth/protected-paths'
import { useSessionStatus } from '@/platform/session'

/**
 * 앱 셸 - Stack 헤더와 경로 가드(스펙 4장·7.3).
 *
 * 경로 가드: 세션이 없는데 보호 경로(lib/auth/protected-paths.ts)에 있으면 로그인으로 보낸다. 원래
 * 경로는 `next` 로 실려 가고, 로그인 화면이 그 값을 검사해 돌아온다. 쓰기 가드(두 번째 겹)는 쓰기
 * 훅이 요청 직전에 세션을 다시 확인한다 - 화면 전환 시점의 이 판단은 그 사이에 세션이 사라지는
 * 경우를 보지 못한다.
 *
 * 헤더에는 로그인했을 때 로그아웃 버튼만 그린다(스펙 7.4). 사용자 이름을 그리려면 `/users/me` 가
 * 필요한데 부르지 않는다.
 */

// 딥링크나 로그인 뒤 복귀로 안쪽 화면에 바로 들어와도 그 아래에 홈이 깔린다 - 뒤로 가기가 앱을
// 닫지 않는다.
export const unstable_settings = { anchor: 'index' }

const renderLogoutButton = () => <LogoutButton />

export default function AppLayout() {
  const pathname = usePathname()
  const status = useSessionStatus()

  if (status === 'signedOut' && isProtectedPath(pathname)) {
    // loginHref 는 런타임에 만든 앱 안 경로다 - 타입드 라우트가 모르는 문자열이라 단언한다. 단언을
    // 변수에 담는다: prop 자리에 두면 타입드 라우트를 만들기 전(새 체크아웃)의 lint 가 받는 쪽이
    // string 을 받는다며 "불필요한 단언"으로 본다.
    const target = loginHref(pathname) as Href
    return <Redirect href={target} />
  }

  return (
    <Stack screenOptions={status === 'signedIn' ? { headerRight: renderLogoutButton } : {}} />
  )
}
```

`app/(app)/index.tsx` 전체를 바꾼다(D1 실측 계측용 버튼을 걷는다):

```tsx
import { Stack } from 'expo-router'
import { View } from 'react-native'

import { Text } from '@/components/ui/text'

export default function HomeScreen() {
  return (
    <View
      testID="home-screen"
      className="flex-1 items-center justify-center gap-4 bg-background p-6"
    >
      <Stack.Screen options={{ title: '홈' }} />
      <Text variant="h3">template-typescript-expo</Text>
    </View>
  )
}
```

`app/(app)/examples/new.tsx`:

```tsx
import { Stack } from 'expo-router'
import { View } from 'react-native'

import { Text } from '@/components/ui/text'

/**
 * Example 생성 화면의 자리. 폼은 아직 없다 - 지금 이 라우트는 경로 가드(스펙 7.3)의 대상이다.
 * lib/auth/protected-paths.ts 가 이 경로(/examples/new)를 보호 경로로 둔다. 라우트가 없으면
 * Expo Router 가 (app) 레이아웃 밖의 Unmatched 화면을 그려 가드가 돌지 않는다.
 */
export default function NewExampleScreen() {
  return (
    <View testID="new-example-screen" className="flex-1 bg-background p-6">
      <Stack.Screen options={{ title: 'Example 만들기' }} />
      <Text variant="h3">Example 만들기</Text>
    </View>
  )
}
```

`app/_layout.tsx` — Edit, 찾을 것:

```tsx
        <Stack />
```

바꿀 것:

```tsx
        <Stack>
          {/* 앱 셸은 자기 Stack 헤더를 그린다(app/(app)/_layout.tsx) - 헤더가 두 겹이 되지 않게 한다. */}
          <Stack.Screen name="(app)" options={{ headerShown: false }} />
        </Stack>
```

- [ ] **Step 6: 로그인·가입 화면을 쓴다**

`app/(auth)/login.tsx`:

```tsx
import { Link, Stack, router, useLocalSearchParams, type Href } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'

import { CredentialsForm } from '@/components/form/credentials-form'
import { Text } from '@/components/ui/text'
import { authLinkHref } from '@/lib/auth/flow'
import {
  IDLE_AUTH_FORM_STATE,
  unusableResponseState,
  type AuthFormState,
} from '@/lib/auth/form-state'
import { LOGIN_REDIRECT_PARAM } from '@/lib/auth/protected-paths'
import { useLoginMutation } from '@/queries/auth'

/**
 * 로그인 화면(스펙 7.4). `next` 는 경로 가드가 붙인 원래 경로다 - 값을 검사하지 않고 그대로
 * 넘긴다. 검사는 decideAfterLogin 안의 safeRedirectTarget 한 곳에서만 한다(lib/auth/flow.ts) -
 * 딥링크로 들어온 외부 URL 은 거기서 홈으로 바뀐다.
 */
export default function LoginScreen() {
  const rawNext = useLocalSearchParams()[LOGIN_REDIRECT_PARAM]
  const login = useLoginMutation(rawNext)
  const [state, setState] = useState<AuthFormState>(IDLE_AUTH_FORM_STATE)
  // authLinkHref 는 런타임에 만든 앱 안 경로다 - 타입드 라우트가 모르는 문자열이라 단언한다. 단언은
  // 변수에 담는다: prop·인자 자리에 두면 타입드 라우트를 만들기 전(새 체크아웃)의 lint 가 받는 쪽이
  // string 을 받는다며 "불필요한 단언"으로 본다.
  const registerLink = authLinkHref('/register', rawNext, LOGIN_REDIRECT_PARAM) as Href

  return (
    <>
      <Stack.Screen options={{ title: '로그인' }} />
      <CredentialsForm
        testID="login-screen"
        heading="로그인"
        submitLabel="로그인"
        passwordAutoComplete="current-password"
        state={state}
        pending={login.isPending}
        onSubmit={(credentials) => {
          login.mutate(credentials, {
            onSuccess: (plan) => {
              if (plan.kind === 'state') {
                setState(plan.state)
                return
              }
              // plan.to 는 safeRedirectTarget 을 지난 앱 안의 경로다(단언은 위와 같은 이유로 변수에).
              // dismissTo 는 그 화면이 스택에 있으면 거기까지 닫고, 없으면 지금 화면을 바꾼다.
              const target = plan.to as Href
              router.dismissTo(target)
            },
            onError: () => {
              setState(unusableResponseState({ email: credentials.email, accountCreated: false }))
            },
          })
        }}
        footer={
          <View className="flex-row flex-wrap items-center gap-1">
            <Text className="text-sm text-muted-foreground">계정이 없으신가요?</Text>
            <Link href={registerLink} replace asChild>
              <Text testID="register-link" className="text-sm text-primary underline">
                가입하기
              </Text>
            </Link>
          </View>
        }
      />
    </>
  )
}
```

`app/(auth)/register.tsx`:

```tsx
import { Link, Stack, router, useLocalSearchParams, type Href } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'

import { CredentialsForm } from '@/components/form/credentials-form'
import { Text } from '@/components/ui/text'
import { authLinkHref } from '@/lib/auth/flow'
import {
  IDLE_AUTH_FORM_STATE,
  unusableResponseState,
  type AuthFormState,
} from '@/lib/auth/form-state'
import { LOGIN_REDIRECT_PARAM } from '@/lib/auth/protected-paths'
import { useRegisterMutation } from '@/queries/auth'

/**
 * 가입 화면(스펙 7.4) - register 다음 login 을 부르고 세션을 세운 뒤 `next` 로 간다. `next` 를
 * 이어받는다 - 로그인 화면에서 "가입하기"로 온 사용자도 가입한 뒤 원래 가려던 곳으로 간다.
 */
export default function RegisterScreen() {
  const rawNext = useLocalSearchParams()[LOGIN_REDIRECT_PARAM]
  const register = useRegisterMutation(rawNext)
  const [state, setState] = useState<AuthFormState>(IDLE_AUTH_FORM_STATE)
  // authLinkHref 는 런타임에 만든 앱 안 경로다 - 타입드 라우트가 모르는 문자열이라 단언한다. 단언은
  // 변수에 담는다(login.tsx 와 같은 이유 - prop 자리의 단언은 새 체크아웃의 lint 가 막는다).
  const loginLink = authLinkHref('/login', rawNext, LOGIN_REDIRECT_PARAM) as Href

  return (
    <>
      <Stack.Screen options={{ title: '가입' }} />
      <CredentialsForm
        testID="register-screen"
        heading="가입"
        submitLabel="가입하기"
        passwordAutoComplete="new-password"
        state={state}
        pending={register.isPending}
        onSubmit={(credentials) => {
          register.mutate(credentials, {
            onSuccess: (plan) => {
              if (plan.kind === 'state') {
                setState(plan.state)
                return
              }
              const target = plan.to as Href
              router.dismissTo(target)
            },
            onError: () => {
              setState(unusableResponseState({ email: credentials.email, accountCreated: false }))
            },
          })
        }}
        notice={
          state.accountCreated ? (
            // 두 번째 호출(login)만 실패한 상태다. 이 폼을 다시 제출하면 409 가 나는 막다른 길이라
            // 쓸모 있는 행동 하나(로그인으로 가기)를 준다.
            <View
              testID="account-created-notice"
              className="gap-1 rounded-lg border border-border bg-muted p-3"
            >
              <Text className="text-sm">
                계정은 만들어졌습니다. 자동 로그인만 실패했으니 로그인에서 다시 시도해 주세요.
              </Text>
              <Link href={loginLink} replace asChild>
                <Text className="text-sm text-primary underline">로그인하기</Text>
              </Link>
            </View>
          ) : null
        }
        footer={
          <View className="flex-row flex-wrap items-center gap-1">
            <Text className="text-sm text-muted-foreground">이미 계정이 있으신가요?</Text>
            <Link href={loginLink} replace asChild>
              <Text testID="login-link" className="text-sm text-primary underline">
                로그인
              </Text>
            </Link>
          </View>
        }
      />
    </>
  )
}
```

- [ ] **Step 7: 게이트의 인용 대상과 기록을 맞춘다**

```bash
sed -i 's#^\./scripts/check-citations\.sh app components lib platform test$#./scripts/check-citations.sh app components lib platform queries test#' scripts/check.sh
grep -n "check-citations.sh app" scripts/check.sh
node - <<'EOF'
const fs = require('node:fs')
const file = 'docs/provenance/copied-core.json'
const record = JSON.parse(fs.readFileSync(file, 'utf8'))
const entry = record.divergences.find((d) => d.path === 'test/unit/scripts/check-citations.test.ts')
const what = entry.what.replace('app·components·lib·platform·test', 'app·components·lib·platform·queries·test')
const why = entry.why.replace(
  'queries/ 는 첫 파일이 생길 때 두 자리에 함께 더한다.',
  'queries/ 는 그 디렉터리의 첫 파일(queries/auth.ts)과 함께 두 자리에 더했다. 대상이 여섯이 되어 주석과 시험 이름의 "다섯"을 "여섯"으로 바꿨다.',
)
if (what === entry.what || why === entry.why) throw new Error('이탈 기록의 문장이 예상과 다르다 - 손으로 고친다')
entry.what = what
entry.why = why
fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`)
EOF
node scripts/check-provenance.mjs
```

Expected: `check.sh`의 [5] 줄이 `… platform queries test`. 출처 기록 통과(경로·이탈 수는 Task 2 끝과 같다). node가 "예상과 다르다"로 멈추면 그 항목의 `what`·`why`를 같은 뜻으로 손으로 고친다.

루트 `AGENTS.md`의 typecheck 문단에서 앱 코드 목록 `` (`app/`·`components/`·`lib/`·`platform/`) ``를 `` (`app/`·`components/`·`lib/`·`platform/`·`queries/`) ``로 바꾼다.

- [ ] **Step 8: 정적 검사와 번들을 돌린다**

```bash
pnpm format
BACKEND_URL=https://gate-check.invalid pnpm types:routes
pnpm typecheck && pnpm lint && pnpm format:check && pnpm lint:secrets
./scripts/check-citations.sh app components lib platform queries test
pnpm exec vitest run test/unit/scripts/check-citations.test.ts
pnpm test 2>&1 | tail -5
APP_VARIANT=e2e BACKEND_URL=http://10.0.2.2:4100 pnpm exec expo export --clear --platform android --output-dir dist 2>&1 | tail -6
```

Expected: 전부 exit 0. 인용 시험이 이제 통과한다(여섯 대상이 실재하고 게이트와 같다). 번들에 `Unable to resolve module`이 없다(`expo export`는 `--clear` — `expo start`를 끄고 돌린다). 타입 오류가 `Href`에서 나면 단언이 빠진 자리다 — 런타임 문자열(`plan.to`·`loginHref()`·`authLinkHref()`)만 단언하고 `POST_LOGOUT_PATH`(리터럴 `'/'`)는 단언하지 않는다.

- [ ] **Step 9: 커밋한다**

```bash
git add app components queries scripts/check.sh test/unit/scripts/check-citations.test.ts docs/provenance/copied-core.json AGENTS.md
git status --short
git commit -m "feat: 가입·로그인·로그아웃 화면과 보호 경로 가드를 더하고 인용 검사 대상에 queries 를 넣는다"
```

화면의 기기 동작은 Task 6의 E2E가 잰다(스펙 11.1 — 컴포넌트 단위 시험을 두지 않는다).

---

### Task 6: 인증 E2E와 게이트 `[12/12]`

**Files:**
- Create: `test/e2e/guard-log.sh`(100755), `test/unit/e2e/guard-log.test.ts`, `test/e2e/run-android.sh`(100755), `test/e2e/subflows/start-signed-out.yaml`, `test/e2e/subflows/submit-credentials.yaml`, `test/e2e/subflows/register.yaml`, `test/e2e/subflows/logout.yaml`, `test/e2e/flows/register-restore-logout.yaml`, `test/e2e/flows/guard-return.yaml`, `test/e2e/flows/register-conflict.yaml`, `test/e2e/flows/register-invalid.yaml`, `test/e2e/flows/login-error-ko.yaml`, `test/e2e/flows/login-error-en.yaml`, `test/e2e/AGENTS.md`, `docs/superpowers/notes/2026-09-30-d2-measurements.md`
- Modify: `test/e2e/android.sh`, `scripts/check.sh`, `test/unit/scripts/check-citations.test.ts`, `lib/config/AGENTS.md`, `docs/provenance/copied-core.json`, `AGENTS.md`, `lib/jsonapi/AGENTS.md`·`lib/jsonapi/client.ts`·`test/unit/jsonapi/client.test.ts`(주석 한 자리씩 — "미측정 - D2 가 잰다"를 실측 기록으로), `docs/superpowers/specs/2026-09-30-expo-jsonapi-template-design.md`(6.2·12장·16장 정정)

**Interfaces:**
- Consumes: Task 4의 `httpFailureLine`(형식 `[e2e-http] <상태> …`), `logsHttpFailures`(e2e); Task 5의 testID와 딥링크 경로; `test/e2e/probe-email.ts`의 `probeEmail`; D1의 `docker-compose.e2e.yml`(프로젝트 `template-typescript-expo-e2e`, 프로파일 `fastapi`·`nestjs`·`rails`, 셋 다 호스트 `127.0.0.1:${E2E_API_PORT:-4100}`)
- Produces: `./test/e2e/run-android.sh`(게이트 [12/12]), `test/e2e/guard-log.sh <logcat> [허용 상태...]`, `test/e2e/android.sh check-path`, 환경 변수 `E2E_AVD`·`ANDROID_SERIAL`·`E2E_API_PORT`·`E2E_STAGE_DIR`·`E2E_FORCE_BUILD`·`E2E_FLOW`·`MAESTRO`, 플로 머리말 `# e2e-allow-http:`·`# e2e-app-locale:`, 플로 env `EMAIL`·`OTHER_EMAIL`·`PASSWORD`, D2 실측 기록 H1(세 백엔드의 캐시 머리글)

- [ ] **Step 1: 기기 로그 가드의 시험을 쓰고 실패를 본다**

`test/unit/e2e/guard-log.test.ts`:

```ts
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { httpFailureLine } from '@/lib/jsonapi/failure-log'

/**
 * E2E 가드(스펙 11.3)를 실제 스크립트로 잰다 - 한 번도 걸리지 않는 가드는 있으나 마나다.
 *
 * 기기 로그 줄은 `adb logcat -v brief` 의 모양이고, HTTP 실패 줄은 앱이 쓰는 함수
 * (httpFailureLine)로 만든다 - 앱이 찍는 형식과 스크립트가 읽는 형식을 이 파일이 맞댄다.
 */

/** Git Bash 는 역슬래시 경로를 이스케이프로 먹어 치운다. */
function toPosix(path: string): string {
  return path.split('\\').join('/')
}

const SCRIPT = toPosix(resolve('test/e2e/guard-log.sh'))
const FIXTURES = mkdtempSync(join(tmpdir(), 'e2e-guard-'))

afterAll(() => {
  rmSync(FIXTURES, { recursive: true, force: true })
})

/**
 * 쓸 수 있는 bash 를 하나 고른다. 후보를 실제로 돌려 보고 판정한다 - Windows 의 PATH 에서
 * `bash` 는 WSL 의 bash.exe 로 잡힐 수 있고 그것은 /bin/bash 를 못 찾아 죽는다
 * (test/unit/scripts/check-citations.test.ts 와 같은 방법).
 */
function resolveBash(): string {
  const programFiles = process.env.ProgramW6432 ?? process.env.ProgramFiles ?? 'C:\\Program Files'
  const candidates =
    process.platform === 'win32'
      ? [
          'bash',
          join(programFiles, 'Git', 'bin', 'bash.exe'),
          join(programFiles, 'Git', 'usr', 'bin', 'bash.exe'),
        ]
      : ['bash']
  for (const candidate of candidates) {
    const probe = spawnSync(candidate, ['-c', 'printf ok'], { encoding: 'utf8' })
    if (probe.status === 0 && probe.stdout === 'ok') return candidate
  }
  throw new Error(`쓸 수 있는 bash 를 찾지 못했다 - 후보: ${candidates.join(' · ')}`)
}

const BASH = resolveBash()

let written = 0

function runGuard(file: string, allowed: readonly string[]): { status: number; stderr: string } {
  const run = spawnSync(BASH, [SCRIPT, toPosix(file), ...allowed], { encoding: 'utf8' })
  if (run.error) throw run.error
  if (run.status === null) throw new Error(`스크립트가 신호로 죽었다: ${String(run.signal)}`)
  return { status: run.status, stderr: run.stderr }
}

function guard(lines: readonly string[], ...allowed: string[]) {
  written += 1
  const file = join(FIXTURES, `logcat-${written}.txt`)
  writeFileSync(file, lines.map((line) => `${line}\n`).join(''), 'utf8')
  return runGuard(file, allowed)
}

const RUNNING = 'I/ReactNativeJS( 4321): Running "main" with {"rootTag":11}'

function appLine(text: string): string {
  return `I/ReactNativeJS( 4321): ${text}`
}

const CONFLICT = appLine(
  httpFailureLine('POST', '/api/v1/auth/register', 409, [{ code: 'EMAIL_ALREADY_REGISTERED' }]),
)
const INVALID = appLine(
  httpFailureLine('POST', '/api/v1/auth/register', 422, [{ code: 'VALIDATION_ERROR' }]),
)

describe('test/e2e/guard-log.sh', () => {
  it('깨끗한 로그는 통과한다', () => {
    expect(guard([RUNNING]).status).toBe(0)
  })

  it('JS 경고가 있으면 실패하고 그 줄을 낸다', () => {
    const run = guard([RUNNING, 'W/ReactNativeJS( 4321): probe warning'])
    expect(run.status).toBe(1)
    expect(run.stderr).toContain('probe warning')
  })

  it('JS 오류가 있으면 실패한다', () => {
    expect(guard([RUNNING, 'E/ReactNativeJS( 4321): probe error']).status).toBe(1)
  })

  it('앱이 치명 오류로 죽으면 실패한다', () => {
    expect(guard([RUNNING, 'E/AndroidRuntime( 4321): FATAL EXCEPTION: main']).status).toBe(1)
  })

  it('플로가 선언한 HTTP 실패는 통과한다', () => {
    expect(guard([RUNNING, CONFLICT], '409').status).toBe(0)
  })

  it('선언하지 않은 HTTP 실패는 실패하고 무엇이 걸렸는지 낸다', () => {
    const run = guard([RUNNING, CONFLICT], '401')
    expect(run.status).toBe(1)
    expect(run.stderr).toContain('409')
    expect(run.stderr).toContain('EMAIL_ALREADY_REGISTERED')
  })

  it('상태 번호의 일부만 겹쳐서는 통과하지 않는다', () => {
    expect(guard([RUNNING, INVALID], '42').status).toBe(1)
    expect(guard([RUNNING, INVALID], '1422').status).toBe(1)
  })

  it('백엔드에 닿지 못한 요청(상태 0)도 선언하지 않았으면 실패한다', () => {
    const unreachable = appLine(httpFailureLine('POST', '/api/v1/auth/login', 0, [{ code: 'NETWORK_ERROR' }]))
    expect(guard([RUNNING, unreachable]).status).toBe(1)
  })

  it('상태가 둘이면 둘 다 선언해야 통과한다', () => {
    expect(guard([RUNNING, CONFLICT, INVALID], '409').status).toBe(1)
    expect(guard([RUNNING, CONFLICT, INVALID], '409', '422').status).toBe(0)
  })

  it('Windows adb 의 CRLF 줄 끝에서도 상태를 읽는다', () => {
    written += 1
    const file = join(FIXTURES, `logcat-${written}.txt`)
    writeFileSync(file, `${[RUNNING, CONFLICT].join('\r\n')}\r\n`, 'utf8')
    expect(runGuard(file, []).status).toBe(1)
    expect(runGuard(file, ['409']).status).toBe(0)
  })

  it('로그 파일이 없으면 실패한다 - 로그를 못 모은 채 통과하지 않는다', () => {
    expect(runGuard(join(FIXTURES, 'missing.txt'), []).status).toBe(1)
  })
})
```

```bash
pnpm exec vitest run test/unit/e2e/guard-log.test.ts 2>&1 | tail -5
```

Expected: FAIL — 스크립트가 없어 bash가 exit 127을 낸다.

- [ ] **Step 2: 가드 스크립트를 쓰고 기기 도우미를 고친다**

`test/e2e/guard-log.sh`:

```bash
#!/usr/bin/env bash
# E2E 플로 하나가 남긴 기기 로그에 가드를 건다 - 스펙 11.3.
#
#   test/e2e/guard-log.sh <logcat 파일> [<허용 상태>...]
#
# 기기 로그는 `adb logcat -v brief` 모양이다. 실패(exit 1)로 만드는 것:
#   - JS 경고·오류: ReactNativeJS 태그의 W·E·F 줄
#   - 앱 프로세스의 치명 오류: FATAL EXCEPTION
#   - 플로가 선언하지 않은 HTTP 실패: e2e 변형의 API 클라이언트가 남긴 `[e2e-http] <상태> …` 줄
#     (lib/jsonapi/failure-log.ts 의 httpFailureLine) 가운데 상태가 허용 목록에 없는 것
#
# 걸린 줄은 stderr 로 낸다. test/unit/e2e/guard-log.test.ts 가 이 스크립트를 실제로 돌려 잰다.
set -euo pipefail

log="${1:?기기 로그 파일이 필요하다}"
shift
[ -f "$log" ] || { echo "기기 로그 파일이 없다: $log" >&2; exit 1; }

allowed=" $* "
bad=0

if grep -E '^[WEF]/ReactNativeJS' "$log" >&2; then
  echo "위 JS 경고·오류가 기기 로그에 있다" >&2
  bad=1
fi

if grep -F 'FATAL EXCEPTION' "$log" >&2; then
  echo "앱이 치명 오류로 죽었다" >&2
  bad=1
fi

for status in $(sed -n 's/.*\[e2e-http\] \([0-9][0-9]*\) .*/\1/p' "$log" | sort -u); do
  case "$allowed" in
    *" $status "*) ;;
    *)
      echo "플로가 선언하지 않은 HTTP 실패: $status (허용: ${*:-없음})" >&2
      grep -F "[e2e-http] $status " "$log" >&2 || true
      bad=1
      ;;
  esac
done

exit "$bad"
```

```bash
chmod +x test/e2e/guard-log.sh
pnpm exec vitest run test/unit/e2e/guard-log.test.ts
```

Expected: PASS, 11개.

`test/e2e/android.sh` 전체를 바꾼다 — 경로 길이 검사(`check-path`, `build` 앞), 기기 여럿의 즉시 실패, `wait-text`의 초 단위 기한과 마지막 adb 오류, 자동 완성 끄기:

```bash
#!/usr/bin/env bash
# Android 기기 도우미 - E2E 하네스(test/e2e/run-android.sh)가 쓴다.
#
#   test/e2e/android.sh boot        켜진 기기가 없으면 E2E_AVD 를 부팅하고 부팅 완료까지 기다린다.
#                                   BOOT_TIMEOUT_SECONDS(기본 300) 안에 끝나지 않거나 에뮬레이터가
#                                   죽으면 에뮬레이터 로그의 꼬리를 내고 실패한다. 기기가 여럿인데
#                                   ANDROID_SERIAL 이 없으면 곧바로 실패한다
#   test/e2e/android.sh check-path  이 위치에서 Android 네이티브 빌드가 되는가 - Windows 에서 저장소
#                                   경로가 47자를 넘으면 실패한다
#   test/e2e/android.sh build       e2e 변형 Release APK 를 만든다 (BACKEND_URL 필요).
#                                   만든 APK 의 assets/app.config 가 e2e 변형인지 확인한다
#   test/e2e/android.sh install     만든 APK 를 설치한다
#   test/e2e/android.sh wait-text <텍스트>
#                                   그 텍스트가 화면에 나타날 때까지(최대 60초) 기다리고
#                                   UI 덤프를 stdout 에 낸다
#
# 기기가 여럿이면 ANDROID_SERIAL 로 하나를 고른다(adb 의 표준 변수).
set -euo pipefail
cd "$(dirname "$0")/../.."

: "${ANDROID_HOME:?ANDROID_HOME 이 필요하다 - Android SDK 경로}"
ADB="$ANDROID_HOME/platform-tools/adb"
EMULATOR="$ANDROID_HOME/emulator/emulator"
APK=android/app/build/outputs/apk/release/app-release.apk
BOOT_TIMEOUT_SECONDS="${BOOT_TIMEOUT_SECONDS:-300}"
WAIT_TEXT_TIMEOUT_SECONDS=60

# Windows 에서 Android 네이티브 빌드(Gradle·CMake·ninja)는 저장소 루트가 이 길이 이하일 때만 된다
# (docs/superpowers/notes/2026-09-30-d1-measurements.md 의 M1 절 - 47자 성공, 50자 실패).
MAX_WINDOWS_ROOT_LENGTH=47

# adb devices 는 ANDROID_SERIAL 을 무시하므로 고른 기기만 직접 센다.
device_count() {
  "$ADB" devices | awk -v serial="${ANDROID_SERIAL:-}" 'NR > 1 && $2 == "device" && (serial == "" || $1 == serial)' | wc -l | tr -d ' '
}

boot_completed() {
  [ "$("$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]
}

boot() {
  local emulator_pid=''
  local emulator_log=''
  local devices
  devices=$(device_count)
  # 기기가 여럿이면 adb shell 이 "more than one device" 로 죽는다 - 제한 시간 내내 기다리지 않는다.
  if [ "$devices" -ge 2 ] && [ -z "${ANDROID_SERIAL:-}" ]; then
    echo "기기가 ${devices}개 연결돼 있다 - ANDROID_SERIAL 로 하나를 고른다" >&2
    exit 1
  fi
  if [ "$devices" -ge 1 ]; then
    echo "기기가 이미 연결돼 있다"
  else
    : "${E2E_AVD:?켜진 기기가 없다 - 부팅할 AVD 이름을 E2E_AVD 로 준다 (예: Pixel_9_API_36)}"
    emulator_log="${TMPDIR:-/tmp}/e2e-emulator-$E2E_AVD.log"
    "$EMULATOR" -avd "$E2E_AVD" -no-snapshot-save -no-boot-anim -no-audio >"$emulator_log" 2>&1 </dev/null &
    emulator_pid=$!
  fi
  # 기기 등록과 부팅 완료를 같은 제한 안에서 기다린다. 에뮬레이터가 죽거나 시간이 다 되면
  # 그 로그의 꼬리를 내고 멈춘다 - 아무 말 없이 영원히 기다리지 않는다.
  local waited=0
  until [ "$(device_count)" -ge 1 ] && boot_completed; do
    if [ -n "$emulator_pid" ] && ! kill -0 "$emulator_pid" 2>/dev/null; then
      echo "에뮬레이터가 부팅 도중 종료됐다 (로그: $emulator_log)" >&2
      tail -n 20 "$emulator_log" >&2
      exit 1
    fi
    if [ "$waited" -ge "$BOOT_TIMEOUT_SECONDS" ]; then
      echo "${BOOT_TIMEOUT_SECONDS}초 안에 부팅이 끝나지 않았다${emulator_log:+ (로그: $emulator_log)}" >&2
      [ -z "$emulator_log" ] || tail -n 20 "$emulator_log" >&2
      exit 1
    fi
    sleep 2
    waited=$((waited + 2))
  done
  # 애니메이션을 끈다 - 화면 전환 중의 단언이 흔들리지 않게 한다(스펙 16장).
  "$ADB" shell settings put global window_animation_scale 0
  "$ADB" shell settings put global transition_animation_scale 0
  "$ADB" shell settings put global animator_duration_scale 0
  # 자동 완성 서비스를 끈다 - 비밀번호 칸이 있는 폼을 제출하면 "비밀번호를 저장할까요" 대화상자가
  # 떠서 플로의 다음 단계를 가릴 수 있다. 앱의 입력은 자동 완성을 막지 않는다.
  "$ADB" shell settings put secure autofill_service null
}

check_path() {
  local root
  # Git Bash 의 pwd -W 는 C:/… 모양의 Windows 경로를 준다. 다른 셸에는 -W 가 없다 - 검사하지 않는다.
  root=$(pwd -W 2>/dev/null || true)
  if [ -n "$root" ] && [ "${#root}" -gt "$MAX_WINDOWS_ROOT_LENGTH" ]; then
    echo "저장소 경로가 ${#root}자다 - Windows 의 Android 빌드는 ${MAX_WINDOWS_ROOT_LENGTH}자 이하에서만 된다: $root" >&2
    echo "test/e2e/run-android.sh 는 짧은 경로(E2E_STAGE_DIR)의 사본에서 빌드한다." >&2
    return 1
  fi
}

# Gradle 의 createExpoConfig 가 app.config.ts 를 다시 평가해 APK 의 assets/app.config(앱이 읽는
# Constants.expoConfig)로 넣는다. 그 프로세스가 APP_VARIANT 를 못 받으면 네이티브는 e2e 인데 앱
# 설정은 development 인 APK 가 나온다.
assert_apk_variant() {
  command -v unzip >/dev/null || { echo "unzip 이 필요하다 - APK 의 앱 설정을 확인하지 못한다" >&2; exit 1; }
  local variant
  if ! variant=$(unzip -p "$APK" assets/app.config | node -e 'process.stdout.write(String(JSON.parse(require("fs").readFileSync(0, "utf8")).extra?.appVariant))'); then
    echo "APK 에서 assets/app.config 를 읽지 못했다: $APK" >&2
    exit 1
  fi
  if [ "$variant" != "e2e" ]; then
    echo "APK 의 앱 설정이 e2e 변형이 아니다 (extra.appVariant=$variant) - Gradle 이 APP_VARIANT 를 받지 못했다" >&2
    exit 1
  fi
  echo "APK 의 앱 설정: extra.appVariant=$variant"
}

build() {
  : "${BACKEND_URL:?BACKEND_URL 이 필요하다 - 에뮬레이터에서 호스트는 http://10.0.2.2:<포트>}"
  check_path || exit 1
  # prebuild 와 Gradle 이 같은 변형을 받도록 export 한다(접두 대입은 그 명령 하나에만 적용된다).
  export APP_VARIANT=e2e
  pnpm exec expo prebuild --platform android --clean --no-install
  (cd android && ./gradlew assembleRelease)
  assert_apk_variant
  ls -l "$APK"
}

install() {
  "$ADB" install -r "$APK"
}

wait_text() {
  local text="${1:?기다릴 텍스트가 필요하다}"
  local dump=''
  local errors
  errors=$(mktemp)
  local deadline=$((SECONDS + WAIT_TEXT_TIMEOUT_SECONDS))
  until dump=$("$ADB" exec-out uiautomator dump /dev/tty 2>"$errors") && grep -qF "text=\"$text\"" <<<"$dump"; do
    if [ "$SECONDS" -ge "$deadline" ]; then
      echo "${WAIT_TEXT_TIMEOUT_SECONDS}초 안에 \"$text\" 가 화면에 나타나지 않았다" >&2
      if [ -s "$errors" ]; then
        echo "마지막 adb 오류:" >&2
        cat "$errors" >&2
      fi
      rm -f "$errors"
      exit 1
    fi
    sleep 1
  done
  rm -f "$errors"
  printf '%s\n' "$dump"
}

case "${1:-}" in
  boot) boot ;;
  check-path) check_path ;;
  build) build ;;
  install) install ;;
  wait-text)
    shift
    wait_text "$@"
    ;;
  *)
    echo "사용법: $0 boot|check-path|build|install|wait-text <텍스트>" >&2
    exit 1
    ;;
esac
```

```bash
test/e2e/android.sh check-path; echo "check-path exit=$?"
```

Expected: 이 머신의 저장소 위치(74자)에서 `저장소 경로가 74자다 …`와 `check-path exit=1`.

- [ ] **Step 3: 하네스를 쓴다**

`test/e2e/run-android.sh`:

```bash
#!/usr/bin/env bash
# E2E 게이트 단계 - Android 에뮬레이터 + FastAPI 스택 + Maestro(스펙 12장·11.3·11.4).
#
#   test/e2e/run-android.sh
#
# 순서: 도구 확인 → 기기 준비 → e2e APK(빌드 입력이 지난번과 같으면 다시 만들지 않는다) → 설치 →
# FastAPI 스택 → test/e2e/flows/*.yaml 을 하나씩 돌리며 플로마다 기기 로그에 가드를 건다 → 이
# 저장소의 compose 프로젝트만 내린다(실패해도 내린다).
#
# ## 환경 변수
#
#   E2E_AVD           켜진 기기가 없을 때 부팅할 AVD 이름(예: Pixel_9_API_36)
#   ANDROID_SERIAL    기기가 여럿일 때 하나를 고르는 adb 의 표준 변수
#   E2E_API_PORT      백엔드를 여는 호스트 포트. 기본 4100(docker-compose.e2e.yml 과 같은 값)
#   E2E_STAGE_DIR     Windows 에서 저장소 경로가 길 때 빌드할 짧은 경로. 기본 C:/t/e
#   E2E_FORCE_BUILD   1 이면 빌드 입력이 같아도 APK 를 다시 만든다
#   E2E_FLOW          돌릴 플로 이름(공백으로 구분, 확장자 없이). 비우면 전부 - 게이트는 비우고 부른다
#   MAESTRO           Maestro 실행 파일. 기본은 PATH 의 maestro, 없으면 ~/.maestro/bin/maestro
#
# ## 플로 머리말
#
# 플로 파일의 주석 두 가지를 읽는다(test/e2e/AGENTS.md):
#
#   # e2e-allow-http: 409     플로가 일부러 일으키는 2xx 밖의 상태. 여기 없는 상태가 기기 로그에
#                             나오면 실패다(test/e2e/guard-log.sh)
#   # e2e-app-locale: ko-KR   앱별 언어. 주면 앱 상태를 지우고(pm clear) 그 언어를 정한 뒤 돈다
#
# 플로에는 EMAIL·OTHER_EMAIL(플로마다 새로 만든다 - test/e2e/probe-email.ts)과 PASSWORD 가 env 로
# 들어간다. OTHER_EMAIL 은 한 플로 안에서 두 번째 사용자가 필요할 때 쓴다.
# 결과(Maestro 출력·디버그 기록·기기 로그)는 플로마다 .maestro-output/e2e/<플로>/ 에 남는다.
set -euo pipefail
cd "$(dirname "$0")/../.."

readonly REPO_ROOT="$PWD"
readonly PROJECT=template-typescript-expo-e2e
readonly APP_ID=com.example.templateexpo.e2e
readonly APK=android/app/build/outputs/apk/release/app-release.apk
readonly API_PORT="${E2E_API_PORT:-4100}"
readonly APP_BACKEND_URL="http://10.0.2.2:$API_PORT"
readonly STAGE_DIR="${E2E_STAGE_DIR:-C:/t/e}"
readonly STAGE_MARK=.e2e-stage
readonly OUT=.maestro-output/e2e
# 가입·로그인에 쓰는 비밀번호 - 백엔드의 12자 하한을 넘고 실전 값이 아니다.
readonly E2E_PASSWORD=probe-password-value

export E2E_API_PORT="$API_PORT"
export MAESTRO_CLI_NO_ANALYTICS=1
export MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true

fail() {
  echo "E2E: $*" >&2
  exit 1
}

compose() {
  docker compose -p "$PROJECT" -f docker-compose.e2e.yml "$@"
}

# 내릴 때는 세 프로파일을 모두 준다 - down 도 활성 프로파일만 대상으로 삼는다(compose 머리말).
compose_down() {
  compose --profile fastapi --profile nestjs --profile rails down -v --remove-orphans >/dev/null 2>&1 || true
}

# ── 도구 ────────────────────────────────────────────────────────────
command -v docker >/dev/null || fail "docker 가 없다"
docker info >/dev/null 2>&1 || fail "Docker 데몬에 닿지 못한다 - Docker 를 켠다"
[ -n "${ANDROID_HOME:-}" ] || fail "ANDROID_HOME 이 없다 - Android SDK 경로를 준다"
readonly ADB="$ANDROID_HOME/platform-tools/adb"
"$ADB" version >/dev/null 2>&1 || fail "adb 를 실행하지 못한다: $ADB"
MAESTRO="${MAESTRO:-$(command -v maestro || printf '%s' "$HOME/.maestro/bin/maestro")}"
"$MAESTRO" --version >/dev/null 2>&1 ||
  fail "Maestro 를 실행하지 못한다: $MAESTRO - cli-2.11.0 을 ~/.maestro 에 푼다(docs/superpowers/notes/2026-09-30-d1-measurements.md 의 M8 절)"
command -v unzip >/dev/null || fail "unzip 이 없다 - APK 의 앱 설정을 확인할 때 쓴다"
command -v node >/dev/null || fail "node 가 없다"
command -v curl >/dev/null || fail "curl 이 없다"

# ── 빌드 ────────────────────────────────────────────────────────────
existing_files() {
  local file
  while IFS= read -r -d '' file; do
    if [ -f "$file" ]; then printf '%s\0' "$file"; fi
  done
}

# 빌드에 들어가는 파일의 지문 - 시험·문서·스크립트·마크다운을 뺀 추적·미추적(무시 제외) 파일의
# 이름과 내용, 그리고 앱이 볼 백엔드 주소. 플로만 고친 실행은 APK 를 다시 만들지 않는다.
build_fingerprint() {
  {
    git ls-files -z -co --exclude-standard -- . ':!test' ':!docs' ':!scripts' ':!*.md' |
      existing_files | xargs -0 sha1sum
    printf 'BACKEND_URL=%s\n' "$APP_BACKEND_URL"
  } | sha1sum | cut -d ' ' -f 1
}

# Windows 에서 저장소 경로가 길면 짧은 경로에 사본을 만든다(test/e2e/android.sh check-path).
stage_sources() {
  if [ -d "$STAGE_DIR" ] && [ ! -e "$STAGE_DIR/$STAGE_MARK" ] && [ -n "$(ls -A "$STAGE_DIR")" ]; then
    fail "$STAGE_DIR 가 비어 있지 않은데 이 하네스가 만든 사본이 아니다($STAGE_MARK 없음) - 지우지 않는다. E2E_STAGE_DIR 로 다른 경로를 준다"
  fi
  mkdir -p "$STAGE_DIR"
  # node_modules 만 남기고 지운 뒤 다시 복사한다 - 저장소에서 지운 라우트 파일이 사본에 남으면
  # Expo Router 가 그것까지 라우트로 묶는다. node_modules 는 락파일이 같으면 설치가 몇 초로 끝난다.
  find "$STAGE_DIR" -mindepth 1 -maxdepth 1 ! -name node_modules -exec rm -rf {} +
  touch "$STAGE_DIR/$STAGE_MARK"
  git ls-files -z -co --exclude-standard | existing_files | tar --null -T - -cf - | (cd "$STAGE_DIR" && tar -xf -)
  (cd "$STAGE_DIR" && pnpm install --frozen-lockfile)
}

build_and_install() {
  local root fingerprint stamp
  if test/e2e/android.sh check-path >/dev/null 2>&1; then root="$REPO_ROOT"; else root="$STAGE_DIR"; fi
  fingerprint=$(build_fingerprint)
  stamp="$root/$APK.fingerprint"
  if [ "${E2E_FORCE_BUILD:-}" != 1 ] && [ -f "$root/$APK" ] && [ "$(cat "$stamp" 2>/dev/null || true)" = "$fingerprint" ]; then
    echo "빌드 입력이 지난번과 같다 - APK 를 다시 만들지 않는다 ($root/$APK)"
  else
    [ "$root" = "$REPO_ROOT" ] || stage_sources
    (cd "$root" && BACKEND_URL="$APP_BACKEND_URL" test/e2e/android.sh build)
    printf '%s\n' "$fingerprint" >"$stamp"
  fi
  (cd "$root" && test/e2e/android.sh install)
}

# ── 플로 ────────────────────────────────────────────────────────────
header() {
  sed -n "s/^# $2: *//p" "$1" | head -n 1
}

probe_email() {
  node --input-type=module -e "import { probeEmail } from './test/e2e/probe-email.ts'; process.stdout.write(probeEmail('probe-e2e', process.argv[1]))" "$1"
}

run_flow() {
  local flow=$1 name locale allowed email other_email out rc=0
  local device_args=()
  name=$(basename "$flow" .yaml)
  locale=$(header "$flow" e2e-app-locale)
  allowed=$(header "$flow" e2e-allow-http)
  email=$(probe_email "$name")
  other_email=$(probe_email "$name-other")
  out="$OUT/$name"
  mkdir -p "$out"
  [ -z "${ANDROID_SERIAL:-}" ] || device_args=(--device "$ANDROID_SERIAL")

  "$ADB" logcat -c
  if [ -n "$locale" ]; then
    # 로캘 플로는 clearState 를 쓰지 않는다 - 상태 지우기가 앱별 언어까지 지운다(D1 실측 M3).
    # 그래서 여기서 먼저 지우고 언어를 정한다.
    "$ADB" shell pm clear "$APP_ID" >/dev/null
    "$ADB" shell cmd locale set-app-locales "$APP_ID" --locales "$locale"
  fi

  echo "--- $name${locale:+ ($locale)}"
  "$MAESTRO" test --no-ansi ${device_args[@]+"${device_args[@]}"} --debug-output "$out/debug" \
    -e "EMAIL=$email" -e "OTHER_EMAIL=$other_email" -e "PASSWORD=$E2E_PASSWORD" "$flow" >"$out/maestro.log" 2>&1 || rc=$?
  "$ADB" logcat -d -v brief -s ReactNativeJS:V AndroidRuntime:E >"$out/logcat.txt" 2>&1 || true

  if [ "$rc" -ne 0 ]; then
    tail -n 30 "$out/maestro.log" >&2
    echo "E2E: $name 플로가 실패했다(exit $rc) - 기록: $out" >&2
    return 1
  fi
  # 허용 상태는 공백으로 나뉜 여러 인자로 넘긴다.
  # shellcheck disable=SC2086
  if ! test/e2e/guard-log.sh "$out/logcat.txt" $allowed; then
    echo "E2E: $name 의 기기 로그가 가드에 걸렸다 - $out/logcat.txt" >&2
    return 1
  fi
}

# ── 실행 ────────────────────────────────────────────────────────────
rm -rf "$OUT"
mkdir -p "$OUT"
test/e2e/android.sh boot
build_and_install

trap compose_down EXIT
compose_down
compose --profile fastapi up -d --build --wait
curl -fsS "http://127.0.0.1:$API_PORT/health/ready" >/dev/null || fail "FastAPI 가 127.0.0.1:$API_PORT 에서 준비되지 않았다"

flows=()
for flow in test/e2e/flows/*.yaml; do
  name=$(basename "$flow" .yaml)
  if [ -z "${E2E_FLOW:-}" ] || [[ " $E2E_FLOW " == *" $name "* ]]; then flows+=("$flow"); fi
done
[ "${#flows[@]}" -gt 0 ] || fail "돌릴 플로가 없다(E2E_FLOW=${E2E_FLOW:-})"
[ -z "${E2E_FLOW:-}" ] || echo "E2E_FLOW 로 플로 ${#flows[@]}개만 돈다: $E2E_FLOW"

failed=()
for flow in "${flows[@]}"; do
  run_flow "$flow" || failed+=("$(basename "$flow" .yaml)")
done

[ "${#failed[@]}" -eq 0 ] || fail "실패한 플로 ${#failed[@]}개: ${failed[*]}"
echo "=== E2E 통과 - 플로 ${#flows[@]}개 ==="
```

```bash
chmod +x test/e2e/run-android.sh
bash -n test/e2e/run-android.sh && bash -n test/e2e/android.sh && bash -n test/e2e/guard-log.sh && echo "syntax ok"
```

Expected: `syntax ok`.

- [ ] **Step 4: 플로와 공통 단계를 쓴다**

`test/e2e/subflows/start-signed-out.yaml`:

```yaml
# 앱 상태를 지우고 띄워 홈이 보일 때까지 기다린다 - 세션 없이 시작한다.
# 로캘 플로에서는 쓰지 않는다: clearState 가 앱별 언어까지 지운다(D1 실측 M3).
appId: com.example.templateexpo.e2e
---
- launchApp:
    clearState: true
- extendedWaitUntil:
    visible:
      id: home-screen
    timeout: 30000
```

`test/e2e/subflows/submit-credentials.yaml`:

```yaml
# 지금 화면의 자격증명 폼(로그인·가입 공통)에 EMAIL·PASSWORD 를 넣고 제출한다.
appId: com.example.templateexpo.e2e
---
- tapOn:
    id: email-input
- inputText: ${EMAIL}
- tapOn:
    id: password-input
- inputText: ${PASSWORD}
- tapOn:
    id: submit-button
```

`test/e2e/subflows/register.yaml`:

```yaml
# 가입 화면을 열어 EMAIL·PASSWORD 로 가입한다. 가입은 로그인까지 이어지고(스펙 7.4) 헤더에
# 로그아웃 버튼이 생긴다. 앞 단계가 홈 화면을 기다려 두어야 한다(launchApp 직후의 딥링크는 버려진다).
appId: com.example.templateexpo.e2e
---
- openLink: templateexpo-e2e://register
- extendedWaitUntil:
    visible:
      id: register-screen
    timeout: 15000
- runFlow: submit-credentials.yaml
- extendedWaitUntil:
    visible:
      id: logout-button
    timeout: 20000
```

`test/e2e/subflows/logout.yaml`:

```yaml
# 헤더의 로그아웃 버튼을 누르고 버튼이 사라질 때까지 기다린다.
appId: com.example.templateexpo.e2e
---
- tapOn:
    id: logout-button
- extendedWaitUntil:
    notVisible:
      id: logout-button
    timeout: 20000
```

`test/e2e/flows/register-restore-logout.yaml`:

```yaml
# 가입 → 앱을 다시 띄워도 세션이 남는다 → 로그아웃 → 다시 띄워도 로그아웃 상태다 → 다른 사용자로
# 가입해 다시 로그인 상태가 된다(스펙 7.1·7.4, 11.3 의 "앱 재시작 후 세션 복원").
appId: com.example.templateexpo.e2e
---
- runFlow: ../subflows/start-signed-out.yaml
- assertNotVisible:
    id: logout-button
- runFlow: ../subflows/register.yaml
- assertVisible:
    id: home-screen
# 앱을 멈췄다 다시 띄운다(clearState 없이) - SecureStore 의 세션을 되살려 헤더에 로그아웃 버튼이 있다.
- stopApp
- launchApp
- extendedWaitUntil:
    visible:
      id: logout-button
    timeout: 30000
- runFlow: ../subflows/logout.yaml
- assertVisible:
    id: home-screen
# 로그아웃이 기기의 세션 항목까지 지웠다 - 다시 띄워도 로그아웃 상태다.
- stopApp
- launchApp
- extendedWaitUntil:
    visible:
      id: home-screen
    timeout: 30000
- assertNotVisible:
    id: logout-button
# 다른 사용자(OTHER_EMAIL)로 가입하면 그 사용자로 로그인 상태가 된다 - 앞 사용자의 세션·캐시가 새
# 세션을 막지 않는다. 누구로 로그인했는지 그리는 화면은 없다(스펙 7.4 - 헤더는 로그아웃 버튼만).
# 중첩 runFlow 의 env 범위에 기대지 않으려고 공통 단계를 풀어 쓴다.
- openLink: templateexpo-e2e://register
- extendedWaitUntil:
    visible:
      id: register-screen
    timeout: 15000
- tapOn:
    id: email-input
- inputText: ${OTHER_EMAIL}
- tapOn:
    id: password-input
- inputText: ${PASSWORD}
- tapOn:
    id: submit-button
- extendedWaitUntil:
    visible:
      id: logout-button
    timeout: 20000
- assertVisible:
    id: home-screen
- runFlow: ../subflows/logout.yaml
```

`test/e2e/flows/guard-return.yaml`:

```yaml
# 보호 경로 → 로그인 → next 로 복귀(스펙 7.3·11.3). 로그인한 뒤 홈이 아니라 막혔던 화면에 닿아야 한다.
appId: com.example.templateexpo.e2e
---
- runFlow: ../subflows/start-signed-out.yaml
# 로그인할 계정을 만들고 로그아웃해 익명으로 돌아간다.
- runFlow: ../subflows/register.yaml
- runFlow: ../subflows/logout.yaml
# 보호 경로를 딥링크로 연다 - 경로 가드가 로그인으로 보낸다.
- openLink: templateexpo-e2e://examples/new
- extendedWaitUntil:
    visible:
      id: login-screen
    timeout: 15000
- assertNotVisible:
    id: new-example-screen
- runFlow: ../subflows/submit-credentials.yaml
- extendedWaitUntil:
    visible:
      id: new-example-screen
    timeout: 20000
- assertVisible:
    id: logout-button
```

`test/e2e/flows/register-conflict.yaml`:

```yaml
# e2e-allow-http: 409
# 이미 있는 이메일로 가입하면 409 EMAIL_ALREADY_REGISTERED 가 폼 위 배너로 뜬다. source 가 없는
# 문서 오류라 이메일 칸 아래로 옮기지 않는다(스펙 9.1, lib/auth/flow.ts 의 authFormStateFromErrors).
appId: com.example.templateexpo.e2e
---
- runFlow: ../subflows/start-signed-out.yaml
- runFlow: ../subflows/register.yaml
- runFlow: ../subflows/logout.yaml
- openLink: templateexpo-e2e://register
- extendedWaitUntil:
    visible:
      id: register-screen
    timeout: 15000
- runFlow: ../subflows/submit-credentials.yaml
- extendedWaitUntil:
    visible:
      id: form-banner-message
    timeout: 20000
- assertVisible:
    id: register-screen
- assertNotVisible:
    id: email-error
- assertNotVisible:
    id: logout-button
```

`test/e2e/flows/register-invalid.yaml`:

```yaml
# e2e-allow-http: 422
# 짧은 비밀번호로 가입하면 422 VALIDATION_ERROR 가 비밀번호 칸 아래 필드 오류로 뜬다(스펙 9.1).
# 백엔드의 비밀번호 하한은 12자다 - probe 는 그보다 짧다.
appId: com.example.templateexpo.e2e
---
- runFlow: ../subflows/start-signed-out.yaml
- openLink: templateexpo-e2e://register
- extendedWaitUntil:
    visible:
      id: register-screen
    timeout: 15000
- tapOn:
    id: email-input
- inputText: ${EMAIL}
- tapOn:
    id: password-input
- inputText: probe
- tapOn:
    id: submit-button
- extendedWaitUntil:
    visible:
      id: password-error
    timeout: 20000
- assertNotVisible:
    id: email-error
- assertNotVisible:
    id: form-banner
- assertVisible:
    id: register-screen
```

`test/e2e/flows/login-error-ko.yaml`:

```yaml
# e2e-app-locale: ko-KR
# e2e-allow-http: 401
# 없는 계정으로 로그인하면 401 INVALID_CREDENTIALS 문구가 기기 언어로 뜬다(스펙 9.3·9.4). 짝인
# login-error-en.yaml 이 영어 쪽에 한글이 없는지 본다 - 한국어 쪽만 보면 Accept-Language 배선을
# 지워도 통과한다(헤더가 없으면 백엔드가 ko 로 떨어진다).
appId: com.example.templateexpo.e2e
---
# clearState 를 쓰지 않는다 - 하네스가 정한 앱별 언어가 지워진다(D1 실측 M3).
- launchApp
- extendedWaitUntil:
    visible:
      id: home-screen
    timeout: 30000
- openLink: templateexpo-e2e://login
- extendedWaitUntil:
    visible:
      id: login-screen
    timeout: 15000
- runFlow: ../subflows/submit-credentials.yaml
- extendedWaitUntil:
    visible:
      id: form-banner-message
    timeout: 20000
# 완성형 한글 음절(가-힣)이 문구 어딘가에 있다. 정규식은 작은따옴표로 감싼다 - YAML 의 큰따옴표는
# 역슬래시를 이스케이프로 읽는다.
- assertVisible:
    id: form-banner-message
    text: '[\s\S]*[\uAC00-\uD7A3][\s\S]*'
```

`test/e2e/flows/login-error-en.yaml`:

```yaml
# e2e-app-locale: en-US
# e2e-allow-http: 401
# 없는 계정으로 로그인한 401 문구에 한글이 없다(스펙 9.4). 헤더를 싣는 자리(platform/api.ts)가
# 끊기면 백엔드가 ko 로 떨어져 이 플로가 한글을 보고 실패한다.
appId: com.example.templateexpo.e2e
---
# clearState 를 쓰지 않는다 - 하네스가 정한 앱별 언어가 지워진다(D1 실측 M3).
- launchApp
- extendedWaitUntil:
    visible:
      id: home-screen
    timeout: 30000
- openLink: templateexpo-e2e://login
- extendedWaitUntil:
    visible:
      id: login-screen
    timeout: 15000
- runFlow: ../subflows/submit-credentials.yaml
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
```

`test/e2e/AGENTS.md`:

````markdown
# test/e2e/ 작업 지침

Maestro 플로, E2E 하네스, SQL 시드가 산다(스펙 4장·11.3·11.4). 게이트의 E2E 단계는
`test/e2e/run-android.sh` 하나다.

## 플로를 쓸 때

- 파일 하나가 시나리오 하나다. `flows/*.yaml`은 하네스가 전부 돈다. 여러 플로가 쓰는 단계는
  `subflows/`에 두고 `runFlow`로 부른다.
- 머리말 주석으로 하네스에 선언한다: `# e2e-allow-http: <상태>...`(일부러 일으키는 2xx 밖의
  상태 - 선언하지 않은 상태가 기기 로그에 나오면 실패다), `# e2e-app-locale: <태그>`(앱별 언어).
- `EMAIL`·`OTHER_EMAIL`(플로마다 새로 만든다 - `probe-email.ts`)과 `PASSWORD`가 env 로 들어온다.
  `OTHER_EMAIL`은 한 플로 안의 두 번째 사용자다. 실전 상수와 같은 값을 쓰지 않는다.
- 하네스는 `MAESTRO_CLI_NO_ANALYTICS=1`로 Maestro 의 사용 통계를 끄고, 플로마다 `--debug-output`으로
  기록을 따로 받는다.
- 화면 요소는 testID(`id:`)로 찾는다. 문구로 찾지 않는다 - 오류 문구는 백엔드가 협상한 언어다.
- D1 실측(M8·M3)에서 걸린 것: `evalScript` 값은 따옴표로 감싼다. `launchApp` 뒤에는 화면 요소를
  기다린 다음 `openLink`를 보낸다(직후의 딥링크는 버려진다). `console.log`는 콘솔이 아니라 디버그
  로그(`maestro.log`)에 남는다. 로캘 플로에는 `clearState`를 쓰지 않는다 - 앱별 언어가 지워진다.
- 정규식이 든 값은 작은따옴표로 감싼다 - YAML 의 큰따옴표는 `\s`를 이스케이프로 읽다 죽는다.

## 돌리기

```bash
E2E_AVD=Pixel_9_API_36 ./test/e2e/run-android.sh            # 전부
E2E_FLOW="register-conflict" ./test/e2e/run-android.sh       # 일부 - 개발용
```

빌드 입력(시험·문서·스크립트를 뺀 파일)이 지난번과 같으면 APK 를 다시 만들지 않는다 - 플로만
고친 실행은 빌드 없이 돈다. Windows 에서 저장소 경로가 47자를 넘으면 `E2E_STAGE_DIR`(기본
`C:/t/e`)의 사본에서 빌드한다. 결과는 `.maestro-output/e2e/<플로>/`에 남는다.
````

```bash
pnpm exec prettier --write test/e2e test/unit/e2e
MAESTRO="$HOME/.maestro/bin/maestro"
for f in test/e2e/flows/*.yaml test/e2e/subflows/*.yaml; do MAESTRO_CLI_NO_ANALYTICS=1 "$MAESTRO" --no-ansi check-syntax "$f" >/dev/null && echo "ok $f"; done
```

Expected: `ok …` 열 줄(기기가 필요 없다). prettier가 정규식 값의 작은따옴표를 그대로 둔다(`singleQuote`).

- [ ] **Step 5: 세 백엔드의 캐시 머리글을 재고, D1이 남긴 "미측정" 자리를 기록에 잇는다**

D1 운반의 "네이티브 HTTP 캐시"다(결정 29). `expo/fetch`는 네이티브 HTTP 캐시(Android OkHttp·iOS URLCache)를 거치고, 그 캐시는 응답 머리글을 따른다. 앱은 `/users/me`를 부르지 않지만(스펙 7.4) 인증된 GET이 생기는 날과 D3의 목록·상세 신선도 확인("D2가 잰 헤더 기준")을 위해 세 백엔드가 싣는 머리글을 기록한다. 기기는 쓰지 않는다. 세 프로파일이 같은 호스트 포트를 쓰므로 하나씩 띄우고 내린다 — NestJS는 이 저장소에서 처음 띄우므로 이미지 빌드가 몇 분 걸린다(백그라운드로 돌린다).

```bash
mkdir -p .maestro-output/cache-headers
docker ps --filter name=joon- -q | wc -l
P=template-typescript-expo-e2e
API=http://127.0.0.1:${E2E_API_PORT:-4100}
compose() { docker compose -p "$P" -f docker-compose.e2e.yml "$@"; }
down() { compose --profile fastapi --profile nestjs --profile rails down -v --remove-orphans >/dev/null 2>&1 || true; }
jsonapi=(-H 'Content-Type: application/vnd.api+json' -H 'Accept: application/vnd.api+json')
for profile in fastapi nestjs rails; do
  down
  compose --profile "$profile" up -d --build --wait || { echo "== $profile: 스택을 띄우지 못했다"; continue; }
  email=$(node --input-type=module -e "import { probeEmail } from './test/e2e/probe-email.ts'; process.stdout.write(probeEmail('probe-cache', process.argv[1]))" "$profile")
  doc() { printf '{"data":{"type":"%s","attributes":{"email":"%s","password":"probe-password-value"}}}' "$1" "$email"; }
  curl -fsS "${jsonapi[@]}" -d "$(doc users)" "$API/api/v1/auth/register" >/dev/null
  token=$(curl -fsS "${jsonapi[@]}" -d "$(doc authCredentials)" "$API/api/v1/auth/login" |
    node -e "let s='';process.stdin.on('data',(d)=>{s+=d}).on('end',()=>{process.stdout.write(JSON.parse(s).data.attributes.accessToken)})")
  first=$(curl -fsS -H 'Accept: application/vnd.api+json' "$API/api/v1/examples" |
    node -e "let s='';process.stdin.on('data',(d)=>{s+=d}).on('end',()=>{process.stdout.write(String(JSON.parse(s).data[0]?.id ?? ''))})")
  targets=("users-me /api/v1/users/me" "examples /api/v1/examples")
  if [ -n "$first" ]; then targets+=("example /api/v1/examples/$first"); else echo "== $profile: 목록이 비어 상세는 재지 않았다"; fi
  for target in "${targets[@]}"; do
    name=${target%% *}; path=${target#* }
    auth=(); [ "$name" = users-me ] && auth=(-H "Authorization: Bearer $token")
    curl -sS -o /dev/null -D ".maestro-output/cache-headers/$profile-$name.txt" -H 'Accept: application/vnd.api+json' ${auth[@]+"${auth[@]}"} "$API$path"
    echo "== $profile GET $path"
    grep -iE '^(HTTP/|(cache-control|expires|etag|last-modified|vary|pragma|age):)' ".maestro-output/cache-headers/$profile-$name.txt" | tr -d '\r'
  done
done
down
docker ps --filter name=joon- -q | wc -l
docker ps --filter label=com.docker.compose.project=$P -q | wc -l
```

Expected: 앞뒤 `9`, 마지막 `0`. `== <프로파일> GET <경로>` 아홉 묶음 — 묶음마다 `HTTP/1.1 200`과 그 응답의 캐시 머리글(없으면 상태 줄만). 스택을 띄우지 못한 프로파일이 있으면 그 오류를 기록하고 나머지를 잰다 — NestJS 프로파일을 띄우는 일은 D7의 몫이라(D1 운반) 여기서 고치지 않는다.

출력을 `docs/superpowers/notes/2026-09-30-d2-measurements.md`로 남긴다. 판정은 두 갈래 중 하나다 — 응답마다 신선도 수명이 있는지 본다: `Cache-Control`의 `max-age`·`s-maxage`가 0보다 크거나, 미래의 `Expires`가 있거나, `Last-Modified`가 있는데 `no-cache`·`no-store`·`max-age=0`이 없으면(OkHttp·URLCache는 이때 수명을 추정한다) 수명이 있다.

````markdown
# D2 실측 기록 (2026-09-30)

D2(세션과 인증)를 구현하며 잰 것이다. 명령과 출력을 함께 적는다.

## H1 — 세 백엔드의 캐시 머리글

**왜 재는가.** SDK 57 의 전역 `fetch`(`expo/fetch`)는 네이티브 HTTP 캐시(Android OkHttp·iOS URLCache)를
거치고, 그 캐시는 요청의 `cache` 옵션이 아니라 응답 머리글을 따른다(D1 실측 기록 M6 의 소스 확인,
`lib/jsonapi/client.ts` 는 `cache` 를 넘기지 않는다). 앱은 `GET /users/me` 를 부르지 않는다(스펙 7.4) -
인증된 GET 을 처음 더하는 계획과 목록·상세의 신선도를 확인하는 D3 가 이 기록을 읽는다.

**명령.** D2 계획 Task 6 Step 5 의 명령이다(세 프로파일을 하나씩 띄워 가입·로그인한 뒤 `GET
/api/v1/users/me`(Bearer), `/api/v1/examples`, `/api/v1/examples/<첫 id>` 의 응답 머리글을 받았다).

**출력.**

```text
(위 명령의 "== <프로파일> GET <경로>" 줄부터 마지막 grep 줄까지를 그대로 붙인다)
```

**판정.** (아래 두 문장 중 출력에 맞는 것 하나를 그대로 쓴다)

**기기에서 재지 않은 것.** 네이티브 캐시가 이 머리글대로 저장·재검증하는지는 기기에서 재지 않았다 -
D2 앱의 요청은 전부 POST 라 네이티브 캐시가 저장하지 않는다. 앱에 GET 이 생기는 D3 가 잰다.
````

판정 문장(출력에 맞는 것 하나를 위 "판정" 자리에 그대로 쓴다):

- 모든 응답에 신선도 수명이 없을 때: `**판정.** 세 백엔드 모두 이 세 응답에 신선도 수명을 주지 않는다 - 네이티브 캐시가 저장하더라도 다음 요청은 서버에 가서 검증받는다(`ETag`가 있으면 표현이 다를 때 새 본문이 온다). 로그아웃 뒤 다른 사용자로 로그인한 앱이 앞 사용자의 응답을 받을 길이 없다.`
- 하나라도 수명이 있을 때: `**판정.** <프로파일>의 <경로>는 신선도 수명을 준다(<머리글>). 그 요청을 부르는 계획은 요청에 `Cache-Control: no-cache`를 싣거나 그 백엔드의 머리글을 고친다 - 그러기 전에는 수명 동안 앱이 서버에 묻지 않고 저장된 응답을 쓴다.` — 이 갈래면 컨트롤러에 알린다(D3의 목록·상세, 인증된 GET을 더하는 계획의 운반이다).

붙인 출력 블록의 안내 줄(괄호 줄)과 판정 자리의 괄호 줄은 지우고 실제 출력과 판정 문장으로 바꾼다.

D1이 "(미측정 - D2가 잰다)"로 남긴 다섯 자리가 위 기록을 가리키게 한다 — 네이티브 캐시의 기기 동작은 여전히 재지 않았으므로 "미측정"은 남긴다. `client.ts`의 주석도 빌드 입력이라, E2E(Step 6)가 APK를 만들기 전에 고쳐 두면 마지막 게이트가 다시 빌드하지 않는다.

`lib/jsonapi/client.ts` — Edit, 찾을 것:

```ts
    // 응답 헤더를 따른다(미측정 - D2 가 잰다). signal 은 아래에서 타임아웃과 합쳐 싣는다.
```

바꿀 것:

```ts
    // 응답 헤더를 따른다(기기에서는 미측정 - 세 백엔드가 싣는 헤더는 D2 실측 기록 H1). signal 은
    // 아래에서 타임아웃과 합쳐 싣는다.
```

`test/unit/jsonapi/client.test.ts` — Edit, 찾을 것:

```ts
    // OkHttp·iOS URLCache)는 응답 헤더를 따른다(미측정 - D2 가 잰다). URL 이 그대로인 것도 함께 잰다.
```

바꿀 것:

```ts
    // OkHttp·iOS URLCache)는 응답 헤더를 따른다(기기에서는 미측정 - 세 백엔드가 싣는 헤더는 D2 실측
    // 기록 H1). URL 이 그대로인 것도 함께 잰다.
```

`lib/jsonapi/AGENTS.md` — Edit, 찾을 것:

```markdown
  응답 헤더를 따른다(미측정 - D2가 잰다).
```

바꿀 것:

```markdown
  응답 헤더를 따른다(기기에서는 미측정 - 세 백엔드가 싣는 헤더는
  `docs/superpowers/notes/2026-09-30-d2-measurements.md`의 H1).
```

출처 기록의 `client.ts` 이탈(`cache` 를 넘기지 않는 것)의 `why` 끝 문장을 바꾸고, 두 복사본의 주석을 고친 것을 적는다:

```bash
node - <<'EOF'
const fs = require('node:fs')
const file = 'docs/provenance/copied-core.json'
const record = JSON.parse(fs.readFileSync(file, 'utf8'))
const OLD = '백엔드가 어떤 캐시 헤더를 싣는지는 재지 않았다(D2 가 잰다).'
const entry = record.divergences.find((d) => d.path === 'lib/jsonapi/client.ts' && d.why.includes(OLD))
if (!entry) throw new Error('client.ts 이탈에 그 문장이 없다 - 손으로 고친다')
entry.why = entry.why.replace(
  OLD,
  '세 백엔드가 싣는 캐시 헤더는 docs/superpowers/notes/2026-09-30-d2-measurements.md 의 H1 이 적는다 - 네이티브 캐시의 기기 동작은 재지 않았다.',
)
record.divergences.push(
  {
    path: 'lib/jsonapi/client.ts',
    what: "cache 를 넘기지 않는 자리의 주석에서 '(미측정 - D2 가 잰다)' 를 '(기기에서는 미측정 - 세 백엔드가 싣는 헤더는 D2 실측 기록 H1)' 로 바꿨다.",
    why: 'D2 가 세 백엔드의 헤더를 쟀다. 네이티브 캐시가 그 헤더대로 도는지는 앱에 GET 이 생기는 D3 가 잰다.',
  },
  {
    path: 'test/unit/jsonapi/client.test.ts',
    what: "'cache 옵션을 넘기지 않는다' 시험의 주석에서 '(미측정 - D2 가 잰다)' 를 '(기기에서는 미측정 - 세 백엔드가 싣는 헤더는 D2 실측 기록 H1)' 로 바꿨다.",
    why: '위 client.ts 이탈을 따라간다.',
  },
)
fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`)
EOF
git grep -n "D2 가 잰다\|D2가 잰다" -- lib test docs/provenance
node scripts/check-provenance.mjs
```

Expected: `git grep`이 아무것도 내지 않는다. `복사 출처 기록 통과: 경로 44개, 이탈 19건, 원본 그대로 31개`(Task 5 끝의 44·17·31에 이탈 둘).

스펙 6.2 끝(`### 6.3 출처 기록과 검사` 바로 앞 — D1의 `lib/jsonapi/client.ts` 행 정정 다음)에 더한다:

```markdown

> 정정(2026-09-30, D2): 위 정정의 "(미측정 - D2 가 잰다)" - 세 백엔드가 `GET /api/v1/users/me`·목록·상세에
> 싣는 캐시 헤더는 `docs/superpowers/notes/2026-09-30-d2-measurements.md` 의 H1 에 있다. 네이티브 캐시가 그
> 헤더대로 도는지는 기기에서 재지 않았다 - D2 앱의 요청은 전부 POST 라 저장되지 않는다. 앱에 GET 이 생기는
> D3 가 목록·상세의 신선도와 함께 잰다.
```

- [ ] **Step 6: E2E를 돌린다**

첫 실행은 짧은 경로 사본의 설치, 네이티브 빌드(5~6분), 백엔드 이미지 빌드까지 겹쳐 20분 가까이 걸릴 수 있다 — 백그라운드로 돌리고 끝나기를 기다린다(도구의 전경 제한은 10분이다).

```bash
mkdir -p .maestro-output
docker ps --filter name=joon- -q | wc -l
E2E_AVD=Pixel_9_API_36 ./test/e2e/run-android.sh > .maestro-output/e2e-run.log 2>&1; echo "e2e exit=$?"
tail -30 .maestro-output/e2e-run.log
docker ps --filter name=joon- -q | wc -l
docker ps --filter label=com.docker.compose.project=template-typescript-expo-e2e -q | wc -l
```

Expected: 앞뒤 `9`, `e2e exit=0`, 마지막 줄 `=== E2E 통과 - 플로 6개 ===`, 우리 compose 프로젝트의 컨테이너 `0`(내렸다).

실패하면 `.maestro-output/e2e/<플로>/`의 `maestro.log`·`debug/`·`logcat.txt`로 원인을 찾아 **원인을 고친다** — 플로의 제한 시간을 늘리거나 단언을 지우거나 가드를 약하게 하지 않는다(스펙 16장: 재시도 0, 흔들리면 원인을 고친다). 앱 코드(Task 5의 화면 등)를 고치면 지문이 바뀌어 다음 실행이 다시 빌드한다. 플로만 고치면 빌드하지 않는다. 한 플로만 다시 돌릴 때는 `E2E_FLOW=<이름>`을 준다. `W/ReactNativeJS` 가 걸리면 그 경고를 내는 코드를 고친다.

빌드가 Gradle의 번들 단계(`:app:createBundleReleaseJsAndAssets`)에서 0xC0000005(`-1073741819`, Git Bash에서 139)로 끝나면 D1 판정 R38이 넘긴 그 죽음이다 — 다시 돌려 덮지 않는다. 30분을 정해 원인을 가른다: `e2e-run.log`에서 실패한 명령 줄을 찾아 죽은 것이 `node …/cli export:embed`인지 `hermesc`인지 본다. `node`면 Metro 캐시(`$TMP/metro-cache` — `expo export --clear`가 지우는 자리)를 지우고 `E2E_FORCE_BUILD=1`로 한 번 빌드해 재현되는지 본다. 30분 안에 원인을 못 찾으면 멈추고 로그와 함께 컨트롤러에 넘긴다.

- [ ] **Step 7: 기기에서 가드와 설정이 실제로 도는지 확인한다**

(a) 앱이 실패 표식을 실제로 찍는다 — 선언한 상태의 줄이 기기 로그에 있고, 선언이 없는 플로에는 없다:

```bash
for pair in register-conflict:409 register-invalid:422 login-error-ko:401 login-error-en:401; do
  f=${pair%%:*}; s=${pair##*:}; echo "$f $(grep -c "\[e2e-http\] $s " ".maestro-output/e2e/$f/logcat.txt")"
done
grep -c "\[e2e-http\]" .maestro-output/e2e/guard-return/logcat.txt .maestro-output/e2e/register-restore-logout/logcat.txt
```

Expected: 네 줄 모두 1 이상, 마지막 두 파일은 `0`.

(b) 선언을 빼면 기기 로그의 가드가 걸린다(커밋하지 않는다 — 플로만 바꿔 빌드하지 않는다):

```bash
cp test/e2e/flows/register-conflict.yaml .maestro-output/register-conflict.yaml.bak
sed -i '/^# e2e-allow-http: 409$/d' test/e2e/flows/register-conflict.yaml
E2E_FLOW=register-conflict ./test/e2e/run-android.sh > .maestro-output/e2e-mutant-1.log 2>&1; echo "exit=$?"
grep "선언하지 않은 HTTP 실패" .maestro-output/e2e-mutant-1.log
cp .maestro-output/register-conflict.yaml.bak test/e2e/flows/register-conflict.yaml
cmp .maestro-output/register-conflict.yaml.bak test/e2e/flows/register-conflict.yaml && echo restored
```

Expected: `exit=1`, `플로가 선언하지 않은 HTTP 실패: 409 …`, `restored`.

(c) 영어 플로가 한글을 실제로 잡는다 — 앱별 언어를 ko-KR 로 바꾸면 실패해야 한다(커밋하지 않는다):

```bash
cp test/e2e/flows/login-error-en.yaml .maestro-output/login-error-en.yaml.bak
sed -i 's/^# e2e-app-locale: en-US$/# e2e-app-locale: ko-KR/' test/e2e/flows/login-error-en.yaml
E2E_FLOW=login-error-en ./test/e2e/run-android.sh > .maestro-output/e2e-mutant-2.log 2>&1; echo "exit=$?"
grep -n "FAILED" .maestro-output/e2e/login-error-en/maestro.log | head -3
cp .maestro-output/login-error-en.yaml.bak test/e2e/flows/login-error-en.yaml
cmp .maestro-output/login-error-en.yaml.bak test/e2e/flows/login-error-en.yaml && echo restored
```

Expected: `exit=1`, 실패한 단계가 `form-banner-message` 의 한글 단언(`… is not visible … FAILED`)이다, `restored`.

(d) 빌드된 APK가 SecureStore 백업 제외를 싣는다:

```bash
ROOT=$(test/e2e/android.sh check-path >/dev/null 2>&1 && pwd || echo "${E2E_STAGE_DIR:-C:/t/e}")
"$ANDROID_HOME/build-tools/36.0.0/aapt2" dump xmltree --file AndroidManifest.xml "$ROOT/android/app/build/outputs/apk/release/app-release.apk" | grep -E "fullBackupContent|dataExtractionRules"
```

Expected: 두 줄(`android:fullBackupContent`, `android:dataExtractionRules`).

- [ ] **Step 8: 게이트에 E2E 단계를 더한다**

```bash
git grep -n "/11\]" -- . ':!docs/superpowers' ':!pnpm-lock.yaml'
sed -i 's#\[\([0-9][0-9]*\)/11\]#[\1/12]#g' scripts/check.sh test/unit/scripts/check-citations.test.ts lib/config/AGENTS.md
grep -n "=== \[" scripts/check.sh
grep -n "\[5/1" test/unit/scripts/check-citations.test.ts
grep -n "\[8/1" lib/config/AGENTS.md
```

Expected: 첫 `git grep`이 게이트 번호가 나오는 자리를 모두 보여 준다 — `scripts/check.sh`, 인용 시험, `lib/config/AGENTS.md`, `docs/provenance/copied-core.json`(아래 node가 고친다). 그 밖의 자리가 있으면 같은 식으로 고친다(`docs/superpowers/`의 실측 기록·계획은 그날의 사실이라 고치지 않는다). 고친 뒤 `check.sh`의 단계 표기가 `[1/12]`…`[11/12]`, 시험의 주석 넷이 `[5/12]`, `lib/config/AGENTS.md`가 `[8/12]`.

`scripts/check.sh` — Edit, 찾을 것:

```bash
# 형제 템플릿들의 scripts/check.sh 와 같은 계약이다. 지금 판은 정적 단계 열하나를
# 돈다. 계약 거울과 E2E 는 그것을 재는 화면·테스트가 생길 때 더한다 - 도는 척만 하는
# 단계를 미리 두지 않는다.
```

바꿀 것:

```bash
# 형제 템플릿들의 scripts/check.sh 와 같은 계약이다. 지금 판은 정적 단계 열하나 뒤에 E2E
# (Android 에뮬레이터 + FastAPI)를 돈다. 계약 거울은 그것을 재는 테스트가 생길 때 E2E 앞에
# 더한다 - 도는 척만 하는 단계를 미리 두지 않는다.
```

Edit — 찾을 것:

```bash
#   2. Docker 가 돌고 있어야 한다 - [11] 이 쓴다.
```

바꿀 것:

```bash
#   2. Docker 가 돌고 있어야 한다 - [11]·[12] 가 쓴다.
```

Edit — 찾을 것:

```bash
#   4. [10] 이 Metro·Uniwind 캐시를 지운다(--clear) - 돌리기 전에 이 저장소의 expo start 를 끈다.
```

바꿀 것:

```bash
#   4. [10] 이 Metro·Uniwind 캐시를 지운다(--clear) - 돌리기 전에 이 저장소의 expo start 를 끈다.
#   5. [12] E2E 는 Android SDK(ANDROID_HOME), Maestro 2.11(PATH 또는 ~/.maestro/bin/maestro), 그리고
#      켜진 기기나 부팅할 AVD 이름(E2E_AVD)이 필요하다. 빠진 것이 있으면 무엇이 빠졌는지 알리고
#      멈춘다. Windows 에서 저장소 경로가 47자를 넘으면 짧은 경로(E2E_STAGE_DIR, 기본 C:/t/e)의
#      사본에서 APK 를 만든다 - test/e2e/run-android.sh 머리말.
```

Edit — 찾을 것:

```bash
echo "=== 전부 통과 ==="
```

바꿀 것:

```bash
# 인증 흐름을 실제 기기와 실제 백엔드로 잰다(스펙 11.3). 이 저장소의 compose 프로젝트만 띄우고
# 내린다. E2E_FLOW 로 일부만 도는 것은 개발용이다 - 게이트는 언제나 전부 돈다.
echo "=== [12/12] E2E ==="
env -u E2E_FLOW ./test/e2e/run-android.sh

echo "=== 전부 통과 ==="
```

(위 "찾을 것"은 D1 끝 `1312848`의 `check.sh`에서 옮겼다. 글자가 다르면 뜻을 지켜 같은 자리를 고친다.)

출처 기록의 `note`와 인용 시험 이탈에서 단계 번호를 맞춘다:

```bash
node - <<'EOF'
const fs = require('node:fs')
const file = 'docs/provenance/copied-core.json'
const record = JSON.parse(fs.readFileSync(file, 'utf8'))
const entry = record.divergences.find((d) => d.path === 'test/unit/scripts/check-citations.test.ts')
const what = entry.what.replace('[5/11]', '[5/12]')
if (what === entry.what) throw new Error('이탈 기록에 [5/11] 이 없다 - 손으로 고친다')
entry.what = what
// note 는 원본 스크립트 머리말의 [5/9] 가 이 저장소의 몇 번인지 적는다 - 있으면 같이 고친다.
record.note = record.note.replace('[5/11]', '[5/12]')
fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`)
EOF
git grep -n "/11\]" -- . ':!docs/superpowers' ':!pnpm-lock.yaml'
node scripts/check-provenance.mjs
pnpm exec vitest run test/unit/scripts/check-citations.test.ts
```

Expected: 마지막 `git grep`이 아무것도 내지 않는다. 출처 기록 통과, 인용 시험 통과.

- [ ] **Step 9: 문서와 스펙 정정을 쓴다**

루트 `AGENTS.md`의 `## 검증 명령` 절을 고친다.
- 게이트 문장의 단계 목록 `(… · 번들 · compose)` 끝에 ` · E2E`를 더하고, 전제 조건 `(Docker, 네트워크)`를 `(Docker, 네트워크, Android SDK·Maestro·에뮬레이터)`로 바꾼다.
- 실행 권한 문장의 `` `git ls-tree HEAD scripts/ test/e2e/android.sh`에서 `scripts/check.sh`·`scripts/check-citations.sh`·`test/e2e/android.sh` 셋이 `100755`인지 `` 를 `` `git ls-tree HEAD scripts/ test/e2e/`에서 `scripts/check.sh`·`scripts/check-citations.sh`·`test/e2e/android.sh`·`test/e2e/run-android.sh`·`test/e2e/guard-log.sh` 다섯이 `100755`인지 `` 로 바꾼다.
- 그 문단 끝에 한 문장을 더한다: `` E2E 플로를 쓰는 규칙과 하네스의 환경 변수는 `test/e2e/AGENTS.md`에 있다. ``
- 절 끝의 실측 기록 문단(`` 실측 기록은 `docs/superpowers/notes/2026-09-30-d1-measurements.md`다. … ``) 끝에 한 문장을 더한다: `` 세 백엔드가 싣는 캐시 머리글(D2 실측 H1)은 `docs/superpowers/notes/2026-09-30-d2-measurements.md`에 있다. ``

(D1이 남긴 문장이 위와 글자가 다르면 같은 뜻으로 고친다.)

스펙 12장 끝(`## 13. CI` 바로 앞 — D1의 "Windows 개발 머신에서 13단계의 e2e APK 빌드는 …" 정정 다음)에 더한다:

```markdown

> 정정(2026-09-30, D2): 지금의 게이트는 12단계다 - 정적 단계 열하나 뒤에 E2E 가 `[12/12]` 로 돈다. 계약
> 거울(위 12단계)은 그것을 재는 테스트가 생기는 D5 가 E2E 앞에 더하고, 그때 E2E 는 `[13/13]` 이 된다.
> E2E 단계는 `test/e2e/run-android.sh` 하나다. 빌드 입력(시험·문서·스크립트를 뺀 파일 내용과 앱이 볼
> `BACKEND_URL`)의 지문이 지난번과 같으면 APK 를 다시 만들지 않는다. 플로가 일부러 일으키는 2xx 밖의
> 상태와 앱별 언어는 플로 파일 머리말 주석(`# e2e-allow-http:`·`# e2e-app-locale:`)으로 선언한다(11.3의
> "플로가 선언하지 않은 4xx·5xx"). 가드는 `test/e2e/guard-log.sh` 이고 단위 시험이 그것을 실제로 돌려 잰다.
> 위 D1 정정의 마지막 문장(`test/e2e/android.sh` 는 경로 길이를 검사하지 않는다)은 더는 맞지 않는다 -
> `test/e2e/android.sh build` 는 Windows 에서 저장소 경로가 47자를 넘으면 빌드 전에 멈추고(`check-path`),
> `test/e2e/run-android.sh` 가 커밋 대상 파일(무시되지 않은 미추적 파일 포함)을 짧은 경로(`E2E_STAGE_DIR`,
> 기본 `C:/t/e`)에 복사해 거기서 빌드한다. 사본의 `node_modules` 는 남겨 두어 다음 설치가 몇 초로 끝난다.
> 하네스가 만든 표식(`.e2e-stage`)이 없는 비어 있지 않은 디렉터리는 지우지 않는다. 그래서 Windows 에서도
> 저장소를 옮기지 않고 E2E 까지 돈다.
```

스펙 16장 끝(`## 17. 완료 조건` 바로 앞 — D1의 Uniwind 정정 다음)에 더한다:

```markdown

> 정정(2026-09-30, D2): 위 "Windows 에서 Android 네이티브 빌드 … 47자" 정정의 마지막 문장(`test/e2e/android.sh`
> 는 경로 길이를 검사하지 않는다)은 더는 맞지 않는다 - E2E 하네스가 짧은 경로의 사본에서 빌드한다(12장의
> D2 정정).
```

- [ ] **Step 10: 게이트 전체를 돌린다**

E2E가 빌드 없이 돌아야 한다(지문이 Step 6의 마지막 빌드와 같다 — 그 뒤로는 시험·문서·스크립트만 바뀌었다). 역시 10분을 넘길 수 있다 — 백그라운드로 돌린다. 이 저장소의 `expo start`를 끄고 돈다(`[10]`이 `--clear`).

```bash
pnpm format
docker ps --filter name=joon- -q | wc -l
E2E_AVD=Pixel_9_API_36 ./scripts/check.sh > .maestro-output/gate.log 2>&1; echo "gate exit=$?"
grep -E "^=== |APK 를 다시 만들지 않는다|E2E 통과" .maestro-output/gate.log
docker ps --filter name=joon- -q | wc -l
```

Expected: 앞뒤 `9`, `gate exit=0`, `=== [1/12] …`부터 `=== [12/12] E2E ===`, `빌드 입력이 지난번과 같다 - APK 를 다시 만들지 않는다`, `=== E2E 통과 - 플로 6개 ===`, `=== 전부 통과 ===`. 빌드가 다시 일어나면 Step 6 뒤에 빌드 입력(앱 코드·설정)이 바뀐 것이다 — 무엇이 바뀌었는지 `git status`로 보고, 의도한 변경이면 그 빌드로 E2E가 통과해야 한다. `[10/12]`이 139로 끝나면 재시도로 덮지 않는다 — `expo start`가 켜져 있지 않은지 보고, 그래도 죽으면 Global Constraints대로 원인을 찾는다.

- [ ] **Step 11: 실행 권한을 싣고 커밋한다**

```bash
git add test/e2e test/unit/e2e/guard-log.test.ts scripts/check.sh test/unit/scripts/check-citations.test.ts lib/config/AGENTS.md docs/provenance/copied-core.json AGENTS.md lib/jsonapi/AGENTS.md lib/jsonapi/client.ts test/unit/jsonapi/client.test.ts docs/superpowers/specs docs/superpowers/notes/2026-09-30-d2-measurements.md
git update-index --chmod=+x test/e2e/run-android.sh test/e2e/guard-log.sh test/e2e/android.sh
git status --short
git commit -m "feat: 인증 E2E 플로 여섯과 하네스를 더하고 게이트의 마지막 단계로 붙인다"
git ls-tree HEAD scripts/ test/e2e/ | grep -E "\.sh$"
```

Expected: `scripts/check.sh`·`scripts/check-citations.sh`·`test/e2e/android.sh`·`test/e2e/guard-log.sh`·`test/e2e/run-android.sh`가 모두 `100755`.

---

## 이 계획이 끝났을 때의 상태

- 게이트가 D1보다 더 잰다 — `lib/`는 위 계층과 `@react-navigation/*`를 import하지 못하고, 저장소 어디서든 선언하지 않은 패키지를 import하지 못한다. 출처 검사는 원본 그대로인 사본 31개의 내용을 원본 blob과 맞대고, 드라이브 문자 경로를 거절한다.
- 시작 설정의 판단은 `lib/config/startup.ts`에 있고 실패 경로가 단위 시험으로 고정돼 있다. 루트 레이아웃은 설정이 맞을 때만 스플래시를 잡고 세션을 되살리며, 요청으로 이어지는 훅은 `STARTUP.ok` 갈래의 자식에 있다.
- 세션은 SecureStore 항목 하나(JSON)에 산다. 앱은 켜질 때 스플래시 아래에서 그것을 되살리고, 형식이 깨졌거나 refresh가 만료됐으면 지우고 로그아웃 상태로 시작한다.
- 회전은 `lib/auth/session-manager.ts` 한 곳에서, 한 번에 하나만 돈다. 동시 호출·저장 순서·거절·닿지 못함·회전 중 로그아웃이 단위 시험으로 고정돼 있다.
- 모든 백엔드 요청은 `platform/api.ts`의 `apiRequest`를 지나고, Accept-Language는 거기서만 실린다. e2e 변형은 2xx가 아닌 결과를 기기 로그에 표식으로 남긴다.
- 가입·로그인·로그아웃 화면, 헤더의 로그아웃 버튼, 보호 경로 가드(`/examples/new`·`/examples/[id]/edit` → `/login?next=…`)가 있다.
- `./scripts/check.sh`가 12단계를 통과한다. E2E는 Android 에뮬레이터 + FastAPI에서 플로 여섯(가입·세션 복원·로그아웃·다른 사용자로 다시 가입, 보호 경로 복귀, 409 배너, 422 필드 오류, 한국어·영어 오류)을 돌리고, 선언하지 않은 4xx·5xx와 JS 경고·오류를 실패로 만든다.
- 세 백엔드가 `/users/me`·목록·상세에 싣는 캐시 머리글이 D2 실측 기록 H1에 있다.
- Windows에서도 게이트가 돈다 — 저장소 경로가 길면 하네스가 짧은 경로의 사본에서 빌드하고, 빌드 입력이 같으면 APK를 다시 만들지 않는다.

## 다음 계획

D3(목록·상세)는 이 계획의 결과 위에서 쓴다. 특히:

- **R18(Uniwind `sm:`)을 정한다.** D2 화면의 버튼·입력도 폰에서 36dp로 그려진다.
- `platform/query-client.ts`에 AppState→`focusManager`, NetInfo→`onlineManager`를 붙인다(스펙 8.5, 결정 7). `queries/`에 캐시 키와 무효화 표를 순수 함수로 둔다 — 로그아웃의 "캐시 전체 비움"(지금 `useLogoutMutation`의 `removeQueries()`)도 그 표로 옮긴다.
- 조회 화면의 플로는 `test/e2e/flows/`에 더한다. 머리말 선언과 testID 규칙은 `test/e2e/AGENTS.md`.
- 목록·상세의 신선도를 네이티브 HTTP 캐시와 함께 잰다 — 근거는 D2 실측 기록 H1의 머리글이다. 앱의 첫 GET이 생기므로 "네이티브 캐시가 머리글대로 도는가"를 기기에서 처음 잴 수 있다.
- 조회에 TanStack Query 취소(signal)를 붙이면 `client.ts`의 타이머 가드(호출자가 이미 끊었으면 `timedOut`을 세우지 않는다)를 더한다(결정 31).
- D1 운반 기록의 D3 절(`components.json`의 hooks 별칭, `platform/theme.ts`의 색, 소음 셋)은 그대로 D3의 몫이다.

D4(쓰기)가 넘겨받는 것:

- `app/(app)/examples/new.tsx`의 자리를 폼으로 채운다(결정 3). `[id]/edit`도 보호 경로 목록에 이미 있다.
- 쓰기 가드(스펙 7.3 둘째 겹): 쓰기 훅이 `sessionManager.getAccessToken()`으로 토큰을 얻고, `null`이면 요청하지 않고 `loginHref(현재 경로)`로 보낸다.
- 인증 오류 처리(스펙 9.2): `QueryCache`·`MutationCache`의 `onError` 한 곳에서 `actionForErrors(...) === 'destroySession'`이면 `sessionManager.signOut()` 뒤 `loginHref(현재 경로)`로 보낸다(결정 4).
- 실제 회전 왕복은 D4의 쓰기 E2E가 처음 지난다(결정 5).

D5(계약 실험실·거울)는 게이트의 계약 거울 단계를 E2E 앞에 더하며 번호를 `[N/13]`으로 바꾼다(결정 13). 인용 시험의 주석 번호와 출처 기록의 이탈 문장도 함께 바꾼다.
