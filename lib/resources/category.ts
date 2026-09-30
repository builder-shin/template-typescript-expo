import { defineResource } from './define'

/**
 * `exampleCategories` - Example 의 분류(참조 자원).
 *
 * 값은 실측 계약 R-1·R-5 를 손으로 옮긴 것이다.
 *
 * ## `tag.ts` 와 정책이 완전히 같은데도 따로 선언한다
 *
 * 지금은 `type` 과 `path` 와 라벨 말고는 글자 하나 다르지 않다. 그래도 공통
 * 팩토리로 묶지 않는다(스펙 5.1: 자원마다 파일 하나). 묶으면 둘 중 하나만
 * 정책이 바뀌는 날 "갈라지는 자리" 자체가 사라져서, 갈라짐을 표현하려면 먼저
 * 팩토리를 해체해야 한다. 중복은 지금 눈에 보이지만 그 해체는 보이지 않는다.
 *
 * ## 참조 자원이 주 자원과 다른 점 넷
 *
 * - **기본 정렬이 `name`** 이다. `-createdAt` 이 아니다.
 * - **include 가 빈 집합**이다. `?include=` 를 붙이는 것 자체가 400 이다.
 *   관계를 선언하지 않았으므로 타입이 `[]` 외의 것을 애초에 막는다.
 * - **`createdAt` 은 정렬 키인데 속성이 아니다.** 정렬은 되는데 값을 받을 수
 *   없어서 `queryOnlyFields` 로 들어간다 - 속성으로 선언하면 목록이 언제나
 *   비어 있는 열을 그린다.
 * - **쓰기 라우트가 없다.** 속성 단위의 `readOnly`(서버가 만드는 값인가)와는
 *   다른 층위라 자원 단위의 표시가 따로 필요했고(스펙 6.4), `writable: false`
 *   가 그 자리다(D4 Task 1). `name.readOnly` 는 여전히 `false` 다 - `name`
 *   자체는 서버 생성 값이 아니기 때문이다(속성은 쓰기 가능해 보여도 자원에
 *   쓰기 라우트가 없다).
 */
export const EXAMPLE_CATEGORY = defineResource({
  type: 'exampleCategories',
  // `type` 에서 유도할 수 없는 자리다(R-1). 경로에는 `example` 이 없다.
  path: '/api/v1/categories',
  attributes: {
    // maxLength 는 정본 모델의 String(200) 이다(app/models/example_category.py:28 ·
    // example_tag.py:28 — 이 저장소에서 직접 판독). 계획서 R-5 는 제약을 적지
    // 않았지만 거울은 완전한 편이 낫다. 쓰기 라우트가 없어(R-5) 오늘 이 값을
    // 읽는 폼은 없다 - D4 가 쓰기를 만들 때 첫 소비자가 된다.
    // `listed: true` - 이 자원의 유일한 속성이다. 목록에서 빼면 그릴 것이
    // 하나도 남지 않는다.
    name: {
      kind: 'string',
      label: '이름',
      readOnly: false,
      nullable: false,
      listed: true,
      maxLength: 200,
    },
  },
  relationships: {},
  queryOnlyFields: ['createdAt'],
  filters: {
    name: ['exact', 'contains'],
  },
  sorts: ['name', 'createdAt'],
  defaultSort: 'name',
  includes: [],
  // 스펙 6.2 가 이 자원에 쓰기 라우트를 만들지 않기로 했다. 실측:
  // POST /api/v1/categories → 405 HTTP_ERROR, allow: GET.
  writable: false,
})
