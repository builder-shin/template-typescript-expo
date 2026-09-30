import type { JsonApiResult } from '@/lib/jsonapi/client'
import type { CollectionDocument, SingleDocument } from '@/lib/jsonapi/document'
import { actionForErrors } from '@/lib/jsonapi/errors'
import type { ResourceDefinition } from '@/lib/resources/define'
import {
  bannerMessages,
  detailView,
  listView,
  referenceList,
  type DetailView,
  type ListFailure,
  type ListRequest,
  type ListView,
  type ReferenceList,
} from '@/lib/resources/view'

/**
 * 조회 화면이 그릴 것 - TanStack Query 가 준 데이터·오류에서 정한다(스펙 9.3·8.5).
 *
 * 조회의 `queryFn` 은 백엔드가 응답조차 주지 못한 실패(transport)를 던진다(`throwIfUnreachable`). TanStack
 * Query 는 재조회가 실패해도 앞의 데이터를 그대로 두므로 - 무한 조회는 읽은 쪽 전부를 - 앱 복귀·네트워크
 * 복귀·당겨서 새로고침·다시 들어온 상세의 재조회가 닿지 못해도 읽은 행과 상세가 남는다. 연결이 돌아온 뒤의
 * 재조회도 읽어 둔 쪽을 모두 다시 읽는다. 실패를 결과 값으로 캐시에 두면 재조회의 실패가 읽은 데이터를
 * 갈아엎고(쪽 배열이 `[실패]` 하나가 된다) 다음 재조회는 그 한 쪽만 읽는다 - D3 최종 검토가 설치본
 * query-core 로 재 보인 결함이다(6행 → 전체 화면 실패 → 2행).
 *
 * 백엔드 오류 문서는 여전히 결과 값이다 - 협상된 문구를 배너로 그린다(`listView`·`detailView`).
 *
 * 화면 상태: 데이터가 없으면 스켈레톤(`loading`)이거나, 첫 조회가 닿지 못했으면 실패가 화면 전부다
 * (`unreachable` - 앱 문구와 "다시 시도"). 데이터가 있으면 그것을 그리고, 닿지 못한 재조회는
 * `refreshFailed`(작은 실패와 "다시 시도" - 읽은 것을 다시 읽는다)로, 닿지 못한 다음 쪽은 목록 끝의
 * `failure`(그 쪽만 다시 읽는다)로 싣는다.
 */

/** 백엔드가 응답조차 주지 못한 조회 - 조회의 `queryFn` 이 던진다(`throwIfUnreachable`). */
export class UnreachableError extends Error {
  constructor(request: string) {
    super(`${request} 요청이 백엔드에 닿지 못했다`)
    this.name = 'UnreachableError'
  }
}

/**
 * 조회 결과를 캐시에 넣을 값으로 - 백엔드가 응답조차 주지 못했으면(`actionForErrors` 의 `transport`) 던진다.
 * 성공과 백엔드 오류 문서는 그대로 돌려준다. `request` 는 진단 문구에 쓴다(`'목록'`·`'상세'`).
 */
export function throwIfUnreachable<T>(result: JsonApiResult<T>, request: string): JsonApiResult<T> {
  if (!result.ok && actionForErrors(result.errors) === 'transport') {
    throw new UnreachableError(request)
  }
  return result
}

/**
 * 마지막 조회가 닿지 못했는가. 오류가 없으면 거짓이다. 닿지 못함이 아닌 오류는 결함이라(쿼리 함수나 요청
 * 조립이 던졌다) 삼키지 않고 다시 던진다 - 렌더 중에 던져 오류 경계로 간다. "연결할 수 없다" 로 그리면 결함이
 * 네트워크 문제로 위장한다.
 */
function refetchUnreachable(error: unknown): boolean {
  if (error === null || error === undefined) return false
  if (error instanceof UnreachableError) return true
  if (error instanceof Error) throw error
  const shown = typeof error === 'string' ? error : typeof error
  throw new Error(`조회가 Error 가 아닌 값으로 실패했다: ${shown}`)
}

/** 목록 화면이 그릴 것. `list` 의 `failure` 는 목록 끝(뒤따르는 쪽), `refreshFailed` 는 목록 위(재조회)의 실패다. */
export type ListScreen =
  | { kind: 'loading' }
  | { kind: 'unreachable' }
  | { kind: 'banner'; messages: readonly string[]; refreshFailed: boolean }
  | (Extract<ListView, { kind: 'list' }> & { refreshFailed: boolean })

/** 무한 조회가 준 것 - 읽은 쪽들(없으면 `undefined`), 마지막 조회의 오류, 그 오류가 다음 쪽의 것인가. */
export interface ListQueryFacts {
  readonly pages: readonly JsonApiResult<CollectionDocument>[] | undefined
  readonly error: unknown
  readonly nextPageFailed: boolean
}

export function listScreen(
  resource: ResourceDefinition,
  plan: ListRequest,
  facts: ListQueryFacts,
): ListScreen {
  const failed = refetchUnreachable(facts.error)
  if (facts.pages === undefined) return failed ? { kind: 'unreachable' } : { kind: 'loading' }

  const view = listView(resource, plan, facts.pages)
  // 닿지 못함은 캐시에 들지 않는다(`throwIfUnreachable`) - 들어 있으면 그것이 화면 전부다.
  if (view.kind === 'unreachable') return view
  if (view.kind === 'banner') return { ...view, refreshFailed: failed }
  if (failed && facts.nextPageFailed) {
    return { ...view, failure: { kind: 'unreachable' }, refreshFailed: false }
  }
  return { ...view, refreshFailed: failed }
}

/** 상세 화면이 그릴 것. `refreshFailed` 는 읽은 상세(또는 배너) 위의 작은 실패다. */
export type DetailScreen =
  | { kind: 'loading' }
  | { kind: 'unreachable' }
  | { kind: 'notFound' }
  | (Exclude<DetailView, { kind: 'notFound' } | ListFailure> & { refreshFailed: boolean })
  | { kind: 'banner'; messages: readonly string[]; refreshFailed: boolean }

/** 조회가 준 것 - 응답(없으면 `undefined`)과 마지막 조회의 오류. */
export interface DetailQueryFacts {
  readonly result: JsonApiResult<SingleDocument> | undefined
  readonly error: unknown
}

export function detailScreen(resource: ResourceDefinition, facts: DetailQueryFacts): DetailScreen {
  const failed = refetchUnreachable(facts.error)
  if (facts.result === undefined) return failed ? { kind: 'unreachable' } : { kind: 'loading' }

  const view = detailView(resource, facts.result)
  // 없는 자원은 재조회가 닿지 못해도 없는 자원이다 - 작은 실패를 싣지 않는다.
  if (view.kind === 'notFound' || view.kind === 'unreachable') return view
  return { ...view, refreshFailed: failed }
}

/**
 * 관계 선택기가 그릴 참조 목록 하나 - 목록·상세와 같은 규칙이다(스펙 9.3). 받기 전이면 `list` 가 `null`(스켈레톤)
 * 이다. 첫 조회가 닿지 못했으면 앱 문구와 "다시 시도"(`unreachable`), 백엔드가 거절했으면 그 문구(`banner`)를 보기
 * 대신 그린다 - 문구가 하나도 없는 거절도 앱 문구로 물러선다(폼 안의 선택기 하나 때문에 화면을 오류 경계로 보내지
 * 않는다). 실패한 동안 `list` 는 빈 목록이다 - 폼은 고른 것을 목록 밖 선택으로 그린다(`relationshipChoice`).
 *
 * 읽은 목록이 있으면 재조회가 닿지 못해도 그 목록을 그대로 두고 실패를 싣지 않는다 - 선택기는 고를 것을 보여 줄
 * 뿐이고, 그사이 없어진 보기를 고르면 저장이 관계 오류로 그 선택기 아래에 알린다(스펙 9.1).
 */
export interface ReferenceState {
  /** 선택기가 그릴 보기 - 받기 전이면 `null`, 실패했으면 빈 목록이다. */
  readonly list: ReferenceList | null
  /** 보기 대신 그릴 실패. */
  readonly failure: ListFailure | null
}

/** 조회가 준 것 - 참조 목록 응답(없으면 `undefined`)과 마지막 조회의 오류. */
export interface ReferenceQueryFacts {
  readonly result: JsonApiResult<CollectionDocument> | undefined
  readonly error: unknown
}

export function referenceState(
  target: ResourceDefinition,
  facts: ReferenceQueryFacts,
): ReferenceState {
  const failed = refetchUnreachable(facts.error)
  if (facts.result === undefined) {
    return failed
      ? { list: referenceList(target, null), failure: { kind: 'unreachable' } }
      : { list: null, failure: null }
  }
  if (facts.result.ok) return { list: referenceList(target, facts.result.document), failure: null }
  const messages = bannerMessages(facts.result.errors)
  return {
    list: referenceList(target, null),
    failure: messages.length === 0 ? { kind: 'unreachable' } : { kind: 'banner', messages },
  }
}
