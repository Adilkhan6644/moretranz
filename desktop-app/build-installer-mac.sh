#!/bin/bash
# Build script for creating macOS desktop app installer

echo "🔨 Building MoreTranz Printer Desktop App for macOS..."

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Build the installer
echo "🏗️ Creating macOS installer..."
npm run build:mac

# Check if build was successful
if [ -f "dist/MoreTranz Printer.dmg" ]; then
    echo "✅ Build successful!"
    echo "📦 Installer location: dist/MoreTranz Printer.dmg"
    echo ""
    echo "📋 Next steps:"
    echo "   1. Copy installer to server: desktop-app/dist/MoreTranz Printer.dmg"
    echo "   2. Update desktop.py endpoint to point to installer location"
    echo "   3. Users can download from Dashboard"
else
    echo "❌ Build failed! Check errors above."
    exit 1
fi

