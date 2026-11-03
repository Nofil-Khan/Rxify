import os
import sys
import psycopg2.extras

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.db import get_conn, get_password_hash


def sync_dispensary_users():
    """Create user rows in `users` table for each dispensary,

    with password set to the first word (name) of the hospital/dispensary.
    Also update password_hash in `dispensary` table so both authenticate identically.
    """
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # 1. Fetch all dispensaries
            cur.execute(
                """
                SELECT dispensary_id, name, email, phone, address
                FROM dispensary
                ORDER BY dispensary_id;
                """
            )
            dispensaries = cur.fetchall()
            print(f"Found {len(dispensaries)} dispensaries to sync with users table.\n")

            synced_count = 0
            for d in dispensaries:
                disp_id = d["dispensary_id"]
                disp_name = d["name"]
                disp_email = d["email"]
                disp_phone = d.get("phone")

                # First name of the hospital / dispensary
                first_name = disp_name.strip().split()[0]
                # Lowercase / stripped variant for password
                # E.g. 'BIMR', 'Jaya', 'Apollo', 'MedPlus', 'Pariwar', 'Sanjeevani', 'City', 'Kampoo', 'Maharaj', 'Fortis'
                password_plain = first_name
                pwd_hash = get_password_hash(password_plain)

                # Update dispensary table's password_hash as well
                cur.execute(
                    """
                    UPDATE dispensary
                    SET password_hash = %s
                    WHERE dispensary_id = %s;
                    """,
                    (pwd_hash, disp_id),
                )

                # Check if user already exists in users table with this email
                cur.execute("SELECT user_id, email FROM users WHERE email = %s;", (disp_email,))
                existing_user = cur.fetchone()

                if existing_user:
                    # Update password and role
                    cur.execute(
                        """
                        UPDATE users
                        SET password_hash = %s,
                            role = 'DISPENSARY',
                            full_name = %s,
                            phone = %s,
                            status = 'ACTIVE'
                        WHERE user_id = %s;
                        """,
                        (pwd_hash, disp_name, disp_phone, existing_user["user_id"]),
                    )
                    user_id = existing_user["user_id"]
                    print(f"  [UPDATED] User #{user_id}: {disp_email} | Password: '{password_plain}' | Role: DISPENSARY")
                else:
                    # Insert new user
                    cur.execute(
                        """
                        INSERT INTO users (email, password_hash, role, full_name, phone, status)
                        VALUES (%s, %s, 'DISPENSARY', %s, %s, 'ACTIVE')
                        RETURNING user_id;
                        """,
                        (disp_email, pwd_hash, disp_name, disp_phone),
                    )
                    user_id = cur.fetchone()["user_id"]
                    print(f"  [CREATED] User #{user_id}: {disp_email} | Password: '{password_plain}' | Role: DISPENSARY")

                synced_count += 1

            conn.commit()
            print(f"\nSuccessfully synced {synced_count} dispensary users into the users table.")


if __name__ == "__main__":
    sync_dispensary_users()

