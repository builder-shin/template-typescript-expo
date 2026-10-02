import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { httpFailureLine, markedNativeLog, NATIVE_WARN_LEVEL } from '@/lib/jsonapi/failure-log'
import { briefFromIosLog } from '@/test/e2e/ios-log'
import { BASH_TIMEOUT_MS, resolveBash } from '../support/bash'

/**
 * iOS 시뮬레이터 로그를 E2E 가드가 읽는 모양으로 옮기는 변환(test/e2e/ios-log.ts)을 잰다. 줄은 앱이 쓰는 함수
 * (markedNativeLog·httpFailureLine)로 만든다 - 앱이 찍는 형식과 변환이 읽는 형식을 이 파일이 맞댄다. 끝의 절은
 * 옮긴 줄을 실제 가드(test/e2e/guard-log.sh)에 넘긴다.
 */

/** `log stream --style ndjson` 의 한 줄 - 변환이 읽는 필드만. */
function event(message: string, messageType = 'Info', category = 'javascript'): string {
  return JSON.stringify({
    subsystem: 'com.facebook.react.log',
    category,
    messageType,
    processID: 4321,
    eventMessage: message,
  })
}

const RUNNING = event('Running "main" with {"rootTag":1}')

describe('briefFromIosLog', () => {
  it('JS 의 정보 줄을 I/ReactNativeJS 로 옮긴다', () => {
    expect(briefFromIosLog(`${RUNNING}\n`)).toBe(
      'I/ReactNativeJS( 4321): Running "main" with {"rootTag":1}\n',
    )
  })

  it('os_log 의 Error·Fault 는 E 다', () => {
    expect(briefFromIosLog(event('probe error', 'Error'))).toBe(
      'E/ReactNativeJS( 4321): probe error\n',
    )
    expect(briefFromIosLog(event('probe fault', 'Fault'))).toBe(
      'E/ReactNativeJS( 4321): probe fault\n',
    )
  })

  it('e2e 변형이 표식을 붙인 경고는 W 다 - 표식이 없으면 os_log 에서 정보와 갈리지 않는다', () => {
    const warning = markedNativeLog('probe warning', NATIVE_WARN_LEVEL)
    expect(briefFromIosLog(event(warning))).toBe(`W/ReactNativeJS( 4321): ${warning}\n`)
    expect(briefFromIosLog(event('probe warning'))).toBe('I/ReactNativeJS( 4321): probe warning\n')
  })

  it('여러 인자의 console 호출(첫 인자가 작은따옴표로 감싸인 표식)도 W 다', () => {
    expect(briefFromIosLog(event("'[e2e-warn]', 'probe', 3"))).toBe(
      "W/ReactNativeJS( 4321): '[e2e-warn]', 'probe', 3\n",
    )
  })

  it('Debug 는 D 다', () => {
    expect(briefFromIosLog(event('probe debug', 'Debug'))).toBe(
      'D/ReactNativeJS( 4321): probe debug\n',
    )
  })

  it('줄바꿈이 든 메시지는 줄마다 머리를 붙인다', () => {
    expect(briefFromIosLog(event('첫 줄\n둘째 줄', 'Error'))).toBe(
      'E/ReactNativeJS( 4321): 첫 줄\nE/ReactNativeJS( 4321): 둘째 줄\n',
    )
  })

  it('앱의 JS 줄이 아니면 버린다 - 네이티브 범주·다른 서브시스템·JSON 이 아닌 안내', () => {
    const other = JSON.stringify({
      subsystem: 'com.apple.UIKit',
      category: 'javascript',
      messageType: 'Error',
      processID: 1,
      eventMessage: 'x',
    })
    const input = [
      'Filtering the log data using "subsystem == \\"com.facebook.react.log\\""',
      event('native only', 'Error', 'native'),
      other,
      'not json {',
      '',
    ].join('\n')
    expect(briefFromIosLog(input)).toBe('')
  })

  it('CRLF 로 끝나는 줄도 읽는다', () => {
    expect(briefFromIosLog(`${RUNNING}\r\n`)).toBe(
      'I/ReactNativeJS( 4321): Running "main" with {"rootTag":1}\n',
    )
  })
})

/** Git Bash 는 역슬래시 경로를 이스케이프로 먹어 치운다. */
function toPosix(path: string): string {
  return path.split('\\').join('/')
}

describe('옮긴 줄에 가드를 건다 - 두 플랫폼이 같은 가드를 쓴다', () => {
  const bash = resolveBash()
  const script = toPosix(resolve('test/e2e/guard-log.sh'))
  const fixtures = mkdtempSync(join(tmpdir(), 'e2e-ios-log-'))
  let written = 0

  afterAll(() => {
    rmSync(fixtures, { recursive: true, force: true })
  })

  function guard(lines: readonly string[], ...allowed: string[]): number | null {
    written += 1
    const file = join(fixtures, `device-${written}.log`)
    writeFileSync(file, briefFromIosLog(lines.join('\n')), 'utf8')
    return spawnSync(bash, [script, toPosix(file), ...allowed], {
      encoding: 'utf8',
      timeout: BASH_TIMEOUT_MS,
    }).status
  }

  it('앱의 줄과 선언한 HTTP 실패만 있으면 통과다', () => {
    const conflict = event(
      httpFailureLine('POST', '/api/v1/auth/register', 409, [{ code: 'EMAIL_ALREADY_REGISTERED' }]),
    )
    expect(guard([RUNNING, conflict], '409')).toBe(0)
  })

  it('표식이 붙은 경고가 있으면 실패다', () => {
    expect(guard([RUNNING, event(markedNativeLog('probe warning', NATIVE_WARN_LEVEL))])).toBe(1)
  })

  it('JS 오류가 있으면 실패다', () => {
    expect(guard([RUNNING, event('probe error', 'Error')])).toBe(1)
  })

  it('앱의 줄이 하나도 없으면 실패다 - 로그를 받지 못한 것이다', () => {
    expect(guard([event('native only', 'Info', 'native')])).toBe(1)
  })
})
