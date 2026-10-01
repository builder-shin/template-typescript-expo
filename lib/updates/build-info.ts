/**
 * 홈의 빌드 정보 카드 - 스펙 10.6. OTA 가 실제로 도는지 눈으로 확인하는 최소 장치다.
 *
 * 앱 버전·변형·OTA·runtime version·채널·업데이트 ID 를 행으로 만들고, "업데이트 확인" 의 순서(확인 → 받기 →
 * 다시 켜기)와 그 결과의 문구를 정한다. expo-updates·expo-constants 의 값은 platform/updates.ts 가 읽어 넘기고
 * 호출은 주입받는다 - 이 파일은 네이티브 모듈을 모른다(스펙 5장).
 */

/** platform/updates.ts 가 expo-updates·expo-constants 에서 읽은 이 실행의 값. */
export interface BuildInfo {
  /** 앱 버전(Constants.expoConfig.version). */
  appVersion: string | null
  /** 빌드 변형(extra.appVariant). */
  variant: string
  /** OTA 가 켜져 있는가(Updates.isEnabled). */
  otaEnabled: boolean
  /** Updates.runtimeVersion - OTA 를 끈 Android 빌드는 빈 문자열을 준다. */
  runtimeVersion: string | null
  /** Updates.channel - 채널이 없는 빌드는 null 이나 빈 문자열이다. */
  channel: string | null
  /** 지금 도는 업데이트의 id(Updates.updateId). OTA 를 끈 빌드는 null 이다. */
  updateId: string | null
  /** 앱에 들어 있던 번들로 떴는가(Updates.isEmbeddedLaunch). */
  embeddedLaunch: boolean
}

/** 카드의 한 줄. key 는 testID(`build-info-<key>`)의 끝이다 - E2E 가 찾는다. */
export interface BuildInfoRow {
  key: 'version' | 'variant' | 'ota' | 'runtime' | 'channel' | 'update'
  label: string
  value: string
}

/** 값이 없는 자리의 표시. */
export const NO_VALUE = '없음'

function shown(value: string | null): string {
  return value === null || value.trim() === '' ? NO_VALUE : value
}

/** 카드의 행과, "업데이트 확인" 을 누를 수 있는가(OTA 를 끈 빌드는 확인할 업데이트가 없다). */
export function buildInfoView(info: BuildInfo): { rows: BuildInfoRow[]; canCheck: boolean } {
  const updateId = shown(info.updateId)
  return {
    rows: [
      { key: 'version', label: '앱 버전', value: shown(info.appVersion) },
      { key: 'variant', label: '변형', value: info.variant },
      { key: 'ota', label: 'OTA', value: info.otaEnabled ? '켜짐' : '꺼짐' },
      { key: 'runtime', label: 'runtime version', value: shown(info.runtimeVersion) },
      { key: 'channel', label: '채널', value: shown(info.channel) },
      {
        key: 'update',
        label: '업데이트 ID',
        value: info.embeddedLaunch && updateId !== NO_VALUE ? `${updateId} (내장 번들)` : updateId,
      },
    ],
    canCheck: info.otaEnabled,
  }
}

/** expo-updates 의 세 호출 가운데 여기서 읽는 자리 - platform/updates.ts 가 넘긴다. */
export interface UpdatesApi {
  checkForUpdateAsync: () => Promise<{ isAvailable: boolean; isRollBackToEmbedded: boolean }>
  fetchUpdateAsync: () => Promise<{ isNew: boolean; isRollBackToEmbedded: boolean }>
  reloadAsync: () => Promise<void>
}

/** "업데이트 확인" 의 결과. */
export type UpdateCheckResult =
  /** 받을 것이 없다. */
  | { kind: 'current' }
  /** 받았고 다시 켠다 - 앱이 곧 새 번들로 다시 뜬다. */
  | { kind: 'reloading' }
  /** 확인·받기·다시 켜기 가운데 하나가 거절됐다. */
  | { kind: 'failed'; message: string }

/**
 * 서버에 새 업데이트(또는 내장 번들로 되돌리라는 지시)가 있으면 받아서 바로 다시 켠다 - 스펙 10.6 의 "받은
 * 업데이트를 바로 적용한다". 없으면 current 다. 거절은 던지지 않고 결과로 돌려준다 - 화면이 문구로 그린다.
 * 켤 때의 자동 확인(ON_LOAD)이 이미 받아 둔 업데이트도 확인이 다시 알리고 받기가 곧바로 끝난다.
 */
export async function checkAndApplyUpdate(api: UpdatesApi): Promise<UpdateCheckResult> {
  try {
    const check = await api.checkForUpdateAsync()
    if (!check.isAvailable && !check.isRollBackToEmbedded) return { kind: 'current' }
    const fetched = await api.fetchUpdateAsync()
    if (!fetched.isNew && !fetched.isRollBackToEmbedded) return { kind: 'current' }
    await api.reloadAsync()
    return { kind: 'reloading' }
  } catch (error) {
    return { kind: 'failed', message: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * 확인 버튼과 결과 문구. 도는 동안과 다시 켜는 동안은 버튼이 스피너만 그린다 - 로딩에 글자를 쓰지 않는다(스펙
 * 8.7). 결과는 확인이 끝난 뒤에만 글로 적는다.
 */
export function updateCheckView(
  pending: boolean,
  result: UpdateCheckResult | undefined,
): { busy: boolean; message: string | null } {
  if (pending || result?.kind === 'reloading') return { busy: true, message: null }
  if (result === undefined) return { busy: false, message: null }
  if (result.kind === 'current') return { busy: false, message: '새 업데이트가 없습니다.' }
  return { busy: false, message: `업데이트를 확인하지 못했습니다. ${result.message}` }
}
