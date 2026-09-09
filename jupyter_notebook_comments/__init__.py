"""Prebuilt frontend extension; no kernel or custom server is required."""

__version__ = "0.5.0"


def _jupyter_labextension_paths():
    return [{"src": "labextension", "dest": "jupyter-notebook-comments"}]
