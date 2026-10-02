import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { APP_VARIANTS, variantProfile } from '@/lib/config/app-variant'

/**
 * eas.json - 스펙 10.5.
 *
 * EAS 빌드 프로필은 빌드 변형(lib/config/app-variant.ts)과 1:1 이다 - 프로필 이름이 변형 이름이고, 프로필이
 * APP_VARIANT 로 그 변형을 고르고, OTA 채널이 변형 표의 채널과 같다. EAS 빌드는 eas.json 의 채널을 네이티브
 * 설정에 쓰고 EAS 밖의 빌드는 app.config.ts 의 요청 머리글(lib/config/updates.ts)을 쓰므로 둘이 달라지면 빌드
 * 방식에 따라 다른 채널을 본다.
 *
 * 스키마는 EAS 명령이 @expo/eas-json 으로 검사한다(계획을 쓸 때 24.8.0 의 해석기로 네 프로필 × 두 플랫폼을
 * 읽었다 - docs/superpowers/notes/2026-10-01-d6-measurements.md 의 O2). 여기서는 이 저장소의 약속을 본다.
 */
interface BuildProfile {
  node?: string
  pnpm?: string
  channel?: string
  distribution?: string
  developmentClient?: boolean
  autoIncrement?: boolean
  environment?: string
  withoutCredentials?: boolean
  env?: Record<string, string>
  android?: { buildType?: string }
  ios?: { simulator?: boolean }
}

interface EasJson {
  cli?: { version?: string; appVersionSource?: string }
  build?: Record<string, BuildProfile>
  submit?: Record<string, { android?: unknown; ios?: unknown }>
}

const easJson = JSON.parse(readFileSync('eas.json', 'utf8')) as EasJson
const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
  engines: { node: string }
  packageManager: string
}
const profiles = easJson.build ?? {}

function profile(name: string): BuildProfile {
  const found = profiles[name]
  if (found === undefined) throw new Error(`eas.json 에 ${name} 빌드 프로필이 없다`)
  return found
}

/** "24.19.0" 이 "24.11.0" 이상인가 - 숫자 세 마디만 본다. */
function atLeast(version: string, floor: string): boolean {
  const actual = version.split('.').map(Number)
  const minimum = floor.split('.').map(Number)
  for (let index = 0; index < 3; index += 1) {
    const a = actual[index] ?? 0
    const m = minimum[index] ?? 0
    if (a !== m) return a > m
  }
  return true
}

describe('eas.json - 스펙 10.5', () => {
  it('빌드 프로필은 변형과 같은 넷이다', () => {
    expect(Object.keys(profiles).sort()).toEqual([...APP_VARIANTS].sort())
  })

  it.each(APP_VARIANTS)('%s 프로필은 APP_VARIANT 로 같은 이름의 변형을 고른다', (variant) => {
    expect(profile(variant).env?.APP_VARIANT).toBe(variant)
  })

  it.each(APP_VARIANTS)('%s 프로필의 OTA 채널이 변형 표의 채널과 같다', (variant) => {
    expect(profile(variant).channel ?? null).toBe(variantProfile(variant).updatesChannel)
  })

  it.each(APP_VARIANTS)(
    '%s 프로필에 BACKEND_URL 을 적지 않는다 - 주소는 EAS 환경 변수로 넣는다',
    (variant) => {
      expect(Object.keys(profile(variant).env ?? {})).toEqual(['APP_VARIANT'])
    },
  )

  it.each(APP_VARIANTS)(
    '%s 프로필은 app.config.ts 를 평가할 Node 를 고정한다 - type stripping(22.18 이상)과 engines.node',
    (variant) => {
      const node = profile(variant).node ?? ''
      const floor = packageJson.engines.node.replace(/^>=/, '')
      expect(node).toMatch(/^\d+\.\d+\.\d+$/)
      expect(atLeast(node, '22.18.0')).toBe(true)
      expect(atLeast(node, floor)).toBe(true)
    },
  )

  it.each(APP_VARIANTS)('%s 프로필의 pnpm 은 packageManager 와 같다', (variant) => {
    expect(`pnpm@${profile(variant).pnpm ?? ''}`).toBe(packageJson.packageManager)
  })

  it('development 는 dev client 의 내부 배포다', () => {
    expect(profile('development')).toMatchObject({
      developmentClient: true,
      distribution: 'internal',
      environment: 'development',
    })
  })

  it('preview 는 내부 배포 APK 다', () => {
    expect(profile('preview')).toMatchObject({
      distribution: 'internal',
      environment: 'preview',
      android: { buildType: 'apk' },
    })
  })

  it('production 은 스토어 빌드이고 빌드 번호를 EAS 가 올린다', () => {
    expect(profile('production')).toMatchObject({
      distribution: 'store',
      environment: 'production',
      autoIncrement: true,
    })
    expect(easJson.cli?.appVersionSource).toBe('remote')
  })

  it('e2e 는 Android APK 와 iOS 시뮬레이터 빌드다', () => {
    expect(profile('e2e')).toMatchObject({
      distribution: 'internal',
      withoutCredentials: true,
      android: { buildType: 'apk' },
      ios: { simulator: true },
    })
  })

  it('제출은 Android internal 트랙의 draft 이고 iOS 계정 값은 적지 않는다', () => {
    expect(easJson.submit).toEqual({
      production: { android: { track: 'internal', releaseStatus: 'draft' } },
    })
  })

  it('eas-cli 는 스펙이 잰 24.8.0 이상이다', () => {
    expect(easJson.cli?.version).toBe('>= 24.8.0')
  })
})
