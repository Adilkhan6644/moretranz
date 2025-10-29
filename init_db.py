from app.db.base import Base
from app.db.session import engine
from app.models.user import User
from app.models.order import Order, Attachment, ProcessingLog, PrintJob, EmailConfig, PrinterConfig

def init_db():
    print("Creating database tables...")
    # Create all tables (skip dropping for now to avoid FK issues)
    Base.metadata.create_all(bind=engine)
    print("Database tables created successfully!")

if __name__ == "__main__":
    init_db()
