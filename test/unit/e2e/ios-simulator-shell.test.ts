import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { BASH_TIMEOUT_MS, resolveBash } from '../support/bash'

const SOURCE = resolve('test/e2e/ios-simulator.sh')
const WORK = mkdtempSync(join(tmpdir(), 'ios-simulator-shell-'))
afterAll(() => rmSync(WORK, { recursive: true, force: true }))

describe('전용 simulator의 실제 bash 준비·재부팅·정리', () => {
  it.each(['none', 'disable', 'reboot', 'lost-service', 'lost-autofill', 'lost-link', 'later'])(
    '%s 경계에서 사용자 기기를 건드리지 않고 전용 기기를 회수한다',
    (failure) => {
      const directory = mkdtempSync(join(WORK, 'case-'))
      mkdirSync(join(directory, 'test/e2e'), { recursive: true })
      mkdirSync(join(directory, 'out'))
      copyFileSync(
        resolve('test/e2e/ios-simulator.ts'),
        join(directory, 'test/e2e/ios-simulator.ts'),
      )
      const commands: Record<string, string> = {
        'test/e2e/ios.sh': '[ "$1" = create-simulator ] || exit 90\necho probe-owned-device',
        ps: 'echo "10 1 100 0.1 launchd_sim probe-owned-device/data/var/run/launchd_bootstrap.plist"',
        plutil:
          '[ "$1 $2 $3" = "-extract AppleLanguages json" ] || exit 96\ncat >/dev/null\necho \'["en"]\'',
        xcrun: `echo "$*" >> calls.log
[ "$1" = simctl ] || exit 90
if [ "$2" = list ]; then
  echo '{"devices":{"runtime":[{"udid":"user-device","state":"Booted"},{"udid":"probe-owned-device","state":"Booted"}]}}'
  exit 0
fi
[ "$3" = probe-owned-device ] || exit 91
case "$2" in
  bootstatus) if [ -f shutdown ] && [ "$PROBE_FAILURE" = reboot ]; then exit 17; fi ;;
  shutdown) touch shutdown ;;
  delete) touch deleted ;;
  spawn)
    case "$4 $5" in
      'launchctl list') printf 'PID\\tStatus\\tLabel\\n12\\t0\\tcom.apple.apsd\\n13\\t0\\tcom.apple.chronod\\n14\\t0\\tcom.apple.securityd\\n' ;;
      'launchctl disable') [ "$PROBE_FAILURE" != disable ] || exit 18 ;;
      'launchctl print-disabled')
        echo '"com.apple.apsd" => true'
        [ "$PROBE_FAILURE" = lost-service ] || echo '"com.apple.chronod" => true' ;;
      'defaults write') : ;;
      'defaults export') echo '{"AppleLanguages":["en"],"AppleLocale":"en_US"}' ;;
      'defaults read')
        case "$6" in
          com.apple.WebUI) if [ "$PROBE_FAILURE" = lost-autofill ]; then echo 1; else echo 0; fi ;;
          com.apple.launchservices.schemeapproval) if [ "$PROBE_FAILURE" = lost-link ]; then echo wrong; else echo com.example.templateexpo.e2e; fi ;;
          com.apple.keyboard.preferences) echo 1 ;;
          NSGlobalDomain) [ "$7" = AppleLocale ] || exit 95; echo en_US ;;
          *) exit 92 ;;
        esac ;;
      *) exit 93 ;;
    esac ;;
  *) exit 94 ;;
esac`,
      }
      for (const [name, body] of Object.entries(commands)) {
        writeFileSync(join(directory, name), `#!/bin/sh\n${body}\n`)
        chmodSync(join(directory, name), 0o755)
      }
      const env: NodeJS.ProcessEnv = { ...process.env, PROBE_FAILURE: failure }
      delete env.BASH_ENV
      const result = spawnSync(
        resolveBash(),
        [
          '-c',
          `set -euo pipefail
export PATH="$PWD:$PATH"
OUT=out
APP_ID=com.example.templateexpo.e2e
node_quiet() { node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON "$@"; }
source "$1"
trap remove_owned_simulator EXIT
create_owned_simulator || exit 1
prepare_simulator_services || exit 1
reboot_prepared_simulator || exit 1
if [ "$PROBE_FAILURE" = later ]; then exit 23; fi
`,
          'probe',
          SOURCE,
        ],
        { cwd: directory, env, encoding: 'utf8', timeout: BASH_TIMEOUT_MS },
      )
      expect(result.status, result.stderr).toBe(
        failure === 'none' ? 0 : failure === 'later' ? 23 : 1,
      )
      const calls = readFileSync(join(directory, 'calls.log'), 'utf8')
      expect(calls).toContain('simctl delete probe-owned-device')
      expect(calls).not.toContain('user-device')
      expect(calls).not.toContain('system/com.apple.securityd')
      if (failure === 'none') {
        expect(calls.match(/simctl bootstatus/g)).toHaveLength(2)
        expect(
          JSON.parse(readFileSync(join(directory, 'out/simulator-after-metrics.json'), 'utf8')),
        ).toMatchObject({ processes: 1, rssKiB: 100 })
      }
    },
  )

  it('실제 실행은 세 설정을 모두 쓴 뒤 재부팅 검증하고 앱·백엔드를 시작한다', () => {
    const source = readFileSync(resolve('test/e2e/run-ios.sh'), 'utf8')
    const steps = [
      'trap cleanup EXIT',
      'create_owned_simulator ||',
      'prepare_simulator_services ||',
      'prepare_autofill ||',
      'prepare_scheme_approval ||',
      'reboot_prepared_simulator ||',
      'xcrun simctl install "$UDID" "$APP"\nnode_quiet',
    ]
    const positions = steps.map((step) => source.indexOf(step))
    expect(positions.every((position) => position >= 0)).toBe(true)
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
  })
})
