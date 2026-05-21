const { prisma } = require('../prisma');
const { calculateDistance } = require('../utils/geo');
const { sendPush } = require('../utils/pushNotification');

/**
 * @desc    Create a new order (Customer Only)
 * @route   POST /api/orders
 * @access  Private
 */
const createOrder = async (req, res) => {
  const { restaurantId, items, deliveryAddress, deliveryLat, deliveryLng, deliveryFee } = req.body;

  try {
    // 1. ความปลอดภัย: ลูกค้าเท่านั้นที่สามารถสั่งซื้อได้
    if (req.user.role !== 'customer' && req.user.role !== 'admin') {
      return res.status(403).json({
        message: 'มีเพียงบัญชีลูกค้าเท่านั้นที่สามารถสร้างรายการสั่งซื้อได้'
      });
    }

    if (!restaurantId || !items || !Array.isArray(items) || items.length === 0 || !deliveryAddress) {
      return res.status(400).json({
        message: 'กรุณาระบุร้านอาหาร รายการอาหาร และที่อยู่จัดส่งให้ถูกต้อง'
      });
    }

    // 2. ป้องกันกลโกงราคา: ดึงราคาสินค้าจริงจากฐานข้อมูลหลังบ้านโดยตรง (ไม่เชื่อราคาที่ส่งมาจากหน้าแอป)
    const menuItemIds = items.map(item => item.menuItemId);
    const dbMenuItems = await prisma.menuItem.findMany({
      where: {
        id: { in: menuItemIds },
        restaurantId
      }
    });

    if (dbMenuItems.length !== items.length) {
      return res.status(400).json({
        message: 'บางรายการอาหารไม่มีในเมนูของร้านค้านี้ หรือถูกลบไปแล้ว'
      });
    }

    // 3. คำนวณราคาค่ารวมอาหารทั้งหมด
    let foodTotal = 0;
    const orderItemsData = items.map(item => {
      const dbItem = dbMenuItems.find(d => d.id === item.menuItemId);
      const price = parseFloat(dbItem.price);
      foodTotal += price * item.quantity;

      return {
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        priceAtOrder: price
      };
    });

    // กำหนดค่าธรรมเนียมจัดส่งเริ่มต้น 20 บาท หรือรับตามกิโลเมตรที่ประเมิน
    const shippingFee = deliveryFee ? parseFloat(deliveryFee) : 20.00;
    const finalTotal = foodTotal + shippingFee;

    // 4. บันทึกข้อมูลแบบม้วนทำ Transaction (การันตีความสม่ำเสมอของข้อมูล 100%)
    const createdOrder = await prisma.$transaction(async (tx) => {
      // A. สร้างใบสั่งซื้อหลัก
      const newOrder = await tx.order.create({
        data: {
          customerId: req.user.id,
          restaurantId,
          status: 'searching_rider', // เริ่มต้นในสถานะค้นหาไรเดอร์เพื่อจำลองระบบรับงาน
          deliveryAddress,
          deliveryFee: shippingFee,
          totalAmount: finalTotal,
          deliveryLat: deliveryLat ? parseFloat(deliveryLat) : null,
          deliveryLng: deliveryLng ? parseFloat(deliveryLng) : null,
        }
      });

      // B. สร้างรายการอาหารที่สั่งในออเดอร์นั้น
      const itemsToCreate = orderItemsData.map(item => ({
        orderId: newOrder.id,
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        priceAtOrder: item.priceAtOrder
      }));

      await tx.orderItem.createMany({
        data: itemsToCreate
      });

      return newOrder;
    });

    // 5. คืนออเดอร์ที่ถูกบันทึกสำเร็จ
    return res.status(201).json({
      success: true,
      message: 'สร้างใบสั่งซื้อสำเร็จและกำลังเริ่มค้นหาคนจัดส่งอาหาร!',
      order: createdOrder
    });

  } catch (error) {
    console.error('❌ Create Order Error:', error);
    return res.status(500).json({
      message: 'เกิดข้อผิดพลาดในการสร้างใบสั่งซื้ออาหาร',
      error: error.message
    });
  }
};

/**
 * @desc    Get order history / queue based on user role
 * @route   GET /api/orders
 * @access  Private
 */
const getOrders = async (req, res) => {
  const { role, id: userId } = req.user;
  const { status } = req.query; // กรองตามสถานะออเดอร์ได้ (เช่น searching_rider)

  try {
    let whereClause = {};

    // 1. กรองข้อมูลตามบทบาทผู้เรียกใช้ (Role-based separation)
    if (role === 'customer') {
      whereClause.customerId = userId;
    } else if (role === 'rider') {
      if (status === 'searching_rider') {
        // หากไรเดอร์ขอดูออเดอร์ที่กำลังหาคนส่ง (เปิดบอร์ดรับงาน)
        whereClause.status = 'searching_rider';
      } else {
        // ประวัติรับงานจัดส่งส่วนตัวของไรเดอร์คนนั้น
        whereClause.riderId = userId;
      }
    } else if (role === 'vendor') {
      // ออเดอร์ที่สั่งกับร้านค้าของผู้ใช้ท่านนี้
      whereClause.restaurant = {
        ownerId: userId
      };
    }

    // หากมีการกำหนดฟิลเตอร์สเตตัสเพิ่มเติม
    if (status && role !== 'rider') {
      whereClause.status = status;
    }

    let orders = await prisma.order.findMany({
      where: whereClause,
      include: {
        restaurant: {
          select: { name: true, address: true, imageUrl: true, latitude: true, longitude: true }
        },
        customer: {
          select: { fullName: true, phoneNumber: true }
        },
        rider: {
          select: { fullName: true, phoneNumber: true }
        },
        orderItems: {
          include: {
            menuItem: {
              select: { name: true, imageUrl: true }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // --- FILTER BATCHED ROUTE LIMITS FOR RIDER ---
    if (role === 'rider' && status === 'searching_rider') {
      const activeOrders = await prisma.order.findMany({
        where: {
          riderId: userId,
          status: { in: ['confirmed', 'preparing', 'picked_up'] }
        },
        include: { restaurant: true }
      });

      if (activeOrders.length >= 3) {
        orders = [];
      } else if (activeOrders.length > 0) {
        orders = orders.filter(newOrder => {
          if (!newOrder.restaurant?.latitude || !newOrder.restaurant?.longitude || !newOrder.deliveryLat || !newOrder.deliveryLng) {
            return false;
          }

          let isAlongRoute = true;
          for (const active of activeOrders) {
            if (!active.restaurant?.latitude || !active.restaurant?.longitude || !active.deliveryLat || !active.deliveryLng) {
              continue;
            }

            const restDist = calculateDistance(
              parseFloat(newOrder.restaurant.latitude), parseFloat(newOrder.restaurant.longitude),
              parseFloat(active.restaurant.latitude), parseFloat(active.restaurant.longitude)
            );

            const custDist = calculateDistance(
              newOrder.deliveryLat, newOrder.deliveryLng,
              active.deliveryLat, active.deliveryLng
            );

            // ถ้าร้านใหม่ หรือ จุดส่งใหม่ อยู่ห่างจากงานค้างเกิน 5 กม. ให้ซ่อน (ไม่จ่ายงาน)
            if (restDist > 5 || custDist > 5) {
              isAlongRoute = false;
              break;
            }
          }
          return isAlongRoute;
        });
      }
    }

    return res.status(200).json({
      success: true,
      count: orders.length,
      orders
    });
  } catch (error) {
    console.error('❌ Get Orders Error:', error);
    return res.status(500).json({
      message: 'เกิดข้อผิดพลาดในการดึงประวัติออเดอร์',
      error: error.message
    });
  }
};

/**
 * @desc    Get single order details
 * @route   GET /api/orders/:id
 * @access  Private
 */
const getOrderById = async (req, res) => {
  const { id } = req.params;

  try {
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        restaurant: true,
        customer: {
          select: { fullName: true, phoneNumber: true, email: true }
        },
        rider: {
          select: { fullName: true, phoneNumber: true }
        },
        orderItems: {
          include: {
            menuItem: true
          }
        }
      }
    });

    if (!order) {
      return res.status(404).json({
        message: 'ไม่พบใบสั่งซื้ออาหารที่ระบุ'
      });
    }

    // ประเมินสิทธิ์ความเข้าถึงข้อมูลออเดอร์ (อนุญาตให้ไรเดอร์ดูได้หากออเดอร์นั้นยังตามหาคนขับ)
    const { id: userId, role } = req.user;
    if (
      role !== 'admin' &&
      order.customerId !== userId &&
      order.riderId !== userId &&
      order.restaurant.ownerId !== userId &&
      !(role === 'rider' && order.status === 'searching_rider')
    ) {
      return res.status(403).json({
        message: 'ไม่มีสิทธิ์เข้าดูรายละเอียดใบสั่งซื้อใบนี้'
      });
    }

    return res.status(200).json({
      success: true,
      order
    });
  } catch (error) {
    console.error('❌ Get Order By ID Error:', error);
    return res.status(500).json({
      message: 'เกิดข้อผิดพลาดในการเรียกดูรายละเอียดใบสั่งซื้อ',
      error: error.message
    });
  }
};

/**
 * @desc    Accept order job (Rider Only)
 * @route   POST /api/orders/:id/accept
 * @access  Private
 */
const acceptOrderJob = async (req, res) => {
  const { id } = req.params;

  try {
    // 1. ตรวจสอบสิทธิ์ไรเดอร์
    if (req.user.role !== 'rider' && req.user.role !== 'admin') {
      return res.status(403).json({
        message: 'สิทธิ์การรับงานจัดส่งมีเฉพาะสำหรับคนขับรถไรเดอร์เท่านั้น'
      });
    }

    // 2. ดึงออเดอร์มาตรวจสอบ
    const order = await prisma.order.findUnique({
      where: { id },
      include: { restaurant: true }
    });

    if (!order) {
      return res.status(404).json({ message: 'ไม่พบออเดอร์จัดส่งดังกล่าว' });
    }

    if (order.status !== 'searching_rider') {
      return res.status(400).json({
        message: 'ออเดอร์นี้ถูกรับไปจัดส่งโดยไรเดอร์ท่านอื่นแล้ว หรือถูกยกเลิกแล้ว'
      });
    }

    // 3. ตรวจสอบการรับงานซ้อน (Batched Orders Limits)
    const activeOrders = await prisma.order.findMany({
      where: {
        riderId: req.user.id,
        status: { in: ['confirmed', 'preparing', 'picked_up'] }
      },
      include: { restaurant: true }
    });

    if (activeOrders.length >= 3) {
      return res.status(400).json({
        message: 'คุณรับงานได้สูงสุด 3 ออเดอร์เท่านั้น กรุณาจัดส่งออเดอร์ปัจจุบันให้เสร็จสิ้นก่อน'
      });
    }

    // 4. ตรวจสอบว่าออเดอร์ใหม่อยู่ในเส้นทางเดียวกันหรือไม่ (ภายใน 5 กม.)
    if (activeOrders.length > 0) {
      if (!order.restaurant?.latitude || !order.restaurant?.longitude || !order.deliveryLat || !order.deliveryLng) {
        return res.status(400).json({
          message: 'ข้อมูลพิกัดออเดอร์ใหม่ไม่สมบูรณ์ ไม่สามารถรับเป็นงานซ้อนได้'
        });
      }

      let isAlongRoute = true;
      for (const active of activeOrders) {
        if (!active.restaurant?.latitude || !active.restaurant?.longitude || !active.deliveryLat || !active.deliveryLng) {
          continue;
        }

        const restDist = calculateDistance(
          parseFloat(order.restaurant.latitude), parseFloat(order.restaurant.longitude),
          parseFloat(active.restaurant.latitude), parseFloat(active.restaurant.longitude)
        );

        const custDist = calculateDistance(
          order.deliveryLat, order.deliveryLng,
          active.deliveryLat, active.deliveryLng
        );

        if (restDist > 5 || custDist > 5) {
          isAlongRoute = false;
          break;
        }
      }

      if (!isAlongRoute) {
        return res.status(400).json({
          message: 'ออเดอร์นี้อยู่นอกเส้นทางวิ่งงานปัจจุบันของคุณ ไม่สามารถรับซ้อนได้'
        });
      }
    }

    // 5. อัปเดตผูกไรเดอร์เข้ากับงาน และสลับสเตตัสออเดอร์เป็น confirmed
    const updatedOrder = await prisma.order.update({
      where: { id },
      data: {
        riderId: req.user.id,
        status: 'confirmed'
      },
      include: {
        restaurant: true,
        customer: {
          select: { fullName: true, phoneNumber: true, email: true, pushToken: true }
        },
        rider: {
          select: { fullName: true, phoneNumber: true }
        },
        orderItems: {
          include: {
            menuItem: true
          }
        }
      }
    });

    // แจ้งลูกค้าว่าไรเดอร์รับงานแล้ว
    if (updatedOrder.customer?.pushToken) {
      sendPush(
        updatedOrder.customer.pushToken,
        '🛵 ไรเดอร์รับงานแล้ว!',
        `${updatedOrder.rider?.fullName || 'ไรเดอร์'} กำลังเดินทางไปรับอาหารที่ ${updatedOrder.restaurant.name}`,
        { orderId: id }
      );
    }

    return res.status(200).json({
      success: true,
      message: 'คุณรับงานจัดส่งออเดอร์สำเร็จ! กรุณามุ่งหน้าไปที่ร้านค้า',
      order: updatedOrder
    });
  } catch (error) {
    console.error('❌ Accept Order Error:', error);
    return res.status(500).json({
      message: 'เกิดข้อผิดพลาดในการกดรับออเดอร์',
      error: error.message
    });
  }
};

/**
 * @desc    Update order delivery/preparation status (Rider/Vendor/Admin)
 * @route   PATCH /api/orders/:id/status
 * @access  Private
 */
const updateOrderStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const validStatuses = ['pending', 'confirmed', 'preparing', 'searching_rider', 'picked_up', 'delivered', 'cancelled'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ message: 'สถานะการสั่งซื้อไม่ถูกต้อง' });
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: { restaurant: true }
    });

    if (!order) {
      return res.status(404).json({ message: 'ไม่พบออเดอร์จัดส่งดังกล่าว' });
    }

    // ประเมินสิทธิ์ในการอัปเดต (เจ้าของร้านหรือไรเดอร์ผู้นำส่งออเดอร์เท่านั้น)
    const { id: userId, role } = req.user;
    if (
      role !== 'admin' &&
      order.riderId !== userId &&
      order.restaurant.ownerId !== userId
    ) {
      return res.status(403).json({
        message: 'ไม่มีสิทธิ์ในการแก้ไขสถานะของออเดอร์ใบนี้'
      });
    }

    // 4. บันทึกและจ่ายเงินไรเดอร์โดยอัตโนมัติหากส่งสำเร็จ (delivered)
    const updatedOrder = await prisma.$transaction(async (tx) => {
      const updateData = { status };

      if (status === 'delivered') {
        updateData.deliveredAt = new Date();
      }

      const resOrder = await tx.order.update({
        where: { id },
        data: updateData,
        include: {
          restaurant: true,
          customer: {
            select: { fullName: true, phoneNumber: true, email: true, pushToken: true }
          },
          rider: {
            select: { fullName: true, phoneNumber: true }
          },
          orderItems: {
            include: {
              menuItem: true
            }
          }
        }
      });

      // หากสถานะเปลี่ยนเป็น "ส่งสำเร็จ" (delivered) ให้ทำการโอนเงินทิปและค่ารอบเข้า RiderEarning ทันที!
      if (status === 'delivered' && resOrder.riderId) {
        // คำนวณรายได้สะสมไรเดอร์ = ค่าธรรมเนียมส่งอาหาร + ทิปเริ่มต้น 0 บาท
        const earningAmount = resOrder.deliveryFee;

        // เช็คว่าเคยจ่ายเงินสำหรับออเดอร์นี้ไปแล้วหรือยังเพื่อความปลอดภัย
        const existingEarning = await tx.riderEarning.findUnique({
          where: { orderId: resOrder.id }
        });

        if (!existingEarning) {
          await tx.riderEarning.create({
            data: {
              riderId: resOrder.riderId,
              orderId: resOrder.id,
              amount: earningAmount,
              tipAmount: 0.00
            }
          });

          // อัปเดตสถิติจำนวนงานสำเร็จของไรเดอร์ใน RiderProfile เพิ่มขึ้น 1 งาน
          await tx.riderProfile.update({
            where: { id: resOrder.riderId },
            data: {
              totalJobs: { increment: 1 }
            }
          });
        }
      }

      return resOrder;
    });

    // แจ้งลูกค้าเมื่อสถานะเปลี่ยน
    const statusMessages = {
      preparing: '👨‍🍳 ร้านกำลังเตรียมอาหาร',
      picked_up: '🛵 ไรเดอร์รับอาหารแล้ว กำลังเดินทางมาหาคุณ',
      delivered: '✅ ส่งอาหารสำเร็จ! ขอบคุณที่ใช้บริการ FreshDash',
      cancelled: '❌ ออเดอร์ถูกยกเลิก',
    };
    if (updatedOrder.customer?.pushToken && statusMessages[status]) {
      sendPush(updatedOrder.customer.pushToken, 'FreshDash', statusMessages[status], { orderId: id });
    }

    return res.status(200).json({
      success: true,
      message: `อัปเดตสถานะออเดอร์เป็น [${status}] สำเร็จ!`,
      order: updatedOrder
    });

  } catch (error) {
    console.error('❌ Update Order Status Error:', error);
    return res.status(500).json({
      message: 'เกิดข้อผิดพลาดในการอัปเดตสถานะออเดอร์',
      error: error.message
    });
  }
};

module.exports = {
  createOrder,
  getOrders,
  getOrderById,
  acceptOrderJob,
  updateOrderStatus
};
