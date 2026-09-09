"""Prebuilt frontend extension; no kernel or custom server is required."""

__version__ = "0.4.1"


def _jupyter_labextension_paths():
    return [{"src": "labextension", "dest": "notebook-cell-comments"}]
