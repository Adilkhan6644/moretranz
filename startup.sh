#!/bin/bash

# Wait for database to be ready
echo "Waiting for database to be ready..."
while ! pg_isready -h db -p 5432 -U moretranz_user -d moretranz_db; do
  echo "Database is unavailable - sleeping"
  sleep 2
done

echo "Database is ready - running migrations..."

# Run database migrations
python run_migrations.py

echo "Starting application..."

# Start the application
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
