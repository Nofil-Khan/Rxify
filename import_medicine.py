import json
import os
from collections import Counter

import psycopg

import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
# ============================================================
# CONFIG
# ============================================================

JSON_FILE = r"C:\Users\nofil\Downloads\medicines_clean.json"

# Uses DATABASE_URL from the environment.
# If it is not set, falls back to your local database.
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/rxify"
)


# ============================================================
# FORM MAPPING
# ============================================================

def map_form(rxnorm_form):
    """
    Convert RxNorm dose forms into the PostgreSQL medicine_form enum.
    """

    if not rxnorm_form:
        return "OTHER"

    form = rxnorm_form.lower().strip()

    if "tablet" in form:
        return "TABLET"

    if "capsule" in form:
        return "CAPSULE"

    if "syrup" in form:
        return "SYRUP"

    if "injection" in form:
        return "INJECTION"

    return "OTHER"


# ============================================================
# LOAD JSON
# ============================================================

def load_medicines(path):

    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


# ============================================================
# VALIDATE DATA
# ============================================================

def validate_medicines(medicines):

    errors = []

    seen_ids = set()
    seen_rxcuis = set()

    for medicine in medicines:

        medicine_id = medicine.get("medicine_id")

        if medicine_id is None:
            errors.append("Missing medicine_id")
            continue

        rxcui = str(medicine_id)

        # Duplicate medicine_id
        if medicine_id in seen_ids:
            errors.append(
                f"Duplicate medicine_id: {medicine_id}"
            )

        # Duplicate RxCUI
        if rxcui in seen_rxcuis:
            errors.append(
                f"Duplicate rxcui: {rxcui}"
            )

        seen_ids.add(medicine_id)
        seen_rxcuis.add(rxcui)

        # Required fields
        if not medicine.get("generic_name"):
            errors.append(
                f"Missing generic_name: {medicine_id}"
            )

        if not medicine.get("strength"):
            errors.append(
                f"Missing strength: {medicine_id}"
            )

        if not medicine.get("form"):
            errors.append(
                f"Missing form: {medicine_id}"
            )

        if not medicine.get("rxnorm_name"):
            errors.append(
                f"Missing rxnorm_name: {medicine_id}"
            )

    return errors


# ============================================================
# PREPARE DATA
# ============================================================

def prepare_rows(medicines):

    rows = []

    for medicine in medicines:

        medicine_id = medicine["medicine_id"]

        generic_name = medicine["generic_name"]

        strength = medicine["strength"]

        rxnorm_form = medicine["form"]

        rxnorm_name = medicine["rxnorm_name"]

        db_form = map_form(rxnorm_form)

        rxcui = str(medicine_id)

        rows.append(
            (
                medicine_id,
                generic_name,
                None,          # brand_name
                None,          # category
                strength,
                db_form,
                rxcui,
                rxnorm_name,
            )
        )

    return rows


# ============================================================
# BULK INSERT
# ============================================================

def insert_medicines(conn, medicines):

    sql = """
        INSERT INTO medicine (
            medicine_id,
            generic_name,
            brand_name,
            category,
            strength,
            form,
            rxcui,
            rxnorm_name
        )
        VALUES (
            %s,
            %s,
            %s,
            %s,
            %s,
            %s::medicine_form,
            %s,
            %s
        )
        ON CONFLICT (medicine_id)
        DO UPDATE SET
            generic_name = EXCLUDED.generic_name,
            strength = EXCLUDED.strength,
            form = EXCLUDED.form,
            rxcui = EXCLUDED.rxcui,
            rxnorm_name = EXCLUDED.rxnorm_name
    """

    rows = prepare_rows(medicines)

    with conn.cursor() as cur:

        # Send records in batches
        batch_size = 500

        for i in range(0, len(rows), batch_size):

            batch = rows[i:i + batch_size]

            cur.executemany(sql, batch)

            processed = min(
                i + batch_size,
                len(rows)
            )

            print(
                f"Processed {processed}/{len(rows)}"
            )

    return len(rows)


# ============================================================
# MAIN
# ============================================================

def main():

    print("=" * 60)
    print("RxNorm → PostgreSQL Medicine Import")
    print("=" * 60)

    # --------------------------------------------------------
    # Load JSON
    # --------------------------------------------------------

    print("\nLoading JSON...")

    medicines = load_medicines(JSON_FILE)

    print(
        f"Loaded medicines: {len(medicines)}"
    )

    # --------------------------------------------------------
    # Validate
    # --------------------------------------------------------

    print("\nValidating data...")

    errors = validate_medicines(medicines)

    if errors:

        print(
            f"\nValidation failed: {len(errors)} errors"
        )

        print("\nFirst 20 errors:")

        for error in errors[:20]:
            print(" -", error)

        return

    print("Validation passed.")

    # --------------------------------------------------------
    # Form distribution
    # --------------------------------------------------------

    distribution = Counter(
        map_form(medicine["form"])
        for medicine in medicines
    )

    print("\n" + "=" * 60)
    print("FORM DISTRIBUTION")
    print("=" * 60)

    for form, count in distribution.most_common():

        print(
            f"{form:12} : {count}"
        )

    # --------------------------------------------------------
    # Database
    # --------------------------------------------------------

    print("\nConnecting to PostgreSQL...")

    try:

        with psycopg.connect(DATABASE_URL) as conn:

            print("Connected.")

            print("\nStarting bulk transaction...")

            processed = insert_medicines(
                conn,
                medicines
            )

            conn.commit()

            print("\nTransaction committed.")

    except Exception as e:

        print("\n" + "=" * 60)
        print("IMPORT FAILED")
        print("=" * 60)

        print(
            type(e).__name__
        )

        print(e)

        print(
            "\nNo changes were committed."
        )

        return

    # --------------------------------------------------------
    # Summary
    # --------------------------------------------------------

    print("\n" + "=" * 60)
    print("IMPORT COMPLETE")
    print("=" * 60)

    print(
        f"Processed: {processed}"
    )

    print(
        f"Total JSON records: {len(medicines)}"
    )

    print("Status: SUCCESS")


# ============================================================
# ENTRY POINT
# ============================================================

if __name__ == "__main__":
    main()