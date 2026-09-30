/**
 * 자원 선언에서 계약 거울 프로브 목록을 만든다 (스펙 10.2 + 판정 1).
 *
 * `lib/resources/*.ts`의 `filters`·`sorts`는 백엔드 조회 정책을 손으로 옮긴
 * 거울이라 반드시 어긋난다(`define.ts` 머리말). 이 파일이 답하는 질문은
 * 하나뿐이다 - **"이 선언이 참이려면 백엔드에 무엇을 물어야 하는가"**. 답은
 * 순수하게 계산되는 요청 목록(`MirrorProbe[]`)이고, 그 요청을 실제로 보내
 * 응답을 판정하는 것은 이 파일의 일이 아니다.
 *
 * ## 이 파일이 하지 않는 것
 *
 * `lib/resources/` 전체 규칙 그대로 - **JSX 도 fetch 도 없다.** 프로브는
 * `{ label, path, query, expect }` 값일 뿐이고, 이것을 들고 실제로 백엔드를
 * 치는 것은 `test/e2e/mirror.spec.ts`(Task 2)다.
 *
 * **목록을 만드는 로직 자체가 검사의 강도를 정한다.** 연산자 하나를
 * 빼먹으면 그 검사는 소리 없이 약해지는데, 목록을 순수 함수로 떼어 두면
 * 단위 테스트(`test/unit/resources/mirror.test.ts`)가 그 로직 자체를 지킬
 * 수 있다 - `rotation.ts`↔`proxy.ts`, `view.ts`↔`page.tsx`와 같은 분리다.
 *
 * ## 양방향이다 - filter 도 sort 도
 *
 * 스펙 10.2 원문은 filter 만 양방향이다(선언된 (필드,연산자) → 2xx, 선언에
 * 없는 연산자 → `INVALID_FILTER`). sort 는 "선언된 것 → 2xx" 한 방향뿐이라
 * 백엔드가 sort 를 **여는** 회귀를 못 잡는다. 이 파일은 sort 축도 대칭으로
 * 넓힌다(계획서 §2 판정 1) - 고정된 이름(`MIRROR_ABSENT_SORT_FIELD`) 하나로
 * "선언에 없는 sort → `INVALID_SORT`"를 자원마다 하나씩 더한다. 근거:
 * `docs/superpowers/plans/2026-09-08-contract-lab-and-matrix.md` §2 판정 1.
 *
 * filter 축도 같은 이유로 **선언된 필드마다 `FILTER_OPERATORS`(전체 어휘)를
 * 전부 돈다** - 대표 연산자 하나만 시험하면 "이 연산자가 아니라 저 연산자를
 * 열었다"는 회귀를 놓친다. 그래서 이 파일이 `FILTER_OPERATORS`를 그대로
 * 소비한다(자원을 모르는 어휘 상수를 이 파일이 자원과 엮는 지점).
 *
 * ## 값은 왜 이렇게 골랐는가 - 전부 실측
 *
 * - **빈 필터 값은 절대 만들지 않는다.** 정본은 연산자와 무관하게 빈 필터
 *   값을 전부 400으로 거절한다(D3 실측, `filterQuery` 주석 - `lib/resources/view.ts`).
 *   빈 값을 쓰면 "선언된 조합은 2xx" 검사 자체가 성립할 수 없다.
 * - **enum은 선언의 첫 값**(`values[0].value`)을 쓴다. 없는 값을 넣으면 그
 *   자체로 400이 나서 검사가 무의미해진다.
 * - **datetime은 UTC 오프셋을 붙인다**(`+00:00`). 정본이 오프셋 없는 값을
 *   거절한다(실측).
 * - **관계 필터는 UUID 하나면 충분하다.** 없는 id여도 된다 - 0건 200이지
 *   오류가 아니다.
 * - **`isNull`은 `boolean`, `in`은 값 둘.** `lib/jsonapi/query.ts`의
 *   `FilterInput` 타입이 `isNull`에 문자열이 들어오는 것 자체를 컴파일에서
 *   막는다 - 그 타입을 그대로 재사용한다(아래 `filterInputFor`). `in`은
 *   쉼표로 이어질 값이 둘 필요해서 같은 값을 두 번 쓴다 - 중복된 `in` 값도
 *   문법상 유효해 여전히 2xx다.
 *
 * ## 프로브 값과 프로덕션 상수는 절대 겹치지 않는다
 *
 * 아래 `MIRROR_*` 상수는 **어느 자원의 실제 값과도 우연히 겹치지 않는, 뜻
 * 없는 값**이다. `test/unit/resources/mirror.test.ts`의 `probe*` 픽스처도
 * 같은 원칙을 진다 - 겹치면 "계산했다"와 "베꼈다"가 구별되지 않는다.
 */

import {
  buildQuery,
  filterParameter,
  formatSortToken,
  FILTER_OPERATORS,
  SORT_PARAMETER,
  type FilterInput,
  type FilterOperator,
  type SortTerm,
} from '@/lib/jsonapi/query'
import type { AttributeDefinition, ResourceDefinition } from './define'

/** 문자열류(`string`·`text`) 필터 값. 존재만 확인하면 되므로 뜻은 없다. */
const MIRROR_STRING_VALUE = 'contract-mirror-probe'

/** 정수 필터 값. `min`·`max` 범위를 벗어나도 상관없다 - 0건 200이지 오류가 아니다. */
const MIRROR_INT_VALUE = '1'

/** datetime 필터 값. 정본은 UTC 오프셋 없는 값을 거절한다(실측) - 반드시 붙인다. */
const MIRROR_DATETIME_VALUE = '2020-01-01T00:00:00+00:00'

/** 관계 필터(`{관계}.id`) 값. 없는 id여도 된다 - 0건 200이지 오류가 아니다. */
const MIRROR_RELATIONSHIP_ID_VALUE = '00000000-0000-0000-0000-000000000000'

/**
 * "선언에 없는 sort"를 확인하는 데 쓰는 고정 이름.
 *
 * **자원의 실제 필드에서 유도하지 않는다.** 유도하면(예: 선언된 필드 이름을
 * 문자열 조작으로 바꾸면) 그 이름이 어느 날 실제로 `sorts`에 들어가는 순간
 * 이 프로브가 조용히 거짓 통과가 된다 - 고정된 이름은 그럴 수 없다.
 */
const MIRROR_ABSENT_SORT_FIELD = 'mirrorAbsentSortField'

/** 필터 필드 이름에서 관계 이름을 뽑는다. `{관계}.id` 문법(`define.ts`의 `QueryField`)과 같은 접미사다. */
const RELATIONSHIP_ID_SUFFIX = '.id'

/**
 * 거울 프로브 하나 - "이 요청을 보내면 이런 응답을 기대한다".
 *
 * `mirror.ts`가 만들기만 하고 부르지 않는 값이다. 실제로 이 요청을 보내
 * `expect`와 대조하는 것은 `test/e2e/mirror.spec.ts`(Task 2)다.
 */
export interface MirrorProbe {
  /**
   * 사람이 읽는 이름. 실패 메시지가 이것으로 무엇이 어긋났는지 말한다.
   *
   * **`resource.type`으로 시작한다**(Task 1 리뷰 Important-1) - 참조 자원
   * 둘(`exampleCategories`·`exampleTags`)은 `filters`·`sorts`가 글자
   * 하나 다르지 않게 같아서(`category.ts`·`tag.ts` 머리말), type 없이는
   * `RESOURCES` 전체에서 13개 라벨이 바이트 단위로 겹친다 - `sort
   * createdAt`·`sort -createdAt`·`sort mirrorAbsentSortField` 셋은
   * `examples`까지 포함해 세 자원 전부에서 겹친다. `RESOURCES`를 도는
   * `mirrorProbes` 소비자(`test/e2e/mirror.spec.ts`)가 "77개 중 어느
   * 프로브가 죽었는지"를 라벨 하나로 식별하려면 그 라벨이 전역에서
   * 유일해야 한다 - `test/unit/resources/mirror.test.ts`의
   * "`RESOURCES` 전체에서 라벨이 겹치지 않는다" 테스트가 그 유일성을 지킨다.
   */
  readonly label: string
  readonly path: string
  readonly query: URLSearchParams
  /** 이 요청에 기대하는 것. */
  readonly expect:
    { kind: 'ok' } | { kind: 'error'; code: 'INVALID_FILTER' | 'INVALID_SORT'; parameter: string }
}

/**
 * 이 속성의 `kind`에 맞는 필터 값 하나.
 *
 * enum은 선언의 첫 값을 그대로 쓴다 - 없는 값을 쓰면 그 자체로 400이 나서
 * "선언된 조합은 2xx" 검사가 무의미해진다. 그 값이 비어 있으면(실제 선언에서는
 * `test/unit/resources/invariants.ts`의 `enum-values-empty`가 막지만, 이
 * 함수는 임의의 픽스처에도 열려 있어 타입만으로는 보장되지 않는다)
 * `undefined`를 돌려주고, 호출부가 그 필드를 건너뛴다.
 */
function probeValueForAttribute(attribute: AttributeDefinition): string | undefined {
  if (attribute.kind === 'string' || attribute.kind === 'text') return MIRROR_STRING_VALUE
  if (attribute.kind === 'int') return MIRROR_INT_VALUE
  if (attribute.kind === 'datetime') return MIRROR_DATETIME_VALUE
  return attribute.values[0]?.value
}

/**
 * 필터 필드 이름 하나에 대해 값 하나를 만든다.
 *
 * 필드 이름은 `QueryField`의 세 갈래 중 하나다(`define.ts`) - 이 함수도 같은
 * 세 갈래로 나눈다.
 *
 * 1. `` `${관계}.id` `` - 관계 선언에 실제로 있으면 UUID.
 * 2. 선언된 속성 - `kind`로 값을 정한다(`probeValueForAttribute`).
 * 3. `queryOnlyFields` - 속성이 없으므로 `kind`를 알 수 없다. 오늘 세 자원
 *    다 이 갈래를 정렬에만 쓰고 필터에는 안 쓰지만, 타입은 필터 키로도
 *    허용하므로(`ResourceInput.filters`) 문자열로 물러선다.
 */
function probeValueForField(resource: ResourceDefinition, field: string): string | undefined {
  if (field.endsWith(RELATIONSHIP_ID_SUFFIX)) {
    const relationshipName = field.slice(0, -RELATIONSHIP_ID_SUFFIX.length)
    if (resource.relationships[relationshipName] !== undefined) {
      return MIRROR_RELATIONSHIP_ID_VALUE
    }
  }
  const attribute = resource.attributes[field]
  if (attribute !== undefined) return probeValueForAttribute(attribute)
  return MIRROR_STRING_VALUE
}

/**
 * 연산자에 맞는 `FilterInput` 하나.
 *
 * `isNull`은 값이 `boolean`이다 - `FilterInput`의 타입 자체가 그렇게 가른다
 * (`lib/jsonapi/query.ts`의 `FilterInput` 주석, D3 Task 4의 결함 재발
 * 방지). `in`은 쉼표로 이어질 값이 둘 필요하다 - 같은 값을 두 번 쓴다.
 * 중복된 `in` 값도 문법상 유효하고 여전히 2xx다: 이 함수가 확인하는 것은
 * "이 연산자가 문법대로 값을 받는가"이지 "그 값들이 서로 다른가"가 아니다.
 */
function filterInputFor(name: string, operator: FilterOperator, value: string): FilterInput {
  if (operator === 'isNull') return { name, operator, value: true }
  if (operator === 'in') return { name, operator, value: [value, value] }
  return { name, operator, value }
}

/**
 * 이 자원의 `filters`가 요구하는 프로브 전부.
 *
 * `FILTER_OPERATORS`(전체 어휘)를 필터 필드마다 전부 돈다 - 선언에 있으면
 * 2xx, 없으면 `INVALID_FILTER`다. **한쪽만 재면 거울의 절반만 지킨다**(스펙
 * 10.2: "백엔드가 연산자를 닫아도 열어도 드러난다"). `parameter`는
 * `filterParameter`(`lib/jsonapi/query.ts`)가 만드는 것과 **같은 문자열**을
 * 쓴다 - 백엔드가 실제로 내는 `source.parameter`가 그 문자열이기
 * 때문이다(R-8, D3 실측).
 *
 * 값을 만들 수 없는 필드(`probeValueForField`가 `undefined`)는 통째로
 * 건너뛴다 - 값이 없으면 어느 연산자로도 유효한 요청을 만들 수 없다.
 */
function filterProbesOf(resource: ResourceDefinition): MirrorProbe[] {
  const probes: MirrorProbe[] = []
  for (const [field, operators] of Object.entries(resource.filters)) {
    const value = probeValueForField(resource, field)
    if (value === undefined) continue
    for (const operator of FILTER_OPERATORS) {
      const query = buildQuery({ filters: [filterInputFor(field, operator, value)] })
      const declared = operators.includes(operator)
      probes.push({
        label: `${resource.type} filter ${field} ${operator}`,
        path: resource.path,
        query,
        expect: declared
          ? { kind: 'ok' }
          : { kind: 'error', code: 'INVALID_FILTER', parameter: filterParameter(field, operator) },
      })
    }
  }
  return probes
}

/**
 * 이 자원의 `sorts`가 요구하는 프로브 전부, 그리고 "선언에 없는 sort" 하나.
 *
 * 대칭을 넓힌 근거는 이 파일 머리말 및 계획서 §2 판정 1 - 고정 이름
 * `MIRROR_ABSENT_SORT_FIELD` 하나로 자원마다 "선언에 없는 sort →
 * `INVALID_SORT`"를 더한다.
 */
function sortProbesOf(resource: ResourceDefinition): MirrorProbe[] {
  const probes: MirrorProbe[] = []
  for (const field of resource.sorts) {
    for (const descending of [false, true]) {
      const term: SortTerm = { name: field, descending }
      probes.push({
        label: `${resource.type} sort ${formatSortToken(term)}`,
        path: resource.path,
        query: buildQuery({ sort: [term] }),
        expect: { kind: 'ok' },
      })
    }
  }
  probes.push({
    label: `${resource.type} sort ${MIRROR_ABSENT_SORT_FIELD}`,
    path: resource.path,
    query: buildQuery({ sort: [{ name: MIRROR_ABSENT_SORT_FIELD, descending: false }] }),
    expect: { kind: 'error', code: 'INVALID_SORT', parameter: SORT_PARAMETER },
  })
  return probes
}

/**
 * 이 선언이 참이려면 백엔드에 물어야 하는 요청 전부.
 *
 * filter 축(`filterProbesOf`)과 sort 축(`sortProbesOf`)을 이어 붙인 것뿐이다
 * - 둘을 섞거나 걸러내지 않는다. 소비자(`test/e2e/mirror.spec.ts`)가
 * `expect.kind`·`expect.code`로 원하는 부분집합을 골라 쓴다.
 */
export function mirrorProbes(resource: ResourceDefinition): readonly MirrorProbe[] {
  return [...filterProbesOf(resource), ...sortProbesOf(resource)]
}

/**
 * 이 자원이 응답 문서의 `data[].attributes`에서 노출하기로 선언한 이름의
 * 집합. 계획서 §2 판정 2 - 응답의 실제 키 집합과 대조하는 쪽은 Task 2다.
 *
 * `queryOnlyFields`는 넣지 않는다 - 그 필드가 `queryOnlyFields`인 이유
 * 자체가 "정렬은 되는데 속성으로는 노출되지 않는다"이다(`define.ts`의
 * `QueryField` 주석). 넣으면 이 대조가 항상 실패한다.
 */
export function attributeKeys(resource: ResourceDefinition): readonly string[] {
  return Object.keys(resource.attributes)
}
