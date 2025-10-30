#!/bin/bash
# Build script for creating desktop app installer

echo "🔨 Building MoreTranz Printer Desktop App..."

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Build the installer
echo "🏗️ Creating installer..."
npm run build:win

# Check if build was successful
if [ -f "dist/MoreTranz Printer Setup.exe" ]; then
    echo "✅ Build successful!"
    echo "📦 Installer location: dist/MoreTranz Printer Setup.exe"
    echo ""
    echo "📋 Next steps:"
    echo "   1. Copy installer to server: desktop-app/dist/MoreTranz Printer Setup.exe"
    echo "   2. Update desktop.py endpoint to point to installer location"
    echo "   3. Users can download from Dashboard"
else
    echo "❌ Build failed! Check errors above."
    exit 1
fi

