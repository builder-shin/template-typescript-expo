import { useQueryClient, type MutationKey, type QueryClient } from '@tanstack/react-query'

/**
 * 제출 하나가 끝나기 전의 두 번째 제출을 버리는 가드 - 폼(자격증명·자원)·삭제 확인 시트·계약 실험실이 함께 쓴다.
 *
 * 화면이 받은 `isPending` 은 렌더 때의 값이다. 제출 버튼과 키보드의 이동 키가 한 틱 안에 함께 눌리면 둘째
 * 제출도 `isPending` 이 거짓인 렌더를 보고 지나가 요청이 둘 나간다 - 가입이면 첫 요청이 세션을 세우고 둘째가
 * 409 를 받아 로그인한 채 "이미 가입된 이메일" 배너를 보고, 생성이면 행이 둘 생긴다(백엔드에 유일성 제약이
 * 없다). 그래서 렌더를 거치지 않는 값을 본다: TanStack Query 의 쓰기는 `mutate()` 가 돌아오기 전에 캐시에서
 * 진행 중이 되고(`Mutation.execute` 가 첫 await 전에 pending 을 알린다) 끝나는 순간 풀린다. 같은
 * `mutationKey` 의 쓰기가 진행 중이면 이번 제출을 버린다.
 *
 * ref 로 잠그고 `isPending` 이 거짓으로 돌아온 효과에서 푸는 모양은 쓰지 않는다 - 알림은 setTimeout 0 뒤에
 * 가므로 응답이 첫 알림보다 먼저 오면 화면이 진행 중인 렌더를 한 번도 보지 못해 잠금이 풀리지 않는다.
 */
export function submitOnce(
  client: QueryClient,
  mutationKey: MutationKey,
  submit: () => void,
): boolean {
  if (client.isMutating({ mutationKey }) > 0) return false
  submit()
  return true
}

/**
 * 쓰는 쪽의 모양 - 폼과 확인 시트는 제출이 부를 쓰기의 키를 받아(자격증명 폼은 `LOGIN_MUTATION_KEY` 등, 자원 폼은 쓰기
 * 훅의 `mutationKey`) 제출을 이 함수로 감싼다. 계약 실험실은 실험마다 따로 도는 쓰기의 키(`['lab', id]`,
 * `queries/lab.ts`)로 실행 버튼의 눌림을 감싼다 - 한 실험의 둘째 누름만 버리고 다른 실험은 막지 않는다. `submit` 안에서
 * 그 키의 `mutate()` 가 불려야 한다.
 */
export function useSubmitOnce(mutationKey: MutationKey): (submit: () => void) => void {
  const client = useQueryClient()
  return (submit) => {
    submitOnce(client, mutationKey, submit)
  }
}
