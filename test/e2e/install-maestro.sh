#!/usr/bin/env bash
# Maestro CLI 2.11.0 을 ~/.maestro 에 푼다 - E2E 하네스가 그 판에서 잰 동작에 기댄다(run-android.sh·run-ios.sh 가
# 2.11.x 가 아니면 멈춘다). CI 의 E2E 잡이 부르고, 개발 머신에서도 같은 명령으로 설치한다.
#
#   test/e2e/install-maestro.sh
#
# 이미 2.11.0 이 있으면 아무것도 하지 않는다. 받은 zip 은 릴리스의 checksums_sha256.txt 로 검사한다(D1 실측 M8 의
# 설치와 같다 - docs/superpowers/notes/2026-09-30-d1-measurements.md). Java 17 이상이 있어야 돈다.
set -euo pipefail

readonly VERSION=2.11.0
readonly BASE="https://github.com/mobile-dev-inc/maestro/releases/download/cli-$VERSION"
readonly DEST="$HOME/.maestro"

export MAESTRO_CLI_NO_ANALYTICS=1
export MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true

installed_version() {
  "$DEST/bin/maestro" --version 2>/dev/null | tr -d '\r' | grep -E '^[0-9]' | tail -n 1 || true
}

if [ -x "$DEST/bin/maestro" ] && [ "$(installed_version)" = "$VERSION" ]; then
  echo "Maestro $VERSION 이 이미 있다: $DEST"
  exit 0
fi

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
curl -fsSL -o "$tmp/maestro.zip" "$BASE/maestro.zip"
curl -fsSL -o "$tmp/checksums_sha256.txt" "$BASE/checksums_sha256.txt"
if command -v sha256sum >/dev/null; then
  (cd "$tmp" && sha256sum -c checksums_sha256.txt)
else
  (cd "$tmp" && shasum -a 256 -c checksums_sha256.txt)
fi
unzip -q "$tmp/maestro.zip" -d "$tmp/unzipped"
# 다른 판의 jar 가 남으면 섞인다 - 실행 파일과 라이브러리 자리는 비우고 푼다(기록·설정 파일은 둔다).
rm -rf "${DEST:?}/bin" "${DEST:?}/lib"
mkdir -p "$DEST"
cp -R "$tmp/unzipped/maestro/." "$DEST/"
echo "Maestro $(installed_version) 을 풀었다: $DEST"
