/**
 * 빌드 변형 - 스펙 10.2.
 *
 * app.config.ts(빌드 시점, node)와 테스트가 함께 쓰는 순수 모듈이다. 네이티브 모듈을
 * import 하지 않는다(스펙 5장).
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
}

const PROFILES: Readonly<Record<AppVariant, VariantProfile>> = {
  development: {
    idSuffix: '.dev',
    schemeSuffix: '-dev',
    nameSuffix: ' (Dev)',
    allowCleartext: true,
  },
  preview: {
    idSuffix: '.preview',
    schemeSuffix: '-preview',
    nameSuffix: ' (Preview)',
    allowCleartext: false,
  },
  production: { idSuffix: '', schemeSuffix: '', nameSuffix: '', allowCleartext: false },
  e2e: { idSuffix: '.e2e', schemeSuffix: '-e2e', nameSuffix: ' (E2E)', allowCleartext: true },
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
