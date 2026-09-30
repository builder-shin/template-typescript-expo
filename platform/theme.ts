import { DarkTheme, DefaultTheme, type Theme } from 'expo-router'

import { NAV_COLORS } from '@/platform/nav-colors'

/**
 * Stack 헤더·배경이 global.css 의 토큰과 같은 색을 쓰게 하는 내비게이션 테마. 색 값은
 * platform/nav-colors.ts 에 있다 - 토큰과 같은지를 시험이 node 에서 재도록 import 없는 파일로 뺐다.
 *
 * React Native Reusables 템플릿은 이 파일을 lib/theme.ts 에 두지만, expo-router 를
 * import 하므로 이 저장소에서는 lib/ 에 둘 수 없다(스펙 5장).
 */
export const NAV_THEME: Record<'light' | 'dark', Theme> = {
  light: { ...DefaultTheme, colors: NAV_COLORS.light },
  dark: { ...DarkTheme, colors: NAV_COLORS.dark },
}
