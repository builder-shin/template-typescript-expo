#!/usr/bin/env bash
# E2E 플로 하나가 남긴 기기 로그에 가드를 건다 - 스펙 11.3.
#
#   test/e2e/guard-log.sh <logcat 파일> [<허용 상태>...]
#
# 기기 로그는 `adb logcat -v brief` 모양이다. 실패(exit 1)로 만드는 것:
#   - JS 경고·오류: ReactNativeJS 태그의 W·E·F 줄
#   - 앱 프로세스의 치명 오류: FATAL EXCEPTION
#   - 플로가 선언하지 않은 HTTP 실패: e2e 변형의 API 클라이언트가 남긴 `[e2e-http] <상태> …` 줄
#     (lib/jsonapi/failure-log.ts 의 httpFailureLine) 가운데 상태가 허용 목록에 없는 것
#
# 걸린 줄은 stderr 로 낸다. test/unit/e2e/guard-log.test.ts 가 이 스크립트를 실제로 돌려 잰다.
set -euo pipefail

log="${1:?기기 로그 파일이 필요하다}"
shift
[ -f "$log" ] || { echo "기기 로그 파일이 없다: $log" >&2; exit 1; }

allowed=" $* "
bad=0

if grep -E '^[WEF]/ReactNativeJS' "$log" >&2; then
  echo "위 JS 경고·오류가 기기 로그에 있다" >&2
  bad=1
fi

if grep -F 'FATAL EXCEPTION' "$log" >&2; then
  echo "앱이 치명 오류로 죽었다" >&2
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

exit "$bad"
