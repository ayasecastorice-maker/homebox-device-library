$ErrorActionPreference = 'Stop'
$sdkVersion = '1.0.4314.35'
$sdk = Join-Path $PSScriptRoot ".runtime\webview-sdk\$sdkVersion"
$out = Join-Path $PSScriptRoot '.runtime\desktop'
New-Item -ItemType Directory -Force -Path $out | Out-Null
if (-not (Test-Path -LiteralPath $sdk)) { throw 'Microsoft WebView2 SDK is missing; see README.md.' }
$sourceIcon = Join-Path $PSScriptRoot 'Homebox.ico'
if (-not (Test-Path -LiteralPath $sourceIcon)) {
  throw 'Homebox.ico is missing. From frontend, run: node test/export-launcher-icon.mjs'
}
$icon = Join-Path $out 'Homebox.ico'
Copy-Item -LiteralPath $sourceIcon -Destination $icon -Force
$framework = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319'
$core = Join-Path $sdk 'lib\net462\Microsoft.Web.WebView2.Core.dll'
$forms = Join-Path $sdk 'lib\net462\Microsoft.Web.WebView2.WinForms.dll'
foreach ($dll in @($core,$forms,(Join-Path $sdk 'runtimes\win-x64\native\WebView2Loader.dll'))) { Copy-Item -LiteralPath $dll -Destination $out -Force }
& (Join-Path $framework 'csc.exe') /nologo /target:winexe /platform:x64 /optimize+ "/out:$out\Homebox.exe" "/win32icon:$icon" "/win32manifest:$PSScriptRoot\launcher\app.manifest" /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Web.Extensions.dll "/reference:$core" "/reference:$forms" (Join-Path $PSScriptRoot 'launcher\HomeboxLauncher.cs')
if ($LASTEXITCODE -ne 0) { throw 'Launcher compilation failed.' }
Write-Output "Built: $out\Homebox.exe"
