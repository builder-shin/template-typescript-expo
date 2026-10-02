# components/ui/ 작업 지침

React Native Reusables(shadcn/ui 의 React Native 이식판)에서 CLI 로 받은 복사본이다. 받는 명령과 lucide 아이콘의
깊은 import 규칙은 루트 `AGENTS.md` 의 "React Native Reusables 컴포넌트" 에 있다. 자원 이름·fetch·세션을 모른다.

| 파일           | 무엇                                           |
| -------------- | ---------------------------------------------- |
| `text.tsx`     | 글자와 글자 변형(제목·`large` 등)              |
| `button.tsx`   | 버튼                                           |
| `input.tsx`    | 입력 칸                                        |
| `badge.tsx`    | 배지 - 관계·상태 값                            |
| `skeleton.tsx` | 로딩 스켈레톤                                  |
| `icon.tsx`     | lucide 아이콘을 Uniwind 클래스로 그리는 감싸개 |

받은 파일을 고친 곳은 그 파일에 "원본과 다른 곳" 주석으로 남긴다. Uniwind 1.12.0 결함 때문에 미디어 쿼리로
컴파일되는 변형을 뺐고(`button.tsx`·`input.tsx`·`text.tsx`), 이 저장소의 타입 설정과 맞지 않는 prop 을 받지 않는다
(`input.tsx`·`skeleton.tsx`). 새로 받은 파일에서도 같은 변형을 빼야 `test/unit/ui/breakpoints.test.ts` 가 통과한다.
