import { isSyntheticError } from './client'
import type { ErrorObject } from './document'

/**
 * ErrorObject 의 분류와 동작 분기.
 *
 * 문구는 이 파일이 만들지 않는다(스펙 9.2). 백엔드가 Accept-Language 를
 * 협상해 title·detail 을 ko/en 으로 내려주므로 그대로 표시한다. 카탈로그를
 * 프론트에 두 벌 유지하면 백엔드가 문구를 고쳐도 화면은 옛 문구를 보여주는
 * 상태가 조용히 생긴다 - 정본은 백엔드다.
 *
 * 프론트가 code 로 하는 것은 문구가 아니라 동작 분기뿐이다. 분기 기준은
 * 대부분 code 문자열이지만 전부는 아니다 - `transport`(아래)는 client.ts 가
 * 남긴 표시(isSyntheticError)로 판정한다. 백엔드가 낸 code 가 아니라 이
 * 오류가 애초에 백엔드에서 오지 않았다는 사실 자체가 근거이기 때문이다.
 */

export type ErrorPlacement =
  | { kind: 'attribute'; field: string }
  | { kind: 'relationship'; field: string }
  | { kind: 'document' }

/** RFC 6901: ~1 은 '/', ~0 은 '~'. 순서를 뒤집으면 a~01 이 a/ 로 잘못 풀린다. */
function unescapePointerSegment(segment: string): string {
  return segment.replace(/~1/g, '/').replace(/~0/g, '~')
}

export function placeError(error: ErrorObject): ErrorPlacement {
  const pointer = error.source?.pointer
  if (pointer === undefined) return { kind: 'document' }

  const segments = pointer.split('/')
  // '/data/attributes/title' -> ['', 'data', 'attributes', 'title']
  if (segments[1] !== 'data') return { kind: 'document' }

  const bucket = segments[2]
  const raw = segments[3]
  if (raw === undefined || raw === '') return { kind: 'document' }

  const field = unescapePointerSegment(raw)
  if (bucket === 'attributes') return { kind: 'attribute', field }
  if (bucket === 'relationships') return { kind: 'relationship', field }
  return { kind: 'document' }
}

/**
 * `transport`는 D1 인수인계 18번(D2 Task 4)이 추가했다 - client.ts 가
 * 합성한 오류(NETWORK_ERROR 등, 백엔드가 응답조차 주지 못한 경우)를 위한
 * 갈래다. 스펙 9.2: 이건 JSON:API 오류가 아니라서 화면(배너·폼)이 아니라
 * `app/error.tsx`가 받는다. 나머지 넷과 달리 code 문자열이 아니라
 * `isSyntheticError`(client.ts)로 판정한다 - 아래 actionForCode 참고.
 */
export type ErrorAction = 'destroySession' | 'notFound' | 'fieldErrors' | 'banner' | 'transport'

const SESSION_CODES = new Set([
  'AUTHENTICATION_REQUIRED',
  'INVALID_TOKEN',
  'TOKEN_EXPIRED',
  'TOKEN_REVOKED',
])

/**
 * 센 것이 이긴다. 배열 앞쪽이 아니라 심각도가 순서를 정한다.
 *
 * 지금 이 다섯은 서로 다른 랭크를 가진 단사(injective) 매핑이다. 그 덕에
 * actionForErrors의 `chosen = candidate` 갱신 조건이 `>`여도 `>=`여도
 * 결과가 같다 - 랭크가 같아지는 유일한 경우가 candidate와 chosen이 이미
 * 같은 액션일 때뿐이라 재대입이 무연산이기 때문이다(전수 검증됨). 이
 * 등가성은 전적으로 이 단사성에 기댄다: 나중에 새 액션이 기존 액션과 같은
 * 랭크를 갖게 되는 순간(예: 여섯 번째 액션을 추가하며 랭크를 잘못 매김)
 * `>`와 `>=`는 실제로 갈린다 - `>`는 먼저 본 액션을 유지하고 `>=`는 나중
 * 액션으로 덮어쓴다. ACTION_RANK를 바꿀 때는 이 단사성이 여전히 성립하는지
 * 확인해라.
 *
 * `transport`를 최상위에 둔 이유: 이 넷(destroySession·notFound·fieldErrors·
 * banner)은 전부 백엔드가 실제로 낸 code 문자열을 "추측"해 분류한 것이지만,
 * `transport`는 이 파일이 스스로 합성했다는 확실한 표시(isSyntheticError)를
 * 보고 분류한 것이다 - 추측보다 확신이 이겨야 한다. 실제로는 client.ts 가
 * 합성 오류와 백엔드 오류를 한 배열에 섞어 돌려주지 않으므로(항상 단독
 * 배열) 지금은 이 우선순위가 관측되지 않는다 - 그래도 순서를 명시해 두는
 * 이유는 actionForErrors 가 "어떤 배열에도 정의된 답을 낸다"는 일반
 * 함수이길 원해서다.
 */
const ACTION_RANK: Record<ErrorAction, number> = {
  transport: 4,
  destroySession: 3,
  notFound: 2,
  fieldErrors: 1,
  banner: 0,
}

function actionForCode(error: ErrorObject): ErrorAction {
  // code 문자열보다 먼저 본다 - isSyntheticError 가 참이면 code 가 무엇이든
  // (이론상 우연히 RESOURCE_NOT_FOUND 등과 같아도) transport 가 이긴다.
  if (isSyntheticError(error)) return 'transport'
  const code = error.code
  if (code !== undefined && SESSION_CODES.has(code)) return 'destroySession'
  if (code === 'RESOURCE_NOT_FOUND') return 'notFound'
  if (code === 'VALIDATION_ERROR') return 'fieldErrors'
  return 'banner'
}

/**
 * 여러 오류가 한 문서에 담겨 온다(실측: 검증 오류 3개가 한 번에 왔다).
 * 가장 센 동작을 고른다 - 로그인으로 보내야 하는 상황에서 폼에 필드 오류를
 * 그리면 사용자가 고칠 수 없는 폼을 붙들게 된다.
 */
export function actionForErrors(errors: readonly ErrorObject[]): ErrorAction {
  let chosen: ErrorAction = 'banner'
  for (const error of errors) {
    const candidate = actionForCode(error)
    if (ACTION_RANK[candidate] > ACTION_RANK[chosen]) chosen = candidate
  }
  return chosen
}

export interface FieldErrors {
  attributes: Record<string, string[]>
  relationships: Record<string, string[]>
  document: string[]
}

/** 문구가 하나도 없는 오류는 항목을 만들지 않는다 - 빈 빨간 상자를 그리지 않기 위해서다. */
function messageOf(error: ErrorObject): string | undefined {
  return error.detail ?? error.title ?? error.code
}

export function groupErrors(errors: readonly ErrorObject[]): FieldErrors {
  const grouped: FieldErrors = { attributes: {}, relationships: {}, document: [] }

  for (const error of errors) {
    const message = messageOf(error)
    if (message === undefined) continue

    const placement = placeError(error)
    if (placement.kind === 'document') {
      grouped.document.push(message)
      continue
    }
    const bucket = placement.kind === 'attribute' ? grouped.attributes : grouped.relationships
    ;(bucket[placement.field] ??= []).push(message)
  }

  return grouped
}
