import { ActivityIndicator } from 'react-native'

import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'

/**
 * 폼 제출 버튼 - 제출 중에는 라벨 대신 스피너만 그린다(스펙 8.7, 로딩 상태에 텍스트를 쓰지
 * 않는다). 스피너로 바뀌어도 접근 가능한 이름은 라벨 그대로다(accessibilityLabel).
 *
 * 스피너가 ActivityIndicator 인 이유: Uniwind 1.12 에는 animate-spin 같은 CSS 애니메이션이 없어
 * 아이콘(Loader2)은 돌지 않는다.
 */
export function SubmitButton({
  testID,
  label,
  pending,
  onPress,
}: {
  testID: string
  label: string
  pending: boolean
  onPress: () => void
}) {
  return (
    <Button
      testID={testID}
      accessibilityLabel={label}
      aria-busy={pending}
      disabled={pending}
      onPress={onPress}
    >
      {pending ? (
        <ActivityIndicator colorClassName="accent-primary-foreground" />
      ) : (
        <Text>{label}</Text>
      )}
    </Button>
  )
}
