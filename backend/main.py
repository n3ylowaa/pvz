from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import date, datetime
import sqlite3
from typing import Optional, List
import database

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class Workplace(BaseModel):
    name: str

class ShiftCreate(BaseModel):
    workplace_id: int
    shift_date: date
    start_time: str
    end_time: str
    rate_type: str
    rate_value: float
    notes: Optional[str] = None

class ShiftResponse(BaseModel):
    id: int
    workplace_name: str
    shift_date: str
    start_time: str
    end_time: str
    hours: float
    rate_type: str
    rate_value: float
    earnings: float
    notes: Optional[str]

@app.get("/api/workplaces")
def get_workplaces():
    conn = database.get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name FROM workplaces ORDER BY name")
    workplaces = [{"id": row[0], "name": row[1]} for row in cursor.fetchall()]
    conn.close()
    return workplaces

@app.post("/api/workplaces")
def create_workplace(workplace: Workplace):
    conn = database.get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO workplaces (name) VALUES (?)",
            (workplace.name,)
        )
        conn.commit()
        return {"id": cursor.lastrowid, "name": workplace.name}
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="Такое место уже существует")
    finally:
        conn.close()

@app.get("/api/templates")
def get_templates():
    conn = database.get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, start_time, end_time, default_rate_type, default_rate_value FROM shift_templates")
    templates = []
    for row in cursor.fetchall():
        templates.append({
            "id": row[0],
            "name": row[1],
            "start_time": row[2],
            "end_time": row[3],
            "rate_type": row[4],
            "rate_value": row[5]
        })
    conn.close()
    return templates

@app.post("/api/shifts")
def create_shift(shift: ShiftCreate):
    start = datetime.strptime(shift.start_time, "%H:%M")
    end = datetime.strptime(shift.end_time, "%H:%M")
    hours = (end - start).seconds / 3600
    
    if shift.rate_type == "hourly":
        earnings = hours * shift.rate_value
    else:
        earnings = shift.rate_value
    
    conn = database.get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO shifts 
        (workplace_id, shift_date, start_time, end_time, hours, rate_type, rate_value, earnings, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        shift.workplace_id,
        shift.shift_date.isoformat(),
        shift.start_time,
        shift.end_time,
        hours,
        shift.rate_type,
        shift.rate_value,
        earnings,
        shift.notes
    ))
    conn.commit()
    shift_id = cursor.lastrowid
    conn.close()
    return {"id": shift_id, "message": "Смена добавлена"}

@app.get("/api/shifts")
def get_shifts(start_date: Optional[str] = None, end_date: Optional[str] = None):
    conn = database.get_connection()
    cursor = conn.cursor()
    
    query = """
        SELECT s.id, w.name, s.shift_date, s.start_time, s.end_time, 
               s.hours, s.rate_type, s.rate_value, s.earnings, s.notes
        FROM shifts s
        JOIN workplaces w ON s.workplace_id = w.id
    """
    params = []
    
    if start_date and end_date:
        query += " WHERE s.shift_date BETWEEN ? AND ?"
        params = [start_date, end_date]
    
    query += " ORDER BY s.shift_date DESC, s.start_time"
    
    cursor.execute(query, params)
    shifts = []
    for row in cursor.fetchall():
        shifts.append({
            "id": row[0],
            "workplace": row[1],
            "date": row[2],
            "start": row[3],
            "end": row[4],
            "hours": row[5],
            "rate_type": row[6],
            "rate_value": row[7],
            "earnings": row[8],
            "notes": row[9]
        })
    conn.close()
    return shifts

@app.get("/api/report")
def get_report(start_date: str, end_date: str):
    conn = database.get_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT 
            COUNT(*) as total_shifts,
            SUM(hours) as total_hours,
            SUM(earnings) as total_earnings,
            AVG(earnings) as avg_per_shift
        FROM shifts
        WHERE shift_date BETWEEN ? AND ?
    """, [start_date, end_date])
    
    total = cursor.fetchone()
    
    cursor.execute("""
        SELECT 
            w.name,
            COUNT(*) as shifts_count,
            SUM(s.hours) as hours,
            SUM(s.earnings) as earnings
        FROM shifts s
        JOIN workplaces w ON s.workplace_id = w.id
        WHERE s.shift_date BETWEEN ? AND ?
        GROUP BY w.name
        ORDER BY earnings DESC
    """, [start_date, end_date])
    
    by_workplace = []
    for row in cursor.fetchall():
        by_workplace.append({
            "name": row[0],
            "shifts": row[1],
            "hours": row[2],
            "earnings": row[3]
        })
    conn.close()
    
    return {
        "period": f"{start_date} - {end_date}",
        "total_shifts": total[0] or 0,
        "total_hours": round(total[1] or 0, 1),
        "total_earnings": round(total[2] or 0, 2),
        "avg_per_shift": round(total[3] or 0, 2),
        "by_workplace": by_workplace
    }