import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

/**
 * eslint.config.js 의 전역 ignores 를 잰다. `.maestro-output/` 는 게이트·측정의 산출물 디렉터리다(git 이
 * 무시한다) - 안에 둔 스크래치(`__dirname` 을 쓰는 .cjs, tsconfig 밖의 .ts)가 `eslint .` 를 깨면 그 디렉터리를
 * 가진 체크아웃에서만 게이트의 lint 단계가 멈춘다. 저장소의 파일은 무시되면 안 된다.
 */
const eslint = new ESLint()

describe('ESLint 전역 ignores', { timeout: 60_000 }, () => {
  it.each([
    '.maestro-output/probe.cjs',
    '.maestro-output/mutants/probe.ts',
    'dist/probe.js',
    '.expo/types/probe.d.ts',
    'node_modules/probe/index.js',
  ])('%s 는 lint 대상이 아니다', async (filePath) => {
    expect(await eslint.isPathIgnored(filePath)).toBe(true)
  })

  it.each([
    'lib/resources/probe.ts',
    'app/(app)/probe.tsx',
    'components/ui/probe.tsx',
    'test/unit/lint/probe.test.ts',
    'scripts/probe.mjs',
    'eslint.config.js',
  ])('%s 는 lint 대상이다', async (filePath) => {
    expect(await eslint.isPathIgnored(filePath)).toBe(false)
  })
})
