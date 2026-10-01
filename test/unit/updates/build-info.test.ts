import { describe, expect, it } from 'vitest'

import {
  buildInfoView,
  checkAndApplyUpdate,
  updateCheckView,
  type BuildInfo,
  type UpdatesApi,
} from '@/lib/updates/build-info'

// 실제 빌드의 값이 아니다 - 모양만 흉내 낸 표본이다.
const RUNTIME = 'probe0runtime0fingerprint'
const UPDATE_ID = '0f6b3c1e-2a4d-4e8f-9b1a-7c5d3e2f1a0b'

/** OTA 를 끈 Android 빌드(e2e·development)가 주는 값 - runtime version 과 채널이 빈 문자열이다. */
const OTA_OFF: BuildInfo = {
  appVersion: '0.1.0',
  variant: 'e2e',
  otaEnabled: false,
  runtimeVersion: '',
  channel: '',
  updateId: null,
  embeddedLaunch: false,
}

/** OTA 를 켠 preview 빌드를 설치하고 처음 띄운 값 - 내장 번들로 떴다. */
const PREVIEW_EMBEDDED: BuildInfo = {
  appVersion: '0.1.0',
  variant: 'preview',
  otaEnabled: true,
  runtimeVersion: RUNTIME,
  channel: 'preview',
  updateId: UPDATE_ID,
  embeddedLaunch: true,
}

function values(info: BuildInfo): Record<string, string> {
  return Object.fromEntries(buildInfoView(info).rows.map((row) => [row.key, row.value]))
}

describe('buildInfoView - 스펙 10.6', () => {
  it('행은 앱 버전·변형·OTA·runtime version·채널·업데이트 ID 순서다', () => {
    expect(buildInfoView(OTA_OFF).rows.map((row) => [row.key, row.label])).toEqual([
      ['version', '앱 버전'],
      ['variant', '변형'],
      ['ota', 'OTA'],
      ['runtime', 'runtime version'],
      ['channel', '채널'],
      ['update', '업데이트 ID'],
    ])
  })

  it('OTA 를 끈 빌드는 없는 값을 "없음" 으로 적고 확인 버튼을 두지 않는다', () => {
    expect(values(OTA_OFF)).toEqual({
      version: '0.1.0',
      variant: 'e2e',
      ota: '꺼짐',
      runtime: '없음',
      channel: '없음',
      update: '없음',
    })
    expect(buildInfoView(OTA_OFF).canCheck).toBe(false)
  })

  it('null 인 값도 "없음" 이다', () => {
    expect(
      values({ ...OTA_OFF, appVersion: null, runtimeVersion: null, channel: null }),
    ).toMatchObject({ version: '없음', runtime: '없음', channel: '없음' })
  })

  it('OTA 를 켠 빌드는 채널과 runtime version 을 적고 확인 버튼을 둔다 - 내장 번들이면 그렇다고 적는다', () => {
    expect(values(PREVIEW_EMBEDDED)).toEqual({
      version: '0.1.0',
      variant: 'preview',
      ota: '켜짐',
      runtime: RUNTIME,
      channel: 'preview',
      update: `${UPDATE_ID} (내장 번들)`,
    })
    expect(buildInfoView(PREVIEW_EMBEDDED).canCheck).toBe(true)
  })

  it('받은 업데이트로 떴으면 업데이트 ID 만 적는다', () => {
    expect(values({ ...PREVIEW_EMBEDDED, embeddedLaunch: false }).update).toBe(UPDATE_ID)
  })
})

/** 부른 순서를 적는 가짜 expo-updates. */
function fakeApi(options: {
  check?: { isAvailable: boolean; isRollBackToEmbedded: boolean } | Error
  fetch?: { isNew: boolean; isRollBackToEmbedded: boolean } | Error
  reload?: Error
}): { api: UpdatesApi; calls: string[] } {
  const calls: string[] = []
  const settle = <T>(value: T | Error): Promise<T> =>
    value instanceof Error ? Promise.reject(value) : Promise.resolve(value)
  return {
    calls,
    api: {
      checkForUpdateAsync: () => {
        calls.push('check')
        return settle(options.check ?? { isAvailable: false, isRollBackToEmbedded: false })
      },
      fetchUpdateAsync: () => {
        calls.push('fetch')
        return settle(options.fetch ?? { isNew: true, isRollBackToEmbedded: false })
      },
      reloadAsync: () => {
        calls.push('reload')
        return options.reload === undefined ? Promise.resolve() : Promise.reject(options.reload)
      },
    },
  }
}

describe('checkAndApplyUpdate - 받은 업데이트를 바로 적용한다(스펙 10.6)', () => {
  it('새 업데이트가 있으면 받아서 다시 켠다', async () => {
    const { api, calls } = fakeApi({ check: { isAvailable: true, isRollBackToEmbedded: false } })
    expect(await checkAndApplyUpdate(api)).toEqual({ kind: 'reloading' })
    expect(calls).toEqual(['check', 'fetch', 'reload'])
  })

  it('내장 번들로 되돌리라는 지시도 받아서 다시 켠다', async () => {
    const { api, calls } = fakeApi({
      check: { isAvailable: false, isRollBackToEmbedded: true },
      fetch: { isNew: false, isRollBackToEmbedded: true },
    })
    expect(await checkAndApplyUpdate(api)).toEqual({ kind: 'reloading' })
    expect(calls).toEqual(['check', 'fetch', 'reload'])
  })

  it('없으면 받지 않고 current 다', async () => {
    const { api, calls } = fakeApi({})
    expect(await checkAndApplyUpdate(api)).toEqual({ kind: 'current' })
    expect(calls).toEqual(['check'])
  })

  it('받았는데 새것이 아니면 다시 켜지 않는다', async () => {
    const { api, calls } = fakeApi({
      check: { isAvailable: true, isRollBackToEmbedded: false },
      fetch: { isNew: false, isRollBackToEmbedded: false },
    })
    expect(await checkAndApplyUpdate(api)).toEqual({ kind: 'current' })
    expect(calls).toEqual(['check', 'fetch'])
  })

  it.each([
    ['확인', { check: new Error('probe check failure') }, 'probe check failure', ['check']],
    [
      '받기',
      {
        check: { isAvailable: true, isRollBackToEmbedded: false },
        fetch: new Error('probe fetch failure'),
      },
      'probe fetch failure',
      ['check', 'fetch'],
    ],
    [
      '다시 켜기',
      {
        check: { isAvailable: true, isRollBackToEmbedded: false },
        reload: new Error('probe reload failure'),
      },
      'probe reload failure',
      ['check', 'fetch', 'reload'],
    ],
  ])('%s 가 거절되면 던지지 않고 그 문구로 실패한다', async (_label, options, message, order) => {
    const { api, calls } = fakeApi(options)
    expect(await checkAndApplyUpdate(api)).toEqual({ kind: 'failed', message })
    expect(calls).toEqual(order)
  })

  it('Error 가 아닌 거절도 문구로 바꾼다', async () => {
    const thrown: unknown = 'probe rejection'
    const api: UpdatesApi = {
      checkForUpdateAsync: () =>
        Promise.resolve().then(() => {
          throw thrown
        }),
      fetchUpdateAsync: () => Promise.resolve({ isNew: false, isRollBackToEmbedded: false }),
      reloadAsync: () => Promise.resolve(),
    }
    expect(await checkAndApplyUpdate(api)).toEqual({ kind: 'failed', message: 'probe rejection' })
  })
})

describe('updateCheckView - 로딩은 스피너만(스펙 8.7)', () => {
  it('누르기 전에는 문구가 없다', () => {
    expect(updateCheckView(false, undefined)).toEqual({ busy: false, message: null })
  })

  it('도는 동안과 다시 켜는 동안은 스피너만 그린다', () => {
    expect(updateCheckView(true, undefined)).toEqual({ busy: true, message: null })
    expect(updateCheckView(false, { kind: 'reloading' })).toEqual({ busy: true, message: null })
  })

  it('끝난 확인은 결과를 글로 적는다', () => {
    expect(updateCheckView(false, { kind: 'current' })).toEqual({
      busy: false,
      message: '새 업데이트가 없습니다.',
    })
    expect(updateCheckView(false, { kind: 'failed', message: 'probe failure' })).toEqual({
      busy: false,
      message: '업데이트를 확인하지 못했습니다. probe failure',
    })
  })
})
