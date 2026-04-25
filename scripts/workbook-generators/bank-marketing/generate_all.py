"""Generate all NEURAL Banque Marketing workbooks."""

from __future__ import annotations

import importlib
import time

from _styles import OUT_DIR

MODULES = [
    ("FOUNDATIONS", "generate_foundations"),
    ("MASTER", "generate_master"),
    ("AG-BM001 Compliance", "generate_agbm001_bank_marketing_compliance"),
    ("AG-BM002 Literacy", "generate_agbm002_fin_literacy_content"),
    ("AG-BM003 Segments", "generate_agbm003_segmented_bank_marketing"),
    ("AG-BM004 MiFID", "generate_agbm004_mifid_product_marketing_guard"),
]


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    started = time.perf_counter()
    outputs = []
    print("=" * 72)
    print("  NEURAL / BANQUE / MARKETING - generation")
    print("=" * 72)
    for label, module_name in MODULES:
        t0 = time.perf_counter()
        module = importlib.import_module(module_name)
        path = module.generate()
        elapsed = time.perf_counter() - t0
        outputs.append(path)
        print(f"  [{label:<22}] {elapsed:5.2f}s  {path.name}")

    print("-" * 72)
    total_size = 0
    for path in outputs:
        size = path.stat().st_size
        total_size += size
        print(f"  {path.name:<60} {size / 1024:7.1f} KB")
    print("-" * 72)
    print(f"  Total: {total_size / 1024:.1f} KB in {time.perf_counter() - started:.2f}s")
    print(f"  Folder: {OUT_DIR}")


if __name__ == "__main__":
    main()
