/**
 * 내비게이션 테마(Stack 헤더·화면 배경)의 색 - global.css 의 토큰을 sRGB 로 옮긴 값이다. React
 * Native 는 `oklch()` 를 읽지 못해서 토큰을 그대로 쓸 수 없다.
 *
 * `NAV_COLOR_TOKENS` 가 색마다 어느 토큰을 옮겼는지 적는다(`card` 는 헤더 배경, `notification`
 * 은 배지 색). global.css 의 토큰을 바꾸면 test/unit/ui/nav-colors.test.ts 가 이 표와 어긋난 곳을
 * 알린다. 이 파일은 import 가 없다 - 그 시험이 node 에서 읽는다.
 */
export const NAV_COLORS = {
  light: {
    background: '#ffffff',
    border: '#e5e5e5',
    card: '#ffffff',
    notification: '#e7000b',
    primary: '#171717',
    text: '#0a0a0a',
  },
  dark: {
    background: '#0a0a0a',
    border: '#ffffff1a',
    card: '#171717',
    notification: '#ff6467',
    primary: '#e5e5e5',
    text: '#fafafa',
  },
} as const

/** 내비게이션 색 → global.css 의 `--color-*` 토큰 이름. */
export const NAV_COLOR_TOKENS = {
  background: 'background',
  border: 'border',
  card: 'card',
  notification: 'destructive',
  primary: 'primary',
  text: 'foreground',
} as const
