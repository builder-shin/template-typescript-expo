import { execFileSync, spawnSync } from 'node:child_process'
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

/**
 * git 이 content 에 매기는 blob SHA-1. 검사기의 계산을 되풀이하지 않고 git 에게 묻는다. 표준
 * 입력으로 읽으면 줄 끝 변환 없이 바이트 그대로 잰다 - 검사기가 하는 줄 끝 정규화는 넣지 않는다.
 */
function blobOf(content: string | Buffer): string {
  return execFileSync('git', ['hash-object', '--stdin'], {
    input: content,
    encoding: 'utf8',
  }).trim()
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
      // 이탈이 lib/other.ts 를 가리키므로 lib/copied.ts 는 원본 그대로여야 하는 경로다.
      /원본 blob 이 없다.*lib\/copied\.ts/,
    ])
  })

  it('통과하면 경로·이탈·원본 그대로인 사본의 개수를 stdout 에 적고 stderr 는 비운다', () => {
    // 세 수가 서로 달라야 둘을 바꿔 쓰는 실수가 드러난다.
    writeFileSync(join(dir, 'lib', 'second.ts'), 'export {}\n')
    writeFileSync(join(dir, 'lib', 'third.ts'), 'export const third = 3\n')
    const result = run({
      ...VALID,
      paths: ['lib/copied.ts', 'lib/second.ts', 'lib/third.ts'],
      sourceBlobs: {
        'lib/second.ts': blobOf('export {}\n'),
        'lib/third.ts': blobOf('export const third = 3\n'),
      },
    })
    expect(result.status).toBe(0)
    expect(result.stderr).toBe('')
    expect(result.stdout).toMatch(/경로 3개, 이탈 1건, 원본 그대로 2개/)
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

  // Windows 에서 C:..\x 는 절대 경로가 아니고 첫 구간이 'C:..' 라 '..' 검사도 지난다. 존재 검사보다
  // 먼저 거절하므로 Linux 에서도 같은 문구가 나온다.
  it.each([
    ['드라이브 상대 경로', 'C:..\\outside.txt'],
    ['드라이브를 붙인 저장소 경로', 'C:lib/copied.ts'],
  ])('paths 의 %s 는 드라이브 문자로 시작한다고 실패한다', (_label, path) => {
    const result = run({ ...VALID, paths: ['lib/copied.ts', path] })
    expectListed(result, [/드라이브 문자/])
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

/*
 * 형식만 보면 그대로 복사한 파일을 고치고 이탈을 적지 않아도 통과한다. 이탈이 없는 경로는
 * sourceBlobs 에 원본의 blob SHA-1 을 적고, 검사기가 작업 트리의 내용과 맞댄다.
 */
describe('check-provenance: sourceBlobs', () => {
  // lib/copied.ts 는 이탈이 있고(VALID), lib/second.ts 는 원본 그대로인 사본이다.
  const SECOND = 'export const second = 2\n'

  beforeEach(() => {
    writeFileSync(join(dir, 'lib', 'second.ts'), SECOND)
  })

  function withSecond(sourceBlobs: unknown): unknown {
    return { ...VALID, paths: ['lib/copied.ts', 'lib/second.ts'], sourceBlobs }
  }

  it('원본 그대로인 사본의 내용이 원본 blob 과 같으면 통과한다', () => {
    const result = run(withSecond({ 'lib/second.ts': blobOf(SECOND) }))
    expect(result.stderr).toBe('')
    expect(result.status).toBe(0)
    expect(result.stdout).toMatch(/원본 그대로 1개/)
  })

  it('내용이 원본과 다르면 두 SHA 를 적고 실패한다 - 이탈을 적지 않은 수정', () => {
    const original = blobOf('export const second = 1\n')
    const result = run(withSecond({ 'lib/second.ts': original }))
    expectListed(result, [/원본과 다르다.*lib\/second\.ts/])
    expect(result.stderr).toContain(`원본 ${original}, 작업 트리 ${blobOf(SECOND)}`)
  })

  it.each([
    ['항목이 없는', {}],
    ['표 자체가 없는', undefined],
  ])('이탈이 없는 경로의 원본 blob 이 %s 기록은 실패한다', (_label, sourceBlobs) => {
    expectListed(run(withSecond(sourceBlobs)), [/원본 blob 이 없다.*lib\/second\.ts/])
  })

  it('이탈이 있는 경로가 sourceBlobs 에 있으면 실패한다', () => {
    const result = run({ ...VALID, sourceBlobs: { 'lib/copied.ts': blobOf('export {}\n') } })
    expectListed(result, [/이탈이 있는 경로가 sourceBlobs 에 있다.*lib\/copied\.ts/])
  })

  it('sourceBlobs 의 경로가 paths 에 없으면 실패한다', () => {
    const result = run({ ...VALID, sourceBlobs: { 'lib/absent.ts': 'a'.repeat(40) } })
    expectListed(result, [/sourceBlobs 의 경로가 paths 에 없다.*lib\/absent\.ts/])
  })

  it.each([
    ['39자리', 'a'.repeat(39)],
    ['대문자', 'A'.repeat(40)],
    ['숫자', 42],
    ['null', null],
  ])('sourceBlobs 의 값이 %s 이면 형식 위반 하나로 실패한다', (_label, sha) => {
    expectListed(run(withSecond({ 'lib/second.ts': sha })), [
      /sourceBlobs\["lib\/second\.ts"\] 가 40자리 16진수가 아니다/,
    ])
  })

  it.each([
    ['배열', []],
    ['문자열', 'a'.repeat(40)],
    ['null', null],
  ])('sourceBlobs 가 %s 이면 객체가 아니라고 실패한다', (_label, sourceBlobs) => {
    expectListed(run({ ...VALID, sourceBlobs }), [/sourceBlobs 가 객체가 아니다/])
  })

  it('작업 트리의 blob 계산이 git hash-object 와 같다 - 한글과 여러 줄', () => {
    const content = '// 한글 주석\nexport const second = 2\n'
    writeFileSync(join(dir, 'lib', 'second.ts'), content)
    const sha = execFileSync('git', ['hash-object', join(dir, 'lib', 'second.ts')], {
      encoding: 'utf8',
    }).trim()
    expect(run(withSecond({ 'lib/second.ts': sha })).status).toBe(0)
  })

  /*
   * .gitattributes 의 `* text=auto eol=lf` 는 add 할 때 CRLF 를 LF 로 바꿔 저장한다. 편집기가 줄 끝을
   * CRLF 로 저장한 사본도 git 에게는 원본 그대로이므로 실패시키지 않는다. 다만 NUL 이나 홀로 선 CR 이
   * 있는 파일은 git 이 이진으로 보고 줄 끝을 바꾸지 않는다 - 그런 파일은 바이트 그대로 잰다.
   */
  it('줄 끝이 CRLF 여도 LF 로 바꾼 내용이 원본 blob 과 같으면 통과한다', () => {
    writeFileSync(join(dir, 'lib', 'second.ts'), SECOND.replaceAll('\n', '\r\n'))
    const result = run(withSecond({ 'lib/second.ts': blobOf(SECOND) }))
    expect(result.stderr).toBe('')
    expect(result.status).toBe(0)
    expect(result.stdout).toMatch(/원본 그대로 1개/)
  })

  it('줄 끝이 CRLF 이고 LF 로 바꾼 내용도 원본과 다르면 git 이 저장할 내용의 SHA 를 적고 실패한다', () => {
    writeFileSync(join(dir, 'lib', 'second.ts'), 'export const second = 3\r\n')
    const result = run(withSecond({ 'lib/second.ts': blobOf(SECOND) }))
    expectListed(result, [/원본과 다르다.*lib\/second\.ts/])
    expect(result.stderr).toContain(`작업 트리 ${blobOf('export const second = 3\n')}`)
  })

  it.each([
    ['NUL 이 있는', 'PNG\r\n\0data\r\n'],
    ['홀로 선 CR 이 있는', 'a\rb\r\n'],
  ])(
    '%s 파일은 git 이 이진으로 봐서 줄 끝을 바꾸지 않으므로 바이트 그대로 잰다',
    (_label, text) => {
      const content = Buffer.from(text)
      writeFileSync(join(dir, 'lib', 'second.ts'), content)
      expect(run(withSecond({ 'lib/second.ts': blobOf(content) })).status).toBe(0)
      // CRLF 를 LF 로 바꾼 내용을 원본으로 적으면 다르다 - 검사기가 바꾸지 않았다는 증거다.
      const normalized = blobOf(Buffer.from(text.replaceAll('\r\n', '\n')))
      expectListed(run(withSecond({ 'lib/second.ts': normalized })), [
        /원본과 다르다.*lib\/second\.ts/,
      ])
    },
  )
})
