import { afterAll, describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * `scripts/check-citations.sh` 를 **실제로 돌려서** 잰다 - 게이트 [5/11] 의 몸통이다.
 *
 * ## 왜 이 파일이 있는가
 *
 * 이 검사는 처음에 `check.sh` 안의 `grep` 한 줄이었고, 그 상태에서 리뷰가 설계한
 * 뮤턴트 **여덟이 전부 살아남았다** - 패턴 갈래 넷을 각각 지워도, 대상 셋을 각각
 * 빼도, 패턴을 통째로 절대 안 맞는 문자열로 바꿔도 게이트는 초록이었다. 오늘
 * 트리에 위반이 0건이라 **"패턴이 성하다"와 "패턴이 망가졌다"가 우연히 같은
 * 세계**였기 때문이다. 이 저장소가 반복해서 앓는 그 모양이고, 그때는 **가드
 * 자신**이 그 모양이었다.
 *
 * 앞선 구현자도 프로브 파일을 넣어 이 성질을 옳은 방법으로 쟀다. 그러나 **그
 * 프로브를 지웠다** - 측정이 한 번 돌고 사라져 저장소에는 아무것도 남지 않았다.
 * 이 파일이 그 측정을 저장소에 붙박은 것이다: 픽스처를 임시 디렉터리에 만들고
 * 진짜 스크립트를 돌린다.
 *
 * ## 픽스처 문자열은 반드시 이어붙여 만든다
 *
 * 게이트가 훑는 여섯 대상에 `test/` 가 들어 있다 - 즉 **이 파일 자신이 검사
 * 대상**이다. 금지 인용을 리터럴로 적으면 이 파일이 [5/11] 에 걸린다. 예외 장치는
 * 하나도 없다(`--exclude` · 허용 목록 · 무시 주석 전부 없고 일부러 두지 않았다).
 * 그래서 금지 인용은 `'task-' + '9' + '-report.md'` 처럼 조각으로 적는다.
 *
 * **픽스처 몸통만이 아니라 이 파일의 모든 줄이 그렇다** - 검사 이름·주석·단언의
 * 기대값도 금지 문자열을 통째로 담으면 안 된다(실측: 처음 판은 검사 이름 셋과
 * 단언 하나와 이 주석 한 줄이 그대로 걸렸다). 그래서 아래 검사 이름은 패턴을
 * 산문으로 부르고, 단언은 리터럴이 아니라 픽스처 변수를 맞댄다.
 *
 * **허용되는 인용(`docs/superpowers/…`)은 반대로 리터럴 그대로 적는다.** 누가
 * 패턴을 `superpowers` 전체로 넓히면 이 파일의 그 리터럴이 위반이 되어 게이트가
 * 빨개진다 - 아래 "허용되는 인용" 검사가 같은 것을 단위에서 한 번 더 잰다.
 *
 * ## 왜 bash 실행 파일을 찾아 쓰는가
 *
 * Windows 에서 PATH 의 `bash` 는 `C:\Windows\System32\bash.exe`(WSL)로 잡히고 그것은
 * `/bin/bash` 를 못 찾아 죽는다(실측 2026-09-08: exit 1,
 * `execvpe(/bin/bash) failed: No such file or directory`). 게이트 안에서는 Git Bash 가
 * 부모라 상속된 PATH 로 올바르게 잡히지만, 개발자가 PowerShell 에서 `pnpm test` 만
 * 돌리면 **그 자리에서만** 죽는다. 그래서 후보를 차례로 **실제로 돌려 보고** 쓸 수
 * 있는 것을 고른다.
 */

/** 이 파일은 `<루트>/test/unit/scripts/check-citations.test.ts` 다 - 세 계단 위가 저장소 루트다. */
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

const CITATIONS_SCRIPT_NAME = 'check-citations.sh'

/** Git Bash 는 역슬래시 경로를 이스케이프로 먹어 치운다(실측: `C:Users\rootj…`). */
function toPosix(path: string): string {
  return path.split('\\').join('/')
}

const SCRIPT_PATH = toPosix(join(REPO_ROOT, 'scripts', CITATIONS_SCRIPT_NAME))

/**
 * 게이트가 `[5/11]` 에서 넘기는 대상 여섯. **의도적인 옮겨 적기다** -
 * `scripts/check.sh` 의 호출과 여기를 함께 고쳐야 초록이 유지된다. 검사
 * 스크립트가 기본값을 두지 않고 대상을 인자로만 받는 것이 이 성질을 만든다.
 */
const GATE_TARGETS = ['app', 'components', 'lib', 'platform', 'queries', 'test'] as const

/**
 * 금지 갈래마다 픽스처 하나. **각 갈래를 지우는 뮤턴트가 여기서 죽는다** -
 * 패턴을 통째로 바꾸는 뮤턴트는 일곱 전부에서 죽는다.
 */
const FORBIDDEN_CITATIONS: readonly (readonly [string, string])[] = [
  ['태스크 보고서 파일명', 'task-' + '9' + '-report.md'],
  ['태스크 리뷰 파일명', 'task-' + '3' + '-review.md'],
  ['태스크 브리핑 파일명', 'task-' + '1' + '-brief.md'],
  ['선행 점이 붙은 계획 트리', '.super' + 'powers/' + 'notes/2026-01-01-x.md'],
  ['선행 점 없이 쓴 계획 트리의 sdd 하위', 'super' + 'powers/' + 'sdd/2026-01-01-x/y.md'],
  ['세션 스크래치패드', '../scratch' + 'pad/notes.md'],
  ['세션이 만들어 쓰고 버리는 규칙 파일', 'guard-' + 'rules.md'],
]

/**
 * 통과해야 하는 인용. **리터럴 그대로 적는 것이 요점이다** - 패턴이
 * `superpowers` 로 넓어지는 순간 이 파일이 게이트에 걸린다.
 */
const ALLOWED_CITATIONS: readonly string[] = [
  'docs/superpowers/notes/2026-09-08-d4-handoff.md',
  'docs/superpowers/plans/2026-09-07-resources-list-and-detail.md',
  'docs/superpowers/specs/2026-09-04-nextjs-jsonapi-template-design.md',
]

const fixtureRoot = mkdtempSync(join(tmpdir(), 'check-citations-'))

afterAll(() => {
  rmSync(fixtureRoot, { recursive: true, force: true })
})

/**
 * 쓸 수 있는 bash 를 하나 고른다. 후보를 실제로 돌려 보고 판정한다 - 존재
 * 여부만 보면 WSL 의 `bash.exe` 가 통과해 버린다(위 머리말).
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
    const probe = spawnSync(candidate, ['-c', 'printf ok'], { encoding: 'utf8' })
    if (probe.status === 0 && probe.stdout === 'ok') return candidate
  }
  throw new Error(`쓸 수 있는 bash 를 찾지 못했다 - 후보: ${candidates.join(' · ')}`)
}

const BASH = resolveBash()

interface CitationsRun {
  status: number
  stdout: string
  stderr: string
}

/** 대상은 `fixtureRoot` 기준 상대 경로로 넘긴다 - grep 출력이 그대로 읽힌다. */
function runCitations(...targets: readonly string[]): CitationsRun {
  const result = spawnSync(BASH, [SCRIPT_PATH, ...targets], {
    cwd: fixtureRoot,
    encoding: 'utf8',
  })
  if (result.error) throw result.error
  if (result.status === null) throw new Error(`스크립트가 신호로 죽었다: ${String(result.signal)}`)
  return { status: result.status, stdout: result.stdout, stderr: result.stderr }
}

/** 픽스처 디렉터리 하나에 인용 한 줄짜리 파일을 만들고, 넘길 상대 경로를 돌려준다. */
function writeFixture(name: string, citation: string): string {
  mkdirSync(join(fixtureRoot, name), { recursive: true })
  writeFileSync(join(fixtureRoot, name, 'sample.ts'), `// 근거: ${citation}\n`, 'utf8')
  return name
}

/**
 * `scripts/check.sh` 의 `[5/11]` 호출에 실제로 적힌 인자들. 주석 줄은 건너뛴다 -
 * 그 파일 머리말이 스크립트 이름을 산문으로도 적는다.
 */
function citationTargetsInGate(): string[] {
  const lines = readFileSync(join(REPO_ROOT, 'scripts', 'check.sh'), 'utf8').split('\n')
  const start = lines.findIndex(
    (line) => !line.trimStart().startsWith('#') && line.includes(CITATIONS_SCRIPT_NAME),
  )
  expect(
    start,
    `scripts/check.sh 가 ${CITATIONS_SCRIPT_NAME} 를 부르지 않는다`,
  ).toBeGreaterThanOrEqual(0)

  let invocation = ''
  for (let index = start; index < lines.length; index += 1) {
    const line = (lines[index] ?? '').trimEnd()
    if (line.endsWith('\\')) {
      invocation += `${line.slice(0, -1)} `
      continue
    }
    invocation += line
    break
  }

  return invocation.trim().split(/\s+/).slice(1)
}

describe('scripts/check-citations.sh', () => {
  it('위반을 찾으면 exit 1 로 죽고 파일·줄 번호를 stdout 에 찍는다', () => {
    const citation = 'task-' + '9' + '-report.md'
    const target = writeFixture('violation', citation)

    const run = runCitations(target)

    expect(run.status).toBe(1)
    expect(run.stdout).toContain(`${target}/sample.ts:1:`)
    expect(run.stdout).toContain(citation)
  })

  it('위반이 없으면 exit 0 이다', () => {
    const target = writeFixture('clean', '2026-09-08 실측 - 세 백엔드 다 200 이다.')

    expect(runCitations(target).status).toBe(0)
  })

  /**
   * 리뷰가 재현한 C-1 그 자체. `if grep …; then` 은 grep 의 **오류(2)** 를
   * "매치 없음"으로 읽어, 대상 하나가 사라지면 게이트가 조용히 초록이었다.
   */
  it('대상이 실재하지 않으면 exit 1 이다 - grep 의 오류를 "매치 없음"으로 읽지 않는다', () => {
    const run = runCitations('사라진-대상')

    expect(run.status).toBe(1)
    expect(run.stderr).toContain('grep 이 오류')
  })

  it('깨끗한 대상과 없는 대상을 섞어 줘도 exit 1 이다', () => {
    const target = writeFixture('clean-mixed', '근거는 사실 문장으로 적는다.')

    const run = runCitations(target, '사라진-대상')

    expect(run.status).toBe(1)
    expect(run.stderr).toContain('grep 이 오류')
  })

  it('위반이 있는 대상과 없는 대상을 섞어 줘도 초록이 되지 않는다', () => {
    const target = writeFixture('violation-mixed', '.super' + 'powers/' + 'sdd/2026-01-01-x/y.md')

    expect(runCitations('사라진-대상', target).status).toBe(1)
  })

  it('인자를 하나도 주지 않으면 아무것도 훑지 않고 죽는다 - 조용한 기본값이 없다', () => {
    const run = runCitations()

    expect(run.status).toBe(1)
    expect(run.stderr).toContain('사용법')
  })

  for (const [index, [label, citation]] of FORBIDDEN_CITATIONS.entries()) {
    it(`금지 갈래를 잡는다: ${label}`, () => {
      const target = writeFixture(`forbidden-${String(index)}`, citation)

      const run = runCitations(target)

      expect(run.status).toBe(1)
      expect(run.stdout).toContain(citation)
    })
  }

  for (const [index, citation] of ALLOWED_CITATIONS.entries()) {
    it(`허용되는 인용은 통과시킨다: ${citation}`, () => {
      const target = writeFixture(`allowed-${String(index)}`, citation)

      expect(runCitations(target).status).toBe(0)
    })
  }

  it('게이트가 여섯 대상을 그대로 넘긴다 - 두 자리를 함께 고쳐야 한다', () => {
    expect([...citationTargetsInGate()].sort()).toEqual([...GATE_TARGETS].sort())
  })

  it('게이트가 넘기는 여섯 대상이 저장소에 실재한다', () => {
    for (const target of GATE_TARGETS) {
      expect(existsSync(join(REPO_ROOT, target)), `${target} 가 저장소에 없다`).toBe(true)
    }
  })
})
