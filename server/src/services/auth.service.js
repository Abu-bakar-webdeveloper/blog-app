import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { JWT_SECRET, JWT_EXPIRES_IN } from '../config/index.js';
import prisma from '../models/index.js';
import { invalidateUserProfile } from '../utils/cache.js';

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

// Register new user
export const register = async (userData) => {
  // Check if user exists
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { email: userData.email },
        { username: userData.username }
      ]
    }
  });

  if (existingUser) {
    throw new Error('User with this email or username already exists');
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(userData.password, 10);
  
  // Create user
  const user = await prisma.user.create({
    data: {
      email: userData.email,
      username: userData.username,
      password: hashedPassword,
      name: userData.name,
      bio: userData.bio,
        avatar: userData.avatar,
    },
    select: {
      id: true,
      email: true,
      username: true,
      name: true,
      bio: true,
      avatar: true,
      role: true,
      createdAt: true,
    },
  });

  // Generate token
  const token = generateToken(user.id);
  
  return { user, token };
};

// Login user
export const login = async (email, password) => {
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
  });

  if (!user) {
    throw new Error('Invalid credentials');
  }

  const isValidPassword = await bcrypt.compare(password, user.password);
  if (!isValidPassword) {
    throw new Error('Invalid credentials');
  }

  const token = generateToken(user.id);
  
  return {
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      name: user.name,
      // bio: user.bio,
      // avatar: user.avatar,
      role: user.role,
    },
    token,
  };
};

// Update user profile
export const updateProfile = async (userId, data, newAvatarUrl = null) => {
  const updateData = { ...data };
  
  // Handle avatar update
  if (newAvatarUrl !== undefined) {
    // Get current user to delete old avatar
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatar: true }
    });
    
    // Delete old avatar if exists and is different
    if (currentUser?.avatar && currentUser.avatar !== newAvatarUrl) {
      const publicId = extractPublicId(currentUser.avatar);
      if (publicId) {
        await deleteImage(publicId);
      }
    }
    
    // Set new avatar URL (or null if removing)
    updateData.avatar = newAvatarUrl;
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: {
      id: true,
      email: true,
      username: true,
      name: true,
      bio: true,
      avatar: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  await invalidateUserProfile(userId);

  return user;
};