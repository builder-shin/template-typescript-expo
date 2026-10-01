import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'

/**
 * Android 하네스(`test/e2e/run-android.sh`)가 실패한 플로의 기록에서 앱 밖(기기·adb)의 실패로 보이는 흔적을 짚는지
 * 잰다 - 짚기만 하고 재시도하지 않는다(스펙 16장). D5 실측 C2 의 두 번이 재료다: Maestro 의 기기 드라이버가 앱 창을
 * 찾지 못한 정지(`W/UiDevice: Active window root not found.`)와 Maestro 가 adb 서버에 닿지 못한 것
 * (`java.net.ConnectException`). 하네스 전체를 돌리지 않는다 - 함수(`environment_hint`)만 떼어 기록 파일 둘
 * (`logcat.txt`·`maestro.log`)로 돌리고, 배선은 소스에서 본다.
 */

const SOURCE = readFileSync(resolve('test/e2e/run-android.sh'), 'utf8')

/** 흔적을 짚는 함수 - `environment_hint() {` 부터 맨 앞의 `}` 까지. */
const FUNCTION = /^environment_hint\(\) \{$[\s\S]*?^\}$/m

const WORK = mkdtempSync(join(tmpdir(), 'environment-hint-'))

afterAll(() => {
  rmSync(WORK, { recursive: true, force: true })
})

/** Git Bash 는 역슬래시 경로를 이스케이프로 먹어 치운다. */
function toPosix(path: string): string {
  return path.split('\\').join('/')
}

/** test/unit/scripts/check-static.test.ts 와 같은 방법으로 bash 를 고른다. */
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
    const probe = spawnSync(candidate, ['-c', 'printf ok'], { encoding: 'utf8', timeout: 30_000 })
    if (probe.status === 0 && probe.stdout === 'ok') return candidate
  }
  throw new Error(`쓸 수 있는 bash 를 찾지 못했다 - 후보: ${candidates.join(' · ')}`)
}

let records = 0

/** 기록 디렉터리 하나를 만들고 하네스와 같은 셸 옵션(`set -euo pipefail`)으로 함수만 돌린다. */
function hint(files: { readonly logcat?: string; readonly maestro?: string }) {
  const block = FUNCTION.exec(SOURCE)?.[0]
  if (block === undefined) throw new Error('test/e2e/run-android.sh 에 environment_hint 가 없다')
  records += 1
  const out = join(WORK, `flow-${String(records)}`)
  mkdirSync(out)
  if (files.logcat !== undefined) writeFileSync(join(out, 'logcat.txt'), files.logcat, 'utf8')
  if (files.maestro !== undefined) writeFileSync(join(out, 'maestro.log'), files.maestro, 'utf8')
  return spawnSync(
    resolveBash(),
    ['-c', `set -euo pipefail\n${block}\nenvironment_hint "$1"`, 'run-android.sh', toPosix(out)],
    { encoding: 'utf8', timeout: 30_000 },
  )
}

const APP_LINE = 'I/ReactNativeJS( 4946): Running "main"\n'
const STALL_LINE = 'W/UiDevice( 5120): Active window root not found.\n'
const CONNECT_LINE = 'java.net.ConnectException: Connection timed out: connect'

describe('Android 하네스의 환경 흔적', () => {
  it('기기 로그의 "Active window root not found" 를 세어 짚는다', () => {
    const run = hint({ logcat: `${APP_LINE}${STALL_LINE.repeat(3)}`, maestro: 'Flow failed\n' })

    expect(run.status).toBe(0)
    expect(run.stderr).toContain("UiAutomator 의 'Active window root not found' 3번")
    expect(run.stderr).not.toContain('연결하지 못했다')
  })

  it('maestro.log 의 첫 ConnectException 줄을 그대로 짚는다', () => {
    const run = hint({
      logcat: APP_LINE,
      maestro: `Running flow\n${CONNECT_LINE}\n\tat java.base/sun.nio.ch.Net.connect0(Native Method)\n${CONNECT_LINE}\n`,
    })

    expect(run.status).toBe(0)
    expect(run.stderr).toContain(`Maestro 가 연결하지 못했다: ${CONNECT_LINE}`)
    expect(run.stderr.split(CONNECT_LINE)).toHaveLength(2)
    expect(run.stderr).not.toContain('Active window root not found')
  })

  it('흔적이 없으면 아무것도 말하지 않는다', () => {
    const run = hint({ logcat: APP_LINE, maestro: 'Flow failed: Element not found\n' })

    expect(run.status).toBe(0)
    expect(run.stderr).toBe('')
  })

  it('기록 파일이 없어도 멈추지 않는다 - 로그를 모으지 못한 실패도 같은 자리를 지난다', () => {
    const run = hint({})

    expect(run.status).toBe(0)
    expect(run.stderr).toBe('')
  })

  it('하네스는 Maestro 가 실패한 플로에서 부르고, 기기 로그는 UiDevice 의 경고도 모은다', () => {
    const runFlow = /^run_flow\(\) \{$[\s\S]*?^\}$/m.exec(SOURCE)?.[0] ?? ''
    const failure = runFlow.indexOf('플로가 실패했다(exit $rc)')
    expect(failure, 'run_flow 에 Maestro 실패의 자리가 없다').toBeGreaterThan(-1)
    expect(runFlow.indexOf('environment_hint "$out"')).toBeGreaterThan(failure)
    expect(runFlow).toMatch(/logcat -d -v brief -s ReactNativeJS:V AndroidRuntime:E UiDevice:W /)
  })
})
