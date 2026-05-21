const { prisma } = require('./prisma');
const { calculateDistance } = require('./utils/geo');

async function runTest() {
  console.log('🚀 เริ่มต้นการทดสอบระบบรับงานซ้อน (Batched Orders Optimization)...\n');

  try {
    // ดึงผู้ใช้งานจำลอง (Rider)
    const rider = await prisma.user.findFirst({ where: { role: 'rider' } });
    if (!rider) throw new Error('ไม่พบข้อมูล Rider ทดสอบ');

    console.log(`👤 ใช้บัญชีไรเดอร์ทดสอบ: ${rider.fullName}`);

    // ดึงออเดอร์ทั้งหมดที่สถานะเป็น searching_rider
    const availableOrders = await prisma.order.findMany({
      where: { status: 'searching_rider' },
      include: { restaurant: true }
    });

    console.log(`📋 พบออเดอร์ในระบบที่รอไรเดอร์รับงาน: ${availableOrders.length} ออเดอร์\n`);

    if (availableOrders.length < 4) {
        console.log('⚠️ ไม่สามารถทดสอบลิมิต 3 งานได้ เนื่องจากมีออเดอร์ในระบบน้อยกว่า 4 งาน กรุณาสร้างออเดอร์เพิ่มผ่านแอปพลิเคชัน');
        return;
    }

    // --- จำลองกระบวนการทำงานของ Order Controller ---
    const activeOrders = [];

    for (let i = 0; i < availableOrders.length; i++) {
        const order = availableOrders[i];
        
        console.log(`\n======================================`);
        console.log(`🛒 ความพยายามกดรับออเดอร์ที่ ${i+1}: ร้าน ${order.restaurant.name}`);
        
        // 1. เช็คลิมิต
        if (activeOrders.length >= 3) {
            console.log('❌ การรับงานล้มเหลว (Expected Error): คุณรับงานได้สูงสุด 3 ออเดอร์เท่านั้น กรุณาจัดส่งออเดอร์ปัจจุบันให้เสร็จสิ้นก่อน');
            continue; // ข้ามการรับออเดอร์นี้ไป (จำลองการเกิด Error)
        }

        // 2. เช็คเส้นทาง (ถ้ามีงานค้าง)
        if (activeOrders.length > 0) {
            let isAlongRoute = true;
            for (const active of activeOrders) {
                const restDist = calculateDistance(
                    order.restaurant.latitude, order.restaurant.longitude,
                    active.restaurant.latitude, active.restaurant.longitude
                );
                const custDist = calculateDistance(
                    order.deliveryLat, order.deliveryLng,
                    active.deliveryLat, active.deliveryLng
                );
                
                console.log(`   📍 เช็คระยะห่างจากงานค้าง [ร้าน ${active.restaurant.name}]:`);
                console.log(`      - ระยะห่างร้านค้า: ${restDist.toFixed(2)} กม.`);
                console.log(`      - ระยะห่างลูกค้า: ${custDist.toFixed(2)} กม.`);

                if (restDist > 5 || custDist > 5) {
                    isAlongRoute = false;
                    console.log('❌ การรับงานล้มเหลว (Expected Error): ออเดอร์นี้อยู่นอกเส้นทางวิ่งงานปัจจุบันของคุณ (เกิน 5 กม.)');
                    break;
                }
            }

            if (!isAlongRoute) continue;
        }

        // 3. จำลองการรับงานสำเร็จ
        activeOrders.push(order);
        console.log('✅ รับงานสำเร็จ! ตอนนี้ไรเดอร์มีงานในมือ:', activeOrders.length, 'งาน');
    }

    console.log(`\n======================================`);
    console.log(`🎉 สรุปผลการทดสอบ: ไรเดอร์รับงานได้ทั้งหมด ${activeOrders.length} งาน (ต้องไม่เกิน 3 งาน)`);

  } catch (error) {
    console.error('เกิดข้อผิดพลาดในการรันทดสอบ:', error);
  } finally {
    await prisma.$disconnect();
  }
}

runTest();
