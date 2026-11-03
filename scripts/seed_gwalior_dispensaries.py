"""
Seed real Gwalior dispensaries and medicine stock.
Cleans up old dispensary data and inserts 10 authentic dispensaries in Gwalior, MP,
each stocked with ~20+ clinical medicines and realistic tablet/unit quantities.
"""

import os
import sys

# Ensure project root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.db import get_conn, get_password_hash

# 10 Real Gwalior Dispensaries with authentic names, GPS coordinates, and addresses
GWALIOR_DISPENSARIES = [
    {
        "name": "BIMR Hospitals Central Pharmacy",
        "email": "bimr.pharmacy@rxify.com",
        "phone": "+91 751 244 5500",
        "address": "VIP Road, Surya Mandir Marg, Morar, Gwalior, MP 474006",
        "location": "Morar, Gwalior, Madhya Pradesh",
        "latitude": 26.2352513,
        "longitude": 78.2187110,
        "operating_hours": "24/7 (Always Open)",
        "avg_prep_minutes": 12,
        "stock_profile": "full",  # stocks all medicines with high inventory
    },
    {
        "name": "Jaya Arogya (JAH) Hospital Main Dispensary",
        "email": "jah.dispensary@rxify.com",
        "phone": "+91 751 240 3200",
        "address": "Medical College Campus, Lashkar, Gwalior, MP 474001",
        "location": "Lashkar, Gwalior, Madhya Pradesh",
        "latitude": 26.1982140,
        "longitude": 78.1632500,
        "operating_hours": "24/7 (Always Open)",
        "avg_prep_minutes": 15,
        "stock_profile": "full",
    },
    {
        "name": "Apollo Pharmacy - Phoolbagh",
        "email": "apollo.phoolbagh@rxify.com",
        "phone": "+91 751 234 1122",
        "address": "Shop 4, Opp Phoolbagh Ground, MLB Road, Shinde Ki Chhawani, Gwalior, MP 474002",
        "location": "Shinde Ki Chhawani, Gwalior, Madhya Pradesh",
        "latitude": 26.2112178,
        "longitude": 78.1697042,
        "operating_hours": "08:00 AM - 11:00 PM",
        "avg_prep_minutes": 10,
        "stock_profile": "full",
    },
    {
        "name": "MedPlus Chemist - Thatipur",
        "email": "medplus.thatipur@rxify.com",
        "phone": "+91 751 405 8899",
        "address": "Plot 12, Gandhi Road, Near Thatipur Chauraha, Gwalior, MP 474011",
        "location": "Thatipur, Gwalior, Madhya Pradesh",
        "latitude": 26.2116312,
        "longitude": 78.2120307,
        "operating_hours": "08:00 AM - 10:30 PM",
        "avg_prep_minutes": 8,
        "stock_profile": "full",
    },
    {
        "name": "Pariwar Hospital & Heart Institute Pharmacy",
        "email": "pariwar.pharmacy@rxify.com",
        "phone": "+91 751 262 7400",
        "address": "Naya Bazaar, Kampoo Road, Lashkar, Gwalior, MP 474009",
        "location": "Lashkar, Gwalior, Madhya Pradesh",
        "latitude": 26.1973705,
        "longitude": 78.1611630,
        "operating_hours": "24/7 (Always Open)",
        "avg_prep_minutes": 10,
        "stock_profile": "full",
    },
    {
        "name": "Sanjeevani Medical Store - Morar Cantonment",
        "email": "sanjeevani.morar@rxify.com",
        "phone": "+91 751 236 4512",
        "address": "Main Sadar Bazaar, Morar Cantonment, Gwalior, MP 474006",
        "location": "Morar, Gwalior, Madhya Pradesh",
        "latitude": 26.2286817,
        "longitude": 78.2376766,
        "operating_hours": "09:00 AM - 10:00 PM",
        "avg_prep_minutes": 15,
        "stock_profile": "partial_a",  # missing a couple items for partial stock testing
    },
    {
        "name": "City Center Lifeline Pharmacy",
        "email": "lifeline.citycenter@rxify.com",
        "phone": "+91 751 401 2345",
        "address": "Patel Nagar, Near High Court Bench, City Center, Gwalior, MP 474011",
        "location": "City Center, Gwalior, Madhya Pradesh",
        "latitude": 26.2084500,
        "longitude": 78.1887200,
        "operating_hours": "08:30 AM - 11:00 PM",
        "avg_prep_minutes": 10,
        "stock_profile": "full",
    },
    {
        "name": "Kampoo Healthcare Chemist",
        "email": "kampoo.chemist@rxify.com",
        "phone": "+91 751 242 8871",
        "address": "Main Kampoo Road, Near Madhav Dispensary, Lashkar, Gwalior, MP 474001",
        "location": "Lashkar, Gwalior, Madhya Pradesh",
        "latitude": 26.1934062,
        "longitude": 78.1546006,
        "operating_hours": "09:00 AM - 10:00 PM",
        "avg_prep_minutes": 12,
        "stock_profile": "partial_b",
    },
    {
        "name": "Maharaj Bada Central Drug Store",
        "email": "bada.drugs@rxify.com",
        "phone": "+91 751 263 1920",
        "address": "Sarafa Bazaar Road, Maharaj Bada, Lashkar, Gwalior, MP 474001",
        "location": "Maharaj Bada, Gwalior, Madhya Pradesh",
        "latitude": 26.2025100,
        "longitude": 78.1568200,
        "operating_hours": "09:30 AM - 09:30 PM",
        "avg_prep_minutes": 15,
        "stock_profile": "full",
    },
    {
        "name": "Fortis Kalyan Memorial Pharmacy",
        "email": "fortis.kalyan@rxify.com",
        "phone": "+91 751 407 3344",
        "address": "Huzrat Road, Padav Approach, Gwalior, MP 474002",
        "location": "Padav, Gwalior, Madhya Pradesh",
        "latitude": 26.2185400,
        "longitude": 78.1790200,
        "operating_hours": "24/7 (Always Open)",
        "avg_prep_minutes": 10,
        "stock_profile": "full",
    },
]

# 24 core clinical medicines matching Rxify's catalog & prescriptions
MEDICINE_SPECS = [
    {"id": 25, "name": "Amoxicillin 500mg (Amoxil)", "unit": "CAPSULE", "qty": 180},
    {"id": 26, "name": "Paracetamol 650mg (Panadol)", "unit": "TABLET", "qty": 350},
    {"id": 27, "name": "Ibuprofen 400mg (Advil)", "unit": "TABLET", "qty": 220},
    {"id": 28, "name": "Metformin 500mg (Glucophage)", "unit": "TABLET", "qty": 280},
    {"id": 29, "name": "Atorvastatin 20mg (Lipitor)", "unit": "TABLET", "qty": 200},
    {"id": 30, "name": "Amlodipine 5mg (Norvasc)", "unit": "TABLET", "qty": 240},
    {"id": 31, "name": "Azithromycin 250mg (Zithromax)", "unit": "TABLET", "qty": 160},
    {"id": 32, "name": "Omeprazole 20mg (Prilosec)", "unit": "CAPSULE", "qty": 260},
    {"id": 33, "name": "Cetirizine 10mg (Zyrtec)", "unit": "TABLET", "qty": 300},
    {"id": 34, "name": "Cough Syrup DX 100ml (Benadryl)", "unit": "BOTTLE", "qty": 85},
    {"id": 35, "name": "Insulin Glargine 100u/ml (Lantus)", "unit": "VIAL", "qty": 45},
    {"id": 36, "name": "Losartan 50mg (Cozaar)", "unit": "TABLET", "qty": 190},
    {"id": 104894, "name": "Ondansetron 4mg", "unit": "TABLET", "qty": 175},
    {"id": 197313, "name": "Acyclovir 800mg", "unit": "TABLET", "qty": 110},
    {"id": 198444, "name": "Acetaminophen 650mg", "unit": "TABLET", "qty": 320},
    {"id": 314200, "name": "Pantoprazole 40mg", "unit": "TABLET", "qty": 250},
    {"id": 388517, "name": "Calcitriol 0.000003 MG/MG", "unit": "TUBE", "qty": 60},
    {"id": 855168, "name": "Levocetirizine 0.5mg/ml", "unit": "BOTTLE", "qty": 90},
    {"id": 9000001, "name": "Doxolin 400 (Doxofylline)", "unit": "TABLET", "qty": 140},
    {"id": 9000004, "name": "Radyle-D (Rabeprazole+Domperidone)", "unit": "CAPSULE", "qty": 165},
    {"id": 9000008, "name": "Polluton (Acebrophylline)", "unit": "TABLET", "qty": 130},
    {"id": 9000010, "name": "Stonclos (Montelukast+Levocetirizine)", "unit": "TABLET", "qty": 210},
    {"id": 9000011, "name": "Indocap 100 (Indomethacin)", "unit": "CAPSULE", "qty": 125},
    {"id": 9000204, "name": "Pan-D (Pantoprazole+Domperidone)", "unit": "CAPSULE", "qty": 230},
]


def seed_database():
    pwd_hash = get_password_hash("password123")
    print(f"Generated default password hash for 'password123'")

    with get_conn() as conn:
        cur = conn.cursor()

        print("--- Step 1: Cleaning existing dispensary and order data ---")
        cur.execute("DELETE FROM dispensary_request_item;")
        print("  Deleted dispensary_request_item rows.")
        cur.execute("DELETE FROM dispensary_request;")
        print("  Deleted dispensary_request rows.")
        cur.execute("DELETE FROM inventory_transaction;")
        print("  Deleted inventory_transaction rows.")
        cur.execute("DELETE FROM inventory_dispensary_stock;")
        print("  Deleted inventory_dispensary_stock rows.")
        cur.execute("DELETE FROM dispensary;")
        print("  Deleted old dispensary rows.")

        print("\n--- Step 2: Inserting 10 Real Gwalior Dispensaries ---")
        inserted_dispensaries = []
        for d in GWALIOR_DISPENSARIES:
            cur.execute(
                """
                INSERT INTO dispensary (
                    name, email, password_hash, phone, address, location,
                    latitude, longitude, operating_hours, avg_prep_minutes, status
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'ACTIVE')
                RETURNING dispensary_id, name, address, latitude, longitude;
                """,
                (
                    d["name"],
                    d["email"],
                    pwd_hash,
                    d["phone"],
                    d["address"],
                    d["location"],
                    d["latitude"],
                    d["longitude"],
                    d["operating_hours"],
                    d["avg_prep_minutes"],
                ),
            )
            row = cur.fetchone()
            inserted_dispensaries.append({
                "dispensary_id": row[0],
                "name": row[1],
                "address": row[2],
                "latitude": row[3],
                "longitude": row[4],
                "stock_profile": d["stock_profile"],
            })
            print(f"  + Added ID {row[0]}: {row[1]} ({row[3]:.4f}, {row[4]:.4f})")

        print("\n--- Step 3: Stocking ~20 Medicines for Each Dispensary ---")
        total_stock_records = 0
        for disp in inserted_dispensaries:
            disp_id = disp["dispensary_id"]
            profile = disp["stock_profile"]

            # Filter medicines according to profile for testing varied availability
            if profile == "full":
                meds_to_stock = MEDICINE_SPECS  # all 24 medicines stocked
            elif profile == "partial_a":
                # Exclude a couple items (e.g. 25 Amoxicillin and 9000204 Pan-D) to test partial availability
                meds_to_stock = [m for m in MEDICINE_SPECS if m["id"] not in (25, 9000204)]
            elif profile == "partial_b":
                # Exclude 31 Azithromycin and 35 Insulin
                meds_to_stock = [m for m in MEDICINE_SPECS if m["id"] not in (31, 35)]
            else:
                meds_to_stock = MEDICINE_SPECS[:20]

            for med in meds_to_stock:
                # Add slight variation per dispensary
                qty = med["qty"] + ((disp_id * 17) % 50) - 25
                if qty < 10:
                    qty = 50

                cur.execute(
                    """
                    INSERT INTO inventory_dispensary_stock (
                        dispensary_id, medicine_id, available_quantity,
                        reserved_quantity, reorder_level, unit
                    ) VALUES (%s, %s, %s, 0, 20, %s);
                    """,
                    (disp_id, med["id"], qty, med["unit"]),
                )
                total_stock_records += 1

            print(f"  Stocked {len(meds_to_stock)} medicines in {disp['name']}")

        conn.commit()
        print(f"\nSuccessfully seeded 10 Gwalior dispensaries with {total_stock_records} stock items!")


if __name__ == "__main__":
    seed_database()
