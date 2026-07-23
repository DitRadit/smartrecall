#!/bin/bash

# ============================================
# SmartRecall - Installation Script (macOS/Linux)
# ============================================
# Installs: AI Service (Flask), Backend API (Node.js), Frontend Web (React)

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo
echo -e "${BLUE}===================================="
echo "  SmartRecall Installation Script"
echo "====================================${NC}"
echo

# Check if Node.js is installed
echo -e "${YELLOW}Checking Node.js...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}[ERROR] Node.js is not installed${NC}"
    echo "Install from: https://nodejs.org/"
    exit 1
fi
echo -e "${GREEN}[OK] Node.js is installed:${NC}"
node -v

# Check if npm is installed
echo
echo -e "${YELLOW}Checking npm...${NC}"
if ! command -v npm &> /dev/null; then
    echo -e "${RED}[ERROR] npm is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}[OK] npm is installed:${NC}"
npm -v

# Check if Python is installed
echo
echo -e "${YELLOW}Checking Python...${NC}"
if ! command -v python3 &> /dev/null; then
    if ! command -v python &> /dev/null; then
        echo -e "${RED}[ERROR] Python is not installed${NC}"
        echo "Install from: https://www.python.org/"
        exit 1
    fi
    PYTHON_CMD="python"
else
    PYTHON_CMD="python3"
fi
echo -e "${GREEN}[OK] Python is installed:${NC}"
$PYTHON_CMD --version

# Check if pip is installed
echo
echo -e "${YELLOW}Checking pip...${NC}"
if ! command -v pip3 &> /dev/null; then
    if ! command -v pip &> /dev/null; then
        echo -e "${RED}[ERROR] pip is not installed${NC}"
        exit 1
    fi
    PIP_CMD="pip"
else
    PIP_CMD="pip3"
fi
echo -e "${GREEN}[OK] pip is installed:${NC}"
$PIP_CMD --version

# Install AI Service
echo
echo -e "${BLUE}===================================="
echo "Installing AI Service (Flask)"
echo "====================================${NC}"
if [ -d "ai-service" ]; then
    cd ai-service
    echo -e "${YELLOW}Setting up .env file...${NC}"
    if [ -f ".env.example" ]; then
        if [ ! -f ".env" ]; then
            cp .env.example .env
            echo -e "${GREEN}[OK] .env created from .env.example${NC}"
        else
            echo -e "${GREEN}[OK] .env already exists${NC}"
        fi
    else
        echo -e "${YELLOW}[WARNING] .env.example not found${NC}"
    fi
    echo -e "${YELLOW}Installing Python dependencies...${NC}"
    $PIP_CMD install -r requirements.txt
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}[OK] AI Service installed successfully${NC}"
    else
        echo -e "${RED}[ERROR] Failed to install AI Service dependencies${NC}"
        cd ..
        exit 1
    fi
    cd ..
else
    echo -e "${RED}[ERROR] ai-service folder not found${NC}"
    exit 1
fi

# Install Backend API
echo
echo -e "${BLUE}===================================="
echo "Installing Backend API (Node.js)"
echo "====================================${NC}"
if [ -d "backend-api" ]; then
    cd backend-api
    echo -e "${YELLOW}Setting up .env file...${NC}"
    if [ -f ".env.example" ]; then
        if [ ! -f ".env" ]; then
            cp .env.example .env
            echo -e "${GREEN}[OK] .env created from .env.example${NC}"
        else
            echo -e "${GREEN}[OK] .env already exists${NC}"
        fi
    else
        echo -e "${YELLOW}[WARNING] .env.example not found${NC}"
    fi
    echo -e "${YELLOW}Installing Node.js dependencies...${NC}"
    npm install
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}[OK] Backend API installed successfully${NC}"
    else
        echo -e "${RED}[ERROR] Failed to install Backend API dependencies${NC}"
        cd ..
        exit 1
    fi
    cd ..
else
    echo -e "${RED}[ERROR] backend-api folder not found${NC}"
    exit 1
fi

# Install Frontend Web
echo
echo -e "${BLUE}===================================="
echo "Installing Frontend Web (React)"
echo "====================================${NC}"
if [ -d "frontend-web" ]; then
    cd frontend-web
    echo -e "${YELLOW}Setting up .env file...${NC}"
    if [ -f ".env.example" ]; then
        if [ ! -f ".env" ]; then
            cp .env.example .env
            echo -e "${GREEN}[OK] .env created from .env.example${NC}"
        else
            echo -e "${GREEN}[OK] .env already exists${NC}"
        fi
    else
        echo -e "${YELLOW}[WARNING] .env.example not found${NC}"
    fi
    echo -e "${YELLOW}Installing React dependencies...${NC}"
    npm install
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}[OK] Frontend Web installed successfully${NC}"
    else
        echo -e "${RED}[ERROR] Failed to install Frontend Web dependencies${NC}"
        cd ..
        exit 1
    fi
    cd ..
else
    echo -e "${RED}[ERROR] frontend-web folder not found${NC}"
    exit 1
fi

echo
echo -e "${BLUE}===================================="
echo "Installation Complete!"
echo "====================================${NC}"
echo
echo -e "${GREEN}Setup instructions:${NC}"
echo
echo "1. ${YELLOW}AI Service (Flask):${NC}"
echo "   cd ai-service"
echo "   # Edit .env with your configuration"
echo "   python app.py"
echo
echo "2. ${YELLOW}Backend API (Node.js):${NC}"
echo "   cd backend-api"
echo "   # Edit .env with your configuration"
echo "   npx prisma migrate dev"
echo "   npm start"
echo
echo "3. ${YELLOW}Frontend Web (React):${NC}"
echo "   cd frontend-web"
echo "   # Edit .env with your configuration"
echo "   npm run dev"
echo
echo -e "${BLUE}===================================${NC}"
echo
