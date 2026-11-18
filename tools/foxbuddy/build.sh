#!/bin/zsh
# Build Fox Buddy into ~/Applications/Fox Buddy.app and (re)launch it, from this checkout.
# Needs only the Xcode command line tools (xcode-select --install). (The download is made by package.sh too,
# in the release workflow: .github/workflows/release.yml.)
set -euo pipefail
HERE="${0:A:h}"
ROOT="${HERE:h:h}"
APP="$HOME/Applications/Fox Buddy.app"
command -v swiftc >/dev/null || { echo "swiftc not found: run  xcode-select --install"; exit 1; }

BUILD="$(mktemp -d)"
trap 'rm -rf "$BUILD"' EXIT
zsh "$HERE/package.sh" "$BUILD"

# The app from before the rename (Desktop Lump) shouldn't keep running alongside him.
pkill -x DesktopLump 2>/dev/null || true
pkill -x FoxBuddy 2>/dev/null || true
rm -rf "$APP"
mkdir -p "$HOME/Applications"
mv "$BUILD/Fox Buddy.app" "$APP"

# Point the bridge at him (it re-reads config.json every few seconds while it has nothing to talk to).
python3 - <<'PY'
import json, os
d = os.path.expanduser("~/.desk-buddy"); p = os.path.join(d, "config.json"); os.makedirs(d, exist_ok=True)
os.chmod(d, 0o700)
try: cfg = json.load(open(p))
except Exception: cfg = {}
if not cfg.get("desktop_lump"):
    cfg["desktop_lump"] = True; json.dump(cfg, open(p, "w"), indent=2); print("pointed the bridge at the app in", p)
PY
# Lump's voice, left over from before Fox Buddy (his sound files and the settings that played them):
# the fox is silent, and those sounds aren't ours to keep. Once only, so sounds you add yourself later stay.
if [ ! -e "$HOME/.desk-buddy/.lump-sounds-removed" ] && { [ -e "$HOME/.desk-buddy/sounds" ] || [ -e "$HOME/.desk-buddy/sounds.json" ]; }; then
  rm -rf "$HOME/.desk-buddy/sounds" "$HOME/.desk-buddy/sounds.json"
  echo "removed Lump's old sounds: the fox is silent"
fi
touch "$HOME/.desk-buddy/.lump-sounds-removed"
# A bridge that's already installed gets this version of itself.
if [ -f "$HOME/.desk-buddy/bridge.py" ] && ! cmp -s "$ROOT/tools/buddy_bridge.py" "$HOME/.desk-buddy/bridge.py"; then
  cp "$ROOT/tools/buddy_bridge.py" "$HOME/.desk-buddy/bridge.py"
  launchctl kickstart -k "gui/$(id -u)/com.deskbuddy.bridge" 2>/dev/null && echo "bridge updated and restarted"
fi
open "$APP"
echo "Fox Buddy is running from $APP"
echo "Right-click him for options. To connect him to Claude, see tools/foxbuddy/README.md."
