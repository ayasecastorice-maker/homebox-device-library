$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$iconPath = Join-Path $root 'Homebox.ico'
$exePath = Join-Path $root '.runtime\desktop\Homebox.exe'
$output = Join-Path $root 'qa-artifacts'
New-Item -ItemType Directory -Path $output -Force | Out-Null
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class HomeboxIconTest {
  [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern IntPtr LoadImage(IntPtr instance, string name, uint type, int width, int height, uint flags);
  [DllImport("user32.dll")]
  public static extern bool DestroyIcon(IntPtr handle);
}
'@
$sizes = @(16,20,24,32,40,48,64,96,128,256)
$bytes = [IO.File]::ReadAllBytes($iconPath)
if ([BitConverter]::ToUInt16($bytes,2) -ne 1 -or [BitConverter]::ToUInt16($bytes,4) -ne $sizes.Count) {
  throw 'Unexpected ICO header.'
}
for ($i = 0; $i -lt $sizes.Count; $i++) {
  $dimension = [int]$bytes[6 + 16 * $i]
  if ($dimension -eq 0) { $dimension = 256 }
  if ($dimension -ne $sizes[$i]) { throw 'Unexpected ICO dimension.' }
  $handle = [HomeboxIconTest]::LoadImage([IntPtr]::Zero,$iconPath,1,$sizes[$i],$sizes[$i],0x10)
  if ($handle -eq [IntPtr]::Zero) { throw 'Windows could not decode the ICO.' }
  $icon = [Drawing.Icon]::FromHandle($handle)
  try {
    if ($icon.Width -ne $sizes[$i] -or $icon.Height -ne $sizes[$i]) { throw 'Windows icon size selection failed.' }
  } finally { $icon.Dispose(); [HomeboxIconTest]::DestroyIcon($handle) | Out-Null }
}
$extracted = [Drawing.Icon]::ExtractAssociatedIcon($exePath)
$bitmap = $extracted.ToBitmap()
try {
  $pixel = $bitmap.GetPixel([int]($bitmap.Width / 2),[int]($bitmap.Height / 2))
  if ([Math]::Abs($pixel.R - 217) -gt 3 -or [Math]::Abs($pixel.G - 119) -gt 3 -or [Math]::Abs($pixel.B - 87) -gt 3) {
    throw "Executable does not expose the new terracotta H icon: $pixel"
  }
  $bitmap.Save((Join-Path $output 'launcher-embedded-icon.png'),[Drawing.Imaging.ImageFormat]::Png)
} finally {
  $bitmap.Dispose()
  $extracted.Dispose()
}
$shell = New-Object -ComObject WScript.Shell
$link = $shell.CreateShortcut((Join-Path $root 'Homebox.lnk'))
if ($link.TargetPath -ne $exePath -or $link.IconLocation -ne "$iconPath,0" -or $link.WorkingDirectory -ne $root) {
  throw 'Shortcut target, working directory, or icon is incorrect.'
}
$desktopShortcut = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Homebox.lnk'
if (Test-Path -LiteralPath $desktopShortcut) { throw 'A desktop Homebox shortcut exists; expected project-folder only.' }
$result = [ordered]@{
  icoSizes = $sizes
  windowsDecode = 'passed'
  executableIcon = 'passed'
  shortcut = $link.FullName
  target = $link.TargetPath
  icon = $link.IconLocation
  desktopShortcut = $false
}
$result | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $output 'launcher-icon-verification.json') -Encoding UTF8
$result | ConvertTo-Json
