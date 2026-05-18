const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { prisma } = require('../prisma');

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_key_change_me';

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 */
const register = async (req, res) => {
  const { email, password, fullName, phoneNumber, role } = req.body;

  try {
    // 1. Basic validation
    if (!email || !password || !fullName) {
      return res.status(400).json({ 
        message: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน (อีเมล, รหัสผ่าน, ชื่อ-นามสกุล)' 
      });
    }

    // 2. Validate role if provided
    const validRoles = ['customer', 'rider', 'vendor', 'admin'];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ message: 'บทบาทผู้ใช้งานไม่ถูกต้อง' });
    }

    // 3. Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });
    if (existingUser) {
      return res.status(400).json({ message: 'อีเมลนี้ถูกใช้งานในระบบแล้ว' });
    }

    // 4. Check if phone number already exists
    if (phoneNumber) {
      const existingPhone = await prisma.user.findUnique({
        where: { phoneNumber }
      });
      if (existingPhone) {
        return res.status(400).json({ message: 'เบอร์โทรศัพท์นี้ถูกใช้งานในระบบแล้ว' });
      }
    }

    // 5. Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 6. Create user inside transaction to guarantee consistency
    const result = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: email.toLowerCase(),
          password: hashedPassword,
          fullName,
          phoneNumber: phoneNumber || null,
          role: role || 'customer'
        }
      });

      // If user registers as a rider, automatically initialize their RiderProfile
      if (newUser.role === 'rider') {
        await tx.riderProfile.create({
          data: {
            id: newUser.id, // Primary key links 1:1 with User
            status: 'offline',
            rating: 5.0,
            totalJobs: 0,
            isVerified: false
          }
        });
      }

      return newUser;
    });

    // 7. Generate JWT token
    const token = jwt.sign(
      { userId: result.id, email: result.email, role: result.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // 8. Respond excluding password
    const { password: _, ...userWithoutPassword } = result;
    return res.status(201).json({
      message: 'ลงทะเบียนผู้ใช้สำเร็จ',
      user: userWithoutPassword,
      token
    });

  } catch (error) {
    console.error('❌ Register Error:', error);
    return res.status(500).json({ 
      message: 'เกิดข้อผิดพลาดในการลงทะเบียนผู้ใช้งาน',
      error: error.message 
    });
  }
};

/**
 * @desc    Login user & get token
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    // 1. Basic validation
    if (!email || !password) {
      return res.status(400).json({ message: 'กรุณากรอกอีเมลและรหัสผ่าน' });
    }

    // 2. Find user in database
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        riderProfile: true
      }
    });

    if (!user) {
      return res.status(401).json({ message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
    }

    // 3. Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
    }

    // 4. Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // 5. Respond excluding password
    const { password: _, ...userWithoutPassword } = user;
    return res.status(200).json({
      message: 'เข้าสู่ระบบสำเร็จ',
      user: userWithoutPassword,
      token
    });

  } catch (error) {
    console.error('❌ Login Error:', error);
    return res.status(500).json({ 
      message: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ',
      error: error.message 
    });
  }
};

module.exports = {
  register,
  login
};
