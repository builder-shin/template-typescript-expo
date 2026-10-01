#!/usr/bin/env bash
# 계약 거울 게이트 단계 - 백엔드 스택을 띄우고 test/contract 를 돈다(스펙 11.2·12장). 게이트는 FastAPI 로, CI 의
# e2e-android 잡은 백엔드마다(BACKEND_KIND) 부른다(스펙 13장).
#
#   test/contract/run.sh
#
# 순서: 백엔드 종류 검증 → 이 저장소의 compose 프로젝트를 내린다 → 그 백엔드의 프로파일을 띄워 준비될 때까지
# 기다린다 → 자원 선언과 백엔드를 HTTP 로 맞댄다(vitest.contract.config.mjs) → 내린다(실패해도 내린다). 앱도 기기도
# 쓰지 않는다 - E2E(test/e2e/run-android.sh)보다 먼저 돌아 선언이 백엔드와 어긋나면 빨리 멈춘다.
#
# ## 환경 변수
#
#   E2E_API_PORT   백엔드를 여는 호스트 포트. 기본 4100(docker-compose.e2e.yml·E2E 하네스와 같은 값)
#   BACKEND_KIND   fastapi·nestjs·rails(기본 fastapi) - 띄울 compose 프로파일. test/e2e/matrix.ts 의 backendKind() 가
#                  검증한다 - 알려진 셋이 아니면 도커를 건드리기 전에 멈춘다
#
# 스택은 E2E 와 같은 compose 프로젝트(template-typescript-expo-e2e)다 - 그 프로젝트만 띄우고 내린다. 개발
# 머신의 다른 스택을 건드리지 않는다.
set -euo pipefail
cd "$(dirname "$0")/../.."

# 백엔드 종류를 먼저 검증한다 - 알려진 셋이 아니면 도커를 건드리지 않고 멈춘다(test/e2e/matrix.ts 머리말).
BACKEND_KIND=$(node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --input-type=module \
  -e "import { backendKind } from './test/e2e/matrix.ts'; process.stdout.write(backendKind())") || exit 1
readonly BACKEND_KIND
# 문구의 백엔드 이름 - FastAPI 의 문구는 D5 의 글자 그대로다(test/unit/scripts/contract-run.test.ts 가 잰다).
case "$BACKEND_KIND" in
  fastapi) readonly BACKEND_NAME=FastAPI ;;
  nestjs) readonly BACKEND_NAME=NestJS ;;
  rails) readonly BACKEND_NAME=Rails ;;
esac

readonly PROJECT=template-typescript-expo-e2e
readonly API_PORT="${E2E_API_PORT:-4100}"

export E2E_API_PORT="$API_PORT"
# access token 은 백엔드 기본 수명(900초)으로 둔다 - 거울은 한 번 로그인한 토큰으로 속성 제약을 잰다. E2E
# 하네스는 이 변수를 10 으로 준다(test/e2e/run-android.sh) - 셸에 그 값이 남아 있어도 여기서는 쓰지 않는다.
export E2E_ACCESS_EXPIRES_SECONDS=900

fail() {
  echo "계약 거울: $*" >&2
  exit 1
}

compose() {
  docker compose -p "$PROJECT" -f docker-compose.e2e.yml "$@"
}

# 내릴 때는 세 프로파일을 모두 준다 - down 도 활성 프로파일만 대상으로 삼는다(compose 머리말).
compose_down() {
  compose --profile fastapi --profile nestjs --profile rails down -v --remove-orphans >/dev/null 2>&1 || true
}

command -v docker >/dev/null || fail "docker 가 없다"
docker info >/dev/null 2>&1 || fail "Docker 데몬에 닿지 못한다 - Docker 를 켠다"
command -v curl >/dev/null || fail "curl 이 없다"

trap compose_down EXIT
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --input-type=module \
  -e "import { backendKind, reportKnownDivergences } from './test/e2e/matrix.ts'; reportKnownDivergences(backendKind())"
compose_down
compose --profile "$BACKEND_KIND" up -d --build --wait
# 컨테이너의 healthy 뒤에도 API 준비는 조금 늦을 수 있다 - 횟수와 각 요청·간격을 모두 묶는다(결정 42).
ready=0
for attempt in $(seq 1 30); do
  if curl -fsS --connect-timeout 1 --max-time 2 "http://127.0.0.1:$API_PORT/health/ready" >/dev/null 2>&1; then
    ready=1
    break
  fi
  if [ "$attempt" -lt 30 ]; then sleep 1; fi
done
if [ "$ready" -ne 1 ]; then fail "$BACKEND_NAME 가 127.0.0.1:$API_PORT 에서 준비되지 않았다"; fi

CONTRACT_API_URL="http://127.0.0.1:$API_PORT" pnpm test:contract
