# lib/jsonapi/ 작업 지침

루트 `AGENTS.md`의 계층 소유권 표가 이 디렉터리에 배정한 것: 문서 파싱(`document.ts`) ·
`included` 정규화와 관계 해석(`normalize.ts`) · 쿼리 파라미터 직렬화(`query.ts`) · 오류
분류(`errors.ts`) · HTTP 클라이언트(`client.ts`). 백엔드 템플릿들의 `app/jsonapi/`와 마주
보는 계층이다.

## 복사본이다

다섯 파일은 `template-typescript-nextjs`에서 복사했다. 출처 커밋과 원본에서 달라진 곳은
`docs/provenance/copied-core.json`이 전부 갖는다 - 여기서 무엇을 바꾸면 그 파일의
`divergences`에 `what`·`why`를 더한다. 게이트가 기록의 형식과 경로를 검사한다.

주석에 나오는 "스펙 N장", "D2 Task N", `proxy.ts`, `app/error.tsx` 같은 자리는 **원본
저장소의 것**이다. 원본과 비교하기 쉽게 주석을 고치지 않고 두었다.

## 자원을 모른다

이 디렉터리는 어떤 자원 이름도 몰라야 한다. `examples`·`exampleTags`·`exampleCategories`
처럼 실제 자원 이름을 가리키는 문자열 리터럴, 자원별 필드 이름에 의존하는 분기가 코드에
나타나면 위반이다. 있어도 되는 문자열은 JSON:API 문법 자체, 연산자 이름, 오류 **코드**,
미디어 타입, HTTP 헤더 이름이다.

## 오류 문구 카탈로그를 두지 않는다

`errors.ts`는 code로 동작만 분기한다. 표시 문구는 백엔드가 낸 값을 그대로 쓴다(스펙 9장).
예외는 `client.ts`가 합성하는 코드뿐이다 - 백엔드가 응답조차 주지 못한 상황이라 앱이 문구를
가질 수밖에 없다. 합성 오류는 `isSyntheticError`로 판정한다. 합성 코드 문자열을 다른
곳에서 직접 비교하지 않는다.

합성 코드는 넷이다 - 원본의 `REQUEST_ASSEMBLY_FAILED`·`NETWORK_ERROR`·`NON_JSONAPI_RESPONSE`에
이 저장소가 더한 `REQUEST_TIMEOUT`(`REQUEST_TIMEOUT_MS` 15초, 스펙 8.5). 호출자가 `signal`로
끊은 요청은 타임아웃이 아니다 - 응답을 받기 전에 끊은 요청은 `NETWORK_ERROR`, 본문을 읽는 도중
끊은 요청은 `NON_JSONAPI_RESPONSE`(status는 응답의 것)다. 시간이 다 된 요청은 어느 단계에서든
`REQUEST_TIMEOUT`이다.

## 플랫폼을 모른다

이 디렉터리는 react·react-native·expo를 import하지 않는다(ESLint가 막는다 - 정적 import·
`export … from`만 잰다. 동적 `import()`·`require()`는 `lib/`에서 쓰지 않는다). 그래서 node의
vitest에서 그대로 돌고, 앱에서는 SDK 57의 `expo/fetch` 위에서 돈다.

- `expo/fetch`는 `cache`를 읽지 않고, RN 폴리필(`EXPO_PUBLIC_USE_RN_FETCH=1`)은 `cache`가
  no-store인 GET의 URL에 `_=<시각>`을 붙인다. 어느 쪽이든 캐시 정책은 TanStack Query가 소유하므로
  `request()`는 `cache`를 넘기지 않는다(스펙 8.5). 네이티브 HTTP 캐시(Android OkHttp·iOS URLCache)는
  응답 헤더를 따른다(미측정 - D2가 잰다).
- 취소는 단계마다 다르게 거절된다. 요청 단계의 취소는 `AbortError`가 아니라 `Error`(`FetchError`)이고
  (실측 M6), 본문을 스트림(`response.body`)으로 읽는 중의 취소는 `AbortError`다. 그래서 취소를 오류
  이름으로 가르지 않는다.
- `request()`가 쓰는 `response.json()`은 스트림이 아니라 네이티브 `text()`를 기다려서, 취소가 그것을
  거절시켜 준다고 믿을 수 없다. 그래서 `readJson()`이 `json()`을 요청 signal과 경주시킨다 - 본문을
  읽는 도중의 취소와 타임아웃이 어느 런타임에서든 위 분류로 끝나고, 단위 시험이 끝나지 않는 `json()`으로
  그것을 지킨다. 이 경주를 걷어내지 않는다.
- 근거와 소스의 파일·줄은 `docs/superpowers/notes/2026-09-30-d1-measurements.md`의 M6, 원본과
  달라진 곳은 `docs/provenance/copied-core.json`의 `client.ts` 이탈 기록에 있다.
