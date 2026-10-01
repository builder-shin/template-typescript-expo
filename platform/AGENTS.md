# platform/ 작업 지침

Expo·React Native 모듈을 부르고 React 에 잇는 자리다(스펙 5장). 판단을 두지 않는다 - 분기가
자라면 `lib/`로 옮기고 여기서는 부르기만 한다.

| 파일                        | 역할                                                                                                                                                                                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `config.ts`                 | 설정 자리를 `app.config.ts`의 `extra`로 돌리고 시작할 때 검증한다. 빌드 변형과 딥링크 scheme 을 읽는다. 판단은 `lib/config/startup.ts`·`lib/navigation/deep-link.ts`                                                                             |
| `e2e-log.ts`                | e2e 변형에서 JS 경고가 네이티브 로그로 갈 때 표식을 붙인다(`nativeLoggingHook` 을 감싼다 - iOS 의 E2E 가드가 경고를 가른다, 스펙 11.3). 표식은 `lib/jsonapi/failure-log.ts`                                                                      |
| `e2e-diagnostics.ts`        | e2e 변형에서만 라우트·AppState·상세 QueryCache의 status/fetchStatus와 관찰자 수를 `[e2e-state]` 정보 줄로 남긴다(D7 실측 K3, D7-R20). 요청·응답 본문·토큰·쿼리 문자열은 기록하지 않으며 앱의 이동·조회 옵션·재시도는 바꾸지 않는다               |
| `api.ts`                    | 앱의 API 클라이언트 `apiRequest`. Accept-Language 를 싣는 유일한 자리(스펙 9.4) - 값은 기기 언어(`deviceAcceptLanguage`)이고 호출자가 정했으면 그 값이다(계약 실험실). e2e 변형의 실패 표식                                                      |
| `secure-session-storage.ts` | 세션 항목의 SecureStore 저장 매체                                                                                                                                                                                                                |
| `session.ts`                | 세션 관리자 `sessionManager` 하나와 상태 훅 `useSessionStatus()`                                                                                                                                                                                 |
| `query-client.ts`           | Query 캐시 `queryClient` 하나와 기본 옵션(스펙 8.5, `networkMode: 'offlineFirst'`), 앱 복귀·네트워크 복귀의 재조회 `useQueryRefetchTriggers()`(AppState·NetInfo), 인증 오류의 한 곳(쓰기 캐시의 `onError` - 세션 거절이면 `signOut()`, 스펙 9.2) |
| `updates.ts`                | 빌드 정보 카드가 읽는 이 실행의 값(`readBuildInfo` - expo-updates·expo-constants)과 업데이트 확인이 부르는 expo-updates 의 세 호출(`updatesApi`). 판단은 `lib/updates/build-info.ts`                                                             |
| `theme.ts`                  | 내비게이션 테마. 색은 `nav-colors.ts`                                                                                                                                                                                                            |
| `nav-colors.ts`             | 내비게이션 색 - `global.css` 토큰의 sRGB 값. import 가 없다 - `test/unit/ui/nav-colors.test.ts` 가 토큰과 맞댄다                                                                                                                                 |

- 백엔드 요청은 전부 `apiRequest`를 지난다. `lib/jsonapi/client.ts`의 `request()`를 다른 곳에서
  직접 부르지 않는다 - ESLint가 `app/`·`components/`·`queries/`와 이 디렉터리의 `api.ts`가 아닌
  파일에서 `request`를 값으로 import하는 것을 막는다(타입 import는 된다).
- 세션 관리자는 `sessionManager` 하나다. 회전은 그 안에서만 일어난다(`lib/auth/AGENTS.md`).
- 인증 오류는 `queryClient`의 쓰기 캐시(`MutationCache`) `onError` 한 곳이 받는다 - 쓰기 흐름
  (`lib/resources/write.ts`)·계약 실험실(`lib/lab/run.ts`)이 던진 세션 거절이면 기기 세션을 지우고, 이동은 경로
  가드가 한다 - 공개 경로인 실험실은 그 화면(`app/(lab)/contract.tsx`)이 로그인으로 보낸다. 그 `signOut()`의
  거절은 이름과 문구만 남긴다.

## 부팅 순서

- `getSettings()`는 요청할 때만 부른다. 어떤 모듈도 최상위에서 부르지 않는다 - 루트 레이아웃이
  `loadStartupSettings()`로 설정 자리를 `extra`로 돌리기 전에 불리면 기본 자리(`process.env`)를 읽어
  던지고, 치명 오류 화면(`FatalConfig`) 대신 앱이 죽는다. 앱 런타임의 `process.env`에는
  `BACKEND_URL`이 없다.
- 요청으로 이어질 수 있는 훅(세션·Query·AppState·NetInfo - `useQueryRefetchTriggers`)은 루트 레이아웃의 `STARTUP.ok`
  갈래 안의 자식(`AppRoot`)에 둔다. 루트에 두면 설정이 틀린 앱에서 `request()`가 던지는 설정 오류가
  ErrorBoundary로 가서 치명 오류 화면을 가린다. 세션 복원(`sessionManager.restore()`)도 그 자식의
  효과가 시작한다. 모듈 평가 시점에 두는 것은 설정 검증과, `STARTUP.ok`일 때의 e2e 변형 경고 표식(`markNativeWarningsForE2e` -
  루트 레이아웃보다 늦으면 먼저 평가된 모듈의 경고를 놓친다)과 스플래시 붙잡기
  (`preventAutoHideAsync` — 컴포넌트 안에서는 늦을 수 있다)뿐이다.

## 검증

`api.ts`의 배선 - 요청마다 기기 언어로 Accept-Language 를 싣는 것, 호출자가 정한 언어는 덮지 않는 것, e2e 변형에서만 실패 표식을 남기는
것 - 은 `test/unit/platform/api.test.ts`가 `vi.mock`으로 잰다(기기 모듈·설정 자리·`request`를 가짜로
바꾼다). 언어 조립·실패 한 줄·변형 표의 판단은 `lib/`의 시험이 잰다. `query-client.ts`의 인증 오류 배선은
`test/unit/platform/query-client.test.ts`가 실제 쓰기 캐시로 잰다(기기 모듈과 세션 관리자만 가짜다).

`updates.ts`의 배선 - expo-updates·expo-constants 의 값을 빌드 정보로 옮기는 것과 업데이트 확인의 세 호출 - 은
`test/unit/platform/updates.test.ts`가 `vi.mock`으로 잰다(기기 모듈과 설정 자리를 가짜로 바꾼다). 카드의 행과 확인의 순서는
`lib/updates/`의 시험이 잰다.

`e2e-diagnostics.ts`는 설정 검증을 통과한 `AppRoot`에서만 부른다. `test/unit/platform/e2e-diagnostics.test.ts`는
다른 세 변형에서 로그·AppState·QueryCache 구독이 없음을 잰다. 실제 QueryCache 알림과 구독 회수, 민감한 본문을
기록하지 않는 것, `ios-log.ts`가 정보 줄을 artifact의 `I/ReactNativeJS`로 보존하는 것도 잰다.
