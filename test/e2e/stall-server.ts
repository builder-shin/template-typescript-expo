import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { pathToFileURL } from 'node:url'

/**
 * 응답하지 않는 백엔드 - E2E 하네스가 `E2E_CHECKS=1` 일 때 백엔드를 내리고 같은 포트에 띄운다
 * (`test/e2e/checks/`). 요청 하나가 15초 타임아웃(`lib/jsonapi/client.ts` 의 `REQUEST_TIMEOUT_MS`)에 끊겨 앱이 앱
 * 문구와 "다시 시도" 를 그리는지 기기에서 잰다(스펙 8.5·9.3).
 *
 * 멈추는 방식은 요청 주소가 고른다 - 플로가 목록의 제목 필터 값으로 정한다.
 *
 *   probe-stall-headers  연결은 받고 아무것도 보내지 않는다 - 헤더를 기다리는 단계의 타임아웃
 *   probe-stall-body     200 과 헤더, 본문의 앞 조각만 보내고 끝내지 않는다 - 본문을 읽는 단계의 타임아웃.
 *                        `request()` 는 `json()` 을 요청 signal 과 경주시켜 끝낸다 - iOS 의 expo/fetch 는 취소 뒤에
 *                        `json()` 이 끝나지 않을 수 있다(docs/superpowers/notes/2026-09-30-d1-measurements.md 의 M6)
 *
 * 그 밖의 요청에는 곧바로 404 오류 문서를 준다 - 기기 로그에 선언하지 않은 404 가 남아 가드가 잡는다.
 * 요청마다 한 줄을 표준 출력에 남긴다(`… mode=<방식>`) - 하네스가 그 줄로 두 방식이 모두 불렸는지 확인한다.
 */

export type StallMode = 'headers' | 'body'

/** 요청 주소에서 멈추는 방식을 고른다. 고를 것이 없으면 null. */
export function stallMode(url: string): StallMode | null {
  if (url.includes('probe-stall-headers')) return 'headers'
  if (url.includes('probe-stall-body')) return 'body'
  return null
}

/** 띄운 서버 - 붙잡은 연결까지 끊고 닫는다. */
export interface StallServer {
  readonly port: number
  readonly close: () => Promise<void>
}

const NOT_FOUND_DOCUMENT = JSON.stringify({
  jsonapi: { version: '1.1' },
  errors: [{ status: '404', code: 'RESOURCE_NOT_FOUND', title: 'stall-server' }],
})

/** `127.0.0.1:<port>` 에 띄운다. port 0 이면 비어 있는 포트를 받는다(시험). */
export function startStallServer(port: number): Promise<StallServer> {
  const server: Server = createServer((request, response) => {
    const url = request.url ?? ''
    const mode = stallMode(url)
    console.log(
      `${new Date().toISOString()} ${request.method ?? '-'} ${url} mode=${mode ?? 'none'}`,
    )
    if (mode === 'headers') return
    if (mode === 'body') {
      response.writeHead(200, { 'content-type': 'application/vnd.api+json' })
      response.write('{"data":[')
      return
    }
    response.writeHead(404, { 'content-type': 'application/vnd.api+json' })
    response.end(NOT_FOUND_DOCUMENT)
  })
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => {
      const address = server.address() as AddressInfo
      resolve({
        port: address.port,
        close: () =>
          new Promise((done) => {
            server.closeAllConnections()
            server.close(() => {
              done()
            })
          }),
      })
    })
  })
}

// `node test/e2e/stall-server.ts <포트>` 로 부르면 띄운다 - 시험이 import 할 때는 띄우지 않는다.
const entry = process.argv[1]
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  const server = await startStallServer(Number(process.argv[2] ?? '4100'))
  console.log(`stall-server 127.0.0.1:${server.port}`)
}
