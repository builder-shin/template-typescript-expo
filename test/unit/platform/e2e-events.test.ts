import { afterEach, describe, expect, it, vi } from 'vitest'
import { observeE2eCredentials, startE2eRequest } from '@/platform/e2e-events'

const mocks = vi.hoisted(() => ({ startupVariant: vi.fn(() => 'e2e') }))
vi.mock('@/platform/config', () => ({ startupVariant: mocks.startupVariant }))
afterEach(() => vi.restoreAllMocks())

describe('R33 값 없는 입력·HTTP 시각 관측', () => {
  it.each(['development', 'preview', 'production'])(
    '%s는 시각·길이도 기록하지 않는다',
    (variant) => {
      mocks.startupVariant.mockReturnValue(variant)
      const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
      observeE2eCredentials('password', 'new-password', 2, 71, 20)
      startE2eRequest('/api/v1/auth/login', 'POST')(200)
      expect(info).not.toHaveBeenCalled()
    },
  )
  it('입력·제출은 값 대신 길이·순번·시각만 남기고 HTTP 쿼리는 버린다', () => {
    mocks.startupVariant.mockReturnValue('e2e')
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    vi.spyOn(Date, 'now')
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(110)
      .mockReturnValueOnce(120)
      .mockReturnValueOnce(135)
    observeE2eCredentials('password', 'new-password', 2, 71, 20)
    observeE2eCredentials('submit', 'new-password', 3, 71, 4)
    startE2eRequest('/api/v1/auth/register?probe=secret', 'POST')(422)
    expect(info.mock.calls).toEqual([
      [
        '[e2e-state] credentials=password mode=new-password seq=2 time=100 emailLength=71 passwordLength=20',
      ],
      [
        '[e2e-state] credentials=submit mode=new-password seq=3 time=110 emailLength=71 passwordLength=4',
      ],
      ['[e2e-state] http=start id=1 time=120 method=POST path=/api/v1/auth/register'],
      ['[e2e-state] http=finish id=1 time=135 elapsed=15 status=422'],
    ])
    expect(JSON.stringify(info.mock.calls)).not.toContain('secret')
  })
})
