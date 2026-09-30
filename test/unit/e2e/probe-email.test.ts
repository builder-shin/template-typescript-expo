import { describe, expect, it } from 'vitest'
import {
  EMAIL_LOCAL_MAX,
  PROBE_EMAIL_DOMAIN,
  PROBE_EMAIL_HEAD_MAX,
  probeEmail,
} from '@/test/e2e/probe-email'

/**
 * E2E 가입 이메일이 **규격을 어기지 않는가.**
 *
 * 이 자리가 왜 지켜져야 하나(2026-09-09 실측): 앞선 판은 `<접두사>-<라벨>-<uuid>`
 * 를 그대로 이어 붙여 로컬 파트가 72·80자까지 갔다. 정본과 Rails 는 그것을
 * 받아 줬고 **NestJS 만 거절했다** - 그래서 세 백엔드 매트릭스의 세 번째 갈래가
 * 처음 도는 순간 **E2E 열다섯 중 아홉이 가입 단계에서 끊겼다.**
 *
 * 두 세계가 우연히 같았던 것이다 - "규격을 지키는 픽스처" 와 "규격을 어겼지만
 * 관대한 백엔드를 만난 픽스처". 세 번째 백엔드가 그 둘을 갈랐다.
 *
 * **여기서 잴 수 없는 것:** 각 백엔드가 실제로 무엇을 거절하는가. 이 파일은
 * 우리가 만드는 값이 RFC 5321 의 상한 안에 있는지만 본다 - 백엔드의 판정은
 * `test/e2e/mirror.spec.ts` 와 매트릭스가 잰다.
 */

/** 실전에서 가장 긴 라벨보다 훨씬 긴 값. 자르기가 실제로 도는지 보려면 넘쳐야 한다. */
const OVERLONG_LABEL = 'status-undeclared-rejected-with-a-very-long-suffix-that-never-ends'

describe('probeEmail()', () => {
  it.each([
    ['probe-e2e', 'register-logout'],
    ['probe-e2e-write', 'create-bad-category'],
    ['probe-lab-mirror', 'status-undeclared-rejected'],
    ['probe-lab', 'put-upsert'],
    ['probe-e2e-write', OVERLONG_LABEL],
    ['probe-lab-mirror', ''],
  ])('%s / %s 의 로컬 파트가 RFC 5321 상한을 넘지 않는다', (prefix, label) => {
    const [local] = probeEmail(prefix, label).split('@')
    expect(local?.length, `로컬 파트 ${local?.length}자 - ${local}`).toBeLessThanOrEqual(
      EMAIL_LOCAL_MAX,
    )
  })

  it('이 검사가 헛돌지 않는다 - 자르지 않으면 실제로 넘친다', () => {
    // 앞선 판의 조립을 그대로 재현한다. 이것이 상한 안에 들어와 버리면 위
    // 단언들은 아무것도 지키지 않는 것이 된다.
    const naive = `probe-lab-mirror-${OVERLONG_LABEL}-${'0'.repeat(36)}`
    expect(naive.length).toBeGreaterThan(EMAIL_LOCAL_MAX)
  })

  it('잘려도 어느 테스트의 계정인지 남는다', () => {
    expect(probeEmail('probe-e2e-write', OVERLONG_LABEL)).toMatch(/^probe-e2e-write-/)
  })

  it('두 번 부르면 다른 주소다 - 자르기가 고유성을 깨지 않는다', () => {
    const label = OVERLONG_LABEL
    expect(probeEmail('probe-lab', label)).not.toBe(probeEmail('probe-lab', label))
  })

  it('도메인은 실재할 수 없는 예약 TLD 다', () => {
    expect(probeEmail('probe-e2e', 'x').endsWith(`@${PROBE_EMAIL_DOMAIN}`)).toBe(true)
    expect(PROBE_EMAIL_DOMAIN.endsWith('.example')).toBe(true)
  })

  it('짧은 라벨은 자르지 않는다 - 자르기가 필요할 때만 돈다', () => {
    const [local] = probeEmail('probe-e2e', 'rotate').split('@')
    expect(local?.startsWith('probe-e2e-rotate-')).toBe(true)
  })

  it('여유 폭 상수가 실제 조립과 맞는다', () => {
    const [local] = probeEmail('p', 'x').split('@')
    // 짧은 입력은 안 잘리므로 여유 폭보다 짧다 - 상수가 조립보다 크면 위
    // 자르기가 상한을 넘게 되므로 그 관계를 여기서 못박는다.
    expect(PROBE_EMAIL_HEAD_MAX + 1 + 36).toBe(EMAIL_LOCAL_MAX)
    expect(local?.length).toBeLessThanOrEqual(EMAIL_LOCAL_MAX)
  })
})
