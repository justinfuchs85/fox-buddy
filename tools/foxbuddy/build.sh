#!/bin/zsh
# Build Fox Buddy into ~/Applications/Fox Buddy.app and (re)launch it.
# Needs only the Xcode command line tools (xcode-select --install).
set -euo pipefail
HERE="${0:A:h}"
ROOT="${HERE:h:h}"
APP="$HOME/Applications/Fox Buddy.app"
command -v swiftc >/dev/null || { echo "swiftc not found: run  xcode-select --install"; exit 1; }

BUILD="$(mktemp -d)"
trap 'rm -rf "$BUILD"' EXIT

# The fox (characters/fox), the desktop player and the speech bubble.
WEB="$BUILD/web"; mkdir -p "$WEB/fox"
cp "$HERE/web/start.js" "$HERE/web/desktop.js" "$HERE/web/bubble.html" "$WEB/"
cp "$ROOT/characters/fox/fox.js" "$ROOT/characters/fox/rig.js" "$ROOT/characters/fox/character.js" "$WEB/fox/"
print -r -- '<!doctype html><meta charset="utf-8"><title>Fox</title><body></body>' > "$WEB/fox/fox.html"

swiftc -O -swift-version 5 "$HERE/main.swift" -o "$BUILD/FoxBuddy"

# The app from before the rename (Desktop Lump) shouldn't keep running alongside him.
pkill -x DesktopLump 2>/dev/null || true
pkill -x FoxBuddy 2>/dev/null || true
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$BUILD/FoxBuddy" "$APP/Contents/MacOS/FoxBuddy"
cp -R "$WEB" "$APP/Contents/Resources/web"
cp "$HERE/foxtools.py" "$APP/Contents/Resources/foxtools.py"    # his own tools: find files by name, read your activity summary
ICONSET="$BUILD/FoxBuddy.iconset"; mkdir -p "$ICONSET"
for px in 16 32 128 256 512; do
  sips -z $px $px "$HERE/icon.png" --out "$ICONSET/icon_${px}x${px}.png" >/dev/null
  sips -z $((px * 2)) $((px * 2)) "$HERE/icon.png" --out "$ICONSET/icon_${px}x${px}@2x.png" >/dev/null
done
iconutil -c icns "$ICONSET" -o "$APP/Contents/Resources/FoxBuddy.icns"
cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleIdentifier</key><string>com.foxbuddy.app</string>
  <key>CFBundleName</key><string>Fox Buddy</string>
  <key>CFBundleDisplayName</key><string>Fox Buddy</string>
  <key>CFBundleExecutable</key><string>FoxBuddy</string>
  <key>CFBundleIconFile</key><string>FoxBuddy</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>LSMinimumSystemVersion</key><string>12.0</string>
  <key>LSUIElement</key><true/>
  <key>NSAppSleepDisabled</key><true/>
</dict></plist>
PLIST
codesign --force --deep --sign - "$APP"

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
# A bridge that's already installed gets this version of itself.
if [ -f "$HOME/.desk-buddy/bridge.py" ] && ! cmp -s "$ROOT/tools/buddy_bridge.py" "$HOME/.desk-buddy/bridge.py"; then
  cp "$ROOT/tools/buddy_bridge.py" "$HOME/.desk-buddy/bridge.py"
  launchctl kickstart -k "gui/$(id -u)/com.deskbuddy.bridge" 2>/dev/null && echo "bridge updated and restarted"
fi
open "$APP"
echo "Fox Buddy is running from $APP"
echo "Right-click him for options. To connect him to Claude, see tools/foxbuddy/README.md."
