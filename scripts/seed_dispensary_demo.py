"""Seed script for Dispensary Demo data.

Populates realistic data for Dispensary #1 (dispensary@citygeneral.com):
1. Updates Dispensary profile details (City General Central Dispensary).
2. Adds ~15 medicines to inventory with distinct stock statuses (In Stock, Low Stock, Out of Stock).
3. Creates sample patients if needed.
4. Generates diverse dispensary requests in the queue (PENDING, PROCESSING, READY, DISPENSED, AMBIGUOUS/PARTIAL).
"""

from __future__ import annotations
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from datetime import datetime, timedelta
import psycopg2.extras
from database.db import get_conn

def seed_demo_data():
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            print("==> 1. Ensuring Hospital & Dispensary #1 profile...")
            # 1. Ensure hospital exists
            cur.execute("SELECT hospital_id FROM hospital LIMIT 1")
            h_row = cur.fetchone()
            if not h_row:
                cur.execute(
                    "INSERT INTO hospital (name, address, phone) VALUES (%s, %s, %s) RETURNING hospital_id",
                    ("City General Hospital", "100 Medical Center Blvd", "+1 (555) 010-0000"),
                )
                hospital_id = cur.fetchone()["hospital_id"]
            else:
                hospital_id = h_row["hospital_id"]

            # Ensure dispensary #1
            cur.execute("SELECT dispensary_id FROM dispensary WHERE dispensary_id = 1")
            disp_row = cur.fetchone()
            if not disp_row:
                cur.execute(
                    """
                    INSERT INTO dispensary (
                        dispensary_id, hospital_id, name, email, password_hash,
                        phone, location, operating_hours, avg_prep_minutes, status
                    ) VALUES (
                        1, %s, 'City General Central Pharmacy', 'dispensary@citygeneral.com',
                        '$2b$12$eX8zW1gZ9y7jK3/4bVfL3Oz0K1q5u/n2uJ1vYvKzR5j2eL9k0vH8u',
                        '+1 (555) 234-8900', 'Ground Floor, Wing B, Suite 104',
                        '08:00 - 22:00 Daily', 15, 'ACTIVE'
                    )
                    ON CONFLICT (dispensary_id) DO UPDATE SET
                        name = EXCLUDED.name,
                        phone = EXCLUDED.phone,
                        location = EXCLUDED.location,
                        operating_hours = EXCLUDED.operating_hours
                    """,
                    (hospital_id,),
                )
            else:
                cur.execute(
                    """
                    UPDATE dispensary
                    SET name = 'City General Central Pharmacy',
                        phone = '+1 (555) 234-8900',
                        location = 'Ground Floor, Wing B, Suite 104',
                        operating_hours = '08:00 - 22:00 Daily',
                        avg_prep_minutes = 15
                    WHERE dispensary_id = 1
                    """
                )
            dispensary_id = 1

            print("==> 2. Seeding Inventory Stock...")
            target_med_names = [
                ("Amoxicillin", 150, 20, "capsules"),
                ("Ibuprofen", 180, 25, "tablets"),
                ("Metformin", 200, 30, "tablets"),
                ("Lisinopril", 120, 20, "tablets"),
                ("Atorvastatin", 140, 20, "tablets"),
                ("Omeprazole", 110, 15, "capsules"),
                ("Cetirizine", 90, 15, "tablets"),
                ("Azithromycin", 80, 15, "tablets"),
                ("Paracetamol", 250, 30, "tablets"),
                ("Aspirin", 160, 20, "tablets"),
                # Low stock items (available < reorder_level)
                ("Albuterol", 4, 15, "inhalers"),
                ("Sertraline", 5, 20, "tablets"),
                ("Losartan", 3, 20, "tablets"),
                # Out of stock items (available = 0)
                ("Doxycycline", 0, 15, "capsules"),
                ("Montelukast", 0, 15, "tablets"),
            ]

            stocked_med_map = {}
            for search_name, qty, reorder, unit in target_med_names:
                cur.execute(
                    """
                    SELECT medicine_id, generic_name, brand_name, form, strength
                    FROM medicine
                    WHERE generic_name ILIKE %s OR brand_name ILIKE %s
                    ORDER BY medicine_id ASC
                    LIMIT 1
                    """,
                    (f"%{search_name}%", f"%{search_name}%"),
                )
                m = cur.fetchone()
                if m:
                    med_id = m["medicine_id"]
                    stocked_med_map[search_name] = (med_id, m["generic_name"], qty, reorder)
                    cur.execute(
                        """
                        INSERT INTO inventory_dispensary_stock (
                            dispensary_id, medicine_id, available_quantity, reserved_quantity,
                            reorder_level, unit, updated_at
                        ) VALUES (%s, %s, %s, 0, %s, %s, NOW())
                        ON CONFLICT (dispensary_id, medicine_id) DO UPDATE SET
                            available_quantity = EXCLUDED.available_quantity,
                            reorder_level = EXCLUDED.reorder_level,
                            unit = EXCLUDED.unit,
                            updated_at = NOW()
                        """,
                        (dispensary_id, med_id, qty, reorder, unit),
                    )

            print(f"    Stocked {len(stocked_med_map)} medicines in Dispensary #1.")

            print("==> 3. Ensuring Patients & Doctors...")
            sample_patients = [
                ("Sarah Jenkins", "sarah.jenkins@example.com", "+1 (555) 301-4411", "1988-04-12", "FEMALE", "A+"),
                ("Michael Chang", "michael.chang@example.com", "+1 (555) 412-8822", "1975-09-23", "MALE", "O+"),
                ("Eleanor Vance", "eleanor.vance@example.com", "+1 (555) 673-9933", "1962-11-05", "FEMALE", "B+"),
                ("David Ross", "david.ross@example.com", "+1 (555) 881-2244", "1994-02-18", "MALE", "AB-"),
                ("Robert Martinez", "robert.martinez@example.com", "+1 (555) 992-3355", "1981-07-30", "MALE", "O-"),
            ]

            patient_ids = []
            for name, email, phone, dob, gender, bg in sample_patients:
                cur.execute("SELECT user_id FROM users WHERE email = %s", (email,))
                u_row = cur.fetchone()
                if not u_row:
                    cur.execute(
                        """
                        INSERT INTO users (full_name, email, password_hash, role, phone, gender)
                        VALUES (%s, %s, '$2b$12$eX8zW1gZ9y7jK3/4bVfL3Oz0K1q5u/n2uJ1vYvKzR5j2eL9k0vH8u', 'PATIENT', %s, %s)
                        RETURNING user_id
                        """,
                        (name, email, phone, gender),
                    )
                    user_id = cur.fetchone()["user_id"]
                else:
                    user_id = u_row["user_id"]

                cur.execute("SELECT patient_id FROM patient WHERE user_id = %s", (user_id,))
                p_row = cur.fetchone()
                if not p_row:
                    cur.execute(
                        """
                        INSERT INTO patient (user_id, date_of_birth, blood_group, address)
                        VALUES (%s, %s, %s, '123 Health Ave')
                        RETURNING patient_id
                        """,
                        (user_id, dob, bg),
                    )
                    pid = cur.fetchone()["patient_id"]
                else:
                    pid = p_row["patient_id"]
                patient_ids.append(pid)

            # Ensure Doctor
            cur.execute("SELECT doctor_id FROM doctor LIMIT 1")
            doc_row = cur.fetchone()
            if not doc_row:
                cur.execute(
                    "INSERT INTO users (full_name, email, password_hash, role) VALUES ('Dr. Gregory House', 'dr.house@citygeneral.com', 'dummy', 'DOCTOR') RETURNING user_id"
                )
                doc_uid = cur.fetchone()["user_id"]
                cur.execute("INSERT INTO doctor (user_id, specialization) VALUES (%s, 'General Medicine') RETURNING doctor_id", (doc_uid,))
                doctor_id = cur.fetchone()["doctor_id"]
            else:
                doctor_id = doc_row["doctor_id"]

            print("==> 4. Creating Sample Dispensary Requests & Prescriptions...")
            cur.execute("DELETE FROM dispensary_request WHERE dispensary_id = %s", (dispensary_id,))

            now = datetime.now()

            def create_demo_request(patient_id, diag, req_status, items, est_mins=15, notes=None, dispensed_at=None, ready_at=None):
                cur.execute(
                    """
                    INSERT INTO prescription (patient_id, doctor_id, diagnosis, notes, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    RETURNING prescription_id
                    """,
                    (patient_id, doctor_id, diag, "Rxify electronic verification", now, now),
                )
                rx_id = cur.fetchone()["prescription_id"]

                cur.execute(
                    """
                    INSERT INTO dispensary_request (
                        prescription_id, dispensary_id, patient_id, status,
                        estimated_ready_at, ready_at, dispensed_at, notes, created_at, updated_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING request_id
                    """,
                    (
                        rx_id, dispensary_id, patient_id, req_status,
                        now + timedelta(minutes=est_mins) if est_mins else None,
                        ready_at, dispensed_at, notes, now, now
                    ),
                )
                req_id = cur.fetchone()["request_id"]

                for item in items:
                    med_name = item.get("name")
                    med_id = item.get("medicine_id")
                    dosage = item.get("dosage", "1 unit daily")
                    instructions = item.get("instructions", "Take after meals")
                    match_status = item.get("match_status", "MATCHED")
                    avail_status = item.get("avail_status", "AVAILABLE")
                    req_qty = item.get("qty", 1)
                    reserved = item.get("reserved", False)

                    cur.execute(
                        """
                        INSERT INTO prescription_medicine (
                            prescription_id, medicine_id, name, dosage, instructions, match_status, created_at
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                        RETURNING prescription_medicine_id
                        """,
                        (rx_id, med_id, med_name, dosage, instructions, match_status, now),
                    )
                    pm_id = cur.fetchone()["prescription_medicine_id"]

                    cur.execute(
                        """
                        INSERT INTO dispensary_request_item (
                            request_id, prescription_medicine_id, medicine_id,
                            required_quantity, availability_status, reserved, created_at
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                        """,
                        (req_id, pm_id, med_id, req_qty, avail_status, reserved, now),
                    )

                return req_id

            # Case 1: PENDING - Sarah Jenkins (Acute Bronchitis)
            amox = stocked_med_map.get("Amoxicillin")
            ibup = stocked_med_map.get("Ibuprofen")
            create_demo_request(
                patient_id=patient_ids[0],
                diag="Acute Bronchitis & Inflammation",
                req_status="PENDING",
                est_mins=12,
                items=[
                    {
                        "name": amox[1] if amox else "Amoxicillin 500 MG",
                        "medicine_id": amox[0] if amox else None,
                        "dosage": "500mg capsule, 3 times daily",
                        "instructions": "Take with full glass of water after food for 7 days",
                        "match_status": "MATCHED",
                        "avail_status": "AVAILABLE",
                        "qty": 21,
                        "reserved": False,
                    },
                    {
                        "name": ibup[1] if ibup else "Ibuprofen 400 MG",
                        "medicine_id": ibup[0] if ibup else None,
                        "dosage": "400mg tablet, every 8 hours as needed",
                        "instructions": "Do not exceed 1200mg daily. Take with food.",
                        "match_status": "MATCHED",
                        "avail_status": "AVAILABLE",
                        "qty": 14,
                        "reserved": False,
                    },
                ],
            )

            # Case 2: PROCESSING - Michael Chang (Type 2 Diabetes & Hypertension)
            metf = stocked_med_map.get("Metformin")
            lisi = stocked_med_map.get("Lisinopril")
            ator = stocked_med_map.get("Atorvastatin")
            create_demo_request(
                patient_id=patient_ids[1],
                diag="Type 2 Diabetes & Primary Hypertension Management",
                req_status="PROCESSING",
                est_mins=5,
                notes="Pharmacist verified patient identity. Tray #4 assigned.",
                items=[
                    {
                        "name": metf[1] if metf else "Metformin 500 MG",
                        "medicine_id": metf[0] if metf else None,
                        "dosage": "500mg tablet, twice daily",
                        "instructions": "Take with breakfast and dinner",
                        "match_status": "MATCHED",
                        "avail_status": "AVAILABLE",
                        "qty": 60,
                        "reserved": True,
                    },
                    {
                        "name": lisi[1] if lisi else "Lisinopril 10 MG",
                        "medicine_id": lisi[0] if lisi else None,
                        "dosage": "10mg tablet, once daily morning",
                        "instructions": "Monitor blood pressure regularly",
                        "match_status": "MATCHED",
                        "avail_status": "AVAILABLE",
                        "qty": 30,
                        "reserved": True,
                    },
                    {
                        "name": ator[1] if ator else "Atorvastatin 20 MG",
                        "medicine_id": ator[0] if ator else None,
                        "dosage": "20mg tablet, at bedtime",
                        "instructions": "Avoid grapefruit juice",
                        "match_status": "MATCHED",
                        "avail_status": "AVAILABLE",
                        "qty": 30,
                        "reserved": True,
                    },
                ],
            )

            # Case 3: READY - Eleanor Vance (Allergic Rhinitis & Asthma)
            ceti = stocked_med_map.get("Cetirizine")
            albu = stocked_med_map.get("Albuterol")
            create_demo_request(
                patient_id=patient_ids[2],
                diag="Seasonal Allergic Rhinitis & Mild Asthma",
                req_status="READY",
                ready_at=now - timedelta(minutes=10),
                notes="Packaged and sealed at Pickup Window 2. SMS notification dispatched.",
                items=[
                    {
                        "name": ceti[1] if ceti else "Cetirizine 10 MG",
                        "medicine_id": ceti[0] if ceti else None,
                        "dosage": "10mg tablet, once daily in evening",
                        "instructions": "May cause mild drowsiness",
                        "match_status": "MATCHED",
                        "avail_status": "AVAILABLE",
                        "qty": 30,
                        "reserved": True,
                    },
                    {
                        "name": albu[1] if albu else "Albuterol Inhaler",
                        "medicine_id": albu[0] if albu else None,
                        "dosage": "90mcg 1-2 puffs as needed",
                        "instructions": "Rinse mouth after inhalation",
                        "match_status": "MATCHED",
                        "avail_status": "AVAILABLE",
                        "qty": 1,
                        "reserved": True,
                    },
                ],
            )

            # Case 4: PENDING with Attention (AMBIGUOUS match & Out-of-Stock medicine)
            azith = stocked_med_map.get("Azithromycin")
            doxy = stocked_med_map.get("Doxycycline")
            create_demo_request(
                patient_id=patient_ids[3],
                diag="Respiratory Infection & Persistent Cough",
                req_status="PENDING",
                est_mins=25,
                notes="Contains ambiguous items requiring pharmacist review.",
                items=[
                    {
                        "name": azith[1] if azith else "Azithromycin 250 MG",
                        "medicine_id": azith[0] if azith else None,
                        "dosage": "250mg, 2 tabs day 1 then 1 tab daily",
                        "instructions": "Complete entire course",
                        "match_status": "MATCHED",
                        "avail_status": "AVAILABLE",
                        "qty": 6,
                        "reserved": False,
                    },
                    {
                        "name": doxy[1] if doxy else "Doxycycline 100 MG",
                        "medicine_id": doxy[0] if doxy else None,
                        "dosage": "100mg capsule, twice daily",
                        "instructions": "Take with full meal, stay upright for 30 mins",
                        "match_status": "MATCHED",
                        "avail_status": "UNAVAILABLE",
                        "qty": 14,
                        "reserved": False,
                    },
                    {
                        "name": "Herbal Cough Elixir Complex",
                        "medicine_id": None,
                        "dosage": "10ml before sleep",
                        "instructions": "Shake well before use",
                        "match_status": "AMBIGUOUS",
                        "avail_status": "AMBIGUOUS",
                        "qty": 1,
                        "reserved": False,
                    },
                ],
            )

            # Case 5: DISPENSED - Robert Martinez (Acid Reflux)
            omep = stocked_med_map.get("Omeprazole")
            create_demo_request(
                patient_id=patient_ids[4],
                diag="Gastroesophageal Reflux Disease (GERD)",
                req_status="DISPENSED",
                dispensed_at=now - timedelta(hours=2),
                notes="Patient picked up medications and signed digital counseling form.",
                items=[
                    {
                        "name": omep[1] if omep else "Omeprazole 20 MG",
                        "medicine_id": omep[0] if omep else None,
                        "dosage": "20mg delayed release capsule daily",
                        "instructions": "Take 30 minutes before first meal of day",
                        "match_status": "MATCHED",
                        "avail_status": "AVAILABLE",
                        "qty": 30,
                        "reserved": False,
                    },
                ],
            )

            conn.commit()
            print("==> Demo seed completed successfully! 5 requests seeded across all workflow states.")

if __name__ == "__main__":
    seed_demo_data()
