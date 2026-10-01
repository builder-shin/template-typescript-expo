import { afterEach, describe, expect, it, vi } from 'vitest'

import { JSONAPI_MEDIA_TYPE, type JsonApiResult, type RequestOptions } from '@/lib/jsonapi/client'
import type { ErrorObject } from '@/lib/jsonapi/document'
import type { JsonApiSend } from '@/lib/jsonapi/send'
import { EXPERIMENTS } from '@/lib/lab/experiments'
import { COMBINED_NOTE_PREFIX, parseCombinedSteps, type ExperimentResult } from '@/lib/lab/result'
import { PROBE_LAB_EXAMPLE_ID, runExperiment, type LabDeps } from '@/lib/lab/run'
import { EXAMPLE, EXAMPLE_TAG } from '@/lib/resources'
import { isSessionRejected, type WriteSession } from '@/lib/resources/write'

/**
 * 계약 실험실의 실행부(lib/lab/run.ts) - 실험마다 무엇을 보내고, 응답을 어떻게 결과로 옮기고, 세션을 어떻게
 * 다루는가(스펙 8.6·7.3·9.2).
 *
 * 전송·토큰·지금의 세션·시계·기기 언어는 가짜를 주입한다 - 토큰과 언어는 실전과 다른 값이다. 경로와 본문은
 * 실험이 실제로 부르는 자원(`EXAMPLE`·`EXAMPLE_TAG`)의 것이다 - 실험실은 그 자원에 묶여 있다(스펙 8.6). 토큰을
 * 받는 길(세션 가드·만료 가드·저장소 실패)은 쓰기의 것이라(`lib/resources/write.ts` 의 `accessToken`) 판정의
 * 갈래는 `test/unit/resources/write.test.ts` 가 재고, 여기서는 세션이 필요한 실험이 모두 그 길을 지나는지 잰다.
 *
 * 쪽 크기(3·1)와 순회 상한(20)은 실행부의 상수를 가져오지 않고 값으로 적는다 - 가져오면 상수를 바꿔도 시험이 따라
 * 바뀌어 아무것도 재지 못한다. 실험이 보내는 본문과 화면에 적히는 요청 본문·헤더도 같은 까닭으로 값 그대로 맞댄다.
 */
const TOKEN = 'probe-access-token'
const DEVICE_LANGUAGE = 'probe-lang,probe-other;q=0.9'
const RELATIONSHIPS_PATH = `${EXAMPLE.path}/${PROBE_LAB_EXAMPLE_ID}/relationships/tags`

/**
 * 실험이 보내야 하는 본문 전부 - 한 글자도 더하거나 덜지 않는다(정확히 같아야 통과한다). PUT 은 전체 교체라 본문에
 * 없는 필드(설명·관계)를 지우는 것이 `putUpsert` 가 실증하는 동작이고, 검증 오류 본문은 제목 하나만 `minLength: 1`
 * 을 어긴다(스펙 8.6). 값은 실행부의 것을 옮겨 적은 것이다 - 실행부에서 가져오면 둘이 늘 같아 아무것도 재지 못한다.
 */
const PUT_BODY = {
  data: {
    type: EXAMPLE.type,
    id: PROBE_LAB_EXAMPLE_ID,
    attributes: { title: 'probe-lab PUT upsert 대상', status: 'draft', score: 0 },
  },
}
const INVALID_BODY = {
  data: { type: EXAMPLE.type, attributes: { title: '', status: 'draft', score: 0 } },
}

/** 가짜 시계가 서 있는 시각 - 세션의 access 만료는 이 시각을 기준으로 잡는다. */
const NOW = 1_800_000_000_000
const LIVE_SESSION: WriteSession = { accessExpiresAt: NOW + 60_000 }
/** 회전이 판정을 받지 못해 세션 관리자가 지금의 access 를 그대로 돌려준 세션 - 이미 만료됐다(스펙 7.2). */
const EXPIRED_SESSION: WriteSession = { accessExpiresAt: NOW - 1 }

const SESSION_IDS = EXPERIMENTS.filter((e) => e.needsSession).map((e) => e.id)
const SESSIONLESS_IDS = EXPERIMENTS.filter((e) => !e.needsSession).map((e) => e.id)

type Respond = (path: string, options: RequestOptions) => JsonApiResult<unknown>

interface SentRequest {
  readonly path: string
  readonly options: RequestOptions
}

interface ProbeOptions {
  /** 세션 관리자의 `getAccessToken` - 기본은 늘 `TOKEN` 이다. */
  readonly token?: () => Promise<string | null>
  /** 기기 언어 - 기본은 `DEVICE_LANGUAGE`, `null` 이면 쓸 태그가 없다. */
  readonly language?: string | null
  /** 세션 관리자의 `current` - 기본은 아직 만료되지 않은 세션이다. */
  readonly session?: WriteSession | null
}

/** 보낸 요청을 적고 `respond` 가 정한 결과를 돌려주는 가짜 의존성. */
function probeDeps(respond: Respond, options: ProbeOptions = {}) {
  const sent: SentRequest[] = []
  let tokenCalls = 0
  const token = options.token ?? (() => Promise.resolve(TOKEN))
  const language = options.language === undefined ? DEVICE_LANGUAGE : options.language
  const session = options.session === undefined ? LIVE_SESSION : options.session
  const send: JsonApiSend = <T>(path: string, requestOptions: RequestOptions = {}) => {
    sent.push({ path, options: requestOptions })
    return Promise.resolve(respond(path, requestOptions)) as Promise<JsonApiResult<T>>
  }
  const deps: LabDeps = {
    send,
    getAccessToken: () => {
      tokenCalls += 1
      return token()
    },
    currentSession: () => session,
    now: () => NOW,
    deviceLanguage: () => language,
  }
  return { deps, sent, tokenCalls: () => tokenCalls }
}

/** 응답으로 끝난 실험의 결과 - `unusable` 로 끝났으면 시험이 실패한다. */
async function resultOf(id: string, deps: LabDeps): Promise<ExperimentResult> {
  const outcome = await runExperiment(id, deps)
  if (outcome.kind !== 'result') throw new Error(`${id} 가 결과 없이 ${outcome.kind} 로 끝났다`)
  return outcome.result
}

function ok(status: number, document: unknown = { data: null }): JsonApiResult<unknown> {
  return { ok: true, status, document }
}

const NO_CONTENT: JsonApiResult<unknown> = { ok: true, status: 204, document: null }

function failure(status: number, code: string): JsonApiResult<unknown> {
  const error: ErrorObject = { status: String(status), code, title: 'probe-title', detail: 'probe' }
  return { ok: false, status, errors: [error] }
}

/** 컬렉션 한 쪽 - `next` 가 `undefined` 면 links 에 키가 없다(NestJS 의 모양). */
function page(ids: readonly string[], next?: string | null): JsonApiResult<unknown> {
  const data = ids.map((id) => ({ type: 'probeRows', id }))
  if (next === undefined) return ok(200, { data, links: {} })
  return ok(200, { data, links: { next } })
}

/** 어떤 요청에도 성공하는 백엔드 - 세션 가드만 재는 시험이 쓴다. */
const ANYTHING_OK: Respond = (_path, options) => {
  if (options.method === 'DELETE' || options.method === 'POST') return NO_CONTENT
  if (options.method === 'PUT') return ok(201)
  return page(['probe-row-1'], null)
}

function queryOf(request: SentRequest | undefined): Record<string, string> {
  return Object.fromEntries(request?.options.query ?? new URLSearchParams())
}

/** 본문과 토큰을 싣는 요청의 보낸 요청 헤더 - 토큰은 보냈다는 사실만 적힌다. 여러 단계면 마지막 단계의 것이 결과에 보인다. */
function writeHeaders(language: string): Record<string, string> {
  return {
    accept: JSONAPI_MEDIA_TYPE,
    'content-type': JSONAPI_MEDIA_TYPE,
    'accept-language': language,
    authorization: 'Bearer <redacted>',
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('runExperiment - 세션 가드(스펙 7.3)', () => {
  it.each(SESSION_IDS)('%s 는 세션이 없으면 요청하지 않고 세션 거절을 던진다', async (id) => {
    const { deps, sent } = probeDeps(ANYTHING_OK, { token: () => Promise.resolve(null) })

    const outcome = runExperiment(id, deps)

    await expect(outcome).rejects.toSatisfy(isSessionRejected)
    expect(sent).toEqual([])
  })

  it.each(SESSION_IDS)(
    '%s 는 받은 토큰의 세션이 이미 만료됐으면 요청하지 않고 unusable 로 끝난다 - 세션 거절이 아니다(만료 가드)',
    async (id) => {
      const { deps, sent, tokenCalls } = probeDeps(ANYTHING_OK, { session: EXPIRED_SESSION })

      expect(await runExperiment(id, deps)).toEqual({ kind: 'unusable' })
      expect(tokenCalls()).toBe(1)
      expect(sent).toEqual([])
    },
  )

  it.each(SESSIONLESS_IDS)(
    '%s 는 세션 없이 돈다 - 토큰을 묻지 않고 싣지 않으며 세션의 만료를 보지 않는다',
    async (id) => {
      const { deps, sent, tokenCalls } = probeDeps(ANYTHING_OK, {
        token: () => Promise.resolve(null),
        session: EXPIRED_SESSION,
      })

      expect((await runExperiment(id, deps)).kind).toBe('result')
      expect(tokenCalls()).toBe(0)
      expect(sent.length).toBeGreaterThan(0)
      for (const request of sent) expect(request.options).not.toHaveProperty('accessToken')
    },
  )

  it('토큰을 받다 저장소가 실패하면 요청하지 않고 unusable 로 끝난다 - 던지지 않고 오류는 기기 로그에 남는다', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { deps, sent } = probeDeps(ANYTHING_OK, {
      token: () => Promise.reject(new Error('probe-storage-failure')),
    })

    expect(await runExperiment('putUpsert', deps)).toEqual({ kind: 'unusable' })
    expect(sent).toEqual([])
    expect(logged).toHaveBeenCalledTimes(1)
  })

  it('세션이 필요한 실험은 토큰을 한 번만 받는다 - 회전은 세션 관리자 안에서 한 번이다', async () => {
    const { deps, tokenCalls } = probeDeps(ANYTHING_OK)

    await runExperiment('relationshipWrite', deps)

    expect(tokenCalls()).toBe(1)
  })
})

describe('putUpsert', () => {
  it('고정 id 로 PUT 하고 원본 응답을 그대로 결과로 옮긴다 - 토큰 원문은 결과에 없다', async () => {
    const document = { data: { type: 'examples', id: PROBE_LAB_EXAMPLE_ID, probeDial: 7 } }
    const { deps, sent } = probeDeps(() => ok(201, document))

    const result = await resultOf('putUpsert', deps)

    expect(sent).toHaveLength(1)
    expect(sent[0]?.path).toBe(`${EXAMPLE.path}/${PROBE_LAB_EXAMPLE_ID}`)
    expect(sent[0]?.options).toMatchObject({
      method: 'PUT',
      accessToken: TOKEN,
      acceptLanguage: DEVICE_LANGUAGE,
    })
    expect(sent[0]?.options.body).toEqual(PUT_BODY)
    expect(result.status).toBe(201)
    expect(JSON.parse(result.body)).toEqual(document)
    // 화면에 적힌 요청 본문은 실제로 나간 본문이다.
    expect(result.request).toEqual({
      method: 'PUT',
      path: `${EXAMPLE.path}/${PROBE_LAB_EXAMPLE_ID}`,
      body: JSON.stringify(sent[0]?.options.body, null, 2),
    })
    expect(result.headers).toEqual(writeHeaders(DEVICE_LANGUAGE))
    expect(JSON.stringify(result)).not.toContain(TOKEN)
  })

  it.each(['AUTHENTICATION_REQUIRED', 'INVALID_TOKEN', 'TOKEN_EXPIRED', 'TOKEN_REVOKED'])(
    '백엔드가 세션을 거절하면(%s) 세션 거절을 던진다',
    async (code) => {
      const { deps } = probeDeps(() => failure(401, code))

      await expect(runExperiment('putUpsert', deps)).rejects.toSatisfy(isSessionRejected)
    },
  )

  it('세션 밖의 실패는 던지지 않고 그대로 보인다', async () => {
    const { deps } = probeDeps(() => failure(422, 'VALIDATION_ERROR'))

    const result = await resultOf('putUpsert', deps)

    expect(result.status).toBe(422)
    expect(JSON.parse(result.body)).toEqual({
      errors: [expect.objectContaining({ code: 'VALIDATION_ERROR' })],
    })
  })
})

describe('relationshipWrite', () => {
  const TAG_ID = 'probe-tag-1'
  const tagsThenNoContent: Respond = (path) =>
    path === EXAMPLE_TAG.path
      ? ok(200, { data: [{ type: EXAMPLE_TAG.type, id: TAG_ID }] })
      : NO_CONTENT

  it('태그 하나를 토큰 없이 찾고, 그 태그를 붙였다 뗀다 - 세 단계가 결과에 다 보인다', async () => {
    const { deps, sent } = probeDeps(tagsThenNoContent)

    const result = await resultOf('relationshipWrite', deps)

    expect(sent.map((request) => [request.options.method ?? 'GET', request.path])).toEqual([
      ['GET', EXAMPLE_TAG.path],
      ['POST', RELATIONSHIPS_PATH],
      ['DELETE', RELATIONSHIPS_PATH],
    ])
    expect(queryOf(sent[0])).toEqual({ 'page[size]': '1' })
    expect(sent[0]?.options).not.toHaveProperty('accessToken')
    expect(sent[0]?.options).not.toHaveProperty('body')
    const linkage = { data: [{ type: EXAMPLE_TAG.type, id: TAG_ID }] }
    expect(sent[1]?.options.body).toEqual(linkage)
    expect(sent[2]?.options.body).toEqual(linkage)
    expect(sent[1]?.options).toMatchObject({ accessToken: TOKEN })
    expect(sent[2]?.options).toMatchObject({ accessToken: TOKEN })

    const { steps } = parseCombinedSteps(result.body)
    expect(steps).toHaveLength(3)
    expect(steps[1]?.heading).toContain('(상태 204)')
    expect(steps[2]?.heading).toContain('(상태 204)')
    expect(result.request).toEqual({ method: 'GET + POST + DELETE', path: RELATIONSHIPS_PATH })
    expect(result.headers).toEqual(writeHeaders(DEVICE_LANGUAGE))
  })

  it('태그가 하나도 없으면 조회 한 단계와 그 사실만 보이고 쓰지 않는다', async () => {
    const { deps, sent } = probeDeps(() => ok(200, { data: [] }))

    const result = await resultOf('relationshipWrite', deps)

    expect(sent).toHaveLength(1)
    const { steps, note } = parseCombinedSteps(result.body)
    expect(steps).toHaveLength(1)
    expect(note).toContain('태그가 하나도 없어')
  })

  it('조회가 실패하면 그 한 단계만 보이고 쓰지 않는다', async () => {
    const { deps, sent } = probeDeps(() => failure(0, 'PROBE_UNREACHABLE'))

    const result = await resultOf('relationshipWrite', deps)

    expect(sent).toHaveLength(1)
    expect(parseCombinedSteps(result.body).steps).toHaveLength(1)
    expect(result.status).toBe(0)
  })

  it('추가가 세션 거절을 받으면 던지고 제거를 보내지 않는다', async () => {
    const { deps, sent } = probeDeps((path, options) =>
      options.method === 'POST' ? failure(401, 'TOKEN_REVOKED') : tagsThenNoContent(path, options),
    )

    await expect(runExperiment('relationshipWrite', deps)).rejects.toSatisfy(isSessionRejected)
    expect(sent.map((request) => request.options.method ?? 'GET')).toEqual(['GET', 'POST'])
  })

  it('제거가 세션 거절을 받으면 던진다 - 앞의 조회와 추가는 이미 나갔다', async () => {
    const { deps, sent } = probeDeps((path, options) =>
      options.method === 'DELETE'
        ? failure(401, 'TOKEN_REVOKED')
        : tagsThenNoContent(path, options),
    )

    await expect(runExperiment('relationshipWrite', deps)).rejects.toSatisfy(isSessionRejected)
    expect(sent.map((request) => request.options.method ?? 'GET')).toEqual([
      'GET',
      'POST',
      'DELETE',
    ])
  })
})

describe('offsetWalk - page[number]=1 에서 links.next 만 따라간다(스펙 8.6)', () => {
  it('첫 요청은 1쪽이고, 다음은 백엔드가 준 링크의 쿼리 그대로다 - 링크가 없으면 끝이다', async () => {
    const next = `${EXAMPLE.path}?probe=kept&page%5Bnumber%5D=2&page%5Bsize%5D=3`
    const { deps, sent } = probeDeps((_path, options) =>
      options.query?.get('page[number]') === '1'
        ? page(['probe-row-1', 'probe-row-2', 'probe-row-3'], next)
        : page(['probe-row-4'], null),
    )

    const result = await resultOf('offsetWalk', deps)

    expect(sent).toHaveLength(2)
    expect(sent.every((request) => request.path === EXAMPLE.path)).toBe(true)
    expect(queryOf(sent[0])).toEqual({ 'page[number]': '1', 'page[size]': '3' })
    expect(queryOf(sent[1])).toEqual({ probe: 'kept', 'page[number]': '2', 'page[size]': '3' })
    const { steps, note } = parseCombinedSteps(result.body)
    expect(steps).toHaveLength(2)
    expect(note).toContain('컬렉션 끝에 닿았다')
    expect(note).toContain('총 2쪽')
    expect(result.body).toContain(`${COMBINED_NOTE_PREFIX}links.next가`)
  })

  it('links 에 next 키가 없어도 끝이다(NestJS 는 없는 링크의 키를 지운다)', async () => {
    const { deps, sent } = probeDeps(() => page(['probe-row-1']))

    const result = await resultOf('offsetWalk', deps)

    expect(sent).toHaveLength(1)
    expect(parseCombinedSteps(result.body).note).toContain('컬렉션 끝에 닿았다')
  })

  it('링크가 끝나지 않으면 20회에서 멈추고 그 사실을 적는다', async () => {
    const { deps, sent } = probeDeps(() => page([], `${EXAMPLE.path}?page%5Bnumber%5D=9`))

    const result = await resultOf('offsetWalk', deps)

    expect(sent).toHaveLength(20)
    const { steps, note } = parseCombinedSteps(result.body)
    expect(steps).toHaveLength(20)
    expect(note).toContain('20회 상한에 걸려 멈췄다')
  })

  it('오류 응답을 받으면 그 쪽에서 멈추고 몇 번째였는지 적는다', async () => {
    const { deps, sent } = probeDeps((_path, options) =>
      options.query?.get('page[number]') === '1'
        ? page(['probe-row-1'], `${EXAMPLE.path}?page%5Bnumber%5D=2`)
        : failure(500, 'PROBE_BROKEN'),
    )

    const result = await resultOf('offsetWalk', deps)

    expect(sent).toHaveLength(2)
    expect(result.status).toBe(500)
    expect(parseCombinedSteps(result.body).note).toContain('2번째 요청에서 오류 응답')
  })

  it('읽을 수 없는 링크에서 멈춘다', async () => {
    const { deps, sent } = probeDeps(() => page(['probe-row-1'], 'http://['))

    const result = await resultOf('offsetWalk', deps)

    expect(sent).toHaveLength(1)
    expect(parseCombinedSteps(result.body).note).toContain('links.next를 읽을 수 없어')
  })
})

describe('pageTotals', () => {
  it('끈 요청과 켠 요청을 차례로 보낸다 - 켠 요청에만 page[totals]=true 가 있다', async () => {
    const { deps, sent } = probeDeps(() => page(['probe-row-1'], null))

    const result = await resultOf('pageTotals', deps)

    expect(sent.map(queryOf)).toEqual([
      { 'page[size]': '1' },
      { 'page[size]': '1', 'page[totals]': 'true' },
    ])
    expect(parseCombinedSteps(result.body).steps).toHaveLength(2)
  })
})

describe('acceptLanguage - 같은 검증 오류를 ko·en 으로(스펙 8.6)', () => {
  it('기기 언어가 아니라 ko 다음 en 을 명시해 같은 본문을 보낸다', async () => {
    const { deps, sent } = probeDeps(() => failure(422, 'VALIDATION_ERROR'))

    const result = await resultOf('acceptLanguage', deps)

    expect(sent.map((request) => request.options.acceptLanguage)).toEqual(['ko', 'en'])
    expect(sent.map((request) => request.options.method)).toEqual(['POST', 'POST'])
    for (const request of sent) {
      expect(request.options.body).toEqual(INVALID_BODY)
      expect(request.options.accessToken).toBe(TOKEN)
    }
    const { steps } = parseCombinedSteps(result.body)
    expect(steps.map((step) => step.heading)).toEqual([
      expect.stringContaining('(상태 422)'),
      expect.stringContaining('(상태 422)'),
    ])
    expect(result.headers).toEqual(writeHeaders('en'))
  })

  it('첫 요청이 세션 거절을 받으면 던지고 둘째를 보내지 않는다', async () => {
    const { deps, sent } = probeDeps(() => failure(401, 'INVALID_TOKEN'))

    await expect(runExperiment('acceptLanguage', deps)).rejects.toSatisfy(isSessionRejected)
    expect(sent).toHaveLength(1)
  })

  it('둘째 요청이 세션 거절을 받으면 던진다 - 첫 요청은 이미 나갔다', async () => {
    const { deps, sent } = probeDeps((_path, options) =>
      options.acceptLanguage === 'en'
        ? failure(401, 'INVALID_TOKEN')
        : failure(422, 'VALIDATION_ERROR'),
    )

    await expect(runExperiment('acceptLanguage', deps)).rejects.toSatisfy(isSessionRejected)
    expect(sent.map((request) => request.options.acceptLanguage)).toEqual(['ko', 'en'])
  })
})

describe('invalidFilter', () => {
  it('정책에 없는 filter[title][gt] 로 한 번 부르고 원본 오류를 그대로 보인다', async () => {
    const { deps, sent } = probeDeps(() => failure(400, 'INVALID_FILTER'))

    const result = await resultOf('invalidFilter', deps)

    expect(sent).toHaveLength(1)
    expect(queryOf(sent[0])).toEqual({ 'filter[title][gt]': 'probe-lab' })
    expect(result.status).toBe(400)
    expect(result.request.path).toBe(`${EXAMPLE.path}?filter%5Btitle%5D%5Bgt%5D=probe-lab`)
    expect(result.body).toContain('INVALID_FILTER')
    // 본문을 보내지 않는 요청은 본문도 content-type 도 화면에 적히지 않는다.
    expect(sent[0]?.options).not.toHaveProperty('body')
    expect(result.request).not.toHaveProperty('body')
    expect(result.headers).toEqual({
      accept: JSONAPI_MEDIA_TYPE,
      'accept-language': DEVICE_LANGUAGE,
    })
  })
})

describe('기기 언어', () => {
  it('기기 언어가 없으면 헤더를 싣지도 적지도 않는다', async () => {
    const { deps, sent } = probeDeps(() => failure(400, 'INVALID_FILTER'), { language: null })

    const result = await resultOf('invalidFilter', deps)

    expect(sent[0]?.options).not.toHaveProperty('acceptLanguage')
    expect(result.headers).not.toHaveProperty('accept-language')
  })

  /** 두 쪽에 걸친 순회 - 첫 쪽에만 다음 링크가 있다. */
  const TWO_PAGES: Respond = (_path, options) =>
    options.query?.get('page[number]') === '1'
      ? page(['probe-row-1'], `${EXAMPLE.path}?page%5Bnumber%5D=2`)
      : page(['probe-row-2'], null)

  it.each([
    ['relationshipWrite', ANYTHING_OK, 3],
    ['offsetWalk', TWO_PAGES, 2],
    ['pageTotals', ANYTHING_OK, 2],
    ['invalidFilter', ANYTHING_OK, 1],
  ] as const)(
    '%s 는 보내는 요청마다 기기 언어를 명시해 싣는다 - 마지막 단계의 보낸 요청 헤더에도 적힌다',
    async (id, respond, requests) => {
      const { deps, sent } = probeDeps(respond)

      const result = await resultOf(id, deps)

      expect(sent).toHaveLength(requests)
      for (const request of sent) expect(request.options.acceptLanguage).toBe(DEVICE_LANGUAGE)
      expect(result.headers['accept-language']).toBe(DEVICE_LANGUAGE)
    },
  )
})

describe('모르는 실험', () => {
  it('모르는 실험 id 는 요청하지 않고 그 사실을 결과로 보인다', async () => {
    const { deps, sent } = probeDeps(ANYTHING_OK)

    const result = await resultOf('probeUnknown', deps)

    expect(sent).toEqual([])
    expect(result.body).toContain('알 수 없는 실험 id: probeUnknown')
  })
})
