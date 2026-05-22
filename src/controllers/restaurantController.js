const { prisma } = require('../prisma');

// Helper function to calculate Haversine distance in kilometers
const haversineDistance = (lat1, lon1, lat2, lon2) => {
  if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) return null;
  const toRad = (value) => (value * Math.PI) / 180;
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
};

/**
 * @desc    Get all restaurants (with filters, search & distance sorting)
 * @route   GET /api/restaurants
 * @access  Public
 */
const getRestaurants = async (req, res) => {
  try {
    const { search, minRating, lat, lng, page = 1, limit = 10 } = req.query;

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const skip = (pageNum - 1) * limitNum;

    // Construct Prisma where filter
    const where = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (minRating) {
      where.rating = {
        gte: parseFloat(minRating)
      };
    }

    let restaurants = await prisma.restaurant.findMany({
      where,
      orderBy: {
        createdAt: 'desc'
      }
    });

    let userLat = lat ? parseFloat(lat) : null;
    let userLng = lng ? parseFloat(lng) : null;
    const hasCoords = userLat !== null && !isNaN(userLat) && userLng !== null && !isNaN(userLng);

    if (hasCoords) {
      // Calculate distance for all matching restaurants and sort by distance
      restaurants = restaurants.map(r => {
        const dist = haversineDistance(userLat, userLng, r.latitude, r.longitude);
        return {
          ...r,
          distance: dist !== null ? parseFloat(dist.toFixed(2)) : null
        };
      });

      // Sort by distance (putting null distance at the bottom)
      restaurants.sort((a, b) => {
        if (a.distance === null) return 1;
        if (b.distance === null) return -1;
        return a.distance - b.distance;
      });
    }

    // Total count before pagination
    const totalCount = restaurants.length;

    // Apply pagination in-memory
    const paginatedRestaurants = restaurants.slice(skip, skip + limitNum);

    return res.status(200).json({
      success: true,
      count: paginatedRestaurants.length,
      pagination: {
        total: totalCount,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalCount / limitNum)
      },
      restaurants: paginatedRestaurants
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
