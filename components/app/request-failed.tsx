import { ActivityIndicator, View } from 'react-native'

import { FormBanner } from '@/components/form/form-banner'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { UNUSABLE_RESPONSE_MESSAGE } from '@/lib/auth/form-state'
import { cn } from '@/lib/utils'

/** "다시 시도" 버튼 - 다시 부르는 동안에는 글자 대신 스피너만 그린다(스펙 8.7). 이 파일의 두 실패가 함께 쓴다. */
function RetryButton({ retrying, onRetry }: { retrying: boolean; onRetry: () => void }) {
  return (
    <Button
      testID="retry-button"
      variant="outline"
      accessibilityLabel="다시 시도"
      aria-busy={retrying}
      disabled={retrying}
      onPress={onRetry}
    >
      {retrying ? <ActivityIndicator colorClassName="accent-foreground" /> : <Text>다시 시도</Text>}
    </Button>
  )
}

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
      <RetryButton retrying={retrying} onRetry={onRetry} />
    </View>
  )
}

/**
 * 조회 화면이 백엔드의 거절을 그리는 배너 - 문구는 백엔드가 협상한 것 그대로다(스펙 9.3). `retryable` 이면
 * 그 아래에 "다시 시도" 를 함께 둔다. 첫 조회가 판정하지 않은 응답(5xx·408·429)을 받은 배너다 - 잠시 뒤 다시 부르면
 * 달라질 수 있는 실패라 화면이 다시 부를 길을 준다(스펙 9.3 의 D4 정정). 판정한 4xx 의 배너는 다시 불러도 같은
 * 답이라 `retryable` 이 아니고 버튼도 없다. 앱 자신의 문구는 더하지 않는다 - 버튼의 라벨뿐이다.
 */
export function FailureBanner({
  messages,
  retryable,
  retrying,
  onRetry,
}: {
  messages: readonly string[]
  retryable: boolean
  retrying: boolean
  onRetry: () => void
}) {
  return (
    <View className="gap-3">
      <FormBanner messages={messages} />
      {retryable ? (
        <View className="items-center">
          <RetryButton retrying={retrying} onRetry={onRetry} />
        </View>
      ) : null}
    </View>
  )
}
