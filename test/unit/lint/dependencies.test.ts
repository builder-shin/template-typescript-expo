import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

/**
 * 선언하지 않은 패키지의 import 를 막는 규칙(import/no-extraneous-dependencies)을 잰다.
 *
 * pnpm 의 nodeLinker 가 hoisted 라서 전이 의존성도 node_modules 꼭대기에 풀린다 - package.json 에
 * 없는 패키지를 import 해도 번들과 시험이 통과하고, 그 패키지는 상위 패키지가 버전을 올리거나
 * 빼는 순간 사라진다. 표본의 expo-modules-core 는 expo 가 끌어오는 패키지이고 package.json 에는
 * 없다.
 *
 * 가상 파일을 전체 설정으로 lint 하면 타입 인식 규칙의 projectService 가 "프로젝트에 없는 파일"로
 * 죽는다(lib-boundary.test.ts 머리말). 그래서 실재하는 파일 경로에 표본 내용을 주고, ruleFilter
 * 로 이 규칙만 돌린다.
 */
const eslint = new ESLint({
  ruleFilter: ({ ruleId }) => ruleId === 'import/no-extraneous-dependencies',
})

/** 규칙이 낸 [규칙 이름, 심각도] 목록. 심각도 2 가 오류다. */
async function findingsFor(source: string, filePath: string): Promise<[string | null, number][]> {
  const [result] = await eslint.lintText(source, { filePath })
  return (result?.messages ?? []).map((message) => [message.ruleId, message.severity])
}

const ESM_PROBE =
  "import { requireNativeModule } from 'expo-modules-core'\nexport const probe = requireNativeModule\n"
// eslint.config.js 같은 설정 파일은 CommonJS 라 import 가 아니라 require 로 읽는다.
const CJS_PROBE =
  "const { requireNativeModule } = require('expo-modules-core')\nmodule.exports = { probe: requireNativeModule }\n"

// 첫 테스트가 설정 배열과 타입 프로그램을 처음 해석한다 - lib-boundary.test.ts 와 같은 이유로
// 기본 5초를 넘길 수 있다.
describe('선언하지 않은 의존성', { timeout: 60_000 }, () => {
  // 규칙 블록의 files 는 ts·tsx 만이 아니다. 스크립트(scripts/*.mjs)와 설정 파일(eslint.config.js)도
  // 같은 위험을 지므로 여섯 확장자를 모두 잰다 - files 가 좁아지는 후퇴를 잡는다.
  it.each([
    ['platform/theme.ts', ESM_PROBE],
    ['app/_layout.tsx', ESM_PROBE],
    ['components/ui/text.tsx', ESM_PROBE],
    ['lib/config/settings.ts', ESM_PROBE],
    ['scripts/x.mjs', ESM_PROBE],
    ['components/x.jsx', ESM_PROBE],
    ['eslint.config.js', CJS_PROBE],
    ['lib/x.cjs', CJS_PROBE],
  ])(
    '%s 에서 package.json 에 없는 패키지를 import 하면 오류로 막힌다',
    async (filePath, source) => {
      expect(await findingsFor(source, filePath)).toEqual([
        ['import/no-extraneous-dependencies', 2],
      ])
    },
  )

  it('package.json 에 있는 패키지는 통과한다', async () => {
    const source =
      "import { getLocales } from 'expo-localization'\nexport const probe = getLocales\n"
    expect(await findingsFor(source, 'platform/theme.ts')).toEqual([])
  })
})
