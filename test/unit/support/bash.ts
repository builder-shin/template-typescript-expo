import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

/** 후보 확인과 하네스 시험의 셸 실행은 모두 30초 안에 끝나야 한다. */
export const BASH_TIMEOUT_MS = 30_000

/** Windows 의 PATH 에 있는 WSL bash 도 후보이므로 실제 실행에 성공하는 Git Bash 를 찾는다. */
export function resolveBash(): string {
  const programFiles = process.env.ProgramW6432 ?? process.env.ProgramFiles ?? 'C:\\Program Files'
  const candidates =
    process.platform === 'win32'
      ? [
          'bash',
          join(programFiles, 'Git', 'bin', 'bash.exe'),
          join(programFiles, 'Git', 'usr', 'bin', 'bash.exe'),
        ]
      : ['bash']
  for (const candidate of candidates) {
    const probe = spawnSync(candidate, ['-c', 'printf ok'], {
      encoding: 'utf8',
      timeout: BASH_TIMEOUT_MS,
    })
    if (probe.status === 0 && probe.stdout === 'ok') return candidate
  }
  throw new Error(`쓸 수 있는 bash 를 찾지 못했다 - 후보: ${candidates.join(' · ')}`)
}
