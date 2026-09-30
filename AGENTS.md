# TypeScript Expo Template 작업 지침

세 백엔드 템플릿(FastAPI·NestJS·Rails)이 공유하는 JSON:API 1.1 계약을 Android·iOS
앱으로 소비하는 템플릿이다. 설계의 정본은
`docs/superpowers/specs/2026-09-30-expo-jsonapi-template-design.md`이고, 이 파일은 그
설계가 정한 **계층 계약의 운용 정본**이다.

## 계층 소유권 (스펙 5장)

**아래 표는 소유 관계이지 파일 목록이 아니다.** 어떤 위치가 아직 비어 있어도 그 행의
계약은 이미 유효하다 - 그 위치에 처음 파일을 만드는 사람이 지켜야 할 규칙이다.

| 위치                   | 소유하는 것                                                             | 소유하지 않는 것                          |
| ---------------------- | ----------------------------------------------------------------------- | ----------------------------------------- |
| `lib/jsonapi/`         | 문서 파싱, `included` 정규화, 쿼리 직렬화, 오류 분류, HTTP 협상         | 자원별 지식, 화면, 네이티브 모듈          |
| `lib/resources/`       | 자원 선언, 목록·상세·폼 판단                                            | JSX, fetch, 네이티브 모듈                 |
| `lib/auth/`            | 세션 모델과 직렬화, 만료 판정, 회전 결정, 자격증명 문서, 보호 경로 목록 | 저장 매체, 화면 이동                      |
| `lib/lab/`             | 실험 정의, 결과 표현                                                    | 화면, 세션                                |
| `platform/`            | Expo 모듈 호출, React Provider, API 클라이언트 조립                     | 판단                                      |
| `queries/`             | 캐시 키, 조회·쓰기 훅, 쓰기 후 무효화                                   | JSX, 쿼리 문자열 조립                     |
| `app/`                 | 화면, 라우팅, 가드 배치                                                 | fetch, `request()` 호출, 쿼리 문자열 조립 |
| `components/resource/` | 선언을 읽어 만드는 획일 UI                                              | 자원 이름으로 분기                        |

위반의 정의:

- `lib/**`에서 `react`·`react-native`·`expo`·`expo-*`·`@expo/*`·`@react-native*` 등
  플랫폼 모듈을 import하면 위반이다. ESLint가 막고 `test/unit/lint/lib-boundary.test.ts`가
  그 규칙을 잰다. `lib/`가 node의 vitest에서 그대로 돌아야 복사한 테스트가 유효하다.
- `lib/jsonapi/`에 이 저장소의 실제 자원 이름 문자열이 코드로 나타나면 위반이다.
- `lib/resources/*.ts`에 JSX가 있으면 위반이다.
- `app/`에서 `fetch`나 `request()`를 직접 부르면 위반이다. 화면은 `queries/`의 훅만 쓴다.
- `queries/`에 JSX가 있거나 쿼리 문자열을 조립하면 위반이다.
- `components/resource/*`에 자원 이름으로 분기하는 코드가 있으면 위반이다.
- `platform/`에 분기 판단이 자라면 위반이다. 판단은 `lib/`로 옮긴다.

`lib/resources/index.ts`는 손으로 채우는 배열이다. **여기 없으면 그 자원은 존재하지 않는
것과 같다.** 자동 탐색(glob · 동적 `import`)을 쓰지 않는다.

## 복사한 코어

`lib/`의 상당 부분은 `template-typescript-nextjs`에서 복사했다(스펙 6장). 어떤 파일을
복사했고 원본과 무엇이 다른지는 `docs/provenance/copied-core.json`이 정본이다. 복사한
파일을 고치면 그 파일의 `divergences`에 `what`·`why`를 더한다 -
`node scripts/check-provenance.mjs`가 기록의 형식과 경로를 검사한다.

## `app/`에는 라우트 파일만 둔다

Expo Router는 `app/` 아래의 모든 파일을 라우트로 취급한다. 판단 함수·타입·상수는
`lib/`의 해당 계층에 둔다.

## 로딩 표현

로딩 상태에 텍스트를 쓰지 않는다. 스켈레톤 또는 스피너만 쓴다(스펙 8.7).

## 사라질 자리를 인용하지 마라

코드·문서 주석에서 선행 점이 붙은 `.superpowers/`, 세션이 끝나면 사라지는 태스크 보고·
리뷰·브리프 파일, 스크래치패드를 가리키지 않는다. 모든 인용이 죽은 링크가 된다. 근거는
**사실 문장**으로 적고, 문서가 필요하면 커밋되는 `docs/superpowers/`를 가리킨다.

## 검증 명령

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm format:check
pnpm secretlint
pnpm test
```
