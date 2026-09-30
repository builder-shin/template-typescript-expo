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

## 플랫폼을 모른다

이 디렉터리는 react·react-native·expo를 import하지 않는다(ESLint가 막는다). 그래서 node의
vitest에서 그대로 돌고, 앱에서는 RN의 fetch 위에서 돈다. 둘의 차이(RN fetch polyfill의
동작 등)는 `client.ts`의 이탈 기록에 있다.
