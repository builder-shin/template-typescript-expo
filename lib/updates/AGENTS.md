# lib/updates/ 작업 지침

홈의 빌드 정보 카드(스펙 10.6)의 판단을 둔다(루트 `AGENTS.md` 의 계층 표) - 카드의 행, "업데이트 확인" 의 순서(확인 →
받기 → 다시 켜기)와 그 결과의 문구. 네이티브 모듈·React·화면을 모른다. 이 실행의 값(`BuildInfo`)은 `platform/updates.ts` 의
`readBuildInfo` 가 expo-updates·expo-constants 에서 읽어 넘기고, expo-updates 의 세 호출도 거기서 `UpdatesApi` 로 주입받는다.
OTA 설정(채널·fingerprint·EAS 프로젝트)의 판단인 `lib/config/updates.ts` 와 다르다 - 거기는 빌드가 싣는 설정이고 여기는 이
실행이 읽은 값이다. 이 디렉터리의 파일은 이 저장소의 새 파일이다 - 복사본이 아니라 출처 기록에 없다.

| 파일            | 역할                                                                                                                                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `build-info.ts` | 순수 판단 셋 - `buildInfoView`(`BuildInfo` → 카드의 행 여섯과 `canCheck`), `checkAndApplyUpdate`(주입받은 `UpdatesApi` 로 확인 → 받기 → 다시 켜기), `updateCheckView`(진행·결과 → 버튼의 `busy` 와 결과 문구) |

## 규칙

- **순수하다.** 네이티브 모듈·`react`·`expo-*` 를 import 하지 않는다(`lib/**` 경계 - ESLint 가 막고
  `test/unit/lint/lib-boundary.test.ts` 가 잰다). 시계·난수·모듈 상태도 읽지 않는다 - 같은 입력은 같은 출력이다.
- **expo-updates 는 주입받는다.** `checkAndApplyUpdate` 는 `UpdatesApi`(확인·받기·다시 켜기, 세 함수) 하나만 받는다. 실제
  호출은 `platform/updates.ts` 의 `updatesApi` 가 넘기고, 시험은 부른 순서를 적는 가짜를 넘긴다.
- **실패는 값이다.** 확인·받기·다시 켜기 가운데 하나가 거절돼도 던지지 않고 `{ kind: 'failed', message }` 를 돌려준다 -
  `Error` 가 아닌 거절도 문구로 바꾼다. 화면이 그 문구를 그린다. 그래서 `queries/updates.ts` 의 `mutationFn` 안에서 던져진
  것은 결함이고 오류 경계로 간다(`throwOnError`, `queries/AGENTS.md`).
- **로딩에 글자를 쓰지 않는다.** `updateCheckView` 는 도는 동안과 다시 켜는 동안(`reloading`)에는
  `{ busy: true, message: null }` 만 돌려준다 - 버튼이 스피너만 그린다(스펙 8.7). 결과 문구는 끝난 확인에만 있다.
- **값이 없으면 "없음" 이다**(`NO_VALUE`). null·빈 문자열·공백뿐인 값이 모두 그렇다 - OTA 를 끈 Android 빌드는 runtime
  version·채널을 빈 문자열로 주고 업데이트 ID 를 주지 않는다(expo-updates 57.0.24 의 `DisabledUpdatesController`, 스펙 10.6 의
  D6 정정). 내장 번들로 떴으면 업데이트 ID 뒤에 `(내장 번들)` 을 붙이되, 붙일 ID 가 없으면 "없음" 만 적는다. OTA 를 끈 빌드는
  `canCheck` 가 거짓이다 - 카드가 버튼 대신 안내를 그린다.
- **행의 `key` 는 testID 의 끝이다**(`build-info-<key>`). 키나 순서를 바꾸면 카드(`components/app/build-info-card.tsx`)와
  E2E(`test/e2e/flows/home-build-info.yaml`)를 함께 본다.

## 검증

`test/unit/updates/build-info.test.ts` 가 판단을 잰다 - 행의 순서와 값, 확인의 갈래(없음·있음·내장 번들로 되돌리기·받았는데
새것이 아님·세 호출의 거절)와 부른 순서, 화면 판단. 값을 옮기는 배선(`platform/updates.ts`)은
`test/unit/platform/updates.test.ts` 가, 쓰기 옵션(`queries/updates.ts`)은 `test/unit/queries/updates.test.ts` 가 잰다. 훅과
카드는 단위 시험이 없다(스펙 11.1) - 기기의 E2E 가 OTA 를 끈 빌드의 카드를 본다. OTA 를 켠 빌드의 "업데이트 확인" 경로는 계정이
필요한 실증(스펙 15장 9단계)에서 처음 돈다.
