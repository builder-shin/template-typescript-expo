import * as SecureStore from 'expo-secure-store'

import { SESSION_STORAGE_KEY, type SessionStorage } from '@/lib/auth/session-store'

/**
 * 세션 항목의 저장 매체 - 기기 보안 저장소(스펙 7.1).
 *
 * iOS 키체인 보관 등급은 AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY 다 - 다른 기기로 옮겨지지 않는다.
 * Android 는 이 옵션을 쓰지 않는다. Android 자동 백업에서 빠지는 것은 app.config.ts 의
 * expo-secure-store 플러그인(configureAndroidBackup)이 맡는다.
 */
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
}

export const secureSessionStorage: SessionStorage = {
  read: () => SecureStore.getItemAsync(SESSION_STORAGE_KEY, OPTIONS),
  write: (value) => SecureStore.setItemAsync(SESSION_STORAGE_KEY, value, OPTIONS),
  clear: () => SecureStore.deleteItemAsync(SESSION_STORAGE_KEY, OPTIONS),
}
