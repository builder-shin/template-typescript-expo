import type { ConfigPlugin } from 'expo/config-plugins.js'
import { withMainActivity } from 'expo/config-plugins.js'

/**
 * Expo 의 Android splash exit listener 는 플랫폼의 2초 전송 제한 경로를 켠다. Android 16 에서 그 제한을
 * 넘기면 starting_reveal 이 남아 입력마다 5초씩 기다렸다(D7 실측 K3). 플랫폼 기본 exit 를 쓰되 Expo 의
 * splash 유지·hide 프리드로우 게이트는 보존한다. Android 의 400ms fade 를 포기하는 대가가 있다.
 */
export function patchMainActivitySplashExit(
  contents: string,
  platform: string,
  language: string,
): string {
  if (platform !== 'android') return contents
  if (language !== 'kt')
    throw new Error('Android splash 종료 수정: MainActivity 는 Kotlin 이어야 한다')

  const registrations = [
    ...contents.matchAll(
      /^([ \t]*)SplashScreenManager\.registerOnActivity\(this\)[ \t]*(?:\r?\n|$)(?:[ \t]*\/\/ @generated end expo-splashscreen[^\r\n]*\r?\n)?/gm,
    ),
  ]
  const onCreates = [
    ...contents.matchAll(/^[ \t]*super\.onCreate\((?:null|savedInstanceState)\)[ \t]*\r?$/gm),
  ]
  const registration = registrations[0]
  const onCreate = onCreates[0]
  const fail = () => {
    throw new Error(
      'Android splash 종료 수정: MainActivity.kt 의 registerOnActivity → super.onCreate 앵커를 확인한다(Expo 업그레이드 뒤 plugins/AGENTS.md 참고)',
    )
  }
  if (
    registrations.length !== 1 ||
    onCreates.length !== 1 ||
    registration === undefined ||
    onCreate === undefined
  )
    return fail()
  const insertion = registration.index + registration[0].length
  if (insertion > onCreate.index) return fail()
  const indent = registration[1] ?? ''
  const eol = contents.includes('\r\n') ? '\r\n' : '\n'
  const patch = [
    `${indent}// Android 16 splash 전송 시간 초과 뒤 남는 starting_reveal 을 막는다(D7 실측 K3).`,
    `${indent}if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {`,
    `${indent}  splashScreen.clearOnExitAnimationListener()`,
    `${indent}}`,
    '',
  ].join(eol)
  const clears = contents.match(/clearOnExitAnimationListener/g) ?? []
  if (clears.length !== 0) {
    if (clears.length !== 1 || !contents.slice(insertion, onCreate.index).includes(patch))
      return fail()
    return contents
  }
  return contents.slice(0, insertion) + patch + contents.slice(insertion)
}

const withAndroidSplashExit: ConfigPlugin = (config) =>
  withMainActivity(config, (mod) => {
    mod.modResults.contents = patchMainActivitySplashExit(
      mod.modResults.contents,
      mod.modRequest.platform,
      mod.modResults.language,
    )
    return mod
  })

export default withAndroidSplashExit
