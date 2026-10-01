import { Platform, View } from 'react-native'

import { FormBanner } from '@/components/form/form-banner'
import { SubmitButton } from '@/components/form/submit-button'
import { Text } from '@/components/ui/text'
import { UNUSABLE_RESPONSE_MESSAGE } from '@/lib/auth/form-state'
import type { Experiment } from '@/lib/lab/experiments'
import { parseCombinedSteps, type ExperimentResult } from '@/lib/lab/result'

/**
 * 원본 응답을 그리는 고정폭 글꼴. Tailwind 의 `font-mono` 는 여러 글꼴을 쉼표로 이은 CSS 목록이라 네이티브의
 * fontFamily 가 될 수 없다 - 플랫폼마다 있는 이름 하나를 고른다(AGENTS.md: 플랫폼마다 다른 스타일은
 * Platform.select).
 */
const MONOSPACE = Platform.select({ ios: 'Menlo', default: 'monospace' })

/**
 * 계약 실험실의 실험 하나 - 설명, 세션 안내, 실행 버튼, 결과(스펙 8.6).
 *
 * 세션이 필요한 실험도 버튼을 숨기지 않는다 - 로그인하지 않은 채 누르면 로그인으로 가는 것이 이 화면이
 * 실증하는 계약의 일부다(스펙 7.3). 누르기 전에 그렇게 된다는 것을 문구로 알린다.
 *
 * testID 는 E2E 플로(test/e2e/flows/contract-lab-*.yaml)가 찾는 이름이다 - 끝에 실험 id 가 붙는다.
 */
export function ExperimentCard({
  experiment,
  result,
  pending,
  failed,
  onRun,
}: {
  experiment: Experiment
  result: ExperimentResult | null
  pending: boolean
  failed: boolean
  onRun: () => void
}) {
  return (
    <View
      testID={`lab-card-${experiment.id}`}
      className="gap-3 rounded-lg border border-border p-4"
    >
      <View className="gap-1">
        <Text variant="large">{experiment.title}</Text>
        <Text className="text-sm text-muted-foreground">{experiment.proves}</Text>
      </View>
      {experiment.needsSession ? (
        <Text
          testID={`lab-session-note-${experiment.id}`}
          className="text-sm text-muted-foreground"
        >
          로그인이 필요합니다. 로그인하지 않은 채 누르면 로그인 화면으로 이동합니다.
        </Text>
      ) : null}
      <SubmitButton
        testID={`lab-run-${experiment.id}`}
        label={`${experiment.title} 실행`}
        pending={pending}
        onPress={onRun}
      />
      {failed ? <FormBanner messages={[UNUSABLE_RESPONSE_MESSAGE]} /> : null}
      {result === null ? null : <ResultView id={experiment.id} result={result} />}
    </View>
  )
}

/**
 * 결과 - 요청·상태·보낸 요청 헤더·보낸 본문·응답 본문. 판단은 `lib/lab/` 가 끝냈고 여기서는 옮겨 그리기만 한다.
 *
 * 헤더는 응답 헤더가 아니라 이 실험실이 보낸 요청 헤더다(`authorization` 은 값을 가린다 - `result.ts`). 응답
 * 본문은 파싱한 뒤 다시 직렬화한 JSON 이라 키 순서와 공백이 원본과 다를 수 있다 - 그 사실을 화면에 적는다.
 * 여러 단계인 실험은 `parseCombinedSteps` 로 단계마다 머리글과 본문을 갈라 그린다 - 본문 칸에는 백엔드가 준
 * 것만 있어서 E2E 가 단계의 본문끼리 비교할 수 있다(원본 E2E 가 이 파서를 쓴 이유와 같다).
 */
function ResultView({ id, result }: { id: string; result: ExperimentResult }) {
  const headers = Object.entries(result.headers)
  const { steps, note } = parseCombinedSteps(result.body)

  return (
    <View
      testID={`lab-result-${id}`}
      className="gap-3 rounded-md border border-border bg-muted p-3"
    >
      <View className="gap-1">
        <Text className="text-xs font-medium text-muted-foreground">요청</Text>
        <Text testID={`lab-request-${id}`} className="text-xs" style={{ fontFamily: MONOSPACE }}>
          {`${result.request.method} ${result.request.path}`}
        </Text>
        <Text className="text-xs font-medium text-muted-foreground">상태</Text>
        <Text testID={`lab-status-${id}`} className="text-xs" style={{ fontFamily: MONOSPACE }}>
          {String(result.status)}
        </Text>
      </View>

      {headers.length === 0 ? null : (
        <View className="gap-1">
          <Text className="text-xs font-medium text-muted-foreground">보낸 요청 헤더</Text>
          {headers.map(([name, value]) => (
            <Text
              key={name}
              testID={`lab-header-${id}-${name}`}
              className="text-xs"
              style={{ fontFamily: MONOSPACE }}
            >
              {`${name}: ${value}`}
            </Text>
          ))}
        </View>
      )}

      {result.request.body === undefined ? null : (
        <View className="gap-1">
          <Text className="text-xs font-medium text-muted-foreground">보낸 본문</Text>
          <Text
            testID={`lab-sent-body-${id}`}
            className="text-xs"
            style={{ fontFamily: MONOSPACE }}
          >
            {result.request.body}
          </Text>
        </View>
      )}

      <View className="gap-2">
        <Text className="text-xs font-medium text-muted-foreground">
          응답 본문 — 파싱 후 다시 직렬화한 값이다. 키 순서와 공백은 원본과 다를 수 있다.
        </Text>
        {steps.length === 0 ? (
          <Text testID={`lab-body-${id}`} className="text-xs" style={{ fontFamily: MONOSPACE }}>
            {result.body}
          </Text>
        ) : (
          steps.map((step, index) => (
            <View key={step.heading} className="gap-1">
              <Text
                testID={`lab-step-heading-${id}-${index}`}
                className="text-xs font-semibold"
                style={{ fontFamily: MONOSPACE }}
              >
                {step.heading}
              </Text>
              <Text
                testID={`lab-step-body-${id}-${index}`}
                className="text-xs"
                style={{ fontFamily: MONOSPACE }}
              >
                {step.body}
              </Text>
            </View>
          ))
        )}
        {note === undefined ? null : (
          <Text testID={`lab-note-${id}`} className="text-xs text-muted-foreground">
            {note}
          </Text>
        )}
      </View>
    </View>
  )
}
