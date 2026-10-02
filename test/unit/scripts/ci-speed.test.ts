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
const CI = readFileSync(resolve('.github/workflows/ci.yml'), 'utf8')
const IOS = readFileSync(resolve('test/e2e/ios.sh'), 'utf8')
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

function iosBuild(override: boolean, hit: boolean, xcodeExit = 0) {
  const directory = scene()
  const derived = override ? join(directory, 'derived').split('\\').join('/') : 'ios/build'
  const products = join(
    directory,
    override ? 'derived' : 'ios/build',
    'Build/Products/Release-iphonesimulator',
  )
  mkdirSync(join(products, 'Probe.app'), { recursive: true })
  writeFileSync(join(products, 'Probe.app/stale'), 'old app')
  mkdirSync(join(directory, 'ios/Probe.xcworkspace'), { recursive: true })
  if (hit) {
    mkdirSync(join(directory, 'derived/ModuleCache.noindex'), { recursive: true })
    writeFileSync(join(directory, 'derived/ModuleCache.noindex/object'), 'cached library')
  }
  writeFileSync(join(directory, 'current-js'), 'current JS')
  executable(
    directory,
    'pnpm',
    'echo prebuild >> calls.log\nrm -rf ios\nmkdir -p ios/Probe.xcworkspace',
  )
  executable(directory, 'uname', 'echo arm64')
  executable(
    directory,
    'plutil',
    'case "$2" in EXUpdatesEnabled) echo false ;; NSAppTransportSecurity.NSAllowsLocalNetworking) echo true ;; CFBundleIdentifier) echo com.example.templateexpo.e2e ;; *) exit 99 ;; esac',
  )
  executable(directory, 'codesign', 'echo signature >> calls.log')
  executable(
    directory,
    'xcodebuild',
    `echo xcodebuild >> calls.log
dd=''
while [ "$#" -gt 0 ]; do if [ "$1" = -derivedDataPath ]; then shift; dd=$1; fi; shift; done
[ ! -f "$dd/Build/Products/Release-iphonesimulator/Probe.app/stale" ] || exit 91
echo 'PhaseScriptExecution Bundle\\ React\\ Native\\ code\\ and\\ images'
[ "$FAKE_XCODE_EXIT" = 0 ] || exit "$FAKE_XCODE_EXIT"
app="$dd/Build/Products/Release-iphonesimulator/Probe.app"
mkdir -p "$app/EXConstants.bundle"
printf '%s' '{"extra":{"appVariant":"e2e","backendUrl":"http://localhost:4100"},"updates":{"enabled":false}}' > "$app/EXConstants.bundle/app.config"
cp current-js "$app/main.jsbundle"
touch "$app/Expo.plist" "$app/Info.plist"`,
  )
  const constants =
    IOS.match(/^readonly (?:DERIVED_DATA|PRODUCTS|BUILD_LOG|APP_ID)=.*$/gm)?.join('\n') ?? ''
  const result = shell(
    directory,
    `${constants}
${block(IOS, 'fail')}
${block(IOS, 'app_path')}
${block(IOS, 'assert_app')}
assert_signature() { codesign --verify --strict --deep "$1"; }
${block(IOS, 'build')}
build`,
    {
      BACKEND_URL: 'http://localhost:4100',
      E2E_IOS_DERIVED_DATA: override ? derived : '',
      FAKE_XCODE_EXIT: String(xcodeExit),
      E2E_IOS_CCACHE: '',
    },
  )
  return { result, directory, products, derived }
}

describe('iOS native cache가 현재 앱 빌드를 건너뛰지 않는다', () => {
  it('기본 DerivedData는 ios/build이고 CI override만 저장소 밖을 쓴다', () => {
    for (const override of [false, true]) {
      const { result, derived } = iosBuild(override, false)
      expect(result.status, result.stderr).toBe(0)
      expect(result.stdout.trim()).toBe(
        `${derived}/Build/Products/Release-iphonesimulator/Probe.app`,
      )
    }
  })
  it('prebuild clean은 CI DerivedData의 라이브러리 객체를 보존한다', () => {
    const { result, directory } = iosBuild(true, true)
    expect(result.status, result.stderr).toBe(0)
    expect(readFileSync(join(directory, 'derived/ModuleCache.noindex/object'), 'utf8')).toBe(
      'cached library',
    )
  })
  it('cache miss와 hit 모두 prebuild·Xcode·현재 JS bundle·assert-app을 실행한다', () => {
    for (const hit of [false, true]) {
      const { result, directory, products } = iosBuild(true, hit)
      expect(result.status, result.stderr).toBe(0)
      expect(readFileSync(join(directory, 'calls.log'), 'utf8').trim().split('\n')).toEqual([
        'prebuild',
        'xcodebuild',
        'signature',
      ])
      expect(readFileSync(join(products, 'Probe.app/main.jsbundle'), 'utf8')).toBe('current JS')
      expect(result.stderr).toContain('extra.appVariant=e2e backendUrl=http://localhost:4100')
    }
  })
  it('다른 native/toolchain cache는 복원하지 않고 성공 빌드 뒤만 저장한다', () => {
    const build = CI.split('\n  build-ios:\n')[1]?.split('\n  e2e-ios:\n')[0] ?? ''
    const restore =
      /uses: actions\/cache\/restore@v6\n([\s\S]*?)(?=\n      - name:)/.exec(build)?.[1] ?? ''
    expect(restore).toContain(
      'key: ios-native-v1-${{ steps.native-key.outputs.cacheKey }}-${{ github.sha }}',
    )
    expect(restore).toContain(
      'restore-keys: ios-native-v1-${{ steps.native-key.outputs.cacheKey }}-',
    )
    expect(restore.match(/restore-keys:/g)?.length).toBe(1)
    expect(build).toContain("if: success() && steps.native-cache.outputs.cache-hit != 'true'")
    expect(build.indexOf('uses: actions/cache/save@v6')).toBeGreaterThan(
      build.indexOf('run: test/e2e/ios.sh build'),
    )
    expect(iosBuild(true, true, 17).result.status).not.toBe(0)
  })
})

const IOS_JOB = CI.split('\n  e2e-ios:\n')[1] ?? ''
function iosStep() {
  const step = /      - name: E2E\n[\s\S]*?        run: \|\n([\s\S]*?)(?=\n      - name:)/.exec(
    IOS_JOB,
  )?.[1]
  if (step === undefined) throw new Error('iOS E2E 단계가 없다')
  return step.replace(/^          /gm, '').replaceAll('${{ matrix.shard }}', '1')
}
function iosHarnessStep(output: string, nodeExit = 0, harnessExit = 0) {
  const directory = scene()
  mkdirSync(join(directory, 'test/e2e'), { recursive: true })
  mkdirSync(join(directory, 'app/Probe.app'), { recursive: true })
  executable(
    directory,
    'node',
    'case "$*" in *--manifest*) echo "{}" ;; *) echo "$FAKE_FLOWS" ;; esac\nexit "$FAKE_NODE_EXIT"',
  )
  executable(
    join(directory, 'test/e2e'),
    'run-ios.sh',
    'printf "%s\\n" "$E2E_FLOW" > invoked\nexit "$FAKE_HARNESS_EXIT"',
  )
  return {
    directory,
    result: shell(directory, iosStep(), {
      RUNNER_TEMP: directory.split('\\').join('/'),
      FAKE_FLOWS: output,
      FAKE_NODE_EXIT: String(nodeExit),
      FAKE_HARNESS_EXIT: String(harnessExit),
    }),
  }
}

describe('CI iOS shard 배선', () => {
  it('백엔드×shard 여섯 행을 긴 셋 우선으로 만들고 동시 실행은 다섯이다', () => {
    const rows = [...IOS_JOB.matchAll(/- backend: (fastapi|nestjs|rails)\n\s+shard: (\d+)/g)].map(
      (match) => [match[1], Number(match[2])],
    )
    expect(rows).toEqual([
      ['fastapi', 1],
      ['nestjs', 1],
      ['rails', 1],
      ['fastapi', 2],
      ['nestjs', 2],
      ['rails', 2],
    ])
    expect(IOS_JOB).toContain('max-parallel: 5')
    expect(CI.split('\n  e2e-android:\n')[1]?.split('\n  build-ios:\n')[0]).toContain(
      'backend: [fastapi, nestjs, rails]',
    )
  })
  it('iOS request-stall는 fastapi shard 1에서만 돈다', () => {
    const condition = /E2E_CHECKS: \$\{\{ (.*?) \}\}/.exec(IOS_JOB)?.[1]
    expect(condition).toBe("matrix.backend == 'fastapi' && matrix.shard == 1 && '1' || ''")
  })
  it('목록 계산 실패·빈 출력은 하네스를 부르지 않는다', () => {
    for (const [output, exit] of [
      ['cold-links', 17],
      ['', 0],
    ] as const) {
      const { result, directory } = iosHarnessStep(output, exit)
      expect(result.status).not.toBe(0)
      expect(shell(directory, '[ ! -f invoked ]').status).toBe(0)
    }
  })
  it('아티팩트 여섯 이름은 구별되며 정리 실패가 잡 실패로 전파된다', () => {
    const template = /name: (e2e-ios-\$\{\{ matrix.backend \}\}[^\n]*)/.exec(IOS_JOB)?.[1]
    expect(template).toBe('e2e-ios-${{ matrix.backend }}-shard-${{ matrix.shard }}')
    const names = ['fastapi', 'nestjs', 'rails'].flatMap((backend) =>
      [1, 2].map((shard) =>
        template
          ?.replace('${{ matrix.backend }}', backend)
          .replace('${{ matrix.shard }}', String(shard)),
      ),
    )
    expect(new Set(names).size).toBe(6)
    const { result, directory } = iosHarnessStep('cold-links auth-links', 0, 23)
    expect(result.status).toBe(23)
    expect(readFileSync(join(directory, 'invoked'), 'utf8').trim()).toBe('cold-links auth-links')
  })
})
