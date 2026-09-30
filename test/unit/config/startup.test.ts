import { afterEach, describe, expect, it, vi } from 'vitest'

import { APP_VARIANTS } from '@/lib/config/app-variant'
import { getSettings, setSettingsSource } from '@/lib/config/settings'
import {
  checkStartupSettings,
  settingsEnvFromExtra,
  variantFromExtra,
  type StartupSettings,
} from '@/lib/config/startup'

/**
 * 앱 시작 설정(스펙 10.1). platform/config.ts 의 loadStartupSettings() 는 expo-constants 의
 * extra 로 아래 startWith() 와 같은 두 줄을 부른다 - 자리를 extra 로 돌리고 검증한다. 실패 갈래는
 * 루트 레이아웃이 치명 오류 화면(FatalConfig)으로 그린다.
 */
function startWith(extra: unknown): StartupSettings {
  setSettingsSource(() => settingsEnvFromExtra(extra))
  return checkStartupSettings(getSettings)
}

afterEach(() => {
  // 이 파일의 시험이 자리를 바꿨다 - 다음 시험은 기본 자리(process.env)에서 시작한다.
  setSettingsSource(() => process.env)
  vi.unstubAllEnvs()
})

describe('앱 시작 설정 - 스펙 10.1', () => {
  it('extra.backendUrl 이 절대 URL 이면 통과하고 끝 슬래시를 뗀다', () => {
    expect(startWith({ backendUrl: 'https://probe-backend.example/' })).toEqual({
      ok: true,
      settings: { backendUrl: 'https://probe-backend.example' },
    })
  })

  it.each([
    ['빈 extra', {}],
    ['extra 없음', undefined],
    ['null', null],
    ['문자열이 아닌 backendUrl', { backendUrl: 42 }],
  ])('%s 이면 던지지 않고 BACKEND_URL 이 없다는 문구로 실패한다', (_label, extra) => {
    expect(startWith(extra)).toEqual({ ok: false, message: 'BACKEND_URL is required' })
  })

  it('상대 경로면 절대 URL 이 아니라는 문구로 실패한다', () => {
    expect(startWith({ backendUrl: '/api' })).toEqual({
      ok: false,
      message: 'BACKEND_URL must be an absolute URL (got "/api")',
    })
  })

  it('다시 부르면 새 extra 로 다시 검증한다 - 앞의 결과가 캐시에 남지 않는다', () => {
    expect(startWith({}).ok).toBe(false)
    expect(startWith({ backendUrl: 'https://probe-backend.example' }).ok).toBe(true)
    expect(startWith({}).ok).toBe(false)
  })

  it('실패한 뒤의 getSettings() 도 extra 를 읽는다 - process.env 의 값으로 돌아가지 않는다', () => {
    vi.stubEnv('BACKEND_URL', 'https://probe-env.example')
    expect(startWith({}).ok).toBe(false)
    expect(() => getSettings()).toThrowError('BACKEND_URL is required')
  })

  it('Error 가 아닌 값이 던져져도 문구로 바꾼다', () => {
    const thrown: unknown = 'probe failure'
    expect(
      checkStartupSettings(() => {
        throw thrown
      }),
    ).toEqual({ ok: false, message: 'probe failure' })
  })
})

describe('빌드 변형 - 스펙 10.2', () => {
  it.each(APP_VARIANTS)('extra.appVariant 의 %s 를 돌려준다', (variant) => {
    expect(variantFromExtra({ appVariant: variant })).toBe(variant)
  })

  it.each([
    ['extra 없음', undefined],
    ['문자열이 아닌 값', { appVariant: 1 }],
  ])('%s 이면 기본값 development 다', (_label, extra) => {
    expect(variantFromExtra(extra)).toBe('development')
  })
})
