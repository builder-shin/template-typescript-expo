import { spawnSync } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { BASH_TIMEOUT_MS, resolveBash } from '../support/bash'

// 실제 bash 검사에 macOS 도구 경계만 주입한다. 실행/Keychain의 증명은 실제 E2E다.
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
function run(
  options: {
    simulated?: Record<string, unknown>
    host?: Record<string, unknown>
    missingSection?: string
    verify?: string
    truncated?: boolean
  } = {},
) {
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
  const simulated = Buffer.from(
    JSON.stringify(
      options.simulated ?? {
        'application-identifier': `34R3YQTSH8.${APP_ID}`,
      },
    ),
  )
  const binary = Buffer.concat([Buffer.alloc(128), simulated, Buffer.from([0x30, 0x00])])
  writeFileSync(
    join(scene, 'probe.app', 'Probe'),
    options.truncated ? binary.subarray(0, 32) : binary,
  )
  const sections = [
    `sectname __entitlements\nsegname __TEXT\naddr 0x100000080\nsize 0x${simulated.length.toString(16)}\noffset 128`,
    `sectname __ents_der\nsegname __TEXT\naddr 0x100000200\nsize 0x2\noffset ${128 + simulated.length}`,
  ].filter((section) => !section.includes(`sectname ${options.missingSection ?? 'none'}\n`))
  writeFileSync(join(scene, 'sections.txt'), sections.join('\n'))
  writeFileSync(join(scene, 'host.json'), JSON.stringify(options.host ?? {}))
  const commands = {
    codesign: `case "$1" in\n--verify) exit "$VERIFY_STATUS" ;;\n--display|-d) cat host.json ;;\n*) exit 99 ;;\nesac`,
    xcrun: `case "$1 $2" in\n'otool -l') cat sections.txt ;;\n*) exit 98 ;;\nesac`,
    plutil: `case "$1 $2" in
  '-extract EXUpdatesEnabled') echo false ;;
  '-extract NSAppTransportSecurity.NSAllowsLocalNetworking') echo true ;;
  '-extract CFBundleIdentifier') echo ${APP_ID} ;;
  '-extract CFBundleExecutable') echo Probe ;;
  '-convert json') if [ "$4" = - ]; then cat "$5"; else cat "$5" >"$4"; fi ;;
  *) exit 97 ;;
esac`,
  }
  for (const [name, body] of Object.entries(commands)) {
    const path = join(scene, name)
    writeFileSync(path, `#!/bin/sh\n${body}\n`)
    chmodSync(path, 0o755)
  }
  const env: NodeJS.ProcessEnv = { ...process.env, VERIFY_STATUS: options.verify ?? '0' }
  delete env.BASH_ENV
  return spawnSync(
    resolveBash(),
    [
      '-c',
      `set -euo pipefail\nexport PATH="$PWD:$PATH"\nAPP_ID=${APP_ID}\n${fn('fail')}\n${fn('assert_signature')}\n${fn('assert_app')}\nassert_app "$PWD/probe.app" http://localhost:4100`,
    ],
    { cwd: scene, env, encoding: 'utf8', timeout: BASH_TIMEOUT_MS },
  )
}

describe('Simulator 앱의 호스트 서명과 simulated entitlement 경계', () => {
  it('호스트 제한 권한 없이 내장된 simulator 앱 식별자로 통과한다', () => {
    const result = run()
    expect(result.status, result.stderr).toBe(0)
  })
  it('그룹을 명시했다면 simulator 앱 식별자와 같아야 한다', () => {
    const result = run({
      simulated: {
        'application-identifier': APP_ID,
        'keychain-access-groups': [APP_ID],
      },
    })
    expect(result.status, result.stderr).toBe(0)
  })
  it.each(['application-identifier', 'keychain-access-groups'])(
    'R18의 호스트 서명에 실린 제한 권한 %s를 거절한다',
    (key) => {
      expect(run({ host: { [key]: APP_ID } }).status).toBe(1)
    },
  )
  it('R18의 두 제한 권한이 정확한 값이어도 호스트 서명에서는 거절한다', () => {
    expect(
      run({
        host: {
          'application-identifier': APP_ID,
          'keychain-access-groups': [APP_ID],
        },
      }).status,
    ).toBe(1)
  })
  it.each(['__entitlements', '__ents_der'])('내장 %s가 없으면 거절한다', (missingSection) => {
    expect(run({ missingSection }).status).toBe(1)
  })
  it('내장 plist가 다른 앱을 가리키면 거절한다', () => {
    expect(
      run({ simulated: { 'application-identifier': '34R3YQTSH8.com.other.app' } }).status,
    ).toBe(1)
  })
  it('명시한 Keychain 그룹이 다른 앱을 허용하면 거절한다', () => {
    expect(
      run({
        simulated: {
          'application-identifier': APP_ID,
          'keychain-access-groups': [APP_ID, 'com.other.app'],
        },
      }).status,
    ).toBe(1)
  })
  it('내장 section이 파일 밖이면 거절한다', () => {
    expect(run({ truncated: true }).status).toBe(1)
  })
  it('서명 자체의 무결성 실패를 전파한다', () => {
    expect(run({ verify: '17' }).status).toBe(1)
  })
})
