import { DarkTheme, DefaultTheme, type Theme } from 'expo-router'

/**
 * Stack 헤더·배경이 global.css 의 토큰과 같은 색을 쓰게 하는 내비게이션 테마.
 *
 * React Native Reusables 템플릿은 이 파일을 lib/theme.ts 에 두지만, expo-router 를
 * import 하므로 이 저장소에서는 lib/ 에 둘 수 없다(스펙 5장).
 */
const COLORS = {
  light: {
    background: 'hsl(0 0% 100%)',
    border: 'hsl(0 0% 89.8%)',
    card: 'hsl(0 0% 100%)',
    notification: 'hsl(0 84.2% 60.2%)',
    primary: 'hsl(0 0% 9%)',
    text: 'hsl(0 0% 3.9%)',
  },
  dark: {
    background: 'hsl(0 0% 3.9%)',
    border: 'hsl(0 0% 14.9%)',
    card: 'hsl(0 0% 3.9%)',
    notification: 'hsl(0 70.9% 59.4%)',
    primary: 'hsl(0 0% 98%)',
    text: 'hsl(0 0% 98%)',
  },
} as const

export const NAV_THEME: Record<'light' | 'dark', Theme> = {
  light: { ...DefaultTheme, colors: COLORS.light },
  dark: { ...DarkTheme, colors: COLORS.dark },
}
