"""Run once to create all tables from SQLAlchemy models (alternative to schema.sql)."""
from app.db.session import Base, engine
from app.models import models  # noqa: F401 ensures models are registered

if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    print("All tables created.")
