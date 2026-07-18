"""
purchase_import_service.py — import d'achats idempotent + gate + file de résolution (PR-05A).

Trois garanties par rapport à l'existant `import_screenings` (022) :
  1. **Idempotence de CONTENU** — `purchase_imports UNIQUE(company_id, sha256)` :
     rejouer le même fichier (mêmes octets) est un no-op, jamais un doublon de
     lignes. `import_screenings` n'a pas de hash de contenu.
  2. **Gate de revue** — un import naît `pending` ; une revue analyste le passe
     `validated` (accepté) ou `rejected`. Rien n'alimente le calcul (PR-05B)
     sans validation humaine.
  3. **File de résolution** — les lignes non rattachées à un produit fournisseur
     restent `unmapped` (ou `needs_review` si aucune donnée d'activité) et sont
     corrigées manuellement (`resolve_mappings`). Aucun fallback silencieux :
     une ligne non résolue est visible, pas devinée.

Le parsing (`parse_purchase_csv`) est PUR (bytes → lignes normalisées),
testable sans base ; il réutilise le patron de `csv_import_parsers` (détection
d'encodage/délimiteur, recherche de colonne tolérante). Le mapping automatique
à l'import est volontairement CONSERVATEUR : une ligne n'est `mapped` que si son
code produit externe correspond exactement à un `supplier_products.product_code`
du tenant — sinon elle part en file de résolution.
"""

from __future__ import annotations

import hashlib
import json
from datetime import date, datetime
from typing import Any

from db.database import get_db
from models.procurement import (
    LineResolution,
    PurchaseImportResponse,
    PurchaseLineResponse,
)
from services.csv_import_parsers import _find_col, _read_rows, _to_float

# Portée tenant stricte (aucune ligne globale sur ces tables).
_SCOPE = "company_id = %s"


class PurchaseImportError(Exception):
    """Erreur métier d'un import d'achats (introuvable, transition de gate invalide…)."""


# ---------------------------------------------------------------------------
# Parsing pur (testable sans DB)
# ---------------------------------------------------------------------------

def content_sha256(content: bytes) -> str:
    """SHA-256 hexadécimal du contenu brut — clé d'idempotence de contenu."""
    return hashlib.sha256(content).hexdigest()


def _to_date(value: str | None) -> date | None:
    if not value:
        return None
    v = value.strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%Y/%m/%d", "%m/%d/%Y"):
        try:
            return datetime.strptime(v, fmt).date()
        except ValueError:
            continue
    return None


def parse_purchase_csv(content: bytes) -> list[dict[str, Any]]:
    """Parse un CSV d'achats en lignes normalisées (pur). Colonnes reconnues de
    façon tolérante (nom contenant un mot-clé, minuscule) : fournisseur (code/
    nom), produit (code/référence), date, quantité, unité, dépense/montant,
    devise, catégorie, pays d'origine. Chaque ligne conserve son `raw` d'origine.

    Ne lève jamais sur une valeur manquante — une ligne sans donnée d'activité
    exploitable est marquée à l'insertion (`needs_review`), pas rejetée du parse.
    """
    rows, _encoding = _read_rows(content)
    fields = list(rows[0].keys())
    col = {
        "supplier": _find_col(fields, "supplier_code", "supplier", "fournisseur", "vendor"),
        "product": _find_col(fields, "product_code", "product", "produit", "sku", "reference", "référence"),
        "date": _find_col(fields, "date", "period"),
        "quantity": _find_col(fields, "quantity", "quantité", "quantite", "qty"),
        "unit": _find_col(fields, "unit", "unité", "unite", "uom"),
        "spend": _find_col(fields, "spend", "amount", "montant", "cost", "coût", "cout", "value"),
        "currency": _find_col(fields, "currency", "devise"),
        "category": _find_col(fields, "category", "catégorie", "categorie"),
        "country": _find_col(fields, "country", "pays", "origin"),
    }

    def _get(row: dict[str, str], key: str) -> str | None:
        name = col[key]
        return row.get(name) if name else None

    out: list[dict[str, Any]] = []
    for row in rows:
        spend_raw = _get(row, "spend")
        qty_raw = _get(row, "quantity")
        out.append({
            "supplier_external_code": _get(row, "supplier") or None,
            "product_external_code": _get(row, "product") or None,
            "purchase_date": _to_date(_get(row, "date")),
            "quantity": _to_float(qty_raw) if qty_raw else None,
            "unit": _get(row, "unit") or None,
            "spend_amount": _to_float(spend_raw) if spend_raw else None,
            "currency": _get(row, "currency") or None,
            "category_code": _get(row, "category") or None,
            "origin_country": _get(row, "country") or None,
            "raw": dict(row),
        })
    return out


# ---------------------------------------------------------------------------
# Import idempotent + gate + résolution (DB)
# ---------------------------------------------------------------------------

def _import_row_to_response(row: dict[str, Any], *, already_imported: bool) -> PurchaseImportResponse:
    return PurchaseImportResponse(**row, already_imported=already_imported)


def create_import(
    *,
    company_id: int,
    filename: str,
    content: bytes,
    period_start: date | None = None,
    period_end: date | None = None,
    imported_by: int | None = None,
) -> PurchaseImportResponse:
    """Crée un import d'achats, IDEMPOTENT par contenu (sha256). Rejouer le même
    fichier renvoie l'import existant (`already_imported=True`) sans réinsérer de
    ligne. Un import neuf parse le CSV, insère les lignes et calcule les compteurs
    dans la MÊME transaction."""
    sha = content_sha256(content)
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO purchase_imports
                    (company_id, filename, sha256, period_start, period_end, status, imported_by)
                VALUES (%s, %s, %s, %s, %s, 'pending', %s)
                ON CONFLICT (company_id, sha256) DO NOTHING
                RETURNING *
                """,
                (company_id, filename, sha, period_start, period_end, imported_by),
            )
            row = cur.fetchone()
            if row is None:
                # Idempotence de contenu : ce tenant a déjà importé ces octets.
                cur.execute(
                    f"SELECT * FROM purchase_imports WHERE {_SCOPE} AND sha256 = %s",
                    (company_id, sha),
                )
                existing = cur.fetchone()
                return _import_row_to_response(existing, already_imported=True)

            import_id = row["id"]
            parsed = parse_purchase_csv(content)
            accepted = rejected = 0
            for line in parsed:
                has_activity = line["spend_amount"] is not None or line["quantity"] is not None
                product_id, supplier_id, mapping_status = _auto_map(cur, company_id, line)
                if not has_activity:
                    mapping_status = "needs_review"
                    rejected += 1
                else:
                    accepted += 1
                cur.execute(
                    """
                    INSERT INTO purchase_lines
                        (company_id, import_id, supplier_id, supplier_external_code, product_id,
                         product_external_code, purchase_date, quantity, unit, spend_amount, currency,
                         category_code, origin_country, raw_row_json, mapping_status)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        company_id, import_id, supplier_id, line["supplier_external_code"], product_id,
                        line["product_external_code"], line["purchase_date"], line["quantity"],
                        line["unit"], line["spend_amount"], line["currency"], line["category_code"],
                        line["origin_country"], json.dumps(line["raw"]), mapping_status,
                    ),
                )
            cur.execute(
                "UPDATE purchase_imports SET row_count = %s, accepted_count = %s, rejected_count = %s, "
                "updated_at = now() WHERE id = %s RETURNING *",
                (len(parsed), accepted, rejected, import_id),
            )
            updated = cur.fetchone()
    return _import_row_to_response(updated, already_imported=False)


def _auto_map(cur, company_id: int, line: dict[str, Any]) -> tuple[int | None, int | None, str]:
    """Mapping automatique CONSERVATEUR : une ligne n'est `mapped` que si son
    code produit externe correspond exactement à un `supplier_products.product_code`
    du tenant. Sinon `unmapped` (file de résolution). Jamais de devinette floue."""
    code = line["product_external_code"]
    if code:
        cur.execute(
            f"SELECT id, supplier_id FROM supplier_products WHERE {_SCOPE} AND product_code = %s",
            (company_id, code),
        )
        match = cur.fetchone()
        if match is not None:
            return match["id"], match["supplier_id"], "mapped"
    return None, None, "unmapped"


def get_import(*, company_id: int, import_id: int) -> PurchaseImportResponse:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT * FROM purchase_imports WHERE id = %s AND {_SCOPE}", (import_id, company_id))
            row = cur.fetchone()
    if row is None:
        raise PurchaseImportError(f"Import '{import_id}' introuvable.")
    return _import_row_to_response(row, already_imported=False)


def list_imports(
    *, company_id: int, limit: int = 50, offset: int = 0,
) -> tuple[list[PurchaseImportResponse], int]:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) AS c FROM purchase_imports WHERE {_SCOPE}", (company_id,))
            total = cur.fetchone()["c"]
            cur.execute(
                f"SELECT * FROM purchase_imports WHERE {_SCOPE} "
                "ORDER BY imported_at DESC LIMIT %s OFFSET %s",
                (company_id, limit, offset),
            )
            rows = cur.fetchall()
    return [_import_row_to_response(r, already_imported=False) for r in rows], total


def _assert_import_in_scope(cur, company_id: int, import_id: int) -> None:
    cur.execute(f"SELECT 1 FROM purchase_imports WHERE id = %s AND {_SCOPE}", (import_id, company_id))
    if cur.fetchone() is None:
        raise PurchaseImportError(f"Import '{import_id}' introuvable.")


def list_lines(
    *,
    company_id: int,
    import_id: int,
    mapping_status: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[PurchaseLineResponse], int]:
    clauses = [_SCOPE, "import_id = %s"]
    params: list[Any] = [company_id, import_id]
    if mapping_status is not None:
        clauses.append("mapping_status = %s")
        params.append(mapping_status)
    where = f"WHERE {' AND '.join(clauses)}"
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) AS c FROM purchase_lines {where}", params)
            total = cur.fetchone()["c"]
            cur.execute(
                f"SELECT * FROM purchase_lines {where} ORDER BY id LIMIT %s OFFSET %s",
                (*params, limit, offset),
            )
            rows = cur.fetchall()
    return [PurchaseLineResponse(**r) for r in rows], total


def list_errors(*, company_id: int, import_id: int) -> list[PurchaseLineResponse]:
    """Lignes en anomalie de parse (`needs_review` : aucune donnée d'activité
    exploitable) — alimente `GET /procurement/imports/{id}/errors`."""
    lines, _ = list_lines(
        company_id=company_id, import_id=import_id, mapping_status="needs_review", limit=200,
    )
    return lines


def list_resolution_queue(
    *, company_id: int, import_id: int, limit: int = 50, offset: int = 0,
) -> tuple[list[PurchaseLineResponse], int]:
    """File de résolution : lignes `unmapped` (donnée exploitable mais produit
    non rattaché) à corriger manuellement."""
    return list_lines(
        company_id=company_id, import_id=import_id, mapping_status="unmapped",
        limit=limit, offset=offset,
    )


def resolve_mappings(
    *, company_id: int, import_id: int, resolutions: list[LineResolution], reviewed_by: int | None = None,
) -> dict[str, Any]:
    """Résout des lignes de la file : rattache produit/fournisseur et fixe le
    `mapping_status`. Valide que chaque ligne appartient à l'import du tenant, et
    que le produit/fournisseur cible est dans le périmètre. Aucun effet de bord
    caché : seules les lignes explicitement listées sont modifiées."""
    resolved = 0
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            _assert_import_in_scope(cur, company_id, import_id)
            for res in resolutions:
                if res.product_id is not None:
                    cur.execute(
                        f"SELECT 1 FROM supplier_products WHERE id = %s AND {_SCOPE}",
                        (res.product_id, company_id),
                    )
                    if cur.fetchone() is None:
                        raise PurchaseImportError(
                            f"Produit fournisseur '{res.product_id}' introuvable ou hors périmètre."
                        )
                if res.supplier_id is not None:
                    cur.execute(
                        "SELECT 1 FROM suppliers WHERE id = %s AND company_id = %s",
                        (res.supplier_id, company_id),
                    )
                    if cur.fetchone() is None:
                        raise PurchaseImportError(
                            f"Fournisseur '{res.supplier_id}' introuvable ou hors périmètre."
                        )
                cur.execute(
                    f"""
                    UPDATE purchase_lines
                    SET supplier_id = COALESCE(%s, supplier_id),
                        product_id = COALESCE(%s, product_id),
                        mapping_status = %s,
                        updated_at = now()
                    WHERE id = %s AND import_id = %s AND {_SCOPE}
                    """,
                    (res.supplier_id, res.product_id, res.mapping_status, res.line_id, import_id, company_id),
                )
                resolved += cur.rowcount
    return {"resolved": resolved, "requested": len(resolutions)}


def review_import(
    *, company_id: int, import_id: int, accept: bool, reviewed_by: int | None = None,
) -> PurchaseImportResponse:
    """Gate de revue : `pending` → `validated` (accept) ou `rejected`. Seul un
    import `pending` peut être revu (transition stricte, pas de re-revue
    silencieuse). L'émission vers le calcul (`emitted`) relève de PR-05B."""
    target = "validated" if accept else "rejected"
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT status FROM purchase_imports WHERE id = %s AND {_SCOPE}",
                (import_id, company_id),
            )
            row = cur.fetchone()
            if row is None:
                raise PurchaseImportError(f"Import '{import_id}' introuvable.")
            if row["status"] != "pending":
                raise PurchaseImportError(
                    f"Import '{import_id}' au statut '{row['status']}' — seul un import 'pending' est revu."
                )
            cur.execute(
                "UPDATE purchase_imports SET status = %s, updated_at = now() WHERE id = %s RETURNING *",
                (target, import_id),
            )
            updated = cur.fetchone()
    return _import_row_to_response(updated, already_imported=False)
