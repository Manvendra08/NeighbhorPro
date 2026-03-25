# setup-storage-cors.ps1
# Requires Google Cloud SDK (gsutil) to be installed on your machine.
# This script configures CORS for your Firebase Storage bucket to allow uploads from your web app.

$bucket = "gs://neighbhorpro.firebasestorage.app"
$corsFile = "cors.json"

if (-not (Test-Path $corsFile)) {
    Write-Host "Error: $corsFile not found. Please create it first." -ForegroundColor Red
    exit
}

Write-Host "Setting CORS for bucket $bucket..." -ForegroundColor Cyan
gsutil cors set $corsFile $bucket

if ($LASTEXITCODE -eq 0) {
    Write-Host "CORS successfully updated!" -ForegroundColor Green
} else {
    Write-Host "Failed to update CORS. Make sure you are logged in (gcloud auth login) and have the necessary permissions." -ForegroundColor Yellow
}
