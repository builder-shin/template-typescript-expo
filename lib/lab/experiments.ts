/**
 * 계약 실험실의 여섯 실험 - 순수 데이터(스펙 8.5).
 *
 * 이 화면은 실무 화면이 쓰지 않는 여섯 백엔드 표면을 모으고, 각 버튼이
 * **원본 JSON 응답을 그대로** 보여준다. 이 파일은 "무엇을 부르고 무엇을
 * 실증하는가"라는 사실만 담는다 - **요청을 어떻게 조립할지는 여기 없다.**
 * `actions.ts`의 `runExperiment`가 `id`로 분기해서 실제 요청을 만든다.
 *
 * ## 판단을 여기 두지 않는 이유
 *
 * `runExperiment`은 `requireSession()`·`headers()`·`request()`를 부르는
 * Server Action이라 vitest가 부를 수 없다(`lib/auth/guard.ts`의 "이 파일은
 * 단위 테스트 계층에서 관측할 수 없다"와 같은 제약, `lib/resources/form.ts`
 * 가 D4에서 같은 이유로 판단을 액션 밖으로 뺀 것과 같은 구조). 반면 "여섯이
 * 다 있는가"·"needsSession 배정이 맞는가"는 **데이터**라 여기서는 쉽게
 * 지켜진다 - `test/unit/app/contract-experiments.test.ts`.
 *
 * 값의 정본은 team-lead가 실측해 스펙 8.5의 표로 남긴 계약이다 - 이 파일은
 * 그 표를 옮긴 것이다.
 */
export interface Experiment {
  readonly id: string
  readonly title: string
  /** 이 실험이 실증하는 계약. 스펙 8.5 표의 오른쪽 열. */
  readonly proves: string
  readonly needsSession: boolean
}

export const EXPERIMENTS: readonly Experiment[] = [
  {
    id: 'putUpsert',
    title: 'PUT upsert',
    proves:
      '없는 id로 PUT하면 201로 생성되고 클라이언트가 id를 정할 수 있다(POST 본문에 data.id를 담으면 403). 있는 id로 PUT하면 200이고 전체 교체다 - 요청에 없는 필드는 관계까지 지워진다.',
    needsSession: true,
  },
  {
    id: 'relationshipWrite',
    title: '관계 전용 쓰기',
    proves:
      '.../relationships/tags에 대한 POST(추가)·DELETE(제거)는 본체 폼 저장과 별개의 통로다. 성공은 204 + 빈 본문이라 새 상태를 그 응답으로는 되받을 수 없다 - 확인하려면 따로 GET해야 한다.',
    needsSession: true,
  },
  {
    id: 'offsetWalk',
    title: 'offset 순회',
    proves:
      'page[number]=1로 시작해 links.next만 따라가면 offset 페이지로 컬렉션 끝까지 순회할 수 있다 - 프론트는 다음 쪽 번호를 셈하지 않고 백엔드가 준 링크를 그대로 따른다. 한 번에 최대 20회이고, 상한에 걸리면 그 사실을 결과에 적는다.',
    needsSession: false,
  },
  {
    id: 'pageTotals',
    title: '페이지 총합',
    proves:
      'page[totals]=true를 켠 요청에만 meta.totalCount가 온다 - 켠 요청과 안 켠 요청을 나란히 비교해야 "켠 요청에만"이 실증된다.',
    needsSession: false,
  },
  {
    id: 'acceptLanguage',
    title: '언어 협상 (쓰기 오류)',
    proves:
      '같은 검증 오류를 Accept-Language: ko와 en으로 각각 요청하면 오류 문구가 협상된다 - 쓰기 오류의 언어 협상은 이 화면이 처음 보인다(읽기 오류의 협상은 목록·상세 화면에서 이미 실증된다).',
    needsSession: true,
  },
  {
    id: 'invalidFilter',
    title: '정책에 없는 필터 연산자',
    proves:
      '자원 선언의 정책에 없는 (필드, 연산자) 조합으로 필터링하면 400 INVALID_FILTER로 거절된다 - source.parameter가 filter[필드][연산자] 모양이다.',
    needsSession: false,
  },
]
