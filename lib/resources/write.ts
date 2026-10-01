import { UNUSABLE_RESPONSE_MESSAGE } from '@/lib/auth/form-state'
import type { ErrorObject, SingleDocument } from '@/lib/jsonapi/document'
import type { JsonApiSend } from '@/lib/jsonapi/send'
import { resourcePath, type ResourceDefinition } from './define'
import {
  IDLE_RESOURCE_FORM_STATE,
  createdId,
  decideWriteFailure,
  formStateFromErrors,
  unusableFormState,
  writeDocument,
  type ResourceFormState,
  type ResourceFormValues,
} from './form'

/**
 * 쓰기(생성·수정·삭제) 한 번의 흐름 - 세션 확인 → 요청 → 응답 해석(스펙 7.3·8.4·9.2).
 *
 * 무엇을 보낼지와 응답을 어떻게 읽을지는 `form.ts`(template-typescript-nextjs 에서 복사)가 정하고,
 * 이 파일은 그 판단을 한 번의 쓰기로 잇는다 - 원본에서 Server Action(`app/(app)/examples/actions.ts`)이
 * 하던 배선이다. 이 앱에서 그 자리는 쓰기 훅(`queries/writes.ts`)인데 훅은 React 없이 부를 수 없어서,
 * 흐름의 갈래를 여기 두고 가짜 전송·토큰으로 잰다(`test/unit/resources/write.test.ts`) - 인증 호출
 * (`lib/auth/credentials.ts`)과 같은 모양이다.
 *
 * - 요청은 주입받은 전송(`send`)으로만 보낸다. 앱에서는 `platform/api.ts` 의 `apiRequest` 다 -
 *   Accept-Language 를 싣는 유일한 자리다(스펙 9.4).
 * - access token 은 주입받은 `getAccessToken` 에서 쓰기마다 한 번 받는다. 앱에서는 세션 관리자의
 *   것이고, 회전은 그 안에서만 일어난다(스펙 7.2). 401 에 회전·재시도를 붙이지 않는다.
 * - 쓰기 가드(스펙 7.3 의 두 번째 겹): 토큰이 없으면(세션이 없다) 요청하지 않는다.
 * - 만료 가드(스펙 7.2): 세션 관리자는 회전이 판정을 받지 못하면(5xx·408·429·닿지 못함) 세션을 지우지 않고 지금의
 *   access 를 그대로 돌려준다. access 는 15분이고 쓰기만 그 토큰을 쓰므로, 회전이 필요한 순간에는 이미 만료돼 있는
 *   일이 흔하다 - 그 토큰을 실으면 백엔드가 TOKEN_EXPIRED 를 내고 세션이 지워져 회전의 502 하나가 쓰기 한 번 늦게
 *   로그아웃이 된다. 그래서 받은 토큰의 세션이 이미 만료됐으면 요청하지 않고 앱 문구로 알린다 - 던지지 않으니 세션은
 *   그대로이고, 입력이 그대로 남은 폼의 제출 버튼이 곧 다시 시도다.
 * - 세션이 없거나 백엔드가 세션을 거절하면(인증 오류 코드) `sessionRejected()` 를 던진다. 인증 오류는
 *   쓰기 캐시(`MutationCache`)의 `onError` 한 곳이 받아 세션을 지운다(스펙 9.2, `platform/query-client.ts`) -
 *   쓰기 화면은 보호 경로라 경로 가드가 `next` 를 실어 로그인으로 보낸다.
 * - 그 밖의 실패는 던지지 않고 값이다 - 폼이 그린다. 백엔드가 응답조차 주지 못하면 앱 문구
 *   (`UNUSABLE_RESPONSE_MESSAGE`)이고, 입력이 그대로 남은 폼의 제출 버튼이 곧 다시 시도다(스펙 9.3).
 */

const SESSION_REJECTED = 'SessionRejected'

/**
 * 쓰기가 세션 때문에 멈췄다는 신호. 던지는 쪽은 이 파일, 받는 쪽은 쓰기 캐시(`MutationCache`)의 `onError` 다.
 * 클래스가 아니라 이름으로 표시한다 - 번들러가 `Error` 를 상속한 클래스를 어떻게 바꾸든
 * `isSessionRejected` 의 판정이 흔들리지 않는다.
 */
export function sessionRejected(): Error {
  const error = new Error('세션이 없거나 백엔드가 세션을 거절했다 - 로그인이 필요하다')
  error.name = SESSION_REJECTED
  return error
}

/** `sessionRejected()` 가 만든 오류인가. */
export function isSessionRejected(error: unknown): boolean {
  return error instanceof Error && error.name === SESSION_REJECTED
}

/** 쓰기가 보는 세션의 한 면 - access token 의 만료 시각이다. 세션 관리자의 `StoredSession` 이 그대로 맞는다. */
export interface WriteSession {
  /** epoch ms. 이 시각부터 백엔드가 TOKEN_EXPIRED 를 낸다. */
  readonly accessExpiresAt: number
}

/** 쓰기가 주입받는 것 - 앱에서는 세션 관리자와 API 클라이언트다(`queries/writes.ts`). */
export interface WriteDeps {
  /**
   * 요청에 실을 access token. 세션이 없으면 `null` 이다. 회전한 세션을 저장소에 쓰지 못하면
   * 거절한다 - 새 세션은 메모리에 있으므로 다시 제출하면 새 토큰으로 간다(lib/auth/session-manager.ts).
   */
  readonly getAccessToken: () => Promise<string | null>
  /**
   * 지금의 세션 - 만료 가드가 `getAccessToken` 이 돌려준 토큰의 만료를 본다. 앱에서는 세션 관리자의 `current` 다.
   * 없으면(`null`) 만료를 판정할 수 없으니 `getAccessToken` 이 준 토큰을 믿는다.
   */
  readonly currentSession: () => WriteSession | null
  /** 지금 시각(epoch ms) - 만료 판정의 기준이다. 세션 관리자와 같은 시계다. */
  readonly now: () => number
  readonly send: JsonApiSend
}

/** 생성 한 번의 결과. 세션 거절은 여기 없다 - 던진다. */
export type CreateOutcome =
  | { readonly kind: 'saved'; readonly id: string }
  | { readonly kind: 'failed'; readonly state: ResourceFormState }

/** 수정 한 번의 결과 - 생성에 더해, 고칠 자원이 없다(`RESOURCE_NOT_FOUND`). 화면이 not-found 를 그린다. */
export type UpdateOutcome = CreateOutcome | { readonly kind: 'notFound' }

/** 삭제 한 번의 결과. 세션 거절은 여기 없다 - 던진다. */
export type DeleteOutcome =
  | { readonly kind: 'deleted' }
  /** 배너에 그릴 문구 - 삭제에는 입력이 없어 필드 오류가 없다. */
  | { readonly kind: 'failed'; readonly messages: readonly string[] }

type AccessToken = { readonly ok: true; readonly token: string } | { readonly ok: false }

/**
 * 쓰기 하나가 실을 토큰. 세션이 없으면 던진다(쓰기 가드). 저장소가 실패해 거절되면 `ok: false` 다 -
 * 화면이 앱 문구를 그린다. 거절을 삼키지 않고 기기 로그에 남긴다(lib/auth/AGENTS.md 의 "호출자는
 * 삼키지 말고 알린다") - 오류의 이름과 문구만 적어 토큰이 로그에 실리지 않는다(스펙 7.1).
 *
 * 받은 토큰의 세션이 이미 만료됐어도 `ok: false` 다(만료 가드, 이 파일 머리말) - 요청하지 않는다. 던지지 않고 로그도
 * 남기지 않는다: 오류가 아니라 백엔드가 회전을 판정하지 않는 동안의 정상 경로이고, 세션은 건드리지 않는다. 만료는
 * 세션 관리자와 같은 시계로 잰다 - 만료 시각과 같은 순간도 만료다(JWT 의 `exp` 는 그 시각부터 받아 주지 않는다).
 */
async function accessToken(deps: WriteDeps): Promise<AccessToken> {
  let token: string | null
  try {
    token = await deps.getAccessToken()
  } catch (error) {
    const detail = error instanceof Error ? `${error.name}: ${error.message}` : typeof error
    console.error(`[write] access token 을 받지 못했다 - ${detail}`)
    return { ok: false }
  }
  if (token === null) throw sessionRejected()
  const session = deps.currentSession()
  if (session !== null && session.accessExpiresAt <= deps.now()) return { ok: false }
  return { ok: true, token }
}

/**
 * 수정의 실패를 결과로. 갈래는 `decideWriteFailure`(form.ts)가 정한다 - 세션 거절은 던지고, 닿지
 * 못함(transport)은 원본처럼 오류 화면으로 던지지 않고 앱 문구를 담은 폼 상태다.
 */
function updateFailure(errors: readonly ErrorObject[], values: ResourceFormValues): UpdateOutcome {
  const failure = decideWriteFailure(errors, values)
  if (failure.kind === 'destroySession') throw sessionRejected()
  if (failure.kind === 'notFound') return { kind: 'notFound' }
  if (failure.kind === 'transport') return { kind: 'failed', state: unusableFormState(values) }
  return { kind: 'failed', state: failure.state }
}

/**
 * 생성 - `POST <자원 경로>`. 본문에 `data.id` 를 담지 않는다(담으면 403, 원본 실측). 쿼리를 붙이지
 * 않는다(쓰기 라우트는 쿼리를 받지 않는다 - 원본 W-5).
 *
 * 만드는 쓰기의 `RESOURCE_NOT_FOUND` 는 계약 밖이다 - 없어진 자원이 없으니 not-found 화면이 아니라
 * 배너로 그린다(`formStateFromErrors`). 성공했는데 만든 자원의 id 가 없으면(204·`data: null`) 계약
 * 위반이다 - `createdId` 가 지어내지 않으므로 앱 문구로 물러선다(원본 `createExampleAction` 과 같다).
 */
export async function createResource(
  resource: ResourceDefinition,
  values: ResourceFormValues,
  deps: WriteDeps,
): Promise<CreateOutcome> {
  const access = await accessToken(deps)
  if (!access.ok) return { kind: 'failed', state: unusableFormState(values) }

  const result = await deps.send<SingleDocument>(resource.path, {
    method: 'POST',
    body: writeDocument(resource, values),
    accessToken: access.token,
  })
  if (!result.ok) {
    const failure = updateFailure(result.errors, values)
    return failure.kind === 'notFound'
      ? { kind: 'failed', state: formStateFromErrors(result.errors, values) }
      : failure
  }

  const id = result.document === null ? undefined : createdId(result.document)
  return id === undefined
    ? { kind: 'failed', state: unusableFormState(values) }
    : { kind: 'saved', id }
}

/**
 * 수정 - `PATCH <자원 경로>/<id>`. PUT 이 아니다 - PUT 은 요청에 없는 필드까지 지운다(원본 실측
 * W-3). 속성과 관계를 매번 전부 보낸다 - 바뀐 것만 보내면 필드를 하나도 안 바꾼 제출에서 세 백엔드가
 * 갈린다(원본 `updateExampleAction` 의 두 절). URL 의 id 와 본문의 `data.id` 는 한 변수다(다르면 409).
 */
export async function updateResource(
  resource: ResourceDefinition,
  id: string,
  values: ResourceFormValues,
  deps: WriteDeps,
): Promise<UpdateOutcome> {
  const access = await accessToken(deps)
  if (!access.ok) return { kind: 'failed', state: unusableFormState(values) }

  const result = await deps.send<SingleDocument>(resourcePath(resource, id), {
    method: 'PATCH',
    body: writeDocument(resource, values, id),
    accessToken: access.token,
  })
  if (!result.ok) return updateFailure(result.errors, values)
  return { kind: 'saved', id }
}

/**
 * 삭제 - `DELETE <자원 경로>/<id>`, 본문이 없다.
 *
 * `404 RESOURCE_NOT_FOUND` 도 `deleted` 다 - DELETE 는 멱등이 아니라 이미 지워진 자원에 다시 보내면
 * 404 인데, 사용자가 원한 결과(그 자원이 없다)는 이미 이뤄져 있다. "내가 지웠다" 와 "누군가 먼저
 * 지웠다" 를 가를 재료가 응답에 없다(원본 `deleteExampleAction` 의 404 절). 그 밖의 실패는 배너
 * 문구다 - DELETE 에는 본문이 없어 필드·관계 오류 통은 늘 비어 있다.
 */
export async function deleteResource(
  resource: ResourceDefinition,
  id: string,
  deps: WriteDeps,
): Promise<DeleteOutcome> {
  const access = await accessToken(deps)
  if (!access.ok) return { kind: 'failed', messages: [UNUSABLE_RESPONSE_MESSAGE] }

  const result = await deps.send<SingleDocument>(resourcePath(resource, id), {
    method: 'DELETE',
    accessToken: access.token,
  })
  if (result.ok) return { kind: 'deleted' }

  const failure = decideWriteFailure(result.errors, IDLE_RESOURCE_FORM_STATE.submitted)
  if (failure.kind === 'destroySession') throw sessionRejected()
  if (failure.kind === 'notFound') return { kind: 'deleted' }
  if (failure.kind === 'transport') return { kind: 'failed', messages: [UNUSABLE_RESPONSE_MESSAGE] }
  return { kind: 'failed', messages: failure.state.documentErrors }
}
