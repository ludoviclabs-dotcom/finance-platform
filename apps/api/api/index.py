import os
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
_API_ROOT = os.path.dirname(_HERE)
if _API_ROOT not in sys.path:
    sys.path.insert(0, _API_ROOT)

from main import app  # noqa: E402,F401
