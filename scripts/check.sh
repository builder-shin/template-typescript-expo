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
#   4. [10] 이 Metro·Uniwind 캐시를 지운다(--clear) - 돌리기 전에 이 저장소의 expo start 를 끈다.
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

echo "=== [1/11] typecheck ==="
BACKEND_URL="$GATE_BACKEND_URL" pnpm types:routes
pnpm typecheck

echo "=== [2/11] lint ==="
pnpm lint

echo "=== [3/11] format ==="
pnpm format:check

# package.json 의 스크립트 이름이 secretlint 이면 node_modules/.bin/secretlint 를 가려서 [9] 의
# expo-doctor 가 package.json 검사에서 실패한다 - 그래서 스크립트 이름은 lint:secrets 다.
echo "=== [4/11] secretlint ==="
pnpm lint:secrets

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
BACKEND_URL="$GATE_BACKEND_URL" pnpm exec expo-doctor

# 이 개발 머신(Windows)에서 캐시를 둔 expo export 는 대개 결과를 다 쓴 뒤 종료할 때 간헐적으로
# 0xC0000005(Git Bash 에서는 139)로 죽었고 --clear 를 주면 죽지 않았다(실측 기록의 M1 관찰 8: 26회 중
# 13회, 10회 중 0회). 그래서 준다.
echo "=== [10/11] 번들 ==="
APP_VARIANT=production BACKEND_URL="$GATE_BACKEND_URL" pnpm exec expo export --clear --platform android --platform ios --output-dir dist

# 세 프로파일 전부를 정적 검증한다 - 프로파일을 안 주면 프로파일이 붙은 서비스 아홉이
# 활성 집합에서 빠져 한 번도 검증되지 않는다(원본 저장소의 실측). 이 단계는 YAML 문법·
# 참조 무결성·프로파일 소속까지만 본다 - 빌드 컨텍스트가 실재하는지는 보지 않는다.
echo "=== [11/11] compose ==="
pnpm compose:verify

echo "=== 전부 통과 ==="
