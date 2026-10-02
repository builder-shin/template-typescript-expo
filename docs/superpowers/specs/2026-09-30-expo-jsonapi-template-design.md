# Expo JSON:API 모바일 템플릿 설계

- 작성일: 2026-09-30
- 대상 저장소: `template-typescript-expo` (신규)
- 코어 출처: `template-typescript-nextjs` @ `34d0b1057d65693645e75bec4e9558dcf6838822`
- 소비하는 계약: 세 백엔드 템플릿의 통일된 JSON:API 1.1 계약
  - `template-python-fastapi` @ `3c4eee39a2f3b69f594b7d610b0a7a423433fbe0` (정본)
  - `template-typescript-nestjs` @ `4d49f3a8a6927550dd14b84fbb5f705c47012ae2`
  - `template-ruby-rails` @ `231576eeac21c583b2cc28532248223351f2c92f`

## 0. 이 문서의 위치

이 문서는 구현 전 설계의 정본이다. 계층 계약의 운용 정본은 구현 후 루트
`AGENTS.md`가 소유하고, 이 문서는 **왜 그 계약인가**를 소유한다.

측정은 모두 2026-09-30 에 수행했다. 위 네 커밋은 그날 각 저장소의 로컬
`main`과 GitHub `main`이 같은 커밋이었음을 `git ls-remote`로 확인한 값이다.
날짜가 붙은 측정은 그 시점의 관측이며, 계약이 바뀌면 이 문서가 아니라 새
측정이 정본이 된다.

## 1. 목적과 경계

### 1.1 무엇인가

`template-typescript-nextjs`와 **같은 계약, 같은 화면 범위**를 Android·iOS
네이티브 앱으로 제공하는 템플릿이다. 백엔드 전환은 `BACKEND_URL` 하나이고
어댑터 계층이 없다 — 세 백엔드의 공개 계약이 통일되어 있으므로 이 앱도 어느
백엔드를 상대하는지 몰라도 된다.

형제 템플릿과 같은 성질을 갖는다.

- 계층 소유권이 분리되어 있다(5장).
- 등록이 명시적이다 — 자원은 `lib/resources/index.ts`의 배열에 손으로 적는다.
- 실제 백엔드로 검증하는 단일 게이트가 있다(12장).
- 루트와 계층별 `AGENTS.md` 문서군을 갖는다(14장).

모바일이기 때문에 더하는 것은 다음이다.

- 기기 보안 저장소(SecureStore)의 세션과, 한 번에 하나만 도는 토큰 회전(7장)
- 딥링크로 재현되는 목록 조건, 무한 스크롤, 앱 복귀·네트워크 복귀 시 재조회(8장)
- EAS 빌드·스토어 제출 설정과 OTA 업데이트(10장)

### 1.2 무엇이 아닌가

**웹을 대상으로 하지 않는다.** 웹은 `template-typescript-nextjs`가 맡는다.
FastAPI·NestJS에는 CORS 설정이 없고(Next.js 스펙 2.2의 측정),
`application/vnd.api+json`은 항상 브라우저 preflight를 일으키므로, 웹 타깃은
백엔드 호출을 중계할 서버를 따로 요구한다. 그러면 호출 경로가 네이티브·웹
두 갈래로 나뉜다(2장 결정 1).

**백엔드를 바꾸지 않는다.** 세 백엔드 저장소에 커밋하지 않는다. 그래서
백엔드 표면이 없는 기능은 넣지 않는다 — 예를 들어 **푸시 알림**은 기기 토큰을
등록할 표면이 없다.

그 밖에 넣지 않는 것:

| 넣지 않는 것 | 이유 |
| --- | --- |
| 생체 인증 잠금, 오프라인 읽기 캐시 | 사용자 결정(2장 결정 2) |
| 제네릭 화면 생성기 | Next.js 스펙 1.1과 같다 — 화면은 선언을 읽지만 손으로 쓴다 |
| OpenAPI 기반 클라이언트 생성, 백엔드별 어댑터 | 계약이 통일되어 있다 |
| 모킹 계층(MSW 등) | 실제 백엔드로 검증한다 |
| 프론트엔드 i18n 라이브러리, 오류 문구 카탈로그 복제 | 오류 문구는 백엔드가 협상한다(9장) |
| 컴포넌트 단위 테스트 | 판단을 `lib/`에 두고 화면은 E2E가 지킨다(11.1) |
| Expo Go 호환 보장 | 개발은 development build(`expo-dev-client`) 기준이다 |

## 2. 결정 기록 (2026-09-30 사용자 확정)

| # | 결정 | 선택 | 버린 대안 |
| --- | --- | --- | --- |
| 1 | 대상 플랫폼 | Android + iOS | Android + iOS + Web — 웹은 중계 서버가 필요해 호출 경로가 둘이 된다 |
| 2 | 모바일 추가 기능 | EAS 빌드·스토어 제출 설정, OTA 업데이트 | 생체 인증 잠금, 오프라인 읽기 캐시 — 선택하지 않았다 |
| 3 | 접근 | Next.js 코어를 복사하고 앱 계층은 Expo 표준으로 만든다 | 데이터 계층 직접 구현 / 코어 없이 새로 작성(jest-expo·RNTL·Detox) |

결정 3에서 버린 두 대안의 이유:

- **데이터 계층 직접 구현**: Next.js의 "상태 관리 라이브러리 없음"을 그대로
  옮기는 안이다. 그러나 RN에는 서버 컴포넌트가 없어 로딩·오류·재조회·무한
  스크롤을 누군가 소유해야 하고, 그것을 직접 만들면 템플릿 사용자가 이 저장소만의
  캐시 규칙을 따로 배워야 한다.
- **새로 작성**: 같은 계약의 해석이 둘이 된다 — 어드민 템플릿 스펙 3.2가 같은
  이유로 버린 안이다. 이미 검증된 테스트 자산도 쓸 수 없다.

## 3. 확정 스택

런타임 버전은 `expo@57.0.26` 패키지의 `bundledNativeModules.json`(측정
2026-09-30)을 따른다. 그 밖의 버전은 같은 날 npm `latest`다. 구현은 설치
시점의 SDK 57 호환 버전을 `npx expo install`로 받는다.

| 영역 | 선택 | 측정한 버전 |
| --- | --- | --- |
| 런타임 | Expo SDK 57, New Architecture | `expo` 57.0.26 · `react-native` 0.86.3 · `react` 19.2.3 |
| 라우팅 | Expo Router (파일 기반, typed routes) | `expo-router` ~57.0.24 |
| 언어 | TypeScript strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` | Next.js와 같은 설정 |
| 패키지 | pnpm, Node ≥ 24.11 | `pnpm@11.22.0` (형제 저장소와 같음) |
| 스타일 | Uniwind (Tailwind v4) | `uniwind` 1.12.0 · `tailwindcss` 4.3.3 |
| 컴포넌트 | React Native Reusables — shadcn/ui의 RN 이식판, 저장소로 복사되는 코드 | `@react-native-reusables/cli` 0.7.1 (`--styling-library uniwind` 지원) |
| 아이콘 | lucide-react-native | 1.49.0 |
| 데이터 | TanStack Query | `@tanstack/react-query` 5.104.0 |
| 세션 저장 | expo-secure-store | ~57.0.4 |
| 로캘 | expo-localization | ~57.0.2 |
| 네트워크 상태 | @react-native-community/netinfo | 12.0.1 |
| OTA | expo-updates | ~57.0.24 |
| 빌드·제출 | EAS (`eas.json`) | `eas-cli` 24.8.0 |
| 단위·계약 테스트 | vitest (node) | 5.0.2 |
| E2E | Maestro CLI | 2.11.0 (2026-09-29 릴리스) |
| 품질 | ESLint · Prettier · secretlint | 형제 저장소와 같은 계열 |

> 정정(2026-09-30, D1): 품질 도구의 ESLint 는 **9**다(형제 저장소는 10). eslint-config-expo 57 이
> 의존하는 eslint-plugin-react 7.37·eslint-plugin-import 2.x 의 peer 가 ESLint 9 까지다. 그리고
> eslint-config-expo 위에 typescript-eslint 의 설정을 그대로 얹으면 `@typescript-eslint` 플러그인
> 재등록으로 ESLint 가 죽어서, typescript-eslint 에서는 규칙만 가져온다 - `eslint.config.js` 머리말.

> 정정(2026-09-30, D1): pnpm 링커는 hoisted 다(`pnpm-workspace.yaml`의 `nodeLinker: hoisted`). 기본
> isolated 링커에서도 Metro 번들(`expo export`)과 expo-doctor 는 통과했지만(실측 M5), Windows 에서
> Android Release 빌드(Gradle·CMake·ninja)가 `node_modules/.pnpm` 의 긴 경로를 감당하지 못해 저장소를
> 6자 경로에 두어도 실패했다. hoisted 에서만 빌드가 성공했다(실측 M1 - M5 의 재판정). pnpm 11 은
> `.npmrc` 의 `node-linker` 를 읽지 않으므로 설정은 `pnpm-workspace.yaml` 에 둔다. 경로 길이 제한은
> 16장의 정정.

**스타일을 Uniwind로 고른 이유:** 형제 템플릿은 Tailwind v4와 shadcn/ui를
쓴다. NativeWind 4.2.7(`latest`)은 `react-native-css-interop`을 거쳐
`tailwindcss ~3`을 요구하고, Tailwind v4를 쓰는 NativeWind 5는 아직 RC다.
Uniwind 1.x는 Tailwind v4를 요구하는 안정판이고, React Native Reusables가
스타일 라이브러리로 공식 지원한다. 그래서 디자인 토큰을 형제 저장소와 같은
Tailwind v4 형식으로 둘 수 있다.

**측정한 로컬 개발 환경 (2026-09-30):** Node 24.19.0, pnpm 11.22.0,
OpenJDK 17.0.20, Android SDK(platforms `android-36`·`android-37.0`,
build-tools 35.0.0·36.0.0, AVD `Pixel_9_API_36`), Docker 29.7.2. Maestro는
설치되어 있지 않다. 개발 머신이 Windows라 iOS 시뮬레이터는 로컬에서 돌 수
없다 — iOS 검증은 CI의 macOS 러너가 맡는다(13장).

## 4. 디렉터리 구조

```text
app/                          화면 = 라우트 (Expo Router). 라우트 파일만 둔다
  _layout.tsx                 루트 — QueryClient·세션 Provider, 스플래시, 오류 경계
  (app)/_layout.tsx           앱 셸 — Stack 헤더(제목, 로그인 시 로그아웃 버튼), 보호 경로 가드
  (app)/index.tsx             홈 — 목록·실험실 진입, 빌드 정보 카드
  (app)/examples/index.tsx    목록
  (app)/examples/[id]/index.tsx   상세
  (app)/examples/new.tsx      생성 (보호)
  (app)/examples/[id]/edit.tsx    수정·삭제 (보호)
  (auth)/login.tsx · (auth)/register.tsx
  (lab)/contract.tsx          계약 실험실
  +not-found.tsx
components/
  ui/                         React Native Reusables 복사본
  resource/                   자원 선언을 읽어 그리는 획일 UI
  form/                       field-error · form-banner · submit-button
lib/                          순수 TypeScript — react·react-native·expo import 금지
  jsonapi/                    문서·정규화·쿼리·오류·HTTP (복사)
  resources/                  자원 선언·거울·목록/상세/폼 판단 (복사)
  auth/                       토큰·자격증명·흐름·회전 판단 (일부 복사) + 세션 저장소·관리자 (신규)
  lab/                        계약 실험실의 실험 정의와 결과 표현 (Next.js app/(lab)에서 옮겨 복사)
  config/                     설정 검증 (복사)
platform/                     런타임 바인딩 — Expo 모듈 호출과 React Provider
queries/                      TanStack Query 키·조회/쓰기 훅·무효화 규칙
test/
  unit/                       vitest — lib/ · queries/ 의 순수 부분 · scripts
  contract/                   vitest — 실제 백엔드에 HTTP로 거는 계약 거울
  e2e/                        Maestro 플로 · 스택 하네스 · SQL 시드
  fixtures/
scripts/
  check.sh                    단일 게이트
  check-citations.sh          인용 검사 (복사)
  check-provenance.sh         복사 출처 기록 검사 (신규)
docker-compose.e2e.yml        Next.js의 파일에서 web 서비스를 뺀 것
app.config.ts · eas.json · metro.config.js · global.css
docs/provenance/copied-core.json
docs/superpowers/specs/ · plans/ · notes/
```

**`app/`에는 라우트 파일만 둔다.** Expo Router는 `app/` 아래의 모든 파일을
라우트로 취급한다. Next.js는 `app/(lab)/contract/experiments.ts`·`result.ts`,
`app/(app)/examples/paths.ts`처럼 순수 판단 파일을 `app/` 안에 두었는데, 이
저장소에서는 그 자리에 둘 수 없다. 그런 파일은 `lib/`의 해당 계층으로 옮긴다.

`android/`·`ios/`는 커밋하지 않는다(10.4).

> 정정(2026-09-30, D1): 트리에 `components/app/` 이 없다 - 앱 전체에 걸린 화면 조각(시작 설정 오류
> 화면 `FatalConfig` 등)을 두는 디렉터리다. React Native Reusables 복사본(`ui/`)도 자원 UI(`resource/`)도
> 아니어서 따로 뒀다. 소유 규칙은 루트 `AGENTS.md` 의 표에 있다.

> 정정(2026-09-30, D2): 루트 `_layout.tsx` 의 "세션 Provider" 는 Context Provider 가 아니다. 회전이 한
> 곳에서 일어나야 해서(7.2) 세션 관리자는 `platform/session.ts` 에 하나뿐이고, Context 로 내려보낼 값이
> 없다. 화면은 `useSessionStatus()`(`useSyncExternalStore`)로 상태를 읽는다. 루트 레이아웃은 설정 검증이
> 통과했을 때만 스플래시를 붙잡고, 그 갈래에서만 그리는 자식이 `sessionManager.restore()` 를 부르며
> `QueryClientProvider` 로 감싼다. 복원이 끝나면 스플래시를 내린다. 시작 설정의 판단은
> `lib/config/startup.ts` 에 있다(`platform/config.ts` 는 `expo-constants` 와 설정 자리 바인딩만 한다).

> 정정(2026-09-30, D3): 트리에 둘을 더한다. `lib/navigation/` 은 밖에서 들어온 딥링크를 앱 안 주소로 바꾸는
> 판단(`deep-link.ts`)을 둔다 - 자원에 매이지 않는다(로그인의 `next` 처럼 인코딩한 값을 싣는 인증 딥링크도 같은 길을
> 지난다). `app/+native-intent.tsx` 는 Expo Router 의 특별 파일(라우트가 아니다)로, 들어온 링크가 라우터에 닿기
> 전에 그 판단을 잇기만 한다 - 이 빌드의 scheme 은 `platform/config.ts` 가 `expo-constants` 에서 읽는다. 까닭은
> 8.2 의 둘째 D3 정정, 소유 규칙은 루트 `AGENTS.md` 의 표다.

> 정정(2026-10-01, D5): 트리에 `components/lab/` 이 없다 - 계약 실험실 화면(`app/(lab)/contract.tsx`)의 조각, 곧 실험 카드와
> 결과 표시(`experiment-card.tsx`)를 두는 디렉터리다. 자원 UI(`resource/`)도 폼 조각(`form/`)도 아니어서 따로 뒀다. 트리의
> `lib/lab/` 에는 실험 정의와 결과 표현(복사)에 더해 실험을 요청으로 돌리는 실행부(`run.ts`)가 있고, 실험 하나를 돌리는 쓰기
> 훅은 `queries/lab.ts` 다(8.6 의 D5 정정). 소유 규칙은 루트 `AGENTS.md` 의 표다.

> 정정(2026-10-01, D6): 트리에 셋을 더한다. `lib/updates/` 는 홈의 빌드 정보 카드(10.6)의 판단 - 카드의 행, "업데이트
> 확인" 의 순서(확인 → 받기 → 다시 켜기)와 문구 - 이고, expo-updates 의 값과 호출은 `platform/updates.ts` 가
> 넘긴다. 이 실행의 값을 다루고 설정 계약이 아니어서 `lib/config/` 에 두지 않았다. `lib/config/updates.ts` 는 OTA
> 설정의 판단(10.6 의 D6 정정)이고, `scripts/check-variant-config.mjs` 는 게이트 8단계의 변형별 설정 검사(12장의 D6
> 정정)다. 소유 규칙은 루트 `AGENTS.md` 의 표다.

> 정정(2026-10-01, D7): 트리에 `.github/` 가 없다 - `.github/workflows/ci.yml` 하나가 13장의 CI 다(잡이 하는 일의 정본은
> 스크립트이고 워크플로는 러너·캐시·아티팩트만 정한다 - `.github/workflows/AGENTS.md`). `test/e2e/` 에는 Android
> 하네스(`run-android.sh`·`android.sh`) 옆에 iOS 하네스(`run-ios.sh`·`ios.sh`·`ios-log.ts`), Docker 없는 백엔드
> (`native-backend.sh`), 백엔드 종류 검증(`matrix.ts` - Next.js 에서 원본 그대로), 요청 타임아웃 확인(`stall-server.ts`·
> `checks/`), Maestro 설치(`install-maestro.sh`)가 산다.

> 정정(2026-10-02, D7): 트리에 `plugins/`를 더한다. 생성된 네이티브 프로젝트 파일을 고치는 Expo 설정 플러그인의
> 자리이며 판단·화면·네트워크를 두지 않는다(루트와 `plugins/AGENTS.md`). `with-android-splash-exit.ts`는 Expo splash
> 플러그인 뒤에서 모든 변형의 Kotlin MainActivity에 API 31 이상의 exit listener 해제를 넣는다. 소스는 Node type
> stripping으로 평가할 수 있어야 한다. 앵커와 업그레이드 뒤 확인법은 `plugins/AGENTS.md`, 원인과 대가는 16장의
> D7 실측 정정이다.

## 5. 계층 소유권

| 위치 | 소유하는 것 | 소유하지 않는 것 |
| --- | --- | --- |
| `lib/jsonapi/` | 문서 파싱, `included` 정규화, 쿼리 직렬화, 오류 분류, HTTP 협상 | 자원별 지식, 화면, 네이티브 모듈 |
| `lib/resources/` | 자원 선언, 목록·상세·폼 판단 | JSX, fetch, 네이티브 모듈 |
| `lib/auth/` | 세션 모델과 직렬화, 만료 판정, 회전 결정, 자격증명 문서, 보호 경로 목록 | 저장 매체, 화면 이동 |
| `lib/lab/` | 실험 정의, 결과 표현 | 화면, 세션 |
| `platform/` | SecureStore·로캘·AppState·NetInfo·Updates·Constants 호출, React Provider, API 클라이언트 조립 | 판단 |
| `queries/` | 캐시 키, 조회·쓰기 훅, 쓰기 후 무효화 | JSX, 쿼리 문자열 조립 |
| `app/` | 화면, 라우팅, 가드 배치 | fetch, `request()` 호출, 쿼리 문자열 조립 |
| `components/resource/` | 선언을 읽어 만드는 획일 UI | 자원 이름으로 분기 |

위반의 정의:

- `lib/**`에서 `react`·`react-native`·`expo`·`expo-*`·`@expo/*`·
  `@react-native*`를 import하면 위반이다. ESLint `no-restricted-imports`가
  강제한다. `lib/`가 node의 vitest에서 그대로 돌아야 복사한 테스트가 유효하다.
- `lib/jsonapi/`에 이 저장소의 실제 자원 이름 문자열이 코드로 나타나면 위반이다
  (Next.js와 같다).
- `lib/resources/*.ts`에 JSX가 있으면 위반이다.
- `app/`에서 `fetch`나 `request()`를 직접 부르면 위반이다. 화면은 `queries/`의
  훅만 쓴다.
- `queries/`에 JSX가 있거나 쿼리 문자열을 조립하면 위반이다. 요청 조립은
  `lib/resources`의 `listRequest()`·`detailRequest()`·`referenceRequest()`가 한다.
- `components/resource/*`에 자원 이름으로 분기하는 코드가 있으면 위반이다.
- `platform/`에 분기 판단이 자라면 위반이다. 판단은 `lib/`로 옮기고
  `platform/`은 호출과 배선만 한다.

> 정정(2026-09-30, D2): `lib/**`의 위반이 둘 더 있다. (1) `@react-navigation/*`를 import하면 위반이다 - 첫
> 항목의 플랫폼 모듈에 든다. (2) `lib/`는 맨 아래 계층이라 위 계층(`platform/`·`queries/`·`components/`·
> `app/`)을 import하면 위반이다. 별칭(`@/queries/auth`)이든 상대 경로(`../../queries/auth`)든, 하위 경로든
> 맨 디렉터리(`@/queries`)든 ESLint `no-restricted-imports`가 막는다. 시험이 위 계층을 `vi.mock`하면 vitest까지
> 통과해도 경계가 무너지기 때문이다. 경로의 이름만 보므로 `lib/` 안에 이 네 이름의 디렉터리를 두지 않는다
> (`firebase/app` 같은 패키지 경로는 막지 않는다).

`lib/resources/index.ts`는 손으로 채우는 배열이다. **여기 없으면 그 자원은
존재하지 않는 것과 같다** — 백엔드의 `config/routes.py`·`ENTITIES`·
`MIGRATIONS`, Next.js의 같은 파일과 같은 계약이다. 자동 탐색을 쓰지 않는다.

## 6. 코어 조달 — 복사해 독립

### 6.1 결정

`template-typescript-nextjs`의 순수 코어와 그 단위 테스트를 **복사한다.** 두
저장소는 코드 의존이 없다. 공유 패키지로 만들지 않는 이유는 어드민 스펙 3.2와
같다 — 성숙한 저장소를 재구조화해야 하고, 버전·배포 인프라가 생기고, "클론하면
돈다"가 깨진다. 정합성은 공유 코드가 아니라 계약 거울과 실제 백엔드 E2E가
지킨다.

### 6.2 복사 대상 (출처 커밋 `34d0b10`에서 측정)

**그대로 복사하는 것** — 플랫폼 의존이 없다(측정: `next/*` import 없음).

| 경로 | 비고 |
| --- | --- |
| `lib/jsonapi/document.ts` · `normalize.ts` · `query.ts` · `errors.ts` | |
| `lib/resources/define.ts` · `example.ts` · `category.ts` · `tag.ts` · `index.ts` · `mirror.ts` | |
| `lib/auth/tokens.ts` | JWT를 해석하지 않고 `expiresIn`에 받은 시각을 더한다 — 기기 시계의 절대 오차와 무관하다 |
| `test/fixtures/documents.ts` | |
| `test/unit/jsonapi/document` · `normalize` · `query` · `errors` · `error-routing` 테스트 | |
| `test/unit/resources/define` · `mirror` · `resources` 테스트, `invariants.ts` | |
| `test/unit/auth/tokens` 테스트 | |
| `test/e2e/seed/examples.sql` · `examples.rails.sql`, `test/e2e/probe-email.ts` 와 그 테스트 | |

**복사한 뒤 고치는 것** — 달라지는 곳은 전부 6.3의 이탈 기록에 남긴다.

| 경로 | 고치는 이유 |
| --- | --- |
| `lib/jsonapi/client.ts` (+ 테스트) | 설정 출처가 `process.env`가 아니라 `app.config.ts`의 `extra`다. `cache: 'no-store'`는 RN fetch에 해당하지 않는다. 모든 요청에 15초 타임아웃을 둔다(8.5) |
| `lib/config/settings.ts` (+ 테스트) | 같은 검증을 `app.config.ts`(빌드 시점)와 앱 시작 시점이 함께 쓴다(10.1) |
| `lib/resources/view.ts` · `form.ts` (+ 테스트) | 입력이 `FormData`가 아니라 폼 상태 객체다. 목록은 cursor 방식이다(8.3) |
| `lib/auth/credentials.ts` · `flow.ts` · `logout.ts` · `rotation.ts` · `form-state.ts` (+ 테스트) | 입력이 `FormData`가 아니다(`form-state.ts`의 `AuthFormAction`은 Server Action 모양이다). 쿠키 대신 세션 저장소를 쓴다. 회전 실행 자리가 `proxy.ts`가 아니라 세션 관리자다(7.2) |
| `scripts/check-citations.sh` (+ `test/unit/scripts/check-citations.test.ts`) | 검사 대상 경로를 이 저장소의 계층(`app/`·`components/`·`lib/`·`platform/`·`queries/`·`test/`)으로 바꾼다 |
| Next.js `app/(lab)/contract/experiments.ts` · `result.ts` (+ 테스트) → `lib/lab/` | `app/`에 둘 수 없다(4장). 커서 순회 실험이 offset 순회로 바뀐다(8.6) |
| Next.js `test/e2e/matrix.ts` (+ 테스트) | 백엔드 종류 검증은 그대로, 하네스가 Maestro다 |
| Next.js `docker-compose.e2e.yml` | `web` 서비스를 뺀다. compose 프로젝트 이름을 바꾼다 |

**복사하지 않는 것**: `lib/auth/session.ts`(`next/headers`), `lib/auth/guard.ts`
(`next/navigation`), `proxy.ts`, `app/**`의 화면, `components/**`(DOM), 그리고
그것들의 테스트. `lib/utils.ts`는 React Native Reusables가 자기 `cn`을 가져오므로
복사하지 않는다.

> 정정(2026-09-30, D1): "복사한 뒤 고치는 것" 표의 `lib/jsonapi/client.ts` 행은 "`cache: 'no-store'`는
> RN fetch에 해당하지 않는다"고 적었다. 앱의 전역 `fetch` 는 RN 의 폴리필이 아니라 SDK 57 의
> `expo/fetch` 다(winter 런타임이 바꿔 끼운다. `EXPO_PUBLIC_USE_RN_FETCH=1` 일 때만 RN 의 whatwg-fetch
> 폴리필이 남는다). `expo/fetch` 는 `cache` 를 읽지 않아 넘겨도 무시되고, RN 폴리필은 no-store·no-cache 인
> GET·HEAD 의 URL 에 `_=<시각>` 을 붙인다. 어느 쪽이든 캐시 정책은 TanStack Query 가 소유하므로(8.5) `cache` 를
> 넘기지 않는 결정은 그대로다. 네이티브 HTTP 캐시(Android OkHttp·iOS URLCache)는 응답 헤더를
> 따른다(미측정 - D2 가 잰다). 사실 문장과 소스의 파일·줄은 `docs/provenance/copied-core.json` 의
> `lib/jsonapi/client.ts` 이탈 기록과 실측 기록 M6 에 있다.

> 정정(2026-09-30, D2): 위 정정의 "(미측정 - D2 가 잰다)" - 세 백엔드가 `GET /api/v1/users/me`·목록·상세에
> 싣는 캐시 헤더는 `docs/superpowers/notes/2026-09-30-d2-measurements.md` 의 H1 에 있다. 네이티브 캐시가 그
> 헤더대로 도는지는 기기에서 재지 않았다 - D2 앱의 요청은 전부 POST 라 저장되지 않는다. 앱에 GET 이 생기는
> D3 가 목록·상세의 신선도와 함께 잰다.

### 6.3 출처 기록과 검사

어드민 템플릿의 `docs/provenance/copied-core.json` 형식을 그대로 쓴다(아래는
형식이고, 값은 1단계가 채운다).

```json
{
  "source": "https://github.com/builder-shin/template-typescript-nextjs",
  "commit": "34d0b1057d65693645e75bec4e9558dcf6838822",
  "copiedAt": "…",
  "paths": ["…"],
  "note": "…",
  "divergences": [{ "path": "…", "what": "…", "why": "…" }]
}
```

사람이 아니라 **검사가** 이 기록을 확인한다. 게이트의 복사 출처 단계
(`scripts/check-provenance.sh`)가 다음을 강제한다.

1. 파일이 있고 JSON으로 읽힌다.
2. `commit`이 40자리 16진수다.
3. `paths`의 모든 경로가 저장소에 실재한다.
4. 모든 `divergences[].path`가 `paths` 안에 있고, `what`·`why`가 비어 있지 않다.

원본에서 계약 버그가 고쳐지면 이 커밋과 원본을 비교해 반영 여부를 판단한다.

> 정정(2026-09-30, D1): 검사 스크립트는 `scripts/check-provenance.sh`가 아니라
> `scripts/check-provenance.mjs`다 - JSON 을 읽어야 해서 node 로 썼다. 검사하는 네 가지는 같다.

> 정정(2026-09-30, D2): 검사가 다섯이 됐다. 5. `divergences`가 없는 경로는 기록의 `sourceBlobs`에 원본
> 파일의 git blob SHA-1(`git rev-parse <commit>:<경로>`)을 적고, 작업 트리의 파일이 그 값과 같아야 한다.
> 이탈이 있는 경로는 `sourceBlobs`에 두지 않는다. 형식만 보는 네 검사로는 그대로 복사한 파일을 고치고
> 이탈을 적지 않아도 게이트가 통과했다. 값은 git이 저장할 내용으로 잰다 - 작업 트리의 바이트에서 CRLF를
> LF로 바꾼 것이다. `.gitattributes`의 `* text=auto eol=lf`가 체크아웃을 LF로 두고 add할 때 CRLF를 LF로
> 바꿔 저장하므로 `git hash-object <경로>`와 같고, 편집기가 CRLF로 저장한 사본도 내용이 같으면 원본
> 그대로다(NUL이나 홀로 선 CR이 있는 파일은 git이 이진으로 보고 바꾸지 않으므로 바이트 그대로 잰다).
> 3의 "실재한다"는 저장소 안의 일반 파일이라는 뜻이다 - 절대 경로, 드라이브 문자로 시작하는 경로, `..` 구간이
> 있는 경로는 거절한다.

## 7. 인증과 세션

백엔드 계약은 Next.js 스펙 2.1과 같다 — `POST /api/v1/auth/register`(201, 토큰
없음) · `login` · `refresh`(회전, 구 토큰 즉시 폐기) · `logout`(204). Next.js가
쿠키와 `proxy.ts`로 풀던 문제를 기기 안에서 다시 푼다.

### 7.1 저장

- 세션은 SecureStore **항목 하나**에 JSON으로 저장한다 — `accessToken`,
  `refreshToken`, `accessExpiresAt`, `refreshExpiresAt`. 회전은 두 토큰을 한꺼번에
  바꾸는데, 항목이 둘이면 두 쓰기 사이에 앱이 종료될 때 새 refresh를 잃을 수 있다.
- 보관 등급은 `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY` — 다른 기기로 옮겨지지 않는다.
  Android 자동 백업에서는 `expo-secure-store` config plugin의 백업 제외 설정으로
  뺀다.
- 만료 시각은 받은 순간의 기기 시각에 `expiresIn`·`refreshExpiresIn`을 더해
  계산한다(`tokens.ts` 복사, `refreshExpiresAt`은 새 파일이 더한다).
- 앱이 켜지면 SecureStore를 읽는 동안 스플래시를 유지한다(`expo-splash-screen`,
  텍스트 없음). 저장된 JSON이 형식에 맞지 않거나 refresh가 이미 만료됐으면
  로그아웃 상태로 시작한다. 이 판단은 `lib/auth/session-store.ts`의 순수 함수가
  한다.
- 토큰은 로그에 쓰지 않는다. refresh token은 `/auth/refresh`·`/auth/logout` 외의
  요청에 실리지 않는다.

### 7.2 회전은 한 곳에서, 한 번에 하나만

백엔드는 회전 시 구 refresh token을 즉시 폐기한다. 동시 요청이 각자 회전하면
두 번째부터 `TOKEN_REVOKED`로 실패해 사용자가 이유 없이 로그아웃된다 —
Next.js가 회전을 `proxy.ts` 한 곳으로 모은 이유(스펙 7.2)와 같다. 이 저장소에서
그 한 곳은 `lib/auth/session-manager.ts`다.

```text
인증이 필요한 요청 → sessionManager.getAccessToken()
  세션 없음                         → null (호출자는 인증 필요 오류로 처리)
  access 만료까지 60초 이하         → rotate()
    진행 중인 회전이 있다          → 그 Promise를 같이 기다린다
    POST /auth/refresh → interpretRotationOutcome (Next.js 복사)
      성공          → 새 세션을 저장소에 먼저 쓰고, 그다음 반환한다
      인증 거절     → 세션 삭제 → signedOut 알림
      닿지 못함     → 세션을 건드리지 않고 현재 access를 반환한다
```

- `/auth/refresh`를 부르는 코드는 회전 함수 하나뿐이다. 동시 호출 두 개가 refresh
  요청을 한 번만 내는 것, 저장이 반환보다 먼저인 것을 단위 테스트로 고정한다.
  저장소·fetch·시계는 주입해서 node에서 잰다.
- **401을 받았을 때 회전해서 재시도하지 않는다**(Next.js와 같다). 만료 60초 전에
  미리 회전하므로 만료로 인한 401은 드물다. 인증 오류 코드
  (`AUTHENTICATION_REQUIRED`·`INVALID_TOKEN`·`TOKEN_EXPIRED`·`TOKEN_REVOKED`)를
  받으면 세션을 지우고 로그인으로 보낸다(9.2).
- 앱이 다시 앞으로 나오면 TanStack Query가 재조회하고(8.5), 그 요청이 위 경로를
  지나면서 필요하면 회전한다. 백그라운드 타이머를 두지 않는다.
- 읽기는 공개이므로 토큰 없이 보낸다(Next.js 8.2와 같다).

> 정정(2026-10-01, D4): 회전 응답의 5xx·408·429 는 "닿지 못함"처럼 세션을 건드리지 않는다 - 백엔드(나 그 앞의
> 프록시)가 응답은 했지만 refresh token 을 판정하지 않은 것이라 위 표의 "인증 거절"이 아니다. 원본의
> `interpretRotationOutcome` 은 상태 0 이 아닌 실패를 전부 파기로 모아, 30일 세션이 회전 순간의 502 하나로 끝났다
> (`lib/auth/rotation.ts` 의 이탈 기록). 나머지 4xx 는 그대로 파기한다. 대가: 서버가 회전을 마친 뒤 5xx 를 냈다면
> 앱은 옛 refresh 를 들고 있다가 다음 회전에서 재사용 감지에 걸려 그 사용자의 세션이 전부 끊긴다 - 7.5 의 첫
> 한계와 같은 모양이다. 이 보호가 쓰기에 닿는 길은 쓰기의 만료 가드(`lib/resources/write.ts`)뿐이다: 회전이
> 판정을 받지 못하면(5xx·408·429·닿지 못함 어느 쪽이든) 세션 관리자는 지금의 access 를 그대로 돌려주는데, access 는
> 짧고(백엔드 기본 15분) 쓰기만 그 토큰을 쓰므로 회전이 필요한 순간에는 이미 만료돼 있는 일이 흔하다. 그 토큰을 실은
> 쓰기는 백엔드가 401 로 거절해 세션을 지운다 - 회전의 502 하나가 쓰기 한 번 늦게 로그아웃이 되는 길이다. 그래서
> 쓰기는 받은 토큰의 세션이 이미 만료됐으면 요청하지 않고 앱 문구로 알린다 - 세션 거절이 아니라 다시 제출할 수 있는
> 실패이고 세션은 그대로다. refresh 가 계속 판정을 받지 못하는 동안 쓰기는 다시 시도만 보이고 로그아웃되지 않는다 -
> 의도한 쪽이다. 회전은 쓰기(D4)가 처음 부른다 - E2E 는 백엔드의 access 수명을 10초로 줘서 쓰기마다 실제 회전을
> 지난다(11.3 의 D4 정정).

### 7.3 가드는 두 겹

1. **경로 가드.** 보호 경로 목록은 `lib/auth/protected-paths.ts`에 **하나만**
   둔다 — `/examples/new`, `/examples/[id]/edit`(Next.js
   `PROTECTED_PATH_PATTERNS`와 같은 범위). `(app)/_layout.tsx`가 현재 경로를 이
   목록과 대조해 세션이 없으면 `/login?next=<원래 경로>`로 보낸다. 로그인 후
   `next`로 돌아온다. `next`는 Next.js `safeRedirectTarget`(복사)으로 검사해 앱
   내부 경로만 받는다 — 딥링크로 외부 URL이 들어오는 것을 막는다.
2. **쓰기 가드.** 쓰기 훅은 요청 전에 세션을 다시 확인하고 없으면 로그인으로
   보낸다(Next.js의 Server Action `requireSession()` 자리). 경로 가드는 화면
   전환 시점의 판단이라 그 사이에 세션이 사라지는 경우를 못 본다.

목록·상세·실험실은 공개다. 실험실에서 세션이 필요한 실험을 익명으로 누르면
로그인으로 이동한다 — 그 이동 자체가 실험실이 실증하는 계약의 일부다(Next.js와
같다).

> 정정(2026-10-01, D4): 경로 가드가 보호 경로와 대조하는 것은 `usePathname()` 이 아니라 라우트 모양이다 -
> `useSegments()` 에서 그룹을 뺀 `/examples/[id]/edit`(`lib/auth/protected-paths.ts` 의 `routePattern`).
> `usePathname()` 은 파라미터 값을 풀어 경로를 다시 만들어, id 에 `/` 가 들면(`/examples/a%2Fb/edit`) 보호 경로를
> 벗어났다. `next` 로 싣는 것은 그대로 `usePathname()` 이다. 가드의 `<Redirect>` 는 루트에서 `(app)` 을 로그인
> 화면으로 바꿔 끼워 루트에 그 화면 하나만 남긴다 - 앱 안의 "새로 만들기"·"수정" 에서 막힌 사용자는 돌아갈 화면이
> 없다. Android 에서는 하드웨어 뒤로 가기가 앱을 닫았다: 로그인·가입 화면은 돌아갈 곳이 없을 때의 뒤로 가기를 홈으로
> 보낸다(`components/app/back-to-home.ts`). iOS 에는 하드웨어 뒤로 가기가 없어 그 처리가 닿지 않는다.

> 정정(2026-10-01, D4): iOS 에서 가드가 보낸 로그인·가입 화면을 빠져나오는 길은 헤더 오른쪽의 "홈으로" 버튼이다
> (`components/app/home-button.tsx`, testID `back-to-home-button`). 앞 정정의 뒤로 가기 처리는 Android 의 하드웨어 뒤로
> 가기에만 닿는다 - iOS 에는 그 키가 없고, 루트에 화면이 하나뿐이면 헤더에도 뒤로 가기 버튼이 없어 로그인하거나 가입하는
> 것 말고는 길이 없었다. 버튼은 뒤로 가기와 같은 이동(`goHome` - `router.dismissTo('/', { withAnchor: true })`)으로 홈에
> 가고, Android 에도 같은 버튼이 있다. 내비게이터가 헤더(`headerRight`)에 넘기는 `canGoBack` 이 거짓일 때만 그린다 -
> 뒤로 갈 화면이 있어 네이티브 뒤로 가기 버튼이 보이면 숨기고, 값을 모르면 그린다. 가드가 보낸 화면은 앞 정정대로 루트에
> 혼자라 그 값이 거짓이고 버튼이 보인다.

> 정정(2026-10-01, D5): 계약 실험실(`app/(lab)/contract.tsx`)도 같은 "홈으로" 버튼을 쓴다(`headerRight: renderHomeButton`).
> 앱이 꺼진 채(콜드 스타트) 딥링크로 곧장 열면(예: `templateexpo://contract`) 실험실 하나만 루트에 서서 돌아갈 화면이 없다 -
> `canGoBack` 이 거짓이라 버튼이 보이고 홈으로 간다. 앱이 떠 있을 때 딥링크로 열거나 홈에서 들어오면(`router.push`) 이미 있는
> 스택 위에 쌓여 `canGoBack` 이 참이므로 버튼을 숨긴다(네이티브 뒤로 가기 버튼이 있다). 로그인·가입 화면과 달리 실험실은
> `useBackToHome` 을 쓰지 않는다 - Android 의 하드웨어 뒤로 가기는 기본 동작 그대로다.

### 7.4 화면 흐름

| 흐름 | 호출 |
| --- | --- |
| 가입 | `POST /auth/register`(201, 토큰 없음) → **이어서** `POST /auth/login` → 세션 저장 → `next`로 이동 |
| 로그인 | `POST /auth/login` → 세션 저장 → `next`로 이동 |
| 로그아웃 | refresh token으로 `POST /auth/logout`(204). 서버 호출이 실패해도 기기 세션과 Query 캐시는 비운다 |

헤더는 로그인했을 때 로그아웃 버튼만 보여 준다. `GET /users/me`는 부르지 않는다
— Next.js 세션 바도 로그아웃 버튼만 그리고 `/users/me`를 부르지 않는다(측정:
`app/(app)/session-bar.tsx`).

### 7.5 알고 넘어가는 한계

- 회전 요청을 보낸 직후 OS가 앱을 멈춰 응답을 받지 못하면, 서버는 이미 구
  refresh를 폐기했으므로 다음 실행에서 로그아웃된다.
- 사용자가 기기 시계를 크게 바꾸면 만료 판정이 틀어져 로그아웃될 수 있다.

둘 다 Next.js에서 브라우저 탭을 닫는 것과 같은 성격이라 고치지 않고 문서에
적는다.

> 정정(2026-09-30, D2): 한계가 하나 더 있다. iOS 키체인 항목은 앱을 지워도 남는다 - 같은 기기에 앱을
> 다시 설치하면 이전 세션이 되살아날 수 있다(refresh 가 아직 만료되지 않았다면 로그인된 채로 시작한다).
> 7.1 의 `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY` 는 백업을 다른 기기로 복원할 때 항목이 따라가지 않게 할
> 뿐 같은 기기의 재설치는 막지 않는다. 앱을 지우면 로그아웃된다고 여기는 사용자에게는 뜻밖일 수 있다.
> 로그아웃(7.4)한 세션은 되살아나지 않는다 - 기기 세션을 지우고 refresh 를 폐기하기 때문이다. 이 동작은
> iOS 플랫폼의 알려진 것이고 이 저장소에서 기기로 재지는 않았다. 앞의 둘처럼 고치지 않고 문서에 적는다.

## 8. 화면과 데이터 흐름

### 8.1 화면

경로와 인증 범위는 Next.js 스펙 14장과 같다.

| 경로 | 인증 | 내용 |
| --- | --- | --- |
| `/` | 공개 | 홈 — 목록·실험실 진입, 빌드 정보 카드(10.6) |
| `/examples` | 공개 | 목록 — 필터 시트, 정렬 메뉴, 무한 스크롤, 당겨서 새로고침, 빈 결과 |
| `/examples/[id]` | 공개 | 상세 — 분류·태그 배지, UTC 시각, 없는 ID는 not-found |
| `/examples/new` | 필요 | 생성 — 필수 입력, 분류 단일 선택, 태그 다중 선택(순서 유지) |
| `/examples/[id]/edit` | 필요 | 수정·삭제 — 기존 값 유지, 삭제 확인 대화상자 |
| `/login` · `/register` | 공개 | 인증 |
| `/contract` | 공개 | 계약 실험실 |

내비게이션은 Stack 하나다. 탭을 두지 않는다 — 화면 수가 탭을 요구하지 않는다.
다크 모드는 시스템 설정을 따른다.

### 8.2 라우트 파라미터가 곧 쿼리다

Next.js 스펙 8.1의 "URL이 곧 쿼리다"를 라우트 파라미터로 옮긴다.

```text
templateexpo://examples?filter[status]=active&sort=-createdAt
```

- 필터·정렬은 라우트 파라미터에 둔다. 딥링크 하나로 같은 목록이 재현되고,
  뒤로 가기가 이전 조건을 되살린다. 목록 화면에 별도의 상태 관리가 필요 없다.
- 파라미터는 `listRequest()`(복사)가 검증·직렬화해 백엔드로 넘긴다. 허용 목록에
  없는 파라미터는 **막지 않고 보낸다** — 백엔드의 `INVALID_FILTER`를 화면에
  띄우는 것까지 Next.js와 같다.
- Expo Router가 `filter[status]`처럼 대괄호가 든 키를 보존하는지는 구현 0단계에서
  먼저 실측한다(15장). 보존하지 않으면 인코딩 규칙을 `lib/resources`에 두고 그
  결정을 `docs/superpowers/notes/`에 기록한다.

> 정정(2026-09-30, D3): 대괄호 키의 인코딩 규칙 - 앱이 만드는 목록 주소(정렬 메뉴·필터 시트·필터 지우기)는
> `URLSearchParams` 의 직렬화 그대로 키와 값을 퍼센트 인코딩한다(`filter%5Bstatus%5D=active`). 0단계 실측
> M2 가 그 모양의 딥링크에서 두 단계 키까지 평평한 키로 돌아오는 것을 쟀고, 앱 안의 이동(`router.push(주소)`)도
> 같은 해석을 지난다. 인코딩하지 않은 링크는 한 단계 키만 쟀으므로 문서와 E2E 의 딥링크는 인코딩한 모양으로
> 쓴다. `useLocalSearchParams` 가 값을 한 번 더 디코딩해 값 안의 `%XX` 는 바뀐다(알고 넘어간다). 조건을 바꾸는
> 이동은 `router.push` 다 - 새 목록 화면이 쌓여 뒤로 가기가 이전 조건을 되살린다(`router.setParams` 는 기록을
> 남기지 않는다). 규칙·왕복 시험·근거는 `lib/resources/view.ts` 의 `filterHref`,
> `test/unit/resources/view-expo.test.ts`, `docs/superpowers/notes/2026-09-30-d3-measurements.md` 의 L1.

> 정정(2026-09-30, D3): 밖에서 들어온 딥링크는 앱 안의 이동과 다르게 풀렸다. Expo Router 57.0.24 의
> `build/fork/extractPathFromURL.js` 에서 `fromDeepLink`(60행)가 쿼리를 다시 짤 때(97–102행) `searchParams` 로 한 번
> 디코딩한 값에 `safeDecodeURIComponent` 를 한 번 더 걸고, 다시 인코딩하지 않은 채 `이름=값` 을 `&` 로 잇는다. 라우터가
> 그 문자열을 다시 풀어 값의 `+` 는 공백, `&` 는 다음 파라미터의 시작, `#` 은 조각의 시작이 됐다 - 기기에서
> `…contains%5D=probe-d3-repro%20%EA%B0%80%2B%EB%82%98%26…` 딥링크가 `…contains%5D=probe-d3-repro+%EA%B0%80+%EB%82%98`
> (`probe-d3-repro 가 나`) 요청이 됐다(D3 실측 L1). 그래서 `app/+native-intent.tsx` 의 `redirectSystemPath` 가 이 빌드의
> scheme 으로 들어온 링크를 쿼리의 인코딩을 그대로 둔 앱 안 주소(`/examples?…`)로 바꿔 넘긴다
> (`lib/navigation/deep-link.ts` 의 `appPathFromDeepLink`). `fromDeepLink` 는 `/` 로 시작하는 주소를 그대로
> 돌려주므로(74–75행) 딥링크가 `router.push(주소)` 와 같은 해석을 지난다 - 위 정정의 "앱 안의 이동도 같은 해석을
> 지난다" 는 딥링크에도 이 정규화 뒤에 참이다. `test/unit/navigation/deep-link.test.ts` 가 설치본의
> `extractExpoPathFromURL` 을 지나는 왕복을 재고, E2E `examples-browse` 가 기기에서 잰다.

### 8.3 페이지네이션 배정 — Next.js와 반대

offset과 cursor는 섞을 수 없다(백엔드가 거부한다). 한 화면은 한 모드를 쓴다.

- **목록은 cursor다.** 첫 요청은 `page[after]=`(빈 값)와 `page[size]=20`, 그다음은
  `links.next`의 query를 그대로 따라간다(무한 스크롤). 20은 한 화면을 채우고 세
  백엔드의 상한 100 안에 드는 값이다. 커서 문자열을 만들거나
  해석하는 코드는 이 저장소에 없어야 한다(Next.js 8.3과 같다). 모바일 목록은
  페이지 번호보다 무한 스크롤이 자연스럽다.
- **offset은 계약 실험실이 실증한다(8.6).** Next.js는 목록이 offset이고 실험실이
  cursor다. 두 템플릿을 합치면 같은 표면을 덮는다.
- `page[totals]`는 기본으로 켜지 않는다. 총 개수는 실험실에서만 켠다.

> 정정(2026-09-30, D3): URL 에 실린 쪽 위치(`page[number]`·`page[after]`·`page[before]`)는 보내지 않는다 -
> 무한 스크롤은 언제나 커서의 입구에서 시작한다. `page[size]` 는 URL 에 있으면 그 값이다(없으면 20). 다음 쪽은
> `links.next` 의 쿼리 그대로이고, 빈 쪽을 받으면 링크가 있어도 끝이다 - NestJS 는 커서 모드의 끝에서도
> `next` 를 채워 보낸다. 판단은 `lib/resources/view.ts` 의 `listQuery`·`nextPageQuery`·`listView`(쪽 배열).

### 8.4 데이터 흐름

판단은 복사한 `lib/resources`가 하고, 화면에는 훅 호출과 JSX만 둔다.

```text
목록  라우트 파라미터 → listRequest() → useInfiniteQuery → request() → normalize → listView() → components/resource
상세  detailRequest() → useQuery → detailView()
관계  referenceRequest() → /api/v1/categories · /api/v1/tags
쓰기  폼 상태(문자열 값) → writeDocument() → useMutation(Bearer)
        성공 → 관련 캐시 무효화 → 이동
        실패 → formStateFromErrors() → 필드 오류 · 배너
```

`request()`를 부르는 자리는 `queries/`의 훅이고, 그 훅이 쓰는 클라이언트는
`platform/`이 한 곳에서 조립한다(9.4).

### 8.5 캐시와 재조회

| 규칙 | 값 | 이유 |
| --- | --- | --- |
| `staleTime` | 0 | Next.js의 `no-store`와 같은 예측 가능성 |
| 자동 재시도 | 조회·쓰기 모두 끔 | Next.js `client.ts`는 재시도하지 않는다 |
| 앱이 앞으로 나올 때 | 재조회 (AppState → `focusManager`) | |
| 네트워크가 돌아올 때 | 재조회 (NetInfo → `onlineManager`) | |
| 요청 타임아웃 | 15초 | 모바일 네트워크는 거절하지 않고 멈추는 경우가 많다. 어드민이 회전 요청에만 둔 것과 같은 이유다 |

쓰기 후 무효화:

| 쓰기 | 무효화 |
| --- | --- |
| 생성 | 해당 자원 목록 |
| 수정 | 해당 상세 + 목록 |
| 삭제 | 해당 상세 제거 + 목록 |
| 로그아웃 | Query 캐시 전체 비움 |

캐시 키와 무효화 표는 `queries/`의 순수 함수로 두고 단위 테스트로 고정한다.

> 정정(2026-09-30, D3): TanStack Query 의 `networkMode` 는 조회·쓰기 모두 `offlineFirst` 다. 기본값 `online` 은
> NetInfo 가 끊겼다고 하면 요청을 보내지 않고 멈춰 둬서, 첫 조회의 스켈레톤·쓰기의 스피너가 연결이 돌아올 때까지
> 돈다 - 9.3 의 "네트워크 실패 → 앱 문구와 다시 시도" 가 오지 않는다. `offlineFirst` 는 요청을 한 번 보내고
> (실패는 `request()` 가 결과로 준다) 연결이 돌아오면 다시 부른다. NetInfo 의 `isConnected` 가 `null` 이면
> 연결된 것으로 본다. 요청에 TanStack Query 의 `signal` 을 넘기지 않는다. 캐시 키와 무효화 표는 `queries/keys.ts`
> 이고 로그아웃도 그 표를 지난다. 배선은 `platform/query-client.ts`.

> 정정(2026-10-01, D3): 위 표의 두 재조회(앱 복귀·네트워크 복귀)와 당겨서 새로고침·다시 들어온 상세·쓰기 뒤 무효화의
> 재조회가 닿지 못해도 읽은 목록과 상세를 버리지 않는다. 조회의 `queryFn` 이 백엔드가 응답조차 주지 못한 실패를
> 던지고(`queries/resource-options.ts` 의 `throwIfUnreachable`) TanStack Query 가 재조회의 실패에도 앞의 `data` 를
> 둔다 - 무한 조회는 읽은 쪽 전부를 두고, 연결이 돌아온 뒤의 재조회도 그 쪽을 모두 다시 읽는다. 처음 판(실패를 결과
> 값으로 캐시에 둔 것)은 재조회의 실패가 쪽 배열을 `[실패]` 하나로 바꿔 읽은 행이 전체 화면 실패로 바뀌고, 연결이
> 돌아오면 첫 쪽만 다시 읽었다(D3 최종 검토가 설치본 query-core 5.104.0 으로 재 보였다 - 6행 → 실패 → 2행). 화면
> 상태는 `lib/resources/screen-state.ts` 가 정한다(9.3 의 둘째 D3 정정).

> 정정(2026-10-01, D4): 쌓인 화면(조건을 바꿀 때마다 쌓이는 목록, 상세·수정 밑의 목록)의 조회는 구독을 끊는다 -
> `subscribed: useIsFocused()`(TanStack Query 의 React Native 안내). 위 표의 두 재조회와 쓰기 뒤 무효화는 보이는 화면의
> 조회만 부르고, 쌓인 화면은 다시 앞에 올 때 다시 구독하며 부른다(`staleTime` 0). 구독이 살아 있던 처음 판은 앱 복귀·
> 네트워크 복귀마다 스택 깊이만큼 읽은 쪽 전부를 다시 읽었다(D3 최종 검토 M2). 관계 선택기의 참조 목록도 목록·상세처럼
> 닿지 못함을 던져 재조회의 실패가 읽은 보기를 지우지 않는다(`queries/resource-options.ts`). 구독을 끊은 조회는 구독자가
> 없어 `gcTime` 뒤에 지워진다 - 목록·상세·참조 목록은 30분(`SCREEN_QUERY_GC_TIME`, `queries/resource-options.ts`)을 준다.
> 그 안에 돌아온 화면은 읽은 쪽을 그대로 그리고, 지나면 첫 쪽부터 다시 읽는다. 대가는 구독자 없는 조회가 읽은 쪽 전부와 함께
> 그 시간만큼 메모리에 남는 것이다(`queries/AGENTS.md`).

### 8.6 계약 실험실

`(lab)/contract` — 실무 화면이 쓰지 않는 표면을 모으고, 각 실험이 원본 JSON
응답을 그대로 보여 준다. 실험 정의와 결과 표현은 `lib/lab/`(복사)에 있다.

| 실험 | 실증하는 계약 | Next.js와의 차이 |
| --- | --- | --- |
| `PUT` upsert | 없는 id로 생성(201), 있는 id로 교체(200) | 같음 |
| 관계 전용 쓰기 | `POST`·`DELETE` `relationships/tags`(204) | 같음 |
| offset 순회 | `page[number]=1`로 시작해 `links.next`를 `null`이 될 때까지 따라간다 — 한 번에 최대 20회(Next.js `MAX_CURSOR_REQUESTS`와 같은 상한), 상한에 걸리면 그 사실을 결과에 적는다 | Next.js의 "커서 순회" 자리 (8.3) |
| 페이지 총합 | `page[totals]=true`를 켠 요청에만 `meta.totalCount` | 같음 |
| 언어 협상 | 같은 쓰기 오류를 `Accept-Language: en`·`ko`로 비교 | 같음 |
| 정책에 없는 필터 연산자 | `INVALID_FILTER` 오류 모양 | 같음 |

> 정정(2026-10-01, D5): 실험실의 모양. (a) 실험 정의(`experiments.ts`)와 결과 표현(`result.ts`)은 원본의
> `app/(lab)/contract/` 에서 `lib/lab/` 로 옮겨 복사했고, 원본의 Server Action(`actions.ts`) 자리는 `lib/lab/run.ts` 다 -
> 전송·토큰·지금의 세션·시계·기기 언어를 주입받아 node 에서 잰다. `lib/lab/` 이 세션을 소유하는 것은 아니다 - 토큰을
> 주는 함수를 받을 뿐이다. 화면은 `app/(lab)/contract.tsx`, 실험 카드는 `components/lab/experiment-card.tsx`, 훅은
> `queries/lab.ts` 다. (b) 세션이 필요한 실험을 로그인하지 않은 채 누르면 요청하지 않고 `/login?next=/contract` 로
> 간다. 실험실은 공개 경로라 경로 가드가 아니라 실험실 화면이 보낸다 - 기기 세션을 지우는 것은 쓰기 캐시의
> `onError` 다(9.3 의 D4 정정 "쓰기(생성·수정·삭제)의 오류" 의 (a)). 백엔드가 세션을 거절해도(9.2 의 코드) 같다. 토큰은
> 쓰기와 같은 길로 받는다(`lib/resources/write.ts` 의 `accessToken`) - 받은 토큰의 세션이 이미 만료됐으면(7.2 의 D4
> 정정에서 말한 쓰기의 만료 가드) 요청하지 않고
> 앱 문구를 그린다. 세션 거절 말고 던져진 것은 결함이라 쓰기 훅처럼 오류 경계로 간다. (c) offset 순회는 쪽당
> 3건이고, 페이지 총합은 두 요청 모두 쪽당 1건이다 - 켠 요청에만 `meta.totalCount` 가 오는 것은 쪽 크기와 무관하고,
> 폰 화면에 두 본문을 담는다. 관계 전용 쓰기의 태그 조회는 토큰 없이 보낸다(7.2). (d) 결과는 단계마다 머리글과
> 본문을 갈라 그린다(`parseCombinedSteps`) - 언어 협상의 E2E 는 ko 단계의 본문에 한글이 있고 en 단계의 본문에
> 없는지 본다(9.4 와 같은 판정).

### 8.7 로딩 표현

로딩 상태에 텍스트를 쓰지 않는다.

- 목록·상세·폼의 첫 로딩은 스켈레톤이다.
- 제출 버튼, 무한 스크롤 하단, 당겨서 새로고침은 스피너만 쓴다.

## 9. 오류 처리

### 9.1 두 갈래 분류 (Next.js 9.1 복사)

```text
source.pointer = /data/attributes/<name>      → 필드 오류 → 해당 입력 아래
source.pointer = /data/relationships/<name>   → 필드 오류 → 관계 선택기 아래
그 외                                          → 문서 오류 → 상단 배너
```

### 9.2 `code`로는 동작만 정한다

| code | 동작 |
| --- | --- |
| `AUTHENTICATION_REQUIRED` · `INVALID_TOKEN` · `TOKEN_EXPIRED` · `TOKEN_REVOKED` | 세션 삭제 → `/login?next=<현재 경로>` |
| `RESOURCE_NOT_FOUND` | not-found 상태 |
| `VALIDATION_ERROR` | 폼으로 되돌려 필드 오류 표시 |
| 그 외 전부 | 배너에 백엔드 문구 그대로 |

인증 오류 처리는 `QueryCache`·`MutationCache`의 `onError` 한 곳에서 한다.

### 9.3 앱 자신의 문구는 하나뿐이다

백엔드가 `Accept-Language`를 협상해 `title`·`detail`을 내려주므로 그대로
표시한다. 앱이 자기 문구를 갖는 것은 **백엔드가 응답조차 주지 못한 때**뿐이다 —
네트워크 실패와 타임아웃. 그때는 "다시 시도" 버튼을 함께 보여 준다. 렌더링 중
예외는 Expo Router의 `ErrorBoundary`가 받는다.

UI 문구는 자원 선언의 한국어 라벨이고, 오류 문구는 백엔드가 협상한 언어다 —
Next.js와 같다.

> 정정(2026-09-30, D2): 인증 폼(D2)은 이 절과 세 군데가 다르다. (a) 앱 자신의 문구가 둘이다 - 복사한
> `UNUSABLE_RESPONSE_MESSAGE`("지금은 요청을 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.")와 가입 화면의 "계정은
> 만들어졌습니다. 자동 로그인만 실패했으니 로그인에서 다시 시도해 주세요." 안내다. 안내는 백엔드 오류 카탈로그를 옮긴
> 것이 아니라 두 호출(가입 → 로그인) 가운데 어디까지 갔는지라는 흐름의 사실이다 - 백엔드에는 그것을 말하는 오류가
> 없다. (b) `UNUSABLE_RESPONSE_MESSAGE` 는 백엔드가 응답하지 못한 때(네트워크 실패·타임아웃)만이 아니라 계약을 어긴
> 응답에도 뜬다 - 2xx 인데 토큰 문서가 없거나, 오류 문서인데 문구가 하나도 없을 때다(복사한 `lib/auth/flow.ts`).
> 사용자에게는 둘이 같다("지금은 안 된다, 이따 다시"). (c) 인증 폼에는 "다시 시도" 버튼이 없다 - 입력이 그대로 남은
> 폼의 제출 버튼이 곧 다시 시도다(D2 계획 결정 23). 이 절의 버튼은 조회 화면(D3)의 오류 상태에 둔다.

> 정정(2026-09-30, D3): 조회 화면에서 백엔드가 응답조차 주지 못하면 던지지 않는다 - `listView`·`detailView` 가
> `unreachable` 을 돌려주고 화면이 `UNUSABLE_RESPONSE_MESSAGE`(복사본, 앱 문구 하나)와 "다시 시도" 를 그린다.
> `ErrorBoundary` 는 요청을 다시 보내지 않아 그 자리가 될 수 없다. 문구 없는 오류 문서·본문 없는 성공 응답 같은
> 계약 위반만 던져 `ErrorBoundary` 로 간다. 무한 스크롤의 뒤따르는 쪽이 실패하면 읽은 행은 두고 목록 끝에
> 그린다.

> 정정(2026-10-01, D3): 위 정정의 "던지지 않는다" 는 화면 쪽의 말이다 - 조회의 `queryFn` 은 닿지 못함을 던지고
> (8.5 의 둘째 D3 정정) 화면 상태는 TanStack Query 의 데이터·오류에서 `listScreen`·`detailScreen`
> (`lib/resources/screen-state.ts`)이 정한다. 읽은 데이터가 없으면(첫 조회) 앱 문구와 "다시 시도" 가 화면 전부다. 읽은
> 목록·상세가 있으면 그것을 그대로 두고 작은 실패(`RequestFailed` 의 `compact`, testID `request-failed-compact`)와
> "다시 시도" 를 더한다 - 재조회가 닿지 못했으면 목록·상세 위에(다시 시도는 읽은 것을 모두 다시 읽는다), 다음 쪽이
> 닿지 못했으면 목록 끝에(다시 시도는 그 쪽만 읽는다 - 그 뒤로 끝에 닿아도 저절로 다시 부르지 않는다). 없는 자원
> (404)은 재조회가 닿지 못해도 not-found 다. 닿지 못함이 아닌 오류는 결함이라 `ErrorBoundary` 로 간다. 백엔드 오류
> 문서는 그대로 결과 값이라 배너다.

> 정정(2026-10-01, D4): 재조회가 판정하지 않은 응답(5xx·408·429)을 받아도 읽은 목록·상세를 버리지 않는다 - 닿지
> 못함(8.5 의 둘째 D3 정정)과 같다. 조회의 `queryFn` 이 그 응답도 던지고(`lib/resources/screen-state.ts` 의
> `throwIfUnreachable`), 화면은 첫 조회면 그 응답의 문구를 배너로, 읽은 데이터가 있으면 그 위에 작은 실패와 "다시
> 시도"(앱 문구)를, 다음 쪽이면 목록 끝의 작은 실패를 그린다. 판정한 오류(그 밖의 4xx - 없는 자원 등)는 여전히
> 결과 값이라 새 답이다(지워진 상세는 not-found). 처음 판은 백엔드 오류 문서를 전부 결과 값으로 캐시에 둬서, 목록의
> 재조회가 5xx 를 받으면 읽은 쪽 전부가 오류 한 쪽으로 바뀌고 다음 재조회는 한 쪽만 읽었다(D3 재검토) - 쓰기 뒤
> 무효화가 그 길을 늘린다. 그 셋을 판정하지 않은 응답으로 보는 것은 회전(7.2 의 D4 정정)과 같다.

> 정정(2026-10-01, D4): 쓰기(생성·수정·삭제)의 오류. (a) 인증 오류는 `MutationCache` 의 `onError` 한 곳이
> 받는다(`platform/query-client.ts`) - 쓰기 흐름(`lib/resources/write.ts`)은 세션이 없거나(7.3 의 쓰기 가드) 인증
> 오류 코드를 받으면 세션 거절을 던지고, `onError` 가 기기 세션을 지우면 경로 가드가 `next` 를 실어 로그인으로
> 보낸다 - 쓰기 화면은 모두 보호 경로다. `QueryCache` 에는 두지 않는다 - 읽기는 토큰을 싣지 않아(7.2) 인증 오류가
> 오지 않는다. (b) 수정의 `RESOURCE_NOT_FOUND` 는 not-found 를 그리고, 삭제의 `RESOURCE_NOT_FOUND` 는 이미 이뤄진
> 삭제로 보아 목록으로 간다(원본과 같다 - DELETE 는 멱등이 아니다). 생성의 `RESOURCE_NOT_FOUND` 는 계약 밖이라
> 배너다. (c) 백엔드가 응답조차 주지 못하면 폼 배너에 `UNUSABLE_RESPONSE_MESSAGE` 를 그린다 - 인증 폼처럼 입력이
> 그대로 남은 폼의 제출 버튼이 곧 다시 시도다. 관계 선택기의 참조 조회가 실패하면 조회 화면과 같은 두 갈래(앱
> 문구와 "다시 시도", 또는 백엔드 문구)를 그 시트 안에 그린다 - 읽은 보기가 있으면 재조회가 닿지 못해도 그대로
> 두고 실패를 따로 그리지 않는다(`lib/resources/screen-state.ts` 의 `referenceState`). (d) 관계 오류(`RELATIONSHIP_RESOURCE_NOT_FOUND`·
> `TYPE_MISMATCH` 등)는 코드가 아니라 포인터(`/data/relationships/<이름>/…`)로 그 선택기 아래에 그린다(9.1).

> 정정(2026-10-01, D4): 첫 조회가 판정하지 않은 응답(5xx·408·429)을 받았을 때의 배너에는 "다시 시도" 를 함께 둔다 -
> 앞의 정정은 그 응답의 문구를 배너로만 그렸는데, 잠시 뒤 다시 부르면 달라질 수 있는 실패라 사용자가 화면을 나갔다 다시
> 들어오는 것밖에 할 수 없었다. 화면 상태의 배너가 `retryable` 이면(`lib/resources/screen-state.ts` - 첫 조회가 받은
> 판정하지 않은 응답의 배너에만 붙는다) 백엔드의 문구 아래에 버튼을 그린다(`components/app/request-failed.tsx` 의
> `FailureBanner`). 목록·상세·수정 폼의 자리(고칠 상세를 기다리는 동안)·관계 선택기의 시트가 같은 규칙이다. 문구는 여전히
> 백엔드의 것이다 - 앱 문구를 더하지 않고 버튼의 라벨만 있다. 판정한 4xx 의 배너는 다시 불러도 같은 답이라 버튼이 없다.

> 정정(2026-10-01, D4): 위 정정들이 말하지 않은 둘. (a) 관계 선택기의 참조 목록이 문구 없는 오류 문서로 거절되면 목록·상세처럼
> 던져 `ErrorBoundary` 로 간다 - 참조 자원 하나의 계약 위반이 쓰기 화면 전체를 바꾼다. 원본은 던지지 않고 선택기를 비워 폼을
> 살렸다(복사한 `lib/resources/view.ts` 의 `referenceList` 주석). 거절은 `referenceList` 에 오지 않는다 -
> `referenceState`(`lib/resources/screen-state.ts`)가 먼저 읽는다. 알아볼 수 없는 성공 본문만 던지지 않고 고를 것이 없는
> 목록이다. (b) 오류 경계의 "다시 시도" 는 요청을 다시 보내지 않고 경계의 상태만 지운다. 결과 값으로 캐시에 든 결함(문구 없는
> 오류 문서, 본문 없는 성공 응답 - 둘 다 판정한 응답이다)은 다시 그릴 때마다 같은 결함을 던져 경계로 돌아온다. 경계가 보이는
> 동안 그 조회는 구독자가 없어 `gcTime`(8.5 의 D4 정정 - 30분, `SCREEN_QUERY_GC_TIME`) 뒤에야 캐시에서 지워지므로, 결함은 앱을
> 다시 켜거나 그 30분이 지나 조회가 캐시에서 지워진 뒤에야 사라진다(그제야 "다시 시도" 가 조회를 다시 부른다). 판정한 응답은 다시
> 불러도 같은 답이라 받아들인다. 경계에 출구(홈으로 나가는 길)를 두면 그 길과 "다시 시도" 가 조회 캐시를 비워야 한다 - 비우지
> 않으면 그 30분 동안 같은 화면에 다시 들어갈 때마다 캐시의 결함을 다시 던진다.

### 9.4 Accept-Language

- 기기의 언어 설정 목록(`expo-localization`의 `getLocales()`)으로 헤더 값을
  만든다. 조립 규칙은 `lib/`의 순수 함수다.
- 헤더를 싣는 자리는 **`platform/`의 API 클라이언트 조립부 한 곳**이다. 모든
  요청이 그 클라이언트를 지난다.
- 이렇게 모으는 이유는 측정된 결함이다. Next.js에서는 호출부마다 언어 값을
  인자로 넘겨야 했고, 그 인자를 `null`로 바꾸는 뮤턴트가 게이트를 전부 통과했다
  (Next.js 루트 `AGENTS.md`). 넘기는 자리를 하나로 줄이면 그런 틈이 사라진다.
- E2E는 로캘이 다른 두 실행으로 같은 오류 배너를 띄우고 **영어 쪽에 한글이
  없는지** 본다. 한국어 쪽만 단언하면 배선을 지워도 통과한다 — 헤더가 빠지면
  백엔드가 `ko`로 떨어지기 때문이다.

> 정정(2026-10-01, D5): 헤더를 싣는 자리는 그대로 `platform/api.ts` 의 `apiRequest` 하나지만, 호출자가 옵션에 언어
> (`acceptLanguage`)를 정했으면 그 값을 싣는다 - 기기 언어로 덮지 않는다. 8.6 의 언어 협상 실험이 같은 쓰기 오류를
> `ko`·`en` 으로 비교하려면 두 값을 명시해야 한다. 언어를 정하는 호출자는 계약 실험실(`lib/lab/run.ts`)뿐이다 - 나머지
> 실험도 결과에 "보낸 요청 헤더" 를 적으려고 기기 언어(`deviceAcceptLanguage`)를 명시해 싣고, 그 밖의 요청은 전부
> 언어를 넘기지 않아 기기 언어가 실린다. 호출부마다 언어를 넘기던 원본의 모양으로 돌아간 것이 아니다.
> `test/unit/platform/api.test.ts` 가 두 동작을 잰다.

## 10. 설정·빌드·배포

### 10.1 `app.config.ts`와 환경 변수

`app.config.ts` 하나가 앱 식별자와 빌드 설정의 정본이다.

| 변수 | 필수 | 기본값 | 역할 |
| --- | --- | --- | --- |
| `BACKEND_URL` | 예 | 없음 | 백엔드의 절대 URL. 끝 슬래시는 잘린다 |
| `APP_VARIANT` | 아니오 | `development` | `development` · `preview` · `production` · `e2e` |
| `EAS_PROJECT_ID` | 아니오 | 없음 | 있으면 EAS 프로젝트와 OTA를 켠다 |

- 필수 변수에는 코드상의 암묵적 기본값을 두지 않는다. `BACKEND_URL`이 없으면
  `BACKEND_URL is required`로 **설정을 평가하는 순간 실패한다** — `expo start`,
  `expo export`, 로컬·EAS 빌드, OTA 발행이 모두 멈춘다. Next.js의 "시작 실패"가
  "빌드 실패"로 더 앞당겨진다. 검증 함수는 `lib/config/settings.ts`(복사)다.
- 값은 `extra.backendUrl`로 앱에 들어가고, 앱 시작 시 같은 함수로 한 번 더
  검증한다 — OTA로 들어온 설정까지 대비한다. 실패하면 변수 이름이 담긴 치명 오류
  화면을 보여 준다.
- 선택 변수의 기본값은 `app.config.ts`·`.env.example`·README 표 셋에 같은 값으로
  적는다(Next.js와 같다).

> 정정(2026-10-01, D6): `EAS_PROJECT_ID` 는 UUID 여야 한다 - 다른 모양이면 설정을 평가하는 순간 멈추고(틀린 id 는
> 업데이트 주소를 틀리게 만들어 OTA 가 소리 없이 멈춘다), 오류는 실제로 읽은 변수의 이름을 말한다(`EAS_PROJECT_ID` 가
> 비었고 `EAS_BUILD_PROJECT_ID` 에서 읽었다면 그 이름). 대소문자는 가리지 않고 받되 소문자로 맞춰 싣는다 - EAS 빌드
> 서버는 설정의 `extra.eas.projectId` 를 자신이 주는 `EAS_BUILD_PROJECT_ID` 와 글자 그대로 맞대 보고 다르면 빌드를
> 멈추므로(`@expo/build-tools` 24.8.0 의 설정 검사, `EAS_BUILD_PROJECT_ID_MISMATCH`) 대문자로 적은 id 가 그대로
> 실리면 빌드가 시작한 뒤에야 멈춘다. 값이 없고 EAS 빌드 서버가 주는 `EAS_BUILD_PROJECT_ID` 가 있으면 그 값을 쓴다 -
> 빌드를 시작한 eas-cli 는 로컬의 `EAS_PROJECT_ID` 로 설정을 평가하는데, 서버의 평가에 id 가 빠지면 OTA 가 꺼져 두
> 평가의 runtime version 이 달라지고 EAS 빌드가 멈춘다(`@expo/build-tools` 24.8.0 의
> `configureExpoUpdatesIfInstalledAsync`). 프로젝트 id 는 `extra.eas.projectId` 로 실린다 - eas-cli 와 EAS 빌드가
> 프로젝트를 찾는 자리다. Expo CLI 는 `.env` 를 읽으므로 개발자의 `.env` 가 평가에 섞일 수 있다 - 게이트의 8단계(설정)는
> `.env` 가 없는 깨끗한 사본에서 평가하고(12장의 D6 정정) 셸이 내보낸 값도 섞이지 않도록 `EAS_PROJECT_ID`·
> `EAS_BUILD_PROJECT_ID` 를 빈 값으로도 명시한다. 판단은 `lib/config/updates.ts` 의 `easProjectId`.

### 10.2 변형

| 변형 | 번들 ID 접미사 | 평문 HTTP | OTA | 용도 |
| --- | --- | --- | --- | --- |
| `development` | `.dev` | 허용 | 끔 | dev client로 개발 |
| `preview` | `.preview` | 금지 | 켬(`preview` 채널) | 내부 배포 |
| `production` | 없음 | 금지 | 켬(`production` 채널) | 스토어 |
| `e2e` | `.e2e` | 허용 | 끔 | E2E용 Release 빌드 |

- 평문 HTTP는 Android `usesCleartextTraffic`(`expo-build-properties`)과 iOS ATS의
  로컬 네트워크 예외로 켠다. `development`·`e2e`에서만 켠다.
- `preview`·`production`에서 `BACKEND_URL`이 `http://`면 설정 단계에서 실패한다
  — HTTP 주소가 배포 빌드에 섞이지 않는다.
- 접미사 덕분에 한 기기에 여러 변형을 함께 설치할 수 있다.

> 정정(2026-09-30, D1): 딥링크 scheme 도 변형마다 다르다 - `templateexpo-dev`·`templateexpo-preview`·
> `templateexpo`(production)·`templateexpo-e2e`. 번들 ID 만 다르고 scheme 이 같으면, 한 기기에
> 여러 변형을 설치했을 때 딥링크가 어느 변형으로 갈지 정해지지 않는다. 표는 `lib/config/app-variant.ts`.

### 10.3 앱 식별자

기본 식별자는 `com.example.templateexpo`, 딥링크 scheme은 `templateexpo`다.
Google Play는 `com.example`로 시작하는 패키지 이름을 받지 않으므로, 템플릿
사용자는 배포 전에 반드시 이 값을 바꾸게 된다. README의 첫 단계로 적는다.

### 10.4 네이티브 폴더 — CNG

`android/`·`ios/`는 `expo prebuild`가 생성하고 커밋하지 않는다(Continuous
Native Generation). 네이티브 설정은 `app.config.ts`와 config plugin으로만 바꾼다.

### 10.5 `eas.json`

| 프로필 | 설정 | 채널 |
| --- | --- | --- |
| `development` | `developmentClient`, 내부 배포, `APP_VARIANT=development` | — |
| `preview` | 내부 배포, Android APK, `APP_VARIANT=preview` | `preview` |
| `production` | 스토어 빌드, 빌드 번호 자동 증가(`appVersionSource: remote`), `APP_VARIANT=production` | `production` |
| `e2e` | Android APK, iOS 시뮬레이터 빌드, `APP_VARIANT=e2e` | — |

- `BACKEND_URL`은 `eas.json`에 적지 않는다. 실제 주소는 템플릿이 알 수 없으므로
  EAS 환경 변수(`eas env:create`)로 넣고, 빠지면 10.1에 따라 빌드가 즉시 실패한다.
- `submit.production`은 Android를 `internal` 트랙 draft로 올린다. iOS의 ASC App ID
  같은 계정 고유 값은 저장소에 가짜 값으로 넣지 않는다 — 첫 `eas submit` 때
  EAS가 묻고 저장한다.

> 정정(2026-10-01, D6): `eas.json` 의 빌드 프로필은 변형과 같은 넷뿐이다 - 공통 설정을 담는 `base` 프로필을 두지
> 않는다(그 프로필을 빌드하면 `APP_VARIANT` 없이 development 로 평가된다). 네 프로필이 모두 Node `24.19.0`·pnpm
> `11.22.0` 을 고정한다 - `app.config.ts` 가 `lib/config` 를 Node 의 type stripping 으로 불러오고(22.18 이상, D1 실측
> M7), `engines.node`(`>=24.11.0`)를 pnpm 이 강제한다. `environment` 는 프로필 이름과 같은 EAS 환경이다
> (`BACKEND_URL` 을 넣는 자리) - `e2e` 는 정하지 않는다(로컬·CI 는 prebuild + Gradle·xcodebuild 로 빌드한다, 10.7).
> `e2e` 는 자격 증명 없이(`withoutCredentials`) 빌드한다. `development` 의 `developmentClient` 는 `expo-dev-client` 를
> 요구하는데 D6 는 그 패키지를 설치하지 않았다 - 그 설정 플러그인은 기본으로 모든 변형에 같은 scheme
> `exp+<slug>` 를 더해 10.2 의 D1 정정(변형마다 다른 scheme)을 깬다. `eas build --profile development` 는 설치를
> 묻는다(비대화형이면 멈춘다). 프로필과 변형이 맞는지(이름·`APP_VARIANT`·채널·Node·pnpm, `BACKEND_URL` 없음)는
> `test/unit/config/eas-json.test.ts` 가 보고, 스키마는 `@expo/eas-json` 24.8.0 의 해석기로 쟀다(D6 실측 O2).

> 정정(2026-10-01, D8): `expo-dev-client`(~57.0.19)를 설치했다 - `development` 프로필의 `developmentClient` 가 그것을
> 요구하고(위 D6 정정), 개발은 development build 로 한다(1.2). 그 설정 플러그인이 기본으로 모든 변형에 더하는 scheme
> `exp+template-typescript-expo` 는 `development` 에만 싣는다(`lib/config/app-variant.ts` 의 `devClientScheme`,
> `app.config.ts` 의 `addGeneratedScheme`) - 10.2 의 D1 정정(변형마다 다른 scheme)을 지킨다. 게이트 [8] 이 네 변형의
> introspect 에서 그 scheme 이 development 의 Android·iOS 에만 있는지 잰다. release 빌드의 개발 런처는 빈 구현이라
> e2e·배포 변형의 동작은 바뀌지 않는다. iOS 의 Info.plist 에는 모든 변형에 로컬 네트워크 키(`NSBonjourServices`)가
> 더해지고, Debug 가 아닌 빌드에서 그 플러그인의 빌드 단계가 지운다.

### 10.6 OTA 업데이트

- `runtimeVersion`은 `fingerprint` 정책이다. 네이티브 구성이 같은 빌드에만
  업데이트가 전달되므로 JS와 네이티브가 어긋나 앱이 죽는 일을 원천적으로 막는다.
- 채널은 빌드 프로필과 1:1이다(`preview`·`production`). 발행은
  `eas update --channel <채널>`이다.
- 앱을 켤 때 확인하지만 기다리지 않는다(`checkAutomatically: ON_LOAD`,
  `fallbackToCacheTimeout: 0`). 받은 업데이트는 다음 실행에 적용된다.
- `EAS_PROJECT_ID`가 없거나 변형이 `development`·`e2e`면 OTA를 끈다. E2E는 내장
  번들로 결정적으로 돈다.
- 홈의 **빌드 정보 카드**가 앱 버전, runtime version, 채널, 업데이트 ID를 보여
  주고, "업데이트 확인" 버튼으로 받은 업데이트를 바로 적용한다. OTA가 실제로
  도는지 눈으로 확인하는 최소 장치다.

> 정정(2026-10-01, D6): (a) OTA 설정은 `app.config.ts` 의 `updates` 다 - 켜면 `url`(`https://u.expo.dev/<id>`),
> `checkAutomatically: 'ON_LOAD'`, `fallbackToCacheTimeout: 0`, 채널 머리글 `requestHeaders['expo-channel-name']` 이고,
> 끄면 `{ enabled: false }` 뿐이다. EAS 빌드는 `eas.json` 의 `channel` 로 같은 머리글을 네이티브 설정에 다시 쓰고, EAS
> 밖의 빌드(prebuild + Gradle·xcodebuild)는 앱 설정의 머리글을 쓴다 - 두 값이 같은지 시험이 본다. 판단은
> `lib/config/updates.ts`, 채널은 변형 표(`lib/config/app-variant.ts` 의 `updatesChannel`)다. (b) `runtimeVersion:
> { policy: 'fingerprint' }` 는 OTA 를 켠 빌드에만 둔다 - 끈 빌드(development·e2e, 프로젝트가 없는 배포 변형)는 받을
> 업데이트가 없으니 빌드 중에 지문을 계산하지 않는다. (c) fingerprint 는 공개 설정 전체(식별자·이름·scheme,
> `updates`, `extra` 의 `backendUrl`·`appVariant`·`eas.projectId`)를 해시에 넣는다 - `BACKEND_URL`·`APP_VARIANT`·프로젝트
> id 가 다른 환경에서 발행한 업데이트는 runtime version 이 달라 어떤 빌드에도 닿지 않고, JS 만 바뀐 발행은 같은
> runtime version 이다(D6 실측 O1). 16장의 "설정 오류가 OTA로 배포된다" 에 든 `fingerprint` 대응이 잰 사실이 됐다 -
> 앱 시작의 재검증(10.1)은 그 뒤의 두 번째 방어선이다.

> 정정(2026-10-01, D6): 빌드 정보 카드는 앱 버전·변형·OTA(켜짐·꺼짐)·runtime version·채널·업데이트 ID 를 보인다 -
> 내장 번들로 떴으면 업데이트 ID 뒤에 그렇다고 적고, 값이 없으면 "없음" 이다(OTA 를 끈 Android 빌드는 runtime
> version·채널을 빈 문자열로 준다 - expo-updates 57.0.24 의 `DisabledUpdatesController`). OTA 를 끈 빌드는 "업데이트
> 확인" 대신 안내를 그린다. 확인은 서버에 새 업데이트(또는 내장 번들로 되돌리라는 지시)가 있으면 받아서 곧바로 다시
> 켜고, 없으면 그렇다고, 거절되면 그 문구를 적는다 - 도는 동안과 다시 켜는 동안은 스피너만 그린다(8.7). 판단은
> `lib/updates/build-info.ts`, 호출은 `platform/updates.ts`, 훅은 `queries/updates.ts`, 카드는
> `components/app/build-info-card.tsx` 다.

### 10.7 계정이 필요한 실증은 따로 둔다

게이트와 CI는 Expo 계정 없이 돈다 — 로컬과 CI는 `expo prebuild` 뒤 Gradle과
xcodebuild로 직접 빌드한다. 실제 EAS 빌드와 OTA 발행은 사용자의 Expo 계정과
빌드 크레딧을 쓰므로, 구현 완료 후 사용자 승인을 받아 별도 단계(15장 9단계)로
한 번 실증한다 — `preview` 빌드 설치 → 업데이트 발행 → 앱이 그 업데이트를 받는다.

## 11. 테스트 전략

### 11.1 단위 — vitest (node)

- 복사한 코어의 테스트(6.2)를 그대로 돌린다.
- 새로 쓰는 판단을 잰다: 세션 직렬화와 복원 판단, 회전(동시 호출 → refresh 1회,
  저장이 반환보다 먼저, 거절 → 삭제, 닿지 못함 → 유지), 보호 경로, Accept-Language
  조립, 요청 타임아웃, 캐시 키와 무효화 표, `app.config.ts`의 검증(필수 변수,
  배포 변형의 `http://` 거부, 변형별 접미사).
- **컴포넌트 단위 테스트는 두지 않는다.** RN 컴포넌트를 node에서 렌더하려면
  jest-expo가 필요하고, 러너가 둘이 된다. 대신 판단을 `lib/`로 밀어 두고 화면은
  E2E가 지킨다 — Next.js가 판단을 `view.ts`로 모은 것과 같은 방향이다.

### 11.2 계약 거울 — vitest → 실제 백엔드 HTTP

`test/contract/`가 Next.js `test/e2e/mirror.spec.ts`의 검사 넷을 옮긴다. 판단은
복사한 `lib/resources/mirror.ts`(`mirrorProbes()`·`attributeKeys()`)다.

1. 조회 정책 양방향 — 선언된 (필터, 연산자)와 정렬은 2xx, 선언에 없는 연산자는
   `INVALID_FILTER`, 선언에 없는 정렬은 `INVALID_SORT`
2. 응답 `attributes`의 키 집합이 선언과 같다
3. 속성 제약(`maxLength`·`min`·`max`·enum) — 로그인 후 `examples`에
4. 선언된 enum 값이 백엔드 enum 안에 실재한다

앱도 기기도 필요 없으므로 E2E보다 먼저 돌아 빠르게 실패한다.

> 정정(2026-10-01, D5): 계약 거울은 `test/contract/mirror.test.ts` 다. 게이트 `[12/13]` 의 `test/contract/run.sh` 가
> FastAPI 스택을 띄워 `pnpm test:contract`(`vitest.contract.config.mjs` - 단위 시험과 설정이 따로다)로 돌리고 내린다.
> 앱의 API 클라이언트를 지나지 않고 `fetch` 로 원본 응답을 받는다(`test/contract/backend.ts`, 주소는
> `CONTRACT_API_URL`). 1 의 정렬도 양방향이다 - 선언에 없는 정렬은 `INVALID_SORT`(복사한 `mirror.ts` 가 원본의
> 판정대로 넓혀 두었다). 다만 정렬의 닫힘은 고정 이름 하나(`mirrorAbsentSortField`)로만 재므로 선언에서 정렬을 빼는
> 어긋남(백엔드가 선언에 없는 실제 정렬을 여는 경우)은 잡지 못하고, 필터의 양방향도 선언된 필드 안에서만 성립한다.
> 거울이 잡지 못하는 것은 `test/contract/AGENTS.md` 의 "잡지 못하는 것"에 있다. 3 은 선언된 제약을 넘긴 값만 보내
> 행을 만들지 않는다 - 선언이 백엔드보다 좁은 쪽
> (`maxLength` 를 줄이면 백엔드가 그 값을 받는다)을 잡고, 넓은 쪽은 잡지 못한다(원본과 같다). 한 번 가입·로그인한
> 토큰으로 잰다 - access 수명은 백엔드 기본값이다(E2E 하네스의 10초를 쓰지 않는다). 거울이 선언의 어긋남을
> 잡는지는 선언을 일부러 바꿔 재 보았다 - `docs/superpowers/notes/2026-10-01-d5-measurements.md` 의 C1. 그 실증은 1(필터
> 연산자)과 3(`maxLength`)만 건드렸다 - 2 와 4 는 실제 스택에서 변이로 재 보지 않았다.

> 정정(2026-10-02, D7): `test/contract/write-paths.test.ts`가 앱에서 피하는 쓰기 경로(빈 PATCH·미선언 속성·읽기 전용
> `createdAt`·중복 태그 id)와 새 로그인 access token의 수명을 더 잰다. 기존 89개와 새 프로브 5개로 백엔드마다 94개다.
> 쓰기는 `BACKEND_KIND`별 실측 기대값(HTTP 상태·오류 코드·`source.pointer`)으로 대조한다. 과거 Next.js D4 표에서
> NestJS의 빈 PATCH는 200 no-op·중복 태그는 중복 제거였고 Rails의 금지 속성은 400 문서 오류였다. 현재 실측에서는
> 세 백엔드 모두 빈 PATCH 422 `/data`, 금지 속성 422 필드 오류, 중복 태그 400 관계 포인터로 거절한다. 앱은 쓰기 속성
> 전부를 화이트리스트로 보내고 태그 id를 중복 제거하므로 그대로다. 과거 표·현재 값·백엔드 커밋·소스 근거는
> `docs/superpowers/notes/2026-10-01-d7-measurements.md`의 K4에 있다. compose가 백엔드 `main`을 빌드하므로 이 저장소가
> 바뀌지 않아도 백엔드 변경으로 해당 프로브가 실패할 수 있다.
> access 수명은 위 D5 시점의 기본 900초에서 비기본 600초로 바꿨다. `run.sh`가 내보낸 `E2E_ACCESS_EXPIRES_SECONDS`가
> compose의 `JWT_ACCESS_EXPIRES_SECONDS`와 시험의 기대값 한 출처다. JWT payload를 디코딩해 `exp - iat`가 그 값인지
> 대조하며 서명은 재지 않는다. 거울은 로그인 뒤 수초에 끝나므로 기존 속성 제약 시험의 토큰도 만료되지 않는다. 기대값
> 하나를 뒤집으면 한 프로브만 실패하고 복원하면 94개가 통과하는 것도 실측했다(K4).

### 11.3 E2E — Maestro

범위는 Next.js 브라우저 시나리오(인증·목록·상세·쓰기·실험실)와 같고, 모바일
고유 동작을 더한다.

| 영역 | 시나리오 |
| --- | --- |
| 인증·세션 | 가입·로그인·로그아웃, 보호 경로 → 로그인 → `next` 복귀, 409·422 표시, 한국어·영어 오류, **앱 재시작 후 세션 복원** |
| 목록·상세 | 관계 배지, UTC 시각, 필터·정렬, **무한 스크롤**, **당겨서 새로고침**, 빈 결과, 없는 ID의 not-found, **딥링크로 필터 재현** |
| 쓰기 | 필수 입력, 관계 선택·초기화, 기존 값 유지, 태그 순서, 삭제·실패 처리 |
| 실험실 | 여섯 실험(8.6), 익명의 로그인 이동 |

격리 규칙은 Next.js 루트 `AGENTS.md`의 것을 따른다.

- 이메일은 실행마다·테스트마다 다르다(중복 가입은 409라 재실행이 다른 갈래를
  탄다). 로컬 파트 64자 상한은 `probe-email.ts`(복사)가 강제한다.
- 목록 단언은 자기 제목 접두사로 좁힌다 — 딥링크의 `filter[title][contains]`.
- 픽스처에 실전 상수와 같은 값을 쓰지 않는다.

**가드 (Next.js `consoleGuard`의 자리):** 실행 중 기기 로그(Android logcat,
iOS 시뮬레이터 로그)를 모은다. JS 오류·경고가 있으면 실패다. `e2e` 변형의 API
클라이언트는 2xx가 아닌 응답을 표식과 함께 로그에 남기고, 하네스는 플로가
선언하지 않은 4xx·5xx를 실패로 만든다. 재시도는 0으로 둔다.

**로캘 전환:** Android는 앱별 언어(`cmd locale set-app-locales`), iOS는 실행
인자(`-AppleLanguages`)로 바꾼다. 실제로 되는지는 0단계에서 실측한다.

> 정정(2026-09-30, D1): 스펙이 적은 Android 앱별 언어가 성립했다(실측 M3) -
> `adb shell cmd locale set-app-locales <패키지> --locales <태그>` 를 주면 앱의 `getLocales()` 가 그 태그를
> 앞세우고 시스템 로캘이 뒤따른다. 순서가 중요하다: `pm clear` 는 앱별 언어를 지우고 Maestro 의
> `clearState` 도 그렇다. 그래서 `pm clear` → `set-app-locales` → 앱 실행 순서로 하고 로캘 플로에는
> `clearState` 를 쓰지 않는다. Maestro 플로에서 adb 를 부르는 방법은 찾지 못해서 그 순서는 플로를 시작하는
> 하네스 스크립트가 맡는다. `maestro test --device-locale` 은 `Unknown option`(exit 2)이었다. 시스템 로캘을
> `adb root`·`setprop` 으로 바꾸는 길은 `user` 빌드 이미지에서 root 가 막혀 안 됐다. iOS 의
> `-AppleLanguages` 는 개발 머신이 Windows 라 재지 못했다(CI 가 잰다).

> 정정(2026-09-30, D2): 앱별 언어는 키보드에도 닿는다 - Gboard 는 앞에 뜬 앱의 앱별 언어를 따라 자판을
> 바꾸고(ko-KR 이면 두벌식), Maestro 의 `inputText` 는 글자마다 키 이벤트를 보내므로 라틴 글자가 한글 자모로
> 조합된다(이메일이 깨져 로그인이 401 대신 422 로 끝났다 - `docs/superpowers/notes/2026-09-30-d2-measurements.md`
> 의 H2). 입력기를 모두 끄면 Maestro 세션 안에서 기본 키보드가 다시 켜졌다. 그래서 하네스
> (`test/e2e/run-android.sh`)는 앱별 언어를 정한 플로 동안 키보드 자판이 없는 입력기(에뮬레이터의 음성 입력)를
> 기본 입력기로 두고 끝나면 입력기 설정 셋을 되돌린다 - 순서는 `pm clear` → `set-app-locales` → 입력기 바꾸기
> → 플로 → 입력기 되돌리기다. 그런 입력기가 없는 기기에서는 로캘 플로가 그 사실을 알리고 실패한다.

> 정정(2026-09-30, D3): 목록·상세 E2E 가 씨앗(`probe-seed`) 말고 필요한 행 - 무한 스크롤의 25건, 새로고침·앱
> 복귀·상세 재진입이 볼 새 행과 바뀐 제목 - 은 플로가 Maestro 의 `runScript`(호스트의 GraalJS `http`)로 백엔드에
> 직접 만든다(`test/e2e/scripts/examples-api.js`). 앱에는 쓰기 화면이 아직 없다(D4). 하네스가 호스트의 백엔드
> 주소를 `API_URL` 로 넘긴다. 제목은 실행·플로마다 다른 접두사(`probe-d3-<이메일 끝 12자>`)로 시작해 목록 단언을
> 좁힌다. 같은 플로가 네이티브 HTTP 캐시 아래의 신선도(당겨서 새로고침·앱 복귀·상세 재진입이 백엔드의 새 값을
> 받는다)를 기기에서 잰다 - 결과는 `docs/superpowers/notes/2026-09-30-d3-measurements.md` 의 L5. 딥링크의
> 대괄호는 퍼센트 인코딩한다(8.2 의 첫째 D3 정정). 값의 `+`·`&`·`=`·`#`·한글도 인코딩한 딥링크가 같은 조건을
> 재현하는지 `test/e2e/flows/examples-browse.yaml` 이 기기에서 잰다 - 들어온 딥링크를 앱 안 주소로 바꾸는 정규화
> (8.2 의 둘째 D3 정정)가 그 전제다(같은 기록의 L1·L6).

> 정정(2026-10-01, D4): 쓰기 E2E(생성·수정·삭제·실패 처리)는 앱 밖에서 백엔드를 바꾸는 단계를 `runScript`
> (`test/e2e/scripts/examples-api.js`)로 둔다 - 계정 만들기(`account`), 고칠 행(`example`, 참조 목록 밖의 관계를 단
> `unlisted`), 자원 없애기(`delete`), 세션 끊기(`revoke`). 제목은 실행·플로마다 다른 짧은 접두사(`d4-<이메일 끝
> 8자>`)로 시작한다. 하네스는 백엔드의 access token 수명을 10초로 준다(`E2E_ACCESS_EXPIRES_SECONDS` → 세 백엔드의
> `JWT_ACCESS_EXPIRES_SECONDS`) - 앱은 만료 60초 전부터 회전하므로 쓰기가 전부 실제 회전을 지난다(7.2 의 D4 정정).
> 입력 뒤에는 폼의 제목 라벨을 눌러 키보드를 내린 다음 아래쪽 요소를 누른다. 빠른 두 번 누름은 Maestro `tapOn` 의
> `repeat: 2` 로 누른다 - 로그인 제출·"새로 만들기"·목록의 행·저장 제출·삭제 확인. 나간 요청의 수는 플로마다 남는 백엔드
> 접근 로그(`api.log`)로 세고, 화면이 둘 쌓였는지는 뒤로 가기가 닿는 화면으로 잰다. 결과는
> `docs/superpowers/notes/2026-10-01-d4-measurements.md`.

> 정정(2026-10-01, D5): 실험실 E2E 는 플로 둘이다 - 로그인하지 않은 채(`contract-lab-anonymous`: 딥링크로 곧장 연
> 실험실의 "홈으로", 홈의 진입을 빠르게 두 번 눌러도 하나만 쌓이는 실험실, 세션이 필요한 셋의 로그인 이동과 뒤로 가기,
> 정책에 없는 필터 연산자의 400, 페이지 총합, offset 순회의 끝)와 로그인한 뒤
> (`contract-lab-signed-in`: 로그인 이동 → `next` 복귀, PUT upsert 201·200, 관계 전용 쓰기 204·204 와 가린 토큰, 언어
> 협상의 422 둘 - ko 본문에 한글이 있고 en 본문에 없다). 결과의 단계마다 testID 가 있어 단계의 본문끼리 본다. 결과는
> `docs/superpowers/notes/2026-10-01-d5-measurements.md` 의 C3.

> 정정(2026-10-01, D6): E2E `home-build-info` 가 e2e 변형 APK 의 빌드 정보 카드를 기기에서 본다 - 변형 e2e, OTA 꺼짐,
> runtime version·채널·업데이트 ID 없음, 확인 버튼 대신 안내. `test/e2e/android.sh build` 는 만든 APK 의 앱 설정
> (`assets/app.config` - `updates` 가 `{ enabled: false }` 이고 `runtimeVersion` 이 없다)과 병합된 AndroidManifest.xml
> (`aapt2` - expo-updates 의 `ENABLED` 가 `false`, 업데이트 주소·채널 머리글이 없고 평문 HTTP 가 켜져 있다)을
> 단언한다. OTA 를 켠 변형의 기기 실증은 계정이 필요해 15장 9단계다. 결과는 D6 실측 O4.

> 정정(2026-10-01, D7): 같은 플로를 iOS 하네스도 돈다(13장) - 플로는 두 플랫폼에서 같은 뜻이어야 한다. Maestro 2.11.0 의
> iOS 드라이버는 `back`·`pressKey: back` 을 아무것도 하지 않고(`IOSDriver.backPress` 가 빈 구현) `setAirplaneMode` 는
> 경고만 남긴다. 그래서 한 화면 뒤로는 `test/e2e/subflows/back.yaml`(iOS 는 머리글 뒤로 버튼의 식별자 `BackButton`),
> Android 에만 있는 뒤로 가기(돌아갈 화면이 없는 로그인 화면 → 홈)는 `subflows/android-back.yaml` 과 플로의 iOS 갈래
> (머리글의 "홈으로" - `back-to-home-button`, 7.3 의 D4 정정)이고, 시트는 두 플랫폼 모두 배경(`sheet-backdrop`)을 눌러 닫고, 비행기 모드 플로(`examples-offline-refetch`,
> D4 의 `examples-delete` 에서 떼어 낸 `examples-delete-offline`)는 머리말 `# e2e-platforms: android` 로 iOS 에서 건너뛴다(같은
> 플로 안의 Android 갈래로 두면 머리말이 선언한 상태 0 이 iOS 에서 나오지 않아 가드가 실패한다). 로캘 플로의 `launchApp` 은 iOS 의 실행 인자(`-AppleLanguages`)를
> `arguments` 로 싣고(하네스가 넘기는 `APP_LOCALE`), `start-signed-out` 은 `clearKeychain` 도 준다(7.5 의 D2 정정 - iOS
> 키체인의 세션은 앱을 다시 설치해도 남는다). `test/unit/e2e/flows.test.ts` 가 규칙을 소스에서 잰다. 요청 타임아웃(8.5)은
> `E2E_CHECKS=1` 일 때 하네스가 백엔드 대신 멈춘 서버(`test/e2e/stall-server.ts`)를 같은 포트에 띄워
> `test/e2e/checks/request-stall.yaml` 로 잰다 - 헤더 전에 멈추는 요청과 헤더 뒤 본문에서 멈추는 요청이 모두 전체 화면
> 실패로 끝나고, 기기 로그에 `REQUEST_TIMEOUT` 둘, 서버 기록에 두 방식이 있어야 통과다. Android 의 결과는 D7 실측 기록 K1.

> 정정(2026-10-01, D7): iOS 의 가드와 로캘. 하네스(`test/e2e/run-ios.sh`)가 플로마다 시뮬레이터 로그를
> `log stream --style ndjson`(서브시스템 `com.facebook.react.log`)으로 받고 `test/e2e/ios-log.ts` 가 `adb logcat -v brief`
> 모양으로 옮겨 Android 와 같은 `test/e2e/guard-log.sh` 에 넘긴다. React Native 0.86 의 iOS 는 JS 의 info 와 warn 을 같은
> os_log 유형(Info)으로 남겨(`React/Base/RCTLog.mm`) 로그만으로는 경고를 가를 수 없다 - e2e 변형이 경고 수준의 줄 앞에
> `[e2e-warn]` 을 붙이고(`platform/e2e-log.ts` 가 `nativeLoggingHook` 을 감싼다, 표식의 판단은
> `lib/jsonapi/failure-log.ts`) 변환이 그 줄을 `W` 로 옮긴다. 루트 레이아웃이 모듈 평가 시점에 감싸므로 그보다 먼저
> 평가된 모듈의 iOS 경고는 표식이 없다(같은 번들을 도는 Android 가 수준으로 잡는다). 로캘 플로 앞에서 하네스가 앱을
> 다시 설치하고 키체인을 비운다(Android 의 `pm clear` 자리) - 언어는 플로의 `launchApp` 이 싣는
> `-AppleLanguages (<태그>)` 다(위 첫 D7 정정). iOS 에서 실제로 되는지는 CI 의 첫 실행이 잰다(D7 실측 기록 K3).

### 11.4 E2E 스택

- `docker-compose.e2e.yml`은 Next.js 파일에서 `web` 서비스를 뺀 것이다. 백엔드마다
  `migrate-*`·`api-*`·`seed-*`가 profile로 나뉘고, 세 `api-*`는 같은 자리에 선다.
- compose 프로젝트 이름은 `template-typescript-expo-e2e`로 격리한다. 정리 명령은
  이 프로젝트만 내린다 — 개발 머신에 상시 떠 있는 다른 스택을 건드리지 않는다.
- 호스트에는 API만 `E2E_API_PORT`(기본 4100)로 노출한다. DB·Redis는 노출하지
  않는다.
- 앱은 `e2e` 변형 하나를 빌드한다. Android는 `http://10.0.2.2:4100`, iOS는
  `http://localhost:4100`을 본다. 같은 포트 뒤에서 백엔드만 바뀌므로 **앱 빌드
  하나로 세 백엔드를 검증한다.**
- 백엔드 이미지는 GitHub `main`에서 빌드한다. 백엔드 `main`이 바뀐 뒤에는
  `--pull`로 다시 빌드해야 최신 코드가 검증된다(Next.js README의 교훈).

> 정정(2026-10-01, D7): 띄울 백엔드는 `BACKEND_KIND`(fastapi·nestjs·rails, 기본 fastapi)가 고른다 - `test/contract/run.sh`·
> `test/e2e/run-android.sh` 는 그 compose 프로파일을, `test/e2e/run-ios.sh` 는 `test/e2e/native-backend.sh` 를 쓴다. 13장의
> `native-backend.sh <종류>` 는 인자가 아니라 이 변수이고, 하위 명령으로 나뉜다 - `services`(Homebrew 의 PostgreSQL 18·
> Redis)·`fetch`(백엔드 저장소 `main`)·`prepare`(uv·pnpm·bundler)·`start`(DB 를 새로 만들어 마이그레이션 → 같은 SQL 시드 →
> API 를 4100 에)·`stop`. DB·Redis 는 127.0.0.1 의 55432·56379 에 뜨고, 저장소·DB·로그는 이 저장소 밖(`E2E_NATIVE_DIR`,
> 기본 `~/.cache/template-typescript-expo-e2e`)에 둔다 - lint·format·secretlint 가 백엔드 저장소를 훑지 않게. 롤·DB 이름·
> JWT 더미·Rails 의 환경은 `docker-compose.e2e.yml` 과 같고, 세 저장소의 주소는 `native-backend.sh repo-url` 한 곳에서 나와
> 단위 시험이 compose 의 빌드 컨텍스트와 맞댄다. iOS 앱은 `test/e2e/ios.sh build` 가 한 번 만든다 - `APP_VARIANT=e2e`·
> `BACKEND_URL=http://localhost:4100` 을 export 해 Xcode 빌드가 `app.config.ts` 를 다시 평가하고, `ios.sh assert-app` 이
> `.app` 의 앱 설정·`Expo.plist`·`Info.plist`(`NSAllowsLocalNetworking`)를 단언한다(Android 의 `android.sh build` 와 같은
> 자리).

> 정정(2026-10-02, D7 Mac 재현; R18 대체): Simulator e2e `.app`은 Xcode의 `Sign to Run Locally`로 만든다
> (`CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=- DEVELOPMENT_TEAM=`). Xcode가 iOS 권한을 Mach-O의
> `__TEXT,__entitlements`·`__ents_der`에 연결한다. R18처럼 호스트 ad-hoc 서명에 제한 권한을 넣으면 amfid가
> 실행을 거부한다. `assert-app`은 strict/deep 무결성, 내장 XML의 앱 식별자·명시된 경우 같은 Keychain 그룹,
> DER section의 존재·범위, 호스트 서명의 제한 권한 부재를 잰다. Keychain 기본 그룹은 내장 application-identifier다.
> Apple 계정·인증서·프로비저닝 없이 만들며 EAS·배포·실기기 서명과 무관하다. 실제 저장·복원은 E2E가 검증한다(K3).
>
> 정정(2026-10-02, D7-R22b): 모든 변형은 기존 `expo-build-properties`의 `ios.enableSceneSupport: true`로
> [Expo SDK 57의 공식 scene lifecycle 경로](https://github.com/expo/fyi/blob/main/ios-scene-lifecycle.md)를 쓴다.
> Xcode 27 SDK로 만든 기존 AppDelegate 앱은 iOS 27의 UIKit에서 JS 전에 종료됐다. Expo의 scene delegate가
> 창과 React Native를 시작하고 cold/warm URL 및 생명주기 이벤트를 전달한다. 의존성을 추가하지 않으며 생성된
> 네이티브 코드가 바뀌므로 fingerprint도 바뀐다. OTA를 켠 배포 변형은 새 네이티브 빌드가 필요하다.

> 정정(2026-10-02, D7-R33): iOS 하네스는 기존 기기의 runtime/type만 읽어 전용 기기를 새로 만든다.
> 앱이 쓰지 않는 서비스의 기기별 launchd override와 자동완성/링크 승인 설정을 준비한 뒤 한 번 재부팅하고
> 실제 적용 값을 검사한다. 기존 사용자 기기와 host 서비스는 바꾸지 않으며 EXIT에서 자기 기기를 삭제한다.
> 허용 목록·자원 실측·시험 범위는 `test/e2e/AGENTS.md`와 K3에 둔다. 앱 기능·시간·재시도·단언은 그대로다.

## 12. 검증 게이트

`./scripts/check.sh` 하나가 유일한 게이트다. Windows(Git Bash)·macOS·Linux에서
같은 순서로 돈다.

```text
 1 typecheck        tsc --noEmit
 2 lint             ESLint (lib/ import 제한 포함)
 3 format           prettier --check
 4 secretlint
 5 인용             scripts/check-citations.sh
 6 복사 출처        scripts/check-provenance.sh
 7 unit             vitest
 8 설정             app.config.ts를 네 변형으로 평가
 9 의존성 호환      expo-doctor
10 번들             expo export --platform android --platform ios
11 compose 설정     docker compose -f docker-compose.e2e.yml config --quiet (세 profile)
12 계약 거울        FastAPI 스택 → test/contract
13 E2E              e2e APK 빌드 → Android 에뮬레이터 → Maestro (FastAPI)
```

- **로컬 게이트는 FastAPI 하나, Android 하나만 돈다.** 세 백엔드와 iOS는 CI가
  돈다(Next.js 11장과 같은 태도 — 매번 여러 스택을 띄우면 게이트가 개발 흐름을
  막는다).
- 13단계에 필요한 것은 Docker, Android SDK, Maestro, 그리고 켜진 에뮬레이터다.
  켜진 기기가 없으면 `E2E_AVD`로 지정한 AVD를 부팅한다. 빠진 것이 있으면 무엇이
  빠졌는지 알리고 멈춘다.
- 스크립트의 실행 권한(`100755`)은 `git ls-tree`로 확인한다 —
  `core.filemode=false`인 머신에서는 권한이 빠져도 `git status`에 드러나지 않는다.

> 정정(2026-09-30, D1): Windows 개발 머신에서 13단계의 e2e APK 빌드는 pnpm `nodeLinker: hoisted`
> (3장의 정정)와 **실제 디렉터리 경로 47자 이하**의 저장소(16장의 정정)가 필요하다. 로컬 게이트가
> Windows 에서 13단계까지 돌려면 두 조건을 만족하는 작업 트리가 있어야 한다. `test/e2e/android.sh` 는
> 경로 길이를 검사하지 않는다.

> 정정(2026-09-30, D2): 지금의 게이트는 12단계다 - 정적 단계 열하나 뒤에 E2E 가 `[12/12]` 로 돈다. 계약
> 거울(위 12단계)은 그것을 재는 테스트가 생기는 D5 가 E2E 앞에 더하고, 그때 E2E 는 `[13/13]` 이 된다.
> E2E 단계는 `test/e2e/run-android.sh` 하나다. 빌드 입력(시험·문서·스크립트를 뺀 파일 내용과 앱이 볼
> `BACKEND_URL`)의 지문이 지난번과 같으면 APK 를 다시 만들지 않는다. 플로가 일부러 일으키는 2xx 밖의
> 상태와 앱별 언어는 플로 파일 머리말 주석(`# e2e-allow-http:`·`# e2e-app-locale:`)으로 선언한다(11.3의
> "플로가 선언하지 않은 4xx·5xx"). 가드는 `test/e2e/guard-log.sh` 이고 단위 시험이 그것을 실제로 돌려 잰다.
> 위 D1 정정의 마지막 문장(`test/e2e/android.sh` 는 경로 길이를 검사하지 않는다)은 더는 맞지 않는다 -
> `test/e2e/android.sh build` 는 Windows 에서 저장소 경로가 47자를 넘으면 빌드 전에 멈추고(`check-path`),
> `test/e2e/run-android.sh` 가 커밋 대상 파일(무시되지 않은 미추적 파일 포함)을 짧은 경로(`E2E_STAGE_DIR`,
> 기본 `C:/t/e`)에 복사해 거기서 빌드한다. 사본의 `node_modules` 는 남겨 두어 다음 설치가 몇 초로 끝난다.
> 하네스가 만든 표식(`.e2e-stage`)이 없는 비어 있지 않은 디렉터리는 지우지 않는다. 그래서 Windows 에서도
> 저장소를 옮기지 않고 E2E 까지 돈다.

> 정정(2026-10-01, D5): 게이트가 13단계가 됐다 - 계약 거울이 `[12/13]`(`test/contract/run.sh`), E2E 가 `[13/13]` 이다.
> 두 단계는 같은 compose 프로젝트(`template-typescript-expo-e2e`)를 각자 띄우고 내린다 - 거울은 백엔드 기본 access
> 수명으로, E2E 는 10초(11.3 의 D4 정정)로 띄우므로 스택을 나눠 쓰지 않는다. 거울은 기기가 없어도 돌아 E2E 의 APK
> 빌드 전에 선언의 어긋남을 알린다.

> 정정(2026-10-01, D6): 8단계(설정)는 평가만 하지 않고 검사한다. 네 변형을 EAS 프로젝트가 없을 때와 있을 때(닿지 않는
> 가짜 id)로 `expo config --type introspect` 한다 - 빌드하지 않고 설정 플러그인을 돌려 AndroidManifest.xml·
> strings.xml·Info.plist·Expo.plist 가 될 값을 낸다. 그 값이 변형 표와 OTA 판단(`lib/config/`)이 정한 것과 같은지
> `scripts/check-variant-config.mjs` 가 본다 - 식별자·scheme·앱 이름, 평문 HTTP, OTA(켬·끔, 주소, 채널, 확인 시점,
> runtime version 정책), 프로젝트 id. 평가는 저장소 루트가 아니라 커밋 대상 파일의 깨끗한 사본(`.maestro-output/` 안,
> `android/`·`ios/` 없음, 끝나면 지운다)에서 한다 - 루트에 `android/` 가 있으면(저장소 안에서 빌드하는 E2E 하네스나 dev
> client 의 prebuild 가 남긴다) 설정 플러그인이 그것을 바탕으로 삼고 scheme 은 더하기만 해서, 앞선 빌드의 값이 섞여 설정이
> 어긋난 것처럼 보인다. 사본을 만들고 지우는 것까지 여덟 평가가 이 개발 머신에서 10초 안팎이고, 설정에 어긋남을 넣으면 그
> 자리를 알리며 멈춘다(D6 실측 O3).

> 정정(2026-10-01, D7): `./scripts/check.sh --static` 은 정적 단계 [1]–[11] 만 돌고 "정적 단계 [1]–[11] 통과 (--static)" 로
> 끝난다 - CI 의 checks 잡이 부른다(13장). 인자로만 켜고 모르는 인자는 exit 2 다 - 셸에 남은 환경 변수가 로컬 게이트를
> 조용히 줄이지 않는다. 인자 없는 게이트는 13단계 그대로다. [12]·[13] 이 띄우는 백엔드는 `BACKEND_KIND`(fastapi·nestjs·
> rails, 기본 fastapi)가 고르고, Next.js 에서 원본 그대로 복사한 `test/e2e/matrix.ts` 의 `backendKind()` 가 도커를 건드리기
> 전에 검증한다 - compose 는 모르는 프로파일을 오류 없이 부분 스택으로 푼다. 게이트는 그 변수를 주지 않는다(FastAPI). E2E
> 단계에 `E2E_CHECKS=1` 을 주면 플로 뒤에 멈춘 서버 확인(11.3 의 D7 정정)을 더 돈다 - 게이트는 주지 않는다. E2E 단계는
> 플로마다 가드 뒤에 앱의 요청 수(D4 실측 W2–W4 - 쓰기마다 회전, 돌아온 목록의 재조회, 두 번 누른 제출의 요청 하나)를 그
> 플로의 접근 로그에서 단언한다(`test/e2e/request-counts.ts` - FastAPI 의 접근 로그만 센다).

## 13. CI (GitHub Actions)

```text
checks            ubuntu   게이트 1–11단계
build-android     ubuntu   e2e APK를 한 번 빌드해 아티팩트로 공유
e2e-android × 3   ubuntu   KVM 에뮬레이터 · 백엔드별 compose → 계약 거울 → Maestro
build-ios         macOS    시뮬레이터용 Release 빌드를 한 번 빌드해 공유
e2e-ios × 3       macOS    백엔드를 네이티브로 실행 → Maestro
```

- **macOS 러너에는 Docker가 없다**(GitHub 호스티드 러너의 제약). iOS 매트릭스는
  `test/e2e/native-backend.sh <종류>`로 백엔드를 네이티브로 띄운다 — Homebrew로
  PostgreSQL·Redis를 설치하고, 백엔드 저장소 `main`을 받아 런타임(uv·pnpm·Ruby)을
  준비하고, 마이그레이션과 같은 SQL 시드를 거쳐 4100번에 띄운다. Mac을 쓰는 사람은
  같은 스크립트를 로컬에서도 쓴다.
- 매트릭스는 `fail-fast: false`다. Maestro 리포트·스크린샷·기기 로그를 아티팩트로
  남긴다.
- macOS 러너 시간은 공개 저장소에서는 무료이고 비공개 저장소에서는 10배로
  계산된다. 저장소 공개 범위는 생성할 때 사용자에게 확인한다(15장 8단계).

> 정정(2026-10-01, D7): CI 는 `.github/workflows/ci.yml` 하나다. 모든 브랜치의 push 와 pull request 에서 돌고(`docs/` 만
> 바꾼 커밋은 돌지 않고, 같은 브랜치의 앞 실행은 새 실행이 취소한다), 권한은 `contents: read` 이고 비밀 값을 쓰지 않는다. 잡이 하는 일의 정본은 스크립트다 - `checks` 는
> `./scripts/check.sh --static`(12장의 D7 정정)과 actionlint 1.7.12, `build-android` 는 `test/e2e/android.sh build`(APK 의
> 변형·OTA 단언, D6 JVM 4GiB/1GiB·빈 캐시 두 단계와 둘째 UP-TO-DATE 기계 단언 포함 - 공개 ubuntu RAM 16GB, Kotlin 힙도 고려, 부족하면 측정·컨트롤러 보고), `e2e-android` 는 백엔드마다 `test/contract/run.sh` → `test/e2e/run-android.sh`(받은 APK 를
> `E2E_APK` 로 - API 36 Google Play 이미지·`pixel_7`, 로컬 AVD 와 같은 이미지·폭), `build-ios` 는 `test/e2e/ios.sh build`
> (러너 `macos-26`, Xcode 26.6 명시), `e2e-ios` 는 `test/e2e/native-backend.sh`(11.4 의 D7 정정) → `test/e2e/run-ios.sh`(받은
> `.app` 을 `E2E_APP` 으로, 가장 새 iOS 런타임의 iPhone)다. E2E 잡은 `checks` 를 기다리지 않는다. 캐시는 pnpm·Gradle·
> CocoaPods·AVD 스냅샷·Ruby 젬·uv 이고, 아티팩트는 앱 둘(7일)과 갈래마다의 `.maestro-output/e2e`·iOS 백엔드 로그·iOS
> 빌드 기록(14일)이다. Maestro 는 `test/e2e/install-maestro.sh` 가 2.11.0 을 체크섬으로 확인해 푼다. 멈춘 서버 확인
> (`E2E_CHECKS=1`)은 fastapi 갈래 둘이 켠다. 재시도는 0 이고, 실패한 잡을 코드 변경 없이 다시 돌리지 않는다.

> 정정(2026-10-02, D7): 13장의 매트릭스가 처음 모두 초록이 된 실행은
> [36950704982](https://github.com/builder-shin/template-typescript-expo/actions/runs/36950704982)(커밋 `53e3134`)다.
> 첫 실행부터 그 실행까지 무엇이 왜 실패했고 무엇을 고쳤는지, 칸별 결과와 시간은
> `docs/superpowers/notes/2026-10-01-d7-measurements.md`의 K3에 있다.

> 정정(2026-10-02, D8 CI 최적화): iOS의 백엔드별 논리 셀은 두 shard의 합집합으로 판정한다. 논리 아홉 칸은 유지하며
> 물리 잡은 checks 1·빌드 2·Android 3·iOS 6의 총 12개다. iOS는 16·5 플로로 나누며 합집합 21개와 무중복을 검사한다.
> CI APK만 x86_64로 만들고 로컬 기본은 네 ABI다.
> 세 백엔드 × 두 플랫폼, Android 23개·iOS 21개, 백엔드별 계약 거울 94개, 플랫폼별 fastapi request-stall,
> 재시도 0과 기존 HTTP·로그·화면 단언 및 timeout은 그대로다. 실제 빌드·E2E 시간과 macOS 대기는 D8 실측 기록 G4에 적는다.

> 정정(2026-10-02, D8 캐시 후보 철회): [36963954302](https://github.com/builder-shin/template-typescript-expo/actions/runs/36963954302)의
> iOS Clang 컴파일 511개가 모두 `-fmodules`를 사용해 ccache의 정확성 기본값으로 캐시할 수 없었다.
> 모듈 내부 상태 변화를 놓칠 수 있는 sloppiness는 허용하지 않는다. 새 러너의 DerivedData 재사용도 검증되지 않아
> iOS native-fingerprint 컴파일 캐시는 전체를 되돌렸다. 추후 Xcode compilation caching 또는 C_COMPILER_LAUNCHER를
> 실제 실행으로 측정한 뒤 재검토한다. ABI 선택·iOS shard와 전체 검증 범위는 유지한다.

## 14. 문서

```text
README.md                   실행, 환경 변수, 변형, 화면, 백엔드 전환, EAS·OTA, 앱 식별자 바꾸기
AGENTS.md                   계층 계약, 새 자원 추가 절차, 검증 명령
lib/jsonapi/AGENTS.md       "자원을 모른다"
lib/resources/AGENTS.md     "선언은 데이터다", 새 자원 절차
lib/auth/AGENTS.md          "회전은 한 곳에서 한 번에 하나만"
platform/AGENTS.md          "호출과 배선만 한다"
queries/AGENTS.md           캐시 키와 무효화 규칙
app/AGENTS.md               "라우트 파일만 둔다", "fetch를 직접 하지 않는다"
components/resource/AGENTS.md   "자원 이름으로 분기하지 않는다"
```

형제 저장소처럼 그 밖의 디렉터리에도 `AGENTS.md`를 두어 하위 문서가 자기
디렉터리의 세부를 소유한다. `docs/superpowers/`의 `specs/`·`plans/`·`notes/`는
커밋되는 근거 자리다.

**사라질 자리를 인용하지 않는다.** 계획 종료·세션 종료와 함께 사라지는 파일을
코드·문서 주석에서 인용하지 않는다 — Next.js 루트 `AGENTS.md`의 규칙을 그대로
가져오고, 게이트 5단계가 강제한다.

새 자원을 추가하는 절차는 루트 `AGENTS.md`가 소유한다.

```text
1. lib/resources/<자원>.ts    선언 — 백엔드 조회 정책·시리얼라이저의 거울
2. lib/resources/index.ts     손으로 등록 — 없으면 존재하지 않는 것
3. queries/                   필요하면 무효화 규칙 추가
4. app/(app)/<자원>/          화면
5. 계약 거울에 자원 추가, E2E 플로 추가
```

## 15. 구현 단계

| 단계 | 내용 | 산출 |
| --- | --- | --- |
| 0 | 골격 — Expo SDK 57, TS·ESLint·Prettier·secretlint, Uniwind + React Native Reusables, `app.config.ts` 변형, `check.sh` 뼈대 | 빈 게이트 통과 + 아래 **먼저 실측할 것** |
| 1 | 코어 복사 + 출처 기록·검사 + 단위 테스트 | 복사한 테스트 통과 |
| 2 | 세션 저장소·관리자, `platform/` 바인딩, 가드, 가입·로그인·로그아웃 | 인증 E2E |
| 3 | `queries/`, 목록(무한 스크롤·필터·정렬·딥링크)·상세 | 목록·상세 E2E |
| 4 | 생성·수정·삭제, 관계 선택기 | 쓰기 E2E |
| 5 | 계약 실험실, 계약 거울 | 드리프트 감지 |
| 6 | `eas.json`, expo-updates, 빌드 정보 카드 | 변형별 설정 검증 |
| 7 | CI — checks, Android×3, iOS×3(네이티브 백엔드) | 매트릭스 초록 |
| 8 | 문서군, 게이트 전체 통과, GitHub 저장소 생성·푸시 | 공개 범위는 사용자 확인 |
| 9 | (사용자 승인 후) EAS 실계정 실증 — 10.7 | `preview` 빌드가 OTA를 받는다 |

**0단계에서 먼저 실측할 것** — 뒤 단계의 전제가 무너지는 자리들이다.

1. Uniwind + React Native Reusables 컴포넌트가 SDK 57의 Android 빌드에서 렌더된다.
2. Expo Router가 `filter[status]` 같은 대괄호 키를 딥링크와 `router.setParams`
   양쪽에서 보존한다.
3. Maestro 실행에서 Android 앱별 언어와 iOS 실행 인자로 기기 로캘을 바꿀 수 있다.
4. `e2e` 변형의 Release APK가 에뮬레이터에서 평문 HTTP로 `10.0.2.2:4100`에 닿는다.
5. pnpm 설치 방식에서 Metro가 의존성을 해석한다(hoisted 필요 여부).
6. RN fetch에서 `AbortController`로 건 타임아웃이 요청을 실제로 끊는다.

각 실측 결과는 `docs/superpowers/notes/`에 남기고, 설계와 어긋나면 이 문서에
날짜가 붙은 정정을 덧붙인다.

> 정정(2026-09-30, D1): 위 6번의 "RN fetch"는 이 앱에서 `expo/fetch` 다(6.2의 정정). 타이머와
> `AbortController` 로 건 타임아웃이 요청을 거절시킨다는 결과는 그대로다(실측 M6: 응답 헤더 전의 취소를
> Android 에서 쟀다). 취소가 거절되는 모양은 단계마다 다르다 - 요청 단계는 `AbortError` 가 아니라
> `Error`(`FetchError`), 본문을 스트림으로 읽는 중은 `AbortError` 다. `request()` 가 쓰는 `response.json()`
> 은 스트림이 아니어서 이 구분 밖이고, 그래서 취소를 오류 이름으로 가르지 않는다. 대신 `request()` 는
> `json()` 을 요청 signal 과 경주시킨다(이유는 실측 기록 M6 의 소스 확인). 본문을 읽는 도중 시간이
> 다 되면 `REQUEST_TIMEOUT`, 호출자가 끊으면 `NON_JSONAPI_RESPONSE`(status 는 응답의 것)이고 단위 시험이
> 지킨다.

## 16. 리스크

| 리스크 | 대응 |
| --- | --- |
| Uniwind·React Native Reusables·SDK 57 조합이 맞지 않는다 | 0단계 실측 1. 맞지 않으면 대안을 기록과 함께 정한다 |
| iOS 매트릭스의 네이티브 백엔드 구동은 CI에서만 검증된다 | 개발 머신이 Windows다. 처음 통과할 때까지 CI를 반복해 돌린다 |
| Android 에뮬레이터 E2E가 흔들린다 | 재시도 0 유지, 흔들리면 원인을 고친다(Next.js와 같은 태도). 애니메이션을 끄고 부팅 완료를 기다린다 |
| E2E 빌드 시간(Gradle·xcodebuild) | 앱을 한 번 빌드해 매트릭스가 공유한다. Gradle 캐시를 쓴다 |
| 복사한 코어가 원본과 갈라진다 | 출처 기록과 게이트 검사(6.3), 계약 거울(11.2), 매트릭스 E2E |
| 대괄호 키 파라미터가 보존되지 않는다 | 0단계 실측 2. 인코딩 규칙을 `lib/resources`에 두고 기록한다 |
| 로캘 전환이 E2E에서 안 된다 | 0단계 실측 3. 안 되면 대안을 기록과 함께 정한다 |
| OTA 실증에 Expo 계정이 필요하다 | 게이트·CI는 계정 없이 돈다. 실증은 사용자 승인 후 9단계 |
| 설정 오류가 OTA로 배포된다 | 설정 평가 시점의 검증(10.1), 앱 시작 시 재검증, `fingerprint` 런타임 정책 |

> 정정(2026-09-30, D1): 리스크 하나를 더한다 - Windows 에서 Android 네이티브 빌드(12장 13단계의 e2e APK)는
> 저장소가 **실제 디렉터리 경로 47자 이하**에 있어야 한다. hoisted 링커(3장의 정정)에서 47자까지 성공했고
> 50자에서 실패했다(`ninja: error: manifest 'build.ninja' still dirty after 100 tries`, 48·49자는 재지 않았다).
> `subst` 로 짧은 드라이브 문자에 매핑해도 소용없다 - Node 의 `fs.realpathSync.native` 가 `subst` 를 벗겨 실제
> 경로를 돌려주고, 두 표기가 한 계산에 섞이면 React Native Gradle 플러그인의 codegen 이 실패한다. 한계는 지금의
> 네이티브 모듈 구성에서 잰 값이라 모듈이 늘면 낮아질 수 있다. 이 머신(74자)에서는 커밋 대상 파일을 짧은 경로에
> 복사해 거기서 빌드한다. `test/e2e/android.sh` 는 경로 길이를 검사하지 않는다(실측 M1).

> 정정(2026-09-30, D1): 리스크 하나를 더한다 - Uniwind 1.12.0 은 같은 `@media` 블록 안에서 첫 규칙만 `minWidth`
> 를 유지하고 둘째 규칙부터 미디어 조건을 잃는다. 그래서 `sm:` 규칙이 한 블록에 여럿 나오면 첫 규칙만 640dp
> 이상에서 적용되고 나머지는 폰 폭(411dp)에서도 적용된다 - React Native Reusables `Button` 의 `h-10 … sm:h-9` 가
> 폰에서 36dp 로 그려진다(실측 M1). 고쳐진 릴리스는 아직 없다(npm `latest` 가 1.12.0). 대응(패치, 다른 버전, `sm:`
> 회피)은 화면을 만드는 D3 가 정한다.

> 정정(2026-09-30, D2): 위 "Windows 에서 Android 네이티브 빌드 … 47자" 정정의 마지막 문장(`test/e2e/android.sh`
> 는 경로 길이를 검사하지 않는다)은 더는 맞지 않는다 - E2E 하네스가 짧은 경로의 사본에서 빌드한다(12장의
> D2 정정).

> 정정(2026-09-30, D3): 위 Uniwind 결함의 대응은 **미디어 쿼리 변형을 쓰지 않는 것**이다. 결함은 `sm:` 같은 너비
> 변형만이 아니라 `@media` 로 컴파일되는 모든 변형에 걸린다 - `ios:`·`android:`·`native:`·`tv:`·`android-tv:`·
> `apple-tv:` 의 플랫폼 변형도 같은 블록의 둘째 규칙부터 플랫폼 조건을 잃어 `android:px-4` 가 iOS 에서도 적용된다
> (`dark:` 는 영향이 없다). `app/`·`components/` 에서 `sm:`·`md:` 같은 브레이크포인트 변형과 `max-`·`min-` 꼴,
> `portrait:`·`landscape:`, 플랫폼 변형, `[@media …]:` 꼴의 임의 변형을 `test/unit/ui/breakpoints.test.ts` 가 막고,
> React Native Reusables 에서 받은 컴포넌트(`button`·`input`·`text`)의 변형을 뺐다. 플랫폼마다 다른 스타일은
> `Platform.select`·`Platform.OS` 로 클래스 문자열을 고른다. 패치는 Metro 변환기 안쪽을 고쳐야 하고, 고쳐진
> 릴리스는 아직 없다(npm `latest` 1.12.0). 폰과 태블릿이 같은 크기를 쓴다. 근거는
> `docs/superpowers/notes/2026-09-30-d3-measurements.md` 의 L2.

> 정정(2026-10-01, D6): 위 "설정 오류가 OTA로 배포된다" 의 대응 가운데 `fingerprint` 정책은 잰 사실이다 - 설정이 다른
> 환경의 발행은 runtime version 이 달라 빌드에 닿지 않는다(10.6 의 D6 정정 (c), D6 실측 O1). 게이트 8단계가 변형별
> 네이티브 설정을 검사한다(12장의 D6 정정). "OTA 실증에 Expo 계정이 필요하다" 는 그대로다 - D6 는 계정 없이 설정과
> 빌드 정보 카드만 쟀다.

> 정정(2026-10-01, D6): D6 에서 더한 E2E 빌드 우회책 둘은 `test/e2e/android.sh` 에만 있다. 하네스의 `gradlew`
> 명령줄에 JVM 인자 `-Xmx4096m -XX:MaxMetaspaceSize=1024m` 를 준다 - expo-updates 의 Room 컴파일러(KSP2)가
> 병렬 lint 와 함께 돈 32코어 머신에서 prebuild 기본값인 Metaspace 512MiB 를 채워 OOM 이 났다. 또 Metro 캐시를 비우고
> `:app:createReleaseUpdatesResources` 를 먼저 돌린 뒤, 캐시를 다시 비우고 `assembleRelease` 를 돌려 그 단계가
> UP-TO-DATE 로 건너뛰게 한다 - Windows 에서 번들 단계가 채운 캐시 위의 Metro 가 node 종료 때 0xC0000005 로 죽었다.
> CI(D7)가 `test/e2e/android.sh build` 로 빌드하면 같은 JVM 인자와 두 단계 Gradle 을 물려받는다. EAS 빌드(15장 9단계,
> D9)는 prebuild 기본값(512MiB)을 쓴다 - 같은 OOM 을 만나면 넓은 고침은 `withGradleProperties` 설정 플러그인이고,
> 이 고침은 fingerprint 를 바꾼다. 근거와 레시피 유지 조건은 D6 실측 O4.

> 정정(2026-10-01, D7): 리스크 넷을 더한다. (1) Maestro 2.11.0 의 iOS 드라이버는 `back`·`pressKey: back`·
> `setAirplaneMode` 를 조용히 무시한다 - 플로가 엉뚱한 화면에서 단언한다. 대응은 서브플로·머리말과 소스 시험(11.3 의 첫
> D7 정정)이고, 머리글 뒤로 버튼의 식별자(`BackButton`)는 CI 의 첫 실행이 잰다. (2) iOS 가드의 재료인 시뮬레이터 로그는
> 스트림으로만 온다(info 수준은 저장되지 않는다) - 붙기 전과 끊은 뒤의 줄을 잃을 수 있어 하네스가 붙은 뒤 2초, 끊기 전
> 2초를 둔다. 줄을 잃으면 가드의 "선언했는데 없다" 로 드러난다(재시도로 덮지 않는다). (3) macOS 러너의 Xcode·iOS
> 런타임은 GitHub 이 바꾼다 - Xcode 26.6은 명시하지만 러너 라벨(`macos-26`)에서 설치된 판이나 시뮬레이터 이름이 갈릴 수
> 있다. `build-ios` 가 판을 로그에 남긴다(`xcodebuild -version`·`xcrun simctl list runtimes`). 표의 "iOS 매트릭스의
> 네이티브 백엔드 구동은 CI에서만 검증된다" 의 대응(처음 통과할 때까지 CI 를 반복해 돌린다)은 코드를 고쳐 새 실행을 만드는
> 것이다 - 같은 코드로 다시 돌리지 않는다(D7 실측 기록 K3). (4) macOS 러너와 Mac 의 기본 bash 는 3.2 다 - macOS 에서 도는
> 스크립트는 그 구문만 쓴다(`.github/workflows/AGENTS.md`).

> 정정(2026-10-02, D7 실측 K3, 컨트롤러 D7-R15): Android 16에서 Expo splash의 앱 전송이 2초 제한을 넘으면
> 성공 경로의 starting-window 애니메이션 취소를 거치지 않아 `starting_reveal`이 남을 수 있다. 실행 2의 FastAPI·Rails
> 로그에서 전송 timeout state 2와 같은 MainActivity의 반복된 5초 애니메이션 대기가 확인됐고 문자 입력은 Maestro의
> 120초 RPC 제한으로 실패했다. `with-android-splash-exit.ts`가 등록 직후·`super.onCreate` 전에 API 31 이상에서
> `splashScreen.clearOnExitAnimationListener()`를 호출해 시스템 기본 exit를 쓴다. Expo의 splash 유지·hide 프리드로우
> 게이트와 iOS는 보존하지만 Android의 400ms fade를 포기한다. 생성 앵커가 바뀌면 prebuild가 오류로 멈춘다. 로컬에서
> 자연 재현되지 않은 한계는 남는다. K3의 실행 3에서는 Android 세 셀이 모두 통과했고 splash 전송 timeout과
> `starting_reveal` timeout은 0건이었다.

> 정정(2026-10-02, D7-R22b): Xcode 27 SDK의 scene lifecycle 필수화로 SDK 57의 기본 AppDelegate 앱은 iOS 27에서
> JS 시작 전에 SIGTRAP으로 종료된다. 11.4의 공식 Expo opt-in으로 대응하며 native fingerprint가 바뀐다.
> SDK 58 이상으로 올릴 때 해당 opt-in은 불필요해지므로 제거를 검토한다([Expo 안내](https://github.com/expo/fyi/blob/main/ios-scene-lifecycle.md)).
> CI의 두 iOS 잡은 재현성을 위해 Xcode 26.6의 `DEVELOPER_DIR`를 명시한다. 로컬 Mac 재현은 27.0이며 판별 증거는 K3다.

## 17. 완료 조건

1. 로컬 게이트(`./scripts/check.sh`)가 개발 머신(Windows)에서 통과한다.
2. CI의 `checks`, `e2e-android` 세 갈래, `e2e-ios` 세 갈래가 모두 초록이다.
3. 같은 앱 코드가 어댑터 없이 세 백엔드 모두에서 통과한다.
4. 복사 출처 기록이 있고 게이트가 그것을 검사한다.
5. README와 계층별 `AGENTS.md` 문서군이 실제 파일과 일치한다.

> 정정(2026-10-02, D7): 조건2의 칸은 `checks`·`e2e-android` 셋·`e2e-ios` 셋에 앱을 한 번 만드는
> `build-android`·`build-ios`를 더한 아홉이다. [36950704982](https://github.com/builder-shin/template-typescript-expo/actions/runs/36950704982)
> (커밋 `53e3134`)에서 모두 초록이었다(D7 실측 기록 K3). 조건3(같은 앱 코드가 어댑터 없이 세 백엔드 모두에서 통과)도
> 그 실행이 보였다. 조건1·5는 D8이 닫는다.
