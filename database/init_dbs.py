import sqlite3
from pathlib import Path

def init_prescriptions_db():
    db_path = Path(__file__).parent / 'prescriptions.db'
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute('DROP TABLE IF EXISTS prescription_medications')
    cursor.execute('DROP TABLE IF EXISTS prescriptions')
    cursor.execute('DROP TABLE IF EXISTS users')

    # Create users table
    cursor.execute('''
    CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL
    )
    ''')

    # Create prescriptions table
    cursor.execute('''
    CREATE TABLE prescriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        doctor_name TEXT,
        clinic_name TEXT,
        clinic_address TEXT,
        clinic_phone TEXT,
        patient_name TEXT,
        patient_age TEXT,
        patient_gender TEXT,
        issue_date TEXT,
        follow_up_date TEXT,
        diagnosis TEXT,
        notes TEXT,
        raw_text TEXT,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )
    ''')

    # Create prescription_medications table
    cursor.execute('''
    CREATE TABLE prescription_medications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        prescription_id INTEGER NOT NULL,
        name TEXT,
        dosage TEXT,
        frequency TEXT,
        duration TEXT,
        instructions TEXT,
        FOREIGN KEY(prescription_id) REFERENCES prescriptions(id)
    )
    ''')
    
    conn.commit()
    conn.close()
    print("prescriptions.db initialized.")

def init_medicines_db():
    db_path = Path(__file__).parent / 'medicines.db'
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute('DROP TABLE IF EXISTS medicines')
    cursor.execute('DROP TABLE IF EXISTS users')

    # Create users table
    cursor.execute('''
    CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL
    )
    ''')

    # Create medicines table
    cursor.execute('''
    CREATE TABLE medicines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        dosage TEXT,
        frequency TEXT,
        duration TEXT,
        instructions TEXT,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )
    ''')

    conn.commit()
    conn.close()
    print("medicines.db initialized.")

if __name__ == "__main__":
    init_prescriptions_db()
    init_medicines_db()
