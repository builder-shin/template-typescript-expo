import { MutationObserver, QueryClient } from '@tanstack/react-query'
import { afterEach, describe, expect, it } from 'vitest'

import {
  applyCacheEffects,
  cacheEffects,
  mutationKeys,
  queryKeys,
  type CacheEffect,
  type CacheWrite,
} from '@/queries/keys'

/**
 * 캐시 키와 쓰기 뒤의 무효화 표(스펙 8.5). 표는 값으로 고정하고, 표가 캐시에 하는 일은 실제
 * QueryClient 로 잰다 - 키의 모양이 어긋나면(앞 조각이 다르면) 무효화가 아무것도 건드리지 않고도
 * 조용히 끝나기 때문이다.
 *
 * 자원 type 은 실전 값이 아니다(probe*).
 */
const TYPE = 'probeCrates'
const OTHER = 'probeBins'

describe('queryKeys', () => {
  it('목록 하나의 키는 그 자원의 목록 전부의 키로 시작한다', () => {
    expect(queryKeys.list(TYPE, 'probe=1').slice(0, 3)).toEqual([...queryKeys.lists(TYPE)])
  })

  it('목록과 상세는 자원 type 이 같아도 겹치지 않는다', () => {
    expect(queryKeys.detail(TYPE, 'list')).not.toEqual(queryKeys.lists(TYPE))
  })
})

describe('mutationKeys — 진행 중인 쓰기를 찾는 키', () => {
  const client = new QueryClient()

  afterEach(() => {
    client.clear()
  })

  it('진행 중인 수정은 그 id 의 키로만 찾힌다 - 앞 조각이 같은 다른 id·생성·삭제로는 찾히지 않는다', async () => {
    let finish: () => void = () => undefined
    const gate = new Promise<void>((resolve) => {
      finish = resolve
    })
    const running = new MutationObserver(client, {
      mutationKey: mutationKeys.update(TYPE, 'probe-1'),
      mutationFn: () => gate,
    }).mutate()

    expect(client.isMutating({ mutationKey: mutationKeys.update(TYPE, 'probe-1') })).toBe(1)
    expect(client.isMutating({ mutationKey: mutationKeys.update(TYPE, 'probe-10') })).toBe(0)
    expect(client.isMutating({ mutationKey: mutationKeys.delete(TYPE, 'probe-1') })).toBe(0)
    expect(client.isMutating({ mutationKey: mutationKeys.create(TYPE) })).toBe(0)
    finish()
    await running
  })
})

describe('cacheEffects — 스펙 8.5 의 표', () => {
  it.each<[string, CacheWrite, unknown]>([
    [
      '생성 → 목록 무효화',
      { kind: 'create', type: TYPE },
      [{ action: 'invalidate', queryKey: queryKeys.lists(TYPE) }],
    ],
    [
      '수정 → 상세 + 목록 무효화',
      { kind: 'update', type: TYPE, id: 'probe-1' },
      [
        { action: 'invalidate', queryKey: queryKeys.detail(TYPE, 'probe-1') },
        { action: 'invalidate', queryKey: queryKeys.lists(TYPE) },
      ],
    ],
    [
      '삭제 → 상세 제거 + 목록 무효화',
      { kind: 'delete', type: TYPE, id: 'probe-1' },
      [
        { action: 'remove', queryKey: queryKeys.detail(TYPE, 'probe-1') },
        { action: 'invalidate', queryKey: queryKeys.lists(TYPE) },
      ],
    ],
    ['로그아웃 → 캐시 전체 비움', { kind: 'logout' }, [{ action: 'removeAll' }]],
  ])('%s', (_label, write, expected) => {
    expect(cacheEffects(write)).toEqual(expected)
  })
})

describe('applyCacheEffects — 표를 실제 캐시에 옮긴다', () => {
  const client = new QueryClient()

  afterEach(() => {
    client.clear()
  })

  function seed(): void {
    client.setQueryData(queryKeys.list(TYPE, 'probe=a'), 'probe-list-a')
    client.setQueryData(queryKeys.list(TYPE, 'probe=b'), 'probe-list-b')
    client.setQueryData(queryKeys.list(OTHER, 'probe=a'), 'probe-other-list')
    client.setQueryData(queryKeys.detail(TYPE, 'probe-1'), 'probe-detail-1')
    client.setQueryData(queryKeys.detail(TYPE, 'probe-2'), 'probe-detail-2')
    client.setQueryData(queryKeys.detail(OTHER, 'probe-1'), 'probe-other-detail')
  }

  function invalidated(queryKey: readonly string[]): boolean | undefined {
    return client.getQueryCache().find({ queryKey, exact: true })?.state.isInvalidated
  }

  it('키가 조건·자원·상세를 가른다 - 서로의 캐시를 덮어쓰지 않는다', () => {
    seed()
    expect(client.getQueryData(queryKeys.list(TYPE, 'probe=a'))).toBe('probe-list-a')
    expect(client.getQueryData(queryKeys.list(TYPE, 'probe=b'))).toBe('probe-list-b')
    expect(client.getQueryData(queryKeys.list(OTHER, 'probe=a'))).toBe('probe-other-list')
    expect(client.getQueryData(queryKeys.detail(TYPE, 'probe-1'))).toBe('probe-detail-1')
    expect(client.getQueryData(queryKeys.detail(TYPE, 'probe-2'))).toBe('probe-detail-2')
    expect(client.getQueryData(queryKeys.detail(OTHER, 'probe-1'))).toBe('probe-other-detail')
  })

  it('생성은 그 자원의 목록만 무효화한다 - 다른 자원과 상세는 두고', () => {
    seed()
    applyCacheEffects(client, cacheEffects({ kind: 'create', type: TYPE }))
    expect(invalidated(queryKeys.list(TYPE, 'probe=a'))).toBe(true)
    expect(invalidated(queryKeys.list(TYPE, 'probe=b'))).toBe(true)
    expect(invalidated(queryKeys.list(OTHER, 'probe=a'))).toBe(false)
    expect(invalidated(queryKeys.detail(TYPE, 'probe-1'))).toBe(false)
  })

  it('수정은 그 상세와 목록을 무효화한다', () => {
    seed()
    applyCacheEffects(client, cacheEffects({ kind: 'update', type: TYPE, id: 'probe-1' }))
    expect(invalidated(queryKeys.detail(TYPE, 'probe-1'))).toBe(true)
    expect(invalidated(queryKeys.detail(TYPE, 'probe-2'))).toBe(false)
    expect(invalidated(queryKeys.list(TYPE, 'probe=a'))).toBe(true)
  })

  it('삭제는 그 상세를 지우고 목록을 무효화한다', () => {
    seed()
    applyCacheEffects(client, cacheEffects({ kind: 'delete', type: TYPE, id: 'probe-1' }))
    expect(client.getQueryData(queryKeys.detail(TYPE, 'probe-1'))).toBeUndefined()
    expect(client.getQueryData(queryKeys.detail(TYPE, 'probe-2'))).toBe('probe-detail-2')
    expect(invalidated(queryKeys.list(TYPE, 'probe=b'))).toBe(true)
  })

  it('로그아웃은 캐시를 전부 비운다', () => {
    seed()
    // 전부는 자원 캐시만이 아니다 - 자원 키 밖의 조회도 비운다.
    client.setQueryData(['probe-outside'], 'probe-outside-value')
    applyCacheEffects(client, cacheEffects({ kind: 'logout' }))
    expect(client.getQueryCache().getAll()).toEqual([])
  })

  it('로그아웃은 조회 캐시만 비운다 - 진행 중인 쓰기는 캐시에 남는다', () => {
    seed()
    // 이 효과는 로그아웃 쓰기 안에서 돈다(queries/auth.ts). useIsLoggingOut 이 그 쓰기를 진행 중으로 세므로
    // 쓰기 캐시까지 비우면(client.clear()) 폐기 요청이 끝나기 전에 진행 표시가 꺼진다.
    const write = new MutationObserver(client, {
      mutationKey: ['probe-write'],
      mutationFn: () => new Promise<never>(() => undefined),
    })
    void write.mutate()
    applyCacheEffects(client, cacheEffects({ kind: 'logout' }))
    expect(client.isMutating({ mutationKey: ['probe-write'] })).toBe(1)
  })

  it('모르는 효과는 캐시를 건드리지 않고 던진다 - 전체 비움으로 읽지 않는다', () => {
    seed()
    const before = client.getQueryCache().getAll().length
    const unknown = { action: 'probeUnknown' } as unknown as CacheEffect
    expect(() => {
      applyCacheEffects(client, [unknown])
    }).toThrow('probeUnknown')
    expect(client.getQueryCache().getAll()).toHaveLength(before)
  })
})
