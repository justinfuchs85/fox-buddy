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

## Each release

```bash
git tag v1.0.0 && git push origin v1.0.0
```

About 10 minutes later the release is on the Releases page with `Fox-Buddy-1.0.0.dmg` and `.zip`. For a test
build without a release: Actions › Release › Run workflow (the files are on the run's page, under Artifacts).

Mac runners count 10× against GitHub's free Actions minutes on a private repo (2,000 a month on the free plan,
so about 200 Mac minutes): a release takes roughly 10 to 15 of those.

## Who can download it

Releases of a private repository are visible only to people with access to it. To share with a friend, add them
as a collaborator (Settings › Collaborators), or make the repository public.

## What the download does on a new Mac

The first time it opens, it offers to set itself up (right-click › Setup › Set Up Fox Buddy… does the same
later): it installs the bridge as a login item in `~/.desk-buddy`, running on macOS's own Python, and adds
Claude Code's hooks and status line (`~/.claude/settings.json`, backed up first). It needs Apple's command line
tools for that Python, and offers to install them if they're missing. The Claude-app watcher (Accessibility) and
the browser extension are optional, under Setup. Opening a newer version updates the bridge by itself.
