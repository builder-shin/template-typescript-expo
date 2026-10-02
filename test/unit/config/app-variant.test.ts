import { describe, expect, it } from 'vitest'
import {
  APP_VARIANTS,
  DEFAULT_APP_VARIANT,
  assertBackendUrlAllowed,
  parseAppVariant,
  variantProfile,
} from '@/lib/config/app-variant'

describe('parseAppVariant', () => {
  it('값이 없으면 기본값 development 다', () => {
    expect(parseAppVariant(undefined)).toBe('development')
    expect(parseAppVariant('  ')).toBe('development')
    expect(DEFAULT_APP_VARIANT).toBe('development')
  })

  it.each(APP_VARIANTS)('%s 를 받는다', (variant) => {
    expect(parseAppVariant(` ${variant} `)).toBe(variant)
  })

  it('목록 밖의 값은 목록과 함께 거절한다', () => {
    expect(() => parseAppVariant('staging')).toThrowError(
      'APP_VARIANT must be one of development, preview, production, e2e (got "staging")',
    )
  })
})

describe('variantProfile', () => {
  it('변형마다 식별자·scheme·이름 접미사와 평문 허용이 정해져 있다', () => {
    expect(variantProfile('development')).toEqual({
      idSuffix: '.dev',
      schemeSuffix: '-dev',
      nameSuffix: ' (Dev)',
      allowCleartext: true,
      logsHttpFailures: false,
      updatesChannel: null,
      devClientScheme: true,
    })
    expect(variantProfile('preview')).toEqual({
      idSuffix: '.preview',
      schemeSuffix: '-preview',
      nameSuffix: ' (Preview)',
      allowCleartext: false,
      logsHttpFailures: false,
      updatesChannel: 'preview',
      devClientScheme: false,
    })
    expect(variantProfile('production')).toEqual({
      idSuffix: '',
      schemeSuffix: '',
      nameSuffix: '',
      allowCleartext: false,
      logsHttpFailures: false,
      updatesChannel: 'production',
      devClientScheme: false,
    })
    expect(variantProfile('e2e')).toEqual({
      idSuffix: '.e2e',
      schemeSuffix: '-e2e',
      nameSuffix: ' (E2E)',
      allowCleartext: true,
      logsHttpFailures: true,
      updatesChannel: null,
      devClientScheme: false,
    })
  })

  it('HTTP 실패를 기기 로그에 남기는 것은 e2e 뿐이다 - E2E 가드의 재료(스펙 11.3)', () => {
    expect(APP_VARIANTS.filter((variant) => variantProfile(variant).logsHttpFailures)).toEqual([
      'e2e',
    ])
  })

  it('OTA 채널은 배포 변형(preview·production)에만 있고 변형 이름과 같다 - 스펙 10.2·10.6', () => {
    expect(
      APP_VARIANTS.map((variant) => [variant, variantProfile(variant).updatesChannel]),
    ).toEqual([
      ['development', null],
      ['preview', 'preview'],
      ['production', 'production'],
      ['e2e', null],
    ])
  })

  it('개발 클라이언트의 scheme 은 development 에만 싣는다 - 여러 변형에 실리면 딥링크가 갈 곳이 정해지지 않는다', () => {
    expect(APP_VARIANTS.filter((variant) => variantProfile(variant).devClientScheme)).toEqual([
      'development',
    ])
  })

  it('접미사가 서로 겹치지 않는다 - 한 기기에 함께 설치할 수 있어야 한다', () => {
    const ids = APP_VARIANTS.map((variant) => variantProfile(variant).idSuffix)
    const schemes = APP_VARIANTS.map((variant) => variantProfile(variant).schemeSuffix)
    expect(new Set(ids).size).toBe(APP_VARIANTS.length)
    expect(new Set(schemes).size).toBe(APP_VARIANTS.length)
  })
})

describe('assertBackendUrlAllowed', () => {
  it.each(['preview', 'production'] as const)('%s 는 http 를 거절한다', (variant) => {
    expect(() => assertBackendUrlAllowed('http://probe-backend:4321', variant)).toThrowError(
      `BACKEND_URL must use https for the ${variant} variant (got "http://probe-backend:4321")`,
    )
  })

  it.each(['preview', 'production'] as const)('%s 는 https 를 받는다', (variant) => {
    expect(() => assertBackendUrlAllowed('https://probe-backend.example', variant)).not.toThrow()
  })

  it.each(['development', 'e2e'] as const)('%s 는 http 를 받는다', (variant) => {
    expect(() => assertBackendUrlAllowed('http://probe-backend:4321', variant)).not.toThrow()
  })
})
