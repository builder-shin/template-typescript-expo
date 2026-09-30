import { realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * package.json 의 devDependencies 가 metro·metro-cache·metro-transform-worker 를 0.84.5 로 고정하는
 * 이유를 잰다 - pnpm-workspace.yaml 끝의 주석이 그 이유를 적는다.
 *
 * uniwind/metro 는 metro 의 Graph 프로토타입을 덮어쓰고 metro-cache 의 FileStore 를 상속한다
 * (docs/superpowers/notes/2026-09-30-d1-measurements.md 의 M1 절). 그 모듈이 Expo 의 번들러
 * (@expo/metro)가 쓰는 것과 **같은 인스턴스**여야 덮어쓰기가 번들에 닿는다. pnpm peers check 는
 * 버전 범위만 보고 이 동일성은 보지 않는다.
 */
const rootRequire = createRequire(resolve('package.json'))

function resolvedFrom(owner: string, dependency: string): string {
  const ownerRequire = createRequire(rootRequire.resolve(`${owner}/package.json`))
  return realpathSync(ownerRequire.resolve(`${dependency}/package.json`))
}

describe('Metro 고정', () => {
  it.each(['metro', 'metro-cache', 'metro-transform-worker'])(
    'uniwind 와 @expo/metro 가 같은 %s 를 쓴다',
    (dependency) => {
      expect(resolvedFrom('uniwind', dependency)).toBe(resolvedFrom('@expo/metro', dependency))
    },
  )
})
