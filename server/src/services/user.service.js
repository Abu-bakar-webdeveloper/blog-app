import prisma from '../models/index.js';
import {
  CACHE_KEYS,
  CACHE_TTL,
  getCache,
  setCache,
  invalidateUserProfile,
  invalidateUsersList,
} from '../utils/cache.js';

// Get user profile by ID
export const getUserProfile = async (userId) => {
  const cacheKey = CACHE_KEYS.userProfile(userId);
  const cachedProfile = await getCache(cacheKey);

  if (cachedProfile) {
    return cachedProfile;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId, isActive: true },
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
      _count: {
        select: {
          blogs: true,
          comments: true,
          likes: true,
        }
      },
      blogs: {
        where: { isPublished: true },
        take: 5,
        select: {
          id: true,
          title: true,
          slug: true,
          type: true,
          views: true,
          createdAt: true,
          _count: {
            select: {
              likes: true,
              comments: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  if (!user) {
    throw new Error('User not found');
  }

  await setCache(cacheKey, user, CACHE_TTL.MEDIUM);

  return user;
};

// Get user's liked blogs
export const getUserLikes = async (userId, page = 1, limit = 10) => {
  const skip = (page - 1) * limit;
  
  const [likes, total] = await Promise.all([
    prisma.like.findMany({
      where: { userId },
      skip,
      take: parseInt(limit),
      include: {
        blog: {
          include: {
            author: {
              select: {
                id: true,
                name: true,
                username: true,
                avatar: true,
              }
            },
            _count: {
              select: {
                likes: true,
                comments: true,
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.like.count({ where: { userId } })
  ]);

  return {
    likes: likes.map(like => like.blog),
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
};

// Get user's comments
export const getUserComments = async (userId, page = 1, limit = 10) => {
  const skip = (page - 1) * limit;
  
  const [comments, total] = await Promise.all([
    prisma.comment.findMany({
      where: { authorId: userId, isActive: true },
      skip,
      take: parseInt(limit),
      include: {
        blog: {
          select: {
            id: true,
            title: true,
            slug: true,
            type: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.comment.count({ where: { authorId: userId, isActive: true } })
  ]);

  return {
    comments,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
};

// Get all users (admin only)
export const getAllUsers = async (page = 1, limit = 10) => {
  const cacheKey = CACHE_KEYS.usersList(page, limit);
  const cachedUsers = await getCache(cacheKey);

  if (cachedUsers) {
    return cachedUsers;
  }

  const skip = (page - 1) * limit;
  
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      skip,
      take: parseInt(limit),
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        bio: true,
        avatar: true,
        role: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: {
            blogs: true,
            comments: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.user.count()
  ]);

  const result = {
    users,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit)
    }
  };

  await setCache(cacheKey, result, CACHE_TTL.SHORT);

  return result;
};

// Update user (admin only)
export const updateUser = async (id, data) => {
  const user = await prisma.user.update({
    where: { id },
    data,
    select: {
      id: true,
      email: true,
      username: true,
      name: true,
      bio: true,
      avatar: true,
      role: true,
      isActive: true,
      updatedAt: true,
    },
  });

  await Promise.all([
    invalidateUserProfile(id),
    invalidateUsersList(),
  ]);

  return user;
};