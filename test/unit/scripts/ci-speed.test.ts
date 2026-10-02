import { spawnSync } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { BASH_TIMEOUT_MS, resolveBash } from '../support/bash'

const WORK = mkdtempSync(join(tmpdir(), 'ci-speed-'))
const ANDROID = readFileSync(resolve('test/e2e/android.sh'), 'utf8')
const RUN_ANDROID = readFileSync(resolve('test/e2e/run-android.sh'), 'utf8')
const JVM = '-Dorg.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m'
afterAll(() => rmSync(WORK, { recursive: true, force: true }))
let sequence = 0

function block(source: string, name: string) {
  const found = new RegExp(`^${name}\\(\\) \\{$[\\s\\S]*?^\\}`, 'm').exec(source)?.[0]
  if (found === undefined) throw new Error(`${name} 함수가 없다`)
  return found
}

function scene() {
  const directory = join(WORK, String(++sequence))
  mkdirSync(directory)
  return directory
}

function executable(directory: string, name: string, body: string) {
  const file = join(directory, name)
  writeFileSync(file, `#!/bin/sh\n${body}\n`)
  chmodSync(file, 0o755)
}

function shell(directory: string, source: string, env: NodeJS.ProcessEnv = {}) {
  const environment: NodeJS.ProcessEnv = { ...process.env, ...env }
  delete environment.BASH_ENV
  return spawnSync(
    resolveBash(),
    ['-c', `set -euo pipefail\nexport PATH="$PWD:$PATH"\n${source}`],
    {
      cwd: directory,
      env: environment,
      encoding: 'utf8',
      timeout: BASH_TIMEOUT_MS,
    },
  )
}

function androidBuild(
  abis?: string,
  output = '> Task :app:createReleaseUpdatesResources UP-TO-DATE',
  exit = 0,
) {
  const directory = scene()
  mkdirSync(join(directory, 'android'))
  executable(directory, 'pnpm', 'echo prebuild >> calls.log')
  executable(
    join(directory, 'android'),
    'gradlew',
    'printf "%s\\n" "$*" >> ../calls.log\ncase "$1" in assembleRelease) echo "$FAKE_OUTPUT"; exit "$FAKE_EXIT" ;; esac',
  )
  const result = shell(
    directory,
    `APK=calls.log
check_path() { :; }
clear_metro_cache() { echo clear >> calls.log; }
assert_apk_variant() { :; }
assert_apk_ota_off() { :; }
assert_apk_abis() { :; }
${block(ANDROID, 'assemble_release')}
${block(ANDROID, 'build')}
build`,
    {
      BACKEND_URL: 'http://10.0.2.2:4100',
      E2E_ANDROID_ABIS: abis ?? '',
      FAKE_OUTPUT: output,
      FAKE_EXIT: String(exit),
    },
  )
  const calls =
    result.status === 0 ? readFileSync(join(directory, 'calls.log'), 'utf8').trim().split('\n') : []
  return { result, calls, directory }
}

function androidFingerprint(abis: string) {
  const directory = scene()
  mkdirSync(join(directory, 'test/e2e'), { recursive: true })
  writeFileSync(join(directory, 'test/e2e/android.sh'), 'recipe')
  writeFileSync(join(directory, 'app.ts'), 'app')
  const result = shell(
    directory,
    `git init -q
APP_BACKEND_URL=http://10.0.2.2:4100
${block(RUN_ANDROID, 'existing_files')}
${block(RUN_ANDROID, 'build_fingerprint')}
build_fingerprint`,
    { E2E_ANDROID_ABIS: abis, GIT_TERMINAL_PROMPT: '0', GIT_PAGER: 'cat' },
  )
  expect(result.status, result.stderr).toBe(0)
  return result.stdout.trim()
}

describe('CI Android ABI와 두 단계 Gradle', () => {
  it('미지정은 양 호출에 네 ABI를 주고 같은 선택의 APK 지문이 재현된다', () => {
    const { result, calls } = androidBuild()
    expect(result.status, result.stderr).toBe(0)
    expect(calls).toEqual([
      'prebuild',
      'clear',
      `:app:createReleaseUpdatesResources --no-daemon ${JVM} -PreactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64`,
      'clear',
      `assembleRelease --no-daemon --console=plain ${JVM} -PreactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64`,
    ])
    expect(androidFingerprint('')).toBe(androidFingerprint(''))
  })
  it('x86_64를 양 호출에 주고 ABI 변경은 APK 재사용 지문을 바꾼다', () => {
    const { result, calls } = androidBuild('x86_64')
    expect(result.status, result.stderr).toBe(0)
    expect(calls.filter((call) => call.includes('--no-daemon'))).toEqual([
      `:app:createReleaseUpdatesResources --no-daemon ${JVM} -PreactNativeArchitectures=x86_64`,
      `assembleRelease --no-daemon --console=plain ${JVM} -PreactNativeArchitectures=x86_64`,
    ])
    expect(androidFingerprint('x86_64')).toBe(androidFingerprint('x86_64'))
    expect(androidFingerprint('x86_64')).not.toBe(androidFingerprint(''))
  })
  it('알 수 없는 ABI는 prebuild 전에 실패한다', () => {
    const { result, directory } = androidBuild('arm64-v8a')
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('E2E_ANDROID_ABIS')
    expect(shell(directory, '[ ! -f calls.log ]').status).toBe(0)
  })
  it('둘째 호출의 누락·실행·FROM-CACHE와 Gradle 실패는 계속 실패한다', () => {
    for (const output of [
      'BUILD SUCCESSFUL',
      '> Task :app:createReleaseUpdatesResources',
      '> Task :app:createReleaseUpdatesResources FROM-CACHE',
    ]) {
      expect(androidBuild('x86_64', output).result.status).toBe(1)
    }
    expect(
      androidBuild('x86_64', '> Task :app:createReleaseUpdatesResources UP-TO-DATE', 17).result
        .status,
    ).toBe(17)
  })
})
