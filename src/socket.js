const { Server } = require('socket.io');
const { prisma } = require('./prisma');

let io = null;

/**
 * Initialize Socket.io server
 * @param {object} server - HTTP Server instance
 */
const init = (server) => {
  io = new Server(server, {
    cors: {
      origin: '*', // เปิดกว้างสำหรับการทดสอบบนคอมพิวเตอร์โลคอล
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    console.log(`⚡ Client connected to WebSocket: ${socket.id}`);

    // 1. เหตุการณ์เข้าร่วมห้องเฉพาะออเดอร์ (Join Order Room)
    socket.on('join-room', (roomId) => {
      socket.join(roomId);
      console.log(`🚪 Socket [${socket.id}] joined room: ${roomId}`);
    });

    // 2. เหตุการณ์ไรเดอร์อัปเดตแชร์พิกัด GPS สด (Rider Location Update)
    socket.on('driver:location-update', async (data) => {
      // data = { orderId, riderId, latitude, longitude, status }
      const { orderId, riderId, latitude, longitude, status } = data;

      if (!orderId || !latitude || !longitude) return;

      console.log(`📍 Location update from Rider [${riderId || 'Unknown'}]: Lat ${latitude}, Lng ${longitude} for Order ${orderId}`);

      // A. ส่งกระจาย (Broadcast) พิกัดไปยังเครื่องลูกค้าและผู้มีส่วนได้ส่วนเสียในห้องออเดอร์ order_[orderId]
      io.to(`order_${orderId}`).emit('driver:location-updated', {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        status
      });

      // B. [สุดพรีเมียม] บันทึกพิกัดตำแหน่งจริงล่าสุดของไรเดอร์ลง PostgreSQL เผื่อลูกค้าเปิดรีเฟรชหน้าจอใหม่
      if (riderId) {
        try {
          await prisma.riderProfile.update({
            where: { id: riderId },
            data: {
              currentLat: parseFloat(latitude),
              currentLng: parseFloat(longitude),
              lastOnlineAt: new Date()
            }
          });
        } catch (dbErr) {
          console.error('⚠️ Failed to auto-persist rider location to database:', dbErr.message);
        }
      }
    });

    // 3. เหตุการณ์อัปเดตสเตตัสกระบวนการทำอาหาร/จัดส่ง (Order Status Update Signal)
    socket.on('order:status-update', (data) => {
      // data = { orderId, status }
      const { orderId, status } = data;

      if (!orderId || !status) return;

      console.log(`🔔 Status updated to [${status}] for Order ${orderId}`);

      // ส่งกระจายสถานะใหม่ไปยังทุกคนในห้องเพื่อสลับขั้นตอนสดบนหน้าจอมือถือทันที
      io.to(`order_${orderId}`).emit('order:status-updated', { status });
    });

    // 4. เหตุการณ์ตัดการเชื่อมต่อ
    socket.on('disconnect', () => {
      console.log(`❌ Client disconnected from WebSocket: ${socket.id}`);
    });
  });

  return io;
};

/**
 * Get active Socket.io instance
 */
const getIO = () => {
  if (!io) {
    throw new Error('Socket.io has not been initialized yet!');
  }
  return io;
};

module.exports = {
  init,
  getIO
};
