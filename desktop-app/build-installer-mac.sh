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

# Check if build was successful (electron-builder creates versioned filenames)
DMG_X64=$(ls dist/MoreTranz\ Printer-*.dmg 2>/dev/null | head -1)

if [ -n "$DMG_X64" ]; then
    echo "✅ Build successful!"
    echo "📦 x64 Installer: $DMG_X64"
    echo ""
    echo "📋 Next steps:"
    echo "   1. Copy installer(s) to server static/desktop-app/ directory"
    echo "   2. Backend will automatically detect the DMG file(s)"
    echo "   3. Users can download from Dashboard (select macOS)"
else
    echo "❌ Build failed! No DMG file found in dist/ directory."
    echo "   Expected: dist/MoreTranz Printer-*.dmg"
    exit 1
fi

