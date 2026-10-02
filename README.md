# TypeScript Expo Template

FastAPI · NestJS · Rails 세 백엔드 템플릿이 공유하는 JSON:API 1.1 계약을 소비하는 Android · iOS 앱 템플릿입니다. 웹 템플릿 `template-typescript-nextjs` 와 같은 계약, 같은 화면 범위를 Expo(React Native)로 제공합니다. 백엔드 전환은 `BACKEND_URL` 하나이고 어댑터 계층이 없습니다 - 세 백엔드의 공개 계약이 통일되어 있어서 앱은 어느 백엔드를 상대하는지 몰라도 됩니다.

들어 있는 것은 **JSON:API 코어**(`lib/jsonapi/` - 문서 파싱, `included` 정규화, 쿼리 직렬화, 오류 분류, 15초 타임아웃의 HTTP 클라이언트), **인증·세션**(`lib/auth/` · `platform/session.ts` - SecureStore 항목 하나에 둔 세션, 한 곳에서 한 번에 하나만 도는 토큰 회전, 보호 경로 가드), **자원**(`lib/resources/` - 백엔드 조회 정책을 손으로 베낀 선언, `components/resource/` - 그 선언을 읽어 그리는 획일 UI), **데이터**(`queries/` - TanStack Query 의 캐시 키·조회·쓰기 훅·무효화), 그 위의 **화면**(목록 · 상세 · 생성 · 수정 · 삭제 · 가입 · 로그인, 계약 실험실, 홈의 빌드 정보 카드), 그리고 **EAS 빌드·OTA 설정**(`eas.json`, `expo-updates`)입니다.

자원은 예시 하나(`examples`)와 그 참조 자원 둘(`exampleCategories` · `exampleTags`)이 등록돼 있습니다. 새 자원을 더하는 절차와 계층 소유권·위반의 정의는 `AGENTS.md` 가 갖습니다. 설계의 정본은 `docs/superpowers/specs/2026-09-30-expo-jsonapi-template-design.md` 입니다.

## 먼저 - 앱 식별자를 바꿉니다

배포하기 전에 반드시 `app.config.ts` 의 값 넷을 바꿉니다. 기본 식별자는 일부러 배포할 수 없는 값입니다 - Google Play 는 `com.example` 로 시작하는 패키지 이름을 받지 않습니다.

| 값            | 기본값                     | 무엇                                                                                                                   |
| ------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `BASE_APP_ID` | `com.example.templateexpo` | Android 패키지 이름이자 iOS 번들 ID. 변형마다 접미사가 붙습니다(아래 "변형")                                           |
| `BASE_SCHEME` | `templateexpo`             | 딥링크 scheme. 변형마다 접미사가 붙습니다                                                                              |
| `BASE_NAME`   | `Template Expo`            | 앱 이름                                                                                                                |
| `SLUG`        | `template-typescript-expo` | Expo 프로젝트의 slug - EAS 프로젝트의 slug 와 같아야 하고, 개발 클라이언트의 scheme(`exp+<slug>`)이 이 값에서 나옵니다 |

아이콘과 스플래시 이미지는 `assets/` 에 있습니다. E2E 플로·하네스와 단위 시험은 `e2e` 변형의 식별자(`com.example.templateexpo.e2e`)와 scheme(`templateexpo-e2e`)을 글자로 적습니다 - 아래 명령이 보여 주는 자리를 같은 값으로 바꾸고 게이트로 확인합니다.

```bash
git grep -n -e 'com\.example\.templateexpo' -e 'templateexpo-e2e' -e 'exp+template-typescript-expo' -- test
./scripts/check.sh
```

## 시작하기

준비물은 Node 24.11 이상(24.19.0 에서 쟀습니다), pnpm 11.22.0(`corepack enable` 이 `package.json` 의 `packageManager` 를 따릅니다), 개발 빌드를 만들 Android SDK 와 에뮬레이터(또는 macOS 의 Xcode), 로컬 백엔드를 띄울 Docker 입니다.

```bash
pnpm install --frozen-lockfile
cp .env.example .env   # BACKEND_URL 을 앱이 닿을 백엔드 주소로 채웁니다
```

로컬 백엔드는 이 저장소의 E2E 스택을 그대로 쓰면 가장 빠릅니다 - 마이그레이션과 씨앗 데이터까지 마친 백엔드 하나가 호스트의 4100 번에 섭니다. Android 에뮬레이터에서 호스트는 `10.0.2.2`, iOS 시뮬레이터에서는 `localhost` 입니다(`.env.example` 의 값이 Android 쪽입니다).

```bash
docker compose -p template-typescript-expo-e2e --profile fastapi -f docker-compose.e2e.yml up -d --build --wait
# 내릴 때는 세 프로파일을 모두 줍니다 - 띄운 것과 다른 프로파일로 내리면 컨테이너가 남습니다
docker compose -p template-typescript-expo-e2e --profile fastapi --profile nestjs --profile rails -f docker-compose.e2e.yml down -v --remove-orphans
```

개발은 개발 클라이언트(`expo-dev-client`)가 든 development build 로 합니다 - Expo Go 는 대상이 아닙니다.

```bash
pnpm exec expo run:android   # development 변형을 빌드해 설치하고 Metro 를 띄웁니다
pnpm exec expo run:ios       # macOS
pnpm start                   # 개발 빌드가 이미 설치돼 있으면 Metro 만
```

**Windows 에서는 저장소를 짧은 경로에 둡니다.** Android 네이티브 빌드(Gradle · CMake · ninja)는 저장소의 실제 디렉터리 경로가 47자 이하일 때만 성공했습니다(pnpm 의 hoisted 링커로 47자까지 성공, 50자에서 실패 - `docs/superpowers/notes/2026-09-30-d1-measurements.md` 의 M1). E2E 하네스는 짧은 경로의 사본에서 빌드하지만 `expo run:android` 는 저장소 자리에서 빌드합니다.

## 환경 변수

앱이 읽는 변수는 셋입니다. 정본은 `app.config.ts` 이고(검증은 `lib/config/` - `settings.ts` · `app-variant.ts` · `updates.ts`), `.env.example` 이 같은 값을 적습니다. 세 곳이 어긋나면 게이트가 멈춥니다(`test/unit/docs/doc-set.test.ts`).

| 변수             | 필수   | 기본값        | 역할                                                                                                                        |
| ---------------- | ------ | ------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `BACKEND_URL`    | 예     | 없음          | 백엔드의 절대 URL(끝 슬래시는 잘립니다). `preview` · `production` 변형에서는 `https` 여야 합니다                            |
| `APP_VARIANT`    | 아니오 | `development` | 빌드 변형 - `development` · `preview` · `production` · `e2e`(아래 "변형")                                                   |
| `EAS_PROJECT_ID` | 아니오 | 없음          | EAS 프로젝트 id(UUID - `eas init` 이 만듭니다). 있으면 `preview` · `production` 변형의 OTA 를 켭니다(아래 "EAS 빌드와 OTA") |

**필수 변수에는 코드상의 암묵적 기본값을 두지 않습니다.** `BACKEND_URL` 이 없으면 `BACKEND_URL is required` 로 **설정을 평가하는 순간** 멈춥니다 - `expo start` · `expo export` · 로컬과 EAS 빌드 · OTA 발행이 모두 그렇습니다. 앱은 시작할 때 같은 함수로 한 번 더 검증하고(OTA 로 들어온 설정까지 대비합니다), 실패하면 변수 이름이 든 설정 오류 화면을 그립니다.

Expo CLI 는 `.env` 를 읽습니다. E2E · 계약 거울 · CI 의 하네스가 읽는 변수(`BACKEND_KIND` · `E2E_AVD` · `E2E_FLOW` · `E2E_API_PORT` 등)는 앱이 모릅니다 - 그 표는 `test/e2e/AGENTS.md` 와 `test/contract/AGENTS.md` 에 있습니다.

## 변형

`APP_VARIANT` 하나가 식별자 · scheme · 앱 이름 · 평문 HTTP · OTA 를 정합니다. 표의 정본은 `lib/config/app-variant.ts` 이고, 게이트의 설정 단계가 네 변형을 평가해 네이티브 설정이 될 값을 이 표와 맞댑니다(`scripts/check-variant-config.mjs`).

| 변형          | 식별자 · scheme 접미사  | 평문 HTTP | OTA                | 용도                                       |
| ------------- | ----------------------- | --------- | ------------------ | ------------------------------------------ |
| `development` | `.dev` · `-dev`         | 허용      | 끔                 | 개발 클라이언트로 개발                     |
| `preview`     | `.preview` · `-preview` | 금지      | 켬(`preview` 채널) | 내부 배포                                  |
| `production`  | 없음                    | 금지      | 켬(`production`)   | 스토어                                     |
| `e2e`         | `.e2e` · `-e2e`         | 허용      | 끔                 | E2E 용 Release 빌드 - 내장 번들로만 돕니다 |

접미사 덕분에 한 기기에 여러 변형을 함께 설치할 수 있고, scheme 도 변형마다 달라 딥링크가 갈 변형이 정해집니다. 개발 클라이언트가 더하는 scheme(`exp+template-typescript-expo`)도 `development` 에만 싣습니다. 평문 HTTP 는 Android 의 `usesCleartextTraffic` 과 iOS ATS 의 로컬 네트워크 예외로 켜고, `preview` · `production` 에 `http://` 주소를 주면 설정 단계에서 멈춥니다. OTA 는 채널이 있는 두 변형에 `EAS_PROJECT_ID` 가 있을 때만 켜집니다.

`android/` · `ios/` 는 `expo prebuild` 가 만들고 커밋하지 않습니다(Continuous Native Generation) - 네이티브 설정은 `app.config.ts` 와 설정 플러그인으로만 바꿉니다.

## 화면

경로의 정본은 `app/` 의 파일 배치이고, **인증 필요 여부의 정본은 `lib/auth/protected-paths.ts` 입니다.** 앱 셸(`app/(app)/_layout.tsx`)의 경로 가드가 세션 없이 보호 경로에 온 사용자를 `/login?next=<원래 경로>` 로 보내고, 로그인하면 그 경로로 돌아옵니다. 쓰기 훅도 요청 직전에 세션을 다시 확인합니다.

| 경로                   | 인증 | 내용                                                                              |
| ---------------------- | ---- | --------------------------------------------------------------------------------- |
| `/`                    | 공개 | 홈 - 목록 · 실험실 진입, 빌드 정보 카드                                           |
| `/examples`            | 공개 | 목록 - 필터 시트, 정렬 메뉴, 무한 스크롤(커서), 당겨서 새로고침, 빈 결과          |
| `/examples/[id]`       | 공개 | 상세 - 분류 · 태그 배지, UTC 시각, 없는 id 는 not-found                           |
| `/examples/new`        | 필요 | 생성 - 필수 입력, 분류 단일 선택, 태그 다중 선택(고른 순서 유지)                  |
| `/examples/[id]/edit`  | 필요 | 수정 · 삭제 - 기존 값 유지, 삭제 확인                                             |
| `/login` · `/register` | 공개 | 로그인 · 가입(가입은 이어서 로그인합니다). 돌아갈 화면이 없으면 머리글에 "홈으로" |
| `/contract`            | 공개 | 계약 실험실 - 실무 화면이 쓰지 않는 여섯 백엔드 표면의 원본 응답                  |

**라우트 파라미터가 곧 쿼리입니다.** 목록의 필터 · 정렬은 라우트 파라미터에 있어 딥링크 하나로 같은 목록이 재현되고, 뒤로 가기가 이전 조건을 되살립니다. 딥링크의 대괄호와 값의 특수 문자는 퍼센트 인코딩합니다.

```text
templateexpo-dev://examples?filter%5Bstatus%5D=active&sort=-createdAt
```

로딩은 스켈레톤과 스피너로만 그리고 글자를 쓰지 않습니다. 오류 문구는 백엔드가 `Accept-Language`(기기의 언어 설정)로 협상한 것을 그대로 그립니다 - 앱 자신의 문구는 둘뿐입니다. 쓸 수 있는 응답을 받지 못했을 때(네트워크 실패 · 타임아웃 · 계약을 어긴 응답)의 한 문장과, 가입은 됐는데 이어지는 로그인이 실패했을 때의 안내입니다. 조회 화면은 앞의 문장과 함께 "다시 시도" 를 그립니다. 조회가 계약을 어긴 응답(문구 없는 오류 문서 · 본문 없는 성공 응답)을 받거나 코드에 결함이 있으면 화면 대신 루트의 오류 경계가 그려집니다(아래 "알려진 한계"). 다크 모드는 시스템 설정을 따릅니다.

> **계약 실험실은 개발 · 검증용 표면입니다.** 공개인 채로 두면 익명 클릭 한 번이 백엔드 요청을 최대 스무 개(offset 순회의 상한) 내고, 가입이 열려 있어 계정을 만들면 PUT upsert · 관계 전용 쓰기로 쓰기까지 닿습니다. 프로덕션에 올릴 때는 라우트(`app/(lab)/contract.tsx`)와 홈(`app/(app)/index.tsx`)의 실험실 진입, 그 E2E 플로(`test/e2e/flows/` 의 `contract-lab-*`)를 지우십시오 - 실험실만 쓰는 `components/lab/` · `queries/lab.ts` · `lib/lab/` 도 함께 지울 수 있습니다. 실험실 코드까지 삭제하면 `test/unit/lab/`의 시험, `docs/provenance/copied-core.json`의 해당 경로 기록, 루트와 `lib/`·`components/`·`queries/`·`test/unit/`의 `AGENTS.md`에 있는 관련 항목·인용도 함께 정리합니다. 실험실은 앱 셸 밖의 라우트라 보호 경로 목록에 더해도 가드가 닿지 않습니다.

## 백엔드 전환

**전환은 `BACKEND_URL` 하나입니다.** E2E 와 계약 거울에서는 `BACKEND_KIND`(`fastapi` · `nestjs` · `rails`, 기본 `fastapi`)가 `docker-compose.e2e.yml` 의 compose 프로파일을 고릅니다. 세 `api-*` 서비스가 같은 호스트 포트(4100) 뒤에 서므로 앱 빌드 하나로 세 백엔드를 검증합니다. 셋 밖의 값을 주면 Docker 와 기기를 건드리기 전에 멈춥니다(`test/e2e/matrix.ts`).

```bash
BACKEND_KIND=nestjs ./test/contract/run.sh
BACKEND_KIND=rails ./test/e2e/run-android.sh
```

백엔드 이미지는 각 백엔드 저장소의 GitHub `main` 에서 빌드하고, 이미 있으면 다시 쓰입니다. 백엔드 `main` 이 바뀐 뒤에는 그 프로파일의 이미지를 먼저 다시 빌드해야 최신 코드가 검증됩니다.

```bash
export BACKEND_KIND=rails
COMPOSE_PROFILES="$BACKEND_KIND" docker compose -p template-typescript-expo-e2e -f docker-compose.e2e.yml build --pull "api-$BACKEND_KIND" "migrate-$BACKEND_KIND"
```

마지막으로 세 백엔드를 모두 검증한 실행과 그때의 백엔드 커밋은 `docs/superpowers/notes/2026-10-01-d8-measurements.md` 에 있습니다. 알려진 계약 드리프트는 `test/e2e/matrix.ts` 의 `KNOWN_DIVERGENCES` 에 적고, 하네스가 스택을 띄울 때마다 그 수를 찍습니다.

## EAS 빌드와 OTA

게이트와 CI 는 Expo 계정 없이 돕니다 - 로컬과 CI 는 `expo prebuild` 뒤 Gradle 과 xcodebuild 로 직접 빌드합니다. EAS 빌드와 OTA 발행은 여러분의 Expo 계정과 빌드 크레딧을 씁니다.

`eas.json` 의 빌드 프로필은 변형과 같은 넷이고(프로필 = 변형 = 채널), 모두 Node 24.19.0 · pnpm 11.22.0 을 고정합니다.

| 프로필        | 설정                                                         | 채널         |
| ------------- | ------------------------------------------------------------ | ------------ |
| `development` | 개발 클라이언트, 내부 배포                                   | -            |
| `preview`     | 내부 배포, Android APK                                       | `preview`    |
| `production`  | 스토어 빌드, 빌드 번호 자동 증가(`appVersionSource: remote`) | `production` |
| `e2e`         | Android APK, iOS 시뮬레이터 빌드, 자격 증명 없음             | -            |

`BACKEND_URL` 은 `eas.json` 에 적지 않습니다 - 실제 주소는 템플릿이 알 수 없으므로 EAS 환경 변수로 넣고, 빠지면 빌드가 곧바로 멈춥니다.

```bash
eas login
eas init   # 설정이 동적(app.config.ts)이라 id 를 파일에 쓰지 못하고 알려 줍니다 - .env 의 EAS_PROJECT_ID 에 둡니다
eas env:create --environment preview --name BACKEND_URL --value https://api.example.com
eas build --profile preview --platform android
APP_VARIANT=preview BACKEND_URL=https://api.example.com EAS_PROJECT_ID=<id> eas update --channel preview --environment preview
```

- runtime version 은 `fingerprint` 정책입니다 - 네이티브 구성이 같은 빌드에만 업데이트가 갑니다. 발행하는 셸의 `APP_VARIANT` · `BACKEND_URL` · `EAS_PROJECT_ID` 가 빌드와 다르면 지문이 달라 업데이트가 어떤 빌드에도 닿지 않습니다(`docs/superpowers/notes/2026-10-01-d6-measurements.md` 의 O1). EAS 빌드 서버에는 `EAS_PROJECT_ID` 를 넣지 않아도 됩니다 - 서버가 주는 `EAS_BUILD_PROJECT_ID` 를 씁니다.
- 앱은 켤 때 업데이트를 확인하되 기다리지 않습니다 - 받은 업데이트는 다음 실행에 적용됩니다. 홈의 빌드 정보 카드가 앱 버전 · 변형 · OTA · runtime version · 채널 · 업데이트 ID 를 보여 주고, "업데이트 확인" 으로 받은 업데이트를 바로 적용합니다.
- 스토어 제출은 `eas submit --profile production` 입니다. Android 는 `internal` 트랙의 draft 로 올립니다. iOS 의 App Store Connect 앱 id 같은 계정 고유 값은 저장소에 적지 않았습니다 - 첫 제출 때 EAS 가 묻고 저장합니다.
- 조직 계정이나 로봇 토큰으로 빌드하면 eas-cli 가 `owner` 를 요구합니다 - `app.config.ts` 에 한 줄을 더합니다.
- `development` 프로필은 개발 클라이언트가 든 빌드를 만듭니다(`expo-dev-client` 가 설치돼 있습니다).

## 검증 - 단일 게이트

```bash
pnpm install --frozen-lockfile
./scripts/check.sh            # 13단계 - 이 명령이 통과해야 통과입니다
./scripts/check.sh --static   # 정적 단계 [1]–[11] 만 - CI 의 checks 잡이 부릅니다
```

| 단계     | 무엇                                                                                                             |
| -------- | ---------------------------------------------------------------------------------------------------------------- |
| [1]–[4]  | typecheck(앱과 시험의 두 타입 프로그램) · lint(계층 import 경계 포함) · format · secretlint                      |
| [5]      | 인용 - 사라질 자리를 가리키는 인용이 없다(`scripts/check-citations.sh`)                                          |
| [6]      | 복사 출처 - `docs/provenance/copied-core.json` 의 형식 · 경로 · 원본과 같은 내용(`scripts/check-provenance.mjs`) |
| [7]      | unit - vitest(`lib/` 의 판단, `queries/` · `platform/` 의 순수 부분, 스크립트, 문서군)                           |
| [8]      | 설정 - 네 변형 × EAS 프로젝트 유무를 평가해 변형 표와 맞댑니다                                                   |
| [9]–[11] | 의존성 호환(expo-doctor) · 번들(`expo export --clear`, Android · iOS) · compose 설정(세 프로파일)                |
| [12]     | 계약 거울 - FastAPI 스택에 자원 선언과 쓰기 갈림·JWT 수명을 HTTP로 맞댑니다(`test/contract/run.sh`)              |
| [13]     | E2E - e2e APK → Android 에뮬레이터 → Maestro(FastAPI)(`test/e2e/run-android.sh`)                                 |

**로컬 게이트는 FastAPI 하나, Android 하나만 돕니다.** 세 백엔드와 iOS 는 CI 가 돕니다. 전제 조건은 Docker([11]–[13]), 네트워크([9]), Android SDK(`ANDROID_HOME`) · Maestro 2.11 · 켜진 에뮬레이터나 부팅할 AVD 이름(`E2E_AVD`)([13])이고, 빠진 것이 있으면 무엇이 빠졌는지 알리고 멈춥니다. [10] 이 Metro 캐시를 지우므로 이 저장소의 `expo start` 를 먼저 끕니다. Maestro 2.11.0 은 `test/e2e/install-maestro.sh` 가 체크섬을 확인하고 `~/.maestro` 에 풉니다(Java 17 이 필요합니다).

Windows에서는 아래 E2E의 단독/새 부팅 규칙도 지킵니다. Git Bash에서 `./scripts/check.sh`로 돌립니다 - `pnpm check` 는 pnpm 이 cmd.exe 로 돌려 `./` 를 찾지 못합니다. 저장소 경로가 47자를 넘으면 [13] 이 짧은 경로(`E2E_STAGE_DIR`, 기본 `C:/t/e`)의 사본에서 APK 를 만듭니다. 스크립트의 실행 권한이 살아 있어야 통과합니다 - `core.filemode=false` 인 머신에서는 권한이 빠져도 `git status` 에 드러나지 않으니 `git ls-tree HEAD scripts/ test/e2e/ test/contract/` 에서 실행 진입점 `.sh`가 `100755`인지 봅니다(source 전용 `test/e2e/ios-simulator.sh`는 `100644`).

## E2E

Maestro 플로(`test/e2e/flows/`)가 실제 백엔드와 에뮬레이터 · 시뮬레이터 위에서 앱을 돕니다 - 모킹 계층이 없습니다. 인증 · 세션(앱을 다시 켠 뒤의 복원 포함), 목록 · 상세(무한 스크롤 · 당겨서 새로고침 · 딥링크로 조건 재현), 쓰기(실제 토큰 회전을 지납니다), 계약 실험실, 빌드 정보 카드, 한국어 · 영어 오류를 잽니다. 가드는 기기 로그입니다 - JS 오류 · 경고와 플로가 선언하지 않은 4xx · 5xx 가 있으면 실패이고, 재시도는 0 입니다. 가드 뒤에 하네스가 그 플로의 백엔드 접근 로그로 앱의 요청 수를 단언합니다(`test/e2e/request-counts.ts` - 쓰기마다 토큰 회전 하나, 다시 앞에 온 목록의 재조회, 두 번 누른 제출의 요청 하나). 요청 수는 FastAPI 의 접근 로그로만 셉니다 - NestJS 는 요청을 로그에 남기지 않고 Rails 는 다른 형식(lograge 의 JSON)입니다.

```bash
E2E_AVD=Pixel_9_API_36 ./test/e2e/run-android.sh      # 전부 - 스택을 띄우고, 빌드 입력이 바뀌었으면 APK 를 다시 만든다
E2E_FLOW="examples-browse" ./test/e2e/run-android.sh  # 일부 - 개발용
```

APK 를 다시 만들 때 하네스는 Metro 캐시를 비우고 Gradle 을 데몬 없이(`--no-daemon`) 돌립니다 - Windows 에서 남은 Gradle 데몬이 짧은 경로 사본의 파일을 쥐어 다음 실행을 막았습니다(`docs/superpowers/notes/2026-10-01-d4-measurements.md` 의 W1). Windows 게이트는 소유한 AVD를 새로 부팅하고 다른 시험·타입 검사·번들·Gradle이 끝난 뒤 혼자 돕니다(`docs/superpowers/notes/2026-10-01-d5-measurements.md`의 C2). 다른 작업을 임의 종료하지 않습니다. 콜드 보호 링크는 `cold-links`가 next를 보존하는지 잽니다. 멈춘 서버 확인은 `E2E_CHECKS=1`로 headers/body 두 REQUEST_TIMEOUT을 검증합니다. 결과(Maestro 기록 · 스크린샷 · 기기 로그 · 백엔드 접근 로그)는 `.maestro-output/e2e/<플로>/` 에 남습니다. 플로를 쓰는 규칙과 하네스의 환경 변수는 `test/e2e/AGENTS.md` 에, 씨앗 데이터의 규칙은 `test/e2e/seed/README.md` 에 있습니다.

## CI

`.github/workflows/ci.yml` 하나이고, 모든 브랜치의 push 와 pull request 에서 돕니다(`docs/` 만 바꾼 커밋은 돌지 않습니다).

| 잡                | 러너   | 하는 일                                                                                                                   |
| ----------------- | ------ | ------------------------------------------------------------------------------------------------------------------------- |
| `checks`          | ubuntu | `./scripts/check.sh --static`(게이트 [1]–[11])과 워크플로 lint(actionlint)                                                |
| `build-android`   | ubuntu | e2e APK 를 한 번 만들어 아티팩트로 올립니다                                                                               |
| `e2e-android` × 3 | ubuntu | 백엔드마다 계약 거울 → KVM 에뮬레이터에서 Maestro(받은 APK)                                                               |
| `build-ios`       | macOS  | 시뮬레이터용 Release `.app` 을 한 번 만들어 올립니다                                                                      |
| `e2e-ios` × 6     | macOS  | 백엔드마다 두 shard, 합집합으로 기존 한 iOS 셀. 소유 simulator의 서비스 축소·AutoFill/scheme 준비·한 번 재부팅 후 Maestro |

- 매트릭스는 `fail-fast: false` 이고 재시도는 0 입니다 - 실패한 잡을 코드 변경 없이 다시 돌리지 않습니다. 흔들리는 플로는 원인을 고칩니다.
- 아티팩트: 갈래마다 `e2e-android-<백엔드>` · `e2e-ios-<백엔드>-shard-<번호>` 에 플로별 Maestro 기록 · 스크린샷 · 기기 로그 · `api.log`(14일), 앱 둘(7일), iOS 빌드 기록이 남습니다. 빨간 칸은 그 플로의 기기 로그(`device.log` - 가드가 본 것)와 스크린샷부터 봅니다.
- macOS 실행은 계정의 동시 잡 한도를 공유합니다. 이 워크플로는 다섯 이하로 제한하며 여섯 번째 shard의 대기도 측정합니다.
- CI APK는 x86_64만 만들고 로컬 기본 APK는 네 ABI입니다. iOS는 backend마다 두 shard이며 macOS 동시 잡은 최대 다섯입니다. 플로 목록의 합집합·무중복이 검사됩니다. 빌드·E2E 시간과 실제 macOS 대기는 `docs/superpowers/notes/2026-10-01-d8-measurements.md`의 G4에 있습니다. 검증되지 않은 iOS 컴파일 캐시는 철회했습니다. Expo 미리 빌드한 모듈과 action SHA 고정은 적용하지 않았습니다.

잡이 하는 일의 정본은 저장소의 스크립트이고 워크플로는 러너 · 캐시 · 아티팩트만 정합니다(`.github/workflows/AGENTS.md`). Mac 이 있으면 iOS 갈래를 로컬에서 같은 스크립트로 돕니다.

```bash
test/e2e/install-maestro.sh                               # Maestro 2.11.0(Java 17)
test/e2e/native-backend.sh services                       # Homebrew 의 PostgreSQL 18 · Redis
BACKEND_KIND=fastapi test/e2e/native-backend.sh fetch     # 백엔드 저장소 main
BACKEND_KIND=fastapi test/e2e/native-backend.sh prepare   # 런타임 - uv · pnpm · bundler
BACKEND_URL=http://localhost:4100 ./test/e2e/run-ios.sh
```

네이티브 백엔드는 하네스가 직접 시작한 Redis만 씁니다. PID·실행 파일·전용 설정 경로·포트·실제 리스너가 모두 같은
프로세스일 때만 재사용하거나 종료하며, 외부 Redis가 포트를 차지하면 시작 전에 멈춥니다. iOS 하네스는 전용
시뮬레이터의 불필요한 데몬을 끄고 AutoFill 해제·딥링크 scheme 사전 승인을 준비한 뒤 한 번 재부팅해 적용 값을
확인합니다. 종료할 때 자기 시뮬레이터를 삭제합니다(`test/e2e/AGENTS.md`).

## 복사한 코어

`lib/` 의 상당 부분(JSON:API 코어 · 자원 선언 · 인증 판단 · 실험실의 실험 정의)과 그 단위 시험은 `template-typescript-nextjs` @ `34d0b10` 에서 **복사**했습니다. 두 저장소 사이에 코드 의존은 없습니다 - 공유 패키지는 "클론하면 돈다" 를 깨고, 정합성은 공유 코드가 아니라 계약 거울과 실제 백엔드 E2E 가 지킵니다.

무엇을 복사했고 원본과 무엇이 다른지는 `docs/provenance/copied-core.json` 이 정본입니다. 게이트 [6] 이 그 기록의 형식과 경로를 검사하고, 이탈이 없는 사본은 원본의 blob SHA-1 과 내용이 같은지까지 잽니다. 복사한 파일을 고치면 그 경로의 `divergences` 에 `what` · `why` 를 적습니다(`AGENTS.md` 의 "복사한 코어"). 원본에서 계약 버그가 고쳐지면 출처 커밋과 원본을 비교해 반영할지 정합니다.

## 알려진 한계

- **웹은 대상이 아닙니다** - `template-typescript-nextjs` 가 맡습니다. Expo Go 호환도 보장하지 않습니다. 푸시 알림(백엔드에 기기 토큰을 등록할 표면이 없습니다), 생체 인증 잠금, 오프라인 읽기 캐시는 없습니다.
- **세션**: 회전 요청을 보낸 직후 OS 가 앱을 멈춰 응답을 받지 못하면 서버는 이미 옛 refresh 를 폐기했으므로 다음 실행에서 로그아웃됩니다. 기기 시계를 크게 바꾸면 만료 판정이 틀어질 수 있습니다. 회전 응답이 5xx · 408 · 429 면 세션을 지우지 않는데, 서버가 회전을 마친 뒤 그 응답을 냈다면 다음 회전이 재사용 감지에 걸려 그 사용자의 세션이 모두 끊깁니다.
- **iOS 키체인의 세션은 앱을 지워도 남습니다** - 같은 기기에 다시 설치하면 이전 세션이 되살아날 수 있습니다(로그아웃한 세션은 되살아나지 않습니다).
- **반응형 변형을 쓰지 않습니다.** Uniwind 1.12.0 이 한 `@media` 블록의 둘째 규칙부터 조건을 잃어, `sm:` 같은 너비 변형과 `ios:` · `android:` 같은 플랫폼 변형을 쓰지 않습니다 - 폰과 태블릿이 같은 크기를 씁니다(`docs/superpowers/notes/2026-09-30-d3-measurements.md` 의 L2).
- **Xcode와 scene:** CI는 build-ios와 여섯 e2e-ios 잡에 Xcode 26.6를 명시합니다. Xcode 27/iOS 27 빌드는 SDK 57의 scene lifecycle opt-in이 필요하며 현재 모든 변형에 `ios.enableSceneSupport: true`가 켜져 있습니다. SDK 58 이상으로 올릴 때 제거 여부를 검토합니다.
- **Windows 의 Android 네이티브 빌드**는 저장소 경로 47자 이하에서만 됩니다(위 "시작하기").
- **iOS의 네트워크 복귀 재조회·삭제 실패 문구 UI는 기기에서 확인하지 않았습니다.** 비행기 모드가 필요한 플로 둘(`examples-offline-refetch` · `examples-delete-offline`)은 iOS 시뮬레이터에 비행기 모드가 없어 건너뜁니다. 같은 JavaScript 동작은 Android의 두 플로가 검증합니다. 나머지 iOS 전체 매트릭스는 CI의 macOS 러너에서 검증합니다. 개발 머신은 Windows이지만 `docs/superpowers/notes/2026-10-01-d7-measurements.md`의 K3에는 Mac의 부분 재현도 있습니다. 그 로컬 회차에서 실행하지 않은 iOS 27 일부 플로와 이후 통합 CI 성공을 구분합니다. iOS의 E2E 가드는 루트 레이아웃보다 먼저 평가된 모듈의 경고를 가르지 못합니다(같은 번들을 도는 Android가 수준으로 잡습니다).
- **렌더 중 예외의 화면은 Expo Router 의 기본(영어)입니다.** 계약을 어긴 응답과 코드의 결함은 루트의 오류 경계(`app/_layout.tsx` 의 `ErrorBoundary`)로 갑니다. "Retry" 는 조회 캐시를 비운 뒤 루트 앱을 다시 그립니다(일반 시작은 홈이며 초기 cold 링크가 있으면 그 목적지가 다시 적용될 수 있습니다)(`queries/error-boundary.ts`) - 이 초기화 동작은 설치된 react-navigation core를 Node에서 확인했으며 기기에서는 확인하지 않았습니다. 경계에는 다른 출구가 없고, 백엔드가 같은 응답을 주는 동안은 그 화면에 들어갈 때마다 경계가 다시 보입니다.
- **관계 선택기**는 이름 순 첫 100건만 보이고 검색이 없습니다 - 잘리면 그 사실을 알립니다.
- **목록 조건의 값 안에 든 `%XX`** 는 Expo Router 가 값을 한 번 더 디코딩해 바뀝니다.
- 두 E2E 하네스(`test/e2e/run-android.sh` · `test/e2e/run-ios.sh`)가 약 60줄을 겹쳐 갖습니다 - 어긋나기 시작하면 한 파일로 모읍니다.
- **EAS 실계정의 한 바퀴**(`preview` 빌드 설치 → 업데이트 발행 → 앱이 그 업데이트를 받는다)는 아직 돌리지 않았습니다 - 게이트와 CI 는 계정 없이 설정 값과 OTA 를 끈 빌드만 잽니다.

## 문서

- `AGENTS.md` - 계층 계약, 새 자원 추가 절차, 검증 명령. 디렉터리마다 있는 `AGENTS.md` 가 자기 디렉터리의 세부를 갖습니다(루트 `AGENTS.md` 의 "디렉터리 문서 탐색").
- `docs/superpowers/specs/2026-09-30-expo-jsonapi-template-design.md` - 설계의 정본. 구현과 달라진 자리는 날짜가 붙은 정정으로 적습니다.
- `docs/superpowers/plans/` - 단계별 구현 계획, `docs/superpowers/notes/` - 실측 기록.
- 게이트 [7] 의 `test/unit/docs/doc-set.test.ts` 가 README 와 `AGENTS.md` 가 인용한 경로가 있는지, 각 `AGENTS.md` 가 자기 디렉터리의 파일을 모두 부르는지, 위 환경 변수 표가 `.env.example` 과 같은지 봅니다.
