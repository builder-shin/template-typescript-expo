import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

/**
 * 복사 출처 기록 검사(스펙 6.3)를 잰다. 기록을 사람의 기억에 두면 다음 복사에서
 * 갱신되지 않는다 - 그래서 게이트가 검사한다.
 */
const SCRIPT = resolve('scripts/check-provenance.mjs')
const REPO_ROOT = resolve('.')

let root: string
let dir: string

beforeEach(() => {
  // 저장소(dir) 바깥에도 파일을 하나 둔다. '..' 로 그 파일을 가리키는 경로는 실재하므로,
  // 그런 경로가 실패하는 이유가 "없어서"가 아니라 "저장소 밖이라서"임을 잴 수 있다.
  root = mkdtempSync(join(tmpdir(), 'provenance-probe-'))
  dir = join(root, 'repo')
  mkdirSync(join(dir, 'lib'), { recursive: true })
  writeFileSync(join(dir, 'lib', 'copied.ts'), 'export {}\n')
  writeFileSync(join(root, 'outside.txt'), 'outside\n')
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

const VALID = {
  source: 'https://example.invalid/probe-source',
  commit: 'a'.repeat(40),
  copiedAt: '2026-09-30',
  paths: ['lib/copied.ts'],
  note: 'probe',
  divergences: [{ path: 'lib/copied.ts', what: 'probe what', why: 'probe why' }],
}

interface Result {
  status: number | null
  stdout: string
  stderr: string
}

function runFile(name: string): Result {
  const result = spawnSync(process.execPath, [SCRIPT, name], { cwd: dir, encoding: 'utf8' })
  return { status: result.status, stdout: result.stdout, stderr: result.stderr }
}

function runRaw(body: string): Result {
  writeFileSync(join(dir, 'record.json'), body)
  return runFile('record.json')
}

function run(record: unknown): Result {
  return runRaw(JSON.stringify(record))
}

describe('check-provenance', () => {
  it('올바른 기록은 통과한다', () => {
    expect(run(VALID).status).toBe(0)
  })

  it('기록 파일이 없으면 실패한다', () => {
    const result = spawnSync(process.execPath, [SCRIPT, 'missing.json'], {
      cwd: dir,
      encoding: 'utf8',
    })
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/읽지 못했다/)
  })

  it('commit 이 40자리 16진수가 아니면 실패한다', () => {
    const result = run({ ...VALID, commit: '34d0b10' })
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/commit/)
  })

  it('source 가 비면 실패한다', () => {
    const result = run({ ...VALID, source: ' ' })
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/source/)
  })

  it('paths 의 경로가 실재하지 않으면 실패한다', () => {
    const result = run({ ...VALID, paths: ['lib/copied.ts', 'lib/absent.ts'], divergences: [] })
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/lib\/absent\.ts/)
  })

  it('divergences 의 경로가 paths 에 없으면 실패한다', () => {
    const result = run({
      ...VALID,
      divergences: [{ path: 'lib/other.ts', what: 'probe what', why: 'probe why' }],
    })
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/lib\/other\.ts/)
  })

  it.each(['what', 'why'])('divergences 의 %s 가 비면 실패한다', (key) => {
    const result = run({
      ...VALID,
      divergences: [{ path: 'lib/copied.ts', what: 'probe what', why: 'probe why', [key]: '' }],
    })
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(new RegExp(key))
  })

  it('이 저장소의 실제 기록이 통과한다', () => {
    const result = spawnSync(process.execPath, [SCRIPT], { cwd: REPO_ROOT, encoding: 'utf8' })
    expect(result.stderr).toBe('')
    expect(result.status).toBe(0)
  })
})

/*
 * 위 시험들은 각 검사가 "있는가"만 잰다. 검사기의 계약은 그보다 강하다 - 어떤 잘못된
 * 입력에도 잡히지 않은 예외로 죽지 않고, 틀린 것을 **전부** 나열하고, 건수를 머리말에
 * 적는다. 아래는 그 계약과 각 검사의 경계를 잰다. 검사를 하나 빼거나 느슨하게 바꾸면
 * (첫 문제에서 끝내기, 정규식 앵커나 trim() 빼기, 첫 항목만 검사하기 등) 어느 시험이든
 * 실패하도록, 통과해야 할 입력과 거절해야 할 입력을 경계 양쪽에서 든다.
 */

/** 잡히지 않은 예외의 흔적. 검사기는 어떤 입력에도 문제 목록으로 답해야 한다. */
const STACK_TRACE = /TypeError|ReferenceError|SyntaxError|^\s+at /m

/** stderr 에서 문제 목록("- " 로 시작하는 줄)만 뽑는다. */
function listed(stderr: string): string[] {
  return stderr.split('\n').filter((line) => line.startsWith('- '))
}

/**
 * 실패로 끝났고, 머리말에 건수와 검사한 파일이 적히고, 목록이 patterns 와 개수·순서까지
 * 같고, 스택 트레이스가 없음을 재다. "전부 나열한다"는 계약이라 하나가 있는지가 아니라
 * 정확히 몇 줄인지를 잰다.
 */
function expectListed(result: Result, patterns: RegExp[]): void {
  expect(result.status).toBe(1)
  expect(result.stderr).not.toMatch(STACK_TRACE)
  expect(result.stderr).toMatch(new RegExp(`위반 ${patterns.length}건 \\(record\\.json\\):`))
  const lines = listed(result.stderr)
  expect(lines).toHaveLength(patterns.length)
  patterns.forEach((pattern, index) => {
    expect(lines[index]).toMatch(pattern)
  })
}

describe('check-provenance: 잘못된 입력도 문제 목록으로 답한다', () => {
  it.each([
    ['깨진 JSON', '{ "source": '],
    ['빈 파일', ''],
  ])('기록 파일이 %s 이면 읽지 못했다고만 실패한다', (_label, body) => {
    const result = runRaw(body)
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/읽지 못했다: record\.json/)
    // 읽지 못한 기록에 대해 "위반 N건" 목록까지 이어서 적지 않는다.
    expect(result.stderr).not.toMatch(/위반/)
    expect(result.stderr).not.toMatch(STACK_TRACE)
  })

  it('기록 파일이 없으면 읽지 못했다고만 실패한다', () => {
    const result = runFile('missing.json')
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/읽지 못했다: missing\.json/)
    expect(result.stderr).not.toMatch(/위반/)
    expect(result.stderr).not.toMatch(STACK_TRACE)
  })

  it.each([
    ['null', 'null'],
    ['배열', '[]'],
    ['숫자', '42'],
    ['문자열', '"text"'],
    ['불리언', 'true'],
  ])('최상위가 %s 이면 위반 1건으로 실패한다', (_label, body) => {
    expectListed(runRaw(body), [/최상위가 객체가 아니다/])
  })

  it('위반이 여럿이면 건수를 머리말에 적고 전부 나열한다', () => {
    const result = run({
      source: ' ',
      commit: 'xyz',
      paths: ['lib/copied.ts', 'lib/absent.ts'],
      divergences: [{ path: 'lib/other.ts', what: '', why: 'probe why' }],
    })
    expectListed(result, [
      /source/,
      /commit/,
      /lib\/absent\.ts/,
      /divergences\[0\]\.path/,
      /divergences\[0\]\.what/,
    ])
  })

  it('통과하면 경로와 이탈의 개수를 stdout 에 적고 stderr 는 비운다', () => {
    // 경로 수와 이탈 수가 달라야 둘을 바꿔 쓰는 실수가 드러난다.
    writeFileSync(join(dir, 'lib', 'second.ts'), 'export {}\n')
    const result = run({ ...VALID, paths: ['lib/copied.ts', 'lib/second.ts'] })
    expect(result.status).toBe(0)
    expect(result.stderr).toBe('')
    expect(result.stdout).toMatch(/경로 2개, 이탈 1건/)
  })
})

describe('check-provenance: source', () => {
  it.each([
    ['빈 문자열', ''],
    ['누락', undefined],
    ['숫자', 42],
    ['null', null],
  ])('source 가 %s 이면 실패한다', (_label, source) => {
    expectListed(run({ ...VALID, source }), [/source/])
  })
})

describe('check-provenance: commit', () => {
  it.each([
    ['41자리', 'a'.repeat(41)],
    ['39자리', 'a'.repeat(39)],
    ['16진수가 아닌 40자리', 'g'.repeat(40)],
    ['앞에 쓰레기가 붙은 40자리', `zz${'a'.repeat(40)}`],
    ['뒤에 쓰레기가 붙은 40자리', `${'a'.repeat(40)}zz`],
    ['대문자 16진수 40자리', 'A'.repeat(40)],
    ['숫자', 12345],
    ['40자리 문자열을 품은 배열', ['a'.repeat(40)]],
    ['누락', undefined],
  ])('commit 이 %s 이면 실패한다', (_label, commit) => {
    expectListed(run({ ...VALID, commit }), [/commit/])
  })
})

describe('check-provenance: paths', () => {
  it.each([
    ['문자열', 'lib/copied.ts'],
    ['누락', undefined],
    ['null', null],
    ['객체', { 'lib/copied.ts': true }],
  ])('paths 가 %s 이면 배열이 아니라고 실패한다', (_label, paths) => {
    expectListed(run({ ...VALID, paths, divergences: [] }), [/paths 가 배열이 아니다/])
  })

  it.each([
    ['숫자', 42],
    ['null', null],
    ['배열', ['lib/copied.ts']],
  ])('paths 의 항목이 %s 이면 문자열이 아니라고 실패한다', (_label, entry) => {
    const result = run({ ...VALID, paths: ['lib/copied.ts', entry] })
    expectListed(result, [/paths 의 항목이 문자열이 아니다/])
  })

  it.each([
    ['저장소 밖을 가리키는', '../outside.txt'],
    ['저장소 안으로 되돌아오는', 'lib/../lib/copied.ts'],
    ['역슬래시로 구분한', '..\\outside.txt'],
  ])("paths 의 %s '..' 경로는 실재해도 실패한다", (_label, path) => {
    const result = run({ ...VALID, paths: ['lib/copied.ts', path] })
    expectListed(result, [/'\.\.' 구간/])
  })

  it('paths 의 절대 경로는 실재해도 실패한다', () => {
    const absolute = resolve(dir, 'lib', 'copied.ts')
    const result = run({ ...VALID, paths: ['lib/copied.ts', absolute] })
    expectListed(result, [/절대 경로/])
  })

  it('paths 의 경로가 디렉터리면 실패한다', () => {
    const result = run({ ...VALID, paths: ['lib/copied.ts', 'lib'] })
    expectListed(result, [/파일이 아니다/])
  })
})

describe('check-provenance: divergences', () => {
  it.each([
    ['문자열', 'lib/copied.ts'],
    ['누락', undefined],
    ['null', null],
    ['객체', {}],
  ])('divergences 가 %s 이면 배열이 아니라고 실패한다', (_label, divergences) => {
    expectListed(run({ ...VALID, divergences }), [/divergences 가 배열이 아니다/])
  })

  it('divergences 의 둘째 항목도 검사한다', () => {
    const first = { path: 'lib/copied.ts', what: 'probe what', why: 'probe why' }
    const result = run({ ...VALID, divergences: [first, { ...first, why: '' }] })
    expectListed(result, [/divergences\[1\]\.why/])
  })

  it.each(['what', 'why'])('divergences 의 %s 가 공백뿐이면 실패한다', (key) => {
    const entry = { path: 'lib/copied.ts', what: 'probe what', why: 'probe why', [key]: ' \t ' }
    expectListed(run({ ...VALID, divergences: [entry] }), [
      new RegExp(`divergences\\[0\\]\\.${key}`),
    ])
  })

  it.each([
    ['숫자', 42],
    ['null', null],
    ['누락', undefined],
  ])('divergences 의 what 이 %s 이면 스택 트레이스 없이 나열한다', (_label, what) => {
    const entry = { path: 'lib/copied.ts', what, why: 'probe why' }
    expectListed(run({ ...VALID, divergences: [entry] }), [/divergences\[0\]\.what/])
  })

  it('divergences 의 항목이 null 이면 스택 트레이스 없이 나열한다', () => {
    const result = run({ ...VALID, divergences: [null] })
    expect(result.status).toBe(1)
    expect(result.stderr).not.toMatch(STACK_TRACE)
    expect(result.stderr).toMatch(/divergences\[0\]/)
  })
})
