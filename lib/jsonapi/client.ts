import { getSettings } from '@/lib/config/settings'
import { isErrorDocument, type ErrorObject } from './document'

/**
 * 백엔드로 나가는 유일한 문. app/ 에서 fetch 를 직접 부르면 계층 위반이다(스펙 4장).
 *
 * 재시도하지 않는다. 백엔드는 refresh 회전 시 구 refresh token 을 즉시
 * 폐기하므로, 여기서 401 에 재시도를 붙이면 한 페이지의 여러 서버 컴포넌트가
 * 동시에 회전을 시도해 두 번째부터 TOKEN_REVOKED 로 실패한다. 회전은
 * proxy.ts 에서만 일어난다(스펙 7.2 - 스펙은 middleware.ts 라고 적지만
 * Next 16 이 그 컨벤션을 폐기해 proxy.ts 로 옮겼다. Task 3 참고).
 *
 * 요청마다 달라지는 입력 때문에는 어떤 경우에도 던지지 않는다. 네트워크
 * 실패·JSON 이 아닌 응답·조립 중 예외(순환 참조 바디, 개행이 섞인
 * acceptLanguage/accessToken 등)까지 전부 ok:false 로 만든다.
 *
 * (D2 Task 4 정정) 이 규칙의 근거는 원래 "서버 컴포넌트에서 던지면 화면이
 * 흰 페이지가 된다"였다 - `app/error.tsx`가 없던 시절엔 사실이었다. 지금은
 * `error.tsx`가 있어서 던져도 흰 페이지가 아니라 `error.tsx`가 뜨므로 그
 * 근거는 더 이상 사실이 아니다. 그래도 "던지지 않는다"는 유지한다 - 진짜
 * 근거는 **호출자가 오류를 화면에 어떻게 그릴지 고를 수 있어야 한다**는
 * 것이다. 이 함수가 여기서 직접 던지면 그 선택지가 사라져 모든 호출자가
 * 예외 없이 `error.tsx`로 강제된다. 반면 지금처럼 `ok:false`로 돌려주면,
 * 호출자는 `actionForErrors`(errors.ts)가 이 셋에 붙이는 `'transport'`
 * 분류를 보고 스스로 정할 수 있다 - 읽기 경로는 던져서 `error.tsx`를 띄우는
 * 쪽을 고를 수도 있고(스펙 9.2), 폼을 다루는 호출자는 화면 전환 없이 다르게
 * 처리하는 쪽을 고를 수도 있다. "합성할지"는 이 파일이 정하지만 "던질지"는
 * 이 파일이 정하지 않는다.
 *
 * 예외가 정확히 하나 있다 - getSettings() 가 던지는 BACKEND_URL 설정
 * 오류는 그대로 던지게 둔다. 이건 요청마다 달라지는 입력이 아니라 배포
 * 전체에 고정된 결함이라, 여기서 ok:false 로 삼키면 깨진 배포가 정상인
 * 척하며 화면에는 "백엔드에 연결할 수 없다"는 배너만 뜬다 - 운영자가
 * 원인을 찾는 데 더 오래 걸린다. settings.ts 가 선택한 "첫 요청에서야
 * 드러나는 설정 오류보다 시작 실패가 낫다"는 원칙을 여기서도 그대로
 * 따른다 - 이 하나의 예외는 의도적이다. (이 예외를 없애려고 getSettings()
 * 를 아래 try 안으로 넣지 마라 - 그건 버그 수정이 아니라 이 판단을
 * 뒤집는 것이다.)
 */

/** 파라미터를 붙이지 않는다. 백엔드가 파라미터 붙은 미디어 타입을 415 로 거절한다. */
export const JSONAPI_MEDIA_TYPE = 'application/vnd.api+json'

/**
 * 요청 하나가 쓸 수 있는 최대 시간(template-typescript-expo 스펙 8.5).
 *
 * 모바일 네트워크는 거절하지 않고 멈추는 경우가 많다 - 이 값이 없으면 멈춘 요청이
 * 화면의 스피너를 끝없이 돌린다. 연결·응답 대기·본문 읽기를 모두 덮는다.
 */
export const REQUEST_TIMEOUT_MS = 15_000

/**
 * 204 는 별도 리터럴 분기다 - `document: T`인 분기와 합쳐 `null as T`로
 * 거짓말하면(과거 버전) `r.document.data`가 타입체크는 통과하고 런타임에
 * "Cannot read properties of null"로 죽는다(204 에는 본문이 없다).
 *
 * 이 분리만으로 `r.document`를 어떤 좁히기도 없이 바로 쓰면(`if (r.ok)` 뒤
 * `r.document.data`처럼) `document`의 타입이 `null | T`가 되어 그 자리에서
 * 타입 오류로 걸린다 - 이게 이 변경이 고치는 것이다.
 *
 * 좁히는 방법 - `r.status`가 아니라 `r.document` 자체로 좁혀라
 * (`if (r.document !== null)`). 실측: `r.status !== 204`·`r.status === 204`
 * 어느 쪽도 `document`를 좁히지 못한다 - 한 분기는 `status: 204`(리터럴), 다른
 * 분기는 `status: number`(일반)라 판별자가 "섞여" 있고, TypeScript 는 이런
 * 섞인 판별자에서는 status 비교로 멤버를 배제하지 않는다(멤버 배제는 모든
 * 분기의 그 필드가 서로 다른 리터럴일 때만 믿을 수 있다). 반면 `document`
 * 자체는 `null | T`이고 `T`가 `null`을 포함하지 않는 한(이 저장소의 모든
 * 문서 타입이 그렇다) `!== null` 좁히기는 판별자 순수성과 무관하게 항상
 * 확실하다.
 */
export type JsonApiResult<T> =
  | { ok: true; status: 204; document: null }
  | { ok: true; status: number; document: T }
  | { ok: false; status: number; errors: ErrorObject[] }

export interface RequestOptions {
  method?: string
  body?: unknown
  query?: URLSearchParams
  accessToken?: string
  acceptLanguage?: string
  signal?: AbortSignal
}

/**
 * `detail`은 항상 이 모듈이 고른 고정 문구다 - 절대 엔진/브라우저가 던진 원문
 * 예외 메시지를 담지 않는다. groupErrors 가 `detail`을 그대로 사용자 배너에
 * 그리므로(errors.ts), 여기 원문이 들어가면 "fetch failed" 같은 영어 엔진
 * 메시지가 사용자에게 그대로 보인다(실측된 결함, S3). 원문은 디버깅에
 * 필요하므로 완전히 버리지 않고 `meta.cause`에 남긴다 - `meta`는 스펙 9.2 가
 * 말하는 "사용자에게 보이는 문구" 자리가 아니다.
 *
 * `meta.synthetic`도 같은 이유로 여기 둔다(D2 Task 4, 인수인계 18번) - 이
 * 오류가 백엔드가 아니라 이 함수가 지어낸 것이라는 표시다. `cause`와 달리
 * 조건 없이 항상 붙인다 - NON_JSONAPI_RESPONSE 의 두 호출부는 `cause`를
 * 넘기지 않으므로 `cause` 유무로는 셋을 하나로 묶어 판정할 수 없다.
 * isSyntheticError(아래)가 이 표시로 판정하고, errors.ts 의 actionForErrors
 * 가 그 판정으로 `'transport'`를 고른다(스펙 9.2) - 화면은 code 문자열을
 * 몰라도 된다.
 */
function synthesizeError(
  status: number,
  code: string,
  detail: string,
  cause?: string,
): ErrorObject[] {
  const synthesized: ErrorObject = { status: String(status), code, title: code, detail }
  synthesized.meta = cause !== undefined ? { cause, synthetic: true } : { synthetic: true }
  return [synthesized]
}

/** `error`가 `Error`면 그 메시지를, 아니면 `undefined`를 돌려준다 - 디버깅용 meta.cause 재료다. */
function causeOf(error: unknown): string | undefined {
  return error instanceof Error ? error.message : undefined
}

/**
 * `error`가 synthesizeError 가 만든 것인지(백엔드가 아니라 이 파일이 지어낸
 * 것인지) 판정한다. errors.ts 가 이 함수로 `'transport'` 분류를 고른다.
 *
 * `NETWORK_ERROR` 같은 세 코드 문자열을 직접 비교하지 않는 이유: 그 문자열은
 * 백엔드 오류 카탈로그에 없는, 이 파일이 지어낸 이름이다. 화면이나 다른
 * 모듈이 그 문자열을 하드코딩하면 D3·D4 가 합성 코드를 새로 추가할 때마다
 * 그 자리도 같이 고쳐야 한다. 대신 synthesizeError 가 무조건 남기는 표시
 * 하나로 판정하므로, 새 합성 코드도 synthesizeError 를 거쳐서만 만들면 이
 * 함수(와 이 함수를 소비하는 errors.ts)는 전혀 고칠 필요가 없다 - 고칠
 * 자리가 정확히 하나(synthesizeError 자체)로 고정된다.
 *
 * `=== true`로 엄격히 비교한다 - `meta`는 무엇이든 담을 수 있는
 * `Record<string, unknown>`이라, 백엔드가 우연히 `meta.synthetic`에 다른
 * truthy 값(문자열 등)을 담아 보내도 이 함수가 그걸 합성 오류로 오인하지
 * 않게 한다.
 */
export function isSyntheticError(error: ErrorObject): boolean {
  return error.meta?.synthetic === true
}

/**
 * 브라우저가 보낸 `Accept-Language` 를 요청 옵션에 얹는다(스펙 9.2).
 *
 * ## 왜 함수가 필요한가 - `exactOptionalPropertyTypes`
 *
 * `RequestOptions.acceptLanguage` 는 선택 프로퍼티이고 이 저장소는
 * `exactOptionalPropertyTypes: true` 다. 그래서 `{ acceptLanguage: undefined }`
 * 는 **타입 오류**이고, "헤더가 없다"를 표현하려면 키 자체를 빼야 한다.
 * 호출부마다 `...(x !== undefined ? { acceptLanguage: x } : {})` 를 반복하면
 * 그 미묘한 관용구가 여러 벌로 흩어져 한 곳만 틀리는 자리가 생긴다 - 판단을
 * 여기 하나로 모은다.
 *
 * `null` 을 함께 받는 이유는 호출부가 넘기는 값이 항상 헤더 조회 결과이기
 * 때문이다 - `next/headers` 의 `headers().get()` 도 `NextRequest.headers.get()`
 * 도 없으면 `null` 을 준다. 호출부가 `?? undefined` 같은 변환을 하지 않아도
 * 되게 한다.
 *
 * **값을 판단하지 않는다.** 없으면(`null`/`undefined`) 키를 빼고, 있으면
 * 무엇이든 그대로 넘긴다. 빈 문자열도 그대로 간다 - 브라우저가 보낸 헤더를
 * 프론트가 편집하지 않는 것이 스펙 9.2 의 정신이고(문구의 정본은 백엔드다),
 * 백엔드는 빈 값을 기본 언어로 처리한다(정본 `resolve_language` 확인).
 * 유효하지 않은 값이 헤더에 못 들어가는 경우는 `request()` 가 이미
 * `REQUEST_ASSEMBLY_FAILED` 로 다룬다.
 *
 * 이 계층에 두는 이유는 스펙 4장이 `lib/jsonapi/` 에 "HTTP 협상"을 맡기기
 * 때문이다. D3 의 읽기 경로도 같은 함수를 쓴다.
 */
export function withAcceptLanguage(
  options: RequestOptions,
  acceptLanguage: string | null | undefined,
): RequestOptions {
  if (acceptLanguage === null || acceptLanguage === undefined) return options
  return { ...options, acceptLanguage }
}

export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<JsonApiResult<T>> {
  const query = options.query?.toString() ?? ''
  // getSettings() 는 이 try 밖이다 - BACKEND_URL 누락/오설정은 요청마다 달라지는
  // 입력이 아니라 배포 전체에 고정인 설정 오류라, settings.ts 의 의도("시작
  // 실패가 낫다")대로 여기서 조용히 ok:false 로 삼키지 않고 그대로 던지게 둔다.
  // 아래에서 감싸는 대상은 "요청마다 다른, 신뢰할 수 없는 입력"으로 인한 예외뿐이다.
  const url = `${getSettings().backendUrl}${path}${query === '' ? '' : `?${query}`}`

  // 리뷰(라운드 2)가 프로브로 확인했다: JSON.stringify(순환 참조)와
  // headers.set(개행 등 유효하지 않은 값)은 동기적으로 던진다. acceptLanguage 는
  // 스펙 9.2 에 따라 미들웨어가 브라우저의 Accept-Language 를 그대로 전달하는
  // 값이라 D2 연결 이후엔 공격자가 제어하는 입력이다 - 여기서 던지면 이 모듈이
  // 막으려던 흰 페이지가 그대로 재현된다. 그래서 조립 전체를 감싼다.
  let init: RequestInit
  try {
    const headers = new Headers({ accept: JSONAPI_MEDIA_TYPE })
    if (options.accessToken !== undefined) {
      headers.set('authorization', `Bearer ${options.accessToken}`)
    }
    if (options.acceptLanguage !== undefined) {
      headers.set('accept-language', options.acceptLanguage)
    }

    init = {
      method: options.method ?? 'GET',
      headers,
    }
    // cache 를 넘기지 않는다 - 앱의 전역 fetch(SDK 57 의 expo/fetch)는 cache 를 읽지 않고, RN 폴리필
    // (EXPO_PUBLIC_USE_RN_FETCH=1)은 cache 가 no-store·no-cache 인 GET·HEAD 의 URL 끝에 `_=<시각>` 을
    // 붙인다. 어느 쪽이든 캐시 정책은 TanStack Query 가 소유하므로 넘기지 않는다
    // (template-typescript-expo 스펙 8.5). 네이티브 HTTP 캐시(Android OkHttp·iOS URLCache)는
    // 응답 헤더를 따른다(미측정 - D2 가 잰다). signal 은 아래에서 타임아웃과 합쳐 싣는다.
    if (options.body !== undefined) {
      headers.set('content-type', JSONAPI_MEDIA_TYPE)
      init.body = JSON.stringify(options.body)
    }
  } catch (error) {
    // 백엔드 오류 카탈로그와 충돌하지 않도록, 백엔드가 절대 낼 수 없는 상황
    // (요청이 아직 네트워크로 나가기도 전에 실패함)을 가리키는 이름을 새로
    // 만들었다 - NETWORK_ERROR·NON_JSONAPI_RESPONSE 와 같은 선례를 따른다.
    // 네트워크 실패(백엔드에 닿지 못함)와 구별한 이유: 조립 실패는 재시도해도
    // 절대 나아지지 않는 결정론적 실패(입력 자체가 문제)라 네트워크 실패와
    // 원인이 다르다 - 화면/로그가 나중에 이 둘을 다르게 다룰 수 있어야 한다.
    return {
      ok: false,
      status: 0,
      errors: synthesizeError(
        0,
        'REQUEST_ASSEMBLY_FAILED',
        'The request could not be assembled.',
        causeOf(error),
      ),
    }
  }

  // 타임아웃과 호출자 signal 을 컨트롤러 하나로 합친다. 어느 쪽이 끊었는지는 timedOut 이
  // 가른다 - 호출자가 끊은 것은 기존대로 NETWORK_ERROR(본문을 읽는 도중이면
  // NON_JSONAPI_RESPONSE), 시간이 다 된 것은 REQUEST_TIMEOUT.
  const controller = new AbortController()
  let timedOut = false
  const timer: ReturnType<typeof setTimeout> = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, REQUEST_TIMEOUT_MS)
  const callerSignal = options.signal
  const forwardAbort = (): void => {
    controller.abort()
  }
  if (callerSignal !== undefined) {
    if (callerSignal.aborted) controller.abort()
    else callerSignal.addEventListener('abort', forwardAbort, { once: true })
  }
  init.signal = controller.signal

  try {
    return await exchange<T>(url, init, controller.signal, () => timedOut)
  } finally {
    clearTimeout(timer)
    callerSignal?.removeEventListener('abort', forwardAbort)
  }
}

/** 타임아웃으로 끊긴 요청의 결과. 백엔드가 응답하지 못한 것이라 문구를 앱이 갖는다. */
function timeoutResult<T>(cause?: string): JsonApiResult<T> {
  return {
    ok: false,
    status: 0,
    errors: synthesizeError(0, 'REQUEST_TIMEOUT', 'The backend did not respond in time.', cause),
  }
}

/**
 * response.json() 을 요청 signal 과 경주시킨다 - 먼저 끝나는 쪽이 결과다.
 *
 * 취소가 json() 을 거절시켜 준다고 믿을 수 없어서다. expo/fetch 의 json() 은 스트림이 아니라 네이티브
 * text() 를 기다리는데, iOS 에서는 취소가 응답을 .errorReceived 로 만들고 delegate 를 먼저 떼어
 * text() 가 끝나는 상태(.bodyCompleted)로 갈 길이 없다(실측 기록 M6 의 소스 확인). 그러면 헤더를 받은
 * 뒤 본문이 멈춘 요청은 타임아웃이 취소를 걸어도 여기서 끝나지 않고, 스피너가 끝없이 돈다. signal 이
 * 이기면 이 약속은 거절되고, exchange() 의 catch 가 timedOut 으로 REQUEST_TIMEOUT 과
 * NON_JSONAPI_RESPONSE 를 가른다. 취소에 반응하는 런타임(Android)에서도 결과가 같다.
 *
 * Promise.race 가 json() 의 약속에도 처리기를 다는 것에 기댄다 - signal 이 이긴 뒤 늦게 거절돼도
 * 처리되지 않은 거절이 되지 않는다(시험이 고정한다). signal 의 리스너는 어느 쪽이 이기든 거둔다.
 */
async function readJson(response: Response, signal: AbortSignal): Promise<unknown> {
  // 동기로 던져도 async 함수라 거절로 돌아온다(아직 리스너를 달기 전이다).
  const body: Promise<unknown> = response.json()
  let onAbort: () => void = () => undefined
  const aborted = new Promise<never>((_resolve, reject) => {
    onAbort = () => {
      reject(new Error('The request was aborted while reading the response body.'))
    }
  })
  if (signal.aborted) onAbort()
  else signal.addEventListener('abort', onAbort, { once: true })
  try {
    return await Promise.race([body, aborted])
  } finally {
    signal.removeEventListener('abort', onAbort)
  }
}

async function exchange<T>(
  url: string,
  init: RequestInit,
  signal: AbortSignal,
  timedOut: () => boolean,
): Promise<JsonApiResult<T>> {
  let response: Response
  try {
    response = await fetch(url, init)
  } catch (error) {
    if (timedOut()) return timeoutResult(causeOf(error))
    return {
      ok: false,
      status: 0,
      errors: synthesizeError(
        0,
        'NETWORK_ERROR',
        'The backend could not be reached.',
        causeOf(error),
      ),
    }
  }

  if (response.status === 204) {
    // 여기서는 리터럴 204 와 response.status 가 등가 뮤턴트가 아니다(과거
    // 버전과 다르다) - JsonApiResult<T>의 204 분기가 status: 204 를 리터럴
    // 타입으로 선언하므로, response.status(타입 number)를 그대로 넣으면 그
    // 리터럴에 대입할 수 없어 컴파일이 깨진다. document: null 도 더 이상
    // 캐스팅이 아니다 - 이 분기의 실제 선언된 타입이다.
    return { ok: true, status: 204, document: null }
  }

  let parsed: unknown
  try {
    parsed = await readJson(response, signal)
  } catch (error) {
    if (timedOut()) return timeoutResult(causeOf(error))
    return {
      ok: false,
      status: response.status,
      errors: synthesizeError(
        response.status,
        'NON_JSONAPI_RESPONSE',
        'The backend did not return a JSON:API document.',
      ),
    }
  }

  // 상태 코드와 본문이 어긋나면 본문을 믿는다.
  if (isErrorDocument(parsed)) {
    return { ok: false, status: response.status, errors: parsed.errors }
  }

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      errors: synthesizeError(
        response.status,
        'NON_JSONAPI_RESPONSE',
        'The backend returned an error without a JSON:API error document.',
      ),
    }
  }

  return { ok: true, status: response.status, document: parsed as T }
}
