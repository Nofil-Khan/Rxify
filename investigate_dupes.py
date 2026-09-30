"""
RxNorm Duplicate SCD Investigation Script
==========================================
Investigates why multiple medicine rows exist for the same
generic_name + strength + form combination.

Run with:
    python investigate_dupes.py
"""
import sys
from database.db import get_conn
import psycopg2.extras

DIVIDER = "=" * 78
SEP     = "-" * 78


def query(cur, sql, params=None):
    cur.execute(sql, params or ())
    return cur.fetchall()


def section(title):
    print("\n" + DIVIDER)
    print("  " + title)
    print(DIVIDER)


# Medicines to investigate
TARGETS = [
    ("metformin",    "500 MG",  "TABLET"),
    ("omeprazole",   "20 MG",   "CAPSULE"),
    ("cetirizine",   "10 MG",   None),
    ("amlodipine",   "5 MG",    "TABLET"),
    ("atorvastatin", "20 MG",   "TABLET"),
    ("glimepiride",  "2 MG",    "TABLET"),
    ("azithromycin", "500 MG",  "TABLET"),
]


with get_conn() as conn:
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:

        # ── 0. Overall duplicate landscape ──────────────────────────────
        section("0. TOP DUPLICATE GROUPS  (generic_name + strength + form)")
        rows = query(cur, """
            SELECT
                LOWER(generic_name)  AS gname,
                strength,
                form::TEXT           AS form,
                COUNT(*)             AS cnt,
                array_agg(medicine_id ORDER BY medicine_id) AS ids
            FROM medicine
            WHERE generic_name IS NOT NULL
            GROUP BY LOWER(generic_name), strength, form
            HAVING COUNT(*) > 1
            ORDER BY cnt DESC, gname
            LIMIT 30
        """)
        print("\n%-30s %-25s %-12s %5s  %s" % ("Name", "Strength", "Form", "Cnt", "IDs"))
        print(SEP)
        for r in rows:
            ids_str = str(r['ids'])[:38]
            print("%-30s %-25s %-12s %5d  %s" % (
                r['gname'], str(r['strength']), str(r['form']), r['cnt'], ids_str))

        # ── 1. Deep-dive per target ──────────────────────────────────────
        for (gname, strength, form) in TARGETS:
            section("1. DEEP DIVE: %s  %s  %s" % (gname.upper(), strength, form or "(any form)"))

            form_clause = "AND form::TEXT = %(form)s" if form else ""
            sql = """
                SELECT
                    medicine_id,
                    generic_name,
                    brand_name,
                    strength,
                    form::TEXT     AS form,
                    rxcui,
                    rxnorm_name
                FROM medicine
                WHERE LOWER(generic_name) = %(gname)s
                  AND strength            = %(strength)s
                  """ + form_clause + """
                ORDER BY medicine_id
            """
            params = {"gname": gname, "strength": strength, "form": form}
            rows = query(cur, sql, params)

            print("\nFound %d rows:\n" % len(rows))
            for r in rows:
                print("  medicine_id : %s" % r['medicine_id'])
                print("  rxcui       : %s" % r['rxcui'])
                print("  generic_name: %s" % r['generic_name'])
                print("  brand_name  : %s" % r['brand_name'])
                print("  strength    : %s" % r['strength'])
                print("  form        : %s" % r['form'])
                print("  rxnorm_name : %s" % r['rxnorm_name'])
                print()

            if len(rows) <= 1:
                print("  --> No duplicates for this target.")
                continue

            names  = [r['rxnorm_name'] or '' for r in rows]
            rxcuis = [r['rxcui'] or ''       for r in rows]

            print("  rxnorm_name values (%d unique):" % len(set(names)))
            for n in sorted(set(names)):
                print("    '%s'" % n)

            print("\n  rxcui values (%d unique):" % len(set(rxcuis)))
            for c in sorted(set(rxcuis)):
                print("    %s" % c)

            if len(set(names)) == 1:
                print("\n  [!!] rxnorm_name is IDENTICAL across all rows -- true duplicates in import.")
            else:
                print("\n  [OK] rxnorm_name differs -- rows are DISTINCT RxNorm concepts.")

            if len(set(rxcuis)) == 1:
                print("  [!!] rxcui is IDENTICAL -- same concept imported more than once.")
            else:
                print("  [OK] rxcui differs    -- different RxNorm concept identifiers.")

        # ── 2. Metformin full strength ladder ───────────────────────────
        section("2. METFORMIN -- all rows (full ladder)")
        rows = query(cur, """
            SELECT medicine_id, strength, form::TEXT AS form, rxcui, rxnorm_name
            FROM medicine
            WHERE LOWER(generic_name) = 'metformin'
            ORDER BY strength, medicine_id
        """)
        print("\n%-12s %-20s %-12s %-12s %s" % ("ID", "Strength", "Form", "RXCUI", "rxnorm_name"))
        print(SEP)
        for r in rows:
            name_short = (r['rxnorm_name'] or '')[:45]
            print("%-12s %-20s %-12s %-12s %s" % (
                r['medicine_id'], str(r['strength']), str(r['form']),
                str(r['rxcui']), name_short))

        # ── 3. Cetirizine ───────────────────────────────────────────────
        section("3. CETIRIZINE -- all rows")
        rows = query(cur, """
            SELECT medicine_id, strength, form::TEXT AS form, rxcui, rxnorm_name
            FROM medicine
            WHERE LOWER(generic_name) = 'cetirizine'
            ORDER BY strength, form::TEXT, medicine_id
        """)
        print("\n%-12s %-50s %-12s %-12s" % ("ID", "Strength", "Form", "RXCUI"))
        print(SEP)
        for r in rows:
            print("%-12s %-50s %-12s %-12s" % (
                r['medicine_id'], str(r['strength']), str(r['form']), str(r['rxcui'])))

        # ── 4. Duplicate rxcui check ─────────────────────────────────────
        section("4. ROWS WITH DUPLICATE rxcui  (same concept, imported twice?)")
        rows = query(cur, """
            SELECT rxcui, COUNT(*) AS cnt,
                   array_agg(medicine_id ORDER BY medicine_id) AS ids,
                   MIN(generic_name) AS gname, MIN(strength) AS strength
            FROM medicine
            WHERE rxcui IS NOT NULL
            GROUP BY rxcui
            HAVING COUNT(*) > 1
            ORDER BY cnt DESC
            LIMIT 20
        """)
        if rows:
            print("\n%-12s %5s  %-30s  %-25s  %s" % ("RXCUI", "Cnt", "IDs", "Name", "Strength"))
            print(SEP)
            for r in rows:
                print("%-12s %5d  %-30s  %-25s  %s" % (
                    r['rxcui'], r['cnt'], str(r['ids'])[:28],
                    r['gname'], r['strength']))
        else:
            print("\n  No duplicate rxcuis -- each rxcui is unique in the table.")

        # ── 5. NULL rxcui rows (local/non-RxNorm entries) ───────────────
        section("5. ROWS WITH NULL rxcui  (non-RxNorm / local entries)")
        rows = query(cur, """
            SELECT medicine_id, generic_name, brand_name, strength,
                   form::TEXT AS form, rxnorm_name
            FROM medicine
            WHERE rxcui IS NULL
            ORDER BY medicine_id
            LIMIT 30
        """)
        print("\nFound %d rows with NULL rxcui (showing up to 30):\n" % len(rows))
        print("  %-8s %-20s %-15s %-15s %-12s %s" % (
            "ID", "Generic", "Brand", "Strength", "Form", "rxnorm_name"))
        print("  " + SEP)
        for r in rows:
            print("  %-8s %-20s %-15s %-15s %-12s %s" % (
                r['medicine_id'], str(r['generic_name'])[:18],
                str(r['brand_name'])[:13], str(r['strength'])[:13],
                str(r['form']), r['rxnorm_name'] or ''))

print("\n" + DIVIDER)
print("  Investigation complete.")
print(DIVIDER)
