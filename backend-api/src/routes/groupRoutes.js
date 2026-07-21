const express = require('express');
const router = express.Router();
const groupController = require('../controllers/groupController');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', groupController.getGroupContents);
router.post('/', requireRole('guru'), groupController.createGroup);
router.put('/:id', requireRole('guru'), groupController.updateGroup);
router.delete('/:id', requireRole('guru'), groupController.deleteGroup);

module.exports = router;
