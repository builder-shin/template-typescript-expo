#!/usr/bin/env bash
# E2E 게이트 단계 - Android 에뮬레이터 + 백엔드 스택 + Maestro(스펙 12장·11.3·11.4). 게이트는 FastAPI 로, CI 의
# e2e-android 잡은 백엔드마다(BACKEND_KIND) 미리 만든 APK(E2E_APK)로 부른다(스펙 13장).
#
#   test/e2e/run-android.sh
#
# 순서: 백엔드 종류 검증 → 도구 확인 → 기기 준비 → e2e APK(빌드 입력이 지난번과 같으면 다시 만들지 않는다) →
# 설치 → 백엔드 스택 → test/e2e/flows/*.yaml 을 하나씩 돌리며 플로마다 기기 로그에 가드를 걸고 백엔드 요청 수를
# 단언한다(test/e2e/request-counts.ts) → E2E_CHECKS=1 이면 백엔드 대신 멈춘 서버로 test/e2e/checks/*.yaml → 이 저장소의
# compose 프로젝트만 내린다(실패해도 내린다).
#
# ## 환경 변수
#
#   E2E_AVD           켜진 기기가 없을 때 부팅할 AVD 이름(예: Pixel_9_API_36)
#   ANDROID_SERIAL    기기가 여럿일 때 하나를 고르는 adb 의 표준 변수
#   E2E_API_PORT      백엔드를 여는 호스트 포트. 기본 4100(docker-compose.e2e.yml 과 같은 값)
#   E2E_STAGE_DIR     Windows 에서 저장소 경로가 길 때 빌드할 짧은 경로. 기본 C:/t/e
#   E2E_FORCE_BUILD   1 이면 빌드 입력이 같아도 APK 를 다시 만든다
#   E2E_ACCESS_EXPIRES_SECONDS
#                     백엔드의 access token 수명(초). 기본 10 - 60 이하라 앱이 쓰기마다 먼저 회전한다
#                     (lib/auth/session-manager.ts, 스펙 7.2). 플로가 앱 밖에서 쓰는 토큰(test/e2e/scripts/)도
#                     이 수명을 따른다
#   E2E_FLOW          돌릴 플로 이름(공백으로 구분, 확장자 없이). 비우면 전부 - 게이트는 비우고 부른다
#   MAESTRO           Maestro 실행 파일. 기본은 PATH 의 maestro, 없으면 ~/.maestro/bin/maestro. 2.11.x 여야 한다
#   BACKEND_KIND      fastapi·nestjs·rails(기본 fastapi) - 띄울 compose 프로파일. test/e2e/matrix.ts 의
#                     backendKind() 가 검증한다 - 알려진 셋이 아니면 도커·기기를 건드리기 전에 멈춘다
#   E2E_APK           미리 만든 e2e APK(CI 의 build-android 잡). 주면 빌드하지 않고 그 APK 를 설치한다
#   E2E_CHECKS        1 이면 플로 뒤에 백엔드를 내리고 같은 포트에 멈춘 서버(test/e2e/stall-server.ts)를 띄워
#                     test/e2e/checks/*.yaml 을 돈다 - 요청 타임아웃을 기기에서 잰다
#
# ## 플로 머리말
#
# 플로 파일의 주석 세 가지를 읽는다(test/e2e/AGENTS.md):
#
#   # e2e-allow-http: 409     플로가 일부러 일으키는 2xx 밖의 상태. 여기 없는 상태가 기기 로그에
#                             나와도, 여기 적은 상태가 한 번도 나오지 않아도 실패다(test/e2e/guard-log.sh)
#   # e2e-app-locale: ko-KR   앱별 언어. 주면 앱 상태를 지우고(pm clear) 그 언어를 정하고, 키보드 자판이
#                             없는 입력기(IME)로 바꾼 뒤 돈다(아래 "입력기" 절). 플로에는 APP_LOCALE 로도 넘긴다 -
#                             iOS 하네스가 실행 인자(-AppleLanguages)로 거는 값이다
#   # e2e-platforms: android   이 플로가 도는 플랫폼(android·ios, 공백으로 구분). 없으면 둘 다다. 빠진 플랫폼의
#                             하네스는 그 플로를 건너뛰고 그 사실을 적는다
#
# 플로에는 EMAIL·OTHER_EMAIL(플로마다 새로 만든다 - test/e2e/probe-email.ts)과 PASSWORD 가 env 로
# 들어간다. OTHER_EMAIL 은 한 플로 안에서 두 번째 사용자가 필요할 때 쓴다. API_URL 은 호스트에서
# 백엔드에 닿는 주소다 - 플로의 runScript(test/e2e/scripts/)가 앱을 거치지 않고 행을 만들 때 쓴다.
# 결과(Maestro 출력·디버그 기록·기기 로그·그 플로 동안의 백엔드 접근 로그 api.log)는 플로마다
# .maestro-output/e2e/<플로>/ 에 남는다.
set -euo pipefail
cd "$(dirname "$0")/../.."

# 백엔드 종류를 먼저 검증한다 - 알려진 셋이 아니면 도커·기기를 건드리지 않고 멈춘다(test/e2e/matrix.ts 머리말).
BACKEND_KIND=$(node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --input-type=module \
  -e "import { backendKind } from './test/e2e/matrix.ts'; process.stdout.write(backendKind())") || exit 1
readonly BACKEND_KIND

readonly REPO_ROOT="$PWD"
readonly PROJECT=template-typescript-expo-e2e
readonly APP_ID=com.example.templateexpo.e2e
readonly APK=android/app/build/outputs/apk/release/app-release.apk
readonly API_PORT="${E2E_API_PORT:-4100}"
readonly APP_BACKEND_URL="http://10.0.2.2:$API_PORT"
readonly STAGE_DIR="${E2E_STAGE_DIR:-C:/t/e}"
readonly STAGE_MARK=.e2e-stage
readonly OUT=.maestro-output/e2e
# 가입·로그인에 쓰는 비밀번호 - 백엔드의 12자 하한을 넘고 실전 값이 아니다.
readonly E2E_PASSWORD=probe-password-value

export E2E_API_PORT="$API_PORT"
# docker-compose.e2e.yml 이 세 백엔드의 JWT_ACCESS_EXPIRES_SECONDS 로 넘긴다.
export E2E_ACCESS_EXPIRES_SECONDS="${E2E_ACCESS_EXPIRES_SECONDS:-10}"
export MAESTRO_CLI_NO_ANALYTICS=1
export MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true

fail() {
  echo "E2E: $*" >&2
  exit 1
}

compose() {
  docker compose -p "$PROJECT" -f docker-compose.e2e.yml "$@"
}

# 내릴 때는 세 프로파일을 모두 준다 - down 도 활성 프로파일만 대상으로 삼는다(compose 머리말).
compose_down() {
  compose --profile fastapi --profile nestjs --profile rails down -v --remove-orphans >/dev/null 2>&1 || true
}

# ── 도구 ────────────────────────────────────────────────────────────
command -v docker >/dev/null || fail "docker 가 없다"
docker info >/dev/null 2>&1 || fail "Docker 데몬에 닿지 못한다 - Docker 를 켠다"
[ -n "${ANDROID_HOME:-}" ] || fail "ANDROID_HOME 이 없다 - Android SDK 경로를 준다"
readonly ADB="$ANDROID_HOME/platform-tools/adb"
"$ADB" version >/dev/null 2>&1 || fail "adb 를 실행하지 못한다: $ADB"
MAESTRO="${MAESTRO:-$(command -v maestro || printf '%s' "$HOME/.maestro/bin/maestro")}"
# 이 하네스와 플로가 기대는 Maestro 의 동작 - 사용 통계를 끄는 MAESTRO_CLI_NO_ANALYTICS, 글자마다 키 이벤트를
# 보내는 inputText(아래 "입력기" 절) - 은 2.11.0 에서 쟀다. 다른 판이면 돌리지 않는다.
maestro_out=$("$MAESTRO" --version 2>/dev/null) ||
  fail "Maestro 를 실행하지 못한다: $MAESTRO - cli-2.11.0 을 ~/.maestro 에 푼다(docs/superpowers/notes/2026-09-30-d1-measurements.md 의 M8 절)"
# 버전 앞뒤에 안내 줄이 붙을 수 있다(사용 통계·분석 안내 - D1 실측 M8) - 숫자로 시작하는 마지막 줄을 버전으로 읽는다.
maestro_version=$(printf '%s\n' "$maestro_out" | tr -d '\r' | grep -E '^[0-9]' | tail -n 1 || true)
case "$maestro_version" in
  2.11.*) ;;
  *) fail "Maestro 는 2.11.x 여야 한다 - $MAESTRO 는 ${maestro_version:-버전을 내지 않았다}. 사용 통계를 끄는 변수와 inputText 의 동작은 2.11.0 에서 쟀다(docs/superpowers/notes/2026-09-30-d1-measurements.md 의 M8 절)" ;;
esac
command -v unzip >/dev/null || fail "unzip 이 없다 - APK 의 앱 설정을 확인할 때 쓴다"
command -v node >/dev/null || fail "node 가 없다"
command -v curl >/dev/null || fail "curl 이 없다"

# ── 입력기 ──────────────────────────────────────────────────────────
# 앱별 언어를 정한 플로는 키보드 자판이 없는 입력기(IME)로 바꿔 놓고 돈다. Gboard 는 앞에 뜬 앱의 앱별
# 언어를 따라 자판을 바꾸고(ko-KR 이면 두벌식), Maestro 의 inputText 는 글자마다 키 이벤트를 보낸다 - 그
# 자판이 라틴 글자를 한글 자모로 조합해 이메일이 깨진다(docs/superpowers/notes/2026-09-30-d2-measurements.md
# 의 H2). 자판이 없는 입력기(음성 입력)는 키 이벤트를 조합하지 않고 입력 칸으로 넘긴다. 입력기를 모두 끄는
# 길은 쓰지 않는다 - 그렇게 끄고 돌린 플로에서 Maestro 세션이 앱을 띄운 직후 기본 키보드가 다시 켜졌다
# (관찰이다. Maestro 는 세션마다 기기에 드라이버 앱을 설치하는데, 그것이 원인인지는 재지 않았다). 바꾸기
# 전의 설정 셋을 적어 두었다가 플로가 끝나면 그대로 되돌린다 - 하네스가 도중에 끝나도 EXIT 에서 되돌린다.
# 다른 플로는 키보드를 둔 채 돈다(키보드가 떠 있어도 제출 버튼이 한 번에 눌리는지를 함께 잰다).
readonly -a IME_SETTINGS=(enabled_input_methods default_input_method selected_input_method_subtype)
ime_saved=()

# 설치된 입력기 가운데 키보드 자판(subtype 의 mode 가 keyboard)이 하나도 없는 첫 입력기의 ID. 켜지 않은 것도
# 본다(-a) - 새로 만든 AVD(CI)는 음성 입력이 설치돼 있어도 켜져 있지 않을 수 있다. 켜는 것은 use_keyless_ime 다.
keyless_ime() {
  "$ADB" shell ime list -a | tr -d '\r' | awk '
    function flush() { if (id != "" && !keyboard && first == "") first = id }
    /^[^ ].*:$/ { flush(); id = substr($0, 1, length($0) - 1); keyboard = 0; next }
    /mSubtypeMode=keyboard/ { keyboard = 1 }
    END { flush(); if (first != "") print first }'
}

use_keyless_ime() {
  local key ime
  ime=$(keyless_ime)
  if [ -z "$ime" ]; then
    # CI 에서는 끝난 뒤 기기에 물을 수 없다 - 설치된 입력기를 로그에 남긴다.
    echo "E2E: 키보드 자판이 없는 입력기가 설치돼 있지 않다 - 앱별 언어 플로는 음성 입력 같은 입력기가 필요하다. 설치된 입력기:" >&2
    "$ADB" shell ime list -a -s >&2 || true
    return 1
  fi
  for key in "${IME_SETTINGS[@]}"; do
    ime_saved+=("$("$ADB" shell settings get secure "$key" | tr -d '\r')")
  done
  # 켜진 입력기 목록(enabled_input_methods)은 위에서 적어 두었다 - 되돌릴 때 켠 것도 함께 꺼진다.
  "$ADB" shell ime enable "$ime" >/dev/null || return 1
  "$ADB" shell ime set "$ime" >/dev/null || return 1
  if [ "$("$ADB" shell settings get secure default_input_method | tr -d '\r')" != "$ime" ]; then
    echo "E2E: 입력기를 $ime 로 바꾸지 못했다" >&2
    return 1
  fi
}

# settings get 은 값이 없으면 null 을 준다 - 그 자리는 지운다. 값에 ; 가 들어 있어 기기 셸에 따옴표로
# 넘긴다. 되돌린 뒤 기본 입력기가 적어 둔 값과 같은지 확인한다.
ime_restore() {
  local i key value
  [ "${#ime_saved[@]}" -gt 0 ] || return 0
  for i in "${!IME_SETTINGS[@]}"; do
    key=${IME_SETTINGS[$i]}
    value=${ime_saved[$i]}
    if [ "$value" = null ]; then
      "$ADB" shell settings delete secure "$key" >/dev/null || return 1
    else
      "$ADB" shell "settings put secure $key '$value'" || return 1
    fi
  done
  if [ "$("$ADB" shell settings get secure default_input_method | tr -d '\r')" != "${ime_saved[1]}" ]; then
    echo "E2E: 기본 입력기를 되돌리지 못했다 (적어 둔 값: ${ime_saved[1]})" >&2
    return 1
  fi
  ime_saved=()
}

# ── 빌드 ────────────────────────────────────────────────────────────
existing_files() {
  local file
  while IFS= read -r -d '' file; do
    if [ -f "$file" ]; then printf '%s\0' "$file"; fi
  done
}

# 빌드에 들어가는 파일의 지문 - 시험·문서·스크립트·마크다운을 뺀 추적·미추적(무시 제외) 파일의
# 이름과 내용, 빌드 레시피, 그리고 앱이 볼 백엔드 주소. 플로만 고친 실행은 APK 를 다시 만들지 않는다.
# 빌드 레시피(test/e2e/android.sh - prebuild 인자와 APP_VARIANT)는 test/ 안에 있어 위 목록의 제외에
# 걸린다(git 의 제외 pathspec 은 포함 pathspec 보다 앞선다) - 따로 더한다. 빠지면 레시피를 고쳐도 낡은
# APK 가 조용히 다시 쓰인다.
build_fingerprint() {
  {
    git ls-files -z -co --exclude-standard -- . ':!test' ':!docs' ':!scripts' ':!*.md' |
      existing_files | xargs -0 sha1sum
    sha1sum test/e2e/android.sh
    printf 'BACKEND_URL=%s\n' "$APP_BACKEND_URL"
  } | sha1sum | cut -d ' ' -f 1
}

# Windows 에서 저장소 경로가 길면 짧은 경로에 사본을 만든다(test/e2e/android.sh check-path).
stage_sources() {
  if [ -d "$STAGE_DIR" ] && [ ! -e "$STAGE_DIR/$STAGE_MARK" ] && [ -n "$(ls -A "$STAGE_DIR")" ]; then
    fail "$STAGE_DIR 가 비어 있지 않은데 이 하네스가 만든 사본이 아니다($STAGE_MARK 없음) - 지우지 않는다. E2E_STAGE_DIR 로 다른 경로를 준다"
  fi
  mkdir -p "$STAGE_DIR"
  # node_modules 만 남기고 지운 뒤 다시 복사한다 - 저장소에서 지운 라우트 파일이 사본에 남으면
  # Expo Router 가 그것까지 라우트로 묶는다. node_modules 는 락파일이 같으면 설치가 몇 초로 끝난다.
  # 표식은 지우지 않는다 - 지우기가 도중에 멈춰도(다른 프로세스가 쥔 파일) 다음 실행이 이 사본을 알아본다.
  find "$STAGE_DIR" -mindepth 1 -maxdepth 1 ! -name node_modules ! -name "$STAGE_MARK" -exec rm -rf {} +
  touch "$STAGE_DIR/$STAGE_MARK"
  git ls-files -z -co --exclude-standard | existing_files | tar --null -T - -cf - | (cd "$STAGE_DIR" && tar -xf -)
  (cd "$STAGE_DIR" && pnpm install --frozen-lockfile)
}

build_and_install() {
  local root fingerprint stamp
  # CI 는 APK 를 한 번 만들어 백엔드 셋이 나눠 쓴다(스펙 16장의 "E2E 빌드 시간") - 받은 APK 를 그대로 설치한다.
  if [ -n "${E2E_APK:-}" ]; then
    [ -f "$E2E_APK" ] || fail "E2E_APK 가 가리키는 APK 가 없다: $E2E_APK"
    echo "미리 만든 APK 를 쓴다 - 빌드하지 않는다 ($E2E_APK)"
    "$ADB" install -r "$E2E_APK"
    return
  fi
  if test/e2e/android.sh check-path >/dev/null 2>&1; then root="$REPO_ROOT"; else root="$STAGE_DIR"; fi
  fingerprint=$(build_fingerprint)
  stamp="$root/$APK.fingerprint"
  if [ "${E2E_FORCE_BUILD:-}" != 1 ] && [ -f "$root/$APK" ] && [ "$(cat "$stamp" 2>/dev/null || true)" = "$fingerprint" ]; then
    echo "빌드 입력이 지난번과 같다 - APK 를 다시 만들지 않는다 ($root/$APK)"
  else
    [ "$root" = "$REPO_ROOT" ] || stage_sources
    (cd "$root" && BACKEND_URL="$APP_BACKEND_URL" test/e2e/android.sh build)
    printf '%s\n' "$fingerprint" >"$stamp"
  fi
  (cd "$root" && test/e2e/android.sh install)
}

# ── 플로 ────────────────────────────────────────────────────────────
header() {
  sed -n "s/^# $2: *//p" "$1" | head -n 1
}

# node 는 package.json 에 "type" 이 없는 .ts 를 ESM 으로 다시 읽으며 경고를 낸다 - 하네스 출력에
# 소음만 되므로 그 경고 하나를 끈다.
probe_email() {
  node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --input-type=module \
    -e "import { probeEmail } from './test/e2e/probe-email.ts'; process.stdout.write(probeEmail('probe-e2e', process.argv[1]))" "$1"
}

# 실패한 플로의 기록에서 앱 밖(기기·adb)의 실패로 보이는 흔적을 짚는다 - 짚기만 하고 재시도하지 않는다(스펙 16장).
# D5 실측 C2 의 두 번: Maestro 의 기기 드라이버가 앱 창을 찾지 못한 정지(UiAutomator 의 "Active window root not
# found" - 오래 켠 에뮬레이터)와 Maestro 가 연결하지 못한 것(java.net.ConnectException). 같은 경고는 통과한 플로에도
# 몇 번 있을 수 있어 실패한 플로에서만 부른다. test/unit/e2e/environment-hint.test.ts 가 이 함수를 떼어 돌린다.
environment_hint() {
  local out=$1 stalls connect
  stalls=$(grep -c 'Active window root not found' "$out/logcat.txt" 2>/dev/null || true)
  if [ "${stalls:-0}" -gt 0 ]; then
    echo "E2E: 환경 흔적 - 기기 로그에 UiAutomator 의 'Active window root not found' ${stalls}번 - Maestro 가 앱 창을 찾지 못한 정지일 수 있다(에뮬레이터를 다시 부팅해 가른다: test/e2e/android.sh boot)" >&2
  fi
  connect=$(grep -m 1 'java.net.ConnectException' "$out/maestro.log" 2>/dev/null || true)
  if [ -n "$connect" ]; then
    echo "E2E: 환경 흔적 - Maestro 가 연결하지 못했다: $connect (adb devices 와 백엔드를 본다)" >&2
  fi
  return 0
}

run_flow() {
  local flow=$1 name locale allowed platforms email other_email out since rc=0 logcat_rc=0
  local device_args=()
  name=$(basename "$flow" .yaml)
  locale=$(header "$flow" e2e-app-locale)
  allowed=$(header "$flow" e2e-allow-http)
  platforms=$(header "$flow" e2e-platforms)
  if [ -n "$platforms" ] && [[ " $platforms " != *" android "* ]]; then
    echo "--- $name (건너뛴다 - e2e-platforms: $platforms)"
    skipped+=("$name")
    return 0
  fi
  email=$(probe_email "$name")
  other_email=$(probe_email "$name-other")
  out="$OUT/$name"
  mkdir -p "$out"
  [ -z "${ANDROID_SERIAL:-}" ] || device_args=(--device "$ANDROID_SERIAL")

  # 기기 로그는 이 플로의 것만 담아야 한다 - 비우지 못하면 앞 플로의 줄이 섞여 가드가 엉뚱한 것을 잰다.
  if ! "$ADB" logcat -c; then
    echo "E2E: $name 앞에서 기기 로그를 비우지 못했다(adb logcat -c)" >&2
    return 1
  fi
  if [ -n "$locale" ]; then
    # 로캘 플로는 clearState 를 쓰지 않는다 - 상태 지우기가 앱별 언어까지 지운다(D1 실측 M3).
    # 그래서 여기서 먼저 지우고 언어를 정한다. 입력기는 자판이 없는 것으로 바꾼다(위 "입력기" 절).
    if ! "$ADB" shell pm clear "$APP_ID" >/dev/null ||
      ! "$ADB" shell cmd locale set-app-locales "$APP_ID" --locales "$locale"; then
      echo "E2E: $name 앞에서 앱 상태를 지우거나 앱별 언어를 정하지 못했다(pm clear·set-app-locales)" >&2
      return 1
    fi
    if ! use_keyless_ime; then
      ime_restore || true
      return 1
    fi
  fi

  echo "--- $name${locale:+ ($locale)}"
  # 백엔드 접근 로그를 이 플로의 몫만 남긴다 - 5초 앞에서 자른다(호스트와 Docker 의 시계 차이). Unix 시각이라
  # GNU·BSD date 모두에서 같다(docker compose logs --since 가 받는다).
  since=$(($(date +%s) - 5))
  "$MAESTRO" test --no-ansi ${device_args[@]+"${device_args[@]}"} --debug-output "$out/debug" \
    -e "EMAIL=$email" -e "OTHER_EMAIL=$other_email" -e "PASSWORD=$E2E_PASSWORD" \
    -e "API_URL=http://127.0.0.1:$API_PORT" -e "APP_LOCALE=$locale" "$flow" >"$out/maestro.log" 2>&1 || rc=$?
  # adb 의 오류도 그 파일에 남긴다(2>&1) - 모으지 못한 까닭을 거기서 본다. UiDevice 의 경고는 Maestro 의 기기
  # 드라이버 것이다 - 가드는 보지 않고 실패한 플로의 환경 흔적(environment_hint)이 센다.
  "$ADB" logcat -d -v brief -s ReactNativeJS:V AndroidRuntime:E UiDevice:W >"$out/logcat.txt" 2>&1 || logcat_rc=$?
  # 백엔드 접근 로그는 원인을 가르는 기록일 뿐 가드가 아니다 - 모으지 못해도 플로를 실패로 치지 않는다.
  compose --profile "$BACKEND_KIND" logs --no-color --since "$since" "api-$BACKEND_KIND" >"$out/api.log" 2>&1 || true
  if ! ime_restore; then
    echo "E2E: $name 뒤에 입력기 설정을 되돌리지 못했다 - adb shell settings get secure default_input_method 로 확인한다(되돌리는 법은 test/e2e/AGENTS.md)" >&2
    return 1
  fi

  if [ "$rc" -ne 0 ]; then
    tail -n 30 "$out/maestro.log" >&2
    echo "E2E: $name 플로가 실패했다(exit $rc) - 기록: $out" >&2
    environment_hint "$out"
    return 1
  fi
  # 기기 로그를 모으지 못했으면 가드가 잰 것이 없다 - 통과로 치지 않는다. adb 가 exit 0 이어도 앱의 줄이
  # 하나도 없는 로그는 가드가 실패로 만든다(test/e2e/guard-log.sh).
  if [ "$logcat_rc" -ne 0 ]; then
    echo "E2E: $name 의 기기 로그를 모으지 못했다(adb logcat exit $logcat_rc) - $out/logcat.txt" >&2
    return 1
  fi
  # 허용 상태는 공백으로 나뉜 여러 인자로 넘긴다.
  # shellcheck disable=SC2086
  if ! test/e2e/guard-log.sh "$out/logcat.txt" $allowed; then
    echo "E2E: $name 의 기기 로그가 가드에 걸렸다 - $out/logcat.txt" >&2
    return 1
  fi
  # 앱의 요청 수(쓰기마다 회전, 돌아온 목록의 재조회, 두 번 누른 제출의 요청 하나)를 이 플로의 접근 로그에서 단언한다 -
  # D4 실측 W2–W4 가 손으로 센 것이다. FastAPI 의 접근 로그만 센다(test/e2e/request-counts.ts 머리말).
  if ! node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON test/e2e/request-counts.ts "$name" "$out/api.log" "$BACKEND_KIND"; then
    echo "E2E: $name 의 백엔드 요청 수가 어긋났다 - $out/api.log" >&2
    return 1
  fi
}

# ── 멈춘 서버 확인(E2E_CHECKS=1) ─────────────────────────────────────
# 백엔드를 내리고 같은 포트에 test/e2e/stall-server.ts 를 띄워 test/e2e/checks/ 를 돈다. 확인 플로는 두 요청이 모두
# 타임아웃으로 끝나야 통과다 - 서버가 없어 연결이 거절되면(NETWORK_ERROR) 화면은 같으므로 기기 로그의
# REQUEST_TIMEOUT 두 줄과 서버 기록의 두 방식을 함께 본다.
STALL_PID=''

stop_stall_server() {
  [ -n "$STALL_PID" ] || return 0
  kill "$STALL_PID" 2>/dev/null || true
  wait "$STALL_PID" 2>/dev/null || true
  STALL_PID=''
}

run_checks() {
  local flow name stall_log="$OUT/stall-server.log" failed_checks=0 waited=0
  compose_down
  node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON test/e2e/stall-server.ts "$API_PORT" >"$stall_log" 2>&1 &
  STALL_PID=$!
  until grep -q '^stall-server ' "$stall_log" 2>/dev/null; do
    kill -0 "$STALL_PID" 2>/dev/null || { cat "$stall_log" >&2; fail "멈춘 서버가 뜨지 못했다"; }
    [ "$waited" -lt 20 ] || fail "멈춘 서버가 10초 안에 뜨지 않았다"
    sleep 0.5
    waited=$((waited + 1))
  done
  for flow in test/e2e/checks/*.yaml; do
    name=$(basename "$flow" .yaml)
    if ! run_flow "$flow"; then
      failed_checks=1
      failed+=("checks/$name")
      continue
    fi
    cp "$stall_log" "$OUT/$name/api.log"
    if [ "$(grep -c 'REQUEST_TIMEOUT' "$OUT/$name/logcat.txt" || true)" -lt 2 ] ||
      ! grep -q 'mode=headers' "$stall_log" || ! grep -q 'mode=body' "$stall_log"; then
      echo "E2E: checks/$name - 두 요청이 모두 멈춘 서버에서 REQUEST_TIMEOUT 으로 끝나지 않았다(기록: $OUT/$name, $stall_log)" >&2
      failed_checks=1
      failed+=("checks/$name")
    fi
  done
  stop_stall_server
  return "$failed_checks"
}

# ── 실행 ────────────────────────────────────────────────────────────
rm -rf "$OUT"
mkdir -p "$OUT"
test/e2e/android.sh boot
build_and_install

# 끝날 때(실패해도) 입력기 설정을 되돌리고 스택을 내린다.
cleanup() {
  ime_restore || echo "E2E: 입력기 설정을 되돌리지 못했다 - adb shell settings get secure default_input_method 로 확인한다(되돌리는 법은 test/e2e/AGENTS.md)" >&2
  stop_stall_server
  compose_down
}
trap cleanup EXIT
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --input-type=module \
  -e "import { backendKind, reportKnownDivergences } from './test/e2e/matrix.ts'; reportKnownDivergences(backendKind())"
compose_down
compose --profile "$BACKEND_KIND" up -d --build --wait
curl -fsS "http://127.0.0.1:$API_PORT/health/ready" >/dev/null ||
  fail "$BACKEND_KIND 백엔드가 127.0.0.1:$API_PORT 에서 준비되지 않았다"

flows=()
for flow in test/e2e/flows/*.yaml; do
  name=$(basename "$flow" .yaml)
  if [ -z "${E2E_FLOW:-}" ] || [[ " $E2E_FLOW " == *" $name "* ]]; then flows+=("$flow"); fi
done
[ "${#flows[@]}" -gt 0 ] || fail "돌릴 플로가 없다(E2E_FLOW=${E2E_FLOW:-})"
[ -z "${E2E_FLOW:-}" ] || echo "E2E_FLOW 로 플로 ${#flows[@]}개만 돈다: $E2E_FLOW"

failed=()
skipped=()
for flow in "${flows[@]}"; do
  run_flow "$flow" || failed+=("$(basename "$flow" .yaml)")
done
if [ "${E2E_CHECKS:-}" = 1 ]; then
  run_checks || true
fi

[ "${#skipped[@]}" -eq 0 ] || echo "Android 에서 건너뛴 플로 ${#skipped[@]}개: ${skipped[*]}"
[ "${#failed[@]}" -eq 0 ] || fail "실패한 플로 ${#failed[@]}개: ${failed[*]}"
echo "=== E2E 통과 - 플로 $((${#flows[@]} - ${#skipped[@]}))개 ==="
