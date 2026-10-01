import { describe, expect, it } from 'vitest'

import { APP_VARIANTS } from '@/lib/config/app-variant'
import {
  EAS_UPDATE_ORIGIN,
  RUNTIME_VERSION_POLICY,
  easProjectId,
  updatesConfig,
} from '@/lib/config/updates'

// 실제 EAS 프로젝트 id 가 아니다 - 모양만 UUID 인 표본이다.
const PROBE_PROJECT_ID = '0f6b3c1e-2a4d-4e8f-9b1a-7c5d3e2f1a0b'
const OTHER_PROJECT_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d'

describe('easProjectId - 스펙 10.1', () => {
  it.each([
    ['없음', {}],
    ['빈 값', { EAS_PROJECT_ID: '' }],
    ['공백', { EAS_PROJECT_ID: '  ' }],
  ])('%s 이면 null 이다 - EAS 프로젝트도 OTA 도 없다', (_label, env) => {
    expect(easProjectId(env)).toBeNull()
  })

  it('앞뒤 공백을 떼고 돌려준다', () => {
    expect(easProjectId({ EAS_PROJECT_ID: ` ${PROBE_PROJECT_ID} ` })).toBe(PROBE_PROJECT_ID)
  })

  it('EAS 빌드 서버가 주는 EAS_BUILD_PROJECT_ID 는 EAS_PROJECT_ID 가 없을 때만 쓴다', () => {
    expect(easProjectId({ EAS_BUILD_PROJECT_ID: PROBE_PROJECT_ID })).toBe(PROBE_PROJECT_ID)
    expect(easProjectId({ EAS_PROJECT_ID: '', EAS_BUILD_PROJECT_ID: PROBE_PROJECT_ID })).toBe(
      PROBE_PROJECT_ID,
    )
    expect(
      easProjectId({ EAS_PROJECT_ID: OTHER_PROJECT_ID, EAS_BUILD_PROJECT_ID: PROBE_PROJECT_ID }),
    ).toBe(OTHER_PROJECT_ID)
  })

  it.each(['my-project', `${PROBE_PROJECT_ID}x`, PROBE_PROJECT_ID.replaceAll('-', '')])(
    'UUID 가 아닌 %s 는 설정 평가를 멈춘다 - 틀린 id 는 OTA 를 소리 없이 멈추게 한다',
    (raw) => {
      expect(() => easProjectId({ EAS_PROJECT_ID: raw })).toThrowError(
        `EAS_PROJECT_ID must be a UUID (got ${JSON.stringify(raw)})`,
      )
    },
  )
})

describe('updatesConfig - 스펙 10.6', () => {
  it.each(['preview', 'production'] as const)(
    '%s 변형에 EAS 프로젝트가 있으면 OTA 를 켠다 - 채널은 변형 이름, 켤 때 확인하고 기다리지 않는다',
    (variant) => {
      expect(updatesConfig(variant, PROBE_PROJECT_ID)).toEqual({
        enabled: true,
        url: `https://u.expo.dev/${PROBE_PROJECT_ID}`,
        checkAutomatically: 'ON_LOAD',
        fallbackToCacheTimeout: 0,
        requestHeaders: { 'expo-channel-name': variant },
      })
    },
  )

  it.each(APP_VARIANTS)('%s 변형도 EAS 프로젝트가 없으면 OTA 를 끈다', (variant) => {
    expect(updatesConfig(variant, null)).toEqual({ enabled: false })
  })

  it.each(['development', 'e2e'] as const)(
    '%s 변형은 EAS 프로젝트가 있어도 OTA 를 끈다 - 개발 서버·내장 번들로 돈다',
    (variant) => {
      expect(updatesConfig(variant, PROBE_PROJECT_ID)).toEqual({ enabled: false })
    },
  )

  it('업데이트 주소는 EAS Update 의 프로젝트 경로다', () => {
    expect(EAS_UPDATE_ORIGIN).toBe('https://u.expo.dev')
  })

  it('runtime version 은 fingerprint 정책이다 - 네이티브 구성이 같은 빌드에만 업데이트가 간다', () => {
    expect(RUNTIME_VERSION_POLICY).toEqual({ policy: 'fingerprint' })
  })
})
