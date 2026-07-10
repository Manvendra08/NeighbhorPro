# ──────────────────────────────────────────────────────────────────────
# ProNeighbor TWA — Keystore + SHA-256 Fingerprint Generator (PowerShell)
# ──────────────────────────────────────────────────────────────────────
# Prerequisites: Java 17+ (keytool is bundled with the JDK)
#
# Usage:
#   .\scripts\generate-keystore.ps1
#
# This will:
#   1. Generate a keystore.jks file in the project root
#   2. Print the SHA-256 fingerprint you need for assetlinks.json
#   3. Suggest environment variables for builds
# ──────────────────────────────────────────────────────────────────────

$KEYSTORE_FILE = "..\keystore.jks"
$KEY_ALIAS = "proneighbor"
$VALIDITY_DAYS = 10000

if (Test-Path $KEYSTORE_FILE) {
    Write-Host "⚠️  Keystore already exists at $KEYSTORE_FILE" -ForegroundColor Yellow
    Write-Host "   Delete it first if you want to regenerate.`n"
    Write-Host "   Existing SHA-256 fingerprint:"
    keytool -list -v -keystore $KEYSTORE_FILE -alias $KEY_ALIAS 2>$null |
        Select-String "SHA256:" |
        ForEach-Object { $_.ToString().Split(':')[1].Trim() }
    exit 0
}

Write-Host "🔑 Generating keystore..." -ForegroundColor Green
Write-Host "   File:  $KEYSTORE_FILE"
Write-Host "   Alias: $KEY_ALIAS`n"

# Generate keystore (will prompt for passwords interactively)
& keytool -genkey -v `
    -keystore $KEYSTORE_FILE `
    -alias $KEY_ALIAS `
    -keyalg RSA `
    -keysize 2048 `
    -validity $VALIDITY_DAYS

Write-Host "`n✅ Keystore generated at $KEYSTORE_FILE" -ForegroundColor Green
Write-Host "`n🔐 SHA-256 fingerprint (for assetlinks.json):"

$fingerprint = keytool -list -v -keystore $KEYSTORE_FILE -alias $KEY_ALIAS 2>$null |
    Select-String "SHA256:" |
    ForEach-Object { $_.ToString().Split(':')[1].Trim() }

Write-Host "   $fingerprint" -ForegroundColor Cyan

Write-Host "`n📋 Set these env vars for release builds:"
Write-Host "   `$env:KEYSTORE_PASSWORD = 'your-store-password'"
Write-Host "   `$env:KEY_PASSWORD = 'your-key-password'"
Write-Host "   `$env:KEY_ALIAS = '$KEY_ALIAS'"
