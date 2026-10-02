import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'

import type { AppVariant } from '@/lib/config/app-variant'
import { observeE2eRuntime } from '@/platform/e2e-diagnostics'
import { queryClient } from '@/platform/query-client'
import { briefFromIosLog } from '../../e2e/ios-log'

/** 기기 모듈만 가짜다. 실제 QueryCache 알림을 관측하고 정보 줄이 iOS artifact 변환에도 남는지 잰다. */
const mocks = vi.hoisted(() => ({
  startupVariant: vi.fn<() => AppVariant>(),
  remove: vi.fn(),
  addEventListener:
    vi.fn<(event: string, listener: (state: string) => void) => { remove: () => void }>(),
}))
vi.mock('@/platform/config', () => ({ startupVariant: mocks.startupVariant }))
vi.mock('react-native', () => ({
  AppState: { currentState: 'active', addEventListener: mocks.addEventListener },
}))
vi.mock('expo-router', () => ({ usePathname: () => '/probe' }))
vi.mock('@/platform/query-client', async () => {
  const { QueryClient } = await import('@tanstack/react-query')
  return { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }
})

let info: MockInstance<typeof console.info>
beforeEach(() => {
  vi.clearAllMocks()
  mocks.startupVariant.mockReturnValue('e2e')
  mocks.addEventListener.mockReturnValue({ remove: mocks.remove })
  info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
})
afterEach(() => {
  queryClient.clear()
  vi.restoreAllMocks()
})

describe('e2e 경계 상태 관측', () => {
  it.each(['development', 'preview', 'production'] as const)(
    '%s에서는 로그·AppState·캐시 구독을 만들지 않는다',
    (variant) => {
      mocks.startupVariant.mockReturnValue(variant)
      const subscribe = vi.spyOn(queryClient.getQueryCache(), 'subscribe')
      observeE2eRuntime('/probe')()
      expect(info).not.toHaveBeenCalled()
      expect(mocks.addEventListener).not.toHaveBeenCalled()
      expect(subscribe).not.toHaveBeenCalled()
    },
  )

  it('라우트·AppState·실제 상세 조회 상태를 정보로만 남기고 cleanup 뒤 구독을 거둔다', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const cleanup = observeE2eRuntime('/examples/probe-id')
    mocks.addEventListener.mock.calls[0]?.[1]('background')
    await queryClient.fetchQuery({
      queryKey: ['resources', 'examples', 'detail', 'probe-id'],
      queryFn: () => Promise.resolve({ sensitive: 'PROBE-token-value' }),
    })
    const lines = info.mock.calls.map(([line]) => String(line))
    expect(lines).toContain('[e2e-state] route=/examples/probe-id appState=active')
    expect(lines).toContain('[e2e-state] appState=background')
    expect(
      lines.some((line) =>
        line.includes('query=examples/probe-id status=success fetchStatus=idle observers=0'),
      ),
    ).toBe(true)
    expect(lines.join('\n')).not.toContain('PROBE-token-value')
    expect(warn).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
    // run-ios.sh가 수집하는 같은 subsystem/category와 Info 유형을 ios-log.ts에 넘긴다.
    const ndjson = lines
      .map((eventMessage) =>
        JSON.stringify({
          subsystem: 'com.facebook.react.log',
          category: 'javascript',
          messageType: 'Info',
          processID: 42,
          eventMessage,
        }),
      )
      .join('\n')
    const brief = briefFromIosLog(ndjson)
    expect(brief.split('\n').filter(Boolean)).toEqual(
      lines.map((line) => `I/ReactNativeJS(   42): ${line}`),
    )
    cleanup()
    expect(mocks.remove).toHaveBeenCalledOnce()
    info.mockClear()
    queryClient.setQueryData(['resources', 'examples', 'detail', 'probe-id'], { changed: true })
    expect(info).not.toHaveBeenCalled()
  })

  it('목록과 인증 캐시의 데이터·키는 남기지 않는다', async () => {
    const cleanup = observeE2eRuntime('/')
    info.mockClear()
    await queryClient.fetchQuery({
      queryKey: ['resources', 'examples', 'list', 'PROBE-private-filter'],
      queryFn: () => Promise.resolve('PROBE-value'),
    })
    await queryClient.fetchQuery({
      queryKey: ['auth', 'PROBE-private-key'],
      queryFn: () => Promise.resolve('PROBE-value'),
    })
    expect(info).not.toHaveBeenCalled()
    cleanup()
  })
})
