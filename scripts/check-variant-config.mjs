/**
 * 변형별 설정을 검사한다(스펙 10.2·10.6, 15장 단계 6). 게이트 [8] 이 변형마다 부른다.
 *
 *   APP_VARIANT=<변형> EAS_PROJECT_ID=<id 또는 빈 값> BACKEND_URL=<주소> \
 *     pnpm exec expo config --type introspect --json |
 *     node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/check-variant-config.mjs <변형> [<id>]
 *
 * `expo config --type introspect` 는 빌드하지 않고 설정 플러그인을 돌려, 네이티브 설정(AndroidManifest.xml·
 * strings.xml·Info.plist·Expo.plist)에 들어갈 값을 `_internal.modResults` 에 낸다. 이 스크립트는 그 값이 변형
 * 표(lib/config/app-variant.ts)와 OTA 판단(lib/config/updates.ts)이 정한 것과 같은지 본다 - 식별자·scheme·앱
 * 이름, 평문 HTTP, OTA(켬·끔, 주소, 채널, 확인 시점, runtime version 정책), EAS 프로젝트 id. 표의 값 자체는 단위
 * 시험이 잰다. 여기서 재는 것은 Expo CLI 가 평가하고 플러그인이 옮긴 최종 값이 표와 같은가다 - 플러그인이
 * 빠지거나 값을 덮으면, .env 의 값이 섞이면 여기서 드러난다.
 *
 * 기대값은 app.config.ts 와 같은 판단에서 가져온다 - app.config.ts 처럼 Node 의 type stripping 으로 `.ts` 를
 * 불러온다(lib/config/AGENTS.md). package.json 에 "type" 이 없어 Node 가 그 `.ts` 를 ES 모듈로 다시 읽으며 경고를
 * 내므로 게이트는 그 경고 하나를 끈다(--disable-warning). 기대하는 변형과 EAS 프로젝트 id 는 환경 변수가 아니라
 * 인자로 받는다 - 설정을 평가한 환경을 그대로 믿으면 섞인 값도 통과한다. 종료 코드: 0 = 통과, 1 = 위반(무엇이
 * 틀렸는지 stderr 에 전부 적는다).
 */
import { readFileSync } from 'node:fs'

import { BASE_APP_ID, BASE_NAME, BASE_SCHEME } from '../app.config.ts'
import { parseAppVariant, variantProfile } from '../lib/config/app-variant.ts'
import { easProjectId, updatesConfig } from '../lib/config/updates.ts'

/** fingerprint 정책의 runtime version 은 빌드할 때 계산된다 - 그 전의 네이티브 설정에는 이 표식이 들어간다. */
const FINGERPRINT_SENTINEL = 'file:fingerprint'

const USAGE =
  '사용법: node scripts/check-variant-config.mjs <변형> [<EAS 프로젝트 id>] < expo config --type introspect --json 의 출력'

function main() {
  const [variantArg, projectArg = ''] = process.argv.slice(2)
  if (variantArg === undefined || variantArg.trim() === '') {
    console.error(USAGE)
    return 1
  }
  let variant
  let projectId
  try {
    variant = parseAppVariant(variantArg)
    projectId = easProjectId({ EAS_PROJECT_ID: projectArg })
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    return 1
  }

  let config
  try {
    config = JSON.parse(readFileSync(0, 'utf8'))
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    console.error(`설정 JSON 을 읽지 못했다 (${reason}) - ${USAGE}`)
    return 1
  }

  const profile = variantProfile(variant)
  const updates = updatesConfig(variant, projectId)
  const appId = `${BASE_APP_ID}${profile.idSuffix}`
  const scheme = `${BASE_SCHEME}${profile.schemeSuffix}`
  const runtimeVersion = updates.enabled ? FINGERPRINT_SENTINEL : undefined

  const problems = []
  let checks = 0
  const expectValue = (label, actual, expected) => {
    checks += 1
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      problems.push(`${label}: ${JSON.stringify(actual)} - 기대한 값은 ${JSON.stringify(expected)}`)
    }
  }

  // 공개 설정 - 앱이 Constants.expoConfig 로 읽는 값
  expectValue('extra.appVariant', config?.extra?.appVariant, variant)
  expectValue('extra.eas', config?.extra?.eas, projectId === null ? undefined : { projectId })

  // Android - AndroidManifest.xml 과 strings.xml 이 될 값
  const android = config?._internal?.modResults?.android
  const application = android?.manifest?.manifest?.application?.[0]
  const metaData = new Map(
    (application?.['meta-data'] ?? []).map((item) => [
      item?.$?.['android:name'],
      item?.$?.['android:value'],
    ]),
  )
  const strings = new Map(
    (android?.strings?.resources?.string ?? []).map((item) => [item?.$?.name, item?._]),
  )
  const androidSchemes = (application?.activity ?? [])
    .flatMap((activity) => activity?.['intent-filter'] ?? [])
    .flatMap((filter) => filter?.data ?? [])
    .map((data) => data?.$?.['android:scheme'])
    .filter((value) => value !== undefined)

  expectValue('Android 패키지', config?.android?.package, appId)
  expectValue('Android 앱 이름', strings.get('app_name'), `${BASE_NAME}${profile.nameSuffix}`)
  expectValue('Android 딥링크 scheme', androidSchemes, [scheme])
  expectValue(
    'Android 평문 HTTP(usesCleartextTraffic)',
    application?.$?.['android:usesCleartextTraffic'],
    String(profile.allowCleartext),
  )
  expectValue(
    'Android OTA(expo.modules.updates.ENABLED)',
    metaData.get('expo.modules.updates.ENABLED'),
    String(updates.enabled),
  )
  expectValue(
    'Android OTA 주소',
    metaData.get('expo.modules.updates.EXPO_UPDATE_URL'),
    updates.enabled ? updates.url : undefined,
  )
  expectValue(
    'Android OTA 채널',
    metaData.get('expo.modules.updates.UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY'),
    updates.enabled ? JSON.stringify(updates.requestHeaders) : undefined,
  )
  expectValue('Android runtime version', strings.get('expo_runtime_version'), runtimeVersion)
  if (updates.enabled) {
    expectValue(
      'Android OTA 확인 시점',
      metaData.get('expo.modules.updates.EXPO_UPDATES_CHECK_ON_LAUNCH'),
      'ALWAYS',
    )
    expectValue(
      'Android OTA 기다림',
      metaData.get('expo.modules.updates.EXPO_UPDATES_LAUNCH_WAIT_MS'),
      '0',
    )
  }

  // iOS - Info.plist 와 Expo.plist 가 될 값
  const ios = config?._internal?.modResults?.ios
  const expoPlist = ios?.expoPlist ?? {}
  const iosSchemes = (ios?.infoPlist?.CFBundleURLTypes ?? []).flatMap(
    (type) => type?.CFBundleURLSchemes ?? [],
  )

  expectValue('iOS 번들 ID', config?.ios?.bundleIdentifier, appId)
  // Expo 는 번들 ID 도 URL scheme 으로 더한다.
  expectValue('iOS URL scheme', iosSchemes, [scheme, appId])
  expectValue(
    'iOS 평문 HTTP(NSAllowsLocalNetworking)',
    ios?.infoPlist?.NSAppTransportSecurity?.NSAllowsLocalNetworking,
    profile.allowCleartext,
  )
  expectValue('iOS OTA(EXUpdatesEnabled)', expoPlist.EXUpdatesEnabled, updates.enabled)
  expectValue('iOS OTA 주소', expoPlist.EXUpdatesURL, updates.enabled ? updates.url : undefined)
  expectValue(
    'iOS OTA 채널',
    expoPlist.EXUpdatesRequestHeaders,
    updates.enabled ? updates.requestHeaders : undefined,
  )
  expectValue('iOS runtime version', expoPlist.EXUpdatesRuntimeVersion, runtimeVersion)
  if (updates.enabled) {
    expectValue('iOS OTA 확인 시점', expoPlist.EXUpdatesCheckOnLaunch, 'ALWAYS')
    expectValue('iOS OTA 기다림', expoPlist.EXUpdatesLaunchWaitMs, 0)
  }

  const target = `${variant}${projectId === null ? '' : ` + EAS 프로젝트 ${projectId}`}`
  if (problems.length > 0) {
    console.error(`변형 설정 위반 ${problems.length}건 (${target}):`)
    for (const problem of problems) console.error(`- ${problem}`)
    return 1
  }
  const ota = updates.enabled ? `켬(채널 ${updates.requestHeaders['expo-channel-name']})` : '끔'
  console.log(`변형 설정 통과: ${target} - ${checks}건, OTA ${ota}`)
  return 0
}

// process.exit 로 끊지 않는다 - 표준 입력을 연 채 끊으면 Windows 의 Node 가 libuv 단언으로 죽는다(종료 코드 127).
process.exitCode = main()
