import '@/global.css'

import { PortalHost } from '@rn-primitives/portal'
import { QueryClientProvider } from '@tanstack/react-query'
import { Stack, ThemeProvider } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { useUniwind } from 'uniwind'

import { FatalConfig } from '@/components/app/fatal-config'
import { loadStartupSettings } from '@/platform/config'
import { queryClient } from '@/platform/query-client'
import { sessionManager, useSessionStatus } from '@/platform/session'
import { NAV_THEME } from '@/platform/theme'

export { ErrorBoundary } from 'expo-router'

// 모듈 평가 시점에 한 번 - 어떤 요청보다 먼저 설정 자리를 extra 로 돌린다.
const STARTUP = loadStartupSettings()

// 설정이 맞을 때만 세션을 되살리는 동안 스플래시를 붙잡는다(스펙 7.1). 컴포넌트 안에서 부르면
// 스플래시가 이미 내려간 뒤일 수 있어(expo-splash-screen 의 안내) 모듈 평가 시점에 부른다. 설정이
// 틀리면 붙잡지 않는다 - 치명 오류 화면이 곧바로 보인다.
if (STARTUP.ok) void SplashScreen.preventAutoHideAsync()

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

  return <AppRoot scheme={scheme} />
}

/**
 * 설정이 맞을 때만 그리는 자식. 세션 복원·Query 처럼 요청으로 이어질 수 있는 일은 여기 둔다 -
 * 루트에 두면 치명 오류 경로에서도 돌고, 설정 오류(request() 가 던진다)가 ErrorBoundary 로 가서
 * 치명 오류 화면을 가린다(platform/AGENTS.md).
 */
function AppRoot({ scheme }: { scheme: 'light' | 'dark' }) {
  const ready = useSessionStatus() !== 'restoring'

  // 저장된 세션을 되살린다(스펙 7.1). 던지지 않고, 두 번 불려도(개발 모드의 StrictMode) 저장소는
  // 한 번만 읽는다(lib/auth/session-manager.ts).
  useEffect(() => {
    void sessionManager.restore()
  }, [])

  useEffect(() => {
    if (ready) SplashScreen.hide()
  }, [ready])

  // 복원이 끝날 때까지 아무것도 그리지 않는다 - 스플래시가 덮고 있다. 로그인 여부를 모른 채
  // 그리면 헤더와 경로 가드가 한 번 틀린 상태로 그려진다.
  if (!ready) return null

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={NAV_THEME[scheme]}>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <Stack>
          {/* 앱 셸은 자기 Stack 헤더를 그린다(app/(app)/_layout.tsx) - 헤더가 두 겹이 되지 않게 한다. */}
          <Stack.Screen name="(app)" options={{ headerShown: false }} />
        </Stack>
        <PortalHost />
      </ThemeProvider>
    </QueryClientProvider>
  )
}
