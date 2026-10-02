#!/usr/bin/env bash
# Android 기기 도우미 - E2E 하네스(test/e2e/run-android.sh)가 쓴다.
#
#   test/e2e/android.sh boot        켜진 기기가 없으면 E2E_AVD 를 부팅하고 부팅 완료까지 기다린다.
#                                   BOOT_TIMEOUT_SECONDS(기본 300) 안에 끝나지 않거나 에뮬레이터가
#                                   죽으면 에뮬레이터 로그의 꼬리를 내고 실패한다. 기기가 여럿인데
#                                   ANDROID_SERIAL 이 없으면 곧바로 실패한다. 끝으로 기기 로그의 링
#                                   버퍼를 16MiB 로 넓히고 비행기 모드를 끈다(이미 켜진 기기도)
#   test/e2e/android.sh check-path  이 위치에서 Android 네이티브 빌드가 되는가 - Windows 에서 저장소
#                                   경로가 47자를 넘으면 실패한다
#   test/e2e/android.sh build       e2e 변형 Release APK 를 만든다 (BACKEND_URL 필요).
#                                   빌드 앞에 Metro 의 디스크 캐시를 비우고, 만든 APK 의
#                                   assets/app.config 가 e2e 변형인지 확인한다
#                                   앱 설정과 AndroidManifest.xml 이 OTA 를 끄고 평문 HTTP 를 켰는지도 확인한다
#   test/e2e/android.sh install     만든 APK 를 설치한다
#   test/e2e/android.sh wait-text <텍스트>
#                                   그 텍스트가 화면에 나타날 때까지(최대 60초) 기다리고
#                                   UI 덤프를 stdout 에 낸다
#
# 기기가 여럿이면 ANDROID_SERIAL 로 하나를 고른다(adb 의 표준 변수).
set -euo pipefail
cd "$(dirname "$0")/../.."

: "${ANDROID_HOME:?ANDROID_HOME 이 필요하다 - Android SDK 경로}"
ADB="$ANDROID_HOME/platform-tools/adb"
EMULATOR="$ANDROID_HOME/emulator/emulator"
APK=android/app/build/outputs/apk/release/app-release.apk
BOOT_TIMEOUT_SECONDS="${BOOT_TIMEOUT_SECONDS:-300}"
WAIT_TEXT_TIMEOUT_SECONDS=60

# Windows 에서 Android 네이티브 빌드(Gradle·CMake·ninja)는 저장소 루트가 이 길이 이하일 때만 된다
# (docs/superpowers/notes/2026-09-30-d1-measurements.md 의 M1 절 - 47자 성공, 50자 실패).
MAX_WINDOWS_ROOT_LENGTH=47

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
  local devices
  devices=$(device_count)
  # 기기가 여럿이면 adb shell 이 "more than one device" 로 죽는다 - 제한 시간 내내 기다리지 않는다.
  if [ "$devices" -ge 2 ] && [ -z "${ANDROID_SERIAL:-}" ]; then
    echo "기기가 ${devices}개 연결돼 있다 - ANDROID_SERIAL 로 하나를 고른다" >&2
    exit 1
  fi
  if [ "$devices" -ge 1 ]; then
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
  # 자동 완성 서비스를 끈다 - 비밀번호 칸이 있는 폼을 제출하면 "비밀번호를 저장할까요" 대화상자가
  # 떠서 플로의 다음 단계를 가릴 수 있다. 앱의 입력은 자동 완성을 막지 않는다.
  "$ADB" shell settings put secure autofill_service null
  # 기기 로그의 링 버퍼를 넓힌다. 하네스는 플로마다 로그를 비우고 끝에 모으는데, 기본 크기는 긴 플로
  # (목록의 무한 스크롤 등) 하나를 다 담지 못할 수 있다 - 앞쪽 줄이 밀려나면 W·E 줄을 놓쳐 가드가 가짜로
  # 통과하고, 선언한 [e2e-http] 줄을 놓쳐 가짜로 실패한다. 재부팅하면 기본 크기로 돌아가므로 부팅할
  # 때마다(이미 켜진 기기여도) 정한다.
  "$ADB" logcat -G 16M
  # 비행기 모드를 끈다. 켜고 끄는 플로(examples-offline-refetch)는 끝나면 스스로 끄지만(onFlowComplete), 하네스가
  # 그 플로 도중에 죽으면 켜진 채 남아 다음 실행의 플로가 전부 백엔드에 닿지 못한다.
  "$ADB" shell cmd connectivity airplane-mode disable
}

check_path() {
  local root
  # Git Bash 의 pwd -W 는 C:/… 모양의 Windows 경로를 준다. 다른 셸에는 -W 가 없다 - 검사하지 않는다.
  root=$(pwd -W 2>/dev/null || true)
  if [ -n "$root" ] && [ "${#root}" -gt "$MAX_WINDOWS_ROOT_LENGTH" ]; then
    echo "저장소 경로가 ${#root}자다 - Windows 의 Android 빌드는 ${MAX_WINDOWS_ROOT_LENGTH}자 이하에서만 된다: $root" >&2
    echo "test/e2e/run-android.sh 는 짧은 경로(E2E_STAGE_DIR)의 사본에서 빌드한다." >&2
    return 1
  fi
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

# e2e 변형은 OTA 를 끄고 평문 HTTP 를 켠다(스펙 10.2·10.6) - 내장 번들로 결정적으로 돌고 10.0.2.2 의 http 백엔드에
# 닿는다. 앱이 읽는 설정(assets/app.config)과, 네이티브 expo-updates 가 읽는 병합된 AndroidManifest.xml 을 본다.
# 바이너리 매니페스트는 Android SDK build-tools 의 aapt2 로 읽는다. 게이트 [8] 은 빌드 전의 설정 플러그인 결과를
# 네 변형 모두 재고, 여기서는 실제로 설치할 APK 를 잰다.
assert_apk_ota_off() {
  local aapt2 config manifest
  aapt2=$(ls "$ANDROID_HOME"/build-tools/*/aapt2 "$ANDROID_HOME"/build-tools/*/aapt2.exe 2>/dev/null | sort -V | tail -n 1 || true)
  if [ -z "$aapt2" ]; then
    echo "aapt2 가 없다 - APK 의 AndroidManifest.xml 을 읽으려면 Android SDK 의 build-tools 가 필요하다" >&2
    exit 1
  fi
  if ! config=$(unzip -p "$APK" assets/app.config | node -e '
  const config = JSON.parse(require("fs").readFileSync(0, "utf8"))
  process.stdout.write(`updates=${JSON.stringify(config.updates)} runtimeVersion=${JSON.stringify(config.runtimeVersion)}`)'); then
    echo "APK 에서 assets/app.config 를 읽지 못했다: $APK" >&2
    exit 1
  fi
  if [ "$config" != 'updates={"enabled":false} runtimeVersion=undefined' ]; then
    echo "APK 의 앱 설정이 OTA 를 끄지 않았다 ($config)" >&2
    exit 1
  fi
  if ! manifest=$("$aapt2" dump xmltree --file AndroidManifest.xml "$APK" | node -e '
  const lines = require("fs").readFileSync(0, "utf8").split(/\r?\n/)
  const meta = new Map()
  let inMeta = false
  let name = null
  let cleartext = "-"
  for (const line of lines) {
    const element = line.match(/^\s*E: (\S+)/)
    if (element) {
      inMeta = element[1] === "meta-data"
      name = null
      continue
    }
    const clear = line.match(/android:usesCleartextTraffic\([^)]*\)=(\S+)/)
    if (clear) cleartext = clear[1]
    if (!inMeta) continue
    const named = line.match(/android:name\([^)]*\)="([^"]*)"/)
    if (named) {
      name = named[1]
      continue
    }
    const valued = line.match(/android:value\([^)]*\)=(?:"([^"]*)"|(\S+))/)
    if (valued && name !== null) meta.set(name, valued[1] ?? valued[2])
  }
  const updates = (key) => meta.get(`expo.modules.updates.${key}`) ?? "-"
  process.stdout.write(`ENABLED=${updates("ENABLED")} URL=${updates("EXPO_UPDATE_URL")} HEADERS=${updates("UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY")} usesCleartextTraffic=${cleartext}`)'); then
    echo "APK 의 AndroidManifest.xml 을 읽지 못했다: $APK" >&2
    exit 1
  fi
  if [ "$manifest" != 'ENABLED=false URL=- HEADERS=- usesCleartextTraffic=true' ]; then
    echo "APK 의 AndroidManifest.xml 이 e2e 변형의 설정이 아니다 ($manifest)" >&2
    exit 1
  fi
  echo "APK 의 OTA: $config · AndroidManifest.xml $manifest"
}

# Metro 의 디스크 캐시(Metro 가 쓰는 os.tmpdir() 의 metro-cache - Windows 는 %TEMP%, 그 밖은 $TMPDIR)를 비운다. Gradle
# 의 번들 단계(createBundleReleaseJsAndAssets)가 번들을 다 쓴 뒤 node 의 종료에서 0xC0000005 로 죽은 빌드가 있었고, 이
# 캐시를 지운 뒤에는 재현되지 않았다(docs/superpowers/notes/2026-09-30-d3-measurements.md 의 L7). 그 번들 명령도
# --reset-cache 를 주므로 캐시가 원인이라는 증명은 아니다 - 재시도가 아니라, 알려진 계기를 빌드마다 없애 빌드가 늘
# 같은 자리에서 시작하게 한다. 지우지 못하면(개발 서버가 쥐고 있다 등) set -e 로 빌드하지 않고 멈춘다.
clear_metro_cache() {
  local cache
  cache=$(node -p 'require("path").join(require("os").tmpdir(), "metro-cache")')
  rm -rf "$cache"
  echo "Metro 캐시를 비웠다: $cache"
}

# D6 의 두 단계 빌드: 둘째 실행에서는 매니페스트 단계가 다시 돌면 안 된다(결정 41).
assemble_release() {
  local gradle_jvm="$1" log rc=0
  log=$(mktemp)
  (cd android && ./gradlew assembleRelease --no-daemon --console=plain "$gradle_jvm") | tee "$log" || rc=$?
  if [ "$rc" -eq 0 ] && ! grep -Fxq '> Task :app:createReleaseUpdatesResources UP-TO-DATE' "$log"; then
    echo "APK 빌드: 둘째 Gradle 의 createReleaseUpdatesResources 가 UP-TO-DATE 가 아니다 - 입력·출력과 Metro 캐시 순서를 확인한다" >&2
    rc=1
  fi
  rm -f "$log"
  return "$rc"
}

build() {
  : "${BACKEND_URL:?BACKEND_URL 이 필요하다 - 에뮬레이터에서 호스트는 http://10.0.2.2:<포트>}"
  check_path || exit 1
  # prebuild 와 Gradle 이 같은 변형을 받도록 export 한다(접두 대입은 그 명령 하나에만 적용된다).
  export APP_VARIANT=e2e
  pnpm exec expo prebuild --platform android --clean --no-install
  clear_metro_cache
  # 데몬 없이 빌드한다 - 빌드가 끝나면 Gradle 프로세스도 끝난다. 남은 데몬은 지난 빌드의 산출물(mergeDexRelease 의
  # classes*.dex)을 쥐고 있어서 Windows 에서 다음 빌드 앞의 사본 지우기(run-android.sh 의 stage_sources)가 "Device or
  # resource busy" 로 멈췄다 - 그 데몬을 멈추자 지워졌다(docs/superpowers/notes/2026-10-01-d4-measurements.md 의 W1).
  # 데몬의 JVM 인자는 명령줄에서 준다(-D 가 prebuild 가 다시 만드는 android/gradle.properties 보다 앞선다). 그 파일의
  # 기본값(-Xmx2048m -XX:MaxMetaspaceSize=512m)으로는 expo-updates 의 KSP2(Room 컴파일러 - 데몬 안에서 돈다)가 병렬
  # lintVital 들과 함께 돈 32코어 머신에서 데몬의 Metaspace 가 상한에 닿아(521246K/524288K) kspReleaseKotlin 이
  # OutOfMemoryError: Metaspace 로 죽고 데몬이 멈췄다(docs/superpowers/notes/2026-10-01-d6-measurements.md 의 O4).
  local gradle_jvm='-Dorg.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m'
  # expo-updates 의 단계(createReleaseUpdatesResources)는 먼저 따로, 빈 Metro 캐시에서 돌린다. 그 단계는 내장 매니페스트
  # (app.manifest)를 만들려고 Metro 를 캐시를 지우지 않고(createManifestForBuildAsync 의 resetCache: false) 돌리는데, 한
  # 빌드 안에서 번들 단계(createBundleReleaseJsAndAssets)가 먼저 채운 캐시 위에서 돌자 매니페스트를 다 쓴 뒤 node 의
  # 종료에서 0xC0000005 로 죽었다 - 같은 명령을 Gradle 밖에서 되풀이하니 캐시를 둔 채 13번 중 7번, 매번 지우고 10번 중
  # 0번이었다(D1 실측 M1 관찰 8·D3 실측 L7 과 같은 모양 - docs/superpowers/notes/2026-10-01-d6-measurements.md 의 O4).
  # 캐시를 다시 비운 뒤의 둘째 Gradle 에서 그 단계는 입력(문자열뿐)과 출력이 같아 UP-TO-DATE 로 건너뛰고, 번들 단계는
  # 스스로 캐시를 지운다(--reset-cache).
  (cd android && ./gradlew :app:createReleaseUpdatesResources --no-daemon "$gradle_jvm")
  clear_metro_cache
  assemble_release "$gradle_jvm"
  assert_apk_variant
  assert_apk_ota_off
  ls -l "$APK"
}

install() {
  "$ADB" install -r "$APK"
}

wait_text() {
  local text="${1:?기다릴 텍스트가 필요하다}"
  local dump=''
  local errors
  errors=$(mktemp)
  local deadline=$((SECONDS + WAIT_TEXT_TIMEOUT_SECONDS))
  until dump=$("$ADB" exec-out uiautomator dump /dev/tty 2>"$errors") && grep -qF "text=\"$text\"" <<<"$dump"; do
    if [ "$SECONDS" -ge "$deadline" ]; then
      echo "${WAIT_TEXT_TIMEOUT_SECONDS}초 안에 \"$text\" 가 화면에 나타나지 않았다" >&2
      if [ -s "$errors" ]; then
        echo "마지막 adb 오류:" >&2
        cat "$errors" >&2
      fi
      rm -f "$errors"
      exit 1
    fi
    sleep 1
  done
  rm -f "$errors"
  printf '%s\n' "$dump"
}

case "${1:-}" in
  boot) boot ;;
  check-path) check_path ;;
  build) build ;;
  install) install ;;
  wait-text)
    shift
    wait_text "$@"
    ;;
  *)
    echo "사용법: $0 boot|check-path|build|install|wait-text <텍스트>" >&2
    exit 1
    ;;
esac
