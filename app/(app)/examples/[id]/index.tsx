import { router, Stack, useLocalSearchParams } from 'expo-router'

import { useNavigateOnce } from '@/components/app/navigate-once'
import { ResourceDetailView } from '@/components/resource/resource-detail'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { EXAMPLE } from '@/lib/resources'
import { detailLabels } from '@/lib/resources/view'
import { useResourceDetail } from '@/queries/resources'

/**
 * Example 상세 - 스펙 8.1. 없는 id(형식이 틀린 id 도 같다)는 not-found 를 그린다(스펙 9.2).
 * 이 파일에는 훅 호출과 JSX 만 있다(스펙 8.4).
 *
 * "수정" 은 누구에게나 보인다 - 수정 화면은 보호 경로라 세션이 없으면 경로 가드가 로그인으로 보내고,
 * 로그인하면 수정 화면으로 돌아온다(스펙 7.3). 두 번 눌러도 수정 화면은 하나다(useNavigateOnce).
 */
export default function ExampleDetailScreen() {
  // id 만 이름으로 꺼낸다 - 이동이 싣는 값(로그인 뒤 복귀의 initial 등)도 라우트 파라미터에 섞여 온다
  // (lib/resources/route-params.ts). 파라미터 전체를 펼치거나 돌지 않는다.
  const { id } = useLocalSearchParams<{ id: string }>()
  const detail = useResourceDetail(EXAMPLE, id)
  const navigateOnce = useNavigateOnce()

  return (
    <>
      <Stack.Screen
        options={{ title: detail.screen.kind === 'detail' ? detail.screen.heading : 'Example' }}
      />
      <ResourceDetailView
        detail={detail}
        labels={detailLabels(EXAMPLE)}
        actions={
          <Button
            testID="edit-example-link"
            variant="outline"
            onPress={() => {
              navigateOnce(() => {
                router.push({ pathname: '/examples/[id]/edit', params: { id } })
              })
            }}
          >
            <Text>수정</Text>
          </Button>
        }
      />
    </>
  )
}
