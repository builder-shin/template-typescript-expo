import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AppVariant } from '@/lib/config/app-variant'
import { readBuildInfo, updatesApi } from '@/platform/updates'

/**
 * platform/updates.ts 의 배선(스펙 10.6). 행·확인의 순서·문구의 판단은 test/unit/updates/build-info.test.ts 가 재고,
 * 여기서는 expo-updates·expo-constants 의 값을 빌드 정보로 **옮기는지**와 세 호출을 그대로 넘기는지를 잰다 - 옮기는
 * 자리가 바뀌면(예: 업데이트 ID 와 runtime version 이 엇갈리면) 판단의 시험은 모두 통과하고 카드만 틀린다. OTA 를
 * 켠 빌드의 값은 계정이 필요한 실증(스펙 15장 9단계) 전에는 기기에서 볼 길이 없어 여기서 잰다.
 *
 * 기기 모듈(expo-updates·expo-constants)과 설정 자리(platform/config.ts)는 가짜로 바꾼다.
 */
/** 시험마다 바꿔 끼우는 expo-updates 의 상수. */
interface UpdatesConstants {
  isEnabled: boolean
  runtimeVersion: string | null
  channel: string | null
  updateId: string | null
  isEmbeddedLaunch: boolean
}

/** 시험마다 바꿔 끼우는 expo-constants 의 값. */
interface ConstantsModule {
  expoConfig: { version?: string } | null
}

const ENABLED: UpdatesConstants = {
  isEnabled: true,
  runtimeVersion: 'probe-runtime',
  channel: 'probe-channel',
  updateId: 'probe-update',
  isEmbeddedLaunch: false,
}

const mocks = vi.hoisted(() => {
  const values: UpdatesConstants = {
    isEnabled: true,
    runtimeVersion: null,
    channel: null,
    updateId: null,
    isEmbeddedLaunch: false,
  }
  const constants: ConstantsModule = { expoConfig: null }
  return {
    updates: {
      ...values,
      checkForUpdateAsync:
        vi.fn<() => Promise<{ isAvailable: boolean; isRollBackToEmbedded: boolean }>>(),
      fetchUpdateAsync: vi.fn<() => Promise<{ isNew: boolean; isRollBackToEmbedded: boolean }>>(),
      reloadAsync: vi.fn<() => Promise<void>>(),
    },
    constants,
    startupVariant: vi.fn<() => AppVariant>(),
  }
})

vi.mock('expo-updates', () => mocks.updates)
vi.mock('expo-constants', () => ({ default: mocks.constants }))
vi.mock('@/platform/config', () => ({ startupVariant: mocks.startupVariant }))

beforeEach(() => {
  Object.assign(mocks.updates, ENABLED)
  mocks.constants.expoConfig = { version: '9.8.7' }
  mocks.startupVariant.mockReset().mockReturnValue('preview')
})

describe('readBuildInfo - expo-updates·expo-constants 의 값을 옮긴다', () => {
  it('자리마다 제 값을 옮긴다', () => {
    expect(readBuildInfo()).toEqual({
      appVersion: '9.8.7',
      variant: 'preview',
      otaEnabled: true,
      runtimeVersion: 'probe-runtime',
      channel: 'probe-channel',
      updateId: 'probe-update',
      embeddedLaunch: false,
    })
  })

  it('내장 번들로 떴는가와 OTA 여부를 옮긴다', () => {
    Object.assign(mocks.updates, { isEnabled: false, isEmbeddedLaunch: true })
    expect(readBuildInfo()).toMatchObject({ otaEnabled: false, embeddedLaunch: true })
  })

  it('앱 설정이 없으면 앱 버전은 null 이다', () => {
    mocks.constants.expoConfig = null
    expect(readBuildInfo().appVersion).toBeNull()
  })
})

describe('updatesApi - expo-updates 의 세 호출을 그대로 넘긴다', () => {
  it('확인·받기·다시 켜기가 expo-updates 의 함수를 부른다', async () => {
    // 확인·받기 결과 모두 두 칸의 값을 다르게 둔다 - 같으면 칸을 맞바꿔 넘기는 배선이 드러나지 않는다.
    mocks.updates.checkForUpdateAsync.mockResolvedValue({
      isAvailable: true,
      isRollBackToEmbedded: false,
    })
    mocks.updates.fetchUpdateAsync.mockResolvedValue({ isNew: true, isRollBackToEmbedded: false })
    mocks.updates.reloadAsync.mockResolvedValue(undefined)

    expect(await updatesApi.checkForUpdateAsync()).toEqual({
      isAvailable: true,
      isRollBackToEmbedded: false,
    })
    expect(await updatesApi.fetchUpdateAsync()).toEqual({
      isNew: true,
      isRollBackToEmbedded: false,
    })
    await updatesApi.reloadAsync()
    expect(mocks.updates.checkForUpdateAsync).toHaveBeenCalledTimes(1)
    expect(mocks.updates.fetchUpdateAsync).toHaveBeenCalledTimes(1)
    expect(mocks.updates.reloadAsync).toHaveBeenCalledTimes(1)
  })
})
