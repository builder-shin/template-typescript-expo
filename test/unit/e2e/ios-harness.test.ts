import { spawnSync } from 'node:child_process'
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { BASH_TIMEOUT_MS, resolveBash } from '../support/bash'

/** 시뮬레이터 없이 실제 reset_app 을 조건식에서 불러 로캘 초기화의 실패 전달을 잰다. */
const SOURCE = readFileSync(resolve('test/e2e/run-ios.sh'), 'utf8')
const WORK = mkdtempSync(join(tmpdir(), 'ios-harness-'))
afterAll(() => rmSync(WORK, { recursive: true, force: true }))

describe('iOS 로캘 초기화', () => {
  it('uninstall 이 실패하면 조건식 안에서도 실패를 돌려주고 다음 단계를 부르지 않는다', () => {
    const block = /^reset_app\(\) \{$[\s\S]*?^\}$/m.exec(SOURCE)?.[0]
    if (block === undefined) throw new Error('reset_app 이 없다')
    const xcrun = join(WORK, 'xcrun')
    writeFileSync(
      xcrun,
      '#!/bin/sh\nprintf "%s\\n" "$*" >> calls.log\ncase "$1 $2" in\n  "simctl uninstall") exit 17 ;;\n  "simctl terminate"|"simctl install"|"simctl keychain") exit 0 ;;\n  *) exit 99 ;;\nesac\n',
      'utf8',
    )
    chmodSync(xcrun, 0o755)
    const env: NodeJS.ProcessEnv = { ...process.env }
    delete env.BASH_ENV
    const result = spawnSync(
      resolveBash(),
      [
        '-c',
        `set -euo pipefail\nexport PATH="$PWD:$PATH"\nUDID=probe-ios-device\nAPP_ID=com.example.templateexpo.e2e\nAPP=/probe/e2e.app\n${block}\nif ! reset_app; then exit 1; fi`,
        'ios-harness',
      ],
      { cwd: WORK, env, encoding: 'utf8', timeout: BASH_TIMEOUT_MS },
    )
    expect(result.status, result.stderr).toBe(1)
    expect(readFileSync(join(WORK, 'calls.log'), 'utf8').trim().split(/\r?\n/)).toEqual([
      'simctl terminate probe-ios-device com.example.templateexpo.e2e',
      'simctl uninstall probe-ios-device com.example.templateexpo.e2e',
    ])
  })
})
