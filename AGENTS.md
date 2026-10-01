# TypeScript Expo Template 작업 지침

세 백엔드 템플릿(FastAPI·NestJS·Rails)이 공유하는 JSON:API 1.1 계약을 Android·iOS
앱으로 소비하는 템플릿이다. 설계의 정본은
`docs/superpowers/specs/2026-09-30-expo-jsonapi-template-design.md`이고, 이 파일은 그
설계가 정한 **계층 계약의 운용 정본**이다.

## 계층 소유권 (스펙 5장)

**아래 표는 소유 관계이지 파일 목록이 아니다.** 어떤 위치가 아직 비어 있어도 그 행의
계약은 이미 유효하다 - 그 위치에 처음 파일을 만드는 사람이 지켜야 할 규칙이다.

| 위치                   | 소유하는 것                                                                                                          | 소유하지 않는 것                          |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `lib/jsonapi/`         | 문서 파싱, `included` 정규화, 쿼리 직렬화, 오류 분류, HTTP 협상                                                      | 자원별 지식, 화면, 네이티브 모듈          |
| `lib/resources/`       | 자원 선언, 목록·상세·폼 판단                                                                                         | JSX, fetch, 네이티브 모듈                 |
| `lib/auth/`            | 세션 모델과 직렬화, 만료 판정, 회전 결정, 자격증명 문서, 보호 경로 목록과 경로 가드 판단                             | 저장 매체, 화면 이동                      |
| `lib/lab/`             | 실험 정의, 실험의 실행(전송·토큰을 주입받는다), 결과 표현                                                            | 화면, 세션                                |
| `lib/config/`          | 설정 계약과 변형 규칙 - `app.config.ts`가 M7 제약 아래 직접 불러온다                                                 | 네이티브 모듈, 설정 자리의 바인딩         |
| `lib/navigation/`      | 밖에서 들어온 URL·딥링크를 앱 안 주소로 바꾸는 정규화, 화면을 쌓는 이동을 한 번만 하는 가드(`once.ts`)               | 화면, fetch, 네이티브 모듈                |
| `lib/updates/`         | 빌드 정보 카드의 판단 - 카드의 행, 업데이트 확인의 순서와 문구                                                       | 네이티브 모듈, 화면                       |
| `platform/`            | SecureStore·로캘·AppState·NetInfo·Updates·Constants 호출, React Provider, API 클라이언트 조립                        | 판단                                      |
| `queries/`             | 캐시 키, 조회·쓰기 훅, 쓰기 후 무효화                                                                                | JSX, 쿼리 문자열 조립                     |
| `app/`                 | 화면, 라우팅, 가드 배치                                                                                              | fetch, `request()` 호출, 쿼리 문자열 조립 |
| `components/ui/`       | React Native Reusables 복사본                                                                                        | 자원 이름, fetch, 세션                    |
| `components/hooks/`    | React Native Reusables 가 받는 UI 도우미 훅(`components.json`의 `hooks` 별칭)                                        | 조회·쓰기 훅, 자원 이름, fetch, 세션      |
| `components/app/`      | 앱 전체에 걸린 화면 조각(설정 오류 화면 `FatalConfig` 등)과 앱 전체의 이동 도우미(`useNavigateOnce`·`useBackToHome`) | 자원 UI, fetch                            |
| `components/form/`     | 폼 조각 - 필드 오류·배너·제출 버튼·자격증명 폼                                                                       | 자원 이름, fetch, 세션                    |
| `components/lab/`      | 계약 실험실의 조각 - 실험 카드와 결과 표시                                                                           | 요청, 세션, 자원 이름으로 분기            |
| `components/resource/` | 선언을 읽어 만드는 획일 UI                                                                                           | 자원 이름으로 분기                        |

`lib/config/`·`components/ui/`·`components/form/`·`components/app/`·`components/hooks/`는 스펙 5장의 표에
없다. 앞의 셋은 스펙 4장의 트리에는 있지만 소유 규칙이 표에 없었다. `components/app/`은 트리에도 없다 -
시작 설정 오류 화면(`FatalConfig`)처럼 앱 전체에 걸린 화면 조각과 앱 전체의 이동 도우미(`useNavigateOnce`·
`useBackToHome`)가 `components/ui/`(React Native Reusables 복사본)도 `components/resource/`(자원 UI)도
아니어서 따로 뒀다. `components/hooks/`도 트리에 없다 -
`components.json`의 `hooks` 별칭이 가리키는 자리다. React Native Reusables의 훅은 UI 도우미라 데이터를
다루는 `queries/`와 섞지 않는다. `lib/navigation/`은 트리에도 없었다 - Expo Router 가 밖에서 들어온 딥링크의
쿼리 값을 두 번 디코딩해 바꾸는 것을 막으려고(`app/+native-intent.tsx`가 잇는다, 스펙 8.2의 둘째 D3 정정) D3가
뒀다. 자원에 매이지 않는 주소 판단이라 `lib/resources/`에 두지 않았다. `lib/config/`의 제약과 `lib/navigation/`이
바꾸지 않는 주소는 각 디렉터리의 `AGENTS.md`에 있다.
`settings.ts`가 읽는 설정 자리(`process.env`, 앱에서는 `extra`)를 정하는 바인딩은
`platform/config.ts`가 한다. `components/lab/`도 스펙의 트리에 없다 - 계약 실험실 화면(`app/(lab)/contract.tsx`)의
조각이 자원 UI 도 폼 조각도 아니어서 따로 뒀다.

`lib/updates/`도 스펙의 트리에 없다 - 홈의 빌드 정보 카드(스펙 10.6)의 판단을 D6가 뒀다. 이 실행의 expo-updates
값을 다루고 설정 계약이 아니어서 `lib/config/`에 두지 않았다.

위반의 정의:

- `lib/**`에서 `react`·`react-native`·`expo`·`expo-*`·`@expo/*`·`@react-native*`·`@react-navigation/*` 등
  플랫폼 모듈을 import하면 위반이다. ESLint가 막고(정적 import·`export … from`·`import x = require()`만
  잰다 - 동적 `import()`와 `require()` 호출은 `lib/`에서 쓰지 않는다) `test/unit/lint/lib-boundary.test.ts`가
  그 규칙을 잰다. `lib/`가 node의 vitest에서 그대로 돌아야 복사한 테스트가 유효하다.
- `lib/**`에서 위 계층(`platform/`·`queries/`·`components/`·`app/`)을 import하면 위반이다. 별칭
  (`@/queries/auth`)이든 상대 경로(`../../queries/auth`)든, 하위 경로든 맨 디렉터리(`@/queries`)든 ESLint가
  막는다 - `lib/`는 맨 아래 계층이라 위 계층이 `lib/`를 부르지 그 반대가 아니다. 경로의 이름만 보므로
  `lib/` 안에 이 네 이름의 디렉터리를 두지 않는다(`firebase/app` 같은 패키지 경로는 막지 않는다).
  `test/unit/lint/lib-boundary.test.ts`가 그 규칙도 잰다.
- `lib/jsonapi/`에 이 저장소의 실제 자원 이름 문자열이 코드로 나타나면 위반이다.
- `lib/resources/*.ts`에 JSX가 있으면 위반이다.
- `app/`에서 `fetch`나 `request()`를 직접 부르면 위반이다. 화면은 `queries/`의 훅만 쓴다.
- `request()`(`lib/jsonapi/client.ts`)를 값으로 import하는 곳은 `platform/api.ts`와 `lib/`뿐이다 -
  `app/`·`components/`·`queries/`와 `platform/`의 다른 파일은 `apiRequest`를 지난다. Accept-Language 를
  싣는 자리가 그 한 곳이라 직접 부르면 언어가 빠진다(스펙 9.4). 타입 import는 어디서나 된다. ESLint가
  막고(정적 import·`export … from`만 잰다 - `import x = require()`와 동적 `import()`·`require()` 호출은
  재지 않는다) `test/unit/lint/request-boundary.test.ts`가 그 규칙을 잰다.
- `queries/`에 JSX가 있거나 쿼리 문자열을 조립하면 위반이다. 요청 조립은 `lib/resources`의
  `listRequest()`·`detailRequest()`·`referenceRequest()`(`lib/resources/view.ts`)가 한다.
- `components/resource/*`에 자원 이름으로 분기하는 코드가 있으면 위반이다.
- `platform/`에 분기 판단이 자라면 위반이다. 판단은 `lib/`로 옮기고 `platform/`은 호출과 배선만
  한다.

`lib/resources/index.ts`는 손으로 채우는 배열이다. **여기 없으면 그 자원은 존재하지 않는
것과 같다.** 자동 탐색(glob · 동적 `import`)을 쓰지 않는다.

## 복사한 코어

`lib/`의 상당 부분은 `template-typescript-nextjs`에서 복사했다(스펙 6장). 어떤 파일을
복사했고 원본과 무엇이 다른지는 `docs/provenance/copied-core.json`이 정본이다. 복사한
파일을 고치면 그 파일의 `divergences`에 `what`·`why`를 더한다 -
`node scripts/check-provenance.mjs`가 기록의 형식과 경로를 검사하고, 이탈이 없는 사본은 내용이
원본과 같은지(`sourceBlobs`의 blob SHA-1)까지 잰다. 이탈을 처음 적는 파일은 `sourceBlobs`에서 지운다.

## `app/`에는 라우트 파일만 둔다

Expo Router는 `app/` 아래의 모든 파일을 라우트로 취급한다. 판단 함수·타입·상수는
`lib/`의 해당 계층에 둔다. `+native-intent.tsx`는 라우트가 아닌 라우터의 특별 파일이지만 `app/`에 있어야
라우터가 찾는다 - 배선만 하고 판단은 `lib/navigation/`에 둔다.

## React Native Reusables 컴포넌트

`components/ui/` 는 React Native Reusables CLI 로 받는다 -
`printf 'n\n' | BACKEND_URL=https://gate-check.invalid pnpm dlx @react-native-reusables/cli@0.7.1 add <이름> --styling-library uniwind --yes`
(이미 있는 `text.tsx` 등의 덮어쓰기는 "아니오"). 받은 파일을 고친 곳은 그 파일에 "원본과 다른 곳" 주석으로
남긴다.

lucide 아이콘은 아이콘마다 깊은 경로의 기본 내보내기로 받는다 -
`import ArrowRight from 'lucide-react-native/icons/arrow-right'`(이름은 kebab-case). 통
(`import { ArrowRight } from 'lucide-react-native'`)을 값으로 받으면 Metro 가 트리 셰이킹을 하지 않아 아이콘
1800여 개가 모두 번들에 실린다 - 깊은 import 로 바꿔 Android 번들의 Hermes 바이트코드가 6.6MB 에서 4.5MB 로 줄었다.
`eslint.config.js` 가 통을 값으로 받는 import 를 막는다(`test/unit/lint/lucide-imports.test.ts` 가 잰다) - CLI 로
받은 파일(select·checkbox 등)이 통에서 아이콘을 받으면 lint 에서 멈추니, 받은 뒤 깊은 import 로 바꾸고 "원본과
다른 곳" 주석을 단다. 타입(`import type { LucideIcon }`)은 통에서 받아도 된다.

`app/`·`components/` 의 클래스에 **`@media` 로 컴파일되는 변형을 쓰지 않는다** - 너비(`sm:`·`md:`·`lg:`·`xl:`·
`2xl:` 과 그 `max-`·`min-` 꼴), 방향(`portrait:`·`landscape:`), 플랫폼(`ios:`·`android:`·`native:`·`tv:`·
`android-tv:`·`apple-tv:`), `[@media …]:` 꼴의 임의 변형. Uniwind 1.12.0 이 한 미디어 블록의 둘째 규칙부터 조건을
잃어 그 규칙이 모든 폭과 모든 플랫폼에서 적용된다(`sm:h-9` 가 폰에서도, `android:px-4` 가 iOS 에서도). 받은 파일에서도
뺀다. 플랫폼마다 다른 스타일은 클래스 변형이 아니라 `Platform.select`·`Platform.OS` 로 클래스 문자열을 고른다.
`dark:` 는 영향이 없다. `test/unit/ui/breakpoints.test.ts` 가 `app/`·`components/` 를 훑어 막는다. 근거와 잰 범위는
`docs/superpowers/notes/2026-09-30-d3-measurements.md` 의 L2.

## 로딩 표현

로딩 상태에 텍스트를 쓰지 않는다. 스켈레톤 또는 스피너만 쓴다(스펙 8.7).

## 사라질 자리를 인용하지 마라

코드·문서 주석에서 선행 점이 붙은 `.superpowers/`, 세션이 끝나면 사라지는 태스크 보고·
리뷰·브리프 파일, 스크래치패드를 가리키지 않는다. 모든 인용이 죽은 링크가 된다. 근거는
**사실 문장**으로 적고, 문서가 필요하면 커밋되는 `docs/superpowers/`를 가리킨다.

## 검증 명령

```bash
pnpm install --frozen-lockfile
./scripts/check.sh
```

`./scripts/check.sh` 하나가 유일한 게이트다(typecheck · lint · format · secretlint · 인용 ·
복사 출처 · unit · 설정 · 의존성 호환 · 번들 · compose · 계약 거울 · E2E). 전제 조건(Docker, 네트워크,
Android SDK·Maestro·에뮬레이터)은 그 파일 머리말에 있다. 정적 단계 [1]–[11] 만은
`./scripts/check.sh --static`이다(CI 의 checks 잡이 부른다 - 통과해도 게이트 통과가 아니다). Windows에서는 Git Bash에서
`./scripts/check.sh`로 돌린다 - `package.json`의 `check` 스크립트(`pnpm check`)는 pnpm이 cmd.exe로
돌려 `./`를 못 찾고 실패한다. 실행 권한이 살아 있어야 통과한다 - `git ls-tree HEAD scripts/ test/e2e/ test/contract/`에서
`scripts/check.sh`·`scripts/check-citations.sh`·`test/e2e/android.sh`·`test/e2e/run-android.sh`·
`test/e2e/guard-log.sh`·`test/contract/run.sh` 여섯이 `100755`인지 확인한다(`scripts/check-provenance.mjs`·
`scripts/check-variant-config.mjs`는 `node`가 부르므로 `100644`가 맞다). `core.filemode=false`인 머신에서는 권한이 빠져도 `git status`로 드러나지
않는다. E2E 플로를 쓰는 규칙과 하네스의 환경 변수는 `test/e2e/AGENTS.md`에, 계약 거울의 규칙과 돌리는 법은
`test/contract/AGENTS.md`에 있다.

설정 단계 [8]은 네 변형을 EAS 프로젝트가 없을 때와 있을 때(가짜 id)로 평가해, 설정 플러그인이 네이티브 설정으로
옮길 값(`expo config --type introspect`)이 변형 표·OTA 판단(`lib/config/`)과 같은지 `scripts/check-variant-config.mjs`로
본다. 평가는 저장소 루트가 아니라 커밋 대상 파일의 깨끗한 사본(`.maestro-output/variant-config-src`, `android/`·`ios/`
없음, 끝나면 지운다)에서 한다 - 저장소 안에서 빌드하는 E2E 하네스나 dev client의 prebuild가 루트에 남긴 `android/`를 설정
플러그인이 바탕으로 삼으면 앞선 빌드의 scheme이 섞여 설정이 어긋난 것처럼 보인다. 셸이 내보낸 `EAS_PROJECT_ID`가 섞이지
않도록 그 단계는 프로젝트 id 두 자리를 빈 값으로도 명시한다.

번들 단계는 `expo export --clear`라서 Metro·Uniwind 캐시를 지운다 - 게이트를 돌리기 전에 이 저장소의
`expo start`를 끈다. 캐시를 두면 이 개발 머신(Windows)에서 `expo export`가 끝날 때 간헐적으로 죽었다(실측 기록
M1 관찰 8).

secretlint 단계는 `pnpm lint:secrets`다. 스크립트 이름을 `secretlint`로 두면
`node_modules/.bin/secretlint`를 가려서 의존성 호환 단계(expo-doctor)의 package.json 검사가
실패한다.

`pnpm typecheck`는 타입 프로그램 둘을 돈다. 앱 코드(`app/`·`components/`·`lib/`·`platform/`·`queries/`)는
`tsconfig.json`으로 검사하고, 그 `types`는 `expo/types`뿐이라 Node 타입이 없다. 시험(`test/`)은
`test/tsconfig.json`으로 검사하고, 이 설정은 루트 설정을 물려받아 `node` 타입을 더한다(시험이
`node:fs` 같은 Node 모듈을 import하기 때문이다). 둘로 나눈 이유는 Node 전용 전역(`Buffer`,
`NodeJS.Timeout`)이 RN 앱 코드에 들어오지 않게 하려는 것이다 - `node` 타입을 앱 프로그램에 더하면
`setTimeout`의 반환형이 `number`가 아니라 `NodeJS.Timeout`이 된다. 시험이 import하는 `lib/`
파일은 두 프로그램에서 모두 검사되므로, 그런 파일의 타이머 핸들은
`ReturnType<typeof setTimeout>`으로 적는다.

실측 기록은 `docs/superpowers/notes/2026-09-30-d1-measurements.md`다. 기기 위의 동작(M1–M8)이
궁금하면 거기부터 읽는다. 세 백엔드가 싣는 캐시 머리글(D2 실측 H1)은
`docs/superpowers/notes/2026-09-30-d2-measurements.md`에 있다.
목록 주소의 인코딩 규칙, Uniwind 결함의 대응, 네이티브 HTTP 캐시 아래의 신선도, 닿지 못한 재조회(D3 실측 L1–L7)는
`docs/superpowers/notes/2026-09-30-d3-measurements.md`에 있다.
쓰기 E2E 와 기기에서 잰 회전의 실제 왕복·가드가 보낸 로그인 화면의 뒤로 가기와 "홈으로"·쌓인 화면의 재조회·빠른 두 번
누름(D4 실측 W1–W4)은 `docs/superpowers/notes/2026-10-01-d4-measurements.md`에 있다.
계약 거울의 드리프트 감지와 게이트 13단계, 계약 실험실의 기기 E2E(D5 실측 C1–C3)는
`docs/superpowers/notes/2026-10-01-d5-measurements.md`에 있다.
EAS·OTA 설정의 변형별 검증, 설정이 다르면 fingerprint runtime version 이 갈리는 것, 빌드 정보 카드(D6 실측 O1–O4)는
`docs/superpowers/notes/2026-10-01-d6-measurements.md`에 있다.
세 백엔드의 계약 거울, 멈춘 서버로 잰 요청 타임아웃, 360dp 의 날짜 자리표시자, CI 매트릭스의 첫 실행(D7 실측 K1–K3)은
`docs/superpowers/notes/2026-10-01-d7-measurements.md`에 있다.
