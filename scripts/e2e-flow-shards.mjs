import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// 통합 CI의 플로 시작 간격에서 백엔드별 최대 시간을 재어 고정한 16·5 배정이다.
const INITIAL = [
  'auth-links cold-links contract-lab-signed-in examples-browse examples-delete examples-empty-notfound examples-scroll-refresh examples-sort-filter guard-return home-build-info login-error-en login-error-ko logout-from-protected register-conflict register-invalid register-restore-logout'.split(
    ' ',
  ),
  'contract-lab-anonymous examples-create examples-edit examples-invalid-filter-en examples-write-errors'.split(
    ' ',
  ),
]

/** @param {string} root @returns {string[]} */
export function iosFlowNames(root) {
  const directory = join(root, 'test/e2e/flows')
  return readdirSync(directory)
    .filter((file) => file.endsWith('.yaml'))
    .sort()
    .flatMap((file) => {
      const headers = readFileSync(join(directory, file), 'utf8')
        .split(/\r?\n/)
        .filter((line) => line.startsWith('# e2e-platforms'))
      if (headers.length === 0) return [file.slice(0, -5)]
      const platforms = headers[0].match(/^# e2e-platforms: (android|ios)(?: (android|ios))?\s*$/)
      if (headers.length !== 1 || platforms === null || platforms[1] === platforms[2])
        throw new Error(`${file}: 잘못된 e2e-platforms 머리말`)
      return platforms.slice(1).includes('ios') ? [file.slice(0, -5)] : []
    })
}

/** @param {readonly string[]} names @returns {[string[], string[]]} */
export function splitIosFlows(names) {
  if (
    names.length === 0 ||
    new Set(names).size !== names.length ||
    names.some((name) => !/^[a-z][a-z0-9-]*$/.test(name))
  )
    throw new Error('빈 목록·중복·잘못된 플로 이름')
  const allowed = new Set(names)
  /** @type {[string[], string[]]} */
  const shards = [
    INITIAL[0].filter((name) => allowed.has(name)),
    INITIAL[1].filter((name) => allowed.has(name)),
  ]
  const assigned = new Set(shards.flat())
  for (const name of [...names].sort()) {
    if (!assigned.has(name)) shards[shards[0].length <= shards[1].length ? 0 : 1].push(name)
  }
  shards.forEach((shard) => shard.sort())
  if (
    shards.some((shard) => shard.length === 0) ||
    new Set(shards.flat()).size !== names.length ||
    shards.flat().length !== names.length
  )
    throw new Error('빈 shard 또는 범위 불일치')
  return shards
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 3 || !['1', '2', '--manifest'].includes(process.argv[2]))
      throw new Error('사용법: node scripts/e2e-flow-shards.mjs 1|2|--manifest')
    const names = iosFlowNames(resolve('.'))
    const shards = splitIosFlows(names)
    console.log(
      process.argv[2] === '--manifest'
        ? JSON.stringify({ valid: true, count: names.length, shards })
        : shards[Number(process.argv[2]) - 1].join(' '),
    )
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
