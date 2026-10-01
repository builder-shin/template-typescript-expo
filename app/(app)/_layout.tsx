import { Redirect, Stack, usePathname, useSegments, type Href } from 'expo-router'
import { useState } from 'react'

import { LogoutButton } from '@/components/app/logout-button'
import { decideGuard } from '@/lib/auth/guard-latch'
import { loginHref, routePattern } from '@/lib/auth/protected-paths'
import { useSessionStatus } from '@/platform/session'
import { useIsLoggingOut } from '@/queries/auth'

/**
 * 앱 셸 - Stack 헤더와 경로 가드(스펙 4장·7.3).
 *
 * 경로 가드: 세션이 없는데 보호 경로(lib/auth/protected-paths.ts)에 있으면 로그인으로 보낸다. 원래
 * 경로는 `next` 로 실려 가고, 로그인 화면이 그 값을 검사해 돌아온다. 쓰기 가드(두 번째 겹)는 쓰기
 * 훅이 요청 직전에 세션을 다시 확인한다 - 화면 전환 시점의 이 판단은 그 사이에 세션이 사라지는
 * 경우를 보지 못한다.
 *
 * 가드는 이 레이아웃 안에 있다. 루트 레이아웃은 세션 복원이 끝나야 Stack 을 그리므로(복원 중에는
 * 내비게이터가 없어 router 를 부르면 던진다) 그 전에 이 레이아웃이 그려질 수 없다 - Redirect 는
 * 내비게이터가 뜬 뒤에만 불린다.
 *
 * 헤더에는 로그인했을 때 로그아웃 버튼만 그린다(스펙 7.4). 사용자 이름을 그리려면 `/users/me` 가
 * 필요한데 부르지 않는다.
 *
 * 로그아웃은 기기 세션을 먼저 비우고(세션이 signedOut 이 된다) 폐기 요청이 끝난 뒤에야 끝난다. 그
 * 사이에는 로그인한 화면 그대로 둔다: 버튼이 사라지면 스피너가 끝나기 전에 사라지고, 보호 경로에서는
 * 가드가 방금 로그아웃한 사용자를 로그인 화면으로 보낸다. 끝나면 로그아웃 버튼의 onSettled 가
 * 홈으로 보내는데 그 이동은 나중에 적용된다 - 끝난 렌더에서 경로가 아직 보호 경로여도 가드가 돌지 않게
 * 래치를 든다(lib/auth/guard-latch.ts, 판단과 그 이유는 거기 있다).
 */

// 딥링크나 로그인 뒤 복귀로 안쪽 화면에 바로 들어와도 그 아래에 홈이 깔린다 - 뒤로 가기가 앱을
// 닫지 않는다. 앵커는 콜드 스타트의 딥링크에는 저절로 실리지만, 이미 떠 있는 앱에서 (app) 을 새로
// 만드는 이동에는 실리지 않는다 - 로그인·가입 뒤 복귀(dismissTo)가 withAnchor 를 주는 까닭이다.
export const unstable_settings = { anchor: 'index' }

const renderLogoutButton = () => <LogoutButton />

export default function AppLayout() {
  const pathname = usePathname()
  // 보호 판정은 라우트 모양으로 한다 - usePathname() 은 id 의 %2F 를 풀어 경로를 다시 만들어 보호 경로를
  // 벗어난다(lib/auth/protected-paths.ts). 로그인 뒤 돌아올 경로(next)는 그대로 pathname 이다.
  const route = routePattern(useSegments())
  const status = useSessionStatus()
  const loggingOut = useIsLoggingOut()
  const [latched, setLatched] = useState(false)

  const guard = decideGuard({ status, loggingOut, latched, pathname: route })
  // 래치를 렌더 중에 갱신한다(이전 렌더의 값에서 파생하는 상태). 돌려준 값을 다시 넣으면 같은 판단이
  // 나오므로(시험이 모든 입력에서 잰다) 한 번의 재렌더로 가라앉는다. 효과에서 갱신하면 그만큼 늦다.
  if (guard.latched !== latched) setLatched(guard.latched)

  if (guard.redirect) {
    // loginHref 는 런타임에 만든 앱 안 경로다 - 타입드 라우트가 모르는 문자열이라 단언한다. 단언을
    // 변수에 담는다: prop 자리에 두면 타입드 라우트를 만들기 전(새 체크아웃)의 lint 가 받는 쪽이
    // string 을 받는다며 "불필요한 단언"으로 본다.
    const target = loginHref(pathname) as Href
    return <Redirect href={target} />
  }

  return (
    <Stack
      screenOptions={status === 'signedIn' || loggingOut ? { headerRight: renderLogoutButton } : {}}
    />
  )
}
