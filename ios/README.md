# Fox Buddy for iPhone

A companion to the fox on your Mac. When you're away from the Mac, his alerts come to your phone (Claude needs
you or is done, a print finished or failed, a release shipped, a site went down, an important email), and a
print in progress (or a long Claude job) sits on your Lock Screen and in the Dynamic Island as a Live Activity.
Open the app and he's there, animated, with the latest alerts.

It isn't a second fox: everything still happens on your Mac. The phone hears about it through a small relay
(`relay/`), and alert text is encrypted on the Mac with a key only your phone has.

## Once: three things from your Apple Developer account

1. **Your Team ID.** developer.apple.com › Account › Membership details. Put it in `ios/Signing.xcconfig` as
   `DEVELOPMENT_TEAM`. Keep `BUNDLE_PREFIX = com.foxbuddy` unless that's taken for you; the app becomes
   `com.foxbuddy.phone`.
2. **A push key (.p8).** developer.apple.com › Certificates, IDs & Profiles › Keys › **+**, name it
   "Fox Buddy push", tick **Apple Push Notifications service (APNs)**, Continue, Register, **Download**
   (you only get to download it once). Note its **Key ID**.
3. **Give the relay the key.** In the Supabase dashboard, open the Fuchs Labs project › Edge Functions ›
   Secrets (or Project Settings › Edge Functions), and add:

   | Name | Value |
   |---|---|
   | `APNS_KEY_P8` | the whole text of the .p8 file, including the BEGIN and END lines |
   | `APNS_KEY_ID` | the Key ID from step 2 |
   | `APNS_TEAM_ID` | your Team ID |
   | `APNS_TOPIC` | `com.foxbuddy.phone` (your `BUNDLE_PREFIX` + `.phone`) |

   Then put the .p8 in your password manager and delete the download.

## Build it onto your phone

```sh
brew install xcodegen          # once
cd ios && xcodegen && open FoxBuddyPhone.xcodeproj
```

In Xcode: plug in your iPhone (or pick it from the device list if it's on the same Wi-Fi), choose the
**FoxBuddy** scheme, and press ▶. The first time, Xcode registers the app ids, the app group and push for
you (Signing & Capabilities shows it); your iPhone may ask you to turn on Developer Mode (Settings › Privacy &
Security › Developer Mode).

A build from Xcode talks to Apple's *sandbox* push servers; the app tells the relay which, so nothing to set.

## Pair it

1. On the Mac: right-click the fox › **iPhone** › **Pair iPhone…**. A QR code appears.
2. Point the iPhone's Camera at it and tap the link. Fox Buddy opens, asks to send notifications: **Allow**.
3. On the Mac: **iPhone** › **Send a Test Alert**. It should land on your phone with his picture.

**Only When I'm Away** (on by default) sends alerts only when the Mac's been untouched for 3 minutes or its
screen is locked, so your phone doesn't buzz for things you're already looking at. Live Activities for prints
show either way; a long Claude job shows only while you're away.

## Your family's phones (TestFlight)

Xcode › Product › **Archive** › Distribute App › **TestFlight & App Store** (it's fine: TestFlight builds don't
go on the App Store). In App Store Connect › your app › TestFlight, add family members as **internal testers**
(they need to be on your team, or use an external group with a public link). They install TestFlight from the
App Store and get Fox Buddy there. Builds expire after 90 days, so archive a fresh one now and then. TestFlight
builds use Apple's production push servers; again, the app tells the relay.

Each Mac pairs with one phone. Someone with their own Mac and fox pairs their own phone the same way.

## What goes through the relay

| | Encrypted? |
|---|---|
| Alert text ("Done printing Cable clip…") | Yes, AES-256-GCM with a key made on your Mac and passed to the phone in the QR code. The relay and Apple only see "Something new from your fox." until the phone unlocks it. |
| Live Activity status ("Printing Cable clip", 62%, "Layer 80 of 200") | No: iOS draws Live Activities straight from the push, with no chance to decrypt. So the Mac keeps them to that. |
| Pairing | The relay stores a hash of the pair secret and your phone's push tokens. Unpair (on either side) deletes them. |

## The parts

- `App/`: the app: pairing (the `foxbuddy://pair` link), push registration, the alert list, and the fox
  himself (`fox.html` plays the same drawing code as the Mac, from `characters/fox`).
- `Widgets/`: the Live Activity (Lock Screen and Dynamic Island). Its poses are pictures drawn from that
  code by `tools/render-poses.js`, since Live Activities can't run animation.
- `Notify/`: a notification service extension that decrypts each alert before iOS shows it.
- `Shared/`: what all three share, including `FoxActivityAttributes`, which must match what the relay sends.
