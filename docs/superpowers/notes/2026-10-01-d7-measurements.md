# D7 실측 기록 (2026-10-01)

D7(CI - checks, Android×3, iOS×3)이 잰 것이다. 각 절은 **무엇을 했고(명령) 무엇이 나왔는가(출력)**를 사실로 적는다.
K1·K2 는 개발 머신(Windows 11, Git Bash, 에뮬레이터 `Pixel_9_API_36` - Android 16·API 36·Google Play 이미지)에서,
K3 은 GitHub Actions 에서 쟀다. 출력의 저장소 경로·계정 이름은 줄였다.

## K1 — 로컬: 정적 게이트, 세 백엔드의 계약 거울, 게이트 13단계와 멈춘 서버 확인(Android)

**정적 게이트.** `./scripts/check.sh --static` - CI 의 checks 잡이 부르는 것과 같다.

```text
(Task 1 Step 11 의 출력 - "=== [1/13]" … "=== [11/13]" 줄과 마지막 줄을 붙인다)
```

**세 백엔드의 계약 거울.** `BACKEND_KIND=<종류> ./test/contract/run.sh` - FastAPI 는 게이트의 [12] 가 돈다.

```text
(Task 1 Step 12 의 출력 - 백엔드마다 "[matrix] …" 줄과 "Tests …" 줄을 붙인다)
```

**게이트 13단계와 멈춘 서버 확인.** `E2E_AVD=Pixel_9_API_36 E2E_CHECKS=1 ./scripts/check.sh` - E2E 단계가 플로 뒤에 백엔드를
내리고 같은 포트(4100)에 `test/e2e/stall-server.ts` 를 띄워 `test/e2e/checks/request-stall.yaml` 을 돌았다.

```text
(Task 1 Step 13 (a) 의 출력을 붙인다)
```

멈춘 서버의 기록과 기기 로그의 `REQUEST_TIMEOUT` 두 줄 - 요청이 서버에 닿은 시각과 앱이 실패 줄을 남긴 시각의 차가
타임아웃(15초)이다.

```text
(Task 1 Step 13 (b) 의 출력을 붙인다)
```

**받은 APK 로 도는 길.** CI 는 APK 를 한 번 만들어 `E2E_APK` 로 넘긴다 - 게이트가 만든 APK 로 같은 길을 돌았다.

```text
(Task 1 Step 13 (c) 의 출력을 붙인다)
```

## K2 — 360dp 에서 필터 시트의 날짜 자리표시자

D3 최종 검토가 넘긴 확인이다(`최소 YYYY-MM-DD` 가 반 폭의 입력 칸에서 잘릴 수 있다). 에뮬레이터의 화면을
`wm size 1080x1920`·`wm density 480`(360×640dp)으로 바꾸고 목록의 필터 시트에서 날짜 칸 둘을 화면에 들여 찍었다.

```text
(Task 1 Step 14 의 출력 - wm size·density, 두 입력 칸의 bounds 를 붙인다)
```

(판정 - 스크린샷에서 두 자리표시자가 끝까지 보였는가, 잘렸으면 무엇을 고쳤는가를 적는다)

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
