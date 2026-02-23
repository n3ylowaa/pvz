from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import date, datetime
import psycopg2
from typing import Optional, List
import database

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- СУЩЕСТВУЮЩИЕ МОДЕЛИ ---
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

# --- НОВЫЕ МОДЕЛИ ДЛЯ ПВЗ ---
class PVZPointBase(BaseModel):
    name: str
    address: str
    description: Optional[str] = None
    photo_url: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    working_hours_start: str = "09:00"
    working_hours_end: str = "21:00"
    rate_hourly: Optional[float] = None
    rate_fixed: Optional[float] = None
    marketplaces: List[str] = []

class PVZPointCreate(PVZPointBase):
    pass

class PVZPointResponse(PVZPointBase):
    id: int
    created_at: str
    average_rating: Optional[float] = None
    reviews_count: int = 0

# --- МОДЕЛИ ДЛЯ ОТЗЫВОВ ---
class ReviewBase(BaseModel):
    pvz_id: int
    rating: int
    comment: Optional[str] = None

class ReviewCreate(ReviewBase):
    pass

class ReviewResponse(ReviewBase):
    id: int
    created_at: str
    is_approved: bool
    user_name: Optional[str] = None

# --- СУЩЕСТВУЮЩИЕ ЭНДПОИНТЫ ---
@app.get("/api/workplaces")
def get_workplaces():
    conn = database.get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name FROM workplaces ORDER BY name")
    workplaces = [{"id": row["id"], "name": row["name"]} for row in cursor.fetchall()]
    conn.close()
    return workplaces

@app.post("/api/workplaces")
def create_workplace(workplace: Workplace):
    conn = database.get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO workplaces (name) VALUES (%s) RETURNING id",
            (workplace.name,)
        )
        new_id = cursor.fetchone()["id"]
        conn.commit()
        return {"id": new_id, "name": workplace.name}
    except psycopg2.errors.UniqueViolation:
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
            "id": row["id"],
            "name": row["name"],
            "start_time": row["start_time"],
            "end_time": row["end_time"],
            "rate_type": row["default_rate_type"],
            "rate_value": row["default_rate_value"]
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
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id
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
    shift_id = cursor.fetchone()["id"]
    conn.commit()
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
        query += " WHERE s.shift_date BETWEEN %s AND %s"
        params = [start_date, end_date]
    
    query += " ORDER BY s.shift_date DESC, s.start_time"
    
    cursor.execute(query, params)
    shifts = []
    for row in cursor.fetchall():
        shifts.append({
            "id": row["id"],
            "workplace": row["name"],
            "date": row["shift_date"],
            "start": row["start_time"],
            "end": row["end_time"],
            "hours": row["hours"],
            "rate_type": row["rate_type"],
            "rate_value": row["rate_value"],
            "earnings": row["earnings"],
            "notes": row["notes"]
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
        WHERE shift_date BETWEEN %s AND %s
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
        WHERE s.shift_date BETWEEN %s AND %s
        GROUP BY w.name
        ORDER BY earnings DESC
    """, [start_date, end_date])
    
    by_workplace = []
    for row in cursor.fetchall():
        by_workplace.append({
            "name": row["name"],
            "shifts": row["shifts_count"],
            "hours": row["hours"],
            "earnings": row["earnings"]
        })
    conn.close()
    
    return {
        "period": f"{start_date} - {end_date}",
        "total_shifts": total["total_shifts"] or 0,
        "total_hours": round(total["total_hours"] or 0, 1),
        "total_earnings": round(total["total_earnings"] or 0, 2),
        "avg_per_shift": round(total["avg_per_shift"] or 0, 2),
        "by_workplace": by_workplace
    }

# --- НОВЫЕ ЭНДПОИНТЫ ДЛЯ ПВЗ ---
@app.get("/api/pvz", response_model=List[PVZPointResponse])
def get_pvz_points():
    conn = database.get_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT 
            p.*,
            COALESCE(AVG(r.rating), 0) as average_rating,
            COUNT(r.id) as reviews_count
        FROM pvz_points p
        LEFT JOIN reviews r ON p.id = r.pvz_id AND r.is_approved = true
        GROUP BY p.id
        ORDER BY p.name
    """)
    
    points = []
    for row in cursor.fetchall():
        point = dict(row)
        if point.get('marketplaces') and isinstance(point['marketplaces'], str):
            point['marketplaces'] = point['marketplaces'].strip('{}').split(',')
        points.append(point)
    
    conn.close()
    return points

@app.get("/api/pvz/{pvz_id}", response_model=PVZPointResponse)
def get_pvz_point(pvz_id: int):
    conn = database.get_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT 
            p.*,
            COALESCE(AVG(r.rating), 0) as average_rating,
            COUNT(r.id) as reviews_count
        FROM pvz_points p
        LEFT JOIN reviews r ON p.id = r.pvz_id AND r.is_approved = true
        WHERE p.id = %s
        GROUP BY p.id
    """, (pvz_id,))
    
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        raise HTTPException(status_code=404, detail="PVZ point not found")
    
    point = dict(row)
    if point.get('marketplaces') and isinstance(point['marketplaces'], str):
        point['marketplaces'] = point['marketplaces'].strip('{}').split(',')
    
    return point

@app.post("/api/pvz", response_model=PVZPointResponse)
def create_pvz_point(point: PVZPointCreate):
    conn = database.get_connection()
    cursor = conn.cursor()
    
    marketplaces_str = '{' + ','.join(point.marketplaces) + '}' if point.marketplaces else '{}'
    
    cursor.execute("""
        INSERT INTO pvz_points (
            name, address, description, photo_url, 
            latitude, longitude, working_hours_start, working_hours_end,
            rate_hourly, rate_fixed, marketplaces
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING *
    """, (
        point.name, point.address, point.description, point.photo_url,
        point.latitude, point.longitude, point.working_hours_start, point.working_hours_end,
        point.rate_hourly, point.rate_fixed, marketplaces_str
    ))
    
    new_point = dict(cursor.fetchone())
    conn.commit()
    conn.close()
    
    return new_point

@app.put("/api/pvz/{pvz_id}", response_model=PVZPointResponse)
def update_pvz_point(pvz_id: int, point: PVZPointCreate):
    conn = database.get_connection()
    cursor = conn.cursor()
    
    marketplaces_str = '{' + ','.join(point.marketplaces) + '}' if point.marketplaces else '{}'
    
    cursor.execute("""
        UPDATE pvz_points SET
            name = %s, address = %s, description = %s, photo_url = %s,
            latitude = %s, longitude = %s, working_hours_start = %s, working_hours_end = %s,
            rate_hourly = %s, rate_fixed = %s, marketplaces = %s,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = %s
        RETURNING *
    """, (
        point.name, point.address, point.description, point.photo_url,
        point.latitude, point.longitude, point.working_hours_start, point.working_hours_end,
        point.rate_hourly, point.rate_fixed, marketplaces_str,
        pvz_id
    ))
    
    updated = cursor.fetchone()
    conn.commit()
    conn.close()
    
    if not updated:
        raise HTTPException(status_code=404, detail="PVZ point not found")
    
    return dict(updated)

@app.delete("/api/pvz/{pvz_id}")
def delete_pvz_point(pvz_id: int):
    conn = database.get_connection()
    cursor = conn.cursor()
    
    cursor.execute("DELETE FROM pvz_points WHERE id = %s RETURNING id", (pvz_id,))
    deleted = cursor.fetchone()
    conn.commit()
    conn.close()
    
    if not deleted:
        raise HTTPException(status_code=404, detail="PVZ point not found")
    
    return {"message": "PVZ point deleted"}

# --- НОВЫЕ ЭНДПОИНТЫ ДЛЯ ОТЗЫВОВ ---
@app.get("/api/pvz/{pvz_id}/reviews", response_model=List[ReviewResponse])
def get_pvz_reviews(pvz_id: int):
    conn = database.get_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT r.*
        FROM reviews r
        WHERE r.pvz_id = %s AND r.is_approved = true
        ORDER BY r.created_at DESC
    """, (pvz_id,))
    
    reviews = []
    for row in cursor.fetchall():
        reviews.append(dict(row))
    
    conn.close()
    return reviews

@app.post("/api/reviews", response_model=ReviewResponse)
def create_review(review: ReviewCreate):
    conn = database.get_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        INSERT INTO reviews (pvz_id, rating, comment)
        VALUES (%s, %s, %s)
        RETURNING *
    """, (review.pvz_id, review.rating, review.comment))
    
    new_review = dict(cursor.fetchone())
    conn.commit()
    conn.close()
    
    return new_review

@app.put("/api/reviews/{review_id}/approve")
def approve_review(review_id: int):
    conn = database.get_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        UPDATE reviews SET is_approved = true
        WHERE id = %s RETURNING id
    """, (review_id,))
    
    updated = cursor.fetchone()
    conn.commit()
    conn.close()
    
    if not updated:
        raise HTTPException(status_code=404, detail="Review not found")
    
    return {"message": "Review approved"}