@echo off
REM Build script for Windows to create desktop app installer

echo 🔨 Building MoreTranz Printer Desktop App...

REM Install dependencies if needed
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    call npm install
)

REM Build the installer
echo 🏗️ Creating installer...
call npm run build:win

REM Check if build was successful
if exist "dist\MoreTranz Printer Setup.exe" (
    echo ✅ Build successful!
    echo 📦 Installer location: dist\MoreTranz Printer Setup.exe
    echo.
    echo 📋 Next steps:
    echo    1. Copy installer to server: desktop-app\dist\MoreTranz Printer Setup.exe
    echo    2. Update desktop.py endpoint to point to installer location
    echo    3. Users can download from Dashboard
) else (
    echo ❌ Build failed! Check errors above.
    exit /b 1
)

pause

