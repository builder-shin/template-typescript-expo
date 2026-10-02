import { describe, expect, it } from 'vitest'
import {
  decideGuard,
  decidePendingLogin,
  type GuardDecision,
  type GuardInput,
} from '@/lib/auth/guard-latch'
import { loginHref } from '@/lib/auth/protected-paths'
import type { SessionStatus } from '@/lib/auth/session-manager'

/**
 * 경로 가드의 판단(스펙 7.3). 앱 셸(app/(app)/_layout.tsx)이 렌더마다 부르고 돌려준 `latched`
 * 를 다음 렌더에 되먹인다 - 그래서 시험도 렌더 순서를 따라 되먹이며 잰다.
 */

const PROTECTED = '/examples/new'
const PUBLIC = '/'

describe('로그인 이동이 완료되기 전의 목적지', () => {
  it('콜드 보호 경로 뒤 홈 앵커가 나타나도 next를 가진 첫 목적지를 유지한다', () => {
    const first = decidePendingLogin({
      status: 'signedOut',
      pending: null,
      requested: loginHref(PROTECTED),
    })
    expect(first).toBe('/login?next=%2Fexamples%2Fnew')
    expect(decidePendingLogin({ status: 'signedOut', pending: first, requested: null })).toBe(first)
    expect(
      decidePendingLogin({
        status: 'signedOut',
        pending: first,
        requested: loginHref('/examples/42/edit'),
      }),
    ).toBe(first)
  })

  it.each(['signedIn', 'restoring'] as const)('%s이면 보류된 로그인 이동도 없다', (status) => {
    expect(
      decidePendingLogin({
        status,
        pending: loginHref(PROTECTED),
        requested: loginHref(PROTECTED),
      }),
    ).toBeNull()
  })

  it('셸의 새 상태는 이전 셸의 목적지를 물려받지 않는다', () => {
    const previousLayout = decidePendingLogin({
      status: 'signedOut',
      pending: null,
      requested: loginHref(PROTECTED),
    })
    expect(previousLayout).not.toBeNull()
    expect(decidePendingLogin({ status: 'signedOut', pending: null, requested: null })).toBeNull()
  })

  it('로그아웃 래치가 이동을 막는 동안 목적지를 만들지 않는다', () => {
    const guard = decideGuard(input({ loggingOut: true }))
    expect(
      decidePendingLogin({
        status: 'signedOut',
        pending: null,
        requested: guard.redirect ? loginHref(PROTECTED) : null,
      }),
    ).toBeNull()
  })
})

function input(overrides: Partial<GuardInput> = {}): GuardInput {
  return {
    status: 'signedOut',
    loggingOut: false,
    latched: false,
    pathname: PROTECTED,
    ...overrides,
  }
}

/** 렌더 순서대로 판단하고, 돌려준 latched 를 다음 렌더에 넣는다(앱 셸이 하는 일). */
function renderSequence(steps: readonly Omit<GuardInput, 'latched'>[]): GuardDecision[] {
  let latched = false
  return steps.map((step) => {
    const decision = decideGuard({ ...step, latched })
    latched = decision.latched
    return decision
  })
}

describe('decideGuard - 로그아웃과 무관한 가드', () => {
  it.each(['/examples/new', '/examples/42/edit'])(
    '세션이 없고 %s 에 있으면 로그인으로 보낸다',
    (pathname) => {
      expect(decideGuard(input({ pathname }))).toEqual({ redirect: true, latched: false })
    },
  )

  it.each(['/', '/examples', '/examples/42', '/login', '/register'])(
    '세션이 없어도 공개 경로 %s 에서는 보내지 않는다',
    (pathname) => {
      expect(decideGuard(input({ pathname }))).toEqual({ redirect: false, latched: false })
    },
  )

  it('로그인했으면 보호 경로에서도 보내지 않는다', () => {
    expect(decideGuard(input({ status: 'signedIn' }))).toEqual({ redirect: false, latched: false })
  })

  it('복원 중에는 세션이 있는지 모르므로 보내지 않는다', () => {
    expect(decideGuard(input({ status: 'restoring' }))).toEqual({
      redirect: false,
      latched: false,
    })
  })
})

describe('decideGuard - 로그아웃이 진행 중이다', () => {
  it('기기 세션이 이미 비었어도 보내지 않고 건다 - 방금 스스로 나간 사람에게 로그인 폼을 들이밀지 않는다', () => {
    expect(decideGuard(input({ loggingOut: true }))).toEqual({ redirect: false, latched: true })
  })

  it('아직 로그인 상태여도 건다 - 진행 중인 회전을 기다리는 동안 세션은 signedIn 이다', () => {
    expect(decideGuard(input({ status: 'signedIn', loggingOut: true }))).toEqual({
      redirect: false,
      latched: true,
    })
  })

  it('공개 경로에서도 건다 - 끝난 뒤에 풀린다', () => {
    expect(decideGuard(input({ loggingOut: true, pathname: PUBLIC }))).toEqual({
      redirect: false,
      latched: true,
    })
  })
})

describe('decideGuard - 로그아웃이 끝났지만 홈으로의 이동이 아직 적용되지 않았다', () => {
  /**
   * 이 가드가 있는 이유. 로그아웃이 끝나면 홈으로의 이동이 큐에 들어가지만 적용은 나중이고, 진행 여부를
   * 알려 주는 쪽은 다른 경로로 알린다 - 둘의 순서는 정해져 있지 않다. 진행이 끝난 렌더에서 pathname 이
   * 아직 옛 보호 경로면, 래치가 없을 때 이 판단은 방금 로그아웃한 사용자를 로그인 화면으로 보낸다.
   */
  it('진행이 끝나도 경로가 아직 보호 경로면 보내지 않는다', () => {
    expect(decideGuard(input({ loggingOut: false, latched: true }))).toEqual({
      redirect: false,
      latched: true,
    })
  })

  it('경로가 보호 경로를 벗어나면 푼다', () => {
    expect(decideGuard(input({ latched: true, pathname: PUBLIC }))).toEqual({
      redirect: false,
      latched: false,
    })
  })

  it('풀린 뒤에 세션 없이 보호 경로에 들어오면 다시 보낸다', () => {
    expect(decideGuard(input({ latched: false }))).toEqual({ redirect: true, latched: false })
  })

  it('로그인 상태로 돌아왔으면 푼다 - 다음 로그아웃 없이 signedOut 이 되면 보내야 하기 때문이다', () => {
    expect(decideGuard(input({ status: 'signedIn', latched: true }))).toEqual({
      redirect: false,
      latched: false,
    })
  })
})

describe('decideGuard - 렌더 순서를 따라', () => {
  it('보호 경로에서 로그아웃하면 이동이 적용될 때까지 한 번도 보내지 않고, 그 뒤 진입은 다시 막는다', () => {
    const decisions = renderSequence([
      { status: 'signedIn', loggingOut: false, pathname: PROTECTED }, // 로그아웃 전
      { status: 'signedIn', loggingOut: true, pathname: PROTECTED }, // 회전을 기다림
      { status: 'signedOut', loggingOut: true, pathname: PROTECTED }, // 기기 세션이 비워짐
      { status: 'signedOut', loggingOut: false, pathname: PROTECTED }, // 끝남 - 이동은 아직 적용 전
      { status: 'signedOut', loggingOut: false, pathname: PUBLIC }, // 홈으로 이동이 적용됨
      { status: 'signedOut', loggingOut: false, pathname: PROTECTED }, // 세션 없이 다시 들어옴
    ])

    expect(decisions.map((decision) => decision.redirect)).toEqual([
      false,
      false,
      false,
      false,
      false,
      true,
    ])
    expect(decisions.map((decision) => decision.latched)).toEqual([
      false,
      true,
      true,
      true,
      false,
      false,
    ])
  })

  it('공개 경로에서 로그아웃해도 걸었다 풀고 끝난다', () => {
    const decisions = renderSequence([
      { status: 'signedIn', loggingOut: false, pathname: PUBLIC },
      { status: 'signedIn', loggingOut: true, pathname: PUBLIC },
      { status: 'signedOut', loggingOut: true, pathname: PUBLIC },
      { status: 'signedOut', loggingOut: false, pathname: PUBLIC },
    ])

    expect(decisions.map((decision) => decision.redirect)).toEqual([false, false, false, false])
    expect(decisions.map((decision) => decision.latched)).toEqual([false, true, true, false])
  })

  it('로그아웃하지 않은 채 세션만 사라지면(인증 오류) 보호 경로에서 곧바로 보낸다', () => {
    const decisions = renderSequence([
      { status: 'signedIn', loggingOut: false, pathname: PROTECTED },
      { status: 'signedOut', loggingOut: false, pathname: PROTECTED },
    ])

    expect(decisions.map((decision) => decision.redirect)).toEqual([false, true])
  })
})

describe('decideGuard - 모든 입력에 대해', () => {
  const statuses: readonly SessionStatus[] = ['restoring', 'signedIn', 'signedOut']
  const paths = [PROTECTED, '/examples/42/edit', PUBLIC, '/examples', '/login']
  const booleans = [false, true] as const

  function everyInput(): GuardInput[] {
    const inputs: GuardInput[] = []
    for (const status of statuses) {
      for (const loggingOut of booleans) {
        for (const latched of booleans) {
          for (const pathname of paths) {
            inputs.push({ status, loggingOut, latched, pathname })
          }
        }
      }
    }
    return inputs
  }

  it('돌려준 latched 를 다시 넣으면 같은 판단이다 - 앱 셸의 렌더 중 상태 갱신이 한 번에 가라앉는다', () => {
    for (const each of everyInput()) {
      const first = decideGuard(each)
      expect(decideGuard({ ...each, latched: first.latched }), JSON.stringify(each)).toEqual(first)
    }
  })

  it('로그아웃이 진행 중이면 절대 보내지 않고 언제나 건다', () => {
    for (const each of everyInput().filter((candidate) => candidate.loggingOut)) {
      expect(decideGuard(each), JSON.stringify(each)).toEqual({ redirect: false, latched: true })
    }
  })

  it('세션이 없는 것이 확실할 때(signedOut)만 보낸다', () => {
    for (const each of everyInput().filter((candidate) => candidate.status !== 'signedOut')) {
      expect(decideGuard(each).redirect, JSON.stringify(each)).toBe(false)
    }
  })

  it('공개 경로에서는 보내지 않고, 로그아웃 중이 아니면 래치를 남기지 않는다', () => {
    for (const each of everyInput().filter((candidate) => candidate.pathname === PUBLIC)) {
      const decision = decideGuard(each)
      expect(decision.redirect, JSON.stringify(each)).toBe(false)
      expect(decision.latched, JSON.stringify(each)).toBe(each.loggingOut)
    }
  })
})
