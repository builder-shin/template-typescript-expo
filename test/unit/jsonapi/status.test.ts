import { describe, expect, it } from 'vitest'

import { interpretRotationOutcome, type AuthTokensDocument } from '@/lib/auth/rotation'
import type { JsonApiResult } from '@/lib/jsonapi/client'
import { isUnjudgedStatus } from '@/lib/jsonapi/status'
import { throwIfUnreachable, UnreachableError } from '@/lib/resources/screen-state'

/**
 * 백엔드가 답했지만 판정하지 않은 상태(lib/jsonapi/status.ts) - 5xx·408·429. 회전 응답의 해석과 조회의 `queryFn` 이
 * 이 한 규칙을 쓴다. 두 곳이 따로 베끼면 한 곳만 고치는 사고가 나므로, 규칙의 표와 함께 두 소비자가 모든 HTTP 상태에서
 * 이 규칙과 같은 답을 내는지 잰다.
 */
describe('isUnjudgedStatus - 판정하지 않은 응답', () => {
  it.each([500, 501, 502, 503, 504, 599, 408, 429])('%i 는 판정하지 않은 응답이다', (status) => {
    expect(isUnjudgedStatus(status)).toBe(true)
  })

  it.each([200, 204, 301, 304, 400, 401, 403, 404, 405, 407, 409, 410, 422, 428, 430, 499])(
    '%i 는 판정한 응답이다 - 백엔드가 그 요청을 읽고 답했다',
    (status) => {
      expect(isUnjudgedStatus(status)).toBe(false)
    },
  )

  it('상태 0 은 응답이 없었다는 합성 오류의 표시라 판정하지 않은 응답이 아니다 - 닿지 못함은 따로 가른다', () => {
    expect(isUnjudgedStatus(0)).toBe(false)
  })
})

describe('두 소비자가 한 규칙을 쓴다 - 회전의 해석과 조회의 던짐', () => {
  /** 합성 오류가 아닌 백엔드의 오류 문서 - 상태만 달리한다. */
  function backendFailure(status: number): JsonApiResult<AuthTokensDocument> {
    return {
      ok: false,
      status,
      errors: [{ status: String(status), code: 'PROBE_CODE', detail: 'PROBE 문구' }],
    }
  }

  const HTTP_STATUSES = Array.from({ length: 500 }, (_, index) => 100 + index)

  it('모든 HTTP 상태에서 회전은 판정하지 않은 응답만 unreachable 로 읽는다 - 나머지는 파기다', () => {
    const disagreeing = HTTP_STATUSES.filter(
      (status) =>
        (interpretRotationOutcome(backendFailure(status)).kind === 'unreachable') !==
        isUnjudgedStatus(status),
    )
    expect(disagreeing).toEqual([])
  })

  it('모든 HTTP 상태에서 조회의 queryFn 은 판정하지 않은 응답만 그 응답을 실어 던진다', () => {
    const disagreeing = HTTP_STATUSES.filter((status) => {
      const result = backendFailure(status)
      let thrown: unknown
      try {
        throwIfUnreachable(result, '목록')
      } catch (error) {
        thrown = error
      }
      const carriesResponse = thrown instanceof UnreachableError && thrown.response === result
      return carriesResponse !== isUnjudgedStatus(status)
    })
    expect(disagreeing).toEqual([])
  })
})
