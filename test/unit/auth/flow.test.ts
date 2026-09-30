import { describe, expect, it } from 'vitest'
import type { ErrorObject } from '@/lib/jsonapi/document'
import {
  DEFAULT_POST_LOGIN_PATH,
  authFormStateFromErrors,
  authLinkHref,
  decideAfterSignIn,
  decideAfterLogin,
  decideAfterRegistration,
  safeRedirectTarget,
} from '@/lib/auth/flow'
import { IDLE_AUTH_FORM_STATE, UNUSABLE_RESPONSE_MESSAGE } from '@/lib/auth/form-state'
import type { Session } from '@/lib/auth/tokens'

/**
 * lib/auth/flow.ts 는 Task 5 의 판단 전부를 갖는다 - Server Action 은 이
 * 판단을 실행하기만 한다. 즉 이 파일이 Task 5 의 실질적인 가드다.
 *
 * ## 픽스처 값을 실전값과 다르게 잡은 이유
 *
 * 이 저장소에서 반복해서 나온 결함이 "테스트가 구별해야 할 두 세계가 우연히
 * 동일한" 경우다. 그래서 여기서는 이 흐름을 통과하는 모든 값을 실전에서
 * 절대 나오지 않는 값으로 고정한다:
 *
 *   - 필드 이름은 `probeAlpha` 등 - `email`/`password` 를 쓰면 "pointer 에서
 *     계산했다"와 "필드 목록을 박아 뒀다"가 구별되지 않는다.
 *   - 합성 오류의 code 는 `PROBE_SYNTHETIC` - client.ts 의 실제 세 코드
 *     (NETWORK_ERROR 등)를 쓰면 "meta.synthetic 으로 판정했다"와 "코드
 *     문자열로 분기했다"가 구별되지 않는다. 코드 문자열 분기 금지가 Task 4
 *     가 세운 계약이므로 이 구별이 이 파일에서 가장 중요하다.
 *   - expiresIn 과 refreshExpiresIn 은 서로 다른 값이고 둘 다 실전값
 *     (900 / 2592000)이 아니다 - 한쪽을 다른 쪽 자리에 배선해도 초록이 되는
 *     사고를 Task 3 이 실제로 겪었다.
 *   - fallback 도 인자로 넘겨 실전 기본값('/')과 다르게 둔다.
 */

const PROBE_FALLBACK = '/probe-fallback'
const PROBE_TARGET = '/probe-target?probe=1'

const PROBE_SESSION: Session = {
  accessToken: 'probe-access-token',
  refreshToken: 'probe-refresh-token',
  accessExpiresAt: 1_234_567_890_123,
}
/** 실전 refreshExpiresIn 은 2592000, expiresIn 은 900 이다. 둘 다 아니다. */
const PROBE_REFRESH_EXPIRES_IN = 8641
/** 되돌려 줄 이메일. 아래 어떤 오류 문구·필드 이름과도 겹치지 않는 값이다. */
const PROBE_SUBMITTED_EMAIL = 'probe-submitted@probe.invalid'

function ctx(accountCreated: boolean) {
  return { email: PROBE_SUBMITTED_EMAIL, accountCreated }
}

function attributeError(field: string, detail: string): ErrorObject {
  return {
    status: '422',
    code: 'VALIDATION_ERROR',
    title: 'probe-title',
    detail,
    source: { pointer: `/data/attributes/${field}` },
  }
}

/** source 가 없는 오류 - 실측: 401 INVALID_CREDENTIALS·409 EMAIL_ALREADY_REGISTERED 가 이 모양이다. */
function documentError(code: string, detail: string): ErrorObject {
  return { status: '401', code, title: 'probe-title', detail }
}

/**
 * client.ts 가 합성한 오류의 모양. **code 를 실제 세 코드가 아닌 것으로 둔다** -
 * 판정 근거가 code 문자열이 아니라 `meta.synthetic` 임을 이 픽스처가 강제한다.
 */
function syntheticError(detail: string): ErrorObject {
  return {
    status: '0',
    code: 'PROBE_SYNTHETIC',
    title: 'PROBE_SYNTHETIC',
    detail,
    meta: { cause: 'probe cause', synthetic: true },
  }
}

describe('safeRedirectTarget - 오픈 리다이렉트 가드', () => {
  it('같은 출처의 경로는 쿼리까지 그대로 통과시킨다', () => {
    expect(safeRedirectTarget(PROBE_TARGET, PROBE_FALLBACK)).toBe(PROBE_TARGET)
    expect(safeRedirectTarget('/probe/deep/path#probe', PROBE_FALLBACK)).toBe(
      '/probe/deep/path#probe',
    )
    expect(safeRedirectTarget('/', PROBE_FALLBACK)).toBe('/')
  })

  it('절대 URL 은 거절한다 - 이것이 이 가드의 존재 이유다', () => {
    expect(safeRedirectTarget('https://evil.example/', PROBE_FALLBACK)).toBe(PROBE_FALLBACK)
    expect(safeRedirectTarget('http://evil.example/probe', PROBE_FALLBACK)).toBe(PROBE_FALLBACK)
    // 우리 호스트를 앞에 세워도 거절한다 - 호스트 비교를 시작하는 순간
    // `http://localhost.evil.example` 같은 접두사 속임수를 다시 막아야 한다.
    expect(safeRedirectTarget('http://localhost/probe', PROBE_FALLBACK)).toBe(PROBE_FALLBACK)
  })

  it('프로토콜 상대 URL(//host)을 거절한다', () => {
    // `//evil.example` 은 스킴이 없어 "경로처럼" 보이지만 브라우저는 외부
    // 출처로 해석한다 - startsWith('/') 검사만 있으면 그대로 통과한다.
    expect(safeRedirectTarget('//evil.example/', PROBE_FALLBACK)).toBe(PROBE_FALLBACK)
    expect(safeRedirectTarget('//evil.example', PROBE_FALLBACK)).toBe(PROBE_FALLBACK)
  })

  it('역슬래시 변형(/\\host)을 거절한다', () => {
    // 브라우저가 URL 의 역슬래시를 슬래시로 정규화하므로 위 //host 와 같아진다.
    expect(safeRedirectTarget('/\\evil.example/', PROBE_FALLBACK)).toBe(PROBE_FALLBACK)
    expect(safeRedirectTarget('/\\\\evil.example', PROBE_FALLBACK)).toBe(PROBE_FALLBACK)
  })

  it('URL 파싱기가 제거하는 제어문자로 //host 를 만드는 우회를 거절한다', () => {
    // "/" + TAB + "/evil.example" 은 파싱 단계에서 TAB 이 사라져 "//evil.example"
    // 이 된다 - 위 두 검사만으로는 절대 못 막는다.
    expect(safeRedirectTarget('/\t/evil.example', PROBE_FALLBACK)).toBe(PROBE_FALLBACK)
    expect(safeRedirectTarget('/\n/evil.example', PROBE_FALLBACK)).toBe(PROBE_FALLBACK)
    expect(safeRedirectTarget('/\r/evil.example', PROBE_FALLBACK)).toBe(PROBE_FALLBACK)
  })

  it('제어문자 범위의 양 끝(0x00·0x1f)과 DEL(0x7f)도 거절한다', () => {
    // 경계값이다 - `code <= 0x1f` 를 `code < 0x1f` 로, `code === 0x7f` 를
    // 지우는 뮤테이션이 위 TAB/LF/CR 테스트만으로는 살아남는다.
    expect(safeRedirectTarget('/probe\u0000path', PROBE_FALLBACK)).toBe(PROBE_FALLBACK)
    expect(safeRedirectTarget('/probe\u001fpath', PROBE_FALLBACK)).toBe(PROBE_FALLBACK)
    expect(safeRedirectTarget('/probe\u007fpath', PROBE_FALLBACK)).toBe(PROBE_FALLBACK)
    // 공백(0x20)은 제어문자가 아니라 통과한다 - 브라우저가 퍼센트 인코딩할 뿐
    // 제거하지 않으므로 //host 를 만들 수 없다. 범위를 0x20 까지 넓히는
    // 뮤테이션은 이 단언이 잡는다.
    expect(safeRedirectTarget('/probe path', PROBE_FALLBACK)).toBe('/probe path')
  })

  it('슬래시로 시작하지 않는 값(스킴·상대 경로)을 거절한다', () => {
    expect(safeRedirectTarget('javascript:alert(1)', PROBE_FALLBACK)).toBe(PROBE_FALLBACK)
    expect(safeRedirectTarget('data:text/html,probe', PROBE_FALLBACK)).toBe(PROBE_FALLBACK)
    expect(safeRedirectTarget('evil.example', PROBE_FALLBACK)).toBe(PROBE_FALLBACK)
    expect(safeRedirectTarget('probe/relative', PROBE_FALLBACK)).toBe(PROBE_FALLBACK)
    expect(safeRedirectTarget('', PROBE_FALLBACK)).toBe(PROBE_FALLBACK)
  })

  it('문자열이 아닌 값을 거절한다 - FormData·searchParams 는 배열도 File 도 준다', () => {
    expect(safeRedirectTarget(undefined, PROBE_FALLBACK)).toBe(PROBE_FALLBACK)
    expect(safeRedirectTarget(null, PROBE_FALLBACK)).toBe(PROBE_FALLBACK)
    // `?next=/a&next=/b` 는 searchParams 에서 배열로 온다 - 어느 쪽인지
    // 모호하면 고르지 않는다.
    expect(safeRedirectTarget(['/probe-a', '/probe-b'], PROBE_FALLBACK)).toBe(PROBE_FALLBACK)
    expect(safeRedirectTarget(new Blob(['probe']), PROBE_FALLBACK)).toBe(PROBE_FALLBACK)
  })

  it('fallback 인자를 실제로 쓴다', () => {
    // 이 테스트가 없으면 "항상 '/' 를 돌려준다"는 뮤테이션이 위 거절
    // 테스트들을 전부 통과할 수 있다(실전 기본값이 '/'라서).
    expect(safeRedirectTarget('https://evil.example/', PROBE_FALLBACK)).toBe(PROBE_FALLBACK)
    expect(safeRedirectTarget('https://evil.example/', '/probe-other')).toBe('/probe-other')
  })

  it('fallback 을 생략하면 DEFAULT_POST_LOGIN_PATH 다', () => {
    expect(safeRedirectTarget('https://evil.example/')).toBe(DEFAULT_POST_LOGIN_PATH)
    expect(DEFAULT_POST_LOGIN_PATH).toBe('/')
  })
})

describe('authLinkHref - 인증 화면끼리 next 를 잃지 않는다', () => {
  it('파라미터 이름을 인자로 받은 것 그대로 쓴다', () => {
    // 실전 이름('next')이 아닌 값으로 잰다 - 실전 이름으로 재면 함수 안에
    // 문자열을 박아 넣어도 통과한다.
    expect(authLinkHref('/probe-path', '/probe-target', 'probeParam')).toBe(
      '/probe-path?probeParam=%2Fprobe-target',
    )
  })

  it('대상을 인코딩한다 - 쿼리가 섞인 경로가 링크의 쿼리를 오염시키지 않는다', () => {
    expect(authLinkHref('/probe-path', PROBE_TARGET, 'probeParam')).toBe(
      '/probe-path?probeParam=%2Fprobe-target%3Fprobe%3D1',
    )
  })

  it('돌아갈 곳이 없으면 파라미터를 붙이지 않는다', () => {
    expect(authLinkHref('/probe-path', undefined, 'probeParam')).toBe('/probe-path')
  })

  it('공격 값이 링크에 실려 다음 화면으로 옮겨 가지 않는다', () => {
    const href = authLinkHref('/probe-path', 'https://evil.example/', 'probeParam')
    expect(href).toBe('/probe-path')
    expect(href).not.toContain('evil.example')
  })
})

describe('authFormStateFromErrors - 스펙 9.1 의 두 갈래', () => {
  it('source.pointer 가 가리키는 필드 아래로 보낸다', () => {
    const state = authFormStateFromErrors(
      [attributeError('probeAlpha', 'probe-alpha-message')],
      ctx(false),
    )
    expect(state.fieldErrors).toEqual({ probeAlpha: ['probe-alpha-message'] })
    expect(state.documentErrors).toEqual([])
  })

  it('같은 필드에 여러 개가 오면 순서대로 전부 담는다', () => {
    const state = authFormStateFromErrors(
      [attributeError('probeAlpha', 'probe-first'), attributeError('probeAlpha', 'probe-second')],
      ctx(false),
    )
    expect(state.fieldErrors).toEqual({ probeAlpha: ['probe-first', 'probe-second'] })
  })

  it('여러 필드가 한 번에 온다 - 실측된 모양을 그대로 재현한다', () => {
    // 실측(정본 FastAPI, 2026-09-06): 빈 자격증명으로 로그인하면 email 과
    // password 두 개가 한 응답에 함께 왔다. 여기서만 실전 필드 이름을 쓴다 -
    // 계약을 문서화하는 테스트이고, 배선은 위 probeAlpha 테스트가 잰다.
    const state = authFormStateFromErrors(
      [
        attributeError('email', 'probe-email-message'),
        attributeError('password', 'probe-password-message'),
      ],
      ctx(false),
    )
    expect(state.fieldErrors).toEqual({
      email: ['probe-email-message'],
      password: ['probe-password-message'],
    })
  })

  it('source 가 없는 오류는 배너로 간다 - 401·409 의 배치 결정', () => {
    // 실측: 401 INVALID_CREDENTIALS 도 409 EMAIL_ALREADY_REGISTERED 도
    // source 를 싣지 않는다. 어느 입력 아래에도 그리지 않는 것이 결정이다.
    const state = authFormStateFromErrors(
      [
        documentError('INVALID_CREDENTIALS', 'probe-credentials-message'),
        documentError('EMAIL_ALREADY_REGISTERED', 'probe-conflict-message'),
      ],
      ctx(false),
    )
    expect(state.documentErrors).toEqual(['probe-credentials-message', 'probe-conflict-message'])
    // 비밀번호/이메일 입력 아래로 "친절하게" 옮기지 않는다는 것이 요점이다.
    expect(state.fieldErrors).toEqual({})
  })

  it('필드 이름이 없는 pointer 도 배너로 간다 - 실측된 /data/attributes·/data/type', () => {
    const state = authFormStateFromErrors(
      [
        {
          status: '422',
          code: 'VALIDATION_ERROR',
          detail: 'probe-no-field',
          source: { pointer: '/data/attributes' },
        },
        {
          status: '422',
          code: 'VALIDATION_ERROR',
          detail: 'probe-type',
          source: { pointer: '/data/type' },
        },
      ],
      ctx(false),
    )
    expect(state.documentErrors).toEqual(['probe-no-field', 'probe-type'])
    expect(state.fieldErrors).toEqual({})
  })

  it('relationships 오류는 사라지지 않고 배너로 접힌다', () => {
    // 인증 폼에는 관계 입력이 없다. 안 읽으면 사용자는 거절당한 이유를
    // 전혀 못 본다.
    const state = authFormStateFromErrors(
      [
        {
          status: '422',
          code: 'VALIDATION_ERROR',
          detail: 'probe-doc',
          source: { parameter: 'probe' },
        },
        {
          status: '422',
          code: 'VALIDATION_ERROR',
          detail: 'probe-relation',
          source: { pointer: '/data/relationships/probeRelation' },
        },
      ],
      ctx(false),
    )
    expect(state.documentErrors).toEqual(['probe-doc', 'probe-relation'])
    expect(state.fieldErrors).toEqual({})
  })

  it('transport 는 code 문자열이 아니라 합성 표시로 판정하고 프론트 문구를 쓴다', () => {
    // code 가 NETWORK_ERROR 등 실제 합성 코드가 **아닌데도** transport 로
    // 잡혀야 한다 - 그래야 D3·D4 가 새 합성 코드를 추가해도 이 자리가
    // 안 깨진다(Task 4 가 세운 계약).
    const state = authFormStateFromErrors(
      [syntheticError('The backend could not be reached.')],
      ctx(false),
    )
    expect(state.documentErrors).toEqual([UNUSABLE_RESPONSE_MESSAGE])
    // client.ts 의 고정 영어 문구가 한국어 화면에 새지 않는다.
    expect(state.documentErrors.join()).not.toContain('backend')
    expect(state.fieldErrors).toEqual({})
  })

  it('백엔드가 낸 진짜 오류는 transport 로 오인하지 않는다 - 음성 대조군', () => {
    const state = authFormStateFromErrors(
      [attributeError('probeAlpha', 'probe-alpha-message')],
      ctx(false),
    )
    expect(state.fieldErrors).toEqual({ probeAlpha: ['probe-alpha-message'] })
    expect(state.documentErrors).not.toContain(UNUSABLE_RESPONSE_MESSAGE)
  })

  it('문구가 하나도 없는 오류 배열이면 빈 배너 대신 프론트 문구를 쓴다', () => {
    // client.ts 의 isErrorDocument 는 `{"errors":[{}]}` 를 통과시킨다 -
    // 그대로 그리면 사용자는 거절만 당하고 아무 설명도 못 본다.
    expect(authFormStateFromErrors([{}], ctx(false)).documentErrors).toEqual([
      UNUSABLE_RESPONSE_MESSAGE,
    ])
  })

  it('제출한 이메일을 되돌려 준다 - 모든 갈래에서', () => {
    // 실측된 결함이다: React 19 는 action 이 끝나면 폼을 초기화하고 무JS
    // 경로는 서버가 처음부터 다시 그린다 - 되돌리지 않으면 오류가 날 때마다
    // 사용자가 이메일을 다시 친다.
    const errors = [documentError('INVALID_CREDENTIALS', 'probe-credentials-message')]
    expect(authFormStateFromErrors(errors, ctx(false)).submittedEmail).toBe(PROBE_SUBMITTED_EMAIL)
    // transport 갈래(프론트 문구를 쓰는 쪽)도 같아야 한다.
    expect(authFormStateFromErrors([syntheticError('probe')], ctx(false)).submittedEmail).toBe(
      PROBE_SUBMITTED_EMAIL,
    )
    // 문구가 하나도 없는 갈래도 같아야 한다.
    expect(authFormStateFromErrors([{}], ctx(false)).submittedEmail).toBe(PROBE_SUBMITTED_EMAIL)
  })

  it('상태에 비밀번호를 담을 자리가 없다', () => {
    // 되돌려 주는 값을 늘리다 비밀번호까지 담으면 평문 비밀번호가 응답
    // HTML·RSC 페이로드에 실려 나간다. 키 집합 자체를 고정해 그 변경이
    // 조용히 들어오지 못하게 한다.
    const state = authFormStateFromErrors([documentError('X', 'probe')], ctx(false))
    expect(Object.keys(state).sort()).toEqual([
      'accountCreated',
      'documentErrors',
      'fieldErrors',
      'submittedEmail',
    ])
    expect(Object.keys(IDLE_AUTH_FORM_STATE).sort()).toEqual(Object.keys(state).sort())
    expect(IDLE_AUTH_FORM_STATE.submittedEmail).toBe('')
  })

  it('accountCreated 를 받은 그대로 싣는다', () => {
    const errors = [documentError('INVALID_CREDENTIALS', 'probe-credentials-message')]
    expect(authFormStateFromErrors(errors, ctx(true)).accountCreated).toBe(true)
    expect(authFormStateFromErrors(errors, ctx(false)).accountCreated).toBe(false)
    // transport 갈래도 같은 값을 실어야 한다 - 갈래마다 따로 쓰면 한쪽만
    // false 로 굳는 사고가 난다.
    expect(authFormStateFromErrors([syntheticError('probe')], ctx(true)).accountCreated).toBe(true)
  })
})

describe('decideAfterLogin - 로그인 화면의 진입점', () => {
  it('실패 상태에 accountCreated 를 절대 싣지 않는다 - 로그인은 계정을 만들지 않는다', () => {
    // 이 값을 true 로 바꾸는 뮤테이션이 Action 안에 있었을 때는 아무 테스트도
    // 죽지 않았다(리뷰 RM4 의 로그인 쪽 대응물). 여기로 옮겨야 관측된다.
    const plan = decideAfterLogin(
      {
        kind: 'rejected',
        errors: [documentError('INVALID_CREDENTIALS', 'probe-credentials-message')],
      },
      PROBE_TARGET,
      PROBE_SUBMITTED_EMAIL,
    )
    expect(plan).toEqual({
      kind: 'state',
      state: {
        documentErrors: ['probe-credentials-message'],
        fieldErrors: {},
        submittedEmail: PROBE_SUBMITTED_EMAIL,
        accountCreated: false,
      },
    })
  })

  it('성공하면 decideAfterSignIn 과 같은 계획을 돌려준다', () => {
    expect(
      decideAfterLogin(
        { kind: 'signedIn', session: PROBE_SESSION, refreshExpiresIn: PROBE_REFRESH_EXPIRES_IN },
        PROBE_TARGET,
        PROBE_SUBMITTED_EMAIL,
      ),
    ).toEqual({
      kind: 'establish',
      to: PROBE_TARGET,
      session: PROBE_SESSION,
      refreshExpiresIn: PROBE_REFRESH_EXPIRES_IN,
    })
  })

  it('공격자가 넣은 next 는 로그인 진입점을 거쳐도 막힌다', () => {
    const plan = decideAfterLogin(
      { kind: 'signedIn', session: PROBE_SESSION, refreshExpiresIn: PROBE_REFRESH_EXPIRES_IN },
      'https://evil.example/',
      PROBE_SUBMITTED_EMAIL,
    )
    expect(plan.kind).toBe('establish')
    if (plan.kind !== 'establish') throw new Error('unreachable')
    expect(plan.to).toBe(DEFAULT_POST_LOGIN_PATH)
  })
})

describe('decideAfterRegistration - 가입 화면의 진입점', () => {
  it('가입이 거절되면 accountCreated 는 false 다', () => {
    // 계정이 안 만들어졌는데 "가입은 됐다"를 화면에 띄우면 거짓말이 되고,
    // 사용자를 로그인 화면으로 보내면 거기서도 실패한다.
    const plan = decideAfterRegistration(
      {
        kind: 'signUpRejected',
        errors: [documentError('EMAIL_ALREADY_REGISTERED', 'probe-conflict-message')],
      },
      PROBE_TARGET,
      PROBE_SUBMITTED_EMAIL,
    )
    expect(plan).toEqual({
      kind: 'state',
      state: {
        documentErrors: ['probe-conflict-message'],
        fieldErrors: {},
        submittedEmail: PROBE_SUBMITTED_EMAIL,
        accountCreated: false,
      },
    })
  })

  it('가입이 거절되면 리다이렉트 대상을 만들지 않는다', () => {
    const plan = decideAfterRegistration(
      { kind: 'signUpRejected', errors: [documentError('EMAIL_ALREADY_REGISTERED', 'probe')] },
      PROBE_TARGET,
      PROBE_SUBMITTED_EMAIL,
    )
    expect(JSON.stringify(plan)).not.toContain('probe-target')
  })

  it('계정은 만들어졌는데 로그인이 실패하면 accountCreated 가 true 다', () => {
    // 리뷰 RM4: 이 값이 Action 안에 있을 때 false 로 바꿔도 258개 전부
    // 초록이었다. 그 뮤턴트가 사는 동안, 계정이 만들어진 사용자는
    // "로그인에서 다시 시도하라"는 안내를 못 보고 재제출 -> 409 의
    // 막다른 길로 간다.
    const plan = decideAfterRegistration(
      { kind: 'signedUp', signIn: { kind: 'malformed' } },
      PROBE_TARGET,
      PROBE_SUBMITTED_EMAIL,
    )
    expect(plan).toEqual({
      kind: 'state',
      state: {
        documentErrors: [UNUSABLE_RESPONSE_MESSAGE],
        fieldErrors: {},
        submittedEmail: PROBE_SUBMITTED_EMAIL,
        accountCreated: true,
      },
    })
  })

  it('가입 거절과 로그인 실패는 같은 오류 문구라도 accountCreated 가 갈린다', () => {
    // 두 갈래를 구별하는 것이 이 함수의 존재 이유다 - 같은 errors 를 넣고
    // 결과가 달라지는지 본다.
    const errors = [documentError('PROBE_CODE', 'probe-same-message')]
    const rejected = decideAfterRegistration(
      { kind: 'signUpRejected', errors },
      PROBE_TARGET,
      PROBE_SUBMITTED_EMAIL,
    )
    const signedUp = decideAfterRegistration(
      { kind: 'signedUp', signIn: { kind: 'rejected', errors } },
      PROBE_TARGET,
      PROBE_SUBMITTED_EMAIL,
    )
    if (rejected.kind !== 'state' || signedUp.kind !== 'state') throw new Error('unreachable')
    expect(rejected.state.documentErrors).toEqual(signedUp.state.documentErrors)
    expect(rejected.state.accountCreated).toBe(false)
    expect(signedUp.state.accountCreated).toBe(true)
  })

  it('가입과 로그인이 모두 성공하면 쿠키를 쓰고 이동한다', () => {
    expect(
      decideAfterRegistration(
        {
          kind: 'signedUp',
          signIn: {
            kind: 'signedIn',
            session: PROBE_SESSION,
            refreshExpiresIn: PROBE_REFRESH_EXPIRES_IN,
          },
        },
        PROBE_TARGET,
        PROBE_SUBMITTED_EMAIL,
      ),
    ).toEqual({
      kind: 'establish',
      to: PROBE_TARGET,
      session: PROBE_SESSION,
      refreshExpiresIn: PROBE_REFRESH_EXPIRES_IN,
    })
  })
})

describe('decideAfterSignIn', () => {
  it('성공하면 쿠키에 쓸 값과 갈 곳을 그대로 실어 준다', () => {
    // 이 지점이 Task 3 이 실제로 틀렸던 배선이다 - session 과
    // refreshExpiresIn 이 서로 다른 출처에서 오고, 그 둘을 바꿔치기해도
    // 값이 우연히 같으면 아무 테스트도 안 깨진다. 그래서 세 값을 전부
    // 서로 다르고 실전값도 아닌 값으로 고정한다.
    const plan = decideAfterSignIn(
      { kind: 'signedIn', session: PROBE_SESSION, refreshExpiresIn: PROBE_REFRESH_EXPIRES_IN },
      PROBE_TARGET,
      ctx(false),
    )
    expect(plan).toEqual({
      kind: 'establish',
      to: PROBE_TARGET,
      session: PROBE_SESSION,
      refreshExpiresIn: PROBE_REFRESH_EXPIRES_IN,
    })
  })

  it('공격자가 넣은 next 는 redirect 대상까지 도달하지 못한다', () => {
    // 이 저장소에서 redirect() 에 값을 넘기는 자리는 이 함수의 `to` 하나뿐이다.
    const plan = decideAfterSignIn(
      { kind: 'signedIn', session: PROBE_SESSION, refreshExpiresIn: PROBE_REFRESH_EXPIRES_IN },
      'https://evil.example/',
      ctx(false),
    )
    expect(plan.kind).toBe('establish')
    if (plan.kind !== 'establish') throw new Error('unreachable')
    expect(plan.to).toBe(DEFAULT_POST_LOGIN_PATH)
    expect(plan.to).not.toContain('evil.example')
  })

  it('거절되면 폼에 머문다 - 가입 흐름이면 accountCreated 가 실린다', () => {
    const errors = [syntheticError('probe-transport')]
    expect(decideAfterSignIn({ kind: 'rejected', errors }, PROBE_TARGET, ctx(true))).toEqual({
      kind: 'state',
      state: {
        documentErrors: [UNUSABLE_RESPONSE_MESSAGE],
        fieldErrors: {},
        submittedEmail: PROBE_SUBMITTED_EMAIL,
        accountCreated: true,
      },
    })
    expect(decideAfterSignIn({ kind: 'rejected', errors }, PROBE_TARGET, ctx(false))).toEqual({
      kind: 'state',
      state: {
        documentErrors: [UNUSABLE_RESPONSE_MESSAGE],
        fieldErrors: {},
        submittedEmail: PROBE_SUBMITTED_EMAIL,
        accountCreated: false,
      },
    })
  })

  it('본문 없는 2xx(계약 위반)도 폼에 머물고 accountCreated 를 보존한다', () => {
    expect(decideAfterSignIn({ kind: 'malformed' }, PROBE_TARGET, ctx(true))).toEqual({
      kind: 'state',
      state: {
        documentErrors: [UNUSABLE_RESPONSE_MESSAGE],
        fieldErrors: {},
        submittedEmail: PROBE_SUBMITTED_EMAIL,
        accountCreated: true,
      },
    })
  })

  it('실패했을 때 리다이렉트 대상을 만들지 않는다', () => {
    // "일단 to 를 계산해 두자"가 되면 실패 상태에도 이동이 딸려 갈 수 있다.
    const plan = decideAfterSignIn({ kind: 'malformed' }, PROBE_TARGET, ctx(false))
    expect(plan.kind).toBe('state')
    expect(JSON.stringify(plan)).not.toContain('probe-target')
  })
})
