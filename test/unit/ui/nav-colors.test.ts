import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { NAV_COLOR_TOKENS, NAV_COLORS } from '@/platform/nav-colors'

/**
 * 내비게이션 테마의 색이 global.css 의 토큰과 같다. 토큰은 `oklch()` 이고 테마는 sRGB 16진수라
 * 사람이 옮겨 적는다 - 옮겨 적은 값은 반드시 어긋난다(D1 운반 기록: dark 의 card·primary·border,
 * 두 notification 이 어긋나 있었다).
 *
 * 변환은 CSS Color 4 의 OKLab → 선형 sRGB 행렬과 sRGB 감마다. 기기 위의 값으로 변환을 맞댄다 -
 * D1 실측 M1 이 화면 캡처에서 읽은 색(흰 화면의 버튼 #171717·글자 #0a0a0a, 다크의 버튼 #e5e5e5).
 */
function oklchToHex(lightness: number, chroma: number, hue: number, alpha?: number): string {
  const a = chroma * Math.cos((hue * Math.PI) / 180)
  const b = chroma * Math.sin((hue * Math.PI) / 180)
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
  const channel = (value: number): string => {
    const clamped = Math.min(1, Math.max(0, value))
    const encoded = clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055
    return Math.round(encoded * 255)
      .toString(16)
      .padStart(2, '0')
  }
  const opacity =
    alpha === undefined
      ? ''
      : Math.round(alpha * 255)
          .toString(16)
          .padStart(2, '0')
  return `#${linear.map(channel).join('')}${opacity}`
}

/** global.css 의 `@variant <이름> { … }` 블록에서 `--color-*` 토큰을 16진수로. */
function tokens(variant: 'light' | 'dark'): Record<string, string> {
  const css = readFileSync('global.css', 'utf8')
  const start = css.indexOf(`@variant ${variant} {`)
  const block = css.slice(start, css.indexOf('}', start))
  const found: Record<string, string> = {}
  const pattern =
    /--color-([\w-]+):\s*oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+)%)?\)/g
  for (const [, name, l, c, h, percent] of block.matchAll(pattern)) {
    if (name === undefined || l === undefined || c === undefined || h === undefined) continue
    found[name] = oklchToHex(
      Number(l),
      Number(c),
      Number(h),
      percent === undefined ? undefined : Number(percent) / 100,
    )
  }
  return found
}

describe('oklch → sRGB 변환', () => {
  it('D1 실측 M1 이 기기에서 읽은 색과 같다', () => {
    expect(oklchToHex(0.205, 0, 0)).toBe('#171717')
    expect(oklchToHex(0.145, 0, 0)).toBe('#0a0a0a')
    expect(oklchToHex(0.922, 0, 0)).toBe('#e5e5e5')
    expect(oklchToHex(0.985, 0, 0)).toBe('#fafafa')
  })
})

describe('NAV_COLORS - global.css 토큰과 같다', () => {
  it.each(['light', 'dark'] as const)('%s', (variant) => {
    const css = tokens(variant)
    const expected = Object.fromEntries(
      Object.entries(NAV_COLOR_TOKENS).map(([color, token]) => [color, css[token]]),
    )
    expect(NAV_COLORS[variant]).toEqual(expected)
  })
})
