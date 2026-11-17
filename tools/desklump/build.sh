#!/bin/zsh
# Build Desktop Lump into ~/Applications/Desktop Lump.app and (re)launch it.
# Needs only the Xcode command line tools (xcode-select --install): no Chrome, no baking.
# Re-run it after adding or changing a clip in design/clips, or a drawing in design/lump.html.
set -euo pipefail
HERE="${0:A:h}"
ROOT="${HERE:h:h}"
APP="$HOME/Applications/Desktop Lump.app"
command -v swiftc >/dev/null || { echo "swiftc not found: run  xcode-select --install"; exit 1; }

BUILD="$(mktemp -d)"
trap 'rm -rf "$BUILD"' EXIT

# Lump himself: the design page, the clip kit, every clip (each in its own try, so one broken clip
# can't take the rest down), and the desktop player.
WEB="$BUILD/web"; mkdir -p "$WEB"
# (lump.html without its Google Fonts links: the app makes no internet requests at all)
grep -v -E "fonts\.(googleapis|gstatic)\.com" "$ROOT/design/lump.html" > "$WEB/lump.html"
cp "$ROOT/design/clip_kit.js" "$HERE/web/start.js" "$HERE/web/desktop.js" "$HERE/web/bubble.html" "$WEB/"
for f in "$ROOT"/design/clips/*.js(N); do
  print -r -- "try {"
  cat "$f"
  print -r -- ""
  print -r -- "} catch (e) { console.error('clip ${f:t}: ' + e); }"
done > "$WEB/clips.bundle.js"
echo "$(ls "$ROOT"/design/clips/*.js | wc -l | tr -d ' ') clips bundled"
# the fox (characters/fox): an original character, drawn by his own rig
mkdir -p "$WEB/fox"
cp "$ROOT/characters/fox/fox.js" "$ROOT/characters/fox/rig.js" "$ROOT/characters/fox/character.js" "$WEB/fox/"
print -r -- '<!doctype html><meta charset="utf-8"><title>Fox</title><body></body>' > "$WEB/fox/fox.html"

swiftc -O -swift-version 5 "$HERE/main.swift" -o "$BUILD/DesktopLump"

pkill -x DesktopLump 2>/dev/null || true
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$BUILD/DesktopLump" "$APP/Contents/MacOS/DesktopLump"
cp -R "$WEB" "$APP/Contents/Resources/web"
ICONSET="$BUILD/Lump.iconset"; mkdir -p "$ICONSET"
for px in 16 32 128 256 512; do
  sips -z $px $px "$ROOT/tools/lumpbar/icon.png" --out "$ICONSET/icon_${px}x${px}.png" >/dev/null
  sips -z $((px * 2)) $((px * 2)) "$ROOT/tools/lumpbar/icon.png" --out "$ICONSET/icon_${px}x${px}@2x.png" >/dev/null
done
iconutil -c icns "$ICONSET" -o "$APP/Contents/Resources/Lump.icns"
cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleIdentifier</key><string>com.deskbuddy.desklump</string>
  <key>CFBundleName</key><string>Desktop Lump</string>
  <key>CFBundleDisplayName</key><string>Desktop Lump</string>
  <key>CFBundleExecutable</key><string>DesktopLump</string>
  <key>CFBundleIconFile</key><string>Lump</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>LSMinimumSystemVersion</key><string>12.0</string>
  <key>LSUIElement</key><true/>
  <key>NSAppSleepDisabled</key><true/>
</dict></plist>
PLIST
codesign --force --deep --sign - "$APP"

# Point the bridge at him (it re-reads config.json every few seconds while it has no Lump to talk to).
python3 - <<'PY'
import json, os
d = os.path.expanduser("~/.desk-buddy"); p = os.path.join(d, "config.json"); os.makedirs(d, exist_ok=True)
os.chmod(d, 0o700)
try: cfg = json.load(open(p))
except Exception: cfg = {}
if not cfg.get("desktop_lump"):
    cfg["desktop_lump"] = True; json.dump(cfg, open(p, "w"), indent=2); print("set desktop_lump in", p)
PY
# A bridge that's already installed needs the desktop-aware copy of itself.
if [ -f "$HOME/.desk-buddy/bridge.py" ] && ! cmp -s "$ROOT/tools/buddy_bridge.py" "$HOME/.desk-buddy/bridge.py"; then
  cp "$ROOT/tools/buddy_bridge.py" "$HOME/.desk-buddy/bridge.py"
  launchctl kickstart -k "gui/$(id -u)/com.deskbuddy.bridge" 2>/dev/null && echo "bridge updated and restarted"
fi
open "$APP"
echo "Desktop Lump is running from $APP"
echo "Right-click him for options. To connect him to Claude, see tools/desklump/README.md."
