"""
inject_carbon_test_data.py
--------------------------
Injects realistic test values into CarbonCo_Calcul_Carbone_v2.xlsx so that
the FastAPI /carbon/snapshot endpoint returns live non-zero numbers instead of
falling back to the template defaults.

Run once from the repo root:
    python scripts/inject_carbon_test_data.py

The script writes only the CC_* named-range cells; all other cells are left
untouched. The workbook is saved in-place. Back up first if needed.
"""

from pathlib import Path
import openpyxl

WORKBOOK_PATH = Path(r"C:\Users\Ludo\Desktop\IA projet entreprises\Carbon and Co\CarbonCo_Calcul_Carbone_v2.xlsx")

# ---------------------------------------------------------------------------
# Test values — representative PME, exercice 2024
# ---------------------------------------------------------------------------
TEST_DATA = {
    # Onglet Paramètres
    ("Paramètres", "B4"):  "Acme Industries SAS",   # CC_Raison_Sociale
    ("Paramètres", "B6"):  "Fabrication métallique", # CC_Secteur_Activite
    ("Paramètres", "C6"):  "25.11",                  # CC_Secteur_NAF
    ("Paramètres", "B7"):  2024,                     # CC_Annee_Reporting
    ("Paramètres", "B9"):  18_500_000,               # CC_CA_Net (€) — 18,5 M€
    ("Paramètres", "B11"): 145,                      # CC_ETP
    ("Paramètres", "B12"): 4_200,                    # CC_Surface_Totale (m²)
    ("Paramètres", "B14"): 2_400_000,                # CC_CapEx_Total (€)
    ("Paramètres", "B15"): 620_000,                  # CC_OpEx_Eligible_Taxo (€)

    # Onglet Synthese_GES
    ("Synthese_GES", "C10"): 1_336,   # CC_GES_Scope1  (tCO2e)
    ("Synthese_GES", "C15"): 934,     # CC_GES_Scope2_LB (tCO2e)
    ("Synthese_GES", "C17"): 1_020,   # CC_GES_Scope2_MB (tCO2e)
    ("Synthese_GES", "C35"): 3_685,   # CC_GES_Scope3  (tCO2e)
    ("Synthese_GES", "C47"): 5_955,   # CC_GES_Total_S123
    ("Synthese_GES", "C50"): 322,     # CC_Intensite_CA  (tCO2e/M€)
    ("Synthese_GES", "C51"): 41,      # CC_Intensite_ETP (tCO2e/ETP)
    ("Synthese_GES", "C53"): 22.4,    # CC_Part_Scope1 (%)
    ("Synthese_GES", "C54"): 15.7,    # CC_Part_Scope2 (%)
    ("Synthese_GES", "C55"): 61.9,    # CC_Part_Scope3 (%)

    # Onglet Energie
    ("Energie", "E19"): 2_150,   # CC_Conso_Energie_MWh
    ("Energie", "E20"): 38,      # CC_Part_ENR (%)

    # Onglet Taxonomie
    ("Taxonomie", "E27"): 35,  # CC_Taxo_CA_Aligne (%)
    ("Taxonomie", "E28"): 28,  # CC_Taxo_CapEx_Aligne (%)
    ("Taxonomie", "E29"): 22,  # CC_Taxo_OpEx_Aligne (%)

    # Onglet CBAM
    ("CBAM", "M24"): 48_000,  # CC_CBAM_Cout_Estime (€)

    # Onglet Trajectoire_SBTi
    ("Trajectoire_SBTi", "B4"): 2019,    # CC_SBTI_Annee_Baseline
    ("Trajectoire_SBTi", "B5"): 2_800,   # CC_SBTI_Baseline_S12 (tCO2e)
    ("Trajectoire_SBTi", "B6"): 4_200,   # CC_SBTI_Baseline_S3  (tCO2e)
    ("Trajectoire_SBTi", "B8"): 42,      # CC_SBTI_Taux_S12 (% reduction target)
    ("Trajectoire_SBTi", "B9"): 25,      # CC_SBTI_Taux_S3  (% reduction target)
}

# ---------------------------------------------------------------------------

def main() -> None:
    if not WORKBOOK_PATH.exists():
        raise FileNotFoundError(f"Workbook not found: {WORKBOOK_PATH}")

    print(f"Loading {WORKBOOK_PATH.name} …")
    wb = openpyxl.load_workbook(WORKBOOK_PATH)

    missing_sheets: list[str] = []
    for (sheet_name, cell_ref), value in TEST_DATA.items():
        if sheet_name not in wb.sheetnames:
            if sheet_name not in missing_sheets:
                missing_sheets.append(sheet_name)
            continue
        wb[sheet_name][cell_ref] = value

    if missing_sheets:
        print(f"  WARNING — sheets not found (skipped): {missing_sheets}")

    wb.save(WORKBOOK_PATH)
    print(f"  Saved. {len(TEST_DATA) - len(missing_sheets)} cells written.")
    print()
    print("Next: restart the FastAPI server and call GET /carbon/snapshot")
    print("      to verify the dashboard shows live data instead of mocks.")


if __name__ == "__main__":
    main()
