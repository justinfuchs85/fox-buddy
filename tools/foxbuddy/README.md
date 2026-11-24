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

### Updates

Once a day he asks GitHub whether there's a newer release (an anonymous request, with nothing about you
in it). If there is, he mentions it once in his chat the next time you're at the Mac, with **Update**,
**What's new** and **Not now**. Update installs it with Sparkle (it checks the update is signed with the
release key), then restarts him; your settings, notes and connections stay. A build without Sparkle offers
**Download** instead: open the DMG, drag him into Applications and choose **Replace**.
**Setup › Check for Updates…** checks right away. A copy built from source doesn't check by itself.

### Which Claude plan

His chat runs on Claude Code, which needs **Claude Pro, Max** (or a Team, Enterprise or Console account).
On the free plan he still reacts while Claude works in your browser or the Claude app, but his chat,
file search, Gmail, Calendar and the morning check-in don't work. He tells you so when you sign in,
so it doesn't come as a surprise later. On Pro, chatting with him uses the same allowance as claude.ai.

### On a work Mac

Company networks such as Cloudflare Gateway, Zscaler or Netskope often inspect secure traffic using
their own certificate. macOS trusts it, but Claude Code doesn't, so his chat would just hang. He
looks for those certificates in the System keychain, copies them to
`~/.desk-buddy/company-certificates.pem`, and gives that file to Claude Code
(`NODE_EXTRA_CA_CERTS`). You don't need to do anything. If the company network blocks Anthropic
outright, he says so instead of hanging, and IT needs to allow `api.anthropic.com` and `claude.ai`.

## Using him

- **Click** him to tap him. You get a gag. If Claude needs you, it snoozes the nagging. If
  there are unread results, it marks them read. If a meeting alarm is going, it silences it.
- **Drag** him anywhere. By default he snaps into the nearest corner when you let go.
- **Double-click** him to chat. His bubble becomes a little chat window: your messages on the right,
  his replies on the left, each with **Copy**. Follow-ups continue the same conversation until you
  click **New chat**. If you close the bubble while he's thinking, the reply pops it back open.
  After a minute with nothing from you (no typing, clicking, scrolling or mouse over it), the chat
  tucks itself away; double-click him to bring it back where you left off.
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
  - **What He Knows About You**: shows his notes about you in his chat, with an **Edit my notes** button (see [His tools](#his-tools))
  - **Morning Check-In**: check in now, which days, from what time
  - **Meetings**: offer prep before meetings (on or off), **Wrap Up My Day Now**, and when the weekday wrap-up starts (3 to 7 PM, or none)
  - **Look at My Screen**: attaches a picture of your screen to his chat (see [His tools](#his-tools))
  - **Speech Bubble › Recap Long Claude Code Jobs**: on by default
  - **Size**: Small, Medium, Large or Huge
  - **Look**:
    - **Floating** (the default): a light outline with a soft dark halo, so he reads on any wallpaper
    - **Floating, Dark Outline**: looks like a cartoon on paper
    - **On a Dark Tile**: on his own dark rounded square
  - **Move to**: a corner
  - **Float Above Windows**: turn it off to keep him on the desktop, behind your windows
  - **Open at Login**
  - **Setup**: **Set Up Fox Buddy…** (installs or repairs the bridge and Claude Code's hooks, and installs
    Claude Code and signs you in if needed; the downloaded app offers this the first time it opens),
    **Sign In to Claude…** (Claude Code's own sign-in, in your browser; if the page shows a code to paste,
    Claude Code opens in Terminal for it, so the fox never handles your sign-in), **Connect Gmail &
    Calendar…**, **Check Connections**, **Watch the Claude Desktop App** (the Accessibility helper),
    **Browser Extension for claude.ai…**, **Check for Updates…**, and **Report a Problem…** (a new GitHub
    issue filled in with his version, Claude Code's and the end of his log: it shows you what's in it first,
    and nothing is sent unless you post it)
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
| Open files you drop on him | Claude Code's `Read`, for exactly those files (the gate allows each file, not its folder) | That chat only: **New chat**, or the × on a file's chip, takes it away. A picture dragged from a web page is saved in `~/.desk-buddy/drops` first, cleared at launch. |
| Read Reminders, Notes and Shortcuts | His own tools, through `osascript` and Apple's `shortcuts` command | macOS asks once for each app. Off: Setup › Use Reminders, Notes & Shortcuts. Locked notes stay locked. |
| Check your activity | His own tool reads the summary your iPhone saves ([Activity updates](#activity-updates)) | That one folder |
| Use your own tools | Local tool servers you add in `~/.desk-buddy/fox-tools.json` ([Extra tools](#extra-tools)) | Only the tools you list; read-only |
| Answer questions about himself | His own tool, `about_fox_buddy`, returns his guide ([`fox-guide.md`](fox-guide.md)) and your current settings, written by the app to `~/.desk-buddy/settings-now.txt` before each question | When you add or change a feature or a menu item, update `fox-guide.md` too: a test fails if a menu item isn't in it. |
| Search the web | Claude Code's `WebSearch` | He's told never to put your private details in a search |
| Read Gmail | Your claude.ai Gmail connector: search, threads, messages, drafts | Can't send, reply, forward, trash or relabel: those tools are removed |
| Read Google Calendar | Your claude.ai Google Calendar connector: calendars, events, free time | |
| Change your calendar, write Gmail drafts, add or complete a reminder, make a note, run a shortcut | Only after you approve | See below. A shortcut can do anything it's built to do, so its card says so. |
| Remember things about you | Adds a line to his notes | Only after you click **Save it** |
| Look at your screen | Only when you press the screen button in his bubble (or right-click › Look at My Screen): a picture of each display, with him and his bubble hidden for it | Attached to the chat like a dropped file: it goes to Claude only with your next message, and × removes it. macOS asks for Screen Recording the first time. Saved in `~/.desk-buddy/drops`, cleared when he starts. |
| Meeting prep | Every 30 minutes while you're at your Mac, he asks your Calendar connector (on Claude's lightest model) for the next 12 hours of meetings and saves them in `~/.desk-buddy/meetings.json`. About ten minutes before each one he offers **Prep me** | Prep runs only when you click it. With a calendar link in `config.json` (`calendar_ics`), he uses that instead of asking. |
| Recaps | When a Claude Code turn has run 3 minutes or more, the bridge passes what you asked and what Claude said and did (from the session's transcript under `~/.claude`) to Claude's lightest model for a two-sentence summary | Only for your own sessions; his background checks never show up as Claude working. Right-click › Speech Bubble to turn off. |
| Email alerts | Gmail searches he runs every 15 minutes (5, 30, 60 or off: right-click › Email Alerts) while you're at your Mac, on Claude's lightest model to spare your usage | Set up only after you click **Set it up**. New mail only, each email once. Saved in `~/.desk-buddy/email-alerts.json`. |

**Changes need your OK, one exact call at a time.** When you ask for a change ("move my dentist
appointment to Friday at 3"), he looks things up, then proposes one call: which tool, and its exact
arguments. You get a card: *Calendar: Move "Dentist" from Thu 2:00 PM to Fri 3:00 PM*, every argument
under **Exactly what he'll do**, and **Yes, do it** and **No**. If a calendar change names anyone's
email address, the card warns that Google Calendar may email them (an invitation is an email). Gmail
cards say the draft is saved, not sent.

**Yes** lets him make that one call, once, with those arguments: the gate refuses a different tool, any
changed argument (a guest slipped in, say) and a second try. Sending another message cancels a card you
haven't answered.

**Getting acquainted.** The first time he runs (after setup), his bubble asks a few quick questions: what to
call you, what you'd like to call him, how chatty he should be (just the facts, a little wit, or full comedian),
anything about your work, and whether you'd like the morning check-in. Your name and work go in his notes
(in a block of their own); the rest are settings. **Setup › Introduce Yourselves Again…** runs it again.

**Notes about you.** Right-click → **What He Knows About You** shows them in his chat; **Edit my notes** opens `~/.desk-buddy/fox-notes.md`.
Whatever's there goes along with every question (so to Claude too): your name, your role, which
calendar is your work one, who "the team" is. He adds to it himself, with your OK: say "remember that
I prefer meetings after 10" (or tell him something that's clearly worth keeping) and he shows a
**Remember** card; **Save it** adds the line. "Forget that I…" works the same way. He never saves a
note without the card.

**Morning check-in.** On weekdays, the first time you're at your Mac after 8 AM (and before 2 PM), he
opens his bubble with today's meetings, email that looks like it needs you, yesterday's spending and
any budget that's over (with a finance tool of your own), and yesterday's steps (with the activity summary).
It's a fresh chat, so you can ask follow-ups right there. Right-click → **Morning Check-In** for
**Check In Now**, weekdays or every day or off, and the hour it starts. Each check-in is one chat
with Claude, so it counts toward your usage like any other.

**Meeting prep and the wrap-up.** About ten minutes before a meeting (one with a set time, that you
haven't declined), he offers to prep you: click **Prep me** and he looks at the invite and your recent
email with those people or about that topic, in a fresh chat. On weekdays from 5 PM, the first time
you're at your Mac, he **wraps up your day**: email that still needs a reply, tomorrow's first meetings,
and reminders due. Right-click → **Meetings** to change either.

**Settings** (optional, in `~/.desk-buddy/config.json`):

| Setting | Default |
|---|---|
| `fox_folders` | `["~/Desktop", "~/Documents", "~/Downloads"]` |
| `fox_activity_dirs` | iCloud Drive's `Shortcuts/Fox Buddy` folder, and `Fox Buddy` at the top of iCloud Drive |
| `fox_gmail_server`, `fox_calendar_server` | `claude_ai_Gmail`, `claude_ai_Google_Calendar` |

You normally don't need the last two: he finds your Gmail and Google Calendar connectors himself, by asking
Claude Code (`claude mcp list`) shortly after he starts, every few hours, and when you choose **Setup › Check
Connections**. If one isn't set up, or needs signing in again, he tells you so in plain words when you ask
about it, with the fix. The connectors themselves live in your Claude account: **Setup › Connect Gmail &
Calendar…** opens Claude's connector settings.

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

## Extra tools

You can give him tools of your own: anything you can wrap as a small local MCP server (stdio), like a lookup in
an app of yours. List them in `~/.desk-buddy/fox-tools.json`:

```json
{
  "servers": {
    "recipes": {
      "command": "/usr/bin/python3",
      "args": ["/Users/you/tools/recipes_tool.py"],
      "tools": ["search_recipes"],
      "changes": ["add_recipe"],
      "about": "Recipes: the user's saved recipes, by ingredient or name.",
      "act": "accountant"
    }
  }
}
```

- **tools**: the only tools of that server he may use (his tool gate refuses any other). They run without an
  approval card, so list only tools that look things up and never change anything.
- **changes** (optional): that server's tools that do change something. Like a calendar change, each one needs a
  card and your **Yes, do it**, for that one exact call (his card names it `server:tool`, e.g. `recipes:add_recipe`).
- **about** (optional): one line telling him what they're for.
- **act** (optional): the work act he plays while he uses them (right now there's `accountant`).

The file is read at every chat, so a change takes effect on your next question. Whatever those tools return
goes to Claude with the rest of the chat.

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
| `foxtools.py` | His own tools, for Claude Code: find files by name, read your activity summary. Read-only. Also his tool gate. |
| `build.sh` | Bundles the fox, compiles the app, and points the bridge at it. |
