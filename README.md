# MoreTranz API

A full-stack application with FastAPI backend and React frontend for processing and managing orders.

## Project Structure

- `/app` - Backend FastAPI application
  - `/api` - API endpoints
  - `/core` - Core configuration
  - `/models` - Database models
  - `/schemas` - Pydantic schemas
  - `/services` - Business logic services
  - `/utils` - Utility functions

- `/frontend` - React frontend application
  - `/src` - Source code
  - `/public` - Static assets

## Prerequisites

- Python 3.8+
- Node.js 14+
- PostgreSQL
- wkhtmltopdf (included in /lib)
- SumatraPDF (included in /lib)

## Setup

1. Clone the repository
```bash
git clone [repository-url]
cd moretranz_api
```

2. Backend Setup
```bash
# Create and activate virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file from template
cp .env.example .env
# Edit .env with your configuration

# Run database migrations
python run_migrations.py
```

3. Frontend Setup
```bash
cd frontend
npm install
```

## Running the Application

1. Start the backend:
```bash
# From the root directory
python -m app.main
```

2. Start the frontend:
```bash
# From the frontend directory
npm start
```

## Features

- Order processing and management
- Email processing
- PDF generation
- Real-time updates via WebSocket
- OpenAI integration for enhanced processing

## Development

The project follows modular architecture [[memory:7903108]] with emphasis on:
- Clean code practices
- Modular design
- Future extensibility
- Comprehensive error handling

## Environment Variables

Key environment variables needed (see .env.example for full list):
- Database configuration
- Email settings
- OpenAI API key
- Application settings

## License

[Your License Here]
