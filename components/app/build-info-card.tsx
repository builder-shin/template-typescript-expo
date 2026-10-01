import { View } from 'react-native'

import { SubmitButton } from '@/components/form/submit-button'
import { Text } from '@/components/ui/text'
import type { BuildInfoCardState } from '@/queries/updates'

/**
 * 홈의 빌드 정보 카드(스펙 10.6) - 앱 버전, 변형, OTA, runtime version, 채널, 업데이트 ID 와 "업데이트 확인".
 * 값과 문구는 lib/updates/build-info.ts 가 정했다 - 여기서는 그리기만 한다.
 *
 * testID 는 E2E(test/e2e/flows/home-build-info.yaml)가 찾는 이름이다 - 행은 `build-info-<키>`.
 *
 * 결과 문구는 확인이 끝난 뒤 새로 나타난다. Android 에서는 `accessibilityLiveRegion="polite"` 로 그 문구를 스크린
 * 리더가 읽게 하려 했다 - 문구 노드는 `message` 가 있을 때만 마운트되는데, 새로 마운트된 polite live region 을
 * TalkBack 이 읽는지는 기기에서 확인하지 않았다(TalkBack 확인은 D9 가 맡는다). `role="status"` 는 의미 표지로 둔다 -
 * React Native 0.86 은 이 role 을 Android 에서 접근성 역할로 옮기지 않고 iOS 에서는 trait 이 없다
 * (`UIAccessibilityTraitNone`). `accessibilityLiveRegion` 은 Android 전용이라 iOS 에서 읽게 하려면
 * `AccessibilityInfo.announceForAccessibility` 라는 플랫폼 호출이 필요하고, 그 호출은 이 컴포넌트에 둘 것이 아니다.
 */
export function BuildInfoCard({ rows, canCheck, busy, message, check }: BuildInfoCardState) {
  return (
    <View testID="build-info-card" className="w-full gap-3 rounded-lg border border-border p-4">
      <Text variant="large">빌드 정보</Text>
      <View className="gap-2">
        {rows.map((row) => (
          <View key={row.key} className="flex-row items-start justify-between gap-4">
            <Text className="text-sm text-muted-foreground">{row.label}</Text>
            <Text testID={`build-info-${row.key}`} className="flex-1 text-right text-sm" selectable>
              {row.value}
            </Text>
          </View>
        ))}
      </View>
      {canCheck ? (
        <SubmitButton
          testID="build-info-check"
          label="업데이트 확인"
          pending={busy}
          onPress={check}
        />
      ) : (
        <Text testID="build-info-ota-off" className="text-sm text-muted-foreground">
          이 빌드는 OTA 가 꺼져 있어 확인할 업데이트가 없습니다.
        </Text>
      )}
      {message === null ? null : (
        <Text
          testID="build-info-message"
          role="status"
          accessibilityLiveRegion="polite"
          className="text-sm"
        >
          {message}
        </Text>
      )}
    </View>
  )
}
