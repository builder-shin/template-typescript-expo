# D7 실측 기록 (2026-10-01)

K1·K2 실측일은 2026-10-02(Asia/Seoul)다. `feat/d7-ci`, 시작 커밋 `6107d25`에서 아래 명령을 한 번씩 돌렸다.

D7(CI - checks, Android×3, iOS×3)이 잰 것이다. 각 절은 **무엇을 했고(명령) 무엇이 나왔는가(출력)**를 사실로 적는다.
K1·K2 는 개발 머신(Windows 11, Git Bash, 에뮬레이터 `Pixel_9_API_36` - Android 16·API 36·Google Play 이미지)에서,
K3 은 GitHub Actions 에서 쟀다. 출력의 저장소 경로·계정 이름은 줄였다.

## K1 — 로컬: 정적 게이트, 세 백엔드의 계약 거울, 게이트 13단계와 멈춘 서버 확인(Android)

**정적 게이트.** `./scripts/check.sh --static` - CI 의 checks 잡이 부르는 것과 같다.

```text
static exit=0
=== [1/13] typecheck ===
=== [2/13] lint ===
=== [3/13] format ===
=== [4/13] secretlint ===
=== [5/13] 인용 ===
=== [6/13] 복사 출처 ===
복사 출처 기록 통과: 경로 54개, 이탈 41건, 원본 그대로 33개
=== [7/13] unit ===
 Test Files  87 passed (87)
      Tests  1809 passed (1809)
=== [8/13] 설정 ===
=== [9/13] 의존성 호환 ===
=== [10/13] 번들 ===
=== [11/13] compose ===
=== 정적 단계 [1]–[11] 통과 (--static) - 계약 거울·E2E 는 돌지 않았다 ===
joon before=9
joon after=9
compose remaining=0
```

**세 백엔드의 계약 거울.** `BACKEND_KIND=<종류> ./test/contract/run.sh` - FastAPI 는 게이트의 [12] 가 돈다.

```text
== nestjs
joon before=9
nestjs exit=0
[matrix] nestjs: 알려진 계약 드리프트 없음
 Test Files  1 passed (1)
      Tests  89 passed (89)
joon after=9
compose remaining=0
== rails
joon before=9
rails exit=0
[matrix] rails: 알려진 계약 드리프트 없음
 Test Files  1 passed (1)
      Tests  89 passed (89)
joon after=9
compose remaining=0
Error: BACKEND_KIND='probe-lab-unknown' 는 알려진 백엔드가 아니다 - fastapi | nestjs | rails 중 하나여야 한다
unknown exit=1
joon after unknown=9
compose remaining=0
```

모르는 백엔드는 종류 검증에서 도커를 건드리기 전에 멈췄다. FastAPI 도 아래 게이트에서 거울 89개를 통과했다.

**게이트 13단계와 멈춘 서버 확인.** `E2E_AVD=Pixel_9_API_36 E2E_CHECKS=1 ./scripts/check.sh` - E2E 단계가 플로 뒤에 백엔드를
내리고 같은 포트(4100)에 `test/e2e/stall-server.ts` 를 띄워 `test/e2e/checks/request-stall.yaml` 을 돌았다.

```text
joon before=9
fresh boot exit=0
gate exit=0
=== [1/13] typecheck ===
=== [2/13] lint ===
=== [3/13] format ===
=== [4/13] secretlint ===
=== [5/13] 인용 ===
=== [6/13] 복사 출처 ===
=== [7/13] unit ===
 Test Files  87 passed (87)
      Tests  1809 passed (1809)
=== [8/13] 설정 ===
--- APP_VARIANT=development EAS_PROJECT_ID=(없음)
--- APP_VARIANT=development EAS_PROJECT_ID=00000000-0000-4000-8000-000000000000
--- APP_VARIANT=preview EAS_PROJECT_ID=(없음)
--- APP_VARIANT=preview EAS_PROJECT_ID=00000000-0000-4000-8000-000000000000
--- APP_VARIANT=production EAS_PROJECT_ID=(없음)
--- APP_VARIANT=production EAS_PROJECT_ID=00000000-0000-4000-8000-000000000000
--- APP_VARIANT=e2e EAS_PROJECT_ID=(없음)
--- APP_VARIANT=e2e EAS_PROJECT_ID=00000000-0000-4000-8000-000000000000
=== [9/13] 의존성 호환 ===
=== [10/13] 번들 ===
=== [11/13] compose ===
=== [12/13] 계약 거울 ===
[matrix] fastapi: 알려진 계약 드리프트 없음
 Test Files  1 passed (1)
      Tests  89 passed (89)
=== [13/13] E2E ===
> Task :app:createReleaseUpdatesResources UP-TO-DATE
APK 의 앱 설정: extra.appVariant=e2e
APK 의 OTA: updates={"enabled":false} runtimeVersion=undefined · AndroidManifest.xml ENABLED=false URL=- HEADERS=- usesCleartextTraffic=true
[matrix] fastapi: 알려진 계약 드리프트 없음
--- auth-links
--- contract-lab-anonymous
--- contract-lab-signed-in
--- examples-browse
--- examples-create
요청 수: examples-create - 회전 1·POST 1·로그인 1
--- examples-delete-offline
--- examples-delete
요청 수: examples-delete - 목록 GET 2
--- examples-edit
요청 수: examples-edit - 회전 4·PATCH 4
--- examples-empty-notfound
--- examples-invalid-filter-en (en-US)
--- examples-offline-refetch
--- examples-scroll-refresh
요청 수: examples-scroll-refresh - 상세 뒤 목록 GET 2
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
--- request-stall
=== E2E 통과 - 플로 22개 ===
=== 전부 통과 ===
joon after=9
compose remaining=0
```

게이트 전에 adb 서버를 내렸다 올리고 `E2E_AVD=Pixel_9_API_36 ./test/e2e/android.sh boot`로 새로 부팅했다. 빌드 입력이
바뀌어 `C:/t/e`의 사본에서 APK를 한 번 다시 만들었고, 둘째 Gradle의 UP-TO-DATE 단언도 통과했다. 00:53:34–01:19:02
사이에 기기 준비와 게이트를 마쳤다. 실패·환경 흔적 안내·재실행은 없었고, 앱 코드·타임아웃·단언·가드는 고치지 않았다.
보존한 기기 로그에는 통과한 플로 11개에서 `Active window root not found`가 총 13번(플로별 1–3번) 있었다.
Maestro 로그의 `java.net.ConnectException`은 0번이었다. 이 UiDevice 경고는 앱 로그를 보는 가드의 대상이 아니며,
플로 실패를 동반하지 않았다.

멈춘 서버의 기록과 기기 로그의 `REQUEST_TIMEOUT` 두 줄이다. `adb logcat -v brief`에는 시각이 없으므로 개별 요청의
정확한 소요 시간은 이 출력으로 재지 못한다. 서버의 두 요청 시각 차는 15.548초로, 첫 요청의 15초 타임아웃과 다음
딥링크까지의 시간이다. 두 방식 모두 실제로 서버에 닿았고 `NETWORK_ERROR` 대신 `REQUEST_TIMEOUT`으로 끝났다.

```text
stall-server 127.0.0.1:4100
2026-10-01T16:18:29.541Z GET /api/v1/examples?filter%5Btitle%5D%5Bcontains%5D=probe-stall-headers&page%5Bafter%5D=&page%5Bsize%5D=20&include=category%2Ctags mode=headers
2026-10-01T16:18:45.089Z GET /api/v1/examples?filter%5Btitle%5D%5Bcontains%5D=probe-stall-body&page%5Bafter%5D=&page%5Bsize%5D=20&include=category%2Ctags mode=body
I/ReactNativeJS(13970): [e2e-http] 0 GET /api/v1/examples REQUEST_TIMEOUT
I/ReactNativeJS(13970): [e2e-http] 0 GET /api/v1/examples REQUEST_TIMEOUT
```

**받은 APK 로 도는 길.** CI 는 APK 를 한 번 만들어 `E2E_APK` 로 넘긴다 - 게이트가 만든 APK 로 같은 길을 돌았다.

```text
joon before=9
E2E_APK=C:/t/e/android/app/build/outputs/apk/release/app-release.apk
apk exit=0
미리 만든 APK 를 쓴다 - 빌드하지 않는다 (C:/t/e/android/app/build/outputs/apk/release/app-release.apk)
--- guard-return
=== E2E 통과 - 플로 1개 ===
joon after=9
compose remaining=0
```

받은 APK 실행에는 Gradle이나 "APK 를 다시 만들지 않는다" 줄이 없다. 이 실행이 E2E 디렉터리를 비우기 전에 게이트의
기록을 `.maestro-output/d7-gate-e2e/`로 보존했다. 원본 로그는 `.maestro-output/d7-static.log`,
`d7-mirror-nestjs.log`, `d7-mirror-rails.log`, `d7-gate.log`, `d7-apk.log`이고, 모두 로컬의 무시된 산출물이다.

## K2 — 360dp 에서 필터 시트의 날짜 자리표시자

D3 최종 검토가 넘긴 확인이다(`최소 YYYY-MM-DD` 가 반 폭의 입력 칸에서 잘릴 수 있다). 에뮬레이터의 화면을
`wm size 1080x1920`·`wm density 480`(360×640dp)으로 바꾸고 목록의 필터 시트에서 날짜 칸 둘을 화면에 들여 찍었다.

```text
joon before up=9
joon after up=9
Physical size: 1080x2424
Override size: 1080x1920
Physical density: 420
Override density: 480
narrow exit=0
filter-input-createdAt-gte bounds="[48,1608][528,1728]"
filter-input-createdAt-lte bounds="[552,1608][1032,1728]"
(wm size reset · wm density reset 뒤)
Physical size: 1080x2424
Physical density: 420
joon before down=9
joon after down=9
compose remaining=0
.maestro-output/d7-narrow/filter-sheet-360dp.png
```

두 입력 칸의 폭은 각각 `(528−48)÷3 = 160dp`, `(1032−552)÷3 = 160dp`다. 1080×1920 스크린샷을 직접 열어
`최소 YYYY-MM-DD`·`최대 YYYY-MM-DD`가 마지막 `DD`까지 온전히 보임을 확인했다. 잘림이 없으므로 날짜 칸의 배치나
앱 코드를 고치지 않았다. 화면 크기·밀도는 원래 값으로 돌아왔고 `Override` 줄이 남지 않았다.

명령은 `E2E_API_PORT=4100 docker compose -p template-typescript-expo-e2e -f docker-compose.e2e.yml --profile fastapi up -d --build --wait`,
`adb shell wm size 1080x1920`, `adb shell wm density 480`, `maestro test --no-ansi ../d7-narrow-sheet.yaml`,
`adb exec-out uiautomator dump /dev/tty`, 크기·밀도 reset, 같은 compose 프로젝트의 세 프로파일 `down -v --remove-orphans`다.
Maestro 2.11.0은 스크린샷을 기본 `~/.maestro/tests/2026-10-02_012132/d7-narrow-sheet/takeScreenshot/`에 썼으므로,
처음 `find .maestro-output/d7-narrow -name filter-sheet-360dp.png`는 빈 출력이었다. 이미 찍은 원본을 위 산출물 경로로
복사해 보존했으며 플로를 다시 돌리지 않았다. 명령 로그·UI 덤프는 `.maestro-output/d7-narrow/`에 있다.

## K3 — GitHub Actions: 매트릭스의 첫 실행부터 초록까지

`.github/workflows/ci.yml` 의 잡 다섯(매트릭스 둘 - 아홉 칸)을 `feat/d7-ci` 의 push 로 돌렸다(사용자 승인 - 공개 저장소,
2026-10-01). 실행마다 무엇이 실패했고 무엇을 고쳤는지를 적는다. 같은 코드로 다시 돌린 실행은 없다(러너 할당 실패로 잡이
시작도 못 한 경우만 예외이고, 있었으면 그 행에 적는다). 실행은 여섯 번이 상한이었다.

**시작(2026-10-02, Asia/Seoul).** `feat/d7-ci`의 깨끗한 머리 `1d15b4d86e9a72f153ed0680615224dccb18e8ce`를
처음 push 했다. `origin/main`은 D6 병합 `bdf06b5`였고, 보낸 D7 커밋은 여덟이었다. 원격 브랜치는 없었고 저장소는
`public main`, Actions는 켜져 있었으며 인증 계정 `builder-shin`의 토큰에 `repo`·`workflow` 범위가 있었다.

러너 이미지 README를 GitHub API로 받았다. macOS 26 arm64는 `20260907.0351.1`·Bash `3.2.57(1)-release`·기본
Xcode `26.6`(`17F113`)·Java `21.0.12+101.0`·가장 새 iOS 런타임 `26.5`(iPhone 17 포함), Ubuntu 24.04는
`20260920.314.1`·Docker Compose `2.38.2`·build-tools `34.0.0`–`37.0.0`·NDK `27.3.13750724`(기본),
`28.2.13676358`, `29.0.14206865`였다. 계획의 사실 절과 같았다. README 원본은 무시된
`.maestro-output/runner-images/`에 보존했다. 실행 1의 checks 잡은 실제 Ubuntu 이미지 `20260927.320.1`로
README보다 새 판이었다(`Set up job` 로그). 그 잡에서 정적 게이트와 단위 87파일·1809시험, actionlint가 통과했다.

`gh run list --workflow ci.yml`은 기본 브랜치에 그 파일이 아직 없어 HTTP 404였다. 브랜치·커밋·push 이벤트로
조회해 첫 실행을 찾았다. 워크플로는 정상 발화했으므로 설정이나 트리거를 고치지 않았다.

| 실행 | 커밋 | 칸별 결과 | 원인과 고친 것 |
| --- | --- | --- | --- |
| 1 — [36892458805](https://github.com/builder-shin/template-typescript-expo/actions/runs/36892458805) | `1d15b4d` | checks·build-android·build-ios success; android fastapi·nestjs·rails failure; ios fastapi·nestjs·rails failure | iOS 셋: 없는 `setup-uv@v10` 별칭 → D7-R13으로 `@v10.2.0` 고정. Android의 첫 상세 예외는 숨김 debug 제외로 유실 → 두 플랫폼 기록에 `include-hidden-files: true`, K3 화면 캡처 셋 추가. Android 플로 실패 원인은 아직 미확정이며 다음 실행의 원본 로그로 찾는다. |
| 2 — [36901767491](https://github.com/builder-shin/template-typescript-expo/actions/runs/36901767491) | `d8e0592` | checks·build-android·build-ios·android nestjs success; android fastapi·rails 및 ios 셋 failure | Rails: Ruby Darwin 23 플랫폼이 잠금에 없어 frozen Bundler 실패 → D7-R14 플랫폼 가드. Android 둘: splash 전송 timeout 뒤 남은 starting_reveal → D7-R15 native exit listener 해제. iOS 둘: 딥링크 시스템 확인창 → D7-R16 공통 확인창 처리. 아래에 첫 오류·증거·검증을 적는다. |
| 3 — [36912828333](https://github.com/builder-shin/template-typescript-expo/actions/runs/36912828333) | `19db522` | checks·build-android·build-ios·android 셋 success; ios 셋 failure | Android 셋 각각 22플로 통과, splash timeout 0. iOS: Keychain entitlement 누락 → D7-R18 Simulator 서명·검증. 폼/목록 배지의 UIKit 묶음 → 부모 값·순서로 단언. NestJS 홈 유지/FastAPI 404 뒤 skeleton은 원인 미확정이며 D7-R20 승인 경계 관측만 함께 더한다. |
| 4 — [36927109091](https://github.com/builder-shin/template-typescript-expo/actions/runs/36927109091) | `7f4cf71` | checks·빌드 둘·Android 셋 초록, iOS 셋 빨강 | iOS 세 칸 모두 JS 시작 전 Taskgated Invalid Signature로 실패했다. R18의 서명 검증·권한 존재는 통과했지만 실제 실행은 거부됐다. 같은 셀의 세 번째 수정 뒤 실패로 총4회에서 중지(D7-R20), 추가 코드 push·실행5·rerun 없음. 마지막 실패는 고치지 못했고 기록만 커밋한다. |

**실행 4의 셀별 상한 중지.** iOS Rails E2E 단계가 22:01:52Z failure, 잡도 failure다. 같은 셀에 고침 배치가 세 번
닿은 뒤 다시 빨가므로 총 여섯 실행 이전인 4회에서 중지한다(D7-R20). 실행5나 같은 코드 rerun은 하지 않는다.
20플로 모두 launchApp에서 실패했고 JS/경계 관측은 0줄이다. 첫 실패 단계의 원본은
`.maestro-output/d7-run-4/e2e-ios-rails.log:1456`부터 다음과 같다:

```text
2026-10-01T21:40:38.0257800Z The request was denied by service delegate (SBMainWorkspace).
2026-10-01T21:40:38.0259630Z Underlying error (domain=FBSOpenApplicationServiceErrorDomain, code=1):
2026-10-01T21:40:38.0260590Z The request to open "com.example.templateexpo.e2e" failed.
```

그보다 구체적인 auth-links crash는 procLaunch21:39:56.1852+0000 / capture21:39:57.4500+0000,
`SIGKILL (Code Signature Invalid)` / `CODESIGNING` code1 / `Taskgated Invalid Signature`다. 원본은
`.maestro-output/d7-run-4/artifacts/e2e-ios-rails/template-typescript-expo/template-typescript-expo/.maestro-output/e2e/
auth-links/debug/.maestro/tests/2026-10-01_213603/auth-links/logs/crash-report.txt`, 명령은 같은 auth-links의
commands.json이다. first-ios-errors.json이 20실패와 native crash를 인덱싱한다. 서명 검증과 entitlement 존재는
통과했지만 실제 runtime 실행 허용은 실패했다. R18 ad-hoc 권한 전략의 Mac 실행 회귀이며 taskgated의 정확한 거부
요건은 미입증이다. fake CLI/Windows 시험으로 Mac 실행을 검증했다고 쓰지 않는다.

로캘 login-error-en은 clearState를 쓰지 않고 하네스가 원본 앱을 재설치한 뒤에도 같은 native crash다
(procLaunch21:56:48.8521+0000, 원본 TemplateExpoE2E.app). 따라서 Maestro 재설치 복사만의 문제로 단정할 수 없다.
다음 승인된 조사에서는 같은 Mac 이미지에서 Maestro 전에 원본 simctl launch와 taskgated 로그를 확인하고, 원본·
installed·clearState 뒤 앱의 서명/entitlement/hash를 비교해야 한다. 이 태스크는 코드 변경·추가 push 없이 기록만
커밋하며 스펙13/17의 초록 정정은 쓰지 않는다. Keychain 저장·접근성 고침과 기존 두 unknown은 실행4의 이 칸에서
JS 전 실패로 미검증이다. 최종 결과는 6 success / 3 failure, run_attempt1, 21:12:37–22:11:56 UTC다.
FastAPI·NestJS도 동일한 첫 crash이며 각 빨간 칸의 실패 로그·명령·native 근거는 다음과 같다. 경로 앞은 모두
`.maestro-output/d7-run-4/`다. 세 crash 모두 `SIGKILL (Code Signature Invalid)`와 `CODESIGNING` code1을 기록했다.

| iOS 칸 | 실패 단계 첫 로그 | launch 명령 시작 UTC / duration | auth-links crash-report 상대 경로 | native procLaunch UTC |
|---|---|---|---|---|
| fastapi | e2e-ios-fastapi.log:948, 21:40:02.6427660Z SBMainWorkspace 거부 | 21:37:41.865 / 110.531초 | artifacts/e2e-ios-fastapi/template-typescript-expo/template-typescript-expo/.maestro-output/e2e/auth-links/debug/.maestro/tests/2026-10-01_213517/auth-links/logs/crash-report.txt | 21:39:15.9462 |
| nestjs | e2e-ios-nestjs.log:1015, 21:40:57.1807590Z SBMainWorkspace 거부 | 21:38:52.728 / 69.365초 | artifacts/e2e-ios-nestjs/template-typescript-expo/template-typescript-expo/.maestro-output/e2e/auth-links/debug/.maestro/tests/2026-10-01_213553/auth-links/logs/crash-report.txt | 21:39:42.0073 |
| rails | e2e-ios-rails.log:1456, 21:40:38.0257800Z SBMainWorkspace 거부 | 21:39:19.894 / 60.587초 | artifacts/e2e-ios-rails/template-typescript-expo/template-typescript-expo/.maestro-output/e2e/auth-links/debug/.maestro/tests/2026-10-01_213603/auth-links/logs/crash-report.txt | 21:39:56.1852 |

NestJS·Rails는 각각 20플로, FastAPI는 20플로와 request-stall 확인도 launch에서 실패했다(끝의 실패 목록22는
checks/request-stall과 checks 집계 실패를 포함한다). JS0줄이므로 경고0을 무경고 검증으로 쓰지 않으며 로그 가드도
실행되지 않았다. full.log·failed.log·개별 잡 로그 아홉·아티팩트 아홉을 보존했고 watch exit1이다. 다음에 검증할 원인은
위 Mac signing/runtime 요건이며 이 태스크에서 코드 변경·권한/타임아웃/재시도 완화로 덮지 않는다.

**실행 3의 최종 결과와 iOS 실패.** 생성 `2026-10-01T19:14:36Z`, 결론 failure, run_attempt=1이다.

| 칸 | job ID | 결론 | 시간 |
| --- | --- | --- | --- |
| checks | 110539452577 | success | 2분 29초 |
| build-android | 110539452152 | success | 25분 25초 |
| android fastapi | 110549884744 | success | 29분 31초 |
| android nestjs | 110549884799 | success | 30분 31초 |
| android rails | 110549884677 | success | 31분 47초 |
| build-ios | 110539452527 | success | 10분 6초 |
| ios fastapi | 110543671194 | failure | 71분 24초 |
| ios nestjs | 110543671083 | failure | 68분 54초 |
| ios rails | 110543671837 | failure | 64분 59초 |

- FastAPI·Rails의 첫 `auth-links`는 UI를 통과하고 로그 가드가 `[auth] 세션을 저장소에 쓰지 못했다`로 실패했다.
  첫 원본 시각은 FastAPI `2026-10-01 19:35:40.601571+0000`, Rails `19:38:18.996610+0000`이다. NestJS도 다음
  `contract-lab-signed-in`의 `19:44:00.739356+0000`부터 같은 오류가 난다. 원인은
  `KeyChainException: A required entitlement isn't present. (ExpoSecureStore/SecureStoreModule.swift:123)`다.
  받은 `.app`의 Mach-O `LC_CODE_SIGNATURE`에는 linker ad-hoc CodeDirectory(blob type 0)만 있고 XML/DER
  entitlement(slot 5/7)가 없다(`app-signature-before.json`). Maestro 2.11.0 `clearState`는 이 binary를 그대로
  복사해 재설치한다. 앱 설정·HTTP 검증이 통과해도 SecureStore의 `SecItemAdd`에는 권한이 없었다.
- D7-R18은 결정14를 보완한다. `ios.sh build`는 `CODE_SIGNING_ALLOWED=NO`로 빌드한 뒤 Simulator e2e 앱만
  계정 없이 ad-hoc 서명한다. 중첩 framework/appex/dylib를 내부부터 서명하고 앱에
  `application-identifier=com.example.templateexpo.e2e`, `keychain-access-groups=[동일 ID]`를 준다. 만든 앱과
  `E2E_APP` 모두 `codesign --verify --strict --deep` 및 정확한 두 값을 검증한다. EAS·배포·실기기 서명과 무관하고
  키체인 비우기·오류 가드는 유지한다. 실제 Bash red시험 7개가 기존 검증의 누락을 증명했고, 수정 후 서명 9시험과
  기존 iOS 하네스 18시험이 통과했다. macOS 명령은 fake이므로 실제 서명 효력은 다음 CI가 처음 잰다.
- `examples-create`의 분류 선택은 화면에 맞게 그려졌는데 `relationship-value-category-0` 자식 노드가 없었다.
  실패 hierarchy에서 부모 `relationship-open-category`는 `accessibilityText=분류` 및
  `value/text=프로브 분류 하나`다. iOS의 버튼 접근성 묶음이므로 생성·수정의 선택/태그 순서/빈 선택/목록 밖 ID를
  이미 있는 부모 값으로 검증한다. Android의 자식 ID 단언은 유지한다. `examples-browse`도 분류·두 번째 태그가
  화면에는 있고 행의 전체 접근성 라벨에만 있었다. iOS는 `resource-row`와 bravo의 분류·charlie의 태그 둘과 순서·
  alpha의 UTC 시각을 함께 잰다. 제한 시간·로그 가드·로그인 repeat=2는 바꾸지 않았다.
- 별도 미확정 실패: NestJS `auth-links`는 native Open 누름과 확인창 사라짐이 통과한 뒤에도 홈이다
  (`19:34:56.398Z` 단언 시작; `step-013-assertCondition-login-screen.png`). FastAPI `examples-empty-notfound`는
  `20:02:00.167539+0000`에 완전히 읽은 404 `RESOURCE_NOT_FOUND`를 기록하고 `20:02:21`에도 skeleton이다.
  이 두 실패를 entitlement의 결과로 단정하지 않는다. 설치본 QueryObserver의 focus 전이 6개 및 production
  React Compiler 산출물 조사에서 focus-loss는 재현되지 않았다. 원인 확정을 위한 경계 관측이 필요한지 D7-R20으로
  컨트롤러에게 물었다. D7-R20은 서명·입증된 선택자 고침과 e2e 전용 경계 관측을 묶은 마지막 배치를 승인했다.
  미확정 두 원인을 고쳤다고 쓰지 않는다. `[e2e-state]`는 라우트·AppState·상세 QueryCache의 status/fetchStatus와
  관찰자 수만 정보로 남긴다. 다른 세 변형은 로그/기기·캐시 구독이 없고, 응답 본문·토큰·쿼리 문자열은 남기지 않는다.
  5개 단위 시험이 실제 캐시 알림·cleanup·민감한 본문 제외와 iOS 변환본의 보존을 확인했다.
  하위 조사 보고는 3파일/12probe 통과지만 무조건 적용할 고침은 입증 못 했다는 결론이다. 해당 Dispatch는 보고를
  받은 뒤 정상 release했다. timeout·재시도·조회 subscribed 옵션을 바꾸지 않는다.

원본은 `.maestro-output/d7-run-3/run.json`, 잡별 `.log`·`artifacts/`와 통합 `d7-run-3-failed.log`·
`d7-run-3-full.log`에 있다. iOS artifact는 `.maestro-output/e2e/` 앞에 저장소 이름이 두 번 중첩돼 있다.
`first-ios-errors.json`·`evidence-ios-<백엔드>.jsonl`은 각 실패의 첫 명령·시각/경고를 가려 낸 보조 기록이다.
같은 iOS 셀은 이번 고침이 세 번째이므로 실행 4에서 red면 총 여섯 번 이전이라도 중지한다(D7-R18).

**세 번째 배치의 로컬 검증.** 정적 게이트 `[1]–[11]`이 통과했다(90파일·1844시험, 출처54/41/33,
변형8평가·expo-doctor·Android/iOS `expo export --clear`·compose config). actionlint1.7.12·shellcheck0.11.0과
`git diff --check`도 통과했다. 새 Android APK는 두 Gradle(22초·3분44초), 둘째 UP-TO-DATE 및 e2e/OTA/HTTP
단언을 통과했고 FastAPI `examples-browse examples-create examples-edit examples-empty-notfound` 네 플로가 통과했다.
생성 회전1/POST1/로그인1, 수정 회전4/PATCH4다. 404 플로의 실제 logcat에 `[e2e-state]` 라우트·AppState·완료된
상세 쿼리 success/idle와 observers=1이 남았다. iOS 정보 줄 보존은 단위 변환 시험에서 확인했고 실제 iOS artifact는
다음 실행에서 확인한다. joon 9 → 9, E2E compose 잔여0, 소유한 emulator-5556만 종료했다.
기록은 `batch3-static.log`, `local-android-check.log`, `local-android-e2e/`, `e2e-diagnostics-focused.log`다.
push 전 GitHub의 기존 실행 세 개와 각각 run_attempt=1을 확인했다. 다음 일반 push가 실행4이며 고침 배치3이다.

**실행 1의 실패 증거와 고침.** 생성 시각은 `2026-10-01T16:30:04Z`, 결론은 `failure`다. 칸마다 걸린 시간:

| 칸 | 결론 | 시간 |
| --- | --- | --- |
| checks | success | 2분 37초 |
| build-android | success | 26분 45초 |
| android fastapi | failure | 40분 45초 |
| android nestjs | failure | 36분 51초 |
| android rails | failure | 35분 2초 |
| build-ios | success | 16분 13초 |
| ios fastapi | failure | 4초 |
| ios nestjs | failure | 4초 |
| ios rails | failure | 3초 |

- iOS 셋의 첫 오류: `Unable to resolve action astral-sh/setup-uv@v10, unable to find version v10`.
  checkout 전에 실패했다. GitHub API의 `git/ref/tags/v10`은 404, 실제 릴리스 `v10.2.0`은
  `c18668ad3cf93ea998bef934396af7bb5c839dc7`이다. `action.yml`의 Node 24를 확인한 뒤 컨트롤러 결정 D7-R13으로
  정확한 릴리스 태그 예외를 승인받았다. 단계의 다른 설정은 고치지 않았다.
- Android 셋의 `auth-links`는 `submit-credentials`의 `Input text ${EMAIL}`에서 끝났다. Rails의
  `examples-delete`도 같은 단계, NestJS의 `examples-create`는 첫 `list-empty` 단언에서 실패했다. API별 계약
  거울은 모두 통과했다. UiAutomator의 `Active window root not found`는 Rails의 두 실패에서 각 1번, NestJS 생성
  실패에서 9번이었지만 그 경고만으로 원인을 단정하지 않는다. FastAPI는 그 환경 흔적을 찍지 않았다.
- Rails 아티팩트는 파일 66개(22플로 × maestro.log·logcat.txt·api.log), 스크린샷·commands.json·상세 예외가 없다.
  Maestro는 실제 debug 경로를 `<플로>/debug/.maestro/tests/...`로 안내했고, `upload-artifact@v7`의
  `include-hidden-files` 기본값은 false였다. 두 기록 단계에 true를 주어 유실 원인을 고쳤다. K3의 실제 카드·로그인
  두 번 누름 관측을 위해 `home-build-info`에 화면 하나, `examples-create`의 제출 전/로그인 뒤에 화면 둘을 더했다.
  누름·단언·타임아웃·가드는 그대로다. Android 플로의 실제 원인은 상세 예외 복구 뒤 찾는다.
- 로컬: Rails `auth-links examples-delete`를 같은 APK(`E2E_APK`, 빌드 없음)로 한 번 돌려 두 플로가 통과했다.
  `joon`은 9 → 9, E2E compose 잔여 0. 기록은 `.maestro-output/d7-run-1/local-rails-flows.log`,
  `local-rails-e2e/`다. CI 실패가 로컬에서 재현된 것으로 쓰지 않는다.
- 관측 고침의 로컬 검증: FastAPI `home-build-info examples-create`가 같은 APK로 통과했다. 캡처 PNG 셋이
  `debug/.maestro/tests/.../takeScreenshot/`에 실제 생겼고 생성의 요청 수는 회전 1·POST 1·로그인 1이었다.
  `joon` 9 → 9, compose 잔여 0. `.maestro-output/d7-run-1/local-capture-flows.log`·`local-capture-e2e/`에 보존했다.
  전체 Step 7 검사(typecheck·lint·format·secretlint·인용·출처·단위 87파일/1809시험·actionlint·shellcheck)도 통과했다.

실행 원본은 `.maestro-output/d7-run-1/run.json`, 잡 로그·아티팩트는 같은 디렉터리의 `*.log`·`artifacts/`,
통합 로그는 `.maestro-output/d7-run-1-failed.log`·`d7-run-1-full.log`에 보존했다. iOS E2E 아티팩트는 checkout
전에 실패해 생성되지 않았다. 같은 코드의 CI 재실행은 없었다.

**실행 2의 Rails 준비 실패.** `2026-10-01T18:01:45.9025440Z`의 첫 오류는 `Your bundle only supports platforms
["aarch64-linux", "arm64-darwin-24", "arm64-darwin-25", "x86_64-linux"] but your local platform is arm64-darwin-23.`다.
`.ruby-version`의 Ruby 3.4.8은 그대로지만 setup-ruby의 prebuilt가 Darwin 23으로 만들어져 Bundler 4.0.5의 frozen
deployment가 exit 16으로 막았다. PostgreSQL 18.6 bottle·Redis 준비는 통과했고 Rails E2E는 시작하지 않았다.
컨트롤러 D7-R14는 CI 임시 clone에 Ruby의 현재 플랫폼 한 줄만 더하도록 승인했다. `lock-platform`은 lockfile 전체를
비교해 그 `PLATFORMS` 추가 외 변경을 복구하고 실패하며, frozen 설치·젬 캐시는 유지한다. backend 원격은 고치지
않는다. 실제 bash를 돌린 가드 시험은 플랫폼-only 성공과 버전·의존성·소스·체크섬·다른 플랫폼 변경 실패를 잰다.
로그·소스 근거는 `.maestro-output/d7-run-2/`에, red/green 시험 로그는 `rails-guard-red.log`·`rails-guard-green.log`에 있다.
이 고침은 실행 2의 다른 실패와 한 배치로 보낸다. 고친 커밋은 다음 실행 행의 머리다.
실제 backend lockfile의 별도 fixture도 캐시된 Rails 이미지(Ruby 3.4.8/Bundler 4.0.5)로 확인했다. Darwin 23을 더한
전체 diff는 `PLATFORMS` 한 줄뿐이다(`.maestro-output/d7-run-2/rails-lock-probe.log`·`rails-lock-probe/Gemfile.lock`).
macOS E2E 재현은 아니며 lock 연산만 확인한 것이다. `joon` 9 → 9, `--rm` probe 컨테이너 잔여 0.

**실행 2의 Android 입력 실패.** FastAPI `auth-links`의 첫 상세 예외는 `2026-10-01 18:19:06.317`의
`DeviceServerDiedException: Device server died during 'inputText'` / `DEADLINE_EXCEEDED after 119.997732736s`다.
Rails도 같은 입력 단계다. 숨김 `logs/device-logcat.txt`에는 앱의 `Activity transferring splash screen timeout … state 2`
가 FastAPI `18:16:11.379`, Rails `18:17:56.406`에 있고, 이어 같은 MainActivity의 `animationType=starting_reveal`
대기가 반복된다. 키 입력마다 동기화 두 번이 각 5초를 소비해 67자 이메일이 RPC 120초 제한을 넘겼다. 서버 프로세스가
실제로 죽은 것은 아니며 deadline 뒤에도 키 로그가 이어진다. NestJS는 22플로를 통과했고 해당 이메일 입력은 17.015초였다.
통과 플로에도 `QueryController` idle 경고가 있으므로 그것을 원인으로 쓰지 않는다.

설치된 Expo splash 57.0.9의 `SplashScreenManager.kt`는 Android exit listener를 항상 등록한다. AOSP
`android16-release`의 `ActivityRecord`는 전송 제한을 2000ms로 두며, attach 성공은 starting-window 애니메이션을
취소하지만 timeout state 2는 그 취소를 거치지 않고 제거 경로를 다시 호출한다. `WindowState.removeIfPossible`은
첫 `starting_reveal`만 취소한다. `UiAutomation.injectInputEvent`의 두 인자 호출은 애니메이션 대기를 켠다.
소스 원본은 `.maestro-output/d7-run-2/aosp-*.java`와 Maestro 소스에 보존했다. 다른 저장소의 관련 이슈는 조사 단서로만
썼고 이 결론의 근거는 실제 CI 로그와 설치된 Expo·AOSP·Maestro 구현이다.

컨트롤러 D7-R15는 모든 변형의 native exit listener 해제를 승인했다. 새 `plugins/`는 Kotlin 앵커가 각각 한 번일 때만
등록 뒤·super 앞에 API 31 가드를 넣고, 이미 넣었으면 같은 소스를 돌려준다. 애니메이션 설정·RPC 제한·입력 내용·플로
단언·가드는 그대로며 Android 400ms fade를 시스템 기본 exit로 바꾸는 대가가 있다. 실제 Linux CI APK로 Windows
Pixel 9 GPU auto와 새 Pixel 7 SwiftShader AVD에서 `auth-links`를 각 한 번 돌려 통과했다. 자연 재현되지 않았으므로
그 두 성공을 원인 수정의 증명으로 쓰지 않는다. 각각 `joon` 9 → 9, E2E compose 잔여 0이었다.

**실행 2의 iOS 딥링크 확인창.** FastAPI·NestJS의 첫 `auth-links`는 홈까지 통과한 뒤 `openLink`의 목적 화면
`login-screen` 단언에 실패했다. 둘의 실패 PNG·hierarchy에 `Open in “Template Expo (E2E)”?`와 `Cancel`·`Open`이
있으며, 뒤 플로도 남은 시스템 창 때문에 `home-screen`을 보지 못했다. log stream의 TERM/wait hang이나 driver startup
timeout이 아니다. Maestro 2.11.0 `IOSDriver.openLink`는 확인창을 처리하지 않고 `autoVerify`도 쓰지 않는다.
컨트롤러 D7-R16이 `confirm-ios-open-link.yaml`을 승인했다. 모든 기존 `openLink` 뒤에 호출하며, iOS에서 정확한 OS
제목이 보일 때만 native `Open` 텍스트 버튼을 누르고 그 제목이 사라졌는지 단언한다. OS 버튼에는 앱 testID가 없어서
이 한 곳만 텍스트 누름 예외이며 소스 시험이 예외·누락을 막는다. URL·앱 단언·timeout·키체인·두 번 누름은 그대로다.
앱별 AppleLanguages 인자는 OS 영어창과 별개다. 실제 iOS 검증은 새 CI 실행으로만 할 수 있다.

**실행 2 칸별 시간.** checks 2:38, build-android 25:54, android fastapi 29:54, android nestjs 25:33,
android rails 33:18, build-ios 14:54, ios fastapi 54:06, ios nestjs 54:38, ios rails 0:51.
숨김 수집 고침 뒤 NestJS Android 아티팩트는 상세 로그·commands.json·PNG를 포함한 179파일, iOS는 FastAPI 314파일·
NestJS 298파일을 업로드했다. 원본은 `.maestro-output/d7-run-2/run.json`·잡 로그·`artifacts/`다. 같은 코드 재실행은 없다.

**실행 2 고침 배치의 로컬 검증.** `--static` [1]–[11]이 통과했다(88파일/1830시험, 깨끗한 introspect 여덟,
출처 54/41/33, 세 플랫폼 export, compose). push 전 Step 7 검사도 전체 exit 0이었다. 실제 scratch prebuild에서
처음에는 앵커 가드가 실패해 Expo MainActivity mod의 역순 실행을 발견했다. 배열에서는 새 플러그인을 Expo splash보다
먼저 등록해야 실제 앵커 생성 뒤에 실행한다. 순서를 고친 실제 prebuild는 registerOnActivity → Expo generated end →
API31 가드와 clearOnExitAnimationListener → super.onCreate를 한 번 생성했다. Native Kotlin 소스는
`.maestro-output/d7-run-2/generated-MainActivity.kt`에 보존했다. Node 직접 type stripping도 공개 모듈 경로의 `.js`
확장자를 확인해 통과했다. 변환/four variants/확인창의 focused 시험은 42개다.

`android.sh build`로 APK를 다시 만들어 둘째 Gradle UP-TO-DATE, e2e 변형·OTA 끔·평문 HTTP 단언을 통과했다.
새 소유 Pixel7 SwiftShader AVD에서 `auth-links` 한 플로도 통과했고, 상세 로그의 앱 splash 전송 timeout과
starting_reveal 애니메이션 대기는 0줄이었다. 자연 재현은 원래 없었으므로 CI가 수정의 실제 검증이다.
`.maestro-output/d7-run-2/local-fixed-build-auth-links.log`·`local-fixed-e2e/`, `batch2-static-final.log`·
`batch2-final-validation.log`·`batch2-unit-final.log`에 보존했다. `joon` 9 → 9, compose 잔여 0이며 새 소유 에뮬레이터만
종료했다. 원래 emulator-5554는 켜져 있다. 의존성·백엔드 원격·타임아웃·앱 단언·재시도 규칙은 바꾸지 않았다.

**초록 없음 — Task 4 failed.** 총 실행4회, 세 수정 배치 뒤에도 iOS 셋이 빨가므로 셀별 상한으로 중지했다. 스펙13/17의
초록 정정은 쓰지 않는다. 마지막 실행36927109091의 코드 커밋은7f4cf71796ece8fa4d2a97174fdd64a641cb1e2e다.
2026-10-01 UTC의 아홉 칸 최종 결과와 시간은 다음과 같다. 이 뒤에는 docs/만 바꾼 기록 커밋을 보내며 그 커밋은
paths-ignore 대상이다. K3 최종 커밋과 새 실행이 없다는 확인은 Task4 보고에 기록한다.

| 칸 | job ID | 결과 | 시작 UTC | 끝 UTC | 시간 |
|---|---|---|---|---|---|
| checks (게이트 [1]–[11]) | 110587042817 | success | 21:12:42 | 21:15:14 | 2:32 |
| build-android (e2e APK) | 110587042462 | success | 21:12:41 | 21:39:41 | 27:00 |
| e2e-android (fastapi) | 110597096630 | success | 21:39:44 | 22:11:53 | 32:09 |
| e2e-android (nestjs) | 110597096579 | success | 21:39:45 | 22:09:23 | 29:38 |
| e2e-android (rails) | 110597096580 | success | 21:39:44 | 22:11:55 | 32:11 |
| build-ios (e2e .app) | 110587042851 | success | 21:12:49 | 21:30:17 | 17:28 |
| e2e-ios (fastapi) | 110593699182 | failure | 21:30:26 | 22:11:50 | 41:24 |
| e2e-ios (nestjs) | 110593699137 | failure | 21:30:27 | 22:10:09 | 39:42 |
| e2e-ios (rails) | 110593699223 | failure | 21:30:26 | 22:02:21 | 31:55 |

**Android 빌드에서 이어받은 것.** 실행 1의 둘째 Gradle은 `2026-10-01T16:44:12.4356025Z`에
`> Task :app:createReleaseUpdatesResources UP-TO-DATE`를 남겼고 `BUILD SUCCESSFUL in 21m 50s`로 끝났다. APK의
변형 `e2e`, OTA 끔·runtimeVersion 없음, 매니페스트의 `ENABLED=false`·URL/HEADERS 없음·평문 HTTP 허용 단언이
통과했다. 빌드 레시피의 4GiB 힙/1GiB Metaspace를 그대로 썼다. 공개 Ubuntu 러너 RAM 16GB는 계획의 예산이며 이
실행에서 `free -h`, Kotlin 데몬의 실제 JVM 인자, 최대 RSS를 수집하지 않아 관측한 메모리 사용량으로 말할 수 없다.
OOM이나 메모리 예산 변경은 없었다. 로그는 `.maestro-output/d7-run-1/build-android.log`다(결정 40·41).
실행 3도 같은 예산으로 빌드 단언을 통과했다. 둘째 UP-TO-DATE는 `2026-10-01T19:30:25.1491482Z`, 둘째 Gradle
`BUILD SUCCESSFUL in 20m 44s`, 잡 전체 25분 25초다. 로그는 `.maestro-output/d7-run-3/build-android.log`다.
Android E2E 셋은 각각 22플로 통과했고, 숨김 auth-links device-logcat의 splash 전송/starting_reveal timeout은 모두
0줄이다. 첫 이메일 입력은 FastAPI 22.511초, NestJS 27.161초, Rails 26.651초 완료였다. 실행 2의 입력 RPC deadline을
만든 경로가 새 CI에서 사라진 것을 확인했다(`.maestro-output/d7-run-3/android-auth-native-evidence.json`).
실행 4도 build-android 21:12:41–21:39:41 UTC(27분) 통과, 둘째 UP-TO-DATE는 21:26:51.6710046Z,
둘째 Gradle22분34초, APK e2e/OTA/HTTP 단언 통과다. 메모리 예산은 그대로이며 실제 RAM/RSS는 여전히 미수집이다.

실행 4의 build-ios는 21:12:49–21:30:17 UTC(17분 28초) 통과했다. 21:30:03.5137140Z에 strict/deep 서명·정확한
application-identifier/keychain-access-groups 단언이 통과했고 앱 설정·OTA 끔·평문 HTTP도 통과했다. 받은 Mach-O의
XML slot5와 DER slot7에 두 entitlement가 실제로 있다(`.maestro-output/d7-run-4/app-signature-after.json`). 실행 3의
linker 서명은 그 두 slot이 없었다. 이어진 E2E 셋은 launch에서 실패해 실제 Keychain 저장을 검증하지 못했다.
Xcode26.6/17F113·Mac 이미지
20260907.0351.1은 같다. codesign의 `--entitlements :-`는 현재 통과하지만 향후 제거 예정 경고가 있어 관측 사항으로 남긴다.

**iOS 기기 실측의 한계.** 실행4는 모두 native launch에서 실패해 아래 Step8 항목을 검증하지 못했다. 실행3의 일부
화면 통과를 실행4나 아홉 칸 초록으로 대신하지 않는다.

- 빌드 카드·특수 문자 browse 딥링크: 실행4에서 화면에 도달하지 못했다. 빌드 artifact의 e2e/OTA/HTTP 설정 단언만 통과.
- 로캘 셋: launch arguments는 전달했지만 원본 앱도 taskgated로 종료돼 언어별 응답은 미실측이다.
- 요청 타임아웃: iOS FastAPI request-stall도 launch 실패, REQUEST_TIMEOUT0줄이며 headers/body 응답 검증 미실행이다.
- BackButton·sheet-backdrop·clearKeychain과 SecureStore 쓰기: reset/설치는 수행됐으나 화면·저장 검증에 도달하지 못했다.
- JS 경고 가드: JS0줄·관측0줄로 미실행이다. 이를 앱이 무경고라는 증거로 삼지 않는다.
- 쓰기 넷·홈 출구·로그인 둘째 누름(좌표/노드/요청1): 실행4에서 로그인에 도달하지 못해 결정43 검증은 미완이다.

**세 백엔드에서 처음 잰 것.** 근거는 `e2e-android-<백엔드>`·`e2e-ios-<백엔드>` 의 `api.log` 와 플로 기록이다.

- 쓰기 갈림 셋(빈 PATCH, 겹친 태그, 읽기 전용 속성)은 기존 22플로·계약 거울이 직접 실행하지 않았다. 변경 없는 저장도
  `lib/resources/write.ts`가 전체 속성·관계를 보내므로 빈 PATCH가 아니다. 태그 fixture는 서로 다른 두 id이고 폼은
  읽기 전용 속성을 보내지 않는다. 실행 2의 Android NestJS·Rails `examples-edit`·`examples-write-errors/api.log`는
  네 파일 모두 0바이트여서 서버 로그 기반 응답·회전 수는 미관측이다. 컨트롤러 결정 D7-R17에 따라 D7 Task 5의 계약
  거울에서 세 갈림과 `JWT_ACCESS_EXPIRES_SECONDS`를 세 백엔드에 직접 잰다. 관측만을 위한 별도 CI push는 하지 않는다.
- 하네스는 access10초를 설정했다. 실행4 Android FastAPI의 생성·수정 요청 수 가드는 통과했으나 직접 JWT 만료와 세
  백엔드의 요청별 응답/회전은 R17의 미관측 사항이다. 빈 PATCH·겹친 태그·읽기 전용 속성과 함께 D7 Task5가 직접 잰다.

**느린 기기에서 잰 것.** 근거는 칸마다의 `<플로>/maestro.log` 의 시각과 잡 로그다.

- 실행4 offset 둘의 시각(2026-10-01 UTC, 끝은 commands.json의 시작+duration)은 다음과 같다. 제한90초와 재시도0은 유지.

| 칸 | 첫 scroll 시작–끝 / duration | 둘째 scroll 시작–끝 / duration |
|---|---|---|
| Android fastapi | 21:46:46.154–21:47:03.790 / 17.636초 | 21:47:03.791–21:47:23.367 / 19.576초 |
| Android nestjs | 21:46:53.720–21:47:10.610 / 16.890초 | 21:47:10.611–21:47:27.277 / 16.666초 |
| Android rails | 21:48:18.651–21:48:37.242 / 18.591초 | 21:48:37.243–21:49:02.624 / 25.381초 |
| iOS fastapi·nestjs·rails | launch 실패로 미실행 | launch 실패로 미실행 |

- Android 세 칸에서 `E2E: 환경 흔적` 안내0줄, JS W/E·e2e-warn0줄, 22플로/가드 모두 통과했다. FastAPI request-stall은
  두 REQUEST_TIMEOUT 정보 줄과 stall-server.log의 headers22:10:25.314Z / body22:10:41.014Z가 일치했다.
  근거는 `.maestro-output/d7-run-4/evidence-<플랫폼>-<백엔드>.jsonl`과 아티팩트다. iOS의 빈 JS 로그는 별도 실패 한계다.
