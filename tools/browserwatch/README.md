# Fox Buddy for claude.ai (Chrome and Safari extension)

This lets the fox react to Claude in a Chrome or Safari tab: he works while a chat is responding, waves when
it needs your permission, and celebrates when it's done. It does the same job `tools/appwatch`
does for the Claude desktop app, but for claude.ai in the browser.

## What it sends

On each claude.ai tab, the extension reads a few short labels: buttons like "Stop response",
"Allow once" and "Deny", live status text like "Claude is responding", and short status phrases.
It sends those to the bridge on this Mac (`127.0.0.1:47823/browser`), naming each chat by the
first 8 characters of the ID in its address ("chat 1a2b3c4d"), never by its title. It never sends
message text, and nothing leaves your computer. The bridge's existing rules decide
what the labels mean (`AppPages` in `tools/buddy_bridge.py`), so if claude.ai changes its
wording, the fix goes in the bridge, not here.

## Install in Chrome

1. Make sure the bridge is up to date. Run `zsh tools/foxbuddy/build.sh` (it updates an installed
   bridge) or `tools/install_bridge.sh`.
2. In Chrome, open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and pick this folder (`tools/browserwatch`).
4. Reload any claude.ai tabs you already have open.

To check it's working, run `curl -s 127.0.0.1:47823/status`. While a claude.ai tab is open, it
shows a recent `browser_watcher` report and `web:chat <id>` sessions.

## Install in Safari

The same folder works in Safari 18.4 or later, with no Xcode needed. The catch is that Safari
treats an extension loaded this way as temporary: it removes it when you quit Safari, or after
24 hours.

1. Make sure the bridge is up to date (see step 1 above).
2. **Safari → Settings → Advanced**: turn on **Show features for web developers**.
3. **Safari → Settings → Developer**: click **Add Temporary Extension…** and pick this folder
   (`tools/browserwatch`). Approve the prompt about unsigned extensions.
4. Safari asks what the extension may access. Allow it on **claude.ai**. If Safari asks about
   **127.0.0.1**, allow that too: it's the bridge on this Mac.
5. Reload any claude.ai tabs.

To keep it installed for good, Safari needs it wrapped in a small Mac app, built with the full
Xcode (free from the App Store, not just the command line tools).


- Chats show up as their own sessions (`web:...`), next to the desktop app's (`app:...`) and
  Claude Code's, and they all feed the same mood.
- Looking at the tab counts as seeing the result, the same as having the chat open in the
  desktop app. The fox stops bugging you about it once you do.
- After a few minutes in the background, Chrome slows a tab's timers to about once a minute.
  Page changes still get through, so a finished answer is usually noticed right away. At worst,
  it takes up to a minute.
- If your browser is managed by work IT, they may block Developer mode or unpacked extensions.
  If so, use the Claude desktop app instead, which `tools/appwatch` covers.
