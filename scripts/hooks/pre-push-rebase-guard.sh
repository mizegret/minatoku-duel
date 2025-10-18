#!/usr/bin/env bash
set -euo pipefail

# Pre-push guard: ensure the branch is rebased on latest base to avoid PR conflicts.
# - Detect PR base via gh if available, otherwise use 'main'.
# - Fetch base and verify it's an ancestor of HEAD.
# - Skip for base branches and when REBASE_GUARD=0.

if [[ "${REBASE_GUARD:-1}" != "1" ]]; then
  exit 0
fi

branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
case "$branch" in
  main|master|HEAD|release/*) exit 0 ;; # don't guard base branches
esac

base="main"
if command -v gh >/dev/null 2>&1; then
  # Try to read base from the current PR; ignore errors
  pr_base=$(gh pr view --json baseRefName -q .baseRefName 2>/dev/null || true)
  if [[ -n "${pr_base:-}" ]]; then base="$pr_base"; fi
fi

git fetch origin "$base" --quiet || true

if git merge-base --is-ancestor "origin/$base" HEAD; then
  exit 0
fi

echo "[rebase-guard] Your branch '$branch' is not up-to-date with origin/$base." >&2
echo "[rebase-guard] Please rebase before push to avoid PR merge conflicts." >&2
echo >&2
echo "  git fetch origin $base && git rebase origin/$base" >&2
echo "  # If conflicts: resolve, 'git add -A', then 'git rebase --continue'" >&2
echo >&2
echo "(Set REBASE_GUARD=0 to bypass temporarily)" >&2
exit 1

