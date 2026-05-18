const express = require('express');
const router = express.Router();
const { 
  getRestaurants, 
  getRestaurantById, 
  createRestaurant 
} = require('../controllers/restaurantController');
const { protect } = require('../middlewares/authMiddleware');

// เส้นทางดึงข้อมูลร้านค้าทั้งหมด (สาธารณะ)
router.get('/', getRestaurants);

// เส้นทางดึงข้อมูลรายละเอียดร้านค้า & เมนูอาหารรายรายการ (สาธารณะ)
router.get('/:id', getRestaurantById);

// เส้นทางสร้างร้านค้าใหม่ (ได้รับการคุ้มครองสิทธิ์ความปลอดภัย)
router.post('/', protect, createRestaurant);

module.exports = router;
