import { router } from 'expo-router'
import { ActivityIndicator } from 'react-native'

import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { POST_LOGOUT_PATH } from '@/lib/auth/logout'
import { useIsLoggingOut, useLogoutMutation } from '@/queries/auth'

/**
 * 헤더의 로그아웃 버튼(스펙 7.4). 로그인했을 때(와 로그아웃이 끝나기 전까지) 그린다 - 그 판단은
 * app/(app)/_layout.tsx 가 한다. 앱 셸의 헤더 안에서만 그리므로 router 를 부를 때 내비게이터는 늘
 * 떠 있다.
 *
 * 이동은 훅의 onSettled 에서 한다(queries/auth.ts). 서버 호출이 실패해도 기기 쪽은 이미 비었으므로
 * 성공·실패 모두 홈으로 간다. 누르는 동안에는 글자 대신 스피너만 그리고(스펙 8.7) 누를 수 없다 -
 * logout() 이 끝날 때까지, 세션이 먼저 비워진 뒤에도 그렇다. 진행 여부는 눌린 버튼이 아니라 진행
 * 중인 로그아웃을 본다: 헤더는 스택의 화면마다 하나씩 있어서, 눌린 화면이 닫히고 홈의 버튼이 남아도
 * 그 버튼이 같은 스피너를 그린다.
 */
export function LogoutButton() {
  const logout = useLogoutMutation(() => {
    router.dismissTo(POST_LOGOUT_PATH)
  })
  const pending = useIsLoggingOut()

  return (
    <Button
      testID="logout-button"
      variant="ghost"
      size="sm"
      accessibilityLabel="로그아웃"
      aria-busy={pending}
      disabled={pending}
      onPress={() => {
        logout.mutate()
      }}
    >
      {pending ? <ActivityIndicator colorClassName="accent-foreground" /> : <Text>로그아웃</Text>}
    </Button>
  )
}
