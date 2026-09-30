# lib/navigation/ 작업 지침

밖에서 들어온 URL·딥링크를 앱 안 주소로 바꾸는 판단을 둔다(루트 `AGENTS.md` 의 계층 표). 화면·fetch·네이티브
모듈을 모른다 - 이 빌드의 scheme 은 `platform/config.ts`(`appSchemes` - `Constants.expoConfig.scheme`)가 읽어 넘기고,
라우터에 잇는 것은 `app/+native-intent.tsx`(Expo Router 의 특별 파일)의 `redirectSystemPath` 다. 이 디렉터리의
파일은 이 저장소의 새 파일이다 - 복사본이 아니라 출처 기록에 없다.

## 왜 있는가

Expo Router 57.0.24 는 밖에서 들어온 URL 을 앱 안 주소(`router.push(주소)`)와 다르게 푼다 -
`build/fork/extractPathFromURL.js` 의 `fromDeepLink` 가 쿼리 값을 두 번 디코딩하고 다시 인코딩하지 않고 이어 붙여,
값의 `+`·`&`·`#` 이 공백·다음 파라미터·조각이 된다(스펙 8.2 의 둘째 D3 정정,
`docs/superpowers/notes/2026-09-30-d3-measurements.md` 의 L1). `/` 로 시작하는 주소는 그 함수가 그대로 돌려주므로 `appPathFromDeepLink` 가 이 빌드의 scheme 으로 들어온 링크를
`/…` 로 바꿔 넘긴다 - 쿼리는 받은 글자 그대로다(풀지도 다시 인코딩하지도 않는다).

## 바꾸지 않는 것

- 이 빌드의 scheme 이 아닌 주소(`https://…`, 다른 앱·다른 변형의 scheme, 이미 앱 안 주소인 `/…`)는 그대로 돌려준다.
- 개발 클라이언트의 링크 - `exp+…://expo-development-client/?url=…` 와, 이 빌드의 scheme 이어도 호스트가
  `expo-development-client` 인 링크 - 는 그대로 둔다. Expo Router 가 그 호스트를 알아보고 `url` 파라미터를 따로 푼다.

## 시험

`test/unit/navigation/deep-link.test.ts` 가 설치본 expo-router 의 `extractExpoPathFromURL` 을 지나는 왕복으로 잰다 -
앱 안 이동의 해석은 `test/unit/navigation/router-parse.ts` 의 모형(목록 주소의 왕복 시험과 같은 것)이다. 정규화하지 않은
링크가 값을 잃는다는 것과 `/` 로 시작하는 주소가 그대로 지난다는 것도 설치본으로 고정한다 - expo-router 를 올려 그
동작이 바뀌면 그 시험이 먼저 실패한다. 기기에서는 E2E `examples-browse` 가 잰다.
