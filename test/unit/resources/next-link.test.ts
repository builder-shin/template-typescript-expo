import { describe, expect, it } from 'vitest'

import type { CollectionDocument } from '@/lib/jsonapi/document'
import { defineResource } from '@/lib/resources/define'
import { nextPageQuery, referenceList } from '@/lib/resources/view'

/**
 * 무한 스크롤의 다음 쪽(`nextPageQuery`)과 관계 선택기의 잘림(`referenceList` 의 `truncated`)은 한 규칙이다 -
 * `links.next` 를 따라갈 쿼리가 있을 때만 "더 있다". D3 최종 검토 53e: 빈 링크 `''` 를 무한 스크롤은 끝으로,
 * 선택기는 잘림으로 읽었다. 같은 응답을 두 함수에 넣어 같은 답인지 잰다.
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

const ROW = { type: 'probeLabels', id: 'probe-l1', attributes: { probeName: 'PROBE 라벨 하나' } }
const NEXT = '/probe/api/labels?page%5Bnumber%5D=2&page%5Bsize%5D=100'

describe('다음 쪽과 잘림 - 한 규칙', () => {
  it.each<[string, CollectionDocument, boolean]>([
    ['링크가 null 이다(정본·Rails)', { data: [ROW], links: { next: null } }, false],
    ['링크 키가 없다(NestJS)', { data: [ROW], links: {} }, false],
    ["빈 링크 '' 다", { data: [ROW], links: { next: '' } }, false],
    ['경로뿐인 링크다', { data: [ROW], links: { next: '/probe/api/labels' } }, false],
    ['빈 쪽이다 - 링크가 있어도', { data: [], links: { next: NEXT } }, false],
    ['쿼리가 있는 링크다', { data: [ROW], links: { next: NEXT } }, true],
  ])('%s → 더 있다: %s', (_, document, more) => {
    expect(nextPageQuery({ ok: true, status: 200, document }) !== null).toBe(more)
    expect(referenceList(PROBE_LABEL, document).truncated).toBe(more)
  })
})
