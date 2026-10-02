import { spawnSync } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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

describe('iOS 시스템 비밀번호 자동완성의 실행 범위', () => {
  it.each([
    ['absent', false, false, false],
    ['0', false, false, false],
    ['1', false, false, false],
    ['1', true, false, false],
    ['0', false, true, false],
    ['1', false, true, false],
    ['absent', false, false, true],
    ['0', false, false, true],
    ['1', false, false, true],
  ] as const)(
    '원래 설정 %s, 쓰기 무시 %s, 첫 읽기 실패 %s, 후속 실패 %s',
    (original, ignoreWrite, failFirstRead, failLater) => {
      const directory = join(
        WORK,
        `autofill-${original}-${String(ignoreWrite)}-${String(failFirstRead)}-${String(failLater)}`,
      )
      mkdirSync(directory)
      writeFileSync(join(directory, 'setting'), original)
      const xcrun = join(directory, 'xcrun')
      writeFileSync(
        xcrun,
        `#!/bin/sh
case "$1 $2 $3 $4 $6" in
  'simctl spawn probe-ios-device defaults com.apple.WebUI') ;;
  *) exit 90 ;;
esac
echo "$5" >> calls.log
case "$5" in
  read|export)
    if [ "$FAIL_FIRST_READ" = 1 ] && [ ! -f read-once ]; then
      touch read-once
      echo 'simctl transport failed' >&2
      exit 17
    fi
    value=$(cat setting)
    if [ "$5" = export ]; then
      [ "$7" = - ] || exit 94
      if [ "$value" = absent ]; then echo '{}'; else echo "{\\"AutoFillPasswords\\":$value}"; fi
    else
      [ "$7" = AutoFillPasswords ] || exit 95
      [ "$value" != absent ] || exit 1
      echo "$value"
    fi
    ;;
  write) [ "$8" = -int ] || exit 91; [ "$IGNORE_WRITE" = 1 ] || echo "$9" > setting ;;
  delete) echo absent > setting ;;
  *) exit 92 ;;
esac
`,
      )
      chmodSync(xcrun, 0o755)
      // plutil 자체의 XML 변환은 Mac에서 검증한다. 여기서는 성공/실패한 simctl 경계와 EXIT의 호출 순서를 잰다.
      writeFileSync(join(directory, 'plutil'), '#!/bin/sh\ncat\n')
      chmodSync(join(directory, 'plutil'), 0o755)
      mkdirSync(join(directory, 'test/e2e'), { recursive: true })
      writeFileSync(join(directory, 'test/e2e/native-backend.sh'), '#!/bin/sh\nexit 0\n')
      chmodSync(join(directory, 'test/e2e/native-backend.sh'), 0o755)
      const functions = ['prepare_autofill', 'restore_autofill', 'cleanup'].map((name) => {
        const block = new RegExp(`^${name}\\(\\) \\{$[\\s\\S]*?^\\}`, 'm').exec(SOURCE)?.[0]
        if (block === undefined) throw new Error(`${name} 이 없다`)
        return block
      })
      const trap = /^trap cleanup EXIT$/m.exec(SOURCE)?.[0]
      if (trap === undefined) throw new Error('cleanup EXIT trap이 없다')
      const env: NodeJS.ProcessEnv = {
        ...process.env,
        IGNORE_WRITE: ignoreWrite ? '1' : '0',
        FAIL_FIRST_READ: failFirstRead ? '1' : '0',
      }
      delete env.BASH_ENV
      const result = spawnSync(
        resolveBash(),
        [
          '-c',
          `set -euo pipefail
export PATH="$PWD:$PATH"
UDID=probe-ios-device
autofill_original=''
fail() { echo "$*" >&2; exit 1; }
stop_device_log() { :; }
stop_stall_server() { :; }
${functions.join('\n')}
${trap}
result=0
prepare_autofill || result=$?
if [ "$result" = 0 ]; then [ "$(cat setting)" = 0 ] || exit 93; fi
if [ "$result" = 0 ] && [ "${String(failLater)}" = true ]; then exit 23; fi
exit "$result"
`,
        ],
        { cwd: directory, env, encoding: 'utf8', timeout: BASH_TIMEOUT_MS },
      )
      expect(result.status, result.stderr).toBe(
        ignoreWrite || failFirstRead ? 1 : failLater ? 23 : 0,
      )
      expect(readFileSync(join(directory, 'setting'), 'utf8').trim()).toBe(original)
      const calls = readFileSync(join(directory, 'calls.log'), 'utf8').trim().split('\n')
      if (failFirstRead) {
        expect(calls).not.toContain('write')
        expect(calls).not.toContain('delete')
        expect(result.stderr).toContain('simctl transport failed')
      } else if (original === 'absent') {
        expect(calls).toContain('write')
        expect(calls.at(-1)).toBe('delete')
      }
    },
  )
})
