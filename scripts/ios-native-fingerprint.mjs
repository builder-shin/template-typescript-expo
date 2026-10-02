import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
// Node ESM은 Expo 공개 shim의 파일 확장자가 필요하다.
import { createFingerprintAsync } from 'expo/fingerprint.js'

const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const command = (name, args) =>
  execFileSync(name, args, { encoding: 'utf8', timeout: 30_000 }).trim()

/**
 * 설치본만 참조하는 CNG 사본에서 Expo의 공개 fingerprint를 잰다. JS·문서 무시 목록을 별도로 만들지 않는다.
 * @param {string} root
 * @param {{ command?: (name: string, args: string[]) => string, createFingerprint?: typeof createFingerprintAsync }} [dependencies]
 * @returns {Promise<{ nativeHash: string, cacheKey: string }>}
 */
export async function nativeCacheFingerprint(root, dependencies = {}) {
  root = resolve(root)
  const output = join(root, '.maestro-output')
  await mkdir(output, { recursive: true })
  const sourceRoot = await mkdtemp(join(output, 'ios-native-src-'))
  const environment = {
    APP_VARIANT: 'e2e',
    BACKEND_URL: 'http://localhost:4100',
    EAS_PROJECT_ID: '',
    EAS_BUILD_PROJECT_ID: '',
    E2E_IOS_CCACHE: '1',
  }
  const previous = Object.fromEntries(
    Object.keys(environment).map((key) => [key, process.env[key]]),
  )
  try {
    const files = execFileSync(
      'git',
      [
        'ls-files',
        '-z',
        '-co',
        '--exclude-standard',
        '--',
        '.',
        ':!android',
        ':!ios',
        ':!.maestro-output',
        ':!DerivedData',
        ':!ccache',
      ],
      { cwd: root, encoding: 'utf8', timeout: 30_000 },
    )
      .split('\0')
      .filter(Boolean)
    for (const file of files) {
      const target = join(sourceRoot, file)
      await mkdir(dirname(target), { recursive: true })
      try {
        await copyFile(join(root, file), target)
      } catch (error) {
        if (error.code !== 'ENOENT') throw error
      }
    }
    Object.assign(process.env, environment)
    const createFingerprint = dependencies.createFingerprint ?? createFingerprintAsync
    const fingerprint = await createFingerprint(sourceRoot, {
      platforms: ['ios'],
      silent: true,
    })
    const run = dependencies.command ?? command
    const inputs = {
      nativeHash: fingerprint.hash,
      lockHash: sha256(await readFile(join(root, 'pnpm-lock.yaml'))),
      iosRecipeHash: sha256(await readFile(join(root, 'test/e2e/ios.sh'))),
      fingerprintRecipeHash: sha256(
        await readFile(join(root, 'scripts/ios-native-fingerprint.mjs')),
      ),
      xcode: run('xcodebuild', ['-version']),
      sdk: run('xcrun', ['--sdk', 'iphonesimulator', '--show-sdk-version']),
      architecture: run('uname', ['-m']),
      ccache: run('ccache', ['--version']),
      configuration: 'Release',
      variant: environment.APP_VARIANT,
      backendUrl: environment.BACKEND_URL,
      ccacheEnabled: true,
      ccacheConfig: 'default-safe',
    }
    const result = { nativeHash: fingerprint.hash, cacheKey: sha256(JSON.stringify(inputs)) }
    await writeFile(
      join(output, 'ios-native-fingerprint.json'),
      JSON.stringify({ ...result, inputs, sources: fingerprint.sources }, null, 2) + '\n',
    )
    return result
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    // mkdtemp가 이 출력 디렉터리 안에 만든 사본만 지운다.
    if (dirname(sourceRoot) !== output)
      throw new Error('fingerprint 사본 경로가 출력 디렉터리를 벗어났다')
    await rm(sourceRoot, { recursive: true, force: true })
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await nativeCacheFingerprint(resolve('.'))
    for (const [key, value] of Object.entries(result)) console.log(`${key}=${value}`)
  } catch (error) {
    console.error(error)
    process.exitCode = 1
  }
}
