# D1 실측 기록 (2026-09-30)

스펙 15장 "0단계에서 먼저 실측할 것"과 D1 계획이 더한 둘(M7·M8)의 결과다. 각 절은
**무엇을 했고(명령) 무엇이 나왔는가(출력)**를 사실로 적고, 그 결과로 정한 것을 따로 적는다.
결과가 스펙과 어긋나면 스펙에 날짜가 붙은 정정을 더한다.

| # | 질문 | 결과 | 정한 것 |
| --- | --- | --- | --- |
| M1 | Uniwind + React Native Reusables가 SDK 57 Android Release 빌드에서 렌더되는가 | | |
| M2 | Expo Router가 대괄호 키를 딥링크·`router.setParams`에서 보존하는가 | | |
| M3 | Maestro로 Android 기기 로캘을 바꿀 수 있는가 | | |
| M4 | `e2e` 변형 Release APK가 평문 HTTP로 `10.0.2.2:4100`에 닿는가 | | |
| M5 | pnpm 기본(isolated) 링커에서 Metro 번들과 expo-doctor가 도는가 | 돈다 — `expo export`(android·ios) exit 0, expo-doctor 21/21 통과 exit 0 | isolated 유지(기본값). 폴백이 필요하면 `.npmrc`가 아니라 `pnpm-workspace.yaml`의 `nodeLinker: hoisted` |
| M6 | RN fetch에서 `AbortController` 타임아웃이 요청을 실제로 끊는가 | | |
| M7 | `app.config.ts`가 `./lib/config/*.ts`를 확장자 포함 import로 쓸 수 있는가 | | |
| M8 | Maestro CLI가 Windows Git Bash에서 도는가 | | |

iOS 쪽(M1·M2·M3의 iOS 절반)은 개발 머신이 Windows라 여기서 잴 수 없다. CI 계획이 잰다.

## M5 — pnpm 링커

환경은 Node 24.19.0 · pnpm 11.22.0 · Windows 11(Git Bash)이다. `.npmrc`에는 `engine-strict=true`만
두었고 링커를 따로 정하지 않았다. 설치 뒤 `node_modules/.modules.yaml`에 `"nodeLinker": "isolated"`가
기록됐다. 설치된 버전은 `expo` 57.0.26 · `expo-router` 57.0.24 · `react-native` 0.86.3 ·
`react` 19.2.3 · `typescript` 6.0.3이다.

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
   exit 1로 설치가 막힌다. 그래서 이 저장소의 `.npmrc` 한 줄은 pnpm 11.22.0에서 효력이 없다.
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
