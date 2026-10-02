import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { startStallServer, stallMode, type StallServer } from '@/test/e2e/stall-server'

/**
 * 멈춘 서버(test/e2e/stall-server.ts)를 잰다 - 하네스가 E2E_CHECKS=1 일 때 백엔드 자리에 띄운다. 서버가 한 번도
 * 멈추지 않으면 기기의 타임아웃 확인은 연결 거절(NETWORK_ERROR)을 재고도 통과할 수 있다 - 그래서 방식마다 실제로
 * 멈추는지(정해 둔 시간 안에 응답·본문이 끝나지 않는지) 본다.
 */

describe('stallMode', () => {
  it.each([
    ['/api/v1/examples?filter%5Btitle%5D%5Bcontains%5D=probe-stall-headers', 'headers'],
    ['/api/v1/examples?filter%5Btitle%5D%5Bcontains%5D=probe-stall-body&page%5Bsize%5D=20', 'body'],
    ['/api/v1/examples?filter%5Btitle%5D%5Bcontains%5D=probe-seed', null],
    ['/health/ready', null],
  ] as const)('%s → %s', (url, mode) => {
    expect(stallMode(url)).toBe(mode)
  })
})

/** 정해 둔 시간 안에 끝나지 않으면 'timeout' 이다. */
function within<T>(promise: Promise<T>, ms: number): Promise<T | 'timeout'> {
  return Promise.race([
    promise,
    new Promise<'timeout'>((resolve) => {
      setTimeout(() => {
        resolve('timeout')
      }, ms)
    }),
  ])
}

describe('startStallServer', () => {
  let server: StallServer

  beforeAll(async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    server = await startStallServer(0)
  })

  afterAll(async () => {
    await server.close()
    vi.restoreAllMocks()
  })

  function url(path: string): string {
    return `http://127.0.0.1:${server.port}${path}`
  }

  it('headers: 응답(헤더)이 오지 않는다', async () => {
    const controller = new AbortController()
    const response = fetch(url('/x?probe-stall-headers'), { signal: controller.signal })
    expect(await within(response, 500)).toBe('timeout')
    controller.abort()
    await expect(response).rejects.toThrow()
  })

  it('body: 200 과 헤더는 오고 본문이 끝나지 않는다', async () => {
    const controller = new AbortController()
    const response = await fetch(url('/x?probe-stall-body'), { signal: controller.signal })
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/vnd.api+json')
    const body = response.text()
    expect(await within(body, 500)).toBe('timeout')
    controller.abort()
    await expect(body).rejects.toThrow()
  })

  it('그 밖의 요청에는 곧바로 404 오류 문서다 - 기기 로그의 가드가 선언하지 않은 404 로 잡는다', async () => {
    const response = await fetch(url('/health/ready'))
    expect(response.status).toBe(404)
    expect(await response.json()).toMatchObject({ errors: [{ code: 'RESOURCE_NOT_FOUND' }] })
  })
})
