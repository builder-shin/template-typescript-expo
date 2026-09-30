import {
  InfiniteQueryObserver,
  QueryClient,
  QueryObserver,
  focusManager,
  onlineManager,
} from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { JsonApiResult, RequestOptions } from '@/lib/jsonapi/client'
import type { CollectionDocument, ErrorObject, SingleDocument } from '@/lib/jsonapi/document'
import { defineResource } from '@/lib/resources/define'
import { detailScreen, listScreen } from '@/lib/resources/screen-state'
import { listRequest } from '@/lib/resources/view'
import { detailQueryOptions, listQueryOptions } from '@/queries/resource-options'

/**
 * 조회가 닿지 못했다가 돌아오는 전이 - 실제 QueryClient 로 잰다(D3 최종 검토 I1 의 탐침과 같은 길).
 * 옵션은 앱의 것과 같다(platform/query-client.ts: staleTime 0, 재시도 없음, offlineFirst). 앱 복귀는
 * focusManager, 네트워크 복귀는 onlineManager 로 일으킨다 - 앱에서는 AppState·NetInfo 가 부른다.
 *
 * 화면은 `listScreen`·`detailScreen`(lib/resources/screen-state.ts)이 Query 의 결과에서 정한다 -
 * queries/resources.ts 의 훅이 하는 것과 같은 호출이다.
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

const TRANSPORT: ErrorObject = {
  status: '0',
  code: 'PROBE_TRANSPORT',
  detail: 'PROBE 전송 실패',
  meta: { synthetic: true },
}

/** 세 쪽, 쪽마다 두 행. 커서는 `page[after]` 값이다 - 첫 쪽은 빈 커서. */
const PAGES: Record<string, { ids: string[]; next: string | null }> = {
  '': { ids: ['a1', 'a2'], next: 'probe-c2' },
  'probe-c2': { ids: ['b1', 'b2'], next: 'probe-c3' },
  'probe-c3': { ids: ['c1', 'c2'], next: null },
}

/** 가짜 백엔드 - `online` 이 거짓이면 client.ts 처럼 합성 오류(transport)를 값으로 돌려준다. */
function probeBackend() {
  const state = { online: true, calls: 0 }
  const send = <T>(path: string, options?: RequestOptions): Promise<JsonApiResult<T>> => {
    state.calls += 1
    if (!state.online) return Promise.resolve({ ok: false, status: 0, errors: [TRANSPORT] })
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
  // 전역이다 - 다음 시험에 남기지 않는다.
  onlineManager.setOnline(true)
  focusManager.setFocused(undefined)
})

/**
 * `trigger` 가 일으킨 조회의 결과(성공이든 실패든)가 캐시에 들 때까지 기다린다. 앱 복귀·네트워크 복귀의 재조회는
 * 기다릴 Promise 를 주지 않고 한 박자 늦게 시작한다(QueryClient 의 구독이 비동기다) - "지금 부르는 중이 아니다" 만
 * 보면 재조회가 시작하기도 전의 화면을 잰다. 그래서 조회 상태의 성공·실패 횟수가 늘기를 기다린다.
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
  return { observer, key: options.queryKey, unsubscribe: () => unsubscribe(), screen }
}

function rowIds(screen: ReturnType<typeof listScreen>) {
  if (screen.kind !== 'list') throw new Error(`목록이어야 한다 - ${screen.kind}`)
  return screen.rows.map((row) => row.id)
}

describe('목록 - 재조회가 닿지 못해도 읽은 행을 버리지 않는다', () => {
  it('세 쪽을 읽은 뒤 오프라인 앱 복귀 → 행 여섯과 작은 실패, 연결 복귀 → 세 쪽을 다시 읽는다', async () => {
    const backend = probeBackend()
    const { observer, key, unsubscribe, screen } = await listObserver(backend.send)
    await observer.fetchNextPage()
    await observer.fetchNextPage()
    expect(rowIds(screen())).toEqual(['a1', 'a2', 'b1', 'b2', 'c1', 'c2'])
    expect(backend.state.calls).toBe(3)

    // 오프라인에서 앱이 앞으로 나온다 - offlineFirst 라 한 번은 부르고, 닿지 못한다.
    backend.state.online = false
    onlineManager.setOnline(false)
    focusManager.setFocused(false)
    await nextResult(key, () => {
      focusManager.setFocused(true)
    })
    expect(backend.state.calls).toBe(4)
    const offline = screen()
    expect(rowIds(offline)).toEqual(['a1', 'a2', 'b1', 'b2', 'c1', 'c2'])
    expect(offline).toMatchObject({ refreshFailed: true, failure: null })

    // 연결이 돌아오면 다시 부른다 - 읽어 둔 세 쪽을 모두 읽는다(첫 쪽 하나로 줄지 않는다).
    backend.state.online = true
    await nextResult(key, () => {
      onlineManager.setOnline(true)
    })
    expect(backend.state.calls).toBe(7)
    const back = screen()
    expect(rowIds(back)).toEqual(['a1', 'a2', 'b1', 'b2', 'c1', 'c2'])
    expect(back).toMatchObject({ refreshFailed: false, failure: null })
    unsubscribe()
  })

  it('당겨서 새로고침(refetch)이 닿지 못해도 행을 두고, 다시 시도(refetch)가 되면 작은 실패가 사라진다', async () => {
    const backend = probeBackend()
    const { observer, unsubscribe, screen } = await listObserver(backend.send)
    backend.state.online = false
    await observer.refetch()
    expect(rowIds(screen())).toEqual(['a1', 'a2'])
    expect(screen()).toMatchObject({ kind: 'list', refreshFailed: true, failure: null })
    backend.state.online = true
    await observer.refetch()
    expect(screen()).toMatchObject({ kind: 'list', refreshFailed: false, failure: null })
    unsubscribe()
  })

  it('첫 조회가 닿지 못하면 실패가 화면 전부다 - 다시 시도가 되면 목록이다', async () => {
    const backend = probeBackend()
    backend.state.online = false
    const { observer, unsubscribe, screen } = await listObserver(backend.send)
    expect(screen()).toEqual({ kind: 'unreachable' })
    backend.state.online = true
    await observer.refetch()
    expect(rowIds(screen())).toEqual(['a1', 'a2'])
    unsubscribe()
  })

  it('다음 쪽이 닿지 못하면 읽은 행은 두고 끝에 실패 - 그 쪽만 다시 읽으면 이어진다', async () => {
    const backend = probeBackend()
    const { observer, unsubscribe, screen } = await listObserver(backend.send)
    backend.state.online = false
    await observer.fetchNextPage()
    expect(rowIds(screen())).toEqual(['a1', 'a2'])
    expect(screen()).toMatchObject({ refreshFailed: false, failure: { kind: 'unreachable' } })
    expect(observer.getCurrentResult().hasNextPage).toBe(true)
    backend.state.online = true
    await observer.fetchNextPage()
    expect(rowIds(screen())).toEqual(['a1', 'a2', 'b1', 'b2'])
    expect(screen()).toMatchObject({ refreshFailed: false, failure: null })
    unsubscribe()
  })
})

describe('상세 - 다시 들어온 상세의 재조회가 닿지 못해도 읽은 상세를 둔다', () => {
  async function detailObserver(send: ReturnType<typeof probeBackend>['send']) {
    const options = detailQueryOptions(resource, 'c1', send)
    const observer = new QueryObserver(client, options)
    let unsubscribe = () => undefined as void
    await nextResult(options.queryKey, () => {
      unsubscribe = observer.subscribe(() => undefined)
    })
    const screen = () => {
      const result = observer.getCurrentResult()
      return detailScreen(resource, { result: result.data, error: result.error })
    }
    return { observer, unsubscribe: () => unsubscribe(), screen }
  }

  it('읽은 상세 → 재조회 실패: 상세와 작은 실패 → 다시 시도: 작은 실패가 사라진다', async () => {
    const backend = probeBackend()
    const { observer, unsubscribe, screen } = await detailObserver(backend.send)
    expect(screen()).toMatchObject({ kind: 'detail', heading: 'PROBE c1', refreshFailed: false })
    backend.state.online = false
    await observer.refetch()
    expect(screen()).toMatchObject({ kind: 'detail', heading: 'PROBE c1', refreshFailed: true })
    backend.state.online = true
    await observer.refetch()
    expect(screen()).toMatchObject({ kind: 'detail', refreshFailed: false })
    unsubscribe()
  })

  it('첫 조회가 닿지 못하면 실패가 화면 전부다', async () => {
    const backend = probeBackend()
    backend.state.online = false
    const { unsubscribe, screen } = await detailObserver(backend.send)
    expect(screen()).toEqual({ kind: 'unreachable' })
    unsubscribe()
  })
})
