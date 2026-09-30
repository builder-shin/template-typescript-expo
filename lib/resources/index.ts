/**
 * 자원 등록부.
 *
 * **`RESOURCES` 는 손으로 채우는 배열이다**(스펙 4장). *여기 없으면 그 자원은
 * 존재하지 않는 것과 같다* - 백엔드 템플릿들의 `config/routes.py` · `ENTITIES`
 * · `MIGRATIONS` 와 같은 계약이다.
 *
 * **자동 탐색을 쓰지 마라.** glob · `import.meta.glob` · 동적 `import` 로
 * 이 배열을 채우면 파일을 놓아두는 것만으로 자원이 생기고, 반대로 등록에서
 * 빼는 것으로 자원을 없앨 수 없게 된다. "존재한다"가 사람의 결정이 아니라
 * 파일 시스템의 부수 효과가 되는 순간 위 계약이 사라진다.
 */

import { EXAMPLE } from './example'
import { EXAMPLE_CATEGORY } from './category'
import { EXAMPLE_TAG } from './tag'
import type { ResourceDefinition } from './define'

export { EXAMPLE } from './example'
export { EXAMPLE_CATEGORY } from './category'
export { EXAMPLE_TAG } from './tag'
// parseSortToken · formatSortToken 은 여기서 re-export 하지 않는다. 정렬 토큰
// 문법은 lib/jsonapi 의 것이라(JSON:API 문법이지 자원의 것이 아니다) 여기서
// 다시 내보내면 어느 계층이 그 문법을 갖는지가 흐려진다. 화면은 buildQuery 와
// 같은 자리에서 가져가라 - `import { parseSortToken } from '@/lib/jsonapi/query'`.
export { defineResource } from './define'
export type {
  AttributeDefinition,
  AttributeKind,
  AttributeMap,
  QueryField,
  RelationshipDefinition,
  RelationshipMap,
  ResourceDefinition,
  ResourceInput,
  SortToken,
} from './define'

/** 이 저장소에 존재하는 자원 전부. 새 자원은 파일을 만든 뒤 여기에 손으로 더한다. */
export const RESOURCES: readonly ResourceDefinition[] = [EXAMPLE, EXAMPLE_CATEGORY, EXAMPLE_TAG]

// type 이 겹치면 나중 것이 앞의 것을 덮는다. 여기서 던지지 않는 이유는
// `defineResource` 가 검증하지 않는 이유와 같다 - import 시점의 예외는 무엇이
// 틀렸는지 오히려 가린다. 중복은 test/unit/resources/resources.test.ts 가 잡는다.
const BY_TYPE: ReadonlyMap<string, ResourceDefinition> = new Map(
  RESOURCES.map((resource): [string, ResourceDefinition] => [resource.type, resource]),
)

/**
 * JSON:API type 으로 자원 선언을 찾는다. 모르는 type 이면 `undefined` 다.
 *
 * ## 왜 던지지 않는가
 *
 * 여기 들어오는 `type` 은 우리 코드가 아니라 **백엔드 응답에서 온다.**
 * `resolveToOne` 이 돌려주는 `{type, id}` 의 type 으로 상세 링크를 만드는
 * 것이 이 함수의 첫 호출부다(Task 6, D4 의 관계 선택기). 즉 모르는 type 은
 * 프로그래머의 실수가 아니라 데이터의 상태다.
 *
 * 던지면 백엔드가 관계 하나를 새 type 으로 늘리는 순간 상세 화면이 통째로
 * 죽는다. 세 백엔드가 이미 관계 표현에서 갈라져 있는 계약(R-10②)에서 그
 * 취약함은 이론이 아니다. `undefined` 면 호출부는 "링크 없이 이름만 그린다"
 * 로 물러설 수 있다.
 *
 * `undefined` 의 값은 등록부의 뜻과도 정확히 맞는다 - 등록되지 않은 자원은
 * *존재하지 않는 것과 같고*, "없음" 을 표현하는 값이 `undefined` 다.
 *
 * 대가는 호출부마다 생기는 분기다. 그 분기는 없앨 수 없는 진짜 결정이다 -
 * `path` 없이 무엇을 그릴지는 호출부만 안다. 던지면 그 결정이 사라지는 게
 * 아니라 `app/error.tsx` 로 옮겨갈 뿐이고, 거기서는 아무것도 그릴 수 없다.
 */
export function resourceByType(type: string): ResourceDefinition | undefined {
  return BY_TYPE.get(type)
}
