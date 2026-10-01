import { hashKey, infiniteQueryOptions, queryOptions } from '@tanstack/react-query'

import type { JsonApiResult } from '@/lib/jsonapi/client'
import type { CollectionDocument, SingleDocument } from '@/lib/jsonapi/document'
import type { JsonApiSend } from '@/lib/jsonapi/send'
import type { ResourceDefinition } from '@/lib/resources/define'
import { relationshipTargets } from '@/lib/resources/form'
import {
  referenceState,
  throwIfUnreachable,
  type ReferenceState,
} from '@/lib/resources/screen-state'
import {
  detailRequest,
  nextPageQuery,
  referenceRequest,
  type ListRequest,
} from '@/lib/resources/view'
import { queryKeys } from '@/queries/keys'

/**
 * 자원 조회의 Query 옵션 - 키·요청·다음 쪽. 훅(`queries/resources.ts`)이 `apiRequest` 를 넣어 쓰고, 시험
 * (test/unit/queries/resource-options.test.ts)이 가짜 요청을 넣어 실제 QueryClient 로 전이를 잰다. React 와
 * 기기 모듈을 모른다.
 *
 * `queryFn` 은 백엔드의 판정을 받지 못한 조회 - 응답조차 없었거나, 판정하지 않은 응답(5xx·408·429)이다 - 를
 * 던진다(`throwIfUnreachable`) - TanStack Query 가 재조회의 실패에도 읽은 데이터를 두게 한다
 * (lib/resources/screen-state.ts). 판정한 백엔드 오류 문서(그 밖의 4xx)는 결과 값으로 캐시에 든다 - 화면이
 * 협상된 문구를 배너로 그린다.
 */

/**
 * 구독을 끊은 쌓인 화면의 조회를 캐시에 두는 시간 - 기본값(5분) 뒤에 지워지면 다시 앞에 온 화면이 스켈레톤과 첫 쪽부터
 * 다시 읽고 스크롤 위치를 잃는다(`subscribed: false`, queries/resources.ts). 목록·상세·참조 목록의 옵션이 준다.
 */
export const SCREEN_QUERY_GC_TIME = 30 * 60 * 1000

/**
 * 목록 - 쪽 인자는 백엔드 쿼리 문자열이다. 첫 쪽은 `listRequest` 의 쿼리(커서의 입구), 다음 쪽은
 * `nextPageQuery`(응답의 `links.next`, 스펙 8.3). 실패한 쪽 뒤로는 읽지 않는다(`nextPageQuery` 가 `null`).
 */
export function listQueryOptions(
  resource: ResourceDefinition,
  plan: ListRequest,
  send: JsonApiSend,
) {
  return infiniteQueryOptions({
    queryKey: queryKeys.list(resource.type, plan.query.toString()),
    initialPageParam: plan.query.toString(),
    queryFn: async ({ pageParam }) =>
      throwIfUnreachable(
        await send<CollectionDocument>(plan.path, { query: new URLSearchParams(pageParam) }),
        '목록',
      ),
    getNextPageParam: (lastPage) => nextPageQuery(lastPage)?.toString(),
    gcTime: SCREEN_QUERY_GC_TIME,
  })
}

/** 상세 하나. `id` 는 라우트의 동적 세그먼트 그대로다 - 이스케이프는 `detailRequest` 가 한다. */
export function detailQueryOptions(resource: ResourceDefinition, id: string, send: JsonApiSend) {
  const plan = detailRequest(resource, id)
  return queryOptions({
    queryKey: queryKeys.detail(resource.type, id),
    queryFn: async () =>
      throwIfUnreachable(await send<SingleDocument>(plan.path, plan.options), '상세'),
    gcTime: SCREEN_QUERY_GC_TIME,
  })
}

/**
 * 관계 선택기의 참조 목록 하나 - 대상 자원의 첫 쪽(`referenceRequest`, 이름 순 100건). 키는 대상 자원의 목록 키다
 * (`queryKeys.list`) - 참조 목록도 그 자원의 목록이다. 닿지 못함은 목록·상세처럼 던진다 - 재조회가 닿지 못해도 읽은
 * 보기가 남는다(`referenceState`).
 */
export function referenceQueryOptions(target: ResourceDefinition, send: JsonApiSend) {
  const plan = referenceRequest(target)
  return queryOptions({
    queryKey: queryKeys.list(target.type, plan.query.toString()),
    queryFn: async () =>
      throwIfUnreachable(await send<CollectionDocument>(plan.path, plan.options), '참조 목록'),
    gcTime: SCREEN_QUERY_GC_TIME,
  })
}

/** 관계 하나의 선택기가 그릴 참조 목록 - `referenceState`(lib/resources/screen-state.ts)에 다시 부르는 길을 더했다. */
export interface RelationshipReference extends ReferenceState {
  /** 조회가 진행 중이다(`isFetching`) - 시트 안의 실패 화면(`RequestFailed`)이 "다시 시도" 의 스피너에만 쓴다. */
  readonly retrying: boolean
  readonly retry: () => void
  /** 대상 자원에 쓰기 라우트가 있는가 - 선언의 `writable` 이다. 선택기가 안내에 쓴다. */
  readonly writable: boolean
}

/** 관계 하나가 읽는 참조 조회 - `ReferencePlan.queries` 안의 자리(`index`)다. */
interface ReferenceSlot {
  readonly name: string
  readonly target: ResourceDefinition
  readonly index: number
}

/**
 * 폼의 관계 선택기들이 읽을 참조 조회들. 관계마다 대상 자원의 참조 조회(`referenceQueryOptions`) 하나이고, 같은 자원을
 * 가리키는 관계들은 조회 하나를 나눈다 - 같은 키를 `useQueries` 에 두 번 넣으면 TanStack Query 가 경고하고 한 조회의
 * 데이터를 나눠 갖는다(그 문서가 권하는 대로 중복을 없애고 결과를 관계에 되돌려 잇는다).
 */
export interface ReferencePlan {
  /** 중복 없는 조회들 - `useQueries` 에 그대로 넣는다. */
  readonly queries: readonly ReturnType<typeof referenceQueryOptions>[]
  /** 관계 하나마다 하나 - 선언의 순서다. */
  readonly slots: readonly ReferenceSlot[]
}

/** 관계는 선언에서 온다(`relationshipTargets`) - 선언에 관계를 더하면 생성·수정 화면이 함께 따라온다. */
export function referencePlan(resource: ResourceDefinition, send: JsonApiSend): ReferencePlan {
  const queries: ReturnType<typeof referenceQueryOptions>[] = []
  const indexByKey = new Map<string, number>()
  const slots = relationshipTargets(resource).map(([name, target]): ReferenceSlot => {
    const options = referenceQueryOptions(target, send)
    const key = hashKey(options.queryKey)
    let index = indexByKey.get(key)
    if (index === undefined) {
      index = queries.push(options) - 1
      indexByKey.set(key, index)
    }
    return { name, target, index }
  })
  return { queries, slots }
}

/** `useQueries` 가 조회마다 주는 결과 가운데 선택기가 읽는 것. */
export interface ReferenceQueryResult {
  readonly data: JsonApiResult<CollectionDocument> | undefined
  readonly error: Error | null
  readonly isFetching: boolean
  readonly refetch: () => Promise<unknown>
}

/**
 * 조회 결과들을 관계마다 선택기가 그릴 것으로 잇는다. `useQueries` 의 `combine` 에 안정된 함수로 넣는다 - TanStack Query 가
 * 결과가 바뀔 때만 다시 돌리고 그 결과를 구조 공유한다. 그래서 렌더마다 새 객체와 새 `retry` 를 만들지 않고, 바뀌지 않은
 * 보기(`list`)는 다른 조회가 바뀌어도 같은 객체다. 결과는 plain 객체와 배열로 둔다 - 구조 공유는 그것만 이어 붙인다.
 */
export function combineReferences(
  plan: ReferencePlan,
  results: readonly ReferenceQueryResult[],
): Readonly<Record<string, RelationshipReference>> {
  return Object.fromEntries(
    plan.slots.map(({ name, target, index }): [string, RelationshipReference] => {
      const query = results[index]
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
