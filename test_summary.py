"""Summarize test results from temp.py test cases."""
import json
import sys
from services.medicine_matcher import resolve_medicine

samples = [
    # 1. Combination medicines
    ("Tab Janumet 50/500mg", "50/500mg", "tablet"),
    ("Janumet 50/1000", "50/1000mg", "tablet"),
    ("Tab Augmentin 625mg", "625mg", "tablet"),
    ("Augmentin 625", "625mg", "tablet"),
    ("Amoxicillin Clavulanate 500/125mg", "500/125mg", "tablet"),
    # 2. Brand-name medicines
    ("Dolo 650", "650mg", "tablet"),
    ("Paracetamol 500mg", "500mg", "tablet"),
    ("Crocin 500", "500mg", "tablet"),
    ("Calpol 500", "500mg", "tablet"),
    ("Lipitor 20", "20mg", "tablet"),
    ("Glucophage 500", "500mg", "tablet"),
    # 3. Generic medicines
    ("Glimepiride 2mg", "2mg", "tablet"),
    ("Metformin 500mg", "500mg", "tablet"),
    ("Atorvastatin 20mg", "20mg", "tablet"),
    ("Omeprazole 20mg", "20mg", "capsule"),
    ("Amlodipine 5mg", "5mg", "tablet"),
    ("Azithromycin 500mg", "500mg", "tablet"),
    ("Cetirizine 10mg", "10mg", "tablet"),
    # 4. Form prefixes/suffixes
    ("Tab Glimepiride 2mg", "2mg", "tablet"),
    ("Tablet Glimepiride 2mg", "2mg", "tablet"),
    ("Cap Omeprazole 20mg", "20mg", "capsule"),
    ("Capsule Omeprazole 20mg", "20mg", "capsule"),
    ("Lipitor 20 cap", "20mg", "tablet"),
    ("Metformin 500 tab", "500mg", "tablet"),
    ("Inj Ceftriaxone 1g", "1g", "injection"),
    ("Syrup Paracetamol 250mg", "250mg", "syrup"),
    # 5. Formatting variations
    ("Glimepiride 2 mg", "2 mg", "tablet"),
    ("METFORMIN 500 MG", "500 MG", "tablet"),
    ("metformin 500mg", "500mg", "tablet"),
    ("  Metformin   500mg  ", "500mg", "tablet"),
    ("Omeprazole-20mg", "20mg", "capsule"),
    # 6. Missing dosage
    ("Glimepiride", None, "tablet"),
    ("Metformin", None, "tablet"),
    ("Omeprazole", None, "capsule"),
    ("Dolo", None, "tablet"),
    # 7. Missing form
    ("Glimepiride 2mg", "2mg", None),
    ("Metformin 500mg", "500mg", None),
    ("Omeprazole 20mg", "20mg", None),
    ("Paracetamol 500mg", "500mg", None),
    # 8. Missing both
    ("Glimepiride", None, None),
    ("Metformin", None, None),
    ("Paracetamol", None, None),
    ("Omeprazole", None, None),
    # 9. OCR variations
    ("Metformn 500mg", "500mg", "tablet"),
    ("Glimepride 2mg", "2mg", "tablet"),
    ("Omeprazol 20mg", "20mg", "capsule"),
    ("Paracetmol 500mg", "500mg", "tablet"),
    ("Atorvastain 20mg", "20mg", "tablet"),
    # 10. Real prescription examples
    ("Tyloox LB 100", "100mg", "tablet"),
    ("Bpb Sr", None, "tablet"),
    ("Budetrol M cap to inhaler 400", "400mcg", "capsule"),
    ("Doxalin 400", "400mg", "tablet"),
    ("Atous CL", None, "tablet"),
    ("Cap Rabyle D", None, "capsule"),
    ("Polybion", None, None),
    ("Tab Janumet 50/500mg", "50/500mg", "tablet"),
    ("Tab Glimepiride 2mg", "2mg", "tablet"),
    # 11. Ambiguous
    ("Paracetamol", None, None),
    ("Amoxicillin", None, None),
    ("Metformin", None, None),
    ("Hydrocortisone", None, None),
    ("Insulin", None, None),
    # 12. Different forms
    ("Hydrocortisone 10mg/ml", "10mg/ml", None),
    ("Hydrocortisone 0.025mg/mg", "0.025mg/mg", None),
    ("Digoxin 0.25mg/ml", "0.25mg/ml", "injection"),
    ("Glycerin 2000mg", "2000mg", None),
    # 13. Combo formatting
    ("Janumet 50 / 500", "50/500mg", "tablet"),
    ("Janumet 50-500", "50/500mg", "tablet"),
    ("Janumet 50mg/500mg", "50mg/500mg", "tablet"),
    ("Augmentin 500/125", "500/125mg", "tablet"),
    ("Amoxicillin/Clavulanate 500/125mg", "500/125mg", "tablet"),
    # 14. Non-medicines
    ("Butter Chicken Naan", None, None),
    ("Paneer With Amritsari Naan", None, None),
    ("Drink warm milk before bed", None, None),
    ("Take after breakfast", None, None),
    ("Before sleeping", None, None),
    ("Twice daily", None, None),
    ("Patient should rest", None, None),
    ("Headache and fever", None, None),
    # 15. Garbage
    ("", None, None),
    ("123456", None, None),
    ("xyzabc", None, None),
    ("????", None, None),
    ("@#$%^", None, None),
]

counts = {"MATCHED": 0, "AMBIGUOUS": 0, "UNRESOLVED": 0, "NOT_A_MEDICINE": 0, "ERROR": 0}
issues = []

for raw, dose, form in samples:
    result = resolve_medicine(raw, extracted_dosage=dose, extracted_form=form)
    status = result.get("status", "ERROR")
    counts[status] = counts.get(status, 0) + 1
    
    # Flag problematic results
    note = ""
    if status == "AMBIGUOUS":
        note = f"  candidates: {[c['matched_name'] + ' ' + str(c.get('strength','')) for c in result.get('candidates', [])[:3]]}"
    elif status == "UNRESOLVED":
        note = f"  reason: {result.get('reason','')[:80]}"
    elif status == "MATCHED":
        note = f"  -> {result['matched_name']} {result.get('strength','')} ({result['match_method']})"
    elif status == "NOT_A_MEDICINE":
        note = f"  (ok)"
    
    print(f"[{status:15}] {raw!r:40} {note}")

print()
print("=" * 60)
print("SUMMARY")
print("=" * 60)
for k, v in counts.items():
    print(f"  {k:20}: {v}")
print(f"  {'TOTAL':20}: {sum(counts.values())}")
