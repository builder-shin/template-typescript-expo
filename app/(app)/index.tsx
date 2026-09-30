import { Stack } from 'expo-router'
import { View } from 'react-native'

import { Text } from '@/components/ui/text'

export default function HomeScreen() {
  return (
    <View
      testID="home-screen"
      className="flex-1 items-center justify-center gap-4 bg-background p-6"
    >
      <Stack.Screen options={{ title: '홈' }} />
      <Text variant="h3">template-typescript-expo</Text>
    </View>
  )
}
