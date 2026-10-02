# test/e2e/ 작업 지침

Maestro 플로, E2E 하네스, SQL 시드가 산다(스펙 4장·11.3·11.4). 게이트의 E2E 단계는
`test/e2e/run-android.sh` 하나다. 세 백엔드와 iOS 는 CI 가 같은 플로로 돈다(스펙 13장 - 아래 "두 플랫폼"·"백엔드
매트릭스"·"iOS" 절).

## 플로를 쓸 때

- 파일 하나가 시나리오 하나다. `flows/*.yaml`은 하네스가 전부 돈다. 여러 플로가 쓰는 단계는
  `subflows/`에 두고 `runFlow`로 부른다.
- 머리말 주석으로 하네스에 선언한다: `# e2e-allow-http: <상태>...`(일부러 일으키는 2xx 밖의
  상태 - 선언하지 않은 상태가 기기 로그에 나오거나 선언한 상태가 한 번도 나오지 않으면 실패다),
  `# e2e-app-locale: <태그>`(앱별 언어), `# e2e-platforms: <플랫폼>...`(그 플로가 도는 플랫폼 - 아래 "두
  플랫폼"). 앱의 줄(ReactNativeJS)이 하나도 없는 기기 로그도 실패다 - 로그를
  모으지 못한 것이다(`guard-log.sh`).
- `EMAIL`·`OTHER_EMAIL`(플로마다 새로 만든다 - `probe-email.ts`)과 `PASSWORD`가 env 로 들어온다.
  `OTHER_EMAIL`은 한 플로 안의 두 번째 사용자다. 실전 상수와 같은 값을 쓰지 않는다. 로캘 플로에는 머리말의
  값이 `APP_LOCALE` 로도 들어온다(iOS 의 실행 인자 - 아래 "두 플랫폼").
- 하네스는 `MAESTRO_CLI_NO_ANALYTICS=1`로 Maestro 의 사용 통계를 끄고, 플로마다 `--debug-output`으로
  기록을 따로 받는다.
- 화면 요소는 testID(`id:`)로 찾는다. 문구로 찾지 않는다 - 오류 문구는 백엔드가 협상한 언어다.
  유일한 OS 예외는 `subflows/confirm-ios-open-link.yaml`의 `Open` 텍스트 버튼이다(컨트롤러 D7-R16).
  iOS 26.5는 외부에서 연 사용자 정의 scheme에 `Open in “Template Expo (E2E)”?` 확인창을 띄우고,
  Maestro 2.11.0의 `IOSDriver.openLink`는 그 창을 처리하지 않는다. 모든 `openLink` 뒤에 이 서브플로를 부른다.
  iOS이고 정확한 제목이 보일 때만 누르고 제목이 사라졌는지 단언한다. 앱의 목적 화면 단언은 그대로다.
  OS 버튼에는 앱의 testID가 없다. 앱별 `AppleLanguages` 인자는 OS 영어 확인창과 별개다.
  `flows.test.ts`는 예외 파일의 명령 구조 전체를 고정한다: iOS와 정확한 제목을 조건으로 하는 runFlow 하나,
  그 안의 Open 누름 하나와 같은 제목의 부재 단언 하나뿐이다. 저장소 전체에서 직접 id가 없는 누름도 정확히
  이 하나여야 한다. 무조건/중복 누름·넓어진 제목·블록 밖 단언과 호출 누락을 거절한다.
  증거는 실측 K3의 실행 2 스크린샷·hierarchy다.
- 콜드 링크는 `cold-links`가 별도로 잰다(D7-R29). 앱 종료 뒤 보호 경로를 열어 로그인하고 원래 보호 화면에
  도착해야 하며 공개 없는 상세의 콜드 링크는 not-found여야 한다. warm `auth-links`와 로그아웃 가드는 그대로다.
  현재 흐름은 Android 23개, iOS 21개(비행기 모드 두 흐름 제외)이며 request-stall은 checks로 따로 돈다.
- D1 실측(M8·M3)에서 걸린 것: `evalScript` 값은 따옴표로 감싼다. `launchApp` 뒤에는 화면 요소를
  기다린 다음 `openLink`를 보낸다(직후의 딥링크는 버려진다). `console.log`는 콘솔이 아니라 디버그
  로그(`maestro.log`)에 남는다. 로캘 플로에는 `clearState`를 쓰지 않는다 - 앱별 언어가 지워진다.
- 정규식이 든 값은 작은따옴표로 감싼다 - YAML 의 큰따옴표는 `\s`를 이스케이프로 읽다 죽는다.
- 로캘 플로는 키보드 없이 돈다. Gboard 는 앱별 언어를 따라 자판을 바꾸고(ko-KR 이면 두벌식) Maestro 의
  `inputText`는 키 이벤트라서 라틴 글자가 한글 자모로 조합된다 - 하네스가 그 플로 동안 키보드 자판이 없는
  입력기(음성 입력)를 기본으로 두고 끝나면 되돌린다(D2 실측 H2). 키보드가 떠 있어야 뜻이 있는 단언은 로캘이
  없는 플로에 둔다.

## 목록·상세 플로

- 목록의 행은 testID 와 데이터 문구를 함께 준다(`id: resource-row-title` + `text: probe-seed alpha`). 행의 제목은
  백엔드의 데이터라 로캘과 무관하다 - 오류 문구와 다르다.
- iOS의 접근성 버튼은 자식 배지의 ID·문구를 개별 노드로 내지 않을 수 있다(K3 실행 3). 생성·수정의 현재 선택은
  `relationship-open-<관계>`의 `accessibilityValue.text`로 잰다 - 태그는 쉼표로 이은 전체 값의 순서를 단언하고,
  비운 선택도 부모의 `선택 안 함`을 단언한다. Android는 기존 `relationship-value-<관계>-<위치>`를 쓴다.
  목록의 두 번째 태그는 iOS의 `resource-row`와 행 전체 접근성 라벨로 찾는다 - charlie 행의 태그 둘을 각각 한 번만 허용한다.
  JSON:API의 to-many linkage 배열은 순서 의미를 보장하지 않는다. K3의 NestJS는 같은 행도 목록 URL에서 둘·하나,
  tags 단독 조회에서 하나·둘을 돌려줬다. 전체 라벨을 고정하고 태그 끝부분의 정확한 두 순열만 허용한다(D7-R26).
  폼에서 고른 순서와 앱이 받은 응답 순서를 보존하는 시험은 유지한다.
  상세 배지는 버튼 자식이 아니므로 기존 ID를 쓴다. 앱의 접근성 묶음을 풀거나 멤버 단언을 생략하지 않는다.
- 딥링크의 대괄호는 퍼센트 인코딩한다(`filter%5Btitle%5D%5Bcontains%5D=…`) - 앱이 만드는 주소와 같은 모양이다
  (`docs/superpowers/notes/2026-09-30-d3-measurements.md` 의 L1). 값의 `+`·`&`·`=`·`#`·한글도 인코딩한다(`%2B`·`%26`·
  `%3D`·`%23`, 한글은 UTF-8 바이트) - 인코딩하지 않은 `+` 는 공백으로, `&` 는 다음 파라미터로, `#` 는 조각으로
  읽힌다. `flows/examples-browse.yaml` 이 그런 값의 딥링크를 기기에서 잰다.
- `id:`·`text:` 의 값은 정규식이고 전체가 맞아야 한다. `id:` 는 정규식으로만 잰다 - testID 의 `.`
  (`filter-option-category.id-…`)은 아무 글자에나 맞으니 `\.` 로 적는다. `text:` 는 같은 문자열도 맞는 것으로
  치지만 `+` 같은 글자가 든 값은 `\+` 로 적는다(정규식으로도 맞게).
- 순서는 `below:` 로 잰다. 비교하는 두 정렬에서 **답이 갈리는 쌍**만 쓴다 - 둘 다에서 참인 쌍은 아무것도 재지
  않는다. 폰 화면에 행이 다섯 넘게 들어간다고 기대지 않는다.
- 조건을 바꾸면 새 목록 화면이 쌓인다. 옛 화면에도 있는 행을 먼저 기다리면 옛 화면에서 통과할 수 있다 - 옛 화면에만
  있는 것이 사라지기를 기다리거나(`notVisible`) 새 화면에만 있는 것(정렬 버튼의 라벨 `정렬, 점수 내림차순` 등)을
  기다린 뒤에 본다.
- `hideKeyboard` 를 쓰지 않는다 - Maestro 2.11.0 의 Android 구현은 뒤로 가기라 키보드가 없으면 시트를 닫는다. 입력이
  든 시트는 버튼을 머리 줄에 둔다.
- 행이 씨앗으로 모자라면 `runScript` 로 백엔드에 직접 만든다 - `scripts/examples-api.js`(`STEP=seed|create|rename`).
  스크립트는 호스트의 GraalJS 에서 돌고, 하네스가 넘기는 `API_URL`(호스트에서 백엔드에 닿는 주소)로 요청한다.
  앱을 지나지 않으므로 기기 로그의 가드에 걸리지 않는다. 만든 행의 제목은 `output.prefix`
  (`probe-d3-<이메일 끝 12자>`)로 시작한다 - 실행·플로마다 달라 다른 플로의 행을 보지 않는다.
- 씨앗의 접두사 `probe-seed` 는 읽기 전용이다 - 그 접두사로 행을 만들지 않는다.
- 하네스는 플로마다 그 플로 동안의 백엔드 접근 로그를 `.maestro-output/e2e/<플로>/api.log` 로 남긴다 - 화면이 옛 값을
  그릴 때 요청이 서버에 닿았는지(네이티브 HTTP 캐시인지 앱이 다시 부르지 않은 것인지) 이 로그로 가른다. 로그는 플로 시작
  5초 앞부터 잘라(호스트와 Docker 의 시계 차이) 앞 플로의 끝 줄이 섞인다 - 요청을 셀 때는 이 플로의 첫 요청(스크립트의 가입
  `POST /api/v1/auth/register`) 줄부터 센다.
- 백엔드에 닿지 못하는 상황은 비행기 모드로 만든다(`setAirplaneMode`) - 에뮬레이터에서 곧바로 "Network is
  unreachable" 이 된다. 플로는 셸 명령을 부를 길이 없어 백엔드 컨테이너를 멈추는(`docker pause`) 길은 쓰지 않는다. iOS
  시뮬레이터에는 비행기 모드가 없다 - 그런 플로는 머리말에 `# e2e-platforms: android` 를 적는다. 기기
  상태를 바꾸는 플로는 머리에 `onFlowComplete` 로 되돌린다(실패해도 돈다 - 2.11.0 에서 확인했다). 끊긴 요청은 e2e
  변형이 상태 0 실패로 남기니 머리말에 `# e2e-allow-http: 0` 을 적는다. 작은 실패는 `request-failed-compact`, 화면
  전부의 실패는 `request-failed` 다(`id:` 가 전체 일치라 서로 맞지 않는다).

## 쓰기 플로

- 계정은 `scripts/examples-api.js` 의 `STEP=account`(가입만 - `output.prefix` 는 `d4-<이메일 끝 8자>`)로 만들고 앱에서
  `subflows/login.yaml` 로 로그인한다. 고치거나 지울 행은 `STEP=example`(모든 속성과 분류 하나·태그 둘)·`STEP=unlisted`(참조
  목록 밖의 분류·태그)로 만든다. 제목은 그 접두사로 시작한다 - 씨앗의 `probe-seed`·목록 플로의 `probe-d3-` 를 쓰지 않는다.
- 앱 밖에서 자원을 없애는 것은 `STEP=delete`, 세션을 끊는 것은 `STEP=revoke`(폐기된 refresh 를 다시 내밀어 백엔드가 그 사용자의
  세션을 모두 폐기하게 한다)다.
- 하네스는 백엔드의 access token 수명을 10초로 준다(`E2E_ACCESS_EXPIRES_SECONDS`) - 앱은 만료 60초 전부터 회전하므로 쓰기마다
  실제 회전(스펙 7.2)을 지난다. 스크립트가 쓰는 토큰도 짧아서 401 이면 한 번 다시 로그인한다.
- 입력한 뒤 아래쪽 요소(선택기·제출)를 누르기 전에 제목 라벨(`field-label-title`)을 눌러 키보드를 내린다 - 키보드가 가린 자리를
  누르면 그 누름이 키보드로 간다. `hideKeyboard` 는 쓰지 않는다(위 절).
- 수정 화면의 제목 칸을 누르면 커서가 누른 자리에 선다 - 접두사를 짧게 두어(입력 칸의 절반보다 짧다) 가운데를 누르면 끝에 서게
  하고, `eraseText` 로 지운 뒤 다시 쓴다.
- 빠른 두 번 누름은 `tapOn` 의 `repeat: 2`(`delay: 1`)로 누른다 - Maestro 는 명령마다 화면이 멈추기를 기다리므로 두 명령으로는
  두 누름이 한 요청 안에 들지 않는다. 둘째 누름은 첫 누름이 연 다음 화면의 같은 자리에 닿을 수 있다 - 그 자리에 누를 것이 없는
  곳에서만 쓴다(생성 폼의 제출 자리에는 상세의 "수정" 이 온다). 나간 요청은 `api.log` 로 센다.
- `examples-create` 의 로그인 제출 둘째 누름은 홈의 `build-info-card` 안에서 행 사이에 닿는다는 전제로 쓴다 - Pixel 9 AVD 의
  로그인 전 홈 덤프에서 버전 행은 y≈975px 까지, 변형 값은 y≈996px 부터이고 누름은 (540, 993) 이었다(D6 실측 O4).
  OTA 를 끈 카드에는 누를 수 있는 노드가 없어 늦은 누름도 아무 일도 하지 않는다. 그 자리에 버튼이 생기면 다시 잰다.
  iOS 27.0/iPhone 17에서도 (201,384) 논리 점이 이동 뒤 같은 카드의 앱 버전·변형 행 사이였다(K3 Mac 재현).
  CI 에서 examples-create 가 실패하면 첫 누름 전/이동 뒤의
  스크린샷·계층·둘째 누름 좌표와 api.log 의 로그인 한 번을 함께 확인한다(D7 결정 43·실측 기록 K3).

## 계약 실험실 플로

- 실험실(`/contract`, 화면 `lab-screen`)은 홈의 `home-lab-link` 로 연다. testID 끝에 실험 id 가 붙는다
  (`components/lab/experiment-card.tsx`) - 실행 버튼 `lab-run-<id>`, 세션 안내 `lab-session-note-<id>`(세션이 필요한 셋만),
  결과 `lab-result-<id>`, 상태 `lab-status-<id>`, 보낸 헤더 `lab-header-<id>-<이름>`, 여러 단계의 머리글·본문
  `lab-step-heading-<id>-<순서>`·`lab-step-body-<id>-<순서>`(0부터), 한 단계 결과의 본문 `lab-body-<id>`, 맺음말 `lab-note-<id>`.
- 실행 버튼을 누른 뒤에는 스피너가 멈추기를 기다린다(`waitForAnimationToEnd`) - 도는 동안 스크롤하면 결과가 화면 위쪽에
  끼어 아래로 찾는 `scrollUntilVisible` 이 지나칠 수 있다.
- 결과의 본문은 길다(offset 순회는 쪽마다 수십 줄) - 단언할 요소를 `scrollUntilVisible` 로 화면에 들인 뒤에 본다. 본문처럼
  키가 큰 요소는 `visibilityPercentage: 10` 을 준다. 글자를 준 `assertNotVisible` 은 그 요소가 화면에 있을 때만 뜻이 있다 -
  먼저 요소를 들인다.
- 언어 협상은 문구를 문자열로 찾지 않는다 - ko 단계의 본문에 완성형 한글이 있고 en 단계의 본문에 없는지 본다(로캘
  플로와 같은 판정, 스펙 9.4).
- PUT upsert 의 행은 고정 id(`lib/lab/run.ts` 의 `PROBE_LAB_EXAMPLE_ID`)라 한 스택에서 처음 누르면 201, 다음부터 200 이다 -
  그 행을 만드는 플로는 `contract-lab-signed-in` 하나다. offset 순회는 씨앗 여섯 행에서 두 쪽이다 - 실험실 플로는 이름
  순으로 목록·쓰기 플로보다 먼저 돈다(뒤에 행이 늘어도 20쪽 상한 안이면 끝에 닿는다).
- 딥링크로 곧장 연 실험실은 앱을 멈춘 뒤(`stopApp`) `openLink` 로 연다 - 앱이 떠 있으면 딥링크가 홈 위에 실험실을 쌓아
  헤더의 "홈으로"(`back-to-home-button`)가 그려지지 않는다. 홈의 진입(`home-lab-link`)을 `repeat: 2` 로 누르면 둘째 누름은
  이동 가드가 버리거나 실험실의 같은 자리(첫 카드인 PUT upsert 의 설명 글 - 누를 것이 없다)에 닿는다. 홈의 진입이나
  실험실의 첫 카드를 옮기면 그 자리를 다시 본다.

## 빌드 정보 플로

- 홈의 빌드 정보 카드(`components/app/build-info-card.tsx`)는 카드 `build-info-card`, 행 `build-info-<키>`(`version`·
  `variant`·`ota`·`runtime`·`channel`·`update`), OTA 를 끈 빌드의 안내 `build-info-ota-off`, 켠 빌드의 확인 버튼
  `build-info-check`, 확인 결과 문구 `build-info-message` 에 testID 가 있다. e2e 변형은 OTA 를 끄므로
  `flows/home-build-info.yaml` 은 "없음"·"꺼짐" 과 안내를 본다 - 발행한 업데이트의 적용과 "새 업데이트가 없습니다." 를
  보는 기기 실증은 계정이 필요해 스펙 15장 9단계다. 계정 없이 확인 실패·스크린 리더 읽기를 재는 미실측 경로는 D6 실측 O4.
- `android.sh build` 는 만든 APK 의 앱 설정(`assets/app.config` 의 `updates`·`runtimeVersion`)과 병합된
  AndroidManifest.xml(Android SDK build-tools 의 `aapt2` 로 읽는다 - expo-updates 의 `ENABLED`·주소·채널 머리글,
  평문 HTTP)이 e2e 변형의 것인지 단언한다. 빌드 레시피라 이 파일을 고치면 APK 를 다시 만든다.

## 두 플랫폼

같은 플로를 Android(`run-android.sh`)와 iOS(`run-ios.sh` - CI 의 macOS 러너)가 돈다. Maestro 2.11.0 의 iOS 드라이버는
`back`·`pressKey: back` 을 아무것도 하지 않고 `setAirplaneMode` 는 경고만 남긴다 - 조용히 지나가 플로가 엉뚱한 화면에서
단언한다. 그래서:

- 한 화면 뒤로는 `runFlow: ../subflows/back.yaml` 이다(Android 는 뒤로 가기, iOS 는 머리글 뒤로 버튼의 식별자
  `BackButton`). 돌아갈 화면이 없는 화면의 Android 뒤로 가기(가드가 보낸 로그인 화면 → 홈)는
  `subflows/android-back.yaml` 이고, iOS 에서 같은 자리로 가는 단계(머리글의 "홈으로" - `back-to-home-button`)는 플로가
  `when: platform: iOS` 로 따로 적는다.
  플로에 `back`·`pressKey: back` 을 직접 쓰지 않는다.
- 시트는 배경(`sheet-backdrop`)을 눌러 닫는다 - 두 플랫폼이 같다.
- 비행기 모드처럼 한 플랫폼에만 있는 명령을 쓰는 플로는 머리말에 `# e2e-platforms: android` 를 적는다 - 빠진
  플랫폼의 하네스가 그 플로를 건너뛰고 그 사실을 적는다. 그런 단계를 두 플랫폼이 도는 플로의 `when: platform: Android`
  갈래에 두지 않는다 - 머리말의 `# e2e-allow-http:` 는 플랫폼을 가리지 않아, 그 갈래만 일으키는 상태(비행기 모드의 0)를
  선언하면 iOS 에서 "선언했는데 나오지 않은" 실패다. 플로를 따로 둔다(`examples-delete-offline`).
- 로캘 플로의 `launchApp` 은 `arguments: { AppleLanguages: '(${APP_LOCALE})' }` 를 싣는다 - iOS 는 앱별 언어 대신 실행
  인자(`-AppleLanguages`)로 언어를 건다. 하네스가 머리말의 값을 `APP_LOCALE` 로 넘긴다(Android 는 이 인자를 쓰지 않는다).
- `subflows/start-signed-out.yaml` 은 `clearKeychain: true` 도 준다 - iOS 키체인의 세션은 clearState(앱 다시 설치)로
  지워지지 않는다(스펙 7.5 의 D2 정정).
- `test/unit/e2e/flows.test.ts` 가 위 규칙을 소스에서 잰다.

## 백엔드 매트릭스

`BACKEND_KIND`(fastapi·nestjs·rails, 기본 fastapi)가 띄울 백엔드를 고른다 - `run-android.sh`·`test/contract/run.sh` 는
compose 프로파일로, `run-ios.sh` 는 Docker 없이 `native-backend.sh` 로(아래 "iOS"). 원본 그대로 복사한 `matrix.ts` 의 `backendKind()` 가 도커·기기를 건드리기 전에 값을 검증하고(compose
는 모르는 프로파일을 오류 없이 부분 스택으로 푼다), 하네스가 스택을 띄울 때 `reportKnownDivergences()` 가 그 백엔드의
알려진 드리프트(오늘 0건)를 한 줄로 찍는다. 게이트는 FastAPI 하나로 돌고, 세 백엔드는 CI 가 돈다. CI 는 APK 를 한 번 만들어
`E2E_APK` 로 넘긴다 - 하네스는 빌드하지 않고 그 APK 를 설치한다(iOS 는 `.app` 을 `E2E_APP` 으로).

## 멈춘 서버 확인 (`checks/`)

`E2E_CHECKS=1` 이면 하네스가 플로 뒤에 백엔드를 내리고 같은 포트에 `stall-server.ts` 를 띄워 `checks/*.yaml` 을 돈다.
그 플로는 목록 필터의 값(`probe-stall-headers`·`probe-stall-body`)으로 서버가 멈추는 방식(헤더 전·본문 도중)을 고르고,
요청이 15초 타임아웃에 끊겨 전체 화면 실패(`request-failed`)가 뜨는지 본다. 두 요청이 모두 `REQUEST_TIMEOUT` 으로
끝났는지는 하네스가 기기 로그와 서버 기록(`.maestro-output/e2e/stall-server.log`)으로 본다 - 서버가 없어 연결이
거절되면(`NETWORK_ERROR`) 화면은 같다. CI 의 fastapi 갈래가 켜고 게이트는 켜지 않는다.

## 요청 수 (`request-counts.ts`)

하네스는 플로마다 가드 뒤에 그 플로의 접근 로그(`<플로>/api.log`)에서 앱의 요청 수를 단언한다 - D4 실측 W2–W4 가 손으로 센
것이다. `examples-create` 는 회전 1·앱의 POST 1·로그인 1(두 번 누른 로그인 제출이 요청 하나), `examples-edit` 는 회전 = PATCH(저장마다
회전 하나), `examples-scroll-refresh` 는 상세 뒤 목록 GET 2(상세에서 돌아온 목록이 읽어 둔 두 쪽을 다시 읽는다),
`examples-delete` 는 이 실행의 목록 GET 2(쌓인 목록은 앱 복귀·삭제 뒤 무효화에 다시 부르지 않는다). Android 의 api.log 는 플로
시작 5초 앞부터라 앞 플로의 끝 줄이 섞이므로 그 플로의 첫 가입(`POST /api/v1/auth/register`) 줄부터 센다. FastAPI(uvicorn)의 접근
로그만 센다 - NestJS 는 요청을 로그에 남기지 않고 Rails 는 lograge 의 JSON 이다. 이 네 플로를 고쳐 수가 바뀌면
`request-counts.ts` 의 `FLOW_CHECKS` 를 함께 고친다.

## 환경 흔적 (Android)

플로가 실패하면 `run-android.sh` 가 그 기록에서 앱 밖(기기·adb)의 실패로 보이는 흔적을 짚는다(`environment_hint`) - 기기
로그의 `Active window root not found`(Maestro 의 기기 드라이버가 앱 창을 찾지 못한 정지 - 오래 켠 에뮬레이터,
`docs/superpowers/notes/2026-10-01-d5-measurements.md` 의 C2 ①)의 수와, `maestro.log` 의 첫 `java.net.ConnectException`(Maestro 가
adb 서버나 백엔드에 닿지 못했다 - C2 ②). 그래서 `logcat.txt` 는 앱의 줄과 함께 `UiDevice` 의 경고도 모은다 - 가드는 그
줄을 보지 않는다(앱의 `ReactNativeJS` 줄과 `FATAL EXCEPTION` 만 본다). 짚기만 하고 재시도하지 않는다(스펙 16장) - 플로는 실패
그대로이고, 원인은 에뮬레이터를 다시 부팅하거나(`test/e2e/android.sh boot`) adb 서버를 다시 띄워 가른다. 같은 흔적은 통과한
플로에도 몇 번 있을 수 있다(C2 ① - 0–6번) - 실패한 플로에서만 짚는다.

## 돌리기

```bash
E2E_AVD=Pixel_9_API_36 ./test/e2e/run-android.sh            # 전부
E2E_FLOW="register-conflict" ./test/e2e/run-android.sh       # 일부 - 개발용
BACKEND_KIND=nestjs ./test/e2e/run-android.sh                # 다른 백엔드(CI 의 매트릭스와 같다)
E2E_CHECKS=1 ./test/e2e/run-android.sh                       # 플로 뒤에 멈춘 서버 확인까지
./test/e2e/run-ios.sh                                        # iOS - macOS 에서만(아래 "iOS")
BACKEND_KIND=rails ./test/e2e/run-ios.sh                     # iOS 의 다른 백엔드(Docker 없이)
```

빌드 입력(시험·문서·스크립트를 뺀 파일과, `test/` 안에 있지만 빌드 레시피인 `test/e2e/android.sh`)이 지난번과
같으면 APK 를 다시 만들지 않는다 - 플로만
고친 실행은 빌드 없이 돈다. Windows 에서 저장소 경로가 47자를 넘으면 `E2E_STAGE_DIR`(기본
`C:/t/e`)의 사본에서 빌드한다. 경로가 짧은 Windows 와 Linux·macOS 는 저장소 안에서 빌드하므로 prebuild 가 루트에
`android/`(`.gitignore` 의 `/android`)를 남긴다 - 게이트의 [8] 은 그것이 설정의 바탕이 되지 않도록 깨끗한 사본에서 평가한다
(`scripts/check.sh` 의 [8] 머리말). 결과는 `.maestro-output/e2e/<플로>/`에 남는다. 빌드할 때마다 Gradle 앞에서 Metro 의 디스크
캐시(`os.tmpdir()` 의 `metro-cache`)를 비운다(`android.sh` 의 `clear_metro_cache`) - 캐시가 남은 채 돈 번들 단계가
0xC0000005 로 죽은 적이 있고 지운 뒤에는 재현되지 않았다(`docs/superpowers/notes/2026-09-30-d3-measurements.md` 의 L7).
재시도로 덮지 않는다. Gradle 은 두 번 돈다 - expo-updates 의 단계(`:app:createReleaseUpdatesResources`)를 빈 캐시에서 먼저
돌리고, 캐시를 다시 비운 뒤 `assembleRelease` 를 돌린다(그 단계는 거기서 UP-TO-DATE). 두 단계 레시피는 둘째 Gradle 에서
`createReleaseUpdatesResources` 가 UP-TO-DATE 인 것에 기댄다 - 지금 입력은 파일 없이 문자열·문자열 목록·불리언뿐이다. expo-updates 를 올릴 때마다 게이트
로그에 `> Task :app:createReleaseUpdatesResources UP-TO-DATE` 가 여전히 있는지 `android.sh` 의 `assemble_release` 가
기계로 단언한다(`--console=plain`, 실행·누락·FROM-CACHE 면 실패). `-x` 로 무조건 제외하지 않는다 - 입력이 파일로 늘면
다시 돈 단계가 실패로 드러나 두 단계 레시피와 Metro 캐시 순서를 재검토하게 한다. Gradle 의 실패 코드는 tee 뒤에도 보존한다.
`test/unit/e2e/android-build.test.ts` 가 가짜 gradlew 로 재고, 이 파일의 고침도 APK 지문 입력이라 APK 를 다시 만든다. 두 번째 Metro 캐시 비우기는 번들
단계도 빈 캐시에서 시작하게 하려는 것이다(D3 실측 L7 의 불변식). 그 단계는 Metro 를 캐시를 지우지 않고
돌리는데, 번들 단계가 채운 캐시 위에서는 node 의 종료에서 0xC0000005 로 죽었다(`docs/superpowers/notes/2026-10-01-d6-measurements.md`
의 O4). Gradle 은 상주 데몬 없이 돈다(`--no-daemon`, 빌드마다 일회용 Gradle 데몬을 띄운다) - 남은 데몬이 지난 빌드의
산출물(`classes*.dex`)을 쥐고 있어
Windows 에서 다음 빌드 앞의 사본 지우기가 "Device or resource busy" 로 멈췄다(`docs/superpowers/notes/2026-10-01-d4-measurements.md`
의 W1). 사본 지우기가 도중에 멈춰도 표식(`.e2e-stage`)은 남아 다음 실행이 그 사본을 알아본다. 하네스의 `--no-daemon` 빌드가
띄우는 일회용 Gradle 데몬의 JVM 인자는 명령줄(`-Dorg.gradle.jvmargs="-Xmx4096m -XX:MaxMetaspaceSize=1024m"`)로 준다 -
prebuild 가 만드는 `android/gradle.properties` 의 기본값(Metaspace 512MiB)으로는 expo-updates 의 KSP 가 병렬 lint 와 함께
돌 때 데몬의 Metaspace 가 차서 빌드가 죽었다
(`docs/superpowers/notes/2026-10-01-d6-measurements.md` 의 O4).

하네스(`run-android.sh`·`android.sh`)가 읽는 환경 변수다.

| 변수                                         | 뜻                                                                                                                                                                 |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ANDROID_HOME`                               | Android SDK 경로. 없으면 멈춘다                                                                                                                                    |
| `E2E_AVD`                                    | 켜진 기기가 없을 때 부팅할 AVD 이름(예: `Pixel_9_API_36`)                                                                                                          |
| `ANDROID_SERIAL`                             | 기기가 여럿일 때 하나를 고르는 adb 의 표준 변수. 여럿인데 없으면 곧바로 실패한다                                                                                   |
| `BOOT_TIMEOUT_SECONDS`                       | 부팅을 기다리는 초(기본 300, `android.sh boot`)                                                                                                                    |
| `TMPDIR`                                     | 부팅한 에뮬레이터의 출력을 남길 디렉터리(기본 `/tmp`, `android.sh boot` - `e2e-emulator-<AVD>.log`)                                                                |
| `BACKEND_URL`                                | 앱이 볼 백엔드 주소. `android.sh build` 에 필요하다 - `run-android.sh` 는 `http://10.0.2.2:<E2E_API_PORT>` 를 스스로 넘기고 빌드 지문에 넣는다                     |
| `E2E_API_PORT`                               | 백엔드를 여는 호스트 포트(기본 4100, `docker-compose.e2e.yml` 과 같은 값)                                                                                          |
| `E2E_STAGE_DIR`                              | Windows 에서 저장소 경로가 길 때 빌드할 짧은 경로(기본 `C:/t/e`)                                                                                                   |
| `E2E_FORCE_BUILD`                            | `1` 이면 빌드 입력이 같아도 APK 를 다시 만든다                                                                                                                     |
| `E2E_ACCESS_EXPIRES_SECONDS`                 | 백엔드의 access token 수명(초, 기본 10) - `docker-compose.e2e.yml` 이 세 백엔드의 `JWT_ACCESS_EXPIRES_SECONDS` 로 넘긴다. 60 이하라 앱의 쓰기가 전부 회전을 지난다 |
| `E2E_FLOW`                                   | 돌릴 플로 이름(공백으로 구분, 확장자 없이). 비우면 전부 - 게이트는 비우고 부른다                                                                                   |
| `BACKEND_KIND`                               | 띄울 백엔드(fastapi·nestjs·rails, 기본 fastapi) - `test/e2e/matrix.ts` 가 검증한다                                                                                 |
| `E2E_APK`                                    | 미리 만든 e2e APK. 주면 빌드하지 않고 설치한다(CI 의 build-android 잡)                                                                                             |
| `E2E_CHECKS`                                 | `1` 이면 플로 뒤에 멈춘 서버로 `checks/` 를 돈다(위 "멈춘 서버 확인")                                                                                              |
| `MAESTRO`                                    | Maestro 실행 파일(기본 PATH 의 `maestro`, 없으면 `~/.maestro/bin/maestro`). 2.11.x 가 아니면 멈춘다                                                                |
| `MAESTRO_CLI_NO_ANALYTICS`                   | 하네스가 `1` 로 export 한다 - Maestro 의 사용 통계를 끈다                                                                                                          |
| `MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED` | 하네스가 `true` 로 export 한다 - 분석 안내 상자를 끈다                                                                                                             |

`boot`는 연결된 기기의 애니메이션 배율 셋을 0 으로, 자동 완성 서비스를 null 로 바꾸고 되돌리지 않는다(화면
전환과 "비밀번호 저장" 대화상자가 단언을 흔들지 않게) - 그 기기가 실기기면(`ANDROID_SERIAL`로 골랐든 하나뿐이라 그대로
쓰였든) 끝난 뒤 기기 설정에서 손으로 되돌린다. 기기 로그의 링 버퍼도 16MiB 로 넓힌다(`logcat -G 16M`, 재부팅하면
기본 크기로 돌아간다) - 하네스는 플로마다 로그를 비우고 끝에 모으므로, 버퍼가 긴 플로 하나를 다 담지 못하면 앞쪽의
경고·오류 줄을 놓쳐 가드가 가짜로 통과하고 선언한 `[e2e-http]` 줄을 놓쳐 가짜로 실패한다. 비행기 모드도 끈다 - 켜고
끄는 플로가 도중에 죽은 하네스에 켜진 채 남으면 다음 실행의 플로가 전부 백엔드에 닿지 못한다.

하네스는 로캘 플로가 끝날 때와 EXIT 에서 입력기 설정을 되돌린다. 그 trap 도 돌지 못하고 끝나면(강제 종료·전원)
기본 입력기가 음성 입력으로 남아, 다음 실행의 로캘 없는 플로도 키보드 없이 돈다 - "키보드가 떠 있어도 제출 버튼이 한
번에 눌리는지"를 조용히 재지 않는다. 그렇게 끝난 뒤에는 `adb shell settings get secure default_input_method` 로
확인하고 `adb shell ime set com.google.android.inputmethod.latin/com.android.inputmethod.latin.LatinIME` 로 되돌린다.

## iOS

`run-ios.sh` 는 macOS 에서만 돈다(Xcode·Homebrew·Java 17 - CI 의 e2e-ios 잡, Mac 을 쓰는 사람의 로컬). 플로·머리말·가드·요청 수 단언은
Android 와 같고, 다른 것은 이렇다.

- 앱: `ios.sh build` 가 `expo prebuild --platform ios --clean`(pod install 포함) 뒤 시뮬레이터용 Release `.app` 을
  만든다. `APP_VARIANT=e2e`·`BACKEND_URL` 을 export 한다 - Xcode 빌드의 설정·번들 단계가 `app.config.ts` 를 다시
  평가한다. `ios.sh assert-app` 이 `.app` 의 앱 설정(`EXConstants.bundle/app.config` - 변형·주소·OTA 끔), `Expo.plist`
  (`EXUpdatesEnabled`), `Info.plist`(번들 ID·`NSAllowsLocalNetworking`)를 단언한다 - `E2E_APP` 으로 받은 `.app` 도
  설치 전에 다시 잰다. 빌드 기록은 `.maestro-output/ios-build.log` 다.
  D7 Mac 재현의 정정: `CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=- DEVELOPMENT_TEAM=`로 Xcode의
  `Sign to Run Locally`를 쓴다. Xcode가 Simulator 권한을 Mach-O의 `__TEXT,__entitlements`·`__ents_der`에 싣고
  호스트 서명과 구분한다. R18의 사후 서명은 iOS 제한 권한을 호스트 서명에 넣어 macOS amfid가 실행을 거부했다.
  만든 앱과 받은 앱 모두 strict/deep 무결성, 내장 XML의 앱 식별자(없거나 다른 앱이면 실패), DER section의 존재·범위,
  호스트 서명의 제한 권한 부재를 단언한다. Keychain 그룹이 생략되면 application-identifier가 기본 그룹이고,
  명시했다면 그 식별자 하나와 같아야 한다. Apple 계정·인증서·프로비저닝과 EAS·실기기 서명을 쓰지 않는다.
  실제 Keychain 저장/복원은 `register-restore-logout` 플로가 잰다. bash 시험은 이 권한 공간과 실패 전달을 잰다.
  SDK 57의 Xcode 27 호환은 기존 `expo-build-properties`의 `ios.enableSceneSupport`로 켠다(D7-R22b, 모든 변형).
  CI는 Xcode 26.6을 명시하며 Mac의 27.0과 함께 검증한다. iOS Maestro 호출은 `--platform ios`로 Android 기기
  열거를 막는다 - 연결된 Android 기기가 응답하지 않아 iOS 실행도 시작 못 한 사례가 K3에 있다.
- Password AutoFill: `run-ios.sh`는 선택한 시뮬레이터의 `com.apple.WebUI AutoFillPasswords`를 실행 중 0으로
  설정하고 다시 읽어 0이 아니면 실패한다. 먼저 defaults export의 성공한 domain 사전에서 원래 값/키 없음을
  구분하며 명령·변환 실패면 쓰기 전에 멈춘다. 종료 시 원래 값 또는 키 없음 상태로 복원한다. K3 Mac 재현에서
  강력한 비밀번호 추천 UI가 직접 입력을 한 글자로 잘랐고, 로그인 뒤 `Save Password?` 창이 홈을 덮었다.
  설정을 끈 대조에서는 20글자 전체가 전달됐고 가입·로그인·SecureStore 재시작 복원이 통과했다.
  앱의 자동완성 속성이나 플로·가드·목적 화면 단언은 바꾸지 않는다. CI와 로컬 모두 같은 준비 단계를 쓴다.
- D7-R20의 e2e 전용 `[e2e-state]` 정보 줄은 라우트·AppState·상세 조회 상태와 관찰자 수만 기록한다.
  `device.ndjson` 원본과 `device.log`의 `I/ReactNativeJS` 줄로 함께 보존한다. 앱 동작이나 가드를 바꾸지 않으며,
  딥링크 뒤 홈 유지/완료된 404 뒤 스켈레톤 유지의 경계를 찾기 위한 관측이다(실측 K3 실행 3).
- 백엔드: macOS 러너에는 Docker 가 없다. `native-backend.sh` 가 Homebrew 의 PostgreSQL 18·Redis 를 저장소
  밖(`E2E_NATIVE_DIR`)에서 127.0.0.1 에만 띄우고, 백엔드 저장소 `main` 을 받아(`fetch`) 런타임을 갖춘 뒤(`prepare`)
  DB 를 새로 만들어 마이그레이션 → 같은 SQL 시드(`seed/`) → API 를 4100 에 띄운다(`start`). 롤·DB 이름·JWT 더미·Rails 의
  환경은 `docker-compose.e2e.yml` 과 같다. 저장소 주소는 `native-backend.sh repo-url` 한 곳이고
  `test/unit/e2e/native-backend.test.ts` 가 compose 의 빌드 컨텍스트와 맞댄다. 하네스는 `start`·`stop` 만 부른다 -
  `services`·`fetch`·`prepare` 는 CI 가 앞 단계로, 로컬에서는 손으로 한 번 돈다(아래).
  CI의 Rails는 Ruby 설치 뒤 `lock-platform`을 먼저 부른다(D7-R14). 러너의 사전 빌드 Ruby 3.4.8은
  `arm64-darwin-23`이고 백엔드 잠금은 Darwin 24/25만 담아, 임시 clone의 `PLATFORMS` 한 줄만 더한다.
  다른 바이트가 바뀌면 원본을 복구하고 멈춘다. backend 원격은 고치지 않으며 설치는 frozen이다.
- 가드: 플로마다 시뮬레이터 로그(`log stream` - 서브시스템 `com.facebook.react.log`)를 `<플로>/device.ndjson` 으로
  받아 `ios-log.ts` 가 `adb logcat -v brief` 모양(`<플로>/device.log`)으로 옮기고 같은 `guard-log.sh` 에 넘긴다.
  React Native 의 iOS 는 JS 의 info 와 warn 을 같은 유형으로 남긴다 - e2e 변형이 경고 앞에 `[e2e-warn]` 을
  붙이고(`platform/e2e-log.ts`) 변환이 그 줄을 `W/` 로 옮긴다. 붙기 전과 끊은 뒤의 줄은 받지 못한다 - 하네스가
  붙은 뒤 2초, 끊기 전 2초를 둔다.
- 로캘 플로 앞에서 하네스가 앱을 다시 설치하고 키체인을 비운다(Android 의 `pm clear` 자리). 언어는 플로의
  `launchApp` 이 싣는 `-AppleLanguages` 다(위 "두 플랫폼").
- `# e2e-platforms:` 에 `ios` 가 없는 플로는 건너뛰고 끝에 그 이름을 적는다.

Mac 에서 처음 돌릴 때(한 번):

```bash
test/e2e/install-maestro.sh                                  # Maestro 2.11.0 을 ~/.maestro 에(Java 17 필요)
test/e2e/native-backend.sh services                          # Homebrew 의 PostgreSQL 18·Redis
BACKEND_KIND=fastapi test/e2e/native-backend.sh fetch        # 백엔드 저장소 main(nestjs·rails 도 같다)
BACKEND_KIND=fastapi test/e2e/native-backend.sh prepare      # uv·pnpm·bundler - Rails 는 .ruby-version 의 Ruby
```

iOS 하네스(`run-ios.sh`·`ios.sh`·`native-backend.sh`)가 더 읽는 환경 변수다. `BACKEND_KIND`·`E2E_API_PORT`·`E2E_FLOW`·
`E2E_CHECKS`·`E2E_ACCESS_EXPIRES_SECONDS`·`MAESTRO` 는 위 표와 같다.

| 변수                             | 뜻                                                                                                                         |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `E2E_APP`                        | 미리 만든 e2e `.app`(CI 의 build-ios 잡). 주면 빌드하지 않고 단언한 뒤 설치한다                                            |
| `E2E_SIMULATOR`                  | 부팅할 시뮬레이터 이름(예: `iPhone 17`). 켜진 iPhone 이 있으면 그것을, 없으면 가장 새 iOS 런타임의 `iPhone <숫자>` 를 쓴다 |
| `E2E_NATIVE_DIR`                 | 백엔드 저장소·DB·로그를 두는 곳(절대 경로, 기본 `~/.cache/template-typescript-expo-e2e`)                                   |
| `E2E_DB_PORT`                    | 네이티브 PostgreSQL 의 포트(기본 55432)                                                                                    |
| `E2E_REDIS_PORT`                 | 네이티브 Redis 의 포트(기본 56379)                                                                                         |
| `E2E_PG_BIN`                     | PostgreSQL 의 bin 디렉터리(기본 Homebrew 의 `postgresql@18`)                                                               |
| `MAESTRO_DRIVER_STARTUP_TIMEOUT` | Maestro 의 iOS 드라이버를 기다리는 ms(하네스 기본 180000)                                                                  |
