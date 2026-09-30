#!/usr/bin/env bash
# E2E 플로 하나가 남긴 기기 로그에 가드를 건다 - 스펙 11.3.
#
#   test/e2e/guard-log.sh <logcat 파일> [<허용 상태>...]
#
# 기기 로그는 `adb logcat -v brief` 모양이다. 실패(exit 1)로 만드는 것:
#   - 앱의 줄이 하나도 없는 로그: ReactNativeJS 태그의 줄이 없으면 로그를 모으지 못한 것이다(빈 파일, adb
#     오류만 든 파일, 버퍼 머리 줄만 든 파일). 걸릴 줄이 없는 로그는 아래 검사를 전부 통과한다 - 그래서 앱이
#     켜질 때 남기는 줄(`Running "main"`)이 적어도 하나 있어야 한다
#   - JS 경고·오류: ReactNativeJS 태그의 W·E·F 줄
#   - 치명 오류: FATAL EXCEPTION 줄. 프로세스를 가리지 않는다 - 하네스가 모으는 AndroidRuntime 의 E 줄에는
#     앱 밖 프로세스(Maestro 드라이버 등)의 것도 든다. 누구의 것인지는 줄의 pid 로 본다
#   - 플로가 선언하지 않은 HTTP 실패: e2e 변형의 API 클라이언트가 남긴 `[e2e-http] <상태> …` 줄
#     (lib/jsonapi/failure-log.ts 의 httpFailureLine) 가운데 상태가 허용 목록에 없는 것
#   - 선언했는데 나오지 않은 HTTP 실패: 허용 목록의 상태가 로그에 한 번도 없는 것 - 플로가 더는 일으키지 않는
#     상태를 선언에 남겨 두지 않게 한다
#
# 걸린 줄은 stderr 로 낸다. test/unit/e2e/guard-log.test.ts 가 이 스크립트를 실제로 돌려 잰다.
set -euo pipefail

log="${1:?기기 로그 파일이 필요하다}"
shift
[ -f "$log" ] || { echo "기기 로그 파일이 없다: $log" >&2; exit 1; }

allowed=" $* "
bad=0

if ! grep -qE '^[VDIWEF]/ReactNativeJS' "$log"; then
  echo "기기 로그에 앱의 줄(ReactNativeJS)이 하나도 없다 - 로그를 모으지 못했거나 앱의 JS 가 뜨지 않았다: $log" >&2
  head -n 5 "$log" >&2
  bad=1
fi

if grep -E '^[WEF]/ReactNativeJS' "$log" >&2; then
  echo "위 JS 경고·오류가 기기 로그에 있다" >&2
  bad=1
fi

if grep -F 'FATAL EXCEPTION' "$log" >&2; then
  echo "위 치명 오류(FATAL EXCEPTION)가 기기 로그에 있다 - 어느 프로세스의 것인지는 줄의 pid 로 본다" >&2
  bad=1
fi

for status in $(sed -n 's/.*\[e2e-http\] \([0-9][0-9]*\) .*/\1/p' "$log" | sort -u); do
  case "$allowed" in
    *" $status "*) ;;
    *)
      echo "플로가 선언하지 않은 HTTP 실패: $status (허용: ${*:-없음})" >&2
      grep -F "[e2e-http] $status " "$log" >&2 || true
      bad=1
      ;;
  esac
done

for status in "$@"; do
  if ! grep -qF "[e2e-http] $status " "$log"; then
    echo "플로가 선언한 HTTP 실패가 기기 로그에 없다: $status - 선언을 지우거나 플로가 그 상태를 일으키는지 본다" >&2
    bad=1
  fi
done

exit "$bad"
