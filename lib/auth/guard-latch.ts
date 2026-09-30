import { isProtectedPath } from './protected-paths'
import type { SessionStatus } from './session-manager'

/**
 * 경로 가드의 판단 - 스펙 7.3 의 첫 겹. app/(app)/_layout.tsx 가 렌더마다 부른다.
 *
 * "세션이 없는데 보호 경로에 있다"만으로 보내면 로그아웃 직후에 틀린다. 로그아웃은 기기 세션을 먼저
 * 비우고(signedOut) 폐기 요청이 끝난 뒤에야 끝나며, 끝나면 홈으로 보낸다(logout.ts 의
 * POST_LOGOUT_PATH). 두 가지가 겹친다:
 *
 *   - 세션이 비워진 순간부터 끝날 때까지는 signedOut 이지만 방금 스스로 나간 사용자다. 로그인 화면으로
 *     보내면 "왜 다시 들어오라는 거지"가 된다 - `loggingOut` 인 동안은 보내지 않는다.
 *   - 홈으로의 이동은 큐에 들어갈 뿐 적용은 나중이고, `loggingOut` 을 알리는 쪽은 다른 경로로 알린다.
 *     둘의 순서는 정해져 있지 않다. 끝난 렌더에서 pathname 이 아직 옛 보호 경로일 수 있고, 그 렌더에서
 *     가드가 돌면 방금 로그아웃한 사용자를 로그인 화면으로 보낸다.
 *
 * 그래서 **래치**를 둔다. 로그아웃이 진행되는 동안 걸고, 끝난 뒤에도 pathname 이 보호 경로인 동안
 * (이동이 적용되기 전) 계속 걸어 둔다. 보호 경로를 벗어나면 풀린다. 순서를 가정하지 않는다 - 어느 쪽이
 * 먼저 와도 결과가 같다.
 *
 * 래치는 세션이 없을 때만 유지한다(로그인 상태로 돌아왔으면 푼다). 남겨 두면 그 뒤에 인증 오류로
 * 세션만 사라졌을 때 보호 경로에서 보내지 못한다.
 *
 * 호출자가 `latched` 를 들고 있다가(앱 셸은 상태로) 돌려받은 값을 다음 렌더에 넣는다. 돌려준 값을 다시
 * 넣으면 같은 판단이 나온다 - 렌더 중에 상태를 갱신해도 한 번에 가라앉는다(시험이 모든 입력에서 잰다).
 */

export interface GuardInput {
  status: SessionStatus
  /** 로그아웃이 진행 중인가(queries/auth.ts 의 useIsLoggingOut). */
  loggingOut: boolean
  /** 지난 렌더가 돌려준 `latched`. 처음에는 false 다. */
  latched: boolean
  /** Expo Router 의 usePathname() 값. */
  pathname: string
}

export interface GuardDecision {
  /** true 면 로그인으로 보낸다(`loginHref`). */
  redirect: boolean
  /** 다음 렌더에 넘길 값. */
  latched: boolean
}

export function decideGuard({ status, loggingOut, latched, pathname }: GuardInput): GuardDecision {
  const protectedPath = isProtectedPath(pathname)
  const signedOut = status === 'signedOut'
  const holding = loggingOut || (latched && protectedPath && signedOut)

  return { redirect: signedOut && protectedPath && !holding, latched: holding }
}
