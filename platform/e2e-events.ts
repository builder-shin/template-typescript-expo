import { variantProfile } from '@/lib/config/app-variant'
import { startupVariant } from '@/platform/config'

/**
 * R33의 입력/요청 지연 경계 관측(D7 실측 K3). 값·본문·토큰은 인자로 받지 않고 길이만 받는다.
 * 정보 로그만 추가하며 입력·제출·HTTP의 순서와 반환 값, 타임아웃은 바꾸지 않는다.
 */
export function observeE2eCredentials(
  event: 'email' | 'password' | 'submit',
  mode: 'current-password' | 'new-password',
  sequence: number,
  emailLength: number,
  passwordLength: number,
): void {
  if (!variantProfile(startupVariant()).logsHttpFailures) return
  console.info(
    `[e2e-state] credentials=${event} mode=${mode} seq=${sequence} time=${Date.now()} emailLength=${emailLength} passwordLength=${passwordLength}`,
  )
}

let requestSequence = 0

/** API 호출 직전과 결과 수신 직후를 같은 id로 잇는다. native CFNetwork 시각과 대조한다. */
export function startE2eRequest(path: string, method: string): (status: number) => void {
  if (!variantProfile(startupVariant()).logsHttpFailures) return () => undefined
  const id = ++requestSequence
  const started = Date.now()
  console.info(
    `[e2e-state] http=start id=${id} time=${started} method=${method} path=${path.split('?')[0]}`,
  )
  return (status) => {
    const finished = Date.now()
    console.info(
      `[e2e-state] http=finish id=${id} time=${finished} elapsed=${finished - started} status=${status}`,
    )
  }
}
