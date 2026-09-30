import type { ErrorObject } from './document'

/**
 * e2e 변형의 API 클라이언트가 2xx 가 아닌 결과를 기기 로그에 남길 때의 한 줄 - 스펙 11.3 의 가드.
 *
 * E2E 하네스(test/e2e/guard-log.sh)가 기기 로그에서 이 표식을 찾아, 플로가 선언하지 않은 상태가
 * 나오면 실패로 만든다. 상태 0 은 백엔드가 응답하지 못한 것(client.ts 가 합성한 오류)이다.
 *
 * 경로와 오류 코드만 적는다 - 쿼리·본문·헤더·문구를 적지 않는다. 토큰과 자격증명이 로그에 남지
 * 않는다(스펙 7.1).
 */
export const HTTP_FAILURE_MARKER = '[e2e-http]'

export function httpFailureLine(
  method: string,
  path: string,
  status: number,
  errors: readonly ErrorObject[],
): string {
  const codes = errors.map((error) => error.code ?? '-').join(',')
  return `${HTTP_FAILURE_MARKER} ${status} ${method.toUpperCase()} ${path} ${codes === '' ? '-' : codes}`
}
