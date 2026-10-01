import { Link, Stack, router } from 'expo-router'
import { ScrollView } from 'react-native'

import { BuildInfoCard } from '@/components/app/build-info-card'
import { useNavigateOnce } from '@/components/app/navigate-once'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { useBuildInfoCard } from '@/queries/updates'

export default function HomeScreen() {
  // 실험실을 쌓는 이동은 한 번만 한다 - 빠른 두 번 누름이 실험실을 두 벌 쌓지 않게(components/app/navigate-once.ts).
  const navigateOnce = useNavigateOnce()
  const buildInfo = useBuildInfoCard()

  return (
    <ScrollView
      testID="home-screen"
      className="flex-1 bg-background"
      contentContainerClassName="flex-grow items-center justify-center gap-4 p-6"
    >
      <Stack.Screen options={{ title: '홈' }} />
      <Text variant="h3">template-typescript-expo</Text>
      <Link href="/examples" asChild>
        <Button testID="home-examples-link">
          <Text>Example 목록</Text>
        </Button>
      </Link>
      <Button
        testID="home-lab-link"
        variant="outline"
        onPress={() => {
          navigateOnce(() => {
            router.push('/contract')
          })
        }}
      >
        <Text>계약 실험실</Text>
      </Button>
      <BuildInfoCard {...buildInfo} />
    </ScrollView>
  )
}
