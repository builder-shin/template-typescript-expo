/**
 * 정본(FastAPI) main @ 6ee53a3 에서 2026-09-06 에 실제로 캡처한 응답 문서들.
 *
 * 손으로 지어낸 모양이 아니다. 계약이 바뀌면 이 파일을 다시 캡처해서 갱신한다.
 */

export const COLLECTION_EMPTY = {
  data: [],
  jsonapi: { version: '1.1' },
  links: {
    self: '/api/v1/examples?include=category%2Ctags&page%5Bnumber%5D=1&page%5Bsize%5D=2',
    first: '/api/v1/examples?include=category%2Ctags&page%5Bnumber%5D=1&page%5Bsize%5D=2',
    prev: null,
    next: null,
    last: null,
  },
  included: [],
} as const

export const SINGLE_CREATED = {
  data: {
    type: 'examples',
    id: '8ad713d2-d939-4417-a4c5-8cdfde71b316',
    attributes: {
      title: '캡처',
      description: null,
      status: 'active',
      score: 42,
      createdAt: '2026-09-05T20:10:39.659534+00:00',
      updatedAt: '2026-09-05T20:10:39.659534+00:00',
    },
    relationships: {
      category: {
        links: {
          self: '/api/v1/examples/8ad713d2-d939-4417-a4c5-8cdfde71b316/relationships/category',
          related: '/api/v1/examples/8ad713d2-d939-4417-a4c5-8cdfde71b316/category',
        },
        data: null,
      },
      tags: {
        data: [],
        links: {
          self: '/api/v1/examples/8ad713d2-d939-4417-a4c5-8cdfde71b316/relationships/tags',
          related: '/api/v1/examples/8ad713d2-d939-4417-a4c5-8cdfde71b316/tags',
        },
      },
    },
    links: { self: '/api/v1/examples/8ad713d2-d939-4417-a4c5-8cdfde71b316' },
  },
  jsonapi: { version: '1.1' },
} as const

export const ERROR_VALIDATION = {
  errors: [
    {
      status: '422',
      code: 'VALIDATION_ERROR',
      title: '유효하지 않은 요청',
      detail: '요청 값이 유효성 검사를 통과하지 못했습니다.',
      source: { pointer: '/data/attributes/title' },
    },
    {
      status: '422',
      code: 'VALIDATION_ERROR',
      title: '유효하지 않은 요청',
      detail: '요청 값이 유효성 검사를 통과하지 못했습니다.',
      source: { pointer: '/data/attributes/status' },
    },
    {
      status: '422',
      code: 'VALIDATION_ERROR',
      title: '유효하지 않은 요청',
      detail: '요청 값이 유효성 검사를 통과하지 못했습니다.',
      source: { pointer: '/data/attributes/score' },
    },
  ],
  jsonapi: { version: '1.1' },
} as const

export const ERROR_AUTHENTICATION_REQUIRED = {
  errors: [
    {
      status: '401',
      code: 'AUTHENTICATION_REQUIRED',
      title: '인증 필요',
      detail: '이 요청에는 인증이 필요합니다.',
      source: { header: 'Authorization' },
    },
  ],
  jsonapi: { version: '1.1' },
} as const

export const ERROR_INVALID_FILTER = {
  errors: [
    {
      status: '400',
      code: 'INVALID_FILTER',
      title: '유효하지 않은 필터',
      detail: '지원하지 않거나 잘못된 필터입니다.',
      source: { parameter: 'filter[nope]' },
    },
  ],
  jsonapi: { version: '1.1' },
} as const

/** source 키 자체가 없다 - 실측된 사실이다. */
export const ERROR_NOT_FOUND = {
  errors: [
    {
      status: '404',
      code: 'RESOURCE_NOT_FOUND',
      title: '리소스를 찾을 수 없음',
      detail: '요청한 리소스를 찾을 수 없습니다.',
    },
  ],
  jsonapi: { version: '1.1' },
} as const

/**
 * 실측이 아니다 - JSON:API 스펙은 최상위 문서에서 data 와 errors 가
 * 공존할 수 없다고 규정한다(스펙: "The members data and errors MUST NOT
 * coexist"). 그런데도 서버가 스펙을 어기고 이런 응답을 보내는 경우를 대비해
 * 판별 함수가 오류를 오류로, 컬렉션/단일 문서로 오판하지 않는지 검증하려고
 * 의도적으로 구성한 경계 사례다.
 *
 * 뮤테이션 테스트로 필요성이 드러났다: isCollectionDocument 에서
 * isErrorDocument 배제를 지워도 실측 픽스처만으로는 모든 테스트가 통과했다
 * - 실측 오류 문서에는 data 키 자체가 없어서 두 판별이 우연히 일치했기
 * 때문이다. 이 픽스처가 있어야 그 배제 로직이 실제로 검증된다.
 */
export const MIXED_ERROR_AND_DATA = {
  errors: [
    {
      status: '500',
      code: 'INTERNAL_ERROR',
      title: '서버 오류',
    },
  ],
  data: [],
  jsonapi: { version: '1.1' },
} as const

export const AUTH_TOKENS = {
  data: {
    type: 'authTokens',
    id: '0080ee3d-efa6-4ef1-aa52-fb4c232f68f3',
    attributes: {
      accessToken: 'header.payload.signature',
      refreshToken: 'header.payload.signature',
      tokenType: 'Bearer',
      expiresIn: 900,
      refreshExpiresIn: 2592000,
    },
  },
  jsonapi: { version: '1.1' },
} as const

/**
 * include=category,tags 로 관계가 채워진 컬렉션.
 *
 * 두 Example 이 같은 category 를 공유한다 - included 가 중복 없이 한 번만
 * 담긴다는 JSON:API 규칙을 이 픽스처가 담고 있다.
 */
export const COLLECTION_WITH_INCLUDED = {
  data: [
    {
      type: 'examples',
      id: 'e1',
      attributes: { title: '첫째', status: 'active', score: 10 },
      relationships: {
        category: { data: { type: 'exampleCategories', id: 'c1' } },
        tags: {
          data: [
            { type: 'exampleTags', id: 't1' },
            { type: 'exampleTags', id: 't2' },
          ],
        },
      },
    },
    {
      type: 'examples',
      id: 'e2',
      attributes: { title: '둘째', status: 'draft', score: 20 },
      relationships: {
        category: { data: { type: 'exampleCategories', id: 'c1' } },
        tags: { data: [] },
      },
    },
  ],
  included: [
    { type: 'exampleCategories', id: 'c1', attributes: { name: '분류 하나' } },
    { type: 'exampleTags', id: 't1', attributes: { name: '태그 하나' } },
    { type: 'exampleTags', id: 't2', attributes: { name: '태그 둘' } },
  ],
  jsonapi: { version: '1.1' },
  links: {
    self: '/api/v1/examples?include=category%2Ctags',
    first: null,
    prev: null,
    next: null,
    last: null,
  },
} as const
