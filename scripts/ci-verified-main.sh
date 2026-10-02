#!/usr/bin/env bash
# main에 병합한 코드가 최근 branch push에서 검증됐으면 매트릭스를 생략한다(스펙 13장).
# git/Actions API 오류나 빠진 부모는 생략하지 않는다. git과 러너에 설치된 gh만 쓴다.
set -euo pipefail

verified_run() {
  [ "${GITHUB_EVENT_NAME:-}" = push ] && [ "${GITHUB_REF:-}" = refs/heads/main ] || return 1
  [ -n "${GITHUB_REPOSITORY:-}" ] || return 1

  local parents candidate _first_parent second_parent _other_parents attempts runs age url
  parents=$(git rev-list --parents -n 1 HEAD) || return 1
  read -r candidate _first_parent second_parent _other_parents <<< "$parents"
  [ -n "$candidate" ] || return 1
  # merge는 branch tip인 둘째 부모부터, fast-forward는 HEAD 자체부터 검사한다.
  if [ -n "$second_parent" ]; then candidate=$second_parent; fi

  attempts=0
  while [ "$attempts" -lt 10 ]; do
    # docs-only push는 CI가 없으므로 같은 코드인 첫 부모들까지 내려간다.
    git diff --quiet "$candidate" HEAD -- . ':(exclude)docs' || return 1
    # gh의 내장 jq가 UTC 시각을 초 단위 나이로 바꾼다. 별도 jq/date 설치는 필요 없다.
    runs=$(gh api "repos/$GITHUB_REPOSITORY/actions/workflows/ci.yml/runs?head_sha=$candidate&event=push&status=success" \
      --jq '.workflow_runs[] | [(now - (.created_at | fromdateiso8601) | ceil), .html_url] | @tsv') || return 1
    if [ -n "$runs" ]; then
      while IFS=$'\t' read -r age url; do
        case "$age" in ''|*[!0-9]*) return 1 ;; esac
        [ -n "$url" ] || return 1
        if [ "${#age}" -le 5 ] && [ "$age" -le 86400 ]; then
          printf '::notice::검증된 push 실행 %s (commit %s): main CI 매트릭스를 생략한다\n' "$url" "$candidate"
          return 0
        fi
      done <<< "$runs"
    fi
    attempts=$((attempts + 1))
    [ "$attempts" -lt 10 ] || return 1
    candidate=$(git rev-parse --verify "$candidate^1") || return 1
  done
  return 1
}

if verified_run; then
  printf 'skip=true\n' >> "$GITHUB_OUTPUT"
else
  printf 'skip=false\n' >> "$GITHUB_OUTPUT"
fi
