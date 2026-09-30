/**
 * 앱 시작 설정의 판단 - 스펙 10.1·10.2.
 *
 * 빌드가 app.config.ts 의 extra 에 실은 값(backendUrl·appVariant)을 앱이 읽는 모양으로 바꾸고,
 * 시작 검증의 실패를 던지지 않는 결과로 바꾼다. extra 의 모양은 런타임에 모른다 - OTA 로 들어온
 * 설정도 여기를 지난다 - 그래서 문자열이 아닌 값은 없는 것으로 본다.
 *
 * 부르는 곳은 platform/config.ts 하나다. 설정 자리를 바꾸는 바인딩(setSettingsSource)과
 * expo-constants 호출은 거기 있다(루트 AGENTS.md 의 계층 표). app.config.ts 가 이 디렉터리를 직접
 * 실행하므로 import 에는 `.ts` 확장자를 붙인다(lib/config/AGENTS.md).
 */
import { parseAppVariant, type AppVariant } from './app-variant.ts'
import type { Settings, SettingsEnv } from './settings.ts'

/** 시작 검증의 결과. 실패하면 루트 레이아웃이 message 를 치명 오류 화면에 그린다. */
export type StartupSettings = { ok: true; settings: Settings } | { ok: false; message: string }

function extraString(extra: unknown, key: string): string | undefined {
  if (typeof extra !== 'object' || extra === null) return undefined
  const value = (extra as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : undefined
}

/** extra 를 설정 자리의 모양(settings.ts 의 SettingsEnv)으로 바꾼다. */
export function settingsEnvFromExtra(extra: unknown): SettingsEnv {
  return { BACKEND_URL: extraString(extra, 'backendUrl') }
}

/** 설정을 읽어 검증한다. 던지면 그 message 를 담은 실패로 돌려준다 - 앱을 죽이지 않는다. */
export function checkStartupSettings(load: () => Settings): StartupSettings {
  try {
    return { ok: true, settings: load() }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * 빌드가 extra.appVariant 에 실은 변형. 값이 없으면 기본값이고, 목록 밖의 값은 던진다 -
 * app.config.ts 가 빌드 시점에 이미 거절한 값이라 앱에 올 수 없다.
 */
export function variantFromExtra(extra: unknown): AppVariant {
  return parseAppVariant(extraString(extra, 'appVariant'))
}
