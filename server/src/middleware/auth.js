import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/index.js';
import prisma from '../models/index.js';

export const authenticate = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        success: false,
        error: 'Authentication required' 
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId, isActive: true },
      select: { 
        id: true, 
        email: true, 
        username: true, 
        name: true,
        bio: true,
        avatar: true,
        role: true 
      }
    });

    if (!user) {
      return res.status(401).json({ 
        success: false,
        error: 'User not found or inactive' 
      });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ 
      success: false,
      error: 'Invalid or expired token' 
    });
  }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false,
        error: 'Authentication required' 
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false,
        error: 'Insufficient permissions' 
      });
    }

    next();
  };
};