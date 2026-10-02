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
시작도 못 한 경우만 예외이고, 있었으면 그 행에 적는다). 처음 계획의 실행 상한은 여섯 번이었다. 실행4의 셀별 중지 뒤 사용자가 Mac 재현·추가 실행을 승인했고,
코디네이터가 실행6의 Task5 통합 대체와 첫 초록 뒤 최종 검토 수정 검증을 승인했다(아래 표).

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
| 5 — [36941340879](https://github.com/builder-shin/template-typescript-expo/actions/runs/36941340879) | `4d2d099` | checks·두 빌드·Android 셋 success; iOS 셋 failure | Rails 첫 Open 후 route 지연, NestJS 가입422/입력 불일치 징후, FastAPI 제출→요청 지연 및 별도 로그인 timeout. R29 cold 목적지 보존·R32 scheme 사전승인·R33 전용 기기 서비스 정리/재부팅/진단을 추가했다. 구체적 원인 경계와 한계는 아래 Mac 재현 기록에 있다. |
| 6 — [36950606213](https://github.com/builder-shin/template-typescript-expo/actions/runs/36950606213) | `52a1742` | cancelled | Task5 통합 push가 이 실행을 대체하도록 코디네이터가 승인했다. 코드 변경 없는 rerun이 아니다. |
| 통합 — [36950704982](https://github.com/builder-shin/template-typescript-expo/actions/runs/36950704982) | `53e3134` | **아홉 셀 success** | Task4b 수정·Task5 계약 거울 통합. iOS 각21·Android 각23흐름, 단위1902·계약 각94시험 통과. |
| 최종 검토 — [36955635199](https://github.com/builder-shin/template-typescript-expo/actions/runs/36955635199) | `2599bf2` | **아홉 셀 success** | 첫 초록 뒤 코디네이터의 native Redis 소유권·BACKEND_KIND 오류 출력 검토 수정. 단위95파일1914시험·계약각94시험·iOS각21/Android각23흐름 통과. |

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

**실행4 종료 당시 초록 없음 — Task 4 failed.** 총 실행4회, 세 수정 배치 뒤에도 iOS 셋이 빨가므로 셀별 상한으로 중지했다. 스펙13/17의
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

### Mac 재현 — 2026-10-02 (D7 Task 4b)

사용자가 Mac 재현·수정과 추가 CI 두 번(실행 5·6)을 승인했다. Mac은 macOS 27.0(26A428), Xcode 27.0(27A266a),
iOS 27.0/iPhone 17, Node 24.19.0, corepack pnpm 11.22.0, Java 17이다. frozen install은 잠금 파일을 바꾸지 않았다.
Maestro 2.11.0은 저장소 설치기로 설치했고 ShellCheck 0.11.0·actionlint 1.7.12는 무시된 도구 디렉터리에 체크섬을
확인해 풀었다. Homebrew 서비스는 설치하지 않았다. Xcode는 로컬 wrapper로 `-jobs 4`를 줬다. iOS 27의
BackgroundShortcutRunner와 첫 빌드가 겹칠 때 큰 부하가 났으며 사용 중인 시뮬레이터만 재부팅했다.

백엔드는 `docker-compose.e2e.yml`과 `-p template-typescript-expo-e2e`다. D7-R21에 따라 무시된 하네스 사본에서
native-backend의 start/stop/api-log 호출만 Docker adapter로 바꿨고 플로·로그·가드·요청 수·cleanup은 유지했다.
CI는 기존 `native-backend.sh`를 쓴다. Mac의 기존 Docker 컨테이너는 0개였고 다른 프로젝트는 조작하지 않았다.
시뮬레이터의 원래 OS 언어는 ko-KR/ko_KR이었다. 영어 시스템 딥링크 창을 다루는 플로와 맞추려고 en/en_US로 바꾸고
원래 값을 저장했다. 앱 로캘 플로의 AppleLanguages와는 별개다.

**서명의 입증된 원인.** 실행 4의 받은 앱과 R18 그대로의 새 로컬 앱 모두 Maestro 전의 직접 simctl launch에서 실패했다.
07:41:57 KST의 host amfid는 `The file is adhoc signed but contains restricted entitlements`(-424),
`Unable to retrieve certificate chain`(-427)을 남겼다. R18은 iOS application-identifier/Keychain 그룹을 호스트의
코드 서명에 넣었다. Simulator의 권한 공간은 Xcode가 연결하는 Mach-O의 `__TEXT,__entitlements`·`__ents_der`다.
`CODE_SIGNING_ALLOWED=NO`는 이 권한 생성을 끄며, 사후 codesign은 그 대체가 아니었다.

`ios.sh`는 이제 `CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=- DEVELOPMENT_TEAM=`로 Xcode의
`Sign to Run Locally`를 쓴다. 실제 생성 XML에는 `34R3YQTSH8.com.example.templateexpo.e2e`가 있었고 호스트 서명
plist는 빈 dict였다. Keychain 그룹을 생략하면 이 application-identifier가 기본 그룹이다. 받은 앱의 검사도
무결성·내장 XML 앱 식별자·DER section 존재/범위·호스트 제한 권한 부재로 고쳤다. 새 검사 시험은 R18에서 3실패,
고침 뒤 11통과였으며 Xcode 27의 실제 binary도 검사를 통과했다. 이것만으로 launch/Keychain 성공이라 쓰지 않는다.

**Xcode 27의 별도 원인과 D7-R22b.** 서명 검사를 지난 로컬 앱은 UIKit의
`UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`에서 SIGTRAP으로 종료됐다. JS 전의
`UIScene life cycle is required for apps built with this SDK`가 원문이다. 기존 의존성에 이미 있는
`expo-build-properties`의 `ios.enableSceneSupport: true`를 모든 변형에 켰다. 이는
[Expo SDK 57의 공식 opt-in](https://github.com/expo/fyi/blob/main/ios-scene-lifecycle.md)이며 추가 의존성·사용자
정의 native plugin은 없다. native fingerprint가 바뀐다. 변형 introspect 검사에 scene manifest를 더해 제거된 manifest는
실패함을 확인했다(새 시험 1실패 → 39시험 통과). CI의 두 iOS 잡은 Xcode 26.6을 명시해 판을 고정한다.

**로컬 하네스.** Maestro가 iOS UDID를 받아도 Android 기기를 먼저 열거하다 멈췄다. jstack의 main은
`DeviceService.listAndroidDevices → AdbServer.readString`에서 기다렸다. `run-ios.sh`의 `--platform ios`가 이를
피한다. 사용자의 adb 서버·Android 기기는 멈추지 않았다. 최초 진단 앱 실행은 한국어 OS 확인창에 막혔고,
영어 OS 설정 뒤 실행 4의 진단 사본(호스트 제한 권한만 제거)의 FastAPI examples-empty-notfound는 통과했다.
R20 로그에 AppState active, 404 뒤 query success/idle·observer 1, 화면 not-found를 확인했다. 이는 기존 미확정 실패의
재현이나 원인 해결 증거가 아니며 같은 iOS 26.5 runtime을 추가로 받는다(D7-R22 승인).

07:57 KST의 정적 게이트 `[1]–[11]`은 모두 통과했다. 단위 시험은 **90파일/1847시험**, Gate 8은 네 변형과
프로젝트 ID 유무의 여덟 설정에서 scene manifest까지 통과했다. typecheck·lint·format·secrets·인용·출처,
expo-doctor·양 플랫폼 clear export·Compose 정적 검증과 변경 셸의 bash 3.2 구문/ShellCheck 0.11.0,
workflow의 actionlint 1.7.12도 통과했다.

scene을 켠 새 앱의 iOS 27 첫 표적 실행에서 `examples-empty-notfound`는 통과했다. `auth-links`는 보호 경로에서
로그인·가입 링크 왕복까지 이동했지만 가입의 password 검증 422로 실패했다. `register-restore-logout`도 같은 422,
`examples-create`는 로그인 뒤 화면 단언에서 실패했다. Maestro는 비밀번호 입력 완료를 보고했으나 실패 hierarchy의
password 값은 bullet 하나였다. 입력 문제의 원인과 SecureStore의 실제 저장·복원은 이 시점에 미확인이다.
기존 CI의 홈 유지와 404 뒤 skeleton을 이 실패로 대체하거나 고쳤다고 쓰지 않는다.

**AutoFill 원인과 SecureStore 복원.** 같은 새 앱을 iOS 26.5(23F73)에 설치해도 가입 422가 재현됐다.
본문을 저장하지 않는 로컬 진단 proxy에서 password 길이는 **1**이었고 시험 값과 달랐다. 기기 로그에는
`SFAutoFillStrongPasswordContainerInputView`가 있었다. 생성 흐름은 로그인 POST 200/1회였으며 실패 화면은
`Save Password?` 시스템 창이 로그인된 홈을 덮은 모습이었다. 서명이 없는 이전 앱에서는 이 창을 관측하지 않았다.

[Appium의 Simulator 구현](https://github.com/appium/appium-ios-simulator/blob/master/lib/extensions/settings.ts)의
`setAutoFillPasswords`와 같은 `com.apple.WebUI`의 `AutoFillPasswords=0`을 적용하자 동일 입력이 **20글자/시험 값 일치**,
가입 201·로그인 200이 됐다. 앱이나 플로는 바꾸지 않은 대조다. 컨트롤러도 하네스 환경 설정을 승인했다.
`run-ios.sh`는 선택한 시뮬레이터에만 이를 적용하고 읽어 검증하며 EXIT에서 원래 0/1 또는 키 없음 상태를 복원한다.
설정이 적용되지 않으면 실패한다. bash 경계 시험은 원래 상태 셋과 쓰기 무시를 검사한다(기존 초기화 시험 포함 5통과).

08:08 KST 새 앱+iOS 26.5+NestJS Docker의 `register-restore-logout`은 가입·stop/launch 뒤 로그인 복원·로그아웃·
stop/launch 뒤 비로그인·다른 계정 가입·로그아웃까지 통과했고 JS 가드도 통과했다. PID는 9147→9268→9901로 바뀌었다.
이는 SecureStore의 실제 쓰기/읽기/삭제 증거다. 길이 관측용 proxy는 전체 실행 전에 종료했으며 전체 실행은 원래 HTTP
경로를 쓴다. 기존 실행 4 앱의 제한된 호스트 권한만 뺀 진단 사본은 같은 iOS 26.5의 NestJS auth-links UI를 통과했지만
`SecItemAdd`의 필수 entitlement 부재 오류를 남겼다. 원래 홈 유지 실패는 이 대조에서도 재현되지 않았다.

**첫 전체 실행과 D7-R26.** 08:09에 시작한 NestJS 전체 실행은 iOS **27.0**이었다. 처음 붙인 26.5 기기 이름이
`D7`로 시작해 하네스의 iPhone 후보에서 빠졌고, 로그·Maestro UDID로 27.0임을 확인했다. 직접 UDID를 준 위의
비교 시험은 26.5가 맞다. 유휴 26.5는 종료하고 `iPhone 17 D7 (26.5)`로 이름을 고쳤다.
27.0에서도 auth-links·로그인 계약 흐름·examples-create는 AutoFill 설정 뒤 통과했고 로그인 뒤 시스템 저장 창은 없었다.

NestJS `examples-browse`는 Charlie 태그의 고정 순서 단언에서 실패했다. 실패 hierarchy와 동일 목록 URL의 응답은
모두 **둘, 하나**였으며, 같은 행을 `include=tags`만으로 조회한 응답은 **하나, 둘**이었다. 증거는 NestJS browse response와
Charlie 단독 response JSON 및 browse의 실패 hierarchy다. 앱은 응답 순서를 그대로 표시했다.
[JSON:API 1.1의 linkage 배열 순서 설명](https://jsonapi.org/format/#document-resource-object-linkage)도 두 멤버의
고정 정렬을 보장하지 않는다. 컨트롤러 D7-R26에 따라 전체 라벨의 두 정확한 순열만 허용했다. 각 태그 한 번, 누락·중복·
추가 멤버 거절은 유지하며 와일드카드는 없다. 앱·Android·폼의 선택 순서·응답 순서 보존 시험은 바꾸지 않았다.
추가 시험은 기존 단언에서 실패했고, 양 순열 및 누락/중복/추가 멤버 거절을 검증한다.

**결정 43 중간 실측.** 27.0/iPhone 17의 NestJS 생성 플로에서 로그인 제출 bounds는 `[24,364][378,404]`,
두 누름의 좌표는 논리 점 **(201,384)**였다(08:15:19.179 KST). `d7-login-before`와 `d7-login-after` 스크린샷에서
이동 뒤 같은 좌표는 홈 `build-info-card`의 앱 버전·변형 행 사이였다. e2e에서 OTA는 꺼져 있고 카드의 그 자리는
동작이 없다. 플로는 이후 생성과 뒤로 가기까지 통과했다. NestJS의 접근 로그는 기존 정책상 수를 세지 않으므로
로그인 요청 1회 단언은 FastAPI 실행에서 별도로 확인한다.

08:30 KST NestJS+iOS 27 전체 실행이 끝났다. 실패는 수정 전 `examples-browse` 한 건뿐이었고,
`register-restore-logout`의 쓰기·재시작 후 복원·삭제 후 재시작도 가드와 함께 통과했다. EXIT 뒤 AutoFill 설정은
원래의 키 없음 상태로 복원됐다. R26 수정 뒤의 전체 정적 검사는 **90파일/1852시험**이며 typecheck·lint·format·
secrets·인용·출처, 변경 셸 bash 3.2/ShellCheck 0.11.0, actionlint 1.7.12가 통과했다.
컨트롤러 지시에 따라 R26의 기기 검증 뒤 실행 5를 먼저 시작하고 FastAPI·Rails의 로컬 전체 실행을 병행한다.
실행 3의 NestJS 홈 유지와 FastAPI skeleton 유지 원인은 아직 입증되지 않았고 새 CI의 R20 상태 기록으로도 확인한다.

08:32 KST R26 수정 후 같은 iOS 27+NestJS에서 `E2E_FLOW=examples-browse` 하네스 전체가 exit 0이었다.
두 태그의 정확한 멤버 검사와 나머지 목록·상세·필터·정렬 단언, JS 가드가 통과했다.

08:32 KST `4d2d099`를 push해 실행 5
[36941340879](https://github.com/builder-shin/template-typescript-expo/actions/runs/36941340879)를 시작했다.
FastAPI 로컬 전체와 멈춘 서버 검사를 병행한다. 08:39까지 auth-links·계약 두 흐름·browse·create가 통과했고,
생성의 요청 수는 **회전 1·POST 1·로그인 1**이었다. 결정 43의 FastAPI 스크린샷도 둘째 누름 뒤 시스템 저장 창 없이
홈의 같은 빌드 정보 카드를 보여 주며 목적 좌표는 (201,384)였다. 이로써 NestJS의 좌표 대조와 FastAPI의 실제
요청 수 한 번을 함께 확인했다. 실행 5의 최종 아홉 칸은 아직 대기 중이다.

08:53 KST FastAPI+iOS 27 전체는 **20개 흐름과 request-stall 모두 exit 0**이었다. Android 전용 두 흐름은 선언대로
제외했다. 두 404 상세는 R20의 pending/fetching→success/idle, 관찰자 1과 목적 not-found 화면을 확인했다.
헤더/본문 정지 요청은 각각 23:52:39.825Z/23:52:55.141Z에 서버에 닿았고 REQUEST_TIMEOUT 가드도 통과했다.

**Task 4+4b 리뷰 보완.** 원래 AutoFill 읽기 실패를 키 없음으로 오인하면 기존 0/1을 지울 수 있었다(I1).
두 값에서 회귀 시험이 실패함을 확인하고, 성공한 `defaults export` 사전을 해석해 부재와 값을 가르게 했다.
실제 iOS 27의 없는 domain export도 exit 0/빈 dict였으며 명령/변환 오류는 쓰기 전에 멈춘다. 준비/복원과 실제
cleanup EXIT trap의 후속 실패를 포함한 10시험이 통과했고, 기기에서도 absent→0→의도한 exit 23→absent를 확인했다.

I2는 시스템 Open 예외 파일 전체를 검사에서 빼 추가/중복 누름과 블록 밖 단언을 놓쳤다(회귀 3실패).
이제 주석·빈 줄·줄끝 공백만 뺀 명령 구조 전체를 고정하고 직접 selector id 없는 누름을 저장소 전체 정확히 하나로
제한한다. 넓어진 제목과 다른 파일의 속성 순서/하위 id 우회도 거절한다. 흐름 규칙 17시험이 통과했다.
M1은 스펙의 Android splash CI 결과를 실행 3의 세 셀 통과/timeout 0건으로 바로잡고 로컬 미재현·fade 손실은 유지했다.
08:52 보완 뒤 필수 정적 검사와 **90파일/1863시험**, bash 3.2 구문/금지 구문/ShellCheck 0.11.0이 통과했다.
코디네이터 지시로 실행 5가 끝나기 전에는 보완 커밋을 push하지 않는다.

**콜드 링크 추가 재현.** R22b의 콜드 시작 대조에서 새 앱+iOS 27은 종료 뒤 `/examples/new`를 열면 로그인 대신
홈에 머물렀다. R20은 새 PID의 `/examples/new`→`/`를 남겼다. 공개 없는 상세의 콜드 링크는
`/examples/<id>`→`/`→`/examples/<id>` 뒤 404/not-found·가드가 통과했다. 받은 **실행 3 원본 앱**(scene/R20 없음)도
같은 27의 보호 콜드 링크에서 실패했으므로 scene 변경만의 회귀는 아니다. 기존 실행 3의 warm 실패와 같은 원인이라고
확정하지 않는다. 설치본 Redirect는 내비게이터 준비를 기다리며 중첩 Stack을 거두면 홈 앵커가 보일 수 있다.
첫 로그인 목적지를 셸 해제 때까지 유지하는 수정 후보와 `cold-links` 회귀 흐름을 만들었고 실제 재검증 중이다.

D7-R29로 승인된 수정은 `lib/auth/guard-latch.ts`의 `decidePendingLogin`이 첫 목적지를 유지하고 앱 셸은
마운트 동안의 상태와 배선만 가진다. signedIn/restoring이면 이동하지 않으며 기존 로그아웃 래치 시험은 그대로다.
설치본 Expo Router의 `build/link/Redirect.js:37`은 replace를 focus 효과에서 부르고, `build/useFocusEffect.js:95`는
loaded navigation이 없으면 기다린다(`build/link/useLoadedNavigation.js:42–45`). 중첩 Stack을 거두면
`build/react-navigation/core/useNavigationBuilder.js:495–500`이 navigator state를 비우며,
`build/global-state/getRouteInfoFromState.js:92–97`은 자식이 사라진 `(app)`의 경로를 `/`로 만든다.
앵커 `index`는 `build/getRoutesCore.js:655`에서 initial route가 된다. 이때 매 렌더의 보호 판정만 따르면 첫
로그인 목적지가 사라져 Redirect가 취소됐다. 설치본의 실제 라우트 정보 함수를 이용한 상태 경계 시험도 추가했다.

09:11 iOS 27/FastAPI의 수정 앱에서 새 `cold-links`는 UI·JS 가드까지 통과했다. R20은 보호 콜드 시작에서
`/examples/new`→`/`→`/login`→(로그인 뒤)`/examples/new`를 남겼다. 공개 콜드 링크도 404→success/idle/observer1과
not-found에 도착했다. 기존 `auth-links`도 통과했다. 새 플로는 두 플랫폼에서 로그인 후 원래 보호 화면 도착까지
검사한다. 현재 수는 **Android 23 / iOS 21**이며 앞선 실행들의 22/20은 그 시점의 실제 수다.

같은 배치 도중 호스트 부하가 약 281로 올라 사용 중인 27 시뮬레이터와 하네스를 중단했다. 최종 로그를 보면
cold-links는 이미 끝났고 다음 guard-return에서 중단됐으므로 배치 전체 통과로 세지 않는다. 호스트의 상위 CPU는
mds/mdworker였고 BackgroundShortcutRunner는 관측되지 않았다. 다른 서비스는 건드리지 않았으며 Docker cleanup과
AutoFill의 원래 키 없음 복원을 확인했다. 두 시뮬레이터를 끈 뒤 부하가 내려가는 것을 보고 나머지 검증을 이어간다.

09:18 새로 지운 iOS 26.5 기기에서 **실행 3 원본 앱**과 NestJS의 warm `auth-links`를 대조했다. 최초 시스템
Open 창의 제목 확인·Open 누름·제목 사라짐을 실제로 거친 뒤 로그인/가입 링크 왕복과 보호 화면, 홈 복귀까지 UI가
통과했다. 원래 홈 유지 실패는 재현되지 않았으며 unsigned 앱의 예상한 Keychain missing entitlement 오류는
남았다. 따라서 이 원본 실행을 JS 가드까지 통과했다고 세지 않는다. 같은 26.5에서 I1의 실제 native 설정도
absent→0→의도한 exit 23→absent 복원을 확인했다. 마지막 라우트 상태 경계 시험을 포함한 필수 정적 검사와
**90파일/1869시험**, bash 3.2 금지 구문 검사·ShellCheck 0.11.0·actionlint 1.7.12가 모두 통과했다.

09:24 iOS 26.5의 전후 대조도 완료했다. 수정 전 CI5 앱(SDK 26/scene/정상 서명)은 PID64288의
`/examples/new`→`/` 뒤 login-screen 단언이 실패했다. 최종 수정 앱은 PID69280의
`/examples/new`→`/`→`/login`→인증 뒤 `/examples/new`로 도착했고 공개 cold 404도 success/idle/observer1이었다.
NestJS에서 `auth-links`, `cold-links`, `guard-return`, `logout-from-protected`, `register-restore-logout`의
**다섯 흐름과 로그 가드가 모두 exit 0**이었다. Docker 정리와 AutoFill 키 없음 복원도 확인했다.

09:25 같은 26.5 기기/FastAPI에서 받은 **실행 3 원본 앱**의 `examples-empty-notfound`도 전체 UI와 404 허용
로그 가드가 통과했다. 빈 목록·필터 해제, 없는 UUID와 잘못된 UUID의 HTTP 404/not-found, 없는 앱 경로까지 확인했다.
원래 CI의 404 뒤 skeleton 정체는 이 대조에서도 재현되지 않았다. 원본에는 R20이 없으므로 응답 뒤 관찰자 상태를
소급해 단정하지 않는다. 그 뒤 26.5를 끄고 27의 중단됐던 세 인증 흐름만 별도 실행한다.

09:26 iOS 27만 다시 부팅하자 빌드 없이도 host load 130→167, simulator의 Rs 프로세스 133개가 관측됐다.
사용 중인 하네스·Java만 TERM하고 AutoFill 키 없음 복원·Docker 정리를 확인한 뒤 그 simulator를 종료했다.
**D7-R30은 이 작업에서 27을 다시 부팅하지 않고 나머지를 26.5에서 마치도록 했다.** 최종 R29 앱의 27
`guard-return`, `logout-from-protected`, `register-restore-logout`은 자원 문제로 **미실행(NOT RUN)**이며
통과로 세지 않는다. 앞서 27의 cold/auth 성공과 26.5의 다섯 흐름 전체 성공은 각각의 증거 범위로 남긴다.
27의 원래 언어 ko-KR·로캘 ko_KR은 종료된 기기의 plist에서 복원하고 다시 읽어 확인했다. 기기는 계속 꺼져 있다.

09:30 Rails 이미지(main `231576eeac21c583b2cc28532248223351f2c92f`)는 정상 빌드됐지만 26.5에서도
load 92→114, Rs 프로세스 68개를 관측했다. CPU idle 약 42%, 메모리 46/48 GB(compressor 약 9.6 GB),
host mediaanalysisd 약 300%였다. Rails `auth-links`는 UI·로그 가드까지 통과했지만 다음 `cold-links` 도중
소유 runner·Java를 중단하고 AutoFill 키 없음·Docker 정리를 확인한 뒤 26.5도 종료했다.
**Rails 전체는 미완료**이며 통과로 세지 않는다. 다른 host 서비스에는 손대지 않았다.

D7-R31은 host 서비스와 메모리 부하 때문에 로컬 실행을 여기서 종료하고, Rails 전체와 Android의 새 cold-links를
통합 CI에서 검증하도록 승인했다. Rails cold-links는 단언 실패가 아니라 작업자가 중단한 실행이다. I1/I2/M1과
R29의 판단·배선·시험·플로·현재 수·문서를 함께 커밋하되 실행 5가 끝날 때까지 push하지 않는다.

**실행 5 Rails의 warm 링크 지연.** iOS Rails는 `auth-links` 한 흐름만 실패했고 나머지 19개(404·SecureStore
재시작 복원 포함)는 통과했다. commands.json의 Open 누름은 23:59:07.745Z, 제목 사라짐 확인 끝은 12.262Z,
login-screen 단언은 12.264–28.108Z였으며 실패 화면은 홈이다. R20은 active 복귀 10.553Z 뒤에
`/examples/new`를 **34.790Z**, `/login`을 35.694Z에 처음 기록했다. 이는 단언이 끝난 뒤의 관측이며
R29의 `/examples/new`→`/` 목적지 손실과 다르다. 이 로그만으로 native URL 도착과 JS 처리 중 어느 경계에서
지연됐는지는 확정하지 않는다. CoreSimulatorBridge의 Opening URL은 05.471Z였고 Maestro의 native 로그는
29.5Z에 끝났다. 이후 같은 스킴 링크는 Open 조건을 건너뛰며 통과했다.

상류 [Maestro #2610](https://github.com/mobile-dev-inc/Maestro/issues/2610)에는 GHA의 첫 Open 승인 뒤 이동 실패와
로컬 성공을 보인 Expo 재현이 있으나 원인은 해결되지 않았다. [#940의 댓글](https://github.com/mobile-dev-inc/Maestro/issues/940#issuecomment-3587472809)은
대상 simulator의 schemeapproval 사전 지정을 제안한다. 종료된 로컬 27 기기의 실제 plist에도
`com.apple.CoreSimulator.CoreSimulatorBridge-->templateexpo-e2e` → `com.example.templateexpo.e2e`가 있었다.
이는 하네스 후보의 근거이며 우리 실패의 직접 전후 입증은 아니다. 사전승인·readback·원복과 새 로컬 실측 면제는
코디네이터 판단을 요청했으며 아직 적용하지 않았다.

D7-R32가 이 한 키의 사전승인·readback·EXIT 원복과 R31의 새 simulator 실측 면제를 승인했다.
[Expo #47614](https://github.com/expo/expo/pull/47614)도 simulator 안의 defaults로 같은 요청자→스킴 승인을
준비하고 clearState 뒤에도 유지함을 확인했다. 이 저장소는 R16의 정확한 조건·Open 누름·부재 단언을 남긴다.
`run-ios.sh`의 성공한 export만 부재/원래 값을 가르며 읽기·해석·쓰기·readback 실패를 전달한다. cleanup은
승인 복원이 실패해도 AutoFill 복원을 시도한다. 앱 동작·타임아웃·재시도는 바꾸지 않는다. 최초 경계 시험은
준비 함수/배선이 없는 상태에서 13실패했고 구현 뒤 기존 하네스·흐름 규칙과 함께 40시험이 통과했다.
읽기 JSON/값 오류까지 추가한 승인 경계 15시험을 포함해 09:54 필수 정적 검사와 **91파일/1884시험**이
통과했다. bash -n·bash 3.2 금지 구문 검사·ShellCheck 0.11.0·diff 검사도 통과했다. 종료된 27 기기의 실제
승인 키/값을 plutil로 다시 읽어 확인했으며 새 기기는 부팅하지 않았다. 내부 지연 원인을 해결했다고 주장하지
않으며 통합 CI가 실제 검증이다.

**실행 5 최종 결과와 R33.** 실행 5는 최종 failure, checks·두 빌드·Android 세 셀은 success다.
iOS Rails/NestJS는 각각 auth-links만 실패(나머지19 통과), FastAPI는 auth-links와 contract-lab-signed-in 실패
(나머지18 통과)였다. 세 iOS 셀 모두 examples-empty-notfound와 register-restore-logout은 통과했다.

NestJS는 warm 링크·로그인/가입 왕복에 성공한 뒤 00:01:54.507Z의 가입422/VALIDATION_ERROR에서 멈췄다.
실패 AX 계층은 전체 이메일71글자와 비밀번호20bullets, password-error를 보였다. native 입력 기록은20글자지만
CFNetwork의 전송 본문은140bytes였다. 같은 문서·이메일·20글자라면156bytes,4글자라면140bytes다. 본문 원문이나
JS 제출 길이는 관측하지 않았으므로 실제 비밀번호를4글자라고 확정하지 않는다. 00:01:22–29Z에
AutomaticStrongPassword 준비와 signalAutofillUIBringup이 있었다. AutoFill 설정을 첫 부팅 뒤에 쓴 상태여서
이미 시작한 시스템 UI가 옛 설정을 썼을 가능성을 R33의 재부팅 경계로 검증한다.

FastAPI auth-links는 submit tap 00:00:30.998–32.942Z 뒤 native request50.158Z(156bytes),
register20156.819Z, login20057.184Z, route=/examples/new57.486Z였다. 목적 화면 단언은55.439Z에 끝났고
실패 AX는 register-screen·submit busy·전체 이메일·20bullets였다. 첫 요청 전 약17초 공백은 기존 로그로
JS/네이티브 경계를 확정할 수 없다. contract-lab-signed-in은 native login request00:09:21.733Z(173bytes),
응답0bytes로14.853초 뒤 취소(-999),36.801Z에 앱의15초 REQUEST_TIMEOUT이었다. 백엔드 접근 로그에도 이
로그인의 응답은 없었다. 시간이나 재시도를 늘려 통과 처리하지 않는다.

같은 CI native 로그의 apsd는 첫 부팅12분 이후에도 분당 약73–80k줄을 남겼으며 Poster/widget·chronod·
identityservicesd 등의 활동이 겹쳤다. 코디네이터는 이를 러너의 자원 경쟁으로 판단하고 **D7-R33**을 승인했다.
[yeetd](https://github.com/insidegui/yeetd)는 CPU를 쓰는 simulator의 Poster/widget 프로세스를 다루며,
[simslim](https://github.com/MobAI-App/simslim)은 선택 기기의 launchd override와 재부팅 후 검증을 제공한다.
이 저장소는 도구를 설치하지 않고 서비스 분류만 참고했다. host 서비스와 Keychain/securityd·URL opening·
SpringBoard·XCTest·키보드·네트워크·설정·로그 서비스는 유지한다.

R33 하네스는 고른 기기와 같은 runtime/type의 **새 전용 기기**를 만들어 실제 launchctl list에 등록된 허용
서비스만 simctl spawn 안에서 disable한다. 사용하던 기기는 정보만 읽는다. 모든 disable·AutoFill·scheme 승인과
OS 영어/키보드 안내 설정을 쓴 뒤 **한 번** 재부팅하고 각 값을 다시 읽는다. 목록/적용/readback 오류는 실패이며
성공·후속 실패·TERM 모두 EXIT에서 자기 기기를 종료·삭제한다. 전후 기록은 서비스 목록과 선택 launchd_sim
자손의 프로세스 수·RSS KiB·CPU 합계다. RSS는 압축 메모리를 포함한 phys_footprint와 다르다. host 전체 프로세스
인자는 파일이나 로그에 저장하지 않는다.

추가 R20 관측은 e2e에서만 credentials change/submit의 길이·순번·시각, HTTP 시작/결과 시각을 정보로 남긴다.
입력 값·본문·토큰은 남기지 않으며 요청의 쿼리 문자열도 버린다. 앱 동작·타임아웃·재시도·목적 화면 단언은 같다.
R33의 실제 자원 감소와 실패 해소는 다음 로컬/CI 실측 결과로 판정한다.

R33의 첫 기기 준비는 실제96개 override와 AutoFill/scheme의 재부팅 후 유지까지 확인했으나,
NSGlobalDomain 전체 plist를 JSON으로 바꾸는 언어 검사에서 Invalid object로 멈췄다. 앱/흐름은 시작 전이었고
EXIT가 전용 기기를 삭제했다. 필요한 AppleLanguages 배열만 `plutil -extract`로 읽도록 고쳤으며 전체 domain
변환을 거절하는 가짜 경계로 검증했다. 10:15 필수 정적 검사와 **95파일/1902시험**이 모두 통과했다.

수정된 새 iOS26.5 기기에서는 모든 설정 readback이 통과했다. 재부팅 전후 launchd_sim 자손은 **227→92개**,
RSS 합계는 **24,942,032→8,146,336 KiB**, CPU 합계는 **886.2→166.4%**였다. 이는 부팅 직후의 스냅샷이며
RSS의 공유 매핑을 포함한다. 96개 선택 서비스는 재부팅 후 모두 disabled이고 실행 PID가 없었다.
PosterBoard/chronod는 없어졌지만 동적 UIKitApplication label의 WidgetRenderer-Default 하나는 남았다
(관측 시 CPU0%, RSS232,016KiB). 전체 위젯 프로세스를 없앴다고 주장하지 않는다. 호스트 평균 부하는 첫 준비의
stock 부팅 약97까지 올랐다가 종료 후 내려갔고, 수정 실행의 재부팅 후29→13으로 내려왔다.

10:18 NestJS `auth-links`는 UI·로그 가드까지 통과했다. R33 진단에서 password change 길이20 뒤 제출 길이20,
같은1790903913152ms에 HTTP 시작, 가입201(73ms)→로그인200(37ms)→보호 화면을 확인했다. 첫 OS Open 조건은
사전승인으로 건너뛰었다. 이어지는 cold-links/세션복원 결과와 통합 CI 결과는 아래에 남긴다.

**10:21 R33 로컬 최종 결과:** 새 iOS26.5/NestJS에서 `auth-links`, `cold-links`,
`register-restore-logout` 세 흐름의 UI·로그 가드가 모두 통과했고 전체 exit0이었다. 보호 cold 링크의 로그인 후
원래 화면, 공개 cold404, SecureStore 저장→프로세스 재시작 복원→로그아웃 삭제→다른 계정 가입을 포함한다.
R16의 정확한 Open 조건은 세 흐름에서 모두 건너뛰었다. 전용 기기의 삭제, booted simulator0,
소유 compose project 컨테이너0을 확인했다. 사용자 기존 기기는 바꾸지 않았고 추가 simulator 실행은 하지 않는다.
증거는 `.maestro-output/mac-repro/r33-nestjs-ios26/`, 같은 이름의 `.log`, `r33-final-*.log`, `r33-build.log`다.
최종 통합 CI 전까지 전체 아홉 셀 성공으로 세지 않는다. 새 관측은 로컬에서 값 없이 입력20/제출20과
즉시 시작한 요청을 확인했으며, CI5의 내부 지연 원인 전체가 입증됐다는 뜻은 아니다.

#### 11:26 최종 통합 CI — 아홉 셀 성공

Task4b의 마지막 push는 `52a17429057e3edc8034aba3f46d2d1ecf9efedb`다. 코디네이터가 Task5의
`151d5ff`·`53e3134`를 통합해 `feat/d7-ci`의 최종 코드 HEAD는
`53e31343f1826bfdff70bae1e6e4719f5aaa6df3`가 됐다. 실행6
[36950606213](https://github.com/builder-shin/template-typescript-expo/actions/runs/36950606213)은 이 통합으로
취소됐으며 재실행하지 않았다. 승인된 대체 통합 실행
[36950704982](https://github.com/builder-shin/template-typescript-expo/actions/runs/36950704982)은
2026-10-02 11:25:34 KST에 마지막 셀까지 **success**, 11:26 `gh run watch --exit-status`도 exit0이었다.

| 셀 | 결과 | 확인 범위 | 잡 소요 시간 |
| --- | --- | --- | --- |
| [build-ios (e2e .app)](https://github.com/builder-shin/template-typescript-expo/actions/runs/36950704982/job/110662927577) | success | 정식 build/assert-app | 15분 43초 |
| [checks (게이트 [1]–[11])](https://github.com/builder-shin/template-typescript-expo/actions/runs/36950704982/job/110662927741) | success | 95파일/1902시험 및 정적 게이트 | 2분 18초 |
| [build-android (e2e APK)](https://github.com/builder-shin/template-typescript-expo/actions/runs/36950704982/job/110662927778) | success | e2e APK 빌드 | 26분 37초 |
| [e2e-ios (fastapi)](https://github.com/builder-shin/template-typescript-expo/actions/runs/36950704982/job/110666786411) | success | 21개 흐름·로그 가드·요청 수 검사 | 41분 34초 |
| [e2e-ios (nestjs)](https://github.com/builder-shin/template-typescript-expo/actions/runs/36950704982/job/110666786423) | success | 21개 흐름·로그 가드 | 45분 30초 |
| [e2e-ios (rails)](https://github.com/builder-shin/template-typescript-expo/actions/runs/36950704982/job/110666786462) | success | 21개 흐름·로그 가드 | 40분 8초 |
| [e2e-android (fastapi)](https://github.com/builder-shin/template-typescript-expo/actions/runs/36950704982/job/110669367654) | success | 23개 흐름·계약 거울 94시험 | 28분 33초 |
| [e2e-android (nestjs)](https://github.com/builder-shin/template-typescript-expo/actions/runs/36950704982/job/110669367704) | success | 23개 흐름·계약 거울 94시험 | 31분 30초 |
| [e2e-android (rails)](https://github.com/builder-shin/template-typescript-expo/actions/runs/36950704982/job/110669367743) | success | 23개 흐름·계약 거울 94시험 | 32분 55초 |

세 iOS 셀은 native backend에서 각21흐름, Android는 각23흐름을 통과했다. 기존 iOS 제외 흐름인
`examples-delete-offline`·`examples-offline-refetch` 두 개는 그대로이며 새 제외는 없다. CI checks는
95파일/1902시험, Android의 계약 거울은 세 백엔드 각각94시험이었다. 로컬 R33 기기 증명은52a1742에서
수행했고 통합 HEAD의 두 runtime 파일(form/write)은 Task5의 주석만 달라진 것을 대조했다.

R33의 CI 재부팅 전후 측정은 다음과 같다. 같은 셀의 부팅 직후 스냅샷이며 RSS는 공유 매핑을 포함하므로
실제 물리 메모리 사용량과 같지 않다. 세 셀 모두 선택한96개 서비스가 disabled이고 실행 PID가 없었으며
AutoFill0·scheme approval·OS 언어·키보드 설정의 재부팅 뒤 readback을 통과했다.

| CI iOS backend | 프로세스 수 | RSS 합계(KiB) | CPU 합계(%) |
| --- | --- | --- | --- |
| FastAPI | 223 → 89 | 19,552,384 → 7,632,128 | 211.8 → 50.9 |
| NestJS | 189 → 102 | 15,690,864 → 8,471,376 | 242.5 → 34.0 |
| Rails | 218 → 101 | 19,685,696 → 8,368,000 | 97.3 → 50.2 |

`auth-links`에서 세 백엔드 모두 마지막 password 변경 길이20(seq91)→제출 길이20(seq92)을 기록했다.
제출→HTTP 시작은 FastAPI1ms, NestJS0ms, Rails0ms였다. 가입201/로그인200의 소요 시간은 각각
FastAPI721/254ms, NestJS459/171ms, Rails1192/265ms였고 모두 보호 화면에 도착했다.
CI5에서 timeout이던 FastAPI `contract-lab-signed-in` 로그인도 제출과 같은 ms에 시작해431ms 뒤200이었다.
값·본문·토큰은 이 관측에 포함하지 않는다.

R32의 첫 OS Open 조건은 세 `auth-links`에서 모두 SKIPPED였다. R16의 정확한 조건/버튼/부재 단언은 남아
있다. R29의 `cold-links`는 세 셀 모두 `/examples/new`→`/`→`/login` 뒤 인증하면 원래 화면으로 복원됐고,
공개 cold404도 `success/idle`, observer1과 not-found UI에 도착했다. `examples-empty-notfound`의 두404도
세 셀에서 같은 상태 전환과 UI 단언을 통과했다. `register-restore-logout`은 세 셀 모두 실제 SecureStore
쓰기→프로세스 재시작 읽기→로그아웃 삭제→다른 계정 가입을 통과했다.

이 실행은 전체 수정의 CI 통과를 입증한다. run3 warm 링크/404 skeleton의 미재현 원인이나 CI5의 내부 지연
전체를 특정 원인으로 소급 확정하지 않는다. 재시도0, 기존 timeout/목적 화면/요청 수 가드를 유지했다.
결정43의 둘째 로그인 tap은 위 Mac 실측대로 비대화형 홈 build-info 영역이었다.

증거: `/tmp/d7-integrated/e2e-ios-{fastapi,nestjs,rails}`의 각 flow `commands.json`·`device.ndjson` 및
simulator 전후 파일, `.maestro-output/mac-repro/integrated-*-job.log`, `integrated-ios-summary.log`,
`integrated-detail.log`, `ci-integrated-final.json`, `ci-integrated-watch.log`.
첫 초록 뒤 코디네이터가 최종 검토 수정2599bf2와 실행36955635199를 보냈다. 문서는 docs/**에만 수정하고,
그 실행 완료 뒤 아홉 셀 성공이면 문서 커밋을 push하며 실패면 먼저 보고한다.


첫 초록53e3134의 Android 빌드도 같은 두 단계 레시피였다. 두 번째 `createReleaseUpdatesResources UP-TO-DATE`는
2026-10-02 01:40:30.3738557Z, 두 번째 Gradle은22분1초, 잡 전체는26분37초였다. APK 설정 단언은 통과했고
실제 최대 RSS/Kotlin JVM 메모리는 별도로 계측하지 않았으므로 관측값으로 쓰지 않는다. 원본은
`.maestro-output/mac-repro/integrated-build-android-job.log`다.

**첫 초록 실행의 Step8 기기 증거 보완.** 앞의 실행4 한계는 당시 기록이다. 통합 실행53e3134에서는 iOS 셋의
`home-build-info`·`examples-browse`·로캘 셋(`login-error-en/ko`, `examples-invalid-filter-en`)·쓰기 넷의
화면 단언과 로그 가드가 모두 통과했다. FastAPI home-build-info의 `d7-build-info.png`를 직접 확인했으며
앱0.1.0·변형e2e·OTA꺼짐·runtime version/채널/업데이트ID없음이었다. BackButton·sheet-backdrop·키체인 정리는
해당 공통 subflow/하네스 경계를 그대로 사용했다. 세 iOS artifact의 변환 device.log에서 앱 W/E 및 e2e-warn은
각0줄(FastAPI22개 로그, NestJS/Rails각21개)이었으며 JS 시작을 확인한 guard가 모두 통과했다.

FastAPI iOS의 request-stall은 headers `02:20:37.894Z`, body `02:20:53.375Z`에 요청을 받았고
`device.log`에 `[e2e-http] 0 GET /api/v1/examples REQUEST_TIMEOUT` 두 줄을 남기며 UI/로그 가드를 통과했다.
시간은2026-10-02 UTC다. 결정43의 둘째 tap은 위 Mac 기기 좌표/노드 실측과 CI FastAPI 로그인1·회전1·POST1
요청 수 가드 통과를 함께 근거로 쓴다. 세 쓰기 갈림/토큰 수명은 Task5의 K4 및 이 실행의 계약94시험이 담당한다.

같은 실행의 offset 순회 두 `scrollUntilVisible` 시각은 commands.json의 timestamp+duration으로 계산했다.
제한90초와 재시도0은 그대로다. Android 세 job 로그의 `E2E: 환경 흔적`은0줄이었다.

| 칸 | 첫 scroll 시작–끝 UTC / 소요 | 둘째 scroll 시작–끝 UTC / 소요 |
| --- | --- | --- |
| Android FastAPI | 01:58:34.116–01:58:49.973 / 15.857초 | 01:58:49.974–01:59:07.280 / 17.306초 |
| Android NestJS | 01:59:09.781–01:59:25.059 / 15.278초 | 01:59:25.060–01:59:45.547 / 20.487초 |
| Android Rails | 02:00:25.011–02:00:42.029 / 17.018초 | 02:00:42.029–02:01:06.965 / 24.936초 |
| iOS FastAPI | 01:53:47.737–01:54:09.928 / 22.191초 | 01:54:09.932–01:54:34.298 / 24.366초 |
| iOS NestJS | 01:53:50.475–01:54:14.076 / 23.601초 | 01:54:14.078–01:54:37.112 / 23.034초 |
| iOS Rails | 01:54:14.915–01:54:36.324 / 21.409초 | 01:54:36.325–01:55:05.819 / 29.494초 |

#### 12:34 최종 검토 수정의 검증 — 다시 아홉 셀 성공

첫 초록 뒤 코디네이터의 전체 브랜치 검토에서 native Redis 소유권(I1)과 잘못된 BACKEND_KIND의 오류 출력(M1)을
보완했다. `2599bf2d1fb5dbfab28ed0276f03aebccfd5d41c`는 PID·실행파일·이 실행의 전용 config 경로/port·실제
listener를 모두 확인하고 자기 Redis만 중지하며, 외부 점유자는 시작 전에 거절한다. 네 진입점의 잘못된
BACKEND_KIND는 안내만 출력하고 exit1로 끝난다. 이 코드는 코디네이터가 검토·커밋·push했으며 Mac은 ff-only로 받았다.

[최종 검토 실행36955635199](https://github.com/builder-shin/template-typescript-expo/actions/runs/36955635199)는
2026-10-02 12:33:09 KST에 마지막 셀까지 **success**였고 `gh run watch --exit-status`도 exit0이었다.

| 셀 | 결과 | 잡 소요 시간 |
| --- | --- | --- |
| [build-ios (e2e .app)](https://github.com/builder-shin/template-typescript-expo/actions/runs/36955635199/job/110677863623) | success | 15분 25초 |
| [build-android (e2e APK)](https://github.com/builder-shin/template-typescript-expo/actions/runs/36955635199/job/110677863786) | success | 26분 15초 |
| [checks (게이트 [1]–[11])](https://github.com/builder-shin/template-typescript-expo/actions/runs/36955635199/job/110677863792) | success | 2분 24초 |
| [e2e-ios (nestjs)](https://github.com/builder-shin/template-typescript-expo/actions/runs/36955635199/job/110681567135) | success | 42분 57초 |
| [e2e-ios (fastapi)](https://github.com/builder-shin/template-typescript-expo/actions/runs/36955635199/job/110681567235) | success | 50분 53초 |
| [e2e-ios (rails)](https://github.com/builder-shin/template-typescript-expo/actions/runs/36955635199/job/110681567295) | success | 38분 38초 |
| [e2e-android (fastapi)](https://github.com/builder-shin/template-typescript-expo/actions/runs/36955635199/job/110684097619) | success | 30분 51초 |
| [e2e-android (nestjs)](https://github.com/builder-shin/template-typescript-expo/actions/runs/36955635199/job/110684097636) | success | 31분 54초 |
| [e2e-android (rails)](https://github.com/builder-shin/template-typescript-expo/actions/runs/36955635199/job/110684097683) | success | 36분 51초 |

세 iOS 셀은 수정된 native backend와 각21흐름, Android는 각23흐름·계약 거울 각각94시험을 통과했다.
CI checks는 **95파일/1914시험**이다. Mac에서 Task4b 마지막 코드52a1742를 검증한95파일/1902시험과 구분한다.
Redis 변경은 하네스의 자원 소유권 경계를 보완하며 앱/플로/타임아웃/재시도는 바꾸지 않았다. 원본은
`.maestro-output/mac-repro/final-wave-*-job.log`, `ci-final-wave-final.json`, `ci-final-wave-watch.log`,
`/tmp/d7-final-wave/e2e-ios-{fastapi,nestjs,rails}`다.

최종 문서 변경은 K3 및 스펙13/17의 날짜 있는 정정 두 파일뿐이다. docs/**만 바꾼 push는 워크플로의 paths-ignore
대상이므로 새 CI를 만들지 않는다. 첫 초록 코드는53e3134, 최종 검토까지 검증한 코드는2599bf2이며 이후 문서 커밋과
구분한다. Mac의 booted simulator0·소유 compose project 컨테이너0을12:34 다시 확인했다. 원래 warm 링크/404
정체의 미재현 원인과 로컬 Rails 전체 미완료 한계는 위 기록대로 유지하고 CI 성공으로 소급 해석하지 않는다.

## K4 — 쓰기 갈림과 access token 수명(세 백엔드)

**실측일: 2026-10-02(Asia/Seoul), Windows 11·Git Bash·Node 24.19.0·pnpm 11.22.0.**
`4646587` 시점의 기기 플로 22개와 기존 거울 89개가 보내지 않는 경로를
`test/contract/write-paths.test.ts`의 독립 프로브 다섯으로 더 쟀다. 빈 PATCH·미선언 속성·읽기 전용 `createdAt`·
중복 태그 id는 상태·오류 코드·정확한 포인터와 저장된 값이 바뀌지 않는지를 대조하고, 새 로그인은 JWT payload의
정수 `exp - iat`를 하네스가 설정한 수명과 대조한다. 서명 검증·만료 뒤 회전은 이 프로브의 범위 밖이다.

**과거 표와 현재 HTTP 응답.** 과거의 출처는 Next.js D4 계획
`template-typescript-nextjs/docs/superpowers/plans/2026-09-08-create-update-delete.md:253`의 §2,
필수 행은 `:260`(빈 PATCH)·`:261`(금지 속성)·`:262`(중복 태그)다. 날짜는 그 계획의 2026-09-08이며,
Expo D4 계획 `docs/superpowers/plans/2026-09-30-d4-create-update-delete.md:7666`이 D7에 이 세 경로와 수명을 넘겼다.
과거 계획은 당시 기록으로 남긴다. 아래 과거 값에서 `422 필드`는 필드 오류, `400 문서`는 문서 오류다.

| 프로브 | FastAPI 과거 → 현재 | NestJS 과거 → 현재 | Rails 과거 → 현재 |
|---|---|---|---|
| 빈 PATCH (`data.type`·`data.id`만) | 422 → 422 | 200 no-op → **422** | 422 → 422 |
| 미선언 `mirrorUndeclaredAttribute` | 422 필드 → 422 필드 | 422 필드 → 422 필드 | 400 문서 → **422 필드** |
| 읽기 전용 `createdAt` | 422 필드 → 422 필드 | 422 필드 → 422 필드 | 400 문서 → **422 필드** |
| 같은 태그 id 두 번 | 400 → 400 | 조용히 중복 제거 → **400** | 400 → 400 |
| 새 로그인 `exp - iat` | 기본 900(설정 읽음) → **설정 600·실측 600** | 기본 900(설정 읽음) → **설정 600·실측 600** | 기본 900(설정 읽음) → **설정 600·실측 600** |

수명의 과거 출처는 Expo D4 계획 `:129`(2026-10-01 확인)다. 기본 900으로는 설정을 읽는 백엔드와 무시하는 백엔드를
구별할 수 없어 `run.sh`의 `E2E_ACCESS_EXPIRES_SECONDS`를 600으로 바꿨다. compose가 그 환경 변수를
`JWT_ACCESS_EXPIRES_SECONDS`로 넘기고(`docker-compose.e2e.yml:73`·`:126`·`:194`), 시험은 같은 변수를 읽는다.
시험에는 600의 두 번째 상수가 없다. 스택 준비가 끝나야 로그인하며, 최종 거울 실행은 각각 1.51·1.54·3.60초라
600초의 토큰으로 기존 속성 제약도 충분히 잴 수 있었다. 기기 E2E의 10초가 셸에 남아 있어도 하네스가 덮어쓴다.

현재 세 백엔드에서 오류의 모양은 같았다:

| 프로브 | HTTP 상태 / `code` / `source.pointer` |
|---|---|
| 빈 PATCH | 422 / `VALIDATION_ERROR` / `/data` (문서 오류) |
| 미선언 속성 | 422 / `VALIDATION_ERROR` / `/data/attributes/mirrorUndeclaredAttribute` (필드 오류) |
| 읽기 전용 속성 | 422 / `VALIDATION_ERROR` / `/data/attributes/createdAt` (필드 오류) |
| 중복 태그 | 400 / `INVALID_JSONAPI_DOCUMENT` / `/data/relationships/tags/data/1/id` (관계 오류) |

**실제로 빌드한 백엔드와 설명하는 소스.** compose는 형제 디렉터리가 아니라 각 GitHub 저장소의 `main`을 빌드한다.
아래 SHA는 각 실행의 빌드 로그에서 읽었다. 따라서 이 앱 저장소의 변경 없이도 백엔드 `main` 변경으로 프로브가
빨개질 수 있다. 소스는 응답을 설명하는 근거이며, 기대값의 정본은 위 HTTP 실측이다.

| 백엔드 / 측정 커밋 | 빈 PATCH | 미선언·읽기 전용 속성 | 중복 태그 | access 수명 설정 |
|---|---|---|---|---|
| `template-python-fastapi` / `3c4eee39a2f3b69f594b7d610b0a7a423433fbe0` | `app/controllers/concerns/crud_actions.py:275`–`:280` | `app/jsonapi/naming.py:20`–`:22`, `app/schemas/example.py:45`–`:51`, `app/jsonapi/exception_handlers.py:119`–`:139` | `app/controllers/concerns/relationship_resolver.py:285`–`:290` | `config/auth.py:38`–`:42` |
| `template-typescript-nestjs` / `92cc2b1f5c5914d5d24b1688ab84468528dce95b` | `src/app/controllers/concerns/document-parsing.ts:57`–`:64` | `src/app/schemas/write-schema.ts:72`–`:94` | `src/app/controllers/concerns/relationship-resolver.ts:97`–`:98` | `src/config/settings.ts:153`–`:155` |
| `template-ruby-rails` / `231576eeac21c583b2cc28532248223351f2c92f` | `app/controllers/concerns/crud_actions.rb:385`–`:391` | `app/controllers/concerns/jsonapi_write_validation.rb:35`–`:37`, `:95`–`:98` | `app/controllers/concerns/jsonapi_relationships.rb:165`–`:170`, `:270`–`:275` | `config/initializers/auth.rb:30`–`:35` |

NestJS의 측정 커밋은 로컬 형제 저장소 HEAD와 달라 해당 SHA의 소스를 GitHub contents API로 읽어 위 줄을 확인했다.
FastAPI·Rails는 로컬 형제 저장소 HEAD와 측정 SHA가 같았다. 기본값 900·0 이하 설정 거절은 설정 소스로 확인했으며,
이번 HTTP 프로브는 비기본 양수 수명 반영만 잰다(0 이하로 별도 스택을 띄우지는 않았다).

**과거 표에서 달라진 응답의 처리.** 첫 NestJS 실행은 빈 PATCH·중복 태그만 실패(2 failed / 92 passed,
exit 1)했고, 첫 Rails 실행은 미선언·읽기 전용 속성만 실패(2 failed / 92 passed, exit 1)했다.
HTTP 응답과 소스를 조정자에게 보냈고 현재 실측 기준으로 고정하도록 승인받았다(D7-R24). 강화된 거절은 앱이
이미 피하는 경로다. `lib/resources/write.ts:185`–`:187`이 `writeDocument`로 수정 문서를 만들고,
`lib/resources/form.ts:335`–`:337`이 `formAttributes`의 모든 쓰기 가능 속성을 보낸다. 그 화이트리스트는
`lib/resources/define.ts:336`–`:339`가 읽기 전용 속성을 뺀다. 태그의 순수 조립 함수
`lib/resources/form.ts:297`–`:305`는 보내기 전 `Set`으로 중복을 제거한다. 따라서 앱 코드는 바꾸지 않았다.

**독립 데이터와 정리.** 각 프로브는 고유 이메일로 가입·로그인하고, 쓰기 프로브는 고유 제목의 자기 example을 만든다.
실패해도 `finally`에서 그 행을 DELETE한다(204 단언). 태그는 쓰기 API가 없는 참조 자원이라 시드 행을 읽기만 하며
자기 example의 관계만 쓴다. 다른 시험의 행·계정에 의존하지 않는다. 계정 삭제 API는 없어 하네스의 프로젝트 한정
`down -v`가 계정을 정리한다.

**최종 실행.** `BACKEND_KIND=<종류> ./test/contract/run.sh`를 백엔드마다 돌렸다. 각 로그에
`[matrix] <종류>: 알려진 계약 드리프트 없음`이 있었다. 쓰기 경로의 과거 갈림은 그 목록에 숨긴 기대 실패가 아니라
현재 HTTP 결과를 대조하는 프로브다. `test/e2e/matrix.ts`와 `KNOWN_DIVERGENCES`는 바꾸지 않았다.

| 백엔드 | exit | 계약 파일 / 시험 | `joon-*` 전 → 후 | 우리 compose 종료 뒤 컨테이너(정지 포함) |
|---|---|---|---|---|
| fastapi | 0 | 2 passed / 94 passed (기존 89 + 새 5) | 9 → 9 | 0 |
| nestjs | 0 | 2 passed / 94 passed | 9 → 9 | 0 |
| rails | 0 | 2 passed / 94 passed | 9 → 9 | 0 |

**뮤테이션.** FastAPI 기대값 데이터의 `emptyPatch.status`만 422 → 200으로 뒤집었다. 실제 응답
`422 VALIDATION_ERROR /data`로 그 프로브 하나만 빨개졌다(`1 failed / 93 passed`, exit 1). 422로 복원한 뒤
FastAPI 전체가 `94 passed`, exit 0이었다. 두 실행 모두 `joon-*` 9 → 9, 우리 프로젝트 컨테이너 0이었다.

정적 검사는 typecheck·lint·format·secretlint·인용·출처가 모두 exit 0, 단위는 **90파일·1844시험** 통과다.
하네스 단위 19개가 compose/거울의 공통 수명 600·백엔드 전달·프로젝트 범위·정리·종료 코드 불변식을 지킨다.
`bash -n`·ShellCheck 0.11.0·bash 3.2 금지 구문 스캔도 exit 0이었다. 이번 작업은 필수 경로와 수명에 한정했으며
선택 사항인 쓰기 `?include=`·읽기 전용 자원 쓰기·없는 `links` 항목은 추가 실측하지 않았다. CI는 통합 뒤 조정자가 돈다.
