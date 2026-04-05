# ProNeighbor Git Workflow Script (PowerShell)
# Usage: .\scripts\git-workflow.ps1 [start|end]

param(
    [ValidateSet('start', 'end')]
    [string]$Action = 'start',
    [string]$BranchName
)

# Ensure on correct branch for 'end'
if ($Action -eq 'end' -and -not $BranchName) {
    $BranchName = Read-Host 'Enter branch name to merge'
}

switch ($Action) {
    'start' {
        Write-Host 'Starting new work: Switching to main and pulling latest...' -ForegroundColor Green
        git checkout main
        git pull origin main
        Write-Host 'Ready for new branch: git checkout -b your-new-branch' -ForegroundColor Yellow
    }
    'end' {
        Write-Host "Completing work on '$BranchName'..." -ForegroundColor Green
        git checkout main
        git pull origin main
        git merge $BranchName
        git push origin main
        git branch -d $BranchName
        Write-Host 'Work completed and cleaned up!' -ForegroundColor Green
    }
}

# Example usage:
# .\scripts\git-workflow.ps1 start
# git checkout -b feature/xyz && # do work && git push origin feature/xyz
# .\scripts\git-workflow.ps1 end -BranchName 'feature/xyz'
