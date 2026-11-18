#!/bin/zsh
# Assemble "Fox Buddy.app" in a folder: used by build.sh (for this Mac) and by the release workflow (the download).
#
#   zsh tools/foxbuddy/package.sh <out-dir>
#
# Environment (all optional):
#   VERSION        the app's version (default 1.0)
#   UNIVERSAL=1    build for Apple silicon and Intel Macs both (default: this Mac's kind only)
#   SIGN_IDENTITY  a "Developer ID Application: …" identity (its name or SHA-1) to sign with, hardened runtime
#                  and timestamp, ready for notarizing (default: signed ad hoc, fine on the Mac that built it)
#   TIMESTAMP      codesign's timestamp option (default --timestamp, which notarizing needs; build.sh passes
#                  --timestamp=none, so a build for this Mac works offline)
set -euo pipefail
HERE="${0:A:h}"
ROOT="${HERE:h:h}"
OUT="${1:?usage: package.sh <out-dir>}"
VERSION="${VERSION:-1.0}"
APP="$OUT/Fox Buddy.app"
command -v swiftc >/dev/null || { echo "swiftc not found: run  xcode-select --install"; exit 1; }

BUILD="$(mktemp -d)"
trap 'rm -rf "$BUILD"' EXIT

compile() {   # compile <source> <output>
  if [ "${UNIVERSAL:-0}" = 1 ]; then
    swiftc -O -swift-version 5 -target arm64-apple-macos12.0 "$1" -o "$BUILD/arm64"
    swiftc -O -swift-version 5 -target x86_64-apple-macos12.0 "$1" -o "$BUILD/x86_64"
    lipo -create "$BUILD/arm64" "$BUILD/x86_64" -output "$2"
    rm -f "$BUILD/arm64" "$BUILD/x86_64"
  else
    swiftc -O -swift-version 5 "$1" -o "$2"
  fi
}

rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Helpers" "$APP/Contents/Resources/web/fox" "$APP/Contents/Resources/support/tools"
compile "$HERE/main.swift" "$APP/Contents/MacOS/FoxBuddy"
compile "$ROOT/tools/appwatch/main.swift" "$APP/Contents/Helpers/deskbuddy-appwatch"

# the fox (characters/fox), the desktop player and the speech bubble
RES="$APP/Contents/Resources"
cp "$HERE/web/start.js" "$HERE/web/desktop.js" "$HERE/web/bubble.html" "$RES/web/"
cp "$ROOT/characters/fox/fox.js" "$ROOT/characters/fox/rig.js" "$ROOT/characters/fox/character.js" "$RES/web/fox/"
print -r -- '<!doctype html><meta charset="utf-8"><title>Fox</title><body></body>' > "$RES/web/fox/fox.html"
cp "$HERE/foxtools.py" "$RES/foxtools.py"                 # his own tools, and the gate on every tool call
# what the app installs on the Mac (Setup › Set Up Fox Buddy…): the bridge, Claude Code's hooks, the extension
cp "$ROOT/tools/buddy_bridge.py" "$ROOT/tools/install_hooks.py" "$ROOT/tools/statusline.sh" "$RES/support/tools/"
mkdir -p "$RES/support/browserwatch"
cp "$ROOT/tools/browserwatch/"{manifest.json,background.js,content.js,icon16.png,icon48.png,icon128.png,README.md} "$RES/support/browserwatch/"

ICONSET="$BUILD/FoxBuddy.iconset"; mkdir -p "$ICONSET"
for px in 16 32 128 256 512; do
  sips -z $px $px "$HERE/icon.png" --out "$ICONSET/icon_${px}x${px}.png" >/dev/null
  sips -z $((px * 2)) $((px * 2)) "$HERE/icon.png" --out "$ICONSET/icon_${px}x${px}@2x.png" >/dev/null
done
iconutil -c icns "$ICONSET" -o "$RES/FoxBuddy.icns"
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
  <key>CFBundleShortVersionString</key><string>$VERSION</string>
  <key>CFBundleVersion</key><string>$VERSION</string>
  <key>LSMinimumSystemVersion</key><string>12.0</string>
  <key>LSUIElement</key><true/>
  <key>NSAppSleepDisabled</key><true/>
  <key>NSHumanReadableCopyright</key><string>MIT License. Grew out of desk-buddy, by Joe Bentham.</string>
</dict></plist>
PLIST

if [ -n "${SIGN_IDENTITY:-}" ]; then
  # inside out: the helper, then the app; hardened runtime and a secure timestamp, as notarizing requires
  TS="${TIMESTAMP:---timestamp}"
  codesign --force --options runtime "$TS" --identifier com.deskbuddy.appwatch --sign "$SIGN_IDENTITY" "$APP/Contents/Helpers/deskbuddy-appwatch"
  codesign --force --options runtime "$TS" --sign "$SIGN_IDENTITY" "$APP"
  codesign --verify --strict --deep --verbose=2 "$APP"
else
  codesign --force --deep --sign - "$APP"
fi
echo "packaged $APP ($VERSION$([ "${UNIVERSAL:-0}" = 1 ] && echo ', universal'))"
