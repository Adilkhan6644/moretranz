from app.db.session import SessionLocal
from app.models.order import Order, Attachment, PrintJob
from sqlalchemy.orm import joinedload

def query_orders():
    db = SessionLocal()
    try:
        # Get all orders with their related data
        orders = db.query(Order).options(
            joinedload(Order.attachments),
            joinedload(Order.print_jobs)
        ).all()
        
        print(f"Found {len(orders)} orders:")
        print("-" * 50)
        
        for order in orders:
            print(f"Order ID: {order.id}")
            print(f"PO Number: {order.po_number}")
            print(f"Order Type: {order.order_type}")
            print(f"Customer: {order.customer_name}")
            print(f"Delivery Address: {order.delivery_address}")
            print(f"Shipping Date: {order.committed_shipping_date}")
            print(f"Status: {order.status}")
            print(f"Processed: {order.processed_time}")
            print(f"Folder: {order.folder_path}")
            
            if order.attachments:
                print(f"Attachments ({len(order.attachments)}):")
                for att in order.attachments:
                    print(f"  - {att.file_name} ({att.file_type})")
            
            if order.print_jobs:
                print(f"Print Jobs ({len(order.print_jobs)}):")
                for job in order.print_jobs:
                    print(f"  - {job.job_type}: {job.total_print_length} inches, {job.gang_sheets} sheets")
            
            print("-" * 50)
            
    finally:
        db.close()

if __name__ == "__main__":
    query_orders()
