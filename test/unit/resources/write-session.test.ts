import { describe, expect, it } from 'vitest'

import { UNUSABLE_RESPONSE_MESSAGE } from '@/lib/auth/form-state'
import { createSessionManager } from '@/lib/auth/session-manager'
import { serializeSession, type SessionStorage, type StoredSession } from '@/lib/auth/session-store'
import type { JsonApiResult, RequestOptions } from '@/lib/jsonapi/client'
import type { JsonApiSend } from '@/lib/jsonapi/send'
import { defineResource } from '@/lib/resources/define'
import type { ResourceFormValues } from '@/lib/resources/form'
import { isSessionRejected, updateResource, type WriteDeps } from '@/lib/resources/write'

/**
 * 만료 가드를 실제 세션 관리자(lib/auth/session-manager.ts)와 잇는다 - 쓰기의 단위 시험(write.test.ts)은 세션을
 * 가짜로 꽂아 가드의 판정을 재고, 여기서는 "회전이 판정을 받지 못했다" 는 전제가 실제 관리자에서 나오는지와 그때
 * 세션이 정말 그대로인지를 잰다. 저장소·회전 전송·시계만 가짜이고 시계는 `NOW` 에 서 있다.
 *
 * 세션 관리자는 회전이 5xx·408·429·닿지 못함으로 끝나면 세션을 지우지 않고 지금의 access 를 그대로 돌려준다
 * (결정 11). 쓰기가 그 토큰을 만료된 채로 실으면 백엔드가 TOKEN_EXPIRED 를 내고 세션이 지워진다.
 */
const PROBE_CRATE = defineResource({
  type: 'probeCrates',
  path: '/probe/api/crates',
  attributes: {
    probeLabel: {
      kind: 'string',
      label: 'PROBE 라벨',
      readOnly: false,
      nullable: false,
      listed: true,
    },
  },
  relationships: {},
  filters: {},
  sorts: ['probeLabel'],
  defaultSort: 'probeLabel',
  includes: [],
  writable: true,
})

const VALUES: ResourceFormValues = { attributes: { probeLabel: 'probe-label' }, relationships: {} }
const PROBE_ID = 'probe-crate-1'
const NOW = 1_800_000_000_000
const REFRESH_PATH = '/api/v1/auth/refresh'

const TRANSIENT = {
  kind: 'failed',
  state: {
    documentErrors: [UNUSABLE_RESPONSE_MESSAGE],
    fieldErrors: {},
    relationshipErrors: {},
    submitted: VALUES,
  },
}

/** 백엔드가 낸 오류 문서 - 합성 오류가 아니다. */
function backendFailure(status: number, code: string): JsonApiResult<unknown> {
  return { ok: false, status, errors: [{ status: String(status), code, detail: `probe-${code}` }] }
}

/** 응답조차 없었다 - client.ts 가 지어낸 합성 오류다. */
const NETWORK: JsonApiResult<unknown> = {
  ok: false,
  status: 0,
  errors: [{ status: '0', code: 'NETWORK_ERROR', meta: { synthetic: true } }],
}

const ROTATED: JsonApiResult<unknown> = {
  ok: true,
  status: 200,
  document: {
    data: {
      type: 'authTokens',
      id: 'probe-jti',
      attributes: {
        accessToken: 'probe-access-new',
        refreshToken: 'probe-refresh-new',
        tokenType: 'ProbeBearer',
        expiresIn: 137,
        refreshExpiresIn: 8641,
      },
    },
  },
}

/**
 * 저장된 세션을 되살린 실제 세션 관리자와, 그것을 꽂은 쓰기의 의존성. access 는 `accessLeftMs` 뒤에 만료된다
 * (음수면 이미 만료됐다) - 앱을 오래 닫아 둔 뒤 쓰기를 처음 하는 순간이다.
 */
async function connected(accessLeftMs: number, rotation: JsonApiResult<unknown>) {
  const stored: StoredSession = {
    accessToken: 'probe-access-old',
    refreshToken: 'probe-refresh-old',
    accessExpiresAt: NOW + accessLeftMs,
    refreshExpiresAt: NOW + 8_641_000,
  }
  let value: string | null = serializeSession(stored)
  const storageLog: string[] = []
  const storage: SessionStorage = {
    read: () => Promise.resolve(value),
    write: (next) => {
      storageLog.push('write')
      value = next
      return Promise.resolve()
    },
    clear: () => {
      storageLog.push('clear')
      value = null
      return Promise.resolve()
    },
  }
  const rotations: string[] = []
  const rotate: JsonApiSend = <T>(path: string) => {
    rotations.push(path)
    return Promise.resolve(rotation) as Promise<JsonApiResult<T>>
  }
  const manager = createSessionManager({ storage, send: rotate, now: () => NOW })
  await manager.restore()

  const writes: { path: string; options: RequestOptions }[] = []
  const write: JsonApiSend = <T>(path: string, options: RequestOptions = {}) => {
    writes.push({ path, options })
    const saved: JsonApiResult<unknown> = { ok: true, status: 200, document: { data: null } }
    return Promise.resolve(saved) as Promise<JsonApiResult<T>>
  }
  const deps: WriteDeps = {
    getAccessToken: manager.getAccessToken,
    currentSession: manager.current,
    now: () => NOW,
    send: write,
  }
  return { manager, deps, stored, rotations, writes, storageLog }
}

describe('만료 가드 - 실제 세션 관리자와 잇는다', () => {
  it.each<[string, JsonApiResult<unknown>]>([
    ['서버 오류(502)', backendFailure(502, 'PROBE_BAD_GATEWAY')],
    ['요청 시간 초과(408)', backendFailure(408, 'PROBE_TIMEOUT')],
    ['요청 과다(429)', backendFailure(429, 'PROBE_TOO_MANY')],
    ['닿지 못함(상태 0)', NETWORK],
  ])(
    '회전이 %s 를 받고 access 가 이미 만료됐다 → 쓰기를 보내지 않고 앱 문구를 돌려주며 세션은 그대로다',
    async (_, rotation) => {
      const session = await connected(-1_000, rotation)
      expect(await updateResource(PROBE_CRATE, PROBE_ID, VALUES, session.deps)).toEqual(TRANSIENT)
      expect(session.rotations).toEqual([REFRESH_PATH])
      expect(session.writes).toEqual([])
      expect(session.manager.status()).toBe('signedIn')
      expect(session.manager.current()).toEqual(session.stored)
      expect(session.storageLog).toEqual([])
    },
  )

  it('회전이 5xx 여도 access 가 아직 유효하면(회전 여유 60초 안) 그 토큰으로 쓴다 - 세션도 그대로다', async () => {
    const session = await connected(30_000, backendFailure(503, 'PROBE_BUSY'))
    expect(await updateResource(PROBE_CRATE, PROBE_ID, VALUES, session.deps)).toEqual({
      kind: 'saved',
      id: PROBE_ID,
    })
    expect(session.rotations).toEqual([REFRESH_PATH])
    expect(session.writes).toHaveLength(1)
    expect(session.writes[0]?.options.accessToken).toBe('probe-access-old')
    expect(session.manager.current()).toEqual(session.stored)
  })

  it('회전이 성공하면 새 토큰으로 쓴다 - 가드는 회전한 세션의 만료를 본다', async () => {
    const session = await connected(-1_000, ROTATED)
    await updateResource(PROBE_CRATE, PROBE_ID, VALUES, session.deps)
    expect(session.writes).toHaveLength(1)
    expect(session.writes[0]?.options.accessToken).toBe('probe-access-new')
  })

  it('회전이 거절되면(TOKEN_REVOKED) 세션 거절을 던지고 쓰기는 보내지 않는다 - 판정한 거절은 세션을 지운다', async () => {
    const session = await connected(-1_000, backendFailure(401, 'TOKEN_REVOKED'))
    await expect(updateResource(PROBE_CRATE, PROBE_ID, VALUES, session.deps)).rejects.toSatisfy(
      isSessionRejected,
    )
    expect(session.writes).toEqual([])
    expect(session.manager.status()).toBe('signedOut')
  })
})
