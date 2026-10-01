import { describe, expect, it } from 'vitest'

import type { JsonApiResult } from '@/lib/jsonapi/client'
import type { CollectionDocument, ErrorObject, SingleDocument } from '@/lib/jsonapi/document'
import { defineResource } from '@/lib/resources/define'
import {
  UnreachableError,
  canLoadMore,
  detailScreen,
  listScreen,
  referenceState,
  throwIfUnreachable,
} from '@/lib/resources/screen-state'
import { listRequest } from '@/lib/resources/view'

/**
 * 판정하지 않은 응답(5xx·408·429)도 닿지 못함처럼 읽은 데이터를 두는가 - D3 재검토가 넘긴 것(목록의 재조회가
 * 백엔드 오류 문서를 받으면 읽은 쪽이 오류 한 쪽으로 바뀌고 다음 재조회는 한 쪽만 읽었다). 판정한 오류(그 밖의
 * 4xx)는 값이라 새 답이다. 실제 QueryClient 의 전이는 test/unit/queries/refetch-unjudged.test.ts 가 잰다.
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
const PLAN = listRequest(PROBE_CRATE, {})

const BUSY: ErrorObject = { status: '503', code: 'PROBE_BUSY', detail: 'PROBE 잠시 뒤에' }

function failed<T>(errors: ErrorObject[], status: number): JsonApiResult<T> {
  return { ok: false, status, errors }
}

function okPage(ids: readonly string[]): JsonApiResult<CollectionDocument> {
  return {
    ok: true,
    status: 200,
    document: {
      data: ids.map((id) => ({
        type: 'probeCrates',
        id,
        attributes: { probeName: `PROBE ${id}` },
      })),
    },
  }
}

/** 조회의 `queryFn` 이 던졌을 오류 - `throwIfUnreachable` 이 만든 그대로다. */
function thrownBy<T>(result: JsonApiResult<T>, request: string): unknown {
  try {
    throwIfUnreachable(result, request)
  } catch (error) {
    return error
  }
  throw new Error('던지지 않았다')
}

/** 재조회·첫 조회가 받은 503 - 조회의 `queryFn` 이 던졌을 오류다. */
function busy(request: string): unknown {
  return thrownBy(failed<CollectionDocument>([BUSY], 503), request)
}

/** 백엔드가 낸 오류 문서 하나 - 문구가 상태마다 다르다. */
function backendError(status: number): ErrorObject {
  return { status: String(status), code: `PROBE_${status}`, detail: `PROBE 문구 ${status}` }
}

/** 합성 오류 - client.ts 가 지어낸 "응답조차 없었다" 는 표시다. 영어 고정 문장을 `detail` 로 갖는다. */
const SYNTHETIC: ErrorObject = {
  status: '0',
  code: 'PROBE_TRANSPORT',
  detail: 'PROBE synthetic sentence',
  meta: { synthetic: true },
}

/** `UnreachableError` 가 싣는 응답의 모양 - 실패한 `JsonApiResult` 다. */
function failedResponse(
  errors: ErrorObject[],
  status: number,
): Extract<JsonApiResult<never>, { ok: false }> {
  return { ok: false, status, errors }
}

/** 조회의 `queryFn` 이 이 결과를 받았을 때 TanStack Query 가 화면에 건네는 것 - 던졌으면 오류, 아니면 읽은 값이다. */
function queryOutcome<T>(
  result: JsonApiResult<T>,
  request: string,
): { readonly value: JsonApiResult<T> | undefined; readonly error: unknown } {
  try {
    return { value: throwIfUnreachable(result, request), error: null }
  } catch (error) {
    return { value: undefined, error }
  }
}

/** 목록의 첫 조회가 이 상태의 오류 문서를 받았을 때 화면이 그리는 것. */
function firstListScreen(status: number) {
  const { value, error } = queryOutcome(
    failed<CollectionDocument>([backendError(status)], status),
    '목록',
  )
  return listScreen(PROBE_CRATE, PLAN, {
    pages: value === undefined ? undefined : [value],
    error,
    nextPageFailed: false,
  })
}

/** 관계 선택기의 참조 목록 첫 조회가 이 상태의 오류 문서를 받았을 때 선택기가 그리는 것. */
function firstReferenceState(status: number) {
  const { value, error } = queryOutcome(
    failed<CollectionDocument>([backendError(status)], status),
    '참조 목록',
  )
  return referenceState(PROBE_CRATE, { result: value, error })
}

/** 상세의 첫 조회가 이 상태의 오류 문서를 받았을 때 화면이 그리는 것. */
function firstDetailScreen(status: number) {
  const { value, error } = queryOutcome(
    failed<SingleDocument>([backendError(status)], status),
    '상세',
  )
  return detailScreen(PROBE_CRATE, { result: value, error })
}

describe('throwIfUnreachable - 판정하지 않은 응답도 던진다', () => {
  it.each([500, 502, 503, 504, 408, 429])('%i 는 던진다 - 응답을 싣는다', (status) => {
    const result = failed<CollectionDocument>([{ ...BUSY, status: String(status) }], status)
    const error = thrownBy(result, '목록')
    expect(error).toBeInstanceOf(UnreachableError)
    expect((error as UnreachableError).response).toBe(result)
    expect((error as UnreachableError).message).toContain(String(status))
  })

  // 499 는 5xx 의 바로 아래다 - 경계를 고정한다(판정하지 않은 응답은 500 부터다).
  it.each([400, 403, 404, 409, 422, 499])('%i 는 판정한 오류라 값 그대로다', (status) => {
    const result = failed<CollectionDocument>([{ ...BUSY, status: String(status) }], status)
    expect(throwIfUnreachable(result, '목록')).toBe(result)
  })
})

describe('listScreen - 판정하지 않은 응답', () => {
  it('첫 조회면 그 문구의 배너가 화면 전부다 - 작은 실패는 없고 다시 시도가 붙는다', () => {
    expect(
      listScreen(PROBE_CRATE, PLAN, {
        pages: undefined,
        error: busy('목록'),
        nextPageFailed: false,
      }),
    ).toEqual({
      kind: 'banner',
      messages: ['PROBE 잠시 뒤에'],
      refreshFailed: false,
      retryable: true,
    })
  })

  it.each([503, 429, 408])(
    '첫 조회의 %i 는 배너에 다시 시도를 붙인다 - 잠시 뒤 다시 부르면 달라질 수 있다',
    (status) => {
      expect(firstListScreen(status)).toEqual({
        kind: 'banner',
        messages: [`PROBE 문구 ${status}`],
        refreshFailed: false,
        retryable: true,
      })
    },
  )

  it.each([400, 403, 409])(
    '첫 조회의 %i 는 판정한 답이라 다시 시도가 없는 배너다 - 다시 불러도 같은 답이다',
    (status) => {
      const screen = firstListScreen(status)
      expect(screen).toEqual({
        kind: 'banner',
        messages: [`PROBE 문구 ${status}`],
        refreshFailed: false,
      })
      expect(screen).not.toHaveProperty('retryable')
    },
  )

  it('재조회면 읽은 행을 두고 목록 위에 작은 실패를 싣는다', () => {
    const screen = listScreen(PROBE_CRATE, PLAN, {
      pages: [okPage(['c1', 'c2']), okPage(['c3'])],
      error: busy('목록'),
      nextPageFailed: false,
    })
    if (screen.kind !== 'list') throw new Error('목록이어야 한다')
    expect(screen.rows.map((row) => row.id)).toEqual(['c1', 'c2', 'c3'])
    expect(screen.refreshFailed).toBe(true)
    expect(screen.failure).toBe(null)
  })

  it('다음 쪽이면 읽은 행을 두고 목록 끝에 싣는다 - 다시 시도는 그 쪽만이다', () => {
    const screen = listScreen(PROBE_CRATE, PLAN, {
      pages: [okPage(['c1'])],
      error: busy('목록'),
      nextPageFailed: true,
    })
    if (screen.kind !== 'list') throw new Error('목록이어야 한다')
    expect(screen.failure).toEqual({ kind: 'unreachable' })
    expect(screen.refreshFailed).toBe(false)
  })
})

describe('detailScreen - 판정하지 않은 응답과 판정한 응답', () => {
  const found: JsonApiResult<SingleDocument> = {
    ok: true,
    status: 200,
    document: { data: { type: 'probeCrates', id: 'c1', attributes: { probeName: 'PROBE c1' } } },
  }

  it('첫 조회면 그 문구의 배너다 - 다시 시도가 붙는다', () => {
    expect(detailScreen(PROBE_CRATE, { result: undefined, error: busy('상세') })).toEqual({
      kind: 'banner',
      messages: ['PROBE 잠시 뒤에'],
      refreshFailed: false,
      retryable: true,
    })
  })

  it.each([503, 429, 408])(
    '첫 조회의 %i 는 배너에 다시 시도를 붙인다 - 잠시 뒤 다시 부르면 달라질 수 있다',
    (status) => {
      expect(firstDetailScreen(status)).toEqual({
        kind: 'banner',
        messages: [`PROBE 문구 ${status}`],
        refreshFailed: false,
        retryable: true,
      })
    },
  )

  it.each([400, 403, 409])(
    '첫 조회의 %i 는 판정한 답이라 다시 시도가 없는 배너다 - 다시 불러도 같은 답이다',
    (status) => {
      const screen = firstDetailScreen(status)
      expect(screen).toEqual({
        kind: 'banner',
        messages: [`PROBE 문구 ${status}`],
        refreshFailed: false,
      })
      expect(screen).not.toHaveProperty('retryable')
    },
  )

  it('코드가 RESOURCE_NOT_FOUND 인 5xx 는 not-found 가 아니다 - 일시적인 실패는 없는 자원이 아니다', () => {
    const response = failed<SingleDocument>(
      [{ status: '503', code: 'RESOURCE_NOT_FOUND', detail: 'PROBE 없음?' }],
      503,
    )
    const { value, error } = queryOutcome(response, '상세')
    expect(detailScreen(PROBE_CRATE, { result: value, error })).toEqual({ kind: 'unreachable' })
  })

  it('재조회면 읽은 상세를 두고 작은 실패를 싣는다', () => {
    const screen = detailScreen(PROBE_CRATE, { result: found, error: busy('상세') })
    if (screen.kind !== 'detail') throw new Error('상세여야 한다')
    expect(screen.heading).toBe('PROBE c1')
    expect(screen.refreshFailed).toBe(true)
  })

  it('판정한 답(404)은 재조회여도 새 답이다 - 지워진 자원은 not-found', () => {
    const missing = failed<SingleDocument>(
      [{ status: '404', code: 'RESOURCE_NOT_FOUND', detail: 'PROBE 없음' }],
      404,
    )
    expect(
      detailScreen(PROBE_CRATE, { result: throwIfUnreachable(missing, '상세'), error: null }),
    ).toEqual({ kind: 'notFound' })
  })
})

describe('referenceState - 판정하지 않은 응답', () => {
  it('첫 조회면 그 문구를 보기 대신 그린다 - 다시 시도가 붙는다', () => {
    expect(referenceState(PROBE_CRATE, { result: undefined, error: busy('목록') })).toEqual({
      list: { options: [], truncated: false },
      failure: { kind: 'banner', messages: ['PROBE 잠시 뒤에'], retryable: true },
    })
  })

  it.each([503, 429, 408])(
    '첫 조회의 %i 는 배너에 다시 시도를 붙인다 - 잠시 뒤 다시 부르면 달라질 수 있다',
    (status) => {
      expect(firstReferenceState(status)).toEqual({
        list: { options: [], truncated: false },
        failure: { kind: 'banner', messages: [`PROBE 문구 ${status}`], retryable: true },
      })
    },
  )

  it.each([400, 403, 409])(
    '첫 조회의 %i 는 판정한 답이라 다시 시도가 없는 배너다 - 다시 불러도 같은 답이다',
    (status) => {
      const state = firstReferenceState(status)
      expect(state).toEqual({
        list: { options: [], truncated: false },
        failure: { kind: 'banner', messages: [`PROBE 문구 ${status}`] },
      })
      expect(state.failure).not.toHaveProperty('retryable')
    },
  )

  it('읽은 목록이 있으면 그대로 둔다', () => {
    expect(referenceState(PROBE_CRATE, { result: okPage(['c1']), error: busy('목록') })).toEqual({
      list: { options: [{ id: 'c1', label: 'PROBE c1' }], truncated: false },
      failure: null,
    })
  })

  it('읽은 거절(판정한 4xx)이 있으면 재조회의 판정하지 않은 응답은 그 배너를 바꾸지 않는다 - 다시 시도도 붙지 않는다', () => {
    const rejected = failed<CollectionDocument>([backendError(400)], 400)
    const state = referenceState(PROBE_CRATE, { result: rejected, error: busy('참조 목록') })
    expect(state).toEqual({
      list: { options: [], truncated: false },
      failure: { kind: 'banner', messages: ['PROBE 문구 400'] },
    })
    expect(state.failure).not.toHaveProperty('retryable')
  })
})

describe('목록·상세·참조 목록은 첫 조회가 받은 오류 문서를 같게 읽는다 - failureOf 의 규칙', () => {
  // 응답을 실은 오류를 직접 지어 셋에 같은 문서를 넣는다. 합성 오류를 응답으로 싣는 오류는 `throwIfUnreachable` 가
  // 만들지 않지만 오류의 모양은 허용한다 - 목록·상세의 `unreachable` 갈래가 이 시험으로 닫힌다.
  it.each<[string, ErrorObject[], string, true | undefined]>([
    ['합성 오류(응답조차 없었다)는 닿지 못함이다', [SYNTHETIC], 'unreachable', undefined],
    ['문구가 있는 오류 문서는 그 문구의 다시 시도가 붙은 배너다', [BUSY], 'banner', true],
  ])('%s', (_, errors, kind, retryable) => {
    const error = new UnreachableError('조회', failedResponse(errors, 503))
    const list = listScreen(PROBE_CRATE, PLAN, { pages: undefined, error, nextPageFailed: false })
    const detail = detailScreen(PROBE_CRATE, { result: undefined, error })
    const reference = referenceState(PROBE_CRATE, { result: undefined, error }).failure
    expect([list.kind, detail.kind, reference?.kind]).toEqual([kind, kind, kind])
    expect([
      'retryable' in list ? list.retryable : undefined,
      'retryable' in detail ? detail.retryable : undefined,
      reference !== null && 'retryable' in reference ? reference.retryable : undefined,
    ]).toEqual([retryable, retryable, retryable])
  })

  it('문구가 하나도 없는 오류 문서는 계약 위반이라 셋 다 던진다 - 참조 목록만 앱 문구로 가리지 않는다', () => {
    const error = new UnreachableError('조회', failedResponse([{ status: '503' }], 503))
    expect(() =>
      listScreen(PROBE_CRATE, PLAN, { pages: undefined, error, nextPageFailed: false }),
    ).toThrowError(/문구 없는 오류/)
    expect(() => detailScreen(PROBE_CRATE, { result: undefined, error })).toThrowError(
      /문구 없는 오류/,
    )
    expect(() => referenceState(PROBE_CRATE, { result: undefined, error })).toThrowError(
      /문구 없는 오류/,
    )
  })
})

describe('canLoadMore - 목록 끝에서 다음 쪽을 부르는가', () => {
  it.each<[string, boolean, boolean, boolean, boolean]>([
    ['다음 쪽이 있고 쉬고 있다', true, false, false, true],
    ['다음 쪽이 없다', false, false, false, false],
    ['읽는 중이다 - 진행 중인 재조회를 끊지 않는다', true, true, false, false],
    ['다음 쪽이 실패한 채다 - 되풀이하지 않고 "다시 시도" 를 기다린다', true, false, true, false],
  ])('%s', (_, hasNextPage, isFetching, isFetchNextPageError, expected) => {
    expect(canLoadMore({ hasNextPage, isFetching, isFetchNextPageError })).toBe(expected)
  })
})
