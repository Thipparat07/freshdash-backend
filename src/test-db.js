const { prisma } = require('./prisma');
require('dotenv').config();

async function testConnection() {
  console.log('🔍 กำลังทดสอบการเชื่อมต่อฐานข้อมูล...');
  try {
    const result = await prisma.$queryRaw`SELECT NOW()`;
    console.log('✅ เชื่อมต่อสำเร็จ!');
    console.log('⏰ เวลาจากฐานข้อมูล:', result);
  } catch (error) {
    console.error('❌ เชื่อมต่อฐานข้อมูลล้มเหลว:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();
