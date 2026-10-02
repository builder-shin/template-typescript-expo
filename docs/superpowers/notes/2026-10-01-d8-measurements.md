# D8 실측 기록 - 문서군의 일치, Windows 게이트 전체, CI 의 마지막 실행 (2026-10-01)

스펙 17장의 완료 조건을 닫는 기록이다. 조건 2·3(CI 매트릭스·세 백엔드)이 처음 초록이 된 실행과 그때까지 고친 것은
`2026-10-01-d7-measurements.md` 의 K3 에 있다. 이 기록은 그 뒤 D8 의 변경(개발 클라이언트, 오류 경계의 다시 시도,
연결 판정, 문서군)을 얹은 마지막 상태를 적는다.

## G1 — Windows 개발 머신의 게이트 전체(13단계)

Task 3에서 최종 코드·문서를 대상으로 단독 실행한다. 실행 날짜·커밋, 13단계의 결과, APK 재빌드 여부와
Android 전체 플로 수·소요 시간을 그 실행 뒤 기록한다. Task 2의 정적 검증은 전체 게이트 통과 증거가 아니다.

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
`12afb8b237fc29cf559e5331052f7d00f27b49f2`에서 시작한 첫 iOS native cache 실행이다.
조회 시 전체 실행은 완료되지 않았다(`queued`, 진행 중인 E2E와 대기 중인 shard가 있다).
완료된 checks는 **2.25분**, build-android는 **11.23분**(APK 단계 **10.25분**),
build-ios는 **12.95분**(.app 단계 **11.18분**)이었다.
build-ios의 캐시 키 계산은 **6초**, 복원 단계는 **0초**, 저장 단계는 **17초**였다.
단계 시간 0초를 cache hit로 해석하지 않는다. 실행 미완료로 GitHub 잡 로그를 아직 받을 수 없어
native key·Xcode/SDK/architecture의 실제 출력·ccache hit/miss·최종 shard 대기와 E2E 결론은 확인하지 않았다.
이 부분 완료 수치를 물리 12잡 성공이나 전체 시간 절감으로 쓰지 않는다.
여기서 cold는 새 iOS native compile cache 기준이며 기존 pnpm·Gradle·CocoaPods·AVD 캐시를 모두 비운 뜻이 아니다.

CI는 APK를 x86_64만 빌드하며 로컬 미지정 빌드는 기존 네 ABI다. iOS는 백엔드마다 두 shard,
최대 다섯 동시 잡이고 현재 앱·JS 번들을 항상 다시 만든다. 같은 native fingerprint·락파일·레시피·
Xcode/SDK·architecture·ccache 판에서만 DerivedData/ccache를 복원한다.
범위는 세 백엔드 × Android/iOS, Android 23·iOS 21플로, 백엔드마다 계약 거울 94시험,
각 플랫폼 FastAPI request-stall, 재시도 0·기존 단언·timeout 그대로다. 논리 9칸의 성공에는 물리 12잡 모두가 필요하다.

**별도의 warm 측정 실행은 하지 않는다.** Task 3가 Task 1 뒤의 첫 실행과 같은 native key를 쓰는 최종 실행에서
warm 비교를 기록한다. 실행 A와 Task 1의 의존성 변경 뒤 실행은 key가 다를 수 있으므로 그 둘을 cold/warm 쌍으로
비교하지 않는다. Task 3는 실제 SHA·native key·toolchain·복원/저장·ccache 통계와 shard별 대기를 확인하고,
같은 key의 두 실행에서 잡 전체와 컴파일·캐시 비용을 나눠 실제 절감값을 계산한다.

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
