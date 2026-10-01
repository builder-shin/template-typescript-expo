import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BASH_TIMEOUT_MS, resolveBash } from '../support/bash'

/**
 * 네이티브 백엔드(test/e2e/native-backend.sh - iOS 매트릭스가 Docker 없이 쓴다)가 compose 스택과 같은 백엔드를
 * 받는가. 두 길이 다른 저장소를 받으면 Android 와 iOS 매트릭스가 다른 백엔드를 재고도 같은 이름으로 초록이 된다.
 * 스크립트의 나머지(Homebrew·PostgreSQL·런타임)는 macOS 에서만 돌아 CI 의 e2e-ios 잡이 잰다.
 */

const SCRIPT = resolve('test/e2e/native-backend.sh')
const COMPOSE = readFileSync(resolve('docker-compose.e2e.yml'), 'utf8')
const BACKENDS = ['fastapi', 'nestjs', 'rails'] as const

/** Git Bash 는 역슬래시 경로를 이스케이프로 먹어 치운다. */
function toPosix(path: string): string {
  return path.split('\\').join('/')
}

const bash = resolveBash()

function run(kind: string, ...args: string[]) {
  return spawnSync(bash, [toPosix(SCRIPT), ...args], {
    encoding: 'utf8',
    env: { ...process.env, BACKEND_KIND: kind },
    timeout: BASH_TIMEOUT_MS,
  })
}

describe('test/e2e/native-backend.sh', () => {
  it.each(BACKENDS)('%s 는 docker-compose.e2e.yml 이 빌드하는 저장소의 main 을 받는다', (kind) => {
    const result = run(kind, 'repo-url')
    expect(result.status, result.stderr).toBe(0)
    const url = result.stdout.trim()
    expect(url).toMatch(/^https:\/\/github\.com\/builder-shin\/template-[a-z-]+\.git$/)
    expect(COMPOSE).toContain(`${url}#main`)
  })

  it('세 백엔드의 저장소가 서로 다르다', () => {
    const urls = BACKENDS.map((kind) => run(kind, 'repo-url').stdout.trim())
    expect(new Set(urls).size).toBe(BACKENDS.length)
  })

  it('모르는 하위 명령은 사용법과 함께 멈춘다', () => {
    const result = run('fastapi', 'probe-lab-unknown')
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('사용법')
  })
})
