"""
diff_service.py — T5.5 : comparaison de deux snapshots (multi-exercices).

Aplatit deux snapshots et calcule les variations par poste (numériques),
les nouveaux postes (added), les postes disparus (removed) et les champs
non numériques modifiés (ex. version de facteur — meta_changed). Fonction PURE.
"""

from __future__ import annotations

from typing import Any


def _flatten(d: Any, prefix: str = "", *, numeric: bool) -> dict[str, Any]:
    out: dict[str, Any] = {}
    if not isinstance(d, dict):
        return out
    for k, v in d.items():
        key = f"{prefix}.{k}" if prefix else str(k)
        if isinstance(v, dict):
            out.update(_flatten(v, key, numeric=numeric))
        elif numeric and isinstance(v, (int, float)) and not isinstance(v, bool):
            out[key] = float(v)
        elif not numeric and isinstance(v, str):
            out[key] = v
    return out


def diff_snapshots(snap_a: dict[str, Any] | None, snap_b: dict[str, Any] | None) -> dict[str, Any]:
    """Compare snap_a (référence/ancien) à snap_b (récent/nouveau). PURE.

    `change_pct` = (b - a) / |a| × 100, None si a = 0. Identifie 100 % des
    variations numériques injectées entre les deux snapshots.
    """
    fa = _flatten(snap_a, numeric=True)
    fb = _flatten(snap_b, numeric=True)
    keys = set(fa) | set(fb)

    changed, added, removed = [], [], []
    for k in sorted(keys):
        a, b = fa.get(k), fb.get(k)
        if a is None and b is not None:
            added.append({"path": k, "value": b})
        elif b is None and a is not None:
            removed.append({"path": k, "value": a})
        elif a != b:
            change_pct = round((b - a) / abs(a) * 100, 2) if a != 0 else None
            changed.append({"path": k, "before": a, "after": b, "delta": round(b - a, 6),
                            "change_pct": change_pct})

    # Champs texte modifiés (ex. version de facteur d'émission).
    sa = _flatten(snap_a, numeric=False)
    sb = _flatten(snap_b, numeric=False)
    meta_changed = [{"path": k, "before": sa.get(k), "after": sb.get(k)}
                    for k in sorted(set(sa) | set(sb))
                    if sa.get(k) != sb.get(k)]

    return {
        "changed": changed,
        "added": added,
        "removed": removed,
        "meta_changed": meta_changed,
        "changed_count": len(changed),
        "added_count": len(added),
        "removed_count": len(removed),
    }
