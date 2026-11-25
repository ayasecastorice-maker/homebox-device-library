# Homebox 个人设备库（Windows / macOS 社区修改版）

**简体中文** | [English](README.en.md)

基于 [Homebox](https://github.com/sysadminsmedia/homebox) 的个人电子设备管理应用。设备照片库支持分类、照片、头像和手动排序；「全部」与各分类分别保存顺序。资产统计包含月度支出和购入明细，装备分组可按使用场景整理设备。

本仓库只有源码和构建所需的静态资源，不附账号、设备、数据库、密钥或可执行文件。首次运行后需要自行注册。默认仅监听本机，不提供跨电脑账号同步。

## macOS 扩展包

macOS 13 及以上版本：Apple 芯片选 `arm64`，Intel 选 `amd64`。拿到对应的运行包后，完整解压，双击 `Start-Homebox.command`。默认浏览器会打开 <http://127.0.0.1:7745>。要停止服务，在启动它的终端窗口按 **Control-C**；只关浏览器不会停止服务。

如果下载的是源码而不是运行包，请先准备 Go（版本见 [go.mod](backend/go.mod)）、Node.js 22.12+、pnpm（版本见 [package.json](frontend/package.json)）和 Python 3.9+，再从项目根目录运行：

```sh
(cd frontend && pnpm install --frozen-lockfile && pnpm run build)
python3 launcher/macos/package.py
```

两个 ZIP 和校验文件会写入 `dist/macos/`。当前候选包未经 Apple Developer ID 签名或公证。更多说明见 [macOS 使用说明](launcher/macos/README.md)。

## 从源码运行（Windows x64）

需要 Node.js 22.12+（或兼容的更新 LTS）、pnpm（版本见 `frontend/package.json`）和 Go（最低版本见 `backend/go.mod`）。首次安装依赖需要联网。以下命令在项目根目录的 PowerShell 中执行：

```powershell
Push-Location frontend
pnpm install --frozen-lockfile
Pop-Location
.\Build-Homebox.ps1
.\Start-Homebox.ps1
```

打开 <http://127.0.0.1:7745>，注册新账号。用 `.\Stop-Homebox.ps1` 停止后台服务。若端口已占用，可运行 `.\Start-Homebox.ps1 -Port 7747` 并打开启动脚本打印的地址。

## Windows 可选：独立桌面窗口

桌面启动器使用 .NET Framework 的 x64 C# 编译器和 Microsoft Edge WebView2 Runtime。另需将 NuGet 包 `Microsoft.Web.WebView2` **1.0.4314.35** 解压到 `.runtime/webview-sdk/1.0.4314.35/`，该目录下应直接包含 `lib/` 和 `runtimes/`。可从 [NuGet 包页面](https://www.nuget.org/packages/Microsoft.Web.WebView2/1.0.4314.35) 获取。浏览器模式不需要此 SDK。

完成后端构建后运行 `.\Build-Launcher.ps1`，再双击 `Start-Homebox.cmd`。关闭桌面窗口会停止由它启动的服务。图标矢量源文件在 `launcher/assets/`，另附的 `launcher/portable/PortableStart.cs` 是离线分发包装器的源码，不是启动本项目的必要步骤。

## 数据与发布边界

- Windows 将账号、设备、附件和本机密钥保存在项目的 `local-data/`；macOS 使用 `~/Library/Application Support/Homebox Personal/`。备份时先停止服务，再复制整个数据目录。不要把数据目录、密钥、个人截图或迁移包提交到 GitHub。
- 测试使用独立目录和端口。公开发布的可执行包应从干净源码重新构建，不应复制个人安装目录。提交前检查待提交文件和 Git 提交邮箱。

## 来源与许可

上游源码基线：`sysadminsmedia/homebox@387cd6cab0faae6d97e4819e220f88aee06e463b`。本项目是社区修改版，非上游官方发行版。主要修改包括中文设备界面、统计和分组、头像与排序持久化，以及 Windows 本地启动器。

保留上游 [GNU AGPL v3 许可证](LICENSE) 及源码中的版权声明。字体许可与来源见 [字体说明](frontend/public/fonts/README.md)，玻璃效果和拖动排序库的许可见 [第三方许可目录](frontend/public/licenses/)。
