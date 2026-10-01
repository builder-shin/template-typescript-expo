import {
  MutationObserver,
  QueryClient,
  shouldThrowError,
  type MutationObserverOptions,
} from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { JsonApiResult, RequestOptions } from '@/lib/jsonapi/client'
import type { ErrorObject } from '@/lib/jsonapi/document'
import { defineResource } from '@/lib/resources/define'
import type { ResourceFormValues } from '@/lib/resources/form'
import { isSessionRejected } from '@/lib/resources/write'
import { mutationKeys, queryKeys } from '@/queries/keys'
import {
  createResourceMutationOptions,
  deleteResourceMutationOptions,
  resetUnlessPending,
  updateResourceMutationOptions,
} from '@/queries/writes'

/**
 * 쓰기 훅이 쓰는 옵션(queries/writes.ts) - `loginMutationOptions` 처럼 훅과 시험이 함께 쓴다. TanStack Query 의
 * MutationObserver 로 그대로 돌려 셋을 잰다: 던져진 것이 오류 경계로 가는지(`throwOnError`), 성공한 쓰기가 무효화
 * 표를 지나는지, 삭제 훅의 `reset` 이 진행 중인 삭제를 지우지 않는지(`resetUnlessPending`). 훅 자체는 시험하지 않는다
 * (스펙 11.1) - 훅은 이 옵션과 함수를 `useMutation` 에 꽂을 뿐이다.
 *
 * 세션 관리자와 API 클라이언트만 가짜다 - 쓰기 흐름(lib/resources/write.ts)과 Query 캐시는 진짜다. 훅이 쓰는 그
 * 배선(`WRITE_DEPS`)을 그대로 지나므로 토큰이 요청에 실리는지도 함께 본다. 자원은 `probe*` 다.
 */
const mocks = vi.hoisted(() => ({
  send: vi.fn<(path: string, options?: RequestOptions) => Promise<JsonApiResult<unknown>>>(),
  getAccessToken: vi.fn<() => Promise<string | null>>(),
  current: vi.fn<() => { accessExpiresAt: number } | null>(),
}))

vi.mock('@/platform/api', () => ({ apiRequest: mocks.send }))
vi.mock('@/platform/session', () => ({
  sessionManager: { getAccessToken: mocks.getAccessToken, current: mocks.current },
}))

const PROBE_CRATE = defineResource({
  type: 'probeCrates',
  path: '/probe/api/crates',
  attributes: {
    probeLabel: {
      kind: 'string',
      label: 'PROBE 라벨',
      readOnly: false,
      nullable: false,
      listed: true,
    },
  },
  relationships: {},
  filters: {},
  sorts: ['probeLabel'],
  defaultSort: 'probeLabel',
  includes: [],
  writable: true,
})

const OTHER_TYPE = 'probeBins'
const ID = 'probe-crate-1'
const VALUES: ResourceFormValues = { attributes: { probeLabel: 'probe-label' }, relationships: {} }

/** 백엔드가 낸 오류 하나 - 코드가 무엇이냐가 갈래를 정한다(lib/jsonapi/errors.ts). */
function backendError(error: Partial<ErrorObject> & { code: string }): ErrorObject {
  return { status: '400', title: 'probe-title', detail: `probe-detail-${error.code}`, ...error }
}

const SAVED: JsonApiResult<unknown> = {
  ok: true,
  status: 201,
  document: { data: { type: 'probeCrates', id: ID } },
}
const DELETED: JsonApiResult<unknown> = { ok: true, status: 204, document: null }
const VALIDATION: JsonApiResult<unknown> = {
  ok: false,
  status: 422,
  errors: [
    backendError({
      status: '422',
      code: 'VALIDATION_ERROR',
      source: { pointer: '/data/attributes/probeLabel' },
    }),
  ],
}
const CONFLICT: JsonApiResult<unknown> = {
  ok: false,
  status: 409,
  errors: [backendError({ status: '409', code: 'PROBE_CONFLICT' })],
}
const NOT_FOUND: JsonApiResult<unknown> = {
  ok: false,
  status: 404,
  errors: [backendError({ status: '404', code: 'RESOURCE_NOT_FOUND' })],
}

let client: QueryClient

beforeEach(() => {
  client = new QueryClient()
  mocks.send.mockReset()
  mocks.getAccessToken.mockReset().mockResolvedValue('probe-access')
  mocks.current.mockReset().mockReturnValue({ accessExpiresAt: Date.now() + 900_000 })
})

afterEach(() => {
  client.clear()
  vi.restoreAllMocks()
})

/** 쓰기 하나를 돌려, 상태와 오류와 "훅이 이 오류를 렌더 중에 다시 던지는가" 를 돌려준다. */
async function run<TData, TVariables>(
  options: MutationObserverOptions<TData, Error, TVariables>,
  variables: TVariables,
) {
  const observer = new MutationObserver(client, options)
  await observer.mutate(variables).catch(() => undefined)
  const { status, error, data } = observer.getCurrentResult()
  // `useMutation` 이 렌더 중에 하는 판단 그대로다 - 거짓이면 오류는 `mutate()` 가 삼키고 폼이 그대로 선다.
  const surfaced = error !== null && shouldThrowError(observer.options.throwOnError, [error])
  return { status, error, data, surfaced }
}

const WRITES = [
  {
    label: '생성',
    run: () => run(createResourceMutationOptions(client, PROBE_CRATE), VALUES),
  },
  {
    label: '수정',
    run: () => run(updateResourceMutationOptions(client, PROBE_CRATE, ID), VALUES),
  },
  {
    label: '삭제',
    run: () => run(deleteResourceMutationOptions(client, PROBE_CRATE, ID), undefined),
  },
] as const

describe('쓰기의 throwOnError - 결함만 오류 경계로 간다', () => {
  it.each(WRITES)('$label: 던져진 결함은 관찰되고 오류 경계로 간다', async ({ run: write }) => {
    mocks.send.mockRejectedValue(new Error('probe-defect'))

    const result = await write()

    expect(result.status).toBe('error')
    expect(result.error).toEqual(new Error('probe-defect'))
    expect(result.surfaced).toBe(true)
  })

  it.each(WRITES)(
    '$label: 세션 거절은 오류 경계로 가지 않는다 - 쓰기 캐시의 onError 가 받는다',
    async ({ run: write }) => {
      mocks.getAccessToken.mockResolvedValue(null)

      const result = await write()

      expect(isSessionRejected(result.error)).toBe(true)
      expect(result.surfaced).toBe(false)
      expect(mocks.send).not.toHaveBeenCalled()
    },
  )

  it.each(WRITES)(
    '$label: 기대한 실패(검증·충돌)는 값이라 오류가 아니다 - 폼이 그린다',
    async ({ label, run: write }) => {
      mocks.send.mockResolvedValue(label === '삭제' ? CONFLICT : VALIDATION)

      const result = await write()

      expect(result.status).toBe('success')
      expect(result.error).toBeNull()
      expect(result.data).toMatchObject({ kind: 'failed' })
      expect(result.surfaced).toBe(false)
    },
  )
})

describe('쓰기의 요청 - 훅이 꽂는 세션 관리자와 API 클라이언트', () => {
  it('토큰을 쓰기 요청에 싣는다', async () => {
    mocks.send.mockResolvedValue(SAVED)

    await run(createResourceMutationOptions(client, PROBE_CRATE), VALUES)

    expect(mocks.send).toHaveBeenCalledTimes(1)
    expect(mocks.send.mock.calls[0]?.[0]).toBe('/probe/api/crates')
    expect(mocks.send.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      accessToken: 'probe-access',
    })
  })
})

describe('쓰기 성공의 캐시 - 무효화 표를 지난다(스펙 8.5)', () => {
  function seed(): void {
    client.setQueryData(queryKeys.list(PROBE_CRATE.type, 'probe=a'), 'probe-list-a')
    client.setQueryData(queryKeys.list(PROBE_CRATE.type, 'probe=b'), 'probe-list-b')
    client.setQueryData(queryKeys.list(OTHER_TYPE, 'probe=a'), 'probe-other-list')
    client.setQueryData(queryKeys.detail(PROBE_CRATE.type, ID), 'probe-detail')
    client.setQueryData(queryKeys.detail(PROBE_CRATE.type, 'probe-crate-2'), 'probe-detail-2')
  }

  function invalidated(queryKey: readonly string[]): boolean | undefined {
    return client.getQueryCache().find({ queryKey, exact: true })?.state.isInvalidated
  }

  function untouched(): void {
    expect(invalidated(queryKeys.list(PROBE_CRATE.type, 'probe=a'))).toBe(false)
    expect(invalidated(queryKeys.list(PROBE_CRATE.type, 'probe=b'))).toBe(false)
    expect(invalidated(queryKeys.detail(PROBE_CRATE.type, ID))).toBe(false)
  }

  it('생성이 저장되면 그 자원의 목록만 무효화한다', async () => {
    seed()
    mocks.send.mockResolvedValue(SAVED)
    await run(createResourceMutationOptions(client, PROBE_CRATE), VALUES)

    expect(invalidated(queryKeys.list(PROBE_CRATE.type, 'probe=a'))).toBe(true)
    expect(invalidated(queryKeys.list(PROBE_CRATE.type, 'probe=b'))).toBe(true)
    expect(invalidated(queryKeys.list(OTHER_TYPE, 'probe=a'))).toBe(false)
    expect(invalidated(queryKeys.detail(PROBE_CRATE.type, ID))).toBe(false)
  })

  it('수정이 저장되면 그 상세와 목록을 무효화하고 다른 id 의 상세는 두고', async () => {
    seed()
    mocks.send.mockResolvedValue(SAVED)
    await run(updateResourceMutationOptions(client, PROBE_CRATE, ID), VALUES)

    expect(invalidated(queryKeys.detail(PROBE_CRATE.type, ID))).toBe(true)
    expect(invalidated(queryKeys.list(PROBE_CRATE.type, 'probe=a'))).toBe(true)
    expect(invalidated(queryKeys.detail(PROBE_CRATE.type, 'probe-crate-2'))).toBe(false)
  })

  it('수정이 "그 자원이 없다" 를 받아도 같은 둘을 무효화한다 - 밑의 화면이 없어진 자원을 계속 그리지 않게', async () => {
    seed()
    mocks.send.mockResolvedValue(NOT_FOUND)
    const result = await run(updateResourceMutationOptions(client, PROBE_CRATE, ID), VALUES)

    expect(result.data).toEqual({ kind: 'notFound' })
    expect(invalidated(queryKeys.detail(PROBE_CRATE.type, ID))).toBe(true)
    expect(invalidated(queryKeys.list(PROBE_CRATE.type, 'probe=a'))).toBe(true)
  })

  it('삭제하면 그 상세를 캐시에서 지우고 목록을 무효화한다', async () => {
    seed()
    mocks.send.mockResolvedValue(DELETED)
    await run(deleteResourceMutationOptions(client, PROBE_CRATE, ID), undefined)

    expect(client.getQueryData(queryKeys.detail(PROBE_CRATE.type, ID))).toBeUndefined()
    expect(client.getQueryData(queryKeys.detail(PROBE_CRATE.type, 'probe-crate-2'))).toBe(
      'probe-detail-2',
    )
    expect(invalidated(queryKeys.list(PROBE_CRATE.type, 'probe=a'))).toBe(true)
  })

  it('이미 없는 자원의 삭제도 지운 것이다 - 같은 효과를 낸다', async () => {
    seed()
    mocks.send.mockResolvedValue(NOT_FOUND)
    const result = await run(deleteResourceMutationOptions(client, PROBE_CRATE, ID), undefined)

    expect(result.data).toEqual({ kind: 'deleted' })
    expect(client.getQueryData(queryKeys.detail(PROBE_CRATE.type, ID))).toBeUndefined()
    expect(invalidated(queryKeys.list(PROBE_CRATE.type, 'probe=a'))).toBe(true)
  })

  it.each([
    ['생성', () => run(createResourceMutationOptions(client, PROBE_CRATE), VALUES), VALIDATION],
    ['수정', () => run(updateResourceMutationOptions(client, PROBE_CRATE, ID), VALUES), VALIDATION],
    [
      '삭제',
      () => run(deleteResourceMutationOptions(client, PROBE_CRATE, ID), undefined),
      CONFLICT,
    ],
  ] as const)('%s 가 실패하면 캐시를 건드리지 않는다', async (_label, write, failure) => {
    seed()
    mocks.send.mockResolvedValue(failure)
    await write()

    untouched()
    expect(client.getQueryData(queryKeys.detail(PROBE_CRATE.type, ID))).toBe('probe-detail')
  })
})

/** 밖에서 끝내는 Promise - 요청이 "진행 중" 인 동안을 붙들어 둔다. */
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve: (value: T) => void = () => undefined
  const promise = new Promise<T>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

/** 대기 중인 Promise 연쇄가 한 바퀴 돌게 한다. */
function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

describe('삭제의 reset - 진행 중인 삭제는 지우지 않는다(resetUnlessPending)', () => {
  /**
   * 삭제 하나를 보낸 채 붙들어 둔다. `useDeleteResource` 가 하는 대로 관찰자를 구독하고(`mutate()` 에 넘긴 콜백은 구독자가
   * 있어야 불린다) 성공 콜백을 건다. 요청이 나간 뒤에 돌려주므로 그 삭제는 쓰기 캐시에서 진행 중이다.
   */
  async function startDelete() {
    const options = deleteResourceMutationOptions(client, PROBE_CRATE, ID)
    const observer = new MutationObserver(client, options)
    const unsubscribe = observer.subscribe(() => undefined)
    const response = deferred<JsonApiResult<unknown>>()
    mocks.send.mockReturnValue(response.promise)
    const onDeleted = vi.fn()
    const done = observer.mutate(undefined, { onSuccess: onDeleted })
    await settle()
    expect(mocks.send).toHaveBeenCalledTimes(1)
    expect(client.isMutating({ mutationKey: options.mutationKey })).toBe(1)
    return { options, observer, unsubscribe, response, onDeleted, done }
  }

  it('전제: 진행 중인 삭제를 그대로 reset 하면 관찰자가 떨어져 성공 콜백은 불리지 않고 옵션의 onSuccess 만 돈다', async () => {
    client.setQueryData(queryKeys.detail(PROBE_CRATE.type, ID), 'probe-detail')
    const { observer, unsubscribe, response, onDeleted, done } = await startDelete()

    observer.reset()
    response.resolve(DELETED)
    await done

    // 화면은 목록으로 돌아가지 못한 채 남고(`deleted` 는 거짓) 상세만 캐시에서 지워졌다 - 다음 렌더가 그 상세를 다시 부른다.
    expect(onDeleted).not.toHaveBeenCalled()
    expect(observer.getCurrentResult().status).toBe('idle')
    expect(client.getQueryData(queryKeys.detail(PROBE_CRATE.type, ID))).toBeUndefined()
    unsubscribe()
  })

  it('진행 중인 삭제는 reset 이 아무것도 하지 않는다 - 끝나면 mutate() 에 넘긴 성공 콜백이 불린다', async () => {
    client.setQueryData(queryKeys.detail(PROBE_CRATE.type, ID), 'probe-detail')
    const { options, observer, unsubscribe, response, onDeleted, done } = await startDelete()

    resetUnlessPending(client, options.mutationKey, () => {
      observer.reset()
    })
    expect(observer.getCurrentResult().isPending).toBe(true)

    response.resolve(DELETED)
    await done

    expect(onDeleted).toHaveBeenCalledTimes(1)
    expect(observer.getCurrentResult()).toMatchObject({
      status: 'success',
      data: { kind: 'deleted' },
    })
    expect(client.getQueryData(queryKeys.detail(PROBE_CRATE.type, ID))).toBeUndefined()
    unsubscribe()
  })

  it('끝난 삭제는 reset 이 지운다 - 실패한 확인을 취소하면 지난 문구가 사라진다', async () => {
    mocks.send.mockResolvedValue(CONFLICT)
    const options = deleteResourceMutationOptions(client, PROBE_CRATE, ID)
    const observer = new MutationObserver(client, options)
    await observer.mutate(undefined)
    expect(observer.getCurrentResult().data).toMatchObject({ kind: 'failed' })

    resetUnlessPending(client, options.mutationKey, () => {
      observer.reset()
    })

    expect(observer.getCurrentResult()).toMatchObject({ status: 'idle', data: undefined })
  })

  it.each([
    ['다른 id 의 삭제', mutationKeys.delete(PROBE_CRATE.type, 'probe-crate-10')],
    ['같은 자원의 생성', mutationKeys.create(PROBE_CRATE.type)],
  ] as const)('%s 가 진행 중이어도 막지 않는다 - 이 삭제의 키만 본다', async (_label, otherKey) => {
    const gate = deferred<undefined>()
    const other = new MutationObserver(client, {
      mutationKey: otherKey,
      mutationFn: () => gate.promise,
    })
    const otherRun = other.mutate(undefined)
    expect(client.isMutating({ mutationKey: otherKey })).toBe(1)
    mocks.send.mockResolvedValue(CONFLICT)
    const options = deleteResourceMutationOptions(client, PROBE_CRATE, ID)
    const observer = new MutationObserver(client, options)
    await observer.mutate(undefined)

    resetUnlessPending(client, options.mutationKey, () => {
      observer.reset()
    })

    expect(observer.getCurrentResult().status).toBe('idle')
    gate.resolve(undefined)
    await otherRun
  })
})
