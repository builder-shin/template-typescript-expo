# 골격·실측·코어 복사 구현 계획 (D1 — 단계 0·1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expo SDK 57 앱의 골격과 정적 검증 게이트를 세우고, 뒤 계획들의 전제가 되는 실측 여덟 가지를 끝내고, `template-typescript-nextjs`의 플랫폼 중립 코어를 출처 기록과 함께 복사한다.

**Architecture:** `lib/`는 react·react-native·expo를 import하지 않는 순수 TypeScript로 두고(ESLint가 강제), 그래서 Next.js에서 복사한 코어와 테스트가 node의 vitest에서 그대로 돈다. 네이티브 모듈 호출은 `platform/`이, 화면은 `app/`(라우트 파일만)이 맡는다. 이 계획이 끝나면 화면은 홈 하나지만 게이트가 초록이고, 코어가 복사·검증돼 있고, 에뮬레이터 위의 Release 빌드가 실제 백엔드에 닿는다는 것이 실측으로 확인돼 있다.

**Tech Stack:** Expo SDK 57 (`expo` ~57.0.26 · `react-native` 0.86.3 · `react` 19.2.3) · Expo Router 57 · TypeScript 6 · pnpm 11.22.0 · Uniwind 1.12 + Tailwind v4 · React Native Reusables · vitest 5 · ESLint 9 · Maestro 2.11 · Docker Compose

**Spec:** `docs/superpowers/specs/2026-09-30-expo-jsonapi-template-design.md`

## Global Constraints

- **런타임 버전은 Expo SDK 57 번들 버전을 따른다** — `expo` ~57.0.26, `react-native` 0.86.3, `react` 19.2.3. SDK에 딸린 패키지는 `pnpm exec expo install <패키지>`로 받는다(스펙 3장).
- **Node `>=24.11.0`, `packageManager: "pnpm@11.22.0"`** — 형제 저장소와 같은 값.
- **TypeScript strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`** (스펙 3장).
- **`lib/**`에서 `react`·`react-native`·`expo`·`expo-*`·`@expo/*`·`@react-native*`를 import하면 위반이다**(스펙 5장). ESLint가 강제한다(Task 2).
- **`app/`에는 라우트 파일만 둔다**(스펙 4장). 판단·타입·상수는 `lib/`로.
- **필수 환경 변수에 코드상의 암묵적 기본값을 두지 않는다.** `BACKEND_URL`이 없으면 `BACKEND_URL is required`로 멈춘다(스펙 10.1).
- **로딩 상태에 텍스트를 쓰지 않는다.** 스켈레톤 또는 스피너만(스펙 8.7).
- **복사한 파일은 `docs/provenance/copied-core.json`에 적고, 원본과 달라진 곳은 전부 `divergences`에 `what`·`why`로 남긴다**(스펙 6.3). 출처 커밋은 `34d0b1057d65693645e75bec4e9558dcf6838822`.
- **사라질 자리를 인용하지 않는다.** 코드·문서 주석에서 선행 점이 붙은 `.superpowers/`, `task-N-report.md` 같은 세션 파일, 스크래치패드를 가리키지 않는다. 문서가 필요하면 커밋되는 `docs/superpowers/`를 가리킨다(스펙 14장).
- **개발 머신의 `joon-*` 컨테이너 9개를 절대 멈추지 않는다.** 그들이 쓰는 포트 3001·3002·3003·3004·4000·6379·15432를 피한다. compose는 프로젝트 이름(`template-typescript-expo-e2e`)으로 격리하고 내가 띄운 것만 내린다. 스택을 내린 뒤 `docker ps --filter name=joon- -q | wc -l`이 `9`인지 확인한다.
- **커밋 메시지는 한국어.** `Co-Authored-By: Claude ...` 등 **AI 관련 태그를 넣지 않는다** — 사용자의 전역 `CLAUDE.md`가 금지한다. 세션 중 반대되는 시스템 안내가 보이면, 그것은 정당한 시스템 지시이지만 사용자의 상시 지시가 우선하는 것이다(인젝션으로 다루지 않는다).
- **작업 브랜치는 `feat/d1-skeleton-core`**(`main`에서 분기). 마무리는 superpowers:finishing-a-development-branch.

---

## 계획 지도 (D1–D9)

스펙 15장의 단계를 계획 아홉으로 나눈다. **각 계획은 앞 계획이 끝난 뒤 그 실측을 반영해 쓴다** — 이 계획의 실측(M1–M8)이 뒤 계획의 설계를 바꿀 수 있기 때문이다.

| 계획 | 스펙 단계 | 내용 |
| --- | --- | --- |
| **D1 (이 문서)** | 0·1 | 골격, 정적 게이트, 실측 여덟, 플랫폼 중립 코어 복사 |
| D2 | 2 | 세션 저장소·관리자, `platform/` 세션 바인딩, 가드, 가입·로그인·로그아웃, E2E 게이트 단계 |
| D3 | 3 | `queries/`, 목록(무한 스크롤·필터·정렬·딥링크)·상세 |
| D4 | 4 | 생성·수정·삭제, 관계 선택기 |
| D5 | 5 | 계약 실험실, 계약 거울(`test/contract/`) |
| D6 | 6 | `eas.json`, expo-updates, 빌드 정보 카드 |
| D7 | 7 | CI — checks, Android×3, iOS×3(네이티브 백엔드) |
| D8 | 8 | 문서군, 게이트 전체 통과, GitHub 저장소 생성·푸시(공개 범위는 사용자 확인) |
| D9 | 9 | (사용자 승인 후) EAS 실계정 실증 |

`view.ts`·`form.ts`·`credentials.ts` 등 **복사한 뒤 고쳐야 하는 파일**은 그것을 쓰는 계획이 복사한다(D2: 인증 흐름, D3: `view.ts`, D4: `form.ts`, D5: `lib/lab/`). 쓰지 않는 코드를 미리 들이지 않는다.

---

## 이 계획이 근거로 삼은 측정 (2026-09-30)

추측이 아니라 그날 직접 확인한 사실이다. 구현자는 이것을 전제로 삼는다.

**Expo SDK 57** (`expo@57.0.26`의 `bundledNativeModules.json`): `react` 19.2.3, `react-native` 0.86.3, `expo-router` ~57.0.24, `react-native-reanimated` 4.5.1, `react-native-worklets` 0.10.1, `react-native-safe-area-context` ~5.7.0, `react-native-screens` ~4.26.0, `react-native-gesture-handler` ~2.32.0, `react-native-svg` 15.15.4, `expo-secure-store` ~57.0.4, `expo-localization` ~57.0.2, `expo-constants` ~57.0.20, `expo-linking` ~57.0.11, `expo-splash-screen` ~57.0.9, `expo-status-bar` ~57.0.1, `expo-build-properties` ~57.0.22.

**`expo-template-blank-typescript@57.0.28`의 자산**: `assets/icon.png`, `splash-icon.png`, `android-icon-background.png`, `android-icon-foreground.png`, `android-icon-monochrome.png`, `favicon.png`. `expo-template-default@57.0.28`은 `ThemeProvider`·`DarkTheme`·`DefaultTheme`를 `expo-router`에서 import하고 `experiments.reactCompiler: true`를 켠다.

**React Native Reusables의 `minimal-uniwind` 템플릿**(SDK 56 기준): `.npmrc`에 `node-linker=hoisted`, `metro.config.js`는 `withUniwindConfig(getDefaultConfig(__dirname), { cssEntryFile: './global.css', dtsFile: './uniwind-types.d.ts' })`, `global.css`는 `@import "tailwindcss"; @import "uniwind"; @import "tw-animate-css";` 뒤에 `@layer theme { :root { @variant light {…} @variant dark {…} } }`로 색 토큰을 둔다. 그 템플릿의 `lib/theme.ts`는 `expo-router/react-navigation`을 import한다 — 이 저장소에서는 `lib/`에 둘 수 없어 `platform/theme.ts`로 간다. CLI는 `--styling-library uniwind`를 받는다.

**ESLint는 9를 쓴다**(형제 저장소는 10): `eslint-config-expo@57.0.2`가 의존하는 `eslint-plugin-react` 7.37(peer `eslint ^9.7`까지)과 `eslint-plugin-import` 2.x(peer `^9`까지)가 ESLint 10을 지원하지 않는다. 그리고 `eslint-config-expo/flat` 뒤에 `typescript-eslint`의 설정을 그대로 얹으면 **`Cannot redefine plugin "@typescript-eslint"`로 ESLint가 죽는다**(격리 폴더에서 실측). 규칙 객체만 합치면(`tseslint.configs.recommendedTypeChecked`의 `rules` 73개) 플러그인 중복 없이 타입 인식 규칙과 `lib/` 경계 규칙이 함께 걸린다(같은 실측).

**RN의 fetch는 `cache: 'no-store'`를 URL로 바꾼다**: `react-native@0.86.3`의 `Libraries/Network/fetch.js`는 `require('whatwg-fetch')`이고(의존성 `^3.0.0` → 3.6.20), whatwg-fetch 3.6.20의 `Request`는 `cache`가 `no-store`·`no-cache`인 GET·HEAD의 URL 끝에 `_=<시각>`을 덧붙인다(`fetch.js:398-407`). JSON:API 요청 URL을 바꾸면 안 되므로 복사한 `client.ts`에서 그 옵션을 뺀다(Task 6).

**`app.config.ts` 로더**: `@expo/config@57.0.9`의 `evalConfig`는 `@expo/require-utils@57.0.5`의 `loadModuleSync`로 설정 파일 **하나만** TypeScript 컴파일러로 변환해 실행한다. 그 안의 import는 Node의 일반 모듈 해석을 탄다 — 그래서 `./lib/config/settings.ts`를 **확장자를 붙여** import하면 Node 24의 타입 제거로 불러올 가능성이 높지만 확정은 아니다(M7).

**Rails는 Host 헤더를 검사한다**: 원본 `docker-compose.e2e.yml`의 `api-rails`는 `ALLOWED_HOSTS: 'api:4000,127.0.0.1:${E2E_API_PORT:-4100}'`이고, 목록에 없는 Host는 `403 Blocked hosts`다(원본 저장소의 실측 주석). Android 에뮬레이터의 앱은 `Host: 10.0.2.2:4100`으로 요청하므로 이 값을 더해야 한다(Task 7).

**Maestro**: 최신 CLI는 `cli-2.11.0`(2026-09-29), 자산은 `maestro.zip`(314,886,578 바이트)과 `checksums_sha256.txt`. `maestro test --device-locale <로캘>`로 실행 단위의 기기 로캘을 바꾸고, `launchApp`은 `clearState`·`arguments`를 받는다(공식 문서).

**typed routes**: 타입은 dev 서버가 켜질 때 생성되고, dev 서버 없이 만들려면 `npx expo customize tsconfig.json`을 부른다(공식 문서).

**pnpm 11**: 의존성의 빌드 스크립트는 `pnpm-workspace.yaml`의 `allowBuilds`에 허용 여부를 적어야 한다 — 형제 NestJS 저장소가 그렇게 한다.

**개발 머신**: Node 24.19.0, pnpm 11.22.0, OpenJDK 17.0.20(`JAVA_HOME` 설정됨), Android SDK(`ANDROID_HOME=<home>\AppData\Local\Android\Sdk`, platforms `android-36`·`android-37.0`, build-tools 35·36, NDK 27.1·28.2, CMake 3.22.1, AVD `Pixel_9_API_36`), Docker 29.7.2, Windows `LongPathsEnabled=1`. Maestro는 없다. iOS 시뮬레이터는 돌 수 없다.

**원본 저장소**: `../template-typescript-nextjs`의 로컬 `main`과 GitHub `main`이 모두 `34d0b1057d65693645e75bec4e9558dcf6838822`다. 세 백엔드 저장소는 모두 공개다(`gh repo view`).

---

## 실측 여덟 가지 (M1–M8)

스펙 15장의 여섯(M1–M6)에, 이 계획을 쓰며 드러난 둘(M7·M8)을 더했다. 결과는 전부 `docs/superpowers/notes/2026-09-30-d1-measurements.md`에 **명령과 출력 그대로** 적는다.

| # | 질문 | 태스크 | 결과가 아니오일 때 |
| --- | --- | --- | --- |
| M1 | Uniwind + React Native Reusables가 SDK 57 Android Release 빌드에서 렌더되는가 | 4 | 멈추고 사용자에게 보고한다 — 스타일 스택은 스펙 결정이라 혼자 바꾸지 않는다 |
| M2 | Expo Router가 대괄호 키를 딥링크와 `router.setParams`에서 보존하는가 | 8 | 기록만 한다. 인코딩 규칙은 D3이 `lib/resources`에 정한다 |
| M3 | Maestro로 Android 기기 로캘을 바꿀 수 있는가 | 8 | 대안 둘을 순서대로 잰다(Task 8 Step 9) |
| M4 | `e2e` 변형 Release APK가 평문 HTTP로 `10.0.2.2:4100`에 닿는가 | 8 | 원인을 좁혀 기록하고 멈춘다 — E2E의 전제다 |
| M5 | pnpm 기본(isolated) 링커에서 Metro 번들과 expo-doctor가 도는가 | 1 | `node-linker=hoisted`로 바꾼다 |
| M6 | RN fetch에서 `AbortController` 타임아웃이 요청을 실제로 끊는가 | 8 | 기록하고 멈춘다 — 스펙 8.5의 전제다 |
| M7 | `app.config.ts`가 `./lib/config/*.ts`를 확장자 포함 import로 쓸 수 있는가 | 3 | Task 3 Step 12의 대체 경로 |
| M8 | Maestro CLI가 Windows Git Bash에서 도는가 | 8 | `maestro.bat`을 `cmd //c`로 부르는 경로를 잰다 |

iOS 쪽(M1·M2·M3의 iOS 절반)은 이 머신에서 잴 수 없다 — D7(CI)이 잰다. 기록 파일에도 그렇게 적는다.

---

## File Structure

이 계획이 만드는 것:

```text
.gitattributes · .gitignore · .npmrc · pnpm-workspace.yaml(필요할 때)
package.json · pnpm-lock.yaml · tsconfig.json
app.config.ts · .env.example
metro.config.js · global.css · uniwind-types.d.ts · components.json
eslint.config.js · .prettierrc · .prettierignore · .secretlintrc.json · vitest.config.ts
AGENTS.md · CLAUDE.md
assets/                         blank-typescript 템플릿의 아이콘·스플래시
app/_layout.tsx                 루트 — 전역 CSS, 테마, 시작 설정 검증, PortalHost
app/(app)/index.tsx             홈
components/ui/                  React Native Reusables — text · button · icon
components/app/fatal-config.tsx 설정 오류 화면
platform/theme.ts               내비게이션 테마
platform/config.ts              설정 자리를 extra로 돌리고 시작 시 검증
lib/utils.ts                    cn (React Native Reusables)
lib/config/settings.ts          (복사·수정)
lib/config/app-variant.ts       변형 규칙 (신규)
lib/jsonapi/*.ts                (복사, client.ts는 수정)
lib/jsonapi/AGENTS.md · lib/resources/AGENTS.md
lib/resources/*.ts              (복사)
lib/auth/tokens.ts              (복사)
test/fixtures/documents.ts      (복사)
test/unit/**                    (복사한 테스트 + 신규 테스트)
test/e2e/android.sh             Android 기기 도우미
test/e2e/seed/                  (복사) SQL 시드
docker-compose.e2e.yml          (복사·수정)
scripts/check.sh · scripts/check-citations.sh · scripts/check-provenance.mjs
docs/provenance/copied-core.json
docs/superpowers/notes/2026-09-30-d1-measurements.md
```

`app/(lab)/probe.tsx`와 `test/e2e/measure/*.yaml`은 Task 8의 실측 전용이다 — 한 커밋으로 남긴 뒤 다음 커밋에서 지운다(실측을 재현할 수 있게 이력에 남긴다).

---

### Task 1: Expo 골격과 pnpm 링커 실측 (M5)

**Files:**
- Create: `.gitattributes`, `.gitignore`, `.npmrc`, `package.json`, `tsconfig.json`, `app.config.ts`, `app/_layout.tsx`, `app/(app)/index.tsx`, `assets/*.png`, `docs/superpowers/notes/2026-09-30-d1-measurements.md`
- Generated: `pnpm-lock.yaml` (커밋), `.expo/`·`expo-env.d.ts`·`dist/` (무시)

**Interfaces:**
- Produces: 앱 진입점 `expo-router/entry`, 경로 별칭 `@/*` → 저장소 루트, 스크립트 `typecheck`·`types:routes`

- [ ] **Step 1: 작업 브랜치를 만든다**

```bash
cd "<저장소 루트>"
git switch -c feat/d1-skeleton-core
```

- [ ] **Step 2: 줄바꿈 규칙을 고정한다**

`.gitattributes`:

```text
* text=auto eol=lf
```

```bash
git add .gitattributes && git add --renormalize . && git status --short
```

Expected: `.gitattributes`가 추가되고, 스펙 파일이 renormalize 대상이면 함께 보인다.

- [ ] **Step 3: `.gitignore`를 쓴다**

```text
# dependencies
node_modules/

# Expo
.expo/
dist/
web-build/
expo-env.d.ts

# Native — expo prebuild 가 만든다(스펙 10.4 CNG). 커밋하지 않는다.
/ios
/android
.kotlin/
*.orig.*
*.jks
*.p8
*.p12
*.key
*.mobileprovision

# Metro
.metro-health-check*

# debug
npm-debug.*

# macOS
.DS_Store
*.pem

# env — 값은 .env.example 에만 적는다(스펙 10.1)
.env
.env*.local

# typescript
*.tsbuildinfo

# test artifacts
coverage/
.maestro-output/
```

- [ ] **Step 4: `.npmrc`를 쓴다 — M5의 출발점은 pnpm 기본(isolated) 링커다**

```text
engine-strict=true
```

- [ ] **Step 5: `package.json`을 쓴다**

```json
{
  "name": "template-typescript-expo",
  "version": "0.1.0",
  "private": true,
  "license": "MIT",
  "main": "expo-router/entry",
  "engines": {
    "node": ">=24.11.0"
  },
  "packageManager": "pnpm@11.22.0",
  "scripts": {
    "start": "expo start",
    "types:routes": "expo customize tsconfig.json",
    "typecheck": "tsc --noEmit -p tsconfig.json"
  }
}
```

- [ ] **Step 6: 런타임 의존성을 설치한다**

```bash
pnpm add expo@~57.0.26 react@19.2.3 react-native@0.86.3
pnpm exec expo install expo-router expo-linking expo-constants expo-status-bar expo-splash-screen react-native-safe-area-context react-native-screens
pnpm add -D typescript@~6.0.3 @types/react@~19.2.2
```

pnpm이 승인되지 않은 빌드 스크립트를 보고하면(설치가 멈추거나 "Ignored build scripts" 목록을 낸다), 보고된 패키지마다 `pnpm-workspace.yaml`에 적는다 — 기본은 `false`다. 이후 단계(번들·네이티브 빌드)가 그 패키지 때문에 실패할 때만 `true`로 바꾸고 이유를 주석으로 남긴다.

```yaml
# 의존성의 설치 스크립트 허용 여부(pnpm 11). 기본은 실행하지 않는다 - 번들이나
# 네이티브 빌드가 그 스크립트 없이는 실패하는 것이 확인된 패키지만 true 로 두고
# 그 이유를 옆에 적는다(형제 template-typescript-nestjs 와 같은 방식).
allowBuilds:
  <보고된-패키지>: false
```

다시 `pnpm install`이 경고 없이 끝나는지 본다.

- [ ] **Step 7: `tsconfig.json`을 쓴다**

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"]
}
```

`exclude`를 적지 않는다 — 적으면 `expo/tsconfig.base`의 `exclude`(`node_modules`·`android`·`ios`·`metro.config.js` 등)를 통째로 덮어쓴다.

- [ ] **Step 8: 최소 `app.config.ts`를 쓴다 (Task 3이 변형·검증으로 바꾼다)**

```ts
import type { ConfigContext, ExpoConfig } from 'expo/config'

export default function appConfig({ config }: ConfigContext): ExpoConfig {
  return {
    ...config,
    name: 'Template Expo',
    slug: 'template-typescript-expo',
    version: '0.1.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    scheme: 'templateexpo',
    userInterfaceStyle: 'automatic',
    ios: { supportsTablet: true, bundleIdentifier: 'com.example.templateexpo' },
    android: {
      package: 'com.example.templateexpo',
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
    },
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        { backgroundColor: '#E6F4FE', image: './assets/splash-icon.png', imageWidth: 76 },
      ],
    ],
    experiments: { typedRoutes: true, reactCompiler: true },
  }
}
```

- [ ] **Step 9: 라우트 두 개를 쓴다**

`app/_layout.tsx`:

```tsx
import { Stack } from 'expo-router'

export default function RootLayout() {
  return <Stack />
}
```

`app/(app)/index.tsx`:

```tsx
import { Text, View } from 'react-native'

export default function HomeScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>template-typescript-expo</Text>
    </View>
  )
}
```

- [ ] **Step 10: 템플릿 자산을 복사한다**

```bash
TMP=$(mktemp -d)
npm pack expo-template-blank-typescript@57.0.28 --pack-destination "$TMP" >/dev/null
tar -xzf "$TMP/expo-template-blank-typescript-57.0.28.tgz" -C "$TMP"
mkdir -p assets
for f in icon splash-icon android-icon-background android-icon-foreground android-icon-monochrome; do
  cp "$TMP/package/assets/$f.png" "assets/$f.png"
done
ls assets
```

Expected: 다섯 PNG. `favicon.png`는 웹을 대상으로 하지 않으므로 복사하지 않는다(스펙 1.2).

- [ ] **Step 11: 라우트 타입을 만들고 typecheck를 돌린다**

```bash
pnpm types:routes
git diff --stat -- tsconfig.json
pnpm typecheck
```

Expected: `pnpm typecheck` 통과, `.expo/types/`와 `expo-env.d.ts`가 생긴다. `types:routes`가 `tsconfig.json`을 고쳤다면 그 결과를 받아들이되, `strict`·`noUncheckedIndexedAccess`·`exactOptionalPropertyTypes`·`paths`가 남아 있는지 확인한다. 명령이 대화형 입력을 요구해 멈추면 그 출력을 M5 절에 적고, 대신 `pnpm exec expo start --offline`을 한 번 띄웠다가 `.expo/types/router.d.ts`가 생긴 뒤 끄는 방법을 쓰고 그 사실을 기록한다.

- [ ] **Step 12: M5를 잰다 — isolated 링커에서 번들과 expo-doctor**

```bash
pnpm exec expo export --platform android --platform ios --output-dir dist 2>&1 | tail -20; echo "export exit=${PIPESTATUS[0]}"
pnpm dlx expo-doctor@1.20.4 2>&1 | tail -30; echo "doctor exit=${PIPESTATUS[0]}"
```

- 둘 다 `exit=0`이면 isolated를 유지한다.
- 모듈 해석 실패("Unable to resolve module", 중복 `react` 경고, doctor의 의존성 트리 오류)가 나면 `.npmrc`에 `node-linker=hoisted`를 더하고 `rm -rf node_modules && pnpm install` 뒤 두 명령을 다시 돌린다.
- 어느 경우든 두 실행의 마지막 출력을 그대로 기록한다. 네이티브 빌드(Task 4)가 링커 때문에 실패하면 그때 이 판정을 다시 연다.

- [ ] **Step 13: 실측 기록 파일을 만든다**

`docs/superpowers/notes/2026-09-30-d1-measurements.md`:

```markdown
# D1 실측 기록 (2026-09-30)

스펙 15장 "0단계에서 먼저 실측할 것"과 D1 계획이 더한 둘(M7·M8)의 결과다. 각 절은
**무엇을 했고(명령) 무엇이 나왔는가(출력)**를 사실로 적고, 그 결과로 정한 것을 따로 적는다.
결과가 스펙과 어긋나면 스펙에 날짜가 붙은 정정을 더한다.

| # | 질문 | 결과 | 정한 것 |
| --- | --- | --- | --- |
| M1 | Uniwind + React Native Reusables가 SDK 57 Android Release 빌드에서 렌더되는가 | | |
| M2 | Expo Router가 대괄호 키를 딥링크·`router.setParams`에서 보존하는가 | | |
| M3 | Maestro로 Android 기기 로캘을 바꿀 수 있는가 | | |
| M4 | `e2e` 변형 Release APK가 평문 HTTP로 `10.0.2.2:4100`에 닿는가 | | |
| M5 | pnpm 기본(isolated) 링커에서 Metro 번들과 expo-doctor가 도는가 | | |
| M6 | RN fetch에서 `AbortController` 타임아웃이 요청을 실제로 끊는가 | | |
| M7 | `app.config.ts`가 `./lib/config/*.ts`를 확장자 포함 import로 쓸 수 있는가 | | |
| M8 | Maestro CLI가 Windows Git Bash에서 도는가 | | |

iOS 쪽(M1·M2·M3의 iOS 절반)은 개발 머신이 Windows라 여기서 잴 수 없다. CI 계획이 잰다.

## M5 — pnpm 링커

(Step 12의 명령과 출력, 그리고 정한 링커)
```

표의 M5 행과 `## M5` 절을 Step 12의 결과로 채운다. 나머지 행은 해당 태스크가 채운다.

- [ ] **Step 14: 커밋한다**

```bash
git add -A
git status --short
git commit -m "chore: Expo SDK 57 골격을 세우고 pnpm 링커를 실측한다"
```

Expected: `node_modules/`·`dist/`·`.expo/`·`expo-env.d.ts`가 스테이징되지 않았다.

---

### Task 2: 품질 도구와 `lib/` 경계

**Files:**
- Create: `eslint.config.js`, `.prettierrc`, `.prettierignore`, `.secretlintrc.json`, `vitest.config.ts`, `test/unit/lint/lib-boundary.test.ts`, `AGENTS.md`, `CLAUDE.md`
- Modify: `package.json` (scripts, devDependencies)

**Interfaces:**
- Consumes: Task 1의 `tsconfig.json`·별칭 `@/*`
- Produces: 스크립트 `lint`·`format`·`format:check`·`secretlint`·`test`, ESLint의 `lib/` 경계 규칙, vitest 설정(환경 node, `TZ=Asia/Seoul`, 별칭 `@`)

- [ ] **Step 1: 개발 의존성을 설치한다**

```bash
pnpm add -D eslint@9.39.5 eslint-config-expo@~57.0.2 typescript-eslint@8.68.0 eslint-config-prettier@10.1.8 prettier@3.9.6 secretlint@13.0.5 @secretlint/secretlint-rule-preset-recommend@13.0.5 vitest@5.0.2 @types/node@24.13.3
```

- [ ] **Step 2: vitest 설정을 쓴다**

`vitest.config.ts`:

```ts
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/unit/**/*.test.ts'],
    /*
     * 러너의 타임존을 UTC 가 아닌 값으로 고정한다. 표시 타임존을 UTC 로 고정하는
     * 코드를 지키는 테스트가 러너 UTC(CI 의 ubuntu)에서는 아무것도 재지 못한다 -
     * "UTC 로 그린다" 와 "러너의 로컬 시각으로 그린다" 가 같은 세계가 되기 때문이다.
     * 원본 template-typescript-nextjs 의 vitest.config.ts 와 같은 판단이다.
     */
    env: { TZ: 'Asia/Seoul' },
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
})
```

- [ ] **Step 3: 경계 규칙을 재는 테스트를 먼저 쓴다**

`test/unit/lint/lib-boundary.test.ts`:

```ts
import { ESLint, Linter } from 'eslint'
import { describe, expect, it } from 'vitest'

/**
 * lib/ 경계 규칙(스펙 5장)을 잰다.
 *
 * 축이 둘이다. (1) eslint.config.js 가 lib/ 파일에 no-restricted-imports 를 오류로
 * 거는가 - calculateConfigForFile 로 해석된 설정을 본다. (2) 그렇게 걸린 규칙이
 * 실제로 무엇을 막고 무엇을 통과시키는가 - 해석된 규칙 항목만 떼어 core Linter 로
 * 돌린다. 전체 설정으로 가상 파일을 lint 하면 타입 인식 규칙의 projectService 가
 * "프로젝트에 없는 파일"로 죽으므로 두 축을 나눈다.
 */
const eslint = new ESLint()

async function restrictionFor(filePath: string): Promise<Linter.RuleEntry | undefined> {
  const config = (await eslint.calculateConfigForFile(filePath)) as Linter.Config
  return config.rules?.['no-restricted-imports']
}

function severityOf(entry: Linter.RuleEntry | undefined): number {
  const level = Array.isArray(entry) ? entry[0] : entry
  if (level === 'error' || level === 2) return 2
  if (level === 'warn' || level === 1) return 1
  return 0
}

function messagesFor(entry: Linter.RuleEntry, source: string): Linter.LintMessage[] {
  const linter = new Linter({ configType: 'flat' })
  return linter.verify(
    source,
    [
      {
        languageOptions: { sourceType: 'module', ecmaVersion: 'latest' },
        rules: { 'no-restricted-imports': entry },
      },
    ],
    'lib/boundary-probe.js',
  )
}

async function libRule(): Promise<Linter.RuleEntry> {
  const entry = await restrictionFor('lib/boundary-probe.ts')
  if (entry === undefined) throw new Error('lib/ 파일에 no-restricted-imports 가 걸려 있지 않다')
  return entry
}

const FORBIDDEN = [
  'react',
  'react-native',
  'react-native-reanimated',
  'expo',
  'expo-secure-store',
  'expo-router',
  '@expo/config',
  '@react-native-community/netinfo',
  '@rn-primitives/portal',
  '@tanstack/react-query',
  'uniwind',
  'lucide-react-native',
]

const ALLOWED = ['@/lib/jsonapi/query', './define', 'clsx', 'tailwind-merge']

describe('lib/ 경계 - 스펙 5장', () => {
  it('lib/ 파일에는 no-restricted-imports 가 오류로 걸린다', async () => {
    expect(severityOf(await restrictionFor('lib/boundary-probe.ts'))).toBe(2)
  })

  it.each(FORBIDDEN)('lib/ 에서 %s 를 import 하면 막힌다', async (moduleName) => {
    const messages = messagesFor(await libRule(), `import probe from '${moduleName}'\nexport default probe\n`)
    expect(messages.map((message) => message.ruleId)).toEqual(['no-restricted-imports'])
  })

  it.each(ALLOWED)('lib/ 에서 %s 는 허용된다', async (moduleName) => {
    const messages = messagesFor(await libRule(), `import probe from '${moduleName}'\nexport default probe\n`)
    expect(messages).toEqual([])
  })

  it('lib/ 밖(platform/)에는 걸리지 않는다', async () => {
    expect(severityOf(await restrictionFor('platform/boundary-probe.ts'))).toBe(0)
  })
})
```

- [ ] **Step 4: 테스트가 실패하는지 본다**

`package.json`의 `scripts`에 `"test": "vitest run"`을 더하고:

```bash
pnpm test -- test/unit/lint/lib-boundary.test.ts
```

Expected: FAIL — `eslint.config.js`가 아직 없어 설정을 찾지 못하거나, 규칙이 없어 첫 테스트가 `expected 0 to be 2`로 실패한다.

- [ ] **Step 5: ESLint 설정을 쓴다**

`eslint.config.js`:

```js
// @ts-check
/**
 * ESLint 9 다 - 형제 저장소(ESLint 10)와 다르다. eslint-config-expo 57 이 의존하는
 * eslint-plugin-react 7.37 과 eslint-plugin-import 2.x 의 peer 가 ESLint 9 까지다
 * (2026-09-30 측정).
 *
 * typescript-eslint 에서는 **규칙만** 가져온다. 그 설정 배열의 base 항목은
 * `@typescript-eslint` 플러그인을 다시 등록하는데, eslint-config-expo 가 이미 다른
 * 인스턴스로 등록해 두어 `Cannot redefine plugin "@typescript-eslint"` 로 ESLint 가
 * 죽는다(격리 폴더에서 실측). 규칙 이름은 eslint-config-expo 가 등록한 같은 이름의
 * 플러그인이 제공하므로 규칙 객체만 합치면 된다.
 */
const { defineConfig } = require('eslint/config')
const expoConfig = require('eslint-config-expo/flat')
const prettier = require('eslint-config-prettier')
const tseslint = require('typescript-eslint')

const typeCheckedRules = Object.assign(
  {},
  ...tseslint.configs.recommendedTypeChecked.map((config) => config.rules ?? {}),
)

/**
 * lib/ 가 import 하면 안 되는 모듈(스펙 5장). lib/ 가 node 의 vitest 에서 그대로
 * 돌아야 template-typescript-nextjs 에서 복사한 테스트가 유효하다.
 * test/unit/lint/lib-boundary.test.ts 가 이 목록을 잰다.
 */
const PLATFORM_MODULE_PATTERNS = [
  'react',
  'react/*',
  'react-native',
  'react-native/*',
  'react-native-*',
  'expo',
  'expo/*',
  'expo-*',
  '@expo/*',
  '@react-native/*',
  '@react-native-community/*',
  '@rn-primitives/*',
  '@tanstack/*',
  'uniwind',
  'lucide-react-native',
]

module.exports = defineConfig([
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      '.expo/**',
      'android/**',
      'ios/**',
      'coverage/**',
      'expo-env.d.ts',
      'uniwind-types.d.ts',
    ],
  },
  expoConfig,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: __dirname },
    },
    rules: typeCheckedRules,
  },
  {
    files: ['lib/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: PLATFORM_MODULE_PATTERNS,
              message:
                'lib/ 는 순수 TypeScript 다(스펙 5장). 네이티브·React 모듈은 platform/ 이나 queries/ 에서 쓴다.',
            },
          ],
        },
      ],
    },
  },
  prettier,
])
```

- [ ] **Step 6: 테스트가 통과하는지 본다**

```bash
pnpm test -- test/unit/lint/lib-boundary.test.ts
```

Expected: PASS — 18개(첫 테스트 1 + 막힘 12 + 허용 4 + platform 1).

- [ ] **Step 7: Prettier·secretlint 설정을 쓴다 (원본과 같은 값)**

`.prettierrc`:

```json
{ "semi": false, "singleQuote": true, "printWidth": 100, "trailingComma": "all" }
```

`.prettierignore`:

```text
node_modules
pnpm-lock.yaml
dist
.expo
android
ios
coverage
expo-env.d.ts
uniwind-types.d.ts

# 계획/스펙 산문 문서. 임베드된 JSON·표 예시는 저자가 의도적으로 압축한
# 서식이라 prettier의 표준 서식으로 재작성하면 안 된다.
docs/
```

`.secretlintrc.json`:

```json
{
  "rules": [
    {
      "id": "@secretlint/secretlint-rule-preset-recommend"
    }
  ]
}
```

- [ ] **Step 8: 스크립트를 더한다**

`package.json`의 `scripts`를 다음으로 만든다:

```json
{
  "start": "expo start",
  "types:routes": "expo customize tsconfig.json",
  "typecheck": "tsc --noEmit -p tsconfig.json",
  "lint": "eslint .",
  "format": "prettier --write .",
  "format:check": "prettier --check .",
  "secretlint": "secretlint --secretlintignore .gitignore \"**/*\"",
  "test": "vitest run"
}
```

- [ ] **Step 9: 루트 `AGENTS.md`와 `CLAUDE.md`를 쓴다**

`CLAUDE.md`:

```text
@AGENTS.md
```

`AGENTS.md`:

````markdown
# TypeScript Expo Template 작업 지침

세 백엔드 템플릿(FastAPI·NestJS·Rails)이 공유하는 JSON:API 1.1 계약을 Android·iOS
앱으로 소비하는 템플릿이다. 설계의 정본은
`docs/superpowers/specs/2026-09-30-expo-jsonapi-template-design.md`이고, 이 파일은 그
설계가 정한 **계층 계약의 운용 정본**이다.

## 계층 소유권 (스펙 5장)

**아래 표는 소유 관계이지 파일 목록이 아니다.** 어떤 위치가 아직 비어 있어도 그 행의
계약은 이미 유효하다 - 그 위치에 처음 파일을 만드는 사람이 지켜야 할 규칙이다.

| 위치 | 소유하는 것 | 소유하지 않는 것 |
| --- | --- | --- |
| `lib/jsonapi/` | 문서 파싱, `included` 정규화, 쿼리 직렬화, 오류 분류, HTTP 협상 | 자원별 지식, 화면, 네이티브 모듈 |
| `lib/resources/` | 자원 선언, 목록·상세·폼 판단 | JSX, fetch, 네이티브 모듈 |
| `lib/auth/` | 세션 모델과 직렬화, 만료 판정, 회전 결정, 자격증명 문서, 보호 경로 목록 | 저장 매체, 화면 이동 |
| `lib/lab/` | 실험 정의, 결과 표현 | 화면, 세션 |
| `platform/` | Expo 모듈 호출, React Provider, API 클라이언트 조립 | 판단 |
| `queries/` | 캐시 키, 조회·쓰기 훅, 쓰기 후 무효화 | JSX, 쿼리 문자열 조립 |
| `app/` | 화면, 라우팅, 가드 배치 | fetch, `request()` 호출, 쿼리 문자열 조립 |
| `components/resource/` | 선언을 읽어 만드는 획일 UI | 자원 이름으로 분기 |

위반의 정의:

- `lib/**`에서 `react`·`react-native`·`expo`·`expo-*`·`@expo/*`·`@react-native*` 등
  플랫폼 모듈을 import하면 위반이다. ESLint가 막고 `test/unit/lint/lib-boundary.test.ts`가
  그 규칙을 잰다. `lib/`가 node의 vitest에서 그대로 돌아야 복사한 테스트가 유효하다.
- `lib/jsonapi/`에 이 저장소의 실제 자원 이름 문자열이 코드로 나타나면 위반이다.
- `lib/resources/*.ts`에 JSX가 있으면 위반이다.
- `app/`에서 `fetch`나 `request()`를 직접 부르면 위반이다. 화면은 `queries/`의 훅만 쓴다.
- `queries/`에 JSX가 있거나 쿼리 문자열을 조립하면 위반이다.
- `components/resource/*`에 자원 이름으로 분기하는 코드가 있으면 위반이다.
- `platform/`에 분기 판단이 자라면 위반이다. 판단은 `lib/`로 옮긴다.

`lib/resources/index.ts`는 손으로 채우는 배열이다. **여기 없으면 그 자원은 존재하지 않는
것과 같다.** 자동 탐색(glob · 동적 `import`)을 쓰지 않는다.

## `app/`에는 라우트 파일만 둔다

Expo Router는 `app/` 아래의 모든 파일을 라우트로 취급한다. 판단 함수·타입·상수는
`lib/`의 해당 계층에 둔다.

## 로딩 표현

로딩 상태에 텍스트를 쓰지 않는다. 스켈레톤 또는 스피너만 쓴다(스펙 8.7).

## 사라질 자리를 인용하지 마라

코드·문서 주석에서 선행 점이 붙은 `.superpowers/`, 세션이 끝나면 사라지는 태스크 보고·
리뷰·브리프 파일, 스크래치패드를 가리키지 않는다. 모든 인용이 죽은 링크가 된다. 근거는
**사실 문장**으로 적고, 문서가 필요하면 커밋되는 `docs/superpowers/`를 가리킨다.

## 검증 명령

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm format:check
pnpm secretlint
pnpm test
```
````

(Task 9가 `## 검증 명령` 절을 게이트 하나로 바꾼다.)

- [ ] **Step 10: 네 검사를 돌린다**

```bash
pnpm format
pnpm lint
pnpm format:check
pnpm secretlint
pnpm typecheck
pnpm test
```

Expected: 전부 통과. `pnpm lint`가 기존 파일(`app.config.ts`·`app/`)에서 오류를 내면 그 파일을 고친다 — 규칙을 끄지 않는다.

- [ ] **Step 11: 커밋한다**

```bash
git add -A
git commit -m "chore: ESLint·Prettier·secretlint·vitest 와 lib 경계 규칙을 세운다"
```

---

### Task 3: 설정 계약 — `settings.ts` 복사, 변형 규칙, `app.config.ts` (M7)

**Files:**
- Create: `lib/config/settings.ts` (복사·수정), `test/unit/config/settings.test.ts` (복사·수정), `lib/config/app-variant.ts`, `test/unit/config/app-variant.test.ts`, `test/unit/config/app-config.test.ts`, `.env.example`, `docs/provenance/copied-core.json`
- Modify: `app.config.ts`, `tsconfig.json`, `docs/superpowers/notes/2026-09-30-d1-measurements.md`

**Interfaces:**
- Produces (`lib/config/settings.ts`):
  - `interface Settings { backendUrl: string }`
  - `type SettingsEnv = Record<string, string | undefined>`
  - `loadSettings(env?: SettingsEnv): Settings` — 누락 시 `BACKEND_URL is required`, 절대 http(s) URL이 아니면 `BACKEND_URL must be an absolute URL (got "…")`, 끝 슬래시 제거
  - `setSettingsSource(read: () => SettingsEnv): void` — 자리를 바꾸고 캐시를 비운다
  - `getSettings(): Settings` — 자리(기본 `process.env`)에서 한 번만 읽는다
- Produces (`lib/config/app-variant.ts`):
  - `APP_VARIANTS = ['development', 'preview', 'production', 'e2e'] as const`, `type AppVariant`
  - `DEFAULT_APP_VARIANT: AppVariant = 'development'`
  - `interface VariantProfile { idSuffix: string; schemeSuffix: string; nameSuffix: string; allowCleartext: boolean }`
  - `parseAppVariant(raw: string | undefined): AppVariant` — 잘못된 값은 `APP_VARIANT must be one of development, preview, production, e2e (got "…")`
  - `variantProfile(variant: AppVariant): VariantProfile`
  - `assertBackendUrlAllowed(backendUrl: string, variant: AppVariant): void` — 평문 불허 변형에서 https가 아니면 `BACKEND_URL must use https for the <변형> variant (got "…")`
- Produces (`app.config.ts`): 기본 내보내기 `appConfig(ctx: ConfigContext): ExpoConfig`, 이름 내보내기 `BASE_APP_ID = 'com.example.templateexpo'`, `BASE_SCHEME = 'templateexpo'`, `BASE_NAME = 'Template Expo'`; `extra: { backendUrl, appVariant }`

변형 표(스펙 10.2에 scheme 접미사를 더한 것 — 변형마다 scheme이 달라야 한 기기에 여러 변형을 설치했을 때 딥링크가 엉뚱한 변형으로 가지 않는다):

| 변형 | `idSuffix` | `schemeSuffix` | `nameSuffix` | `allowCleartext` |
| --- | --- | --- | --- | --- |
| `development` | `.dev` | `-dev` | ` (Dev)` | `true` |
| `preview` | `.preview` | `-preview` | ` (Preview)` | `false` |
| `production` | `` | `` | `` | `false` |
| `e2e` | `.e2e` | `-e2e` | ` (E2E)` | `true` |

- [ ] **Step 1: 원본 설정 테스트를 복사하고, RN에 맞게 고친 기대를 먼저 쓴다**

```bash
SRC=../template-typescript-nextjs
REV=34d0b1057d65693645e75bec4e9558dcf6838822
mkdir -p test/unit/config lib/config
git -C "$SRC" show "$REV:test/unit/config/settings.test.ts" > test/unit/config/settings.test.ts
```

`test/unit/config/settings.test.ts`에서 `SESSION_COOKIE_SECURE`를 다루는 테스트 셋(`'SESSION_COOKIE_SECURE의 기본값은 NODE_ENV === production 이다'`·`'SESSION_COOKIE_SECURE를 명시하면 NODE_ENV를 이긴다'`·`'SESSION_COOKIE_SECURE가 true/false가 아니면 거절한다'`)을 지우고, import 줄과 파일 끝을 다음으로 바꾼다.

import 줄:

```ts
import { afterEach, describe, expect, it } from 'vitest'
import { getSettings, loadSettings, setSettingsSource } from '@/lib/config/settings'
```

파일 끝에 더한다:

```ts
describe('setSettingsSource', () => {
  afterEach(() => {
    setSettingsSource(() => process.env)
  })

  it('지정한 자리에서 읽는다', () => {
    setSettingsSource(() => ({ BACKEND_URL: 'http://probe-source:9876/' }))
    expect(getSettings().backendUrl).toBe('http://probe-source:9876')
  })

  it('자리를 바꾸면 이전 값을 버린다', () => {
    setSettingsSource(() => ({ BACKEND_URL: 'http://probe-first:1111' }))
    expect(getSettings().backendUrl).toBe('http://probe-first:1111')
    setSettingsSource(() => ({ BACKEND_URL: 'http://probe-second:2222' }))
    expect(getSettings().backendUrl).toBe('http://probe-second:2222')
  })

  it('같은 자리에서는 한 번만 읽는다', () => {
    let reads = 0
    setSettingsSource(() => {
      reads += 1
      return { BACKEND_URL: 'http://probe-memo:3333' }
    })
    getSettings()
    getSettings()
    expect(reads).toBe(1)
  })

  it('자리가 값을 주지 않으면 변수 이름으로 실패한다', () => {
    setSettingsSource(() => ({}))
    expect(() => getSettings()).toThrowError(/BACKEND_URL is required/)
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

```bash
pnpm test -- test/unit/config/settings.test.ts
```

Expected: FAIL — `lib/config/settings.ts`가 없다.

- [ ] **Step 3: `settings.ts`를 쓴다 (원본을 복사해 두 곳을 바꾼 결과)**

`lib/config/settings.ts`:

```ts
/**
 * 환경변수 계약.
 *
 * 필수 변수에는 애플리케이션 코드상의 암묵적 기본값을 두지 않는다. 누락하면
 * 변수 이름이 담긴 오류와 함께 시작에 실패한다 - 첫 요청에서야 드러나는 설정
 * 오류보다 시작 실패가 낫다. 백엔드 템플릿들의 DATABASE_URL과 같은 계약이다.
 *
 * 선택 변수의 기본값은 정본 파일 · .env.example · README.md 의 환경 변수 표
 * **셋**에 같은 값으로 적는다. 거울이 셋이므로 하나를 고칠 때 나머지 둘을 함께
 * 고쳐야 한다.
 *
 * (template-typescript-expo) 이 파일은 두 자리에서 쓰인다. app.config.ts 가 빌드
 * 시점에 loadSettings 로 검증하고(스펙 10.1 - 없으면 그 명령이 멈춘다), 앱은 시작할
 * 때 platform/config.ts 가 setSettingsSource 로 자리를 app.config.ts 의 extra 로
 * 돌린 뒤 getSettings 로 다시 검증한다. 앱 런타임의 process.env 에는 BACKEND_URL 이
 * 없기 때문이다.
 */

export interface Settings {
  /** 백엔드 API의 절대 URL. 끝 슬래시 없음. */
  backendUrl: string
}

export type SettingsEnv = Record<string, string | undefined>

function requireAbsoluteUrl(raw: string | undefined, name: string): string {
  const value = (raw ?? '').trim()
  if (value === '') {
    throw new Error(`${name} is required`)
  }
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new Error(`${name} must be an absolute URL (got ${JSON.stringify(value)})`)
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`${name} must be an absolute URL (got ${JSON.stringify(value)})`)
  }
  return value.replace(/\/+$/, '')
}

export function loadSettings(env?: SettingsEnv): Settings {
  const processEnv = env ?? process.env
  return {
    backendUrl: requireAbsoluteUrl(processEnv.BACKEND_URL, 'BACKEND_URL'),
  }
}

let source: () => SettingsEnv = () => process.env
let cached: Settings | undefined

/**
 * 설정을 어디서 읽을지 바꾼다. 캐시를 비워 다음 getSettings() 가 새 자리에서 읽게
 * 한다. 앱은 시작할 때 한 번 부른다(platform/config.ts). 테스트는 기본 자리
 * (process.env)를 그대로 쓴다.
 */
export function setSettingsSource(read: () => SettingsEnv): void {
  source = read
  cached = undefined
}

/**
 * 자리에서 한 번만 로드한다.
 *
 * 메모이즈하는 이유는 성능이 아니라 일관성이다 - 한 실행 안에서 두 번 읽었을
 * 때 다른 값이 나오는 상황을 만들지 않는다.
 */
export function getSettings(): Settings {
  cached ??= loadSettings(source())
  return cached
}
```

- [ ] **Step 4: 통과를 확인한다**

```bash
pnpm test -- test/unit/config/settings.test.ts
```

Expected: PASS — 원본의 다섯 테스트 + 새 넷.

- [ ] **Step 5: 변형 규칙 테스트를 먼저 쓴다**

`test/unit/config/app-variant.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  APP_VARIANTS,
  DEFAULT_APP_VARIANT,
  assertBackendUrlAllowed,
  parseAppVariant,
  variantProfile,
} from '@/lib/config/app-variant'

describe('parseAppVariant', () => {
  it('값이 없으면 기본값 development 다', () => {
    expect(parseAppVariant(undefined)).toBe('development')
    expect(parseAppVariant('  ')).toBe('development')
    expect(DEFAULT_APP_VARIANT).toBe('development')
  })

  it.each(APP_VARIANTS)('%s 를 받는다', (variant) => {
    expect(parseAppVariant(` ${variant} `)).toBe(variant)
  })

  it('목록 밖의 값은 목록과 함께 거절한다', () => {
    expect(() => parseAppVariant('staging')).toThrowError(
      'APP_VARIANT must be one of development, preview, production, e2e (got "staging")',
    )
  })
})

describe('variantProfile', () => {
  it('변형마다 식별자·scheme·이름 접미사와 평문 허용이 정해져 있다', () => {
    expect(variantProfile('development')).toEqual({
      idSuffix: '.dev',
      schemeSuffix: '-dev',
      nameSuffix: ' (Dev)',
      allowCleartext: true,
    })
    expect(variantProfile('preview')).toEqual({
      idSuffix: '.preview',
      schemeSuffix: '-preview',
      nameSuffix: ' (Preview)',
      allowCleartext: false,
    })
    expect(variantProfile('production')).toEqual({
      idSuffix: '',
      schemeSuffix: '',
      nameSuffix: '',
      allowCleartext: false,
    })
    expect(variantProfile('e2e')).toEqual({
      idSuffix: '.e2e',
      schemeSuffix: '-e2e',
      nameSuffix: ' (E2E)',
      allowCleartext: true,
    })
  })

  it('접미사가 서로 겹치지 않는다 - 한 기기에 함께 설치할 수 있어야 한다', () => {
    const ids = APP_VARIANTS.map((variant) => variantProfile(variant).idSuffix)
    const schemes = APP_VARIANTS.map((variant) => variantProfile(variant).schemeSuffix)
    expect(new Set(ids).size).toBe(APP_VARIANTS.length)
    expect(new Set(schemes).size).toBe(APP_VARIANTS.length)
  })
})

describe('assertBackendUrlAllowed', () => {
  it.each(['preview', 'production'] as const)('%s 는 http 를 거절한다', (variant) => {
    expect(() => assertBackendUrlAllowed('http://probe-backend:4321', variant)).toThrowError(
      `BACKEND_URL must use https for the ${variant} variant (got "http://probe-backend:4321")`,
    )
  })

  it.each(['preview', 'production'] as const)('%s 는 https 를 받는다', (variant) => {
    expect(() => assertBackendUrlAllowed('https://probe-backend.example', variant)).not.toThrow()
  })

  it.each(['development', 'e2e'] as const)('%s 는 http 를 받는다', (variant) => {
    expect(() => assertBackendUrlAllowed('http://probe-backend:4321', variant)).not.toThrow()
  })
})
```

- [ ] **Step 6: 실패를 확인한다**

```bash
pnpm test -- test/unit/config/app-variant.test.ts
```

Expected: FAIL — 모듈이 없다.

- [ ] **Step 7: `app-variant.ts`를 쓴다**

`lib/config/app-variant.ts`:

```ts
/**
 * 빌드 변형 - 스펙 10.2.
 *
 * app.config.ts(빌드 시점, node)와 테스트가 함께 쓰는 순수 모듈이다. 네이티브 모듈을
 * import 하지 않는다(스펙 5장).
 */

export const APP_VARIANTS = ['development', 'preview', 'production', 'e2e'] as const
export type AppVariant = (typeof APP_VARIANTS)[number]

/** 선택 변수 APP_VARIANT 의 기본값. .env.example 과 README 표에 같은 값을 적는다. */
export const DEFAULT_APP_VARIANT: AppVariant = 'development'

export interface VariantProfile {
  /** 번들 ID·패키지 이름 접미사. 한 기기에 여러 변형을 함께 설치하게 한다. */
  readonly idSuffix: string
  /** 딥링크 scheme 접미사. 변형마다 달라야 딥링크가 엉뚱한 변형으로 가지 않는다. */
  readonly schemeSuffix: string
  /** 앱 이름 접미사. */
  readonly nameSuffix: string
  /** 평문 HTTP 허용 여부. development·e2e 만 허용한다. */
  readonly allowCleartext: boolean
}

const PROFILES: Readonly<Record<AppVariant, VariantProfile>> = {
  development: { idSuffix: '.dev', schemeSuffix: '-dev', nameSuffix: ' (Dev)', allowCleartext: true },
  preview: {
    idSuffix: '.preview',
    schemeSuffix: '-preview',
    nameSuffix: ' (Preview)',
    allowCleartext: false,
  },
  production: { idSuffix: '', schemeSuffix: '', nameSuffix: '', allowCleartext: false },
  e2e: { idSuffix: '.e2e', schemeSuffix: '-e2e', nameSuffix: ' (E2E)', allowCleartext: true },
}

function isAppVariant(value: string): value is AppVariant {
  return (APP_VARIANTS as readonly string[]).includes(value)
}

export function parseAppVariant(raw: string | undefined): AppVariant {
  if (raw === undefined || raw.trim() === '') return DEFAULT_APP_VARIANT
  const value = raw.trim()
  if (isAppVariant(value)) return value
  throw new Error(
    `APP_VARIANT must be one of ${APP_VARIANTS.join(', ')} (got ${JSON.stringify(raw)})`,
  )
}

export function variantProfile(variant: AppVariant): VariantProfile {
  return PROFILES[variant]
}

/**
 * 평문 HTTP 주소가 배포 빌드에 섞이지 않게 막는다(스펙 10.2).
 *
 * backendUrl 은 loadSettings 가 이미 절대 http(s) URL 로 검증한 값이다.
 */
export function assertBackendUrlAllowed(backendUrl: string, variant: AppVariant): void {
  if (variantProfile(variant).allowCleartext) return
  if (new URL(backendUrl).protocol !== 'https:') {
    throw new Error(
      `BACKEND_URL must use https for the ${variant} variant (got ${JSON.stringify(backendUrl)})`,
    )
  }
}
```

- [ ] **Step 8: 통과를 확인한다**

```bash
pnpm test -- test/unit/config/app-variant.test.ts
```

Expected: PASS.

- [ ] **Step 9: `app.config.ts` 테스트를 먼저 쓴다**

`test/unit/config/app-config.test.ts`:

```ts
import type { ConfigContext, ExpoConfig } from 'expo/config'
import { afterEach, describe, expect, it, vi } from 'vitest'
import appConfig, { BASE_APP_ID, BASE_NAME, BASE_SCHEME } from '@/app.config'

// 실전 주소(10.0.2.2:4100 · .env.example)를 쓰지 않는다 - 픽스처가 실전값과 같으면
// "설정에서 읽었다" 와 "박아 넣었다" 가 구별되지 않는다(원본 저장소의 관례).
const CONTEXT = { config: {}, projectRoot: '/probe' } as unknown as ConfigContext

function evaluate(env: Record<string, string>): ExpoConfig {
  vi.stubEnv('BACKEND_URL', env.BACKEND_URL ?? '')
  vi.stubEnv('APP_VARIANT', env.APP_VARIANT ?? '')
  return appConfig(CONTEXT)
}

function buildProperties(config: ExpoConfig): unknown {
  const entry = config.plugins?.find(
    (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-build-properties',
  )
  return Array.isArray(entry) ? entry[1] : undefined
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('app.config.ts - 스펙 10.1·10.2', () => {
  it('BACKEND_URL 이 없으면 설정 평가가 멈춘다', () => {
    expect(() => evaluate({})).toThrowError(/BACKEND_URL is required/)
  })

  it('production 변형은 http BACKEND_URL 을 거절한다', () => {
    expect(() =>
      evaluate({ BACKEND_URL: 'http://probe-backend:4321', APP_VARIANT: 'production' }),
    ).toThrowError(/must use https for the production variant/)
  })

  it('APP_VARIANT 가 없으면 development 다', () => {
    const config = evaluate({ BACKEND_URL: 'http://probe-backend:4321' })
    expect(config.android?.package).toBe(`${BASE_APP_ID}.dev`)
    expect(config.extra?.appVariant).toBe('development')
  })

  it('e2e 변형은 접미사를 붙이고 평문 HTTP 를 켠다', () => {
    const config = evaluate({ BACKEND_URL: 'http://probe-backend:4321/', APP_VARIANT: 'e2e' })
    expect(config.name).toBe(`${BASE_NAME} (E2E)`)
    expect(config.scheme).toBe(`${BASE_SCHEME}-e2e`)
    expect(config.android?.package).toBe(`${BASE_APP_ID}.e2e`)
    expect(config.ios?.bundleIdentifier).toBe(`${BASE_APP_ID}.e2e`)
    expect(buildProperties(config)).toEqual({ android: { usesCleartextTraffic: true } })
    expect(config.ios?.infoPlist?.NSAppTransportSecurity).toEqual({
      NSAllowsLocalNetworking: true,
    })
    expect(config.extra).toEqual({ backendUrl: 'http://probe-backend:4321', appVariant: 'e2e' })
  })

  it('production 변형은 접미사가 없고 평문 HTTP 를 끈다', () => {
    const config = evaluate({
      BACKEND_URL: 'https://probe-backend.example',
      APP_VARIANT: 'production',
    })
    expect(config.name).toBe(BASE_NAME)
    expect(config.scheme).toBe(BASE_SCHEME)
    expect(config.android?.package).toBe(BASE_APP_ID)
    expect(buildProperties(config)).toEqual({ android: { usesCleartextTraffic: false } })
    expect(config.ios?.infoPlist?.NSAppTransportSecurity).toEqual({
      NSAllowsLocalNetworking: false,
    })
  })

  it('기본 식별자는 배포할 수 없는 com.example 이다 - 스펙 10.3', () => {
    expect(BASE_APP_ID).toBe('com.example.templateexpo')
  })
})
```

- [ ] **Step 10: 실패를 확인한다**

```bash
pnpm test -- test/unit/config/app-config.test.ts
```

Expected: FAIL — `BASE_APP_ID` 등이 없고 검증이 없다.

- [ ] **Step 11: `expo-build-properties`를 설치하고 `app.config.ts`를 쓴다**

```bash
pnpm exec expo install expo-build-properties
```

`tsconfig.json`의 `compilerOptions`에 `"allowImportingTsExtensions": true`를 더한다(`expo/tsconfig.base`가 `noEmit: true`라 허용된다).

`app.config.ts`:

```ts
import type { ConfigContext, ExpoConfig } from 'expo/config'

import { assertBackendUrlAllowed, parseAppVariant, variantProfile } from './lib/config/app-variant.ts'
import { loadSettings } from './lib/config/settings.ts'

/**
 * 앱 식별자와 빌드 설정의 정본(스펙 10.1).
 *
 * 이 파일은 expo start · expo export · expo prebuild · EAS 빌드 · OTA 발행이 평가한다.
 * 필수 설정이 없으면 **그 명령 전체가 여기서 멈춘다.** 검증 함수는 앱이 시작할 때
 * 쓰는 것과 같다(lib/config/settings.ts) - 두 벌을 두지 않는다.
 *
 * 기본 식별자는 일부러 배포할 수 없는 값이다. Google Play 는 com.example 로 시작하는
 * 패키지 이름을 받지 않는다 - 템플릿 사용자는 배포 전에 BASE_APP_ID 를 반드시
 * 바꾸게 된다(스펙 10.3).
 */
export const BASE_APP_ID = 'com.example.templateexpo'
export const BASE_SCHEME = 'templateexpo'
export const BASE_NAME = 'Template Expo'

export default function appConfig({ config }: ConfigContext): ExpoConfig {
  const variant = parseAppVariant(process.env.APP_VARIANT)
  const { backendUrl } = loadSettings({ BACKEND_URL: process.env.BACKEND_URL })
  assertBackendUrlAllowed(backendUrl, variant)
  const profile = variantProfile(variant)
  const appId = `${BASE_APP_ID}${profile.idSuffix}`

  return {
    ...config,
    name: `${BASE_NAME}${profile.nameSuffix}`,
    slug: 'template-typescript-expo',
    version: '0.1.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    scheme: `${BASE_SCHEME}${profile.schemeSuffix}`,
    userInterfaceStyle: 'automatic',
    ios: {
      supportsTablet: true,
      bundleIdentifier: appId,
      infoPlist: {
        NSAppTransportSecurity: { NSAllowsLocalNetworking: profile.allowCleartext },
      },
    },
    android: {
      package: appId,
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
    },
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        { backgroundColor: '#E6F4FE', image: './assets/splash-icon.png', imageWidth: 76 },
      ],
      ['expo-build-properties', { android: { usesCleartextTraffic: profile.allowCleartext } }],
    ],
    experiments: { typedRoutes: true, reactCompiler: true },
    extra: { backendUrl, appVariant: variant },
  }
}
```

```bash
pnpm test -- test/unit/config/app-config.test.ts
pnpm typecheck
```

Expected: PASS, typecheck 통과.

- [ ] **Step 12: M7을 잰다 — Expo CLI가 같은 파일을 평가하는가**

```bash
BACKEND_URL=http://probe-backend:4321 APP_VARIANT=e2e pnpm exec expo config --type public --json > "$TMPDIR/m7-e2e.json"; echo "exit=$?"
node -e "const c=require(process.argv[1]); console.log(c.android.package, c.scheme, JSON.stringify(c.extra))" "$TMPDIR/m7-e2e.json"
env -u BACKEND_URL pnpm exec expo config --type public --json 2>&1 | tail -5; echo "exit=${PIPESTATUS[0]}"
BACKEND_URL=http://probe-backend:4321 APP_VARIANT=production pnpm exec expo config --type public --json 2>&1 | tail -5; echo "exit=${PIPESTATUS[0]}"
```

(`$TMPDIR`이 비어 있으면 `mktemp -d`로 만든 폴더를 쓴다.)

Expected (M7 = 예): 첫 명령 `exit=0`, 출력 `com.example.templateexpo.e2e templateexpo-e2e {"backendUrl":"http://probe-backend:4321","appVariant":"e2e"}`. 둘째는 `BACKEND_URL is required`와 비영 종료, 셋째는 `must use https for the production variant`와 비영 종료.

**M7 = 아니오일 때의 대체 경로**(첫 명령이 import 오류 — `Cannot find module`·`ERR_UNKNOWN_FILE_EXTENSION`·`Unexpected token` 등 — 로 죽을 때):

1. `app.config.ts`에서 두 import를 지우고, 그 자리에 `lib/config/settings.ts`의 `requireAbsoluteUrl`과 `lib/config/app-variant.ts`의 `PROFILES`·`parseAppVariant`·`assertBackendUrlAllowed`를 **그대로 옮겨 적는다**(이름 앞에 `config` 접두사를 붙여 구별한다: `configRequireAbsoluteUrl` 등).
2. `test/unit/config/app-config.test.ts`에 두 구현이 같은 입력에 같은 결과를 내는지 표로 재는 테스트를 더한다 — `BACKEND_URL`이 `''`·`'   '`·`'/api'`·`'file:///x'`·`'http://probe-backend:4321/'`일 때 `loadSettings`와 `app.config.ts`가 같은 오류 문구 또는 같은 값을 내고, 네 변형 각각에서 `variantProfile`과 설정 결과의 접미사가 같다.
3. `tsconfig.json`에서 `allowImportingTsExtensions`를 되돌린다.
4. 이 경로를 택한 사실과 오류 원문을 M7 절에 적는다.

- [ ] **Step 13: `.env.example`을 쓴다**

```text
# 필수 - 기본값 없음(스펙 10.1). 없으면 expo start · 빌드 · OTA 발행이 멈춘다.
# Android 에뮬레이터에서 호스트의 백엔드는 10.0.2.2, iOS 시뮬레이터는 localhost 다.
# 4100 은 docker-compose.e2e.yml 이 백엔드를 공개하는 기본 포트다(E2E_API_PORT).
BACKEND_URL=http://10.0.2.2:4100

# 선택 - 기본값 development. development · preview · production · e2e 중 하나.
APP_VARIANT=development
```

- [ ] **Step 14: 복사 출처 기록을 시작한다**

`docs/provenance/copied-core.json`:

```json
{
  "source": "https://github.com/builder-shin/template-typescript-nextjs",
  "commit": "34d0b1057d65693645e75bec4e9558dcf6838822",
  "copiedAt": "2026-09-30",
  "paths": ["lib/config/settings.ts", "test/unit/config/settings.test.ts"],
  "note": "복사본이다. 원본에서 계약 버그가 고쳐지면 이 커밋과 원본을 비교해 반영 여부를 판단한다. 개별 이탈은 divergences 배열에 기록한다(스펙 6.3). 복사본의 주석이 말하는 '스펙'·'D2 Task N'·'proxy.ts' 같은 자리는 원본 저장소의 것이다.",
  "divergences": [
    {
      "path": "lib/config/settings.ts",
      "what": "Settings 에서 sessionCookieSecure 와 SESSION_COOKIE_SECURE 파싱(parseBoolean)을 뺐다.",
      "why": "세션 쿠키가 없다 - 모바일 앱은 세션을 SecureStore 에 둔다(스펙 7.1)."
    },
    {
      "path": "lib/config/settings.ts",
      "what": "setSettingsSource() 와 SettingsEnv 타입을 더했다. getSettings() 는 그 자리(기본값 process.env)에서 읽고, 자리를 바꾸면 캐시를 버린다. 머리말 주석에 두 사용처를 적었다.",
      "why": "앱 런타임의 process.env 에는 BACKEND_URL 이 없다 - 값은 app.config.ts 가 extra.backendUrl 로 싣고 platform/config.ts 가 시작할 때 자리를 알려 준다(스펙 10.1). node 의 테스트는 기본 자리를 그대로 쓴다."
    },
    {
      "path": "test/unit/config/settings.test.ts",
      "what": "SESSION_COOKIE_SECURE 테스트 셋을 지우고 setSettingsSource 테스트 넷을 더했다.",
      "why": "위 두 이탈을 따라간다."
    }
  ]
}
```

- [ ] **Step 15: M7 기록을 채우고 커밋한다**

실측 기록의 M7 행과 `## M7 — app.config.ts 의 .ts import` 절을 Step 12의 명령·출력·판정으로 채운다.

```bash
pnpm format && pnpm lint && pnpm typecheck && pnpm test
git add -A
git commit -m "feat: 설정 계약과 빌드 변형을 세우고 app.config 의 검증 공유를 실측한다"
```

---

### Task 4: UI 스택 — Uniwind + React Native Reusables (M1)

**Files:**
- Create: `metro.config.js`, `global.css`, `uniwind-types.d.ts`(생성 후 커밋), `components.json`, `lib/utils.ts`, `components/ui/text.tsx`·`button.tsx`·`icon.tsx`(CLI), `platform/theme.ts`, `test/e2e/android.sh`
- Modify: `app/_layout.tsx`, `app/(app)/index.tsx`, `package.json`, 실측 기록

**Interfaces:**
- Consumes: Task 3의 `app.config.ts`(변형 `e2e`)
- Produces: `NAV_THEME: Record<'light' | 'dark', Theme>` (`platform/theme.ts`), `cn(...inputs: ClassValue[]): string` (`lib/utils.ts`), `Text`·`Button`·`Icon` 컴포넌트, `test/e2e/android.sh boot|build|install|wait-text <텍스트>`

- [ ] **Step 1: 의존성을 설치한다**

```bash
pnpm exec expo install react-native-reanimated react-native-worklets react-native-gesture-handler react-native-svg
pnpm add uniwind@1.12.0 tailwindcss@4.3.3 tw-animate-css@1.4.0 class-variance-authority@0.7.1 clsx@2.1.1 tailwind-merge@3.7.0 @rn-primitives/slot@1.5.2 @rn-primitives/portal@1.5.3 lucide-react-native@1.49.0
```

- [ ] **Step 2: Metro 설정을 쓴다**

`metro.config.js`:

```js
const { getDefaultConfig } = require('expo/metro-config')
const { withUniwindConfig } = require('uniwind/metro')

const config = getDefaultConfig(__dirname)

// Uniwind 가 global.css 를 Tailwind v4 로 컴파일하고, 그 테마의 타입을
// uniwind-types.d.ts 로 만든다(React Native Reusables 의 minimal-uniwind 템플릿과 같은 모양).
module.exports = withUniwindConfig(config, {
  cssEntryFile: './global.css',
  dtsFile: './uniwind-types.d.ts',
})
```

- [ ] **Step 3: `global.css`를 쓴다**

React Native Reusables `minimal-uniwind` 템플릿의 파일과 같은 토큰이다(shadcn neutral).

```css
@import 'tailwindcss';
@import 'uniwind';

@import 'tw-animate-css';

@theme {
  --radius: 10px;
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);

  --spacing-hairline: hairlineWidth();
}

@layer theme {
  :root {
    @variant light {
      --color-background: oklch(1 0 0);
      --color-foreground: oklch(0.145 0 0);
      --color-card: oklch(1 0 0);
      --color-card-foreground: oklch(0.145 0 0);
      --color-popover: oklch(1 0 0);
      --color-popover-foreground: oklch(0.145 0 0);
      --color-primary: oklch(0.205 0 0);
      --color-primary-foreground: oklch(0.985 0 0);
      --color-secondary: oklch(0.97 0 0);
      --color-secondary-foreground: oklch(0.205 0 0);
      --color-muted: oklch(0.97 0 0);
      --color-muted-foreground: oklch(0.556 0 0);
      --color-accent: oklch(0.97 0 0);
      --color-accent-foreground: oklch(0.205 0 0);
      --color-destructive: oklch(0.577 0.245 27.325);
      --color-border: oklch(0.922 0 0);
      --color-input: oklch(0.922 0 0);
      --color-ring: oklch(0.708 0 0);
    }

    @variant dark {
      --color-background: oklch(0.145 0 0);
      --color-foreground: oklch(0.985 0 0);
      --color-card: oklch(0.205 0 0);
      --color-card-foreground: oklch(0.985 0 0);
      --color-popover: oklch(0.205 0 0);
      --color-popover-foreground: oklch(0.985 0 0);
      --color-primary: oklch(0.922 0 0);
      --color-primary-foreground: oklch(0.205 0 0);
      --color-secondary: oklch(0.269 0 0);
      --color-secondary-foreground: oklch(0.985 0 0);
      --color-muted: oklch(0.269 0 0);
      --color-muted-foreground: oklch(0.708 0 0);
      --color-accent: oklch(0.269 0 0);
      --color-accent-foreground: oklch(0.985 0 0);
      --color-destructive: oklch(0.704 0.191 22.216);
      --color-border: oklch(1 0 0 / 10%);
      --color-input: oklch(1 0 0 / 15%);
      --color-ring: oklch(0.556 0 0);
    }
  }
}
```

(원본 템플릿의 `chart-*`·`sidebar-*` 토큰은 쓰는 화면이 없어 넣지 않는다.)

- [ ] **Step 4: `components.json`과 `lib/utils.ts`를 쓴다**

`components.json`:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "global.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/queries"
  },
  "iconLibrary": "lucide"
}
```

`lib/utils.ts`:

```ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** 클래스 이름을 합치고 Tailwind 충돌을 뒤쪽 값으로 정리한다(React Native Reusables 의 cn). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 5: 컴포넌트 셋을 CLI로 받는다**

```bash
pnpm dlx @react-native-reusables/cli@0.7.1 add text button icon --styling-library uniwind --yes
git status --short
```

Expected: `components/ui/text.tsx`·`button.tsx`·`icon.tsx`가 생긴다. CLI가 `lib/utils.ts`를 덮어쓰려 하면 Step 4의 내용으로 되돌린다. CLI가 새 의존성을 설치했으면 `package.json` 변경을 그대로 둔다.

```bash
pnpm format
```

(받은 컴포넌트를 이 저장소의 Prettier 서식으로 맞춘다.)

- [ ] **Step 6: 내비게이션 테마를 `platform/`에 둔다**

`platform/theme.ts`:

```ts
import { DarkTheme, DefaultTheme, type Theme } from 'expo-router'

/**
 * Stack 헤더·배경이 global.css 의 토큰과 같은 색을 쓰게 하는 내비게이션 테마.
 *
 * React Native Reusables 템플릿은 이 파일을 lib/theme.ts 에 두지만, expo-router 를
 * import 하므로 이 저장소에서는 lib/ 에 둘 수 없다(스펙 5장).
 */
const COLORS = {
  light: {
    background: 'hsl(0 0% 100%)',
    border: 'hsl(0 0% 89.8%)',
    card: 'hsl(0 0% 100%)',
    notification: 'hsl(0 84.2% 60.2%)',
    primary: 'hsl(0 0% 9%)',
    text: 'hsl(0 0% 3.9%)',
  },
  dark: {
    background: 'hsl(0 0% 3.9%)',
    border: 'hsl(0 0% 14.9%)',
    card: 'hsl(0 0% 3.9%)',
    notification: 'hsl(0 70.9% 59.4%)',
    primary: 'hsl(0 0% 98%)',
    text: 'hsl(0 0% 98%)',
  },
} as const

export const NAV_THEME: Record<'light' | 'dark', Theme> = {
  light: { ...DefaultTheme, colors: COLORS.light },
  dark: { ...DarkTheme, colors: COLORS.dark },
}
```

`pnpm typecheck`가 `Theme`를 찾지 못한다고 하면 import를 `import { DarkTheme, DefaultTheme, type Theme } from 'expo-router/react-navigation'`으로 바꾼다(SDK 56 템플릿의 경로).

- [ ] **Step 7: 루트 레이아웃과 홈을 스타일 스택으로 바꾼다**

`app/_layout.tsx`:

```tsx
import '@/global.css'

import { PortalHost } from '@rn-primitives/portal'
import { Stack, ThemeProvider } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useUniwind } from 'uniwind'

import { NAV_THEME } from '@/platform/theme'

export { ErrorBoundary } from 'expo-router'

export default function RootLayout() {
  const { theme } = useUniwind()
  const scheme = theme === 'dark' ? 'dark' : 'light'

  return (
    <ThemeProvider value={NAV_THEME[scheme]}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack />
      <PortalHost />
    </ThemeProvider>
  )
}
```

`app/(app)/index.tsx`:

```tsx
import { View } from 'react-native'

import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'

export default function HomeScreen() {
  return (
    <View className="flex-1 items-center justify-center gap-4 bg-background p-6">
      <Text variant="h3">template-typescript-expo</Text>
      <Button testID="home-probe-button">
        <Text>Uniwind</Text>
      </Button>
    </View>
  )
}
```

- [ ] **Step 8: 번들과 타입을 확인하고 생성된 타입 파일을 받아들인다**

```bash
BACKEND_URL=https://gate-check.invalid pnpm exec expo export --platform android --platform ios --output-dir dist 2>&1 | tail -5
ls -l uniwind-types.d.ts
pnpm typecheck && pnpm lint && pnpm format:check
```

Expected: 번들 성공, `uniwind-types.d.ts`가 생겼다(Metro가 만든다). 이 파일을 커밋한다 — 없으면 Metro를 한 번도 돌리지 않은 체크아웃에서 typecheck가 `className` 타입을 모른다. lint·format은 이 파일을 무시한다(Task 2의 설정).

- [ ] **Step 9: Android 기기 도우미를 쓴다**

`test/e2e/android.sh`:

```bash
#!/usr/bin/env bash
# Android 기기 도우미 - 실측과 E2E 하네스가 함께 쓴다.
#
#   test/e2e/android.sh boot      켜진 기기가 없으면 E2E_AVD 를 부팅하고 부팅 완료까지 기다린다
#   test/e2e/android.sh build     e2e 변형 Release APK 를 만든다 (BACKEND_URL 필요)
#   test/e2e/android.sh install   만든 APK 를 설치한다
#   test/e2e/android.sh wait-text <텍스트>
#                                 그 텍스트가 화면에 나타날 때까지(최대 60초) 기다리고
#                                 UI 덤프를 stdout 에 낸다
#
# 기기가 여럿이면 ANDROID_SERIAL 로 하나를 고른다(adb 의 표준 변수).
set -euo pipefail
cd "$(dirname "$0")/../.."

: "${ANDROID_HOME:?ANDROID_HOME 이 필요하다 - Android SDK 경로}"
ADB="$ANDROID_HOME/platform-tools/adb"
EMULATOR="$ANDROID_HOME/emulator/emulator"
APK=android/app/build/outputs/apk/release/app-release.apk
BOOT_TIMEOUT_SECONDS=300

device_count() {
  "$ADB" devices | awk 'NR > 1 && $2 == "device"' | wc -l | tr -d ' '
}

boot() {
  if [ "$(device_count)" -ge 1 ]; then
    echo "기기가 이미 연결돼 있다"
  else
    : "${E2E_AVD:?켜진 기기가 없다 - 부팅할 AVD 이름을 E2E_AVD 로 준다 (예: Pixel_9_API_36)}"
    "$EMULATOR" -avd "$E2E_AVD" -no-snapshot-save -no-boot-anim -no-audio >/dev/null 2>&1 &
    "$ADB" wait-for-device
    local waited=0
    until [ "$("$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do
      if [ "$waited" -ge "$BOOT_TIMEOUT_SECONDS" ]; then
        echo "${BOOT_TIMEOUT_SECONDS}초 안에 부팅이 끝나지 않았다" >&2
        exit 1
      fi
      sleep 2
      waited=$((waited + 2))
    done
  fi
  # 애니메이션을 끈다 - 화면 전환 중의 단언이 흔들리지 않게 한다(스펙 16장).
  "$ADB" shell settings put global window_animation_scale 0
  "$ADB" shell settings put global transition_animation_scale 0
  "$ADB" shell settings put global animator_duration_scale 0
}

build() {
  : "${BACKEND_URL:?BACKEND_URL 이 필요하다 - 에뮬레이터에서 호스트는 http://10.0.2.2:<포트>}"
  APP_VARIANT=e2e pnpm exec expo prebuild --platform android --clean --no-install
  (cd android && ./gradlew assembleRelease)
  ls -l "$APK"
}

install() {
  "$ADB" install -r "$APK"
}

WAIT_TEXT_TIMEOUT_SECONDS=60

wait_text() {
  local text="${1:?기다릴 텍스트가 필요하다}"
  local dump=''
  local waited=0
  until dump=$("$ADB" exec-out uiautomator dump /dev/tty 2>/dev/null) && grep -qF "text=\"$text\"" <<<"$dump"; do
    if [ "$waited" -ge "$WAIT_TEXT_TIMEOUT_SECONDS" ]; then
      echo "${WAIT_TEXT_TIMEOUT_SECONDS}초 안에 \"$text\" 가 화면에 나타나지 않았다" >&2
      exit 1
    fi
    sleep 1
    waited=$((waited + 1))
  done
  printf '%s\n' "$dump"
}

case "${1:-}" in
  boot) boot ;;
  build) build ;;
  install) install ;;
  wait-text)
    shift
    wait_text "$@"
    ;;
  *)
    echo "사용법: $0 boot|build|install|wait-text <텍스트>" >&2
    exit 1
    ;;
esac
```

```bash
chmod +x test/e2e/android.sh
git add test/e2e/android.sh && git update-index --chmod=+x test/e2e/android.sh
```

- [ ] **Step 10: M1을 잰다 — Release APK에서 렌더되는가**

```bash
E2E_AVD=Pixel_9_API_36 test/e2e/android.sh boot
BACKEND_URL=http://10.0.2.2:4100 test/e2e/android.sh build 2>&1 | tail -15
test/e2e/android.sh install
"$ANDROID_HOME/platform-tools/adb" shell am start -W -n com.example.templateexpo.e2e/.MainActivity
mkdir -p .maestro-output
test/e2e/android.sh wait-text Uniwind > .maestro-output/m1-ui.xml
grep -o 'text="[^"]*"' .maestro-output/m1-ui.xml
"$ANDROID_HOME/platform-tools/adb" exec-out screencap -p > .maestro-output/m1-home.png
```

Expected: `text="template-typescript-expo"`와 `text="Uniwind"`가 보인다. `.maestro-output/m1-home.png`를 열어 버튼이 어두운 배경(`primary`)에 밝은 글자, 둥근 모서리로 그려졌는지 눈으로 확인한다 — 글자는 보이는데 스타일이 전혀 없으면(회색 기본 버튼·흰 배경의 검은 글자만) Uniwind가 적용되지 않은 것이다.

빌드가 실패하면 원인을 좁혀 기록한다.
- 경로 길이(`Filename longer than 260 characters`·ninja 경로 오류): `LongPathsEnabled=1`은 이미 켜져 있다. `subst X: "$(cygpath -w "$PWD")"`로 짧은 드라이브를 만들고 `X:`에서 다시 빌드해 차이를 기록한다(끝나면 `subst X: /D`).
- 네이티브 모듈 자동 연결 실패(`Could not find project :react-native-…`): M5 판정을 다시 연다 — `node-linker=hoisted`로 바꾸고 다시 빌드한다.
- OneDrive의 파일 잠금(`being used by another process`): 같은 명령을 한 번 더 돌려 재현되는지 보고 기록한다.

- [ ] **Step 11: M1을 기록하고 커밋한다**

실측 기록의 M1 행과 `## M1 — UI 스택 렌더` 절에 빌드 명령의 마지막 출력, UI 덤프의 `text=` 목록, 스크린샷에서 확인한 것을 적는다. 스크린샷 파일은 커밋하지 않는다(`.maestro-output/`은 무시 대상).

M1이 아니오면(스타일이 적용되지 않거나 앱이 죽는다) 여기서 멈추고 사용자에게 보고한다 — 스타일 스택은 스펙 결정이다.

```bash
git add -A
git commit -m "feat: Uniwind 와 React Native Reusables 로 UI 스택을 세우고 Android 렌더를 실측한다"
```

---

### Task 5: 플랫폼 중립 코어 복사와 출처 검사

**Files:**
- Create (복사): `lib/jsonapi/document.ts`·`normalize.ts`·`query.ts`·`errors.ts`·`client.ts`, `lib/resources/define.ts`·`example.ts`·`category.ts`·`tag.ts`·`index.ts`·`mirror.ts`, `lib/auth/tokens.ts`, `test/fixtures/documents.ts`, `test/unit/jsonapi/*.test.ts`(6), `test/unit/resources/define.test.ts`·`mirror.test.ts`·`resources.test.ts`·`invariants.ts`, `test/unit/auth/tokens.test.ts`
- Create: `scripts/check-provenance.mjs`, `test/unit/scripts/check-provenance.test.ts`, `lib/jsonapi/AGENTS.md`, `lib/resources/AGENTS.md`
- Modify: `docs/provenance/copied-core.json`, `AGENTS.md`

**Interfaces:**
- Consumes: `getSettings()` (Task 3) — `client.ts`가 `getSettings().backendUrl`만 쓴다
- Produces: 원본과 같은 공개 API — `request<T>(path, options): Promise<JsonApiResult<T>>`, `withAcceptLanguage`, `isSyntheticError`, `JSONAPI_MEDIA_TYPE`(client), `actionForErrors` 등(errors), `defineResource`·`formAttributes`·`isRequiredAttribute`(define), `RESOURCES`(index), `mirrorProbes`·`attributeKeys`(mirror), `sessionFromTokenDocument`·`isAccessExpiring`·`ACCESS_EXPIRY_LEEWAY_MS`(tokens); 검사 명령 `node scripts/check-provenance.mjs [기록 파일]`

`errors.ts`는 `./client`를 import하므로 `client.ts`도 여기서 **그대로** 복사한다. RN에 맞춘 수정은 Task 6이 테스트를 먼저 바꾸며 한다.

- [ ] **Step 1: 테스트와 픽스처를 먼저 복사한다**

```bash
SRC=../template-typescript-nextjs
REV=34d0b1057d65693645e75bec4e9558dcf6838822
copy() { mkdir -p "$(dirname "$1")"; git -C "$SRC" show "$REV:$1" > "$1"; }
for f in \
  test/fixtures/documents.ts \
  test/unit/jsonapi/document.test.ts test/unit/jsonapi/normalize.test.ts test/unit/jsonapi/query.test.ts \
  test/unit/jsonapi/errors.test.ts test/unit/jsonapi/error-routing.test.ts test/unit/jsonapi/client.test.ts \
  test/unit/resources/define.test.ts test/unit/resources/mirror.test.ts test/unit/resources/resources.test.ts \
  test/unit/resources/invariants.ts \
  test/unit/auth/tokens.test.ts; do copy "$f"; done
git status --short
```

- [ ] **Step 2: 실패를 확인한다**

```bash
pnpm test 2>&1 | tail -15
```

Expected: FAIL — `@/lib/jsonapi/*`·`@/lib/resources/*`·`@/lib/auth/tokens`를 찾지 못한다.

- [ ] **Step 3: 소스를 복사한다**

```bash
for f in \
  lib/jsonapi/document.ts lib/jsonapi/normalize.ts lib/jsonapi/query.ts lib/jsonapi/errors.ts lib/jsonapi/client.ts \
  lib/resources/define.ts lib/resources/example.ts lib/resources/category.ts lib/resources/tag.ts \
  lib/resources/index.ts lib/resources/mirror.ts \
  lib/auth/tokens.ts; do copy "$f"; done
```

- [ ] **Step 4: 복사한 테스트가 전부 통과하는지 본다**

```bash
pnpm test 2>&1 | tail -15
```

Expected: PASS — 복사한 파일의 테스트 전부와 Task 2·3의 테스트.

- [ ] **Step 5: 이 저장소의 정적 검사를 돌린다**

```bash
pnpm typecheck && pnpm lint && pnpm format:check
```

- 형식 차이는 없어야 한다(Prettier 설정이 원본과 같다). 있으면 `pnpm format`의 결과를 이탈로 기록한다.
- 복사 파일에서 lint 오류가 나면 규칙의 성격을 본다. **동작 결함을 가리키면** 파일을 고치고 이탈로 기록한다. **순수 스타일 규칙**(eslint-config-expo가 더한 import 순서 등)이면 파일을 고치지 않고 `eslint.config.js`에서 그 규칙을 저장소 전체에 끄고 이유를 주석으로 적는다 — 복사본을 원본과 같게 두는 쪽이 비교 비용이 싸다.
- typecheck 오류(원본과 다른 `lib`·`module` 설정 때문)도 같은 기준이다.

- [ ] **Step 6: 출처 검사 테스트를 먼저 쓴다**

`test/unit/scripts/check-provenance.test.ts`:

```ts
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

/**
 * 복사 출처 기록 검사(스펙 6.3)를 잰다. 기록을 사람의 기억에 두면 다음 복사에서
 * 갱신되지 않는다 - 그래서 게이트가 검사한다.
 */
const SCRIPT = resolve('scripts/check-provenance.mjs')
const REPO_ROOT = resolve('.')

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'provenance-probe-'))
  mkdirSync(join(dir, 'lib'), { recursive: true })
  writeFileSync(join(dir, 'lib', 'copied.ts'), 'export {}\n')
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

const VALID = {
  source: 'https://example.invalid/probe-source',
  commit: 'a'.repeat(40),
  copiedAt: '2026-09-30',
  paths: ['lib/copied.ts'],
  note: 'probe',
  divergences: [{ path: 'lib/copied.ts', what: 'probe what', why: 'probe why' }],
}

function run(record: unknown): { status: number | null; stderr: string } {
  writeFileSync(join(dir, 'record.json'), JSON.stringify(record))
  const result = spawnSync(process.execPath, [SCRIPT, 'record.json'], {
    cwd: dir,
    encoding: 'utf8',
  })
  return { status: result.status, stderr: result.stderr }
}

describe('check-provenance', () => {
  it('올바른 기록은 통과한다', () => {
    expect(run(VALID).status).toBe(0)
  })

  it('기록 파일이 없으면 실패한다', () => {
    const result = spawnSync(process.execPath, [SCRIPT, 'missing.json'], {
      cwd: dir,
      encoding: 'utf8',
    })
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/읽지 못했다/)
  })

  it('commit 이 40자리 16진수가 아니면 실패한다', () => {
    const result = run({ ...VALID, commit: '34d0b10' })
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/commit/)
  })

  it('source 가 비면 실패한다', () => {
    const result = run({ ...VALID, source: ' ' })
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/source/)
  })

  it('paths 의 경로가 실재하지 않으면 실패한다', () => {
    const result = run({ ...VALID, paths: ['lib/copied.ts', 'lib/absent.ts'], divergences: [] })
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/lib\/absent\.ts/)
  })

  it('divergences 의 경로가 paths 에 없으면 실패한다', () => {
    const result = run({
      ...VALID,
      divergences: [{ path: 'lib/other.ts', what: 'probe what', why: 'probe why' }],
    })
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/lib\/other\.ts/)
  })

  it.each(['what', 'why'])('divergences 의 %s 가 비면 실패한다', (key) => {
    const result = run({
      ...VALID,
      divergences: [{ path: 'lib/copied.ts', what: 'probe what', why: 'probe why', [key]: '' }],
    })
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(new RegExp(key))
  })

  it('이 저장소의 실제 기록이 통과한다', () => {
    const result = spawnSync(process.execPath, [SCRIPT], { cwd: REPO_ROOT, encoding: 'utf8' })
    expect(result.stderr).toBe('')
    expect(result.status).toBe(0)
  })
})
```

- [ ] **Step 7: 실패를 확인한다**

```bash
pnpm test -- test/unit/scripts/check-provenance.test.ts
```

Expected: FAIL — 스크립트가 없다.

- [ ] **Step 8: 검사 스크립트를 쓴다**

`scripts/check-provenance.mjs`:

```js
#!/usr/bin/env node
/**
 * 복사 출처 기록을 검사한다(스펙 6.3). 게이트가 부른다.
 *
 *   node scripts/check-provenance.mjs [기록 파일]
 *
 * 기록 파일의 기본값은 docs/provenance/copied-core.json 이고, 경로는 전부 현재
 * 디렉터리 기준이다. 종료 코드: 0 = 통과, 1 = 위반(무엇이 틀렸는지 stderr 에 전부 적는다).
 *
 * 스펙은 이 검사를 check-provenance.sh 로 적었지만 JSON 을 읽어야 해서 node 로 쓴다.
 */
import { existsSync, readFileSync } from 'node:fs'

const file = process.argv[2] ?? 'docs/provenance/copied-core.json'

let record
try {
  record = JSON.parse(readFileSync(file, 'utf8'))
} catch (error) {
  const reason = error instanceof Error ? error.message : String(error)
  console.error(`복사 출처 기록을 읽지 못했다: ${file} (${reason})`)
  process.exit(1)
}

const problems = []

if (typeof record.source !== 'string' || record.source.trim() === '') {
  problems.push('source 가 비어 있다')
}
if (typeof record.commit !== 'string' || !/^[0-9a-f]{40}$/.test(record.commit)) {
  problems.push(`commit 이 40자리 16진수가 아니다: ${JSON.stringify(record.commit)}`)
}

const paths = Array.isArray(record.paths) ? record.paths : []
if (!Array.isArray(record.paths)) problems.push('paths 가 배열이 아니다')
for (const path of paths) {
  if (typeof path !== 'string' || !existsSync(path)) {
    problems.push(`paths 의 경로가 실재하지 않는다: ${JSON.stringify(path)}`)
  }
}

const divergences = Array.isArray(record.divergences) ? record.divergences : []
if (!Array.isArray(record.divergences)) problems.push('divergences 가 배열이 아니다')
divergences.forEach((divergence, index) => {
  if (!paths.includes(divergence?.path)) {
    problems.push(`divergences[${index}].path 가 paths 에 없다: ${JSON.stringify(divergence?.path)}`)
  }
  for (const key of ['what', 'why']) {
    const value = divergence?.[key]
    if (typeof value !== 'string' || value.trim() === '') {
      problems.push(`divergences[${index}].${key} 가 비어 있다`)
    }
  }
})

if (problems.length > 0) {
  console.error(`복사 출처 기록 위반 ${problems.length}건 (${file}):`)
  for (const problem of problems) console.error(`- ${problem}`)
  process.exit(1)
}

console.log(`복사 출처 기록 통과: 경로 ${paths.length}개, 이탈 ${divergences.length}건`)
```

- [ ] **Step 9: 기록에 복사한 경로를 더한다**

`docs/provenance/copied-core.json`의 `paths`를 다음으로 바꾼다(Task 3의 둘을 포함한다). Step 5에서 이탈이 생겼다면 `divergences`에 더한다.

```json
[
  "lib/config/settings.ts",
  "test/unit/config/settings.test.ts",
  "lib/jsonapi/document.ts",
  "lib/jsonapi/normalize.ts",
  "lib/jsonapi/query.ts",
  "lib/jsonapi/errors.ts",
  "lib/jsonapi/client.ts",
  "lib/resources/define.ts",
  "lib/resources/example.ts",
  "lib/resources/category.ts",
  "lib/resources/tag.ts",
  "lib/resources/index.ts",
  "lib/resources/mirror.ts",
  "lib/auth/tokens.ts",
  "test/fixtures/documents.ts",
  "test/unit/jsonapi/document.test.ts",
  "test/unit/jsonapi/normalize.test.ts",
  "test/unit/jsonapi/query.test.ts",
  "test/unit/jsonapi/errors.test.ts",
  "test/unit/jsonapi/error-routing.test.ts",
  "test/unit/jsonapi/client.test.ts",
  "test/unit/resources/define.test.ts",
  "test/unit/resources/mirror.test.ts",
  "test/unit/resources/resources.test.ts",
  "test/unit/resources/invariants.ts",
  "test/unit/auth/tokens.test.ts"
]
```

- [ ] **Step 10: 통과를 확인한다**

```bash
pnpm test -- test/unit/scripts/check-provenance.test.ts
node scripts/check-provenance.mjs
```

Expected: PASS, `복사 출처 기록 통과: 경로 26개, 이탈 3건`(Step 5의 이탈이 있으면 그만큼 더).

- [ ] **Step 11: 계층 문서 둘을 쓴다**

`lib/jsonapi/AGENTS.md`:

```markdown
# lib/jsonapi/ 작업 지침

루트 `AGENTS.md`의 계층 소유권 표가 이 디렉터리에 배정한 것: 문서 파싱(`document.ts`) ·
`included` 정규화와 관계 해석(`normalize.ts`) · 쿼리 파라미터 직렬화(`query.ts`) · 오류
분류(`errors.ts`) · HTTP 클라이언트(`client.ts`). 백엔드 템플릿들의 `app/jsonapi/`와 마주
보는 계층이다.

## 복사본이다

다섯 파일은 `template-typescript-nextjs`에서 복사했다. 출처 커밋과 원본에서 달라진 곳은
`docs/provenance/copied-core.json`이 전부 갖는다 - 여기서 무엇을 바꾸면 그 파일의
`divergences`에 `what`·`why`를 더한다. 게이트가 기록의 형식과 경로를 검사한다.

주석에 나오는 "스펙 N장", "D2 Task N", `proxy.ts`, `app/error.tsx` 같은 자리는 **원본
저장소의 것**이다. 원본과 비교하기 쉽게 주석을 고치지 않고 두었다.

## 자원을 모른다

이 디렉터리는 어떤 자원 이름도 몰라야 한다. `examples`·`exampleTags`·`exampleCategories`
처럼 실제 자원 이름을 가리키는 문자열 리터럴, 자원별 필드 이름에 의존하는 분기가 코드에
나타나면 위반이다. 있어도 되는 문자열은 JSON:API 문법 자체, 연산자 이름, 오류 **코드**,
미디어 타입, HTTP 헤더 이름이다.

## 오류 문구 카탈로그를 두지 않는다

`errors.ts`는 code로 동작만 분기한다. 표시 문구는 백엔드가 낸 값을 그대로 쓴다(스펙 9장).
예외는 `client.ts`가 합성하는 코드뿐이다 - 백엔드가 응답조차 주지 못한 상황이라 앱이 문구를
가질 수밖에 없다. 합성 오류는 `isSyntheticError`로 판정한다. 합성 코드 문자열을 다른
곳에서 직접 비교하지 않는다.

## 플랫폼을 모른다

이 디렉터리는 react·react-native·expo를 import하지 않는다(ESLint가 막는다). 그래서 node의
vitest에서 그대로 돌고, 앱에서는 RN의 fetch 위에서 돈다. 둘의 차이(RN fetch polyfill의
동작 등)는 `client.ts`의 이탈 기록에 있다.
```

`lib/resources/AGENTS.md`:

```markdown
# lib/resources/ 작업 지침

자원 선언과 그 판단을 소유한다(스펙 5장). JSX·fetch·네이티브 모듈을 갖지 않는다.

## 복사본이다

`define.ts`·`example.ts`·`category.ts`·`tag.ts`·`index.ts`·`mirror.ts`는
`template-typescript-nextjs`에서 복사했다. 출처와 이탈은 `docs/provenance/copied-core.json`.
목록·상세·폼 판단(`view.ts`·`form.ts`)은 그것을 쓰는 화면이 생길 때 같은 방식으로 복사한다.

## 선언은 데이터다

`filters`·`sorts`는 백엔드 조회 정책을 **손으로 베낀 거울**이다. 손으로 유지되는 거울은
반드시 어긋나므로 계약 거울 테스트(스펙 11.2)가 양방향으로 잡는다.

## 명시적 등록

`index.ts`의 `RESOURCES`는 손으로 채우는 배열이다. 여기 없으면 그 자원은 존재하지 않는
것과 같다. 새 자원은 선언 파일을 만들고 이 배열에 손으로 더한다.
```

루트 `AGENTS.md`의 계층 소유권 표 아래에 한 문단을 더한다:

```markdown
## 복사한 코어

`lib/`의 상당 부분은 `template-typescript-nextjs`에서 복사했다(스펙 6장). 어떤 파일을
복사했고 원본과 무엇이 다른지는 `docs/provenance/copied-core.json`이 정본이다. 복사한
파일을 고치면 그 파일의 `divergences`에 `what`·`why`를 더한다 - `node
scripts/check-provenance.mjs`가 기록의 형식과 경로를 검사한다.
```

- [ ] **Step 12: 전체를 돌리고 커밋한다**

```bash
pnpm format && pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && node scripts/check-provenance.mjs
git add -A
git commit -m "feat: Next.js 템플릿의 플랫폼 중립 코어를 복사하고 출처 검사를 더한다"
```

---

### Task 6: HTTP 클라이언트를 RN에 맞춘다 — `cache` 제거와 요청 타임아웃

**Files:**
- Modify: `lib/jsonapi/client.ts`, `test/unit/jsonapi/client.test.ts`, `docs/provenance/copied-core.json`, `lib/jsonapi/AGENTS.md`

**Interfaces:**
- Consumes: Task 5의 `client.ts`
- Produces: `REQUEST_TIMEOUT_MS = 15_000`(export), 합성 코드 `REQUEST_TIMEOUT`(detail `The backend did not respond in time.`, `meta.synthetic: true`); 호출자 `signal`의 중단은 계속 `NETWORK_ERROR`

- [ ] **Step 1: 캐시 테스트를 RN의 기대로 바꾼다**

`test/unit/jsonapi/client.test.ts`의 `it('캐시를 쓰지 않는다', …)`를 다음으로 바꾼다:

```ts
  it('cache 옵션을 넘기지 않는다 - RN fetch polyfill 이 URL 을 바꾼다', async () => {
    // RN 0.86.3 의 fetch 는 whatwg-fetch 3.6.20 이고, 그 Request 는 cache 가
    // no-store·no-cache 인 GET 의 URL 끝에 `_=<시각>` 을 붙인다(fetch.js:398-407).
    // JSON:API 요청 URL 은 백엔드의 쿼리 문법 검사를 거치므로 바뀌면 안 된다.
    fetchMock.mockResolvedValue(jsonApiResponse(COLLECTION_EMPTY))
    await request('/api/v1/examples')
    expect(lastCall()[1].cache).toBeUndefined()
    expect(lastCall()[0]).toBe(`${BACKEND}/api/v1/examples`)
  })
```

- [ ] **Step 2: signal 테스트를 "전달된다"에서 "중단이 전달된다"로 바꾼다**

`it('signal 을 그대로 전달한다', …)`를 다음 둘로 바꾼다 — 타임아웃이 자기 `AbortController`를 쓰므로 fetch가 받는 signal은 더 이상 호출자의 것과 같은 객체가 아니다. 지켜야 할 성질은 "호출자가 끊으면 요청이 끊긴다"이다.

```ts
  it('호출자 signal 이 끊기면 요청도 끊긴다', async () => {
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'))
          })
        }),
    )
    const controller = new AbortController()
    const pending = request('/api/v1/examples', { signal: controller.signal })
    controller.abort()
    const result = await pending
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors[0]?.code).toBe('NETWORK_ERROR')
  })

  it('이미 끊긴 signal 을 주면 요청이 시작부터 끊겨 있다', async () => {
    fetchMock.mockResolvedValue(jsonApiResponse(COLLECTION_EMPTY))
    const controller = new AbortController()
    controller.abort()
    await request('/api/v1/examples', { signal: controller.signal })
    expect(lastCall()[1].signal?.aborted).toBe(true)
  })
```

- [ ] **Step 3: 타임아웃 테스트를 더한다**

파일 맨 위 import를 다음으로 바꾼다:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  JSONAPI_MEDIA_TYPE,
  REQUEST_TIMEOUT_MS,
  isSyntheticError,
  request,
  withAcceptLanguage,
} from '@/lib/jsonapi/client'
import { COLLECTION_EMPTY, ERROR_NOT_FOUND, SINGLE_CREATED } from '../../fixtures/documents'
```

(원본의 2번째 줄은 `JSONAPI_MEDIA_TYPE`·`request`·`withAcceptLanguage` 셋만 import한다 — 위 블록이 그 줄을 대신하며 `REQUEST_TIMEOUT_MS`·`isSyntheticError`를 더한다.)

파일 끝에 더한다:

```ts
describe('request — 타임아웃(스펙 8.5)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  /** 응답하지 않다가 signal 이 끊기면 AbortError 로 거절하는 fetch. */
  function hangUntilAborted(): void {
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'))
          })
        }),
    )
  }

  it('REQUEST_TIMEOUT_MS 는 15초다', () => {
    expect(REQUEST_TIMEOUT_MS).toBe(15_000)
  })

  it('시간이 다 되면 끊고 REQUEST_TIMEOUT 을 합성한다', async () => {
    hangUntilAborted()
    const pending = request('/api/v1/examples')
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS)
    const result = await pending
    expect(result).toMatchObject({ ok: false, status: 0 })
    if (result.ok) throw new Error('끊기지 않았다')
    const [error] = result.errors
    expect(error?.code).toBe('REQUEST_TIMEOUT')
    expect(error?.detail).toBe('The backend did not respond in time.')
    expect(error !== undefined && isSyntheticError(error)).toBe(true)
  })

  it('시간이 다 되기 전에는 끊지 않는다', async () => {
    hangUntilAborted()
    let settled = false
    const pending = request('/api/v1/examples').then((result) => {
      settled = true
      return result
    })
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS - 1)
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await pending
    expect(settled).toBe(true)
  })

  it('본문을 읽다가 멈춰도 끊는다', async () => {
    fetchMock.mockImplementation((_url: string, init: RequestInit) =>
      Promise.resolve({
        status: 200,
        ok: true,
        json: () =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => {
              reject(new DOMException('aborted', 'AbortError'))
            })
          }),
      } as unknown as Response),
    )
    const pending = request('/api/v1/examples')
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS)
    const result = await pending
    if (result.ok) throw new Error('끊기지 않았다')
    expect(result.errors[0]?.code).toBe('REQUEST_TIMEOUT')
  })

  it('끝난 요청은 타이머를 남기지 않는다', async () => {
    fetchMock.mockResolvedValue(jsonApiResponse(COLLECTION_EMPTY))
    await request('/api/v1/examples')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('실패한 요청도 타이머를 남기지 않는다', async () => {
    fetchMock.mockRejectedValue(new TypeError('probe network failure'))
    await request('/api/v1/examples')
    expect(vi.getTimerCount()).toBe(0)
  })
})
```

- [ ] **Step 4: 실패를 확인한다**

```bash
pnpm test -- test/unit/jsonapi/client.test.ts
```

Expected: FAIL — `REQUEST_TIMEOUT_MS`가 없고, `cache`가 `'no-store'`이며, 타임아웃이 없다.

- [ ] **Step 5: `client.ts`를 고친다**

1. `JSONAPI_MEDIA_TYPE` 선언 바로 아래에 더한다:

```ts
/**
 * 요청 하나가 쓸 수 있는 최대 시간(template-typescript-expo 스펙 8.5).
 *
 * 모바일 네트워크는 거절하지 않고 멈추는 경우가 많다 - 이 값이 없으면 멈춘 요청이
 * 화면의 스피너를 끝없이 돌린다. 연결·응답 대기·본문 읽기를 모두 덮는다.
 */
export const REQUEST_TIMEOUT_MS = 15_000
```

2. 조립 블록의 `init` 객체에서 `cache: 'no-store',` 줄을 지우고, 그 바로 아래의 `if (options.signal !== undefined) init.signal = options.signal` 줄을 지운다. 지운 자리에 주석 한 줄을 남긴다:

```ts
    // cache 를 넘기지 않는다 - RN 의 fetch polyfill(whatwg-fetch)은 no-store 인 GET 의
    // URL 에 `_=<시각>` 을 덧붙인다. signal 은 아래에서 타임아웃과 합쳐 싣는다.
```

3. 조립 `try … catch`가 끝난 직후, `let response: Response` 앞에 더한다:

```ts
  // 타임아웃과 호출자 signal 을 컨트롤러 하나로 합친다. 어느 쪽이 끊었는지는 timedOut 이
  // 가른다 - 호출자가 끊은 것은 기존대로 NETWORK_ERROR, 시간이 다 된 것은 REQUEST_TIMEOUT.
  const controller = new AbortController()
  let timedOut = false
  const timer: ReturnType<typeof setTimeout> = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, REQUEST_TIMEOUT_MS)
  const callerSignal = options.signal
  const forwardAbort = (): void => {
    controller.abort()
  }
  if (callerSignal !== undefined) {
    if (callerSignal.aborted) controller.abort()
    else callerSignal.addEventListener('abort', forwardAbort, { once: true })
  }
  init.signal = controller.signal

  try {
    return await exchange<T>(url, init, () => timedOut)
  } finally {
    clearTimeout(timer)
    callerSignal?.removeEventListener('abort', forwardAbort)
  }
}
```

4. 원래 `request` 함수의 나머지 몸통(`let response: Response`부터 마지막 `return { ok: true, … }`까지)을 새 함수 `exchange`로 옮기고, 두 `catch`의 앞머리에 타임아웃 갈래를 더한다:

```ts
/** 타임아웃으로 끊긴 요청의 결과. 백엔드가 응답하지 못한 것이라 문구를 앱이 갖는다. */
function timeoutResult<T>(cause?: string): JsonApiResult<T> {
  return {
    ok: false,
    status: 0,
    errors: synthesizeError(0, 'REQUEST_TIMEOUT', 'The backend did not respond in time.', cause),
  }
}

async function exchange<T>(
  url: string,
  init: RequestInit,
  timedOut: () => boolean,
): Promise<JsonApiResult<T>> {
  let response: Response
  try {
    response = await fetch(url, init)
  } catch (error) {
    if (timedOut()) return timeoutResult(causeOf(error))
    return {
      ok: false,
      status: 0,
      errors: synthesizeError(
        0,
        'NETWORK_ERROR',
        'The backend could not be reached.',
        causeOf(error),
      ),
    }
  }

  if (response.status === 204) {
    return { ok: true, status: 204, document: null }
  }

  let parsed: unknown
  try {
    parsed = await response.json()
  } catch (error) {
    if (timedOut()) return timeoutResult(causeOf(error))
    return {
      ok: false,
      status: response.status,
      errors: synthesizeError(
        response.status,
        'NON_JSONAPI_RESPONSE',
        'The backend did not return a JSON:API document.',
      ),
    }
  }

  // 상태 코드와 본문이 어긋나면 본문을 믿는다.
  if (isErrorDocument(parsed)) {
    return { ok: false, status: response.status, errors: parsed.errors }
  }

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      errors: synthesizeError(
        response.status,
        'NON_JSONAPI_RESPONSE',
        'The backend returned an error without a JSON:API error document.',
      ),
    }
  }

  return { ok: true, status: response.status, document: parsed as T }
}
```

원본의 204 분기·오류 문서 분기에 붙어 있던 긴 설명 주석은 `exchange` 안의 같은 자리로 그대로 옮긴다(원본과 비교할 때 주석이 사라진 것으로 보이지 않게 한다).

- [ ] **Step 6: 통과를 확인한다**

```bash
pnpm test -- test/unit/jsonapi/client.test.ts test/unit/jsonapi/error-routing.test.ts
pnpm typecheck && pnpm lint
```

Expected: PASS. `error-routing.test.ts`는 합성 코드가 `transport`로 분류되는지를 이미 재므로 `REQUEST_TIMEOUT`도 `isSyntheticError`를 거쳐 같은 갈래로 간다.

- [ ] **Step 7: 이탈을 기록하고 문서를 고친다**

`docs/provenance/copied-core.json`의 `divergences`에 더한다:

```json
{
  "path": "lib/jsonapi/client.ts",
  "what": "fetch 에 cache: 'no-store' 를 넘기지 않는다.",
  "why": "RN 0.86.3 의 fetch 는 whatwg-fetch 3.6.20 polyfill 이고, 그 Request 는 cache 가 no-store·no-cache 인 GET·HEAD 의 URL 끝에 `_=<시각>` 을 덧붙인다(fetch.js:398-407, 2026-09-30 확인). JSON:API 요청 URL 은 백엔드의 쿼리 문법 검사를 거치므로 바뀌면 안 된다. 캐시 정책은 TanStack Query 가 소유한다(스펙 8.5)."
},
{
  "path": "lib/jsonapi/client.ts",
  "what": "REQUEST_TIMEOUT_MS(15초)와 합성 코드 REQUEST_TIMEOUT 을 더했다. 타임아웃과 호출자 signal 을 AbortController 하나로 합치고, 응답 대기·본문 읽기를 exchange() 로 옮겨 두 catch 에 타임아웃 갈래를 더했다. 호출자가 끊은 요청은 기존대로 NETWORK_ERROR 다.",
  "why": "모바일 네트워크는 거절하지 않고 멈추는 경우가 많아 멈춘 요청이 스피너를 끝없이 돌린다(스펙 8.5). 어드민 템플릿이 회전 요청에만 둔 타임아웃과 같은 이유를 모든 요청으로 넓혔다."
},
{
  "path": "test/unit/jsonapi/client.test.ts",
  "what": "'캐시를 쓰지 않는다' 를 cache 가 없고 URL 이 그대로인지로 바꿨다. 'signal 을 그대로 전달한다' 를 '호출자 signal 이 끊기면 요청도 끊긴다'·'이미 끊긴 signal 을 주면 요청이 시작부터 끊겨 있다' 로 바꿨다. 타임아웃 describe(6개)를 더했다.",
  "why": "위 두 이탈을 따라간다. 타임아웃이 자기 컨트롤러를 쓰므로 fetch 가 받는 signal 은 호출자의 것과 같은 객체가 아니다 - 지켜야 할 성질은 동일성이 아니라 중단의 전달이다."
}
```

`lib/jsonapi/AGENTS.md`의 "오류 문구 카탈로그를 두지 않는다" 절 끝에 더한다:

```markdown
합성 코드는 넷이다 - 원본의 `REQUEST_ASSEMBLY_FAILED`·`NETWORK_ERROR`·`NON_JSONAPI_RESPONSE`에
이 저장소가 더한 `REQUEST_TIMEOUT`(`REQUEST_TIMEOUT_MS` 15초, 스펙 8.5). 호출자가 `signal`로
끊은 요청은 타임아웃이 아니라 `NETWORK_ERROR`다.
```

- [ ] **Step 8: 전체를 돌리고 커밋한다**

```bash
pnpm format && pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && node scripts/check-provenance.mjs
git add -A
git commit -m "feat: HTTP 클라이언트에서 cache 옵션을 빼고 요청 타임아웃을 더한다"
```

---

### Task 7: E2E 스택 — compose와 시드

**Files:**
- Create: `docker-compose.e2e.yml`(복사·수정), `test/e2e/seed/README.md`·`examples.sql`·`examples.rails.sql`(복사), `test/unit/e2e/seed-mirror.test.ts`(복사)
- Modify: `package.json`(`compose:verify`), `docs/provenance/copied-core.json`

**Interfaces:**
- Produces: compose 프로젝트 `template-typescript-expo-e2e`, 프로파일 `fastapi`·`nestjs`·`rails`, 호스트 포트 `127.0.0.1:${E2E_API_PORT:-4100}`, 스크립트 `compose:verify`

- [ ] **Step 1: 시드 검사를 먼저 복사하고 실패를 본다**

```bash
SRC=../template-typescript-nextjs
REV=34d0b1057d65693645e75bec4e9558dcf6838822
copy() { mkdir -p "$(dirname "$1")"; git -C "$SRC" show "$REV:$1" > "$1"; }
copy test/unit/e2e/seed-mirror.test.ts
pnpm test -- test/unit/e2e/seed-mirror.test.ts
```

Expected: FAIL — 시드 파일이 없다.

- [ ] **Step 2: 시드를 복사하고 통과를 본다**

```bash
for f in test/e2e/seed/README.md test/e2e/seed/examples.sql test/e2e/seed/examples.rails.sql; do copy "$f"; done
pnpm test -- test/unit/e2e/seed-mirror.test.ts
```

Expected: PASS.

- [ ] **Step 3: compose 파일을 쓴다**

원본 `docker-compose.e2e.yml`에서 `web` 서비스를 빼고, 앱이 compose 밖(에뮬레이터·시뮬레이터)에 있다는 사실에 맞게 머리말과 주석을 다시 쓰고, `api-rails`의 `ALLOWED_HOSTS`에 에뮬레이터·시뮬레이터 주소를 더한 결과다. 서비스의 명령·환경 변수·헬스체크·`depends_on`은 원본과 같다.

`docker-compose.e2e.yml`:

```yaml
# E2E 스택 - Postgres + Redis + 백엔드(FastAPI·NestJS·Rails 중 하나) + 마이그레이션 + 시드.
#
# 앱은 이 파일에 없다. 앱은 Android 에뮬레이터·iOS 시뮬레이터에서 돌고, 호스트에
# 공개된 API 포트로 백엔드에 닿는다(스펙 11.4). 이 파일은 template-typescript-nextjs 의
# docker-compose.e2e.yml 에서 `web` 서비스를 뺀 것이다 - 출처 커밋과 달라진 곳은
# docs/provenance/copied-core.json 이 갖는다.
#
# 백엔드는 GitHub `main` 을 git 컨텍스트로 빌드한다. 형제 디렉터리를 컨텍스트로 삼으면
# 이 저장소만 클론한 사람은 E2E 를 돌릴 수 없다. 백엔드 `main` 이 바뀐 뒤에는 `--pull`
# 로 다시 빌드해야 최신 코드가 검증된다(스펙 11.4).
#
# ## 프로파일
#
# 백엔드마다 `migrate-*`·`api-*`·`seed-*` 가 자기 이름의 프로파일에 묶여 있다. 활성
# 프로파일이 없으면 그 서비스들은 전부 건너뛰어진다 - 손으로 띄울 때는 하나를 고른다:
#
#   docker compose --profile fastapi -f docker-compose.e2e.yml up -d --build --wait
#   docker compose --profile nestjs  -f docker-compose.e2e.yml up -d --build --wait
#   docker compose --profile rails   -f docker-compose.e2e.yml up -d --build --wait
#
# 내릴 때는 세 프로파일을 모두 준다. `down` 도 활성 프로파일만 대상으로 삼아서, 띄운
# 것과 다른 프로파일로 내리면 컨테이너가 남는다(원본 저장소의 실측):
#
#   docker compose --profile fastapi --profile nestjs --profile rails \
#     -f docker-compose.e2e.yml down -v --remove-orphans
#
# 프로파일을 동시에 둘 올리지 않는다. 세 `api-*` 가 같은 호스트 포트와 네트워크 별칭
# `api` 를 쓴다 - 앱이 보는 주소가 세 백엔드에서 똑같은 이유다(어댑터가 없다).
#
# `--wait` 가 성립하려면 `restart: 'no'` 인 `seed-*` 를 누군가
# `condition: service_completed_successfully` 로 참조해야 한다. 참조되지 않은 채
# 끝나면(exit 0 이어도) `up --wait` 가 예기치 않은 정지로 보고 실패한다(원본 저장소의
# 실측). 각 `api-*` 가 같은 프로파일의 `seed-*` 를 기다리는 이유다.
#
# ## 포트
#
# 호스트에는 API 하나만 `E2E_API_PORT`(기본 4100)로 공개한다. 4000 은 개발 머신의 다른
# 스택이 쓴다. `host_ip` 는 루프백이다 - Android 에뮬레이터의 `10.0.2.2` 는 호스트
# 루프백으로 가고, iOS 시뮬레이터는 호스트의 `localhost` 를 그대로 쓴다. DB·Redis 는
# 공개하지 않는다.

# 프로젝트 이름을 명시한다. 다른 이름으로 클론한 사람의 `down` 이 자기가 띄운 것을 찾게
# 하고, 개발 머신의 다른 compose 스택과 섞이지 않게 한다 - 정리 명령은 이 프로젝트만 내린다.
name: template-typescript-expo-e2e

# Rails 는 빌드 컨텍스트와 환경 변수 대부분을 `migrate-rails`·`api-rails` 가 공유한다.
x-rails-build: &rails-build
  context: https://github.com/builder-shin/template-ruby-rails.git#main
  # development 스테이지여야 한다. 아래 DEV_DATABASE_* 는 database.yml 의 development
  # 블록만 읽고, production 스테이지는 development 그룹 젬을 받지 않아 부팅이 죽는다
  # (원본 저장소의 실측).
  target: development

x-rails-env: &rails-env
  RAILS_ENV: development
  DATABASE_HOST: db
  DATABASE_PORT: '5432'
  # 롤은 FastAPI 와 공유하고 DB 이름은 따로 준다 - db:prepare 가 새로 만들어야 시드가 돈다.
  DEV_DATABASE_USERNAME: fastapi
  DEV_DATABASE_PASSWORD: fastapi
  DEV_DATABASE_NAME: rails_e2e_template
  # db:prepare 가 test DB 까지 준비하려다 빈 비밀번호로 죽는 것을 막는다(Rails 저장소의
  # docker-compose.yml 과 같은 값).
  SKIP_TEST_DATABASE: '1'
  # config/secrets.yml 이 기본값 없이 읽는다. E2E 전용 더미다.
  SECRET_KEY_BASE: e2e-only-rails-secret-key-base-dummy-value-not-for-production
  # 32바이트 이상이어야 한다. E2E 전용 값이다.
  JWT_SECRET_KEY: e2e-only-jwt-secret-key-at-least-32-bytes-long
  JWT_ISSUER: template-ruby-rails
  JWT_AUDIENCE: template-ruby-rails
  ACTIVE_STORAGE_SERVICE: local
  ACTIVE_JOB_QUEUE_ADAPTER: sidekiq
  PORT: '4000'

services:
  # 세 프로파일이 공유하는 Postgres 서버. FastAPI·NestJS 는 `fastapi_template` 을
  # 공유하고(테이블 이름까지 같다), Rails 는 db:prepare 가 만드는 `rails_e2e_template` 을 쓴다.
  db:
    image: postgres:18-alpine
    environment:
      POSTGRES_USER: fastapi
      POSTGRES_PASSWORD: fastapi
      POSTGRES_DB: fastapi_template
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U fastapi -d fastapi_template']
      interval: 2s
      timeout: 3s
      retries: 30

  redis:
    image: redis:8-alpine
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 2s
      timeout: 2s
      retries: 15
      start_period: 5s

  # ── FastAPI(정본) ──────────────────────────────────────────────────
  migrate-fastapi:
    profiles: [fastapi]
    build: https://github.com/builder-shin/template-python-fastapi.git#main
    command: ['alembic', 'upgrade', 'head']
    environment:
      DATABASE_URL: postgresql+psycopg://fastapi:fastapi@db:5432/fastapi_template
    depends_on:
      db:
        condition: service_healthy
    restart: 'no'

  api-fastapi:
    profiles: [fastapi]
    build: https://github.com/builder-shin/template-python-fastapi.git#main
    environment:
      DATABASE_URL: postgresql+psycopg://fastapi:fastapi@db:5432/fastapi_template
      REDIS_URL: redis://redis:6379/0
      # 32바이트 이상이어야 한다. E2E 전용 값이다.
      JWT_SECRET_KEY: e2e-only-jwt-secret-key-at-least-32-bytes-long
      JWT_ISSUER: template-python-fastapi
      JWT_AUDIENCE: template-python-fastapi
    networks:
      default:
        aliases: [api]
    # 앱(에뮬레이터·시뮬레이터)과 계약 거울(호스트의 vitest)이 이 포트로 닿는다.
    ports:
      - target: 4000
        published: '${E2E_API_PORT:-4100}'
        host_ip: 127.0.0.1
        protocol: tcp
    depends_on:
      migrate-fastapi:
        condition: service_completed_successfully
      # 파일 머리말의 `--wait` 절 - 같은 프로파일의 seed 를 여기서 참조한다. 부수 효과로
      # 시드가 끝난 뒤에 api 가 뜬다.
      seed-fastapi:
        condition: service_completed_successfully
      # 정본은 오늘 기동 시점에 redis 에 붙지 않지만, REDIS_URL 을 주는 이상 redis 를 쓰는
      # 경로가 열리는 순간 순서가 흔들림으로 나타난다 - 헬스체크 하나로 미리 막는다.
      redis:
        condition: service_healthy

  # 목록·필터·정렬·상세가 볼 행을 넣는다. 서비스로 두는 이유: 손으로 `up` 한 사람도 같은
  # 데이터를 보고, compose:verify 가 이 단계까지 검사한다. 디렉터리째 읽기 전용으로 걸고
  # ON_ERROR_STOP=1 로 SQL 오류에서 컨테이너가 죽게 한다.
  seed-fastapi:
    profiles: [fastapi]
    image: postgres:18-alpine
    environment:
      PGHOST: db
      PGUSER: fastapi
      PGPASSWORD: fastapi
      PGDATABASE: fastapi_template
    command: ['psql', '-v', 'ON_ERROR_STOP=1', '-f', '/probe-seed/examples.sql']
    volumes:
      - ./test/e2e/seed:/probe-seed:ro
    depends_on:
      migrate-fastapi:
        condition: service_completed_successfully
    restart: 'no'

  # ── NestJS ──────────────────────────────────────────────────────────
  migrate-nestjs:
    profiles: [nestjs]
    build: https://github.com/builder-shin/template-typescript-nestjs.git#main
    command:
      ['node', 'node_modules/typeorm/cli.js', 'migration:run', '-d', 'dist/config/data-source.js']
    environment:
      # db 서버·자격증명을 FastAPI 와 공유한다(테이블 이름이 같아 시드도 공유한다).
      # NestJS 는 DATABASE_URL 하나만 읽고 스킴만 다르다.
      DATABASE_URL: postgres://fastapi:fastapi@db:5432/fastapi_template
    depends_on:
      db:
        condition: service_healthy
    restart: 'no'

  api-nestjs:
    profiles: [nestjs]
    build: https://github.com/builder-shin/template-typescript-nestjs.git#main
    environment:
      DATABASE_URL: postgres://fastapi:fastapi@db:5432/fastapi_template
      PORT: '4000'
      # 32바이트 이상. api-fastapi 와 같은 더미 값이다.
      JWT_SECRET_KEY: e2e-only-jwt-secret-key-at-least-32-bytes-long
      JWT_ISSUER: template-typescript-nestjs
      JWT_AUDIENCE: template-typescript-nestjs
      # redis 불필요 - NestJS 의 api 는 REDIS_URL 을 읽지 않는다(워커 전용).
    networks:
      default:
        aliases: [api]
    ports:
      - target: 4000
        published: '${E2E_API_PORT:-4100}'
        host_ip: 127.0.0.1
        protocol: tcp
    depends_on:
      migrate-nestjs:
        condition: service_completed_successfully
      seed-nestjs:
        condition: service_completed_successfully

  seed-nestjs:
    profiles: [nestjs]
    image: postgres:18-alpine
    environment:
      PGHOST: db
      PGUSER: fastapi
      PGPASSWORD: fastapi
      PGDATABASE: fastapi_template
    command: ['psql', '-v', 'ON_ERROR_STOP=1', '-f', '/probe-seed/examples.sql']
    volumes:
      - ./test/e2e/seed:/probe-seed:ro
    depends_on:
      migrate-nestjs:
        condition: service_completed_successfully
    restart: 'no'

  # ── Rails ───────────────────────────────────────────────────────────
  migrate-rails:
    profiles: [rails]
    build: *rails-build
    command: ['bin/rails', 'db:prepare']
    environment: *rails-env
    depends_on:
      db:
        condition: service_healthy
    restart: 'no'

  api-rails:
    profiles: [rails]
    build: *rails-build
    environment:
      <<: *rails-env
      # Rails 는 Host 헤더를 검사한다(config.hosts 를 이 값으로 채운다 - 목록에 없으면
      # `403 Blocked hosts`, 원본 저장소의 실측). 여기 넷이 필요하다:
      #   api:4000                  compose 안의 헬스체크가 자기 자신을 부르는 이름
      #   127.0.0.1:<E2E_API_PORT>  호스트의 계약 거울(vitest)
      #   10.0.2.2:<E2E_API_PORT>   Android 에뮬레이터의 앱 - 에뮬레이터가 호스트를 부르는 주소
      #   localhost:<E2E_API_PORT>  iOS 시뮬레이터의 앱
      # 포트는 아래 ports.published 와 같은 변수를 참조한다 - 포트를 한 곳에서만 정한다.
      ALLOWED_HOSTS: 'api:4000,127.0.0.1:${E2E_API_PORT:-4100},10.0.2.2:${E2E_API_PORT:-4100},localhost:${E2E_API_PORT:-4100}'
    # development 스테이지에는 Dockerfile 의 HEALTHCHECK 가 없다. localhost 가 아니라
    # api:4000 으로 찌른다 - development.rb 는 /health 도 Host 검사를 받는다(원본 저장소의 실측).
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://api:4000/health/ready']
      interval: 5s
      timeout: 3s
      retries: 20
      start_period: 10s
    networks:
      default:
        aliases: [api]
    ports:
      - target: 4000
        published: '${E2E_API_PORT:-4100}'
        host_ip: 127.0.0.1
        protocol: tcp
    depends_on:
      migrate-rails:
        condition: service_completed_successfully
      seed-rails:
        condition: service_completed_successfully

  seed-rails:
    profiles: [rails]
    # Rails 는 분류·라벨·조인 테이블 이름이 달라 전용 시드를 쓴다(test/e2e/seed/README.md).
    image: postgres:18-alpine
    environment:
      PGHOST: db
      PGUSER: fastapi
      PGPASSWORD: fastapi
      PGDATABASE: rails_e2e_template
    command: ['psql', '-v', 'ON_ERROR_STOP=1', '-f', '/probe-seed/examples.rails.sql']
    volumes:
      - ./test/e2e/seed:/probe-seed:ro
    depends_on:
      migrate-rails:
        condition: service_completed_successfully
    restart: 'no'
```

- [ ] **Step 4: 정적 검증 스크립트를 더하고 돌린다**

`package.json`의 `scripts`에 더한다:

```json
"compose:verify": "docker compose --profile fastapi --profile nestjs --profile rails -f docker-compose.e2e.yml config --quiet"
```

```bash
pnpm compose:verify && echo "compose ok"
```

Expected: `compose ok`. 세 프로파일을 모두 준다 — 프로파일을 안 주면 프로파일이 붙은 서비스 아홉이 검증에서 빠진다(원본 저장소의 실측).

- [ ] **Step 5: FastAPI 스택을 띄워 호스트에서 닿는지 본다**

```bash
docker ps --filter name=joon- -q | wc -l
docker compose --profile fastapi -f docker-compose.e2e.yml up -d --build --wait
curl -fsS -o /dev/null -w "fastapi health %{http_code} %{content_type}\n" http://127.0.0.1:4100/health/ready
docker compose --profile fastapi --profile nestjs --profile rails -f docker-compose.e2e.yml down -v --remove-orphans
docker ps --filter name=joon- -q | wc -l
```

Expected: 처음과 끝의 joon 컨테이너 수가 `9`, `fastapi health 200 application/vnd.api+json`.

- [ ] **Step 6: Rails의 Host 검사가 에뮬레이터·시뮬레이터 주소를 받는지 본다**

```bash
docker compose --profile rails -f docker-compose.e2e.yml up -d --build --wait
for host in "10.0.2.2:4100" "localhost:4100" "127.0.0.1:4100" "probe-evil.example:4100"; do
  printf "%-26s " "$host"
  curl -s -o /dev/null -w "%{http_code}\n" -H "Host: $host" http://127.0.0.1:4100/health/ready
done
docker compose --profile fastapi --profile nestjs --profile rails -f docker-compose.e2e.yml down -v --remove-orphans
docker ps --filter name=joon- -q | wc -l
```

Expected: 앞의 셋은 `200`, `probe-evil.example:4100`은 `403` — 검사가 켜져 있고 우리가 더한 값이 그 검사를 통과한다는 대조군이다. 마지막 줄은 `9`.

- [ ] **Step 7: 출처 기록을 더하고 커밋한다**

`docs/provenance/copied-core.json`의 `paths`에 `"docker-compose.e2e.yml"`, `"test/e2e/seed/README.md"`, `"test/e2e/seed/examples.sql"`, `"test/e2e/seed/examples.rails.sql"`, `"test/unit/e2e/seed-mirror.test.ts"`를 더하고, `divergences`에 더한다:

```json
{
  "path": "docker-compose.e2e.yml",
  "what": "web 서비스를 뺐다. 프로젝트 이름을 template-typescript-expo-e2e 로 바꿨다. 머리말과 주석을 '앱은 compose 밖의 에뮬레이터·시뮬레이터에서 돈다' 에 맞게 다시 썼고, NestJS 저장소가 비공개라는 원본의 문단을 지웠다. 서비스의 명령·환경 변수·헬스체크·depends_on 은 그대로다.",
  "why": "앱이 컨테이너가 아니다(스펙 11.4). NestJS 저장소는 2026-09-30 에 공개다(gh repo view)."
},
{
  "path": "docker-compose.e2e.yml",
  "what": "api-rails 의 ALLOWED_HOSTS 에 10.0.2.2:${E2E_API_PORT:-4100} 과 localhost:${E2E_API_PORT:-4100} 을 더했다.",
  "why": "Rails 는 Host 헤더를 검사하고 목록 밖은 403 이다. Android 에뮬레이터의 앱은 Host: 10.0.2.2:4100, iOS 시뮬레이터의 앱은 Host: localhost:4100 으로 요청한다. 2026-09-30 에 네 Host 로 잰 결과: 세 값 200, 목록 밖 값 403."
}
```

```bash
node scripts/check-provenance.mjs && pnpm test && pnpm format:check
git add -A
git commit -m "feat: 세 백엔드 E2E 스택과 시드를 복사하고 Rails 의 에뮬레이터 Host 를 연다"
```

---

### Task 8: 기기 실측 — Maestro, 대괄호 파라미터, 로캘, 평문 HTTP, 타임아웃 (M2·M3·M4·M6·M8)

**Files:**
- Create (영구): `platform/config.ts`, `components/app/fatal-config.tsx`
- Modify (영구): `app/_layout.tsx`, `package.json`(expo-localization), 실측 기록
- Create → 삭제 (실측 전용): `app/(lab)/probe.tsx`, `test/e2e/measure/m2-params.yaml`·`m2-params-raw.yaml`·`m3-locale.yaml`·`m4-health.yaml`·`m6-abort.yaml`

**Interfaces:**
- Consumes: `setSettingsSource`·`getSettings`(Task 3), `request`(Task 6), `test/e2e/android.sh`(Task 4), compose(Task 7)
- Produces: `loadStartupSettings(): StartupSettings` where `type StartupSettings = { ok: true; settings: Settings } | { ok: false; message: string }` (`platform/config.ts`), `FatalConfig({ message }: { message: string })` (`components/app/fatal-config.tsx`)

- [ ] **Step 1: 설정 자리를 extra로 돌리는 바인딩을 쓴다 (영구)**

`platform/config.ts`:

```ts
import Constants from 'expo-constants'

import { getSettings, setSettingsSource, type Settings } from '@/lib/config/settings'

/**
 * 설정의 자리를 app.config.ts 의 extra 로 돌리고, 시작할 때 한 번 검증한다(스펙 10.1).
 *
 * 값은 빌드 시점에 이미 검증됐지만 OTA 로 들어온 설정까지 대비해 다시 본다. 실패하면
 * 던지지 않고 결과로 돌려준다 - 루트 레이아웃이 그것을 치명 오류 화면으로 그린다.
 */
export type StartupSettings = { ok: true; settings: Settings } | { ok: false; message: string }

function extraString(key: string): string | undefined {
  const extra: Record<string, unknown> | undefined = Constants.expoConfig?.extra
  const value = extra?.[key]
  return typeof value === 'string' ? value : undefined
}

export function loadStartupSettings(): StartupSettings {
  setSettingsSource(() => ({ BACKEND_URL: extraString('backendUrl') }))
  try {
    return { ok: true, settings: getSettings() }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) }
  }
}
```

`components/app/fatal-config.tsx`:

```tsx
import { View } from 'react-native'

import { Text } from '@/components/ui/text'

/**
 * 설정 오류로 앱을 시작할 수 없을 때의 화면(스펙 10.1). 문구는 검증 함수가 낸 원문이라
 * 변수 이름이 들어 있다.
 */
export function FatalConfig({ message }: { message: string }) {
  return (
    <View testID="fatal-config" className="flex-1 items-center justify-center bg-background p-6">
      <Text variant="h4">설정 오류</Text>
      <Text className="mt-2 text-center text-muted-foreground">{message}</Text>
    </View>
  )
}
```

`app/_layout.tsx`의 import 끝에 두 줄을 더하고, 모듈 수준에서 한 번 검증하고, 실패하면 치명 오류 화면을 그린다:

```tsx
import { FatalConfig } from '@/components/app/fatal-config'
import { loadStartupSettings } from '@/platform/config'

// 모듈 평가 시점에 한 번 - 어떤 요청보다 먼저 설정 자리를 extra 로 돌린다.
const STARTUP = loadStartupSettings()
```

`RootLayout` 몸통의 `return` 앞:

```tsx
  if (!STARTUP.ok) {
    return (
      <ThemeProvider value={NAV_THEME[scheme]}>
        <FatalConfig message={STARTUP.message} />
      </ThemeProvider>
    )
  }
```

```bash
pnpm exec expo install expo-localization
pnpm typecheck && pnpm lint
```

- [ ] **Step 2: M8 — Maestro를 설치하고 Git Bash에서 돌려 본다**

```bash
if [ -x "$HOME/.maestro/bin/maestro" ]; then "$HOME/.maestro/bin/maestro" --version; fi
```

이미 설치돼 있고 버전이 `2.11.0`이 아니면 멈추고 사용자에게 알린다 — 사용자의 설치를 덮어쓰지 않는다. 없으면:

```bash
TMP=$(mktemp -d)
curl -fL -o "$TMP/maestro.zip" https://github.com/mobile-dev-inc/maestro/releases/download/cli-2.11.0/maestro.zip
curl -fL -o "$TMP/checksums_sha256.txt" https://github.com/mobile-dev-inc/maestro/releases/download/cli-2.11.0/checksums_sha256.txt
(cd "$TMP" && sha256sum -c checksums_sha256.txt)
unzip -q "$TMP/maestro.zip" -d "$TMP/unzipped"
mkdir -p "$HOME/.maestro"
cp -r "$TMP/unzipped/maestro/." "$HOME/.maestro/"
"$HOME/.maestro/bin/maestro" --version; echo "exit=$?"
```

Expected (M8 = 예): `sha256sum -c`가 `maestro.zip: OK`, 마지막 명령이 `2.11.0`과 `exit=0`. 설치 위치 `~/.maestro/bin`은 공식 Unix 설치 스크립트와 같은 자리다.

셸 스크립트 런처가 Git Bash에서 실패하면(`java` 경로·classpath 구분자 오류 등) 다음을 재고 둘 다 기록한다:

```bash
cmd //c "$(cygpath -w "$HOME/.maestro/bin/maestro.bat")" --version; echo "exit=$?"
```

이후 단계의 `maestro`는 M8에서 동작한 쪽이다. 아래 명령은 `MAESTRO="$HOME/.maestro/bin/maestro"`로 쓴다.

- [ ] **Step 3: 실측 화면을 만든다 (실측 전용)**

`app/(lab)/probe.tsx`:

```tsx
import Constants from 'expo-constants'
import { getLocales } from 'expo-localization'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { ScrollView, View } from 'react-native'

import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { request } from '@/lib/jsonapi/client'

/**
 * D1 실측 전용 화면(M2·M3·M4·M6). 실측 기록을 남긴 뒤 다음 커밋에서 지운다 - 결과는
 * docs/superpowers/notes/2026-09-30-d1-measurements.md 에 있다. 계층 규칙(app/ 은
 * fetch·request 를 부르지 않는다)을 일부러 어긴다 - 이 화면은 제품이 아니라 계측기다.
 */
const BLACKHOLE_URL = 'http://10.0.2.2:4199/'
const PROBE_ABORT_MS = 2_000

async function probeAbort(): Promise<string> {
  const controller = new AbortController()
  const started = Date.now()
  const timer = setTimeout(() => {
    controller.abort()
  }, PROBE_ABORT_MS)
  try {
    await fetch(BLACKHOLE_URL, { signal: controller.signal })
    return `resolved ${Date.now() - started}ms`
  } catch (error) {
    return `${error instanceof Error ? error.name : 'unknown'} ${Date.now() - started}ms`
  } finally {
    clearTimeout(timer)
  }
}

async function probeHealth(): Promise<string> {
  const result = await request('/health/ready')
  return result.ok ? `ok ${result.status}` : `fail ${result.status} ${result.errors[0]?.code ?? ''}`
}

export default function ProbeScreen() {
  const params = useLocalSearchParams()
  const [health, setHealth] = useState('')
  const [abort, setAbort] = useState('')
  const locales = getLocales()
    .map((locale) => locale.languageTag)
    .join(',')

  return (
    <ScrollView>
      <View className="gap-3 p-4">
        <Text testID="probe-params">{JSON.stringify(params)}</Text>
        <Button
          testID="probe-set-params"
          onPress={() => {
            router.setParams({ 'filter[status]': 'archived', 'filter[title][contains]': 'a b' })
          }}
        >
          <Text>setParams</Text>
        </Button>
        <Text testID="probe-locales">{locales}</Text>
        <Text testID="probe-extra">{JSON.stringify(Constants.expoConfig?.extra ?? null)}</Text>
        <Button
          testID="probe-health"
          onPress={() => {
            void probeHealth().then(setHealth)
          }}
        >
          <Text>health</Text>
        </Button>
        <Text testID="probe-health-result">{health}</Text>
        <Button
          testID="probe-abort"
          onPress={() => {
            void probeAbort().then(setAbort)
          }}
        >
          <Text>abort</Text>
        </Button>
        <Text testID="probe-abort-result">{abort}</Text>
      </View>
    </ScrollView>
  )
}
```

`router.setParams`의 인자 타입이 typed routes 때문에 맞지 않으면 인자에 `as never`를 붙인다(계측기라 타입 정밀도가 필요 없다).

```bash
pnpm types:routes && pnpm typecheck
```

- [ ] **Step 4: 실측 플로 다섯을 쓴다 (실측 전용)**

`test/e2e/measure/m2-params.yaml`:

```yaml
appId: com.example.templateexpo.e2e
---
- launchApp:
    clearState: true
- openLink: templateexpo-e2e://probe?filter%5Bstatus%5D=active&filter%5Btitle%5D%5Bcontains%5D=a%20b&sort=-createdAt
- copyTextFrom:
    id: probe-params
- evalScript: ${console.log('M2 encoded deep link params: ' + maestro.copiedText)}
- assertVisible:
    id: probe-params
    text: '.*"filter\[status\]":"active".*'
- assertVisible:
    id: probe-params
    text: '.*"filter\[title\]\[contains\]":"a b".*'
- tapOn:
    id: probe-set-params
- copyTextFrom:
    id: probe-params
- evalScript: ${console.log('M2 after setParams: ' + maestro.copiedText)}
- assertVisible:
    id: probe-params
    text: '.*"filter\[status\]":"archived".*'
```

`test/e2e/measure/m2-params-raw.yaml` — 대괄호를 인코딩하지 않은 딥링크:

```yaml
appId: com.example.templateexpo.e2e
---
- launchApp:
    clearState: true
- openLink: templateexpo-e2e://probe?filter[status]=active&sort=-createdAt
- copyTextFrom:
    id: probe-params
- evalScript: ${console.log('M2 raw deep link params: ' + maestro.copiedText)}
- assertVisible:
    id: probe-params
    text: '.*"filter\[status\]":"active".*'
```

`test/e2e/measure/m3-locale.yaml`:

```yaml
appId: com.example.templateexpo.e2e
---
- launchApp:
    clearState: true
- openLink: templateexpo-e2e://probe
- copyTextFrom:
    id: probe-locales
- evalScript: ${console.log('M3 locales: ' + maestro.copiedText)}
- assertVisible:
    id: probe-locales
    text: '${EXPECTED_LOCALE}.*'
```

`test/e2e/measure/m4-health.yaml`:

```yaml
appId: com.example.templateexpo.e2e
---
- launchApp:
    clearState: true
- openLink: templateexpo-e2e://probe
- copyTextFrom:
    id: probe-extra
- evalScript: ${console.log('M4 extra: ' + maestro.copiedText)}
- tapOn:
    id: probe-health
- extendedWaitUntil:
    visible:
      id: probe-health-result
      text: 'ok 200'
    timeout: 20000
```

`test/e2e/measure/m6-abort.yaml`:

```yaml
appId: com.example.templateexpo.e2e
---
- launchApp:
    clearState: true
- openLink: templateexpo-e2e://probe
- tapOn:
    id: probe-abort
- extendedWaitUntil:
    visible:
      id: probe-abort-result
      text: '.+ \d+ms'
    timeout: 15000
- copyTextFrom:
    id: probe-abort-result
- evalScript: ${console.log('M6 abort: ' + maestro.copiedText)}
- assertVisible:
    id: probe-abort-result
    text: 'AbortError \d+ms'
```

- [ ] **Step 5: 스택·블랙홀 서버·APK를 준비한다**

```bash
docker ps --filter name=joon- -q | wc -l
docker compose --profile fastapi -f docker-compose.e2e.yml up -d --build --wait
```

연결은 받고 응답하지 않는 서버를 **백그라운드로** 띄운다(M6의 상대):

```bash
node -e "require('node:http').createServer(() => {}).listen(4199, '127.0.0.1', () => console.log('blackhole on 4199'))"
```

```bash
E2E_AVD=Pixel_9_API_36 test/e2e/android.sh boot
BACKEND_URL=http://10.0.2.2:4100 test/e2e/android.sh build 2>&1 | tail -5
test/e2e/android.sh install
mkdir -p .maestro-output
```

- [ ] **Step 6: M4 — 평문 HTTP로 백엔드에 닿는가**

```bash
MAESTRO="$HOME/.maestro/bin/maestro"
"$MAESTRO" test test/e2e/measure/m4-health.yaml 2>&1 | tee .maestro-output/m4.log | tail -20
```

Expected (M4 = 예): 통과, 로그에 `M4 extra: {"backendUrl":"http://10.0.2.2:4100","appVariant":"e2e"}`. 실패하면 화면의 `probe-health-result` 값(`fail 0 NETWORK_ERROR` 등)과 `adb logcat -d | grep -iE "cleartext|ReactNativeJS"`를 기록해 원인을 좁힌다 — `CLEARTEXT communication … not permitted`면 `usesCleartextTraffic`이 빌드에 들어가지 않은 것이다.

- [ ] **Step 7: M2 — 대괄호 키가 보존되는가**

```bash
"$MAESTRO" test test/e2e/measure/m2-params.yaml 2>&1 | tee .maestro-output/m2.log | tail -20
"$MAESTRO" test test/e2e/measure/m2-params-raw.yaml 2>&1 | tee .maestro-output/m2-raw.log | tail -20
```

두 플로의 통과 여부와 로그의 `M2 …` 줄 셋을 그대로 기록한다. 실패해도 멈추지 않는다 — 결과가 D3의 인코딩 규칙을 정한다.

- [ ] **Step 8: M6 — 타임아웃이 요청을 끊는가**

```bash
"$MAESTRO" test test/e2e/measure/m6-abort.yaml 2>&1 | tee .maestro-output/m6.log | tail -20
```

Expected (M6 = 예): 통과, `M6 abort: AbortError <약 2000>ms`. `resolved`거나 15초 안에 결과가 없으면 M6 = 아니오다 — 기록하고 멈춘다.

- [ ] **Step 9: M3 — 기기 로캘을 바꿀 수 있는가**

첫 방법 — Maestro의 `--device-locale`:

```bash
"$MAESTRO" test --device-locale en-US -e EXPECTED_LOCALE=en-US test/e2e/measure/m3-locale.yaml 2>&1 | tee .maestro-output/m3-en.log | tail -15
"$MAESTRO" test --device-locale ko-KR -e EXPECTED_LOCALE=ko-KR test/e2e/measure/m3-locale.yaml 2>&1 | tee .maestro-output/m3-ko.log | tail -15
```

둘 다 통과하면 M3 = 예(방법: `--device-locale`). 실패하면 둘째 방법 — Android 13+ 앱별 언어:

```bash
ADB="$ANDROID_HOME/platform-tools/adb"
"$ADB" shell cmd locale set-app-locales com.example.templateexpo.e2e --locales en-US
"$MAESTRO" test -e EXPECTED_LOCALE=en-US test/e2e/measure/m3-locale.yaml 2>&1 | tail -15
"$ADB" shell cmd locale set-app-locales com.example.templateexpo.e2e --locales ko-KR
"$MAESTRO" test -e EXPECTED_LOCALE=ko-KR test/e2e/measure/m3-locale.yaml 2>&1 | tail -15
```

그것도 실패하면 셋째 — 에뮬레이터 시스템 로캘(루트가 되는 이미지에서만):

```bash
"$ADB" root && "$ADB" shell "setprop persist.sys.locale en-US; setprop ctl.restart zygote"
test/e2e/android.sh boot
"$MAESTRO" test -e EXPECTED_LOCALE=en-US test/e2e/measure/m3-locale.yaml 2>&1 | tail -15
```

(`test/e2e/android.sh boot`은 기기가 다시 연결될 때까지 기다리는 용도다.) 세 방법 각각의 결과를 기록하고, 처음으로 동작한 방법을 "정한 것"에 적는다. 끝나면 기기 로캘을 원래대로(`ko-KR`) 돌려 둔다.

- [ ] **Step 10: 정리한다**

```bash
docker compose --profile fastapi --profile nestjs --profile rails -f docker-compose.e2e.yml down -v --remove-orphans
docker ps --filter name=joon- -q | wc -l
```

Expected: `9`. 백그라운드로 띄운 블랙홀 서버를 멈춘다.

- [ ] **Step 11: 실측을 기록하고, 계측기를 남긴 커밋을 만든다**

실측 기록의 M2·M3·M4·M6·M8 행과 절을 채운다 — 각 절에 명령, 로그의 `M… :` 줄, 통과 여부, 정한 것.

```bash
git add -A
git commit -m "test: 기기 실측(M2·M3·M4·M6·M8) 계측기와 결과를 남긴다"
PROBE_COMMIT=$(git rev-parse --short HEAD)
echo "$PROBE_COMMIT"
```

- [ ] **Step 12: 계측기를 지우는 커밋을 만든다**

```bash
git rm -r "app/(lab)/probe.tsx" test/e2e/measure
```

실측 기록 파일 맨 위 문단 끝에 한 줄을 더한다: `계측 화면과 플로는 커밋 <PROBE_COMMIT>에 있고 다음 커밋에서 지웠다 - 다시 재려면 그 커밋을 체크아웃한다.` (`<PROBE_COMMIT>`은 Step 11의 값.)

```bash
pnpm types:routes && pnpm typecheck && pnpm lint && pnpm test
git add -A
git commit -m "chore: 실측 계측기를 지운다"
```

---

### Task 9: 게이트와 마감

**Files:**
- Create: `scripts/check.sh`, `scripts/check-citations.sh`(복사·수정), `test/unit/scripts/check-citations.test.ts`(복사·수정)
- Modify: `package.json`(`check`·expo-doctor), `AGENTS.md`, `docs/provenance/copied-core.json`, `docs/superpowers/specs/2026-09-30-expo-jsonapi-template-design.md`(정정), 실측 기록

**Interfaces:**
- Produces: `./scripts/check.sh` — 정적 단계 11개; `./scripts/check-citations.sh <대상>...`

- [ ] **Step 1: 인용 검사와 그 테스트를 복사한다**

```bash
SRC=../template-typescript-nextjs
REV=34d0b1057d65693645e75bec4e9558dcf6838822
copy() { mkdir -p "$(dirname "$1")"; git -C "$SRC" show "$REV:$1" > "$1"; }
copy scripts/check-citations.sh
copy test/unit/scripts/check-citations.test.ts
chmod +x scripts/check-citations.sh
git add scripts/check-citations.sh && git update-index --chmod=+x scripts/check-citations.sh
```

- [ ] **Step 2: 테스트가 가리키는 대상 목록을 이 저장소의 것으로 바꾸고 실패를 본다**

`test/unit/scripts/check-citations.test.ts`에서:

```ts
const GATE_TARGETS = ['app', 'components', 'lib', 'test', 'proxy.ts'] as const
```

를 다음으로 바꾼다:

```ts
const GATE_TARGETS = ['app', 'components', 'lib', 'platform', 'test'] as const
```

`queries/`는 D3이 첫 파일을 만들 때 두 자리(여기와 `check.sh`)에 함께 더한다 — 없는 대상을 넘기면 검사가 grep 오류(2)로 빨강이 된다(원본 스크립트의 계약).

같은 파일의 주석·문자열에 원본 게이트의 단계 번호(`[5/9]`)가 나오면 이 저장소의 번호(`[5/11]`)로 바꾼다. 다른 곳은 고치지 않는다.

```bash
pnpm test -- test/unit/scripts/check-citations.test.ts
```

Expected: FAIL — `scripts/check.sh`가 없어 게이트가 부르는 대상을 읽지 못한다.

- [ ] **Step 3: expo-doctor를 고정하고 게이트를 쓴다**

```bash
pnpm add -D expo-doctor@1.20.4
```

`scripts/check.sh`:

```bash
#!/usr/bin/env bash
# 단일 검증 게이트 - 스펙 12장. 이 명령이 통과하면 통과다.
#
#   ./scripts/check.sh
#
# 형제 템플릿들의 scripts/check.sh 와 같은 계약이다. 지금 판은 정적 단계 열하나를
# 돈다. 계약 거울과 E2E 는 그것을 재는 화면·테스트가 생길 때 더한다 - 도는 척만 하는
# 단계를 미리 두지 않는다.
#
# ## 전제 조건
#
#   1. `pnpm install --frozen-lockfile` 이 끝나 있어야 한다.
#   2. Docker 가 돌고 있어야 한다 - [11] 이 쓴다.
#   3. [9] expo-doctor 는 네트워크가 필요하다(의존성 호환 목록을 받아 온다).
#
# ## 설정을 평가하는 단계가 쓰는 BACKEND_URL
#
# [1]·[8]·[10] 은 app.config.ts 를 평가하므로 BACKEND_URL 이 필요하다(스펙 10.1 - 없으면
# 멈춘다). 이 단계들은 백엔드에 닿지 않으므로 닿을 수 없는 주소(.invalid, RFC 6761)를
# 명시적으로 준다. https 라서 네 변형 모두의 규칙을 통과한다.
#
# ## 인용 단계가 훑는 대상
#
# 아래 [5] 의 대상 목록은 test/unit/scripts/check-citations.test.ts 가 이 파일의 소스를
# 읽어 그대로 맞댄다 - 대상을 바꾸려면 두 자리를 함께 고친다. scripts/ 와 docs/ 와 루트
# AGENTS.md 는 대상이 될 수 없다 - 규칙을 적으려면 금지된 패턴의 이름을 적어야 한다.
set -euo pipefail

cd "$(dirname "$0")/.."

GATE_BACKEND_URL='https://gate-check.invalid'

echo "=== [1/11] typecheck ==="
BACKEND_URL="$GATE_BACKEND_URL" pnpm types:routes
pnpm typecheck

echo "=== [2/11] lint ==="
pnpm lint

echo "=== [3/11] format ==="
pnpm format:check

echo "=== [4/11] secretlint ==="
pnpm secretlint

echo "=== [5/11] 인용 ==="
./scripts/check-citations.sh app components lib platform test

echo "=== [6/11] 복사 출처 ==="
node scripts/check-provenance.mjs

echo "=== [7/11] unit ==="
pnpm test

echo "=== [8/11] 설정 ==="
for variant in development preview production e2e; do
  echo "--- APP_VARIANT=$variant"
  APP_VARIANT="$variant" BACKEND_URL="$GATE_BACKEND_URL" pnpm exec expo config --type public --json >/dev/null
done

echo "=== [9/11] 의존성 호환 ==="
pnpm exec expo-doctor

echo "=== [10/11] 번들 ==="
APP_VARIANT=production BACKEND_URL="$GATE_BACKEND_URL" pnpm exec expo export --platform android --platform ios --output-dir dist

# 세 프로파일 전부를 정적 검증한다 - 프로파일을 안 주면 프로파일이 붙은 서비스 아홉이
# 활성 집합에서 빠져 한 번도 검증되지 않는다(원본 저장소의 실측). 이 단계는 YAML 문법·
# 참조 무결성·프로파일 소속까지만 본다 - 빌드 컨텍스트가 실재하는지는 보지 않는다.
echo "=== [11/11] compose ==="
pnpm compose:verify

echo "=== 전부 통과 ==="
```

```bash
chmod +x scripts/check.sh
git add scripts/check.sh && git update-index --chmod=+x scripts/check.sh
```

`package.json`의 `scripts`에 `"check": "./scripts/check.sh"`를 더한다.

- [ ] **Step 4: 인용 검사 테스트가 통과하는지 본다**

```bash
pnpm test -- test/unit/scripts/check-citations.test.ts
```

Expected: PASS.

- [ ] **Step 5: 게이트 전체를 돌린다**

```bash
mkdir -p .maestro-output
./scripts/check.sh 2>&1 | tee .maestro-output/gate.log | grep -E "^=== |error|Error|✖" | head -40; echo "gate exit=${PIPESTATUS[0]}"
```

Expected: `=== 전부 통과 ===`, `gate exit=0`. 실패하면 그 단계의 원인을 고친다 — 단계를 지우거나 건너뛰지 않는다. expo-doctor가 경고한 항목은 고치거나, 고칠 수 없는 이유(예: SDK 57과 호환 목록에 아직 없는 패키지)를 `package.json`의 `expo.doctor` 설정으로 제외하면서 그 이유를 실측 기록에 적는다.

- [ ] **Step 6: 출처 기록에 인용 검사를 더한다**

`docs/provenance/copied-core.json`의 `paths`에 `"scripts/check-citations.sh"`, `"test/unit/scripts/check-citations.test.ts"`를 더하고 `divergences`에 더한다:

```json
{
  "path": "test/unit/scripts/check-citations.test.ts",
  "what": "GATE_TARGETS 를 app·components·lib·platform·test 로 바꿨고, 원본 게이트의 단계 번호 표기를 이 저장소의 번호로 바꿨다.",
  "why": "이 저장소에는 proxy.ts 가 없고 platform/ 이 있다. 테스트는 check.sh 의 호출 인자와 이 목록을 맞대므로 둘이 같아야 한다. queries/ 는 첫 파일이 생길 때 두 자리에 함께 더한다."
}
```

`scripts/check-citations.sh`는 원본과 같다(대상을 인자로만 받는다) — 이탈이 없다.

```bash
node scripts/check-provenance.mjs
```

- [ ] **Step 7: 스펙에 날짜가 붙은 정정을 더한다**

`docs/superpowers/specs/2026-09-30-expo-jsonapi-template-design.md`에 다음 셋을 **결과와 무관하게** 더한다(각 절의 끝에 인용 블록으로):

3장 표 아래:

```markdown
> 정정(2026-09-30, D1): 품질 도구의 ESLint 는 **9**다(형제 저장소는 10). eslint-config-expo 57 이
> 의존하는 eslint-plugin-react 7.37·eslint-plugin-import 2.x 의 peer 가 ESLint 9 까지다. 그리고
> eslint-config-expo 위에 typescript-eslint 의 설정을 그대로 얹으면 `@typescript-eslint` 플러그인
> 재등록으로 ESLint 가 죽어서, typescript-eslint 에서는 규칙만 가져온다 - `eslint.config.js` 머리말.
```

6.3 끝:

```markdown
> 정정(2026-09-30, D1): 검사 스크립트는 `scripts/check-provenance.sh`가 아니라
> `scripts/check-provenance.mjs`다 - JSON 을 읽어야 해서 node 로 썼다. 검사하는 네 가지는 같다.
```

10.2 표 아래:

```markdown
> 정정(2026-09-30, D1): 딥링크 scheme 도 변형마다 다르다 - `templateexpo-dev`·`templateexpo-preview`·
> `templateexpo`(production)·`templateexpo-e2e`. 번들 ID 만 다르고 scheme 이 같으면, 한 기기에
> 여러 변형을 설치했을 때 딥링크가 어느 변형으로 갈지 정해지지 않는다. 표는 `lib/config/app-variant.ts`.
```

그리고 **실측 결과가 스펙과 어긋난 항목마다** 해당 절 끝에 같은 형식의 정정을 더한다. 최소한 다음을 확인한다.
- M3가 `--device-locale`이 아닌 방법으로 성립했다 → 11.3 "로캘 전환" 문단.
- M5가 hoisted를 택했다 → 3장.
- M7이 대체 경로를 택했다 → 10.1("검증 함수는 … 같은 것이다" 문장).
- M2에서 인코딩하지 않은 대괄호가 보존되지 않았다 → 8.2.

- [ ] **Step 8: 루트 `AGENTS.md`의 검증 명령을 게이트로 바꾼다**

`## 검증 명령` 절을 다음으로 바꾼다:

````markdown
## 검증 명령

```bash
pnpm install --frozen-lockfile
./scripts/check.sh
```

`./scripts/check.sh` 하나가 유일한 게이트다(typecheck · lint · format · secretlint · 인용 ·
복사 출처 · unit · 설정 · 의존성 호환 · 번들 · compose). 전제 조건(Docker, 네트워크)은 그
파일 머리말에 있다. 실행 권한이 살아 있어야 통과한다 - `git ls-tree HEAD scripts/`가
`100755`인지 확인한다. `core.filemode=false`인 머신에서는 권한이 빠져도 `git status`로
드러나지 않는다.

실측 기록은 `docs/superpowers/notes/2026-09-30-d1-measurements.md`다. 기기 위의 동작(M1–M8)이
궁금하면 거기부터 읽는다.
````

- [ ] **Step 9: 권한과 게이트를 마지막으로 확인하고 커밋한다**

```bash
git ls-tree HEAD scripts/ test/e2e/android.sh
./scripts/check.sh > /dev/null 2>&1; echo "gate exit=$?"
git add -A
git commit -m "feat: 정적 검증 게이트를 세우고 D1 실측을 스펙에 반영한다"
git ls-tree HEAD scripts/ test/e2e/android.sh
```

Expected: `scripts/check.sh`·`check-citations.sh`·`test/e2e/android.sh`가 `100755`, `gate exit=0`.

- [ ] **Step 10: 브랜치를 마무리한다**

REQUIRED SUB-SKILL: superpowers:finishing-a-development-branch. 이 저장소에는 아직 원격이 없다(GitHub 저장소는 D8에서 만든다) — 마무리 방식(`main`으로 병합 등)은 그 스킬의 선택지에서 사용자에게 묻는다.

---

## 이 계획이 끝났을 때의 상태

- `./scripts/check.sh`가 정적 단계 11개를 통과한다.
- 화면은 홈 하나다. 설정이 틀리면 치명 오류 화면이 뜬다.
- `lib/`에 Next.js의 플랫폼 중립 코어가 있고, 원본 테스트와 새 테스트가 node의 vitest에서 돈다. 복사한 모든 파일과 원본과 다른 곳이 `docs/provenance/copied-core.json`에 있고 게이트가 검사한다.
- `e2e` 변형 Release APK가 에뮬레이터에서 평문 HTTP로 FastAPI 스택에 닿는다는 것이 실측돼 있다(M4).
- M1–M8의 결과와 그로 인한 스펙 정정이 커밋돼 있다.

## 다음 계획

D2(세션과 인증)는 이 계획의 실측 기록을 읽고 쓴다. 특히:
- **M3의 결과**가 E2E의 로캘 전환 방법을 정한다 — 영어 기기에서 오류 문구에 한글이 없는지 보는 시나리오(스펙 9.4).
- **M4·M8**이 D2가 게이트에 더할 E2E 단계(Android + FastAPI)의 명령을 정한다. `test/e2e/android.sh`가 그 단계의 기기 도우미가 된다.
- **M6**이 스펙 8.5 타임아웃의 기기 동작을 보증한다.
- 복사해야 할 원본 파일: `lib/auth/credentials.ts`·`flow.ts`·`logout.ts`·`rotation.ts`·`form-state.ts`와 그 테스트, 그리고 E2E의 `test/e2e/probe-email.ts`.
