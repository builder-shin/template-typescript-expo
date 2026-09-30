/**
 * 보호 경로 목록과 로그인으로 보내는 주소 - 스펙 7.3 의 첫 겹(경로 가드).
 *
 * 목록은 **여기 하나**다. `app/(app)/_layout.tsx` 가 현재 경로를 이 목록과 대조해 세션이 없으면
 * `loginHref()` 로 보낸다. 범위는 원본(template-typescript-nextjs)의 `PROTECTED_PATH_PATTERNS` 와
 * 같다 - 생성과 수정·삭제 화면만 로그인이 필요하고 목록·상세·실험실은 공개다.
 *
 * 경로는 Expo Router 의 `usePathname()` 값이다 - 쿼리가 없고, 동적 세그먼트는 실제 값으로 채워져
 * 있다(`/examples/42/edit`).
 */

/** 로그인 화면의 경로. */
export const LOGIN_PATH = '/login'

/**
 * 로그인 뒤 돌아갈 경로를 싣는 파라미터 이름. 로그인·가입 화면이 같은 이름으로 읽는다 - 한쪽만
 * 바뀌면 로그인 뒤 복귀가 아무 오류 없이 홈으로 떨어진다.
 */
export const LOGIN_REDIRECT_PARAM = 'next'

export const PROTECTED_PATH_PATTERNS: readonly RegExp[] = [
  /^\/examples\/new$/,
  /^\/examples\/[^/]+\/edit$/,
]

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATH_PATTERNS.some((pattern) => pattern.test(pathname))
}

/**
 * 보호 경로에서 막힌 사용자를 보내는 주소 - 원래 경로를 `next` 로 싣는다. 받는 쪽은 그 값을
 * `safeRedirectTarget()`(flow.ts)으로 다시 검사한다 - 딥링크로 들어온 `next` 는 믿을 수 없다.
 */
export function loginHref(pathname: string): string {
  return `${LOGIN_PATH}?${LOGIN_REDIRECT_PARAM}=${encodeURIComponent(pathname)}`
}
