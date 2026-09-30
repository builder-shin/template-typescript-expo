/**
 * 인증 폼(가입·로그인)의 화면 상태와 입력 이름 - Task 5.
 *
 * ## 이 파일이 따로 있는 이유는 클라이언트 번들 경계다
 *
 * 이 모듈은 **런타임 import 가 하나도 없다.** 아래 두 상수와 상태 모양은
 * `app/(auth)/credentials-form.tsx`(`'use client'`)가 써야 하는데, 같은 것을
 * `lib/auth/flow.ts`나 `lib/auth/credentials.ts`에 두면 클라이언트 컴포넌트가
 * 그 파일을 import 하는 순간 `lib/jsonapi/client.ts` -> `lib/config/settings.ts`
 * (process.env 를 읽는 서버 전용 코드)까지 브라우저 번들 그래프에 끌려 들어간다.
 * 타입만 쓰는 것(`import type`)은 지워지지만 `IDLE_AUTH_FORM_STATE`·
 * `EMAIL_FIELD`는 값이라 지워지지 않는다 - 그래서 값들만 여기로 뺐다.
 *
 * **이 파일에 import 를 추가하지 마라.** 추가하는 순간 위 경계가 무너지고,
 * 그 사실은 빌드가 통과하기 때문에 조용히 일어난다.
 */

/**
 * 입력의 `name`, `FormData` 에서 읽는 키, JSON:API `attributes` 의 키,
 * 그리고 오류를 되돌릴 때 `groupErrors().attributes` 에서 찾는 키가 **전부
 * 이 상수 하나**다.
 *
 * 넷이 같아야 하는 것은 우연이 아니라 계약이다 - 백엔드는 검증 오류에
 * `source.pointer = /data/attributes/email`을 실어 보내고(실측), errors.ts 의
 * placeError 가 그 마지막 세그먼트를 그대로 필드 이름으로 쓴다. 넷 중 하나만
 * 어긋나면 오류가 엉뚱한 입력 아래 그려지거나 아예 사라지는데, 그 어긋남은
 * 타입 검사로도 빌드로도 드러나지 않는다.
 */
export const EMAIL_FIELD = 'email'
export const PASSWORD_FIELD = 'password'

/**
 * 인증 폼 하나의 화면 상태. `useActionState` 가 Server Action 의 반환값으로
 * 이 모양을 그대로 받는다.
 */
export interface AuthFormState {
  /** 상단 배너에 그릴 문구들. 스펙 9.1 의 "문서 오류"가 여기로 온다. */
  documentErrors: string[]
  /**
   * 입력 이름 -> 그 입력 아래 그릴 문구들.
   *
   * 값이 배열인 것은 실측 때문이다 - 검증 오류는 한 응답에 여러 개가 함께
   * 온다(정본 백엔드에서 email·password 두 개를 한 번에 받았다). 한 필드에
   * 여러 개가 오는 것은 auth 엔드포인트에서는 재현하지 못했지만
   * (pydantic 이 필드당 첫 실패에서 멈춘다), groupErrors 의 반환 타입이
   * 배열이고 D3·D4 의 자원 폼은 다를 수 있으므로 배열 그대로 그린다.
   */
  fieldErrors: Record<string, string[]>
  /**
   * 제출된 이메일. 실패했을 때 입력에 되돌려 준다.
   *
   * **실측으로 드러난 결함을 고치기 위해 있다.** React 19 는
   * `<form action={...}>` 이 끝나면 폼을 초기화하고, 무JS 경로에서는 서버가
   * 폼을 처음부터 다시 그린다 - 어느 쪽이든 오류가 나면 사용자가 입력한
   * 값이 전부 사라진다. 실제로 브라우저와 curl 양쪽에서 확인했다(오류 응답의
   * `<input name="email">` 에 `value` 속성이 아예 없었다).
   *
   * **비밀번호는 일부러 담지 않는다.** 담으면 평문 비밀번호가 응답 HTML 과
   * RSC 페이로드에 실려 나가고, 그 응답은 프록시·브라우저 캐시·개발자 도구에
   * 남는다. 이메일 하나만 되돌려도 재입력 부담의 대부분이 사라진다.
   */
  submittedEmail: string
  /**
   * **가입에서만** true 가 될 수 있다 - 계정 생성(201)은 성공했는데 이어지는
   * 로그인이 실패한 상태다(스펙 7.4 의 두 번째 호출). 이 상태에서 가입 폼을
   * 다시 제출하면 409 EMAIL_ALREADY_REGISTERED 가 나는 막다른 길이므로,
   * 화면은 이 값이 true 일 때 "로그인으로 가라"를 안내해야 한다.
   *
   * 로그인 폼에서는 항상 false 다.
   */
  accountCreated: boolean
}

/** 아직 제출하지 않은 폼의 상태. `useActionState` 의 초기값이다. */
export const IDLE_AUTH_FORM_STATE: AuthFormState = {
  documentErrors: [],
  fieldErrors: {},
  submittedEmail: '',
  accountCreated: false,
}

/**
 * 상태를 만들 때 오류 배열 말고 함께 필요한 것들.
 *
 * 위치 인자로 늘어놓지 않고 객체로 묶은 이유: 둘 다 "실패했을 때 폼에
 * 무엇을 남길지"라는 한 가지 관심사이고, `boolean` 과 `string` 을 나란히
 * 놓으면 호출부에서 순서를 바꿔도 타입이 잡아 주지 못하는 조합이 생긴다.
 */
export interface AuthFormContext {
  email: string
  accountCreated: boolean
}

/**
 * 프론트가 자기 문구를 갖는 유일한 경우(스펙 9.2) - 백엔드가 **쓸 수 있는
 * 답을 주지 못했을 때**다. 둘을 한 문구로 묶는다:
 *
 * 1. `transport` - 요청이 백엔드에 닿지도 못했다(client.ts 가 합성한 오류).
 * 2. 계약 위반 - 2xx 인데 토큰 문서가 없거나, 오류 문서인데 문구가 하나도 없다.
 *
 * 사용자 입장에서 둘은 같다("지금은 안 된다, 이따 다시"). 구별이 필요한 쪽은
 * 개발자이고 그 재료는 `meta.cause`(client.ts)와 로그에 남는다.
 *
 * `app/error.tsx` 의 문구를 재사용하지 않는 이유: 저쪽은 화면이 통째로
 * 바뀐 뒤의 문구("백엔드에 연결할 수 없습니다")이고 여기는 사용자가 입력한
 * 값을 그대로 들고 폼에 머무는 상황이다 - 다시 시도할 대상이 다르다.
 */
export const UNUSABLE_RESPONSE_MESSAGE =
  '지금은 요청을 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.'

export function unusableResponseState(context: AuthFormContext): AuthFormState {
  return {
    documentErrors: [UNUSABLE_RESPONSE_MESSAGE],
    fieldErrors: {},
    submittedEmail: context.email,
    accountCreated: context.accountCreated,
  }
}
