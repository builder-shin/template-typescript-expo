import { spawnSync } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BASH_TIMEOUT_MS, resolveBash } from '../support/bash'

const WORK = mkdtempSync(join(tmpdir(), 'ci-speed-'))
const ANDROID = readFileSync(resolve('test/e2e/android.sh'), 'utf8')
const RUN_ANDROID = readFileSync(resolve('test/e2e/run-android.sh'), 'utf8')
const JVM = '-Dorg.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m'
let bash: string
beforeAll(() => {
  bash = resolveBash()
})
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

function shell(directory: string, source: string, env: Partial<NodeJS.ProcessEnv> = {}) {
  const environment: NodeJS.ProcessEnv = { ...process.env, ...env }
  delete environment.BASH_ENV
  return spawnSync(bash, ['-c', `set -euo pipefail\nexport PATH="$PWD:$PATH"\n${source}`], {
    cwd: directory,
    env: environment,
    encoding: 'utf8',
    timeout: BASH_TIMEOUT_MS,
  })
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

describe('CI APK의 설치 전 ABI 가드', () => {
  it('다른 ABI·여러 ABI·네이티브 라이브러리가 없는 APK는 exit 1이다', () => {
    for (const listing of [
      'lib/arm64-v8a/libapp.so',
      'lib/x86_64/libapp.so\nlib/arm64-v8a/libapp.so',
      'assets/app.config',
    ]) {
      const directory = scene()
      executable(directory, 'unzip', 'printf "%s\\n" "$FAKE_APK_LIST"')
      const result = shell(
        directory,
        `${block(ANDROID, 'assert_apk_abis')}\nassert_apk_abis input.apk`,
        {
          E2E_ANDROID_ABIS: 'x86_64',
          FAKE_APK_LIST: listing,
        },
      )
      expect(result.status).toBe(1)
      expect(result.stderr).toContain('APK 의 lib ABI 집합이 x86_64 가 아니다')
    }
  })
  it('받은 APK도 검사하고 다른 ABI면 adb install 전에 실패한다', () => {
    for (const abi of ['arm64-v8a', 'x86_64']) {
      const directory = scene()
      mkdirSync(join(directory, 'test/e2e'), { recursive: true })
      writeFileSync(join(directory, 'input.apk'), 'fixture')
      executable(directory, 'unzip', 'printf "lib/%s/libapp.so\\n" "$FAKE_APK_ABI"')
      executable(directory, 'adb', 'echo install > installed')
      executable(
        join(directory, 'test/e2e'),
        'android.sh',
        `${block(ANDROID, 'assert_apk_abis')}\n[ "$1" = assert-apk-abis ] || exit 99\nassert_apk_abis "$2"`,
      )
      const result = shell(
        directory,
        `ADB="$PWD/adb"\nE2E_APK="$PWD/input.apk"\n${block(RUN_ANDROID, 'fail')}\n${block(RUN_ANDROID, 'build_and_install')}\nbuild_and_install`,
        {
          E2E_ANDROID_ABIS: 'x86_64',
          FAKE_APK_ABI: abi,
        },
      )
      expect(result.status, result.stderr).toBe(abi === 'x86_64' ? 0 : 1)
      expect(shell(directory, '[ -f installed ]').status).toBe(abi === 'x86_64' ? 0 : 1)
    }
  })
  it('x86_64 이외의 emulator는 앱 설치 전에 실패한다', () => {
    const execution = /^test\/e2e\/android\.sh boot\n[\s\S]*?^build_and_install$/m.exec(
      RUN_ANDROID,
    )?.[0]
    expect(execution).toBeDefined()
    for (const abi of ['arm64-v8a', 'x86_64']) {
      const directory = scene()
      mkdirSync(join(directory, 'test/e2e'), { recursive: true })
      executable(join(directory, 'test/e2e'), 'android.sh', '[ "$1" = boot ]')
      executable(directory, 'adb', 'printf "%s\\r\\n" "$FAKE_DEVICE_ABI"')
      const result = shell(
        directory,
        `ADB="$PWD/adb"\n${block(RUN_ANDROID, 'fail')}\nbuild_and_install() { echo install > installed; }\n${execution}`,
        {
          E2E_ANDROID_ABIS: 'x86_64',
          FAKE_DEVICE_ABI: abi,
        },
      )
      expect(result.status, result.stderr).toBe(abi === 'x86_64' ? 0 : 1)
      expect(shell(directory, '[ -f installed ]').status).toBe(abi === 'x86_64' ? 0 : 1)
      expect(result.stdout).toContain(`에뮬레이터 ro.product.cpu.abi=${abi}`)
    }
  })
})

describe('CI의 검증된 main 생략 배선', () => {
  const workflow = readFileSync(resolve('.github/workflows/ci.yml'), 'utf8')

  function job(name: string) {
    const found = new RegExp(`^  ${name}:\\n[\\s\\S]*?(?=^  [\\w-]+:|$(?![\\s\\S]))`, 'm').exec(
      workflow,
    )?.[0]
    if (found === undefined) throw new Error(`${name} 잡이 없다`)
    return found
  }

  it('첫 잡이 full-history checkout과 읽기 권한만으로 검증 스크립트를 돈다', () => {
    expect(workflow.match(/^  [\w-]+:/gm)?.slice(-6)).toEqual([
      '  verified:',
      '  checks:',
      '  build-android:',
      '  e2e-android:',
      '  build-ios:',
      '  e2e-ios:',
    ])
    const verified = job('verified')
    expect(verified).toContain('runs-on: ubuntu-24.04')
    expect(verified).toContain('timeout-minutes: 5')
    expect(verified).toContain('actions: read')
    expect(verified).toContain('contents: read')
    expect(verified).toContain('fetch-depth: 0')
    expect(verified).toContain('skip: ${{ steps.verified.outputs.skip }}')
    expect(verified).toContain('id: verified')
    expect(verified).toContain('GH_TOKEN: ${{ github.token }}')
    expect(verified).toContain('run: ./scripts/ci-verified-main.sh')
    expect(verified).not.toMatch(/^    (if|needs):/m)
    expect(verified).not.toContain('pnpm')
  })

  it.each(['checks', 'build-android', 'build-ios'])('%s는 생략 판단만 기다린다', (name) => {
    const source = job(name)
    expect(source).toContain('needs: verified')
    expect(source).toContain("if: needs.verified.outputs.skip != 'true'")
    expect(source).not.toMatch(/^    permissions:/m)
  })

  it.each(['android', 'ios'])('%s E2E는 기존 build 의존과 세 backend를 유지한다', (platform) => {
    const source = job(`e2e-${platform}`)
    expect(source).toContain(`needs: build-${platform}`)
    expect(source).toContain('backend: [fastapi, nestjs, rails]')
    expect(source).toContain('fail-fast: false')
    expect(source).not.toMatch(/^    if:/m)
  })
})
