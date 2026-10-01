import { router } from 'expo-router'
import { useEffect } from 'react'
import { BackHandler } from 'react-native'

/**
 * 홈으로 간다. (app) 을 새로 만든다 - 로그인 뒤 복귀(login.tsx)와 같은 이유로 withAnchor 를 준다. 경로 가드의
 * Redirect 가 (app) 을 로그인 화면으로 바꿔 끼웠으므로 홈은 스택에 없고, 앵커를 싣지 않으면 (app) 이 홈 하나로
 * 시작하지 못한다. Android 의 뒤로 가기(`useBackToHome`)와 헤더의 "홈으로" 버튼(`HomeButton`)이 함께 쓴다.
 */
export function goHome(): void {
  router.dismissTo('/', { withAnchor: true })
}

/**
 * 뒤로 갈 곳이 없는 화면에서 Android 의 뒤로 가기를 홈으로 돌린다 - 로그인·가입 화면이 쓴다.
 *
 * 경로 가드(app/(app)/_layout.tsx)의 Redirect 는 루트에서 (app) 을 로그인 화면으로 바꿔 끼운다
 * (REPLACE) - 루트에 로그인 화면 하나만 남아, 목록의 "새로 만들기" 나 상세의 "수정" 에서 막힌 사용자가
 * 뒤로 가면 앱이 닫힌다. 그래서 내비게이터가 돌아갈 곳이 없을 때만 홈으로 보낸다. 돌아갈 곳이 있으면
 * (다른 화면 위에 쌓였으면) 손대지 않는다 - 내비게이터가 뒤로 간다.
 *
 * iOS 에는 뒤로 가기 키가 없고 화면이 하나뿐이면 헤더에도 뒤로 가기 버튼이 없다 - 그 사용자에게는 이 훅이 닿지
 * 않으므로 같은 이동을 눈에 보이는 버튼으로 따로 준다(`HomeButton`, components/app/home-button.tsx).
 *
 * 이 화면의 핸들러가 내비게이터의 것보다 나중에 걸려 먼저 불린다(BackHandler 는 나중에 건 것부터 부른다).
 */
export function useBackToHome(): void {
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (router.canGoBack()) return false
      goHome()
      return true
    })
    return () => {
      subscription.remove()
    }
  }, [])
}
