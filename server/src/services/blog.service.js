import prisma from '../models/index.js';
import { deleteImage, extractPublicId } from './image.service.js';
import { getCache, setCache } from '../utils/cache.js';

// Generate slug from title
const generateSlug = (title) => {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

// CREATE - Create blog with Cloudinary URL
export const createBlog = async (data, userId, imageUrl = null) => {
  const slug = generateSlug(data.title);

  // Check if slug exists
  const existingBlog = await prisma.blog.findUnique({
    where: { slug }
  });

  if (existingBlog) {
    throw new Error('Blog with this title already exists');
  }

  return await prisma.blog.create({
    data: {
      ...data,
      slug,
      image: imageUrl,
      authorId: userId,
      publishedAt: data.isPublished ? new Date() : null,
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
      _count: {
        select: {
          comments: true,
          likes: true,
        }
      }
    }
  });
};

// READ - Get blogs with filters and pagination
export const getBlogs = async (filters = {}, page = 1, limit = 10) => {

  // Create unique cache key
  const cacheKey = `blogs:${JSON.stringify(filters)}:${page}:${limit}`;

  // Check Redis first
  const cachedBlogs = await getCache(cacheKey);

  if (cachedBlogs) {
    console.log("Serving blogs from Redis");

    return cachedBlogs;
  }

  const skip = (page - 1) * limit;

  // Build where clause
  const where = {
    isPublished: true, // Only show published blogs to non-admins
  };

  // Apply filters
  if (filters.type) {
    where.type = filters.type;
  }

  if (filters.tags && filters.tags.length > 0) {
    where.tags = {
      hasSome: Array.isArray(filters.tags) ? filters.tags : [filters.tags]
    };
  }

  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search, mode: 'insensitive' } },
      { content: { contains: filters.search, mode: 'insensitive' } },
      { excerpt: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  if (filters.startDate || filters.endDate) {
    where.createdAt = {};
    if (filters.startDate) {
      where.createdAt.gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      where.createdAt.lte = new Date(filters.endDate);
    }
  }

  if (filters.isFeatured !== undefined) {
    where.isFeatured = filters.isFeatured === 'true';
  }

  // Admin can see all blogs
  if (filters.includeUnpublished === 'true') {
    delete where.isPublished;
  }

  const [blogs, total] = await Promise.all([
    prisma.blog.findMany({
      where,
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
        },
        _count: {
          select: {
            comments: true,
            likes: true,
          }
        }
      },
      orderBy: {
        [filters.sortBy || 'createdAt']: filters.sortOrder || 'desc'
      }
    }),
    prisma.blog.count({ where })
  ]);

  // Increment views for fetched blogs
  if (blogs.length > 0) {
    await prisma.blog.updateMany({
      where: { id: { in: blogs.map(b => b.id) } },
      data: { views: { increment: 1 } }
    });
  }

  const result = {
    blogs,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page < Math.ceil(total / limit),
      hasPrevPage: page > 1
    },
    filters
  };

  // Store for 60 sec
  await setCache(cacheKey, result, 60);

  return result;
};

// READ - Get single blog by ID or slug
export const getBlogById = async (idOrSlug) => {
  const isCuid = idOrSlug.length === 25;

  const blog = await prisma.blog.findUnique({
    where: isCuid ? { id: idOrSlug } : { slug: idOrSlug },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          username: true,
          avatar: true,
          bio: true,
        }
      },
      comments: {
        where: { isActive: true },
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
        orderBy: { createdAt: 'desc' }
      },
      _count: {
        select: {
          likes: true,
          comments: true,
        }
      }
    }
  });

  if (blog) {
    // Increment view count
    await prisma.blog.update({
      where: { id: blog.id },
      data: { views: { increment: 1 } }
    });
  }

  return blog;
};

// UPDATE - Update blog with Cloudinary URL
export const updateBlog = async (id, data, newImageUrl = null) => {
  let slug;
  if (data.title) {
    slug = generateSlug(data.title);

    // Check if slug exists (excluding current blog)
    const existingBlog = await prisma.blog.findFirst({
      where: {
        slug,
        NOT: { id }
      }
    });

    if (existingBlog) {
      throw new Error('Blog with this title already exists');
    }
  }

  const updateData = { ...data };
  if (slug) updateData.slug = slug;

  if (data.isPublished && !data.publishedAt) {
    updateData.publishedAt = new Date();
  }

  // Handle image update
  if (newImageUrl !== undefined) {
    // Get current blog to delete old image
    const currentBlog = await prisma.blog.findUnique({
      where: { id },
      select: { image: true }
    });

    // Delete old image if exists and is different
    if (currentBlog?.image && currentBlog.image !== newImageUrl) {
      const publicId = extractPublicId(currentBlog.image);
      if (publicId) {
        await deleteImage(publicId);
      }
    }

    // Set new image URL (or null if removing)
    updateData.image = newImageUrl;
  }

  return await prisma.blog.update({
    where: { id },
    data: updateData,
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

// DELETE - Delete blog and its image
export const deleteBlog = async (id) => {
  // Get blog to delete its image
  const blog = await prisma.blog.findUnique({
    where: { id },
    select: { image: true }
  });

  // Delete image from Cloudinary if exists
  if (blog?.image) {
    const publicId = extractPublicId(blog.image);
    if (publicId) {
      await deleteImage(publicId);
    }
  }

  // Delete related data
  await Promise.all([
    prisma.comment.deleteMany({ where: { blogId: id } }),
    prisma.like.deleteMany({ where: { blogId: id } }),
    prisma.report.deleteMany({ where: { blogId: id } }),
  ]);

  return await prisma.blog.delete({
    where: { id }
  });
};

// Get blog statistics
export const getBlogStats = async () => {
  const [
    totalBlogs,
    publishedBlogs,
    totalViews,
    totalLikes,
    totalComments,
    blogsByType,
    recentBlogs
  ] = await Promise.all([
    prisma.blog.count(),
    prisma.blog.count({ where: { isPublished: true } }),
    prisma.blog.aggregate({ _sum: { views: true } }),
    prisma.like.count(),
    prisma.comment.count(),
    prisma.blog.groupBy({
      by: ['type'],
      _count: { id: true },
      where: { isPublished: true }
    }),
    prisma.blog.findMany({
      where: { isPublished: true },
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        type: true,
        views: true,
        createdAt: true,
        author: {
          select: {
            name: true,
            username: true,
          }
        }
      }
    })
  ]);

  return {
    totalBlogs,
    publishedBlogs,
    totalViews: totalViews._sum.views || 0,
    totalLikes,
    totalComments,
    blogsByType,
    recentBlogs
  };
};