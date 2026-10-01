# lib/lab/ 작업 지침

계약 실험실(스펙 8.6)의 실험 정의와 결과 표현, 실험을 요청으로 돌리는 실행부다. JSX·fetch·네이티브 모듈을
갖지 않는다 - 요청은 주입받은 전송으로만 보낸다.

| 파일             | 역할                                                                                                       |
| ---------------- | ---------------------------------------------------------------------------------------------------------- |
| `experiments.ts` | 여섯 실험의 id·제목·실증하는 계약·세션 필요 여부 - 순수 데이터(복사본)                                     |
| `result.ts`      | 원본 응답을 결과로 옮기는 판단 - 보낸 요청 헤더(토큰은 가린다)·본문 직렬화·여러 단계의 결합과 파싱(복사본) |
| `run.ts`         | 실험 하나를 실제 요청으로 돌린다 - 전송·토큰·지금의 세션·시계·기기 언어를 주입받는다(이 저장소의 것)       |

## 복사본이다

`experiments.ts`·`result.ts` 는 `template-typescript-nextjs` 의 `app/(lab)/contract/` 에서 옮겨 복사했다 - 이
저장소의 `app/` 에는 라우트 파일만 둔다(스펙 4장). 커서 순회 실험이 offset 순회로 바뀌었다(`experiments.ts`,
스펙 8.3·8.6). 출처와 이탈은 `docs/provenance/copied-core.json`. 두 파일의 주석이 말하는 `actions.ts`·
`page.tsx`·`result-view.tsx`·`'use server'` 는 원본 저장소의 것이다 - 이 저장소에서 그 자리는 `run.ts`,
`app/(lab)/contract.tsx`, `components/lab/experiment-card.tsx` 다.

## 원본을 가공하지 않는다

실험실의 목적은 각 실험이 백엔드의 원본 응답을 그대로 보이는 것이다. 응답의 상태·본문은 `result.ts` 의
`bodyText` 로만 옮긴다 - 오류 문구를 다시 쓰거나 필드별로 나누는 판단(`groupErrors`·`formStateFromErrors`)을
결과에 쓰지 않는다. 본문은 파싱한 뒤 다시 직렬화한 JSON 이라 키 순서와 공백이 원본과 다를 수 있다 - 화면이
그 사실을 적는다. 여러 단계의 결과는 `combinedStepsResult` 가 붙이고 `parseCombinedSteps` 가 정확히 그만큼을
떼어 낸다 - 화면과 E2E 는 단계의 본문만 본다.

## 세션

- 세션이 필요한 셋(`putUpsert`·`relationshipWrite`·`acceptLanguage`)은 `run.ts` 의 분기에 적는다 -
  `experiments.ts` 의 `needsSession` 을 읽지 않는다(데이터 하나의 실수로 가드가 풀리지 않게). 둘이 어긋나면
  `test/unit/lab/run.test.ts` 가 잡는다.
- 그 셋은 쓰기와 같은 길로 토큰을 받는다(`lib/resources/write.ts` 의 `accessToken`) - 가드를 두 벌 두지 않는다.
  세션이 없으면 요청하지 않고 세션 거절(`sessionRejected`)을 던진다. 받은 토큰의 세션이 이미 만료됐거나(만료
  가드 - 회전이 판정을 받지 못해 지금의 access 가 그대로 돌아왔다, 스펙 7.2) 토큰을 받지 못하면(회전한 세션을
  저장소에 못 씀) 요청하지 않고 `unusable` 로 끝난다 - 세션은 그대로이고 카드가 앱 문구를 그린다.
- 백엔드가 세션을 거절하면(인증 오류 코드) 세션 거절을 던진다. 받는 쪽은 쓰기 캐시(`MutationCache`)의
  `onError`(기기 세션을 지운다)와 실험실 화면(로그인으로 보낸다 - 실험실은 공개 경로라 경로 가드가 보내지 않는다).
- 세션 거절 말고 실행부가 던지는 것은 결함이다 - 응답은 오류든 닿지 못함이든 전부 결과로 옮긴다. 훅
  (`queries/lab.ts`)이 결함을 오류 경계로 보낸다.
- 읽기는 토큰 없이 보낸다(스펙 7.2). 세션이 필요 없는 셋은 토큰을 묻지도 않는다 - 회전도 일어나지 않는다.

## 언어

요청마다 기기 언어를 명시해 싣고 "보낸 요청 헤더" 에도 그 값을 적는다 - API 클라이언트(`platform/api.ts`)는
호출자가 정한 언어를 덮지 않는다(스펙 9.4 의 D5 정정). 언어 협상 실험만 `ko`·`en` 을 직접 정한다.

## 검증

`test/unit/lab/` 의 셋 - `experiments.test.ts`·`result.test.ts`(복사본)와 `run.test.ts`(가짜 전송·토큰·세션·
시계·언어로 실험마다의 요청과 결과, 세션 가드와 만료 가드, offset 순회의 끝·상한·오류). 훅의 배선과 결함의
갈래는 `test/unit/queries/lab.test.ts` 가, 실제 요청·로그인 이동·단계의 본문은 E2E
(`test/e2e/flows/contract-lab-*.yaml`)가 잰다.
