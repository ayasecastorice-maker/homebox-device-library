"""Build unsigned Intel and Apple Silicon archives from a clean source checkout."""
import argparse
import hashlib
import os
from pathlib import Path
import shutil
import stat
import struct
import subprocess
import tempfile
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
UI = ROOT / "frontend/.output/public"


def copy_backend(work):
    static = ROOT / "backend/app/api/static"

    def ignored(directory, names):
        deny = {".git", ".data", ".runtime", "local-data", "node_modules"}
        if Path(directory) == static:
            deny.add("public")
        return set(names) & deny

    source = work / "backend"
    shutil.copytree(ROOT / "backend", source, ignore=ignored)
    shutil.copytree(UI, source / "app/api/static/public")
    return source


def add_file(archive, path, name, executable=False):
    entry = ZipInfo(name)
    entry.create_system = 3
    entry.external_attr = (stat.S_IFREG | (0o755 if executable else 0o644)) << 16
    entry.compress_type = ZIP_DEFLATED
    with path.open("rb") as src, archive.open(entry, "w") as dst:
        shutil.copyfileobj(src, dst)


def digest(path):
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=ROOT / "dist/macos")
    args = parser.parse_args()
    out = args.out.resolve()
    out.mkdir(parents=True, exist_ok=True)
    for route in ("", "devices", "equipment-groups", "device-statistics"):
        if not (UI / route / "index.html").is_file():
            raise SystemExit("Missing generated UI; build frontend first.")
    sums = []
    with tempfile.TemporaryDirectory() as temp:
        work = Path(temp)
        source = copy_backend(work)
        for arch, cpu in (("arm64", 0x0100000C), ("amd64", 0x01000007)):
            env = dict(os.environ, GOOS="darwin", GOARCH=arch, CGO_ENABLED="0", GOWORK="off")
            binaries = {"bin/homebox": "./app/api", "bin/start": str(HERE / "start_darwin.go")}
            for name, target in binaries.items():
                dest = work / name
                dest.parent.mkdir(exist_ok=True)
                subprocess.run(["go", "build", "-trimpath", "-buildvcs=false", "-mod=readonly",
                                "-ldflags=-s -w", "-o", str(dest), target],
                               cwd=source, env=env, check=True)
                with dest.open("rb") as f:
                    if struct.unpack("<III", f.read(12))[:2] != (0xFEEDFACF, cpu):
                        raise ValueError("Wrong Mach-O target: " + name)
            tag = "Homebox-macOS-" + arch
            result = out / (tag + ".zip")
            with tempfile.NamedTemporaryFile(dir=out, delete=False, suffix=".part") as f:
                part = Path(f.name)
            try:
                with ZipFile(part, "w") as z:
                    for name in binaries:
                        add_file(z, work / name, tag + "/" + name, True)
                    add_file(z, HERE / "Start-Homebox.command", tag + "/Start-Homebox.command", True)
                    add_file(z, HERE / "README.md", tag + "/README.md")
                    add_file(z, ROOT / "LICENSE", tag + "/LICENSE")
                    public = ROOT / "frontend/public"
                    for notice in sorted(list((public / "licenses").rglob("*"))
                                         + list((public / "fonts").glob("*.txt"))):
                        if notice.is_file():
                            add_file(z, notice, tag + "/notices/" + notice.relative_to(public).as_posix())
                with ZipFile(part) as z:
                    if z.testzip() is not None:
                        raise ValueError("ZIP verification failed")
                part.replace(result)
            finally:
                part.unlink(missing_ok=True)
            sums.append(digest(result) + "  " + result.name)
            print("Built", result, flush=True)
    (out / "SHA256SUMS").write_bytes(("\n".join(sums) + "\n").encode("ascii"))


if __name__ == "__main__":
    main()
