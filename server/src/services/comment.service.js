import prisma from '../models/index.js';
import {
  CACHE_KEYS,
  CACHE_TTL,
  getCache,
  setCache,
  invalidateBlogComments,
  invalidateBlogCaches,
  invalidateBlogStats,
} from '../utils/cache.js';

// Add comment to blog (user)
export const createComment = async (blogId, content, userId) => {
  // Check if blog exists and is published
  const blog = await prisma.blog.findUnique({
    where: { id: blogId, isPublished: true }
  });

  if (!blog) {
    throw new Error('Blog not found or not published');
  }

  const comment = await prisma.comment.create({
    data: {
      content,
      blogId,
      authorId: userId,
    },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          username: true,
          avatar: true,
        }
      },
      blog: {
        select: {
          id: true,
          title: true,
          slug: true,
          authorId: true,
        }
      }
    }
  });

  await Promise.all([
    invalidateBlogComments(blogId),
    invalidateBlogCaches(comment.blog),
    invalidateBlogStats(),
  ]);

  return comment;
};

// Update comment (owner only)
export const updateComment = async (commentId, content, userId) => {
  // Check if comment exists and user is the author
  const comment = await prisma.comment.findFirst({
    where: { 
      id: commentId,
      authorId: userId,
      isActive: true
    }
  });

  if (!comment) {
    throw new Error('Comment not found or you are not authorized to update it');
  }

  const updatedComment = await prisma.comment.update({
    where: { id: commentId },
    data: { content },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          username: true,
          avatar: true,
        }
      },
      blog: {
        select: {
          id: true,
          slug: true,
          authorId: true,
        }
      }
    }
  });

  await Promise.all([
    invalidateBlogComments(updatedComment.blogId),
    invalidateBlogCaches(updatedComment.blog),
    invalidateBlogStats(),
  ]);

  return updatedComment;
};

// Delete comment (owner or admin)
export const deleteComment = async (commentId, userId, isAdmin = false) => {
  const existingComment = await prisma.comment.findUnique({
    where: { id: commentId },
    include: {
      blog: {
        select: {
          id: true,
          slug: true,
          authorId: true,
        }
      }
    }
  });

  if (!existingComment) {
    throw new Error('Comment not found or you are not authorized to delete it');
  }

  if (!isAdmin && existingComment.authorId !== userId) {
    throw new Error('Comment not found or you are not authorized to delete it');
  }

  const deletedComment = isAdmin
    ? await prisma.comment.delete({ where: { id: commentId } })
    : await prisma.comment.update({
        where: { id: commentId },
        data: { isActive: false },
      });

  await Promise.all([
    invalidateBlogComments(existingComment.blogId),
    invalidateBlogCaches(existingComment.blog),
    invalidateBlogStats(),
  ]);

  return deletedComment;
};

// Get comments for a blog with pagination
export const getBlogComments = async (blogId, page = 1, limit = 10) => {
  const cacheKey = CACHE_KEYS.blogComments(blogId, page, limit);
  const cachedComments = await getCache(cacheKey);

  if (cachedComments) {
    return cachedComments;
  }

  const skip = (page - 1) * limit;
  
  const [comments, total] = await Promise.all([
    prisma.comment.findMany({
      where: { 
        blogId,
        isActive: true 
      },
      skip,
      take: parseInt(limit),
      include: {
        author: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    }),
    prisma.comment.count({ 
      where: { 
        blogId,
        isActive: true 
      } 
    })
  ]);

  const result = {
    comments,
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