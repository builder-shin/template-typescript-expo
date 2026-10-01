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
