import { describe, expect, it } from 'vitest'
import {
  simulatorServices,
  verifyDisabledServices,
  simulatorMetrics,
} from '../../e2e/ios-simulator'

describe('E2E 전용 simulator의 서비스 경계', () => {
  const services =
    'PID\tStatus\tLabel\n12\t0\tcom.apple.apsd\n13\t0\tcom.apple.chronod\n14\t0\tcom.apple.securityd\n15\t0\tcom.apple.SpringBoard\n16\t0\tcom.apple.cfprefsd.xpc.daemon\n17\t0\tcom.apple.storekitd\n'
  it('실제 등록된 허용 서비스만 고르고 Keychain·UI·설정은 보존한다', () => {
    expect(simulatorServices(services)).toEqual([
      'com.apple.apsd',
      'com.apple.chronod',
      'com.apple.storekitd',
    ])
  })
  it('목록 오류나 핵심 대상 누락을 빈 성공으로 세지 않는다', () => {
    expect(() => simulatorServices('transport error')).toThrow()
    expect(() => simulatorServices('PID Status Label\n1 0 com.apple.chronod')).toThrow()
  })
  it('모든 지정 값이 disabled=true여야 하며 값 누락·false를 실패시킨다', () => {
    const expected = ['com.apple.apsd', 'com.apple.chronod']
    expect(() =>
      verifyDisabledServices(
        'disabled services = {\n "com.apple.apsd" => true\n "com.apple.chronod" => disabled\n}',
        expected,
      ),
    ).not.toThrow()
    expect(() => verifyDisabledServices('"com.apple.apsd" => false', expected)).toThrow()
    expect(() => verifyDisabledServices('"com.apple.apsd" => true', expected)).toThrow()
  })
  it('메모리는 선택한 launchd_sim 자손의 RSS만 합한다', () => {
    const ps =
      '10 1 100 0.1 launchd_sim probe-udid/data/var/run/launchd_bootstrap.plist\n11 10 200 2.0 SpringBoard\n12 11 300 1.0 child\n20 1 9000 90.0 user-work\n'
    expect(simulatorMetrics(ps, 'probe-udid')).toEqual({
      processes: 3,
      rssKiB: 600,
      cpuPercent: 3.1,
    })
    expect(() => simulatorMetrics(ps, 'another-udid')).toThrow()
  })
})
