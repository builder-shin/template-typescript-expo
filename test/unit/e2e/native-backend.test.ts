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
import { describe, expect, it } from 'vitest'
import { BASH_TIMEOUT_MS, resolveBash } from '../support/bash'

/**
 * 네이티브 백엔드(test/e2e/native-backend.sh - iOS 매트릭스가 Docker 없이 쓴다)가 compose 스택과 같은 백엔드를
 * 받는가. 두 길이 다른 저장소를 받으면 Android 와 iOS 매트릭스가 다른 백엔드를 재고도 같은 이름으로 초록이 된다.
 * 스크립트의 나머지(Homebrew·PostgreSQL·런타임)는 macOS 에서만 돌아 CI 의 e2e-ios 잡이 잰다.
 */

const SCRIPT = resolve('test/e2e/native-backend.sh')
const SOURCE = readFileSync(SCRIPT, 'utf8')
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

/** 실제 서비스/정리 함수에 명령 경계만 대체한다. Redis·PostgreSQL·프로세스를 만들지 않는다. */
function withRedisScene(test: (scene: ReturnType<typeof redisScene>) => void) {
  const work = mkdtempSync(join(tmpdir(), 'native-redis-'))
  try {
    test(redisScene(work))
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}

function redisScene(work: string) {
  const bin = join(work, 'bin')
  const native = join(work, 'native')
  mkdirSync(bin)
  mkdirSync(join(native, 'fastapi/src/.git'), { recursive: true })
  mkdirSync(join(native, 'postgres/data'), { recursive: true })
  writeFileSync(join(native, 'postgres/data/PG_VERSION'), '18\n')
  const commands: Record<string, string> = {
    lsof: `port=''
for arg in "$@"; do case "$arg" in -iTCP:*) port=$(printf '%s' "$arg" | cut -c 7-) ;; esac; done
[ -f "$REDIS_SCENE/listener.pid" ] && [ "$(cat "$REDIS_SCENE/listener.port")" = "$port" ] || exit 1
cat "$REDIS_SCENE/listener.pid"`,
    ps: `[ "$1" != -ww ] || shift
[ "$1" = -p ] && [ "$2" = "$(cat "$REDIS_SCENE/process.pid")" ] || exit 1
case "$4" in
  args=) cat "$REDIS_SCENE/process.args" ;;
  comm=) cat "$REDIS_SCENE/process.comm" ;;
  *) exit 99 ;;
esac`,
    'redis-server': `printf 'server %s\n' "$*" >> "$REDIS_SCENE/calls"
printf 'redis-server %s\n' "$*" > "$REDIS_SCENE/process.args"
echo redis-server > "$REDIS_SCENE/process.comm"
echo 424242 > "$REDIS_SCENE/process.pid"
echo 424242 > "$REDIS_SCENE/listener.pid"
while [ "$#" -gt 1 ]; do
  case "$1" in
    --port) echo "$2" > "$REDIS_SCENE/listener.port" ;;
    --pidfile) echo 424242 > "$2" ;;
  esac
  shift
done`,
    'redis-cli': `printf 'cli %s\n' "$*" >> "$REDIS_SCENE/calls"
case "$3" in
  ping) [ -f "$REDIS_SCENE/listener.pid" ] ;;
  shutdown) rm -f "$REDIS_SCENE/listener.pid" ;;
  *) exit 99 ;;
esac`,
    pg_ctl: 'echo pg_ctl >> "$REDIS_SCENE/calls"',
    psql: 'echo psql >> "$REDIS_SCENE/calls"',
  }
  for (const [name, body] of Object.entries(commands)) {
    writeFileSync(join(bin, name), `#!/bin/sh\n${body}\n`)
    chmodSync(join(bin, name), 0o755)
  }
  const definitions = SOURCE.slice(
    SOURCE.indexOf('readonly REPO_ROOT='),
    SOURCE.lastIndexOf('\ncase "${1:-}" in'),
  )
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    BACKEND_KIND: 'fastapi',
    E2E_NATIVE_DIR: toPosix(native),
    E2E_PG_BIN: toPosix(bin),
    REDIS_SCENE: toPosix(work),
    E2E_REDIS_PORT: '56379',
  }
  delete env.BASH_ENV
  const read = (name: string) =>
    existsSync(join(work, name)) ? readFileSync(join(work, name), 'utf8').trim() : ''
  return {
    work,
    read,
    foreign(port = '56379') {
      writeFileSync(join(work, 'process.pid'), '424242\n')
      writeFileSync(join(work, 'listener.pid'), '424242\n')
      writeFileSync(join(work, 'listener.port'), `${port}\n`)
      writeFileSync(join(work, 'process.comm'), 'redis-server\n')
      writeFileSync(join(work, 'process.args'), `redis-server 127.0.0.1:${port}\n`)
      env.E2E_REDIS_PORT = port
    },
    run(body: string, overrides: Record<string, string> = {}) {
      const script = join(work, 'scene.sh')
      writeFileSync(
        script,
        `set -euo pipefail\nexport PATH="$(cd "$E2E_PG_BIN" && pwd):$PATH"\n${definitions}\n${body}\n`,
      )
      return spawnSync(bash, [toPosix(script)], {
        cwd: work,
        encoding: 'utf8',
        env: { ...env, ...overrides },
        timeout: BASH_TIMEOUT_MS,
      })
    },
    start() {
      const branch = SOURCE.slice(SOURCE.lastIndexOf('  start)\n'), SOURCE.lastIndexOf('\n  stop)'))
      return this.run(`
stop_api() { echo api-stop >> "$REDIS_SCENE/calls"; }
start_api() { echo api-start >> "$REDIS_SCENE/calls"; }
case start in
${branch}
esac`)
    },
    cleanupAfterPreparationFailure() {
      mkdirSync(join(work, 'test/e2e'), { recursive: true })
      writeFileSync(
        join(work, 'test/e2e/native-backend.sh'),
        `#!/bin/sh\nexec bash '${toPosix(SCRIPT)}' "$@"\n`,
      )
      chmodSync(join(work, 'test/e2e/native-backend.sh'), 0o755)
      const ios = readFileSync(resolve('test/e2e/run-ios.sh'), 'utf8')
      const cleanup = /^cleanup\(\) \{$[\s\S]*?^\}/m.exec(ios)?.[0]
      const prepare = /^create_owned_simulator \|\| fail .*$/m.exec(ios)?.[0]
      if (cleanup === undefined || prepare === undefined) throw new Error('iOS 정리/준비가 없다')
      return this.run(`
stop_device_log() { :; }
stop_stall_server() { :; }
restore_scheme_approval() { :; }
restore_autofill() { :; }
remove_owned_simulator() { :; }
create_owned_simulator() { return 1; }
${cleanup}
trap cleanup EXIT
${prepare}`)
    },
  }
}

describe('네이티브 Redis 소유권', () => {
  it.each(['56379', '56400'])(
    '외부 Redis가 %s를 점유하면 시작을 거부하고 명령을 보내지 않는다',
    (port) => {
      withRedisScene((scene) => {
        scene.foreign(port)
        const result = scene.start()
        expect(result.status, result.stderr).toBe(1)
        expect(result.stderr).toContain(`Redis 포트 ${port}`)
        expect(result.stderr).toContain('소유')
        expect(scene.read('calls')).toBe('')
        expect(scene.read('listener.pid')).toBe('424242')
      })
    },
  )

  it('시작 전 stop은 외부 Redis에 종료 명령을 보내지 않는다', () => {
    withRedisScene((scene) => {
      scene.foreign()
      const result = scene.run('stop_all')
      expect(result.status, result.stderr).toBe(0)
      expect(scene.read('calls')).not.toContain('cli ')
      expect(scene.read('listener.pid')).toBe('424242')
    })
  })

  it('iOS 준비 실패의 EXIT 정리는 외부 Redis를 종료하지 않는다', () => {
    withRedisScene((scene) => {
      scene.foreign()
      const result = scene.cleanupAfterPreparationFailure()
      expect(result.status, result.stderr).toBe(1)
      expect(result.stderr).toContain('E2E 전용 simulator')
      expect(scene.read('calls')).not.toContain('cli ')
      expect(scene.read('listener.pid')).toBe('424242')
    })
  })

  it('자기가 띄운 인스턴스만 재사용하고 마지막에 종료한다', () => {
    withRedisScene((scene) => {
      for (const command of ['start_services', 'start_services', 'stop_all']) {
        const result = scene.run(command)
        expect(result.status, result.stderr).toBe(0)
      }
      const calls = scene.read('calls').split('\n')
      expect(calls.filter((call) => call.startsWith('server '))).toHaveLength(1)
      expect(calls.filter((call) => call.includes('shutdown'))).toEqual([
        'cli -p 56379 shutdown nosave',
      ])
      expect(scene.read('listener.pid')).toBe('')
    })
  })

  it('같은 포트라도 다른 하네스 디렉터리에서는 재사용하거나 종료하지 않는다', () => {
    withRedisScene((scene) => {
      expect(scene.run('start_services').status).toBe(0)
      const overrides = { E2E_NATIVE_DIR: `${toPosix(scene.work)}/other` }
      const stop = scene.run('stop_all', overrides)
      expect(stop.status, stop.stderr).toBe(0)
      expect(scene.read('calls')).not.toContain('shutdown')
      const start = scene.run('start_services', overrides)
      expect(start.status, start.stderr).toBe(1)
      expect(start.stderr).toContain('소유')
      expect(scene.read('listener.pid')).toBe('424242')
    })
  })

  it('낡은 PID가 다른 Redis를 가리키면 종료하지 않는다', () => {
    withRedisScene((scene) => {
      expect(scene.run('start_services').status).toBe(0)
      scene.foreign()
      const result = scene.run('stop_all')
      expect(result.status, result.stderr).toBe(0)
      expect(scene.read('calls')).not.toContain('shutdown')
      expect(scene.read('listener.pid')).toBe('424242')
    })
  })

  it('소유 PID가 살아 있어도 포트의 리스너가 다르면 종료하지 않는다', () => {
    withRedisScene((scene) => {
      expect(scene.run('start_services').status).toBe(0)
      writeFileSync(join(scene.work, 'listener.pid'), '434343\n')
      const result = scene.run('stop_all')
      expect(result.status, result.stderr).toBe(0)
      expect(scene.read('calls')).not.toContain('shutdown')
      expect(scene.read('listener.pid')).toBe('434343')
    })
  })
})

describe('BACKEND_KIND 사용자 오류', () => {
  it.each([
    'test/contract/run.sh',
    'test/e2e/run-android.sh',
    'test/e2e/run-ios.sh',
    'test/e2e/native-backend.sh',
  ])('%s는 부수 효과 전에 메시지만 출력하고 1로 끝난다', (script) => {
    const work = mkdtempSync(join(tmpdir(), 'backend-kind-'))
    try {
      mkdirSync(join(work, 'test/contract'), { recursive: true })
      mkdirSync(join(work, 'test/e2e'), { recursive: true })
      const bin = join(work, 'bin')
      mkdirSync(bin)
      writeFileSync(join(work, script), readFileSync(resolve(script), 'utf8'))
      for (const name of ['matrix.ts', 'ios-simulator.sh']) {
        writeFileSync(join(work, 'test/e2e', name), readFileSync(resolve('test/e2e', name), 'utf8'))
      }
      for (const name of [
        'docker',
        'adb',
        'xcrun',
        'brew',
        'git',
        'curl',
        'pnpm',
        'uname',
        'lsof',
        'rm',
        'mkdir',
      ]) {
        writeFileSync(
          join(bin, name),
          '#!/bin/sh\nprintf "%s\\n" "$0 $*" >> "$SIDE_CALLS"\nexit 97\n',
        )
        chmodSync(join(bin, name), 0o755)
      }
      const env: NodeJS.ProcessEnv = {
        ...process.env,
        BACKEND_KIND: 'probe-lab-unknown',
        SIDE_CALLS: toPosix(join(work, 'calls')),
      }
      delete env.BASH_ENV
      const result = spawnSync(
        bash,
        [
          '-c',
          'export PATH="$(cd "$1" && pwd):$PATH"; exec bash "$2" start',
          'bash',
          toPosix(bin),
          toPosix(join(work, script)),
        ],
        { cwd: work, encoding: 'utf8', env, timeout: BASH_TIMEOUT_MS },
      )
      expect(result.status, result.stderr).toBe(1)
      expect(existsSync(join(work, 'calls'))).toBe(false)
      expect(result.stdout).toBe('')
      expect(result.stderr).toBe(
        "BACKEND_KIND='probe-lab-unknown' 는 알려진 백엔드가 아니다 - fastapi | nestjs | rails 중 하나여야 한다\n",
      )
      expect(result.stderr).not.toMatch(/^\s*at |\.ts:\d|\[eval\]:\d/m)
    } finally {
      rmSync(work, { recursive: true, force: true })
    }
  })
})
