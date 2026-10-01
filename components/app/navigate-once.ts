import { useIsFocused } from 'expo-router'
import { useEffect, useState } from 'react'

import { createOnce } from '@/lib/navigation/once'

/**
 * 화면을 쌓는 이동을 한 번만 한다(D3 최종 검토 M8) - 목록의 행·조건 바꾸기·"새로 만들기"·"수정" 을 빠르게 두 번
 * 누르면 같은 화면이 두 벌 쌓였다. 첫 누름이 잠그고(lib/navigation/once.ts), 이 화면이 다시 앞에 오면 푼다
 * (`useIsFocused`). 쓰기의 제출은 이것이 아니라 `useSubmitOnce`(queries/submit-once.ts)가 막는다.
 *
 * 이동이 이 화면을 뒤로 보내지 않으면 잠금이 남는다 - 이 저장소의 이동은 모두 다른 화면을 쌓거나(push) 이 화면을
 * 떼므로(보호 경로면 경로 가드가 앱 셸을 로그인 화면으로 바꿔 끼운다) 그런 이동이 없다.
 */
export function useNavigateOnce(): (navigate: () => void) => void {
  const [once] = useState(createOnce)
  const focused = useIsFocused()

  useEffect(() => {
    if (focused) once.release()
  }, [focused, once])

  return (navigate) => {
    once.run(navigate)
  }
}
