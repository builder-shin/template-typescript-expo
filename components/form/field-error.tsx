import { View } from 'react-native'

import { Text } from '@/components/ui/text'

/**
 * 입력 하나 아래 그리는 필드 오류 - 스펙 9.1 의 두 갈래 중 "필드" 쪽.
 *
 * 배열을 받는다. 백엔드는 검증 오류를 한 응답에 여러 개 실어 보내고 groupErrors 는 필드별 문구
 * 배열을 돌려준다 - 첫 원소만 그리면 나머지가 소리 없이 사라진다. 문구를 만들지 않는다 - 백엔드가
 * Accept-Language 로 협상한 문구를 그대로 받는다(스펙 9.3).
 *
 * testID 는 문구 Text 마다 단다 - 감싼 View 는 배경이 없어 네이티브 트리에서 납작해질 수 있다.
 * 같은 이유로 스크린 리더에 알리는 라이브 리전(`accessibilityLiveRegion`)도 문구 Text 에 단다 - 그 prop 은
 * View 를 납작해지지 않게 하지 않아서 감싼 View 에 달면 사라진다. 제출 뒤 오류가 나타나면 스크린 리더가
 * 방해하지 않고 읽는다(Android. iOS 는 입력에 초점이 갔을 때 폼이 힌트로 읽어 준다).
 */
export function FieldError({ testID, messages }: { testID: string; messages: readonly string[] }) {
  if (messages.length === 0) return null

  return (
    <View className="mt-1.5 gap-0.5">
      {messages.map((message, index) => (
        // 같은 문구가 두 번 올 수 있어 인덱스를 키에 섞는다.
        <Text
          key={`${index}-${message}`}
          testID={testID}
          accessibilityLiveRegion="polite"
          className="text-sm text-destructive"
        >
          {message}
        </Text>
      ))}
    </View>
  )
}
