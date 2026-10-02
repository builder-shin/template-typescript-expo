# app/ 작업 지침

루트 `AGENTS.md` 의 계층 표가 이 디렉터리에 준 것: **화면, 라우팅, 가드 배치.** 소유하지 않는 것: **fetch,
`request()` 호출, 쿼리 문자열 조립.**

## 라우트 파일만 둔다

Expo Router 는 이 디렉터리 아래의 `.tsx`·`.ts` 파일을 모두 라우트로 읽는다(설치본 expo-router 의 `require.context`
가 확장자로 거른다 - 이 문서는 라우트가 아니다). 판단 함수·타입·상수는 `lib/` 의 해당 계층에, 화면 조각은
`components/` 에 둔다. 라우트가 아닌 파일은 라우터의 특별 파일 둘뿐이다 - 레이아웃(`_layout.tsx`)과, 들어온 링크를
라우터 앞에서 바꾸는 `+native-intent.tsx`. 뒤의 것은 잇기만 하고 판단은 `lib/navigation/deep-link.ts` 에 있다.

## fetch 를 직접 하지 않는다

화면은 `queries/` 의 훅만 부른다 - `fetch` 나 `request()` 를 부르면 위반이다. 요청은 `platform/api.ts` 의
`apiRequest` 한 곳을 지나야 Accept-Language 가 실린다(스펙 9.4) - ESLint 가 `request` 를 값으로 import 하는 것을
막는다. 쿼리 문자열도 만들지 않는다 - 목록 조건의 주소는 `lib/resources/view.ts`(`filterHref` 등)가 만든다.

화면 파일에는 훅 호출과 JSX 만 둔다(스펙 8.4). 라우트 파라미터는 이름으로 꺼내고 목록은 `listRouteParams(…)` 로
거른다 - `test/unit/resources/route-params-usage.test.ts` 가 이 디렉터리를 훑어 막는다. 화면을 쌓는 이동은
`useNavigateOnce`(`components/app/navigate-once.ts`)를, 화면의 조회 훅은 `subscribed: useIsFocused()` 를 지난다.

## 라우트

| 파일                                       | 경로                   | 인증 | 무엇                                                                                                                    |
| ------------------------------------------ | ---------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------- |
| `_layout.tsx`                              | -                      | -    | 루트 - 설정 검증과 치명 오류 화면, 스플래시, 세션 복원, Query 캐시, 루트 Stack, 렌더 중 예외의 경계(`ErrorBoundary`)    |
| `+native-intent.tsx`                       | -                      | -    | 밖에서 들어온 딥링크를 앱 안 주소로 바꿔 라우터에 넘긴다                                                                |
| `+not-found.tsx`                           | 없는 경로              | 공개 | not-found                                                                                                               |
| `(app)/_layout.tsx`                        | -                      | -    | 앱 셸 - Stack 머리글·경로 가드·첫 pending login next 보존(R29)                                                          |
| `(app)/index.tsx`                          | `/`                    | 공개 | 홈 - 목록·실험실 진입, 빌드 정보 카드                                                                                   |
| `(app)/examples/index.tsx`                 | `/examples`            | 공개 | 목록                                                                                                                    |
| `(app)/examples/[id]/index.tsx`            | `/examples/[id]`       | 공개 | 상세                                                                                                                    |
| `(app)/examples/new.tsx`                   | `/examples/new`        | 필요 | 생성                                                                                                                    |
| `(app)/examples/[id]/edit.tsx`             | `/examples/[id]/edit`  | 필요 | 수정·삭제                                                                                                               |
| `(auth)/login.tsx` · `(auth)/register.tsx` | `/login` · `/register` | 공개 | 로그인·가입 - 돌아갈 곳이 없으면 머리글의 "홈으로"와 Android 의 뒤로 가기가 홈으로 간다(아래 "가드가 보낸 로그인 화면") |
| `(lab)/contract.tsx`                       | `/contract`            | 공개 | 계약 실험실                                                                                                             |

그룹 이름(`(app)`·`(auth)`·`(lab)`)은 경로에 조각을 더하지 않는다. 경로 가드는 `(app)/_layout.tsx` 안에 있어 `(app)`
아래의 화면만 지킨다 - 보호 경로를 더할 때는 화면을 `(app)` 아래에 두고 `lib/auth/protected-paths.ts` 에 패턴을 더한다.

## 가드가 보낸 로그인 화면

가드는 `decideGuard`·`decidePendingLogin`(`lib/auth/guard-latch.ts`)로 첫 로그인 목적지를 보존한다(R29) - 내비게이터가 준비되는 동안 홈 앵커가 잠깐 보여도 next를 잃지 않는다. 앱 셸의 로컬 pending 상태는 signedIn이면 해제된다. 가드의 `<Redirect>`는 루트에서 `(app)`을 로그인 화면으로 바꿔 끼운다 - 루트에 그 화면 하나만 남는다. 그래서
로그인·가입 뒤의 복귀는 `router.dismissTo(next, { withAnchor: true })` 로 `(app)` 을 새로 만든다. 돌아갈 곳이 없는
로그인·가입 화면은 머리글 오른쪽에 "홈으로"(`components/app/home-button.tsx`, testID `back-to-home-button`)를 두고,
Android 의 뒤로 가기를 홈으로 돌린다(`components/app/back-to-home.ts`) - iOS 에는 뒤로 가기 키가 없다.

## 렌더 중 예외

루트 레이아웃이 내보내는 `ErrorBoundary` 가 렌더 중 예외를 받는다(스펙 9.3) - 계약을 어긴 응답(문구 없는 오류 문서·본문
없는 성공 응답)과 코드의 결함이다. 화면은 Expo Router 의 기본 그대로이고(영어 - "Something went wrong"·"Retry"),
"Retry" 는 조회 캐시를 비운 뒤 경계를 푼다(`queries/error-boundary.ts`) - 캐시에 든 결함을 요청 없이 다시 던지지 않고
다시 부른다. 이 경계는 루트 레이아웃을 통째로 바꿔 그려, 떠 있는 동안 내비게이터가 없어 이동을 부를 수 없고, 풀린 뒤의
앱은 루트 Stack의 일반 초기 화면(홈)에서 새로 시작하며 cold 초기 URL은 다시 적용될 수 있다 - 그래서 출구를 따로 두지 않았다(스펙 9.3 의 D8 정정). 라우트 파일에
`ErrorBoundary` 를 더해 화면 단위 경계를 두면 그 경계의 다시 시도와 출구도 조회 캐시를 비워야 한다.

## 검증

화면은 단위 시험이 없다(스펙 11.1) - 판단은 `lib/` 의 시험이, 화면은 E2E(`test/e2e/flows/`)가 지킨다. 이 디렉터리를
훑는 정적 검사는 `test/unit/ui/breakpoints.test.ts`(미디어 쿼리 변형), `test/unit/resources/route-params-usage.test.ts`
(라우트 파라미터), `test/unit/lint/request-boundary.test.ts`(`request()`)다.
