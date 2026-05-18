const { prisma } = require('../prisma');

/**
 * @desc    Get all restaurants
 * @route   GET /api/restaurants
 * @access  Public
 */
const getRestaurants = async (req, res) => {
  try {
    const restaurants = await prisma.restaurant.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    });

    return res.status(200).json({
      success: true,
      count: restaurants.length,
      restaurants
    });
  } catch (error) {
    console.error('❌ Get Restaurants Error:', error);
    return res.status(500).json({
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูลร้านอาหาร',
      error: error.message
    });
  }
};

/**
 * @desc    Get single restaurant details & menu items
 * @route   GET /api/restaurants/:id
 * @access  Public
 */
const getRestaurantById = async (req, res) => {
  const { id } = req.params;

  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id },
      include: {
        menuItems: {
          where: { isAvailable: true }
        }
      }
    });

    if (!restaurant) {
      return res.status(404).json({
        message: 'ไม่พบร้านอาหารที่ระบุ'
      });
    }

    return res.status(200).json({
      success: true,
      restaurant
    });
  } catch (error) {
    console.error('❌ Get Restaurant By ID Error:', error);
    return res.status(500).json({
      message: 'เกิดข้อผิดพลาดในการดึงรายละเอียดร้านอาหาร',
      error: error.message
    });
  }
};

/**
 * @desc    Create new restaurant (Vendor/Admin Only)
 * @route   POST /api/restaurants
 * @access  Private
 */
const createRestaurant = async (req, res) => {
  const { name, address, latitude, longitude, imageUrl } = req.body;

  try {
    // 1. ตรวจสอบสิทธิ์ความปลอดภัย (Vendor หรือ Admin เท่านั้น)
    if (req.user.role !== 'vendor' && req.user.role !== 'admin') {
      return res.status(403).json({
        message: 'ไม่มีสิทธิ์ในการสร้างร้านค้า (สำหรับผู้ค้าและผู้ดูแลระบบเท่านั้น)'
      });
    }

    // 2. ตรวจสอบข้อมูลขั้นต่ำ
    if (!name || !address) {
      return res.status(400).json({
        message: 'กรุณากรอกชื่อและที่ตั้งของร้านค้า'
      });
    }

    // 3. สร้างร้านค้า
    const newRestaurant = await prisma.restaurant.create({
      data: {
        ownerId: req.user.id,
        name,
        address,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        imageUrl: imageUrl || null,
        isOpen: true,
        rating: 5.0 // เริ่มต้นที่ 5 ดาวสำหรับร้านค้าใหม่
      }
    });

    return res.status(201).json({
      message: 'สร้างร้านอาหารสำเร็จ',
      restaurant: newRestaurant
    });
  } catch (error) {
    console.error('❌ Create Restaurant Error:', error);
    return res.status(500).json({
      message: 'เกิดข้อผิดพลาดในการสร้างร้านอาหาร',
      error: error.message
    });
  }
};

module.exports = {
  getRestaurants,
  getRestaurantById,
  createRestaurant
};
