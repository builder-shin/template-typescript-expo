import { goHome } from '@/components/app/back-to-home'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'

/**
 * 헤더의 "홈으로" 버튼 - 가드가 보낸 로그인·가입 화면의 눈에 보이는 출구다(스펙 7.3). 그 화면은 루트에 혼자
 * 남아(components/app/back-to-home.ts) iOS 에는 뒤로 갈 길이 없다 - 하드웨어 뒤로 가기도, 헤더의 뒤로 가기
 * 버튼도 없다. Android 에서도 같은 길을 준다(뒤로 가기와 같은 이동이다).
 *
 * 돌아갈 곳이 있는 화면에서도 그린다 - 헤더의 오른쪽이라 있는 뒤로 가기 버튼을 가리지 않는다. 판단하려면 내비게이터의
 * 상태를 렌더 중에 읽어야 하는데 그 값은 렌더에서 읽도록 정해진 값이 아니다.
 *
 * testID `back-to-home-button` 은 E2E 플로(test/e2e/)가 찾는 이름이다.
 */
export function HomeButton() {
  return (
    <Button
      testID="back-to-home-button"
      variant="ghost"
      size="sm"
      accessibilityLabel="홈으로"
      onPress={goHome}
    >
      <Text>홈으로</Text>
    </Button>
  )
}

/** `Stack.Screen` 의 `headerRight` 에 그대로 건다 - 렌더마다 새 함수를 만들지 않는다. */
export const renderHomeButton = () => <HomeButton />
