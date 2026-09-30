import { describe, expect, it } from 'vitest'

import type { JsonApiResult } from '@/lib/jsonapi/client'
import type { CollectionDocument, ErrorObject } from '@/lib/jsonapi/document'
import { defineResource } from '@/lib/resources/define'
import {
  LIST_PAGE_SIZE,
  clearFiltersHref,
  filterFields,
  filterFormValues,
  filterHref,
  filterQuery,
  listQuery,
  listRequest,
  listView,
  nextPageQuery,
  sortOptions,
} from '@/lib/resources/view'

/**
 * 이 저장소가 `lib/resources/view.ts`(template-typescript-nextjs 에서 복사)에 더한 판단 - 커서
 * 목록(스펙 8.3), 쪽 여럿의 목록 상태, 필터 시트의 폼 상태(스펙 6.2), 라우트 파라미터 왕복(스펙
 * 8.2)과 라우트 파라미터에 섞여 드는 내비게이션 값. 원본의 시험은
 * test/unit/resources/view.test.ts 에 있다.
 *
 * 자원은 `probe*` 로 만든다 - `EXAMPLE` 로 재면 "선언을 읽는다" 와 "그 자원을 안다" 가 구별되지
 * 않는다(view.test.ts 머리말과 같은 규칙).
 */
function probeShelf() {
  return defineResource({
    type: 'probeShelves',
    path: '/probe/api/shelves',
    attributes: {
      probeTitle: {
        kind: 'string',
        label: 'PROBE 제목',
        readOnly: false,
        nullable: false,
        listed: true,
      },
      probeState: {
        kind: 'enum',
        label: 'PROBE 상태',
        readOnly: false,
        nullable: false,
        listed: true,
        values: [
          { value: 'probe-open', label: 'PROBE 열림' },
          { value: 'probe-shut', label: 'PROBE 닫힘' },
        ],
      },
      probeSize: {
        kind: 'int',
        label: 'PROBE 크기',
        readOnly: false,
        nullable: false,
        listed: true,
      },
      probeMadeAt: {
        kind: 'datetime',
        label: 'PROBE 시각',
        readOnly: true,
        nullable: false,
        listed: true,
      },
    },
    relationships: {
      probeOwner: { cardinality: 'one', type: 'probeOwners', label: 'PROBE 주인' },
    },
    filters: {
      probeTitle: ['contains'],
      probeState: ['in'],
      probeSize: ['gte', 'lte'],
      probeMadeAt: ['gte', 'lte'],
      'probeOwner.id': ['isNull'],
    },
    sorts: ['probeTitle', 'probeSize'],
    defaultSort: '-probeSize',
    includes: ['probeOwner'],
    writable: true,
  })
}

const PATH = '/probe/shelves'

/** 행 하나. 제목만 채운다 - 행 변환의 세부는 view.test.ts 가 잰다. */
function probeRow(id: string) {
  return { type: 'probeShelves', id, attributes: { probeTitle: `PROBE ${id}` } }
}

function okPage(
  ids: readonly string[],
  links?: Record<string, string | null>,
): JsonApiResult<CollectionDocument> {
  return {
    ok: true,
    status: 200,
    document: { data: ids.map(probeRow), ...(links === undefined ? {} : { links }) },
  }
}

function failedPage(errors: ErrorObject[]): JsonApiResult<CollectionDocument> {
  return { ok: false, status: 0, errors }
}

/** client.ts 가 합성한 오류의 표시 - 코드 문자열이 아니라 표시로 판정한다(view.test.ts 와 같다). */
const UNREACHABLE: ErrorObject = {
  status: '0',
  code: 'PROBE_TRANSPORT',
  detail: 'PROBE 전송 실패',
  meta: { synthetic: true },
}

/** 정본 모양의 커서 링크(백엔드 경로, 원래 쿼리를 보존하고 page 계열만 바꾼다). */
const NEXT_LINK =
  '/probe/api/shelves?filter%5BprobeTitle%5D%5Bcontains%5D=PROBE&include=probeOwner&page%5Bafter%5D=cHJvYmUtY3Vyc29y&page%5Bsize%5D=20'

describe('listQuery — 커서의 입구 (스펙 8.3)', () => {
  it('첫 요청은 page[after] 빈 값과 쪽 크기 20 이다', () => {
    const query = listQuery(probeShelf(), {})
    expect(query.get('page[after]')).toBe('')
    expect(query.get('page[size]')).toBe('20')
    expect(LIST_PAGE_SIZE).toBe(20)
  })

  it('URL 의 쪽 번호·커서는 버린다 - offset 과 cursor 가 섞이면 400 이다', () => {
    const query = listQuery(probeShelf(), {
      'page[number]': '3',
      'page[after]': 'probe-stale-cursor',
      'page[before]': '',
    })
    expect(query.has('page[number]')).toBe(false)
    expect(query.has('page[before]')).toBe(false)
    expect(query.getAll('page[after]')).toEqual([''])
  })

  it('URL 의 쪽 크기는 남긴다 - 위치가 아니라 "한 쪽에 몇 개" 다', () => {
    expect(listQuery(probeShelf(), { 'page[size]': '2' }).getAll('page[size]')).toEqual(['2'])
  })
})

describe('nextPageQuery — links.next 를 그대로 따라간다', () => {
  it('다음 링크의 쿼리를 그대로 준다 - 커서를 해석하지 않는다', () => {
    const next = nextPageQuery(okPage(['s1', 's2'], { self: '/x', next: NEXT_LINK }))
    expect(next?.get('page[after]')).toBe('cHJvYmUtY3Vyc29y')
    expect(next?.get('page[size]')).toBe('20')
    expect(next?.get('filter[probeTitle][contains]')).toBe('PROBE')
    expect(next?.get('include')).toBe('probeOwner')
  })

  it('next 가 null 이면 끝이다 (정본·Rails 모양)', () => {
    expect(nextPageQuery(okPage(['s1'], { self: '/x', next: null }))).toBe(null)
  })

  it('next 키가 아예 없어도 끝이다 (NestJS 모양, R-10①)', () => {
    // 엄격 비교(`!== null`)로 판정하면 `undefined !== null` 이 참이라 끝이 오지 않는다.
    expect(nextPageQuery(okPage(['s1'], { self: '/x', first: '/x' }))).toBe(null)
    expect(nextPageQuery(okPage(['s1']))).toBe(null)
  })

  it('빈 쪽은 끝이다 - next 에 커서가 있어도 (NestJS 의 경계)', () => {
    expect(nextPageQuery(okPage([], { self: '/x', next: NEXT_LINK }))).toBe(null)
  })

  it('실패한 쪽과 본문 없는 응답 뒤로는 읽지 않는다', () => {
    expect(nextPageQuery(failedPage([UNREACHABLE]))).toBe(null)
    expect(nextPageQuery({ ok: true, status: 204, document: null })).toBe(null)
  })

  it('읽을 수 없는 링크는 끝이다 - 던지지 않는다', () => {
    expect(nextPageQuery(okPage(['s1'], { next: 'http://[probe' }))).toBe(null)
  })
})

describe('listView — 쪽 여럿을 한 목록으로', () => {
  const plan = listRequest(probeShelf(), {})

  it('읽은 쪽을 순서대로 잇는다', () => {
    const view = listView(probeShelf(), plan, [okPage(['s1', 's2']), okPage(['s3'])])
    if (view.kind !== 'list') throw new Error('목록이어야 한다')
    expect(view.rows.map((row) => row.id)).toEqual(['s1', 's2', 's3'])
    expect(view.failure).toBe(null)
  })

  it('같은 id 는 처음 나온 행만 남긴다 - 목록의 키가 겹치지 않는다', () => {
    const view = listView(probeShelf(), plan, [okPage(['s1', 's2']), okPage(['s2', 's3'])])
    if (view.kind !== 'list') throw new Error('목록이어야 한다')
    expect(view.rows.map((row) => row.id)).toEqual(['s1', 's2', 's3'])
  })

  it('첫 쪽이 닿지 못하면 화면 전부가 unreachable 이다', () => {
    expect(listView(probeShelf(), plan, [failedPage([UNREACHABLE])])).toEqual({
      kind: 'unreachable',
    })
  })

  it('뒤따르는 쪽이 닿지 못하면 읽은 행은 두고 failure 에 싣는다', () => {
    const view = listView(probeShelf(), plan, [okPage(['s1']), failedPage([UNREACHABLE])])
    if (view.kind !== 'list') throw new Error('목록이어야 한다')
    expect(view.rows.map((row) => row.id)).toEqual(['s1'])
    expect(view.failure).toEqual({ kind: 'unreachable' })
  })

  it('뒤따르는 쪽의 백엔드 오류는 그 문구의 배너다', () => {
    const view = listView(probeShelf(), plan, [
      okPage(['s1']),
      failedPage([{ status: '400', code: 'PROBE_PAGE', detail: 'PROBE 쪽 오류' }]),
    ])
    if (view.kind !== 'list') throw new Error('목록이어야 한다')
    expect(view.failure).toEqual({ kind: 'banner', messages: ['PROBE 쪽 오류'] })
  })

  it('뒤따르는 쪽의 오류에 문구가 없으면 던진다 - 빈 배너를 그리지 않는다', () => {
    expect(() =>
      listView(probeShelf(), plan, [okPage(['s1']), failedPage([{ status: '400' }])]),
    ).toThrow()
  })
})

describe('filterFormValues — 시트를 열 때의 값', () => {
  const params = {
    'filter[probeTitle][contains]': 'PROBE 조각',
    'filter[probeState][in]': 'probe-open,probe-shut',
    'filter[probeSize][gte]': '10',
    'filter[probeMadeAt][lte]': '2026-04-02T23:59:59.999999+00:00',
    'filter[probeOwner.id][isNull]': 'true',
    sort: '-probeSize',
  }

  it('컨트롤마다 URL 의 값을 파라미터 이름으로 담는다', () => {
    expect(filterFormValues(filterFields(probeShelf(), params))).toEqual({
      'filter[probeTitle][contains]': ['PROBE 조각'],
      'filter[probeState][in]': ['probe-open', 'probe-shut'],
      'filter[probeSize][gte]': ['10'],
      'filter[probeSize][lte]': [],
      'filter[probeMadeAt][gte]': [],
      // 날짜 입력이 그릴 수 있는 UTC 날짜로 접힌다(filterFields 의 규칙).
      'filter[probeMadeAt][lte]': ['2026-04-02'],
      'filter[probeOwner.id][isNull]': ['true'],
    })
  })

  it('그대로 적용하면 URL 의 조건이 다시 나온다', () => {
    const fields = filterFields(probeShelf(), params)
    expect(filterQuery(fields, params, filterFormValues(fields)).toString()).toBe(
      new URLSearchParams(params).toString(),
    )
  })

  it('URL 이 비면 모든 값이 비어 있다', () => {
    const values = filterFormValues(filterFields(probeShelf(), {}))
    expect(Object.values(values).every((entry) => entry.length === 0)).toBe(true)
  })
})

describe('filterHref — 적용이 갈 주소', () => {
  it('이 화면의 주소에 필터 쿼리를 붙인다', () => {
    const fields = filterFields(probeShelf(), {})
    expect(filterHref(PATH, fields, {}, { 'filter[probeState][in]': ['probe-open'] })).toBe(
      `${PATH}?filter%5BprobeState%5D%5Bin%5D=probe-open`,
    )
  })

  it('조건이 없으면 경로 그대로다 - ? 를 남기지 않는다', () => {
    expect(filterHref(PATH, filterFields(probeShelf(), {}), {}, {})).toBe(PATH)
  })
})

/**
 * Expo Router 57 이 주소에서 라우트 파라미터를 꺼내는 순서 그대로다(2026-09-30, expo-router
 * 57.0.24 설치본의 build/ 에서 읽었다):
 *
 * 1. `fork/getStateFromPath-forks.js` 의 `parseQueryParams` - `new URL(주소, 'file:')` 의
 *    `searchParams` 에서 이름마다 `getAll`, 값이 하나면 문자열
 * 2. `hooks/useLocalSearchParams.js` - 값마다 `decodeURIComponent` 를 한 번 더(실패하면 그대로)
 *
 * 딥링크도 앱 안의 이동(`router.push(주소)`)도 이 해석을 지난다. 기기 위의 확인은 D1 실측 M2
 * (인코딩한 대괄호 키의 딥링크)와 E2E 의 딥링크 플로다.
 */
function routeParamsOf(href: string): Record<string, string | string[]> {
  const searchParams = new URL(href, 'file:').searchParams
  const params: Record<string, string | string[]> = {}
  for (const name of new Set(searchParams.keys())) {
    const values = searchParams.getAll(name).map(decodeOnceMore)
    const [only] = values
    params[name] = values.length === 1 && only !== undefined ? only : values
  }
  return params
}

function decodeOnceMore(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

describe('라우트 파라미터 왕복 - 이 앱의 주소 인코딩 규칙 (스펙 8.2)', () => {
  it('대괄호 키가 평평한 키로 돌아오고, 같은 백엔드 쿼리가 다시 나온다', () => {
    const params = {
      'filter[probeTitle][contains]': 'PROBE 조각',
      'filter[probeState][in]': 'probe-open,probe-shut',
      sort: 'probeTitle',
    }
    const fields = filterFields(probeShelf(), params)
    const href = filterHref(PATH, fields, params, filterFormValues(fields))
    expect(routeParamsOf(href)).toEqual(params)
    expect(listQuery(probeShelf(), routeParamsOf(href)).toString()).toBe(
      listQuery(probeShelf(), params).toString(),
    )
  })

  it('값의 공백·쉼표·&·=·+·#·한글이 그대로 돌아온다', () => {
    const value = 'PROBE a b,c&d=e+f#가'
    const fields = filterFields(probeShelf(), {})
    const href = filterHref(PATH, fields, {}, { 'filter[probeTitle][contains]': [value] })
    expect(routeParamsOf(href)['filter[probeTitle][contains]']).toBe(value)
  })

  it('정렬 메뉴와 필터 지우기의 주소도 같은 규칙으로 돌아온다', () => {
    const params = { 'filter[probeTitle][contains]': 'PROBE', sort: 'probeTitle' }
    const sortHref = sortOptions(probeShelf(), PATH, params).find(
      (option) => option.key === 'probeSize',
    )?.href
    expect(routeParamsOf(sortHref ?? '')).toEqual({
      'filter[probeTitle][contains]': 'PROBE',
      sort: '-probeSize',
    })
    expect(routeParamsOf(clearFiltersHref(PATH, params))).toEqual({ sort: 'probeTitle' })
  })

  it('알고 넘어가는 한계 - 값 안의 %XX 는 라우터가 한 번 더 풀어 바뀐다', () => {
    // useLocalSearchParams 의 두 번째 decodeURIComponent 때문이다. 풀 수 없는 % 는 그대로 남는다.
    const fields = filterFields(probeShelf(), {})
    const lossy = filterHref(PATH, fields, {}, { 'filter[probeTitle][contains]': ['PROBE %41'] })
    const kept = filterHref(PATH, fields, {}, { 'filter[probeTitle][contains]': ['PROBE 100%'] })
    expect(routeParamsOf(lossy)['filter[probeTitle][contains]']).toBe('PROBE A')
    expect(routeParamsOf(kept)['filter[probeTitle][contains]']).toBe('PROBE 100%')
  })
})

/**
 * 로그인·가입 뒤 복귀(`router.dismissTo(주소, { withAnchor: true })`)는 도착한 화면의 라우트
 * 파라미터에 `initial: false` 를 싣는다. expo-router 57.0.24 설치본의
 * `build/global-state/getNavigationAction.js` 가 `withAnchor` 가 있으면 중첩된 모든 params 에
 * `initial = !withAnchor` 를 쓰고, `useLocalSearchParams` 는 값마다 `decodeURIComponent` 를
 * 지나므로 화면이 받는 것은 `initial: 'false'` 다. 내비게이션의 값이지 목록의 조건이 아니다 -
 * 백엔드 쿼리에 섞이면 안 되고, 조건으로 읽히면 빈 결과의 문구도 틀어진다.
 *
 * 기준은 "`initial` 을 뺀 같은 조건" 이다 - 섞여 들었을 때 무엇이 어떻게 달라지는지가 아니라
 * 아무것도 달라지지 않는지를 잰다.
 */
describe('라우트 파라미터의 initial — 조건이 아니다', () => {
  const conditions = {
    'filter[probeTitle][contains]': 'PROBE 조각',
    'filter[probeState][in]': 'probe-open,probe-shut',
    sort: 'probeTitle',
  }
  const params = { ...conditions, initial: 'false' }

  it('백엔드 쿼리에 실리지 않는다', () => {
    const query = listQuery(probeShelf(), params)
    expect(query.has('initial')).toBe(false)
    expect(query.toString()).toBe(listQuery(probeShelf(), conditions).toString())
  })

  it('initial 만 실린 주소는 조건 없는 목록이다 - 빈 결과가 "필터 결과 없음" 이 되지 않는다', () => {
    const plan = listRequest(probeShelf(), { initial: 'false' })
    const view = listView(probeShelf(), plan, [okPage([])])
    if (view.kind !== 'list') throw new Error('목록이어야 한다')
    expect(view.filtered).toBe(false)
  })

  it('적용으로 이동한 주소에서 만든 백엔드 쿼리에도 없다', () => {
    // 주소 조립은 남의 파라미터를 옮긴다(스펙 8.1) - 옮겨 간 것이 백엔드에 닿는지가 경계다.
    const fields = filterFields(probeShelf(), params)
    const applied = routeParamsOf(filterHref(PATH, fields, params, filterFormValues(fields)))
    expect(listQuery(probeShelf(), applied).has('initial')).toBe(false)
    expect(listQuery(probeShelf(), applied).toString()).toBe(
      listQuery(probeShelf(), conditions).toString(),
    )
  })
})
