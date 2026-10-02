import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  HTTP_FAILURE_MARKER,
  httpFailureLine,
  markedNativeLog,
  NATIVE_WARN_LEVEL,
  WARNING_MARKER,
} from '@/lib/jsonapi/failure-log'

describe('httpFailureLine - 스펙 11.3 의 가드가 읽는 한 줄', () => {
  it('표식 · 상태 · 메서드 · 경로 · 오류 코드 순서다', () => {
    expect(
      httpFailureLine('POST', '/api/v1/auth/register', 409, [
        { status: '409', code: 'EMAIL_ALREADY_REGISTERED' },
      ]),
    ).toBe('[e2e-http] 409 POST /api/v1/auth/register EMAIL_ALREADY_REGISTERED')
  })

  it('메서드를 대문자로 적는다', () => {
    expect(httpFailureLine('post', '/probe', 422, [{ code: 'VALIDATION_ERROR' }])).toBe(
      '[e2e-http] 422 POST /probe VALIDATION_ERROR',
    )
  })

  it('오류 코드가 여럿이면 쉼표로 잇고, 코드가 없는 오류는 - 로 적는다', () => {
    expect(
      httpFailureLine('POST', '/probe', 422, [
        { code: 'VALIDATION_ERROR' },
        {},
        { code: 'VALIDATION_ERROR' },
      ]),
    ).toBe('[e2e-http] 422 POST /probe VALIDATION_ERROR,-,VALIDATION_ERROR')
  })

  it('오류가 하나도 없으면 코드 자리에 - 를 적는다', () => {
    expect(httpFailureLine('GET', '/probe', 500, [])).toBe('[e2e-http] 500 GET /probe -')
  })

  it('백엔드에 닿지 못한 요청은 상태 0 이다', () => {
    expect(httpFailureLine('GET', '/health/ready', 0, [{ code: 'NETWORK_ERROR' }])).toBe(
      '[e2e-http] 0 GET /health/ready NETWORK_ERROR',
    )
  })

  it('문구·출처 같은 다른 필드는 적지 않는다 - 로그에 사용자 입력이 새지 않는다', () => {
    const line = httpFailureLine('POST', '/api/v1/auth/login', 401, [
      {
        code: 'INVALID_CREDENTIALS',
        title: 'probe-title-text',
        detail: 'probe-detail-text',
        source: { pointer: '/data/attributes/email' },
      },
    ])
    expect(line).not.toContain('probe-title-text')
    expect(line).not.toContain('probe-detail-text')
    expect(line).not.toContain('/data/attributes/email')
  })

  it('표식은 하네스(test/e2e/guard-log.sh)가 찾는 문자열이다', () => {
    expect(HTTP_FAILURE_MARKER).toBe('[e2e-http]')
  })
})

describe('markedNativeLog - iOS 에서 가드가 경고를 가르는 표식', () => {
  it('경고 수준의 줄 앞에 표식을 붙인다', () => {
    expect(markedNativeLog('probe warning', NATIVE_WARN_LEVEL)).toBe('[e2e-warn] probe warning')
  })

  it.each([0, 1, 3])('다른 수준(%i)은 그대로 둔다', (level) => {
    expect(markedNativeLog('probe line', level)).toBe('probe line')
  })

  it('경고 수준은 설치본 React Native console 의 LOG_LEVELS.warn 이다', () => {
    const polyfill = readFileSync(
      resolve('node_modules/@react-native/js-polyfills/console.js'),
      'utf8',
    )
    expect(/const LOG_LEVELS = \{[^}]*\bwarn: (\d+),/.exec(polyfill)?.[1]).toBe(
      String(NATIVE_WARN_LEVEL),
    )
  })

  it('표식은 iOS 로그 변환(test/e2e/ios-log.ts)이 찾는 문자열이다', () => {
    expect(WARNING_MARKER).toBe('[e2e-warn]')
  })
})
