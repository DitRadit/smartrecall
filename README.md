# SmartRecall

**Offline-First Spaced Repetition PWA untuk Pembelajaran Siswa & Guru Indonesia**

SmartRecall adalah aplikasi pembelajaran berbasis teknologi AI yang dirancang untuk membantu siswa dan guru di daerah dengan konektivitas terbatas. Aplikasi ini menggunakan algoritma Spaced Repetition SM-2 untuk meningkatkan retensi materi pembelajaran.

> **Bahasa:** [Bahasa Indonesia](#bahasa-indonesia) | [English](#english)

---

## English

### Overview

SmartRecall is an offline-first web and mobile application that helps students and teachers create, manage, and practice learning materials using AI-powered content generation and spaced repetition algorithms.

**Key Features:**
- AI-powered question and flashcard generation
- Offline-first PWA (Progressive Web App)
- Auto-sync when connection is available
- Spaced Repetition (SM-2 Algorithm)
- Learning analytics and statistics
- Role-based access (Admin, Guru, Siswa)
- PDF & PPT support

### Tech Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Frontend** | React + Vite | Web UI with PWA support |
| **Backend** | Node.js + Express | REST API |
| **AI Service** | Python + Flask | LLM integration & content generation |
| **Database** | SQLite/PostgreSQL | Data persistence |
| **ORM** | Prisma | Database management |
| **Real-time** | Socket.io | Live notifications |

### Prerequisites

Before installation, make sure you have:

- Node.js v16 or higher (Download from https://nodejs.org/)
- Python 3.8 or higher (Download from https://www.python.org/)
- pip (usually comes with Python)
- npm or yarn (comes with Node.js)

### Quick Start

#### Option 1: Automated Installation (Recommended)

**For Windows:**
```batch
install.bat
```

**For macOS/Linux:**
```bash
chmod +x install.sh
./install.sh
```

The script will:
- Check all prerequisites
- Install all dependencies
- Setup .env files automatically
- Display next steps

#### Option 2: Manual Installation

**1. AI Service (Flask)**
```bash
cd ai-service
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your configuration
python app.py
```

**2. Backend API (Node.js)**
```bash
cd backend-api
npm install
cp .env.example .env
nnpx prisma migrate dev --name init
npx prisma generate
npm run dev
```

**3. Frontend Web (React)**
```bash
cd frontend-web
npm install
cp .env.example .env
npm run dev -- --host
```

### Project Structure

```
smartrecall/
├── ai-service/              # Python Flask service
│   ├── app.py              # Main Flask app
│   ├── routes/             # API routes
│   ├── services/           # Business logic
│   ├── utils/              # Helper functions
│   ├── templates/          # PPT templates
│   └── requirements.txt    # Python dependencies
│
├── backend-api/            # Node.js Express API
│   ├── src/
│   │   ├── controllers/    # Request handlers
│   │   ├── routes/        # API endpoints
│   │   ├── services/      # Business logic
│   │   ├── middleware/    # Custom middleware
│   │   └── socket.js      # Real-time events
│   ├── prisma/            # Database schema
│   ├── package.json       # Node dependencies
│   └── jest.config.js     # Test configuration
│
├── frontend-web/          # React + Vite UI
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── pages/        # Page components
│   │   ├── services/     # API client
│   │   ├── offline/      # PWA & sync logic
│   │   └── utils/        # Helper functions
│   ├── public/           # Static assets
│   ├── package.json      # Node dependencies
│   └── vite.config.js    # Build configuration
│
└── docs/                  # Documentation
    ├── API_SPEC.md       # API specification
    ├── ARCHITECTURE.md   # System architecture
    └── design/           # UI/UX designs
```

### Environment Configuration

Copy .env.example to .env in each service and update with your values.

**ai-service/.env:**
```env
# Provider default (nvidia atau gemini)
AI_PROVIDER=nvidia

# NVIDIA NIM Configuration
NIM_API_KEY=your_nvidia_nim_api_key_here
NIM_API_BASE_URL=https://integrate.api.nvidia.com/v1
NIM_MODEL_NAME=meta/llama-3.1-8b-instruct
NIM_REQUEST_TIMEOUT_SECONDS=60
NIM_MAX_RETRIES=4
NIM_RATE_LIMIT_SLEEP_SECONDS=30

# Gemini Configuration (fallback provider)
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_API_BASE_URL=https://generativelanguage.googleapis.com/v1beta
GEMINI_MODEL_NAME=gemini-flash-latest

# Task-splitting: set provider berbeda per jenis konten
AI_PROVIDER_FLASHCARD=nvidia
AI_PROVIDER_RANGKUMAN=nvidia
AI_PROVIDER_SOAL=nvidia

# Model per jenis konten
NIM_MODEL_NAME_FLASHCARD=meta/llama-3.1-8b-instruct
NIM_MODEL_NAME_RANGKUMAN=meta/llama-3.1-8b-instruct
NIM_MODEL_NAME_SOAL=meta/llama-3.1-8b-instruct

GEMINI_MODEL_NAME_FLASHCARD=gemini-flash-latest
GEMINI_MODEL_NAME_RANGKUMAN=gemini-flash-latest
GEMINI_MODEL_NAME_SOAL=gemini-pro-latest

# Delay antar-request
AI_INTER_REQUEST_DELAY_SECONDS=6

# Flask Server
FLASK_ENV=development
PORT=5001
UPLOAD_FOLDER=./uploads
MAX_CONTENT_LENGTH_MB=20
```

**backend-api/.env:**
```env
# Server
PORT=3000
NODE_ENV=development

# Database (SQLite for dev, PostgreSQL for production)
DATABASE_URL="file:./database/dev.db"

# Authentication
JWT_SECRET=ganti_dengan_secret_yang_kuat_di_produksi
JWT_EXPIRES_IN=7d

# AI Service (HANYA backend-api yang memanggil, jangan di-expose ke frontend)
AI_SERVICE_URL=http://localhost:5001
AI_SERVICE_TIMEOUT_MS=180000

# CORS
FRONTEND_ORIGIN=http://localhost:5173
```

**frontend-web/.env:**
```env
# Backend API URL (satu-satunya service yang boleh diakses frontend)
VITE_BACKEND_API_URL=http://localhost:3000
```

Important Notes:
- Generate JWT_SECRET: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
- AI Service hanya diakses oleh backend-api, JANGAN dari frontend
- Fallback provider otomatis terjadi jika provider utama gagal
- Untuk production, gunakan PostgreSQL untuk DATABASE_URL
- API keys JANGAN di-commit ke git atau share di publik

### Running Services

Open 3 terminal windows and run each service:

```bash
# Terminal 1: AI Service (port 5001)
cd ai-service
python app.py

# Terminal 2: Backend API (port 3000)
cd backend-api
npx prisma migrate dev --name init
npx prisma generate
npm run dev

# Terminal 3: Frontend Web (port 5173)
cd frontend-web
npm run dev -- --host
```

Then open: http://localhost:5173

Service URLs:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- AI Service: http://localhost:5001 (hanya diakses backend, jangan dari frontend)

### API Documentation

Full API documentation is available in [docs/API_SPEC.md](docs/API_SPEC.md)

Common endpoints:
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/kelas` - Get classes
- `POST /api/materi` - Create material
- `GET /api/materi/:id` - Get material details
- `POST /api/generate` - Generate questions via AI
- `GET /api/soal` - Get practice questions
- `POST /api/review` - Submit review/flashcard

### Uninstallation

To clean up all dependencies and cache:

**For Windows:**
```batch
uninstall.bat
```

**For macOS/Linux:**
```bash
chmod +x uninstall.sh
./uninstall.sh
```

This will remove:
- node_modules
- Python cache
- .env files (keeps configuration)
- Build artifacts

### Troubleshooting

**Issue: "Node.js is not installed"**
- Solution: Install Node.js from https://nodejs.org/

**Issue: "Python is not installed"**
- Solution: Install Python from https://www.python.org/

**Issue: npm install fails with permission error**
- Solution: Try `npm install --force` or use `sudo` on macOS/Linux

**Issue: Prisma migration fails**
- Solution: Run `npx prisma migrate dev --name init` in backend-api folder

**Issue: Port already in use**
- Solution: Change PORT in .env file or kill process using the port

**Issue: CORS errors**
- Solution: Check FRONTEND_URL and VITE_API_URL in .env files

### Development

**Running tests:**
```bash
# Backend tests
cd backend-api
npm test

# Frontend tests
cd frontend-web
npm test
```

**Building for production:**
```bash
# Frontend build
cd frontend-web
npm run build

# Docker deployment
docker-compose up --build
```

### Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed system architecture and data flow.

### License

This project is part of Universitas Telkom's educational initiative.

### Support

For issues and questions:
- Email: support@smartrecall.local
- Issues: GitHub Issues
- Docs: docs/

---

## Bahasa Indonesia

### Deskripsi Umum

SmartRecall adalah aplikasi pembelajaran berbasis web dan mobile yang membantu siswa dan guru membuat, mengelola, dan berlatih materi pembelajaran menggunakan AI dan algoritma Spaced Repetition.

**Fitur Utama:**
- Pembangkit soal dan flashcard berbasis AI
- Offline-first PWA (Progressive Web App)
- Auto-sync ketika tersambung internet
- Spaced Repetition (Algoritma SM-2)
- Analytics dan statistik pembelajaran
- Role-based access (Admin, Guru, Siswa)
- Dukungan PDF & PPT

### Stack Teknologi

| Komponen | Teknologi | Fungsi |
|----------|-----------|--------|
| **Frontend** | React + Vite | UI web dengan PWA support |
| **Backend** | Node.js + Express | REST API |
| **AI Service** | Python + Flask | Integrasi LLM & pembangkit konten |
| **Database** | SQLite/PostgreSQL | Penyimpanan data |
| **ORM** | Prisma | Manajemen database |
| **Real-time** | Socket.io | Notifikasi live |

### Prasyarat

Sebelum instalasi, pastikan Anda memiliki:

- Node.js v16 atau lebih tinggi (Download dari https://nodejs.org/)
- Python 3.8 atau lebih tinggi (Download dari https://www.python.org/)
- pip (biasanya sudah termasuk dengan Python)
- npm atau yarn (termasuk dengan Node.js)

### Memulai Cepat

#### Opsi 1: Instalasi Otomatis (Rekomendasi)

**Untuk Windows:**
```batch
install.bat
```

**Untuk macOS/Linux:**
```bash
chmod +x install.sh
./install.sh
```

Script akan:
- Mengecek semua prasyarat
- Menginstal semua dependencies
- Setup file .env otomatis
- Menampilkan langkah selanjutnya

#### Opsi 2: Instalasi Manual

**1. AI Service (Flask)**
```bash
cd ai-service
pip install -r requirements.txt
cp .env.example .env
# Edit .env dengan konfigurasi Anda
python app.py
```

**2. Backend API (Node.js)**
```bash
cd backend-api
npm install
cp .env.example .env
npx prisma migrate dev
npm start
```

**3. Frontend Web (React)**
```bash
cd frontend-web
npm install
cp .env.example .env
npm run dev
```

### Struktur Project

```
smartrecall/
├── ai-service/              # Service Python Flask
│   ├── app.py              # Aplikasi Flask utama
│   ├── routes/             # Route API
│   ├── services/           # Logika bisnis
│   ├── utils/              # Fungsi helper
│   ├── templates/          # Template PPT
│   └── requirements.txt    # Dependencies Python
│
├── backend-api/            # API Node.js Express
│   ├── src/
│   │   ├── controllers/    # Handler request
│   │   ├── routes/        # Endpoint API
│   │   ├── services/      # Logika bisnis
│   │   ├── middleware/    # Custom middleware
│   │   └── socket.js      # Event real-time
│   ├── prisma/            # Schema database
│   ├── package.json       # Dependencies Node
│   └── jest.config.js     # Konfigurasi test
│
├── frontend-web/          # UI React + Vite
│   ├── src/
│   │   ├── components/    # Komponen React
│   │   ├── pages/        # Halaman komponen
│   │   ├── services/     # Klien API
│   │   ├── offline/      # PWA & logika sync
│   │   └── utils/        # Fungsi helper
│   ├── public/           # Asset statis
│   ├── package.json      # Dependencies Node
│   └── vite.config.js    # Konfigurasi build
│
└── docs/                  # Dokumentasi
    ├── API_SPEC.md       # Spesifikasi API
    ├── ARCHITECTURE.md   # Arsitektur sistem
    └── design/           # Desain UI/UX
```

### Konfigurasi Environment

Copy .env.example ke .env di setiap service dan update nilainya.

**ai-service/.env:**
```env
# Provider default (nvidia atau gemini)
AI_PROVIDER=nvidia

# NVIDIA NIM Configuration
NIM_API_KEY=your_nvidia_nim_api_key_here
NIM_API_BASE_URL=https://integrate.api.nvidia.com/v1
NIM_MODEL_NAME=meta/llama-3.1-8b-instruct
NIM_REQUEST_TIMEOUT_SECONDS=60
NIM_MAX_RETRIES=4
NIM_RATE_LIMIT_SLEEP_SECONDS=30

# Gemini Configuration (fallback provider)
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_API_BASE_URL=https://generativelanguage.googleapis.com/v1beta
GEMINI_MODEL_NAME=gemini-flash-latest

# Task-splitting: set provider berbeda per jenis konten
AI_PROVIDER_FLASHCARD=nvidia
AI_PROVIDER_RANGKUMAN=nvidia
AI_PROVIDER_SOAL=nvidia

# Model per jenis konten
NIM_MODEL_NAME_FLASHCARD=meta/llama-3.1-8b-instruct
NIM_MODEL_NAME_RANGKUMAN=meta/llama-3.1-8b-instruct
NIM_MODEL_NAME_SOAL=meta/llama-3.1-8b-instruct

GEMINI_MODEL_NAME_FLASHCARD=gemini-flash-latest
GEMINI_MODEL_NAME_RANGKUMAN=gemini-flash-latest
GEMINI_MODEL_NAME_SOAL=gemini-pro-latest

# Delay antar-request
AI_INTER_REQUEST_DELAY_SECONDS=6

# Flask Server
FLASK_ENV=development
PORT=5001
UPLOAD_FOLDER=./uploads
MAX_CONTENT_LENGTH_MB=20
```

**backend-api/.env:**
```env
# Server
PORT=3000
NODE_ENV=development

# Database (SQLite for dev, PostgreSQL for production)
DATABASE_URL="file:./database/dev.db"

# Authentication
JWT_SECRET=ganti_dengan_secret_yang_kuat_di_produksi
JWT_EXPIRES_IN=7d

# AI Service (HANYA backend-api yang memanggil, jangan di-expose ke frontend)
AI_SERVICE_URL=http://localhost:5001
AI_SERVICE_TIMEOUT_MS=180000

# CORS
FRONTEND_ORIGIN=http://localhost:5173
```

**frontend-web/.env:**
```env
# Backend API URL (satu-satunya service yang boleh diakses frontend)
VITE_BACKEND_API_URL=http://localhost:3000
```

Catatan Penting:
- Generate JWT_SECRET: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
- AI Service hanya diakses oleh backend-api, JANGAN dari frontend
- Fallback provider otomatis terjadi jika provider utama gagal
- Untuk production, gunakan PostgreSQL untuk DATABASE_URL
- API keys JANGAN di-commit ke git atau share di publik

### Menjalankan Service

Buka 3 terminal dan jalankan setiap service:

```bash
# Terminal 1: AI Service (port 5001)
cd ai-service
python app.py

# Terminal 2: Backend API (port 3000)
cd backend-api
npm start

# Terminal 3: Frontend Web (port 5173)
cd frontend-web
npm run dev
```

Lalu buka: http://localhost:5173

URL Service:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- AI Service: http://localhost:5001 (hanya diakses backend, jangan dari frontend)

### Dokumentasi API

Dokumentasi API lengkap tersedia di [docs/API_SPEC.md](docs/API_SPEC.md)

Endpoint umum:
- `POST /api/auth/login` - Login pengguna
- `POST /api/auth/register` - Registrasi pengguna
- `GET /api/kelas` - Dapatkan daftar kelas
- `POST /api/materi` - Buat materi baru
- `GET /api/materi/:id` - Dapatkan detail materi
- `POST /api/generate` - Pembangkit soal via AI
- `GET /api/soal` - Dapatkan soal latihan
- `POST /api/review` - Submit review/flashcard

### Uninstal

Untuk membersihkan semua dependencies dan cache:

**Untuk Windows:**
```batch
uninstall.bat
```

**Untuk macOS/Linux:**
```bash
chmod +x uninstall.sh
./uninstall.sh
```

Akan menghapus:
- node_modules
- Python cache
- File .env (konfigurasi tetap aman)
- Build artifacts

### Troubleshooting

**Masalah: "Node.js is not installed"**
- Solusi: Instal Node.js dari https://nodejs.org/

**Masalah: "Python is not installed"**
- Solusi: Instal Python dari https://www.python.org/

**Masalah: npm install gagal dengan error permission**
- Solusi: Coba `npm install --force` atau gunakan `sudo` di macOS/Linux

**Masalah: Prisma migration gagal**
- Solusi: Jalankan `npx prisma migrate dev --name init` di folder backend-api

**Masalah: Port sudah digunakan**
- Solusi: Ubah PORT di file .env atau kill proses yang menggunakan port

**Masalah: CORS errors**
- Solusi: Cek FRONTEND_URL dan VITE_API_URL di file .env

### Development

**Menjalankan test:**
```bash
# Backend tests
cd backend-api
npm test

# Frontend tests
cd frontend-web
npm test
```

**Build untuk production:**
```bash
# Frontend build
cd frontend-web
npm run build

# Docker deployment
docker-compose up --build
```

### Kontribusi

1. Fork repository
2. Buat branch feature (`git checkout -b feature/FiturBaru`)
3. Commit perubahan Anda (`git commit -m 'Tambah FiturBaru'`)
4. Push ke branch (`git push origin feature/FiturBaru`)
5. Buka Pull Request

### Arsitektur

Lihat [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) untuk detail arsitektur sistem dan data flow.

### Lisensi

Project ini adalah bagian dari inisiatif pendidikan Universitas Telkom.

### Support

Untuk pertanyaan dan isu:
- Email: support@smartrecall.local
- Issues: GitHub Issues
- Docs: docs/

---

## Environment Files

Template .env.example disediakan untuk setiap service:

**ai-service.env.example**
- Konfigurasi NVIDIA NIM API (model LLAMA)
- Konfigurasi Gemini API (fallback provider)
- Task-splitting untuk flashcard, rangkuman, soal
- Delay antar-request dan upload settings

**backend-api.env.example**
- Konfigurasi server dan database
- JWT secret dan expiry
- URL ke AI Service (untuk backend hanya)
- CORS settings

**frontend-web.env.example**
- URL Backend API (hanya service yang diakses frontend)
- JANGAN pernah menambahkan URL AI Service di sini

Important:
- Setiap .env.example file sudah siap di-copy menjadi .env
- Ganti placeholder values (your_*_here) dengan nilai asli Anda
- JANGAN commit .env ke git - hanya .env.example yang di-commit
- Jika API key pernah ter-expose, rotate/revoke melalui dashboard provider

---

## Installation Scripts

This project includes automated installation scripts:

| Script | OS | Purpose |
|--------|----|----|
| install.bat | Windows | Auto-install all dependencies |
| install.sh | macOS/Linux | Auto-install all dependencies |
| uninstall.bat | Windows | Clean all dependencies & cache |
| uninstall.sh | macOS/Linux | Clean all dependencies & cache |

### Features

**Automatic:**
- Checks for Node.js, npm, Python, and pip
- Creates .env files from .env.example
- Installs all dependencies in correct order
- Shows helpful error messages
- Displays next steps after installation

**Uninstall scripts clean:**
- node_modules folders
- Python cache (__pycache__, .pytest_cache)
- Build artifacts (dist, .vite)
- package-lock.json files
- .prisma cache

---

## Next Steps

1. **Review Configuration:**
   - Edit .env files in each service
   - Configure API keys and URLs

2. **Setup Database:**
   - Run Prisma migrations: cd backend-api && npx prisma migrate dev
   - Seed initial data if needed

3. **Start Development:**
   - Open 3 terminals for each service
   - Run services in order: AI Service -> Backend -> Frontend
   - Access http://localhost:5173

4. **Read Documentation:**
   - API Specification (docs/API_SPEC.md)
   - System Architecture (docs/ARCHITECTURE.md)
   - UI/UX Designs in (docs/design/)

---

**Happy Learning**

For more information, visit the [docs](docs/) folder.
