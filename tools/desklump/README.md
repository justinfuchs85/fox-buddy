# Desktop Lump

Lump without the hardware: he lives in a corner of your Mac's screen, Clippy-style, and does
everything the desk Lump does. He works while Claude works, waves when it needs you, celebrates
when it finishes, reacts when you click him, and plays all of the clips in `design/clips`.

He isn't a recording. The app draws him live from `design/lump.html`, `design/clip_kit.js` and
every clip script, so he's sharp at any size and a new clip shows up the next time you build.
To the bridge he looks like a board: the app listens on `127.0.0.1:4210` and speaks the board's
protocol (`web/desktop.js` is a port of the player in `firmware/src/main.cpp`). So moods, the
usage colour, the meeting countdown, the corner counts, the gag sounds, the Slack letter and the
bridge's automatic clips all work as they do on the desk.

## Build it

You need the Xcode command line tools (`xcode-select --install`). You don't need Chrome or a bake step.

```bash
zsh tools/desklump/build.sh
```

That builds `~/Applications/Desktop Lump.app` and opens it. He starts in the bottom-right corner.
On his own, without the bridge, he just sleeps and fidgets, and sleeps under his blanket at night.

## Connect him to Claude

Do this once, from the top of the repo:

```bash
tools/install_bridge.sh            # the bridge and the Chat/Cowork watcher, as login items
                                   # (add --no-appwatch if you use claude.ai in a browser instead)
python3 tools/install_hooks.py     # Claude Code's hooks and status line
```

`build.sh` already set `"desktop_lump": true` in `~/.desk-buddy/config.json`. That tells the
bridge to look for him before it looks for a board. He connects within a few seconds. Start a
Claude Code session and he wakes up. Right-click him and the top line says whether he's connected.

The Chat/Cowork watcher needs Accessibility permission (**System Settings → Privacy & Security →
Accessibility → deskbuddy-appwatch**). Calendar, Slack and sound settings are the same as for the
desk Lump: see the main README.

Using claude.ai in Chrome or Safari instead of the desktop app? Load the extension in
[`tools/browserwatch`](../browserwatch/README.md) and he reacts to browser chats too.

## Using him

- **Click** him to tap the glass. You get a gag. If Claude needs you, it snoozes the nagging. If
  there are unread results, it marks them read. If a meeting alarm is going, it silences it.
- **Drag** him anywhere. By default he snaps into the nearest corner when you let go.
- **Right-click** for:
  - **Gags** and **Clips**: play any of them on demand
  - **Show Off**: cycles through every mood
  - **Character**: Lump, or the [fox](../../characters/fox/README.md)
  - **Size**: Small, Medium, Large or Huge
  - **Look**:
    - **Floating** (the default): a light outline with a soft dark halo, so he reads on any wallpaper
    - **Floating, Dark Outline**: looks like a cartoon on paper
    - **Glass Screen**: the black prism, exactly like the desk Lump
  - **Move to**: a corner
  - **Float Above Windows**: turn it off to keep him on the desktop, behind your windows
  - **Open at Login**
  - **Hide**
  - **Quit**
- Clicks on the empty space around him go through to whatever is underneath.
- If you hide him, open **Desktop Lump** again (from Spotlight, say) to bring him back.

## Files

| Path | What it is |
|---|---|
| `main.swift` | The app: the transparent window, clicks and dragging, the menu, and the socket the bridge connects to. |
| `web/start.js` | Runs before `lump.html` and switches off its design gallery, keeping only the drawings. |
| `web/desktop.js` | The player: the board's sequencing, the protocol, the corner counts and the offline mode. |
| `build.sh` | Bundles the drawings and clips, compiles the app, and points the bridge at it. |

## Credit

Lump was created by [Joe Bentham](https://github.com/joebentham/desk-buddy). The character, drawings,
animations and sounds are CC BY-NC 4.0 (see `LICENSE-ART.md`). That covers personal use and
sharing with credit, but not commercial use.
