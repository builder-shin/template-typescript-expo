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

/** macOS 명령만 가짜다. 받은 .app 을 재는 실제 bash 가 서명·entitlement 실패를 전파하는지 잰다. */
const SOURCE = readFileSync(resolve('test/e2e/ios.sh'), 'utf8')
const WORK = mkdtempSync(join(tmpdir(), 'ios-signature-'))
const APP_ID = 'com.example.templateexpo.e2e'
afterAll(() => rmSync(WORK, { recursive: true, force: true }))

function fn(name: string): string {
  const match = new RegExp(`^${name}\\(\\) \\{$[\\s\\S]*?^\\}`, 'm').exec(SOURCE)
  if (match === null) throw new Error(`${name} 이 없다`)
  return match[0]
}

let scenes = 0
function run(entitlements: unknown, verify = '0') {
  const scene = join(WORK, String(++scenes))
  mkdirSync(join(scene, 'probe.app', 'EXConstants.bundle'), { recursive: true })
  mkdirSync(join(scene, '.maestro-output'))
  writeFileSync(
    join(scene, 'probe.app', 'EXConstants.bundle', 'app.config'),
    JSON.stringify({
      extra: { appVariant: 'e2e', backendUrl: 'http://localhost:4100' },
      updates: { enabled: false },
    }),
  )
  writeFileSync(join(scene, 'probe.app', 'Expo.plist'), '')
  writeFileSync(join(scene, 'probe.app', 'Info.plist'), '')
  writeFileSync(join(scene, 'entitlements.json'), JSON.stringify(entitlements))
  const commands = {
    codesign: `printf '%s\\n' "$*" >> signature.calls
case "$1" in
  --verify) exit "$VERIFY_STATUS" ;;
  --display) printf '<plist>fixture</plist>' ;;
  *) exit 99 ;;
esac`,
    plutil: `case "$1 $2" in
  '-extract EXUpdatesEnabled') echo false ;;
  '-extract NSAppTransportSecurity.NSAllowsLocalNetworking') echo true ;;
  '-extract CFBundleIdentifier') echo com.example.templateexpo.e2e ;;
  '-convert json') cat entitlements.json ;;
  *) exit 98 ;;
esac`,
  }
  for (const [name, body] of Object.entries(commands)) {
    const path = join(scene, name)
    writeFileSync(path, `#!/bin/sh\n${body}\n`)
    chmodSync(path, 0o755)
  }
  const env: NodeJS.ProcessEnv = { ...process.env, VERIFY_STATUS: verify }
  delete env.BASH_ENV
  const signature = SOURCE.includes('assert_signature() {') ? fn('assert_signature') : ''
  const result = spawnSync(
    resolveBash(),
    [
      '-c',
      `set -euo pipefail\nexport PATH="$PWD:$PATH"\nAPP_ID=${APP_ID}\n${fn('fail')}\n${signature}\n${fn('assert_app')}\nassert_app "$PWD/probe.app" http://localhost:4100`,
    ],
    { cwd: scene, env, encoding: 'utf8', timeout: BASH_TIMEOUT_MS },
  )
  return result
}

describe('받은 Simulator .app 의 Keychain 서명', () => {
  const valid = { 'application-identifier': APP_ID, 'keychain-access-groups': [APP_ID] }
  it('strict/deep 검증과 정확한 앱 식별자·Keychain 그룹을 함께 통과해야 한다', () => {
    const result = run(valid)
    expect(result.status, result.stderr).toBe(0)
    expect(result.stderr).toContain('Keychain 서명')
  })
  it('entitlement 값이 맞아도 서명 검증 실패를 거절한다', () => {
    const result = run(valid, '17')
    expect(result.status, result.stderr).toBe(1)
    expect(result.stderr).toContain('서명 검증')
  })
  it.each([
    {},
    { ...valid, 'application-identifier': 'com.example.wrong' },
    { ...valid, 'keychain-access-groups': [] },
    { ...valid, 'keychain-access-groups': ['com.example.wrong'] },
    { ...valid, 'keychain-access-groups': [APP_ID, 'com.example.extra'] },
  ])('없거나 다른 entitlement를 거절한다: %j', (entitlements) => {
    const result = run(entitlements)
    expect(result.status, result.stderr).toBe(1)
    expect(result.stderr).toContain('Keychain entitlement')
  })
})

describe('Simulator 중첩 코드의 서명 순서', () => {
  function sign(failNested = '0') {
    const scene = join(WORK, String(++scenes))
    mkdirSync(
      join(scene, 'probe.app', 'Frameworks', 'Outer.framework', 'Frameworks', 'Inner.framework'),
      { recursive: true },
    )
    mkdirSync(join(scene, 'probe.app', 'PlugIns', 'Probe.appex'), { recursive: true })
    mkdirSync(join(scene, '.maestro-output'))
    writeFileSync(join(scene, 'probe.app', 'Frameworks', 'probe.dylib'), '')
    const commands = {
      plutil: `printf '%s\\n' "$*" >> plist.calls
if [ "$1" = -create ]; then : > "$3"; fi`,
      codesign: `printf '%s\\n' "$*" >> signature.calls
case "$*" in *Inner.framework) exit "$FAIL_NESTED" ;; esac`,
    }
    for (const [name, body] of Object.entries(commands)) {
      const path = join(scene, name)
      writeFileSync(path, `#!/bin/sh\n${body}\n`)
      chmodSync(path, 0o755)
    }
    const env: NodeJS.ProcessEnv = { ...process.env, FAIL_NESTED: failNested }
    delete env.BASH_ENV
    const result = spawnSync(
      resolveBash(),
      [
        '-c',
        `set -euo pipefail\nexport PATH="$PWD:$PATH"\nAPP_ID=${APP_ID}\n${fn('fail')}\n${fn('sign_simulator_app')}\nsign_simulator_app "$PWD/probe.app"`,
      ],
      { cwd: scene, env, encoding: 'utf8', timeout: BASH_TIMEOUT_MS },
    )
    const read = (name: string) =>
      existsSync(join(scene, name)) ? readFileSync(join(scene, name), 'utf8').trim() : ''
    return { result, calls: read('signature.calls').split(/\r?\n/), plist: read('plist.calls') }
  }

  it('중첩 framework를 먼저 서명하고 앱에만 Keychain entitlement를 준다', () => {
    const { result, calls, plist } = sign()
    expect(result.status, result.stderr).toBe(0)
    expect(calls).toHaveLength(5)
    expect(calls.findIndex((call) => call.endsWith('/Inner.framework'))).toBeLessThan(
      calls.findIndex((call) => call.endsWith('/Outer.framework')),
    )
    expect(calls.some((call) => call.endsWith('/Probe.appex'))).toBe(true)
    expect(calls.some((call) => call.endsWith('/probe.dylib'))).toBe(true)
    expect(calls.slice(0, -1).every((call) => !call.includes('--entitlements'))).toBe(true)
    expect(calls.at(-1)).toMatch(
      /--force --sign - --entitlements .* --generate-entitlement-der .*\/probe\.app$/,
    )
    expect(plist).toContain(`-insert application-identifier -string ${APP_ID}`)
    expect(plist).toContain(`-insert keychain-access-groups -json ["${APP_ID}"]`)
  })

  it('중첩 서명 실패 뒤에는 앱을 서명하지 않는다', () => {
    const { result, calls } = sign('17')
    expect(result.status, result.stderr).toBe(1)
    expect(result.stderr).toContain('중첩 코드의 ad-hoc 서명 실패')
    expect(calls.every((call) => !call.includes('--entitlements'))).toBe(true)
  })
})
