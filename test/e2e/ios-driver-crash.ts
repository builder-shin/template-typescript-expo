import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// Maestro #3538만 가른다. 실패한 플로의 debug 디렉터리를 받으며, 복구해도 될 때만 exit 0이다.
// status-bar query의 XCTest 실패와 CLI의 unreachable이 모두 필요하다. 읽지 못하면 복구하지 않는다.
function failedStatusBarQuery(log: string): boolean {
  let querying = false
  for (const line of log.split('\n')) {
    if (line.includes('Fetch status bar hierarchy - start')) {
      querying = true
    } else if (/Tear Down|Fetch .* hierarchy - (?:start|duration)/.test(line)) {
      querying = false
    } else if (
      querying &&
      /: error: -\[maestro_driver_iosUITests\.maestro_driver_iosUITests testHttpServer\] : Failed to resolve query: Failed to resolve remote element/.test(
        line,
      ) &&
      line.includes('kAXErrorInvalidUIElement')
    ) {
      return true
    }
  }
  return false
}

function driverCrash(directory: string): boolean {
  let failedQuery = false
  let unreachable = false
  function visit(path: string): void {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const child = join(path, entry.name)
      if (entry.isDirectory()) visit(child)
      else if (entry.isFile() && /^(?:xctest_runner.*|device-xctest)\.log$/.test(entry.name)) {
        failedQuery = failedStatusBarQuery(readFileSync(child, 'utf8')) || failedQuery
      } else if (entry.isFile() && entry.name === 'maestro.log') {
        unreachable =
          /^(?:ios\.IOSDeviceErrors\$Unreachable|maestro\.DeviceUnreachableException): Device became unreachable\b/m.test(
            readFileSync(child, 'utf8'),
          ) || unreachable
      }
    }
  }
  visit(directory)
  return failedQuery && unreachable
}

try {
  const directory = process.argv[2]
  process.exitCode = directory !== undefined && driverCrash(directory) ? 0 : 1
} catch {
  process.exitCode = 1
}
