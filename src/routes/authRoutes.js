const express = require('express');
const router = express.Router();
const { register, login, updateRiderStatus } = require('../controllers/authController');
const { protect } = require('../middlewares/authMiddleware');

// POST /api/auth/register
router.post('/register', register);

// POST /api/auth/login
router.post('/login', login);

// PATCH /api/auth/rider/status
router.patch('/rider/status', protect, updateRiderStatus);

module.exports = router;
