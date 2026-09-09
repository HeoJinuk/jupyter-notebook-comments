#!/usr/bin/env python3
"""Install or update the extension in this Python interpreter's environment."""

from pathlib import Path
import subprocess
import sys


def main() -> int:
    project = Path(__file__).resolve().parent
    assets = project / "notebook_cell_comments" / "labextension" / "static"
    if not any(assets.glob("remoteEntry.*.js")):
        print(
            "Prebuilt extension files are missing. Download the complete project "
            "or run npm ci and npm run build first.",
            file=sys.stderr,
        )
        return 1

    print(f"Installing Notebook Cell Comments using {sys.executable}", flush=True)
    result = subprocess.run(
        [sys.executable, "-m", "pip", "install", "--upgrade", str(project)],
        cwd=project,
    )
    if result.returncode:
        print("Installation failed. See the pip output above.", file=sys.stderr)
        return result.returncode

    print("\nInstallation complete. Save your notebooks and restart the Jupyter server.")
    print("Restarting only the kernel is not enough.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
