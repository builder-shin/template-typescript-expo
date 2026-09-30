import { describe, expect, it } from 'vitest'
import {
  indexResources,
  isResourceObject,
  resolveToMany,
  resolveToOne,
} from '@/lib/jsonapi/normalize'
import type { ResourceObject } from '@/lib/jsonapi/document'
import { COLLECTION_WITH_INCLUDED, SINGLE_CREATED } from '../../fixtures/documents'

const index = () => indexResources(COLLECTION_WITH_INCLUDED.included)

describe('indexResources', () => {
  it('type 과 id 를 함께 키로 쓴다', () => {
    const map = index()
    expect(map.get('exampleCategories:c1')?.attributes?.name).toBe('분류 하나')
    expect(map.get('exampleTags:t1')?.attributes?.name).toBe('태그 하나')
  })

  it('type 이 다르면 같은 id 라도 다른 항목이다', () => {
    // id 만으로 색인하면 여기서 두 자원이 서로를 덮어쓴다.
    const map = indexResources([
      { type: 'a', id: 'same', attributes: { which: 'a' } },
      { type: 'b', id: 'same', attributes: { which: 'b' } },
    ])
    expect(map.get('a:same')?.attributes?.which).toBe('a')
    expect(map.get('b:same')?.attributes?.which).toBe('b')
    expect(map.size).toBe(2)
  })

  it('undefined 를 빈 색인으로 다룬다', () => {
    expect(indexResources(undefined).size).toBe(0)
  })
})

describe('resolveToOne', () => {
  it('included 에 있으면 완전한 자원을 돌려준다', () => {
    const rel = COLLECTION_WITH_INCLUDED.data[0].relationships.category
    const resolved = resolveToOne(rel, index())
    expect(resolved).not.toBeNull()
    expect((resolved as ResourceObject).attributes?.name).toBe('분류 하나')
  })

  it('included 에 없으면 식별자를 그대로 돌려준다', () => {
    // include 를 요청하지 않은 경우다. 화면은 최소한 type·id 를 갖는다.
    const resolved = resolveToOne({ data: { type: 'exampleCategories', id: 'unknown' } }, index())
    expect(resolved).toEqual({ type: 'exampleCategories', id: 'unknown' })
  })

  it('data 가 null 이면 null 이다', () => {
    expect(resolveToOne({ data: null }, index())).toBeNull()
  })

  it('관계 자체가 없으면 null 이다', () => {
    expect(resolveToOne(undefined, index())).toBeNull()
  })

  it('data 키가 없으면 null 이다', () => {
    // 관계 객체가 links 만 갖고 오는 경우가 있다.
    expect(resolveToOne({ links: { related: '/x' } }, index())).toBeNull()
  })

  it('실측된 생성 응답의 비어 있는 to-one 을 null 로 읽는다', () => {
    const rel = SINGLE_CREATED.data.relationships.category
    expect(resolveToOne(rel, index())).toBeNull()
  })

  it('to-many 관계를 넘기면 던진다', () => {
    const rel = { data: [{ type: 'exampleTags', id: 't1' }] }
    expect(() => resolveToOne(rel, index())).toThrowError(/expected a to-one relationship/)
  })
})

describe('resolveToMany', () => {
  it('included 에 있는 것을 완전한 자원으로 돌려준다', () => {
    const rel = COLLECTION_WITH_INCLUDED.data[0].relationships.tags
    const resolved = resolveToMany(rel, index())
    expect(resolved.map((r) => (r as ResourceObject).attributes?.name)).toEqual([
      '태그 하나',
      '태그 둘',
    ])
  })

  it('included 에 없는 항목은 식별자를 그대로 섞어 돌려준다', () => {
    // resolveToOne 과 hydrate 를 공유하지만, 배열 중 일부만 included 에
    // 있는 상황(부분 include)을 지나는 테스트가 to-many 쪽에는 없었다.
    const rel = {
      data: [
        { type: 'exampleTags', id: 't1' },
        { type: 'exampleTags', id: 'unknown' },
      ],
    }
    const resolved = resolveToMany(rel, index())
    expect((resolved[0] as ResourceObject).attributes?.name).toBe('태그 하나')
    expect(resolved[1]).toEqual({ type: 'exampleTags', id: 'unknown' })
  })

  it('순서를 관계에 적힌 순서로 유지한다', () => {
    const rel = {
      data: [
        { type: 'exampleTags', id: 't2' },
        { type: 'exampleTags', id: 't1' },
      ],
    }
    const resolved = resolveToMany(rel, index())
    expect(resolved.map((r) => r.id)).toEqual(['t2', 't1'])
  })

  it('빈 배열은 빈 배열이다', () => {
    expect(resolveToMany({ data: [] }, index())).toEqual([])
  })

  it('data 가 null 이면 빈 배열이다', () => {
    // RelationshipObject 는 to-one/to-many 를 타입으로 구분하지 않으므로
    // data: null 은 to-many 자리에도 타입상 유효하다. undefined 와 마찬가지로
    // 빈 배열로 다뤄야 한다 - 이 분기가 없으면 없는 관계와 달리 여기서만 던진다.
    expect(resolveToMany({ data: null }, index())).toEqual([])
  })

  it('관계 자체가 없으면 빈 배열이다', () => {
    expect(resolveToMany(undefined, index())).toEqual([])
  })

  it('to-one 관계를 넘기면 던진다', () => {
    expect(() => resolveToMany({ data: { type: 'a', id: '1' } }, index())).toThrowError(
      /expected a to-many relationship/,
    )
  })
})

/**
 * `isResourceObject` - `resolveToOne`·`resolveToMany` 가 돌려주는 유니온을
 * 가르는 술어(계획 항목 [25]).
 *
 * 실제 자원 이름을 쓰지 않는다 - 이 술어는 자원을 하나도 몰라야 한다.
 */
describe('isResourceObject', () => {
  it('식별자 멤버(type · id)만 있으면 자원 객체가 아니다', () => {
    expect(isResourceObject({ type: 'probeThings', id: 'probe-1' })).toBe(false)
  })

  it('meta 는 식별자에도 올 수 있으므로 자원 객체의 근거가 아니다', () => {
    // JSON:API 1.1 이 식별자 객체에 허용하는 멤버가 type · id · meta 셋이다.
    // meta 하나로 자원 객체라고 판정하면 이 자리가 틀린다.
    expect(isResourceObject({ type: 'probeThings', id: 'probe-1', meta: { probe: 1 } })).toBe(false)
  })

  it('attributes 가 있으면 자원 객체다', () => {
    expect(
      isResourceObject({ type: 'probeThings', id: 'probe-1', attributes: { probeName: 'PROBE' } }),
    ).toBe(true)
  })

  it('attributes 없이 relationships 만 있어도 자원 객체다', () => {
    // **`'attributes' in x` 로 구별하면 여기서 틀린다.** attributes 는 자원
    // 객체의 선택 멤버라, 관계만 실린 자원 객체를 식별자로 오판하고 호출자는
    // 실제로 들고 있던 관계를 잃는다. normalize.ts 의 예전 주석이 경고하던
    // 자리가 정확히 이것이다.
    expect(
      isResourceObject({
        type: 'probeThings',
        id: 'probe-1',
        relationships: { probeOwner: { data: null } },
      }),
    ).toBe(true)
  })

  it('attributes 없이 links 만 있어도 자원 객체다', () => {
    // 같은 이유다. 참조 자원에 self 링크가 생기면(스펙 6.5) 실제로 나오는 모양.
    expect(
      isResourceObject({ type: 'probeThings', id: 'probe-1', links: { self: '/probe/things/1' } }),
    ).toBe(true)
  })

  it('resolveToOne 이 준 값을 실제로 가른다', () => {
    // 술어 자체가 아니라 **배선**을 잰다 - 같은 색인에서 하나는 풀리고
    // 하나는 안 풀리게 만들어, 두 갈래가 서로 다른 답을 내는지 본다.
    const index = indexResources([
      { type: 'probeThings', id: 'probe-known', attributes: { probeName: 'PROBE 이름' } },
    ])

    const hydrated = resolveToOne({ data: { type: 'probeThings', id: 'probe-known' } }, index)
    const bare = resolveToOne({ data: { type: 'probeThings', id: 'probe-missing' } }, index)

    expect(hydrated).not.toBeNull()
    expect(bare).not.toBeNull()
    // null 은 위에서 배제했지만 타입은 여전히 유니온이다 - 술어가 좁힌다.
    expect(hydrated !== null && isResourceObject(hydrated)).toBe(true)
    expect(bare !== null && isResourceObject(bare)).toBe(false)
  })

  it('색인에서 푼 값의 attributes 를 단언 없이 읽게 해 준다', () => {
    // 이 테스트가 재는 것은 런타임 값이 아니라 **타입 좁히기**다 - 술어의
    // 반환 타입이 `value is ResourceObject` 가 아니면 아래 줄이 컴파일되지
    // 않는다(게이트 [1/9] 이 잡는다).
    const index = indexResources([
      { type: 'probeThings', id: 'probe-known', attributes: { probeName: 'PROBE 이름' } },
    ])
    const resolved = resolveToOne({ data: { type: 'probeThings', id: 'probe-known' } }, index)
    if (resolved === null || !isResourceObject(resolved)) throw new Error('풀렸어야 한다')
    expect(resolved.attributes?.probeName).toBe('PROBE 이름')
  })
})
