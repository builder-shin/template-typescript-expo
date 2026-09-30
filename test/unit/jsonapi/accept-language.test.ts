import { describe, expect, it } from 'vitest'
import { MAX_ACCEPT_LANGUAGE_TAGS, acceptLanguageFromLocales } from '@/lib/jsonapi/accept-language'

describe('acceptLanguageFromLocales - 스펙 9.4', () => {
  it('기기 언어 목록의 순서대로 품질값을 낮춰 붙인다 - 앱별 언어 ko-KR 을 준 에뮬레이터의 모양', () => {
    // D1 실측 M3: 앱별 언어가 ko-KR 이면 getLocales() 가 ko-KR, en-US 순서다.
    expect(acceptLanguageFromLocales(['ko-KR', 'en-US'])).toBe('ko-KR,en-US;q=0.9')
  })

  it('하나면 품질값 없이 그대로다', () => {
    expect(acceptLanguageFromLocales(['en-US'])).toBe('en-US')
  })

  it('태그를 고치지 않는다 - 기본 하위 태그를 가려 읽는 것은 백엔드의 몫이다', () => {
    expect(acceptLanguageFromLocales(['zh-Hant-TW'])).toBe('zh-Hant-TW')
  })

  it('앞뒤 공백을 떼고, 대소문자만 다른 중복은 처음 것만 남긴다', () => {
    expect(acceptLanguageFromLocales([' ko-KR ', 'KO-kr', 'en'])).toBe('ko-KR,en;q=0.9')
  })

  it('형식에 맞지 않는 태그는 뺀다 - 헤더에 개행·쉼표·세미콜론이 들어가지 않는다', () => {
    expect(
      acceptLanguageFromLocales(['ko\nKR', 'en,US', 'ja;q=1', '', '   ', 'x'.repeat(9), 'fr-FR']),
    ).toBe('fr-FR')
  })

  it('쓸 태그가 없으면 null 이다 - 헤더를 싣지 않는다', () => {
    expect(acceptLanguageFromLocales([])).toBeNull()
    expect(acceptLanguageFromLocales(['', '@@'])).toBeNull()
  })

  it(`품질값이 0 이 되기 전 ${MAX_ACCEPT_LANGUAGE_TAGS}개까지만 싣는다`, () => {
    const tags = Array.from({ length: 12 }, (_, index) => `x${String.fromCharCode(97 + index)}`)
    const header = acceptLanguageFromLocales(tags) ?? ''
    const entries = header.split(',')
    expect(entries).toHaveLength(MAX_ACCEPT_LANGUAGE_TAGS)
    expect(entries.at(-1)).toBe('xj;q=0.1')
    expect(header).not.toContain('q=0.0')
  })

  it('품질값이 앞에서 뒤로 줄곧 줄어든다', () => {
    const header = acceptLanguageFromLocales(['aa', 'bb', 'cc', 'dd']) ?? ''
    const qualities = header.split(',').map((entry) => Number(entry.split(';q=')[1] ?? '1'))
    expect(qualities).toEqual([1, 0.9, 0.8, 0.7])
  })
})
