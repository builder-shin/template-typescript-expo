# D5 실측 기록 (2026-10-01)

계약 거울과 계약 실험실(D5)을 실제 FastAPI 스택과 기기에서 잰 것이다. 계획은
`docs/superpowers/plans/2026-10-01-d5-contract-lab.md`.

## C1 — 계약 거울이 선언의 어긋남을 잡는다 (드리프트 감지)

**명령.** 자원 선언 `lib/resources/example.ts` 에 어긋남 둘을 일부러 넣고 `./test/contract/run.sh` 를 돌렸다 -
`title` 의 `maxLength` 200 → 100(선언이 백엔드보다 좁다), `filters.title` 에 `gt` 를 더했다(백엔드가 닫은 연산자를
선언이 연다). 돌린 뒤 `git checkout -- lib/resources/example.ts` 로 되돌렸다.

```text
$ grep -E "FAIL|Tests " .maestro-output/drift.log | sort -u
      Tests  2 failed | 87 passed (89)
 FAIL  test/contract/mirror.test.ts > ① 선언된 조회 정책이 백엔드와 같다 - examples > examples filter title gt
 FAIL  test/contract/mirror.test.ts > ③ 속성 제약 - examples 에만, 로그인한 뒤 > title 이 maxLength 보다 한 글자 길면 422
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
```

`run.sh` 는 exit 1 이었고, 되돌린 뒤 `git status --short lib/resources` 는 비었다. 두 실패의 메시지는
`[examples filter title gt] 2xx 를 기대했다 - 실제 400` 과 `422 를 기대했다 - errors=[]: expected 201 to be 422` 다.

거울이 잡은 것: ① `examples filter title gt`(선언은 2xx 를 기대했는데 백엔드는 400 `INVALID_FILTER`), ③ `title 이
maxLength 보다 한 글자 길면 422`(101자 제목을 백엔드가 받았다). 나머지 87 은 그대로 통과했다 - 스택·가입·로그인은 성했다.
변이는 ①(필터 연산자)과 ③(`maxLength`)만 건드렸다 - ②(응답 속성 키)와 ④(enum 값)는 실제 스택에서 변이로 재 보지 않았다.

같은 실증을 두 번 돌렸다 - 거울 시험이 `overlongTitle` 을 `maxLength + 1` 자로 자르게 고친 `7372426` 앞(`fc93100`)과
뒤(`251b243`, 위 출력)에서 실패한 시험과 수가 같았다. 접두사가 101자보다 짧아 그 자르기는 이 변이에서 아무것도 바꾸지
않는다. `251b243` 부터 C2 의 증거 게이트를 돈 트리(`f837754`)까지 거울의 코드(`test/contract/` 의 시험·도우미·`run.sh` 와
`lib/resources/`)는 주석 말고 바뀌지 않았다(`0516fc3` 이 시험의 머리말 주석을 고쳤다).
백엔드는 `template-python-fastapi` 의 `main`(`3c4eee3`)에서 빌드한 이미지이고, `run.sh` 한 번(스택을 띄우고
내리기까지)이 18초였다. 변이 없는 거울은 `Tests  89 passed (89)` 다(C2 의 `[12/13]`).

## C2 — 게이트 13단계

**명령.** `E2E_AVD=Pixel_9_API_36 E2E_FORCE_BUILD=1 ./scripts/check.sh` - Pixel_9_API_36(Android 16, API 36), FastAPI
스택. `E2E_FORCE_BUILD=1` 은 개발 중에 같은 빌드 입력으로 APK 를 만들어 둔 탓에 게이트가 빌드를 건너뛰지 않게 준 것이다(D4
와 같다). `TEMP`·`TMP` 는 `.maestro-output/` 안에 따로 만든 디렉터리로 돌렸다 - `[10/13]` 의 `expo export` 와 `[13/13]` 의
Gradle 번들 단계가 다른 Metro 와 캐시를 나누지 않는다. 증거 게이트(다섯째 회차)의 트리는 `f837754` 에 익명 플로·`test/e2e/AGENTS.md`·이
기록의 변경만 커밋하지 않은 채였다(이 기록의 숫자와 줄은 게이트 뒤에 채웠다). 게이트는 `=== [1/13] typecheck ===` 부터
`=== 전부 통과 ===` 까지 25분에 지났다 - 단위 시험은 69 파일 1546 개, `[10/13]` 의 `expo export` 는 exit 0(139 없음),
`[13/13]` 은 Metro 캐시를 비운 뒤 데몬 없이 APK 를 만들었다(`BUILD SUCCESSFUL in 4m 26s`). 아래는 그 게이트의 `[12/13]`
요약과 `[13/13]` 의 줄이다:

```text
=== [12/13] 계약 거울 ===
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
--- login-error-en (en-US)
--- login-error-ko (ko-KR)
--- logout-from-protected
--- register-conflict
--- register-invalid
--- register-restore-logout
=== E2E 통과 - 플로 20개 ===
```

계약 거울은 시험 89 - ① 조회 정책 프로브 77(`examples` 51·`exampleCategories` 13·`exampleTags` 13), ② 응답 속성 키
3, ③ 속성 제약 5, ④ enum 값 4(값 셋과 "잴 enum 이 하나 이상"). E2E 는 D2 의 일곱, D3 의 일곱, D4 의 넷, D5 의 둘이다.

**앞선 게이트 넷.** 같은 명령을 앞 트리에서도 돌렸다. 증거는 위의 다섯째 회차다 - 첫째와 셋째 회차 도중에는 다른 작업의
커밋이 들어와 시작과 끝의 트리가 다르다:

| 시작한 트리           | 결과                                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------ |
| `251b243`             | 통과 - 도중에 커밋 다섯이 들어와 끝날 때는 `1d05e7e` 였다(APK 는 `4a85714` 앞의 트리로 만들었다)       |
| `1d05e7e`             | 통과 - 익명 플로의 앞머리(C3 의 "실험실에 드는 두 길")를 더하기 앞                                     |
| `c99db78` + 그 앞머리 | 19/20 - `examples-scroll-refresh` 가 첫 단계에서 실패했다(아래 ①). 도중에 문서·주석 커밋 셋이 들어왔다 |
| `f837754` + 그 앞머리 | 19/20 - `register-invalid` 가 첫 단계에서 실패했다(아래 ②)                                             |

두 실패는 앱과 플로 밖에 있었다. 실패한 플로는 다른 회차에 그대로 통과했고, 실패한 회차의 기기 로그에 앱의 경고·오류는 없었다.

① `start-signed-out` 의 `launchApp`(`clearState`) 뒤 30초 동안 `home-screen` 을 찾지 못했다. 앱은 2.7초 만에 홈을 그렸다
(`ActivityTaskManager: Displayed …MainActivity … +2s670ms` - 실패 때의 스크린샷과 계층도 홈이다). 그동안 Maestro 의 기기
드라이버는 계층을 물을 때마다 5초를 기다린 뒤 앱 창 없이 돌아왔다(`W/UiDevice: Active window root not found.` 뒤
`D/Maestro: View hierarchy received in 5084 ms` - 40초 동안 여덟 번). 같은 경고는 통과한 플로에도 0–6번 있었지만 계층은 늘
1.8초 안에 돌아왔다. 정지 구간(06:20:21–06:21:00Z)은 같은 머신에서 다른 작업이 정적 검사 전부(typecheck·lint·단위 시험
전체)를 돌린 때(약 06:19–06:21Z)와 겹친다 - 호스트 CPU 경합이 에뮬레이터를 굶겨 질의가 늦어졌을 수 있지만, 재 본 것은 두
구간의 겹침뿐이다(원인은 증명하지 못했다).

② 같은 첫 단계의 권한 설정에서 Maestro 가 호스트의 adb 서버에 닿지 못했다(`java.net.ConnectException: Connection timed out:
connect` - 앱 상태를 지우기 시작하고 5.6초 뒤). 게이트가 끝난 뒤의 `adb devices` 는 곧바로 응답했고 호스트의 TCP 포트도 남아
있었다. 이 회차 동안에는 다른 작업이 시험·빌드를 돌리지 않아 CPU 경합으로는 설명되지 않는다 - 원인은 밝히지 못했다.

제한 시간과 단언은 그대로 두었다. 증거 게이트 앞에 adb 서버를 다시 띄우고 에뮬레이터를 새로 부팅했다(`test/e2e/android.sh
boot` - 에뮬레이터는 6시간 가까이 켜져 있었고 이 태스크에서만 플로 83번을 돈 뒤였다). 실패한 두 회차는 통과로 세지 않는다.

## C3 — 계약 실험실 (기기)

**가드.** 선언한 실패 표식 - `contract-lab-anonymous` 의 400(정책에 없는 필터 연산자) (1), `contract-lab-signed-in`
의 422(언어 협상 ko·en) (2). 세션이 필요한 셋을 로그인하지 않은 채 눌렀을 때 요청이 나가지 않았다 - 그 플로의
백엔드 접근 로그에 `PUT`·`/relationships/tags`·`POST /api/v1/examples` 가 없다. 아래는 C2 의 증거 게이트가 남긴 기록이다:

```text
$ grep "\[e2e-http\]" .maestro-output/e2e/contract-lab-anonymous/logcat.txt
I/ReactNativeJS( 4946): [e2e-http] 400 GET /api/v1/examples INVALID_FILTER
$ grep -c "\[e2e-http\] 422 " .maestro-output/e2e/contract-lab-signed-in/logcat.txt
2
$ grep -cE "PUT /api/v1/examples/|/relationships/tags|POST /api/v1/examples " .maestro-output/e2e/contract-lab-anonymous/api.log
0
$ grep -E "PUT /api/v1/examples/|/relationships/tags|POST /api/v1/auth/refresh" .maestro-output/e2e/contract-lab-signed-in/api.log
api-fastapi-1  | INFO:     172.23.0.1:53758 - "POST /api/v1/auth/refresh HTTP/1.1" 200 OK
api-fastapi-1  | INFO:     172.23.0.1:53758 - "PUT /api/v1/examples/55550000-0000-4000-8000-000000000001 HTTP/1.1" 201 Created
api-fastapi-1  | INFO:     172.23.0.1:53758 - "POST /api/v1/auth/refresh HTTP/1.1" 200 OK
api-fastapi-1  | INFO:     172.23.0.1:53758 - "PUT /api/v1/examples/55550000-0000-4000-8000-000000000001 HTTP/1.1" 200 OK
api-fastapi-1  | INFO:     172.23.0.1:50732 - "POST /api/v1/auth/refresh HTTP/1.1" 200 OK
api-fastapi-1  | INFO:     172.23.0.1:50732 - "POST /api/v1/examples/55550000-0000-4000-8000-000000000001/relationships/tags HTTP/1.1" 204 No Content
api-fastapi-1  | INFO:     172.23.0.1:50732 - "DELETE /api/v1/examples/55550000-0000-4000-8000-000000000001/relationships/tags HTTP/1.1" 204 No Content
api-fastapi-1  | INFO:     172.23.0.1:44152 - "POST /api/v1/auth/refresh HTTP/1.1" 200 OK
```

세션이 필요한 실험마다 회전(`POST /api/v1/auth/refresh` 200)이 먼저 나갔다 - PUT upsert 두 번, 관계 쓰기, 언어 협상의
넷이다(하네스의 access 수명 10초). 마지막 회전 뒤가 언어 협상의 `POST /api/v1/examples` 422 둘이다. 관계 쓰기는 그 사이에
태그 하나를 토큰 없이 조회했다(`GET /api/v1/tags?page[size]=1` 200). `contract-lab-anonymous` 의 접근 로그에서 이 플로의
요청은 다섯뿐이다(로그의 머리에는 앞 플로 `auth-links` 의 끝 줄 - 가입·로그인과 참조 목록 둘 - 이 섞인다. 하네스가 5초 앞부터
자른다) - 400 하나(`filter[title][gt]=probe-lab`), 페이지 총합의 둘(`page[size]=1`, 그리고 `page[totals]=true` 를
더한 것), offset 순회의 둘(`page[number]=1`·`2`, `page[size]=3` - 씨앗 여섯 행에서 2쪽에 끝에 닿았다). 언어 협상의 두
본문은 같은 오류(`VALIDATION_ERROR`, `source.pointer` 는 `/data/attributes/title`)이고 문구만 갈렸다 - ko 는
`유효하지 않은 요청`·`요청 값이 유효성 검사를 통과하지 못했습니다.`, en 은 `Invalid request`·`A request value failed
validation.` 이다(개발 실행 - `4a85714` 앞의 APK - 뒤 기기 화면에서 읽었다).

**로그인 이동과 복귀.** `contract-lab-signed-in` 이 로그인하지 않은 채 PUT upsert 를 눌러 로그인 화면에 닿았고,
로그인한 뒤 실험실로 돌아와(`next=/contract`) 같은 실험을 201·200 으로 돌렸다. 홈에서 든 실험실의 헤더는 루트 스택의 기본
헤더(뒤로 가기와 제목 "계약 실험실")이고 "홈으로" 도 로그아웃 버튼도 없다 - `4a85714` 를 담은 APK(둘째 회차 게이트의 것)로
홈에서 실험실에 들어간 화면에서 봤다. 두 플로는 개발 실행(처음의 두 플로, 앞머리를 더한 익명 플로)과 앞선 게이트 넷에서도
고치지 않고 통과했고, 가드의 표식과 접근 로그의 요청이 위와 같았다.

**실험실에 드는 두 길.** `contract-lab-anonymous` 의 앞머리다(`1d05e7e` 의 게이트 뒤에 더했다). 앱을 멈춘 뒤 딥링크
(`templateexpo-e2e://contract`)로 연 실험실은 루트에 혼자라 헤더에 뒤로 가기가 없고 "홈으로"(`back-to-home-button`)가 있었다 -
누르니 홈이었다(`4a85714` 의 출구). 홈의 진입(`home-lab-link`)을 Maestro 의 `repeat: 2`(`delay: 1` - 기록에는 "Double
tap")로 누르니 실험실이 하나만 쌓였다 - 뒤로 한 번에 홈이었고, 홈에서 든 실험실에는 "홈으로" 가 없었다. 잰 것은 쌓인 화면의
수다. 둘째 누름이 실험실에 닿았다면 그 자리는 관계 전용 쓰기 카드의 설명 글(누를 것이 없다 - UI 덤프로 봤다)이라 아무 일도
일어나지 않는다 - 그래서 이 측정은 이동 가드(`useNavigateOnce`)가 둘째 누름을 버린 것과 둘째 누름이 헛누름이 된 것을 가르지
못한다.

**게이트 뒤에 더한 단언.** 증거 게이트 뒤에 `contract-lab-anonymous` 에 관계 전용 쓰기의 세션 안내
(`lab-session-note-relationshipWrite`) 단언 하나를 더했다 - 이제 세션이 필요한 셋의 안내를 모두 본다. 앱은 바뀌지 않아 그
플로만 같은 APK 로 다시 돌렸고(`E2E_FLOW="contract-lab-anonymous"` - "APK 를 다시 만들지 않는다") 통과했다. 가드의 표식(400
한 줄)과 접근 로그(세션 요청 0)는 위와 같았다.

**재지 않은 것.** 홈 진입의 두 번 누름에서 이동 가드가 둘째 누름을 버리는지(결과는 실험실 하나지만 가드와 헛누름을 가르지
못한다 - 가드를 뺀 APK 로 재 보지 않았다). iOS(D7 의 CI - 딥링크로 곧장 연 실험실의 "홈으로" 는 iOS 의 출구로 둔 것이지만
Android 에서만 쟀다). NestJS·Rails 에서의 거울과 실험실(D7 의 매트릭스 - `test/contract/run.sh` 는 지금 FastAPI 프로파일만
띄운다).
