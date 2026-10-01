import { QueryClient, QueryObserver, focusManager, onlineManager } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { JsonApiResult, RequestOptions } from '@/lib/jsonapi/client'
import type { CollectionDocument, ErrorObject } from '@/lib/jsonapi/document'
import { defineResource } from '@/lib/resources/define'
import { referenceState } from '@/lib/resources/screen-state'
import { referenceRequest } from '@/lib/resources/view'
import { queryKeys } from '@/queries/keys'
import { referenceQueryOptions } from '@/queries/resource-options'

/**
 * 관계 선택기의 참조 목록이 닿지 못했다가 돌아오는 전이 - 실제 QueryClient 로 잰다(test/unit/queries/
 * resource-options.test.ts 와 같은 길, 옵션도 앱의 것과 같다: staleTime 0, 재시도 없음, offlineFirst). 선택기가 그릴
 * 것은 `referenceState`(lib/resources/screen-state.ts)가 Query 의 결과에서 정한다 - queries/resources.ts 의
 * `useRelationshipReferences` 가 하는 것과 같은 호출이다.
 */
const PROBE_LABEL = defineResource({
  type: 'probeLabels',
  path: '/probe/api/labels',
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

const TRANSPORT: ErrorObject = {
  status: '0',
  code: 'PROBE_TRANSPORT',
  detail: 'PROBE 전송 실패',
  meta: { synthetic: true },
}

const LOADED = { options: [{ id: 'probe-l1', label: 'PROBE 라벨 하나' }], truncated: false }

/** 가짜 백엔드 - `online` 이 거짓이면 client.ts 처럼 합성 오류(transport)를 값으로 돌려준다. */
function probeBackend() {
  const state = { online: true, calls: 0, path: '', query: '' }
  const send = <T>(path: string, options?: RequestOptions): Promise<JsonApiResult<T>> => {
    state.calls += 1
    state.path = path
    state.query = options?.query?.toString() ?? ''
    if (!state.online) return Promise.resolve({ ok: false, status: 0, errors: [TRANSPORT] })
    const document: CollectionDocument = {
      data: [{ type: 'probeLabels', id: 'probe-l1', attributes: { probeName: 'PROBE 라벨 하나' } }],
      links: { next: null },
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

/** `trigger` 가 일으킨 조회의 결과(성공이든 실패든)가 캐시에 들 때까지 기다린다 - resource-options.test.ts 와 같다. */
async function nextResult(queryKey: readonly unknown[], trigger: () => void) {
  const state = () => client.getQueryCache().find({ queryKey })?.state
  const count = () => (state()?.dataUpdateCount ?? 0) + (state()?.errorUpdateCount ?? 0)
  const before = count()
  trigger()
  await vi.waitFor(() => {
    if (count() === before || state()?.fetchStatus !== 'idle') throw new Error('아직 부르는 중')
  })
}

async function referenceObserver(send: ReturnType<typeof probeBackend>['send']) {
  const options = referenceQueryOptions(PROBE_LABEL, send)
  const observer = new QueryObserver(client, options)
  let unsubscribe = () => undefined as void
  await nextResult(options.queryKey, () => {
    unsubscribe = observer.subscribe(() => undefined)
  })
  const state = () => {
    const result = observer.getCurrentResult()
    return referenceState(PROBE_LABEL, { result: result.data, error: result.error })
  }
  return { observer, key: options.queryKey, unsubscribe: () => unsubscribe(), state }
}

describe('referenceQueryOptions - 관계 선택기의 참조 목록', () => {
  it('대상 자원의 목록 키로 참조 요청(이름 순 첫 100건)을 보낸다', async () => {
    const backend = probeBackend()
    const plan = referenceRequest(PROBE_LABEL)
    const { key, unsubscribe, state } = await referenceObserver(backend.send)
    expect(key).toEqual(queryKeys.list('probeLabels', plan.query.toString()))
    expect(backend.state.path).toBe('/probe/api/labels')
    expect(backend.state.query).toBe(plan.query.toString())
    expect(state()).toEqual({ list: LOADED, failure: null })
    unsubscribe()
  })

  it('오프라인 앱 복귀의 재조회가 닿지 못해도 읽은 보기를 둔다 - 연결이 돌아오면 다시 읽는다', async () => {
    const backend = probeBackend()
    const { key, unsubscribe, state } = await referenceObserver(backend.send)

    backend.state.online = false
    onlineManager.setOnline(false)
    focusManager.setFocused(false)
    await nextResult(key, () => {
      focusManager.setFocused(true)
    })
    expect(backend.state.calls).toBe(2)
    expect(state()).toEqual({ list: LOADED, failure: null })

    backend.state.online = true
    await nextResult(key, () => {
      onlineManager.setOnline(true)
    })
    expect(backend.state.calls).toBe(3)
    expect(state()).toEqual({ list: LOADED, failure: null })
    unsubscribe()
  })

  it('첫 조회가 닿지 못하면 앱 문구와 다시 시도다 - 다시 시도가 되면 보기다', async () => {
    const backend = probeBackend()
    backend.state.online = false
    const { observer, unsubscribe, state } = await referenceObserver(backend.send)
    expect(state()).toEqual({
      list: { options: [], truncated: false },
      failure: { kind: 'unreachable' },
    })
    backend.state.online = true
    await observer.refetch()
    expect(state()).toEqual({ list: LOADED, failure: null })
    unsubscribe()
  })
})
