import { spawnSync } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { BASH_TIMEOUT_MS, resolveBash } from '../support/bash'

const SOURCE = readFileSync(resolve('test/e2e/run-ios.sh'), 'utf8')
const WORK = mkdtempSync(join(tmpdir(), 'ios-link-approval-'))
const KEY = 'com.apple.CoreSimulator.CoreSimulatorBridge-->templateexpo-e2e'
const APP_ID = 'com.example.templateexpo.e2e'
afterAll(() => rmSync(WORK, { recursive: true, force: true }))

describe('iOS 딥링크 승인은 선택한 simulator의 한 키에만 적용한다', () => {
  it.each([
    ['absent', 'none'],
    [APP_ID, 'none'],
    ['com.example.previous', 'none'],
    ['absent', 'read'],
    ['com.example.previous', 'read'],
    ['com.example.previous', 'malformed'],
    ['com.example.previous', 'invalid'],
    ['absent', 'write'],
    ['com.example.previous', 'write'],
    ['com.example.previous', 'mismatch'],
    ['com.example.previous', 'readback'],
    ['absent', 'later'],
    ['com.example.previous', 'later'],
    ['com.example.previous', 'restore'],
  ])('원래 %s, 오류 %s에서 값과 다른 설정의 복원을 지킨다', (original, failure) => {
    const directory = mkdtempSync(join(WORK, 'case-'))
    const initial = {
      unrelated: 'keep-me',
      ...(original === 'absent' ? {} : { [KEY]: original }),
    }
    writeFileSync(join(directory, 'settings.json'), JSON.stringify(initial))
    writeFileSync(
      join(directory, 'xcrun'),
      `#!/bin/sh
exec node "$(dirname "$0")/defaults.cjs" "$@"
`,
    )
    chmodSync(join(directory, 'xcrun'), 0o755)
    // OS 경계만 가짜로 만든다. 아래에서는 저장소의 실제 준비·복원·cleanup EXIT trap을 실행한다.
    writeFileSync(
      join(directory, 'defaults.cjs'),
      `const fs = require('fs');
const args = process.argv.slice(2);
const [simctl, spawn, udid, defaults, operation, domain, key, type, value] = args;
if (simctl !== 'simctl' || spawn !== 'spawn' || udid !== 'probe-ios-device' || defaults !== 'defaults' || domain !== 'com.apple.launchservices.schemeapproval') process.exit(90);
fs.appendFileSync('calls.log', operation + '\\n');
const data = JSON.parse(fs.readFileSync('settings.json', 'utf8'));
const target = ${JSON.stringify(KEY)};
const failure = process.env.PROBE_FAILURE;
if (operation === 'export') {
  if (key !== '-') process.exit(91);
  if (failure === 'read') process.exit(17);
  console.log(failure === 'malformed' ? 'broken' : JSON.stringify(failure === 'invalid' ? { ...data, [target]: false } : data));
} else {
  if (key !== target) process.exit(92);
  if (operation === 'read') {
    if (failure === 'readback') process.exit(18);
    console.log(failure === 'mismatch' ? 'com.example.wrong' : data[target]);
  } else if (operation === 'write') {
    if (type !== '-string') process.exit(93);
    const first = !fs.existsSync('wrote');
    fs.writeFileSync('wrote', '1');
    if (failure === 'write' && first) process.exit(19);
    if (failure === 'restore' && !first) process.exit(20);
    data[target] = value;
    fs.writeFileSync('settings.json', JSON.stringify(data));
  } else if (operation === 'delete') {
    delete data[target];
    fs.writeFileSync('settings.json', JSON.stringify(data));
  } else process.exit(94);
}
`,
    )
    writeFileSync(join(directory, 'plutil'), '#!/bin/sh\ncat\n')
    chmodSync(join(directory, 'plutil'), 0o755)
    mkdirSync(join(directory, 'test/e2e'), { recursive: true })
    writeFileSync(join(directory, 'test/e2e/native-backend.sh'), '#!/bin/sh\nexit 0\n')
    chmodSync(join(directory, 'test/e2e/native-backend.sh'), 0o755)
    const functions = ['prepare_scheme_approval', 'restore_scheme_approval', 'cleanup'].map(
      (name) => {
        const block = new RegExp(`^${name}\\(\\) \\{$[\\s\\S]*?^\\}`, 'm').exec(SOURCE)?.[0]
        if (block === undefined) throw new Error(`${name}이 없다`)
        return block
      },
    )
    const trap = /^trap cleanup EXIT$/m.exec(SOURCE)?.[0]
    if (trap === undefined) throw new Error('cleanup EXIT trap이 없다')
    const env: NodeJS.ProcessEnv = { ...process.env, PROBE_FAILURE: failure }
    delete env.BASH_ENV
    const result = spawnSync(
      resolveBash(),
      [
        '-c',
        `set -euo pipefail
export PATH="$PWD:$PATH"
UDID=probe-ios-device
APP_ID=${APP_ID}
scheme_approval_original=''
fail() { echo "$*" >&2; exit 1; }
stop_device_log() { :; }
stop_stall_server() { :; }
restore_autofill() { echo restored > autofill-restored; }
${functions.join('\n')}
${trap}
prepare_scheme_approval || exit 1
if [ "$PROBE_FAILURE" = later ]; then exit 23; fi
`,
      ],
      { cwd: directory, env, encoding: 'utf8', timeout: BASH_TIMEOUT_MS },
    )
    expect(result.status, result.stderr).toBe(failure === 'none' ? 0 : failure === 'later' ? 23 : 1)
    expect(readFileSync(join(directory, 'settings.json'), 'utf8')).toBe(
      JSON.stringify(failure === 'restore' ? { ...initial, [KEY]: APP_ID } : initial),
    )
    expect(readFileSync(join(directory, 'autofill-restored'), 'utf8').trim()).toBe('restored')
    const calls = readFileSync(join(directory, 'calls.log'), 'utf8').trim().split(/\r?\n/)
    if (['read', 'malformed', 'invalid'].includes(failure)) expect(calls).toEqual(['export'])
    else expect(calls).toContain('write')
  })

  it('기존 cleanup trap 안에서 첫 Maestro 흐름보다 먼저 준비한다', () => {
    const trap = SOURCE.indexOf('trap cleanup EXIT')
    const prepare = SOURCE.indexOf('prepare_scheme_approval || fail')
    const firstFlow = SOURCE.indexOf('for flow in "${flows[@]}"')
    expect(prepare).toBeGreaterThan(trap)
    expect(firstFlow).toBeGreaterThan(prepare)
  })
})
