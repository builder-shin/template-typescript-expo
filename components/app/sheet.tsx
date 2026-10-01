import type { ReactNode } from 'react'
import { KeyboardAvoidingView, Modal, Pressable, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

/** 시트 아래의 기본 여백(`pb-8`). 시스템 막대의 높이가 여기에 더해진다. */
const BOTTOM_PADDING = 32

/**
 * 화면 아래에서 올라오는 시트 - React Native 의 `Modal` 위에 둔다. 목록의 필터 시트와 정렬 메뉴가
 * 쓴다(스펙 8.1). React Native Reusables 에는 시트가 없어서 이 저장소가 만든다.
 *
 * 배경(testID `sheet-backdrop` - E2E 가 두 플랫폼에서 시트를 닫는 자리)을 누르거나 Android 뒤로 가기를 누르면
 * 닫힌다(`onRequestClose`). 머리 줄(제목·버튼)은 쓰는 쪽이 그린다 - 입력이 든 시트는 버튼을 위에 두어 키보드가
 * 가리지 않게 한다.
 *
 * 키보드가 올라오면 두 플랫폼 모두 시트를 키보드 높이만큼 밀어 올린다(`KeyboardAvoidingView` 의 `padding`).
 * Android 의 `Modal` 창은 edge-to-edge 로 그려져 `adjustResize` 가 창을 줄이지 않는다 - Pixel 9(Android 16)에서
 * 키보드가 떠도 시트가 제자리였고 아래쪽 입력 칸이 키보드 밑에 들어갔다
 * (docs/superpowers/notes/2026-09-30-d3-measurements.md 의 L6). 시트는 남은 높이에 맞춰 줄어들 수 있고
 * (`shrink`), 입력이 든 몸통은 쓰는 쪽이 `ScrollView` 로 그린다 - 줄어든 시트에서도 포커스한 칸까지 굴러간다.
 *
 * 아래 여백에 시스템 내비게이션 막대의 높이를 더한다(`useSafeAreaInsets`) - Android(SDK 57)는 화면 끝까지
 * 그려서 여백이 없으면 시트의 끝이 막대 밑으로 들어간다.
 */
export function Sheet({
  open,
  onClose,
  testID,
  children,
}: {
  open: boolean
  onClose: () => void
  testID: string
  children: ReactNode
}) {
  const insets = useSafeAreaInsets()

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" className="flex-1 justify-end bg-black/50">
        <Pressable
          testID="sheet-backdrop"
          className="flex-1"
          accessibilityRole="button"
          accessibilityLabel="닫기"
          onPress={onClose}
        />
        <View
          testID={testID}
          className="shrink gap-3 rounded-t-2xl bg-background p-4"
          style={{ maxHeight: '85%', paddingBottom: BOTTOM_PADDING + insets.bottom }}
        >
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}
