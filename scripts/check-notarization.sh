#!/bin/bash
# Channely — Check notarization status and staple when ready
#
# Required env vars (or will be prompted):
#   SUBMISSION_ID   — notarization submission UUID
#   APPLE_ID        — Apple ID email
#   APPLE_TEAM_ID   — 10-char team ID
#   APPLE_PASSWORD  — App-specific password (or use @keychain: reference)
#
# Usage: ./scripts/check-notarization.sh

set -e

# Helper: read a value from env or prompt
prompt_value() {
  local var_name="$1"
  local description="$2"
  local is_secret="$3"
  local value="${!var_name}"

  if [ -z "$value" ]; then
    if [ "$is_secret" = "true" ]; then
      read -sp "  Enter $description ($var_name): " value
      echo ""
    else
      read -p "  Enter $description ($var_name): " value
    fi
  fi

  if [ -z "$value" ]; then
    echo "❌ $var_name is required. Aborting."
    exit 1
  fi

  echo "$value"
}

echo "🔐 Channely Notarization Check"
echo ""

SUBMISSION_ID=$(prompt_value "SUBMISSION_ID" "notarization submission UUID" "false")
APPLE_ID=$(prompt_value "APPLE_ID" "Apple ID email" "false")
APPLE_TEAM_ID=$(prompt_value "APPLE_TEAM_ID" "Apple Team ID" "false")
APPLE_PASSWORD=$(prompt_value "APPLE_PASSWORD" "app-specific password" "true")

DMG_PATH="${DMG_PATH:-src-tauri/target/release/bundle/dmg/Channely_0.1.0_aarch64.dmg}"
APP_PATH="${APP_PATH:-src-tauri/target/release/bundle/macos/Channely.app}"

echo ""
echo "🔍 Checking notarization status for submission: $SUBMISSION_ID"
echo ""

STATUS_OUTPUT=$(xcrun notarytool info "$SUBMISSION_ID" \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_PASSWORD" \
  --team-id "$APPLE_TEAM_ID" 2>&1)

echo "$STATUS_OUTPUT"
echo ""

if echo "$STATUS_OUTPUT" | grep -q "status: Accepted"; then
  echo "✅ Notarization ACCEPTED! Stapling tickets..."
  echo ""

  echo "Stapling DMG..."
  xcrun stapler staple "$DMG_PATH"
  echo ""

  echo "Stapling .app..."
  xcrun stapler staple "$APP_PATH"
  echo ""

  echo "🎉 Done! Your app is signed, notarized, and stapled."
  echo "   DMG: $DMG_PATH"
  echo "   App: $APP_PATH"
  echo ""
  echo "Users can now install without any Gatekeeper warnings."

elif echo "$STATUS_OUTPUT" | grep -q "status: In Progress"; then
  echo "⏳ Still processing. Apple's servers are reviewing your app."
  echo "   Run this script again in a few minutes."

elif echo "$STATUS_OUTPUT" | grep -q "status: Invalid"; then
  echo "❌ Notarization REJECTED. Fetching log..."
  echo ""
  xcrun notarytool log "$SUBMISSION_ID" \
    --apple-id "$APPLE_ID" \
    --password "$APPLE_PASSWORD" \
    --team-id "$APPLE_TEAM_ID"

else
  echo "❓ Unknown status. Check the output above."
fi
