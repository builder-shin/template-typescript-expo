import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import type { getRouteInfoFromState } from 'expo-router/build/global-state/getRouteInfoFromState'
import { describe, expect, it } from 'vitest'

import { decideGuard } from '@/lib/auth/guard-latch'
import { isProtectedPath, routePattern } from '@/lib/auth/protected-paths'

/**
 * 경로 가드가 보호 판정에 쓰는 것은 `usePathname()` 이 아니라 라우트 모양(`routePattern(useSegments())`)이다 - 스펙 7.3
 * 의 D4 정정(이월 노트 docs/superpowers/notes/2026-10-01-d2-carry-forward.md 의 D4 절). 이 시험은 그 까닭을 설치본
 * Expo Router(57.0.24)의 라우트 정보로 못 박고, 앱 셸(app/(app)/_layout.tsx)이 가드에 그 모양을 넘기는지 소스에서 잰다.
 *
 * 앞의 두 describe 는 `usePathname()`·`useSegments()` 가 읽는 값을 만드는 함수(`getRouteInfoFromState` - 두 훅이
 * `useRouteInfo()` 로 읽는다)에 내비게이션 상태를 먹인다. 그 함수가 부르는 `fork/getPathFromState-forks` 는 react-native 를
 * 끌어와 node 에서 불러지지 않아, 거기서 쓰는 `appendBaseUrl` 하나(`unstable_globalHref` 만 만든다 - 아래 단언과 무관하다)만
 * 대신하고, 세그먼트를 모으고 파라미터를 풀어 경로를 다시 만드는 식은 설치본 그대로 돈다. Expo Router 를 올려 그 식이
 * 바뀌면 이 시험이 먼저 실패한다(deep-link.test.ts 가 설치본으로 재는 것과 같다).
 *
 * 마지막 describe 는 앱 셸의 소스를 훑는다. 컴포넌트 시험이 없어(스펙 11.1) 레이아웃을 `usePathname()` 을 그대로 가드에 넘기던
 * 모양으로 되돌려도 다른 시험은 모두 통과한다 - route-params-usage.test.ts 와 같은 방식의 파일 훑기다.
 */

const rootRequire = createRequire(resolve('package.json'))

/** 설치본의 `getRouteInfoFromState` - react-native 를 끌어오는 모듈 하나만 대신해서 불러온다(위 머리말). */
function loadRouteInfoFromState(): typeof getRouteInfoFromState {
  const forks = rootRequire.resolve('expo-router/build/fork/getPathFromState-forks')
  const target = rootRequire.resolve('expo-router/build/global-state/getRouteInfoFromState')
  rootRequire.cache[forks] = {
    id: forks,
    filename: forks,
    loaded: true,
    exports: { appendBaseUrl: (path: string) => path },
  } as unknown as NodeModule
  try {
    const loaded = rootRequire(target) as { getRouteInfoFromState: typeof getRouteInfoFromState }
    return loaded.getRouteInfoFromState
  } finally {
    // 대신한 것을 쥔 채 캐시에 남지 않게 한다 - 같은 프로세스의 다른 시험이 진짜 모듈을 받는다. 불러온 함수는 이미 쥐고 있다.
    delete rootRequire.cache[forks]
    delete rootRequire.cache[target]
  }
}

const routeInfoOf = loadRouteInfoFromState()

/**
 * 앱의 라우트 하나가 앞에 있을 때의 내비게이션 상태 - 루트 슬롯(`__root`) 아래 `(app)` 레이아웃 아래 파일 라우트다.
 * 라우트 이름은 레이아웃 기준 파일 경로(`examples/[id]/edit`)이고, 동적 세그먼트의 값은 `params` 에 있다.
 */
function stateOf(routeName: string, params?: Record<string, string>) {
  const route = params === undefined ? { name: routeName } : { name: routeName, params }
  return {
    routes: [
      { name: '__root', state: { routes: [{ name: '(app)', state: { routes: [route] } }] } },
    ],
  }
}

const EDIT_SEGMENTS = ['(app)', 'examples', '[id]', 'edit']

describe('설치본 Expo Router 의 라우트 정보 - usePathname()·useSegments() 가 읽는 값', () => {
  it('id 에 %2F 가 들면 pathname 은 값을 풀어 보호 경로를 벗어나고 segments 는 라우트 모양으로 남는다', () => {
    const info = routeInfoOf(stateOf('examples/[id]/edit', { id: 'a%2Fb' }))

    // usePathname() - 파라미터 값을 풀어 경로를 다시 만든다. `/` 가 든 id 는 경로 조각이 둘이 된다.
    expect(info.pathname).toBe('/examples/a/b/edit')
    expect(isProtectedPath(info.pathname)).toBe(false)
    // useSegments() - 라우트 이름이라 `[id]` 가 값 없이 그대로 남는다.
    expect(info.segments).toEqual(EDIT_SEGMENTS)
    expect(routePattern(info.segments)).toBe('/examples/[id]/edit')
    expect(isProtectedPath(routePattern(info.segments))).toBe(true)
  })

  it.each(['42', 'a%2Fb', 'a/b', 'a b', '가나다', '%E0%A4%A'])(
    '라우트 모양은 id 의 값(%s)과 무관하다',
    (id) => {
      expect(routeInfoOf(stateOf('examples/[id]/edit', { id })).segments).toEqual(EDIT_SEGMENTS)
    },
  )

  it.each<[string, string[], string, boolean]>([
    ['index', ['(app)'], '/', false],
    ['examples/index', ['(app)', 'examples'], '/examples', false],
    ['examples/new', ['(app)', 'examples', 'new'], '/examples/new', true],
    ['examples/[id]/index', ['(app)', 'examples', '[id]'], '/examples/[id]', false],
    ['examples/[id]/edit', EDIT_SEGMENTS, '/examples/[id]/edit', true],
  ])(
    '라우트 %s → 세그먼트 %j → 라우트 모양 %s (보호: %s)',
    (routeName, segments, pattern, guarded) => {
      const info = routeInfoOf(stateOf(routeName, { id: '42' }))
      expect(info.segments).toEqual(segments)
      expect(routePattern(info.segments)).toBe(pattern)
      expect(isProtectedPath(pattern)).toBe(guarded)
    },
  )
})

describe('앱 셸이 가드에 넘기는 입력', () => {
  const signedOut = (pathname: string) =>
    decideGuard({ status: 'signedOut', loggingOut: false, latched: false, pathname })

  it('세션이 없고 id 에 %2F 가 든 수정 화면이면 라우트 모양을 넘겨야 로그인으로 보낸다 - 경로를 넘기면 가드가 비껴간다', () => {
    const info = routeInfoOf(stateOf('examples/[id]/edit', { id: 'a%2Fb' }))

    expect(signedOut(routePattern(info.segments)).redirect).toBe(true)
    // usePathname() 을 그대로 넘기던 배선의 결과 - 보호 경로가 공개로 읽혀 화면이 그려진다.
    expect(signedOut(info.pathname).redirect).toBe(false)
  })
})

/**
 * 앱 셸(app/(app)/_layout.tsx)의 가드 배선. 가드(`decideGuard`)가 받는 `pathname` 은 `routePattern(useSegments())` 에서
 * 온 것이어야 하고, 로그인 주소(`loginHref`)에 싣는 `next` 는 `usePathname()` 의 값 그대로여야 한다 - 라우트 모양
 * (`/examples/[id]/edit`)을 싣고 가면 로그인 뒤 없는 경로로 돌아간다.
 */
const LAYOUT = 'app/(app)/_layout.tsx'

/** 주석을 같은 길이의 공백으로 바꾼다 - 주석 속의 예시는 배선이 아니다. */
function withoutComments(text: string): string {
  const blank = (match: string) => match.replace(/[^\n]/g, ' ')
  return text.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/\/\/[^\n]*/g, blank)
}

const IDENTIFIER = String.raw`[A-Za-z_$][\w$]*`
const ROUTE_SHAPE = String.raw`routePattern\s*\(\s*useSegments\s*\(\s*\)\s*\)`

/** 앱 셸의 가드 배선에서 어긋난 곳을 말로 돌려준다 - 빈 배열이면 맞다. */
function guardWiringProblems(source: string): string[] {
  const text = withoutComments(source)
  const problems: string[] = []

  const guardArguments = /\bdecideGuard\s*\(\s*\{([^{}]*)\}\s*\)/.exec(text)?.[1]
  if (guardArguments === undefined) {
    problems.push('decideGuard({ … }) 호출을 읽지 못했다')
  } else {
    // `const route = routePattern(useSegments())` 로 만든 변수를 넘기거나, 호출을 그 자리에 쓴다.
    const shape = new RegExp(
      String.raw`\b(?:const|let)\s+(${IDENTIFIER})\s*=\s*${ROUTE_SHAPE}`,
    ).exec(text)?.[1]
    const inline = new RegExp(String.raw`\bpathname\s*:\s*${ROUTE_SHAPE}`).test(guardArguments)
    const named = new RegExp(String.raw`\bpathname\s*:\s*(${IDENTIFIER})\s*(?:,|$)`).exec(
      guardArguments,
    )?.[1]
    if (!inline && (named === undefined || named !== shape)) {
      problems.push('decideGuard 의 pathname 이 routePattern(useSegments()) 에서 오지 않는다')
    }
  }

  const real = new RegExp(
    String.raw`\b(?:const|let)\s+(${IDENTIFIER})\s*=\s*usePathname\s*\(\s*\)`,
  ).exec(text)?.[1]
  const next = new RegExp(String.raw`\bloginHref\s*\(\s*(${IDENTIFIER})\s*\)`).exec(text)?.[1]
  if (real === undefined || next !== real) {
    problems.push(
      'loginHref 가 usePathname() 의 값을 받지 않는다 - next 로 실리는 것은 실제 경로다',
    )
  }

  return problems
}

/** 맞게 배선한 앱 셸의 핵심 줄 - 아래 변형이 한 군데씩 어긋나게 한다. */
const WIRED = `
const pathname = usePathname()
const route = routePattern(useSegments())
const guard = decideGuard({ status, loggingOut, latched, pathname: route })
if (guard.redirect) {
  const target = loginHref(pathname) as Href
}
`

function wiredWith(from: string, to: string): string {
  // 바꿀 자리가 없으면 변형이 기준과 같아져 "위반" 시험이 아무것도 재지 못한다
  if (!WIRED.includes(from)) throw new Error(`기준 배선에 없는 자리다: ${from}`)
  return WIRED.replace(from, to)
}

describe('app/(app)/_layout.tsx - 가드 배선', () => {
  it('앱 셸은 가드에 라우트 모양을 넘기고 next 에는 실제 경로를 싣는다', () => {
    const source = readFileSync(LAYOUT, 'utf8')
    // 읽은 것이 없으면 위반이 없는 것이 아니라 검사가 망가진 것이다(경로가 틀렸다)
    expect(source).toContain('decideGuard')
    expect(guardWiringProblems(source)).toEqual([])
  })

  it.each([
    ['기준 배선', WIRED],
    [
      '라우트 모양을 호출 자리에 쓴다',
      wiredWith('const route = routePattern(useSegments())\n', '').replace(
        'pathname: route',
        'pathname: routePattern(useSegments())',
      ),
    ],
    [
      '변수 이름이 달라도 된다',
      wiredWith('const route =', 'const shape =').replace('pathname: route', 'pathname: shape'),
    ],
    [
      'Prettier 가 줄을 나눈 호출',
      wiredWith(
        'decideGuard({ status, loggingOut, latched, pathname: route })',
        'decideGuard({\n  status,\n  loggingOut,\n  latched,\n  pathname: route,\n})',
      ),
    ],
    [
      '주석 속의 예전 배선은 배선이 아니다',
      `// const guard = decideGuard({ status, loggingOut, latched, pathname })\n/* loginHref(route) */\n${WIRED}`,
    ],
  ])('맞다: %s', (_name, source) => {
    expect(guardWiringProblems(source)).toEqual([])
  })

  it.each([
    [
      'usePathname() 을 그대로 넘기던 배선으로 되돌린다(줄임꼴)',
      wiredWith('const route = routePattern(useSegments())\n', '').replace(
        'pathname: route',
        'pathname',
      ),
    ],
    ['pathname: pathname 으로 넘긴다', wiredWith('pathname: route', 'pathname: pathname')],
    ['라우트 모양을 만들어 두고 넘기지 않는다', wiredWith('pathname: route', 'pathname')],
    [
      '라우트 모양을 경로에서 만든다',
      wiredWith('routePattern(useSegments())', 'routePattern(pathname.split("/"))'),
    ],
    [
      '라우트 모양을 변수에 담지 않고 다른 값을 넘긴다',
      wiredWith('pathname: route', 'pathname: segments'),
    ],
    ['next 에 라우트 모양을 싣는다', wiredWith('loginHref(pathname)', 'loginHref(route)')],
    ['next 를 싣는 호출이 없다', wiredWith('loginHref(pathname)', 'loginHref("/")')],
    [
      'decideGuard 호출이 없다',
      wiredWith('decideGuard({ status, loggingOut, latched, pathname: route })', 'undefined'),
    ],
  ])('어긋남: %s', (_name, source) => {
    expect(guardWiringProblems(source).length).toBeGreaterThan(0)
  })
})
