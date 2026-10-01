import { QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { JsonApiResult } from '@/lib/jsonapi/client'
import type { JsonApiSend } from '@/lib/jsonapi/send'
import { defineResource } from '@/lib/resources/define'
import { listRequest } from '@/lib/resources/view'
import {
  SCREEN_QUERY_GC_TIME,
  detailQueryOptions,
  listQueryOptions,
  referenceQueryOptions,
} from '@/queries/resource-options'

/**
 * 화면 조회(목록·상세·참조 목록)의 `gcTime`. 쌓인 화면은 구독을 끊는다(`subscribed: false`, queries/resources.ts) -
 * 구독자가 없는 조회는 `gcTime` 뒤에 캐시에서 지워지고, 다시 앞에 온 화면은 스켈레톤과 첫 쪽부터 다시 읽어 스크롤 위치를
 * 잃는다. 기본값(5분)보다 길게 줘서 그 시간 안에 돌아온 화면은 읽은 쪽을 그대로 그린다.
 *
 * 옵션의 값을 재고, 실제 QueryClient 에서 구독자 없는 조회가 그 시간 동안 남는지도 가짜 시계로 잰다.
 */
const PROBE_CRATE = defineResource({
  type: 'probeCrates',
  path: '/probe/api/crates',
  attributes: {
    probeName: {
      kind: 'string',
      label: 'PROBE 이름',
      readOnly: false,
      nullable: false,
      listed: true,
    },
  },
  relationships: {},
  filters: {},
  sorts: ['probeName'],
  defaultSort: 'probeName',
  includes: [],
  writable: false,
})

/**
 * TanStack Query 의 `gcTime` 기본값 - 앱(React Native)의 값이다. node 에서는 서버로 보아 기본값이 무한이라, 앱의 기본값을
 * 클라이언트 기본값으로 따로 준다 - 옵션이 `gcTime` 을 주지 않으면 이 값이 적용된다(platform/query-client.ts 도 주지 않는다).
 */
const APP_DEFAULT_GC_TIME = 5 * 60 * 1000

/** 어떤 요청에도 성공한다 - 목록·참조 목록의 끝(`links.next: null`)이고 상세는 본문이 중요하지 않다. */
const send: JsonApiSend = <T>(): Promise<JsonApiResult<T>> =>
  Promise.resolve({
    ok: true,
    status: 200,
    document: { data: [], links: { next: null } } as T,
  })

const SCREEN_QUERIES = [
  {
    label: '목록',
    options: listQueryOptions(PROBE_CRATE, listRequest(PROBE_CRATE, {}), send),
    prefetch: (client: QueryClient) =>
      client.prefetchInfiniteQuery(
        listQueryOptions(PROBE_CRATE, listRequest(PROBE_CRATE, {}), send),
      ),
  },
  {
    label: '상세',
    options: detailQueryOptions(PROBE_CRATE, 'probe-1', send),
    prefetch: (client: QueryClient) =>
      client.prefetchQuery(detailQueryOptions(PROBE_CRATE, 'probe-1', send)),
  },
  {
    label: '참조 목록',
    options: referenceQueryOptions(PROBE_CRATE, send),
    prefetch: (client: QueryClient) =>
      client.prefetchQuery(referenceQueryOptions(PROBE_CRATE, send)),
  },
] as const

let client: QueryClient

beforeEach(() => {
  client = new QueryClient({
    defaultOptions: {
      queries: { staleTime: 0, retry: false, gcTime: APP_DEFAULT_GC_TIME },
    },
  })
})

afterEach(() => {
  vi.useRealTimers()
  client.clear()
})

describe('SCREEN_QUERY_GC_TIME', () => {
  it('앱의 기본값보다 길고 끝이 있다 - 돌아올 시간을 주되 캐시를 영영 두지는 않는다', () => {
    expect(SCREEN_QUERY_GC_TIME).toBeGreaterThan(APP_DEFAULT_GC_TIME)
    expect(Number.isFinite(SCREEN_QUERY_GC_TIME)).toBe(true)
  })
})

describe('화면 조회의 옵션', () => {
  it.each(SCREEN_QUERIES)('$label 은 gcTime 에 SCREEN_QUERY_GC_TIME 을 준다', ({ options }) => {
    expect(options.gcTime).toBe(SCREEN_QUERY_GC_TIME)
  })
})

describe('구독자가 없는 화면 조회의 수명 - 실제 QueryClient', () => {
  it.each(SCREEN_QUERIES)(
    '$label 은 앱의 기본값(5분)이 지나도 캐시에 남고 SCREEN_QUERY_GC_TIME 이 지나야 지워진다',
    async ({ options, prefetch }) => {
      vi.useFakeTimers()
      const cached = () =>
        client.getQueryCache().find({ queryKey: options.queryKey, exact: true }) !== undefined

      // prefetch 한 조회는 구독자가 없다 - 구독을 끊은 쌓인 화면의 조회와 같다.
      await prefetch(client)
      expect(cached()).toBe(true)

      await vi.advanceTimersByTimeAsync(APP_DEFAULT_GC_TIME + 1_000)
      expect(cached()).toBe(true)

      await vi.advanceTimersByTimeAsync(SCREEN_QUERY_GC_TIME)
      expect(cached()).toBe(false)
    },
  )
})
