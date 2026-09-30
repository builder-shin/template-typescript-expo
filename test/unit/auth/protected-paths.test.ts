import { describe, expect, it } from 'vitest'
import { safeRedirectTarget } from '@/lib/auth/flow'
import {
  LOGIN_PATH,
  LOGIN_REDIRECT_PARAM,
  PROTECTED_PATH_PATTERNS,
  isProtectedPath,
  loginHref,
} from '@/lib/auth/protected-paths'

/**
 * 보호 경로 목록(스펙 7.3). 경로는 Expo Router 의 usePathname() 값이다 - 쿼리가 없고 동적
 * 세그먼트는 실제 값으로 채워져 있다.
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
