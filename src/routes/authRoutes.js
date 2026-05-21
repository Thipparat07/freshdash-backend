const express = require('express');
const router = express.Router();
const { register, login, updateRiderStatus } = require('../controllers/authController');
const { protect } = require('../middlewares/authMiddleware');
const { prisma } = require('../prisma');

router.post('/register', register);
router.post('/login', login);
router.patch('/rider/status', protect, updateRiderStatus);

router.post('/push-token', protect, async (req, res) => {
  const { pushToken } = req.body;
  if (!pushToken) return res.status(400).json({ message: 'pushToken is required' });
  await prisma.user.update({ where: { id: req.user.id }, data: { pushToken } });
  res.json({ success: true });
});

module.exports = router;
