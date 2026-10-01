import { beforeAll, describe, expect, it } from 'vitest'

import { isCollectionDocument, isErrorDocument, type ErrorObject } from '@/lib/jsonapi/document'
import { buildQuery } from '@/lib/jsonapi/query'
import { EXAMPLE, RESOURCES } from '@/lib/resources'
import { attributeKeys, mirrorProbes } from '@/lib/resources/mirror'
import { probeEmail } from '@/test/e2e/probe-email'

import { getFrom, isSuccess, postTo, registerAndLogin, type BackendResponse } from './backend'

/**
 * 계약 거울 - 손으로 옮긴 자원 선언(`lib/resources/*.ts`)이 실제 백엔드의 계약과 같은가(스펙 11.2).
 *
 * 선언의 `filters`·`sorts`·`attributes` 는 백엔드 조회 정책과 시리얼라이저를 손으로 베낀 거울이라 반드시
 * 어긋난다. 이 파일은 복사한 `lib/resources/mirror.ts` 가 계산한 프로브와 속성 키를 실제 백엔드에 보내 맞댄다
 * - 선언을 백엔드보다 넓히거나 좁히면(연산자·정렬을 열거나 닫으면, 속성 이름이나 제약을 바꾸면) 게이트
 * `[12/13]` 이 빨개진다. 원본(template-typescript-nextjs)의 `test/e2e/mirror.spec.ts` 의 검사 넷을 vitest 로
 * 옮긴 것이다 - Playwright 의 요청 컨텍스트 대신 `fetch`(`./backend.ts`)로 원본 응답을 받는다.
 *
 * 1. 조회 정책 - 선언된 (필드, 연산자)·정렬은 2xx, 선언에 없는 연산자는 `INVALID_FILTER`, 선언에 없는 정렬은
 *    `INVALID_SORT` 와 그 `source.parameter`.
 * 2. 응답 `data[0].attributes` 의 키 집합이 선언(`attributeKeys`)과 같다 - 씨앗이 0건이면 잴 것이 없어 실패다.
 * 3. 속성 제약 - `examples` 에만, 로그인한 뒤 POST 로. `maxLength`·`min`·`max`·enum 을 넘기면 422 와 그 필드를
 *    가리키는 `source.pointer`. 참조 자원은 쓰기 라우트가 없어 이 검사가 성립하지 않는다. 넘긴 값만 보내므로
 *    행이 만들어지지 않는다 - 선언이 백엔드보다 좁은 쪽을 잡는다(`maxLength` 를 줄이면 백엔드가 받아 2xx 다).
 * 4. 선언된 enum 값 각각이 백엔드의 어휘에 있다 - `exact` 필터로 물어 2xx(0건이어도 된다).
 *
 * 오류는 `code`·`source` 만 본다 - 문구(`title`·`detail`)는 세 백엔드가 갈린다. 모든 값은 선언에서 읽는다 -
 * 상수로 박으면 선언을 바꾸는 뮤턴트가 살아남는다.
 */

/** 이 파일이 만드는 값의 접두사 - 실험실(`probe-lab`)과 같다. 실전 값과 겹치지 않는다. */
const PROBE_PREFIX = 'probe-lab'

/** 정본의 비밀번호 하한(12자)을 넘기는 값. */
const PROBE_PASSWORD = `${PROBE_PREFIX}-password-value`

function errorsOf(response: BackendResponse): readonly ErrorObject[] {
  return isErrorDocument(response.body) ? response.body.errors : []
}

describe.each(RESOURCES.map((resource) => [resource.type, resource] as const))(
  '① 선언된 조회 정책이 백엔드와 같다 - %s',
  (_type, resource) => {
    it.each(mirrorProbes(resource).map((probe) => [probe.label, probe] as const))(
      '%s',
      async (label, probe) => {
        const response = await getFrom(probe.path, probe.query)
        const expected = probe.expect

        if (expected.kind === 'ok') {
          expect(
            isSuccess(response.status),
            `[${label}] 2xx 를 기대했다 - 실제 ${response.status}`,
          ).toBe(true)
          return
        }

        const errors = errorsOf(response)
        const matched = errors.find((error) => error.code === expected.code)
        expect(
          { code: matched?.code, parameter: matched?.source?.parameter },
          `[${label}] status=${response.status} errors=${JSON.stringify(errors)}`,
        ).toEqual({ code: expected.code, parameter: expected.parameter })
      },
    )
  },
)

describe('② 응답의 속성 키 집합이 선언과 같다', () => {
  it.each(RESOURCES.map((resource) => [resource.type, resource] as const))(
    '%s',
    async (type, resource) => {
      const response = await getFrom(resource.path, buildQuery({ page: { size: 1 } }))

      expect(
        isSuccess(response.status),
        `[${type}] page[size]=1 이 실패했다 - ${response.status}`,
      ).toBe(true)
      const body = response.body
      if (!isCollectionDocument(body)) throw new Error(`[${type}] 응답이 컬렉션 문서가 아니다`)
      // 0건이면 건너뛰지 않고 실패한다 - 씨앗이 없으면 이 검사는 아무것도 재지 못한다.
      const first = body.data[0]
      if (first === undefined) {
        throw new Error(`[${type}] 씨앗이 0건이다 - test/e2e/seed/ 가 비어 있으면 잴 것이 없다`)
      }
      expect(Object.keys(first.attributes ?? {}).sort(), `[${type}] attributes 키 집합`).toEqual(
        [...attributeKeys(resource)].sort(),
      )
    },
  )
})

/* ------------------------------------------------------------------------- *
 * ③ 속성 제약 - examples 에만, 로그인한 뒤
 * ------------------------------------------------------------------------- */

const title = EXAMPLE.attributes.title
const score = EXAMPLE.attributes.score
const status = EXAMPLE.attributes.status
if (title?.kind !== 'string' || title.maxLength === undefined) {
  throw new Error(
    "EXAMPLE.attributes.title 이 maxLength 가 있는 kind: 'string' 이 아니다 - ③ 의 전제",
  )
}
if (score?.kind !== 'int' || score.min === undefined || score.max === undefined) {
  throw new Error("EXAMPLE.attributes.score 가 min·max 가 있는 kind: 'int' 가 아니다 - ③ 의 전제")
}
if (status?.kind !== 'enum' || status.values[0] === undefined) {
  throw new Error("EXAMPLE.attributes.status 가 값이 있는 kind: 'enum' 이 아니다 - ③ 의 전제")
}
const TITLE_MAX_LENGTH = title.maxLength
const SCORE_MIN = score.min
const SCORE_MAX = score.max
const VALID_STATUS = status.values[0].value
/** 선언에 없는 status - 선언된 첫 값에서 만든다(선언을 바꾸면 이 값도 따라간다). */
const UNDECLARED_STATUS = `${VALID_STATUS}-${PROBE_PREFIX}-not-declared`

interface AttributeOverrides {
  readonly title?: string
  readonly score?: number
  readonly status?: string
}

/** 검사하는 속성 하나만 어긋나고 나머지는 유효하다. 관계는 선언된 것 전부를 비운다. */
function exampleBody(overrides: AttributeOverrides): unknown {
  const relationships = Object.fromEntries(
    Object.entries(EXAMPLE.relationships).map(([name, relationship]) => [
      name,
      { data: relationship.cardinality === 'one' ? null : [] },
    ]),
  )
  return {
    data: {
      type: EXAMPLE.type,
      attributes: {
        title: overrides.title ?? `${PROBE_PREFIX}-mirror-constraint`,
        description: null,
        status: overrides.status ?? VALID_STATUS,
        score: overrides.score ?? Math.round((SCORE_MIN + SCORE_MAX) / 2),
      },
      relationships,
    },
  }
}

/** `maxLength` 를 정확히 하나 넘기는 제목. */
function overlongTitle(): string {
  return `${PROBE_PREFIX}-`.padEnd(TITLE_MAX_LENGTH + 1, 'a')
}

describe('③ 속성 제약 - examples 에만, 로그인한 뒤', () => {
  let accessToken = ''

  beforeAll(async () => {
    accessToken = await registerAndLogin({
      email: probeEmail(`${PROBE_PREFIX}-mirror`, 'constraints'),
      password: PROBE_PASSWORD,
    })
  })

  async function expectValidationErrorAt(overrides: AttributeOverrides, pointer: string) {
    const response = await postTo(EXAMPLE.path, exampleBody(overrides), accessToken)
    const errors = errorsOf(response)
    expect(response.status, `422 를 기대했다 - errors=${JSON.stringify(errors)}`).toBe(422)
    const matched = errors.find((error) => error.source?.pointer === pointer)
    expect(matched?.code, `source.pointer=${pointer} 인 오류 - ${JSON.stringify(errors)}`).toBe(
      'VALIDATION_ERROR',
    )
  }

  it('title 이 maxLength 보다 한 글자 길면 422', async () => {
    await expectValidationErrorAt({ title: overlongTitle() }, '/data/attributes/title')
  })

  it('score 가 max 보다 크면 422', async () => {
    await expectValidationErrorAt({ score: SCORE_MAX + 1 }, '/data/attributes/score')
  })

  it('score 가 min 보다 작으면 422', async () => {
    await expectValidationErrorAt({ score: SCORE_MIN - 1 }, '/data/attributes/score')
  })

  // 거부하는가(세 백엔드 공통)와 어떤 모양으로 거부하는가(422·포인터)를 나눈다 - 원본과 같다. 401 을 먼저
  // 배제한다: 없으면 인증이 깨진 세계와 선언 밖 값이 거부된 세계가 같아진다.
  it('status 가 선언에 없는 값이면 행이 만들어지지 않는다', async () => {
    const response = await postTo(
      EXAMPLE.path,
      exampleBody({ status: UNDECLARED_STATUS }),
      accessToken,
    )

    expect(response.status, '401 이 왔다 - 재는 것이 거울이 아니라 인증이다').not.toBe(401)
    expect(isSuccess(response.status), `선언 밖 status 로 2xx 가 왔다 - ${response.status}`).toBe(
      false,
    )
  })

  it('status 가 선언에 없는 값이면 422', async () => {
    await expectValidationErrorAt({ status: UNDECLARED_STATUS }, '/data/attributes/status')
  })
})

/* ------------------------------------------------------------------------- *
 * ④ 선언된 enum 값 각각이 백엔드의 어휘에 있다
 * ------------------------------------------------------------------------- */

/**
 * ③ 은 선언에 없는 값이 거부되는지를, 이것은 선언된 값이 각각 받아들여지는지를 잰다 - 서로 다른 명제다.
 * `exact` 가 선언된 enum 속성만 돈다(아니면 그 요청은 애초에 400 이어야 한다). 0건 2xx 도 통과다 - 재는 것은
 * 그 값이 어휘에 있는가이지 그 값의 행이 있는가가 아니다.
 */
const ENUM_PROBES = RESOURCES.flatMap((resource) =>
  Object.entries(resource.attributes).flatMap(([field, attribute]) => {
    if (attribute.kind !== 'enum') return []
    if (!(resource.filters[field] ?? []).includes('exact')) return []
    return attribute.values.map(
      (value) =>
        [`${resource.type} ${field}=${value.value}`, resource, field, value.value] as const,
    )
  }),
)

describe('④ 선언된 enum 값 각각이 백엔드의 어휘에 있다', () => {
  it('잴 enum 이 하나 이상이다 - 없으면 이 절은 아무것도 재지 않는다', () => {
    expect(ENUM_PROBES.length).toBeGreaterThan(0)
  })

  it.each(ENUM_PROBES)('%s', async (label, resource, field, value) => {
    const response = await getFrom(
      resource.path,
      buildQuery({ filters: [{ name: field, operator: 'exact', value }] }),
    )

    expect(isSuccess(response.status), `[${label}] 2xx 를 기대했다 - 실제 ${response.status}`).toBe(
      true,
    )
  })
})
