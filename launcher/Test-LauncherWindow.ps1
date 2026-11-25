$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$desktop = Join-Path $root '.runtime\desktop'
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
[Reflection.Assembly]::LoadFrom((Join-Path $desktop 'Microsoft.Web.WebView2.Core.dll')) | Out-Null
[Reflection.Assembly]::LoadFrom((Join-Path $desktop 'Microsoft.Web.WebView2.WinForms.dll')) | Out-Null
$assembly = [Reflection.Assembly]::LoadFrom((Join-Path $desktop 'Homebox.exe'))
$type = $assembly.GetType('HomeboxWindow', $true)
$flags = [Reflection.BindingFlags]'Static,NonPublic'
$method = $type.GetMethod('FitStartupBounds', $flags)
$preferred = $type.GetField('StartupClientSize', $flags).GetValue($null)
if ($preferred.Width -ne 1920 -or $preferred.Height -ne 1260) { throw 'Unexpected startup content size.' }
$cases = @(
  @{ Name='4K'; Work=[Drawing.Rectangle]::new(0,0,3840,2088); Frame=[Drawing.Size]::new(1942,1316); Expected=[Drawing.Size]::new(1942,1316) },
  @{ Name='1080p'; Work=[Drawing.Rectangle]::new(0,0,1920,1040); Frame=[Drawing.Size]::new(1942,1316); Expected=[Drawing.Size]::new(1888,1008) },
  @{ Name='Small screen'; Work=[Drawing.Rectangle]::new(0,0,640,440); Frame=[Drawing.Size]::new(1942,1316); Expected=[Drawing.Size]::new(608,408) },
  @{ Name='Secondary screen'; Work=[Drawing.Rectangle]::new(-2560,100,2560,1340); Frame=[Drawing.Size]::new(1942,1316); Expected=[Drawing.Size]::new(1942,1308) },
  @{ Name='High DPI borders'; Work=[Drawing.Rectangle]::new(0,0,2560,1440); Frame=[Drawing.Size]::new(1964,1372); Expected=[Drawing.Size]::new(1964,1372) }
)
foreach ($case in $cases) {
  $actual = $method.Invoke($null, [object[]]@($case.Work, $case.Frame))
  if ($actual.Size -ne $case.Expected) { throw ($case.Name + ': unexpected size') }
  if (-not $case.Work.Contains($actual)) { throw ($case.Name + ': window is off screen') }
  if ([Math]::Abs(($actual.Left + $actual.Width / 2) - ($case.Work.Left + $case.Work.Width / 2)) -gt 1) { throw 'Not horizontally centered.' }
  if ([Math]::Abs(($actual.Top + $actual.Height / 2) - ($case.Work.Top + $case.Work.Height / 2)) -gt 1) { throw 'Not vertically centered.' }
}
Write-Output ('Startup window sizing passed: ' + $cases.Count + ' scenarios; client 1920 x 1260.')
