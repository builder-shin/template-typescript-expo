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
#                                     평문 HTTP(NSAllowsLocalNetworking), 서명 무결성·내장 simulated entitlement.
#                                     CI 가 내려받은 .app 을 다시 잴 때도 쓴다
set -euo pipefail
cd "$(dirname "$0")/../.."

readonly APP_ID=com.example.templateexpo.e2e
readonly DERIVED_DATA="${E2E_IOS_DERIVED_DATA:-ios/build}"
readonly PRODUCTS="$DERIVED_DATA/Build/Products/Release-iphonesimulator"
readonly BUILD_LOG=.maestro-output/ios-build.log

fail() {
  echo "ios.sh: $*" >&2
  exit 1
}

[ "$(uname -s)" = Darwin ] || fail "iOS 시뮬레이터는 macOS 에서만 돈다"

# E2E_SIMULATOR의 이름/UDID를 우선하고 없으면 켜진 iPhone, 이어서 최신 runtime의 iPhone을 고른다.
# 명시한 값이 없으면 실패한다 - 다른 runtime으로 조용히 바뀌지 않는다.
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
    const pick = wanted
      ? phones.find((device) => device.udid === wanted || device.name === wanted)
      : phones.find((device) => device.state === "Booted") ??
        phones.find((device) => /^iPhone \d+$/.test(device.name)) ?? phones[0]
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

# 사용자 기기는 선택 정보만 읽는다. E2E가 설정을 바꾸는 것은 같은 종류/런타임의 새 전용 기기다(K3 R33).
create_simulator() {
  local template settings device_type runtime
  template=$(pick_simulator) || return 1
  settings=$(xcrun simctl list devices available --json | node -e '
    const { devices } = JSON.parse(require("fs").readFileSync(0, "utf8"))
    for (const [runtime, list] of Object.entries(devices)) {
      const device = list.find((item) => item.udid === process.argv[1])
      if (device) { console.log(device.deviceTypeIdentifier); console.log(runtime); process.exit(0) }
    }
    process.exit(1)' "$template") || return 1
  device_type=$(printf '%s\n' "$settings" | head -n 1) || return 1
  runtime=$(printf '%s\n' "$settings" | tail -n 1) || return 1
  xcrun simctl create "Template Expo E2E $$" "$device_type" "$runtime"
}

app_path() {
  local app
  app=$(find "$PRODUCTS" -maxdepth 1 -name '*.app' -type d 2>/dev/null | head -n 1)
  [ -n "$app" ] || fail "만든 .app 이 없다 ($PRODUCTS) - test/e2e/ios.sh build 를 먼저 돌린다"
  printf '%s\n' "$app"
}

# Simulator 권한은 Xcode가 Mach-O의 __TEXT에 싣는다. 호스트 서명에 같은 iOS 제한 권한을 넣으면
# macOS amfid가 실행을 거부한다(K3 Mac 재현). 코드 무결성과 두 권한 공간을 따로 잰다.
assert_signature() {
  local app=$1 work executable
  codesign --verify --strict --deep "$app" || fail ".app 의 서명 검증 실패: $app"
  work=$(mktemp -d .maestro-output/ios-sign-check.XXXXXX) || fail "서명 검사 임시 디렉터리를 만들지 못했다"
  executable=$(plutil -extract CFBundleExecutable raw -o - "$app/Info.plist") || fail "실행 파일 이름을 읽지 못했다"
  xcrun otool -l "$app/$executable" >"$work/sections" || fail "Mach-O section을 읽지 못했다"
  # ${name}은 Node 템플릿 문자열이다.
  # shellcheck disable=SC2016
  if ! node -e '
    const fs = require("fs")
    const binary = fs.readFileSync(process.argv[1])
    const sections = fs.readFileSync(process.argv[2], "utf8")
    let xml
    for (const name of ["__entitlements", "__ents_der"]) {
      const words = sections.split(/\s+/)
      const index = words.findIndex((word, i) => word === "sectname" && words[i + 1] === name && words[i + 3] === "__TEXT")
      if (index < 0) throw new Error(`내장 simulated entitlement section 누락: ${name}`)
      const size = Number(words[index + 7])
      const offset = Number(words[index + 9])
      if (!Number.isSafeInteger(size) || !Number.isSafeInteger(offset) || size <= 0 || offset < 0 || offset + size > binary.length) {
        throw new Error(`simulated entitlement section 범위 오류: ${name}`)
      }
      if (name === "__entitlements") xml = binary.subarray(offset, offset + size)
    }
    process.stdout.write(xml)' "$app/$executable" "$work/sections" >"$work/simulated.plist"
  then
    fail ".app 의 내장 simulated entitlement를 읽지 못했다: $app"
  fi
  codesign --display --entitlements - --xml "$app" >"$work/host.plist" || fail "호스트 서명 entitlement를 읽지 못했다"
  # linker 서명은 plist 출력이 없을 수 있다. 무결성은 위에서 이미 확인했다.
  if [ -s "$work/host.plist" ]; then
    plutil -convert json -o "$work/host.json" "$work/host.plist" || fail "호스트 entitlement 변환 실패"
  else
    echo '{}' >"$work/host.json"
  fi
  if ! plutil -convert json -o - "$work/simulated.plist" | APP_ID_EXPECTED="$APP_ID" node -e '
    const fs = require("fs")
    const entitlements = JSON.parse(fs.readFileSync(0, "utf8"))
    const host = JSON.parse(fs.readFileSync(process.argv[1], "utf8"))
    const id = process.env.APP_ID_EXPECTED
    const appId = entitlements["application-identifier"]
    const validId = appId === id || (typeof appId === "string" && /^[A-Z0-9]{10}$/.test(appId.slice(0, 10)) && appId.slice(10) === "." + id)
    const groups = entitlements["keychain-access-groups"]
    if (!validId || (groups !== undefined && JSON.stringify(groups) !== JSON.stringify([appId])) ||
        "application-identifier" in host || "keychain-access-groups" in host) {
      console.error("Simulator 권한 또는 호스트 제한 entitlement가 잘못됐다")
      process.exit(1)
    }' "$work/host.json"; then
    fail ".app 의 Keychain entitlement 검증 실패: $app"
  fi
  rm "$work/sections" "$work/simulated.plist" "$work/host.plist" "$work/host.json"
  rmdir "$work"
  echo ".app 의 Simulator 서명: strict/deep · 내장 XML 앱 식별자와 DER section · 호스트 제한 권한 없음" >&2
}

# Xcode 빌드의 expo-constants 단계가 app.config.ts 를 그 셸의 환경으로 다시 평가해 .app 의
# EXConstants.bundle/app.config(앱이 읽는 Constants.expoConfig)로 넣는다 - APP_VARIANT·BACKEND_URL 을 받지 못하면
# 네이티브는 e2e 인데 앱 설정은 다른 변형인 .app 이 나온다(android.sh 의 assert_apk_variant 와 같은 자리).
assert_app() {
  local app="${1:?.app 경로가 필요하다}" backend_url="${2:-}" config expo_plist summary updates_enabled local_networking bundle_id
  [ -d "$app" ] || fail ".app 이 없다: $app"
  assert_signature "$app"
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
  # 해당 앱·현재 번들·EXConstants만 다시 만든다. 라이브러리 객체와 모듈 캐시는 보존한다.
  local product
  if [ -d "$PRODUCTS" ]; then
    for product in "$PRODUCTS/$scheme.app" "$PRODUCTS/EXConstants.bundle"; do
      [ ! -e "$product" ] || rm -rf "$product"
    done
  fi
  rm -rf "$DERIVED_DATA/Build/Intermediates.noindex/$scheme.build/Release-iphonesimulator/$scheme.build" \
    "$DERIVED_DATA/Build/Intermediates.noindex/Pods.build/Release-iphonesimulator/EXConstants.build"
  mkdir -p "$(dirname "$BUILD_LOG")"
  if [ "${E2E_IOS_CCACHE:-}" = 1 ]; then
    grep -Eq '"apple.ccacheEnabled"[[:space:]]*:[[:space:]]*"true"' ios/Podfile.properties.json || fail "pod install의 ccache 설정이 켜지지 않았다"
    grep -q 'ccache-clang' ios/Pods/Pods.xcodeproj/project.pbxproj || fail "Clang ccache wrapper가 없다"
  fi
  echo "xcodebuild: $workspace ($scheme, Release, iphonesimulator $(uname -m)) - 기록은 $BUILD_LOG" >&2
  if ! xcodebuild -workspace "$workspace" -scheme "$scheme" -configuration Release -sdk iphonesimulator \
    -destination 'generic/platform=iOS Simulator' -derivedDataPath "$DERIVED_DATA" \
    ARCHS="$(uname -m)" ONLY_ACTIVE_ARCH=NO CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=- DEVELOPMENT_TEAM= \
    COMPILER_INDEX_STORE_ENABLE=NO \
    -showBuildTimingSummary build >"$BUILD_LOG" 2>&1; then
    tail -n 80 "$BUILD_LOG" >&2
    fail "xcodebuild 가 실패했다 - 전체 기록은 $BUILD_LOG"
  fi
  grep -Eq 'PhaseScriptExecution .*Bundle.*React.*Native.*code.*and.*images' "$BUILD_LOG" || fail "현재 JS bundle 단계가 실행되지 않았다"
  if [ "${E2E_IOS_CCACHE:-}" = 1 ]; then
    grep -q 'ccache-clang' "$BUILD_LOG" || fail "빌드가 Clang ccache wrapper를 쓰지 않았다"
    ccache --show-stats >>"$BUILD_LOG"
  fi
  app=$(app_path)
  assert_app "$app" "$BACKEND_URL"
  printf '%s\n' "$app"
}

case "${1:-}" in
  boot) boot ;;
  create-simulator) create_simulator ;;
  build) build ;;
  app-path) app_path ;;
  assert-app)
    shift
    assert_app "$@"
    ;;
  *)
    echo "사용법: $0 boot|create-simulator|build|app-path|assert-app <.app> [<BACKEND_URL>]" >&2
    exit 1
    ;;
esac
