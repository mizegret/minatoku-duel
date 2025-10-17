#!/usr/bin/env bash
set -euo pipefail

# 使い方: scripts/mk-branch.sh <issue-number>
if [ $# -lt 1 ]; then
  echo "usage: $0 <issue-number>" >&2
  exit 2
fi
ISSUE=$1
REPO=${REPO:-$(git config --get remote.origin.url | sed -n 's#.*github.com[:/]\(.*\)\.git#\1#p')}
TITLE=$(gh issue view "$ISSUE" -R "$REPO" --json title -q .title)
SLUG=$(echo "$TITLE" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g;s/^-+|-+$//g')
BR=$(printf "%s/%04d-%s" "docs" "$ISSUE" "$SLUG")
git switch -c "$BR"
echo "Created and switched to: $BR"
