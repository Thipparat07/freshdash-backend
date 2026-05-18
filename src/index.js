const express = require('express');
const http = require('http');
const cors = require('cors');
require('dotenv').config();
const { prisma } = require('./prisma');
const authRoutes = require('./routes/authRoutes');
const restaurantRoutes = require('./routes/restaurantRoutes');
const orderRoutes = require('./routes/orderRoutes');
const { protect } = require('./middlewares/authMiddleware');
const socketIO = require('./socket');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/orders', orderRoutes);

// Basic Health Check Route
app.get('/', (req, res) => {
  res.json({ message: 'FreshDash API is running!' });
});

// Protected Profile Demo Route
app.get('/api/profile', protect, async (req, res) => {
  try {
    const fullUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        riderProfile: true,
        riderVehicles: { where: { isActive: true } }
      }
    });
    
    // Respond excluding password for security
    if (fullUser) {
      delete fullUser.password;
    }

    res.json({
      message: 'เข้าถึงข้อมูลโปรไฟล์ที่ได้รับการปกป้องสำเร็จ!',
      user: fullUser
    });
  } catch (error) {
    console.error('❌ Get Profile Error:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการโหลดข้อมูลโปรไฟล์' });
  }
});

// Global Error Handler Middleware
app.use((err, req, res, next) => {
  console.error('❌ Internal Server Error:', err);
  res.status(500).json({
    message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์',
    error: err.message
  });
});

// Initialize WebSockets
socketIO.init(server);

// Start Server
server.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});

module.exports = { prisma, app, server };
