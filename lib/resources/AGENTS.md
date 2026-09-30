# lib/resources/ 작업 지침

자원 선언과 그 판단을 소유한다(스펙 5장). JSX·fetch·네이티브 모듈을 갖지 않는다.

## 복사본이다

`define.ts`·`example.ts`·`category.ts`·`tag.ts`·`index.ts`·`mirror.ts`는
`template-typescript-nextjs`에서 복사했다. 출처와 이탈은 `docs/provenance/copied-core.json`.
목록·상세 판단 `view.ts` 는 D3 가 복사했다 - 목록을 커서로(`listQuery`·`nextPageQuery`), 필터 입력을 폼
상태 객체로(`FilterFormValues`·`filterFormValues`·`filterHref`), 백엔드에 닿지 못함을 던지지 않는
`unreachable` 로 고쳤고 offset 쪽 이동을 뺐다. 요청 조립(`listRequest`·`detailRequest`·`referenceRequest`)은
Accept-Language 를 싣지 않는다 - 싣는 자리는 `platform/api.ts` 하나다(스펙 9.4). 이 저장소가 더한 판단의
시험은 `test/unit/resources/view-expo.test.ts` 다. 폼 판단 `form.ts` 는 쓰기 화면(D4)이 같은 방식으로 복사한다.

## 목록 주소의 인코딩

앱이 만드는 목록 주소(정렬·필터 적용·필터 지우기)는 `hrefWithQuery` 의 `URLSearchParams` 직렬화 그대로
키와 값을 퍼센트 인코딩한다(`filter%5Bstatus%5D=…`). Expo Router 57 은 그 모양의 대괄호 키를 평평한 키로
되살린다. 새 인코딩 코드를 만들지 않는다 - 규칙과 한계는 `docs/superpowers/notes/2026-09-30-d3-measurements.md`
의 L1.

## 선언은 데이터다

`filters`·`sorts`는 백엔드 조회 정책을 **손으로 베낀 거울**이다. 손으로 유지되는 거울은
반드시 어긋나므로 계약 거울 테스트(스펙 11.2)가 양방향으로 잡게 되어 있다. 그 HTTP
테스트(`test/contract/`)는 아직 없다 - 지금의 `test/unit/resources/mirror.test.ts`는
프로브가 만들어지는 구조만 고정하고, 선언과 백엔드의 어긋남은 잡지 못한다.

## 명시적 등록

`index.ts`의 `RESOURCES`는 손으로 채우는 배열이다. 여기 없으면 그 자원은 존재하지 않는
것과 같다. 새 자원은 선언 파일을 만들고 이 배열에 손으로 더한다.
