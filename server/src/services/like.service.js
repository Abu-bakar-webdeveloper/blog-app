import prisma from '../models/index.js';
import {
  CACHE_KEYS,
  CACHE_TTL,
  getCache,
  setCache,
  invalidateBlogLikesCount,
  invalidateBlogCaches,
  invalidateBlogListCaches,
  invalidateBlogStats,
  invalidateUserProfile,
} from '../utils/cache.js';

// Like/Unlike a blog
export const toggleLike = async (blogId, userId) => {
  // Check if blog exists and is published
  const blog = await prisma.blog.findUnique({
    where: { id: blogId, isPublished: true },
    select: { id: true, slug: true, authorId: true },
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
    await prisma.like.delete({
      where: {
        blogId_userId: {
          blogId,
          userId
        }
      }
    });

    await Promise.all([
      invalidateBlogLikesCount(blogId),
      invalidateBlogCaches(blog),
      invalidateBlogListCaches(),
      invalidateBlogStats(),
      invalidateUserProfile(userId),
    ]);

    return { liked: false };
  }

  await prisma.like.create({
    data: {
      blogId,
      userId
    }
  });

  await Promise.all([
    invalidateBlogLikesCount(blogId),
    invalidateBlogCaches(blog),
    invalidateBlogListCaches(),
    invalidateBlogStats(),
    invalidateUserProfile(userId),
  ]);

  return { liked: true };
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
  const cacheKey = CACHE_KEYS.blogLikesCount(blogId);
  const cachedCount = await getCache(cacheKey);

  if (cachedCount !== null) {
    return cachedCount;
  }

  const count = await prisma.like.count({
    where: { blogId }
  });

  await setCache(cacheKey, count, CACHE_TTL.SHORT);

  return count;
};