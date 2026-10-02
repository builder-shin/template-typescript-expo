# components/ 작업 지침

화면이 나눠 쓰는 React Native 부품이다. 하위 디렉터리마다의 소유는 루트 `AGENTS.md` 의 계층 표가 정하고, 세부는
하위 문서가 갖는다. 모든 하위 디렉터리에 걸리는 규칙:

- fetch·`request()` 를 부르지 않는다. 조회·쓰기는 `queries/` 의 훅이 하고 부품은 결과를 받아 그린다.
- 자원 이름으로 분기하지 않는다 - 분기해도 되는 것은 선언의 구조(`kind`·`cardinality`)뿐이다.
- 로딩에 글자를 쓰지 않는다 - 스켈레톤(`ui/skeleton.tsx`)과 스피너(`ActivityIndicator`)만 쓴다.
- `@media` 로 컴파일되는 클래스 변형(너비·방향·플랫폼)을 쓰지 않는다 - 플랫폼마다 다른 스타일은 `Platform.select` 로
  클래스 문자열을 고른다(`test/unit/ui/breakpoints.test.ts` 가 막는다).
- lucide 아이콘은 아이콘마다 깊은 경로의 기본 내보내기로 받는다(루트 `AGENTS.md`).
- 컴포넌트 단위 시험은 두지 않는다(스펙 11.1) - 판단은 `lib/` 로 밀고, 그린 결과는 E2E 가 testID 로 본다.

| 디렉터리                          | 무엇                                                                                                |
| --------------------------------- | --------------------------------------------------------------------------------------------------- |
| [`app/`](app/AGENTS.md)           | 앱 전체에 걸린 화면 조각 - 설정 오류 화면, 시트, 닿지 못함, not-found, 로그아웃, 빌드 정보 카드, 홈 |
| [`form/`](form/AGENTS.md)         | 폼 조각 - 필드 오류, 배너, 제출 버튼, 자격증명 폼                                                   |
| [`lab/`](lab/AGENTS.md)           | 계약 실험실의 실험 카드                                                                             |
| [`resource/`](resource/AGENTS.md) | 자원 선언을 읽어 그리는 획일 UI - 목록·상세·필터·정렬·폼·관계 선택기                                |
| [`ui/`](ui/AGENTS.md)             | React Native Reusables 복사본                                                                       |

React Native Reusables 가 훅을 받는 자리(`components.json` 의 `hooks` 별칭)는 아직 비어 있다 - 쓰는 날의 소유
규칙은 루트 `AGENTS.md` 의 표에 있다.
