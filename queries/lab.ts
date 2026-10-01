import { mutationOptions, useMutation, type MutationKey } from '@tanstack/react-query'

import type { ExperimentResult } from '@/lib/lab/result'
import { runExperiment, type LabDeps } from '@/lib/lab/run'
import { isSessionRejected } from '@/lib/resources/write'
import { apiRequest, deviceAcceptLanguage } from '@/platform/api'
import { sessionManager } from '@/platform/session'

/**
 * 계약 실험실의 실험 하나를 돌리는 쓰기 훅(스펙 8.6).
 *
 * 실험마다 무엇을 보내고 응답을 어떻게 결과로 옮기는지는 `lib/lab/run.ts` 가 정한다. 여기서는 그 함수에 API
 * 클라이언트·세션 관리자·기기 언어를 꽂기만 한다. 결과는 캐시에 두지 않는다 - 조회가 아니라 누를 때마다 새로
 * 부르는 실험이라 쓰기(`useMutation`)의 결과로 들고, 화면을 떠나면 사라진다. 훅이 쓰는 옵션
 * (`labExperimentMutationOptions`)은 내보낸다 - 시험(test/unit/queries/lab.test.ts)이 MutationObserver 로 그대로 돌린다.
 *
 * - access token 은 쓰기와 같은 길로 받는다 - 세션 관리자의 토큰에 더해 지금의 세션(`current`)과 시계를 꽂는다.
 *   회전이 판정을 받지 못해 돌아온 토큰이 이미 만료됐거나 토큰을 받지 못했으면 실행부가 보내지 않고(만료 가드)
 *   카드가 앱 문구를 그린다(`failed`).
 * - 세션 거절(세션이 없거나 백엔드가 세션을 거절했다)은 쓰기 캐시(`MutationCache`)의 `onError` 한 곳이 받아 기기
 *   세션을 지운다(`platform/query-client.ts`, 스펙 9.2). 로그인으로 보내는 것은 화면이 넘긴 콜백이다 - 실험실은
 *   공개 경로라 경로 가드가 보내지 않는다(스펙 7.3).
 * - 세션 거절 말고 던져진 것은 결함이다 - 실행부는 응답을 전부 결과로 옮긴다(`apiRequest` 는 던지지 않고, 설정
 *   오류만 일부러 던진다 - `queries/AGENTS.md`). 결함은 훅이 렌더 중에 다시 던져 오류 경계로 보낸다(`throwOnError`,
 *   자원의 쓰기 훅과 같다). 던지지 않으면 `mutate()` 가 삼켜 카드가 아무 말 없이 멈춘다.
 * - 쓰기마다 키가 있다(`['lab', <실험 id>]`) - 화면이 그 키로 한 번에 하나만 돌린다(`queries/submit-once.ts`).
 */
const LAB_DEPS: LabDeps = {
  send: apiRequest,
  getAccessToken: sessionManager.getAccessToken,
  currentSession: sessionManager.current,
  now: () => Date.now(),
  deviceLanguage: deviceAcceptLanguage,
}

/** 실험 카드가 쓰는 것. */
export interface LabExperiment {
  /** 이 실험의 쓰기 키 - 카드가 한 번에 하나만 돌린다(useSubmitOnce). */
  mutationKey: MutationKey
  /** 마지막으로 끝난 실행의 결과. 돌리기 전이거나 도는 중이거나 결과 없이 끝났으면 null 이다. */
  result: ExperimentResult | null
  /** 도는 중 - 실행 버튼이 스피너만 그린다(스펙 8.7). */
  pending: boolean
  /** 받은 토큰을 쓸 수 없어 요청하지 않고 끝났다(만료 가드·토큰을 받지 못함) - 카드가 앱 문구를 그린다. */
  failed: boolean
  /** 실험을 돌린다. 세션 거절로 끝나면 `onSessionRejected` 를 부른다(화면이 로그인으로 보낸다). */
  run: (onSessionRejected: () => void) => void
}

/** 실험 하나의 쓰기 옵션 - 결과를 캐시에 옮기지 않는다. 세션 거절이 아닌 예외는 오류 경계로 간다. */
export function labExperimentMutationOptions(id: string) {
  return mutationOptions({
    mutationKey: ['lab', id],
    mutationFn: () => runExperiment(id, LAB_DEPS),
    throwOnError: (error) => !isSessionRejected(error),
  })
}

/** `lib/lab/experiments.ts` 의 실험 하나. */
export function useLabExperiment(id: string): LabExperiment {
  const options = labExperimentMutationOptions(id)
  const mutation = useMutation(options)

  return {
    mutationKey: options.mutationKey,
    result: mutation.data?.kind === 'result' ? mutation.data.result : null,
    pending: mutation.isPending,
    failed: mutation.data?.kind === 'unusable',
    run: (onSessionRejected) => {
      mutation.mutate(undefined, {
        onError: (error) => {
          if (isSessionRejected(error)) onSessionRejected()
        },
      })
    },
  }
}
