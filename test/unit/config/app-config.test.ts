import type { ConfigContext, ExpoConfig } from 'expo/config'
import { afterEach, describe, expect, it, vi } from 'vitest'
import appConfig, {
  BASE_APP_ID,
  BASE_NAME,
  BASE_SCHEME,
  DEV_CLIENT_SCHEME,
  SLUG,
} from '@/app.config'

// 실전 주소(10.0.2.2:4100 · .env.example)를 쓰지 않는다 - 픽스처가 실전값과 같으면
// "설정에서 읽었다" 와 "박아 넣었다" 가 구별되지 않는다(원본 저장소의 관례).
const CONTEXT = { config: {}, projectRoot: '/probe' } as unknown as ConfigContext

// 실제 EAS 프로젝트 id 가 아니다 - 모양만 UUID 인 표본이다.
const PROBE_PROJECT_ID = '0f6b3c1e-2a4d-4e8f-9b1a-7c5d3e2f1a0b'

// 주지 않은 변수는 빈 값으로 못박는다 - 개발자의 셸에 있는 EAS_PROJECT_ID 가 시험에 섞이지 않는다.
function evaluate(env: Record<string, string>): ExpoConfig {
  vi.stubEnv('BACKEND_URL', env.BACKEND_URL ?? '')
  vi.stubEnv('APP_VARIANT', env.APP_VARIANT ?? '')
  vi.stubEnv('EAS_PROJECT_ID', env.EAS_PROJECT_ID ?? '')
  vi.stubEnv('EAS_BUILD_PROJECT_ID', env.EAS_BUILD_PROJECT_ID ?? '')
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
    expect(buildProperties(config)).toEqual({
      ios: { enableSceneSupport: true },
      android: { usesCleartextTraffic: true },
    })
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
    expect(buildProperties(config)).toEqual({
      ios: { enableSceneSupport: true },
      android: { usesCleartextTraffic: false },
    })
    expect(config.ios?.infoPlist?.NSAppTransportSecurity).toEqual({
      NSAllowsLocalNetworking: false,
    })
  })

  it('기본 식별자는 배포할 수 없는 com.example 이다 - 스펙 10.3', () => {
    expect(BASE_APP_ID).toBe('com.example.templateexpo')
  })

  it.each(['development', 'preview', 'production', 'e2e'])(
    '%s 의 Android splash 종료 수정은 역순 mod 실행에서 Expo splash 뒤에 돈다',
    (variant) => {
      const config = evaluate({
        BACKEND_URL: 'https://probe-backend.example',
        APP_VARIANT: variant,
      })
      const plugins = config.plugins ?? []
      const splash = plugins.findIndex(
        (entry) => Array.isArray(entry) && entry[0] === 'expo-splash-screen',
      )
      const fix = plugins.indexOf('./plugins/with-android-splash-exit.ts')
      expect(splash).toBeGreaterThanOrEqual(0)
      expect(fix).toBeGreaterThanOrEqual(0)
      expect(fix).toBeLessThan(splash)
    },
  )

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

describe('app.config.ts 의 개발 클라이언트 - 스펙 1.2·10.5', () => {
  function devClientPlugin(config: ExpoConfig): unknown {
    return config.plugins?.find(
      (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-dev-client',
    )
  }

  it('development 만 개발 클라이언트의 scheme 을 싣는다', () => {
    expect(devClientPlugin(evaluate({ BACKEND_URL: 'http://probe-backend:4321' }))).toEqual([
      'expo-dev-client',
      { addGeneratedScheme: true },
    ])
    expect(
      devClientPlugin(evaluate({ BACKEND_URL: 'http://probe-backend:4321', APP_VARIANT: 'e2e' })),
    ).toEqual(['expo-dev-client', { addGeneratedScheme: false }])
  })

  it('개발 클라이언트의 scheme 은 slug 에서 나온다 - 설정 플러그인의 규칙 그대로', () => {
    expect(SLUG).toBe('template-typescript-expo')
    expect(DEV_CLIENT_SCHEME).toBe('exp+template-typescript-expo')
  })
})

describe('app.config.ts 의 OTA - 스펙 10.1·10.6', () => {
  const HTTPS = 'https://probe-backend.example'

  it.each(['development', 'preview', 'production', 'e2e'])(
    'EAS 프로젝트가 없으면 %s 변형은 OTA 를 끄고 runtime version 도 프로젝트 id 도 싣지 않는다',
    (variant) => {
      const config = evaluate({ BACKEND_URL: HTTPS, APP_VARIANT: variant })
      expect(config.updates).toEqual({ enabled: false })
      expect(config.runtimeVersion).toBeUndefined()
      expect(config.extra?.eas).toBeUndefined()
    },
  )

  it.each(['preview', 'production'])(
    '%s 변형은 EAS 프로젝트가 있으면 OTA 를 켜고 runtime version 을 fingerprint 정책으로 둔다',
    (variant) => {
      const config = evaluate({
        BACKEND_URL: HTTPS,
        APP_VARIANT: variant,
        EAS_PROJECT_ID: PROBE_PROJECT_ID,
      })
      expect(config.updates).toEqual({
        enabled: true,
        url: `https://u.expo.dev/${PROBE_PROJECT_ID}`,
        checkAutomatically: 'ON_LOAD',
        fallbackToCacheTimeout: 0,
        requestHeaders: { 'expo-channel-name': variant },
      })
      expect(config.runtimeVersion).toEqual({ policy: 'fingerprint' })
      expect(config.extra?.eas).toEqual({ projectId: PROBE_PROJECT_ID })
    },
  )

  it.each(['development', 'e2e'])(
    '%s 변형은 EAS 프로젝트가 있어도 OTA 를 끈다 - 프로젝트 id 는 싣는다(EAS 빌드가 찾는다)',
    (variant) => {
      const config = evaluate({
        BACKEND_URL: HTTPS,
        APP_VARIANT: variant,
        EAS_PROJECT_ID: PROBE_PROJECT_ID,
      })
      expect(config.updates).toEqual({ enabled: false })
      expect(config.runtimeVersion).toBeUndefined()
      expect(config.extra?.eas).toEqual({ projectId: PROBE_PROJECT_ID })
    },
  )

  it('EAS 빌드 서버의 EAS_BUILD_PROJECT_ID 로도 켠다 - 로컬 eas-cli 의 평가와 같아진다', () => {
    const config = evaluate({
      BACKEND_URL: HTTPS,
      APP_VARIANT: 'preview',
      EAS_BUILD_PROJECT_ID: PROBE_PROJECT_ID,
    })
    expect(config.updates?.enabled).toBe(true)
    expect(config.extra?.eas).toEqual({ projectId: PROBE_PROJECT_ID })
  })

  it.each(['EAS_PROJECT_ID', 'EAS_BUILD_PROJECT_ID'])(
    '대문자로 적은 %s 도 extra.eas.projectId 와 업데이트 주소에는 소문자로 싣는다 - EAS 빌드 서버가 EAS_BUILD_PROJECT_ID 와 글자 그대로 맞댄다',
    (name) => {
      const upper = PROBE_PROJECT_ID.toUpperCase()
      expect(upper).not.toBe(PROBE_PROJECT_ID)
      const config = evaluate({ BACKEND_URL: HTTPS, APP_VARIANT: 'preview', [name]: upper })
      expect(config.extra?.eas).toEqual({ projectId: PROBE_PROJECT_ID })
      expect(config.updates).toMatchObject({
        enabled: true,
        url: `https://u.expo.dev/${PROBE_PROJECT_ID}`,
      })
    },
  )

  it('UUID 가 아닌 EAS_PROJECT_ID 는 설정 평가를 멈춘다', () => {
    expect(() =>
      evaluate({ BACKEND_URL: HTTPS, APP_VARIANT: 'preview', EAS_PROJECT_ID: 'my-project' }),
    ).toThrowError('EAS_PROJECT_ID must be a UUID (got "my-project")')
  })
})
