import { ESLint, Linter } from 'eslint'
import { describe, expect, it } from 'vitest'

/**
 * lib/ 경계 규칙(스펙 5장)을 잰다.
 *
 * 축이 둘이다. (1) eslint.config.js 가 lib/ 파일에 no-restricted-imports 를 오류로
 * 거는가 - calculateConfigForFile 로 해석된 설정을 본다. (2) 그렇게 걸린 규칙이
 * 실제로 무엇을 막고 무엇을 통과시키는가 - 해석된 규칙 항목만 떼어 core Linter 로
 * 돌린다. 전체 설정으로 가상 파일을 lint 하면 타입 인식 규칙의 projectService 가
 * "프로젝트에 없는 파일"로 죽으므로 두 축을 나눈다.
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
  const entry = await restrictionFor('lib/boundary-probe.ts')
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
  '@react-native-community/netinfo',
  '@rn-primitives/portal',
  '@tanstack/react-query',
  'uniwind',
  'lucide-react-native',
]

const ALLOWED = ['@/lib/jsonapi/query', './define', 'clsx', 'tailwind-merge']

/*
 * 첫 테스트가 ESLint 설정 배열(eslint-config-expo · typescript-eslint 와 그 플러그인)을
 * 처음 해석한다. 파일 캐시가 찬 뒤에는 1초대지만 설치 직후의 첫 실행은 Windows 에서 15초가
 * 넘게 걸려(2026-09-30 실측) 기본 5초를 넘겼다. 해석 결과는 ESLint 인스턴스가 캐시하므로
 * 나머지 테스트는 곧바로 끝난다.
 */
describe('lib/ 경계 - 스펙 5장', { timeout: 60_000 }, () => {
  it('lib/ 파일에는 no-restricted-imports 가 오류로 걸린다', async () => {
    expect(severityOf(await restrictionFor('lib/boundary-probe.ts'))).toBe(2)
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
