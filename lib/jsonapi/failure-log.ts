import type { ErrorObject } from './document'

/**
 * e2e 변형의 API 클라이언트가 2xx 가 아닌 결과를 기기 로그에 남길 때의 한 줄 - 스펙 11.3 의 가드.
 *
 * E2E 하네스(test/e2e/guard-log.sh)가 기기 로그에서 이 표식을 찾아, 플로가 선언하지 않은 상태가
 * 나오면 실패로 만든다. 상태 0 은 백엔드가 응답하지 못한 것(client.ts 가 합성한 오류)이다.
 *
 * 경로와 오류 코드만 적는다 - 쿼리·본문·헤더·문구를 적지 않는다. 토큰과 자격증명이 로그에 남지
 * 않는다(스펙 7.1).
 */
export const HTTP_FAILURE_MARKER = '[e2e-http]'

export function httpFailureLine(
  method: string,
  path: string,
  status: number,
  errors: readonly ErrorObject[],
): string {
  const codes = errors.map((error) => error.code ?? '-').join(',')
  return `${HTTP_FAILURE_MARKER} ${status} ${method.toUpperCase()} ${path} ${codes === '' ? '-' : codes}`
}

/**
 * React Native 의 console 이 네이티브 로그로 넘기는 경고 수준 - `@react-native/js-polyfills/console.js` 의
 * `LOG_LEVELS.warn`. console.warn 과, React 가 console.error('Warning: …') 로 내는 경고가 이 수준으로 간다.
 */
export const NATIVE_WARN_LEVEL = 2

/**
 * e2e 변형이 경고 수준의 줄 앞에 붙이는 표식 - 스펙 11.3 의 가드가 iOS 에서 경고를 가르는 재료다.
 *
 * React Native 0.86 의 iOS 로그 함수는 JS 의 info 와 warn 을 같은 os_log 유형(Info)으로 남긴다
 * (`React/Base/RCTLog.mm` 의 `RCTLogTypeForLogLevel`) - 시뮬레이터 로그만으로는 console.log 와 console.warn 이
 * 갈리지 않는다. Android 의 logcat 은 수준(W)을 싣는다. E2E 하네스의 iOS 로그 변환(test/e2e/ios-log.ts)이 이
 * 표식으로 시작하는 줄을 W 로 옮긴다.
 */
export const WARNING_MARKER = '[e2e-warn]'

/** 네이티브 로그로 가는 한 줄 - 경고 수준이면 앞에 표식을 붙이고, 다른 수준은 그대로 둔다. */
export function markedNativeLog(message: string, level: number): string {
  return level === NATIVE_WARN_LEVEL ? `${WARNING_MARKER} ${message}` : message
}
