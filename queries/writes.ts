import {
  mutationOptions,
  useMutation,
  useQueryClient,
  type MutationKey,
  type QueryClient,
} from '@tanstack/react-query'

import type { ResourceDefinition } from '@/lib/resources/define'
import {
  IDLE_RESOURCE_FORM_STATE,
  type ResourceFormState,
  type ResourceFormValues,
} from '@/lib/resources/form'
import {
  createResource,
  deleteResource,
  isSessionRejected,
  updateResource,
  type WriteDeps,
} from '@/lib/resources/write'
import { apiRequest } from '@/platform/api'
import { sessionManager } from '@/platform/session'
import { applyCacheEffects, cacheEffects, mutationKeys } from '@/queries/keys'

/**
 * 자원의 쓰기 훅 - 생성·수정·삭제(스펙 8.4·8.5).
 *
 * 한 번의 쓰기가 지나는 갈래(세션 확인 → 요청 → 응답 해석)는 `lib/resources/write.ts` 가 정한다.
 * 여기서는 그 함수에 세션 관리자와 API 클라이언트를 꽂고, 성공한 쓰기를 무효화 표(`keys.ts`)에
 * 태우기만 한다 - 키를 손으로 적지 않는다. 훅이 쓰는 옵션(`createResourceMutationOptions` 등)은 내보낸다 -
 * 시험(test/unit/queries/writes.test.ts)이 `loginMutationOptions` 처럼 MutationObserver 로 그대로 돌린다.
 *
 * - access token 은 `sessionManager.getAccessToken()` 에서 받는다 - 회전은 그 안에서만 일어난다
 *   (스펙 7.2). 그 거절은 `write.ts` 가 잡아 앱 문구로 그린다. 회전이 판정을 받지 못해 돌아온 토큰이 이미
 *   만료됐으면 `write.ts` 가 보내지 않는다(만료 가드) - 그래서 세션(`current`)과 시계도 꽂는다.
 * - 세션 거절은 `write.ts` 가 던지고 쓰기 캐시(`MutationCache`)의 `onError` 한 곳이 받는다(스펙 9.2,
 *   `platform/query-client.ts`). 이 훅들은 그 경우를 따로 다루지 않는다 - 쓰기 화면은 보호 경로라
 *   세션이 지워지면 경로 가드가 로그인으로 보낸다.
 * - 세션 거절 말고 던져진 것은 결함이다 - `write.ts` 는 기대한 실패를 값으로 돌려준다. 결함은 훅이 렌더 중에 다시 던져
 *   오류 경계로 보낸다(`throwOnError`, 조회의 결함과 같다). 던지지 않으면 `mutate()` 가 삼켜 폼이 아무 말 없이 멈춘다.
 * - 화면 이동은 화면이 한다 - 제출 함수가 성공 콜백을 받는다. 캐시는 화면이 이동하기 전에 이 훅이
 *   바꾼다(훅 옵션의 `onSuccess` 가 `mutate()` 에 넘긴 콜백보다 먼저 불린다).
 * - 쓰기마다 `mutationKey` 가 있다(`keys.ts` 의 `mutationKeys`) - 폼이 그 키로 제출을 한 번에 하나로
 *   막는다(`queries/submit-once.ts`).
 */
const WRITE_DEPS: WriteDeps = {
  getAccessToken: sessionManager.getAccessToken,
  currentSession: sessionManager.current,
  now: () => Date.now(),
  send: apiRequest,
}

/**
 * 쓰기가 던진 것 가운데 세션 거절 말고는 결함이다. 세션 거절은 쓰기 캐시의 `onError` 가 받으니(platform/query-client.ts)
 * 화면에 남겨 두고 경로 가드가 로그인으로 보낸다. 결함은 오류 경계로 간다.
 */
function isWriteDefect(error: unknown): boolean {
  return !isSessionRejected(error)
}

/** 생성·수정 폼이 쓰는 것. */
export interface FormWrite {
  /** 이 쓰기의 키 - 폼이 제출을 한 번에 하나로 막는다(useSubmitOnce). */
  mutationKey: MutationKey
  /** 폼이 그릴 오류 상태 - 제출 전이거나 성공했으면 비어 있다. */
  state: ResourceFormState
  /** 제출 중 - 제출 버튼이 스피너만 그린다(스펙 8.7). */
  pending: boolean
  submit: (values: ResourceFormValues, onSaved: (id: string) => void) => void
}

/** 수정 폼이 쓰는 것 - 생성에 더해, 저장이 "그 자원이 없다" 를 받았는지. */
export interface EditWrite extends FormWrite {
  gone: boolean
}

/** 삭제가 쓰는 것. */
export interface DeleteWrite {
  mutationKey: MutationKey
  /** 삭제가 실패했을 때 그릴 문구 - 없으면 빈 배열이다. */
  messages: readonly string[]
  pending: boolean
  /**
   * 지웠다(이미 없었어도). 화면은 이 자원의 상세를 다시 부르지 않는다 - 삭제가 캐시에서 지운 상세를
   * 지켜보던 화면이 다시 그려지면 TanStack Query 가 새 조회를 만들어 없는 자원을 부른다(404).
   */
  deleted: boolean
  remove: (onDeleted: () => void) => void
}

/** 생성 쓰기의 옵션 - 성공하면 그 자원의 목록을 무효화한다(스펙 8.5 의 표). */
export function createResourceMutationOptions(
  queryClient: QueryClient,
  resource: ResourceDefinition,
) {
  return mutationOptions({
    mutationKey: mutationKeys.create(resource.type),
    mutationFn: (values: ResourceFormValues) => createResource(resource, values, WRITE_DEPS),
    onSuccess: (outcome) => {
      if (outcome.kind === 'saved') {
        applyCacheEffects(queryClient, cacheEffects({ kind: 'create', type: resource.type }))
      }
    },
    throwOnError: isWriteDefect,
  })
}

/** 생성. */
export function useCreateResource(resource: ResourceDefinition): FormWrite {
  const queryClient = useQueryClient()
  const options = createResourceMutationOptions(queryClient, resource)
  const mutation = useMutation(options)

  return {
    mutationKey: options.mutationKey,
    state: mutation.data?.kind === 'failed' ? mutation.data.state : IDLE_RESOURCE_FORM_STATE,
    pending: mutation.isPending,
    submit: (values, onSaved) => {
      mutation.mutate(values, {
        onSuccess: (outcome) => {
          if (outcome.kind === 'saved') onSaved(outcome.id)
        },
      })
    },
  }
}

/**
 * 수정 쓰기의 옵션 - 성공하면 그 상세와 목록을 무효화한다(스펙 8.5 의 표). 저장이 "그 자원이 없다" 를 받아도
 * 같은 둘을 무효화한다 - 밑에 깔린 상세 화면과 목록이 없어진 자원을 계속 그리지 않게 한다.
 */
export function updateResourceMutationOptions(
  queryClient: QueryClient,
  resource: ResourceDefinition,
  id: string,
) {
  return mutationOptions({
    mutationKey: mutationKeys.update(resource.type, id),
    mutationFn: (values: ResourceFormValues) => updateResource(resource, id, values, WRITE_DEPS),
    onSuccess: (outcome) => {
      if (outcome.kind !== 'failed') {
        applyCacheEffects(queryClient, cacheEffects({ kind: 'update', type: resource.type, id }))
      }
    },
    throwOnError: isWriteDefect,
  })
}

/** 수정. */
export function useUpdateResource(resource: ResourceDefinition, id: string): EditWrite {
  const queryClient = useQueryClient()
  const options = updateResourceMutationOptions(queryClient, resource, id)
  const mutation = useMutation(options)

  return {
    mutationKey: options.mutationKey,
    state: mutation.data?.kind === 'failed' ? mutation.data.state : IDLE_RESOURCE_FORM_STATE,
    pending: mutation.isPending,
    gone: mutation.data?.kind === 'notFound',
    submit: (values, onSaved) => {
      mutation.mutate(values, {
        onSuccess: (outcome) => {
          if (outcome.kind === 'saved') onSaved(outcome.id)
        },
      })
    },
  }
}

/**
 * 삭제 쓰기의 옵션 - 성공하면(이미 없어도) 그 상세를 캐시에서 지우고 목록을 무효화한다(스펙 8.5 의 표). 상세를
 * 무효화하지 않고 지우는 것은 무효화하면 없는 자원의 404 를 다시 받으러 가기 때문이다.
 */
export function deleteResourceMutationOptions(
  queryClient: QueryClient,
  resource: ResourceDefinition,
  id: string,
) {
  return mutationOptions({
    mutationKey: mutationKeys.delete(resource.type, id),
    mutationFn: () => deleteResource(resource, id, WRITE_DEPS),
    onSuccess: (outcome) => {
      if (outcome.kind === 'deleted') {
        applyCacheEffects(queryClient, cacheEffects({ kind: 'delete', type: resource.type, id }))
      }
    },
    throwOnError: isWriteDefect,
  })
}

/** 삭제. */
export function useDeleteResource(resource: ResourceDefinition, id: string): DeleteWrite {
  const queryClient = useQueryClient()
  const options = deleteResourceMutationOptions(queryClient, resource, id)
  const mutation = useMutation(options)

  return {
    mutationKey: options.mutationKey,
    messages: mutation.data?.kind === 'failed' ? mutation.data.messages : [],
    pending: mutation.isPending,
    deleted: mutation.data?.kind === 'deleted',
    remove: (onDeleted) => {
      mutation.mutate(undefined, {
        onSuccess: (outcome) => {
          if (outcome.kind === 'deleted') onDeleted()
        },
      })
    },
  }
}
