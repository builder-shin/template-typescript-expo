/**
 * 보호 경로 목록과 로그인으로 보내는 주소 - 스펙 7.3 의 첫 겹(경로 가드).
 *
 * 목록은 **여기 하나**다. `app/(app)/_layout.tsx` 가 (guard-latch.ts 의 `decideGuard()` 로) 지금 라우트를
 * 이 목록과 대조해 세션이 없으면 `loginHref()` 로 보낸다. 범위는 원본(template-typescript-nextjs)의
 * `PROTECTED_PATH_PATTERNS` 와 같다 - 생성과 수정·삭제 화면만 로그인이 필요하고 목록·상세·실험실은
 * 공개다.
 *
 * 앱 셸이 대조하는 것은 실제 경로가 아니라 라우트 모양이다(`routePattern` - `/examples/[id]/edit`).
 * Expo Router 의 `usePathname()` 은 파라미터 값을 풀어 경로를 다시 만든다 - id 에 `/` 가 든
 * `/examples/a%2Fb/edit` 는 `/examples/a/b/edit` 가 되어 아래 `[^/]+` 를 벗어난다. 라우트의
 * 세그먼트(`useSegments()`)는 파라미터 값을 담지 않는다. 패턴은 실제 경로(`/examples/42/edit`)도 받는다.
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
 * Expo Router 의 `useSegments()`(파일 경로의 세그먼트)에서 가드가 대조할 라우트 모양을 만든다. 그룹
 * 세그먼트(`(app)`)는 경로에 나타나지 않으므로 뺀다 - `['(app)', 'examples', '[id]', 'edit']` 는
 * `/examples/[id]/edit`, 홈(`['(app)']`)은 `/` 다.
 */
export function routePattern(segments: readonly string[]): string {
  const visible = segments.filter((segment) => !(segment.startsWith('(') && segment.endsWith(')')))
  return `/${visible.join('/')}`
}

/**
 * 보호 경로에서 막힌 사용자를 보내는 주소 - 원래 경로를 `next` 로 싣는다. 받는 쪽은 그 값을
 * `safeRedirectTarget()`(flow.ts)으로 다시 검사한다 - 딥링크로 들어온 `next` 는 믿을 수 없다.
 * 앱 셸은 `usePathname()` 을 넘긴다 - 파라미터 값이 풀린 경로라 id 에 `/` 가 든 화면은 로그인 뒤 다른
 * 경로로 돌아간다(없는 경로의 not-found). 씨앗과 세 백엔드가 만드는 id 는 UUID 라 `/` 가 없다.
 */
export function loginHref(pathname: string): string {
  return `${LOGIN_PATH}?${LOGIN_REDIRECT_PARAM}=${encodeURIComponent(pathname)}`
}
