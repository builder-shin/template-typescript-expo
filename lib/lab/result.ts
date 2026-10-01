import { JSONAPI_MEDIA_TYPE, type JsonApiResult } from '@/lib/jsonapi/client'

/**
 * 계약 실험실의 **순수 판단** - 원본 응답을 `ExperimentResult` 로 옮기는 것.
 *
 * `actions.ts`(`'use server'`)에서 다섯을 떼어 낸 자리다. 그 파일은
 * `requireSession()`·`headers()`·`request()` 를 부르는 Server Action 이라
 * vitest 가 부를 수 없는데, 여기 있는 것은 **입력만으로 값이 정해지는
 * 함수들**이라 평범한 `.ts` 모듈이면 단위가 그대로 부른다(`experiments.ts`
 * 가 이미 그 모양이다). `test/unit/app/contract-result.test.ts` 가 잰다.
 *
 * ## 떼어 낸 이유는 편의가 아니라 실측된 결함이다
 *
 * 아래 `combinedStepsResult` 의 머리글 형식이 `'use server'` 안에 있는 동안
 * 단위 테스트가 하나도 없었고, 그 형식을 소비하던 유일한 자리 - E2E
 * (`test/e2e/contract-lab.spec.ts`)의 `acceptLanguage` 단언 - 가
 * **구조적으로 실패할 수 없는 상태**였다. 그 단언은 결과 본문을 `[i/n]`
 * 마커로만 잘라 두 구획을 비교했는데, 잘린 구획에는 머리글이 그대로 남는다
 * (`1단계 … ko` 대 `2단계 … en`). **응답 본문이 바이트 단위로 같아도 두
 * 구획은 항상 달랐고**, 백엔드가 죽어 있어도(그때 `request()` 는 합성 오류
 * 문서를 돌려준다) 통과했다.
 *
 * 그래서 이 파일이 형식의 **양방향**을 함께 갖는다 - `combinedStepsResult`
 * 가 붙이고 `parseCombinedSteps` 가 정확히 그만큼을 떼어 낸다. 그 왕복을
 * 단위가 지키고("본문이 같으면 파싱 결과도 같다"), E2E 는 파싱된 **본문만**
 * 비교한다.
 *
 * 세션 토큰을 가리는 판단(`requestHeaders` 의 `Bearer <redacted>`)도 같은
 * 이유로 여기 있다 - 그 자리를 지키던 것이 E2E 단언 한 줄뿐이었다.
 *
 * ## body 는 왕복된 JSON 이지 원본 바이트가 아니다
 *
 * `lib/jsonapi/client.ts` 의 `request()` 는 파싱된 문서나 `ErrorObject[]` 만
 * 돌려주고 원본 응답 문자열을 주지 않는다 - 그 함수의 계약은 저장소 전체가
 * 기대는 것이라 넓히지 않는다. 대신 아래 `bodyText` 가
 * `JSON.stringify(document, null, 2)` 로 다시 직렬화한다 - 키 순서와 공백은
 * 원본과 다를 수 있다. 그 차이는 `result-view.tsx` 가 화면에도 적는다.
 */

export interface ExperimentResult {
  readonly request: { readonly method: string; readonly path: string; readonly body?: string }
  readonly status: number
  readonly headers: Readonly<Record<string, string>>
  /** **가공하지 않은** 응답 본문(들). 여러 단계인 실험은 단계별로 이어붙인다 - 아래 `combinedStepsResult`. */
  readonly body: string
}

/** 실제로 나간 요청 하나와 그 응답을 원본 그대로 옮긴 조각. */
export interface RawStep {
  readonly label: string
  readonly method: string
  readonly path: string
  readonly body?: string
  readonly status: number
  readonly headers: Readonly<Record<string, string>>
  readonly bodyText: string
}

/**
 * 이 실험실이 실제로 보낸 요청 헤더 - 응답 헤더가 아니다. `request()` 가
 * 응답 헤더를 노출하지 않으므로(위 머리말과 같은 이유), `ExperimentResult.headers`
 * 에는 우리가 보낸 값을 담는다. `result-view.tsx` 가 "보낸 요청 헤더" 라고
 * 분명히 이름 붙여 응답 헤더로 오해하지 않게 한다.
 *
 * **`authorization` 은 값을 보이지 않는다.** `needsSession` 인 실험은
 * `client.ts` 의 `request()` 가 실제로 `Authorization: Bearer <accessToken>`
 * 을 싣는다 - 그 사실 자체를 숨기면 "보낸 요청 헤더" 가 거짓이 되지만,
 * 그렇다고 세션 토큰 원문을 화면에 그대로 그리면 스크린샷·화면 공유로 새
 * 나갈 수 있다. 그래서 **보냈다는 사실만** 적는다. 다른 헤더(accept·
 * content-type·accept-language)는 애초에 비밀이 아니라 그대로 보인다.
 */
export function requestHeaders(
  hasBody: boolean,
  acceptLanguage: string | undefined,
  hasAccessToken: boolean,
): Record<string, string> {
  const out: Record<string, string> = { accept: JSONAPI_MEDIA_TYPE }
  if (hasBody) out['content-type'] = JSONAPI_MEDIA_TYPE
  if (acceptLanguage !== undefined) out['accept-language'] = acceptLanguage
  if (hasAccessToken) out.authorization = 'Bearer <redacted>'
  return out
}

/** 화면에 보일 경로 - 쿼리가 있으면 그대로 붙인다(실제로 나간 요청과 같은 모양). */
export function displayPath(path: string, query: URLSearchParams | undefined): string {
  const qs = query?.toString() ?? ''
  return qs === '' ? path : `${path}?${qs}`
}

/**
 * 원본 응답을 문자열로 - **가공하지 않는다.** 세 갈래뿐이다:
 *
 * 1. 오류 - `{errors: [...]}` 로 다시 감싼다. `request()` 가 오류 문서에서
 *    `errors` 배열만 남기고 나머지(`jsonapi`·`meta`·`links`)는 버리므로
 *    (client.ts 의 `JsonApiResult` 판별 유니온), 이 값은 원본 오류 문서
 *    전체가 아니라 그 배열을 실제 응답 모양(`{errors: [...]}`)으로 다시
 *    감싼 것이다.
 * 2. 204 - 본문이 없다는 사실 자체를 적는다. `JSON.stringify(null)`("null")
 *    로 두면 `{data: null}` 같은 실제 JSON 값과 헷갈린다 - 204 는 애초에
 *    본문 자체가 없다(client.ts).
 * 3. 그 외 2xx - `JSON.stringify(document, null, 2)`. 왕복 직렬화다(파일
 *    머리말).
 */
export function bodyText<T>(result: JsonApiResult<T>): string {
  if (!result.ok) return JSON.stringify({ errors: result.errors }, null, 2)
  if (result.status === 204) return '(응답 본문 없음 — 204는 본문이 없다)'
  return JSON.stringify(result.document, null, 2)
}

export function singleStepResult(step: RawStep): ExperimentResult {
  return {
    request:
      step.body === undefined
        ? { method: step.method, path: step.path }
        : { method: step.method, path: step.path, body: step.body },
    status: step.status,
    headers: step.headers,
    body: step.bodyText,
  }
}

/* ------------------------------------------------------------------------- *
 * 여러 단계를 하나로 - 붙이는 쪽과 떼는 쪽을 한 파일에 둔다
 * ------------------------------------------------------------------------- */

/**
 * 단계 머리글이 시작하는 모양. **줄 맨 앞에서만** 나타난다 - 응답 본문은
 * `JSON.stringify(..., null, 2)` 가 만든 것이라 최상위 여는 괄호(`{`)를 빼면
 * 모든 줄이 공백으로 들여쓰여 있고, 문자열 안의 줄바꿈은 `\n` 으로 이스케이프
 * 되므로 본문의 어떤 줄도 이 모양이 될 수 없다. 204 자리에 들어가는 문장은
 * `(` 로 시작한다.
 */
const STEP_HEADING = /^\[\d+\/\d+\] /

/**
 * 맺음말 표시. 머리글과 같은 자리(줄 맨 앞의 대괄호)를 쓰므로
 * `parseCombinedSteps` 가 본문과 구별할 수 있다 - 이 표시가 없으면 맺음말이
 * **마지막 단계의 응답 본문에 붙어** 그 단계만 비교 대상이 달라진다.
 */
export const COMBINED_NOTE_PREFIX = '[끝] '

/** 우리가 붙이는 순서표 한 줄. 백엔드가 준 값은 `상태` 하나뿐이고 나머지는 이 실험실이 지었다. */
export function stepHeading(step: RawStep, index: number, total: number): string {
  return `[${index + 1}/${total}] ${step.label} — ${step.method} ${step.path} (상태 ${step.status})`
}

/** `parseCombinedSteps` 가 돌려주는 단계 하나 - 우리가 지은 글자와 백엔드가 준 글자를 갈라 놓는다. */
export interface CombinedStep {
  /** 우리가 붙인 순서표(`stepHeading`). 여기에는 백엔드의 상태 코드만 들어 있다. */
  readonly heading: string
  /** **백엔드가 준 것 그대로.** 이 문자열에는 이 실험실이 지은 글자가 하나도 없다. */
  readonly body: string
}

export interface CombinedSteps {
  readonly steps: readonly CombinedStep[]
  /** `COMBINED_NOTE_PREFIX` 뒤의 맺음말. 없으면 `undefined`. */
  readonly note: string | undefined
}

/**
 * 여러 단계를 하나의 `ExperimentResult` 로 묶는다. 각 단계의 `bodyText` 는
 * 손대지 않고 그대로 이어붙이고, 앞에 붙이는 것은 "몇 번째 단계·요청·상태"
 * 라는 우리가 만든 메타 정보뿐이다 - `groupErrors` 류의 재가공과 다르다
 * (백엔드가 준 값의 문구나 구조를 바꾸지 않는다, 여러 원본을 나란히 보여주기
 * 위한 순서표만 우리가 붙인다).
 */
export function combinedStepsResult(
  steps: readonly RawStep[],
  summaryPath: string,
  note?: string,
): ExperimentResult {
  const methods = [...new Set(steps.map((step) => step.method))].join(' + ')
  const sections = steps.map(
    (step, index) => `${stepHeading(step, index, steps.length)}\n${step.bodyText}`,
  )
  const last = steps[steps.length - 1]
  const joined = sections.join('\n\n')

  return {
    request: { method: methods, path: summaryPath },
    status: last?.status ?? 0,
    headers: last?.headers ?? {},
    body: note === undefined ? joined : `${joined}\n\n${COMBINED_NOTE_PREFIX}${note}`,
  }
}

/**
 * `combinedStepsResult` 가 붙인 것을 정확히 그만큼 떼어 낸다 - **각 단계의
 * 응답 본문만** 손에 쥐기 위해서다.
 *
 * **이 함수가 존재하는 이유:** 이것 없이 결과 문자열을 `[i/n]` 마커로만
 * 자르면 잘린 조각에 머리글이 남아, 응답 본문이 같아도 조각은 항상 다르다 -
 * `acceptLanguage` E2E 단언이 정확히 그 상태로 한 라운드를 살아남았다(파일
 * 머리말). 그 단언이 실제로 재려면 **머리글이 빠진 본문**이 필요하다.
 *
 * 브라우저에서 읽어 온 텍스트도 그대로 넣을 수 있게 `\r\n` 을 함께 받는다.
 * 우리가 만드는 본문에는 `\r` 이 없으므로(위 `STEP_HEADING` 주석의 근거와
 * 같다) 이 관용이 왕복의 정확성을 흐리지 않는다.
 */
export function parseCombinedSteps(body: string): CombinedSteps {
  const steps: { heading: string; lines: string[] }[] = []
  let note: string | undefined

  for (const line of body.split(/\r?\n/)) {
    if (note !== undefined) {
      note = `${note}\n${line}`
      continue
    }
    if (line.startsWith(COMBINED_NOTE_PREFIX)) {
      note = line.slice(COMBINED_NOTE_PREFIX.length)
      continue
    }
    if (STEP_HEADING.test(line)) {
      steps.push({ heading: line, lines: [] })
      continue
    }
    // 첫 머리글보다 앞선 줄은 버린다 - 이 형식에서는 나올 수 없고, 나온다면
    // 그것은 어느 단계의 본문도 아니다.
    steps[steps.length - 1]?.lines.push(line)
  }

  return {
    steps: steps.map((step) => ({
      heading: step.heading,
      // 단계 사이를 벌리는 빈 줄은 우리가 넣은 것이라 본문에서 뺀다.
      body: dropTrailingBlankLines(step.lines).join('\n'),
    })),
    note,
  }
}

function dropTrailingBlankLines(lines: readonly string[]): string[] {
  const out = [...lines]
  while (out.length > 0 && out[out.length - 1] === '') out.pop()
  return out
}
