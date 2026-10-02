# components/app/ 작업 지침

앱 전체에 걸린 화면 조각과 앱 전체의 이동 도우미를 둔다(루트 `AGENTS.md` 의 계층 표) - React Native Reusables
복사본(`components/ui/`)도 자원 UI(`components/resource/`)도 아닌 것이다. 자원 이름을 모르고 fetch 를 하지 않는다.
쓰기가 필요한 조각(로그아웃 버튼)은 `queries/` 의 훅을 부른다.

| 파일                  | 무엇                                                                                                                  |
| --------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `fatal-config.tsx`    | 설정 오류로 시작할 수 없을 때의 화면 - 검증 함수의 원문(변수 이름이 든 문구)을 그린다(스펙 10.1)                      |
| `sheet.tsx`           | 아래에서 올라오는 시트(React Native `Modal`) - 배경을 누르면 닫히고, 키보드가 뜨면 그만큼 올라온다                    |
| `confirm-sheet.tsx`   | 시트 위의 확인 - 수정 화면의 삭제 확인. 확인하는 동안 두 버튼을 막고 스피너만 그린다                                  |
| `request-failed.tsx`  | 백엔드가 응답조차 주지 못했을 때의 앱 문구와 "다시 시도" - `compact` 는 읽은 내용과 함께 그릴 때다                    |
| `not-found-view.tsx`  | 없는 경로와 없는 자원의 화면                                                                                          |
| `logout-button.tsx`   | 앱 셸 머리글의 로그아웃 버튼 - 누르는 동안 스피너만 그린다                                                            |
| `build-info-card.tsx` | 홈의 빌드 정보 카드 - 행과 문구는 `lib/updates/build-info.ts` 가 정했다                                               |
| `back-to-home.ts`     | 홈으로 가는 이동(`goHome`)과, 돌아갈 곳이 없는 화면에서 Android 의 뒤로 가기를 그리로 돌리는 훅(`useBackToHome`)      |
| `home-button.tsx`     | 가드가 보낸 로그인·가입 화면 머리글의 "홈으로"(testID `back-to-home-button`) - iOS 에는 뒤로 가기 키가 없다(스펙 7.3) |
| `navigate-once.ts`    | 화면을 쌓는 이동을 누른 화면이 다시 앞에 올 때까지 한 번만 하는 훅 - 판단은 `lib/navigation/once.ts`                  |

testID 는 E2E(`test/e2e/flows/`)가 찾는 이름이다 - 바꾸면 플로도 함께 바꾼다. 가드가 보낸 로그인 화면에서 홈으로
가는 두 길 - Android 의 뒤로 가기(`back-to-home.ts`)와 머리글의 "홈으로"(`home-button.tsx`) - 은 같은 이동(`goHome`)이고,
돌아갈 화면이 있으면 나서지 않는다(뒤로 가기는 `router.canGoBack()`, 버튼은 머리글이 넘긴 `canGoBack`).
