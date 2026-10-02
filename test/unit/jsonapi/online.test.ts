import { describe, expect, it } from 'vitest'

import { isOnline } from '@/lib/jsonapi/online'

describe('isOnline - NetInfo 의 연결 상태 → Query 의 온라인 여부(스펙 8.5)', () => {
  it('연결돼 있으면 온라인이다', () => {
    expect(isOnline(true)).toBe(true)
  })

  it('끊겼다고 확실히 말할 때만 오프라인이다', () => {
    expect(isOnline(false)).toBe(false)
  })

  it('아직 모르면(null) 온라인으로 본다 - 끊김 → 연결을 지어내 켜지자마자 다시 부르지 않는다', () => {
    expect(isOnline(null)).toBe(true)
  })
})
