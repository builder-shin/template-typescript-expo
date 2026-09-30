import '@/global.css'

import { PortalHost } from '@rn-primitives/portal'
import { Stack, ThemeProvider } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useUniwind } from 'uniwind'

import { FatalConfig } from '@/components/app/fatal-config'
import { loadStartupSettings } from '@/platform/config'
import { NAV_THEME } from '@/platform/theme'

export { ErrorBoundary } from 'expo-router'

// 모듈 평가 시점에 한 번 - 어떤 요청보다 먼저 설정 자리를 extra 로 돌린다.
const STARTUP = loadStartupSettings()

export default function RootLayout() {
  const { theme } = useUniwind()
  const scheme = theme === 'dark' ? 'dark' : 'light'

  if (!STARTUP.ok) {
    return (
      <ThemeProvider value={NAV_THEME[scheme]}>
        <FatalConfig message={STARTUP.message} />
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider value={NAV_THEME[scheme]}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack />
      <PortalHost />
    </ThemeProvider>
  )
}
