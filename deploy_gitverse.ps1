#Requires -Version 5.1
<#
  Deploy Ozon Calculator to GitVerse (GigaCode)
  Run: Right-click → "Run with PowerShell"
#>

$TOKEN       = "84cd2078d09a2ccf6a196ed5c1b38393b7f60e50"
$GITVERSE    = "https://gitverse.ru/api/v1"
$REPO_NAME   = "ozon-calculator"
$LOCAL_PATH  = "ozon-calculator"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Deploy to GitVerse (GigaCode)" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# ── 1. Verify token ───────────────────────────────
Write-Host "[1/4] Checking token..." -ForegroundColor DarkGray
$headers = @{ Authorization = "token $TOKEN" }
try {
    $user = Invoke-RestMethod -Uri "$GITVERSE/user" -Headers $headers -TimeoutSec 15
    Write-Host "      OK — logged in as: $($user.login)" -ForegroundColor Green
} catch {
    Write-Host "      FAIL — token invalid or network error" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# ── 2. Create public repo ─────────────────────────
Write-Host "[2/4] Creating public repo '$REPO_NAME'..." -ForegroundColor DarkGray
$body = @{
    name        = $REPO_NAME
    private     = $false
    description = "Ozon Unit-Economics Calculator MVP"
    auto_init   = $false
} | ConvertTo-Json -Compress

try {
    $repo = Invoke-RestMethod -Uri "$GITVERSE/user/repos" -Method Post `
        -Headers $headers -Body $body -ContentType "application/json"
    Write-Host "      OK — created at $($repo.html_url)" -ForegroundColor Green
} catch {
    $status = $_.Exception.Response.StatusCode.value__
    if ($status -eq 409 -or $_.ErrorDetails.Message -like "*already exists*") {
        Write-Host "      WARN — repo already exists, skipping creation" -ForegroundColor Yellow
    } else {
        Write-Host "      FAIL — HTTP $status" -ForegroundColor Red
        Write-Host $_.ErrorDetails.Message -ForegroundColor DarkRed
        Read-Host "Press Enter to exit"
        exit 1
    }
}

# ── 3. Push local code ────────────────────────────
Write-Host "[3/4] Pushing code..." -ForegroundColor DarkGray
if (-not (Test-Path $LOCAL_PATH)) {
    Write-Host "      FAIL — folder '$LOCAL_PATH' not found" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Set-Location $LOCAL_PATH

# Remove old remote if exists
$remotes = git remote 2>$null
if ($remotes -contains "gitverse") {
    git remote remove gitverse | Out-Null
}

$remoteUrl = "https://oauth2:${TOKEN}@gitverse.ru/$($user.login)/${REPO_NAME}.git"
git remote add gitverse $remoteUrl

# Push current branch (master or main)
$branch = (git branch --show-current 2>$null)
if (-not $branch) { $branch = "master" }

try {
    git push -u gitverse $branch 2>&1 | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkGray }
    Write-Host "      OK — pushed branch '$branch'" -ForegroundColor Green
} catch {
    Write-Host "      FAIL — push error (see above)" -ForegroundColor Red
    Set-Location ..
    Read-Host "Press Enter to exit"
    exit 1
}

# ── 4. Enable GitVerse Pages (if available) ───────
Write-Host "[4/4] Enabling Pages..." -ForegroundColor DarkGray
try {
    $pagesBody = @{ source = "master"; builder = "gitea" } | ConvertTo-Json -Compress
    $pages = Invoke-RestMethod -Uri "$GITVERSE/repos/$($user.login)/$REPO_NAME/pages" `
        -Method Post -Headers $headers -Body $pagesBody -ContentType "application/json"
    Write-Host "      OK — Pages enabled" -ForegroundColor Green
} catch {
    Write-Host "      SKIP — Pages API not available or already enabled" -ForegroundColor Yellow
}

# ── Done ──────────────────────────────────────────
Set-Location ..
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  DONE!" -ForegroundColor Green
Write-Host "  Repo:  https://gitverse.ru/$($user.login)/$REPO_NAME" -ForegroundColor Cyan
Write-Host "  Pages: https://$($user.login).gitverse.io/$REPO_NAME (if enabled)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Read-Host "`nPress Enter to close"
