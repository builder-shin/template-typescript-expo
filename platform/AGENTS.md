# platform/ 작업 지침

Expo·React Native 모듈을 부르고 React 에 잇는 자리다(스펙 5장). 판단을 두지 않는다 - 분기가
자라면 `lib/`로 옮기고 여기서는 부르기만 한다.

| 파일                        | 역할                                                                                                                  |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `config.ts`                 | 설정 자리를 `app.config.ts`의 `extra`로 돌리고 시작할 때 검증한다. 빌드 변형을 읽는다. 판단은 `lib/config/startup.ts` |
| `api.ts`                    | 앱의 API 클라이언트 `apiRequest`. Accept-Language 를 싣는 유일한 자리(스펙 9.4), e2e 변형의 실패 표식                 |
| `secure-session-storage.ts` | 세션 항목의 SecureStore 저장 매체                                                                                     |
| `session.ts`                | 세션 관리자 `sessionManager` 하나와 상태 훅 `useSessionStatus()`                                                      |
| `query-client.ts`           | Query 캐시 `queryClient` 하나와 기본 옵션(스펙 8.5)                                                                   |
| `theme.ts`                  | 내비게이션 테마                                                                                                       |

- 백엔드 요청은 전부 `apiRequest`를 지난다. `lib/jsonapi/client.ts`의 `request()`를 다른 곳에서
  직접 부르지 않는다.
- 세션 관리자는 `sessionManager` 하나다. 회전은 그 안에서만 일어난다(`lib/auth/AGENTS.md`).

## 부팅 순서

- `getSettings()`는 요청할 때만 부른다. 어떤 모듈도 최상위에서 부르지 않는다 - 루트 레이아웃이
  `loadStartupSettings()`로 설정 자리를 `extra`로 돌리기 전에 불리면 기본 자리(`process.env`)를 읽어
  던지고, 치명 오류 화면(`FatalConfig`) 대신 앱이 죽는다. 앱 런타임의 `process.env`에는
  `BACKEND_URL`이 없다.
- 요청으로 이어질 수 있는 훅(세션·Query, 앞으로의 AppState·NetInfo)은 루트 레이아웃의 `STARTUP.ok`
  갈래 안의 자식(`AppRoot`)에 둔다. 루트에 두면 설정이 틀린 앱에서 `request()`가 던지는 설정 오류가
  ErrorBoundary로 가서 치명 오류 화면을 가린다. 세션 복원(`sessionManager.restore()`)도 그 자식의
  효과가 시작한다. 모듈 평가 시점에 두는 것은 설정 검증과, `STARTUP.ok`일 때의 스플래시 붙잡기
  (`preventAutoHideAsync` — 컴포넌트 안에서는 늦을 수 있다)뿐이다.
