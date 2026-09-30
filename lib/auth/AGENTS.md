# lib/auth/ 작업 지침

세션 모델과 직렬화, 만료 판정, 회전 결정, 자격증명 문서, 보호 경로 목록을 소유한다(스펙 5장).
저장 매체와 화면 이동은 소유하지 않는다 - SecureStore 는 `platform/`, 이동은 `app/`이 한다.

## 회전은 한 곳에서, 한 번에 하나만

백엔드는 회전할 때 구 refresh token 을 즉시 폐기하고, 폐기된 토큰을 다시 내밀면 그 사용자의
세션을 전부 끊는다. 그래서:

- `/api/v1/auth/refresh`를 부르는 코드는 `rotation.ts`의 `rotateSession()` 하나이고, 그것을
  부르는 곳은 `session-manager.ts` 하나다.
- 인증이 필요한 요청은 `getAccessToken()`을 지난다. 진행 중인 회전이 있으면 그 Promise 를 같이
  기다린다. 새 세션은 저장소에 먼저 쓰고 그다음 돌려준다.
- 401 에 회전·재시도를 붙이지 않는다. 인증 오류를 받으면 `signOut()`하고 로그인으로 보낸다.

## 요청은 주입받은 전송으로만

인증 호출은 `request()`를 직접 부르지 않고 `send: JsonApiSend`(`lib/jsonapi/send.ts`)를 받는다.
앱에서는 `platform/api.ts`의 `apiRequest`가 들어온다 - Accept-Language 를 싣는 자리는 그 한
곳이다(스펙 9.4).

## 파일

| 파일                 | 역할                                                                             |
| -------------------- | -------------------------------------------------------------------------------- |
| `tokens.ts`          | (복사) access 만료 시각, 60초 여유 판정                                          |
| `credentials.ts`     | (복사·수정) 가입·로그인 요청과 해석, 가입 뒤 로그인                              |
| `flow.ts`            | (복사) 복귀 경로 검사(`safeRedirectTarget`), 폼 오류 상태, 로그인·가입 뒤의 결정 |
| `form-state.ts`      | (복사·수정) 폼 입력 이름과 상태, 쓸 수 없는 응답의 문구                          |
| `logout.ts`          | (복사·수정) 기기 쪽을 먼저 비우고 refresh 폐기를 요청                            |
| `rotation.ts`        | (복사·수정) 회전 요청과 응답 해석                                                |
| `protected-paths.ts` | 보호 경로 목록 하나와 로그인 주소                                                |
| `session-store.ts`   | 저장 모양(항목 하나의 JSON)과 복원 판단                                          |
| `session-manager.ts` | 회전의 유일한 자리, 세션 상태와 구독                                             |

(복사) 표시 파일은 `template-typescript-nextjs`에서 복사했다. 출처와 이탈은
`docs/provenance/copied-core.json`이다. 그 주석의 "쿠키"·"proxy.ts"·"Server Action" 같은 자리는
원본 저장소의 것이다.

## 검증

순수 판단은 `test/unit/auth/`가 잰다. 저장 매체·전송·시계는 가짜를 주입한다. 실제 가입·로그인·
로그아웃·세션 복원은 `test/e2e/`의 플로가 잰다.
