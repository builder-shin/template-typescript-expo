/**
 * 한 번만 도는 이동 - 화면을 쌓는 누름(목록의 행·조건 바꾸기·"새로 만들기"·"수정")이 빠르게 두 번 눌리면 같은
 * 화면이 두 벌 쌓였다(D3 최종 검토 M8). 첫 부름이 잠그고, 잠긴 동안의 부름은 버린다.
 *
 * 잠금은 부른 쪽이 푼다 - 화면이면 그 화면이 다시 앞에 왔을 때다(components/app/navigate-once.ts). 시각으로 풀지
 * 않는다: 이동이 끝나는 시각은 기기마다 다르고, 이동한 화면이 앞에 있는 동안에는 누른 화면의 누름이 오지 않는다.
 * 쓰기의 제출은 이것이 아니라 쓰기 캐시가 막는다(queries/submit-once.ts).
 */
export interface Once {
  /** 잠기지 않았으면 잠그고 `action` 을 부른다 - 불렀으면 참. 잠겼으면 버리고 거짓. `action` 이 던지면 잠그지 않는다. */
  readonly run: (action: () => void) => boolean
  /** 잠금을 푼다. */
  readonly release: () => void
}

export function createOnce(): Once {
  let locked = false
  return {
    run: (action) => {
      if (locked) return false
      locked = true
      try {
        action()
      } catch (error) {
        locked = false
        throw error
      }
      return true
    },
    release: () => {
      locked = false
    },
  }
}
