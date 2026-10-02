# D8 실측 기록 - 문서군의 일치, Windows 게이트 전체, CI 의 마지막 실행 (2026-10-01)

스펙 17장의 완료 조건을 닫는 기록이다. 조건 2·3(CI 매트릭스·세 백엔드)이 처음 초록이 된 실행과 그때까지 고친 것은
`2026-10-01-d7-measurements.md` 의 K3 에 있다. 이 기록은 그 뒤 D8 의 변경(개발 클라이언트, 오류 경계의 다시 시도,
연결 판정, 문서군, CI의 x86_64 APK - 측정 뒤 철회한 iOS 컴파일 캐시·두 shard 후보, README 의 EAS 안내 정정,
Maestro iOS 드라이버 결함의 복구)을 얹은 마지막 상태를 적는다.

## G1 — Windows 개발 머신의 게이트 전체(13단계)

**2026-10-02, 마지막 코드의 Windows 전체 게이트: [1]–[13] 모두 통과, gate exit 0.** 검증한 커밋은
`f05c9d3399ce97812a158145bda608393deb16ea`(`f05c9d3` - 이 브랜치의 마지막 비문서 커밋, G2 의 실행 D 와 같은 커밋)이다.
Windows 11 Pro 10.0.26200, Node 24.19.0, pnpm 11.22.0, Docker Server 29.7.2, Maestro 2.11.0 에서 FastAPI 스택과
`Pixel_9_API_36`(Android 16/API 36, x86_64)을 썼다. 시작 상태: 다른 시험·번들·Gradle·Maestro 작업이 없었고,
이 저장소의 AVD 를 끈 뒤 adb 서버를 손으로 다시 띄우고 `E2E_AVD=Pixel_9_API_36 ./test/e2e/android.sh boot` 로 새로
부팅했다(확인 때 uptime 12.74초). 자동 adb 복구 · 플로 재시도는 없다.

```bash
export GIT_TERMINAL_PROMPT=0 GIT_PAGER=cat
E2E_AVD=Pixel_9_API_36 E2E_ANDROID_ABIS= E2E_CHECKS=1 timeout 7200 ./scripts/check.sh
```

UTC **2026-10-02T08:46:43Z–09:11:04Z**, **24분 21초**. 단계마다의 결과(게이트 로그의 `grep` 줄):

| 단계            | 결과                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------- |
| [1]–[6]         | typecheck · lint · format · secretlint · 인용 · 복사 출처(경로 54 · 이탈 42 · 원본 33) 통과 |
| [7] unit        | `Test Files  101 passed (101)` · `Tests  1974 passed (1974)`                                |
| [8] 설정        | `변형 설정 통과` 여덟(네 변형 × EAS 프로젝트 유무, 위반 0)                                  |
| [9] 의존성 호환 | `21/21 checks passed`                                                                       |
| [10] 번들       | production Android · iOS `expo export --clear`                                              |
| [11] compose    | 세 프로파일 config                                                                          |
| [12] 계약 거울  | FastAPI `Test Files  2 passed (2)` · `Tests  94 passed (94)`                                |
| [13] E2E        | `=== E2E 통과 - 플로 23개 ===` · request-stall                                              |

[13] 은 `빌드 입력이 지난번과 같다 - APK 를 다시 만들지 않는다` 로 APK 를 다시 쓰고 설치했다. 그 APK 는 바로 앞의 전체
게이트(`838d1c7`, 아래)가 같은 기계에서 06:20Z 에 만든 것이다 - 그 뒤의 커밋은 README · 문서 · iOS 하네스 · 시험만 바꿔
하네스의 재사용 지문(의존성 · 앱 코드 · 설정)이 같다. 그 빌드의 확인(네 로컬 ABI, 둘째 Gradle 의
`:app:createReleaseUpdatesResources UP-TO-DATE`, e2e APK 의 앱 설정 · OTA 끔 · cleartext 단언)은 아래 "앞선 실행" 에 있다.
Android 정규 23플로를 각각 한 번 돌았고 요청 수 단언(examples-create 회전 1 · POST 1 · 로그인 1, examples-delete 목록
GET 2, examples-edit 회전 4 · PATCH 4, examples-scroll-refresh 상세 뒤 목록 GET 2)도 통과했다. request-stall 은 실제
서버가 머리글과 본문을 멈춘 두 요청이 각각 `elapsed=15020` · `elapsed=15021`(상태 0) 뒤 `REQUEST_TIMEOUT` 으로 끝나고
실패 화면 · 스켈레톤 · 다시 시도 단언과 로그 가드를 통과했다. 플로 · 단언 · timeout · 가드는 바꾸지 않았고 실패 · 환경
flake · 재시도는 **0** 이다. `joon-*` 실행 컨테이너는 시작 전과 끝난 뒤 **9개**, 우리 compose 프로젝트
(`template-typescript-expo-e2e`)는 시작 전과 정리 뒤 **0개**였다.

**앞선 실행.** (1) `838d1c7`(iOS shard 철회 뒤, README EAS 정정과 iOS 드라이버 복구 전) - 같은 명령, 같은 시작 상태(uptime
25.70초), UTC 2026-10-02T06:13:22Z–06:45:39Z(32분 17초), [1]–[13] 통과, 단위 99파일 / 1947시험, 계약 거울 94,
Android 23플로와 request-stall(`elapsed=15012` 두 번). 앞선 APK 이후 의존성(`expo-dev-client`)과 앱 코드 · 설정이 바뀌어
APK 를 새로 만들었다 - `Metro 캐시를 비웠다` 두 번, 첫 Gradle `BUILD SUCCESSFUL in 32s`, 둘째의 정확한
`> Task :app:createReleaseUpdatesResources UP-TO-DATE` 뒤 `BUILD SUCCESSFUL in 4m 55s`, ZIP 의 `lib/` 에
arm64-v8a · armeabi-v7a · x86 · x86_64, 설치 전 `APK 의 앱 설정: extra.appVariant=e2e` 와 `APK 의 OTA:
updates={"enabled":false} runtimeVersion=undefined · AndroidManifest.xml ENABLED=false URL=- HEADERS=-
usesCleartextTraffic=true` - 개발 클라이언트가 e2e APK 의 OTA · cleartext 설정을 바꾸지 않는다. joon 9 · compose 0.
(2) 통합 전의 로컬 사본(Task 2 시점, 이 브랜치로 cherry-pick 된 원본이라 공개 이력에 없다)에서도 13/13 이 통과했다
(04:44:09Z–05:17:33Z, 33분 24초, 단위 101파일 / 1973시험 - 철회 전 캐시 코드 포함). 조건 1 의 증거는 마지막 코드인
`f05c9d3` 의 실행이다(계획 결정 23).

## G2 — GitHub Actions 의 마지막 실행

이 브랜치의 실행은 넷이다(계획의 상한 넷 - 결정 20). 세 백엔드의 main 커밋은 네 실행 모두 같았다 -
FastAPI `3c4eee3`, NestJS `92cc2b1`, Rails `231576e`(Android·iOS 잡이 같은 커밋을 받았다).

| 실행 | 커밋 | 결론 | 빨간 칸 | 원인 | 고친 것 |
| --- | --- | --- | --- | --- | --- |
| [36963954302](https://github.com/builder-shin/template-typescript-expo/actions/runs/36963954302) A | `12afb8b` (Task 0) | success | - | - | 측정 실행(G4). iOS 컴파일 캐시가 아무것도 담지 못해 `69a7de4` 로 철회 |
| [36968699911](https://github.com/builder-shin/template-typescript-expo/actions/runs/36968699911) B | `059e6ea` (Task 0–2 통합) | failure | e2e-ios (rails, shard 2/2) - `examples-write-errors` | Maestro iOS 드라이버 종료(아래) | 이 실행에서는 고치지 않았다(환경으로 판정). shard 는 비용 판단으로 `838d1c7` 에서 따로 철회했다 |
| [36973426164](https://github.com/builder-shin/template-typescript-expo/actions/runs/36973426164) C | `838d1c7` (shard 철회) | failure | e2e-ios (nestjs) - `cold-links` | 같은 드라이버 종료 | `f05c9d3` - iOS 하네스가 이 결함의 흔적일 때만 그 플로를 한 번 다시 돈다(아래) |
| [36986123148](https://github.com/builder-shin/template-typescript-expo/actions/runs/36986123148) D | `f05c9d3` (README EAS 정정 + iOS 드라이버 복구) | success | - | nestjs iOS 의 `logout-from-protected` 첫 시도가 같은 드라이버 종료로 끝났고 하네스가 한 번 복구했다 | - |

**B·C 의 빨간 칸 - Maestro 2.11.0 iOS 드라이버의 결함([maestro#3538](https://github.com/mobile-dev-inc/maestro/issues/3538)).**
두 칸 모두 앱의 단언은 그 자리까지 전부 통과했고(B: 로그인 화면으로 돌아온 뒤 `email-input` 을 누르는 순간, C: 앱을
멈추고 딥링크로 새로 띄운 직후), 드라이버의 XCTest 로그가 같았다 - `Fetch status bar hierarchy - start` 뒤
`testHttpServer] : Failed to resolve query: Failed to resolve remote element AX element pid: … kAXErrorInvalidUIElement`
로 테스트가 끝나 드라이버의 HTTP 서버가 내려가고 Maestro 가 `Device became unreachable` 로 플로를 끝냈다.
AX 오류의 pid 는 두 번 모두 키보드를 띄우는 `InputUI` 였다(시뮬레이터 로그의 `InputUI[28451]` · `InputUI[10706]`).
드라이버는 매 화면 조회마다 SpringBoard 의 상태 표시줄 트리를 훑는데, 그 트리가 닿는 `InputUI` 의 원격 키보드 창이
훑는 도중 걷히면 XCTest 가 실패를 기록하고 `try?` 로 잡히지 않아 드라이버 전체가 내려간다(상류 보고와 같다).
Mac(iOS 26.5)에서 같은 플로를 돌려 확인했다: 키보드가 사라진 뒤 `InputUI` 는 약 4.2–4.6초 뒤에 창을 걷었고, 그 순간의
상태 표시줄 조회에서 같은 `kAXErrorInvalidUIElement` 가 났다(그 회차는 드라이버가 넘겼다 - 치명적인 것은 캐시된 요소를
다시 푸는 갈래뿐이다). 화면 없는 시뮬레이터에서 소프트웨어 키보드를 끄는 설정 네 가지(`AutomaticMinimizationEnabled`
두 자리, CoreSimulator 의 하드웨어 키보드 연결, `HardwareKeyboardLastSeen`)는 모두 키보드 창을 없애지 못했다.
그래서 iOS 하네스가 이 결함의 정확한 흔적일 때만 그 플로를 한 번 새로 돈다(`f05c9d3`, `test/e2e/ios-driver-crash.ts` - 스펙 16장 정정). 앱 단언의 실패는
다시 돌지 않는다.

**마지막 실행 D.** [36986123148](https://github.com/builder-shin/template-typescript-expo/actions/runs/36986123148) - 커밋 `f05c9d3`, 2026-10-02T08:48:14Z 생성, 09:55:58Z 끝(67.7분).
논리 아홉 칸 = 물리 아홉 잡이 모두 success 다.

| 잡                       | 시작 → 끝(UTC)      |    분 |
| ------------------------ | ------------------- | ----: |
| checks (게이트 [1]–[11]) | 08:48:20 → 08:51:05 |  2.75 |
| build-android (e2e APK)  | 08:48:18 → 08:57:33 |  9.25 |
| build-ios (e2e .app)     | 08:48:24 → 09:03:25 | 15.02 |
| e2e-android (fastapi)    | 08:57:36 → 09:28:23 | 30.78 |
| e2e-android (nestjs)     | 08:57:36 → 09:26:30 | 28.90 |
| e2e-android (rails)      | 08:57:36 → 09:28:38 | 31.03 |
| e2e-ios (fastapi)        | 09:03:35 → 09:53:08 | 49.55 |
| e2e-ios (nestjs)         | 09:03:36 → 09:55:57 | 52.35 |
| e2e-ios (rails)          | 09:03:35 → 09:50:56 | 47.35 |

checks 의 단위 1974시험, Android 세 잡의 계약 거울 각 94시험과 `=== E2E 통과 - 플로 23개 ===`, iOS 세 잡의
`=== E2E(iOS, <백엔드>) 통과 - 플로 21개 ===` 가 나왔고 request-stall 은 Android · iOS 모두 fastapi 잡에서 돌았다.
세 iOS 잡은 build-ios 가 끝난 직후(09:03:35–36) macOS 슬롯 대기 없이 시작했다. iOS 하네스의 드라이버 복구는 nestjs 잡에서
1회였다 - `logout-from-protected` 의 첫 시도가 같은 #3538 흔적으로 끝나 새 계정으로 처음부터 다시 돌아 통과했고, 첫 기록은
그 잡의 아티팩트에 `logout-from-protected-driver-crash` 로 남았다. fastapi · rails 는 0회다. 이 실행은 이 계획의 바뀐 것 -
개발 클라이언트가 든 두 앱, 루트 오류 경계와 연결 판정이 든 번들, x86_64 e2e APK, D7 배치로 되돌린 iOS 세 잡과 그 복구 - 를
모두 지났다.

## G4 — CI 최적화 전후

**2026-10-02 조회한 측정 기준.** D7 실행 5
[36941340879](https://github.com/builder-shin/template-typescript-expo/actions/runs/36941340879)는
`4d2d099c5fe8eeb6f8fcb3d2abe05b910f10d614`에서 failure였고, 통합 실행
[36950704982](https://github.com/builder-shin/template-typescript-expo/actions/runs/36950704982)는
`53e31343f1826bfdff70bae1e6e4719f5aaa6df3`에서 물리 9잡 모두 success였다.
실행 5의 iOS 실패 원인은 D7 K3에 있으며 실패 잡의 긴 시간을 순수 최적화 절감으로 계산하지 않는다.
통합 실행도 최종 Redis 소유권 수정 전의 코드다.

아래 값은 GitHub `gh run view --json jobs`의 `startedAt`·`completedAt` 차이다.
칸은 **잡 전체 / 주요 단계(분)**와 결론이며, 주요 단계는 checks의 정적 게이트, 빌드의 APK·.app, E2E의 E2E 단계다.
준비·정리·아티팩트 비용은 잡 전체에 포함되고 러너 배정 대기는 별도다.

| 잡 | D7 실행 5 전체 / 단계(분) | D7 통합 전체 / 단계(분) |
| --- | --- | --- |
| checks | 2.47 / 2.03 (success) | 2.30 / 1.67 (success) |
| build-android | 25.97 / 25.43 (success) | 26.62 / 25.98 (success) |
| build-ios | 17.50 / 15.20 (success) | 15.72 / 14.28 (success) |
| e2e-android (fastapi) | 29.68 / 28.12 (success) | 28.55 / 26.25 (success) |
| e2e-android (nestjs) | 30.50 / 28.37 (success) | 31.50 / 29.30 (success) |
| e2e-android (rails) | 31.32 / 27.82 (success) | 32.92 / 29.58 (success) |
| e2e-ios (fastapi) | 66.32 / 64.58 (failure) | 41.57 / 40.22 (success) |
| e2e-ios (nestjs) | 60.93 / 58.68 (failure) | 45.50 / 43.75 (success) |
| e2e-ios (rails) | 53.58 / 51.78 (failure) | 40.13 / 38.80 (success) |

통합 실행의 플로 시작 간격으로 계산한 iOS shard 1/2 합계는 FastAPI **21.29/10.91분**,
NestJS **24.63/12.25분**, Rails **20.80/10.62분**이다. 플로 준비 비용과 실제 여섯 잡의 대기는 이 값에 없다.
이 측정을 바탕으로 긴 16개·짧은 5개를 고정했으며 `scripts/e2e-flow-shards.mjs`가 무중복 합집합을 검사한다.

**Task 0 측정 실행 A.**
[36963954302](https://github.com/builder-shin/template-typescript-expo/actions/runs/36963954302)는
`12afb8b237fc29cf559e5331052f7d00f27b49f2`의 ABI·iOS shard와 컴파일 캐시 후보를 측정한 실행이다.
전체 실행은 **completed/success, 물리12잡 모두 success**로 완료됐다(04:18:08Z–05:17:57Z, 마지막 잡 기준59.82분).
완료된 checks는 **2.25분**, build-android는 **11.23분**(APK 단계 **10.25분**),
build-ios는 **12.95분**(.app 단계 **11.18분**)이었다.
build-ios의 캐시 키 계산은 **6초**, 복원 단계는 **0초**, 저장 단계는 **17초**였다.
APK 단계는 기준 25.98분보다 **15.73분 짧았다(60.55%)**. 이 한 실행의 관찰값이며 러너와 기존 Gradle 캐시의 영향을
분리한 인과 추정은 아니다. 기준·실행 A 모두 기존 pnpm·Gradle·CocoaPods·AVD 캐시를 강제로 비우지 않았다.
원본 로그와 여섯 manifest를 맞대 Android는 백엔드마다23플로·계약94시험, iOS는16+5플로의 무중복 합집합21개를
확인했다. request-stall은 Android FastAPI와 iOS FastAPI shard1에서 각 한 번 통과했다.

| 실행 A 물리 잡 | 전체(분) | 주요 단계(분) | iOS 배정 대기(분) |
| --- | ---: | ---: | ---: |
| checks | 2.25 | 1.73 | - |
| build-android | 11.23 | 10.25 | - |
| build-ios | 12.95 | 11.18 | - |
| e2e-android fastapi | 31.85 | 28.68 | - |
| e2e-android nestjs | 31.50 | 27.87 | - |
| e2e-android rails | 30.63 | 26.40 | - |
| e2e-ios fastapi shard1 | 30.78 | 29.47 | 0.22 |
| e2e-ios fastapi shard2 | 22.10 | 20.83 | 5.53 |
| e2e-ios nestjs shard1 | 34.50 | 33.32 | 0.13 |
| e2e-ios nestjs shard2 | 21.18 | 19.85 | 3.73 |
| e2e-ios rails shard1 | 34.33 | 33.20 | 10.58 |
| e2e-ios rails shard2 | 21.68 | 20.42 | 25.05 |

iOS 배정 대기는 build-ios 완료부터 각 잡의 Set up job 시작까지다.
[D7 main 실행36960944908](https://github.com/builder-shin/template-typescript-expo/actions/runs/36960944908)의 iOS 세 잡이
같은 macOS 슬롯을 사용했고 NestJS04:34:50Z·Rails04:36:36Z·FastAPI04:41:42Z에 끝났다. 바로 뒤에 실행 A의
NestJS shard2 04:34:58Z·FastAPI shard2 04:36:45Z·Rails shard1 04:41:49Z가 시작했다.
마지막 Rails shard2는 NestJS shard2가 끝난04:56:09Z 뒤04:56:17Z에 Set up job을 시작했다.
include의 긴 shard 우선 순서가 배정 순서를 보장하지 않는다는 사실도 확인됐다.

iOS 잡 자체는 기준40.13–45.50분에서 shard1 30.78–34.50분, shard2 21.18–22.10분으로 짧아졌다.
하지만 실제 iOS 전체 꼬리는 build-ios 완료 뒤 **46.72분**이었다. 준비 반복과 여섯 잡의 배정 대기가 포함된 값이며
이 실행에서 shard만의 전체 시간 절감을 분리해 확정하지 않는다. runner-minutes 합계는 기준264.80분에서
**285.00분**으로20.20분 늘었다(정리·아티팩트 포함, 배정 대기 제외). 짧은 잡이 전체 러너 비용 감소를 뜻하지 않는다.
생성부터 마지막 잡 완료까지는 기준62.10분·실행 A59.82분으로 **2.28분 짧았다**. 러너·기존 캐시·동시 실행의
영향이 섞인 한 쌍의 관찰이며 APK 단계의15.73분 감소를 전체 실행의 절감으로 바꾸지 않는다.

백엔드별 iOS 두 shard가 받은 main SHA는 같았다. FastAPI `3c4eee39a2f3b69f594b7d610b0a7a423433fbe0`,
NestJS `92cc2b1f5c5914d5d24b1688ab84468528dce95b`, Rails `231576eeac21c583b2cc28532248223351f2c92f`다.
실행 A는 Task 0 head의 범위·시간 증거이며 Task 1·2가 통합된 코드의 최종 CI 증거는 G2에서 별도로 닫는다.

실행 A 당시 CI는 APK를 x86_64만 빌드하며 로컬 미지정 빌드는 기존 네 ABI다. iOS는 백엔드마다 두 shard,
최대 다섯 동시 잡이다. 앱은 플랫폼마다 한 번 빌드해 백엔드별 잡에 전달한다.
범위는 세 백엔드 × Android/iOS, Android 23·iOS 21플로, 백엔드마다 계약 거울 94시험,
각 플랫폼 FastAPI request-stall, 재시도 0·기존 단언·timeout 그대로다. 논리 9칸의 성공에는 물리 12잡 모두가 필요하다.

**정정(2026-10-02, 컴파일 캐시 후보 철회).** 실행 A의 빌드 artifact에서 Xcode26.6 build17F113·SDK26.5·arm64·
ccache4.14와 키 `dab4a7336810f764b9e9a912306ff8f3350fd71e09d1e2cda1ab904119bd4ca6`을 확인했다.
복원은 miss, archive 저장은 17초·661,632,577바이트였지만 지정 ccache의 통계는 크기0만 보여 cacheable 호출·miss를
입증하지 못했다. archive는 DerivedData도 포함하므로 이 크기는 ccache 컴파일 결과의 크기가 아니다.
실제 RN wrapper 호출512개 중511개가 `-fmodules` Clang 컴파일, 나머지1개는 linker였다.
[ccache4.14의 구현](https://github.com/ccache/ccache/blob/v4.14/src/ccache/argprocessing.cpp)은 Clang modules에
direct·depend mode와 `sloppiness=modules`를 요구한다. 모듈 내부 상태 변화를 놓칠 수 있는 설정은 허용하지 않으며
fresh VM의 DerivedData-only 절감도 입증하지 못했다. 따라서 `69a7de4`에서 후보 커밋 전체를 되돌렸고 캐시 절감은
**0으로 기록한다**. 설치·복원·저장 비용과 캐시 키 스크립트도 제거했다.
**warm 비교는 더 이상 계획하지 않는다.** 후속 CI는 캐시 실험이 아닌 통합 코드의 전체 범위 검증이다.
Xcode compilation caching 또는 C_COMPILER_LAUNCHER는 실제 실행으로 효과와 정확성을 잰 뒤 재검토할 후보다.

**정정(2026-10-02, iOS shard 철회).** 비용과 실제 대기를 포함한 이득이 확정되지 않아 계획의 규칙대로 후보 커밋
`1cce6bd`만 되돌렸다. iOS는 세 백엔드가 각각 전체 21플로를 한 잡에서 돌고 fastapi request-stall도 그대로다.
물리 잡은 checks 1·빌드 2·Android 3·iOS 3의 **아홉 개**이며 논리 아홉 칸과 같다. CI의 x86_64 APK와 로컬 네 ABI,
계약 거울94개·Android23플로·iOS21플로·기존 단언·timeout·재시도0은 유지한다. 위 두 shard·물리12잡 서술과 수치는
실행 A 당시의 측정 이력이며 철회 뒤 CI 구조의 설명이 아니다.

다섯 macOS 슬롯에 여섯 shard 잡을 넣을 때 실행 A의 긴 잡 약 **34.50분**, 짧은 잡 **21.18·21.68분**을 사용한
경합 없는 꼬리 추정은 최선 **42.86분**(D7 기준45.50분 대비 **−2.64분**), 긴 잡이 마지막으로 밀리는 최악
**55.68분**(**+10.18분**)이다. include 순서는 배정 순서를 보장하지 않으며 작은 이득은 D7의39–44분 변동폭 안이다.
macOS 사용 시간은 build-ios와 iOS E2E를 합쳐 실행당 **142.92→177.52분**, **+34.60분(약24%)**이다.
비공개 저장소에서는 macOS 시간을10배로 계산한다(스펙13장). 비용은 늘고 전체 시간 이득이 입증되지 않아 철회했다.

실행 A의 마지막 Android 잡은 생성 뒤 **43.20분**, 마지막 iOS는 **59.82분**이었다. ABI·shard 뒤에는 Android가
전체 벽시계를 묶는다는 앞선 비용 판단의 전제는 실측과 반대였다. **전체 시간을 묶은 것은 iOS 경로**다.
캐시 철회 자체는 정확성 근거로 여전히 타당하다. 다음 지렛대는 iOS의 **Xcode compilation caching** 또는
**C_COMPILER_LAUNCHER와 explicit modules**이며, 실제 효과·정확성을 후속 측정으로 입증한 뒤 적용 여부를 정한다.

## G3 — 문서군의 일치(게이트 [7])

`test/unit/docs/doc-set.test.ts`를 README와 새 계층 문서 작성 전에 처음 실행했다.
저장소 검사 다섯과 검사기 자체의 시험 여섯 중 **4 failed / 7 passed (11), exit 1**이었다.

```text
스펙 14장이 이름을 댄 문서가 있다:
  README.md
  app/AGENTS.md
README 와 AGENTS.md 가 인용한 경로가 있다:
  .github/workflows/AGENTS.md:29: `./x.sh`
  platform/AGENTS.md:55: `ios-log.ts`
  test/e2e/AGENTS.md:27: `flows.test.ts`
AGENTS.md 가 자기 디렉터리의 바로 아래 항목을 전부 부른다:
  AGENTS.md: assets/
  test/e2e/AGENTS.md: ios-simulator.sh
환경 변수 표:
  ENOENT: README.md
Test Files  1 failed (1)
Tests  4 failed | 7 passed (11)
```

고친 것:

- `README.md`와 계층 문서 11개를 추가했다. 환경 변수 표는 `.env.example`의 세 변수와 코드 기본값을 맞췄다.
- `.github/workflows/AGENTS.md`의 예시 `./x.sh`를 실제 `./scripts/check.sh`로 바꿨다.
- `platform/AGENTS.md`의 짧은 `ios-log.ts`를 `test/e2e/ios-log.ts`로,
  `test/e2e/AGENTS.md`의 `flows.test.ts`를 `test/unit/e2e/flows.test.ts`로 바꿨다.
- 루트 `AGENTS.md`의 탐색 표에 `assets/`를 포함한 모든 최상위 디렉터리를 적었다.
- `test/e2e/AGENTS.md`에 source 전용 `ios-simulator.sh`(100644)와 Windows 단독·새 부팅 규칙을 적었다.
- `platform/AGENTS.md`에 진단·이벤트·HTTP 로그가 e2e 전용 `logsHttpFailures`를 공유하는 사실과 시험을 적었다.
- 루트의 Expo Router 설명은 `.tsx`·`.ts` 확장자만 읽으므로 문서는 라우트가 아니라는 현재 사실로 고쳤다.
- README의 compose 예시는 하네스와 같은 명시적 프로젝트 `template-typescript-expo-e2e`를 쓴다.
  D7의 Xcode 26.6 고정·scene opt-in·전용 simulator 설정·Redis 소유권·현재 드리프트 0건을 반영했다.
- D6의 `lib/updates/AGENTS.md`는 기존 규칙·검증 설명을 보존했다. Task 0의 두 새 스크립트와
  Task 1의 `online.ts`·`error-boundary.ts`는 실제 파일과 문서 설명이 이미 있었다.

`EXTERNAL`은 문서별 예외를 처음 제시된 그대로 유지한다. 루트 `components/hooks/`는 소유 계약만 있는 빈 자리,
`lib/jsonapi/AGENTS.md`의 `app/jsonapi/`·`proxy.ts`·`app/error.tsx`와
`lib/lab/AGENTS.md`의 `app/(lab)/contract/`·`actions.ts`·`page.tsx`·`result-view.tsx`는 원본/백엔드 저장소,
`.github/workflows/AGENTS.md`의 `action.yml`은 각 액션 저장소,
`test/e2e/AGENTS.md`의 `assets/app.config`는 APK 내부 경로다. 저장소 파일을 예외에 넣지 않았다.

**최종 검증(2026-10-02, Windows·Git Bash).** 문서 시험은 **11 passed (11), exit 0**이다.
`./scripts/check.sh --static`은 [1]–[11] 모두 통과했으며 단위 총계는 **101파일 / 1973시험**이다
(Task 1의 100파일 / 1962시험에서 문서 시험 1파일·11개 추가).
설정 8평가·expo-doctor 21/21·Android/iOS `expo export --clear`·compose config도 통과했다.
복사 출처는 경로 54·이탈 42·원본 그대로 33을 유지하고 `KNOWN_DIVERGENCES`는 0건이다.
낡은 미래형 문장 검색은 결과가 없었고 문서의 인용 검사도 통과했다.

변경 마크다운은 저장소의 Prettier 규칙으로 정렬했다. `docs/` 산문은 기존 무시 규칙대로 서식을 보존했다.
그 무시 패턴이 `test/unit/docs/`까지 가려 새 시험은 `.gitignore`를 ignore-path로 지정해 별도로 정렬했고,
서식만 바꾼 뒤 문서 시험 11개가 다시 통과했다. 기기·계약 거울·전체 CI의 최종 검증은 G1·G2와 Task 3의 범위다.

**정정(2026-10-02, 캐시 철회 후 통합 검증).** 캐시 기능과 해당16시험을 제거하고 ABI 음수 경로3시험을 보강한 뒤
Task 1·2를 통합한 상태는 정적 게이트 [1]–[11] 전부 통과, **100파일 / 1960시험**이었다. 문서군 시험은 계속11개다.
복사 출처54·이탈42·원본 그대로33, 네 변형×EAS 유무의 설정8평가, doctor·export --clear·compose config도 통과했다.
README와 scripts 문서의 철회된 캐시 계약을 제거하고 G4에 그 근거와 warm 비교 철회를 기록했다.

**정정(2026-10-02, 문서 리뷰 반영).** 라우트 확장자는 설치본의 규칙에 따라 `.ts`·`.tsx`·`.js`·`.jsx`로 바로잡았다.
README의 실행 권한 명령은 `scripts/`·`test/e2e/`·`test/contract/`의 실행 진입점10개와 source helper1개를 모두 보여 준다.
실험실 코드 삭제 후 시험·출처·계층 문서의 정리와 iOS 두 플로·오류 경계 초기화의 기기 검증 한계도 명시했다.
Prettier 무시 패턴은 `/docs/`로 고정해 `test/unit/docs/`를 정적 게이트의 format 검사에 포함했다.
문서 시험은 README·환경 예시의 변수 이름과 기본값, 코드의 `APP_VARIANT` 기본값을 비교하며 코드에서 모든 환경 변수
이름을 수집하지 않는다는 검사 범위를 제목·주석에 적었다. 시험 수는11개다.

**정정(2026-10-02, shard 철회와 문서 검사 보강).** 철회한 shard 스크립트·시험과 CI shard 단언을 제거하고
문서의 최상위 경로 오타·삭제된 경로를 잡는 회귀 시험을 더했다. 문서군은 **12시험**, 단위 총계는 **99파일 / 1947시험**이다.
알 수 없는 첫 경로 조각을 모두 건너뛰던 규칙을 생성 디렉터리·설치본/기기 번들·외부 import 이름의 명시 목록으로
한정했다. 같은 이름의 추적된 항목은 제외하지 않으며, 게이트 번호와 로그 표식은 경로가 아닌 구문으로 구분한다.
`qeuries/keys.ts`와 삭제된 `queries/keys.ts`의 인용을 잡는 새 시험이 수정 전 실패·수정 후 통과했다.
README·스펙의 환경 변수 검사 설명도 실제 범위로 맞췄다. G1·G2의 최종 전체 실행 기록은 별도로 확정한다.
