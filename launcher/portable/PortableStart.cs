using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Windows.Forms;

[assembly: AssemblyTitle("Homebox")]
[assembly: AssemblyDescription("Homebox offline portable launcher")]
[assembly: AssemblyVersion("1.1.0.0")]
internal static class PortableStart
{
    [STAThread]
    private static void Main()
    {
        string root = AppDomain.CurrentDomain.BaseDirectory;
        string launcher = Path.Combine(root, ".runtime", "desktop", "Homebox.exe");
        string runtime = Path.Combine(root, ".runtime", "webview2");
        string data = Path.Combine(root, "local-data");
        try
        {
            if (!File.Exists(launcher) || !File.Exists(Path.Combine(runtime, "msedgewebview2.exe")))
                throw new FileNotFoundException("Please extract the complete Homebox folder to a local writable folder before starting.");
            if (new Uri(root).IsUnc)
                throw new InvalidOperationException("Copy Homebox to a local disk. The bundled runtime cannot run from a network share.");
            Directory.CreateDirectory(data);
            PrepareRuntime(runtime, data);
            var start = new ProcessStartInfo(launcher)
            {
                WorkingDirectory = root,
                UseShellExecute = false
            };
            // Process-local overrides keep the original installation and system settings untouched.
            start.EnvironmentVariables["WEBVIEW2_BROWSER_EXECUTABLE_FOLDER"] = runtime;
            start.EnvironmentVariables["WEBVIEW2_USER_DATA_FOLDER"] = Path.Combine(data, "app-browser");
            Process.Start(start);
        }
        catch (Exception error)
        {
            MessageBox.Show(error.Message, "Homebox", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    private static void PrepareRuntime(string runtime, string data)
    {
        string marker = Path.Combine(data, "runtime-access.txt");
        string identity = Environment.MachineName + "|" + runtime;
        if (File.Exists(marker) && File.ReadAllText(marker) == identity) return;
        // Microsoft requires read/execute access for the renderer's AppContainer on Windows 10.
        // This grants no write access and never changes permissions on the user's data folder.
        var info = new ProcessStartInfo(Path.Combine(Environment.SystemDirectory, "icacls.exe"),
            "\"" + runtime + "\" /grant \"*S-1-15-2-2:(OI)(CI)(RX)\" \"*S-1-15-2-1:(OI)(CI)(RX)\"")
        {
            UseShellExecute = false,
            CreateNoWindow = true,
            WindowStyle = ProcessWindowStyle.Hidden,
            RedirectStandardOutput = true,
            RedirectStandardError = true
        };
        using (var process = Process.Start(info))
        {
            string output = process.StandardOutput.ReadToEnd();
            string errors = process.StandardError.ReadToEnd();
            process.WaitForExit();
            if (process.ExitCode != 0)
                throw new InvalidOperationException("Cannot prepare the bundled runtime. Extract Homebox to a local writable folder.\n" + errors + output);
        }
        File.WriteAllText(marker, identity);
    }
}
