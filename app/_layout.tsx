import '@/global.css'

import { PortalHost } from '@rn-primitives/portal'
import { QueryClientProvider } from '@tanstack/react-query'
import {
  ErrorBoundary as RouterErrorBoundary,
  Stack,
  ThemeProvider,
  type ErrorBoundaryProps,
} from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { useUniwind } from 'uniwind'

import { FatalConfig } from '@/components/app/fatal-config'
import { loadStartupSettings } from '@/platform/config'
import { useE2eDiagnostics } from '@/platform/e2e-diagnostics'
import { markNativeWarningsForE2e } from '@/platform/e2e-log'
import { queryClient, useQueryRefetchTriggers } from '@/platform/query-client'
import { sessionManager, useSessionStatus } from '@/platform/session'
import { NAV_THEME } from '@/platform/theme'
import { retryWithClearedQueries } from '@/queries/error-boundary'

/**
 * 렌더 중 예외의 경계(스펙 9.3) - 화면은 Expo Router 의 기본 그대로다. "Retry" 는 조회 캐시를 비운 뒤 경계를 푼다:
 * 결과 값으로 캐시에 든 결함을 요청 없이 다시 던지지 않고 다시 부른다(queries/error-boundary.ts, 스펙 9.3 의 D8 정정).
 * 출구를 따로 두지 않는다 - 이 경계는 루트 레이아웃을 통째로 바꿔 그려 떠 있는 동안 내비게이터가 없고, 풀린 뒤의 앱은
 * 루트 Stack의 일반 초기 화면(홈)에서 새로 시작하며 cold 초기 URL은 다시 적용될 수 있다.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <RouterErrorBoundary error={error} retry={() => retryWithClearedQueries(queryClient, retry)} />
  )
}

// 모듈 평가 시점에 한 번 - 어떤 요청보다 먼저 설정 자리를 extra 로 돌린다.
const STARTUP = loadStartupSettings()

// e2e 변형이면 JS 경고에 표식을 붙인다 - iOS 의 E2E 가드가 경고를 가르는 재료다(platform/e2e-log.ts). 변형은 설정이
// 맞을 때만 읽는다.
if (STARTUP.ok) markNativeWarningsForE2e()

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

  // 앱 복귀·네트워크 복귀 때 다시 부른다(스펙 8.5, platform/query-client.ts).
  useQueryRefetchTriggers()
  useE2eDiagnostics()

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
