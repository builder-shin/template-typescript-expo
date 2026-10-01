#!/usr/bin/env bash
# iOS 시뮬레이터 도우미 - E2E 하네스(test/e2e/run-ios.sh)와 CI 의 iOS 빌드 잡이 쓴다. macOS 전용이다.
#
#   test/e2e/ios.sh boot              켜진 iPhone 시뮬레이터가 없으면 하나를 골라 부팅하고 부팅 완료까지 기다린다.
#                                     고른 기기의 UDID 를 표준 출력의 한 줄로 낸다(안내는 표준 오류로). 이름은
#                                     E2E_SIMULATOR 로 고른다 - 없으면 가장 새 iOS 런타임의 "iPhone <숫자>" 하나
#   test/e2e/ios.sh build             e2e 변형의 시뮬레이터용 Release .app 을 만든다(BACKEND_URL 필요) - 만든 .app 을
#                                     아래 assert-app 으로 단언하고 경로를 낸다
#   test/e2e/ios.sh app-path          build 가 만든 .app 의 경로를 낸다
#   test/e2e/ios.sh assert-app <.app> [<BACKEND_URL>]
#                                     .app 이 e2e 변형인지 단언한다 - 앱 설정(EXConstants.bundle/app.config)의 변형·
#                                     백엔드 주소·OTA 끔, Expo.plist 의 EXUpdatesEnabled, Info.plist 의 번들 ID 와
#                                     평문 HTTP(NSAllowsLocalNetworking). CI 가 내려받은 .app 을 다시 잴 때도 쓴다
set -euo pipefail
cd "$(dirname "$0")/../.."

readonly APP_ID=com.example.templateexpo.e2e
readonly DERIVED_DATA=ios/build
readonly PRODUCTS="$DERIVED_DATA/Build/Products/Release-iphonesimulator"
readonly BUILD_LOG=.maestro-output/ios-build.log

fail() {
  echo "ios.sh: $*" >&2
  exit 1
}

[ "$(uname -s)" = Darwin ] || fail "iOS 시뮬레이터는 macOS 에서만 돈다"

# simctl 의 기기 목록(JSON)에서 기기 하나의 UDID 를 고른다. 켜진 iPhone 이 있으면 그것, 없으면 E2E_SIMULATOR
# 이름의 기기, 그것도 없으면 가장 새 iOS 런타임에서 이름이 "iPhone <숫자>" 인 첫 기기.
pick_simulator() {
  xcrun simctl list devices available --json | E2E_SIMULATOR="${E2E_SIMULATOR:-}" node -e '
    const { devices } = JSON.parse(require("fs").readFileSync(0, "utf8"))
    const runtimes = Object.keys(devices)
      .filter((key) => key.includes("SimRuntime.iOS-"))
      .sort((a, b) => {
        const version = (key) => key.replace(/.*iOS-/, "").split("-").map(Number)
        const [x, y] = [version(a), version(b)]
        for (let i = 0; i < Math.max(x.length, y.length); i += 1) {
          if ((x[i] ?? 0) !== (y[i] ?? 0)) return (y[i] ?? 0) - (x[i] ?? 0)
        }
        return 0
      })
    const phones = runtimes.flatMap((key) => devices[key].filter((device) => device.name.startsWith("iPhone")))
    const wanted = process.env.E2E_SIMULATOR
    const pick =
      phones.find((device) => device.state === "Booted") ??
      (wanted ? phones.find((device) => device.name === wanted) : undefined) ??
      phones.find((device) => /^iPhone \d+$/.test(device.name)) ??
      phones[0]
    if (pick === undefined) {
      console.error("쓸 수 있는 iPhone 시뮬레이터가 없다 - xcrun simctl list devices available")
      process.exit(1)
    }
    process.stdout.write(pick.udid)'
}

boot() {
  local udid
  udid=$(pick_simulator) || exit 1
  echo "시뮬레이터: $udid" >&2
  # 켜져 있으면 곧바로, 꺼져 있으면 부팅하고 끝날 때까지 기다린다.
  xcrun simctl bootstatus "$udid" -b >&2
  # 첫 입력 때 뜨는 "밀어서 입력" 안내를 끈다 - 입력 칸을 가려 단계를 흔든다.
  xcrun simctl spawn "$udid" defaults write com.apple.keyboard.preferences DidShowContinuousPathIntroduction -bool true
  printf '%s\n' "$udid"
}

app_path() {
  local app
  app=$(find "$PRODUCTS" -maxdepth 1 -name '*.app' -type d 2>/dev/null | head -n 1)
  [ -n "$app" ] || fail "만든 .app 이 없다 ($PRODUCTS) - test/e2e/ios.sh build 를 먼저 돌린다"
  printf '%s\n' "$app"
}

# Xcode 빌드의 expo-constants 단계가 app.config.ts 를 그 셸의 환경으로 다시 평가해 .app 의
# EXConstants.bundle/app.config(앱이 읽는 Constants.expoConfig)로 넣는다 - APP_VARIANT·BACKEND_URL 을 받지 못하면
# 네이티브는 e2e 인데 앱 설정은 다른 변형인 .app 이 나온다(android.sh 의 assert_apk_variant 와 같은 자리).
assert_app() {
  local app="${1:?.app 경로가 필요하다}" backend_url="${2:-}" config expo_plist summary updates_enabled local_networking bundle_id
  [ -d "$app" ] || fail ".app 이 없다: $app"
  config=$(find "$app" -path '*EXConstants.bundle/app.config' | head -n 1)
  [ -n "$config" ] || fail ".app 에 EXConstants.bundle/app.config 가 없다: $app"
  # 작은따옴표 안의 ${…} 는 node 의 템플릿 문자열이다.
  # shellcheck disable=SC2016
  if ! summary=$(BACKEND_URL_EXPECTED="$backend_url" node -e '
    const config = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"))
    const problems = []
    if (config.extra?.appVariant !== "e2e") problems.push(`extra.appVariant=${config.extra?.appVariant}`)
    const expected = process.env.BACKEND_URL_EXPECTED
    if (expected && config.extra?.backendUrl !== expected) problems.push(`extra.backendUrl=${config.extra?.backendUrl}`)
    if (JSON.stringify(config.updates) !== JSON.stringify({ enabled: false })) problems.push(`updates=${JSON.stringify(config.updates)}`)
    if (config.runtimeVersion !== undefined) problems.push(`runtimeVersion=${JSON.stringify(config.runtimeVersion)}`)
    if (problems.length > 0) {
      console.error(`.app 의 앱 설정이 e2e 변형이 아니다: ${problems.join(" ")}`)
      process.exit(1)
    }
    process.stdout.write(`extra.appVariant=e2e backendUrl=${config.extra.backendUrl} updates={"enabled":false} runtimeVersion=undefined`)' "$config"); then
    exit 1
  fi
  expo_plist=$(find "$app" -maxdepth 2 -name Expo.plist | head -n 1)
  [ -n "$expo_plist" ] || fail ".app 에 Expo.plist 가 없다: $app"
  updates_enabled=$(plutil -extract EXUpdatesEnabled raw -o - "$expo_plist" 2>/dev/null || printf '%s' '-')
  local_networking=$(plutil -extract NSAppTransportSecurity.NSAllowsLocalNetworking raw -o - "$app/Info.plist" 2>/dev/null || printf '%s' '-')
  bundle_id=$(plutil -extract CFBundleIdentifier raw -o - "$app/Info.plist" 2>/dev/null || printf '%s' '-')
  if [ "$updates_enabled" != false ] || [ "$local_networking" != true ] || [ "$bundle_id" != "$APP_ID" ]; then
    fail ".app 의 plist 가 e2e 변형이 아니다 (EXUpdatesEnabled=$updates_enabled NSAllowsLocalNetworking=$local_networking CFBundleIdentifier=$bundle_id)"
  fi
  echo ".app 의 앱 설정: $summary · Expo.plist EXUpdatesEnabled=false · Info.plist CFBundleIdentifier=$APP_ID NSAllowsLocalNetworking=true" >&2
}

build() {
  : "${BACKEND_URL:?BACKEND_URL 이 필요하다 - iOS 시뮬레이터에서 호스트는 http://localhost:<포트>}"
  local workspace scheme app
  # prebuild 와 Xcode 빌드의 스크립트 단계(expo-constants·expo-updates·번들)가 같은 변형과 주소를 받도록 export 한다.
  export APP_VARIANT=e2e BACKEND_URL
  # --no-install 을 주지 않는다 - prebuild 가 pod install 까지 돈다. 표준 출력은 .app 경로 한 줄만 낸다.
  pnpm exec expo prebuild --platform ios --clean >&2
  workspace=$(find ios -maxdepth 1 -name '*.xcworkspace' | head -n 1)
  [ -n "$workspace" ] || fail "prebuild 가 ios/*.xcworkspace 를 만들지 않았다"
  scheme=$(basename "$workspace" .xcworkspace)
  mkdir -p "$(dirname "$BUILD_LOG")"
  echo "xcodebuild: $workspace ($scheme, Release, iphonesimulator $(uname -m)) - 기록은 $BUILD_LOG" >&2
  if ! xcodebuild -workspace "$workspace" -scheme "$scheme" -configuration Release -sdk iphonesimulator \
    -destination 'generic/platform=iOS Simulator' -derivedDataPath "$DERIVED_DATA" \
    ARCHS="$(uname -m)" ONLY_ACTIVE_ARCH=NO CODE_SIGNING_ALLOWED=NO COMPILER_INDEX_STORE_ENABLE=NO \
    build >"$BUILD_LOG" 2>&1; then
    tail -n 80 "$BUILD_LOG" >&2
    fail "xcodebuild 가 실패했다 - 전체 기록은 $BUILD_LOG"
  fi
  app=$(app_path)
  assert_app "$app" "$BACKEND_URL"
  printf '%s\n' "$app"
}

case "${1:-}" in
  boot) boot ;;
  build) build ;;
  app-path) app_path ;;
  assert-app)
    shift
    assert_app "$@"
    ;;
  *)
    echo "사용법: $0 boot|build|app-path|assert-app <.app> [<BACKEND_URL>]" >&2
    exit 1
    ;;
esac
