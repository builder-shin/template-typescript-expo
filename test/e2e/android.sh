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
