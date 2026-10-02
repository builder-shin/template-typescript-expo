import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { BASH_TIMEOUT_MS, resolveBash } from '../support/bash'

const SOURCE = readFileSync(resolve('test/e2e/run-ios.sh'), 'utf8')
const WORK = mkdtempSync(join(tmpdir(), 'ios-driver-recovery-'))
afterAll(() => rmSync(WORK, { recursive: true, force: true }))

function run(first: string, second = 'pass', ci = false, locale = '') {
  const directory = mkdtempSync(join(WORK, 'case-'))
  for (const file of [
    'test/e2e/ios-driver-crash.ts',
    'test/e2e/ios-log.ts',
    'test/e2e/probe-email.ts',
    'test/e2e/request-counts.ts',
    'test/e2e/guard-log.sh',
    'lib/jsonapi/failure-log.ts',
  ]) {
    mkdirSync(dirname(join(directory, file)), { recursive: true })
    if (existsSync(resolve(file))) copyFileSync(resolve(file), join(directory, file))
  }
  chmodSync(join(directory, 'test/e2e/guard-log.sh'), 0o755)
  mkdirSync(join(directory, 'test/e2e/flows'), { recursive: true })
  writeFileSync(
    join(directory, 'test/e2e/flows/examples-create.yaml'),
    `# e2e-app-locale: ${locale}\nappId: probe\n---\n- launchApp\n`,
  )
  writeFileSync(
    join(directory, 'runner.txt'),
    readFileSync(resolve('test/fixtures/ios-driver/rails-xctest.txt')),
  )
  writeFileSync(
    join(directory, 'maestro.txt'),
    readFileSync(resolve('test/fixtures/ios-driver/rails-maestro.txt')),
  )
  writeFileSync(join(directory, 'api.log'), 'prior unrelated flow\n')
  writeFileSync(
    join(directory, 'maestro'),
    `#!/bin/sh
exec node "$(dirname "$0")/maestro.cjs" "$@"
`,
  )
  chmodSync(join(directory, 'maestro'), 0o755)
  // Maestro·simulator 경계만 대체하고 실제 run_flow·로그 변환·두 가드를 실행한다.
  writeFileSync(
    join(directory, 'maestro.cjs'),
    `const fs = require('fs');
const path = require('path');
const args = process.argv.slice(2);
const calls = fs.existsSync('calls.json') ? JSON.parse(fs.readFileSync('calls.json')) : [];
calls.push(args); fs.writeFileSync('calls.json', JSON.stringify(calls));
const attempt = calls.length;
const mode = attempt === 1 ? process.env.FIRST : process.env.SECOND;
const debug = args[args.indexOf('--debug-output') + 1];
const out = path.dirname(debug);
const nested = path.join(debug, '.maestro/tests/probe'); fs.mkdirSync(nested, { recursive: true });
fs.writeFileSync(path.join(nested, 'xctest_runner_probe.log'), mode === 'startup' ? 'startup timeout' : fs.readFileSync('runner.txt'));
fs.writeFileSync(path.join(nested, 'maestro.log'), mode === 'assertion' || mode === 'startup' ? 'app assertion or startup failure' : fs.readFileSync('maestro.txt'));
const warning = mode === 'crash' || mode === 'guard';
const events = [{subsystem: 'com.facebook.react.log', category: 'javascript', messageType: 'Info', processID: 7, eventMessage: '[e2e-state] attempt=' + attempt}];
if (warning) events.push({...events[0], eventMessage: '[e2e-warn] failing attempt ' + attempt});
fs.writeFileSync(path.join(out, 'device.ndjson'), events.map(x => JSON.stringify(x)).join('\\n') + '\\n');
const requests = ['POST /api/v1/auth/register', 'POST /api/v1/auth/login', 'POST /api/v1/auth/refresh', 'POST /api/v1/examples'];
if (mode === 'crash' || mode === 'counts') requests.push('POST /api/v1/auth/refresh');
fs.appendFileSync('api.log', requests.map(x => '"' + x + ' HTTP/1.1" 200 OK').join('\\n') + '\\n');
console.log('attempt=' + attempt);
process.exit(['pass', 'guard', 'counts'].includes(mode) ? 0 : 1);
`,
  )
  const functions = ['header', 'probe_email', 'api_log_size', 'save_api_log', 'run_flow'].map(
    (name) => {
      const block = new RegExp(`^${name}\\(\\) \\{$[\\s\\S]*?^\\}`, 'm').exec(SOURCE)?.[0]
      if (block === undefined) throw new Error(`${name}이 없다`)
      return block
    },
  )
  const env: NodeJS.ProcessEnv = { ...process.env, FIRST: first, SECOND: second }
  delete env.BASH_ENV
  delete env.GITHUB_ACTIONS
  if (ci) env.GITHUB_ACTIONS = 'true'
  const result = spawnSync(
    resolveBash(),
    [
      '-c',
      `set -euo pipefail
OUT=out
UDID=probe-device
APP_ID=probe-app
APP=probe.app
API_PORT=4799
API_LOG_FILE=api.log
BACKEND_KIND=fastapi
E2E_PASSWORD=fixture-password
MAESTRO="$PWD/maestro"
skipped=()
driver_recoveries=0
node_quiet() { node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON "$@"; }
reset_app() { echo reset >> resets; }
start_device_log() { echo start >> log.calls; }
stop_device_log() { echo stop >> log.calls; }
${functions.join('\n')}
rc=0
run_flow test/e2e/flows/examples-create.yaml || rc=$?
echo "recoveries=$driver_recoveries"
exit "$rc"
`,
    ],
    { cwd: directory, env, encoding: 'utf8', timeout: BASH_TIMEOUT_MS },
  )
  const read = (file: string) =>
    existsSync(join(directory, file)) ? readFileSync(join(directory, file), 'utf8') : ''
  return { result, read, calls: JSON.parse(read('calls.json')) as string[][] }
}

describe('서명이 맞는 실패만 새 드라이버로 한 번 다시 실행한다', () => {
  it('실패 증거를 보존하고 새 fixture·로그·API offset으로 두 번째 시도만 검증한다', () => {
    const { result, read, calls } = run('crash', 'pass', true, 'en-US')
    expect(result.status, result.stderr).toBe(0)
    expect(calls).toHaveLength(2)
    expect(read('resets')).toBe('reset\nreset\n')
    expect(read('log.calls')).toBe('start\nstop\nstart\nstop\n')
    expect(read('out/examples-create-driver-crash/device.log')).toContain('failing attempt 1')
    expect(read('out/examples-create-driver-crash/maestro.log')).toContain('attempt=1')
    expect(read('out/examples-create/device.log')).toContain('[e2e-state] attempt=2')
    expect(read('out/examples-create/device.log')).not.toContain('attempt=1')
    expect(read('out/examples-create/api.log').match(/auth\/refresh/g)).toHaveLength(1)
    expect(read('out/examples-create-driver-crash/api.log').match(/auth\/refresh/g)).toHaveLength(2)
    expect(result.stdout).toContain('::warning::')
    expect(result.stdout).toContain('recoveries=1')
    for (const key of ['EMAIL=', 'OTHER_EMAIL=']) {
      const first = calls[0]?.find((arg) => arg.startsWith(key))
      const second = calls[1]?.find((arg) => arg.startsWith(key))
      expect(first).not.toBe(second)
      expect(result.stdout).toContain(first?.slice(key.length))
      expect(result.stdout).toContain(second?.slice(key.length))
    }
    const config = (args: string[]) => args.filter((arg) => !/^(?:EMAIL|OTHER_EMAIL)=/.test(arg))
    expect(config(calls[0] ?? [])).toEqual(config(calls[1] ?? []))
  })

  it.each(['crash', 'assertion', 'guard', 'counts'])(
    '두 번째 %s 실패는 끝이며 세 번째 시도는 없다',
    (second) => {
      const { result, calls, read } = run('crash', second)
      expect(result.status, result.stderr).toBe(1)
      expect(calls).toHaveLength(2)
      expect(read('out/examples-create-driver-crash/maestro.log')).toContain('attempt=1')
      expect(read('out/examples-create/maestro.log')).toContain('attempt=2')
      expect(result.stdout).not.toContain('::warning::')
      expect(result.stdout).toContain('recoveries=1')
    },
  )

  it.each(['assertion', 'startup', 'guard', 'counts', 'pass'])(
    '%s는 기존 한 번 실행 경로를 유지한다',
    (first) => {
      const { result, calls, read } = run(first)
      expect(result.status, result.stderr).toBe(first === 'pass' ? 0 : 1)
      expect(calls).toHaveLength(1)
      expect(read('out/examples-create-driver-crash/maestro.log')).toBe('')
      expect(result.stdout).toContain('recoveries=0')
    },
  )
})

it.each(['headers', 'body', 'headers body'])(
  'request-stall은 최종 시도의 %s 기록만 본다',
  (modes) => {
    const directory = mkdtempSync(join(WORK, 'stall-'))
    mkdirSync(join(directory, 'test/e2e/checks'), { recursive: true })
    mkdirSync(join(directory, 'out/request-stall'), { recursive: true })
    writeFileSync(join(directory, 'test/e2e/checks/request-stall.yaml'), '')
    writeFileSync(join(directory, 'test/e2e/native-backend.sh'), '#!/bin/sh\nexit 0\n')
    chmodSync(join(directory, 'test/e2e/native-backend.sh'), 0o755)
    copyFileSync(resolve('test/e2e/stall-server.ts'), join(directory, 'test/e2e/stall-server.ts'))
    const functions = ['run_checks', 'stop_stall_server'].map((name) => {
      const block = new RegExp(`^${name}\\(\\) \\{$[\\s\\S]*?^\\}`, 'm').exec(SOURCE)?.[0]
      if (block === undefined) throw new Error(`${name}이 없다`)
      return block
    })
    const result = spawnSync(
      resolveBash(),
      [
        '-c',
        `set -euo pipefail
OUT=out
API_PORT=0
STALL_PID=''
failed=()
${functions.join('\n')}
trap stop_stall_server EXIT
fail() { exit 1; }
run_flow() {
  printf 'mode=headers\nmode=body\n' >> out/stall-server.log
  printf 'REQUEST_TIMEOUT\nREQUEST_TIMEOUT\n' > out/request-stall/device.log
  printf '%s\n' ${modes
    .split(' ')
    .map((mode) => `'mode=${mode}'`)
    .join(' ')} > out/request-stall/api.log
}
run_checks
`,
      ],
      { cwd: directory, encoding: 'utf8', timeout: BASH_TIMEOUT_MS },
    )
    expect(result.status, result.stderr).toBe(modes === 'headers body' ? 0 : 1)
  },
)
