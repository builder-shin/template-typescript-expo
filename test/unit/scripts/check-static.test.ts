import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BASH_TIMEOUT_MS, resolveBash } from '../support/bash'

/**
 * 게이트의 정적 모드(`./scripts/check.sh --static`)를 잰다 - CI 의 checks 잡이 [1]–[11] 만 돌 때 쓴다(스펙 13장).
 * 게이트 전체를 돌리지 않는다(분 단위이고, 인자를 읽지 못하는 판이면 모르는 인자로도 게이트 전부가 돈다). 인자를
 * 읽는 `case` 블록만 떼어 돌리고, 정적 모드가 멈추는 자리가 [11] 과 [12] 사이인지 소스에서 본다 - 그보다 앞이면
 * 정적 단계를 빼먹고, 뒤면 백엔드·기기가 없는 CI 잡이 멈춘다.
 */

const SOURCE = readFileSync(resolve('scripts/check.sh'), 'utf8')

/** 인자 개수와 첫 값을 읽는 블록 - `case "$#:${1:-}" in` 부터 `esac` 까지. */
const ARGUMENTS = /^case "\$#:\$\{1:-\}" in$[\s\S]*?^esac$/m

/** 인자 블록만 그 인자로 돌리고 정한 모드를 낸다. */
function parse(...args: string[]) {
  const block = ARGUMENTS.exec(SOURCE)?.[0]
  if (block === undefined) throw new Error('scripts/check.sh 에 인자를 읽는 case 블록이 없다')
  return spawnSync(
    resolveBash(),
    ['-c', `${block}\nprintf '%s' "$static_only"`, 'check.sh', ...args],
    {
      encoding: 'utf8',
      timeout: BASH_TIMEOUT_MS,
    },
  )
}

describe('scripts/check.sh 의 인자', () => {
  it('인자가 없으면 게이트 전부다', () => {
    const run = parse()
    expect(run.status).toBe(0)
    expect(run.stdout).toBe('0')
  })

  it('--static 이면 정적 단계만이다', () => {
    const run = parse('--static')
    expect(run.status).toBe(0)
    expect(run.stdout).toBe('1')
  })

  it('모르는 인자는 사용법과 함께 exit 2 다 - 게이트가 조용히 전부나 일부를 돌지 않는다', () => {
    const run = parse('--probe-lab-unknown')
    expect(run.status).toBe(2)
    expect(run.stderr).toContain('--static')
  })

  it.each([
    { args: ['--static', '--probe'] },
    { args: ['--static', '--static'] },
    { args: [''] },
    { args: ['', '--static'] },
  ])('추가·중복·빈 인자 $args 는 사용법과 함께 exit 2 다', ({ args }) => {
    const run = parse(...args)
    expect(run.status).toBe(2)
    expect(run.stderr).toBe('사용법: check.sh [--static]\n')
    expect(run.stdout).toBe('')
  })

  it('인자 블록은 첫 단계보다 앞이다', () => {
    const block = SOURCE.search(ARGUMENTS)
    expect(block).toBeGreaterThan(-1)
    expect(block).toBeLessThan(SOURCE.indexOf('echo "=== [1/13] typecheck ==="'))
  })

  it('--static 은 [11] 뒤, [12] 앞에서 통과로 끝난다', () => {
    const step11 = SOURCE.indexOf('echo "=== [11/13] compose ==="')
    const exit = SOURCE.indexOf('if [ "$static_only" -eq 1 ]; then')
    const step12 = SOURCE.indexOf('echo "=== [12/13] 계약 거울 ==="')
    expect(step11).toBeGreaterThan(-1)
    expect(step12).toBeGreaterThan(-1)
    expect(exit).toBeGreaterThan(step11)
    expect(exit).toBeLessThan(step12)
    expect(SOURCE.slice(exit, step12)).toContain('exit 0')
  })
})
