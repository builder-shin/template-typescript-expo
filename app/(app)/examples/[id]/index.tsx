import { Stack, useLocalSearchParams } from 'expo-router'

import { ResourceDetailView } from '@/components/resource/resource-detail'
import { EXAMPLE } from '@/lib/resources'
import { detailLabels } from '@/lib/resources/view'
import { useResourceDetail } from '@/queries/resources'

/**
 * Example 상세 - 스펙 8.1. 없는 id(형식이 틀린 id 도 같다)는 not-found 를 그린다(스펙 9.2).
 * 이 파일에는 훅 호출과 JSX 만 있다(스펙 8.4).
 */
export default function ExampleDetailScreen() {
  // id 만 이름으로 꺼낸다 - 이동이 싣는 값(로그인 뒤 복귀의 initial 등)도 라우트 파라미터에 섞여 온다
  // (lib/resources/route-params.ts). 파라미터 전체를 펼치거나 돌지 않는다.
  const { id } = useLocalSearchParams<{ id: string }>()
  const detail = useResourceDetail(EXAMPLE, id)

  return (
    <>
      <Stack.Screen
        options={{ title: detail.view?.kind === 'detail' ? detail.view.heading : 'Example' }}
      />
      <ResourceDetailView detail={detail} labels={detailLabels(EXAMPLE)} />
    </>
  )
}
