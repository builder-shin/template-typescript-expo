import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { resolveBash } from '../support/bash'
import { httpFailureLine } from '@/lib/jsonapi/failure-log'

/**
 * E2E 가드(스펙 11.3)를 실제 스크립트로 잰다 - 한 번도 걸리지 않는 가드는 있으나 마나다.
 *
 * 기기 로그 줄은 `adb logcat -v brief` 의 모양이고, HTTP 실패 줄은 앱이 쓰는 함수
 * (httpFailureLine)로 만든다 - 앱이 찍는 형식과 스크립트가 읽는 형식을 이 파일이 맞댄다.
 */

/** Git Bash 는 역슬래시 경로를 이스케이프로 먹어 치운다. */
function toPosix(path: string): string {
  return path.split('\\').join('/')
}

const SCRIPT = toPosix(resolve('test/e2e/guard-log.sh'))
const FIXTURES = mkdtempSync(join(tmpdir(), 'e2e-guard-'))

afterAll(() => {
  rmSync(FIXTURES, { recursive: true, force: true })
})

/** Bash 후보의 실제 실행 확인과 30초 제한은 test/unit/support/bash.ts 가 소유한다. */
const BASH = resolveBash()

let written = 0

function runGuard(file: string, allowed: readonly string[]): { status: number; stderr: string } {
  const run = spawnSync(BASH, [SCRIPT, toPosix(file), ...allowed], { encoding: 'utf8' })
  if (run.error) throw run.error
  if (run.status === null) throw new Error(`스크립트가 신호로 죽었다: ${String(run.signal)}`)
  return { status: run.status, stderr: run.stderr }
}

function guard(lines: readonly string[], ...allowed: string[]) {
  written += 1
  const file = join(FIXTURES, `logcat-${written}.txt`)
  writeFileSync(file, lines.map((line) => `${line}\n`).join(''), 'utf8')
  return runGuard(file, allowed)
}

const RUNNING = 'I/ReactNativeJS( 4321): Running "main" with {"rootTag":11}'

function appLine(text: string): string {
  return `I/ReactNativeJS( 4321): ${text}`
}

const CONFLICT = appLine(
  httpFailureLine('POST', '/api/v1/auth/register', 409, [{ code: 'EMAIL_ALREADY_REGISTERED' }]),
)
const INVALID = appLine(
  httpFailureLine('POST', '/api/v1/auth/register', 422, [{ code: 'VALIDATION_ERROR' }]),
)

describe('test/e2e/guard-log.sh', () => {
  it('깨끗한 로그는 통과한다', () => {
    expect(guard([RUNNING]).status).toBe(0)
  })

  it('JS 경고가 있으면 실패하고 그 줄을 낸다', () => {
    const run = guard([RUNNING, 'W/ReactNativeJS( 4321): probe warning'])
    expect(run.status).toBe(1)
    expect(run.stderr).toContain('probe warning')
  })

  it('JS 오류가 있으면 실패한다', () => {
    expect(guard([RUNNING, 'E/ReactNativeJS( 4321): probe error']).status).toBe(1)
  })

  it('JS 치명 오류(F)가 있으면 실패한다', () => {
    expect(guard([RUNNING, 'F/ReactNativeJS( 4321): probe fatal']).status).toBe(1)
  })

  // 로그를 모으지 못했을 때의 모양 셋이다. 걸릴 줄이 하나도 없어서, 앱의 줄을 요구하지 않으면 아래 검사가
  // 전부 통과한다 - "가드가 돌았다"와 "가드가 죽었다"가 구별되지 않는다.
  it.each<[string, readonly string[]]>([
    ['빈 로그', []],
    ['adb 오류만 든 로그', ['error: no devices/emulators found']],
    ['logcat 버퍼 머리 줄만 든 로그', ['--------- beginning of main']],
  ])('%s는 실패한다 - 앱의 줄(ReactNativeJS)이 없으면 가드가 잰 것이 없다', (_label, lines) => {
    const run = guard(lines)
    expect(run.status).toBe(1)
    expect(run.stderr).toContain('ReactNativeJS')
  })

  it('치명 오류(FATAL EXCEPTION) 줄이 있으면 실패한다 - 어느 프로세스의 것인지 가리지 않는다', () => {
    // 앱(4321)이 아닌 pid 의 줄이다 - 하네스가 모으는 AndroidRuntime 의 E 줄에는 다른 프로세스의 것도 든다.
    expect(guard([RUNNING, 'E/AndroidRuntime( 9999): FATAL EXCEPTION: main']).status).toBe(1)
  })

  it('플로가 선언한 HTTP 실패는 통과한다', () => {
    expect(guard([RUNNING, CONFLICT], '409').status).toBe(0)
  })

  it('선언하지 않은 HTTP 실패는 실패하고 무엇이 걸렸는지 낸다', () => {
    const run = guard([RUNNING, CONFLICT], '401')
    expect(run.status).toBe(1)
    expect(run.stderr).toContain('409')
    expect(run.stderr).toContain('EMAIL_ALREADY_REGISTERED')
  })

  it('상태 번호의 일부만 겹쳐서는 통과하지 않는다', () => {
    expect(guard([RUNNING, INVALID], '42').status).toBe(1)
    expect(guard([RUNNING, INVALID], '1422').status).toBe(1)
  })

  it('백엔드에 닿지 못한 요청(상태 0)도 선언하지 않았으면 실패한다', () => {
    const unreachable = appLine(
      httpFailureLine('POST', '/api/v1/auth/login', 0, [{ code: 'NETWORK_ERROR' }]),
    )
    expect(guard([RUNNING, unreachable]).status).toBe(1)
  })

  it('선언한 HTTP 실패가 기기 로그에 없으면 실패한다 - 플로가 더는 일으키지 않는 선언을 남기지 않는다', () => {
    const run = guard([RUNNING], '409')
    expect(run.status).toBe(1)
    expect(run.stderr).toContain('409')
  })

  it('상태가 둘이면 둘 다 선언해야 통과한다', () => {
    expect(guard([RUNNING, CONFLICT, INVALID], '409').status).toBe(1)
    expect(guard([RUNNING, CONFLICT, INVALID], '409', '422').status).toBe(0)
  })

  it('Windows adb 의 CRLF 줄 끝에서도 상태를 읽는다', () => {
    written += 1
    const file = join(FIXTURES, `logcat-${written}.txt`)
    writeFileSync(file, `${[RUNNING, CONFLICT].join('\r\n')}\r\n`, 'utf8')
    expect(runGuard(file, []).status).toBe(1)
    expect(runGuard(file, ['409']).status).toBe(0)
  })

  it('로그 파일이 없으면 실패한다 - 로그를 못 모은 채 통과하지 않는다', () => {
    expect(runGuard(join(FIXTURES, 'missing.txt'), []).status).toBe(1)
  })
})
