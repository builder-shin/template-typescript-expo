import Constants from 'expo-constants'

import type { AppVariant } from '@/lib/config/app-variant'
import { getSettings, setSettingsSource } from '@/lib/config/settings'
import {
  checkStartupSettings,
  settingsEnvFromExtra,
  variantFromExtra,
  type StartupSettings,
} from '@/lib/config/startup'

/**
 * 설정의 자리를 app.config.ts 의 extra 로 돌리고, 시작할 때 한 번 검증한다(스펙 10.1).
 *
 * 값은 빌드 시점에 이미 검증됐지만 OTA 로 들어온 설정까지 대비해 다시 본다. 실패하면 던지지
 * 않고 결과로 돌려준다 - 루트 레이아웃이 그것을 치명 오류 화면으로 그린다. 판단(extra 읽기,
 * 오류 → 문구)은 lib/config/startup.ts 에 있다.
 *
 * 루트 레이아웃이 모듈 평가 시점에 한 번 부른다. 그보다 먼저 getSettings() 를 부르는 코드는 기본
 * 자리(process.env)를 읽어 던진다 - 그래서 어떤 모듈도 최상위에서 getSettings() 를 부르지 않는다
 * (platform/AGENTS.md).
 */
export function loadStartupSettings(): StartupSettings {
  setSettingsSource(() => settingsEnvFromExtra(Constants.expoConfig?.extra))
  return checkStartupSettings(getSettings)
}

/** 빌드가 extra.appVariant 로 실은 변형(스펙 10.2). 값은 app.config.ts 가 빌드 시점에 검증했다. */
export function startupVariant(): AppVariant {
  return variantFromExtra(Constants.expoConfig?.extra)
}
