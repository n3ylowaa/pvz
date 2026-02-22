import sqlite3
import os

DATABASE_PATH = "shifts.db"

def get_connection():
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_database():
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS workplaces (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS shift_templates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            start_time TIME NOT NULL,
            end_time TIME NOT NULL,
            default_rate_type TEXT NOT NULL,
            default_rate_value REAL NOT NULL
        )
    """)
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS shifts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            workplace_id INTEGER NOT NULL,
            shift_date DATE NOT NULL,
            start_time TIME NOT NULL,
            end_time TIME NOT NULL,
            hours REAL NOT NULL,
            rate_type TEXT NOT NULL,
            rate_value REAL NOT NULL,
            earnings REAL NOT NULL,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (workplace_id) REFERENCES workplaces (id)
        )
    """)
    
    cursor.execute("SELECT COUNT(*) FROM shift_templates")
    if cursor.fetchone()[0] == 0:
        templates = [
            ("9-21", "09:00", "21:00", "hourly", 125),
            ("15-21", "15:00", "21:00", "fixed", 1500),
            ("9-15", "09:00", "15:00", "fixed", 1000),
        ]
        cursor.executemany(
            "INSERT INTO shift_templates (name, start_time, end_time, default_rate_type, default_rate_value) VALUES (?, ?, ?, ?, ?)",
            templates
        )
    
    conn.commit()
    conn.close()

if not os.path.exists(DATABASE_PATH):
    init_database()