import { spawnSync } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'

/**
 * `test/contract/run.sh`(게이트 `[12/13]`)의 불변식을 실제 스크립트로 잰다.
 *
 * ## 왜 가짜로 도는가
 *
 * 이 스크립트는 Docker 스택을 띄우고 내리므로 게이트의 `[12/13]` 밖에서는 아무도 돌려 보지 않는다 - 고치다가
 * 불변식을 깨도 다음 게이트까지 드러나지 않고, 그 게이트는 몇십 분이 든다. 그래서 PATH 맨 앞에 가짜 `docker`·
 * `curl`·`pnpm` 을 두고 `run.sh` 가 그것들을 어떻게 불렀는지(인자와 환경)를 기록해 맞댄다. **진짜 Docker 는 이
 * 파일에서 한 번도 부르지 않는다** - 시험이 먼저 가짜가 맨 앞에서 잡히는지 확인하고, 아니면 `run.sh` 를 돌리기
 * 전에 멈춘다. 가짜를 PATH 맨 앞에 두는 일은 환경 변수가 아니라 `BASH_ENV` 로 읽히는 파일이 셸이 시작된 뒤에
 * 한다 - Windows 에서 PowerShell·cmd 로 돌리면 bash 가 Git 의 `bin\bash.exe` 로 잡히고, 그것이 PATH 앞에
 * `/mingw64/bin:/usr/bin` 을 붙여 Git 의 진짜 `curl` 이 가짜보다 먼저 잡힌다.
 *
 * ## 지키는 불변식
 *
 * `run.sh` 는 고쳐진다(프로파일 선택 등). 고쳐도 아래는 참이어야 한다 - 그래서 프로파일 목록 같은 세부가 아니라
 * 이것들만 고정한다.
 *
 * 1. **compose 호출은 전부 이 저장소의 프로젝트로 범위가 좁혀진다**(`-p template-typescript-expo-e2e -f
 *    docker-compose.e2e.yml`). 개발 머신에는 이 저장소와 무관한 스택(`joon-*` 등)이 떠 있고, 프로젝트 이름이 빠진
 *    compose 호출은 디렉터리 이름으로 프로젝트를 추측한다. 시험이 모든 장면에서 이것을 확인한다.
 * 2. **access token 수명은 900초다.** 거울은 한 번 로그인한 토큰으로 속성 제약을 재므로, E2E 하네스의 10초가
 *    셸에 남아 있어도 compose 가 900 을 봐야 한다.
 * 3. **정리 트랩은 사전 점검(docker·데몬·curl)이 모두 끝난 뒤에만 선다.** 점검이 실패하면 compose 호출이 하나도
 *    없다 - docker 가 없거나 데몬이 꺼진 머신에서 `down` 을 부르는 것은 소음이다. 트랩이 선 뒤에는 어떤 끝(띄우기·
 *    준비 확인·거울의 실패)에서도 이 프로젝트의 세 프로파일을 내린다.
 * 4. **거울(`pnpm test:contract`)의 종료 코드가 그대로 `run.sh` 의 종료 코드다.**
 *
 * 그리고 호출의 순서, 포트의 출처(`E2E_API_PORT` 한 값에서 준비 확인 주소와 `CONTRACT_API_URL` 이 나온다), compose
 * 가 저장소 루트에서 불리는 것(`-f` 가 상대 경로다)을 잰다.
 */

/** Git Bash 는 역슬래시 경로를 이스케이프로 먹어 치운다. */
function toPosix(path: string): string {
  return path.split('\\').join('/')
}

/** 이 파일은 `<루트>/test/unit/scripts/contract-run.test.ts` 다 - 세 계단 위가 저장소 루트다. */
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const SCRIPT = toPosix(join(REPO_ROOT, 'test', 'contract', 'run.sh'))

const PROJECT = 'template-typescript-expo-e2e'
const COMPOSE_FILE = 'docker-compose.e2e.yml'
/** 이 저장소의 compose 호출이 반드시 시작하는 말. */
const SCOPE = `compose -p ${PROJECT} -f ${COMPOSE_FILE}`

/**
 * bash 를 한 번 부르는 일의 상한. 가짜 도구는 즉시 끝나므로 이보다 오래 걸리면 `run.sh` 안에 기다리는 반복
 * (폴링·sleep)이 생긴 것이다 - 시험이 멈춰 서는 대신 이유와 함께 빨개진다.
 */
const SPAWN_TIMEOUT_MS = 30_000

const WORK = mkdtempSync(join(tmpdir(), 'contract-run-'))
const SHIMS = join(WORK, 'shims')

afterAll(() => {
  rmSync(WORK, { recursive: true, force: true })
})

/**
 * 쓸 수 있는 bash 를 하나 고른다. 후보를 실제로 돌려 보고 판정한다 - Windows 의 PATH 에서 `bash` 는 WSL 의
 * bash.exe 로 잡힐 수 있고 그것은 /bin/bash 를 못 찾아 죽는다(test/unit/scripts/check-citations.test.ts 와
 * 같은 방법).
 */
function resolveBash(): string {
  const programFiles = process.env.ProgramW6432 ?? process.env.ProgramFiles ?? 'C:\\Program Files'
  const candidates =
    process.platform === 'win32'
      ? [
          'bash',
          join(programFiles, 'Git', 'bin', 'bash.exe'),
          join(programFiles, 'Git', 'usr', 'bin', 'bash.exe'),
        ]
      : ['bash']
  for (const candidate of candidates) {
    const probe = spawnSync(candidate, ['-c', 'printf ok'], {
      encoding: 'utf8',
      timeout: SPAWN_TIMEOUT_MS,
    })
    if (probe.status === 0 && probe.stdout === 'ok') return candidate
  }
  throw new Error(`쓸 수 있는 bash 를 찾지 못했다 - 후보: ${candidates.join(' · ')}`)
}

const BASH = resolveBash()

/**
 * bash 가 보는 경로 - Windows 에서는 `C:/…` 가 `/c/…` 꼴이 된다. 경로는 인자로 넘긴다(따옴표나 `$` 가 든 이름이
 * 명령 문자열로 풀리지 않게). 호출자의 `BASH_ENV` 가 끼어들지 않게 지운다.
 */
function bashPathOf(path: string): string {
  const env: NodeJS.ProcessEnv = { ...process.env }
  delete env.BASH_ENV
  const result = spawnSync(BASH, ['-c', 'cd "$1" && pwd', 'bash', toPosix(path)], {
    env,
    encoding: 'utf8',
    timeout: SPAWN_TIMEOUT_MS,
  })
  const resolved = result.stdout.trim()
  if (result.status !== 0 || resolved === '') throw new Error(`bash 가 경로를 풀지 못했다: ${path}`)
  return resolved
}

/* ------------------------------------------------------------------------- *
 * 가짜 도구
 * ------------------------------------------------------------------------- */

/** 가짜가 한 줄에 적는 환경 - `run.sh` 가 도구에 넘긴 것 중 이 시험이 보는 것. */
const LOGGED_ENV = [
  'CONTRACT_API_URL',
  'E2E_API_PORT',
  'E2E_ACCESS_EXPIRES_SECONDS',
  'PWD',
] as const

/**
 * 가짜 도구 하나의 본문. 받은 인자와 환경을 `SHIM_LOG` 에 한 줄로 적고(`<도구> <인자>` 뒤에 `이름=값` 들 - 모두
 * 탭으로 나눈다. 값에 공백이 든 경로(`PWD`)도 온전히 읽히게 한다), `__shim__` 을 받으면 자기 이름을 대고
 * 끝난다(진짜 도구는 그 인자를 모른다). `exitVariable` 이 가리키는 환경 변수로 종료 코드를 정한다.
 */
function shimScript(name: string, exitVariable: string, extra: readonly string[] = []): string {
  const env = LOGGED_ENV.map((variable) => `${variable}=\${${variable}:-}`).join('\t')
  return [
    '#!/bin/sh',
    `if [ "\${1:-}" = "__shim__" ]; then echo "fake-${name}"; exit 0; fi`,
    `echo "${name} $*\t${env}" >>"$SHIM_LOG"`,
    ...extra,
    `exit "\${${exitVariable}:-0}"`,
    '',
  ].join('\n')
}

mkdirSync(SHIMS, { recursive: true })
const SHIM_FILES: Readonly<Record<string, string>> = {
  docker: shimScript('docker', 'FAKE_DOCKER_EXIT', [
    'if [ "${1:-}" = "info" ]; then exit "${FAKE_DOCKER_INFO_EXIT:-0}"; fi',
    'case " $* " in *" up "*) exit "${FAKE_DOCKER_UP_EXIT:-0}" ;; esac',
  ]),
  curl: shimScript('curl', 'FAKE_CURL_EXIT'),
  pnpm: shimScript('pnpm', 'FAKE_PNPM_EXIT'),
}
for (const [name, source] of Object.entries(SHIM_FILES)) {
  writeFileSync(join(SHIMS, name), source, { encoding: 'utf8', mode: 0o755 })
  chmodSync(join(SHIMS, name), 0o755)
}

/** bash 가 보는 가짜 도구의 디렉터리 - 아래 `BASH_ENV` 파일이 `SHIM_DIR` 로 읽어 PATH 맨 앞에 박는다. */
const SHIMS_IN_BASH = bashPathOf(SHIMS)

/**
 * 모든 장면의 bash 가 `BASH_ENV` 로 먼저 읽는 파일. 둘을 한다.
 *
 * 1. 가짜 도구의 디렉터리를 PATH 맨 앞에 박는다. 부모가 PATH 맨 앞에 둔 가짜는 Windows 의 `bin\bash.exe` 래퍼가
 *    `/mingw64/bin:/usr/bin` 을 앞에 붙이면 Git 의 진짜 `curl` 에 밀린다(PowerShell·cmd 에서 돌릴 때). 셸이 시작된
 *    뒤에 박으면 어느 부모에서든 가짜가 이긴다.
 * 2. `HIDE_TOOL` 이 가리키는 도구가 PATH 에 없는 것처럼 `command -v` 가 답하게 한다 - 이 머신에 진짜가 깔려
 *    있어도 "docker 가 없다"·"curl 이 없다" 장면이 선다.
 */
const BASH_ENV_FILE = join(WORK, 'bash-env.sh')
writeFileSync(
  BASH_ENV_FILE,
  [
    'export PATH="$SHIM_DIR:$PATH"',
    'command() {',
    '  if [ "${1:-}" = "-v" ] && [ "${2:-}" = "${HIDE_TOOL:-}" ]; then return 1; fi',
    '  builtin command "$@"',
    '}',
    '',
  ].join('\n'),
  'utf8',
)

/** 호출자의 셸이 장면을 흔들지 못하게 지우는 변수 - 개발자의 셸에는 포트나 E2E 의 짧은 수명이 남아 있을 수 있다. */
const SCRUBBED = [
  'E2E_API_PORT',
  'E2E_ACCESS_EXPIRES_SECONDS',
  'CONTRACT_API_URL',
  'BASH_ENV',
  'SHIM_DIR',
  'HIDE_TOOL',
  'FAKE_DOCKER_EXIT',
  'FAKE_DOCKER_INFO_EXIT',
  'FAKE_DOCKER_UP_EXIT',
  'FAKE_CURL_EXIT',
  'FAKE_PNPM_EXIT',
]

function sceneEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env }
  for (const name of SCRUBBED) delete env[name]
  // Windows 의 환경 변수 이름은 대소문자를 가리지 않지만 펼친 객체의 키는 가린다 - 있는 키에 붙인다.
  const pathKey = Object.keys(env).find((key) => key.toLowerCase() === 'path') ?? 'PATH'
  env[pathKey] = `${SHIMS}${delimiter}${env[pathKey] ?? ''}`
  // 셸이 시작된 뒤에 가짜를 PATH 맨 앞에 박는 파일 - 위의 PATH 만으로는 Git 의 래퍼 bash 에서 밀린다.
  env.SHIM_DIR = SHIMS_IN_BASH
  env.BASH_ENV = toPosix(BASH_ENV_FILE)
  return env
}

/** 가짜가 PATH 맨 앞에서 잡히는지 - 아니면 `run.sh` 를 돌리지 않는다. */
function assertShimsAreFirst(): void {
  const probe = spawnSync(BASH, ['-c', 'docker __shim__ && curl __shim__ && pnpm __shim__'], {
    env: sceneEnv(),
    encoding: 'utf8',
    timeout: SPAWN_TIMEOUT_MS,
  })
  if (probe.stdout !== 'fake-docker\nfake-curl\nfake-pnpm\n') {
    throw new Error(
      `가짜 docker·curl·pnpm 이 PATH 맨 앞에서 잡히지 않는다 - run.sh 를 돌리면 진짜 Docker 가 불릴 수 있어 멈춘다: ${probe.stdout}${probe.stderr}`,
    )
  }
}

assertShimsAreFirst()

/** bash 가 보는 저장소 루트 - Windows 에서는 `/c/…` 꼴이다. compose 가 불린 자리와 이것을 맞댄다. */
const REPO_ROOT_IN_BASH = bashPathOf(REPO_ROOT)

/* ------------------------------------------------------------------------- *
 * 장면
 * ------------------------------------------------------------------------- */

interface Call {
  readonly tool: string
  readonly args: string
  readonly env: Readonly<Record<string, string>>
}

interface Outcome {
  readonly status: number
  readonly stderr: string
  readonly calls: readonly Call[]
}

interface Scene {
  /** 호출자의 셸에 있는 환경 변수 - 가짜의 종료 코드(`FAKE_*`)도 여기로 준다. */
  readonly env?: Readonly<Record<string, string>>
  /** PATH 에 없는 것처럼 보이게 할 도구. */
  readonly hide?: 'docker' | 'curl'
}

function parseCalls(log: string): Call[] {
  return log
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => {
      const [head = '', ...pairs] = line.split('\t')
      const space = head.indexOf(' ')
      const env: Record<string, string> = {}
      for (const pair of pairs) {
        const equals = pair.indexOf('=')
        if (equals > 0) env[pair.slice(0, equals)] = pair.slice(equals + 1)
      }
      return {
        tool: space === -1 ? head : head.slice(0, space),
        args: space === -1 ? '' : head.slice(space + 1),
        env,
      }
    })
}

/** `info` 가 아닌 docker 호출 - 곧 compose 호출. */
function composeCalls(calls: readonly Call[]): Call[] {
  return calls.filter((call) => call.tool === 'docker' && call.args !== 'info')
}

/** 이름으로 부르는 단계 - 순서를 읽기 쉽게 한다. */
function stage(call: Call): string {
  if (call.tool !== 'docker') return call.tool
  if (call.args === 'info') return 'info'
  if (/ down( |$)/.test(call.args)) return 'down'
  if (/ up( |$)/.test(call.args)) return 'up'
  return `docker ${call.args}`
}

let scenes = 0

/**
 * `run.sh` 를 한 번 돌린다. **모든 장면이 불변식 1 을 확인한다** - 범위가 좁혀지지 않은 docker 호출이 하나라도
 * 있으면 어느 장면이든 던진다(그 호출은 이 머신의 다른 스택을 건드릴 수 있다).
 */
function run(scene: Scene = {}): Outcome {
  scenes += 1
  const log = join(WORK, `calls-${String(scenes)}.log`)
  writeFileSync(log, '', 'utf8')
  const env = sceneEnv()
  env.SHIM_LOG = toPosix(log)
  Object.assign(env, scene.env)
  if (scene.hide !== undefined) env.HIDE_TOOL = scene.hide
  // 저장소 루트가 아닌 곳에서 부른다 - 스크립트가 제 위치에서 루트를 찾아야 한다.
  const result = spawnSync(BASH, [SCRIPT], {
    cwd: WORK,
    env,
    encoding: 'utf8',
    timeout: SPAWN_TIMEOUT_MS,
  })
  if (result.error) {
    if ((result.error as NodeJS.ErrnoException).code === 'ETIMEDOUT') {
      throw new Error(
        `run.sh 가 ${String(SPAWN_TIMEOUT_MS / 1000)}초 안에 끝나지 않았다 - 가짜 도구는 즉시 끝나므로 run.sh 에 기다리는 반복(폴링·sleep)이 생겼는지 본다`,
      )
    }
    throw result.error
  }
  if (result.status === null) throw new Error(`run.sh 가 신호로 죽었다: ${String(result.signal)}`)
  const calls = parseCalls(readFileSync(log, 'utf8'))
  const unscoped = composeCalls(calls).filter((call) => !call.args.startsWith(`${SCOPE} `))
  if (unscoped.length > 0) {
    throw new Error(
      `이 저장소의 프로젝트로 범위가 좁혀지지 않은 docker 호출이 있다: ${unscoped.map((call) => `docker ${call.args}`).join(' ; ')}`,
    )
  }
  return { status: result.status, stderr: result.stderr, calls }
}

/** 같은 장면을 여러 시험이 나눠 볼 때 한 번만 돈다. 던졌으면 던진 것을 그대로 다시 던진다. */
function once<T>(make: () => T): () => T {
  let made: { value: T } | { error: unknown } | undefined
  return () => {
    if (made === undefined) {
      try {
        made = { value: make() }
      } catch (error) {
        // 던진 것도 기억한다 - 멈춘 장면을 시험마다 30초씩 다시 돌지 않는다.
        made = { error }
      }
    }
    if ('error' in made) throw made.error
    return made.value
  }
}

/** 호출자의 셸에 E2E 하네스의 짧은 수명이 남아 있는 가장 나쁜 환경에서 끝까지 성공하는 장면. */
const success = once(() => run({ env: { E2E_ACCESS_EXPIRES_SECONDS: '10' } }))

function callsOf(outcome: Outcome, step: string): Call[] {
  return outcome.calls.filter((call) => stage(call) === step)
}

describe('test/contract/run.sh', { timeout: 60_000 }, () => {
  describe('끝까지 성공하는 장면', () => {
    it('점검 → 정리 → 띄우기 → 준비 확인 → 거울 → 정리 순서로 부르고 0 으로 끝난다', () => {
      const outcome = success()

      expect(outcome.calls.map(stage)).toEqual(['info', 'down', 'up', 'curl', 'pnpm', 'down'])
      expect(outcome.status).toBe(0)
    })

    it('[불변식 1] docker 호출은 info 가 아니면 전부 이 저장소의 프로젝트로 범위가 좁혀진다', () => {
      const compose = composeCalls(success().calls)

      // 빈 검사가 아니다 - 정리 둘과 띄우기 하나는 있어야 한다(호출이 더 늘어도 된다).
      expect(compose.length).toBeGreaterThanOrEqual(3)
      for (const call of compose) expect(call.args.startsWith(`${SCOPE} `)).toBe(true)
    })

    it('정리는 세 프로파일 모두에 -v --remove-orphans 로 한다 - 처음과 끝', () => {
      const downs = callsOf(success(), 'down')

      expect(downs).toHaveLength(2)
      for (const call of downs) {
        expect(call.args).toContain('--profile fastapi')
        expect(call.args).toContain('--profile nestjs')
        expect(call.args).toContain('--profile rails')
        expect(call.args.endsWith(' down -v --remove-orphans')).toBe(true)
      }
    })

    it('띄우기는 -d --build --wait 이다', () => {
      const [up, ...rest] = callsOf(success(), 'up')

      expect(rest).toEqual([])
      expect(up?.args.endsWith(' up -d --build --wait')).toBe(true)
    })

    it('compose 는 저장소 루트에서 불린다 - -f 가 상대 경로이고 호출은 다른 디렉터리에서 왔다', () => {
      const compose = composeCalls(success().calls)

      expect(REPO_ROOT_IN_BASH).not.toBe('')
      for (const call of compose) expect(call.env.PWD).toBe(REPO_ROOT_IN_BASH)
    })

    it('[불변식 2] 셸에 E2E 의 10초가 남아 있어도 compose 와 거울은 900 을 본다', () => {
      const outcome = success()
      const seen = outcome.calls.filter((call) => call.tool === 'pnpm' || stage(call) === 'up')

      expect(seen.map(stage)).toEqual(['up', 'pnpm'])
      for (const call of seen) expect(call.env.E2E_ACCESS_EXPIRES_SECONDS).toBe('900')
    })
  })

  describe('포트 - E2E_API_PORT 한 값에서 나온다', () => {
    it.each<[string, string | undefined, string]>([
      ['기본', undefined, '4100'],
      ['지정', '4333', '4333'],
    ])(
      '%s: 준비 확인 주소·거울의 CONTRACT_API_URL·compose 의 포트가 같다',
      (_name, given, port) => {
        const outcome = given === undefined ? run() : run({ env: { E2E_API_PORT: given } })

        expect(callsOf(outcome, 'curl').map((call) => call.args)).toEqual([
          `-fsS http://127.0.0.1:${port}/health/ready`,
        ])
        const [pnpm] = callsOf(outcome, 'pnpm')
        expect(pnpm?.args).toBe('test:contract')
        expect(pnpm?.env.CONTRACT_API_URL).toBe(`http://127.0.0.1:${port}`)
        for (const call of composeCalls(outcome.calls)) expect(call.env.E2E_API_PORT).toBe(port)
      },
    )
  })

  describe('[불변식 3] 정리 트랩', () => {
    it.each<[string, Scene, string, string[]]>([
      ['docker 가 없다', { hide: 'docker' }, 'docker 가 없다', []],
      [
        '데몬에 닿지 못한다',
        { env: { FAKE_DOCKER_INFO_EXIT: '1' } },
        'Docker 데몬에 닿지 못한다',
        ['info'],
      ],
      ['curl 이 없다', { hide: 'curl' }, 'curl 이 없다', ['info']],
    ])(
      '사전 점검이 실패하면(%s) 1 로 끝나고 compose 를 한 번도 부르지 않는다',
      (_name, scene, message, stages) => {
        const outcome = run(scene)

        expect(outcome.status).toBe(1)
        expect(outcome.stderr).toContain(`계약 거울: ${message}`)
        expect(outcome.calls.map(stage)).toEqual(stages)
      },
    )

    it('띄우기가 실패해도(17) 그 코드로 끝나고 내린다 - 준비 확인과 거울은 부르지 않는다', () => {
      const outcome = run({ env: { FAKE_DOCKER_UP_EXIT: '17' } })

      expect(outcome.status).toBe(17)
      expect(outcome.calls.map(stage)).toEqual(['info', 'down', 'up', 'down'])
    })

    it('준비 확인이 실패하면 1 로 끝나고 내린다 - 거울은 부르지 않는다', () => {
      const outcome = run({ env: { FAKE_CURL_EXIT: '22' } })

      expect(outcome.status).toBe(1)
      expect(outcome.stderr).toContain('계약 거울: FastAPI 가 127.0.0.1:4100 에서 준비되지 않았다')
      expect(outcome.calls.map(stage)).toEqual(['info', 'down', 'up', 'curl', 'down'])
    })

    it('[불변식 4] 거울이 실패하면(3) 그 코드로 끝나고 그래도 내린다', () => {
      const outcome = run({ env: { FAKE_PNPM_EXIT: '3' } })

      expect(outcome.status).toBe(3)
      expect(outcome.calls.map(stage)).toEqual(['info', 'down', 'up', 'curl', 'pnpm', 'down'])
    })
  })
})
