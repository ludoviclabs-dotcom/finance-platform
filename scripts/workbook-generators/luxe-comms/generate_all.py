"""
Orchestrateur : genere les 7 workbooks NEURAL / LUXE / Communication dans l'ordre.
Utilisation :  python generate_all.py
"""
import importlib
import sys
import time
from pathlib import Path

MODULES = [
    ("FOUNDATIONS",       "generate_foundations"),
    ("MASTER",            "generate_master"),
    ("AG-001 VoiceGuard", "generate_ag001_voiceguard"),
    ("AG-005 GreenClaim", "generate_ag005_greenclaim"),
    ("AG-002 PressAgent", "generate_ag002_press"),
    ("AG-004 Heritage",   "generate_ag004_heritage"),
    ("AG-003 EventComms", "generate_ag003_events"),
]

OUT_DIR = Path(r"C:\Users\Ludo\Desktop\IA projet entreprises\NEURAL - LUXE - Communication")


def main():
    sys.path.insert(0, str(Path(__file__).parent))
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    t0 = time.time()
    print("=" * 72)
    print("  NEURAL / LUXE / COMMUNICATION — Generation complete")
    print("=" * 72)
    for label, mod_name in MODULES:
        t = time.time()
        try:
            if mod_name in sys.modules:
                m = importlib.reload(sys.modules[mod_name])
            else:
                m = importlib.import_module(mod_name)
            m.build()
            print(f"  [{label:24s}] {time.time()-t:.2f}s")
        except Exception as e:
            print(f"  [{label:24s}] ERROR: {e}")
            raise
    # Listing final
    print("-" * 72)
    total = 0
    for p in sorted(OUT_DIR.glob("NEURAL_*.xlsx")):
        sz = p.stat().st_size / 1024
        total += sz
        print(f"  {p.name:60s}  {sz:7.1f} KB")
    print("-" * 72)
    print(f"  Total : {total:.1f} KB  en  {time.time()-t0:.2f}s")
    print(f"  Dossier : {OUT_DIR}")


if __name__ == "__main__":
    main()
