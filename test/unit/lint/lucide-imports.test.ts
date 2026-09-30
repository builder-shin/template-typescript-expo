import { ESLint, Linter } from 'eslint'
import { parser, plugin } from 'typescript-eslint'
import { describe, expect, it } from 'vitest'

/**
 * lucide-react-native 통(barrel) import 금지를 잰다.
 *
 * 통을 값으로 import 하면 Metro 가 - 트리 셰이킹이 없다 - 아이콘 1800여 개(소스 1.7MB)를 모두 번들에 싣는다.
 * 아이콘마다 깊은 경로(`lucide-react-native/icons/arrow-down`)로 받는다. 타입 import 는 어디서나 된다.
 *
 * lib-boundary.test.ts·request-boundary.test.ts 처럼 축이 둘이다. (1) eslint.config.js 가 어느 계층·확장자에 이
 * 규칙을 거는가 - calculateConfigForFile 로 해석된 설정을 본다. 같은 규칙 이름의 옵션은 블록끼리 합쳐지지 않아
 * 뒤의 블록이 앞의 항목을 통째로 덮는다. 이 규칙은 core `no-restricted-imports`(lib/ 경계·request 경계가 쓴다)가
 * 아니라 typescript-eslint 의 같은 이름 규칙이라 그 블록들에 덮이지 않는다 - 그 덮임이 없다는 것(계층마다 두 규칙이
 * 함께 살아 있다)을 여기서 잰다. (2) 그렇게 걸린 규칙이 실제로 무엇을 막고 통과시키는가 - 해석된 규칙 항목만 떼어 core
 * Linter 로 돌린다. 전체 설정으로 가상 파일을 lint 하면 타입 인식 규칙의 projectService 가 "프로젝트에 없는 파일"로
 * 죽으므로 두 축을 나눈다. `import type` 은 TypeScript 문법이라 표본을 typescript-eslint 의 파서로 읽는다.
 *
 * 규칙은 정적 import·`export … from`·`import x = require()` 만 잰다 - 동적 import() 와 require() 호출은 재지 않는다.
 * typescript-eslint 플러그인이 ts 파일에만 등록되어 있어(eslint-config-expo) js 계열에는 걸지 않는다.
 */
const RULE = '@typescript-eslint/no-restricted-imports'
const CORE_RULE = 'no-restricted-imports'

const eslint = new ESLint()

async function ruleEntry(filePath: string, rule: string): Promise<Linter.RuleEntry | undefined> {
  const config = (await eslint.calculateConfigForFile(filePath)) as Linter.Config
  return config.rules?.[rule]
}

function severityOf(entry: Linter.RuleEntry | undefined): number {
  const level = Array.isArray(entry) ? entry[0] : entry
  if (level === 'error' || level === 2) return 2
  if (level === 'warn' || level === 1) return 1
  return 0
}

async function lucideEntry(filePath: string): Promise<Linter.RuleEntry> {
  const entry = await ruleEntry(filePath, RULE)
  if (entry === undefined) throw new Error(`${filePath} 에 ${RULE} 가 걸려 있지 않다`)
  return entry
}

function messagesFor(entry: Linter.RuleEntry, source: string): Linter.LintMessage[] {
  const linter = new Linter({ configType: 'flat' })
  return linter.verify(
    source,
    [
      {
        files: ['**/*.ts'],
        plugins: { '@typescript-eslint': plugin },
        languageOptions: { parser, sourceType: 'module', ecmaVersion: 'latest' },
        rules: { [RULE]: entry },
      },
    ],
    'lucide-imports-probe.ts',
  )
}

const BARREL_NAMED =
  "import { ArrowDown } from 'lucide-react-native'\nexport const probe = ArrowDown\n"

// 계층마다 표본 하나. 경계 규칙의 블록이 덮는 계층(lib/, app·components·queries·platform)과, 그 블록에서 빠지는
// 파일(platform/api.ts)과, 어느 블록에도 들지 않는 파일(시험, 루트의 선언 파일)을 모두 둔다.
const LAYERS = [
  ['app(라우트 그룹 디렉터리)', 'app/(app)/examples/lucide-probe.tsx'],
  ['components/resource', 'components/resource/lucide-probe.tsx'],
  ['components/ui', 'components/ui/lucide-probe.tsx'],
  ['queries', 'queries/lucide-probe.ts'],
  ['platform', 'platform/lucide-probe.ts'],
  ['platform/api.ts(request 경계의 예외)', 'platform/api.ts'],
  ['lib', 'lib/resources/lucide-probe.ts'],
  ['시험', 'test/unit/ui/lucide-probe.test.ts'],
  ['루트의 선언 파일', 'lucide-probe.d.ts'],
] as const

// 같은 규칙 이름의 옵션을 덮어쓰는 블록 둘의 계층 - 여기서 core 규칙도 함께 살아 있어야 한다.
const CORE_RULE_LAYERS = [
  ['lib', 'lib/resources/lucide-probe.ts'],
  ['components', 'components/resource/lucide-probe.tsx'],
  ['platform', 'platform/lucide-probe.ts'],
  ['app', 'app/(app)/examples/lucide-probe.tsx'],
  ['queries', 'queries/lucide-probe.ts'],
] as const

// 막히는 import 모양. 이름·기본·네임스페이스 어느 것으로 받든, 타입과 섞어 받든, 다시 내보내든 통의 값이면 막힌다.
const BLOCKED = [
  ['이름으로 받기', BARREL_NAMED],
  [
    '여러 이름으로 받기',
    "import { ArrowDown, ArrowUp, ArrowUpDown, SlidersHorizontal } from 'lucide-react-native'\nexport const probe = [ArrowDown, ArrowUp, ArrowUpDown, SlidersHorizontal]\n",
  ],
  [
    '다른 이름으로 받기',
    "import { ArrowDown as Down } from 'lucide-react-native'\nexport const probe = Down\n",
  ],
  ['기본으로 받기', "import Lucide from 'lucide-react-native'\nexport const probe = Lucide\n"],
  [
    '네임스페이스로 받기',
    "import * as Icons from 'lucide-react-native'\nexport const probe = Icons\n",
  ],
  [
    '타입과 함께 받기',
    "import { type LucideIcon, ArrowDown } from 'lucide-react-native'\nexport const probe: LucideIcon = ArrowDown\n",
  ],
  [
    'require 로 받기(import x = require)',
    "import Lucide = require('lucide-react-native')\nexport const probe = Lucide\n",
  ],
  ['다시 내보내기', "export { ArrowDown } from 'lucide-react-native'\n"],
  ['전부 다시 내보내기', "export * from 'lucide-react-native'\n"],
] as const

// 통과하는 import 모양. 통에서 타입만 가져오는 모양과 깊은 경로는 어떤 것이든 된다.
const ALLOWED = [
  [
    '타입 import',
    "import type { LucideIcon } from 'lucide-react-native'\nexport type Probe = LucideIcon\n",
  ],
  [
    '타입 여럿',
    "import type { LucideIcon, LucideProps } from 'lucide-react-native'\nexport type Probe = [LucideIcon, LucideProps]\n",
  ],
  [
    '지정자마다 붙인 타입 import',
    "import { type LucideIcon, type LucideProps } from 'lucide-react-native'\nexport type Probe = [LucideIcon, LucideProps]\n",
  ],
  [
    '타입 네임스페이스',
    "import type * as Lucide from 'lucide-react-native'\nexport type Probe = Lucide.LucideIcon\n",
  ],
  ['타입 다시 내보내기', "export type { LucideIcon } from 'lucide-react-native'\n"],
  [
    '깊은 경로의 기본 내보내기',
    "import ArrowDown from 'lucide-react-native/icons/arrow-down'\nexport const probe = ArrowDown\n",
  ],
  [
    '깊은 경로 여럿',
    "import ArrowDown from 'lucide-react-native/icons/arrow-down'\nimport SlidersHorizontal from 'lucide-react-native/icons/sliders-horizontal'\nexport const probe = [ArrowDown, SlidersHorizontal]\n",
  ],
  [
    '깊은 경로의 이름 내보내기',
    "import { __iconData } from 'lucide-react-native/icons/arrow-down'\nexport const probe = __iconData\n",
  ],
  [
    '깊은 경로의 타입',
    "import type ArrowDown from 'lucide-react-native/icons/arrow-down'\nexport type Probe = typeof ArrowDown\n",
  ],
  ['다른 패키지', "import { View } from 'react-native'\nexport const probe = View\n"],
] as const

/*
 * 첫 테스트가 ESLint 설정 배열을 처음 해석한다 - 다른 lint 시험과 같은 이유로 기본 5초를 넘길 수 있다.
 * 해석 결과는 ESLint 인스턴스가 캐시하므로 나머지 테스트는 곧바로 끝난다.
 */
describe('lucide-react-native 통 import - 번들 크기', { timeout: 60_000 }, () => {
  it.each(LAYERS)('%s 에는 통 제한이 오류로, 같은 항목으로 걸린다', async (_layer, filePath) => {
    const entry = await ruleEntry(filePath, RULE)
    expect(severityOf(entry)).toBe(2)
    // 심각도만 보면 어떤 계층에서 옵션을 줄여 덮어써도 통과한다.
    expect(entry).toEqual(await lucideEntry('components/resource/lucide-probe.tsx'))
  })

  it.each(CORE_RULE_LAYERS)(
    '%s: 경계 규칙(core no-restricted-imports)이 이 규칙에 덮이지 않고 함께 걸려 있다',
    async (_layer, filePath) => {
      expect(severityOf(await ruleEntry(filePath, CORE_RULE))).toBe(2)
      expect(severityOf(await ruleEntry(filePath, RULE))).toBe(2)
    },
  )

  it.each(CORE_RULE_LAYERS)(
    '%s 에서 통을 값으로 import 하면 깊은 경로를 안내하며 막힌다',
    async (_layer, filePath) => {
      const messages = messagesFor(await lucideEntry(filePath), BARREL_NAMED)
      expect(messages.map((message) => message.ruleId)).toEqual([RULE])
      expect(messages[0]?.message).toMatch(/lucide-react-native\/icons\/arrow-down/)
    },
  )

  it.each(BLOCKED)('통을 %s 로 import 하면 막힌다', async (_form, source) => {
    const messages = messagesFor(await lucideEntry('components/resource/lucide-probe.tsx'), source)
    expect(messages.map((message) => message.ruleId)).toEqual([RULE])
  })

  it.each(ALLOWED)('%s 는 허용된다', async (_form, source) => {
    const messages = messagesFor(await lucideEntry('components/resource/lucide-probe.tsx'), source)
    expect(messages).toEqual([])
  })
})
