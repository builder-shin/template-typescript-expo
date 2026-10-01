import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Maestro 플로가 두 플랫폼에서 도는가 - 같은 플로를 Android(run-android.sh)와 iOS(run-ios.sh)가 돈다(스펙 13장).
 *
 * Maestro 2.11.0 의 iOS 드라이버는 `back`·`pressKey: back` 을 아무것도 하지 않는다(IOSDriver 의 backPress 가 빈
 * 구현이고 pressKey 는 delete·return·home·lock 만 안다). `setAirplaneMode` 도 경고만 남긴다. 그런 명령은 조용히
 * 지나가 플로가 엉뚱한 화면에서 단언하게 만든다 - 그래서 규칙을 소스에서 잰다.
 *
 * - 뒤로 가기는 `subflows/back.yaml`(한 화면 뒤로 - iOS 는 머리글의 뒤로 버튼)과 `subflows/android-back.yaml`
 *   (Android 에만 있는 하드웨어 뒤로 가기)에만 있다.
 * - 기기 상태를 바꾸는 Android 전용 명령(비행기 모드)은 머리말 `# e2e-platforms: android` 인 플로에만 있다.
 * - 로캘 플로(`# e2e-app-locale:`)는 `clearState` 를 쓰지 않고, launchApp 이 `AppleLanguages` 를 실행 인자로 싣는다
 *   - iOS 하네스가 넘기는 `APP_LOCALE` 이다(Android 는 그 인자를 쓰지 않는다).
 * - 상태를 지우고 시작하는 서브플로는 키체인도 비운다 - iOS 키체인의 세션은 clearState(앱 다시 설치)로 지워지지
 *   않는다(스펙 7.5 의 D2 정정). Android 에서 clearKeychain 은 아무것도 하지 않는다.
 */

const E2E_DIR = resolve('test/e2e')
const DIRS = ['flows', 'subflows', 'checks'] as const
const BACK_SUBFLOWS = ['subflows/back.yaml', 'subflows/android-back.yaml'] as const
const PLATFORMS = ['android', 'ios'] as const

interface Flow {
  readonly path: string
  readonly source: string
}

function flows(): Flow[] {
  return DIRS.flatMap((dir) =>
    readdirSync(join(E2E_DIR, dir))
      .filter((name) => name.endsWith('.yaml'))
      .map((name) => ({
        path: `${dir}/${name}`,
        source: readFileSync(join(E2E_DIR, dir, name), 'utf8'),
      })),
  )
}

function header(source: string, key: string): string | null {
  const match = new RegExp(`^# ${key}: *(.*)$`, 'm').exec(source)
  return match === null ? null : (match[1] ?? '').trim()
}

/** 주석을 뺀 명령 줄에서 찾는다 - 머리말·설명 주석의 명령 이름은 세지 않는다. */
function commands(source: string): string {
  return source
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith('#'))
    .join('\n')
}

const BACK_COMMAND = /^\s*-\s*(?:back|pressKey:\s*back)\s*$/im
const AIRPLANE_COMMAND = /^\s*-?\s*(?:setAirplaneMode|toggleAirplaneMode)\b/m

describe('Maestro 플로의 두 플랫폼 규칙', () => {
  const all = flows()

  it('훑는 플로가 있다 - 없으면 아래 규칙이 헛돈다', () => {
    expect(all.filter((flow) => flow.path.startsWith('flows/')).length).toBeGreaterThan(10)
    expect(all.map((flow) => flow.path)).toEqual(expect.arrayContaining([...BACK_SUBFLOWS]))
  })

  it('뒤로 가기는 두 서브플로에만 있다 - 플로는 그 서브플로를 부른다', () => {
    const offenders = all
      .filter((flow) => !(BACK_SUBFLOWS as readonly string[]).includes(flow.path))
      .filter((flow) => BACK_COMMAND.test(commands(flow.source)))
      .map((flow) => flow.path)
    expect(offenders).toEqual([])
  })

  it('두 서브플로의 뒤로 가기는 Android 갈래 안에 있고, 한 화면 뒤로는 iOS 에서 머리글의 뒤로 버튼을 누른다', () => {
    for (const path of BACK_SUBFLOWS) {
      const source = commands(all.find((flow) => flow.path === path)?.source ?? '')
      expect(source, path).toMatch(/platform: Android\s*\n\s*commands:\s*\n\s*-\s*back\s*$/m)
    }
    const back = commands(all.find((flow) => flow.path === 'subflows/back.yaml')?.source ?? '')
    expect(back).toMatch(/platform: iOS\s*\n\s*commands:\s*\n\s*-\s*tapOn:\s*\n\s*id: BackButton/m)
  })

  it('머리말 e2e-platforms 는 android·ios 가운데서 고른다', () => {
    for (const flow of all) {
      const platforms = header(flow.source, 'e2e-platforms')
      if (platforms === null) continue
      const names = platforms.split(/\s+/).filter((name) => name !== '')
      expect(names.length, flow.path).toBeGreaterThan(0)
      for (const name of names) expect(PLATFORMS, flow.path).toContain(name)
    }
  })

  it('비행기 모드를 바꾸는 플로는 iOS 에서 돌지 않는다고 선언한다', () => {
    for (const flow of all) {
      if (!AIRPLANE_COMMAND.test(commands(flow.source))) continue
      const platforms = header(flow.source, 'e2e-platforms') ?? ''
      expect(platforms.split(/\s+/), flow.path).not.toContain('ios')
      expect(platforms, flow.path).not.toBe('')
    }
  })

  it('로캘 플로는 clearState 를 쓰지 않고 AppleLanguages 를 실행 인자로 싣는다', () => {
    const locales = all.filter((flow) => header(flow.source, 'e2e-app-locale') !== null)
    expect(locales.length).toBeGreaterThan(0)
    for (const flow of locales) {
      const body = commands(flow.source)
      expect(body, flow.path).not.toMatch(/clearState/)
      expect(body, flow.path).toMatch(
        /-\s*launchApp:\s*\n\s*arguments:\s*\n\s*AppleLanguages: '\(\$\{APP_LOCALE\}\)'/,
      )
    }
  })

  it('상태를 지우고 시작하는 서브플로는 키체인도 비운다', () => {
    const source = commands(
      all.find((flow) => flow.path === 'subflows/start-signed-out.yaml')?.source ?? '',
    )
    expect(source).toMatch(/-\s*launchApp:\s*\n\s*clearState: true\s*\n\s*clearKeychain: true/)
  })

  it('hideKeyboard 를 쓰지 않는다 - Android 에서는 뒤로 가기다', () => {
    const offenders = all
      .filter((flow) => /\bhideKeyboard\b/.test(commands(flow.source)))
      .map((flow) => flow.path)
    expect(offenders).toEqual([])
  })

  it('iOS Charlie 태그는 정확히 두 멤버의 두 순열만 받는다', () => {
    const source = all.find((flow) => flow.path === 'flows/examples-browse.yaml')?.source ?? ''
    const pattern = /text: '([^'\n]*probe-seed charlie[^'\n]*)'/.exec(source)?.[1]
    expect(pattern).toBeDefined()
    const matcher = new RegExp(pattern ?? '(?!)')
    const prefix =
      'probe-seed charlie, 상태, 보관, 점수, 0, 생성, 2026-04-05 05:06, 분류, 프로브 분류 둘, 태그, '
    for (const tags of ['프로브 라벨 하나, 프로브 라벨 둘', '프로브 라벨 둘, 프로브 라벨 하나']) {
      expect(matcher.test(prefix + tags), tags).toBe(true)
    }
    for (const tags of [
      '프로브 라벨 하나',
      '프로브 라벨 둘',
      '프로브 라벨 하나, 프로브 라벨 하나',
      '프로브 라벨 둘, 프로브 라벨 둘',
      '프로브 라벨 하나, 프로브 라벨 둘, 세 번째',
    ]) {
      expect(matcher.test(prefix + tags), tags).toBe(false)
    }
    expect(pattern).not.toContain('.*')
    expect(matcher.test('다른 행 ' + prefix + '프로브 라벨 하나, 프로브 라벨 둘')).toBe(false)
  })

  it('모든 openLink 뒤에 iOS 시스템 확인창 처리를 잇는다', () => {
    let links = 0
    for (const flow of all) {
      const lines = commands(flow.source)
        .split('\n')
        .filter((line) => line.trim() !== '')
      for (const [index, line] of lines.entries()) {
        if (!/^\s*- openLink:/.test(line)) continue
        links += 1
        expect(lines[index + 1]?.trim(), `${flow.path}:${index}`).toBe(
          '- runFlow: ../subflows/confirm-ios-open-link.yaml',
        )
      }
    }
    expect(links).toBeGreaterThan(20)
  })

  it('native Open 텍스트 누름은 iOS 의 정확한 시스템 창 안에서만 허용한다', () => {
    const path = 'subflows/confirm-ios-open-link.yaml'
    const source = commands(all.find((flow) => flow.path === path)?.source ?? '')
    expect(source).toMatch(/when:\s*\n\s*platform: iOS\s*\n\s*visible:/)
    expect(source).toContain(String.raw`visible: '^Open in “Template Expo \(E2E\)”\?$'`)
    expect(source).toMatch(/- tapOn:\s*\n\s*text: 'Open'/)
    expect(source).toContain(String.raw`- assertNotVisible: '^Open in “Template Expo \(E2E\)”\?$'`)
    for (const flow of all.filter((entry) => entry.path !== path)) {
      const body = commands(flow.source)
      // 데이터 행은 id 와 text 를 함께 쓴다. text 하나로 누르는 시스템 예외는 위 파일뿐이다.
      expect(body, flow.path).not.toMatch(/- tapOn:\s*\n\s*text:/)
      expect(body, flow.path).not.toMatch(/- tapOn:[ \t]*[^\s\n]/)
    }
  })
})
