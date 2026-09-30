import { describe, expect, it } from 'vitest'
import {
  buildQuery,
  canonicalFilterParameter,
  filterParameter,
  formatSortToken,
  hasFilterParams,
  isFilterParameter,
  isPageParameter,
  isPagePositionParameter,
  pageParameter,
  parseSortToken,
  SORT_PARAMETER,
  toBackendQuery,
} from '@/lib/jsonapi/query'

const q = (s: string) => new URLSearchParams(s)

describe('toBackendQuery — JSON:API 파라미터 문법만 통과시킨다', () => {
  it('filter · sort · include · page 를 그대로 통과시킨다', () => {
    const out = toBackendQuery(
      q('filter[status]=active&sort=-createdAt&include=category&page[size]=20'),
    )
    expect(out.get('filter[status]')).toBe('active')
    expect(out.get('sort')).toBe('-createdAt')
    expect(out.get('include')).toBe('category')
    expect(out.get('page[size]')).toBe('20')
  })

  it('연산자가 붙은 필터를 통과시킨다', () => {
    const out = toBackendQuery(q('filter[score][gte]=10&filter[title][contains]=abc'))
    expect(out.get('filter[score][gte]')).toBe('10')
    expect(out.get('filter[title][contains]')).toBe('abc')
  })

  it('자원 정책에 없는 필터 이름도 그대로 보낸다', () => {
    // 스펙 8.1: 프론트가 미리 걸러내면 백엔드 계약이 실제로 어떻게 반응하는지
    // 이 템플릿에서 볼 수 없게 된다. 백엔드가 INVALID_FILTER 로 거절한다.
    const out = toBackendQuery(q('filter[nope]=1'))
    expect(out.get('filter[nope]')).toBe('1')
  })

  it('JSON:API 파라미터가 아닌 것은 떨어뜨린다', () => {
    const out = toBackendQuery(q('utm_source=x&q=hello&filter[status]=active'))
    expect(out.has('utm_source')).toBe(false)
    expect(out.has('q')).toBe(false)
    expect(out.get('filter[status]')).toBe('active')
  })

  it('알 수 없는 연산자는 그대로 보낸다', () => {
    // 문법상으로는 filter[name][op] 이므로 통과시키고 백엔드가 판정한다.
    const out = toBackendQuery(q('filter[score][between]=1'))
    expect(out.get('filter[score][between]')).toBe('1')
  })

  it('page 의 알 수 없는 키는 떨어뜨린다', () => {
    // page 는 키 집합이 닫혀 있다. page[offset] 같은 것은 다른 페이지네이션
    // 방언이지 이 계약의 문법이 아니다.
    const out = toBackendQuery(q('page[offset]=10&page[number]=2'))
    expect(out.has('page[offset]')).toBe(false)
    expect(out.get('page[number]')).toBe('2')
  })

  it('빈 값을 가진 커서 파라미터를 유지한다', () => {
    // page[after]= 는 컬렉션의 시작을 가리키는 유효한 진입점이다(실측).
    const out = toBackendQuery(q('page[after]=&page[size]=1'))
    expect(out.get('page[after]')).toBe('')
  })

  it('중첩이 세 겹인 filter 는 문법이 아니다', () => {
    const out = toBackendQuery(q('filter[a][b][c]=1'))
    expect(out.has('filter[a][b][c]')).toBe(false)
  })

  it('filter[...] 로 끝나지만 다른 이름인 파라미터는 문법이 아니다', () => {
    // 정규식이 문자열 전체에 앵커링되지 않으면 "myfilter[status]" 처럼
    // filter[...] 를 부분 문자열로 포함하는, 전혀 다른 이름의 파라미터가
    // 통과해 버린다.
    const out = toBackendQuery(q('myfilter[status]=active'))
    expect(out.has('myfilter[status]')).toBe(false)
  })

  it('page[totals] · page[before] 도 통과시킨다', () => {
    // PAGE_KEYS 의 다섯 키 중 number·size·after 는 다른 테스트가 이미
    // 지나가지만 totals·before 는 그렇지 않다 - 따로 확인한다.
    const out = toBackendQuery(q('page[totals]=true&page[before]=xyz'))
    expect(out.get('page[totals]')).toBe('true')
    expect(out.get('page[before]')).toBe('xyz')
  })

  it('같은 파라미터가 여러 번 오면 전부 유지한다', () => {
    // 백엔드가 중복 (이름, 연산자) 를 INVALID_FILTER 로 거절하는 것을
    // 화면에서 볼 수 있어야 한다.
    const out = toBackendQuery(q('filter[status]=a&filter[status]=b'))
    expect(out.getAll('filter[status]')).toEqual(['a', 'b'])
  })

  it('Record 입력도 받는다', () => {
    // Next.js 의 searchParams 는 Record<string, string | string[]> 로 온다.
    const out = toBackendQuery({ 'filter[status]': 'active', tags: ['a', 'b'], sort: ['title'] })
    expect(out.get('filter[status]')).toBe('active')
    expect(out.get('sort')).toBe('title')
    expect(out.has('tags')).toBe(false)
  })
})

describe('buildQuery — 프로그램으로 조립한다', () => {
  it('연산자가 exact 면 생략한다', () => {
    // 백엔드가 연산자 생략을 exact 로 읽는다(실측). 짧은 URL 이 공유하기 좋다.
    const out = buildQuery({ filters: [{ name: 'status', operator: 'exact', value: 'active' }] })
    expect(out.toString()).toBe('filter%5Bstatus%5D=active')
  })

  it('exact 가 아닌 연산자는 붙인다', () => {
    const out = buildQuery({ filters: [{ name: 'score', operator: 'gte', value: 10 }] })
    expect(out.get('filter[score][gte]')).toBe('10')
  })

  it('in 은 쉼표로 잇는다', () => {
    const out = buildQuery({
      filters: [{ name: 'status', operator: 'in', value: ['draft', 'active'] }],
    })
    expect(out.get('filter[status][in]')).toBe('draft,active')
  })

  it('in 에 배열이 아닌 단일 값을 주면 감싸서 낸다', () => {
    // FilterInput.value 타입은 operator 에 따라 배열로 좁혀지지 않는다 -
    // 호출자가 다중 선택 UI에서 항목을 하나만 고른 경우처럼 단일 값을
    // 그대로 넘길 수 있다. 이때도 최소 하나의 값으로 취급해야지, 조용히
    // 버리고 빈 값을 내면 안 된다.
    const out = buildQuery({ filters: [{ name: 'status', operator: 'in', value: 'active' }] })
    expect(out.get('filter[status][in]')).toBe('active')
  })

  it('isNull 은 true/false 리터럴로 낸다', () => {
    const out = buildQuery({ filters: [{ name: 'category.id', operator: 'isNull', value: true }] })
    expect(out.get('filter[category.id][isNull]')).toBe('true')
  })

  it('isNull 이 false 면 리터럴 false 를 낸다', () => {
    const out = buildQuery({ filters: [{ name: 'category.id', operator: 'isNull', value: false }] })
    expect(out.get('filter[category.id][isNull]')).toBe('false')
  })

  it('sort 는 쉼표로 잇고 내림차순에 - 를 붙인다', () => {
    const out = buildQuery({
      sort: [
        { name: 'createdAt', descending: true },
        { name: 'title', descending: false },
      ],
    })
    expect(out.get('sort')).toBe('-createdAt,title')
  })

  it('include 는 쉼표로 잇는다', () => {
    expect(buildQuery({ include: ['category', 'tags'] }).get('include')).toBe('category,tags')
  })

  it('page 를 낸다', () => {
    const out = buildQuery({ page: { number: 2, size: 50, totals: true } })
    expect(out.get('page[number]')).toBe('2')
    expect(out.get('page[size]')).toBe('50')
    expect(out.get('page[totals]')).toBe('true')
  })

  it('totals 가 false 면 파라미터를 아예 내지 않는다', () => {
    // 스펙 8.3: page[totals] 는 기본으로 켜지 않는다. 백엔드가 COUNT 를
    // 피하려고 만든 계약이므로 총 개수를 실제로 표시할 때만 켠다.
    expect(buildQuery({ page: { totals: false } }).has('page[totals]')).toBe(false)
  })

  it('page 에서 지정하지 않은 키는 내지 않는다', () => {
    // page 객체 자체는 있어도(totals 만 지정) number·size 처럼 값을 주지
    // 않은 필드는 "page[number]=undefined" 같은 문자열을 만들지 않고
    // 아예 파라미터를 내지 않아야 한다.
    const out = buildQuery({ page: { totals: true } })
    expect(out.has('page[number]')).toBe(false)
    expect(out.has('page[size]')).toBe(false)
    expect(out.get('page[totals]')).toBe('true')
  })

  it('빈 입력은 빈 쿼리다', () => {
    expect(buildQuery({}).toString()).toBe('')
  })

  it('빈 배열은 파라미터를 만들지 않는다', () => {
    expect(buildQuery({ include: [], sort: [], filters: [] }).toString()).toBe('')
  })

  it('in 에 빈 배열을 주면 던진다', () => {
    // 백엔드가 INVALID_FILTER 로 거절할 값을 굳이 만들어 보내지 않는다.
    // 이건 사용자 입력이 아니라 우리 코드의 버그다.
    expect(() =>
      buildQuery({ filters: [{ name: 'status', operator: 'in', value: [] }] }),
    ).toThrowError(/"in" filter needs at least one value/)
  })
})

describe('정렬 토큰 문법 — parseSortToken · formatSortToken', () => {
  // 앞의 - 는 JSON:API 정렬 문법이지 자원의 것이 아니라 이 파일이 잰다.
  // 픽스처 이름은 실전 정렬 키(title · createdAt ...)와 겹치지 않게 고른다.

  it('앞의 - 가 내림차순이다', () => {
    expect(parseSortToken('-probeCount')).toEqual({ name: 'probeCount', descending: true })
  })

  it('- 가 없으면 오름차순이다', () => {
    expect(parseSortToken('probeCount')).toEqual({ name: 'probeCount', descending: false })
  })

  it('맨 앞의 - 하나만 먹는다', () => {
    // slice(1) 이 slice(0) 이나 replace(/^-+/,'') 로 바뀌면 여기서 죽는다.
    expect(parseSortToken('--probeCount')).toEqual({ name: '-probeCount', descending: true })
  })

  it('중간에 있는 - 는 내림차순이 아니다', () => {
    // startsWith('-') 가 includes('-') 로 바뀌면 여기서 죽는다.
    // ?sort= 는 사용자가 손으로 고칠 수 있는 URL 이라 이런 토큰이 실제로 들어온다.
    expect(parseSortToken('probe-count')).toEqual({ name: 'probe-count', descending: false })
  })

  it('정렬 정책에 있는 이름인지 검사하지 않는다', () => {
    // 이 파일 머리말의 원칙이다 - 프론트가 미리 걸러내면 백엔드가
    // INVALID_SORT 로 어떻게 반응하는지 이 템플릿에서 볼 수 없게 된다.
    expect(parseSortToken('probeNeverDeclared')).toEqual({
      name: 'probeNeverDeclared',
      descending: false,
    })
  })

  it('빈 토큰과 - 하나도 던지지 않는다', () => {
    expect(parseSortToken('')).toEqual({ name: '', descending: false })
    expect(parseSortToken('-')).toEqual({ name: '', descending: true })
  })

  it('formatSortToken 이 parseSortToken 의 역방향이다', () => {
    // 두 방향이 같은 문법을 쓰는지 잰다. 한쪽만 고치면 여기서 죽는다.
    for (const token of ['probeCount', '-probeCount', 'probe-count', '', '-']) {
      expect(formatSortToken(parseSortToken(token))).toBe(token)
    }
  })

  it('buildQuery 의 sort 직렬화가 formatSortToken 과 같은 문법이다', () => {
    // buildQuery 안에 인라인으로 있던 절반을 함수로 뽑았다. 다시 갈라지면
    // 두 값이 어긋난다.
    const terms = [
      { name: 'probeCount', descending: true },
      { name: 'probeName', descending: false },
    ]
    expect(buildQuery({ sort: terms }).get('sort')).toBe(terms.map(formatSortToken).join(','))
  })

  it('descending 이 boolean 이 아니면 컴파일이 죽는다', () => {
    // **이 줄이 가드다.** formatSortToken 은 `term.descending ? ...` 로 truthy
    // 검사를 하는데, URL·폼이 주는 문자열 `'false'` 는 JS 에서 truthy 라 그것이
    // 이 자리에 들어오면 **정렬이 정확히 반대로 나가고 200 이 돌아온다** -
    // 오류도 배너도 없다. D3 Task 4 에서 `isNull` 필터가 정확히 그렇게 여집합을
    // 그렸고 게이트 8/8 이 초록이었다.
    //
    // 지금은 `SortTerm.descending: boolean` 이 그 대입을 막는다. 타입이 다시
    // 넓어지면(예: `boolean | string`) 아래 @ts-expect-error 가 쓸모없어져서
    // **TS2578 로 이 줄이 스스로 신고한다.** 그때 다시 볼 자리는 SortTerm 의
    // 주석이다.
    //
    // 런타임 단언은 일부러 두지 않는다 - 여기서 재는 것은 타입이고, 이 줄이
    // 컴파일된다는 사실 자체가 결함이다.
    // @ts-expect-error descending 은 boolean 이라 문자열을 받지 않는다
    formatSortToken({ name: 'probeCount', descending: 'false' })
  })

  it('오름차순은 - 를 붙이지 않는다 - false 가 falsy 로 읽힌다', () => {
    // 위 타입 가드가 막는 것은 대입뿐이다. `Boolean(x)`·`!!x` 같은 강제 변환은
    // 여전히 통과하므로(그리고 `Boolean('false') === true` 다) 방향이 실제로
    // 어느 쪽으로 직렬화되는지를 값으로도 고정해 둔다.
    expect(formatSortToken({ name: 'probeCount', descending: false })).toBe('probeCount')
    expect(formatSortToken({ name: 'probeCount', descending: true })).toBe('-probeCount')
  })

  it('정렬 항이 없으면 sort 파라미터를 아예 내지 않는다', () => {
    // **`sort=` 는 400 이다**(2026-09-07 정본 실측, INVALID_SORT). 빈 문자열을
    // 내는 구현은 누르는 족족 오류를 낸다.
    expect(buildQuery({ sort: [] }).has(SORT_PARAMETER)).toBe(false)
    expect(buildQuery({}).has(SORT_PARAMETER)).toBe(false)
  })
})

/**
 * `hasFilterParams` - 화면이 "아직 아무것도 없다" 와 "필터가 걸려 0건" 을
 * 구별하는 데 쓰는 술어.
 */
describe('hasFilterParams — filter 가족만 본다', () => {
  it('연산자 없는 필터를 본다', () => {
    expect(hasFilterParams(q('filter[probeMode]=probeOn'))).toBe(true)
  })

  it('연산자가 붙은 필터도 본다', () => {
    expect(hasFilterParams(q('filter[probeCount][gte]=3'))).toBe(true)
  })

  it('값이 비어 있어도 필터가 걸린 것이다', () => {
    // 필터 바에서 빈 값을 보내는 것은 백엔드가 판정할 일이고(스펙 8.1),
    // 화면 입장에서는 "사용자가 조건을 걸었다" 가 이미 참이다.
    expect(hasFilterParams(q('filter[probeMode]='))).toBe(true)
  })

  it('sort · include · page 는 필터가 아니다', () => {
    // 이 셋을 필터로 세면 정렬만 바꾼 빈 목록이 "조건에 맞는 것이 없다" 로
    // 잘못 그려진다.
    expect(hasFilterParams(q('sort=-probeCount&include=probeOwner&page[number]=2'))).toBe(false)
  })

  it('필터가 하나도 없으면 false 다', () => {
    expect(hasFilterParams(q(''))).toBe(false)
  })

  it('JSON:API 문법이 아닌 filter 유사 이름은 세지 않는다', () => {
    // toBackendQuery 가 이미 떨어뜨리는 모양이지만, 이 술어는 그것과 독립으로
    // 같은 문법을 봐야 한다 - 둘 중 하나만 고치는 일이 생기지 않게.
    expect(hasFilterParams(q('filter=probeOn&filters[probeMode]=probeOn'))).toBe(false)
  })
})

describe('isPagePositionParameter — 조건이 바뀌면 버려야 할 것', () => {
  it('offset 모드의 쪽 번호와 커서 둘이 위치다', () => {
    // 셋 다 "어떤 결과 집합의 몇 번째" 라, 그 집합이 달라지면 뜻을 잃는다.
    expect(isPagePositionParameter('page[number]')).toBe(true)
    expect(isPagePositionParameter('page[after]')).toBe(true)
    expect(isPagePositionParameter('page[before]')).toBe(true)
  })

  it('크기와 총계 표시는 위치가 아니다', () => {
    // 조건이 바뀌어도 "한 쪽에 몇 개" 와 "총계를 보여줄까" 는 그대로 뜻이 있다.
    expect(isPagePositionParameter('page[size]')).toBe(false)
    expect(isPagePositionParameter('page[totals]')).toBe(false)
  })

  it('page 가족이 아닌 것은 전부 아니다', () => {
    expect(isPagePositionParameter('sort')).toBe(false)
    expect(isPagePositionParameter('filter[probeMode]')).toBe(false)
    // page 계약에 없는 방언은 애초에 백엔드에 닿지 않는다(toBackendQuery).
    expect(isPagePositionParameter('page[offset]')).toBe(false)
    expect(isPagePositionParameter('pages[number]')).toBe(false)
  })
})

describe('isFilterParameter — 이 이름이 필터인가', () => {
  it('연산자가 있든 없든 필터다', () => {
    expect(isFilterParameter('filter[probeMode]')).toBe(true)
    expect(isFilterParameter('filter[probeCount][gte]')).toBe(true)
  })

  it('모르는 연산자도 필터다 - 판정 근거가 문법이지 정책이 아니다', () => {
    // "필터 지우기" 가 이 술어를 쓴다. 여기서 false 를 내면 바가 그릴 수 없는
    // 필터가 지우기를 눌러도 남고, 그것을 없앨 컨트롤이 화면에 하나도 없다.
    expect(isFilterParameter('filter[probeMode][bogus]')).toBe(true)
  })

  it('필터가 아닌 것과 필터를 닮은 이름은 아니다', () => {
    expect(isFilterParameter('sort')).toBe(false)
    expect(isFilterParameter('page[number]')).toBe(false)
    expect(isFilterParameter('filter')).toBe(false)
    expect(isFilterParameter('filters[probeMode]')).toBe(false)
  })

  it('hasFilterParams 와 같은 문법을 본다', () => {
    // 둘 중 하나만 고치는 일을 막는다 - 한쪽은 "빈 표의 문구", 다른 쪽은
    // "지우기가 무엇을 지우는가" 를 정하는데 근거가 같아야 한다.
    for (const name of [
      'filter[probeMode]',
      'filter[probeCount][gte]',
      'filter[probeMode][bogus]',
      'sort',
      'page[number]',
      'filters[probeMode]',
    ]) {
      expect(isFilterParameter(name)).toBe(hasFilterParams(q(`${encodeURIComponent(name)}=x`)))
    }
  })
})

describe('isPageParameter — 이 이름이 page 가족인가', () => {
  it('계약이 아는 다섯 키가 전부 참이다', () => {
    // 백엔드 링크의 page 조각을 화면 URL 로 옮길 때, 옛 값을 이 술어로 먼저
    // 버린다. 하나라도 빠지면 같은 파라미터가 두 번 나가서 400 이다.
    for (const key of ['number', 'size', 'totals', 'after', 'before'] as const) {
      expect(isPageParameter(pageParameter(key))).toBe(true)
    }
  })

  it('모르는 page 키와 page 를 닮은 이름은 아니다', () => {
    expect(isPageParameter('page[offset]')).toBe(false)
    expect(isPageParameter('page')).toBe(false)
    expect(isPageParameter('pages[number]')).toBe(false)
    expect(isPageParameter('sort')).toBe(false)
  })

  it('위치 파라미터는 전부 page 파라미터이기도 하다', () => {
    // 반대는 아니다 - size·totals 는 page 이지만 위치가 아니다. 두 술어가
    // 갈라지면 정렬을 바꿀 때 버릴 것을 잘못 고른다.
    for (const name of ['page[number]', 'page[after]', 'page[before]']) {
      expect(isPagePositionParameter(name)).toBe(true)
      expect(isPageParameter(name)).toBe(true)
    }
    expect(isPageParameter('page[size]')).toBe(true)
    expect(isPagePositionParameter('page[size]')).toBe(false)
  })
})

describe('pageParameter — page 파라미터 하나의 이름', () => {
  it('buildQuery 가 내는 이름과 같다', () => {
    // 만드는 쪽(buildQuery)과 링크에서 읽는 쪽(lib/resources/view.ts)이 같은
    // 규칙을 써야 한다. 갈라지면 이동 버튼이 켜져 있는데 눌러도 같은 쪽에
    // 머문다 - 오류가 아니라 **아무 일도 안 일어나는** 모양이다.
    const out = buildQuery({
      page: { number: 3, size: 7, totals: true, after: 'probe-after', before: 'probe-before' },
    })
    expect([...out.keys()].sort()).toEqual(
      (['number', 'size', 'totals', 'after', 'before'] as const).map(pageParameter).sort(),
    )
  })
})

describe('filterParameter — 필터 하나의 파라미터 이름', () => {
  it('exact 만 연산자 세그먼트를 생략한다', () => {
    // R-6: `filter[f]=v` 와 `filter[f][exact]=v` 를 백엔드가 같게 읽는다.
    expect(filterParameter('probeMode', 'exact')).toBe('filter[probeMode]')
  })

  it('나머지 연산자는 세그먼트를 붙인다', () => {
    expect(filterParameter('probeMode', 'contains')).toBe('filter[probeMode][contains]')
    expect(filterParameter('probeCount', 'gte')).toBe('filter[probeCount][gte]')
    expect(filterParameter('probeMode', 'in')).toBe('filter[probeMode][in]')
    expect(filterParameter('probeOwner.id', 'isNull')).toBe('filter[probeOwner.id][isNull]')
  })

  it('buildQuery 가 내는 이름과 같다', () => {
    // 이름 규칙이 두 벌이 되면, URL 을 만드는 쪽과 되읽는 쪽이 갈라져서
    // 옛 값이 지워지지 않고 쌓이고 - 같은 필드+같은 연산자 중복은 400 이다.
    //
    // **`isNull` 을 이 루프에서 뺐다**(리뷰 라운드 1). 한 루프로 모든 연산자를
    // 돌면 값 하나를 모든 갈래에 쓰게 되는데, `isNull` 은 값의 **타입**이 다른
    // 유일한 연산자라 그 루프가 `isNull` 을 문자열로 부르는 유일한 자리가
    // 됐다. 지금은 `FilterInput` 이 그것을 컴파일에서 막는다 - 이 루프가
    // 타입 오류로 걸린 것이 그 고침의 첫 신호였다.
    for (const operator of ['exact', 'contains', 'gte', 'in'] as const) {
      const query = buildQuery({ filters: [{ name: 'probeMode', operator, value: 'probe-on' }] })
      expect([...query.keys()]).toEqual([filterParameter('probeMode', operator)])
    }
  })

  it('isNull 도 같은 이름 규칙을 쓴다 - 값의 타입만 다르다', () => {
    const query = buildQuery({ filters: [{ name: 'probeMode', operator: 'isNull', value: false }] })
    expect([...query.keys()]).toEqual([filterParameter('probeMode', 'isNull')])
  })

  it('isNull 에 문자열을 넘기는 것을 타입이 막는다', () => {
    // **이 줄이 통과하면(= 오류가 없으면) `@ts-expect-error` 자체가 컴파일
    // 오류가 된다.** 즉 이 테스트는 실행이 아니라 typecheck 로 지켜진다.
    //
    // 막는 이유: 폼이 주는 문자열 `'false'` 는 JS 에서 truthy 라
    // `serializeFilterValue` 의 검사를 뒤집어 `isNull=true` 를 낸다. 그러면
    // "값 있음" 을 고른 사람이 값이 **없는** 행을 보고, 문법상 유효한 값이라
    // **200 이라 배너도 뜨지 않는다.** 실제로 한 번 들어왔던 결함이다.
    const bad = buildQuery({
      // @ts-expect-error isNull 의 value 는 boolean 이다
      filters: [{ name: 'probeMode', operator: 'isNull', value: 'false' }],
    })
    // 런타임 동작까지 적어 둔다 - 타입이 없다면 이 값이 나갔을 것이다.
    expect(bad.get('filter[probeMode][isNull]')).toBe('true')
  })
})

describe('canonicalFilterParameter — 중복 판정 키로 접는다', () => {
  it('exact 의 두 이름이 한 이름으로 접힌다', () => {
    // 백엔드는 `filter[f]` 와 `filter[f][exact]` 를 같은 필터로 읽고(R-6),
    // 중복을 세는 단위가 (필드, 연산자)라 둘이 함께 나가면 400 이다.
    expect(canonicalFilterParameter('filter[probeMode][exact]')).toBe('filter[probeMode]')
    expect(canonicalFilterParameter('filter[probeMode]')).toBe('filter[probeMode]')
  })

  it('다른 연산자는 접히지 않는다 - 서로 다른 필터다', () => {
    expect(canonicalFilterParameter('filter[probeMode][contains]')).toBe(
      'filter[probeMode][contains]',
    )
    expect(canonicalFilterParameter('filter[probeMode][contains]')).not.toBe(
      canonicalFilterParameter('filter[probeMode]'),
    )
  })

  it('모르는 연산자는 그대로 둔다', () => {
    // 화면이 만들 수 있는 이름이 아니므로 소유일 수 없다. 스펙 8.1 대로
    // 백엔드까지 가서 판정받아야 한다.
    expect(canonicalFilterParameter('filter[probeMode][probeNever]')).toBe(
      'filter[probeMode][probeNever]',
    )
  })

  it('필터가 아닌 이름은 그대로 둔다', () => {
    expect(canonicalFilterParameter('sort')).toBe('sort')
    expect(canonicalFilterParameter('page[number]')).toBe('page[number]')
    expect(canonicalFilterParameter('utm_source')).toBe('utm_source')
  })
})
