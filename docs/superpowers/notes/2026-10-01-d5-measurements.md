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

같은 실증을 두 번 돌렸다 - 거울 시험이 `overlongTitle` 을 `maxLength + 1` 자로 자르게 고친 `7372426` 앞(`fc93100`)과
뒤(`251b243`, 위 출력)에서 실패한 시험과 수가 같았다. 접두사가 101자보다 짧아 그 자르기는 이 변이에서 아무것도 바꾸지
않는다. `251b243` 부터 C2 의 게이트를 돈 트리(`1d05e7e`)까지 거울(`test/contract/`·`lib/resources/`)은 바뀌지 않았다.
백엔드는 `template-python-fastapi` 의 `main`(`3c4eee3`)에서 빌드한 이미지이고, `run.sh` 한 번(스택을 띄우고
내리기까지)이 18초였다. 변이 없는 거울은 `Tests  89 passed (89)` 다(C2 의 `[12/13]`).

## C2 — 게이트 13단계

**명령.** `E2E_AVD=Pixel_9_API_36 E2E_FORCE_BUILD=1 ./scripts/check.sh` - Pixel_9_API_36(Android 16, API 36), FastAPI
스택. `E2E_FORCE_BUILD=1` 은 개발 중에 같은 빌드 입력으로 APK 를 만들어 둔 탓에 게이트가 빌드를 건너뛰지 않게 준 것이다(D4
와 같다). `TEMP`·`TMP` 는 `.maestro-output/` 안에 따로 만든 디렉터리로 돌렸다 - `[10/13]` 의 `expo export` 와 `[13/13]` 의
Gradle 번들 단계가 다른 Metro 와 캐시를 나누지 않는다. 트리는 `1d05e7e` 에 이 기록의 파일(플로 둘과 문서)만 커밋하지 않은
채였다. 게이트는 `=== [1/13] typecheck ===` 부터 `=== 전부 통과 ===` 까지 30분에 지났다 - 단위 시험은 69 파일 1546 개,
`[10/13]` 의 `expo export` 는 exit 0(139 없음), `[13/13]` 은 Metro 캐시를 비운 뒤 데몬 없이 APK 를 만들었다(`BUILD SUCCESSFUL
in 4m 39s`). 같은 게이트를 그 앞 트리(`251b243` - 실험실 화면에 "홈으로" 출구를 둔 `4a85714` 앞)에서도 한 번 돌렸고 결과가
같았다. 아래는 증거 게이트의 `[12/13]` 요약과 `[13/13]` 의 줄이다:

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

## C3 — 계약 실험실 (기기)

**가드.** 선언한 실패 표식 - `contract-lab-anonymous` 의 400(정책에 없는 필터 연산자) (1), `contract-lab-signed-in`
의 422(언어 협상 ko·en) (2). 세션이 필요한 셋을 로그인하지 않은 채 눌렀을 때 요청이 나가지 않았다 - 그 플로의
백엔드 접근 로그에 `PUT`·`/relationships/tags`·`POST /api/v1/examples` 가 없다. 아래는 C2 의 증거 게이트가 남긴 기록이다:

```text
$ grep "\[e2e-http\]" .maestro-output/e2e/contract-lab-anonymous/logcat.txt
I/ReactNativeJS(24437): [e2e-http] 400 GET /api/v1/examples INVALID_FILTER
$ grep -c "\[e2e-http\] 422 " .maestro-output/e2e/contract-lab-signed-in/logcat.txt
2
$ grep -cE "PUT /api/v1/examples/|/relationships/tags|POST /api/v1/examples " .maestro-output/e2e/contract-lab-anonymous/api.log
0
$ grep -E "PUT /api/v1/examples/|/relationships/tags|POST /api/v1/auth/refresh" .maestro-output/e2e/contract-lab-signed-in/api.log
api-fastapi-1  | INFO:     172.23.0.1:59910 - "POST /api/v1/auth/refresh HTTP/1.1" 200 OK
api-fastapi-1  | INFO:     172.23.0.1:59910 - "PUT /api/v1/examples/55550000-0000-4000-8000-000000000001 HTTP/1.1" 201 Created
api-fastapi-1  | INFO:     172.23.0.1:59910 - "POST /api/v1/auth/refresh HTTP/1.1" 200 OK
api-fastapi-1  | INFO:     172.23.0.1:59910 - "PUT /api/v1/examples/55550000-0000-4000-8000-000000000001 HTTP/1.1" 200 OK
api-fastapi-1  | INFO:     172.23.0.1:50516 - "POST /api/v1/auth/refresh HTTP/1.1" 200 OK
api-fastapi-1  | INFO:     172.23.0.1:50516 - "POST /api/v1/examples/55550000-0000-4000-8000-000000000001/relationships/tags HTTP/1.1" 204 No Content
api-fastapi-1  | INFO:     172.23.0.1:50516 - "DELETE /api/v1/examples/55550000-0000-4000-8000-000000000001/relationships/tags HTTP/1.1" 204 No Content
api-fastapi-1  | INFO:     172.23.0.1:58098 - "POST /api/v1/auth/refresh HTTP/1.1" 200 OK
```

세션이 필요한 실험마다 회전(`POST /api/v1/auth/refresh` 200)이 먼저 나갔다 - PUT upsert 두 번, 관계 쓰기, 언어 협상의
넷이다(하네스의 access 수명 10초). 마지막 회전 뒤가 언어 협상의 `POST /api/v1/examples` 422 둘이다. 관계 쓰기는 그 사이에
태그 하나를 토큰 없이 조회했다(`GET /api/v1/tags?page[size]=1` 200). `contract-lab-anonymous` 의 접근 로그에서 이 플로의
요청은 다섯뿐이다 - 400 하나(`filter[title][gt]=probe-lab`), 페이지 총합의 둘(`page[size]=1`, 그리고 `page[totals]=true` 를
더한 것), offset 순회의 둘(`page[number]=1`·`2`, `page[size]=3` - 씨앗 여섯 행에서 2쪽에 끝에 닿았다). 언어 협상의 두
본문은 같은 오류(`VALIDATION_ERROR`, `source.pointer` 는 `/data/attributes/title`)이고 문구만 갈렸다 - ko 는
`유효하지 않은 요청`·`요청 값이 유효성 검사를 통과하지 못했습니다.`, en 은 `Invalid request`·`A request value failed
validation.` 이다(개발 실행 - `4a85714` 앞의 APK - 뒤 기기 화면에서 읽었다).

**로그인 이동과 복귀.** `contract-lab-signed-in` 이 로그인하지 않은 채 PUT upsert 를 눌러 로그인 화면에 닿았고,
로그인한 뒤 실험실로 돌아와(`next=/contract`) 같은 실험을 201·200 으로 돌렸다. 실험실의 헤더는 루트 스택의 기본
헤더(뒤로 가기와 제목 "계약 실험실")이고 로그아웃 버튼은 없다 - 같은 화면에서 봤다. 두 플로는 그 앞의 개발 실행(두
플로만)과 `251b243` 의 게이트에서도 고치지 않고 통과했고, 가드의 표식과 접근 로그의 요청이 위와 같았다.

**재지 않은 것.** iOS(D7 의 CI), NestJS·Rails 에서의 거울과 실험실(D7 의 매트릭스 - `test/contract/run.sh` 는 지금
FastAPI 프로파일만 띄운다).
