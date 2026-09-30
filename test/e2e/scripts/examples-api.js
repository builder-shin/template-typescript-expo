/* global http, json, output, API_URL, EMAIL, PASSWORD, STEP, COUNT, TITLE */
/**
 * 목록·상세 E2E 가 볼 행을 백엔드에 직접 만든다 - 앱에는 아직 쓰기 화면이 없다(D4 가 만든다).
 *
 * Maestro 의 runScript 로 돈다. 에뮬레이터가 아니라 호스트의 GraalJS 에서 돌아서 백엔드에
 * 호스트 주소(API_URL, 하네스가 -e 로 준다)로 닿는다. http·json·output 은 Maestro 가 주는 전역이다.
 * 이 요청들은 앱을 지나지 않으므로 기기 로그의 가드(test/e2e/guard-log.sh)에 걸리지 않는다.
 *
 *   STEP=seed    EMAIL·PASSWORD 로 가입·로그인하고 행 COUNT 개(제목 `<prefix> 01` …)를 만든다.
 *                output.prefix(이 실행만의 제목 접두사)·output.token·output.firstId 를 남긴다
 *   STEP=create  제목이 TITLE 인 행 하나를 만든다(seed 뒤에만)
 *   STEP=rename  첫 행(`<prefix> 01`)의 제목을 TITLE 로 바꾼다(seed 뒤에만)
 *
 * 실패하면 던진다 - Maestro 가 그 단계를 실패로 적고 플로가 멈춘다.
 */
const MEDIA_TYPE = 'application/vnd.api+json'

function call(method, path, body, token) {
  const headers = { 'Content-Type': MEDIA_TYPE, Accept: MEDIA_TYPE }
  if (token !== undefined) headers.Authorization = `Bearer ${token}`
  const response = http.request(`${API_URL}${path}`, {
    method,
    headers,
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(`${method} ${path} → ${response.status} ${response.body}`)
  return json(response.body)
}

function createExample(title) {
  const document = { data: { type: 'examples', attributes: { title, status: 'draft', score: 50 } } }
  return call('POST', '/api/v1/examples', document, output.token).data.id
}

if (STEP === 'seed') {
  const credentials = (type) => ({
    data: { type, attributes: { email: EMAIL, password: PASSWORD } },
  })
  call('POST', '/api/v1/auth/register', credentials('users'))
  output.token = call(
    'POST',
    '/api/v1/auth/login',
    credentials('authCredentials'),
  ).data.attributes.accessToken
  // 실행·플로마다 다른 이메일(test/e2e/probe-email.ts)의 끝 12자 - 다른 실행의 행이 목록 단언을
  // 흔들지 못한다(제목 접두사로 좁힌다, 스펙 11.3).
  output.prefix = `probe-d3-${EMAIL.split('@')[0].slice(-12)}`
  for (let n = 1; n <= Number(COUNT); n += 1) {
    const id = createExample(`${output.prefix} ${String(n).padStart(2, '0')}`)
    if (n === 1) output.firstId = id
  }
} else if (STEP === 'create') {
  createExample(TITLE)
} else if (STEP === 'rename') {
  call(
    'PATCH',
    `/api/v1/examples/${output.firstId}`,
    { data: { type: 'examples', id: output.firstId, attributes: { title: TITLE } } },
    output.token,
  )
} else {
  throw new Error(`STEP 을 모른다: ${STEP}`)
}
