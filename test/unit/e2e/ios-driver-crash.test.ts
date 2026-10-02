import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'

const WORK = mkdtempSync(join(tmpdir(), 'ios-driver-crash-'))
const DETECTOR = resolve('test/e2e/ios-driver-crash.ts')
const fixture = (backend: string, kind: string) =>
  readFileSync(resolve(`test/fixtures/ios-driver/${backend}-${kind}.txt`), 'utf8')
afterAll(() => rmSync(WORK, { recursive: true, force: true }))

function detect(runner: string, maestro: string, extraRunner?: string) {
  const directory = mkdtempSync(join(WORK, 'case-'))
  const debug = join(directory, '.maestro/tests/probe')
  mkdirSync(debug, { recursive: true })
  writeFileSync(join(debug, 'xctest_runner_probe.log'), runner)
  writeFileSync(join(debug, 'maestro.log'), maestro)
  if (extraRunner !== undefined) writeFileSync(join(debug, 'device-xctest.log'), extraRunner)
  return spawnSync(process.execPath, [DETECTOR, directory], {
    encoding: 'utf8',
    timeout: 5000,
  })
}

describe('Maestro #3538의 실패한 status-bar query와 unreachable을 함께 요구한다', () => {
  it.each(['rails', 'nestjs'])('실제 CI %s 로그의 중첩 debug 디렉터리에서 찾는다', (backend) => {
    const result = detect(fixture(backend, 'xctest'), fixture(backend, 'maestro'))
    expect(result.status, result.stderr).toBe(0)
  })

  const runner = fixture('rails', 'xctest')
  const maestro = fixture('rails', 'maestro')
  it.each([
    ['앱 단언 실패', runner, 'Assertion is false: id: login-screen is visible'],
    [
      '상태 표시줄 없는 unreachable',
      runner.replace('Fetch status bar hierarchy - start', ''),
      maestro,
    ],
    ['드라이버 시작 timeout', '', 'Maestro driver startup timed out. Connection refused'],
    [
      '다른 AX 오류',
      runner.replaceAll('kAXErrorInvalidUIElement', 'kAXErrorCannotComplete'),
      maestro,
    ],
    [
      '무시된 AX 오류',
      runner.replace(
        'testHttpServer] : Failed to resolve query: Failed to resolve remote element',
        'Ignoring failure to get hierarchy for remote element',
      ),
      maestro,
    ],
    [
      '이미 종료한 status-bar query',
      runner.replace(
        'Checking existence',
        'Fetch status bar hierarchy - duration 0.1\nChecking existence',
      ),
      maestro,
    ],
    [
      'Tear Down 뒤 다른 실패',
      runner.replace('Checking existence', 'Tear Down\nChecking existence'),
      maestro,
    ],
    ['다른 test 실패', runner.replace('testHttpServer]', 'testSomethingElse]'), maestro],
    ['오류 없이 unreachable만', '', maestro],
    ['연결 거절만', runner, 'java.net.ConnectException: Connection refused'],
  ])('%s는 복구하지 않는다', (_name, xctest, cli) => {
    expect(detect(xctest, cli).status).toBe(1)
  })

  it('서로 다른 runner 로그의 시작과 실패를 이어 붙이지 않는다', () => {
    const start = 'Fetch status bar hierarchy - start\n'
    expect(
      detect(start, maestro, runner.replace('Fetch status bar hierarchy - start', '')).status,
    ).toBe(1)
  })

  it('debug 로그를 읽지 못하면 복구하지 않는다', () => {
    const result = spawnSync(process.execPath, [DETECTOR, join(WORK, 'missing')], {
      encoding: 'utf8',
      timeout: 5000,
    })
    expect(result.status).toBe(1)
  })
})
