param([int]$Port = 7745, [switch]$TestInstance)
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$exe = Join-Path $root '.runtime\homebox.exe'
if (-not (Test-Path -LiteralPath $exe)) { throw 'Build first: .\Build-Homebox.ps1' }
$data = Join-Path $root $(if ($TestInstance) { 'qa-data' } else { 'local-data' })
New-Item -ItemType Directory -Force -Path $data | Out-Null
$pidFile = Join-Path $data 'server.json'
if (Test-Path -LiteralPath $pidFile) {
  $old = Get-Content -Raw -LiteralPath $pidFile | ConvertFrom-Json
  $proc = Get-Process -Id $old.pid -ErrorAction SilentlyContinue
  if ($proc -and $proc.Path -eq $exe -and $proc.StartTime.ToUniversalTime().Ticks.ToString() -eq $old.startedTicks) {
    Write-Output "Homebox is already running: http://127.0.0.1:$($old.port)"
    exit 0
  }
}
if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) { throw "Port $Port is in use. Pass -Port with another port." }
$secret = Join-Path $data 'api-key-pepper.txt'
if (-not (Test-Path -LiteralPath $secret)) {
  $bytes = New-Object byte[] 48
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  $rng.GetBytes($bytes)
  $rng.Dispose()
  [IO.File]::WriteAllText($secret, [Convert]::ToBase64String($bytes))
}
$env:HBOX_AUTH_API_KEY_PEPPER = [IO.File]::ReadAllText($secret)
$env:HBOX_WEB_HOST = '127.0.0.1'
$env:HBOX_WEB_PORT = [string]$Port
$env:HBOX_MODE = 'production'
$env:HBOX_OPTIONS_ALLOW_ANALYTICS = 'false'
$env:HBOX_OPTIONS_GITHUB_RELEASE_CHECK = 'false'
$env:HBOX_OPTIONS_ALLOW_REGISTRATION = 'true'
$env:HBOX_DEMO = 'false'
$process = Start-Process -FilePath $exe -WorkingDirectory $data -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $data 'server.log') -RedirectStandardError (Join-Path $data 'error.log')
@{ pid = $process.Id; startedTicks = $process.StartTime.ToUniversalTime().Ticks.ToString(); port = $Port } | ConvertTo-Json | Set-Content -LiteralPath $pidFile
Remove-Item Env:HBOX_AUTH_API_KEY_PEPPER
for ($i = 0; $i -lt 60; $i++) {
  Start-Sleep -Milliseconds 500
  if ($process.HasExited) { throw "Homebox exited. See $data\error.log" }
  try { $response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$Port/api/v1/status" -TimeoutSec 2; if ($response.StatusCode -eq 200) { Write-Output "Homebox: http://127.0.0.1:$Port"; exit 0 } } catch {}
}
throw "Startup timed out. See $data\error.log"
