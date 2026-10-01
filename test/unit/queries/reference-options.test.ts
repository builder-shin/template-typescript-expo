import {
  QueriesObserver,
  QueryClient,
  QueryObserver,
  focusManager,
  onlineManager,
  replaceEqualDeep,
} from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { JsonApiResult, RequestOptions } from '@/lib/jsonapi/client'
import type { CollectionDocument, ErrorObject } from '@/lib/jsonapi/document'
import { EXAMPLE_CATEGORY, EXAMPLE_TAG } from '@/lib/resources'
import { defineResource } from '@/lib/resources/define'
import { referenceState } from '@/lib/resources/screen-state'
import { referenceRequest } from '@/lib/resources/view'
import { queryKeys } from '@/queries/keys'
import {
  combineReferences,
  referencePlan,
  referenceQueryOptions,
  type ReferenceQueryResult,
} from '@/queries/resource-options'

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
  vi.restoreAllMocks()
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

/*
 * 폼의 관계 선택기들이 읽을 참조 조회들 - queries/resources.ts 의 `useRelationshipReferences` 가 `useQueries` 에 넣는
 * 계획(`referencePlan`)과 결과를 관계마다 잇는 `combine`(`combineReferences`)이다. 훅은 이 둘을 `useMemo`·`useCallback` 으로
 * 고정해 넘길 뿐이다 - 훅 자체는 시험하지 않는다(스펙 11.1).
 */

/** 같은 자원(태그)을 가리키는 관계가 둘인 자원 - 대상은 등록부의 것이다(`relationshipTargets`). */
const PROBE_TICKET = defineResource({
  type: 'probeTickets',
  path: '/probe/api/tickets',
  attributes: {
    probeSubject: {
      kind: 'string',
      label: 'PROBE 제목',
      readOnly: false,
      nullable: false,
      listed: true,
    },
  },
  relationships: {
    probeFirstTags: { cardinality: 'many', type: 'exampleTags', label: 'PROBE 첫 태그' },
    probeBin: { cardinality: 'one', type: 'exampleCategories', label: 'PROBE 분류' },
    probeSecondTags: { cardinality: 'many', type: 'exampleTags', label: 'PROBE 둘째 태그' },
  },
  filters: {},
  sorts: ['probeSubject'],
  defaultSort: 'probeSubject',
  includes: [],
  writable: true,
})

function collection(type: string, name: string): JsonApiResult<CollectionDocument> {
  return {
    ok: true,
    status: 200,
    document: {
      data: [{ type, id: `probe-${type}-1`, attributes: { name } }],
      links: { next: null },
    },
  }
}

const TAGS = collection('exampleTags', 'PROBE 태그 하나')
const CATEGORIES = collection('exampleCategories', 'PROBE 분류 하나')

/** `useQueries` 가 조회마다 주는 결과 가운데 선택기가 읽는 것 - 다 읽은 조회. */
function settled(data: JsonApiResult<CollectionDocument> | undefined, isFetching = false) {
  return {
    data,
    error: null,
    isFetching,
    refetch: vi.fn(() => Promise.resolve()),
  } satisfies ReferenceQueryResult
}

describe('referencePlan - 폼의 관계 선택기들이 읽을 참조 조회', () => {
  it('관계마다 대상의 참조 조회를 선언의 순서대로 잇고, 같은 자원을 가리키는 관계들은 조회 하나를 나눈다', () => {
    const plan = referencePlan(PROBE_TICKET, probeBackend().send)

    expect(plan.queries.map((query) => query.queryKey)).toEqual([
      queryKeys.list('exampleTags', referenceRequest(EXAMPLE_TAG).query.toString()),
      queryKeys.list('exampleCategories', referenceRequest(EXAMPLE_CATEGORY).query.toString()),
    ])
    expect(plan.slots.map(({ name, target, index }) => [name, target, index])).toEqual([
      ['probeFirstTags', EXAMPLE_TAG, 0],
      ['probeBin', EXAMPLE_CATEGORY, 1],
      ['probeSecondTags', EXAMPLE_TAG, 0],
    ])
  })

  it('QueriesObserver 가 경고하지 않는다 - 같은 키를 두 번 넣으면 경고하고 한 조회의 데이터를 나눠 갖는다', () => {
    const warned = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const plan = referencePlan(PROBE_TICKET, probeBackend().send)
    const defaulted = plan.queries.map((query) => client.defaultQueryOptions(query))

    // 대조: 같은 키를 두 번 넣으면 경고가 난다 - 아래 단언이 아무것도 재지 못하는 시험이 아님을 보인다.
    const duplicated = defaulted[0] === undefined ? [] : [...defaulted, defaulted[0]]
    new QueriesObserver(client, duplicated).destroy()
    expect(warned).toHaveBeenCalledTimes(1)

    warned.mockClear()
    new QueriesObserver(client, defaulted).destroy()
    expect(warned).not.toHaveBeenCalled()
  })

  it('관계가 없는 자원은 조회가 없다', () => {
    const plan = referencePlan(EXAMPLE_TAG, probeBackend().send)

    expect(plan.queries).toEqual([])
    expect(plan.slots).toEqual([])
  })
})

describe('combineReferences - 조회 결과를 관계마다 선택기가 그릴 것으로', () => {
  const ticketPlan = () => referencePlan(PROBE_TICKET, probeBackend().send)

  it('관계마다 referenceState 에 다시 부르는 길과 쓰기 가능 여부를 더한다 - 같은 조회를 가리키는 관계들은 같은 결과를 본다', () => {
    const tags = settled(TAGS)
    const categories = settled(CATEGORIES)

    const references = combineReferences(ticketPlan(), [tags, categories])

    expect(Object.keys(references)).toEqual(['probeFirstTags', 'probeBin', 'probeSecondTags'])
    expect(references.probeFirstTags).toMatchObject({
      ...referenceState(EXAMPLE_TAG, { result: TAGS, error: null }),
      retrying: false,
      writable: EXAMPLE_TAG.writable,
    })
    expect(references.probeBin).toMatchObject({
      ...referenceState(EXAMPLE_CATEGORY, { result: CATEGORIES, error: null }),
      retrying: false,
      writable: EXAMPLE_CATEGORY.writable,
    })
    expect(references.probeSecondTags?.list).toEqual(references.probeFirstTags?.list)

    // 다시 시도는 그 관계의 조회를 다시 부른다 - 같은 조회를 나누는 관계는 같은 조회를 부른다.
    references.probeSecondTags?.retry()
    expect(tags.refetch).toHaveBeenCalledTimes(1)
    expect(categories.refetch).not.toHaveBeenCalled()
    references.probeBin?.retry()
    expect(categories.refetch).toHaveBeenCalledTimes(1)
    expect(tags.refetch).toHaveBeenCalledTimes(1)
  })

  it('받기 전이면 목록이 없고 읽는 중이다', () => {
    const references = combineReferences(ticketPlan(), [
      settled(undefined, true),
      settled(undefined, true),
    ])

    expect(references.probeBin).toMatchObject({ list: null, failure: null, retrying: true })
  })

  it('다시 읽는 중으로 바뀌어도 보기는 구조 공유로 같은 객체다 - TanStack Query 의 combine 이 결과를 이어 붙인다', () => {
    const plan = ticketPlan()
    const before = combineReferences(plan, [settled(TAGS), settled(CATEGORIES)])
    // 같은 데이터를 다시 읽는 중이다 - 바뀐 것은 retrying 뿐이다.
    const after = combineReferences(plan, [settled(TAGS, true), settled(CATEGORIES)])

    const shared = replaceEqualDeep(before, after)

    expect(shared.probeFirstTags?.retrying).toBe(true)
    expect(shared.probeFirstTags?.list).toBe(before.probeFirstTags?.list)
    expect(shared.probeBin?.list).toBe(before.probeBin?.list)
    expect(shared.probeSecondTags?.list).toBe(before.probeSecondTags?.list)
  })
})
