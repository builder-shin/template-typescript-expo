import { describe, expect, it } from 'vitest'
import { JSONAPI_MEDIA_TYPE } from '@/lib/jsonapi/client'
import {
  bodyText,
  COMBINED_NOTE_PREFIX,
  combinedStepsResult,
  displayPath,
  parseCombinedSteps,
  requestHeaders,
  singleStepResult,
  stepHeading,
  type RawStep,
} from '@/lib/lab/result'

/**
 * 계약 실험실의 **순수 판단 다섯** - `lib/lab/result.ts`.
 *
 * (표시 쪽은 `test/unit/components/contract-result.test.ts` 가 잰다 - 그쪽은
 * `result-view.tsx` 의 마크업이고, 여기는 그 컴포넌트가 받는 **값을 만드는
 * 판단**이다.)
 *
 * ## 이 파일이 존재하는 이유 - 브랜치 리뷰의 Critical 하나
 *
 * 이 다섯은 `actions.ts`(`'use server'`) 안에 있어서 단위가 부를 자리가
 * 없었다. 그 사이 `combinedStepsResult` 의 머리글 형식은 단위 가드가 하나도
 * 없었고, 그것을 소비하던 유일한 E2E 단언이 **구조적으로 실패할 수 없는
 * 상태**로 한 라운드를 살아남았다 - 결과 문자열을 `[i/n]` 마커로만 잘라
 * 비교하면 잘린 조각에 머리글(`1단계 … ko` 대 `2단계 … en`)이 남아, 응답
 * 본문이 바이트 단위로 같아도 조각은 **항상** 다르다.
 *
 * 그래서 이 파일의 중심은 아래 "머리글을 걷어내면 같은 본문은 같다" 절이다.
 * 그 단언이 죽는 뮤턴트: `parseCombinedSteps` 가 머리글 줄을 본문에 남기면
 * (`STEP_HEADING` 갈래 제거) 즉시 죽는다 - 그것이 정확히 E2E 를 속 빈
 * 가드로 만들었던 세계다.
 *
 * 픽스처는 실제 자원 이름과 겹치지 않는 `probe-lab` 값이다(이 저장소의 관례 -
 * 픽스처가 프로덕션 상수와 같아지면 두 세계가 우연히 동일해진다).
 */

function step(overrides: Partial<RawStep> = {}): RawStep {
  return {
    label: 'probe-lab 단계',
    method: 'GET',
    path: '/api/v1/probes',
    status: 200,
    headers: { accept: JSONAPI_MEDIA_TYPE },
    bodyText: '{\n  "probeDial": 7\n}',
    ...overrides,
  }
}

describe('requestHeaders() — 보낸 요청 헤더', () => {
  it('accept 는 항상 있다', () => {
    expect(requestHeaders(false, undefined, false)).toEqual({ accept: JSONAPI_MEDIA_TYPE })
  })

  it('본문이 있을 때만 content-type 이 붙는다', () => {
    expect(requestHeaders(true, undefined, false)['content-type']).toBe(JSONAPI_MEDIA_TYPE)
    expect(requestHeaders(false, undefined, false)['content-type']).toBeUndefined()
  })

  it('accept-language 는 값이 있을 때만 붙는다 - 기본값을 지어내지 않는다', () => {
    expect(requestHeaders(false, 'probe-lang', false)['accept-language']).toBe('probe-lang')
    expect(requestHeaders(false, undefined, false)['accept-language']).toBeUndefined()
  })

  /*
   * **보안 성격의 자리다.** 이 판단을 지키던 것이 어제까지 E2E 단언 한
   * 줄뿐이었다(`contract-lab.spec.ts` 의 `authorization: Bearer <redacted>`).
   * 그 한 줄은 도커 스택이 있어야만 돈다 - 여기서 같은 것을 단위로 못박는다.
   */
  it('세션이 있으면 authorization 을 보냈다는 사실만 적는다 - 값은 가린다', () => {
    expect(requestHeaders(false, undefined, true).authorization).toBe('Bearer <redacted>')
  })

  it('세션이 없으면 authorization 자체가 없다 - "보낸 요청 헤더" 가 거짓이 되지 않는다', () => {
    expect(requestHeaders(false, undefined, false).authorization).toBeUndefined()
  })
})

describe('displayPath()', () => {
  it('쿼리가 없으면 경로 그대로다 - 빈 `?` 를 붙이지 않는다', () => {
    expect(displayPath('/api/v1/probes', undefined)).toBe('/api/v1/probes')
    expect(displayPath('/api/v1/probes', new URLSearchParams())).toBe('/api/v1/probes')
  })

  it('쿼리가 있으면 실제로 나간 모양 그대로 붙인다', () => {
    const query = new URLSearchParams({ 'page[size]': '3' })
    expect(displayPath('/api/v1/probes', query)).toBe('/api/v1/probes?page%5Bsize%5D=3')
  })
})

describe('bodyText() — 원본을 가공하지 않는 세 갈래', () => {
  it('오류는 실제 응답 모양(`{errors: [...]}`)으로 다시 감싼다', () => {
    const errors = [{ code: 'PROBE_LAB_ERROR', title: 'probe', detail: 'probe-lab detail' }]
    expect(JSON.parse(bodyText({ ok: false, status: 422, errors }))).toEqual({ errors })
  })

  it('204 는 본문이 없다는 사실 자체를 적는다 - "null" 로 두지 않는다', () => {
    const text = bodyText({ ok: true, status: 204, document: null })
    expect(text).toContain('204')
    expect(text).not.toBe('null')
  })

  it('2xx 는 들여쓴 JSON 이다 - 문서의 값이 하나도 사라지지 않는다', () => {
    const document = { data: { type: 'probes', id: 'probe-lab-dial', attributes: { dial: 7 } } }
    const text = bodyText({ ok: true, status: 200, document })
    expect(JSON.parse(text)).toEqual(document)
    expect(text).toContain('\n  ')
  })
})

describe('singleStepResult()', () => {
  it('요청 본문이 없으면 결과에도 body 키가 없다', () => {
    expect(singleStepResult(step())).toEqual({
      request: { method: 'GET', path: '/api/v1/probes' },
      status: 200,
      headers: { accept: JSONAPI_MEDIA_TYPE },
      body: '{\n  "probeDial": 7\n}',
    })
  })

  it('요청 본문이 있으면 그대로 실린다', () => {
    const result = singleStepResult(step({ method: 'PUT', body: '{"probeDial":8}' }))
    expect(result.request.body).toBe('{"probeDial":8}')
  })
})

describe('stepHeading() — 우리가 지은 글자와 백엔드가 준 글자', () => {
  it('순서·라벨·요청은 우리 것이고, 상태는 백엔드가 준 값이다', () => {
    const heading = stepHeading(step({ label: '1단계 — POST', method: 'POST', status: 422 }), 0, 2)
    expect(heading).toBe('[1/2] 1단계 — POST — POST /api/v1/probes (상태 422)')
  })
})

describe('combinedStepsResult() ↔ parseCombinedSteps() — 붙인 만큼만 뗀다', () => {
  /*
   * ★ **이 절이 C-1 을 닫는다.** 두 단계의 응답 본문을 **바이트 단위로 같게**
   * 두고 라벨·메서드만 다르게 한다. 예전 방식(`[i/n]` 마커로만 자르기)이라면
   * 두 조각은 머리글 때문에 반드시 달랐다 - 아래 첫 단언이 그 사실을 그대로
   * 재현해 남긴다. `parseCombinedSteps` 를 거치면 같아야 한다.
   */
  const SAME_BODY = '{\n  "errors": [\n    {\n      "code": "PROBE_LAB_SAME"\n    }\n  ]\n}'
  const ko = step({
    label: '1단계 — POST (Accept-Language: ko)',
    method: 'POST',
    status: 422,
    bodyText: SAME_BODY,
  })
  const en = step({
    label: '2단계 — POST (Accept-Language: en)',
    method: 'POST',
    status: 422,
    bodyText: SAME_BODY,
  })

  it('마커로만 자르면 본문이 같아도 조각이 다르다 - 속 빈 가드였던 세계', () => {
    const { body } = combinedStepsResult([ko, en], '/api/v1/probes')
    const [, first, second] = body.split(/\[\d\/2\]/)
    expect(first?.trim(), '머리글이 남아 있으므로 두 조각은 항상 다르다').not.toBe(second?.trim())
  })

  it('머리글을 걷어내면 같은 본문은 같다 - 이 단언이 그 가드를 실재하게 만든다', () => {
    const { body } = combinedStepsResult([ko, en], '/api/v1/probes')
    const { steps } = parseCombinedSteps(body)
    expect(steps).toHaveLength(2)
    expect(steps[0]?.body).toBe(SAME_BODY)
    expect(steps[1]?.body).toBe(SAME_BODY)
    expect(steps[0]?.body, '본문이 같으면 파싱 결과도 같다').toBe(steps[1]?.body)
  })

  it('본문이 다르면 파싱 결과도 다르다 - 위 단언이 무엇이든 같다고 하지 않는다', () => {
    const other = step({ label: '2단계', bodyText: '{\n  "probeDial": 9\n}' })
    const { steps } = parseCombinedSteps(combinedStepsResult([ko, other], '/api/v1/probes').body)
    expect(steps[0]?.body).not.toBe(steps[1]?.body)
  })

  it('머리글에는 백엔드가 준 상태가 실린다 - E2E 가 "백엔드에 닿았다" 를 이것으로 잰다', () => {
    const { steps } = parseCombinedSteps(combinedStepsResult([ko, en], '/api/v1/probes').body)
    expect(steps[0]?.heading).toContain('(상태 422)')
    expect(steps[1]?.heading).toContain('(상태 422)')
  })

  it('단계가 몇이든 본문이 그대로 왕복한다', () => {
    const many = [
      step({ label: '1쪽', bodyText: '{\n  "data": []\n}' }),
      step({ label: '2쪽', bodyText: '(응답 본문 없음 — 204는 본문이 없다)' }),
      step({ label: '3쪽', bodyText: '{\n  "data": [\n    1,\n    2\n  ]\n}' }),
    ]
    const { steps } = parseCombinedSteps(combinedStepsResult(many, '/api/v1/probes').body)
    expect(steps.map((parsed) => parsed.body)).toEqual(many.map((raw) => raw.bodyText))
  })

  /*
   * 맺음말이 표시 없이 붙으면 **마지막 단계의 본문에 섞인다** - 그러면 마지막
   * 단계만 비교 대상이 달라져서, 마커 하나로 자르던 옛 방식과 같은 종류의
   * 거짓을 다시 만든다. `COMBINED_NOTE_PREFIX` 가 그것을 막는다.
   */
  it('맺음말은 마지막 단계의 본문에 섞이지 않는다', () => {
    const walk = [step({ label: '1쪽' }), step({ label: '2쪽' })]
    const { steps, note } = parseCombinedSteps(
      combinedStepsResult(walk, '/api/v1/probes', 'probe-lab 맺음말').body,
    )
    expect(note).toBe('probe-lab 맺음말')
    expect(steps[1]?.body).toBe(walk[1]?.bodyText)
    expect(steps[1]?.body).not.toContain('맺음말')
  })

  it('맺음말이 없으면 note 도 없다', () => {
    expect(
      parseCombinedSteps(combinedStepsResult([ko], '/api/v1/probes').body).note,
    ).toBeUndefined()
  })

  it('맺음말 표시가 화면에 실제로 나타난다 - 이 접두사를 지우면 위 분리가 무너진다', () => {
    const { body } = combinedStepsResult([ko], '/api/v1/probes', 'probe-lab 맺음말')
    expect(body).toContain(`${COMBINED_NOTE_PREFIX}probe-lab 맺음말`)
  })

  it('요약 request 는 메서드를 겹치지 않게 모은다', () => {
    const result = combinedStepsResult(
      [step({ method: 'GET' }), step({ method: 'POST' }), step({ method: 'GET' })],
      '/api/v1/probes/relationships/tags',
    )
    expect(result.request).toEqual({
      method: 'GET + POST',
      path: '/api/v1/probes/relationships/tags',
    })
  })

  it('상태·헤더는 마지막 단계의 것이다', () => {
    const result = combinedStepsResult([step({ status: 200 }), step({ status: 204 })], '/x')
    expect(result.status).toBe(204)
  })

  it('브라우저에서 읽어 온 CRLF 도 같은 결과를 낸다 - E2E 가 이 함수에 innerText 를 그대로 넣는다', () => {
    const { body } = combinedStepsResult([ko, en], '/api/v1/probes')
    expect(parseCombinedSteps(body.replace(/\n/g, '\r\n'))).toEqual(parseCombinedSteps(body))
  })

  /*
   * 이 파서의 전제는 **응답 본문의 어떤 줄도 머리글처럼 시작하지 않는다** 이고,
   * 그 근거는 `bodyText` 가 JSON 을 `JSON.stringify(_, null, 2)` 로 다시 찍는다는
   * 것이다 - 중첩된 값은 전부 들여쓰기되므로 줄 첫 글자가 `[` 일 수 없다.
   * 그 논증이 주석에만 있으면 `bodyText` 가 원문 바이트를 돌려주도록 바뀌는 날
   * 조용히 깨진다(재리뷰 지적). 그래서 **머리글 모양을 값 안에 담은 실제
   * 백엔드 응답**으로 그 전제를 여기 못박는다.
   */
  it('본문 값에 머리글 모양이 들어 있어도 왕복이 깨지지 않는다', () => {
    const hostile = JSON.stringify(
      { errors: [{ code: 'PROBE_LAB', detail: '[1/2] 1단계 — POST 라고 적힌 값' }] },
      null,
      2,
    )
    const { steps } = parseCombinedSteps(
      combinedStepsResult(
        [step({ label: '1단계', bodyText: hostile }), step({ label: '2단계', bodyText: hostile })],
        '/api/v1/probes',
      ).body,
    )
    expect(steps).toHaveLength(2)
    expect(steps[0]?.body).toBe(hostile)
    expect(steps[1]?.body).toBe(hostile)
  })

  it('이 파서가 헛돌지 않는다 - 머리글이 하나도 없으면 단계도 0 이다', () => {
    expect(parseCombinedSteps('{\n  "probeDial": 7\n}').steps).toHaveLength(0)
  })
})
