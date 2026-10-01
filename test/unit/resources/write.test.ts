import { afterEach, describe, expect, it, vi } from 'vitest'

import { UNUSABLE_RESPONSE_MESSAGE } from '@/lib/auth/form-state'
import type { JsonApiResult, RequestOptions } from '@/lib/jsonapi/client'
import type { ErrorObject, SingleDocument } from '@/lib/jsonapi/document'
import type { JsonApiSend } from '@/lib/jsonapi/send'
import { defineResource } from '@/lib/resources/define'
import type { ResourceFormValues } from '@/lib/resources/form'
import {
  createResource,
  deleteResource,
  isSessionRejected,
  sessionRejected,
  updateResource,
  type WriteDeps,
} from '@/lib/resources/write'

/**
 * 쓰기 한 번의 흐름(lib/resources/write.ts) - 세션 확인 → 요청 → 응답 해석(스펙 7.3·8.4·9.2).
 *
 * 전송과 토큰은 가짜를 주입한다. 자원은 `probe*` 로 만든다(form.test.ts 와 같은 규칙) - 경로·id·
 * 토큰·문구가 전부 실전과 다르다. 폼 값은 실전처럼 전부 문자열이다.
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
    probeCount: {
      kind: 'int',
      label: 'PROBE 개수',
      readOnly: false,
      nullable: false,
      listed: true,
    },
  },
  relationships: {
    probeShelf: { cardinality: 'one', type: 'probeShelves', label: 'PROBE 선반' },
  },
  filters: {},
  sorts: ['probeLabel'],
  defaultSort: 'probeLabel',
  includes: [],
  writable: true,
})

const VALUES: ResourceFormValues = {
  attributes: { probeLabel: 'probe-label', probeCount: '7' },
  relationships: { probeShelf: ['probe-shelf-1'] },
}

const TOKEN = 'probe-access-token'
const PROBE_ID = 'probe-crate-1'

/** 가짜 시계가 서 있는 시각 - 세션의 access 만료는 이 시각을 기준으로 잡는다. */
const NOW = 1_800_000_000_000

/** 백엔드가 낸 오류 하나. */
function backendError(error: Partial<ErrorObject> & { code: string }): ErrorObject {
  return { status: '400', title: 'probe-title', detail: `probe-detail-${error.code}`, ...error }
}

/** client.ts 가 지어낸 오류의 모양(백엔드에 닿지 못함) - 코드는 실전 세 코드가 아니다. */
const SYNTHETIC: ErrorObject = {
  status: '0',
  code: 'PROBE_SYNTHETIC',
  title: 'PROBE_SYNTHETIC',
  detail: 'probe-synthetic-detail',
  meta: { synthetic: true },
}

function failed(status: number, errors: ErrorObject[]): JsonApiResult<SingleDocument> {
  return { ok: false, status, errors }
}

function created(id: string | null): JsonApiResult<SingleDocument> {
  return {
    ok: true,
    status: 201,
    document: { data: id === null ? null : { type: 'probeCrates', id } },
  }
}

/**
 * 보낸 요청을 적고 정해 둔 결과를 차례로 돌려주는 가짜 의존성. 세션은 access 가 15분 남은 멀쩡한 것이다 - 만료를
 * 시험하는 곳만 `currentSession` 을 바꾼다.
 */
function probeDeps(
  results: JsonApiResult<SingleDocument>[],
  token: () => Promise<string | null> = () => Promise.resolve(TOKEN),
) {
  const sent: { path: string; options: RequestOptions }[] = []
  let tokenCalls = 0
  const send: JsonApiSend = <T>(path: string, options: RequestOptions = {}) => {
    sent.push({ path, options })
    const next = results.shift()
    if (next === undefined) return Promise.reject(new Error(`준비하지 않은 요청: ${path}`))
    return Promise.resolve(next) as Promise<JsonApiResult<T>>
  }
  const deps: WriteDeps = {
    getAccessToken: () => {
      tokenCalls += 1
      return token()
    },
    currentSession: () => ({ accessExpiresAt: NOW + 900_000 }),
    now: () => NOW,
    send,
  }
  return { deps, sent, tokenCalls: () => tokenCalls }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('sessionRejected · isSessionRejected', () => {
  it('sessionRejected 가 만든 오류만 세션 거절이다', () => {
    expect(isSessionRejected(sessionRejected())).toBe(true)
    expect(isSessionRejected(new Error('probe'))).toBe(false)
    expect(isSessionRejected('SessionRejected')).toBe(false)
    expect(isSessionRejected(null)).toBe(false)
    expect(isSessionRejected({ name: 'SessionRejected' })).toBe(false)
  })
})

describe('createResource', () => {
  it('자원 경로에 POST 하고 writeDocument 의 본문과 토큰을 싣는다 - 쿼리도 data.id 도 없다', async () => {
    const { deps, sent } = probeDeps([created(PROBE_ID)])
    await expect(createResource(PROBE_CRATE, VALUES, deps)).resolves.toEqual({
      kind: 'saved',
      id: PROBE_ID,
    })
    expect(sent).toEqual([
      {
        path: '/probe/api/crates',
        options: {
          method: 'POST',
          accessToken: TOKEN,
          body: {
            data: {
              type: 'probeCrates',
              attributes: { probeLabel: 'probe-label', probeCount: 7 },
              relationships: {
                probeShelf: { data: { type: 'probeShelves', id: 'probe-shelf-1' } },
              },
            },
          },
        },
      },
    ])
  })

  it('세션이 없으면 요청하지 않고 세션 거절을 던진다 - 스펙 7.3 의 두 번째 겹', async () => {
    const { deps, sent } = probeDeps([], () => Promise.resolve(null))
    await expect(createResource(PROBE_CRATE, VALUES, deps)).rejects.toSatisfy(isSessionRejected)
    expect(sent).toEqual([])
  })

  it('토큰을 받다 저장소가 실패하면 요청하지 않고 앱 문구를 그린다 - 오류는 기기 로그에 남긴다', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { deps, sent } = probeDeps([], () => Promise.reject(new Error('probe-storage')))
    const outcome = await createResource(PROBE_CRATE, VALUES, deps)
    expect(outcome).toEqual({
      kind: 'failed',
      state: {
        documentErrors: [UNUSABLE_RESPONSE_MESSAGE],
        fieldErrors: {},
        relationshipErrors: {},
        submitted: VALUES,
      },
    })
    expect(sent).toEqual([])
    expect(logged).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['Error 는 이름과 문구', new Error('probe-storage'), 'Error: probe-storage'],
    ['오류가 아닌 값(문자열)은 값이 아니라 종류', 'probe-secret-token', 'string'],
  ])('토큰을 받다 거절당하면 로그에 %s 만 남긴다', async (_label, rejection, detail) => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { deps } = probeDeps([], vi.fn().mockRejectedValue(rejection))
    await createResource(PROBE_CRATE, VALUES, deps)
    expect(logged).toHaveBeenCalledTimes(1)
    expect(String(logged.mock.calls[0]?.[0])).toMatch(new RegExp(` - ${detail}$`))
    expect(String(logged.mock.calls[0]?.[0])).not.toContain('probe-secret-token')
  })

  it.each(['AUTHENTICATION_REQUIRED', 'INVALID_TOKEN', 'TOKEN_EXPIRED', 'TOKEN_REVOKED'])(
    '%s 이면 세션 거절을 던지고 다시 보내지 않는다 - 401 에 회전·재시도를 붙이지 않는다',
    async (code) => {
      const { deps, sent, tokenCalls } = probeDeps([
        failed(401, [backendError({ status: '401', code })]),
      ])
      await expect(createResource(PROBE_CRATE, VALUES, deps)).rejects.toSatisfy(isSessionRejected)
      expect(sent).toHaveLength(1)
      expect(tokenCalls()).toBe(1)
    },
  )

  it('검증 오류는 필드 오류가 든 폼 상태다 - 제출한 값을 그대로 싣는다', async () => {
    const { deps } = probeDeps([
      failed(422, [
        backendError({
          status: '422',
          code: 'VALIDATION_ERROR',
          source: { pointer: '/data/attributes/probeLabel' },
        }),
        backendError({
          status: '404',
          code: 'RELATIONSHIP_RESOURCE_NOT_FOUND',
          source: { pointer: '/data/relationships/probeShelf/data/id' },
        }),
      ]),
    ])
    expect(await createResource(PROBE_CRATE, VALUES, deps)).toEqual({
      kind: 'failed',
      state: {
        documentErrors: [],
        fieldErrors: { probeLabel: ['probe-detail-VALIDATION_ERROR'] },
        relationshipErrors: { probeShelf: ['probe-detail-RELATIONSHIP_RESOURCE_NOT_FOUND'] },
        submitted: VALUES,
      },
    })
  })

  it('포인터 없는 오류는 배너 문구다', async () => {
    const { deps } = probeDeps([
      failed(409, [backendError({ status: '409', code: 'PROBE_CONFLICT' })]),
    ])
    const outcome = await createResource(PROBE_CRATE, VALUES, deps)
    expect(outcome.kind === 'failed' && outcome.state.documentErrors).toEqual([
      'probe-detail-PROBE_CONFLICT',
    ])
  })

  it('만드는 쓰기의 RESOURCE_NOT_FOUND 는 not-found 가 아니라 배너 문구다 - 없어진 자원이 없다', async () => {
    const { deps } = probeDeps([
      failed(404, [backendError({ status: '404', code: 'RESOURCE_NOT_FOUND' })]),
    ])
    expect(await createResource(PROBE_CRATE, VALUES, deps)).toEqual({
      kind: 'failed',
      state: {
        documentErrors: ['probe-detail-RESOURCE_NOT_FOUND'],
        fieldErrors: {},
        relationshipErrors: {},
        submitted: VALUES,
      },
    })
  })

  it('백엔드에 닿지 못하면(합성 오류) 던지지 않고 앱 문구다 - 스펙 9.3', async () => {
    const { deps } = probeDeps([failed(0, [SYNTHETIC])])
    const outcome = await createResource(PROBE_CRATE, VALUES, deps)
    expect(outcome.kind === 'failed' && outcome.state.documentErrors).toEqual([
      UNUSABLE_RESPONSE_MESSAGE,
    ])
  })

  it('성공했는데 만든 자원의 id 가 없으면(data: null·204) 앱 문구로 물러선다', async () => {
    for (const result of [
      created(null),
      { ok: true, status: 204, document: null } as const,
    ] satisfies JsonApiResult<SingleDocument>[]) {
      const { deps } = probeDeps([result])
      const outcome = await createResource(PROBE_CRATE, VALUES, deps)
      expect(outcome.kind === 'failed' && outcome.state.documentErrors).toEqual([
        UNUSABLE_RESPONSE_MESSAGE,
      ])
    }
  })
})

describe('updateResource', () => {
  it('자원 하나의 경로에 PATCH 하고 본문의 data.id 가 URL 의 id 와 같다 - id 는 경로에서만 이스케이프한다', async () => {
    const id = 'probe/crate?1'
    const { deps, sent } = probeDeps([{ ok: true, status: 200, document: { data: null } }])
    expect(await updateResource(PROBE_CRATE, id, VALUES, deps)).toEqual({ kind: 'saved', id })
    expect(sent[0]?.path).toBe('/probe/api/crates/probe%2Fcrate%3F1')
    expect(sent[0]?.options.method).toBe('PATCH')
    expect(sent[0]?.options.accessToken).toBe(TOKEN)
    expect(sent[0]?.options.body).toMatchObject({ data: { type: 'probeCrates', id } })
  })

  it('속성과 관계를 매번 전부 보낸다 - 바뀐 것만 보내지 않는다', async () => {
    const { deps, sent } = probeDeps([{ ok: true, status: 200, document: { data: null } }])
    await updateResource(PROBE_CRATE, PROBE_ID, VALUES, deps)
    const body = sent[0]?.options.body as { data: Record<string, unknown> }
    expect(Object.keys(body.data.attributes as object)).toEqual(['probeLabel', 'probeCount'])
    expect(Object.keys(body.data.relationships as object)).toEqual(['probeShelf'])
  })

  it('수정할 자원이 없으면(RESOURCE_NOT_FOUND) notFound 다', async () => {
    const { deps } = probeDeps([
      failed(404, [backendError({ status: '404', code: 'RESOURCE_NOT_FOUND' })]),
    ])
    expect(await updateResource(PROBE_CRATE, PROBE_ID, VALUES, deps)).toEqual({ kind: 'notFound' })
  })

  it('검증 오류는 필드·관계 오류가 든 폼 상태다 - 제출한 값을 그대로 싣는다', async () => {
    const { deps } = probeDeps([
      failed(422, [
        backendError({
          status: '422',
          code: 'VALIDATION_ERROR',
          source: { pointer: '/data/attributes/probeLabel' },
        }),
        backendError({
          status: '404',
          code: 'RELATIONSHIP_RESOURCE_NOT_FOUND',
          source: { pointer: '/data/relationships/probeShelf/data/id' },
        }),
      ]),
    ])
    expect(await updateResource(PROBE_CRATE, PROBE_ID, VALUES, deps)).toEqual({
      kind: 'failed',
      state: {
        documentErrors: [],
        fieldErrors: { probeLabel: ['probe-detail-VALIDATION_ERROR'] },
        relationshipErrors: { probeShelf: ['probe-detail-RELATIONSHIP_RESOURCE_NOT_FOUND'] },
        submitted: VALUES,
      },
    })
  })

  it('포인터 없는 오류는 배너 문구다', async () => {
    const { deps } = probeDeps([
      failed(409, [backendError({ status: '409', code: 'PROBE_CONFLICT' })]),
    ])
    expect(await updateResource(PROBE_CRATE, PROBE_ID, VALUES, deps)).toEqual({
      kind: 'failed',
      state: {
        documentErrors: ['probe-detail-PROBE_CONFLICT'],
        fieldErrors: {},
        relationshipErrors: {},
        submitted: VALUES,
      },
    })
  })

  it('세션이 없으면 요청하지 않고, 인증 오류면 세션 거절을 던진다', async () => {
    const none = probeDeps([], () => Promise.resolve(null))
    await expect(updateResource(PROBE_CRATE, PROBE_ID, VALUES, none.deps)).rejects.toSatisfy(
      isSessionRejected,
    )
    expect(none.sent).toEqual([])

    const revoked = probeDeps([
      failed(401, [backendError({ status: '401', code: 'TOKEN_REVOKED' })]),
    ])
    await expect(updateResource(PROBE_CRATE, PROBE_ID, VALUES, revoked.deps)).rejects.toSatisfy(
      isSessionRejected,
    )
  })

  it('백엔드에 닿지 못함과 저장소 실패는 앱 문구다 - 저장소 실패는 요청하지 않고 기기 로그에 남긴다', async () => {
    const { deps } = probeDeps([failed(0, [SYNTHETIC])])
    const outcome = await updateResource(PROBE_CRATE, PROBE_ID, VALUES, deps)
    expect(outcome.kind === 'failed' && outcome.state.documentErrors).toEqual([
      UNUSABLE_RESPONSE_MESSAGE,
    ])

    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const storage = probeDeps([], () => Promise.reject(new Error('probe-storage')))
    expect(await updateResource(PROBE_CRATE, PROBE_ID, VALUES, storage.deps)).toEqual({
      kind: 'failed',
      state: {
        documentErrors: [UNUSABLE_RESPONSE_MESSAGE],
        fieldErrors: {},
        relationshipErrors: {},
        submitted: VALUES,
      },
    })
    expect(storage.sent).toEqual([])
    expect(logged).toHaveBeenCalledTimes(1)
  })
})

describe('deleteResource', () => {
  it('자원 하나의 경로에 본문 없이 DELETE 하고 204 면 deleted 다', async () => {
    const { deps, sent } = probeDeps([{ ok: true, status: 204, document: null }])
    expect(await deleteResource(PROBE_CRATE, 'probe/crate', deps)).toEqual({ kind: 'deleted' })
    expect(sent).toEqual([
      {
        path: '/probe/api/crates/probe%2Fcrate',
        options: { method: 'DELETE', accessToken: TOKEN },
      },
    ])
  })

  it('이미 없으면(RESOURCE_NOT_FOUND) 그것도 deleted 다 - 원하던 결과가 이미 이뤄져 있다', async () => {
    const { deps } = probeDeps([
      failed(404, [backendError({ status: '404', code: 'RESOURCE_NOT_FOUND' })]),
    ])
    expect(await deleteResource(PROBE_CRATE, PROBE_ID, deps)).toEqual({ kind: 'deleted' })
  })

  it('세션이 없으면 요청하지 않고, 인증 오류면 세션 거절을 던진다', async () => {
    const none = probeDeps([], () => Promise.resolve(null))
    await expect(deleteResource(PROBE_CRATE, PROBE_ID, none.deps)).rejects.toSatisfy(
      isSessionRejected,
    )
    expect(none.sent).toEqual([])

    const expired = probeDeps([
      failed(401, [backendError({ status: '401', code: 'TOKEN_EXPIRED' })]),
    ])
    await expect(deleteResource(PROBE_CRATE, PROBE_ID, expired.deps)).rejects.toSatisfy(
      isSessionRejected,
    )
  })

  it('그 밖의 실패는 백엔드 문구, 닿지 못함과 저장소 실패는 앱 문구다', async () => {
    const conflict = probeDeps([
      failed(409, [backendError({ status: '409', code: 'PROBE_CONFLICT' })]),
    ])
    expect(await deleteResource(PROBE_CRATE, PROBE_ID, conflict.deps)).toEqual({
      kind: 'failed',
      messages: ['probe-detail-PROBE_CONFLICT'],
    })

    const unreachable = probeDeps([failed(0, [SYNTHETIC])])
    expect(await deleteResource(PROBE_CRATE, PROBE_ID, unreachable.deps)).toEqual({
      kind: 'failed',
      messages: [UNUSABLE_RESPONSE_MESSAGE],
    })

    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const storage = probeDeps([], () => Promise.reject(new Error('probe-storage')))
    expect(await deleteResource(PROBE_CRATE, PROBE_ID, storage.deps)).toEqual({
      kind: 'failed',
      messages: [UNUSABLE_RESPONSE_MESSAGE],
    })
    expect(storage.sent).toEqual([])
  })
})

/**
 * 만료 가드 - 세션 관리자는 회전이 판정을 받지 못하면(5xx·408·429·닿지 못함) 지금의 access 를 그대로 돌려준다.
 * access 는 15분이고 쓰기만 그 토큰을 쓰므로, 회전이 필요한 순간에는 이미 만료돼 있는 일이 흔하다. 그 토큰을
 * 실어 보내면 TOKEN_EXPIRED 가 오고 세션이 지워진다 - 회전의 502 하나가 쓰기 한 번 늦게 로그아웃이 된다.
 * 그래서 받은 토큰의 세션이 이미 만료됐으면 요청하지 않고 앱 문구로 알린다(던지지 않는다 - 세션 거절이 아니다).
 * 실제 세션 관리자와 잇는 시험은 test/unit/resources/write-session.test.ts 다.
 */
const TRANSIENT_STATE = {
  documentErrors: [UNUSABLE_RESPONSE_MESSAGE],
  fieldErrors: {},
  relationshipErrors: {},
  submitted: VALUES,
}

describe.each([
  {
    name: '생성',
    run: (deps: WriteDeps) => createResource(PROBE_CRATE, VALUES, deps),
    reply: created(PROBE_ID),
    method: 'POST',
    transient: { kind: 'failed', state: TRANSIENT_STATE },
  },
  {
    name: '수정',
    run: (deps: WriteDeps) => updateResource(PROBE_CRATE, PROBE_ID, VALUES, deps),
    reply: { ok: true, status: 200, document: { data: null } } as JsonApiResult<SingleDocument>,
    method: 'PATCH',
    transient: { kind: 'failed', state: TRANSIENT_STATE },
  },
  {
    name: '삭제',
    run: (deps: WriteDeps) => deleteResource(PROBE_CRATE, PROBE_ID, deps),
    reply: { ok: true, status: 204, document: null } as JsonApiResult<SingleDocument>,
    method: 'DELETE',
    transient: { kind: 'failed', messages: [UNUSABLE_RESPONSE_MESSAGE] },
  },
])('만료 가드 - $name', ({ run, reply, method, transient }) => {
  it('access 가 이미 만료됐으면 요청하지 않고 앱 문구를 돌려준다 - 던지지 않는다', async () => {
    const { deps, sent, tokenCalls } = probeDeps([])
    const outcome = await run({ ...deps, currentSession: () => ({ accessExpiresAt: NOW - 1 }) })
    expect(outcome).toEqual(transient)
    expect(sent).toEqual([])
    expect(tokenCalls()).toBe(1)
  })

  it('만료 시각과 같은 순간도 만료다', async () => {
    const { deps, sent } = probeDeps([])
    const outcome = await run({ ...deps, currentSession: () => ({ accessExpiresAt: NOW }) })
    expect(outcome).toEqual(transient)
    expect(sent).toEqual([])
  })

  it('access 가 아직 유효하면(1ms 남았어도) 그 토큰으로 보낸다', async () => {
    const { deps, sent } = probeDeps([reply])
    await run({ ...deps, currentSession: () => ({ accessExpiresAt: NOW + 1 }) })
    expect(sent).toHaveLength(1)
    expect(sent[0]?.options.method).toBe(method)
    expect(sent[0]?.options.accessToken).toBe(TOKEN)
  })
})

describe('만료 가드 - 세션을 알 수 없을 때', () => {
  it('currentSession 이 null 이면 만료를 판정할 수 없다 - getAccessToken 이 준 토큰으로 보낸다', async () => {
    const { deps, sent } = probeDeps([created(PROBE_ID)])
    await createResource(PROBE_CRATE, VALUES, { ...deps, currentSession: () => null })
    expect(sent).toHaveLength(1)
    expect(sent[0]?.options.accessToken).toBe(TOKEN)
  })

  it('토큰이 없으면(세션이 없다) 만료 가드보다 앞서 세션 거절을 던진다 - 요청하지 않는다', async () => {
    const none = probeDeps([], () => Promise.resolve(null))
    await expect(
      createResource(PROBE_CRATE, VALUES, {
        ...none.deps,
        currentSession: () => ({ accessExpiresAt: NOW - 1 }),
      }),
    ).rejects.toSatisfy(isSessionRejected)
    expect(none.sent).toEqual([])
  })
})
