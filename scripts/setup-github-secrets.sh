#!/bin/bash
# Channely — Set up GitHub Secrets for CI/CD
# 
# Prerequisites:
#   1. GitHub CLI installed: brew install gh
#   2. Authenticated: gh auth login
#   3. Remote repo set up: git remote add origin https://github.com/YOUR_USER/channely.git
#
# All values are read from environment variables or prompted interactively.
#
# Required env vars (or will be prompted):
#   APPLE_SIGNING_IDENTITY  — e.g. "Developer ID Application: Your Name (TEAMID)"
#   APPLE_CERTIFICATE_PATH  — path to .p12 file
#   APPLE_CERTIFICATE_PASSWORD
#   APPLE_ID                — Apple ID email
#   APPLE_PASSWORD          — App-specific password
#   APPLE_TEAM_ID           — 10-char team ID
#   TAURI_KEY_PATH           — path to Tauri signing key file
#
# Usage: ./scripts/setup-github-secrets.sh

set -e

echo "🔐 Setting up GitHub Secrets for Channely CI/CD"
echo ""

# Check gh is installed
if ! command -v gh &> /dev/null; then
  echo "❌ GitHub CLI (gh) not installed. Run: brew install gh"
  exit 1
fi

# Check auth
if ! gh auth status &> /dev/null; then
  echo "❌ Not authenticated. Run: gh auth login"
  exit 1
fi

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

prompt_file() {
  local var_name="$1"
  local description="$2"
  local value="${!var_name}"

  if [ -z "$value" ]; then
    read -p "  Enter path to $description ($var_name): " value
  fi

  if [ ! -f "$value" ]; then
    echo "❌ File not found: $value"
    exit 1
  fi

  echo "$value"
}

echo "Setting secrets..."
echo ""

# Apple code signing
SIGNING_ID=$(prompt_value "APPLE_SIGNING_IDENTITY" "Apple signing identity" "false")
gh secret set APPLE_SIGNING_IDENTITY --body "$SIGNING_ID"
echo "  ✅ APPLE_SIGNING_IDENTITY"

CERT_PATH=$(prompt_file "APPLE_CERTIFICATE_PATH" ".p12 certificate file")
gh secret set APPLE_CERTIFICATE --body "$(base64 -i "$CERT_PATH")"
echo "  ✅ APPLE_CERTIFICATE"

CERT_PASS=$(prompt_value "APPLE_CERTIFICATE_PASSWORD" "certificate password" "true")
gh secret set APPLE_CERTIFICATE_PASSWORD --body "$CERT_PASS"
echo "  ✅ APPLE_CERTIFICATE_PASSWORD"

# Apple notarization
APPLE_ID_VAL=$(prompt_value "APPLE_ID" "Apple ID email" "false")
gh secret set APPLE_ID --body "$APPLE_ID_VAL"
echo "  ✅ APPLE_ID"

APPLE_PASS=$(prompt_value "APPLE_PASSWORD" "app-specific password" "true")
gh secret set APPLE_PASSWORD --body "$APPLE_PASS"
echo "  ✅ APPLE_PASSWORD"

TEAM_ID=$(prompt_value "APPLE_TEAM_ID" "Apple Team ID" "false")
gh secret set APPLE_TEAM_ID --body "$TEAM_ID"
echo "  ✅ APPLE_TEAM_ID"

# Tauri updater signing
TAURI_KEY=$(prompt_file "TAURI_KEY_PATH" "Tauri signing private key file")
gh secret set TAURI_SIGNING_PRIVATE_KEY --body "$(cat "$TAURI_KEY")"
echo "  ✅ TAURI_SIGNING_PRIVATE_KEY"

echo ""
echo "🎉 All 7 secrets set! CI/CD is ready."
echo ""
echo "To trigger a release build:"
echo "  git tag v0.1.0"
echo "  git push origin v0.1.0"
echo ""
echo "This will build, sign, notarize, and publish to GitHub Releases."
