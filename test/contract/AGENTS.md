# test/contract/ 작업 지침

계약 거울이 산다(스펙 11.2) - 손으로 옮긴 자원 선언(`lib/resources/*.ts`)을 실제 백엔드에 HTTP 로 맞대는
vitest 다. 게이트의 `[12/13]` 이 `run.sh` 하나로 돈다.

| 파일             | 역할                                                                                     |
| ---------------- | ---------------------------------------------------------------------------------------- |
| `run.sh`         | FastAPI 스택을 띄우고 `pnpm test:contract` 를 돈 뒤 내린다(실패해도 내린다)              |
| `mirror.test.ts` | 검사 넷 - 조회 정책 양방향·응답 속성 키·속성 제약(`examples`, 로그인 뒤)·enum 값의 실재  |
| `backend.ts`     | 백엔드에 닿는 자리 - `fetch` 로 원본 응답(상태·파싱한 본문)을 받는다. 가입·로그인 도우미 |

- 프로브와 속성 키는 복사한 `lib/resources/mirror.ts` 가 계산한다 - 이 디렉터리는 그것을 보내고 맞대기만 한다.
  새 자원은 `lib/resources/index.ts` 의 `RESOURCES` 에 더하면 ①·②·④ 가 저절로 잰다. ③ 은 쓰기 라우트가 있는
  `examples` 에만 있다.
- 앱의 API 클라이언트(`request()`)를 쓰지 않는다 - 재는 것은 선언과 백엔드의 관계이지 앱의 클라이언트가 아니다.
- 모든 기대값은 선언에서 읽는다(`maxLength`·`min`·`max`·enum 값) - 상수로 박으면 선언을 바꾸는 뮤턴트가 산다.
- 오류는 `code`·`source` 만 본다 - 문구는 세 백엔드가 갈린다.
- 단위 시험(`pnpm test`)은 이 디렉터리를 돌지 않는다(`vitest.config.mjs` 의 `include`). 이 디렉터리는
  `vitest.contract.config.mjs` 로만 돈다.

## 돌리기

```bash
./test/contract/run.sh                                                # 스택을 띄우고 돈다(게이트 [12/13])
CONTRACT_API_URL=http://127.0.0.1:4100 pnpm test:contract           # 이미 떠 있는 스택에 - 개발용
```

| 변수               | 뜻                                                                                                    |
| ------------------ | ----------------------------------------------------------------------------------------------------- |
| `E2E_API_PORT`     | 백엔드를 여는 호스트 포트(기본 4100, `docker-compose.e2e.yml`·E2E 하네스와 같다) - `run.sh` 가 읽는다 |
| `CONTRACT_API_URL` | 호스트에서 백엔드에 닿는 주소 - `run.sh` 가 준다. 없으면 시험이 곧바로 그 사실을 알리고 실패한다      |

스택은 E2E 와 같은 compose 프로젝트(`template-typescript-expo-e2e`)이고 그 프로젝트만 띄우고 내린다. access
token 수명은 백엔드 기본값(900초)이다 - E2E 하네스가 주는 10초(`E2E_ACCESS_EXPIRES_SECONDS`)를 쓰지 않는다.
