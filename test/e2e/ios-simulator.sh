#!/usr/bin/env bash
# run-ios.sh가 source하는 전용 simulator의 수명주기(K3, D7-R33). host launchctl은 호출하지 않는다.
# 사용자가 쓰던 기기는 선택 정보만 읽으며 새 기기에만 설정하고 EXIT에서 그 기기만 삭제한다.

owned_simulator=''

create_owned_simulator() {
  owned_simulator=$(test/e2e/ios.sh create-simulator) || return 1
  UDID=$owned_simulator
  echo "E2E(iOS): 전용 simulator $UDID"
  printf '%s\n' "$UDID" >"$OUT/simulator-udid.txt" || return 1
  xcrun simctl bootstatus "$UDID" -b || return 1
}

measure_simulator() {
  local phase=$1
  # host 프로세스의 인자는 메모리에서 기기 트리 선택에만 쓰고 artifact에는 집계만 남긴다.
  ps -axo pid=,ppid=,rss=,pcpu=,args= | node_quiet --input-type=module -e '
    import { readFileSync } from "node:fs"
    import { simulatorMetrics } from "./test/e2e/ios-simulator.ts"
    console.log(JSON.stringify(simulatorMetrics(readFileSync(0, "utf8"), process.argv[1])))
  ' "$UDID" | tee "$OUT/simulator-$phase-metrics.json"
}

prepare_simulator_services() {
  local label
  xcrun simctl spawn "$UDID" launchctl list >"$OUT/simulator-before-services.txt" || return 1
  measure_simulator before || return 1
  node_quiet --input-type=module -e '
    import { readFileSync } from "node:fs"
    import { simulatorServices } from "./test/e2e/ios-simulator.ts"
    console.log(simulatorServices(readFileSync(process.argv[1], "utf8")).join("\n"))
  ' "$OUT/simulator-before-services.txt" >"$OUT/simulator-disabled-labels.txt" || return 1
  while IFS= read -r label; do
    xcrun simctl spawn "$UDID" launchctl disable "system/$label" || return 1
  done <"$OUT/simulator-disabled-labels.txt"
  # R16의 OS 버튼 언어와 키보드 첫 사용 안내도 전용 기기에만 고정한다.
  xcrun simctl spawn "$UDID" defaults write NSGlobalDomain AppleLanguages -array en || return 1
  xcrun simctl spawn "$UDID" defaults write NSGlobalDomain AppleLocale -string en_US || return 1
  xcrun simctl spawn "$UDID" defaults write com.apple.keyboard.preferences DidShowContinuousPathIntroduction -bool true
}

reboot_prepared_simulator() {
  local actual
  # disable·AutoFill·scheme approval을 모두 쓴 뒤 한 번만 재부팅한다. 이후에 모든 값을 다시 읽는다.
  xcrun simctl shutdown "$UDID" || return 1
  xcrun simctl bootstatus "$UDID" -b || return 1
  xcrun simctl spawn "$UDID" launchctl print-disabled system >"$OUT/simulator-after-disabled.txt" || return 1
  cat "$OUT/simulator-after-disabled.txt" || return 1
  node_quiet --input-type=module -e '
    import { readFileSync } from "node:fs"
    import { verifyDisabledServices } from "./test/e2e/ios-simulator.ts"
    verifyDisabledServices(readFileSync(process.argv[1], "utf8"), readFileSync(process.argv[2], "utf8").trim().split("\n"))
  ' "$OUT/simulator-after-disabled.txt" "$OUT/simulator-disabled-labels.txt" || return 1
  actual=$(xcrun simctl spawn "$UDID" defaults read com.apple.WebUI AutoFillPasswords) || return 1
  [ "$actual" = 0 ] || return 1
  actual=$(xcrun simctl spawn "$UDID" defaults read com.apple.launchservices.schemeapproval \
    'com.apple.CoreSimulator.CoreSimulatorBridge-->templateexpo-e2e') || return 1
  [ "$actual" = "$APP_ID" ] || return 1
  actual=$(xcrun simctl spawn "$UDID" defaults read com.apple.keyboard.preferences DidShowContinuousPathIntroduction) || return 1
  [ "$actual" = 1 ] || return 1
  actual=$(xcrun simctl spawn "$UDID" defaults read NSGlobalDomain AppleLocale) || return 1
  [ "$actual" = en_US ] || return 1
  # 전역 domain에는 JSON으로 바꿀 수 없는 plist 값도 있다. 필요한 배열만 추출한다(K3 R33 준비 실측).
  xcrun simctl spawn "$UDID" defaults export NSGlobalDomain - | plutil -extract AppleLanguages json -o - - | node -e '
    const languages = JSON.parse(require("fs").readFileSync(0, "utf8"))
    if (JSON.stringify(languages) !== JSON.stringify(["en"])) process.exit(1)
  ' || return 1
  xcrun simctl spawn "$UDID" launchctl list >"$OUT/simulator-after-services.txt" || return 1
  measure_simulator after || return 1
  echo 'E2E(iOS): 재부팅 뒤 service/AutoFill/scheme approval readback 완료'
}

remove_owned_simulator() {
  [ -n "$owned_simulator" ] || return 0
  local state rc=0
  state=$(xcrun simctl list devices --json | node -e '
    const { devices } = JSON.parse(require("fs").readFileSync(0, "utf8"))
    const device = Object.values(devices).flat().find((item) => item.udid === process.argv[1])
    if (!device) process.exit(1)
    console.log(device.state)' "$owned_simulator") || return 1
  if [ "$state" != Shutdown ]; then xcrun simctl shutdown "$owned_simulator" || rc=1; fi
  xcrun simctl delete "$owned_simulator" || rc=1
  [ "$rc" = 0 ] || return 1
  owned_simulator=''
}
