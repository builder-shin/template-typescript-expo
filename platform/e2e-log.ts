import { variantProfile } from '@/lib/config/app-variant'
import { markedNativeLog } from '@/lib/jsonapi/failure-log'
import { startupVariant } from '@/platform/config'

/** React Native 가 전역에 두는 네이티브 로그 함수 - console 이 줄마다 찾아 부른다. */
type NativeLoggingHook = (message: string, level: number) => void

/**
 * e2e 변형에서 JS 경고가 네이티브 로그로 갈 때 표식을 붙인다(lib/jsonapi/failure-log.ts 의 WARNING_MARKER) - iOS
 * 시뮬레이터 로그는 경고를 정보와 같은 유형으로 남겨 E2E 가드가 가를 수 없다(스펙 11.3). React Native 의 console 은
 * 줄마다 `globalThis.nativeLoggingHook` 을 찾아 부르므로(`@react-native/js-polyfills/console.js`) 그 자리 하나를
 * 감싼다 - console.warn 과, React 가 console.error('Warning: …') 로 내는 경고가 함께 걸린다. 표식을 남기는 변형은
 * HTTP 실패 줄과 같은 변형 칸(logsHttpFailures - e2e 만)이 정한다. 다른 변형은 건드리지 않는다.
 *
 * 루트 레이아웃이 설정 검증을 통과했을 때 모듈 평가 시점에 한 번 부른다 - 그보다 먼저 평가된 모듈의 경고는
 * 표식이 없다(같은 번들을 도는 Android 의 가드가 수준으로 잡는다).
 */
export function markNativeWarningsForE2e(): void {
  if (!variantProfile(startupVariant()).logsHttpFailures) return
  const scope = globalThis as { nativeLoggingHook?: NativeLoggingHook }
  const hook = scope.nativeLoggingHook
  if (hook === undefined) return
  scope.nativeLoggingHook = (message, level) => {
    hook(markedNativeLog(message, level), level)
  }
}
