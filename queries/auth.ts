import { useIsMutating, useMutation, useQueryClient } from '@tanstack/react-query'

import { signIn, signUpThenSignIn, type Credentials } from '@/lib/auth/credentials'
import { decideAfterLogin, decideAfterRegistration, type SignInPlan } from '@/lib/auth/flow'
import type { LogoutOutcome } from '@/lib/auth/logout'
import { apiRequest } from '@/platform/api'
import { sessionManager } from '@/platform/session'

/**
 * 인증 쓰기 훅 - 가입·로그인·로그아웃(스펙 7.4).
 *
 * 판단은 lib/auth 가 한다(무엇을 보낼지, 응답을 어떻게 읽을지, 어디로 돌아갈지). 여기서는 그
 * 결정을 실행만 한다 - 결정이 establish 면 세션을 저장소에 먼저 세우고 결정을 돌려준다. 화면
 * 이동은 화면이 한다.
 */

/**
 * 던져진 오류를 로그로 남긴다. 이름과 문구만 적는다 - 세션·자격증명을 인자로 받지 않으므로 토큰이
 * 로그에 실리지 않는다(스펙 7.1).
 */
function logFailure(what: string, error: unknown): void {
  const detail = error instanceof Error ? `${error.name}: ${error.message}` : typeof error
  console.error(`[auth] ${what} - ${detail}`)
}

/**
 * 로그인·가입이 받은 토큰으로 세션을 세운다.
 *
 * 세션 관리자는 저장소 쓰기가 실패하면 메모리에 세운 뒤에 거절한다(lib/auth/session-manager.ts) -
 * 백엔드가 이미 토큰을 내줬기 때문이다. 그 거절은 로그인 실패가 아니다: 여기서 잡아 남기고 로그인을
 * 이어 간다. 화면 이동은 거절이 아니라 세션 상태를 따른다(lib/auth/AGENTS.md). 이 실행 동안은
 * 로그인 상태이고 앱을 닫으면 로그아웃된다.
 */
async function establishIfSignedIn(plan: SignInPlan): Promise<SignInPlan> {
  if (plan.kind === 'establish') {
    try {
      await sessionManager.establish(plan.session, plan.refreshExpiresIn)
    } catch (error) {
      logFailure('세션을 저장소에 쓰지 못했다 - 이 실행 동안만 로그인 상태다', error)
    }
  }
  return plan
}

/**
 * 로그인·가입 쓰기는 캐시에 오래 두지 않는다. mutation 캐시는 변수(평문 비밀번호)와 결과(토큰)를
 * 기본 5분 들고 있고, 로그아웃이 비우는 것은 조회 캐시뿐이다(removeQueries) - 화면이 닫혀 구독이
 * 끊기면 1초 안에 치우게 한다. 0 으로 두지 않는다: query-core 는 구독이 없는데 아직 진행 중인
 * 쓰기의 치우기를 같은 시간으로 다시 예약하므로, 요청 중에 화면이 닫히면 0ms 타이머가 쉬지 않고 돈다.
 */
const DISCARD_SOON_MS = 1_000

/** 로그인. `rawNext` 는 화면이 받은 `next` 파라미터 그대로다 - 검사는 decideAfterLogin 이 한다. */
export function useLoginMutation(rawNext: unknown) {
  return useMutation({
    mutationFn: async (credentials: Credentials) =>
      establishIfSignedIn(
        decideAfterLogin(await signIn(credentials, apiRequest), rawNext, credentials.email),
      ),
    gcTime: DISCARD_SOON_MS,
    // 백엔드의 거절은 예외가 아니라 결정(SignInPlan)으로 온다. 여기 오는 것은 예외뿐이다.
    onError: (error) => {
      logFailure('로그인이 예외로 끝났다', error)
    },
  })
}

/** 가입 - register 다음 login(스펙 7.4). 계정은 만들어졌는데 로그인이 실패하면 상태가 그것을 싣는다. */
export function useRegisterMutation(rawNext: unknown) {
  return useMutation({
    mutationFn: async (credentials: Credentials) =>
      establishIfSignedIn(
        decideAfterRegistration(
          await signUpThenSignIn(credentials, apiRequest),
          rawNext,
          credentials.email,
        ),
      ),
    gcTime: DISCARD_SOON_MS,
    onError: (error) => {
      logFailure('가입이 예외로 끝났다', error)
    },
  })
}

/**
 * 로그아웃 쓰기의 키. 로그아웃 버튼은 스택의 화면마다 헤더에 하나씩 있고(앱 셸이 그린다), 진행 중인지는
 * 어느 버튼이 눌렸는지와 무관하게 하나다 - useIsLoggingOut 이 이 키로 찾는다.
 */
const LOGOUT_MUTATION_KEY = ['auth', 'logout'] as const

/**
 * 로그아웃 - 기기 세션과 Query 캐시를 먼저 비우고 refresh 폐기를 요청한다(스펙 7.4·8.5).
 *
 * 세션 관리자는 진행 중인 회전이 있으면 그것이 끝나길 기다리므로 요청 시간 제한(15초)만큼 걸릴 수
 * 있다. 그동안 세션은 signedIn 이다. 저장소를 지우지 못하면 기기 세션과 캐시를 비운 뒤에 거절한다 -
 * 그 거절은 onError 가 남기고, 화면은 거절이 아니라 세션 상태를 따른다(이미 signedOut 이다).
 *
 * `onSettled` 를 훅 수준에서 받는다. 눌린 로그아웃 버튼은 끝나기 전에 사라질 수 있는데(그 화면이
 * 닫히거나 앱 셸이 헤더를 바꾼다), TanStack Query 는 언마운트된 호출자가 mutate() 에 넘긴 콜백을
 * 부르지 않는다 - 훅 옵션의 콜백은 부른다.
 */
export function useLogoutMutation(onSettled: () => void) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationKey: LOGOUT_MUTATION_KEY,
    mutationFn: (): Promise<LogoutOutcome> =>
      sessionManager.logout(() => {
        queryClient.removeQueries()
      }),
    onError: (error) => {
      logFailure('로그아웃이 오류로 끝났다 - 기기 세션과 캐시는 이미 비웠다', error)
    },
    onSettled,
  })
}

/**
 * 로그아웃이 진행 중인가. 로그아웃은 기기 세션을 비운 뒤에도 폐기 요청이 끝날 때까지 이어진다 - 앱 셸은
 * 그동안 로그아웃 버튼(스피너)을 두고 경로 가드를 미룬다. 진행 중인 요청을 보는 것이라 눌린 버튼이
 * 화면에서 사라져도 같은 값을 돌려준다.
 */
export function useIsLoggingOut(): boolean {
  return useIsMutating({ mutationKey: LOGOUT_MUTATION_KEY }) > 0
}
