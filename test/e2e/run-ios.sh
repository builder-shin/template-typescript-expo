#!/usr/bin/env bash
# E2E - iOS 시뮬레이터 + 네이티브 백엔드 + Maestro(스펙 13장·11.3). macOS 전용이다 - CI 의 e2e-ios 잡이 백엔드마다
# 부르고, Mac 을 쓰는 사람도 같은 명령으로 돈다.
#
#   test/e2e/run-ios.sh
#
# 순서: 백엔드 종류 검증 → 도구 확인 → 앱(E2E_APP 의 .app, 없으면 ios.sh build) 검증 → 전용 기기 생성·
# 서비스/설정 준비·한 번 재부팅·readback → 앱 설치 → 백엔드(test/e2e/native-backend.sh start) → test/e2e/flows/*.yaml 을 하나씩 돌리며
# 플로마다 시뮬레이터 로그에 가드를 걸고(test/e2e/ios-log.ts 로 logcat 모양으로 옮겨 test/e2e/guard-log.sh) 백엔드
# 요청 수를 단언한다(test/e2e/request-counts.ts) → E2E_CHECKS=1 이면 백엔드 대신 멈춘 서버로 test/e2e/checks/*.yaml →
# 백엔드를 내린다(실패해도 내린다).
#
# ## 환경 변수
#
#   BACKEND_KIND      fastapi·nestjs·rails(기본 fastapi) - native-backend.sh 가 띄울 백엔드
#   E2E_APP           미리 만든 e2e 변형 .app(CI 의 build-ios 잡). 없으면 test/e2e/ios.sh build 로 만든다
#   E2E_SIMULATOR     새 전용 기기의 runtime/type 기준이 될 기존 iPhone 이름 또는 UDID
#   E2E_API_PORT      백엔드 포트(기본 4100 - 앱의 BACKEND_URL http://localhost:4100 과 같다)
#   E2E_ACCESS_EXPIRES_SECONDS
#                     백엔드의 access token 수명(초). 기본 10 - run-android.sh 와 같다
#   E2E_FLOW          돌릴 플로 이름(공백으로 구분, 확장자 없이). 비우면 전부
#   E2E_CHECKS        1 이면 플로 뒤에 test/e2e/checks/ 를 멈춘 서버(test/e2e/stall-server.ts)로 돈다
#   MAESTRO           Maestro 실행 파일. 기본은 PATH 의 maestro, 없으면 ~/.maestro/bin/maestro. 2.11.x 여야 한다
#
# 플로 머리말은 run-android.sh 와 같이 읽는다(test/e2e/AGENTS.md). `# e2e-app-locale:` 은 iOS 에서 실행 인자
# (-AppleLanguages)로 건다 - 하네스가 앱을 다시 설치하고 키체인을 비운 뒤 APP_LOCALE 을 넘기고, 플로의 launchApp 이
# 그 값을 arguments 로 싣는다. `# e2e-platforms:` 에 ios 가 없는 플로는 건너뛰고 그 사실을 적는다.
set -euo pipefail
cd "$(dirname "$0")/../.."

# 백엔드 종류를 먼저 검증한다 - 알려진 셋이 아니면 시뮬레이터·백엔드를 건드리지 않고 멈춘다(test/e2e/matrix.ts 머리말).
BACKEND_KIND=$(node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --input-type=module \
  -e "import { backendKind } from './test/e2e/matrix.ts'; try { process.stdout.write(backendKind()) } catch (error) { console.error(error.message); process.exit(1) }") || exit 1
readonly BACKEND_KIND
export BACKEND_KIND

readonly APP_ID=com.example.templateexpo.e2e
readonly API_PORT="${E2E_API_PORT:-4100}"
readonly OUT=.maestro-output/e2e
# 가입·로그인에 쓰는 비밀번호 - run-android.sh 와 같은 값이다.
readonly E2E_PASSWORD=probe-password-value

export E2E_API_PORT="$API_PORT"
export E2E_ACCESS_EXPIRES_SECONDS="${E2E_ACCESS_EXPIRES_SECONDS:-10}"
export MAESTRO_CLI_NO_ANALYTICS=1
export MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true
export MAESTRO_DISABLE_UPDATE_CHECK=true
# iOS 드라이버(XCTest 러너)를 시뮬레이터에 올리는 시간 - CI 의 첫 실행은 기본값보다 오래 걸린다.
export MAESTRO_DRIVER_STARTUP_TIMEOUT="${MAESTRO_DRIVER_STARTUP_TIMEOUT:-180000}"

fail() {
  echo "E2E(iOS): $*" >&2
  exit 1
}

node_quiet() {
  node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON "$@"
}

# shellcheck source=test/e2e/ios-simulator.sh
source test/e2e/ios-simulator.sh

# ── 도구 ────────────────────────────────────────────────────────────
[ "$(uname -s)" = Darwin ] || fail "iOS E2E 는 macOS 에서만 돈다"
command -v xcrun >/dev/null || fail "xcrun 이 없다 - Xcode 를 설치한다"
command -v curl >/dev/null || fail "curl 이 없다"
MAESTRO="${MAESTRO:-$(command -v maestro || printf '%s' "$HOME/.maestro/bin/maestro")}"
maestro_out=$("$MAESTRO" --version 2>/dev/null) ||
  fail "Maestro 를 실행하지 못한다: $MAESTRO - test/e2e/install-maestro.sh 로 2.11.0 을 ~/.maestro 에 푼다"
maestro_version=$(printf '%s\n' "$maestro_out" | tr -d '\r' | grep -E '^[0-9]' | tail -n 1 || true)
case "$maestro_version" in
  2.11.*) ;;
  *) fail "Maestro 는 2.11.x 여야 한다 - $MAESTRO 는 ${maestro_version:-버전을 내지 않았다}" ;;
esac

# ── 플로 ────────────────────────────────────────────────────────────
header() {
  sed -n "s/^# $2: *//p" "$1" | head -n 1
}

probe_email() {
  node_quiet --input-type=module \
    -e "import { probeEmail } from './test/e2e/probe-email.ts'; process.stdout.write(probeEmail('probe-e2e', process.argv[1]))" "$1"
}

# 앱을 다시 설치하고 키체인을 비운다 - Android 의 pm clear 자리다. 키체인의 세션은 앱을 지워도 남는다(스펙 7.5 의
# D2 정정) - 로캘 플로는 clearState 를 쓰지 않으므로 여기서 비운다.
reset_app() {
  xcrun simctl terminate "$UDID" "$APP_ID" >/dev/null 2>&1 || true
  xcrun simctl uninstall "$UDID" "$APP_ID" || return 1
  xcrun simctl install "$UDID" "$APP" || return 1
  xcrun simctl keychain "$UDID" reset || return 1
}

# 제대로 서명한 앱에는 시스템의 강력한 비밀번호 추천/저장 창이 나타난다(K3 Mac 재현). E2E는 직접 입력을
# 재므로 선택한 시뮬레이터의 AutoFill만 실행 중 끈다. 앱의 textContentType은 유지하고 원래 설정은 복원한다.
autofill_original=''
prepare_autofill() {
  local original actual domain
  # defaults export는 없는 domain도 성공한 빈 dict로 돌려준다(K3). 명령 실패를 키 없음으로 오인하지 않는다.
  domain=$(xcrun simctl spawn "$UDID" defaults export com.apple.WebUI -) || {
    echo "E2E(iOS): 원래 AutoFill 설정을 읽지 못했다 - 설정을 바꾸지 않는다" >&2
    return 1
  }
  original=$(printf '%s' "$domain" | plutil -convert json -o - - | node -e '
    const values = JSON.parse(require("fs").readFileSync(0, "utf8"))
    if (!Object.hasOwn(values, "AutoFillPasswords")) console.log("absent")
    else {
      const value = values.AutoFillPasswords
      if (value !== 0 && value !== 1 && value !== false && value !== true) {
        throw new Error("알 수 없는 AutoFillPasswords 값")
      }
      console.log(Number(value))
    }') || { echo "E2E(iOS): 원래 AutoFill 설정을 해석하지 못했다" >&2; return 1; }
  autofill_original=$original
  xcrun simctl spawn "$UDID" defaults write com.apple.WebUI AutoFillPasswords -int 0 || return 1
  actual=$(xcrun simctl spawn "$UDID" defaults read com.apple.WebUI AutoFillPasswords) || return 1
  [ "$actual" = 0 ] || { echo "E2E(iOS): AutoFillPasswords 설정이 적용되지 않았다: $actual" >&2; return 1; }
}

restore_autofill() {
  [ -n "$autofill_original" ] || return 0
  if [ "$autofill_original" = absent ]; then
    xcrun simctl spawn "$UDID" defaults delete com.apple.WebUI AutoFillPasswords || return 1
  else
    xcrun simctl spawn "$UDID" defaults write com.apple.WebUI AutoFillPasswords -int "$autofill_original" || return 1
  fi
  autofill_original=''
}

# 첫 OS 승인 경로의 GHA 지연을 피한다(K3, D7-R32). 앱의 링크/인증 처리와 R16 단언은 그대로 둔다.
# 성공한 export만 부재와 값을 가른다. JSON 문자열로 보관해 실제 문자열 "absent"도 부재와 구별한다.
scheme_approval_original=''
prepare_scheme_approval() {
  local domain='com.apple.launchservices.schemeapproval'
  local key='com.apple.CoreSimulator.CoreSimulatorBridge-->templateexpo-e2e'
  local exported original actual
  exported=$(xcrun simctl spawn "$UDID" defaults export "$domain" -) || {
    echo "E2E(iOS): 원래 딥링크 승인을 읽지 못했다 - 설정을 바꾸지 않는다" >&2
    return 1
  }
  original=$(printf '%s' "$exported" | plutil -convert json -o - - | node -e '
    const values = JSON.parse(require("fs").readFileSync(0, "utf8"))
    const key = process.argv[1]
    if (!Object.hasOwn(values, key)) console.log("absent")
    else {
      const value = values[key]
      if (typeof value !== "string" || !/^[A-Za-z0-9.-]+$/.test(value)) {
        throw new Error("알 수 없는 딥링크 승인 앱 식별자")
      }
      console.log(JSON.stringify(value))
    }' "$key") || { echo "E2E(iOS): 원래 딥링크 승인을 해석하지 못했다" >&2; return 1; }
  scheme_approval_original=$original
  xcrun simctl spawn "$UDID" defaults write "$domain" "$key" -string "$APP_ID" || return 1
  actual=$(xcrun simctl spawn "$UDID" defaults read "$domain" "$key") || return 1
  [ "$actual" = "$APP_ID" ] || { echo "E2E(iOS): 딥링크 사전 승인이 적용되지 않았다" >&2; return 1; }
  echo "E2E(iOS): templateexpo-e2e 스킴 사전 승인·readback 완료"
}

restore_scheme_approval() {
  [ -n "$scheme_approval_original" ] || return 0
  local domain='com.apple.launchservices.schemeapproval'
  local key='com.apple.CoreSimulator.CoreSimulatorBridge-->templateexpo-e2e'
  local original
  if [ "$scheme_approval_original" = absent ]; then
    xcrun simctl spawn "$UDID" defaults delete "$domain" "$key" || return 1
  else
    original=$(node -e 'process.stdout.write(JSON.parse(process.argv[1]))' "$scheme_approval_original") || return 1
    xcrun simctl spawn "$UDID" defaults write "$domain" "$key" -string "$original" || return 1
  fi
  scheme_approval_original=''
}

# 시뮬레이터 로그(React Native 의 JS 줄)를 플로 동안 받는다. info 수준까지 받아야 앱의 console.log·[e2e-http] 줄이
# 온다(--level debug).
start_device_log() {
  xcrun simctl spawn "$UDID" log stream --level debug --style ndjson \
    --predicate 'subsystem == "com.facebook.react.log"' >"$1" 2>"$1.stderr" &
  log_pid=$!
  # log stream 이 붙기 전의 줄은 받지 못한다 - 붙을 시간을 준다.
  sleep 2 || return 1
  kill -0 "$log_pid" 2>/dev/null || return 1
}

# 플로가 끝난 뒤의 줄까지 받도록 잠시 두었다가 끊는다(SIGINT - log stream 이 받은 것을 내보내고 끝난다). 비대화형
# 셸이 백그라운드로 띄운 명령은 SIGINT 를 무시한 채 시작한다(POSIX) - 스스로 처리기를 두지 않으면 INT 가 닿지 않아
# wait 가 끝나지 않는다. 5초 안에 끝나지 않으면 TERM 을 보낸다.
stop_device_log() {
  local waited=0 rc=0 int_sent=0 term_sent=0
  [ -n "${log_pid:-}" ] || return 0
  sleep 2 || return 1
  # 생존 검사 직후 끝날 수 있다 - INT 를 실제로 보낸 경우에만 자체 종료로 본다.
  if kill -0 "$log_pid" 2>/dev/null && kill -INT "$log_pid" 2>/dev/null; then
    int_sent=1
  fi
  if [ "$int_sent" -eq 0 ]; then
    wait "$log_pid" 2>/dev/null || true
    log_pid=''
    echo "E2E(iOS): 로그 스트림이 종료 신호 전에 끝났다 - 플로의 로그가 불완전하다" >&2
    return 1
  fi
  while kill -0 "$log_pid" 2>/dev/null && [ "$waited" -lt 10 ]; do
    sleep 0.5 || return 1
    waited=$((waited + 1))
  done
  if kill -TERM "$log_pid" 2>/dev/null; then term_sent=1; fi
  # 전달한 INT 뒤 이미 끝났으면 TERM 실패는 정상이다. 아직 살아 있으면 회수를 기다리지 않는다.
  if [ "$term_sent" -eq 0 ] && kill -0 "$log_pid" 2>/dev/null; then
    echo "E2E(iOS): 로그 스트림에 TERM 종료 신호를 보내지 못했다" >&2
    return 1
  fi
  wait "$log_pid" 2>/dev/null || rc=$?
  log_pid=''
  case "$rc" in
    0|130|143) return 0 ;;
    *) echo "E2E(iOS): 로그 스트림이 예상하지 않은 상태로 끝났다(exit $rc)" >&2; return 1 ;;
  esac
}

api_log_size() {
  if [ -f "$API_LOG_FILE" ]; then wc -c <"$API_LOG_FILE" | tr -d ' '; else echo 0; fi
}

# 플로 동안 백엔드가 남긴 로그만 잘라 둔다 - 화면이 옛 값을 그릴 때 요청이 서버에 닿았는지 가른다.
save_api_log() {
  local from=$1 out=$2
  if [ -f "$API_LOG_FILE" ]; then tail -c "+$((from + 1))" "$API_LOG_FILE" >"$out/api.log"; else : >"$out/api.log"; fi
}

log_pid=''
skipped=()

run_flow() {
  local flow=$1 name locale allowed platforms email other_email out rc=0 from
  name=$(basename "$flow" .yaml) || return 1
  locale=$(header "$flow" e2e-app-locale) || return 1
  allowed=$(header "$flow" e2e-allow-http) || return 1
  platforms=$(header "$flow" e2e-platforms) || return 1
  if [ -n "$platforms" ] && [[ " $platforms " != *" ios "* ]]; then
    echo "--- $name (건너뛴다 - e2e-platforms: $platforms)"
    skipped+=("$name")
    return 0
  fi
  email=$(probe_email "$name") || return 1
  other_email=$(probe_email "$name-other") || return 1
  out="$OUT/$name"
  mkdir -p "$out" || return 1

  if [ -n "$locale" ]; then
    if ! reset_app; then
      echo "E2E(iOS): $name 앞에서 앱을 다시 설치하거나 키체인을 비우지 못했다" >&2
      return 1
    fi
  fi

  echo "--- $name${locale:+ ($locale)}"
  from=$(api_log_size) || return 1
  start_device_log "$out/device.ndjson" || return 1
  "$MAESTRO" test --platform ios --no-ansi --device "$UDID" --debug-output "$out/debug" \
    -e "EMAIL=$email" -e "OTHER_EMAIL=$other_email" -e "PASSWORD=$E2E_PASSWORD" \
    -e "API_URL=http://127.0.0.1:$API_PORT" -e "APP_LOCALE=$locale" "$flow" >"$out/maestro.log" 2>&1 || rc=$?
  stop_device_log || return 1
  save_api_log "$from" "$out" || return 1
  node_quiet --input-type=module \
    -e "import { readFileSync } from 'node:fs'; import { briefFromIosLog } from './test/e2e/ios-log.ts'; process.stdout.write(briefFromIosLog(readFileSync(0, 'utf8')))" \
    <"$out/device.ndjson" >"$out/device.log" || return 1

  if [ "$rc" -ne 0 ]; then
    tail -n 30 "$out/maestro.log" >&2
    echo "E2E(iOS): $name 플로가 실패했다(exit $rc) - 기록: $out" >&2
    return 1
  fi
  # 허용 상태는 공백으로 나뉜 여러 인자로 넘긴다.
  # shellcheck disable=SC2086
  if ! test/e2e/guard-log.sh "$out/device.log" $allowed; then
    echo "E2E(iOS): $name 의 시뮬레이터 로그가 가드에 걸렸다 - $out/device.log (원본 $out/device.ndjson)" >&2
    return 1
  fi
  # 앱의 요청 수를 이 플로의 접근 로그에서 단언한다 - run-android.sh 와 같다(test/e2e/request-counts.ts 머리말).
  if ! node_quiet test/e2e/request-counts.ts "$name" "$out/api.log" "$BACKEND_KIND"; then
    echo "E2E(iOS): $name 의 백엔드 요청 수가 어긋났다 - $out/api.log" >&2
    return 1
  fi
}

# ── 멈춘 서버 확인(E2E_CHECKS=1) ─────────────────────────────────────
STALL_PID=''

stop_stall_server() {
  [ -n "$STALL_PID" ] || return 0
  kill "$STALL_PID" 2>/dev/null || true
  wait "$STALL_PID" 2>/dev/null || true
  STALL_PID=''
}

run_checks() {
  local flow name stall_log="$OUT/stall-server.log" failed_checks=0 waited=0
  test/e2e/native-backend.sh stop || return 1
  # 함수(node_quiet)를 백그라운드로 돌리면 $! 가 node 가 아니라 서브셸일 수 있다 - node 를 곧바로 부른다.
  node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON test/e2e/stall-server.ts "$API_PORT" >"$stall_log" 2>&1 &
  STALL_PID=$!
  until grep -q '^stall-server ' "$stall_log" 2>/dev/null; do
    kill -0 "$STALL_PID" 2>/dev/null || { cat "$stall_log" >&2; fail "멈춘 서버가 뜨지 못했다"; }
    [ "$waited" -lt 20 ] || fail "멈춘 서버가 10초 안에 뜨지 않았다"
    sleep 0.5 || return 1
    waited=$((waited + 1))
  done
  API_LOG_FILE="$stall_log"
  for flow in test/e2e/checks/*.yaml; do
    name=$(basename "$flow" .yaml) || return 1
    if ! run_flow "$flow"; then
      failed_checks=1
      failed+=("checks/$name")
      continue
    fi
    # 두 방식 모두 타임아웃으로 끝났는지 본다 - 서버가 뜨지 않아 연결이 거절되면(NETWORK_ERROR) 화면은 같다.
    if [ "$(grep -c 'REQUEST_TIMEOUT' "$OUT/$name/device.log" || true)" -lt 2 ] ||
      ! grep -q 'mode=headers' "$stall_log" || ! grep -q 'mode=body' "$stall_log"; then
      echo "E2E(iOS): checks/$name - 두 요청이 모두 멈춘 서버에서 REQUEST_TIMEOUT 으로 끝나지 않았다(기록: $OUT/$name, $stall_log)" >&2
      failed_checks=1
      failed+=("checks/$name")
    fi
  done
  stop_stall_server || return 1
  return "$failed_checks"
}

# ── 실행 ────────────────────────────────────────────────────────────
rm -rf "$OUT"
mkdir -p "$OUT"
if [ -n "${E2E_APP:-}" ]; then
  APP="$E2E_APP"
  echo "미리 만든 .app 을 쓴다 - 빌드하지 않는다 ($APP)"
  test/e2e/ios.sh assert-app "$APP" "http://localhost:$API_PORT"
else
  APP=$(BACKEND_URL="http://localhost:$API_PORT" test/e2e/ios.sh build | tail -n 1)
fi
readonly APP

cleanup() {
  local settings_failed=0
  stop_device_log || true
  stop_stall_server
  test/e2e/native-backend.sh stop || true
  restore_scheme_approval || settings_failed=1
  restore_autofill || settings_failed=1
  remove_owned_simulator || settings_failed=1
  [ "$settings_failed" = 0 ] || fail "시뮬레이터의 원래 딥링크 승인/AutoFill 설정을 복원하지 못했다"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
create_owned_simulator || fail "E2E 전용 simulator를 만들거나 부팅하지 못했다"
readonly UDID
prepare_simulator_services || fail "E2E 전용 simulator 서비스를 준비하지 못했다"
prepare_autofill || fail "시뮬레이터의 Password AutoFill을 끄지 못했다"
prepare_scheme_approval || fail "시뮬레이터의 딥링크 사전 승인을 준비하지 못했다"
reboot_prepared_simulator || fail "재부팅 뒤 E2E simulator 설정이 적용되지 않았다"
xcrun simctl install "$UDID" "$APP"
node_quiet --input-type=module \
  -e "import { backendKind, reportKnownDivergences } from './test/e2e/matrix.ts'; reportKnownDivergences(backendKind())"
test/e2e/native-backend.sh stop
test/e2e/native-backend.sh start
API_LOG_FILE=$(test/e2e/native-backend.sh api-log)

flows=()
for flow in test/e2e/flows/*.yaml; do
  name=$(basename "$flow" .yaml)
  if [ -z "${E2E_FLOW:-}" ] || [[ " $E2E_FLOW " == *" $name "* ]]; then flows+=("$flow"); fi
done
[ "${#flows[@]}" -gt 0 ] || fail "돌릴 플로가 없다(E2E_FLOW=${E2E_FLOW:-})"
[ -z "${E2E_FLOW:-}" ] || echo "E2E_FLOW 로 플로 ${#flows[@]}개만 돈다: $E2E_FLOW"

failed=()
for flow in "${flows[@]}"; do
  run_flow "$flow" || failed+=("$(basename "$flow" .yaml)")
done
if [ "${E2E_CHECKS:-}" = 1 ]; then
  run_checks || failed+=("checks")
fi

[ "${#skipped[@]}" -eq 0 ] || echo "iOS 에서 건너뛴 플로 ${#skipped[@]}개: ${skipped[*]}"
[ "${#failed[@]}" -eq 0 ] || fail "실패한 플로 ${#failed[@]}개: ${failed[*]}"
echo "=== E2E(iOS, $BACKEND_KIND) 통과 - 플로 $((${#flows[@]} - ${#skipped[@]}))개 ==="
