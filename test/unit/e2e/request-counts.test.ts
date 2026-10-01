import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import {
  checkRequestCounts,
  FLOW_CHECKS,
  ownRequests,
  parseRequests,
} from '@/test/e2e/request-counts'

/**
 * 하네스가 플로마다 단언하는 앱의 요청 수(test/e2e/request-counts.ts)를 잰다 - D4 실측 W2–W4 가 손으로 센 것이다. 줄은
 * 게이트의 api.log 와 같은 모양(compose 의 머리 + uvicorn 의 접근 줄)으로 만든다. 끝의 절은 하네스가 그것을 가드 뒤에
 * 부르는지 소스에서 본다.
 */

/** compose 로그의 uvicorn 접근 줄 하나. */
function line(method: string, target: string, status = 200): string {
  return `api-fastapi-1  | INFO:     172.23.0.1:51038 - "${method} ${target} HTTP/1.1" ${status} OK`
}

const REGISTER = line('POST', '/api/v1/auth/register', 201)
const LOGIN = line('POST', '/api/v1/auth/login')
const REFRESH = line('POST', '/api/v1/auth/refresh')
const HEALTH = 'api-fastapi-1  | INFO:     127.0.0.1:34864 - "GET /health/ready HTTP/1.1" 200 OK'

/** 목록 GET - 제목 필터(인코딩한 채)에 그 실행의 접두사가 든다. */
function list(prefix: string): string {
  return line(
    'GET',
    `/api/v1/examples?filter%5Btitle%5D%5Bcontains%5D=${prefix}&page%5Bsize%5D=20&include=category%2Ctags`,
  )
}

const DETAIL = line('GET', '/api/v1/examples/41?include=category%2Ctags')

function log(...lines: string[]): string {
  return `${lines.join('\n')}\n`
}

describe('parseRequests·ownRequests', () => {
  it('uvicorn 의 접근 줄에서 메서드·경로·상태를 읽고 다른 줄은 버린다', () => {
    const requests = parseRequests(
      log('api-fastapi-1  | INFO:     Application startup complete.', REGISTER, HEALTH, ''),
    )
    expect(requests).toEqual([
      { method: 'POST', target: '/api/v1/auth/register', status: 201 },
      { method: 'GET', target: '/health/ready', status: 200 },
    ])
  })

  it('첫 가입부터 자른다 - 앞 플로의 끝 줄(5초 창)은 세지 않는다', () => {
    const own = ownRequests(parseRequests(log(list('d4-previous'), REGISTER, list('d4-own'))))
    expect(own?.map((request) => request.target)).toEqual([
      '/api/v1/auth/register',
      '/api/v1/examples?filter%5Btitle%5D%5Bcontains%5D=d4-own&page%5Bsize%5D=20&include=category%2Ctags',
    ])
  })

  it('가입이 없으면 null 이다 - 앞 플로의 줄과 가를 수 없다', () => {
    expect(ownRequests(parseRequests(log(list('d4-previous'), LOGIN)))).toBeNull()
  })
})

describe('checkRequestCounts - 플로마다의 수(D4 실측 W2–W4)', () => {
  const create = (...writes: string[]) =>
    log(list('d4-previous'), REGISTER, list('d4-own'), LOGIN, ...writes, HEALTH)

  it('examples-create - 회전 1·POST 1·로그인 1 은 지난다', () => {
    const result = checkRequestCounts(
      'examples-create',
      create(REFRESH, line('POST', '/api/v1/examples', 201)),
      'fastapi',
    )
    expect(result).toEqual({ checked: true, summary: '회전 1·POST 1·로그인 1', failures: [] })
  })

  it('examples-create - 두 번 누른 로그인 제출이 요청 둘이면 실패한다(W4)', () => {
    const result = checkRequestCounts(
      'examples-create',
      create(LOGIN, REFRESH, line('POST', '/api/v1/examples', 201)),
      'fastapi',
    )
    expect(result.failures).toEqual([expect.stringContaining('로그인 2')])
  })

  it('examples-create - 쓰기 앞의 회전이 없으면 실패한다(W2)', () => {
    const result = checkRequestCounts(
      'examples-create',
      create(line('POST', '/api/v1/examples', 201)),
      'fastapi',
    )
    expect(result.failures).toEqual([expect.stringContaining('회전 0·POST 1')])
  })

  const edit = (refreshes: number, patches: number) =>
    log(
      REGISTER,
      LOGIN,
      line('POST', '/api/v1/examples', 201),
      ...Array.from({ length: refreshes }, () => REFRESH),
      ...Array.from({ length: patches }, () => line('PATCH', '/api/v1/examples/41')),
    )

  it('examples-edit - 회전 = PATCH 는 지난다(스크립트의 POST 는 세지 않는다)', () => {
    expect(checkRequestCounts('examples-edit', edit(4, 4), 'fastapi')).toEqual({
      checked: true,
      summary: '회전 4·PATCH 4',
      failures: [],
    })
  })

  it('examples-edit - 회전이 PATCH 보다 적으면 실패한다', () => {
    expect(checkRequestCounts('examples-edit', edit(3, 4), 'fastapi').failures).toEqual([
      expect.stringContaining('회전 3·PATCH 4'),
    ])
  })

  it('examples-edit - PATCH 가 없으면 실패한다 - 0 = 0 으로 헛돌지 않는다', () => {
    expect(checkRequestCounts('examples-edit', edit(0, 0), 'fastapi').failures).toHaveLength(1)
  })

  const scroll = (afterDetail: number) =>
    log(
      REGISTER,
      list('probe-d3-abc'),
      list('probe-d3-abc'),
      DETAIL,
      ...Array.from({ length: afterDetail }, () => list('probe-d3-abc')),
    )

  it('examples-scroll-refresh - 상세 뒤 목록 GET 둘은 지난다', () => {
    expect(checkRequestCounts('examples-scroll-refresh', scroll(2), 'fastapi')).toEqual({
      checked: true,
      summary: '상세 뒤 목록 GET 2',
      failures: [],
    })
  })

  it('examples-scroll-refresh - 돌아온 목록이 다시 읽지 않으면(0) 실패한다', () => {
    expect(checkRequestCounts('examples-scroll-refresh', scroll(0), 'fastapi').failures).toEqual([
      expect.stringContaining('상세 뒤 목록 GET 0'),
    ])
  })

  it('examples-delete - 이 플로의 목록 GET 둘은 지난다 - 가입 앞의 목록 GET 은 세지 않는다', () => {
    const result = checkRequestCounts(
      'examples-delete',
      log(list('d4-previous'), REGISTER, list('d4-own'), list('d4-own')),
      'fastapi',
    )
    expect(result).toEqual({ checked: true, summary: '목록 GET 2', failures: [] })
  })

  it('examples-delete - 쌓인 목록이 다시 부르면(3) 실패한다', () => {
    const result = checkRequestCounts(
      'examples-delete',
      log(REGISTER, list('d4-own'), list('d4-own'), list('d4-own')),
      'fastapi',
    )
    expect(result.failures).toEqual([expect.stringContaining('목록 GET 3')])
  })

  it('가입 줄이 없으면 규칙이 있는 플로는 실패한다 - 로그를 모으지 못했다', () => {
    const result = checkRequestCounts('examples-create', '', 'fastapi')
    expect(result.checked).toBe(true)
    expect(result.failures).toEqual([expect.stringContaining('가입')])
  })

  it.each(['nestjs', 'rails'])(
    '%s 의 접근 로그는 세지 않는다 - uvicorn 의 줄만 센다',
    (backend) => {
      expect(checkRequestCounts('examples-create', '', backend)).toMatchObject({
        checked: false,
        failures: [],
      })
    },
  )

  it('규칙이 없는 플로는 세지 않는다', () => {
    expect(checkRequestCounts('examples-browse', '', 'fastapi')).toMatchObject({
      checked: false,
      failures: [],
    })
  })

  it('규칙을 단 플로가 실제로 있다 - 이름이 바뀌면 규칙이 조용히 놀지 않게', () => {
    for (const flow of Object.keys(FLOW_CHECKS)) {
      expect(existsSync(resolve('test/e2e/flows', `${flow}.yaml`)), flow).toBe(true)
    }
  })
})

describe('node 로 돌린다(하네스가 부르는 모양)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'request-counts-'))
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  function run(flow: string, content: string) {
    const file = join(dir, `${flow}.log`)
    writeFileSync(file, content)
    return spawnSync(
      process.execPath,
      [
        '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
        resolve('test/e2e/request-counts.ts'),
        flow,
        file,
        'fastapi',
      ],
      { encoding: 'utf8', timeout: 30_000 },
    )
  }

  it('맞으면 exit 0 과 요약 한 줄, 어긋나면 exit 1 과 까닭', () => {
    const ok = run('examples-delete', log(REGISTER, list('d4-own'), list('d4-own')))
    expect(ok.status, ok.stderr).toBe(0)
    expect(ok.stdout).toBe('요청 수: examples-delete - 목록 GET 2\n')
    const bad = run('examples-delete', log(REGISTER, list('d4-own')))
    expect(bad.status).toBe(1)
    expect(bad.stderr).toContain('목록 GET 1')
  })
})

/** 요청 수를 단언하는 하네스 - 가드 뒤에, 그 플로의 api.log 로 부른다. */
const HARNESSES = ['test/e2e/run-android.sh'] as const

describe('하네스 배선', () => {
  it.each(HARNESSES)('%s 는 가드 뒤에 플로마다 요청 수를 단언한다', (script) => {
    const source = readFileSync(resolve(script), 'utf8')
    const guard = source.indexOf('test/e2e/guard-log.sh "$out/')
    const counts = source.indexOf(
      'test/e2e/request-counts.ts "$name" "$out/api.log" "$BACKEND_KIND"',
    )
    expect(guard, '가드 호출이 없다').toBeGreaterThan(-1)
    expect(counts, '요청 수 호출이 없다').toBeGreaterThan(guard)
  })
})
