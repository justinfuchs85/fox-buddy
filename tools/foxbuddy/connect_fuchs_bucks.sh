#!/bin/zsh
# Connect Fox Buddy to Fuchs Bucks, read-only, so you can ask him about your money.
#
#   zsh tools/foxbuddy/connect_fuchs_bucks.sh [https://fuchsbucks.com]
#   zsh tools/foxbuddy/connect_fuchs_bucks.sh --disconnect
#
# Makes a new random access token and keeps it in your Keychain ("Fox Buddy: Fuchs Bucks"). Fuchs Bucks
# only ever gets its SHA-256 fingerprint (the FOX_TOKEN_SHA256 setting), so the token itself never
# leaves this Mac except in his lookups. Running this again replaces the token: the old one stops working
# once you update FOX_TOKEN_SHA256.
set -euo pipefail
SERVICE="Fox Buddy: Fuchs Bucks"
CONFIG="$HOME/.desk-buddy/config.json"

set_url() {   # $1: the URL, or "" to remove it
  mkdir -p "$HOME/.desk-buddy"; chmod 700 "$HOME/.desk-buddy"
  python3 - "$CONFIG" "$1" <<'PY'
import json, os, sys
path, url = sys.argv[1], sys.argv[2]
try: cfg = json.load(open(path))
except Exception: cfg = {}
if url: cfg["fuchs_bucks_url"] = url
else: cfg.pop("fuchs_bucks_url", None)
json.dump(cfg, open(path, "w"), indent=2)
PY
}

if [ "${1:-}" = "--disconnect" ]; then
  security delete-generic-password -s "$SERVICE" >/dev/null 2>&1 || true
  set_url ""
  echo "Disconnected: the token is gone from your Keychain and he no longer looks at Fuchs Bucks."
  echo "Also remove FOX_TOKEN_SHA256 from the Fuchs Bucks project in Vercel, then redeploy."
  exit 0
fi

URL="${1:-https://fuchsbucks.com}"
URL="${URL%/}"
[[ "$URL" == https://* ]] || { echo "Use the https:// address of your Fuchs Bucks."; exit 1; }

TOKEN="$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')"
security add-generic-password -U -s "$SERVICE" -a "fuchs-bucks" -l "$SERVICE" -w "$TOKEN"
HASH="$(printf %s "$TOKEN" | shasum -a 256 | cut -d' ' -f1)"
unset TOKEN
set_url "$URL"

cat <<EOF

Saved a new access token in your Keychain, and pointed Fox Buddy at $URL.

Now tell Fuchs Bucks about it. In Vercel, open the Fuchs Bucks project → Settings → Environment
Variables, and add these two for Production:

  FOX_TOKEN_SHA256   $HASH
  FOX_USER_EMAIL     (the email you sign in to Fuchs Bucks with)

Then redeploy (Deployments → ⋯ → Redeploy). After that, ask him something like
"how much did we spend on groceries last month?"
EOF
