/**
 * auth.js - Middleware autentikasi & otorisasi sederhana berbasis JWT + role.
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_only_secret_do_not_use_in_production';

/**
 * Middleware: memastikan request punya token JWT valid.
 * Menempelkan payload user (id, role) ke req.user.
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'unauthorized', message: 'Token tidak ditemukan' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload; // { id, role, username }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'unauthorized', message: 'Token tidak valid atau kadaluarsa' });
  }
}

/**
 * Middleware factory: membatasi akses hanya untuk role tertentu.
 * Contoh: requireRole('guru')
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'unauthorized', message: 'Belum login' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'forbidden',
        message: `Akses ditolak. Endpoint ini hanya untuk role: ${allowedRoles.join(', ')}`,
      });
    }
    next();
  };
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, username: user.username, nama: user.nama },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

module.exports = { requireAuth, requireRole, signToken, JWT_SECRET };
