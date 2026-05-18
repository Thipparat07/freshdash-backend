const jwt = require('jsonwebtoken');
const { prisma } = require('../prisma');

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_key_change_me';

/**
 * @desc    Middleware to protect routes (Verify JWT token)
 */
const protect = async (req, res, next) => {
  let token;

  // Check for token in Authorization header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header: "Bearer <token>"
      token = req.headers.authorization.split(' ')[1];

      // Verify token signature
      const decoded = jwt.verify(token, JWT_SECRET);

      // Find user from database to ensure they still exist
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          email: true,
          role: true,
          fullName: true
        }
      });

      if (!user) {
        return res.status(401).json({ 
          message: 'ไม่มีสิทธิ์เข้าใช้งานระบบ เนื่องจากไม่พบผู้ใช้รายนี้แล้ว' 
        });
      }

      // Attach user context to request object
      req.user = user;
      return next();

    } catch (error) {
      console.error('❌ Middleware Auth Error:', error.message);
      return res.status(401).json({ 
        message: 'โทเค็นตรวจสอบสิทธิ์ไม่ถูกต้อง หรือเซสชันหมดอายุแล้ว' 
      });
    }
  }

  if (!token) {
    return res.status(401).json({ 
      message: 'โปรดแนบโทเค็นเพื่อผ่านการตรวจสอบสิทธิ์ (Authorization: Bearer <token>)' 
    });
  }
};

/**
 * @desc    Middleware to authorize specific roles
 * @param   roles Allowed roles for the endpoint
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'ไม่ผ่านการยืนยันตัวตน' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: `สิทธิ์ของคุณ (${req.user.role}) ไม่ได้รับอนุญาตให้ทำรายการในเส้นทางนี้` 
      });
    }

    return next();
  };
};

module.exports = {
  protect,
  authorize
};
