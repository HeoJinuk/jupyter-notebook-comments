#!/usr/bin/env python3
"""Install or update the extension in this Python interpreter's environment."""

from pathlib import Path
from importlib.metadata import PackageNotFoundError, version
import subprocess
import sys


def main() -> int:
    project = Path(__file__).resolve().parent
    assets = project / "jupyter_notebook_comments" / "labextension" / "static"
    if not any(assets.glob("remoteEntry.*.js")):
        print(
            "Prebuilt extension files are missing. Download the complete project "
            "or run npm ci and npm run build first.",
            file=sys.stderr,
        )
        return 1

    try:
        version("notebook-cell-comments")
        legacy_installed = True
    except PackageNotFoundError:
        legacy_installed = False

    print(f"Installing Jupyter Notebook Comments using {sys.executable}", flush=True)
    result = subprocess.run(
        [sys.executable, "-m", "pip", "install", "--upgrade", str(project)],
        cwd=project,
    )
    if result.returncode:
        print("Installation failed. See the pip output above.", file=sys.stderr)
        return result.returncode

    if legacy_installed:
        print("Removing the previous notebook-cell-comments package...", flush=True)
        result = subprocess.run(
            [sys.executable, "-m", "pip", "uninstall", "--yes", "notebook-cell-comments"],
            cwd=project,
        )
        if result.returncode:
            print(
                "The new package was installed, but the previous package could not be removed. "
                "Run this script again before restarting Jupyter to finish the upgrade.",
                file=sys.stderr,
            )
            return result.returncode

    print("\nInstallation complete. Save your notebooks and restart the Jupyter server.")
    print("Restarting only the kernel is not enough.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
