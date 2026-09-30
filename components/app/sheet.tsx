import type { ReactNode } from 'react'
import { KeyboardAvoidingView, Modal, Platform, Pressable, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

/** 시트 아래의 기본 여백(`pb-8`). 시스템 막대의 높이가 여기에 더해진다. */
const BOTTOM_PADDING = 32

/**
 * 화면 아래에서 올라오는 시트 - React Native 의 `Modal` 위에 둔다. 목록의 필터 시트와 정렬 메뉴가
 * 쓴다(스펙 8.1). React Native Reusables 에는 시트가 없어서 이 저장소가 만든다.
 *
 * 배경을 누르거나 Android 뒤로 가기를 누르면 닫힌다(`onRequestClose`). 머리 줄(제목·버튼)은
 * 쓰는 쪽이 그린다 - 입력이 든 시트는 버튼을 위에 두어 키보드가 가리지 않게 한다. iOS 는 키보드가
 * 올라오면 시트를 밀어 올린다 - Android 는 창이 스스로 줄어든다.
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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-end bg-black/50"
      >
        <Pressable
          className="flex-1"
          accessibilityRole="button"
          accessibilityLabel="닫기"
          onPress={onClose}
        />
        <View
          testID={testID}
          className="gap-3 rounded-t-2xl bg-background p-4"
          style={{ maxHeight: '85%', paddingBottom: BOTTOM_PADDING + insets.bottom }}
        >
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}
