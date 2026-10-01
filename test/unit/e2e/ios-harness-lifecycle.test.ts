import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  existsSync,
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

/** 실제 하네스 본문을 가짜 명령으로 실행한다 - 포트·서버·시뮬레이터를 만들지 않는다. */
const BACKEND = readFileSync(resolve('test/e2e/native-backend.sh'), 'utf8')
const IOS = readFileSync(resolve('test/e2e/run-ios.sh'), 'utf8')
const WORK = mkdtempSync(join(tmpdir(), 'ios-lifecycle-'))
const BASH = resolveBash()
afterAll(() => rmSync(WORK, { recursive: true, force: true }))

function block(source: string, from: string, to: string): string {
  const start = source.indexOf(from)
  const end = source.indexOf(to, start)
  if (start < 0 || end < 0) throw new Error(`하네스 블록이 없다: ${from}`)
  return source.slice(start, end)
}

function fn(source: string, name: string): string {
  return `${block(source, `${name}() {`, '\n}')}\n}`
}

let scenes = 0
function run(body: string, overrides: Record<string, string> = {}) {
  const scene = join(WORK, String(++scenes))
  mkdirSync(join(scene, 'src', '.git'), { recursive: true })
  writeFileSync(join(scene, 'api.pid'), '424242\n')
  writeFileSync(join(scene, 'api.log'), 'fixture API log\n')
  const commands: Record<string, string> = {
    git: 'printf fixture',
    lsof: 'printf "%s\\n" "$*" >> port.calls\nexit "$PORT_TAKEN"',
    stop_api: 'echo stop_api >> launch.calls',
    start_services: 'echo start_services >> launch.calls',
    start_api: 'echo start_api >> launch.calls',
    sleep: 'printf "%s\\n" "$*" >> sleep.calls',
    wait: 'printf "%s\\n" "$*" >> wait.calls\nexit "$WAIT_STATUS"',
    kill: `printf '%s\\n' "$*" >> kill.calls
case "$1" in
  -0) [ "$PROCESS_MODE" != dead ] && [ ! -f stopped ] ;;
  -INT) if [ "$PROCESS_MODE" = int ]; then : > stopped; fi ;;
  -TERM) : > stopped ;;
  *) exit 99 ;;
esac`,
    curl: `printf '%s\\n' "$*" >> curl.calls
case "$CURL_MODE" in
  healthy) exit 0 ;;
  dies) : > stopped; exit 0 ;;
  stall)
    connect=0 max=0
    while [ "$#" -gt 0 ]; do
      case "$1" in
        --connect-timeout) connect=$2; shift ;;
        --max-time) max=$2; shift ;;
      esac
      shift
    done
    if [ "$connect" -lt 1 ] || [ "$connect" -gt "$TIME_LEFT" ] ||
      [ "$max" -lt 1 ] || [ "$max" -gt "$TIME_LEFT" ]; then
      : > unbounded
      exit 28
    fi
    if [ -f probed ]; then echo "$max" > elapsed; else echo "$FIRST_ELAPSED" > elapsed; fi
    : > probed
    exit 28 ;;
  *) exit 99 ;;
esac`,
  }
  for (const [name, command] of Object.entries(commands)) {
    const path = join(scene, name)
    writeFileSync(path, `#!/bin/sh\n${command}\n`, 'utf8')
    chmodSync(path, 0o755)
  }
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PROCESS_MODE: 'alive',
    CURL_MODE: 'healthy',
    PORT_TAKEN: '1',
    WAIT_STATUS: '0',
    FIRST_ELAPSED: '117',
    ...overrides,
  }
  delete env.BASH_ENV
  const result = spawnSync(
    BASH,
    [
      '-c',
      `set -euo pipefail
export PATH="$PWD:$PATH"
enable -n kill wait
BACKEND_KIND=fastapi
API_PORT=4100
API_PID="$PWD/api.pid"
API_LOG="$PWD/api.log"
SRC="$PWD/src"
access=10
log_pid=424242
${fn(BACKEND, 'fail')}
${body}`,
      'ios-lifecycle',
    ],
    { cwd: scene, env, encoding: 'utf8', timeout: Math.min(BASH_TIMEOUT_MS, 1500) },
  )
  const read = (name: string) =>
    existsSync(join(scene, name)) ? readFileSync(join(scene, name), 'utf8').trim() : ''
  return { result, read }
}

const READY = `ready() {\n${block(BACKEND, '  local deadline=', '\n}')}\n}\nready`
const START = `case start in\n${block(BACKEND, '  start)\n', '\n  stop)')}\nesac`
const STOP = `${fn(IOS, 'stop_device_log')}\nif stop_device_log; then echo stop=0; else echo stop=1; exit 1; fi\necho "log_pid=$log_pid"`

describe('네이티브 API 준비 대기', () => {
  it('기록한 PID가 죽었으면 다른 서버의 건강한 응답을 준비로 받지 않는다', () => {
    const { result, read } = run(READY, { PROCESS_MODE: 'dead' })
    expect(result.status, result.stderr).toBe(1)
    expect(result.stderr).toContain('API 가 뜨다가 죽었다')
    expect(result.stdout).not.toContain('백엔드 준비:')
    expect(read('curl.calls')).toBe('')
  })

  it('건강한 응답을 받는 사이 PID가 죽어도 준비를 선언하지 않는다', () => {
    const { result, read } = run(READY, { CURL_MODE: 'dies' })
    expect(result.status, result.stderr).toBe(1)
    expect(result.stdout).not.toContain('백엔드 준비:')
    expect(read('kill.calls').split(/\r?\n/)).toEqual(['-0 424242', '-0 424242'])
  })

  it('우리 PID가 계속 살아 있고 응답이 건강하면 준비를 선언한다', () => {
    const { result } = run(READY)
    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toContain('백엔드 준비: fastapi @ fixture')
  })

  it('포트가 이미 점유되었으면 종료·서비스·API 실행 전에 거부한다', () => {
    const { result, read } = run(START, { PORT_TAKEN: '0' })
    expect(result.status, result.stderr).toBe(1)
    expect(result.stderr).toContain('4100')
    expect(read('port.calls')).toBe('-nP -iTCP:4100 -sTCP:LISTEN -t')
    expect(read('launch.calls')).toBe('')
  })

  it('포트가 비었으면 서비스를 시작한 뒤 API를 시작한다', () => {
    const { result, read } = run(START)
    expect(result.status, result.stderr).toBe(0)
    expect(read('launch.calls').split(/\r?\n/)).toEqual(['stop_api', 'start_services', 'start_api'])
  })

  it.each([
    [117, [120, 1], '2'],
    [119, [120], '1'],
  ])('응답이 멈춰도 자체 deadline으로 종료한다(첫 probe %s초)', (elapsed, bounds, sleeps) => {
    const { result, read } = run(
      `unset SECONDS
SECONDS=0
curl() {
  local rc=0
  TIME_LEFT=$((120 - SECONDS)) command curl "$@" || rc=$?
  if [ -f unbounded ]; then while :; do :; done; fi
  SECONDS=$((SECONDS + $(cat elapsed)))
  return "$rc"
}
sleep() { command sleep "$@"; SECONDS=$((SECONDS + $1)); }
${READY}`,
      { CURL_MODE: 'stall', FIRST_ELAPSED: String(elapsed) },
    )
    expect(result.error).toBeUndefined()
    expect(result.status, result.stderr).toBe(1)
    expect(result.stderr).toContain('API 가 120초 안에 127.0.0.1:4100 에서 준비되지 않았다')
    expect(read('curl.calls').split(/\r?\n/)).toEqual(
      bounds.map(
        (bound) =>
          `-fsS --connect-timeout ${bound} --max-time ${bound} http://127.0.0.1:4100/health/ready`,
      ),
    )
    expect(read('sleep.calls')).toBe(sleeps)
  })
})

describe('iOS 로그 스트림 종료', () => {
  it('종료 신호 전에 이미 죽은 스트림이면 실패하고 신호를 보내지 않는다', () => {
    const { result, read } = run(STOP, { PROCESS_MODE: 'dead', WAIT_STATUS: '17' })
    expect(result.status, result.stderr).toBe(1)
    expect(result.stderr).toContain('로그 스트림')
    expect(read('kill.calls')).toBe('-0 424242')
  })

  it.each([0, 130])('의도한 INT 종료(exit %s)는 성공한다', (status) => {
    const { result, read } = run(STOP, { PROCESS_MODE: 'int', WAIT_STATUS: String(status) })
    expect(result.status, result.stderr).toBe(0)
    expect(read('kill.calls')).toContain('-INT 424242')
    expect(read('wait.calls')).toBe('424242')
    expect(result.stdout).toContain('log_pid=\n')
  })

  it('INT를 무시하면 5초 뒤 TERM으로 끝내고 exit 143을 성공으로 받는다', () => {
    const { result, read } = run(STOP, { PROCESS_MODE: 'term', WAIT_STATUS: '143' })
    expect(result.status, result.stderr).toBe(0)
    expect(read('kill.calls')).toContain('-TERM 424242')
    expect(read('sleep.calls').split(/\r?\n/)).toEqual(['2', ...Array<string>(10).fill('0.5')])
    expect(read('wait.calls')).toBe('424242')
  })

  it('종료 신호를 보내도 예상하지 않은 wait 상태면 실패한다', () => {
    const { result } = run(STOP, { PROCESS_MODE: 'int', WAIT_STATUS: '17' })
    expect(result.status, result.stderr).toBe(1)
    expect(result.stderr).toContain('exit 17')
  })
})
