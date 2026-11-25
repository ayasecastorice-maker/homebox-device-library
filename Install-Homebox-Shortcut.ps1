param([switch]$ProjectOnly)
$ErrorActionPreference = 'Stop'
$exe = Join-Path $PSScriptRoot '.runtime\desktop\Homebox.exe'
if (-not (Test-Path -LiteralPath $exe)) { throw 'Run Build-Launcher.ps1 first.' }
$icon = Join-Path $PSScriptRoot 'Homebox.ico'
if (-not (Test-Path -LiteralPath $icon)) { throw 'Homebox.ico is missing. Run the icon export first.' }
$shell = New-Object -ComObject WScript.Shell
if (-not ('HomeboxShortcutShell' -as [type])) {
  Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class HomeboxShortcutShell {
  [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
  public static extern void SHChangeNotify(uint eventId, uint flags, string item1, IntPtr item2);
}
'@
}
$folders = @($PSScriptRoot)
foreach ($folder in $folders) {
  $linkPath = Join-Path $folder 'Homebox.lnk'
  if (Test-Path -LiteralPath $linkPath) {
    $existing = $shell.CreateShortcut($linkPath)
    if ($existing.TargetPath -and $existing.TargetPath -ne $exe) { throw "A different Homebox shortcut already exists: $linkPath" }
  }
  $link = $shell.CreateShortcut($linkPath)
  $link.TargetPath = $exe
  $link.WorkingDirectory = $PSScriptRoot
  $link.IconLocation = "$icon,0"
  $link.Description = 'Homebox - Personal Device Library'
  $link.Save()
  [HomeboxShortcutShell]::SHChangeNotify(0x2000, 0x5, $linkPath, [IntPtr]::Zero)
  Write-Output $linkPath
}
