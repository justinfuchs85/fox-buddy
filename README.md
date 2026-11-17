# Fox Buddy

<img src="tools/foxbuddy/icon.png" alt="Fox Buddy's icon: a little orange fox" width="160" align="right">

A little fox who lives in a corner of your Mac's screen and keeps an eye on Claude for you,
Clippy-style. He works while Claude works, waves when it needs you, celebrates when it finishes,
and you can chat with him.

## What he does

- **Shows what Claude is doing**, across Claude Code, the Claude desktop app (Chat and Cowork) and
  claude.ai in Chrome or Safari. While Claude works he rotates through three acts: accountant (green
  visor, adding machine), typewriter, and mad scientist. Small counters show how many sessions are
  working, waiting on you, or done.
- **Talks in a speech bubble**: "Running `npm test`", "needs your permission to use Bash", "done: …".
  **Show me** brings that session forward: the terminal, the browser tab or the Claude app.
- **Chats and helps**: double-click him to ask a question. He can find files by name in Desktop,
  Documents and Downloads (and open them if you let him), read your Gmail and Google Calendar, search
  the web, check your iPhone activity summary, and answer money questions from Fuchs Bucks. He changes your calendar or writes a Gmail draft
  only after you click **Yes, do it**, and never sends email. Bigger jobs go to Claude Desktop with
  **Open in Claude**. Details: [His tools](tools/foxbuddy/README.md#his-tools).
- **Gags**: click him for one of 14 (pounce, tail chase, zoomies, floss, dab, dubstep and more), or
  pick one from the right-click menu.
- **Extras**: goes from orange toward red as you near your Claude usage limits, holds a ringing clock
  before meetings, holds up a letter for a Slack VIP, and sleeps at night. He's silent.

## Set him up

You need a Mac with the Xcode command line tools (`xcode-select --install`), Python 3 and Claude Code.

```bash
git clone https://github.com/justinfuchs85/fox-buddy.git
cd fox-buddy
zsh tools/foxbuddy/build.sh        # builds ~/Applications/Fox Buddy.app and opens it
tools/install_bridge.sh            # the bridge (and the Claude-app watcher), as login items
                                   #   add --no-appwatch if you use claude.ai in a browser instead
python3 tools/install_hooks.py     # Claude Code's hooks and status line
```

Using claude.ai in a browser? Load the extension in [`tools/browserwatch`](tools/browserwatch/README.md).
More on the app, the menu and the chat: [`tools/foxbuddy/README.md`](tools/foxbuddy/README.md).

To update later: `git pull && zsh tools/foxbuddy/build.sh`.

## Calendar and Slack

The bridge picks up changes to `~/.desk-buddy/config.json` as you make them.

| Setting | What it does |
|---|---|
| `calendar_ics` | A private iCal URL. He holds up a ringing clock over the 10 minutes before a meeting. |
| `my_email` | Lets the calendar skip meetings you've declined. |
| `slack_token` | A Slack user token (`xoxp-…`) from your own Slack app. The read-only scopes are `im:read`, `im:history`, `mpim:read`, `mpim:history`, `users:read` and `search:read`. |
| `slack_vips` | Names as they appear in Slack. He holds up a letter while a DM from one of them is unread. |

For a second Claude Code profile, run `python3 tools/install_hooks.py --config-dir ~/.claude-work`.

## What's in here

| Path | What it is |
|---|---|
| `tools/foxbuddy` | The Mac app: window, menu, speech bubble, chat, his tools, and the socket the bridge talks to |
| `characters/fox` | The fox: drawn entirely in code by his own rig |
| `tools/buddy_bridge.py` | The bridge: turns Claude's activity into his moods (a login item, on `127.0.0.1:47823`) |
| `tools/install_hooks.py`, `tools/statusline.sh` | Claude Code hooks and the usage status line |
| `tools/appwatch` | Reads Chat and Cowork activity from the Claude desktop app (needs Accessibility) |
| `tools/browserwatch` | Chrome and Safari extension for claude.ai |
| `tests` | The bridge's tests: `python3 -m unittest discover -s tests` |

The bridge and the app only listen on `127.0.0.1`, the app's own window makes no internet requests,
and the browser extension sends labels like "Stop response", never message text. His chats go to
Claude through Claude Code, with whatever he looks up for you: see
[what leaves your Mac](tools/foxbuddy/README.md#his-tools).

## Credit

Fox Buddy grew out of [desk-buddy](https://github.com/csimpkins22/desk-buddy), based on
[Joe Bentham's](https://github.com/joebentham/desk-buddy) Lump. The bridge, hooks and watchers
started there. Fox Buddy has none of Lump's art: the fox, his drawings and the app are new. MIT
licensed: see `LICENSE`.
