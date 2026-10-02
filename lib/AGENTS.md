# lib/ 작업 지침

순수 TypeScript 계층이다 - react·react-native·expo 와 위 계층(`platform/`·`queries/`·`components/`·`app/`)을
import 하지 않는다(ESLint 가 막고 `test/unit/lint/lib-boundary.test.ts` 가 잰다). 그래서 node 의 vitest 에서 그대로
돌고, 원본에서 복사한 시험이 유효하다. 계층마다의 소유는 루트 `AGENTS.md` 의 표가, 세부는 하위 문서가 갖는다.

| 경로                                  | 무엇                                                                                   |
| ------------------------------------- | -------------------------------------------------------------------------------------- |
| [`jsonapi/`](jsonapi/AGENTS.md)       | 자원을 모르는 문서·정규화·쿼리·오류·HTTP 클라이언트                                    |
| [`resources/`](resources/AGENTS.md)   | 자원 선언과 목록·상세·폼·쓰기의 판단, 손으로 채우는 등록 배열                          |
| [`auth/`](auth/AGENTS.md)             | 세션 모델·회전·자격증명·보호 경로 - 회전은 한 곳에서 한 번에 하나만                    |
| [`lab/`](lab/AGENTS.md)               | 계약 실험실의 실험 정의·실행·결과 표현                                                 |
| [`config/`](config/AGENTS.md)         | 설정 계약과 변형 규칙 - `app.config.ts` 가 Node 의 type stripping 으로 직접 불러온다   |
| [`navigation/`](navigation/AGENTS.md) | 밖에서 들어온 딥링크의 정규화, 한 번만 하는 이동                                       |
| [`updates/`](updates/AGENTS.md)       | 홈의 빌드 정보 카드의 판단                                                             |
| `utils.ts`                            | React Native Reusables 의 `cn`(클래스 이름 합치기) - `components.json` 의 `utils` 별칭 |

많은 파일이 `template-typescript-nextjs` 에서 복사한 사본이다 - 어느 것이 사본이고 원본과 무엇이 다른지는
`docs/provenance/copied-core.json` 이 정본이다(루트 `AGENTS.md` 의 "복사한 코어").

판단이 새로 필요하면 여기 둔다 - `platform/` 은 호출과 배선만, `queries/` 는 캐시와 훅만, 화면은 훅과 JSX 만 갖는다.
시험이 import 하는 이 디렉터리의 파일은 앱과 시험의 두 타입 프로그램에서 검사되므로 타이머 핸들은
`ReturnType<typeof setTimeout>` 으로 적는다(루트 `AGENTS.md` 의 "검증 명령").
