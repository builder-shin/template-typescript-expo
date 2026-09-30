import Constants from 'expo-constants'
import { getLocales } from 'expo-localization'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { ScrollView, View } from 'react-native'

import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { request } from '@/lib/jsonapi/client'

/**
 * D1 실측 전용 화면(M2·M3·M4·M6). 실측 기록을 남긴 뒤 다음 커밋에서 지운다 - 결과는
 * docs/superpowers/notes/2026-09-30-d1-measurements.md 에 있다. 계층 규칙(app/ 은
 * fetch·request 를 부르지 않는다)을 일부러 어긴다 - 이 화면은 제품이 아니라 계측기다.
 */
const BLACKHOLE_URL = 'http://10.0.2.2:4199/'
const PROBE_ABORT_MS = 2_000

async function probeAbort(): Promise<string> {
  const controller = new AbortController()
  const started = Date.now()
  const timer = setTimeout(() => {
    controller.abort()
  }, PROBE_ABORT_MS)
  try {
    await fetch(BLACKHOLE_URL, { signal: controller.signal })
    return `resolved ${Date.now() - started}ms`
  } catch (error) {
    return `${error instanceof Error ? error.name : 'unknown'} ${Date.now() - started}ms`
  } finally {
    clearTimeout(timer)
  }
}

async function probeHealth(): Promise<string> {
  const result = await request('/health/ready')
  return result.ok ? `ok ${result.status}` : `fail ${result.status} ${result.errors[0]?.code ?? ''}`
}

export default function ProbeScreen() {
  const params = useLocalSearchParams()
  const [health, setHealth] = useState('')
  const [abort, setAbort] = useState('')
  const locales = getLocales()
    .map((locale) => locale.languageTag)
    .join(',')

  return (
    <ScrollView>
      <View className="gap-3 p-4">
        <Text testID="probe-params">{JSON.stringify(params)}</Text>
        <Button
          testID="probe-set-params"
          onPress={() => {
            router.setParams({ 'filter[status]': 'archived', 'filter[title][contains]': 'a b' })
          }}
        >
          <Text>setParams</Text>
        </Button>
        <Text testID="probe-locales">{locales}</Text>
        <Text testID="probe-extra">{JSON.stringify(Constants.expoConfig?.extra ?? null)}</Text>
        <Button
          testID="probe-health"
          onPress={() => {
            void probeHealth().then(setHealth)
          }}
        >
          <Text>health</Text>
        </Button>
        <Text testID="probe-health-result">{health}</Text>
        <Button
          testID="probe-abort"
          onPress={() => {
            void probeAbort().then(setAbort)
          }}
        >
          <Text>abort</Text>
        </Button>
        <Text testID="probe-abort-result">{abort}</Text>
      </View>
    </ScrollView>
  )
}
