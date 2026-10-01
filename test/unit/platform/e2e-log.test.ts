import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AppVariant } from '@/lib/config/app-variant'
import { NATIVE_WARN_LEVEL, WARNING_MARKER } from '@/lib/jsonapi/failure-log'
import { markNativeWarningsForE2e } from '@/platform/e2e-log'

/**
 * platform/e2e-log.ts 의 배선(스펙 11.3). 표식을 붙이는 판단(markedNativeLog)과 변형 표는 lib 의 시험이 재고,
 * 여기서는 e2e 변형에서만 네이티브 로그 함수를 감싸는지, 감싼 뒤에도 원래 함수가 모든 줄을 받는지 잰다. 설정
 * 자리(platform/config.ts)는 가짜로 바꾼다.
 */
const mocks = vi.hoisted(() => ({
  startupVariant: vi.fn<() => AppVariant>(),
}))

vi.mock('@/platform/config', () => ({ startupVariant: mocks.startupVariant }))

type Hook = (message: string, level: number) => void
const scope = globalThis as { nativeLoggingHook?: Hook }

let original: ReturnType<typeof vi.fn<Hook>>

beforeEach(() => {
  original = vi.fn<Hook>()
  scope.nativeLoggingHook = original
})

afterEach(() => {
  delete scope.nativeLoggingHook
})

describe('markNativeWarningsForE2e', () => {
  it('e2e 변형은 경고 수준의 줄에 표식을 붙여 원래 함수로 넘긴다', () => {
    mocks.startupVariant.mockReturnValue('e2e')
    markNativeWarningsForE2e()
    scope.nativeLoggingHook?.('probe warning', NATIVE_WARN_LEVEL)
    scope.nativeLoggingHook?.('probe info', 1)
    expect(original.mock.calls).toEqual([
      [`${WARNING_MARKER} probe warning`, NATIVE_WARN_LEVEL],
      ['probe info', 1],
    ])
  })

  it.each(['development', 'preview', 'production'] as const)(
    '%s 변형은 네이티브 로그 함수를 건드리지 않는다',
    (variant) => {
      mocks.startupVariant.mockReturnValue(variant)
      markNativeWarningsForE2e()
      expect(scope.nativeLoggingHook).toBe(original)
    },
  )

  it('네이티브 로그 함수가 없으면(React Native 밖) 아무것도 하지 않는다', () => {
    delete scope.nativeLoggingHook
    mocks.startupVariant.mockReturnValue('e2e')
    markNativeWarningsForE2e()
    expect(scope.nativeLoggingHook).toBeUndefined()
  })
})
