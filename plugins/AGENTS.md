# Expo 설정 플러그인

생성된 네이티브 프로젝트 파일을 고친다. 앱의 판단·화면·네트워크를 두지 않는다. `app.config.ts`와 Expo CLI가
읽으므로 Node type stripping으로 돌 수 있는 TypeScript만 쓴다(상대 import는 `.ts`, 타입은 `import type`,
enum·namespace·매개변수 프로퍼티 금지). 의존성을 더하지 않고 `expo/config-plugins` 공개 경로를 쓴다.

## Android splash 종료

`with-android-splash-exit.ts`는 모든 변형에서 Expo splash 플러그인이 만든 MainActivity를 고친다. Expo의 MainActivity
mod는 역순으로 실행하므로 배열에서는 Expo splash보다 먼저 등록한다. 실제 prebuild에서 역순 실행과 앵커를 확인한다.
Expo의 exit listener가 켜는
Android 16 splash 전송은 2초 안에 앱의 프레임이 돌아야 한다. CI에서 그 제한을 넘겨 `starting_reveal`이 남았고
Maestro 문자 입력이 키마다 두 번 5초를 기다렸다(실측 K3, 컨트롤러 D7-R15). API 31 이상에서 사용자 지정 exit
listener를 해제해 플랫폼 기본 exit를 쓴다. Expo의 splash 유지·hide 프리드로우 게이트와 iOS는 유지하지만 Android의
400ms fade는 없어진다.

앵커는 Kotlin `MainActivity.kt`의 `SplashScreenManager.registerOnActivity(this)`와 그 뒤 `super.onCreate`다.
각각 정확히 한 번 있어야 하고 해제는 둘 사이에 한 번만 들어간다. 앵커가 없거나 중복되거나 언어가 바뀌거나 알 수
없는 해제가 있으면 prebuild가 오류로 멈춘다. 두 번 적용해도 같은 소스다.

Expo 업그레이드 뒤에는 설치된 `SplashScreenManager.kt`의 listener 등록·hide 구현, Android 16의
`ActivityRecord` 전송 timeout 경로를 확인한다. 변환 단위 시험과 실제 `expo prebuild --platform android --clean`
사본의 MainActivity를 보고, 게이트 [8] 여덟 변형과 APK 빌드·E2E를 돈다. 이 workaround를 걷으려면 전송 실패에서도
남는 애니메이션이 없다는 근거를 먼저 남긴다. 근거는 `docs/superpowers/notes/2026-10-01-d7-measurements.md`의 K3다.
