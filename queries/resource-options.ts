import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query'

import type { CollectionDocument, SingleDocument } from '@/lib/jsonapi/document'
import type { JsonApiSend } from '@/lib/jsonapi/send'
import type { ResourceDefinition } from '@/lib/resources/define'
import { throwIfUnreachable } from '@/lib/resources/screen-state'
import { detailRequest, nextPageQuery, type ListRequest } from '@/lib/resources/view'
import { queryKeys } from '@/queries/keys'

/**
 * 자원 조회의 Query 옵션 - 키·요청·다음 쪽. 훅(`queries/resources.ts`)이 `apiRequest` 를 넣어 쓰고, 시험
 * (test/unit/queries/resource-options.test.ts)이 가짜 요청을 넣어 실제 QueryClient 로 전이를 잰다. React 와
 * 기기 모듈을 모른다.
 *
 * `queryFn` 은 백엔드가 응답조차 주지 못한 실패를 던진다(`throwIfUnreachable`) - TanStack Query 가 재조회의
 * 실패에도 읽은 데이터를 두게 한다(lib/resources/screen-state.ts). 백엔드 오류 문서는 결과 값으로 캐시에
 * 든다 - 화면이 협상된 문구를 배너로 그린다.
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
