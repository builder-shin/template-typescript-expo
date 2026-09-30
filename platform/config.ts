import Constants from 'expo-constants'

import { getSettings, setSettingsSource, type Settings } from '@/lib/config/settings'

/**
 * 설정의 자리를 app.config.ts 의 extra 로 돌리고, 시작할 때 한 번 검증한다(스펙 10.1).
 *
 * 값은 빌드 시점에 이미 검증됐지만 OTA 로 들어온 설정까지 대비해 다시 본다. 실패하면
 * 던지지 않고 결과로 돌려준다 - 루트 레이아웃이 그것을 치명 오류 화면으로 그린다.
 */
export type StartupSettings = { ok: true; settings: Settings } | { ok: false; message: string }

function extraString(key: string): string | undefined {
  const extra: Record<string, unknown> | undefined = Constants.expoConfig?.extra
  const value = extra?.[key]
  return typeof value === 'string' ? value : undefined
}

export function loadStartupSettings(): StartupSettings {
  setSettingsSource(() => ({ BACKEND_URL: extraString('backendUrl') }))
  try {
    return { ok: true, settings: getSettings() }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) }
  }
}
