# NeighbhorPro - Branch Merge Script
# This script merges feature branches into main and cleans up after successful merge

param(
    [switch]$DryRun,
    [switch]$SkipPush
)

$ErrorActionPreference = "Stop"
$repoRoot = $PSScriptRoot

Write-Host "=== NeighbhorPro Branch Merge Script ===" -ForegroundColor Cyan
Write-Host ""

# Navigate to repo
Set-Location $repoRoot

# Fetch latest from remote
Write-Host "[1/5] Fetching latest from origin..." -ForegroundColor Yellow
git fetch origin
Write-Host ""

# Ensure we're on main and it's up to date
Write-Host "[2/5] Updating local main branch..." -ForegroundColor Yellow
git checkout main
git pull origin main
Write-Host ""

# Get branches to merge (excluding main, already merged, and remote tracking)
Write-Host "[3/5] Identifying branches to merge..." -ForegroundColor Yellow
$branchesToMerge = git branch --no-merged main | Where-Object { 
    $_.Trim() -ne "main" -and 
    $_.Trim() -ne "* main" -and
    -not $_.StartsWith("remotes/")
}

$branches = $branchesToMerge | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" }

if ($branches.Count -eq 0) {
    Write-Host "No branches to merge. Main is up to date!" -ForegroundColor Green
    exit 0
}

Write-Host "Found $($branches.Count) branch(es) to merge:" -ForegroundColor Cyan
$branches | ForEach-Object { Write-Host "  - $_" }

Write-Host ""

# Show what will be merged
foreach ($branch in $branches) {
    Write-Host "Commits in '$branch' not in main:" -ForegroundColor Cyan
    git log --oneline main..$branch | ForEach-Object { Write-Host "    $_" }
    Write-Host ""
}

if ($DryRun) {
    Write-Host "[DRY RUN] Would merge the following branches:" -ForegroundColor Magenta
    $branches | ForEach-Object { Write-Host "  - $_" }
    Write-Host ""
    Write-Host "To actually merge, run without -DryRun parameter" -ForegroundColor Yellow
    exit 0
}

# Confirm before proceeding
Write-Host "[4/5] Merging branches..." -ForegroundColor Yellow
$confirm = Read-Host "Proceed with merging $($branches.Count) branch(es) into main? (y/n)"
if ($confirm -ne "y") {
    Write-Host "Aborted." -ForegroundColor Red
    exit 0
}

# Merge each branch
foreach ($branch in $branches) {
    Write-Host ""
    Write-Host ">>> Merging '$branch' into main..." -ForegroundColor Cyan
    
    # First push the branch to remote if it doesn't exist
    $remoteBranch = "origin/$branch"
    $existsOnRemote = git ls-remote --heads origin $branch 2>$null
    
    if ([string]::IsNullOrEmpty($existsOnRemote)) {
        Write-Host "    Branch not on remote, pushing first..." -ForegroundColor Yellow
        if (-not $SkipPush) {
            git push -u origin $branch
        }
    }
    
    # Merge the branch
    git merge $branch --no-edit
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "    Merge conflict detected!" -ForegroundColor Red
        Write-Host "    Please resolve conflicts and run: git commit" -ForegroundColor Yellow
        Write-Host "    Then re-run this script to continue." -ForegroundColor Yellow
        exit 1
    }
    
    Write-Host "    Successfully merged '$branch'" -ForegroundColor Green
}

Write-Host ""
Write-Host "[5/5] Pushing updated main to origin..." -ForegroundColor Yellow
if (-not $SkipPush) {
    git push origin main
} else {
    Write-Host "    [SKIPPED - Use -SkipPush was specified]" -ForegroundColor Gray
}
Write-Host ""

# Cleanup options
Write-Host "=== Cleanup Options ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "To delete merged local branches, run:"
Write-Host "  git branch -d $($branches -join ' ')" -ForegroundColor Yellow
Write-Host ""
Write-Host "To delete merged remote branches (after confirming merge on GitHub), run:"
Write-Host "  git push origin --delete $($branches -join ' ')" -ForegroundColor Yellow
Write-Host ""

# Ask if user wants to delete local branches now
$deleteLocal = Read-Host "Delete merged local branches now? (y/n)"
if ($deleteLocal -eq "y") {
    foreach ($branch in $branches) {
        git branch -d $branch
    }
    Write-Host "Local branches deleted." -ForegroundColor Green
}

Write-Host ""
Write-Host "=== Done! ===" -ForegroundColor Green
Write-Host "Main has been updated with all merged branches." -ForegroundColor Cyan
