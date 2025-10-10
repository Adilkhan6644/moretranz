#!/bin/bash

# Moretranz API Deployment Script
# This script helps deploy the application to a production server

echo "🚀 Starting Moretranz API Deployment..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from production template..."
    cp env.production.ready .env
    echo "⚠️  Please edit .env file with your actual configuration values before continuing."
    echo "   Important: Update SECRET_KEY, ALLOWED_ORIGINS, and email settings."
    read -p "Press Enter after updating .env file..."
fi

# Create necessary directories
echo "📁 Creating necessary directories..."
mkdir -p logs attachments downloads

# Set proper permissions
echo "🔐 Setting proper permissions..."
chmod 755 logs attachments downloads

# Stop any existing containers
echo "🛑 Stopping existing containers..."
docker-compose down

# Build and start the application
echo "🔨 Building and starting the application..."
docker-compose up -d --build

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 10

# Check if services are running
echo "🔍 Checking service status..."
docker-compose ps

# Show logs
echo "📋 Recent logs:"
docker-compose logs --tail=20

echo ""
echo "✅ Deployment completed!"
echo ""
echo "🌐 Your application should be available at:"
echo "   Frontend: http://your-server-ip:3000"
echo "   Backend API: http://your-server-ip:81"
echo ""
echo "📊 To monitor the application:"
echo "   docker-compose ps"
echo "   docker-compose logs -f"
echo ""
echo "🔄 To update the application:"
echo "   git pull"
echo "   docker-compose down"
echo "   docker-compose up -d --build"
