import { ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { RequestFailed } from '@/components/app/request-failed'
import { NotFoundView } from '@/components/app/not-found-view'
import { FormBanner } from '@/components/form/form-banner'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'
import type { DetailField, DetailLabel } from '@/lib/resources/view'
import type { ResourceDetailState } from '@/queries/resources'

import { EmptyValue, RelatedBadges } from './values'

/** 본문의 여백(`p-4`). 아래쪽에는 시스템 막대의 높이가 더해진다. */
const CONTENT_PADDING = 16

/**
 * 자원 상세 - 스펙 8.1 의 상세 화면 몸통. 무엇을 그릴지는 `detailScreen`(lib/resources/screen-state.ts)이
 * 정해 왔다: 스켈레톤 · 상세 · not-found(없는 id, 스펙 9.2) · 닿지 못함(첫 조회) · 배너. 다시 들어온 상세의
 * 재조회가 닿지 못해도 읽은 상세는 그대로 두고 위에 작은 실패와 "다시 시도" 를 그린다(`refreshFailed`).
 *
 * 항목은 선언 순서 그대로 속성 전부와 관계 전부다(`detailFields` - 목록의 `listed` 를 따르지
 * 않는다). 시각은 UTC 다(`formatAttributeValue`). 여러 줄 본문은 줄바꿈을 그대로 그린다.
 *
 * testID 는 E2E 플로(test/e2e/)가 찾는 이름이다 - `detail-value-<항목 키>` 의 키는 자원 선언에서
 * 온다(자원 이름으로 분기하지 않는다).
 *
 * 끝 여백: 마지막 항목이 시스템 내비게이션 막대 밑으로 들어가지 않게 아래 여백만큼 띄운다(`useSafeAreaInsets` -
 * Android(SDK 57)는 화면 끝까지 그린다).
 */
export function ResourceDetailView({
  detail,
  labels,
}: {
  detail: ResourceDetailState
  /** 스켈레톤의 줄 수 - `detailLabels`(선언만으로 정해진다). */
  labels: readonly DetailLabel[]
}) {
  const insets = useSafeAreaInsets()
  const { screen } = detail
  if (screen.kind === 'loading') return <DetailSkeleton labels={labels} />
  if (screen.kind === 'notFound') return <NotFoundView />
  if (screen.kind === 'unreachable') {
    return <RequestFailed retrying={detail.retrying} onRetry={detail.retry} />
  }
  const refreshFailed = screen.refreshFailed ? (
    <RequestFailed compact retrying={detail.retrying} onRetry={detail.retry} />
  ) : null
  if (screen.kind === 'banner') {
    return (
      <View className="gap-3 p-4">
        <FormBanner messages={screen.messages} />
        {refreshFailed}
      </View>
    )
  }

  return (
    <ScrollView
      testID="detail-screen"
      className="flex-1 bg-background"
      contentContainerClassName="gap-4 p-4"
      contentContainerStyle={{ paddingBottom: CONTENT_PADDING + insets.bottom }}
    >
      {refreshFailed}
      <Text testID="detail-heading" variant="h3">
        {screen.heading}
      </Text>
      {screen.fields.map((field) => (
        <View key={field.key} className="gap-1">
          <Text className="text-sm font-medium text-muted-foreground">{field.label}</Text>
          <FieldValue field={field} />
        </View>
      ))}
    </ScrollView>
  )
}

function FieldValue({ field }: { field: DetailField }) {
  if (field.values.length === 0) return <EmptyValue />
  if (field.kind === 'relationship') return <RelatedBadges values={field.values} />
  return (
    <Text testID={`detail-value-${field.key}`} className="text-base">
      {field.values.join(' ')}
    </Text>
  )
}

/** 응답을 받기 전의 자리 - 글자 없이 항목 모양만(스펙 8.7). 줄 수는 선언이 정한다. */
function DetailSkeleton({ labels }: { labels: readonly DetailLabel[] }) {
  return (
    <View testID="detail-skeleton" className="gap-4 p-4">
      <Skeleton className="h-8 w-3/5" />
      {labels.map((label) => (
        <View key={label.key} className="gap-1.5">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-5 w-3/4" />
        </View>
      ))}
    </View>
  )
}
