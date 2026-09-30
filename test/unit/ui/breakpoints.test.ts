import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * 화면 코드에 미디어 쿼리 변형(`sm`·`md`·`lg`·`xl`·`2xl` 과 그 `max-`·`min-` 꼴, `portrait`·
 * `landscape`)이 없다.
 *
 * Uniwind 1.12.0 은 한 `@media` 블록 안에서 첫 규칙만 조건(minWidth)을 지키고 둘째 규칙부터
 * 조건을 잃는다 - 그 규칙은 폰(411dp)에서도 적용된다(docs/superpowers/notes/2026-09-30-d1-measurements.md
 * 의 M1 절: React Native Reusables Button 의 기본 크기가 폰에서 40dp 가 아니라 36dp). 고쳐진
 * 릴리스가 없어(npm latest 1.12.0) 이 저장소는 그 변형을 쓰지 않는다 - React Native Reusables
 * CLI 로 받은 컴포넌트에서도 뺀다(docs/superpowers/notes/2026-09-30-d3-measurements.md).
 *
 * 문자열이 아니라 파일 전체를 훑는다 - 클래스 문자열은 `cn()`·`cva()`·템플릿 리터럴 어디에나 있다.
 * 객체 키(`sm: …`)는 콜론 뒤에 공백이 있어 걸리지 않는다.
 */
const ROOTS = ['app', 'components']

const MEDIA_VARIANT =
  /(?<![\w-])(?:(?:max|min)-\[[^\]\s]*\]|(?:(?:max|min)-)?(?:sm|md|lg|xl|2xl)|portrait|landscape):(?=\S)/g

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
    const found = ROOTS.flatMap(sourceFiles).flatMap((file) =>
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

  it('크기 이름과 선택자 변형, 객체 키는 잡지 않는다', () => {
    expect(
      mediaVariants(
        "'shadow-sm text-sm rounded-sm dark:bg-muted [&>svg]:size-4 [a&]:hover:bg-accent' { sm: '' }",
      ),
    ).toEqual([])
  })
})
