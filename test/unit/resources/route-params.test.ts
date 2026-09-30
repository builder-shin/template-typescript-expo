import { describe, expect, it } from 'vitest'

import { EXAMPLE } from '@/lib/resources'
import { isCurrentListHref, listRouteParams } from '@/lib/resources/route-params'
import {
  clearFiltersHref,
  filterFields,
  filterFormValues,
  filterHref,
  listRequest,
  sortOptions,
} from '@/lib/resources/view'

// 로그인·가입 뒤 복귀(dismissTo 의 withAnchor)로 목록에 닿은 화면이 받는 라우트 파라미터의 모양이다 -
// expo-router 57 이 잎 화면까지 initial: false 를 싣고 useLocalSearchParams 가 문자열로 돌려준다.
// ref 는 딥링크에 붙어 온 남의 파라미터다.
const ROUTE = {
  initial: 'false',
  'filter[status][in]': 'active',
  sort: 'title',
  'page[size]': '10',
  ref: 'probe-campaign',
}

describe('listRouteParams', () => {
  it('JSON:API 쿼리 파라미터만 남긴다 - 이동이 실은 initial 과 남의 파라미터는 버린다', () => {
    expect(listRouteParams(ROUTE)).toEqual({
      'filter[status][in]': 'active',
      sort: 'title',
      'page[size]': '10',
    })
  })

  it('여러 값은 배열로 두고 값이 없는 키는 버린다', () => {
    expect(
      listRouteParams({
        'filter[status][in]': ['active', 'draft'],
        sort: undefined,
        initial: 'false',
      }),
    ).toEqual({ 'filter[status][in]': ['active', 'draft'] })
  })

  it('거른 파라미터로 만든 목록 주소와 요청에 initial 이 없다', () => {
    const params = listRouteParams(ROUTE)
    const fields = filterFields(EXAMPLE, params)
    const hrefs = [
      ...sortOptions(EXAMPLE, '/examples', params).map((option) => option.href),
      clearFiltersHref('/examples', params),
      filterHref('/examples', fields, params, filterFormValues(fields)),
    ]
    for (const href of hrefs) {
      expect(href).not.toContain('initial')
      expect(href).not.toContain('ref=')
    }
    expect(listRequest(EXAMPLE, params).query.has('initial')).toBe(false)
  })

  it('거르지 않으면 정렬 주소가 initial 을 다음 목록으로 옮긴다 - 이 함수를 두는 까닭', () => {
    expect(sortOptions(EXAMPLE, '/examples', ROUTE)[0]?.href).toContain('initial=false')
  })
})

/**
 * 같은 조건의 주소로 `router.push` 하면 같은 목록 화면이 한 벌 더 쌓여 뒤로 가기가 같은 조건을 두 번 보여
 * 준다 - 필터를 바꾸지 않고 "적용" 을 누르거나 걸린 필터가 없는데 "필터 지우기" 를 누르면 그렇다.
 */
describe('isCurrentListHref', () => {
  const PATH = '/examples'

  type Case = [name: string, href: string, params: Record<string, string | string[] | undefined>]

  const SAME: Case[] = [
    ['조건이 없고 쿼리도 없다', '/examples', {}],
    ['같은 조건', '/examples?sort=title', { sort: 'title' }],
    [
      '파라미터 순서가 달라도 같다',
      '/examples?sort=title&filter%5Bstatus%5D%5Bin%5D=active',
      { 'filter[status][in]': 'active', sort: 'title' },
    ],
    [
      '대괄호를 인코딩하지 않은 주소도 같다',
      '/examples?filter[status][in]=active&sort=title',
      { sort: 'title', 'filter[status][in]': 'active' },
    ],
    [
      '값의 퍼센트 인코딩과 공백 표기(+)가 달라도 같다',
      '/examples?filter%5Btitle%5D%5Bcontains%5D=a+b%26c',
      { 'filter[title][contains]': 'a b&c' },
    ],
    [
      '이동이 싣는 값과 남의 파라미터는 조건이 아니다',
      '/examples?sort=title',
      { initial: 'false', ref: 'probe-campaign', sort: 'title' },
    ],
    [
      '같은 이름의 여러 값은 순서까지 같다',
      '/examples?filter%5Bstatus%5D%5Bin%5D=a&filter%5Bstatus%5D%5Bin%5D=b',
      { 'filter[status][in]': ['a', 'b'] },
    ],
    ['값이 없는 키는 없는 것이다', '/examples?sort=title', { sort: 'title', include: undefined }],
  ]

  it.each(SAME)('%s', (_name, href, params) => {
    expect(isCurrentListHref(href, PATH, params)).toBe(true)
  })

  const DIFFERENT: Case[] = [
    ['값이 다르다', '/examples?sort=-title', { sort: 'title' }],
    ['주소에만 조건이 더 있다', '/examples?sort=title&page%5Bsize%5D=10', { sort: 'title' }],
    ['주소에 조건이 없다', '/examples', { sort: 'title' }],
    ['지금 조건에 없는 필터를 건다', '/examples?filter%5Bstatus%5D%5Bin%5D=draft', {}],
    [
      '같은 이름의 여러 값은 순서가 다르면 다르다',
      '/examples?filter%5Bstatus%5D%5Bin%5D=b&filter%5Bstatus%5D%5Bin%5D=a',
      { 'filter[status][in]': ['a', 'b'] },
    ],
    [
      '값의 개수가 다르다',
      '/examples?filter%5Bstatus%5D%5Bin%5D=a',
      { 'filter[status][in]': ['a', 'b'] },
    ],
    ['경로가 다르다', '/elsewhere?sort=title', { sort: 'title' }],
    ['경로가 다르고 조건이 없다', '/examples/abc', {}],
  ]

  it.each(DIFFERENT)('%s 이면 다르다', (_name, href, params) => {
    expect(isCurrentListHref(href, PATH, params)).toBe(false)
  })

  it('필터를 바꾸지 않은 "적용" 과 걸린 필터가 없는 "필터 지우기" 는 지금 주소다', () => {
    const params = listRouteParams({ ...ROUTE, 'filter[status][in]': undefined })
    const fields = filterFields(EXAMPLE, params)
    expect(
      isCurrentListHref(filterHref(PATH, fields, params, filterFormValues(fields)), PATH, params),
    ).toBe(true)
    expect(isCurrentListHref(clearFiltersHref(PATH, params), PATH, params)).toBe(true)
  })

  it('조건을 바꾸는 이동은 지금 주소가 아니다 - 걸린 필터를 지우거나 정렬 방향을 뒤집는다', () => {
    const params = listRouteParams(ROUTE)
    expect(isCurrentListHref(clearFiltersHref(PATH, params), PATH, params)).toBe(false)
    const current = sortOptions(EXAMPLE, PATH, params).find((option) => option.direction !== null)
    expect(current).toBeDefined()
    expect(isCurrentListHref(current?.href ?? '', PATH, params)).toBe(false)
  })

  it('필터를 바꿔 적용하면 지금 주소가 아니다', () => {
    const params = listRouteParams(ROUTE)
    const fields = filterFields(EXAMPLE, params)
    const changed = { ...filterFormValues(fields), 'filter[status][in]': ['draft'] }
    expect(isCurrentListHref(filterHref(PATH, fields, params, changed), PATH, params)).toBe(false)
  })
})
