# Releasing Fox Buddy

The download is built by GitHub Actions (`.github/workflows/release.yml`) on a Mac runner: a universal app
(Apple silicon and Intel), signed with your Developer ID, notarized by Apple and stapled, as a `.dmg` and a `.zip`.

## Once: signing secrets

You need an Apple Developer Program membership (you're the Account Holder, so you can make these).

1. **Developer ID Application certificate.** Xcode › Settings › Accounts › your team › Manage Certificates ›
   **+** › Developer ID Application. Then in Keychain Access, find "Developer ID Application: …", right-click ›
   Export, save as `fox-buddy.p12` with a password.
2. **Notarizing.** The simplest way: an **app-specific password** for your Apple ID. At
   [account.apple.com](https://account.apple.com) › Sign-In and Security › App-Specific Passwords › **+**,
   name it "Fox Buddy notarizing", and copy the password it shows (once).

   (Or an App Store Connect API key: App Store Connect › Users and Access › Integrations › App Store Connect API
   › Team Keys › **+**, access "Developer". Integrations only appears for the team's Account Holder or an Admin,
   and the Account Holder must click Request Access there first. Use its secrets below instead.)
3. **Add them to the repo** (Terminal, in your fox-buddy folder; `gh` asks for each value it doesn't get piped):

   ```bash
   base64 -i fox-buddy.p12 | gh secret set MACOS_CERT_P12
   gh secret set MACOS_CERT_PASSWORD          # the .p12's password
   # notarizing with your Apple ID:
   gh secret set NOTARY_APPLE_ID              # the Apple ID of your developer account
   gh secret set NOTARY_PASSWORD              # the app-specific password
   gh secret set NOTARY_TEAM_ID               # your Team ID: the code in brackets in "Developer ID Application: … (XXXXXXXXXX)"
   # ...or with an API key instead:
   # gh secret set NOTARY_KEY_P8 < AuthKey_XXXXXXXXXX.p8; gh secret set NOTARY_KEY_ID; gh secret set NOTARY_ISSUER_ID
   ```

   Then delete the `.p12` and keep the `.p8` somewhere safe (a password manager), not in the repo.

## Once: the update key (one-click updates)

Sparkle, the updater inside the app, only installs an update signed with your key, so nobody else can push
one to people's Macs. Make the key on your Mac (it's kept in your login keychain) and give GitHub a copy:

```bash
mkdir -p /tmp/sparkle && curl -fsSL https://github.com/sparkle-project/Sparkle/releases/download/2.9.4/Sparkle-2.9.4.tar.xz | tar -xJ -C /tmp/sparkle
/tmp/sparkle/bin/generate_keys                                  # makes the key, prints its public half
/tmp/sparkle/bin/generate_keys -x ~/Desktop/fox-buddy-update-key.txt
gh secret set SPARKLE_PRIVATE_KEY -R justinfuchs85/fox-buddy < ~/Desktop/fox-buddy-update-key.txt
```

Without `gh`: open that file, copy its one line, and paste it as a new secret named `SPARKLE_PRIVATE_KEY`
(Settings › Secrets and variables › Actions). Save the file in your password manager, then delete it.
**Don't lose this key:** a release signed with a different one won't install over the old version.

From the next release on, the app has one-click updates, and each release has an `appcast.xml` (the update
feed Sparkle reads, at `releases/latest/download/appcast.xml`). Until the secret is set, releases build
without Sparkle, and his update notice offers the DMG instead.

## Once: the website

Settings › Pages › Build and deployment › Source: **GitHub Actions**. After that, any change to `docs/` or the
fox's drawing code publishes https://justinfuchs85.github.io/fox-buddy/ (the Website workflow).

## Each release

```bash
zsh ship.sh            # or /foxship in Claude Code, opened in this folder
```

It checks you're on an up-to-date, clean `main`, lists what changed since the last release, picks the next
version (`1.0.4` after `1.0.3`; `zsh ship.sh minor`, `major` or `1.2.3` for others), asks, then tags and pushes
it. That's the same as doing it by hand:

```bash
git pull && git tag v1.0.4 && git push origin v1.0.4
```

About 10 minutes later the release is on the Releases page with `Fox-Buddy-1.0.0.dmg`, `.zip`, `Fox-Buddy.dmg`
(the same DMG under a name that never changes, for links) and `appcast.xml`. The workflow then points the
Homebrew cask (`Casks/fox-buddy.rb`) at the new version, in a commit of its own on `main`.

### From a browser (no Terminal)

On GitHub: **Actions › Release › Run workflow**. Leave *Use workflow from* on `main`, type `ship` in the
confirm box, and leave the version box empty for the next small version (or type `minor`, `major` or `1.2.3`).
Click **Run workflow**. It runs the same build, and only once everything has passed does it make the tag and
the release, so a failed build leaves nothing behind. It ships whatever is on `main` at that moment.

Run it with the confirm box empty for a test build without a release (the files are on the run's page, under
Artifacts).

Mac runners count 10× against GitHub's free Actions minutes on a private repo (2,000 a month on the free plan,
so about 200 Mac minutes): a release takes roughly 10 to 15 of those.

## Who can download it

Anyone: the repository is public. Point people at https://justinfuchs85.github.io/fox-buddy/.

## What the download does on a new Mac

The first time it opens, it offers to set itself up (right-click › Setup › Set Up Fox Buddy… does the same
later): it installs the bridge as a login item in `~/.desk-buddy`, running on macOS's own Python, and adds
Claude Code's hooks and status line (`~/.claude/settings.json`, backed up first). It needs Apple's command line
tools for that Python, and offers to install them if they're missing. The Claude-app watcher (Accessibility) and
the browser extension are optional, under Setup. Opening a newer version updates the bridge by itself.
