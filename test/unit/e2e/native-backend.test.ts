import { spawnSync } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BASH_TIMEOUT_MS, resolveBash } from '../support/bash'

/**
 * 네이티브 백엔드(test/e2e/native-backend.sh - iOS 매트릭스가 Docker 없이 쓴다)가 compose 스택과 같은 백엔드를
 * 받는가. 두 길이 다른 저장소를 받으면 Android 와 iOS 매트릭스가 다른 백엔드를 재고도 같은 이름으로 초록이 된다.
 * 스크립트의 나머지(Homebrew·PostgreSQL·런타임)는 macOS 에서만 돌아 CI 의 e2e-ios 잡이 잰다.
 */

const SCRIPT = resolve('test/e2e/native-backend.sh')
const COMPOSE = readFileSync(resolve('docker-compose.e2e.yml'), 'utf8')
const BACKENDS = ['fastapi', 'nestjs', 'rails'] as const

/** Git Bash 는 역슬래시 경로를 이스케이프로 먹어 치운다. */
function toPosix(path: string): string {
  return path.split('\\').join('/')
}

const bash = resolveBash()

function run(kind: string, ...args: string[]) {
  return spawnSync(bash, [toPosix(SCRIPT), ...args], {
    encoding: 'utf8',
    env: { ...process.env, BACKEND_KIND: kind },
    timeout: BASH_TIMEOUT_MS,
  })
}

describe('test/e2e/native-backend.sh', () => {
  it.each(BACKENDS)('%s 는 docker-compose.e2e.yml 이 빌드하는 저장소의 main 을 받는다', (kind) => {
    const result = run(kind, 'repo-url')
    expect(result.status, result.stderr).toBe(0)
    const url = result.stdout.trim()
    expect(url).toMatch(/^https:\/\/github\.com\/builder-shin\/template-[a-z-]+\.git$/)
    expect(COMPOSE).toContain(`${url}#main`)
  })

  it('세 백엔드의 저장소가 서로 다르다', () => {
    const urls = BACKENDS.map((kind) => run(kind, 'repo-url').stdout.trim())
    expect(new Set(urls).size).toBe(BACKENDS.length)
  })

  it('모르는 하위 명령은 사용법과 함께 멈춘다', () => {
    const result = run('fastapi', 'probe-lab-unknown')
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('사용법')
  })
})

// Bundler는 이 clone만 고친다. 실제 하네스의 가드는 lockfile 전체를 비교해야 한다.
const LOCK = `GEM
  remote: https://rubygems.org/
  specs:
    probe (1.0.0)

PLATFORMS
  arm64-darwin-24
  arm64-darwin-25

DEPENDENCIES
  probe

CHECKSUMS
  probe (1.0.0) sha256=abc

BUNDLED WITH
   4.0.5
`
const PLATFORM_LOCK = LOCK.replace('PLATFORMS\n', 'PLATFORMS\n  arm64-darwin-23\n')

function adaptRailsLock(after: string) {
  const work = mkdtempSync(join(tmpdir(), 'rails-platform-'))
  try {
    const src = join(work, 'native', 'rails', 'src')
    const bin = join(work, 'bin')
    mkdirSync(join(src, '.git'), { recursive: true })
    mkdirSync(bin)
    writeFileSync(join(src, 'Gemfile.lock'), LOCK)
    writeFileSync(join(work, 'after.lock'), after)
    writeFileSync(join(bin, 'ruby'), '#!/bin/sh\nprintf arm64-darwin-23\n')
    writeFileSync(
      join(bin, 'bundle'),
      '#!/bin/sh\n[ "$*" = "lock --add-platform arm64-darwin-23" ] || exit 99\ncp "$AFTER_LOCK" Gemfile.lock\n',
    )
    chmodSync(join(bin, 'ruby'), 0o755)
    chmodSync(join(bin, 'bundle'), 0o755)
    const result = spawnSync(
      bash,
      [
        '-c',
        'export PATH="$(cd "$1" && pwd):$PATH"; exec bash "$2" lock-platform',
        'bash',
        toPosix(bin),
        toPosix(SCRIPT),
      ],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          BACKEND_KIND: 'rails',
          GITHUB_ACTIONS: 'true',
          RUNNER_TEMP: toPosix(work),
          E2E_NATIVE_DIR: toPosix(join(work, 'native')),
          AFTER_LOCK: toPosix(join(work, 'after.lock')),
        },
        timeout: BASH_TIMEOUT_MS,
      },
    )
    return { ...result, lock: readFileSync(join(src, 'Gemfile.lock'), 'utf8') }
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}

describe('Rails 임시 clone 잠금 플랫폼 가드', () => {
  it('Ruby가 보고한 플랫폼 한 줄만 더해지면 성공한다', () => {
    const result = adaptRailsLock(PLATFORM_LOCK)
    expect(result.status, result.stderr).toBe(0)
    expect(result.lock).toBe(PLATFORM_LOCK)
  })

  it.each([
    ['gem 버전', PLATFORM_LOCK.replace('probe (1.0.0)', 'probe (1.0.1)')],
    ['의존성', PLATFORM_LOCK.replace('DEPENDENCIES\n  probe', 'DEPENDENCIES\n  other')],
    ['소스', PLATFORM_LOCK.replace('https://rubygems.org/', 'https://other.invalid/')],
    ['체크섬', PLATFORM_LOCK.replace('sha256=abc', 'sha256=def')],
    ['다른 플랫폼', PLATFORM_LOCK.replace('  arm64-darwin-25', '  x86_64-linux')],
  ])('%s도 바뀌면 실패하고 원본을 복구한다', (_name, after) => {
    const result = adaptRailsLock(after)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('PLATFORMS')
    expect(result.lock).toBe(LOCK)
  })
})
