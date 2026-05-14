from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker
import os
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv('DATABASE_URL')
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)
Base = declarative_base()

def create_tables():
    import models          
    import models_notes    
    import models_users    
    Base.metadata.create_all(bind=engine)

def ensure_schema_updates():
    with engine.begin() as connection:
        connection.execute(
            text(
                """
                ALTER TABLE users
                ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE
                """
            )
        )

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

print("DATABASE_URL:", DATABASE_URL)