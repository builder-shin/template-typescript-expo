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
  '@react-navigation/*',
  '@rn-primitives/*',
  '@tanstack/*',
  'uniwind',
  'lucide-react-native',
]

/**
 * lib/ 위의 계층(스펙 5장의 소유 표) - lib/ 는 맨 아래 계층이다. 위를 import 하면 시험이 그
 * 모듈을 vi.mock 해서 vitest 까지 통과해도 경계가 무너진다. 앞의 ** 가 별칭(@/platform/…)과
 * 상대 경로(../../platform/…)를 함께 잡는다. test/unit/lint/lib-boundary.test.ts 가 잰다.
 */
const UPPER_LAYER_PATTERNS = ['**/platform/*', '**/queries/*', '**/components/*', '**/app/*']

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
    // nodeLinker: hoisted 라서 선언하지 않은 전이 의존성(expo-modules-core 등)도 node_modules
    // 꼭대기에서 풀린다. package.json 에 없는 패키지의 import 를 막는다 -
    // test/unit/lint/dependencies.test.ts 가 잰다.
    files: ['**/*.{ts,tsx,js,jsx,mjs,cjs}'],
    rules: { 'import/no-extraneous-dependencies': 'error' },
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
            {
              group: UPPER_LAYER_PATTERNS,
              message:
                'lib/ 는 위 계층(platform·queries·components·app)을 import 하지 않는다(스펙 5장). 위 계층이 lib/ 를 부른다.',
            },
          ],
        },
      ],
    },
  },
  prettier,
])
