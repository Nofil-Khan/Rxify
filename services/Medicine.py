"""Services for parsing and reading medication frequencies and schedules.
"""

from __future__ import annotations

from typing import List, Dict, Any
from database.user_database import db_connection


def parse_frequency(freq: str) -> List[str]:
    """Parse medical abbreviation frequency into descriptive time-of-day slots.

    Args:
        freq: The frequency string from prescription (e.g. "1-0-1", "BD", "TDS").

    Returns:
        A list of times of day (Morning, Afternoon, Night, As needed) or a warning.
    """
    if not freq:
        return []

    freq = freq.strip().upper()

    # Handle dash-separated patterns (e.g. 1-0-1)
    if "-" in freq:
        parts = freq.split("-")
        times = ["Morning", "Afternoon", "Night"]
        return [times[i] for i, v in enumerate(parts) if v.strip() in ("1", "2")]

    # Common abbreviations map
    mapping = {
        "OD": ["Morning"],
        "1 OD": ["Morning"],
        "BD": ["Morning", "Night"],
        "1/2 BD": ["Morning", "Night"],
        "TWICE DAILY": ["Morning", "Night"],
        "TDS": ["Morning", "Afternoon", "Night"],
        "QID": ["Morning", "Afternoon", "Evening", "Night"],
        "HS": ["Night"],
        "1 HS": ["Night"],
        "SOS": ["As needed"],
    }

    return mapping.get(freq, ["Check with doctor"])


def get_medicine_info(prescription_id: int, user_id: int) -> List[Dict[str, Any]]:
    """Retrieve and format medications list for a specific prescription.

    Ensures patient ownership before returning details.
    """
    with db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT pm.name, pm.dosage, pm.frequency, pm.duration, pm.date
            FROM prescription_medications pm
            JOIN prescriptions p ON pm.prescription_id = p.id
            WHERE pm.prescription_id = ? AND p.user_id = ?
            """,
            (prescription_id, user_id),
        )
        rows = cursor.fetchall()
        if not rows:
            return []

        return [
            {
                "name": row[0],
                "dosage": row[1],
                "frequency": row[2],
                "schedule": parse_frequency(row[2]),
                "duration": row[3],
                "date": row[4],
            }
            for row in rows
        ]
