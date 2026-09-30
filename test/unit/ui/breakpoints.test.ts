import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * 화면 코드에 `@media` 로 컴파일되는 변형이 없다 - 너비(`sm`·`md`·`lg`·`xl`·`2xl` 과 그 `max-`·`min-`
 * 꼴), 방향(`portrait`·`landscape`), 플랫폼(`ios`·`android`·`native`·`tv`·`android-tv`·`apple-tv`),
 * 그리고 `[@media …]:` 꼴의 임의 변형.
 *
 * Uniwind 1.12.0 은 한 `@media` 블록 안에서 첫 규칙만 조건을 지키고 둘째 규칙부터 조건을 잃는다.
 * Tailwind 는 같은 조건의 유틸리티를 한 블록으로 모으므로, 너비 변형의 둘째 규칙은 폰(411dp)에서도
 * 적용되고(docs/superpowers/notes/2026-09-30-d1-measurements.md 의 M1 절: React Native Reusables
 * Button 의 기본 크기가 폰에서 40dp 가 아니라 36dp), 플랫폼 변형의 둘째 규칙은 다른 플랫폼에서도
 * 적용된다(`android:px-4` 가 iOS 에서도). 고쳐진 릴리스가 없어(npm latest 1.12.0) 이 저장소는 그
 * 변형을 쓰지 않는다 - React Native Reusables CLI 로 받은 컴포넌트에서도 뺀다. 플랫폼마다 다른
 * 스타일은 `Platform.select`·`Platform.OS` 로 클래스 문자열을 고른다. 근거와 잰 범위는
 * docs/superpowers/notes/2026-09-30-d3-measurements.md 의 L2.
 *
 * `dark:` 는 걸리지 않는다 - 조건이 블록이 아니라 유틸리티마다의 선택자에 있어 결함과 무관하다.
 * 문자열이 아니라 파일 전체를 훑는다 - 클래스 문자열은 `cn()`·`cva()`·템플릿 리터럴 어디에나 있다.
 * 객체 키(`sm: …`·`native: …`)는 콜론 뒤에 공백이 있어 걸리지 않는다.
 */
const ROOTS = ['app', 'components']

const MEDIA_VARIANT =
  /(?<![\w-])(?:\[@media[^\s]*?\]|(?:max|min)-\[[^\]\s]*\]|(?:(?:max|min)-)?(?:sm|md|lg|xl|2xl)|portrait|landscape|android-tv|apple-tv|android|native|ios|tv):(?=\S)/g

function sourceFiles(root: string): string[] {
  return readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(ts|tsx)$/.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name))
}

function mediaVariants(text: string): string[] {
  return [...text.matchAll(MEDIA_VARIANT)].map((match) => match[0])
}

describe('미디어 쿼리 변형 - Uniwind 1.12.0 의 결함', () => {
  it('app/·components/ 에 없다', () => {
    const scanned = ROOTS.map((root) => ({ root, files: sourceFiles(root) }))
    for (const { root, files } of scanned) {
      // 훑은 파일이 없으면 위반이 없는 것이 아니라 검사가 망가진 것이다(경로나 확장자 거르기가 틀렸다)
      expect(files.length, `${root}/ 에서 찾은 소스 파일`).toBeGreaterThan(0)
    }
    const found = scanned
      .flatMap(({ files }) => files)
      .flatMap((file) =>
        readFileSync(file, 'utf8')
          .split('\n')
          .flatMap((line, index) =>
            mediaVariants(line).map((variant) => `${file}:${index + 1}: ${variant}`),
          ),
      )
    expect(found).toEqual([])
  })

  it('검사가 변형을 실제로 잡는다', () => {
    expect(
      mediaVariants(
        "'h-10 sm:h-9' 'md:text-sm' 'max-sm:p-2' 'min-[400px]:p-2' 'xl:w-4' 'portrait:flex-col'",
      ),
    ).toEqual(['sm:', 'md:', 'max-sm:', 'min-[400px]:', 'xl:', 'portrait:'])
  })

  it('플랫폼 변형을 잡는다 - android-tv 는 tv 와 따로가 아니라 한 덩이로', () => {
    expect(
      mediaVariants(
        "'android:px-4' 'ios:pt-3' 'native:p-1' 'tv:p-2' 'android-tv:p-3' 'apple-tv:p-4'",
      ),
    ).toEqual(['android:', 'ios:', 'native:', 'tv:', 'android-tv:', 'apple-tv:'])
  })

  it('다른 변형 뒤에 겹쳐도 잡는다', () => {
    expect(mediaVariants("'dark:android:px-4' 'active:sm:p-2' 'hover:max-md:p-1'")).toEqual([
      'android:',
      'sm:',
      'max-md:',
    ])
  })

  it('[@media …]: 꼴의 임의 변형을 잡는다', () => {
    expect(
      mediaVariants(
        "'[@media(min-width:600px)]:p-2' 'dark:[@media_android]:p-1' '[@media(hover:hover){&:not([disabled])}]:flex'",
      ),
    ).toEqual([
      '[@media(min-width:600px)]:',
      '[@media_android]:',
      '[@media(hover:hover){&:not([disabled])}]:',
    ])
  })

  it('크기 이름과 선택자 변형, 객체 키는 잡지 않는다', () => {
    expect(
      mediaVariants(
        "'shadow-sm text-sm rounded-sm dark:bg-muted [&>svg]:size-4 [a&]:hover:bg-accent' { sm: '' }",
      ),
    ).toEqual([])
  })

  it('dark: 와 플랫폼 이름의 객체 키(콜론 뒤 공백)는 잡지 않는다', () => {
    expect(
      mediaVariants(
        "'dark:bg-input/30 dark:border-input' native: 'placeholder:text-muted-foreground/50', Platform.select({ ios: 'a', android: 'b', tv: 'c' })",
      ),
    ).toEqual([])
  })
})
