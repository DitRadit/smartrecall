@echo off
REM ============================================
REM SmartRecall - Uninstallation Script (Windows)
REM ============================================
REM Removes: Node modules, Python cache, and dependencies

setlocal enabledelayedexpansion
cd /d "%~dp0"

echo.
echo ====================================
echo  SmartRecall Uninstallation Script
echo ====================================
echo.
echo This will remove all dependencies and cached files.
echo.
set /p confirm="Are you sure you want to uninstall? (yes/no): "
if /i not "%confirm%"=="yes" (
    echo Uninstallation cancelled
    pause
    exit /b 0
)

echo.
echo ====================================
echo Cleaning AI Service (Flask)
echo ====================================
if exist ai-service (
    cd ai-service
    echo Removing Python cache...
    if exist __pycache__ rmdir /s /q __pycache__
    if exist .pytest_cache rmdir /s /q .pytest_cache
    if exist venv rmdir /s /q venv
    echo [OK] AI Service cache cleaned
    cd ..
) else (
    echo [WARNING] ai-service folder not found
)

echo.
echo ====================================
echo Cleaning Backend API (Node.js)
echo ====================================
if exist backend-api (
    cd backend-api
    echo Removing node_modules...
    if exist node_modules rmdir /s /q node_modules
    if exist package-lock.json del package-lock.json
    echo Removing .prisma cache...
    if exist .prisma rmdir /s /q .prisma
    echo [OK] Backend API cleaned
    cd ..
) else (
    echo [WARNING] backend-api folder not found
)

echo.
echo ====================================
echo Cleaning Frontend Web (React)
echo ====================================
if exist frontend-web (
    cd frontend-web
    echo Removing node_modules...
    if exist node_modules rmdir /s /q node_modules
    if exist package-lock.json del package-lock.json
    echo Removing build cache...
    if exist dist rmdir /s /q dist
    if exist .vite rmdir /s /q .vite
    echo [OK] Frontend Web cleaned
    cd ..
) else (
    echo [WARNING] frontend-web folder not found
)

echo.
echo ====================================
echo Uninstallation Complete!
echo ====================================
echo.
echo All dependencies and cache files have been removed.
echo To reinstall, run: install.bat
echo.
pause
