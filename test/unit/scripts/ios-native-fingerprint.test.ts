import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { nativeCacheFingerprint } from '../../../scripts/ios-native-fingerprint.mjs'

mkdirSync('.maestro-output', { recursive: true })
const ROOT = mkdtempSync(resolve('.maestro-output/fingerprint-test-'))
// Vitest의 resolver와 실제 CI Node loader를 각각 검증한다.
beforeAll(() => {
  const runtime = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '--eval',
      "await import('./scripts/ios-native-fingerprint.mjs'); process.stdout.write('ok')",
    ],
    { encoding: 'utf8', timeout: 30_000 },
  )
  expect(runtime.status, runtime.stderr).toBe(0)
  expect(runtime.stdout).toBe('ok')
})
afterAll(() => rmSync(ROOT, { recursive: true, force: true }))
let sequence = 0
const TOOLCHAIN: Record<string, string> = {
  xcodebuild: 'Xcode 26.6\nBuild version 17G100',
  xcrun: '26.6',
  uname: 'arm64',
  ccache: 'ccache version 4.13.5',
}
function fixture() {
  const root = join(ROOT, String(++sequence))
  mkdirSync(root)
  const git = spawnSync('git', ['init', '-q'], { cwd: root, encoding: 'utf8', timeout: 30_000 })
  if (git.status !== 0) throw new Error(git.stderr)
  mkdirSync(join(root, 'scripts'), { recursive: true })
  mkdirSync(join(root, 'test/e2e'), { recursive: true })
  mkdirSync(join(root, 'app'), { recursive: true })
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({
      name: 'native-cache-fixture',
      version: '1.0.0',
      dependencies: { expo: '~57.0.26', 'expo-build-properties': '~57.0.22' },
    }),
  )
  writeFileSync(join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 9.0\n')
  writeFileSync(
    join(root, 'app.config.ts'),
    `export default { name: 'Cache fixture', slug: 'cache-fixture', ios: { bundleIdentifier: 'com.example.cache' }, plugins: [['expo-build-properties', { ios: { enableSceneSupport: true, ccacheEnabled: true } }]], extra: { backendUrl: process.env.BACKEND_URL } }`,
  )
  writeFileSync(join(root, 'app/index.tsx'), 'export default function Screen() { return null }')
  writeFileSync(join(root, 'README.md'), '설명')
  writeFileSync(join(root, 'test/e2e/ios.sh'), 'build recipe')
  writeFileSync(join(root, 'scripts/ios-native-fingerprint.mjs'), 'fingerprint recipe')
  return root
}
// Expo의 입력은 실제 사본으로 전달하고 비싼 upstream fingerprint 계산만 통제한다.
// 공개 API의 실제 계산은 별도 probe와 CI 단계에서 실행한다.
function fingerprint(
  root: string,
  tools = TOOLCHAIN,
  hash = '1111111111111111111111111111111111111111',
) {
  return nativeCacheFingerprint(root, {
    createFingerprint: (source, options) => {
      expect(options).toEqual({ platforms: ['ios'], silent: true })
      expect(source).not.toBe(root)
      for (const file of [
        'package.json',
        'app.config.ts',
        'app/index.tsx',
        'README.md',
        'pnpm-lock.yaml',
        'test/e2e/ios.sh',
        'scripts/ios-native-fingerprint.mjs',
      ]) {
        expect(readFileSync(join(source, file), 'utf8')).toBe(
          readFileSync(join(root, file), 'utf8'),
        )
      }
      expect(existsSync(join(source, 'ios'))).toBe(false)
      expect(existsSync(join(source, 'android'))).toBe(false)
      expect(existsSync(join(source, '.maestro-output'))).toBe(false)
      expect(process.env.APP_VARIANT).toBe('e2e')
      expect(process.env.BACKEND_URL).toBe('http://localhost:4100')
      expect(process.env.E2E_IOS_CCACHE).toBe('1')
      expect(process.env.EAS_PROJECT_ID).toBe('')
      expect(process.env.EAS_BUILD_PROJECT_ID).toBe('')
      return Promise.resolve({
        hash,
        sources: [
          {
            type: 'contents' as const,
            id: 'expoConfig',
            contents: 'upstream native input',
            hash,
            reasons: ['expoConfig'],
          },
        ],
      })
    },
    command: (name: string) => {
      const value = tools[name]
      if (value === undefined) throw new Error(`예상하지 않은 도구: ${name}`)
      return value
    },
  })
}
function replace(root: string, from: string, to: string) {
  const file = join(root, 'app.config.ts')
  writeFileSync(file, readFileSync(file, 'utf8').replace(from, to))
}
async function changed(change: (root: string) => void) {
  const root = fixture()
  const before = await fingerprint(root)
  change(root)
  const after = await fingerprint(root, TOOLCHAIN, '2222222222222222222222222222222222222222')
  expect(after.cacheKey).not.toBe(before.cacheKey)
  return { root, before, after }
}

describe('Expo fingerprint 입력·iOS 네이티브 캐시 키', () => {
  it('같은 입력은 같은 키이며 생성 native 디렉터리와 출력은 사본에 들어가지 않는다', async () => {
    const root = fixture()
    const before = await fingerprint(root)
    mkdirSync(join(root, 'ios'), { recursive: true })
    writeFileSync(join(root, 'ios/stale.pbxproj'), 'stale native input')
    expect(await fingerprint(root)).toEqual(before)
  })
  it('JS 화면 변경은 nativeHash와 캐시 키를 유지한다', async () => {
    const root = fixture()
    const before = await fingerprint(root)
    writeFileSync(
      join(root, 'app/index.tsx'),
      'export default function CurrentScreen() { return "current" }',
    )
    expect(await fingerprint(root)).toEqual(before)
  })
  it('README 변경은 nativeHash와 캐시 키를 유지한다', async () => {
    const root = fixture()
    const before = await fingerprint(root)
    writeFileSync(join(root, 'README.md'), '새 문서')
    expect(await fingerprint(root)).toEqual(before)
  })
  it('의존성과 락파일 변경은 키를 바꾼다', async () => {
    const root = fixture()
    const before = await fingerprint(root)
    writeFileSync(join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 9.0\nchanged: true\n')
    expect((await fingerprint(root)).cacheKey).not.toBe(before.cacheKey)
    const packageFile = join(root, 'package.json')
    const pkg = JSON.parse(readFileSync(packageFile, 'utf8')) as {
      dependencies: Record<string, string>
    }
    pkg.dependencies['expo-secure-store'] = '~57.0.4'
    writeFileSync(packageFile, JSON.stringify(pkg))
    expect(
      (await fingerprint(root, TOOLCHAIN, '2222222222222222222222222222222222222222')).nativeHash,
    ).not.toBe(before.nativeHash)
  })
  it('플러그인 변경은 nativeHash를 바꾼다', async () => {
    const result = await changed((root) =>
      replace(root, 'plugins: [', "plugins: ['expo-secure-store', "),
    )
    expect(result.after.nativeHash).not.toBe(result.before.nativeHash)
  })
  it('scene opt-in 변경은 nativeHash를 바꾼다', async () => {
    const result = await changed((root) =>
      replace(root, 'enableSceneSupport: true', 'enableSceneSupport: false'),
    )
    expect(result.after.nativeHash).not.toBe(result.before.nativeHash)
  })
  it('앱 식별자 변경은 nativeHash를 바꾼다', async () => {
    const result = await changed((root) =>
      replace(root, 'com.example.cache', 'com.example.changed'),
    )
    expect(result.after.nativeHash).not.toBe(result.before.nativeHash)
  })
  it('BACKEND_URL 변경은 키를 바꾼다', async () => {
    const result = await changed((root) =>
      replace(root, 'process.env.BACKEND_URL', "'http://localhost:4200'"),
    )
    expect(result.after.nativeHash).not.toBe(result.before.nativeHash)
  })
  it('Xcode와 SDK 변경은 같은 nativeHash여도 키를 바꾼다', async () => {
    const root = fixture()
    const before = await fingerprint(root)
    for (const tool of ['xcodebuild', 'xcrun']) {
      const after = await fingerprint(root, { ...TOOLCHAIN, [tool]: 'changed toolchain' })
      expect(after.nativeHash).toBe(before.nativeHash)
      expect(after.cacheKey).not.toBe(before.cacheKey)
    }
  })
  it('architecture 변경은 키를 바꾼다', async () => {
    const root = fixture()
    expect((await fingerprint(root, { ...TOOLCHAIN, uname: 'x86_64' })).cacheKey).not.toBe(
      (await fingerprint(root)).cacheKey,
    )
  })
  it('iOS 빌드와 fingerprint 레시피 변경은 키를 바꾼다', async () => {
    const root = fixture()
    const before = await fingerprint(root)
    for (const file of ['test/e2e/ios.sh', 'scripts/ios-native-fingerprint.mjs']) {
      writeFileSync(join(root, file), 'changed recipe')
      expect((await fingerprint(root)).cacheKey).not.toBe(before.cacheKey)
    }
  })
  it('ccache 판 변경은 키를 바꾸고 원천 목록을 기록한다', async () => {
    const root = fixture()
    const before = await fingerprint(root)
    expect(
      (await fingerprint(root, { ...TOOLCHAIN, ccache: 'ccache version changed' })).cacheKey,
    ).not.toBe(before.cacheKey)
    const manifest = JSON.parse(
      readFileSync(join(root, '.maestro-output/ios-native-fingerprint.json'), 'utf8'),
    ) as { sources: unknown[]; nativeHash: string }
    expect(manifest.sources.length).toBeGreaterThan(0)
    expect(manifest.nativeHash).toBe(before.nativeHash)
  })
})
