import { View } from 'react-native'

import { Badge } from '@/components/ui/badge'
import { Text } from '@/components/ui/text'

/**
 * 목록의 칸과 상세의 항목이 함께 쓰는 값 조각 - template-typescript-nextjs 의
 * `components/resource/values.tsx` 를 React Native 로 옮긴 것이다. 같은 관계가 두 화면에서 다르게
 * 그려지면 그것이 결함이다.
 */

/** 값이 없음. 빈 칸 대신 그린다 - 비어 있다는 것이 보여야 한다. */
const EMPTY_VALUE = '—'

/** `testID` 는 상세가 준다 - 비어 있는 항목도 E2E 가 찾을 수 있다. */
export function EmptyValue({ testID }: { testID?: string }) {
  return (
    <Text testID={testID} className="text-sm text-muted-foreground">
      {EMPTY_VALUE}
    </Text>
  )
}

/**
 * 관계 대상들의 배지. 이름은 `lib/resources/view.ts` 의 `relatedText` 가 정한다. `testID` 를 주면 배지
 * 글자마다 `<testID>-<위치>` 를 단다 - 상세가 주고 E2E 가 순서를 읽는다(목록의 행은 주지 않는다).
 */
export function RelatedBadges({ values, testID }: { values: readonly string[]; testID?: string }) {
  return (
    <View className="flex-row flex-wrap gap-1">
      {values.map((value, position) => (
        // 같은 이름이 두 번 올 수 있어(서로 다른 id 의 동명 라벨) 위치를 키에 섞는다.
        <Badge key={`${position}-${value}`} variant="secondary">
          <Text testID={testID === undefined ? undefined : `${testID}-${position}`}>{value}</Text>
        </Badge>
      ))}
    </View>
  )
}
