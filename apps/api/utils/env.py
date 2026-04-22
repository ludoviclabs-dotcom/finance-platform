from __future__ import annotations

import os
from pathlib import Path

_LOADED = False


def _should_skip_local_key(key: str) -> bool:
    return (
        key == "VERCEL"
        or key.startswith("VERCEL_")
        or key.startswith("TURBO_")
        or key.startswith("NX_")
    )


def _parse_env_line(raw: str) -> tuple[str, str] | None:
    line = raw.strip()
    if not line or line.startswith("#") or "=" not in line:
        return None

    key, value = line.split("=", 1)
    key = key.strip()
    value = value.strip()

    if value and len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
        value = value[1:-1]

    return key, value


def load_local_env() -> None:
    global _LOADED
    if _LOADED:
        return

    base_dir = Path(__file__).resolve().parent.parent
    explicit_env_keys = set(os.environ.keys())
    file_loaded_keys: set[str] = set()

    for candidate in (base_dir / ".env", base_dir / ".env.local"):
        if not candidate.exists():
            continue

        for raw in candidate.read_text(encoding="utf-8").splitlines():
            parsed = _parse_env_line(raw)
            if not parsed:
                continue

            key, value = parsed
            if _should_skip_local_key(key):
                continue
            if key in explicit_env_keys:
                continue

            os.environ[key] = value
            file_loaded_keys.add(key)

    if "ENV" not in explicit_env_keys and "ENV" not in file_loaded_keys:
        os.environ["ENV"] = "development"

    _LOADED = True
