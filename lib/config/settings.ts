/**
 * 환경변수 계약.
 *
 * 필수 변수에는 애플리케이션 코드상의 암묵적 기본값을 두지 않는다. 누락하면
 * 변수 이름이 담긴 오류와 함께 시작에 실패한다 - 첫 요청에서야 드러나는 설정
 * 오류보다 시작 실패가 낫다. 백엔드 템플릿들의 DATABASE_URL과 같은 계약이다.
 *
 * 선택 변수의 기본값은 정본 파일 · .env.example · README.md 의 환경 변수 표
 * **셋**에 같은 값으로 적는다. 거울이 셋이므로 하나를 고칠 때 나머지 둘을 함께
 * 고쳐야 한다.
 *
 * (template-typescript-expo) 이 파일은 두 자리에서 쓰인다. app.config.ts 가 빌드
 * 시점에 loadSettings 로 검증하고(스펙 10.1 - 없으면 그 명령이 멈춘다), 앱은 시작할
 * 때 platform/config.ts 가 setSettingsSource 로 자리를 app.config.ts 의 extra 로
 * 돌린 뒤 getSettings 로 다시 검증한다. 앱 런타임의 process.env 에는 BACKEND_URL 이
 * 없기 때문이다.
 */

export interface Settings {
  /** 백엔드 API의 절대 URL. 끝 슬래시 없음. */
  backendUrl: string
}

export type SettingsEnv = Record<string, string | undefined>

function requireAbsoluteUrl(raw: string | undefined, name: string): string {
  const value = (raw ?? '').trim()
  if (value === '') {
    throw new Error(`${name} is required`)
  }
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new Error(`${name} must be an absolute URL (got ${JSON.stringify(value)})`)
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`${name} must be an absolute URL (got ${JSON.stringify(value)})`)
  }
  return value.replace(/\/+$/, '')
}

export function loadSettings(env?: SettingsEnv): Settings {
  const processEnv = env ?? process.env
  return {
    backendUrl: requireAbsoluteUrl(processEnv.BACKEND_URL, 'BACKEND_URL'),
  }
}

let source: () => SettingsEnv = () => process.env
let cached: Settings | undefined

/**
 * 설정을 어디서 읽을지 바꾼다. 캐시를 비워 다음 getSettings() 가 새 자리에서 읽게
 * 한다. 앱은 시작할 때 한 번 부른다(platform/config.ts). 테스트는 기본 자리
 * (process.env)를 그대로 쓴다.
 */
export function setSettingsSource(read: () => SettingsEnv): void {
  source = read
  cached = undefined
}

/**
 * 자리에서 한 번만 로드한다.
 *
 * 메모이즈하는 이유는 성능이 아니라 일관성이다 - 한 실행 안에서 두 번 읽었을
 * 때 다른 값이 나오는 상황을 만들지 않는다.
 */
export function getSettings(): Settings {
  cached ??= loadSettings(source())
  return cached
}
