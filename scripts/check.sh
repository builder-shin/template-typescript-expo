#!/usr/bin/env bash
# 단일 검증 게이트 - 스펙 12장. 이 명령이 통과하면 통과다.
#
#   ./scripts/check.sh
#
# 형제 템플릿들의 scripts/check.sh 와 같은 계약이다. 정적 단계 열하나 뒤에 계약 거울(FastAPI 스택 +
# test/contract)과 E2E(Android 에뮬레이터 + FastAPI)를 돈다. 계약 거울은 앱도 기기도 쓰지 않아 E2E
# 앞에서 돈다 - 자원 선언이 백엔드와 어긋나면 APK 를 만들기 전에 멈춘다.
#
# ## 전제 조건
#
#   1. `pnpm install --frozen-lockfile` 이 끝나 있어야 한다.
#   2. Docker 가 돌고 있어야 한다 - [11]·[12]·[13] 이 쓴다.
#   3. [9] expo-doctor 는 네트워크가 필요하다(의존성 호환 목록을 받아 온다).
#   4. [10] 이 Metro·Uniwind 캐시를 지운다(--clear) - 돌리기 전에 이 저장소의 expo start 를 끈다.
#   5. [13] E2E 는 Android SDK(ANDROID_HOME), Maestro 2.11(PATH 또는 ~/.maestro/bin/maestro), 그리고
#      켜진 기기나 부팅할 AVD 이름(E2E_AVD)이 필요하다. 빠진 것이 있으면 무엇이 빠졌는지 알리고
#      멈춘다. Windows 에서 저장소 경로가 47자를 넘으면 짧은 경로(E2E_STAGE_DIR, 기본 C:/t/e)의
#      사본에서 APK 를 만든다 - test/e2e/run-android.sh 머리말.
#
# ## 설정을 평가하는 단계가 쓰는 BACKEND_URL
#
# [1]·[8]·[9]·[10] 은 app.config.ts 를 평가하므로 BACKEND_URL 이 필요하다(스펙 10.1 - 없으면
# 멈춘다). [9] expo-doctor 는 `expo config` 를 불러 설정을 평가한다(2026-09-30 실측: 값이 없으면
# `expo config --json --full` 이 exit 1 로 죽는다). 이 단계들은 백엔드에 닿지 않으므로 닿을 수
# 없는 주소(.invalid, RFC 6761)를 명시적으로 준다. https 라서 네 변형 모두의 규칙을 통과한다.
#
# ## 인용 단계가 훑는 대상
#
# 아래 [5] 의 대상 목록은 test/unit/scripts/check-citations.test.ts 가 이 파일의 소스를
# 읽어 그대로 맞댄다 - 대상을 바꾸려면 두 자리를 함께 고친다. scripts/ 와 docs/ 와 루트
# AGENTS.md 는 대상이 될 수 없다 - 규칙을 적으려면 금지된 패턴의 이름을 적어야 한다.
set -euo pipefail

cd "$(dirname "$0")/.."

GATE_BACKEND_URL='https://gate-check.invalid'
# [8] 이 OTA 를 켠 설정을 잴 때 쓰는 EAS 프로젝트 id. 모양만 UUID 이고 어떤 프로젝트도 아니다 - 설정 평가는 EAS 에
# 닿지 않는다.
GATE_EAS_PROJECT_ID='00000000-0000-4000-8000-000000000000'

echo "=== [1/13] typecheck ==="
BACKEND_URL="$GATE_BACKEND_URL" pnpm types:routes
pnpm typecheck

echo "=== [2/13] lint ==="
pnpm lint

echo "=== [3/13] format ==="
pnpm format:check

# package.json 의 스크립트 이름이 secretlint 이면 node_modules/.bin/secretlint 를 가려서 [9] 의
# expo-doctor 가 package.json 검사에서 실패한다 - 그래서 스크립트 이름은 lint:secrets 다.
echo "=== [4/13] secretlint ==="
pnpm lint:secrets

echo "=== [5/13] 인용 ==="
./scripts/check-citations.sh app components lib platform queries test

echo "=== [6/13] 복사 출처 ==="
node scripts/check-provenance.mjs

echo "=== [7/13] unit ==="
pnpm test

# 변형 넷을 EAS 프로젝트가 없을 때와 있을 때(GATE_EAS_PROJECT_ID)로 평가하고, 설정 플러그인이 네이티브 설정으로
# 옮길 값(introspect)이 변형 표·OTA 판단(lib/config)과 같은지 검사기가 본다 - 식별자·scheme·앱 이름, 평문 HTTP,
# OTA(스펙 10.2·10.6). Expo CLI 는 .env 를 읽으므로 프로젝트 id 두 자리를 빈 값으로도 명시한다 - 개발자의 .env 에
# 있는 EAS_PROJECT_ID 가 섞이면 검사기가 잡는다. --disable-warning 은 검사기가 app.config.ts·lib/config 를 type
# stripping 으로 불러올 때 Node 가 내는 모듈 형식 경고 하나를 끈다(scripts/check-variant-config.mjs 머리말).
echo "=== [8/13] 설정 ==="
for variant in development preview production e2e; do
  for project in '' "$GATE_EAS_PROJECT_ID"; do
    echo "--- APP_VARIANT=$variant EAS_PROJECT_ID=${project:-(없음)}"
    APP_VARIANT="$variant" BACKEND_URL="$GATE_BACKEND_URL" EAS_PROJECT_ID="$project" EAS_BUILD_PROJECT_ID='' \
      pnpm exec expo config --type introspect --json |
      node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/check-variant-config.mjs "$variant" "$project"
  done
done

echo "=== [9/13] 의존성 호환 ==="
BACKEND_URL="$GATE_BACKEND_URL" pnpm exec expo-doctor

# 이 개발 머신(Windows)에서 캐시를 둔 expo export 는 대개 결과를 다 쓴 뒤 종료할 때 간헐적으로
# 0xC0000005(Git Bash 에서는 139)로 죽었고 --clear 를 주면 죽지 않았다(실측 기록의 M1 관찰 8: 26회 중
# 13회, 10회 중 0회). 그래서 준다.
echo "=== [10/13] 번들 ==="
APP_VARIANT=production BACKEND_URL="$GATE_BACKEND_URL" pnpm exec expo export --clear --platform android --platform ios --output-dir dist

# 세 프로파일 전부를 정적 검증한다 - 프로파일을 안 주면 프로파일이 붙은 서비스 아홉이
# 활성 집합에서 빠져 한 번도 검증되지 않는다(원본 저장소의 실측). 이 단계는 YAML 문법·
# 참조 무결성·프로파일 소속까지만 본다 - 빌드 컨텍스트가 실재하는지는 보지 않는다.
echo "=== [11/13] compose ==="
pnpm compose:verify

# 자원 선언(lib/resources)이 백엔드의 계약과 같은지 실제 FastAPI 스택에 HTTP 로 맞댄다(스펙 11.2). 이 저장소의
# compose 프로젝트만 띄우고 내린다.
echo "=== [12/13] 계약 거울 ==="
./test/contract/run.sh

# 앱의 흐름을 실제 기기와 실제 백엔드로 잰다(스펙 11.3). 이 저장소의 compose 프로젝트만 띄우고
# 내린다. E2E_FLOW 로 일부만 도는 것은 개발용이다 - 게이트는 언제나 전부 돈다.
echo "=== [13/13] E2E ==="
env -u E2E_FLOW ./test/e2e/run-android.sh

echo "=== 전부 통과 ==="
