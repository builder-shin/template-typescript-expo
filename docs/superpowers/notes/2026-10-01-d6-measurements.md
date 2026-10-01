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
A  preview    https://probe-a.example ID1: 116b860227917c04dd179fde537d47e5d7297ea3
A2 preview    https://probe-a.example ID1: 116b860227917c04dd179fde537d47e5d7297ea3
B  preview    https://probe-b.example ID1: a6b85037db353d397859f800ef3f4de79f27d9a0
C  production https://probe-a.example ID1: 496001f5278d97727b9cd3e693b58f5418b084f8
E  preview    https://probe-a.example ID2: 5111260d28f81a3937cb4223e7f56a8f47637009
F  (변형 없음) https://probe-a.example ID1: null
D  preview    https://probe-a.example ID1 (JS 만 바뀜): 116b860227917c04dd179fde537d47e5d7297ea3
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

## O3 — 게이트 [8] 이 변형별 네이티브 설정을 검사한다

**명령.** `scripts/check.sh` 의 [8] 블록만 떼어(그 앞의 `GATE_` 변수와 `existing_files` 함수를 함께) 돌렸다 - 커밋 대상
파일의 깨끗한 사본(`.maestro-output/variant-config-src`, 끝나면 지운다)에서 변형 넷을 EAS 프로젝트가 없을 때와 있을 때
(`GATE_EAS_PROJECT_ID`, 모양만 UUID)로 `expo config <사본> --type introspect --json` 하고, `scripts/check-variant-config.mjs` 가
설정 플러그인이 옮길 네이티브 값(AndroidManifest.xml·strings.xml·Info.plist·Expo.plist)을 변형 표·OTA 판단과 맞댄다.
사본을 만들고 지우는 것까지 여덟 평가가 이 개발 머신에서 10초 안팎이다.

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

**환경이 섞이지 않는다.** 저장소 루트에 `EAS_PROJECT_ID` 를 둔 `.env` 를 만들고 같은 블록을 돌려도 여덟이 통과했다 -
사본에 `.env` 가 없다(git 이 무시한다). 셸이 `EAS_PROJECT_ID`·`EAS_BUILD_PROJECT_ID` 를 내보내고 돌려도 여덟이 통과했다 -
블록이 두 자리를 빈 값으로 명시해 덮는다(만든 `.env` 는 지웠다). 명시를 뺀 블록은 같은 셸 환경에서 첫 평가의
`extra.eas` 로 멈춘다. 명시가 빠지면 검사기가 그렇게 잡는다 - `test/unit/scripts/check-variant-config.test.ts` 의 ".env 의
EAS 프로젝트 id 가 섞였다" 표본.

**루트의 `android/` 가 바탕이 되지 않는다.** 저장소 안에서 빌드하는 E2E 하네스(경로가 짧은 Windows·Linux·macOS)나 dev
client 의 prebuild 는 루트에 `android/` 를 남긴다(`.gitignore` 의 `/android` 라 git 은 보지 않는다). 이 머신의 하네스는
짧은 경로 사본(`C:/t/e`)에서 빌드해 루트가 비어 있으므로, 그 사본의 e2e AndroidManifest.xml·strings.xml 을 루트의
`android/app/src/main/` 아래에 복사해 같은 상태를 만들었다. 루트에서 `pnpm exec expo config --type introspect` 하던 옛 [8]
은 첫 평가에서 멈췄고,

```text
변형 설정 위반 1건 (development):
- Android 딥링크 scheme: ["templateexpo-e2e","templateexpo-dev"] - 기대한 값은 ["templateexpo-dev"]
```

여덟 평가를 모두 돌리면 e2e 만 통과하고 여섯이 어긋났다. 설정 플러그인(`@expo/config-plugins` 57.0.9)의 Android
매니페스트 기본 mod 는 `android/app/src/main/AndroidManifest.xml` 이 있으면 그것을 읽고(읽지 못할 때만 템플릿으로
돌아간다), `setScheme` 은 이미 있는 scheme 을 빼고 나머지를 더하기만 한다 - 앞선 빌드의 scheme 이 남는다. 새 [8] 은 같은
`android/` 가 있는 채로도 여덟이 통과했고, `android/` 를 지운 뒤 곧바로 이어 돌려도 여덟이 통과했다(두 출력이 같다. 임시
`android/` 는 지웠다). 사본 안으로 `cd` 해서 평가하면 Windows 에서 끝난 직후 사본을 지우지 못했다(`Device or resource
busy`, 다섯 번 모두) - 저장소 루트에서 디렉터리 인자로 평가하면 첫 시도에 지워졌다.

**어긋남을 잡는다.** 블록이 만든 사본의 `app.config.ts` 에서 `usesCleartextTraffic: profile.allowCleartext` 를 `true` 로
바꾸고(사본이라 저장소의 파일은 그대로다) 같은 평가를 돌리면 development 둘은 통과하고 preview 에서 멈췄다. 멈춘 뒤에도
사본은 지워졌다:

```text
변형 설정 위반 1건 (preview):
- Android 평문 HTTP(usesCleartextTraffic): "true" - 기대한 값은 "false"
```

변이는 사본에만 있어 저장소는 그대로이고, 변이 없는 블록은 여덟이 통과한다. 검사기의 자리마다 어긋난 표본이 실패하는 것은
`test/unit/scripts/check-variant-config.test.ts` 가 잰다 - 21자리 모두에 표본이 하나씩 있다. 저장소 밖의 사본에서 검사기의
자리를 하나씩 꺼 보면(자리마다 변이 하나 - 그 자리의 비교 `expectValue` 만 건너뛰게 한 검사기로 시험을 돌린다) 스물한 변이가
모두 시험을 빨갛게 하고, 자리마다 그 자리의 표본이 실패한다.

## O4 — e2e APK 의 변형 설정과 빌드 정보 카드 (기기)

**명령.** `E2E_AVD=Pixel_9_API_36 E2E_FORCE_BUILD=1 ./scripts/check.sh` - Pixel_9_API_36(Android 16, API 36), FastAPI 스택.
게이트 한 번이 빌드 입력이 바뀐 e2e APK 를 짧은 경로 사본에서 한 번 만들고(`test/e2e/android.sh build`) 플로를 전부 돌았다.
`E2E_FORCE_BUILD=1` 은 개발 중에 같은 빌드 입력으로 APK 를 만들어 둔 탓에 게이트가 빌드를 건너뛰지 않게 준 것이다(D4·D5 와
같다). `TEMP`·`TMP` 는 `.maestro-output/` 안에 따로 만든 디렉터리로 돌렸고(D5 와 같다), 에뮬레이터는 게이트 앞에 꺼 두어
하네스가 다시 부팅했다. 게이트는 `=== [1/13] typecheck ===` 부터 `=== 전부 통과 ===` 까지 32분에 지났다 - 단위 시험은 75 파일
1667 개다(계획이 적은 1647 보다 스물 많다 - 계획 뒤에 더한 시험이다). 게이트 앞의 개발용 빌드가 두 번 죽어 빌드 레시피
(`test/e2e/android.sh` 의 `build`)를 두 곳 고쳤다 - 아래 "빌드 레시피의 고침". 그래서 APK 를 결정 1 의 한 번보다 많이(개발용
셋, 게이트 하나) 만들었다.

**APK 의 설정.** `android.sh build` 가 만든 APK 에서 읽은 값이다 - 앱 설정(`assets/app.config`)과, build-tools 의
`aapt2 dump xmltree` 로 읽은 병합된 AndroidManifest.xml.

```text
APK 의 앱 설정: extra.appVariant=e2e
APK 의 OTA: updates={"enabled":false} runtimeVersion=undefined · AndroidManifest.xml ENABLED=false URL=- HEADERS=- usesCleartextTraffic=true
```

e2e 변형은 OTA 를 끄고(`updates` 가 `{ enabled: false }`, `runtimeVersion` 없음, expo-updates 의 `ENABLED=false`,
업데이트 주소·채널 머리글 없음) 평문 HTTP 를 켠다(`usesCleartextTraffic=true`) - 게이트 [8] 이 빌드 전에 잰 e2e 의 값과
같다(O3).

단언이 어긋난 APK 를 잡는지는 빌드 없이 쟀다 - 저장소의 `assert_apk_ota_off` 를 떼어 이 브랜치의 트리에서 만든 APK 에
돌리면 `APK 의 앱 설정이 OTA 를 끄지 않았다 (updates=undefined runtimeVersion=undefined)` 로 멈췄다. 이 APK 의 앱 설정에는
`updates` 가 없었지만 매니페스트에는 이미 expo-updates 메타데이터(`expo.modules.updates.ENABLED=false` 등)가 있었고,
게이트 APK 의 매니페스트와는 Room 서비스 요소 하나만 달랐다. 정확한 빌드 시점·커밋은 당시 기록에 없다. 함수가 읽는 두 입력을
한 자리씩 바꾼 여덟 변이 - 앱 설정 JSON 의 OTA 켬·`runtimeVersion`·`updates` 없음, 그 APK 의 aapt2 출력(줄 끝이 CRLF 다)의
평문 HTTP `false`·평문 HTTP 속성 없음·`ENABLED=true`·업데이트 주소·채널 머리글 - 도 모두 멈췄다.

**빌드 정보 카드.** 플로 `home-build-info` 가 홈의 카드에서 앱 버전 `0.1.0`, 변형 `e2e`, OTA `꺼짐`, runtime
version·채널·업데이트 ID `없음`, 확인 버튼 대신 안내를 봤다. 기기에서 잰 것은 카드의 표시다. 끈 Android 빌드의 runtime
version·채널은 빈 문자열이고 업데이트 ID 는 없다는 것은 설치한 expo-updates 57.0.24 소스(`DisabledUpdatesController` 와
`UpdatesModuleConstants`)에서 읽은 값이며, 기기에서 이 원시 값을 직접 재지 않았다. 그 플로의 기기 로그에서 앱의 줄은
`Running "main"` 하나뿐이다 - 스물한 플로 모두 `W/`·`E/ReactNativeJS` 줄이 없다.

```text
 Test Files  75 passed (75)
      Tests  1667 passed (1667)
=== [8/13] 설정 ===
변형 설정 통과: development - 17건, OTA 끔
변형 설정 통과: development + EAS 프로젝트 00000000-0000-4000-8000-000000000000 - 17건, OTA 끔
변형 설정 통과: preview - 17건, OTA 끔
변형 설정 통과: preview + EAS 프로젝트 00000000-0000-4000-8000-000000000000 - 21건, OTA 켬(채널 preview)
변형 설정 통과: production - 17건, OTA 끔
변형 설정 통과: production + EAS 프로젝트 00000000-0000-4000-8000-000000000000 - 21건, OTA 켬(채널 production)
변형 설정 통과: e2e - 17건, OTA 끔
변형 설정 통과: e2e + EAS 프로젝트 00000000-0000-4000-8000-000000000000 - 17건, OTA 끔
 Test Files  1 passed (1)
      Tests  89 passed (89)
=== [13/13] E2E ===
--- auth-links
--- contract-lab-anonymous
--- contract-lab-signed-in
--- examples-browse
--- examples-create
--- examples-delete
--- examples-edit
--- examples-empty-notfound
--- examples-invalid-filter-en (en-US)
--- examples-offline-refetch
--- examples-scroll-refresh
--- examples-sort-filter
--- examples-write-errors
--- guard-return
--- home-build-info
--- login-error-en (en-US)
--- login-error-ko (ko-KR)
--- logout-from-protected
--- register-conflict
--- register-invalid
--- register-restore-logout
=== E2E 통과 - 플로 21개 ===
```

**빌드 레시피의 고침 - 개발용 빌드가 두 번 죽었다.** 게이트 앞에 `E2E_FLOW` 로 플로 몇만 돈 하네스의 빌드다.

1. 첫 빌드 - `> Task :expo-updates:kspReleaseKotlin FAILED` / `e: [ksp] java.lang.OutOfMemoryError: Metaspace`. 이어 데몬이
   `Exception in thread "RMI TCP Connection(idle)" java.lang.OutOfMemoryError: Metaspace` 를 되풀이하며 멈춰 손으로 끝냈다.
   끝내기 전의 `jcmd <pid> GC.heap_info` 에서 Gradle 데몬의 Metaspace 는 `used 521246K, committed 524288K` 로 상한
   (`-XX:MaxMetaspaceSize=512m` - prebuild 가 만드는 `android/gradle.properties` 의 `org.gradle.jvmargs=-Xmx2048m
   -XX:MaxMetaspaceSize=512m`)에 닿아 있었고 Kotlin 데몬 둘은 78MB·114MB 였다. D5 와 달라진 것은 expo-updates 가 KSP 를
   쓰는 모듈 하나를 더한 것이다 - Room 컴파일러, KSP 2.1.20-2.0.1(KSP2 - Kotlin 의 분석 API 를 Gradle 데몬 안에 싣는다).
   실패한 순간에 `lintVitalAnalyzeRelease` 여덟이 함께 돌았다(`org.gradle.parallel=true`, 이 머신은 32코어). 고침: `./gradlew`
   에 `-Dorg.gradle.jvmargs="-Xmx4096m -XX:MaxMetaspaceSize=1024m"` 를 준다(명령줄의 `-D` 가 gradle.properties 보다
   앞선다). 다음 빌드에서 데몬과 Kotlin 데몬이 그 값으로 떴고, 데몬의 Metaspace 는 5초마다 잰 값으로 최대 461583K 였다.
2. 둘째 빌드 - `kspReleaseKotlin` 은 지났고 `> Task :app:createReleaseUpdatesResources FAILED` / `Process 'command 'cmd''
   finished with non-zero exit value -1073741819 (NTSTATUS 0xC0000005)`. 그 단계(expo-updates 의
   `createManifestForBuildAsync`)는 내장 매니페스트(`app.manifest`)를 만들려고 Metro 를 캐시를 지우지 않고(`resetCache:
   false`) 돌린다. 매니페스트는 다 쓰였다(자산 29) - node 의 종료에서 죽었다. 같은 빌드에서 번들 단계
   (`createBundleReleaseJsAndAssets`, `--reset-cache`)가 먼저 돌아 metro-cache(30MB)를 채운 뒤였다. Gradle 밖에서 같은 명령
   (`node node_modules/expo-updates/utils/build/createUpdatesResources.js android <사본> <출력> all <entry>`, `APP_VARIANT=e2e`,
   같은 TEMP)을 되풀이하니 캐시를 둔 채 13번 중 7번이 exit 139 였고(매번 매니페스트는 썼다), 매번 metro-cache 를 지우고는
   10번 중 0번이었다 - D1 실측 M1 관찰 8·D3 실측 L7 과 같은 모양이다. 고침: 그 단계를 먼저 빈 캐시에서 따로 돌리고
   (`./gradlew :app:createReleaseUpdatesResources`) 캐시를 다시 비운 뒤 `./gradlew assembleRelease` 를 돌린다. 첫 빌드는 이
   단계를 지났다 - 이 충돌은 간헐적이다.
3. 셋째 빌드 - 첫 Gradle 이 `BUILD SUCCESSFUL in 48s`(`33 actionable tasks: 1 executed, 32 up-to-date`), 둘째 Gradle 에서
   `> Task :app:createReleaseUpdatesResources UP-TO-DATE` 와 `BUILD SUCCESSFUL in 4m 38s`. 단언 두 줄은 위 "APK 의 설정" 과
   같았다. 게이트의 빌드도 같다 - 첫 Gradle `BUILD SUCCESSFUL in 29s`(1 executed, 32 up-to-date), 둘째 Gradle 의
   `> Task :app:createReleaseUpdatesResources UP-TO-DATE`, `BUILD SUCCESSFUL in 4m 35s`.

**레시피 유지 조건.** 두 단계 Gradle 은 둘째 실행에서 `createReleaseUpdatesResources` 가 UP-TO-DATE 인 것에 기댄다 - 지금
그 단계의 입력은 파일 없이 문자열·문자열 목록·불리언뿐이다. expo-updates 를 올릴 때마다 게이트 로그에 `> Task :app:createReleaseUpdatesResources UP-TO-DATE`
가 여전히 있는지 확인한다. 둘째 실행에서 다시 돌면 번들 단계가 채운 캐시 위의 Metro 로 돌아갈 수 있어 순서를 다시 검토해야
한다. 두 번째 Metro 캐시 비우기는 번들 단계도 빈 캐시에서 시작하게 하려는 것이다(D3 실측 L7 의 불변식).

**홈이 위에서부터 쌓인 뒤의 두 번 누름.** D6 의 홈은 뿌리가 `ScrollView` 이고 내용을 위에서부터 쌓는다(카드가 길어져도
진입이 움직이지 않게). 그래서 두 플로의 둘째 누름이 닿는 자리가 D4·D5 와 달라졌다. Pixel 9(1080×2424, 420dpi)에서 Maestro
가 누른 좌표(디버그 기록의 `Tapping at` - 개발용 실행과 게이트에서 같았다)를 uiautomator 덤프와 맞댔다.
`contract-lab-anonymous` 의 `home-lab-link` 두 번 누름은 (540, 677) 이고, 실험실에서 그 점은 첫 카드 `lab-card-putUpsert` 의
설명 글([87,629][995,841], 누를 수 없다)이다 - 그 카드의 실행 버튼 `lab-run-putUpsert` 는 y=1010 부터다(126dp 아래).
`examples-create` 의 로그인 제출 두 번 누름은 (540, 993) 이고, 로그인 전에 떠 있던 홈의 덤프에서 그 점은
`build-info-card`([63,772][1017,1527])의 버전 행(y=975 까지)과 변형 값(y=996 부터) 사이다 - OTA 를 끈 빌드의 카드에는
누를 수 있는 노드가 없다. 로그인 뒤 홈의 덤프를 따로 재지는 않았다. 두 플로가 통과했고, 두 플로의 주석과
`test/e2e/AGENTS.md` 의 문장을 이 자리로 고쳤다.

**재지 않은 것.** OTA 를 켠 변형(preview·production)의 기기 동작은 아직 재지 않았다. D9(스펙 15장 9단계, 사용자 승인 뒤)의
OTA 켬 경로는 다음 여섯 항목으로 잰다.

1. preview 빌드의 카드 - OTA `켜짐`, 채널 `preview`, 업데이트 `<id> (내장 번들)`.
2. 업데이트 발행 → "업데이트 확인" 누름 → 스피너만 표시 → 앱이 다시 켜짐 → 업데이트 행에 새 ID 가 보이고 `(내장 번들)` 이
   사라짐.
3. 다시 "업데이트 확인" 을 누름 → `새 업데이트가 없습니다.`.
4. 비행기 모드에서 "업데이트 확인" 을 누름 → `업데이트를 확인하지 못했습니다. <native 문구>`.
5. `ON_LOAD` 가 이미 받아 둔 업데이트는 확인·받기가 끝나 곧바로 다시 켜짐 - 설치한 expo-updates 소스에서 읽은 순서의 전제이며
   기기에서 재지 않았다(`lib/updates/AGENTS.md` 의 "확인의 순서").
6. 스크린 리더가 결과 문구를 읽음 - Android 의 `build-info-message` 는 `accessibilityLiveRegion="polite"` 를 가진 새로 마운트된
   노드다. TalkBack 이 읽지 않으면 항상 마운트된 래퍼로 고친다. iOS 에는 live region 이 없어 읽게 하려면
   `AccessibilityInfo.announceForAccessibility` 호출이 필요하다. 어느 쪽도 아직 재지 않았다.

**계정 없이 잴 수 있는 경로(미실측).** `APP_VARIANT=preview`, UUID 모양의 가짜 `EAS_PROJECT_ID`, https `BACKEND_URL` 을
prebuild 와 Gradle 에 모두 넘겨 로컬 Android APK 를 만들 수 있다. `android.sh build` 는 e2e 변형·OTA 끔을 단언하므로 그대로
쓸 수 없다 - prebuild 뒤 두 Gradle 명령에 위 JVM 인자를 손으로 주고, Metro 캐시 비움 → `:app:createReleaseUpdatesResources`
→ 캐시 다시 비움 → `assembleRelease` 순서도 손으로 따른다. 이 경로로 카드의 OTA `켜짐`, 채널, runtime version(fingerprint),
업데이트 ID 뒤의 `(내장 번들)` 과 확인 버튼을 잴 수 있다. 확인을 누르면 존재하지 않는 프로젝트라 실패한다 - 이 실패로 위
(4)의 실패 문구와 (6)의 스크린 리더 읽기를 계정 없이 잴 수 있고, (4)의 비행기 모드 조건도 함께 적용한다. 발행·적용 (2)와
새 업데이트 없음 (3)은 계정 없이 잴 수 없어 D9 에서 잰다. 이 로컬 빌드와 측정은 아직 하지 않았다.

iOS(D7 의 CI)의 OTA 끈 빌드가 카드에 주는 값도 그때 잰다. `expo-dev-client` 가 없어 development 프로필의 EAS 빌드는 설치를
묻는다(스펙 10.5 의 D6 정정). 위 두 고침은 이 저장소의 E2E 하네스 레시피에만 있다 - CI(D7)가 `test/e2e/android.sh build` 로
빌드하면 같은 JVM 인자와 두 단계 Gradle 을 물려받는다; 기본값(512MiB)으로 빌드하는 것은 EAS(D9)뿐이다. 같은 OOM 을 만나면
넓은 고침은 `withGradleProperties` 설정 플러그인이고 fingerprint 를 바꾼다(D7·D9 가 정한다). 0xC0000005 는 Windows 의 예외
코드다 - Linux·macOS 에서 빌드하는 CI(D7)·EAS(D9)는 이 충돌의 영향을 받지 않는다고 보지만 재지 않았다.
