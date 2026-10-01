/**
 * OTA 업데이트 설정 - 스펙 10.1·10.6.
 *
 * app.config.ts(빌드 시점, node)와 테스트가 함께 쓰는 순수 모듈이다. app.config.ts 가 Node 의 type
 * stripping 으로 직접 실행한다 - 타입만 지우면 도는 구문만 쓰고 import 에는 `.ts` 확장자를 붙인다
 * (lib/config/AGENTS.md).
 */
import { variantProfile, type AppVariant } from './app-variant.ts'

/** EAS Update 의 주소. 뒤에 프로젝트 id 를 경로로 붙인다. */
export const EAS_UPDATE_ORIGIN = 'https://u.expo.dev'

/** OTA 를 켠 빌드의 runtime version 정책 - 네이티브 구성이 같은 빌드에만 업데이트가 간다(스펙 10.6). */
export const RUNTIME_VERSION_POLICY = { policy: 'fingerprint' } as const

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * EAS 프로젝트 id - 선택 변수 EAS_PROJECT_ID(스펙 10.1). 없거나 비어 있으면 null 이다(EAS 프로젝트도 OTA 도
 * 없다).
 *
 * EAS 빌드 서버는 프로젝트 id 를 EAS_BUILD_PROJECT_ID 로 준다. EAS_PROJECT_ID 가 없을 때 그 값을 쓴다 - 빌드를
 * 시작한 eas-cli 는 로컬의 EAS_PROJECT_ID 로 설정을 평가하는데, 서버의 평가에 id 가 빠지면 OTA 가 꺼져 두
 * 평가의 runtime version 이 달라지고 EAS 빌드가 멈춘다.
 *
 * 값이 있는데 UUID 가 아니면 던진다 - 틀린 id 는 업데이트 주소를 틀리게 만들어 OTA 가 소리 없이 멈춘다.
 */
export function easProjectId(env: Readonly<Record<string, string | undefined>>): string | null {
  const raw = [env.EAS_PROJECT_ID, env.EAS_BUILD_PROJECT_ID].find(
    (value) => value !== undefined && value.trim() !== '',
  )
  if (raw === undefined) return null
  const value = raw.trim()
  if (!UUID.test(value)) {
    throw new Error(`EAS_PROJECT_ID must be a UUID (got ${JSON.stringify(raw)})`)
  }
  return value
}

/** app.config.ts 의 updates 자리 - expo-updates 의 설정 플러그인이 네이티브 설정으로 옮긴다. */
export type UpdatesConfig =
  | { readonly enabled: false }
  | {
      readonly enabled: true
      readonly url: string
      readonly checkAutomatically: 'ON_LOAD'
      readonly fallbackToCacheTimeout: 0
      readonly requestHeaders: { readonly 'expo-channel-name': string }
    }

/**
 * 변형과 EAS 프로젝트로 OTA 를 정한다(스펙 10.6). 채널이 있는 변형(preview·production)에 EAS 프로젝트가 있을 때만
 * 켠다. 켜면 앱을 켤 때 확인하지만 기다리지 않는다(ON_LOAD · 0) - 받은 업데이트는 다음 실행에 적용된다.
 *
 * 채널은 요청 머리글(expo-channel-name)로 싣는다. EAS 빌드는 eas.json 프로필의 channel 로 같은 머리글을 다시 쓰고,
 * EAS 밖의 빌드(prebuild + Gradle·xcodebuild)는 이 값을 그대로 쓴다 - 둘이 같은지는
 * test/unit/config/eas-json.test.ts 가 본다.
 */
export function updatesConfig(variant: AppVariant, projectId: string | null): UpdatesConfig {
  const channel = variantProfile(variant).updatesChannel
  if (channel === null || projectId === null) return { enabled: false }
  return {
    enabled: true,
    url: `${EAS_UPDATE_ORIGIN}/${projectId}`,
    checkAutomatically: 'ON_LOAD',
    fallbackToCacheTimeout: 0,
    requestHeaders: { 'expo-channel-name': channel },
  }
}
