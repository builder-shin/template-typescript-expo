# .github/workflows/ 작업 지침

`ci.yml` 하나가 스펙 13장의 CI 다. 모든 브랜치의 push 와 pull request 에서 돌고, `docs/` 만 바꾼 커밋은 돌지 않는다.
같은 브랜치의 앞 실행은 새 실행이 취소한다. 권한은 `contents: read` 이고 비밀 값을 쓰지 않는다.

| 잡                | 러너         | 하는 일                                                                                                               |
| ----------------- | ------------ | --------------------------------------------------------------------------------------------------------------------- |
| `checks`          | ubuntu-24.04 | `./scripts/check.sh --static`(게이트 [1]–[11]), 워크플로 lint(actionlint)                                             |
| `build-android`   | ubuntu-24.04 | `test/e2e/android.sh build` - CI 전용 `E2E_ANDROID_ABIS=x86_64`로 APK를 만들고 lib ABI 집합을 확인한다                |
| `e2e-android` × 3 | ubuntu-24.04 | 백엔드마다(`BACKEND_KIND`) 계약 거울(`test/contract/run.sh`) → KVM 에뮬레이터에서 `test/e2e/run-android.sh`(받은 APK) |
| `build-ios`       | macos-26     | `test/e2e/ios.sh build` - 시뮬레이터용 Release .app 을 한 번 만들어 아티팩트로 올린다                                 |
| `e2e-ios` × 6     | macos-26     | 백엔드마다 두 shard의 `E2E_FLOW`로 `test/e2e/run-ios.sh`를 실행한다(받은 .app, Docker 없음)                           |

## 작업 규칙

- iOS native cache는 Expo fingerprint·락파일·레시피·Xcode/SDK·architecture·ccache 판이 같은 prefix만 복원한다.
  DerivedData와 ccache는 `ios/` 밖에 둔다. 성공 빌드 뒤만 저장하며 hit에서도 prebuild와 현재 JS 번들·앱 설정·서명을
  다시 빌드하고 검증한다. CocoaPods 다운로드 캐시는 별도로 유지한다. 통계·원천 목록·빌드 시간을 기록으로 올린다.

- iOS는 macOS 최대 다섯 슬롯에서 여섯 잡을 실행한다. 실제 대기를 기록하며 matrix 순서가 러너 배정을 보장하지 않는다.
  `scripts/e2e-flow-shards.mjs`가 만든 두 manifest의 합집합은 iOS 21개이고 중복이 없어야 한다.
  아티팩트는 `e2e-ios-<backend>-shard-<shard>`로 나눠 manifest와 성공·실패한 이름의 로그를 함께 올린다.

- 두 iOS 잡은 `DEVELOPER_DIR=/Applications/Xcode_26.6.app/Contents/Developer`로 판을 명시한다(D7-R22b).
  기본 Xcode가 27로 바뀌면 SDK 57의 기존 AppDelegate lifecycle은 iOS 27에서 시작 전에 종료된다. 앱은 이제
  Expo의 공식 scene opt-in을 쓰며, Mac은 27.0으로 검증한다. CI 판을 바꾸는 날에는 두 iOS 잡을 함께 확인한다.

- 잡이 하는 일은 스크립트가 정한다. 워크플로에 검사 논리를 적지 않는다 - 로컬에서 같은 스크립트로 재현할 수 있어야
  한다. 스크립트는 `bash x.sh` 처럼 우회하지 않고 `./x.sh` 로 부른다(실행 권한이 빠지면 여기서 드러난다).
- 앱은 플랫폼마다 한 번 만든다. E2E 잡은 아티팩트를 받는다(`E2E_APK`·`E2E_APP`) - 빌드 입력이 같은 앱을 세 백엔드가
  나눠 쓴다(스펙 16장의 "E2E 빌드 시간").
- 매트릭스는 `fail-fast: false` 다. 재시도는 0 이다 - 실패한 잡을 코드 변경 없이 다시 돌리지 않는다(스펙 16장).
  흔들리는 플로는 원인을 고친다. `continue-on-error` 를 쓰지 않는다.
- 멈춘 서버 확인(`E2E_CHECKS=1`)은 Android fastapi와 iOS fastapi shard 1에서만 켠다.
- E2E 기록은 숨김 파일도 올린다(`include-hidden-files: true`) - Maestro 2.11.0의 상세 예외·명령 시각·스크린샷이
  `<플로>/debug/.maestro/`에 있다. 기본 제외로 그 디렉터리를 잃으면 실패의 첫 오류를 읽지 못한다(D7 실측 K3).
- 액션은 주 판(`@v7` 등)으로 고정한다. `astral-sh/setup-uv`는 주 판 태그 `v10`을 배포하지 않아 실제 릴리스
  `@v10.2.0`으로 고정한다(D7 실측 K3, 컨트롤러 결정 D7-R13). 판을 올릴 때는 실제 태그와 입력 이름을 액션의
  `action.yml` 에서 확인하고 actionlint 를 돈다.
- Node 는 `24.19.0`, pnpm 은 `package.json` 의 `packageManager` 다. Android 는 API 36 Google Play 이미지·`pixel_7`
  (로컬 게이트의 AVD 와 같은 이미지·폭), iOS 는 명시한 Xcode 26.6과 가장 새 가용 iOS 런타임의 iPhone 이다.
- Rails는 Ruby 설치 → `native-backend.sh lock-platform` → 기존 Ruby 젬 캐시 순서다. 사전 빌드 Ruby 3.4.8이
  `arm64-darwin-23`을 보고하므로 CI 임시 clone의 `PLATFORMS` 한 줄만 확장한다(D7-R14). 다른 잠금 변경은
  원본을 복구하고 실패한다. 백엔드 원격을 고치지 않고 frozen 설치와 캐시를 유지한다.
- macOS 러너의 bash 는 3.2 다(Mac 을 쓰는 사람의 기본 bash 도 같다). macOS 잡이 부르는 스크립트(`test/e2e/ios.sh`·
  `run-ios.sh`·`native-backend.sh`·`install-maestro.sh`·`guard-log.sh`)와 `run:` 은 bash 3.2 에서 도는 구문만 쓴다 -
  연관 배열·`mapfile`·`${x,,}` 를 쓰지 않고, `set -u` 아래에서 빌 수 있는 배열을 `"${a[@]}"` 로 펼치지 않는다.
- macOS 러너 시간은 공개 저장소에서 무료, 비공개 저장소에서 10배로 센다(스펙 13장).

## 검증

```bash
actionlint .github/workflows/ci.yml     # 1.7.12 - checks 잡도 같은 판을 docker 로 돈다
```

잡의 실제 결과는 GitHub 의 실행 기록이 정본이다 - 첫 실행과 고친 것은
`docs/superpowers/notes/2026-10-01-d7-measurements.md` 에 있다.
