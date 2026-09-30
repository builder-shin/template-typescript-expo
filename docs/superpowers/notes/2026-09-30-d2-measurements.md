# D2 실측 기록 (2026-09-30)

D2(세션과 인증)를 구현하며 잰 것이다. 명령과 출력을 함께 적는다.

## H1 — 세 백엔드의 캐시 머리글

**왜 재는가.** SDK 57 의 전역 `fetch`(`expo/fetch`)는 네이티브 HTTP 캐시(Android OkHttp·iOS URLCache)를
거치고, 그 캐시는 요청의 `cache` 옵션이 아니라 응답 머리글을 따른다(D1 실측 기록 M6 의 소스 확인,
`lib/jsonapi/client.ts` 는 `cache` 를 넘기지 않는다). 앱은 `GET /users/me` 를 부르지 않는다(스펙 7.4) -
인증된 GET 을 처음 더하는 계획과 목록·상세의 신선도를 확인하는 D3 가 이 기록을 읽는다.

**명령.** D2 계획 Task 6 Step 5 의 명령이다(세 프로파일을 하나씩 띄워 가입·로그인한 뒤 `GET
/api/v1/users/me`(Bearer), `/api/v1/examples`, `/api/v1/examples/<첫 id>` 의 응답 머리글을 받았다).

**출력.**

```text
== fastapi GET /api/v1/users/me
HTTP/1.1 200 OK
== fastapi GET /api/v1/examples
HTTP/1.1 200 OK
== fastapi GET /api/v1/examples/33330000-0000-4000-8000-00000000000a
HTTP/1.1 200 OK
== nestjs GET /api/v1/users/me
HTTP/1.1 200 OK
ETag: W/"152-4nYyk4ZT5BrII89DbAJE1bkaXGk"
== nestjs GET /api/v1/examples
HTTP/1.1 200 OK
ETag: W/"1359-kATE1Gm4y0gr6/UUM/pP+nLJ/HE"
== nestjs GET /api/v1/examples/33330000-0000-4000-8000-00000000000a
HTTP/1.1 200 OK
ETag: W/"2e2-IUNd7dbkEa4Ue7ssFilHZpfQc00"
== rails GET /api/v1/users/me
HTTP/1.1 200 OK
vary: Accept, Origin
etag: W/"c4743f7075e6dc24f2beb28a41fe0b6a"
cache-control: max-age=0, private, must-revalidate
== rails GET /api/v1/examples
HTTP/1.1 200 OK
vary: Accept, Origin
etag: W/"92c0406dd5249c574e541c17db6adc54"
cache-control: max-age=0, private, must-revalidate
== rails GET /api/v1/examples/00000000-0000-4000-8000-000000000003
HTTP/1.1 200 OK
etag: W/"3f493d7557efffbb48d5aeda9c046729"
cache-control: max-age=0, private, must-revalidate
vary: Origin
```

세 프로파일 모두 떴다(`up -d --build --wait` exit 0). NestJS 프로파일은 이 저장소에서 처음 띄웠고, 이미지를
GitHub `main` 에서 새로 빌드해 `--wait` 가 끝나기까지 33초가 걸렸다. FastAPI 응답에는 위 목록의 머리글이 하나도
없다(받은 머리글은 `date`·`server`·`content-type`·`content-length` 넷이다). 앞뒤의 `joon-*` 컨테이너는 9개,
끝난 뒤 이 저장소의 compose 프로젝트 컨테이너는 0개였다.

**판정.** 세 백엔드 모두 이 세 응답에 신선도 수명을 주지 않는다 - 네이티브 캐시가 저장하더라도 다음 요청은 서버에 가서 검증받는다(`ETag`가 있으면 표현이 다를 때 새 본문이 온다). 로그아웃 뒤 다른 사용자로 로그인한 앱이 앞 사용자의 응답을 받을 길이 없다.

**기기에서 재지 않은 것.** 네이티브 캐시가 이 머리글대로 저장·재검증하는지는 기기에서 재지 않았다 -
D2 앱의 요청은 전부 POST 라 네이티브 캐시가 저장하지 않는다. 앱에 GET 이 생기는 D3 가 잰다.

## H2 — 앱별 언어와 소프트 키보드

환경은 D1 실측과 같은 에뮬레이터 `Pixel_9_API_36`(Android 16, `sdk_gphone64_x86_64`)이다. 켜진 입력기는 Gboard
(`com.google.android.inputmethod.latin/com.android.inputmethod.latin.LatinIME`, 기본)와 Google 음성 입력
(`com.google.android.tts/…/VoiceInputMethodService`) 둘이고 Gboard 의 언어는 `English (US)` 하나다.

**증상.** 첫 E2E 실행에서 `login-error-ko`(앱별 언어 ko-KR)만 실패했다. 폼 위 배너를 기다리다 끝났고, 기기 로그의 실패
표식은 선언한 401 이 아니라 422 였다.

```text
Assert that id: form-banner-message is visible... FAILED
I/ReactNativeJS(22687): [e2e-http] 422 POST /api/v1/auth/login VALIDATION_ERROR
```

실패 스크린숏의 이메일 칸 끝부분은 `@ㅔ개ㅠㄷ.ㄷㅌ므ㅔㅣㄷ` 다 - `@probe.example` 을 두벌식 자판으로 친 것이다(p→ㅔ,
r·o→개, b→ㅠ, e→ㄷ, x→ㅌ, a·m→므, l→ㅣ). 숫자·`-`·`@`·`.` 는 그대로 들어갔다. 같은 실행의 `login-error-en`(en-US)은
통과했다.

**원인 1 - Gboard 가 앱별 언어를 따른다.** 그 실행의 기기 로그(Maestro 디버그 출력의 `device-logcat.txt`)다. 입력 칸에
초점이 가자 Gboard 가 앞에 뜬 앱의 언어를 임시로 켜고 현재 자판을 두벌식으로 바꿨다. `hintLocales` 는 비어 있다 - 앱이 준
힌트가 아니라 앱별 언어를 읽은 것이다.

```text
I/GoogleInputMethodService( 1344): GoogleInputMethodService.onStartInput():1293 onStartInput(EditorInfo{EditorInfo{packageName=com.example.templateexpo.e2e, inputType=80021, inputTypeString=EmailAddress[NoSuggestion], … hintLocales=[]}}, false)
I/InputMethodEntryManager( 1344): InputMethodEntryManager.enableLanguagesAndChangeCurrentTemporarily():1811 enabledLanguages: [ko-Kore-KR], specifiedCurrentLanguage null
I/InputMethodEntryManager( 1344): InputMethodEntryManager.enableInputMethodEntriesTemporarily():2031 temporarilyEnabledEntryTuples [LanguageTagVariantTuple{languageTag=ko-KR, variant=korean_two_bulsik}]
I/InputMethodEntryManager( 1344): InputMethodEntryManager.changeCurrentInputMethodEntry():2958 Set current input method entry: source=UNSPECIFIED, entryChanged=true, kek{languageTag=ko-KR, variant=korean_two_bulsik, …
I/KeyboardWrapper( 1344): KeyboardWrapper.activateKeyboard():562 activateKeyboard(): type=prime, status=0, imeDef=kyj{stringId=ime_ko_two_bulsik, language=ko, … keyEventInterpreter=com.google.android.apps.inputmethod.libs.korean.KoreanKeyEventInterpreter, …
```

**원인 2 - Maestro 의 `inputText` 는 키 이벤트다.** Maestro 2.11.0 의 기기 쪽 서버(`~/.maestro/lib/maestro-client.jar` 안의
`maestro-server.apk`)를 `dexdump -d` 로 풀면 `dev.mobile.maestro.Service.inputText` 가 글자마다 `setText` 를 부르고, `setText` 는
글자를 키 코드로 바꿔 `androidx.test.uiautomator.UiDevice.pressKeyCode`(시프트가 필요한 글자는 `keyPressShiftedToEvents`)로
누른다 - 입력 칸에 글자를 직접 쓰는 호출은 없다. 그래서 현재 자판의 키 해석기(위 `KoreanKeyEventInterpreter`)가 글자를
조합한다. `pasteText` 도 우회로가 아니다 - `maestro-orchestra.jar` 의 `Orchestra.pasteText` 는 복사해 둔 문자열로
`Maestro.inputText` 를 부른다(`javap -c`).

**입력기를 모두 끄는 길은 막혔다.** `adb shell ime disable` 로 둘을 끄면 `ime list -s` 가 비고 `default_input_method` 도
빈다. 그 상태로 같은 플로를 돌리자 이메일이 다시 자모로 깨졌다(`[e2e-http] 422 POST /api/v1/auth/login VALIDATION_ERROR`).
플로가 앱을 띄운 직후 기기 로그에 `Settings changed for uri: content://settings/secure/enabled_input_methods` 와 Gboard 의
`attachToken()` 이 찍혔다 - 누가 Gboard 를 다시 켰다. 입력기를 끈 채 `am start` 로 앱만 띄우면 6초 동안 `ime list -s` 가 빈
채로 남았다. Maestro 는 세션마다 기기에 드라이버 앱을 설치하고 닫을 때 지운다(`maestro-client.jar` 의
`AndroidDriver.installMaestroApks` · `uninstallMaestroDriverApp`, `--no-reinstall-driver` 를 주지 않으면). 그 패키지 변경이
입력기 목록을 다시 만들게 해 시스템이 기본 키보드를 켠 것으로 보인다 - 그 연결은 재지 않았다.

**키보드 자판이 없는 입력기를 기본으로 두면 된다.** Gboard 를 켠 채 `adb shell ime set <음성 입력>` 으로 바꾸고, 앱별 언어를
ko-KR 로 정한 앱의 로그인 이메일 칸에 `inputText` 로 `probe-e2e-ime-12ab@probe.example` 를 넣었다. 스크래치 플로(`inputText`
뒤 `assertVisible` 로 이메일 칸의 글자를 `probe-e2e-ime-.*@probe\.example` 로 단언)가 exit 0 이었고 스크린숏의 칸에는 그
문자열이 그대로 있었다. 키보드는 화면에 그려지지 않았다. Maestro 세션이 끝난 뒤에도 기본 입력기는 음성 입력 그대로였다 -
Gboard 가 켜져 있으니 시스템이 기본 키보드를 다시 고르지 않는다.

**정한 것.** `test/e2e/run-android.sh` 는 앱별 언어를 정한 플로(`# e2e-app-locale:`) 동안 켜진 입력기 가운데 키보드 자판
(`ime list` 의 subtype `mSubtypeMode=keyboard`)이 하나도 없는 첫 입력기를 기본 입력기로 두고, 플로가 끝나면(하네스가 도중에
끝나도 EXIT 에서) `enabled_input_methods`·`default_input_method`·`selected_input_method_subtype` 을 적어 둔 값으로 되돌린다.
그런 입력기가 없는 기기에서는 로캘 플로가 그 사실을 알리고 실패한다. 다른 플로는 Gboard 를 둔 채 돈다. 고친 하네스로
`E2E_FLOW="login-error-en login-error-ko register-invalid"` 가 exit 0 이었다 - 두 로캘 플로의 기기 로그에는
`[e2e-http] 401 POST /api/v1/auth/login INVALID_CREDENTIALS` 가 하나씩 있고, 입력기를 되돌린 뒤에 돈 `register-invalid` 는
Gboard 로 쳐서 422 까지 갔다. 끝난 뒤의 설정 셋은 실험 전과 같다.

```text
enabled_input_methods=com.google.android.inputmethod.latin/com.android.inputmethod.latin.LatinIME;1594443099:com.google.android.tts/com.google.android.apps.speech.tts.googletts.settings.asr.voiceime.VoiceInputMethodService
default_input_method=com.google.android.inputmethod.latin/com.android.inputmethod.latin.LatinIME
selected_input_method_subtype=1594443099
```

**재지 않은 것.** 음성 입력이 없는 에뮬레이터 이미지(CI 가 고를 이미지), iOS 시뮬레이터의 키보드, 드라이버 설치와 입력기
재활성화의 인과.

## H3 — 가드 뒤 로그인 복귀와 뒤로 가기

**왜 재는가.** D2 최종 리뷰가 설치된 expo-router 57.0.24 의 소스로 판독했다. 경로 가드의 `<Redirect>`(replace)가 루트의
`(app)` 을 로그인 화면으로 바꿔 끼우고, 로그인 뒤 `router.dismissTo(next)`(POP_TO)는 `(app)` 을 새로 만드는데 `withAnchor` 가
없으면 앵커(`unstable_settings.anchor` - 홈)를 싣지 않는다 - 복귀한 화면에서 뒤로 가면 앱이 닫힌다는 판독이다.
`app/(app)/_layout.tsx` 의 주석과 D2 계획 결정 18 은 그 반대를 적었다. 그때까지의 플로는 뒤로 가기를 한 번도 누르지 않았다.

**명령.** `test/e2e/flows/guard-return.yaml`(보호 경로 → 로그인 → `new-example-screen` 으로 복귀) 끝에 `pressKey: back` 과
`home-screen` 대기를 더하고, 확인하는 동안만 뒤로 가기 앞에 스크린숏 단계(`takeScreenshot`)를 하나 두었다.
`E2E_FLOW=guard-return ./test/e2e/run-android.sh` - 플로는 APK 지문 밖이라 빌드 없이 돈다.

**출력 - 고치기 전.**

```text
Assert that id: logout-button is visible... COMPLETED
Take screenshot guard-return-before-back... COMPLETED
Press Back key... COMPLETED
Assert that id: home-screen is visible... FAILED
```

뒤로 가기 앞의 스크린숏은 `Example 만들기` 화면이다 - 헤더에 뒤로 화살표가 없고(스택에 그 화면 하나뿐이다) 키보드는 내려가
있다. 실패 스크린숏은 Android 런처다 - 뒤로 가기가 앱을 닫았다. 판독이 맞았다.

**고친 것.** `app/(auth)/login.tsx`·`app/(auth)/register.tsx` 의 `router.dismissTo(target)` 을
`router.dismissTo(target, { withAnchor: true })` 로 바꿨다. 하네스가 APK 를 다시 만들었다(`BUILD SUCCESSFUL in 4m 7s`,
`APK 의 앱 설정: extra.appVariant=e2e`).

**출력 - 고친 뒤.**

```text
Take screenshot guard-return-before-back... COMPLETED
Press Back key... COMPLETED
Assert that id: home-screen is visible... COMPLETED
Assert that id: logout-button is visible... COMPLETED
```

뒤로 가기 앞의 헤더에 뒤로 화살표가 생겼다 - 홈이 아래에 깔렸다. 확인용 스크린숏 단계는 지우고 뒤로 가기와 홈 단언은
플로에 남겼다.

**재지 않은 것.** 가드가 보낸 로그인 화면 자체에서의 뒤로 가기(루트가 `[(auth)/login]` 하나라 앱이 닫힌다 - D4 로 넘겼다,
`2026-10-01-d2-carry-forward.md`), iOS.
