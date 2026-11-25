# Homebox for macOS

Mac 公测候选版。系统目标为 macOS 13 或更新版本。Apple 芯片请选择 arm64，Intel 请选择 amd64，可在苹果菜单的「关于本机」查看。两个包的界面和功能相同。

1. 完整解压 ZIP，把文件夹放到本地磁盘。不要单独移动启动文件。
2. 双击 `Start-Homebox.command`。终端窗口运行本地服务，默认浏览器打开 <http://127.0.0.1:7745>。首次使用请自行注册。若端口已被占用，启动器会报错而不接管其他服务。
3. 退出时切回启动它的终端窗口，按 **Control-C**。只关浏览器标签页不会停止服务。

账号、设备、照片和本机密钥都放在 `~/Library/Application Support/Homebox Personal/`。两种芯片版本使用同一个数据目录。备份前先停止服务，再复制整个目录。不要把数据目录放入公开发行包。它不与 Windows 自动同步。

此候选包未使用 Apple Developer ID 签名，也未公证。下载后若被 macOS 安全策略拦截，请使用自己从已审查源码构建的版本，或等待签名发行版；不需要关闭系统安全防护。

## 从公开源码重新构建

在干净的源码副本上准备 Go（版本见 backend/go.mod）、Node、pnpm（版本见 frontend/package.json）和 Python 3.9+。在项目根目录运行：

```sh
(cd frontend && pnpm install --frozen-lockfile && pnpm run build)
python3 launcher/macos/package.py
```

脚本从前端静态产物和 Go 源码生成两个 ZIP 及 SHA256SUMS，默认写入项目的 `dist/macos/`。桌面端用户不需要这些开发工具。不使用 Windows 的 .exe、WebView2 或个人迁移包。发布 ZIP 时也请提供对应版本的完整源码和许可证。
