# lib/updates/ 작업 지침

홈의 빌드 정보 카드(스펙 10.6 과 그 D6 정정)의 판단을 둔다(루트 `AGENTS.md` 의 계층 표) - 카드의 행, "업데이트 확인" 의
순서(확인 → 받기 → 다시 켜기)와 그 결과의 문구. `react`·`react-native`·`expo` 를 모른다 - 이 실행의 값(`BuildInfo`)은
`platform/updates.ts` 의 `readBuildInfo` 가 expo-updates·expo-constants 에서 읽어 넘기고, expo-updates 의 세 호출은
`UpdatesApi` 로 주입받는다. 이 실행의 값을 다루고 설정 계약이 아니어서 `lib/config/` 에 두지 않았다(루트 `AGENTS.md` 와 같다) -
빌드가 싣는 OTA 설정(채널·fingerprint·EAS 프로젝트)의 판단은 `lib/config/updates.ts` 다. 이 디렉터리의 파일은 이 저장소의
새 파일이다 - 복사본이 아니라 출처 기록에 없다.

| 파일            | 역할                                                                                                                                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `build-info.ts` | 순수 판단 셋 - `buildInfoView`(`BuildInfo` → 카드의 행 여섯과 `canCheck`), `checkAndApplyUpdate`(주입받은 `UpdatesApi` 로 확인 → 받기 → 다시 켜기), `updateCheckView`(진행·결과 → 버튼의 `busy` 와 결과 문구) |

## 규칙

- **순수하다.** 네이티브 모듈·`react`·`expo-*` 를 import 하지 않는다(`lib/**` 경계 - ESLint 가 막고
  `test/unit/lint/lib-boundary.test.ts` 가 잰다). 시계·난수·모듈 상태도 읽지 않는다 - 같은 입력은 같은 출력이다.
- **expo-updates 는 주입받는다.** `checkAndApplyUpdate` 는 `UpdatesApi`(확인·받기·다시 켜기, 세 함수) 하나만 받는다. 실제
  호출은 `platform/updates.ts` 의 `updatesApi` 가 넘기고, 시험은 부른 순서를 적는 가짜를 넘긴다.
- **값이 없으면 "없음" 이다**(`NO_VALUE`). null·빈 문자열·공백뿐인 값이 모두 그렇다 - OTA 를 끈 Android 빌드는 runtime
  version·채널을 빈 문자열로 주고 업데이트 ID 는 null 이다(expo-updates 57.0.24 의 `DisabledUpdatesController`, 스펙 10.6 의
  D6 정정). 내장 번들로 떴으면 업데이트 ID 뒤에 `(내장 번들)` 을 붙이되, 붙일 ID 가 있을 때만이다.
- **`canCheck` 는 `otaEnabled` 다.** OTA 를 끈 빌드는 버튼 대신 안내를 그린다 - 눌러도 expo-updates 가 거절할 뿐이다.
- **확인의 순서.** 확인(`checkForUpdateAsync` - 새 업데이트이거나 내장 번들로 되돌리라는 지시) → 받기(`fetchUpdateAsync` -
  새것이거나 되돌리기) → `reloadAsync`. 확인에서 받을 것이 없거나 받은 것이 새것도 되돌리기도 아니면 `{ kind: 'current' }`
  다. 켤 때의 자동 확인(`checkAutomatically: ON_LOAD`)이 이미 받아 둔 업데이트도 확인이 다시 알리고 받기가 곧바로 끝난다는
  것이 이 순서의 전제다 - OTA 를 켠 빌드에서만 일어나 기기에서 재지 않았다(아래 검증).
- **실패는 값이다.** 확인·받기·다시 켜기 가운데 하나가 거절돼도 던지지 않고 `{ kind: 'failed', message }` 를 돌려준다 -
  `Error` 가 아닌 거절도 문구로 바꾼다. 문구는 앱의 고정 문장 뒤에 expo-updates 의 문구를 붙인 결과 표시이고(`updateCheckView`)
  오류 문구 카탈로그가 아니다(스펙 9.3). 판단이 던지지 않으니 `queries/updates.ts` 의 `mutationFn` 밖으로 던져진 것은 결함이다 -
  `throwOnError` 가 오류 경계로 보낸다(`queries/AGENTS.md`).
- **로딩에 글자를 쓰지 않는다.** `updateCheckView` 는 도는 동안과 다시 켜는 동안(`reloading`)에는
  `{ busy: true, message: null }` 만 돌려준다 - 버튼이 스피너만 그린다(스펙 8.7). 결과 문구는 끝난 확인에만 있다.
- **행의 `key` 는 testID 의 끝이다**(`build-info-<key>`). E2E 가 찾는 이름이라 key 를 바꾸면
  `test/e2e/flows/home-build-info.yaml` 이 깨진다(카드는 `components/app/build-info-card.tsx`). 행의 순서는 단위 시험이 고정한다.

## 검증

- 판단은 `test/unit/updates/build-info.test.ts` 가 잰다 - 행의 순서와 값, 확인의 갈래(없음·있음·내장 번들로 되돌리기·받았는데
  새것이 아님·세 호출의 거절)와 부른 순서(가짜 `UpdatesApi` 가 적는다), 화면 판단.
- 값을 옮기는 배선(`platform/updates.ts`)은 `test/unit/platform/updates.test.ts` 가 `vi.mock` 으로 잰다(기기 모듈과 설정 자리를
  가짜로 바꾼다). 쓰기 옵션(`queries/updates.ts`)은 `test/unit/queries/updates.test.ts` 가 `MutationObserver` 로 그대로 돌려 잰다.
- 훅과 카드는 단위 시험이 없다(스펙 11.1). 기기에서는 E2E `home-build-info` 가 OTA 를 끈 e2e APK 의 카드를 본다(D6 실측 O4,
  `docs/superpowers/notes/2026-10-01-d6-measurements.md`).
- OTA 를 켠 빌드의 확인 → 받기 → 다시 켜기는 Expo 계정이 필요해 스펙 15장 9단계에서 처음 잰다.
