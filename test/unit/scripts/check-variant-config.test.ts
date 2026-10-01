import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * 변형별 설정 검사(scripts/check-variant-config.mjs, 게이트 [8])를 잰다. 게이트는 실제 Expo CLI 의
 * `expo config --type introspect` 출력을 넘기고, 여기서는 그 모양을 줄인 표본을 넘긴다 - 표본의 값은 변형 표를
 * 불러오지 않고 글자로 적는다(표를 불러오면 검사와 표본이 함께 틀려도 통과한다). 한 번도 빨개지지 않은 검사는
 * 있으나 마나라서 자리마다 어긋난 표본이 실패하는 것을 본다.
 */
const SCRIPT = resolve('scripts/check-variant-config.mjs')
// 실제 EAS 프로젝트 id 가 아니다 - 게이트가 쓰는 것과 같은, 모양만 UUID 인 표본이다.
const PROJECT_ID = '00000000-0000-4000-8000-000000000000'
// 다른 프로젝트의 업데이트 주소 - OTA 주소 자리가 프로젝트 id 까지 맞대는지 본다.
const OTHER_PROJECT_URL = 'https://u.expo.dev/11111111-1111-4111-8111-111111111111'

type Variant = 'development' | 'preview' | 'production' | 'e2e'

const NATIVE: Record<
  Variant,
  { id: string; scheme: string; name: string; cleartext: boolean; channel: string | null }
> = {
  development: {
    id: 'com.example.templateexpo.dev',
    scheme: 'templateexpo-dev',
    name: 'Template Expo (Dev)',
    cleartext: true,
    channel: null,
  },
  preview: {
    id: 'com.example.templateexpo.preview',
    scheme: 'templateexpo-preview',
    name: 'Template Expo (Preview)',
    cleartext: false,
    channel: 'preview',
  },
  production: {
    id: 'com.example.templateexpo',
    scheme: 'templateexpo',
    name: 'Template Expo',
    cleartext: false,
    channel: 'production',
  },
  e2e: {
    id: 'com.example.templateexpo.e2e',
    scheme: 'templateexpo-e2e',
    name: 'Template Expo (E2E)',
    cleartext: true,
    channel: null,
  },
}

interface MetaData {
  $: { 'android:name': string; 'android:value': string }
}

/** `expo config --type introspect --json` 출력에서 검사가 읽는 자리만 남긴 표본. */
function introspected(variant: Variant, projectId: string | null) {
  const native = NATIVE[variant]
  const url = `https://u.expo.dev/${PROJECT_ID}`
  const ota = native.channel !== null && projectId !== null
  const headers = { 'expo-channel-name': native.channel ?? '' }
  const metaData: MetaData[] = [
    { $: { 'android:name': 'expo.modules.updates.ENABLED', 'android:value': String(ota) } },
    {
      $: {
        'android:name': 'expo.modules.updates.EXPO_UPDATES_CHECK_ON_LAUNCH',
        'android:value': 'ALWAYS',
      },
    },
    {
      $: {
        'android:name': 'expo.modules.updates.EXPO_UPDATES_LAUNCH_WAIT_MS',
        'android:value': '0',
      },
    },
  ]
  if (ota) {
    metaData.push(
      { $: { 'android:name': 'expo.modules.updates.EXPO_UPDATE_URL', 'android:value': url } },
      {
        $: {
          'android:name': 'expo.modules.updates.UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY',
          'android:value': JSON.stringify(headers),
        },
      },
    )
  }
  const strings = [{ $: { name: 'app_name' }, _: native.name }]
  if (ota) strings.push({ $: { name: 'expo_runtime_version' }, _: 'file:fingerprint' })
  const expoPlist: Record<string, unknown> = {
    EXUpdatesEnabled: ota,
    EXUpdatesCheckOnLaunch: 'ALWAYS',
    EXUpdatesLaunchWaitMs: 0,
  }
  if (ota) {
    expoPlist.EXUpdatesURL = url
    expoPlist.EXUpdatesRequestHeaders = headers
    expoPlist.EXUpdatesRuntimeVersion = 'file:fingerprint'
  }
  return {
    android: { package: native.id },
    ios: { bundleIdentifier: native.id },
    extra: {
      backendUrl: 'https://gate-check.invalid',
      appVariant: variant,
      ...(projectId === null ? {} : { eas: { projectId } }),
      router: {},
    },
    _internal: {
      modResults: {
        android: {
          manifest: {
            manifest: {
              application: [
                {
                  $: { 'android:usesCleartextTraffic': String(native.cleartext) },
                  'meta-data': metaData,
                  activity: [
                    {
                      'intent-filter': [
                        { action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }] },
                        { data: [{ $: { 'android:scheme': native.scheme } }] },
                      ],
                    },
                  ],
                },
              ],
            },
          },
          strings: { resources: { string: strings } },
        },
        ios: {
          infoPlist: {
            NSAppTransportSecurity: { NSAllowsLocalNetworking: native.cleartext },
            CFBundleURLTypes: [{ CFBundleURLSchemes: [native.scheme, native.id] }],
          },
          expoPlist,
        },
      },
    },
  }
}

type Introspected = ReturnType<typeof introspected>

interface Result {
  status: number | null
  stdout: string
  stderr: string
}

function check(args: string[], input: string): Result {
  const result = spawnSync(
    process.execPath,
    ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', SCRIPT, ...args],
    { input, encoding: 'utf8' },
  )
  return { status: result.status, stdout: result.stdout, stderr: result.stderr }
}

function checkConfig(config: unknown, variant: Variant, projectId: string | null): Result {
  return check([variant, projectId ?? ''], JSON.stringify(config))
}

/** 표본을 한 자리만 고쳐 넘긴다. */
function mutated(
  variant: Variant,
  projectId: string | null,
  mutate: (config: Introspected) => void,
): Result {
  const config = introspected(variant, projectId)
  mutate(config)
  return checkConfig(config, variant, projectId)
}

/** 실패 머리말의 `(<대상>)` - 검사기가 맞댄 변형과 EAS 프로젝트. */
function targetOf(variant: Variant, projectId: string | null): string {
  return projectId === null ? variant : `${variant} + EAS 프로젝트 ${projectId}`
}

/** 실패 출력(stderr)을 머리말 한 줄과 위반 줄들로 나눈다. */
function failureOf(stderr: string): { header: string; lines: string[] } {
  const [header = '', ...lines] = stderr.trimEnd().split('\n')
  return { header, lines }
}

function metaDataOf(config: Introspected): MetaData[] {
  const [application] = config._internal.modResults.android.manifest.manifest.application
  if (application === undefined) throw new Error('표본에 application 이 없다')
  return application['meta-data']
}

function metaItem(config: Introspected, name: string): MetaData | undefined {
  return metaDataOf(config).find((item) => item.$['android:name'] === name)
}

const VARIANTS: Variant[] = ['development', 'preview', 'production', 'e2e']

describe('변형별 설정 검사 - 게이트 [8]', { timeout: 30_000 }, () => {
  it.each(
    VARIANTS.flatMap((variant) => [[variant, null] as const, [variant, PROJECT_ID] as const]),
  )('%s (EAS 프로젝트 %s) 의 맞는 설정은 통과한다', (variant, projectId) => {
    const result = checkConfig(introspected(variant, projectId), variant, projectId)
    expect(result.stderr).toBe('')
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('변형 설정 통과')
  })

  it('OTA 를 켠 설정이면 채널을 알린다', () => {
    expect(
      checkConfig(introspected('preview', PROJECT_ID), 'preview', PROJECT_ID).stdout,
    ).toContain('OTA 켬(채널 preview)')
  })

  it('맞는 설정이면 성공 줄이 대상과 맞댄 건수와 OTA 상태를 한 줄로 말한다', () => {
    // 맞대는 자리는 OTA 를 끈 설정이 17개, 켠 설정은 확인 시점과 기다림이 두 플랫폼에서 더해져 21개다.
    for (const variant of VARIANTS) {
      for (const projectId of [null, PROJECT_ID]) {
        const { channel } = NATIVE[variant]
        const target = targetOf(variant, projectId)
        const expected =
          channel !== null && projectId !== null
            ? `변형 설정 통과: ${target} - 21건, OTA 켬(채널 ${channel})`
            : `변형 설정 통과: ${target} - 17건, OTA 끔`
        const result = checkConfig(introspected(variant, projectId), variant, projectId)
        expect(result.stdout.trimEnd(), target).toBe(expected)
      }
    }
  })

  it.each([
    [
      'preview 의 Android OTA 가 꺼져 있다',
      'preview' as const,
      PROJECT_ID,
      (config: Introspected) => {
        const enabled = metaItem(config, 'expo.modules.updates.ENABLED')
        if (enabled !== undefined) enabled.$['android:value'] = 'false'
      },
      'Android OTA(expo.modules.updates.ENABLED)',
    ],
    [
      'preview 의 Android 채널이 production 이다',
      'preview' as const,
      PROJECT_ID,
      (config: Introspected) => {
        const headers = metaItem(
          config,
          'expo.modules.updates.UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY',
        )
        if (headers !== undefined) {
          headers.$['android:value'] = JSON.stringify({ 'expo-channel-name': 'production' })
        }
      },
      'Android OTA 채널',
    ],
    [
      'production 의 iOS 채널이 없다',
      'production' as const,
      PROJECT_ID,
      (config: Introspected) => {
        delete config._internal.modResults.ios.expoPlist.EXUpdatesRequestHeaders
      },
      'iOS OTA 채널',
    ],
    [
      'production 의 runtime version 이 fingerprint 가 아니다',
      'production' as const,
      PROJECT_ID,
      (config: Introspected) => {
        config._internal.modResults.ios.expoPlist.EXUpdatesRuntimeVersion = '0.1.0'
      },
      'iOS runtime version',
    ],
    [
      'e2e 인데 OTA 가 켜져 있다',
      'e2e' as const,
      null,
      (config: Introspected) => {
        config._internal.modResults.ios.expoPlist.EXUpdatesEnabled = true
      },
      'iOS OTA(EXUpdatesEnabled)',
    ],
    [
      'preview 가 평문 HTTP 를 허용한다(Android)',
      'preview' as const,
      null,
      (config: Introspected) => {
        const [application] = config._internal.modResults.android.manifest.manifest.application
        if (application !== undefined) application.$['android:usesCleartextTraffic'] = 'true'
      },
      'Android 평문 HTTP(usesCleartextTraffic)',
    ],
    [
      'production 이 평문 HTTP 를 허용한다(iOS)',
      'production' as const,
      null,
      (config: Introspected) => {
        config._internal.modResults.ios.infoPlist.NSAppTransportSecurity.NSAllowsLocalNetworking = true
      },
      'iOS 평문 HTTP(NSAllowsLocalNetworking)',
    ],
    [
      'development 에 .env 의 EAS 프로젝트 id 가 섞였다',
      'development' as const,
      null,
      (config: Introspected) => {
        Object.assign(config.extra, { eas: { projectId: PROJECT_ID } })
      },
      'extra.eas',
    ],
    [
      'e2e 에 다른 변형의 scheme 이 들어 있다',
      'e2e' as const,
      null,
      (config: Introspected) => {
        const [application] = config._internal.modResults.android.manifest.manifest.application
        application?.activity[0]?.['intent-filter'].push({
          data: [{ $: { 'android:scheme': 'templateexpo' } }],
        })
      },
      'Android 딥링크 scheme',
    ],
    [
      '앱 설정의 변형이 다르다',
      'production' as const,
      null,
      (config: Introspected) => {
        config.extra.appVariant = 'development'
      },
      'extra.appVariant',
    ],
    [
      'preview 의 Android 패키지가 다른 변형의 것이다',
      'preview' as const,
      null,
      (config: Introspected) => {
        config.android.package = 'com.example.templateexpo'
      },
      'Android 패키지',
    ],
    [
      'e2e 의 Android 앱 이름이 다른 변형의 것이다',
      'e2e' as const,
      null,
      (config: Introspected) => {
        const name = config._internal.modResults.android.strings.resources.string.find(
          (item) => item.$.name === 'app_name',
        )
        if (name !== undefined) name._ = 'Template Expo (Dev)'
      },
      'Android 앱 이름',
    ],
    [
      'preview 의 Android OTA 주소가 다른 프로젝트다',
      'preview' as const,
      PROJECT_ID,
      (config: Introspected) => {
        const url = metaItem(config, 'expo.modules.updates.EXPO_UPDATE_URL')
        if (url !== undefined) url.$['android:value'] = OTHER_PROJECT_URL
      },
      'Android OTA 주소',
    ],
    [
      'production 의 Android runtime version 이 fingerprint 가 아니다',
      'production' as const,
      PROJECT_ID,
      (config: Introspected) => {
        const runtimeVersion = config._internal.modResults.android.strings.resources.string.find(
          (item) => item.$.name === 'expo_runtime_version',
        )
        if (runtimeVersion !== undefined) runtimeVersion._ = '0.1.0'
      },
      'Android runtime version',
    ],
    [
      'preview 의 Android 가 앱을 켤 때 업데이트를 확인하지 않는다',
      'preview' as const,
      PROJECT_ID,
      (config: Introspected) => {
        const onLaunch = metaItem(config, 'expo.modules.updates.EXPO_UPDATES_CHECK_ON_LAUNCH')
        if (onLaunch !== undefined) onLaunch.$['android:value'] = 'NEVER'
      },
      'Android OTA 확인 시점',
    ],
    [
      'preview 의 Android 가 업데이트를 기다린다',
      'preview' as const,
      PROJECT_ID,
      (config: Introspected) => {
        const wait = metaItem(config, 'expo.modules.updates.EXPO_UPDATES_LAUNCH_WAIT_MS')
        if (wait !== undefined) wait.$['android:value'] = '5000'
      },
      'Android OTA 기다림',
    ],
    [
      'production 의 iOS 번들 ID 가 다른 변형의 것이다',
      'production' as const,
      null,
      (config: Introspected) => {
        config.ios.bundleIdentifier = 'com.example.templateexpo.dev'
      },
      'iOS 번들 ID',
    ],
    [
      'e2e 의 iOS 에 다른 변형의 URL scheme 이 들어 있다',
      'e2e' as const,
      null,
      (config: Introspected) => {
        config._internal.modResults.ios.infoPlist.CFBundleURLTypes[0]?.CFBundleURLSchemes.push(
          'templateexpo',
        )
      },
      'iOS URL scheme',
    ],
    [
      'production 의 iOS OTA 주소가 다른 프로젝트다',
      'production' as const,
      PROJECT_ID,
      (config: Introspected) => {
        config._internal.modResults.ios.expoPlist.EXUpdatesURL = OTHER_PROJECT_URL
      },
      'iOS OTA 주소',
    ],
    [
      'preview 의 iOS 가 앱을 켤 때 업데이트를 확인하지 않는다',
      'preview' as const,
      PROJECT_ID,
      (config: Introspected) => {
        config._internal.modResults.ios.expoPlist.EXUpdatesCheckOnLaunch = 'NEVER'
      },
      'iOS OTA 확인 시점',
    ],
    [
      'preview 의 iOS 가 업데이트를 기다린다',
      'preview' as const,
      PROJECT_ID,
      (config: Introspected) => {
        config._internal.modResults.ios.expoPlist.EXUpdatesLaunchWaitMs = 5000
      },
      'iOS OTA 기다림',
    ],
  ])('%s 면 실패하고 그 자리를 알린다', (_label, variant, projectId, mutate, where) => {
    const result = mutated(variant, projectId, mutate)
    const { header, lines } = failureOf(result.stderr)
    expect(result.status).toBe(1)
    // 자리 하나만 고쳤으니 위반도 하나다 - 머리말이 대상과 건수를 말한다.
    expect(header).toBe(`변형 설정 위반 1건 (${targetOf(variant, projectId)}):`)
    expect(lines).toHaveLength(1)
    expect(lines[0]).toContain(`- ${where}:`)
  })

  it.each(VARIANTS)('%s 의 설정 JSON 에 네이티브 설정이 없으면 위반으로 실패한다', (variant) => {
    // 문법은 맞지만 expo config --type introspect 의 출력이 아닌 JSON - 빈 객체, null, 배열.
    for (const input of ['{}', 'null', '[]']) {
      const result = check([variant], input)
      const { header, lines } = failureOf(result.stderr)
      expect(result.status, input).toBe(1)
      expect(header, input).toBe(`변형 설정 위반 ${lines.length}건 (${variant}):`)
      // 네이티브 설정(_internal)에서 읽는 자리도 맞댄 채 위반으로 알린다.
      expect(result.stderr, input).toContain('- Android 앱 이름:')
      expect(result.stderr, input).toContain('- iOS 평문 HTTP(NSAllowsLocalNetworking):')
    }
  })

  it('변형을 주지 않으면 사용법을 알리고 실패한다', () => {
    // 빈 값과 공백도 주지 않은 것이다 - 변형 파서의 기본값(development)으로 넘어가면 엉뚱한 변형을 검사한다.
    for (const args of [[], [''], ['  ']]) {
      const result = check(args, '{}')
      expect(result.status, JSON.stringify(args)).toBe(1)
      expect(result.stderr, JSON.stringify(args)).toContain('사용법')
    }
  })

  it('목록 밖의 변형이나 UUID 가 아닌 프로젝트 id 는 실패한다', () => {
    const variant = check(['staging'], '{}')
    expect(variant.status).toBe(1)
    expect(variant.stderr).toContain('APP_VARIANT must be one of')
    const project = check(['preview', 'probe'], '{}')
    expect(project.status).toBe(1)
    expect(project.stderr).toContain('EAS_PROJECT_ID must be a UUID')
  })

  it('JSON 이 아니면 실패한다', () => {
    const result = check(['preview'], 'probe')
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('설정 JSON 을 읽지 못했다')
  })
})
