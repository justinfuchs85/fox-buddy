# Homebrew cask for Fox Buddy. The release workflow updates version and sha256 with each release.
#
#   brew tap justinfuchs85/fox-buddy https://github.com/justinfuchs85/fox-buddy
#   brew install --cask justinfuchs85/fox-buddy/fox-buddy
cask "fox-buddy" do
  version "1.1.11"
  sha256 "93e3df1eddfcd529a9d7002ad6a7206f6dd45e0f7cb952474bad8325a9ba38cf"

  url "https://github.com/justinfuchs85/fox-buddy/releases/download/v#{version}/Fox-Buddy-#{version}.dmg"
  name "Fox Buddy"
  desc "Desktop fox who keeps you company while Claude works"
  homepage "https://justinfuchs85.github.io/fox-buddy/"

  livecheck do
    url :url
    strategy :github_latest
  end

  auto_updates true
  depends_on macos: :monterey

  app "Fox Buddy.app"

  uninstall launchctl: ["com.deskbuddy.bridge", "com.deskbuddy.appwatch"],
            quit:      "com.foxbuddy.app"

  zap trash: [
    "~/.desk-buddy",
    "~/Library/LaunchAgents/com.deskbuddy.appwatch.plist",
    "~/Library/LaunchAgents/com.deskbuddy.bridge.plist",
    "~/Library/Preferences/com.foxbuddy.app.plist",
  ]

  caveats <<~EOS
    His chat runs on Claude Code, signed in with a Claude Pro or Max account.
    Open Fox Buddy and choose Set Up when he asks: he installs and signs in to Claude Code for you.
  EOS
end
