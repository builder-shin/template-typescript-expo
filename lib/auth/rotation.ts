/**
 * 회전 결과 해석 - proxy.ts 가 쓰던 순수 함수(스펙 7.2, Task 3).
 * (template-typescript-expo) 이 저장소에서는 lib/auth/session-manager.ts 가 쓴다.
 *
 * proxy.ts 본체는 next/server 의 NextRequest/NextResponse 에 묶여 있고,
 * 실제 회전은 백엔드 fetch 를 낀다. 이 파일은 그중 **판단**만 뽑는다 - "회전
 * 응답을 어떻게 해석할지"(interpretRotationOutcome). 순수 함수라 next/server 나
 * fetch 를 스텁하지 않고도 전수 테스트할 수 있다.
 * (template-typescript-expo) 원본에는 "이 요청에서 회전할지"를 정하는 판단도 있었다 -
 * 이 저장소는 뺐다(아래 첫 블록 주석).
 *
 * 이 분리가 중요한 이유(실측, docs/superpowers/plans/2026-09-06-auth-and-session.md
 * "가장 중요한 사실" 절): 백엔드는 refresh 회전 시 구 refresh token 을 즉시
 * 폐기하고, **폐기된 토큰을 다시 내밀면 그 사용자의 활성 세션이 전부
 * 끊긴다**(재사용 감지 - refresh(구 토큰) 후 refresh(방금 받은 새 토큰)까지
 * TOKEN_REVOKED 로 죽는 것을 팀장이 정본에서 캡처했다). 회전이 요청당
 * 정확히 한 번만 일어난다는 것을 프레임워크를 띄우지 않고 검증하려면 결정
 * 로직이 순수해야 한다.
 */

import type { JsonApiResult } from '@/lib/jsonapi/client'
import type { JsonApiSend } from '@/lib/jsonapi/send'
import { sessionFromTokenDocument, type AuthTokenAttributes, type Session } from './tokens'

/*
 * (template-typescript-expo) 원본의 RotationDecision 과 decideRotation(쿠키 두 개를 읽어 이번
 * 요청에서 회전할지 정하는 프록시용 판단)은 뺐다. 이 저장소에는 쿠키가 없고, 회전할지는
 * lib/auth/session-manager.ts 가 저장된 세션의 isAccessExpiring 으로 정한다(스펙 7.1·7.2).
 */

/** 회전 요청(POST /auth/refresh)의 성공 응답이 회전 실패 시 destroy 로 이어진다. */
export type RotationOutcome =
  /** 회전 성공. 새 세션과, 두 쿠키에 쓸 maxAge(refreshExpiresIn, 초). */
  | { kind: 'rotated'; session: Session; refreshExpiresIn: number }
  /** 백엔드가 실제로 응답하고 거절했다(세션이 진짜 죽었다). 쿠키를 지운다. */
  | { kind: 'destroy'; reason: string }
  /** 백엔드가 판정을 내지 못했다(네트워크/타임아웃 등). 쿠키를 그대로 둔다. */
  | { kind: 'unreachable'; reason: string }

/**
 * POST /auth/refresh 의 성공 응답 모양(data.type=authTokens). attributes 는
 * tokens.ts 의 AuthTokenAttributes 와 같다 - 실측: docs/superpowers/plans/
 * 2026-09-06-auth-and-session.md 의 AUTH_TOKENS 예시와 test/fixtures/
 * documents.ts 의 AUTH_TOKENS 상수(D1 이 정본에서 캡처) 둘 다 이 모양이다.
 *
 * lib/jsonapi/document.ts 의 SingleDocument 를 그대로 쓰지 않는 이유:
 * 그 타입은 attributes 를 Attributes(Record<string, unknown>) | undefined 로
 * 느슨하게 잡아 이 호출부가 다시 좁혀야 한다 - 이 엔드포인트 하나만을 위한
 * 정밀한 모양을 여기 따로 둔다. request<T>() 는 T 를 런타임에 검증하지
 * 않으므로(이 저장소 전역 계약, client.ts) 이 좁힘은 백엔드가 계약대로
 * 응답한다는 신뢰 위에 있다 - 다른 request<T>() 호출부도 전부 같다.
 */
export interface AuthTokensDocument {
  data: {
    type: string
    id: string
    attributes: AuthTokenAttributes
  }
}

/**
 * 회전 요청의 결과(JsonApiResult)를 RotationOutcome 으로 해석한다.
 *
 * **TOKEN_REVOKED 와 네트워크 실패를 코드 문자열이 아니라 `status`로
 * 가른다.** client.ts 의 계약(REQUEST_ASSEMBLY_FAILED·NETWORK_ERROR 만
 * `status: 0`을 쓰고, 백엔드가 실제로 응답한 모든 경우는 `response.status`
 * 를 그대로 쓴다)이 이미 "백엔드가 판정을 냈는가"를 정확히 나눠 준다.
 *
 * `status !== 0`인 ok:false 는 전부 destroy 로 수렴시킨다 - TOKEN_REVOKED
 * 뿐 아니라 422 VALIDATION_ERROR(예: refreshToken 이 깨진 형식으로 갔을 때,
 * 실측: docs/superpowers/plans/2026-09-06-auth-and-session.md 의 실측표)
 * 등 **어떤 거절 코드든** 같다 - 재시도하지 않는 정책 아래, 백엔드가 실제로
 * 응답해 거절한 토큰을 계속 들고 있어 봐야 다음 요청에서도 똑같이
 * 거절된다. code 별로 분기하지 않는 이유는 새 거절 코드가 추가돼도(백엔드
 * 카탈로그가 바뀌어도) 이 함수가 코드를 몰라도 옳게 동작해야 하기
 * 때문이다 - 판단 기준은 "백엔드가 응답했는가"이지 "어떤 코드였는가"가
 * 아니다.
 *
 * 오직 `status === 0`(백엔드가 아예 판정을 내지 못함)만 unreachable 이다 -
 * 세션이 죽었다는 증거가 없으므로 파기하지 않는다. 파기하면 백엔드가
 * 잠깐 죽었을 때 그 순간 회전이 필요했던 모든 사용자가 로그아웃된다.
 *
 * (template-typescript-expo) 5xx·408·429 도 unreachable 이다 - 백엔드(나 그 앞의 프록시)가 응답은
 * 했지만 이 refresh token 을 판정하지 않았다(서버 오류·시간 초과·요청 과다). 원본처럼 파기로 모으면
 * 세션이 30일인 앱에서 회전 순간의 502 하나가 사용자를 로그아웃시킨다. 대가: 서버가 회전을 마친 뒤
 * 5xx 를 냈다면 옛 refresh 를 들고 있다가 다음 회전의 재사용 감지로 그 사용자의 세션이 전부 끊긴다 -
 * 로그아웃이 쓰기 한 번만큼 늦게 오고 다른 기기의 세션도 함께 끊긴다. 나머지 4xx 는 원본대로 파기한다.
 */
export function interpretRotationOutcome(
  result: JsonApiResult<AuthTokensDocument>,
  now: number = Date.now(),
): RotationOutcome {
  if (result.ok) {
    // JsonApiResult<T> 의 204 갈래는 status 로 좁혀지지 않는다(client.ts
    // 계약, tsc 실측) - document !== null 로 좁힌다.
    if (result.document === null) {
      // /auth/refresh 는 200 을 낸다(실측표) - 204 는 계약 위반이다. 세션을
      // 만들 재료(attributes)가 없으므로 파기한다.
      return { kind: 'destroy', reason: '회전 응답에 본문이 없다(204) - 계약 위반' }
    }
    const attributes = result.document.data.attributes
    return {
      kind: 'rotated',
      session: sessionFromTokenDocument(attributes, now),
      refreshExpiresIn: attributes.refreshExpiresIn,
    }
  }

  if (result.status === 0) {
    return {
      kind: 'unreachable',
      reason: `백엔드에 닿지 못했다: ${result.errors[0]?.code ?? 'UNKNOWN'}`,
    }
  }

  // (template-typescript-expo) 판정하지 않은 응답 - 위 주석의 마지막 문단.
  if (result.status >= 500 || result.status === 408 || result.status === 429) {
    return {
      kind: 'unreachable',
      reason: `백엔드가 회전을 판정하지 못했다(status ${result.status}, code ${result.errors[0]?.code ?? 'UNKNOWN'})`,
    }
  }

  return {
    kind: 'destroy',
    reason: `백엔드가 회전을 거절했다(status ${result.status}, code ${result.errors[0]?.code ?? 'UNKNOWN'})`,
  }
}

/**
 * 실제로 백엔드에 회전을 요청하는 유일한 자리 - lib/auth/session-manager.ts 가
 * 이 함수 하나만 부른다.
 *
 * 요청 본문 모양(`{ data: { type: 'refreshTokens', attributes: {
 * refreshToken } } }`)은 **실측하지 못했다** - Docker 가 내려가 있어 이
 * 태스크에서 실제 백엔드에 회전을 걸어 보지 못했다(팀장 브리핑이 이미 이
 * 제약을 명시했다). 스펙(`POST /api/v1/auth/refresh refreshTokens →
 * authTokens`)의 표기와, 이 저장소가 다른 모든 자원 type 을 복수형으로
 * 쓰는 관례(authTokens, users, examples)를 근거로 추정했다.
 *
 * (D2 Task 5 부기) 위 추정은 그 뒤 정본 소스(`app/schemas/auth.py` 의
 * `RefreshTokenResource`)로 확인했다 - 모양이 정확히 같다.
 *
 * **(D2 Task 7) 실제 HTTP 왕복으로 확인했다 - 추정이 맞았다.**
 * test/e2e/auth.spec.ts 의 "만료가 임박한 access 쿠키가 들어오면 프록시가
 * 회전한다" 가 정본 백엔드를 상대로 이 요청을 실제로 내보내고, 새 쌍이
 * 발급돼 두 쿠키가 갱신되는 것을 본다. `type` 을 단수형(`refreshToken`)으로
 * 바꾸는 뮤테이션은 죽는다 - 정본이 422 를 내고 interpretRotationOutcome 이
 * destroy 로 수렴해 쿠키가 지워진다(실측).
 *
 * **아직 안 잰 것:** 그 E2E 는 쿠키의 만료 시각을 앞당겨 회전을 유도한다.
 * 백엔드가 내려준 `expiresIn` 이 **시간이 실제로 흘러** 회전을 발동시키는지는
 * 검증하지 않았다.
 *
 * (template-typescript-expo) 원본은 `acceptLanguage` 를 받아 백엔드로 전달했다. 이 저장소는
 * 요청을 보내는 함수(`send`)를 받는다 - Accept-Language 는 그 함수(앱에서는 platform/api.ts 의
 * apiRequest)가 싣는다(스펙 9.4). 이 함수를 부르는 곳은 lib/auth/session-manager.ts 하나다
 * (스펙 7.2).
 */
export async function rotateSession(
  refreshToken: string,
  send: JsonApiSend,
  now: number = Date.now(),
): Promise<RotationOutcome> {
  const result = await send<AuthTokensDocument>('/api/v1/auth/refresh', {
    method: 'POST',
    body: { data: { type: 'refreshTokens', attributes: { refreshToken } } },
  })
  return interpretRotationOutcome(result, now)
}
