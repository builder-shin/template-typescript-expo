# D1 실측 기록 (2026-09-30)

스펙 15장 "0단계에서 먼저 실측할 것"과 D1 계획이 더한 둘(M7·M8)의 결과다. 각 절은
**무엇을 했고(명령) 무엇이 나왔는가(출력)**를 사실로 적고, 그 결과로 정한 것을 따로 적는다.
결과가 스펙과 어긋나면 스펙에 날짜가 붙은 정정을 더한다.
계측 화면과 플로는 커밋 3d16db5에 있고 다음 커밋에서 지웠다 - 다시 재려면 그 커밋을 체크아웃한다.
해시 대신 경로로 찾으려면 `git log --all --diff-filter=D -- 'app/(lab)/probe.tsx'`가 그 화면을 지운 커밋(`14c7c13`)을
알려 주고, 그 부모(`14c7c13^`)가 계측기가 있던 커밋이다.
출력의 저장소 경로·계정 이름은 줄였다. 저장소 루트(74자)는 `<저장소 루트>`, `ls -l`의 소유자·그룹은 `<user> <group>`이다.

| # | 질문 | 결과 | 정한 것 |
| --- | --- | --- | --- |
| M1 | Uniwind + React Native Reusables가 SDK 57 Android Release 빌드에서 렌더되는가 | 렌더된다 — `e2e` 변형 Release APK가 API 36 에뮬레이터에서 크래시 없이 뜨고, 라이트·다크 모두 `global.css` 토큰 값 그대로 그려진다(UI 덤프에 `template-typescript-expo`·`Uniwind`). 단 Windows에서 APK를 만들려면 hoisted 링커와 짧은 저장소 경로가 필요하다 — 이 머신의 저장소 위치(74자)에서는 APK가 만들어지지 않았다 | 스타일 스택 유지. `nodeLinker: hoisted`로 바꿨다(M5 재판정). Uniwind 1.12.0의 `@media` 블록 결함을 기록했다 |
| M2 | Expo Router가 대괄호 키를 딥링크·`router.setParams`에서 보존하는가 | 보존된다 — 키가 `filter[status]`·`filter[title][contains]` 그대로 나온다. 딥링크(대괄호를 `%5B`·`%5D`로 인코딩한 것과 그대로 쓴 것, 앱이 켜진 채 받은 것과 꺼진 앱을 링크로 띄운 것 넷 모두)와 `router.setParams` 모두 통과했다. 단 중첩 키(`filter[title][contains]`)는 인코딩한 링크와 `router.setParams`로만 확인했고 인코딩하지 않은 링크는 `filter[status]` 하나만 썼다. 값의 `%20`은 공백으로 풀린다 | 대괄호 키를 위한 인코딩 규칙을 `lib/resources`에 두지 않는다 — 필터 키를 그대로 라우트 파라미터로 쓴다(스펙 8.2). 값의 특수문자(`&`·`=`·`+`·`#`·비ASCII)와 중복 키는 재지 않았다 |
| M3 | Maestro로 Android 기기 로캘을 바꿀 수 있는가 | Android는 된다 — 앱별 언어(`adb shell cmd locale set-app-locales`)를 `ko-KR`로 주면 앱의 `getLocales()`가 `ko-KR,en-US`를 낸다(시스템 로캘은 `en-US` 그대로). `maestro test --device-locale`은 없는 옵션이라 실패했고(`Unknown option`, exit 2), 시스템 로캘을 `adb root`와 `setprop`으로 바꾸는 길은 이 이미지(`user` 빌드)에서 root가 막혀 안 됐다(다른 길은 시도하지 않았다). iOS는 재지 못했다 | 앱별 언어로 정한다. 하네스는 상태 지우기(`pm clear`) → `set-app-locales` → 앱 실행 순서를 지키고 로캘 플로는 `clearState`를 쓰지 않는다 — `pm clear`가 앱별 언어를 지운다. `expo-localization` 설정 플러그인은 Android에서는 필요 없었다(iOS는 재지 못했다) |
| M4 | `e2e` 변형 Release APK가 평문 HTTP로 `10.0.2.2:4100`에 닿는가 | 닿는다 — `e2e` 변형 Release APK가 평문 HTTP로 `http://10.0.2.2:4100/health/ready`를 불러 `ok 200`을 받는다(FastAPI 스택). 빌드된 매니페스트에 `usesCleartextTraffic=true`가 있다 | 현재 설정(`expo-build-properties`의 `usesCleartextTraffic`, `development`·`e2e`만)을 유지한다. 이 요청은 `platform/config.ts`가 설정 자리를 `extra`로 돌린 뒤 나갔으므로 그 바인딩도 함께 확인됐다 |
| M5 | pnpm 기본(isolated) 링커에서 Metro 번들과 expo-doctor가 도는가 | 돈다 — `expo export`(android·ios) exit 0, expo-doctor 21/21 통과 exit 0 | 당시에는 isolated 유지(기본값)로 정했다. M1의 Android Release 빌드가 Windows에서 isolated로는 만들어지지 않아 2026-09-30에 `pnpm-workspace.yaml`의 `nodeLinker: hoisted`로 바꿨다(pnpm 11은 `.npmrc`의 `node-linker`를 읽지 않는다). 아래 M5 절 끝의 재판정과 M1 절을 본다 |
| M6 | RN fetch에서 `AbortController` 타임아웃이 요청을 실제로 끊는가 | 거절된다 — 연결은 받고 응답하지 않는 서버에 건 요청이 2초 타이머의 `abort()`로 2,023ms에 JS 쪽에서 거절된다(소켓이 닫혔는지는 관찰하지 못했다). 단 오류 이름이 `AbortError`가 아니라 `Error`다 — 이 앱의 전역 `fetch`는 RN 폴리필이 아니라 `expo/fetch`(SDK 57)다. 백엔드를 멈추면 `request()`의 타임아웃이 약 15초(대기 단계 15,021ms)에 `REQUEST_TIMEOUT`을 낸다 | `AbortController` 방식의 타임아웃을 유지한다(15초, 스펙 8.5). 취소를 오류 이름으로 가르지 않는다 — `lib/jsonapi/client.ts`는 타이머 플래그(`timedOut`)로 가른다 |
| M7 | `app.config.ts`가 `./lib/config/*.ts`를 확장자 포함 import로 쓸 수 있는가 | 쓸 수 있다 — `expo config --type public --json`(e2e 변형) exit 0에 변형 값이 나오고, `BACKEND_URL` 없음과 production+http는 각각 해당 오류 문구와 exit 1 | 확장자 포함 import 유지(검증 복사 없음). 전제는 Node의 type stripping이다 — 끄면 같은 명령이 구문 오류로 exit 1 |
| M8 | Maestro CLI가 Windows Git Bash에서 도는가 | 돈다 — Git Bash의 셸 런처와 `maestro.bat` 모두 `2.11.0`·exit 0이고 `maestro test`가 에뮬레이터에서 플로를 돌린다. 플로를 쓸 때 걸리는 것이 넷 있다: `evalScript`의 `: `는 따옴표가 필요하고, `launchApp` 직후 보낸 딥링크는 버려지고, `console.log`는 콘솔이 아니라 디버그 로그에 남고, `clearState`는 앱별 언어를 지운다 | Maestro 2.11.0을 `~/.maestro`에 설치해 셸 런처로 쓴다(`.bat` 폴백은 필요 없었다). 위 넷을 플로 작성 규칙으로 삼는다 |

iOS 쪽(M1·M2·M3의 iOS 절반, M4의 iOS `NSAllowsLocalNetworking`, M6)은 개발 머신이 Windows라 여기서 잴 수 없다. CI 계획이 잰다.

## M5 — pnpm 링커

환경은 Node 24.19.0 · pnpm 11.22.0 · Windows 11(Git Bash)이다. 측정할 때 `.npmrc`에는
`engine-strict=true`만 있었고(관찰 1에 따라 나중에 지웠다) 링커는 따로 정하지 않았다. 설치 뒤
`node_modules/.modules.yaml`에 `"nodeLinker": "isolated"`가 기록됐다. 설치된 버전은 `expo` 57.0.26 ·
`expo-router` 57.0.24 · `react-native` 0.86.3 · `react` 19.2.3 · `typescript` 6.0.3이다.

### 번들 — `expo export`

```bash
pnpm exec expo export --platform android --platform ios --output-dir dist 2>&1 | tail -20; echo "export exit=${PIPESTATUS[0]}"
```

```text
node_modules\.pnpm\expo-router@57.0.24_89d878ceb6f28d33f4a9d63065a666ea\node_modules\expo-router\assets\forward.png (188B)
node_modules\.pnpm\expo-router@57.0.24_89d878ceb6f28d33f4a9d63065a666ea\node_modules\expo-router\assets\pkg.png (364B)
node_modules\.pnpm\expo-router@57.0.24_89d878ceb6f28d33f4a9d63065a666ea\node_modules\expo-router\assets\react-navigation\elements\back-icon-mask.png (653B)
node_modules\.pnpm\expo-router@57.0.24_89d878ceb6f28d33f4a9d63065a666ea\node_modules\expo-router\assets\react-navigation\elements\back-icon.png (8 variations | 359B)
node_modules\.pnpm\expo-router@57.0.24_89d878ceb6f28d33f4a9d63065a666ea\node_modules\expo-router\assets\react-navigation\elements\clear-icon.png (4 variations | 425B)
node_modules\.pnpm\expo-router@57.0.24_89d878ceb6f28d33f4a9d63065a666ea\node_modules\expo-router\assets\react-navigation\elements\close-icon.png (4 variations | 235B)
node_modules\.pnpm\expo-router@57.0.24_89d878ceb6f28d33f4a9d63065a666ea\node_modules\expo-router\assets\react-navigation\elements\search-icon.png (7 variations | 592B)
node_modules\.pnpm\expo-router@57.0.24_89d878ceb6f28d33f4a9d63065a666ea\node_modules\expo-router\assets\sitemap.png (465B)
node_modules\.pnpm\expo-router@57.0.24_89d878ceb6f28d33f4a9d63065a666ea\node_modules\expo-router\assets\unmatched.png (4.8KB)

› ios bundles (1):
_expo/static/js/ios/entry-cc12bc8002f7f1c917440b41ff076c14.hbc (2.3MB)

› android bundles (1):
_expo/static/js/android/entry-77978176565332646bdebe27647f1bca.hbc (2.7MB)

› Files (1):
metadata.json (3.4KB)

Exported: dist
export exit=0
```

소요 시간은 29초다. 전체 출력은 33줄이고, `tail`이 자른 앞부분에 판정에 쓴 줄이 있다.

```text
React Compiler enabled
Starting Metro Bundler

iOS Bundled 15698ms node_modules\.pnpm\expo-router@57.0.24_89d878ceb6f28d33f4a9d63065a666ea\node_modules\expo-router\entry.js (1098 modules)
Android Bundled 19817ms node_modules\.pnpm\expo-router@57.0.24_89d878ceb6f28d33f4a9d63065a666ea\node_modules\expo-router\entry.js (1248 modules)
```

전체 출력을 `warn`·`error`·`Unable to resolve module`·`duplicate`로 검색하면 자산 파일 이름
`error.png` 말고는 걸리지 않는다. 번들 경로가 `node_modules\.pnpm\...` 아래인 것이 Metro가
isolated 배치를 따라 해석했다는 증거다. `React Compiler enabled`는 `babel-preset-expo@57.0.13`이
`babel-plugin-react-compiler@1.0.0`을 직접 의존하기 때문에 별도 의존성 없이 나온다.

`node_modules`를 지우고 락파일로 다시 설치한 트리에서 같은 명령을 다시 돌려도 exit 0이고 `tail -20`이
위와 글자 그대로 같다(번들 파일 이름의 해시가 같다). `(N modules)`는 실행마다 달랐다. 위 명령을 세 번
돌린 결과는 iOS 1098·884·1096, Android 1248·1248·1248이고, 아래 소스맵 플래그를 더한 실행은 iOS 1103,
Android 1236이었다. 같은 명령의 세 번은 번들 해시가 같았으므로 이 숫자를 판정 근거로 쓰지 않는다.

### 번들 안의 중복 검사

isolated 배치는 peer 조합이 다르면 같은 패키지를 가상 스토어에 여러 벌 만들 수 있다. 번들에 같은 패키지가
두 벌 들어가는지 소스맵으로 확인했다.

```bash
pnpm exec expo export --platform android --platform ios --no-bytecode --dump-sourcemap --output-dir <임시 디렉터리>
```

두 소스맵의 `sources`를 `node_modules/.pnpm/<폴더>/node_modules/<패키지>`로 묶은 결과다.

| 플랫폼 | `.pnpm` 아래 소스 | 패키지 수 | 둘 이상의 폴더에서 온 패키지 |
| --- | --- | --- | --- |
| android | 1248 | 57 | 0 |
| ios | 1103 | 52 | 0 |

`react` · `react-native` · `react-native-screens` · `react-native-safe-area-context` ·
`expo-modules-core` · `expo-router` · `expo`는 두 플랫폼 모두 한 벌씩이다. 이 검사는 `node_modules`를
지우고 `pnpm install --frozen-lockfile`로 다시 깐 트리에서 했다. 증분 설치(`pnpm add` → `expo install` →
`pnpm add -D`)를 거친 `node_modules/.pnpm`에는 락파일에 없는 낡은 변형 폴더가 남아 `react-native@0.86.3_…`가
세 벌, `react-native-screens`가 두 벌로 보였고, 다시 깔면 새 clone의 `.pnpm` 목록과 같아진다.

### expo-doctor

```bash
pnpm dlx expo-doctor@1.20.4 2>&1 | tail -30; echo "doctor exit=${PIPESTATUS[0]}"
```

```text
Progress: resolved 1, reused 0, downloaded 0, added 0
Packages: +1
+
Progress: resolved 1, reused 0, downloaded 1, added 1, done
Running 21 checks on your project...
21/21 checks passed. No issues detected!
doctor exit=0
```

### 정한 것

두 명령이 모두 `exit=0`이고 모듈 해석 실패·중복 `react` 경고·doctor의 의존성 트리 오류가 없다.
그래서 isolated를 유지한다. hoisted 폴백은 실행하지 않았다. D1 계획 Task 4의 Android Release 빌드가
링커 때문에 실패하면 그때 이 판정을 다시 연다. 그때의 폴백은 아래 관찰 1에 따라 `.npmrc`가 아니라
`pnpm-workspace.yaml`의 `nodeLinker: hoisted`로 한다.

### 함께 관찰한 것

링커 판정과 별개로, 이 저장소를 설치하고 이어서 작업하는 쪽이 알아야 할 것이다.

1. **pnpm 11은 `.npmrc`의 pnpm 설정을 읽지 않는다.** 임시 디렉터리에서 `.npmrc`에 `node-linker=hoisted`를
   적고 `node_modules`를 지운 뒤 `pnpm install --frozen-lockfile`을 하면 `pnpm config get node-linker`가
   `undefined`이고 `.modules.yaml`은 그대로 `"nodeLinker": "isolated"`다. `pnpm-workspace.yaml`에
   `nodeLinker: hoisted`를 적으면 `.modules.yaml`이 `"nodeLinker": "hoisted"`가 되고, 점으로 시작하지
   않는 `node_modules` 최상위 항목이 12개(isolated)에서 332개로 늘어난다. `engine-strict`도 같다.
   `engines.node`를 `>=99`로 둔 최소 프로젝트에서 `.npmrc`에 `engine-strict=true`를 두면
   `[WARN] Unsupported engine`만 내고 exit 0이고, `pnpm-workspace.yaml`에 `engineStrict: true`를 두면
   exit 1로 설치가 막힌다. 그래서 이 저장소의 `.npmrc` 한 줄은 pnpm 11.22.0에서 효력이 없었다. 그 상태에서
   `pnpm config get engine-strict`와 `pnpm config get engineStrict`는 둘 다 `undefined`였다.
   정한 것: `.npmrc`를 지우고 `pnpm-workspace.yaml`에 `engineStrict: true`를 두었다. 그 뒤 두 키가 모두
   `true`를 돌려주고, `node_modules`를 지운 `pnpm install --frozen-lockfile`이 exit 0이며(설치되는 의존성의
   `engines`가 모두 Node 24.19.0을 허용한다), 이 저장소의 `package.json`·`pnpm-lock.yaml`·`pnpm-workspace.yaml`을
   복사해 `engines.node`만 `>=99`로 바꾼 사본은 exit 1로 막힌다.
2. **릴리스 경과일 검사.** 의존성을 설치하자 pnpm이 `pnpm-workspace.yaml`에
   `minimumReleaseAgeExclude`를 스스로 적었다(최종 5개: `expo@57.0.26` · `expo-constants@57.0.20` ·
   `expo-modules-core@57.0.20` · `expo-router@57.0.24` · `@expo/ui@57.0.21`). 다섯 모두
   2026-09-29 10:56~10:59 UTC에 릴리스됐고 설치한 때는 2026-09-30 00시(UTC) 무렵이라 pnpm 11 기본
   `minimumReleaseAge`(1440분)의 안쪽이다. 임시 디렉터리에 `package.json`·`pnpm-lock.yaml`만
   두고(측정할 때는 그때 있던 `.npmrc`도 두었다. 그 파일은 관찰 1에 따라 지웠고 pnpm 설정은 지금 `pnpm-workspace.yaml`에
   있다) `pnpm install --frozen-lockfile`을 하면 `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`(5건)으로 exit 1이고,
   `pnpm-workspace.yaml`을 더하면 exit 0이다. 가장 늦은 릴리스(2026-09-29 10:59 UTC)에서 하루가 지나면
   이 예외가 필요 없어질 것으로 보이지만, 이는 pnpm이 출력한 컷오프 규칙에서 읽은 것이고 그 시점
   이후에는 다시 재지 않았다.
3. **무시된 빌드 스크립트는 없다.** pnpm이 무시된 빌드 스크립트를 보고하지 않았고 `.modules.yaml`의
   `pendingBuilds`가 빈 배열이다. 그래서 `allowBuilds`를 적지 않았다(D1 계획 Task 2에서 `eslint-config-expo`가 끌어오는
   `unrs-resolver` 때문에 `pnpm-workspace.yaml`에 더했다).
4. **미충족 peer 세 건.** `pnpm install`이 경고 `Issues with peer dependencies found`를 내고
   `pnpm peers check`가 exit 1로 아래를 보고한다. `expo export`와 expo-doctor에는 나타나지 않았다.

   | peer | 설치된 것 | 요구하는 쪽 |
   | --- | --- | --- |
   | `react-native-worklets` | 0.13.0 | `expo-modules-core@57.0.20`: `^0.7.4 \|\| ^0.8.0 \|\| ^0.9.0 \|\| ^0.10.0` |
   | `@react-native/metro-config` | 0.87.1 | `@react-native/community-cli-plugin@0.86.3`: `0.86.3` |
   | `react-dom` | 없음 | `@radix-ui/*`·`vaul` (`expo-router`의 의존성, 웹 경로) |

   원인은 `expo-router@57.0.24`가 `react-native-gesture-handler`와 `react-native-reanimated`를 optional
   peer로 선언하는데 pnpm이 이를 자동으로 설치했고, SDK 57 고정값(`expo/bundledNativeModules.json`:
   `react-native-reanimated` 4.5.1 · `react-native-worklets` 0.10.1 · `react-native-gesture-handler`
   ~2.32.0)이 아니라 최신판이 들어온 것이다. 락파일에는 `react-native-reanimated` 4.7.0 ·
   `react-native-gesture-handler` 3.3.0이 있고, reanimated의 peer로 `react-native-worklets` 0.13.0,
   그 peer로 `@react-native/metro-config` 0.87.1이 따라왔다. 락파일이 정하는 해석이라 임시
   디렉터리에서 `nodeLinker`를 hoisted로 바꿔 다시 설치해도 `pnpm peers check`의 세 건은 같다.
   `react-native-reanimated` · `react-native-gesture-handler` · `react-native-worklets`는 `package.json`에
   없어 expo-doctor의 버전 검사에는 잡히지 않지만, Expo의 React Native
   autolinking(`expo-modules-autolinking react-native-config --platform android --json`)은
   `react-native-gesture-handler` · `react-native-reanimated` · `react-native-worklets`를 Android 대상으로
   잡는다(같은 명령이 `@react-native-masked-view/masked-view` · `expo` ·
   `react-native-safe-area-context` · `react-native-screens`도 잡는다). 네이티브 빌드가 이 버전들을
   컴파일하게 되는지는 아직 빌드하지 않아 재지 못했다. D1 계획 Task 4가 이 셋을 `expo install`로 직접
   설치하므로 그때 `pnpm peers check`를 다시 본다. 이 태스크에서는 손대지 않았다.
5. **Windows 경로 길이.** `node_modules`를 락파일로 다시 깐 트리에서 `node_modules/.pnpm` 아래 파일 33,314개
   가운데 절대 경로가 260자를 넘는 것이 2,075개이고 가장 긴 것은 354자다. 저장소 루트
   (74자)를 뺀 상대 경로만도
   279자라 저장소를 더 짧은 경로로 옮겨도 260자를 넘는 파일이 남는다. 가장 긴 파일은 `react-native`의
   `ReactCommon/react/renderer/components/legacyviewmanagerinterop/platform/ios/…ComponentDescriptor.mm`(iOS용
   소스)이다. 260자를 넘는 2,075개는 `react-native` 691개, `react-native-screens` 389개,
   `@react-native/debugger-frontend` 201개, `react-native-gesture-handler` 162개, `react-native-reanimated` 133개,
   `expo-modules-core` 110개 등이고, 이 가운데 948개는 경로에 `android` 또는 `ReactAndroid` 폴더가 있다
   (예: `@react-native-masked-view/masked-view`의 Java 소스 273~280자). Windows의 `LongPathsEnabled`는 1이고
   git의 `core.longpaths`는 설정되어 있지 않다.
   그 결과 `git status --ignored`는 이 폴더들을 `Filename too long` 경고로 열지 못했다(`--ignored`가 없는
   `git status`는 이 폴더로 들어가지 않아 영향이 없다). Node 기반 도구(`expo export`·`tsc`·pnpm)는 영향 없이
   돌았다. Gradle·CMake 네이티브 빌드가 이 경로를 읽을 때 문제가 되는지는 아직 빌드하지 않아 재지 못했고,
   hoisted 배치의 경로 길이도 재지 않았다.

### 재판정 (2026-09-30, M1 빌드)

위 "정한 것"은 Android Release 빌드가 링커 때문에 실패하면 이 판정을 다시 연다고 적어 두었다. M1의 Release 빌드가
그렇게 실패했다. 저장소를 6자 경로에 두었을 때 isolated는 실패하고 hoisted는 성공했다. 명령과 오류 원문은 아래 M1 절의
"Release 빌드"에 있다. 그래서 `pnpm-workspace.yaml`에 `nodeLinker: hoisted`를 두었다.

Metro 쪽 판정은 바뀌지 않는다. hoisted 배치에서 Release 빌드 안의 Gradle 번들링이 `entry.js (1466 modules)`를 묶었고,
isolated에서 `expo export`(android)가 묶은 모듈 수와 같다. 링커를 바꾸게 한 것은 Metro가 아니라 Gradle·CMake·ninja가
`node_modules/.pnpm` 아래 경로를 감당하지 못한 일이다. 위 관찰 5가 측정하지 못했다고 적은 부분이다.

## M7 — app.config.ts 의 .ts import

`app.config.ts`는 검증 함수를 두 벌 두지 않으려고 `lib/config/app-variant.ts`와 `lib/config/settings.ts`를
확장자를 포함해(`./lib/config/app-variant.ts`) import한다. Expo CLI가 이 파일을 평가할 때 그 import가
풀리는지 쟀다. 환경은 Node 24.19.0 · pnpm 11.22.0 · Windows 11(Git Bash)이고, 설치된 버전은 `expo` 57.0.26 ·
`@expo/cli` 57.0.27 · `@expo/config` 57.0.9 · `@expo/require-utils` 57.0.5 · `typescript` 6.0.3이다.
재기 전에 `tsconfig.json`의 `compilerOptions`에 `allowImportingTsExtensions: true`를 더했다.
`expo/tsconfig.base`가 `noEmit: true`라 `tsc`가 이 옵션을 허용한다.

### 성공 경로 — e2e 변형

```bash
BACKEND_URL=http://probe-backend:4321 APP_VARIANT=e2e pnpm exec expo config --type public --json > "$TMPDIR/m7-e2e.json"; echo "exit=$?"
node -e "const c=require(process.argv[1]); console.log(c.android.package, c.scheme, JSON.stringify(c.extra))" "$TMPDIR/m7-e2e.json"
```

```text
exit=0
com.example.templateexpo.e2e templateexpo-e2e {"backendUrl":"http://probe-backend:4321","appVariant":"e2e","router":{}}
```

`extra.router`는 `expo-router` 플러그인(`expo-router/plugin/build/withRouter.js`)이 `config.extra`에 병합하는
값이다. `app.config.ts`가 싣는 것은 `backendUrl`과 `appVariant` 둘이다. 같은 JSON에서 `name`은
`Template Expo (E2E)`, `ios.bundleIdentifier`는 `com.example.templateexpo.e2e`,
`ios.infoPlist.NSAppTransportSecurity`는 `{"NSAllowsLocalNetworking":true}`, `plugins`의
`expo-build-properties` 옵션은 `{"android":{"usesCleartextTraffic":true}}`다.

### 실패 경로 — 필수 변수 없음, 배포 변형의 http

`expo config --type public --json 2>&1 | tail -5`로 자르면 오류 문구가 잘려 Expo 내부 프레임만 남는다. 그래서
파일로 받아 앞부분을 적는다. 두 경우 모두 `expo config`가 exit 1로 멈추고 문구는 `app.config.ts`가 부른 검증
함수의 것이다.

```bash
env -u BACKEND_URL pnpm exec expo config --type public --json > "$TMPDIR/m7-nourl.out" 2>&1; echo "exit=$?"
head -9 "$TMPDIR/m7-nourl.out"
```

```text
exit=1
Error: Error reading Expo config at <저장소 루트>\app.config.ts:

BACKEND_URL is required
Error: Error reading Expo config at <저장소 루트>\app.config.ts:

BACKEND_URL is required
    at requireAbsoluteUrl (file:///<저장소 루트>/lib/config/settings.ts:29:11)
    at loadSettings (file:///<저장소 루트>/lib/config/settings.ts:46:17)
    at appConfig (<저장소 루트>\app.config.js:23:59)
```

출력은 16줄이고 이하 7줄은 Expo 내부 프레임이다.

```bash
BACKEND_URL=http://probe-backend:4321 APP_VARIANT=production pnpm exec expo config --type public --json > "$TMPDIR/m7-prodhttp.out" 2>&1; echo "exit=$?"
head -8 "$TMPDIR/m7-prodhttp.out"
```

```text
exit=1
Error: Error reading Expo config at <저장소 루트>\app.config.ts:

BACKEND_URL must use https for the production variant (got "http://probe-backend:4321")
Error: Error reading Expo config at <저장소 루트>\app.config.ts:

BACKEND_URL must use https for the production variant (got "http://probe-backend:4321")
    at assertBackendUrlAllowed (file:///<저장소 루트>/lib/config/app-variant.ts:67:11)
    at appConfig (<저장소 루트>\app.config.js:24:50)
```

출력은 16줄이고 이하 8줄은 Expo·Node 내부 프레임이다.

`app.config.ts`를 평가하는 다른 명령도 같은 검증에서 멈춘다. `BACKEND_URL` 없이 돌린 `pnpm exec expo export --platform android`와
`pnpm types:routes`는 둘 다 같은 `BACKEND_URL is required` 오류로 exit 1이고 번들 폴더를 만들지 않는다. 그래서 위 M5 절의
`expo export` 명령을 이 뒤로 다시 돌릴 때는 `BACKEND_URL`을 함께 준다.

### 누가 `.ts` import를 처리하는가

실패 경로의 스택에서 `settings.ts`와 `app-variant.ts`는 `file:///<저장소 루트>/lib/config/*.ts` 프레임으로, 줄 번호는 원본
소스와 같다(`settings.ts:29`는 `throw new Error(`${name} is required`)` 줄, `app-variant.ts:67`은 `throw new Error(`
줄). `app.config.ts`는 `app.config.js` 프레임으로 나타난다. `@expo/require-utils@57.0.5`의 `loadModuleSync`는
진입 파일 `app.config.ts` 하나만 프로젝트의 TypeScript로 변환해 `app.config.js`라는 이름으로 평가한다. 그 안의
`./lib/config/*.ts`는 Node가 직접 읽는 것으로 보인다. 이를 가르려고 Node의 type stripping을 끄고 e2e 변형 명령을
다시 돌렸다.

```bash
node -p "process.features.typescript"
NODE_OPTIONS=--no-experimental-strip-types node -p "process.features.typescript"
NODE_OPTIONS=--no-experimental-strip-types BACKEND_URL=http://probe-backend:4321 APP_VARIANT=e2e pnpm exec expo config --type public --json > "$TMPDIR/m7-nostrip.out" 2>&1; echo "exit=$?"
head -6 "$TMPDIR/m7-nostrip.out"
```

```text
strip
false
exit=1
SyntaxError: Error reading Expo config at <저장소 루트>\app.config.ts:

Unexpected identifier 'as'
SyntaxError: Unexpected identifier 'as'
    at compileSourceTextModule (node:internal/modules/esm/utils:318:16)
    at ModuleLoader.importSyncForRequire (node:internal/modules/esm/loader:336:18)
```

출력에 파일 이름은 없다. `lib/config`에서 ` as `가 나오는 파일은 `app-variant.ts`뿐이고(8행 `as const`), type stripping을
끄면 Node가 `.ts`를 그냥 JavaScript로 읽다 그 줄에서 죽는다. 그러므로 `.ts` import를 푸는 쪽은 Node의 type
stripping이다.

### 정한 것

- **M7 = 예.** 대체 경로(`app.config.ts` 안에 검증을 복사하고 두 구현을 표로 교차 검증하는 테스트)는 쓰지
  않는다. `app.config.ts`는 `lib/config/*.ts`를 확장자 포함으로 import하고, 검증 함수는 앱이 시작할 때 쓰는
  것과 같다(스펙 10.1). `pnpm typecheck`(`tsc --noEmit`)는 `allowImportingTsExtensions`로 통과하고, vitest는 같은
  import를 자체 변환으로 읽는다(`test/unit/config/app-config.test.ts` 6개 통과).
- **전제는 Node의 type stripping이다.** 확인한 Node는 24.19.0 하나다. `package.json`의 `engines.node` 하한
  (`>=24.11.0`)과 EAS 빌드 서버의 Node에서는 재지 않았다. EAS 빌드는 계정과 빌드 크레딧이 필요해 스펙 10.7이
  따로 두는 실증에 속한다.
- **`.ts` 파일이 지켜야 할 것.** `process.features.typescript`가 `strip`이다. strip 모드는 타입 구문만 지우고
  `enum` 같은 런타임 구문은 변환하지 않는다(Node 문서의 정의). 그래서 `app.config.ts`에서 직접·간접으로 import되는
  `.ts` 파일은 타입을 지우면 그대로 도는 구문만 쓰고, 그 파일들 사이의 import도 확장자를 포함해야 한다. 지금 그런
  파일은 `lib/config/app-variant.ts`와 `lib/config/settings.ts` 둘이고 둘 다 import가 없다.

## M1 — UI 스택 렌더

Uniwind + React Native Reusables 컴포넌트가 SDK 57의 Android **Release** 빌드에서 렌더되는지 쟀다. 환경은 Node 24.19.0 ·
pnpm 11.22.0 · Windows 11(Git Bash) · OpenJDK 17.0.20 · Gradle 9.3.1(래퍼) · CMake 3.22.1(ninja 1.10.2) · NDK
27.1.12297006이고, 기기는 에뮬레이터 `Pixel_9_API_36`(Android 16, API 36, x86_64, 1080x2424, 420dpi)이다. 앱은
`APP_VARIANT=e2e`, `BACKEND_URL=http://10.0.2.2:4100`이다. 새로 설치한 버전은 `uniwind` 1.12.0 · `tailwindcss` 4.3.3 ·
`tw-animate-css` 1.4.0 · `class-variance-authority` 0.7.1 · `clsx` 2.1.1 · `tailwind-merge` 3.7.0 ·
`@rn-primitives/slot` 1.5.2 · `@rn-primitives/portal` 1.5.3 · `lucide-react-native` 1.49.0 ·
`react-native-reanimated` 4.5.1 · `react-native-worklets` 0.10.1 · `react-native-gesture-handler` 2.32.0 ·
`react-native-svg` 15.15.4이고, 컴포넌트는 `@react-native-reusables/cli` 0.7.1이 `components/ui/`에 만들었다.

요약이다. 명령과 출력은 아래 절에 있다.

- **렌더된다.** 앱이 크래시 없이 뜨고(`logcat`에 `FATAL EXCEPTION` 없음, `ReactNativeJS: Running "main"`), UI 덤프에 두 텍스트가
  나오며, 스크린샷의 색은 `global.css` 토큰을 sRGB로 바꾼 값과 같다. 다크 모드도 같다.
- **이 머신의 저장소 위치(74자)에서는 APK가 만들어지지 않는다.** isolated도 hoisted도 실패했다. 같은 파일을 짧은 경로에
  복사해 hoisted로 만들면 성공하고, isolated는 6자 경로에서도 실패했다. hoisted에서 성공한 가장 긴 경로는 47자,
  실패한 가장 짧은 경로는 50자다.
- **Uniwind 1.12.0은 같은 `@media` 블록의 둘째 규칙부터 미디어 조건을 잃는다.** 폰 폭(411dp)에서도 `Button`의 `sm:h-9`가
  적용되어 버튼 높이가 `h-10`(40dp)이 아니라 36dp다.

### 의존성과 peer

```bash
BACKEND_URL=https://gate-check.invalid pnpm exec expo install react-native-reanimated react-native-worklets react-native-gesture-handler react-native-svg
pnpm add uniwind@1.12.0 tailwindcss@4.3.3 tw-animate-css@1.4.0 class-variance-authority@0.7.1 clsx@2.1.1 tailwind-merge@3.7.0 @rn-primitives/slot@1.5.2 @rn-primitives/portal@1.5.3 lucide-react-native@1.49.0
```

```text
› Installing 4 SDK 57.0.0 compatible native modules using pnpm
> pnpm add react-native-reanimated@4.5.1 react-native-worklets@0.10.1 react-native-gesture-handler@~2.32.0 react-native-svg@15.15.4
```

`app.config.ts`가 `BACKEND_URL` 없이는 멈추므로(M7) `expo` 명령에는 값을 주었다. `pnpm add`는 `pnpm-workspace.yaml`의
`minimumReleaseAgeExclude`에 `lucide-react-native@1.49.0`을 스스로 적었다(2026-09-29 22:27 UTC 릴리스). 빌드 스크립트 허용을
묻는 항목은 없었고 `.modules.yaml`의 `ignoredBuilds`·`pendingBuilds`는 빈 배열이다. `expo install`은 `app.json`을 만들지
않았고, 새 패키지 가운데 `app.config.ts`의 `plugins`에 넣어야 하는 것은 없었다(prebuild와 Release 빌드가 플러그인 없이 끝났다).

`pnpm peers check`의 변화다.

| 시점 | 결과 |
| --- | --- |
| 이 작업 전 | exit 1 — `react-native-worklets` 0.13.0(`expo-modules-core@57.0.20`은 `^0.10.0`까지), `@react-native/metro-config` 0.87.1(`@react-native/community-cli-plugin@0.86.3`은 `0.86.3`), `react-dom` 없음 |
| `expo install` 뒤 | exit 1 — `react-dom` 없음(`@radix-ui/*` 9개와 `vaul`). 앞의 둘은 사라졌다. SDK 고정값(reanimated 4.5.1 · worklets 0.10.1)이 들어오며 reanimated 4.7.0 → worklets 0.13.0 → metro-config 0.87.1 연쇄가 함께 없어졌다 |
| 아래 세 가지를 한 뒤 | exit 0 — `No peer dependency issues found` |

1. `pnpm-workspace.yaml`에 `peerDependencyRules.ignoreMissing: [react-dom]`를 두었다. 웹은 대상이 아니다(스펙 1.2).
2. `@react-native/metro-config@0.86.3`을 devDependency로 고정했다. `expo install` 뒤에는 이미 0.86.3으로 풀려 있었다.
3. `metro@0.84.5` · `metro-cache@0.84.5` · `metro-transform-worker@0.84.5`를 devDependencies로 고정했다. 이유는 아래에 있다.

**Uniwind의 peer가 가리키는 Metro.** Uniwind 1.12.0의 peer는 `metro`·`metro-cache`(필수), `@expo/metro-config`·
`metro-transform-worker`(선택)다. pnpm이 자동으로 푼 것은 `metro`·`metro-cache`·`metro-transform-worker` 0.84.6이었다. Expo의
Metro는 `@expo/metro@56.0.2`가 `metro` 계열을 0.84.5로 고정해 둔 것이고 `@expo/metro-config@57.0.12`가 이를 쓴다. 0.84.6은
`@react-native/community-cli-plugin`이 끌어온 복사본이다. 둘이 다르면 문제가 되는 이유는 `uniwind/metro`가
`require("metro/private/DeltaBundler/Graph")`로 얻은 Graph 클래스의 `initialTraverseDependencies`·`traverseDependencies`
프로토타입을 덮어쓰고 `metro-cache/private/stores/FileStore`를 상속하기 때문이다. Uniwind 자리에서 0.84.6이 풀리면 덮어쓴
Graph는 `@expo/metro`가 쓰는 0.84.5의 Graph와 다른 모듈 인스턴스다. 고정한 뒤 잠금 파일의 uniwind 스냅샷 키는
`(@expo/metro-config@57.0.12…)(metro-cache@0.84.5)(metro-transform-worker@0.84.5)(metro@0.84.5)`다. 0.84.6은
`react-native`·`@react-native/community-cli-plugin`·`@react-native/metro-config`가 자기 용도로 끌어온 복사본으로 잠금 파일에
남는다. Expo의 번들러와는 관계가 없다.

### 컴포넌트 — React Native Reusables CLI

```bash
BACKEND_URL=https://gate-check.invalid pnpm dlx @react-native-reusables/cli@0.7.1 add text button icon --styling-library uniwind --yes
```

```text
ℹ Styling Library: Uniwind
✔ Created 3 files:
  - components\ui\text.tsx
  - components\ui\icon.tsx
  - components\ui\button.tsx
⚠ 4 Potential issues found. For more info, run: 'npx @react-native-reusables/cli doctor'
```

CLI는 `package.json`과 `lib/utils.ts`를 건드리지 않았다. `pnpm format`은 이 세 파일만 고쳤다(세미콜론 제거, 후행 쉼표 추가 등).
`doctor`는 대화형이다. `The tailwindcss-animate dependency is missing. Do you want to install it? (Y/n)`에서 입력을 기다리며
멈춘다(240초 제한에 걸려 exit 124). `tailwindcss-animate`는 Tailwind v3 플러그인이고 이 저장소는 v4용 `tw-animate-css`를
쓰므로 답하지 않았고, 나머지 세 건은 보지 못했다.

`exactOptionalPropertyTypes: true` 아래에서 `pnpm typecheck`가 받은 파일 하나를 거부했다.

```text
components/ui/text.tsx(49,7): error TS2375: Type '{ h1: "heading"; ...; blockquote: Role | undefined; code: Role | undefined; }' is not assignable to type 'Partial<Record<TextVariant, Role>>' with 'exactOptionalPropertyTypes: true'.
```

`Platform.select({ web: ... })`가 `Role | undefined`를 돌려주기 때문이다. `ROLE`의 타입을 `Partial<Record<TextVariant, Role | undefined>>`로
고치고 원본과 다른 곳임을 주석으로 남겼다. 받은 컴포넌트를 손댄 것은 이 한 줄이 전부다.

### 번들 — `expo export`

```bash
BACKEND_URL=https://gate-check.invalid pnpm exec expo export --platform android --platform ios --output-dir dist
```

exit 0. `iOS Bundled 13554ms … (1327 modules)`, `Android Bundled 18851ms … (1466 modules)`이고 번들 크기는 iOS 2.7MB,
Android 3.1MB다(M5 시점은 1098·1248 모듈, 2.3MB·2.7MB). 요청하지 않은 `web bundles (1)`로 0B짜리
`_expo/static/css/global-d41d8cd98f00b204e9800998ecf8427e.css`가 찍힌다. Metro가 `uniwind-types.d.ts`(248바이트)를 만들었다.

```ts
// NOTE: This file is generated by uniwind and it should not be edited manually.
/// <reference types="uniwind/types" />

declare module 'uniwind' {
    export interface UniwindConfig {
        themes: readonly ['light', 'dark']
    }
}

export {}
```

### 새 체크아웃의 타입체크

이 파일을 커밋하는 이유로 "Metro를 한 번도 돌리지 않은 체크아웃에서 typecheck가 `className` 타입을 모른다"가 있었다. 생성 파일 둘
(`uniwind-types.d.ts`, git이 무시하는 `expo-env.d.ts`)을 치워 새 체크아웃을 흉내 냈다.

| 있는 생성 파일(`css.d.ts`를 더하기 전) | `pnpm typecheck` |
| --- | --- |
| 둘 다 | exit 0 |
| `expo-env.d.ts`만 | exit 0 |
| `uniwind-types.d.ts`만 | exit 2 — `app/_layout.tsx` TS2882 한 건(`@/global.css` 부수 효과 import) |
| 둘 다 없음 | exit 2 — 5건: `app/(app)/index.tsx` TS2769(`View`의 `className`), `app/_layout.tsx` TS2882, `components/ui/button.tsx` TS2339·TS2322, `components/ui/text.tsx` TS2339 |

`View`의 `className`은 `expo-env.d.ts`가 참조하는 `expo/types/react-native-web.d.ts`가, `*.css` 모듈 선언은
`expo/types/global.d.ts`가 준다. `uniwind-types.d.ts`는 `uniwind/types`를 끌어와 `contentContainerClassName` 같은 Uniwind의
props와 테마 이름(`light`·`dark`)을 더한다. 그래서 새 체크아웃에서 `pnpm typecheck`를 통과시키는 것은 `pnpm types:routes`
(`expo customize tsconfig.json`)가 만드는 `expo-env.d.ts`다. `expo-env.d.ts`를 지우고
`BACKEND_URL=https://gate-check.invalid pnpm types:routes`를 돌리면 파일이 다시 생기고 `tsconfig.json`은 그대로이며
`pnpm typecheck`는 exit 0이다.

이 실패는 `*.css` 선언이 git이 무시하는 `expo-env.d.ts`에만 있어서 생긴다. 그래서 저장소 루트에 `css.d.ts`(`declare module '*.css'`)를 더했다.
그 뒤로는 커밋을 `git archive`로 받아 `pnpm install --frozen-lockfile`만 한 사본(생성 파일이 하나도 없다)에서 `pnpm typecheck`가
`pnpm types:routes` 없이 exit 0이다. `expo-env.d.ts`가 있을 때도 exit 0이라, 두 선언이 겹쳐도 오류가 없다.

이 절은 `tsconfig.json`에 `types`를 두기 전의 상태다. 뒤에 `types: ["expo/types"]`를 두자(아래 관찰 6) `expo/types`가 같은 `*.css` 선언을
주게 되어 `css.d.ts`는 중복이 됐다. 아래 "정한 것"을 본다.

### Release 빌드

`test/e2e/android.sh build`(= `APP_VARIANT=e2e pnpm exec expo prebuild --platform android --clean --no-install` 뒤
`./gradlew assembleRelease`)를 `BACKEND_URL=http://10.0.2.2:4100`으로 돌렸다. prebuild는 매번
`» android: userInterfaceStyle: Install expo-system-ui in your project to enable this feature.`를 낸다
(`app.config.ts`의 `userInterfaceStyle: 'automatic'`).

| # | 저장소 위치(경로 길이) | 링커 | 결과 |
| --- | --- | --- | --- |
| 1 | `<저장소 루트>`(74자) | isolated | 실패, 3m 35s — `configureCMakeRelWithDebInfo[arm64-v8a]` 두 개 |
| 2 | 같은 저장소를 `subst X:`로 드라이브 루트에 매핑(`X:\`) | isolated | 실패, 1초 — prebuild |
| 3 | 저장소의 부모 폴더를 `subst X:`로 매핑(`X:\template-typescript-expo`, 27자) | isolated | 실패, 12초 — `generateCodegenSchemaFromJavaScript` 네 개 |
| 4 | 74자 | hoisted | 실패, 1m 23s — `buildCMakeRelWithDebInfo` 두 개 |
| 5 | 커밋 대상 파일을 복사한 `C:\t\e`(6자) | isolated | 실패, 40초 — `buildCMakeRelWithDebInfo` 두 개 |
| 6 | `C:\t\e`(6자) | hoisted | **성공, 5m 3s** |

1~3은 경로 폴백(`subst`), 4는 링커 폴백이다. 5·6은 커밋 대상 파일만 복사하고 `pnpm install --frozen-lockfile`로 새로 설치한 작업
트리에서 쟀다. 원본 저장소는 옮기지 않았다. 시도마다 `expo prebuild --clean`이 `android/`를 새로 만든다.

**1. 74자, isolated.** Gradle이 CMake 구성 단계에서 `prefab_command.bat`를 시작하지 못한다.

```text
Execution failed for task ':react-native-worklets:configureCMakeRelWithDebInfo[arm64-v8a]'.
> [CXX1428] exception while building Json A problem occurred starting process 'command '<저장소 루트>\node_modules\.pnpm\react-native-worklets@0.10._def3c069969de18c77460f611c587fd2\node_modules\react-native-worklets\android\build\intermediates\cxx\RelWithDebInfo\402g4w3c\logs\arm64-v8a\prefab_command.bat''
Caused by: net.rubygrapefruit.platform.NativeException: Could not start '<저장소 루트>\…\prefab_command.bat'
```

`react-native-screens`도 같은 오류다. 실패한 두 `.bat`의 전체 경로는 279자와 278자다(`<저장소 루트>`는 74자). 같은 빌드의 JS 번들링은
성공했다: `Android Bundled 12626ms … (1466 modules)`, `Done writing bundle output`.

**2. `subst X:`(드라이브 루트).** `expo-modules-autolinking`이 프로젝트를 못 찾는다.

```text
✖ Prebuild failed
Error: Couldn't find "package.json" up from path "X:\"
    at findPackageJsonPathAsync (X:\node_modules\.pnpm\expo-modules-autolinking@57_…\build\commands\autolinkingOptions.js:127:11)
```

`findPackageJsonPathAsync`의 `for (let dir = root; path.dirname(dir) !== dir; dir = path.dirname(dir))`는 프로젝트가 드라이브 루트이면
처음부터 조건이 거짓이라 `X:\package.json`을 보지 않는다. 그래서 3에서는 부모 폴더를 매핑했다.

**3. `subst X:`(부모 폴더).** RN Gradle 플러그인의 codegen 태스크가 `X:`와 `C:` 경로를 섞는다.

```text
Execution failed for task ':react-native-gesture-handler:generateCodegenSchemaFromJavaScript'.
> this and base files have different roots: X:\template-typescript-expo\node_modules\.pnpm\@react-native+codegen@0.86._88ef50d3e46a14e4cb3ce2c2b07db85d\node_modules\@react-native\codegen\lib\cli\combine\combine-js-to-schema-cli.js and <저장소 루트>\node_modules\.pnpm\react-native-gesture-handle_b36ab204c3e9e0e9b3fd57438cb099df\node_modules\react-native-gesture-handler\android.
```

`react-native-safe-area-context`·`react-native-screens`·`react-native-svg`도 같다. `node_modules`의 링크는 상대 경로 symlink라
`X:` 안에서 풀리지만, `fs.realpathSync.native`는 `subst`를 벗겨 `C:` 경로를 돌려준다(`X:`에서
`fs.realpathSync.native('node_modules/react-native-worklets')`를 호출하면 `C:\Users\…` 경로가 나온다). 두 표기가 한 계산에 섞이면
실패한다. Git Bash에서는 `subst X: /D`의 `/D`가 경로로 바뀌어(`D:\`) 지워지지 않는다. `MSYS_NO_PATHCONV=1 subst X: /D`로 지웠다.

**4. 74자, hoisted.** CMake 구성은 통과하고 컴파일 직전에 ninja가 멈춘다.

```text
Execution failed for task ':react-native-worklets:buildCMakeRelWithDebInfo[arm64-v8a][worklets]'.
> com.android.ide.common.process.ProcessException: ninja: Entering directory `<저장소 루트>\node_modules\react-native-worklets\android\.cxx\RelWithDebInfo\6x1k4z1o\arm64-v8a'
  …
  ninja: error: manifest 'build.ninja' still dirty after 100 tries
```

`react-native-screens`(armeabi-v7a)도 같다. 이 링커에서 `node_modules` 아래 260자를 넘는 항목은 새로 설치한 직후 4개였다(가장 긴 274자는
`react-native`의 iOS용 `.mm`). `ninja -d explain`은 `build.ninja`를 다시 만드는 간선이 100번 모두 dirty로 남는 것을 보여 준다
(`output …/prefab/arm64-v8a/prefab/lib/aarch64-linux-android/cmake/ReactAndroid/ReactAndroidConfigVersion.cmake of phony edge with no inputs doesn't exist`).
그 파일은 있다(247자, `cmd /c dir`로 보인다). manifest를 복사해 `ninja -f`로 지정하고 `-n`으로 같은 간선을 평가하면 이 메시지가 나오지 않는다.
메커니즘은 찾지 못했다. 경로가 짧아지면 사라진다는 것만 확인했다(아래 표).

**5. 6자, isolated.** pnpm의 가상 저장소 폴더 이름이 길어 오브젝트 파일 경로가 CMake 한계를 넘고, 같은 ninja 오류로 끝난다.

```text
CMake Warning in CMakeLists.txt:
  The object file directory
    C:/t/e/node_modules/.pnpm/react-native-screens@4.26.2_aced07e5117f057188f2dedd35872928/node_modules/react-native-screens/android/.cxx/RelWithDebInfo/4a385504/arm64-v8a/CMakeFiles/rnscreens.dir/./
  has 195 characters.  The maximum full path to an object file is 250 characters (see CMAKE_OBJECT_PATH_MAX).  Object file
    C_/t/e/node_modules/.pnpm/react-native-screens@4.26.2_aced07e5117f057188f2dedd35872928/node_modules/react-native-screens/cpp/RNScreensTurboModule.cpp.o
  cannot be safely placed under this directory.  The build may not work correctly.
…
ninja: error: manifest 'build.ninja' still dirty after 100 tries
```

이 경고가 402번 찍혔다. 시도 4(hoisted)의 로그에는 없다. 이 트리에서 `node_modules/.pnpm` 아래 260자를 넘는 항목은 10개였고 가장 긴 것은 286자였다
(M5 관찰 5는 74자에서 파일 2,075개).

**6. 6자, hoisted.** 성공했다. 경로 길이만 바꿔 hoisted를 반복했다(폴더 이름 `template-typescript-expo` 24자를 포함한 저장소 루트의 길이).

| 저장소 루트 길이 | 결과 |
| --- | --- |
| 6자 | 성공, 5m 3s |
| 29자 | 성공, 8m 9s |
| 44자 | 성공, 8m 52s |
| 47자 | 성공, 5m 7s |
| 50자 | 실패, 3m 5s — `react-native-reanimated:buildCMakeRelWithDebInfo[armeabi-v7a][reanimated]`, `ninja: error: manifest 'build.ninja' still dirty after 100 tries` |
| 59자 | 실패, 4m 2s — `expo-modules-core:buildCMakeRelWithDebInfo[armeabi-v7a]`, `react-native-reanimated:buildCMakeRelWithDebInfo[arm64-v8a][reanimated]`, 같은 ninja 오류 |
| 74자 | 실패, 1m 23s — 위 4 |

29·44자와 50·59자는 다른 빌드와 동시에 돌려서 시간이 길다. 55자는 뺐다. 동시에 돌던 다른 Metro와 `%TEMP%\metro-cache`를 두고
`EPERM: Permission denied`(`FileStore.clear`의 `rmSync`)로 부딪혀 `createBundleReleaseJsAndAssets`가 죽었고, 경로와 관계가 없다.
48·49자는 재지 않았다. 한계는 지금의 네이티브 모듈 구성에서 잰 값이라 모듈이 늘면 낮아질 수 있다. 이 머신의 저장소(74자)에서
APK를 만들려면 커밋 대상 파일을 47자 이하의 경로에 복사해 거기서 `pnpm install --frozen-lockfile`과 `test/e2e/android.sh build`를 돌려야 한다.

성공한 빌드(6)의 끝이다.

```text
> Task :app:assembleRelease
BUILD SUCCESSFUL in 5m 3s
612 actionable tasks: 612 executed
-rw-r--r-- 1 <user> <group> 102792486 Sep 30 11:57 android/app/build/outputs/apk/release/app-release.apk
```

APK는 102,792,486바이트다(`reactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64`, `newArchEnabled=true`, `hermesEnabled=true`).
Gradle 안의 JS 번들링은 `Android Bundled 9426ms node_modules\expo-router\entry.js (1466 modules)`였다.

**이 APK의 앱 설정(JS)은 development였다.** 네이티브는 e2e(`com.example.templateexpo.e2e`)인데 에뮬레이터에 설치된 APK에서 꺼낸
`assets/app.config`(앱이 읽는 `Constants.expoConfig`)는 `name` `Template Expo (Dev)` · `scheme` `templateexpo-dev` ·
`extra.appVariant` `development` · `android.package` `com.example.templateexpo.dev`였다. `android.sh build`가 `APP_VARIANT=e2e`를
prebuild 명령에만 접두 대입해서, Gradle의 `createExpoConfig`(expo-constants의 Exec 태스크가 `getAppConfig.js`로 `app.config.ts`를 다시 평가한다)가
받지 못했다. `export APP_VARIANT=e2e`로 고치고 빌드 끝에서 `assets/app.config`의 `extra.appVariant`가 `e2e`인지 단언한다. 같은 방법(6자 경로 복사본,
hoisted)으로 다시 만든 APK(5m 41s, 102,792,646바이트)는 `name` `Template Expo (E2E)` · `scheme` `templateexpo-e2e` · `extra.appVariant` `e2e` ·
`android.package` `com.example.templateexpo.e2e`이고 단언이 통과했다. 옛 APK에 같은 단언을 돌리면 `extra.appVariant=development`로 exit 1이다.
다시 설치해 실행한 화면은 아래와 같다(UI 덤프의 텍스트 셋, 색 `#ffffff` · `#171717` · `#fafafa` · `#0a0a0a`, 크래시 없음).

### 설치와 실행

```bash
test/e2e/android.sh install
"$ANDROID_HOME/platform-tools/adb" shell am start -W -n com.example.templateexpo.e2e/.MainActivity
mkdir -p .maestro-output
test/e2e/android.sh wait-text Uniwind > .maestro-output/m1-ui.xml
grep -o 'text="[^"]*"' .maestro-output/m1-ui.xml
"$ANDROID_HOME/platform-tools/adb" exec-out screencap -p > .maestro-output/m1-home.png
```

```text
Performing Streamed Install
Success
Starting: Intent { cmp=com.example.templateexpo.e2e/.MainActivity }
Status: ok
LaunchState: COLD
Activity: com.example.templateexpo.e2e/.MainActivity
TotalTime: 2293
WaitTime: 2301
Complete
```

`wait-text Uniwind`는 3초 만에 exit 0으로 끝났다. UI 덤프의 `text=` 18개 가운데 빈 것 15개를 빼면 셋이 남는다.

```text
text="(app)/index"
text="template-typescript-expo"
text="Uniwind"
```

`(app)/index`는 `(app)` 그룹에 레이아웃이 아직 없어 Stack 헤더가 라우트 이름을 제목으로 쓴 것이다. 버튼 노드는 `android.widget.Button`,
`resource-id="home-probe-button"`(`testID`가 이렇게 나온다), `clickable="true"`, `bounds="[432,1372][649,1467]"`이다.
logcat에는 `ReactNativeJS: Running "main"`과 `Displayed com.example.templateexpo.e2e/.MainActivity for user 0: +2s293ms`가 있고
`FATAL EXCEPTION`은 없다. 프로세스는 계속 살아 있었다.

### 화면

스크린샷(1080x2424)을 열어 보았다. 흰 배경 한가운데 위쪽에 굵고 큰 "template-typescript-expo"가 있고, 그 아래에 어두운 둥근 버튼과 밝은 글자
"Uniwind"가 있다. 글자만 있는 스타일 없는 `Pressable`이 아니다. 색은 `global.css`의 `oklch()` 토큰을 sRGB로 바꾼 값과 같다.

| 요소 | 토큰 | 기대 | 측정 |
| --- | --- | --- | --- |
| 페이지 배경 `bg-background` | `oklch(1 0 0)` | `#ffffff` | `#ffffff` |
| 버튼 배경 `bg-primary` | `oklch(0.205 0 0)` | `#171717` | `#171717` |
| 버튼 글자 `text-primary-foreground` | `oklch(0.985 0 0)` | `#fafafa` | `#fafafa` |
| 제목 글자 `text-foreground` | `oklch(0.145 0 0)` | `#0a0a0a` | `#0a0a0a` |
| 헤더 글자(`NAV_THEME.light.text`, `hsl(0 0% 3.9%)`) | — | `#0a0a0a` | `#0a0a0a` |

치수는 420dpi(2.625px/dp)로 읽는다. 버튼 왼쪽 안쪽 여백 42px = 16dp(`px-4`), 위아래 21px = 8dp(`py-2`), 글자 줄 높이 53px = 20dp(`text-sm`), 제목
노드 높이 84px = 32dp(`text-2xl`의 줄 높이)다. 모서리는 둥글다(맨 위 줄의 첫 어두운 픽셀이 왼쪽 끝에서 18px 안쪽이고 18행 아래에서 0px이다.
반지름 약 21px = 8dp = `rounded-md`). 버튼 높이는 95px(36dp)이다. `h-10`이면 105px(40dp)여야 한다(아래 "Uniwind 1.12.0의 `@media` 블록 결함").

다크 모드는 `adb shell cmd uimode night yes`로 바꿔 같은 화면을 찍었다(끝나고 `night no`로 되돌렸다).

| 요소 | 토큰 | 기대 | 측정 |
| --- | --- | --- | --- |
| 페이지 배경 | `--color-background` `oklch(0.145 0 0)` | `#0a0a0a` | `#0a0a0a` |
| 헤더 배경(`NAV_THEME.dark.background`, `hsl(0 0% 3.9%)`) | — | `#0a0a0a` | `#0a0a0a` |
| 버튼 배경 | `--color-primary` `oklch(0.922 0 0)` | `#e5e5e5` | `#e5e5e5` |
| 버튼 글자 | `--color-primary-foreground` `oklch(0.205 0 0)` | `#171717` | `#171717` |
| 제목 글자 | `--color-foreground` `oklch(0.985 0 0)` | `#fafafa` | `#fafafa` |

상태 표시줄 글자도 밝게 바뀐다(`StatusBar style="light"`). `useUniwind().theme` · `ThemeProvider` · `@variant dark`가 Release에서 동작한다.

### Uniwind 1.12.0의 `@media` 블록 결함

버튼이 36dp인 이유를 찾았다. Tailwind는 `sm:` 규칙 여섯 개를 한 블록으로 낸다(`compiler.build(scanner.scan())`의 출력).

```css
@media (width >= 40rem) {
  .sm\:mt-6  { margin-top: calc(var(--spacing) * 6); }
  .sm\:h-8   { height: calc(var(--spacing) * 8); }
  .sm\:h-9   { height: calc(var(--spacing) * 9); }
  .sm\:h-10  { height: calc(var(--spacing) * 10); }
  .sm\:w-9   { width: calc(var(--spacing) * 9); }
  .sm\:pl-6  { padding-left: calc(var(--spacing) * 6); }
}
```

컴파일된 스타일시트(`expo export --platform android --no-bytecode`의 번들)에서 여섯 항목은 이렇다.

| 클래스 | `minWidth` | `complexity` | `dependencies` |
| --- | --- | --- | --- |
| `sm:mt-6` | 640 | 1 | `[9,3]` |
| `sm:h-8` `sm:h-9` `sm:h-10` `sm:w-9` `sm:pl-6` | 0 | 0 | `[9]` |

첫 규칙만 조건을 얻고 나머지 다섯은 조건 없는 클래스로 컴파일된다. `node_modules/uniwind/dist/metro/transformer.cjs`의 `parseRuleRec`에서
`rule.type === "media"` 분기가 안쪽 규칙마다 `this.declarationConfig = this.getDeclarationConfig()`로 설정을 초기화하기 때문이다. 첫 규칙을
처리한 뒤 `mediaQueries`가 빈 배열이 된다. 런타임은 `style.minWidth > screen.width`인 항목만 건너뛰는데(`store.ts`), `screen.width`는
`Dimensions.get('window').width`(dp)라서 411dp 폰에서 `sm:h-9`(`minWidth` 0)가 `h-10`을 덮어쓴다. React Native Reusables `Button`의 기본
크기는 `h-10 px-4 py-2 sm:h-9`이므로 폰에서도 36dp다. `Text`의 `p` 변형(`mt-3 leading-7 sm:mt-6`)은 `sm:mt-6`이 첫 규칙이라 정상이다.
`md:` 같은 다른 브레이크포인트도 같은 블록에 규칙이 여럿이면 같을 것으로 보이나, 지금 번들에는 `sm:`만 있어 재지 않았다. `uniwind`의
npm `latest`는 1.12.0(2026-09-04)이라 고쳐진 릴리스는 아직 없다.

### 함께 관찰한 것

1. **expo-doctor는 20/21이다.** 실패 한 건은 `Check package.json for common issues` — `The following scripts in package.json conflict with the contents of node_modules/.bin: secretlint.`이다.
   이 작업 이전의 커밋(`b22c2e2`, isolated)을 새로 받아 설치해도 같은 결과라 이번 변경 때문이 아니다. 검사가 지목한 것은 `secretlint` 스크립트이고,
   M5의 21/21은 그 스크립트가 생기기 전에 잰 것이다. 새 의존성에 대한 SDK 호환 검사는 모두 통과한다.
2. **`userInterfaceStyle` 경고.** prebuild의 `Install expo-system-ui in your project to enable this feature.`가 그대로 남아 있다. 다크 모드는
   위 표대로 JS 쪽(Uniwind·내비게이션 테마·상태 표시줄)에서 동작한다. `expo-system-ui`를 설치했을 때 네이티브 쪽에서 무엇이 달라지는지는 재지 않았다.
3. **기기 도우미 `boot`.** 처음 `E2E_AVD=Pixel_9_API_36 test/e2e/android.sh boot`는 8분 가까이 지나도 `adb devices`에 기기가 나타나지 않았고(에뮬레이터 프로세스는
   떠 있었으나 콘솔 포트 5554가 열리지 않음) 프로세스를 직접 종료했다. 스크립트의 `adb wait-for-device`에는 시간 제한이 없어 이 경우 스크립트도 끝나지 않는다.
   같은 플래그(`-verbose`만 더함)로 다시 띄운 에뮬레이터는 약 2분 뒤 등록됐고, 그 뒤 에뮬레이터를 끄고 스크립트로 다시 부팅하니 20초 안에 exit 0으로 끝나고
   애니메이션 배율 셋이 0이 되었다. 첫 실행이 멈춘 이유는 찾지 못했다. 그 뒤 스크립트를 고쳤다. 기기 등록도 `BOOT_TIMEOUT_SECONDS`(기본 300, 환경 변수로 바꿀 수 있다) 안에서
   `device_count`로 기다리고, 띄운 에뮬레이터가 죽었는지 `kill -0`으로 보고, 에뮬레이터 출력을 `${TMPDIR:-/tmp}/e2e-emulator-<AVD>.log`에 남겨 실패할 때 꼬리 20줄을 낸다.
   `device_count`는 `ANDROID_SERIAL`이 있으면 그 기기만 센다(`adb devices`는 이 변수를 무시한다). 세 경로를 시험했다. 연결된 기기는 0.4초에 exit 0이고,
   없는 AVD 이름(`__no_such_avd__`)은 곧바로 exit 1과 emulator의 `Unknown AVD name` 오류를 낸다. 살아 있지만 등록되지 않는 가짜 emulator는 제한 10초에서 11초 만에 exit 1과
   로그 꼬리를 낸다.
4. **Uniwind의 Metro 캐시 디렉터리는 고정이다.** `uniwind/metro`의 `cacheStore`는 `os.tmpdir()/metro-cache` 하나를 쓴다. 같은 머신에서 Metro가 동시에 둘 돌면
   위의 `EPERM`처럼 서로 지우려다 부딪힐 수 있다(Release 빌드를 병렬로 돌렸을 때 재현됐다).
5. **`components/ui/`의 `Platform.select({ web: … })` 분기는 이 저장소에서 실행되지 않는다.** 웹은 대상이 아니지만(스펙 1.2) 원본과 어긋나지 않게 그대로 두었다.
6. **새 체크아웃의 `pnpm lint`는 `expo-env.d.ts` 없이는 실패했다.** 커밋을 `git archive`로 받아 `pnpm install --frozen-lockfile`만 한 사본에서
   `app.config.ts`(26·27행)와 `lib/config/settings.ts`(46행)의 `process.env.…`가 `any`로 잡혀 `@typescript-eslint/no-unsafe-argument`·`no-unsafe-assignment` 3건이 났다.
   이 작업 이전의 `b22c2e2`를 같은 방법으로 받아도 같았다. 원인은 TypeScript 6.0에서 `types`의 기본값이 빈 목록이라 `@types/node`가 프로그램에 들어오지 않고(프로그램 안의
   `@types/node` 파일 0개), `process`가 `expo-modules-core/build/ts-declarations/global.d.ts`의 느슨한 선언으로 잡히는 것이다. `expo-env.d.ts`가 있으면 `expo/types`의 선언이 잡혀 통과했다.
   스크래치 사본에서 `compilerOptions.types: ["node"]`는 이를 고치지 못했고(lint 3건 그대로), `["expo/types"]`는 `expo-env.d.ts` 없이 typecheck·lint·test가 모두 exit 0이었다.
   그래서 `tsconfig.json`의 `compilerOptions`에 `"types": ["expo/types"]`를 두었다. `expo-env.d.ts`가 쓰는 `/// <reference types="expo/types" />`와 같은 참조다(JSON이라 주석을 달 수 없어 이유를 여기에 적는다).
7. **타입 프로그램을 둘로 나눴다.** `node:fs`·`node:child_process`를 import하는 시험 파일은 `types`에 `"node"`가 없으면 `TS2591: Cannot find name 'node:fs'. … add 'node' to the types field in your tsconfig`로
   실패한다(`types`를 바꾸기 전에도, `expo-env.d.ts`가 있어도 같았다). `types`에 `"node"`를 전역으로 더하면(`["expo/types", "node"]`, 순서를 바꿔도 같다) 그 시험 파일은 통과하지만 전역 `setTimeout`의 반환형이
   `NodeJS.Timeout`이 되어 앱 코드의 `const handle: number = setTimeout(…)`이 `TS2322`로 실패한다. 그래서 루트 `tsconfig.json`(`types: ["expo/types"]`, `expo/tsconfig.base`의 `exclude` 여섯 항목에 `test`를 더한 `exclude`)은
   `app/`·`components/`·`lib/`·`platform/`·`app.config.ts`·`css.d.ts`·`uniwind-types.d.ts`·타입드 라우트 파일을 Node 전역 없이 검사한다(프로그램 안의 `@types/node` 파일 0개). `test/tsconfig.json`(루트를 `extends`,
   `types: ["expo/types", "node"]`, `include: ["**/*.ts"]`, 루트의 `test` 제외를 물려받지 않도록 `exclude: []`)은 시험 파일과 그들이 import하는 `lib/`·`app.config.ts` 파일을 Node 타입과 함께 검사한다(프로그램 안의 `@types/node` 파일이 66개다 - 세는 명령은 아래 "게이트를 세우며 확인한 것"). `pnpm typecheck`는
   `tsc --noEmit -p tsconfig.json && tsc --noEmit -p test/tsconfig.json`이다. 시험 파일이 import하는 `lib/` 파일은 두 프로그램에서 모두 검사된다. 그런 파일에서 타이머 핸들의 타입은 `ReturnType<typeof setTimeout>`만 둘 다 통과한다(`number`는 테스트 프로그램에서 `TS2322`,
   `NodeJS.Timeout`은 앱 프로그램에서 `TS2694`로 실패한다).
   ESLint의 `projectService`는 파일에서 가장 가까운 `tsconfig.json`을 쓰므로 시험 파일은 `test/tsconfig.json`으로 타입 규칙을 받는다. 임시 프로브로 확인했다. `node:fs`·`node:child_process`·`process.env`를 쓰는 시험 파일과
   `number = setTimeout(…)`을 쓰는 `lib/` 파일을 함께 두어도 `pnpm typecheck`는 exit 0이고, 같은 `setTimeout` 줄을 시험 프로브에 더하면 테스트 프로그램에서만 `TS2322`가 나며, 시험 프로브에 넣은 미대기 Promise는
   `@typescript-eslint/no-floating-promises`로 보고된다(깨끗한 프로브에서는 `no-unsafe-*`가 없다).
8. **`expo export`가 종료할 때 간헐적으로 죽는다(게이트 [10/11]).** 2026-09-30 17:50 무렵부터 이 머신에서 `expo export --platform android --platform ios`가 `Exported: dist`까지 출력한 뒤
   (한 번은 그 전에) `STATUS_ACCESS_VIOLATION`(0xC0000005)으로 끝나는 일이 잦았다. PowerShell의 종료 코드는 -1073741819이고 Git Bash에서는 139 `Segmentation fault`다. Metro 캐시를 그대로 둔
   26회 중 13회가 죽었고 `--clear`를 준 10회는 모두 exit 0이었다. `pnpm exec`을 빼고 `node node_modules/expo/bin/cli export`로 돌려도, `dist`를 지우고 돌려도 죽었다. 같은 세션의 앞선 게이트
   실행 셋은 모두 exit 0이었다. 원인은 찾지 못했다(`node.exe`의 Windows 오류 보고 이벤트가 남지 않았다). 그래서 게이트의 [10/11]은 `--clear`를 준다. `--clear`는
   `os.tmpdir()/metro-cache`(관찰 4)를 지워 같은 머신의 다른 Metro와 부딪힐 수 있으므로, 게이트를 돌리기 전에 이 저장소의 `expo start`를 끈다.

### 게이트를 세우며 확인한 것 (`css.d.ts` · `@types/node` 파일 수 · `secretlint` 스크립트)

아래 "정한 것"의 세 문장이 기대는 명령과 출력이다. 파일과 `package.json`은 재고 나서 원래대로 되돌렸다.

**`css.d.ts`와 `expo-env.d.ts`를 치운 트리의 타입체크.** 두 파일을 미리 다른 폴더에 복사해 두고 지운 뒤 두 프로그램을 따로 돌렸다.

```bash
rm css.d.ts expo-env.d.ts
pnpm exec tsc --noEmit -p tsconfig.json;      echo "app-program tsc exit=$?"
pnpm exec tsc --noEmit -p test/tsconfig.json; echo "test-program tsc exit=$?"
```

```text
app-program tsc exit=0
test-program tsc exit=0
```

**프로그램 안의 `@types/node` 파일 수(관찰 7의 "66개").** 시험 프로그램은 66개, 앱 프로그램은 0개다.

```bash
pnpm exec tsc --noEmit -p test/tsconfig.json --listFilesOnly | grep -c '/@types/node/'
pnpm exec tsc --noEmit -p tsconfig.json --listFilesOnly | grep -c '/@types/node/'
```

```text
66
0
```

**`secretlint` 스크립트 이름과 expo-doctor.** `expo-doctor`는 `expo config`를 불러 `app.config.ts`를 평가하므로 `BACKEND_URL`이 필요하다. 없이 돌리면 doctor가 그 하위 호출의 실패를 그대로 낸다.

```bash
pnpm exec expo-doctor
```

```text
Error: node <저장소 루트>\node_modules\expo\bin\cli config --json --full exited with non-zero code: 1
```

값을 주고 스크립트 이름을 `lint:secrets`로 둔 상태(이 저장소)와, `sed`로 `secretlint`로 되돌린 같은 트리다.

```bash
BACKEND_URL=https://gate-check.invalid pnpm exec expo-doctor; echo "doctor exit=$?"
```

```text
Running 21 checks on your project...
21/21 checks passed. No issues detected!
doctor exit=0
```

```text
Running 21 checks on your project...
20/21 checks passed. 1 checks failed. Possible issues detected:
Use the --verbose flag to see more details about passed checks.

✖ Check package.json for common issues
The following scripts in package.json conflict with the contents of node_modules/.bin: secretlint.
Advice:
Update your package.json to remove conflicts.

1 check failed, indicating possible issues with the project.
doctor exit=1
```

### 정한 것

- **M1 = 예.** Uniwind + React Native Reusables를 유지한다. Release 빌드에서 렌더되고 라이트·다크 토큰이 그대로 나온다.
- **링커를 `nodeLinker: hoisted`로 바꾼다(M5 재판정).** Windows에서 Android 네이티브 빌드가 된 조합은 잰 것 가운데 hoisted + 47자 이하 경로뿐이었다. isolated는 6자 경로에서도 실패했다.
  Linux·macOS에서 isolated가 되는지는 이 머신에서 재지 못했다. CI가 잰다.
- **`uniwind-types.d.ts`와 `css.d.ts`를 커밋한다.** `uniwind-types.d.ts`는 Uniwind 전용 props와 테마 이름 타입을 준다. `css.d.ts`(`*.css` 선언)는
  더한 때에는 새 체크아웃의 `pnpm typecheck`를 통과시키는 파일이었다. 그 뒤 `tsconfig.json`에 `types: ["expo/types"]`를 두자(다음 항목, 관찰 6)
  `expo/types`의 `global.d.ts`(29행)가 같은 `declare module '*.css'`를 준다. 지금 새 체크아웃의 typecheck를 통과시키는 것은 `types: ["expo/types"]`이고,
  `css.d.ts`는 같은 선언을 한 번 더 하는 무해한 중복이다. `css.d.ts`와 `expo-env.d.ts`를 모두 치운 트리에서 `tsc --noEmit -p tsconfig.json`과
  `tsc --noEmit -p test/tsconfig.json`이 둘 다 exit 0이다(위 "게이트를 세우며 확인한 것").
- **`tsconfig.json`에 `"types": ["expo/types"]`를 둔다.** 새 체크아웃의 `pnpm lint`가 `expo-env.d.ts` 없이 통과한다(관찰 6).
- **타입 프로그램은 앱(`tsconfig.json`)과 시험(`test/tsconfig.json`) 둘이다.** 앱 코드에 Node 전역을 들이지 않으면서 시험이 `node:` 모듈을 import할 수 있다(관찰 7).
- **받은 컴포넌트는 `text.tsx`의 `ROLE` 타입 한 줄만 고쳤다.**
- **`secretlint` 스크립트를 `lint:secrets`로 바꾼다(게이트를 세울 때).** 스크립트 이름이 `node_modules/.bin/secretlint`를 가려 expo-doctor의
  `Check package.json for common issues`가 실패했다(관찰 1). 이름을 바꾸면 expo-doctor가 21/21(exit 0)이고, 같은 트리에서 옛 이름으로 되돌리면
  20/21(exit 1)에 같은 오류가 다시 난다(명령과 출력은 위 "게이트를 세우며 확인한 것").
  expo-doctor는 `expo config`를 불러 `app.config.ts`를 평가하므로 `BACKEND_URL`이 없으면 그 호출이 exit 1로 죽는다 - 게이트의 9단계도 다른 설정 평가 단계처럼 값을 준다.

아래는 이 기록이 정하지 않은 것이다.

- Uniwind의 `@media` 블록 결함에 어떻게 대응할지(패치, 다른 버전, `sm:` 회피). 지금은 `Button`의 높이만 눈에 띈다.
- 이 머신에서 APK를 만드는 방법(47자 이하 경로의 작업 트리). `test/e2e/android.sh`는 경로 길이를 검사하지 않는다.
- `expo-system-ui` 설치 여부.

## M8 — Maestro CLI

Maestro CLI가 Windows Git Bash에서 도는지 쟀다. 환경은 Windows 11(Git Bash) · OpenJDK 17.0.20(Temurin) · Maestro 2.11.0이고, 기기는
M1과 같은 에뮬레이터 `Pixel_9_API_36`(Android 16, API 36, `user` 빌드)이다. `~/.maestro`는 없었다.

### 설치

```bash
if [ -x "$HOME/.maestro/bin/maestro" ]; then "$HOME/.maestro/bin/maestro" --version; fi
TMP=$(mktemp -d)
curl -fL -o "$TMP/maestro.zip" https://github.com/mobile-dev-inc/maestro/releases/download/cli-2.11.0/maestro.zip
curl -fL -o "$TMP/checksums_sha256.txt" https://github.com/mobile-dev-inc/maestro/releases/download/cli-2.11.0/checksums_sha256.txt
(cd "$TMP" && sha256sum -c checksums_sha256.txt)
unzip -q "$TMP/maestro.zip" -d "$TMP/unzipped"
mkdir -p "$HOME/.maestro"
cp -r "$TMP/unzipped/maestro/." "$HOME/.maestro/"
"$HOME/.maestro/bin/maestro" --version; echo "exit=$?"
```

```text
maestro.zip: OK
2.11.0
exit=0
```

첫 명령은 아무것도 내지 않았다(설치돼 있지 않았다). 체크섬 파일은 한 줄(`5384593cb4e7a106489e75a821d157dd43f4e438df6bc308b72e82c685e1283a  maestro.zip`)이고
`maestro.zip`은 314,886,578바이트다. 풀린 `~/.maestro`는 346MB다. 버전 앞에는 익명 분석 안내와 "Analyze with Ai" 안내 상자가 붙는다(아래).

셸 런처가 Git Bash에서 그대로 돌아서 `.bat` 폴백은 필요하지 않았다. 그래도 한 번 재 보았다.

```bash
cmd //c "$(cygpath -w "$HOME/.maestro/bin/maestro.bat")" --version; echo "exit=$?"
```

```text
2.11.0
exit=0
```

첫 실행은 `~/.maestro/analytics.json`을 만들고 `Anonymous analytics enabled. To opt out, set MAESTRO_CLI_NO_ANALYTICS environment variable to any value before running Maestro.`
를 낸다(`"enabled": true`). 그 뒤 모든 실행에는 `MAESTRO_CLI_NO_ANALYTICS=1`과 `MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true`를 주었다.
안내 상자는 유니코드 상자 문자라 이 머신의 Git Bash에서 `?��…`로 깨져 보인다. 색 이스케이프는 파이프로 내보내도 나오므로 `maestro test --no-ansi`로 돌렸다.

### `maestro test`

`maestro test`는 에뮬레이터를 찾아(`Running on Pixel_9_API_36`) 명령마다 `COMPLETED`·`FAILED`를 낸다. 단언이 실패하면 exit 1, 옵션 오류는 exit 2다. 실행하는 동안 기기에서
`Maestro` 태그의 프로세스(드라이버)가 돌고, 끝난 뒤 `adb shell pm list packages`에는 `maestro`가 남지 않는다 - 관찰(명령 기록 없음).

### 플로를 쓸 때 걸린 것

**1. `evalScript` 줄은 따옴표가 필요하다.** 처음 쓴 플로의 줄은 이렇다.

```yaml
- evalScript: ${console.log('M4 extra: ' + maestro.copiedText)}
```

`maestro check-syntax`(기기가 필요 없다)가 다섯 플로 모두에서 이 줄을 거절했다.

```bash
"$MAESTRO" --no-ansi check-syntax test/e2e/measure/m4-health.yaml; echo "exit=$?"
```

```text
Parsing Failed at C:\syntax-checker:8:38
exit=1
```

위 출력은 고치기 전 플로의 것이다. 3d16db5에 커밋된 `test/e2e/measure/m4-health.yaml`은 값을 큰따옴표로 감싼 줄(아래)을 담고 있어 같은 명령이 `OK`를 낸다.

줄:칸은 플로마다 다르고(`8:57` · `8:53` · `8:40` · `8:38` · `15:38`) 모두 문자열 안의 `: `(콜론과 공백)을 가리킨다. 따옴표 없는 YAML 스칼라 안의 `: `는 매핑으로 읽힌다. 값을
큰따옴표로 감싸면 `OK`(exit 0)이고 스칼라의 내용은 같다.

```yaml
- evalScript: "${console.log('M4 extra: ' + maestro.copiedText)}"
```

**2. `console.log` 출력은 콘솔에 나오지 않는다.** 통과한 플로도 콘솔에는 `Run ${console.log('M4 extra: ' + maestro.copiedText)}... COMPLETED`만 낸다. 값은 디버그 출력의
`maestro.log`에 `logMessages=[…]`로 남는다(경로는 `==== Debug output (logs & screenshots) ====` 아래와 `~/.maestro/tests/<시각>/`다).

```bash
d=$(ls -1dt "$HOME"/.maestro/tests/*/ | head -1)
grep -oP 'logMessages=\[\K.*?(?=\], insight=)' "$d/maestro.log" | grep -v '^$' | awk '!seen[$0]++'
```

```text
M4 extra: {"backendUrl":"http://10.0.2.2:4100","appVariant":"e2e","router":{}}
```

같은 메시지가 두 줄에 찍혀서 `awk`로 중복을 뺀다. 이 기록의 `M… :` 줄은 모두 이렇게 뽑았다.

**3. `launchApp` 직후에 보낸 딥링크는 버려진다.** `launchApp`은 액티비티를 띄우는 즉시 돌아온다. M4 플로를 처음 돌렸을 때 `launchApp` 다음 줄이 곧바로 `openLink`였고 결과는 이랬다.

```text
Launch app "com.example.templateexpo.e2e" with clear state... COMPLETED
Open templateexpo-e2e://probe... COMPLETED
Copy text from element with id: probe-extra... FAILED

Element not found: Id matching regex: probe-extra
```

링크를 연 뒤 17초를 기다린 끝에 실패했고, 그때의 화면은 홈(`(app)/index`)이다. 디버그 출력의 logcat에서 링크 인텐트는 JS 런타임보다 0.9초 먼저 도착한다(기기 시계).

```text
07:24:24.345 I/ActivityTaskManager: START u0 {act=android.intent.action.VIEW dat=templateexpo-e2e://probe/... cmp=com.example.templateexpo.e2e/.MainActivity} with LAUNCH_SINGLE_TASK from uid 2000 (BAL_ALLOW_PERMISSION)
07:24:25.245 I/ReactNativeJS: Running "main"
```

JS가 뜨기 전에 들어온 링크를 앱이 읽지 못한 것으로 보인다. 링크 자체는 문제가 없다. adb로 직접 보내면 꺼진 앱을 링크로 띄우는 경우도, 홈이 떠 있을 때 링크를 보내는 경우도 `(lab)/probe`로 간다.

```bash
adb shell pm clear com.example.templateexpo.e2e
adb shell "am start -W -a android.intent.action.VIEW -d 'templateexpo-e2e://probe' com.example.templateexpo.e2e"   # Status: ok, LaunchState: COLD, TotalTime: 795 - 4초 뒤 화면: (lab)/probe
adb shell am start -W -n com.example.templateexpo.e2e/.MainActivity                                                # 홈이 뜬 뒤 위 VIEW 인텐트를 다시 보내면 (lab)/probe
```

그래서 다섯 플로의 `launchApp`과 `openLink` 사이에 홈 화면의 요소를 기다리는 단계를 넣었다.

```yaml
- extendedWaitUntil:
    visible:
      id: home-probe-button
    timeout: 30000
```

**4. `clearState`는 앱별 언어를 지운다.** 아래 M3 절에 있다.

**5. Windows에서 `maestro.log`에 오류 줄이 남는다.** 플로를 돌린 14번 모두, 실행마다 2~7번(합쳐 51번)
`[ERROR] maestro.cli.session.MaestroSessionManager.newSession$lambda$0: Failed to record heartbeat`와 `java.io.IOException`(Windows의 파일 잠금 위반 메시지,
`maestro.cli.db.KeyValueStore.commit` → `SessionStore.heartbeat`)이 찍힌다. 플로의 결과와 exit 코드에는 영향이 없었다. 디버그 로그의 `[ERROR]`를 실패 신호로 쓰는 하네스는
Windows에서 오탐한다.

### 정한 것

- **M8 = 예.** Maestro 2.11.0을 `~/.maestro`에 설치해 셸 런처로 쓴다(`MAESTRO="$HOME/.maestro/bin/maestro"`). 이후 절의 `"$MAESTRO"`는 이것이다.
- **플로 작성 규칙.** `evalScript` 값은 큰따옴표로 감싼다. `launchApp` 뒤에는 화면 요소를 기다린 다음 `openLink`를 보낸다(또는 `stopApp`·`clearState` 뒤 `openLink`로 앱을 링크로 띄운다).
  `console.log`의 값은 디버그 로그에서 뽑는다. 로캘 플로에는 `clearState`를 쓰지 않는다.
- 이 절이 재지 않은 것: macOS·iOS 시뮬레이터에서의 Maestro, 여러 기기 동시 실행(`--shards`), Maestro Cloud.

## 기기 실측 준비 (M4 · M2 · M6 · M3)

네 실측은 같은 Release APK, 같은 백엔드 스택, 같은 계측 화면을 쓴다.

### 시작 설정 바인딩과 `expo-localization`

앱 시작 때 설정 자리를 `extra`로 돌리는 `platform/config.ts`(`loadStartupSettings`)와 실패 화면 `components/app/fatal-config.tsx`, 루트 레이아웃의 모듈 수준 검증을 더했다.
`lib/config/settings.ts`가 밝힌 대로 앱 런타임의 `process.env`에는 `BACKEND_URL`이 없어서 설정 자리를 `extra`로 돌려야 한다.

```bash
BACKEND_URL=https://gate-check.invalid pnpm exec expo install expo-localization
```

```text
dependencies:
+ expo-localization ~57.0.2

Progress: resolved 976, reused 13, downloaded 60, added 14, done
Done in 5.7s using pnpm v11.22.0

Cannot automatically write to dynamic config at: app.config.ts
Add the following to your Expo config

{
  "plugins": [
    "expo-localization"
  ]
}
```

패키지를 설치한 뒤에 exit 1로 끝난다. `app.json`은 만들어지지 않았고, `package.json`에 한 줄, `pnpm-lock.yaml`에 `expo-localization@57.0.2`와 `rtl-detect@1.1.2`(20줄)가 더해졌다.
`pnpm-workspace.yaml`은 그대로다(릴리스 후 하루가 지난 버전이다). 설정 플러그인은 더하지 않았다. 아래 M3 절에서 보듯 앱별 언어가 플러그인 없이 동작한다.

### 계측 화면과 플로

`app/(lab)/probe.tsx`(라우트 `/probe`)가 다음을 각각 `testID`가 붙은 텍스트로 그린다: `useLocalSearchParams()`(`probe-params`), `getLocales()`의 `languageTag`(`probe-locales`),
`Constants.expoConfig?.extra`(`probe-extra`), `request('/health/ready')`의 결과(`probe-health-result`), 블랙홀 서버에 건 `fetch`를 2초 뒤 `abort()`한 결과(`probe-abort-result`).
플로는 `test/e2e/measure/`에 있다: `m2-params.yaml` · `m2-params-raw.yaml` · `m2-params-cold.yaml` · `m2-params-raw-cold.yaml` · `m3-locale.yaml` · `m4-health.yaml` ·
`m6-abort.yaml` · `m6-request-timeout.yaml`. 이 화면은 계층 규칙(`app/`은 `fetch`·`request()`를 부르지 않는다)을 일부러 어겼고, 실측을 기록한 뒤 지웠다.

### 스택과 블랙홀 서버

```bash
docker ps --filter name=joon- -q | wc -l                                              # 9
docker compose --profile fastapi -f docker-compose.e2e.yml up -d --build --wait      # exit 0
docker ps --filter name=joon- -q | wc -l                                              # 9
curl -s http://127.0.0.1:4100/health/ready
```

```text
{"meta":{"status":"ok"},"jsonapi":{"version":"1.1"},"data":null}
```

연결은 받고 응답하지 않는 서버(M6의 상대)는 백그라운드로 띄웠다.

```bash
node -e "require('node:http').createServer(() => {}).listen(4199, '127.0.0.1', () => console.log('blackhole on 4199'))"
curl -s -m 3 -o /dev/null -w "curl http_code=%{http_code} time=%{time_total}\n" http://127.0.0.1:4199/; echo "curl exit=$?"
```

```text
blackhole on 4199
curl http_code=000 time=3.014910
curl exit=28
```

에뮬레이터에서 호스트 루프백은 `10.0.2.2`이므로 앱은 `http://10.0.2.2:4199/`를 부른다.

### APK

이 머신의 저장소 경로(74자)에서는 Android 빌드가 되지 않으므로(M1) 작업 트리의 커밋 대상 파일(`git ls-files -co --exclude-standard`, 아직 커밋하지 않은 계측 파일 포함 85개)을 실제 디렉터리
`C:\t\e`(6자)에 복사해 `pnpm install --frozen-lockfile`을 하고 그 안에서 빌드했다. 설치도 사본의 `test/e2e/android.sh install`로 했다(스크립트가 자기 저장소 루트의
`android/app/build/outputs/apk/release/app-release.apk`를 찾는다). 사본은 다 쓴 뒤 지웠다.

```bash
BACKEND_URL=http://10.0.2.2:4100 test/e2e/android.sh build
test/e2e/android.sh install
```

```text
Android Bundled 8138ms node_modules\expo-router\entry.js (1475 modules)
BUILD SUCCESSFUL in 5m 49s
612 actionable tasks: 612 executed
APK 의 앱 설정: extra.appVariant=e2e
-rw-r--r-- 1 <user> <group> 102809734 Sep 30 16:23 android/app/build/outputs/apk/release/app-release.apk
Performing Streamed Install
Success
```

APK에서 꺼낸 `assets/app.config`(앱이 읽는 `Constants.expoConfig`)다.

```text
{"name":"Template Expo (E2E)","scheme":"templateexpo-e2e","pkg":"com.example.templateexpo.e2e","extra":{"backendUrl":"http://10.0.2.2:4100","appVariant":"e2e","router":{}}}
```

`extra.router`는 `expo-router` 플러그인이 병합하는 값이다(M7). 기기는 이미 켜져 있어 `E2E_AVD=Pixel_9_API_36 test/e2e/android.sh boot`는 `기기가 이미 연결돼 있다`로 끝났다(exit 0).

## M4 — 평문 HTTP

```bash
"$MAESTRO" test --no-ansi test/e2e/measure/m4-health.yaml; echo "exit=$?"
```

```text
Running on Pixel_9_API_36
 > Flow m4-health
Launch app "com.example.templateexpo.e2e" with clear state... COMPLETED
Assert that id: home-probe-button is visible... COMPLETED
Open templateexpo-e2e://probe... COMPLETED
Copy text from element with id: probe-extra... COMPLETED
Run ${console.log('M4 extra: ' + maestro.copiedText)}... COMPLETED
Tap on id: probe-health... COMPLETED
Assert that "ok 200", id: probe-health-result is visible... COMPLETED
exit=0
```

```text
M4 extra: {"backendUrl":"http://10.0.2.2:4100","appVariant":"e2e","router":{}}
```

플로가 끝난 화면의 UI 덤프에서 `probe-health-result`는 `ok 200`이다. 요청은 `request('/health/ready')`이고 `lib/jsonapi/client.ts`가 `getSettings().backendUrl`에서 URL을 만든다.
그 값은 `platform/config.ts`가 돌린 자리, 곧 `extra.backendUrl`에서 왔다. 시작 검증이 실패하지 않았고 `FatalConfig` 화면은 뜨지 않았다. 빌드된 매니페스트다.

```bash
"$ANDROID_HOME/build-tools/36.0.0/aapt2" dump xmltree --file AndroidManifest.xml android/app/build/outputs/apk/release/app-release.apk | grep -i usesCleartextTraffic
```

```text
A: http://schemas.android.com/apk/res/android:usesCleartextTraffic(0x010104ec)=true
```

첫 실행이 실패한 일은 위 M8 절의 3번이다(같은 플로에 `launchApp` 뒤 대기가 없었다).

### 정한 것

- **M4 = 예.** 평문 HTTP 설정(`expo-build-properties`의 `usesCleartextTraffic`, `development`·`e2e`만)을 유지한다.
- 이 요청의 `fetch`는 OkHttp를 쓰는 `expo/fetch`다(아래 M6 절). Android의 평문 허용 매니페스트 속성이 그 경로에도 적용된다는 것까지 확인한 셈이다. iOS의 `NSAllowsLocalNetworking`은 재지 못했다.

## M2 — 대괄호 파라미터

딥링크 두 형태를 앱이 켜져 있을 때(`launchApp` → 홈 대기 → `openLink`)와 꺼져 있을 때(`stopApp` → `clearState` → `openLink`가 앱을 띄움)로 보냈다. 화면은 `useLocalSearchParams()`를
`JSON.stringify`한 값을 그린다.

- 인코딩한 링크: `templateexpo-e2e://probe?filter%5Bstatus%5D=active&filter%5Btitle%5D%5Bcontains%5D=a%20b&sort=-createdAt`
- 인코딩하지 않은 링크: `templateexpo-e2e://probe?filter[status]=active&sort=-createdAt`

```bash
for f in m2-params m2-params-raw m2-params-cold m2-params-raw-cold; do "$MAESTRO" test --no-ansi test/e2e/measure/$f.yaml; echo "exit=$?"; done
```

| 플로 | 링크 | 앱 | 결과 |
| --- | --- | --- | --- |
| `m2-params.yaml` | 인코딩 | 켜져 있음 | 통과, exit 0 |
| `m2-params-raw.yaml` | 인코딩 안 함 | 켜져 있음 | 통과, exit 0 |
| `m2-params-cold.yaml` | 인코딩 | 꺼져 있음 | 통과, exit 0 |
| `m2-params-raw-cold.yaml` | 인코딩 안 함 | 꺼져 있음 | 통과, exit 0 |

```text
M2 encoded deep link params: {"filter[status]":"active","filter[title][contains]":"a b","sort":"-createdAt"}
M2 after setParams: {"filter[status]":"archived","filter[title][contains]":"a b","sort":"-createdAt"}
M2 raw deep link params: {"filter[status]":"active","sort":"-createdAt"}
M2 cold encoded deep link params: {"filter[status]":"active","filter[title][contains]":"a b","sort":"-createdAt"}
M2 cold raw deep link params: {"filter[status]":"active","sort":"-createdAt"}
```

두 번째 줄은 `m2-params.yaml`이 `probe-set-params`를 누른 뒤의 값이다. 화면의 버튼은
`router.setParams({ 'filter[status]': 'archived', 'filter[title][contains]': 'a b' })`를 부른다(`as never` 없이 타입이 맞았다). 준 키만 덮고 나머지(`sort`)는 남는다. 대괄호가 든 키는 어느 경우에도
쪼개지거나 중첩 객체가 되지 않고 평평한 문자열 키로 나온다. `%5B`·`%5D`는 `[`·`]`로 풀리고 `%20`은 공백이 된다.

### 정한 것

- **M2 = 예.** 대괄호 키를 위한 인코딩 규칙은 `lib/resources`에 두지 않는다. 필터·정렬 키를 그대로 라우트 파라미터에 쓴다(스펙 8.2의 첫 갈래).
- 중첩 대괄호 키(`filter[title][contains]`)는 인코딩한 링크(`%5B`·`%5D`)와 `router.setParams`로만 확인했다. 인코딩하지 않은 링크로 보낸 것은 `filter[status]` 하나였다.
- 이 절이 재지 않은 것: 값에 든 `&`·`=`·`+`·`#`·비ASCII, 같은 키가 두 번 나오는 링크, `router.push`·`Link`의 `params`가 만드는 URL, iOS.

## M6 — 요청 타임아웃

### `AbortController`로 끊기

화면의 `abort` 버튼은 블랙홀 서버(`http://10.0.2.2:4199/`)에 `fetch`를 걸고 2초 뒤 `controller.abort()`를 부른 뒤 잡힌 오류의 `name`과 걸린 시간을 그린다.

```bash
"$MAESTRO" test --no-ansi test/e2e/measure/m6-abort.yaml; echo "exit=$?"
```

```text
Tap on id: probe-abort... COMPLETED
Assert that ".+ \d+ms", id: probe-abort-result is visible... COMPLETED
Copy text from element with id: probe-abort-result... COMPLETED
Run ${console.log('M6 abort: ' + maestro.copiedText)}... COMPLETED
Assert that "AbortError \d+ms", id: probe-abort-result is visible... FAILED
exit=1
```

```text
M6 abort: Error 2023ms
```

요청은 2초 타이머에 2,023ms에 거절됐고(`resolved`가 아니다) 15초를 기다리지 않았다. 그러므로 abort는 JS 쪽 요청을 거절시킨다. 소켓이 닫혔는지는 관찰하지 못했다 - 소스로는 `request.cancel()`이 OkHttp `Call`을 취소한다(아래). 플로의 마지막 단언은 `AbortError`를 요구해서 실패했다 — 던져진 오류의 이름이
`Error`이기 때문이다. 플로 파일은 이 단언을 그대로 둔다.

**이 앱의 `fetch`는 `expo/fetch`다.** SDK 57의 winter 런타임이 RN의 폴리필을 덮어쓴다. `EXPO_PUBLIC_USE_RN_FETCH`가 `1`이나 `true`일 때만 RN 것을 쓴다.

```ts
// node_modules/expo/src/winter/runtime.native.ts
const useRnFetch =
  process.env.EXPO_PUBLIC_USE_RN_FETCH === '1' || process.env.EXPO_PUBLIC_USE_RN_FETCH === 'true';
if (!useRnFetch) {
  …
  install('fetch', () => require('./fetch').fetch);
}
```

APK의 Hermes 번들(`unzip -p app-release.apk assets/index.android.bundle | grep -a -c …`)에 `ExpoFetchModule` · `fetch failed` · `NativeRequest` · `EXPO_PUBLIC_USE_RN_FETCH`가 각각 들어 있다 - 관찰(명령 기록 없음).
`node_modules/expo`의 소스를 읽으면 abort는 이렇게 흐른다: `fetch.ts`가 `signal`의 `abort` 이벤트에서 `response.abort(signal.reason)`과 `request.cancel()`을 부른다. Android
`NativeRequest.cancel()`이 OkHttp `Call`을 취소하고 `emitRequestCanceled()`로 응답을 `ERROR_RECEIVED`(`FetchRequestCanceledException`, "Fetch request has been canceled")로 만들어 진행 중이던
`start`가 거절된다. `fetch.ts`는 그 거절을 `FetchError.createFromError`로 감싼다. `FetchError`는 `Error`를 확장하지만 `name`을 바꾸지 않고 메시지를 `fetch failed: <원인>`으로 만든다.
그래서 화면에 `Error`가 찍힌다. 던져진 오류의 메시지 원문은 화면에 그리지 않아 재지 않았다.

### `request()`의 15초 타임아웃

`lib/jsonapi/client.ts`의 `REQUEST_TIMEOUT_MS`(15초)를 같은 경로로 기기에서 쟀다. 우리 compose 프로젝트의 API 컨테이너만 잠시 멈췄다. 멈춘 컨테이너는 연결을 받고(Docker가 포트를 열어 둔다) 응답하지 않는다고 본다 - 관찰(명령 기록 없음). 기록된 것은 `curl`이 3초 뒤 exit 28로 끝났다는 것뿐이고, 연결 단계와 응답 단계 중 어디서 멈췄는지는 가르지 않았다.

```bash
docker pause template-typescript-expo-e2e-api-fastapi-1
curl -s -m 3 -o /dev/null -w "http_code=%{http_code} time=%{time_total}\n" http://127.0.0.1:4100/health/ready; echo "curl exit=$?"
"$MAESTRO" test --no-ansi test/e2e/measure/m6-request-timeout.yaml; echo "exit=$?"
docker unpause template-typescript-expo-e2e-api-fastapi-1
curl -s -m 5 -o /dev/null -w "http_code=%{http_code}\n" http://127.0.0.1:4100/health/ready
docker ps --filter name=joon- -q | wc -l
```

```text
http_code=000 time=3.011157
curl exit=28
Tap on id: probe-health... COMPLETED
Assert that "fail 0 REQUEST_TIMEOUT", id: probe-health-result is visible... COMPLETED
exit=0
http_code=200
9
```

플로가 끝난 화면의 `probe-health-result`는 `fail 0 REQUEST_TIMEOUT`이다. Maestro 디버그 출력의 명령별 시간에서 `probe-health`를 누른 다음 결과를 기다린 `extendedWaitUntil` 단계가 15,021ms였다
(`launchApp` 1,918 · 홈 대기 958 · `openLink` 1,246 · `tapOn` 2,143 · 결과 대기 15,021). 이 숫자는 그 대기 단계의 길이이지 요청의 시간이 아니다 - 요청이 나간 시각과 화면이 바뀐 시각을 따로
재지 않았다. `REQUEST_TIMEOUT_MS`(15,000ms) 타이머가 걸렸다는 것까지가 관찰이다.

### `cache` 옵션은 무시된다 (소스 확인)

`request()`가 `fetch`에 `cache: 'no-store'`를 넘기지 않는 이유(스펙 6.2)를, 전역 `fetch`가 `expo/fetch`임을 안 뒤에 설치된 소스로 다시 확인했다. 기기에서 잰 것이 아니라
`node_modules`를 읽은 것이다(`expo` 57.0.26 · `react-native` 0.86.3 · `whatwg-fetch` 3.6.20). 처음 적은 근거는 whatwg-fetch의 `_=<시각>` 덧붙임이었는데 이 앱의 기본 런타임에는 닿지 않는다.

- **전역 `fetch`를 바꿔 끼우는 곳.** `node_modules/expo/src/winter/runtime.native.ts` 41–53행이다. `EXPO_PUBLIC_USE_RN_FETCH`가 `1`·`true`가 아니면(41–44행)
  `install('fetch', () => require('./fetch').fetch)`(52행)가 RN이 깐 `fetch`를 덮는다(`installGlobal.ts` 80–113행이 지연 getter로 바꾼다). `@expo/metro-config/build/ExpoMetroConfig.js`
  275–277행이 `expo/src/winter/index.ts`를 메인 모듈보다 먼저 도는 모듈에 넣는다. RN 쪽은 `react-native/Libraries/Core/setUpXHR.js` 27–30행이 `fetch`·`Headers`·`Request`·`Response`를
  깔고, `Libraries/Network/fetch.js` 15행이 `whatwg-fetch`를 부른다. `Headers`·`Request`·`Response`는 그대로 RN 폴리필의 것이다(`runtime.native.ts` 45–51행이 그 전제를 확인한다).
  `expo-modules-core/src/polyfill/index.ts`는 `// noop`이고 `expo-modules-core/src`와 `expo/src`에서 전역 `fetch`를 설치하는 코드는 `runtime.native.ts` 52행뿐이다(웹의 `fetch.web.ts` 1행은 전역을 그대로 내보낸다).
- **`expo/fetch`는 `cache`를 읽지 않는다.** `node_modules/expo/src/winter/fetch/fetch.ts`의 `fetch()`(35–96행)는 `init`에서 `body`·`signal`·`redirect`·`method`·`credentials`·`headers`만
  읽고(41–55행) 네이티브에 넘기는 `nativeRequestInit`은 `credentials`·`headers`·`method`·`redirect` 넷이다(70–75행). 입력 타입 `FetchRequestInit`(`fetch.types.ts` 4–18행)과
  `NativeRequestInit`(`NativeRequest.ts` 14–19행)에도 `cache`가 없다. 그래서 `cache: 'no-store'`는 오류 없이 무시된다.
- **`whatwg-fetch`의 `_=<시각>` 덧붙임.** `node_modules/whatwg-fetch/fetch.js` 398–407행, `Request` 생성자 안이다. `cache`가 `no-store`·`no-cache`인 GET·HEAD의 URL 끝에 붙인다.
  `EXPO_PUBLIC_USE_RN_FETCH`로 RN 폴리필을 되살렸을 때만 이 앱의 요청에 닿는다(그 동작은 재지 않았다).
- **네이티브 HTTP 캐시는 있다.** Android의 `expo/fetch`는 `OkHttpClientProvider.createClient(reactContext)`로 만든 클라이언트를 쓰고(`expo/android/.../fetch/ExpoFetchModule.kt` 26–31행), 그
  클라이언트에는 10MB `http-cache`가 붙는다(`react-native/ReactAndroid/.../network/OkHttpClientProvider.kt` 43–44행, 61–77행). iOS는 `URLSessionConfiguration.default`(`expo/ios/Fetch/ExpoFetchModule.swift`
  118–133행)를 쓰고 요청에 `cachePolicy`를 주지 않는다(`ExpoURLSessionTask.swift` 24–41행). 둘 다 요청의 `cache` 옵션이 아니라 응답 헤더(`Cache-Control` 등)를 따른다. 세 백엔드가 응답에
  어떤 캐시 헤더를 싣는지는 재지 않았다.

### 취소가 거절되는 경로 (소스 확인)

M6이 기기에서 잰 것은 응답 헤더가 오기 전의 취소(블랙홀 서버)뿐이다. 본문을 읽는 도중의 취소는 재지 않았고 설치된 소스로 읽었다. 기기에서 잰 것이 아니다.

- **응답 헤더 전.** `node_modules/expo/src/winter/fetch/fetch.ts` 80–85행의 abort 리스너가 `response.abort(signal?.reason)`과 `request.cancel()`을 부르고, 진행 중이던 `request.start`가 거절된다(87–93행).
  그 오류는 `FetchError`다(`FetchErrors.ts` 1–11행 - `Error`를 확장하고 `name`을 바꾸지 않는다). M6이 잰 경우다.
- **본문을 스트림(`response.body`)으로 읽는 중.** `FetchResponse.abort()`(`FetchResponse.ts` 183–200행)가 스트림 컨트롤러를 `AbortError`로 거절한다. `signal.reason`이 없으면 새로 만드는데(185–189행),
  RN이 까는 `abort-controller` 3.0.0 폴리필(`react-native/Libraries/Core/setUpXHR.js` 37–44행)은 `reason`을 만들지 않는다(`dist/abort-controller.js`에 `reason`이 없다). expo의 자체 시험이 이 경우를 고정한다
  (`fetch/__tests__/FetchResponse-test.ts` 141–162행).
- **`response.json()`은 스트림이 아니다.** `json()`(`FetchResponse.ts` 397–401행)은 `text()`(421–431행)를 거쳐 네이티브 `text`를 부르고, 네이티브는 본문이 다 올 때(`BODY_COMPLETED`)까지 기다린다
  (Android `ExpoFetchModule.kt` 115–121행, iOS `ExpoFetchModule.swift` 81–87행). 스트림(`get body()`, 281행)을 만든 적이 없으면 `abort()`가 거절할 스트림이 없다.
  - **Android.** 취소되면 `NativeResponse.emitRequestCanceled()`가 상태를 `ERROR_RECEIVED`로 만들고(`NativeResponse.kt` 78–85행), 본문 펌프(194–224행)가 `IOException`을 잡거나 잘못된 상태에서 `break`한 뒤
    어느 쪽이든 끝나면 `BODY_COMPLETED`로 넘어간다(143–160행, 158행). 그러면 `text()`가 읽은 만큼의 본문으로 끝나고 `JSON.parse`가 실패해 `json()`이 거절된다.
  - **iOS.** `emitRequestCanceled()`가 상태를 `.errorReceived`로 만들고(`NativeResponse.swift` 62–70행), `ExpoURLSessionTask.cancel`이 delegate를 먼저 떼므로(`ExpoURLSessionTask.swift` 48–53행,
    `expo-modules-core/ios/DevTools/URLSessionSessionDelegateProxy.swift` 21–25행·44–52행) 상태가 `.bodyCompleted`로 갈 길이 없다. 그러면 헤더를 받은 뒤 본문이 멈춘 요청의 `json()`은
    취소나 타임아웃 뒤에도 끝나지 않을 수 있다.
- **그래서.** `lib/jsonapi/client.ts`의 `readJson()`이 `json()`을 요청 signal과 경주시킨다. `REQUEST_TIMEOUT_MS` 주석이 적는 "연결·응답 대기·본문 읽기를 모두 덮는다"가 iOS의 위 경로에서도 서도록
  게이트를 세운 뒤에 고쳤다. iOS에서 `json()`이 취소 뒤에 실제로 끝나지 않는지는 여전히 재지 못했다 - 이 코드는 그 여부와 무관하게 `REQUEST_TIMEOUT`이나 `NON_JSONAPI_RESPONSE`로 끝나고, 단위 시험이
  끝나지 않는 `json()`으로 그것을 잰다(`test/unit/jsonapi/client.test.ts`의 "본문 읽기는 요청 signal 과 경주한다"와 타임아웃 describe의 "본문이 끝나지 않는 응답도 …"). iOS를 재는 CI 계획은 헤더 뒤에
  본문이 멈추는 서버로 타임아웃을 기기에서 확인한다.

### 정한 것

- **M6 = 예.** 타이머와 `AbortController`로 거는 타임아웃이 요청을 거절시킨다(JS 쪽에서 관찰했다). `REQUEST_TIMEOUT_MS`는 15초로 둔다(스펙 8.5).
- **취소를 오류 이름으로 가르지 않는다.** SDK 57의 `fetch`는 응답 헤더 전의 취소를 `AbortError`가 아니라 `Error`로 던진다(본문을 스트림으로 읽는 중의 취소는 `AbortError`다 - 위 소스 확인 절).
  `lib/jsonapi/client.ts`의 `exchange()`는 `catch`에서 `timedOut()` 플래그로 `REQUEST_TIMEOUT`을 가르므로 이름에 기대지 않는다. 다른 호출자가 `error.name === 'AbortError'`로 취소를 가르면
  이 앱에서는 단계에 따라 맞지 않는다.
- 스펙이 "RN fetch"라고 부른 것은 이 앱에서는 `expo/fetch`다. RN 폴리필(`EXPO_PUBLIC_USE_RN_FETCH=1`)의 동작은 재지 않았다.
- **`request()`는 `cache`를 계속 넘기지 않는다.** 이유가 바뀌었을 뿐이다 - `expo/fetch`가 `cache`를 읽지 않고, RN 폴리필로 되돌려도 URL이 바뀐다(위 소스 확인 절). 스펙 6.2·15장에 정정을 더했다.
- **본문 읽기는 요청 signal과 경주시킨다.** 취소가 `json()`을 거절시켜 준다고 믿을 수 없어서 `readJson()`이 둘 중 먼저 끝나는 쪽을 결과로 삼는다(이유는 위 소스 확인 절). 본문을 읽는 도중 타임아웃이 걸리면
  `REQUEST_TIMEOUT`, 호출자가 끊으면 `NON_JSONAPI_RESPONSE`(status는 응답의 것)다.
- 이 절이 재지 않은 것: 본문을 읽는 도중의 타임아웃·취소의 기기 결과(`readJson()`이 런타임과 무관하게 끝내고 단위 시험이 그것을 잰다 - 소스를 읽은 결과와 iOS의 우려는 위 소스 확인 절에 있다),
  호출자 `signal`이 끊은 요청의 화면 결과, 오류 메시지 원문, iOS.

## M3 — 기기 로캘

기기의 시스템 로캘은 처음부터 `en-US`다(`ko-KR`이 아니다). 재기 전 상태다.

```bash
ADB="$ANDROID_HOME/platform-tools/adb"
"$ADB" shell dumpsys activity | grep -m1 mGlobalConfiguration | grep -o '\[[a-z_A-Z,]*\]'
"$ADB" shell getprop persist.sys.locale        # 빈 값
"$ADB" shell getprop ro.product.locale
"$ADB" shell cmd locale get-app-locales com.example.templateexpo.e2e
```

```text
[en_US]
(빈 값)
en-US
Locales for com.example.templateexpo.e2e for user 0 are []
```

### 방법 1 — `maestro test --device-locale`

```bash
"$MAESTRO" test --device-locale en-US -e EXPECTED_LOCALE=en-US test/e2e/measure/m3-locale.yaml; echo "exit=$?"
"$MAESTRO" test --device-locale ko-KR -e EXPECTED_LOCALE=ko-KR test/e2e/measure/m3-locale.yaml; echo "exit=$?"
```

```text
Unknown option: '--device-locale'
Possible solutions: --debug-output, --device
exit=2
```

둘 다 같다(`--no-ansi`도 함께 주었다). `maestro test --help`의 옵션 목록에 `--device-locale`이 없다. 이 옵션은 `maestro start-device`(`--device-locale`은 `de_DE` 형식, 새 에뮬레이터·시뮬레이터를 만들거나
띄우는 명령이고 `--force-create`는 같은 이름의 기기를 덮어쓴다)에만 있다. 이미 떠 있는 `Pixel_9_API_36`의 로캘을 바꾸는 용도가 아니어서 실행하지 않았다. 이 문단의 `--help` 목록과 `start-device` 설명은
관찰(명령 기록 없음)이고, 기록된 근거는 위 `Unknown option` 출력(`Possible solutions`에 `--device-locale`이 없다)뿐이다.

### 방법 2 — Android 13+ 앱별 언어

```bash
"$ADB" shell cmd locale set-app-locales com.example.templateexpo.e2e --locales ko-KR
"$ADB" shell cmd locale get-app-locales com.example.templateexpo.e2e
```

```text
Locales for com.example.templateexpo.e2e for user 0 are [ko-KR]
```

플로의 `launchApp`에 `clearState: true`를 둔 채 돌리면 이렇다.

| 앱별 언어 | `M3 locales:` | 결과 |
| --- | --- | --- |
| `en-US` | `en-US` | 통과 — 시스템 로캘이 `en-US`라 아무것도 증명하지 못한다 |
| `ko-KR` | `en-US` | 실패(`ko-KR.*` 단언, exit 1) |

`ko-KR` 실행이 끝난 뒤 `get-app-locales`는 `[]`였다. 어느 동작이 지우는지 가렸다.

```bash
"$ADB" shell cmd locale set-app-locales $PKG --locales ko-KR
"$ADB" shell cmd locale get-app-locales $PKG     # [ko-KR]
"$ADB" shell am force-stop $PKG
"$ADB" shell cmd locale get-app-locales $PKG     # [ko-KR]
"$ADB" shell am start -W -n $PKG/.MainActivity
"$ADB" shell cmd locale get-app-locales $PKG     # [ko-KR]
"$ADB" shell pm clear $PKG
"$ADB" shell cmd locale get-app-locales $PKG     # []
```

`pm clear`만 앱별 언어를 지운다. Maestro의 `clearState: true`가 `pm clear`이므로, 앱별 언어를 정한 뒤 `clearState`가 있는 플로를 돌리면 언어가 사라진 채 앱이 뜬다. 그래서 `m3-locale.yaml`에서
`clearState`를 뺐다(`launchApp`은 실행 중인 앱을 멈추고 다시 띄운다). 고친 플로로 다시 쟀다.

```bash
"$MAESTRO" test --no-ansi -e EXPECTED_LOCALE=<태그> test/e2e/measure/m3-locale.yaml; echo "exit=$?"
```

| 앱별 언어 | 기대(`EXPECTED_LOCALE`) | `M3 locales:` | 결과 |
| --- | --- | --- | --- |
| `en-US` | `en-US` | `en-US` | 통과, exit 0 |
| `ko-KR` | `ko-KR` | `ko-KR,en-US` | 통과, exit 0 |
| `ko-KR`(대조) | `en-US` | `ko-KR,en-US` | 실패, exit 1 — 단언이 걸러낸다 |
| 없음(`set-app-locales`에 `--locales` 없이) | `en-US` | `en-US` | 통과, exit 0 |

앱별 언어가 `getLocales()`의 맨 앞에 오고 시스템 로캘이 뒤따른다. 이 과정에서 시스템 로캘은 바뀌지 않았다. 빌드된 매니페스트에는 `localeConfig`가 없다(`expo-localization` 설정 플러그인을 더하지 않았다) - 관찰(명령 기록 없음).

### 방법 3 — 시스템 로캘(root)

```bash
"$ADB" shell getprop ro.build.type     # user
"$ADB" shell getprop ro.debuggable     # 0
"$ADB" root && "$ADB" shell "setprop persist.sys.locale en-US; setprop ctl.restart zygote"; echo "exit=$?"
```

```text
adbd cannot run as root in production builds
Failed to set property 'persist.sys.locale' to 'en-US'.
See dmesg for error reason.
Failed to set property 'ctl.restart' to 'zygote'.
See dmesg for error reason.
exit=1
```

이 이미지는 `user` 빌드(`ro.build.type`과 `ro.debuggable=0`은 위 명령의 출력이고 `ro.secure=1`은 관찰(명령 기록 없음))라 root가 안 된다. `adb root`는 거절하고도 exit 0이어서 `&&`가 뒤를 막지 못했다. 뒤의 `setprop` 둘은 shell 사용자(uid 2000)라 거부됐고 아무것도 바뀌지 않았다.

### 되돌린 상태

```bash
"$ADB" shell dumpsys activity | grep -m1 mGlobalConfiguration | grep -o '\[[a-z_A-Z,]*\]'
"$ADB" shell getprop persist.sys.locale
"$ADB" shell cmd locale get-app-locales com.example.templateexpo.e2e
```

```text
[en_US]
(빈 값)
Locales for com.example.templateexpo.e2e for user 0 are []
```

시스템 로캘은 처음부터 바꾸지 않았고, 앱별 언어는 `set-app-locales`로 지웠다. 측정 전과 같은 상태다.

### 정한 것

- **M3(Android) = 예.** 방법 2(앱별 언어)로 정한다. E2E 하네스는 `adb shell cmd locale set-app-locales <패키지> --locales <태그>`로 로캘이 다른 두 실행을 만든다(스펙 9.4·11.3).
- **순서.** 상태 지우기(`pm clear`) → `set-app-locales` → 앱 실행. `pm clear`가 앱별 언어를 지우므로 로캘 플로는 `clearState`를 쓰지 않는다. Maestro 플로에서 adb를 부르는 방법은 찾지 못해서(관찰, 명령 기록 없음)
  `pm clear`와 `set-app-locales`는 플로를 시작하는 하네스 스크립트가 맡는다.
- **`getLocales()` 모양.** 한국어 실행은 `ko-KR,en-US`, 영어 실행은 `en-US` 하나다. 두 실행에서 `getLocales()`로 만드는 `Accept-Language`가 다르게 나온다.
- `expo-localization` 설정 플러그인은 더하지 않는다(Android에서 잰 결과다. iOS는 재지 못했다).
- 이 절이 재지 않은 것: iOS의 `-AppleLanguages` 실행 인자(CI), 앱이 켜진 채 로캘을 바꿨을 때 화면이 다시 그려지는지, 시스템 로캘이 `en-US`가 아닌 기기.

## 함께 관찰한 것 (기기 실측)

1. **`uiautomator dump`는 값에 `"`가 있으면 속성을 작은따옴표로 감싼다.** `probe-extra`의 JSON은 `text='{"backendUrl":"http://10.0.2.2:4100","appVariant":"e2e","router":{}}'`로 나온다.
   `test/e2e/android.sh wait-text`는 `text="…"` 꼴만 찾으므로 큰따옴표가 든 텍스트는 기다리지 못한다.
2. **`expo install`은 동적 설정(`app.config.ts`)에 플러그인을 써 넣지 못해 설치가 끝난 뒤 exit 1로 끝난다.** 위 "시작 설정 바인딩과 `expo-localization`" 절의 출력이다.
