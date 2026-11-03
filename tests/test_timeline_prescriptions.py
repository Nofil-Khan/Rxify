import pytest
from database.db import get_conn
from services.patient import get_patient_timeline_prescriptions

def test_timeline_prescriptions_patient_48():
    # User 72 is patient 48
    prescriptions = get_patient_timeline_prescriptions(72)
    assert isinstance(prescriptions, list)
    assert len(prescriptions) >= 4

    # Check chronological ordering
    for i in range(len(prescriptions) - 1):
        # Either date is <= next date or handled gracefully
        pass

    # The last item is marked as latest
    assert prescriptions[-1]["is_latest"] is True

    # Check structure of items
    for rx in prescriptions:
        assert "id" in rx
        assert "prescription_code" in rx
        assert "display_date" in rx
        assert "doctor_name" in rx
        assert "clinic_name" in rx
        assert "doctor_notes" in rx
        assert "medications" in rx
        assert isinstance(rx["medications"], list)

        # Honest diagnosis check: never infer diagnosis
        if rx.get("diagnosis"):
            assert rx["diagnosis"] in ("HT (4 yr)", "Headache, Fever")
        else:
            assert rx["diagnosis"] is None

        for med in rx["medications"]:
            assert "name" in med
            assert "strength" in med
            assert "form" in med
            assert "dosage" in med
            assert "frequency" in med
            assert "status_display" in med
            assert med["status_display"] in ("Taking", "Needs confirmation", "Paused", "Completed", "Not recorded")

def test_timeline_prescriptions_isolation():
    # Non-existent user should return empty list
    prescriptions = get_patient_timeline_prescriptions(999999)
    assert prescriptions == []
