# D3 실측 기록 (2026-09-30)

D3(목록·상세)를 구현하며 정하고 잰 것이다. 명령과 출력을 함께 적는다. L1 은 Task 1(기기에서 잰 딥링크와 그
정규화는 Task 5), L2–L4 는 Task 3, L5·L6 은 Task 5, L7 은 D3 최종 검토 뒤의 고침이 적었다.

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

**기기에서 잰 것(Task 5) - 밖에서 들어온 딥링크는 다르게 풀렸다.** 값에 `+`·`&`·`=`·`#`·한글이 든 딥링크를
Pixel_9_API_36(Android 16)의 e2e 앱에 보냈다 - E2E `examples-browse` 의 Maestro `openLink`, 그리고 같은 모양의 링크를
`adb shell am start -a android.intent.action.VIEW -d '<링크>'` 로 켜진 앱과 꺼진 앱(콜드 스타트)에. 앱이 백엔드에
보낸 목록 요청(uvicorn 접근 로그, 켜진 앱):

```text
보낸 링크  templateexpo-e2e://examples?filter%5Btitle%5D%5Bcontains%5D=probe-d3-repro%20%EA%B0%80%2B%EB%82%98%26%EB%8B%A4%3D%EB%9D%BC%23%EB%A7%88
고치기 전  GET /api/v1/examples?filter%5Btitle%5D%5Bcontains%5D=probe-d3-repro+%EA%B0%80+%EB%82%98&page%5Bafter%5D=&page%5Bsize%5D=20&include=category%2Ctags
고친 뒤    GET /api/v1/examples?filter%5Btitle%5D%5Bcontains%5D=probe-d3-repro+%EA%B0%80%2B%EB%82%98%26%EB%8B%A4%3D%EB%9D%BC%23%EB%A7%88&page%5Bafter%5D=&page%5Bsize%5D=20&include=category%2Ctags
```

고치기 전에는 라우트 값이 `probe-d3-repro 가 나` 였다 - `+` 가 공백이 되고 `&` 에서 잘렸다(`#` 뒤는 조각이 돼
버려진다). 콜드 스타트(`probe-d3-cold …`)도 같았고, 한글·공백·`=` 는 살아남았다. 앱 안의 이동은 멀쩡했다 - 필터
시트의 제목 칸에 `inapp+a&b=c#d` 를 치고 적용한 요청은 `filter%5Btitle%5D%5Bcontains%5D=inapp%2Ba%26b%3Dc%23d` 였다.
원인은 설치본 expo-router 57.0.24 의 `build/fork/extractPathFromURL.js` 다: 들어온 URL 을 경로로 바꾸는
`fromDeepLink`(60행)가 쿼리를
`` [...res.searchParams.entries()].map(([k, v]) => `${k}=${safeDecodeURIComponent(v)}`).join('&') ``(97–102행)로 다시
짠다 - 이미 디코딩한 값을 한 번 더 디코딩하고 다시 인코딩하지 않고 잇는다. 위 "근거" 의 두 단계 해석은 앱 안의
이동(`router.push`)에만 맞았다. `router.push` 는 이 함수를 지나지 않는다
(`global-state/getNavigationAction.js` 가 `getStateFromPath` 를 바로 부른다).

**고친 것.** `app/+native-intent.tsx` 의 `redirectSystemPath` 가 이 빌드의 scheme(`Constants.expoConfig.scheme`,
`platform/config.ts` 의 `appSchemes`)으로 들어온 링크를 쿼리의 인코딩을 그대로 둔 앱 안 주소(`/examples?…`)로 바꿔
넘긴다(`lib/navigation/deep-link.ts` 의 `appPathFromDeepLink`). `fromDeepLink` 는 `/` 로 시작하는 주소를 그대로
돌려준다(74–75행 - 상대 주소라 `new URL` 이 던진 갈래) - 딥링크가 `router.push` 와 같은 해석을 지난다. 다른 scheme
(`https://…`, 개발 클라이언트의 `exp+…://expo-development-client/?url=…`)은 건드리지 않는다.
`test/unit/navigation/deep-link.test.ts` 가 설치본의 `extractExpoPathFromURL` 을 지나는 왕복(위 링크, 값마다의
`+`·`&`·`=`·`#`·한글·`%20`, 대괄호 키, `login?next=`, 경로의 id, `<scheme>:///`, 변형 넷의 scheme)과 정규화하지 않은
링크가 값을 잃는 것을 잰다. 위 "고친 뒤" 줄이 기기의 결과다 - 꺼진 앱도 `probe-d3-cold+%EA%B0%80%2B…` 로 같았다.
E2E `examples-browse` 는 과녁 하나·미끼 셋(`&`·`+`·`#` 에서 값이 틀어지면 걸리는 제목)과 필터 시트의 제목 칸,
그 목록의 정렬 메뉴가 만든 주소(`…%2B…&sort=-score`)로 잰다.

**재지 않은 것.** iOS, 인코딩하지 않은 두 단계 키의 딥링크, 메신저·브라우저가 링크를 다시 인코딩하는 경우. D1 실측
M2 는 대괄호 키만 쟀다. 값의 `%XX` 가 라우터의 두 번째 디코딩으로 바뀌는 한계(위)는 딥링크에도 그대로다.

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
포함한 나머지는 Task 5 의 D2 플로(기기)에서 본다(L6 - 입력칸과 기본 버튼 40dp, `sm` 버튼 36dp 를 기기에서 쟀다).
파일마다 "원본과 다른 곳" 주석이 있다.

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

## L5 — 네이티브 HTTP 캐시 아래의 목록·상세 신선도 (기기, D1 운반)

**왜 재는가.** SDK 57 의 `expo/fetch` 는 네이티브 HTTP 캐시(Android OkHttp·iOS URLCache)를 거치고, 그 캐시는
요청의 `cache` 옵션이 아니라 응답 머리글을 따른다(D1 실측 M6). D2 가 세 백엔드가 싣는 머리글을 쟀다(D2 실측
H1). 앱의 GET 은 D3 가 처음이다.

**D2 의 판정.** 세 백엔드 모두 이 세 응답에 신선도 수명을 주지 않는다 - 네이티브 캐시가 저장하더라도 다음 요청은
서버에 가서 검증받는다(`ETag`가 있으면 표현이 다를 때 새 본문이 온다). 로그아웃 뒤 다른 사용자로 로그인한 앱이 앞
사용자의 응답을 받을 길이 없다.

**기기에서 잰 것.** `test/e2e/flows/examples-scroll-refresh.yaml` 이 목록을 연 뒤 백엔드에 직접(`runScript`) 행을
만들고 제목을 바꾼다. 세 단계가 새 값을 받았다 - 당겨서 새로고침(`<접두사> 00`), 앱을 뒤로 보냈다 불러온
재조회(`<접두사> 000`, AppState → focusManager), 상세 재진입(`<접두사> 01 renamed`, 캐시를 그린 뒤 다시 부른다).
그 플로의 백엔드 접근 로그(`.maestro-output/e2e/examples-scroll-refresh/api.log`, 하네스가 플로마다 남긴다)에서
센 요청(Task 5 Step 6 (b)):

```text
$ grep -c 'GET /api/v1/examples?' "$L"
7
$ grep -c 'GET /api/v1/examples/' "$L"
2
$ grep -cE 'POST /api/v1/examples |PATCH /api/v1/examples/' "$L"
28
```

목록 GET 일곱 가운데 첫 줄은 앞 플로(`examples-invalid-filter-en`)의 400 이다 - 하네스가 로그를 플로 시작 5초
앞에서 자르므로(호스트와 Docker 의 시계 차이) 앞 플로의 마지막 요청이 들어올 수 있다. 이 플로의 목록 GET 은
여섯이다 - 첫 쪽·둘째 쪽, 새로고침의 두 쪽, 앱 복귀의 두 쪽(TanStack Query 는 읽어 둔 쪽을 모두 첫 쪽부터 다시
읽는다). 상세 GET 둘은 첫 진입과 재진입, 쓰기 스물여덟은 행 25·새 행 2·이름 바꾸기 1 이다. 세 수는 Task 5 의 두
전체 실행(L1·L6 의 수정 전 APK 와 마지막 APK)에서 같았다. 첫 게이트 실행에서는 목록 GET 이 여덟이었다 - 앞 플로의 줄은
없었고, 맨 위로 굴린 마지막 스와이프(`scrollUntilVisible` 의 위쪽)가 목록을 당겨 새로고침을 한 번 더 일으켰다(둘째 쪽
커서 `… 20` 이 두 번). 그 새로고침은 `<접두사> 00` 을 만들기 전에 끝났지만, 도는 동안에는 다시 당겨도 새로고침이 일어나지
않아(`RefreshControl` 이 당김을 받지 않는다) 새 행을 놓칠 수 있다. 처음에는 그 스크롤 뒤에 `waitForAnimationToEnd` 를
두었으나 경합을 닫지 못한다 - 하네스가 애니메이션 배율을 0 으로 두어 스피너가 곧바로 정지 화면이 되고, Maestro 2.11 의
그 명령은 시간이 다 돼도 실패하지 않는다(D3 최종 검토가 설치본 jar 에서 읽었다). 그래서 `<접두사> 00` 을 위로 굴리기
**전에** 만들게 바꿨다 - 어느 당김의 새로고침이든 그 행을 받고, 둘 다 `RefreshControl` 의 당김이라 재는 것은 같다.
요청의 순서(접두사와
id 를 가리고 커서를 줄였다):

```text
POST /api/v1/auth/register · POST /api/v1/auth/login                  201 200 (runScript seed)
POST /api/v1/examples ×25                                             201   (runScript seed)
GET  /api/v1/examples?filter[title][contains]=<접두사>&sort=title&page[after]=&page[size]=20…   200   (첫 쪽)
GET  /api/v1/examples?…&page[after]=<커서: "<접두사> 20">&page[size]=20                         200   (둘째 쪽)
POST /api/v1/examples                                                 201   (<접두사> 00)
GET  …page[after]=&…  ·  GET …page[after]=<커서: "<접두사> 19">…      200 200 (당겨서 새로고침)
POST /api/v1/examples                                                 201   (<접두사> 000)
GET  …page[after]=&…  ·  GET …page[after]=<커서: "<접두사> 18">…      200 200 (앱 복귀)
GET  /api/v1/examples/<id>?include=category,tags                      200   (상세 첫 진입)
PATCH /api/v1/examples/<id>                                           200   (<접두사> 01 renamed)
GET  /api/v1/examples/<id>?include=category,tags                      200   (상세 재진입)
```

새로고침과 앱 복귀의 둘째 쪽 커서가 `… 19`·`… 18` 로 당겨진 것은 첫 쪽에 새 행이 하나씩 끼었기 때문이다 - 두
재조회가 서버의 새 목록을 받았다. FastAPI 응답에는 캐시 머리글이 없다(D2 H1 - `date`·`server`·`content-type`·
`content-length` 넷).

**판정.** 네이티브 HTTP 캐시가 목록·상세의 새 값을 가리지 않는다 - 단계마다 요청이 백엔드에 닿았고 화면이 새 값을
그렸다. `lib/jsonapi/client.ts` 는 `Cache-Control` 을 싣지 않는다(D2 H1 이 첫째 갈래 - 신선도 수명이 없는 응답이다).

**재지 않은 것.** iOS URLCache(D7 의 CI), NestJS·Rails 의 머리글 아래에서의 기기 동작(D7 의 매트릭스).

## L6 — 목록·상세 E2E 와 화면 (기기)

**명령.** `E2E_AVD=Pixel_9_API_36 ./test/e2e/run-android.sh`(Task 5 Step 4) - Pixel_9_API_36(Android 16, API
36, 1080x2424, 420dpi, 제스처 내비게이션), FastAPI 스택(`template-python-fastapi` `main` 의 `3c4eee3`), 플로는 D2 의
일곱과 D3 의 여섯(목록·상세 다섯, `auth-links`). 마지막 APK 로 돈 실행(빌드 없이, 746초):

```text
빌드 입력이 지난번과 같다 - APK 를 다시 만들지 않는다 (C:/t/e/android/app/build/outputs/apk/release/app-release.apk)
--- auth-links
--- examples-browse
--- examples-empty-notfound
--- examples-invalid-filter-en (en-US)
--- examples-scroll-refresh
--- examples-sort-filter
--- guard-return
--- login-error-en (en-US)
--- login-error-ko (ko-KR)
--- logout-from-protected
--- register-conflict
--- register-invalid
--- register-restore-logout
=== E2E 통과 - 플로 13개 ===
```

첫 실행(`BUILD SUCCESSFUL in 4m 26s`)은 열셋 가운데 열둘이 통과했다 - `examples-browse` 가 값에 `+`·`&`·`#` 이 든
딥링크 단계에서 실패했다(L1 의 "기기에서 잰 것"). 그 정규화와 아래 "시트와 키보드" 를 고친 뒤 APK 를 한 번 다시
만들었다(`BUILD SUCCESSFUL in 3m 46s`).

**가드.** 선언한 실패 표식 - `examples-empty-notfound` 의 404 둘(형식이 맞는 없는 UUID, 형식이 틀린 id - 둘 다
`RESOURCE_NOT_FOUND`), `examples-invalid-filter-en` 의 400 하나(`INVALID_FILTER`). 선언하지 않은 D3 플로 넷
(`examples-browse`·`examples-sort-filter`·`examples-scroll-refresh`·`auth-links`)의 표식은 0 이다(Task 5 Step 6 (a)).

**기기 로그의 링 버퍼.** `android.sh boot` 가 `logcat -G 16M` 으로 넓힌다 - 하네스가 플로마다 로그를 비우고 끝에
모으므로, 버퍼가 긴 플로 하나를 다 담지 못하면 앞쪽 줄이 밀려나 가드가 가짜로 통과하거나 실패한다. 이미 켜진 기기에서
넓히기 전은 `main: ring buffer is 2 MiB` 였다. 실행 뒤의 `adb logcat -g`:

```text
main: ring buffer is 16 MiB (4 MiB consumed, 952 KiB readable), max entry is 5120 B, max payload is 4068 B
system: ring buffer is 16 MiB (4 MiB consumed, 122 KiB readable), max entry is 5120 B, max payload is 4068 B
crash: ring buffer is 16 MiB (0 B consumed, 0 B readable), max entry is 5120 B, max payload is 4068 B
kernel: ring buffer is 16 MiB (0 B consumed, 0 B readable), max entry is 5120 B, max payload is 4068 B
```

가장 긴 플로 `examples-scroll-refresh` 의 기기 로그는 2줄(`--------- beginning of main` 과 앱이 뜰 때의
`I/ReactNativeJS(…): Running "main"`)이다 - e2e 변형(릴리스)의 JS 는 그 줄 밖에 남기지 않았다. 지금의 로그 양으로는
2MiB 로도 밀려나지 않지만, 경고·오류가 쏟아지는 회귀에서 가드가 앞쪽 줄을 놓치지 않게 넓혀 둔다.

**빌드 지문.** 빌드 레시피 `test/e2e/android.sh` 가 지문에 든다 - 레시피를 고치면 APK 를 다시 만들고 플로만
고치면 만들지 않는 것을 클론한 사본에서 확인했다(Task 5 Step 1 (7): `레시피를 고치면 바뀐다: yes / 플로만 고치면
바뀐다: no`).

**앱 안의 인증 링크.** `auth-links` 가 보호 경로 → 로그인 → 가입하기 → 로그인 → 가입하기 → 가입 → 막혔던
화면(`/examples/new`)을 지났다 - 두 링크가 `next` 를 이어받는다. 복귀한 화면에서 뒤로 가면 홈이 나온다(가입 쪽의
`withAnchor`). 계정 생성 안내의 링크는 가입이 되고 자동 로그인만 실패해야 보여 기기에서 누르지 않았다.

**릴리스 대기 예외.** `pnpm-workspace.yaml` 의 `lucide-react-native@1.49.0` 은 두었다 - 이 태스크의 두 빌드
(2026-09-30T19:18Z·20:00Z) 모두 릴리스로부터 24시간(2026-09-30T22:27:09Z) 전이었다. D4 의 첫 의존성 변경에서 뺀다.

**화면**(Task 5 Step 6 (c) 의 두 캡처 - `probe-seed`·`sort=title` 의 목록, 라이트·다크): 행이 카드로 그려지고 제목
순서가 alpha, bravo, charlie, delta, echo, foxtrot 이다. 관계 배지(`프로브 분류 하나`·`프로브 라벨 하나`·`프로브 라벨
둘`)와 `2026-04-06 05:06` 이 보인다. 도구 줄의 버튼(필터·정렬)은 `size="sm"`(`h-9`)이라 95px(36dp)다 - 기본 크기
(`h-10`)인 홈의 `Example 목록`·로그인의 제출 버튼과 입력 칸(필터 시트·로그인)은 105px(40dp)다. 픽셀로 읽은 색 - 다크의
헤더 배경 `#171717`, 화면·도구 줄 배경 `#0a0a0a`, 라이트는 셋 다 `#ffffff`. 계획의 캡처 명령
(`adb shell am start … -d '…&sort=title' <패키지>`)은 인자가 기기 셸에서 다시 풀려 `&` 에서 잘린다 - 첫 캡처는 기본
정렬의 목록이었다. 명령 전체를 한 문자열로 넘겨(`adb shell "am start … -d '<링크>' <패키지>"`) 다시 찍었다.

**시트.** 필터 시트·정렬 메뉴(React Native `Modal`)의 요소를 Maestro 가 찾았다(`examples-sort-filter` 의
`sort-option-score`·`filter-option-status-in-active`·`filter-input-score-gte`·`filter-apply`) - Portal 판으로 바꾸지
않았다. 뒤로 가기는 떠 있는 키보드를 먼저, 다음 번에 시트를 닫는다.

**시트와 키보드.** 고치기 전에는 범위 칸에 포커스해도 시트가 제자리였고 칸이 키보드 밑에 들어갔다 - Android 의
`Modal` 창(`ty=APPLICATION`, `sim={adjust=resize}`)이 `EDGE_TO_EDGE_ENFORCED` 로 그려져 창이 줄지 않았다(키보드가
떠도 창의 frame 이 `[0,0][1080,2424]`). `components/app/sheet.tsx` 의 `KeyboardAvoidingView` 를 두 플랫폼 모두
`behavior="padding"` 으로 바꿨다 - RN 의 키보드 이벤트가 Modal 창의 키보드에도 와서 시트가 키보드 위로 올라갔다.
`uiautomator dump` 의 bounds 와 `dumpsys window` 의 IME 창(px):

| 포커스한 칸 | IME 창 | 시트(고치기 전 → 뒤) | 칸(고치기 전 → 뒤) |
| --- | --- | --- | --- |
| `filter-input-score-gte`(숫자 자판) | `[0,1657][1080,2424]` | `[0,1014][1080,2424]` → `[0,249][1080,1657]` | `[42,1704][530,1809]` → `[42,939][530,1044]` |
| `filter-input-createdAt-gte`(글자 자판) | `[0,1541][1080,2424]` | `[0,1014][1080,2424]` → `[0,231][1080,1541]` | `[42,2152][530,2257]` → `[42,1289][530,1394]` |

고친 뒤 두 칸 모두 IME 창의 위 끝보다 위에서 끝난다. 글자 자판이 더 높아 시트가 1410px 에서 1310px(남은 높이의
85%)로 줄었고 몸통의 `ScrollView` 가 포커스한 칸까지 굴렀다(제목 칸 위쪽이 머리 줄 밑으로 들어간다). 키보드가 없을 때의
시트는 그대로다(`[0,1014][1080,2424]`).

**아래 여백.** 제스처 내비게이션 막대는 `[0,2361][1080,2424]`(63px, 24dp)다. 목록(행 15개)을 끝까지 굴리면 마지막
행이 y=2361 에서 끝난다. 상세(40줄 설명)를 끝까지 굴리면 마지막 항목(태그의 `—`)이 2318 에서 끝난다. 필터 시트의
몸통은 2277, 정렬 메뉴의 마지막 항목은 2278 에서 끝나고 시트는 2424 까지 그린다 - 아래 여백 147px 은 32dp +
24dp 다. `Modal` 창 안에서도 `useSafeAreaInsets` 가 내비게이션 막대의 24dp 를 준다. 막대 밑에 들어간 내용은 없다.

**숫자 자판.** 점수 범위 칸은 `number-pad` 다(선언의 `min: 0` - `signed` 가 거짓, EditorInfo `inputType=0x2`).
Gboard 의 숫자 자판에 `-` 키가 있고, 그 키와 `5` 를 눌러 `-5` 가 들어갔다 - Android 는 이 자판에서 빼기 기호를 막지
않는다. Example 에는 `signed` 필드가 없어 `numeric` 자판은 기기에서 보지 못했다.

**목록의 네이티브 조각.** `RefreshControl`(당겨서 새로고침)과 `onEndReached`(둘째 쪽 읽기)가
`examples-scroll-refresh` 에서 돌았다(L5 의 요청 줄). D2 의 일곱은 입력·버튼이 36dp 에서 40dp 로 바뀐 뒤에도
통과했다 - testID 로 찾는다.

## L7 — 닿지 못한 재조회와 읽은 목록 (기기, D3 최종 검토 I1)

**왜 재는가.** 처음 판은 백엔드에 닿지 못한 조회를 결과 값으로 캐시에 두었다(D3 계획 결정 7). 그래서 재조회(앱 복귀·
네트워크 복귀·당겨서 새로고침·다시 들어온 상세)가 닿지 못하면 쪽 배열이 `[실패]` 하나로 바뀌어 읽은 목록·상세가 전체
화면 실패가 되고, 연결이 돌아와도 첫 쪽만 다시 읽었다. D3 최종 검토가 설치본 query-core 5.104.0 과 앱의 옵션(`staleTime`
0·재시도 없음·`offlineFirst`)으로 재 보였다:

```text
after scrolling 3 pages: list rows=6 calls 3
after app return while offline: unreachable (full screen) calls 4
after reconnect: list rows=2 calls 5
```

**고친 것.** 조회의 `queryFn` 이 닿지 못함을 던진다(`queries/resource-options.ts` 의 `throwIfUnreachable` - 결정 7 의
"틀리면" 갈래). TanStack Query 는 재조회가 실패해도 앞의 `data` 를 둔다. 화면 상태는 `listScreen`·`detailScreen`
(`lib/resources/screen-state.ts`)이 데이터·오류에서 정한다 - 데이터가 없으면 실패가 화면 전부, 있으면 그대로 두고 작은
실패(`request-failed-compact`)를 더한다. `test/unit/queries/resource-options.test.ts` 가 검토의 탐침을 실제
`QueryClient`·`focusManager`·`onlineManager` 로 돈다 - 결과 값으로 캐시에 두는 판으로 되돌리면 네 전이가 실패한다(앱 복귀
뒤와 새로고침 뒤의 화면이 `unreachable`, 다음 쪽 실패 뒤 `hasNextPage` 거짓, 상세 재조회 뒤 `unreachable`).

**기기에서 잰 것.** `test/e2e/flows/examples-offline-refetch.yaml` - 목록을 읽은 뒤 비행기 모드를 켜고(에뮬레이터에서
10.0.2.2 가 곧바로 `connect: Network is unreachable` - `adb shell ping` 으로 확인했다) 당겨서 새로고침하고, 비행기 모드를
끈다. Maestro 출력:

```text
Enable airplane mode... COMPLETED
Swipe from (50%, 35%) to (50%, 85%) in 1000 ms... COMPLETED
Assert that id: request-failed-compact is visible... COMPLETED
Assert that "probe-seed alpha", id: resource-row-title is visible... COMPLETED
Assert that "probe-seed bravo", id: resource-row-title is visible... COMPLETED
Assert that id: request-failed is not visible... COMPLETED
Disable airplane mode... COMPLETED
Assert that id: request-failed-compact is not visible... COMPLETED
Assert that "probe-seed alpha", id: resource-row-title is visible... COMPLETED
```

기기 로그에는 `[e2e-http] 0 GET /api/v1/examples NETWORK_ERROR` 하나(선언한 0)와 `Running "main"` 뿐이다. 백엔드
접근 로그의 목록 GET 은 둘이다 - 첫 조회와 연결 복귀의 재조회. 끊긴 동안의 당김은 서버에 닿지 않았다.

**`docker pause` 를 쓰지 않은 까닭.** Maestro 플로에는 호스트의 셸 명령을 부를 단계가 없다 - `runScript` 의 GraalJS 는
Maestro 2.11 이 표시한 호스트 멤버에만 닿는다(`GraalJsEngine` 의 `allowAccessAnnotatedBy`). 컨테이너를 멈추려면 하네스에
제어 서버를 더해야 한다. 비행기 모드는 플로 안에서 켜고 끄며 곧바로 실패한다. 대신 "다시 시도" 버튼의 성공 갈래는 기기에서
누르지 않는다 - 연결이 돌아오면 네트워크 복귀의 재조회가 먼저 작은 실패를 걷는다. 버튼이 부르는 것(목록 위·전체 화면은
`refetch`, 목록 끝은 `fetchNextPage`)은 단위 시험이 잰다. `onFlowComplete` 는 2.11.0 에서 실패한 단계 뒤에도 돈다 -
비행기 모드를 켜고 없는 id 를 단언하는 스크래치 플로가 `FAILED` 뒤에 `Disable airplane mode... COMPLETED` 를 찍었고
기기는 `disabled` 였다. `android.sh boot` 도 비행기 모드를 끈다(하네스가 그 플로 도중에 죽은 경우).

**실행.** `E2E_AVD=Pixel_9_API_36 E2E_FORCE_BUILD=1 ./test/e2e/run-android.sh` - 1064초(`BUILD SUCCESSFUL in 3m 58s`),
`=== E2E 통과 - 플로 14개 ===`(D2 의 일곱과 D3 의 일곱). 선언한 표식 - 404 둘, 400 하나, 0 하나 - 과 선언하지 않은
D3 플로 넷의 0. `examples-scroll-refresh` 의 둘째 쪽 커서는 `… 20` → `… 19` → `… 18` 이었다(L5 - `<접두사> 00` 을 위로
굴리기 전에 만들게 바꾼 뒤).

**그 앞의 빌드 실패.** 이 수정의 첫 빌드가 `:app:createBundleReleaseJsAndAssets` 에서 죽었다(`BUILD FAILED in 29s`):

```text
> Process 'command 'cmd'' finished with non-zero exit value -1073741819 (NTSTATUS 0xC0000005)
```

원인을 가른 것:

- Metro 는 `Android Bundled … (2042 modules)`·`Done writing bundle output`·`Done writing sourcemap output` 까지 찍었다.
  디스크의 `index.android.bundle` 은 JS 그대로였고(Hermes 로 바꾸기 전) 컴파일러 소스맵이 없었다.
- 같은 번들을 Gradle 과 같은 인자(`-w -emit-binary -max-diagnostic-width=80 -out … -O -output-source-map`)로 설치본
  `hermes-compiler/hermesc/win64-bin/hermesc.exe` 에 세 번 넣었다 - 셋 다 exit 0, 3,652,268 바이트, 매직 `c6 1f bc 03`.
  죽은 것은 `hermesc` 가 아니라 번들을 다 쓴 node(`export:embed`)의 종료다 - D1 실측 M1 관찰 8 과 같은 모양이다.
- `$TMP/metro-cache`(29MB)를 지우고 `E2E_FORCE_BUILD=1` 로 한 번 빌드했다 - 재현되지 않았다(위 실행). Gradle 의 번들
  명령은 어차피 `--reset-cache` 를 준다(`BundleHermesCTask.kt` - 실패한 빌드도 `Bundler cache is empty, rebuilding` 을
  찍었다) - 캐시를 비운 채 도는 번들도 드물게 종료에서 죽는다는 관찰을 M1 관찰 8 에 더한다. 재시도로 덮지 않았다 -
  가르는 데 7분(21:45Z–21:52Z)이 걸렸다.
