import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query'

import type { CollectionDocument, SingleDocument } from '@/lib/jsonapi/document'
import type { JsonApiSend } from '@/lib/jsonapi/send'
import type { ResourceDefinition } from '@/lib/resources/define'
import { throwIfUnreachable } from '@/lib/resources/screen-state'
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
  })
}

/** 상세 하나. `id` 는 라우트의 동적 세그먼트 그대로다 - 이스케이프는 `detailRequest` 가 한다. */
export function detailQueryOptions(resource: ResourceDefinition, id: string, send: JsonApiSend) {
  const plan = detailRequest(resource, id)
  return queryOptions({
    queryKey: queryKeys.detail(resource.type, id),
    queryFn: async () =>
      throwIfUnreachable(await send<SingleDocument>(plan.path, plan.options), '상세'),
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
  })
}
