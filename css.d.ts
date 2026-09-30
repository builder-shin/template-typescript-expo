// global.css 부수 효과 import 의 타입. tsconfig.json 의 `types: ["expo/types"]` 가 expo/types 의 같은 `*.css`
// 선언을 이미 주므로 지금은 겹치는 무해한 중복이다 - git 이 무시하는 expo-env.d.ts 도 필요 없다.
declare module '*.css'
