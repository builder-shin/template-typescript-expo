# lib/resources/ 작업 지침

자원 선언과 그 판단을 소유한다(스펙 5장). JSX·fetch·네이티브 모듈을 갖지 않는다.

## 복사본이다

`define.ts`·`example.ts`·`category.ts`·`tag.ts`·`index.ts`·`mirror.ts`는
`template-typescript-nextjs`에서 복사했다. 출처와 이탈은 `docs/provenance/copied-core.json`.
목록·상세·폼 판단(`view.ts`·`form.ts`)은 그것을 쓰는 화면이 생길 때 같은 방식으로 복사한다.

## 선언은 데이터다

`filters`·`sorts`는 백엔드 조회 정책을 **손으로 베낀 거울**이다. 손으로 유지되는 거울은
반드시 어긋나므로 계약 거울 테스트(스펙 11.2)가 양방향으로 잡는다.

## 명시적 등록

`index.ts`의 `RESOURCES`는 손으로 채우는 배열이다. 여기 없으면 그 자원은 존재하지 않는
것과 같다. 새 자원은 선언 파일을 만들고 이 배열에 손으로 더한다.
