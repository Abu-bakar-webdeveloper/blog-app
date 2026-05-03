import prisma from '../models/index.js';

// Get user profile by ID
export const getUserProfile = async (userId) => {
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

  return {
    users,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
};

// Update user (admin only)
export const updateUser = async (id, data) => {
  return await prisma.user.update({
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
};