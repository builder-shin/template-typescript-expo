/* global http, json, output, API_URL, EMAIL, PASSWORD, STEP, COUNT, TITLE */
/**
 * E2E 가 앱 밖에서 백엔드를 바꾸는 단계 - 볼 행을 만들고, 앱이 모르는 사이에 자원이나 세션을 없앤다.
 *
 * Maestro 의 runScript 로 돈다. 에뮬레이터가 아니라 호스트의 GraalJS 에서 돌아서 백엔드에
 * 호스트 주소(API_URL, 하네스가 -e 로 준다)로 닿는다. http·json·output 은 Maestro 가 주는 전역이다.
 * 이 요청들은 앱을 지나지 않으므로 기기 로그의 가드(test/e2e/guard-log.sh)에 걸리지 않는다.
 *
 *   STEP=seed     EMAIL·PASSWORD 로 가입·로그인하고 행 COUNT 개(제목 `<prefix> 01` …)를 만든다.
 *                 output.prefix(이 실행만의 제목 접두사 `probe-d3-<12자>`)·output.firstId 를 남긴다
 *   STEP=create   제목이 TITLE 인 행 하나를 만든다(seed 뒤에만)
 *   STEP=rename   첫 행(`<prefix> 01`)의 제목을 TITLE 로 바꾼다(seed 뒤에만)
 *   STEP=account  EMAIL·PASSWORD 로 가입만 한다 - 앱이 그 계정으로 로그인한다. output.prefix(쓰기 플로의
 *                 짧은 제목 접두사 `d4-<8자>`)를 남긴다
 *   STEP=example  제목이 TITLE 인 행 하나를 모든 속성과 분류 하나·태그 둘까지 채워 만든다 - output.exampleId.
 *                 태그는 씨앗 id 의 반대 순서(둘, 하나)로 보낸다
 *   STEP=unlisted 제목이 TITLE 인 행 하나를 참조 목록(이름 순 100건) 밖의 분류·태그(씨앗의 `…-098` 채움 행)로
 *                 만든다 - output.exampleId. 선택기가 "목록에 없는 선택" 을 그리는 상태다
 *   STEP=delete   output.exampleId 를 지운다 - 앱이 모르는 사이에 없어진 자원을 만든다
 *   STEP=revoke   EMAIL 사용자의 refresh 세션을 전부 끊는다 - 폐기된 refresh 를 다시 내밀면 백엔드가 그
 *                 사용자의 세션을 모두 폐기한다(lib/auth/rotation.ts 머리말의 실측). 앱의 다음 회전이
 *                 TOKEN_REVOKED 를 받는다
 *
 * access token 은 한 번 로그인해 output.token 에 두고 다시 쓴다. 하네스가 백엔드의 access token 수명을
 * 짧게 주므로(E2E_ACCESS_EXPIRES_SECONDS) 401 을 받으면 한 번 다시 로그인해 같은 요청을 보낸다.
 *
 * 실패하면 던진다 - Maestro 가 그 단계를 실패로 적고 플로가 멈춘다.
 */
const MEDIA_TYPE = 'application/vnd.api+json'

/** 씨앗의 분류·태그 id - test/e2e/seed/examples.sql 이 정본이다. */
const SEED_CATEGORY_ONE = '11110000-0000-4000-8000-000000000001'
const SEED_TAG_ONE = '22220000-0000-4000-8000-000000000001'
const SEED_TAG_TWO = '22220000-0000-4000-8000-000000000002'
/** 이름 순 101번째라 참조 목록(100건)에 들지 않는 채움 행 - 씨앗 파일의 "왜 99건인가" 절. */
const SEED_CATEGORY_UNLISTED = '11119999-0000-4000-8000-000000000098'
const SEED_TAG_UNLISTED = '22229999-0000-4000-8000-000000000098'

function send(method, path, body, token) {
  const headers = { 'Content-Type': MEDIA_TYPE, Accept: MEDIA_TYPE }
  if (token !== undefined) headers.Authorization = `Bearer ${token}`
  const options = { method, headers }
  if (body !== undefined) options.body = JSON.stringify(body)
  return http.request(`${API_URL}${path}`, options)
}

function expectOk(method, path, response) {
  if (!response.ok) throw new Error(`${method} ${path} → ${response.status} ${response.body}`)
  return response.status === 204 ? null : json(response.body)
}

function call(method, path, body, token) {
  return expectOk(method, path, send(method, path, body, token))
}

function credentials(type) {
  return { data: { type, attributes: { email: EMAIL, password: PASSWORD } } }
}

function login() {
  return call('POST', '/api/v1/auth/login', credentials('authCredentials')).data.attributes
}

/** 인증이 필요한 요청 - 토큰이 만료돼 401 이면 한 번 다시 로그인한다. */
function authed(method, path, body) {
  if (output.token === undefined) output.token = login().accessToken
  let response = send(method, path, body, output.token)
  if (response.status === 401) {
    output.token = login().accessToken
    response = send(method, path, body, output.token)
  }
  return expectOk(method, path, response)
}

function refresh(refreshToken) {
  return send('POST', '/api/v1/auth/refresh', {
    data: { type: 'refreshTokens', attributes: { refreshToken } },
  })
}

function createExample(title) {
  const document = { data: { type: 'examples', attributes: { title, status: 'draft', score: 50 } } }
  return authed('POST', '/api/v1/examples', document).data.id
}

/** 이메일 로컬 파트의 끝 n 자 - 실행·플로마다 다르다(test/e2e/probe-email.ts). */
function emailTail(length) {
  return EMAIL.split('@')[0].slice(-length)
}

if (STEP === 'seed') {
  call('POST', '/api/v1/auth/register', credentials('users'))
  output.token = login().accessToken
  // 제목 접두사로 좁혀 다른 실행의 행이 목록 단언을 흔들지 못하게 한다(스펙 11.3).
  output.prefix = `probe-d3-${emailTail(12)}`
  for (let n = 1; n <= Number(COUNT); n += 1) {
    const id = createExample(`${output.prefix} ${String(n).padStart(2, '0')}`)
    if (n === 1) output.firstId = id
  }
} else if (STEP === 'create') {
  createExample(TITLE)
} else if (STEP === 'rename') {
  authed('PATCH', `/api/v1/examples/${output.firstId}`, {
    data: { type: 'examples', id: output.firstId, attributes: { title: TITLE } },
  })
} else if (STEP === 'account') {
  call('POST', '/api/v1/auth/register', credentials('users'))
  // 수정 플로가 제목을 지우고 다시 쓴다 - Maestro 가 입력을 누르면 커서가 누른 자리에 서므로, 제목이
  // 입력 칸의 절반보다 짧아야 커서가 끝에 선다. 그래서 짧게 둔다.
  output.prefix = `d4-${emailTail(8)}`
} else if (STEP === 'example') {
  const document = {
    data: {
      type: 'examples',
      attributes: { title: TITLE, description: 'd4 note', status: 'active', score: 55 },
      relationships: {
        category: { data: { type: 'exampleCategories', id: SEED_CATEGORY_ONE } },
        tags: {
          data: [
            { type: 'exampleTags', id: SEED_TAG_TWO },
            { type: 'exampleTags', id: SEED_TAG_ONE },
          ],
        },
      },
    },
  }
  output.exampleId = authed('POST', '/api/v1/examples', document).data.id
} else if (STEP === 'unlisted') {
  const document = {
    data: {
      type: 'examples',
      attributes: { title: TITLE, status: 'draft', score: 1 },
      relationships: {
        category: { data: { type: 'exampleCategories', id: SEED_CATEGORY_UNLISTED } },
        tags: { data: [{ type: 'exampleTags', id: SEED_TAG_UNLISTED }] },
      },
    },
  }
  output.exampleId = authed('POST', '/api/v1/examples', document).data.id
} else if (STEP === 'delete') {
  authed('DELETE', `/api/v1/examples/${output.exampleId}`)
} else if (STEP === 'revoke') {
  const first = login().refreshToken
  expectOk('POST', '/api/v1/auth/refresh', refresh(first))
  // 방금 폐기된 refresh 를 다시 내민다 - 백엔드가 이 사용자의 세션을 전부 폐기한다(앱의 것도).
  const reused = refresh(first)
  if (reused.status !== 401) {
    throw new Error(
      `폐기된 refresh 를 다시 내밀었는데 401 이 아니다: ${reused.status} ${reused.body}`,
    )
  }
  output.token = undefined
} else {
  throw new Error(`STEP 을 모른다: ${STEP}`)
}
