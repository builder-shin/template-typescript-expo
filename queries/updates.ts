import { mutationOptions, useMutation } from '@tanstack/react-query'

import {
  buildInfoView,
  checkAndApplyUpdate,
  updateCheckView,
  type BuildInfoRow,
} from '@/lib/updates/build-info'
import { readBuildInfo, updatesApi } from '@/platform/updates'
import { useSubmitOnce } from '@/queries/submit-once'

/** 홈의 빌드 정보 카드가 그리는 것(components/app/build-info-card.tsx). */
export interface BuildInfoCardState {
  rows: BuildInfoRow[]
  /** "업데이트 확인" 을 누를 수 있다 - OTA 를 끈 빌드는 안내만 그린다. */
  canCheck: boolean
  /** 확인하거나 다시 켜는 중 - 버튼이 스피너만 그린다. */
  busy: boolean
  /** 끝난 확인의 결과 문구. */
  message: string | null
  check: () => void
}

/**
 * "업데이트 확인" 의 쓰기 옵션 - 결과를 캐시에 옮기지 않는다. 확인은 결과를 값으로 돌려준다
 * (`checkAndApplyUpdate` 는 expo-updates 의 거절까지 `failed` 로 담는다) - 그래서 `mutationFn` 안에서 던져진 것은
 * 결함이고 오류 경계로 간다(`throwOnError`, queries/AGENTS.md 의 쓰기 오류 규칙). 세션을 쓰지 않으니 세션 거절이
 * 없다 - 쓰기 캐시의 `onError`(인증 오류의 한 곳)에 닿을 것이 없다. 시험(test/unit/queries/updates.test.ts)이
 * MutationObserver 로 그대로 돌린다.
 */
export function updateCheckMutationOptions() {
  return mutationOptions({
    mutationKey: ['updates', 'check'],
    mutationFn: () => checkAndApplyUpdate(updatesApi),
    throwOnError: true,
  })
}

/**
 * 빌드 정보 카드의 훅(스펙 10.6). 행과 확인의 순서·문구는 lib/updates/build-info.ts 가 정하고, 여기서는 그
 * 판단에 expo-updates 의 호출(platform/updates.ts)을 꽂아 쓰기 하나로 돌린다. 결과는 캐시에 두지 않는다 -
 * 누를 때마다 새로 묻는 확인이고, 받은 업데이트가 있으면 앱이 다시 뜬다. 한 번에 하나만 돈다(submit-once.ts).
 */
export function useBuildInfoCard(): BuildInfoCardState {
  const options = updateCheckMutationOptions()
  const mutation = useMutation(options)
  const submitOnce = useSubmitOnce(options.mutationKey)
  const view = buildInfoView(readBuildInfo())

  return {
    ...view,
    ...updateCheckView(mutation.isPending, mutation.data),
    check: () => {
      submitOnce(() => {
        mutation.mutate()
      })
    },
  }
}
