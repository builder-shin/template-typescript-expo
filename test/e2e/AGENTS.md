# test/e2e/ 작업 지침

Maestro 플로, E2E 하네스, SQL 시드가 산다(스펙 4장·11.3·11.4). 게이트의 E2E 단계는
`test/e2e/run-android.sh` 하나다.

## 플로를 쓸 때

- 파일 하나가 시나리오 하나다. `flows/*.yaml`은 하네스가 전부 돈다. 여러 플로가 쓰는 단계는
  `subflows/`에 두고 `runFlow`로 부른다.
- 머리말 주석으로 하네스에 선언한다: `# e2e-allow-http: <상태>...`(일부러 일으키는 2xx 밖의
  상태 - 선언하지 않은 상태가 기기 로그에 나오거나 선언한 상태가 한 번도 나오지 않으면 실패다),
  `# e2e-app-locale: <태그>`(앱별 언어). 앱의 줄(ReactNativeJS)이 하나도 없는 기기 로그도 실패다 - 로그를
  모으지 못한 것이다(`guard-log.sh`).
- `EMAIL`·`OTHER_EMAIL`(플로마다 새로 만든다 - `probe-email.ts`)과 `PASSWORD`가 env 로 들어온다.
  `OTHER_EMAIL`은 한 플로 안의 두 번째 사용자다. 실전 상수와 같은 값을 쓰지 않는다.
- 하네스는 `MAESTRO_CLI_NO_ANALYTICS=1`로 Maestro 의 사용 통계를 끄고, 플로마다 `--debug-output`으로
  기록을 따로 받는다.
- 화면 요소는 testID(`id:`)로 찾는다. 문구로 찾지 않는다 - 오류 문구는 백엔드가 협상한 언어다.
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
  unreachable" 이 된다. 플로는 셸 명령을 부를 길이 없어 백엔드 컨테이너를 멈추는(`docker pause`) 길은 쓰지 않는다. 기기
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

## 돌리기

```bash
E2E_AVD=Pixel_9_API_36 ./test/e2e/run-android.sh            # 전부
E2E_FLOW="register-conflict" ./test/e2e/run-android.sh       # 일부 - 개발용
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
로그에 `> Task :app:createReleaseUpdatesResources UP-TO-DATE` 가 여전히 있는지 확인한다. 두 번째 Metro 캐시 비우기는 번들
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
