import { defineResource } from './define'

/**
 * `examples` - 이 템플릿의 주 자원.
 *
 * 아래 값은 전부 정본 FastAPI 를 띄워 실측한 계약(R-1·R-2·R-3·R-4)을 손으로
 * 옮긴 것이다. 어긋나면 D5 의 계약 거울 테스트(스펙 10.2)가 양방향으로 잡는다.
 *
 * ## 옮기면서 놓치기 쉬운 것
 *
 * - `id` 는 속성이 아니다(UUID, JSON:API 문서의 `data.id`).
 * - `categoryId` 도 속성이 아니다. FK 는 `category` 관계로만 노출되고, 필터로는
 *   `category.id` 라는 이름으로 나온다.
 * - `updatedAt` 은 **정렬만** 되고 필터는 안 된다. `sorts` 에는 있고 `filters`
 *   에는 없는 것이 오타가 아니라 계약이다.
 * - `description` 은 필터도 정렬도 안 된다. 검색은 `title` 만 된다.
 * - `sort=id` 는 400 이다. tie breaker(`id ASC`)는 백엔드가 자동으로 붙이지만
 *   공개 정렬 키가 아니므로 `sorts` 에 넣으면 안 된다.
 */
export const EXAMPLE = defineResource({
  type: 'examples',
  // `type` 에서 유도하지 않는다(R-1). 여기서는 우연히 닮았지만 참조 자원은 다르다.
  path: '/api/v1/examples',
  attributes: {
    title: {
      kind: 'string',
      label: '제목',
      readOnly: false,
      nullable: false,
      listed: true,
      minLength: 1,
      maxLength: 200,
    },
    // 백엔드 타입은 title 과 같은 string 이다. `text` 는 여러 줄로 그리라는
    // 프론트의 표시 결정이지 계약의 거울이 아니다.
    //
    // `listed: false` - 여러 줄 본문이라 표의 한 칸에 담기지 않는다. 상세
    // 화면(Task 6)과 폼(D4)이 그린다.
    description: { kind: 'text', label: '설명', readOnly: false, nullable: true, listed: false },
    status: {
      kind: 'enum',
      label: '상태',
      readOnly: false,
      nullable: false,
      listed: true,
      values: [
        { value: 'draft', label: '초안' },
        { value: 'active', label: '활성' },
        { value: 'archived', label: '보관' },
      ],
    },
    score: {
      kind: 'int',
      label: '점수',
      readOnly: false,
      nullable: false,
      listed: true,
      min: 0,
      max: 100,
    },
    createdAt: {
      kind: 'datetime',
      label: '생성',
      readOnly: true,
      nullable: false,
      listed: true,
    },
    // `listed: false` - `createdAt` 과 겹친다. 목록의 기본 정렬이 `-createdAt`
    // 이라 두 시각을 나란히 두면 열 하나가 정렬 축을 설명하고 다른 하나는
    // 아무것도 설명하지 않는다. "언제 고쳤나" 는 상세 화면의 질문이다.
    updatedAt: {
      kind: 'datetime',
      label: '수정',
      readOnly: true,
      nullable: false,
      listed: false,
    },
  },
  relationships: {
    // 비었을 때 `data: null` 이 온다(R-3).
    category: { cardinality: 'one', type: 'exampleCategories', label: '분류' },
    // 비었을 때 `data: []` 가 온다(R-3).
    tags: { cardinality: 'many', type: 'exampleTags', label: '태그' },
  },
  filters: {
    title: ['exact', 'contains'],
    status: ['exact', 'in'],
    score: ['exact', 'gt', 'gte', 'lt', 'lte', 'in'],
    // 속성이 아니라 관계에서 나온 필터 이름이다. `isNull` 이 "분류 없음" 을
    // 고르는 수단이라 세 연산자 중 이것만 다른 필터에 없다.
    'category.id': ['exact', 'in', 'isNull'],
    createdAt: ['exact', 'gt', 'gte', 'lt', 'lte'],
  },
  sorts: ['title', 'status', 'score', 'createdAt', 'updatedAt'],
  defaultSort: '-createdAt',
  // 이것은 "무엇을 include 할 수 있는가"(백엔드 정책의 거울)이지 "무엇을
  // 요청하는가"가 아니다. 요청은 화면이 buildQuery 에 넘긴다.
  //
  // 화면 쪽 규칙: 분류·라벨을 그리려면 반드시 include 를 실제로 걸어라.
  // 백엔드마다 빼먹었을 때의 증상이 다르다(2026-09-07 D3 Task 7 실측):
  //
  //   정본  : linkage(type·id)는 오지만 **이름은 included 에만 있다** →
  //           배지가 이름 대신 UUID 로 그려진다(눈에 보인다).
  //   NestJS: linkage 자체가 없고 resolveToOne 이 null 을 준다 →
  //           조용히 "분류 없음" 이 된다(안 보인다, R-10②).
  includes: ['category', 'tags'],
  // 쓰기 라우트가 있다(POST/PATCH/DELETE /api/v1/examples, 스펙 6.2). D4 의
  // 관계 선택기가 이 값을 읽고 "새로 만들기" 를 노출할지 정한다.
  writable: true,
})
