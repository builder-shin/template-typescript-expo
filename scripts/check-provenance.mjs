#!/usr/bin/env node
/**
 * 복사 출처 기록을 검사한다(스펙 6.3). 게이트가 부른다.
 *
 *   node scripts/check-provenance.mjs [기록 파일]
 *
 * 기록 파일의 기본값은 docs/provenance/copied-core.json 이고, 경로는 전부 현재
 * 디렉터리 기준이다. 종료 코드: 0 = 통과, 1 = 위반(무엇이 틀렸는지 stderr 에 전부 적는다).
 *
 * 스펙은 이 검사를 check-provenance.sh 로 적었지만 JSON 을 읽어야 해서 node 로 쓴다.
 */
import { existsSync, readFileSync } from 'node:fs'

const file = process.argv[2] ?? 'docs/provenance/copied-core.json'

let record
try {
  record = JSON.parse(readFileSync(file, 'utf8'))
} catch (error) {
  const reason = error instanceof Error ? error.message : String(error)
  console.error(`복사 출처 기록을 읽지 못했다: ${file} (${reason})`)
  process.exit(1)
}

const problems = []

if (typeof record.source !== 'string' || record.source.trim() === '') {
  problems.push('source 가 비어 있다')
}
if (typeof record.commit !== 'string' || !/^[0-9a-f]{40}$/.test(record.commit)) {
  problems.push(`commit 이 40자리 16진수가 아니다: ${JSON.stringify(record.commit)}`)
}

const paths = Array.isArray(record.paths) ? record.paths : []
if (!Array.isArray(record.paths)) problems.push('paths 가 배열이 아니다')
for (const path of paths) {
  if (typeof path !== 'string' || !existsSync(path)) {
    problems.push(`paths 의 경로가 실재하지 않는다: ${JSON.stringify(path)}`)
  }
}

const divergences = Array.isArray(record.divergences) ? record.divergences : []
if (!Array.isArray(record.divergences)) problems.push('divergences 가 배열이 아니다')
divergences.forEach((divergence, index) => {
  if (!paths.includes(divergence?.path)) {
    problems.push(
      `divergences[${index}].path 가 paths 에 없다: ${JSON.stringify(divergence?.path)}`,
    )
  }
  for (const key of ['what', 'why']) {
    const value = divergence?.[key]
    if (typeof value !== 'string' || value.trim() === '') {
      problems.push(`divergences[${index}].${key} 가 비어 있다`)
    }
  }
})

if (problems.length > 0) {
  console.error(`복사 출처 기록 위반 ${problems.length}건 (${file}):`)
  for (const problem of problems) console.error(`- ${problem}`)
  process.exit(1)
}

console.log(`복사 출처 기록 통과: 경로 ${paths.length}개, 이탈 ${divergences.length}건`)
