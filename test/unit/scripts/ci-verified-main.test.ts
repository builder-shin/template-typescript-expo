import { spawnSync } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BASH_TIMEOUT_MS, resolveBash } from '../support/bash'

const WORK = mkdtempSync(join(tmpdir(), 'ci-verified-main-'))
const SCRIPT = resolve('scripts/ci-verified-main.sh').replaceAll('\\', '/')
const RUN_URL = 'https://github.com/probe/template/actions/runs/36986123148'
let bash: string
let sequence = 0
beforeAll(() => {
  bash = resolveBash()
})
afterAll(() => rmSync(WORK, { recursive: true, force: true }))

interface Scene {
  event?: string
  ref?: string
  merge?: boolean
  commits?: string[]
  runs?: Record<string, string>
  differing?: string
  gitFailure?: 'head' | 'diff' | 'parent'
  apiFailure?: string
}

function executable(directory: string, name: string, body: string) {
  const file = join(directory, name)
  writeFileSync(file, `#!/bin/sh\n${body}\n`)
  chmodSync(file, 0o755)
}

/** git/gh만 바꾸고 실제 스크립트를 돈다. gh 경계의 응답은 실행 나이(초)와 URL이다. */
function run(scene: Scene = {}) {
  const directory = join(WORK, String(++sequence))
  mkdirSync(directory)
  const commits = scene.commits ?? ['branch-tip']
  const head = scene.merge === false ? commits[0] : 'main-merge'
  const parents = scene.merge === false ? `${head} old-main` : `${head} old-main ${commits[0]}`
  const gitCases = commits.flatMap((commit, index) => [
    `'diff --quiet ${commit} HEAD -- . :(exclude)docs') exit ${scene.gitFailure === 'diff' ? 128 : scene.differing === commit ? 1 : 0} ;;`,
    `'rev-parse --verify ${commit}^1') ${scene.gitFailure === 'parent' || commits[index + 1] === undefined ? 'exit 128' : `echo '${commits[index + 1]}'`} ;;`,
  ])
  executable(
    directory,
    'git',
    `echo "git $*" >> calls.log
case "$*" in
  'rev-list --parents -n 1 HEAD') ${scene.gitFailure === 'head' ? 'exit 128' : `echo '${parents}'`} ;;
  ${gitCases.join('\n  ')}
  *) exit 99 ;;
esac`,
  )
  const ghCases = commits.map(
    (commit) =>
      `'repos/probe/template/actions/workflows/ci.yml/runs?head_sha=${commit}&event=push&status=success') ${scene.apiFailure === commit ? 'exit 17' : `printf '%s' '${scene.runs?.[commit] ?? ''}'`} ;;`,
  )
  executable(
    directory,
    'gh',
    `echo "gh $1 $2" >> calls.log
[ "$1" = api ] && [ "$3" = --jq ] || exit 98
case "$2" in
  ${ghCases.join('\n  ')}
  *) exit 99 ;;
esac`,
  )
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    GITHUB_EVENT_NAME: scene.event ?? 'push',
    GITHUB_REF: scene.ref ?? 'refs/heads/main',
    GITHUB_REPOSITORY: 'probe/template',
    GITHUB_OUTPUT: join(directory, 'output').replaceAll('\\', '/'),
    GH_TOKEN: 'probe-token',
  }
  delete env.BASH_ENV
  const result = spawnSync(
    bash,
    ['-c', 'export PATH="$PWD:$PATH"; exec bash "$1"', 'probe', SCRIPT],
    { cwd: directory, env, encoding: 'utf8', timeout: BASH_TIMEOUT_MS },
  )
  expect(result.status, result.stderr).toBe(0)
  const output = readFileSync(join(directory, 'output'), 'utf8')
  const calls = spawnSync(bash, ['-c', '[ ! -f calls.log ] || cat calls.log'], {
    cwd: directory,
    encoding: 'utf8',
    timeout: BASH_TIMEOUT_MS,
  }).stdout
  return { output, stdout: result.stdout, calls }
}

describe('main에서 이미 검증한 코드의 CI 생략', () => {
  it.each([
    { event: 'push', ref: 'refs/heads/feature' },
    { event: 'pull_request', ref: 'refs/pull/42/merge' },
    { event: 'pull_request', ref: 'refs/heads/main' },
  ])('$event $ref는 API나 git 없이 전체 CI를 돈다', (scene) => {
    expect(run(scene)).toEqual({ output: 'skip=false\n', stdout: '', calls: '' })
  })

  it('merge의 둘째 부모에 최근 성공 실행이 있으면 commit과 URL을 알리고 생략한다', () => {
    const result = run({ runs: { 'branch-tip': `3600\t${RUN_URL}` } })
    expect(result.output).toBe('skip=true\n')
    expect(result.stdout).toContain('::notice::')
    expect(result.stdout).toContain('branch-tip')
    expect(result.stdout).toContain(RUN_URL)
    expect(result.calls).not.toContain('head_sha=main-merge')
  })

  it('D8처럼 docs tip e75c75a 아래 f05c9d3의 성공 실행 36986123148을 찾는다', () => {
    const result = run({
      commits: ['e75c75a', 'f05c9d3'],
      runs: { f05c9d3: `7200\t${RUN_URL}` },
    })
    expect(result.output).toBe('skip=true\n')
    expect(result.stdout).toContain('f05c9d3')
    expect(result.stdout).toContain(RUN_URL)
    expect(result.calls).toContain('head_sha=e75c75a')
    expect(result.calls).toContain('head_sha=f05c9d3')
  })

  it('docs 밖이 다르면 그 commit의 API와 더 오래된 부모를 보지 않는다', () => {
    const result = run({
      commits: ['branch-tip', 'verified-parent'],
      differing: 'branch-tip',
      runs: { 'verified-parent': `3600\t${RUN_URL}` },
    })
    expect(result.output).toBe('skip=false\n')
    expect(result.calls).not.toContain('gh ')
    expect(result.calls).not.toContain('rev-parse')
  })

  it.each([86401, 90000, -1])('성공 실행 나이가 %s초면 생략하지 않는다', (age) => {
    const result = run({ runs: { 'branch-tip': `${age}\t${RUN_URL}` } })
    expect(result.output).toBe('skip=false\n')
    expect(result.stdout).toBe('')
  })

  it('24시간 경계 안의 실행은 오래된 실행 뒤에 있어도 찾는다', () => {
    expect(run({ runs: { 'branch-tip': `86401\t${RUN_URL}\n86400\t${RUN_URL}` } }).output).toBe(
      'skip=true\n',
    )
  })

  it('성공 실행이 없으면 전체 CI를 돈다', () => {
    expect(run().output).toBe('skip=false\n')
  })

  it('API 오류면 성공 실행이 있는 부모까지 내려가지 않는다', () => {
    const result = run({
      commits: ['branch-tip', 'verified-parent'],
      apiFailure: 'branch-tip',
      runs: { 'verified-parent': `3600\t${RUN_URL}` },
    })
    expect(result.output).toBe('skip=false\n')
    expect(result.calls).not.toContain('head_sha=verified-parent')
  })

  it.each(['head', 'diff', 'parent'] as const)('git %s 오류면 전체 CI를 돈다', (gitFailure) => {
    expect(run({ gitFailure }).output).toBe('skip=false\n')
  })

  it('fast-forward HEAD 자체의 최근 branch 실행도 재사용한다', () => {
    const result = run({ merge: false, runs: { 'branch-tip': `120\t${RUN_URL}` } })
    expect(result.output).toBe('skip=true\n')
    expect(result.calls).toContain('head_sha=branch-tip')
    expect(result.calls).not.toContain('head_sha=old-main')
  })

  it('열 번째 commit은 검사하고 열한 번째 성공 실행에는 닿지 않는다', () => {
    const commits = Array.from({ length: 11 }, (_, index) => `commit-${index + 1}`)
    const atTen = run({ commits, runs: { 'commit-10': `120\t${RUN_URL}` } })
    expect(atTen.output).toBe('skip=true\n')
    const beyond = run({ commits, runs: { 'commit-11': `120\t${RUN_URL}` } })
    expect(beyond.output).toBe('skip=false\n')
    expect(beyond.calls.match(/gh api/g)).toHaveLength(10)
    expect(beyond.calls).not.toContain('head_sha=commit-11')
  })

  it.each([`bad-age\t${RUN_URL}`, '120\t'])('잘못된 API 응답 %s는 생략하지 않는다', (response) => {
    expect(run({ runs: { 'branch-tip': response } }).output).toBe('skip=false\n')
  })
})
