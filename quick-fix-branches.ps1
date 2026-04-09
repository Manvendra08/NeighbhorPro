# Quick Fix Script - Immediate branch sync with origin/main
# Run this once to push local main and merge all feature branches

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "=== Quick Fix: Sync Branches with origin/main ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Push local main to origin
Write-Host "[1] Pushing local main to origin/main..." -ForegroundColor Yellow
git checkout main
git push origin main
Write-Host ""

# Step 2: Merge all feature branches into main
Write-Host "[2] Merging feature branches into main..." -ForegroundColor Yellow

$branches = @(
    "claude/beautiful-chebyshev",
    "claude/jolly-visvesvaraya", 
    "claude/unruffled-meninsky",
    "fix/unruffled-checks",
    "sync/unruffled"
)

foreach ($branch in $branches) {
    Write-Host "   Merging $branch..." -NoNewline
    
    # Check if branch exists
    $exists = git rev-parse --verify $branch 2>$null
    if ($null -eq $exists) {
        Write-Host " [SKIP - doesn't exist]" -ForegroundColor Gray
        continue
    }
    
    # Check if already merged
    $merged = git log --oneline main..$branch
    if ($null -eq $merged -or $merged -eq "") {
        Write-Host " [SKIP - already merged]" -ForegroundColor Gray
        continue
    }
    
    # Perform merge
    git merge $branch --no-edit 2>&1 | Out-Null
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host " [CONFLICT - manual resolution needed]" -ForegroundColor Red
    } else {
        Write-Host " [OK]" -ForegroundColor Green
    }
}

Write-Host ""

# Step 3: Push updated main
Write-Host "[3] Pushing updated main..." -ForegroundColor Yellow
git push origin main
Write-Host ""

# Step 4: Summary
Write-Host "=== Summary ===" -ForegroundColor Cyan
git log --oneline -5
Write-Host ""

Write-Host "Current branch status with origin/main:" -ForegroundColor Cyan
git status
Write-Host ""

Write-Host "Done! Review the summary above." -ForegroundColor Green
