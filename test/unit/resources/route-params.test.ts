import { describe, expect, it } from 'vitest'

import { EXAMPLE } from '@/lib/resources'
import { listRouteParams } from '@/lib/resources/route-params'
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
