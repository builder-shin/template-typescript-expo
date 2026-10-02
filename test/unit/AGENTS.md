# test/unit/ 작업 지침

게이트 [7] 의 vitest(node)다 - `vitest.config.mjs` 가 이 디렉터리의 `*.test.ts` 만 돈다. 디렉터리는 재는 계층을 따른다.

| 디렉터리      | 재는 것                                                                                              |
| ------------- | ---------------------------------------------------------------------------------------------------- |
| `auth/`       | `lib/auth/` - 회전(동시 호출은 refresh 한 번, 저장이 반환보다 먼저), 세션 저장·복원, 보호 경로, 흐름 |
| `config/`     | `lib/config/`·`app.config.ts`·`eas.json` - 필수 변수, 배포 변형의 평문 HTTP 거부, 변형 표, OTA       |
| `deps/`       | 의존성의 고정 - Metro 계열이 한 인스턴스다                                                           |
| `docs/`       | 문서군이 실제 파일과 일치한다 - README·AGENTS.md 의 인용, 디렉터리 문서의 파일 목록, 환경 변수 표    |
| `e2e/`        | E2E 하네스의 판단 - 가드·이메일·백엔드 종류·플로의 두 플랫폼 규칙·iOS 로그 변환·멈춘 서버·시드       |
| `jsonapi/`    | `lib/jsonapi/` - 문서·정규화·쿼리·오류·클라이언트(타임아웃·취소)·Accept-Language·연결 판정           |
| `lab/`        | `lib/lab/` - 실험의 정의·결과·실행부                                                                 |
| `lint/`       | ESLint 규칙 자체 - lib 경계, `request()` 경계, lucide import, 의존성 선언                            |
| `navigation/` | `lib/navigation/` - 딥링크 정규화(설치본 expo-router 를 지나는 왕복), 한 번만 하는 이동              |
| `platform/`   | `platform/` 의 배선 - `vi.mock` 으로 기기 모듈을 바꿔 잰다                                           |
| `queries/`    | `queries/` 의 순수 부분 - 캐시 키·무효화 표, Query 옵션의 전이(실제 `QueryClient`), 제출 한 번       |
| `resources/`  | `lib/resources/` - 선언·거울 프로브·목록·상세·폼·쓰기·화면 상태                                      |
| `scripts/`    | `scripts/` 의 검사기 - 실제로 돌려 종료 코드와 메시지를 본다                                         |
| `ui/`         | `app/`·`components/` 를 훑는 정적 규칙(미디어 쿼리 변형)과 내비게이션 색                             |
| `support/`    | 공통 시험도구 - bash.ts의 실제 Git Bash 선택/30초 probe 제한                                         |
| `updates/`    | `lib/updates/` - 빌드 정보 카드                                                                      |

- 한 파일만 돌리려면 `pnpm exec vitest run <파일>` 이다 - `pnpm test -- <파일>` 은 pnpm 11 이 `--` 를 넘겨 전부 돈다.
- 원본에서 복사한 시험은 `docs/provenance/copied-core.json` 에 있다 - 고치면 이탈을 적는다.
- 러너의 타임존은 UTC 가 아닌 값으로 고정돼 있다(`vitest.config.mjs`) - UTC 로 그리는 코드를 UTC 러너에서 재면 아무것도
  재지 못한다.
- 한 번도 빨개지지 않은 검사는 있으나 마나다 - 검사를 재는 시험은 어긋난 입력이 실패하는 것도 본다.
