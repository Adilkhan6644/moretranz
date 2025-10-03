from app.db.base import Base
from app.db.session import engine
from app.models.order import Order, Attachment, ProcessingLog, PrintJob, EmailConfig, PrinterConfig

def init_db():
    print("Creating database tables...")
    # Drop all tables first to ensure clean state
    Base.metadata.drop_all(bind=engine)
    # Create all tables
    Base.metadata.create_all(bind=engine)
    print("Database tables created successfully!")

if __name__ == "__main__":
    init_db()
