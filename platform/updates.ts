import Constants from 'expo-constants'
import * as Updates from 'expo-updates'

import type { BuildInfo, UpdatesApi } from '@/lib/updates/build-info'
import { startupVariant } from '@/platform/config'

/**
 * expo-updates·expo-constants 를 부르는 자리 - 홈의 빌드 정보 카드(스펙 10.6). 판단(행, 확인 순서, 문구)은
 * lib/updates/build-info.ts 에 있고 여기서는 값을 읽고 호출을 넘기기만 한다.
 */

/** 이 실행의 빌드 정보. 앱이 떠 있는 동안 바뀌지 않는다 - 받은 업데이트는 다시 켜야 적용된다. */
export function readBuildInfo(): BuildInfo {
  return {
    appVersion: Constants.expoConfig?.version ?? null,
    variant: startupVariant(),
    otaEnabled: Updates.isEnabled,
    runtimeVersion: Updates.runtimeVersion,
    channel: Updates.channel,
    updateId: Updates.updateId,
    embeddedLaunch: Updates.isEmbeddedLaunch,
  }
}

/** "업데이트 확인" 이 부르는 expo-updates 의 세 호출(queries/updates.ts). */
export const updatesApi: UpdatesApi = {
  checkForUpdateAsync: () => Updates.checkForUpdateAsync(),
  fetchUpdateAsync: () => Updates.fetchUpdateAsync(),
  reloadAsync: () => Updates.reloadAsync(),
}
