"""Seed inventory stock for demo dispensaries in Rxify.

Populates realistic stock across the 3 demo dispensaries so that patients can test:
- Dispensary 1: Mostly fully stocked
- Dispensary 2: Partially stocked / different items
- Dispensary 3: Some out of stock / low stock
"""

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from database.db import get_conn
import psycopg2.extras

DEMO_STOCKS = {
    # Dispensary 1: Rxify Central Dispensary (Well-stocked)
    1: [
        (25, 120, 20, "capsules"),    # Amoxicillin 500mg
        (26, 200, 30, "tablets"),     # Paracetamol 650mg
        (27, 85, 15, "tablets"),      # Ibuprofen 400mg
        (28, 150, 25, "tablets"),     # Metformin 500mg
        (29, 90, 20, "tablets"),      # Atorvastatin 20mg
        (30, 110, 20, "tablets"),     # Amlodipine 5mg
        (31, 60, 15, "tablets"),      # Azithromycin 250mg
        (32, 100, 20, "capsules"),    # Omeprazole 20mg
        (33, 75, 15, "tablets"),      # Cetirizine 10mg
        (104894, 50, 10, "tablets"),  # Ondansetron 4mg
        (855168, 40, 10, "ml"),       # Levocetirizine
        (9000204, 65, 15, "capsules"),# Pan-D
        (9000004, 45, 10, "capsules"),# Radyle-D
        (9000001, 30, 10, "tablets"), # Doxolin 400
    ],
    # Dispensary 2: Standalone City Pharmacy (Different inventory, partial availability)
    2: [
        (25, 15, 20, "capsules"),     # Amoxicillin 500mg (Low stock)
        (26, 150, 25, "tablets"),     # Paracetamol 650mg (In stock)
        (27, 95, 20, "tablets"),      # Ibuprofen 400mg (In stock)
        (28, 0, 20, "tablets"),       # Metformin 500mg (Out of stock)
        (30, 45, 15, "tablets"),      # Amlodipine 5mg
        (33, 60, 15, "tablets"),      # Cetirizine 10mg
        (9000204, 0, 15, "capsules"), # Pan-D (Out of stock)
    ],
    # Dispensary 3: City General Pharmacy
    3: [
        (26, 80, 20, "tablets"),      # Paracetamol 650mg
        (28, 120, 25, "tablets"),     # Metformin 500mg
        (29, 60, 15, "tablets"),      # Atorvastatin 20mg
        (31, 0, 15, "tablets"),       # Azithromycin 250mg (Out of stock)
        (32, 40, 15, "capsules"),     # Omeprazole 20mg
        (104894, 25, 10, "tablets"),  # Ondansetron 4mg
    ]
}

def seed_inventory():
    with get_conn() as conn:
        with conn.cursor() as cur:
            count = 0
            for disp_id, items in DEMO_STOCKS.items():
                # Check dispensary exists
                cur.execute("SELECT dispensary_id, name FROM dispensary WHERE dispensary_id = %s", (disp_id,))
                disp = cur.fetchone()
                if not disp:
                    print(f"Skipping dispensary #{disp_id} (not found)")
                    continue

                for med_id, qty, reorder, unit in items:
                    # Check medicine exists
                    cur.execute("SELECT medicine_id FROM medicine WHERE medicine_id = %s", (med_id,))
                    if not cur.fetchone():
                        print(f"Skipping medicine #{med_id} (not found in catalog)")
                        continue

                    cur.execute("""
                        INSERT INTO inventory_dispensary_stock (
                            dispensary_id, medicine_id, available_quantity, reserved_quantity,
                            reorder_level, unit, updated_at
                        ) VALUES (%s, %s, %s, 0, %s, %s, NOW())
                        ON CONFLICT (dispensary_id, medicine_id) DO UPDATE SET
                            available_quantity = EXCLUDED.available_quantity,
                            reorder_level = EXCLUDED.reorder_level,
                            unit = EXCLUDED.unit,
                            updated_at = NOW()
                    """, (disp_id, med_id, qty, reorder, unit))
                    count += 1
            conn.commit()
            print(f"Successfully seeded/updated {count} stock records across demo dispensaries.")

if __name__ == "__main__":
    seed_inventory()

