# 문서군·게이트 전체 통과·게시 구현 계획 (D8 — 단계 8, v4 · 2026-10-02)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 스펙 17장의 남은 완료 조건(1 - 로컬 게이트가 Windows 에서 통과, 5 - README 와 계층별 `AGENTS.md` 가 실제 파일과 일치)을 닫는다 - D4–D7 이 넘긴 마지막 코드 셋(개발 클라이언트, 루트 오류 경계의 "다시 시도" 가 조회 캐시를 비우는 것, 네트워크 복귀 판정의 lib 이동)을 끝내고, 템플릿 사용자를 위한 README 와 계층 문서군을 갖추고, 문서군이 파일과 맞는지 게이트가 매번 재게 하고, Windows 게이트 전체(13단계)와 GitHub 의 CI 매트릭스(논리 아홉 칸·물리 12잡)를 마지막으로 초록으로 만든다.

**Architecture:** CI 최적화(Task 0)가 먼저이며 Android ABI·iOS 두 shard·네이티브 캐시를 따로 커밋한다. 코드 마감(Task 1)이 뒤따른다 - 문서가 끝난 코드를 적어야 한다. 개발 클라이언트를 실을 변형은 변형 표(`lib/config/app-variant.ts`)의 새 칸이 정하고 게이트 [8] 의 검사기가 같은 칸으로 introspect 를 잰다. 루트 레이아웃의 `ErrorBoundary` 는 Expo Router 의 기본 화면을 그대로 그리되 "Retry" 앞에 조회 캐시를 비운다(`queries/error-boundary.ts`). 문서군(Task 2)은 게이트 [7] 의 새 단위 시험(`test/unit/docs/doc-set.test.ts`)이 지킨다 - README 와 모든 `AGENTS.md` 가 인용한 경로가 있는지, 각 `AGENTS.md` 가 자기 디렉터리의 바로 아래 항목을 모두 부르는지, 스펙 14장의 문서가 있는지, 환경 변수 표가 세 곳에서 같은지. 그 시험이 곧 문서 감사의 도구다 - 처음 돌린 출력이 고칠 목록이다. 로컬 기기는 마지막 태스크(Task 3)에 모이고, GitHub는 Task 0의 cold/warm 측정과 Task 3의 최종 통과에 쓴다 - 게이트 한 번(APK 한 번)과 `feat/d8-docs-and-release` 의 push 로 도는 CI.

**Tech Stack:** Expo SDK 57 (`expo` ~57.0.26 · `react-native` 0.86.3 · `expo-dev-client` ~57.0.19) · Expo Router 57.0.24(루트 레이아웃의 `ErrorBoundary`, 묶인 react-navigation core) · `@tanstack/react-query` 5.104.0 · vitest 5.0.2 · Prettier 3.9.6(마크다운 표) · Maestro 2.11.0 · GitHub Actions(D7 의 `ci.yml`) · `gh`(읽기·실행 보기)

**Spec:** `docs/superpowers/specs/2026-09-30-expo-jsonapi-template-design.md` — 15장 단계 8(문서군, 게이트 전체 통과, GitHub 저장소 생성·푸시 - 공개 범위는 사용자 확인). 근거 절: 1.2(Expo Go 대신 development build - `expo-dev-client`), 5장(계층 소유 - `platform/` 에 판단을 두지 않는다), 7.3(가드가 보낸 로그인 화면 - D4 의 "홈으로"), 7.5(알고 넘어가는 한계), 8.1(화면), 8.5(네트워크 복귀 재조회, 화면 조회의 `gcTime`), 9.3(렌더 중 예외는 `ErrorBoundary` - D4 정정 (b) 가 넘긴 출구·다시 시도), 10.1(환경 변수의 세 곳 - `app.config.ts`·`.env.example`·README 표), 10.2·10.3(변형별 scheme, 앱 식별자 바꾸기가 README 의 첫 단계), 10.5·10.6(EAS·OTA), 12장(게이트 13단계), 13장(CI), 14장(문서군 - README·루트와 계층별 `AGENTS.md`, 새 자원 추가 절차는 루트가 갖는다), 16장(리스크), 17장(완료 조건 1–5), 그리고 날짜 붙은 정정 전부. 이어받는 항목의 정본은 D7 최종 코드 `2599bf2`와 계획(`docs/superpowers/plans/2026-10-01-d7-ci.md`)의 "다음 계획(D8)에 넘기는 것" 열 가지·D7 최종 리뷰의 D8/D9 이월·2026-10-02 컨트롤러 지시, D6 계획의 결정 3·"다음 계획" 의 D8 절, 스펙 9.3 의 D4 정정 (b), D4 실측 기록(`docs/superpowers/notes/2026-10-01-d4-measurements.md` 의 W1–W4), `docs/superpowers/notes/2026-09-30-d1-carry-forward.md`·`2026-10-01-d2-carry-forward.md`(D8 절은 없다 - D2 의 D4 절 M5 는 D4 의 "홈으로" 가 닫았다)다. 형제 저장소 `../template-typescript-nextjs` 의 README(최종판, `34d0b10`)와 계층 문서군(`2617897 docs: add hierarchical agent guides`)을 모양의 참고로 읽었다.

## Global Constraints

- **이 계획이 더하는 의존성은 `expo-dev-client` 하나다** - `BACKEND_URL=https://gate-check.invalid pnpm exec expo install expo-dev-client`(`bundledNativeModules.json` 의 `~57.0.19`). SDK 밖의 패키지를 더하지 않는다.
- **`app.config.ts`를 평가하는 모든 명령(`expo config`·`expo export`·`expo prebuild`·`pnpm types:routes`·`expo-doctor`·`expo install`)에는 `BACKEND_URL`을 준다** - 백엔드에 닿지 않는 명령은 `https://gate-check.invalid` 다(스펙 10.1). Expo CLI 는 `.env` 를 읽는다 - 설정 값을 재는 명령은 `EAS_PROJECT_ID`·`EAS_BUILD_PROJECT_ID` 를 빈 값으로라도 명시한다(D6 결정 12).
- **`app.config.ts`·`lib/config/*.ts` 는 Node 의 type stripping 으로 돈다**(D1 실측 M7 - `scripts/check-variant-config.mjs` 도 그렇게 불러온다). 타입만 지우면 도는 구문만 쓰고(`enum`·값 있는 `namespace`·매개변수 프로퍼티 금지, 타입은 `import type`), 서로 import 할 때 `.ts` 확장자를 붙인다.
- **Node `>=24.11.0`, `packageManager: "pnpm@11.22.0"`**, `nodeLinker: hoisted`.
- **TypeScript strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`.** 선택 속성에 `undefined` 를 명시해 넘기지 않는다 - 키를 빼거나 펼침(`...(조건 ? {} : { 키 })`)으로 만든다.
- **`lib/**`에서 `react`·`react-native`·`expo`·`expo-*`·`@expo/*`·`@react-native*`·`@react-navigation/*`·`@tanstack/*`·`uniwind` 등을 import하면 위반이다**(스펙 5장, ESLint 가 막는다). 위 계층(`platform/`·`queries/`·`components/`·`app/`)을 import 해도 막힌다. 이 계획의 lib 코드는 `lib/jsonapi/online.ts` 의 식 하나와 변형 표의 칸 하나다. 조회 캐시를 다루는 함수(`queries/error-boundary.ts`)는 `queries/` 에 둔다 - `@tanstack/react-query` 를 import 할 수 있는 계층이다.
- **어떤 모듈도 최상위에서 `getSettings()`를 부르지 않는다.**
- **`app/`에는 라우트 파일만 둔다** - 화면 조각은 `components/`, 판단은 `lib/`. `app/AGENTS.md` 는 라우트가 아니다(설치본 expo-router 의 `require.context` 는 `.[tj]sx?` 만 고른다 - 사실 절). 루트 레이아웃이 내보내는 `ErrorBoundary` 는 Expo Router 가 읽는 이름이라 그 파일에 둔다.
- **로딩 상태에 텍스트를 쓰지 않는다**(스펙 8.7). **`app/`·`components/` 에 `@media` 로 컴파일되는 변형을 쓰지 않는다**(`test/unit/ui/breakpoints.test.ts`). 이 계획은 새 컴포넌트를 만들지 않는다 - 오류 경계의 화면은 Expo Router 의 기본 그대로다.
- **복사본의 예외는 컨트롤러가 지정한 check-citations 시험의 Bash 공통화 한 건이다.** 이미 이탈로 기록된 `test/unit/scripts/check-citations.test.ts`의 기존 provenance 행에 설명을 더한다. sourceBlobs 항목은 이미 없으며 경로54·이탈기록42·원본그대로33은 유지한다. 나머지 복사본은 고치지 않는다.
- **사라질 자리를 인용하지 않는다.** 선행 점이 붙은 `.superpowers/`, `superpowers/sdd`, 세션의 태스크 보고·리뷰 파일, 세션 작업 공간을 가리키지 않는다. 새 `AGENTS.md` 가운데 `app/`·`components/`·`lib/`·`test/` 아래의 것은 게이트 [5] 가 훑는다. `docs/`·`scripts/`·루트의 문서는 훑지 않지만 같은 규칙을 지킨다. 임시 명령·출력은 git 이 무시하는 `.maestro-output/` 에 둔다.
- **계정 이름이 든 절대 경로를 저장소에 남기지 않는다.**
- **ESLint 타입 규칙이 잡는 것:** `async` 함수에는 `await`(`require-await`), 쓰지 않는 `catch` 변수는 `catch {`, 떠 있는 Promise 는 `void`·`.catch`, 필요 없는 타입 단언 금지(`no-unnecessary-type-assertion`).
- **한 파일만 도는 시험은 `pnpm exec vitest run <파일>`** 이다 - pnpm 11 은 `pnpm test -- <파일>` 에 `--` 를 넘겨 전부 돈다.
- **게이트는 Git Bash 에서 `./scripts/check.sh`** 로 돈다(`pnpm check` 는 Windows 의 cmd.exe 가 `./` 를 못 찾는다). 정적 단계만은 `./scripts/check.sh --static` 이다.
- **`expo export` 는 언제나 `--clear`** 로 돌린다. 0xC0000005(139)로 죽으면 다시 돌려 덮지 않는다 - 원인을 찾는다(스펙 16장: 재시도 0). Gradle 의 Metro 단계가 그렇게 죽으면 30분을 정해 원인을 가르고, 못 찾으면 멈추고 기록과 함께 컨트롤러에 넘긴다. E2E 하네스는 APK 를 만들기 전에 Metro 캐시를 비우고 Gradle 을 `--no-daemon` 으로 돌린다(D4 실측 W1 - 남은 데몬이 짧은 경로 사본의 dex 파일을 쥐었다) - 이 계획은 그 레시피를 바꾸지 않는다.
- **Expo 계정이 필요한 명령(`eas *`)을 돌리지 않는다**(스펙 10.7) - README 가 그 명령을 설명하지만 이 계획은 부르지 않는다. 실계정 실증은 15장 9단계(사용자 승인 뒤)다.
- **개발 머신의 `joon-*` 컨테이너 9개를 절대 멈추지 않는다.** compose 명령은 모두 `-p template-typescript-expo-e2e`(하네스가 준다)이고 그 프로젝트만 내린다. Docker 를 건드리는 단계는 앞뒤로 `docker ps --filter name=joon- -q | wc -l` 이 `9` 인지 본다. 같은 머신의 다른 `fastapi-*` 컨테이너도 건드리지 않는다.
- **Windows 의 Android 네이티브 빌드는 저장소 루트가 실제 디렉터리 경로 47자 이하일 때만 된다**(D1 실측 M1) - E2E 하네스가 짧은 경로(`E2E_STAGE_DIR`, 기본 `C:/t/e`)의 사본에서 빌드한다.
- **Maestro 플로 규칙:** 요소는 testID(`id:`)로 찾는다. `launchApp` 뒤에는 화면 요소를 기다린 다음 이동한다. `hideKeyboard` 를 쓰지 않는다. 뒤로 가기는 `subflows/back.yaml`·`subflows/android-back.yaml` 로만, 시트는 배경(`sheet-backdrop`)을 눌러 닫는다(D7 - `test/unit/e2e/flows.test.ts` 가 잰다). 이 계획은 플로를 고치지 않는다.
- **E2E 가드(`test/e2e/guard-log.sh`):** 머리말 `# e2e-allow-http:` 의 상태는 한 번 이상 나와야 하고 적지 않은 상태는 나오면 실패, `W/`·`E/ReactNativeJS` 줄은 실패다. 재시도는 0 이다.
- **셸 heredoc 에 역슬래시가 든 코드를 넣지 않는다.** 코드·문서 파일은 Write 도구로 쓰고, 찾아 바꾸기는 Edit 도구로 한다. 대화형 명령과 감시 모드(`expo start`·vitest 의 watch)는 쓰지 않는다. 걸릴 수 있는 명령은 `timeout` 으로 감싸고(`pnpm` 의 검사들은 `timeout 300`), 10분을 넘길 명령(정적 게이트·게이트 전체·CI 기다리기)은 백그라운드로 돌려 끝나기를 기다린다. git 명령에는 `GIT_TERMINAL_PROMPT=0 GIT_PAGER=cat` 을 준다.
- **새 `.sh` 를 더하지 않는다** - 실행 진입점 `.sh` 열은 `100755`, source 전용 `test/e2e/ios-simulator.sh` 하나는 `100644`다. 총 `.sh`는 11개다(`git ls-tree -r HEAD scripts/ test/e2e/ test/contract/`).
- **문서는 한국어다.** README 는 템플릿 사용자에게 합니다체로, `AGENTS.md` 는 기존 문서처럼 한다체로 쓴다. 마크다운 표는 쓴 뒤 `pnpm exec prettier --write <파일>` 로 줄을 맞춘다(Prettier 는 표의 칸 폭만 고친다 - 이 계획의 새 문서 본문은 이미 그렇게 맞춘 판이고, 기존 표에 행을 더하는 Edit 는 Prettier 가 칸 폭을 다시 맞춘다).
- **커밋 메시지는 한국어**(`feat:`·`fix:`·`test:`·`docs:`·`chore:`·`ci:`). `Co-Authored-By: Claude ...` 등 **AI 관련 태그를 넣지 않는다** - 사용자의 전역 `CLAUDE.md` 가 금지한다. PR 본문에도 AI 생성 표시를 넣지 않는다.
- **작업 브랜치는 `feat/d8-docs-and-release`** 다. 컨트롤러가 D7 이 병합 커밋으로 병합된 `main` 에서 만들고, 이 계획을 첫 커밋으로 `docs/superpowers/plans/2026-10-01-d8-docs-and-release.md` 에 넣는다(D4–D7 과 같다). Task 1 Step 1 은 확인만 한다.
- **끝난 D-계획은 컨트롤러가 `main` 에 병합 커밋으로 병합해 push 한다**(사용자의 상시 결정). 태스크는 이 브랜치에 커밋하고(Task 3 은 이 브랜치를 push 한다) `main` 을 건드리지 않는다.
- **GitHub 에 보내는 일은 Task 0의 측정과 Task 3의 최종 검증에서 한다** - `feat/d8-docs-and-release` 의 push(D7 Task 4 에서 사용자가 승인한 범위와 같다 - 컨트롤러가 Task 3 전에 그 승인이 이 계획에도 닿는지 확인한다). PR 을 열지 않고, force push 하지 않고, 저장소 설정·다른 저장소(백엔드 저장소의 이슈 포함)를 건드리지 않는다. 실패한 잡을 코드 변경 없이 다시 돌리지 않는다(`gh run rerun` 금지 - 러너 할당 실패처럼 잡이 시작도 못 한 경우만 예외이고, 그때도 기록에 적는다). 실행은 네 번이 상한이다(결정 20). 태그·릴리스를 만들지 않는다(결정 21).
- **기기 작업(Docker·에뮬레이터·Maestro)은 Task 3 의 게이트 한 번에서만 한다.** APK 는 그 게이트가 한 번 만든다(빌드 입력이 바뀌었다 - 의존성·앱 코드). Task 1·2 는 정적 검사·단위 시험·설정 평가·번들까지다. Task 0의 기기/빌드는 CI 측정으로만 한다.

- **기기 게이트는 알려진 상태에서 혼자 돈다**(D5 실측 C2). 이 저장소의 Metro를 끄고, 이 게이트가 소유한 에뮬레이터를 새로 부팅한 뒤 다른 무거운 작업(시험·타입 검사·번들·Gradle·Maestro)이 끝난 상태에서 시작한다. 다른 기기/에이전트 작업을 임의 종료하지 않는다. adb 서버 재시작은 다른 사용 기기가 없고 컨트롤러가 시간을 비운 경우에만 수동으로 한다. 하네스가 자동으로 adb 서버를 재시작하지 않는다.
- **코드·문서에 새 Unicode escape를 적지 않는다**(D5 도구 기록). 한국어와 `…`는 UTF-8 글자로 쓴다. escape가 꼭 필요한 기존 구문은 Git blob의 실제 글자를 확인한다.
- **CI 최적화는 범위를 줄이지 않는다.** 세 백엔드 × Android/iOS, Android 23플로·iOS 21플로, 플랫폼별 request-stall, 계약 거울 94개/백엔드, 재시도 0·현재 단언/timeout을 보존한다. iOS는 두 shard의 합집합으로 한 논리 셀을 판정하고 물리12잡 모두 초록을 요구한다. 측정 실행과 최종 실행은 합쳐 넷이 상한이다.

---

## 결정 기록

스펙이 정하지 않았거나 두 갈래로 읽히는 자리를 스펙에 비추어 정했다. 사용자에게 묻지 않았다. 형식은 `결정: 무엇 — 왜 — 틀렸을 때의 비용`이다.

1. 결정: Task 0(CI 최적화·cold/warm 측정) → Task 1(코드 마감) → Task 2(문서군) → Task 3(Windows 전체·최종 CI). 사용자의 2026-10-02 추가 요청이 앞 판의 태스크 셋 이하 결정을 확장한다 — 문서가 최종 하네스와 CI를 적도록 하고 뒤의 push 비용을 먼저 줄인다 — 틀리면 해당 최적화 커밋만 되돌린다.
2. 결정: `expo-dev-client` 를 설치한다(D6 결정 3 이 D8 에 넘긴 조리법) — 스펙 1.2("개발은 development build(`expo-dev-client`) 기준이다")와 10.5(`development` 프로필의 `developmentClient`). 없으면 `eas build --profile development` 가 설치를 묻고, 비대화형이면 "Install expo-dev-client manually" 로 멈춘다(D6 사실 절). 템플릿 사용자의 첫 개발 빌드가 막히는 자리를 문서로 넘기지 않는다 — 틀리면(설치가 E2E·CI 를 흔들면) 의존성 하나·표의 칸 하나·플러그인 한 줄을 되돌리고 README 와 알려진 한계에 "development 프로필은 `expo install expo-dev-client` 뒤에 쓴다" 를 적는다.
3. 결정: 개발 클라이언트의 scheme(`exp+<slug>`)을 실을 변형은 변형 표의 새 칸 `devClientScheme`(development 만 `true`)이 정한다. `app.config.ts` 가 `['expo-dev-client', { addGeneratedScheme: profile.devClientScheme }]` 로 옮기고, 게이트 [8] 의 검사기가 같은 칸에서 기대값을 만든다 — 그 설정 플러그인은 기본으로 **모든 변형**에 같은 scheme 을 더해 스펙 10.2 의 D1 정정(변형마다 다른 scheme)을 깬다. 변형 규칙의 정본은 `lib/config/` 다 - `variant === 'development'` 를 두 곳에 적으면 둘이 갈린다 — 틀리면 칸 하나.
4. 결정: `app.config.ts` 가 `SLUG` 와 `DEV_CLIENT_SCHEME` 을 내보낸다. `DEV_CLIENT_SCHEME` 은 그 플러그인의 `getDefaultScheme` 규칙(URI scheme 에 못 쓰는 글자를 빼고 소문자, 앞에 `exp+`)을 그대로 옮긴 식이다 — 검사기가 기대값을 만들 자리가 필요하고(`BASE_*` 와 같은 자리), slug 를 바꾸면 scheme 도 따라 바뀐다. 규칙이 갈리면 게이트 [8] 이 실제 introspect 값과 맞대어 잡는다 — 틀리면 상수 하나.
5. 결정: 검사기의 scheme 비교는 순서까지 본다(D6 의 모양 그대로) - 설정 플러그인은 변형의 scheme 뒤에 더한다(Android 는 같은 intent filter 의 `data` 끝, iOS 는 `CFBundleURLTypes` 의 새 항목 - introspect 로 쟀다, 사실 절) — 순서를 버리면 비교가 느슨해질 뿐 얻는 것이 없다 — 틀리면(Expo 가 순서를 바꾸면) 게이트 [8] 이 그 자리를 알린다 - 기대 순서 한 줄.
6. 결정: iOS 에서 가드가 보낸 로그인·가입 화면의 출구(D7 다음 계획 4, D2 최종 검토 M5)에 D8 은 코드를 더하지 않는다 - D4 가 머리글의 "홈으로"(`components/app/home-button.tsx`, testID `back-to-home-button`, 머리글이 넘긴 `canGoBack` 이 참이 아닐 때만)로 닫았고, D7 의 `examples-create`(iOS 갈래)·`examples-delete`(두 플랫폼)가 그 버튼을 누른다. README·`app/AGENTS.md`·`components/app/AGENTS.md` 가 그 버튼을 적는다 — 같은 출구를 둘 두면 머리글에 버튼이 둘 생기고 플로의 testID 가 갈린다 — 틀리면(D7 의 iOS 칸이 그 버튼에서 빨갰다면) Task 3 Step 6 (b) 의 갈래.
7. 결정: 루트 오류 경계의 "Retry" 는 경계를 풀기 전에 조회 캐시를 비운다 - `queries/error-boundary.ts` 의 `retryWithClearedQueries(client, retry)`(`removeQueries()` 뒤 `retry()`)를 루트 레이아웃의 `ErrorBoundary` 가 부르고, 화면은 Expo Router 의 기본(`ErrorBoundary as RouterErrorBoundary`)을 그대로 그린다 — 스펙 9.3 의 D4 정정 (b) 가 넘긴 자리다: 결과 값으로 캐시에 든 결함(문구 없는 오류 문서·본문 없는 성공 응답)은 구독자 없이 `gcTime`(`SCREEN_QUERY_GC_TIME` 30분) 동안 남아, "Retry" 뒤 같은 화면에 다시 들어가면 요청 없이 같은 결함을 다시 던졌다. 조회 캐시만 비운다 - 로그아웃과 같은 범위이고(`queries/AGENTS.md`), 쓰기의 상태는 훅을 쥔 컴포넌트가 다시 그려지며 새로 시작한다. 시험은 실제 `QueryClient` 와 화면 조회의 옵션(`detailQueryOptions`)으로 세 가지를 잰다 - 비우지 않으면 다시 그린 첫 렌더가 캐시의 결함을 읽는다, 경계를 풀기 전에 비운다, 쓰기 캐시는 둔다 — 틀리면(다른 캐시도 비워야 하면) 함수 한 줄과 시험 하나.
8. 결정: 루트 오류 경계에 "홈으로" 같은 출구를 따로 두지 않는다 — 이 경계는 루트 레이아웃 전체를 바꿔 그려(설치본 expo-router 의 `fromImport` 가 레이아웃의 기본 내보내기를 `Try` 로 감싼다) 떠 있는 동안 루트 내비게이터가 없다 - 이동을 부르면 "The 'navigation' object hasn't been initialized yet" 만 남는다. 내비게이터는 내려가며 상태를 지워, 일반 시작의 "Retry" 뒤에는 루트 Stack 의 첫 화면(`(app)` 의 앵커, 홈)이 초기값이다. 다만 R29의 cold 초기 URL 재적용은 기기에서 결함 주입으로 재지 않았다 - "Retry"는 일반 시작에서만 그렇게 판정했다(사실 절 - 설치본의 core 로 node 에서 쟀고 기기에서는 재지 않았다). 화면 단위 경계(라우트 파일의 `ErrorBoundary` - 머리글의 뒤로 가기가 출구가 된다)는 그 출구(네이티브 뒤로 가기)에도 캐시 비우기를 걸어야 해 화면마다 이탈 리스너가 들고, 경계로 가는 결함을 기기에서 일으킬 길이 이 저장소에 없다(D4 실측 W1 의 "재지 않은 것" 과 같은 까닭 - 세 백엔드는 그런 응답을 보내지 않는다). 기기에서 잴 수 없는 화면 구조를 D8 에 넣지 않는다 — 틀리면(기기의 "Retry" 가 홈이 아니라 같은 화면에 머문다면) 판정한 결함이 고쳐지지 않는 동안 그 화면에서 나갈 길이 앱 재시작뿐이다 - 출구를 더하는 단계는 그 출구도 `retryWithClearedQueries` 처럼 조회 캐시를 비운다(스펙 9.3 의 D8 정정이 적는다).
9. 결정: 네트워크 복귀의 판정(`isConnected !== false` - `null` 은 연결로 본다)을 `lib/jsonapi/online.ts` 의 `isOnline` 으로 옮기고 세 값을 잰다 — D7 결정 26(D3 최종 검토 M3 의 반쪽), 스펙 5장(`platform/` 에 판단을 두지 않는다). 실제 D4 의 `platform/query-client.ts` 에도 그 식이 그대로다(사실 절). `lib/jsonapi/` 에 둔 것은 기기 상태를 전송의 판단으로 옮기는 자리라서다(`accept-language.ts` 와 같은 성격) - 식 하나 때문에 lib 디렉터리를 새로 만들지 않는다 — 틀리면 파일 하나를 옮긴다.
10. 결정: 문서와 파일의 일치는 게이트 [7] 의 단위 시험 하나(`test/unit/docs/doc-set.test.ts`)가 매번 잰다 — 스펙 17장 조건 5 를 한 번의 손 검토가 아니라 게이트가 지키게 한다. 싸다(git 의 파일 목록과 문서 읽기 - 수십 ms) — 틀리면(너무 엄격하면) 오탐 원인을 좁혀 규칙을 고친다.
11. 결정: 그 시험의 규칙 넷 - (1) 인용한 경로가 있다: 마크다운 링크와 경로처럼 생긴 인라인 코드를 재고, 첫 조각이 저장소의 항목이 아닌 경로(`node_modules/…`·`.maestro-output/…`)는 재지 않고, 파일 이름 하나는 루트·문서의 디렉터리·같은 문단에서 먼저 부른 경로의 디렉터리 가운데 한 곳에 있으면 된다. (2) `AGENTS.md` 는 자기 디렉터리의 바로 아래 항목을 모두 부른다(루트는 디렉터리만). (3) 스펙 14장이 이름을 댄 문서가 있다. (4) 환경 변수 표가 세 곳에서 같다(스펙 10.1) — (2) 가 일치의 반대 방향(새 파일이 문서에 없다)을 잡는다. 문단의 디렉터리로 이름을 푸는 것은 이 저장소의 문체(`lib/resources/view.ts`·`screen-state.ts`)를 고쳐 쓰지 않으려는 것이다(원형으로 쟀다 - 이 규칙이 없으면 같은 뜻의 오탐이 열여섯) — 틀리면 그 규칙의 함수 하나.
12. 결정: 파일 목록은 `git ls-files --cached --others --exclude-standard` 다 - 추적하는 파일과 무시되지 않은 새 파일(E2E 하네스가 짧은 경로 사본에 옮기는 집합과 같다). 지웠지만 커밋하지 않은 파일은 `existsSync` 로 뺀다 — 새 파일이 `git add` 전에도 대상이 되고, `.gitignore` 를 두 벌 적지 않는다. 기존 시험도 `git` 을 부른다(`check-provenance.test.ts`) — 틀리면(git 이 없는 곳에서 돌면) 시험이 그 사실로 멈춘다 - 게이트와 CI 에는 git 이 있다.
13. 결정: 저장소 밖의 경로를 이름 그대로 부르는 자리의 예외는 시험 안의 표(`EXTERNAL`, 문서별)이고, 문서에서 사라진 예외도 실패다. 계층 표가 소유 관계로 미리 적은 빈 자리(`components/hooks/`)와 하네스가 단언하는 APK 안의 경로(`test/e2e/AGENTS.md` 의 `assets/app.config` - 첫 조각이 저장소의 `assets/` 와 같아 죽은 인용으로 읽힌다)도 여기 둔다 — 원본·백엔드 저장소의 경로를 부르는 문장은 출처를 밝히는 것이라 지우지 않는다. 표가 문서와 함께 늙지 않게 한다 — 틀리면 표의 줄.
14. 결정: 코드 울타리 안의 경로는 죽은 인용으로 재지 않고 "부른 것" 으로만 센다 — 명령에는 플래그·자리표시·저장소 밖 경로가 섞여 오탐이 잦다. 명령 예시의 경로가 사라지면 이 시험은 모르지만, 그 명령을 돌리는 단계(게이트·CI)가 알린다 — 틀리면 울타리 규칙 하나.
15. 결정: 새 계층 문서는 열하나 - `app/`(스펙 14장이 이름을 댔는데 없었다), `components/` 와 `components/app/`·`form/`·`ui/`·`lab/`, `lib/`, `scripts/`, `test/` 와 `test/unit/`, `docs/`. D7 의 끝에 있는 계층 문서 열여섯(루트, `.github/`·`.github/workflows/`, `components/resource/`, `lib/` 아래 여섯, `lib/updates/`·`plugins/`, `platform/`, `queries/`, `test/contract/`·`test/e2e/`)과 겹치지 않는다. 하위가 많은 자리는 부모 문서가 맡는다 - `test/unit/*` 와 `app/(app)/…` 는 표(`test/unit/AGENTS.md`·`app/AGENTS.md` 의 라우트 표), `test/e2e/flows/` 는 D7 의 `test/e2e/AGENTS.md` 의 규칙("파일 하나가 시나리오 하나다", `flows/*.yaml` 은 하네스가 전부 돈다 - D4 의 쓰기 플로 넷도 이름으로 적히지 않고 그 규칙과 플로 머리말이 설명한다) — 스펙 14장("형제 저장소처럼 그 밖의 디렉터리에도 `AGENTS.md`를 두어 하위 문서가 자기 디렉터리의 세부를 소유한다"), 형제의 모양(컨테이너 문서 + 디렉터리별 문서), 사용자 요구(속도). 규칙 (2) 가 문서 없는 디렉터리를 부모 문서가 부르게 한다 — 틀리면(하위 문서가 더 필요하면) 더하는 날 규칙 (2) 가 그 문서도 잰다.
16. 결정: 형제의 deepinit 표식(`<!-- Parent: … -->`·`<!-- Generated: … -->`·`<!-- MANUAL … -->`)은 쓰지 않는다 — 이 저장소의 기존 `AGENTS.md` 열여섯에 없다. 부모와 자식의 관계는 규칙 (2) 가 잰다 — 틀리면 표식 한 줄씩.
17. 결정: 루트 `AGENTS.md` 에 "새 자원 추가 절차"(스펙 14장이 루트에 맡겼는데 D1–D7 의 루트에 없다)와 "디렉터리 문서 탐색"(형제와 같은 표, 모든 최상위 디렉터리)을 더한다 — 스펙 14장 — 틀리면 절 둘.
18. 결정: README 는 한국어, 템플릿 사용자에게 합니다체다. 절의 순서는 형제 README(무엇인가 → 시작하기 → 환경 변수 → 화면 → 백엔드 전환 → 검증)에 스펙 14장의 항목(변형·EAS·OTA·앱 식별자 바꾸기)과 사용자 요구(E2E·CI·백엔드 매트릭스·복사한 코어·알려진 한계)를 더한 것이고, **앱 식별자 바꾸기가 첫 절**이다(스펙 10.3). 시험·플로의 개수를 적지 않는다 - 단계마다 바뀌어 README 가 낡는다 — 틀리면 문장.
19. 결정: 마지막 검증의 값(실행 주소·커밋·칸마다의 시간·백엔드 커밋)은 README 가 아니라 D8 실측 기록(`docs/superpowers/notes/2026-10-01-d8-measurements.md`)에 두고 README 가 그 기록을 가리킨다 — README 를 바꾸는 커밋은 CI 를 돌린다(`docs/` 밖). 기록만 바꾸는 커밋은 돌지 않는다(`paths-ignore`) - 값을 적으려고 매트릭스를 한 번 더 돌리지 않는다 — 틀리면 README 에 표 하나와 실행 하나.
20. 결정: CI 는 `feat/d8-docs-and-release` 의 push 로 돈다(D7 결정 2·3 - 모든 브랜치의 push, PR 없음). 첫 push 의 머리는 `docs/` 밖을 바꾼 커밋이어야 한다 - 기록만 바꾼 커밋이 머리면 `paths-ignore` 가 실행을 거를 수 있다. 실행은 넷이 상한이다(첫 실행과 고친 실행 셋) — D7 이 매트릭스를 초록으로 만들었고 D8 의 변경은 작다(개발 클라이언트·경계의 다시 시도·식 하나·문서) — 틀리면(상한에 닿으면) 증거와 함께 멈추고 컨트롤러에 넘긴다.
21. 결정: 태그·릴리스를 만들지 않는다 — 스펙 15장 단계 8 의 산출에 없다. 저장소 생성은 이미 끝났고 공개다(사용자 확인 - D7 결정 2·35). 15장에 그 사실을 정정으로 적는다 — 틀리면(사용자가 원하면) 태그 하나.
22. 결정: `main` 병합과 그 push, `main` 에서 도는 실행의 확인은 컨트롤러가 한다(사용자의 상시 결정 - 병합 커밋). `main` 의 실행은 기록하지 않고 보고한다 - 행 하나를 위해 실행을 더 만들지 않는다(D7 과 같다) — 틀리면 기록 한 줄.
23. 결정: 게이트 전체는 Task 3 에서 한 번 - 모든 코드·문서가 들어간 뒤다. 문서는 APK 의 빌드 지문에 들지 않지만 [3]·[5]·[7] 이 문서를 잰다. 게이트 뒤에 앱 코드를 고치면 게이트 전체를 다시 돈다 - 조건 1 의 증거는 마지막 코드에 대한 전체 통과여야 한다. 플로만 고쳤으면 그 플로를 `E2E_FLOW` 로 먼저 재고 마지막에 전체를 한 번 돈다 — 틀리면 시간이 든다.
24. 결정: 모든 앵커의 기준은 D7 코드 최종 `2599bf2d1fb5dbfab28ed0276f03aebccfd5d41c`다. v3의 기존 파일 연산 66개는 newline을 정규화해 실제 Git blob에 대조했고 모두 정확히 한 번 맞았다. 이번 v4에서 D6 기존 문서 덮어쓰기 한 개는 제거하며, 새 검사/이월 작업은 실제 앵커를 별도로 적는다. D7 이후 docs-only commit·main 병합은 실행 전 확인한다. 앵커 글자가 바뀌면 같은 뜻의 새 자리에만 옮긴다. 문서 시험의 실제 첫 출력이 계획의 예상 목록보다 우선한다 — 앞 판 재현 트리의 숫자와 성공을 최종 코드 증거로 쓰지 않는다 — 틀리면 재대조하고 기록한다.
25. 결정: 스펙 정정 - 8.5(연결 판정)·9.3(오류 경계의 다시 시도와 출구)·10.5(개발 클라이언트)는 Task 1, 14장(문서군과 문서 시험)·15장(저장소·태그)은 Task 2, 17장(조건 1·5 를 닫음)은 Task 3 이 붙인다 - 각 절 끝(다음 제목 바로 앞) — 스펙 0장(설계와 달라진 자리는 날짜 붙은 정정) — 틀리면 문장.
26. 결정: 알려진 한계는 README 의 절 하나로 모은다 - 스펙 7.5 의 셋(D2 정정의 iOS 키체인 포함), D4 의 회전 5xx, Uniwind 의 미디어 변형, Windows 의 경로 47자, iOS 는 CI 에서만(D7 넘김 7 - iOS 가드의 사각, D7 넘김 4 의 끝 - 비행기 모드 플로 둘은 iOS 에서 건너뛴다), 렌더 중 예외의 화면(Expo Router 의 기본 - 영어, 출구 없음, 결정 8), 관계 선택기의 100건, 값 안의 `%XX`, 두 하네스의 겹침(D7 넘김 10), EAS 실계정 미실증. D7 넘김 7·10 은 한계로 적고, 8(CI 지렛대)의 ABI·분할·캐시는 Task 0에서 구현·측정한다. 액션 SHA 고정과 미리 빌드한 Expo 모듈은 이번 범위에서 켜지 않는다. 9(`KNOWN_DIVERGENCES` 의 뒷일)는 D7 의 K3 에 따른다(Task 2 Step 7 (e)) — 사용자 요구("알려진 한계" 절) — 틀리면 문장.

27. 결정: Windows 전체 게이트는 D5 C2의 알려진 시작 상태·단독 실행 규칙으로 돈다 — 환경 실패에 retry/timeout을 더하지 않고 소유 AVD와 작업 시간을 먼저 확인한다 — 틀리면 실패 회차 증거를 남기고 컨트롤러에게 넘긴다.
28. 결정: CI APK만 x86_64로 만든다. 두 Gradle 호출에 같은 `-PreactNativeArchitectures=x86_64`를 주고 정확한 UP-TO-DATE 단언을 유지한다. 로컬 미지정 빌드는 기존 네 ABI다 — 네 ABI native build가 Android 빌드의 대부분이다 — 틀리면 ABI 커밋 하나를 되돌린다.
29. 결정: iOS는 backend별 두 shard이며 `max-parallel: 5`다. 통합 실행의 플로 시간에 근거해 긴 16개·짧은 5개를 고정하고 긴 셋을 include 앞에 둔다. 플랫폼 머리말로 허용 목록을 정하고 cold-links와 21개 합집합/무중복을 검사한다. fastapi shard 1만 iOS request-stall를 돈다 — 여섯 개를 반씩 나눠도 다섯 macOS 슬롯에서는 마지막 잡 대기가 시간을 지울 수 있다 — 틀리면 sharding 커밋 하나를 되돌린다.
30. 결정: iOS DerivedData는 `ios/` 밖에 두고 ccache와 함께 native fingerprint·락파일·레시피·Xcode/SDK·architecture별로만 복원한다. `.app`·JS 번들은 매번 현재 입력으로 빌드/검증한다 — `prebuild --clean`이 ios/build 캐시를 지우며 완성 앱 재사용은 현재 JS를 건너뛴다 — 틀리면 캐시 커밋 하나를 되돌린다.
31. 결정: cold/warm은 native key가 같은 두 명시된 설정 커밋에서 잰다. restore/save를 포함한 잡 전체와 컴파일 시간을 분리하고 네 실행 상한을 Task 3과 공유한다 — 개발 클라이언트 설치 뒤 native key가 바뀌므로 다음 실행을 자동 warm이라 부를 수 없다 — 틀리면 실제 miss로 기록한다.
32. 결정: D6 m7은 CFBundleDisplayName 비교 한 줄과 누락/불일치 실패 두 행으로 닫는다. `eas-json.test.ts`의 e2e `distribution: internal`·`withoutCredentials: true`도 기존 시험에서 고정한다. 두 resolveBash 복사본은 기존 support/bash.ts를 사용한다. logsHttpFailures의 e2e 전용 불변식 한 시험을 더해 진단 결합을 명시한다 — 코드/검사기가 바뀌는 D8에서 작은 이월을 함께 닫는다 — 틀리면 해당 작은 변경만 되돌린다.

---

## 이 계획이 근거로 삼은 사실 (v3의 2026-10-01 확인 + v4의 2026-10-02 코드 대조)

추측이 아니라 그날 설치본·패키지·원격에서 직접 읽거나 스크래치에서 돌려 본 것이다.

**expo-dev-client 57.0.19**(npm 의 `bundledNativeModules.json` 값, 2026-09-11 릴리스 - pnpm 11 의 `minimumReleaseAge` 하루를 넘었다). 의존성은 `expo-dev-launcher` ~57.0.20 · `expo-dev-menu` ~57.0.18 · `expo-manifests` ~57.0.2 · `expo-updates-interface` ~57.0.2 · `expo-dev-menu-interface` ~57.0.0 - 모두 2026-09-11 이전 릴리스다. 꾸러미를 받아 설정 플러그인을 읽었다:
- `plugin/build/withDevClient.js`: dev-menu 플러그인(SDK 44 뒤로 빈 구현) → dev-launcher 플러그인(받은 속성을 그대로 넘긴다) → `addGeneratedScheme`(기본 `true`)이면 Android·iOS 에 생성 scheme 을 더한다. `createRunOncePlugin` 이라 사용자가 `plugins` 에 적으면 자동으로 붙는 legacy 플러그인이 다시 돌지 않는다.
- `getDefaultScheme.js`: slug 에서 `[A-Za-z0-9+\-.]` 밖의 글자를 빼고 소문자로 바꿔 `exp+` 를 붙인다 - `template-typescript-expo` 는 `exp+template-typescript-expo`.
- dev-launcher 의 속성 검증(`pluginConfig.js`)은 `additionalProperties` 를 막지 않는다 - `addGeneratedScheme` 이 그대로 지난다(Expo 문서의 옵션이다). 같은 플러그인이 **모든 변형**의 iOS Info.plist 에 `NSBonjourServices: ['_expo._tcp']`·`NSLocalNetworkUsageDescription` 을 더하고, Debug 가 아닌 빌드에서 그 둘을 지우는 Xcode 빌드 단계를 더한다. Android 의 release 빌드는 `src/disableInRelease` 의 빈 구현이고 라이브러리의 main 매니페스트는 비어 있다.
- 설치본 `@expo/config-plugins` 의 `appendScheme`: Android 는 `singleTask` 활동의 VIEW intent filter 의 `data` 끝에 더하고, iOS 는 `CFBundleURLTypes` 끝에 항목 하나를 더한다.

**v3에서 introspect를 쟀다** - 앞 판 재현 트리에서 `expo install expo-dev-client` 와 이 계획의 Task 1 Step 3 편집 뒤 `expo config --type introspect --json`(`BACKEND_URL=https://gate-check.invalid`, 프로젝트 id 빈 값):

| 변형 | Android scheme | iOS URL scheme |
| --- | --- | --- |
| development | `templateexpo-dev`, `exp+template-typescript-expo` | `templateexpo-dev`, `com.example.templateexpo.dev`, `exp+template-typescript-expo` |
| preview | `templateexpo-preview` | `templateexpo-preview`, `com.example.templateexpo.preview` |
| production | `templateexpo` | `templateexpo`, `com.example.templateexpo` |
| e2e | `templateexpo-e2e` | `templateexpo-e2e`, `com.example.templateexpo.e2e` |

**Expo Router 57.0.24**: `_ctx-shared.js`·`_ctx.android.js` 의 `require.context` 가 `\.[tj]sx?$` 로 끝나는 파일만 고른다 - `app/AGENTS.md` 는 라우트가 아니다.

**루트 오류 경계**(D4 의 `app/_layout.tsx` 는 `export { ErrorBoundary } from 'expo-router'`): Expo Router 의 기본 화면은 영어다 - "Something went wrong", `Error: <문구>`(testID `router_error_message`), "Retry"(`router_error_retry`), 개발 빌드에서만 "Sitemap" 링크. 설치본의 `build/useScreens.js` 의 `fromImport` 는 라우트 모듈이 내보낸 `ErrorBoundary` 로 그 모듈의 기본 내보내기를 `Try`(`build/views/Try.js`)로 감싼다 - 루트 레이아웃의 경계는 루트 Stack 을 품은 레이아웃 전체를 바꿔 그린다. `Try` 의 `retry` 는 경계의 상태만 지운다(요청을 보내지 않는다). `ErrorBoundary`(컴포넌트)와 `ErrorBoundaryProps`(`{ error: Error; retry: () => Promise<void> }`)는 `expo-router` 가 내보낸다. 묶인 react-navigation core(`build/react-navigation/core` 의 `useNavigationBuilder`)는 내비게이터가 내려갈 때 컨테이너의 상태를 지운다. 그 core·routers 를 그대로 node 로 불러(react 19.2.3·react-test-renderer 19.2.3) `Try` 와 같은 경계로 루트 레이아웃(홈·상세 두 화면의 Stack)을 감싸 쟀다:

```text
1 시작: ["home"] index=0
2 상세로 간 뒤: ["home","detail"] index=1
3 상세가 던진 뒤(경계): undefined
4 경계가 떠 있는 동안 navigate("home"): undefined | console.error: The 'navigation' object hasn't been initialized yet. …
5 retry 뒤: ["home"] index=0
```

expo-router 의 `getSortedChildren` 은 레이아웃이 적은 `Stack.Screen` 을 앞에 두므로 루트 Stack 의 첫 화면은 `(app)` 이고 그 앵커가 `index` 다 - 일반 시작에서 홈이 초기 화면이라는 결론이다. cold 초기 URL의 재적용과 R29 pending next는 별도로 구분한다(설치본/node의 증거이며 기기 결함 주입은 재지 않았다). 구독자 없는 화면 조회(목록·상세·참조 목록)의 `gcTime` 은 30분이다(`queries/resource-options.ts` 의 `SCREEN_QUERY_GC_TIME` - 스펙 8.5 의 D4 정정).

**병합된 D4**(`9cd1323` = `main` 의 `fe28615`, 트리 `96ef578`):
- 가드가 보낸 로그인·가입 화면의 머리글 오른쪽에 "홈으로"가 있다 - `components/app/home-button.tsx` 의 `HomeButton`(testID `back-to-home-button`)과 `renderHomeButton`(머리글이 넘긴 `canGoBack` 이 참이면 그리지 않는다), 두 화면의 `<Stack.Screen options={{ title: …, headerRight: renderHomeButton }} />`. 이동은 `components/app/back-to-home.ts` 의 `goHome`(`router.dismissTo('/', { withAnchor: true })`)이고 Android 의 뒤로 가기(`useBackToHome`)와 같은 이동이다. D7 v2 의 `examples-create`(iOS 갈래)·`examples-delete`(두 플랫폼)가 그 버튼을 누른다.
- `lib/auth/error-detail.ts`(`errorDetail` - 거절을 남기는 로그 한 줄)와 그 시험, `platform/query-client.ts` 의 `import { errorDetail } from '@/lib/auth/error-detail'`(그 다음 줄이 `import { isSessionRejected } from '@/lib/resources/write'`). 네트워크 복귀의 `setOnline(state.isConnected !== false)` 와 그 위 주석 두 줄은 그대로다 - D3 최종 검토 M3 의 lib 반쪽이 아직 남아 있다.
- 스펙 9.3 의 D4 정정 (b) - "오류 경계의 "다시 시도" 는 요청을 다시 보내지 않고 경계의 상태만 지운다 … 경계에 출구(홈으로 나가는 길)를 두면 그 길과 "다시 시도" 가 조회 캐시를 비워야 한다 - 비우지 않으면 그 30분 동안 같은 화면에 다시 들어갈 때마다 캐시의 결함을 다시 던진다". `queries/AGENTS.md` 에 같은 뜻의 문장이 있다.
- D4 실측 W1–W4(`docs/superpowers/notes/2026-10-01-d4-measurements.md`) - W1 의 게이트 E2E 는 빌드 앞에 `Metro 캐시를 비웠다: …` 를 찍고 Gradle 을 `--no-daemon` 으로 돌린다(남은 데몬이 `C:/t/e` 사본의 dex 를 쥐었다), W2 회전의 실제 왕복, W3 쌓인 화면의 재조회, W4 빠른 두 번 누름.

**D7 실제 최종 `2599bf2`**:
- Android splash plugin은 expo-splash-screen 앞에 등록한다. scene lifecycle은 모든 변형에서 공식 Expo opt-in으로 켰고 게이트 검사기의 manifest/delegate 단언이 지킨다.
- R29의 decidePendingLogin은 첫 로그인 next를 앱 셸 로컬 state로 유지한다. cold-links는 cold 공개/보호 링크를 돈다. 루트 AppRoot의 useE2eDiagnostics는 로그 표식/플로 진단과 함께 보존한다.
- run-ios는 전용 simulator 생성·서비스 축소·AutoFill/scheme 원래 값 보관·한 번 재부팅 뒤 설치한다. 종료에 설정/기기를 정리한다. native-backend는 자기 Redis만 종료하고 모르는 BACKEND_KIND는 부작용 전 짧은 사용자 오류로 실패한다.
- 계약 거울은 K4의 쓰기 상태/code/pointer·거부 후 저장 상태·JWT600초 입력을 검사하며 세 백엔드 각각94개다. 단위는 실제 pnpm test의95파일/1914개, flows23(Android전용2·iOS21), provenance54/42/33, 기존문서16, 셸11(100755진입점10·100644source1)이다.

**형제 `template-typescript-nextjs`**(`34d0b10`): README 의 절은 시작하기 · 환경 변수(앱의 둘 + E2E 의 다섯) · 화면(실험실 경고 상자 포함) · 백엔드 전환(호환성 검증 표·백엔드를 갱신한 뒤 다시 검증하기·드리프트 이력) · 검증이다. 계층 문서는 43개이고(`2617897`) 루트에 "디렉터리 문서 탐색" 표가 있다.

**GitHub**(D7 계획의 사실과 결정): 저장소는 공개이고 `origin` 이 걸려 있다. 워크플로 `CI` 는 모든 브랜치의 push 와 pull request 에서 돌고 `docs/**` 만 바꾼 push 는 거른다. 잡 다섯·칸 아홉: `checks (게이트 [1]–[11])`·`build-android (e2e APK)`·`e2e-android (<백엔드>)` × 3·`build-ios (e2e .app)`·`e2e-ios (<백엔드>)` × 3. 끝난 단계는 컨트롤러가 `main` 에 병합해 push 한다.

## 미리 돌려 본 것

v4는 별도 detached worktree를 `2599bf2`에서 만들고 재생했다. 컨트롤러의 작업 사본은 그대로다. commit·push·기기·Docker·원격 쓰기는 하지 않았다.

- 바탕 `pnpm install --frozen-lockfile --prefer-offline` 뒤 **`pnpm test`: 95 files / 1914 tests, exit 0**. 세기는 소스 추산이 아니라 실제 실행이다. `git ls-tree`로 `flows/` 23개와 Android 전용 둘·iOS 허용21을 따로 확인했다. provenance는 54/42/33, 계약은 K4의 각 백엔드 94개다.
- v3 기존 연산66개는 실제 Git blob의 논리 newline에서 모두 정확히 한 번 맞았다. D7의 신규 plugin/scene/진단 코드를 기존 좁은 앵커 편집이 보존하는 것을 확인했다. 기존 lib/updates 문서는 덮어쓰지 않도록 v4에서 삭제했다.
- 기존 Task 1 Step 2의 실제 red는 **9 failed / 74 passed, 83 tests**였다. D7이 추가한 성공 줄/프로젝트 누수 시험 때문에 v3의 7/53/60과 다르다. 의존성 설치와 Step 3–7 연산 뒤 설정·online·경계·QueryClient·R29 guard-route·진단의 **8 files / 126 tests, exit 0**를 확인했다.
- v4의 Task 1·2 파일 연산 **82개(정확한 Edit 53·Write 18·insertBefore 7·append 3·appendParagraph 1)**를 재생했다. Edit 53개와 Task 0 Modify/문서·스펙 삽입 앵커 17개가 실제 D7 앵커에서 각각 한 번 맞는지도 검사했다. m7/핀/diagnostics 불변식·Bash 공통화를 포함한 Task 1 시험은 **97 files / 1928 tests, exit 0**다. 타입·린트·서식·출처·인용 검사 모두 exit 0, 실제 dev-client 설치 뒤 네 변형 × 프로젝트 ID 유무의 introspect 8개도 모두 exit 0(OTA-off 19건, preview/production OTA-on 23건)이다.
- Task 2 문서 시험은 **10 passed / 1 failed**다. 실패는 먼저 구현할 Task 0의 `scripts/e2e-flow-shards.mjs`·`scripts/ios-native-fingerprint.mjs` 둘만 아직 없기 때문이다. D7 실재 경로로 인한 실패는 고쳤고, 가짜 파일을 만들거나 문서 시험을 약화하지 않았다. Task 0 구현 뒤 이 실패가 없어지는 것은 실행 단계에서 확인한다. 이번 재생은 native build/shard/cache의 실증이 아니며, Task 0의 예정 34시험도 초록 숫자에 섞지 않는다.
- 재지 않은 것: Windows 전체 게이트/APK/Android 23플로, 실제 macOS/xcodebuild/ccache/두 shard CI, Expo 계정/EAS·OTA, iOS 실제 네트워크 차단 실패 UI. D7 K3의 부분 로컬 NOT RUN과 이후 통합 CI는 서로 다른 증거다.

## D4–D7 이 넘겨야 하는 것 (이 계획의 전제)

Task 1 Step 1 이 확인한다. 하나라도 없으면 멈추고 컨트롤러에 알린다. 글자가 바뀌었으면 같은 뜻의 자리를 찾아 고친다(결정 24).

| 산출 | 이 계획이 쓰는 모양 |
| --- | --- |
| `main` | D7 이 병합 커밋으로 병합됐고 `origin/main` 과 같다. 그 push 로 돈 `main` 의 CI 실행이 초록이다(D7 다음 계획 2 - "초록인지 D8 이 처음에 본다") |
| 기록·계획 | `docs/superpowers/plans/2026-10-01-d7-ci.md`, `docs/superpowers/notes/2026-10-01-d4-measurements.md`·`d5`·`d6`·`d7` - README·문서가 인용한다 |
| `.env.example`(D6) | 변수 셋 - `BACKEND_URL=…`(예시 값), `APP_VARIANT=development`, `EAS_PROJECT_ID=`(빈 값) |
| `lib/config/app-variant.ts`(D6) | `VariantProfile` 의 마지막 속성 `readonly updatesChannel: string \| null`, `PROFILES` 의 네 블록이 `updatesChannel` 로 끝난다(e2e 블록은 `logsHttpFailures: true,` 다음 줄) |
| `app.config.ts`(D6) | `export const BASE_NAME = 'Template Expo'` 줄, `slug: 'template-typescript-expo',`, `plugins` 의 마지막 항목 `['expo-secure-store', { configureAndroidBackup: true, faceIDPermission: false }],` |
| `scripts/check-variant-config.mjs`(D6) | `import { BASE_APP_ID, BASE_NAME, BASE_SCHEME } from '../app.config.ts'`, `const scheme = …` 다음 줄 `const runtimeVersion = …`, `expectValue('Android 딥링크 scheme', androidSchemes, [scheme])`, `expectValue('iOS URL scheme', iosSchemes, [scheme, appId])` |
| 설정 시험(D6) | `app-variant.test.ts` 의 네 `toEqual` 이 `updatesChannel` 로 끝나고 `it('접미사가 서로 겹치지 않는다` 가 있다. `app-config.test.ts` 의 `import appConfig, { BASE_APP_ID, BASE_NAME, BASE_SCHEME } from '@/app.config'` 와 `describe('app.config.ts 의 OTA - 스펙 10.1·10.6'`. `check-variant-config.test.ts` 의 `NATIVE`·`introspected()`·실패 표의 `'앱 설정의 변형이 다르다'` |
| `app/_layout.tsx`(D4·D7) | `import { Stack, ThemeProvider } from 'expo-router'`, `import { NAV_THEME } from '@/platform/theme'`(앞 줄들이 `@/platform/…` 의 import), `export { ErrorBoundary } from 'expo-router'` 한 줄, `queryClient` 를 `@/platform/query-client` 에서 import 한다 |
| `platform/query-client.ts`(D3·D4) | `import { isSessionRejected } from '@/lib/resources/write'`, `setOnline(state.isConnected !== false)` 와 그 위 주석 두 줄 |
| `queries/`(D3·D4) | `resource-options.ts` 의 `detailQueryOptions(resource, id, send)`·`SCREEN_QUERY_GC_TIME`, `lib/resources/screen-state.ts` 의 `detailScreen(resource, { result, error })`(본문 없는 성공 응답이면 `본문 없는 응답` 으로 던진다), `queries/AGENTS.md` 의 파일 표에 `keys.ts` 행 |
| "홈으로"(D4) | `components/app/home-button.tsx`(testID `back-to-home-button`)·`back-to-home.ts`, 로그인·가입 화면의 `headerRight: renderHomeButton` - 이 계획은 고치지 않고 문서가 적는다 |
| 문서의 자리 | `.github/workflows/AGENTS.md` 의 "`bash x.sh` 처럼 우회하지 않고 `./x.sh` 로 부른다"(D7), `lib/jsonapi/AGENTS.md` 의 "이 저장소가 더한 것" 표의 `status.ts` 행(D4), `platform/AGENTS.md` 의 `query-client.ts` 행의 끝 칸 "(쓰기 캐시의 `onError` - 세션 거절이면 `signOut()`, 스펙 9.2)"(D3·D4), `lib/config/AGENTS.md`(D6), 루트 `AGENTS.md` 의 `## 복사한 코어` 제목과 `실측 기록은` 으로 시작하는 마지막 문단(D1–D7), `test/e2e/AGENTS.md` 의 APK 안의 경로 `assets/app.config`(D6) |
| 스펙 | 제목 `### 8.6 계약 실험실`·`### 9.4 Accept-Language`·`### 10.6 OTA 업데이트`·`## 15. 구현 단계`·`## 16. 리스크` 가 한 번씩, 파일 끝이 17장 |
| 최종 D7 네이티브/가드 | app.config.ts의 splash 플러그인은 expo-splash-screen 앞, 모든 변형 scene opt-in; checker의 scene manifest/delegate; R29 decidePendingLogin과 cold-links; 루트 useE2eDiagnostics는 보존한다 |
| 실제 문서 수 | 기존 AGENTS 16개(lib/updates와plugins 포함), D8 신규11개→27개. 기존 lib/updates의 D6 규칙/검증을 덮지 않는다 |
| 기준 수 | 단위 시험 N(F 파일), 출처 기록(경로·이탈·원본 그대로), 플로 23(`flows/` - Android 전용 둘, iOS 21) - Task 1 Step 1 이 센 값이 기준이다. D7 실제 `2599bf2`는 `95`·`1914`, 54·42·33 이었다(사실 절). 이 계획은 단위 시험 +59(파일 +6: Task 0 +34/+3, Task 1 +14/+2, Task 2 +11/+1), 출처 기록 그대로, 플로 수 그대로다 |

## D4–D7 병합 뒤 다시 볼 자리

이 판의 "찾을 것"은 실제 D7 `2599bf2`(결정 24)에 맞췄다. D4–D7 이 실행 중에 아래 파일을 다른 글자로 남겼으면 그 Edit 가 맞지 않을 수 있다. Task 1 Step 1 앞에서 `git log --oneline -3 -- <파일>` 로 D7 병합 뒤의 글자를 보고, 맞지 않는 Edit 는 같은 뜻의 자리를 찾아 고친다(결정 24).

| 파일 | 이 계획이 거는 것 | 볼 자리 |
| --- | --- | --- |
| `lib/config/app-variant.ts`·`app.config.ts`·`scripts/check-variant-config.mjs`(D6) | Task 1 Step 3의 기존 Edit12와 m7 Edit1 | `updatesChannel` 의 네 끝(`null`·`'preview'`·`'production'`·e2e 의 `logsHttpFailures: true,` 뒤 `null`), `BASE_NAME`·`slug` 줄, `plugins` 의 `expo-secure-store` 항목, 검사기의 import·`scheme` 다음 줄·`expectValue` 둘 |
| `test/unit/config/app-variant.test.ts`·`app-config.test.ts`·`test/unit/scripts/check-variant-config.test.ts`(D6) | Task 1 Step 2의 기존 Edit17와 D7 성공줄/주석 Edit4 | 표의 네 끝, `it('접미사가 서로 겹치지 않는다`, import 줄, OTA 의 `describe`, `PROJECT_ID`·`NATIVE` 의 모양·`strings`·intent filter 의 `data`·`CFBundleURLTypes`·실패 표의 `'앱 설정의 변형이 다르다'` |
| `platform/query-client.ts`(D3·D4) | Task 1 Step 5 의 Edit 둘 | `isSessionRejected` import 줄, `isConnected` 주석 두 줄과 `setOnline` |
| `app/_layout.tsx`(D4·D7) | Task 1 Step 6 의 Edit 셋 | `expo-router` 의 값 import, `@/platform/theme` import, `export { ErrorBoundary } from 'expo-router'` |
| `queries/AGENTS.md`·`lib/jsonapi/AGENTS.md`·`platform/AGENTS.md`·`lib/config/AGENTS.md` | Task 1 Step 7 의 Edit 셋과 덧붙이기 하나 | `keys.ts` 행, `status.ts` 행, `query-client.ts` 행의 끝 칸, 파일 끝 |
| 스펙 | 정정 다섯을 제목 앞에 끼우고(Task 1 셋·Task 2 둘) 하나를 파일 끝에 붙인다(Task 3) | `### 8.6 계약 실험실`·`### 9.4 Accept-Language`·`### 10.6 OTA 업데이트`·`## 15. 구현 단계`·`## 16. 리스크` 가 한 번씩 있는지. 9.3 의 D8 정정은 "위 D4 정정 (b)" 를 부른다 - D4 가 그 문단을 옮겼으면 첫 문장을 고친다 |
| 루트 `AGENTS.md`·`.github/workflows/AGENTS.md`(D1–D7) | Task 2 Step 5 의 끼우기 하나·문장 하나·덧붙이기 하나·Edit 하나 | `## 복사한 코어`, `실측 기록은` 문단, 파일 끝, `./x.sh` 문장 |
| D5·D6·D7 이 쓴 문서의 글자 | 문서 시험의 `EXTERNAL` 다섯 문서 | `lib/jsonapi/AGENTS.md`(`app/jsonapi/`·`proxy.ts`·`app/error.tsx`), `lib/lab/AGENTS.md`(원본의 실험실 자리 넷), `.github/workflows/AGENTS.md`(`action.yml`), `test/e2e/AGENTS.md`(`assets/app.config`), 루트(`components/hooks/`) - 사라졌으면 Task 2 Step 7 (b) |
| D4–D7 이 더한 파일 | 새 계층 문서 열하나의 표 | 문서 시험의 규칙 (2) 가 가리킨다 - Task 2 Step 7 (c) |
| 이미 병합된 D5·D6의 문서/기록 | 연산은 없다. 새 문서와 문서 시험이 D5 의 글자를 부른다 | `components/lab/AGENTS.md` 의 표(실험실 조각의 파일 이름), 문서 시험의 `EXTERNAL` 가운데 `lib/lab/AGENTS.md` 넷, README 의 실험실 상자(`app/(lab)/contract.tsx`·`app/(app)/index.tsx`·`contract-lab-*`·`components/lab/`·`queries/lab.ts`·`lib/lab/`) - 다르면 문서 시험이 가리킨다(Task 2 Step 7) |
| D7 실제 최종의 플로(`subflows/back.yaml`, Android 전용 `examples-delete-offline.yaml`)와 요청 수(`request-counts.ts`) | 연산은 없다. README 의 E2E 절과 알려진 한계가 그 둘을 적는다 | 플로 이름과 Android 전용 플로의 수(Task 1 Step 1 의 `grep -l "e2e-platforms: android"`), FastAPI 만 센다는 것 - 다르면 README 의 그 문장을 고친다 |
| D7 네이티브/가드/진단 | 기존 앵커 편집에서 보존하고 Task 1/3 회귀 시험 | app.config.ts:70·79의 splash/scene, checker:146의 scene, app/(app)/_layout.tsx:39의 pending next, lib/auth/guard-latch.ts:69, platform/e2e-diagnostics.ts:16, app/_layout.tsx:59 |
| CI 최적화 | Task 0의 정확한 Modify 앵커 | android.sh의 두 Gradle 호출/UP-TO-DATE, ios.sh의 DERIVED_DATA·build, ci.yml의 e2e APK·e2e .app·iOS 잡/실행/아티팩트 |
| D6 m7·선택 pins, D7 resolver 중복 | Task 1 Step 2/3·7a | checker의 iOS 번들 ID 줄·실제18/22 성공 줄, eas-json.test e2e object, 두 resolveBash 전체, support/bash.ts |
| D6 문서/복사본 주석 | Task 2 첫 문서 시험/내용 감사 | lib/updates/AGENTS.md 전체46줄, plugins/AGENTS.md, form.ts:30의 Expo 이탈 설명·write.ts:17의 주입 전송/쓰기 훅 설명, K4의 write-paths와600초 계약 입력 |

## D1–D7 에서 이어받은 것

| 항목(출처) | 맡은 곳 |
| --- | --- |
| 스펙 17장 조건 1·5(D7 다음 계획 1) | Task 3(Windows 게이트 전체), Task 2(문서군과 문서 시험) |
| D7 의 `main` 병합 뒤 실행이 초록인지(D7 다음 계획 2) | Task 1 Step 1(읽기만) |
| README 의 CI 절 - 잡 다섯, 아티팩트, 재시도 0, Mac 의 iOS(D7 다음 계획 3) | Task 2 README "CI" |
| iOS 의 가드 출구(D7 다음 계획 4, D2 최종 검토 M5) | D4 의 "홈으로"가 닫았다 - D8 은 문서에 적기만(결정 6). D7 의 iOS 칸이 그 버튼에서 빨갰으면 Task 3 Step 6 (b) |
| 삭제 실패의 문구는 iOS 에서 재지 않는다(D7 다음 계획 4 의 끝, D7 결정 20) | README "알려진 한계"(Android 전용 플로 둘) |
| 요청 수 단언(D7 v2.1, D4 실측 W2–W4) | README "E2E" 의 두 문장(FastAPI 의 접근 로그만 센다) |
| 네트워크 복귀 판정의 lib 반쪽(D7 다음 계획 5, D7 결정 26) | Task 1 Step 5(결정 9), 스펙 8.5 정정 |
| `expo-dev-client`(D7 다음 계획 6, D6 결정 3·다음 계획) | Task 1 Step 2–4(결정 2–5), 스펙 10.5 정정 |
| 오류 경계의 출구와 "다시 시도"(스펙 9.3 의 D4 정정 (b)) | Task 1 Step 6(결정 7·8), 스펙 9.3 정정, README "알려진 한계" |
| iOS 가드의 사각(D7 다음 계획 7) | README "알려진 한계"(고치지 않는다) |
| CI 의 지렛대(D7 다음 계획 8) + 사용자 2026-10-02 속도 요청 | Task 0(ABI·iOS shard·fingerprint 캐시·측정), README CI. Expo precompiled modules·action SHA 고정은 선택적 유지보수로 보존 |
| D7 Task 4 가 남긴 것 - `KNOWN_DIVERGENCES`·백엔드 이슈(D7 다음 계획 9) | Task 2 Step 7 (e) - K3 를 읽고 README 에 반영. 백엔드 저장소의 이슈는 사용자 승인 밖이라 하지 않는다 |
| 두 하네스의 겹침(D7 다음 계획 10) | README "알려진 한계"(고치지 않는다) |
| E2E 하네스의 `--no-daemon`·Metro 캐시(D4 실측 W1) | README "E2E" 의 한 문장(레시피는 그대로) |
| README 의 EAS·OTA 절, 환경 변수 표의 `EAS_PROJECT_ID`(D6 다음 계획) | Task 2 README, 문서 시험 규칙 (4) |
| 스펙 7.5 의 한계와 D2 정정(키체인) | README "알려진 한계" |
| Uniwind 의 상류 보고(D1 운반 - "사용자 확인 뒤") | 하지 않는다 - 사용자 확인이 필요한 밖의 일이다. 결함과 대응은 README "알려진 한계" |
| Windows 게이트의 환경 실패(D5 C2·컨트롤러) | Global Constraints·결정27·Task 3 Step 1/2/3(f)·README E2E·test/e2e/AGENTS |
| D6 m7 = iOS CFBundleDisplayName 누락(같은 지적을 별개로 중복 세지 않는다) | Task 1 Step 2/3, 검사기·표본·누락/불일치 시험2 |
| D6 eas-json.test 선택 pins | Task 1 Step 7a, 기존 e2e object의 distribution/withoutCredentials |
| D6 문서 앵커 | Task 2 lib/updates 보존·기존 계층문서 감사, README O4/D9 안내 |
| D7 final review resolveBash 중복 | Task 1 Step 7a, 두 시험은 support/bash.ts를 import |
| D7 진단·이벤트·로그의 logsHttpFailures 결합 | Task 1 Step 7a의 e2e-only 불변식·기존 비-e2e 구독/cleanup 시험, platform 문서 설명 |
| D7 R29 pending next·cold-links + 오류 경계 | Task 1 Step 6/7a의 기존 guard-route 회귀, Task 3 Android23/iOS21합집합. QueryCache 제거가 세션/가드 정책을 바꾸지 않는다 |
| iOS 오프라인/삭제 실패 UI | README 알려진 한계. 실제 네트워크 차단 없이는 미검증이며 Android 전용2를 iOS 성공으로 세지 않는다. 필요 시 D9 이후 실제 네트워크 차단 별도 작업 |
| K3 NOT RUN·로컬 일부 성공 | Task 2 README와 G4는 원래26.5/27 부분 증거·이후 통합CI를 구분. NOT RUN을 소급 PASS로 바꾸지 않는다 |
| Xcode27 / UIScene | README requirements·known limits는 CI Xcode26.6와 현재 모든 변형 scene opt-in을 적는다. 새 native fingerprint의 launch/splash/cold/warm/SecureStore는 D9 |
| D7 최종 I1 Redis·M1 BACKEND_KIND | 2599bf2에서 이미 수정. D8 새 버그수정 목록에서 제외하고 기존 native-backend 시험/실제 메시지 검증을 유지 |
| D9 네이티브·OTA/512MiB·접근성 | 다음 계획(D9)에 splash/scene fingerprint·EAS 기본Metaspace·TalkBack/iOS announcement·Windows/Linux EAS fingerprint 이월 |

## 태스크 지도

| 태스크 | 산출 | 시험 | 기기 |
| --- | --- | --- | --- |
| 0 CI 시간 | x86_64 APK, iOS backend별 두 shard, native fingerprint DerivedData/ccache, 독립 커밋3, cold/warm G4 | 새34개(3파일), 기존 하네스·actionlint·CI 물리12 | CI만 |
| 1 코드 마감 | `expo-dev-client`, 변형 표의 `devClientScheme`, `app.config.ts` 의 `SLUG`·`DEV_CLIENT_SCHEME`·플러그인, 검사기 [8], `lib/jsonapi/online.ts`·`platform/query-client.ts`, `queries/error-boundary.ts`·루트 레이아웃의 `ErrorBoundary`, 문서 넷, 스펙 8.5·9.3·10.5 | 설정 +3·검사기 +4·연결 판정 +3·경계 +3·진단 +1, pins/resolver 회귀, 정적 게이트 [1]–[11] | 없음 |
| 2 문서군 | `test/unit/docs/doc-set.test.ts`, README, 새 계층 문서 열하나(D6의 lib/updates와 D7의 plugins는 기존 문서), 루트 `AGENTS.md` 의 절 둘과 문장 하나, 첫 실행이 잡은 어긋남의 고침, D8 기록의 뼈대와 G3, 스펙 14·15 | 문서 시험 11, 정적 검사 | 없음 |
| 3 게이트·CI·기록 | Windows 게이트 전체(13단계) 한 번, `feat/d8-docs-and-release` push 와 CI 논리 아홉 칸·물리12잡 초록, 기록 G1·G2, 스펙 17 | 게이트 13단계, CI 물리12잡 | **여기서만** - 로컬 Android(게이트) + GitHub |

## File Structure

```text
.github/workflows/ci.yml · test/e2e/android.sh · run-android.sh · ios.sh · app.config.ts (수정) CI ABI/shard/cache                     — Task 0
scripts/e2e-flow-shards.mjs · scripts/ios-native-fingerprint.mjs (신규) 흐름분할/네이티브 캐시키                      — Task 0
test/unit/e2e/flow-shards.test.ts · test/unit/scripts/ios-native-fingerprint.test.ts · ci-speed.test.ts (신규)        — Task 0
test/unit/config/eas-json.test.ts · test/unit/platform/e2e-diagnostics.test.ts (수정) 기존pin/진단e2e전용             — Task 1
test/unit/e2e/guard-log.test.ts · test/unit/scripts/check-citations.test.ts (수정) 공통Bash resolver                 — Task 1
package.json · pnpm-lock.yaml                (expo install) expo-dev-client ~57.0.19                                  — Task 1
lib/config/app-variant.ts                    (수정) 변형 표의 칸 devClientScheme                                       — Task 1
app.config.ts                                (수정) SLUG·DEV_CLIENT_SCHEME, slug, expo-dev-client 플러그인              — Task 1
scripts/check-variant-config.mjs             (수정) development 의 Android·iOS scheme 끝에 개발 클라이언트 scheme       — Task 1
test/unit/config/app-variant.test.ts · app-config.test.ts (수정) · test/unit/scripts/check-variant-config.test.ts (수정) — Task 1
lib/jsonapi/online.ts                        (신규) isOnline - NetInfo 의 연결 상태 → Query 의 온라인                    — Task 1
test/unit/jsonapi/online.test.ts             (신규)                                                                      — Task 1
platform/query-client.ts                     (수정) setOnline(isOnline(…))                                               — Task 1
queries/error-boundary.ts                    (신규) retryWithClearedQueries - 조회 캐시를 비운 뒤 경계를 푼다           — Task 1
test/unit/queries/error-boundary.test.ts     (신규)                                                                      — Task 1
app/_layout.tsx                              (수정) ErrorBoundary - Expo Router 의 기본 화면, Retry 앞에 캐시 비우기     — Task 1
test/unit/docs/doc-set.test.ts               (신규) 문서군이 실제 파일과 일치한다                                        — Task 2
README.md                                    (신규)                                                                      — Task 2
app/AGENTS.md · components/AGENTS.md · components/app|form|ui|lab/AGENTS.md (신규)                                     — Task 2
lib/AGENTS.md · scripts/AGENTS.md · test/AGENTS.md · test/unit/AGENTS.md · docs/AGENTS.md (신규) — Task 2
docs/superpowers/notes/2026-10-01-d8-measurements.md (신규) G3·G4(Task 2, Task 0 측정 이관), G1·G2(Task 3)
AGENTS.md                                    (수정) 새 자원 추가 절차, 디렉터리 문서 탐색, 기록 한 문장                 — Task 2
lib/config/AGENTS.md · lib/jsonapi/AGENTS.md · platform/AGENTS.md · queries/AGENTS.md (수정)                          — Task 1
.github/workflows/AGENTS.md                  (수정) 예시 이름 ./x.sh → 실제 경로, 그리고 문서 시험이 잡은 자리           — Task 2
docs/superpowers/specs/2026-09-30-expo-jsonapi-template-design.md (정정) 13(Task 0), 8.5·9.3·10.5(Task 1), 14·15(Task 2), 17(Task 3)
```

---

### Task 0: CI 시간 줄이기 — 범위를 그대로 두고 빌드·iOS 플로를 나눈다

문서 마감보다 먼저 구현한다. Task 0의 세 변경은 각각 한 커밋이며 각각 되돌릴 수 있다. 기존 Task 1–3의 번호는 유지한다. 이 태스크의 CI 측정 push와 Task 3의 push를 합쳐 실행 상한은 넷이다. 재시도 0, HTTP·로그·화면 단언, Maestro·요청 timeout, 세 백엔드 × 두 플랫폼의 범위는 그대로다.

**Files:**
- Modify: `test/e2e/android.sh`, `test/e2e/run-android.sh`, `test/e2e/ios.sh`, `app.config.ts`, `.github/workflows/ci.yml`, `.github/workflows/AGENTS.md`, `test/e2e/AGENTS.md`, 스펙 13장(날짜 붙은 CI 분할 정정).
- Create: `scripts/e2e-flow-shards.mjs`, `scripts/ios-native-fingerprint.mjs`, `test/unit/e2e/flow-shards.test.ts`, `test/unit/scripts/ios-native-fingerprint.test.ts`, `test/unit/scripts/ci-speed.test.ts`.
- Test: 새 시험 34개(10·12·12)와 기존 `test/unit/e2e/android-build.test.ts`·`ios-harness.test.ts`·`ios-signature.test.ts`·`ios-harness-lifecycle.test.ts`·`ios-simulator-shell.test.ts`·`ios-simulator-create.test.ts`·`native-backend.test.ts`·`flows.test.ts`. 기존 시험에 새 행을 더하면 그 수를 따로 기록한다.

**Interfaces:**
- Consumes: D7 코드 `2599bf2`, 두 단계 Gradle과 결정 41의 정확한 UP-TO-DATE 단언, `run-ios.sh`의 공백 구분 `E2E_FLOW`, `E2E_CHECKS=1`, 소유 simulator의 서비스 축소·설정 준비·한 번 재부팅, Xcode 26.6, 서명/OTA/백엔드 주소를 검사하는 `ios.sh assert-app`.
- Produces: CI APK는 x86_64만 포함한다. 로컬 기본 빌드는 기존 네 ABI다. iOS 논리 셀 하나는 shard 1·2의 두 물리 잡이며 합집합은 정확히 21플로다. 물리 잡은 총 12개(checks 1 + 빌드 2 + Android 3 + iOS 6), 스펙의 플랫폼/백엔드 논리 칸은 기존 아홉이다.
- `scripts/e2e-flow-shards.mjs`: `iosFlowNames(root: string): string[]`, `splitIosFlows(names: readonly string[]): [string[], string[]]`; CLI `node scripts/e2e-flow-shards.mjs 1`·`2`는 해당 shard의 공백 구분 이름 한 줄, `--manifest`는 두 목록과 범위 검증 결과를 JSON으로 출력한다. 잘못된 인자/머리말/빈 shard는 exit 1이며 `E2E_FLOW`를 비워 전체 실행으로 넘어가지 않는다.
- `scripts/ios-native-fingerprint.mjs`: `nativeCacheFingerprint(root: string): Promise<{ nativeHash: string; cacheKey: string }>`; CLI는 GitHub output에 넣을 `nativeHash`와 `cacheKey`를 출력하고, 원천 목록은 `.maestro-output/ios-native-fingerprint.json`에 기록한다. Expo가 공개하는 `expo/fingerprint`를 사용하며 의존성을 추가하지 않는다.
- `E2E_ANDROID_ABIS`: 미지정은 기존 네 ABI, 지정할 수 있는 값은 이 CI 목적의 `x86_64`뿐이다(그 밖은 빌드 전 exit 1). `E2E_IOS_DERIVED_DATA`: 미지정은 `ios/build`, CI는 `$RUNNER_TEMP/expo-ios-derived-data`. `E2E_IOS_CCACHE=1`은 CI 빌드에서만 Expo의 공식 `ios.ccacheEnabled: true`를 설정한다.

- [ ] **Step 1: 이미 잰 기준과 판정 방식을 기록한다**

`gh run view 36950704982 -R builder-shin/template-typescript-expo --json url,headSha,conclusion,jobs`와 `--log`를 다시 읽는다. 이 실행은 `53e3134`(최종 Redis/오류 출력 고침 전의 통합 앱·빌드 코드)에서 success다. 최종 `2599bf2`는 그 뒤 소유권과 사용자 오류 출력만 고쳤다. D7의 docs-only 기록·main 병합 CI는 실행 시점에 별도로 확인한다. 각 잡의 startedAt/completedAt 차이와 빌드/E2E 단계 시간을 구분해 기록한다.

| 기준 | run 5(축소 전) | 통합 실행 36950704982(축소 후, 잡 전체 / 주요 단계) |
| --- | --- | --- |
| checks | 2.5분 | 2.30분 |
| build-android | 26.0분, Gradle 한 단계 25.4분·네 ABI | 26.62 / e2e APK 25.98분 |
| build-ios | 17.5분, xcodebuild 15.2분 | 15.72 / e2e .app 14.28분 |
| e2e-android FastAPI·NestJS·Rails | 29.7–31.3분 | 28.55·31.50·32.92 / E2E 26.25·29.30·29.58분 |
| e2e-ios FastAPI·NestJS·Rails | 53.6–66.3분 | 41.57·45.50·40.13 / E2E 40.22·43.75·38.80분 |

축소 전의 대응하는 백엔드별 값이 없으므로 축소 자체의 절감은 범위가 내려갔다는 사실로만 쓴다. 이번 최적화의 기준은 축소 후다. Android ABI의 산술 상한은 25.4×3/4=19.05분이지만 Metro·Java·패키징은 공유 비용이므로 실제 절감으로 쓰지 않는다. 목표는 APK 단계 26분→12–18분(8–14분 절감)이며 실제 Gradle/빌드 시간을 보고 판정한다. iOS 캐시의 제거 가능한 비용 상한은 xcodebuild 15.2분(run 5), 축소 후 전체 .app 단계 14.28분이다. warm .app 단계 목표 5–10분, 절감 목표 4–9분이며 cold 실행에는 절감 0으로 기록한다. 목표는 합격 조건이 아니다. 측정한 비용(restore/save·ccache 설치·pod install 포함)이 이득을 지우면 그 변경만 되돌린다.

- [ ] **Step 2: x86_64 APK를 별도 커밋으로 만든다**

`test/unit/scripts/ci-speed.test.ts`의 12시험 중 첫 네 개를 먼저 쓴다: ABI 미지정은 양 Gradle 호출에 기존 기본값을 준다; x86_64는 두 호출 모두 `-PreactNativeArchitectures=x86_64`를 받는다; 알 수 없는 값은 prebuild 전 실패한다; 둘째 호출의 UP-TO-DATE 누락/실행/FROM-CACHE/Gradle 오류는 기존 시험처럼 실패한다. 실제 `android.sh`의 함수를 추출해 fake gradlew 경계만 바꾸어 argv와 종료 코드를 잰다. 새 구현 자체를 시험에 복제하지 않는다.

Modify `test/e2e/android.sh`의 정확한 앵커는 다음 셋이다:

```bash
  local gradle_jvm='-Dorg.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m'
```

```bash
  (cd android && ./gradlew :app:createReleaseUpdatesResources --no-daemon "$gradle_jvm")
```

```bash
  (cd android && ./gradlew assembleRelease --no-daemon --console=plain "$gradle_jvm") | tee "$log" || rc=$?
```

ABI를 검증하고 두 Gradle 실행에 같은 속성을 전달한다. `assemble_release`의 인자를 늘릴 때 기존 함수 시험도 실제 호출 형식에 맞춘다. Metro 두 번 비우기·`--no-daemon`·JVM 값·파이프 종료 코드·정확한 `> Task :app:createReleaseUpdatesResources UP-TO-DATE` 검사는 보존한다. 미지정 기본을 바꾸지 않으므로 Windows의 Task 3 전체 게이트는 네 ABI로 돈다.

`test/e2e/run-android.sh`의 APK 재사용 지문에도 ABI 선택을 넣는다. 정확한 앵커:

```bash
    printf 'BACKEND_URL=%s\n' "$APP_BACKEND_URL"
```

이 줄 바로 뒤에 정규화한 ABI 선택(미지정=기존 네 ABI, 지정=x86_64)을 같은 방식으로 지문에 넣는다. 값만 바꾼 실행이 이전 APK를 재사용하면 안 된다. `ci-speed.test.ts`의 기본값/단일ABI 시험은 실제 build_fingerprint를 호출해 같은 값은 같은 지문, ABI가 달라지면 다른 지문임을 함께 확인한다. stage_sources와 `E2E_APK`의 기존 무빌드 분기는 유지한다. Task 3은 `E2E_ANDROID_ABIS=`를 명시해 CI 전용 인자가 개발 셸에 남아도 로컬 전체 gate가 네 ABI로 돈다.

Modify `.github/workflows/ci.yml`의 정확한 앵커:

```yaml
      - name: e2e APK
        env:
          BACKEND_URL: http://10.0.2.2:4100
        run: test/e2e/android.sh build
```

이 env에 `E2E_ANDROID_ABIS: x86_64`를 더한다. 빌드 뒤 APK의 `lib/` ABI 집합이 정확히 x86_64인지 검사하고, CI emulator의 `ro.product.cpu.abi`가 x86_64임을 E2E 준비 로그로 확인한다. 받은 APK·실제 설치·23플로의 통과까지 확인한다. 설치할 수 없는 ABI APK를 화면 시험 전에 실패시킨다. `.github/workflows/AGENTS.md`의 기존 `build-android` 행에 CI 전용 ABI 선택을 적는다. 커밋: `ci: E2E 에뮬레이터용 APK 를 x86_64 로 빌드한다`.

- [ ] **Step 3: iOS를 두 shard로 나누고 별도 커밋을 만든다**

`test/unit/e2e/flow-shards.test.ts`의 10시험: 실제 디렉터리의 iOS 허용 이름 21개와 Android 전용 둘 제외; 두 집합 합집합 일치; 교집합 없음; 입력 순서가 달라도 같음; 각 shard는 이름순; cold-links 포함; 잘못된 플랫폼 머리말 실패; 잘못된 shard 인자 실패; 빈 입력/빈 shard 실패; 새 iOS 플로도 정확히 한 번 배정. 검증 실패하면 CI가 하네스를 부르지 않는다.

결정 29의 초기 목록은 통합 실행 로그에서 각 `--- <플로>`부터 다음 플로 시작까지 잰 세 백엔드 최대 시간을 근거로 고정한다. 짧은 shard의 목표는 전체 가중치의 약 1/3다. 다섯 macOS 슬롯에서 긴 잡 셋과 짧은 잡 둘을 먼저 실행하고 마지막 짧은 잡을 한 자리 비는 대로 실행하기 위한 분할이다. 같은 수로 반씩 나누면 여섯 번째 잡의 대기로 전체 시간이 거의 그대로일 수 있다.

**shard 1(16플로):** `auth-links cold-links contract-lab-signed-in examples-browse examples-delete examples-empty-notfound examples-scroll-refresh examples-sort-filter guard-return home-build-info login-error-en login-error-ko logout-from-protected register-conflict register-invalid register-restore-logout`.

**shard 2(5플로):** `contract-lab-anonymous examples-create examples-edit examples-invalid-filter-en examples-write-errors`.

두 고정 목록의 이름을 스크립트에 둔다. 새 이름은 이름순으로 처리해 항목 수가 적은 shard로 넣되 동률은 shard 1로 넣는다. 기존 이름이 삭제되면 교집합만 남기고 합집합 검사를 계속 한다. 입력 순서는 결과에 영향을 주지 않는다. Android 전용은 후보에 들어오지 않는다. 초기 목록은 시험이 위 값과 맞댄다. 플로 본문의 단언·timeout은 바꾸지 않는다.

| 백엔드 | shard 1 플로 합계 | shard 2 플로 합계 | 두 합계의 근거 |
| --- | --- | --- | --- |
| fastapi | 21.29분 | 10.91분 | 통합 실행의 플로 시작 간격 |
| nestjs | 24.63분 | 12.25분 | 같은 방식 |
| rails | 20.80분 | 10.62분 | 같은 방식 |

위 값에는 잡의 백엔드 설치·simulator 준비가 빠져 있다. E2E 단계와 플로 합계의 차이는 약 7–8분이고 fastapi shard 1은 request-stall도 돈다. 분할 뒤 잡마다 준비가 반복된다. 다섯 슬롯·여섯 잡의 두 파동을 고려한 iOS 전체 예상은 약 32–40분(현재 가장 긴 잡 45.50분에서 5–13분 절감)이다. GitHub가 matrix 생성 순서대로 러너를 할당한다는 보장은 없으므로 아래 include 순서만으로 절감 달성을 판정하지 않는다. 대기 시간까지 재고 이득이 없는 경우 shard 커밋을 되돌릴 수 있다. 백엔드 한 개만 보면 각 잡은 약 18–33분으로 짧아진다. runner-minutes는 준비 중복 때문에 늘 수 있다.

Modify `.github/workflows/ci.yml`의 정확한 iOS 앵커:

```yaml
  e2e-ios:
    name: e2e-ios (${{ matrix.backend }})
    needs: build-ios
```

이름을 `e2e-ios (${{ matrix.backend }}, shard ${{ matrix.shard }}/2)`로 한다. iOS strategy에 `max-parallel: 5`, include 여섯 행을 **fastapi 1, nestjs 1, rails 1, fastapi 2, nestjs 2, rails 2** 순으로 쓴다. 각각 backend와 숫자 shard를 가진다. `fail-fast: false`·timeout 90·Xcode 26.6는 유지한다. 다른 워크플로가 macOS 슬롯을 쓸 수 있으므로 실제 대기도 기록한다. Android matrix 앵커의 같은 `backend: [fastapi, nestjs, rails]`를 잘못 고치지 않는다.

Modify 같은 파일의 정확한 실행 앵커:

```yaml
          E2E_APP="$app" BACKEND_URL=http://localhost:4100 ./test/e2e/run-ios.sh
```

앞에서 `flows=$(node scripts/e2e-flow-shards.mjs "${{ matrix.shard }}")`를 성공해야 받고 빈 값도 거부한다. `E2E_FLOW="$flows" E2E_APP="$app" ./test/e2e/run-ios.sh`로 호출한다. `E2E_CHECKS`의 iOS 표현은 backend가 fastapi이고 shard가 1일 때만 `'1'`이다. Android fastapi의 checks는 계속 켠다. 따라서 각 플랫폼에서 request-stall의 headers/body 타임아웃 검사는 한 번씩 그대로 돈다. `run-ios.sh`의 실제 필터/가드/정리/R33 레시피는 수정하지 않는다.

Modify 같은 파일의 정확한 아티팩트 이름 앵커 `name: e2e-ios-${{ matrix.backend }}`를 `name: e2e-ios-${{ matrix.backend }}-shard-${{ matrix.shard }}`로 바꾼다. 각 잡은 manifest·실제로 성공/실패한 플로 이름을 기록으로 올린다. 로그와 숨김 Maestro 기록은 기존처럼 14일 보존한다. 백엔드별 두 shard가 같은 main SHA를 받았는지도 최종 게이트에서 확인한다. 최초 확인 값이 다르면 그 실행은 같은 백엔드 입력의 증거로 세지 않고 원인을 조사한다.

`ci-speed.test.ts`의 다음 네 시험: matrix의 backend/shard 곱과 max-parallel; fastapi shard 1만 request-stall; 잘못된 목록/빈 출력은 실행 전 실패; 아티팩트 이름이 여섯 개 모두 다르며 하네스의 기존 정리 실패가 잡 실패로 전파됨. actionlint와 YAML 스키마 검사를 돈다. 커밋: `ci: iOS 백엔드마다 플로를 두 잡으로 나눈다`.

- [ ] **Step 4: 네이티브 fingerprint 캐시를 별도 커밋으로 만든다**

`test/unit/scripts/ios-native-fingerprint.test.ts`의 12시험: 같은 입력의 키 재현; JS 화면만 바꾸면 nativeHash 유지; README만 바꾸면 유지; 의존성/락파일·플러그인·scene opt-in·앱 식별자·BACKEND_URL을 바꾸면 각각 다른 키(다섯 시험); Xcode/SDK·architecture·빌드 레시피·ccache 판은 키가 다름(네 시험). 실제 installed Expo의 공개 `expo/fingerprint` API로 작은 scratch fixture를 재거나 주입할 함수 경계만 가짜로 바꾼다. 직접 의존성이 아닌 `@expo/fingerprint`를 import해 린트 규칙을 깨거나 새 의존성을 추가하지 않는다. 앱 네이티브 입력을 파일명 목록만으로 임의 축소하지 않는다.

`import { createFingerprintAsync } from 'expo/fingerprint'`로 가져온 `createFingerprintAsync(root, { platforms: ['ios'], silent: true })`를 **CNG의 깨끗한 커밋 대상 사본**에서 실행한다. 이 fingerprint는 EAS runtimeVersion 값을 바꾸는 것이 아니라 빌드 캐시 입력이다. 사본은 `android/`·`ios/`·DerivedData·ccache·`.maestro-output/` 없이 만들고 기존 gate [8]처럼 설치본만 참조한다. `APP_VARIANT=e2e BACKEND_URL=http://localhost:4100 EAS_PROJECT_ID= EAS_BUILD_PROJECT_ID= E2E_IOS_CCACHE=1`로 실제 설정을 평가한다. Expo fingerprint hash·`pnpm-lock.yaml`·`ios.sh`와 fingerprint 스크립트의 레시피 hash·`xcodebuild -version`·`xcrun --sdk iphonesimulator --show-sdk-version`·`uname -m`·ccache 판·Release·e2e·backend URL·ccache 활성화를 canonical JSON으로 묶어 SHA-256 키를 만든다. 소스 목록/최종 키는 기록으로 남긴다. 앱 JS 변경 시험에서 nativeHash가 실제로 바뀌면 무시 목록을 넓혀 통과시키지 말고 그 원천을 확인한다.

Modify `app.config.ts`의 정확한 앵커:

```ts
          ios: { enableSceneSupport: true },
```

`enableSceneSupport: true`는 모든 변형에 보존하고, `E2E_IOS_CCACHE === '1'`일 때만 같은 객체에 `ccacheEnabled: true`를 펼친다. 공용 `.env.example`의 세 환경 변수 계약은 그대로이며 이 내부 CI 빌드 인자는 `test/e2e/AGENTS.md`에 적는다. Node type stripping이 되는 구문만 쓴다. 기본 로컬/배포 설정에는 ccache 키를 더하지 않는다.

Modify `test/e2e/ios.sh`의 정확한 앵커 `readonly DERIVED_DATA=ios/build`를 `readonly DERIVED_DATA="${E2E_IOS_DERIVED_DATA:-ios/build}"`로 바꾼다. `PRODUCTS`는 계속 그 값에서 나온다. CI DerivedData는 `ios/` 밖이므로 `prebuild --clean`이 지우지 않는다. `pnpm exec expo prebuild --platform ios --clean >&2`와 Xcode의 build 호출은 계속 매번 실행한다. 캐시의 완성 `.app`을 성공으로 반환하지 않는다. 빌드 전 해당 앱 산출물만 지워 JS 번들·EXConstants가 현재 커밋에서 다시 만들어지도록 하고, 라이브러리 객체·모듈 캐시는 남긴다. RN bundle 단계가 강제로 실제 실행되었는지 빌드 로그에서 확인한다. `assert_signature`·`assert_app`과 받은 앱의 재검사는 그대로다.

Modify `.github/workflows/ci.yml`의 정확한 앵커는 build-ios의 `- name: e2e .app`(유일)다. 그 앞에서 ccache 설치/판 기록 → native key 계산 → `actions/cache/restore@v6`로 DerivedData·`$RUNNER_TEMP/expo-ccache` 복원 → 기존 build의 순서로 실행한다. `CCACHE_DIR`·`CCACHE_BASEDIR=$GITHUB_WORKSPACE`와 `E2E_IOS_DERIVED_DATA`·`E2E_IOS_CCACHE=1`을 build-ios에만 준다. 느슨한 sloppiness 옵션으로 캐시 정확성을 바꾸지 않는다. Swift는 ccache 대상이 아니며 DerivedData가 그 재사용을 담당한다. CocoaPods 다운로드 캐시는 별도로 유지한다.

캐시 primary key는 `ios-native-v1-${nativeKey}-${github.sha}`이고 restore prefix는 **같은 nativeKey까지**다. 다른 네이티브 hash·Xcode·SDK·architecture의 캐시를 fallback으로 받지 않는다. 성공한 build 뒤에만 `actions/cache/save@v6`로 이 커밋 키를 저장한다(같은 SHA 재실행은 exact hit면 저장을 건너뛴다). 저장소별 CI cache라 다른 앱은 공유하지 않는다. 원격 캐시에 `.env`·백엔드·토큰을 넣지 않는다. ccache 통계와 restore/save 시간, `xcodebuild -showBuildTimingSummary` 출력은 `ios-build-log`에 함께 올린다. ccache enable 전에 pod install이 `apple.ccacheEnabled=true`를 읽고 실제 Clang wrapper를 쓰는지 로그로 확인한다.

`ci-speed.test.ts`의 마지막 네 시험: 기본 DerivedData는 기존 위치/CI override만 다른 위치; prebuild clean 뒤에도 CI DerivedData 보존; cache miss와 hit 둘 다 Xcode·현재 JS bundle·assert-app 실행; native/toolchain 불일치 cache를 받지 않고 save는 성공 뒤만. 실제 shell의 fake xcodebuild/pnpm/plutil/codesign 경계로 각 경우를 재고, 기존 서명 시험도 돈다. 커밋: `ci: iOS 네이티브 입력별로 컴파일 캐시를 재사용한다`.

- [ ] **Step 5: 범위 검사 후 cold/warm을 측정한다**

새 단위 34개와 기존 하네스 시험·typecheck·lint·format·actionlint를 모두 통과시킨다. 셸 Bash 3.2 호환과 source helper `ios-simulator.sh`의 100644를 보존한다. 다음 기존 문서 앵커도 해당 코드 커밋에서 고친다.

- `.github/workflows/AGENTS.md`: 유일한 행 시작 ``| `e2e-ios` × 3``를 두 shard/백엔드의 ×6 행으로 바꾼다. 정확한 기존 문장 ``- 멈춘 서버 확인(`E2E_CHECKS=1`)은 백엔드와 무관해 fastapi 갈래에서만 켠다.``는 Android fastapi와 iOS fastapi shard1에서 켠다고 바꾼다. 기존 `## 작업 규칙` 바로 뒤에 macOS 최대5/실제 대기·두 manifest 합집합21 무중복·새 shard 아티팩트 이름·native cache의 성공 저장/현재 JS 재빌드 규칙을 더한다. Xcode 판은 build-ios와 여섯 E2E 잡 모두 26.6다.
- `test/e2e/AGENTS.md`: 기존 `## iOS` 바로 뒤에 CI 전용 `E2E_ANDROID_ABIS`·`E2E_IOS_DERIVED_DATA`·`E2E_IOS_CCACHE`의 기본값과 허용값, 두 shard의 `E2E_FLOW` 전달 및 manifests를 적는다. 소유 simulator의 서비스 축소·AutoFill/scheme 설정·한 번 재부팅 순서는 그대로 둔다. Task 2의 같은 제목 앞 Windows 설명 삽입과 충돌하지 않는다.

코드/문서 첫 push를 하기 전 Task 1 Step 1의 D7 main 초록 확인을 먼저 한다(이 확인은 Task 0의 선행 조건이기도 하다). Task 3 Step 4–6의 동일한 push/조회/실패 진단 절차를 사용해 첫 실행을 cold로 잰다. ABI와 sharding은 D7 통합 기준과 비교하고, cache miss와 ccache miss·원천 목록을 남긴다. 세 변경을 함께 보냈어도 각각의 커밋/단계 시간으로 효과를 구분하고, 비교 불가능하면 절감값을 확정하지 않는다.

warm 측정은 앱/의존성/네이티브 입력이 같은 다음 실행에서 한다. 첫 실행에 build-ios env `CI_CACHE_MEASUREMENT: cold`를 기록용으로 넣고, 다음 커밋은 **그 한 줄만** `CI_CACHE_MEASUREMENT: warm`으로 바꾸어 push한다. 이 변수는 app.config/빌드 판단에서 읽지 않고 로그에만 남긴다. 따라서 동일 코드를 retry하는 것이 아니라 cache 경로를 검증하는 명시된 새 설정 커밋이다. native key가 같은지 먼저 확인하며, restore/save 포함 잡 전체와 xcodebuild 단계·ccache hit를 cold/warm으로 비교한다. cache hit인데 예전 JS가 들어가는 고침은 합격이 아니다. 실제 앱 빌드 정보/현재 번들·서명 단언과 모든 shard를 계속 검증한다.

증거는 Task 2가 만드는 D8 기록 G4로 옮긴다. Task 1이 expo-dev-client를 설치하면 native key가 바뀌므로 Task 3의 첫 최종 실행은 cold일 수 있다. 이 경우 warm 절감은 Task 0의 동일 native key 쌍으로만 주장한다. 문서만 바꾸는 docs-only commit으로 warm 실행을 만들지 않는다.

조건 2의 논리 아홉 칸과 물리 12잡 전부 success, Android 백엔드마다 23개·계약 94개, iOS 백엔드마다 shard 1의 16개와 shard 2의 5개(합21), 각 플랫폼 fastapi request-stall가 둘 다 성공해야 측정 결과를 받는다. 실패하면 원인을 고쳐 새 실행을 만들며 네 실행 상한은 Task 3과 공유한다. 효과를 확정할 수 없는 변경은 그 커밋만 revert하고 범위는 그대로 검증한다. revert하면 Task 2·3의 해당 문서/잡 수/시험 예상 수를 실제 살아 있는 변경으로 다시 계산한다(분할만 되돌리면 물리9잡·iOS21 전체, 논리9는 유지). 다른 최적화를 함께 되돌리지 않는다. 별도 승인 없는 범위 축소로 시간을 줄이지 않는다.

스펙 `## 14. 문서`(2599bf2에 한 번) 바로 앞에 날짜 `정정(2026-10-02, D8 CI 최적화)`로 iOS 논리 셀의 두 shard·물리12·ABI/캐시·범위 보존을 기록한다. 최종 초록 주소/시간은 계획을 쓸 때 값을 만들어 넣지 않고 실행 기록 G4에 실제 값으로 적는다.

---
### Task 1: 코드 마감 — 개발 클라이언트, 네트워크 복귀 판정, 오류 경계의 다시 시도

**Files:**
- Modify: `docs/provenance/copied-core.json`(기존 check-citations 이탈 설명), `test/unit/config/eas-json.test.ts`, `test/unit/platform/e2e-diagnostics.test.ts`, `test/unit/e2e/guard-log.test.ts`, `test/unit/scripts/check-citations.test.ts`, `package.json`·`pnpm-lock.yaml`(`expo install expo-dev-client`), `lib/config/app-variant.ts`, `app.config.ts`, `scripts/check-variant-config.mjs`, `test/unit/config/app-variant.test.ts`, `test/unit/config/app-config.test.ts`, `test/unit/scripts/check-variant-config.test.ts`, `platform/query-client.ts`, `app/_layout.tsx`, `lib/config/AGENTS.md`, `lib/jsonapi/AGENTS.md`, `platform/AGENTS.md`, `queries/AGENTS.md`, 스펙(8.5·9.3·10.5 정정)
- Create: `lib/jsonapi/online.ts`, `test/unit/jsonapi/online.test.ts`, `queries/error-boundary.ts`, `test/unit/queries/error-boundary.test.ts`
- 임시(git 이 무시한다): `.maestro-output/d8-introspect-<변형>.json`, `.maestro-output/d8-static.log`

**Interfaces:**
- Consumes: `variantProfile(variant): VariantProfile`(`lib/config/app-variant.ts` - D1·D6), `BASE_APP_ID`·`BASE_SCHEME`·`BASE_NAME`(`app.config.ts`), `onlineManager.setEventListener`(`platform/query-client.ts` 의 `useQueryRefetchTriggers` - D3), `queryClient`(`platform/query-client.ts`), `detailQueryOptions(resource, id, send)`·`SCREEN_QUERY_GC_TIME`(`queries/resource-options.ts` - D3·D4), `detailScreen(resource, { result, error })`(`lib/resources/screen-state.ts`), `ErrorBoundary`·`ErrorBoundaryProps`(`expo-router`)
- Produces:
  - `lib/config/app-variant.ts`: `VariantProfile.devClientScheme: boolean`(development 만 `true`)
  - `app.config.ts`: `export const SLUG = 'template-typescript-expo'`, `export const DEV_CLIENT_SCHEME: string`(`exp+template-typescript-expo`), `plugins` 의 `['expo-dev-client', { addGeneratedScheme: boolean }]`
  - `lib/jsonapi/online.ts`: `isOnline(isConnected: boolean | null): boolean`
  - `queries/error-boundary.ts`: `retryWithClearedQueries(client: QueryClient, retry: () => Promise<void>): Promise<void>`
  - `app/_layout.tsx`: `export function ErrorBoundary({ error, retry }: ErrorBoundaryProps)` - Expo Router 의 기본 화면에 `retryWithClearedQueries(queryClient, retry)` 를 넘긴다

- [ ] **Step 1: 브랜치·D7 의 끝·`main` 의 실행을 확인한다 (읽기만)**

브랜치는 컨트롤러가 D7 이 병합된 `main` 에서 만들었고 이 계획이 첫 커밋으로 들어 있다(전역 제약). 여기서는 확인만 한다.

```bash
export GIT_TERMINAL_PROMPT=0 GIT_PAGER=cat
git branch --show-current
git status --short
git log --oneline -3
timeout 120 git fetch origin
git rev-parse --short main
git rev-parse --short origin/main
git log --merges --oneline -1 main
ls docs/superpowers/plans/2026-10-01-d7-ci.md docs/superpowers/notes/2026-10-01-d4-measurements.md docs/superpowers/notes/2026-10-01-d5-measurements.md docs/superpowers/notes/2026-10-01-d6-measurements.md docs/superpowers/notes/2026-10-01-d7-measurements.md .github/workflows/ci.yml .github/workflows/AGENTS.md eas.json components/app/back-to-home.ts components/app/home-button.tsx lib/auth/error-detail.ts queries/resource-options.ts lib/lab/run.ts lib/updates/build-info.ts test/e2e/run-ios.sh test/e2e/request-counts.ts test/e2e/subflows/back.yaml test/e2e/flows/examples-delete-offline.yaml test/e2e/flows/cold-links.yaml test/e2e/ios-simulator.sh test/e2e/ios-simulator.ts platform/e2e-diagnostics.ts lib/auth/guard-latch.ts test/unit/support/bash.ts test/contract/write-paths.test.ts test/unit/e2e/flows.test.ts
git grep -c "expo-dev-client\|devClientScheme" -- package.json app.config.ts lib/config/app-variant.ts || echo "개발 클라이언트 없음"
git grep -n "ErrorBoundary" -- app || echo "경계 없음"
grep -E "^[A-Z_]+=" .env.example
timeout 60 gh run list -R builder-shin/template-typescript-expo --branch main --limit 1 --json headSha,status,conclusion,url --jq '.[0] | [.headSha[0:7], .status, .conclusion, .url] | @tsv'
timeout 300 pnpm test 2>&1 | grep -E "Test Files|Tests "
node scripts/check-provenance.mjs | tail -n 1
ls test/e2e/flows | wc -l
grep -l "e2e-platforms: android" test/e2e/flows/*.yaml
git ls-tree -r HEAD scripts/ test/e2e/ test/contract/ | grep -E "\.sh$" | awk '{print $1, $4}'
```

Expected: 브랜치 `feat/d8-docs-and-release`, 작업 트리 깨끗, Task 0 전이면 머리는 계획 커밋, Task 0 뒤이면 독립 최적화/측정 커밋도 있다, `main` 과 `origin/main` 의 짧은 SHA 가 같다, 마지막 병합 커밋이 D7 의 것(`merge: D7 …`), 나열한 실제 파일이 다 있다(최신 cold-links·ios-simulator helpers·diagnostics·guard-latch·support/bash·write-paths도 확인한다), `개발 클라이언트 없음`, `app/_layout.tsx:<줄>:export { ErrorBoundary } from 'expo-router'` 한 줄, `.env.example` 의 세 줄(`BACKEND_URL=…`·`APP_VARIANT=development`·`EAS_PROJECT_ID=`), `main` 의 마지막 실행이 `main` 의 SHA 에서 `completed	success`, 단위 시험 D7 그대로라면 `95 files / 1914 tests`, Task 0 뒤라면 `98 files / 1948 tests`(재검증 트리는 `95`·`1914` 였다 - 전제 표), `복사 출처 기록 통과: 54 경로 · 42 이탈 · 33 원본 그대로`, 플로 `23` 와 Android 전용 둘(`examples-offline-refetch`·`examples-delete-offline` - iOS 는 21), 실행 진입점 열은 `100755`, source helper ios-simulator.sh는 `100644`(총11개). D7의 기준 N=1914·F=95와 Task 0 뒤의 수(N0=1948·F0=98)를 구분해 적어 둔다. 출처 기록의 수·플로 수를 적어 둔다 - 뒤의 "늘어난다" 는 이 수에서 센다. `main` 의 실행이 초록이 아니거나(빨강·진행 중·실행 없음) 파일이 빠졌으면 멈추고 컨트롤러에 알린다 - 이 계획은 초록인 `main` 에서 시작한다(D7 다음 계획 2). D4–D7 의 글자가 이 계획의 앵커와 다르면 "D4–D7 병합 뒤 다시 볼 자리" 절부터 본다(결정 24).

- [ ] **Step 2: 개발 클라이언트 - 실패하는 시험을 쓴다**

(a) 변형마다의 표에 새 칸을 적는다.

`test/unit/config/app-variant.test.ts` — Edit, 찾을 것:

```ts
      updatesChannel: null,
    })
    expect(variantProfile('preview')).toEqual({
```

바꿀 것:

```ts
      updatesChannel: null,
      devClientScheme: true,
    })
    expect(variantProfile('preview')).toEqual({
```

같은 파일에 Edit, 찾을 것:

```ts
      updatesChannel: 'preview',
    })
```

바꿀 것:

```ts
      updatesChannel: 'preview',
      devClientScheme: false,
    })
```

같은 파일에 Edit, 찾을 것:

```ts
      updatesChannel: 'production',
    })
```

바꿀 것:

```ts
      updatesChannel: 'production',
      devClientScheme: false,
    })
```

같은 파일에 Edit, 찾을 것:

```ts
      logsHttpFailures: true,
      updatesChannel: null,
    })
```

바꿀 것:

```ts
      logsHttpFailures: true,
      updatesChannel: null,
      devClientScheme: false,
    })
```

같은 파일에 Edit, 찾을 것:

```ts
  it('접미사가 서로 겹치지 않는다 - 한 기기에 함께 설치할 수 있어야 한다', () => {
```

바꿀 것:

```ts
  it('개발 클라이언트의 scheme 은 development 에만 싣는다 - 여러 변형에 실리면 딥링크가 갈 곳이 정해지지 않는다', () => {
    expect(APP_VARIANTS.filter((variant) => variantProfile(variant).devClientScheme)).toEqual([
      'development',
    ])
  })

  it('접미사가 서로 겹치지 않는다 - 한 기기에 함께 설치할 수 있어야 한다', () => {
```

(b) 설정이 플러그인과 scheme 을 내보내는지 잰다.

`test/unit/config/app-config.test.ts` — Edit, 찾을 것:

```ts
import appConfig, { BASE_APP_ID, BASE_NAME, BASE_SCHEME } from '@/app.config'
```

바꿀 것:

```ts
import appConfig, {
  BASE_APP_ID,
  BASE_NAME,
  BASE_SCHEME,
  DEV_CLIENT_SCHEME,
  SLUG,
} from '@/app.config'
```

같은 파일에 Edit, 찾을 것:

```ts
describe('app.config.ts 의 OTA - 스펙 10.1·10.6', () => {
```

바꿀 것:

```ts
describe('app.config.ts 의 개발 클라이언트 - 스펙 1.2·10.5', () => {
  function devClientPlugin(config: ExpoConfig): unknown {
    return config.plugins?.find(
      (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-dev-client',
    )
  }

  it('development 만 개발 클라이언트의 scheme 을 싣는다', () => {
    expect(devClientPlugin(evaluate({ BACKEND_URL: 'http://probe-backend:4321' }))).toEqual([
      'expo-dev-client',
      { addGeneratedScheme: true },
    ])
    expect(
      devClientPlugin(evaluate({ BACKEND_URL: 'http://probe-backend:4321', APP_VARIANT: 'e2e' })),
    ).toEqual(['expo-dev-client', { addGeneratedScheme: false }])
  })

  it('개발 클라이언트의 scheme 은 slug 에서 나온다 - 설정 플러그인의 규칙 그대로', () => {
    expect(SLUG).toBe('template-typescript-expo')
    expect(DEV_CLIENT_SCHEME).toBe('exp+template-typescript-expo')
  })
})

describe('app.config.ts 의 OTA - 스펙 10.1·10.6', () => {
```

(c) 검사기 시험의 표본이 introspect 의 실제 모양(사실 절의 표)을 따르게 한다.

`test/unit/scripts/check-variant-config.test.ts` — Edit, 찾을 것:

```ts
const PROJECT_ID = '00000000-0000-4000-8000-000000000000'
```

바꿀 것:

```ts
const PROJECT_ID = '00000000-0000-4000-8000-000000000000'
// 개발 클라이언트(expo-dev-client)가 slug(template-typescript-expo)로 만드는 scheme - development 에만 실린다.
const DEV_CLIENT_SCHEME = 'exp+template-typescript-expo'
```

같은 파일에 Edit, 찾을 것:

```ts
  { id: string; scheme: string; name: string; cleartext: boolean; channel: string | null }
```

바꿀 것:

```ts
  {
    id: string
    scheme: string
    name: string
    cleartext: boolean
    channel: string | null
    devClient: boolean
  }
```

같은 파일에 Edit, 찾을 것:

```ts
    channel: null,
  },
  preview: {
```

바꿀 것:

```ts
    channel: null,
    devClient: true,
  },
  preview: {
```

같은 파일에 Edit, 찾을 것:

```ts
    channel: 'preview',
  },
```

바꿀 것:

```ts
    channel: 'preview',
    devClient: false,
  },
```

같은 파일에 Edit, 찾을 것:

```ts
    channel: 'production',
  },
```

바꿀 것:

```ts
    channel: 'production',
    devClient: false,
  },
```

같은 파일에 Edit, 찾을 것:

```ts
    name: 'Template Expo (E2E)',
    cleartext: true,
    channel: null,
  },
```

바꿀 것:

```ts
    name: 'Template Expo (E2E)',
    cleartext: true,
    channel: null,
    devClient: false,
  },
```

같은 파일에 Edit, 찾을 것:

```ts
  const strings = [{ $: { name: 'app_name' }, _: native.name }]
```

바꿀 것:

```ts
  const strings = [{ $: { name: 'app_name' }, _: native.name }]
  // 설정 플러그인이 변형의 scheme 뒤에 더한다(introspect 에서 잰 순서)
  const devClient = native.devClient ? [DEV_CLIENT_SCHEME] : []
```

같은 파일에 Edit, 찾을 것:

```ts
                        { data: [{ $: { 'android:scheme': native.scheme } }] },
```

바꿀 것:

```ts
                        {
                          data: [native.scheme, ...devClient].map((scheme) => ({
                            $: { 'android:scheme': scheme },
                          })),
                        },
```

같은 파일에 Edit, 찾을 것:

```ts
            CFBundleURLTypes: [{ CFBundleURLSchemes: [native.scheme, native.id] }],
```

바꿀 것:

```ts
            CFBundleDisplayName: native.name,
            CFBundleURLTypes: [
              { CFBundleURLSchemes: [native.scheme, native.id] },
              ...devClient.map((scheme) => ({ CFBundleURLSchemes: [scheme] })),
            ],
```

같은 파일에 Edit - 실패 표에 둘을 더한다. 찾을 것:

```ts
    [
      '앱 설정의 변형이 다르다',
```

바꿀 것:

```ts
    [
      'iOS 앱 이름이 다르다',
      'preview' as const,
      null,
      (config: Introspected) => {
        config._internal.modResults.ios.infoPlist.CFBundleDisplayName = '다른 앱 이름'
      },
      'iOS 앱 이름',
    ],
    [
      'iOS 앱 이름이 빠졌다',
      'production' as const,
      null,
      (config: Introspected) => {
        Reflect.deleteProperty(config._internal.modResults.ios.infoPlist, 'CFBundleDisplayName')
      },
      'iOS 앱 이름',
    ],
    [
      'development 에 개발 클라이언트의 scheme 이 없다(Android)',
      'development' as const,
      null,
      (config: Introspected) => {
        const [application] = config._internal.modResults.android.manifest.manifest.application
        const filter = application?.activity[0]?.['intent-filter'][1]
        if (filter?.data !== undefined) filter.data = filter.data.slice(0, 1)
      },
      'Android 딥링크 scheme',
    ],
    [
      'e2e 에 개발 클라이언트의 scheme 이 실렸다(iOS)',
      'e2e' as const,
      null,
      (config: Introspected) => {
        config._internal.modResults.ios.infoPlist.CFBundleURLTypes.push({
          CFBundleURLSchemes: [DEV_CLIENT_SCHEME],
        })
      },
      'iOS URL scheme',
    ],
    [
      '앱 설정의 변형이 다르다',
```

같은 검사기 시험에 Edit — D7 scene 검사가 더한 성공 건수도 m7을 포함한다. 찾을 것 `18건, OTA 끔` — 바꿀 것 `19건, OTA 끔`.
같은 파일에 Edit, 찾을 것 `22건, OTA 켬(채널 ${channel})` — 바꿀 것 `23건, OTA 켬(채널 ${channel})`.
같은 파일에 Edit, 찾을 것 `OTA 를 끈 설정이 18개` — 바꿀 것 `OTA 를 끈 설정이 19개`.
같은 파일에 Edit, 찾을 것 `더해져 22개다` — 바꿀 것 `더해져 23개다`.

```bash
timeout 300 pnpm exec vitest run test/unit/config/app-variant.test.ts test/unit/config/app-config.test.ts test/unit/scripts/check-variant-config.test.ts 2>&1 | grep -E "×|Test Files|Tests "
```

Expected: 개발 클라이언트·m7 검사/표본이 아직 구현되지 않았으므로 red다. D7 기준의 기존 scheme 변경만으로 9 failed / 74 passed(83)였고, m7 표본/실패 행을 더하면 성공 줄과 이름 실패도 red에 참여한다. 실패 개수보다 실패 이유를 확인한다. 최종 green은 이 세 파일 85개다(기존 D7 78 + 개발 클라이언트5 + m7 2).

- [ ] **Step 3: 개발 클라이언트를 받고 구현한다**

(a) 받는다:

```bash
BACKEND_URL=https://gate-check.invalid timeout 300 pnpm exec expo install expo-dev-client
grep '"expo-dev-client"' package.json
node -p "require('expo-dev-client/package.json').version"
timeout 300 pnpm install --frozen-lockfile
```

Expected: `› Installing 1 SDK 57.0.0 compatible native module using pnpm` 와 `+ expo-dev-client ~57.0.19`(설정이 동적이라 플러그인을 자동으로 적지 못한다는 안내가 나오면 정상이다 - 아래 (c) 가 적는다), `"expo-dev-client": "~57.0.19",`, `57.0.19`, 설치가 락파일 그대로 끝난다. `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` 이면 멈추고 컨트롤러에 알린다 - 꾸러미와 의존성은 2026-09-11 이전 릴리스라 걸리지 않아야 한다(사실 절). `pnpm-workspace.yaml` 에 예외를 더해 덮지 않는다.

(b) 변형 표에 칸을 더한다.

`lib/config/app-variant.ts` — Edit, 찾을 것:

```ts
  readonly updatesChannel: string | null
}
```

바꿀 것:

```ts
  readonly updatesChannel: string | null
  /**
   * 개발 클라이언트(expo-dev-client)가 slug 로 만드는 scheme(`exp+<slug>`)을 싣는가. development 만 싣는다 - 그
   * scheme 은 변형과 무관하게 이름이 같아서, 여러 변형에 실리면 한 기기에 함께 설치한 변형 가운데 어디로 갈지 정해지지
   * 않는다(스펙 10.2 의 D1 정정). 개발 서버의 번들을 개발 클라이언트로 여는 링크라 다른 변형에는 쓸 곳이 없다.
   */
  readonly devClientScheme: boolean
}
```

같은 파일의 `PROFILES` 에 Edit 넷 - 찾을 것:

```ts
    updatesChannel: null,
  },
  preview: {
```

바꿀 것:

```ts
    updatesChannel: null,
    devClientScheme: true,
  },
  preview: {
```

찾을 것:

```ts
    updatesChannel: 'preview',
  },
```

바꿀 것:

```ts
    updatesChannel: 'preview',
    devClientScheme: false,
  },
```

찾을 것:

```ts
    updatesChannel: 'production',
  },
```

바꿀 것:

```ts
    updatesChannel: 'production',
    devClientScheme: false,
  },
```

찾을 것:

```ts
    logsHttpFailures: true,
    updatesChannel: null,
  },
```

바꿀 것:

```ts
    logsHttpFailures: true,
    updatesChannel: null,
    devClientScheme: false,
  },
```

(c) 설정이 slug·scheme 을 내보내고 플러그인을 싣는다.

`app.config.ts` — Edit, 찾을 것:

```ts
export const BASE_NAME = 'Template Expo'
```

바꿀 것:

```ts
export const BASE_NAME = 'Template Expo'
/** Expo 프로젝트의 slug - EAS 프로젝트의 slug 와 같아야 한다. */
export const SLUG = 'template-typescript-expo'
/**
 * 개발 클라이언트(expo-dev-client)가 slug 로 만드는 scheme - 그 설정 플러그인의 규칙 그대로다(URI scheme 에 못 쓰는
 * 글자를 빼고 소문자로, 앞에 `exp+`). development 변형만 싣는다(lib/config/app-variant.ts 의 devClientScheme). 게이트
 * [8] 이 설정 플러그인이 실제로 더한 값과 맞댄다(scripts/check-variant-config.mjs).
 */
export const DEV_CLIENT_SCHEME = `exp+${SLUG.replace(/[^A-Za-z0-9+\-.]/g, '').toLowerCase()}`
```

같은 파일에 Edit, 찾을 것 `    slug: 'template-typescript-expo',` — 바꿀 것 `    slug: SLUG,`.

같은 파일에 Edit, 찾을 것:

```ts
      ['expo-secure-store', { configureAndroidBackup: true, faceIDPermission: false }],
    ],
```

바꿀 것:

```ts
      ['expo-secure-store', { configureAndroidBackup: true, faceIDPermission: false }],
      // 개발 클라이언트(스펙 1.2 - 개발은 development build 로 한다). 그 플러그인은 기본으로 모든 변형에 같은 scheme
      // (exp+<slug>)을 더한다 - development 에만 싣는다(lib/config/app-variant.ts 의 devClientScheme). release 빌드의
      // 개발 런처는 빈 구현이라 e2e·배포 변형의 동작은 바뀌지 않는다.
      ['expo-dev-client', { addGeneratedScheme: profile.devClientScheme }],
    ],
```

(d) 검사기가 같은 칸에서 기대값을 만든다.

`scripts/check-variant-config.mjs` — Edit, 찾을 것:

```js
import { BASE_APP_ID, BASE_NAME, BASE_SCHEME } from '../app.config.ts'
```

바꿀 것:

```js
import { BASE_APP_ID, BASE_NAME, BASE_SCHEME, DEV_CLIENT_SCHEME } from '../app.config.ts'
```

같은 파일에 Edit, 찾을 것:

```js
  const scheme = `${BASE_SCHEME}${profile.schemeSuffix}`
  const runtimeVersion = updates.enabled ? FINGERPRINT_SENTINEL : undefined
```

바꿀 것:

```js
  const scheme = `${BASE_SCHEME}${profile.schemeSuffix}`
  // 개발 클라이언트의 scheme 은 설정 플러그인이 변형의 scheme 뒤에 더한다 - development 만(devClientScheme)
  const devClient = profile.devClientScheme ? [DEV_CLIENT_SCHEME] : []
  const runtimeVersion = updates.enabled ? FINGERPRINT_SENTINEL : undefined
```

같은 파일에 Edit, 찾을 것 `  expectValue('Android 딥링크 scheme', androidSchemes, [scheme])` — 바꿀 것 `  expectValue('Android 딥링크 scheme', androidSchemes, [scheme, ...devClient])`.

같은 파일에 Edit, 찾을 것 `  expectValue('iOS URL scheme', iosSchemes, [scheme, appId])` — 바꿀 것 `  expectValue('iOS URL scheme', iosSchemes, [scheme, appId, ...devClient])`.

같은 파일에 Edit — D6 m7의 앱 이름을 실제 Info.plist에서 맞댄다. 찾을 것:

```js
  expectValue('iOS 번들 ID', config?.ios?.bundleIdentifier, appId)
```

바꿀 것:

```js
  expectValue('iOS 번들 ID', config?.ios?.bundleIdentifier, appId)
  expectValue('iOS 앱 이름', ios?.infoPlist?.CFBundleDisplayName, `${BASE_NAME}${profile.nameSuffix}`)
```


(e) 시험이 통과하고, 실제 introspect 가 사실 절의 표와 같은지 본다:

```bash
timeout 300 pnpm exec vitest run test/unit/config/app-variant.test.ts test/unit/config/app-config.test.ts test/unit/scripts/check-variant-config.test.ts 2>&1 | grep -E "×|Test Files|Tests "
mkdir -p .maestro-output
for v in development preview production e2e; do
  APP_VARIANT=$v BACKEND_URL=https://gate-check.invalid EAS_PROJECT_ID= EAS_BUILD_PROJECT_ID= timeout 300 pnpm exec expo config --type introspect --json > ".maestro-output/d8-introspect-$v.json"
  node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/check-variant-config.mjs "$v" '' < ".maestro-output/d8-introspect-$v.json"
done
node -e 'for (const v of ["development", "preview", "production", "e2e"]) { const c = JSON.parse(require("fs").readFileSync(`.maestro-output/d8-introspect-${v}.json`, "utf8")); const a = c._internal.modResults.android.manifest.manifest.application[0]; const and = (a.activity || []).flatMap((x) => x["intent-filter"] || []).flatMap((f) => f.data || []).map((d) => d.$["android:scheme"]).filter(Boolean); const ios = (c._internal.modResults.ios.infoPlist.CFBundleURLTypes || []).flatMap((t) => t.CFBundleURLSchemes || []); console.log(v, JSON.stringify(and), JSON.stringify(ios)) }'
```

Expected: `Tests  85 passed (85)`(Step 2 와 같은 수의 통과), 검사기 넷이 `변형 설정 통과: <변형> - 19건, OTA 끔`, 마지막 네 줄이 사실 절의 표와 같다 - `development ["templateexpo-dev","exp+template-typescript-expo"] ["templateexpo-dev","com.example.templateexpo.dev","exp+template-typescript-expo"]`, 나머지 셋은 개발 클라이언트의 scheme 이 없다. 순서가 다르면(같은 집합) 검사기의 두 기대 줄과 시험 표본의 순서를 잰 순서로 맞추고 그 사실을 Step 4 의 정정 끝에 한 문장 더한다(결정 5). 집합이 다르면(다른 변형에도 실렸다·development 에 없다) `app.config.ts` 의 플러그인 항목을 다시 보고, 그래도 다르면 멈추고 컨트롤러에 알린다.

- [ ] **Step 4: 개발 클라이언트의 문서와 스펙 정정, 첫 커밋**

`lib/config/AGENTS.md` 끝에 더한다:

```markdown

`app-variant.ts` 의 `devClientScheme` 은 개발 클라이언트(`expo-dev-client`)가 slug 로 만드는 scheme(`exp+<slug>`)을
실을 변형이다 - development 만. `app.config.ts` 가 그 설정 플러그인의 `addGeneratedScheme` 으로 옮기고(그 플러그인의
기본은 모든 변형에 싣는 것이다), 검사기가 introspect 에서 그 scheme 이 development 의 Android·iOS 끝에만 있는지 본다.
```

스펙 — `### 10.6 OTA 업데이트` 바로 앞(10.5 의 D6 정정 뒤)에 더한다:

```markdown
> 정정(2026-10-01, D8): `expo-dev-client`(~57.0.19)를 설치했다 - `development` 프로필의 `developmentClient` 가 그것을
> 요구하고(위 D6 정정), 개발은 development build 로 한다(1.2). 그 설정 플러그인이 기본으로 모든 변형에 더하는 scheme
> `exp+template-typescript-expo` 는 `development` 에만 싣는다(`lib/config/app-variant.ts` 의 `devClientScheme`,
> `app.config.ts` 의 `addGeneratedScheme`) - 10.2 의 D1 정정(변형마다 다른 scheme)을 지킨다. 게이트 [8] 이 네 변형의
> introspect 에서 그 scheme 이 development 의 Android·iOS 에만 있는지 잰다. release 빌드의 개발 런처는 빈 구현이라
> e2e·배포 변형의 동작은 바뀌지 않는다. iOS 의 Info.plist 에는 모든 변형에 로컬 네트워크 키(`NSBonjourServices`)가
> 더해지고, Debug 가 아닌 빌드에서 그 플러그인의 빌드 단계가 지운다.
```

```bash
pnpm exec prettier --write lib/config/AGENTS.md test/unit/config/app-variant.test.ts test/unit/config/app-config.test.ts test/unit/scripts/check-variant-config.test.ts app.config.ts lib/config/app-variant.ts scripts/check-variant-config.mjs
timeout 300 pnpm typecheck && timeout 300 pnpm lint && timeout 300 pnpm format:check && echo "static ok"
git status --short
git add package.json pnpm-lock.yaml lib/config/app-variant.ts app.config.ts scripts/check-variant-config.mjs test/unit/config/app-variant.test.ts test/unit/config/app-config.test.ts test/unit/scripts/check-variant-config.test.ts lib/config/AGENTS.md docs/superpowers/specs/2026-09-30-expo-jsonapi-template-design.md
git commit -m "feat: 개발 클라이언트를 설치하고 그 scheme 을 development 변형에만 실어 게이트 [8] 이 잰다"
```

Expected: `static ok`(typecheck 는 `.expo/types` 가 없으면 `BACKEND_URL=https://gate-check.invalid timeout 300 pnpm types:routes` 를 먼저 돈다), `git status` 에 이 단계의 파일만 있다(`.maestro-output/` 은 무시된다), 커밋 하나.

- [ ] **Step 5: 네트워크 복귀의 판정을 lib 로 옮긴다 (실패하는 시험 → 구현)**

`test/unit/jsonapi/online.test.ts` 를 만든다:

```ts
import { describe, expect, it } from 'vitest'

import { isOnline } from '@/lib/jsonapi/online'

describe('isOnline - NetInfo 의 연결 상태 → Query 의 온라인 여부(스펙 8.5)', () => {
  it('연결돼 있으면 온라인이다', () => {
    expect(isOnline(true)).toBe(true)
  })

  it('끊겼다고 확실히 말할 때만 오프라인이다', () => {
    expect(isOnline(false)).toBe(false)
  })

  it('아직 모르면(null) 온라인으로 본다 - 끊김 → 연결을 지어내 켜지자마자 다시 부르지 않는다', () => {
    expect(isOnline(null)).toBe(true)
  })
})
```

```bash
timeout 300 pnpm exec vitest run test/unit/jsonapi/online.test.ts 2>&1 | grep -E "FAIL|Error|Tests " | head -5
```

Expected: 모듈을 찾지 못해 실패한다(`Cannot find package '@/lib/jsonapi/online'` 또는 같은 뜻), `Tests  no tests`.

`lib/jsonapi/online.ts` 를 만든다:

```ts
/**
 * 기기의 연결 상태에서 TanStack Query 의 온라인 여부를 정한다(스펙 8.5) - platform/query-client.ts 가 NetInfo 의
 * isConnected 를 넘긴다. 연결이 돌아오는 것(오프라인 → 온라인)이 재조회의 계기다.
 *
 * null 은 아직 모르는 것이다 - 끊겼다고 보지 않는다. 앱이 켜진 직후 NetInfo 가 처음 알리기 전의 값이 null 이라,
 * 그것을 끊김으로 보면 곧 이어지는 연결 알림이 끊김 → 연결을 지어내 앱이 켜지자마자 조회를 한 번 더 부른다. 끊겼다고
 * 확실히 말할 때(false)만 오프라인이다.
 */
export function isOnline(isConnected: boolean | null): boolean {
  return isConnected !== false
}
```

`platform/query-client.ts` — Edit, 찾을 것:

```ts
import { isSessionRejected } from '@/lib/resources/write'
```

바꿀 것:

```ts
import { isOnline } from '@/lib/jsonapi/online'
import { isSessionRejected } from '@/lib/resources/write'
```

같은 파일에 Edit, 찾을 것:

```ts
        // isConnected 가 null 이면 아직 모르는 것이다 - 끊겼다고 보지 않는다. 끊김→연결을 지어내면
        // 앱이 켜지자마자 조회를 한 번 더 부른다.
        setOnline(state.isConnected !== false)
```

바꿀 것:

```ts
        setOnline(isOnline(state.isConnected))
```

```bash
timeout 300 pnpm exec vitest run test/unit/jsonapi/online.test.ts test/unit/platform/query-client.test.ts 2>&1 | grep -E "×|Test Files|Tests "
git grep --untracked -n "isConnected" -- platform lib
```

Expected: 두 파일 통과(`online.test.ts` 3 + D4 의 `query-client.test.ts` 그대로 - 재검증 트리에서 `Tests  7 passed (7)`), `git grep`(아직 추적하지 않는 새 파일까지)은 `platform/query-client.ts` 의 `isOnline(state.isConnected)` 와 `lib/jsonapi/online.ts` 의 줄들뿐이다 - `platform/` 에 `!== false` 가 남지 않았다.

- [ ] **Step 6: 오류 경계의 "다시 시도" 가 조회 캐시를 비운다 (실패하는 시험 → 구현)**

결정 7·8. 화면은 Expo Router 의 기본 그대로이고 "Retry" 앞에서만 조회 캐시를 비운다. 출구는 두지 않는다.

`test/unit/queries/error-boundary.test.ts` 를 만든다:

```ts
import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { JsonApiResult } from '@/lib/jsonapi/client'
import type { JsonApiSend } from '@/lib/jsonapi/send'
import { defineResource } from '@/lib/resources/define'
import { detailScreen } from '@/lib/resources/screen-state'
import { retryWithClearedQueries } from '@/queries/error-boundary'
import { detailQueryOptions } from '@/queries/resource-options'

/**
 * 오류 경계의 "다시 시도" 앞의 캐시 비우기(queries/error-boundary.ts). 실제 QueryClient 와 화면 조회의 옵션으로 잰다 -
 * 결함이 결과 값으로 캐시에 들고 다시 그린 화면이 그것을 요청 없이 읽는다는 것은 TanStack Query 의 동작이라 가짜로는 잴
 * 수 없다.
 *
 * 다시 그린 화면의 첫 렌더는 `useQuery` 처럼 관찰자의 `getOptimisticResult` 로 읽는다 - 렌더 중에 던지면 구독(과 구독이
 * 부르는 조회)에 닿지 못한다. 자원 선언은 실전 값이 아니다(probe).
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

/** 판정한 결함만 돌려주는 가짜 백엔드 - 본문 없는 성공 응답. 상세 화면이 그 결과를 읽으면 렌더 중에 던진다. */
function noBodyBackend() {
  const state = { calls: 0 }
  const send: JsonApiSend = <T>(): Promise<JsonApiResult<T>> => {
    state.calls += 1
    return Promise.resolve({ ok: true, status: 204, document: null })
  }
  return { state, send }
}

const client = new QueryClient({
  defaultOptions: { queries: { staleTime: 0, retry: false } },
})

afterEach(() => {
  client.clear()
})

/** 다시 그린 상세 화면의 첫 렌더가 읽는 결과와, 그 결과로 정한 화면(결함이면 던진다). */
function firstRender(send: JsonApiSend) {
  const options = client.defaultQueryOptions(detailQueryOptions(resource, 'probe-1', send))
  const result = new QueryObserver(client, options).getOptimisticResult(options)
  return {
    result,
    screen: () => detailScreen(resource, { result: result.data, error: result.error }),
  }
}

describe('retryWithClearedQueries', () => {
  it('비우지 않으면 다시 그린 화면이 캐시의 결함을 요청 없이 다시 던진다 - 비우면 받기 전 화면으로 시작한다', async () => {
    const backend = noBodyBackend()
    await client.fetchQuery(detailQueryOptions(resource, 'probe-1', backend.send))
    expect(firstRender(backend.send).screen).toThrow('본문 없는 응답')
    expect(backend.state.calls).toBe(1)

    await retryWithClearedQueries(client, () => Promise.resolve())

    const after = firstRender(backend.send)
    expect(after.result.data).toBeUndefined()
    expect(after.screen()).toEqual({ kind: 'loading' })
  })

  it('경계를 풀기 전에 비운다 - 경계가 다시 그리는 순간 캐시에 조회가 없다', async () => {
    const backend = noBodyBackend()
    await client.fetchQuery(detailQueryOptions(resource, 'probe-1', backend.send))
    let cachedAtRetry = -1
    const retry = vi.fn(() => {
      cachedAtRetry = client.getQueryCache().getAll().length
      return Promise.resolve()
    })

    await retryWithClearedQueries(client, retry)

    expect(retry).toHaveBeenCalledTimes(1)
    expect(cachedAtRetry).toBe(0)
  })

  it('쓰기 캐시는 비우지 않는다 - 로그아웃과 같은 범위다', async () => {
    client.getMutationCache().build(client, { mutationKey: ['probe', 'write'] })

    await retryWithClearedQueries(client, () => Promise.resolve())

    expect(client.getMutationCache().getAll()).toHaveLength(1)
  })
})
```

```bash
timeout 300 pnpm exec vitest run test/unit/queries/error-boundary.test.ts 2>&1 | grep -E "FAIL|Error|Tests " | head -5
```

Expected: 모듈을 찾지 못해 실패한다(`Cannot find package '@/queries/error-boundary'` 또는 같은 뜻), `Tests  no tests`.

`queries/error-boundary.ts` 를 만든다:

```ts
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
```

```bash
timeout 300 pnpm exec vitest run test/unit/queries/error-boundary.test.ts 2>&1 | grep -E "✓|×|Test Files|Tests "
```

Expected: `Tests  3 passed (3)`. 세 시험이 서로 다른 잘못을 가른다(재검증 트리에서 쟀다): `removeQueries()` 를 빼면 첫째·둘째가, `retry()` 뒤에 비우면 둘째가, `client.clear()` 로 바꾸면(쓰기 캐시까지 지운다) 셋째가 빨갛다.

루트 레이아웃이 그 함수를 경계의 `retry` 대신 넘긴다.

`app/_layout.tsx` — Edit, 찾을 것:

```tsx
import { Stack, ThemeProvider } from 'expo-router'
```

바꿀 것:

```tsx
import {
  ErrorBoundary as RouterErrorBoundary,
  Stack,
  ThemeProvider,
  type ErrorBoundaryProps,
} from 'expo-router'
```

같은 파일에 Edit, 찾을 것:

```tsx
import { NAV_THEME } from '@/platform/theme'
```

바꿀 것:

```tsx
import { NAV_THEME } from '@/platform/theme'
import { retryWithClearedQueries } from '@/queries/error-boundary'
```

같은 파일에 Edit, 찾을 것:

```tsx
export { ErrorBoundary } from 'expo-router'
```

바꿀 것:

```tsx
/**
 * 렌더 중 예외의 경계(스펙 9.3) - 화면은 Expo Router 의 기본 그대로다. "Retry" 는 조회 캐시를 비운 뒤 경계를 푼다:
 * 결과 값으로 캐시에 든 결함을 요청 없이 다시 던지지 않고 다시 부른다(queries/error-boundary.ts, 스펙 9.3 의 D8 정정).
 * 출구를 따로 두지 않는다 - 이 경계는 루트 레이아웃을 통째로 바꿔 그려 떠 있는 동안 내비게이터가 없고, 풀린 뒤의 앱은
 * 루트 Stack의 일반 초기 화면(홈)에서 새로 시작하며 cold 초기 URL은 다시 적용될 수 있다.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <RouterErrorBoundary error={error} retry={() => retryWithClearedQueries(queryClient, retry)} />
  )
}
```

```bash
BACKEND_URL=https://gate-check.invalid timeout 300 pnpm types:routes
timeout 300 pnpm typecheck && timeout 300 pnpm lint && echo "static ok"
timeout 300 pnpm exec vitest run test/unit/queries test/unit/lint/request-boundary.test.ts test/unit/ui/breakpoints.test.ts 2>&1 | grep -E "×|Test Files|Tests "
git grep -n "ErrorBoundary" -- app
```

Expected: `static ok`, 세 자리의 시험이 모두 통과한다(`test/unit/queries` 의 기존 파일과 새 파일, `request()` 경계, 미디어 변형), `git grep` 은 `app/_layout.tsx` 의 import·주석·함수의 줄들이다 - `export { ErrorBoundary } from 'expo-router'` 는 없다. 화면 시험은 두지 않는다(스펙 11.1) - 경계는 세 백엔드가 그 결함을 보내지 않아 E2E 에도 닿지 않는다(결정 8).

- [ ] **Step 7: 문서와 스펙 정정**

`lib/jsonapi/AGENTS.md` — Edit("이 저장소가 더한 것" 표의 `status.ts` 행 앞에 한 행), 찾을 것:

```markdown
| `status.ts`
```

바꿀 것:

```markdown
| `online.ts` | 기기의 연결 상태(NetInfo 의 `isConnected`) → TanStack Query 의 온라인 여부. 모를 때(`null`)는 연결된 것으로 본다(스펙 8.5) - `platform/query-client.ts` 가 부른다 |
| `status.ts`
```

`platform/AGENTS.md` — Edit(표의 `query-client.ts` 행의 끝 칸 - 그 글자는 이 파일에 한 번이다), 찾을 것:

```markdown
`signOut()`, 스펙 9.2)
```

바꿀 것:

```markdown
`signOut()`, 스펙 9.2), 연결 판정은 `lib/jsonapi/online.ts`
```

`queries/AGENTS.md` — Edit(파일 표의 `keys.ts` 행 앞에 한 행), 찾을 것:

```markdown
| `keys.ts`
```

바꿀 것:

```markdown
| `error-boundary.ts` | 오류 경계의 "다시 시도"(`retryWithClearedQueries`) - 조회 캐시를 비운 뒤 경계를 푼다. 루트 레이아웃의 `ErrorBoundary` 가 부른다(스펙 9.3) |
| `keys.ts`
```

스펙 — `### 8.6 계약 실험실` 바로 앞(8.5 의 정정들 뒤)에 더한다:

```markdown
> 정정(2026-10-01, D8): 네트워크 복귀의 판정 - NetInfo 의 `isConnected` 가 `false` 일 때만 오프라인이고 `null`(아직
> 모른다)은 연결로 본다 - 은 `lib/jsonapi/online.ts` 의 `isOnline` 이다. `platform/query-client.ts` 는 그 값을
> `onlineManager` 에 옮기기만 한다(5장 - `platform/` 에 판단을 두지 않는다). 세 값을 단위 시험이 잰다
> (`test/unit/jsonapi/online.test.ts`).
```

스펙 — `### 9.4 Accept-Language` 바로 앞(9.3 의 D4 정정 뒤)에 더한다:

```markdown
> 정정(2026-10-01, D8): 위 D4 정정 (b) 의 두 자리. (1) 루트 레이아웃의 `ErrorBoundary` 는 Expo Router 의 기본 화면을
> 그대로 그리되 "Retry" 가 경계를 풀기 전에 조회 캐시를 비운다(`queries/error-boundary.ts` 의 `retryWithClearedQueries` -
> 로그아웃과 같은 범위라 쓰기 캐시는 둔다). 다시 그린 화면은 캐시의 결함을 요청 없이 다시 던지지 않고 다시 부른다 -
> 판정한 결함은 같은 답이라 다시 경계로 오지만, 백엔드가 고쳐지면 앱을 다시 켜지 않아도 풀린다. (2) 출구를 따로 두지
> 않는다. 이 경계는 루트 레이아웃(그 안의 루트 내비게이터)을 통째로 바꿔 그려, 떠 있는 동안 이동을 부를 수 없고(내비게이터가
> 없다는 오류만 남는다) 내비게이터는 상태를 잃는다 - "Retry" 뒤의 앱은 루트 Stack 의 첫 화면(`(app)` 의 앵커, 홈)에서
> 다시 시작한다. 이 둘은 설치본 expo-router 57.0.24 에 묶인 react-navigation core 를 node 로 불러 쟀다(기기에서는 재지
> 않았다 - 세 백엔드는 그 결함을 보내지 않는다). 남은 한계는 판정한 결함이 고쳐지지 않는 동안 그 화면에 들어갈 때마다 경계를
> 다시 본다는 것이다(README 의 알려진 한계). 화면 단위 경계(라우트 파일의 `ErrorBoundary`)나 출구를 더하는 단계는 그
> 경계의 다시 시도와 출구도 조회 캐시를 비워야 한다.
```

```bash
pnpm exec prettier --write lib/jsonapi/AGENTS.md platform/AGENTS.md queries/AGENTS.md lib/jsonapi/online.ts test/unit/jsonapi/online.test.ts platform/query-client.ts queries/error-boundary.ts test/unit/queries/error-boundary.test.ts app/_layout.tsx
timeout 300 pnpm format:check && ./scripts/check-citations.sh app components lib platform queries test && echo "docs ok"
grep -c "정정(2026-10-01, D8)" docs/superpowers/specs/2026-09-30-expo-jsonapi-template-design.md
git grep -n "online.ts\|error-boundary.ts" -- "*AGENTS.md"
```

Expected: `docs ok`, Task 1의 정정3(10.5·8.5·9.3)과 Task 0의 2026-10-02 CI 정정1, `git grep` 이 `lib/jsonapi/AGENTS.md`·`platform/AGENTS.md`·`queries/AGENTS.md` 의 새 줄을 보인다(Prettier 가 세 표의 칸 폭을 다시 맞췄다).

- [ ] **Step 7a: D6/D7의 작은 이월을 닫는다**

`test/unit/config/eas-json.test.ts` — Edit, 찾을 것:

```ts
    expect(profile('e2e')).toMatchObject({
      android: { buildType: 'apk' },
      ios: { simulator: true },
    })
```

바꿀 것:

```ts
    expect(profile('e2e')).toMatchObject({
      distribution: 'internal',
      withoutCredentials: true,
      android: { buildType: 'apk' },
      ios: { simulator: true },
    })
```

두 선택적 pin은 실제 eas.json 값 그대로이고 시험 수는 늘지 않는다. 각각 다른 값으로 바꾸면 이 기존 시험이 실패하는지 확인한다.

`test/unit/platform/e2e-diagnostics.test.ts` — Edit, 찾을 것:

```ts
import type { AppVariant } from '@/lib/config/app-variant'
```

바꿀 것:

```ts
import { APP_VARIANTS, variantProfile, type AppVariant } from '@/lib/config/app-variant'
```

`test/unit/platform/e2e-diagnostics.test.ts` 끝에 더한다:

```ts

it('logsHttpFailures 는 진단·이벤트·로그가 공유하는 e2e 전용 의도다', () => {
  expect(APP_VARIANTS.filter((variant) => variantProfile(variant).logsHttpFailures)).toEqual(['e2e'])
})
```

현재 진단 코드를 별도 플래그로 바꾸지 않는다. 기존 세 비-e2e 무구독·cleanup·민감값 미기록 시험과 이 변형 불변식을 함께 유지한다. 향후 다른 변형에 logsHttpFailures를 켜면 진단 범위도 바뀐다는 정책 검토가 이 시험에서 요구된다.

`test/unit/e2e/guard-log.test.ts` — Edit, 찾을 것:

```ts
import { spawnSync } from 'node:child_process'
```

바꿀 것:

```ts
import { spawnSync } from 'node:child_process'
import { resolveBash } from '../support/bash'
```

같은 파일에 Edit, 찾을 것:

```ts
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
```

바꿀 것:

```ts
const BASH = resolveBash()
```

`test/unit/scripts/check-citations.test.ts` — Edit, 찾을 것:

```ts
import { spawnSync } from 'node:child_process'
```

바꿀 것:

```ts
import { spawnSync } from 'node:child_process'
import { resolveBash } from '../support/bash'
```

같은 파일에 Edit, 찾을 것:

```ts
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
```

바꿀 것:

```ts
const BASH = resolveBash()
```

`docs/provenance/copied-core.json` — Edit, 찾을 것:

```json
      "what": "GATE_TARGETS 를 app·components·lib·platform·queries·test 로 바꿨고, 주석의 원본 게이트 단계 번호 [5/9] 를 이 저장소의 [5/13] 로 바꿨다.",
```

바꿀 것:

```json
      "what": "GATE_TARGETS 를 app·components·lib·platform·queries·test 로 바꿨고, 주석의 원본 게이트 단계 번호 [5/9] 를 이 저장소의 [5/13] 로 바꿨다. D8은 중복 resolveBash를 기존 test/unit/support/bash.ts의 실제 후보 probe와30초 제한으로 모았다.",
```

새 이탈 행을 중복 추가하지 않는다. 같은 경로의 기존 행을 보강하므로 수는54/42/33이며 `node scripts/check-provenance.mjs`가 실제로 이를 확인해야 한다.

두 함수 위의 낡은 중복 설명은 공통 helper를 가리키는 설명으로 정리한다. resolver 구현은 `test/unit/support/bash.ts` 하나에 둔다. 원래 입력/fixture·가드/인용 실패 단언은 지우지 않는다. 공통 helper의 후보 probe는 기존 30초 제한을 그대로 쓴다.

```bash
timeout 300 pnpm exec vitest run test/unit/config/eas-json.test.ts test/unit/platform/e2e-diagnostics.test.ts test/unit/e2e/guard-log.test.ts test/unit/scripts/check-citations.test.ts test/unit/auth/guard-route.test.ts test/unit/e2e/ios-harness-lifecycle.test.ts test/unit/e2e/ios-simulator-shell.test.ts test/unit/e2e/native-backend.test.ts
```

Expected: 전부 통과. R29의 first pending next/로그아웃 래치가 그대로이고 진단 구독 cleanup은 query removal·루트 재마운트 뒤에도 호출될 수 있다. 오류 경계는 QueryCache만 비우고 sessionManager·SecureStore·MutationCache나 가드 전역 상태를 따로 비우지 않는다. pendingLogin은 앱 셸의 로컬 state이므로 루트가 재마운트될 때 새로 시작한다. 원래 cold 보호 링크는 초기 URL로 다시 들어올 수 있어 “Retry가 항상 홈으로 간다”를 기기 사실로 단정하지 않는다. 실제 결함 주입으로 잴 수 없는 한계는 D9 이월에 남긴다.

- [ ] **Step 8: 정적 게이트를 돈다**

`[7]` 이 Task 1의 새 시험 열넷을, `[8]` 이 여덟 평가를(개발 클라이언트의 scheme), `[9]` 가 새 의존성을, `[10]` 이 두 플랫폼의 번들을(새 경계와 함께) 잰다. 10분 가까이 걸릴 수 있어 백그라운드로 돌리고 끝나기를 기다린다. 이 저장소의 `expo start` 를 끄고 돈다(`[10]` 이 `--clear`).

```bash
timeout 1800 ./scripts/check.sh --static > .maestro-output/d8-static.log 2>&1; echo "static gate exit=$?"
grep -E "^=== |Test Files|Tests |변형 설정 (통과|위반)|checks passed|Bundled|Exported:" .maestro-output/d8-static.log
```

Expected: `static gate exit=0`, `=== [1/13] typecheck ===` 부터 `=== [11/13] compose ===` 와 `=== 정적 단계 [1]–[11] 통과 (--static) …`, `[7/13]` 의 `Test Files  100 passed`·`Tests  1962 passed`(Task 0 뒤의 Step 1 수에서 - 설정 +3, 검사기 +4(m7 둘 포함), 연결 판정 +3, 경계 +3, 진단 불변식 +1), `[8/13]` 의 `변형 설정 통과` 여덟(위반 없음 - development 는 OTA 끔), `[9/13]` 의 `21/21 checks passed`, `[10/13]` 의 `iOS Bundled …`·`Android Bundled …` 와 `Exported: dist`(모듈 수는 현재 번들 출력으로 기록한다). 실패하면 그 단계의 출력으로 원인을 고친다 - `[8]` 의 `Android 딥링크 scheme`·`iOS URL scheme` 위반은 Step 3 (e) 의 갈래, `[9]` 의 버전 불일치는 `BACKEND_URL=https://gate-check.invalid pnpm exec expo install --check` 의 안내를 따른다. 다시 돌려 덮지 않는다.

- [ ] **Step 9: 둘째 커밋**

```bash
git status --short
git add docs/provenance/copied-core.json test/unit/config/eas-json.test.ts test/unit/platform/e2e-diagnostics.test.ts test/unit/e2e/guard-log.test.ts test/unit/scripts/check-citations.test.ts lib/jsonapi/online.ts test/unit/jsonapi/online.test.ts platform/query-client.ts queries/error-boundary.ts test/unit/queries/error-boundary.test.ts app/_layout.tsx lib/jsonapi/AGENTS.md platform/AGENTS.md queries/AGENTS.md docs/superpowers/specs/2026-09-30-expo-jsonapi-template-design.md
git commit -m "fix: 오류 경계의 다시 시도가 조회 캐시를 비우고 네트워크 복귀의 판정을 lib 로 옮긴다"
git status --short
```

Expected: 첫 `git status` 에는 이 단계의 파일만 있다(Step 8 에서 고친 파일이 있으면 그것도 함께 넣는다 - 고친 까닭을 커밋 본문에 한 줄), 커밋 뒤 남은 파일이 없다.

### Task 2: 문서군 — 문서 시험, README, 계층별 `AGENTS.md`

**Files:**
- Create: `test/unit/docs/doc-set.test.ts`, `README.md`, `app/AGENTS.md`, `components/AGENTS.md`, `components/app/AGENTS.md`, `components/form/AGENTS.md`, `components/ui/AGENTS.md`, `components/lab/AGENTS.md`, `lib/AGENTS.md`, `scripts/AGENTS.md`, `test/AGENTS.md`, `test/unit/AGENTS.md`, `docs/AGENTS.md`, `docs/superpowers/notes/2026-10-01-d8-measurements.md`
- Modify: `AGENTS.md`(새 자원 추가 절차, 기록 한 문장, 디렉터리 문서 탐색), `.github/workflows/AGENTS.md`(예시 이름), 문서 시험의 첫 실행이 가리키는 문서(Step 7), `test/e2e/AGENTS.md`·`platform/AGENTS.md`(내용 감사), 스펙(14·15 정정)
- 임시(git 이 무시한다): `.maestro-output/d8-docs-first.log`, `.maestro-output/d8-docs-final.log`

**Interfaces:**
- Consumes: Task 1 의 파일(`lib/jsonapi/online.ts`·`queries/error-boundary.ts` 와 그 시험, `app/_layout.tsx` 의 `ErrorBoundary` - 새 문서가 부른다), D4 의 `components/app/home-button.tsx`(testID `back-to-home-button`), `DEFAULT_APP_VARIANT`(`lib/config/app-variant.ts`), `.env.example`(D6), D7 의 `.github/AGENTS.md`·`.github/workflows/AGENTS.md`·`test/contract/AGENTS.md`, D5 의 `lib/lab/AGENTS.md`, D7 의 기록 K3(`docs/superpowers/notes/2026-10-01-d7-measurements.md`)
- Produces: 게이트 [7] 의 `test/unit/docs/doc-set.test.ts`(시험 11 - 저장소 검사 다섯, 검사 자체의 시험 여섯), README, 계층 문서 열하나, D8 기록의 뼈대와 G3. 이 뒤로 파일을 더하거나 옮기는 사람은 그 디렉터리의 `AGENTS.md` 에 한 줄을 더해야 게이트를 지난다.

- [ ] **Step 1: 문서 시험을 쓴다**

`test/unit/docs/doc-set.test.ts` 를 만든다:

````ts
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { posix } from 'node:path'
import { describe, expect, it } from 'vitest'

import { DEFAULT_APP_VARIANT } from '@/lib/config/app-variant'

/**
 * 문서군이 실제 파일과 일치한다(스펙 17장 조건 5) - 루트 README.md 와 모든 AGENTS.md 를 훑는다.
 *
 * 1. 인용한 경로가 있다. 마크다운 링크의 대상과, 저장소 경로처럼 생긴 인라인 코드(`lib/auth/`·`app.config.ts`)를
 *    잰다. 첫 조각이 저장소의 항목(또는 그 문서 디렉터리의 항목)이 아닌 경로는 저장소 밖의 것이라 재지 않는다
 *    (`node_modules/.bin/secretlint`·`.maestro-output/e2e`). 파일 이름 하나(`screen-state.ts`)는 루트, 문서의
 *    디렉터리, 같은 문단에서 먼저 부른 경로의 디렉터리 가운데 한 곳에 있으면 된다 - `lib/resources/view.ts`·
 *    `screen-state.ts` 처럼 쓰는 이 저장소의 문체다. 코드 울타리 안의 명령은 재지 않는다(플래그·자리표시가 섞인다).
 * 2. AGENTS.md 는 자기 디렉터리의 바로 아래 항목(파일·디렉터리)을 전부 부른다 - 새 파일을 만들면 그 디렉터리의
 *    문서에 한 줄이 생겨야 게이트가 통과한다. 코드 울타리 안의 경로도 부른 것으로 친다. 루트 AGENTS.md 는
 *    디렉터리만 본다 - 루트의 파일은 README 와 각 파일의 머리말이 설명한다.
 * 3. 스펙 14장이 이름을 댄 문서가 있다.
 * 4. 환경 변수는 app.config.ts(lib/config)·.env.example·README 의 표 세 곳이 같은 값을 적는다(스펙 10.1).
 *
 * 파일 목록은 git 이 커밋할 파일이다(추적하는 파일 + 무시되지 않은 새 파일) - .gitignore 가 버리는 것은 문서의
 * 대상이 아니다. 지웠지만 아직 커밋하지 않은 파일은 뺀다.
 */

const EXTENSION = /\.(ts|tsx|js|mjs|cjs|json|md|sh|ya?ml|sql|css|png)$/
// 자리표시(`<이름>`)·glob(`*`)·명령(공백·`=`)·URL(`:`)이 든 코드는 경로가 아니다.
const NOT_A_PATH = /[\s<>*{}$…=|?#%'",;:@\\]/

/**
 * 저장소 밖의 경로를 이름 그대로 부르는 자리 - 원본 저장소·백엔드 저장소·액션 저장소의 파일과, 계층 표가 소유
 * 관계로 미리 적어 둔 빈 자리. 이 저장소의 파일이면 여기 적지 않고 문서의 경로를 고친다. 문서에서 사라진 항목은
 * 아래 시험이 알린다.
 */
const EXTERNAL: Readonly<Record<string, readonly string[]>> = {
  // 계층 표는 소유 관계라 아직 비어 있는 자리도 적는다 - React Native Reusables 가 훅을 받을 자리다.
  'AGENTS.md': ['components/hooks/'],
  // 백엔드 템플릿의 디렉터리와 원본(template-typescript-nextjs)의 파일
  'lib/jsonapi/AGENTS.md': ['app/jsonapi/', 'proxy.ts', 'app/error.tsx'],
  // 원본(template-typescript-nextjs)에서 실험실이 있던 자리
  'lib/lab/AGENTS.md': ['app/(lab)/contract/', 'actions.ts', 'page.tsx', 'result-view.tsx'],
  // 각 액션 저장소의 파일
  '.github/workflows/AGENTS.md': ['action.yml'],
  // 하네스가 단언하는 APK 안의 경로(android.sh build 가 unzip 으로 읽는다)
  'test/e2e/AGENTS.md': ['assets/app.config'],
}

/** 스펙 14장이 이름을 댄 문서. */
const SPEC_DOCS = [
  'README.md',
  'AGENTS.md',
  'lib/jsonapi/AGENTS.md',
  'lib/resources/AGENTS.md',
  'lib/auth/AGENTS.md',
  'platform/AGENTS.md',
  'queries/AGENTS.md',
  'app/AGENTS.md',
  'components/resource/AGENTS.md',
]

interface Tree {
  readonly files: ReadonlySet<string>
  readonly dirs: ReadonlySet<string>
}

function treeOf(paths: readonly string[]): Tree {
  const dirs = new Set<string>()
  for (const path of paths) {
    const parts = path.split('/')
    for (let end = 1; end < parts.length; end += 1) dirs.add(parts.slice(0, end).join('/'))
  }
  return { files: new Set(paths), dirs }
}

function repoTree(): Tree {
  const listed = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
    encoding: 'utf8',
  })
  return treeOf(listed.split('\0').filter((path) => path !== '' && existsSync(path)))
}

function exists(tree: Tree, path: string): boolean {
  return tree.files.has(path) || tree.dirs.has(path)
}

function dirOf(doc: string): string {
  const dir = posix.dirname(doc)
  return dir === '.' ? '' : dir
}

/** 디렉터리 바로 아래 항목의 이름(루트는 ''). */
function childrenOf(tree: Tree, dir: string): string[] {
  const prefix = dir === '' ? '' : `${dir}/`
  const names = new Set<string>()
  for (const path of tree.files) {
    if (path.startsWith(prefix)) names.add(path.slice(prefix.length).split('/')[0] ?? '')
  }
  names.delete('')
  return [...names].sort()
}

interface Line {
  readonly text: string
  readonly number: number
  readonly fenced: boolean
}

/** 빈 줄로 가른 문단. 코드 울타리 안의 줄은 fenced 이고, 울타리 줄은 문단을 가른다. */
function paragraphs(text: string): Line[][] {
  const result: Line[][] = []
  let current: Line[] = []
  let fenced = false
  const flush = () => {
    if (current.length > 0) result.push(current)
    current = []
  }
  text.split(/\r?\n/).forEach((raw, index) => {
    if (/^\s*(```|~~~)/.test(raw)) {
      fenced = !fenced
      flush()
    } else if (raw.trim() === '') flush()
    else current.push({ text: raw, number: index + 1, fenced })
  })
  flush()
  return result
}

function codeSpans(text: string): string[] {
  return [...text.matchAll(/`([^`]+)`/g)].map((match) => match[1] ?? '')
}

function linkTargets(text: string): string[] {
  return [...text.matchAll(/\]\((<[^>]*>|[^)\s]*)\)/g)].map((match) => {
    const target = match[1] ?? ''
    return target.startsWith('<') ? target.slice(1, -1) : target
  })
}

interface Candidate {
  readonly path: string
  /** `/` 가 든 글자다(디렉터리 표기 `lib/` 도). */
  readonly nested: boolean
}

/** 저장소 경로처럼 생긴 글자면 끝의 `/` 를 뗀 경로. */
function pathCandidate(token: string): Candidate | null {
  const raw = token.trim().replace(/^\.\//, '')
  if (raw === '' || NOT_A_PATH.test(raw) || /^[-/~]|^\.\./.test(raw)) return null
  if (/^\.[a-z]+$/.test(raw)) return null // 확장자 이야기(`.ts`·`.sh`)
  if (!raw.includes('/') && !EXTENSION.test(raw)) return null
  return { path: raw.replace(/\/$/, ''), nested: raw.includes('/') }
}

interface Findings {
  readonly dead: string[]
  readonly mentioned: ReadonlySet<string>
  readonly unusedExternal: string[]
}

function inspectDoc(tree: Tree, doc: string, text: string, external: readonly string[]): Findings {
  const docDir = dirOf(doc)
  const rootEntries = new Set(childrenOf(tree, ''))
  const docEntries = new Set(childrenOf(tree, docDir))
  const allowed = new Set(external)
  const used = new Set<string>()
  const dead: string[] = []
  const mentioned = new Set<string>()
  for (const paragraph of paragraphs(text)) {
    // 문단 안에서 부른 경로의 디렉터리 - 뒤따르는 이름 하나가 거기서 풀린다
    const context = new Set<string>()
    const found = (path: string) => {
      mentioned.add(path)
      context.add(tree.dirs.has(path) ? path : dirOf(path))
    }
    const bare: { where: string; span: string; name: string }[] = []
    for (const line of paragraph) {
      const where = `${doc}:${line.number}`
      if (line.fenced) {
        for (const word of line.text.split(/[\s"'=()]+/)) {
          const candidate = pathCandidate(word)
          if (candidate !== null && exists(tree, candidate.path)) mentioned.add(candidate.path)
        }
        continue
      }
      for (const target of linkTargets(line.text)) {
        if (/^(https?:|mailto:|#)/.test(target)) continue
        const path = posix.normalize(posix.join(docDir, target.split('#')[0] ?? '')).replace(/\/$/, '')
        if (exists(tree, path)) found(path)
        else dead.push(`${where}: 링크 (${target})`)
      }
      for (const span of codeSpans(line.text)) {
        const candidate = pathCandidate(span)
        if (candidate === null) continue
        if (allowed.has(span)) {
          used.add(span)
          continue
        }
        const first = candidate.path.split('/')[0] ?? ''
        if (candidate.nested && !rootEntries.has(first) && !docEntries.has(first)) continue
        // 루트 기준과 문서 디렉터리 기준이 둘 다 있으면 둘 다 부른 것이다(`test/unit/` 문서의 `platform/`)
        const hits = [candidate.path, posix.join(docDir, candidate.path)].filter((path) =>
          exists(tree, path),
        )
        if (hits.length > 0) hits.forEach(found)
        else if (candidate.nested) dead.push(`${where}: \`${span}\``)
        else bare.push({ where, span, name: candidate.path })
      }
    }
    for (const { where, span, name } of bare) {
      const hits = [...context].map((dir) => posix.join(dir, name)).filter((path) => exists(tree, path))
      if (hits.length === 0) dead.push(`${where}: \`${span}\``)
      hits.forEach((path) => mentioned.add(path))
    }
  }
  const unusedExternal = [...allowed]
    .filter((token) => !used.has(token))
    .map((token) => `${doc}: \`${token}\``)
  return { dead, mentioned, unusedExternal }
}

/** AGENTS.md 가 부르지 않은 자기 디렉터리의 바로 아래 항목. 루트는 디렉터리만 본다. */
function unnamedChildren(tree: Tree, doc: string, mentioned: ReadonlySet<string>): string[] {
  const docDir = dirOf(doc)
  return childrenOf(tree, docDir)
    .filter((name) => name !== 'AGENTS.md')
    .map((name) => posix.join(docDir, name))
    .filter((child) => docDir !== '' || tree.dirs.has(child))
    .filter((child) => ![...mentioned].some((path) => path === child || path.startsWith(`${child}/`)))
    .map((child) => `${doc}: ${posix.basename(child)}${tree.dirs.has(child) ? '/' : ''}`)
}

function isDoc(path: string): boolean {
  return path === 'README.md' || path === 'AGENTS.md' || path.endsWith('/AGENTS.md')
}

/** README 의 "## 환경 변수" 절의 첫 표 - 변수 이름 → 기본값 칸. */
function readmeEnvTable(readme: string): Map<string, string> {
  const section = readme.split(/\n## /).find((part) => part.startsWith('환경 변수')) ?? ''
  const lines = section.split(/\r?\n/)
  const start = lines.findIndex((line) => line.startsWith('|'))
  const rows = new Map<string, string>()
  for (const line of start < 0 ? [] : lines.slice(start)) {
    if (!line.startsWith('|')) break
    const cells = line.split('|').map((cell) => cell.trim())
    const name = /^`([A-Z][A-Z0-9_]*)`$/.exec(cells[1] ?? '')?.[1]
    if (name !== undefined) rows.set(name, cells[3] ?? '')
  }
  return rows
}

function envExample(text: string): Map<string, string> {
  const values = new Map<string, string>()
  for (const line of text.split(/\r?\n/)) {
    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line)
    if (match !== null) values.set(match[1] ?? '', (match[2] ?? '').trim())
  }
  return values
}

describe('문서군이 실제 파일과 일치한다 - 스펙 17장 조건 5', () => {
  const tree = repoTree()
  const docs = [...tree.files].filter(isDoc).sort()
  const findings = new Map(
    docs.map((doc) => [doc, inspectDoc(tree, doc, readFileSync(doc, 'utf8'), EXTERNAL[doc] ?? [])]),
  )

  it('스펙 14장이 이름을 댄 문서가 있다', () => {
    expect(SPEC_DOCS.filter((doc) => !tree.files.has(doc))).toEqual([])
  })

  it('README 와 AGENTS.md 가 인용한 경로가 있다', () => {
    expect(docs.length).toBeGreaterThan(SPEC_DOCS.length)
    expect([...findings.values()].flatMap((found) => found.dead)).toEqual([])
  })

  it('AGENTS.md 가 자기 디렉터리의 바로 아래 항목을 전부 부른다', () => {
    expect(
      docs
        .filter((doc) => doc !== 'README.md')
        .flatMap((doc) => unnamedChildren(tree, doc, findings.get(doc)?.mentioned ?? new Set())),
    ).toEqual([])
  })

  it('저장소 밖 경로의 예외는 그 문서에 실제로 있다 - 문서에서 사라진 예외를 남기지 않는다', () => {
    expect(Object.keys(EXTERNAL).filter((doc) => !tree.files.has(doc))).toEqual([])
    expect([...findings.values()].flatMap((found) => found.unusedExternal)).toEqual([])
  })

  it('환경 변수 - README 표·.env.example·app.config.ts 가 같은 변수와 기본값을 적는다(스펙 10.1)', () => {
    const readme = readmeEnvTable(readFileSync('README.md', 'utf8'))
    const example = envExample(readFileSync('.env.example', 'utf8'))
    expect([...readme.keys()].sort()).toEqual([...example.keys()].sort())
    // 필수 변수에는 기본값이 없다 - .env.example 의 값은 예시다
    expect(readme.get('BACKEND_URL')).toBe('없음')
    // 선택 변수의 기본값은 app.config.ts 가 쓰는 값(lib/config/app-variant.ts)이다
    expect(example.get('APP_VARIANT')).toBe(DEFAULT_APP_VARIANT)
    expect(readme.get('APP_VARIANT')).toBe(`\`${DEFAULT_APP_VARIANT}\``)
    // 기본값이 없는 선택 변수는 .env.example 에서 비어 있다
    expect(example.get('EAS_PROJECT_ID')).toBe('')
    expect(readme.get('EAS_PROJECT_ID')).toBe('없음')
  })
})

describe('검사가 실제로 잡는다', () => {
  const tree = treeOf([
    'AGENTS.md',
    'lib/AGENTS.md',
    'lib/a.ts',
    'lib/b.ts',
    'lib/sub/c.ts',
    'test/unit/x.test.ts',
  ])

  it('없는 경로·없는 링크·문단 밖의 이름을 죽은 인용으로 잡는다', () => {
    const text = [
      '`lib/gone.ts` 와 [링크](missing/AGENTS.md) 와 `lib/sub/` 와 `c.ts`.',
      '',
      '`c.ts` 는 여기서 풀리지 않는다.',
    ].join('\n')
    expect(inspectDoc(tree, 'lib/AGENTS.md', text, []).dead).toEqual([
      'lib/AGENTS.md:1: 링크 (missing/AGENTS.md)',
      'lib/AGENTS.md:1: `lib/gone.ts`',
      'lib/AGENTS.md:3: `c.ts`',
    ])
  })

  it('저장소 밖의 경로·명령·자리표시·확장자 이야기는 재지 않는다', () => {
    const text =
      '`node_modules/.bin/x` `.maestro-output/e2e` `pnpm test` `lib/<이름>.ts` `lib/**` `.ts` `https://x.invalid/a.ts`'
    expect(inspectDoc(tree, 'AGENTS.md', text, []).dead).toEqual([])
  })

  it('부르지 않은 파일과 디렉터리를 잡는다 - 코드 울타리 안의 경로는 부른 것으로 친다', () => {
    const text = ['`a.ts`', '', '```bash', 'node lib/sub/c.ts', '```'].join('\n')
    const { mentioned } = inspectDoc(tree, 'lib/AGENTS.md', text, [])
    expect(unnamedChildren(tree, 'lib/AGENTS.md', mentioned)).toEqual(['lib/AGENTS.md: b.ts'])
    expect(unnamedChildren(tree, 'AGENTS.md', new Set(['lib']))).toEqual(['AGENTS.md: test/'])
  })

  it('루트와 문서 디렉터리에 같은 이름이 있으면 둘 다 부른 것이다', () => {
    const nested = treeOf(['lib/AGENTS.md', 'lib/test/y.ts', 'test/unit/x.test.ts'])
    const { mentioned, dead } = inspectDoc(nested, 'lib/AGENTS.md', '`test/`', [])
    expect(dead).toEqual([])
    expect(unnamedChildren(nested, 'lib/AGENTS.md', mentioned)).toEqual([])
    expect([...mentioned].sort()).toEqual(['lib/test', 'test'])
  })

  it('예외는 적힌 문서에서만 통하고, 쓰이지 않은 예외를 알린다', () => {
    const found = inspectDoc(tree, 'AGENTS.md', '`proxy.ts`', ['proxy.ts', 'page.tsx'])
    expect(found.dead).toEqual([])
    expect(found.unusedExternal).toEqual(['AGENTS.md: `page.tsx`'])
    expect(inspectDoc(tree, 'lib/AGENTS.md', '`proxy.ts`', []).dead).toEqual([
      'lib/AGENTS.md:1: `proxy.ts`',
    ])
  })

  it('README 의 환경 변수 표에서 첫 표만 읽는다', () => {
    const readme = [
      '# 제목',
      '',
      '## 환경 변수',
      '',
      '| 변수 | 필수 | 기본값 | 역할 |',
      '| --- | --- | --- | --- |',
      '| `A_B` | 예 | 없음 | 가 |',
      '',
      '| `C_D` | 아니오 | `x` | 나 |',
      '',
      '## 다음',
    ].join('\n')
    expect([...readmeEnvTable(readme).entries()]).toEqual([['A_B', '없음']])
  })
})
````

`EXTERNAL` 의 다섯 문서는 D5·D6·D7 이 쓴 문서의 글자에서 뽑았다(원본·백엔드·액션 저장소의 경로, 하네스가 단언하는 APK 안의 경로, 루트 계층 표의 빈 자리). D5–D7 이 실행 중에 다른 글자를 썼으면 Step 7 이 맞춘다.

- [ ] **Step 2: 처음 돌려 어긋남의 목록을 받는다**

```bash
mkdir -p .maestro-output
timeout 300 pnpm exec vitest run test/unit/docs/doc-set.test.ts > .maestro-output/d8-docs-first.log 2>&1; echo "exit=$?"
grep -E "✓|×|Test Files|Tests |^\s*\+ |ENOENT" .maestro-output/d8-docs-first.log
```

Expected: README/새 문서 작성 전에는 exit1이다. v3의4failed/7passed는 역사적 기준이며 실제 D7·Task0 뒤 목록을 G3에 기록한다. 기본 예상은 다음이며 신규 script·plugins·support 등 실제 출력도 같은 규칙으로 고친다:

- `스펙 14장이 이름을 댄 문서가 있다` - `README.md`·`app/AGENTS.md`
- `README 와 AGENTS.md 가 인용한 경로가 있다` - ``.github/workflows/AGENTS.md:<줄>: `./x.sh` `` (D7 의 예시 이름)
- `AGENTS.md 가 자기 디렉터리의 바로 아래 항목을 전부 부른다` - `AGENTS.md: assets/`
- `환경 변수 …` - `README.md` 가 없다(`ENOENT`)

목록이 다르면 **이 출력이 정본이다**(결정 24) - D4–D7 이 실행 중에 문서를 다르게 썼다. `lib/jsonapi/AGENTS.md: online.ts`·`queries/AGENTS.md: error-boundary.ts` 가 보이면 Task 1 Step 7 의 행이 빠진 것이다 - 그 Edit 부터 확인한다. 이 출력을 기록 G3 에 붙인다(Step 6). 예외 검사(`저장소 밖 경로의 예외는 …`)가 빨가면 D5–D7 의 문서에 그 글자가 없다 - Step 7 (b) 가 맞춘다.

- [ ] **Step 3: README 를 쓴다**

`README.md` 를 만든다(템플릿 사용자에게 - 결정 18):

````markdown
# TypeScript Expo Template

FastAPI · NestJS · Rails 세 백엔드 템플릿이 공유하는 JSON:API 1.1 계약을 소비하는 Android · iOS 앱 템플릿입니다. 웹 템플릿 `template-typescript-nextjs` 와 같은 계약, 같은 화면 범위를 Expo(React Native)로 제공합니다. 백엔드 전환은 `BACKEND_URL` 하나이고 어댑터 계층이 없습니다 - 세 백엔드의 공개 계약이 통일되어 있어서 앱은 어느 백엔드를 상대하는지 몰라도 됩니다.

들어 있는 것은 **JSON:API 코어**(`lib/jsonapi/` - 문서 파싱, `included` 정규화, 쿼리 직렬화, 오류 분류, 15초 타임아웃의 HTTP 클라이언트), **인증·세션**(`lib/auth/` · `platform/session.ts` - SecureStore 항목 하나에 둔 세션, 한 곳에서 한 번에 하나만 도는 토큰 회전, 보호 경로 가드), **자원**(`lib/resources/` - 백엔드 조회 정책을 손으로 베낀 선언, `components/resource/` - 그 선언을 읽어 그리는 획일 UI), **데이터**(`queries/` - TanStack Query 의 캐시 키·조회·쓰기 훅·무효화), 그 위의 **화면**(목록 · 상세 · 생성 · 수정 · 삭제 · 가입 · 로그인, 계약 실험실, 홈의 빌드 정보 카드), 그리고 **EAS 빌드·OTA 설정**(`eas.json`, `expo-updates`)입니다.

자원은 예시 하나(`examples`)와 그 참조 자원 둘(`exampleCategories` · `exampleTags`)이 등록돼 있습니다. 새 자원을 더하는 절차와 계층 소유권·위반의 정의는 `AGENTS.md` 가 갖습니다. 설계의 정본은 `docs/superpowers/specs/2026-09-30-expo-jsonapi-template-design.md` 입니다.

## 먼저 - 앱 식별자를 바꿉니다

배포하기 전에 반드시 `app.config.ts` 의 값 넷을 바꿉니다. 기본 식별자는 일부러 배포할 수 없는 값입니다 - Google Play 는 `com.example` 로 시작하는 패키지 이름을 받지 않습니다.

| 값            | 기본값                     | 무엇                                                                                                                   |
| ------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `BASE_APP_ID` | `com.example.templateexpo` | Android 패키지 이름이자 iOS 번들 ID. 변형마다 접미사가 붙습니다(아래 "변형")                                           |
| `BASE_SCHEME` | `templateexpo`             | 딥링크 scheme. 변형마다 접미사가 붙습니다                                                                              |
| `BASE_NAME`   | `Template Expo`            | 앱 이름                                                                                                                |
| `SLUG`        | `template-typescript-expo` | Expo 프로젝트의 slug - EAS 프로젝트의 slug 와 같아야 하고, 개발 클라이언트의 scheme(`exp+<slug>`)이 이 값에서 나옵니다 |

아이콘과 스플래시 이미지는 `assets/` 에 있습니다. E2E 플로·하네스와 단위 시험은 `e2e` 변형의 식별자(`com.example.templateexpo.e2e`)와 scheme(`templateexpo-e2e`)을 글자로 적습니다 - 아래 명령이 보여 주는 자리를 같은 값으로 바꾸고 게이트로 확인합니다.

```bash
git grep -n -e 'com\.example\.templateexpo' -e 'templateexpo-e2e' -e 'exp+template-typescript-expo' -- test
./scripts/check.sh
```

## 시작하기

준비물은 Node 24.11 이상(24.19.0 에서 쟀습니다), pnpm 11.22.0(`corepack enable` 이 `package.json` 의 `packageManager` 를 따릅니다), 개발 빌드를 만들 Android SDK 와 에뮬레이터(또는 macOS 의 Xcode), 로컬 백엔드를 띄울 Docker 입니다.

```bash
pnpm install --frozen-lockfile
cp .env.example .env   # BACKEND_URL 을 앱이 닿을 백엔드 주소로 채웁니다
```

로컬 백엔드는 이 저장소의 E2E 스택을 그대로 쓰면 가장 빠릅니다 - 마이그레이션과 씨앗 데이터까지 마친 백엔드 하나가 호스트의 4100 번에 섭니다. Android 에뮬레이터에서 호스트는 `10.0.2.2`, iOS 시뮬레이터에서는 `localhost` 입니다(`.env.example` 의 값이 Android 쪽입니다).

```bash
docker compose --profile fastapi -f docker-compose.e2e.yml up -d --build --wait
# 내릴 때는 세 프로파일을 모두 줍니다 - 띄운 것과 다른 프로파일로 내리면 컨테이너가 남습니다
docker compose --profile fastapi --profile nestjs --profile rails -f docker-compose.e2e.yml down -v --remove-orphans
```

개발은 개발 클라이언트(`expo-dev-client`)가 든 development build 로 합니다 - Expo Go 는 대상이 아닙니다.

```bash
pnpm exec expo run:android   # development 변형을 빌드해 설치하고 Metro 를 띄웁니다
pnpm exec expo run:ios       # macOS
pnpm start                   # 개발 빌드가 이미 설치돼 있으면 Metro 만
```

**Windows 에서는 저장소를 짧은 경로에 둡니다.** Android 네이티브 빌드(Gradle · CMake · ninja)는 저장소의 실제 디렉터리 경로가 47자 이하일 때만 성공했습니다(pnpm 의 hoisted 링커로 47자까지 성공, 50자에서 실패 - `docs/superpowers/notes/2026-09-30-d1-measurements.md` 의 M1). E2E 하네스는 짧은 경로의 사본에서 빌드하지만 `expo run:android` 는 저장소 자리에서 빌드합니다.

## 환경 변수

앱이 읽는 변수는 셋입니다. 정본은 `app.config.ts` 이고(검증은 `lib/config/` - `settings.ts` · `app-variant.ts` · `updates.ts`), `.env.example` 이 같은 값을 적습니다. 세 곳이 어긋나면 게이트가 멈춥니다(`test/unit/docs/doc-set.test.ts`).

| 변수             | 필수   | 기본값        | 역할                                                                                                                        |
| ---------------- | ------ | ------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `BACKEND_URL`    | 예     | 없음          | 백엔드의 절대 URL(끝 슬래시는 잘립니다). `preview` · `production` 변형에서는 `https` 여야 합니다                            |
| `APP_VARIANT`    | 아니오 | `development` | 빌드 변형 - `development` · `preview` · `production` · `e2e`(아래 "변형")                                                   |
| `EAS_PROJECT_ID` | 아니오 | 없음          | EAS 프로젝트 id(UUID - `eas init` 이 만듭니다). 있으면 `preview` · `production` 변형의 OTA 를 켭니다(아래 "EAS 빌드와 OTA") |

**필수 변수에는 코드상의 암묵적 기본값을 두지 않습니다.** `BACKEND_URL` 이 없으면 `BACKEND_URL is required` 로 **설정을 평가하는 순간** 멈춥니다 - `expo start` · `expo export` · 로컬과 EAS 빌드 · OTA 발행이 모두 그렇습니다. 앱은 시작할 때 같은 함수로 한 번 더 검증하고(OTA 로 들어온 설정까지 대비합니다), 실패하면 변수 이름이 든 설정 오류 화면을 그립니다.

Expo CLI 는 `.env` 를 읽습니다. E2E · 계약 거울 · CI 의 하네스가 읽는 변수(`BACKEND_KIND` · `E2E_AVD` · `E2E_FLOW` · `E2E_API_PORT` 등)는 앱이 모릅니다 - 그 표는 `test/e2e/AGENTS.md` 와 `test/contract/AGENTS.md` 에 있습니다.

## 변형

`APP_VARIANT` 하나가 식별자 · scheme · 앱 이름 · 평문 HTTP · OTA 를 정합니다. 표의 정본은 `lib/config/app-variant.ts` 이고, 게이트의 설정 단계가 네 변형을 평가해 네이티브 설정이 될 값을 이 표와 맞댑니다(`scripts/check-variant-config.mjs`).

| 변형          | 식별자 · scheme 접미사  | 평문 HTTP | OTA                | 용도                                       |
| ------------- | ----------------------- | --------- | ------------------ | ------------------------------------------ |
| `development` | `.dev` · `-dev`         | 허용      | 끔                 | 개발 클라이언트로 개발                     |
| `preview`     | `.preview` · `-preview` | 금지      | 켬(`preview` 채널) | 내부 배포                                  |
| `production`  | 없음                    | 금지      | 켬(`production`)   | 스토어                                     |
| `e2e`         | `.e2e` · `-e2e`         | 허용      | 끔                 | E2E 용 Release 빌드 - 내장 번들로만 돕니다 |

접미사 덕분에 한 기기에 여러 변형을 함께 설치할 수 있고, scheme 도 변형마다 달라 딥링크가 갈 변형이 정해집니다. 개발 클라이언트가 더하는 scheme(`exp+template-typescript-expo`)도 `development` 에만 싣습니다. 평문 HTTP 는 Android 의 `usesCleartextTraffic` 과 iOS ATS 의 로컬 네트워크 예외로 켜고, `preview` · `production` 에 `http://` 주소를 주면 설정 단계에서 멈춥니다. OTA 는 채널이 있는 두 변형에 `EAS_PROJECT_ID` 가 있을 때만 켜집니다.

`android/` · `ios/` 는 `expo prebuild` 가 만들고 커밋하지 않습니다(Continuous Native Generation) - 네이티브 설정은 `app.config.ts` 와 설정 플러그인으로만 바꿉니다.

## 화면

경로의 정본은 `app/` 의 파일 배치이고, **인증 필요 여부의 정본은 `lib/auth/protected-paths.ts` 입니다.** 앱 셸(`app/(app)/_layout.tsx`)의 경로 가드가 세션 없이 보호 경로에 온 사용자를 `/login?next=<원래 경로>` 로 보내고, 로그인하면 그 경로로 돌아옵니다. 쓰기 훅도 요청 직전에 세션을 다시 확인합니다.

| 경로                   | 인증 | 내용                                                                              |
| ---------------------- | ---- | --------------------------------------------------------------------------------- |
| `/`                    | 공개 | 홈 - 목록 · 실험실 진입, 빌드 정보 카드                                           |
| `/examples`            | 공개 | 목록 - 필터 시트, 정렬 메뉴, 무한 스크롤(커서), 당겨서 새로고침, 빈 결과          |
| `/examples/[id]`       | 공개 | 상세 - 분류 · 태그 배지, UTC 시각, 없는 id 는 not-found                           |
| `/examples/new`        | 필요 | 생성 - 필수 입력, 분류 단일 선택, 태그 다중 선택(고른 순서 유지)                  |
| `/examples/[id]/edit`  | 필요 | 수정 · 삭제 - 기존 값 유지, 삭제 확인                                             |
| `/login` · `/register` | 공개 | 로그인 · 가입(가입은 이어서 로그인합니다). 돌아갈 화면이 없으면 머리글에 "홈으로" |
| `/contract`            | 공개 | 계약 실험실 - 실무 화면이 쓰지 않는 여섯 백엔드 표면의 원본 응답                  |

**라우트 파라미터가 곧 쿼리입니다.** 목록의 필터 · 정렬은 라우트 파라미터에 있어 딥링크 하나로 같은 목록이 재현되고, 뒤로 가기가 이전 조건을 되살립니다. 딥링크의 대괄호와 값의 특수 문자는 퍼센트 인코딩합니다.

```text
templateexpo-dev://examples?filter%5Bstatus%5D=active&sort=-createdAt
```

로딩은 스켈레톤과 스피너로만 그리고 글자를 쓰지 않습니다. 오류 문구는 백엔드가 `Accept-Language`(기기의 언어 설정)로 협상한 것을 그대로 그립니다 - 앱 자신의 문구는 둘뿐입니다. 쓸 수 있는 응답을 받지 못했을 때(네트워크 실패 · 타임아웃 · 계약을 어긴 응답)의 한 문장과, 가입은 됐는데 이어지는 로그인이 실패했을 때의 안내입니다. 조회 화면은 앞의 문장과 함께 "다시 시도" 를 그립니다. 조회가 계약을 어긴 응답(문구 없는 오류 문서 · 본문 없는 성공 응답)을 받거나 코드에 결함이 있으면 화면 대신 루트의 오류 경계가 그려집니다(아래 "알려진 한계"). 다크 모드는 시스템 설정을 따릅니다.

> **계약 실험실은 개발 · 검증용 표면입니다.** 공개인 채로 두면 익명 클릭 한 번이 백엔드 요청을 최대 스무 개(offset 순회의 상한) 내고, 가입이 열려 있어 계정을 만들면 PUT upsert · 관계 전용 쓰기로 쓰기까지 닿습니다. 프로덕션에 올릴 때는 라우트(`app/(lab)/contract.tsx`)와 홈(`app/(app)/index.tsx`)의 실험실 진입, 그 E2E 플로(`test/e2e/flows/` 의 `contract-lab-*`)를 지우십시오 - 실험실만 쓰는 `components/lab/` · `queries/lab.ts` · `lib/lab/` 도 함께 지울 수 있습니다. 실험실은 앱 셸 밖의 라우트라 보호 경로 목록에 더해도 가드가 닿지 않습니다.

## 백엔드 전환

**전환은 `BACKEND_URL` 하나입니다.** E2E 와 계약 거울에서는 `BACKEND_KIND`(`fastapi` · `nestjs` · `rails`, 기본 `fastapi`)가 `docker-compose.e2e.yml` 의 compose 프로파일을 고릅니다. 세 `api-*` 서비스가 같은 호스트 포트(4100) 뒤에 서므로 앱 빌드 하나로 세 백엔드를 검증합니다. 셋 밖의 값을 주면 Docker 와 기기를 건드리기 전에 멈춥니다(`test/e2e/matrix.ts`).

```bash
BACKEND_KIND=nestjs ./test/contract/run.sh
BACKEND_KIND=rails ./test/e2e/run-android.sh
```

백엔드 이미지는 각 백엔드 저장소의 GitHub `main` 에서 빌드하고, 이미 있으면 다시 쓰입니다. 백엔드 `main` 이 바뀐 뒤에는 그 프로파일의 이미지를 먼저 다시 빌드해야 최신 코드가 검증됩니다.

```bash
export BACKEND_KIND=rails
COMPOSE_PROFILES="$BACKEND_KIND" docker compose -f docker-compose.e2e.yml build --pull "api-$BACKEND_KIND" "migrate-$BACKEND_KIND"
```

마지막으로 세 백엔드를 모두 검증한 실행과 그때의 백엔드 커밋은 `docs/superpowers/notes/2026-10-01-d8-measurements.md` 에 있습니다. 알려진 계약 드리프트는 `test/e2e/matrix.ts` 의 `KNOWN_DIVERGENCES` 에 적고, 하네스가 스택을 띄울 때마다 그 수를 찍습니다.

## EAS 빌드와 OTA

게이트와 CI 는 Expo 계정 없이 돕니다 - 로컬과 CI 는 `expo prebuild` 뒤 Gradle 과 xcodebuild 로 직접 빌드합니다. EAS 빌드와 OTA 발행은 여러분의 Expo 계정과 빌드 크레딧을 씁니다.

`eas.json` 의 빌드 프로필은 변형과 같은 넷이고(프로필 = 변형 = 채널), 모두 Node 24.19.0 · pnpm 11.22.0 을 고정합니다.

| 프로필        | 설정                                                         | 채널         |
| ------------- | ------------------------------------------------------------ | ------------ |
| `development` | 개발 클라이언트, 내부 배포                                   | -            |
| `preview`     | 내부 배포, Android APK                                       | `preview`    |
| `production`  | 스토어 빌드, 빌드 번호 자동 증가(`appVersionSource: remote`) | `production` |
| `e2e`         | Android APK, iOS 시뮬레이터 빌드, 자격 증명 없음             | -            |

`BACKEND_URL` 은 `eas.json` 에 적지 않습니다 - 실제 주소는 템플릿이 알 수 없으므로 EAS 환경 변수로 넣고, 빠지면 빌드가 곧바로 멈춥니다.

```bash
eas login
eas init   # 설정이 동적(app.config.ts)이라 id 를 파일에 쓰지 못하고 알려 줍니다 - .env 의 EAS_PROJECT_ID 에 둡니다
eas env:create --environment preview --name BACKEND_URL --value https://api.example.com
eas build --profile preview --platform android
APP_VARIANT=preview BACKEND_URL=https://api.example.com EAS_PROJECT_ID=<id> eas update --channel preview --environment preview
```

- runtime version 은 `fingerprint` 정책입니다 - 네이티브 구성이 같은 빌드에만 업데이트가 갑니다. 발행하는 셸의 `APP_VARIANT` · `BACKEND_URL` · `EAS_PROJECT_ID` 가 빌드와 다르면 지문이 달라 업데이트가 어떤 빌드에도 닿지 않습니다(`docs/superpowers/notes/2026-10-01-d6-measurements.md` 의 O1). EAS 빌드 서버에는 `EAS_PROJECT_ID` 를 넣지 않아도 됩니다 - 서버가 주는 `EAS_BUILD_PROJECT_ID` 를 씁니다.
- 앱은 켤 때 업데이트를 확인하되 기다리지 않습니다 - 받은 업데이트는 다음 실행에 적용됩니다. 홈의 빌드 정보 카드가 앱 버전 · 변형 · OTA · runtime version · 채널 · 업데이트 ID 를 보여 주고, "업데이트 확인" 으로 받은 업데이트를 바로 적용합니다.
- 스토어 제출은 `eas submit --profile production` 입니다. Android 는 `internal` 트랙의 draft 로 올립니다. iOS 의 App Store Connect 앱 id 같은 계정 고유 값은 저장소에 적지 않았습니다 - 첫 제출 때 EAS 가 묻고 저장합니다.
- 조직 계정이나 로봇 토큰으로 빌드하면 eas-cli 가 `owner` 를 요구합니다 - `app.config.ts` 에 한 줄을 더합니다.
- `development` 프로필은 개발 클라이언트가 든 빌드를 만듭니다(`expo-dev-client` 가 설치돼 있습니다).

## 검증 - 단일 게이트

```bash
pnpm install --frozen-lockfile
./scripts/check.sh            # 13단계 - 이 명령이 통과해야 통과입니다
./scripts/check.sh --static   # 정적 단계 [1]–[11] 만 - CI 의 checks 잡이 부릅니다
```

| 단계     | 무엇                                                                                                             |
| -------- | ---------------------------------------------------------------------------------------------------------------- |
| [1]–[4]  | typecheck(앱과 시험의 두 타입 프로그램) · lint(계층 import 경계 포함) · format · secretlint                      |
| [5]      | 인용 - 사라질 자리를 가리키는 인용이 없다(`scripts/check-citations.sh`)                                          |
| [6]      | 복사 출처 - `docs/provenance/copied-core.json` 의 형식 · 경로 · 원본과 같은 내용(`scripts/check-provenance.mjs`) |
| [7]      | unit - vitest(`lib/` 의 판단, `queries/` · `platform/` 의 순수 부분, 스크립트, 문서군)                           |
| [8]      | 설정 - 네 변형 × EAS 프로젝트 유무를 평가해 변형 표와 맞댑니다                                                   |
| [9]–[11] | 의존성 호환(expo-doctor) · 번들(`expo export --clear`, Android · iOS) · compose 설정(세 프로파일)                |
| [12]     | 계약 거울 - FastAPI 스택에 자원 선언과 쓰기 갈림·JWT 수명을 HTTP로 맞댑니다(`test/contract/run.sh`)                                  |
| [13]     | E2E - e2e APK → Android 에뮬레이터 → Maestro(FastAPI)(`test/e2e/run-android.sh`)                                 |

**로컬 게이트는 FastAPI 하나, Android 하나만 돕니다.** 세 백엔드와 iOS 는 CI 가 돕니다. 전제 조건은 Docker([11]–[13]), 네트워크([9]), Android SDK(`ANDROID_HOME`) · Maestro 2.11 · 켜진 에뮬레이터나 부팅할 AVD 이름(`E2E_AVD`)([13])이고, 빠진 것이 있으면 무엇이 빠졌는지 알리고 멈춥니다. [10] 이 Metro 캐시를 지우므로 이 저장소의 `expo start` 를 먼저 끕니다. Maestro 2.11.0 은 `test/e2e/install-maestro.sh` 가 체크섬을 확인하고 `~/.maestro` 에 풉니다(Java 17 이 필요합니다).

Windows에서는 아래 E2E의 단독/새 부팅 규칙도 지킵니다. Git Bash에서 `./scripts/check.sh`로 돌립니다 - `pnpm check` 는 pnpm 이 cmd.exe 로 돌려 `./` 를 찾지 못합니다. 저장소 경로가 47자를 넘으면 [13] 이 짧은 경로(`E2E_STAGE_DIR`, 기본 `C:/t/e`)의 사본에서 APK 를 만듭니다. 스크립트의 실행 권한이 살아 있어야 통과합니다 - `core.filemode=false` 인 머신에서는 권한이 빠져도 `git status` 에 드러나지 않으니 `git ls-tree HEAD scripts/ test/` 에서 `.sh` 가 `100755` 인지 봅니다.

## E2E

Maestro 플로(`test/e2e/flows/`)가 실제 백엔드와 에뮬레이터 · 시뮬레이터 위에서 앱을 돕니다 - 모킹 계층이 없습니다. 인증 · 세션(앱을 다시 켠 뒤의 복원 포함), 목록 · 상세(무한 스크롤 · 당겨서 새로고침 · 딥링크로 조건 재현), 쓰기(실제 토큰 회전을 지납니다), 계약 실험실, 빌드 정보 카드, 한국어 · 영어 오류를 잽니다. 가드는 기기 로그입니다 - JS 오류 · 경고와 플로가 선언하지 않은 4xx · 5xx 가 있으면 실패이고, 재시도는 0 입니다. 가드 뒤에 하네스가 그 플로의 백엔드 접근 로그로 앱의 요청 수를 단언합니다(`test/e2e/request-counts.ts` - 쓰기마다 토큰 회전 하나, 다시 앞에 온 목록의 재조회, 두 번 누른 제출의 요청 하나). 요청 수는 FastAPI 의 접근 로그로만 셉니다 - NestJS 는 요청을 로그에 남기지 않고 Rails 는 다른 형식(lograge 의 JSON)입니다.

```bash
E2E_AVD=Pixel_9_API_36 ./test/e2e/run-android.sh      # 전부 - 스택을 띄우고, 빌드 입력이 바뀌었으면 APK 를 다시 만든다
E2E_FLOW="examples-browse" ./test/e2e/run-android.sh  # 일부 - 개발용
```

APK 를 다시 만들 때 하네스는 Metro 캐시를 비우고 Gradle 을 데몬 없이(`--no-daemon`) 돌립니다 - Windows 에서 남은 Gradle 데몬이 짧은 경로 사본의 파일을 쥐어 다음 실행을 막았습니다(`docs/superpowers/notes/2026-10-01-d4-measurements.md` 의 W1). Windows 게이트는 소유한 AVD를 새로 부팅하고 다른 시험·타입 검사·번들·Gradle이 끝난 뒤 혼자 돕니다(D5 C2). 다른 작업을 임의 종료하지 않습니다. 콜드 보호 링크는 `cold-links`가 next를 보존하는지 잽니다. 멈춘 서버 확인은 `E2E_CHECKS=1`로 headers/body 두 REQUEST_TIMEOUT을 검증합니다. 결과(Maestro 기록 · 스크린샷 · 기기 로그 · 백엔드 접근 로그)는 `.maestro-output/e2e/<플로>/` 에 남습니다. 플로를 쓰는 규칙과 하네스의 환경 변수는 `test/e2e/AGENTS.md` 에, 씨앗 데이터의 규칙은 `test/e2e/seed/README.md` 에 있습니다.

## CI

`.github/workflows/ci.yml` 하나이고, 모든 브랜치의 push 와 pull request 에서 돕니다(`docs/` 만 바꾼 커밋은 돌지 않습니다).

| 잡                | 러너   | 하는 일                                                                                       |
| ----------------- | ------ | --------------------------------------------------------------------------------------------- |
| `checks`          | ubuntu | `./scripts/check.sh --static`(게이트 [1]–[11])과 워크플로 lint(actionlint)                    |
| `build-android`   | ubuntu | e2e APK 를 한 번 만들어 아티팩트로 올립니다                                                   |
| `e2e-android` × 3 | ubuntu | 백엔드마다 계약 거울 → KVM 에뮬레이터에서 Maestro(받은 APK)                                   |
| `build-ios`       | macOS  | 시뮬레이터용 Release `.app` 을 한 번 만들어 올립니다                                          |
| `e2e-ios` × 6 | macOS | 백엔드마다 두 shard, 합집합으로 기존 한 iOS 셀. 소유 simulator의 서비스 축소·AutoFill/scheme 준비·한 번 재부팅 후 Maestro |

- 매트릭스는 `fail-fast: false` 이고 재시도는 0 입니다 - 실패한 잡을 코드 변경 없이 다시 돌리지 않습니다. 흔들리는 플로는 원인을 고칩니다.
- 아티팩트: 갈래마다 `e2e-android-<백엔드>` · `e2e-ios-<백엔드>-shard-<번호>` 에 플로별 Maestro 기록 · 스크린샷 · 기기 로그 · `api.log`(14일), 앱 둘(7일), iOS 빌드 기록이 남습니다. 빨간 칸은 그 플로의 기기 로그(`device.log` - 가드가 본 것)와 스크린샷부터 봅니다.
- macOS 실행은 계정의 동시 잡 한도를 공유합니다. 이 워크플로는 다섯 이하로 제한하며 여섯 번째 shard의 대기도 측정합니다.
- CI APK는 x86_64만 만들고 로컬 기본 APK는 네 ABI입니다. iOS는 backend마다 두 shard이며 macOS 동시 잡은 최대 다섯입니다. 플로 목록의 합집합·무중복이 검사됩니다. 네이티브 fingerprint·Xcode/SDK·architecture가 같은 빌드만 DerivedData/ccache를 복원하고 현재 JS 번들을 항상 다시 만듭니다. 전후 시간/실제 cache hit는 `docs/superpowers/notes/2026-10-01-d8-measurements.md`의 G4에 있습니다. Expo 미리 빌드한 모듈과 action SHA 고정은 이번 최적화에 포함하지 않습니다.

잡이 하는 일의 정본은 저장소의 스크립트이고 워크플로는 러너 · 캐시 · 아티팩트만 정합니다(`.github/workflows/AGENTS.md`). Mac 이 있으면 iOS 갈래를 로컬에서 같은 스크립트로 돕니다.

```bash
test/e2e/install-maestro.sh                               # Maestro 2.11.0(Java 17)
test/e2e/native-backend.sh services                       # Homebrew 의 PostgreSQL 18 · Redis
BACKEND_KIND=fastapi test/e2e/native-backend.sh fetch     # 백엔드 저장소 main
BACKEND_KIND=fastapi test/e2e/native-backend.sh prepare   # 런타임 - uv · pnpm · bundler
BACKEND_URL=http://localhost:4100 ./test/e2e/run-ios.sh
```

## 복사한 코어

`lib/` 의 상당 부분(JSON:API 코어 · 자원 선언 · 인증 판단 · 실험실의 실험 정의)과 그 단위 시험은 `template-typescript-nextjs` @ `34d0b10` 에서 **복사**했습니다. 두 저장소 사이에 코드 의존은 없습니다 - 공유 패키지는 "클론하면 돈다" 를 깨고, 정합성은 공유 코드가 아니라 계약 거울과 실제 백엔드 E2E 가 지킵니다.

무엇을 복사했고 원본과 무엇이 다른지는 `docs/provenance/copied-core.json` 이 정본입니다. 게이트 [6] 이 그 기록의 형식과 경로를 검사하고, 이탈이 없는 사본은 원본의 blob SHA-1 과 내용이 같은지까지 잽니다. 복사한 파일을 고치면 그 경로의 `divergences` 에 `what` · `why` 를 적습니다(`AGENTS.md` 의 "복사한 코어"). 원본에서 계약 버그가 고쳐지면 출처 커밋과 원본을 비교해 반영할지 정합니다.

## 알려진 한계

- **웹은 대상이 아닙니다** - `template-typescript-nextjs` 가 맡습니다. Expo Go 호환도 보장하지 않습니다. 푸시 알림(백엔드에 기기 토큰을 등록할 표면이 없습니다), 생체 인증 잠금, 오프라인 읽기 캐시는 없습니다.
- **세션**: 회전 요청을 보낸 직후 OS 가 앱을 멈춰 응답을 받지 못하면 서버는 이미 옛 refresh 를 폐기했으므로 다음 실행에서 로그아웃됩니다. 기기 시계를 크게 바꾸면 만료 판정이 틀어질 수 있습니다. 회전 응답이 5xx · 408 · 429 면 세션을 지우지 않는데, 서버가 회전을 마친 뒤 그 응답을 냈다면 다음 회전이 재사용 감지에 걸려 그 사용자의 세션이 모두 끊깁니다.
- **iOS 키체인의 세션은 앱을 지워도 남습니다** - 같은 기기에 다시 설치하면 이전 세션이 되살아날 수 있습니다(로그아웃한 세션은 되살아나지 않습니다).
- **반응형 변형을 쓰지 않습니다.** Uniwind 1.12.0 이 한 `@media` 블록의 둘째 규칙부터 조건을 잃어, `sm:` 같은 너비 변형과 `ios:` · `android:` 같은 플랫폼 변형을 쓰지 않습니다 - 폰과 태블릿이 같은 크기를 씁니다(`docs/superpowers/notes/2026-09-30-d3-measurements.md` 의 L2).
- **Xcode와 scene:** CI는 build-ios와 여섯 e2e-ios 잡에 Xcode 26.6를 명시합니다. Xcode 27/iOS 27 빌드는 SDK 57의 scene lifecycle opt-in이 필요하며 현재 모든 변형에 `ios.enableSceneSupport: true`가 켜져 있습니다. SDK 58 이상으로 올릴 때 제거 여부를 검토합니다.
- **Windows 의 Android 네이티브 빌드**는 저장소 경로 47자 이하에서만 됩니다(위 "시작하기").
- **iOS 전체 매트릭스는 CI의 macOS 러너에서 검증합니다.** 개발 머신은 Windows이지만 D7 K3에는 Mac의 부분 재현도 있습니다. K3의 iOS 27 일부 플로 NOT RUN은 해당 로컬 회차의 상태로 남으며 이후 통합 CI 성공과 구분합니다. 비행기 모드가 필요한 플로 둘(`examples-offline-refetch` · `examples-delete-offline` - 네트워크 복귀의 재조회, 삭제 실패의 문구)은 iOS 에서 건너뜁니다 - 시뮬레이터에 비행기 모드가 없습니다. iOS 의 E2E 가드는 루트 레이아웃보다 먼저 평가된 모듈의 경고를 가르지 못합니다(같은 번들을 도는 Android 가 수준으로 잡습니다).
- **렌더 중 예외의 화면은 Expo Router 의 기본(영어)입니다.** 계약을 어긴 응답과 코드의 결함은 루트의 오류 경계(`app/_layout.tsx` 의 `ErrorBoundary`)로 갑니다. "Retry" 는 조회 캐시를 비운 뒤 루트 앱을 다시 그립니다(일반 시작은 홈이며 초기 cold 링크가 있으면 그 목적지가 다시 적용될 수 있습니다)(`queries/error-boundary.ts`) - 경계에는 다른 출구가 없고, 백엔드가 같은 응답을 주는 동안은 그 화면에 들어갈 때마다 경계가 다시 보입니다.
- **관계 선택기**는 이름 순 첫 100건만 보이고 검색이 없습니다 - 잘리면 그 사실을 알립니다.
- **목록 조건의 값 안에 든 `%XX`** 는 Expo Router 가 값을 한 번 더 디코딩해 바뀝니다.
- 두 E2E 하네스(`test/e2e/run-android.sh` · `test/e2e/run-ios.sh`)가 약 60줄을 겹쳐 갖습니다 - 어긋나기 시작하면 한 파일로 모읍니다.
- **EAS 실계정의 한 바퀴**(`preview` 빌드 설치 → 업데이트 발행 → 앱이 그 업데이트를 받는다)는 아직 돌리지 않았습니다 - 게이트와 CI 는 계정 없이 설정 값과 OTA 를 끈 빌드만 잽니다.

## 문서

- `AGENTS.md` - 계층 계약, 새 자원 추가 절차, 검증 명령. 디렉터리마다 있는 `AGENTS.md` 가 자기 디렉터리의 세부를 갖습니다(루트 `AGENTS.md` 의 "디렉터리 문서 탐색").
- `docs/superpowers/specs/2026-09-30-expo-jsonapi-template-design.md` - 설계의 정본. 구현과 달라진 자리는 날짜가 붙은 정정으로 적습니다.
- `docs/superpowers/plans/` - 단계별 구현 계획, `docs/superpowers/notes/` - 실측 기록.
- 게이트 [7] 의 `test/unit/docs/doc-set.test.ts` 가 README 와 `AGENTS.md` 가 인용한 경로가 있는지, 각 `AGENTS.md` 가 자기 디렉터리의 파일을 모두 부르는지, 위 환경 변수 표가 `.env.example` 과 같은지 봅니다.
````

- [ ] **Step 4: 새 계층 문서 열하나을 쓴다**

`app/AGENTS.md` 를 만든다(스펙 14장이 이름을 댄 문서 - "라우트 파일만 둔다", "fetch 를 직접 하지 않는다"):

```markdown
# app/ 작업 지침

루트 `AGENTS.md` 의 계층 표가 이 디렉터리에 준 것: **화면, 라우팅, 가드 배치.** 소유하지 않는 것: **fetch,
`request()` 호출, 쿼리 문자열 조립.**

## 라우트 파일만 둔다

Expo Router 는 이 디렉터리 아래의 `.tsx`·`.ts` 파일을 모두 라우트로 읽는다(설치본 expo-router 의 `require.context`
가 확장자로 거른다 - 이 문서는 라우트가 아니다). 판단 함수·타입·상수는 `lib/` 의 해당 계층에, 화면 조각은
`components/` 에 둔다. 라우트가 아닌 파일은 라우터의 특별 파일 둘뿐이다 - 레이아웃(`_layout.tsx`)과, 들어온 링크를
라우터 앞에서 바꾸는 `+native-intent.tsx`. 뒤의 것은 잇기만 하고 판단은 `lib/navigation/deep-link.ts` 에 있다.

## fetch 를 직접 하지 않는다

화면은 `queries/` 의 훅만 부른다 - `fetch` 나 `request()` 를 부르면 위반이다. 요청은 `platform/api.ts` 의
`apiRequest` 한 곳을 지나야 Accept-Language 가 실린다(스펙 9.4) - ESLint 가 `request` 를 값으로 import 하는 것을
막는다. 쿼리 문자열도 만들지 않는다 - 목록 조건의 주소는 `lib/resources/view.ts`(`filterHref` 등)가 만든다.

화면 파일에는 훅 호출과 JSX 만 둔다(스펙 8.4). 라우트 파라미터는 이름으로 꺼내고 목록은 `listRouteParams(…)` 로
거른다 - `test/unit/resources/route-params-usage.test.ts` 가 이 디렉터리를 훑어 막는다. 화면을 쌓는 이동은
`useNavigateOnce`(`components/app/navigate-once.ts`)를, 화면의 조회 훅은 `subscribed: useIsFocused()` 를 지난다.

## 라우트

| 파일                                       | 경로                   | 인증 | 무엇                                                                                                                    |
| ------------------------------------------ | ---------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------- |
| `_layout.tsx`                              | -                      | -    | 루트 - 설정 검증과 치명 오류 화면, 스플래시, 세션 복원, Query 캐시, 루트 Stack, 렌더 중 예외의 경계(`ErrorBoundary`)    |
| `+native-intent.tsx`                       | -                      | -    | 밖에서 들어온 딥링크를 앱 안 주소로 바꿔 라우터에 넘긴다                                                                |
| `+not-found.tsx`                           | 없는 경로              | 공개 | not-found                                                                                                               |
| `(app)/_layout.tsx`                        | -                      | -    | 앱 셸 - Stack 머리글·경로 가드·첫 pending login next 보존(R29)                                                           |
| `(app)/index.tsx`                          | `/`                    | 공개 | 홈 - 목록·실험실 진입, 빌드 정보 카드                                                                                   |
| `(app)/examples/index.tsx`                 | `/examples`            | 공개 | 목록                                                                                                                    |
| `(app)/examples/[id]/index.tsx`            | `/examples/[id]`       | 공개 | 상세                                                                                                                    |
| `(app)/examples/new.tsx`                   | `/examples/new`        | 필요 | 생성                                                                                                                    |
| `(app)/examples/[id]/edit.tsx`             | `/examples/[id]/edit`  | 필요 | 수정·삭제                                                                                                               |
| `(auth)/login.tsx` · `(auth)/register.tsx` | `/login` · `/register` | 공개 | 로그인·가입 - 돌아갈 곳이 없으면 머리글의 "홈으로"와 Android 의 뒤로 가기가 홈으로 간다(아래 "가드가 보낸 로그인 화면") |
| `(lab)/contract.tsx`                       | `/contract`            | 공개 | 계약 실험실                                                                                                             |

그룹 이름(`(app)`·`(auth)`·`(lab)`)은 경로에 조각을 더하지 않는다. 경로 가드는 `(app)/_layout.tsx` 안에 있어 `(app)`
아래의 화면만 지킨다 - 보호 경로를 더할 때는 화면을 `(app)` 아래에 두고 `lib/auth/protected-paths.ts` 에 패턴을 더한다.

## 가드가 보낸 로그인 화면

가드는 `decideGuard`·`decidePendingLogin`(`lib/auth/guard-latch.ts`)로 첫 로그인 목적지를 보존한다(R29) - 내비게이터가 준비되는 동안 홈 앵커가 잠깐 보여도 next를 잃지 않는다. 앱 셸의 로컬 pending 상태는 signedIn이면 해제된다. 가드의 `<Redirect>`는 루트에서 `(app)`을 로그인 화면으로 바꿔 끼운다 - 루트에 그 화면 하나만 남는다. 그래서
로그인·가입 뒤의 복귀는 `router.dismissTo(next, { withAnchor: true })` 로 `(app)` 을 새로 만든다. 돌아갈 곳이 없는
로그인·가입 화면은 머리글 오른쪽에 "홈으로"(`components/app/home-button.tsx`, testID `back-to-home-button`)를 두고,
Android 의 뒤로 가기를 홈으로 돌린다(`components/app/back-to-home.ts`) - iOS 에는 뒤로 가기 키가 없다.

## 렌더 중 예외

루트 레이아웃이 내보내는 `ErrorBoundary` 가 렌더 중 예외를 받는다(스펙 9.3) - 계약을 어긴 응답(문구 없는 오류 문서·본문
없는 성공 응답)과 코드의 결함이다. 화면은 Expo Router 의 기본 그대로이고(영어 - "Something went wrong"·"Retry"),
"Retry" 는 조회 캐시를 비운 뒤 경계를 푼다(`queries/error-boundary.ts`) - 캐시에 든 결함을 요청 없이 다시 던지지 않고
다시 부른다. 이 경계는 루트 레이아웃을 통째로 바꿔 그려, 떠 있는 동안 내비게이터가 없어 이동을 부를 수 없고, 풀린 뒤의
앱은 루트 Stack의 일반 초기 화면(홈)에서 새로 시작하며 cold 초기 URL은 다시 적용될 수 있다 - 그래서 출구를 따로 두지 않았다(스펙 9.3 의 D8 정정). 라우트 파일에
`ErrorBoundary` 를 더해 화면 단위 경계를 두면 그 경계의 다시 시도와 출구도 조회 캐시를 비워야 한다.

## 검증

화면은 단위 시험이 없다(스펙 11.1) - 판단은 `lib/` 의 시험이, 화면은 E2E(`test/e2e/flows/`)가 지킨다. 이 디렉터리를
훑는 정적 검사는 `test/unit/ui/breakpoints.test.ts`(미디어 쿼리 변형), `test/unit/resources/route-params-usage.test.ts`
(라우트 파라미터), `test/unit/lint/request-boundary.test.ts`(`request()`)다.
```

`components/AGENTS.md` 를 만든다:

```markdown
# components/ 작업 지침

화면이 나눠 쓰는 React Native 부품이다. 하위 디렉터리마다의 소유는 루트 `AGENTS.md` 의 계층 표가 정하고, 세부는
하위 문서가 갖는다. 모든 하위 디렉터리에 걸리는 규칙:

- fetch·`request()` 를 부르지 않는다. 조회·쓰기는 `queries/` 의 훅이 하고 부품은 결과를 받아 그린다.
- 자원 이름으로 분기하지 않는다 - 분기해도 되는 것은 선언의 구조(`kind`·`cardinality`)뿐이다.
- 로딩에 글자를 쓰지 않는다 - 스켈레톤(`ui/skeleton.tsx`)과 스피너(`ActivityIndicator`)만 쓴다.
- `@media` 로 컴파일되는 클래스 변형(너비·방향·플랫폼)을 쓰지 않는다 - 플랫폼마다 다른 스타일은 `Platform.select` 로
  클래스 문자열을 고른다(`test/unit/ui/breakpoints.test.ts` 가 막는다).
- lucide 아이콘은 아이콘마다 깊은 경로의 기본 내보내기로 받는다(루트 `AGENTS.md`).
- 컴포넌트 단위 시험은 두지 않는다(스펙 11.1) - 판단은 `lib/` 로 밀고, 그린 결과는 E2E 가 testID 로 본다.

| 디렉터리                          | 무엇                                                                                                |
| --------------------------------- | --------------------------------------------------------------------------------------------------- |
| [`app/`](app/AGENTS.md)           | 앱 전체에 걸린 화면 조각 - 설정 오류 화면, 시트, 닿지 못함, not-found, 로그아웃, 빌드 정보 카드, 홈 |
| [`form/`](form/AGENTS.md)         | 폼 조각 - 필드 오류, 배너, 제출 버튼, 자격증명 폼                                                   |
| [`lab/`](lab/AGENTS.md)           | 계약 실험실의 실험 카드                                                                             |
| [`resource/`](resource/AGENTS.md) | 자원 선언을 읽어 그리는 획일 UI - 목록·상세·필터·정렬·폼·관계 선택기                                |
| [`ui/`](ui/AGENTS.md)             | React Native Reusables 복사본                                                                       |

React Native Reusables 가 훅을 받는 자리(`components.json` 의 `hooks` 별칭)는 아직 비어 있다 - 쓰는 날의 소유
규칙은 루트 `AGENTS.md` 의 표에 있다.
```

`components/app/AGENTS.md` 를 만든다:

```markdown
# components/app/ 작업 지침

앱 전체에 걸린 화면 조각과 앱 전체의 이동 도우미를 둔다(루트 `AGENTS.md` 의 계층 표) - React Native Reusables
복사본(`components/ui/`)도 자원 UI(`components/resource/`)도 아닌 것이다. 자원 이름을 모르고 fetch 를 하지 않는다.
쓰기가 필요한 조각(로그아웃 버튼)은 `queries/` 의 훅을 부른다.

| 파일                  | 무엇                                                                                                                  |
| --------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `fatal-config.tsx`    | 설정 오류로 시작할 수 없을 때의 화면 - 검증 함수의 원문(변수 이름이 든 문구)을 그린다(스펙 10.1)                      |
| `sheet.tsx`           | 아래에서 올라오는 시트(React Native `Modal`) - 배경을 누르면 닫히고, 키보드가 뜨면 그만큼 올라온다                    |
| `confirm-sheet.tsx`   | 시트 위의 확인 - 수정 화면의 삭제 확인. 확인하는 동안 두 버튼을 막고 스피너만 그린다                                  |
| `request-failed.tsx`  | 백엔드가 응답조차 주지 못했을 때의 앱 문구와 "다시 시도" - `compact` 는 읽은 내용과 함께 그릴 때다                    |
| `not-found-view.tsx`  | 없는 경로와 없는 자원의 화면                                                                                          |
| `logout-button.tsx`   | 앱 셸 머리글의 로그아웃 버튼 - 누르는 동안 스피너만 그린다                                                            |
| `build-info-card.tsx` | 홈의 빌드 정보 카드 - 행과 문구는 `lib/updates/build-info.ts` 가 정했다                                               |
| `back-to-home.ts`     | 홈으로 가는 이동(`goHome`)과, 돌아갈 곳이 없는 화면에서 Android 의 뒤로 가기를 그리로 돌리는 훅(`useBackToHome`)      |
| `home-button.tsx`     | 가드가 보낸 로그인·가입 화면 머리글의 "홈으로"(testID `back-to-home-button`) - iOS 에는 뒤로 가기 키가 없다(스펙 7.3) |
| `navigate-once.ts`    | 화면을 쌓는 이동을 누른 화면이 다시 앞에 올 때까지 한 번만 하는 훅 - 판단은 `lib/navigation/once.ts`                  |

testID 는 E2E(`test/e2e/flows/`)가 찾는 이름이다 - 바꾸면 플로도 함께 바꾼다. 가드가 보낸 로그인 화면에서 홈으로
가는 두 길 - Android 의 뒤로 가기(`back-to-home.ts`)와 머리글의 "홈으로"(`home-button.tsx`) - 은 같은 이동(`goHome`)이고,
돌아갈 화면이 있으면 나서지 않는다(뒤로 가기는 `router.canGoBack()`, 버튼은 머리글이 넘긴 `canGoBack`).
```

`components/form/AGENTS.md` 를 만든다:

```markdown
# components/form/ 작업 지침

폼 조각을 둔다 - 자원 이름·fetch·세션을 모른다(루트 `AGENTS.md` 의 계층 표). 어떤 오류가 어느 자리로 가는지는
`lib/` 가 정해 온다(스펙 9.1) - 인증 폼은 `lib/auth/form-state.ts`·`lib/auth/flow.ts`, 자원 폼은 `lib/resources/form.ts`.

| 파일                   | 무엇                                                                                            |
| ---------------------- | ----------------------------------------------------------------------------------------------- |
| `field-error.tsx`      | 입력 하나 아래의 필드 오류 - 백엔드가 준 문구를 전부 그린다(첫 것만 그리지 않는다)              |
| `form-banner.tsx`      | 폼 위의 배너 - 필드에 붙지 않는 문서 오류. 새로 나타나면 스크린 리더가 읽는다                   |
| `submit-button.tsx`    | 제출 버튼 - 제출하는 동안 글자 대신 스피너만 그리고, 접근 가능한 이름은 그대로 둔다             |
| `credentials-form.tsx` | 로그인·가입이 함께 쓰는 자격증명 폼 - 제출은 쓰기의 키로 한 번에 하나(`queries/submit-once.ts`) |

오류 문구를 만들지 않는다 - 백엔드가 `Accept-Language` 로 협상한 문구를 받아 그린다(스펙 9.3). 스피너가
`ActivityIndicator` 인 것은 Uniwind 1.12 에 도는 CSS 애니메이션이 없어서다.
```

`components/ui/AGENTS.md` 를 만든다:

```markdown
# components/ui/ 작업 지침

React Native Reusables(shadcn/ui 의 React Native 이식판)에서 CLI 로 받은 복사본이다. 받는 명령과 lucide 아이콘의
깊은 import 규칙은 루트 `AGENTS.md` 의 "React Native Reusables 컴포넌트" 에 있다. 자원 이름·fetch·세션을 모른다.

| 파일           | 무엇                                           |
| -------------- | ---------------------------------------------- |
| `text.tsx`     | 글자와 글자 변형(제목·`large` 등)              |
| `button.tsx`   | 버튼                                           |
| `input.tsx`    | 입력 칸                                        |
| `badge.tsx`    | 배지 - 관계·상태 값                            |
| `skeleton.tsx` | 로딩 스켈레톤                                  |
| `icon.tsx`     | lucide 아이콘을 Uniwind 클래스로 그리는 감싸개 |

받은 파일을 고친 곳은 그 파일에 "원본과 다른 곳" 주석으로 남긴다. Uniwind 1.12.0 결함 때문에 미디어 쿼리로
컴파일되는 변형을 뺐고(`button.tsx`·`input.tsx`·`text.tsx`), 이 저장소의 타입 설정과 맞지 않는 prop 을 받지 않는다
(`input.tsx`·`skeleton.tsx`). 새로 받은 파일에서도 같은 변형을 빼야 `test/unit/ui/breakpoints.test.ts` 가 통과한다.
```

`components/lab/AGENTS.md` 를 만든다:

```markdown
# components/lab/ 작업 지침

계약 실험실(`app/(lab)/contract.tsx`, 스펙 8.6)의 조각이다(루트 `AGENTS.md` 의 계층 표). 요청·세션을 모르고 자원
이름으로 분기하지 않는다 - 실험의 정의와 실행은 `lib/lab/`, 쓰기 훅은 `queries/lab.ts` 다.

| 파일                  | 무엇                                                                                         |
| --------------------- | -------------------------------------------------------------------------------------------- |
| `experiment-card.tsx` | 실험 하나 - 설명, 세션 안내, 실행 버튼, 단계마다 머리글·본문으로 가른 원본 응답(고정폭 글꼴) |

세션이 필요한 실험도 버튼을 숨기지 않는다 - 로그인하지 않은 채 누르면 로그인으로 가는 것이 실험실이 실증하는
계약의 일부다(스펙 7.3). 고정폭 글꼴은 `Platform.select` 로 플랫폼마다 이름 하나를 고른다 - Tailwind 의 글꼴 목록은
네이티브 글꼴 이름이 될 수 없다. testID 는 E2E 플로(`test/e2e/flows/` 의 실험실 플로 둘)가 찾는 이름이다.
```

`lib/AGENTS.md` 를 만든다:

```markdown
# lib/ 작업 지침

순수 TypeScript 계층이다 - react·react-native·expo 와 위 계층(`platform/`·`queries/`·`components/`·`app/`)을
import 하지 않는다(ESLint 가 막고 `test/unit/lint/lib-boundary.test.ts` 가 잰다). 그래서 node 의 vitest 에서 그대로
돌고, 원본에서 복사한 시험이 유효하다. 계층마다의 소유는 루트 `AGENTS.md` 의 표가, 세부는 하위 문서가 갖는다.

| 경로                                  | 무엇                                                                                   |
| ------------------------------------- | -------------------------------------------------------------------------------------- |
| [`jsonapi/`](jsonapi/AGENTS.md)       | 자원을 모르는 문서·정규화·쿼리·오류·HTTP 클라이언트                                    |
| [`resources/`](resources/AGENTS.md)   | 자원 선언과 목록·상세·폼·쓰기의 판단, 손으로 채우는 등록 배열                          |
| [`auth/`](auth/AGENTS.md)             | 세션 모델·회전·자격증명·보호 경로 - 회전은 한 곳에서 한 번에 하나만                    |
| [`lab/`](lab/AGENTS.md)               | 계약 실험실의 실험 정의·실행·결과 표현                                                 |
| [`config/`](config/AGENTS.md)         | 설정 계약과 변형 규칙 - `app.config.ts` 가 Node 의 type stripping 으로 직접 불러온다   |
| [`navigation/`](navigation/AGENTS.md) | 밖에서 들어온 딥링크의 정규화, 한 번만 하는 이동                                       |
| [`updates/`](updates/AGENTS.md)       | 홈의 빌드 정보 카드의 판단                                                             |
| `utils.ts`                            | React Native Reusables 의 `cn`(클래스 이름 합치기) - `components.json` 의 `utils` 별칭 |

많은 파일이 `template-typescript-nextjs` 에서 복사한 사본이다 - 어느 것이 사본이고 원본과 무엇이 다른지는
`docs/provenance/copied-core.json` 이 정본이다(루트 `AGENTS.md` 의 "복사한 코어").

판단이 새로 필요하면 여기 둔다 - `platform/` 은 호출과 배선만, `queries/` 는 캐시와 훅만, 화면은 훅과 JSX 만 갖는다.
시험이 import 하는 이 디렉터리의 파일은 앱과 시험의 두 타입 프로그램에서 검사되므로 타이머 핸들은
`ReturnType<typeof setTimeout>` 으로 적는다(루트 `AGENTS.md` 의 "검증 명령").
```

`lib/updates/AGENTS.md`는 D6가 이미 만든 46줄 문서를 보존한다. `## 규칙`·`## 검증`, ON_LOAD 전제·재지 않은 OTA-on 동작·주입 API·로딩 스피너 규칙을 확인한다. 이 Task의 Create/Write 대상이 아니다.

`scripts/AGENTS.md` 를 만든다:

```markdown
# scripts/ 작업 지침

게이트와 그 검사기를 둔다. `check.sh` 하나가 유일한 게이트다(스펙 12장) - 단계와 전제 조건은 그 파일의 머리말과 루트
`AGENTS.md` 의 "검증 명령" 이 정본이다.

| 파일                       | 무엇                                                                                | 권한                     |
| -------------------------- | ----------------------------------------------------------------------------------- | ------------------------ |
| `check.sh`                 | 단일 게이트 - 13단계. `--static` 이면 정적 단계 [1]–[11] 만 돈다                    | `100755`                 |
| `check-citations.sh`       | 사라질 자리를 가리키는 인용을 찾는다(게이트 [5]) - 훑을 대상을 인자로만 받는다      | `100755`                 |
| `check-provenance.mjs`     | 복사 출처 기록을 검사한다(게이트 [6]) - 형식·경로·이탈 없는 사본이 원본과 같은 내용 | `100644`(node 가 부른다) |
| `e2e-flow-shards.mjs` | CI iOS 허용 목록과 두 shard의 무중복 합집합을 정하고 목록을 출력한다 | `100644`(node) |
| `ios-native-fingerprint.mjs` | CI iOS native/toolchain/레시피 캐시 키와 원천 목록을 만든다 | `100644`(node) |
| `check-variant-config.mjs` | `expo config --type introspect` 의 결과를 변형 표와 맞댄다(게이트 [8])              | `100644`(node 가 부른다) |

- 검사를 바꾸면 그 검사를 재는 시험도 함께 본다 - `test/unit/scripts/` 의 같은 이름 시험이고, `--static` 은
  `check-static.test.ts` 다. 한 번도 빨개지지 않은 검사는 있으나 마나라서 시험마다 어긋난 입력이 실패하는 것을 본다.
- 이 디렉터리와 `docs/`·루트 `AGENTS.md` 는 인용 검사의 대상이 아니다 - 규칙을 적으려면 금지된 패턴의 이름을
  적어야 한다(`check.sh` 머리말).
- `.sh` 는 `100755` 로 커밋한다 - Windows(`core.filemode=false`)에서는 `git update-index --chmod=+x <파일>` 뒤
  `git ls-tree HEAD scripts/` 로 확인한다. 권한이 빠지면 CI 가 `./scripts/check.sh` 를 부르다 멈춘다.
- Windows 에서는 Git Bash 에서 `./scripts/check.sh` 로 돈다 - `pnpm check` 는 cmd.exe 가 `./` 를 찾지 못한다.
```

`test/AGENTS.md` 를 만든다:

```markdown
# test/ 작업 지침

시험 셋이 산다 - 도는 자리가 서로 다르다.

| 경로                              | 무엇                                                                                              | 도는 곳                                |
| --------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------- |
| [`unit/`](unit/AGENTS.md)         | vitest(node) - `lib/` 의 판단, `queries/`·`platform/` 의 순수 부분, 스크립트, 설정, 문서군        | 게이트 [7], `pnpm test`                |
| [`contract/`](contract/AGENTS.md) | 계약 거울 - 자원 선언을 실제 백엔드에 HTTP 로 맞댄다                                              | 게이트 [12], CI 의 e2e-android         |
| [`e2e/`](e2e/AGENTS.md)           | Maestro 플로·하네스·SQL 시드 - 실제 백엔드와 기기                                                 | 게이트 [13], CI 의 e2e-android·e2e-ios |
| `fixtures/`                       | 정본(FastAPI)에서 캡처한 응답 문서(`fixtures/documents.ts`, 복사본) - 계약이 바뀌면 다시 캡처한다 | 단위 시험이 import 한다                |
| `tsconfig.json`                   | 시험의 타입 프로그램 - 루트 설정을 물려받아 `node` 타입을 더한다                                  | 게이트 [1]                             |

- 모킹 계층(MSW 등)을 두지 않는다 - 백엔드에 닿는 시험은 실제 백엔드로 잰다(스펙 1.2).
- 컴포넌트 단위 시험을 두지 않는다(스펙 11.1) - 러너가 둘이 된다. 화면은 E2E 가 지킨다.
- 픽스처에 실전 상수와 같은 값(`.env.example` 의 주소 같은 것)을 쓰지 않는다 - "설정에서 읽었다" 와 "박아 넣었다"
  가 구별되지 않는다.
- 이 디렉터리는 인용 검사(게이트 [5])의 대상이다 - 금지된 패턴을 픽스처로 적어야 하면 문자열을 이어붙인다
  (`test/unit/scripts/check-citations.test.ts` 의 방식).
```

`test/unit/AGENTS.md` 를 만든다:

```markdown
# test/unit/ 작업 지침

게이트 [7] 의 vitest(node)다 - `vitest.config.mjs` 가 이 디렉터리의 `*.test.ts` 만 돈다. 디렉터리는 재는 계층을 따른다.

| 디렉터리      | 재는 것                                                                                              |
| ------------- | ---------------------------------------------------------------------------------------------------- |
| `auth/`       | `lib/auth/` - 회전(동시 호출은 refresh 한 번, 저장이 반환보다 먼저), 세션 저장·복원, 보호 경로, 흐름 |
| `config/`     | `lib/config/`·`app.config.ts`·`eas.json` - 필수 변수, 배포 변형의 평문 HTTP 거부, 변형 표, OTA       |
| `deps/`       | 의존성의 고정 - Metro 계열이 한 인스턴스다                                                           |
| `docs/`       | 문서군이 실제 파일과 일치한다 - README·AGENTS.md 의 인용, 디렉터리 문서의 파일 목록, 환경 변수 표    |
| `e2e/`        | E2E 하네스의 판단 - 가드·이메일·백엔드 종류·플로의 두 플랫폼 규칙·iOS 로그 변환·멈춘 서버·시드       |
| `jsonapi/`    | `lib/jsonapi/` - 문서·정규화·쿼리·오류·클라이언트(타임아웃·취소)·Accept-Language·연결 판정           |
| `lab/`        | `lib/lab/` - 실험의 정의·결과·실행부                                                                 |
| `lint/`       | ESLint 규칙 자체 - lib 경계, `request()` 경계, lucide import, 의존성 선언                            |
| `navigation/` | `lib/navigation/` - 딥링크 정규화(설치본 expo-router 를 지나는 왕복), 한 번만 하는 이동              |
| `platform/`   | `platform/` 의 배선 - `vi.mock` 으로 기기 모듈을 바꿔 잰다                                           |
| `queries/`    | `queries/` 의 순수 부분 - 캐시 키·무효화 표, Query 옵션의 전이(실제 `QueryClient`), 제출 한 번       |
| `resources/`  | `lib/resources/` - 선언·거울 프로브·목록·상세·폼·쓰기·화면 상태                                      |
| `scripts/`    | `scripts/` 의 검사기 - 실제로 돌려 종료 코드와 메시지를 본다                                         |
| `ui/`         | `app/`·`components/` 를 훑는 정적 규칙(미디어 쿼리 변형)과 내비게이션 색                             |
| `support/` | 공통 시험도구 - bash.ts의 실제 Git Bash 선택/30초 probe 제한 |
| `updates/`    | `lib/updates/` - 빌드 정보 카드                                                                      |

- 한 파일만 돌리려면 `pnpm exec vitest run <파일>` 이다 - `pnpm test -- <파일>` 은 pnpm 11 이 `--` 를 넘겨 전부 돈다.
- 원본에서 복사한 시험은 `docs/provenance/copied-core.json` 에 있다 - 고치면 이탈을 적는다.
- 러너의 타임존은 UTC 가 아닌 값으로 고정돼 있다(`vitest.config.mjs`) - UTC 로 그리는 코드를 UTC 러너에서 재면 아무것도
  재지 못한다.
- 한 번도 빨개지지 않은 검사는 있으나 마나다 - 검사를 재는 시험은 어긋난 입력이 실패하는 것도 본다.
```

`docs/AGENTS.md` 를 만든다:

```markdown
# docs/ 작업 지침

커밋되는 근거 자리다 - 코드가 아니라 기록이다. Prettier 와 인용 검사는 이 디렉터리를 훑지 않는다(루트의
Prettier 무시 목록, `scripts/check.sh` 머리말) - 표와 JSON 예시는 저자가 정한 서식 그대로 둔다.

| 경로           | 무엇                                                                                                                       |
| -------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `provenance/`  | `provenance/copied-core.json` - `template-typescript-nextjs` 에서 복사한 파일과 이탈의 정본. 게이트 [6] 이 검사한다        |
| `superpowers/` | 설계(`superpowers/specs/`), 단계별 구현 계획(`superpowers/plans/`), 실측 기록(`superpowers/notes/`)                        |

- 설계(`superpowers/specs/2026-09-30-expo-jsonapi-template-design.md`)는 구현 전의 정본이다. 구현이 설계와 달라진
  자리는 본문을 고치지 않고 그 절 끝에 날짜가 붙은 정정을 더한다.
- 계획과 실측 기록은 날짜가 붙은 기록이다 - 지난 기록의 본문을 고쳐 쓰지 않는다. 사실이 바뀌면 새 기록이나 정정을
  더한다.
- 계획이 끝나면 사라지는 자리(세션의 태스크 보고·리뷰 파일, 세션 작업 공간)를 인용하지 않는다 - 근거는 사실 문장으로
  적고, 필요하면 이 디렉터리의 커밋되는 문서를 가리킨다.
```

각 표는 D7 실제 `2599bf2`와 Task 0·1의 새 파일을 기준으로 한다. 기존 D6의 `lib/updates/AGENTS.md`와 D7의 `plugins/AGENTS.md`도 감사 대상이다. D4–D7 이 다른 파일을 더했거나 이름을 바꿨으면 Step 7 의 시험이 그 자리를 가리킨다.

- [ ] **Step 5: 루트 `AGENTS.md` 와 `.github/workflows/AGENTS.md` 를 고친다**

(a) 새 자원 추가 절차 - 14장이 루트에 맡겼다.

루트 `AGENTS.md` — `## 복사한 코어` 바로 앞(계층 표와 그 문단들 뒤)에 더한다:

```markdown
## 새 자원 추가 절차

백엔드에 이미 있는 자원을 앱에 더하는 순서다(스펙 14장). 백엔드에 표면이 없는 것은 더하지 않는다 - 이 템플릿은
백엔드를 바꾸지 않는다.

1. `lib/resources/<자원>.ts` - 선언. 속성·관계·필터·정렬은 백엔드의 조회 정책과 시리얼라이저를 **손으로 베낀
   거울**이다(`lib/resources/example.ts` 가 본보기다). 화면마다의 판단을 새로 쓰지 않는다 - 목록·상세·폼은
   `lib/resources/view.ts`·`form.ts` 가 선언을 읽어 정한다.
2. `lib/resources/index.ts` - `RESOURCES` 배열에 손으로 더한다. **여기 없으면 그 자원은 존재하지 않는 것과 같다.**
3. `queries/` - 조회·쓰기 훅은 자원을 인자로 받으므로 새로 만들지 않는다. 한 자원의 쓰기가 다른 자원의 목록을
   바꾸면 `queries/keys.ts` 의 무효화 표(`cacheEffects`)에 그 규칙을 더한다.
4. `app/(app)/<자원>/` - 화면. 손으로 만든다(제네릭 화면 생성기를 두지 않는다 - 스펙 1.2). `app/(app)/examples/` 를
   따라 훅 호출과 JSX 만 둔다(`app/AGENTS.md`). 쓰기 화면은 `lib/auth/protected-paths.ts` 에 보호 경로를 더한다.
5. 검증 - 계약 거울은 `RESOURCES` 를 읽어 조회 정책·응답 속성 키·enum 값을 저절로 잰다(속성 제약은 쓰기 라우트가
   있는 자원만 - `test/contract/AGENTS.md`). 화면의 E2E 플로를 `test/e2e/flows/` 에 더한다(`test/e2e/AGENTS.md`).
   게이트(`./scripts/check.sh`)가 통과해야 끝이다.
```

(b) D8 기록을 가리키는 문장 - D1–D7 이 기록마다 더한 문단의 끝이다.

루트 `AGENTS.md` 의 `실측 기록은` 으로 시작하는 마지막 문단 끝에 한 문장을 더한다:

```markdown
Windows 게이트 전체와 CI 매트릭스의 마지막 실행, 문서군의 일치 검사(D8 실측 G1–G4)는
`docs/superpowers/notes/2026-10-01-d8-measurements.md`에 있다.
```

(c) 디렉터리 문서 탐색(결정 17) - 파일의 끝이다.

`AGENTS.md` 끝에 더한다(빈 줄 하나 뒤 새 절):

```markdown

## 디렉터리 문서 탐색

실행·환경 변수·변형·EAS·CI 는 `README.md` 가, 계층 계약은 이 파일이 갖는다. 디렉터리마다의 `AGENTS.md` 가 그
디렉터리의 세부 - 파일마다의 역할과 그 자리의 함정 - 를 소유한다. 게이트 [7] 의 `test/unit/docs/doc-set.test.ts` 가
문서군과 파일을 맞댄다 - 인용한 경로가 있어야 하고, 각 `AGENTS.md` 는 자기 디렉터리의 바로 아래 항목을 모두 불러야
한다. 그래서 새 파일을 만들면 그 디렉터리의 문서에 한 줄을 더한다. 저장소 밖의 경로(원본·백엔드 저장소의 파일)를
이름 그대로 불러야 하면 그 시험의 `EXTERNAL` 에 까닭과 함께 적는다.

| 디렉터리                              | 무엇                                                                                     |
| ------------------------------------- | ---------------------------------------------------------------------------------------- |
| [`.github/`](.github/AGENTS.md)       | CI 워크플로 - 잡이 하는 일의 정본은 스크립트다                                           |
| [`app/`](app/AGENTS.md)               | 라우트 - 화면·레이아웃·가드 배치                                                         |
| `assets/`                             | 앱 아이콘·스플래시 이미지 - `app.config.ts` 가 가리킨다                                  |
| [`components/`](components/AGENTS.md) | 화면이 나눠 쓰는 부품 - React Native Reusables 복사본, 폼, 자원 UI, 앱 조각, 실험실 카드 |
| [`docs/`](docs/AGENTS.md)             | 설계·계획·실측 기록과 복사 출처 기록                                                     |
| [`lib/`](lib/AGENTS.md)               | 순수 TypeScript 판단 - JSON:API 코어, 자원, 인증, 설정, 실험실, 딥링크, 빌드 정보        |
| [`plugins/`](plugins/AGENTS.md) | Expo 설정 플러그인 - 생성 네이티브 프로젝트의 변환과 정확한 앵커 검사 |
| [`platform/`](platform/AGENTS.md)     | 기기 모듈 호출과 배선 - API 클라이언트, 세션 관리자, Query 캐시, 업데이트                |
| [`queries/`](queries/AGENTS.md)       | TanStack Query 의 캐시 키·조회·쓰기 훅·무효화                                            |
| [`scripts/`](scripts/AGENTS.md)       | 단일 게이트와 검사기                                                                     |
| [`test/`](test/AGENTS.md)             | 단위 시험, 계약 거울, E2E                                                                |
```

(d) 예시 이름(`x.sh`)을 실제 경로로 바꾼다 - 문서 시험이 그 이름을 없는 파일로 잡는다.

`.github/workflows/AGENTS.md` — Edit, 찾을 것:

```markdown
스크립트는 `bash x.sh` 처럼 우회하지 않고 `./x.sh` 로 부른다
```

바꿀 것:

```markdown
스크립트는 `bash scripts/check.sh` 처럼 우회하지 않고 `./scripts/check.sh` 로 부른다
```

(D7 의 글자가 다르면 같은 뜻의 문장에서 예시 이름만 실제 경로로 바꾼다.)

(e) Windows 게이트와 D7 source helper를 적는다.

`test/e2e/AGENTS.md` — `## iOS` 바로 앞에 더한다:

```markdown
## Windows 게이트의 시작 상태

소유 AVD를 새로 부팅하고 이 저장소의 Metro와 다른 무거운 작업이 끝난 뒤 게이트를 혼자 돌린다(D5 실측 C2).
다른 기기/에이전트 작업을 임의 종료하지 않는다. adb 서버 재시작은 다른 기기가 없고 컨트롤러가 시간을 비운
경우에만 수동으로 한다. 하네스가 자동으로 adb 서버를 재시작하지 않는다. UI 계층 질의 정지/연결 끊김은
실패 회차의 로그·uptime·동시 작업과 함께 기록하고 retry/timeout을 늘리지 않는다.

`ios-simulator.sh`는 run-ios.sh가 source하는 도우미다(100644). `ios-simulator.ts`의 허용 목록으로 전용 simulator의
서비스를 축소하고 설정 준비 뒤 한 번만 재부팅한다. 사용자 기기는 선택 정보를 읽는 데만 쓰고 설정하지 않는다.
```

`test/e2e/AGENTS.md` — Edit, 찾을 것:

```markdown
`flows.test.ts`
```

바꿀 것:

```markdown
`test/unit/e2e/flows.test.ts`
```

`platform/AGENTS.md` — Edit, 찾을 것:

```markdown
`ios-log.ts`
```

바꿀 것:

```markdown
`test/e2e/ios-log.ts`
```


(f) 진단의 변형 결합을 적는다.

`platform/AGENTS.md` — Edit, 찾을 것:

```markdown
`e2e-diagnostics.ts`는 설정 검증을 통과한 `AppRoot`에서만 부른다.
```

바꿀 것:

```markdown
`e2e-diagnostics.ts`는 설정 검증을 통과한 `AppRoot`에서만 부른다. 진단·이벤트·HTTP 로그는 현재
변형 표의 e2e 전용 `logsHttpFailures`를 공유한다. 다른 변형에 그 값을 켜면 진단 범위도 함께 바뀌므로
`test/unit/platform/e2e-diagnostics.test.ts`의 변형 불변식과 비-e2e 구독/cleanup 시험을 함께 검토한다.
```

기존 `e2e-diagnostics.ts` 행/`##` 내용을 확인하고 logsHttpFailures가 현재 e2e 진단·이벤트·HTTP 로그의 공통 스위치라는 사실을 덧붙인다. source에는 주입 전송/토큰/쿼리 문자열 미기록·QueryCache unsubscribe와 AppState.remove가 있다. 일반 변형에서 켜려면 진단 범위를 함께 검토한다. 설명 앵커는 `e2e-diagnostics.ts` 행이며 단위 시험의 실제 불변식이 정본이다.

(g) D6 문서 앵커를 다시 읽는다: `lib/updates/AGENTS.md`의 `## 규칙`·`## 검증`, `lib/config/AGENTS.md`의 OTA/native 설정 설명, `test/e2e/AGENTS.md`의 두 단계 Gradle 설명, `queries/AGENTS.md`의 updates 옵션. R29와 K4가 더한 현재 설명을 최신 사실로 적되 과거 D6 기록의 본문/복사본 주석은 고쳐 쓰지 않는다. form.ts/write.ts의 원본 Server Action 설명은 출처의 역사이며 Expo의 현재 쓰기는 queries/writes.ts→주입 send라는 이탈 주석을 함께 읽는다. contract mirror는 K4의 backend kind별 상태/code/pointer·저장 후 상태와 access600초를 검사한다. KNOWN_DIVERGENCES는 실제0이다.

- [ ] **Step 6: D8 기록의 뼈대를 만든다**

`docs/superpowers/notes/2026-10-01-d8-measurements.md` 를 만든다(README 가 가리킨다 - 값은 Step 7 과 Task 3 이 채운다):

````markdown
# D8 실측 기록 - 문서군의 일치, Windows 게이트 전체, CI 의 마지막 실행 (2026-10-01)

스펙 17장의 완료 조건을 닫는 기록이다. 조건 2·3(CI 매트릭스·세 백엔드)이 처음 초록이 된 실행과 그때까지 고친 것은
`2026-10-01-d7-measurements.md` 의 K3 에 있다. 이 기록은 그 뒤 D8 의 변경(개발 클라이언트, 오류 경계의 다시 시도,
연결 판정, 문서군)을 얹은 마지막 상태를 적는다.

## G1 — Windows 개발 머신의 게이트 전체(13단계)

(Task 3 Step 7 이 채운다 - Step 2 의 날짜·커밋, `.maestro-output/d8-gate.log` 의 단계마다의 결과 줄, E2E 의 플로 수와 걸린 시간,
APK 를 다시 만들었는지)

## G2 — GitHub Actions 의 마지막 실행

(Task 3 Step 6·7 이 채운다 - 실행 주소·커밋, 논리 아홉 칸·물리12잡의 결론과 걸린 시간, E2E 칸마다 받은 백엔드 커밋, 그 전에 빨갛던
실행이 있으면 실행마다 원인과 고친 것)

## G4 — CI 최적화 전후

Task 0의 baseline/cold/warm 실행별 SHA·native key·Xcode/SDK/architecture·잡/단계/restore/save/대기 시간·ccache 통계·shard manifest·백엔드 SHA·범위 보존·실제 절감값을 기록한다. Task 0이 이미 얻은 사실을 옮기며 미측정값을 성공으로 쓰지 않는다.

## G3 — 문서군의 일치(게이트 [7])

`test/unit/docs/doc-set.test.ts` 를 처음 돌렸을 때(README 와 새 `AGENTS.md` 를 쓰기 전) 잡은 것이다.

```text
(Task 2 Step 2 의 출력 - 실패한 시험과 그 목록을 붙인다)
```

고친 것: (Task 2 Step 7 이 채운다 - 죽은 인용·부르지 않은 항목마다 고친 문서와 방식, `EXTERNAL` 에 둔 항목과 까닭,
낡은 문장을 고친 자리)
````

G3 의 첫 괄호를 Step 2 의 출력(`grep` 의 줄들)으로 바꾼다.

- [ ] **Step 7: 남은 어긋남을 고친다**

```bash
timeout 300 pnpm exec vitest run test/unit/docs/doc-set.test.ts > .maestro-output/d8-docs-final.log 2>&1; echo "exit=$?"
grep -E "×|Test Files|Tests |^\s*\+ |ENOENT" .maestro-output/d8-docs-final.log
```

Expected: `exit=0`·`Tests  11 passed (11)`. 빨가면 출력의 항목마다 아래 규칙으로 고치고 다시 돈다 - **문장을 지우거나 파일을 옮겨 시험을 통과시키지 않는다.**

(a) **죽은 인용**(출력의 `<문서>:<줄>: <경로>` 줄) — 이 저장소의 파일을 가리켰다면 실제 경로로 고친다(`git ls-files | grep <이름>` 으로 찾는다 - 짧은 이름이면 같은 문단에 그 디렉터리를 먼저 부르거나 경로를 다 적는다). 파일이 정말 사라졌으면 그 문장이 낡은 것이다 - 지금의 사실로 고쳐 쓴다.

(b) **저장소 밖의 경로**(원본 `template-typescript-nextjs`·백엔드 저장소·액션·설치본·기기와 APK 안의 경로)를 이름 그대로 부른 자리는 `test/unit/docs/doc-set.test.ts` 의 `EXTERNAL` 에 그 문서의 항목으로 더하고, 줄 위 주석에 무엇의 경로인지 적는다. **이 저장소의 파일은 여기 넣지 않는다.** "쓰이지 않은 예외" 로 나온 항목은 그 문서에 그 글자가 없는 것이다 - 지운다(D5–D7 이 다른 글자를 썼으면 실제 글자로 바꾼다).

(c) **부르지 않은 항목**(`<문서>: <이름>` 또는 `<이름>/`) — 그 디렉터리의 `AGENTS.md` 의 표에 한 행을 더한다(역할은 그 파일의 머리 주석에서 한 줄로). 디렉터리면 그 디렉터리가 하는 일을 한 줄로 적는다(하위 문서가 있으면 링크로). 루트 `AGENTS.md` 는 디렉터리만 본다 - "디렉터리 문서 탐색" 표에 행을 더한다.

(d) **낡은 문장** - 시험이 못 보는 내용 쪽 어긋남을 훑는다:

```bash
git grep --untracked -n -E "아직 (없|만들|쓰지|돌지|붙이)|D[4-9] ?(가|이) (만든다|더한다|붙인다|복사한다|고친다)|\((D[4-9])\)(도|이|가) |나중에 (더한다|붙인다)" -- "*AGENTS.md" README.md
```

Expected: 출력이 없다(재검증 트리에서 없었다 - 새 문서는 아직 추적하지 않아 `--untracked` 로 함께 훑는다). 사실인 "아직" 은 이 식에 걸리지 않는다 - 루트의 "어떤 위치가 아직 비어 있어도"(계층 표의 계약), `components/AGENTS.md` 의 "아직 비어 있다"(훅의 자리), README 의 "아직 켜지 않았습니다"·"아직 돌리지 않았습니다"(지렛대·EAS 실계정 - 알려진 한계). 줄이 나오면 앞 단계가 "D<n> 가 더한다" 처럼 앞날로 적은 문장이다 - 이미 이뤄졌으면 지금의 사실로 고쳐 쓴다(누가 했는지는 남겨도 된다 - "D4 가 더했다").

(e) **D7 이 남긴 드리프트** - 기록 K3 를 본다:

```bash
grep -n -i -E "KNOWN_DIVERGENCES|드리프트" docs/superpowers/notes/2026-10-01-d7-measurements.md | head
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --input-type=module -e "const m = await import('./test/e2e/matrix.ts'); console.log('KNOWN_DIVERGENCES', m.KNOWN_DIVERGENCES.length); for (const d of m.KNOWN_DIVERGENCES) console.log(d.backend, d.test, d.reason)"
```

`KNOWN_DIVERGENCES 0` 이면(재검증 트리 - D7 의 끝은 0건) README 를 그대로 둔다. 항목이 있으면 README 의 "알려진 한계" 끝에 항목마다 한 줄을 더한다 - ``- **<백엔드> 의 계약 드리프트** - <시험 식별자>: <까닭의 한 문장>(`test/e2e/matrix.ts` 의 `KNOWN_DIVERGENCES`). 백엔드 저장소에 알리는 것은 사용자 확인 뒤의 일입니다.`` 백엔드 저장소에 이슈를 올리지 않는다(전역 제약).

고친 것을 기록 G3 의 "고친 것" 에 적는다 - 항목마다 문서·방식 한 줄, `EXTERNAL` 의 항목과 까닭, (d) 에서 고친 문장의 자리.

- [ ] **Step 8: 정적 검사와 단위 시험 전체**

```bash
pnpm exec prettier --write test/e2e/AGENTS.md platform/AGENTS.md README.md AGENTS.md app/AGENTS.md components/AGENTS.md components/app/AGENTS.md components/form/AGENTS.md components/ui/AGENTS.md components/lab/AGENTS.md lib/AGENTS.md lib/updates/AGENTS.md scripts/AGENTS.md test/AGENTS.md test/unit/AGENTS.md .github/workflows/AGENTS.md test/unit/docs/doc-set.test.ts
timeout 300 pnpm typecheck && timeout 300 pnpm lint && timeout 300 pnpm format:check && timeout 300 pnpm lint:secrets && ./scripts/check-citations.sh app components lib platform queries test && echo "static ok"
timeout 300 pnpm test 2>&1 | grep -E "Test Files|Tests "
git ls-files --others --exclude-standard
```

Expected: `static ok`(`docs/AGENTS.md` 와 기록은 Prettier 가 무시한다 - `.prettierignore` 의 `docs/`), 단위 시험 `Test Files  101 passed`·`Tests  1973 passed`(D7의 F=95·N=1914에서 - Task 0의 +34, Task 1의 +14, 문서 시험11), 추적하지 않은 파일은 이 태스크가 만든 것뿐이다. 문서 시험이 이 실행에서도 초록이어야 한다 - 새 파일이 생겼으면(Prettier 가 만들지 않는다) 그 문서에 한 줄을 더한다.

- [ ] **Step 9: 스펙 정정**

스펙 — `## 15. 구현 단계` 바로 앞(14장의 끝)에 더한다:

```markdown
> 정정(2026-10-01, D8): 문서군은 위 목록에 더해 `components/`(그리고 `app/`·`form/`·`ui/`·`lab/`)·`lib/`·`lib/updates/`·
> `scripts/`·`test/`·`test/unit/`·`docs/` 의 `AGENTS.md` 를 둔다(`lib/config/`·`lib/navigation/`·`lib/lab/`·
> `test/contract/`·`test/e2e/`·`.github/` 의 것은 앞 단계가 뒀다). 루트 `AGENTS.md` 가 새 자원 추가 절차와 디렉터리
> 문서 탐색을 갖는다. 17장 조건 5 는 게이트 [7] 의 `test/unit/docs/doc-set.test.ts` 가 매번 잰다 - README 와
> `AGENTS.md` 가 인용한 경로가 있고, 각 `AGENTS.md` 가 자기 디렉터리의 바로 아래 항목을 모두 부르고, 이 장의 문서가
> 있고, 환경 변수가 10.1 의 세 곳에서 같다. 저장소 밖의 경로를 이름 그대로 부르는 자리는 그 시험의 `EXTERNAL` 에
> 까닭과 함께 적는다.
```

스펙 — `## 16. 리스크` 바로 앞(15장의 끝)에 더한다:

```markdown
> 정정(2026-10-01, D8): 단계 8 의 "GitHub 저장소 생성" 은 D3 전에 끝났다 - `builder-shin/template-typescript-expo` 는
> 공개 저장소다(사용자 확인). 끝난 단계는 컨트롤러가 `main` 에 병합 커밋으로 병합해 push 하고, CI 는 모든 브랜치의
> push 에서 돈다(13장의 D7 정정). 태그·릴리스는 만들지 않았다 - 이 표가 산출로 정하지 않았다.
```

```bash
grep -c "정정(2026-10-01, D8)" docs/superpowers/specs/2026-09-30-expo-jsonapi-template-design.md
```

Expected: 2026-10-01 D8 정정5(Task 1의 셋+이 둘), 별도 2026-10-02 CI 정정1. 마지막17장 정정까지 전체7이다.

- [ ] **Step 10: 커밋**

```bash
git status --short
git add test/unit/docs/doc-set.test.ts README.md AGENTS.md app/AGENTS.md components/AGENTS.md components/app/AGENTS.md components/form/AGENTS.md components/ui/AGENTS.md components/lab/AGENTS.md lib/AGENTS.md lib/updates/AGENTS.md scripts/AGENTS.md test/AGENTS.md test/unit/AGENTS.md docs/AGENTS.md .github/workflows/AGENTS.md test/e2e/AGENTS.md platform/AGENTS.md docs/superpowers/notes/2026-10-01-d8-measurements.md docs/superpowers/specs/2026-09-30-expo-jsonapi-template-design.md
git status --short
git commit -m "docs: README 와 계층별 AGENTS.md 를 갖추고 문서군이 실제 파일과 맞는지 게이트가 잰다"
git status --short
```

Expected: 첫 `git status` 에는 이 태스크의 파일과 Step 7 이 고친 문서만 있다 - 둘째에 남는 것(Step 7 이 고친 다른 `AGENTS.md`)이 있으면 `git add` 로 더한 뒤 커밋한다. 커밋 뒤 남은 파일이 없다. 이 커밋은 `docs/` 밖(README·`AGENTS.md`)을 바꾸므로 Task 3 의 push 가 CI 를 돌린다(결정 20).

### Task 3: 마감 — Windows 게이트 전체, CI 의 마지막 초록, 기록

**사용자 승인의 범위:** 이 태스크는 공개 저장소 `builder-shin/template-typescript-expo` 에 `feat/d8-docs-and-release` 를 push 해 CI 를 돌리고, 원인을 고친 커밋을 같은 브랜치에 push 한다 - D7 Task 4 에서 사용자가 승인한 것과 같은 범위다. 컨트롤러가 이 태스크를 맡기기 전에 그 승인이 이 계획에도 닿는지 확인한다(닿지 않으면 Step 3 까지 하고 멈춘다). PR 을 열지 않고, `main` 을 건드리지 않고, force push 하지 않고, 저장소 설정·다른 저장소를 건드리지 않고, 태그를 만들지 않는다. **실행은 네 번이 상한이다**(결정 20). 초록이 되지 못한 것을 초록이라고 적지 않는다.

**Files:**
- Modify: `docs/superpowers/notes/2026-10-01-d8-measurements.md`(G1·G2), 스펙(17 정정), 실패의 원인이 있는 파일(Step 3·6 의 갈래가 가리킨다)
- 임시(git 이 무시한다): `.maestro-output/d8-gate.log`, `.maestro-output/d8-run-<번호>.log`·`-failed.log`·`-full.log`, `.maestro-output/d8-run-<번호>/`(받은 아티팩트)

**Interfaces:**
- Consumes: Task 1·2 의 커밋, Task 0 뒤 워크플로 `CI`(잡 이름 `checks (게이트 [1]–[11])`·`build-android (e2e APK)`·`e2e-android (<백엔드>)`·`build-ios (e2e .app)`·`e2e-ios (<백엔드>, shard <번호>/2)`, 아티팩트 `e2e-android-<백엔드>`·`e2e-ios-<백엔드>-shard-<번호>`·`ios-build-log`·앱 둘, 백엔드 저장소 확인 단계의 `git ls-remote` 줄), D2–D7 의 하네스, `gh`(builder-shin, 토큰 범위에 `repo`·`workflow`)
- Produces: 13단계가 모두 통과한 게이트 기록, 논리 아홉 칸·물리12잡 모두 초록인 `feat/d8-docs-and-release`의 실행(번호·주소·커밋) 또는 상한에 닿은 보고, 기록 G1·G2, 스펙 17 정정, 컨트롤러에게 보낼 보고

- [ ] **Step 1: 준비를 확인한다 (읽기만)**

```bash
export GIT_TERMINAL_PROMPT=0 GIT_PAGER=cat
git status --short
git log --oneline -5
docker info --format '{{.ServerVersion}}'
docker ps --filter name=joon- -q | wc -l
docker ps --filter label=com.docker.compose.project=template-typescript-expo-e2e -q | wc -l
"$ANDROID_HOME/emulator/emulator" -list-avds
"$ANDROID_HOME/platform-tools/adb" devices
(command -v maestro >/dev/null && maestro --version) || ~/.maestro/bin/maestro --version
```

PowerShell 에서 이 저장소의 `expo start` 가 떠 있지 않은지 본다(`[10]` 이 `--clear` 로 Metro 캐시를 지운다):

```powershell
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match 'expo.+start' } | Select-Object ProcessId, CommandLine
```

Expected: 깨끗한 작업 트리, Task 0의 독립 세 커밋·warm 측정 커밋과 Task 1/2/계획·D7 병합이 있다, Docker 판, `9`, `0`, AVD 목록에 `Pixel_9_API_36`, `2.11.0`, PowerShell 의 출력이 비어 있다(있으면 그 프로세스를 끈다 - 다른 저장소의 것이면 건드리지 않는다).

- [ ] **Step 1a: Windows 게이트의 시작 상태를 정한다**

PowerShell에서 node/java 작업(`vitest|tsc|expo export|gradle|maestro|check.sh`)과 이 저장소 Metro가 겹치지 않는지 확인한다. 다른 작업이면 종료하지 않고 컨트롤러가 비운 시간에 시작한다. `adb devices`에서 사용할 AVD를 명시하고 연결 기기가 여럿이면 `ANDROID_SERIAL`로 고른다. 소유한 AVD만 종료/새 부팅한다. 다른 기기가 없고 컨트롤러가 시간을 비운 때만 adb kill-server/start-server를 수동으로 하며 자동 복구를 추가하지 않는다.

```bash
E2E_AVD=Pixel_9_API_36 timeout 600 ./test/e2e/android.sh boot
timeout 30 "$ANDROID_HOME/platform-tools/adb" shell cat /proc/uptime
```

Expected: 이미 오래 켜진 AVD를 재사용하지 않았고 새 기기의 uptime이600초 이하다. 이 확인은 retries가 아니라 시작 상태다. 지킬 수 없으면 컨트롤러에게 현재 프로세스/기기 상태를 넘긴다.

- [ ] **Step 2: 게이트 전체를 돈다 — 기기 작업은 여기서 한 번**

`[8]` 이 여덟 평가를, `[12]` 가 FastAPI 스택의 계약 거울을, `[13]` 이 빌드 입력이 바뀐(의존성과 앱 코드) e2e APK 를 짧은 경로 사본에서 **한 번** 만든 뒤 새 스택에서 플로를 전부 돈다. 한 시간 남짓 걸릴 수 있어 백그라운드로 돌리고 끝나기를 기다린다(도구의 전경 제한은 10분이다).

```bash
mkdir -p .maestro-output
docker ps --filter name=joon- -q | wc -l
git rev-parse --short HEAD
date -u +%FT%TZ
E2E_AVD=Pixel_9_API_36 E2E_ANDROID_ABIS= E2E_CHECKS=1 timeout 7200 ./scripts/check.sh > .maestro-output/d8-gate.log 2>&1; echo "gate exit=$?"
date -u +%FT%TZ
grep -E "^=== |Test Files|Tests |변형 설정 (통과|위반)|checks passed|Metro 캐시를 비웠다|BUILD SUCCESSFUL|APK 의 (앱 설정|OTA)|APK 를 다시 만들지 않는다|E2E 통과|^--- " .maestro-output/d8-gate.log
docker ps --filter name=joon- -q | wc -l
docker ps --filter label=com.docker.compose.project=template-typescript-expo-e2e -q | wc -l
```

Expected: 앞뒤 `9`, `gate exit=0`, `=== [1/13] typecheck ===` 부터 `=== [13/13] E2E ===` 와 `=== 전부 통과 ===`, `[7/13]` 의 `Test Files  101 passed`·`Tests  1973 passed`, `[8/13]` 의 `변형 설정 통과` 여덟(위반 없음), `[9/13]` 의 `21/21 checks passed`, `[12/13]` 의 계약 거울이 94개 실패 없이 통과, `[13/13]` 의 `Metro 캐시를 비웠다: …`, `BUILD SUCCESSFUL`, 둘째 Gradle의 정확한 `createReleaseUpdatesResources UP-TO-DATE`(하네스가 Gradle 을 `--no-daemon` 으로 돌린다 - D4 실측 W1), `APK 의 앱 설정: …appVariant=e2e…` 와 `APK 의 OTA: updates={"enabled":false} … ENABLED=false … usesCleartextTraffic=true`(D6 의 단언 - 개발 클라이언트가 바꾸지 않는다), "APK 를 다시 만들지 않는다" 는 **나오지 않는다**, `--- examples-create` 를 비롯한 플로 줄, `=== E2E 통과 - 플로 23개 ===`(Task 1 Step 1 의 플로 수), 끝난 뒤 우리 compose 프로젝트의 컨테이너 `0`. [13] 뒤의 request-stall가 headers/body 두 REQUEST_TIMEOUT과 정상 가드를 통과해야 한다. 시작·끝 시각과 머리 커밋을 기록 G1 에 쓴다(Step 7).

- [ ] **Step 3: 실패하면 원인을 고친다**

실패한 단계의 출력과 `.maestro-output/e2e/<플로>/`(Maestro 기록·스크린샷·`logcat.txt`·`api.log`)를 본다. **원인을 고친다** - 재시도를 더하지 않고, 단언을 지우거나 가드를 약하게 하지 않는다. 짐작되는 갈래:

(a) **`[8]` 의 scheme 위반** — Task 1 Step 3 (e) 의 갈래다(순서만 다르면 기대 순서를 잰 순서로, 집합이 다르면 플러그인 항목).

(b) **`[13]` 의 APK 빌드가 죽는다**(Gradle) — 첫 오류를 찾는다(`grep -n -E "FAILURE|error:|What went wrong" .maestro-output/d8-gate.log | head`). `expo-dev-launcher`·`expo-dev-menu` 의 release 변형에서 났으면 그 모듈의 `build.gradle` 이 읽는 속성(`expo.devlauncher.configureInRelease` - 기본 거짓)과 오류를 기록에 적고 멈춰 컨트롤러에 넘긴다(결정 2 의 "틀리면"). Metro 단계가 0xC0000005·139 로 죽으면 전역 제약의 30분 규칙이다.

(c) **D4–D7 이 초록으로 잰 플로가 빨갛다**(`examples-create`·`examples-delete` 의 "홈으로" - `back-to-home-button` 포함) — 이 계획은 화면과 플로를 고치지 않았다. 스크린샷과 `maestro.log` 를 보고 이 계획의 변경(release 의 빈 개발 런처, 루트 경계, 연결 판정)과 닿는지 가른다 - 플로가 오류 경계의 화면(`router_error_message`)에 멈췄으면 그 문구의 결함부터 고친다(경계를 가리지 않는다). 닿지 않으면 같은 증상을 D4 실측 W1·D7 기록 K1 에서 찾는다. 앱 코드를 고쳤으면 `E2E_FLOW="<플로>" ./test/e2e/run-android.sh` 로 그 플로를 먼저 잰다(빌드 입력이 바뀌어 APK 를 다시 만든다).

(d) **가드가 새 경고로 실패한다**(`W/ReactNativeJS`·`E/ReactNativeJS`) — `logcat.txt` 에서 그 줄을 찾는다. 개발 클라이언트의 모듈이 release 에서 경고를 낸다면 원인을 기록과 함께 컨트롤러에 넘긴다(가드를 약하게 하지 않는다). 앱의 새 코드(루트 경계·연결 판정)가 낸 경고면 그 원인을 고친다.

(f) **기기 환경 실패** — UI 계층 질의 정지/adb ConnectException이면 그 회차 로그·스크린샷·기기 uptime·동시 작업을 보존한다. 앱 원인과 환경 원인을 구분하고 컨트롤러가 시간을 비운 새 시작 상태에서 전체 게이트를 돈다. 실패 회차를 PASS로 바꾸지 않으며 timeout/retry를 늘리지 않는다. 새 시작 상태에서도 반복되면 증거와 함께 멈춘다.

(e) **그 밖** — 같은 증상이 D4–D7 의 기록(`docs/superpowers/notes/2026-10-01-d4-measurements.md`·`d5`·`d6`·`d7`)에 있으면 거기 적힌 원인부터 본다.

고친 뒤: 앱 코드·빌드 레시피·의존성을 고쳤으면 Step 2 의 게이트 전체를 다시 돈다(결정 23 - 조건 1 의 증거는 마지막 코드에 대한 전체 통과다). 플로나 시험만 고쳤으면 그 플로를 `E2E_FLOW` 로 먼저 재고, 커밋 전에 게이트 전체를 한 번 더 돈다. 고친 것은 커밋한다(`fix: …` - 한국어, 원인을 본문에 한 줄).

- [ ] **Step 4: 브랜치를 push 한다**

```bash
export GIT_TERMINAL_PROMPT=0 GIT_PAGER=cat
git status --short
timeout 60 gh auth status 2>&1 | grep -E "Logged in|Token scopes"
timeout 60 git ls-remote origin refs/heads/feat/d8-docs-and-release
timeout 120 git fetch origin
if git show-ref --verify --quiet refs/remotes/origin/feat/d8-docs-and-release; then
  git merge-base --is-ancestor origin/feat/d8-docs-and-release HEAD || exit 1
fi
git log --oneline origin/main..HEAD
git diff --stat origin/main..HEAD -- . ":(exclude)docs" | tail -n 1
timeout 300 git push -u origin feat/d8-docs-and-release
git rev-parse HEAD
```

Expected: 깨끗한 트리, `Logged in … builder-shin` 과 범위의 `workflow`, `ls-remote`는 Task 0 마지막 push의 SHA다. fetch한 origin/feat/d8-docs-and-release가 현재 HEAD의 조상이고 G4의 마지막 측정 SHA와 같은지 확인한다. Task 0 최초 push에서만 빈 줄이어야 한다. 다른 SHA면 보낸 주체를 조사하고 force push하지 않는다, 보낼 커밋(Task 0 이후의 Task 1 둘·Task 2 하나·Step 3 고침; 최초 Task 0 push는 계획·독립 최적화 세 커밋), `docs/` 밖을 바꾼 파일의 수가 0 이 아니다(머리가 README·`AGENTS.md`·앱 코드를 바꿨다 - `paths-ignore` 에 걸리지 않는다, 결정 20), push 성공과 머리 커밋. `origin/main` 이 D7 의 병합보다 앞서 있으면(컨트롤러가 다른 것을 병합했다) 멈추고 컨트롤러에 묻는다 - 이 브랜치를 그 위로 다시 쌓지 않는다.

- [ ] **Step 5: 실행을 찾고 끝나기를 기다린다**

아래 블록 전체를 백그라운드로 돌리고 끝나기를 기다린다 - 실행은 한 시간 남짓, 길면 세 시간 가까이 걸린다(iOS 는 빌드 뒤에 E2E 가 돈다):

```bash
export GIT_TERMINAL_PROMPT=0 GIT_PAGER=cat
HEAD_SHA=$(git rev-parse HEAD)
RUN=''
for attempt in $(seq 1 30); do
  RUN=$(timeout 60 gh run list -R builder-shin/template-typescript-expo --workflow ci.yml --commit "$HEAD_SHA" --event push --limit 1 --json databaseId --jq '.[0].databaseId // empty')
  [ -n "$RUN" ] && break
  sleep 10
done
echo "run=$RUN"
timeout 12000 gh run watch "$RUN" -R builder-shin/template-typescript-expo --exit-status --interval 60 > ".maestro-output/d8-run-$RUN.log" 2>&1; echo "watch exit=$?"
timeout 60 gh run view "$RUN" -R builder-shin/template-typescript-expo --json url,headSha,conclusion,jobs --jq '.url, .headSha, .conclusion, (.jobs[] | [.name, .conclusion, .startedAt, .completedAt] | @tsv)'
```

Expected: `run=<번호>`, `watch exit=0`, 실행 주소·머리 커밋·`success`, 물리12잡 모두 `success`(논리 아홉 칸의 iOS 셋은 두 shard 모두 성공). 5분 안에 실행이 없으면 워크플로가 발화하지 않은 것이다 - `timeout 60 gh run list -R builder-shin/template-typescript-expo --branch feat/d8-docs-and-release --limit 5` 로 보고 D7 계획 Task 4 Step 6 (a) 의 갈래(`docs/superpowers/plans/2026-10-01-d7-ci.md`)를 따른다. `watch exit=124` 면 실행을 취소하지 않고 같은 `watch` 로 다시 기다린다. 논리 아홉 칸·물리12잡이 모두 초록이면 Step 7 로 간다.

Task 0의 측정 실행 두 번과 이번 최종 실행을 같은 G2/G4 표에서 센다. 실행 상한 넷은 공유한다. 분할 뒤 각 backend의 `e2e-ios (..., shard 1/2)`·`(..., shard 2/2)`를 모두 찾고 다음을 확인한다: 16+5=21 무중복·cold-links 포함, Android23·계약94/백엔드, iOS fastapi shard1과Android fastapi request-stall의 headers/body REQUEST_TIMEOUT 두 줄. 백엔드별 Android와두iOS SHA도 같아야 한다. R33의 소유기기 서비스 축소·AutoFill/scheme 준비·**한 번 재부팅**·설치·정리 순서를 로그에서 확인하며 재부팅을 플로 retry로 옮기지 않는다. 캐시가 hit라도 새 번들/앱 설정·서명·OTA/URL 검사는 실제 실행돼야 한다.

- [ ] **Step 6: 빨간 칸의 원인을 고친다 (실행 상한 넷)**

```bash
timeout 300 gh run view "$RUN" -R builder-shin/template-typescript-expo --log-failed > ".maestro-output/d8-run-$RUN-failed.log" 2>&1 || true
timeout 900 gh run download "$RUN" -R builder-shin/template-typescript-expo -D ".maestro-output/d8-run-$RUN"
ls ".maestro-output/d8-run-$RUN"
```

칸마다 실패한 단계의 로그와 받은 아티팩트(`<갈래>/<플로>/` 의 `maestro.log`·스크린샷·`logcat.txt` 또는 `device.log`·`device.ndjson`·`api.log`, `ios-build-log`)를 본다. 이 계획이 바꾼 것에서 나올 수 있는 갈래:

(a) **`build-ios` 가 빨갛다** — `ios-build-log` 의 첫 `error:` 를 본다. `EXDevLauncher`·`EXDevMenu` 의 pod·컴파일 오류면 그 줄과 Xcode 판을 기록에 적고 멈춰 컨트롤러에 넘긴다(결정 2 의 "틀리면" - 개발 클라이언트를 되돌릴지는 사용자가 정할 일이다). `assert-app` 이 Info.plist 의 새 키(`NSBonjourServices`)로 죽었으면 그 키는 Debug 가 아닌 빌드에서 지워져야 한다 - 빌드 단계(`[Expo Dev Launcher] Strip Local Network Keys for Release`)가 돌았는지 빌드 기록에서 본다.

(b) **`e2e-ios` 의 플로가 빨갛다** — 개발 클라이언트가 iOS 의 e2e 앱에 더한 것은 Info.plist 의 로컬 네트워크 키(Release 빌드에서 지워진다)뿐이다. `examples-create`·`examples-delete` 가 머리글의 "홈으로"(`back-to-home-button`)에서 멈췄으면 D7 기록 K3 에서 같은 칸이 초록이었는지 본다 - D7 이 그 길을 iOS 에서 처음 쟀다(D7 다음 계획 4). K3 에서도 그 자리가 넘겨진 채면 D7 의 갈래를 따르고, 초록이었으면 이 계획의 변경에서 원인을 찾는다. 그 밖의 플로는 Step 3 (c) 와 같은 순서로 가른다.

(c) **`e2e-android` 만 빨갛다** — 같은 플로가 로컬 게이트(Step 2)에서 통과했으므로 CI 의 기기(pixel_7 - 411dp)와 로컬(Pixel 9)의 차이거나 백엔드의 차이다. NestJS·Rails 칸만이면 D7 계획 Task 4 Step 6 (i) 의 드리프트 갈래다.

(d) **그 밖**(러너·이미지·캐시·Xcode·드라이버·시뮬레이터 로그) — D7 계획 Task 4 Step 6 (a)–(j) 와 D7 기록 K3 에 적힌 지난 실패와 고침을 따른다.

고친 것을 커밋하고(`fix: …` - 한국어, 원인과 실행 번호를 본문에) push 한 뒤 Step 5 로 돌아간다. 앱 코드를 고쳤으면 push 전에 Step 2 의 게이트 전체를 다시 돈다(로컬 조건 1). 실행마다 기록 G2 의 표에 한 행(번호·커밋·빨간 칸·원인·고친 것)을 적는다. **네 번째 실행도 빨가거나 같은 칸이 서로 다른 고침 셋에도 빨가면 멈추고** 증거(G2 의 표, 마지막 실행의 주소, 빨간 칸마다 실패한 단계의 로그 줄과 아티팩트 경로, 짐작한 원인)와 함께 컨트롤러에 보고한다. 러너 할당 실패(잡이 시작도 못 했다)만 `timeout 60 gh run rerun "$RUN" -R builder-shin/template-typescript-expo --failed` 로 다시 돌릴 수 있고, 그것도 실행 수에 센다.

- [ ] **Step 7: 기록과 스펙 정정을 쓰고 push 한다 (CI 는 돌지 않는다)**

초록인 실행의 값을 모은다:

```bash
timeout 300 gh run view "$RUN" -R builder-shin/template-typescript-expo --log > ".maestro-output/d8-run-$RUN-full.log" 2>&1
grep -E "refs/heads/main" ".maestro-output/d8-run-$RUN-full.log" | awk -F'\t' '{print $1, $NF}' | sort -u
timeout 60 gh run view "$RUN" -R builder-shin/template-typescript-expo --json url,headSha,jobs --jq '.url, .headSha, (.jobs[] | [.name, .conclusion, .startedAt, .completedAt] | @tsv)'
```

Expected: E2E 물리잡 아홉(Android3+iOS6)이 받은 백엔드 커밋(`e2e-android (fastapi) <sha> refs/heads/main` 같은 줄 - 백엔드마다 Android·iOS 가 같은 커밋이어야 한다), 실행 주소·머리 커밋·물리12잡의 시각.

(a) 기록 `docs/superpowers/notes/2026-10-01-d8-measurements.md` 의 괄호 안 안내를 사실로 바꾼다:
- **G1** - 날짜(Step 2 의 시작·끝 UTC)와 머리 커밋, 머신(Windows 11, AVD `Pixel_9_API_36`, FastAPI 스택), Step 2 의 `grep` 줄(단계마다의 결과), 플로 수와 걸린 시간, APK 를 다시 만든 까닭(의존성·앱 코드). Step 3 에서 고친 것이 있으면 그 원인과 고침.
- **G2** - 실행 표(번호·주소·머리 커밋·결론·빨간 칸·원인·고친 것 - 초록인 마지막 실행까지), 초록인 실행의 물리12잡과 잡마다 걸린 시간·대기·iOS 두 manifest의 합21 무중복·Android23·계약94·플랫폼별request-stall, 백엔드마다 받은 커밋(위 `grep`), 이 실행이 이 계획의 바뀐 것(개발 클라이언트가 든 앱 둘, 루트 경계와 연결 판정이 든 번들)을 지났다는 문장.

(b) 스펙 — 파일 끝(17장의 D7 정정 뒤)에 날짜 붙은 D8 정정을 더한다. 조건 1의 Windows 전체13단계 통과를 G1의 실제 짧은 SHA로, 조건 5의 문서 시험을 `test/unit/docs/doc-set.test.ts`로 명시한다. 조건 2·3은 G2의 실제 초록 실행 URL·짧은 SHA·논리 아홉 칸/물리12잡으로 명시한다. 근거는 `docs/superpowers/notes/2026-10-01-d8-measurements.md`의 G1·G2다. 기록 시점의 날짜와 검증된 값으로 문장을 쓰며 아직 모르는 SHA/URL의 자리표시 문장을 커밋하지 않는다.

```bash
export GIT_TERMINAL_PROMPT=0 GIT_PAGER=cat
pnpm format:check && ./scripts/check-citations.sh app components lib platform queries test && echo "docs ok"
timeout 300 pnpm exec vitest run test/unit/docs/doc-set.test.ts 2>&1 | grep -E "Tests "
git add docs/superpowers/notes/2026-10-01-d8-measurements.md docs/superpowers/specs/2026-09-30-expo-jsonapi-template-design.md
git commit -m "docs: Windows 게이트 전체와 CI 의 마지막 실행을 기록하고 완료 조건 1·5 를 닫는다"
git diff --stat HEAD~1..HEAD
timeout 300 git push origin feat/d8-docs-and-release
timeout 60 gh run list -R builder-shin/template-typescript-expo --branch feat/d8-docs-and-release --limit 3 --json headSha,status,conclusion --jq '.[] | [.headSha[0:7], .status, .conclusion] | @tsv'
git status --short
```

Expected: `docs ok`, `Tests  11 passed (11)`, 커밋 하나가 `docs/` 아래의 파일 둘만 바꿨다, push 성공, 실행 목록의 맨 위가 Step 5 의 초록 실행이다(이 커밋은 `docs/` 만 바꿔 실행을 만들지 않는다 - 결정 19·20), 남은 파일이 없다.

- [ ] **Step 8: 보고한다**

컨트롤러에게 보고할 것: 브랜치의 머리 커밋, 게이트 기록의 요약(G1 - 13단계·플로 수·걸린 시간), 초록인 실행의 주소와 칸마다 걸린 시간, 실행 수와 실행마다 고친 것(G2 의 표), Step 2–6 에서 넘긴 것이 있으면 그것, 그리고 아래 "컨트롤러가 할 일". 상한에 닿았거나 초록이 되지 못했으면 그 사실과 마지막 실행의 빨간 칸·원인을 그대로 보고한다 - 초록이라고 적지 않는다. 이 태스크는 `main` 에 병합하지 않는다.

---

## 끝난 상태

- **Task 0** — CI 전용 x86_64·iOS 두 shard·native DerivedData/ccache가 독립 세 커밋으로 있고 baseline/cold/warm·대기 포함 실제 절감이 G4에 있다. 절감이 없는 변경은 해당 커밋만 되돌린 기록이 있다.
- **Task 1** — `expo-dev-client` ~57.0.19 가 있고 `development` 변형만 그 scheme(`exp+template-typescript-expo`)을 싣는다(변형 표의 `devClientScheme`, `app.config.ts` 의 `SLUG`·`DEV_CLIENT_SCHEME`·플러그인). 게이트 [8] 이 네 변형의 introspect 에서 그것을 잰다. 네트워크 복귀의 판정은 `lib/jsonapi/online.ts` 다. 루트 레이아웃의 `ErrorBoundary` 는 Expo Router 의 기본 화면을 그리고 "Retry" 앞에 조회 캐시를 비운다(`queries/error-boundary.ts`) - 출구는 따로 없다(결정 8). 스펙 8.5·9.3·10.5 정정.
- **Task 2** — README(앱 식별자 바꾸기가 첫 절 - 시작하기·환경 변수·변형·화면·백엔드 전환·EAS 와 OTA·게이트·E2E·CI·복사한 코어·알려진 한계·문서), 새 계층 문서 열하나(D6의 lib/updates와 D7의 plugins는 기존 문서), 루트 `AGENTS.md` 의 새 자원 추가 절차와 디렉터리 문서 탐색. 게이트 [7] 의 `test/unit/docs/doc-set.test.ts` 가 문서군과 파일을 매번 맞댄다(시험 11). 첫 실행이 잡은 어긋남과 고침이 기록 G3 에 있고 CI 측정은 G4에 있다. 스펙 14·15 정정. D6 기존 문서는 보존되고 새 script·support·plugins 문서 탐색이 실제 파일과 맞는다.
- **Task 3** — Windows 게이트 전체(13단계)가 통과했고(G1), `feat/d8-docs-and-release`의 실행에서 논리 아홉 칸·물리12잡이 모두 초록이다(G2). 스펙 17 정정 - 완료 조건 1–5 가 모두 닫혔다. 상한에 닿았으면 그 사실과 증거가 보고에 있다.
- 수: 단위 시험 +59(파일 +6 - 실제 D7에서 `95`·`1914` → `101`·`1973`), 출처 기록 그대로, 플로 수 그대로(23 - iOS 21), `.sh` 그대로(11개 중진입점10은100755·source helper1은100644), 의존성 +1(`expo-dev-client`), 계층 문서 +11(열여섯 → 스물일곱), 스펙 정정 +7(Task 0의 13장 CI + 기존6).

## 컨트롤러가 할 일 (사용자의 상시 결정)

1. 리뷰 뒤 `main` 에 병합 커밋으로 병합한다 - `git checkout main && git merge --no-ff feat/d8-docs-and-release -m "merge: D8 문서군·게이트 전체 통과·게시(feat/d8-docs-and-release)를 main 에 병합한다"`(AI 태그 없이), 그리고 `timeout 300 git push origin main`.
2. 그 push 가 `main` 에서 매트릭스를 한 번 더 돈다 - `gh run list -R builder-shin/template-typescript-expo --branch main --limit 1` 로 찾아 초록인지 보고 사용자에게 알린다. 기록하지 않는다(결정 22). 빨가면 같은 커밋 내용이 브랜치에서 초록이었으므로 흔들림이다 - 원인을 고치는 작업을 새로 연다(재시도로 덮지 않는다).
3. 태그·릴리스는 만들지 않는다(결정 21) - 사용자가 원하면 그때 정한다.

## 다음 계획(D9 - 사용자 승인 뒤)

스펙 15장 단계 9(EAS 실계정 실증 - 10.7)가 넘겨받는 것. D6 계획의 "D9" 절이 순서와 걸릴 수 있는 것을 적었다(`eas login` → `eas init`(id 를 `EAS_PROJECT_ID` 로) → `eas env:create --environment preview --name BACKEND_URL` → `eas build --profile preview --platform android` → 설치 → 빌드 정보 카드 → `APP_VARIANT=preview BACKEND_URL=<같은 주소> EAS_PROJECT_ID=<id> eas update --channel preview --environment preview` → "업데이트 확인" → 새 업데이트 ID). D8 이 더한 것:

- `expo-dev-client` 가 있어 `eas build --profile development` 도 설치를 묻지 않고 돈다 - 실증에 개발 빌드를 쓸 일은 없지만, 쓰면 그 빌드만 `exp+template-typescript-expo` scheme 을 갖는다.
- README 의 "EAS 빌드와 OTA" 절이 사용자가 따라 할 명령이다 - 실증에서 다르게 돌아간 자리가 있으면 그 절과 D6 의 기록 O1 을 함께 고친다(문서 시험이 경로를 잰다).
- 오류 경계 - 일반 초기 화면이 홈이라는 것은 node에서만 쟀고 R29의 cold 초기 URL과 Retry 조합은 기기에서 재지 않았다(결정 8). 실기기에서 결함을 일으킬 길(고장 주입 프록시 등)이 생기면 그때 잰다. 화면 단위 경계나 출구를 더하는 단계는 그 길도 조회 캐시를 비운다(스펙 9.3 의 D8 정정).

- D7 최종 리뷰의 D9 이월: Android splash 기본 exit(400ms fade 제거)·모든 변형 iOS scene opt-in은 native fingerprint를 바꿨다. development·preview·production의 새 네이티브 빌드에서 launch·splash·cold/warm 링크·SecureStore를 확인한다. Expo/EAS의 기본 Metaspace512MiB와 O4의 TalkBack/iOS announcement, EAS fingerprint의 Windows/Linux 동일성을 OTA-on 실증과 함께 확인한다.
- iOS offline/delete failure는 실제 네트워크 차단 장치가 있어야 검증할 수 있다. 이 D8의 두 shard는 기존 iOS21을 보존하며 Android 전용 두 실패 UI를 iOS PASS로 쓰지 않는다. K3 NOT RUN은 해당 로컬 회차의 한계로 유지한다.
