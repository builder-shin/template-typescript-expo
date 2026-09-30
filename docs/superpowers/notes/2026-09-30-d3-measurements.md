# D3 실측 기록 (2026-09-30)

D3(목록·상세)를 구현하며 정하고 잰 것이다. 명령과 출력을 함께 적는다. L1 은 Task 1, L2–L4 는 Task 3,
L5·L6 은 Task 5 가 적었다.

## L1 — 목록 주소의 인코딩 규칙 (스펙 8.2)

**정한 것.** 앱이 만드는 목록 주소(정렬 메뉴·필터 시트의 "적용"·"필터 지우기")는 `URLSearchParams` 의
직렬화 그대로 키와 값을 퍼센트 인코딩한다 - `filter%5Bstatus%5D%5Bin%5D=draft%2Cactive`. 조립은
`lib/resources/view.ts` 의 `hrefWithQuery`(원본 그대로)와 그것을 부르는 `filterHref`(이 저장소가 더했다)·
`sortOptions`·`clearFiltersHref` 다. 인코딩을 위한 코드를 따로 두지 않는다 - 원본의 조립이 이미 이 모양이다.
문서와 E2E 의 딥링크도 같은 모양으로 쓴다.

**근거.**

- D1 실측 M2: 인코딩한 딥링크(`%5B`·`%5D`)의 대괄호 키가 켜진 앱·꺼진 앱 모두에서 평평한 키로 돌아왔다 -
  두 단계 키(`filter[title][contains]`)까지. `router.setParams` 도 같았다. 인코딩하지 않은 링크는 한 단계
  키(`filter[status]`)만 쟀다.
- expo-router 57.0.24 설치본(`node_modules/expo-router/build`)에서 주소 → 라우트 파라미터는 두 단계다.
  `fork/getStateFromPath-forks.js` 의 `parseQueryParams` 가 `new URL(주소, 'file:').searchParams` 에서 이름마다
  `getAll`(값이 하나면 문자열)을 하고, `hooks/useLocalSearchParams.js` 가 값마다 `decodeURIComponent` 를 한 번
  더 한다(실패하면 그대로). 앱 안의 이동(`router.push(주소)`)도 `global-state/getNavigationAction.js` 에서 같은
  `getStateFromPath` 를 지난다.
- 조건을 바꾸는 이동은 `router.push` 다. 스택 라우터의 PUSH 는 이름이 같아도 새 화면을 쌓는다
  (`react-navigation/routers/StackRouter.js`). `router.setParams` 는 `navigationRef.setParams` 로 지금 화면의
  파라미터를 바꿀 뿐 기록을 남기지 않는다 - 스펙 8.2 의 "뒤로 가기가 이전 조건을 되살린다" 를 지키지 못한다.

**시험.** `test/unit/resources/view-expo.test.ts` 의 "라우트 파라미터 왕복" 이 위 두 단계를 그대로 흉내 내,
`filterHref`·`sortOptions`·`clearFiltersHref` 의 주소가 같은 파라미터와 같은 백엔드 쿼리로 돌아오는지 잰다
(값의 공백·쉼표·`&`·`=`·`+`·`#`·한글 포함).

**알고 넘어가는 한계.** 값 안의 `%XX` 는 라우터의 두 번째 디코딩으로 바뀐다(`PROBE %41` → `PROBE A`). 풀 수
없는 `%`(`100%`)는 그대로 남는다. 제목 검색어에 `%41` 같은 값을 쓰는 경우만 해당하고, Expo Router 의 동작이라
고치지 않는다 - 시험이 이 동작을 고정한다.

**재지 않은 것.** iOS, 인코딩하지 않은 두 단계 키의 딥링크, 메신저·브라우저가 링크를 다시 인코딩하는 경우,
값에 `+`·`&`·`=`·`#`·한글이 든 주소를 기기에서 잰 것. D1 실측 M2 는 대괄호 키만 쟀고, 값의 왕복은 위
시험이 라우터의 해석 순서를 흉내 내 잰 것이다. 값이 든 딥링크는 Task 5 의 딥링크 플로가 기기에서 잰다.

## L2 — Uniwind 1.12.0 의 미디어 블록 결함에 대한 대응 (스펙 16장, D1 실측 M1)

**정한 것.** `@media` 로 컴파일되는 변형을 쓰지 않는다 - 너비(`sm:`·`md:`·`lg:`·`xl:`·`2xl:` 과 그 `max-`·`min-`
꼴), 방향(`portrait:`·`landscape:`), 플랫폼(`ios:`·`android:`·`native:`·`tv:`·`android-tv:`·`apple-tv:`),
`[@media …]:` 꼴의 임의 변형. `test/unit/ui/breakpoints.test.ts` 가 `app/`·`components/` 의 `.ts`·`.tsx` 를 훑어
막는다(객체 키 `sm: …`·`native: …` 는 콜론 뒤 공백으로 가른다). 플랫폼마다 다른 스타일은 `Platform.select`·
`Platform.OS` 로 클래스 문자열을 고른다.

**걸리는 범위.** D1 실측 M1 은 `sm:` 만 쟀다("`md:` 같은 다른 브레이크포인트도 … 재지 않았다"). 이번에 저장소의
`global.css` 를 `@tailwindcss/node` 의 `compile` 로 컴파일한 CSS 를 설치본 `uniwind/dist/metro/transformer.cjs` 의
`ProcessorBuilder` 에 먹여, 변형마다 유틸리티 셋(`pt-1`·`px-2`·`mb-3`)을 주고 규칙이 읽은 조건을 봤다. Tailwind 는
같은 조건의 유틸리티를 한 `@media` 블록으로 모으고(`@media android { .android\:mb-1 … .android\:px-4 … }`),
Uniwind 는 그 블록의 첫 규칙만 조건을 지킨다 - 변형마다 셋 중 하나만 조건을 지녔고 둘은 조건 없는 규칙이 됐다.

- 너비·방향: `sm:`·`md:`·`max-sm:`·`min-[400px]:`·`max-[500px]:`·`portrait:`·`landscape:`.
- 플랫폼: `ios:`·`android:`·`native:`·`tv:`·`android-tv:`·`apple-tv:` - 둘은 `platform` 이 `null` 이라 다른
  플랫폼에서도 적용된다(`android:px-4` 가 iOS 에서도). Uniwind 가 이 여섯을 `@custom-variant <이름> (@media <이름>)` 으로
  정의하고(`uniwind/dist/common/bundler/artifacts/css/variants.js`) 너비와 같은 `parseRuleRec` 경로로 읽는다.
- 임의 변형: `[@media(min-width:600px)]:`·`[@media_(orientation:landscape)]:`·`[@media_android]:` 도 같다.
- 영향이 없는 것: `dark:`(셋 모두 `theme` 이 `dark` - 조건이 블록이 아니라 유틸리티마다의 선택자
  `:where(.dark, .dark *)` 에 있다), `web:`(`@supports selector(div > div)` 라 네이티브에는 규칙이 들어오지 않는다).

**뺀 것.** React Native Reusables 에서 받은 세 파일 - `button.tsx` 크기 넷의 `sm:h-9`·`sm:h-8`·`sm:h-10`·
`sm:h-9 sm:w-9`, `text.tsx` 의 `p` 변형 `sm:mt-6` 과 `blockquote` 변형 `sm:mt-6 sm:pl-6`, `input.tsx` 의 `sm:h-9`
와 web 갈래의 `md:text-sm`. 폰에서 버튼 기본 높이가 40dp 로 돌아간다(D1 은 36dp 를 쟀다). **입력칸도 바뀐다** -
`sm:h-9` 는 버튼 기본과 같은 규칙이라 폰에서 입력칸이 36dp 였다가 40dp 가 되고, D2 의 폼(로그인·가입)은 입력칸과
제출 버튼마다 4dp 커진다. D1 이 잰 조건 표(`sm:mt-6` 만 `minWidth` 640, `sm:h-8`·`sm:h-9`·`sm:h-10`·`sm:w-9`·
`sm:pl-6` 은 0)에서 미루면 나머지도 폰에서 바뀐다: 버튼 `sm` 32→36dp, `lg` 40→44dp, `icon` 36→40dp, `blockquote`
의 왼쪽 안쪽 여백 24→12dp(`p` 는 `sm:mt-6` 이 첫 규칙이라 그대로). 기기에서 잰 것은 버튼 기본 하나뿐이고 입력칸을
포함한 나머지는 Task 5 의 D2 플로(기기)에서 본다. 파일마다 "원본과 다른 곳" 주석이 있다.

**버린 선택지.**

- **패치**(`pnpm patch uniwind@1.12.0`): 결함은 `node_modules/uniwind/dist/metro/transformer.cjs` 의
  `parseRuleRec` 에서 `media` 규칙의 안쪽 규칙마다 `this.declarationConfig = this.getDeclarationConfig()` 로
  `mediaQueries` 를 비우는 한 줄이다. 고칠 수는 있지만 Metro 변환기의 안쪽을 고치는 패치를 템플릿 사용자가
  떠안고, 고친 결과는 번들을 풀어 봐야 잴 수 있다.
- **다른 버전**: npm `latest` 가 1.12.0(2026-09-04)이다. 고쳐진 릴리스가 없다.

**대가.** 640dp 이상(태블릿·펼친 폴더블)도 폰과 같은 크기를 쓰고, 플랫폼마다 다른 클래스는 클래스 변형이 아니라
JS 의 `Platform.select`·`Platform.OS` 로만 고른다(`components/ui/` 가 이미 web 갈래에 쓰는 방식). 되살릴 조건: 고쳐진
Uniwind 릴리스 - 그때 시험을 지우고 컴포넌트를 CLI 로 다시 받는다.

## L3 — 내비게이션 테마의 색 (D1 운반)

`platform/theme.ts` 의 색이 옛 shadcn 팔레트(hsl)라 `global.css` 의 토큰(oklch)과 어긋났다. 색 표를 import 없는
`platform/nav-colors.ts` 로 떼고, `test/unit/ui/nav-colors.test.ts` 가 토큰을 sRGB 로 바꿔 맞댄다(OKLab →
선형 sRGB 행렬과 sRGB 감마. D1 실측 M1 이 기기 화면에서 읽은 넷 - `#171717`·`#0a0a0a`·`#e5e5e5`·`#fafafa` - 으로
변환을 고정했다).

| 테마 | 색 | 토큰 | 옛 값 | 새 값 |
| --- | --- | --- | --- | --- |
| light | `notification` | `--color-destructive` `oklch(0.577 0.245 27.325)` | `hsl(0 84.2% 60.2%)` | `#e7000b` |
| dark | `border` | `--color-border` `oklch(1 0 0 / 10%)` | `hsl(0 0% 14.9%)` | `#ffffff1a` |
| dark | `card`(헤더 배경) | `--color-card` `oklch(0.205 0 0)` | `hsl(0 0% 3.9%)` | `#171717` |
| dark | `notification` | `--color-destructive` `oklch(0.704 0.191 22.216)` | `hsl(0 70.9% 59.4%)` | `#ff6467` |
| dark | `primary` | `--color-primary` `oklch(0.922 0 0)` | `hsl(0 0% 98%)` | `#e5e5e5` |

나머지 일곱(light 의 `background`·`border`·`card`·`primary`·`text`, dark 의 `background`·`text`)은 값이 같고
표기만 16진수가 됐다. 다크 모드의 헤더가 화면 배경(`#0a0a0a`)과 갈라진다 - 토큰의 `card` 가 그렇게 정했다.

## L4 — 소음 셋의 판정 (D1 운반)

- **prebuild 의 `» android: userInterfaceStyle: Install expo-system-ui in your project to enable this feature.`** -
  `expo-system-ui` 를 설치하지 않는다. `app.config.ts` 의 `userInterfaceStyle: 'automatic'` 은 iOS 의
  `UIUserInterfaceStyle` 에 들어가 필요하고, Android 에서는 설치해도 시스템 설정을 따르는 것 그대로다. D1 실측
  M1 이 다크 모드가 JS 쪽(Uniwind·내비게이션 테마·상태 표시줄)에서 도는 것을 쟀다. 경고는 남는다.
- **React Native Reusables CLI 의 "Potential issues"** - `printf 'n\nn\nn\n' | pnpm dlx @react-native-reusables/cli@0.7.1 doctor`
  (Task 3 Step 6)의 진단은 두 건이다: `Missing Files (1) • Theme`(CLI 는 `lib/theme.ts` 를 찾는다 - 이 저장소는
  expo-router 를 import 하는 그 파일을 `platform/theme.ts` 에 둔다, 스펙 5장)과 `Missing Dependencies (1)`
  (`tailwindcss-animate` - Tailwind v3 플러그인이고 이 저장소는 v4 용 `tw-animate-css` 를 쓴다). 둘 다 고치지
  않는다. D1 이 본 "4 Potential issues" 는 그 뒤 두 건으로 줄었다(`add` 가 "2 Potential issues" 를 낸다).
- **`expo export` 의 `web bundles (1)` 0 B CSS**(`_expo/static/css/global-d41d8cd98f00b204e9800998ecf8427e.css`) -
  이름의 해시가 빈 문자열의 MD5 다. 루트 레이아웃의 `import '@/global.css'` 를 Uniwind 가 네이티브에서는 JS 로
  바꾸고 CLI 는 빈 CSS 산출물만 적는다. 앱에 실리지 않고 `dist/` 는 커밋하지 않는다 - 둔다.
- **`components.json` 의 `"hooks": "@/queries"`** - `@/components/hooks` 로 바꿨다. React Native Reusables 의 훅은
  UI 도우미라 `queries/`(데이터)의 소유가 아니다.
