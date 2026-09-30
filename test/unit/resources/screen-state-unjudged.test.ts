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

describe('throwIfUnreachable - 판정하지 않은 응답도 던진다', () => {
  it.each([500, 502, 503, 504, 408, 429])('%i 는 던진다 - 응답을 싣는다', (status) => {
    const result = failed<CollectionDocument>([{ ...BUSY, status: String(status) }], status)
    const error = thrownBy(result, '목록')
    expect(error).toBeInstanceOf(UnreachableError)
    expect((error as UnreachableError).response).toBe(result)
    expect((error as UnreachableError).message).toContain(String(status))
  })

  it.each([400, 403, 404, 409, 422])('%i 는 판정한 오류라 값 그대로다', (status) => {
    const result = failed<CollectionDocument>([{ ...BUSY, status: String(status) }], status)
    expect(throwIfUnreachable(result, '목록')).toBe(result)
  })
})

describe('listScreen - 판정하지 않은 응답', () => {
  it('첫 조회면 그 문구의 배너가 화면 전부다 - 작은 실패는 없다', () => {
    expect(
      listScreen(PROBE_CRATE, PLAN, {
        pages: undefined,
        error: busy('목록'),
        nextPageFailed: false,
      }),
    ).toEqual({ kind: 'banner', messages: ['PROBE 잠시 뒤에'], refreshFailed: false })
  })

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

  it('첫 조회면 그 문구의 배너다', () => {
    expect(detailScreen(PROBE_CRATE, { result: undefined, error: busy('상세') })).toEqual({
      kind: 'banner',
      messages: ['PROBE 잠시 뒤에'],
      refreshFailed: false,
    })
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
  it('첫 조회면 그 문구를 보기 대신 그린다', () => {
    expect(referenceState(PROBE_CRATE, { result: undefined, error: busy('목록') })).toEqual({
      list: { options: [], truncated: false },
      failure: { kind: 'banner', messages: ['PROBE 잠시 뒤에'] },
    })
  })

  it('읽은 목록이 있으면 그대로 둔다', () => {
    expect(referenceState(PROBE_CRATE, { result: okPage(['c1']), error: busy('목록') })).toEqual({
      list: { options: [{ id: 'c1', label: 'PROBE c1' }], truncated: false },
      failure: null,
    })
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
