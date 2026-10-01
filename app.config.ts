import type { ConfigContext, ExpoConfig } from 'expo/config'

import {
  assertBackendUrlAllowed,
  parseAppVariant,
  variantProfile,
} from './lib/config/app-variant.ts'
import { loadSettings } from './lib/config/settings.ts'
import { easProjectId, RUNTIME_VERSION_POLICY, updatesConfig } from './lib/config/updates.ts'

/**
 * 앱 식별자와 빌드 설정의 정본(스펙 10.1).
 *
 * 이 파일은 expo start · expo export · expo prebuild · EAS 빌드 · OTA 발행이 평가한다.
 * 필수 설정이 없으면 **그 명령 전체가 여기서 멈춘다.** 검증 함수는 앱이 시작할 때
 * 쓰는 것과 같다(lib/config/settings.ts) - 두 벌을 두지 않는다.
 *
 * 기본 식별자는 일부러 배포할 수 없는 값이다. Google Play 는 com.example 로 시작하는
 * 패키지 이름을 받지 않는다 - 템플릿 사용자는 배포 전에 BASE_APP_ID 를 반드시
 * 바꾸게 된다(스펙 10.3).
 *
 * OTA(스펙 10.6)는 채널이 있는 변형(preview·production)에 EAS 프로젝트(EAS_PROJECT_ID)가 있을 때만 켠다
 * (lib/config/updates.ts). 켠 빌드만 runtime version 을 fingerprint 정책으로 둔다 - 끈 빌드(development·e2e,
 * 프로젝트가 없는 배포 변형)는 받을 업데이트가 없으니 빌드 중에 지문을 계산하지 않는다.
 */
export const BASE_APP_ID = 'com.example.templateexpo'
export const BASE_SCHEME = 'templateexpo'
export const BASE_NAME = 'Template Expo'

export default function appConfig({ config }: ConfigContext): ExpoConfig {
  const variant = parseAppVariant(process.env.APP_VARIANT)
  const { backendUrl } = loadSettings({ BACKEND_URL: process.env.BACKEND_URL })
  assertBackendUrlAllowed(backendUrl, variant)
  const projectId = easProjectId(process.env)
  const updates = updatesConfig(variant, projectId)
  const profile = variantProfile(variant)
  const appId = `${BASE_APP_ID}${profile.idSuffix}`

  return {
    ...config,
    name: `${BASE_NAME}${profile.nameSuffix}`,
    slug: 'template-typescript-expo',
    version: '0.1.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    scheme: `${BASE_SCHEME}${profile.schemeSuffix}`,
    userInterfaceStyle: 'automatic',
    ...(updates.enabled ? { runtimeVersion: RUNTIME_VERSION_POLICY } : {}),
    updates,
    ios: {
      supportsTablet: true,
      bundleIdentifier: appId,
      infoPlist: {
        NSAppTransportSecurity: { NSAllowsLocalNetworking: profile.allowCleartext },
      },
    },
    android: {
      package: appId,
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
    },
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        { backgroundColor: '#E6F4FE', image: './assets/splash-icon.png', imageWidth: 76 },
      ],
      ['expo-build-properties', { android: { usesCleartextTraffic: profile.allowCleartext } }],
      // 세션 항목(SecureStore)을 Android 자동 백업에서 뺀다 - 복원된 백업은 키 저장소의 키가 없어
      // 풀 수 없다. 생체 인증을 쓰지 않으므로(스펙 1.2) Face ID 사용 문구를 넣지 않는다(스펙 7.1).
      ['expo-secure-store', { configureAndroidBackup: true, faceIDPermission: false }],
    ],
    experiments: { typedRoutes: true, reactCompiler: true },
    // eas-cli 와 EAS 빌드는 extra.eas.projectId 로 프로젝트를 찾는다.
    extra: {
      backendUrl,
      appVariant: variant,
      ...(projectId === null ? {} : { eas: { projectId } }),
    },
  }
}
