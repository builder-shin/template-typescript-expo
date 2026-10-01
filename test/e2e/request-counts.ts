import { existsSync, readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

/**
 * E2E 플로 하나의 백엔드 접근 로그(`.maestro-output/e2e/<플로>/api.log`)에서 앱의 요청 수를 단언한다 - D4 실측 W2–W4 가
 * 게이트 뒤에 손으로 센 것을 하네스(test/e2e/run-android.sh·run-ios.sh)가 플로마다 가드 뒤에 잰다. 쓰기마다 회전 하나
 * (스펙 7.2), 다시 앞에 온 목록의 재조회(스펙 8.5 의 D4 정정), 두 번 누른 제출의 요청 하나가 되돌아가면 그 플로가 실패한다.
 *
 * 그 플로의 첫 가입(`POST /api/v1/auth/register`) 줄부터 센다 - Android 의 api.log 는 플로 시작 5초 앞부터 자른 compose
 * 로그라 앞 플로의 끝 줄이 섞인다(D4 실측 W3 의 "가입 줄부터 세는 까닭"). iOS 는 플로 시작에서 자른 로그지만 같은 규칙을 쓴다.
 *
 * uvicorn(FastAPI)의 접근 로그 줄(`"POST /api/v1/auth/refresh HTTP/1.1" 200 OK`)만 센다. NestJS 는 요청을 로그에 남기지
 * 않고, Rails 는 lograge 의 JSON(쿼리 문자열을 뺀 path)이라 같은 규칙으로 세지 못한다. 단언하는 것은 앱의 동작이라
 * FastAPI 갈래(로컬 게이트, CI 의 Android·iOS fastapi)가 잰다.
 *
 * 플로를 고쳐 수가 달라지면 아래 `FLOW_CHECKS` 를 함께 고치고 D4 실측 기록의 수와 맞댄다.
 *
 *   node test/e2e/request-counts.ts <플로> <api.log> <백엔드>
 */

export interface ApiRequest {
  readonly method: string
  /** 경로와 쿼리 - 로그에 찍힌 그대로(인코딩한 채). */
  readonly target: string
  readonly status: number
}

export interface FlowCount {
  /** 요약 줄에 찍는 수. */
  readonly summary: string
  /** 어긋난 까닭 - 맞으면 비었다. */
  readonly failures: readonly string[]
}

export interface CountResult extends FlowCount {
  /** 셌는가 - 규칙이 없는 플로이거나 FastAPI 가 아니면 거짓이다. */
  readonly checked: boolean
}

const REQUEST_LINE = /"([A-Z]+) (\S+) HTTP\/[\d.]+" (\d{3})/

const REGISTER = '/api/v1/auth/register'
const REFRESH = '/api/v1/auth/refresh'
const LOGIN = '/api/v1/auth/login'
const EXAMPLES = '/api/v1/examples'

/** 접근 로그의 요청 줄 - 다른 줄(서버의 안내, compose 의 머리)은 버린다. */
export function parseRequests(log: string): ApiRequest[] {
  const requests: ApiRequest[] = []
  for (const line of log.split(/\r?\n/)) {
    const match = REQUEST_LINE.exec(line)
    const method = match?.[1]
    const target = match?.[2]
    const status = match?.[3]
    if (method === undefined || target === undefined || status === undefined) continue
    requests.push({ method, target, status: Number(status) })
  }
  return requests
}

function pathOf(target: string): string {
  const index = target.indexOf('?')
  return index === -1 ? target : target.slice(0, index)
}

function is(request: ApiRequest, method: string, path: string): boolean {
  return request.method === method && pathOf(request.target) === path
}

/** 그 플로의 첫 가입부터의 요청 - 가입이 없으면 null 이다(앞 플로의 줄과 가를 수 없다). */
export function ownRequests(requests: readonly ApiRequest[]): ApiRequest[] | null {
  const start = requests.findIndex((request) => is(request, 'POST', REGISTER))
  return start === -1 ? null : requests.slice(start)
}

function count(
  requests: readonly ApiRequest[],
  predicate: (request: ApiRequest) => boolean,
): number {
  return requests.filter(predicate).length
}

/** 조건을 실은 목록 GET - 쿼리에 그 플로의 제목 접두사(인코딩한 채)가 든다. */
function isListGet(request: ApiRequest, marker: string): boolean {
  return (
    request.method === 'GET' &&
    pathOf(request.target) === EXAMPLES &&
    request.target.includes(marker)
  )
}

function isDetailGet(request: ApiRequest): boolean {
  return request.method === 'GET' && pathOf(request.target).startsWith(`${EXAMPLES}/`)
}

/** 플로 하나의 요청을 세는 규칙. */
export type FlowCheck = (requests: readonly ApiRequest[]) => FlowCount

/** 플로마다 세는 것 - 수는 D4 실측 W2–W4(FastAPI 게이트)다. */
export const FLOW_CHECKS: Readonly<Record<string, FlowCheck>> = {
  'examples-create': (requests) => {
    const refresh = count(requests, (request) => is(request, 'POST', REFRESH))
    const post = count(requests, (request) => is(request, 'POST', EXAMPLES))
    const login = count(requests, (request) => is(request, 'POST', LOGIN))
    const failures: string[] = []
    if (refresh !== 1 || post !== 1) {
      failures.push(
        `회전 ${refresh}·POST ${post} - 앱의 쓰기 하나 앞에 회전 하나여야 한다(D4 실측 W2, 스펙 7.2)`,
      )
    }
    if (login !== 1) {
      failures.push(`로그인 ${login} - 두 번 누른 로그인 제출이 요청 하나여야 한다(D4 실측 W4)`)
    }
    return { summary: `회전 ${refresh}·POST ${post}·로그인 ${login}`, failures }
  },
  'examples-edit': (requests) => {
    const refresh = count(requests, (request) => is(request, 'POST', REFRESH))
    const patch = count(
      requests,
      (request) => request.method === 'PATCH' && pathOf(request.target).startsWith(`${EXAMPLES}/`),
    )
    const failures: string[] = []
    if (patch === 0 || refresh !== patch) {
      failures.push(
        `회전 ${refresh}·PATCH ${patch} - 저장마다 회전 하나여야 한다(D4 실측 W2, 스펙 7.2)`,
      )
    }
    return { summary: `회전 ${refresh}·PATCH ${patch}`, failures }
  },
  'examples-scroll-refresh': (requests) => {
    const detail = requests.findIndex(isDetailGet)
    const list =
      detail === -1
        ? 0
        : count(requests.slice(detail), (request) => isListGet(request, 'probe-d3-'))
    const failures: string[] = []
    if (detail === -1) failures.push('상세 GET 이 없다 - 플로가 상세에 들어가지 않았다')
    else if (list !== 2) {
      failures.push(
        `상세 뒤 목록 GET ${list} - 상세에서 돌아온 목록이 읽어 둔 두 쪽을 다시 읽어야 한다(D4 실측 W3, 스펙 8.5 의 D4 정정)`,
      )
    }
    return { summary: `상세 뒤 목록 GET ${list}`, failures }
  },
  'examples-delete': (requests) => {
    const list = count(requests, (request) => isListGet(request, '=d4-'))
    const failures: string[] = []
    if (list !== 2) {
      failures.push(
        `목록 GET ${list} - 처음 열 때와 지우고 돌아왔을 때의 둘이어야 한다(쌓인 목록은 앱 복귀·무효화에 다시 부르지 않는다 - D4 실측 W3)`,
      )
    }
    return { summary: `목록 GET ${list}`, failures }
  },
}

/** 플로 하나의 접근 로그를 센다. */
export function checkRequestCounts(flow: string, log: string, backend: string): CountResult {
  const flowCheck = FLOW_CHECKS[flow]
  if (flowCheck === undefined) return { checked: false, summary: '세는 규칙이 없다', failures: [] }
  if (backend !== 'fastapi') {
    return {
      checked: false,
      summary: `${backend} 의 접근 로그는 세지 않는다(uvicorn 의 줄만 센다)`,
      failures: [],
    }
  }
  const own = ownRequests(parseRequests(log))
  if (own === null) {
    return {
      checked: true,
      summary: '가입 줄 없음',
      failures: [
        `이 플로의 가입(POST ${REGISTER}) 줄이 접근 로그에 없다 - 로그를 모으지 못했거나 플로가 가입하지 않는다`,
      ],
    }
  }
  return { checked: true, ...flowCheck(own) }
}

const entry = process.argv[1]
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  const [flow, file, backend] = process.argv.slice(2)
  if (flow === undefined || file === undefined || backend === undefined) {
    console.error('사용법: node test/e2e/request-counts.ts <플로> <api.log> <백엔드>')
    process.exit(2)
  }
  const log = existsSync(file) ? readFileSync(file, 'utf8') : ''
  const result = checkRequestCounts(flow, log, backend)
  if (FLOW_CHECKS[flow] !== undefined) console.log(`요청 수: ${flow} - ${result.summary}`)
  for (const failure of result.failures) console.error(`요청 수: ${flow} - ${failure}`)
  if (result.failures.length > 0) process.exitCode = 1
}
