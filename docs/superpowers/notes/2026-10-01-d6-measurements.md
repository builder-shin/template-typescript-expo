# D6 실측 기록 (2026-10-01)

EAS 설정·OTA·빌드 정보 카드(D6)를 Expo 계정 없이 잰 것이다. 계정과 빌드 크레딧이 필요한 실증(EAS 빌드, 업데이트
발행, 설치한 앱이 그 업데이트를 받는 것)은 스펙 15장 9단계가 사용자 승인 뒤에 한다. 계획은
`docs/superpowers/plans/2026-10-01-d6-eas-and-ota.md`.

## O1 — 설정이 다르면 fingerprint runtime version 이 다르다

**물음.** 스펙 16장은 "설정 오류가 OTA로 배포된다" 의 대응으로 `fingerprint` 런타임 정책을 든다. 업데이트는 발행한
환경의 설정으로 runtime version 을 계산하고 같은 runtime version 의 빌드에만 간다. 그러면 설정이 다른 환경(다른
`BACKEND_URL`, `APP_VARIANT` 없이, 다른 EAS 프로젝트)에서 발행한 업데이트가 빌드에 닿는지는 fingerprint 가 설정의
무엇을 해시에 넣는지에 달렸다.

**명령.** expo-updates 57.0.24 의 CLI 로 Android runtime version 을 계산했다 - 계정도 네트워크도 쓰지 않는다. 줄마다
`APP_VARIANT=<변형> BACKEND_URL=<주소> EAS_PROJECT_ID=<id> node node_modules/expo-updates/bin/cli.js
runtimeversion:resolve --platform android` 의 `runtimeVersion` 이다. 프로젝트 id 둘(ID1·ID2)과 주소 둘은 표본이다. D 는
JS 파일 하나(`app/(app)/index.tsx`)에 주석 한 줄을 더한 채로 재고 되돌렸다.

```text
A  preview    https://probe-a.example ID1: 116b860227917c04dd179fde537d47e5d7297ea3
A2 preview    https://probe-a.example ID1: 116b860227917c04dd179fde537d47e5d7297ea3
B  preview    https://probe-b.example ID1: a6b85037db353d397859f800ef3f4de79f27d9a0
C  production https://probe-a.example ID1: 496001f5278d97727b9cd3e693b58f5418b084f8
E  preview    https://probe-a.example ID2: 5111260d28f81a3937cb4223e7f56a8f47637009
F  (변형 없음) https://probe-a.example ID1: null
D  preview    https://probe-a.example ID1 (JS 만 바뀜): 116b860227917c04dd179fde537d47e5d7297ea3
```

**판정.** A 와 A2 가 같다 - 같은 설정은 같은 값이다. B(`BACKEND_URL` 만 다름)·C(변형만 다름)·E(프로젝트 id 만
다름)는 A 와 모두 다르다 - fingerprint 는 공개 설정 전체를 해시에 넣는다(`@expo/fingerprint` 0.20.13 의 기본
`sourceSkips` 는 `PackageJsonAndroidAndIosScriptsIfNotContainRun` 하나라 `extra` 도 들어간다). F(`APP_VARIANT` 없이 -
development)는 OTA 를 끈 설정이라 runtime version 이 없다 - eas-cli 는 runtime version 이 없는 설정으로 업데이트를
발행하지 않는다. D(JS 만 바뀜)는 A 와 같다 - 그런 업데이트는 그 빌드에 간다. 그래서 설정이 틀린 환경의 발행은 어떤
빌드에도 닿지 않는다. 앱 시작의 재검증(스펙 10.1)은 그 뒤의 두 번째 방어선이다.

## O2 — eas.json 을 EAS 의 해석기로 읽는다

**명령.** eas-cli 24.8.0 이 eas.json 을 읽을 때 쓰는 `@expo/eas-json` 24.8.0 을 저장소 밖의 임시 디렉터리에 받아,
`EasJsonUtils` 로 빌드 프로필 넷 × 플랫폼 둘과 제출 프로필을 해석했다 - 계정 없이 도는 라이브러리다.

```text
cli {"version":">= 24.8.0","appVersionSource":"remote"}
build development android {"credentialsSource":"remote","distribution":"internal","node":"24.19.0","pnpm":"11.22.0","developmentClient":true,"environment":"development","env":{"APP_VARIANT":"development"}}
build development ios {"credentialsSource":"remote","distribution":"internal","node":"24.19.0","pnpm":"11.22.0","developmentClient":true,"environment":"development","env":{"APP_VARIANT":"development"}}
build preview android {"credentialsSource":"remote","distribution":"internal","node":"24.19.0","pnpm":"11.22.0","channel":"preview","environment":"preview","env":{"APP_VARIANT":"preview"},"buildType":"apk"}
build preview ios {"credentialsSource":"remote","distribution":"internal","node":"24.19.0","pnpm":"11.22.0","channel":"preview","environment":"preview","env":{"APP_VARIANT":"preview"}}
build production android {"credentialsSource":"remote","distribution":"store","node":"24.19.0","pnpm":"11.22.0","channel":"production","autoIncrement":true,"environment":"production","env":{"APP_VARIANT":"production"}}
build production ios {"credentialsSource":"remote","distribution":"store","node":"24.19.0","pnpm":"11.22.0","channel":"production","autoIncrement":true,"environment":"production","env":{"APP_VARIANT":"production"}}
build e2e android {"credentialsSource":"remote","distribution":"internal","node":"24.19.0","pnpm":"11.22.0","withoutCredentials":true,"env":{"APP_VARIANT":"e2e"},"buildType":"apk"}
build e2e ios {"credentialsSource":"remote","distribution":"internal","node":"24.19.0","pnpm":"11.22.0","withoutCredentials":true,"env":{"APP_VARIANT":"e2e"},"simulator":true}
submit production android {"track":"internal","releaseStatus":"draft","changesNotSentForReview":false}
submit production ios {"language":"en-US"}
```

**판정.** 스키마 위반과 폐기 경고 없이 모두 해석됐다. 해석한 프로필에는 스키마의 기본값(`credentialsSource:
remote`, 제출의 `changesNotSentForReview: false`, iOS 제출의 `language: en-US`)이 더해진다.

## O3 — 게이트 [8] 이 변형별 네이티브 설정을 검사한다

**명령.** `scripts/check.sh` 의 [8] 블록만 떼어 돌렸다 - 변형 넷을 EAS 프로젝트가 없을 때와 있을 때
(`GATE_EAS_PROJECT_ID`, 모양만 UUID)로 `expo config --type introspect --json` 하고, `scripts/check-variant-config.mjs` 가
설정 플러그인이 옮길 네이티브 값(AndroidManifest.xml·strings.xml·Info.plist·Expo.plist)을 변형 표·OTA 판단과 맞댄다.
여덟 평가가 이 개발 머신에서 10초 안팎이다.

```text
=== [8/13] 설정 ===
--- APP_VARIANT=development EAS_PROJECT_ID=(없음)
변형 설정 통과: development - 17건, OTA 끔
--- APP_VARIANT=development EAS_PROJECT_ID=00000000-0000-4000-8000-000000000000
변형 설정 통과: development + EAS 프로젝트 00000000-0000-4000-8000-000000000000 - 17건, OTA 끔
--- APP_VARIANT=preview EAS_PROJECT_ID=(없음)
변형 설정 통과: preview - 17건, OTA 끔
--- APP_VARIANT=preview EAS_PROJECT_ID=00000000-0000-4000-8000-000000000000
변형 설정 통과: preview + EAS 프로젝트 00000000-0000-4000-8000-000000000000 - 21건, OTA 켬(채널 preview)
--- APP_VARIANT=production EAS_PROJECT_ID=(없음)
변형 설정 통과: production - 17건, OTA 끔
--- APP_VARIANT=production EAS_PROJECT_ID=00000000-0000-4000-8000-000000000000
변형 설정 통과: production + EAS 프로젝트 00000000-0000-4000-8000-000000000000 - 21건, OTA 켬(채널 production)
--- APP_VARIANT=e2e EAS_PROJECT_ID=(없음)
변형 설정 통과: e2e - 17건, OTA 끔
--- APP_VARIANT=e2e EAS_PROJECT_ID=00000000-0000-4000-8000-000000000000
변형 설정 통과: e2e + EAS 프로젝트 00000000-0000-4000-8000-000000000000 - 17건, OTA 끔
```

17건은 OTA 를 끈 설정의 자리(식별자·scheme·앱 이름·평문 HTTP·OTA 끔과 주소·채널·runtime version 없음, Android·iOS),
21건은 켠 설정에 확인 시점(`ALWAYS` - `ON_LOAD` 의 네이티브 값)과 기다림(0)이 두 플랫폼에서 더해진 것이다.

**`.env` 가 섞이지 않는다.** 저장소 루트에 `EAS_PROJECT_ID` 를 둔 `.env` 를 만들고 같은 블록을 돌려도 여덟이
통과했다 - Expo CLI 는 `.env` 를 읽지만 블록이 두 자리를 빈 값으로 명시해 덮는다(만든 `.env` 는 지웠다). 명시가
빠지면 검사기가 `extra.eas` 로 잡는다 - `test/unit/scripts/check-variant-config.test.ts` 의 ".env 의 EAS 프로젝트 id
가 섞였다" 표본.

**어긋남을 잡는다.** 저장소 밖의 사본에서 `app.config.ts` 의 `usesCleartextTraffic: profile.allowCleartext` 를 `true` 로
바꾸고 돌리면 development 둘은 통과하고 preview 에서 멈췄다:

```text
변형 설정 위반 1건 (preview):
- Android 평문 HTTP(usesCleartextTraffic): "true" - 기대한 값은 "false"
```

되돌린 뒤 여덟이 다시 통과했다. 검사기의 자리마다 어긋난 표본이 실패하는 것은
`test/unit/scripts/check-variant-config.test.ts` 가 잰다 - 21자리 모두에 표본이 하나씩 있다. 저장소 밖의 사본에서 검사기의
자리를 하나씩 꺼 보면(자리마다 변이 하나 - 그 자리의 비교 `expectValue` 만 건너뛰게 한 검사기로 시험을 돌린다) 스물한 변이가
모두 시험을 빨갛게 하고, 자리마다 그 자리의 표본이 실패한다.
