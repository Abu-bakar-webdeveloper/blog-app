import {
  createBlog,
  getBlogs,
  getBlogById,
  updateBlog,
  deleteBlog,
  getBlogStats
} from '../services/blog.service.js';

// Create blog (Admin only) - Now expects Cloudinary URL
export const createBlogController = async (req, res) => {
  try {
    const { 
      title, 
      content, 
      excerpt, 
      type, 
      tags, 
      isPublished, 
      isFeatured,
      imageUrl // Cloudinary URL from client
    } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({ 
        success: false,
        error: 'Title and content are required' 
      });
    }

    const tagsArray = tags ? (Array.isArray(tags) ? tags : tags.split(',')) : [];

    const blog = await createBlog(
      { 
        title, 
        content, 
        excerpt, 
        type: type || 'GENERAL', 
        tags: tagsArray, 
        isPublished: isPublished === 'true',
        isFeatured: isFeatured === 'true'
      },
      req.user.id,
      imageUrl // Pass Cloudinary URL
    );
    
    res.status(201).json({
      success: true,
      message: 'Blog created successfully',
      data: blog,
    });
  } catch (error) {
    res.status(400).json({ 
      success: false,
      error: error.message 
    });
  }
};

// Get all blogs with filters and pagination
export const getBlogsController = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    // Build filters
    const filters = {
      type: req.query.type,
      tags: req.query.tags,
      search: req.query.search,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      isFeatured: req.query.featured,
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder || 'desc',
    };

    // Admin can see unpublished blogs
    if (req.user?.role === 'ADMIN' && req.query.includeUnpublished) {
      filters.includeUnpublished = req.query.includeUnpublished;
    }
    
    const result = await getBlogs(filters, page, limit);
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

// Get single blog
export const getBlogController = async (req, res) => {
  try {
    const blog = await getBlogById(req.params.id);
    
    if (!blog) {
      return res.status(404).json({ 
        success: false,
        error: 'Blog not found' 
      });
    }

    // If blog is not published, only admin or author can see it
    if (!blog.isPublished) {
      if (!req.user || (req.user.role !== 'ADMIN' && blog.authorId !== req.user.id)) {
        return res.status(403).json({ 
          success: false,
          error: 'You do not have permission to view this blog' 
        });
      }
    }
    
    res.json({
      success: true,
      data: blog,
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

// Update blog (Admin only) - Now expects Cloudinary URL
export const updateBlogController = async (req, res) => {
  try {
    const { 
      title, 
      content, 
      excerpt, 
      type, 
      tags, 
      isPublished, 
      isFeatured,
      imageUrl // Cloudinary URL from client (null to remove)
    } = req.body;

    const updateData = {};
    if (title) updateData.title = title;
    if (content) updateData.content = content;
    if (excerpt !== undefined) updateData.excerpt = excerpt;
    if (type) updateData.type = type;
    if (tags) updateData.tags = Array.isArray(tags) ? tags : tags.split(',');
    if (isPublished !== undefined) updateData.isPublished = isPublished === 'true';
    if (isFeatured !== undefined) updateData.isFeatured = isFeatured === 'true';

    const blog = await updateBlog(
      req.params.id, 
      updateData, 
      imageUrl
    );
    
    res.json({
      success: true,
      message: 'Blog updated successfully',
      data: blog,
    });
  } catch (error) {
    res.status(400).json({ 
      success: false,
      error: error.message 
    });
  }
};

// Delete blog (Admin only)
export const deleteBlogController = async (req, res) => {
  try {
    await deleteBlog(req.params.id);
    
    res.json({
      success: true,
      message: 'Blog deleted successfully',
    });
  } catch (error) {
    res.status(400).json({ 
      success: false,
      error: error.message 
    });
  }
};

// Get blog statistics (Admin only)
export const getBlogStatsController = async (req, res) => {
  try {
    const stats = await getBlogStats();
    
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};