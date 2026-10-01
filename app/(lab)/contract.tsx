import { Stack, router, usePathname, type Href } from 'expo-router'
import { ScrollView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useNavigateOnce } from '@/components/app/navigate-once'
import { ExperimentCard } from '@/components/lab/experiment-card'
import { Text } from '@/components/ui/text'
import { loginHref } from '@/lib/auth/protected-paths'
import { EXPERIMENTS, type Experiment } from '@/lib/lab/experiments'
import { useLabExperiment } from '@/queries/lab'
import { useSubmitOnce } from '@/queries/submit-once'

/** 본문의 여백(`p-4`). 아래쪽에는 시스템 막대의 높이가 더해진다. */
const CONTENT_PADDING = 16

/**
 * 계약 실험실 - 스펙 8.6. 실무 화면이 쓰지 않는 여섯 백엔드 표면을 모으고, 각 실험이 원본 JSON 응답을 그대로
 * 보인다. 무엇을 실증하는지는 `lib/lab/experiments.ts`, 무엇을 부르는지는 `lib/lab/run.ts`, 어떻게 그리는지는
 * `components/lab/experiment-card.tsx` 다. 이 파일에는 훅 호출과 JSX 만 있다(스펙 8.4).
 *
 * 공개 경로다 - 로그인 여부와 무관하게 같은 화면이다(스펙 7.3). 세션이 필요한 실험을 로그인하지 않은 채
 * 누르면 로그인으로 보내고(`next` 는 이 화면), 로그인하면 돌아온다. 경로 가드는 보호 경로만 보므로 그 이동은
 * 여기서 한다. 기기 세션을 지우는 것은 쓰기 캐시(`MutationCache`)의 `onError` 다(`platform/query-client.ts`).
 * 로그인 화면을 쌓는 이동은 화면에 하나인 가드를 지난다(`useNavigateOnce`) - 세션이 필요한 실험 둘이 잇달아
 * 거절돼도 로그인 화면은 하나다. 이 화면이 다시 앞에 오면 풀린다.
 *
 * 실험마다 따로 도는 쓰기가 있다(`ExperimentRunner`) - 하나를 눌러도 다른 결과가 사라지지 않는다. 훅을 반복문
 * 안에서 부르지 않도록 실험마다 컴포넌트를 둔다.
 */
export default function ContractLabScreen() {
  const insets = useSafeAreaInsets()
  const pathname = usePathname()
  const navigateOnce = useNavigateOnce()
  const toLogin = () => {
    navigateOnce(() => {
      // loginHref 는 런타임에 만든 앱 안 경로다 - 타입드 라우트가 모르는 문자열이라 단언한다. 단언은
      // 변수에 담는다(app/(app)/_layout.tsx 와 같은 이유 - 새 체크아웃의 lint).
      const target = loginHref(pathname) as Href
      router.push(target)
    })
  }

  return (
    <>
      <Stack.Screen options={{ title: '계약 실험실' }} />
      <ScrollView
        testID="lab-screen"
        className="flex-1 bg-background"
        contentContainerClassName="gap-6 p-4"
        contentContainerStyle={{ paddingBottom: CONTENT_PADDING + insets.bottom }}
      >
        <Text className="text-sm text-muted-foreground">
          실무 화면이 쓰지 않는 여섯 백엔드 표면을 모았다. 각 버튼은 응답을 가공하지 않고 그대로
          보여 준다.
        </Text>
        {EXPERIMENTS.map((experiment) => (
          <ExperimentRunner
            key={experiment.id}
            experiment={experiment}
            onSessionRejected={toLogin}
          />
        ))}
      </ScrollView>
    </>
  )
}

function ExperimentRunner({
  experiment,
  onSessionRejected,
}: {
  experiment: Experiment
  onSessionRejected: () => void
}) {
  const lab = useLabExperiment(experiment.id)
  const submitOnce = useSubmitOnce(lab.mutationKey)

  return (
    <ExperimentCard
      experiment={experiment}
      result={lab.result}
      pending={lab.pending}
      failed={lab.failed}
      onRun={() => {
        submitOnce(() => {
          lab.run(onSessionRejected)
        })
      }}
    />
  )
}
