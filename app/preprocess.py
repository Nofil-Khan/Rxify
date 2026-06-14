import json
import sqlite3
from pathlib import Path

db_path = Path(__file__).parent.parent / "database" / "prescriptions.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()
# ── Abbreviation lookup ────────────────────────────────────────────────────────
PRESCRIPTION_ABBREVIATIONS = {
    "OD":  "Once a day",
    "BD":  "Twice a day",
    "TDS": "Three times a day",
    "QID": "Four times a day",
    "SOS": "Only if needed",
    "HS":  "At bedtime",
    "AC":  "Before food",
    "PC":  "After food",
}


def expand_abbreviation(code) -> str:
    """Return the full text for a prescription abbreviation, or the original if unknown."""
    if not code:
        return "Not specified"
    return PRESCRIPTION_ABBREVIATIONS.get(code.upper(), code)


# ── Per-record processing ──────────────────────────────────────────────────────
def parse_prescription(record: dict) -> dict:
    """
    Convert a raw prescription record into a clean, structured dict.

    Input shape expected:
        {
            "patient_name": str,
            "patient_age": int | str,
            "issue_date":   str,
            "medications": [
                {"name": str, "frequency": str, "dosage": str},
                ...
            ]
        }
    """
    medications = {}
    for med in record.get("medications", []):
        name  = med.get("name", "Unknown")
        freq  = expand_abbreviation(med.get("frequency", ""))
        dosage = med.get("dosage", "")

        # First occurrence wins; duplicates are skipped
        if name not in medications:
            medications[name] = {"frequency": freq, "dosage": dosage}

    return {
        "patient_name": record.get("patient_name", "Unknown"),
        "patient_age":  record.get("patient_age",  "Unknown"),
        "issue_date":   record.get("issue_date",   "Unknown"),
        "medications":  medications,
    }


# ── Main ───────────────────────────────────────────────────────────────────────
def main():
    json_path = Path(__file__).parent.parent / "data" / "json" / "prescription_data.json"
    try:
        with open(json_path, "r") as f:
            raw_data: list[dict] = json.load(f)
    except FileNotFoundError:
        print(f"[WARNING] Input JSON not found at {json_path}. Please place your prescription data there.")
        return

    print(f"Total records: {len(raw_data)}\n")

    parsed_prescriptions = [parse_prescription(record) for record in raw_data]

    # for i, prescription in enumerate(parsed_prescriptions, start=1):
    #     print(f"{'─' * 50}")
    #     print(f"Record #{i}")
    #     print(f"  Patient : {prescription['patient_name']}")
    #     print(f"  Age     : {prescription['patient_age']}")
    #     print(f"  Date    : {prescription['issue_date']}")
    #     print(f"  Medications ({len(prescription['medications'])}):")
    #     for name, details in prescription["medications"].items():
    #         print(f"    • {name}")
    #         print(f"        Dosage    : {details['dosage']}")
    #         print(f"        Frequency : {details['frequency']}")

    # print(f"{'─' * 50}")

    # Optional: save the cleaned data to a new JSON file
    out_path = Path(__file__).parent.parent / "data" / "Medication_data.json"
    with open(out_path, "w") as f:
        json.dump(parsed_prescriptions, f, indent=2)

    print("\nClean data saved to Medication_data.json")



if __name__ == "__main__":
    main()

    # Database integration/debugging (only runs if script is executed directly)
    try:
        med_json_path = Path(__file__).parent.parent / "data" / "Medication_data.json"
        with open(med_json_path, "r") as f:
            data = json.load(f)
    except FileNotFoundError:
        data = {}

    user_id = 1

    try:
        # Note: Medication_data.json is parsed as a list of dicts, but if it is dict:
        if isinstance(data, dict):
            for name, (dosage, frequency) in data.items():
                cursor.execute("""
                    INSERT INTO medicines (user_id, name, dosage, frequency)
                    VALUES (?, ?, ?, ?)
                """, (user_id, name, dosage, frequency))

        cursor.execute("""
            SELECT name, dosage, frequency 
            FROM medicines 
            WHERE user_id = ?
        """, (1,))   # ← get medicines for user with id=1

        rows = cursor.fetchall()
        for row in rows:
            print(row)
            
        conn.commit()
    except sqlite3.OperationalError as e:
        print(f"Skipping medicines DB debugging (table/schema mismatch): {e}")