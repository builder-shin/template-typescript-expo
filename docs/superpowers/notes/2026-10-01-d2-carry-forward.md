# D2가 다음 계획에 넘기는 것 (2026-10-01)

D2(세션과 인증)의 리뷰와 판정에서 나온 항목 중 D2 범위 밖이라 뒤 계획이 맡는 것이다. 근거는 D2 실측 기록
(`2026-09-30-d2-measurements.md`), D2 계획(`docs/superpowers/plans/2026-09-30-d2-session-and-auth.md`), 스펙의 날짜 붙은
정정에 있다. D2 계획의 "다음 계획" 절(D3·D4·D5)도 함께 읽는다 - 이 노트는 그 절을 쓴 뒤에 리뷰와 판정에서 나온 것을 모은다.
계획을 쓸 때 이 목록을 읽고, 맡은 항목을 그 계획의 작업에 넣는다.

## D2 계획과 달라진 사실

- **E2E 플로는 여섯이 아니라 일곱이다.** 계획 본문은 "플로 여섯"이다(날짜 붙은 기록이라 고치지 않았다). 일곱째는
  `test/e2e/flows/logout-from-protected.yaml` - 보호 경로 화면에서 로그아웃하면 홈에 닿는지(경로 가드 래치의 끝 상태) 본다.
- **결정 18의 전제가 틀렸다.** 경로 가드의 `<Redirect>`는 루트에서 `(app)`을 로그인 화면으로 바꿔 끼운다(REPLACE). 로그인·가입
  뒤의 `router.dismissTo(next)`는 그 `(app)`을 새로 만드는데, `withAnchor`가 없으면 `(app)`이 복귀한 화면 하나로 시작해 뒤로
  가기가 앱을 닫았다(기기에서 확인 - `guard-return.yaml` 이 뒤로 가기 뒤 런처를 봤다, D2 실측 H3). 결정 18의 비용 분석("틀리면 뒤로 가기가
  홈을 한 번 더 지나는 것뿐")은 틀렸다. 두 `dismissTo`에 `{ withAnchor: true }`를 줘 고쳤고 `guard-return.yaml`이 뒤로 가기 →
  홈을 잰다. `unstable_settings.anchor`는 콜드 스타트의 딥링크에만 저절로 실린다 - 이미 떠 있는 앱에서 `(app)`을 새로 만드는
  이동은 `withAnchor`를 줘야 한다.
- **결정 20이 뒤집혔다.** 로그인·가입의 요청은 성공했는데 세션 저장(SecureStore)이 던지면 `UNUSABLE_RESPONSE_MESSAGE`를 띄운다고
  했지만, `queries/auth.ts`의 `establishIfSignedIn`은 그 거절을 잡아 로그로 남기고 로그인을 이어 간다(세션 관리자가 메모리에는
  이미 세웠다 - 이 실행 동안만 로그인 상태다). 화면 이동은 거절이 아니라 세션 상태를 따른다(`lib/auth/AGENTS.md`).
- **결정 33은 첫째 갈래로 끝났다.** 세 백엔드 어느 응답에도 신선도 수명이 없어 `request()`에 `Cache-Control: no-cache`를 싣지
  않았다(D2 실측 H1).
- **로캘 플로는 키보드 자판이 없는 입력기로 돈다.** Gboard가 앱별 언어를 따라 두벌식으로 바뀌어 Maestro의 키 입력을 한글
  자모로 조합했다(D2 실측 H2, 스펙 11.3의 D2 정정).

## D3 (목록·상세)

- **의존성**: `pnpm-workspace.yaml`의 `minimumReleaseAgeExclude`에 남은 `lucide-react-native@1.49.0`(릴리스 2026-09-29 22:27 UTC)을
  D3의 첫 의존성 변경 때 빼고 `pnpm install --frozen-lockfile`로 확인한다.
- **클라이언트 타이머 가드**(D2 계획 결정 31): 조회에 TanStack Query의 취소(signal)를 붙일 때, 호출자가 이미 끊었으면 타이머가
  `timedOut`을 세우지 않게 한다(`lib/jsonapi/client.ts`).
- **E2E 하네스**
  - logcat 링 버퍼 크기를 정한다. `test/e2e/run-android.sh`는 플로마다 로그를 비우고 모을 뿐이라, 무한 스크롤 같은 긴 플로는
    기본 main 버퍼를 한 바퀴 넘길 수 있다 - 앞쪽 W·E 줄이 사라지면 가짜 통과, 선언한 `[e2e-http]` 줄이 사라지면 가짜 실패다.
    `test/e2e/android.sh boot`에 `"$ADB" logcat -G 16M`을 더하고 `test/e2e/AGENTS.md`에 적는다.
  - 빌드 레시피를 APK 지문에 넣는다. 지문(`run-android.sh`의 `build_fingerprint`)은 `test/`를 빼는데 빌드 레시피(prebuild
    인자·`APP_VARIANT`)는 `test/e2e/android.sh build`에 있다 - 그 파일을 고쳐도 낡은 APK가 조용히 다시 쓰인다. 지문 입력에
    `test/e2e/android.sh`를 명시해 더한다.
  - 가드의 HTTP 선언은 정확한 집합이다. 선언하지 않은 상태가 나와도, 선언한 상태가 한 번도 나오지 않아도 실패다
    (`test/e2e/guard-log.sh`). 타이밍에 따라 나오기도 하고 안 나오기도 하는 상태(예: 재조회 도중의 취소)는 선언할 길이 없다 -
    D3가 그런 플로를 쓰면 "나올 수 있음" 선언(예: 머리말 `# e2e-allow-http-optional:`)을 더할지 정한다.
  - `run_flow`는 `||` 문맥에서 불려 `set -e`가 꺼진다. 입력기·logcat 단계는 반환값을 직접 보지만 `pm clear`·`set-app-locales`는
    보지 않는다 - `run-android.sh`를 만질 때 두 줄에 `|| return 1`을 더해도 좋다(지금은 en·ko 짝 단언이 드러낸다).
- **기기에서 누르지 않은 것**: 앱 안의 로그인·가입 링크(`Link asChild` + `Text` - `register-link`·`login-link`, 계정 생성 안내의
  링크)와 `authLinkHref`가 `next`를 이어받는 것은 기기에서 한 번도 눌리지 않았다(플로는 전부 `openLink`로 들어간다). D3가 한
  걸음을 더한다: 가드 → 로그인 → `register-link` → `OTHER_EMAIL`로 가입 → `next` 화면.
- D3 계획(초안)이 기대는 D2의 자리 가운데 D2가 끝에 바꾼 것: 가드가 더 엄격해졌다(앱의 줄이 없는 로그·선언했는데 나오지 않은
  상태도 실패), `run-android.sh`에 "입력기" 절과 logcat 실패 검사가 더해졌고 Maestro 2.11.x가 아니면 멈춘다, 플로가 일곱이다,
  로그인·가입 뒤 복귀가 `withAnchor`를 준다.

## D4 (쓰기)

- **가드가 보낸 로그인 화면에서 뒤로 가면 앱이 닫힌다.** `app/(app)/_layout.tsx`의 `<Redirect>`가 루트에서 REPLACE해 루트가
  `[(auth)/login]` 하나가 된다(위 결정 18과 같은 기제). D2에서는 가드에 닿는 길이 앱 밖의 딥링크뿐이라 받아들였다 - 외부
  딥링크의 뒤로 가기는 앱을 떠나도 된다. D4가 앱 안에 생성 진입점을 두면 결함이 된다. 기기에서 잴 후보: 로그인 화면에서
  `!router.canGoBack()`이면 뒤로 가기를 `router.dismissTo('/', { withAnchor: true })`로 보낸다, 또는 가드가 먼저 공개 경로로 닫은
  뒤 로그인을 push한다.
- **회전 요청의 백엔드 오류가 전부 세션 삭제로 간다.** `lib/auth/rotation.ts`(복사본)는 상태 0이 아닌 실패를 전부 `destroy`로
  모은다 - 5xx·429·프록시가 준 HTML도(본문을 못 읽으면 `NON_JSONAPI_RESPONSE`가 응답의 상태를 싣는다). 세션이 30일이라 회전
  순간의 502 하나가 사용자를 로그아웃시킨다. 반대로 서버가 이미 회전했다면 옛 refresh를 들고 있다가 재사용 감지로 모든 세션이
  끊긴다(스펙 7.2가 이 복사본을 지정했다). 회전을 처음 부르는 D4가 의식적으로 정한다 - 유지하면 스펙 7.5 한계에 한 줄, 바꾸면
  (예: 5xx·429 → `unreachable`) 이탈 기록과 시험.
- **제출 가드가 렌더 시점의 값을 본다.** `components/form/credentials-form.tsx`의 `if (pending) return`은 렌더 때의 prop이라,
  버튼과 키보드의 이동 키가 거의 동시에 눌리면 둘째 `mutate`가 나간다. 가입이면 첫 요청이 세션을 세우고 둘째가 409를 받아,
  로그인한 채 "이미 가입된 이메일" 배너를 보고 이동하지 않는다(TanStack v5는 호출별 `onSuccess`를 마지막 `mutate`에만 부른다).
  D4의 공용 폼 패턴에 동기 ref로 된 진행 중 가드를 둔다.
- **`lib/auth/session-store.ts`의 시각 주석이 로그인에는 맞지 않는다.** "`session.accessExpiresAt` 을 만든 시각과 같은 값을
  넘긴다"고 적는데, 로그인은 `signIn`이 요청 전 시각으로 access 만료를, `establish`가 응답 뒤 시각으로 refresh 만료를 잡는다(차이
  15초 이하). D4가 이 파일을 만질 때 주석을 고치거나 한 시각을 넘긴다.
- **`/examples/[id]/edit` 보호 판정.** `usePathname()`은 파라미터를 풀어 경로를 다시 만든다 - `/examples/a%2Fb/edit`가
  `/examples/a/b/edit`가 되어 `[^/]+` 패턴을 벗어난다. edit 라우트를 만드는 D4가 세그먼트(`useSegments`) 기준 판정이나 인코딩
  유지를 정하고 `test/unit/auth/protected-paths.test.ts`에 행을 더한다. 둘째 겹(쓰기 가드)이 받쳐 준다 - 없는 id 의 쓰기는
  백엔드가 401 로 막는다.
- **세션 관리자의 거절은 호출자가 잡는다.** `establish`·`getAccessToken`·`signOut`·`logout`은 저장소가 실패하면 상태를 정리한 뒤
  거절한다. D2의 호출부(`establishIfSignedIn`, 로그아웃 `onError`, 거절하지 않는 `restore`)는 닫혔다. 첫 `getAccessToken`·
  `signOut` 호출자가 D4다 - 맨 `void manager.signOut()`을 두지 않는다(`queries/AGENTS.md`의 규칙).
- **`establishIfSignedIn`의 catch 정책에 시험이 없다.** `queries/`의 첫 단위 시험(스펙 8.5의 키·무효화 표)과 함께
  `MutationObserver` 수준에서 거절하는 `establish`를 재거나, 정책을 `lib/`로 뺀다.
- **복원 창의 전제.** 세션 복원(`restore()`)이 저장소를 읽는 동안에는 세대 번호가 지키지 않는다 - 그동안 `establish`·`signOut`을
  부르는 자리가 없다는 전제다(`AppRoot`가 복원이 끝날 때까지 아무것도 그리지 않는다). 같은 이유로 복원 중에는 내비게이터가 없어
  `router.*`가 던진다 - 인증 오류 처리(스펙 9.2, `QueryCache`·`MutationCache`의 `onError`)처럼 이동하는 코드는 복원 뒤의
  트리 안에서만 돈다.

## D5 (계약 실험실·거울)

- **`apiRequest`가 호출자가 준 `acceptLanguage`를 덮어쓴다.** `platform/api.ts`의 `withAcceptLanguage(options, …)`는 기기 언어가
  하나라도 있으면 호출자 값을 덮는다. 스펙 8.6의 언어 협상 실험(같은 오류를 en·ko로 비교)은 헤더를 명시해야 한다. 존중할지
  덮을지 정하고 `test/unit/platform/api.test.ts`에 한 행으로 고정한다(지금은 이 동작을 고정한 시험이 없다).
- 게이트에 계약 거울을 E2E 앞에 더하며 번호를 `[N/13]`으로 바꿀 때(D2 계획 결정 13) 고칠 자리는 D2가 `[n/11]`을 `[n/12]`로 옮긴
  자리 그대로다: `scripts/check.sh`, `test/unit/scripts/check-citations.test.ts`의 주석 넷, `lib/config/AGENTS.md`,
  `docs/provenance/copied-core.json`의 `note`와 인용 시험 이탈의 `what`.

## D7 (CI)

- **로캘 플로가 음성 입력 IME에 기댄다.** 하네스는 앱별 언어를 정한 플로 동안 키보드 자판이 없는 입력기(이 개발 머신의
  `Pixel_9_API_36` Google Play 이미지에서는 Google 음성 입력)를 기본으로 둔다. CI 이미지에 그런 입력기가 없으면 두 로캘 플로가
  `키보드 자판이 없는 입력기가 켜져 있지 않다 …`로 실패한다. 이미지를 고르거나, 없으면 `pm disable-user`로 Gboard를 잠시 끄는
  길 같은 대안을 잰다(입력기를 모두 끄는 길은 Maestro 세션 안에서 기본 키보드가 다시 켜져 막혔다 - D2 실측 H2).
- **게이트를 1–11단계만 돌리는 길이 없다.** `scripts/check.sh`는 `[12/12]` E2E를 늘 돈다. 스펙 13장의 CI `checks` 잡은 "게이트
  1–11단계"다 - 끄는 변수를 두거나 스크립트를 나눈다.
- D1 운반 기록의 D7 절 "NestJS 프로필은 이 저장소에서 아직 한 번도 띄우지 않았다"는 풀렸다 - D2가 캐시 머리글을 재며 띄웠다
  (이미지 빌드 포함 33초, D2 실측 H1).
- 짧은 경로 사본(`E2E_STAGE_DIR`)은 Windows 의 47자 제한 때문이다. `test/e2e/android.sh check-path`는 Git Bash 의 `pwd -W`가 있을
  때만 재므로 Linux·macOS 러너에서는 저장소 자리에서 빌드한다.
