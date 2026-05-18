const express = require('express');
const router = express.Router();
const {
  createOrder,
  getOrders,
  getOrderById,
  acceptOrderJob,
  updateOrderStatus
} = require('../controllers/orderController');
const { protect } = require('../middlewares/authMiddleware');

// ตั้งแต่ขั้นตอนนี้ ทุก Endpoints ของคำสั่งซื้อจำเป็นต้องใช้การล็อกอินสิทธิ์การใช้งาน (protect)
router.use(protect);

// เส้นทางสร้างคำสั่งซื้อใหม่ & ค้นหารายการประวัติ (ตามผู้ใช้งาน)
router.post('/', createOrder);
router.get('/', getOrders);

// ดึงรายละเอียดเชิงลึกของแต่ละออเดอร์
router.get('/:id', getOrderById);

// ไรเดอร์ยืนยันกดรับงานจัดส่งอาหาร
router.post('/:id/accept', acceptOrderJob);

// อัปเดตขั้นตอนและเฟสการเตรียม/จัดส่งของอาหาร (Preparing -> Picked Up -> Delivered)
router.patch('/:id/status', updateOrderStatus);

module.exports = router;
