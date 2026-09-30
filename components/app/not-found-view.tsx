import { Link } from 'expo-router'
import { View } from 'react-native'

import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'

/**
 * 가리키는 것이 없을 때의 화면 - 없는 경로(`app/+not-found.tsx`)와 없는 자원의 상세(백엔드의
 * `RESOURCE_NOT_FOUND`, 스펙 9.2)가 함께 쓴다. 문구는 template-typescript-nextjs 의
 * `app/not-found.tsx` 와 같다.
 *
 * "홈으로 이동" 은 홈까지 닫는다(`dismissTo`) - 쌓인 화면 위에 홈을 한 벌 더 쌓지 않는다.
 */
export function NotFoundView() {
  return (
    <View
      testID="not-found-screen"
      className="flex-1 items-center justify-center gap-4 bg-background p-6"
    >
      <Text variant="h4" className="text-center">
        페이지를 찾을 수 없습니다
      </Text>
      <Text className="text-center text-sm text-muted-foreground">
        요청하신 페이지가 존재하지 않거나 이동되었습니다.
      </Text>
      <Link href="/" dismissTo asChild>
        <Button testID="not-found-home">
          <Text>홈으로 이동</Text>
        </Button>
      </Link>
    </View>
  )
}
