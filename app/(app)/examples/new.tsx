import { Stack } from 'expo-router'
import { View } from 'react-native'

import { Text } from '@/components/ui/text'

/**
 * Example 생성 화면의 자리. 폼은 아직 없다 - 지금 이 라우트는 경로 가드(스펙 7.3)의 대상이다.
 * lib/auth/protected-paths.ts 가 이 경로(/examples/new)를 보호 경로로 둔다. 라우트가 없으면
 * Expo Router 가 (app) 레이아웃 밖의 Unmatched 화면을 그려 가드가 돌지 않는다.
 */
export default function NewExampleScreen() {
  return (
    <View testID="new-example-screen" className="flex-1 bg-background p-6">
      <Stack.Screen options={{ title: 'Example 만들기' }} />
      <Text variant="h3">Example 만들기</Text>
    </View>
  )
}
