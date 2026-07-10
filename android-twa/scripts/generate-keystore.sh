#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────────────────────────────
# ProNeighbor TWA — Keystore + SHA-256 Fingerprint Generator
# ──────────────────────────────────────────────────────────────────────
# Prerequisites: Java 17+ (keytool is bundled with the JDK)
#
# Usage:
#   chmod +x scripts/generate-keystore.sh
#   ./scripts/generate-keystore.sh
#
# This will:
#   1. Generate a keystore.jks file in the project root
#   2. Print the SHA-256 fingerprint you need for assetlinks.json
#   3. Suggest environment variables for builds
# ──────────────────────────────────────────────────────────────────────

KEYSTORE_FILE="../keystore.jks"
KEY_ALIAS="proneighbor"
VALIDITY_DAYS=10000  # ~27 years

if [ -f "$KEYSTORE_FILE" ]; then
  echo "⚠️  Keystore already exists at $KEYSTORE_FILE"
  echo "   Delete it first if you want to regenerate."
  echo ""
  echo "   Existing SHA-256 fingerprint:"
  keytool -list -v -keystore "$KEYSTORE_FILE" -alias "$KEY_ALIAS" 2>/dev/null \
    | grep "SHA256:" | awk '{print $2}'
  exit 0
fi

echo "🔑 Generating keystore..."
echo "   File:  $KEYSTORE_FILE"
echo "   Alias: $KEY_ALIAS"
echo ""

# Generate keystore (will prompt for passwords interactively)
keytool -genkey -v \
  -keystore "$KEYSTORE_FILE" \
  -alias "$KEY_ALIAS" \
  -keyalg RSA \
  -keysize 2048 \
  -validity "$VALIDITY_DAYS"

echo ""
echo "✅ Keystore generated at $KEYSTORE_FILE"
echo ""
echo "🔐 SHA-256 fingerprint (for assetlinks.json):"
FINGERPRINT=$(keytool -list -v -keystore "$KEYSTORE_FILE" -alias "$KEY_ALIAS" 2>/dev/null \
  | grep "SHA256:" | awk '{print $2}')
echo "   $FINGERPRINT"
echo ""
echo "📋 Set these env vars for release builds:"
echo "   export KEYSTORE_PASSWORD='your-store-password'"
echo "   export KEY_PASSWORD='your-key-password'"
echo "   export KEY_ALIAS='$KEY_ALIAS'"
