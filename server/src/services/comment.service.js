import prisma from '../models/index.js';

// Add comment to blog (user)
export const createComment = async (blogId, content, userId) => {
  // Check if blog exists and is published
  const blog = await prisma.blog.findUnique({
    where: { id: blogId, isPublished: true }
  });

  if (!blog) {
    throw new Error('Blog not found or not published');
  }

  return await prisma.comment.create({
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
        }
      }
    }
  });
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

  return await prisma.comment.update({
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
      }
    }
  });
};

// Delete comment (owner or admin)
export const deleteComment = async (commentId, userId, isAdmin = false) => {
  if (isAdmin) {
    // Admin can delete any comment
    return await prisma.comment.delete({
      where: { id: commentId }
    });
  } else {
    // User can only delete their own comments
    const comment = await prisma.comment.findFirst({
      where: { 
        id: commentId,
        authorId: userId
      }
    });

    if (!comment) {
      throw new Error('Comment not found or you are not authorized to delete it');
    }

    // Soft delete (set isActive to false)
    return await prisma.comment.update({
      where: { id: commentId },
      data: { isActive: false }
    });
  }
};

// Get comments for a blog with pagination
export const getBlogComments = async (blogId, page = 1, limit = 10) => {
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