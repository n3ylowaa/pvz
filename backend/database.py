import os
import psycopg2
from psycopg2.extras import RealDictCursor

def get_connection():
    """Подключение к PostgreSQL базе данных"""
    DATABASE_URL = os.getenv('DATABASE_URL')
    
    if not DATABASE_URL:
        raise Exception("DATABASE_URL не задан в переменных окружения")
    
    # Для Neon/Prisma добавляем sslmode=require, если его нет
    if 'sslmode' not in DATABASE_URL:
        if '?' in DATABASE_URL:
            DATABASE_URL = DATABASE_URL + '&sslmode=require'
        else:
            DATABASE_URL = DATABASE_URL + '?sslmode=require'
    
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
    return conn

def init_database():
    """Создаёт таблицы при первом запуске"""
    conn = get_connection()
    cursor = conn.cursor()
    
    # Таблица мест работы (точки ПВЗ)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS workplaces (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Таблица шаблонов смен
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS shift_templates (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            start_time TIME NOT NULL,
            end_time TIME NOT NULL,
            default_rate_type TEXT NOT NULL,
            default_rate_value REAL NOT NULL
        )
    """)
    
    # Таблица смен
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS shifts (
            id SERIAL PRIMARY KEY,
            workplace_id INTEGER NOT NULL,
            shift_date DATE NOT NULL,
            start_time TIME NOT NULL,
            end_time TIME NOT NULL,
            hours REAL NOT NULL,
            rate_type TEXT NOT NULL,
            rate_value REAL NOT NULL,
            earnings REAL NOT NULL,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (workplace_id) REFERENCES workplaces (id) ON DELETE CASCADE
        )
    """)
    
    # Проверяем, есть ли шаблоны
    cursor.execute("SELECT COUNT(*) FROM shift_templates")
    if cursor.fetchone()['count'] == 0:
        templates = [
            ('9-21', '09:00', '21:00', 'hourly', 125),
            ('15-21', '15:00', '21:00', 'fixed', 1500),
            ('9-15', '09:00', '15:00', 'fixed', 1000),
        ]
        for template in templates:
            cursor.execute("""
                INSERT INTO shift_templates 
                (name, start_time, end_time, default_rate_type, default_rate_value)
                VALUES (%s, %s, %s, %s, %s)
            """, template)
    
    conn.commit()
    conn.close()

def init_db():
    """Функция для вызова при старте приложения"""
    try:
        init_database()
        print("База данных инициализирована успешно")
    except Exception as e:
        print(f"Ошибка инициализации базы данных: {e}")

# Если файл запускается напрямую
if __name__ == "__main__":
    init_db()