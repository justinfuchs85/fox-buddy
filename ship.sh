#!/bin/zsh
# Ship a new version of Fox Buddy: tag it, and the release workflow builds, signs, notarizes and publishes it
# (GitHub, the website, Homebrew, and the update everyone's fox offers).
#
#   zsh ship.sh            the next small version: 1.0.4 -> 1.0.5
#   zsh ship.sh minor      1.0.4 -> 1.1.0
#   zsh ship.sh major      1.0.4 -> 2.0.0
#   zsh ship.sh 1.2.3      exactly that
#   add --yes to skip the "Ship it?" question (Claude Code's /foxship does)
set -euo pipefail
cd "${0:A:h}"

bump=patch yes=0
for a in "$@"; do
  case "$a" in
    --yes|-y) yes=1 ;;
    patch|minor|major) bump=$a ;;
    [0-9]*.[0-9]*.[0-9]*) bump=$a ;;
    *) echo "I don't know \"$a\". Use patch, minor, major, a version like 1.2.3, or --yes."; exit 1 ;;
  esac
done

[ "$(git branch --show-current)" = main ] || { echo "You're not on main. Switch with:  git checkout main"; exit 1; }
if [ -n "$(git status --porcelain)" ]; then
  echo "You have changes that aren't committed yet, so I stopped:"; git status --short; exit 1
fi
git pull -q --ff-only
git fetch -q --tags

last="$(git tag -l 'v[0-9]*' --sort=-v:refname | head -1)"
lastv="${last#v}"; [ -n "$lastv" ] || lastv=0.0.0
parts=(${(s:.:)${lastv%%-*}})
maj=${parts[1]:-0} min=${parts[2]:-0} pat=${parts[3]:-0}
case "$bump" in
  patch) next="$maj.$min.$((pat + 1))" ;;
  minor) next="$maj.$((min + 1)).0" ;;
  major) next="$((maj + 1)).0.0" ;;
  *)     next="$bump" ;;
esac
git rev-parse -q --verify "refs/tags/v$next" >/dev/null && { echo "v$next already exists."; exit 1; }

if [ -n "$last" ]; then
  changes="$(git log --oneline --no-merges "$last"..HEAD)"
  [ -n "$changes" ] || { echo "Nothing new since $last, so there's nothing to ship."; exit 0; }
  # Every release adds a Homebrew commit (Casks/) afterwards; that alone isn't worth a release.
  if [ -z "$(git diff --name-only "$last"..HEAD -- . ':(exclude)Casks')" ]; then
    echo "Only the Homebrew listing has changed since $last, so there's nothing to ship."; exit 0
  fi
  echo "Changes since $last:"; print -r -- "$changes" | sed 's/^/  /'
fi
echo
if [ "$yes" != 1 ]; then
  read -q "?Ship v$next? [y/N] " || { echo; echo "Not shipped."; exit 0; }
  echo
fi

git tag "v$next"
git push -q origin "v$next"
echo "Shipping v$next. It's on the Releases page in about 10 minutes:"
echo "  https://github.com/justinfuchs85/fox-buddy/actions"
echo "Foxes on an older version offer the update within a day (or Setup › Check for Updates… right away)."
