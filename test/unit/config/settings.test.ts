import { afterEach, describe, expect, it } from 'vitest'
import { getSettings, loadSettings, setSettingsSource } from '@/lib/config/settings'

// 실전 예시 값(`http://api:4000` · `http://localhost:4000`, .env.example)을
// 쓰지 않는다 - 이 파일은 env 객체를 직접 넘기지만 규칙은 그대로 적용된다:
// requireAbsoluteUrl 이 인자를 무시하고 실전 기본값을 돌려주는 뮤턴트를
// 픽스처가 실전값과 같으면 구별하지 못한다(rotation.test.ts 의 관례).

describe('loadSettings', () => {
  it('BACKEND_URL이 없으면 변수 이름이 담긴 오류로 실패한다', () => {
    expect(() => loadSettings({})).toThrowError(/BACKEND_URL is required/)
  })

  it('BACKEND_URL이 빈 문자열이어도 누락으로 본다', () => {
    expect(() => loadSettings({ BACKEND_URL: '   ' })).toThrowError(/BACKEND_URL is required/)
  })

  it('BACKEND_URL의 끝 슬래시를 제거한다', () => {
    expect(loadSettings({ BACKEND_URL: 'http://probe-backend:4321/' }).backendUrl).toBe(
      'http://probe-backend:4321',
    )
    expect(loadSettings({ BACKEND_URL: 'http://probe-backend:4321' }).backendUrl).toBe(
      'http://probe-backend:4321',
    )
  })

  it('BACKEND_URL이 절대 URL이 아니면 거절한다', () => {
    expect(() => loadSettings({ BACKEND_URL: '/api' })).toThrowError(
      /BACKEND_URL must be an absolute URL/,
    )
  })

  it('http/https 가 아닌 절대 URL 을 거절한다', () => {
    expect(() => loadSettings({ BACKEND_URL: 'file:///tmp/api' })).toThrowError(
      /BACKEND_URL must be an absolute URL/,
    )
  })
})

describe('setSettingsSource', () => {
  afterEach(() => {
    setSettingsSource(() => process.env)
  })

  it('지정한 자리에서 읽는다', () => {
    setSettingsSource(() => ({ BACKEND_URL: 'http://probe-source:9876/' }))
    expect(getSettings().backendUrl).toBe('http://probe-source:9876')
  })

  it('자리를 바꾸면 이전 값을 버린다', () => {
    setSettingsSource(() => ({ BACKEND_URL: 'http://probe-first:1111' }))
    expect(getSettings().backendUrl).toBe('http://probe-first:1111')
    setSettingsSource(() => ({ BACKEND_URL: 'http://probe-second:2222' }))
    expect(getSettings().backendUrl).toBe('http://probe-second:2222')
  })

  it('같은 자리에서는 한 번만 읽는다', () => {
    let reads = 0
    setSettingsSource(() => {
      reads += 1
      return { BACKEND_URL: 'http://probe-memo:3333' }
    })
    getSettings()
    getSettings()
    expect(reads).toBe(1)
  })

  it('자리가 값을 주지 않으면 변수 이름으로 실패한다', () => {
    setSettingsSource(() => ({}))
    expect(() => getSettings()).toThrowError(/BACKEND_URL is required/)
  })
})
