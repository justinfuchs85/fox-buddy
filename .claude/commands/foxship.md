---
description: Ship a new version of Fox Buddy (tag it; the release workflow does the rest)
argument-hint: "[patch | minor | major | 1.2.3]"
---

Ship a new release of Fox Buddy from this repository.

1. Run `zsh ship.sh --yes $ARGUMENTS` from the repository root. It checks that `main` is clean and up to date,
   picks the next version (the next patch version unless an argument says otherwise), lists what changed since
   the last release, then tags it and pushes the tag.
2. If it stops (uncommitted changes, not on `main`, nothing new to ship), tell me why in one sentence and what
   to do. Don't commit, stash or discard anything to get around it, and don't push anything else.
3. If it ships, tell me the version and a short, plain-English list of what's in it (from the changes it
   printed), and that it'll be on the Releases page in about 10 minutes.
