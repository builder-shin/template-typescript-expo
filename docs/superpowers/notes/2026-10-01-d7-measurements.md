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

(Task 4 Step 1–3 - 날짜, 브랜치 머리 커밋, 러너 이미지의 판이 사실 절과 달랐으면 그 판)

| 실행 | 커밋 | 칸별 결과 | 원인과 고친 것 |
| --- | --- | --- | --- |
| (Task 4 Step 4 의 첫 실행 - 번호와 주소) | (짧은 SHA) | (아홉 칸의 결론) | (Step 6 의 갈래와 고친 커밋) |

**초록.** (마지막 실행의 번호·주소·커밋, 칸마다 걸린 시간, 캐시 적중, iOS 의 Xcode·런타임·시뮬레이터, Android 의 AVD, 세
백엔드 저장소의 커밋을 적는다)

```text
(Task 4 Step 5 의 잡 표를 붙인다)
```

**Android 빌드에서 이어받은 것.** 둘째 Gradle 의 UP-TO-DATE 줄, 4GiB 힙/1GiB Metaspace, 공개 러너 RAM 16GB 와 Kotlin 데몬의 JVM 인자·최대 RSS(잴 수 없었으면 그 한계), OOM 이 있었다면 free -h·첫 오류와 대응을 적는다(결정 40·41).

**iOS 에서 처음 잰 것.** 줄마다 사실로 바꾼다 - 근거는 그 실행의 `e2e-ios-<백엔드>` 아티팩트다.

- 빌드 정보 카드(`home-build-info`)가 본 값:
- 특수 문자 딥링크(`examples-browse` - D3 최종 검토가 넘긴 iOS 딥링크 정규화):
- 로캘 플로 셋의 `-AppleLanguages`:
- 요청 타임아웃(`checks/request-stall` - 기기 로그의 `REQUEST_TIMEOUT` 두 줄과 서버 기록의 두 방식):
- 머리글 뒤로 버튼(`BackButton`)·시트 배경(`sheet-backdrop`)·키체인 비우기(`clearKeychain`):
- 가드가 본 경고(`[e2e-warn]`)가 있었는가:
- 쓰기 플로 넷(키보드와 라벨 누름, Modal 시트, 가드가 보낸 로그인 화면의 "홈으로" - `back-to-home-button`), examples-create 로그인 둘째 누름의 이동 뒤 좌표·닿은 노드·로그인 요청 1(결정 43):

**세 백엔드에서 처음 잰 것.** 근거는 `e2e-android-<백엔드>`·`e2e-ios-<백엔드>` 의 `api.log` 와 플로 기록이다.

- 쓰기 갈림 셋(빈 PATCH, 겹친 태그, 읽기 전용 속성 - D4 가 넘긴 확인)이 NestJS·Rails 에서 어떻게 끝났는가:
- `JWT_ACCESS_EXPIRES_SECONDS`(하네스가 주는 10초)가 세 백엔드에서 들었는가 - 쓰기마다 회전 요청이 있었는가:

**느린 기기에서 잰 것.** 근거는 칸마다의 `<플로>/maestro.log` 의 시각과 잡 로그다.

- 실험실 offset 순회의 스크롤 둘(`contract-lab-anonymous` - 로컬 에뮬레이터 16.2–17.2초, 제한 90초)이 칸마다 걸린 시간:
- 환경 흔적(`E2E: 환경 흔적 - …` - `Active window root not found`·`java.net.ConnectException`)이 찍힌 칸이 있었는가:
