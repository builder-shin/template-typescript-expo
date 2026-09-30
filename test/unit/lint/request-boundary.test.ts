import { ESLint, Linter } from 'eslint'
import { parser } from 'typescript-eslint'
import { describe, expect, it } from 'vitest'

/**
 * request() 경계 규칙(스펙 9.4)을 잰다.
 *
 * `request()`(lib/jsonapi/client.ts)를 값으로 import 하는 곳은 platform/api.ts 와 lib/ 뿐이다. 그 밖의
 * 앱 코드가 부르면 Accept-Language 를 싣는 자리(apiRequest)를 건너뛰고, 그 뮤턴트는 게이트를 통과했다.
 * 타입 import 는 어디서나 된다.
 *
 * lib-boundary.test.ts 처럼 축이 둘이다. (1) eslint.config.js 가 어느 계층·깊이·확장자에 이 제한을 거는가 -
 * calculateConfigForFile 로 해석된 설정을 본다. (2) 그렇게 걸린 규칙이 실제로 무엇을 막고 무엇을 통과시키는가 -
 * 해석된 규칙 항목만 떼어 core Linter 로 돌린다. 전체 설정으로 가상 파일을 lint 하면 타입 인식 규칙의
 * projectService 가 "프로젝트에 없는 파일"로 죽으므로 두 축을 나눈다. `import type` 은 TypeScript 문법이라
 * 표본을 typescript-eslint 의 파서로 읽는다.
 *
 * 규칙은 정적 import 와 `export … from` 만 잰다. `import x = require()`(importNames 를 준 규칙은 이름
 * 없이 지나간다)와 동적 import()·require() 호출은 재지 않는다.
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

async function ruleFor(filePath: string): Promise<Linter.RuleEntry> {
  const entry = await restrictionFor(filePath)
  if (entry === undefined) throw new Error(`${filePath} 에 no-restricted-imports 가 걸려 있지 않다`)
  return entry
}

function messagesFor(entry: Linter.RuleEntry, source: string): Linter.LintMessage[] {
  const linter = new Linter({ configType: 'flat' })
  return linter.verify(
    source,
    [
      {
        files: ['**/*.ts'],
        languageOptions: { parser, sourceType: 'module', ecmaVersion: 'latest' },
        rules: { 'no-restricted-imports': entry },
      },
    ],
    'request-boundary-probe.ts',
  )
}

const IMPORT_REQUEST =
  "import { request } from '@/lib/jsonapi/client'\nexport const probe = request\n"

// 계층마다 표본 하나 - 이 계층들은 request 를 값으로 import 하면 막혀야 한다.
const LAYERS = [
  ['app', 'app/request-probe.tsx'],
  ['components', 'components/form/request-probe.tsx'],
  ['queries', 'queries/request-probe.ts'],
  ['platform(api.ts 가 아닌 파일)', 'platform/request-probe.ts'],
] as const

// 깊이·확장자가 다른 표본. Expo Router 의 라우트 그룹 디렉터리 `(app)` 처럼 괄호가 든 경로와 js 계열
// 확장자를 둬서 files 패턴이 좁아지는 후퇴를 잡는다.
const GUARDED_FILES = [
  'app/request-probe.ts',
  'app/(app)/examples/request-probe.tsx',
  'components/ui/deep/request-probe.tsx',
  'queries/request-probe.tsx',
  'platform/request-probe.tsx',
  'app/request-probe.js',
  'components/request-probe.jsx',
  'queries/request-probe.mjs',
  'platform/request-probe.cjs',
]

// 막히는 import 모양. 별칭·상대 경로·.ts 확장자와, 이름을 바꾸거나 타입과 섞거나 네임스페이스로 받거나
// 다시 내보내는 모양을 모두 잰다.
const BLOCKED = [
  ['별칭', IMPORT_REQUEST],
  [
    '상대 경로',
    "import { request } from '../../lib/jsonapi/client'\nexport const probe = request\n",
  ],
  [
    '.ts 확장자',
    "import { request } from '@/lib/jsonapi/client.ts'\nexport const probe = request\n",
  ],
  [
    '다른 이름으로 받기',
    "import { request as send } from '@/lib/jsonapi/client'\nexport const probe = send\n",
  ],
  [
    '타입과 함께 받기',
    "import { request, type RequestOptions } from '@/lib/jsonapi/client'\nexport const probe = (options: RequestOptions) => request('/probe', options)\n",
  ],
  [
    '네임스페이스로 받기',
    "import * as client from '@/lib/jsonapi/client'\nexport const probe = client\n",
  ],
  ['다시 내보내기', "export { request } from '@/lib/jsonapi/client'\n"],
  ['전부 다시 내보내기', "export * from '@/lib/jsonapi/client'\n"],
] as const

// 통과하는 import 모양. 타입만 가져오는 모양은 어떤 것이든 되고, request 가 아닌 값과 다른 모듈의
// request 도 된다.
const ALLOWED = [
  [
    '타입 import',
    "import type { RequestOptions } from '@/lib/jsonapi/client'\nexport type Probe = RequestOptions\n",
  ],
  [
    '지정자마다 붙인 타입 import',
    "import { type RequestOptions, type JsonApiResult } from '@/lib/jsonapi/client'\nexport type Probe = [RequestOptions, JsonApiResult<unknown>]\n",
  ],
  [
    'request 의 타입',
    "import type { request } from '@/lib/jsonapi/client'\nexport type Probe = typeof request\n",
  ],
  [
    '타입 네임스페이스',
    "import type * as client from '@/lib/jsonapi/client'\nexport type Probe = typeof client\n",
  ],
  ['타입 다시 내보내기', "export type { RequestOptions } from '@/lib/jsonapi/client'\n"],
  [
    'request 가 아닌 값',
    "import { isSyntheticError, withAcceptLanguage } from '@/lib/jsonapi/client'\nexport const probe = [isSyntheticError, withAcceptLanguage]\n",
  ],
  ['apiRequest', "import { apiRequest } from '@/platform/api'\nexport const probe = apiRequest\n"],
  ['다른 모듈의 request', "import { request } from 'node:https'\nexport const probe = request\n"],
  // 이 규칙은 request 만 막는다 - platform 모듈은 앱 계층이 얼마든지 쓴다.
  ['react-native', "import { View } from 'react-native'\nexport const probe = View\n"],
] as const

/*
 * 첫 테스트가 ESLint 설정 배열을 처음 해석한다 - lib-boundary.test.ts 와 같은 이유로 기본 5초를
 * 넘길 수 있다. 해석 결과는 ESLint 인스턴스가 캐시하므로 나머지 테스트는 곧바로 끝난다.
 */
describe('request() 경계 - 스펙 9.4', { timeout: 60_000 }, () => {
  it.each(GUARDED_FILES)(
    '%s 에는 request 제한이 오류로, 같은 항목으로 걸린다',
    async (filePath) => {
      const entry = await restrictionFor(filePath)
      expect(severityOf(entry)).toBe(2)
      // 심각도만 보면 어떤 계층에서 패턴을 줄여 덮어써도 통과한다.
      expect(entry).toEqual(await ruleFor('app/request-probe.ts'))
    },
  )

  it.each(LAYERS)(
    '%s 에서 request 를 import 하면 apiRequest 를 안내하며 막힌다',
    async (_layer, filePath) => {
      const messages = messagesFor(await ruleFor(filePath), IMPORT_REQUEST)
      expect(messages.map((message) => message.ruleId)).toEqual(['no-restricted-imports'])
      expect(messages[0]?.message).toMatch(/apiRequest/)
    },
  )

  it.each(BLOCKED)('앱 계층에서 request 를 %s 로 import 하면 막힌다', async (_form, source) => {
    const messages = messagesFor(await ruleFor('app/request-probe.ts'), source)
    expect(messages.map((message) => message.ruleId)).toEqual(['no-restricted-imports'])
  })

  it.each(ALLOWED)('앱 계층에서 %s 는 허용된다', async (_form, source) => {
    const messages = messagesFor(await ruleFor('app/request-probe.ts'), source)
    expect(messages).toEqual([])
  })

  it('platform/api.ts 는 request 를 import 할 수 있다 - 제한이 걸리지 않는다', async () => {
    expect(await restrictionFor('platform/api.ts')).toBeUndefined()
  })

  it.each(['lib/jsonapi/request-probe.ts', 'lib/auth/request-probe.ts'])(
    '%s: lib/ 는 request 를 import 할 수 있다',
    async (filePath) => {
      const entry = await ruleFor(filePath)
      expect(messagesFor(entry, IMPORT_REQUEST)).toEqual([])
      expect(
        messagesFor(entry, "import { request } from './client'\nexport const probe = request\n"),
      ).toEqual([])
    },
  )

  it.each(['test/unit/jsonapi/request-probe.test.ts', 'scripts/request-probe.mjs'])(
    '%s 에는 걸리지 않는다 - 시험은 request 를 직접 잰다',
    async (filePath) => {
      expect(await restrictionFor(filePath)).toBeUndefined()
    },
  )
})
