const express = require('express');
const router = express.Router();
const groupController = require('../controllers/groupController');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth, requireRole('guru'));

router.post('/', groupController.createGroup);
router.get('/', groupController.getGroupContents);
router.put('/:id', groupController.updateGroup);
router.delete('/:id', groupController.deleteGroup);

module.exports = router;
