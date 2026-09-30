"""Quick focused test — parallel execution via ThreadPoolExecutor.

Each resolve_medicine() call gets its own pooled DB connection, so all
cases run concurrently instead of sequentially.

Works both in a terminal and inside a Jupyter notebook cell.

Usage:
    & "C:\\Users\\nofil\\anaconda3\\envs\\py312\\python.exe" quick_test.py
"""
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

# sys.stdout.reconfigure is only available on real file streams (not Jupyter's OutStream)
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from services.medicine_matcher import resolve_medicine

cases = [
    # --- OCR spelling variations (trgm path) ---
    ("Metformn 500mg",                    "500mg",    "tablet"),
    ("Glimepride 2mg",                    "2mg",      "tablet"),
    ("Omeprazol 20mg",                    "20mg",     "capsule"),
    ("Paracetmol 500mg",                  "500mg",    "tablet"),
    ("Atorvastain 20mg",                  "20mg",     "tablet"),
    # --- Brand / specialty names (trgm path) ---
    ("Polybion",                          None,       None),
    ("Bpb Sr",                            None,       "tablet"),
    ("Tyloox LB 100",                     "100mg",    "tablet"),
    ("Doxalin 400",                       "400mg",    "tablet"),
    ("Atous CL",                          None,       "tablet"),
    ("Cap Rabyle D",                      None,       "capsule"),
    ("Insulin",                           None,       None),
    # --- Combo formats ---
    ("Janumet 50-500",                    "50/500mg", "tablet"),
    ("Tab Janumet 50/500mg",              "50/500mg", "tablet"),
    ("Janumet 50 / 500",                  "50/500mg", "tablet"),
    ("Janumet 50mg/500mg",                "50mg/500mg", "tablet"),
    ("Amoxicillin/Clavulanate 500/125mg", "500/125mg", "tablet"),
    ("Augmentin 625",                     "625mg",    "tablet"),
    ("Tab Augmentin 625mg",               "625mg",    "tablet"),
    # --- Generics ---
    ("Glimepiride 2mg",                   "2mg",      "tablet"),
    ("Metformin 500mg",                   "500mg",    "tablet"),
    ("Paracetamol 500mg",                 "500mg",    "tablet"),
    ("Atorvastatin 20mg",                 "20mg",     "tablet"),
    ("Omeprazole 20mg",                   "20mg",     "capsule"),
    ("Amlodipine 5mg",                    "5mg",      "tablet"),
    ("Azithromycin 500mg",                "500mg",    "tablet"),
    # --- Non-medicines ---
    ("Take after breakfast",              None,       None),
    ("Before sleeping",                   None,       None),
    ("xyzabc",                            None,       None),
    ("123456",                            None,       None),
    ("Butter Chicken Naan",               None,       None),
]

MAX_WORKERS = 10  # stay well within pool maxconn=20


def _resolve_one(idx: int, raw: str, dose, form):
    """Resolve a single medicine; returns (original_idx, raw, dose, form, result)."""
    result = resolve_medicine(raw, extracted_dosage=dose, extracted_form=form)
    return idx, raw, dose, form, result


def main():
    print("=" * 70)
    print(f"  Medicine Matcher — Parallel Test  ({len(cases)} cases, {MAX_WORKERS} workers)")
    print("=" * 70)

    t0 = time.perf_counter()

    # Submit all resolutions concurrently
    ordered = [None] * len(cases)
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = {
            pool.submit(_resolve_one, i, raw, dose, form): i
            for i, (raw, dose, form) in enumerate(cases)
        }
        for fut in as_completed(futures):
            idx, raw, dose, form, result = fut.result()
            ordered[idx] = (raw, dose, form, result)

    elapsed = time.perf_counter() - t0

    # Print results in original submission order
    print()
    counts = {}
    ok = err = 0
    for raw, dose, form, result in ordered:
        status = result.get("status", "?")
        counts[status] = counts.get(status, 0) + 1

        is_db_err = "Database error" in result.get("reason", "") or \
                    "tuple index"   in result.get("reason", "")
        marker = "[FAIL]" if is_db_err else "[ OK ]"
        if is_db_err:
            err += 1
        else:
            ok += 1

        if status == "MATCHED":
            detail = "-> %s %s [%s]" % (
                result["matched_name"], result.get("strength", ""), result["match_method"]
            )
        elif status == "AMBIGUOUS":
            tops = [c["matched_name"] for c in result.get("candidates", [])[:2]]
            detail = "-> AMBIGUOUS %s" % tops
        elif status == "UNRESOLVED":
            detail = "-> %s" % result.get("reason", "")[:60]
        else:
            detail = "(not a medicine)"

        print("%s [%-15s] %-45s %s" % (marker, status, repr(raw)[:44], detail))

    # Summary
    print()
    print("=" * 70)
    print("SUMMARY")
    print("=" * 70)
    for k in ("MATCHED", "AMBIGUOUS", "UNRESOLVED", "NOT_A_MEDICINE"):
        print("  %-20s: %d" % (k, counts.get(k, 0)))
    print("  %-20s: %d" % ("TOTAL", sum(counts.values())))
    print()
    print("  Elapsed : %.2fs  (%.0f ms/case avg)" % (elapsed, elapsed / len(cases) * 1000))
    print("  Errors  : %d" % err)


if __name__ == "__main__":
    main()
