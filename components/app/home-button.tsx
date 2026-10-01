import type { NativeStackHeaderItemProps } from 'expo-router'

import { goHome } from '@/components/app/back-to-home'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'

/**
 * 헤더의 "홈으로" 버튼 - 가드가 보낸 로그인·가입 화면과, 밖에서 딥링크로 곧장 열린 계약 실험실의 눈에 보이는
 * 출구다(스펙 7.3). 그 화면들은 루트에 혼자 남아(components/app/back-to-home.ts) iOS 에는 뒤로 갈 길이 없다 -
 * 하드웨어 뒤로 가기도, 헤더의 뒤로 가기 버튼도 없다. Android 에서도 같은 길을 준다(뒤로 가기와 같은 이동이다).
 *
 * 뒤로 갈 화면이 있으면 그리지 않는다 - 그때는 헤더에 네이티브 뒤로 가기 버튼이 이미 있다(홈에서 연 실험실이 그렇다).
 * 내비게이터가 헤더의 `headerRight` 에 `canGoBack` 을 넘겨 주므로(`renderHomeButton`) 상태를 따로 읽지 않는다. 가드가
 * 보낸 화면과 딥링크로 곧장 연 실험실은 루트에 혼자라 그 값이 거짓이다.
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

/**
 * `Stack.Screen` 의 `headerRight` 에 그대로 건다 - 렌더마다 새 함수를 만들지 않는다. `canGoBack` 이 참일 때만 버튼을
 * 숨긴다: 모르는 값이면 그린다 - 출구가 없는 쪽으로 실패하지 않는다.
 */
export const renderHomeButton = ({ canGoBack }: NativeStackHeaderItemProps) =>
  canGoBack === true ? null : <HomeButton />
