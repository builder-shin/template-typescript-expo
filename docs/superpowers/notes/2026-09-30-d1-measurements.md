# D1 실측 기록 (2026-09-30)

스펙 15장 "0단계에서 먼저 실측할 것"과 D1 계획이 더한 둘(M7·M8)의 결과다. 각 절은
**무엇을 했고(명령) 무엇이 나왔는가(출력)**를 사실로 적고, 그 결과로 정한 것을 따로 적는다.
결과가 스펙과 어긋나면 스펙에 날짜가 붙은 정정을 더한다.

| # | 질문 | 결과 | 정한 것 |
| --- | --- | --- | --- |
| M1 | Uniwind + React Native Reusables가 SDK 57 Android Release 빌드에서 렌더되는가 | 렌더된다 — `e2e` 변형 Release APK가 API 36 에뮬레이터에서 크래시 없이 뜨고, 라이트·다크 모두 `global.css` 토큰 값 그대로 그려진다(UI 덤프에 `template-typescript-expo`·`Uniwind`). 단 Windows에서 APK를 만들려면 hoisted 링커와 짧은 저장소 경로가 필요하다 — 이 머신의 저장소 위치(74자)에서는 APK가 만들어지지 않았다 | 스타일 스택 유지. `nodeLinker: hoisted`로 바꿨다(M5 재판정). Uniwind 1.12.0의 `@media` 블록 결함을 기록했다 |
| M2 | Expo Router가 대괄호 키를 딥링크·`router.setParams`에서 보존하는가 | | |
| M3 | Maestro로 Android 기기 로캘을 바꿀 수 있는가 | | |
| M4 | `e2e` 변형 Release APK가 평문 HTTP로 `10.0.2.2:4100`에 닿는가 | | |
| M5 | pnpm 기본(isolated) 링커에서 Metro 번들과 expo-doctor가 도는가 | 돈다 — `expo export`(android·ios) exit 0, expo-doctor 21/21 통과 exit 0 | 당시에는 isolated 유지(기본값)로 정했다. M1의 Android Release 빌드가 Windows에서 isolated로는 만들어지지 않아 2026-09-30에 `pnpm-workspace.yaml`의 `nodeLinker: hoisted`로 바꿨다(pnpm 11은 `.npmrc`의 `node-linker`를 읽지 않는다). 아래 M5 절 끝의 재판정과 M1 절을 본다 |
| M6 | RN fetch에서 `AbortController` 타임아웃이 요청을 실제로 끊는가 | | |
| M7 | `app.config.ts`가 `./lib/config/*.ts`를 확장자 포함 import로 쓸 수 있는가 | 쓸 수 있다 — `expo config --type public --json`(e2e 변형) exit 0에 변형 값이 나오고, `BACKEND_URL` 없음과 production+http는 각각 해당 오류 문구와 exit 1 | 확장자 포함 import 유지(검증 복사 없음). 전제는 Node의 type stripping이다 — 끄면 같은 명령이 구문 오류로 exit 1 |
| M8 | Maestro CLI가 Windows Git Bash에서 도는가 | | |

iOS 쪽(M1·M2·M3의 iOS 절반)은 개발 머신이 Windows라 여기서 잴 수 없다. CI 계획이 잰다.

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
   `minimumReleaseAge`(1440분)의 안쪽이다. 임시 디렉터리에 `package.json`·`pnpm-lock.yaml`·`.npmrc`만
   두고 `pnpm install --frozen-lockfile`을 하면 `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`(5건)으로 exit 1이고,
   `pnpm-workspace.yaml`을 더하면 exit 0이다. 가장 늦은 릴리스(2026-09-29 10:59 UTC)에서 하루가 지나면
   이 예외가 필요 없어질 것으로 보이지만, 이는 pnpm이 출력한 컷오프 규칙에서 읽은 것이고 그 시점
   이후에는 다시 재지 않았다.
3. **무시된 빌드 스크립트는 없다.** pnpm이 무시된 빌드 스크립트를 보고하지 않았고 `.modules.yaml`의
   `pendingBuilds`가 빈 배열이다. 그래서 `allowBuilds`를 적지 않았다.
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
   (`C:\Users\rootj\OneDrive\Desktop\develop\templates\template-typescript-expo`, 74자)를 뺀 상대 경로만도
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
Error: Error reading Expo config at C:\Users\rootj\OneDrive\Desktop\develop\templates\template-typescript-expo\app.config.ts:

BACKEND_URL is required
Error: Error reading Expo config at C:\Users\rootj\OneDrive\Desktop\develop\templates\template-typescript-expo\app.config.ts:

BACKEND_URL is required
    at requireAbsoluteUrl (file:///C:/Users/rootj/OneDrive/Desktop/develop/templates/template-typescript-expo/lib/config/settings.ts:29:11)
    at loadSettings (file:///C:/Users/rootj/OneDrive/Desktop/develop/templates/template-typescript-expo/lib/config/settings.ts:46:17)
    at appConfig (C:\Users\rootj\OneDrive\Desktop\develop\templates\template-typescript-expo\app.config.js:23:59)
```

출력은 16줄이고 이하 7줄은 Expo 내부 프레임이다.

```bash
BACKEND_URL=http://probe-backend:4321 APP_VARIANT=production pnpm exec expo config --type public --json > "$TMPDIR/m7-prodhttp.out" 2>&1; echo "exit=$?"
head -8 "$TMPDIR/m7-prodhttp.out"
```

```text
exit=1
Error: Error reading Expo config at C:\Users\rootj\OneDrive\Desktop\develop\templates\template-typescript-expo\app.config.ts:

BACKEND_URL must use https for the production variant (got "http://probe-backend:4321")
Error: Error reading Expo config at C:\Users\rootj\OneDrive\Desktop\develop\templates\template-typescript-expo\app.config.ts:

BACKEND_URL must use https for the production variant (got "http://probe-backend:4321")
    at assertBackendUrlAllowed (file:///C:/Users/rootj/OneDrive/Desktop/develop/templates/template-typescript-expo/lib/config/app-variant.ts:67:11)
    at appConfig (C:\Users\rootj\OneDrive\Desktop\develop\templates\template-typescript-expo\app.config.js:24:50)
```

출력은 16줄이고 이하 8줄은 Expo·Node 내부 프레임이다.

`app.config.ts`를 평가하는 다른 명령도 같은 검증에서 멈춘다. `BACKEND_URL` 없이 돌린 `pnpm exec expo export --platform android`와
`pnpm types:routes`는 둘 다 같은 `BACKEND_URL is required` 오류로 exit 1이고 번들 폴더를 만들지 않는다. 그래서 위 M5 절의
`expo export` 명령을 이 뒤로 다시 돌릴 때는 `BACKEND_URL`을 함께 준다.

### 누가 `.ts` import를 처리하는가

실패 경로의 스택에서 `settings.ts`와 `app-variant.ts`는 `file:///…/lib/config/*.ts` 프레임으로, 줄 번호는 원본
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
SyntaxError: Error reading Expo config at C:\Users\rootj\OneDrive\Desktop\develop\templates\template-typescript-expo\app.config.ts:

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

### Release 빌드

`test/e2e/android.sh build`(= `APP_VARIANT=e2e pnpm exec expo prebuild --platform android --clean --no-install` 뒤
`./gradlew assembleRelease`)를 `BACKEND_URL=http://10.0.2.2:4100`으로 돌렸다. prebuild는 매번
`» android: userInterfaceStyle: Install expo-system-ui in your project to enable this feature.`를 낸다
(`app.config.ts`의 `userInterfaceStyle: 'automatic'`).

| # | 저장소 위치(경로 길이) | 링커 | 결과 |
| --- | --- | --- | --- |
| 1 | `C:\Users\rootj\OneDrive\Desktop\develop\templates\template-typescript-expo`(74자) | isolated | 실패, 3m 35s — `configureCMakeRelWithDebInfo[arm64-v8a]` 두 개 |
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
> [CXX1428] exception while building Json A problem occurred starting process 'command '…\node_modules\.pnpm\react-native-worklets@0.10._def3c069969de18c77460f611c587fd2\node_modules\react-native-worklets\android\build\intermediates\cxx\RelWithDebInfo\402g4w3c\logs\arm64-v8a\prefab_command.bat''
Caused by: net.rubygrapefruit.platform.NativeException: Could not start '…\prefab_command.bat'
```

`react-native-screens`도 같은 오류다. 실패한 두 `.bat`의 전체 경로는 279자와 278자다(`…`는 저장소 루트 74자). 같은 빌드의 JS 번들링은
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
> this and base files have different roots: X:\template-typescript-expo\node_modules\.pnpm\@react-native+codegen@0.86._88ef50d3e46a14e4cb3ce2c2b07db85d\node_modules\@react-native\codegen\lib\cli\combine\combine-js-to-schema-cli.js and C:\Users\rootj\OneDrive\Desktop\develop\templates\template-typescript-expo\node_modules\.pnpm\react-native-gesture-handle_b36ab204c3e9e0e9b3fd57438cb099df\node_modules\react-native-gesture-handler\android.
```

`react-native-safe-area-context`·`react-native-screens`·`react-native-svg`도 같다. `node_modules`의 링크는 상대 경로 symlink라
`X:` 안에서 풀리지만, `fs.realpathSync.native`는 `subst`를 벗겨 `C:` 경로를 돌려준다(`X:`에서
`fs.realpathSync.native('node_modules/react-native-worklets')`를 호출하면 `C:\Users\…` 경로가 나온다). 두 표기가 한 계산에 섞이면
실패한다. Git Bash에서는 `subst X: /D`의 `/D`가 경로로 바뀌어(`D:\`) 지워지지 않는다. `MSYS_NO_PATHCONV=1 subst X: /D`로 지웠다.

**4. 74자, hoisted.** CMake 구성은 통과하고 컴파일 직전에 ninja가 멈춘다.

```text
Execution failed for task ':react-native-worklets:buildCMakeRelWithDebInfo[arm64-v8a][worklets]'.
> com.android.ide.common.process.ProcessException: ninja: Entering directory `C:\Users\rootj\OneDrive\Desktop\develop\templates\template-typescript-expo\node_modules\react-native-worklets\android\.cxx\RelWithDebInfo\6x1k4z1o\arm64-v8a'
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
-rw-r--r-- 1 jwshin 197609 102792486 Sep 30 11:57 android/app/build/outputs/apk/release/app-release.apk
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
6. **새 체크아웃의 `pnpm lint`는 `expo-env.d.ts` 없이는 실패한다.** 커밋을 `git archive`로 받아 `pnpm install --frozen-lockfile`만 한 사본에서
   `app.config.ts`(26·27행)와 `lib/config/settings.ts`(46행)의 `process.env.…`가 `any`로 잡혀 `@typescript-eslint/no-unsafe-argument`·`no-unsafe-assignment` 3건이 난다.
   이 작업 이전의 `b22c2e2`를 같은 방법으로 받아도 같다. 원인은 TypeScript 6.0에서 `types`의 기본값이 빈 목록이라 `@types/node`가 프로그램에 들어오지 않고(프로그램 안의
   `@types/node` 파일 0개), `process`가 `expo-modules-core/build/ts-declarations/global.d.ts`의 느슨한 선언으로 잡히는 것이다. `expo-env.d.ts`가 있으면 `expo/types`의 선언이 잡혀 통과한다.
   `compilerOptions.types: ["node"]`는 이를 고치지 못했고(lint 3건 그대로), `["expo/types"]`는 `expo-env.d.ts` 없이 typecheck·lint·test가 모두 exit 0이었다.
   두 시험 모두 스크래치 사본에서만 했고 저장소의 `tsconfig.json`에는 적용하지 않았다.

### 정한 것

- **M1 = 예.** Uniwind + React Native Reusables를 유지한다. Release 빌드에서 렌더되고 라이트·다크 토큰이 그대로 나온다.
- **링커를 `nodeLinker: hoisted`로 바꾼다(M5 재판정).** Windows에서 Android 네이티브 빌드가 된 조합은 잰 것 가운데 hoisted + 47자 이하 경로뿐이었다. isolated는 6자 경로에서도 실패했다.
  Linux·macOS에서 isolated가 되는지는 이 머신에서 재지 못했다. CI가 잰다.
- **`uniwind-types.d.ts`와 `css.d.ts`를 커밋한다.** 새 체크아웃의 `pnpm typecheck`를 통과시키는 것은 `css.d.ts`(`*.css` 선언)이고,
  `uniwind-types.d.ts`는 Uniwind 전용 props와 테마 이름 타입을 준다.
- **받은 컴포넌트는 `text.tsx`의 `ROLE` 타입 한 줄만 고쳤다.**

아래는 이 기록이 정하지 않은 것이다.

- Uniwind의 `@media` 블록 결함에 어떻게 대응할지(패치, 다른 버전, `sm:` 회피). 지금은 `Button`의 높이만 눈에 띈다.
- 이 머신에서 APK를 만드는 방법(47자 이하 경로의 작업 트리). `test/e2e/android.sh`는 경로 길이를 검사하지 않는다.
- expo-doctor가 지목한 `secretlint` 스크립트 이름.
- 새 체크아웃의 `pnpm lint`(관찰 6). 후보는 `tsconfig.json`의 `compilerOptions.types: ["expo/types"]`이다.
- `expo-system-ui` 설치 여부.
