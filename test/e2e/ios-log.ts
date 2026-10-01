import { WARNING_MARKER } from '../../lib/jsonapi/failure-log.ts'

/**
 * iOS 시뮬레이터 로그(`log stream --style ndjson`)를 E2E 가드(`test/e2e/guard-log.sh`)가 읽는 `adb logcat -v brief`
 * 모양으로 옮긴다 - 스펙 11.3 의 가드를 두 플랫폼이 같은 스크립트로 건다.
 *
 * React Native 는 JS 의 console 을 os_log 의 `com.facebook.react.log` 서브시스템, `javascript` 범주로 남긴다
 * (`React/Base/RCTLog.mm`). 그 줄만 `ReactNativeJS` 태그로 옮기고, 수준은 이렇게 정한다.
 *
 *   os_log 유형 Error·Fault            E - console.error
 *   표식(WARNING_MARKER)으로 시작한다  W - e2e 변형이 경고 수준의 줄에 붙인다(lib/jsonapi/failure-log.ts)
 *   유형 Debug                         D - console.debug·console.trace
 *   그 밖                              I - console.log·console.info
 *
 * RN 0.86 의 iOS 는 info 와 warn 을 같은 유형(Info)으로 남겨서 표식이 없으면 경고가 I 가 된다. 여러 인자를 넘긴
 * console 호출은 RN 이 문자열 인자를 작은따옴표로 감싸 잇는다 - 그래서 `'[e2e-warn]'` 로 시작하는 줄도 W 다.
 * 줄바꿈이 든 메시지는 줄마다 머리를 붙인다(logcat 과 같다). JSON 이 아닌 줄(`log stream` 의 안내)은 버린다.
 */

interface IosLogEvent {
  readonly subsystem?: unknown
  readonly category?: unknown
  readonly messageType?: unknown
  readonly processID?: unknown
  readonly eventMessage?: unknown
}

function levelOf(event: IosLogEvent, message: string): 'E' | 'W' | 'D' | 'I' {
  if (event.messageType === 'Error' || event.messageType === 'Fault') return 'E'
  if (message.startsWith(WARNING_MARKER) || message.startsWith(`'${WARNING_MARKER}'`)) return 'W'
  if (event.messageType === 'Debug') return 'D'
  return 'I'
}

function parse(line: string): IosLogEvent | null {
  const trimmed = line.trim()
  if (!trimmed.startsWith('{')) return null
  try {
    const value: unknown = JSON.parse(trimmed)
    return typeof value === 'object' && value !== null ? value : null
  } catch {
    return null
  }
}

/** ndjson 전체를 brief 줄들로 옮긴다. 앱의 JS 줄이 아니면 버린다. */
export function briefFromIosLog(ndjson: string): string {
  const out: string[] = []
  for (const line of ndjson.split(/\r?\n/)) {
    const event = parse(line)
    if (event === null) continue
    if (event.subsystem !== 'com.facebook.react.log' || event.category !== 'javascript') continue
    const message = typeof event.eventMessage === 'string' ? event.eventMessage : ''
    const pid = typeof event.processID === 'number' ? event.processID : 0
    const level = levelOf(event, message)
    for (const part of message.split(/\r?\n/)) {
      out.push(`${level}/ReactNativeJS(${String(pid).padStart(5)}): ${part}`)
    }
  }
  return out.map((line) => `${line}\n`).join('')
}
