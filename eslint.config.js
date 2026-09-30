// @ts-check
/**
 * ESLint 9 다 - 형제 저장소(ESLint 10)와 다르다. eslint-config-expo 57 이 의존하는
 * eslint-plugin-react 7.37 과 eslint-plugin-import 2.x 의 peer 가 ESLint 9 까지다
 * (2026-09-30 측정).
 *
 * typescript-eslint 에서는 **규칙만** 가져온다. 그 설정 배열의 base 항목은
 * `@typescript-eslint` 플러그인을 다시 등록하는데, eslint-config-expo 가 이미 다른
 * 인스턴스로 등록해 두어 `Cannot redefine plugin "@typescript-eslint"` 로 ESLint 가
 * 죽는다(격리 폴더에서 실측). 규칙 이름은 eslint-config-expo 가 등록한 같은 이름의
 * 플러그인이 제공하므로 규칙 객체만 합치면 된다.
 */

// eslint-config-expo 는 node 전역(__dirname 등)을 metro.config.js 에만 선언한다.
/* global __dirname */
const { defineConfig } = require('eslint/config')
const expoConfig = require('eslint-config-expo/flat')
const prettier = require('eslint-config-prettier')
const tseslint = require('typescript-eslint')

const typeCheckedRules = Object.assign(
  {},
  ...tseslint.configs.recommendedTypeChecked.map((config) => config.rules ?? {}),
)

/**
 * lib/ 가 import 하면 안 되는 모듈(스펙 5장). lib/ 가 node 의 vitest 에서 그대로
 * 돌아야 template-typescript-nextjs 에서 복사한 테스트가 유효하다.
 * test/unit/lint/lib-boundary.test.ts 가 이 목록을 잰다.
 */
const PLATFORM_MODULE_PATTERNS = [
  'react',
  'react/*',
  'react-native',
  'react-native/*',
  'react-native-*',
  'expo',
  'expo/*',
  'expo-*',
  '@expo/*',
  '@react-native*',
  '@rn-primitives/*',
  '@tanstack/*',
  'uniwind',
  'lucide-react-native',
]

module.exports = defineConfig([
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      '.expo/**',
      'android/**',
      'ios/**',
      'coverage/**',
      'expo-env.d.ts',
      'uniwind-types.d.ts',
    ],
  },
  expoConfig,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: __dirname },
    },
    rules: typeCheckedRules,
  },
  {
    files: ['lib/**/*.{ts,tsx,js,jsx,mjs,cjs}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: PLATFORM_MODULE_PATTERNS,
              message:
                'lib/ 는 순수 TypeScript 다(스펙 5장). 네이티브·React 모듈은 platform/ 이나 queries/ 에서 쓴다.',
            },
          ],
        },
      ],
    },
  },
  prettier,
])
