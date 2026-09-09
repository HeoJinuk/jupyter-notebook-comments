"""The rename must not remove the old extension before the new install succeeds."""

import contextlib
import importlib.util
import io
from pathlib import Path
import subprocess
import unittest
from unittest.mock import patch


PROJECT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("installer", PROJECT / "install.py")
installer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)


class InstallMigrationTests(unittest.TestCase):
    def run_installer(self, legacy, codes):
        lookup = {} if legacy else {"side_effect": installer.PackageNotFoundError}
        with (
            patch.object(installer, "version", **lookup),
            patch.object(Path, "glob", return_value=iter([Path("remoteEntry.test.js")])),
            patch.object(installer.subprocess, "run", side_effect=[
                subprocess.CompletedProcess([], code) for code in codes
            ]) as run,
            contextlib.redirect_stdout(io.StringIO()) as output,
            contextlib.redirect_stderr(io.StringIO()) as errors,
        ):
            status = installer.main()
        return status, run.call_args_list, output.getvalue(), errors.getvalue()

    def test_new_install_does_not_uninstall_any_package(self):
        status, calls, _, _ = self.run_installer(False, [0])
        self.assertEqual(status, 0)
        self.assertEqual(len(calls), 1)
        self.assertEqual(calls[0].args[0], [
            installer.sys.executable, "-m", "pip", "install", "--upgrade", str(PROJECT)
        ])

    def test_upgrade_installs_before_removing_old_package(self):
        status, calls, _, _ = self.run_installer(True, [0, 0])
        self.assertEqual(status, 0)
        self.assertEqual(calls[0].args[0][3], "install")
        self.assertEqual(calls[1].args[0], [
            installer.sys.executable, "-m", "pip", "uninstall", "--yes", "notebook-cell-comments"
        ])

    def test_install_failure_keeps_old_package(self):
        status, calls, output, _ = self.run_installer(True, [1])
        self.assertEqual(status, 1)
        self.assertEqual(len(calls), 1)
        self.assertNotIn("Installation complete", output)

    def test_failed_legacy_removal_is_not_reported_as_success(self):
        status, _, output, errors = self.run_installer(True, [0, 2])
        self.assertEqual(status, 2)
        self.assertNotIn("Installation complete", output)
        self.assertIn("Run this script again", errors)


if __name__ == "__main__":
    unittest.main()
