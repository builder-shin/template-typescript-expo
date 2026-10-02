import { describe, expect, it } from 'vitest'
import { patchMainActivitySplashExit } from '@/plugins/with-android-splash-exit.ts'

const MAIN_ACTIVITY = `class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    // @generated begin expo-splashscreen
    SplashScreenManager.registerOnActivity(this)
    // @generated end expo-splashscreen
    super.onCreate(null)
  }
}`

describe('Android splash 종료 리스너 - D7 실측 K3', () => {
  it('등록 뒤·super 앞에 API 31 가드와 해제를 한 번 넣는다', () => {
    const result = patchMainActivitySplashExit(MAIN_ACTIVITY, 'android', 'kt')
    const registration = result.indexOf('SplashScreenManager.registerOnActivity(this)')
    const clear = result.indexOf('splashScreen.clearOnExitAnimationListener()')
    expect(clear).toBeGreaterThan(registration)
    expect(clear).toBeLessThan(result.indexOf('super.onCreate(null)'))
    expect(result).toContain(
      'if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S)',
    )
    expect(result.match(/clearOnExitAnimationListener/g)).toHaveLength(1)
  })

  it('두 번 적용해도 생성된 코드가 그대로다', () => {
    const once = patchMainActivitySplashExit(MAIN_ACTIVITY, 'android', 'kt')
    expect(patchMainActivitySplashExit(once, 'android', 'kt')).toBe(once)
  })

  it.each([
    MAIN_ACTIVITY.replace(
      'SplashScreenManager.registerOnActivity(this)',
      'changedRegistration(this)',
    ),
    MAIN_ACTIVITY.replace('super.onCreate(null)', 'changedOnCreate(null)'),
    MAIN_ACTIVITY.replace('super.onCreate(null)', 'super.onCreate(null)\n    super.onCreate(null)'),
    `${MAIN_ACTIVITY}\nSplashScreenManager.registerOnActivity(this)`,
    MAIN_ACTIVITY.replace(
      'super.onCreate(null)',
      'splashScreen.clearOnExitAnimationListener()\n    super.onCreate(null)',
    ),
  ])('앵커가 없거나 중복되거나 알 수 없는 해제가 있으면 멈춘다', (source) => {
    expect(() => patchMainActivitySplashExit(source, 'android', 'kt')).toThrowError(
      /MainActivity.*앵커/,
    )
  })

  it('Kotlin 이 아니면 조용히 빠지지 않고 멈춘다', () => {
    expect(() => patchMainActivitySplashExit(MAIN_ACTIVITY, 'android', 'java')).toThrowError(
      /Kotlin/,
    )
  })

  it('Android 밖의 소스는 해석하거나 고치지 않는다', () => {
    const ios = '@implementation AppDelegate'
    expect(patchMainActivitySplashExit(ios, 'ios', 'objc')).toBe(ios)
  })
})
