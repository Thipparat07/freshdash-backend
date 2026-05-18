const { prisma } = require('./prisma');
const bcrypt = require('bcryptjs');

async function main() {
  console.log('🌱 Starting database seeding process...');

  // 1. ล้างข้อมูลเก่าตามลำดับความสัมพันธ์ (Relations)
  console.log('🗑️ Clearing old database records...');
  await prisma.orderItem.deleteMany();
  await prisma.riderEarning.deleteMany();
  await prisma.order.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.restaurant.deleteMany();
  await prisma.riderProfile.deleteMany();
  await prisma.riderVehicle.deleteMany();
  await prisma.riderDocument.deleteMany();
  await prisma.user.deleteMany();

  console.log('✅ Database cleared successfully.');

  // 2. สร้างหัสผ่านจำลองและแฮชอย่างปลอดภัย
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash('123456', salt);

  // 3. สร้างบัญชีทดสอบในแต่ละบทบาท (Roles)
  console.log('👤 Creating test accounts (Customer, Rider, Vendor)...');
  
  const customer = await prisma.user.create({
    data: {
      email: 'customer@test.com',
      password: hashedPassword,
      fullName: 'นพดล เจริญดี (ลูกค้า)',
      phoneNumber: '0812345678',
      role: 'customer',
      avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=150'
    }
  });

  const rider = await prisma.user.create({
    data: {
      email: 'rider@test.com',
      password: hashedPassword,
      fullName: 'สมคิด วงศ์ดี (ไรเดอร์สุดขยัน)',
      phoneNumber: '0898765432',
      role: 'rider',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150'
    }
  });

  // สร้างประวัติ RiderProfile และ ยานพาหนะเริ่มต้นให้อัตโนมัติ
  await prisma.riderProfile.create({
    data: {
      id: rider.id,
      status: 'offline',
      rating: 5.0,
      totalJobs: 0,
      isVerified: true
    }
  });

  await prisma.riderVehicle.create({
    data: {
      riderId: rider.id,
      type: 'motorcycle',
      model: 'Honda Wave 110i',
      plateNumber: 'กข 1234 สารคาม',
      color: 'แดง-ดำ',
      isActive: true
    }
  });

  const vendor = await prisma.user.create({
    data: {
      email: 'vendor@test.com',
      password: hashedPassword,
      fullName: 'แม่แก้ว ครัวคุณยาย (ร้านอาหาร)',
      phoneNumber: '0855554444',
      role: 'vendor',
      avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=150'
    }
  });

  console.log('✅ Users & Profiles created successfully.');

  // 4. สร้างร้านอาหารพรีเมียม (Restaurants)
  // กำหนดพิกัดจำลองรอบ ๆ มหาวิทยาลัยมหาสารคาม (ประมาณ Lat: 16.2468, Lng: 103.2502)
  console.log('🍔 Creating beautiful restaurants and menus...');

  // ร้านที่ 1: กะเพราถาดยักษ์ ครัวคุณยาย
  const r1 = await prisma.restaurant.create({
    data: {
      ownerId: vendor.id,
      name: 'กะเพราถาดยักษ์ ครัวคุณยาย',
      address: 'หลังมหาวิทยาลัยมหาสารคาม (ข้างหอพักเจริญสุข)',
      latitude: 16.2482,
      longitude: 103.2515,
      rating: 4.8,
      isOpen: true,
      imageUrl: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&q=80&w=400'
    }
  });

  await prisma.menuItem.createMany({
    data: [
      {
        restaurantId: r1.id,
        name: 'ข้าวราดกะเพราหมูกรอบถาดยักษ์',
        description: 'กะเพราหมูกรอบสูตรเด็ดรสชาติเข้มข้น จัดเสิร์ฟบนถาดใบตองใหญ่จุใจ พร้อมพริกน้ำปลาทำเอง',
        price: 89.00,
        imageUrl: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&q=80&w=300',
        isAvailable: true,
        category: 'จานด่วนถาดยักษ์'
      },
      {
        restaurantId: r1.id,
        name: 'ข้าวราดกะเพราทะเลเดือดถาดยักษ์',
        description: 'จัดเต็มกุ้ง ปลาหมึก และหอยแมลงภู่คัดไซส์ ผัดกะเพราแห้งพริกแห้งรสร้อนแรง',
        price: 119.00,
        imageUrl: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&q=80&w=300',
        isAvailable: true,
        category: 'จานด่วนถาดยักษ์'
      },
      {
        restaurantId: r1.id,
        name: 'ไข่ดาวลาวาทรงเครื่อง',
        description: 'ไข่เป็ดดาวกึ่งสุกกึ่งดิบ ไข่แดงเยิ้มพรีเมียม ทอดกรอบรอบนอก',
        price: 12.00,
        imageUrl: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&q=80&w=300',
        isAvailable: true,
        category: 'เครื่องเคียงเสริม'
      }
    ]
  });

  // ร้านที่ 2: ชาบูอินดี้ พรีเมียม Shabu
  const r2 = await prisma.restaurant.create({
    data: {
      ownerId: vendor.id,
      name: 'ชาบูอินดี้ พรีเมียม Shabu',
      address: 'หน้ามหาวิทยาลัยมหาสารคาม (ติดเซเว่นใหญ่)',
      latitude: 16.2455,
      longitude: 103.2492,
      rating: 4.7,
      isOpen: true,
      imageUrl: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&q=80&w=400'
    }
  });

  await prisma.menuItem.createMany({
    data: [
      {
        restaurantId: r2.id,
        name: 'เซ็ตหมูสไลด์พรีเมียมอินดี้',
        description: 'สันคอหมูสไลด์ สามชั้นสไลด์บางเฉียบ พร้อมผักสดและซุปชาบูสูตรเข้มข้น',
        price: 299.00,
        imageUrl: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&q=80&w=300',
        isAvailable: true,
        category: 'เซ็ตครอบครัวชาบู'
      },
      {
        restaurantId: r2.id,
        name: 'เซ็ตเนื้อริบอายโคขุนไทย-เฟรนช์',
        description: 'เนื้อโคขุนคัดเกรดลายหินอ่อน นุ่มลิ้นละลายในปาก จัดเสิร์ฟพร้อมน้ำจิ้มพอนสึและน้ำจิ้มสุกี้รสเด็ด',
        price: 399.00,
        imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&q=80&w=300',
        isAvailable: true,
        category: 'เซ็ตครอบครัวชาบู'
      },
      {
        restaurantId: r2.id,
        name: 'ชีสยืดพรีเมียมจากนิวซีแลนด์',
        description: 'มอสซาเรลล่าชีสแท้คัดพิเศษเกรดนำเข้า สำหรับลวกจุ่มยืดหอมอร่อย',
        price: 49.00,
        imageUrl: 'https://images.unsplash.com/photo-1589118949245-7d38baf380d6?auto=format&fit=crop&q=80&w=300',
        isAvailable: true,
        category: 'ท็อปปิ้งชาบู'
      }
    ]
  });

  // ร้านที่ 3: ชานมไข่มุก Premium Bubble Tea
  const r3 = await prisma.restaurant.create({
    data: {
      ownerId: vendor.id,
      name: 'ชานมไข่มุก Premium Bubble Tea',
      address: 'ติดถนนใหญ่หน้า ม.มหาสารคาม (ซอย มหาวิทยาลัย 12)',
      latitude: 16.2470,
      longitude: 103.2505,
      rating: 4.5,
      isOpen: true,
      imageUrl: 'https://images.unsplash.com/photo-1541658016709-82535e94bc69?auto=format&fit=crop&q=80&w=400'
    }
  });

  await prisma.menuItem.createMany({
    data: [
      {
        restaurantId: r3.id,
        name: 'ชานมไต้หวันต้นตำรับพ่นไฟ',
        description: 'ชานมเข้มข้นนำเข้าจากไต้หวัน พร้อมไข่มุกลาวาบราวน์ชูการ์นุ่มหนึบ ท็อปครีมชีสโรยน้ำตาลเบิร์นพ่นไฟ',
        price: 55.00,
        imageUrl: 'https://images.unsplash.com/photo-1541658016709-82535e94bc69?auto=format&fit=crop&q=80&w=300',
        isAvailable: true,
        category: 'ชานมพิกัดเด็ด'
      },
      {
        restaurantId: r3.id,
        name: 'ชาไทยโบราณพรีเมียมเฉาก๊วย',
        description: 'ชาไทยกลิ่นหอมกรุ่น คัดชาใบยอดแรกอย่างพิถีพิถัน พร้อมเฉาก๊วยโฮมเมดดึ๋งนุ่มหวานกำลังดี',
        price: 60.00,
        imageUrl: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&q=80&w=300',
        isAvailable: true,
        category: 'ชาคลาสสิก'
      },
      {
        restaurantId: r3.id,
        name: 'มัทฉะอูจิลาเต้ระดับพิธีการ',
        description: 'ชาเขียวมัทฉะแท้ส่งตรงจากเมืองอูจิ ประเทศญี่ปุ่น ชงสดแก้วต่อแก้ว ผสมกับนมสดแท้ 100%',
        price: 75.00,
        imageUrl: 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&q=80&w=300',
        isAvailable: true,
        category: 'ชาคลาสสิก'
      }
    ]
  });

  // ร้านที่ 4: ส้มตำแซ่บเวอร์ ครัวอีสาน
  const r4 = await prisma.restaurant.create({
    data: {
      ownerId: vendor.id,
      name: 'ส้มตำแซ่บเวอร์ ครัวอีสาน',
      address: 'สี่แยกวงเวียนวารินทร์ชำราบ (สาขาตักสิลา)',
      latitude: 16.2495,
      longitude: 103.2520,
      rating: 4.9,
      isOpen: true,
      imageUrl: 'https://images.unsplash.com/photo-1626700051175-6518c4793f4f?auto=format&fit=crop&q=80&w=400'
    }
  });

  await prisma.menuItem.createMany({
    data: [
      {
        restaurantId: r4.id,
        name: 'ตำป่าทะเลเดือดแซ่บนัว',
        description: 'ส้มตำป่าสูตรอีสานแท้ ใส่น้ำปลาร้าต้มสุกหอม ๆ พร้อมกุ้ง ปลาหมึก หอยแครง และสมุนไพรผักพื้นบ้าน',
        price: 99.00,
        imageUrl: 'https://images.unsplash.com/photo-1626700051175-6518c4793f4f?auto=format&fit=crop&q=80&w=300',
        isAvailable: true,
        category: 'ส้มตำรสเด็ด'
      },
      {
        restaurantId: r4.id,
        name: 'ปีกไก่ทอดสมุนไพรสามเกลอ',
        description: 'ปีกไก่หมักสมุนไพรไทย ทอดกรอบแห้งไม่อมน้ำมัน ทานคู่กับส้มตำฟินสุด ๆ',
        price: 89.00,
        imageUrl: 'https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&q=80&w=300',
        isAvailable: true,
        category: 'ของทอดเครื่องเคียง'
      },
      {
        restaurantId: r4.id,
        name: 'ลาบหมูคั่วพริกแห้งรสแซ่บ',
        description: 'เนื้อหมูสับรวนนุ่ม คลุกเคล้าข้าวคั่วคั่วสดใหม่และพริกป่นหอมมะนาวแป้นสดแซ่บสะใจ',
        price: 80.00,
        imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=300',
        isAvailable: true,
        category: 'ยำและลาบแซ่บ'
      }
    ]
  });

  console.log('✅ Restaurants and Menu Items seeded successfully.');

  console.log('\n🌟 Seeding process completed successfully!');
  console.log('📊 Stats Summary:');
  console.log('   - 3 Users (Customer, Rider, Vendor) Created');
  console.log('   - 4 Premium Restaurants Created around Mahasarakham University');
  console.log('   - 12 Delicious Menu Items Added to PostgreSQL');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
