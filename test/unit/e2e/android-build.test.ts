import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { BASH_TIMEOUT_MS, resolveBash } from '../support/bash'

/** 기기·Gradle 없이 둘째 실행만 가짜 gradlew 로 잰다 - D6 최종 리뷰 m8 의 기계 단언(결정 41). */
const SOURCE = readFileSync(resolve('test/e2e/android.sh'), 'utf8')
const WORK = mkdtempSync(join(tmpdir(), 'android-build-'))
const JVM = '-Dorg.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m'
afterAll(() => rmSync(WORK, { recursive: true, force: true }))

let scenes = 0
function assemble(output: string, exit = 0) {
  const block = /^assemble_release\(\) \{$[\s\S]*?^\}$/m.exec(SOURCE)?.[0]
  if (block === undefined) throw new Error('assemble_release 가 없다')
  const scene = join(WORK, String(++scenes))
  const android = join(scene, 'android')
  const temp = join(scene, 'tmp')
  mkdirSync(android, { recursive: true })
  mkdirSync(temp)
  const gradlew = join(android, 'gradlew')
  writeFileSync(
    gradlew,
    '#!/bin/sh\nprintf "%s\n" "$*" > args.txt\nprintf "%s\n" "$FAKE_OUTPUT"\nexit "$FAKE_EXIT"\n',
    'utf8',
  )
  chmodSync(gradlew, 0o755)
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    TMPDIR: temp.split('\\').join('/'),
    FAKE_OUTPUT: output,
    FAKE_EXIT: String(exit),
  }
  delete env.BASH_ENV
  const result = spawnSync(
    resolveBash(),
    [
      '-c',
      `set -euo pipefail\n${block}\nassemble_release "$1" "$2"`,
      'android-build',
      JVM,
      '-PreactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64',
    ],
    {
      cwd: scene,
      env,
      encoding: 'utf8',
      timeout: BASH_TIMEOUT_MS,
    },
  )
  expect(readdirSync(temp), '임시 Gradle 로그가 남았다').toEqual([])
  expect(readFileSync(join(android, 'args.txt'), 'utf8').trim()).toBe(
    `assembleRelease --no-daemon --console=plain ${JVM} -PreactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64`,
  )
  return result
}

describe('D6 두 단계 Android 빌드', () => {
  it('둘째 Gradle 이 UP-TO-DATE 를 찍으면 통과한다', () => {
    expect(
      assemble('> Task :app:createReleaseUpdatesResources UP-TO-DATE\nBUILD SUCCESSFUL').status,
    ).toBe(0)
  })
  it.each([
    '> Task :app:createReleaseUpdatesResources',
    'BUILD SUCCESSFUL',
    '> Task :app:createReleaseUpdatesResources FROM-CACHE',
  ])('다시 실행·누락·캐시 복구(%s)는 UP-TO-DATE 가 아니므로 멈춘다', (output) => {
    const result = assemble(output)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('UP-TO-DATE 가 아니다')
  })
  it('Gradle 의 실패 코드를 그대로 돌려준다 - tee 의 성공이 빌드 실패를 가리지 않는다', () => {
    const result = assemble('> Task :app:createReleaseUpdatesResources UP-TO-DATE', 17)
    expect(result.status).toBe(17)
  })
  it('실제 build 가 첫 Gradle·캐시 비우기·검사하는 둘째 Gradle·APK 단언 순서로 잇는다', () => {
    expect(SOURCE).toContain(
      "local gradle_jvm='-Dorg.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m'",
    )
    expect(SOURCE).toMatch(
      /gradlew :app:createReleaseUpdatesResources --no-daemon "\$gradle_jvm" "-PreactNativeArchitectures=\$abis"\)\s+clear_metro_cache\s+assemble_release "\$gradle_jvm" "-PreactNativeArchitectures=\$abis"\s+assert_apk_variant\s+assert_apk_ota_off/,
    )
  })
})
