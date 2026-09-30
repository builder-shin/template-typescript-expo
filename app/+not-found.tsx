import { Stack } from 'expo-router'

import { NotFoundView } from '@/components/app/not-found-view'

/** 앱에 없는 경로 - 딥링크로 들어온 모르는 주소도 여기 온다. */
export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: '찾을 수 없음' }} />
      <NotFoundView />
    </>
  )
}
