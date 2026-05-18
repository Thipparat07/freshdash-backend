const fs = require('fs');
const path = require('path');
const { prisma } = require('../prisma');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'financials.json');

// ตรวจสอบและสร้างโฟลเดอร์สำหรับเก็บข้อมูลหากยังไม่มี
function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({}, null, 2), 'utf8');
  }
}

// โหลดฐานข้อมูลการเงิน JSON
function loadFinancialsData() {
  ensureDataFile();
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading financials file:', error);
    return {};
  }
}

// เซฟฐานข้อมูลการเงิน JSON
function saveFinancialsData(data) {
  ensureDataFile();
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error('Error saving financials file:', error);
  }
}

// ดึงสรุปรายงานทางการเงินแยกตามไรเดอร์
async function getRiderFinancials(riderId) {
  const allData = loadFinancialsData();
  
  // ยอดเงินเริ่มต้นตามหน้า Mockup เพื่อความสวยงามพรีเมียม
  const defaultWalletBase = 266.31;
  const defaultCreditBase = 98.52;

  // หากยังไม่เคยบันทึก ให้เริ่มสร้างชุดข้อมูลเริ่มต้น
  if (!allData[riderId]) {
    allData[riderId] = {
      withdrawals: [],
      transfers: [],
      topups: []
    };
    saveFinancialsData(allData);
  }

  const riderData = allData[riderId];

  // 1. คำนวณรายได้ทั้งหมดจากระบบบิลจริงในฐานข้อมูล PostgreSQL (RiderEarning)
  let dbEarningsTotal = 0;
  const dbEarningsList = [];
  try {
    const earnings = await prisma.riderEarning.findMany({
      where: { riderId },
      include: {
        order: {
          include: {
            restaurant: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    earnings.forEach(earn => {
      const amountVal = parseFloat(earn.amount || 0);
      const tipVal = parseFloat(earn.tipAmount || 0);
      const netVal = amountVal + tipVal;
      dbEarningsTotal += netVal;

      const orderDate = new Date(earn.createdAt);
      dbEarningsList.push({
        id: earn.id,
        title: 'รายรับจากงาน',
        dateTime: orderDate.toLocaleDateString('th-TH', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        meta: earn.order ? `LMF-${orderDate.toISOString().substring(2, 10).replace(/-/g, '')}-${earn.order.id.substring(0, 6).toUpperCase()}` : 'อ้างอิงบิลงานจัดส่ง',
        amount: `+฿${netVal.toFixed(2)}`,
        isPositive: true,
        clickable: false,
        rawAmount: netVal,
        createdAt: earn.createdAt
      });
    });
  } catch (error) {
    console.error('Error querying RiderEarning from Prisma:', error);
  }

  // 2. คำนวณยอดเงินรวมปรับลด/เพิ่มตามธุรกรรม
  let totalWithdrawn = 0;
  riderData.withdrawals.forEach(w => {
    totalWithdrawn += parseFloat(w.amount);
  });

  let totalTransferred = 0;
  riderData.transfers.forEach(t => {
    totalTransferred += parseFloat(t.amount);
  });

  let totalDirectTopup = 0;
  riderData.topups.forEach(tp => {
    totalDirectTopup += parseFloat(tp.amount);
  });

  // 3. คำนวณกระเป๋าวอลเล็ต = ฐานเริ่มต้น + รายรับงานจริง + เติมเงิน - ถอนเงิน - โอนไปเครดิต
  const finalWallet = defaultWalletBase + dbEarningsTotal + totalDirectTopup - totalWithdrawn - totalTransferred;
  
  // 4. คำนวณเครดิตรับงาน = ฐานเริ่มต้น + โอนมาจากวอลเล็ต
  const finalCredit = defaultCreditBase + totalTransferred;

  // 5. ประกอบรายการธุรกรรมทั้งหมดเข้าด้วยกัน
  const transactionHistory = [...dbEarningsList];

  riderData.withdrawals.forEach(w => {
    transactionHistory.push({
      id: w.id,
      title: 'ถอนเงิน',
      dateTime: new Date(w.createdAt).toLocaleDateString('th-TH', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      meta: 'ทำรายการสำเร็จ (KBANK)',
      amount: `-฿${parseFloat(w.amount).toFixed(2)}`,
      isPositive: false,
      clickable: false,
      rawAmount: parseFloat(w.amount),
      createdAt: w.createdAt
    });
  });

  riderData.transfers.forEach(t => {
    transactionHistory.push({
      id: t.id,
      title: 'โอนเงินเติมเครดิต',
      dateTime: new Date(t.createdAt).toLocaleDateString('th-TH', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      meta: 'โอนย้ายสำเร็จ',
      amount: `-฿${parseFloat(t.amount).toFixed(2)}`,
      isPositive: false,
      clickable: false,
      rawAmount: parseFloat(t.amount),
      createdAt: t.createdAt
    });
  });

  riderData.topups.forEach(tp => {
    transactionHistory.push({
      id: tp.id,
      title: 'เติมเงินวอลเล็ต',
      dateTime: new Date(tp.createdAt).toLocaleDateString('th-TH', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      meta: 'ทำรายการสำเร็จ (PromptPay)',
      amount: `+฿${parseFloat(tp.amount).toFixed(2)}`,
      isPositive: true,
      clickable: false,
      rawAmount: parseFloat(tp.amount),
      createdAt: tp.createdAt
    });
  });

  // เรียงประวัติการทำรายการล่าสุดขึ้นก่อน
  transactionHistory.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return {
    walletBalance: Math.max(0, finalWallet),
    creditBalance: Math.max(0, finalCredit),
    withdrawableBalance: Math.max(0, finalWallet), // ถอนเงินได้ทั้งหมดในวอลเล็ต
    transactions: transactionHistory
  };
}

// สั่งทำรายการถอนเงินสดจากวอลเล็ต
async function requestWithdrawal(riderId, amountVal) {
  const amount = parseFloat(amountVal);
  if (isNaN(amount) || amount <= 0) return { success: false, message: 'จำนวนเงินถอนไม่ถูกต้อง' };

  const currentFin = await getRiderFinancials(riderId);
  if (amount > currentFin.walletBalance) {
    return { success: false, message: 'ยอดเงินในวอลเล็ตไม่เพียงพอสำหรับการทำรายการถอนเงิน' };
  }

  const allData = loadFinancialsData();
  const txId = `W-${Date.now().toString().substring(6)}`;
  
  allData[riderId].withdrawals.push({
    id: txId,
    amount,
    createdAt: new Date().toISOString()
  });

  saveFinancialsData(allData);
  return { success: true, message: 'ทำรายการถอนเงินสำเร็จ', txId };
}

// สั่งโอนเงินจากวอลเล็ตสะสมเข้าเป็นเครดิตรับงาน
async function requestTransfer(riderId, amountVal) {
  const amount = parseFloat(amountVal);
  if (isNaN(amount) || amount <= 0) return { success: false, message: 'จำนวนเงินโอนไม่ถูกต้อง' };

  const currentFin = await getRiderFinancials(riderId);
  if (amount > currentFin.walletBalance) {
    return { success: false, message: 'ยอดเงินในวอลเล็ตไม่เพียงพอสำหรับการทำรายการเติมเครดิต' };
  }

  const allData = loadFinancialsData();
  const txId = `T-${Date.now().toString().substring(6)}`;

  allData[riderId].transfers.push({
    id: txId,
    amount,
    createdAt: new Date().toISOString()
  });

  saveFinancialsData(allData);
  return { success: true, message: 'โอนเติมเงินเครดิตรับงานสำเร็จ', txId };
}

// สั่งเติมเงินสดเข้าวอลเล็ตโดยตรง (จำลอง พร้อมเพย์/ธนาคาร)
async function requestDirectTopup(riderId, amountVal) {
  const amount = parseFloat(amountVal);
  if (isNaN(amount) || amount <= 0) return { success: false, message: 'จำนวนเงินเติมไม่ถูกต้อง' };

  const allData = loadFinancialsData();
  const txId = `TP-${Date.now().toString().substring(6)}`;

  if (!allData[riderId]) {
    allData[riderId] = { withdrawals: [], transfers: [], topups: [] };
  }

  allData[riderId].topups.push({
    id: txId,
    amount,
    createdAt: new Date().toISOString()
  });

  saveFinancialsData(allData);
  return { success: true, message: 'เติมเงินเข้าวอลเล็ตสดสำเร็จ', txId };
}

module.exports = {
  getRiderFinancials,
  requestWithdrawal,
  requestTransfer,
  requestDirectTopup
};
