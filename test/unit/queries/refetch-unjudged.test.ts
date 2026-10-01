import { InfiniteQueryObserver, QueryClient, QueryObserver } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { JsonApiResult, RequestOptions } from '@/lib/jsonapi/client'
import type { CollectionDocument, ErrorObject, SingleDocument } from '@/lib/jsonapi/document'
import { defineResource } from '@/lib/resources/define'
import { detailScreen, listScreen } from '@/lib/resources/screen-state'
import { listRequest } from '@/lib/resources/view'
import { detailQueryOptions, listQueryOptions } from '@/queries/resource-options'

/**
 * 재조회가 판정하지 않은 응답(5xx)을 받는 전이 - 실제 QueryClient 로 잰다(test/unit/queries/resource-options.test.ts
 * 와 같은 길, 옵션도 앱의 것과 같다). D3 재검토가 넘긴 것: 목록의 재조회가 백엔드 오류 문서를 결과 값으로 받으면
 * 읽은 쪽 전부가 오류 한 쪽으로 바뀌고 다음 재조회는 한 쪽만 읽었다. 판정하지 않은 응답을 던지면 읽은 쪽이 남고,
 * 다음 재조회가 쪽 전부를 다시 읽는다.
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
const plan = listRequest(resource, {})

const BUSY: ErrorObject = { status: '503', code: 'PROBE_BUSY', detail: 'PROBE 잠시 뒤에' }

/** 세 쪽, 쪽마다 두 행. 커서는 `page[after]` 값이다 - 첫 쪽은 빈 커서. */
const PAGES: Record<string, { ids: string[]; next: string | null }> = {
  '': { ids: ['a1', 'a2'], next: 'probe-c2' },
  'probe-c2': { ids: ['b1', 'b2'], next: 'probe-c3' },
  'probe-c3': { ids: ['c1', 'c2'], next: null },
}

/** 가짜 백엔드 - `busy` 면 판정하지 않은 응답(503 오류 문서)을 돌려준다. */
function probeBackend() {
  const state = { busy: false, calls: 0 }
  const send = <T>(path: string, options?: RequestOptions): Promise<JsonApiResult<T>> => {
    state.calls += 1
    if (state.busy) return Promise.resolve({ ok: false, status: 503, errors: [BUSY] })
    if (path.endsWith('/c1')) {
      const document: SingleDocument = {
        data: { type: 'probeCrates', id: 'c1', attributes: { probeName: 'PROBE c1' } },
      }
      return Promise.resolve({ ok: true, status: 200, document: document as T })
    }
    const after = options?.query?.get('page[after]') ?? ''
    const page = PAGES[after]
    if (page === undefined) throw new Error(`PROBE 모르는 커서: ${after}`)
    const document: CollectionDocument = {
      data: page.ids.map((id) => ({ type: 'probeCrates', id, attributes: { probeName: id } })),
      links: {
        next: page.next === null ? null : `/probe/api/crates?page%5Bafter%5D=${page.next}`,
      },
    }
    return Promise.resolve({ ok: true, status: 200, document: document as T })
  }
  return { state, send }
}

let client: QueryClient

beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { queries: { staleTime: 0, retry: false, networkMode: 'offlineFirst' } },
  })
  client.mount()
})

afterEach(() => {
  client.unmount()
  client.clear()
})

/**
 * `trigger` 가 일으킨 조회의 결과(성공이든 실패든)가 캐시에 들 때까지 기다린다 - resource-options.test.ts 와 같다.
 * 구독이 여는 첫 조회는 기다릴 Promise 를 주지 않는다.
 */
async function nextResult(queryKey: readonly unknown[], trigger: () => void) {
  const state = () => client.getQueryCache().find({ queryKey })?.state
  const count = () => (state()?.dataUpdateCount ?? 0) + (state()?.errorUpdateCount ?? 0)
  const before = count()
  trigger()
  await vi.waitFor(() => {
    if (count() === before || state()?.fetchStatus !== 'idle') throw new Error('아직 부르는 중')
  })
}

async function listObserver(send: ReturnType<typeof probeBackend>['send']) {
  const options = listQueryOptions(resource, plan, send)
  const observer = new InfiniteQueryObserver(client, options)
  let unsubscribe = () => undefined as void
  await nextResult(options.queryKey, () => {
    unsubscribe = observer.subscribe(() => undefined)
  })
  const screen = () => {
    const result = observer.getCurrentResult()
    return listScreen(resource, plan, {
      pages: result.data?.pages,
      error: result.error,
      nextPageFailed: result.isFetchNextPageError,
    })
  }
  return { observer, unsubscribe: () => unsubscribe(), screen }
}

function rowIds(screen: ReturnType<typeof listScreen>) {
  if (screen.kind !== 'list') throw new Error(`목록이어야 한다 - ${screen.kind}`)
  return screen.rows.map((row) => row.id)
}

describe('목록 - 재조회가 판정하지 않은 응답을 받아도 읽은 쪽을 버리지 않는다', () => {
  it('세 쪽을 읽은 뒤 재조회가 503 → 행 여섯과 작은 실패, 다음 재조회 → 세 쪽을 다시 읽는다', async () => {
    const backend = probeBackend()
    const { observer, unsubscribe, screen } = await listObserver(backend.send)
    await observer.fetchNextPage()
    await observer.fetchNextPage()
    expect(rowIds(screen())).toEqual(['a1', 'a2', 'b1', 'b2', 'c1', 'c2'])
    expect(backend.state.calls).toBe(3)

    backend.state.busy = true
    await observer.refetch()
    expect(backend.state.calls).toBe(4)
    expect(rowIds(screen())).toEqual(['a1', 'a2', 'b1', 'b2', 'c1', 'c2'])
    expect(screen()).toMatchObject({ refreshFailed: true, failure: null })

    backend.state.busy = false
    await observer.refetch()
    expect(backend.state.calls).toBe(7)
    expect(rowIds(screen())).toEqual(['a1', 'a2', 'b1', 'b2', 'c1', 'c2'])
    expect(screen()).toMatchObject({ refreshFailed: false, failure: null })
    unsubscribe()
  })

  it('첫 조회가 503 이면 그 문구의 배너가 화면 전부다 - 다시 부르면 목록이다', async () => {
    const backend = probeBackend()
    backend.state.busy = true
    const { observer, unsubscribe, screen } = await listObserver(backend.send)
    expect(screen()).toEqual({
      kind: 'banner',
      messages: ['PROBE 잠시 뒤에'],
      refreshFailed: false,
      retryable: true,
    })
    backend.state.busy = false
    await observer.refetch()
    expect(rowIds(screen())).toEqual(['a1', 'a2'])
    unsubscribe()
  })
})

describe('상세 - 재조회가 판정하지 않은 응답을 받아도 읽은 상세를 둔다', () => {
  it('읽은 상세 → 재조회 503: 상세와 작은 실패 → 다시 부르면 작은 실패가 사라진다', async () => {
    const backend = probeBackend()
    const options = detailQueryOptions(resource, 'c1', backend.send)
    const observer = new QueryObserver(client, options)
    let unsubscribe = () => undefined as void
    await nextResult(options.queryKey, () => {
      unsubscribe = observer.subscribe(() => undefined)
    })
    const screen = () => {
      const result = observer.getCurrentResult()
      return detailScreen(resource, { result: result.data, error: result.error })
    }
    expect(screen()).toMatchObject({ kind: 'detail', heading: 'PROBE c1', refreshFailed: false })
    backend.state.busy = true
    await observer.refetch()
    expect(screen()).toMatchObject({ kind: 'detail', heading: 'PROBE c1', refreshFailed: true })
    backend.state.busy = false
    await observer.refetch()
    expect(screen()).toMatchObject({ kind: 'detail', refreshFailed: false })
    unsubscribe()
  })
})
