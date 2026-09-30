import '@/global.css'

import { PortalHost } from '@rn-primitives/portal'
import { Stack, ThemeProvider } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useUniwind } from 'uniwind'

import { NAV_THEME } from '@/platform/theme'

export { ErrorBoundary } from 'expo-router'

export default function RootLayout() {
  const { theme } = useUniwind()
  const scheme = theme === 'dark' ? 'dark' : 'light'

  return (
    <ThemeProvider value={NAV_THEME[scheme]}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack />
      <PortalHost />
    </ThemeProvider>
  )
}
