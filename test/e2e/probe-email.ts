import { randomUUID } from 'node:crypto'

/**
 * E2E 가 쓰는 가입용 이메일을 만든다 - 네 스펙 파일이 각자 갖고 있던 같은
 * 조립을 한 자리로 모은 것이다.
 *
 * ## 왜 상한을 강제하는가 - 세 번째 백엔드가 생기고 나서야 드러난 결함
 *
 * **RFC 5321 은 이메일의 로컬 파트(`@` 앞)를 64옥텟으로 제한한다.** 앞선
 * 판은 `<접두사>-<라벨>-<uuid>` 를 그대로 이어 붙였는데, `uuid` 만 36자라
 * 라벨이 조금만 길어도 그 상한을 넘었다 - 실측(2026-09-09):
 * `probe-e2e-write-create-bad-category-<uuid>` 는 **72자**,
 * `probe-lab-mirror-status-undeclared-rejected-<uuid>` 는 **80자**였다.
 *
 * 정본(FastAPI)과 Rails 는 그것을 받아 줬고, **NestJS(class-validator)만
 * 정확히 거절한다**(`422 … "email must be an email"`). 그래서 이 픽스처는
 * 두 백엔드가 우연히 너그러운 동안만 참이었고, 세 백엔드 매트릭스의 세 번째
 * 갈래가 처음 도는 순간 **E2E 열다섯 중 아홉이 가입 단계에서 끊겼다.**
 *
 * **이것은 백엔드 드리프트가 아니라 우리 픽스처의 결함이다** - 규격을 어긴
 * 값을 만들어 놓고 그것을 받아 주는 백엔드에서만 초록이었다. 그래서
 * `KNOWN_DIVERGENCES` 가 아니라 여기서 고친다.
 *
 * 상한을 넘기지 않도록 **앞부분을 자른다.** 잘려도 고유성은 `uuid` 가
 * 보장하고, 사람이 읽을 때 어느 테스트의 계정인지도 남는다.
 * `test/unit/e2e/probe-email.test.ts` 가 이 성질을 지킨다.
 */

/** RFC 5321 §4.5.3.1.1 의 로컬 파트 상한. */
export const EMAIL_LOCAL_MAX = 64

/**
 * 도메인. `.example` 은 RFC 2606 이 문서용으로 예약한 TLD 라 실재하는 주소가
 * 될 수 없다 - 정본의 이메일 검증이 `.invalid`·`.test`·`.local` 은 거절하고
 * 이것은 통과시키는 것도 실측으로 확인했다.
 */
export const PROBE_EMAIL_DOMAIN = 'probe.example'

/** `randomUUID()` 의 길이. 뒤에 붙는 `-` 하나와 함께 로컬 파트의 고정 비용이다. */
const UUID_LENGTH = 36

export function probeEmail(prefix: string, label: string): string {
  const unique = randomUUID()
  const room = EMAIL_LOCAL_MAX - unique.length - 1
  const head = `${prefix}-${label}`.slice(0, room)
  return `${head}-${unique}@${PROBE_EMAIL_DOMAIN}`
}

/** 위 계산이 기대한 여유 폭. 단위 테스트가 이 값으로 경계를 만든다. */
export const PROBE_EMAIL_HEAD_MAX = EMAIL_LOCAL_MAX - UUID_LENGTH - 1
