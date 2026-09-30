import { describe, expect, it } from 'vitest'

import type { JsonApiResult } from '@/lib/jsonapi/client'
import type { CollectionDocument } from '@/lib/jsonapi/document'
import { defineResource } from '@/lib/resources/define'
import { referenceState, UnreachableError } from '@/lib/resources/screen-state'

/**
 * 관계 선택기가 그릴 참조 목록(`referenceState`) - 목록·상세(`listScreen`·`detailScreen`)와 같은 규칙이다. 닿지
 * 못함은 조회의 `queryFn` 이 던지고(오류), 백엔드 오류 문서는 값이다. 재조회가 실패해도 읽은 목록이 남는 전이는
 * test/unit/queries/reference-options.test.ts 가 실제 QueryClient 로 잰다.
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

const EMPTY = { options: [], truncated: false }

const LOADED: JsonApiResult<CollectionDocument> = {
  ok: true,
  status: 200,
  document: {
    data: [{ type: 'probeLabels', id: 'probe-l1', attributes: { probeName: 'PROBE 라벨 하나' } }],
    links: { next: null },
  },
}

describe('referenceState - 관계 선택기의 참조 목록', () => {
  it('받기 전이면 목록도 실패도 없다 - 선택기는 스켈레톤이다', () => {
    expect(referenceState(PROBE_LABEL, { result: undefined, error: null })).toEqual({
      list: null,
      failure: null,
    })
  })

  it('받은 목록을 보기로 준다', () => {
    expect(referenceState(PROBE_LABEL, { result: LOADED, error: null })).toEqual({
      list: { options: [{ id: 'probe-l1', label: 'PROBE 라벨 하나' }], truncated: false },
      failure: null,
    })
  })

  it('첫 조회가 닿지 못했으면 앱 문구와 다시 시도다 - 목록은 비어 고른 것이 목록 밖 선택이 된다', () => {
    expect(
      referenceState(PROBE_LABEL, { result: undefined, error: new UnreachableError('참조 목록') }),
    ).toEqual({ list: EMPTY, failure: { kind: 'unreachable' } })
  })

  it('읽은 목록이 있으면 재조회가 닿지 못해도 그 목록을 두고 실패를 싣지 않는다', () => {
    expect(
      referenceState(PROBE_LABEL, { result: LOADED, error: new UnreachableError('참조 목록') }),
    ).toEqual({
      list: { options: [{ id: 'probe-l1', label: 'PROBE 라벨 하나' }], truncated: false },
      failure: null,
    })
  })

  it('백엔드가 거절하면 그 문구다', () => {
    expect(
      referenceState(PROBE_LABEL, {
        result: {
          ok: false,
          status: 400,
          errors: [{ status: '400', code: 'PROBE_BAD_SORT', detail: 'probe-bad-sort' }],
        },
        error: null,
      }),
    ).toEqual({ list: EMPTY, failure: { kind: 'banner', messages: ['probe-bad-sort'] } })
  })

  it('문구가 하나도 없는 거절은 앱 문구로 물러선다 - 폼을 오류 경계로 보내지 않는다', () => {
    expect(
      referenceState(PROBE_LABEL, {
        result: { ok: false, status: 500, errors: [{}] },
        error: null,
      }),
    ).toEqual({ list: EMPTY, failure: { kind: 'unreachable' } })
  })

  it('닿지 못함이 아닌 오류는 결함이라 다시 던진다 - "연결할 수 없다" 로 위장하지 않는다', () => {
    expect(() =>
      referenceState(PROBE_LABEL, { result: LOADED, error: new TypeError('probe-defect') }),
    ).toThrow('probe-defect')
  })
})
