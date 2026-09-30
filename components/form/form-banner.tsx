import { View } from 'react-native'

import { Text } from '@/components/ui/text'

/**
 * 폼 위 배너 - 스펙 9.1 의 두 갈래 중 "문서 오류" 쪽. 어떤 오류가 여기로 오는지는
 * lib/auth/flow.ts 의 authFormStateFromErrors 가 정한다(예: source 가 없는 401
 * INVALID_CREDENTIALS · 409 EMAIL_ALREADY_REGISTERED). role="alert" 는 제출 뒤 새로 나타나는
 * 배너를 스크린 리더가 읽게 한다.
 */
export function FormBanner({ messages }: { messages: readonly string[] }) {
  if (messages.length === 0) return null

  return (
    <View
      testID="form-banner"
      role="alert"
      className="gap-1 rounded-lg border border-destructive/40 bg-destructive/10 p-3"
    >
      {messages.map((message, index) => (
        <Text
          key={`${index}-${message}`}
          testID="form-banner-message"
          className="text-sm text-destructive"
        >
          {message}
        </Text>
      ))}
    </View>
  )
}
