# EAS·OTA·빌드 정보 카드 구현 계획 (D6 — 단계 6)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 빌드 변형 넷의 EAS·OTA 설정(`eas.json`, expo-updates, `fingerprint` runtime version)을 넣고, 변형마다 네이티브 설정이 될 값이 변형 표와 같은지를 게이트가 Expo 계정 없이 검사하게 하며(변형별 설정 검증), 홈의 빌드 정보 카드가 기기에서 그 설정을 보이게 한다.

**Architecture:** OTA 판단은 `lib/config/updates.ts`(변형 표의 새 칸 `updatesChannel` 과 선택 변수 `EAS_PROJECT_ID`)에 두고, `app.config.ts` 가 그것을 Node 의 type stripping 으로 불러 `updates`·`runtimeVersion`·`extra.eas` 를 싣는다. `eas.json` 의 빌드 프로필은 변형과 1:1 이고 단위 시험이 채널·Node·pnpm 을 맞댄다. 게이트 [8] 은 변형 넷 × EAS 프로젝트 유무를 `expo config --type introspect` 로 평가하고, `scripts/check-variant-config.mjs` 가 네이티브 설정이 될 값(AndroidManifest.xml·strings.xml·Info.plist·Expo.plist)을 표와 맞댄다. 빌드 정보 카드는 판단이 `lib/updates/build-info.ts`, expo-updates 호출이 `platform/updates.ts`, 훅이 `queries/updates.ts`, 그림이 `components/app/build-info-card.tsx` 다 - 훅은 D4 의 쓰기 훅처럼 쓰기 옵션을 내보내고 `throwOnError` 를 주며, 배선과 옵션은 `vi.mock`·`MutationObserver` 시험이 잰다. 기기 작업은 마지막 태스크 하나다 - 게이트 한 번(APK 한 번)이 APK 의 앱 설정과 병합된 매니페스트를 단언하고 카드 플로를 돈다.

**Tech Stack:** Expo SDK 57 (`expo` ~57.0.26 · `react-native` 0.86.3) · `expo-updates` ~57.0.24 · `expo-constants` ~57.0.20 · Expo Router 57.0.24 · `@tanstack/react-query` 5.104.0 · Uniwind 1.12 + React Native Reusables · vitest 5.0.2 · Node 24 의 type stripping · EAS CLI 24.8.0 의 `eas.json` 스키마(`@expo/eas-json` 24.8.0) · Maestro 2.11.0 · Android SDK build-tools 의 `aapt2`

**Spec:** `docs/superpowers/specs/2026-09-30-expo-jsonapi-template-design.md` — 15장 단계 6(`eas.json`, expo-updates, 빌드 정보 카드 — 산출: 변형별 설정 검증). 근거 절: 1.2(개발은 development build 기준), 3장(expo-updates ~57.0.24, eas-cli 24.8.0), 4장(트리), 5장(`platform/` 이 Updates·Constants 를 부른다), 8.1(홈의 빌드 정보 카드), 8.7(로딩 표현), 10장 전부(10.1 환경 변수와 시작 재검증, 10.2 변형, 10.4 CNG, 10.5 `eas.json`, 10.6 OTA, 10.7 계정이 필요한 실증은 9단계), 11.1(단위 - `app.config.ts` 의 검증), 11.3(E2E), 12장(게이트 8단계), 16장(리스크 "OTA 실증에 Expo 계정이 필요하다"·"설정 오류가 OTA로 배포된다"), 그리고 날짜 붙은 정정 전부. 이어받는 항목의 정본은 `docs/superpowers/notes/2026-09-30-d1-carry-forward.md` 의 "D6" 절(EAS 빌드의 Node 를 22.18 이상으로 고정)과 D5 계획의 "다음 계획" 절(홈의 `testID` 를 지키며 카드를 더한다)이다. `docs/superpowers/notes/2026-10-01-d2-carry-forward.md` 에는 D6 절이 없다.

## Global Constraints

- **런타임 버전은 Expo SDK 57 번들 버전을 따른다.** 이 계획이 더하는 의존성은 `expo-updates` 하나다 - `BACKEND_URL=https://gate-check.invalid pnpm exec expo install expo-updates`(`bundledNativeModules.json` 의 `~57.0.24`). SDK 밖의 패키지를 저장소에 더하지 않는다(`@expo/eas-json` 은 실측 O2 에서 저장소 밖의 임시 디렉터리에만 받는다). `expo-dev-client` 는 설치하지 않는다 - D8 계획이 설치한다(결정 3).
- **`app.config.ts`를 평가하는 모든 명령(`expo config`·`expo export`·`expo prebuild`·`pnpm types:routes`·`expo-doctor`·`expo-updates` CLI)에는 `BACKEND_URL`을 준다.** 백엔드에 닿지 않는 명령은 `https://gate-check.invalid`다(스펙 10.1 — 없으면 멈춘다). Expo CLI 는 `.env` 를 읽는다 - 설정 값을 재는 명령은 `EAS_PROJECT_ID`·`EAS_BUILD_PROJECT_ID` 를 빈 값으로라도 명시한다(결정 12).
- **`lib/config/*.ts` 는 Node 의 type stripping 으로 돈다**(`app.config.ts` 와 `scripts/check-variant-config.mjs` 가 직접 불러온다, D1 실측 M7). 타입만 지우면 도는 구문만 쓰고(`enum`·값 있는 `namespace`·매개변수 프로퍼티 금지, 타입은 `import type`/`{ type X }`), 서로 import 할 때 `.ts` 확장자를 붙인다.
- **Node `>=24.11.0`, `packageManager: "pnpm@11.22.0"`**, `nodeLinker: hoisted`.
- **TypeScript strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`.** 선택 prop·속성에 `undefined`를 명시해 넘기지 않는다 — 키를 빼거나 펼침(`...(조건 ? {} : { 키 })`)으로 만든다.
- **`lib/**`에서 `react`·`react-native`·`expo`·`expo-*`·`@expo/*`·`@react-native*`·`@react-navigation/*`·`@tanstack/*`·`uniwind` 등을 import하면 위반이다**(스펙 5장, ESLint가 막는다). 위 계층(`platform/`·`queries/`·`components/`·`app/` — 별칭이든 상대 경로든)을 import해도 막힌다. expo-updates·expo-constants 는 `platform/updates.ts` 만 부른다.
- **`package.json`에 없는 패키지를 import하면 lint가 실패한다**(`import/no-extraneous-dependencies`).
- **어떤 모듈도 최상위에서 `getSettings()`를 부르지 않는다.**
- **`app/`에는 라우트 파일만 둔다.** 화면 조각은 `components/`, 판단은 `lib/`, 훅은 `queries/`, 네이티브 모듈 호출은 `platform/`. 화면 파일에는 훅 호출과 JSX 만 둔다(스펙 8.4).
- **쓰기 훅은 훅이 쓰는 옵션을 내보내고 `throwOnError` 를 준다**(`queries/AGENTS.md` 의 쓰기 오류 규칙 - D4 `538b84b`). 시험은 그 옵션을 TanStack Query 의 `MutationObserver` 로 그대로 돌린다 - 훅 자체는 시험하지 않는다(스펙 11.1). `platform/` 의 배선은 기기 모듈과 설정 자리를 `vi.mock` 으로 바꿔 잰다(`platform/AGENTS.md` 의 `## 검증`). 화면을 쌓는 이동은 `useNavigateOnce`(`components/app/navigate-once.ts`)를 지난다 - 이 계획은 새 이동을 더하지 않고 D5 홈의 두 진입을 그대로 둔다(결정 14·17·22).
- **로딩 상태에 텍스트를 쓰지 않는다.** 스피너(`ActivityIndicator` - `SubmitButton`) 또는 스켈레톤만 쓴다(스펙 8.7). 업데이트 확인이 도는 동안과 다시 켜는 동안은 버튼의 스피너만 그린다.
- **`app/`·`components/` 에 `@media` 로 컴파일되는 변형을 쓰지 않는다** — 너비(`sm:`·`md:`·`lg:`·`xl:`·`2xl:` 과 그 `max-`·`min-` 꼴), 방향(`portrait:`·`landscape:`), 플랫폼(`ios:`·`android:`·`native:`·`tv:`). `test/unit/ui/breakpoints.test.ts` 가 파일 전체(주석 포함)를 훑어 막는다. `dark:` 는 된다.
- **아이콘은 `lucide-react-native/icons/<이름>` 깊은 import 의 기본 내보내기로 받는다** — 이 계획의 새 코드는 아이콘을 쓰지 않는다.
- **오류 문구 카탈로그를 두지 않는다.** 앱 자신의 오류 문구는 복사한 `UNUSABLE_RESPONSE_MESSAGE` 뿐이다(스펙 9.3). 빌드 정보 카드의 "새 업데이트가 없습니다."·"업데이트를 확인하지 못했습니다. <expo-updates 의 문구>" 는 백엔드 오류가 아니라 업데이트 확인의 결과 표시다.
- **복사한 파일은 `docs/provenance/copied-core.json`에 적는다.** 이 계획은 복사본을 만들거나 고치지 않는다 - 출처 기록의 수는 D5 의 끝 그대로다.
- **사라질 자리를 인용하지 않는다.** `app/`·`components/`·`lib/`·`platform/`·`queries/`·`test/` 안에서 선행 점이 붙은 `.superpowers/`, `superpowers/sdd`, `task-<번호>-report.md` 같은 세션 파일, 세션 작업 공간을 가리키지 않는다(게이트 [5]가 막는다). 실측 명령을 담는 임시 스크립트는 git 이 무시하는 `.maestro-output/` 에 두고 문서가 그 경로를 가리키지 않는다 - 기록에는 명령의 알맹이를 적는다.
- **계정 이름이 든 절대 경로를 저장소에 남기지 않는다.**
- **ESLint 타입 규칙이 잡는 것:** `async` 함수에는 `await`가 있어야 한다(`require-await`). 콜백으로 넘기는 멤버는 메서드가 아니라 함수 속성으로 선언한다(`unbound-method`). 쓰지 않는 `catch` 변수는 `catch {`로 쓴다. 떠 있는 Promise 는 `void` 로 받거나 `.catch` 로 잡는다(`no-floating-promises`). Error 가 아닌 값으로 거절하지 않는다(`prefer-promise-reject-errors`).
- **한 파일만 도는 시험은 `pnpm exec vitest run <파일>`**이다 — pnpm 11은 `pnpm test -- <파일>`에 `--`를 그대로 넘겨 전체가 돈다.
- **게이트는 Git Bash에서 `./scripts/check.sh`로 돈다.** `pnpm check`는 Windows에서 cmd.exe가 `./`를 못 찾는다.
- **`expo export`는 언제나 `--clear`로 돌린다.** 이 개발 머신(Windows)에서 캐시를 둔 `expo export`는 끝날 때 간헐적으로 0xC0000005(Git Bash에서 139)로 죽었다(D1 실측 M1 관찰 8). 이 저장소의 `expo start`를 끄고 돌린다. 그래도 139로 죽으면 다시 돌려 덮지 않는다 — 원인을 찾는다(스펙 16장: 재시도 0).
- **Gradle 의 Metro 단계(E2E APK 빌드의 `createBundleReleaseJsAndAssets`, 그리고 expo-updates 가 더하는 `createReleaseUpdatesResources`)도 Metro 캐시를 쓴다.** 그 단계가 0xC0000005·139로 죽으면 30분을 정해 원인을 가른다(D3–D5 전역 제약과 같다) — 못 찾으면 멈추고 기록과 함께 컨트롤러에 넘긴다.
- **Expo 계정이 필요한 명령을 쓰지 않는다** - `eas login`·`eas init`·`eas build`·`eas update`·`eas env:*`·`eas submit` 는 이 계획의 범위 밖이다(스펙 10.7 - 실계정 실증은 사용자 승인 뒤 15장 9단계). 게이트와 이 계획의 모든 확인은 계정·빌드 크레딧 없이 돈다.
- **개발 머신의 `joon-*` 컨테이너 9개를 절대 멈추지 않는다.** compose 명령은 모두 `-p template-typescript-expo-e2e`를 주고 그 프로젝트만 내린다(`test/contract/run.sh`·`test/e2e/run-android.sh` 가 그렇게 한다). Docker를 건드리는 단계는 앞뒤로 `docker ps --filter name=joon- -q | wc -l`이 `9`인지 확인한다. 같은 머신의 다른 `fastapi-*` 컨테이너도 건드리지 않는다.
- **Windows의 Android 네이티브 빌드는 저장소 루트가 실제 디렉터리 경로 47자 이하일 때만 된다**(D1 실측 M1). E2E 하네스가 짧은 경로(`E2E_STAGE_DIR`, 기본 `C:/t/e`)의 사본에서 빌드한다.
- **Maestro 플로 규칙:** 요소는 testID(`id:`)로 찾는다. `launchApp` 뒤에는 화면 요소를 기다린 다음 이동한다. **`hideKeyboard` 를 쓰지 않는다**(Maestro 2.11.0 의 Android 구현은 뒤로 가기다). 정규식 값은 작은따옴표로 감싼다(`'0\.1\.0'`). 중첩 `runFlow` 의 env 범위에 기대지 않는다.
- **E2E 가드(`test/e2e/guard-log.sh`):** 머리말 `# e2e-allow-http:` 에 적은 상태는 그 플로의 기기 로그에 한 번 이상 나와야 하고, 적지 않은 상태는 나오면 실패다. `W/`·`E/ReactNativeJS` 줄이 하나라도 있으면 실패다 — `console.error`·`console.warn` 은 E2E 가 지나는 길에 두지 않는다. 앱의 줄(ReactNativeJS)이 하나도 없는 로그도 실패다.
- **셸 heredoc 에 역슬래시가 든 코드를 넣지 않는다.** 코드·문서·스크립트 파일은 Write 도구로 쓰고, 찾아 바꾸기는 Edit 도구로 한다. 대화형 명령(`git rebase -i`·`git add -i`·에디터를 여는 명령), 감시 모드(`expo start`·`vitest` 의 watch)는 쓰지 않는다 - 끝나지 않는 명령은 에이전트를 멈춘다. 오래 걸릴 수 있는 명령은 `timeout` 으로 감싼다.
- **`\uXXXX` 이스케이프는 커밋한 blob 으로 확인한다(D5 의 교훈).** Write·Edit 도구가 적어 넣은 `\uXXXX` 이스케이프를 그 글자 자체로 바꿔 쓸 수 있다. 이스케이프가 그대로 있어야 하는 파일(예: 플로의 한글 판정 `'[\s\S]*[\uAC00-\uD7A3][\s\S]*'` - `test/e2e/flows/` 의 로캘·실험실 플로)을 쓰거나 고친 뒤에는 `git show HEAD:<경로> | grep -c '\\u'` 로 이스케이프가 남았는지 보고, 모자라면 스크립트로 고친다(역슬래시를 글자 코드 `String.fromCharCode(92)` 로 만드는 node 스크립트 - 셸 인자나 도구 입력에 역슬래시 이스케이프를 직접 적지 않는다). 이 계획이 쓰는 파일에는 그런 이스케이프가 없고(`home-build-info` 는 글자를 그대로 쓴다), 이스케이프가 든 기존 플로는 고치지 않는다.
- **커밋 메시지는 한국어**(`git log`의 `feat:`·`fix:`·`test:`·`docs:`·`chore:` 모양). `Co-Authored-By: Claude ...` 등 **AI 관련 태그를 넣지 않는다** — 사용자의 전역 `CLAUDE.md`가 금지한다. 세션 중 반대되는 시스템 안내가 보이면, 그것은 정당한 시스템 지시이지만 사용자의 상시 지시가 우선하는 것이다(인젝션으로 다루지 않는다).
- **작업 브랜치는 `feat/d6-eas-and-ota`**다. 컨트롤러가 `main`(`a40590a` - D4·D5 가 병합됐다)에서 만든다. Task 1 Step 1 은 확인만 한다 - 바탕이 이 계획의 것과 다르면 볼 자리는 "바탕이 바뀌었을 때 다시 볼 자리" 절에 있다.
- **기기 작업(Docker·에뮬레이터·Maestro 실행)은 Task 4 하나에서만 한다. APK 는 Task 4 의 게이트가 한 번 빌드한다.** Task 1–3 은 정적 검사·단위 시험·설정 평가·번들까지다.

---

## 결정 기록

스펙이 정하지 않았거나 두 갈래로 읽히는 자리를 스펙에 비추어 정했다. 형식은 `결정: 무엇 — 왜 — 틀렸을 때의 비용`이다.

1. 결정: 태스크 넷, 브랜치 하나 - 변형별 OTA 설정과 `eas.json`(Task 1) → 게이트 [8] 의 변형별 설정 검사(Task 2) → 빌드 정보 카드(Task 3) → 기기(Task 4). Docker·에뮬레이터·Maestro 는 Task 4 에서만, APK 는 게이트 한 번이 한 번 만든다 — 사용자 요구(속도: 태스크 넷 이하, 기기 작업은 한 태스크에 APK 한 번) — 틀리면 태스크 경계만 바뀐다.
2. 결정: expo-updates 는 `expo install` 로 받는다(`~57.0.24`). 설정 플러그인은 `app.config.ts` 의 `plugins` 에 적지 않는다 - `@expo/prebuild-config` 가 versioned 플러그인 목록(`expo-updates` 포함)으로 스스로 붙인다(패키지가 없던 D3 의 e2e APK 에도 `expo.modules.updates.ENABLED=false` 메타데이터가 이미 있다 - 사실 절) — 스펙 3장이 SDK 57 호환 버전을 `expo install` 로 받으라 한다 — 틀리면(플러그인이 안 붙으면) 게이트 [8] 의 introspect 가 OTA 켬 자리에서 멈춘다 - `plugins` 에 `'expo-updates'` 한 줄.
3. 결정: `expo-dev-client` 는 이 계획에서 설치하지 않는다 - D8 계획이 설치한다(D8 결정 2·3: `expo install expo-dev-client`, 변형 표의 새 칸 `devClientScheme`(development 만 `true`), `app.config.ts` 의 `['expo-dev-client', { addGeneratedScheme: profile.devClientScheme }]`, 게이트 [8] 의 검사기가 같은 칸에서 development 의 scheme 기대값을 만든다). `eas.json` 의 `development` 프로필은 스펙 10.5 대로 `developmentClient: true` 다 — 그 설정 플러그인은 기본으로 **모든 변형**에 같은 scheme `exp+template-typescript-expo` 를 더해(expo-dev-client 57.0.19 의 `withDevClient`, `addGeneratedScheme: true`) 스펙 10.2 의 D1 정정(변형마다 다른 scheme - 여러 변형을 함께 설치해도 딥링크가 갈 곳이 정해진다)을 깨고, `expo start` 의 기본 모드와 release APK 의 네이티브 모듈 구성을 바꾼다. 막는 조리법(표의 칸과 검사기의 기대값)은 이 계획의 검사기가 생긴 뒤에야 둘 자리가 있고, 게이트와 9단계의 실증(`preview` 프로필)은 dev client 를 쓰지 않으며, D6 의 APK 예산은 한 번이다. D8 이 기대는 이 계획의 끝 모양 - `.env.example` 의 변수 셋, 변형 표의 끝 칸 `updatesChannel`, `app.config.ts` 의 `BASE_NAME`·`slug`·`plugins` 의 끝 항목 `expo-secure-store`, 검사기의 `BASE_*` import·`const scheme` 다음 줄 `const runtimeVersion`·scheme 비교 둘, 설정·검사기 시험의 자리, `lib/config/AGENTS.md` 의 `updates.ts` 문단, 루트 `AGENTS.md` 끝의 실측 기록 문단, 플로 21 - 을 이 계획은 그 글자대로 만든다(미리 돌려 본 것) — eas-cli 24.8.0 은 `developmentClient` 프로필을 빌드할 때 설치를 묻는다(`ensureExpoDevClientInstalledForDevClientBuildsAsync`) — 틀리면(D8 전에 development 프로필로 EAS 빌드를 하면) `eas build --profile development --non-interactive` 가 "Install expo-dev-client manually" 로 멈춘다 - D8 Task 1 이 푼다.
4. 결정: OTA 는 채널이 있는 변형(preview·production)에 EAS 프로젝트가 있을 때만 켠다. 채널은 변형 표의 새 칸 `updatesChannel`(`lib/config/app-variant.ts`)이다 — 스펙 10.2 의 OTA 칸과 10.6 "`EAS_PROJECT_ID`가 없거나 변형이 `development`·`e2e`면 OTA를 끈다" — 틀리면 표의 칸 하나.
5. 결정: 채널은 두 자리에 둔다 - `app.config.ts` 의 `updates.requestHeaders['expo-channel-name']`(EAS 밖의 빌드 - prebuild + Gradle·xcodebuild 가 쓴다)과 `eas.json` 프로필의 `channel`(EAS 빌드가 네이티브 설정에 다시 쓴다 - `@expo/build-tools` 24.8.0 의 `setChannelNativelyAsync`). 두 값이 같은지 `test/unit/config/eas-json.test.ts` 가 본다 — 스펙 10.5 표의 채널 칸과 10.6 "채널은 빌드 프로필과 1:1" 을 빌드 방식과 무관하게 지킨다(Expo 문서: EAS Build 가 아니면 `updates.requestHeaders` 로 채널을 둔다) — 틀리면 머리글 한 줄을 빼고 시험 하나를 고친다.
6. 결정: `runtimeVersion: { policy: 'fingerprint' }` 는 OTA 를 켠 빌드에만 싣는다 — 끈 빌드는 받을 업데이트가 없는데, 정책이 있으면 Gradle 의 `createReleaseUpdatesResources` 가 빌드마다 프로젝트 지문을 계산한다(`expo-updates/utils/build/createFingerprintForBuildAsync.js`) - E2E APK 빌드에 느리고 흔들릴 수 있는 단계를 더하지 않는다 — 틀리면 펼침 한 줄을 뺀다.
7. 결정: `EAS_PROJECT_ID` 는 UUID 여야 하고(아니면 설정 평가가 멈춘다), 없거나 비었으면 EAS 빌드 서버의 `EAS_BUILD_PROJECT_ID` 를 쓴다 — 틀린 id 는 업데이트 주소를 틀리게 만들어 OTA 가 소리 없이 멈춘다(스펙 10.1 의 "설정을 평가하는 순간 실패"). 폴백이 없으면 로컬 eas-cli 의 평가(EAS_PROJECT_ID 있음 → OTA 켬 → fingerprint)와 서버의 평가(id 없음 → OTA 끔 → runtime version 없음)가 달라 EAS 빌드가 "Runtime version calculated on local machine not equal to runtime version calculated during build" 로 멈춘다(`@expo/build-tools` 24.8.0 의 `configureExpoUpdatesIfInstalledAsync`) — 틀리면 폴백 한 줄과 시험 둘.
8. 결정: 프로젝트 id 가 있으면 변형과 무관하게 `extra.eas.projectId` 를 싣는다 - eas-cli 와 EAS 빌드가 프로젝트를 찾는 자리이고(`getProjectIdAsync`, 빌드 서버의 `EAS_BUILD_PROJECT_ID_MISMATCH` 검사) OTA 와 별개다 — 틀리면 펼침의 조건 하나.
9. 결정: `eas.json` 의 빌드 프로필은 변형과 같은 넷뿐이다 - 공통 값을 담는 `base` 프로필(`extends`)을 두지 않고 네 프로필에 Node `24.19.0`·pnpm `11.22.0` 을 각각 적는다. `base` 는 빌드할 수 있는 프로필이 되고 `APP_VARIANT` 없이 development 로 평가된다. Node 는 D1 실측 M7 이 type stripping 을 잰 버전(24.19.0)이고 `engines.node`(`>=24.11.0`)와 type stripping(22.18 이상)을 둘 다 넘는다 - pnpm 11 이 `engineStrict` 로 `engines.node` 를 강제하므로 22.18 로는 설치가 멈춘다 — D1 운반 기록 D6 절 — 틀리면 값 둘을 네 자리에서 바꾼다(시험이 다른 값을 막는다).
10. 결정: `environment` 는 프로필 이름과 같은 EAS 환경(`development`·`preview`·`production` - `BACKEND_URL` 을 `eas env:create` 로 넣는 자리)이고 `e2e` 는 정하지 않는다. `e2e` 는 `distribution: internal`·`withoutCredentials: true`(에뮬레이터·시뮬레이터용 빌드 - Expo 문서의 E2E 예시)다. `$schema` 는 적지 않는다(`@expo/eas-json` 이 허용하지만 원격 주소 인용이 된다) — 스펙 10.5("`BACKEND_URL`은 `eas.json`에 적지 않는다", `e2e` 는 APK·시뮬레이터 빌드), 로컬·CI 는 prebuild + Gradle·xcodebuild 로 빌드한다(10.7) — 틀리면 키 하나씩.
11. 결정: `eas.json` 의 단위 시험은 이 저장소의 약속(프로필 = 변형, `APP_VARIANT`, 채널, Node, pnpm, `BACKEND_URL` 없음, 스펙 10.5 표의 칸)만 보고 스키마는 계획 실행 중 한 번 잰다(실측 O2 - `@expo/eas-json` 24.8.0 을 저장소 밖의 임시 디렉터리에 받아 해석) — 스키마를 시험에 넣으려면 `@expo/eas-json`(과 joi 등)을 devDependency 로 둬야 하고 EAS 명령은 어차피 매번 같은 검사를 한다 — 틀리면 devDependency 하나와 시험 하나.
12. 결정: 게이트 [8] 은 변형 넷을 EAS 프로젝트가 없을 때와 있을 때(`GATE_EAS_PROJECT_ID`, 모양만 UUID)로 `expo config --type introspect` 하고 `scripts/check-variant-config.mjs` 가 검사한다(여덟 평가, 이 머신에서 8초). 검사하는 것은 네이티브 설정이 될 값이다 - 식별자·scheme·앱 이름, 평문 HTTP(AndroidManifest 의 `usesCleartextTraffic`, iOS ATS), OTA(expo-updates 의 `ENABLED`·주소·채널 머리글·확인 시점·기다림, runtime version 표식). `EAS_PROJECT_ID`·`EAS_BUILD_PROJECT_ID` 는 빈 값으로도 명시한다(Expo CLI 가 `.env` 를 읽는다 - 실측으로 확인했다) — 스펙 15장 단계 6 의 산출 "변형별 설정 검증" 을 게이트가 매번 재고, 설정 플러그인이 빠지거나 덮는 것(단위 시험이 못 보는 자리)을 잡는다 — 틀리면(introspect 의 모양이 바뀌면) 검사기의 경로 몇 줄.
13. 결정: 검사기는 기대값을 `app.config.ts`·`lib/config` 에서 type stripping 으로 불러오고, 기대하는 변형과 프로젝트 id 는 환경 변수가 아니라 인자로 받는다. 검사기의 단위 시험 표본은 변형 표를 불러오지 않고 글자로 적는다 — 환경을 믿으면 섞인 값도 통과하고, 표본이 표를 불러오면 검사와 표본이 함께 틀려도 통과한다. Node 가 package.json 에 `type` 이 없는 `.ts` 를 ES 모듈로 다시 읽으며 내는 경고(`MODULE_TYPELESS_PACKAGE_JSON`)는 게이트가 `--disable-warning` 으로 끈다 — 틀리면 경고 한 줄이 게이트 기록에 남는다.
14. 결정: 빌드 정보 카드의 판단(행, 확인의 순서, 문구)은 새 디렉터리 `lib/updates/build-info.ts` 이고 expo-updates 의 세 호출을 주입받는다(`UpdatesApi` - D4 `write.ts`·D5 `run.ts` 와 같은 모양). expo-updates·expo-constants 를 읽고 부르는 것은 `platform/updates.ts`, 훅은 `queries/updates.ts`, 그림은 `components/app/build-info-card.tsx` 다. 훅은 D4 의 쓰기 훅 규칙을 따른다 - 쓰기 옵션 `updateCheckMutationOptions()`(키 `['updates', 'check']`)를 내보내 `useMutation` 과 시험이 함께 쓰고, `throwOnError: true` 를 준다(확인은 expo-updates 의 거절까지 결과 값으로 돌려주고 세션을 쓰지 않아 세션 거절이 없다 - `mutationFn` 안에서 던져진 것은 모두 결함이라 오류 경계로 간다). 제출은 D4 의 `useSubmitOnce` 로 한 번에 하나다(D5 가 적은 쓰는 곳 목록에 카드를 더한다 - 결정 24) — 스펙 5장(`platform/` 이 Updates·Constants 를 부르고 판단은 `lib/`), 8.4(화면에는 훅과 JSX 만), `queries/AGENTS.md` 의 쓰기 오류 규칙("새 쓰기 훅도 같은 옵션을 준다" - 세션 거절을 거르는 술어는 거를 것이 없어 `true` 와 같다). 이 실행의 값이지 설정 계약이 아니어서 `lib/config/` 에 두지 않는다 — 틀리면 파일 하나를 옮기거나, `throwOnError` 를 D4 의 술어(`(error) => !isSessionRejected(error)`)로 바꾸고 시험 하나를 고친다.
15. 결정: 카드의 행은 앱 버전(`Constants.expoConfig.version`)·변형(`extra.appVariant`)·OTA(켜짐/꺼짐)·runtime version·채널·업데이트 ID 다. 변형 행은 스펙 10.6 의 넷에 더했다 - 기기에서 "변형별 설정" 을 보는 자리다. 빈 문자열·`null` 은 "없음" 이다(OTA 를 끈 Android 빌드는 runtime version·채널을 빈 문자열로 준다 - expo-updates 57.0.24 의 `DisabledUpdatesController`). 내장 번들로 떴으면 업데이트 ID 뒤에 "(내장 번들)" 을 붙인다 — 스펙 10.6 "OTA가 실제로 도는지 눈으로 확인하는 최소 장치" — 틀리면 행 하나.
16. 결정: "업데이트 확인" 은 확인 → (새 업데이트 또는 내장 번들로 되돌리라는 지시가 있으면) 받기 → 받은 것이 새것이거나 되돌리기면 곧바로 `reloadAsync` 다. 없으면 "새 업데이트가 없습니다.", 거절되면 "업데이트를 확인하지 못했습니다. <expo-updates 의 문구>" 를 적는다 - 던지지 않는다. OTA 를 끈 빌드(`Updates.isEnabled` 거짓)는 버튼 대신 안내("이 빌드는 OTA 가 꺼져 있어 확인할 업데이트가 없습니다.")를 그린다 - 누르면 expo-updates 가 거절할 뿐이다 — 스펙 10.6 "받은 업데이트를 바로 적용한다" — 틀리면 문구와 분기 하나.
17. 결정: 홈은 D5 의 판이다(blob `5c5955d…` - 목록 진입 `home-examples-link` 은 D2 의 `Link`, 실험실 진입 `home-lab-link` 은 `useNavigateOnce` 를 지나는 outline `Button` - D5 결정 20, D4 결정 35). 뿌리를 `View` 에서 `ScrollView`(testID `home-screen` 그대로, `contentContainerClassName="flex-grow items-center justify-center gap-4 p-6"`)로 바꾸고 카드를 실험실 진입 아래에 둔다 - 카드가 폰 높이를 넘으면 스크롤한다. 두 진입의 testID 와 `navigateOnce` 는 그대로다 — D5 다음 계획 절 — 틀리면 뿌리 요소 하나.
18. 결정: 기기의 "변형별 설정 검증" 은 두 가지다 - (a) `test/e2e/android.sh build` 가 만든 APK 의 앱 설정(`assets/app.config` 의 `updates` 가 `{ enabled: false }` 이고 `runtimeVersion` 이 없다)과 병합된 AndroidManifest.xml(build-tools 의 `aapt2 dump xmltree` - expo-updates 의 `ENABLED=false`, 주소·채널 머리글 없음, `usesCleartextTraffic=true`)을 단언한다. (b) 플로 `home-build-info` 가 카드에서 변형 e2e, OTA 꺼짐, 세 값 없음, 확인 버튼 대신 안내를 본다. OTA 를 켠 변형의 기기 실증은 계정이 필요해 9단계다 — 스펙 10.6·10.7, 게이트 [8] 은 빌드 전의 값을 네 변형 모두 재고 여기서는 실제로 설치할 APK 를 잰다 — 틀리면 단언 한 함수.
19. 결정: 스펙 16장의 "설정 오류가 OTA로 배포된다" 에 든 `fingerprint` 대응을 한 번 잰다(실측 O1 - expo-updates CLI 의 `runtimeversion:resolve`, 계정·네트워크 없음, 13초). 설정이 다른 환경의 발행(`BACKEND_URL`·변형·프로젝트 id)은 runtime version 이 다르고 JS 만 바뀐 발행은 같다는 것을 기록에 남긴다. 게이트 단계로 두지 않는다 - 지문 계산은 `node_modules` 를 훑어 변형마다 수 초이고, 판정 대상은 expo 의 동작이지 이 저장소의 코드가 아니다 — 틀리면(게이트가 매번 재야 하면) 스크립트를 `scripts/` 로 옮겨 [8] 뒤에 붙인다.
20. 결정: 스펙 정정은 4장(트리 - `lib/updates/`·`lib/config/updates.ts`·검사기), 10.1(`EAS_PROJECT_ID`), 10.5(`eas.json`), 10.6(OTA 설정·fingerprint 판정, 빌드 정보 카드 - 둘), 11.3(E2E), 12장(8단계), 16장(리스크)에 붙인다 - 각 절 끝(다음 제목 바로 앞)이다 — 스펙과 달라졌거나 스펙이 정하지 않은 자리이고, 정정은 날짜 붙은 인용 블록이다(스펙 0장) — 틀리면 문장.
21. 결정: 이 계획의 "찾을 것"·끼울 자리는 D4·D5 를 병합한 `main` 의 `a40590a`(D4 `fe28615`, D5 의 마지막 고침 `7fde062` 와 같은 트리)를 `git archive` 로 꺼낸 트리(트리 해시 `4fddd1c` 이 저장소의 커밋과 같다)에 맞췄다. 전체를 바꾸는 `app.config.ts` 는 바꾸기 전에 blob 을 대조한다(`0515df1…` - D2 의 끝부터 D3–D5 가 건드리지 않는다). 이 계획 뒤에 `main` 에 커밋이 더해졌으면 볼 자리는 따로 적었다("바탕이 바뀌었을 때 다시 볼 자리" 절). 글자가 바뀌었으면 같은 뜻의 자리를 찾아 고친다(D4 결정 31·D5 결정 23 과 같다) — 앞서 맞췄던 바탕 넷(`3627679` 에 D5 계획을 얹은 흉내, 그것과 D4 Task 5 작업 트리의 병합, D5 의 `976b9f8`·`c99db78`)에서도 이 계획의 연산은 모두 맞았다 - 그 자리들은 D4·D5 의 글자가 바뀌는 동안에도 버텼다 — 틀리면(Edit 가 여럿 어긋나면) 앵커를 맞추는 시간이 들고, 뜻이 다르게 옮겨진 곳은 태스크 리뷰가 잡는다.
22. 결정: `platform/updates.ts` 의 배선과 훅의 쓰기 옵션에 시험을 둔다 - `test/unit/platform/updates.test.ts`(4 - expo-updates·expo-constants·`platform/config.ts` 를 `vi.mock` 으로 바꿔 값을 빌드 정보의 제자리로 옮기는지와 세 호출을 그대로 넘기는지)와 `test/unit/queries/updates.test.ts`(3 - 옵션을 `MutationObserver` 로 돌려 세 호출의 배선과 키, 거절이 오류가 아니라 결과 값인 것, `shouldThrowError` 로 `throwOnError`). D4·D5 가 같은 자리를 그렇게 잰다(`test/unit/platform/api.test.ts`·`query-client.test.ts`, `test/unit/queries/writes.test.ts`·`lab.test.ts`) — 판단의 시험(`build-info.test.ts`)은 옮기는 자리가 엇갈려도(업데이트 ID 와 runtime version 이 바뀌어도) 통과하고, OTA 를 켠 빌드의 값은 계정이 필요한 9단계 전에는 기기에서 볼 길이 없다. 변이 일곱(자리 엇갈림, 내장 번들 반대, 다시 켜기 대신 받기, 버전 기본값, `throwOnError` 거짓, 키, 가짜 호출)이 모두 이 둘에서 죽었다 — 틀리면 시험 파일 둘과 `platform/AGENTS.md` 의 한 문단을 지운다(코드는 그대로다).
23. 결정: `test/e2e/android.sh` 의 머리말 Edit 는 `build` 설명의 끝줄 "… e2e 변형인지 확인한다" 와 그 다음 `install` 줄에 맞추고 새 줄을 그 사이에 넣는다. 새 함수는 `assert_apk_variant` 의 끝(`echo "APK 의 앱 설정: …"` 과 `}`)에 붙인다 — D4 Task 5 가 머리말의 `build` 설명을 두 줄에서 세 줄로 바꾸고(빌드 앞에 Metro 캐시를 비운다) `assert_apk_variant` 뒤에 `clear_metro_cache` 를 더했으며 Gradle 을 `--no-daemon` 으로 부른다(`a47cd3b…` - `fe28615` 부터, D5 는 건드리지 않았다). 세 Edit 는 그 판에서 정확히 한 번 맞고 결과가 `bash -n` 을 지난다 - Task 5 전의 판(`1c8a9eb…`)에서도 맞는다 — 틀리면(그 글자가 바뀌면) "다시 볼 자리" 의 첫 줄대로 같은 뜻의 자리를 찾는다.
24. 결정: D5 가 적은 `useSubmitOnce` 의 쓰는 곳 목록 둘 - `queries/submit-once.ts` 머리말의 첫 문장("… 폼(자격증명·자원)·삭제 확인 시트·계약 실험실이 함께 쓴다.")과 `queries/AGENTS.md` 표의 `submit-once.ts` 행("폼 말고 삭제 확인 시트와 계약 실험실도 쓴다") - 에 빌드 정보 카드를 더한다(Task 3 Step 8 의 Edit 둘). 카드의 "업데이트 확인" 이 `useSubmitOnce(['updates', 'check'])` 를 지난다 — 쓰는 곳이 빠진 목록은 가드를 고치는 사람이 카드를 놓치게 한다(D5 가 같은 까닭으로 두 목록을 고쳤다 - `d36051e`) — 틀리면 문구 두 줄.

---

## 이 계획이 근거로 삼은 사실 (2026-10-01 확인)

추측이 아니라 그날 설치본·패키지 소스에서 직접 읽거나 스크래치에서 돌려 본 것이다.

**실제 D4·D5**(저장소는 `git show`·`git ls-tree`·`git archive` 로 읽기만 했다):
- `main` 은 D4 를 병합한 `fe28615` 다 - Task 5(E2E 플로 넷 `examples-create`·`examples-edit`·`examples-delete`·`examples-write-errors`, `subflows/login.yaml`, `test/e2e/android.sh` 의 머리말 세 줄·`clear_metro_cache`·`--no-daemon`, `run-android.sh`, 문서, D4 기록)와 마지막 물결(문서, 출처 기록의 이탈 하나 더 - `view.ts` 의 참조 목록 주석)까지 들었다. D5 는 그 위에서 실행됐고 최종 검토의 고침(`0516fc3`·`da4412d`·`f837754`·`4aeef06`·`9b28a82`·`7fde062` - 문서·주석·스펙 7.3·11.2 정정, `contract-lab-anonymous` 의 단계, 기록)까지 `main` 에 병합됐다(`a40590a`). D5 계획에 없던 것: 실행부 시험 일곱, `test/unit/scripts/contract-run.test.ts`(`run.sh` 의 불변식), `test/contract/AGENTS.md`·`lib/resources/AGENTS.md` 의 사각지대 문단, 출처 기록의 문장 하나, `app/(lab)/contract.tsx` 의 `headerRight`, 스펙 4장·8.6 정정, `queries/submit-once.ts` 머리말과 `queries/AGENTS.md` 표의 쓰는 곳 목록.
- 쓰기 훅의 규칙(`queries/AGENTS.md`): 쓰기의 기대한 실패는 값이고 던지는 것은 세션 거절뿐이다. 그 밖에 `mutationFn` 안에서 던져진 것은 결함이라 훅의 옵션이 `throwOnError` 를 줘 오류 경계로 보낸다 - "새 쓰기 훅도 같은 옵션을 준다". 시험은 훅이 쓰는 옵션을 내보내 `MutationObserver` 로 돌린다(`test/unit/queries/writes.test.ts`, D5 의 `lab.test.ts`). `platform/AGENTS.md` 의 마지막 절 `## 검증` 은 배선을 `vi.mock` 으로 재는 시험(`api.test.ts`·`query-client.test.ts`)을 적는다.
- D5 의 끝에서 홈(`5c5955d…`)의 실험실 진입은 `useNavigateOnce`(`components/app/navigate-once.ts`)를 지나는 버튼이고, `scripts/check.sh`(`72adea4…`)는 13단계에 `[12/13] 계약 거울` 이 있다. `test/e2e/android.sh` 는 D5 가 건드리지 않았다(`a47cd3b…`). 단위 시험 `1546 passed`(69 파일), 출처 기록 `경로 52개, 이탈 40건, 원본 그대로 32개`, 플로 20.

**expo-updates 57.0.24**(`expo install` 로 받은 설치본):
- npm 릴리스 2026-09-29 10:56 UTC - pnpm 11 의 `minimumReleaseAge`(1일) 창 밖이라 `minimumReleaseAgeExclude` 가 필요 없다. `expo install expo-updates` 는 `pnpm add expo-updates@~57.0.24` 를 부르고 `package.json` 한 줄과 락파일을 바꾼다.
- JS 상수(`build/Updates.js`): `isEnabled = !!ExpoUpdates.isEnabled`, `updateId` 는 문자열일 때만(소문자), `channel = ExpoUpdates.channel ?? null`, `runtimeVersion = ExpoUpdates.runtimeVersion ?? null`, `isEmbeddedLaunch`. `checkForUpdateAsync()` 의 결과는 `isAvailable`·`isRollBackToEmbedded`·`manifest`·`reason`, `fetchUpdateAsync()` 는 `isNew`·`isRollBackToEmbedded`·`manifest`. 끈 빌드와 개발 모드에서 세 호출은 거절한다.
- Android 의 끈 빌드(`DisabledUpdatesController` + `NoDatabaseLauncher`)는 `runtimeVersion`·`channel` 을 빈 문자열로, `updateId` 를 내지 않고(JS 에서 `null`), `isEmbeddedLaunch` 를 `false` 로 준다(`IUpdatesController.toModuleConstantsMap`).
- 설정 플러그인(`@expo/config-plugins` 의 `AndroidConfig.Updates`): `ENABLED` = `updates.enabled`(없으면 `updates.url` 이 있는가), `EXPO_UPDATES_CHECK_ON_LAUNCH`(`ON_LOAD` → `ALWAYS`), `EXPO_UPDATES_LAUNCH_WAIT_MS`(= `fallbackToCacheTimeout`, 기본 0), `EXPO_UPDATE_URL`·`UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY` 는 값이 있을 때만. fingerprint 정책이면 빌드 전 `strings.xml` 의 `expo_runtime_version`·iOS `EXUpdatesRuntimeVersion` 에 표식 `file:fingerprint` 를 두고 빌드할 때 지문으로 바꾼다.
- `@expo/prebuild-config` 의 `withVersionedExpoSDKPlugins` 가 `expo-updates` 플러그인을 스스로 붙인다 - 패키지가 없던 D3 의 e2e APK(`C:/t/e/…/app-release.apk`, 읽기만 했다)에도 `expo.modules.updates.ENABLED=false`·`EXPO_UPDATES_CHECK_ON_LAUNCH=ALWAYS`·`EXPO_UPDATES_LAUNCH_WAIT_MS=0` 이 있다.
- Gradle 플러그인(`expo-updates-gradle-plugin`)은 변형마다 `create<변형>UpdatesResources` 를 등록한다. release 는 `createUpdatesResources.js … all` - Metro 서버를 띄워 내장 매니페스트(`app.manifest`)를 만들고(`createManifestForBuildAsync`, `resetCache: false`), runtime version 이 fingerprint 정책일 때만 지문을 계산한다. 그 과정에서 `app.config.ts` 를 다시 평가한다(`getConfig`).

**EAS**(eas-cli 24.8.0 · `@expo/eas-json` 24.8.0 · `@expo/build-tools` 24.8.0 - npm 에서 받아 읽었다, 계정 없이):
- `eas.json` 스키마(`@expo/eas-json` 의 Joi): 빌드 프로필은 `node`·`pnpm`(유효한 semver), `env`, `channel`(`^[a-z\d][a-z\d._-]*$`), `distribution`(`store`·`internal`), `developmentClient`, `autoIncrement`, `environment`, `withoutCredentials`, `android.buildType`(`apk`·`app-bundle`), `ios.simulator`, `extends` 를 받는다. `cli` 는 `version`·`appVersionSource` 를 받는다. 제출 android 는 `track`(기본 `internal`)·`releaseStatus`(`draft` 등). 이 계획의 `eas.json` 을 그 해석기로 읽으면 프로필 넷 × 플랫폼 둘과 제출이 경고 없이 해석된다(실측 O2 에서 다시 잰다).
- EAS 빌드는 `updates.url` 이 `u.expo.dev` 이고 프로필에 `channel` 이 있으면 `expo-channel-name` 머리글을 AndroidManifest.xml·Expo.plist 에 쓴다(`setChannelNativelyAsync`). 로컬(eas-cli)이 계산한 runtime version 과 서버가 계산한 값이 다르면 빌드를 멈춘다. 서버는 `EAS_BUILD_PROJECT_ID` 를 주고 `extra.eas.projectId` 가 그와 다르면 멈춘다.
- eas-cli 는 `extra.eas.projectId` 로 프로젝트를 찾고(`getProjectIdAsync`), `developmentClient` 프로필을 빌드할 때 expo-dev-client 가 없으면 설치를 묻는다(비대화형이면 "Install expo-dev-client manually" 로 멈춘다). `eas update` 는 `updates.url` 이 그 프로젝트의 주소이고 runtime version 이 있어야 발행한다(동적 설정이면 고칠 값을 알리고 멈춘다 - `ensureEASUpdateIsConfiguredAsync`).
- expo-dev-client 57.0.19 의 설정 플러그인(자동으로 붙는 legacy 플러그인 목록에 있다)은 `addGeneratedScheme: true` 가 기본이라 `exp+<slug>` scheme 을 Android·iOS 네이티브 설정에 더한다. release 빌드의 dev launcher 는 `src/disableInRelease` 의 빈 구현이다.

**`@expo/fingerprint` 0.20.13**: 기본 `sourceSkips` 가 `PackageJsonAndroidAndIosScriptsIfNotContainRun` 하나라 공개 설정 전체(`extra` 포함)가 해시에 든다(`sourcer/Expo.js` 의 `normalizeExpoConfig` 는 `_internal` 만 늘 지운다). 스크래치에서 잰 값: 같은 설정 → 같은 값, `BACKEND_URL`·변형·프로젝트 id 가 다르면 다른 값, `APP_VARIANT` 없이(development) → `null`, JS 파일 하나에 주석을 더함 → 같은 값.

**Expo CLI 57**: `expo config` 는 `.env` 를 읽는다 - `.env` 에 `EAS_PROJECT_ID` 를 두고 변수를 지운 채 preview 를 평가하면 OTA 가 켜지고, 같은 명령에 `EAS_PROJECT_ID=` 를 주면 꺼진다. `expo config --type introspect --json` 은 설정 플러그인을 빌드 없이 돌려 `_internal.modResults` 에 `android.manifest`(xml2js 모양)·`android.strings`·`ios.infoPlist`·`ios.expoPlist` 를 낸다 - 한 번에 1초 안팎이다. iOS URL scheme 에는 변형의 scheme 과 번들 ID 가 함께 든다. Android 인텐트 필터의 scheme 은 변형의 것 하나다.

**Node 24.19.0**: `.mjs` 에서 `.ts` 를 import 하면 type stripping 으로 돌지만 package.json 에 `type` 이 없어 `MODULE_TYPELESS_PACKAGE_JSON` 경고를 stderr 에 한 번 낸다 - `--disable-warning=MODULE_TYPELESS_PACKAGE_JSON` 으로 꺼진다. 표준 입력이 닫힌 채(`< /dev/null`) 모듈 최상위에서 `process.exit(1)` 을 부르면 이 머신에서 libuv 단언(`!(handle->flags & UV_HANDLE_CLOSING)`)으로 죽어 종료 코드가 127 이었다 - `process.exitCode` 로 끝낸다.

**Android SDK build-tools 36.0.0 의 `aapt2 dump xmltree --file AndroidManifest.xml <apk>`**: 메타데이터는 `E: meta-data` 줄 뒤에 `A: http://schemas.android.com/apk/res/android:name(0x01010003)="…" (Raw: "…")` 와 `…:value(0x01010024)=false`(불리언·숫자는 따옴표 없이, 문자열은 따옴표) 줄이 온다. `application` 의 `usesCleartextTraffic(0x010104ec)=true`.

## 미리 돌려 본 것

스크래치 사본에서 돌렸다 — 저장소에는 쓰지 않았다(저장소는 `git show`·`git ls-tree`·`git archive`·`git hash-object` 로 읽기만 했다).

**바탕.** D4·D5 를 병합한 `main` 의 `a40590a` 를 `git archive` 로 꺼내 스크래치 git 에 커밋했다(트리 해시 `4fddd1c` - 저장소의 커밋과 같다). `package.json`·`pnpm-lock.yaml` 이 D5 계획을 흉내 낸 앞 바탕과 같아 그때 `pnpm install --frozen-lockfile` 로 받은 `node_modules` 를 썼다. 단위 시험 `1546 passed`(69 파일), 출처 기록 `경로 52개, 이탈 40건, 원본 그대로 32개`, 플로 20.

**이 계획을 그 위에서 글자 그대로.** 이 문서를 D4 작가의 도구(계획의 Edit·파일 쓰기·끼울 자리·덧붙이기·"고친 뒤의 파일" 대조를 적용하고, 찾을 것이 정확히 한 번 맞지 않으면 실패한다)로 태스크 순서대로 적용했다 - 연산 59(Task 1 스물, Task 2 아홉, Task 3 스물둘, Task 4 여덟 - Edit 27·끼울 자리 9·파일 쓰기 18·덧붙이기 4·대조 1)가 정확히 한 번씩 맞았고 `expo install` 은 그 자리에서 돌렸다. 태스크마다 `pnpm format` 뒤 typecheck·lint·format:check·인용이 exit 0 이었고 출처 기록은 바탕 그대로였다. 마지막 글자로 다시 적용한 트리가 검사를 돈 트리와 해시까지 같다.

- Task 1: `expo-updates ~57.0.24`. 빨강 `Test Files  4 failed | 2 passed (6)`·`Tests  12 failed | 46 passed (58)`(`Cannot find package '@/lib/config/updates'`), 초록 `Tests  103 passed (103)`, 끝 `71 passed`·`1602 passed`. Step 6 의 여덟 줄이 Expected 와 글자까지 같았다.
- Task 2: 빨강 `Tests  22 failed (22)`, 초록 22, `bash -n`, 13단계 그대로(`[8/13] 설정`). Step 6 (a) 의 열일곱 줄(exit 0), (b) `.env` 를 둔 실행의 `8`·`.env 없음`, (c) 변이의 `app.config.ts | 2 +-`·exit 1·두 줄이 Expected 와 같았다. 끝 `72`·`1624`.
- Task 3: 빨강 `Cannot find package '@/lib/updates/build-info'` → 초록 16, 빨강 `Test Files  2 failed (2)`(`@/platform/updates`·`@/queries/updates`) → 초록 `Tests  7 passed (7)`, "고친 뒤의 파일" 대조, `types:routes`, 끝 `75`·`1647`. 변이 일곱이 배선·옵션 시험에서 모두 죽었다(결정 22). `expo export --clear` 두 플랫폼 `Android Bundled … (2076 modules)`·`iOS Bundled … (1985 modules)`(`Unable to resolve`·`Error` 0, 따로 둔 TMP 로 - 앱 코드가 주석만 다른 `976b9f8` 위에서는 2078·1980), secretlint.
- Task 4: `bash -n test/e2e/android.sh`, 떼어 낸 함수의 끝 두 줄이 Expected 와 같다, 플로 21, 끝 `75`·`1647`. 새 함수는 `assert_apk_variant` 와 `clear_metro_cache` 사이, 새 절은 `## 계약 실험실 플로` 와 `## 돌리기` 사이, 실측 기록 문장은 D5 의 문장 뒤에 들어갔다.
- D8 계획이 기대는 이 계획의 끝 모양(결정 3)이 결과 트리에 그 글자대로 있다.
- 앞서 D5 브랜치의 `976b9f8`(트리 `cdc71c7`)·`c99db78`(`ce7ea48`)에서도 연산 59 가 모두 정확히 한 번 맞았고, `976b9f8` 에서는 검사 전부가 이 바탕과 같은 수로 통과했다.
- 앞서 흉내 바탕 둘 - `3627679` 에 D5 계획을 얹은 트리와, 그것을 D4 Task 5 의 작업 트리와 병합한 트리 - 에서도 이 계획의 연산(그때는 쓰는 곳 목록의 Edit 둘이 없어 57)이 모두 맞았고 검사가 통과했다. `expo-doctor` `21/21 checks passed` 는 같은 의존성의 앞 바탕에서 쟀다.
- 실측 O1(13초)·O2(11줄)와 APK 단언 함수를 D3 의 기존 e2e APK 에 떼어 돌린 것(읽기만 - 앱 설정 쪽은 expo-updates 전의 APK 라 `APK 의 앱 설정이 OTA 를 끄지 않았다 (updates=undefined runtimeVersion=undefined)` 로 빨갛고, 기대값을 그 APK 의 것으로 바꾸면 매니페스트 쪽이 `ENABLED=false URL=- HEADERS=- usesCleartextTraffic=true` 로 통과했다)은 D3–D5 계획을 흉내 낸 첫 바탕에서 쟀다 - 이 계획의 설정 파일·`eas.json`·단언 함수는 그때와 같은 글자이고 값의 관계는 바탕에 기대지 않는다.

**돌리지 않은 것:** Docker·에뮬레이터·`maestro test`·`maestro check-syntax`·APK 빌드·게이트 [9]([9] 의 expo-doctor 만 따로)·[11]–[13]. APK 의 새 단언과 카드 플로는 Task 4 가 처음 기기에서 잰다.

---

## D3·D4·D5 가 넘겨야 하는 것 (이 계획의 전제)

Task 1 Step 1 이 확인한다. 하나라도 없으면 멈추고 컨트롤러에 알린다. D4·D5 가 실행 중이나 병합 때 이름이나 글자를 바꿨으면 이 계획의 Edit 블록은 같은 뜻의 자리를 찾아 고친다(결정 21, 다음 절).

| 산출 | 이 계획이 쓰는 모양 |
| --- | --- |
| `app.config.ts`(D2 뒤로 그대로) | blob `0515df1c034cb7b37c15b7af12e3712c543b87c4` - Task 1 이 전체를 바꾼다 |
| `lib/config/app-variant.ts`(D1 뒤로 그대로) | blob `e75b80671d2e0ded6cccee2f20f56b87aa6fc528` - `VariantProfile` 의 끝 칸 `logsHttpFailures`, `PROFILES` 넷 |
| `test/unit/config/app-variant.test.ts`·`app-config.test.ts`(D1·D2) | blob `623e4dc…`·`bcf6aec…` - `evaluate(env)` 가 `BACKEND_URL`·`APP_VARIANT` 를 stub 한다 |
| `.env.example`(D1) | blob `d524e89…` - 끝 줄 `APP_VARIANT=development` |
| `lib/config/AGENTS.md`(D5 가 고친다) | 둘째 문단의 끝 "디렉터리가 아니라 거기 있다." |
| `scripts/check.sh`(D5) | blob `72adea4fb2cb67f5f99a171042df55ee8deb593a` - 13단계, `GATE_BACKEND_URL='https://gate-check.invalid'` 한 줄, `echo "=== [8/13] 설정 ==="` 와 그 아래의 `for variant in development preview production e2e; do` … `done` 네 줄(`--type public --json >/dev/null`), `[12/13] 계약 거울`, 마지막이 `[13/13] E2E` |
| 홈 `app/(app)/index.tsx`(D5) | blob `5c5955d782c7fe37dc018015aa1aff04ca8f018d` - `import { View } from 'react-native'`, 뿌리 `View testID="home-screen"`, `home-examples-link`(`Link`), `home-lab-link`(`navigateOnce(() => router.push('/contract'))` 를 부르는 outline `Button`), 본문 첫 줄 `const navigateOnce = useNavigateOnce()` |
| `queries/submit-once.ts`(D4·D5) | `useSubmitOnce(mutationKey: MutationKey): (submit: () => void) => void`, 머리말 첫 문장의 끝 "폼(자격증명·자원)·삭제 확인 시트·계약 실험실이 함께 쓴다." |
| 쓰기 훅·배선의 규칙(D4) | `queries/AGENTS.md` 의 쓰기 오류 문단(옵션을 내보내고 `throwOnError`, 시험은 `MutationObserver`), 표의 `writes.ts` 행과 `submit-once.ts` 행의 "폼 말고 삭제 확인 시트와 계약 실험실도 쓴다". `platform/AGENTS.md` 의 마지막 절 `## 검증`(배선은 `vi.mock`), 표의 `theme.ts` 행. `test/unit/platform/`·`test/unit/queries/` 가 있다 |
| `components/form/submit-button.tsx`(D2) | `SubmitButton({ testID, label, pending, onPress })` - 도는 동안 `ActivityIndicator` 만 |
| `platform/config.ts`(D2·D3) | `startupVariant(): AppVariant` |
| `test/e2e/android.sh`(D2·D3·D4 Task 5) | blob `a47cd3b8cce8a2163a23020c92405359a86e3dcb`(`fe28615` 부터, D5 그대로) - 머리말 `build` 설명의 끝줄 "… e2e 변형인지 확인한다" 와 그 다음 `#   test/e2e/android.sh install     만든 APK 를 설치한다`, `assert_apk_variant()` 끝의 `echo "APK 의 앱 설정: extra.appVariant=$variant"` 와 `}`(그 뒤가 `clear_metro_cache()`), `build()` 의 `assert_apk_variant` 다음 `ls -l "$APK"` 가 한 번씩(결정 23) |
| E2E 하네스(D2–D5) | `test/e2e/run-android.sh`(플로 전부를 이름 순으로, 빌드 입력의 지문에 `test/e2e/android.sh` 가 든다), `subflows/start-signed-out.yaml`(`clearState` 로 띄워 `home-screen` 을 기다린다), 플로 20(D2 일곱·D3 일곱·D4 넷·D5 둘) |
| 문서의 자리 | 루트 `AGENTS.md`(표의 `platform/` 행, 표 아래 위반 목록 앞의 "위반의 정의:" 줄, "번들 단계는 `expo export --clear`라서", "(`scripts/check-provenance.mjs`는 `node`가\n부르므로 `100644`가 맞다)" 두 줄, `## 검증 명령` 의 "실측 기록은" 문단), `lib/config/AGENTS.md`(위 줄과 Task 1 이 더한 "`test/unit/config/eas-json.test.ts`가 맞댄다."), `platform/AGENTS.md`·`queries/AGENTS.md`(위 행과 절), `test/e2e/AGENTS.md`(`## 돌리기` 제목) |
| 스펙 | 제목 `## 5. 계층 소유권`·`### 10.2 변형`·`### 10.6 OTA 업데이트`·`### 10.7 계정이 필요한 실증은 따로 둔다`·`### 11.4 E2E 스택`·`## 13. CI (GitHub Actions)`·`## 17. 완료 조건` 이 한 번씩 |
| 기준 수 | `main` 의 `a40590a`(D5 병합) - 단위 시험 1546(69 파일), 출처 기록 경로 52·이탈 40·원본 그대로 32, 플로 20. 이 계획 뒤에 `main` 에 커밋이 더해져 수가 다르면 Task 1 Step 1 이 센 수에서 센다(이 계획은 시험 +101·파일 +6, 출처 기록 그대로, 플로 +1) |

D3 가 더한 `lib/navigation/deep-link.ts`·`app/+native-intent.tsx`·`platform/config.ts` 의 `appSchemes()`·`components/app/sheet.tsx` 의 자판 올림, D4 의 쓰기 화면·`components/app/navigate-once.ts`·`back-to-home.ts`, D5 의 실험실(`app/(lab)/contract.tsx` 의 홈 버튼 포함)을 이 계획은 건드리지 않는다. 기댄 것은 `platform/config.ts` 의 `startupVariant()`, `queries/submit-once.ts` 의 `useSubmitOnce`(과 D5 가 적은 쓰는 곳 목록), D5 홈의 모양, D4 의 쓰기 훅 규칙이다. 문서의 표는 앞 계획들이 더한 행을 그대로 두고 다른 행 앞에 끼운다.

## 바탕이 바뀌었을 때 다시 볼 자리

이 계획의 바탕은 D4·D5 를 병합한 `main` 의 `a40590a` 다. Task 1 Step 1 의 blob·수가 이 바탕과 다르면(이 계획 뒤에 `main` 에 커밋이 더해졌다) 아래 자리를 보고, 다르면 같은 뜻으로 맞춘 자리를 태스크 보고에 적는다. 앞서 맞췄던 바탕 넷(`3627679` 위의 D5 계획, 그것과 D4 Task 5 작업 트리의 병합, D5 의 `976b9f8`·`c99db78`)에서도 연산이 모두 맞았으므로 여기의 자리는 D4·D5 의 글자가 바뀌는 동안에도 버틴 곳이다.

| 자리 | 이 계획의 연산 | 볼 것 |
| --- | --- | --- |
| `test/e2e/android.sh` | Task 4 Step 1 의 Edit 셋 | 머리말의 새 줄이 `build` 설명 끝에, `assert_apk_ota_off()` 가 `assert_apk_variant()` 와 `clear_metro_cache()` 사이에, 호출이 `build()` 의 `assert_apk_variant` 바로 뒤에 있다. `bash -n`, Step 1 의 떼어 낸 함수 끝 두 줄 |
| 루트 `AGENTS.md` | Task 1 Step 9 의 "실측 기록은" 문단 끝 한 문장, Task 2 Step 7 의 Edit 둘("번들 단계는 …", "(`scripts/check-provenance.mjs`는 …)"), Task 3 Step 8 의 Edit 둘(`platform/` 행 앞, "위반의 정의:" 앞) | 다섯 자리가 한 번씩. 실측 기록 문단의 끝이 D5 의 문장(C1–C3)이고 D6 문장은 그 뒤다 |
| `test/e2e/AGENTS.md` | Task 4 Step 3 의 `## 돌리기` 앞 절 | `## 돌리기` 가 하나, 새 절 `## 빌드 정보 플로` 가 그 바로 앞(`## 계약 실험실 플로` 뒤) |
| `platform/AGENTS.md`·`queries/AGENTS.md`·`queries/submit-once.ts` | Task 3 Step 8 의 표 행 둘(`theme.ts`·`writes.ts` 앞), `platform/AGENTS.md` 끝의 한 문단, 쓰는 곳 목록의 Edit 둘(결정 24) | 두 행과 두 목록 문구가 한 번씩, `## 검증` 이 `platform/AGENTS.md` 의 마지막 절이다. 쓰기 오류 규칙이 바뀌었으면(예: 술어가 달라졌으면) `queries/updates.ts` 의 `throwOnError` 와 그 시험을 같은 규칙으로 맞춘다(결정 14). 목록 문구가 바뀌었으면 바뀐 목록에 카드를 더한다 |
| 홈 `app/(app)/index.tsx` | Task 3 Step 5 의 Edit 다섯과 "고친 뒤의 파일" | blob 이 `5c5955d…` 가 아니면 같은 뜻으로 맞춘다 - 두 진입의 testID 와 `navigateOnce` 는 그대로, 뿌리만 `ScrollView` 와 카드 |
| `scripts/check.sh` | Task 2 Step 5 의 `GATE_EAS_PROJECT_ID` 줄과 [8] 블록 | blob 이 `72adea4…` 가 아니면 `GATE_BACKEND_URL=` 줄과 [8] 블록(`for variant …` 네 줄)을 찾고 13단계 번호를 본다 |
| 스펙 | 정정 블록 일곱을 제목 앞에 끼운다 | 제목이 한 번씩 - 끼운 블록은 같은 절의 앞 정정들(D4·D5 의 것) 뒤에 온다 |
| 수 | Task 1 Step 1·각 태스크와 Task 4 의 Expected | 단위 시험·출처 기록·플로는 Task 1 Step 1 이 센 값에서 센다 - 이 계획은 시험 +101(파일 +6)·플로 +1, 출처 그대로 |

## D1·D5 에서 이어받은 것

| 항목(출처) | 맡은 곳 |
| --- | --- |
| `eas.json` 에서 EAS 빌드의 Node 를 22.18 이상으로 고정한다 - `app.config.ts` 가 type stripping 으로 `lib/config` 를 불러온다(D1 운반 기록 D6 절, D1 실측 M7) | Task 1 - 네 프로필 모두 `24.19.0`(결정 9), `test/unit/config/eas-json.test.ts` 가 22.18 과 `engines.node` 를 잰다 |
| 홈에 빌드 정보 카드를 더하되 홈의 `testID`(`home-examples-link`·`home-lab-link`)를 지킨다(D5 다음 계획) | Task 3(결정 17) |
| 스펙 16장 "설정 오류가 OTA로 배포된다" 의 대응(설정 평가 시점의 검증, 앱 시작 시 재검증, `fingerprint`) | 평가 시점 - Task 1 의 `EAS_PROJECT_ID` 검증과 Task 2 의 게이트 [8], `fingerprint` - Task 1 의 정책과 실측 O1(결정 19). 시작 재검증은 D2 의 `lib/config/startup.ts` 그대로다(fingerprint 가 설정이 다른 발행을 막으므로 두 번째 방어선이다) |

## 태스크 지도

| 태스크 | 산출 | 시험 | 기기 |
| --- | --- | --- | --- |
| 1 변형별 OTA 설정 | `expo-updates`, `lib/config/updates.ts`, 변형 표의 `updatesChannel`, `app.config.ts`, `eas.json`, `.env.example`, 실측 O1·O2, 문서, 스펙 10.1·10.5·10.6 정정 | 설정 시험 +56(`updates` 18·`eas-json` 27·`app-config` 7→17·`app-variant` 15→16) | 없음 |
| 2 게이트 [8] 의 변형별 설정 검사 | `scripts/check-variant-config.mjs`, `scripts/check.sh` 의 [8], 실측 O3, 문서, 스펙 12 정정 | 검사기 22 + 변이 둘 | 없음 |
| 3 빌드 정보 카드 | `lib/updates/build-info.ts`, `platform/updates.ts`, `queries/updates.ts`, `components/app/build-info-card.tsx`, 홈, 문서, 스펙 4장·10.6 정정 | 판단 16 + 배선 4 + 쓰기 옵션 3, 두 플랫폼 번들 | 없음 |
| 4 기기 | `test/e2e/android.sh` 의 APK 단언, 플로 `home-build-info`, 게이트 13단계 한 번, 실측 O4, 문서, 스펙 11.3·16 정정 | 기기 E2E 21 플로 | **여기서만** |

## File Structure

```text
package.json · pnpm-lock.yaml              (expo install) expo-updates ~57.0.24                                   — Task 1
lib/config/app-variant.ts                  (수정) 변형 표에 OTA 채널 칸 updatesChannel                           — Task 1
lib/config/updates.ts                      (신규) EAS 프로젝트 id, 변형별 updates, fingerprint 정책               — Task 1
app.config.ts                              (다시 씀) updates·runtimeVersion·extra.eas                            — Task 1
eas.json                                   (신규) 변형 넷의 빌드 프로필, 제출                                     — Task 1
.env.example                               (수정) EAS_PROJECT_ID                                                  — Task 1
test/unit/config/updates.test.ts · eas-json.test.ts (신규)                                                          — Task 1
test/unit/config/app-variant.test.ts · app-config.test.ts (수정)                                                    — Task 1
scripts/check-variant-config.mjs           (신규, 100644) introspect 결과를 변형 표와 맞댄다                      — Task 2
test/unit/scripts/check-variant-config.test.ts (신규)                                                               — Task 2
scripts/check.sh                           (수정) [8] - 변형 넷 × 프로젝트 유무, 검사기                            — Task 2
lib/updates/build-info.ts                  (신규) 카드의 행, 업데이트 확인의 순서와 문구                         — Task 3
test/unit/updates/build-info.test.ts       (신규)                                                                  — Task 3
platform/updates.ts                        (신규) expo-updates·expo-constants 읽기와 세 호출                     — Task 3
test/unit/platform/updates.test.ts         (신규) 배선 - vi.mock                                                   — Task 3
queries/updates.ts                         (신규) useBuildInfoCard, updateCheckMutationOptions                     — Task 3
test/unit/queries/updates.test.ts          (신규) 쓰기 옵션 - MutationObserver                                     — Task 3
queries/submit-once.ts                     (수정) 머리말의 쓰는 곳 목록에 카드                                      — Task 3
components/app/build-info-card.tsx         (신규) 빌드 정보 카드                                                    — Task 3
app/(app)/index.tsx                        (수정) ScrollView 와 카드                                               — Task 3
test/e2e/android.sh                        (수정) assert_apk_ota_off                                               — Task 4
test/e2e/flows/home-build-info.yaml        (신규)                                                                  — Task 4
docs/superpowers/notes/2026-10-01-d6-measurements.md (신규) O1·O2(Task 1), O3(Task 2), O4(Task 4)
AGENTS.md · lib/config/AGENTS.md · platform/AGENTS.md · queries/AGENTS.md · test/e2e/AGENTS.md (수정)
docs/superpowers/specs/2026-09-30-expo-jsonapi-template-design.md (정정) 10.1·10.5·10.6(Task 1), 12(Task 2), 4·10.6(Task 3), 11.3·16(Task 4)
```

---

### Task 1: 변형별 OTA 설정 — expo-updates, `lib/config/updates.ts`, `app.config.ts`, `eas.json`, 실측 O1·O2

**Files:**
- Create: `lib/config/updates.ts`, `eas.json`, `test/unit/config/updates.test.ts`, `test/unit/config/eas-json.test.ts`, `docs/superpowers/notes/2026-10-01-d6-measurements.md`
- Modify: `package.json`·`pnpm-lock.yaml`(`expo install`), `lib/config/app-variant.ts`, `app.config.ts`(전체), `.env.example`, `test/unit/config/app-variant.test.ts`, `test/unit/config/app-config.test.ts`, `lib/config/AGENTS.md`, `AGENTS.md`, 스펙(10.1·10.5·10.6 정정)
- 임시(git 이 무시한다, 커밋하지 않는다): `.maestro-output/d6-runtime-versions.sh`, `.maestro-output/d6-eas-json.cjs`

**Interfaces:**
- Consumes: `parseAppVariant`·`variantProfile`·`assertBackendUrlAllowed`·`AppVariant`·`APP_VARIANTS`(`lib/config/app-variant.ts`), `loadSettings`(`lib/config/settings.ts`).
- Produces: `VariantProfile.updatesChannel: string | null`(development·e2e `null`, preview `'preview'`, production `'production'`). `lib/config/updates.ts` - `EAS_UPDATE_ORIGIN = 'https://u.expo.dev'`, `RUNTIME_VERSION_POLICY = { policy: 'fingerprint' } as const`, `easProjectId(env: Readonly<Record<string, string | undefined>>): string | null`, `type UpdatesConfig = { readonly enabled: false } | { readonly enabled: true; readonly url: string; readonly checkAutomatically: 'ON_LOAD'; readonly fallbackToCacheTimeout: 0; readonly requestHeaders: { readonly 'expo-channel-name': string } }`, `updatesConfig(variant: AppVariant, projectId: string | null): UpdatesConfig`. `app.config.ts` 는 `BASE_APP_ID`·`BASE_SCHEME`·`BASE_NAME` 을 그대로 내보낸다(Task 2 의 검사기가 불러온다). `eas.json` 의 빌드 프로필 `development`·`preview`·`production`·`e2e`.

- [ ] **Step 1: 전제를 확인한다**

```bash
git branch --show-current
git status --short
git hash-object app.config.ts lib/config/app-variant.ts test/unit/config/app-variant.test.ts test/unit/config/app-config.test.ts .env.example 'app/(app)/index.tsx' test/e2e/android.sh
grep -c '^echo "=== \[8/13\] 설정 ===' scripts/check.sh
grep -c "^GATE_BACKEND_URL='https://gate-check.invalid'$" scripts/check.sh
grep -c 'export function useSubmitOnce' queries/submit-once.ts
grep -c 'export function startupVariant' platform/config.ts
ls test/e2e/flows | wc -l
node scripts/check-provenance.mjs | tail -n 1
timeout 600 pnpm test 2>&1 | grep -E "Test Files|Tests "
```

Expected: `feat/d6-eas-and-ota`, 바뀐 파일 없음, blob 일곱이 차례로 `0515df1c034cb7b37c15b7af12e3712c543b87c4`·`e75b80671d2e0ded6cccee2f20f56b87aa6fc528`·`623e4dc4a6e2e30ad21788bc683a6a7df1ed9dd5`·`bcf6aec71a3951a748aa3c15e3905bfc558c22a8`·`d524e89d350b22e3390967df5c4cc5f3d8b15e34`·`5c5955d782c7fe37dc018015aa1aff04ca8f018d`(D5 의 홈)·`a47cd3b8cce8a2163a23020c92405359a86e3dcb`(D4 Task 5 의 `android.sh` - 머리말 세 줄·`clear_metro_cache`·`--no-daemon`), `grep -c` 넷은 `1`, 플로 `20`(D2 일곱·D3 일곱·D4 넷·D5 둘), `복사 출처 기록 통과: 경로 52개, 이탈 40건, 원본 그대로 32개`, `Test Files  69 passed (69)`·`Tests  1546 passed (1546)`(D4·D5 를 병합한 `main` 의 `a40590a` 의 수). 앞의 다섯 blob(설정 파일과 그 시험)이 다르거나 `grep -c` 가운데 하나라도 `1` 이 아니면 멈추고 컨트롤러에 알린다 - 이 계획이 전체를 바꾸거나 글자로 맞추는 자리다. 홈·`android.sh` 의 blob 이나 수가 다르면(이 계획 뒤에 `main` 에 커밋이 더해졌다) 그 값을 적어 두고 진행한다 - 이 계획의 Edit 는 같은 뜻의 자리를 찾아 고친다(결정 21, "바탕이 바뀌었을 때 다시 볼 자리" 절), 수는 그 값에서 센다.

- [ ] **Step 2: expo-updates 를 받는다**

```bash
BACKEND_URL=https://gate-check.invalid timeout 300 pnpm exec expo install expo-updates
grep '"expo-updates"' package.json
node -p "require('expo-updates/package.json').version"
timeout 300 pnpm install --frozen-lockfile
BACKEND_URL=https://gate-check.invalid timeout 300 pnpm exec expo-doctor
```

Expected: `› Installing 1 SDK 57.0.0 compatible native module using pnpm` 와 `+ expo-updates ~57.0.24`, `"expo-updates": "~57.0.24",`, `57.0.24`, 설치가 락파일 그대로 끝난다, `21/21 checks passed. No issues detected!`(expo-doctor 는 네트워크가 필요하다). `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` 이면 멈추고 컨트롤러에 알린다 - 57.0.24 는 2026-09-29 10:56 UTC 릴리스라 걸리지 않아야 한다.

- [ ] **Step 3: 실패하는 시험을 쓴다**

`test/unit/config/app-variant.test.ts` — Edit, 찾을 것:

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
```

바꿀 것:

```ts
    expect(variantProfile('development')).toEqual({
      idSuffix: '.dev',
      schemeSuffix: '-dev',
      nameSuffix: ' (Dev)',
      allowCleartext: true,
      logsHttpFailures: false,
      updatesChannel: null,
    })
    expect(variantProfile('preview')).toEqual({
      idSuffix: '.preview',
      schemeSuffix: '-preview',
      nameSuffix: ' (Preview)',
      allowCleartext: false,
      logsHttpFailures: false,
      updatesChannel: 'preview',
    })
    expect(variantProfile('production')).toEqual({
      idSuffix: '',
      schemeSuffix: '',
      nameSuffix: '',
      allowCleartext: false,
      logsHttpFailures: false,
      updatesChannel: 'production',
    })
    expect(variantProfile('e2e')).toEqual({
      idSuffix: '.e2e',
      schemeSuffix: '-e2e',
      nameSuffix: ' (E2E)',
      allowCleartext: true,
      logsHttpFailures: true,
      updatesChannel: null,
    })
```

같은 파일에 Edit, 찾을 것:

```ts
  it('접미사가 서로 겹치지 않는다 - 한 기기에 함께 설치할 수 있어야 한다', () => {
```

바꿀 것:

```ts
  it('OTA 채널은 배포 변형(preview·production)에만 있고 변형 이름과 같다 - 스펙 10.2·10.6', () => {
    expect(
      APP_VARIANTS.map((variant) => [variant, variantProfile(variant).updatesChannel]),
    ).toEqual([
      ['development', null],
      ['preview', 'preview'],
      ['production', 'production'],
      ['e2e', null],
    ])
  })

  it('접미사가 서로 겹치지 않는다 - 한 기기에 함께 설치할 수 있어야 한다', () => {
```

`test/unit/config/app-config.test.ts` — Edit, 찾을 것:

```ts
function evaluate(env: Record<string, string>): ExpoConfig {
  vi.stubEnv('BACKEND_URL', env.BACKEND_URL ?? '')
  vi.stubEnv('APP_VARIANT', env.APP_VARIANT ?? '')
  return appConfig(CONTEXT)
}
```

바꿀 것:

```ts
// 실제 EAS 프로젝트 id 가 아니다 - 모양만 UUID 인 표본이다.
const PROBE_PROJECT_ID = '0f6b3c1e-2a4d-4e8f-9b1a-7c5d3e2f1a0b'

// 주지 않은 변수는 빈 값으로 못박는다 - 개발자의 셸에 있는 EAS_PROJECT_ID 가 시험에 섞이지 않는다.
function evaluate(env: Record<string, string>): ExpoConfig {
  vi.stubEnv('BACKEND_URL', env.BACKEND_URL ?? '')
  vi.stubEnv('APP_VARIANT', env.APP_VARIANT ?? '')
  vi.stubEnv('EAS_PROJECT_ID', env.EAS_PROJECT_ID ?? '')
  vi.stubEnv('EAS_BUILD_PROJECT_ID', env.EAS_BUILD_PROJECT_ID ?? '')
  return appConfig(CONTEXT)
}
```

같은 파일에 Edit(파일 끝의 마지막 시험 뒤에 describe 하나), 찾을 것:

```ts
    expect(entry).toEqual([
      'expo-secure-store',
      { configureAndroidBackup: true, faceIDPermission: false },
    ])
  })
})
```

바꿀 것:

```ts
    expect(entry).toEqual([
      'expo-secure-store',
      { configureAndroidBackup: true, faceIDPermission: false },
    ])
  })
})

describe('app.config.ts 의 OTA - 스펙 10.1·10.6', () => {
  const HTTPS = 'https://probe-backend.example'

  it.each(['development', 'preview', 'production', 'e2e'])(
    'EAS 프로젝트가 없으면 %s 변형은 OTA 를 끄고 runtime version 도 프로젝트 id 도 싣지 않는다',
    (variant) => {
      const config = evaluate({ BACKEND_URL: HTTPS, APP_VARIANT: variant })
      expect(config.updates).toEqual({ enabled: false })
      expect(config.runtimeVersion).toBeUndefined()
      expect(config.extra?.eas).toBeUndefined()
    },
  )

  it.each(['preview', 'production'])(
    '%s 변형은 EAS 프로젝트가 있으면 OTA 를 켜고 runtime version 을 fingerprint 정책으로 둔다',
    (variant) => {
      const config = evaluate({
        BACKEND_URL: HTTPS,
        APP_VARIANT: variant,
        EAS_PROJECT_ID: PROBE_PROJECT_ID,
      })
      expect(config.updates).toEqual({
        enabled: true,
        url: `https://u.expo.dev/${PROBE_PROJECT_ID}`,
        checkAutomatically: 'ON_LOAD',
        fallbackToCacheTimeout: 0,
        requestHeaders: { 'expo-channel-name': variant },
      })
      expect(config.runtimeVersion).toEqual({ policy: 'fingerprint' })
      expect(config.extra?.eas).toEqual({ projectId: PROBE_PROJECT_ID })
    },
  )

  it.each(['development', 'e2e'])(
    '%s 변형은 EAS 프로젝트가 있어도 OTA 를 끈다 - 프로젝트 id 는 싣는다(EAS 빌드가 찾는다)',
    (variant) => {
      const config = evaluate({
        BACKEND_URL: HTTPS,
        APP_VARIANT: variant,
        EAS_PROJECT_ID: PROBE_PROJECT_ID,
      })
      expect(config.updates).toEqual({ enabled: false })
      expect(config.runtimeVersion).toBeUndefined()
      expect(config.extra?.eas).toEqual({ projectId: PROBE_PROJECT_ID })
    },
  )

  it('EAS 빌드 서버의 EAS_BUILD_PROJECT_ID 로도 켠다 - 로컬 eas-cli 의 평가와 같아진다', () => {
    const config = evaluate({
      BACKEND_URL: HTTPS,
      APP_VARIANT: 'preview',
      EAS_BUILD_PROJECT_ID: PROBE_PROJECT_ID,
    })
    expect(config.updates?.enabled).toBe(true)
    expect(config.extra?.eas).toEqual({ projectId: PROBE_PROJECT_ID })
  })

  it('UUID 가 아닌 EAS_PROJECT_ID 는 설정 평가를 멈춘다', () => {
    expect(() =>
      evaluate({ BACKEND_URL: HTTPS, APP_VARIANT: 'preview', EAS_PROJECT_ID: 'my-project' }),
    ).toThrowError('EAS_PROJECT_ID must be a UUID (got "my-project")')
  })
})
```

`test/unit/config/updates.test.ts` 를 만든다:

```ts
import { describe, expect, it } from 'vitest'

import { APP_VARIANTS } from '@/lib/config/app-variant'
import {
  EAS_UPDATE_ORIGIN,
  RUNTIME_VERSION_POLICY,
  easProjectId,
  updatesConfig,
} from '@/lib/config/updates'

// 실제 EAS 프로젝트 id 가 아니다 - 모양만 UUID 인 표본이다.
const PROBE_PROJECT_ID = '0f6b3c1e-2a4d-4e8f-9b1a-7c5d3e2f1a0b'
const OTHER_PROJECT_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d'

describe('easProjectId - 스펙 10.1', () => {
  it.each([
    ['없음', {}],
    ['빈 값', { EAS_PROJECT_ID: '' }],
    ['공백', { EAS_PROJECT_ID: '  ' }],
  ])('%s 이면 null 이다 - EAS 프로젝트도 OTA 도 없다', (_label, env) => {
    expect(easProjectId(env)).toBeNull()
  })

  it('앞뒤 공백을 떼고 돌려준다', () => {
    expect(easProjectId({ EAS_PROJECT_ID: ` ${PROBE_PROJECT_ID} ` })).toBe(PROBE_PROJECT_ID)
  })

  it('EAS 빌드 서버가 주는 EAS_BUILD_PROJECT_ID 는 EAS_PROJECT_ID 가 없을 때만 쓴다', () => {
    expect(easProjectId({ EAS_BUILD_PROJECT_ID: PROBE_PROJECT_ID })).toBe(PROBE_PROJECT_ID)
    expect(easProjectId({ EAS_PROJECT_ID: '', EAS_BUILD_PROJECT_ID: PROBE_PROJECT_ID })).toBe(
      PROBE_PROJECT_ID,
    )
    expect(
      easProjectId({ EAS_PROJECT_ID: OTHER_PROJECT_ID, EAS_BUILD_PROJECT_ID: PROBE_PROJECT_ID }),
    ).toBe(OTHER_PROJECT_ID)
  })

  it.each(['my-project', `${PROBE_PROJECT_ID}x`, PROBE_PROJECT_ID.replaceAll('-', '')])(
    'UUID 가 아닌 %s 는 설정 평가를 멈춘다 - 틀린 id 는 OTA 를 소리 없이 멈추게 한다',
    (raw) => {
      expect(() => easProjectId({ EAS_PROJECT_ID: raw })).toThrowError(
        `EAS_PROJECT_ID must be a UUID (got ${JSON.stringify(raw)})`,
      )
    },
  )
})

describe('updatesConfig - 스펙 10.6', () => {
  it.each(['preview', 'production'] as const)(
    '%s 변형에 EAS 프로젝트가 있으면 OTA 를 켠다 - 채널은 변형 이름, 켤 때 확인하고 기다리지 않는다',
    (variant) => {
      expect(updatesConfig(variant, PROBE_PROJECT_ID)).toEqual({
        enabled: true,
        url: `https://u.expo.dev/${PROBE_PROJECT_ID}`,
        checkAutomatically: 'ON_LOAD',
        fallbackToCacheTimeout: 0,
        requestHeaders: { 'expo-channel-name': variant },
      })
    },
  )

  it.each(APP_VARIANTS)('%s 변형도 EAS 프로젝트가 없으면 OTA 를 끈다', (variant) => {
    expect(updatesConfig(variant, null)).toEqual({ enabled: false })
  })

  it.each(['development', 'e2e'] as const)(
    '%s 변형은 EAS 프로젝트가 있어도 OTA 를 끈다 - 개발 서버·내장 번들로 돈다',
    (variant) => {
      expect(updatesConfig(variant, PROBE_PROJECT_ID)).toEqual({ enabled: false })
    },
  )

  it('업데이트 주소는 EAS Update 의 프로젝트 경로다', () => {
    expect(EAS_UPDATE_ORIGIN).toBe('https://u.expo.dev')
  })

  it('runtime version 은 fingerprint 정책이다 - 네이티브 구성이 같은 빌드에만 업데이트가 간다', () => {
    expect(RUNTIME_VERSION_POLICY).toEqual({ policy: 'fingerprint' })
  })
})
```

`test/unit/config/eas-json.test.ts` 를 만든다:

```ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { APP_VARIANTS, variantProfile } from '@/lib/config/app-variant'

/**
 * eas.json - 스펙 10.5.
 *
 * EAS 빌드 프로필은 빌드 변형(lib/config/app-variant.ts)과 1:1 이다 - 프로필 이름이 변형 이름이고, 프로필이
 * APP_VARIANT 로 그 변형을 고르고, OTA 채널이 변형 표의 채널과 같다. EAS 빌드는 eas.json 의 채널을 네이티브
 * 설정에 쓰고 EAS 밖의 빌드는 app.config.ts 의 요청 머리글(lib/config/updates.ts)을 쓰므로 둘이 달라지면 빌드
 * 방식에 따라 다른 채널을 본다.
 *
 * 스키마는 EAS 명령이 @expo/eas-json 으로 검사한다(계획을 쓸 때 24.8.0 의 해석기로 네 프로필 × 두 플랫폼을
 * 읽었다 - docs/superpowers/notes/2026-10-01-d6-measurements.md 의 O2). 여기서는 이 저장소의 약속을 본다.
 */
interface BuildProfile {
  node?: string
  pnpm?: string
  channel?: string
  distribution?: string
  developmentClient?: boolean
  autoIncrement?: boolean
  environment?: string
  withoutCredentials?: boolean
  env?: Record<string, string>
  android?: { buildType?: string }
  ios?: { simulator?: boolean }
}

interface EasJson {
  cli?: { version?: string; appVersionSource?: string }
  build?: Record<string, BuildProfile>
  submit?: Record<string, { android?: unknown; ios?: unknown }>
}

const easJson = JSON.parse(readFileSync('eas.json', 'utf8')) as EasJson
const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
  engines: { node: string }
  packageManager: string
}
const profiles = easJson.build ?? {}

function profile(name: string): BuildProfile {
  const found = profiles[name]
  if (found === undefined) throw new Error(`eas.json 에 ${name} 빌드 프로필이 없다`)
  return found
}

/** "24.19.0" 이 "24.11.0" 이상인가 - 숫자 세 마디만 본다. */
function atLeast(version: string, floor: string): boolean {
  const actual = version.split('.').map(Number)
  const minimum = floor.split('.').map(Number)
  for (let index = 0; index < 3; index += 1) {
    const a = actual[index] ?? 0
    const m = minimum[index] ?? 0
    if (a !== m) return a > m
  }
  return true
}

describe('eas.json - 스펙 10.5', () => {
  it('빌드 프로필은 변형과 같은 넷이다', () => {
    expect(Object.keys(profiles).sort()).toEqual([...APP_VARIANTS].sort())
  })

  it.each(APP_VARIANTS)('%s 프로필은 APP_VARIANT 로 같은 이름의 변형을 고른다', (variant) => {
    expect(profile(variant).env?.APP_VARIANT).toBe(variant)
  })

  it.each(APP_VARIANTS)('%s 프로필의 OTA 채널이 변형 표의 채널과 같다', (variant) => {
    expect(profile(variant).channel ?? null).toBe(variantProfile(variant).updatesChannel)
  })

  it.each(APP_VARIANTS)(
    '%s 프로필에 BACKEND_URL 을 적지 않는다 - 주소는 EAS 환경 변수로 넣는다',
    (variant) => {
      expect(Object.keys(profile(variant).env ?? {})).toEqual(['APP_VARIANT'])
    },
  )

  it.each(APP_VARIANTS)(
    '%s 프로필은 app.config.ts 를 평가할 Node 를 고정한다 - type stripping(22.18 이상)과 engines.node',
    (variant) => {
      const node = profile(variant).node ?? ''
      const floor = packageJson.engines.node.replace(/^>=/, '')
      expect(node).toMatch(/^\d+\.\d+\.\d+$/)
      expect(atLeast(node, '22.18.0')).toBe(true)
      expect(atLeast(node, floor)).toBe(true)
    },
  )

  it.each(APP_VARIANTS)('%s 프로필의 pnpm 은 packageManager 와 같다', (variant) => {
    expect(`pnpm@${profile(variant).pnpm ?? ''}`).toBe(packageJson.packageManager)
  })

  it('development 는 dev client 의 내부 배포다', () => {
    expect(profile('development')).toMatchObject({
      developmentClient: true,
      distribution: 'internal',
      environment: 'development',
    })
  })

  it('preview 는 내부 배포 APK 다', () => {
    expect(profile('preview')).toMatchObject({
      distribution: 'internal',
      environment: 'preview',
      android: { buildType: 'apk' },
    })
  })

  it('production 은 스토어 빌드이고 빌드 번호를 EAS 가 올린다', () => {
    expect(profile('production')).toMatchObject({
      distribution: 'store',
      environment: 'production',
      autoIncrement: true,
    })
    expect(easJson.cli?.appVersionSource).toBe('remote')
  })

  it('e2e 는 Android APK 와 iOS 시뮬레이터 빌드다', () => {
    expect(profile('e2e')).toMatchObject({
      android: { buildType: 'apk' },
      ios: { simulator: true },
    })
  })

  it('제출은 Android internal 트랙의 draft 이고 iOS 계정 값은 적지 않는다', () => {
    expect(easJson.submit).toEqual({
      production: { android: { track: 'internal', releaseStatus: 'draft' } },
    })
  })

  it('eas-cli 는 스펙이 잰 24.8.0 이상이다', () => {
    expect(easJson.cli?.version).toBe('>= 24.8.0')
  })
})
```

- [ ] **Step 4: 시험이 실패하는 것을 본다**

```bash
timeout 300 pnpm exec vitest run test/unit/config 2>&1 | grep -E "Tests |Test Files|ENOENT|Cannot find package" | sort -u
```

Expected: `Test Files  4 failed | 2 passed (6)`, `Tests  12 failed | 46 passed (58)` - `app-config` 의 새 describe 열(아직 `updates` 가 없다)과 `app-variant` 둘(`updatesChannel` 이 없다)이 죽고, `updates.test.ts` 는 `@/lib/config/updates` 를 풀지 못하며(`Error: Cannot find package '@/lib/config/updates'`), `eas-json.test.ts` 는 `ENOENT … eas.json` 으로 파일째 죽는다. `settings`·`startup` 은 그대로 통과한다.

- [ ] **Step 5: 변형 표·OTA 판단·`app.config.ts`·`eas.json` 을 쓴다**

`lib/config/app-variant.ts` — Edit, 찾을 것:

```ts
  readonly logsHttpFailures: boolean
}
```

바꿀 것:

```ts
  readonly logsHttpFailures: boolean
  /**
   * OTA 채널(스펙 10.2·10.6). eas.json 에서 이 변형을 빌드하는 프로필의 channel 과 같은 값이다 -
   * test/unit/config/eas-json.test.ts 가 맞댄다. null 이면 이 변형은 OTA 를 끈다: development 는 개발 서버의
   * 번들을, e2e 는 내장 번들을 결정적으로 돈다.
   */
  readonly updatesChannel: string | null
}
```

같은 파일에 Edit, 찾을 것:

```ts
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
```

바꿀 것:

```ts
  development: {
    idSuffix: '.dev',
    schemeSuffix: '-dev',
    nameSuffix: ' (Dev)',
    allowCleartext: true,
    logsHttpFailures: false,
    updatesChannel: null,
  },
  preview: {
    idSuffix: '.preview',
    schemeSuffix: '-preview',
    nameSuffix: ' (Preview)',
    allowCleartext: false,
    logsHttpFailures: false,
    updatesChannel: 'preview',
  },
  production: {
    idSuffix: '',
    schemeSuffix: '',
    nameSuffix: '',
    allowCleartext: false,
    logsHttpFailures: false,
    updatesChannel: 'production',
  },
  e2e: {
    idSuffix: '.e2e',
    schemeSuffix: '-e2e',
    nameSuffix: ' (E2E)',
    allowCleartext: true,
    logsHttpFailures: true,
    updatesChannel: null,
  },
```

`app.config.ts` 가 type stripping 으로 부르므로 import 에 `.ts` 를 붙이고 타입만 지우면 도는 구문만 쓴다. `lib/config/updates.ts` 를 만든다:

```ts
/**
 * OTA 업데이트 설정 - 스펙 10.1·10.6.
 *
 * app.config.ts(빌드 시점, node)와 테스트가 함께 쓰는 순수 모듈이다. app.config.ts 가 Node 의 type
 * stripping 으로 직접 실행한다 - 타입만 지우면 도는 구문만 쓰고 import 에는 `.ts` 확장자를 붙인다
 * (lib/config/AGENTS.md).
 */
import { variantProfile, type AppVariant } from './app-variant.ts'

/** EAS Update 의 주소. 뒤에 프로젝트 id 를 경로로 붙인다. */
export const EAS_UPDATE_ORIGIN = 'https://u.expo.dev'

/** OTA 를 켠 빌드의 runtime version 정책 - 네이티브 구성이 같은 빌드에만 업데이트가 간다(스펙 10.6). */
export const RUNTIME_VERSION_POLICY = { policy: 'fingerprint' } as const

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * EAS 프로젝트 id - 선택 변수 EAS_PROJECT_ID(스펙 10.1). 없거나 비어 있으면 null 이다(EAS 프로젝트도 OTA 도
 * 없다).
 *
 * EAS 빌드 서버는 프로젝트 id 를 EAS_BUILD_PROJECT_ID 로 준다. EAS_PROJECT_ID 가 없을 때 그 값을 쓴다 - 빌드를
 * 시작한 eas-cli 는 로컬의 EAS_PROJECT_ID 로 설정을 평가하는데, 서버의 평가에 id 가 빠지면 OTA 가 꺼져 두
 * 평가의 runtime version 이 달라지고 EAS 빌드가 멈춘다.
 *
 * 값이 있는데 UUID 가 아니면 던진다 - 틀린 id 는 업데이트 주소를 틀리게 만들어 OTA 가 소리 없이 멈춘다.
 */
export function easProjectId(env: Readonly<Record<string, string | undefined>>): string | null {
  const raw = [env.EAS_PROJECT_ID, env.EAS_BUILD_PROJECT_ID].find(
    (value) => value !== undefined && value.trim() !== '',
  )
  if (raw === undefined) return null
  const value = raw.trim()
  if (!UUID.test(value)) {
    throw new Error(`EAS_PROJECT_ID must be a UUID (got ${JSON.stringify(raw)})`)
  }
  return value
}

/** app.config.ts 의 updates 자리 - expo-updates 의 설정 플러그인이 네이티브 설정으로 옮긴다. */
export type UpdatesConfig =
  | { readonly enabled: false }
  | {
      readonly enabled: true
      readonly url: string
      readonly checkAutomatically: 'ON_LOAD'
      readonly fallbackToCacheTimeout: 0
      readonly requestHeaders: { readonly 'expo-channel-name': string }
    }

/**
 * 변형과 EAS 프로젝트로 OTA 를 정한다(스펙 10.6). 채널이 있는 변형(preview·production)에 EAS 프로젝트가 있을 때만
 * 켠다. 켜면 앱을 켤 때 확인하지만 기다리지 않는다(ON_LOAD · 0) - 받은 업데이트는 다음 실행에 적용된다.
 *
 * 채널은 요청 머리글(expo-channel-name)로 싣는다. EAS 빌드는 eas.json 프로필의 channel 로 같은 머리글을 다시 쓰고,
 * EAS 밖의 빌드(prebuild + Gradle·xcodebuild)는 이 값을 그대로 쓴다 - 둘이 같은지는
 * test/unit/config/eas-json.test.ts 가 본다.
 */
export function updatesConfig(variant: AppVariant, projectId: string | null): UpdatesConfig {
  const channel = variantProfile(variant).updatesChannel
  if (channel === null || projectId === null) return { enabled: false }
  return {
    enabled: true,
    url: `${EAS_UPDATE_ORIGIN}/${projectId}`,
    checkAutomatically: 'ON_LOAD',
    fallbackToCacheTimeout: 0,
    requestHeaders: { 'expo-channel-name': channel },
  }
}
```

바꾸기 전에 `git hash-object app.config.ts` 가 Step 1 의 `0515df1…` 인지 한 번 더 본다(다르면 멈춘다). `app.config.ts` 전체를 바꾼다:

```ts
import type { ConfigContext, ExpoConfig } from 'expo/config'

import {
  assertBackendUrlAllowed,
  parseAppVariant,
  variantProfile,
} from './lib/config/app-variant.ts'
import { loadSettings } from './lib/config/settings.ts'
import { easProjectId, RUNTIME_VERSION_POLICY, updatesConfig } from './lib/config/updates.ts'

/**
 * 앱 식별자와 빌드 설정의 정본(스펙 10.1).
 *
 * 이 파일은 expo start · expo export · expo prebuild · EAS 빌드 · OTA 발행이 평가한다.
 * 필수 설정이 없으면 **그 명령 전체가 여기서 멈춘다.** 검증 함수는 앱이 시작할 때
 * 쓰는 것과 같다(lib/config/settings.ts) - 두 벌을 두지 않는다.
 *
 * 기본 식별자는 일부러 배포할 수 없는 값이다. Google Play 는 com.example 로 시작하는
 * 패키지 이름을 받지 않는다 - 템플릿 사용자는 배포 전에 BASE_APP_ID 를 반드시
 * 바꾸게 된다(스펙 10.3).
 *
 * OTA(스펙 10.6)는 채널이 있는 변형(preview·production)에 EAS 프로젝트(EAS_PROJECT_ID)가 있을 때만 켠다
 * (lib/config/updates.ts). 켠 빌드만 runtime version 을 fingerprint 정책으로 둔다 - 끈 빌드(development·e2e,
 * 프로젝트가 없는 배포 변형)는 받을 업데이트가 없으니 빌드 중에 지문을 계산하지 않는다.
 */
export const BASE_APP_ID = 'com.example.templateexpo'
export const BASE_SCHEME = 'templateexpo'
export const BASE_NAME = 'Template Expo'

export default function appConfig({ config }: ConfigContext): ExpoConfig {
  const variant = parseAppVariant(process.env.APP_VARIANT)
  const { backendUrl } = loadSettings({ BACKEND_URL: process.env.BACKEND_URL })
  assertBackendUrlAllowed(backendUrl, variant)
  const projectId = easProjectId(process.env)
  const updates = updatesConfig(variant, projectId)
  const profile = variantProfile(variant)
  const appId = `${BASE_APP_ID}${profile.idSuffix}`

  return {
    ...config,
    name: `${BASE_NAME}${profile.nameSuffix}`,
    slug: 'template-typescript-expo',
    version: '0.1.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    scheme: `${BASE_SCHEME}${profile.schemeSuffix}`,
    userInterfaceStyle: 'automatic',
    ...(updates.enabled ? { runtimeVersion: RUNTIME_VERSION_POLICY } : {}),
    updates,
    ios: {
      supportsTablet: true,
      bundleIdentifier: appId,
      infoPlist: {
        NSAppTransportSecurity: { NSAllowsLocalNetworking: profile.allowCleartext },
      },
    },
    android: {
      package: appId,
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
    },
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        { backgroundColor: '#E6F4FE', image: './assets/splash-icon.png', imageWidth: 76 },
      ],
      ['expo-build-properties', { android: { usesCleartextTraffic: profile.allowCleartext } }],
      // 세션 항목(SecureStore)을 Android 자동 백업에서 뺀다 - 복원된 백업은 키 저장소의 키가 없어
      // 풀 수 없다. 생체 인증을 쓰지 않으므로(스펙 1.2) Face ID 사용 문구를 넣지 않는다(스펙 7.1).
      ['expo-secure-store', { configureAndroidBackup: true, faceIDPermission: false }],
    ],
    experiments: { typedRoutes: true, reactCompiler: true },
    // eas-cli 와 EAS 빌드는 extra.eas.projectId 로 프로젝트를 찾는다.
    extra: {
      backendUrl,
      appVariant: variant,
      ...(projectId === null ? {} : { eas: { projectId } }),
    },
  }
}
```

`eas.json` 을 만든다:

```json
{
  "cli": {
    "version": ">= 24.8.0",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "node": "24.19.0",
      "pnpm": "11.22.0",
      "developmentClient": true,
      "distribution": "internal",
      "environment": "development",
      "env": { "APP_VARIANT": "development" }
    },
    "preview": {
      "node": "24.19.0",
      "pnpm": "11.22.0",
      "distribution": "internal",
      "channel": "preview",
      "environment": "preview",
      "env": { "APP_VARIANT": "preview" },
      "android": { "buildType": "apk" }
    },
    "production": {
      "node": "24.19.0",
      "pnpm": "11.22.0",
      "distribution": "store",
      "channel": "production",
      "autoIncrement": true,
      "environment": "production",
      "env": { "APP_VARIANT": "production" }
    },
    "e2e": {
      "node": "24.19.0",
      "pnpm": "11.22.0",
      "distribution": "internal",
      "withoutCredentials": true,
      "env": { "APP_VARIANT": "e2e" },
      "android": { "buildType": "apk" },
      "ios": { "simulator": true }
    }
  },
  "submit": {
    "production": {
      "android": { "track": "internal", "releaseStatus": "draft" }
    }
  }
}
```

`.env.example` — Edit, 찾을 것:

```text
APP_VARIANT=development
```

바꿀 것:

```text
APP_VARIANT=development

# 선택 - 기본값 없음. EAS 프로젝트 id(UUID - `eas init` 이 만든다). 있으면 preview·production 변형의 OTA 를
# 켠다(스펙 10.6). development·e2e 는 이 값과 무관하게 OTA 를 끈다.
EAS_PROJECT_ID=
```

- [ ] **Step 6: 시험이 통과하고 Expo CLI 가 변형마다 같은 값을 내는지 본다**

```bash
timeout 300 pnpm exec vitest run test/unit/config 2>&1 | grep -E "Test Files|Tests "
pnpm format
pnpm typecheck && pnpm lint && pnpm format:check
for variant in development preview production e2e; do
  for project in '' 00000000-0000-4000-8000-000000000000; do
    APP_VARIANT="$variant" BACKEND_URL=https://gate-check.invalid EAS_PROJECT_ID="$project" EAS_BUILD_PROJECT_ID='' \
      timeout 120 pnpm exec expo config --type public --json |
      node -e 'let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => { const c = JSON.parse(s); console.log(c.extra.appVariant, JSON.stringify(c.updates), JSON.stringify(c.runtimeVersion ?? null), JSON.stringify(c.extra.eas ?? null)) })'
  done
done
```

Expected: `Test Files  6 passed (6)`·`Tests  103 passed (103)`, 검사 셋 exit 0, 여덟 줄 - 켠 것은 `preview`·`production` 에 id 를 준 둘뿐이다:

```text
development {"enabled":false} null null
development {"enabled":false} null {"projectId":"00000000-0000-4000-8000-000000000000"}
preview {"enabled":false} null null
preview {"enabled":true,"url":"https://u.expo.dev/00000000-0000-4000-8000-000000000000","checkAutomatically":"ON_LOAD","fallbackToCacheTimeout":0,"requestHeaders":{"expo-channel-name":"preview"}} {"policy":"fingerprint"} {"projectId":"00000000-0000-4000-8000-000000000000"}
production {"enabled":false} null null
production {"enabled":true,"url":"https://u.expo.dev/00000000-0000-4000-8000-000000000000","checkAutomatically":"ON_LOAD","fallbackToCacheTimeout":0,"requestHeaders":{"expo-channel-name":"production"}} {"policy":"fingerprint"} {"projectId":"00000000-0000-4000-8000-000000000000"}
e2e {"enabled":false} null null
e2e {"enabled":false} null {"projectId":"00000000-0000-4000-8000-000000000000"}
```

`expo config` 가 `SyntaxError`·`Unexpected identifier` 로 죽으면 `lib/config/updates.ts` 에 type stripping 이 지우지 못하는 구문이 들어간 것이다(`lib/config/AGENTS.md`).

- [ ] **Step 7: 실측 O1 - 설정이 다르면 fingerprint runtime version 이 다른가**

계정·네트워크 없이 expo-updates 의 CLI 로 Android runtime version 을 계산한다(결정 19). `.maestro-output/d6-runtime-versions.sh` 를 만든다:

```bash
#!/usr/bin/env bash
# D6 실측 O1 - 설정이 다르면 fingerprint runtime version 이 다른가. 계정·네트워크 없이 돈다.
#   bash .maestro-output/d6-runtime-versions.sh   (저장소 루트에서)
set -euo pipefail
A_URL='https://probe-a.example'
B_URL='https://probe-b.example'
ID1='0f6b3c1e-2a4d-4e8f-9b1a-7c5d3e2f1a0b'
ID2='9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d'
JS_FILE='app/(app)/index.tsx'

rv() {
  APP_VARIANT="$1" BACKEND_URL="$2" EAS_PROJECT_ID="$3" EAS_BUILD_PROJECT_ID='' \
    node node_modules/expo-updates/bin/cli.js runtimeversion:resolve --platform android |
    node -e 'let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => console.log(JSON.parse(s).runtimeVersion))'
}

echo "A  preview    $A_URL ID1: $(rv preview "$A_URL" "$ID1")"
echo "A2 preview    $A_URL ID1: $(rv preview "$A_URL" "$ID1")"
echo "B  preview    $B_URL ID1: $(rv preview "$B_URL" "$ID1")"
echo "C  production $A_URL ID1: $(rv production "$A_URL" "$ID1")"
echo "E  preview    $A_URL ID2: $(rv preview "$A_URL" "$ID2")"
echo "F  (변형 없음) $A_URL ID1: $(rv '' "$A_URL" "$ID1")"
trap 'git checkout -- "$JS_FILE"' EXIT
printf '\n// D6 실측 O1 - JS 만 바뀐 발행\n' >>"$JS_FILE"
echo "D  preview    $A_URL ID1 (JS 만 바뀜): $(rv preview "$A_URL" "$ID1")"
```

```bash
git status --short
timeout 600 bash .maestro-output/d6-runtime-versions.sh
git status --short 'app/(app)/index.tsx'
```

Expected: 일곱 줄(스크래치에서 13초) - `A` 와 `A2` 가 같은 40자리 16진수, `B`·`C`·`E` 는 `A` 와 각각 다르고 서로도 다르다, `F` 는 `null`, `D` 는 `A` 와 같다. 끝의 `git status` 는 비어 있다(trap 이 JS 파일을 되돌렸다). 관계가 다르면(예: `B` 가 `A` 와 같다 - `extra` 가 지문에 없다) 멈추고 출력과 함께 컨트롤러에 넘긴다 - 스펙 10.6 정정 (c) 와 결정 19 의 전제가 무너진 것이다. 일곱 줄을 Step 9 의 기록에 붙인다.

- [ ] **Step 8: 실측 O2 - `eas.json` 을 EAS 의 해석기로 읽는다**

eas-cli 24.8.0 이 쓰는 `@expo/eas-json` 24.8.0 을 저장소 밖의 임시 디렉터리에 받는다 - 저장소의 의존성은 바뀌지 않는다(결정 11). `.maestro-output/d6-eas-json.cjs` 를 만든다:

```js
// D6 실측 O2 - eas.json 을 eas-cli 24.8.0 이 쓰는 @expo/eas-json 24.8.0 의 스키마·해석기로 읽는다(계정 없이).
//   node .maestro-output/d6-eas-json.cjs <@expo/eas-json 을 받은 디렉터리> <저장소>
const { createRequire } = require('node:module')
const { join } = require('node:path')

const [libDir, projectDir] = process.argv.slice(2)
const { EasJsonAccessor, EasJsonUtils } = createRequire(join(libDir, 'package.json'))('@expo/eas-json')

async function main() {
  const accessor = EasJsonAccessor.fromProjectPath(projectDir)
  console.log(`cli ${JSON.stringify(await EasJsonUtils.getCliConfigAsync(accessor))}`)
  for (const name of await EasJsonUtils.getBuildProfileNamesAsync(accessor)) {
    for (const platform of ['android', 'ios']) {
      const profile = await EasJsonUtils.getBuildProfileAsync(accessor, platform, name)
      const warnings = await EasJsonUtils.getBuildProfileDeprecationWarningsAsync(accessor, platform, name)
      console.log(`build ${name} ${platform} ${JSON.stringify(profile)}${warnings.length > 0 ? ` 경고 ${JSON.stringify(warnings)}` : ''}`)
    }
  }
  for (const name of await EasJsonUtils.getSubmitProfileNamesAsync(accessor)) {
    for (const platform of ['android', 'ios']) {
      console.log(`submit ${name} ${platform} ${JSON.stringify(await EasJsonUtils.getSubmitProfileAsync(accessor, platform, name))}`)
    }
  }
}

main().catch((error) => {
  console.error(`eas.json 을 해석하지 못했다: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
```

```bash
EASJSON_DIR=$(mktemp -d)
(cd "$EASJSON_DIR" && npm init -y >/dev/null && timeout 300 npm i --no-audit --no-fund --loglevel=error @expo/eas-json@24.8.0)
timeout 60 node .maestro-output/d6-eas-json.cjs "$EASJSON_DIR" .; echo "exit=$?"
rm -rf "$EASJSON_DIR"
git status --short package.json pnpm-lock.yaml
```

Expected: `added 84 packages`, 아래 Step 9 기록의 O2 블록과 같은 열한 줄(`cli …`, `build <프로필> <플랫폼> …` 여덟, `submit production android …`·`… ios …`), 경고 없이 `exit=0`, 저장소의 `package.json`·`pnpm-lock.yaml` 은 Step 2 뒤 그대로다(`git status` 에 `M` 둘은 Step 2 의 것). 다르면 기록의 블록을 실제 출력으로 바꾸고 판정을 고친다 - 해석이 실패하면(스키마 위반) 멈추고 컨트롤러에 알린다.

- [ ] **Step 9: 기록과 문서를 쓴다**

O1 의 괄호 안 안내 줄은 Step 7 의 출력 일곱 줄로 바꾼다. `docs/superpowers/notes/2026-10-01-d6-measurements.md` 를 만든다:

````markdown
# D6 실측 기록 (2026-10-01)

EAS 설정·OTA·빌드 정보 카드(D6)를 Expo 계정 없이 잰 것이다. 계정과 빌드 크레딧이 필요한 실증(EAS 빌드, 업데이트
발행, 설치한 앱이 그 업데이트를 받는 것)은 스펙 15장 9단계가 사용자 승인 뒤에 한다. 계획은
`docs/superpowers/plans/2026-10-01-d6-eas-and-ota.md`.

## O1 — 설정이 다르면 fingerprint runtime version 이 다르다

**물음.** 스펙 16장은 "설정 오류가 OTA로 배포된다" 의 대응으로 `fingerprint` 런타임 정책을 든다. 업데이트는 발행한
환경의 설정으로 runtime version 을 계산하고 같은 runtime version 의 빌드에만 간다. 그러면 설정이 다른 환경(다른
`BACKEND_URL`, `APP_VARIANT` 없이, 다른 EAS 프로젝트)에서 발행한 업데이트가 빌드에 닿는지는 fingerprint 가 설정의
무엇을 해시에 넣는지에 달렸다.

**명령.** expo-updates 57.0.24 의 CLI 로 Android runtime version 을 계산했다 - 계정도 네트워크도 쓰지 않는다. 줄마다
`APP_VARIANT=<변형> BACKEND_URL=<주소> EAS_PROJECT_ID=<id> node node_modules/expo-updates/bin/cli.js
runtimeversion:resolve --platform android` 의 `runtimeVersion` 이다. 프로젝트 id 둘(ID1·ID2)과 주소 둘은 표본이다. D 는
JS 파일 하나(`app/(app)/index.tsx`)에 주석 한 줄을 더한 채로 재고 되돌렸다.

```text
(Task 1 Step 7 의 출력 일곱 줄 - A·A2·B·C·E·F·D - 을 그대로 붙인다)
```

**판정.** A 와 A2 가 같다 - 같은 설정은 같은 값이다. B(`BACKEND_URL` 만 다름)·C(변형만 다름)·E(프로젝트 id 만
다름)는 A 와 모두 다르다 - fingerprint 는 공개 설정 전체를 해시에 넣는다(`@expo/fingerprint` 0.20.13 의 기본
`sourceSkips` 는 `PackageJsonAndroidAndIosScriptsIfNotContainRun` 하나라 `extra` 도 들어간다). F(`APP_VARIANT` 없이 -
development)는 OTA 를 끈 설정이라 runtime version 이 없다 - eas-cli 는 runtime version 이 없는 설정으로 업데이트를
발행하지 않는다. D(JS 만 바뀜)는 A 와 같다 - 그런 업데이트는 그 빌드에 간다. 그래서 설정이 틀린 환경의 발행은 어떤
빌드에도 닿지 않는다. 앱 시작의 재검증(스펙 10.1)은 그 뒤의 두 번째 방어선이다.

## O2 — eas.json 을 EAS 의 해석기로 읽는다

**명령.** eas-cli 24.8.0 이 eas.json 을 읽을 때 쓰는 `@expo/eas-json` 24.8.0 을 저장소 밖의 임시 디렉터리에 받아,
`EasJsonUtils` 로 빌드 프로필 넷 × 플랫폼 둘과 제출 프로필을 해석했다 - 계정 없이 도는 라이브러리다.

```text
cli {"version":">= 24.8.0","appVersionSource":"remote"}
build development android {"credentialsSource":"remote","distribution":"internal","node":"24.19.0","pnpm":"11.22.0","developmentClient":true,"environment":"development","env":{"APP_VARIANT":"development"}}
build development ios {"credentialsSource":"remote","distribution":"internal","node":"24.19.0","pnpm":"11.22.0","developmentClient":true,"environment":"development","env":{"APP_VARIANT":"development"}}
build preview android {"credentialsSource":"remote","distribution":"internal","node":"24.19.0","pnpm":"11.22.0","channel":"preview","environment":"preview","env":{"APP_VARIANT":"preview"},"buildType":"apk"}
build preview ios {"credentialsSource":"remote","distribution":"internal","node":"24.19.0","pnpm":"11.22.0","channel":"preview","environment":"preview","env":{"APP_VARIANT":"preview"}}
build production android {"credentialsSource":"remote","distribution":"store","node":"24.19.0","pnpm":"11.22.0","channel":"production","autoIncrement":true,"environment":"production","env":{"APP_VARIANT":"production"}}
build production ios {"credentialsSource":"remote","distribution":"store","node":"24.19.0","pnpm":"11.22.0","channel":"production","autoIncrement":true,"environment":"production","env":{"APP_VARIANT":"production"}}
build e2e android {"credentialsSource":"remote","distribution":"internal","node":"24.19.0","pnpm":"11.22.0","withoutCredentials":true,"env":{"APP_VARIANT":"e2e"},"buildType":"apk"}
build e2e ios {"credentialsSource":"remote","distribution":"internal","node":"24.19.0","pnpm":"11.22.0","withoutCredentials":true,"env":{"APP_VARIANT":"e2e"},"simulator":true}
submit production android {"track":"internal","releaseStatus":"draft","changesNotSentForReview":false}
submit production ios {"language":"en-US"}
```

**판정.** 스키마 위반과 폐기 경고 없이 모두 해석됐다. 해석한 프로필에는 스키마의 기본값(`credentialsSource:
remote`, 제출의 `changesNotSentForReview: false`, iOS 제출의 `language: en-US`)이 더해진다.
````

`lib/config/AGENTS.md` — Edit, 찾을 것:

```markdown
디렉터리가 아니라 거기 있다.
```

바꿀 것:

```markdown
디렉터리가 아니라 거기 있다.

`updates.ts`는 OTA 설정의 판단이다(스펙 10.6). 선택 변수 `EAS_PROJECT_ID`(EAS 빌드 서버에서는
`EAS_BUILD_PROJECT_ID`)를 읽고, 채널이 있는 변형(`app-variant.ts`의 `updatesChannel` - preview·production)에 EAS
프로젝트가 있을 때만 OTA 를 켠다. 채널은 `eas.json`에서 그 변형을 빌드하는 프로필의 `channel`과 같아야 한다 -
`test/unit/config/eas-json.test.ts`가 맞댄다.
```

루트 `AGENTS.md` 의 `## 검증 명령` 절, 실측 기록 문단(`실측 기록은 \`docs/superpowers/notes/2026-09-30-d1-measurements.md\`다. …`) 끝에 한 문장을 더한다:

```markdown
EAS·OTA 설정의 변형별 검증, 설정이 다르면 fingerprint runtime version 이 갈리는 것, 빌드 정보 카드(D6 실측 O1–O4)는
`docs/superpowers/notes/2026-10-01-d6-measurements.md`에 있다.
```

스펙 — `### 10.2 변형` 바로 앞에 더한다:

```markdown
> 정정(2026-10-01, D6): `EAS_PROJECT_ID` 는 UUID 여야 한다 - 다른 모양이면 설정을 평가하는 순간 멈춘다(틀린 id 는
> 업데이트 주소를 틀리게 만들어 OTA 가 소리 없이 멈춘다). 값이 없고 EAS 빌드 서버가 주는 `EAS_BUILD_PROJECT_ID` 가
> 있으면 그 값을 쓴다 - 빌드를 시작한 eas-cli 는 로컬의 `EAS_PROJECT_ID` 로 설정을 평가하는데, 서버의 평가에 id 가
> 빠지면 OTA 가 꺼져 두 평가의 runtime version 이 달라지고 EAS 빌드가 멈춘다(`@expo/build-tools` 24.8.0 의
> `configureExpoUpdatesIfInstalledAsync`). 프로젝트 id 는 `extra.eas.projectId` 로 실린다 - eas-cli 와 EAS 빌드가
> 프로젝트를 찾는 자리다. Expo CLI 는 `.env` 를 읽으므로 게이트는 설정을 평가할 때 `EAS_PROJECT_ID` 를 빈 값으로도
> 명시한다. 판단은 `lib/config/updates.ts` 의 `easProjectId`.
```

스펙 — `### 10.6 OTA 업데이트` 바로 앞에 더한다:

```markdown
> 정정(2026-10-01, D6): `eas.json` 의 빌드 프로필은 변형과 같은 넷뿐이다 - 공통 설정을 담는 `base` 프로필을 두지
> 않는다(그 프로필을 빌드하면 `APP_VARIANT` 없이 development 로 평가된다). 네 프로필이 모두 Node `24.19.0`·pnpm
> `11.22.0` 을 고정한다 - `app.config.ts` 가 `lib/config` 를 Node 의 type stripping 으로 불러오고(22.18 이상, D1 실측
> M7), `engines.node`(`>=24.11.0`)를 pnpm 이 강제한다. `environment` 는 프로필 이름과 같은 EAS 환경이다
> (`BACKEND_URL` 을 넣는 자리) - `e2e` 는 정하지 않는다(로컬·CI 는 prebuild + Gradle·xcodebuild 로 빌드한다, 10.7).
> `e2e` 는 자격 증명 없이(`withoutCredentials`) 빌드한다. `development` 의 `developmentClient` 는 `expo-dev-client` 를
> 요구하는데 D6 는 그 패키지를 설치하지 않았다 - 그 설정 플러그인은 기본으로 모든 변형에 같은 scheme
> `exp+<slug>` 를 더해 10.2 의 D1 정정(변형마다 다른 scheme)을 깬다. `eas build --profile development` 는 설치를
> 묻는다(비대화형이면 멈춘다). 프로필과 변형이 맞는지(이름·`APP_VARIANT`·채널·Node·pnpm, `BACKEND_URL` 없음)는
> `test/unit/config/eas-json.test.ts` 가 보고, 스키마는 `@expo/eas-json` 24.8.0 의 해석기로 쟀다(D6 실측 O2).
```

스펙 — `### 10.7 계정이 필요한 실증은 따로 둔다` 바로 앞에 더한다:

```markdown
> 정정(2026-10-01, D6): (a) OTA 설정은 `app.config.ts` 의 `updates` 다 - 켜면 `url`(`https://u.expo.dev/<id>`),
> `checkAutomatically: 'ON_LOAD'`, `fallbackToCacheTimeout: 0`, 채널 머리글 `requestHeaders['expo-channel-name']` 이고,
> 끄면 `{ enabled: false }` 뿐이다. EAS 빌드는 `eas.json` 의 `channel` 로 같은 머리글을 네이티브 설정에 다시 쓰고, EAS
> 밖의 빌드(prebuild + Gradle·xcodebuild)는 앱 설정의 머리글을 쓴다 - 두 값이 같은지 시험이 본다. 판단은
> `lib/config/updates.ts`, 채널은 변형 표(`lib/config/app-variant.ts` 의 `updatesChannel`)다. (b) `runtimeVersion:
> { policy: 'fingerprint' }` 는 OTA 를 켠 빌드에만 둔다 - 끈 빌드(development·e2e, 프로젝트가 없는 배포 변형)는 받을
> 업데이트가 없으니 빌드 중에 지문을 계산하지 않는다. (c) fingerprint 는 공개 설정 전체(식별자·이름·scheme,
> `updates`, `extra` 의 `backendUrl`·`appVariant`·`eas.projectId`)를 해시에 넣는다 - `BACKEND_URL`·`APP_VARIANT`·프로젝트
> id 가 다른 환경에서 발행한 업데이트는 runtime version 이 달라 어떤 빌드에도 닿지 않고, JS 만 바뀐 발행은 같은
> runtime version 이다(D6 실측 O1). 16장의 "설정 오류가 OTA로 배포된다" 에 든 `fingerprint` 대응이 잰 사실이 됐다 -
> 앱 시작의 재검증(10.1)은 그 뒤의 두 번째 방어선이다.
```

- [ ] **Step 10: 검사하고 커밋한다**

```bash
pnpm format
pnpm typecheck && pnpm lint && pnpm format:check && ./scripts/check-citations.sh app components lib platform queries test && pnpm lint:secrets
node scripts/check-provenance.mjs | tail -n 1
timeout 600 pnpm test 2>&1 | grep -E "Test Files|Tests "
git status --short
git add package.json pnpm-lock.yaml lib/config app.config.ts eas.json .env.example test/unit/config AGENTS.md docs/superpowers
git status --short
git commit -m "feat: expo-updates 와 eas.json 을 두고 변형별 OTA 설정(채널·fingerprint·EAS 프로젝트 id)을 app.config.ts 에 싣는다"
```

Expected: 검사 전부 exit 0, 출처 기록은 Step 1 그대로, 단위 시험은 Step 1 의 수 +56·+2(`a40590a` 위에서 `Test Files  71 passed (71)`·`Tests  1602 passed (1602)`), 커밋 뒤 남은 파일이 없다(`.maestro-output/` 은 git 이 무시한다).

---

### Task 2: 게이트 [8] 의 변형별 설정 검사 — `scripts/check-variant-config.mjs`, 실측 O3

**Files:**
- Create: `scripts/check-variant-config.mjs`(100644 - `node` 가 부른다), `test/unit/scripts/check-variant-config.test.ts`
- Modify: `scripts/check.sh`([8] 과 `GATE_EAS_PROJECT_ID`), `AGENTS.md`, `lib/config/AGENTS.md`, `docs/superpowers/notes/2026-10-01-d6-measurements.md`(O3), 스펙(12장 정정)
- 임시(커밋하지 않는다): `.maestro-output/d6-gate-step8.sh`, `.maestro-output/d6-step8*.log`

**Interfaces:**
- Consumes: Task 1 의 `easProjectId`·`updatesConfig`(`lib/config/updates.ts`), `parseAppVariant`·`variantProfile`(`lib/config/app-variant.ts`), `BASE_APP_ID`·`BASE_SCHEME`·`BASE_NAME`(`app.config.ts`).
- Produces: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/check-variant-config.mjs <변형> [<EAS 프로젝트 id>]` - 표준 입력으로 `expo config --type introspect --json` 의 출력을 받는다. 통과하면 종료 코드 0 과 한 줄 `변형 설정 통과: <변형>[ + EAS 프로젝트 <id>] - <N>건, OTA 켬(채널 <채널>)|끔`, 어긋나면 종료 코드 1 과 stderr 의 `변형 설정 위반 <N>건 (<대상>):` 뒤 `- <자리>: <실제> - 기대한 값은 <기대>` 줄들. 자리 이름은 `extra.appVariant`·`extra.eas`·`Android 패키지`·`Android 앱 이름`·`Android 딥링크 scheme`·`Android 평문 HTTP(usesCleartextTraffic)`·`Android OTA(expo.modules.updates.ENABLED)`·`Android OTA 주소`·`Android OTA 채널`·`Android runtime version`·`Android OTA 확인 시점`·`Android OTA 기다림`·`iOS 번들 ID`·`iOS URL scheme`·`iOS 평문 HTTP(NSAllowsLocalNetworking)`·`iOS OTA(EXUpdatesEnabled)`·`iOS OTA 주소`·`iOS OTA 채널`·`iOS runtime version`·`iOS OTA 확인 시점`·`iOS OTA 기다림`.

- [ ] **Step 1: 실패하는 시험을 쓴다**

표본은 `expo config --type introspect --json` 출력에서 검사가 읽는 자리만 남긴 모양이고, 값은 변형 표를 불러오지 않고 글자로 적는다(결정 13). `test/unit/scripts/check-variant-config.test.ts` 를 만든다:

```ts
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * 변형별 설정 검사(scripts/check-variant-config.mjs, 게이트 [8])를 잰다. 게이트는 실제 Expo CLI 의
 * `expo config --type introspect` 출력을 넘기고, 여기서는 그 모양을 줄인 표본을 넘긴다 - 표본의 값은 변형 표를
 * 불러오지 않고 글자로 적는다(표를 불러오면 검사와 표본이 함께 틀려도 통과한다). 한 번도 빨개지지 않은 검사는
 * 있으나 마나라서 자리마다 어긋난 표본이 실패하는 것을 본다.
 */
const SCRIPT = resolve('scripts/check-variant-config.mjs')
// 실제 EAS 프로젝트 id 가 아니다 - 게이트가 쓰는 것과 같은, 모양만 UUID 인 표본이다.
const PROJECT_ID = '00000000-0000-4000-8000-000000000000'

type Variant = 'development' | 'preview' | 'production' | 'e2e'

const NATIVE: Record<
  Variant,
  { id: string; scheme: string; name: string; cleartext: boolean; channel: string | null }
> = {
  development: {
    id: 'com.example.templateexpo.dev',
    scheme: 'templateexpo-dev',
    name: 'Template Expo (Dev)',
    cleartext: true,
    channel: null,
  },
  preview: {
    id: 'com.example.templateexpo.preview',
    scheme: 'templateexpo-preview',
    name: 'Template Expo (Preview)',
    cleartext: false,
    channel: 'preview',
  },
  production: {
    id: 'com.example.templateexpo',
    scheme: 'templateexpo',
    name: 'Template Expo',
    cleartext: false,
    channel: 'production',
  },
  e2e: {
    id: 'com.example.templateexpo.e2e',
    scheme: 'templateexpo-e2e',
    name: 'Template Expo (E2E)',
    cleartext: true,
    channel: null,
  },
}

interface MetaData {
  $: { 'android:name': string; 'android:value': string }
}

/** `expo config --type introspect --json` 출력에서 검사가 읽는 자리만 남긴 표본. */
function introspected(variant: Variant, projectId: string | null) {
  const native = NATIVE[variant]
  const url = `https://u.expo.dev/${PROJECT_ID}`
  const ota = native.channel !== null && projectId !== null
  const headers = { 'expo-channel-name': native.channel ?? '' }
  const metaData: MetaData[] = [
    { $: { 'android:name': 'expo.modules.updates.ENABLED', 'android:value': String(ota) } },
    {
      $: {
        'android:name': 'expo.modules.updates.EXPO_UPDATES_CHECK_ON_LAUNCH',
        'android:value': 'ALWAYS',
      },
    },
    {
      $: {
        'android:name': 'expo.modules.updates.EXPO_UPDATES_LAUNCH_WAIT_MS',
        'android:value': '0',
      },
    },
  ]
  if (ota) {
    metaData.push(
      { $: { 'android:name': 'expo.modules.updates.EXPO_UPDATE_URL', 'android:value': url } },
      {
        $: {
          'android:name': 'expo.modules.updates.UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY',
          'android:value': JSON.stringify(headers),
        },
      },
    )
  }
  const strings = [{ $: { name: 'app_name' }, _: native.name }]
  if (ota) strings.push({ $: { name: 'expo_runtime_version' }, _: 'file:fingerprint' })
  const expoPlist: Record<string, unknown> = {
    EXUpdatesEnabled: ota,
    EXUpdatesCheckOnLaunch: 'ALWAYS',
    EXUpdatesLaunchWaitMs: 0,
  }
  if (ota) {
    expoPlist.EXUpdatesURL = url
    expoPlist.EXUpdatesRequestHeaders = headers
    expoPlist.EXUpdatesRuntimeVersion = 'file:fingerprint'
  }
  return {
    android: { package: native.id },
    ios: { bundleIdentifier: native.id },
    extra: {
      backendUrl: 'https://gate-check.invalid',
      appVariant: variant,
      ...(projectId === null ? {} : { eas: { projectId } }),
      router: {},
    },
    _internal: {
      modResults: {
        android: {
          manifest: {
            manifest: {
              application: [
                {
                  $: { 'android:usesCleartextTraffic': String(native.cleartext) },
                  'meta-data': metaData,
                  activity: [
                    {
                      'intent-filter': [
                        { action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }] },
                        { data: [{ $: { 'android:scheme': native.scheme } }] },
                      ],
                    },
                  ],
                },
              ],
            },
          },
          strings: { resources: { string: strings } },
        },
        ios: {
          infoPlist: {
            NSAppTransportSecurity: { NSAllowsLocalNetworking: native.cleartext },
            CFBundleURLTypes: [{ CFBundleURLSchemes: [native.scheme, native.id] }],
          },
          expoPlist,
        },
      },
    },
  }
}

type Introspected = ReturnType<typeof introspected>

interface Result {
  status: number | null
  stdout: string
  stderr: string
}

function check(args: string[], input: string): Result {
  const result = spawnSync(
    process.execPath,
    ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', SCRIPT, ...args],
    { input, encoding: 'utf8' },
  )
  return { status: result.status, stdout: result.stdout, stderr: result.stderr }
}

function checkConfig(config: unknown, variant: Variant, projectId: string | null): Result {
  return check([variant, projectId ?? ''], JSON.stringify(config))
}

/** 표본을 한 자리만 고쳐 넘긴다. */
function mutated(
  variant: Variant,
  projectId: string | null,
  mutate: (config: Introspected) => void,
): Result {
  const config = introspected(variant, projectId)
  mutate(config)
  return checkConfig(config, variant, projectId)
}

function metaDataOf(config: Introspected): MetaData[] {
  const [application] = config._internal.modResults.android.manifest.manifest.application
  if (application === undefined) throw new Error('표본에 application 이 없다')
  return application['meta-data']
}

const VARIANTS: Variant[] = ['development', 'preview', 'production', 'e2e']

describe('변형별 설정 검사 - 게이트 [8]', { timeout: 30_000 }, () => {
  it.each(
    VARIANTS.flatMap((variant) => [[variant, null] as const, [variant, PROJECT_ID] as const]),
  )('%s (EAS 프로젝트 %s) 의 맞는 설정은 통과한다', (variant, projectId) => {
    const result = checkConfig(introspected(variant, projectId), variant, projectId)
    expect(result.stderr).toBe('')
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('변형 설정 통과')
  })

  it('OTA 를 켠 설정이면 채널을 알린다', () => {
    expect(
      checkConfig(introspected('preview', PROJECT_ID), 'preview', PROJECT_ID).stdout,
    ).toContain('OTA 켬(채널 preview)')
  })

  it.each([
    [
      'preview 의 Android OTA 가 꺼져 있다',
      'preview' as const,
      PROJECT_ID,
      (config: Introspected) => {
        const enabled = metaDataOf(config).find(
          (item) => item.$['android:name'] === 'expo.modules.updates.ENABLED',
        )
        if (enabled !== undefined) enabled.$['android:value'] = 'false'
      },
      'Android OTA(expo.modules.updates.ENABLED)',
    ],
    [
      'preview 의 Android 채널이 production 이다',
      'preview' as const,
      PROJECT_ID,
      (config: Introspected) => {
        const headers = metaDataOf(config).find(
          (item) =>
            item.$['android:name'] ===
            'expo.modules.updates.UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY',
        )
        if (headers !== undefined) {
          headers.$['android:value'] = JSON.stringify({ 'expo-channel-name': 'production' })
        }
      },
      'Android OTA 채널',
    ],
    [
      'production 의 iOS 채널이 없다',
      'production' as const,
      PROJECT_ID,
      (config: Introspected) => {
        delete config._internal.modResults.ios.expoPlist.EXUpdatesRequestHeaders
      },
      'iOS OTA 채널',
    ],
    [
      'production 의 runtime version 이 fingerprint 가 아니다',
      'production' as const,
      PROJECT_ID,
      (config: Introspected) => {
        config._internal.modResults.ios.expoPlist.EXUpdatesRuntimeVersion = '0.1.0'
      },
      'iOS runtime version',
    ],
    [
      'e2e 인데 OTA 가 켜져 있다',
      'e2e' as const,
      null,
      (config: Introspected) => {
        config._internal.modResults.ios.expoPlist.EXUpdatesEnabled = true
      },
      'iOS OTA(EXUpdatesEnabled)',
    ],
    [
      'preview 가 평문 HTTP 를 허용한다(Android)',
      'preview' as const,
      null,
      (config: Introspected) => {
        const [application] = config._internal.modResults.android.manifest.manifest.application
        if (application !== undefined) application.$['android:usesCleartextTraffic'] = 'true'
      },
      'Android 평문 HTTP(usesCleartextTraffic)',
    ],
    [
      'production 이 평문 HTTP 를 허용한다(iOS)',
      'production' as const,
      null,
      (config: Introspected) => {
        config._internal.modResults.ios.infoPlist.NSAppTransportSecurity.NSAllowsLocalNetworking = true
      },
      'iOS 평문 HTTP(NSAllowsLocalNetworking)',
    ],
    [
      'development 에 .env 의 EAS 프로젝트 id 가 섞였다',
      'development' as const,
      null,
      (config: Introspected) => {
        Object.assign(config.extra, { eas: { projectId: PROJECT_ID } })
      },
      'extra.eas',
    ],
    [
      'e2e 에 다른 변형의 scheme 이 들어 있다',
      'e2e' as const,
      null,
      (config: Introspected) => {
        const [application] = config._internal.modResults.android.manifest.manifest.application
        application?.activity[0]?.['intent-filter'].push({
          data: [{ $: { 'android:scheme': 'templateexpo' } }],
        })
      },
      'Android 딥링크 scheme',
    ],
    [
      '앱 설정의 변형이 다르다',
      'production' as const,
      null,
      (config: Introspected) => {
        config.extra.appVariant = 'development'
      },
      'extra.appVariant',
    ],
  ])('%s 면 실패하고 그 자리를 알린다', (_label, variant, projectId, mutate, where) => {
    const result = mutated(variant, projectId, mutate)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain(`- ${where}:`)
  })

  it('변형을 주지 않으면 사용법을 알리고 실패한다', () => {
    const result = check([], '{}')
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('사용법')
  })

  it('목록 밖의 변형이나 UUID 가 아닌 프로젝트 id 는 실패한다', () => {
    expect(check(['staging'], '{}').stderr).toContain('APP_VARIANT must be one of')
    expect(check(['preview', 'probe'], '{}').stderr).toContain('EAS_PROJECT_ID must be a UUID')
  })

  it('JSON 이 아니면 실패한다', () => {
    const result = check(['preview'], 'probe')
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('설정 JSON 을 읽지 못했다')
  })
})
```

- [ ] **Step 2: 시험이 실패하는 것을 본다**

```bash
timeout 300 pnpm exec vitest run test/unit/scripts/check-variant-config.test.ts 2>&1 | grep -E "Test Files|Tests "
```

Expected: `Test Files  1 failed (1)`·`Tests  22 failed (22)` - 검사기가 없어 node 가 `Cannot find module` 로 끝난다(맞는 설정의 여덟도, 어긋난 표본의 열도 기대한 문구를 보지 못한다 - 실패 출력의 stderr 에 그 문구가 보인다).

- [ ] **Step 3: 검사기를 쓴다**

`scripts/check-variant-config.mjs` 를 만든다:

```js
/**
 * 변형별 설정을 검사한다(스펙 10.2·10.6, 15장 단계 6). 게이트 [8] 이 변형마다 부른다.
 *
 *   APP_VARIANT=<변형> EAS_PROJECT_ID=<id 또는 빈 값> BACKEND_URL=<주소> \
 *     pnpm exec expo config --type introspect --json |
 *     node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/check-variant-config.mjs <변형> [<id>]
 *
 * `expo config --type introspect` 는 빌드하지 않고 설정 플러그인을 돌려, 네이티브 설정(AndroidManifest.xml·
 * strings.xml·Info.plist·Expo.plist)에 들어갈 값을 `_internal.modResults` 에 낸다. 이 스크립트는 그 값이 변형
 * 표(lib/config/app-variant.ts)와 OTA 판단(lib/config/updates.ts)이 정한 것과 같은지 본다 - 식별자·scheme·앱
 * 이름, 평문 HTTP, OTA(켬·끔, 주소, 채널, 확인 시점, runtime version 정책), EAS 프로젝트 id. 표의 값 자체는 단위
 * 시험이 잰다. 여기서 재는 것은 Expo CLI 가 평가하고 플러그인이 옮긴 최종 값이 표와 같은가다 - 플러그인이
 * 빠지거나 값을 덮으면, .env 의 값이 섞이면 여기서 드러난다.
 *
 * 기대값은 app.config.ts 와 같은 판단에서 가져온다 - app.config.ts 처럼 Node 의 type stripping 으로 `.ts` 를
 * 불러온다(lib/config/AGENTS.md). package.json 에 "type" 이 없어 Node 가 그 `.ts` 를 ES 모듈로 다시 읽으며 경고를
 * 내므로 게이트는 그 경고 하나를 끈다(--disable-warning). 기대하는 변형과 EAS 프로젝트 id 는 환경 변수가 아니라
 * 인자로 받는다 - 설정을 평가한 환경을 그대로 믿으면 섞인 값도 통과한다. 종료 코드: 0 = 통과, 1 = 위반(무엇이
 * 틀렸는지 stderr 에 전부 적는다).
 */
import { readFileSync } from 'node:fs'

import { BASE_APP_ID, BASE_NAME, BASE_SCHEME } from '../app.config.ts'
import { parseAppVariant, variantProfile } from '../lib/config/app-variant.ts'
import { easProjectId, updatesConfig } from '../lib/config/updates.ts'

/** fingerprint 정책의 runtime version 은 빌드할 때 계산된다 - 그 전의 네이티브 설정에는 이 표식이 들어간다. */
const FINGERPRINT_SENTINEL = 'file:fingerprint'

const USAGE =
  '사용법: node scripts/check-variant-config.mjs <변형> [<EAS 프로젝트 id>] < expo config --type introspect --json 의 출력'

function main() {
  const [variantArg, projectArg = ''] = process.argv.slice(2)
  if (variantArg === undefined || variantArg.trim() === '') {
    console.error(USAGE)
    return 1
  }
  let variant
  let projectId
  try {
    variant = parseAppVariant(variantArg)
    projectId = easProjectId({ EAS_PROJECT_ID: projectArg })
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    return 1
  }

  let config
  try {
    config = JSON.parse(readFileSync(0, 'utf8'))
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    console.error(`설정 JSON 을 읽지 못했다 (${reason}) - ${USAGE}`)
    return 1
  }

  const profile = variantProfile(variant)
  const updates = updatesConfig(variant, projectId)
  const appId = `${BASE_APP_ID}${profile.idSuffix}`
  const scheme = `${BASE_SCHEME}${profile.schemeSuffix}`
  const runtimeVersion = updates.enabled ? FINGERPRINT_SENTINEL : undefined

  const problems = []
  let checks = 0
  const expectValue = (label, actual, expected) => {
    checks += 1
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      problems.push(`${label}: ${JSON.stringify(actual)} - 기대한 값은 ${JSON.stringify(expected)}`)
    }
  }

  // 공개 설정 - 앱이 Constants.expoConfig 로 읽는 값
  expectValue('extra.appVariant', config?.extra?.appVariant, variant)
  expectValue('extra.eas', config?.extra?.eas, projectId === null ? undefined : { projectId })

  // Android - AndroidManifest.xml 과 strings.xml 이 될 값
  const android = config?._internal?.modResults?.android
  const application = android?.manifest?.manifest?.application?.[0]
  const metaData = new Map(
    (application?.['meta-data'] ?? []).map((item) => [
      item?.$?.['android:name'],
      item?.$?.['android:value'],
    ]),
  )
  const strings = new Map(
    (android?.strings?.resources?.string ?? []).map((item) => [item?.$?.name, item?._]),
  )
  const androidSchemes = (application?.activity ?? [])
    .flatMap((activity) => activity?.['intent-filter'] ?? [])
    .flatMap((filter) => filter?.data ?? [])
    .map((data) => data?.$?.['android:scheme'])
    .filter((value) => value !== undefined)

  expectValue('Android 패키지', config?.android?.package, appId)
  expectValue('Android 앱 이름', strings.get('app_name'), `${BASE_NAME}${profile.nameSuffix}`)
  expectValue('Android 딥링크 scheme', androidSchemes, [scheme])
  expectValue(
    'Android 평문 HTTP(usesCleartextTraffic)',
    application?.$?.['android:usesCleartextTraffic'],
    String(profile.allowCleartext),
  )
  expectValue(
    'Android OTA(expo.modules.updates.ENABLED)',
    metaData.get('expo.modules.updates.ENABLED'),
    String(updates.enabled),
  )
  expectValue(
    'Android OTA 주소',
    metaData.get('expo.modules.updates.EXPO_UPDATE_URL'),
    updates.enabled ? updates.url : undefined,
  )
  expectValue(
    'Android OTA 채널',
    metaData.get('expo.modules.updates.UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY'),
    updates.enabled ? JSON.stringify(updates.requestHeaders) : undefined,
  )
  expectValue('Android runtime version', strings.get('expo_runtime_version'), runtimeVersion)
  if (updates.enabled) {
    expectValue(
      'Android OTA 확인 시점',
      metaData.get('expo.modules.updates.EXPO_UPDATES_CHECK_ON_LAUNCH'),
      'ALWAYS',
    )
    expectValue(
      'Android OTA 기다림',
      metaData.get('expo.modules.updates.EXPO_UPDATES_LAUNCH_WAIT_MS'),
      '0',
    )
  }

  // iOS - Info.plist 와 Expo.plist 가 될 값
  const ios = config?._internal?.modResults?.ios
  const expoPlist = ios?.expoPlist ?? {}
  const iosSchemes = (ios?.infoPlist?.CFBundleURLTypes ?? []).flatMap(
    (type) => type?.CFBundleURLSchemes ?? [],
  )

  expectValue('iOS 번들 ID', config?.ios?.bundleIdentifier, appId)
  // Expo 는 번들 ID 도 URL scheme 으로 더한다.
  expectValue('iOS URL scheme', iosSchemes, [scheme, appId])
  expectValue(
    'iOS 평문 HTTP(NSAllowsLocalNetworking)',
    ios?.infoPlist?.NSAppTransportSecurity?.NSAllowsLocalNetworking,
    profile.allowCleartext,
  )
  expectValue('iOS OTA(EXUpdatesEnabled)', expoPlist.EXUpdatesEnabled, updates.enabled)
  expectValue('iOS OTA 주소', expoPlist.EXUpdatesURL, updates.enabled ? updates.url : undefined)
  expectValue(
    'iOS OTA 채널',
    expoPlist.EXUpdatesRequestHeaders,
    updates.enabled ? updates.requestHeaders : undefined,
  )
  expectValue('iOS runtime version', expoPlist.EXUpdatesRuntimeVersion, runtimeVersion)
  if (updates.enabled) {
    expectValue('iOS OTA 확인 시점', expoPlist.EXUpdatesCheckOnLaunch, 'ALWAYS')
    expectValue('iOS OTA 기다림', expoPlist.EXUpdatesLaunchWaitMs, 0)
  }

  const target = `${variant}${projectId === null ? '' : ` + EAS 프로젝트 ${projectId}`}`
  if (problems.length > 0) {
    console.error(`변형 설정 위반 ${problems.length}건 (${target}):`)
    for (const problem of problems) console.error(`- ${problem}`)
    return 1
  }
  const ota = updates.enabled ? `켬(채널 ${updates.requestHeaders['expo-channel-name']})` : '끔'
  console.log(`변형 설정 통과: ${target} - ${checks}건, OTA ${ota}`)
  return 0
}

// process.exit 로 끊지 않는다 - 표준 입력을 연 채 끊으면 Windows 의 Node 가 libuv 단언으로 죽는다(종료 코드 127).
process.exitCode = main()
```

- [ ] **Step 4: 시험이 통과하는 것을 본다**

```bash
timeout 300 pnpm exec vitest run test/unit/scripts/check-variant-config.test.ts 2>&1 | grep -E "Test Files|Tests "
```

Expected: `Tests  22 passed (22)`.

- [ ] **Step 5: 게이트의 [8] 을 바꾼다**

`scripts/check.sh` — Edit, 찾을 것:

```bash
GATE_BACKEND_URL='https://gate-check.invalid'
```

바꿀 것:

```bash
GATE_BACKEND_URL='https://gate-check.invalid'
# [8] 이 OTA 를 켠 설정을 잴 때 쓰는 EAS 프로젝트 id. 모양만 UUID 이고 어떤 프로젝트도 아니다 - 설정 평가는 EAS 에
# 닿지 않는다.
GATE_EAS_PROJECT_ID='00000000-0000-4000-8000-000000000000'
```

같은 파일에 Edit, 찾을 것:

```bash
echo "=== [8/13] 설정 ==="
for variant in development preview production e2e; do
  echo "--- APP_VARIANT=$variant"
  APP_VARIANT="$variant" BACKEND_URL="$GATE_BACKEND_URL" pnpm exec expo config --type public --json >/dev/null
done
```

바꿀 것:

```bash
# 변형 넷을 EAS 프로젝트가 없을 때와 있을 때(GATE_EAS_PROJECT_ID)로 평가하고, 설정 플러그인이 네이티브 설정으로
# 옮길 값(introspect)이 변형 표·OTA 판단(lib/config)과 같은지 검사기가 본다 - 식별자·scheme·앱 이름, 평문 HTTP,
# OTA(스펙 10.2·10.6). Expo CLI 는 .env 를 읽으므로 프로젝트 id 두 자리를 빈 값으로도 명시한다 - 개발자의 .env 에
# 있는 EAS_PROJECT_ID 가 섞이면 검사기가 잡는다. --disable-warning 은 검사기가 app.config.ts·lib/config 를 type
# stripping 으로 불러올 때 Node 가 내는 모듈 형식 경고 하나를 끈다(scripts/check-variant-config.mjs 머리말).
echo "=== [8/13] 설정 ==="
for variant in development preview production e2e; do
  for project in '' "$GATE_EAS_PROJECT_ID"; do
    echo "--- APP_VARIANT=$variant EAS_PROJECT_ID=${project:-(없음)}"
    APP_VARIANT="$variant" BACKEND_URL="$GATE_BACKEND_URL" EAS_PROJECT_ID="$project" EAS_BUILD_PROJECT_ID='' \
      pnpm exec expo config --type introspect --json |
      node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/check-variant-config.mjs "$variant" "$project"
  done
done
```

- [ ] **Step 6: [8] 만 떼어 돌려 통과·`.env`·어긋남을 본다**

(a) 통과. 게이트 전체(E2E 까지 30분 넘게)는 Task 4 가 한 번 돈다 - 여기서는 [8] 블록만 떼어 돈다:

```bash
bash -n scripts/check.sh && echo "syntax ok"
{ echo 'set -euo pipefail'; grep -E "^GATE_(BACKEND_URL|EAS_PROJECT_ID)=" scripts/check.sh; sed -n '/^echo "=== \[8\/13\] 설정 ==="/,/^done$/p' scripts/check.sh; } > .maestro-output/d6-gate-step8.sh
timeout 300 bash .maestro-output/d6-gate-step8.sh > .maestro-output/d6-step8.log 2>&1; echo "exit=$?"
cat .maestro-output/d6-step8.log
```

Expected: `syntax ok`, `exit=0`, 그리고 아래 열일곱 줄(스크래치에서 8초) - 이 블록을 Step 7 의 기록에 붙인다:

```text
=== [8/13] 설정 ===
--- APP_VARIANT=development EAS_PROJECT_ID=(없음)
변형 설정 통과: development - 17건, OTA 끔
--- APP_VARIANT=development EAS_PROJECT_ID=00000000-0000-4000-8000-000000000000
변형 설정 통과: development + EAS 프로젝트 00000000-0000-4000-8000-000000000000 - 17건, OTA 끔
--- APP_VARIANT=preview EAS_PROJECT_ID=(없음)
변형 설정 통과: preview - 17건, OTA 끔
--- APP_VARIANT=preview EAS_PROJECT_ID=00000000-0000-4000-8000-000000000000
변형 설정 통과: preview + EAS 프로젝트 00000000-0000-4000-8000-000000000000 - 21건, OTA 켬(채널 preview)
--- APP_VARIANT=production EAS_PROJECT_ID=(없음)
변형 설정 통과: production - 17건, OTA 끔
--- APP_VARIANT=production EAS_PROJECT_ID=00000000-0000-4000-8000-000000000000
변형 설정 통과: production + EAS 프로젝트 00000000-0000-4000-8000-000000000000 - 21건, OTA 켬(채널 production)
--- APP_VARIANT=e2e EAS_PROJECT_ID=(없음)
변형 설정 통과: e2e - 17건, OTA 끔
--- APP_VARIANT=e2e EAS_PROJECT_ID=00000000-0000-4000-8000-000000000000
변형 설정 통과: e2e + EAS 프로젝트 00000000-0000-4000-8000-000000000000 - 17건, OTA 끔
```

`변형 설정 위반` 이 나오면 그 자리를 본다 - 검사기의 경로(introspect 의 모양)가 틀렸는지, 설정이 틀렸는지. 검사기가 틀렸으면 고치고 Step 4 부터 다시 돈다. 설정이 틀렸으면 Task 1 의 코드로 돌아간다.

(b) `.env` 가 섞이지 않는다. 저장소에 `.env` 가 이미 있으면(개발자의 것) 건드리지 않고 건너뛴다:

```bash
if [ -e .env ]; then echo ".env 가 이미 있다 - 건너뛴다"; else printf 'EAS_PROJECT_ID=0f6b3c1e-2a4d-4e8f-9b1a-7c5d3e2f1a0b\n' > .env; timeout 300 bash .maestro-output/d6-gate-step8.sh > .maestro-output/d6-step8-env.log 2>&1; echo "exit=$?"; rm -f .env; grep -c "변형 설정 통과" .maestro-output/d6-step8-env.log; fi
test -e .env && echo ".env 남음" || echo ".env 없음"
```

Expected: `exit=0`, `8`, `.env 없음`(건너뛰었으면 `.env 가 이미 있다 - 건너뛴다` 와 그 파일 - 기록에 그렇게 적는다).

(c) 어긋남을 잡는다. `app.config.ts` 의 평문 HTTP 를 모든 변형에서 켜는 변이를 넣고 돌린 뒤 되돌린다:

```bash
node -e "const fs = require('fs'); const f = 'app.config.ts'; const t = fs.readFileSync(f, 'utf8'); const a = 'usesCleartextTraffic: profile.allowCleartext'; if (t.split(a).length !== 2) throw new Error('찾을 것이 한 번 맞지 않는다'); fs.writeFileSync(f, t.replace(a, 'usesCleartextTraffic: true'))"
git diff --stat app.config.ts
timeout 300 bash .maestro-output/d6-gate-step8.sh > .maestro-output/d6-step8-mutant.log 2>&1; echo "exit=$?"
git checkout -- app.config.ts
git status --short app.config.ts
grep -E "위반|^- " .maestro-output/d6-step8-mutant.log
```

Expected: `app.config.ts | 2 +-`, `exit=1`, 되돌린 뒤 바뀐 파일 없음, 그리고 두 줄 - development 둘은 통과하고 preview 에서 멈춘다:

```text
변형 설정 위반 1건 (preview):
- Android 평문 HTTP(usesCleartextTraffic): "true" - 기대한 값은 "false"
```

- [ ] **Step 7: 기록과 문서를 쓴다**

`docs/superpowers/notes/2026-10-01-d6-measurements.md` 끝에 더한다 - 두 블록이 Step 6 의 실제 출력과 다르면 실제 출력으로 바꾸고, (b) 를 건너뛰었으면 그 문장을 "저장소에 개발자의 `.env` 가 있어 재지 않았다" 로 바꾼다:

````markdown

## O3 — 게이트 [8] 이 변형별 네이티브 설정을 검사한다

**명령.** `scripts/check.sh` 의 [8] 블록만 떼어 돌렸다 - 변형 넷을 EAS 프로젝트가 없을 때와 있을 때
(`GATE_EAS_PROJECT_ID`, 모양만 UUID)로 `expo config --type introspect --json` 하고, `scripts/check-variant-config.mjs` 가
설정 플러그인이 옮길 네이티브 값(AndroidManifest.xml·strings.xml·Info.plist·Expo.plist)을 변형 표·OTA 판단과 맞댄다.
여덟 평가가 이 개발 머신에서 10초 안팎이다.

```text
=== [8/13] 설정 ===
--- APP_VARIANT=development EAS_PROJECT_ID=(없음)
변형 설정 통과: development - 17건, OTA 끔
--- APP_VARIANT=development EAS_PROJECT_ID=00000000-0000-4000-8000-000000000000
변형 설정 통과: development + EAS 프로젝트 00000000-0000-4000-8000-000000000000 - 17건, OTA 끔
--- APP_VARIANT=preview EAS_PROJECT_ID=(없음)
변형 설정 통과: preview - 17건, OTA 끔
--- APP_VARIANT=preview EAS_PROJECT_ID=00000000-0000-4000-8000-000000000000
변형 설정 통과: preview + EAS 프로젝트 00000000-0000-4000-8000-000000000000 - 21건, OTA 켬(채널 preview)
--- APP_VARIANT=production EAS_PROJECT_ID=(없음)
변형 설정 통과: production - 17건, OTA 끔
--- APP_VARIANT=production EAS_PROJECT_ID=00000000-0000-4000-8000-000000000000
변형 설정 통과: production + EAS 프로젝트 00000000-0000-4000-8000-000000000000 - 21건, OTA 켬(채널 production)
--- APP_VARIANT=e2e EAS_PROJECT_ID=(없음)
변형 설정 통과: e2e - 17건, OTA 끔
--- APP_VARIANT=e2e EAS_PROJECT_ID=00000000-0000-4000-8000-000000000000
변형 설정 통과: e2e + EAS 프로젝트 00000000-0000-4000-8000-000000000000 - 17건, OTA 끔
```

17건은 OTA 를 끈 설정의 자리(식별자·scheme·앱 이름·평문 HTTP·OTA 끔과 주소·채널·runtime version 없음, Android·iOS),
21건은 켠 설정에 확인 시점(`ALWAYS` - `ON_LOAD` 의 네이티브 값)과 기다림(0)이 두 플랫폼에서 더해진 것이다.

**`.env` 가 섞이지 않는다.** 저장소 루트에 `EAS_PROJECT_ID` 를 둔 `.env` 를 만들고 같은 블록을 돌려도 여덟이
통과했다 - Expo CLI 는 `.env` 를 읽지만 블록이 두 자리를 빈 값으로 명시해 덮는다(만든 `.env` 는 지웠다). 명시가
빠지면 검사기가 `extra.eas` 로 잡는다 - `test/unit/scripts/check-variant-config.test.ts` 의 ".env 의 EAS 프로젝트 id
가 섞였다" 표본.

**어긋남을 잡는다.** `app.config.ts` 의 `usesCleartextTraffic: profile.allowCleartext` 를 `true` 로 바꾸고 돌리면
development 둘은 통과하고 preview 에서 멈췄다:

```text
변형 설정 위반 1건 (preview):
- Android 평문 HTTP(usesCleartextTraffic): "true" - 기대한 값은 "false"
```

되돌린 뒤 여덟이 다시 통과했다. 검사기의 자리마다 어긋난 표본이 실패하는 것은
`test/unit/scripts/check-variant-config.test.ts` 가 잰다.
````

루트 `AGENTS.md` — Edit, 찾을 것:

```markdown
번들 단계는 `expo export --clear`라서
```

바꿀 것:

```markdown
설정 단계 [8]은 네 변형을 EAS 프로젝트가 없을 때와 있을 때(가짜 id)로 평가해, 설정 플러그인이 네이티브 설정으로
옮길 값(`expo config --type introspect`)이 변형 표·OTA 판단(`lib/config/`)과 같은지 `scripts/check-variant-config.mjs`로
본다. Expo CLI는 `.env`를 읽으므로 그 단계는 `EAS_PROJECT_ID`를 빈 값으로도 명시한다.

번들 단계는 `expo export --clear`라서
```

같은 파일에 Edit, 찾을 것:

```markdown
(`scripts/check-provenance.mjs`는 `node`가
부르므로 `100644`가 맞다)
```

바꿀 것:

```markdown
(`scripts/check-provenance.mjs`·
`scripts/check-variant-config.mjs`는 `node`가 부르므로 `100644`가 맞다)
```

`lib/config/AGENTS.md` — Edit, 찾을 것:

```markdown
`test/unit/config/eas-json.test.ts`가 맞댄다.
```

바꿀 것:

```markdown
`test/unit/config/eas-json.test.ts`가 맞댄다.

게이트 [8]의 검사기(`scripts/check-variant-config.mjs`)도 `app.config.ts`와 이 디렉터리를 같은 type stripping으로
불러와 기대값을 만든다 - 표를 바꾸면 게이트가 설정 플러그인이 옮길 네이티브 값을 새 표와 맞댄다.
```

스펙 — `## 13. CI (GitHub Actions)` 바로 앞에 더한다:

```markdown
> 정정(2026-10-01, D6): 8단계(설정)는 평가만 하지 않고 검사한다. 네 변형을 EAS 프로젝트가 없을 때와 있을 때(닿지 않는
> 가짜 id)로 `expo config --type introspect` 한다 - 빌드하지 않고 설정 플러그인을 돌려 AndroidManifest.xml·
> strings.xml·Info.plist·Expo.plist 가 될 값을 낸다. 그 값이 변형 표와 OTA 판단(`lib/config/`)이 정한 것과 같은지
> `scripts/check-variant-config.mjs` 가 본다 - 식별자·scheme·앱 이름, 평문 HTTP, OTA(켬·끔, 주소, 채널, 확인 시점,
> runtime version 정책), 프로젝트 id. 여덟 평가가 이 개발 머신에서 10초 안팎이고, 설정에 어긋남을 넣으면 그 자리를
> 알리며 멈춘다(D6 실측 O3).
```

- [ ] **Step 8: 검사하고 커밋한다**

```bash
pnpm format
pnpm typecheck && pnpm lint && pnpm format:check && ./scripts/check-citations.sh app components lib platform queries test
timeout 600 pnpm test 2>&1 | grep -E "Test Files|Tests "
git status --short
git add scripts/check-variant-config.mjs scripts/check.sh test/unit/scripts/check-variant-config.test.ts AGENTS.md lib/config/AGENTS.md docs/superpowers
git status --short
git commit -m "feat: 게이트의 설정 단계가 변형 넷의 네이티브 설정이 될 값을 변형 표와 OTA 판단에 맞대 검사한다"
git ls-tree HEAD scripts/ | grep -E "check(-variant-config\.mjs|\.sh)$"
```

Expected: 검사 전부 exit 0, 단위 시험은 Task 1 의 끝 +22·+1(`a40590a` 위에서 `Test Files  72 passed (72)`·`Tests  1624 passed (1624)`), 커밋 뒤 남은 파일이 없다, `100755 … scripts/check.sh` 와 `100644 … scripts/check-variant-config.mjs`.

---

### Task 3: 빌드 정보 카드 — `lib/updates/build-info.ts`, `platform/updates.ts`, `queries/updates.ts`, 카드와 홈

**Files:**
- Create: `lib/updates/build-info.ts`, `test/unit/updates/build-info.test.ts`, `platform/updates.ts`, `test/unit/platform/updates.test.ts`, `queries/updates.ts`, `test/unit/queries/updates.test.ts`, `components/app/build-info-card.tsx`
- Modify: `app/(app)/index.tsx`(뿌리를 `ScrollView` 로, 카드), `queries/submit-once.ts`(머리말의 쓰는 곳 목록), `AGENTS.md`(표의 `lib/updates/` 행, 트리에 없는 디렉터리의 한 문단), `platform/AGENTS.md`(표의 행, `## 검증` 의 한 문장), `queries/AGENTS.md`(표의 `updates.ts` 행, `submit-once.ts` 행의 쓰는 곳), 스펙(4장·10.6 정정)

**Interfaces:**
- Consumes: Task 1 의 expo-updates 설치, D2 의 `startupVariant()`(`platform/config.ts`)·`SubmitButton`(`components/form/submit-button.tsx`), D4 의 `useSubmitOnce`(`queries/submit-once.ts`)·쓰기 훅의 규칙(옵션을 내보내고 `throwOnError` - `queries/AGENTS.md`), D5 의 홈(`useNavigateOnce` 로 실험실을 여는 `home-lab-link`), `Text`(`variant="large"`).
- Produces: `lib/updates/build-info.ts` - `interface BuildInfo { appVersion: string | null; variant: string; otaEnabled: boolean; runtimeVersion: string | null; channel: string | null; updateId: string | null; embeddedLaunch: boolean }`, `interface BuildInfoRow { key: 'version' | 'variant' | 'ota' | 'runtime' | 'channel' | 'update'; label: string; value: string }`, `NO_VALUE = '없음'`, `buildInfoView(info: BuildInfo): { rows: BuildInfoRow[]; canCheck: boolean }`, `interface UpdatesApi { checkForUpdateAsync: () => Promise<{ isAvailable: boolean; isRollBackToEmbedded: boolean }>; fetchUpdateAsync: () => Promise<{ isNew: boolean; isRollBackToEmbedded: boolean }>; reloadAsync: () => Promise<void> }`, `type UpdateCheckResult = { kind: 'current' } | { kind: 'reloading' } | { kind: 'failed'; message: string }`, `checkAndApplyUpdate(api: UpdatesApi): Promise<UpdateCheckResult>`, `updateCheckView(pending: boolean, result: UpdateCheckResult | undefined): { busy: boolean; message: string | null }`. `platform/updates.ts` - `readBuildInfo(): BuildInfo`, `updatesApi: UpdatesApi`. `queries/updates.ts` - `interface BuildInfoCardState { rows: BuildInfoRow[]; canCheck: boolean; busy: boolean; message: string | null; check: () => void }`, `updateCheckMutationOptions()`(키 `['updates', 'check']`, `throwOnError: true`), `useBuildInfoCard(): BuildInfoCardState`. `components/app/build-info-card.tsx` - `BuildInfoCard(props: BuildInfoCardState)`. testID - `build-info-card`, 행 `build-info-version`·`build-info-variant`·`build-info-ota`·`build-info-runtime`·`build-info-channel`·`build-info-update`, OTA 를 켠 빌드의 `build-info-check`, 끈 빌드의 `build-info-ota-off`, 결과 `build-info-message`. 홈의 `home-screen`·`home-examples-link`·`home-lab-link` 는 그대로다.

- [ ] **Step 1: 판단의 실패하는 시험을 쓴다**

`test/unit/updates/build-info.test.ts` 를 만든다:

```ts
import { describe, expect, it } from 'vitest'

import {
  buildInfoView,
  checkAndApplyUpdate,
  updateCheckView,
  type BuildInfo,
  type UpdatesApi,
} from '@/lib/updates/build-info'

// 실제 빌드의 값이 아니다 - 모양만 흉내 낸 표본이다.
const RUNTIME = 'probe0runtime0fingerprint'
const UPDATE_ID = '0f6b3c1e-2a4d-4e8f-9b1a-7c5d3e2f1a0b'

/** OTA 를 끈 Android 빌드(e2e·development)가 주는 값 - runtime version 과 채널이 빈 문자열이다. */
const OTA_OFF: BuildInfo = {
  appVersion: '0.1.0',
  variant: 'e2e',
  otaEnabled: false,
  runtimeVersion: '',
  channel: '',
  updateId: null,
  embeddedLaunch: false,
}

/** OTA 를 켠 preview 빌드를 설치하고 처음 띄운 값 - 내장 번들로 떴다. */
const PREVIEW_EMBEDDED: BuildInfo = {
  appVersion: '0.1.0',
  variant: 'preview',
  otaEnabled: true,
  runtimeVersion: RUNTIME,
  channel: 'preview',
  updateId: UPDATE_ID,
  embeddedLaunch: true,
}

function values(info: BuildInfo): Record<string, string> {
  return Object.fromEntries(buildInfoView(info).rows.map((row) => [row.key, row.value]))
}

describe('buildInfoView - 스펙 10.6', () => {
  it('행은 앱 버전·변형·OTA·runtime version·채널·업데이트 ID 순서다', () => {
    expect(buildInfoView(OTA_OFF).rows.map((row) => [row.key, row.label])).toEqual([
      ['version', '앱 버전'],
      ['variant', '변형'],
      ['ota', 'OTA'],
      ['runtime', 'runtime version'],
      ['channel', '채널'],
      ['update', '업데이트 ID'],
    ])
  })

  it('OTA 를 끈 빌드는 없는 값을 "없음" 으로 적고 확인 버튼을 두지 않는다', () => {
    expect(values(OTA_OFF)).toEqual({
      version: '0.1.0',
      variant: 'e2e',
      ota: '꺼짐',
      runtime: '없음',
      channel: '없음',
      update: '없음',
    })
    expect(buildInfoView(OTA_OFF).canCheck).toBe(false)
  })

  it('null 인 값도 "없음" 이다', () => {
    expect(
      values({ ...OTA_OFF, appVersion: null, runtimeVersion: null, channel: null }),
    ).toMatchObject({ version: '없음', runtime: '없음', channel: '없음' })
  })

  it('OTA 를 켠 빌드는 채널과 runtime version 을 적고 확인 버튼을 둔다 - 내장 번들이면 그렇다고 적는다', () => {
    expect(values(PREVIEW_EMBEDDED)).toEqual({
      version: '0.1.0',
      variant: 'preview',
      ota: '켜짐',
      runtime: RUNTIME,
      channel: 'preview',
      update: `${UPDATE_ID} (내장 번들)`,
    })
    expect(buildInfoView(PREVIEW_EMBEDDED).canCheck).toBe(true)
  })

  it('받은 업데이트로 떴으면 업데이트 ID 만 적는다', () => {
    expect(values({ ...PREVIEW_EMBEDDED, embeddedLaunch: false }).update).toBe(UPDATE_ID)
  })
})

/** 부른 순서를 적는 가짜 expo-updates. */
function fakeApi(options: {
  check?: { isAvailable: boolean; isRollBackToEmbedded: boolean } | Error
  fetch?: { isNew: boolean; isRollBackToEmbedded: boolean } | Error
  reload?: Error
}): { api: UpdatesApi; calls: string[] } {
  const calls: string[] = []
  const settle = <T>(value: T | Error): Promise<T> =>
    value instanceof Error ? Promise.reject(value) : Promise.resolve(value)
  return {
    calls,
    api: {
      checkForUpdateAsync: () => {
        calls.push('check')
        return settle(options.check ?? { isAvailable: false, isRollBackToEmbedded: false })
      },
      fetchUpdateAsync: () => {
        calls.push('fetch')
        return settle(options.fetch ?? { isNew: true, isRollBackToEmbedded: false })
      },
      reloadAsync: () => {
        calls.push('reload')
        return options.reload === undefined ? Promise.resolve() : Promise.reject(options.reload)
      },
    },
  }
}

describe('checkAndApplyUpdate - 받은 업데이트를 바로 적용한다(스펙 10.6)', () => {
  it('새 업데이트가 있으면 받아서 다시 켠다', async () => {
    const { api, calls } = fakeApi({ check: { isAvailable: true, isRollBackToEmbedded: false } })
    expect(await checkAndApplyUpdate(api)).toEqual({ kind: 'reloading' })
    expect(calls).toEqual(['check', 'fetch', 'reload'])
  })

  it('내장 번들로 되돌리라는 지시도 받아서 다시 켠다', async () => {
    const { api, calls } = fakeApi({
      check: { isAvailable: false, isRollBackToEmbedded: true },
      fetch: { isNew: false, isRollBackToEmbedded: true },
    })
    expect(await checkAndApplyUpdate(api)).toEqual({ kind: 'reloading' })
    expect(calls).toEqual(['check', 'fetch', 'reload'])
  })

  it('없으면 받지 않고 current 다', async () => {
    const { api, calls } = fakeApi({})
    expect(await checkAndApplyUpdate(api)).toEqual({ kind: 'current' })
    expect(calls).toEqual(['check'])
  })

  it('받았는데 새것이 아니면 다시 켜지 않는다', async () => {
    const { api, calls } = fakeApi({
      check: { isAvailable: true, isRollBackToEmbedded: false },
      fetch: { isNew: false, isRollBackToEmbedded: false },
    })
    expect(await checkAndApplyUpdate(api)).toEqual({ kind: 'current' })
    expect(calls).toEqual(['check', 'fetch'])
  })

  it.each([
    ['확인', { check: new Error('probe check failure') }, 'probe check failure', ['check']],
    [
      '받기',
      {
        check: { isAvailable: true, isRollBackToEmbedded: false },
        fetch: new Error('probe fetch failure'),
      },
      'probe fetch failure',
      ['check', 'fetch'],
    ],
    [
      '다시 켜기',
      {
        check: { isAvailable: true, isRollBackToEmbedded: false },
        reload: new Error('probe reload failure'),
      },
      'probe reload failure',
      ['check', 'fetch', 'reload'],
    ],
  ])('%s 가 거절되면 던지지 않고 그 문구로 실패한다', async (_label, options, message, order) => {
    const { api, calls } = fakeApi(options)
    expect(await checkAndApplyUpdate(api)).toEqual({ kind: 'failed', message })
    expect(calls).toEqual(order)
  })

  it('Error 가 아닌 거절도 문구로 바꾼다', async () => {
    const thrown: unknown = 'probe rejection'
    const api: UpdatesApi = {
      checkForUpdateAsync: () =>
        Promise.resolve().then(() => {
          throw thrown
        }),
      fetchUpdateAsync: () => Promise.resolve({ isNew: false, isRollBackToEmbedded: false }),
      reloadAsync: () => Promise.resolve(),
    }
    expect(await checkAndApplyUpdate(api)).toEqual({ kind: 'failed', message: 'probe rejection' })
  })
})

describe('updateCheckView - 로딩은 스피너만(스펙 8.7)', () => {
  it('누르기 전에는 문구가 없다', () => {
    expect(updateCheckView(false, undefined)).toEqual({ busy: false, message: null })
  })

  it('도는 동안과 다시 켜는 동안은 스피너만 그린다', () => {
    expect(updateCheckView(true, undefined)).toEqual({ busy: true, message: null })
    expect(updateCheckView(false, { kind: 'reloading' })).toEqual({ busy: true, message: null })
  })

  it('끝난 확인은 결과를 글로 적는다', () => {
    expect(updateCheckView(false, { kind: 'current' })).toEqual({
      busy: false,
      message: '새 업데이트가 없습니다.',
    })
    expect(updateCheckView(false, { kind: 'failed', message: 'probe failure' })).toEqual({
      busy: false,
      message: '업데이트를 확인하지 못했습니다. probe failure',
    })
  })
})
```

```bash
timeout 300 pnpm exec vitest run test/unit/updates 2>&1 | grep -E "Test Files|Cannot find package" | sort -u
```

Expected: `Test Files  1 failed (1)` 과 `Error: Cannot find package '@/lib/updates/build-info' imported from …`.

- [ ] **Step 2: 판단을 쓴다**

`lib/updates/build-info.ts` 를 만든다:

```ts
/**
 * 홈의 빌드 정보 카드 - 스펙 10.6. OTA 가 실제로 도는지 눈으로 확인하는 최소 장치다.
 *
 * 앱 버전·변형·OTA·runtime version·채널·업데이트 ID 를 행으로 만들고, "업데이트 확인" 의 순서(확인 → 받기 →
 * 다시 켜기)와 그 결과의 문구를 정한다. expo-updates·expo-constants 의 값은 platform/updates.ts 가 읽어 넘기고
 * 호출은 주입받는다 - 이 파일은 네이티브 모듈을 모른다(스펙 5장).
 */

/** platform/updates.ts 가 expo-updates·expo-constants 에서 읽은 이 실행의 값. */
export interface BuildInfo {
  /** 앱 버전(Constants.expoConfig.version). */
  appVersion: string | null
  /** 빌드 변형(extra.appVariant). */
  variant: string
  /** OTA 가 켜져 있는가(Updates.isEnabled). */
  otaEnabled: boolean
  /** Updates.runtimeVersion - OTA 를 끈 Android 빌드는 빈 문자열을 준다. */
  runtimeVersion: string | null
  /** Updates.channel - 채널이 없는 빌드는 null 이나 빈 문자열이다. */
  channel: string | null
  /** 지금 도는 업데이트의 id(Updates.updateId). OTA 를 끈 빌드는 null 이다. */
  updateId: string | null
  /** 앱에 들어 있던 번들로 떴는가(Updates.isEmbeddedLaunch). */
  embeddedLaunch: boolean
}

/** 카드의 한 줄. key 는 testID(`build-info-<key>`)의 끝이다 - E2E 가 찾는다. */
export interface BuildInfoRow {
  key: 'version' | 'variant' | 'ota' | 'runtime' | 'channel' | 'update'
  label: string
  value: string
}

/** 값이 없는 자리의 표시. */
export const NO_VALUE = '없음'

function shown(value: string | null): string {
  return value === null || value.trim() === '' ? NO_VALUE : value
}

/** 카드의 행과, "업데이트 확인" 을 누를 수 있는가(OTA 를 끈 빌드는 확인할 업데이트가 없다). */
export function buildInfoView(info: BuildInfo): { rows: BuildInfoRow[]; canCheck: boolean } {
  const updateId = shown(info.updateId)
  return {
    rows: [
      { key: 'version', label: '앱 버전', value: shown(info.appVersion) },
      { key: 'variant', label: '변형', value: info.variant },
      { key: 'ota', label: 'OTA', value: info.otaEnabled ? '켜짐' : '꺼짐' },
      { key: 'runtime', label: 'runtime version', value: shown(info.runtimeVersion) },
      { key: 'channel', label: '채널', value: shown(info.channel) },
      {
        key: 'update',
        label: '업데이트 ID',
        value: info.embeddedLaunch && updateId !== NO_VALUE ? `${updateId} (내장 번들)` : updateId,
      },
    ],
    canCheck: info.otaEnabled,
  }
}

/** expo-updates 의 세 호출 가운데 여기서 읽는 자리 - platform/updates.ts 가 넘긴다. */
export interface UpdatesApi {
  checkForUpdateAsync: () => Promise<{ isAvailable: boolean; isRollBackToEmbedded: boolean }>
  fetchUpdateAsync: () => Promise<{ isNew: boolean; isRollBackToEmbedded: boolean }>
  reloadAsync: () => Promise<void>
}

/** "업데이트 확인" 의 결과. */
export type UpdateCheckResult =
  /** 받을 것이 없다. */
  | { kind: 'current' }
  /** 받았고 다시 켠다 - 앱이 곧 새 번들로 다시 뜬다. */
  | { kind: 'reloading' }
  /** 확인·받기·다시 켜기 가운데 하나가 거절됐다. */
  | { kind: 'failed'; message: string }

/**
 * 서버에 새 업데이트(또는 내장 번들로 되돌리라는 지시)가 있으면 받아서 바로 다시 켠다 - 스펙 10.6 의 "받은
 * 업데이트를 바로 적용한다". 없으면 current 다. 거절은 던지지 않고 결과로 돌려준다 - 화면이 문구로 그린다.
 * 켤 때의 자동 확인(ON_LOAD)이 이미 받아 둔 업데이트도 확인이 다시 알리고 받기가 곧바로 끝난다.
 */
export async function checkAndApplyUpdate(api: UpdatesApi): Promise<UpdateCheckResult> {
  try {
    const check = await api.checkForUpdateAsync()
    if (!check.isAvailable && !check.isRollBackToEmbedded) return { kind: 'current' }
    const fetched = await api.fetchUpdateAsync()
    if (!fetched.isNew && !fetched.isRollBackToEmbedded) return { kind: 'current' }
    await api.reloadAsync()
    return { kind: 'reloading' }
  } catch (error) {
    return { kind: 'failed', message: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * 확인 버튼과 결과 문구. 도는 동안과 다시 켜는 동안은 버튼이 스피너만 그린다 - 로딩에 글자를 쓰지 않는다(스펙
 * 8.7). 결과는 확인이 끝난 뒤에만 글로 적는다.
 */
export function updateCheckView(
  pending: boolean,
  result: UpdateCheckResult | undefined,
): { busy: boolean; message: string | null } {
  if (pending || result?.kind === 'reloading') return { busy: true, message: null }
  if (result === undefined) return { busy: false, message: null }
  if (result.kind === 'current') return { busy: false, message: '새 업데이트가 없습니다.' }
  return { busy: false, message: `업데이트를 확인하지 못했습니다. ${result.message}` }
}
```

```bash
timeout 300 pnpm exec vitest run test/unit/updates 2>&1 | grep -E "Test Files|Tests "
```

Expected: `Tests  16 passed (16)`.

- [ ] **Step 3: 배선과 쓰기 옵션의 실패하는 시험을 쓴다**

D4·D5 의 쓰기 훅처럼 훅이 쓰는 옵션을 내보내 MutationObserver 로 돌리고(`queries/AGENTS.md` - 새 쓰기 훅도 `throwOnError` 를 준다), `platform/` 의 배선은 기기 모듈을 `vi.mock` 으로 바꿔 잰다(`platform/AGENTS.md` 의 `## 검증`, 결정 22). `test/unit/platform/updates.test.ts` 를 만든다:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AppVariant } from '@/lib/config/app-variant'
import { readBuildInfo, updatesApi } from '@/platform/updates'

/**
 * platform/updates.ts 의 배선(스펙 10.6). 행·확인의 순서·문구의 판단은 test/unit/updates/build-info.test.ts 가 재고,
 * 여기서는 expo-updates·expo-constants 의 값을 빌드 정보로 **옮기는지**와 세 호출을 그대로 넘기는지를 잰다 - 옮기는
 * 자리가 바뀌면(예: 업데이트 ID 와 runtime version 이 엇갈리면) 판단의 시험은 모두 통과하고 카드만 틀린다. OTA 를
 * 켠 빌드의 값은 계정이 필요한 실증(스펙 15장 9단계) 전에는 기기에서 볼 길이 없어 여기서 잰다.
 *
 * 기기 모듈(expo-updates·expo-constants)과 설정 자리(platform/config.ts)는 가짜로 바꾼다.
 */
/** 시험마다 바꿔 끼우는 expo-updates 의 상수. */
interface UpdatesConstants {
  isEnabled: boolean
  runtimeVersion: string | null
  channel: string | null
  updateId: string | null
  isEmbeddedLaunch: boolean
}

/** 시험마다 바꿔 끼우는 expo-constants 의 값. */
interface ConstantsModule {
  expoConfig: { version?: string } | null
}

const ENABLED: UpdatesConstants = {
  isEnabled: true,
  runtimeVersion: 'probe-runtime',
  channel: 'probe-channel',
  updateId: 'probe-update',
  isEmbeddedLaunch: false,
}

const mocks = vi.hoisted(() => {
  const values: UpdatesConstants = {
    isEnabled: true,
    runtimeVersion: null,
    channel: null,
    updateId: null,
    isEmbeddedLaunch: false,
  }
  const constants: ConstantsModule = { expoConfig: null }
  return {
    updates: {
      ...values,
      checkForUpdateAsync:
        vi.fn<() => Promise<{ isAvailable: boolean; isRollBackToEmbedded: boolean }>>(),
      fetchUpdateAsync: vi.fn<() => Promise<{ isNew: boolean; isRollBackToEmbedded: boolean }>>(),
      reloadAsync: vi.fn<() => Promise<void>>(),
    },
    constants,
    startupVariant: vi.fn<() => AppVariant>(),
  }
})

vi.mock('expo-updates', () => mocks.updates)
vi.mock('expo-constants', () => ({ default: mocks.constants }))
vi.mock('@/platform/config', () => ({ startupVariant: mocks.startupVariant }))

beforeEach(() => {
  Object.assign(mocks.updates, ENABLED)
  mocks.constants.expoConfig = { version: '9.8.7' }
  mocks.startupVariant.mockReset().mockReturnValue('preview')
})

describe('readBuildInfo - expo-updates·expo-constants 의 값을 옮긴다', () => {
  it('자리마다 제 값을 옮긴다', () => {
    expect(readBuildInfo()).toEqual({
      appVersion: '9.8.7',
      variant: 'preview',
      otaEnabled: true,
      runtimeVersion: 'probe-runtime',
      channel: 'probe-channel',
      updateId: 'probe-update',
      embeddedLaunch: false,
    })
  })

  it('내장 번들로 떴는가와 OTA 여부를 옮긴다', () => {
    Object.assign(mocks.updates, { isEnabled: false, isEmbeddedLaunch: true })
    expect(readBuildInfo()).toMatchObject({ otaEnabled: false, embeddedLaunch: true })
  })

  it('앱 설정이 없으면 앱 버전은 null 이다', () => {
    mocks.constants.expoConfig = null
    expect(readBuildInfo().appVersion).toBeNull()
  })
})

describe('updatesApi - expo-updates 의 세 호출을 그대로 넘긴다', () => {
  it('확인·받기·다시 켜기가 expo-updates 의 함수를 부른다', async () => {
    mocks.updates.checkForUpdateAsync.mockResolvedValue({
      isAvailable: false,
      isRollBackToEmbedded: false,
    })
    mocks.updates.fetchUpdateAsync.mockResolvedValue({ isNew: true, isRollBackToEmbedded: false })
    mocks.updates.reloadAsync.mockResolvedValue(undefined)

    expect(await updatesApi.checkForUpdateAsync()).toEqual({
      isAvailable: false,
      isRollBackToEmbedded: false,
    })
    expect(await updatesApi.fetchUpdateAsync()).toEqual({
      isNew: true,
      isRollBackToEmbedded: false,
    })
    await updatesApi.reloadAsync()
    expect(mocks.updates.checkForUpdateAsync).toHaveBeenCalledTimes(1)
    expect(mocks.updates.fetchUpdateAsync).toHaveBeenCalledTimes(1)
    expect(mocks.updates.reloadAsync).toHaveBeenCalledTimes(1)
  })
})
```

`test/unit/queries/updates.test.ts` 를 만든다:

```ts
import { MutationObserver, QueryClient, shouldThrowError } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { updateCheckMutationOptions } from '@/queries/updates'

/**
 * "업데이트 확인" 의 쓰기 옵션(queries/updates.ts) - 훅과 시험이 함께 쓴다. TanStack Query 의 MutationObserver 로
 * 그대로 돌려 두 가지를 잰다: 훅이 꽂는 expo-updates 의 세 호출(platform/updates.ts 의 `updatesApi`)의 배선과,
 * 던져진 것이 오류 경계로 가는지(`throwOnError`). 훅 자체는 시험하지 않는다(스펙 11.1). 확인의 갈래는
 * test/unit/updates/build-info.test.ts 가 잰다.
 */
const mocks = vi.hoisted(() => ({
  checkForUpdateAsync:
    vi.fn<() => Promise<{ isAvailable: boolean; isRollBackToEmbedded: boolean }>>(),
  fetchUpdateAsync: vi.fn<() => Promise<{ isNew: boolean; isRollBackToEmbedded: boolean }>>(),
  reloadAsync: vi.fn<() => Promise<void>>(),
}))

vi.mock('@/platform/updates', () => ({
  updatesApi: {
    checkForUpdateAsync: mocks.checkForUpdateAsync,
    fetchUpdateAsync: mocks.fetchUpdateAsync,
    reloadAsync: mocks.reloadAsync,
  },
  readBuildInfo: vi.fn(),
}))

let client: QueryClient

beforeEach(() => {
  client = new QueryClient()
  mocks.checkForUpdateAsync
    .mockReset()
    .mockResolvedValue({ isAvailable: true, isRollBackToEmbedded: false })
  mocks.fetchUpdateAsync.mockReset().mockResolvedValue({ isNew: true, isRollBackToEmbedded: false })
  mocks.reloadAsync.mockReset().mockResolvedValue(undefined)
})

afterEach(() => {
  client.clear()
  vi.restoreAllMocks()
})

/** 확인을 한 번 돌려 상태와 결과와 오류를 돌려준다. */
async function run() {
  const observer = new MutationObserver(client, updateCheckMutationOptions())
  await observer.mutate().catch(() => undefined)
  return observer.getCurrentResult()
}

describe('업데이트 확인의 쓰기 옵션 - 스펙 10.6', () => {
  it('expo-updates 의 세 호출을 차례로 부르고 결과를 값으로 돌려준다 - 키는 하나다', async () => {
    const { status, data } = await run()

    expect(status).toBe('success')
    expect(data).toEqual({ kind: 'reloading' })
    expect(mocks.checkForUpdateAsync).toHaveBeenCalledTimes(1)
    expect(mocks.fetchUpdateAsync).toHaveBeenCalledTimes(1)
    expect(mocks.reloadAsync).toHaveBeenCalledTimes(1)
    expect(updateCheckMutationOptions().mutationKey).toEqual(['updates', 'check'])
  })

  it('expo-updates 의 거절은 오류가 아니라 결과 값이다 - 카드가 문구로 그린다', async () => {
    mocks.checkForUpdateAsync.mockRejectedValue(new Error('probe-rejection'))

    const { status, data, error } = await run()

    expect(status).toBe('success')
    expect(data).toEqual({ kind: 'failed', message: 'probe-rejection' })
    expect(error).toBeNull()
    expect(mocks.fetchUpdateAsync).not.toHaveBeenCalled()
  })

  it('던져진 것은 결함이다 - 렌더 중에 다시 던져 오류 경계로 간다(throwOnError)', () => {
    // `useMutation` 이 렌더 중에 하는 판단 그대로다 - 거짓이면 오류는 `mutate()` 가 삼킨다.
    expect(
      shouldThrowError(updateCheckMutationOptions().throwOnError, [new Error('probe-defect')]),
    ).toBe(true)
  })
})
```

```bash
timeout 300 pnpm exec vitest run test/unit/platform/updates.test.ts test/unit/queries/updates.test.ts 2>&1 | grep -E "Test Files|Cannot find package" | sed -E 's/ imported from.*//' | sort -u
```

Expected: `Test Files  2 failed (2)`, `Error: Cannot find package '@/platform/updates'`, `Error: Cannot find package '@/queries/updates'`.

- [ ] **Step 4: 호출과 훅을 쓴다**

`platform/updates.ts` 를 만든다:

```ts
import Constants from 'expo-constants'
import * as Updates from 'expo-updates'

import type { BuildInfo, UpdatesApi } from '@/lib/updates/build-info'
import { startupVariant } from '@/platform/config'

/**
 * expo-updates·expo-constants 를 부르는 자리 - 홈의 빌드 정보 카드(스펙 10.6). 판단(행, 확인 순서, 문구)은
 * lib/updates/build-info.ts 에 있고 여기서는 값을 읽고 호출을 넘기기만 한다.
 */

/** 이 실행의 빌드 정보. 앱이 떠 있는 동안 바뀌지 않는다 - 받은 업데이트는 다시 켜야 적용된다. */
export function readBuildInfo(): BuildInfo {
  return {
    appVersion: Constants.expoConfig?.version ?? null,
    variant: startupVariant(),
    otaEnabled: Updates.isEnabled,
    runtimeVersion: Updates.runtimeVersion,
    channel: Updates.channel,
    updateId: Updates.updateId,
    embeddedLaunch: Updates.isEmbeddedLaunch,
  }
}

/** "업데이트 확인" 이 부르는 expo-updates 의 세 호출(queries/updates.ts). */
export const updatesApi: UpdatesApi = {
  checkForUpdateAsync: () => Updates.checkForUpdateAsync(),
  fetchUpdateAsync: () => Updates.fetchUpdateAsync(),
  reloadAsync: () => Updates.reloadAsync(),
}
```

`queries/updates.ts` 를 만든다:

```ts
import { mutationOptions, useMutation } from '@tanstack/react-query'

import {
  buildInfoView,
  checkAndApplyUpdate,
  updateCheckView,
  type BuildInfoRow,
} from '@/lib/updates/build-info'
import { readBuildInfo, updatesApi } from '@/platform/updates'
import { useSubmitOnce } from '@/queries/submit-once'

/** 홈의 빌드 정보 카드가 그리는 것(components/app/build-info-card.tsx). */
export interface BuildInfoCardState {
  rows: BuildInfoRow[]
  /** "업데이트 확인" 을 누를 수 있다 - OTA 를 끈 빌드는 안내만 그린다. */
  canCheck: boolean
  /** 확인하거나 다시 켜는 중 - 버튼이 스피너만 그린다. */
  busy: boolean
  /** 끝난 확인의 결과 문구. */
  message: string | null
  check: () => void
}

/**
 * "업데이트 확인" 의 쓰기 옵션 - 결과를 캐시에 옮기지 않는다. 확인은 결과를 값으로 돌려준다
 * (`checkAndApplyUpdate` 는 expo-updates 의 거절까지 `failed` 로 담는다) - 그래서 `mutationFn` 안에서 던져진 것은
 * 결함이고 오류 경계로 간다(`throwOnError`, queries/AGENTS.md 의 쓰기 오류 규칙). 세션을 쓰지 않으니 세션 거절이
 * 없다 - 쓰기 캐시의 `onError`(인증 오류의 한 곳)에 닿을 것이 없다. 시험(test/unit/queries/updates.test.ts)이
 * MutationObserver 로 그대로 돌린다.
 */
export function updateCheckMutationOptions() {
  return mutationOptions({
    mutationKey: ['updates', 'check'],
    mutationFn: () => checkAndApplyUpdate(updatesApi),
    throwOnError: true,
  })
}

/**
 * 빌드 정보 카드의 훅(스펙 10.6). 행과 확인의 순서·문구는 lib/updates/build-info.ts 가 정하고, 여기서는 그
 * 판단에 expo-updates 의 호출(platform/updates.ts)을 꽂아 쓰기 하나로 돌린다. 결과는 캐시에 두지 않는다 -
 * 누를 때마다 새로 묻는 확인이고, 받은 업데이트가 있으면 앱이 다시 뜬다. 한 번에 하나만 돈다(submit-once.ts).
 */
export function useBuildInfoCard(): BuildInfoCardState {
  const options = updateCheckMutationOptions()
  const mutation = useMutation(options)
  const submitOnce = useSubmitOnce(options.mutationKey)
  const view = buildInfoView(readBuildInfo())

  return {
    ...view,
    ...updateCheckView(mutation.isPending, mutation.data),
    check: () => {
      submitOnce(() => {
        mutation.mutate()
      })
    },
  }
}
```

```bash
timeout 300 pnpm exec vitest run test/unit/platform/updates.test.ts test/unit/queries/updates.test.ts 2>&1 | grep -E "Test Files|Tests "
```

Expected: `Test Files  2 passed (2)`·`Tests  7 passed (7)`(배선 4·옵션 3).

- [ ] **Step 5: 카드와 홈을 쓴다**

`components/app/build-info-card.tsx` 를 만든다:

```tsx
import { View } from 'react-native'

import { SubmitButton } from '@/components/form/submit-button'
import { Text } from '@/components/ui/text'
import type { BuildInfoCardState } from '@/queries/updates'

/**
 * 홈의 빌드 정보 카드(스펙 10.6) - 앱 버전, 변형, OTA, runtime version, 채널, 업데이트 ID 와 "업데이트 확인".
 * 값과 문구는 lib/updates/build-info.ts 가 정했다 - 여기서는 그리기만 한다.
 *
 * testID 는 E2E(test/e2e/flows/home-build-info.yaml)가 찾는 이름이다 - 행은 `build-info-<키>`.
 */
export function BuildInfoCard({ rows, canCheck, busy, message, check }: BuildInfoCardState) {
  return (
    <View testID="build-info-card" className="w-full gap-3 rounded-lg border border-border p-4">
      <Text variant="large">빌드 정보</Text>
      <View className="gap-2">
        {rows.map((row) => (
          <View key={row.key} className="flex-row items-start justify-between gap-4">
            <Text className="text-sm text-muted-foreground">{row.label}</Text>
            <Text testID={`build-info-${row.key}`} className="flex-1 text-right text-sm" selectable>
              {row.value}
            </Text>
          </View>
        ))}
      </View>
      {canCheck ? (
        <SubmitButton
          testID="build-info-check"
          label="업데이트 확인"
          pending={busy}
          onPress={check}
        />
      ) : (
        <Text testID="build-info-ota-off" className="text-sm text-muted-foreground">
          이 빌드는 OTA 가 꺼져 있어 확인할 업데이트가 없습니다.
        </Text>
      )}
      {message === null ? null : (
        <Text testID="build-info-message" className="text-sm">
          {message}
        </Text>
      )}
    </View>
  )
}
```

홈은 D5 의 판이다 - 실험실 진입이 `useNavigateOnce` 를 지나는 버튼이다(D5 결정 20). 그 버튼과 목록 진입은 그대로 두고 뿌리를 `ScrollView` 로 바꿔 카드를 실험실 진입 아래에 둔다(결정 17). `app/(app)/index.tsx` — Edit, 찾을 것 `import { View } from 'react-native'` — 바꿀 것 `import { ScrollView } from 'react-native'`

같은 파일에 Edit, 찾을 것:

```tsx
import { useNavigateOnce } from '@/components/app/navigate-once'
```

바꿀 것:

```tsx
import { BuildInfoCard } from '@/components/app/build-info-card'
import { useNavigateOnce } from '@/components/app/navigate-once'
```

같은 파일에 Edit, 찾을 것:

```tsx
import { Text } from '@/components/ui/text'
```

바꿀 것:

```tsx
import { Text } from '@/components/ui/text'
import { useBuildInfoCard } from '@/queries/updates'
```

같은 파일에 Edit, 찾을 것:

```tsx
  const navigateOnce = useNavigateOnce()

  return (
    <View
      testID="home-screen"
      className="flex-1 items-center justify-center gap-4 bg-background p-6"
    >
```

바꿀 것:

```tsx
  const navigateOnce = useNavigateOnce()
  const buildInfo = useBuildInfoCard()

  return (
    <ScrollView
      testID="home-screen"
      className="flex-1 bg-background"
      contentContainerClassName="flex-grow items-center justify-center gap-4 p-6"
    >
```

같은 파일에 Edit, 찾을 것:

```tsx
        <Text>계약 실험실</Text>
      </Button>
    </View>
```

바꿀 것:

```tsx
        <Text>계약 실험실</Text>
      </Button>
      <BuildInfoCard {...buildInfo} />
    </ScrollView>
```

대조용이다 - 같지 않으면 위 Edit 가 다른 자리에 들어간 것이다(D5 가 홈을 계획과 다르게 고쳤으면 같은 뜻으로 맞춘다 - 목록·실험실 진입의 testID 와 `navigateOnce` 는 그대로). 고친 뒤의 파일:

```tsx
import { Link, Stack, router } from 'expo-router'
import { ScrollView } from 'react-native'

import { BuildInfoCard } from '@/components/app/build-info-card'
import { useNavigateOnce } from '@/components/app/navigate-once'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { useBuildInfoCard } from '@/queries/updates'

export default function HomeScreen() {
  // 실험실을 쌓는 이동은 한 번만 한다 - 빠른 두 번 누름이 실험실을 두 벌 쌓지 않게(components/app/navigate-once.ts).
  const navigateOnce = useNavigateOnce()
  const buildInfo = useBuildInfoCard()

  return (
    <ScrollView
      testID="home-screen"
      className="flex-1 bg-background"
      contentContainerClassName="flex-grow items-center justify-center gap-4 p-6"
    >
      <Stack.Screen options={{ title: '홈' }} />
      <Text variant="h3">template-typescript-expo</Text>
      <Link href="/examples" asChild>
        <Button testID="home-examples-link">
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
      <BuildInfoCard {...buildInfo} />
    </ScrollView>
  )
}
```

- [ ] **Step 6: 정적 검사와 전체 시험**

```bash
BACKEND_URL=https://gate-check.invalid pnpm types:routes
pnpm format
pnpm typecheck && pnpm lint && pnpm format:check && ./scripts/check-citations.sh app components lib platform queries test
timeout 600 pnpm test 2>&1 | grep -E "Test Files|Tests "
```

Expected: 검사 전부 exit 0 - `lib/updates/` 는 `lib/**` 경계 규칙(`expo-*`·`react` 금지)을 받고, expo-updates·expo-constants 는 `platform/updates.ts` 만 import 한다. 단위 시험은 Task 2 의 끝 +23·+3(`a40590a` 위에서 `Test Files  75 passed (75)`·`Tests  1647 passed (1647)`). `test/unit/ui/breakpoints.test.ts`(미디어 쿼리 변형 없음)와 `test/unit/resources/route-params-usage.test.ts`(홈은 라우트 파라미터를 읽지 않는다)가 새 파일을 훑고 통과한다.

- [ ] **Step 7: 두 플랫폼 번들을 만든다**

이 저장소의 `expo start` 를 끄고 돈다(`--clear` 가 Metro 캐시를 지운다).

```bash
APP_VARIANT=production BACKEND_URL=https://gate-check.invalid timeout 600 pnpm exec expo export --clear --platform android --platform ios --output-dir dist 2>&1 | grep -E "Bundled|Unable to resolve|Error"
pnpm lint:secrets && echo "secretlint ok"
```

Expected: `Android Bundled … (2076 modules)`·`iOS Bundled … (1985 modules)` 두 줄(`a40590a` 위의 한 번 - 앱 코드가 주석만 다른 D5 의 `976b9f8` 위에서는 2078·1980 이었다: 수는 실행마다 몇 개씩 다르다), `Unable to resolve`·`Error` 없음, `secretlint ok`. 0xC0000005·139 로 죽으면 다시 돌려 덮지 않는다(전역 제약).

- [ ] **Step 8: 문서와 스펙 정정을 쓴다**

`AGENTS.md` — Edit(계층 표의 `platform/` 행 앞에 행 하나 - 칸 맞춤 공백은 뒤의 `pnpm format` 이 다시 맞춘다), 찾을 것:

```markdown
| `platform/`
```

바꿀 것:

```markdown
| `lib/updates/` | 빌드 정보 카드의 판단 - 카드의 행, 업데이트 확인의 순서와 문구 | 네이티브 모듈, 화면 |
| `platform/`
```

같은 파일에 Edit(표 아래의 "트리에 없는 디렉터리" 문단 뒤, 위반 목록 앞에 한 문단), 찾을 것:

```markdown
위반의 정의:
```

바꿀 것:

```markdown
`lib/updates/`도 스펙의 트리에 없다 - 홈의 빌드 정보 카드(스펙 10.6)의 판단을 D6가 뒀다. 이 실행의 expo-updates
값을 다루고 설정 계약이 아니어서 `lib/config/`에 두지 않았다.

위반의 정의:
```

`platform/AGENTS.md` — Edit(표의 `theme.ts` 행 앞에 행 하나), 찾을 것:

```markdown
| `theme.ts`
```

바꿀 것:

```markdown
| `updates.ts` | 빌드 정보 카드가 읽는 이 실행의 값(`readBuildInfo` - expo-updates·expo-constants)과 업데이트 확인이 부르는 expo-updates 의 세 호출(`updatesApi`). 판단은 `lib/updates/build-info.ts` |
| `theme.ts`
```

`platform/AGENTS.md` 끝에 더한다 - 파일의 마지막 절이 `## 검증` 이다(배선을 `vi.mock` 으로 재는 시험들의 문단):

```markdown
`updates.ts`의 배선 - expo-updates·expo-constants 의 값을 빌드 정보로 옮기는 것과 업데이트 확인의 세 호출 - 은
`test/unit/platform/updates.test.ts`가 `vi.mock`으로 잰다(기기 모듈과 설정 자리를 가짜로 바꾼다). 카드의 행과 확인의 순서는
`lib/updates/`의 시험이 잰다.
```

`queries/AGENTS.md` — Edit(표의 `writes.ts` 행 앞에 행 하나), 찾을 것:

```markdown
| `writes.ts`
```

바꿀 것:

```markdown
| `updates.ts` | 홈의 빌드 정보 카드의 훅(`useBuildInfoCard`) - 행과 업데이트 확인의 쓰기 하나. 판단은 `lib/updates/build-info.ts`, expo-updates 호출은 `platform/updates.ts` 다. 확인은 결과를 값으로 돌려주고 세션을 쓰지 않는다 - 던져진 것은 결함이라 `throwOnError`. 훅이 쓰는 옵션(`updateCheckMutationOptions`)을 내보낸다 - 시험이 MutationObserver 로 돌린다 |
| `writes.ts`
```

D5 가 `submit-once.ts` 를 쓰는 곳을 두 자리에 적었다 - 카드의 "업데이트 확인" 도 그 가드를 지나므로(`useSubmitOnce(['updates', 'check'])`) 목록에 더한다. 같은 파일에 Edit(표의 `submit-once.ts` 행), 찾을 것 `폼 말고 삭제 확인 시트와 계약 실험실도 쓴다` — 바꿀 것 `폼 말고 삭제 확인 시트·계약 실험실·빌드 정보 카드도 쓴다`

`queries/submit-once.ts` — Edit(머리말 첫 문장), 찾을 것 `폼(자격증명·자원)·삭제 확인 시트·계약 실험실이 함께 쓴다.` — 바꿀 것 `폼(자격증명·자원)·삭제 확인 시트·계약 실험실·빌드 정보 카드가 함께 쓴다.`

스펙 — `## 5. 계층 소유권` 바로 앞에 더한다:

```markdown
> 정정(2026-10-01, D6): 트리에 셋을 더한다. `lib/updates/` 는 홈의 빌드 정보 카드(10.6)의 판단 - 카드의 행, "업데이트
> 확인" 의 순서(확인 → 받기 → 다시 켜기)와 문구 - 이고, expo-updates 의 값과 호출은 `platform/updates.ts` 가
> 넘긴다. 이 실행의 값을 다루고 설정 계약이 아니어서 `lib/config/` 에 두지 않았다. `lib/config/updates.ts` 는 OTA
> 설정의 판단(10.6 의 D6 정정)이고, `scripts/check-variant-config.mjs` 는 게이트 8단계의 변형별 설정 검사(12장의 D6
> 정정)다. 소유 규칙은 루트 `AGENTS.md` 의 표다.
```

스펙 — `### 10.7 계정이 필요한 실증은 따로 둔다` 바로 앞에 더한다:

```markdown
> 정정(2026-10-01, D6): 빌드 정보 카드는 앱 버전·변형·OTA(켜짐·꺼짐)·runtime version·채널·업데이트 ID 를 보인다 -
> 내장 번들로 떴으면 업데이트 ID 뒤에 그렇다고 적고, 값이 없으면 "없음" 이다(OTA 를 끈 Android 빌드는 runtime
> version·채널을 빈 문자열로 준다 - expo-updates 57.0.24 의 `DisabledUpdatesController`). OTA 를 끈 빌드는 "업데이트
> 확인" 대신 안내를 그린다. 확인은 서버에 새 업데이트(또는 내장 번들로 되돌리라는 지시)가 있으면 받아서 곧바로 다시
> 켜고, 없으면 그렇다고, 거절되면 그 문구를 적는다 - 도는 동안과 다시 켜는 동안은 스피너만 그린다(8.7). 판단은
> `lib/updates/build-info.ts`, 호출은 `platform/updates.ts`, 훅은 `queries/updates.ts`, 카드는
> `components/app/build-info-card.tsx` 다.
```

- [ ] **Step 9: 검사하고 커밋한다**

```bash
pnpm format
pnpm format:check && ./scripts/check-citations.sh app components lib platform queries test && pnpm lint
git status --short
git add lib/updates test/unit/updates test/unit/platform/updates.test.ts test/unit/queries/updates.test.ts platform/updates.ts queries/updates.ts queries/submit-once.ts components/app/build-info-card.tsx "app/(app)/index.tsx" AGENTS.md platform/AGENTS.md queries/AGENTS.md docs/superpowers/specs
git status --short
git commit -m "feat: 홈에 앱 버전·변형·OTA·runtime version·채널·업데이트 ID 를 보이고 업데이트를 확인해 바로 적용하는 빌드 정보 카드를 더한다"
```

Expected: 검사 전부 exit 0, 커밋 뒤 남은 파일이 없다(`dist/`·`.expo/` 는 git 이 무시한다).

---

### Task 4: 기기 — e2e APK 의 변형 설정과 빌드 정보 카드, 게이트 13단계 (실측 O4)

**Files:**
- Create: `test/e2e/flows/home-build-info.yaml`
- Modify: `test/e2e/android.sh`(APK 의 OTA 단언), `test/e2e/AGENTS.md`(`## 빌드 정보 플로`), `docs/superpowers/notes/2026-10-01-d6-measurements.md`(O4), 스펙(11.3·16 정정)

**Interfaces:**
- Consumes: Task 1 의 `updates`·`runtimeVersion`(e2e 는 `{ enabled: false }`·없음), Task 2 의 게이트 [8], Task 3 의 testID(`build-info-card`·`build-info-version`·`build-info-variant`·`build-info-ota`·`build-info-runtime`·`build-info-channel`·`build-info-update`·`build-info-ota-off`·`build-info-check`), D2 의 `subflows/start-signed-out.yaml`, 하네스의 빌드 지문(`test/e2e/android.sh` 가 든다 - 고치면 APK 를 다시 만든다).
- Produces: `test/e2e/android.sh build` 의 새 줄 `APK 의 OTA: updates={"enabled":false} runtimeVersion=undefined · AndroidManifest.xml ENABLED=false URL=- HEADERS=- usesCleartextTraffic=true`(어긋나면 빌드가 멈춘다), 플로 21.

- [ ] **Step 1: APK 의 OTA 설정을 단언한다**

머리말의 `build` 설명은 D4 Task 5 가 두 줄에서 세 줄로 바꾼다(빌드 앞에 Metro 캐시를 비운다) - 두 판에 다 있는 끝줄과 그 다음 줄에 맞춘다. `test/e2e/android.sh` — Edit, 찾을 것:

```bash
e2e 변형인지 확인한다
#   test/e2e/android.sh install     만든 APK 를 설치한다
```

바꿀 것:

```bash
e2e 변형인지 확인한다
#                                   앱 설정과 AndroidManifest.xml 이 OTA 를 끄고 평문 HTTP 를 켰는지도 확인한다
#   test/e2e/android.sh install     만든 APK 를 설치한다
```

같은 파일에 Edit - 새 함수는 `assert_apk_variant` 바로 뒤에 둔다(D4 Task 5 가 그 뒤에 `clear_metro_cache` 를 더해도 그 앞이다). `node -e` 스크립트는 줄마다 들여 쓴다(맨 앞에 `}` 가 오는 줄이 있으면 `sed -n '/^f() {/,/^}/p'` 로 함수를 떼는 도구가 거기서 끊긴다), 찾을 것:

```bash
  echo "APK 의 앱 설정: extra.appVariant=$variant"
}
```

바꿀 것:

```bash
  echo "APK 의 앱 설정: extra.appVariant=$variant"
}

# e2e 변형은 OTA 를 끄고 평문 HTTP 를 켠다(스펙 10.2·10.6) - 내장 번들로 결정적으로 돌고 10.0.2.2 의 http 백엔드에
# 닿는다. 앱이 읽는 설정(assets/app.config)과, 네이티브 expo-updates 가 읽는 병합된 AndroidManifest.xml 을 본다.
# 바이너리 매니페스트는 Android SDK build-tools 의 aapt2 로 읽는다. 게이트 [8] 은 빌드 전의 설정 플러그인 결과를
# 네 변형 모두 재고, 여기서는 실제로 설치할 APK 를 잰다.
assert_apk_ota_off() {
  local aapt2 config manifest
  aapt2=$(ls "$ANDROID_HOME"/build-tools/*/aapt2 "$ANDROID_HOME"/build-tools/*/aapt2.exe 2>/dev/null | sort -V | tail -n 1 || true)
  if [ -z "$aapt2" ]; then
    echo "aapt2 가 없다 - APK 의 AndroidManifest.xml 을 읽으려면 Android SDK 의 build-tools 가 필요하다" >&2
    exit 1
  fi
  if ! config=$(unzip -p "$APK" assets/app.config | node -e '
  const config = JSON.parse(require("fs").readFileSync(0, "utf8"))
  process.stdout.write(`updates=${JSON.stringify(config.updates)} runtimeVersion=${JSON.stringify(config.runtimeVersion)}`)'); then
    echo "APK 에서 assets/app.config 를 읽지 못했다: $APK" >&2
    exit 1
  fi
  if [ "$config" != 'updates={"enabled":false} runtimeVersion=undefined' ]; then
    echo "APK 의 앱 설정이 OTA 를 끄지 않았다 ($config)" >&2
    exit 1
  fi
  if ! manifest=$("$aapt2" dump xmltree --file AndroidManifest.xml "$APK" | node -e '
  const lines = require("fs").readFileSync(0, "utf8").split(/\r?\n/)
  const meta = new Map()
  let inMeta = false
  let name = null
  let cleartext = "-"
  for (const line of lines) {
    const element = line.match(/^\s*E: (\S+)/)
    if (element) {
      inMeta = element[1] === "meta-data"
      name = null
      continue
    }
    const clear = line.match(/android:usesCleartextTraffic\([^)]*\)=(\S+)/)
    if (clear) cleartext = clear[1]
    if (!inMeta) continue
    const named = line.match(/android:name\([^)]*\)="([^"]*)"/)
    if (named) {
      name = named[1]
      continue
    }
    const valued = line.match(/android:value\([^)]*\)=(?:"([^"]*)"|(\S+))/)
    if (valued && name !== null) meta.set(name, valued[1] ?? valued[2])
  }
  const updates = (key) => meta.get(`expo.modules.updates.${key}`) ?? "-"
  process.stdout.write(`ENABLED=${updates("ENABLED")} URL=${updates("EXPO_UPDATE_URL")} HEADERS=${updates("UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY")} usesCleartextTraffic=${cleartext}`)'); then
    echo "APK 의 AndroidManifest.xml 을 읽지 못했다: $APK" >&2
    exit 1
  fi
  if [ "$manifest" != 'ENABLED=false URL=- HEADERS=- usesCleartextTraffic=true' ]; then
    echo "APK 의 AndroidManifest.xml 이 e2e 변형의 설정이 아니다 ($manifest)" >&2
    exit 1
  fi
  echo "APK 의 OTA: $config · AndroidManifest.xml $manifest"
}
```

같은 파일에 Edit, 찾을 것:

```bash
  assert_apk_variant
  ls -l "$APK"
```

바꿀 것:

```bash
  assert_apk_variant
  assert_apk_ota_off
  ls -l "$APK"
```

```bash
bash -n test/e2e/android.sh && echo "syntax ok"
sed -n '/^assert_apk_ota_off() {/,/^}/p' test/e2e/android.sh | tail -n 2
```

Expected: `syntax ok`, 떼어 낸 함수의 끝 두 줄이 `  echo "APK 의 OTA: $config · AndroidManifest.xml $manifest"` 와 `}` 다(들여쓰기가 맞다).

- [ ] **Step 2: 카드 플로를 쓴다**

`test/e2e/flows/home-build-info.yaml` 을 만든다:

```yaml
# 홈의 빌드 정보 카드(스펙 10.6) - e2e 변형의 APK 가 제 설정을 기기에서 그대로 보이는지 본다. 앱 버전, 변형 e2e,
# OTA 꺼짐, runtime version·채널·업데이트 ID 없음(OTA 를 끈 빌드), 업데이트 확인 버튼 대신 안내. 같은 설정이 APK 의
# 앱 설정과 AndroidManifest.xml 에 있는지는 test/e2e/android.sh build 가 APK 를 만들 때 단언한다. 이 플로는 백엔드를
# 부르지 않는다.
appId: com.example.templateexpo.e2e
---
- runFlow: ../subflows/start-signed-out.yaml
- scrollUntilVisible:
    element:
      id: build-info-card
    direction: DOWN
- assertVisible:
    id: build-info-version
    text: '0\.1\.0'
- assertVisible:
    id: build-info-variant
    text: e2e
- assertVisible:
    id: build-info-ota
    text: 꺼짐
- assertVisible:
    id: build-info-runtime
    text: 없음
- assertVisible:
    id: build-info-channel
    text: 없음
- assertVisible:
    id: build-info-update
    text: 없음
- assertVisible:
    id: build-info-ota-off
- assertNotVisible:
    id: build-info-check
```

```bash
ls test/e2e/flows | wc -l
timeout 120 maestro check-syntax test/e2e/flows/home-build-info.yaml && echo "flow ok"
```

Expected: `21`(D4 의 18·D5 의 둘·이 플로), `flow ok`(Maestro 가 PATH 에 없으면 `~/.maestro/bin/maestro`).

- [ ] **Step 3: 문서와 스펙 정정을 쓴다**

`test/e2e/AGENTS.md` — `## 돌리기` 바로 앞에 더한다:

```markdown
## 빌드 정보 플로

- 홈의 빌드 정보 카드(`components/app/build-info-card.tsx`)는 행마다 testID 가 있다 - `build-info-<키>`(`version`·
  `variant`·`ota`·`runtime`·`channel`·`update`), OTA 를 끈 빌드의 안내 `build-info-ota-off`, 켠 빌드의 확인 버튼
  `build-info-check`. e2e 변형은 OTA 를 끄므로 `flows/home-build-info.yaml` 은 "없음"·"꺼짐" 과 안내를 본다 - 확인
  버튼을 누르는 기기 실증은 계정이 필요해 스펙 15장 9단계다.
- `android.sh build` 는 만든 APK 의 앱 설정(`assets/app.config` 의 `updates`·`runtimeVersion`)과 병합된
  AndroidManifest.xml(Android SDK build-tools 의 `aapt2` 로 읽는다 - expo-updates 의 `ENABLED`·주소·채널 머리글,
  평문 HTTP)이 e2e 변형의 것인지 단언한다. 빌드 레시피라 이 파일을 고치면 APK 를 다시 만든다.
```

스펙 — `### 11.4 E2E 스택` 바로 앞에 더한다:

```markdown
> 정정(2026-10-01, D6): E2E `home-build-info` 가 e2e 변형 APK 의 빌드 정보 카드를 기기에서 본다 - 변형 e2e, OTA 꺼짐,
> runtime version·채널·업데이트 ID 없음, 확인 버튼 대신 안내. `test/e2e/android.sh build` 는 만든 APK 의 앱 설정
> (`assets/app.config` - `updates` 가 `{ enabled: false }` 이고 `runtimeVersion` 이 없다)과 병합된 AndroidManifest.xml
> (`aapt2` - expo-updates 의 `ENABLED` 가 `false`, 업데이트 주소·채널 머리글이 없고 평문 HTTP 가 켜져 있다)을
> 단언한다. OTA 를 켠 변형의 기기 실증은 계정이 필요해 15장 9단계다. 결과는 D6 실측 O4.
```

스펙 — `## 17. 완료 조건` 바로 앞에 더한다:

```markdown
> 정정(2026-10-01, D6): 위 "설정 오류가 OTA로 배포된다" 의 대응 가운데 `fingerprint` 정책은 잰 사실이다 - 설정이 다른
> 환경의 발행은 runtime version 이 달라 빌드에 닿지 않는다(10.6 의 D6 정정 (c), D6 실측 O1). 게이트 8단계가 변형별
> 네이티브 설정을 검사한다(12장의 D6 정정). "OTA 실증에 Expo 계정이 필요하다" 는 그대로다 - D6 는 계정 없이 설정과
> 빌드 정보 카드만 쟀다.
```

기록의 O4 는 게이트 뒤에 채운다(Step 6). 먼저 뼈대를 붙인다 - `docs/superpowers/notes/2026-10-01-d6-measurements.md` 끝에 더한다:

````markdown

## O4 — e2e APK 의 변형 설정과 빌드 정보 카드 (기기)

**명령.** `E2E_AVD=Pixel_9_API_36 ./scripts/check.sh` - Pixel_9_API_36(Android 16, API 36), FastAPI 스택. 게이트 한 번이
빌드 입력이 바뀐 e2e APK 를 짧은 경로 사본에서 한 번 만들고(`test/e2e/android.sh build`) 플로를 전부 돌았다.

**APK 의 설정.** `android.sh build` 가 만든 APK 에서 읽은 값이다 - 앱 설정(`assets/app.config`)과, build-tools 의
`aapt2 dump xmltree` 로 읽은 병합된 AndroidManifest.xml.

```text
(Task 4 Step 6 (a) 의 출력 - "APK 의 앱 설정: …" 과 "APK 의 OTA: …" 두 줄 - 을 붙인다)
```

e2e 변형은 OTA 를 끄고(`updates` 가 `{ enabled: false }`, `runtimeVersion` 없음, expo-updates 의 `ENABLED=false`,
업데이트 주소·채널 머리글 없음) 평문 HTTP 를 켠다(`usesCleartextTraffic=true`) - 게이트 [8] 이 빌드 전에 잰 e2e 의 값과
같다(O3).

**빌드 정보 카드.** 플로 `home-build-info` 가 홈의 카드에서 앱 버전 `0.1.0`, 변형 `e2e`, OTA `꺼짐`, runtime
version·채널·업데이트 ID `없음`, 확인 버튼 대신 안내를 봤다. 끈 빌드에서 expo-updates 57.0.24 가 주는 값(runtime
version·채널은 빈 문자열, 업데이트 ID 없음)이 카드에서 "없음" 이 된 것이다.

```text
(Task 4 Step 6 (b) 의 출력 - gate.log 의 "=== [8/13]"·"=== [13/13]" 절 요약, "--- <플로>" 줄들, "=== E2E 통과 - 플로 N개 ===" 를 붙인다)
```

**재지 않은 것.** OTA 를 켠 변형(preview·production)의 기기 동작 - 업데이트 확인을 눌러 받은 업데이트가 적용되는
것은 Expo 계정과 EAS 빌드가 필요하다(스펙 15장 9단계, 사용자 승인 뒤). iOS(D7 의 CI). `expo-dev-client` 가 없어
development 프로필의 EAS 빌드는 설치를 묻는다(스펙 10.5 의 D6 정정).
````

```bash
pnpm format
pnpm format:check && ./scripts/check-citations.sh app components lib platform queries test
```

Expected: exit 0 둘.

- [ ] **Step 4: 게이트를 돌린다 — 기기 작업은 여기서 한 번**

게이트의 `[8/13]` 이 여덟 평가를 검사하고, `[13/13]` 이 빌드 입력이 바뀐 APK 를 짧은 경로 사본에서 **한 번** 만든 뒤(expo-updates 가 더한 `createReleaseUpdatesResources` 의 Metro 단계까지 - 5~7분) 새 스택에서 플로 스물하나를 돈다. 30분 넘게 걸릴 수 있어 백그라운드로 돌리고(제한 시간 90분) 끝나기를 기다린다(도구의 전경 제한은 10분이다). 이 저장소의 `expo start` 를 끄고 돈다(`[10]` 이 `--clear`).

```bash
mkdir -p .maestro-output
docker ps --filter name=joon- -q | wc -l
E2E_AVD=Pixel_9_API_36 ./scripts/check.sh > .maestro-output/gate.log 2>&1; echo "gate exit=$?"
grep -E "^=== |Test Files|Tests |변형 설정 (통과|위반)|APK 의 (앱 설정|OTA)|APK 를 다시 만들지 않는다|^--- home|E2E 통과|E2E:" .maestro-output/gate.log
docker ps --filter name=joon- -q | wc -l
docker ps --filter label=com.docker.compose.project=template-typescript-expo-e2e -q | wc -l
```

Expected: 앞뒤 `9`, `gate exit=0`, `=== [1/13] …` 부터 `=== [13/13] E2E ===`, `[7/13]` 의 단위 시험이 Task 3 의 끝과 같은 수(`a40590a` 위에서 `75 passed`·`1647 passed`), `[8/13]` 의 `변형 설정 통과` 여덟(위반 없음), `[12/13]` 의 `Tests  89 passed (89)`, `APK 의 앱 설정: extra.appVariant=e2e` 와 `APK 의 OTA: updates={"enabled":false} runtimeVersion=undefined · AndroidManifest.xml ENABLED=false URL=- HEADERS=- usesCleartextTraffic=true`, `--- home-build-info`, `=== E2E 통과 - 플로 21개 ===`, `=== 전부 통과 ===`, 우리 compose 프로젝트의 컨테이너 `0`. "APK 를 다시 만들지 않는다" 는 나오지 않는다(앱 코드와 빌드 레시피가 바뀌었다).

- [ ] **Step 5: 실패하면 원인을 고친다**

실패한 플로의 `.maestro-output/e2e/<플로>/` 에서 `maestro.log`·`debug/`(실패한 단계의 스크린샷)·`logcat.txt`·`api.log` 를 본다. **원인을 고친다** — 제한 시간을 늘리거나 단언을 지우거나 가드를 약하게 하지 않는다(스펙 16장: 재시도 0). 한 플로만 다시 돌릴 때는 `E2E_AVD=Pixel_9_API_36 E2E_FLOW="home-build-info" ./test/e2e/run-android.sh > .maestro-output/e2e-run.log 2>&1` 처럼 준다 - 플로만 고쳤으면 APK 를 다시 만들지 않는다. APK 는 한 번이 예산이다(결정 1): 앱 코드나 빌드 레시피를 고쳐 다시 만들어야 하면 그 까닭을 기록 O4 에 적고 한 번 더 만든다 - 두 번째도 실패하면 멈추고 컨트롤러에 넘긴다. 고친 뒤 전부 통과하면 Step 4 의 게이트를 한 번 더 돈다(빌드 입력이 같으면 APK 를 다시 만들지 않는다). 짐작되는 갈래:

(a) **`[8/13]` 이 멈춘다**(`변형 설정 위반`) — Task 2 Step 6 이 통과한 뒤에 바뀐 것이 있다(Task 3 의 문서·코드는 설정을 건드리지 않는다). 위반의 자리를 보고 `git log --oneline -- app.config.ts lib/config` 와 `git diff HEAD -- app.config.ts lib/config` 로 원인을 찾는다.

(b) **APK 빌드가 `createReleaseUpdatesResources` 에서 죽는다** — expo-updates 의 Gradle 단계가 Metro 로 내장 매니페스트를 만든다. 0xC0000005·139 면 전역 제약의 30분 규칙이다(Metro 캐시 - `[10]` 이 방금 `--clear` 로 채운 캐시를 쓴다). `Error loading assets JSON from Metro` 면 `metro.config.js` 가 `expo/metro-config` 의 `getDefaultConfig` 를 지나는지 본다(`@expo/metro-config` 가 `fileHashes` 를 넣는다). 둘 다 아니면 Gradle 의 마지막 60줄과 함께 컨트롤러에 넘긴다.

(c) **`APK 의 앱 설정이 OTA 를 끄지 않았다`** — `assets/app.config` 는 Gradle 의 `createExpoConfig` 가 그 셸의 환경으로 `app.config.ts` 를 다시 평가한 것이다. `runtimeVersion` 이 있으면 e2e 에서 OTA 가 켜진 것이다 - `lib/config/updates.ts` 의 `updatesConfig` 와 변형 표의 `updatesChannel`(e2e 는 `null`)을 본다. `updates` 가 `undefined` 면 expo-updates 를 받기 전의 APK 다 - 빌드가 옛 사본을 쓴 것이다(`E2E_STAGE_DIR` 의 `node_modules`).

(d) **`APK 의 AndroidManifest.xml 이 e2e 변형의 설정이 아니다`** — 괄호 안의 값에서 어긋난 자리를 본다. `HEADERS` 가 있으면 e2e 에 채널 머리글이 실렸다(`updatesConfig`), `usesCleartextTraffic=-` 면 aapt2 출력의 모양이 달라졌다 - `"$aapt2" dump xmltree --file AndroidManifest.xml <apk> | grep -n -A2 "E: application\|updates"` 로 보고 파서의 정규식을 고친다(값의 기대는 바꾸지 않는다). `aapt2 가 없다` 면 `$ANDROID_HOME/build-tools/` 를 본다(이 머신은 35.0.0·36.0.0).

(e) **`home-build-info` 가 값을 못 찾는다** — 스크린샷에서 카드를 본다. 값이 "없음" 이 아니면(예: runtime version 이 문자열) 끈 빌드의 expo-updates 가 사실 절과 다른 값을 준 것이다 - 그 값을 기록 O4 에 적고 컨트롤러에 넘긴다(단언의 글자를 바꾸지 않는다). 카드가 화면 밖이면 `scrollUntilVisible` 의 방향을 본다.

(f) **다른 플로가 홈에서 멈춘다**(`home-examples-link`·`home-lab-link` 를 못 찾는다) — 홈의 뿌리가 `ScrollView` 가 되며 버튼 자리가 바뀌었다. 스크린샷에서 버튼이 화면 안에 있는지 본다 - 화면 밖이면 `contentContainerClassName` 의 `justify-center` 를 `justify-start` 로 바꾼다(앱 코드 - APK 를 다시 만든다).

(g) **`W/ReactNativeJS`·`E/ReactNativeJS` 가 가드에 걸린다** — 그 경고를 내는 코드를 고친다(`Text` 밖의 글자, 중복 키 등). expo-updates 의 JS 는 경고를 내지 않는다(`build/*.js` 에 `console.warn` 이 없다) - 네이티브 로그는 `ReactNativeJS` 태그가 아니다.

- [ ] **Step 6: 기록을 채운다**

(a) APK 의 설정:

```bash
grep -E "APK 의 (앱 설정|OTA)" .maestro-output/gate.log
```

(b) 게이트의 요약:

```bash
grep -E "^=== \[(8|13)/13\]|변형 설정 통과|Test Files|Tests |^--- [a-z]|E2E 통과" .maestro-output/gate.log
```

`docs/superpowers/notes/2026-10-01-d6-measurements.md` 의 O4 괄호 안 안내 줄 둘을 (a)·(b) 의 출력으로 바꾼다. Step 5 에서 APK 를 한 번 더 만들었으면 그 까닭을 O4 의 **명령** 문단 끝에 적는다.

루트 `AGENTS.md` 에는 Task 1 이 D6 기록을 가리키는 문장을 이미 더했다 - 고칠 것이 없다.

- [ ] **Step 7: 커밋한다**

게이트 뒤에는 기록(문서)만 바뀌었다 — 빌드 지문과 플로와 거울이 문서를 보지 않으므로 게이트를 다시 돌리지 않는다. 문서에 걸리는 검사만 다시 돈다.

```bash
pnpm format:check && ./scripts/check-citations.sh app components lib platform queries test && node scripts/check-provenance.mjs | tail -n 1
git status --short
git add test/e2e docs/superpowers
git status --short
git commit -m "test: e2e APK 가 OTA 를 끈 변형 설정을 담았는지 단언하고 빌드 정보 카드를 기기에서 보며 게이트 13단계를 잰다"
git ls-tree HEAD scripts/ test/e2e/ test/contract/ | grep -E "\.sh$"
```

Expected: 검사 통과(Task 1 Step 1 의 출처 기록 그대로 - `경로 52개, 이탈 40건, 원본 그대로 32개`), 첫 `git status` 에는 이 태스크의 파일만 있고(`test/e2e/android.sh`·`test/e2e/flows/home-build-info.yaml`·`test/e2e/AGENTS.md`·기록·스펙 - 앱 코드가 보이면 Step 5 에서 고친 것이다. 그 변경도 게이트를 지났는지 확인하고 함께 넣는다), 커밋 뒤 남은 파일이 없다. `.sh` 여섯이 모두 `100755`.

---

## 이 계획이 끝났을 때의 상태

- `expo-updates` 57.0.24 가 있고, 변형 표(`lib/config/app-variant.ts`)에 OTA 채널 칸 `updatesChannel` 이 생겼다(preview·production 만 채널이 있다). `lib/config/updates.ts` 가 `EAS_PROJECT_ID`(UUID 가 아니면 설정 평가가 멈춘다, EAS 빌드 서버에서는 `EAS_BUILD_PROJECT_ID`)와 변형으로 OTA 를 정하고, `app.config.ts` 가 `updates`(켜면 `https://u.expo.dev/<id>`·`ON_LOAD`·0·채널 머리글)·`runtimeVersion`(켠 빌드만 `fingerprint`)·`extra.eas.projectId` 를 싣는다. `eas.json` 은 변형과 같은 네 프로필이고 Node 24.19.0·pnpm 11.22.0 을 고정한다. 설정 시험 +56.
- 게이트 `[8/13]` 이 변형 넷 × EAS 프로젝트 유무를 `expo config --type introspect` 해 `scripts/check-variant-config.mjs` 로 네이티브 설정이 될 값(식별자·scheme·앱 이름·평문 HTTP·OTA)을 변형 표와 맞댄다 - 여덟 평가 10초 안팎, 어긋남을 넣으면 그 자리를 알리며 멈춘다(기록 O3). 검사기 시험 22.
- 홈의 빌드 정보 카드가 앱 버전·변형·OTA·runtime version·채널·업데이트 ID 를 보이고, OTA 를 켠 빌드에서는 "업데이트 확인" 으로 받은 업데이트를 바로 적용한다(판단 `lib/updates/build-info.ts` - 시험 16). 훅은 D4 의 쓰기 훅처럼 쓰기 옵션을 내보내고 `throwOnError` 를 준다 - 배선(`platform/updates.ts`, 시험 4)과 옵션(시험 3)을 `vi.mock`·`MutationObserver` 로 잰다.
- e2e APK 를 만들 때 `test/e2e/android.sh` 가 앱 설정과 병합된 AndroidManifest.xml 이 OTA 를 끄고 평문 HTTP 를 켰는지 단언하고, 플로 `home-build-info` 가 카드에서 그 설정을 본다. `./scripts/check.sh` 가 13단계를 통과한다 - 플로 21.
- fingerprint runtime version 은 `BACKEND_URL`·변형·프로젝트 id 가 다르면 다르고 JS 만 바뀌면 같다(기록 O1) - 설정이 틀린 환경의 OTA 발행은 어떤 빌드에도 닿지 않는다. `eas.json` 은 EAS 의 해석기로 경고 없이 읽힌다(기록 O2).
- 수: 단위 시험은 D5 의 끝 +101·파일 +6(`a40590a` 위에서 `1647`·75 파일), 출처 기록 그대로(52·40·32), 플로 21. 기록: D6 실측 O1–O4. 스펙 정정: 4·10.1·10.5·10.6(둘)·11.3·12·16.

## 다음 계획

D7(CI)이 넘겨받는 것:

- iOS 빌드도 expo-updates 의 빌드 단계(내장 매니페스트를 만드는 Metro 한 번, `app.config.ts` 재평가)를 지난다 - xcodebuild 환경에 `APP_VARIANT`·`BACKEND_URL` 을 넘기는 것(D1 운반 기록 D7 절)에 더해, `.app` 의 `EXConstants.bundle/app.config` 의 `updates` 가 `{ enabled: false }` 이고 `Expo.plist` 의 `EXUpdatesEnabled` 가 `false` 인지 단언한다(`test/e2e/android.sh` 의 `assert_apk_ota_off` 와 같은 자리). 카드 플로 `home-build-info` 를 iOS 에서 돈다 - 끈 빌드의 iOS expo-updates 가 runtime version·채널에 무엇을 주는지(Android 는 빈 문자열) 그때 잰다.
- CI 의 `checks` 잡(게이트 1–11 또는 1–12)의 `[8]` 은 Android SDK 없이 돈다(`expo config --type introspect` 만). Android 빌드 잡은 build-tools 의 `aapt2` 가 있어야 APK 단언이 돈다.
- 기준 수 - 이 계획의 끝은 D5 의 끝에서 단위 시험 +101(파일 +6)·플로 +1 이고 출처 기록은 그대로다. D4·D5 를 병합한 `main`(`a40590a`) 위에서 `1647 passed`(75 파일), `경로 52개, 이탈 40건, 원본 그대로 32개`, 플로 21 이었다.

D8(문서·게이트·저장소)이 넘겨받는 것:

- README 의 EAS·OTA 절 - `EAS_PROJECT_ID`(`eas init` 이 만든 UUID, `.env` 나 셸에 둔다 - EAS 빌드 서버에는 넣지 않아도 된다: `EAS_BUILD_PROJECT_ID` 를 쓴다), `eas env:create --environment <preview|production> --name BACKEND_URL`, 프로필 = 변형 = 채널, 발행은 `APP_VARIANT=<변형>` 과 빌드와 같은 `BACKEND_URL`·`EAS_PROJECT_ID` 로(다르면 runtime version 이 달라 업데이트가 빌드에 닿지 않는다 - 기록 O1). 환경 변수 표에 `EAS_PROJECT_ID`(기본값 없음)를 `.env.example` 과 같은 값으로 적는다(스펙 10.1 의 "세 곳").
- `expo-dev-client`(결정 3) - D8 계획이 설치한다: `expo install expo-dev-client`, 변형 표의 새 칸 `devClientScheme`(development 만 `true`), `app.config.ts` 의 `['expo-dev-client', { addGeneratedScheme: profile.devClientScheme }]` 로 생성 scheme 을 development 에만 두고, 게이트 [8] 의 검사기가 development 의 Android·iOS scheme 에 `exp+template-typescript-expo` 를 기대하도록 고친다. release APK 의 dev launcher 는 빈 구현(`disableInRelease`)이라 E2E 동작은 바뀌지 않는다 - 그래도 APK 를 다시 만들어 E2E 를 돈다. D8 이 기대는 이 계획의 끝 모양(`.env.example` 의 변수 셋, 변형 표의 끝 칸 `updatesChannel`, `app.config.ts`·검사기·설정 시험의 자리, `lib/config/AGENTS.md` 의 `updates.ts` 문단, 플로 21)은 결정 3 에 있다 - 이 계획을 실행하며 그 글자를 바꾸면 D8 의 전제 표가 어긋나니 태스크 보고에 적는다.

D9(EAS 실계정 실증 - 사용자 승인 뒤, 스펙 10.7)이 넘겨받는 것:

- 순서: `eas login`(사용자) → `eas init`(id 를 `EAS_PROJECT_ID` 로 - 동적 설정이라 eas-cli 는 `extra.eas.projectId` 를 쓰지 못하고 값을 알린다) → `eas env:create --environment preview --name BACKEND_URL --value https://…` → `eas build --profile preview --platform android` → APK 설치 → 카드가 OTA 켜짐·채널 preview·runtime version(지문)·업데이트 ID(내장 번들)를 보인다 → `APP_VARIANT=preview BACKEND_URL=<같은 주소> EAS_PROJECT_ID=<id> eas update --channel preview --environment preview` → 카드의 "업데이트 확인" → 앱이 다시 뜨고 업데이트 ID 가 새 값(내장 번들 아님)이다.
- 걸릴 수 있는 것: 로컬 셸의 `BACKEND_URL` 이 EAS 환경의 값과 다르면 eas-cli 와 서버의 runtime version 이 달라 빌드가 멈추거나("Runtime version calculated on local machine not equal …") 발행한 업데이트가 닿지 않는다(기록 O1). 프로젝트가 조직에 있거나 로봇 토큰을 쓰면 eas-cli 가 `owner` 를 요구한다 - `app.config.ts` 에 한 줄. `slug`(`template-typescript-expo`)가 EAS 프로젝트의 slug 와 같아야 한다.
