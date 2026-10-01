import { describe, expect, it } from 'vitest'

import { errorDetail } from '@/lib/auth/error-detail'

/**
 * 던져진 값을 기기 로그의 한 줄로 만드는 모양(`errorDetail`) - 세션 관리자의 거절을 남기는 세 자리
 * (queries/auth.ts·lib/resources/write.ts·platform/query-client.ts)가 함께 쓴다. 로그에 실리는 것은 오류의
 * 이름과 문구뿐이고, 오류가 아닌 값은 값이 아니라 종류(`typeof`)만 실린다 - 토큰이 문자열로 던져져도 새지 않는다(스펙 7.1).
 */
describe('errorDetail - 던져진 값을 로그 한 줄로', () => {
  it('Error 는 "이름: 문구" 다', () => {
    expect(errorDetail(new Error('probe-storage'))).toBe('Error: probe-storage')
  })

  it('Error 의 하위 종류는 그 이름을 적는다', () => {
    expect(errorDetail(new TypeError('probe-type'))).toBe('TypeError: probe-type')
  })

  it('이름을 바꾼 Error 는 바꾼 이름을 적는다', () => {
    const error = new Error('probe-message')
    error.name = 'ProbeName'

    expect(errorDetail(error)).toBe('ProbeName: probe-message')
  })

  it('문자열은 값이 아니라 종류만 적는다 - 토큰이 문자열로 던져져도 로그에 실리지 않는다', () => {
    const detail = errorDetail('probe-secret-token')

    expect(detail).toBe('string')
    expect(detail).not.toContain('probe-secret-token')
  })

  it('Error 가 아닌 객체는 문구가 들어 있어도 종류만 적는다', () => {
    const detail = errorDetail({ name: 'ProbeName', message: 'probe-secret-token' })

    expect(detail).toBe('object')
    expect(detail).not.toContain('probe-secret-token')
  })

  it.each([
    ['null', null, 'object'],
    ['undefined', undefined, 'undefined'],
    ['숫자', 42, 'number'],
    ['함수', () => undefined, 'function'],
  ])('%s 는 종류(typeof)를 적는다', (_label, value, expected) => {
    expect(errorDetail(value)).toBe(expected)
  })
})
