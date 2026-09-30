# D1이 다음 계획에 넘기는 것 (2026-09-30)

D1(골격·실측·코어 복사)의 리뷰와 판정에서 나온 항목 중 D1 범위 밖이라 뒤 계획이 맡는 것이다.
근거는 실측 기록(`2026-09-30-d1-measurements.md`)과 D1 계획, 스펙의 날짜 붙은 정정에 있다.
계획을 쓸 때 이 목록을 읽고, 맡은 항목을 그 계획의 작업에 넣는다.

## 병합

- D1 브랜치는 이력을 보존해 병합한다(병합 커밋 또는 fast-forward). squash·rebase를 쓰지 않는다 -
  실측 기록이 커밋 `3d16db5`(실측 계측기)와 `b22c2e2`를 재현 경로로 인용한다.

## D2 (세션과 인증)

- **E2E 하네스**
  - 에뮬레이터에는 계측 화면이 든 APK가 남아 있다 - E2E 전에 다시 빌드한다.
  - `test/e2e/android.sh`:
    - `wait_text`는 반복 횟수가 아니라 `SECONDS` 기한으로 센다. `2>/dev/null`이 숨기는 adb 오류는 마지막 stderr를 드러낸다.
    - 기기가 둘 이상인데 `ANDROID_SERIAL`이 없으면 곧바로 실패한다.
    - 빌드 전에 Windows 경로 길이(실제 디렉터리 47자 이하)를 검사한다.
  - Maestro 규칙:
    - `evalScript` 값은 따옴표로 감싼다.
    - `launchApp` 뒤에는 기다린 다음 `openLink`한다.
    - `console.log`는 디버그 로그에 남는다.
    - 로캘 플로에서는 `clearState`를 쓰지 않는다.
    - 로그는 `--debug-output <dir>`로 실행마다 따로 받는다.
    - 분석 끄기 환경 변수를 실행마다 준다.
  - 취소 오류는 이름으로 가르지 않는다. expo/fetch의 요청 단계 취소는 `Error`다.
- **설정과 부팅 순서**
  - `getSettings()`는 요청 시점에만 부른다(모듈 최상위 금지).
  - 루트 훅(세션 복원·AppState·NetInfo·QueryClient)은 `STARTUP.ok` 가지 안의 자식에 둔다. `platform/AGENTS.md`에 적는다.
  - `platform/config.ts`의 순수 부분(`extra` 좁히기, 오류→문구)을 `lib/config`로 옮겨 단위 시험한다. 실패 경로 여섯 사례: 유효 · 빈 extra · extra 없음 · 문자열 아님 · 상대 URL · 재호출.
  - 머리 주석의 자리도 고친다.
- **lib 경계**
  - `lib/`가 `@/platform/*`·`@/queries/*`·`@/components/*`·`@/app/*`·`@react-navigation/*`를 import하지 못하게 한다.
  - 표본 시험의 각 행은 규칙 전체가 같은지 본다(`toEqual(libRule())`).
  - `import/no-extraneous-dependencies`를 검토한다. hoisted 링커는 선언하지 않은 의존성을 풀어 준다.
- **출처 검사**
  - 무수정 사본마다 원본 blob SHA를 기록하고 `git hash-object`와 비교한다. 스펙 6.3에 다섯째 규칙으로 정정을 단다.
  - Windows 드라이브 상대 경로(`C:..\x`)도 거절한다.
- **네이티브 HTTP 캐시**
  - expo/fetch는 응답 헤더를 따르는 네이티브 캐시(Android OkHttp·iOS URLCache)를 거친다.
  - 세 백엔드가 인증된 GET에 싣는 `Cache-Control`·`ETag`·`Last-Modified`를 기록한다.
  - E2E는 "로그아웃 뒤 다른 사용자로 로그인하면 새 사용자가 보인다"를 단언한다.
- **게이트·빌드**
  - `expo export`는 캐시를 두면 이 개발 머신에서 간헐적으로 0xC0000005로 죽었다. Gradle의 번들 단계도 Metro 캐시를 쓰니 지켜보고, 나타나면 시간을 정해 원인을 찾는다(hermesc인가 node인가).
  - `pnpm-workspace.yaml`의 `minimumReleaseAgeExclude` 다섯은 2026-09-30 10:59 UTC 이후 첫 의존성 변경 때 뺀다.
  - Metro 중복 고정(metro·metro-cache·metro-transform-worker 0.84.5) 옆에 이유를 적는다.
- **클라이언트(선택)**: 호출자가 이미 끊은 뒤 타이머가 돌면 `timedOut`을 세우지 않게 한다(`if (controller.signal.aborted) return`).

## D3 (목록·상세)

- Uniwind 1.12.0 결함(한 `@media` 블록에서 첫 규칙만 `minWidth`를 지킨다 - `sm:`이 폰에서도 적용된다).
  패치·버전·`sm:` 회피 중 하나를 정한다. 상류 보고는 사용자 확인 뒤 한다.
- `components.json`의 `"hooks": "@/queries"`를 `@/components/hooks`(또는 `@/platform/hooks`)로 바꾼다.
- `platform/theme.ts`의 색이 `global.css` 토큰과 어긋나는 곳(dark card·primary·border, notification)을 맞춘다.
- 목록·상세의 신선도를 네이티브 HTTP 캐시와 함께 확인한다(D2가 잰 헤더 기준).
- 소음: prebuild의 `userInterfaceStyle`(expo-system-ui 필요) 경고, React Native Reusables CLI의 잠재 문제
  넷, `expo export`의 0 B 웹 CSS 번들.

## D6 (EAS·OTA)

- `app.config.ts`가 Node type stripping으로 `lib/config`를 불러온다(M7). `eas.json`에서 EAS 빌드의 Node
  버전을 고정한다(Node ≥ 22.18).

## D7 (CI)

- iOS 빌드도 `app.config.ts`를 다시 평가한다(`expo-constants`의 `get-app-config-ios.sh`). xcodebuild
  환경에 `APP_VARIANT`·`BACKEND_URL`을 넘기고, `.app` 안 `EXConstants.bundle/app.config`의
  `extra.appVariant`를 단언한다(`android.sh`의 APK 단언과 같다).
- iOS에서 "헤더를 보낸 뒤 본문을 멈추는 서버"로 요청이 15초 안에 `REQUEST_TIMEOUT`이 되는지 잰다
  (`lib/jsonapi/client.ts`의 본문 경주가 막는 경로 - 지금은 소스로만 확인했다).
- NestJS 프로필은 이 저장소에서 아직 한 번도 띄우지 않았다(compose 검사와 원본 대조만).
- M1·M2·M3·M4·M6의 iOS 절반.
