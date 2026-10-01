import type { MutationKey } from '@tanstack/react-query'
import { ActivityIndicator, View } from 'react-native'

import { Sheet } from '@/components/app/sheet'
import { FormBanner } from '@/components/form/form-banner'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { useSubmitOnce } from '@/queries/submit-once'

/**
 * 되돌릴 수 없는 일을 하기 전의 확인 - 수정 화면의 삭제 확인 대화상자(스펙 8.1). 목록의 필터·정렬과
 * 같은 아래 시트(`Sheet`) 위에 그린다 - 새 대화상자 부품을 들이지 않고, 시트 안의 요소를 E2E 가
 * 찾는 방식(`Sheet` 의 주석)을 그대로 물려받는다.
 *
 * 확인하는 동안에는 두 버튼을 막고 확인 버튼이 글자 대신 스피너만 그린다(스펙 8.7). 확인은 한 번에 하나다 -
 * 확인이 부르는 쓰기의 키로 진행 중인 쓰기를 본다(queries/submit-once.ts). 실패하면 시트를 닫지 않고 그
 * 문구를 시트 안에 그린다 - 사용자가 다시 확인하거나 취소한다.
 *
 * testID 는 `testID`(시트), `<testID>-accept`, `<testID>-cancel` 이다 - E2E 플로(test/e2e/)가 찾는다.
 */
export function ConfirmSheet({
  open,
  testID,
  title,
  message,
  confirmLabel,
  pending,
  mutationKey,
  messages,
  onConfirm,
  onCancel,
}: {
  open: boolean
  testID: string
  title: string
  message: string
  confirmLabel: string
  pending: boolean
  /** 확인이 부르는 쓰기의 키 - 쓰기 훅의 `mutationKey` 다. */
  mutationKey: MutationKey
  /** 확인이 실패했을 때의 문구 - 없으면 빈 배열이다. */
  messages: readonly string[]
  onConfirm: () => void
  onCancel: () => void
}) {
  const submitOnce = useSubmitOnce(mutationKey)
  return (
    <Sheet open={open} onClose={pending ? () => undefined : onCancel} testID={testID}>
      <View role="alertdialog" className="gap-3">
        <Text variant="large">{title}</Text>
        <Text className="text-sm text-muted-foreground">{message}</Text>
        <FormBanner messages={messages} />
        <View className="flex-row justify-end gap-2">
          <Button
            testID={`${testID}-cancel`}
            variant="outline"
            disabled={pending}
            onPress={onCancel}
          >
            <Text>취소</Text>
          </Button>
          <Button
            testID={`${testID}-accept`}
            variant="destructive"
            accessibilityLabel={confirmLabel}
            aria-busy={pending}
            disabled={pending}
            onPress={() => {
              submitOnce(onConfirm)
            }}
          >
            {pending ? (
              <ActivityIndicator colorClassName="accent-white" />
            ) : (
              <Text>{confirmLabel}</Text>
            )}
          </Button>
        </View>
      </View>
    </Sheet>
  )
}
