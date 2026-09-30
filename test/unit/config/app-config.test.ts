import type { ConfigContext, ExpoConfig } from 'expo/config'
import { afterEach, describe, expect, it, vi } from 'vitest'
import appConfig, { BASE_APP_ID, BASE_NAME, BASE_SCHEME } from '@/app.config'

// 실전 주소(10.0.2.2:4100 · .env.example)를 쓰지 않는다 - 픽스처가 실전값과 같으면
// "설정에서 읽었다" 와 "박아 넣었다" 가 구별되지 않는다(원본 저장소의 관례).
const CONTEXT = { config: {}, projectRoot: '/probe' } as unknown as ConfigContext

function evaluate(env: Record<string, string>): ExpoConfig {
  vi.stubEnv('BACKEND_URL', env.BACKEND_URL ?? '')
  vi.stubEnv('APP_VARIANT', env.APP_VARIANT ?? '')
  return appConfig(CONTEXT)
}

function buildProperties(config: ExpoConfig): unknown {
  const entry = config.plugins?.find(
    (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-build-properties',
  )
  return Array.isArray(entry) ? entry[1] : undefined
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('app.config.ts - 스펙 10.1·10.2', () => {
  it('BACKEND_URL 이 없으면 설정 평가가 멈춘다', () => {
    expect(() => evaluate({})).toThrowError(/BACKEND_URL is required/)
  })

  it('production 변형은 http BACKEND_URL 을 거절한다', () => {
    expect(() =>
      evaluate({ BACKEND_URL: 'http://probe-backend:4321', APP_VARIANT: 'production' }),
    ).toThrowError(/must use https for the production variant/)
  })

  it('APP_VARIANT 가 없으면 development 다', () => {
    const config = evaluate({ BACKEND_URL: 'http://probe-backend:4321' })
    expect(config.android?.package).toBe(`${BASE_APP_ID}.dev`)
    expect(config.extra?.appVariant).toBe('development')
  })

  it('e2e 변형은 접미사를 붙이고 평문 HTTP 를 켠다', () => {
    const config = evaluate({ BACKEND_URL: 'http://probe-backend:4321/', APP_VARIANT: 'e2e' })
    expect(config.name).toBe(`${BASE_NAME} (E2E)`)
    expect(config.scheme).toBe(`${BASE_SCHEME}-e2e`)
    expect(config.android?.package).toBe(`${BASE_APP_ID}.e2e`)
    expect(config.ios?.bundleIdentifier).toBe(`${BASE_APP_ID}.e2e`)
    expect(buildProperties(config)).toEqual({ android: { usesCleartextTraffic: true } })
    expect(config.ios?.infoPlist?.NSAppTransportSecurity).toEqual({
      NSAllowsLocalNetworking: true,
    })
    expect(config.extra).toEqual({ backendUrl: 'http://probe-backend:4321', appVariant: 'e2e' })
  })

  it('production 변형은 접미사가 없고 평문 HTTP 를 끈다', () => {
    const config = evaluate({
      BACKEND_URL: 'https://probe-backend.example',
      APP_VARIANT: 'production',
    })
    expect(config.name).toBe(BASE_NAME)
    expect(config.scheme).toBe(BASE_SCHEME)
    expect(config.android?.package).toBe(BASE_APP_ID)
    expect(buildProperties(config)).toEqual({ android: { usesCleartextTraffic: false } })
    expect(config.ios?.infoPlist?.NSAppTransportSecurity).toEqual({
      NSAllowsLocalNetworking: false,
    })
  })

  it('기본 식별자는 배포할 수 없는 com.example 이다 - 스펙 10.3', () => {
    expect(BASE_APP_ID).toBe('com.example.templateexpo')
  })

  it('expo-secure-store 플러그인이 세션을 Android 자동 백업에서 빼고 Face ID 문구를 넣지 않는다 - 스펙 7.1', () => {
    const config = evaluate({
      BACKEND_URL: 'https://probe-backend.example',
      APP_VARIANT: 'production',
    })
    const entry = config.plugins?.find(
      (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-secure-store',
    )
    expect(entry).toEqual([
      'expo-secure-store',
      { configureAndroidBackup: true, faceIDPermission: false },
    ])
  })
})
