/**
 * E2E 전용 Simulator의 서비스/자원 관측 경계(D7 실측 K3, R33).
 * simslim의 서비스 분류를 참고하되 이 앱이 쓰는 Keychain·URL·키보드·네트워크는 남긴다.
 * https://github.com/MobAI-App/simslim/blob/main/profiles.go
 * host launchd는 바꾸지 않는다. 실제 등록된 label만 골라 simctl spawn 안에서 적용한다.
 */
const UNUSED_SERVICES = new Set(
  `
com.apple.apsd
com.apple.PosterBoard
com.apple.chronod
com.apple.liveactivitiesd
com.apple.assistantd
com.apple.assistant_cdmd
com.apple.assistant_service
com.apple.siriactionsd
com.apple.siriinferenced
com.apple.siriknowledged
com.apple.sirittsd
com.apple.siri.context.service
com.apple.corespeechd
com.apple.intelligenceplatformd
com.apple.intelligencecontextd
com.apple.intelligenceflowd
com.apple.intelligencetasksd
com.apple.generativeexperiencesd
com.apple.knowledgeconstructiond
com.apple.modelcatalogd
com.apple.modelmanagerd
com.apple.mlhostd
com.apple.mlruntimed
com.apple.suggestd
com.apple.parsecd
com.apple.parsec-fbf
com.apple.proactiveeventtrackerd
com.apple.searchd
com.apple.searchtoold
com.apple.spotlightknowledged
com.apple.spotlightknowledged.updater
com.apple.corespotlightservice
com.apple.cloudd
com.apple.cloudphotod
com.apple.ckdiscretionaryd
com.apple.cloudsettingssyncagent
com.apple.bird
com.apple.syncdefaultsd
com.apple.icloudmailagent
com.apple.icloudsubscriptionoptimizerd
com.apple.appstored
com.apple.appstorecomponentsd
com.apple.itunescloudd
com.apple.itunesstored
com.apple.storekitd
com.apple.amsaccountsd
com.apple.amsengagementd
com.apple.amsondevicestoraged
com.apple.videosubscriptionsd
com.apple.assetsubscriptiond
com.apple.musicd
com.apple.SafariBookmarksSyncAgent
com.apple.Safari.History
com.apple.WebBookmarks.webbookmarksd
com.apple.webkit.webpushd
com.apple.healthd
com.apple.healthappd
com.apple.healthcontentd
com.apple.healtheventsd
com.apple.healthrecordsd
com.apple.finhealthd
com.apple.homed
com.apple.homeeventsd
com.apple.fitcore
com.apple.fitcore.session
com.apple.fitnesscoachingd
com.apple.fitnessintelligenced
com.apple.activityawardsd
com.apple.activitysharingd
com.apple.photoanalysisd
com.apple.photosface
com.apple.mediaanalysisd
com.apple.mediaanalysisd.service
com.apple.mediastream.mstreamd
com.apple.medialibraryd
com.apple.assetsd
com.apple.assetsd.nebulad
com.apple.newsd
com.apple.weatherd
com.apple.jetpackassetd
com.apple.tipsd
com.apple.gamed
com.apple.gamesaved
com.apple.GameController.gamecontrollerd
com.apple.identityservicesd
com.apple.ids_simd
com.apple.ap.adprivacyd
com.apple.ap.promotedcontentd
com.apple.diagnosticextensionsd
com.apple.feedbackd
com.apple.rtcreportingd
com.apple.securityuploadd
com.apple.geoanalyticsd
com.apple.triald
com.apple.followupd
com.apple.devicecheckd
`
    .trim()
    .split(/\s+/),
)

/** launchctl list의 마지막 열은 label이다. 없는 서비스에 가짜 override를 만들지 않는다. */
export function simulatorServices(list: string): string[] {
  if (!/^PID\s+Status\s+Label$/m.test(list)) throw new Error('Simulator 서비스 목록 형식 오류')
  const labels = list.split('\n').flatMap((line) => {
    const match = /^\s*(?:\d+|-)\s+-?\d+\s+(\S+)\s*$/.exec(line)
    return match?.[1] === undefined ? [] : [match[1]]
  })
  for (const required of ['com.apple.apsd', 'com.apple.chronod']) {
    if (!labels.includes(required)) throw new Error(`Simulator 필수 관측 대상 없음: ${required}`)
  }
  return [...new Set(labels.filter((label) => UNUSED_SERVICES.has(label)))].sort()
}

/** launchctl의 두 출력 형식(true/disabled)을 읽고 재부팅 뒤 override 유실을 실패로 만든다. */
export function verifyDisabledServices(output: string, expected: readonly string[]): void {
  if (expected.length === 0) throw new Error('Simulator 비활성 서비스 목록이 비었다')
  const disabled = new Set<string>()
  for (const match of output.matchAll(/"([^"]+)"\s*=>\s*(?:true|disabled)\b/g)) {
    if (match[1] !== undefined) disabled.add(match[1])
  }
  for (const label of expected) {
    if (!disabled.has(label)) throw new Error(`Simulator 비활성 설정 미적용: ${label}`)
  }
}

/** RSS는 압축 메모리를 포함하지 않는다. 비교 로그에서도 phys_footprint로 이름 붙이지 않는다. */
export function simulatorMetrics(
  snapshot: string,
  udid: string,
): {
  processes: number
  rssKiB: number
  cpuPercent: number
} {
  const rows = snapshot.split('\n').flatMap((line) => {
    const match = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+([\d.]+)\s+(.+)$/.exec(line)
    if (match === null) return []
    return [
      {
        pid: Number(match[1]),
        parent: Number(match[2]),
        rss: Number(match[3]),
        cpu: Number(match[4]),
        command: match[5] ?? '',
      },
    ]
  })
  const roots = rows.filter(
    (row) =>
      row.command.includes('launchd_sim') &&
      row.command.includes(`${udid}/data/var/run/launchd_bootstrap`),
  )
  if (roots.length !== 1) throw new Error('선택한 simulator launchd_sim을 하나로 확인하지 못했다')
  const selected = new Set(roots.map((row) => row.pid))
  let count = 0
  while (count !== selected.size) {
    count = selected.size
    for (const row of rows) if (selected.has(row.parent)) selected.add(row.pid)
  }
  const own = rows.filter((row) => selected.has(row.pid))
  return {
    processes: own.length,
    rssKiB: own.reduce((sum, row) => sum + row.rss, 0),
    cpuPercent: own.reduce((sum, row) => sum + row.cpu, 0),
  }
}
