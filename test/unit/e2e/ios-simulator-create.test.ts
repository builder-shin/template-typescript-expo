import { spawnSync } from 'node:child_process'
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { BASH_TIMEOUT_MS, resolveBash } from '../support/bash'

const SOURCE = readFileSync(resolve('test/e2e/ios.sh'), 'utf8')
const WORK = mkdtempSync(join(tmpdir(), 'ios-create-'))
afterAll(() => rmSync(WORK, { recursive: true, force: true }))

describe('전용 simulator 생성은 기존 기기의 정보만 읽는다', () => {
  it.each(['wanted-device', 'missing-device'])(
    '%s 선택은 다른 booted 기기로 바뀌지 않는다',
    (wanted) => {
      const directory = mkdtempSync(join(WORK, 'case-'))
      const devices = {
        devices: {
          'com.apple.CoreSimulator.SimRuntime.iOS-27-0': [
            {
              udid: 'user-booted',
              name: 'iPhone 17',
              state: 'Booted',
              deviceTypeIdentifier: 'type-27',
            },
          ],
          'com.apple.CoreSimulator.SimRuntime.iOS-26-5': [
            {
              udid: 'wanted-device',
              name: 'iPhone 17',
              state: 'Shutdown',
              deviceTypeIdentifier: 'type-26',
            },
          ],
        },
      }
      writeFileSync(join(directory, 'devices.json'), JSON.stringify(devices))
      writeFileSync(
        join(directory, 'xcrun'),
        `#!/bin/sh
printf '%s\\n' "$*" >> calls.log
case "$1 $2" in
  'simctl list') cat devices.json ;;
  'simctl create') [ "$4" = type-26 ] && [ "$5" = com.apple.CoreSimulator.SimRuntime.iOS-26-5 ] || exit 91; echo new-owned-device ;;
  *) exit 92 ;;
esac
`,
      )
      chmodSync(join(directory, 'xcrun'), 0o755)
      const functions = ['pick_simulator', 'create_simulator']
        .map((name) => {
          const result = new RegExp(`^${name}\\(\\) \\{$[\\s\\S]*?^\\}`, 'm').exec(SOURCE)?.[0]
          if (result === undefined) throw new Error(name)
          return result
        })
        .join('\n')
      const env: NodeJS.ProcessEnv = { ...process.env, E2E_SIMULATOR: wanted }
      delete env.BASH_ENV
      const result = spawnSync(
        resolveBash(),
        ['-c', `set -euo pipefail\nexport PATH="$PWD:$PATH"\n${functions}\ncreate_simulator`],
        { cwd: directory, env, encoding: 'utf8', timeout: BASH_TIMEOUT_MS },
      )
      expect(result.status, result.stderr).toBe(wanted === 'wanted-device' ? 0 : 1)
      const calls = readFileSync(join(directory, 'calls.log'), 'utf8')
      expect(calls).not.toMatch(/boot|shutdown|delete|clone/)
      if (wanted === 'wanted-device') expect(result.stdout.trim()).toBe('new-owned-device')
      else expect(calls).not.toContain('create')
    },
  )
})
