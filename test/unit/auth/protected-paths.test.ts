import { describe, expect, it } from 'vitest'
import { safeRedirectTarget } from '@/lib/auth/flow'
import {
  LOGIN_PATH,
  LOGIN_REDIRECT_PARAM,
  PROTECTED_PATH_PATTERNS,
  isProtectedPath,
  loginHref,
  routePattern,
} from '@/lib/auth/protected-paths'

/**
 * 보호 경로 목록(스펙 7.3). 패턴은 실제 경로(`/examples/42/edit`)와 앱 셸이 넘기는 라우트 모양
 * (`/examples/[id]/edit`, routePattern) 둘 다 받는다.
 */
describe('isProtectedPath', () => {
  it.each(['/examples/new', '/examples/42/edit', '/examples/probe-id/edit'])(
    '%s 는 보호 경로다',
    (pathname) => {
      expect(isProtectedPath(pathname)).toBe(true)
    },
  )

  it.each([
    '/',
    '/examples',
    '/examples/42',
    '/examples/new/extra',
    '/examples/42/edit/extra',
    '/examples//edit',
    '/login',
    '/register',
    '/contract',
  ])('%s 는 공개다', (pathname) => {
    expect(isProtectedPath(pathname)).toBe(false)
  })

  it('목록은 원본의 PROTECTED_PATH_PATTERNS 와 같은 범위다 - 생성, 수정·삭제', () => {
    expect(PROTECTED_PATH_PATTERNS).toHaveLength(2)
  })
})

describe('routePattern - 앱 셸이 대조하는 라우트 모양', () => {
  it.each<[string[], string]>([
    [['(app)'], '/'],
    [['(app)', 'examples'], '/examples'],
    [['(app)', 'examples', 'new'], '/examples/new'],
    [['(app)', 'examples', '[id]'], '/examples/[id]'],
    [['(app)', 'examples', '[id]', 'edit'], '/examples/[id]/edit'],
    [['(auth)', 'login'], '/login'],
  ])('%j → %s - 그룹 세그먼트는 뺀다', (segments, pattern) => {
    expect(routePattern(segments)).toBe(pattern)
  })

  it('생성과 수정의 라우트 모양은 보호 경로이고 상세는 아니다 - id 의 값과 무관하다', () => {
    expect(isProtectedPath(routePattern(['(app)', 'examples', 'new']))).toBe(true)
    expect(isProtectedPath(routePattern(['(app)', 'examples', '[id]', 'edit']))).toBe(true)
    expect(isProtectedPath(routePattern(['(app)', 'examples', '[id]']))).toBe(false)
  })

  it('usePathname() 이 id 의 %2F 를 풀어 만든 경로는 패턴을 벗어난다 - 그래서 경로가 아니라 라우트 모양으로 대조한다', () => {
    expect(isProtectedPath('/examples/a/b/edit')).toBe(false)
  })
})

describe('loginHref', () => {
  it('원래 경로를 next 에 인코딩해 싣는다', () => {
    expect(loginHref('/examples/42/edit')).toBe('/login?next=%2Fexamples%2F42%2Fedit')
  })

  it('받는 쪽이 같은 이름으로 읽으면 원래 경로가 그대로 나온다', () => {
    const [path, query] = loginHref('/probe path/a&b=c').split('?')
    expect(path).toBe(LOGIN_PATH)
    expect(new URLSearchParams(query).get(LOGIN_REDIRECT_PARAM)).toBe('/probe path/a&b=c')
  })

  it('실린 경로는 복귀 검사(safeRedirectTarget)를 통과한다 - 가드와 검사가 같은 모양을 쓴다', () => {
    const query = loginHref('/examples/new').split('?')[1]
    const next = new URLSearchParams(query).get(LOGIN_REDIRECT_PARAM)
    expect(safeRedirectTarget(next, '/probe-fallback')).toBe('/examples/new')
  })

  it('로그인 화면 자신은 보호 경로가 아니다 - 가드가 자기 자신으로 보내며 돌지 않는다', () => {
    expect(isProtectedPath(LOGIN_PATH)).toBe(false)
  })
})
