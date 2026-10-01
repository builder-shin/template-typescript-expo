import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { BannerScreen, RequestFailed } from '@/components/app/request-failed'
import { FormBanner } from '@/components/form/form-banner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'
import type { ListFailure } from '@/lib/resources/view'
import type { ResourceListState } from '@/queries/resources'

import { ResourceRow } from './resource-row'

/**
 * 자원 목록 - 스펙 8.1 의 목록 화면 몸통. 무엇을 그릴지는 `listScreen`(lib/resources/screen-state.ts)이 이미
 * 정해 왔다: 스켈레톤(첫 쪽 전) · 닿지 못함(첫 조회 - 앱 문구와 다시 시도가 화면 전부) · 배너(백엔드 문구) · 목록.
 *
 * - 배너는 백엔드 문구 그대로다. 첫 조회가 판정하지 않은 응답(5xx·408·429)을 받았으면(`retryable`) 문구 아래에
 *   "다시 시도" 를 함께 그린다 - 판정한 4xx 의 배너에는 없다(`BannerScreen` - 상세·수정 폼의 자리와 같은 한 곳이다).
 * - 재조회(당겨서 새로고침·앱 복귀·네트워크 복귀)가 닿지 못해도 읽은 행은 그대로 두고 목록 위에 작은 실패
 *   (`RequestFailed` 의 `compact`)와 "다시 시도" 를 그린다(`refreshFailed`) - 다시 시도는 읽은 쪽을 모두 다시 읽는다.
 * - 무한 스크롤: 끝에 닿으면 `loadMore` 를 부르고, 읽는 동안 끝에 스피너만 그린다(스펙 8.7).
 *   목록이 화면을 채우지 못하면 FlatList 가 곧바로 끝에 닿았다고 알려 다음 쪽을 이어 읽는다. 다음 쪽이 닿지
 *   못하면 목록 끝에 작은 실패를 그리고, 다시 시도는 그 쪽만 읽는다(`retryNextPage`).
 * - 당겨서 새로고침: 사용자가 당긴 동안만 도는 스피너다 - 앱 복귀의 재조회는 돌리지 않는다.
 * - 빈 결과: 필터가 걸린 0건이면 "필터 지우기" 를 준다(필터 시트의 "필터 지우기" 와 같은 동작 - 화면이
 *   `onClearFilters` 로 준다. 이동은 화면이 한다).
 * - 끝 여백: 목록의 끝이 시스템 내비게이션 막대 밑으로 들어가지 않게 아래 여백만큼 띄운다(`useSafeAreaInsets` -
 *   Android(SDK 57)는 화면 끝까지 그린다).
 *
 * testID 는 E2E 플로(test/e2e/)가 찾는 이름이다 - 바꾸면 플로도 함께 바꾼다.
 */
export function ResourceListView({
  list,
  onClearFilters,
  onOpen,
}: {
  list: ResourceListState
  /** 걸린 필터를 지운다 - 빈 결과의 "필터 지우기" 가 부른다. */
  onClearFilters: () => void
  onOpen: (id: string) => void
}) {
  const insets = useSafeAreaInsets()
  const { screen } = list
  if (screen.kind === 'loading') return <ListSkeleton />
  if (screen.kind === 'unreachable') {
    return <RequestFailed retrying={list.retrying} onRetry={list.retry} />
  }
  if (screen.kind === 'banner') {
    return <BannerScreen screen={screen} retrying={list.retrying} onRetry={list.retry} />
  }

  return (
    <FlatList
      testID="resource-list"
      data={screen.rows}
      keyExtractor={(row) => row.id}
      renderItem={({ item }) => <ResourceRow columns={screen.columns} row={item} onOpen={onOpen} />}
      onEndReached={list.loadMore}
      onEndReachedThreshold={0.5}
      refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} />}
      ListHeaderComponent={
        screen.refreshFailed ? (
          <RequestFailed compact retrying={list.retrying} onRetry={list.retry} />
        ) : null
      }
      ListEmptyComponent={<EmptyList filtered={screen.filtered} onClearFilters={onClearFilters} />}
      ListFooterComponent={<ListFooter list={list} failure={screen.failure} />}
      contentContainerClassName="grow"
      contentContainerStyle={{ paddingBottom: insets.bottom }}
    />
  )
}

function EmptyList({
  filtered,
  onClearFilters,
}: {
  filtered: boolean
  onClearFilters: () => void
}) {
  return (
    <View testID="list-empty" className="flex-1 items-center justify-center gap-3 p-8">
      <Text className="text-center text-sm text-muted-foreground">
        {filtered ? '조건에 맞는 항목이 없습니다.' : '아직 등록된 항목이 없습니다.'}
      </Text>
      {filtered ? (
        <Button testID="empty-clear-filters" variant="outline" onPress={onClearFilters}>
          <Text>필터 지우기</Text>
        </Button>
      ) : null}
    </View>
  )
}

function ListFooter({ list, failure }: { list: ResourceListState; failure: ListFailure | null }) {
  if (failure?.kind === 'unreachable') {
    return <RequestFailed compact retrying={list.retrying} onRetry={list.retryNextPage} />
  }
  if (failure?.kind === 'banner') {
    return (
      <View className="p-4">
        <FormBanner messages={failure.messages} />
      </View>
    )
  }
  if (!list.loadingMore) return null
  return (
    <View className="items-center p-4">
      <ActivityIndicator testID="list-footer-spinner" colorClassName="accent-muted-foreground" />
    </View>
  )
}

/** 첫 쪽을 받기 전의 자리 - 글자 없이 행 모양만(스펙 8.7). */
const SKELETON_ROWS = 6

function ListSkeleton() {
  return (
    <View testID="list-skeleton" className="gap-5 p-4">
      {Array.from({ length: SKELETON_ROWS }, (_, row) => (
        <View key={row} className="gap-2">
          <Skeleton className="h-5 w-3/5" />
          <Skeleton className="h-4 w-4/5" />
        </View>
      ))}
    </View>
  )
}
