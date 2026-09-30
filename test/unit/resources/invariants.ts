/**
 * 자원 선언의 구조적 불변식.
 *
 * `define.test.ts` 가 **임의의 픽스처**로 이 검사기들이 실제로 무엇을 거절하는지
 * 재고, `resources.test.ts` 가 **실제 선언**에 적용한다. 순서가 중요하다 -
 * 실제 선언에만 적용하면 통과가 "규칙이 살아 있다"가 아니라 "지금 값이 그렇다"
 * 를 뜻하게 된다. 검사기가 통째로 비어 있어도 똑같이 초록이기 때문이다.
 *
 * 이 검사기가 프로덕션 코드가 아닌 이유는 `defineResource` 가 런타임 검증을
 * 두지 않는 이유와 같다(`lib/resources/define.ts` 참고) - 선언은 전부 정적이라
 * 잘못된 선언은 코드가 도는 순간이 아니라 게이트에서 잡혀야 한다.
 *
 * 여기 있는 규칙 중 여럿은 `ResourceInput` 의 타입이 이미 막는다. 겹침은
 * 낭비가 아니다 - 타입은 나중에 넓어질 수 있고(새 자원이 캐스트를 쓰거나
 * 선언 형태가 느슨해지면) 넓어지는 순간 남는 것은 이 검사뿐이다.
 */

import { FILTER_OPERATORS, parseSortToken } from '@/lib/jsonapi/query'
import { formAttributes, type ResourceDefinition } from '@/lib/resources/define'

export type ViolationRule =
  | 'type-empty'
  | 'path-shape'
  | 'enum-values-empty'
  | 'enum-values-duplicate'
  | 'enum-label-empty'
  | 'enum-label-duplicate'
  | 'listed-empty'
  | 'query-only-overlaps-attribute'
  | 'attribute-relationship-name-clash'
  | 'filter-key'
  | 'filter-operator'
  | 'filter-operator-empty'
  | 'filter-operator-duplicate'
  | 'sort-key'
  | 'sort-duplicate'
  | 'default-sort'
  | 'include-name'
  | 'include-duplicate'
  | 'writable-form-fields'
  | 'duplicate-type'
  | 'duplicate-path'
  | 'relationship-type'

export interface Violation {
  rule: ViolationRule
  message: string
}

/** 실패 메시지를 읽을 만하게 만드는 것과, 규칙을 집합으로 비교하는 것 둘 다 쓴다. */
export function rulesOf(violations: readonly Violation[]): ViolationRule[] {
  return violations.map((violation) => violation.rule)
}

/**
 * 이 자원의 조회(필터·정렬)에 쓸 수 있는 필드 이름 전부.
 *
 * `lib/resources/define.ts` 의 `QueryField` 타입과 **같은 규칙을 런타임에서**
 * 다시 쓴 것이다. 셋을 합친다: 속성 이름 · `queryOnlyFields` · 관계마다
 * `` `${이름}.id` ``.
 */
export function queryVocabulary(resource: ResourceDefinition): ReadonlySet<string> {
  const names = new Set<string>(Object.keys(resource.attributes))
  for (const name of resource.queryOnlyFields) names.add(name)
  for (const name of Object.keys(resource.relationships)) names.add(`${name}.id`)
  return names
}

function duplicatesOf(values: readonly string[]): string[] {
  const seen = new Set<string>()
  const repeated = new Set<string>()
  for (const value of values) {
    if (seen.has(value)) repeated.add(value)
    seen.add(value)
  }
  return [...repeated]
}

/** 한 자원 안에서 닫히는 불변식. 다른 자원을 알 필요가 없는 것만 여기 있다. */
export function checkResource(resource: ResourceDefinition): Violation[] {
  const violations: Violation[] = []
  const at = `${resource.type || '(type 없음)'}`

  if (resource.type.length === 0) {
    violations.push({ rule: 'type-empty', message: `${resource.path}: type 이 비어 있다` })
  }

  // `path` 의 값이 백엔드와 맞는지는 여기서 알 수 없다(살아 있는 백엔드만 안다).
  // 여기서 잴 수 있는 것은 요청 경로로 쓸 수 있는 모양인가뿐이다.
  if (!resource.path.startsWith('/')) {
    violations.push({ rule: 'path-shape', message: `${at}: path 가 '/' 로 시작하지 않는다` })
  }

  // 값이 하나도 없는 enum 은 enum 이 아니다 - `filter-operator-empty` 와 같은
  // 논리다. 타입은 `values` 가 **있는지**만 보므로 `[]` 를 막지 못한다. 그대로
  // 두면 폼·필터 바가 옵션 없는 <select> 를 그리고, 필수 필드를 채울 수 없는데
  // 화면에는 아무 오류도 없다. 중복은 같은 옵션이 두 번 그려지는 자리다 -
  // `value` 로만 잰다(`EnumValue`, D4 Task 1) - 라벨이 갈라도 백엔드에는 같은
  // 값 둘로 보인다.
  for (const [name, attribute] of Object.entries(resource.attributes)) {
    if (attribute.kind !== 'enum') continue
    if (attribute.values.length === 0) {
      violations.push({
        rule: 'enum-values-empty',
        message: `${at}: enum 속성 '${name}' 에 값이 하나도 없다`,
      })
    }
    for (const repeated of duplicatesOf(attribute.values.map((entry) => entry.value))) {
      violations.push({
        rule: 'enum-values-duplicate',
        message: `${at}: enum 속성 '${name}' 에 값 '${repeated}' 가 두 번 있다`,
      })
    }
    // 빈 라벨은 화면에 빈 <option> 을 그린다 - 값은 있는데 사람이 읽을 것이
    // 없다.
    for (const entry of attribute.values) {
      if (entry.label.length === 0) {
        violations.push({
          rule: 'enum-label-empty',
          message: `${at}: enum 속성 '${name}' 의 값 '${entry.value}' 에 라벨이 없다`,
        })
      }
    }

    // 값은 서로 다른데 라벨이 같으면 <select> 에 구분 안 되는 옵션 둘이
    // 뜬다(D4 Task 3, components/resource/resource-form.tsx 가 이 <select>
    // 를 그린다) - 사용자는 화면만 보고 어느 것을 골랐는지 알 수 없다.
    // enum-values-duplicate 와 독립인 검사다 - 값이 같은 자리는 이미 그
    // 규칙이 잡으므로, 여기서는 값이 달라도 라벨이 겹치는 자리만 새로
    // 잡는다.
    for (const repeated of duplicatesOf(attribute.values.map((entry) => entry.label))) {
      violations.push({
        rule: 'enum-label-duplicate',
        message: `${at}: enum 속성 '${name}' 의 라벨 '${repeated}' 이 서로 다른 값에 두 번 쓰였다`,
      })
    }
  }

  // `listed` 가 하나도 없으면 목록 화면이 열 없는 표를 그린다 - 행이 몇 건
  // 오든 화면에는 아무것도 없다. `enum-values-empty` 와 같은 종류의 결함이다:
  // 타입은 각 속성의 `listed` 가 boolean 인지만 보고, "적어도 하나" 는 보지
  // 못한다. 관계만으로 표를 그리는 자원은 이 저장소의 계약에 없다 - 있게
  // 되면 그때 이 규칙을 다시 판단해라.
  if (Object.values(resource.attributes).every((attribute) => !attribute.listed)) {
    violations.push({
      rule: 'listed-empty',
      message: `${at}: 목록에 그릴 속성(listed)이 하나도 없다`,
    })
  }

  // writable 인데 폼이 그릴 속성이 하나도 없으면(전 속성이 readOnly) 쓸 수
  // 있다고 말해 놓고 쓸 칸을 하나도 못 만드는 선언이다 - `listed-empty` 와
  // 같은 종류의 결함이다.
  if (resource.writable && formAttributes(resource).length === 0) {
    violations.push({
      rule: 'writable-form-fields',
      message: `${at}: writable 인데 폼이 그릴 속성(readOnly 아닌 것)이 하나도 없다`,
    })
  }

  const attributeNames = new Set(Object.keys(resource.attributes))
  for (const name of resource.queryOnlyFields) {
    if (attributeNames.has(name)) {
      violations.push({
        rule: 'query-only-overlaps-attribute',
        message: `${at}: '${name}' 이 속성이면서 queryOnlyFields 에도 있다`,
      })
    }
  }

  // 속성 이름과 관계 이름이 겹치면 **폼의 DOM id 가 중복된다.**
  // `AttributeField`(components/resource/resource-form.tsx)와
  // `RelationshipPicker`(components/resource/relationship-picker.tsx)가 둘 다
  // `id={name}` · `${name}-error` 를 쓰기 때문이다(각각 D4 Task 3·Task 4 -
  // 두 부품이 서로를 모른 채 같은 규칙을 골랐다). 겹치면 `aria-describedby`
  // 가 첫 요소만 가리켜 한쪽 오류가 스크린리더에서 사라지고,
  // `document.getElementById` 도 하나만 찾는다.
  //
  // **`FormData` 도 갈린다**: `readFormValues` 가 같은 이름을 속성으로 한 번,
  // 관계로 한 번 읽어(`stringValue` 와 `toManyIds`) 서로 다른 뜻으로 해석한다.
  // 화면에는 아무 오류도 없다 - `query-only-overlaps-attribute` 와 같은
  // 종류의, 이름 공간이 겹쳐서 나는 결함이다.
  const relationshipKeys = Object.keys(resource.relationships)
  for (const name of relationshipKeys) {
    if (attributeNames.has(name)) {
      violations.push({
        rule: 'attribute-relationship-name-clash',
        message: `${at}: '${name}' 이 속성이면서 관계 이름이기도 하다 - 폼의 DOM id 가 중복된다`,
      })
    }
  }

  const vocabulary = queryVocabulary(resource)
  const operators = new Set<string>(FILTER_OPERATORS)

  for (const [name, allowed] of Object.entries(resource.filters)) {
    if (!vocabulary.has(name)) {
      violations.push({
        rule: 'filter-key',
        message: `${at}: 필터 '${name}' 이 속성·queryOnlyFields·관계 어디에도 없다`,
      })
    }
    if (allowed.length === 0) {
      violations.push({
        rule: 'filter-operator-empty',
        message: `${at}: 필터 '${name}' 에 허용 연산자가 하나도 없다`,
      })
    }
    for (const operator of allowed) {
      if (!operators.has(operator)) {
        violations.push({
          rule: 'filter-operator',
          message: `${at}: 필터 '${name}' 의 연산자 '${operator}' 가 FILTER_OPERATORS 에 없다`,
        })
      }
    }
    for (const repeated of duplicatesOf(allowed)) {
      violations.push({
        rule: 'filter-operator-duplicate',
        message: `${at}: 필터 '${name}' 에 연산자 '${repeated}' 가 두 번 있다`,
      })
    }
  }

  for (const name of resource.sorts) {
    if (!vocabulary.has(name)) {
      violations.push({
        rule: 'sort-key',
        message: `${at}: 정렬 '${name}' 이 속성·queryOnlyFields·관계 어디에도 없다`,
      })
    }
  }
  for (const repeated of duplicatesOf(resource.sorts)) {
    violations.push({ rule: 'sort-duplicate', message: `${at}: 정렬 '${repeated}' 가 두 번 있다` })
  }

  // 백엔드가 중복 sort 를 400 으로 거절한다(R-8). 화면이 그 URL 을 만들 수 있는
  // 자리가 선언이라, 여기서 막는다.
  const defaultSortName = parseSortToken(resource.defaultSort).name
  if (!resource.sorts.includes(defaultSortName)) {
    violations.push({
      rule: 'default-sort',
      message: `${at}: defaultSort '${resource.defaultSort}' 가 sorts 에 없다`,
    })
  }

  const relationshipNames = new Set(Object.keys(resource.relationships))
  for (const name of resource.includes) {
    if (!relationshipNames.has(name)) {
      violations.push({
        rule: 'include-name',
        message: `${at}: include '${name}' 이 관계 이름이 아니다`,
      })
    }
  }
  for (const repeated of duplicatesOf(resource.includes)) {
    violations.push({
      rule: 'include-duplicate',
      message: `${at}: include '${repeated}' 가 두 번 있다`,
    })
  }

  return violations
}

/**
 * 등록부 전체에 걸리는 불변식 + 각 자원의 불변식.
 *
 * `relationship-type` 이 가장 값지다 - 관계의 대상 type 을 오타 내면 아무도
 * 던지지 않고 `resourceByType` 이 조용히 `undefined` 를 돌려주며, 화면에는
 * "링크 없는 이름" 이 그대로 그려진다. 눈으로는 정상과 구별되지 않는다.
 *
 * `duplicate-path` 도 같은 종류다 - `category.ts` 를 복사해 `tag.ts` 를 만들며
 * `type` 만 고치고 `path` 를 그대로 두면 `duplicate-type` 에는 걸리지 않는다.
 */
export function checkRegistry(resources: readonly ResourceDefinition[]): Violation[] {
  const violations: Violation[] = resources.flatMap(checkResource)

  for (const repeated of duplicatesOf(resources.map((resource) => resource.type))) {
    violations.push({ rule: 'duplicate-type', message: `type '${repeated}' 가 두 번 등록됐다` })
  }
  for (const repeated of duplicatesOf(resources.map((resource) => resource.path))) {
    violations.push({ rule: 'duplicate-path', message: `path '${repeated}' 가 두 번 등록됐다` })
  }

  const registered = new Set(resources.map((resource) => resource.type))
  for (const resource of resources) {
    for (const [name, relationship] of Object.entries(resource.relationships)) {
      if (!registered.has(relationship.type)) {
        violations.push({
          rule: 'relationship-type',
          message: `${resource.type}: 관계 '${name}' 의 대상 type '${relationship.type}' 이 등록부에 없다`,
        })
      }
    }
  }

  return violations
}
