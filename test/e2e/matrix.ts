/**
 * 세 백엔드 매트릭스 - `BackendKind` 타입·런타임 검증과 `KNOWN_DIVERGENCES`.
 *
 * 스펙 15.2 단계 6 + D5 Task 5. `docker-compose.e2e.yml` 의 `migrate-*`·
 * `api-*`·`seed-*` 서비스는 `fastapi`·`nestjs`·`rails` 세 compose profile 로
 * 묶여 있고(D5 Task 4), `test/e2e/stack.ts` 가 `BACKEND_KIND` 환경변수를 그
 * profile 이름으로 그대로 넘긴다. 이 파일은 그 문자열을 타입으로 좁히고
 * (`backendKind()`), "오늘 세 백엔드가 어디서 갈리는가"를 코드로 남긴다
 * (`KNOWN_DIVERGENCES`).
 *
 * ## `backendKind()` 가 던지는 이유 - 리뷰가 넘긴 자리
 *
 * `stack.ts` 의 예전 주석은 "잘못된 `BACKEND_KIND` 를 주면 Compose 가
 * 죽는다 - 그 자체로 충분히 시끄럽다"고 적고 검증을 이 태스크로 미뤘다.
 * **그 문장이 실측과 반대다**: `COMPOSE_PROFILES=<존재하지 않는 값>` 은
 * 에러 없이 **exit 0** 으로 끝나고, `db`·`redis`·`web` 만 뜬 부분 스택으로
 * 조용히 해석된다(로컬 실측 - profiles 가 붙은 서비스는 활성 profile 이
 * 하나도 매치되지 않으면 전부 건너뛰어질 뿐, Compose 는 그것을 오류로 보지
 * 않는다). 그 위에서 `pnpm test:e2e` 를 돌리면 백엔드 없는 스택을 상대로
 * 모든 요청이 실패**해야** 정상인데, 마침 CI 매트릭스 잡의 `matrix.backend`
 * 값이 오타 하나로 어긋나면 그 실패가 "이 백엔드는 원래 이렇게 갈린다"로
 * 오독될 여지가 생긴다 - "세 백엔드를 커버한다"는 이 계획 전체의 주장이
 * 조용히 거짓이 될 수 있는 유일한 경로였다.
 *
 * `backendKind()` 를 `stack.ts` 의 `BACKEND_KIND` 상수가 모듈을 불러오는
 * 시점에 바로 호출하므로, 잘못된 값은 `startStack()` 이 컨테이너를 하나도
 * 안 띄운 채로(도커를 건드리기도 전에) 던진다.
 *
 * **그 배선 자체를 `test/unit/e2e/matrix.test.ts` 가 지킨다** - "이 함수가
 * 던진다" 와 "`stack.ts` 가 그것을 모듈 평가 시점에 부른다" 는 다른 성질이고,
 * 위험한 쪽은 뒤엣것이다. 그 한 줄만 되돌리면 typecheck·lint·단위 전부 초록인
 * 채로 오타가 다시 조용해진다(실측). 그래서 그 테스트는 이 파일이 아니라
 * `@/test/e2e/stack` 을 **동적으로 import 해서** 던지는지 본다.
 *
 * ## 목록이 비어 있는 지금, 이 기구가 남아 있는 이유
 *
 * `KNOWN_DIVERGENCES` 는 **오늘 0건**이다(아래 그 상수 주석). 기구를 지우지
 * 않는 이유 둘. (1) `reportKnownDivergences()` 는 매 매트릭스 실행마다
 * "0건" 을 CI 로그에 찍는다 - 그 줄이 없으면 "갈리지 않는다" 와 "이 검사가
 * 안 돌았다" 가 구별되지 않는다. (2) 다음 드리프트가 생겼을 때 **무엇을
 * 하면 되는지**가 코드로 남아 있어야 한다 - 빨간 칸을 본 사람의 가장 빠른
 * 대응은 `test.skip` 이고, 그것은 조용하다.
 */

export type BackendKind = 'fastapi' | 'nestjs' | 'rails'

const BACKEND_KINDS: readonly BackendKind[] = ['fastapi', 'nestjs', 'rails']

function isBackendKind(value: string): value is BackendKind {
  return (BACKEND_KINDS as readonly string[]).includes(value)
}

/**
 * `BACKEND_KIND` 환경변수를 알려진 셋 중 하나로 좁힌다. 기본값은 `fastapi`
 * (정본) - 로컬 게이트(`./scripts/check.sh`)가 오늘처럼 인자 없이 돌아야
 * 한다(스펙 11). 알려진 셋이 아니면 던진다 - 이유는 파일 머리말.
 */
export function backendKind(): BackendKind {
  const raw = process.env.BACKEND_KIND ?? 'fastapi'
  if (!isBackendKind(raw)) {
    throw new Error(
      `BACKEND_KIND='${raw}' 는 알려진 백엔드가 아니다 - ${BACKEND_KINDS.join(' | ')} 중 하나여야 한다`,
    )
  }
  return raw
}

/** 이 백엔드에서 알려진 실패 하나. 판정(owner)과 근거(reason)를 함께 갖는다. */
export interface KnownDivergence {
  readonly backend: BackendKind
  /** 어느 테스트가 죽는가 - `<파일> › <describe 경로> › <테스트 제목>`. */
  readonly test: string
  /** 왜 갈리는가 - 재현·추정 근거를 함께 적는다. */
  readonly reason: string
  /** 고칠 저장소. `frontend` 면 이 저장소가, `backend` 면 백엔드 저장소가 고칠 일이다. */
  readonly owner: 'frontend' | 'backend'
  /** 이 세션이 실제로 재현했는가(`true`), 아직 못 하고 예상만 했는가(`false`). */
  readonly verified: boolean
}

/**
 * 오늘(2026-09-09) 알려진 계약 드리프트 - **0건**.
 *
 * ## 여기 있던 아홉이 어떻게 사라졌나
 *
 * D5 가 Rails 둘을 실측해 적었고, NestJS 저장소가 공개로 바뀐 뒤 첫 매트릭스
 * 실행에서 여섯이 더 나왔다(D5 시점에는 예상 하나만 적혀 있었다). 여덟 전부
 * `test.fail(조건, 이유)` 로 물려 있었다 - 드리프트가 그대로면 CI 는 초록,
 * 백엔드가 고쳐져 그 테스트가 통과해 버리면 **"기대한 실패가 없다"로 그
 * 자리에서 죽는** 배선이다.
 *
 * 2026-09-09 에 그 여덟을 백엔드 저장소에서 고쳤다 -
 * `template-ruby-rails#8`(이슈 #5·#6·#7)과
 * `template-typescript-nestjs#10`(이슈 #6·#7·#8·#9). 병합 뒤 매트릭스를 다시
 * 돌리자 **여덟 자리가 전부 "Expected to fail, but passed." 로 죽었다**
 * (실측: rails 2 failed / nestjs 6 failed). 설계가 약속한 신호가 그대로
 * 왔고, 그래서 이 목록과 `test.fail` 배선을 함께 걷어냈다.
 *
 * ## 새 드리프트를 여기에 적을 때
 *
 * 1. 항목을 하나 추가한다(`reason` 에 재현과 실측을 적는다 - 근거 없는
 *    드리프트는 "고쳤는지" 를 판단할 수 없다).
 * 2. 그 테스트를 가리키는 상수를 이 파일에 두고, 스펙 파일에서
 *    `knownDivergenceReason(backendKind(), <상수>)` 를 `test.fail` 에 물린다.
 *    문구를 두 곳에 따로 적으면 언젠가 어긋난다.
 * 3. **`test.skip` 을 쓰지 마라.** 건너뛴 테스트는 조용하고, 백엔드가 고쳐져도
 *    아무도 모른다. `test.fail` 은 고쳐지는 날 스스로 죽는다.
 * 4. 백엔드 저장소에 이슈를 올리고 `owner: 'backend'` 로 둔다.
 */
export const KNOWN_DIVERGENCES: readonly KnownDivergence[] = []

/**
 * 이 백엔드·이 테스트에 알려진 드리프트가 있으면 그 이유를 돌려준다 -
 * `test.fail()` 에 그대로 물린다.
 *
 * **오늘 프로덕션 호출부가 없다**(목록이 0건이라 물릴 자리도 없다). 남겨 두는
 * 이유는 파일 머리말의 (2) - 다음 드리프트가 생겼을 때 배선하는 방법이 코드로
 * 남아 있어야 한다. 그래서 단위 테스트는 프로덕션 목록이 아니라 **프로브
 * 목록**을 넘겨 이 함수 자체를 구동한다(`divergences` 인자) - 목록이 비었다고
 * 가드까지 헛돌면 다음에 물릴 때 그것이 도는지 아무도 모른다.
 */
export function knownDivergenceReason(
  backend: BackendKind,
  test: string,
  divergences: readonly KnownDivergence[] = KNOWN_DIVERGENCES,
): string | undefined {
  return divergences.find(
    (divergence) => divergence.backend === backend && divergence.test === test,
  )?.reason
}

/**
 * "오늘 이 백엔드가 어디서 갈리는가"를 CI 로그에 남긴다. `global-setup.ts`
 * 가 스택을 띄운 직후 한 번 부른다 - 매 매트릭스 실행(백엔드가 무엇이든,
 * `test.fail` 로 wiring 됐든 아니든)마다 이 백엔드에 걸린 항목 전부가
 * 로그에 찍힌다. 0건이어도 "0건"이라고 찍는다 - 그 자체가 "오늘은 이
 * 백엔드가 정본과 갈리지 않는다"는 신호다.
 *
 * `divergences` 인자는 `knownDivergenceReason` 과 같은 이유로 열려 있다.
 */
export function reportKnownDivergences(
  backend: BackendKind,
  divergences: readonly KnownDivergence[] = KNOWN_DIVERGENCES,
): void {
  const matching = divergences.filter((divergence) => divergence.backend === backend)

  if (matching.length === 0) {
    console.log(`[matrix] ${backend}: 알려진 계약 드리프트 없음`)
    return
  }

  console.log(`[matrix] ${backend}: 알려진 계약 드리프트 ${matching.length}건`)
  for (const divergence of matching) {
    console.log(
      `[matrix]   - [${divergence.verified ? '실측' : '예상(미실측)'}, owner=${divergence.owner}] ${divergence.test}`,
    )
    console.log(`[matrix]     ${divergence.reason}`)
  }
}
