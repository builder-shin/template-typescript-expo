import type { QueryClient } from '@tanstack/react-query'

/**
 * Query 캐시의 키와 쓰기 뒤의 무효화 표 - 스펙 8.5. 순수 함수이고 단위 시험이 고정한다
 * (test/unit/queries/keys.test.ts). React 와 네트워크를 모른다 - `applyCacheEffects` 만
 * `QueryClient` 를 받아 표를 캐시에 옮긴다.
 *
 * 키는 `[RESOURCES_KEY, 자원 type, 'list' | 'detail', …]` 모양이다. 앞 조각이 같은 키를 한 번에
 * 무효화할 수 있게 자원 → 종류 → 조건 순서로 좁아진다.
 */
export const RESOURCES_KEY = 'resources'

export const queryKeys = {
  /** 자원 하나의 목록 전부 - 조건(백엔드 쿼리)마다 캐시가 하나씩이다. */
  lists: (type: string) => [RESOURCES_KEY, type, 'list'] as const,
  /** 목록 하나. `query` 는 첫 요청의 백엔드 쿼리 문자열이다(`listRequest`). */
  list: (type: string, query: string) => [RESOURCES_KEY, type, 'list', query] as const,
  /** 상세 하나. */
  detail: (type: string, id: string) => [RESOURCES_KEY, type, 'detail', id] as const,
}

/** 캐시를 바꾸는 쓰기 - 스펙 8.5 의 표의 행이다. 생성·수정·삭제의 호출부는 D4 가 만든다. */
export type CacheWrite =
  | { kind: 'create'; type: string }
  | { kind: 'update'; type: string; id: string }
  | { kind: 'delete'; type: string; id: string }
  | { kind: 'logout' }

/** 쓰기 하나가 캐시에 하는 일. `removeAll` 은 캐시 전체를 비운다. */
export type CacheEffect =
  | { action: 'invalidate'; queryKey: readonly string[] }
  | { action: 'remove'; queryKey: readonly string[] }
  | { action: 'removeAll' }

/**
 * 쓰기 → 캐시에 할 일(스펙 8.5 의 표 그대로).
 *
 * | 쓰기 | 무효화 |
 * | --- | --- |
 * | 생성 | 해당 자원 목록 |
 * | 수정 | 해당 상세 + 목록 |
 * | 삭제 | 해당 상세 제거 + 목록 |
 * | 로그아웃 | Query 캐시 전체 비움 |
 *
 * 무효화는 지금 보이는 조회를 다시 부르고, 제거는 없어진 자원의 상세를 캐시에서 지운다 - 삭제한
 * 자원의 상세를 무효화하면 404 를 다시 받으러 간다.
 */
export function cacheEffects(write: CacheWrite): readonly CacheEffect[] {
  switch (write.kind) {
    case 'create':
      return [{ action: 'invalidate', queryKey: queryKeys.lists(write.type) }]
    case 'update':
      return [
        { action: 'invalidate', queryKey: queryKeys.detail(write.type, write.id) },
        { action: 'invalidate', queryKey: queryKeys.lists(write.type) },
      ]
    case 'delete':
      return [
        { action: 'remove', queryKey: queryKeys.detail(write.type, write.id) },
        { action: 'invalidate', queryKey: queryKeys.lists(write.type) },
      ]
    case 'logout':
      return [{ action: 'removeAll' }]
  }
}

/**
 * 표의 일을 캐시에 옮긴다. 무효화는 기다리지 않는다 - 다시 부르는 것은 화면의 일이다.
 *
 * `removeAll` 은 조회 캐시만 비운다(`removeQueries`). `client.clear()` 로 바꾸지 않는다 - 이 효과는
 * 로그아웃 쓰기 안에서 돌고(queries/auth.ts), 쓰기 캐시까지 비우면 그 쓰기가 사라져 `useIsLoggingOut`
 * 이 폐기 요청이 끝나기 전에 거짓이 된다.
 */
export function applyCacheEffects(client: QueryClient, effects: readonly CacheEffect[]): void {
  for (const effect of effects) {
    if (effect.action === 'invalidate') {
      void client.invalidateQueries({ queryKey: effect.queryKey })
    } else if (effect.action === 'remove') {
      client.removeQueries({ queryKey: effect.queryKey, exact: true })
    } else if (effect.action === 'removeAll') {
      client.removeQueries()
    } else {
      // 효과를 CacheEffect 에 더하고 여기를 빠뜨리면 타입 오류다. 모르는 효과가 캐시 전체를 비우게 두지 않는다.
      throw new Error(`알 수 없는 캐시 효과다: ${JSON.stringify(effect satisfies never)}`)
    }
  }
}
