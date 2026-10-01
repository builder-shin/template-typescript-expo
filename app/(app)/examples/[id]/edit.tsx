import { router, Stack, useLocalSearchParams, useNavigation } from 'expo-router'
import { StackActions } from 'expo-router/react-navigation'
import { useState } from 'react'
import { View } from 'react-native'

import { ConfirmSheet } from '@/components/app/confirm-sheet'
import { ResourceEditGate } from '@/components/resource/resource-edit-gate'
import { ResourceForm } from '@/components/resource/resource-form'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { EXAMPLE } from '@/lib/resources'
import { useRelationshipReferences, useResourceDetail } from '@/queries/resources'
import { useDeleteResource, useUpdateResource } from '@/queries/writes'

/**
 * Example 수정·삭제 - 스펙 8.1(보호 경로, lib/auth/protected-paths.ts). 폼은 상세와 같은 응답으로
 * 기존 값을 채운다. 저장하면 상세로 돌아가고, 삭제는 확인 시트를 거쳐 이 자원을 보던 목록으로
 * 돌아간다. 없는 id 면 not-found 다.
 *
 * 이 파일에는 훅 호출과 JSX 만 있다(스펙 8.4).
 */

/**
 * 목록 화면의 이름 - 앱 셸(`app/(app)/_layout.tsx`)의 Stack 이 `app/(app)/examples/index.tsx` 에 붙인
 * 이름이다. 삭제 뒤 돌아갈 때만 쓴다(아래 주석).
 */
const LIST_SCREEN = 'examples/index'

export default function EditExampleScreen() {
  // id 만 이름으로 꺼낸다 - 로그인 뒤 복귀(withAnchor)가 싣는 initial 같은 값도 라우트 파라미터에 섞여
  // 온다(lib/resources/AGENTS.md 의 "라우트 파라미터"). 파라미터 전체를 펼치거나 돌지 않는다.
  const { id } = useLocalSearchParams<{ id: string }>()
  // 같은 화면이 다른 id 로 다시 쓰이면(딥링크는 지금 화면과 이름이 같으면 그 화면을 쓴다) 폼의 첫
  // 값과 쓰기 상태를 처음부터 만든다 - 앞 자원의 입력이나 "없다" 가 남지 않는다.
  return <EditExample key={id} id={id} />
}

function EditExample({ id }: { id: string }) {
  const navigation = useNavigation()
  const update = useUpdateResource(EXAMPLE, id)
  const remove = useDeleteResource(EXAMPLE, id)
  // 지운 뒤에는 상세를 부르지 않는다 - 삭제가 캐시에서 지운 상세를 이 화면이 다시 그리며 되살리면 없는
  // 자원을 부른다(404, queries/writes.ts 의 deleted).
  const detail = useResourceDetail(EXAMPLE, id, { enabled: !remove.deleted })
  const references = useRelationshipReferences(EXAMPLE)
  const [confirming, setConfirming] = useState(false)

  return (
    <View testID="edit-example-screen" className="flex-1 bg-background">
      <Stack.Screen options={{ title: 'Example 수정' }} />
      <ResourceEditGate resource={EXAMPLE} detail={detail} gone={update.gone}>
        {(initialValues) => (
          <ResourceForm
            resource={EXAMPLE}
            references={references}
            initialValues={initialValues}
            state={update.state}
            pending={update.pending}
            mutationKey={update.mutationKey}
            submitLabel="저장"
            onSubmit={(values) => {
              update.submit(values, () => {
                // 상세로 돌아간다 - 스택에 상세 화면이 있으면 거기까지 닫고 그 화면이 이 자원을 그린다
                // (dismissTo 는 이름으로 찾아 파라미터를 덮는다). 없으면(딥링크로 곧장 왔으면) 이 화면을
                // 상세로 바꾼다.
                router.dismissTo({ pathname: '/examples/[id]', params: { id } })
              })
            }}
            footer={
              <Button
                testID="delete-button"
                variant="outline"
                onPress={() => {
                  setConfirming(true)
                }}
              >
                <Text className="text-destructive">삭제</Text>
              </Button>
            }
          />
        )}
      </ResourceEditGate>
      <ConfirmSheet
        open={confirming}
        testID="delete-confirm"
        title="Example 삭제"
        message="이 Example 을 지웁니다. 되돌릴 수 없습니다."
        confirmLabel="삭제"
        pending={remove.pending}
        mutationKey={remove.mutationKey}
        messages={remove.messages}
        onCancel={() => {
          setConfirming(false)
          // 실패한 확인의 문구는 그 확인의 것이다 - 취소하고 다시 열면 지난 실패를 들고 열리지 않는다.
          remove.reset()
        }}
        onConfirm={() => {
          remove.remove(() => {
            setConfirming(false)
            // 이 자원을 보던 목록까지 닫는다 - 지운 자원의 상세도 함께 닫힌다. 목록의 조건(라우트
            // 파라미터)은 그대로 둔다(merge): router.dismissTo('/examples') 는 목록의 파라미터를 덮어
            // 필터가 사라진다. 스택에 목록이 없으면(딥링크) 이 화면을 조건 없는 목록으로 바꾼다.
            navigation.dispatch(StackActions.popTo(LIST_SCREEN, undefined, { merge: true }))
          })
        }}
      />
    </View>
  )
}
