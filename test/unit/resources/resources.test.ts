/**
 * 실제 자원 선언과 등록부.
 *
 * **여기서는 불변식을 적용만 한다.** 규칙이 실제로 무엇을 거절하는지는
 * `define.test.ts` 가 임의의 `probe*` 픽스처로 이미 쟀다. 순서가 반대였다면
 * 이 파일의 초록은 "규칙이 살아 있다" 가 아니라 "지금 값이 그렇다" 만 뜻한다.
 *
 * **선언의 값을 그대로 베끼지 않는다.** `expect(EXAMPLE.type).toBe('examples')`
 * 같은 것은 선언을 한 번 더 옮겨 적은 것이라, 옮겨 적기가 틀렸을 때 함께
 * 틀린다. R-2~R-5 의 값이 백엔드와 맞는지는 단위 테스트가 볼 수 있는 것이
 * 아니다 - 살아 있는 백엔드에 물어야 하고, 그것이 D5 의 계약 거울
 * 테스트(스펙 10.2)다.
 */

import { describe, expect, it } from 'vitest'
import { EXAMPLE, EXAMPLE_CATEGORY, EXAMPLE_TAG, RESOURCES, resourceByType } from '@/lib/resources'
import { checkRegistry } from './invariants'

describe('등록부가 헛돌지 않는다', () => {
  it('자원이 실제로 등록돼 있다', () => {
    // 아래 검사들은 전부 RESOURCES 를 순회한다. 배열이 비면 하나도 빠짐없이
    // 초록인 채로 아무것도 지키지 않게 되므로 그 자리를 먼저 막는다.
    expect(RESOURCES.length).toBeGreaterThanOrEqual(3)
  })

  it('모든 자원이 속성 · 정렬 · 필터를 하나 이상 갖는다', () => {
    // 같은 이유다 - 어느 자원의 attributes 가 비면 그 자원에 대한 어휘 검사가
    // 아무것도 재지 않는다.
    const empty = RESOURCES.filter(
      (resource) =>
        Object.keys(resource.attributes).length === 0 ||
        resource.sorts.length === 0 ||
        Object.keys(resource.filters).length === 0,
    )
    expect(empty.map((resource) => resource.type)).toEqual([])
  })
})

describe('구조적 불변식이 실제 선언에서 지켜진다', () => {
  it('등록부 전체에 어긋난 자리가 없다', () => {
    // 실패하면 어긋난 자리마다 한 줄씩 나온다.
    expect(checkRegistry(RESOURCES).map((violation) => violation.message)).toEqual([])
  })
})

describe('resourceByType — 상세 링크가 지나가는 자리', () => {
  it('등록된 자원을 전부 찾고, 복사본이 아니라 그 선언 자체를 돌려준다', () => {
    // 값을 베끼지 않으려고 RESOURCES 를 돌면서 항등을 잰다. toBe 인 것이
    // 중요하다 - 어딘가에서 얕은 복사가 끼면 나중에 선언을 늘렸을 때 조용히
    // 오래된 사본이 돌아다닌다.
    for (const resource of RESOURCES) {
      expect(resourceByType(resource.type)).toBe(resource)
    }
  })

  it('세 선언이 모두 등록부를 통해 닿는다', () => {
    // 파일을 만들고 index.ts 에 더하는 것을 잊는 것이 이 계층의 가장 흔한
    // 실수다. type 문자열을 베끼지 않고 선언 자체에서 꺼내 묻는다.
    expect(resourceByType(EXAMPLE.type)).toBe(EXAMPLE)
    expect(resourceByType(EXAMPLE_CATEGORY.type)).toBe(EXAMPLE_CATEGORY)
    expect(resourceByType(EXAMPLE_TAG.type)).toBe(EXAMPLE_TAG)
  })

  it('모르는 type 이면 던지지 않고 undefined 다', () => {
    // 이 인자는 우리 코드가 아니라 백엔드 응답에서 온다. 던지면 백엔드가
    // 관계 하나를 새 type 으로 늘리는 순간 상세 화면이 통째로 죽는다.
    expect(resourceByType('probeNeverRegistered')).toBeUndefined()
    expect(resourceByType('')).toBeUndefined()
  })

  it('모든 관계의 대상을 등록부를 통해 실제로 찾을 수 있다', () => {
    // checkRegistry 의 relationship-type 과 같은 사실을 다른 경로로 잰다 -
    // 저쪽은 넘겨받은 배열로 집합을 만들고, 이쪽은 프로덕션의 resourceByType
    // 을 지나간다. 화면(Task 6 · D4)이 실제로 밟는 것은 이쪽이다.
    const unresolved: string[] = []
    for (const resource of RESOURCES) {
      for (const [name, relationship] of Object.entries(resource.relationships)) {
        const target = resourceByType(relationship.type)
        if (target === undefined || target.path.length === 0) {
          unresolved.push(`${resource.type}.${name} → ${relationship.type}`)
        }
      }
    }
    expect(unresolved).toEqual([])
  })
})

describe('R-1 — type 과 path 는 서로 독립이다', () => {
  it('path 를 type 에서 기계적으로 유도하지 않았다', () => {
    // 이 검사가 잡는 것은 하나다: 누군가 "path 는 결국 '/api/v1/' + type 이니
    // 필드를 하나 없애자" 로 줄이는 것. 그렇게 되면 전부가 유도 가능해진다.
    //
    // 잡지 못하는 것: path 하나가 틀린 것. 경로의 값은 살아 있는 백엔드만
    // 알고, E2E(Task 7)와 D5 의 계약 거울 테스트가 잰다.
    const derivable = RESOURCES.filter((resource) => resource.path === `/api/v1/${resource.type}`)
    expect(derivable.length).toBeLessThan(RESOURCES.length)
  })
})
