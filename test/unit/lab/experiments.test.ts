import { describe, expect, it } from 'vitest'
import { EXPERIMENTS, type Experiment } from '@/lib/lab/experiments'

/**
 * 계약 실험실의 여섯 실험 - 순수 데이터를 잰다.
 *
 * `experiments.ts`가 판단(요청 조립)을 갖지 않는 이유가 바로 이 테스트다 -
 * `runExperiment`(actions.ts)는 `'use server'`라 vitest가 부를 수 없지만,
 * "여섯이 다 있는가"·"needsSession 배정이 맞는가"는 데이터라 여기서 직접
 * 잰다. 값의 정본은 team-lead가 실측해 스펙 8.5의 표로 남긴 계약이다 - 이
 * 테스트는 그 표와 이 파일이 같은지 잰다.
 */

const EXPECTED_NEEDS_SESSION: Readonly<Record<string, boolean>> = {
  putUpsert: true,
  relationshipWrite: true,
  offsetWalk: false,
  pageTotals: false,
  acceptLanguage: true,
  invalidFilter: false,
}

function byId(id: string): Experiment | undefined {
  return EXPERIMENTS.find((experiment) => experiment.id === id)
}

describe('EXPERIMENTS — 여섯이 전부 있다', () => {
  it('정확히 여섯 개다', () => {
    expect(EXPERIMENTS).toHaveLength(6)
  })

  it('id가 서로 겹치지 않는다', () => {
    const ids = EXPERIMENTS.map((experiment) => experiment.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it.each(Object.keys(EXPECTED_NEEDS_SESSION))('%s가 존재한다', (id) => {
    expect(byId(id)).toBeDefined()
  })
})

describe('EXPERIMENTS — needsSession 배정 (브리핑 표)', () => {
  it.each(Object.entries(EXPECTED_NEEDS_SESSION))('%s.needsSession === %s', (id, expected) => {
    expect(byId(id)?.needsSession).toBe(expected)
  })

  it('로그인이 필요한 것과 아닌 것이 각각 셋씩이다', () => {
    const needs = EXPERIMENTS.filter((experiment) => experiment.needsSession)
    const anon = EXPERIMENTS.filter((experiment) => !experiment.needsSession)
    expect(needs).toHaveLength(3)
    expect(anon).toHaveLength(3)
  })
})

describe('EXPERIMENTS — 표시용 필드가 비어 있지 않다', () => {
  it.each(EXPERIMENTS.map((experiment) => experiment.id))(
    '%s의 title·proves가 비어있지 않다',
    (id) => {
      const experiment = byId(id)
      expect(experiment?.title.length).toBeGreaterThan(0)
      expect(experiment?.proves.length).toBeGreaterThan(0)
    },
  )
})
