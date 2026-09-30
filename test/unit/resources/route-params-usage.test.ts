import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * 화면이 라우트 파라미터를 읽는 방식을 잰다(D3 결정 39).
 *
 * Expo Router 는 이동이 싣는 값도 라우트 파라미터에 섞는다 - 로그인·가입 뒤 복귀
 * (`router.dismissTo(주소, { withAnchor: true })`)는 잎 화면까지 `initial: false` 를 싣고
 * `useLocalSearchParams()` 는 그것을 문자열 `'false'` 로 준다(lib/resources/route-params.ts). 결과를 펼치거나
 * 돌거나 통째로 넘기면 그 값이 백엔드 쿼리와 정렬·필터 주소를 타고 따라간다. 그래서 `app/` 에서
 * `useLocalSearchParams`(같은 모양의 `useGlobalSearchParams` 도)를 부르는 곳은 셋 중 하나여야 한다:
 *
 * - `listRouteParams(useLocalSearchParams())` - JSON:API 쿼리 파라미터만 남기는 목록 화면의 입구.
 * - `const { id } = useLocalSearchParams<…>()` - 이름으로 구조 분해. 나머지 요소(`...rest`)는 안 된다.
 * - `useLocalSearchParams()[LOGIN_REDIRECT_PARAM]` · `useLocalSearchParams().id` - 키 하나를 바로 읽는다. 인증
 *   화면(`app/(auth)/`)이 `next` 를 이렇게 읽는다. 결과 전체를 손에 쥐지 않으므로 이름으로 꺼내는 것과 같다.
 *
 * 그 밖의 모양은 모두 위반이다: `const params = useLocalSearchParams()`, `{ ...useLocalSearchParams() }`,
 * `Object.entries(useLocalSearchParams())`, 다른 함수에 통째로 넘기기.
 *
 * 문자열이 아니라 파일 전체를 훑는다 - 호출은 줄이 나뉘어 있을 수 있고(Prettier) 제네릭을 달 수 있다. 주석 안의 예시는
 * 호출이 아니다. `import { useLocalSearchParams }` 도 호출이 아니다.
 */
const ROOTS = ['app']

// 호출: 이름 다음에 (제네릭을 달 수 있는) 여는 괄호. import 지정자와 식별자의 일부(`useLocalSearchParamsX`)는 걸리지 않는다.
const HOOK_CALL = /\b(useLocalSearchParams|useGlobalSearchParams)\b\s*(?:<[^()]*?>)?\s*\(/g

// 호출 바로 앞이 `const { … } =` 이면 구조 분해다. 괄호 안에 `...` 가 있으면 나머지 요소다.
const DESTRUCTURE_BEFORE = /\b(?:const|let)\s*\{([^{}]*)\}\s*(?::[^=]+?)?=\s*$/

type Call = { hook: string; line: number; ok: boolean }

/** 주석을 같은 길이의 공백으로 바꾼다 - 줄 번호는 그대로 두고 주석 속의 호출 예시는 지운다. */
function withoutComments(text: string): string {
  const blank = (match: string) => match.replace(/[^\n]/g, ' ')
  return text.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/\/\/[^\n]*/g, blank)
}

function callsIn(source: string): Call[] {
  const text = withoutComments(source)
  return [...text.matchAll(HOOK_CALL)].map((match) => {
    const before = text.slice(0, match.index)
    const after = text.slice(match.index + match[0].length)
    // `listRouteParams(` 바로 안쪽의 빈 인자 호출 하나여야 한다 - 다른 인자가 더 있거나 다른 함수면 아니다.
    const filtered = /\blistRouteParams\s*\(\s*$/.test(before) && /^\s*\)\s*,?\s*\)/.test(after)
    const pattern = DESTRUCTURE_BEFORE.exec(before)
    const named = pattern !== null && !(pattern[1] ?? '').includes('...')
    // 빈 인자 호출 바로 뒤의 `[키]`·`.키`·`?.키` - 결과 전체를 변수에 담지 않고 키 하나만 읽는다.
    const single = /^\s*\)\s*(?:\?\.|\.|\[)/.test(after)
    return {
      hook: match[1] ?? '',
      line: before.split('\n').length,
      ok: filtered || named || single,
    }
  })
}

function sourceFiles(root: string): string[] {
  return readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(ts|tsx)$/.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name))
}

describe('라우트 파라미터를 읽는 방식 - 결정 39', () => {
  it('app/ 의 호출은 listRouteParams 로 거르거나 이름으로 구조 분해한다', () => {
    const scanned = ROOTS.map((root) => ({ root, files: sourceFiles(root) }))
    for (const { root, files } of scanned) {
      // 훑은 파일이 없으면 위반이 없는 것이 아니라 검사가 망가진 것이다(경로나 확장자 거르기가 틀렸다)
      expect(files.length, `${root}/ 에서 찾은 소스 파일`).toBeGreaterThan(0)
    }

    const calls = scanned
      .flatMap(({ files }) => files)
      .flatMap((file) =>
        callsIn(readFileSync(file, 'utf8')).map((call) => ({
          ...call,
          where: `${file}:${call.line}`,
        })),
      )
    // 호출을 하나도 읽지 못해도 위반이 없는 것이 아니다 - 화면이 이 훅을 쓰는 한 검사가 호출을 읽어야 한다
    expect(calls.length, '읽은 호출').toBeGreaterThan(0)

    const violations = calls
      .filter((call) => !call.ok)
      .map(
        (call) =>
          `${call.where}: ${call.hook}() - listRouteParams(…) 로 거르거나 const { 이름 } = … 로 꺼낸다`,
      )
    expect(violations).toEqual([])
  })

  it.each([
    ['목록 화면의 입구', 'const params = listRouteParams(useLocalSearchParams())\n'],
    [
      'Prettier 가 줄을 나눈 입구',
      'const params = listRouteParams(\n  useLocalSearchParams(),\n)\n',
    ],
    [
      '제네릭을 단 입구',
      'const params = listRouteParams(useLocalSearchParams<{ sort: string }>())\n',
    ],
    ['이름으로 구조 분해', 'const { id } = useLocalSearchParams()\n'],
    ['제네릭을 단 구조 분해', 'const { id } = useLocalSearchParams<{ id: string }>()\n'],
    [
      '이름 바꾸기와 기본값',
      "const { id: itemId, tab = 'info' } = useLocalSearchParams<{ id: string; tab?: string }>()\n",
    ],
    ['타입 주석을 단 구조 분해', 'const { id }: { id: string } = useLocalSearchParams()\n'],
    ['let 구조 분해', 'let { id } = useLocalSearchParams()\n'],
    [
      '상수 키 하나를 바로 읽기(인증 화면의 모양)',
      'const rawNext = useLocalSearchParams()[LOGIN_REDIRECT_PARAM]\n',
    ],
    ['키 하나를 점으로 읽기', 'const id = useLocalSearchParams().id\n'],
    ['키 하나를 옵셔널 체이닝으로 읽기', 'const id = useLocalSearchParams<{ id: string }>()?.id\n'],
    ['useGlobalSearchParams 도 같다', 'const { id } = useGlobalSearchParams()\n'],
    ['import 지정자는 호출이 아니다', "import { useLocalSearchParams } from 'expo-router'\n"],
    ['줄 주석 안의 예시', '// const params = useLocalSearchParams()\n'],
    ['블록 주석 안의 예시', '/*\n * const params = useLocalSearchParams()\n */\n'],
    ['이름의 일부인 식별자', 'const params = useLocalSearchParamsLater()\n'],
  ])('허용: %s', (_name, source) => {
    expect(callsIn(source).filter((call) => !call.ok)).toEqual([])
  })

  it.each([
    ['통째로 받기', 'const params = useLocalSearchParams()\n'],
    ['제네릭을 달아 통째로 받기', 'const params = useLocalSearchParams<{ id: string }>()\n'],
    ['나머지 요소를 남기는 구조 분해', 'const { id, ...rest } = useLocalSearchParams()\n'],
    ['펼치기', 'const merged = { ...useLocalSearchParams(), extra: 1 }\n'],
    ['돌기', 'const pairs = Object.entries(useLocalSearchParams())\n'],
    [
      '다른 함수에 통째로 넘기기',
      'const list = useResourceList(EXAMPLE, useLocalSearchParams())\n',
    ],
    [
      'listRouteParams 에 다른 인자를 더 넘기기',
      'const params = listRouteParams(useLocalSearchParams(), extra)\n',
    ],
    ['listRouteParams 가 아닌 함수로 감싸기', 'const params = pick(useLocalSearchParams())\n'],
    [
      '결과를 변수에 담아 나중에 읽기',
      'const params = useLocalSearchParams()\nconst id = params.id\n',
    ],
    ['useGlobalSearchParams 통째로 받기', 'const params = useGlobalSearchParams()\n'],
    [
      '허용된 호출 옆의 위반도 잡는다',
      'const { id } = useLocalSearchParams()\nconst params = useLocalSearchParams()\n',
    ],
  ])('위반: %s', (_name, source) => {
    expect(callsIn(source).filter((call) => !call.ok).length).toBeGreaterThan(0)
  })

  it('위반의 위치는 줄 번호로 나온다', () => {
    const source =
      "import { useLocalSearchParams } from 'expo-router'\n\nconst a = useLocalSearchParams()\n"
    expect(callsIn(source).map((call) => call.line)).toEqual([3])
  })
})
