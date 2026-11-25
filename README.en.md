# Homebox Personal Device Library (Windows and macOS)

[简体中文](README.md) | **English**

A local inventory for personal electronics, based on [Homebox](https://github.com/sysadminsmedia/homebox). Browse device photos by category, see what you bought each month and how much you spent, or group equipment by how you use it. The photo library remembers separate display orders for **All devices** and for each category.

This is a community fork with a Chinese-language device interface. The repository contains source code and build assets, not executables, accounts, device records, or keys. Register a new account the first time you run it. The service listens on your own computer by default; signing in on another computer does not sync your inventory.

## macOS

For macOS 13 or later, choose `arm64` for Apple silicon or `amd64` for Intel. If you have the matching **runtime ZIP**, extract the whole folder and double-click `Start-Homebox.command`. Your default browser opens <http://127.0.0.1:7745>. To stop the service, press **Control-C** in the Terminal window that started it. Closing the browser tab does not stop it.

If you have the **source** instead, install Go (see [go.mod](backend/go.mod)), Node.js 22.12 or later, pnpm (see [package.json](frontend/package.json)), and Python 3.9 or later. From the project root, run:

```sh
(cd frontend && pnpm install --frozen-lockfile && pnpm run build)
python3 launcher/macos/package.py
```

Both runtime ZIPs and their checksums are written to `dist/macos/`. The current candidate packages are not signed with an Apple Developer ID or notarized. See the [additional macOS notes (Chinese)](launcher/macos/README.md).

## Windows x64: Run From Source

Install Go and pnpm using the versions specified in [go.mod](backend/go.mod) and [package.json](frontend/package.json), plus Node.js 22.12 or a compatible newer LTS release. The first dependency install needs an internet connection. Run these commands in PowerShell from the project root:

```powershell
Push-Location frontend
pnpm install --frozen-lockfile
Pop-Location
.\Build-Homebox.ps1
.\Start-Homebox.ps1
```

Open <http://127.0.0.1:7745> and register. To stop the background service, run `.\Stop-Homebox.ps1`. If the default port is in use, run `.\Start-Homebox.ps1 -Port 7747` and open the address it prints.

## Windows: Optional Desktop Window

The desktop launcher needs the x64 .NET Framework C# compiler and Microsoft Edge WebView2 Runtime. Extract the [Microsoft.Web.WebView2 1.0.4314.35 NuGet package](https://www.nuget.org/packages/Microsoft.Web.WebView2/1.0.4314.35) into `.runtime/webview-sdk/1.0.4314.35/` so it contains `lib/` and `runtimes/` directly. The SDK is not required for browser mode.

After building the backend, run `.\Build-Launcher.ps1` and double-click `Start-Homebox.cmd`. Closing the desktop window stops the server it started. The launcher icon sources are in `launcher/assets/`; `launcher/portable/PortableStart.cs` is only needed for the offline distribution wrapper.

## Data and Backups

- Windows stores accounts, devices, attachments, and the local key in the project's `local-data/` folder. On macOS they live in `~/Library/Application Support/Homebox Personal/`. Stop the service before backing up the entire data folder. Do not publish it, its keys, personal screenshots, or migration archives.
- Use a separate folder and port for testing. Build public releases from a clean source checkout, not from an installation you use. Review staged files and your Git commit email before publishing.

## License and Credits

This fork is based on `sysadminsmedia/homebox@387cd6cab0faae6d97e4819e220f88aee06e463b` and is not an official Homebox release. Changes include the device library, purchase statistics, equipment groups, saved avatars and display order, and local launchers.

The upstream [GNU AGPL v3 license](LICENSE) and copyright notices are retained. See the [font credits and licenses](frontend/public/fonts/README.md) and the [third-party notices](frontend/public/licenses/) for the glass effect and drag-and-drop libraries.
