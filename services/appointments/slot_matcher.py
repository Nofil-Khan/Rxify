"""Smart Clinical Consultation Slot Matching Engine."""

from __future__ import annotations
from datetime import time as dtime, timedelta
from typing import Any, Dict, List, Optional, Tuple


class SmartSlotMatcher:
    """Classifies and ranks clinical appointment slots against patient time-period preferences."""

    PERIOD_WINDOWS: Dict[str, Tuple[dtime, dtime]] = {
        "morning":   (dtime(6, 0),  dtime(12, 0)),
        "afternoon": (dtime(12, 0), dtime(17, 0)),
        "evening":   (dtime(17, 0), dtime(21, 0)),
    }

    @classmethod
    def parse_time(cls, value: Any) -> Optional[dtime]:
        """Convert PostgreSQL time representation (dtime, timedelta, or string) to python dtime."""
        if value is None:
            return None
        if isinstance(value, dtime):
            return value
        if isinstance(value, timedelta):
            total = int(value.total_seconds())
            return dtime(total // 3600, (total % 3600) // 60, total % 60)
        try:
            parts = str(value).split(":")
            return dtime(int(parts[0]), int(parts[1]), int(parts[2].split(".")[0]))
        except Exception:
            return None

    @classmethod
    def is_in_period(cls, start_time_raw: Any, period: str) -> bool:
        """Return True if start_time falls within the given time period window."""
        norm_period = period.strip().lower()
        if norm_period not in cls.PERIOD_WINDOWS:
            return True  # "any" matches all hours
        t = cls.parse_time(start_time_raw)
        if t is None:
            return False
        lo, hi = cls.PERIOD_WINDOWS[norm_period]
        return lo <= t < hi

    @classmethod
    def match_slots(
        cls,
        slots: List[Dict[str, Any]],
        time_period: str = "any",
    ) -> List[Dict[str, Any]]:
        """Rank and categorize slots into preferred matches and fallback suggestions."""
        if not slots:
            return []

        preferred = []
        fallback = []

        for s in slots:
            item = dict(s)
            for k in ("slot_date", "start_time", "end_time"):
                if item.get(k):
                    item[k] = str(item[k])

            if cls.is_in_period(s.get("start_time"), time_period):
                item["suggested"] = False
                preferred.append(item)
            else:
                item["suggested"] = True
                fallback.append(item)

        if preferred:
            # Return all preferred matches + top 3 fallback suggestions
            return preferred + fallback[:3]

        # No exact period match — return all slots flagged as suggested
        return fallback


default_slot_matcher = SmartSlotMatcher()

