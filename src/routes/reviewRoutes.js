const express = require('express');
const router = express.Router();
const {
  createReview,
  getRestaurantReviews,
  getRiderReviews
} = require('../controllers/reviewController');
const { protect } = require('../middlewares/authMiddleware');

// เส้นทางส่งผลประเมินรีวิวออเดอร์ (ต้องลงชื่อเข้าใช้)
router.post('/orders/:orderId', protect, createReview);

// เส้นทางดึงรีวิวของร้านค้า (สาธารณะ)
router.get('/restaurants/:restaurantId', getRestaurantReviews);

// เส้นทางดึงรีวิวของไรเดอร์ (สาธารณะ)
router.get('/riders/:riderId', getRiderReviews);

module.exports = router;
