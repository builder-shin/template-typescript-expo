/**
 * 복사 출처 기록을 검사한다(스펙 6.3). 게이트가 부른다.
 *
 *   node scripts/check-provenance.mjs [기록 파일]
 *
 * 기록 파일의 기본값은 docs/provenance/copied-core.json 이고, 경로는 전부 현재
 * 디렉터리 기준이다. paths 는 저장소 안의 일반 파일이어야 한다 - 절대 경로, 드라이브 문자로
 * 시작하는 경로(C:..\x), '..' 구간이 있는 경로는 저장소 밖의 파일도 "실재"하게 만들므로
 * 실재하더라도 막는다. 종료 코드: 0 = 통과, 1 = 위반(무엇이 틀렸는지 stderr 에 전부 적는다).
 *
 * 형식만 보면 그대로 복사한 파일을 고치고 이탈을 적지 않아도 통과한다. 그래서 divergences 가
 * 없는 경로는 sourceBlobs 에 원본 파일의 git blob SHA-1 을 적고, 작업 트리의 파일이 그 값과
 * 같아야 한다. 값은 git 이 저장할 내용으로 잰다 - 작업 트리의 바이트에서 CRLF 를 LF 로 바꾼
 * 것이다. .gitattributes 의 `* text=auto eol=lf` 가 체크아웃을 LF 로 두고 add 할 때 CRLF 를
 * LF 로 바꿔 저장하므로, 편집기가 줄 끝을 CRLF 로 저장한 사본도 내용이 같으면 원본 그대로다
 * (`git hash-object <경로>` 와 같은 값이다). 이탈이 있는 경로는 원본과 같을 수 없으므로
 * sourceBlobs 에 두지 않는다.
 *
 * 스펙은 이 검사를 check-provenance.sh 로 적었지만 JSON 을 읽어야 해서 node 로 쓴다.
 */
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { isAbsolute } from 'node:path'

const file = process.argv[2] ?? 'docs/provenance/copied-core.json'
const SHA1 = /^[0-9a-f]{40}$/

let record
try {
  record = JSON.parse(readFileSync(file, 'utf8'))
} catch (error) {
  const reason = error instanceof Error ? error.message : String(error)
  console.error(`복사 출처 기록을 읽지 못했다: ${file} (${reason})`)
  process.exit(1)
}

// 최상위가 객체가 아니면 아래의 record.source 부터 잡히지 않은 예외로 죽는다.
if (record === null || typeof record !== 'object' || Array.isArray(record)) {
  console.error(`복사 출처 기록 위반 1건 (${file}):`)
  console.error('- 최상위가 객체가 아니다')
  process.exit(1)
}

const problems = []

if (typeof record.source !== 'string' || record.source.trim() === '') {
  problems.push('source 가 비어 있다')
}
if (typeof record.commit !== 'string' || !SHA1.test(record.commit)) {
  problems.push(`commit 이 40자리 16진수가 아니다: ${JSON.stringify(record.commit)}`)
}

const paths = Array.isArray(record.paths) ? record.paths : []
if (!Array.isArray(record.paths)) problems.push('paths 가 배열이 아니다')
// 저장소 안의 실재하는 파일로 확인된 경로. 내용 검사는 이 경로만 한다.
const files = []
for (const path of paths) {
  if (typeof path !== 'string') {
    problems.push(`paths 의 항목이 문자열이 아니다: ${JSON.stringify(path)}`)
  } else if (isAbsolute(path)) {
    problems.push(
      `paths 의 경로가 절대 경로다(저장소 기준 상대 경로여야 한다): ${JSON.stringify(path)}`,
    )
  } else if (/^[A-Za-z]:/.test(path)) {
    // Windows 의 드라이브 상대 경로(C:..\x)는 절대 경로가 아니고 '..' 구간도 없어(첫 구간이 C:..)
    // 아래 검사를 지나지만, 그 드라이브의 현재 디렉터리 기준이라 저장소 밖을 가리킬 수 있다.
    problems.push(
      `paths 의 경로가 드라이브 문자로 시작한다(저장소 기준 상대 경로여야 한다): ${JSON.stringify(path)}`,
    )
  } else if (path.split(/[\\/]/).includes('..')) {
    problems.push(
      `paths 의 경로에 '..' 구간이 있다(저장소 안으로 정규화해야 한다): ${JSON.stringify(path)}`,
    )
  } else if (!existsSync(path)) {
    problems.push(`paths 의 경로가 실재하지 않는다: ${JSON.stringify(path)}`)
  } else if (!statSync(path).isFile()) {
    problems.push(`paths 의 경로가 파일이 아니다: ${JSON.stringify(path)}`)
  } else {
    files.push(path)
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

/**
 * git 이 add 할 때 이 파일에 하는 줄 끝 정규화 - CRLF 를 LF 로 바꾼다. NUL 이나 홀로 선 CR 이
 * 있으면 git 은 이진으로 보고 바꾸지 않으므로 그런 파일은 그대로 둔다(이미지 같은 이진 사본은
 * 우연히 든 CRLF 도 원본 그대로여야 한다). 바이트를 1:1 로 다루려고 latin1 로 읽는다.
 */
function toStored(content) {
  const text = content.toString('latin1')
  if (content.includes(0) || /\r(?!\n)/.test(text)) return content
  return Buffer.from(text.replaceAll('\r\n', '\n'), 'latin1')
}

/** git 이 이 파일 내용으로 저장할 blob 의 SHA-1 - `git hash-object <경로>` 와 같은 계산이다. */
function blobSha(path) {
  const content = toStored(readFileSync(path))
  return createHash('sha1').update(`blob ${content.length}\0`).update(content).digest('hex')
}

// sourceBlobs 가 없으면 빈 표로 본다 - 이탈이 없는 경로가 하나라도 있으면 아래에서 걸린다.
const blobs = record.sourceBlobs === undefined ? {} : record.sourceBlobs
const blobsIsTable = blobs !== null && typeof blobs === 'object' && !Array.isArray(blobs)
let unchanged = 0
if (!blobsIsTable) {
  problems.push('sourceBlobs 가 객체가 아니다')
} else {
  for (const [path, sha] of Object.entries(blobs)) {
    if (!paths.includes(path)) {
      problems.push(`sourceBlobs 의 경로가 paths 에 없다: ${JSON.stringify(path)}`)
    } else if (typeof sha !== 'string' || !SHA1.test(sha)) {
      problems.push(
        `sourceBlobs[${JSON.stringify(path)}] 가 40자리 16진수가 아니다: ${JSON.stringify(sha)}`,
      )
    }
  }
  // divergences 를 읽지 못했으면 어느 경로가 원본 그대로인지 모른다 - 위에서 이미 걸렸다.
  if (Array.isArray(record.divergences)) {
    const diverged = new Set(divergences.map((divergence) => divergence?.path))
    for (const path of files) {
      const sha = Object.hasOwn(blobs, path) ? blobs[path] : undefined
      if (diverged.has(path)) {
        if (sha !== undefined) {
          problems.push(
            `이탈이 있는 경로가 sourceBlobs 에 있다(원본과 같을 수 없다 - 항목을 지운다): ${JSON.stringify(path)}`,
          )
        }
      } else if (sha === undefined) {
        problems.push(
          `이탈이 없는 경로에 원본 blob 이 없다(sourceBlobs 에 적는다): ${JSON.stringify(path)}`,
        )
      } else if (typeof sha === 'string' && SHA1.test(sha)) {
        const actual = blobSha(path)
        if (actual === sha) {
          unchanged += 1
        } else {
          problems.push(
            `원본과 다르다 - 이탈을 적거나 원본으로 되돌린다: ${JSON.stringify(path)} (원본 ${sha}, 작업 트리 ${actual})`,
          )
        }
      }
    }
  }
}

if (problems.length > 0) {
  console.error(`복사 출처 기록 위반 ${problems.length}건 (${file}):`)
  for (const problem of problems) console.error(`- ${problem}`)
  process.exit(1)
}

console.log(
  `복사 출처 기록 통과: 경로 ${paths.length}개, 이탈 ${divergences.length}건, 원본 그대로 ${unchanged}개`,
)
