/**
 * 가입·로그인 흐름의 **판단** 전부 - Task 5.
 *
 * `app/(auth)/actions.ts` 는 Server Action 이라 단위 테스트에서 부를 수 없다
 * (next/headers 의 cookies() 와 next/navigation 의 redirect() 가 요청 스코프를
 * 요구한다). 그래서 rotation.ts 가 proxy.ts 에 대해 한 것과 같은 분리를 한다 -
 * "무엇을 할지"는 전부 이 파일의 순수 함수가 정하고, Action 은 그 결정을
 * 기계적으로 실행하는 세 줄만 갖는다.
 *
 * 이 분리가 이 태스크에서 특히 중요한 이유: **오픈 리다이렉트 가드가 여기
 * 있다.** 가드를 Action 안에 두면 이 저장소의 테스트 계층으로는 그것이
 * 동작하는지 잴 방법이 아예 없다.
 */

import type { ErrorObject } from '@/lib/jsonapi/document'
import { actionForErrors, groupErrors, type FieldErrors } from '@/lib/jsonapi/errors'
import type { RegistrationOutcome, SignInOutcome } from './credentials'
import { unusableResponseState, type AuthFormContext, type AuthFormState } from './form-state'
import type { Session } from './tokens'

/** `next` 파라미터가 없거나 믿을 수 없을 때 로그인 후 보내는 곳. */
export const DEFAULT_POST_LOGIN_PATH = '/'

/**
 * URL 파싱기가 **제거해 버리는** 문자들이 있다 - ASCII 탭(0x09) · LF(0x0A) ·
 * CR(0x0D). 그래서 `"/" + TAB + "/evil.example"` 은 브라우저에서
 * `"//evil.example"` 로 변해 외부 origin 이 된다. 아래 startsWith 검사만으로는
 * 이 우회를 못 막는다.
 *
 * 셋만이 아니라 C0 제어문자 전체와 DEL 을 막는다 - 셋을 열거하면 파싱기가
 * 하나를 더 무시하게 바뀔 때 조용히 뚫린다. 정규식 대신 코드포인트로 도는
 * 이유는 eslint 의 no-control-regex 를 끄지 않기 위해서다.
 */
function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0
    if (code <= 0x1f || code === 0x7f) return true
  }
  return false
}

/**
 * 로그인 후 돌아갈 경로를 **검사한다** - 오픈 리다이렉트 가드.
 *
 * `next` 는 URL 쿼리에서 오고(proxy.ts 가 붙인다, LOGIN_REDIRECT_PARAM),
 * 그 URL 은 공격자가 통째로 만들어 피해자에게 보낼 수 있다. 검사 없이
 * redirect() 에 넘기면 "우리 도메인의 진짜 로그인 화면에서 로그인했더니
 * 공격자 사이트로 갔다"가 성립한다 - 피싱의 신뢰 사다리다.
 *
 * **허용 목록 방식이다.** "나쁜 것을 지운다"가 아니라 "이 모양만 통과시킨다":
 *
 *   - 문자열이어야 한다        (배열·File·undefined 는 전부 거절)
 *   - `/` 로 시작해야 한다     (`https://evil` · `javascript:` 등 스킴 전부 거절)
 *   - 두 번째 글자가 `/`도 `\`도 아니어야 한다
 *       `//evil.example` 은 프로토콜 상대 URL 이라 외부로 나간다.
 *       `/\evil.example` 은 브라우저가 `\`를 `/`로 정규화해 같은 결과가 된다.
 *   - 제어문자가 없어야 한다   (위 hasControlCharacter 주석)
 *
 * 통과하지 못하면 `fallback` 이다 - 던지지 않는다. 이 값은 사용자가 타이핑한
 * 것이 아니라 링크에 실려 온 것이라, 공격이든 오타든 사용자에게 보여 줄
 * 오류가 아니다. 조용히 홈으로 보내는 것이 옳다.
 *
 * `%2f%2fevil.example` 처럼 퍼센트 인코딩된 슬래시는 막지 않는다 - 브라우저는
 * 경로의 `%2f` 를 origin 결정에 쓰지 않으므로 같은 출처의 경로로 남는다.
 *
 * **검사는 이 함수 한 곳에서만 한다.** 페이지가 렌더할 때 한 번 더 거르고
 * 싶은 유혹이 있지만 그러지 않았다 - 두 곳에서 걸러 두면 어느 쪽이 진짜
 * 가드인지 테스트가 구별하지 못하고(한 곳을 지워도 다른 곳이 덮어 준다),
 * 정작 redirect() 에 값을 넘기는 자리는 여기(decideAfterSignIn)뿐이다.
 * 페이지는 쿼리에서 받은 값을 **날것 그대로** Action 에 bind 한다.
 */
export function safeRedirectTarget(
  raw: unknown,
  fallback: string = DEFAULT_POST_LOGIN_PATH,
): string {
  if (typeof raw !== 'string') return fallback
  if (!raw.startsWith('/')) return fallback
  if (raw.startsWith('//') || raw.startsWith('/\\')) return fallback
  if (hasControlCharacter(raw)) return fallback
  return raw
}

/**
 * 인증 화면끼리 오갈 때(로그인 <-> 가입) `next` 를 잃지 않게 하는 href.
 *
 * proxy.ts 가 `/login?next=/examples/new` 로 보냈는데 거기서 "가입"을 눌러
 * `/register` 로 가면 파라미터가 사라져, 가입에 성공해도 홈으로 떨어진다.
 *
 * 파라미터 이름을 인자로 받는다 - 이 파일이 `@/proxy` 를 import 하면
 * lib/ 가 라우팅 계층을 거꾸로 의존하게 되고(스펙 4장), 테스트도 실전과
 * 같은 `'next'` 문자열로만 이 함수를 잴 수 있게 되어 "상수를 썼는가"와
 * "문자열을 박았는가"를 구별하지 못한다.
 */
export function authLinkHref(path: string, rawNext: unknown, param: string): string {
  const target = safeRedirectTarget(rawNext)
  if (target === DEFAULT_POST_LOGIN_PATH) return path
  return `${path}?${encodeURIComponent(param)}=${encodeURIComponent(target)}`
}

function isEmpty(grouped: FieldErrors): boolean {
  return (
    grouped.document.length === 0 &&
    Object.keys(grouped.attributes).length === 0 &&
    Object.keys(grouped.relationships).length === 0
  )
}

/**
 * 오류 배열을 폼 화면 상태로 바꾼다 - 스펙 9.1 의 두 갈래 분류를 그대로 쓴다.
 *
 * ## 401 INVALID_CREDENTIALS 와 409 EMAIL_ALREADY_REGISTERED 를 어디 그리나
 *
 * **둘 다 상단 배너다.** 그런데 이 파일은 그 두 코드를 알지 못한다 - 알
 * 필요가 없어서다. 실측: 둘 다 `source` 가 없는 오류라 errors.ts 의
 * placeError 가 이미 "문서 오류"로 분류하고 groupErrors 가 document 배열에
 * 넣는다. 즉 일반 경로가 이미 옳은 자리에 그린다.
 *
 * **코드 문자열로 분기해 401 을 비밀번호 입력 아래로 옮기지 마라.** 백엔드가
 * 어느 필드가 틀렸는지 알려주지 않는 것은 누락이 아니라 의도된 보안 동작이고
 * (계정 열거 방지), 프론트가 "이건 비밀번호 오류다"라고 지어내면 백엔드가
 * 감춘 것을 화면이 복원해 버린다. 409 도 같다 - "이메일 필드로 옮기자"가
 * 자연스러워 보이지만, 그러려면 코드 문자열 -> 필드 이름 카탈로그를 프론트에
 * 두 벌째 만들어야 하고(스펙 9.2 가 금지한다) 백엔드가 코드를 바꾸면 조용히
 * 썩는다.
 *
 * ## transport 는 code 문자열이 아니라 actionForErrors 로 판정한다
 *
 * `NETWORK_ERROR` 같은 이름은 client.ts 가 지어낸 것이라 화면이 그 문자열로
 * 분기하면 D3·D4 가 합성 코드를 추가할 때 이 자리도 같이 고쳐야 한다.
 *
 * ## relationships 오류는 배너로 접는다
 *
 * 인증 폼에는 관계 입력이 없다. 그런데 groupErrors 는 세 갈래를 다 돌려주므로
 * relationships 를 안 읽으면 그 문구가 **소리 없이 사라진다** - 사용자는 폼이
 * 거절당했는데 아무 설명도 못 본다. 그릴 자리가 없으면 배너가 옳다.
 */
export function authFormStateFromErrors(
  errors: readonly ErrorObject[],
  context: AuthFormContext,
): AuthFormState {
  if (actionForErrors(errors) === 'transport') return unusableResponseState(context)

  const grouped = groupErrors(errors)
  // 오류를 받았는데 문구가 하나도 없다(예: `{"errors":[{}]}` - client.ts 의
  // isErrorDocument 는 이것을 통과시킨다). 빈 배너를 그리면 사용자는 폼이
  // 왜 거절됐는지 알 수 없으므로 "쓸 수 없는 응답"으로 취급한다.
  if (isEmpty(grouped)) return unusableResponseState(context)

  return {
    documentErrors: [...grouped.document, ...Object.values(grouped.relationships).flat()],
    fieldErrors: grouped.attributes,
    submittedEmail: context.email,
    accountCreated: context.accountCreated,
  }
}

export type SignInPlan =
  /** 쿠키를 쓰고 `to` 로 보낸다. */
  | { kind: 'establish'; to: string; session: Session; refreshExpiresIn: number }
  | { kind: 'state'; state: AuthFormState }

/**
 * 로그인 응답 뒤에 무엇을 할지 - **가입 흐름의 두 번째 호출도 이 함수를 쓴다.**
 *
 * `context.accountCreated` 로 두 흐름이 갈린다. 가입에서 계정 생성(201)까지 성공한
 * 뒤 로그인이 실패하면 계정은 이미 존재한다 - 이 값이 true 로 실려 화면이
 * "가입은 됐다, 로그인 화면으로 가라"를 안내한다.
 *
 * **가입의 두 번째 호출이 실패하면 어떻게 하나(브리핑이 판단을 요구한 것).**
 * 가입 폼에 머물면서 백엔드 문구를 배너에 그리고, 계정이 만들어졌다는 사실을
 * 함께 알린다. 다른 두 후보를 버린 이유:
 *
 *   - **그냥 로그인 화면으로 보낸다**: 사용자는 왜 거기 있는지 모른다.
 *     실패 원인이 백엔드 장애면 거기서 다시 실패하는데, 그때는 "가입이 됐는지"
 *     조차 알 수 없어 같은 이메일로 가입을 재시도하다 409 를 만난다.
 *   - **가입 실패로 취급한다**: 가장 나쁘다. 재제출하면 409
 *     EMAIL_ALREADY_REGISTERED 가 나는 막다른 길로 사용자를 몰아넣는다.
 *
 * 실측으로 확인한 것: 이 두 번째 호출이 자격증명 때문에 실패할 수는 사실상
 * 없다 - 정본이 register 와 login 에 **같은 CredentialsAttributes 스키마**를
 * 쓰므로 register 를 통과한 값은 login 검증도 통과하고, 방금 만든 계정은
 * isActive:true 다. 현실적인 실패 원인은 두 호출 사이의 네트워크·백엔드
 * 장애(transport)다 - 그래서 "계정은 만들어졌다"를 알리는 것이 실질적으로
 * 유일하게 필요한 정보다.
 *
 * "계정이 만들어졌다"는 문구는 스펙 9.2 의 위반이 아니다 - 백엔드 오류
 * 카탈로그를 복제한 것이 아니라, **두 호출 중 어디까지 갔는지**라는 프론트
 * 쪽 흐름의 사실이다. 백엔드는 이 사실을 표현하는 오류를 애초에 갖고 있지 않다.
 */
export function decideAfterSignIn(
  outcome: SignInOutcome,
  rawNext: unknown,
  context: AuthFormContext,
): SignInPlan {
  if (outcome.kind === 'signedIn') {
    return {
      kind: 'establish',
      to: safeRedirectTarget(rawNext),
      session: outcome.session,
      refreshExpiresIn: outcome.refreshExpiresIn,
    }
  }
  if (outcome.kind === 'malformed') {
    return { kind: 'state', state: unusableResponseState(context) }
  }
  return { kind: 'state', state: authFormStateFromErrors(outcome.errors, context) }
}

/**
 * 로그인 화면의 진입점 - `app/(auth)/actions.ts` 가 부르는 것.
 *
 * 하는 일은 `accountCreated: false` 를 정하는 것뿐이지만, 그 판단이 여기
 * 있어야 하는 이유가 있다. Action 안에 `{ email, accountCreated: false }` 를
 * 직접 쓰면 그 값을 `true` 로 바꾸는 뮤테이션이 아무 테스트도 못 죽인다
 * (Action 은 이 저장소의 테스트 계층에서 부를 수 없다). 리뷰 RM4 가
 * 가입 쪽에서 정확히 그것을 확인했다 - 0개 실패.
 *
 * **로그인 흐름은 계정을 만들지 않는다.** 그래서 이 흐름의 실패 상태는
 * "계정은 만들어졌습니다" 안내를 절대 띄우면 안 된다.
 */
export function decideAfterLogin(
  outcome: SignInOutcome,
  rawNext: unknown,
  email: string,
): SignInPlan {
  return decideAfterSignIn(outcome, rawNext, { email, accountCreated: false })
}

/**
 * 가입 화면의 진입점 - 스펙 7.4 의 두 호출을 하나의 결정으로 접는다.
 *
 * 두 갈래에서 `accountCreated` 가 갈리는 것이 이 함수의 전부이고, 그것이
 * 사용자에게 보이는 차이를 만든다:
 *
 * - `signUpRejected`(409·422 등) → **false**. 계정이 안 만들어졌는데
 *   "가입은 됐다"를 띄우면 거짓말이고, 사용자를 로그인 화면으로 보내면
 *   거기서도 실패한다.
 * - `signedUp` 인데 로그인이 실패 → **true**. 계정은 있으므로 이 폼을 다시
 *   제출하면 409 가 나는 막다른 길이다(decideAfterSignIn 주석).
 */
export function decideAfterRegistration(
  outcome: RegistrationOutcome,
  rawNext: unknown,
  email: string,
): SignInPlan {
  if (outcome.kind === 'signUpRejected') {
    return {
      kind: 'state',
      state: authFormStateFromErrors(outcome.errors, { email, accountCreated: false }),
    }
  }
  return decideAfterSignIn(outcome.signIn, rawNext, { email, accountCreated: true })
}
