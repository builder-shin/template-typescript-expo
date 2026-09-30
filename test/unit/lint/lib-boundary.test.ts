import { ESLint, Linter } from 'eslint'
import { describe, expect, it } from 'vitest'

/**
 * lib/ 경계 규칙(스펙 5장)을 잰다.
 *
 * 축이 둘이다. (1) eslint.config.js 가 lib/ 아래 어느 깊이·어느 확장자의 파일에도
 * no-restricted-imports 를 오류로 거는가 - calculateConfigForFile 로 해석된 설정을
 * 본다. (2) 그렇게 걸린 규칙이 실제로 무엇을 막고 무엇을 통과시키는가 - 해석된 규칙
 * 항목만 떼어 core Linter 로 돌린다. 전체 설정으로 가상 파일을 lint 하면 타입 인식
 * 규칙의 projectService 가 "프로젝트에 없는 파일"로 죽으므로 두 축을 나눈다.
 */
const eslint = new ESLint()

async function restrictionFor(filePath: string): Promise<Linter.RuleEntry | undefined> {
  const config = (await eslint.calculateConfigForFile(filePath)) as Linter.Config
  return config.rules?.['no-restricted-imports']
}

function severityOf(entry: Linter.RuleEntry | undefined): number {
  const level = Array.isArray(entry) ? entry[0] : entry
  if (level === 'error' || level === 2) return 2
  if (level === 'warn' || level === 1) return 1
  return 0
}

function messagesFor(entry: Linter.RuleEntry, source: string): Linter.LintMessage[] {
  const linter = new Linter({ configType: 'flat' })
  return linter.verify(
    source,
    [
      {
        languageOptions: { sourceType: 'module', ecmaVersion: 'latest' },
        rules: { 'no-restricted-imports': entry },
      },
    ],
    'lib/boundary-probe.js',
  )
}

async function libRule(): Promise<Linter.RuleEntry> {
  const entry = await restrictionFor('lib/jsonapi/boundary-probe.ts')
  if (entry === undefined) throw new Error('lib/ 파일에 no-restricted-imports 가 걸려 있지 않다')
  return entry
}

const FORBIDDEN = [
  'react',
  'react-native',
  'react-native-reanimated',
  'expo',
  'expo-secure-store',
  'expo-router',
  '@expo/config',
  // 계약의 @react-native* 는 스코프가 둘이다. @react-native/… 와 @react-native-…/… 를 모두 잰다.
  '@react-native/assets-registry',
  '@react-native-community/netinfo',
  '@react-native-async-storage/async-storage',
  '@rn-primitives/portal',
  '@tanstack/react-query',
  'uniwind',
  'lucide-react-native',
]

const ALLOWED = ['@/lib/jsonapi/query', './define', 'clsx', 'tailwind-merge']

// 계약의 lib/** 는 깊이와 확장자를 가리지 않는다. 깊이가 하나뿐인 표본은 files 패턴이
// lib/*.ts 로 좁아지는 후퇴를, 확장자가 하나뿐인 표본은 lib/**/*.ts 로 좁아지는 후퇴를 놓친다.
const LIB_FILES = [
  'lib/jsonapi/boundary-probe.ts',
  'lib/resources/boundary-probe.tsx',
  'lib/auth/boundary-probe.js',
  'lib/lab/boundary-probe.jsx',
  'lib/jsonapi/boundary-probe.mjs',
  'lib/jsonapi/boundary-probe.cjs',
]

/*
 * 첫 테스트가 ESLint 설정 배열(eslint-config-expo · typescript-eslint 와 그 플러그인)을
 * 처음 해석한다. 파일 캐시가 찬 뒤에는 1초대지만 설치 직후의 첫 실행은 Windows 에서 15초가
 * 넘게 걸려(2026-09-30 실측) 기본 5초를 넘겼다. 해석 결과는 ESLint 인스턴스가 캐시하므로
 * 나머지 테스트는 곧바로 끝난다.
 */
describe('lib/ 경계 - 스펙 5장', { timeout: 60_000 }, () => {
  it.each(LIB_FILES)('%s 에는 no-restricted-imports 가 오류로 걸린다', async (filePath) => {
    expect(severityOf(await restrictionFor(filePath))).toBe(2)
  })

  it.each(FORBIDDEN)('lib/ 에서 %s 를 import 하면 막힌다', async (moduleName) => {
    const messages = messagesFor(
      await libRule(),
      `import probe from '${moduleName}'\nexport default probe\n`,
    )
    expect(messages.map((message) => message.ruleId)).toEqual(['no-restricted-imports'])
  })

  it.each(ALLOWED)('lib/ 에서 %s 는 허용된다', async (moduleName) => {
    const messages = messagesFor(
      await libRule(),
      `import probe from '${moduleName}'\nexport default probe\n`,
    )
    expect(messages).toEqual([])
  })

  it('lib/ 밖(platform/)에는 걸리지 않는다', async () => {
    expect(severityOf(await restrictionFor('platform/boundary-probe.ts'))).toBe(0)
  })
})
