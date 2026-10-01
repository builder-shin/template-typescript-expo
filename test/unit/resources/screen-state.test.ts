import { describe, expect, it } from 'vitest'

import type { JsonApiResult } from '@/lib/jsonapi/client'
import type { CollectionDocument, ErrorObject, SingleDocument } from '@/lib/jsonapi/document'
import { defineResource } from '@/lib/resources/define'
import {
  UnreachableError,
  detailScreen,
  listScreen,
  throwIfUnreachable,
} from '@/lib/resources/screen-state'
import { listRequest } from '@/lib/resources/view'

/**
 * 조회 화면의 상태 - TanStack Query 가 준 데이터·오류에서 무엇을 그릴지(스펙 9.3, D3 최종 검토 I1).
 * 재조회가 닿지 못해도 읽은 행과 상세는 남고, 작은 실패와 "다시 시도" 가 붙는다. 데이터가 없을 때만
 * 실패가 화면 전부다.
 *
 * 자원은 `probe*` 로 만든다(view.test.ts 머리말과 같은 규칙).
 */
function probeCrate() {
  return defineResource({
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
    filters: { probeName: ['contains'] },
    sorts: ['probeName'],
    defaultSort: 'probeName',
    includes: [],
    writable: false,
  })
}

const PLAN = listRequest(probeCrate(), {})

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

/** client.ts 가 합성한 오류의 표시 - 코드 문자열이 아니라 표시로 판정한다. */
const TRANSPORT: ErrorObject = {
  status: '0',
  code: 'PROBE_TRANSPORT',
  detail: 'PROBE 전송 실패',
  meta: { synthetic: true },
}
/** 판정한 백엔드 오류 문서(그 밖의 4xx) - 값으로 캐시에 들 수 있는 것이다. 5xx 는 `queryFn` 이 던지므로 캐시에 들지 않는다. */
const BACKEND: ErrorObject = { status: '400', code: 'PROBE_BROKEN', detail: 'PROBE 백엔드 문구' }

function failed<T>(errors: ErrorObject[], status = 0): JsonApiResult<T> {
  return { ok: false, status, errors }
}

const OFFLINE = new UnreachableError('목록')

describe('throwIfUnreachable - 조회의 queryFn 이 캐시에 넣을 값', () => {
  it('백엔드가 응답조차 주지 못했으면 던진다 - TanStack Query 가 앞의 데이터를 둔다', () => {
    expect(() => throwIfUnreachable(failed([TRANSPORT]), '목록')).toThrowError(UnreachableError)
    expect(() => throwIfUnreachable(failed([TRANSPORT]), '목록')).toThrowError(/목록/)

    // 응답이 없었으니 실을 응답도 없다 - 합성 오류는 상태가 5xx 여도(게이트웨이의 HTML 오류 페이지) 닿지 못함이다.
    // 싣으면 첫 조회의 참조 목록이 앱 문구와 "다시 시도" 대신 합성한 영어 문구의 배너가 된다.
    const gateway = failed<CollectionDocument>([{ ...TRANSPORT, status: '502' }], 502)
    for (const result of [failed<CollectionDocument>([TRANSPORT]), gateway]) {
      expect(() => throwIfUnreachable(result, '목록')).toThrowError(
        expect.objectContaining({ response: undefined }),
      )
    }
  })

  it('판정한 백엔드 오류 문서(그 밖의 4xx)는 값 그대로다 - 협상된 문구를 배너로 그린다', () => {
    const result = failed<CollectionDocument>([BACKEND], 400)
    expect(throwIfUnreachable(result, '목록')).toBe(result)
  })

  it('성공은 값 그대로다', () => {
    const result = okPage(['c1'])
    expect(throwIfUnreachable(result, '목록')).toBe(result)
  })
})

describe('listScreen - 목록 화면이 그릴 것', () => {
  const resource = probeCrate()

  it('첫 응답 전이면 스켈레톤이다', () => {
    expect(
      listScreen(resource, PLAN, { pages: undefined, error: null, nextPageFailed: false }),
    ).toEqual({
      kind: 'loading',
    })
  })

  it('첫 조회가 닿지 못했으면(읽은 행이 없다) 실패가 화면 전부다', () => {
    expect(
      listScreen(resource, PLAN, { pages: undefined, error: OFFLINE, nextPageFailed: false }),
    ).toEqual({ kind: 'unreachable' })
  })

  it('읽은 쪽들을 잇고, 실패가 없으면 작은 실패도 없다', () => {
    const screen = listScreen(resource, PLAN, {
      pages: [okPage(['c1', 'c2']), okPage(['c3'])],
      error: null,
      nextPageFailed: false,
    })
    if (screen.kind !== 'list') throw new Error('목록이어야 한다')
    expect(screen.rows.map((row) => row.id)).toEqual(['c1', 'c2', 'c3'])
    expect(screen.refreshFailed).toBe(false)
    expect(screen.failure).toBe(null)
  })

  it('재조회(새로고침·앱 복귀·네트워크 복귀)가 닿지 못해도 읽은 행은 그대로 두고 목록 위에 작은 실패를 싣는다', () => {
    const screen = listScreen(resource, PLAN, {
      pages: [okPage(['c1', 'c2']), okPage(['c3'])],
      error: OFFLINE,
      nextPageFailed: false,
    })
    if (screen.kind !== 'list') throw new Error('목록이어야 한다')
    expect(screen.rows.map((row) => row.id)).toEqual(['c1', 'c2', 'c3'])
    expect(screen.refreshFailed).toBe(true)
    expect(screen.failure).toBe(null)
  })

  it('다음 쪽이 닿지 못했으면 읽은 행은 두고 목록 끝에 싣는다 - 다시 시도는 그 쪽만이다', () => {
    const screen = listScreen(resource, PLAN, {
      pages: [okPage(['c1', 'c2'])],
      error: OFFLINE,
      nextPageFailed: true,
    })
    if (screen.kind !== 'list') throw new Error('목록이어야 한다')
    expect(screen.rows.map((row) => row.id)).toEqual(['c1', 'c2'])
    expect(screen.refreshFailed).toBe(false)
    expect(screen.failure).toEqual({ kind: 'unreachable' })
  })

  it('뒤따르는 쪽의 백엔드 오류(배너)는 그대로 목록 끝에 있고, 재조회가 닿지 못한 것과 함께 실린다', () => {
    const screen = listScreen(resource, PLAN, {
      pages: [okPage(['c1']), failed([BACKEND], 400)],
      error: OFFLINE,
      nextPageFailed: false,
    })
    if (screen.kind !== 'list') throw new Error('목록이어야 한다')
    expect(screen.failure).toEqual({ kind: 'banner', messages: ['PROBE 백엔드 문구'] })
    expect(screen.refreshFailed).toBe(true)
  })

  it('첫 쪽이 백엔드 오류(배너)였고 재조회가 닿지 못했으면 배너에 작은 실패를 더한다', () => {
    expect(
      listScreen(resource, PLAN, {
        pages: [failed([BACKEND], 400)],
        error: OFFLINE,
        nextPageFailed: false,
      }),
    ).toEqual({ kind: 'banner', messages: ['PROBE 백엔드 문구'], refreshFailed: true })
    expect(
      listScreen(resource, PLAN, {
        pages: [failed([BACKEND], 400)],
        error: null,
        nextPageFailed: false,
      }),
    ).toEqual({ kind: 'banner', messages: ['PROBE 백엔드 문구'], refreshFailed: false })
  })

  it('닿지 못함이 아닌 오류는 결함이다 - 던져서 오류 경계로 보낸다', () => {
    const defect = new Error('PROBE 결함')
    expect(() =>
      listScreen(resource, PLAN, { pages: [okPage(['c1'])], error: defect, nextPageFailed: false }),
    ).toThrow(defect)
    expect(() =>
      listScreen(resource, PLAN, {
        pages: undefined,
        error: 'PROBE 문자열',
        nextPageFailed: false,
      }),
    ).toThrowError(/PROBE 문자열/)
  })
})

describe('detailScreen - 상세 화면이 그릴 것', () => {
  const resource = probeCrate()
  const found: JsonApiResult<SingleDocument> = {
    ok: true,
    status: 200,
    document: { data: { type: 'probeCrates', id: 'c1', attributes: { probeName: 'PROBE c1' } } },
  }
  const missing = failed<SingleDocument>(
    [{ status: '404', code: 'RESOURCE_NOT_FOUND', detail: 'PROBE 없음' }],
    404,
  )

  it('첫 응답 전이면 스켈레톤, 첫 조회가 닿지 못했으면 실패가 화면 전부다', () => {
    expect(detailScreen(resource, { result: undefined, error: null })).toEqual({ kind: 'loading' })
    expect(detailScreen(resource, { result: undefined, error: OFFLINE })).toEqual({
      kind: 'unreachable',
    })
  })

  it('다시 들어온 상세의 재조회가 닿지 못해도 읽은 상세를 두고 작은 실패를 싣는다', () => {
    const fresh = detailScreen(resource, { result: found, error: null })
    const stale = detailScreen(resource, { result: found, error: OFFLINE })
    if (fresh.kind !== 'detail' || stale.kind !== 'detail') throw new Error('상세여야 한다')
    expect(stale.heading).toBe('PROBE c1')
    expect(stale.fields).toEqual(fresh.fields)
    expect(fresh.refreshFailed).toBe(false)
    expect(stale.refreshFailed).toBe(true)
  })

  it('없는 자원은 재조회가 닿지 못해도 없는 자원이다', () => {
    expect(detailScreen(resource, { result: missing, error: OFFLINE })).toEqual({
      kind: 'notFound',
    })
  })

  it('백엔드 오류(배너)는 그대로, 재조회가 닿지 못했으면 작은 실패를 더한다', () => {
    expect(detailScreen(resource, { result: failed([BACKEND], 400), error: OFFLINE })).toEqual({
      kind: 'banner',
      messages: ['PROBE 백엔드 문구'],
      refreshFailed: true,
    })
  })

  it('닿지 못함이 아닌 오류는 던진다', () => {
    const defect = new Error('PROBE 결함')
    expect(() => detailScreen(resource, { result: found, error: defect })).toThrow(defect)
  })
})
