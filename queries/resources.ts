import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import type { CollectionDocument, SingleDocument } from '@/lib/jsonapi/document'
import type { ResourceDefinition } from '@/lib/resources/define'
import {
  detailRequest,
  detailView,
  listRequest,
  listView,
  nextPageQuery,
  type DetailView,
  type ListView,
} from '@/lib/resources/view'
import { apiRequest } from '@/platform/api'
import { queryKeys } from '@/queries/keys'

/**
 * 자원의 조회 훅 - 목록(무한 스크롤)과 상세(스펙 8.4).
 *
 * 판단은 `lib/resources/view.ts` 가 한다 - 무엇을 요청할지(`listRequest`·`detailRequest`), 다음 쪽이
 * 어디인지(`nextPageQuery`), 응답을 어떤 화면 상태로 그릴지(`listView`·`detailView`). 여기서는 그
 * 결정을 TanStack Query 에 잇기만 한다. 요청은 전부 `apiRequest`(platform/api.ts)를 지난다 - 그
 * 자리가 Accept-Language 를 싣는다(스펙 9.4).
 *
 * `apiRequest` 는 던지지 않는다 - 백엔드 오류도 닿지 못함도 결과 값이다. 그래서 Query 의 오류
 * 상태를 쓰지 않고 결과를 view 함수에 넘긴다. 뒤따르는 쪽의 실패도 한 쪽으로 쌓이고, 그 뒤로는
 * 읽지 않는다(`nextPageQuery` 가 `null`).
 */

/** 라우트 파라미터 - `useLocalSearchParams()` 가 주는 모양. */
type RouteParams = Readonly<Record<string, string | string[] | undefined>>

/**
 * 내용이 같으면 같은 객체를 준다. `useLocalSearchParams()` 는 호출마다 새 객체를 만들고 `listRouteParams`
 * 도 그렇다 - 그 동일성에 기대면 조건(`plan`)과 그 위의 `view` 가 렌더마다 바뀐다. 라우트 파라미터는 문자열과
 * 문자열 배열이라 JSON 을 오가도 그대로다.
 */
function useContentStable<T>(value: T): T {
  const key = JSON.stringify(value)
  return useMemo(() => JSON.parse(key) as T, [key])
}

export interface ResourceListState {
  /**
   * 첫 쪽을 받기 전이면 `null` - 화면은 스켈레톤을 그린다(스펙 8.7). 데이터·자원·조건이 그대로면 같은
   * 객체다 - `FlatList` 의 `data`(`view.rows`)가 렌더마다 바뀌지 않는다.
   */
  view: ListView | null
  /** 다음 쪽을 읽는 중 - 목록 끝에 스피너만 그린다(스펙 8.7). */
  loadingMore: boolean
  /** 사용자가 당겨서 새로고침하는 중. 앱 복귀·네트워크 복귀의 재조회는 여기 들지 않는다. */
  refreshing: boolean
  /**
   * 조회가 진행 중이다(`isFetching` - 당겨서 새로고침은 `refreshing` 이라 뺀다). 다음 쪽을 읽는 중과 앱 복귀·
   * 네트워크 복귀의 재조회에서도 참이다. 실패 화면(`RequestFailed`)의 "다시 시도" 버튼이 스피너를 그릴 때만
   * 읽는다 - 다른 자리에서 "다시 시도 중" 으로 읽지 않는다.
   */
  retrying: boolean
  /** 목록 끝에 닿았을 때 - 다음 쪽이 있고 읽는 중이 아닐 때만 읽는다. */
  loadMore: () => void
  refresh: () => void
  retry: () => void
}

/**
 * 목록 - 라우트 파라미터가 곧 쿼리다(스펙 8.2). 첫 쪽은 커서의 입구에서 시작하고, 다음 쪽은
 * 응답의 `links.next` 를 따라간다(스펙 8.3). 쪽 인자는 백엔드 쿼리 문자열이다 - 첫 쪽은
 * `listRequest` 의 쿼리, 다음 쪽은 `nextPageQuery` 의 쿼리.
 *
 * `view` 는 `useMemo` 로 고정한다 - 읽은 쪽들(`query.data`)이나 자원, 조건이 바뀔 때만 다시 만든다. 조건은
 * 라우트 파라미터의 내용으로 고정한다(`useContentStable`).
 */
export function useResourceList(
  resource: ResourceDefinition,
  params: RouteParams,
): ResourceListState {
  const stableParams = useContentStable(params)
  const plan = useMemo(() => listRequest(resource, stableParams), [resource, stableParams])
  const query = useInfiniteQuery({
    queryKey: queryKeys.list(resource.type, plan.query.toString()),
    initialPageParam: plan.query.toString(),
    queryFn: ({ pageParam }) =>
      apiRequest<CollectionDocument>(plan.path, { query: new URLSearchParams(pageParam) }),
    getNextPageParam: (lastPage) => nextPageQuery(lastPage)?.toString(),
  })
  const [refreshing, setRefreshing] = useState(false)
  const data = query.data
  const view = useMemo(
    () => (data === undefined ? null : listView(resource, plan, data.pages)),
    [data, resource, plan],
  )

  return {
    view,
    loadingMore: query.isFetchingNextPage,
    refreshing,
    retrying: query.isFetching && !refreshing,
    // 읽는 중에 부르면 TanStack Query 가 진행 중인 재조회를 끊고 다음 쪽을 부른다 - 그래서
    // 읽는 중에는 부르지 않는다(TanStack Query v5 무한 조회 안내의 규칙).
    loadMore: () => {
      if (query.hasNextPage && !query.isFetching) void query.fetchNextPage()
    },
    refresh: () => {
      setRefreshing(true)
      void query.refetch().finally(() => {
        setRefreshing(false)
      })
    },
    retry: () => {
      void query.refetch()
    },
  }
}

export interface ResourceDetailState {
  /** 응답을 받기 전이면 `null` - 화면은 스켈레톤을 그린다(스펙 8.7). 데이터와 자원이 그대로면 같은 객체다. */
  view: DetailView | null
  /**
   * 조회가 진행 중이다(`isFetching`) - 앱 복귀·네트워크 복귀의 재조회에서도 참이다. 실패 화면(`RequestFailed`)의
   * "다시 시도" 버튼이 스피너를 그릴 때만 읽는다 - 다른 자리에서 "다시 시도 중" 으로 읽지 않는다.
   */
  retrying: boolean
  retry: () => void
}

/**
 * 상세 하나. `id` 는 라우트의 동적 세그먼트 그대로다 - 이스케이프는 `detailRequest` 가 한다.
 * 화면에 다시 들어오면 캐시를 먼저 그리고 다시 부른다(`staleTime` 0, 스펙 8.5). `view` 는 `useMemo` 로
 * 고정한다 - 응답(`query.data`)이나 자원이 바뀔 때만 다시 만든다.
 */
export function useResourceDetail(resource: ResourceDefinition, id: string): ResourceDetailState {
  const plan = detailRequest(resource, id)
  const query = useQuery({
    queryKey: queryKeys.detail(resource.type, id),
    queryFn: () => apiRequest<SingleDocument>(plan.path, plan.options),
  })
  const data = query.data
  const view = useMemo(
    () => (data === undefined ? null : detailView(resource, data)),
    [data, resource],
  )

  return {
    view,
    retrying: query.isFetching,
    retry: () => {
      void query.refetch()
    },
  }
}
