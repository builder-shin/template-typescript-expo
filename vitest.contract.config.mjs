import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * 계약 거울(스펙 11.2)의 vitest 설정 - 실제 백엔드에 HTTP 로 건다. 단위 시험(vitest.config.mjs)과 따로 둔다:
 * 단위는 백엔드 없이 돌아야 하고, 이것은 스택이 떠 있어야 돈다. test/contract/run.sh 가 스택을 띄우고
 * `pnpm test:contract` 로 부른다.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/contract/**/*.test.ts'],
    // 요청 하나가 느린 스택을 만나도 기본값(5초)에 잘리지 않게 한다 - 가입·로그인이 든 준비 단계도 같다.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
})
