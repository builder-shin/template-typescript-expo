# components/form/ 작업 지침

폼 조각을 둔다 - 자원 이름·fetch·세션을 모른다(루트 `AGENTS.md` 의 계층 표). 어떤 오류가 어느 자리로 가는지는
`lib/` 가 정해 온다(스펙 9.1) - 인증 폼은 `lib/auth/form-state.ts`·`lib/auth/flow.ts`, 자원 폼은 `lib/resources/form.ts`.

| 파일                   | 무엇                                                                                            |
| ---------------------- | ----------------------------------------------------------------------------------------------- |
| `field-error.tsx`      | 입력 하나 아래의 필드 오류 - 백엔드가 준 문구를 전부 그린다(첫 것만 그리지 않는다)              |
| `form-banner.tsx`      | 폼 위의 배너 - 필드에 붙지 않는 문서 오류. 새로 나타나면 스크린 리더가 읽는다                   |
| `submit-button.tsx`    | 제출 버튼 - 제출하는 동안 글자 대신 스피너만 그리고, 접근 가능한 이름은 그대로 둔다             |
| `credentials-form.tsx` | 로그인·가입이 함께 쓰는 자격증명 폼 - 제출은 쓰기의 키로 한 번에 하나(`queries/submit-once.ts`) |

오류 문구를 만들지 않는다 - 백엔드가 `Accept-Language` 로 협상한 문구를 받아 그린다(스펙 9.3). 스피너가
`ActivityIndicator` 인 것은 Uniwind 1.12 에 도는 CSS 애니메이션이 없어서다.
