/**
 * 던져진 값을 기기 로그의 한 줄로 만든다 - 세션 관리자의 거절(`establish`·`getAccessToken`·`signOut`·`logout`)을
 * 남기는 자리가 함께 쓴다(호출자는 삼키지 말고 알린다 - 이 디렉터리의 AGENTS.md). 오류면 이름과 문구뿐이다. 오류가
 * 아닌 값은 값이 아니라 종류(`typeof`)만 적는다 - 문자열로 던져진 토큰이나 문서 통째가 로그에 실리지 않는다(스펙 7.1).
 * 스택도 적지 않는다.
 */
export function errorDetail(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : typeof error
}
