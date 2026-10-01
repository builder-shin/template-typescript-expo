import { router, Stack } from 'expo-router'
import { View } from 'react-native'

import { ResourceForm } from '@/components/resource/resource-form'
import { EXAMPLE } from '@/lib/resources'
import { newFormValues } from '@/lib/resources/form'
import { useRelationshipReferences } from '@/queries/resources'
import { useCreateResource } from '@/queries/writes'

/**
 * Example 생성 - 스펙 8.1(보호 경로, lib/auth/protected-paths.ts). 필수 입력, 분류 단일 선택, 태그
 * 다중 선택. 만들면 이 화면을 새 자원의 상세로 바꾼다 - 뒤로 가기가 이 폼이 아니라 온 곳(목록)으로
 * 간다.
 *
 * 라우트 파라미터를 읽지 않는다 - 로그인 뒤 복귀(withAnchor)가 싣는 `initial` 같은 값이 섞여 와도 폼의
 * 첫 값은 선언에서만 온다(`newFormValues`).
 *
 * 이 파일에는 훅 호출과 JSX 만 있다(스펙 8.4) - 폼의 판단은 lib/resources/form.ts, 쓰기의 흐름은
 * lib/resources/write.ts, 요청과 캐시는 queries/ 가 한다.
 */
export default function NewExampleScreen() {
  const references = useRelationshipReferences(EXAMPLE)
  const create = useCreateResource(EXAMPLE)

  return (
    <View testID="new-example-screen" className="flex-1 bg-background">
      <Stack.Screen options={{ title: 'Example 만들기' }} />
      <ResourceForm
        resource={EXAMPLE}
        references={references}
        initialValues={newFormValues(EXAMPLE)}
        state={create.state}
        pending={create.pending}
        mutationKey={create.mutationKey}
        submitLabel="만들기"
        onSubmit={(values) => {
          create.submit(values, (id) => {
            router.replace({ pathname: '/examples/[id]', params: { id } })
          })
        }}
      />
    </View>
  )
}
