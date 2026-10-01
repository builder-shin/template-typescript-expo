import { useInfiniteQuery, useQueries, useQuery } from '@tanstack/react-query'
import { useIsFocused } from 'expo-router'
import { useMemo, useState } from 'react'

import type { JsonApiResult } from '@/lib/jsonapi/client'
import type { SingleDocument } from '@/lib/jsonapi/document'
import type { ResourceDefinition } from '@/lib/resources/define'
import { relationshipTargets } from '@/lib/resources/form'
import {
  canLoadMore,
  detailScreen,
  listScreen,
  referenceState,
  type DetailScreen,
  type ListScreen,
  type ReferenceState,
} from '@/lib/resources/screen-state'
import { listRequest } from '@/lib/resources/view'
import { apiRequest } from '@/platform/api'
import {
  detailQueryOptions,
  listQueryOptions,
  referenceQueryOptions,
} from '@/queries/resource-options'

/**
 * 자원의 조회 훅 - 목록(무한 스크롤)과 상세(스펙 8.4).
 *
 * 판단은 lib/ 가 한다 - 무엇을 요청할지와 다음 쪽이 어디인지(`lib/resources/view.ts`), Query 의 데이터·오류를
 * 어떤 화면 상태로 그릴지(`listScreen`·`detailScreen`, `lib/resources/screen-state.ts`). 키와 요청은
 * `resource-options.ts` 가 정한다. 여기서는 그 결정을 TanStack Query 에 잇기만 한다. 요청은 전부
 * `apiRequest`(platform/api.ts)를 지난다 - 그 자리가 Accept-Language 를 싣는다(스펙 9.4).
 *
 * `apiRequest` 는 결과 값을 돌려준다 - 백엔드 오류도 닿지 못함도 값이다. 설정 오류만 예외다: `request()` 가
 * 일부러 던진다(queries/AGENTS.md). 조회의 `queryFn` 은 그 값 가운데 백엔드의 판정을 받지 못한 것 - 닿지 못함과
 * 판정하지 않은 응답(5xx·408·429) - 만 던진다. TanStack Query 가 재조회의 실패에도 읽은 데이터를 두게 하려는
 * 것이다(`throwIfUnreachable`). 판정한 백엔드 오류 문서는 값으로 캐시에 들어 배너가 된다.
 */

/** 라우트 파라미터 - `useLocalSearchParams()` 가 주는 모양. */
type RouteParams = Readonly<Record<string, string | string[] | undefined>>

/**
 * 내용이 같으면 같은 객체를 준다. `useLocalSearchParams()` 는 호출마다 새 객체를 만들고 `listRouteParams`
 * 도 그렇다 - 그 동일성에 기대면 조건(`plan`)과 그 위의 `screen` 이 렌더마다 바뀐다. 라우트 파라미터는 문자열과
 * 문자열 배열이라 JSON 을 오가도 그대로다.
 */
function useContentStable<T>(value: T): T {
  const key = JSON.stringify(value)
  return useMemo(() => JSON.parse(key) as T, [key])
}

export interface ResourceListState {
  /**
   * 화면이 그릴 것 - `listScreen`(lib/resources/screen-state.ts). 첫 쪽을 받기 전이면 `loading`(스켈레톤, 스펙
   * 8.7)이다. 데이터·오류·자원·조건이 그대로면 같은 객체다 - `FlatList` 의 `data`(`screen.rows`)가 렌더마다
   * 바뀌지 않는다.
   */
  screen: ListScreen
  /** 다음 쪽을 읽는 중 - 목록 끝에 스피너만 그린다(스펙 8.7). */
  loadingMore: boolean
  /** 사용자가 당겨서 새로고침하는 중. 앱 복귀·네트워크 복귀의 재조회는 여기 들지 않는다. */
  refreshing: boolean
  /**
   * 조회가 진행 중이다(`isFetching` - 당겨서 새로고침은 `refreshing` 이라 뺀다). 다음 쪽을 읽는 중과 앱 복귀·
   * 네트워크 복귀의 재조회에서도 참이다. 실패(`RequestFailed`)의 "다시 시도" 버튼이 스피너를 그릴 때만 읽는다 -
   * 다른 자리에서 "다시 시도 중" 으로 읽지 않는다.
   */
  retrying: boolean
  /** 목록 끝에 닿았을 때 - 다음 쪽이 있고, 읽는 중이 아니고, 다음 쪽이 닿지 못한 채가 아닐 때만 읽는다. */
  loadMore: () => void
  refresh: () => void
  /** 읽은 것을 처음부터 다시 읽는다 - 전체 화면 실패와 목록 위의 작은 실패(재조회가 닿지 못했다)의 "다시 시도". */
  retry: () => void
  /** 닿지 못한 다음 쪽만 다시 읽는다 - 목록 끝의 작은 실패의 "다시 시도". */
  retryNextPage: () => void
}

/**
 * 목록 - 라우트 파라미터가 곧 쿼리다(스펙 8.2). 첫 쪽은 커서의 입구에서 시작하고, 다음 쪽은
 * 응답의 `links.next` 를 따라간다(스펙 8.3, `listQueryOptions`).
 *
 * `screen` 은 `useMemo` 로 고정한다 - 읽은 쪽들(`query.data`)·오류·자원·조건이 바뀔 때만 다시 만든다. 조건은
 * 라우트 파라미터의 내용으로 고정한다(`useContentStable`).
 */
export function useResourceList(
  resource: ResourceDefinition,
  params: RouteParams,
): ResourceListState {
  const stableParams = useContentStable(params)
  const plan = useMemo(() => listRequest(resource, stableParams), [resource, stableParams])
  // 쌓인 화면(조건을 바꿀 때마다 쌓이는 목록, 상세·수정 밑의 목록)은 구독을 끊는다 - 앱 복귀·네트워크 복귀·무효화의
  // 재조회가 보이는 화면만 부르고, 쌓인 화면은 다시 앞에 올 때 다시 구독하며 부른다(`staleTime` 0). TanStack Query 의
  // React Native 안내 그대로다(D3 최종 검토 M2 - 스택 깊이만큼 읽은 쪽 전부를 다시 읽었다).
  const focused = useIsFocused()
  const query = useInfiniteQuery({
    ...listQueryOptions(resource, plan, apiRequest),
    subscribed: focused,
  })
  const [refreshing, setRefreshing] = useState(false)
  const { data, error, isFetchNextPageError } = query
  const screen = useMemo(
    () =>
      listScreen(resource, plan, {
        pages: data?.pages,
        error,
        nextPageFailed: isFetchNextPageError,
      }),
    [resource, plan, data, error, isFetchNextPageError],
  )

  return {
    screen,
    loadingMore: query.isFetchingNextPage,
    refreshing,
    retrying: query.isFetching && !refreshing,
    // 부를지는 `canLoadMore`(lib/resources/screen-state.ts)가 정한다 - 다음 쪽이 없거나, 읽는 중이거나, 다음 쪽이
    // 실패한 채면 부르지 않는다.
    loadMore: () => {
      if (canLoadMore(query)) void query.fetchNextPage()
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
    retryNextPage: () => {
      void query.fetchNextPage()
    },
  }
}

export interface ResourceDetailState {
  /**
   * 화면이 그릴 것 - `detailScreen`(lib/resources/screen-state.ts). 응답을 받기 전이면 `loading`(스켈레톤, 스펙
   * 8.7)이다. 데이터·오류·자원이 그대로면 같은 객체다.
   */
  screen: DetailScreen
  /**
   * `screen` 을 만든 응답 그대로 - 수정 화면이 폼의 첫 값을 읽는다(`initialFormValues`). 화면 상태에는 enum 원값과
   * 관계 id 가 없다(lib/resources/form.ts 머리말의 R7). 받기 전이면 `null` 이다.
   */
  result: JsonApiResult<SingleDocument> | null
  /**
   * 조회가 진행 중이다(`isFetching`) - 앱 복귀·네트워크 복귀의 재조회에서도 참이다. 실패(`RequestFailed`)의
   * "다시 시도" 버튼이 스피너를 그릴 때만 읽는다 - 다른 자리에서 "다시 시도 중" 으로 읽지 않는다.
   */
  retrying: boolean
  retry: () => void
}

/**
 * 상세 하나. 화면에 다시 들어오면 캐시를 먼저 그리고 다시 부른다(`staleTime` 0, 스펙 8.5) - 그 재조회가 닿지
 * 못해도 캐시의 상세를 둔다(`detailScreen` 의 `refreshFailed`). `screen` 은 `useMemo` 로 고정한다. 쌓인 화면은
 * 구독하지 않는다(`useResourceList` 와 같다).
 *
 * `enabled` 가 거짓이면 부르지 않는다 - 수정 화면이 그 자원을 지운 뒤에 쓴다(queries/writes.ts 의 `deleted`).
 * 삭제가 캐시에서 지운 상세를 지켜보던 화면이 다시 그려지면 새 조회가 없는 자원을 부른다.
 */
export function useResourceDetail(
  resource: ResourceDefinition,
  id: string,
  { enabled = true }: { enabled?: boolean } = {},
): ResourceDetailState {
  const focused = useIsFocused()
  const query = useQuery({
    ...detailQueryOptions(resource, id, apiRequest),
    enabled,
    subscribed: focused,
  })
  const { data, error } = query
  const screen = useMemo(
    () => detailScreen(resource, { result: data, error }),
    [resource, data, error],
  )

  return {
    screen,
    result: data ?? null,
    retrying: query.isFetching,
    retry: () => {
      void query.refetch()
    },
  }
}

/** 관계 하나의 선택기가 그릴 참조 목록 - `referenceState`(lib/resources/screen-state.ts)에 다시 부르는 길을 더했다. */
export interface RelationshipReference extends ReferenceState {
  /** 조회가 진행 중이다(`isFetching`) - 시트 안의 실패 화면(`RequestFailed`)이 "다시 시도" 의 스피너에만 쓴다. */
  readonly retrying: boolean
  readonly retry: () => void
  /** 대상 자원에 쓰기 라우트가 있는가 - 선언의 `writable` 이다. 선택기가 안내에 쓴다. */
  readonly writable: boolean
}

/**
 * 폼의 관계 선택기들이 그릴 참조 목록 - 관계마다 대상 자원의 첫 쪽(`referenceQueryOptions`, 이름 순 100건)이다.
 * 관계는 선언에서 온다(`relationshipTargets`) - 선언에 관계를 더하면 생성·수정 화면이 함께 따라온다. 참조 조회는
 * 공개 읽기라 토큰을 싣지 않고, 서로 기다리지 않고 나란히 나간다. 쌓인 화면은 구독하지 않는다(`useResourceList` 와
 * 같다).
 */
export function useRelationshipReferences(
  resource: ResourceDefinition,
): Readonly<Record<string, RelationshipReference>> {
  const focused = useIsFocused()
  const targets = useMemo(() => relationshipTargets(resource), [resource])
  const options = useMemo(
    () => targets.map(([, target]) => referenceQueryOptions(target, apiRequest)),
    [targets],
  )
  const queries = useQueries({ queries: options, subscribed: focused })

  return Object.fromEntries(
    targets.map(([name, target], index): [string, RelationshipReference] => {
      const query = queries[index]
      return [
        name,
        {
          ...referenceState(target, { result: query?.data, error: query?.error ?? null }),
          retrying: query?.isFetching ?? false,
          retry: () => {
            void query?.refetch()
          },
          writable: target.writable,
        },
      ]
    }),
  )
}
