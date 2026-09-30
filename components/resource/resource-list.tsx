import { Link, type Href } from 'expo-router'
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native'

import { RequestFailed } from '@/components/app/request-failed'
import { FormBanner } from '@/components/form/form-banner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'
import type { ListFailure } from '@/lib/resources/view'
import type { ResourceListState } from '@/queries/resources'

import { ResourceRow } from './resource-row'

/**
 * 자원 목록 - 스펙 8.1 의 목록 화면 몸통. 무엇을 그릴지는 `listView`(lib/resources/view.ts)가 이미
 * 정해 왔다: 스켈레톤(첫 쪽 전) · 닿지 못함(앱 문구와 다시 시도) · 배너(백엔드 문구) · 목록.
 *
 * - 무한 스크롤: 끝에 닿으면 `loadMore` 를 부르고, 읽는 동안 끝에 스피너만 그린다(스펙 8.7).
 *   목록이 화면을 채우지 못하면 FlatList 가 곧바로 끝에 닿았다고 알려 다음 쪽을 이어 읽는다.
 * - 당겨서 새로고침: 사용자가 당긴 동안만 도는 스피너다 - 앱 복귀의 재조회는 돌리지 않는다.
 * - 빈 결과: 필터가 걸린 0건이면 "필터 지우기" 를 준다(필터 시트의 것과 같은 주소).
 *
 * testID 는 E2E 플로(test/e2e/)가 찾는 이름이다 - 바꾸면 플로도 함께 바꾼다.
 */
export function ResourceListView({
  list,
  clearFiltersHref,
  onOpen,
}: {
  list: ResourceListState
  /** 필터를 지운 같은 화면의 주소 - `clearFiltersHref`(lib/resources/view.ts)의 결과. */
  clearFiltersHref: Href
  onOpen: (id: string) => void
}) {
  const { view } = list
  if (view === null) return <ListSkeleton />
  if (view.kind === 'unreachable') {
    return <RequestFailed retrying={list.retrying} onRetry={list.retry} />
  }
  if (view.kind === 'banner') {
    return (
      <View className="p-4">
        <FormBanner messages={view.messages} />
      </View>
    )
  }

  return (
    <FlatList
      testID="resource-list"
      data={view.rows}
      keyExtractor={(row) => row.id}
      renderItem={({ item }) => <ResourceRow columns={view.columns} row={item} onOpen={onOpen} />}
      onEndReached={list.loadMore}
      onEndReachedThreshold={0.5}
      refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} />}
      ListEmptyComponent={
        <EmptyList filtered={view.filtered} clearFiltersHref={clearFiltersHref} />
      }
      ListFooterComponent={<ListFooter list={list} failure={view.failure} />}
      contentContainerClassName="grow"
    />
  )
}

function EmptyList({ filtered, clearFiltersHref }: { filtered: boolean; clearFiltersHref: Href }) {
  return (
    <View testID="list-empty" className="flex-1 items-center justify-center gap-3 p-8">
      <Text className="text-center text-sm text-muted-foreground">
        {filtered ? '조건에 맞는 항목이 없습니다.' : '아직 등록된 항목이 없습니다.'}
      </Text>
      {filtered ? (
        // push 다 - 뒤로 가기가 필터를 걸었던 목록으로 돌아간다(스펙 8.2).
        <Link href={clearFiltersHref} push asChild>
          <Button testID="empty-clear-filters" variant="outline">
            <Text>필터 지우기</Text>
          </Button>
        </Link>
      ) : null}
    </View>
  )
}

function ListFooter({ list, failure }: { list: ResourceListState; failure: ListFailure | null }) {
  if (failure?.kind === 'unreachable') {
    return <RequestFailed compact retrying={list.retrying} onRetry={list.retry} />
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
