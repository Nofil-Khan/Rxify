"""Parsers for clinical date strings, treatment durations, and dosing frequencies."""

from __future__ import annotations
import datetime
import re
from typing import Any, List, Optional


class PrescriptionDateParser:
    """Safely sanitizes and converts various OCR / handwriting date formats to ISO YYYY-MM-DD."""

    COMMON_FORMATS = [
        "%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%Y/%m/%d",
        "%d-%m-%Y", "%m-%d-%Y", "%d.%m.%Y", "%Y.%m.%d",
        "%d %b %Y", "%d %B %Y", "%b %d, %Y", "%B %d, %Y",
        "%d-%b-%Y", "%d-%B-%Y"
    ]

    INVALID_MARKERS = frozenset({"null", "none", "n/a", "na", "unknown", "undefined", "-", "not specified", "nil"})

    @classmethod
    def parse_date_string(cls, val: Any) -> Optional[str]:
        """Convert messy date input into clean ISO 'YYYY-MM-DD' format or None."""
        if not val or not isinstance(val, str):
            return None
        cleaned = val.strip()
        if not cleaned or cleaned.lower() in cls.INVALID_MARKERS:
            return None

        # 1. Try ISO standard YYYY-MM-DD
        try:
            return datetime.date.fromisoformat(cleaned).isoformat()
        except ValueError:
            pass

        # 2. Try common international and regional formats
        for fmt in cls.COMMON_FORMATS:
            try:
                return datetime.datetime.strptime(cleaned, fmt).date().isoformat()
            except ValueError:
                continue

        # 3. Fallback to dateutil if available
        try:
            from dateutil import parser
            dt = parser.parse(cleaned, fuzzy=True)
            return dt.date().isoformat()
        except Exception:
            return None


class DosageScheduleParser:
    """Parses natural language and Latin clinical abbreviations for treatment schedules."""

    @staticmethod
    def parse_duration_to_days(duration: str) -> Optional[int]:
        """Convert strings like '5 days', '2 weeks', '1 month' to integer total days."""
        if not duration:
            return None
        text = duration.strip().lower()

        # Match numbers followed by time unit
        m = re.search(r"(\d+)\s*(day|days|d|week|weeks|w|month|months|m)\b", text)
        if m:
            val, unit = int(m.group(1)), m.group(2)
            if unit.startswith("d"):
                return val
            if unit.startswith("w"):
                return val * 7
            if unit.startswith("m"):
                return val * 30

        # Simple standalone integer (assumed days)
        if text.isdigit():
            return int(text)

        return None

    @staticmethod
    def parse_frequency(freq: str) -> List[str]:
        """Convert clinical shorthand (e.g. '1-0-1', 'TDS', 'BD') into scheduled timeslots."""
        if not freq:
            return ["morning"]
        f = freq.strip().lower()

        # Tri-part number code (e.g. 1-0-1 or 1-1-1)
        m = re.match(r"^(\d+)\s*[-/]\s*(\d+)\s*[-/]\s*(\d+)$", f)
        if m:
            slots = []
            if int(m.group(1)) > 0: slots.append("morning")
            if int(m.group(2)) > 0: slots.append("afternoon")
            if int(m.group(3)) > 0: slots.append("night")
            return slots or ["morning"]

        # Latin medical abbreviations
        if "tds" in f or "tid" in f or "three times" in f:
            return ["morning", "afternoon", "night"]
        if "bd" in f or "bid" in f or "twice" in f:
            return ["morning", "night"]
        if "od" in f or "qd" in f or "once" in f:
            return ["morning"]
        if "hs" in f or "bedtime" in f or "night" in f:
            return ["night"]

        return ["morning"]

