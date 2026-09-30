#!/usr/bin/env bash
# Android 기기 도우미 - 실측과 E2E 하네스가 함께 쓴다.
#
#   test/e2e/android.sh boot      켜진 기기가 없으면 E2E_AVD 를 부팅하고 부팅 완료까지 기다린다.
#                                 BOOT_TIMEOUT_SECONDS(기본 300) 안에 끝나지 않거나 에뮬레이터가
#                                 죽으면 에뮬레이터 로그의 꼬리를 내고 실패한다
#   test/e2e/android.sh build     e2e 변형 Release APK 를 만든다 (BACKEND_URL 필요).
#                                 만든 APK 의 assets/app.config 가 e2e 변형인지 확인한다
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
BOOT_TIMEOUT_SECONDS="${BOOT_TIMEOUT_SECONDS:-300}"

# adb devices 는 ANDROID_SERIAL 을 무시하므로 고른 기기만 직접 센다.
device_count() {
  "$ADB" devices | awk -v serial="${ANDROID_SERIAL:-}" 'NR > 1 && $2 == "device" && (serial == "" || $1 == serial)' | wc -l | tr -d ' '
}

boot_completed() {
  [ "$("$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]
}

boot() {
  local emulator_pid=''
  local emulator_log=''
  if [ "$(device_count)" -ge 1 ]; then
    echo "기기가 이미 연결돼 있다"
  else
    : "${E2E_AVD:?켜진 기기가 없다 - 부팅할 AVD 이름을 E2E_AVD 로 준다 (예: Pixel_9_API_36)}"
    emulator_log="${TMPDIR:-/tmp}/e2e-emulator-$E2E_AVD.log"
    "$EMULATOR" -avd "$E2E_AVD" -no-snapshot-save -no-boot-anim -no-audio >"$emulator_log" 2>&1 </dev/null &
    emulator_pid=$!
  fi
  # 기기 등록과 부팅 완료를 같은 제한 안에서 기다린다. 에뮬레이터가 죽거나 시간이 다 되면
  # 그 로그의 꼬리를 내고 멈춘다 - 아무 말 없이 영원히 기다리지 않는다.
  local waited=0
  until [ "$(device_count)" -ge 1 ] && boot_completed; do
    if [ -n "$emulator_pid" ] && ! kill -0 "$emulator_pid" 2>/dev/null; then
      echo "에뮬레이터가 부팅 도중 종료됐다 (로그: $emulator_log)" >&2
      tail -n 20 "$emulator_log" >&2
      exit 1
    fi
    if [ "$waited" -ge "$BOOT_TIMEOUT_SECONDS" ]; then
      echo "${BOOT_TIMEOUT_SECONDS}초 안에 부팅이 끝나지 않았다${emulator_log:+ (로그: $emulator_log)}" >&2
      [ -z "$emulator_log" ] || tail -n 20 "$emulator_log" >&2
      exit 1
    fi
    sleep 2
    waited=$((waited + 2))
  done
  # 애니메이션을 끈다 - 화면 전환 중의 단언이 흔들리지 않게 한다(스펙 16장).
  "$ADB" shell settings put global window_animation_scale 0
  "$ADB" shell settings put global transition_animation_scale 0
  "$ADB" shell settings put global animator_duration_scale 0
}

# Gradle 의 createExpoConfig 가 app.config.ts 를 다시 평가해 APK 의 assets/app.config(앱이 읽는
# Constants.expoConfig)로 넣는다. 그 프로세스가 APP_VARIANT 를 못 받으면 네이티브는 e2e 인데 앱
# 설정은 development 인 APK 가 나온다.
assert_apk_variant() {
  command -v unzip >/dev/null || { echo "unzip 이 필요하다 - APK 의 앱 설정을 확인하지 못한다" >&2; exit 1; }
  local variant
  if ! variant=$(unzip -p "$APK" assets/app.config | node -e 'process.stdout.write(String(JSON.parse(require("fs").readFileSync(0, "utf8")).extra?.appVariant))'); then
    echo "APK 에서 assets/app.config 를 읽지 못했다: $APK" >&2
    exit 1
  fi
  if [ "$variant" != "e2e" ]; then
    echo "APK 의 앱 설정이 e2e 변형이 아니다 (extra.appVariant=$variant) - Gradle 이 APP_VARIANT 를 받지 못했다" >&2
    exit 1
  fi
  echo "APK 의 앱 설정: extra.appVariant=$variant"
}

build() {
  : "${BACKEND_URL:?BACKEND_URL 이 필요하다 - 에뮬레이터에서 호스트는 http://10.0.2.2:<포트>}"
  # prebuild 와 Gradle 이 같은 변형을 받도록 export 한다(접두 대입은 그 명령 하나에만 적용된다).
  export APP_VARIANT=e2e
  pnpm exec expo prebuild --platform android --clean --no-install
  (cd android && ./gradlew assembleRelease)
  assert_apk_variant
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
