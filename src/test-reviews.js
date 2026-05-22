require('dotenv').config();
const { prisma } = require('./prisma');
const { createReview, getRestaurantReviews, getRiderReviews } = require('./controllers/reviewController');
const { getRestaurants } = require('./controllers/restaurantController');

// Helper to create mock response object
const createMockRes = () => {
  const res = {
    statusCode: 200,
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(obj) {
      this.data = obj;
      return this;
    }
  };
  return res;
};

async function runTests() {
  console.log('🚀 เริ่มต้นการทดสอบระบบ Review และ Advanced Search Filters...');

  // 1. สร้างข้อมูลทดสอบชั่วคราว
  const testSuffix = Date.now().toString().slice(-6);
  const customerEmail = `customer_${testSuffix}@test.com`;
  const riderEmail = `rider_${testSuffix}@test.com`;
  const vendorEmail = `vendor_${testSuffix}@test.com`;

  let customer, rider, vendor, restaurant, order1, order2;

  try {
    console.log('🔄 1. กำลังสร้างข้อมูลผู้ใช้ ร้านค้า และออเดอร์สำหรับการทดสอบ...');
    
    // Create Users
    customer = await prisma.user.create({
      data: {
        email: customerEmail,
        password: 'password123',
        fullName: 'Test Customer',
        role: 'customer',
        phoneNumber: `081${testSuffix}`
      }
    });

    rider = await prisma.user.create({
      data: {
        email: riderEmail,
        password: 'password123',
        fullName: 'Test Rider',
        role: 'rider',
        phoneNumber: `082${testSuffix}`,
        riderProfile: {
          create: {
            status: 'online',
            rating: 5.0,
            isVerified: true
          }
        }
      }
    });

    vendor = await prisma.user.create({
      data: {
        email: vendorEmail,
        password: 'password123',
        fullName: 'Test Vendor',
        role: 'vendor',
        phoneNumber: `083${testSuffix}`
      }
    });

    // Create Restaurant (located at Bangkok Siam Paragon approx: lat 13.746, lng 100.535)
    restaurant = await prisma.restaurant.create({
      data: {
        ownerId: vendor.id,
        name: `ส้มตำรสเด็ด-${testSuffix}`,
        address: 'Siam Paragon, Bangkok',
        latitude: 13.7468,
        longitude: 100.5352,
        rating: 0.0 // starts with 0
      }
    });

    // Create Order 1 (delivered)
    order1 = await prisma.order.create({
      data: {
        customerId: customer.id,
        restaurantId: restaurant.id,
        riderId: rider.id,
        status: 'delivered',
        totalAmount: 250.00,
        deliveryFee: 40.00,
        deliveryAddress: 'Chulalongkorn University, Bangkok',
        deliveryLat: 13.7384,
        deliveryLng: 100.5320
      }
    });

    // Create Order 2 (delivered)
    order2 = await prisma.order.create({
      data: {
        customerId: customer.id,
        restaurantId: restaurant.id,
        riderId: rider.id,
        status: 'delivered',
        totalAmount: 180.00,
        deliveryFee: 30.00,
        deliveryAddress: 'MBK Center, Bangkok',
        deliveryLat: 13.7443,
        deliveryLng: 100.5299
      }
    });

    console.log('✅ สร้างข้อมูลทดสอบสำเร็จ!');

    // 2. ทดสอบการบันทึกรีวิวออเดอร์ที่ 1
    console.log('\n🔄 2. ทดสอบส่งรีวิวสำหรับ Order 1 (ร้านค้าให้ 4 ดาว, ไรเดอร์ให้ 5 ดาว)...');
    
    const req1 = {
      params: { orderId: order1.id },
      body: {
        restaurantRating: 4,
        restaurantComment: 'ส้มตำอร่อย ปูม้าสดดีมากครับ',
        riderRating: 5,
        riderComment: 'ส่งรวดเร็ว สุภาพเรียบร้อยดีมาก'
      },
      user: { id: customer.id }
    };
    
    const res1 = createMockRes();
    await createReview(req1, res1);

    console.log(`- Status Code: ${res1.statusCode}`);
    console.log(`- Success Status: ${res1.data.success}`);
    console.log(`- Message: ${res1.data.message}`);

    if (res1.statusCode !== 201) {
      throw new Error(`Review 1 creation failed: ${JSON.stringify(res1.data)}`);
    }

    // ตรวจสอบคะแนนเฉลี่ยที่ถูกอัปเดต
    const updatedRest1 = await prisma.restaurant.findUnique({ where: { id: restaurant.id } });
    const updatedRider1 = await prisma.riderProfile.findUnique({ where: { id: rider.id } });

    console.log(`📊 ตรวจสอบผลการคำนวณเฉลี่ยรอบที่ 1:`);
    console.log(`  * คะแนนเฉลี่ยร้านอาหาร (คาดหวัง 4.0): ${updatedRest1.rating}`);
    console.log(`  * คะแนนเฉลี่ยไรเดอร์ (คาดหวัง 5.0): ${updatedRider1.rating}`);

    if (updatedRest1.rating !== 4.0 || updatedRider1.rating !== 5.0) {
      throw new Error('การคำนวณคะแนนเฉลี่ยรอบแรกไม่ถูกต้อง');
    }

    // 3. ป้องกันการรีวิวซ้ำ
    console.log('\n🔄 3. ทดสอบส่งรีวิวซ้ำสำหรับ Order 1 (ต้องไม่สามารถทำได้)...');
    const resDuplicate = createMockRes();
    await createReview(req1, resDuplicate);
    console.log(`- Status Code: ${resDuplicate.statusCode} (คาดหวัง 400)`);
    console.log(`- Message: ${resDuplicate.data.message}`);
    
    if (resDuplicate.statusCode !== 400) {
      throw new Error('ระบบไม่ได้บล็อกการส่งรีวิวซ้ำของออเดอร์เดิม');
    }

    // 4. รีวิวออเดอร์ที่ 2 (เพื่อดูค่าน้ำหนักเฉลี่ยสะสม)
    console.log('\n🔄 4. ทดสอบส่งรีวิวสำหรับ Order 2 (ร้านค้าให้ 2 ดาว, ไรเดอร์ให้ 4 ดาว)...');
    
    const req2 = {
      params: { orderId: order2.id },
      body: {
        restaurantRating: 2,
        restaurantComment: 'หวานเกินไปหน่อย ไม่ค่อยเผ็ดเลย',
        riderRating: 4,
        riderComment: 'โอเคดีครับ'
      },
      user: { id: customer.id }
    };
    
    const res2 = createMockRes();
    await createReview(req2, res2);

    console.log(`- Status Code: ${res2.statusCode}`);
    
    const updatedRest2 = await prisma.restaurant.findUnique({ where: { id: restaurant.id } });
    const updatedRider2 = await prisma.riderProfile.findUnique({ where: { id: rider.id } });

    console.log(`📊 ตรวจสอบผลการคำนวณเฉลี่ยรอบที่ 2:`);
    console.log(`  * คะแนนเฉลี่ยร้านอาหาร (คาดหวัง (4+2)/2 = 3.0): ${updatedRest2.rating}`);
    console.log(`  * คะแนนเฉลี่ยไรเดอร์ (คาดหวัง (5+4)/2 = 4.5): ${updatedRider2.rating}`);

    if (updatedRest2.rating !== 3.0 || updatedRider2.rating !== 4.5) {
      throw new Error('การคำนวณคะแนนเฉลี่ยรอบสองไม่ถูกต้อง');
    }

    // 5. ทดสอบ API Advanced Restaurant Searching & Distance Filters
    console.log('\n🔄 5. ทดสอบ Advanced Restaurant Search & Filters...');

    // A. ค้นหาแบบธรรมดาด้วยคีย์เวิร์ด
    console.log('  A. ค้นหาด้วยคำค้น "ส้มตำ"...');
    const reqSearch1 = { query: { search: 'ส้มตำ' } };
    const resSearch1 = createMockRes();
    await getRestaurants(reqSearch1, resSearch1);
    console.log(`    * พบร้านค้าจำนวน: ${resSearch1.data.count} ร้าน`);
    const foundRest1 = resSearch1.data.restaurants.find(r => r.id === restaurant.id);
    if (!foundRest1) throw new Error('ไม่พบร้านอาหารที่ตั้งใจค้นหาผ่านคีย์เวิร์ด');

    // B. ค้นหาด้วยระดับคะแนนขั้นต่ำ (minRating)
    console.log('  B. ค้นหาด้วยคะแนนขั้นต่ำ minRating = 4.0 (ต้องไม่พบร้านทดสอบเนื่องจากคะแนนเฉลี่ยอยู่ที่ 3.0)...');
    const reqSearchRatingHigh = { query: { search: 'ส้มตำ', minRating: '4.0' } };
    const resSearchRatingHigh = createMockRes();
    await getRestaurants(reqSearchRatingHigh, resSearchRatingHigh);
    const foundRestHigh = resSearchRatingHigh.data.restaurants.find(r => r.id === restaurant.id);
    console.log(`    * ค้นพบร้านทดสอบ: ${foundRestHigh ? 'พบ (❌ ผิดพลาด)' : 'ไม่พบ (✅ ถูกต้อง)'}`);
    if (foundRestHigh) throw new Error('คะแนนขั้นต่ำกรองร้านอาหารออกไม่ถูกต้อง');

    console.log('  C. ค้นหาด้วยคะแนนขั้นต่ำ minRating = 2.5 (ต้องพบร้านทดสอบ)...');
    const reqSearchRatingLow = { query: { search: 'ส้มตำ', minRating: '2.5' } };
    const resSearchRatingLow = createMockRes();
    await getRestaurants(reqSearchRatingLow, resSearchRatingLow);
    const foundRestLow = resSearchRatingLow.data.restaurants.find(r => r.id === restaurant.id);
    console.log(`    * ค้นพบร้านทดสอบ: ${foundRestLow ? 'พบ (✅ ถูกต้อง)' : 'ไม่พบ (❌ ผิดพลาด)'}`);
    if (!foundRestLow) throw new Error('ระบบคะแนนขั้นต่ำกรองร้านออกผิดพลาด');

    // D. ค้นหาร้านอาหารตามระยะทาง (Geographic Distance Sorting via Haversine)
    console.log('  D. ทดสอบคำนวณพิกัดและเรียงตามระยะทางจาก MBK Center (lat: 13.7443, lng: 100.5299)...');
    // Siam Paragon (ร้านค้า) ห่างจาก MBK Center ประมาณ 0.6 km
    const reqSearchDist = {
      query: {
        search: 'ส้มตำ',
        lat: '13.7443',
        lng: '100.5299'
      }
    };
    const resSearchDist = createMockRes();
    await getRestaurants(reqSearchDist, resSearchDist);
    const matchedRest = resSearchDist.data.restaurants.find(r => r.id === restaurant.id);
    console.log(`    * คำนวณระยะห่าง: ${matchedRest ? matchedRest.distance + ' km' : 'คำนวณล้มเหลว'}`);
    if (!matchedRest || matchedRest.distance === null || matchedRest.distance > 1.5) {
      throw new Error('การคำนวณระยะทาง Haversine ผิดพลาดหรือไม่พบข้อมูลระยะทาง');
    }

    console.log('\n🎉 ผลการทดสอบทุกข้อผ่านการตรวจสอบอย่างถูกต้อง 100%! 🎉');

  } catch (err) {
    console.error('\n❌ เกิดข้อผิดพลาดในระหว่างการทดสอบ:', err);
  } finally {
    // 6. ลบข้อมูลทดสอบออกจากฐานข้อมูลเพื่อรักษาความสะอาด (Cleanup)
    console.log('\n🧹 กำลังทำความสะอาดลบข้อมูลทดสอบทั้งหมด...');
    if (order1) await prisma.order.delete({ where: { id: order1.id } }).catch(() => {});
    if (order2) await prisma.order.delete({ where: { id: order2.id } }).catch(() => {});
    if (restaurant) await prisma.restaurant.delete({ where: { id: restaurant.id } }).catch(() => {});
    if (customer) await prisma.user.delete({ where: { id: customer.id } }).catch(() => {});
    if (rider) await prisma.user.delete({ where: { id: rider.id } }).catch(() => {});
    if (vendor) await prisma.user.delete({ where: { id: vendor.id } }).catch(() => {});
    
    await prisma.$disconnect();
    console.log('✨ การทำความสะอาดข้อมูลเสร็จเรียบร้อยแล้ว!');
  }
}

runTests();
