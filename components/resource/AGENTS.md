# components/resource/ 작업 지침

자원 선언을 읽어 그리는 획일 UI 다(스펙 5장). **자원 이름으로 분기하지 않는다** - 무엇을 그릴지는
`lib/resources/view.ts`·`screen-state.ts`·`form.ts` 가 선언과 조회 결과에서 정해 온다(`ListScreen`·`DetailScreen`·
`FilterField`·`SortOption`·`RelationshipChoice`·`ReferenceState`). 분기해도 되는 것은 구조뿐이다: 화면·칸·항목·속성의
`kind`, 필터 필드의 `kind`·`shape`·`operator`, 정렬 항목의 `direction`, 관계의 `cardinality`.

| 파일                      | 그리는 것                                                                                                                                                            |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `resource-list.tsx`       | 목록 - 스켈레톤·닿지 못함·배너·행 목록·빈 결과, 위의 재조회 실패, 끝의 스피너와 뒤따르는 쪽의 실패, 당겨서 새로고침                                                  |
| `resource-row.tsx`        | 행 하나(카드) - 첫 칸이 제목, 나머지는 "이름 값", 관계 칸은 배지                                                                                                     |
| `resource-detail.tsx`     | 상세 - 스켈레톤·항목 목록, 위의 재조회 실패. 상세를 그리지 못하는 셋(not-found·닿지 못함·배너)은 `DetailFailure` 한 곳이다(수정 폼의 자리와 함께 쓴다)               |
| `filter-sheet.tsx`        | 필터 시트 - 다중·단일 선택, 텍스트, 범위. "적용"·"필터 지우기" 는 머리 줄에                                                                                          |
| `sort-sheet.tsx`          | 목록 위 도구 줄(필터·정렬 버튼)과 정렬 메뉴                                                                                                                          |
| `values.tsx`              | 빈 값(`—`)과 관계 배지 - 목록과 상세가 같이 쓴다                                                                                                                     |
| `resource-form.tsx`       | 생성·수정 폼 - 속성의 `kind` 마다 입력, 관계마다 선택기, 배너·필드 오류, 제출 버튼. 문서 오류가 새로 오면 맨 위로 굴려 배너를 보인다                                 |
| `resource-edit-gate.tsx`  | 수정 폼의 자리(`ResourceEditGate` - 스켈레톤, 상세를 그리지 못하는 셋은 `DetailFailure`, 첫 값은 처음 받은 상세 하나로 고정)와 `FormSkeleton`                        |
| `relationship-picker.tsx` | 관계 선택기 - 고른 것을 배지로, 누르면 아래 시트에 참조 목록. to-one 은 "선택 안 함" 과 하나, to-many 는 켜고 끄기(고른 순서 유지). 목록 밖 선택·잘림·읽기 전용 안내 |

- 판단을 두지 않는다. 쿼리·주소 조립과 응답 → 화면 상태는 `lib/resources/view.ts`·`screen-state.ts`, 요청과 캐시는
  `queries/resources.ts` 다. 주소로의 이동(`router.push`)은 화면(`app/`)이 한다 - 화면을 쌓는 이동은 한 번만 한다
  (`components/app/navigate-once.ts` 의 `useNavigateOnce` - 빠른 두 번 누름이 같은 화면을 두 벌 쌓지 않게).
- 로딩에 글자를 쓰지 않는다 - 첫 로딩은 스켈레톤, 더 읽기·당겨서 새로고침·다시 시도는 스피너(스펙 8.7).
- 아래 여백: 목록·상세·폼의 끝과 시트의 아래는 시스템 내비게이션 막대만큼 띄운다(`useSafeAreaInsets` -
  Android(SDK 57)는 화면 끝까지 그린다).
- 키보드: 시트(`components/app/sheet.tsx`)는 키보드가 올라오면 두 플랫폼 모두 그 높이만큼 올라간다
  (`KeyboardAvoidingView` 의 `padding`) - Android 의 `Modal` 창은 edge-to-edge 라 창이 줄지 않는다. 입력이 든 시트의
  몸통은 `ScrollView`(`keyboardShouldPersistTaps="handled"`)로 그린다 - 줄어든 시트에서도 포커스한 칸까지 굴러간다.
- 접근성: 아이콘으로만 전하는 상태(정렬 방향)는 `accessibilityLabel` 에도 적는다. 자식의 글자가 현재 값을 전하는 눌림 자리
  (관계 선택기의 폼 자리)는 라벨만 달면 그 글자가 읽히지 않는다(Android 는 `contentDescription` 이 자식을 대신한다) -
  `accessibilityValue` 로 현재 값을 읽힌다. 범위 입력은 자리표시자
  ("최소"·"최대")와 라벨이 어느 끝인지 말하고, 숫자 범위의 자판은 `FilterField` 의 `signed`(선언의 `min`)로 가른다 -
  자원 이름이 아니다.
- 백엔드가 응답조차 주지 못한 자리(`unreachable`)는 `components/app/request-failed.tsx` 가 그린다 - 앱 문구
  하나(`UNUSABLE_RESPONSE_MESSAGE`)와 "다시 시도"(스펙 9.3). 첫 조회면 화면 전부(`request-failed`)다. 읽은 목록·상세가
  있으면 그것을 두고 작은 실패(`compact`, `request-failed-compact`)를 더한다 - 재조회가 닿지 못했으면 목록·상세 위에
  (다시 시도는 읽은 것을 다시 읽는다), 다음 쪽이 닿지 못했으면 목록 끝에(다시 시도는 그 쪽만 읽는다).
- 백엔드가 거절한 자리(`banner`)는 그 문구 그대로 그린다. 화면 전부일 때(목록·상세·수정 폼의 자리)는 `BannerScreen`, 시트
  안(관계 선택기)은 `FailureBanner`다(둘 다 `components/app/request-failed.tsx`) - 같은 거절이 화면마다 다르게 그려지지
  않게 한 곳씩 둔다. 첫 조회가 판정하지 않은 응답(5xx·408·429)을 받은 배너(`retryable`)에는 문구 아래에 "다시 시도" 를
  함께 둔다. 판정한 4xx 의 배너는 다시 불러도 같은 답이라 버튼이 없다(스펙 9.3 의 D4 정정). 관계 선택기는 참조 조회의
  실패를 보기 위에 그리고 보기("선택 안 함"·지금 고른 목록 밖 선택)는 그대로 둔다 - 실패한 동안에도 고른 것을 해제할 수 있어야
  한다. 선택기의 참조 목록이 문구 없는 오류로 거절되면 `referenceState` 가 던진 결함을 `combineReferences` 가 값으로 담고
  `useRelationshipReferences` 가 렌더 중에 다시 던져(`referencesOf`) 오류 경계로 간다 - 계약 위반이라 앱 문구로 가리지 않는다.
- testID 는 E2E 플로(`test/e2e/flows/examples-*.yaml`)가 찾는 이름이다. 선언에서 만드는 이름 -
  `filter-option-<키>-<연산자>-<값|any>`·`filter-input-<키>-<연산자>`·`sort-option-<정렬 키>`·`detail-value-<항목 키>`·
  `detail-badge-<항목 키>-<위치>`·`field-label-<속성>`·`field-input-<속성>`·`field-choice-<속성>-<값>`·`field-error-<속성>`·
  `relationship-open|value|sheet|option|none|done|error|unlisted|truncated-<관계>` - 의 규칙을 바꾸면 플로도 함께 바꾼다.
  상세의 `detail-value-<항목 키>` 는 값이 있는 속성과 빈 값(`—`)에 붙고, 관계 배지는 `detail-badge-<항목 키>-<위치>` 다 -
  E2E 가 배지의 순서를 읽는다.
- 폼의 제출은 한 번에 하나다 - 쓰기 훅의 `mutationKey` 를 받아 `useSubmitOnce` 로 감싼다(`queries/AGENTS.md`).
- 폼은 입력을 검증하지 않는다 - 정본 검증자는 백엔드다. 필드 오류·관계 오류·배너의 자리는 `form.ts` 의
  `formStateFromErrors` 가 포인터로 정해 온다(스펙 9.1).
- 클래스에 미디어 쿼리 변형(`sm:` 등)을 쓰지 않는다 - 루트 `AGENTS.md` 의 "React Native Reusables 컴포넌트".
