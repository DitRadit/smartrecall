const prisma = require('../config/db');

async function logActivity(userId, action, description) {
  try {
    await prisma.activityLog.create({
      data: {
        userId,
        action,
        description,
      },
    });
  } catch (err) {
    console.error('Failed to log activity:', err);
  }
}

module.exports = { logActivity };
