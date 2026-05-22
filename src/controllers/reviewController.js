const { prisma } = require('../prisma');

/**
 * @desc    Create review for an order (both Restaurant and Rider)
 * @route   POST /api/reviews/orders/:orderId
 * @access  Private (Customer only)
 */
const createReview = async (req, res) => {
  const { orderId } = req.params;
  const { restaurantRating, restaurantComment, riderRating, riderComment } = req.body;

  try {
    // 1. Validate inputs
    const ratingInt = parseInt(restaurantRating);
    if (isNaN(ratingInt) || ratingInt < 1 || ratingInt > 5) {
      return res.status(400).json({
        message: 'กรุณากรอกคะแนนร้านอาหารระหว่าง 1 ถึง 5 ดาว'
      });
    }

    if (riderRating !== undefined && riderRating !== null) {
      const riderRatingInt = parseInt(riderRating);
      if (isNaN(riderRatingInt) || riderRatingInt < 1 || riderRatingInt > 5) {
        return res.status(400).json({
          message: 'กรุณากรอกคะแนนไรเดอร์ระหว่าง 1 ถึง 5 ดาว'
        });
      }
    }

    // 2. Find the order and verify customer identity and status
    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      return res.status(404).json({
        message: 'ไม่พบคำสั่งซื้อที่ระบุ'
      });
    }

    if (order.customerId !== req.user.id) {
      return res.status(403).json({
        message: 'ไม่มีสิทธิ์รีวิวคำสั่งซื้อของผู้อื่น'
      });
    }

    if (order.status !== 'delivered') {
      return res.status(400).json({
        message: 'สามารถรีวิวคำสั่งซื้อที่ส่งสำเร็จแล้วเท่านั้น'
      });
    }

    // 3. Prevent duplicate reviews
    const existingReview = await prisma.review.findUnique({
      where: { orderId }
    });

    if (existingReview) {
      return res.status(400).json({
        message: 'คุณได้ทำการรีวิวคำสั่งซื้อนี้ไปแล้ว'
      });
    }

    // 4. Run database transaction to submit review and recalculate ratings
    const result = await prisma.$transaction(async (tx) => {
      // A. Create the review record
      const newReview = await tx.review.create({
        data: {
          orderId,
          customerId: req.user.id,
          restaurantId: order.restaurantId,
          restaurantRating: ratingInt,
          restaurantComment: restaurantComment || null,
          riderId: order.riderId,
          riderRating: riderRating ? parseInt(riderRating) : null,
          riderComment: riderComment || null,
        }
      });

      // B. Recalculate average restaurant rating
      const restaurantAgg = await tx.review.aggregate({
        where: { restaurantId: order.restaurantId },
        _avg: {
          restaurantRating: true
        }
      });

      const newAvgRestaurantRating = restaurantAgg._avg.restaurantRating || 0.0;

      await tx.restaurant.update({
        where: { id: order.restaurantId },
        data: {
          rating: parseFloat(newAvgRestaurantRating.toFixed(2))
        }
      });

      // C. Recalculate average rider rating if applicable
      if (order.riderId && riderRating !== undefined && riderRating !== null) {
        const riderAgg = await tx.review.aggregate({
          where: { riderId: order.riderId },
          _avg: {
            riderRating: true
          }
        });

        const newAvgRiderRating = riderAgg._avg.riderRating || 5.0;

        await tx.riderProfile.update({
          where: { id: order.riderId }, // RiderProfile id is the User's id (riderId)
          data: {
            rating: parseFloat(newAvgRiderRating.toFixed(2))
          }
        });
      }

      return newReview;
    });

    return res.status(201).json({
      success: true,
      message: 'บันทึกการรีวิวสำเร็จ',
      review: result
    });

  } catch (error) {
    console.error('❌ Create Review Error:', error);
    return res.status(500).json({
      message: 'เกิดข้อผิดพลาดในการบันทึกการรีวิว',
      error: error.message
    });
  }
};

/**
 * @desc    Get all reviews for a restaurant
 * @route   GET /api/reviews/restaurants/:restaurantId
 * @access  Public
 */
const getRestaurantReviews = async (req, res) => {
  const { restaurantId } = req.params;

  try {
    const reviews = await prisma.review.findMany({
      where: { restaurantId },
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return res.status(200).json({
      success: true,
      count: reviews.length,
      reviews
    });
  } catch (error) {
    console.error('❌ Get Restaurant Reviews Error:', error);
    return res.status(500).json({
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูลรีวิวร้านอาหาร',
      error: error.message
    });
  }
};

/**
 * @desc    Get all reviews for a rider
 * @route   GET /api/reviews/riders/:riderId
 * @access  Public
 */
const getRiderReviews = async (req, res) => {
  const { riderId } = req.params;

  try {
    const reviews = await prisma.review.findMany({
      where: { riderId },
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return res.status(200).json({
      success: true,
      count: reviews.length,
      reviews
    });
  } catch (error) {
    console.error('❌ Get Rider Reviews Error:', error);
    return res.status(500).json({
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูลรีวิวไรเดอร์',
      error: error.message
    });
  }
};

module.exports = {
  createReview,
  getRestaurantReviews,
  getRiderReviews
};
