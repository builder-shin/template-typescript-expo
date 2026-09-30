import { defineResource } from './define'

/**
 * `exampleTags` - Example 의 라벨(참조 자원).
 *
 * 값은 실측 계약 R-1·R-5 를 손으로 옮긴 것이다. 정책은 `exampleCategories` 와
 * 완전히 같고, 그런데도 따로 선언하는 이유는 `category.ts` 의 머리말에 있다.
 *
 * 참조 자원의 성질 넷(기본 정렬 `name` · include 빈 집합 · `createdAt` 은
 * 정렬 키이나 속성 아님 · 쓰기 라우트 없음)도 `category.ts` 와 같다.
 */
export const EXAMPLE_TAG = defineResource({
  type: 'exampleTags',
  // `type` 에서 유도할 수 없는 자리다(R-1). 경로에는 `example` 이 없다.
  path: '/api/v1/tags',
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
  // POST /api/v1/tags → 405 HTTP_ERROR, allow: GET.
  writable: false,
})
