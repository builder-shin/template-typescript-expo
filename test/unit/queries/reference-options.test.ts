import {
  QueriesObserver,
  QueryClient,
  QueryObserver,
  focusManager,
  onlineManager,
  replaceEqualDeep,
  type QueryObserverOptions,
  type QueryObserverResult,
} from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { JsonApiResult, RequestOptions } from '@/lib/jsonapi/client'
import type { CollectionDocument, ErrorObject } from '@/lib/jsonapi/document'
import type { JsonApiSend } from '@/lib/jsonapi/send'
import { EXAMPLE_CATEGORY, EXAMPLE_TAG } from '@/lib/resources'
import { defineResource } from '@/lib/resources/define'
import { referenceState } from '@/lib/resources/screen-state'
import { referenceRequest } from '@/lib/resources/view'
import { queryKeys } from '@/queries/keys'
import {
  combineReferences,
  referencePlan,
  referenceQueryOptions,
  referencesOf,
  type ReferencePlan,
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

function collection(
  type: string,
  name: string,
  id = `probe-${type}-1`,
): JsonApiResult<CollectionDocument> {
  return {
    ok: true,
    status: 200,
    document: { data: [{ type, id, attributes: { name } }], links: { next: null } },
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

    const references = referencesOf(combineReferences(ticketPlan(), [tags, categories]))

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
    const references = referencesOf(
      combineReferences(ticketPlan(), [settled(undefined, true), settled(undefined, true)]),
    )

    expect(references.probeBin).toMatchObject({ list: null, failure: null, retrying: true })
  })

  it('다시 읽는 중으로 바뀌어도 보기는 구조 공유로 같은 객체다 - TanStack Query 의 combine 이 결과를 이어 붙인다', () => {
    const plan = ticketPlan()
    const before = combineReferences(plan, [settled(TAGS), settled(CATEGORIES)])
    // 같은 데이터를 다시 읽는 중이다 - 바뀐 것은 retrying 뿐이다.
    const after = combineReferences(plan, [settled(TAGS, true), settled(CATEGORIES)])

    const shared = referencesOf(replaceEqualDeep(before, after))
    const original = referencesOf(before)

    expect(shared.probeFirstTags?.retrying).toBe(true)
    expect(shared.probeFirstTags?.list).toBe(original.probeFirstTags?.list)
    expect(shared.probeBin?.list).toBe(original.probeBin?.list)
    expect(shared.probeSecondTags?.list).toBe(original.probeSecondTags?.list)
  })

  it('referenceState 가 던지는 거절은 던지지 않고 결함 값으로 돌려준다 - 훅이 렌더 중에 꺼내 던진다', () => {
    const rejected: JsonApiResult<CollectionDocument> = { ok: false, status: 422, errors: [] }

    const combined = combineReferences(ticketPlan(), [settled(TAGS), settled(rejected)])

    expect(combined.kind).toBe('defect')
    expect(() => referencesOf(combined)).toThrow('참조 목록 요청이 문구 없는 오류로 실패했다')
  })

  it('정상이면 referencesOf 는 던지지 않고 선택기가 그릴 것을 준다', () => {
    const combined = combineReferences(ticketPlan(), [settled(TAGS), settled(CATEGORIES)])

    expect(combined.kind).toBe('references')
    expect(Object.keys(referencesOf(combined))).toEqual([
      'probeFirstTags',
      'probeBin',
      'probeSecondTags',
    ])
  })
})

/*
 * `combine` 은 렌더 밖에서도 돈다 - QueriesObserver 가 조회 응답이 도착할 때(`#notify`)와 재조회가 시작될 때 부른다. 거기서 던져진
 * 것은 삼켜진다: 렌더는 오래된 결과를 받고(받기 전 모양에 멈춘다), 던진 채로는 같은 관찰자의 다른 조회가 요청을 보내지도
 * 못한다. 그래서 `combineReferences` 는 던지지 않고 결함을 값으로 돌려주며, 훅이 렌더 중에 꺼내 던진다(`referencesOf`).
 * 아래는 설치본 QueriesObserver 에 `useQueries` 가 하는 순서 그대로 렌더와 커밋을 돌려 그것을 잰다.
 */

const TAGS_KEY = queryKeys.list('exampleTags', referenceRequest(EXAMPLE_TAG).query.toString())
const CATEGORIES_KEY = queryKeys.list(
  'exampleCategories',
  referenceRequest(EXAMPLE_CATEGORY).query.toString(),
)

/**
 * 경로로 가르는 가짜 백엔드 - 태그는 부를 때마다 다른 태그를 줘서(재조회가 합성 결과에 닿았는지 본다) 분류의 응답만
 * `categories` 로 바꿀 수 있다. 기본은 둘 다 정상이다.
 */
function pathBackend() {
  const state = {
    tagCalls: 0,
    categories: (): Promise<JsonApiResult<CollectionDocument>> => Promise.resolve(CATEGORIES),
  }
  const send = <T>(path: string): Promise<JsonApiResult<T>> => {
    if (path === EXAMPLE_TAG.path) {
      state.tagCalls += 1
      const tag = collection(
        'exampleTags',
        `PROBE 태그 ${state.tagCalls}`,
        `probe-tag-${state.tagCalls}`,
      )
      return Promise.resolve(tag as JsonApiResult<T>)
    }
    return state.categories() as Promise<JsonApiResult<T>>
  }
  return { state, send }
}

/**
 * `useQueries`(설치본 react-query 의 useQueries.js)가 QueriesObserver 에 하는 일을 렌더러 없이 그대로 한다 - 조회 옵션을 기본값과 함께
 * 채워(`_optimisticResults`) 관찰자를 만들고, 렌더마다 `getOptimisticResult` 로 합성한 값을 읽고, 커밋에서 구독한 뒤
 * `setQueries` 를 부른다. `combine` 은 훅이 `useCallback` 으로 고정하듯 한 함수를 렌더마다 넘긴다.
 */
function mountReferences(send: JsonApiSend) {
  const plan = referencePlan(PROBE_TICKET, send)
  // `setQueries`·`getOptimisticResult` 는 제네릭 기본값의 옵션만 받는다 - 어댑터가 내부에서 단언으로 넘기는 경계다.
  const defaulted = plan.queries.map((query) => {
    const options = client.defaultQueryOptions(query)
    options._optimisticResults = 'optimistic'
    return options as unknown as QueryObserverOptions
  })
  const combine = (results: readonly QueryObserverResult[]) =>
    combineReferences(plan, results as readonly ReferenceQueryResult[])
  const options = { combine }
  const observer = new QueriesObserver(client, defaulted, options)
  const render = () => {
    const [, getCombined, track] = observer.getOptimisticResult(defaulted, combine)
    return getCombined(track())
  }
  const commit = () => {
    const unsubscribe = observer.subscribe(() => undefined)
    observer.setQueries(defaulted, options)
    return unsubscribe
  }
  return { plan, render, commit }
}

/** 참조 조회들이 모두 끝날 때까지(성공이든 오류든) 기다린다. */
async function settleAll(plan: ReferencePlan) {
  await vi.waitFor(() => {
    for (const { queryKey } of plan.queries) {
      const state = client.getQueryState(queryKey)
      if (state === undefined || state.status === 'pending' || state.fetchStatus !== 'idle') {
        throw new Error('아직 부르는 중')
      }
    }
  })
}

describe('combine 은 던지지 않는다 - 실제 QueriesObserver 로 렌더와 커밋을 돌린다', () => {
  it('대조군: 정상이면 렌더 사이에 같은 객체이고 한 목록의 재조회가 선택기 옵션에 닿는다', async () => {
    const backend = pathBackend()
    const { plan, render, commit } = mountReferences(backend.send)

    expect(referencesOf(render()).probeFirstTags).toMatchObject({ list: null, failure: null })
    const unsubscribe = commit()
    await settleAll(plan)

    const loaded = render()
    expect(render()).toBe(loaded)
    expect(referencesOf(loaded).probeFirstTags?.list?.options.map(({ id }) => id)).toEqual([
      'probe-tag-1',
    ])

    await client.refetchQueries({ queryKey: TAGS_KEY, exact: true })

    expect(backend.state.tagCalls).toBe(2)
    expect(client.getQueryState(TAGS_KEY)?.fetchStatus).toBe('idle')
    expect(referencesOf(render()).probeFirstTags?.list?.options.map(({ id }) => id)).toEqual([
      'probe-tag-2',
    ])
    unsubscribe()
  })

  it.each([
    {
      label: '문구 없는 거절(계약 위반)',
      reject: (): Promise<JsonApiResult<CollectionDocument>> =>
        Promise.resolve({ ok: false, status: 422, errors: [] }),
      message: '참조 목록 요청이 문구 없는 오류로 실패했다',
    },
    {
      label: '조회 함수의 결함',
      reject: (): Promise<JsonApiResult<CollectionDocument>> =>
        Promise.reject(new Error('probe-defect')),
      message: 'probe-defect',
    },
  ])(
    '$label 은 결함 값이다 - 삼켜지지 않고 형제의 재조회를 막지 않으며 결함이 가시면 풀린다',
    async ({ reject, message }) => {
      const backend = pathBackend()
      backend.state.categories = reject
      const { plan, render, commit } = mountReferences(backend.send)
      render()
      const unsubscribe = commit()
      await settleAll(plan)

      // 결함은 값이다. 다음 렌더가 그것을 읽는다 - 받기 전 모양에 멈추지도, 비어 있지도 않다.
      const combined = render()
      expect(combined.kind).toBe('defect')
      expect(() => referencesOf(combined)).toThrow(message)
      expect(render()).toBe(combined)

      // 형제: 정상인 태그를 다시 읽으면 요청이 나가고 끝난다 - 던졌다면 요청이 나가지 못하고 'fetching' 에 걸린다.
      await client.refetchQueries({ queryKey: TAGS_KEY, exact: true })
      expect(backend.state.tagCalls).toBe(2)
      expect(client.getQueryState(TAGS_KEY)?.fetchStatus).toBe('idle')
      expect(render().kind).toBe('defect')

      // 끈적하지 않다: 분류가 정상으로 돌아오면 합성 결과는 다시 참조 목록이다.
      backend.state.categories = () => Promise.resolve(CATEGORIES)
      await client.refetchQueries({ queryKey: CATEGORIES_KEY, exact: true })
      expect(referencesOf(render()).probeBin?.list?.options).toHaveLength(1)
      unsubscribe()
    },
  )
})
