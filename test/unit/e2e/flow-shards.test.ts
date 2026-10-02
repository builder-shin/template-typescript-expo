import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { iosFlowNames, splitIosFlows } from '../../../scripts/e2e-flow-shards.mjs'

const LONG =
  'auth-links cold-links contract-lab-signed-in examples-browse examples-delete examples-empty-notfound examples-scroll-refresh examples-sort-filter guard-return home-build-info login-error-en login-error-ko logout-from-protected register-conflict register-invalid register-restore-logout'.split(
    ' ',
  )
const SHORT =
  'contract-lab-anonymous examples-create examples-edit examples-invalid-filter-en examples-write-errors'.split(
    ' ',
  )
const WORK = mkdtempSync(join(tmpdir(), 'flow-shards-'))
afterAll(() => rmSync(WORK, { recursive: true, force: true }))
function cli(...args: string[]) {
  return spawnSync(process.execPath, [resolve('scripts/e2e-flow-shards.mjs'), ...args], {
    encoding: 'utf8',
    timeout: 30_000,
  })
}

describe('iOS 플로 shard의 범위', () => {
  it('실제 iOS 21개를 읽고 Android 전용 둘을 제외한다', () => {
    expect(iosFlowNames(resolve('.'))).toEqual([...LONG, ...SHORT].sort())
  })
  it('합집합은 정확히 허용 목록이며 초기 16·5 배정이 시간 기반 목록과 같다', () => {
    const shards = splitIosFlows(iosFlowNames(resolve('.')))
    expect(shards).toEqual([LONG, SHORT])
    expect(shards.flat().sort()).toEqual(iosFlowNames(resolve('.')))
  })
  it('두 shard는 교집합이 없다', () => {
    const [one, two] = splitIosFlows(iosFlowNames(resolve('.')))
    expect(one.filter((name) => two.includes(name))).toEqual([])
  })
  it('입력 순서는 배정을 바꾸지 않는다', () => {
    expect(splitIosFlows([...LONG, ...SHORT].reverse())).toEqual([LONG, SHORT])
  })
  it('각 shard의 CLI는 이름순 한 줄이다', () => {
    expect(cli('1').stdout).toBe(`${LONG.join(' ')}\n`)
    expect(cli('2').stdout).toBe(`${SHORT.join(' ')}\n`)
  })
  it('cold-links는 shard 1에서 한 번 돈다', () => {
    const shards = splitIosFlows(iosFlowNames(resolve('.')))
    expect(shards[0]).toContain('cold-links')
    expect(shards[1]).not.toContain('cold-links')
  })
  it('잘못된 플랫폼 머리말은 후보를 만들지 않고 실패한다', () => {
    mkdirSync(join(WORK, 'test/e2e/flows'), { recursive: true })
    for (const header of [
      '# e2e-platforms: windows',
      '# e2e-platforms:',
      '# e2e-platforms: ios\n# e2e-platforms: android',
    ]) {
      writeFileSync(join(WORK, 'test/e2e/flows/probe.yaml'), `${header}\nappId: probe\n---\n`)
      expect(() => iosFlowNames(WORK)).toThrow()
    }
  })
  it('잘못된 shard 인자는 exit 1이고 출력이 비어 있다', () => {
    for (const args of [[], ['0'], ['3'], ['1', '2']]) {
      const result = cli(...args)
      expect(result.status).toBe(1)
      expect(result.stdout).toBe('')
    }
  })
  it('빈 입력·빈 shard·중복 이름은 실패한다', () => {
    for (const names of [[], ['cold-links'], ['cold-links', 'cold-links']])
      expect(() => splitIosFlows(names)).toThrow()
  })
  it('새 iOS 플로는 이름순으로 적은 쪽에 한 번 배정하고 삭제도 반영한다', () => {
    const input = [...LONG.filter((name) => name !== 'auth-links'), ...SHORT, 'new-z', 'new-a']
    const [one, two] = splitIosFlows(input.reverse())
    expect(one).toEqual(LONG.filter((name) => name !== 'auth-links'))
    expect(two).toEqual([...SHORT, 'new-a', 'new-z'].sort())
    expect([...one, ...two].sort()).toEqual(input.sort())
    const manifest = JSON.parse(cli('--manifest').stdout) as {
      valid: boolean
      count: number
      shards: string[][]
    }
    expect(manifest).toEqual({ valid: true, count: 21, shards: [LONG, SHORT] })
  })
})
