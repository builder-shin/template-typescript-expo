import { View } from 'react-native'

import { Text } from '@/components/ui/text'

/**
 * 설정 오류로 앱을 시작할 수 없을 때의 화면(스펙 10.1). 문구는 검증 함수가 낸 원문이라
 * 변수 이름이 들어 있다.
 */
export function FatalConfig({ message }: { message: string }) {
  return (
    <View testID="fatal-config" className="flex-1 items-center justify-center bg-background p-6">
      <Text variant="h4">설정 오류</Text>
      <Text className="mt-2 text-center text-muted-foreground">{message}</Text>
    </View>
  )
}
