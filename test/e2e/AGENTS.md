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

## 돌리기

```bash
E2E_AVD=Pixel_9_API_36 ./test/e2e/run-android.sh            # 전부
E2E_FLOW="register-conflict" ./test/e2e/run-android.sh       # 일부 - 개발용
```

빌드 입력(시험·문서·스크립트를 뺀 파일)이 지난번과 같으면 APK 를 다시 만들지 않는다 - 플로만
고친 실행은 빌드 없이 돈다. Windows 에서 저장소 경로가 47자를 넘으면 `E2E_STAGE_DIR`(기본
`C:/t/e`)의 사본에서 빌드한다. 결과는 `.maestro-output/e2e/<플로>/`에 남는다.

하네스(`run-android.sh`·`android.sh`)가 읽는 환경 변수다.

| 변수                                         | 뜻                                                                                                  |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `ANDROID_HOME`                               | Android SDK 경로. 없으면 멈춘다                                                                     |
| `E2E_AVD`                                    | 켜진 기기가 없을 때 부팅할 AVD 이름(예: `Pixel_9_API_36`)                                           |
| `ANDROID_SERIAL`                             | 기기가 여럿일 때 하나를 고르는 adb 의 표준 변수. 여럿인데 없으면 곧바로 실패한다                    |
| `BOOT_TIMEOUT_SECONDS`                       | 부팅을 기다리는 초(기본 300, `android.sh boot`)                                                     |
| `E2E_API_PORT`                               | 백엔드를 여는 호스트 포트(기본 4100, `docker-compose.e2e.yml` 과 같은 값)                           |
| `E2E_STAGE_DIR`                              | Windows 에서 저장소 경로가 길 때 빌드할 짧은 경로(기본 `C:/t/e`)                                    |
| `E2E_FORCE_BUILD`                            | `1` 이면 빌드 입력이 같아도 APK 를 다시 만든다                                                      |
| `E2E_FLOW`                                   | 돌릴 플로 이름(공백으로 구분, 확장자 없이). 비우면 전부 - 게이트는 비우고 부른다                    |
| `MAESTRO`                                    | Maestro 실행 파일(기본 PATH 의 `maestro`, 없으면 `~/.maestro/bin/maestro`). 2.11.x 가 아니면 멈춘다 |
| `MAESTRO_CLI_NO_ANALYTICS`                   | 하네스가 `1` 로 export 한다 - Maestro 의 사용 통계를 끈다                                           |
| `MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED` | 하네스가 `true` 로 export 한다 - 분석 안내 상자를 끈다                                              |

`boot`는 기기의 애니메이션 배율 셋을 0 으로, 자동 완성 서비스를 null 로 바꾸고 되돌리지 않는다(화면 전환과
"비밀번호 저장" 대화상자가 단언을 흔들지 않게) - `ANDROID_SERIAL`로 실기기를 고르면 끝난 뒤 기기 설정에서 손으로
되돌린다.
