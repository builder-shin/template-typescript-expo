import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/unit/**/*.test.ts'],
    /*
     * 러너의 타임존을 UTC 가 아닌 값으로 고정한다. 표시 타임존을 UTC 로 고정하는
     * 코드를 지키는 테스트가 러너 UTC(CI 의 ubuntu)에서는 아무것도 재지 못한다 -
     * "UTC 로 그린다" 와 "러너의 로컬 시각으로 그린다" 가 같은 세계가 되기 때문이다.
     * 원본 template-typescript-nextjs 의 vitest.config.ts 와 같은 판단이다.
     */
    env: { TZ: 'Asia/Seoul' },
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
})
