/**
 * app.js - Entry point backend-api (Node.js + Express).
 *
 * Tanggung jawab (ARCHITECTURE.md bagian 2 & 6):
 * - Satu-satunya service yang diakses langsung oleh frontend-web.
 * - Orkestrasi auth, CRUD materi/flashcard/soal, algoritma SM-2.
 * - Satu-satunya yang boleh memanggil ai-service (frontend TIDAK BOLEH).
 * - Tetap berfungsi penuh tanpa internet (kecuali saat trigger generate AI).
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const materiRoutes = require('./routes/materiRoutes');
const flashcardRoutes = require('./routes/flashcardRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const soalRoutes = require('./routes/soalRoutes');
const rangkumanRoutes = require('./routes/rangkumanRoutes');
const aiServiceClient = require('./services/aiServiceClient');

const app = express();

const configuredOrigins = (process.env.FRONTEND_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || configuredOrigins.includes(origin)) {
      return callback(null, true);
    }

    try {
      const { protocol, hostname, port } = new URL(origin);
      const isLocalDevOrigin = protocol === 'http:' && port === '5173' && (
        hostname === 'localhost'
        || hostname === '127.0.0.1'
        || hostname.startsWith('192.168.')
        || hostname.startsWith('10.')
        || /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
      );
      return callback(null, isLocalDevOrigin);
    } catch (error) {
      return callback(error);
    }
  },
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Health check ---
app.get('/health', async (req, res) => {
  const aiServiceHealth = await aiServiceClient.checkHealth();
  res.json({
    status: 'ok',
    service: 'backend-api',
    ai_service: aiServiceHealth, // informasional saja; backend-api tetap "ok" walau ai-service down
  });
});

// --- Routes sesuai kontrak API ARCHITECTURE.md bagian 3.3 ---
app.use('/auth', authRoutes);
app.use('/materi', materiRoutes);
app.use('/flashcard', flashcardRoutes);
app.use('/review', reviewRoutes);
app.use('/soal', soalRoutes);
app.use('/rangkuman', rangkumanRoutes);

// --- 404 handler ---
app.use((req, res) => {
  res.status(404).json({ error: 'not_found', message: 'Endpoint tidak ditemukan' });
});

// --- Global error handler ---
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'internal_error', message: err.message || 'Terjadi kesalahan pada server' });
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`backend-api berjalan di http://localhost:${PORT}`);
  });
}

module.exports = app;
