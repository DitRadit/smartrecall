const express = require('express');
const { getAdminDashboardStats } = require('../controllers/adminController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);
router.use(requireRole('admin'));

router.get('/dashboard', getAdminDashboardStats);

module.exports = router;
