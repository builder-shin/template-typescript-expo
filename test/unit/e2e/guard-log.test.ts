import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
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

/**
 * 쓸 수 있는 bash 를 하나 고른다. 후보를 실제로 돌려 보고 판정한다 - Windows 의 PATH 에서
 * `bash` 는 WSL 의 bash.exe 로 잡힐 수 있고 그것은 /bin/bash 를 못 찾아 죽는다
 * (test/unit/scripts/check-citations.test.ts 와 같은 방법).
 */
function resolveBash(): string {
  const programFiles = process.env.ProgramW6432 ?? process.env.ProgramFiles ?? 'C:\\Program Files'
  const candidates =
    process.platform === 'win32'
      ? [
          'bash',
          join(programFiles, 'Git', 'bin', 'bash.exe'),
          join(programFiles, 'Git', 'usr', 'bin', 'bash.exe'),
        ]
      : ['bash']
  for (const candidate of candidates) {
    const probe = spawnSync(candidate, ['-c', 'printf ok'], { encoding: 'utf8' })
    if (probe.status === 0 && probe.stdout === 'ok') return candidate
  }
  throw new Error(`쓸 수 있는 bash 를 찾지 못했다 - 후보: ${candidates.join(' · ')}`)
}

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

  it('앱이 치명 오류로 죽으면 실패한다', () => {
    expect(guard([RUNNING, 'E/AndroidRuntime( 4321): FATAL EXCEPTION: main']).status).toBe(1)
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
