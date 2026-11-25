param([switch]$TestInstance)
$ErrorActionPreference = 'Stop'
$data = Join-Path $PSScriptRoot $(if ($TestInstance) { 'qa-data' } else { 'local-data' })
$file = Join-Path $data 'server.json'
if (-not (Test-Path -LiteralPath $file)) { Write-Output 'Homebox is not running.'; exit 0 }
$state = Get-Content -Raw -LiteralPath $file | ConvertFrom-Json
$proc = Get-Process -Id $state.pid -ErrorAction SilentlyContinue
$exe = Join-Path $PSScriptRoot '.runtime\homebox.exe'
if ($proc -and $proc.Path -eq $exe -and $proc.StartTime.ToUniversalTime().Ticks.ToString() -eq $state.startedTicks) {
  Stop-Process -Id $proc.Id
  $proc.WaitForExit()
  Write-Output 'Homebox stopped.'
}
Remove-Item -LiteralPath $file
