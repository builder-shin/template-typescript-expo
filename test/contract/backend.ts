import {
  LOGIN_ENDPOINT,
  REGISTER_ENDPOINT,
  loginDocument,
  registerDocument,
  type Credentials,
} from '@/lib/auth/credentials'
import { JSONAPI_MEDIA_TYPE } from '@/lib/jsonapi/client'

/**
 * 계약 거울이 백엔드에 닿는 자리 - 앱의 API 클라이언트(`request()`)를 지나지 않고 `fetch` 로 원본 응답(상태와
 * 파싱한 본문)을 받는다. 거울이 재는 것은 선언과 백엔드의 관계이지 앱의 클라이언트가 아니다.
 *
 * 주소는 `CONTRACT_API_URL` 이다 - `test/contract/run.sh` 가 스택을 띄우고 호스트에서 API 에 닿는 주소를 준다.
 * 기본값을 두지 않는다: 값이 없으면 스택 없이 돌린 것이라, 요청을 보내는 시험마다 그 사실을 알리며 실패한다(한 번
 * 멈추는 것이 아니다 - 요청마다 이 함수가 던진다. ③ 은 준비 단계의 가입이 실패해 건너뛴다).
 */
function baseUrl(): string {
  const url = process.env.CONTRACT_API_URL
  if (url === undefined || url === '') {
    throw new Error(
      'CONTRACT_API_URL 이 없다 - 계약 거울은 test/contract/run.sh 로 돈다(스택을 띄우고 이 주소를 준다)',
    )
  }
  return url.replace(/\/+$/, '')
}

/** 백엔드가 준 것 그대로 - 상태와, JSON 이면 파싱한 본문(아니면 글자 그대로, 비었으면 null). */
export interface BackendResponse {
  readonly status: number
  readonly body: unknown
}

export function isSuccess(status: number): boolean {
  return status >= 200 && status < 300
}

async function exchange(
  method: string,
  path: string,
  query: URLSearchParams | null,
  body: unknown,
  accessToken: string | null,
): Promise<BackendResponse> {
  const qs = query?.toString() ?? ''
  const headers: Record<string, string> = { accept: JSONAPI_MEDIA_TYPE }
  if (body !== undefined) headers['content-type'] = JSONAPI_MEDIA_TYPE
  if (accessToken !== null) headers.authorization = `Bearer ${accessToken}`
  const response = await fetch(`${baseUrl()}${path}${qs === '' ? '' : `?${qs}`}`, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const text = await response.text()
  let parsed: unknown = null
  if (text !== '') {
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = text
    }
  }
  return { status: response.status, body: parsed }
}

/** 공개 읽기 - 토큰을 싣지 않는다(스펙 7.2). */
export function getFrom(path: string, query: URLSearchParams): Promise<BackendResponse> {
  return exchange('GET', path, query, undefined, null)
}

/** 쓰기 - 토큰은 있으면 싣는다. */
export function postTo(
  path: string,
  body: unknown,
  accessToken: string | null,
): Promise<BackendResponse> {
  return exchange('POST', path, null, body, accessToken)
}

/** 부분 수정 - 앱의 화이트리스트·중복 제거를 거치지 않은 문서도 그대로 보낸다. */
export function patchTo(
  path: string,
  body: unknown,
  accessToken: string,
): Promise<BackendResponse> {
  return exchange('PATCH', path, null, body, accessToken)
}

/** 프로브가 만든 행을 지운다. */
export function deleteFrom(path: string, accessToken: string): Promise<BackendResponse> {
  return exchange('DELETE', path, null, undefined, accessToken)
}

function accessTokenOf(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null) return undefined
  const data = (body as { data?: { attributes?: { accessToken?: unknown } } }).data
  const token = data?.attributes?.accessToken
  return typeof token === 'string' ? token : undefined
}

/** 가입하고 로그인해 access token 을 받는다 - 문서 모양은 앱의 것(`lib/auth/credentials.ts`)을 쓴다. */
export async function registerAndLogin(credentials: Credentials): Promise<string> {
  const registered = await postTo(REGISTER_ENDPOINT, registerDocument(credentials), null)
  if (!isSuccess(registered.status)) {
    throw new Error(
      `계약 거울의 가입이 실패했다 - ${registered.status} ${JSON.stringify(registered.body)}`,
    )
  }
  const loggedIn = await postTo(LOGIN_ENDPOINT, loginDocument(credentials), null)
  const token = accessTokenOf(loggedIn.body)
  if (!isSuccess(loggedIn.status) || token === undefined) {
    throw new Error(
      `계약 거울의 로그인이 실패했다 - ${loggedIn.status} ${JSON.stringify(loggedIn.body)}`,
    )
  }
  return token
}
