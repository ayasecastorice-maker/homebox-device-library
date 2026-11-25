$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$go = Join-Path $root '.runtime\go\bin\go.exe'
if (-not (Test-Path -LiteralPath $go)) { $go = (Get-Command go.exe -ErrorAction Stop).Source }
$null = New-Item -ItemType Directory -Force -Path (Join-Path $root '.runtime')
Push-Location (Join-Path $root 'frontend')
try {
  & pnpm run build
  if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }
  $static = Join-Path $root 'backend\app\api\static\public'
  Copy-Item -Path '.output\public\*' -Destination $static -Recurse -Force
} finally { Pop-Location }
Push-Location (Join-Path $root 'backend')
try {
  & $go build -trimpath -buildvcs=false -o (Join-Path $root '.runtime\homebox.exe') ./app/api
  if ($LASTEXITCODE -ne 0) { throw 'Backend build failed. Stop Homebox before rebuilding.' }
} finally { Pop-Location }
Write-Output 'Built. Start with .\Start-Homebox.ps1'
