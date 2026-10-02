import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'

import {
  isCollectionDocument,
  isErrorDocument,
  isSingleDocument,
  type ResourceObject,
} from '@/lib/jsonapi/document'
import { EXAMPLE, EXAMPLE_TAG } from '@/lib/resources'
import { backendKind, type BackendKind } from '@/test/e2e/matrix'
import { probeEmail } from '@/test/e2e/probe-email'

import {
  deleteFrom,
  getFrom,
  patchTo,
  postTo,
  registerAndLogin,
  type BackendResponse,
} from './backend'

/**
 * D4가 앱에서 피한 쓰기 갈림도 HTTP로 잰다(스펙 11.2의 D7 정정). 앱의 쓰기 조립을 지나면 빈 PATCH·금지 속성·
 * 중복 태그가 사라져 갈림이 관측되지 않는다. 기대값은 백엔드별 데이터다 - 바뀐 백엔드의 해당 프로브만 실패한다.
 * Next.js D4의 쓰기 표 이후 강화된 거절도 현재 실측값으로 고정한다 - 과거 표와 백엔드 커밋·소스 근거는 D7 실측 K4에 있다.
 */
interface ErrorExpectation {
  readonly status: number
  readonly code: string
  readonly pointer: string
}

interface WriteExpectations {
  readonly emptyPatch: ErrorExpectation
  /** 필드 이름은 각 프로브가 붙인다. */
  readonly forbiddenAttribute: ErrorExpectation
  readonly duplicateTags: ErrorExpectation
}

const EXPECTATIONS: Readonly<Record<BackendKind, WriteExpectations>> = {
  fastapi: {
    emptyPatch: { status: 422, code: 'VALIDATION_ERROR', pointer: '/data' },
    forbiddenAttribute: { status: 422, code: 'VALIDATION_ERROR', pointer: '/data/attributes' },
    duplicateTags: {
      status: 400,
      code: 'INVALID_JSONAPI_DOCUMENT',
      pointer: '/data/relationships/tags/data/1/id',
    },
  },
  nestjs: {
    emptyPatch: { status: 422, code: 'VALIDATION_ERROR', pointer: '/data' },
    forbiddenAttribute: { status: 422, code: 'VALIDATION_ERROR', pointer: '/data/attributes' },
    duplicateTags: {
      status: 400,
      code: 'INVALID_JSONAPI_DOCUMENT',
      pointer: '/data/relationships/tags/data/1/id',
    },
  },
  rails: {
    emptyPatch: { status: 422, code: 'VALIDATION_ERROR', pointer: '/data' },
    forbiddenAttribute: {
      status: 422,
      code: 'VALIDATION_ERROR',
      pointer: '/data/attributes',
    },
    duplicateTags: {
      status: 400,
      code: 'INVALID_JSONAPI_DOCUMENT',
      pointer: '/data/relationships/tags/data/1/id',
    },
  },
}

const KIND = backendKind()
const EXPECTED = EXPECTATIONS[KIND]
const PREFIX = 'probe-mirror-write'

function expectError(response: BackendResponse, expected: ErrorExpectation): void {
  const errors = isErrorDocument(response.body) ? response.body.errors : []
  const evidence = `${KIND}: ${response.status} ${JSON.stringify(response.body)}`
  expect(response.status, evidence).toBe(expected.status)
  const matched = errors.find((error) => error.source?.pointer === expected.pointer)
  expect(
    { status: matched?.status, code: matched?.code, pointer: matched?.source?.pointer },
    evidence,
  ).toEqual({ status: String(expected.status), code: expected.code, pointer: expected.pointer })
}

function resourceOf(response: BackendResponse): ResourceObject {
  if (!isSingleDocument(response.body) || response.body.data === null) {
    throw new Error(`자원 문서가 아니다 - ${response.status} ${JSON.stringify(response.body)}`)
  }
  return response.body.data
}

async function login(label: string): Promise<string> {
  return await registerAndLogin({
    email: probeEmail(PREFIX, label),
    password: `${PREFIX}-password-value`,
  })
}

/** 각 프로브의 계정·행은 독립적이다. 계정 삭제 API는 없으므로 계정은 run.sh의 compose down -v가 정리한다. */
async function withExample(
  label: string,
  probe: (path: string, resource: ResourceObject, token: string) => Promise<void>,
): Promise<void> {
  const token = await login(label)
  const status = EXAMPLE.attributes.status
  const score = EXAMPLE.attributes.score
  if (
    status?.kind !== 'enum' ||
    status.values[0] === undefined ||
    score?.kind !== 'int' ||
    score.min === undefined
  ) {
    throw new Error('EXAMPLE의 status·score 선언이 프로브의 전제와 다르다')
  }
  const created = await postTo(
    EXAMPLE.path,
    {
      data: {
        type: EXAMPLE.type,
        attributes: {
          title: `${PREFIX}-${label}-${randomUUID()}`,
          description: null,
          status: status.values[0].value,
          score: score.min,
        },
        relationships: { category: { data: null }, tags: { data: [] } },
      },
    },
    token,
  )
  const resource = resourceOf(created)
  const path = `${EXAMPLE.path}/${resource.id}`
  try {
    expect(created.status, JSON.stringify(created.body)).toBe(201)
    await probe(path, resource, token)
  } finally {
    const deleted = await deleteFrom(path, token)
    expect(deleted.status, `프로브 행 정리 - ${JSON.stringify(deleted.body)}`).toBe(204)
  }
}

async function readExample(path: string): Promise<ResourceObject> {
  const response = await getFrom(path, new URLSearchParams())
  expect(response.status, JSON.stringify(response.body)).toBe(200)
  return resourceOf(response)
}

describe(`⑤ 쓰기 갈림 - ${KIND}`, () => {
  it('빈 PATCH - 상태·오류 코드·포인터, 저장한 값은 그대로다', async () => {
    await withExample('empty', async (path, resource, token) => {
      const before = await readExample(path)
      const response = await patchTo(path, { data: { type: EXAMPLE.type, id: resource.id } }, token)
      expectError(response, EXPECTED.emptyPatch)
      const after = await readExample(path)
      expect(after.attributes).toEqual(before.attributes)
      expect(after.relationships).toEqual(before.relationships)
    })
  })

  it.each([
    ['미선언', 'mirrorUndeclaredAttribute', 'probe-forbidden-value'],
    ['읽기 전용', 'createdAt', '2001-02-03T04:05:06Z'],
  ])('%s 속성 - 필드 오류 또는 문서 오류', async (_label, field, value) => {
    await withExample(field, async (path, resource, token) => {
      const before = await readExample(path)
      const response = await patchTo(
        path,
        { data: { type: EXAMPLE.type, id: resource.id, attributes: { [field]: value } } },
        token,
      )
      expectError(response, {
        ...EXPECTED.forbiddenAttribute,
        pointer: `${EXPECTED.forbiddenAttribute.pointer}/${field}`,
      })
      expect((await readExample(path)).attributes).toEqual(before.attributes)
    })
  })

  it('중복 태그 id - 상태·오류 코드·포인터, 관계는 그대로다', async () => {
    await withExample('duplicate', async (path, resource, token) => {
      // 태그는 읽기 전용이라 시드의 참조 행만 읽는다. 이 프로브가 만든 example의 관계만 바꾼다.
      const tags = await getFrom(EXAMPLE_TAG.path, new URLSearchParams({ 'page[size]': '1' }))
      expect(tags.status, JSON.stringify(tags.body)).toBe(200)
      const tag = isCollectionDocument(tags.body) ? tags.body.data[0] : undefined
      if (tag === undefined) throw new Error('읽기 전용 태그 시드가 없다 - 중복 태그를 잴 수 없다')
      const linkage = { type: EXAMPLE_TAG.type, id: tag.id }
      const response = await patchTo(
        path,
        {
          data: {
            type: EXAMPLE.type,
            id: resource.id,
            relationships: { tags: { data: [linkage, linkage] } },
          },
        },
        token,
      )
      expectError(response, EXPECTED.duplicateTags)
      const after = await readExample(path)
      expect(after.relationships?.tags?.data).toEqual([])
    })
  })
})

describe(`⑥ access token 수명 - ${KIND}`, () => {
  it('새 로그인의 exp - iat가 하네스가 준 JWT_ACCESS_EXPIRES_SECONDS와 같다', async () => {
    const given = process.env.E2E_ACCESS_EXPIRES_SECONDS
    if (given === undefined || given === '') {
      throw new Error(
        'E2E_ACCESS_EXPIRES_SECONDS가 없다 - run.sh가 compose와 거울에 같은 수명을 줘야 한다',
      )
    }
    const expected = Number(given)
    expect(Number.isSafeInteger(expected) && expected > 0, given).toBe(true)
    expect(expected, '기본 900초로는 설정 반영과 무시를 구별할 수 없다').not.toBe(900)
    const token = await login('lifetime')
    const payload = token.split('.')[1]
    if (payload === undefined) throw new Error('로그인의 access token이 JWT 모양이 아니다')
    // 서명은 재지 않는다 - 이 프로브의 질문은 백엔드가 발급한 토큰의 설정 수명이다.
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      iat?: unknown
      exp?: unknown
    }
    expect(Number.isSafeInteger(claims.iat), 'iat는 초 단위 정수다').toBe(true)
    expect(Number.isSafeInteger(claims.exp), 'exp는 초 단위 정수다').toBe(true)
    if (typeof claims.iat !== 'number' || typeof claims.exp !== 'number') {
      throw new Error('access token에 숫자 iat·exp가 없다')
    }
    expect(claims.exp - claims.iat).toBe(expected)
  })
})
