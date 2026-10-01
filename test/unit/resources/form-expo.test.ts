import { describe, expect, it } from 'vitest'

import { EXAMPLE, EXAMPLE_CATEGORY, EXAMPLE_TAG } from '@/lib/resources'
import { defineResource, type RelationshipDefinition } from '@/lib/resources/define'
import {
  newFormValues,
  relationshipChoice,
  relationshipTargets,
  withAttribute,
  withRelationshipChoice,
  type ResourceFormValues,
} from '@/lib/resources/form'
import type { ReferenceList } from '@/lib/resources/view'

/**
 * 이 저장소가 `lib/resources/form.ts`(template-typescript-nextjs 에서 복사)에 더한 판단 - 폼 상태
 * 객체(스펙 6.2)와 관계 선택기가 그릴 것. 원본의 시험은 test/unit/resources/form.test.ts 에 있다.
 *
 * 자원은 `probe*` 로 만든다 - `EXAMPLE` 로 재면 "선언을 읽는다" 와 "그 자원을 안다" 가 구별되지
 * 않는다. 등록부를 거치는 `relationshipTargets` 만 등록된 선언으로 잰다.
 */
const PROBE_TICKET = defineResource({
  type: 'probeTickets',
  path: '/probe/api/tickets',
  attributes: {
    probeSubject: {
      kind: 'string',
      label: 'PROBE 제목',
      readOnly: false,
      nullable: false,
      listed: true,
    },
    probePhase: {
      kind: 'enum',
      label: 'PROBE 단계',
      readOnly: false,
      nullable: false,
      listed: true,
      values: [
        { value: 'probe-open', label: 'PROBE 열림' },
        { value: 'probe-shut', label: 'PROBE 닫힘' },
      ],
    },
    probeMood: {
      kind: 'enum',
      label: 'PROBE 기분',
      readOnly: false,
      nullable: true,
      listed: false,
      values: [{ value: 'probe-calm', label: 'PROBE 평온' }],
    },
    probeStamp: {
      kind: 'datetime',
      label: 'PROBE 시각',
      readOnly: true,
      nullable: false,
      listed: true,
    },
  },
  relationships: {
    probeDesk: { cardinality: 'one', type: 'probeDesks', label: 'PROBE 책상' },
    probeFlags: { cardinality: 'many', type: 'probeFlags', label: 'PROBE 깃발' },
  },
  filters: {},
  sorts: ['probeSubject'],
  defaultSort: 'probeSubject',
  includes: [],
  writable: true,
})

const TO_ONE: RelationshipDefinition = {
  cardinality: 'one',
  type: 'probeDesks',
  label: 'PROBE 책상',
}
const TO_MANY: RelationshipDefinition = {
  cardinality: 'many',
  type: 'probeFlags',
  label: 'PROBE 깃발',
}

const LIST: ReferenceList = {
  options: [
    { id: 'probe-a', label: 'PROBE 가' },
    { id: 'probe-b', label: 'PROBE 나' },
    { id: 'probe-c', label: 'PROBE 다' },
  ],
  truncated: false,
}

describe('newFormValues - 생성 화면의 첫 값', () => {
  it('필수 enum 은 첫 값을 고른 채로, 나머지 속성은 빈 문자열로, 관계는 빈 선택으로 시작한다', () => {
    expect(newFormValues(PROBE_TICKET)).toEqual({
      attributes: { probeSubject: '', probePhase: 'probe-open', probeMood: '' },
      relationships: { probeDesk: [], probeFlags: [] },
    })
  })
})

describe('withAttribute', () => {
  it('그 속성만 바꾸고 원래 값은 건드리지 않는다', () => {
    const before = newFormValues(PROBE_TICKET)
    const after = withAttribute(before, 'probeSubject', 'probe-subject')
    expect(after.attributes).toEqual({
      probeSubject: 'probe-subject',
      probePhase: 'probe-open',
      probeMood: '',
    })
    expect(before.attributes.probeSubject).toBe('')
    expect(after.relationships).toBe(before.relationships)
  })
})

describe('withRelationshipChoice', () => {
  const start: ResourceFormValues = {
    attributes: {},
    relationships: { probeDesk: ['probe-a'], probeFlags: ['probe-b', 'probe-a'] },
  }

  it('to-one 은 고른 id 하나로 바꾸고, null 이면 비운다', () => {
    expect(
      withRelationshipChoice(start, 'probeDesk', TO_ONE, 'probe-c').relationships.probeDesk,
    ).toEqual(['probe-c'])
    expect(
      withRelationshipChoice(start, 'probeDesk', TO_ONE, null).relationships.probeDesk,
    ).toEqual([])
  })

  it('to-many 는 켜면 끝에 붙이고 끄면 빼며 나머지 순서를 지킨다 - 다시 정렬하지 않는다', () => {
    const on = withRelationshipChoice(start, 'probeFlags', TO_MANY, 'probe-c')
    expect(on.relationships.probeFlags).toEqual(['probe-b', 'probe-a', 'probe-c'])
    const off = withRelationshipChoice(on, 'probeFlags', TO_MANY, 'probe-a')
    expect(off.relationships.probeFlags).toEqual(['probe-b', 'probe-c'])
    expect(
      withRelationshipChoice(off, 'probeFlags', TO_MANY, null).relationships.probeFlags,
    ).toEqual([])
  })

  it('다른 관계와 원래 값은 건드리지 않는다', () => {
    const after = withRelationshipChoice(start, 'probeDesk', TO_ONE, 'probe-c')
    expect(after.relationships.probeFlags).toEqual(['probe-b', 'probe-a'])
    expect(start.relationships.probeDesk).toEqual(['probe-a'])
  })
})

describe('relationshipTargets', () => {
  it('선언의 관계마다 등록부의 대상 자원을 선언 순서대로 준다', () => {
    expect(relationshipTargets(EXAMPLE)).toEqual([
      ['category', EXAMPLE_CATEGORY],
      ['tags', EXAMPLE_TAG],
    ])
  })

  it('관계가 없으면 빈 배열이다', () => {
    expect(relationshipTargets(EXAMPLE_TAG)).toEqual([])
  })

  it('대상 type 이 등록부에 없으면 던진다 - 선언의 오류다', () => {
    expect(() => relationshipTargets(PROBE_TICKET)).toThrow(/probeDesks/)
  })
})

describe('relationshipChoice - 선택기가 그릴 것', () => {
  it('보기는 목록 순서 그대로이고 고른 것에 표시가 붙는다 - 선택은 고른 순서다', () => {
    const choice = relationshipChoice(TO_MANY, LIST, ['probe-c', 'probe-a'])
    expect(choice.options.map((option) => [option.id, option.selected])).toEqual([
      ['probe-a', true],
      ['probe-b', false],
      ['probe-c', true],
    ])
    expect(choice.chosen.map((option) => option.label)).toEqual(['PROBE 다', 'PROBE 가'])
    expect(choice.hasUnlisted).toBe(false)
  })

  it('목록에 없는 선택은 보기 끝에 id 를 라벨로 붙이고 알린다 - 잘렸거나 조회가 실패한 목록', () => {
    const choice = relationshipChoice(TO_MANY, LIST, ['probe-z', 'probe-b'])
    expect(choice.options.at(-1)).toEqual({
      id: 'probe-z',
      label: 'probe-z',
      selected: true,
      listed: false,
    })
    expect(choice.chosen).toEqual([
      { id: 'probe-z', label: 'probe-z', selected: true, listed: false },
      { id: 'probe-b', label: 'PROBE 나', selected: true, listed: true },
    ])
    expect(choice.hasUnlisted).toBe(true)
  })

  it('목록이 비어도(조회 실패) 선택은 그대로 보인다', () => {
    const choice = relationshipChoice(TO_ONE, { options: [], truncated: false }, ['probe-a'])
    expect(choice.chosen).toEqual([
      { id: 'probe-a', label: 'probe-a', selected: true, listed: false },
    ])
    expect(choice.options).toEqual(choice.chosen)
  })

  it('to-one 은 첫 id 하나만 뜻이 있다', () => {
    const choice = relationshipChoice(TO_ONE, LIST, ['probe-b', 'probe-c'])
    expect(choice.chosen.map((option) => option.id)).toEqual(['probe-b'])
    expect(choice.options.filter((option) => option.selected).map((option) => option.id)).toEqual([
      'probe-b',
    ])
  })

  it('같은 id 는 한 번만, 빈 문자열은 빼고 그린다', () => {
    const choice = relationshipChoice(TO_MANY, LIST, ['', 'probe-a', 'probe-a'])
    expect(choice.chosen.map((option) => option.id)).toEqual(['probe-a'])
    expect(choice.options).toHaveLength(3)
  })
})
