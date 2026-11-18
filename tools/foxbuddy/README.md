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
  What he can do in a chat is under [His tools](#his-tools). Chatting needs Claude Code installed and
  signed in with your claude.ai account, and counts towards your Claude usage.

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
  - **What He Knows About You…**: opens his notes file (see [His tools](#his-tools))
  - **Morning Check-In**: check in now, which days, from what time
  - **Size**: Small, Medium, Large or Huge
  - **Look**:
    - **Floating** (the default): a light outline with a soft dark halo, so he reads on any wallpaper
    - **Floating, Dark Outline**: looks like a cartoon on paper
    - **On a Dark Tile**: on his own dark rounded square
  - **Move to**: a corner
  - **Float Above Windows**: turn it off to keep him on the desktop, behind your windows
  - **Open at Login**
  - **Setup**: **Set Up Fox Buddy…** (installs or repairs the bridge and Claude Code's hooks; the downloaded app
    offers this the first time it opens), **Watch the Claude Desktop App** (the Accessibility helper),
    **Browser Extension for claude.ai…**, and **Check for Updates…**
  - **Hide**
  - **Quit**
- Clicks on the empty space around him go through to whatever is underneath.
- If you hide him, open **Fox Buddy** again (from Spotlight, say) to bring him back.

## His tools

Each message runs Claude Code in print mode (`claude -p`) in "don't ask" mode: anything not on the
list below is refused, never prompted for. He has no shell, can't edit, move or delete files, and
never sends email.

**The gate.** Claude Code still loads your own settings, so an allow rule you've added there (for
another connector, say) would otherwise apply to him too. So every tool call in his chats first goes
through his gate, a PreToolUse hook (`foxtools.py --gate`) that the app passes in with `--settings`.
It refuses any tool not on his list, whatever your settings allow, keeps `Read` inside your folders
(symlinks resolved), and lets an approved change through only with exactly the arguments you approved,
and only once. It fails closed: if it can't read its policy, the call is refused. Its policy files live in
`~/.desk-buddy/gate` and are deleted when each reply comes back. If your Claude Code settings switch
hooks off (`disableAllHooks`), he won't chat until you remove that setting.

| He can | How | Limits |
|---|---|---|
| Find files | His own tool (`foxtools.py`) searches by name in Desktop, Documents and Downloads | Names, sizes and dates only. Each file he mentions gets a **Show in Finder** button. |
| Open files | Claude Code's `Read`, limited to the same folders | Off until you click **Files: names only** under the chat (it turns to **Files: can open**). Lasts for that chat only. |
| Check your activity | His own tool reads the summary your iPhone saves ([Activity updates](#activity-updates)) | That one folder |
| Answer money questions | His own tool asks your Fuchs Bucks for transactions, budgets, goals, balances, net worth and debts | Read-only, only once you connect it ([Fuchs Bucks](#fuchs-bucks)) |
| Search the web | Claude Code's `WebSearch` | He's told never to put your private details in a search |
| Read Gmail | Your claude.ai Gmail connector: search, threads, messages, drafts | Can't send, reply, forward, trash or relabel: those tools are removed |
| Read Google Calendar | Your claude.ai Google Calendar connector: calendars, events, free time | |
| Change your calendar, write Gmail drafts | Only after you approve | See below |
| Remember things about you | Adds a line to his notes | Only after you click **Save it** |

**Changes need your OK, one exact call at a time.** When you ask for a change ("move my dentist
appointment to Friday at 3"), he looks things up, then proposes one call: which tool, and its exact
arguments. You get a card: *Calendar: Move "Dentist" from Thu 2:00 PM to Fri 3:00 PM*, every argument
under **Exactly what he'll do**, and **Yes, do it** and **No**. If a calendar change names anyone's
email address, the card warns that Google Calendar may email them (an invitation is an email). Gmail
cards say the draft is saved, not sent.

**Yes** lets him make that one call, once, with those arguments: the gate refuses a different tool, any
changed argument (a guest slipped in, say) and a second try. Sending another message cancels a card you
haven't answered.

**Notes about you.** Right-click → **What He Knows About You…** opens `~/.desk-buddy/fox-notes.md`.
Whatever's there goes along with every question (so to Claude too): your name, your role, which
calendar is your work one, who "the team" is. He adds to it himself, with your OK: say "remember that
I prefer meetings after 10" (or tell him something that's clearly worth keeping) and he shows a
**Remember** card; **Save it** adds the line. "Forget that I…" works the same way. He never saves a
note without the card.

**Morning check-in.** On weekdays, the first time you're at your Mac after 8 AM (and before 2 PM), he
opens his bubble with today's meetings, email that looks like it needs you, yesterday's spending and
any budget that's over (with Fuchs Bucks connected), and yesterday's steps (with the activity summary).
It's a fresh chat, so you can ask follow-ups right there. Right-click → **Morning Check-In** for
**Check In Now**, weekdays or every day or off, and the hour it starts. Each check-in is one chat
with Claude, so it counts toward your usage like any other.

**Settings** (optional, in `~/.desk-buddy/config.json`):

| Setting | Default |
|---|---|
| `fox_folders` | `["~/Desktop", "~/Documents", "~/Downloads"]` |
| `fox_activity_dirs` | iCloud Drive's `Shortcuts/Fox Buddy` folder, and `Fox Buddy` at the top of iCloud Drive |
| `fox_gmail_server`, `fox_calendar_server` | `claude_ai_Gmail`, `claude_ai_Google_Calendar` |
| `fuchs_bucks_url` | none (set by `connect_fuchs_bucks.sh`) |

The last two must match what Claude Code calls your connectors. Run `claude mcp list` and look for
the Gmail and Google Calendar lines: `claude.ai Gmail` becomes `claude_ai_Gmail` (dots and spaces
turn into `_`). If he says he can't reach Gmail or your calendar, this is the first thing to check.
The connectors themselves come from claude.ai (Settings → Connectors), not from this app.

**macOS will ask once** whether Fox Buddy may access your Desktop, Documents and Downloads folders
(and iCloud Drive, for the activity summary). Allow it. Because the app is signed on your Mac rather
than by a developer account, a rebuild can make macOS ask again.

**What leaves your Mac.** File names he finds, anything he opens, email and calendar details he
reads, your activity summary when he checks it, and your notes all go to Claude as part of the chat,
under your claude.ai account's privacy settings. Claude Code also keeps a copy of each chat on your
Mac, in `~/.claude/projects`. Fox Buddy deletes his chats from there when you click **New chat** and
each time the app starts.

**Untrusted content.** Emails, files and web pages can contain text written to trick an assistant. He's
told never to follow instructions found in them, he can't fetch web pages, and he can't change
anything without your OK, but read a card before you click **Yes**.

## Fuchs Bucks

He can answer questions like "how much did we spend on dining out last month?" or "how's the emergency
fund coming along?" from your Fuchs Bucks ledger. He uses the same seven read-only lookups as Fuchs
Bucks' own Insights chat, through its `/api/fox` route, and can't change anything there.

1. Fuchs Bucks needs the `/api/fox` route (the `fox-buddy-read-access` change in personal-ledger).
2. On your Mac: `zsh tools/foxbuddy/connect_fuchs_bucks.sh`. It makes a random access token, keeps it in
   your Keychain ("Fox Buddy: Fuchs Bucks"), and prints its SHA-256 fingerprint.
3. In Vercel, add `FOX_TOKEN_SHA256` (that fingerprint) and `FOX_USER_EMAIL` (your Fuchs Bucks login)
   to the Fuchs Bucks project for Production, and redeploy. He sees what that login sees, scoped to
   your household.

To turn it off: `zsh tools/foxbuddy/connect_fuchs_bucks.sh --disconnect`, and remove
`FOX_TOKEN_SHA256` in Vercel. Without both settings the route acts as if it doesn't exist. What he looks
up goes to Claude with the rest of the chat, like everything else he reads.

## Activity updates

The Claude iPhone app's Apple Health sync doesn't reach the Mac, so the fox gets your activity from a
small iPhone Shortcut that saves a summary to iCloud Drive each day. This is a first version: if an
action on your iPhone doesn't match these names, say so and I'll adjust the steps.

In the Shortcuts app on your iPhone, make a new shortcut called **Fox Activity**:

1. **Find Health Samples**: Type is **Steps**, Start Date is in the last **7 days**, Group by **Day**,
   sort by Start Date, oldest first.
2. **Repeat with Each** item from step 1. Inside it, add **Text** with:
   `Steps on [Repeat Item › Start Date]: [Repeat Item › Value]` (tap the variable to pick its property),
   then **Add to Variable** called `Summary`.
3. Do steps 1 and 2 again for **Active Energy** and **Exercise Minutes** (and anything else you'd like
   him to know about), adding to the same `Summary` variable.
4. **Save File**: the `Summary` variable, **Ask Where to Save** off, Destination Path
   `Fox Buddy/activity.txt`, **Overwrite If File Exists** on. That saves it to iCloud Drive →
   Shortcuts → Fox Buddy, which is where he looks.
5. Run it once by hand and allow Health access.

Then, under **Automation**, add a **Time of Day** automation that runs **Fox Activity** daily, set to
run without asking. iOS only lets Shortcuts read Health data while the phone is unlocked, so pick a
time you're usually using your phone, or just run it before you ask him.

## Files

| Path | What it is |
|---|---|
| `main.swift` | The app: the transparent window, clicks and dragging, the menu, the speech bubble and chat, and the socket the bridge connects to. |
| `web/start.js` | Sets up the transparent page before the fox's scripts load. |
| `web/desktop.js` | The player: sequencing, the bridge's commands, the corner counts and the offline mode. |
| `web/bubble.html` | The speech bubble and chat window. |
| `icon.png` | The app icon, rendered from the fox's own rig. |
| `foxtools.py` | His own tools, for Claude Code: find files by name, read your activity summary, look things up in Fuchs Bucks. Read-only. |
| `connect_fuchs_bucks.sh` | Connects (or disconnects) Fuchs Bucks: a token in your Keychain, its fingerprint for Vercel. |
| `build.sh` | Bundles the fox, compiles the app, and points the bridge at it. |
