@echo off
REM Moretranz API Deployment Script for Windows
REM This script helps deploy the application to a production server

echo 🚀 Starting Moretranz API Deployment...

REM Check if Docker is installed
docker --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker is not installed. Please install Docker first.
    pause
    exit /b 1
)

REM Check if Docker Compose is installed
docker-compose --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker Compose is not installed. Please install Docker Compose first.
    pause
    exit /b 1
)

REM Create .env file if it doesn't exist
if not exist .env (
    echo 📝 Creating .env file from production template...
    copy env.production.ready .env
    echo ⚠️  Please edit .env file with your actual configuration values before continuing.
    echo    Important: Update SECRET_KEY, ALLOWED_ORIGINS, and email settings.
    pause
)

REM Create necessary directories
echo 📁 Creating necessary directories...
if not exist logs mkdir logs
if not exist attachments mkdir attachments
if not exist downloads mkdir downloads

REM Stop any existing containers
echo 🛑 Stopping existing containers...
docker-compose down

REM Build and start the application
echo 🔨 Building and starting the application...
docker-compose up -d --build

REM Wait for services to be ready
echo ⏳ Waiting for services to start...
timeout /t 10 /nobreak >nul

REM Check if services are running
echo 🔍 Checking service status...
docker-compose ps

REM Show logs
echo 📋 Recent logs:
docker-compose logs --tail=20

echo.
echo ✅ Deployment completed!
echo.
echo 🌐 Your application should be available at:
echo    Frontend: http://your-server-ip:3000
echo    Backend API: http://your-server-ip:81
echo.
echo 📊 To monitor the application:
echo    docker-compose ps
echo    docker-compose logs -f
echo.
echo 🔄 To update the application:
echo    git pull
echo    docker-compose down
echo    docker-compose up -d --build

pause
