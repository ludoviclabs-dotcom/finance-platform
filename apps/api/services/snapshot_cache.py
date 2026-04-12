from __future__ import annotations

"""
snapshot_cache.py — Lecture-write cache for all domain snapshots.

Strategy:
  - On Vercel (read-only filesystem outside /tmp), snapshots are written to /tmp/carbonco_snapshots/
  - In local dev, same /tmp path unless CARBONCO_CACHE_DIR env var overrides it
  - Each domain gets its own JSON file: carbon.json, vsme.json, esg.json, finance.json
  - POST /ingest recalculates all 4 and persists them; GET endpoints read cache first,
    fall back to live calculation if cache is missing or stale (> CACHE_TTL_SECONDS old)

This decouples Excel I/O (slow, ~1-3 s) from API reads (instant JSON).
"""

import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

CACHE_TTL_SECONDS = int(os.environ.get("CARBONCO_CACHE_TTL", "3600"))  # 1 h default

_DEFAULT_CACHE_DIR = Path(os.environ.get("CARBONCO_CACHE_DIR", "/tmp/carbonco_snapshots"))


def _cache_dir() -> Path:
    d = Path(os.environ.get("CARBONCO_CACHE_DIR", str(_DEFAULT_CACHE_DIR)))
    d.mkdir(parents=True, exist_ok=True)
    return d


def _cache_path(domain: str) -> Path:
    return _cache_dir() / f"{domain}.json"


# ---------------------------------------------------------------------------
# Write
# ---------------------------------------------------------------------------

def write_snapshot(domain: str, data: dict[str, Any]) -> None:
    """Persist a snapshot dict to the cache file for *domain*."""
    payload = {
        "_cachedAt": datetime.now(timezone.utc).isoformat(),
        "_domain": domain,
        "data": data,
    }
    path = _cache_path(domain)
    path.write_text(json.dumps(payload, ensure_ascii=False, default=str), encoding="utf-8")


# ---------------------------------------------------------------------------
# Read
# ---------------------------------------------------------------------------

def read_snapshot(domain: str) -> dict[str, Any] | None:
    """
    Return cached snapshot for *domain* if it exists and is within TTL.
    Returns None if cache is absent or stale.
    """
    path = _cache_path(domain)
    if not path.exists():
        return None
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        cached_at_str = payload.get("_cachedAt", "")
        cached_at = datetime.fromisoformat(cached_at_str)
        age = time.time() - cached_at.timestamp()
        if age > CACHE_TTL_SECONDS:
            return None
        return payload["data"]
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Cache meta
# ---------------------------------------------------------------------------

def cache_status() -> dict[str, Any]:
    """Return age and existence info for all domain caches."""
    domains = ["carbon", "vsme", "esg", "finance"]
    result: dict[str, Any] = {}
    for domain in domains:
        path = _cache_path(domain)
        if not path.exists():
            result[domain] = {"exists": False}
            continue
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
            cached_at_str = payload.get("_cachedAt", "")
            cached_at = datetime.fromisoformat(cached_at_str)
            age_s = int(time.time() - cached_at.timestamp())
            result[domain] = {
                "exists": True,
                "cachedAt": cached_at_str,
                "ageSeconds": age_s,
                "stale": age_s > CACHE_TTL_SECONDS,
            }
        except Exception as exc:
            result[domain] = {"exists": True, "error": str(exc)}
    return result


def invalidate(domain: str | None = None) -> None:
    """Delete cache file(s). If domain is None, invalidate all."""
    domains = [domain] if domain else ["carbon", "vsme", "esg", "finance"]
    for d in domains:
        p = _cache_path(d)
        if p.exists():
            p.unlink()
