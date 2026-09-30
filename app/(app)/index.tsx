import { View } from 'react-native'

import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'

export default function HomeScreen() {
  return (
    <View className="flex-1 items-center justify-center gap-4 bg-background p-6">
      <Text variant="h3">template-typescript-expo</Text>
      <Button testID="home-probe-button">
        <Text>Uniwind</Text>
      </Button>
    </View>
  )
}
