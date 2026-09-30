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

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'provenance-probe-'))
  mkdirSync(join(dir, 'lib'), { recursive: true })
  writeFileSync(join(dir, 'lib', 'copied.ts'), 'export {}\n')
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

const VALID = {
  source: 'https://example.invalid/probe-source',
  commit: 'a'.repeat(40),
  copiedAt: '2026-09-30',
  paths: ['lib/copied.ts'],
  note: 'probe',
  divergences: [{ path: 'lib/copied.ts', what: 'probe what', why: 'probe why' }],
}

function run(record: unknown): { status: number | null; stderr: string } {
  writeFileSync(join(dir, 'record.json'), JSON.stringify(record))
  const result = spawnSync(process.execPath, [SCRIPT, 'record.json'], {
    cwd: dir,
    encoding: 'utf8',
  })
  return { status: result.status, stderr: result.stderr }
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
