#!/usr/bin/env bash
#
# Publish LessFun to GitHub Pages.
#
# Usage:
#   ./deploy.sh [repo-name]
#
# Requires the GitHub CLI and a one-time `gh auth login`.

set -euo pipefail

REPO_NAME="${1:-lessfun}"
BRANCH="main"
ROOT="$(cd "$(dirname "$0")" && pwd)"

cd "$ROOT"

step() {
  printf '\n==> %s\n' "$1"
}

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI (gh) is required. Install it with: brew install gh" >&2
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "GitHub CLI is not authenticated. Run: gh auth login" >&2
  exit 1
fi

if [ ! -f docs/index.html ]; then
  echo "docs/index.html is missing — run this script from the project root." >&2
  exit 1
fi

step "Preparing the local repository"
if [ ! -d .git ]; then
  git init >/dev/null
  git symbolic-ref HEAD "refs/heads/$BRANCH"
fi

if ! git config user.name >/dev/null 2>&1; then
  git config user.name "$(gh api user --jq .login)"
fi

if ! git config user.email >/dev/null 2>&1; then
  git config user.email "$(gh api user --jq '.email // (.login + "@users.noreply.github.com")')"
fi

step "Writing update manifest"
python3 - <<'PY'
import json, re, datetime, os
app = open('docs/app.js', encoding='utf-8').read()
version = re.search(r'const APP_VERSION = "([^"]+)";', app).group(1)
previous = {}
if os.path.exists('docs/version.json'):
    try:
        with open('docs/version.json', encoding='utf-8') as f:
            previous = json.load(f) or {}
    except Exception:
        previous = {}
manifest = {
    'version': version,
    'shutdown': bool(previous.get('shutdown', False)),
    'message': previous.get('message', ''),
    'updated_at': datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z')
}
with open('docs/version.json', 'w', encoding='utf-8') as f:
    json.dump(manifest, f, indent=2)
    f.write('\n')
print('  ' + version + (' · SHUTDOWN' if manifest['shutdown'] else ''))
PY

git add -A
if git diff --cached --quiet; then
  echo "No file changes to commit."
else
  git commit -m "Deploy LessFun web arcade"
fi

git branch -M "$BRANCH"

OWNER="$(gh api user --jq .login)"
FULL_NAME="$OWNER/$REPO_NAME"

step "Pushing to GitHub"
if ! gh repo view "$FULL_NAME" >/dev/null 2>&1; then
  gh repo create "$REPO_NAME" --public --source=. --remote=origin --push
else
  if ! git remote get-url origin >/dev/null 2>&1; then
    git remote add origin "https://github.com/$FULL_NAME.git"
  fi
  git push -u origin "$BRANCH"
fi

step "Enabling GitHub Pages (main /docs)"
if gh api "repos/$FULL_NAME/pages" >/dev/null 2>&1; then
  gh api -X PUT "repos/$FULL_NAME/pages" \
    -f "source[branch]=$BRANCH" \
    -f "source[path]=/docs" >/dev/null
else
  gh api -X POST "repos/$FULL_NAME/pages" \
    -f "source[branch]=$BRANCH" \
    -f "source[path]=/docs" >/dev/null
fi

printf '\nDone. GitHub Pages is building the site now:\n'
printf '  https://%s.github.io/%s/\n\n' "$OWNER" "$REPO_NAME"
printf 'First publish can take a minute or two. Check status with:\n'
printf '  gh api repos/%s/pages --jq .status\n' "$FULL_NAME"
