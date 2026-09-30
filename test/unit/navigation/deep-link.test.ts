import type { ConfigContext } from 'expo/config'
import { extractExpoPathFromURL } from 'expo-router/build/fork/extractPathFromURL'
import { afterEach, describe, expect, it, vi } from 'vitest'
import appConfig from '@/app.config'
import { APP_VARIANTS, type AppVariant } from '@/lib/config/app-variant'
import { appPathFromDeepLink, schemesFromConfig } from '@/lib/navigation/deep-link'

import { routeParamsOf } from './router-parse'

/**
 * 밖에서 들어온 딥링크의 정규화 - 스펙 8.2(딥링크 하나로 같은 목록이 재현된다).
 *
 * 기기에서 잰 결함(docs/superpowers/notes/2026-09-30-d3-measurements.md 의 L1): 값의 `+`·`&`·`#` 이 든
 * 딥링크를 Expo Router 57.0.24 가 풀면 `+` 는 공백, `&` 는 다음 파라미터, `#` 은 조각이 된다. 정규화한
 * 주소는 앱 안의 이동(`router.push`)과 같은 해석(`./router-parse.ts` 의 모형)을 지나 값이 그대로 돌아와야 한다.
 */

const SCHEMES = ['templateexpo-e2e'] as const

/** 기기에서 잰 링크(Maestro·adb 가 보낸 것)와 같은 값 - 값 뒤에 `&sort=title` 을 더했다. */
const REPRO_VALUE = 'probe-d3-repro 가+나&다=라#마'
const REPRO_QUERY =
  'filter%5Btitle%5D%5Bcontains%5D=probe-d3-repro%20%EA%B0%80%2B%EB%82%98%26%EB%8B%A4%3D%EB%9D%BC%23%EB%A7%88&sort=title'
const REPRO_LINK = `templateexpo-e2e://examples?${REPRO_QUERY}`

/**
 * 딥링크 하나가 화면의 라우트 파라미터가 되기까지 - `app/+native-intent.tsx` 의 정규화, 설치본 Expo Router 의
 * `extractExpoPathFromURL`(들어온 URL 을 경로로 바꾼다, 앞의 `/` 를 뗀다), 라우터의 해석(`routeParamsOf`).
 */
function receivedParams(link: string, schemes: readonly string[] = SCHEMES) {
  return routeParamsOf(`/${extractExpoPathFromURL([], appPathFromDeepLink(link, schemes))}`)
}

describe('appPathFromDeepLink - 이 앱의 scheme 으로 들어온 링크를 앱 안 주소로', () => {
  it('기기에서 잰 링크: 쿼리를 받은 인코딩 그대로 두고 / 로 시작하는 주소로 바꾼다', () => {
    expect(appPathFromDeepLink(REPRO_LINK, SCHEMES)).toBe(`/examples?${REPRO_QUERY}`)
  })

  it('기기에서 잰 링크의 값과 그 뒤의 sort 가 화면에 그대로 닿는다', () => {
    expect(receivedParams(REPRO_LINK)).toEqual({
      'filter[title][contains]': REPRO_VALUE,
      sort: 'title',
    })
  })

  it('정규화한 주소는 앱 안 이동(router.push)의 주소와 같은 해석을 지난다', () => {
    // 목록 주소의 왕복 시험(test/unit/resources/view-expo.test.ts)이 쓰는 같은 모형이다.
    const path = appPathFromDeepLink(REPRO_LINK, SCHEMES)
    expect(routeParamsOf(path)).toEqual(routeParamsOf(`/examples?${REPRO_QUERY}`))
    expect(routeParamsOf(path)).toEqual({ 'filter[title][contains]': REPRO_VALUE, sort: 'title' })
  })

  it.each([
    ['+', 'a+b', 'a%2Bb'],
    ['&', 'a&b', 'a%26b'],
    ['=', 'a=b', 'a%3Db'],
    ['#', 'a#b', 'a%23b'],
    ['한글', '가나다', '%EA%B0%80%EB%82%98%EB%8B%A4'],
    ['공백(%20)', 'a b', 'a%20b'],
    ['쉼표', 'draft,active', 'draft%2Cactive'],
  ])('값의 %s 이 그대로 닿는다', (_label, value, encoded) => {
    expect(
      receivedParams(
        `templateexpo-e2e://examples?filter%5Btitle%5D%5Bcontains%5D=${encoded}&sort=title`,
      ),
    ).toEqual({ 'filter[title][contains]': value, sort: 'title' })
  })

  it('인코딩한 대괄호 키가 평평한 키로 닿는다(D1 실측 M2 의 모양)', () => {
    expect(
      receivedParams(
        'templateexpo-e2e://examples?filter%5Bstatus%5D%5Bin%5D=draft%2Cactive&sort=-score',
      ),
    ).toEqual({ 'filter[status][in]': 'draft,active', sort: '-score' })
  })

  it('경로 조각의 id 를 그대로 둔다', () => {
    expect(
      appPathFromDeepLink(
        'templateexpo-e2e://examples/33330000-0000-4000-8000-00000000000b',
        SCHEMES,
      ),
    ).toBe('/examples/33330000-0000-4000-8000-00000000000b')
    expect(appPathFromDeepLink('templateexpo-e2e://examples/probe-not-a-uuid', SCHEMES)).toBe(
      '/examples/probe-not-a-uuid',
    )
  })

  it('로그인의 next 는 인코딩 그대로 넘어가 한 번 풀린다', () => {
    const link = 'templateexpo-e2e://login?next=%2Fexamples%2Fnew'
    expect(appPathFromDeepLink(link, SCHEMES)).toBe('/login?next=%2Fexamples%2Fnew')
    expect(receivedParams(link)).toEqual({ next: '/examples/new' })
  })

  it('호스트 자리가 빈 모양(<scheme>:///…)과 루트를 / 하나로 모은다', () => {
    expect(appPathFromDeepLink('templateexpo-e2e:///examples?sort=title', SCHEMES)).toBe(
      '/examples?sort=title',
    )
    expect(appPathFromDeepLink('templateexpo-e2e:///', SCHEMES)).toBe('/')
    expect(appPathFromDeepLink('templateexpo-e2e://', SCHEMES)).toBe('/')
  })

  it('인코딩하지 않은 #조각은 앱 안 이동과 같은 주소로 남긴다', () => {
    // router.push('/examples?sort=title#frag') 가 받을 주소와 한 글자도 다르지 않다 - 조각을 어떻게 다룰지는
    // 라우터가 정한다(getStateFromPath 가 이름이 # 인 파라미터로 싣는다).
    const inApp = '/examples?sort=title#frag'
    expect(appPathFromDeepLink('templateexpo-e2e://examples?sort=title#frag', SCHEMES)).toBe(inApp)
    expect(receivedParams('templateexpo-e2e://examples?sort=title#frag')).toEqual(
      routeParamsOf(inApp),
    )
  })

  it('scheme 은 대소문자를 가리지 않는다(RFC 3986 3.1)', () => {
    expect(appPathFromDeepLink('TemplateExpo-E2E://examples', SCHEMES)).toBe('/examples')
  })

  it.each([
    ['https 주소', 'https://example.com/examples?sort=title'],
    [
      '개발 클라이언트의 링크',
      'exp+template-typescript-expo://expo-development-client/?url=http%3A%2F%2F10.0.2.2%3A8081',
    ],
    ['다른 앱의 scheme', 'otherapp://examples?sort=title'],
    ['이미 앱 안 주소', '/examples?filter%5Btitle%5D%5Bcontains%5D=a%2Bb'],
    ['scheme 이 없는 상대 주소', 'examples?sort=title'],
  ])('%s 는 그대로 돌려준다', (_label, url) => {
    expect(appPathFromDeepLink(url, SCHEMES)).toBe(url)
  })

  it('이 빌드의 scheme 이어도 개발 클라이언트의 링크(expo-development-client 호스트)는 그대로 둔다', () => {
    // Expo Router 의 fromDeepLink 가 호스트로 알아보고 url 파라미터(개발 서버의 주소)를 따로 푼다 - / 로 바꾸면 그
    // 갈래가 이 링크를 보지 못하고 `expo-development-client` 라는 경로로 연다.
    const link =
      'templateexpo-e2e://expo-development-client/?url=http%3A%2F%2F10.0.2.2%3A8081%2Fexamples'
    expect(appPathFromDeepLink(link, SCHEMES)).toBe(link)
    expect(extractExpoPathFromURL([], appPathFromDeepLink(link, SCHEMES))).toBe('examples')
  })

  it('scheme 목록이 비면 아무것도 바꾸지 않는다', () => {
    expect(appPathFromDeepLink(REPRO_LINK, [])).toBe(REPRO_LINK)
  })
})

describe('schemesFromConfig - 앱 설정의 scheme(문자열 또는 배열)을 목록으로', () => {
  it.each([
    ['문자열 하나', 'probe-scheme', ['probe-scheme']],
    ['배열', ['probe-scheme', 'probe-scheme-alt'], ['probe-scheme', 'probe-scheme-alt']],
    ['배열의 문자열 아닌 항목은 버린다', ['probe-scheme', 7, null], ['probe-scheme']],
    ['없음', undefined, []],
    ['null', null, []],
  ])('%s', (_label, scheme, expected) => {
    expect(schemesFromConfig(scheme)).toEqual(expected)
  })
})

// 실전 주소를 쓰지 않는다 - 변형마다 설정을 평가하려고 줄 뿐이다(production 은 https 만 받는다).
const CONTEXT = { config: {}, projectRoot: '/probe' } as unknown as ConfigContext

/** 그 변형의 빌드가 싣는 scheme(`Constants.expoConfig.scheme` 의 값) - app.config.ts 를 평가해 얻는다. */
function variantScheme(variant: AppVariant): string {
  vi.stubEnv('APP_VARIANT', variant)
  vi.stubEnv('BACKEND_URL', 'https://probe-backend.invalid')
  const [scheme, ...rest] = schemesFromConfig(appConfig(CONTEXT).scheme)
  if (scheme === undefined || rest.length > 0) {
    throw new Error(`${variant} 의 scheme 이 하나가 아니다`)
  }
  return scheme
}

describe('변형마다 - app.config.ts 가 그 빌드에 싣는 scheme 으로', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it.each(APP_VARIANTS)('%s 빌드는 자기 scheme 의 링크만 바꾼다', (variant) => {
    const own = variantScheme(variant)
    expect(receivedParams(`${own}://examples?${REPRO_QUERY}`, [own])).toEqual({
      'filter[title][contains]': REPRO_VALUE,
      sort: 'title',
    })
    for (const other of APP_VARIANTS) {
      if (other === variant) continue
      const link = `${variantScheme(other)}://examples`
      expect(appPathFromDeepLink(link, [own])).toBe(link)
    }
  })
})

describe('설치본 Expo Router(57.0.24)의 딥링크 해석 - 정규화가 기대는 두 사실', () => {
  it('정규화하지 않은 링크는 값이 바뀐다 - + 는 공백, & 에서 잘리고, # 뒤(sort 포함)를 잃는다', () => {
    expect(routeParamsOf(`/${extractExpoPathFromURL([], REPRO_LINK)}`)).toEqual({
      'filter[title][contains]': 'probe-d3-repro 가 나',
      다: '라',
    })
  })

  it('/ 로 시작하는 주소는 인코딩 그대로 지나간다(앞의 / 하나만 뗀다)', () => {
    const normalized = appPathFromDeepLink(REPRO_LINK, SCHEMES)
    expect(extractExpoPathFromURL([], normalized)).toBe(normalized.slice(1))
  })
})
