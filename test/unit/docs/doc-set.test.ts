import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { posix } from 'node:path'
import { describe, expect, it } from 'vitest'

import { DEFAULT_APP_VARIANT } from '@/lib/config/app-variant'

/**
 * 문서군이 실제 파일과 일치한다(스펙 17장 조건 5) - 루트 README.md 와 모든 AGENTS.md 를 훑는다.
 *
 * 1. 인용한 경로가 있다. 마크다운 링크의 대상과, 저장소 경로처럼 생긴 인라인 코드(`lib/auth/`·`app.config.ts`)를
 *    잰다. 생성 디렉터리·외부 패키지 경로의 명시 목록만 제외한다(`node_modules/.bin/secretlint`·`.maestro-output/e2e`).
 *    알 수 없는 첫 조각도 오타나 삭제된 경로일 수 있으므로 검사한다. 파일 이름 하나(`screen-state.ts`)는 루트, 문서의
 *    디렉터리, 같은 문단에서 먼저 부른 경로의 디렉터리 가운데 한 곳에 있으면 된다 - `lib/resources/view.ts`·
 *    `screen-state.ts` 처럼 쓰는 이 저장소의 문체다. 코드 울타리 안의 명령은 재지 않는다(플래그·자리표시가 섞인다).
 * 2. AGENTS.md 는 자기 디렉터리의 바로 아래 항목(파일·디렉터리)을 전부 부른다 - 새 파일을 만들면 그 디렉터리의
 *    문서에 한 줄이 생겨야 게이트가 통과한다. 코드 울타리 안의 경로도 부른 것으로 친다. 루트 AGENTS.md 는
 *    디렉터리만 본다 - 루트의 파일은 README 와 각 파일의 머리말이 설명한다.
 * 3. 스펙 14장이 이름을 댄 문서가 있다.
 * 4. 환경 변수 이름은 .env.example·README 표를 맞대고, APP_VARIANT 기본값은 코드와도 맞댄다(스펙 10.1).
 *
 * 파일 목록은 git 이 커밋할 파일이다(추적하는 파일 + 무시되지 않은 새 파일) - .gitignore 가 버리는 것은 문서의
 * 대상이 아니다. 지웠지만 아직 커밋하지 않은 파일은 뺀다.
 */

const EXTENSION = /\.(ts|tsx|js|mjs|cjs|json|md|sh|ya?ml|sql|css|png)$/
// 자리표시(`<이름>`)·glob(`*`)·명령(공백·`=`)·URL(`:`)이 든 코드는 경로가 아니다.
const NOT_A_PATH = /[\s<>*{}$…=|?#%'",;:@\\]/

// .gitignore의 생성 디렉터리와 설치본/기기 번들의 생성 경로다. 추적된 항목이 있으면 제외하지 않는다.
const GENERATED_ROOTS = new Set([
  'node_modules',
  '.maestro-output',
  'android',
  'ios',
  'dist',
  '.expo',
  'coverage',
  'web-build',
  '.superpowers',
  'build',
  'EXConstants.bundle',
])
// 문서가 설명하는 외부 import와 액션 이름이다. 알 수 없는 첫 조각을 일반적으로 제외하지 않는다.
const EXTERNAL_NAMESPACES = new Set(['expo', 'firebase', 'astral-sh'])

/**
 * 저장소 밖의 경로를 이름 그대로 부르는 자리 - 원본 저장소·백엔드 저장소·액션 저장소의 파일과, 계층 표가 소유
 * 관계로 미리 적어 둔 빈 자리. 이 저장소의 파일이면 여기 적지 않고 문서의 경로를 고친다. 문서에서 사라진 항목은
 * 아래 시험이 알린다.
 */
const EXTERNAL: Readonly<Record<string, readonly string[]>> = {
  // 계층 표는 소유 관계라 아직 비어 있는 자리도 적는다 - React Native Reusables 가 훅을 받을 자리다.
  'AGENTS.md': ['components/hooks/'],
  // 백엔드 템플릿의 디렉터리와 원본(template-typescript-nextjs)의 파일
  'lib/jsonapi/AGENTS.md': ['app/jsonapi/', 'proxy.ts', 'app/error.tsx'],
  // 원본(template-typescript-nextjs)에서 실험실이 있던 자리
  'lib/lab/AGENTS.md': ['app/(lab)/contract/', 'actions.ts', 'page.tsx', 'result-view.tsx'],
  // 각 액션 저장소의 파일
  '.github/workflows/AGENTS.md': ['action.yml'],
  // 하네스가 단언하는 APK 안의 경로(android.sh build 가 unzip 으로 읽는다)
  'test/e2e/AGENTS.md': ['assets/app.config'],
}

/** 스펙 14장이 이름을 댄 문서. */
const SPEC_DOCS = [
  'README.md',
  'AGENTS.md',
  'lib/jsonapi/AGENTS.md',
  'lib/resources/AGENTS.md',
  'lib/auth/AGENTS.md',
  'platform/AGENTS.md',
  'queries/AGENTS.md',
  'app/AGENTS.md',
  'components/resource/AGENTS.md',
]

interface Tree {
  readonly files: ReadonlySet<string>
  readonly dirs: ReadonlySet<string>
}

function treeOf(paths: readonly string[]): Tree {
  const dirs = new Set<string>()
  for (const path of paths) {
    const parts = path.split('/')
    for (let end = 1; end < parts.length; end += 1) dirs.add(parts.slice(0, end).join('/'))
  }
  return { files: new Set(paths), dirs }
}

function repoTree(): Tree {
  const listed = execFileSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    {
      encoding: 'utf8',
    },
  )
  return treeOf(listed.split('\0').filter((path) => path !== '' && existsSync(path)))
}

function exists(tree: Tree, path: string): boolean {
  return tree.files.has(path) || tree.dirs.has(path)
}

function dirOf(doc: string): string {
  const dir = posix.dirname(doc)
  return dir === '.' ? '' : dir
}

/** 디렉터리 바로 아래 항목의 이름(루트는 ''). */
function childrenOf(tree: Tree, dir: string): string[] {
  const prefix = dir === '' ? '' : `${dir}/`
  const names = new Set<string>()
  for (const path of tree.files) {
    if (path.startsWith(prefix)) names.add(path.slice(prefix.length).split('/')[0] ?? '')
  }
  names.delete('')
  return [...names].sort()
}

interface Line {
  readonly text: string
  readonly number: number
  readonly fenced: boolean
}

/** 빈 줄로 가른 문단. 코드 울타리 안의 줄은 fenced 이고, 울타리 줄은 문단을 가른다. */
function paragraphs(text: string): Line[][] {
  const result: Line[][] = []
  let current: Line[] = []
  let fenced = false
  const flush = () => {
    if (current.length > 0) result.push(current)
    current = []
  }
  text.split(/\r?\n/).forEach((raw, index) => {
    if (/^\s*(```|~~~)/.test(raw)) {
      fenced = !fenced
      flush()
    } else if (raw.trim() === '') flush()
    else current.push({ text: raw, number: index + 1, fenced })
  })
  flush()
  return result
}

function codeSpans(text: string): string[] {
  return [...text.matchAll(/`([^`]+)`/g)].map((match) => match[1] ?? '')
}

function linkTargets(text: string): string[] {
  return [...text.matchAll(/\]\((<[^>]*>|[^)\s]*)\)/g)].map((match) => {
    const target = match[1] ?? ''
    return target.startsWith('<') ? target.slice(1, -1) : target
  })
}

interface Candidate {
  readonly path: string
  /** `/` 가 든 글자다(디렉터리 표기 `lib/` 도). */
  readonly nested: boolean
}

/** 저장소 경로처럼 생긴 글자면 끝의 `/` 를 뗀 경로. */
function pathCandidate(token: string): Candidate | null {
  const raw = token.trim().replace(/^\.\//, '')
  if (raw === '' || NOT_A_PATH.test(raw) || /^[-/~]|^\.\./.test(raw)) return null
  if (/^\.[a-z]+$/.test(raw)) return null // 확장자 이야기(`.ts`·`.sh`)
  if (/^\[\d+\/\d+\]$|^[VDIWE]\/(?:ReactNativeJS)?$/.test(raw)) return null // 게이트 번호·로그 표식
  if (!raw.includes('/') && !EXTENSION.test(raw)) return null
  return { path: raw.replace(/\/$/, ''), nested: raw.includes('/') }
}

interface Findings {
  readonly dead: string[]
  readonly mentioned: ReadonlySet<string>
  readonly unusedExternal: string[]
}

function inspectDoc(tree: Tree, doc: string, text: string, external: readonly string[]): Findings {
  const docDir = dirOf(doc)
  const rootEntries = new Set(childrenOf(tree, ''))
  const docEntries = new Set(childrenOf(tree, docDir))
  const allowed = new Set(external)
  const used = new Set<string>()
  const dead: string[] = []
  const mentioned = new Set<string>()
  for (const paragraph of paragraphs(text)) {
    // 문단 안에서 부른 경로의 디렉터리 - 뒤따르는 이름 하나가 거기서 풀린다
    const context = new Set<string>()
    const found = (path: string) => {
      mentioned.add(path)
      context.add(tree.dirs.has(path) ? path : dirOf(path))
    }
    const bare: { where: string; span: string; name: string }[] = []
    for (const line of paragraph) {
      const where = `${doc}:${line.number}`
      if (line.fenced) {
        for (const word of line.text.split(/[\s"'=()]+/)) {
          const candidate = pathCandidate(word)
          if (candidate !== null && exists(tree, candidate.path)) mentioned.add(candidate.path)
        }
        continue
      }
      for (const target of linkTargets(line.text)) {
        if (/^(https?:|mailto:|#)/.test(target)) continue
        const path = posix
          .normalize(posix.join(docDir, target.split('#')[0] ?? ''))
          .replace(/\/$/, '')
        if (exists(tree, path)) found(path)
        else dead.push(`${where}: 링크 (${target})`)
      }
      for (const span of codeSpans(line.text)) {
        const candidate = pathCandidate(span)
        if (candidate === null) continue
        if (allowed.has(span)) {
          used.add(span)
          continue
        }
        const first = candidate.path.split('/')[0] ?? ''
        if (
          candidate.nested &&
          (GENERATED_ROOTS.has(first) || EXTERNAL_NAMESPACES.has(first)) &&
          !rootEntries.has(first) &&
          !docEntries.has(first)
        )
          continue
        // 루트 기준과 문서 디렉터리 기준이 둘 다 있으면 둘 다 부른 것이다(`test/unit/` 문서의 `platform/`)
        const hits = [candidate.path, posix.join(docDir, candidate.path)].filter((path) =>
          exists(tree, path),
        )
        if (hits.length > 0) hits.forEach(found)
        else if (candidate.nested) dead.push(`${where}: \`${span}\``)
        else bare.push({ where, span, name: candidate.path })
      }
    }
    for (const { where, span, name } of bare) {
      const hits = [...context]
        .map((dir) => posix.join(dir, name))
        .filter((path) => exists(tree, path))
      if (hits.length === 0) dead.push(`${where}: \`${span}\``)
      hits.forEach((path) => mentioned.add(path))
    }
  }
  const unusedExternal = [...allowed]
    .filter((token) => !used.has(token))
    .map((token) => `${doc}: \`${token}\``)
  return { dead, mentioned, unusedExternal }
}

/** AGENTS.md 가 부르지 않은 자기 디렉터리의 바로 아래 항목. 루트는 디렉터리만 본다. */
function unnamedChildren(tree: Tree, doc: string, mentioned: ReadonlySet<string>): string[] {
  const docDir = dirOf(doc)
  return childrenOf(tree, docDir)
    .filter((name) => name !== 'AGENTS.md')
    .map((name) => posix.join(docDir, name))
    .filter((child) => docDir !== '' || tree.dirs.has(child))
    .filter(
      (child) => ![...mentioned].some((path) => path === child || path.startsWith(`${child}/`)),
    )
    .map((child) => `${doc}: ${posix.basename(child)}${tree.dirs.has(child) ? '/' : ''}`)
}

function isDoc(path: string): boolean {
  return path === 'README.md' || path === 'AGENTS.md' || path.endsWith('/AGENTS.md')
}

/** README 의 "## 환경 변수" 절의 첫 표 - 변수 이름 → 기본값 칸. */
function readmeEnvTable(readme: string): Map<string, string> {
  const section = readme.split(/\n## /).find((part) => part.startsWith('환경 변수')) ?? ''
  const lines = section.split(/\r?\n/)
  const start = lines.findIndex((line) => line.startsWith('|'))
  const rows = new Map<string, string>()
  for (const line of start < 0 ? [] : lines.slice(start)) {
    if (!line.startsWith('|')) break
    const cells = line.split('|').map((cell) => cell.trim())
    const name = /^`([A-Z][A-Z0-9_]*)`$/.exec(cells[1] ?? '')?.[1]
    if (name !== undefined) rows.set(name, cells[3] ?? '')
  }
  return rows
}

function envExample(text: string): Map<string, string> {
  const values = new Map<string, string>()
  for (const line of text.split(/\r?\n/)) {
    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line)
    if (match !== null) values.set(match[1] ?? '', (match[2] ?? '').trim())
  }
  return values
}

describe('문서군이 실제 파일과 일치한다 - 스펙 17장 조건 5', () => {
  const tree = repoTree()
  const docs = [...tree.files].filter(isDoc).sort()
  const findings = new Map(
    docs.map((doc) => [doc, inspectDoc(tree, doc, readFileSync(doc, 'utf8'), EXTERNAL[doc] ?? [])]),
  )

  it('스펙 14장이 이름을 댄 문서가 있다', () => {
    expect(SPEC_DOCS.filter((doc) => !tree.files.has(doc))).toEqual([])
  })

  it('README 와 AGENTS.md 가 인용한 경로가 있다', () => {
    expect(docs.length).toBeGreaterThan(SPEC_DOCS.length)
    expect([...findings.values()].flatMap((found) => found.dead)).toEqual([])
  })

  it('AGENTS.md 가 자기 디렉터리의 바로 아래 항목을 전부 부른다', () => {
    expect(
      docs
        .filter((doc) => doc !== 'README.md')
        .flatMap((doc) => unnamedChildren(tree, doc, findings.get(doc)?.mentioned ?? new Set())),
    ).toEqual([])
  })

  it('저장소 밖 경로의 예외는 그 문서에 실제로 있다 - 문서에서 사라진 예외를 남기지 않는다', () => {
    expect(Object.keys(EXTERNAL).filter((doc) => !tree.files.has(doc))).toEqual([])
    expect([...findings.values()].flatMap((found) => found.unusedExternal)).toEqual([])
  })

  it('환경 변수 - README 표·.env.example 의 이름과 기본값, 코드의 APP_VARIANT 기본값이 같다(스펙 10.1)', () => {
    const readme = readmeEnvTable(readFileSync('README.md', 'utf8'))
    const example = envExample(readFileSync('.env.example', 'utf8'))
    // 코드의 환경 변수 접근 이름은 수집하지 않는다 - updates.ts는 env[name]으로 EAS 서버의 대체 변수도 읽는다.
    expect([...readme.keys()].sort()).toEqual([...example.keys()].sort())
    // 필수 변수에는 기본값이 없다 - .env.example 의 값은 예시다
    expect(readme.get('BACKEND_URL')).toBe('없음')
    // 선택 변수의 기본값은 app.config.ts 가 쓰는 값(lib/config/app-variant.ts)이다
    expect(example.get('APP_VARIANT')).toBe(DEFAULT_APP_VARIANT)
    expect(readme.get('APP_VARIANT')).toBe(`\`${DEFAULT_APP_VARIANT}\``)
    // 기본값이 없는 선택 변수는 .env.example 에서 비어 있다
    expect(example.get('EAS_PROJECT_ID')).toBe('')
    expect(readme.get('EAS_PROJECT_ID')).toBe('없음')
  })
})

describe('검사가 실제로 잡는다', () => {
  const tree = treeOf([
    'AGENTS.md',
    'lib/AGENTS.md',
    'lib/a.ts',
    'lib/b.ts',
    'lib/sub/c.ts',
    'test/unit/x.test.ts',
  ])

  it('없는 경로·없는 링크·문단 밖의 이름을 죽은 인용으로 잡는다', () => {
    const text = [
      '`lib/gone.ts` 와 [링크](missing/AGENTS.md) 와 `lib/sub/` 와 `c.ts`.',
      '',
      '`c.ts` 는 여기서 풀리지 않는다.',
    ].join('\n')
    expect(inspectDoc(tree, 'lib/AGENTS.md', text, []).dead).toEqual([
      'lib/AGENTS.md:1: 링크 (missing/AGENTS.md)',
      'lib/AGENTS.md:1: `lib/gone.ts`',
      'lib/AGENTS.md:3: `c.ts`',
    ])
  })

  it('저장소 밖의 경로·명령·자리표시·확장자 이야기는 재지 않는다', () => {
    const text =
      '`node_modules/.bin/x` `.maestro-output/e2e` `pnpm test` `lib/<이름>.ts` `lib/**` `.ts` `https://x.invalid/a.ts` `expo/fetch` `firebase/app` `astral-sh/setup-uv` `EXConstants.bundle/app.config` `build/fork/extractPathFromURL.js` `[12/13]` `I/ReactNativeJS` `W/`'
    expect(inspectDoc(tree, 'AGENTS.md', text, []).dead).toEqual([])
  })

  it('최상위 디렉터리의 오타와 삭제된 경로도 죽은 인용으로 잡는다', () => {
    expect(inspectDoc(tree, 'AGENTS.md', '`qeuries/keys.ts` `queries/keys.ts`', []).dead).toEqual([
      'AGENTS.md:1: `qeuries/keys.ts`',
      'AGENTS.md:1: `queries/keys.ts`',
    ])
  })

  it('부르지 않은 파일과 디렉터리를 잡는다 - 코드 울타리 안의 경로는 부른 것으로 친다', () => {
    const text = ['`a.ts`', '', '```bash', 'node lib/sub/c.ts', '```'].join('\n')
    const { mentioned } = inspectDoc(tree, 'lib/AGENTS.md', text, [])
    expect(unnamedChildren(tree, 'lib/AGENTS.md', mentioned)).toEqual(['lib/AGENTS.md: b.ts'])
    expect(unnamedChildren(tree, 'AGENTS.md', new Set(['lib']))).toEqual(['AGENTS.md: test/'])
  })

  it('루트와 문서 디렉터리에 같은 이름이 있으면 둘 다 부른 것이다', () => {
    const nested = treeOf(['lib/AGENTS.md', 'lib/test/y.ts', 'test/unit/x.test.ts'])
    const { mentioned, dead } = inspectDoc(nested, 'lib/AGENTS.md', '`test/`', [])
    expect(dead).toEqual([])
    expect(unnamedChildren(nested, 'lib/AGENTS.md', mentioned)).toEqual([])
    expect([...mentioned].sort()).toEqual(['lib/test', 'test'])
  })

  it('예외는 적힌 문서에서만 통하고, 쓰이지 않은 예외를 알린다', () => {
    const found = inspectDoc(tree, 'AGENTS.md', '`proxy.ts`', ['proxy.ts', 'page.tsx'])
    expect(found.dead).toEqual([])
    expect(found.unusedExternal).toEqual(['AGENTS.md: `page.tsx`'])
    expect(inspectDoc(tree, 'lib/AGENTS.md', '`proxy.ts`', []).dead).toEqual([
      'lib/AGENTS.md:1: `proxy.ts`',
    ])
  })

  it('README 의 환경 변수 표에서 첫 표만 읽는다', () => {
    const readme = [
      '# 제목',
      '',
      '## 환경 변수',
      '',
      '| 변수 | 필수 | 기본값 | 역할 |',
      '| --- | --- | --- | --- |',
      '| `A_B` | 예 | 없음 | 가 |',
      '',
      '| `C_D` | 아니오 | `x` | 나 |',
      '',
      '## 다음',
    ].join('\n')
    expect([...readmeEnvTable(readme).entries()]).toEqual([['A_B', '없음']])
  })
})
