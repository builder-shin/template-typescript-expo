# D8 실측 기록 - 문서군의 일치, Windows 게이트 전체, CI 의 마지막 실행 (2026-10-01)

스펙 17장의 완료 조건을 닫는 기록이다. 조건 2·3(CI 매트릭스·세 백엔드)이 처음 초록이 된 실행과 그때까지 고친 것은
`2026-10-01-d7-measurements.md` 의 K3 에 있다. 이 기록은 그 뒤 D8 의 변경(개발 클라이언트, 오류 경계의 다시 시도,
연결 판정, 문서군, CI의 x86_64 APK와 iOS 두 shard·컴파일 캐시 후보 철회)을 얹은 마지막 상태를 적는다.

## G1 — Windows 개발 머신의 게이트 전체(13단계)

**2026-10-02, Windows 전체 게이트 첫 실행 성공: [1]–[13] 모두 exit 0.** 검증한 커밋은
`ab0d1cc0544b15e83e73aad23bc0c1e2b666c169`(`ab0d1cc`, 당시 `feat/d8-t1`)이다.
Windows 11 Pro 10.0.26200, Node 24.19.0, pnpm 11.22.0, Docker Server 29.7.2, Maestro 2.11.0에서
FastAPI 스택과 새로 부팅한 `Pixel_9_API_36`(Android 16/API 36, x86_64)을 사용했다.
다른 시험·타입 검사·번들·Gradle·Maestro 작업이 없는 상태에서 시작했고 새 부팅의 uptime은 준비 확인 때 12.65초였다.

Git Bash 명령은 다음과 같다. stdout·stderr는 실행 로그로 보존했다.

```bash
export GIT_TERMINAL_PROMPT=0 GIT_PAGER=cat
E2E_AVD=Pixel_9_API_36 E2E_ANDROID_ABIS= E2E_CHECKS=1 timeout 7200 ./scripts/check.sh
```

UTC **2026-10-02T04:44:09.303046Z–2026-10-02T05:17:33.329689Z**, 총 **2004.027초(33분 24.027초)**,
gate exit 0이다. 단계 시간은 0.1초 간격으로 외부 관찰한 제목 경계 간 wall time으로, 출력 배치·조회 지연을 포함한다.
특히 [5]·[6]은 정밀 실행시간으로 해석하지 않는다.

| 단계            | 결과 / exit | 관찰 시간(초) | 확인한 것                                   |
| --------------- | ----------- | ------------: | ------------------------------------------- |
| [1] typecheck   | PASS / 0    |         7.146 | 라우트 생성, 앱·시험 타입 프로그램          |
| [2] lint        | PASS / 0    |        12.369 | ESLint                                      |
| [3] format      | PASS / 0    |         2.320 | format:check                                |
| [4] secretlint  | PASS / 0    |         0.709 | lint:secrets                                |
| [5] 인용        | PASS / 0    |        약 0.1 | 지정 여섯 디렉터리                          |
| [6] 복사 출처   | PASS / 0    |      0.1 미만 | 경로 54·이탈 42·원본 그대로 33              |
| [7] unit        | PASS / 0    |        15.394 | 101파일 / 1973시험, runner 14.75초          |
| [8] 설정        | PASS / 0    |         8.958 | 네 변형 × EAS 프로젝트 유무, 8평가          |
| [9] 의존성 호환 | PASS / 0    |         3.125 | expo-doctor 21/21                           |
| [10] 번들       | PASS / 0    |        21.998 | production Android·iOS, expo export --clear |
| [11] compose    | PASS / 0    |         0.529 | 세 프로파일 config                          |
| [12] 계약 거울  | PASS / 0    |        18.401 | FastAPI 2파일 / 94시험, runner 1.67초       |
| [13] E2E        | PASS / 0    |      1912.563 | 새 APK·Android 23플로·request-stall·정리    |

D8의 의존성·앱 코드 입력이 바뀌어 APK를 한 번 새로 빌드했다. 실제 빌드 디렉터리는 하네스의 47자 이하 조건을
충족했고, 기존 두 Gradle 호출은 모두 `--no-daemon`이며 각각 **58초·6분 23초**였다. Metro 캐시 비우기가 두 번
출력됐고 둘째 호출의 `:app:createReleaseUpdatesResources UP-TO-DATE`도 확인했다.
ZIP의 `lib/`에 **arm64-v8a·armeabi-v7a·x86·x86_64** 네 ABI가 있었다.
설치 전 앱 설정 `extra.appVariant=e2e`, OTA 끔, 매니페스트의 OTA URL·머리글 없음과 cleartext 허용 단언도 통과했다.

Android 정규 **23플로**를 각각 한 번 실행했다. 정규 플로 구간은 **1399.291초(23분 19.291초)**,
request-stall 포함은 **1445.041초(24분 5.041초)**였다. 생성·삭제 후 home/list 복귀와 쓰기·재조회 요청 수 단언도
통과했다. request-stall은 실제 서버의 headers와 body를 각각 멈춘 요청이 **15031ms·15017ms** 뒤
`REQUEST_TIMEOUT`으로 끝났고, Maestro의 실패 화면·스켈레톤·다시 시도 버튼 단언과 상태 0을 허용한 로그 가드가
모두 통과했다. 플로·단언·timeout·가드는 변경하지 않았으며 게이트 실패·환경 flake·재시도는 **0**이다.

게이트 전·compose 전후·계약 거울 후·E2E 후에 `joon-*` 실행 컨테이너는 **9개**였다.
우리 compose 프로젝트는 시작 전과 정리 후 실행 **0개**, 종료 후에는 중지 컨테이너까지 **0개**였고,
E2E 실행 중에만 3개였다. 하네스가 자기 스택·볼륨·멈춘 서버를 정리했으며 다른 프로젝트는 건드리지 않았다.

**전체 게이트 이후 최종 통합 상태의 차이.** `ab0d1cc`에서 `059e6ea`와 이 문서 정정을 포함한 상태로 넘어오면서
`69a7de4`의 iOS 컴파일 캐시 후보를 철회했다. 이는 iOS 설정·빌드와 CI에만 해당하며 Windows Android 앱·APK 입력은
바뀌지 않았다. ABI·shard의 실행 조건 시험을 보강하고 Android 하네스의 머리말·사용법, Bash 공통화의 인용·출처 설명,
README·계층 문서·실측·스펙을 정리했다. 앱 동작·Android 플로·계약 거울·단언·timeout은 그대로다.
캐시 시험 16개 제거와 ABI 음수 경로 시험 3개 추가로 현재 단위 총계는 **100파일 / 1960시험**이며,
위 전체 게이트의 **101파일 / 1973시험은 `ab0d1cc`의 결과**다.

최종 문서 정정을 포함한 작업 트리에서 **`./scripts/check.sh --static`을 다시 실행해 [1]–[11] 모두 exit 0**을
확인했다. 단위 **100파일 / 1960시험**, 문서군 **11/11**, 출처 **54/42/33**, 설정 **8평가**,
expo-doctor **21/21**, Android·iOS `expo export --clear`와 세 compose 프로파일도 통과했다.
이 정적 재검증은 위 전체 13단계 실행과 별개이며 [12]·[13]을 다시 실행한 결과로 쓰지 않는다.

## G2 — GitHub Actions 의 마지막 실행

Task 3의 최종 실행에서 논리 아홉 칸·물리 12잡의 결론과 소요 시간, 실행 주소·커밋 및 각 E2E 백엔드 커밋을 기록한다.
앞서 실패한 실행이 있으면 원인과 수정도 함께 적는다. Task 0의 측정 실행은 최종 코드 검증과 구분한다.

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
