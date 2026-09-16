"""
repair_master_workbooks.py — répare les classeurs maîtres CarbonCo (rapport QA
du 16/09/2026, anomalies M-01, M-02, M-03, M-12).

Constats :
  * CarbonCo_Calcul_Carbone_v2.xlsx (servi comme « modèle officiel ») :
    les lignes de détail de Synthese_GES sont des formules, mais les TOTAUX
    (Scope 1, 2 LB/MB, 3, total, intensités, parts) avaient été figés en
    constantes (1 336 / 934 / 1 020 / 3 685 / 5 955…), de même que l'énergie
    (Energie!E19:E20), la taxonomie (Taxonomie!E27:E29) et le coût CBAM
    (CBAM!M24). Quelles que soient les saisies, le modèle renvoyait ces
    chiffres. Les paramètres étaient pré-remplis avec une entreprise fictive
    (« Acme Industries SAS », CA 18,5 M€, 145 ETP…).
  * CarbonCo_ESG_Social.xlsx : les 34 plages nommées CC_VSME_* pointaient
    sur la colonne D (libellés) au lieu de la colonne E (valeurs) : la
    complétude VSME comptait les libellés comme des valeurs renseignées.

Méthode : édition XML ciblée des seules cellules concernées (le classeur
contient des graphiques qu'un aller-retour openpyxl supprimerait), calcul
complet forcé à l'ouverture (fullCalcOnLoad). Idempotent.

Références retenues :
  * GHG Protocol / méthode BEGES v5 : Scope 2 « location-based » dans le total
    réglementaire ; le « market-based » est publié à part.
  * ESRS E1-5 : part renouvelable = consommation renouvelable / consommation
    totale.
  * Règlement délégué (UE) 2021/2178 (art. 8 Taxonomie) : KPI = montant aligné
    / dénominateur (CA, CapEx, OpEx) ; alignement = éligible + contribution
    substantielle (objectif renseigné) + DNSH + garanties minimales.
  * Règlement (UE) 2023/956 (CBAM), art. 31 et directive 2003/87/CE art.
    10 bis §1 bis : part des émissions intrinsèques couverte par des
    certificats pendant la sortie progressive des quotas gratuits — 2,5 %
    (2026), 5 % (2027), 10 % (2028), 22,5 % (2029), 48,5 % (2030), 61 %
    (2031), 73,5 % (2032), 86 % (2033), 100 % à partir de 2034. Déclaration
    annuelle (période définitive depuis le 1er janvier 2026).

Usage :
    python scripts/carbonco/repair_master_workbooks.py [--root apps/api/data]
"""

from __future__ import annotations

import argparse
import re
import shutil
import tempfile
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape

DEFAULT_ROOT = Path(__file__).resolve().parents[2] / "apps" / "api" / "data"

CARBON_FILE = "CarbonCo_Calcul_Carbone_v2.xlsx"
ESG_FILE = "CarbonCo_ESG_Social.xlsx"

# Part payante CBAM par année (1 − facteur CBAM), cf. en-tête.
CBAM_PAYABLE_SHARE_FORMULA = (
    'IF(B5="","",IF(B5<2026,0,IF(B5=2026,0.025,IF(B5=2027,0.05,IF(B5=2028,0.1,'
    "IF(B5=2029,0.225,IF(B5=2030,0.485,IF(B5=2031,0.61,IF(B5=2032,0.735,"
    "IF(B5=2033,0.86,1))))))))))"
)

CARBON_FORMULAS: dict[str, dict[str, str]] = {
    "Synthese_GES": {
        "C10": "SUM(C6:C9)",
        "C15": "C13+C14",
        # Market-based : électricité MB + chaleur/vapeur/froid (sans
        # instrument contractuel dédié, même facteur qu'en location-based).
        "C17": "C16+C14",
        "C35": "SUM(C20:C34)",
        "C47": "C10+C15+C35",
        "C50": "IF(Paramètres!B9=0,0,C47/(Paramètres!B9/1000000))",
        "C51": "IF(Paramètres!B11=0,0,C47/Paramètres!B11)",
        "C53": "IF(C47=0,0,ROUND(C10/C47*100,1))",
        "C54": "IF(C47=0,0,ROUND(C15/C47*100,1))",
        "C55": "IF(C47=0,0,ROUND(C35/C47*100,1))",
    },
    "Energie": {
        "E19": "E10+E16",
        "E20": "IF(E19=0,0,ROUND(E16/E19*100,1))",
    },
    "Taxonomie": {
        **{
            f"G{r}": f'IF(AND(C{r}="O",D{r}<>"",E{r}="O",F{r}="O"),"O","N")'
            for r in range(14, 24)
        },
        "E27": "IF(F27=0,0,ROUND(D27/F27*100,1))",
        "E28": "IF(F28=0,0,ROUND(D28/F28*100,1))",
        "E29": "IF(F29=0,0,ROUND(D29/F29*100,1))",
    },
    "CBAM": {
        "B6": CBAM_PAYABLE_SHARE_FORMULA,
        **{
            f"M{r}": f'IF(OR(B{r}="",$B$6=""),0,MAX(0,I{r}*$B$4*$B$6-K{r}))'
            for r in range(9, 24)
        },
        "M24": "SUM(M9:M23)",
    },
}

# Libellés (texte en ligne), pour les cellules dont le sens change.
CARBON_LABELS: dict[str, dict[str, str]] = {
    "CBAM": {
        "A4": "Prix du quota EU ETS (€/tCO2) — à actualiser",
        "A5": "Année des importations (déclaration annuelle)",
        "A6": "Part des émissions couverte par des certificats (règl. (UE) 2023/956, art. 31)",
    },
    "Trajectoire_SBTi": {
        "A8": "Réduction visée Scope 1+2 à l'horizon (%)",
        "A9": "Réduction visée Scope 3 à l'horizon (%)",
    },
}

CARBON_NUMBERS: dict[str, dict[str, float]] = {
    "CBAM": {"B5": 2026},
}

# Valeurs en cache du modèle VIERGE (aucune donnée d'activité : tout vaut 0,
# sauf la part CBAM 2026). Le tableur recalcule tout à l'ouverture
# (fullCalcOnLoad) ; ces valeurs servent aux lecteurs qui ne recalculent pas,
# pour qu'un modèle vierge se lise « 0 », jamais « valeur absente ».
_ZERO_CELLS: dict[str, tuple[str, ...]] = {
    "Synthese_GES": (
        "C6", "C7", "C8", "C9", "C10", "C13", "C14", "C15", "C16", "C17",
        *(f"C{r}" for r in range(20, 36)), "C37", "C47", "C50", "C51", "C52",
        "C53", "C54", "C55",
    ),
    "Energie": ("E10", "E16", "E19", "E20"),
    "Taxonomie": ("E27", "E28", "E29"),
    "CBAM": (*(f"I{r}" for r in range(9, 24)), *(f"M{r}" for r in range(9, 25))),
}
CARBON_CACHED: dict[str, dict[str, float]] = {
    sheet: {ref: 0 for ref in refs} for sheet, refs in _ZERO_CELLS.items()
}
CARBON_CACHED["CBAM"]["B6"] = 0.025

# Saisies de démonstration retirées du modèle (entreprise fictive).
CARBON_CLEARED: dict[str, tuple[str, ...]] = {
    "Paramètres": ("B4", "B6", "C6", "B7", "B8", "B9", "B10", "B11", "B12", "B13", "B14", "B15"),
    "Trajectoire_SBTi": ("B4", "B5", "B6"),
}

_CELL_RE_TEMPLATE = (
    r'<c r="{ref}"(?P<attrs>(?:\s+[A-Za-z_:][\w:.-]*="[^"]*")*)\s*'
    r"(?:/>|>(?P<body>.*?)</c>)"
)


def _cell_re(ref: str) -> re.Pattern[str]:
    return re.compile(_CELL_RE_TEMPLATE.format(ref=re.escape(ref)), re.S)


def _style_attr(attrs: str) -> str:
    m = re.search(r'\ss="(\d+)"', attrs or "")
    return f' s="{m.group(1)}"' if m else ""


def _split_ref(ref: str) -> tuple[str, int]:
    m = re.fullmatch(r"([A-Z]{1,3})(\d+)", ref)
    if not m:
        raise ValueError(f"Référence invalide : {ref}")
    return m.group(1), int(m.group(2))


def _col_index(col: str) -> int:
    n = 0
    for ch in col:
        n = n * 26 + (ord(ch) - 64)
    return n


def _ensure_row(xml: str, row: int) -> str:
    if re.search(rf'<row r="{row}"[\s>/]', xml):
        return xml
    rows = [(int(m.group(1)), m.start()) for m in re.finditer(r'<row r="(\d+)"', xml)]
    later = [pos for r, pos in rows if r > row]
    new_row = f'<row r="{row}"></row>'
    if later:
        pos = min(later)
        return xml[:pos] + new_row + xml[pos:]
    return xml.replace("</sheetData>", new_row + "</sheetData>", 1)


def _put_cell(xml: str, ref: str, cell_xml_factory) -> str:
    """Remplace la cellule `ref` (ou l'insère à sa place dans la ligne)."""
    pattern = _cell_re(ref)
    m = pattern.search(xml)
    if m:
        return xml[: m.start()] + cell_xml_factory(_style_attr(m.group("attrs"))) + xml[m.end():]
    col, row = _split_ref(ref)
    xml = _ensure_row(xml, row)
    row_m = re.search(rf'(<row r="{row}"[^>]*?)(/>|>)(.*?)(</row>)?', xml, re.S)
    if row_m.group(2) == "/>":
        start = row_m.start()
        xml = xml[:start] + row_m.group(1) + "></row>" + xml[row_m.end():]
    row_m = re.search(rf'<row r="{row}"[^>]*>(?P<cells>.*?)</row>', xml, re.S)
    cells_start = row_m.start("cells")
    insert_at = row_m.end("cells")
    for cm in re.finditer(r'<c r="([A-Z]{1,3})\d+"', row_m.group("cells")):
        if _col_index(cm.group(1)) > _col_index(col):
            insert_at = cells_start + cm.start()
            break
    return xml[:insert_at] + cell_xml_factory("") + xml[insert_at:]


def set_formula(xml: str, ref: str, formula: str) -> str:
    return _put_cell(xml, ref, lambda s: f'<c r="{ref}"{s}><f>{escape(formula)}</f><v /></c>')


def set_text(xml: str, ref: str, text: str) -> str:
    return _put_cell(
        xml, ref,
        lambda s: f'<c r="{ref}"{s} t="inlineStr"><is><t>{escape(text)}</t></is></c>',
    )


def set_number(xml: str, ref: str, value: float) -> str:
    number = int(value) if float(value).is_integer() else value
    return _put_cell(xml, ref, lambda s: f'<c r="{ref}"{s} t="n"><v>{number}</v></c>')


def set_cached_value(xml: str, ref: str, value: float) -> str:
    """Valeur en cache d'une cellule formule (laisse la formule intacte)."""
    m = _cell_re(ref).search(xml)
    if not m or "<f>" not in (m.group("body") or ""):
        return xml
    number = int(value) if float(value).is_integer() else value
    body = re.sub(r"<v\s*/>|<v>[^<]*</v>", f"<v>{number}</v>", m.group("body"), count=1)
    if "<v>" not in body:
        body += f"<v>{number}</v>"
    return xml[: m.start("body")] + body + xml[m.end("body"):]


def clear_cell(xml: str, ref: str) -> str:
    pattern = _cell_re(ref)
    m = pattern.search(xml)
    if not m:
        return xml
    return xml[: m.start()] + f'<c r="{ref}"{_style_attr(m.group("attrs"))} />' + xml[m.end():]


def _sheet_parts(files: dict[str, bytes]) -> dict[str, str]:
    workbook = files["xl/workbook.xml"].decode("utf-8")
    rels = files["xl/_rels/workbook.xml.rels"].decode("utf-8")
    targets = {}
    for rel in re.finditer(r"<Relationship\b[^>]*>", rels):
        rid = re.search(r'Id="([^"]+)"', rel.group(0)).group(1)
        target = re.search(r'Target="([^"]+)"', rel.group(0)).group(1)
        targets[rid] = target
    parts = {}
    for sheet in re.finditer(r"<sheet\b[^>]*>", workbook):
        name = re.search(r'name="([^"]+)"', sheet.group(0)).group(1)
        rid = re.search(r'r:id="([^"]+)"', sheet.group(0)).group(1)
        target = targets[rid].lstrip("/")
        parts[name] = target if target.startswith("xl/") else f"xl/{target}"
    return parts


def _read_zip(path: Path) -> tuple[list[zipfile.ZipInfo], dict[str, bytes]]:
    with zipfile.ZipFile(path) as z:
        infos = z.infolist()
        return infos, {i.filename: z.read(i.filename) for i in infos}


def _write_zip(path: Path, infos: list[zipfile.ZipInfo], files: dict[str, bytes]) -> None:
    with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx", dir=path.parent) as tmp:
        tmp_path = Path(tmp.name)
    try:
        with zipfile.ZipFile(tmp_path, "w") as z:
            for info in infos:
                z.writestr(info, files[info.filename], compress_type=zipfile.ZIP_DEFLATED)
        shutil.move(str(tmp_path), path)
    finally:
        if tmp_path.exists():
            tmp_path.unlink()


def _force_full_calc(files: dict[str, bytes]) -> None:
    wb = files["xl/workbook.xml"].decode("utf-8")
    m = re.search(r"<calcPr\b[^>]*/>", wb)
    if m is None:
        wb = wb.replace("</workbook>", '<calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>', 1)
    elif "fullCalcOnLoad" not in m.group(0):
        wb = wb[: m.start()] + m.group(0)[:-2].rstrip() + ' fullCalcOnLoad="1"/>' + wb[m.end():]
    files["xl/workbook.xml"] = wb.encode("utf-8")


def repair_carbon(path: Path) -> None:
    infos, files = _read_zip(path)
    parts = _sheet_parts(files)
    sheets = set(CARBON_FORMULAS) | set(CARBON_LABELS) | set(CARBON_NUMBERS)
    sheets |= set(CARBON_CLEARED) | set(CARBON_CACHED)
    for sheet in sorted(sheets):
        part = parts[sheet]
        xml = files[part].decode("utf-8")
        for ref in CARBON_CLEARED.get(sheet, ()):
            xml = clear_cell(xml, ref)
        for ref, text in CARBON_LABELS.get(sheet, {}).items():
            xml = set_text(xml, ref, text)
        for ref, number in CARBON_NUMBERS.get(sheet, {}).items():
            xml = set_number(xml, ref, number)
        for ref, formula in CARBON_FORMULAS.get(sheet, {}).items():
            xml = set_formula(xml, ref, formula)
        for ref, value in CARBON_CACHED.get(sheet, {}).items():
            xml = set_cached_value(xml, ref, value)
        files[part] = xml.encode("utf-8")
    _force_full_calc(files)
    _write_zip(path, infos, files)


def repair_esg(path: Path) -> None:
    infos, files = _read_zip(path)
    wb = files["xl/workbook.xml"].decode("utf-8")

    def repoint(m: re.Match[str]) -> str:
        return m.group(1) + "$E$" + m.group(2)

    wb = re.sub(
        r"(<definedName\b[^>]*\bname=\"CC_VSME_[^\"]+\"[^>]*>'?VSME_Reporting'?!)\$D\$(\d+)",
        repoint,
        wb,
    )
    files["xl/workbook.xml"] = wb.encode("utf-8")
    _force_full_calc(files)
    _write_zip(path, infos, files)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    parser.add_argument("--root", default=str(DEFAULT_ROOT))
    args = parser.parse_args()
    root = Path(args.root)
    repair_carbon(root / CARBON_FILE)
    repair_esg(root / ESG_FILE)
    print(f"Classeurs réparés dans {root}")


if __name__ == "__main__":
    main()
