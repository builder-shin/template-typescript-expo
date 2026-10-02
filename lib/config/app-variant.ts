/**
 * 빌드 변형 - 스펙 10.2.
 *
 * app.config.ts(빌드 시점, node)와 테스트가 함께 쓰는 순수 모듈이다. 네이티브 모듈을
 * import 하지 않는다(스펙 5장).
 * app.config.ts 가 Node 의 type stripping 으로 직접 실행한다 - 타입만 지우면 도는 구문만 쓰고
 * import 에는 `.ts` 확장자를 붙인다(lib/config/AGENTS.md).
 */

export const APP_VARIANTS = ['development', 'preview', 'production', 'e2e'] as const
export type AppVariant = (typeof APP_VARIANTS)[number]

/** 선택 변수 APP_VARIANT 의 기본값. .env.example 과 README 표에 같은 값을 적는다. */
export const DEFAULT_APP_VARIANT: AppVariant = 'development'

export interface VariantProfile {
  /** 번들 ID·패키지 이름 접미사. 한 기기에 여러 변형을 함께 설치하게 한다. */
  readonly idSuffix: string
  /** 딥링크 scheme 접미사. 변형마다 달라야 딥링크가 엉뚱한 변형으로 가지 않는다. */
  readonly schemeSuffix: string
  /** 앱 이름 접미사. */
  readonly nameSuffix: string
  /** 평문 HTTP 허용 여부. development·e2e 만 허용한다. */
  readonly allowCleartext: boolean
  /**
   * API 클라이언트가 2xx 가 아닌 결과를 표식과 함께 기기 로그에 남기는가. e2e 만 켠다 - E2E
   * 하네스가 플로가 선언하지 않은 4xx·5xx 를 실패로 만드는 재료다(스펙 11.3).
   */
  readonly logsHttpFailures: boolean
  /**
   * OTA 채널(스펙 10.2·10.6). eas.json 에서 이 변형을 빌드하는 프로필의 channel 과 같은 값이다 -
   * test/unit/config/eas-json.test.ts 가 맞댄다. null 이면 이 변형은 OTA 를 끈다: development 는 개발 서버의
   * 번들을, e2e 는 내장 번들을 결정적으로 돈다.
   */
  readonly updatesChannel: string | null
  /**
   * 개발 클라이언트(expo-dev-client)가 slug 로 만드는 scheme(`exp+<slug>`)을 싣는가. development 만 싣는다 - 그
   * scheme 은 변형과 무관하게 이름이 같아서, 여러 변형에 실리면 한 기기에 함께 설치한 변형 가운데 어디로 갈지 정해지지
   * 않는다(스펙 10.2 의 D1 정정). 개발 서버의 번들을 개발 클라이언트로 여는 링크라 다른 변형에는 쓸 곳이 없다.
   */
  readonly devClientScheme: boolean
}

const PROFILES: Readonly<Record<AppVariant, VariantProfile>> = {
  development: {
    idSuffix: '.dev',
    schemeSuffix: '-dev',
    nameSuffix: ' (Dev)',
    allowCleartext: true,
    logsHttpFailures: false,
    updatesChannel: null,
    devClientScheme: true,
  },
  preview: {
    idSuffix: '.preview',
    schemeSuffix: '-preview',
    nameSuffix: ' (Preview)',
    allowCleartext: false,
    logsHttpFailures: false,
    updatesChannel: 'preview',
    devClientScheme: false,
  },
  production: {
    idSuffix: '',
    schemeSuffix: '',
    nameSuffix: '',
    allowCleartext: false,
    logsHttpFailures: false,
    updatesChannel: 'production',
    devClientScheme: false,
  },
  e2e: {
    idSuffix: '.e2e',
    schemeSuffix: '-e2e',
    nameSuffix: ' (E2E)',
    allowCleartext: true,
    logsHttpFailures: true,
    updatesChannel: null,
    devClientScheme: false,
  },
}

function isAppVariant(value: string): value is AppVariant {
  return (APP_VARIANTS as readonly string[]).includes(value)
}

export function parseAppVariant(raw: string | undefined): AppVariant {
  if (raw === undefined || raw.trim() === '') return DEFAULT_APP_VARIANT
  const value = raw.trim()
  if (isAppVariant(value)) return value
  throw new Error(
    `APP_VARIANT must be one of ${APP_VARIANTS.join(', ')} (got ${JSON.stringify(raw)})`,
  )
}

export function variantProfile(variant: AppVariant): VariantProfile {
  return PROFILES[variant]
}

/**
 * 평문 HTTP 주소가 배포 빌드에 섞이지 않게 막는다(스펙 10.2).
 *
 * backendUrl 은 loadSettings 가 이미 절대 http(s) URL 로 검증한 값이다.
 */
export function assertBackendUrlAllowed(backendUrl: string, variant: AppVariant): void {
  if (variantProfile(variant).allowCleartext) return
  if (new URL(backendUrl).protocol !== 'https:') {
    throw new Error(
      `BACKEND_URL must use https for the ${variant} variant (got ${JSON.stringify(backendUrl)})`,
    )
  }
}
