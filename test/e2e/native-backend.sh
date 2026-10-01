#!/usr/bin/env bash
# 백엔드를 Docker 없이 띄운다 - macOS 러너에는 Docker 가 없어 iOS E2E 가 쓴다(스펙 13장). Mac 을 쓰는 사람도 같은
# 스크립트로 로컬에서 띄운다. 백엔드 종류는 BACKEND_KIND(fastapi·nestjs·rails, 기본 fastapi)다.
#
#   test/e2e/native-backend.sh repo-url   백엔드 저장소의 주소를 낸다(docker-compose.e2e.yml 의 빌드 컨텍스트와 같다)
#   test/e2e/native-backend.sh fetch      백엔드 저장소의 main 을 받는다(있으면 main 으로 맞춘다)
#   test/e2e/native-backend.sh src-dir    받은 저장소의 경로를 낸다
#   test/e2e/native-backend.sh services   Homebrew 로 PostgreSQL 18·Redis 를 갖춘다(없으면 설치한다)
#   test/e2e/native-backend.sh prepare    백엔드의 런타임 의존성을 갖춘다 - fastapi 는 uv, nestjs 는 pnpm(설치·빌드),
#                                         rails 는 bundler(Ruby 는 백엔드 저장소의 .ruby-version 과 같아야 한다)
#   test/e2e/native-backend.sh start      DB·Redis 를 띄우고 DB 를 새로 만들어 마이그레이션 → SQL 시드
#                                         (test/e2e/seed/) → API 를 E2E_API_PORT 에 띄워 /health/ready 를 기다린다
#   test/e2e/native-backend.sh stop       API·Redis·PostgreSQL 을 내린다(떠 있지 않아도 성공이다)
#   test/e2e/native-backend.sh api-log    API 의 로그 파일 경로를 낸다 - run-ios.sh 가 플로마다 잘라 api.log 로 남긴다
#
# ## 환경 변수
#
#   BACKEND_KIND                 fastapi·nestjs·rails(기본 fastapi) - test/e2e/matrix.ts 의 backendKind() 가 검증한다
#   E2E_API_PORT                 API 포트(기본 4100 - 앱의 BACKEND_URL http://localhost:4100 과 같다)
#   E2E_DB_PORT                  PostgreSQL 포트(기본 55432 - 개발자의 5432 와 겹치지 않게)
#   E2E_REDIS_PORT               Redis 포트(기본 56379)
#   E2E_NATIVE_DIR               저장소·DB·로그를 두는 곳(절대 경로, 기본 ~/.cache/template-typescript-expo-e2e) - 이
#                                저장소 밖이다
#   E2E_ACCESS_EXPIRES_SECONDS   access token 수명(초, 기본 900 - docker-compose.e2e.yml 과 같다). run-ios.sh 는 10 을 준다
#   E2E_PG_BIN                   PostgreSQL 의 bin 디렉터리(기본 $(brew --prefix postgresql@18)/bin)
#
# 값(롤·DB 이름·JWT 더미·Rails 의 환경)은 docker-compose.e2e.yml 의 서비스와 같다 - 앱이 보는 계약이 백엔드를 띄우는
# 방식과 무관하게 같게 한다.
set -euo pipefail
cd "$(dirname "$0")/../.."

# 백엔드 종류를 먼저 검증한다 - 알려진 셋이 아니면 아무것도 건드리지 않고 멈춘다(test/e2e/matrix.ts 머리말).
BACKEND_KIND=$(node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --input-type=module \
  -e "import { backendKind } from './test/e2e/matrix.ts'; process.stdout.write(backendKind())") || exit 1
readonly BACKEND_KIND

readonly REPO_ROOT="$PWD"
readonly API_PORT="${E2E_API_PORT:-4100}"
readonly DB_PORT="${E2E_DB_PORT:-55432}"
readonly REDIS_PORT="${E2E_REDIS_PORT:-56379}"
readonly NATIVE_DIR="${E2E_NATIVE_DIR:-$HOME/.cache/template-typescript-expo-e2e}"
readonly SRC="$NATIVE_DIR/$BACKEND_KIND/src"
readonly API_LOG="$NATIVE_DIR/$BACKEND_KIND/api.log"
readonly API_PID="$NATIVE_DIR/$BACKEND_KIND/api.pid"
readonly PG_DATA="$NATIVE_DIR/postgres/data"
readonly PG_LOG="$NATIVE_DIR/postgres/postgres.log"
readonly REDIS_DIR="$NATIVE_DIR/redis"
# docker-compose.e2e.yml 과 같은 E2E 전용 더미 값이다.
readonly JWT_SECRET='e2e-only-jwt-secret-key-at-least-32-bytes-long'
readonly RAILS_SECRET='e2e-only-rails-secret-key-base-dummy-value-not-for-production'

fail() {
  echo "native-backend($BACKEND_KIND): $*" >&2
  exit 1
}

repo_url() {
  case "$BACKEND_KIND" in
    fastapi) echo 'https://github.com/builder-shin/template-python-fastapi.git' ;;
    nestjs) echo 'https://github.com/builder-shin/template-typescript-nestjs.git' ;;
    rails) echo 'https://github.com/builder-shin/template-ruby-rails.git' ;;
  esac
}

fetch() {
  mkdir -p "$(dirname "$SRC")"
  if [ -d "$SRC/.git" ]; then
    git -C "$SRC" fetch --depth 1 origin main
    git -C "$SRC" reset --hard FETCH_HEAD
  else
    git clone --depth 1 --branch main "$(repo_url)" "$SRC"
  fi
  echo "백엔드 저장소: $(repo_url) main @ $(git -C "$SRC" rev-parse HEAD)"
}

pg_bin() {
  if [ -n "${E2E_PG_BIN:-}" ]; then
    printf '%s\n' "$E2E_PG_BIN"
  else
    local prefix
    prefix=$(brew --prefix postgresql@18) || return 1
    printf '%s/bin\n' "$prefix"
  fi
}

services() {
  command -v brew >/dev/null || fail "Homebrew 가 없다 - PostgreSQL 18 과 Redis 를 Homebrew 로 갖춘다"
  local formula
  for formula in postgresql@18 redis; do
    brew list --versions "$formula" >/dev/null || HOMEBREW_NO_AUTO_UPDATE=1 HOMEBREW_NO_INSTALL_CLEANUP=1 brew install "$formula"
  done
  "$(pg_bin)/postgres" --version
  redis-server --version
}

prepare() {
  [ -d "$SRC/.git" ] || fail "백엔드 저장소가 없다($SRC) - test/e2e/native-backend.sh fetch 를 먼저 돌린다"
  case "$BACKEND_KIND" in
    fastapi)
      command -v uv >/dev/null || fail "uv 가 없다"
      (cd "$SRC" && uv sync --frozen --no-dev)
      ;;
    nestjs)
      command -v pnpm >/dev/null || fail "pnpm 이 없다"
      (cd "$SRC" && pnpm install --frozen-lockfile && pnpm run build)
      ;;
    rails)
      local want have
      want=$(tr -d '[:space:]' <"$SRC/.ruby-version")
      have=$(ruby -e 'print RUBY_VERSION' 2>/dev/null || true)
      [ "$have" = "$want" ] || fail "Ruby $want 이 필요하다(지금 ${have:-없음}) - 백엔드 저장소의 .ruby-version"
      (cd "$SRC" && { bundle check >/dev/null 2>&1 || bundle install; })
      ;;
  esac
}

psql_as() {
  "$(pg_bin)/psql" -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$DB_PORT" -U "$1" -d "$2" -q "${@:3}"
}

start_services() {
  local bin
  bin=$(pg_bin)
  mkdir -p "$(dirname "$PG_DATA")" "$REDIS_DIR"
  if [ ! -f "$PG_DATA/PG_VERSION" ]; then
    "$bin/initdb" -D "$PG_DATA" -U postgres --auth=trust --encoding=UTF8 --no-locale >/dev/null
  fi
  if ! "$bin/pg_ctl" -D "$PG_DATA" status >/dev/null 2>&1; then
    "$bin/pg_ctl" -D "$PG_DATA" -l "$PG_LOG" -w \
      -o "-p $DB_PORT -c listen_addresses=127.0.0.1 -k $(dirname "$PG_DATA")" start >/dev/null
  fi
  # 롤은 docker-compose.e2e.yml 의 POSTGRES_USER 와 같다 - 그 컨테이너에서처럼 슈퍼유저다(Rails 의 db:prepare 가
  # DB 를 만든다).
  psql_as postgres postgres -c "DO \$\$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'fastapi') THEN CREATE ROLE fastapi LOGIN SUPERUSER PASSWORD 'fastapi'; END IF; END \$\$;"
  if ! redis-cli -p "$REDIS_PORT" ping >/dev/null 2>&1; then
    redis-server --port "$REDIS_PORT" --bind 127.0.0.1 --daemonize yes --save '' --appendonly no \
      --dir "$REDIS_DIR" --pidfile "$REDIS_DIR/redis.pid" --logfile "$REDIS_DIR/redis.log"
  fi
}

# 백엔드마다 docker-compose.e2e.yml 의 migrate-*·seed-*·api-* 와 같은 일을 한다. API 는 백그라운드로 띄워
# PID 를 적는다. & 는 nohup 한 명령에만 건다 - `cd … && nohup … &` 는 목록 전체가 백그라운드 서브셸이 되어 bash
# 판에 따라 $! 가 서버가 아니라 그 서브셸이다(stop 이 서버를 남기고, 남은 서버가 포트를 쥔다).
start_api() {
  local access="${E2E_ACCESS_EXPIRES_SECONDS:-900}"
  : >"$API_LOG"
  case "$BACKEND_KIND" in
    fastapi)
      psql_as fastapi postgres -c 'DROP DATABASE IF EXISTS fastapi_template' -c 'CREATE DATABASE fastapi_template'
      export DATABASE_URL="postgresql+psycopg://fastapi:fastapi@127.0.0.1:$DB_PORT/fastapi_template"
      (cd "$SRC" && .venv/bin/alembic upgrade head)
      psql_as fastapi fastapi_template -f "$REPO_ROOT/test/e2e/seed/examples.sql"
      (
        cd "$SRC"
        REDIS_URL="redis://127.0.0.1:$REDIS_PORT/0" JWT_SECRET_KEY="$JWT_SECRET" \
          JWT_ISSUER=template-python-fastapi JWT_AUDIENCE=template-python-fastapi JWT_ACCESS_EXPIRES_SECONDS="$access" \
          nohup .venv/bin/uvicorn config.asgi:application --host 127.0.0.1 --port "$API_PORT" >>"$API_LOG" 2>&1 &
        echo $! >"$API_PID"
      )
      ;;
    nestjs)
      psql_as fastapi postgres -c 'DROP DATABASE IF EXISTS fastapi_template' -c 'CREATE DATABASE fastapi_template'
      export DATABASE_URL="postgres://fastapi:fastapi@127.0.0.1:$DB_PORT/fastapi_template"
      (cd "$SRC" && node node_modules/typeorm/cli.js migration:run -d dist/config/data-source.js)
      psql_as fastapi fastapi_template -f "$REPO_ROOT/test/e2e/seed/examples.sql"
      (
        cd "$SRC"
        NODE_ENV=production PORT="$API_PORT" JWT_SECRET_KEY="$JWT_SECRET" \
          JWT_ISSUER=template-typescript-nestjs JWT_AUDIENCE=template-typescript-nestjs JWT_ACCESS_EXPIRES_SECONDS="$access" \
          nohup node dist/config/main.js >>"$API_LOG" 2>&1 &
        echo $! >"$API_PID"
      )
      ;;
    rails)
      psql_as fastapi postgres -c 'DROP DATABASE IF EXISTS rails_e2e_template'
      export RAILS_ENV=development DATABASE_HOST=127.0.0.1 DATABASE_PORT="$DB_PORT" \
        DEV_DATABASE_USERNAME=fastapi DEV_DATABASE_PASSWORD=fastapi DEV_DATABASE_NAME=rails_e2e_template \
        SKIP_TEST_DATABASE=1 SECRET_KEY_BASE="$RAILS_SECRET" JWT_SECRET_KEY="$JWT_SECRET" \
        JWT_ISSUER=template-ruby-rails JWT_AUDIENCE=template-ruby-rails JWT_ACCESS_EXPIRES_SECONDS="$access" \
        ACTIVE_STORAGE_SERVICE=local ACTIVE_JOB_QUEUE_ADAPTER=sidekiq REDIS_URL="redis://127.0.0.1:$REDIS_PORT/0" \
        PORT="$API_PORT" ALLOWED_HOSTS="localhost:$API_PORT,127.0.0.1:$API_PORT"
      # db:prepare 가 DB 를 만들고 db/seeds.rb 도 돈다 - examples.rails.sql 의 앞 절이 그 행을 지운다(시드 README).
      (cd "$SRC" && bundle exec bin/rails db:prepare)
      psql_as fastapi rails_e2e_template -f "$REPO_ROOT/test/e2e/seed/examples.rails.sql"
      (
        cd "$SRC"
        nohup bundle exec puma -C config/puma.rb >>"$API_LOG" 2>&1 &
        echo $! >"$API_PID"
      )
      ;;
  esac
  local deadline=$((SECONDS + 120))
  until curl -fsS "http://127.0.0.1:$API_PORT/health/ready" >/dev/null 2>&1; do
    if ! kill -0 "$(cat "$API_PID")" 2>/dev/null; then
      tail -n 40 "$API_LOG" >&2
      fail "API 가 뜨다가 죽었다 - 기록: $API_LOG"
    fi
    if [ "$SECONDS" -ge "$deadline" ]; then
      tail -n 40 "$API_LOG" >&2
      fail "API 가 120초 안에 127.0.0.1:$API_PORT 에서 준비되지 않았다 - 기록: $API_LOG"
    fi
    sleep 2
  done
  echo "백엔드 준비: $BACKEND_KIND @ $(git -C "$SRC" rev-parse --short HEAD) - http://127.0.0.1:$API_PORT (access ${access}초)"
}

stop_api() {
  local pid waited=0
  [ -f "$API_PID" ] || return 0
  pid=$(cat "$API_PID")
  if kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null || true
    while kill -0 "$pid" 2>/dev/null && [ "$waited" -lt 20 ]; do
      sleep 1
      waited=$((waited + 1))
    done
    kill -9 "$pid" 2>/dev/null || true
  fi
  rm -f "$API_PID"
}

stop_all() {
  stop_api
  redis-cli -p "$REDIS_PORT" shutdown nosave >/dev/null 2>&1 || true
  if [ -f "$PG_DATA/PG_VERSION" ]; then
    "$(pg_bin)/pg_ctl" -D "$PG_DATA" -m fast stop >/dev/null 2>&1 || true
  fi
}

case "${1:-}" in
  repo-url) repo_url ;;
  fetch) fetch ;;
  src-dir) printf '%s\n' "$SRC" ;;
  services) services ;;
  prepare) prepare ;;
  start)
    [ -d "$SRC/.git" ] || fail "백엔드 저장소가 없다($SRC) - fetch·prepare 를 먼저 돌린다"
    mkdir -p "$(dirname "$API_LOG")"
    stop_api
    start_services
    start_api
    ;;
  stop) stop_all ;;
  api-log) printf '%s\n' "$API_LOG" ;;
  *)
    echo "사용법: $0 repo-url|fetch|src-dir|services|prepare|start|stop|api-log" >&2
    exit 1
    ;;
esac
