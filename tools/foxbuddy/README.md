# Fox Buddy (the Mac app)

The fox lives in a corner of your Mac's screen. He works while Claude works, waves when it needs
you, celebrates when it finishes, reacts when you click him, and chats with you.

He's drawn live, in code, by his own rig (`characters/fox`), so he's sharp at any size. To the
bridge he looks like a small device: the app listens on `127.0.0.1:4210` and the bridge sends it
one-line commands (moods, the usage colour, the meeting countdown, the corner counts, the Slack
letter, narration for his speech bubble).

## Build it

You need the Xcode command line tools (`xcode-select --install`).

```bash
zsh tools/foxbuddy/build.sh
```

That builds `~/Applications/Fox Buddy.app` and opens it. He starts in the bottom-right corner.
On his own, without the bridge, he idles and fidgets, and sleeps at night.

## Connect him to Claude

Do this once, from the top of the repo:

```bash
tools/install_bridge.sh            # the bridge and the Chat/Cowork watcher, as login items
                                   # (add --no-appwatch if you use claude.ai in a browser instead)
python3 tools/install_hooks.py     # Claude Code's hooks and status line
```

`build.sh` already set `"desktop_lump": true` in `~/.desk-buddy/config.json` (a setting name kept
from the project Fox Buddy grew out of). That tells the bridge to talk to the app. He connects within
a few seconds. Start a Claude Code session and he wakes up. Right-click him and the top line says
whether he's connected.

The Chat/Cowork watcher needs Accessibility permission (**System Settings → Privacy & Security →
Accessibility → deskbuddy-appwatch**). Calendar and Slack settings: see the main README.

Using claude.ai in Chrome or Safari instead of the desktop app? Load the extension in
[`tools/browserwatch`](../browserwatch/README.md) and he reacts to browser chats too.

## Using him

- **Click** him to tap him. You get a gag. If Claude needs you, it snoozes the nagging. If
  there are unread results, it marks them read. If a meeting alarm is going, it silences it.
- **Drag** him anywhere. By default he snaps into the nearest corner when you let go.
- **Double-click** him to chat. His bubble becomes a little chat window: your messages on the right,
  his replies on the left, each with **Copy**. Follow-ups continue the same conversation until you
  click **New chat**. If you close the bubble while he's thinking, the reply pops it back open.
  Replies come from Claude Code in print mode with every tool switched off (`claude -p --tools ""`),
  so he can only talk, never run anything or touch your files. Each message continues the
  conversation (`--session-id`, then `--resume`). Claude Code keeps these conversations in
  `~/.desk-buddy/ask`, apart from your projects. Chatting needs Claude Code installed and signed in,
  and counts towards your Claude usage.

  For bigger jobs, click **Open in Claude** (or press ⌘-Return). That opens a new chat in Claude
  Desktop with the whole conversation so far filled in, plus anything you'd typed, ready for you to
  send. It uses Claude's `claude://claude.ai/new?q=` link, and falls back to claude.ai in your
  browser without Claude Desktop. The same link appears while he's thinking ("Taking a while?").
- **His speech bubble** says what Claude is doing: "fox-buddy: Running `npm test`", "needs your
  permission to use Bash", and "done: …" with the first line of Claude's reply. Click **Show me** to
  bring that session forward. For Claude Code that's the terminal app it runs in (iTerm, Terminal,
  VS Code, Warp, Ghostty and so on); for claude.ai it's the right browser tab (through the browser
  extension); for the Claude desktop app, it's the app. Right-click → **Speech Bubble** sets how much
  he says: everything, only when Claude needs you or finishes, or nothing.

  If you set up the hooks before this feature, re-run `python3 tools/install_hooks.py` once. It
  updates them so the bridge knows which terminal each session is in.
- **Right-click** for:
  - **Gags** and **Clips**: play any of them on demand
  - **Show Off**: cycles through every mood
  - **Size**: Small, Medium, Large or Huge
  - **Look**:
    - **Floating** (the default): a light outline with a soft dark halo, so he reads on any wallpaper
    - **Floating, Dark Outline**: looks like a cartoon on paper
    - **On a Dark Tile**: on his own dark rounded square
  - **Move to**: a corner
  - **Float Above Windows**: turn it off to keep him on the desktop, behind your windows
  - **Open at Login**
  - **Hide**
  - **Quit**
- Clicks on the empty space around him go through to whatever is underneath.
- If you hide him, open **Fox Buddy** again (from Spotlight, say) to bring him back.

## Files

| Path | What it is |
|---|---|
| `main.swift` | The app: the transparent window, clicks and dragging, the menu, the speech bubble and chat, and the socket the bridge connects to. |
| `web/start.js` | Sets up the transparent page before the fox's scripts load. |
| `web/desktop.js` | The player: sequencing, the bridge's commands, the corner counts and the offline mode. |
| `web/bubble.html` | The speech bubble and chat window. |
| `icon.png` | The app icon, rendered from the fox's own rig. |
| `build.sh` | Bundles the fox, compiles the app, and points the bridge at it. |
