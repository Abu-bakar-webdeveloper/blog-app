import prisma from '../models/index.js';

// Like/Unlike a blog
export const toggleLike = async (blogId, userId) => {
  // Check if blog exists and is published
  const blog = await prisma.blog.findUnique({
    where: { id: blogId, isPublished: true }
  });

  if (!blog) {
    throw new Error('Blog not found or not published');
  }

  // Check if already liked
  const existingLike = await prisma.like.findUnique({
    where: {
      blogId_userId: {
        blogId,
        userId
      }
    }
  });

  if (existingLike) {
    // Unlike
    await prisma.like.delete({
      where: {
        blogId_userId: {
          blogId,
          userId
        }
      }
    });
    return { liked: false };
  } else {
    // Like
    await prisma.like.create({
      data: {
        blogId,
        userId
      }
    });
    return { liked: true };
  }
};

// Check if user liked a blog
export const checkLike = async (blogId, userId) => {
  const like = await prisma.like.findUnique({
    where: {
      blogId_userId: {
        blogId,
        userId
      }
    }
  });

  return { liked: !!like };
};

// Get likes count for a blog
export const getLikesCount = async (blogId) => {
  return await prisma.like.count({
    where: { blogId }
  });
};