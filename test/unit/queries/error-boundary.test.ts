import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { JsonApiResult } from '@/lib/jsonapi/client'
import type { JsonApiSend } from '@/lib/jsonapi/send'
import { defineResource } from '@/lib/resources/define'
import { detailScreen } from '@/lib/resources/screen-state'
import { retryWithClearedQueries } from '@/queries/error-boundary'
import { detailQueryOptions } from '@/queries/resource-options'

/**
 * 오류 경계의 "다시 시도" 앞의 캐시 비우기(queries/error-boundary.ts). 실제 QueryClient 와 화면 조회의 옵션으로 잰다 -
 * 결함이 결과 값으로 캐시에 들고 다시 그린 화면이 그것을 요청 없이 읽는다는 것은 TanStack Query 의 동작이라 가짜로는 잴
 * 수 없다.
 *
 * 다시 그린 화면의 첫 렌더는 `useQuery` 처럼 관찰자의 `getOptimisticResult` 로 읽는다 - 렌더 중에 던지면 구독(과 구독이
 * 부르는 조회)에 닿지 못한다. 자원 선언은 실전 값이 아니다(probe).
 */
const resource = defineResource({
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

/** 판정한 결함만 돌려주는 가짜 백엔드 - 본문 없는 성공 응답. 상세 화면이 그 결과를 읽으면 렌더 중에 던진다. */
function noBodyBackend() {
  const state = { calls: 0 }
  const send: JsonApiSend = <T>(): Promise<JsonApiResult<T>> => {
    state.calls += 1
    return Promise.resolve({ ok: true, status: 204, document: null })
  }
  return { state, send }
}

const client = new QueryClient({
  defaultOptions: { queries: { staleTime: 0, retry: false } },
})

afterEach(() => {
  client.clear()
})

/** 다시 그린 상세 화면의 첫 렌더가 읽는 결과와, 그 결과로 정한 화면(결함이면 던진다). */
function firstRender(send: JsonApiSend) {
  const options = client.defaultQueryOptions(detailQueryOptions(resource, 'probe-1', send))
  const result = new QueryObserver(client, options).getOptimisticResult(options)
  return {
    result,
    screen: () => detailScreen(resource, { result: result.data, error: result.error }),
  }
}

describe('retryWithClearedQueries', () => {
  it('비우지 않으면 다시 그린 화면이 캐시의 결함을 요청 없이 다시 던진다 - 비우면 받기 전 화면으로 시작한다', async () => {
    const backend = noBodyBackend()
    await client.fetchQuery(detailQueryOptions(resource, 'probe-1', backend.send))
    expect(firstRender(backend.send).screen).toThrow('본문 없는 응답')
    expect(backend.state.calls).toBe(1)

    await retryWithClearedQueries(client, () => Promise.resolve())

    const after = firstRender(backend.send)
    expect(after.result.data).toBeUndefined()
    expect(after.screen()).toEqual({ kind: 'loading' })
  })

  it('경계를 풀기 전에 비운다 - 경계가 다시 그리는 순간 캐시에 조회가 없다', async () => {
    const backend = noBodyBackend()
    await client.fetchQuery(detailQueryOptions(resource, 'probe-1', backend.send))
    let cachedAtRetry = -1
    const retry = vi.fn(() => {
      cachedAtRetry = client.getQueryCache().getAll().length
      return Promise.resolve()
    })

    await retryWithClearedQueries(client, retry)

    expect(retry).toHaveBeenCalledTimes(1)
    expect(cachedAtRetry).toBe(0)
  })

  it('쓰기 캐시는 비우지 않는다 - 로그아웃과 같은 범위다', async () => {
    client.getMutationCache().build(client, { mutationKey: ['probe', 'write'] })

    await retryWithClearedQueries(client, () => Promise.resolve())

    expect(client.getMutationCache().getAll()).toHaveLength(1)
  })
})
