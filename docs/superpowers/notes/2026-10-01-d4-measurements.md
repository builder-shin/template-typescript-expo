# D4 실측 기록 (2026-10-01)

생성·수정·삭제와 관계 선택기(D4)를 기기에서 잰 것이다. 계획은
`docs/superpowers/plans/2026-09-30-d4-create-update-delete.md`. W1–W4 는 Task 5 가 적었다.

## W1 — 쓰기 E2E (기기)

**명령.** `E2E_AVD=Pixel_9_API_36 E2E_FORCE_BUILD=1 ./scripts/check.sh` 의 `[12/12] E2E`(`test/e2e/run-android.sh`) -
Pixel_9_API_36(Android 16, API 36), FastAPI 스택, 플로는 D2 의 일곱, D3 의 일곱, D4 의 넷(`examples-create`·`examples-edit`·
`examples-delete`·`examples-write-errors`). 백엔드의 access token 수명은 10초다(`E2E_ACCESS_EXPIRES_SECONDS` 의 기본값).
`E2E_FORCE_BUILD=1` 은 개발 중에 같은 빌드 입력으로 APK 를 만들어 둔 탓에 게이트가 빌드를 건너뛰지 않게 준 것이다. 게이트의 E2E
단계가 빌드 앞에 Metro 캐시를 비우고(`test/e2e/android.sh` 의 `clear_metro_cache` - D3 실측 L7) 데몬 없이 APK 를 만들었다(아래
"빌드"). 게이트는 `=== [1/12] typecheck ===` 부터 `=== 전부 통과 ===` 까지 지났다 - 단위 시험은 64 파일 1440 개다. 아래 수와
줄은 마지막 게이트(이 기록의 플로가 다 들어간 판)의 것이다. E2E 단계의 줄(계정 이름이 든 임시 디렉터리는 `<계정>` 으로 가렸다):

```text
Metro 캐시를 비웠다: C:\Users\<계정>\AppData\Local\Temp\metro-cache
To honour the JVM settings for this build a single-use Daemon process will be forked. …
BUILD SUCCESSFUL in 5m 30s
--- auth-links
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
=== E2E 통과 - 플로 18개 ===
```

**빌드.** 이 태스크의 APK 빌드 넷(개발 둘 - `BUILD SUCCESSFUL in 4m 59s`·`4m 46s`, 게이트 둘 - `5m 6s`·`5m 30s`)이 모두 Metro 캐시를
비운 뒤 지났다 - 번들 단계의 0xC0000005 는 나오지 않았다. 그 앞의 첫 게이트는 빌드에 닿기 전에, 짧은 경로 사본을 다시 만들려고 지난
사본을 지우다 멈췄다(`run-android.sh` 의 `stage_sources`):

```text
rm: cannot remove 'C:/t/e/android/app/build/intermediates/dex/release/mergeDexRelease/classes3.dex': Device or resource busy
rm: cannot remove 'C:/t/e/android/app/build/intermediates/dex/release/mergeDexRelease/classes4.dex': Device or resource busy
```

그 파일을 쥔 것은 지난 개발 빌드가 남긴 Gradle 데몬(9.3.1)이었다 - Java 프로세스는 그 데몬과 Kotlin 컴파일 데몬 둘뿐이었고, 배포본의
`gradle --stop`("1 Daemon stopped") 뒤에 같은 `rm` 이 지웠다. 앞의 개발 실행(같은 데몬이 산 채로 사본을 다시 만들었다)에서는
지워졌던 까닭은 재지 않았다. 고친 것: `android.sh build` 가 `./gradlew assembleRelease --no-daemon` 으로 빌드한다 - 빌드가 끝나면
Gradle 프로세스도 끝난다. 그리고 `stage_sources` 가 지우는 동안 사본의 표식(`.e2e-stage`)을 남긴다 - 첫 게이트는 표식부터 지운 뒤
멈춰서 다음 실행이 그 사본을 "하네스가 만든 사본이 아니다" 로 거절할 자리였다(표식은 손으로 되살렸다). 고친 게이트가 끝난 뒤에는
Java 프로세스가 하나도 남지 않았고, 그 빌드의 `mergeDexRelease/classes*.dex` 넷이 지워졌다. 마지막 게이트는 데몬 없이 만든 그 사본을
지우고 다시 만들었다 - 멈추지 않았다.

**`expo export` 의 139.** Task 4 의 수정 라운드에서 `expo export --clear --platform ios` 가 출력(`Exported: …`)을 다 쓴 뒤 프로세스가
끝날 때 한 번 exit 139 로 죽었다 - Metro 캐시를 비웠는데도(`--clear`), `TEMP`·`TMP` 를 따로 만든 디렉터리로 돌려 다른 Metro 와 캐시를
나누지 않았는데도다. 같은 명령의 진단용 재실행 둘은 exit 0 이었다. D1 실측 M1 의 관찰 8 은 `--clear` 를 준 10회가 모두 exit 0 이어서
캐시를 방아쇠로 짐작했는데, 캐시가 유일한 방아쇠는 아니다. D4 의 마지막 정리를 끝낸 트리에서 같은 격리로 돌린 android·ios 번들 둘은
exit 0 이었다.

**가드.** 선언한 실패 표식 - `examples-write-errors` 의 401 (1)·404 (4)·422 (1):

```text
[e2e-http] 422 POST /api/v1/examples VALIDATION_ERROR,VALIDATION_ERROR
[e2e-http] 404 GET /api/v1/examples/00000000-0000-4000-8000-00000000d4d4 RESOURCE_NOT_FOUND
[e2e-http] 404 PATCH /api/v1/examples/<id> RESOURCE_NOT_FOUND
[e2e-http] 404 GET /api/v1/examples/<id> RESOURCE_NOT_FOUND
[e2e-http] 404 DELETE /api/v1/examples/<다른 id> RESOURCE_NOT_FOUND
[e2e-http] 401 POST /api/v1/auth/refresh TOKEN_REVOKED
```

404 넷 가운데 둘째 GET 은 고치는 사이 없어진 자원의 저장(PATCH 404) 뒤다 - 저장이 "없다" 를 받아도 상세·목록을 무효화하므로
(`queries/writes.ts` 의 `updateResourceMutationOptions`) 그 화면이 상세를 다시 불렀고, 화면은 not-found 그대로다. `examples-delete` 는
상태 0 만 선언한다 - 비행기 모드의 둘(`[e2e-http] 0 POST /api/v1/auth/refresh NETWORK_ERROR`·`[e2e-http] 0 GET /api/v1/examples
NETWORK_ERROR`, 아래 "삭제 실패의 문구")뿐이고 404 는 없다 - 지운 자원의 상세를 다시 부르지 않았고 삭제가 두 번 나가지 않았다.
선언하지 않은 `examples-create`·`examples-edit` 의 표식은 0 이다.

**가드가 보낸 로그인 화면의 뒤로 가기.** `examples-create` 가 로그인하지 않은 채 목록의 "새로 만들기" 를 눌러 로그인 화면에
닿은 뒤 뒤로 가기를 눌렀고, 홈이 보였다(앱이 닫히지 않았다 - `components/app/back-to-home.ts`).

**가드가 보낸 로그인 화면의 "홈으로".** `examples-delete` 가 로그인하지 않은 채 수정 화면을 딥링크로 열어 로그인 화면에 닿은
뒤 헤더의 "홈으로"(`back-to-home-button`)를 눌렀고, 홈이 보였다 - iOS 에는 뒤로 가기 키가 없어 그 화면의 눈에 보이는 출구다(스펙
7.3 의 D4 정정). 그 화면은 루트에 혼자라 버튼이 그려진다(뒤로 갈 곳이 있으면 그리지 않는다 - `components/app/home-button.tsx`).

**수정 화면의 보호 판정.** 이어서 `examples-delete` 가 같은 딥링크를 다시 열어 로그인 화면에 닿았고, 로그인한 뒤 그 수정 화면으로
돌아왔다 - 가드는 라우트 모양(`/examples/[id]/edit`)으로 판정한다.

**저장 뒤 이동 - 스택에 상세가 없을 때.** `examples-edit` 가 로그인한 뒤 곧바로 수정 화면을 딥링크로 열어(스택에 상세가 없다)
고치지 않고 저장했다 - 상세가 그 자원을 그렸고, 뒤로 가기는 홈에 닿았다(`edit.tsx` 의 `dismissTo` 가 수정 화면을 상세로 바꿨다 -
수정 화면이 상세 아래에 남았으면 폼이 나온다). 쌓인 상세가 있을 때는 같은 플로의 다음 저장들이 잰다(아래 표의 2).

**이동 가드의 풀림.** 다시 앞에 온 화면의 버튼이 또 동작했다 - `examples-create` 는 만든 뒤 돌아온 목록에서 "새로 만들기" 를,
`examples-edit` 는 저장 뒤 돌아온 상세에서 "수정" 을 다시 눌러 그 화면을 열었다(`useNavigateOnce` 는 누른 화면이 다시 앞에 오면
푼다). 같은 목록 화면에서 행을 두 번째로 누른 것도 같은 플로다.

**삭제 실패의 문구.** `examples-delete` 가 비행기 모드를 켜고 삭제를 확인했다 - 시트가 닫히지 않고 그 안에 앱 문구(`form-banner`)를
그렸다. 취소하고 다시 열자 문구가 없었다(`DeleteWrite.reset`). 기기 로그에는 회전의 `[e2e-http] 0 POST /api/v1/auth/refresh` 만 있고
DELETE 의 줄은 없다 - 회전이 닿지 못해 세션 관리자가 돌려준 access 가 이미 만료돼(로그인 뒤 10초가 넘었다) 쓰기가 보내지
않았다(`lib/resources/write.ts` 의 만료 가드 - 보냈으면 `0 DELETE` 줄이 남는다). 세션은 그대로였다 - 연결을 되살린 뒤의 삭제는 회전
200 과 DELETE 204 로 지났다. 연결이 돌아온 것은 아직 읽지 않은 목록(씨앗의 `probe-seed`, 읽기만 한다)을 열어 확인했다 - 그 첫 GET 은
닿지 못했고(`0 GET /api/v1/examples`) 네트워크 복귀의 재조회가 행을 그렸다.

**Task 4 리뷰가 꼽은 기기 위험.** 아홉을 플로의 단계와 대조했다:

| 위험                                                   | 잰 곳                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. 삭제 뒤 `popTo('examples/index', …, { merge: true })` | `examples-delete` - 목록에서 들어간 수정 화면은 같은 조건의 빈 목록(`list-empty` - 그 뒤의 목록 GET 이 이 실행의 접두사를 단다), 딥링크로 연 수정 화면은 조건 없는 목록(`examples-screen` - 조건 없는 목록 GET). 이름이 어긋났으면 수정 폼에 남는다                                       |
| 2. 저장 뒤 `router.dismissTo`                          | `examples-edit` - 쌓인 상세가 새 값을 그렸고(첫 수정 저장 뒤의 `detail-heading`·값·배지), 딥링크로 연 목록 밖 행의 저장은 상세가 그 자원을 그렸고, 스택에 상세가 없는 저장은 수정 화면을 상세로 바꿨다(위)                                                                    |
| 3. `useNavigateOnce` 의 풀림·두 번 누름                | 위의 "이동 가드의 풀림", 두 번 누름은 W4                                                                                                                                                                                                                                    |
| 4. Android 키보드                                      | `examples-create`·`examples-write-errors` - 제목·설명(여러 줄)·점수(숫자 자판)를 친 뒤 제목 라벨을 눌렀고, 그 아래의 선택기(세로 1510·1736px)와 제출(1893px)이 눌렸다. 키보드가 가리는 정도 자체는 재지 않았다                                                              |
| 5. `Modal` 안 요소                                     | `relationship-option-*`(이름과 함께)·`relationship-none-category`·`relationship-done-tags`·`relationship-truncated-category`·`relationship-unlisted-*`, `delete-confirm-accept`·`-cancel`, 시트 안의 `form-banner`. 트리거 안의 `relationship-value-<관계>-<위치>` 글자도 순서대로 읽혔다. 시트 자체의 testID 는 단언하지 않았다 - 그 안의 요소로 잰다 |
| 6. 실패 플로                                           | 422 의 필드 오류는 `scrollUntilVisible` 로 찾는다(`examples-write-errors`). 삭제 실패 문구가 취소 뒤 지워지는 것은 위의 "삭제 실패의 문구"                                                                                                                                  |
| 7. 첫 조회 5xx 의 "다시 시도"                          | 재지 못한다 - 아래 "재지 않은 것"                                                                                                                                                                                                                                           |
| 8. 도구 줄 폭                                          | 이 AVD(1080px - 411dp, 글자 크기 기본)에서만 - "새로 만들기" 는 `(916, 357)` 에서 눌렸다. 360dp·큰 글자는 재지 않았다                                                                                                                                                        |
| 9. iOS                                                 | 재지 못한다 - E2E 는 Android 뿐이다(D7 의 CI)                                                                                                                                                                                                                               |

이 위험들(Task 4 가 처음 만든 화면이 기기에서 처음 돈 것)에서 플로가 실패한 적은 없다 - 브리프의 판이 첫 실행부터 지났고, 위의 단계를
더한 판도 그랬다.

**재지 않은 것 - 일시적 실패 배너의 "다시 시도".** 첫 조회가 판정하지 않은 응답(5xx·408·429)을 받았을 때 배너 아래에 붙는
"다시 시도"(`components/app/request-failed.tsx` 의 `FailureBanner`, `retryable`)는 기기에서 일으키지 않았다. 이 스택에는 첫 GET 이
그런 상태를 받게 할 결정적인 길이 없다 - FastAPI 에는 그 상태를 내는 스위치나 요청 제한이 없고, 플로는 호스트의 셸을 부를 길이
없어 컨테이너를 멈추지 못하며(D3 실측 L7 의 "`docker pause` 를 쓰지 않은 까닭"), 프록시나 고장 주입기를 더하는 것은 이 계획
밖이다. 판단은 `test/unit/resources/screen-state-unjudged.test.ts`(목록·상세·참조 목록의 `retryable`)가 잰다.

## W2 — 회전의 실제 왕복 (기기)

D2 의 결정 5 가 넘긴 것이다 - 회전은 단위 시험만 쟀고, 기기에서 실제로 돈 적이 없었다.

**쓰기마다 회전한다.** 각 플로의 백엔드 접근 로그(`.maestro-output/e2e/<플로>/api.log`)에서 센 회전 요청과 쓰기 요청이다. 하네스는
로그를 플로 시작 5초 앞에서 자르므로(D3 실측 L5) 앞 플로의 끝 줄이 섞인다 - 그래서 이 플로의 첫 요청(스크립트의 가입) 줄부터
센다:

```text
$ own() { awk 'index($0, "POST /api/v1/auth/register") { on = 1 } on' ".maestro-output/e2e/$1/api.log"; }
$ # 플로마다 own <플로> | grep -c '<요청>'
examples-create       refresh=1 login=1 POST201=1 POST401=0 POST422=0 PATCH=0 DELETE=0
examples-edit         refresh=4 login=3 POST201=2 POST401=1 POST422=0 PATCH=4 DELETE=0
examples-delete       refresh=2 login=3 POST201=2 POST401=1 POST422=0 PATCH=0 DELETE=2
examples-write-errors refresh=6 login=4 POST201=2 POST401=0 POST422=1 PATCH=1 DELETE=3
```

- `examples-create` - 앱의 쓰기 하나(POST 201) 앞에 회전 하나. 로그인 하나는 앱의 것이다(스크립트는 가입만 한다).
- `examples-edit` - 앱의 저장 넷(PATCH - 딥링크로 연 수정 화면의 저장 하나와 목록에서 들어간 저장 셋)이 각각 회전을 지났다. POST 201
  둘은 스크립트(`STEP=example`·`unlisted`)의 것이라 회전하지 않는다 - 스크립트의 토큰도 10초라 `unlisted` 가 401 을 한 번 받고 다시
  로그인했다(POST 401 하나, 로그인 셋 가운데 둘이 스크립트의 것).
- `examples-delete` - 앱의 삭제 둘이 각각 회전을 지났다. 비행기 모드의 회전은 서버에 닿지 않아 이 수에 없다(W1 의 "삭제 실패의
  문구"). 스크립트의 행 둘(POST 201)과 그 401·재로그인은 위와 같다.
- `examples-write-errors` - 회전 여섯 가운데 넷이 앱의 것(422 의 POST, 404 의 PATCH·DELETE, 끊긴 세션의 회전)이고 둘은
  스크립트의 `STEP=revoke` 다(회전 한 번과 폐기된 refresh 의 재사용 한 번). DELETE 셋 가운데 둘은 스크립트의 `STEP=delete` 다.

브리프의 명령(파일 전체를 센다)은 이 게이트에서 `examples-create refresh=1 post=1 patch=0`·`examples-edit refresh=5 post=3 patch=4`
였다 - edit 의 회전 하나는 앞 플로(`examples-delete`)의 마지막 삭제 앞의 회전이고, POST 하나는 스크립트의 401 이다.

**끊긴 세션.** `examples-write-errors` 의 `STEP=revoke` 뒤 앱의 회전이 401 `TOKEN_REVOKED` 를 받았고(위 기기 로그의 마지막 줄), 앱은
기기 세션을 지우고 `next` 를 실어 로그인으로 갔다. 다시 로그인하자 생성 화면으로 돌아왔다.

**회전에서 쓰기까지의 시간.** 게이트 동안 백엔드 로그를 시각과 함께 따로 받았다(`docker logs -t`, 읽기만). 앱의 회전 응답에서 그
뒤 쓰기의 응답까지 - 열 가운데 일곱이 527–555ms(POST 201, PATCH 200 셋, DELETE 204 둘, DELETE 404), 셋이 53–67ms(PATCH 200 - 딥링크로
연 수정 화면의 저장, PATCH 404, POST 422)였다. 앞의 게이트와 변이 실행에서도 같은 두 갈래였다(반 초 쪽 516–544ms, 짧은 쪽 18–31ms).
어느 갈래가 될지는 쓰기의 성공·실패로 갈리지 않는다(DELETE 404 는 반 초였다). 스크립트의 쓰기(POST 201)는 로그인 응답 뒤 6–37ms 다.
반 초가 앱(회전한 세션을 저장소에 쓰고 돌려준다 - `lib/auth/session-manager.ts`)에서 오는지 백엔드에서 오는지는 재지 않았다. W4 의
두 번 누름이 무엇을 재는지가 이 시간에 달렸다.

**닿지 못한 회전과 만료 가드.** 회전이 닿지 못하면(비행기 모드) 세션 관리자는 세션을 지우지 않고 지금의 access 를 돌려준다 - 그
access 가 이미 만료됐으면 쓰기는 보내지 않고 앱 문구로 알린다(`lib/resources/write.ts` 의 만료 가드). 이것이 D4 계획 결정 11 의 남는
틈(access 가 만료된 채 회전이 판정을 못 받으면 쓰기의 401 이 세션을 지운다)을 닫은 길이다. 기기에서 그 길을 지났다 - W1 의 "삭제
실패의 문구"(DELETE 를 보내지 않았고 세션이 남아 다음 삭제가 지났다).

**재지 않은 것.** 회전 응답의 5xx(스펙 7.2 의 D4 정정)는 기기에서 일으키지 않았다 - 단위 시험(`test/unit/auth/rotation.test.ts`)이
잰다. 5xx 에서도 만료 가드의 길은 위와 같다(`test/unit/resources/write.test.ts` 의 "만료 가드"). iOS(D7 의 CI), NestJS·Rails 에서의
쓰기(D7 의 매트릭스).

## W3 — 쌓인 화면의 재조회 (기기, D3 최종 검토 M2)

화면의 조회는 `subscribed: useIsFocused()` 를 준다(`queries/resources.ts`) - 쌓인 화면은 앱 복귀·네트워크 복귀·무효화의 재조회를
부르지 않고, 다시 앞에 오면 다시 구독하며 부른다(스펙 8.5 의 D4 정정). 두 플로의 백엔드 접근 로그에서 이 실행의 목록 GET 을
셌다(W2 의 `own` 처럼 이 플로의 가입 줄부터):

```text
$ own examples-scroll-refresh | awk 'index($0, "GET /api/v1/examples/") { seen = 1 } seen && index($0, "GET /api/v1/examples?") && index($0, "probe-d3-") { n++ } END { print "scroll-refresh list-after-detail=" n + 0 }'
scroll-refresh list-after-detail=2
$ echo "delete list=$(own examples-delete | grep 'GET /api/v1/examples?' | grep -c '=d4-')"
delete list=2
```

- `examples-scroll-refresh` - 상세에 처음 들어간 뒤의 목록 GET 이 둘이다: 상세에서 돌아온 목록이 다시 구독하며 읽어 둔 두 쪽을
  다시 읽었다(구독이 살아 있던 D3 의 판이면 0 - D3 실측 L5 의 요청 순서). 다시 읽기가 이름 바꾸기(`STEP=rename`)보다 먼저 끝나
  행은 옛 제목이었다 - 플로는 어느 쪽이든 누른다.
- `examples-delete` - 목록에서 상세로 들어가 앱을 뒤로 보냈다 불러왔다. 목록 GET 은 처음 열 때와 지우고 돌아왔을 때의 둘이다 -
  쌓인 목록은 앱 복귀와 삭제 뒤 무효화에 다시 부르지 않았다(구독이 살아 있던 D3 의 판이면 셋이다). 앱 복귀에는 보이는 상세만 다시
  불렸다.

가입 줄부터 세는 까닭: 브리프의 명령은 파일 전체를 세어, 앞 플로의 끝 줄이 무엇이냐에 따라 수가 흔들린다. 이 게이트에서는
`scroll-refresh list-after-detail=2`·`delete list=3` 이었다 - delete 의 셋째는 앞 플로(`examples-create`)의 마지막 목록 GET 이다(그 실행의
접두사도 `d4-` 로 시작한다). 개발 실행 하나에서는 `scroll-refresh list-after-detail=8`(앞 플로의 상세 GET 에서 세기 시작했다)이었다.

## W4 — 빠른 두 번 누름 (기기, D2 최종 검토 M7·D3 최종 검토 M8)

**누르는 법.** Maestro 2.11 의 `tapOn` 에 `repeat: 2`·`delay: 1` 을 주면 같은 자리를 연달아 두 번 누른다 - 설치본
`maestro-orchestra`·`maestro-client` jar 를 `javap` 로 읽었다: 두 누름 사이에 화면이 멈추기를 기다리지 않고, `delay` 에서 첫
누름이 걸린 시간을 뺀 만큼만 잔다(1ms 면 곧바로). 명령 둘로 나눠 누르면 Maestro 가 명령마다 요소를 찾고(1.2–1.4초) 화면이 멈추기를
기다려(1–2초 - 디버그 `maestro.log` 의 시각) 두 누름이 한 요청 안에 들지 않는다. 둘째 누름은 첫 누름이 연 다음 화면의 같은 자리에
닿을 수도 있어서, 그 자리에 누를 것이 없는 곳만 골랐다:

| 플로                    | 두 번 누른 것                        | 막는 것                                | 첫 누름 뒤의 화면 |
| ----------------------- | ------------------------------------ | -------------------------------------- | ----------------- |
| `examples-create`       | 로그인 제출(자격증명 폼)             | 제출 버튼의 `disabled`·`useSubmitOnce` | 홈                |
| `examples-create`       | 목록의 "새로 만들기"                 | `useNavigateOnce`                      | 생성 화면         |
| `examples-edit`         | 목록의 행                            | `useNavigateOnce`                      | 상세              |
| `examples-delete`       | 삭제 확인(목록에서 들어간 둘째 삭제) | 확인 버튼의 `disabled`·`useSubmitOnce` | 빈 목록           |
| `examples-write-errors` | 저장 제출(고치는 사이 없어진 자원)   | 제출 버튼의 `disabled`·`useSubmitOnce` | not-found         |

게이트에서 센 것(W2 의 표): `examples-create` 의 로그인 1(계정은 스크립트가 가입만 한다), `examples-delete` 의 앱 DELETE 2(두
삭제 - 404 없음), `examples-write-errors` 의 PATCH 1. "새로 만들기"·행은 수가 아니라 플로가 잰다 - 화면이 둘 쌓이면 만든 뒤·저장
뒤의 뒤로 가기가 목록이 아니라 남은 화면에 닿아 다음 단언이 실패한다.

**가르는가 - 변이 실험.** 가드를 끈 APK 로 같은 플로를 돌렸다. 저장소 밖의 사본(스크래치)에서 가드를 끈 JS 를 Gradle 의 번들
단계와 같은 명령(`expo export:embed` → `hermesc -O -output-source-map`)으로 묶어, 게이트 전 개발 실행의 APK(`3627679`)에서
`assets/index.android.bundle` 만 바꾸고 같은 디버그 키로 서명했다. 하네스는 `E2E_STAGE_DIR` 로 그 APK 를 받아 빌드 없이
설치했다(빌드 지문이 같다). 백엔드 로그는 시각과 함께 따로 받았다. 칸은 두 번 누른 그 자리의 결과다:

| 변이                                                                                   | 로그인     | "새로 만들기" | 행          | 삭제 확인          | 404 저장    |
| -------------------------------------------------------------------------------------- | ---------- | ------------- | ----------- | ------------------ | ----------- |
| 없음(게이트)                                                                           | 요청 1     | 화면 하나     | 화면 하나   | DELETE 1           | PATCH 1     |
| 넷을 끔(`submitOnce` 의 진행 중 검사, 제출·확인 버튼의 `disabled`, `useNavigateOnce`) | **요청 2** | **화면 둘**   | **화면 둘** | **DELETE 2**(404)  | PATCH 1     |
| `submitOnce` 의 진행 중 검사만 끔                                                      | 요청 1     | 화면 하나     | 돌리지 않음 | DELETE 1           | 돌리지 않음 |

- 넷을 끈 APK 에서 `examples-create` 는 만든 뒤의 뒤로 가기가 빈 생성 화면("Example 만들기" 의 빈 폼)에 닿아 실패했고,
  `examples-edit` 는 저장 뒤의 뒤로 가기가 또 하나의 상세에 닿아 실패했고, `examples-delete` 는 둘째 DELETE 의 404 가 선언하지
  않은 상태라 가드에 걸렸다. 로그인 요청은 둘이었다(응답 사이 11ms). 이 넷의 측정은 가드가 빠지면 실패한다.
- 404 저장 자리는 가드를 다 꺼도 PATCH 가 하나였다 - 회전 응답 뒤 18ms 에 404 가 왔고(게이트에서는 26·53ms - W2 의 시간) 둘째 누름은
  그 뒤 not-found 화면에 닿았다. 이 자리는 가르지 못한다. 자원 폼과 자격증명 폼은 같은 제출 버튼(`components/form/submit-button.tsx`)과
  같은 가드(`useSubmitOnce`)를 쓴다 - 제출의 측정은 로그인 자리가 맡는다.
- 삭제 확인 자리가 가르는 것은 쓰기가 반 초 걸렸기 때문이다(넷을 끈 APK 의 회전 뒤 523ms, 게이트 531·537ms). 그 시간이 둘째 누름보다
  짧아지면 이 자리도 가르지 못한다 - 실패로 바뀌지는 않는다(둘째 누름이 빈 목록에 닿는다).
- `submitOnce` 만 끈 APK 는 두 자리 모두 요청이 하나였다 - 둘째 누름이 닿을 때 버튼은 이미 진행 중으로 다시 그려져 `disabled`
  다. 기기의 두 번 누름은 `useSubmitOnce` 를 `disabled` 와 갈라 재지 못한다. 한 틱 안의 두 제출(제출 버튼과 키보드의 이동 키)은
  `test/unit/queries/submit-once.test.ts` 가 잰다.
- 덤으로 잰 것: 넷을 끈 APK 의 두 삭제는 회전 하나를 같이 썼다(회전 한 번 뒤 DELETE 둘, 응답 사이 9ms) - 세션 관리자의 "동시
  호출에 회전 한 번"(D2 결정 5 의 단위 시험 항목)이 기기에서도 그랬다.

**재지 않은 것.** 생성 폼의 "만들기" 제출 - 상세가 그려진 뒤에 닿은 둘째 누름은 같은 자리의 "수정" 을 누른다(1080×2424 화면에서
제출을 누른 자리는 `(540, 1893)`, 같은 모양의 상세에서 "수정" 버튼은 세로 1793–1895 다 - 캡처에서 잰 값). 이 스택에서는 쓰기가 반
초라 둘째 누름이 그 앞에 닿겠지만, 그
시간이 앱과 백엔드에 달려 있어(W2) 다른 백엔드(D7 의 매트릭스)에서 플로가 흔들릴 수 있어 누르지 않았다. 키보드의 이동 키와 제출
버튼을 함께 누르는 것 - 자원 폼은 키보드로 제출하지 않는다(`onSubmitEditing` 이 없다). 자격증명 폼은 비밀번호의 이동 키가 제출이지만
`pressKey`·`tapOn` 은 서로 다른 명령이라 위의 기다림 때문에 둘이 한 요청 안에 들지 않는다.
