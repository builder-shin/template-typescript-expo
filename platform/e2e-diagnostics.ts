import type { Query } from '@tanstack/react-query'
import { usePathname } from 'expo-router'
import { useEffect } from 'react'
import { AppState } from 'react-native'

import { variantProfile } from '@/lib/config/app-variant'
import { startupVariant } from '@/platform/config'
import { queryClient } from '@/platform/query-client'

/**
 * e2e만 경계 상태를 정보로 남긴다(D7 실측 K3, D7-R20). 딥링크 뒤 홈/스켈레톤 정지의 원인이 아직 입증되지
 * 않아 라우트·AppState·상세 조회 상태만 관측한다. 요청·응답 본문, 토큰, 쿼리 문자열은 남기지 않는다.
 * 이동·구독 옵션·재시도·시간을 바꾸지 않는다. run-ios.sh의 JS 로그 수집과 ios-log.ts 변환이 이 줄도 보존한다.
 */
export function observeE2eRuntime(pathname: string): () => void {
  if (!variantProfile(startupVariant()).logsHttpFailures) return () => undefined
  console.info(`[e2e-state] route=${pathname} appState=${AppState.currentState}`)
  const appState = AppState.addEventListener('change', (state) => {
    console.info(`[e2e-state] appState=${state}`)
  })
  const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
    // QueryCache의 AnyQuery가 지운 key의 readonly unknown[] 타입을 복원한다.
    const query = event.query as Query
    const key = query.queryKey
    if (key[0] !== 'resources' || key[2] !== 'detail') return
    console.info(
      `[e2e-state] query=${String(key[1])}/${String(key[3])} status=${query.state.status} fetchStatus=${query.state.fetchStatus} observers=${query.getObserversCount()}`,
    )
  })
  return () => {
    appState.remove()
    unsubscribe()
  }
}

/** 설정 검증을 통과한 AppRoot에서만 부른다. 라우트가 바뀌면 이전 관측 구독을 거두고 새 경로를 남긴다. */
export function useE2eDiagnostics(): void {
  const pathname = usePathname()
  useEffect(() => observeE2eRuntime(pathname), [pathname])
}
