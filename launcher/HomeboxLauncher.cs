using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

internal static class Program
{
    [STAThread]
    private static void Main(string[] args)
    {
        bool test = Array.IndexOf(args, "--test") >= 0;
        string root = Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", ".."));
        string key;
        using (var sha = SHA256.Create())
            key = BitConverter.ToString(sha.ComputeHash(Encoding.UTF8.GetBytes(root.ToLowerInvariant() + test))).Replace("-", "").Substring(0, 24);
        bool created;
        using (var mutex = new Mutex(true, "Local\\Homebox.Desktop." + key, out created))
        using (var activate = new EventWaitHandle(false, EventResetMode.AutoReset, "Local\\Homebox.Show." + key))
        {
            if (!created) { activate.Set(); return; }
            try
            {
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                using (var window = new HomeboxWindow(root, test, activate)) Application.Run(window);
            }
            catch (Exception error)
            {
                MessageBox.Show(error.Message, "Homebox", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
            finally { mutex.ReleaseMutex(); }
        }
    }
}

internal sealed class ServerState
{
    public int pid { get; set; }
    public string startedTicks { get; set; }
    public int port { get; set; }
}

internal sealed class HomeboxWindow : Form
{
    private static readonly Size StartupClientSize = new Size(1920, 1260);
    private readonly string root, data, serverPath;
    private readonly bool test;
    private readonly Label status;
    private readonly WebView2 browser;
    private RegisteredWaitHandle activation;
    private Task startup;
    private bool closing, readyToClose;
    private ServerState owned;
    private ServerJob job;
    private CoreWebView2Environment environment;

    public HomeboxWindow(string root, bool test, EventWaitHandle activate)
    {
        this.root = root; this.test = test;
        data = Path.Combine(root, test ? "qa-data" : "local-data");
        serverPath = Path.Combine(root, ".runtime", "homebox.exe");
        Text = test ? "Homebox - Test" : "Homebox - \u4e2a\u4eba\u8bbe\u5907\u5e93";
        ClientSize = StartupClientSize;
        MinimumSize = new Size(700, 500);
        StartPosition = FormStartPosition.CenterScreen;
        AutoScaleMode = AutoScaleMode.Dpi;
        BackColor = Color.White;
        Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        status = new Label { Dock = DockStyle.Fill, TextAlign = ContentAlignment.MiddleCenter,
            Font = new Font("Microsoft YaHei UI", 12), Text = "\u6b63\u5728\u542f\u52a8 Homebox..." };
        browser = new WebView2 { Dock = DockStyle.Fill, Visible = false, DefaultBackgroundColor = Color.White };
        Controls.Add(browser); Controls.Add(status);
        Shown += delegate { startup = StartAsync(); };
        FormClosing += CloseAsync;
        activation = ThreadPool.RegisterWaitForSingleObject(activate, delegate
        {
            if (IsHandleCreated && !IsDisposed)
                BeginInvoke((Action)delegate { if (WindowState == FormWindowState.Minimized) WindowState = FormWindowState.Normal; Show(); Activate(); });
        }, null, Timeout.Infinite, false);
    }

    protected override void OnLoad(EventArgs e)
    {
        base.OnLoad(e);
        // Apply after DPI scaling and include the title bar/borders in the screen limit.
        var bounds = FitStartupBounds(Screen.FromHandle(Handle).WorkingArea, SizeFromClientSize(StartupClientSize));
        MinimumSize = new Size(Math.Min(700, bounds.Width), Math.Min(500, bounds.Height));
        Bounds = bounds;
    }

    internal static Rectangle FitStartupBounds(Rectangle workingArea, Size preferredWindowSize)
    {
        const int margin = 16;
        int width = Math.Min(preferredWindowSize.Width, Math.Max(1, workingArea.Width - margin * 2));
        int height = Math.Min(preferredWindowSize.Height, Math.Max(1, workingArea.Height - margin * 2));
        return new Rectangle(workingArea.Left + (workingArea.Width - width) / 2,
            workingArea.Top + (workingArea.Height - height) / 2, width, height);
    }

    private async Task StartAsync()
    {
        try
        {
            // Check the system runtime before starting a server we might otherwise leave behind.
            CoreWebView2Environment.GetAvailableBrowserVersionString();
            Directory.CreateDirectory(data);
            string arguments = "-NoProfile -ExecutionPolicy Bypass -File \"" + Path.Combine(root, "Start-Homebox.ps1") + "\"";
            if (test) arguments += " -Port 7746 -TestInstance";
            var info = new ProcessStartInfo(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), "WindowsPowerShell", "v1.0", "powershell.exe"), arguments)
            {
                UseShellExecute = false, CreateNoWindow = true, WindowStyle = ProcessWindowStyle.Hidden,
                WorkingDirectory = root, RedirectStandardOutput = true, RedirectStandardError = true
            };
            using (var setup = Process.Start(info))
            {
                var output = setup.StandardOutput.ReadToEndAsync();
                var errors = setup.StandardError.ReadToEndAsync();
                await Task.Run((Action)setup.WaitForExit);
                if (setup.ExitCode != 0) throw new InvalidOperationException((await errors) + "\n" + (await output));
            }
            var state = ReadState();
            using (var process = MatchingServer(state))
            {
                if (process == null) throw new InvalidOperationException("Homebox server identity could not be verified.");
                owned = state;
                job = ServerJob.Attach(process);
            }
            if (closing) return;
            environment = await CoreWebView2Environment.CreateAsync(null, Path.Combine(data, "app-browser"));
            if (closing) return;
            await browser.EnsureCoreWebView2Async(environment);
            browser.CoreWebView2.NavigationStarting += delegate(object sender, CoreWebView2NavigationStartingEventArgs e)
            {
                if (!LocalAddress(e.Uri) && e.Uri != "about:blank") { e.Cancel = true; OpenExternal(e.Uri); }
            };
            browser.CoreWebView2.NewWindowRequested += OpenChild;
            browser.CoreWebView2.WindowCloseRequested += delegate { Close(); };
            browser.CoreWebView2.NavigationCompleted += delegate
            {
                if (!closing) { status.Visible = false; browser.Visible = true; browser.BringToFront(); }
            };
            browser.Source = new Uri("http://127.0.0.1:" + owned.port + "/");
        }
        catch (Exception error)
        {
            Log(error);
            if (!closing)
            {
                string message = error is WebView2RuntimeNotFoundException
                    ? "\u8bf7\u5148\u5b89\u88c5 Microsoft Edge WebView2 Runtime\uff0c\u7136\u540e\u91cd\u65b0\u6253\u5f00 Homebox\u3002"
                    : "Homebox \u542f\u52a8\u5931\u8d25\uff1a\n" + error.Message;
                MessageBox.Show(this, message, "Homebox", MessageBoxButtons.OK, MessageBoxIcon.Error);
                BeginInvoke((Action)Close);
            }
        }
    }

    private bool LocalAddress(string url)
    {
        Uri uri;
        return owned != null && Uri.TryCreate(url, UriKind.Absolute, out uri) && uri.Scheme == "http"
            && uri.Host == "127.0.0.1" && uri.Port == owned.port;
    }

    private static void OpenExternal(string url)
    {
        Uri uri;
        if (Uri.TryCreate(url, UriKind.Absolute, out uri) && (uri.Scheme == "http" || uri.Scheme == "https"))
            Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
    }

    private async void OpenChild(object sender, CoreWebView2NewWindowRequestedEventArgs e)
    {
        e.Handled = true;
        if (!LocalAddress(e.Uri)) { OpenExternal(e.Uri); return; }
        string url = e.Uri;
        var child = new Form { Text = "Homebox", Owner = this, Size = new Size(1000, 760), Icon = Icon, StartPosition = FormStartPosition.CenterParent };
        var view = new WebView2 { Dock = DockStyle.Fill };
        child.Controls.Add(view);
        child.Show(this);
        try
        {
            await view.EnsureCoreWebView2Async(environment);
            if (!child.IsDisposed)
            {
                view.CoreWebView2.NavigationStarting += delegate(object s, CoreWebView2NavigationStartingEventArgs nav)
                { if (!LocalAddress(nav.Uri) && nav.Uri != "about:blank") { nav.Cancel = true; OpenExternal(nav.Uri); } };
                view.Source = new Uri(url);
            }
        }
        catch (Exception error) { Log(error); child.Close(); }
    }

    private async void CloseAsync(object sender, FormClosingEventArgs e)
    {
        if (readyToClose) return;
        e.Cancel = true;
        if (closing) return;
        closing = true;
        status.Text = "\u6b63\u5728\u5173\u95ed Homebox...";
        status.Visible = true; status.BringToFront();
        try
        {
            if (startup != null) await startup;
            browser.Dispose();
            await Task.Run((Action)StopOwnedServer);
        }
        catch (Exception error) { Log(error); }
        finally { readyToClose = true; Close(); }
    }

    private ServerState ReadState()
    {
        return new JavaScriptSerializer().Deserialize<ServerState>(File.ReadAllText(Path.Combine(data, "server.json")));
    }

    private Process MatchingServer(ServerState state)
    {
        if (state == null) return null;
        Process process = null;
        try
        {
            process = Process.GetProcessById(state.pid);
            if (!process.HasExited && process.StartTime.ToUniversalTime().Ticks.ToString() == state.startedTicks
                && String.Equals(process.MainModule.FileName, serverPath, StringComparison.OrdinalIgnoreCase)) return process;
        }
        catch (ArgumentException) { }
        catch (InvalidOperationException) { }
        if (process != null) process.Dispose();
        return null;
    }

    private void StopOwnedServer()
    {
        if (owned == null) return;
        try
        {
            using (var process = MatchingServer(owned))
                if (process != null) { process.Kill(); process.WaitForExit(10000); }
            string file = Path.Combine(data, "server.json");
            if (File.Exists(file))
            {
                var current = ReadState();
                if (current.pid == owned.pid && current.startedTicks == owned.startedTicks) File.Delete(file);
            }
        }
        finally { if (job != null) { job.Dispose(); job = null; } }
    }

    private void Log(Exception error)
    {
        try { Directory.CreateDirectory(data); File.AppendAllText(Path.Combine(data, "launcher.log"), DateTime.UtcNow.ToString("o") + " " + error + Environment.NewLine); }
        catch { }
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            if (activation != null) activation.Unregister(null);
            try { StopOwnedServer(); } catch (Exception error) { Log(error); }
        }
        base.Dispose(disposing);
    }
}

// Keep the backend tied to this window even if the launcher is terminated unexpectedly.
internal sealed class ServerJob : IDisposable
{
    private IntPtr handle;
    [StructLayout(LayoutKind.Sequential)] private struct BasicLimits
    { public long PerProcessUserTimeLimit, PerJobUserTimeLimit; public uint LimitFlags; public UIntPtr MinimumWorkingSetSize, MaximumWorkingSetSize; public uint ActiveProcessLimit; public UIntPtr Affinity; public uint PriorityClass, SchedulingClass; }
    [StructLayout(LayoutKind.Sequential)] private struct IoCounters
    { public ulong ReadOperationCount, WriteOperationCount, OtherOperationCount, ReadTransferCount, WriteTransferCount, OtherTransferCount; }
    [StructLayout(LayoutKind.Sequential)] private struct ExtendedLimits
    { public BasicLimits BasicLimitInformation; public IoCounters IoInfo; public UIntPtr ProcessMemoryLimit, JobMemoryLimit, PeakProcessMemoryUsed, PeakJobMemoryUsed; }
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] private static extern IntPtr CreateJobObject(IntPtr security, string name);
    [DllImport("kernel32.dll")] private static extern bool SetInformationJobObject(IntPtr job, int infoClass, ref ExtendedLimits info, uint size);
    [DllImport("kernel32.dll")] private static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
    [DllImport("kernel32.dll")] private static extern bool CloseHandle(IntPtr handle);
    public static ServerJob Attach(Process process)
    {
        var job = new ServerJob { handle = CreateJobObject(IntPtr.Zero, null) };
        var limits = new ExtendedLimits(); limits.BasicLimitInformation.LimitFlags = 0x2000;
        if (job.handle == IntPtr.Zero || !SetInformationJobObject(job.handle, 9, ref limits, (uint)Marshal.SizeOf(limits)) || !AssignProcessToJobObject(job.handle, process.Handle))
        { job.Dispose(); return null; }
        return job;
    }
    public void Dispose() { if (handle != IntPtr.Zero) { CloseHandle(handle); handle = IntPtr.Zero; } }
}
