import { ActivityIndicator, View } from 'react-native'

import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { UNUSABLE_RESPONSE_MESSAGE } from '@/lib/auth/form-state'
import { cn } from '@/lib/utils'

/**
 * 백엔드가 응답조차 주지 못했을 때(네트워크 실패·타임아웃)의 자리 - 스펙 9.3 의 앱 문구와 "다시
 * 시도". 문구는 복사한 `UNUSABLE_RESPONSE_MESSAGE` 하나다 - 앱 자신의 문구를 새로 만들지 않는다.
 * 다시 부르는 동안에는 버튼이 글자 대신 스피너만 그린다(스펙 8.7).
 *
 * `compact` 는 읽은 내용과 함께 그릴 때다 - 재조회가 닿지 못했을 때 목록·상세 위에, 다음 쪽이 닿지 못했을 때
 * 목록 끝에 둔다. 화면을 채우지 않고 testID 가 다르다(`request-failed-compact`) - E2E 가 읽은 행이 남았는지와
 * 함께 가른다.
 */
export function RequestFailed({
  retrying,
  onRetry,
  compact = false,
}: {
  retrying: boolean
  onRetry: () => void
  compact?: boolean
}) {
  return (
    <View
      testID={compact ? 'request-failed-compact' : 'request-failed'}
      className={cn('items-center gap-3 p-6', !compact && 'flex-1 justify-center')}
    >
      <Text className="text-center text-sm text-muted-foreground">{UNUSABLE_RESPONSE_MESSAGE}</Text>
      <Button
        testID="retry-button"
        variant="outline"
        accessibilityLabel="다시 시도"
        aria-busy={retrying}
        disabled={retrying}
        onPress={onRetry}
      >
        {retrying ? (
          <ActivityIndicator colorClassName="accent-foreground" />
        ) : (
          <Text>다시 시도</Text>
        )}
      </Button>
    </View>
  )
}
