@echo off
REM ============================================
REM SmartRecall - Installation Script (Windows)
REM ============================================
REM Installs: AI Service (Flask), Backend API (Node.js), Frontend Web (React)

setlocal enabledelayedexpansion
cd /d "%~dp0"

echo.
echo ====================================
echo  SmartRecall Installation Script
echo ====================================
echo.

REM Check if Node.js is installed
echo Checking Node.js...
node -v >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed. Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)
echo [OK] Node.js is installed: 
node -v

REM Check if Python is installed
echo.
echo Checking Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed. Please install Python from https://www.python.org/
    pause
    exit /b 1
)
echo [OK] Python is installed: 
python --version

REM Check if pip is installed
echo.
echo Checking pip...
pip --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] pip is not installed. Please install pip.
    pause
    exit /b 1
)
echo [OK] pip is installed

echo.
echo ====================================
echo Installing AI Service (Flask)
echo ====================================
if exist ai-service (
    cd ai-service
    echo Setting up .env file...
    if exist .env.example (
        if not exist .env (
            copy .env.example .env >nul
            echo [OK] .env created from .env.example
        ) else (
            echo [OK] .env already exists
        )
    ) else (
        echo [WARNING] .env.example not found
    )
    echo Installing Python dependencies...
    pip install -r requirements.txt
    if errorlevel 1 (
        echo [ERROR] Failed to install AI Service dependencies
        cd ..
        pause
        exit /b 1
    )
    echo [OK] AI Service installed successfully
    cd ..
) else (
    echo [ERROR] ai-service folder not found
    pause
    exit /b 1
)

echo.
echo ====================================
echo Installing Backend API (Node.js)
echo ====================================
if exist backend-api (
    cd backend-api
    echo Setting up .env file...
    if exist .env.example (
        if not exist .env (
            copy .env.example .env >nul
            echo [OK] .env created from .env.example
        ) else (
            echo [OK] .env already exists
        )
    ) else (
        echo [WARNING] .env.example not found
    )
    echo Installing Node.js dependencies...
    call npm install
    if errorlevel 1 (
        echo [ERROR] Failed to install Backend API dependencies
        cd ..
        pause
        exit /b 1
    )
    echo [OK] Backend API installed successfully
    cd ..
) else (
    echo [ERROR] backend-api folder not found
    pause
    exit /b 1
)

echo.
echo ====================================
echo Installing Frontend Web (React)
echo ====================================
if exist frontend-web (
    cd frontend-web
    echo Setting up .env file...
    if exist .env.example (
        if not exist .env (
            copy .env.example .env >nul
            echo [OK] .env created from .env.example
        ) else (
            echo [OK] .env already exists
        )
    ) else (
        echo [WARNING] .env.example not found
    )
    echo Installing React dependencies...
    call npm install
    if errorlevel 1 (
        echo [ERROR] Failed to install Frontend Web dependencies
        cd ..
        pause
        exit /b 1
    )
    echo [OK] Frontend Web installed successfully
    cd ..
) else (
    echo [ERROR] frontend-web folder not found
    pause
    exit /b 1
)

echo.
echo ====================================
echo Installation Complete!
echo ====================================
echo.
echo Setup instructions:
echo.
echo 1. AI Service (Flask):
echo    - Navigate to: cd ai-service
echo    - Edit .env with your configuration
echo    - Run: python app.py
echo.
echo 2. Backend API (Node.js):
echo    - Navigate to: cd backend-api
echo    - Edit .env with your configuration
echo    - Setup database: npx prisma migrate dev
echo    - Run: npm start
echo.
echo 3. Frontend Web (React):
echo    - Navigate to: cd frontend-web
echo    - Edit .env with your configuration
echo    - Run: npm run dev
echo.
echo ====================================
pause
