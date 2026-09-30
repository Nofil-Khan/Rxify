"""Quick testing script for the Medicine Matching / Resolution service.

Run it directly:
    python temp.py

Or with conda/specific env:
    & "C:\\Users\\nofil\\anaconda3\\envs\\py312\\python.exe" temp.py
"""

import json
from services.medicine_matcher import resolve_medicine, resolve_prescription_medications


def run_sample_tests():
    print("=" * 70)
    print("  Rxify Medicine Matcher -- Sample Test Run")
    print("=" * 70)

    # You can edit, add, or remove test cases here:
    samples = [
        # ============================================================
        # 1. Combination medicines
        # ============================================================
        ("Tab Janumet 50/500mg", "50/500mg", "tablet"),
        ("Janumet 50/1000", "50/1000mg", "tablet"),
        ("Tab Augmentin 625mg", "625mg", "tablet"),
        ("Augmentin 625", "625mg", "tablet"),
        ("Amoxicillin Clavulanate 500/125mg", "500/125mg", "tablet"),

        # ============================================================
        # 2. Brand-name medicines
        # ============================================================
        ("Dolo 650", "650mg", "tablet"),
        ("Paracetamol 500mg", "500mg", "tablet"),
        ("Crocin 500", "500mg", "tablet"),
        ("Calpol 500", "500mg", "tablet"),
        ("Lipitor 20", "20mg", "tablet"),
        ("Glucophage 500", "500mg", "tablet"),

        # ============================================================
        # 3. Generic medicines
        # ============================================================
        ("Glimepiride 2mg", "2mg", "tablet"),
        ("Metformin 500mg", "500mg", "tablet"),
        ("Atorvastatin 20mg", "20mg", "tablet"),
        ("Omeprazole 20mg", "20mg", "capsule"),
        ("Amlodipine 5mg", "5mg", "tablet"),
        ("Azithromycin 500mg", "500mg", "tablet"),
        ("Cetirizine 10mg", "10mg", "tablet"),

        # ============================================================
        # 4. Dosage-form prefixes / suffixes
        # ============================================================
        ("Tab Glimepiride 2mg", "2mg", "tablet"),
        ("Tablet Glimepiride 2mg", "2mg", "tablet"),
        ("Cap Omeprazole 20mg", "20mg", "capsule"),
        ("Capsule Omeprazole 20mg", "20mg", "capsule"),
        ("Lipitor 20 cap", "20mg", "tablet"),
        ("Metformin 500 tab", "500mg", "tablet"),
        ("Inj Ceftriaxone 1g", "1g", "injection"),
        ("Syrup Paracetamol 250mg", "250mg", "syrup"),

        # ============================================================
        # 5. Formatting / spacing variations
        # ============================================================
        ("Glimepiride 2 mg", "2 mg", "tablet"),
        ("METFORMIN 500 MG", "500 MG", "tablet"),
        ("metformin 500mg", "500mg", "tablet"),
        ("  Metformin   500mg  ", "500mg", "tablet"),
        ("Omeprazole-20mg", "20mg", "capsule"),

        # ============================================================
        # 6. Missing dosage
        # ============================================================
        ("Glimepiride", None, "tablet"),
        ("Metformin", None, "tablet"),
        ("Omeprazole", None, "capsule"),
        ("Dolo", None, "tablet"),

        # ============================================================
        # 7. Missing form
        # ============================================================
        ("Glimepiride 2mg", "2mg", None),
        ("Metformin 500mg", "500mg", None),
        ("Omeprazole 20mg", "20mg", None),
        ("Paracetamol 500mg", "500mg", None),

        # ============================================================
        # 8. Missing dosage AND form
        # ============================================================
        ("Glimepiride", None, None),
        ("Metformin", None, None),
        ("Paracetamol", None, None),
        ("Omeprazole", None, None),

        # ============================================================
        # 9. OCR / minor spelling variations
        # ============================================================
        ("Metformn 500mg", "500mg", "tablet"),
        ("Glimepride 2mg", "2mg", "tablet"),
        ("Omeprazol 20mg", "20mg", "capsule"),
        ("Paracetmol 500mg", "500mg", "tablet"),
        ("Atorvastain 20mg", "20mg", "tablet"),

        # ============================================================
        # 10. Real prescription examples
        # ============================================================
        ("Tyloox LB 100", "100mg", "tablet"),
        ("Bpb Sr", None, "tablet"),
        ("Budetrol M cap to inhaler 400", "400mcg", "capsule"),
        ("Doxalin 400", "400mg", "tablet"),
        ("Atous CL", None, "tablet"),
        ("Cap Rabyle D", None, "capsule"),
        ("Polybion", None, None),
        ("Tab Janumet 50/500mg", "50/500mg", "tablet"),
        ("Tab Glimepiride 2mg", "2mg", "tablet"),

        # ============================================================
        # 11. Potentially ambiguous names
        # ============================================================
        ("Paracetamol", None, None),
        ("Amoxicillin", None, None),
        ("Metformin", None, None),
        ("Hydrocortisone", None, None),
        ("Insulin", None, None),

        # ============================================================
        # 12. Different dosage forms
        # ============================================================
        ("Hydrocortisone 10mg/ml", "10mg/ml", None),
        ("Hydrocortisone 0.025mg/mg", "0.025mg/mg", None),
        ("Digoxin 0.25mg/ml", "0.25mg/ml", "injection"),
        ("Glycerin 2000mg", "2000mg", None),

        # ============================================================
        # 13. Combination dosage formatting
        # ============================================================
        ("Janumet 50 / 500", "50/500mg", "tablet"),
        ("Janumet 50-500", "50/500mg", "tablet"),
        ("Janumet 50mg/500mg", "50mg/500mg", "tablet"),
        ("Augmentin 500/125", "500/125mg", "tablet"),
        ("Amoxicillin/Clavulanate 500/125mg", "500/125mg", "tablet"),

        # ============================================================
        # 14. Obviously non-medicines
        # ============================================================
        ("Butter Chicken Naan", None, None),
        ("Paneer With Amritsari Naan", None, None),
        ("Drink warm milk before bed", None, None),
        ("Take after breakfast", None, None),
        ("Before sleeping", None, None),
        ("Twice daily", None, None),
        ("Patient should rest", None, None),
        ("Headache and fever", None, None),

        # ============================================================
        # 15. Garbage / unusable input
        # ============================================================
        ("", None, None),
        ("123456", None, None),
        ("xyzabc", None, None),
        ("????", None, None),
        ("@#$%^", None, None),
    ]

    for raw, dose, form in samples:
        print(f"\n[INPUT] raw={raw!r} | dose={dose!r} | form={form!r}")
        result = resolve_medicine(raw, extracted_dosage=dose, extracted_form=form)
        print("[RESULT]")
        print(json.dumps(result, indent=2))
        print("-" * 50)


def interactive_mode():
    print("\n" + "=" * 70)
    print("  Interactive Mode (type 'q' or 'exit' to quit)")
    print("=" * 70)

    while True:
        try:
            name = input("\nEnter Medicine Name (e.g. Tab Janumet 50/500mg): ").strip()
            if not name or name.lower() in ("q", "quit", "exit"):
                print("Exiting interactive mode.")
                break

            dose = input("Enter Dosage (press Enter to skip, e.g. 500mg): ").strip() or None
            form = input("Enter Form   (press Enter to skip, e.g. tablet): ").strip() or None

            res = resolve_medicine(name, extracted_dosage=dose, extracted_form=form)
            print("\nMatch Result:")
            print(json.dumps(res, indent=2))
        except (KeyboardInterrupt, EOFError):
            print("\nExited.")
            break


if __name__ == "__main__":
    # 1. Run standard samples
    run_sample_tests()

    # 2. Ask if user wants to try interactive mode
    try:
        choice = input("\nDo you want to test custom medicines interactively? (y/n): ").strip().lower()
        if choice in ("y", "yes"):
            interactive_mode()
    except (KeyboardInterrupt, EOFError):
        pass
