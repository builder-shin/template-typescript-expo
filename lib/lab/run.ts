import { withAcceptLanguage, type JsonApiResult, type RequestOptions } from '@/lib/jsonapi/client'
import type { CollectionDocument, SingleDocument } from '@/lib/jsonapi/document'
import { actionForErrors } from '@/lib/jsonapi/errors'
import { buildQuery, linkQuery } from '@/lib/jsonapi/query'
import type { JsonApiSend } from '@/lib/jsonapi/send'
import { EXAMPLE, EXAMPLE_TAG } from '@/lib/resources'
import { resourcePath } from '@/lib/resources/define'
import { accessToken, sessionRejected, type WriteDeps } from '@/lib/resources/write'
import {
  bodyText,
  combinedStepsResult,
  displayPath,
  requestHeaders,
  singleStepResult,
  type ExperimentResult,
  type RawStep,
} from './result'

/**
 * 계약 실험실의 실행부 - 실험 하나를 실제 요청으로 돌려 원본 응답을 결과로 옮긴다(스펙 8.6).
 *
 * 원본(template-typescript-nextjs)에서는 Server Action(`app/(lab)/contract/actions.ts`)이 하던 일이다.
 * 이 앱에서 그 자리는 쓰기 훅(`queries/lab.ts`)인데 훅은 React 없이 부를 수 없어서, 실험마다의 요청과 갈래를
 * 여기 두고 가짜 전송·토큰으로 잰다(`test/unit/lab/run.test.ts`) - 쓰기 흐름(`lib/resources/write.ts`)과 같은
 * 모양이다. 무엇을 실증하는지는 `experiments.ts`, 응답을 결과로 옮기는 판단은 `result.ts`(둘 다 복사본)다.
 *
 * - **원본을 가공하지 않는다.** 응답의 상태·본문은 `result.ts` 의 `bodyText` 로만 옮긴다. 오류 분류
 *   (`actionForErrors`)를 쓰는 자리는 세션이 죽었을 때 로그인으로 보내는 한 곳뿐이다(`dieIfSessionDead`).
 * - 요청은 주입받은 전송(`send`)으로만 보낸다 - 앱에서는 `platform/api.ts` 의 `apiRequest` 다(스펙 9.4).
 * - 요청마다 기기 언어(`deviceLanguage`)를 명시해 싣고 "보낸 요청 헤더" 에도 그 값을 적는다 - API 클라이언트는
 *   호출자가 정한 언어를 덮지 않으므로(스펙 9.4 의 D5 정정) 화면에 적힌 헤더가 실제로 나간 헤더다. 언어 협상
 *   실험만 기기 언어 대신 `ko`·`en` 을 직접 정한다.
 * - 세션이 필요한 셋(`putUpsert`·`relationshipWrite`·`acceptLanguage`)은 요청 전에 쓰기와 같은 길로 토큰을
 *   받는다(`lib/resources/write.ts` 의 `accessToken` - 가드를 두 벌 두지 않는다). 세션이 없으면 요청하지 않고
 *   세션 거절을 던진다. 받은 토큰의 세션이 이미 만료됐거나(만료 가드 - 회전이 판정을 받지 못해 지금의 access 가
 *   그대로 돌아왔다, 스펙 7.2) 토큰을 받지 못했으면(회전한 세션을 저장소에 못 씀) 요청하지 않고 `unusable` 로
 *   끝난다 - 던지지 않으니 세션은 그대로이고, 화면이 앱 문구를 그리며 실행 버튼이 곧 다시 시도다. 만료된 토큰을
 *   실어 보내면 백엔드가 TOKEN_EXPIRED 를 내고 세션이 지워진다 - 회전의 502 하나가 실험 한 번 늦게 로그아웃이 된다.
 * - 백엔드가 세션을 거절해도(인증 오류 코드) 세션 거절을 던진다. 받는 쪽은 쓰기 캐시(`MutationCache`)의
 *   `onError`(기기 세션을 지운다 - `platform/query-client.ts`)와 실험실 화면(로그인으로 보낸다 - 실험실은 공개
 *   경로라 경로 가드가 보내지 않는다, 스펙 7.3).
 * - 그 셋은 `experiments.ts` 의 `needsSession` 을 읽지 않고 아래 분기에 적는다 - 원본과 같이 데이터 파일 하나의
 *   실수로 가드가 풀리지 않게 한다. 둘이 어긋나면 시험이 잡는다.
 * - 읽기는 토큰 없이 보낸다(스펙 7.2) - 관계 전용 쓰기의 태그 조회도 그렇다.
 * - 토큰은 실험마다 한 번 받는다(회전은 세션 관리자 안에서만 일어난다 - 스펙 7.2).
 */

/**
 * 이 실험실이 만드는 유일한 행. `putUpsert` 가 만들고(고정 UUID 라 여러 번 눌러도 행이 하나다 - 그 자체가
 * upsert 의 실증이다) `relationshipWrite` 가 같은 행에 태그를 붙였다 뗀다. 값은 원본과 같다.
 */
export const PROBE_LAB_EXAMPLE_ID = '55550000-0000-4000-8000-000000000001'

/**
 * `putUpsert` 의 PUT 본문 - 설명과 관계를 뺐다. PUT 은 전체 교체라 요청에 없는 필드를 지운다 - 이 실험이
 * 실증하는 것이 그 동작이다(원본과 같다).
 */
const PROBE_LAB_UPSERT_BODY = {
  data: {
    type: EXAMPLE.type,
    id: PROBE_LAB_EXAMPLE_ID,
    attributes: { title: 'probe-lab PUT upsert 대상', status: 'draft', score: 0 },
  },
} as const

/** `acceptLanguage` 가 보내는, 늘 422 인 본문 - 제목이 `minLength: 1` 을 어겨 행이 만들어지지 않는다. */
const PROBE_LAB_INVALID_BODY = {
  data: { type: EXAMPLE.type, attributes: { title: '', status: 'draft', score: 0 } },
} as const

/** offset 순회가 한 번에 낼 수 있는 최대 요청 수(스펙 8.6 - 원본의 커서 순회 상한과 같다). */
export const MAX_OFFSET_REQUESTS = 20

/** offset 순회의 쪽 크기 - 씨앗 여섯 건만으로도 두 쪽을 지난다(원본의 커서 순회와 같은 값). */
export const OFFSET_PAGE_SIZE = 3

/**
 * 페이지 총합의 쪽 크기. 켠 요청과 끈 요청의 차이(`meta.totalCount`)는 쪽 크기와 무관하다 - 한 건만 받아 폰
 * 화면에 두 본문을 나란히 담는다.
 */
export const TOTALS_PAGE_SIZE = 1

/**
 * 실행부가 주입받는 것 - 쓰기가 받는 것(전송·토큰·지금의 세션·시계 - `lib/resources/write.ts` 의 `WriteDeps`)에
 * 기기 언어를 더했다. 앱에서는 API 클라이언트·세션 관리자·기기 언어다(`queries/lab.ts`).
 */
export interface LabDeps extends WriteDeps {
  /** 기기 언어로 만든 `Accept-Language` 값. 쓸 태그가 없으면 `null` - 헤더를 싣지 않는다. */
  readonly deviceLanguage: () => string | null
}

/**
 * 실험 한 번이 끝난 모양. `result` 는 실제로 나간 요청과 원본 응답이다. `unusable` 은 요청을 보내지 않았다는
 * 뜻이다 - 받은 토큰의 세션이 이미 만료됐거나 토큰을 받지 못했다(이 파일 머리말). 화면이 앱 문구를 그린다.
 * 세션 거절은 여기 없다 - 던진다.
 */
export type LabOutcome =
  { readonly kind: 'result'; readonly result: ExperimentResult } | { readonly kind: 'unusable' }

/** 요청 하나를 보내고, 원본을 그대로 옮긴 조각(RawStep)으로 만든다. */
async function performCall<T>(
  send: JsonApiSend,
  label: string,
  path: string,
  options: RequestOptions,
): Promise<{ step: RawStep; result: JsonApiResult<T> }> {
  const result = await send<T>(path, options)
  const step: RawStep = {
    label,
    method: options.method ?? 'GET',
    path: displayPath(path, options.query),
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body, null, 2) }),
    status: result.status,
    headers: requestHeaders(
      options.body !== undefined,
      options.acceptLanguage,
      options.accessToken !== undefined,
    ),
    bodyText: bodyText(result),
  }
  return { step, result }
}

/**
 * 세션이 필요한 실험을 토큰 하나로 돌린다. 토큰은 쓰기와 같은 길로 받는다(`accessToken`) - 세션이 없으면 거기서
 * 세션 거절이 던져지고, 받은 토큰을 쓸 수 없으면(만료 가드·토큰을 받지 못함) 요청하지 않고 `unusable` 이다.
 */
async function withToken(
  deps: LabDeps,
  run: (token: string) => Promise<ExperimentResult>,
): Promise<LabOutcome> {
  const access = await accessToken(deps)
  if (!access.ok) return { kind: 'unusable' }
  return { kind: 'result', result: await run(access.token) }
}

/** 세션이 필요 없는 실험 - 토큰을 묻지 않는다(회전도 없다). */
async function withoutToken(run: () => Promise<ExperimentResult>): Promise<LabOutcome> {
  return { kind: 'result', result: await run() }
}

/**
 * 백엔드가 세션을 거절했으면(인증 오류 코드 - 스펙 9.2) 세션 거절을 던진다. 인가를 판정하는 자리가 아니다 -
 * 백엔드가 이미 내린 판정을 앱 전역의 규약(기기 세션을 지우고 로그인으로)으로 옮길 뿐이다.
 */
function dieIfSessionDead(result: JsonApiResult<unknown>): void {
  if (!result.ok && actionForErrors(result.errors) === 'destroySession') throw sessionRejected()
}

async function runPutUpsert(deps: LabDeps, token: string): Promise<ExperimentResult> {
  const { step, result } = await performCall<SingleDocument>(
    deps.send,
    'PUT upsert',
    resourcePath(EXAMPLE, PROBE_LAB_EXAMPLE_ID),
    withAcceptLanguage(
      { method: 'PUT', body: PROBE_LAB_UPSERT_BODY, accessToken: token },
      deps.deviceLanguage(),
    ),
  )
  dieIfSessionDead(result)
  return singleStepResult(step)
}

/**
 * `.../relationships/tags` 의 POST(추가)·DELETE(제거). 태그에는 쓰기 라우트가 없어 먼저 있는 태그 하나를
 * 조회한다 - 그 조회도 실제로 나간 요청이라 결과에 보인다. 대상 행이 아직 없으면(= `putUpsert` 를 먼저 누르지
 * 않았으면) POST 가 실패 응답을 내고, 그것도 그대로 보인다.
 */
async function runRelationshipWrite(deps: LabDeps, token: string): Promise<ExperimentResult> {
  const language = deps.deviceLanguage()
  const relationshipsPath = `${resourcePath(EXAMPLE, PROBE_LAB_EXAMPLE_ID)}/relationships/tags`

  const lookup = await performCall<CollectionDocument>(
    deps.send,
    '1단계 — GET (관계 쓰기에 쓸 태그를 찾는다)',
    EXAMPLE_TAG.path,
    withAcceptLanguage({ query: buildQuery({ page: { size: 1 } }) }, language),
  )
  // document 로 좁힌다 - status 가 아니라(client.ts 의 JsonApiResult 주석).
  if (!lookup.result.ok || lookup.result.document === null) {
    return combinedStepsResult([lookup.step], relationshipsPath)
  }
  const firstTag = lookup.result.document.data[0]
  if (firstTag === undefined) {
    return combinedStepsResult(
      [lookup.step],
      relationshipsPath,
      '태그가 하나도 없어 2·3단계(POST·DELETE)를 실행할 수 없다.',
    )
  }

  const body = { data: [{ type: EXAMPLE_TAG.type, id: firstTag.id }] }
  const added = await performCall<unknown>(
    deps.send,
    '2단계 — POST (태그 추가)',
    relationshipsPath,
    withAcceptLanguage({ method: 'POST', body, accessToken: token }, language),
  )
  dieIfSessionDead(added.result)
  const removed = await performCall<unknown>(
    deps.send,
    '3단계 — DELETE (같은 태그 제거)',
    relationshipsPath,
    withAcceptLanguage({ method: 'DELETE', body, accessToken: token }, language),
  )
  dieIfSessionDead(removed.result)
  return combinedStepsResult([lookup.step, added.step, removed.step], relationshipsPath)
}

/**
 * `page[number]=1` 로 시작해 `links.next` 만 따라간다 - 다음 쪽 번호를 셈하지 않는다. 여섯 중 유일하게 끝없이
 * 돌 수 있는 실험이라 `MAX_OFFSET_REQUESTS` 로 상한을 두고, 걸리면 그 사실을 맺음말에 적는다(스펙 8.6). 빈 쪽이
 * 와도 링크가 있으면 따라간다 - 상한까지 가는 것이 그 백엔드의 원본 동작이다.
 */
async function runOffsetWalk(deps: LabDeps): Promise<ExperimentResult> {
  const language = deps.deviceLanguage()
  const steps: RawStep[] = []
  let query = buildQuery({ page: { number: 1, size: OFFSET_PAGE_SIZE } })
  let outcome: 'end' | 'cap' | 'error' | 'unparseable-link' = 'cap'

  while (steps.length < MAX_OFFSET_REQUESTS) {
    const call = await performCall<CollectionDocument>(
      deps.send,
      `${steps.length + 1}쪽`,
      EXAMPLE.path,
      withAcceptLanguage({ query }, language),
    )
    steps.push(call.step)
    if (!call.result.ok || call.result.document === null) {
      outcome = 'error'
      break
    }
    const next = call.result.document.links?.next
    // NestJS 는 없는 링크의 키를 지우고 정본·Rails 는 null 로 둔다 - 둘 다 끝이다.
    if (next === undefined || next === null) {
      outcome = 'end'
      break
    }
    const parsed = linkQuery(next)
    if (parsed === null) {
      outcome = 'unparseable-link'
      break
    }
    query = parsed
  }

  const note = {
    end: `links.next가 더 이상 없어 컬렉션 끝에 닿았다 - 총 ${steps.length}쪽(쪽당 최대 ${OFFSET_PAGE_SIZE}건)을 거쳤다.`,
    cap: `${MAX_OFFSET_REQUESTS}회 상한에 걸려 멈췄다 - links.next가 더 남아 있었을 수 있다(이 실행에서는 확인하지 않았다).`,
    error: `${steps.length}번째 요청에서 오류 응답을 받아 순회를 멈췄다 - 위 마지막 단계의 상태·본문이 그 오류다.`,
    'unparseable-link': `${steps.length}번째 응답의 links.next를 읽을 수 없어 순회를 멈췄다.`,
  }[outcome]

  return combinedStepsResult(steps, EXAMPLE.path, note)
}

/** `page[totals]` 를 끈 요청과 켠 요청을 나란히 보인다 - 둘 다 보여야 "켠 요청에만" 이 실증된다. */
async function runPageTotals(deps: LabDeps): Promise<ExperimentResult> {
  const language = deps.deviceLanguage()
  const off = await performCall<CollectionDocument>(
    deps.send,
    '1단계 — GET (page[totals] 없음)',
    EXAMPLE.path,
    withAcceptLanguage({ query: buildQuery({ page: { size: TOTALS_PAGE_SIZE } }) }, language),
  )
  const on = await performCall<CollectionDocument>(
    deps.send,
    '2단계 — GET (page[totals]=true)',
    EXAMPLE.path,
    withAcceptLanguage(
      { query: buildQuery({ page: { size: TOTALS_PAGE_SIZE, totals: true } }) },
      language,
    ),
  )
  return combinedStepsResult([off.step, on.step], EXAMPLE.path)
}

/**
 * 같은 검증 오류를 ko·en 으로 나란히 보인다. 이 실험만 기기 언어를 쓰지 않는다 - 비교가 목적이라 두 값을
 * 직접 정한다. API 클라이언트는 호출자가 정한 언어를 덮지 않는다(스펙 9.4 의 D5 정정).
 */
async function runAcceptLanguage(deps: LabDeps, token: string): Promise<ExperimentResult> {
  const ko = await performCall<SingleDocument>(
    deps.send,
    '1단계 — POST (Accept-Language: ko)',
    EXAMPLE.path,
    { method: 'POST', body: PROBE_LAB_INVALID_BODY, accessToken: token, acceptLanguage: 'ko' },
  )
  dieIfSessionDead(ko.result)
  const en = await performCall<SingleDocument>(
    deps.send,
    '2단계 — POST (Accept-Language: en)',
    EXAMPLE.path,
    { method: 'POST', body: PROBE_LAB_INVALID_BODY, accessToken: token, acceptLanguage: 'en' },
  )
  dieIfSessionDead(en.result)
  return combinedStepsResult([ko.step, en.step], EXAMPLE.path)
}

/** 제목은 `exact`·`contains` 만 정책에 있다(`lib/resources/example.ts`) - `gt` 는 문법은 맞지만 정책에 없다. */
async function runInvalidFilter(deps: LabDeps): Promise<ExperimentResult> {
  const query = buildQuery({ filters: [{ name: 'title', operator: 'gt', value: 'probe-lab' }] })
  const { step } = await performCall<CollectionDocument>(
    deps.send,
    'GET (정책에 없는 filter[title][gt])',
    EXAMPLE.path,
    withAcceptLanguage({ query }, deps.deviceLanguage()),
  )
  return singleStepResult(step)
}

/**
 * 실험 하나를 돌린다. 세션이 필요한 셋만 토큰을 받는다 - 나머지 셋은 세션을 건드리지 않는다(회전도 없다).
 * 세션이 없거나 백엔드가 세션을 거절하면 세션 거절을 던진다(`lib/resources/write.ts` 의 `sessionRejected`).
 * 받은 토큰을 쓸 수 없으면 요청 없이 `unusable` 이다.
 */
export function runExperiment(id: string, deps: LabDeps): Promise<LabOutcome> {
  switch (id) {
    case 'offsetWalk':
      return withoutToken(() => runOffsetWalk(deps))
    case 'pageTotals':
      return withoutToken(() => runPageTotals(deps))
    case 'invalidFilter':
      return withoutToken(() => runInvalidFilter(deps))
    case 'putUpsert':
      return withToken(deps, (token) => runPutUpsert(deps, token))
    case 'relationshipWrite':
      return withToken(deps, (token) => runRelationshipWrite(deps, token))
    case 'acceptLanguage':
      return withToken(deps, (token) => runAcceptLanguage(deps, token))
    default:
      return Promise.resolve({
        kind: 'result',
        result: {
          request: { method: '?', path: '?' },
          status: 0,
          headers: {},
          body: `알 수 없는 실험 id: ${id}`,
        },
      })
  }
}
