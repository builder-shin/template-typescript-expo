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
  그릴 때 요청이 서버에 닿았는지(네이티브 HTTP 캐시인지 앱이 다시 부르지 않은 것인지) 이 로그로 가른다.
- 백엔드에 닿지 못하는 상황은 비행기 모드로 만든다(`setAirplaneMode`) - 에뮬레이터에서 곧바로 "Network is
  unreachable" 이 된다. 플로는 셸 명령을 부를 길이 없어 백엔드 컨테이너를 멈추는(`docker pause`) 길은 쓰지 않는다. 기기
  상태를 바꾸는 플로는 머리에 `onFlowComplete` 로 되돌린다(실패해도 돈다 - 2.11.0 에서 확인했다). 끊긴 요청은 e2e
  변형이 상태 0 실패로 남기니 머리말에 `# e2e-allow-http: 0` 을 적는다. 작은 실패는 `request-failed-compact`, 화면
  전부의 실패는 `request-failed` 다(`id:` 가 전체 일치라 서로 맞지 않는다).

## 돌리기

```bash
E2E_AVD=Pixel_9_API_36 ./test/e2e/run-android.sh            # 전부
E2E_FLOW="register-conflict" ./test/e2e/run-android.sh       # 일부 - 개발용
```

빌드 입력(시험·문서·스크립트를 뺀 파일과, `test/` 안에 있지만 빌드 레시피인 `test/e2e/android.sh`)이 지난번과
같으면 APK 를 다시 만들지 않는다 - 플로만
고친 실행은 빌드 없이 돈다. Windows 에서 저장소 경로가 47자를 넘으면 `E2E_STAGE_DIR`(기본
`C:/t/e`)의 사본에서 빌드한다. 결과는 `.maestro-output/e2e/<플로>/`에 남는다.

하네스(`run-android.sh`·`android.sh`)가 읽는 환경 변수다.

| 변수                                         | 뜻                                                                                                                                             |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `ANDROID_HOME`                               | Android SDK 경로. 없으면 멈춘다                                                                                                                |
| `E2E_AVD`                                    | 켜진 기기가 없을 때 부팅할 AVD 이름(예: `Pixel_9_API_36`)                                                                                      |
| `ANDROID_SERIAL`                             | 기기가 여럿일 때 하나를 고르는 adb 의 표준 변수. 여럿인데 없으면 곧바로 실패한다                                                               |
| `BOOT_TIMEOUT_SECONDS`                       | 부팅을 기다리는 초(기본 300, `android.sh boot`)                                                                                                |
| `TMPDIR`                                     | 부팅한 에뮬레이터의 출력을 남길 디렉터리(기본 `/tmp`, `android.sh boot` - `e2e-emulator-<AVD>.log`)                                            |
| `BACKEND_URL`                                | 앱이 볼 백엔드 주소. `android.sh build` 에 필요하다 - `run-android.sh` 는 `http://10.0.2.2:<E2E_API_PORT>` 를 스스로 넘기고 빌드 지문에 넣는다 |
| `E2E_API_PORT`                               | 백엔드를 여는 호스트 포트(기본 4100, `docker-compose.e2e.yml` 과 같은 값)                                                                      |
| `E2E_STAGE_DIR`                              | Windows 에서 저장소 경로가 길 때 빌드할 짧은 경로(기본 `C:/t/e`)                                                                               |
| `E2E_FORCE_BUILD`                            | `1` 이면 빌드 입력이 같아도 APK 를 다시 만든다                                                                                                 |
| `E2E_FLOW`                                   | 돌릴 플로 이름(공백으로 구분, 확장자 없이). 비우면 전부 - 게이트는 비우고 부른다                                                               |
| `MAESTRO`                                    | Maestro 실행 파일(기본 PATH 의 `maestro`, 없으면 `~/.maestro/bin/maestro`). 2.11.x 가 아니면 멈춘다                                            |
| `MAESTRO_CLI_NO_ANALYTICS`                   | 하네스가 `1` 로 export 한다 - Maestro 의 사용 통계를 끈다                                                                                      |
| `MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED` | 하네스가 `true` 로 export 한다 - 분석 안내 상자를 끈다                                                                                         |

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
