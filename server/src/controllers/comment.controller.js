import {
  createComment,
  updateComment,
  deleteComment,
  getBlogComments
} from '../services/comment.service.js';

// Add comment to blog
export const createCommentController = async (req, res) => {
  try {
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ 
        success: false,
        error: 'Comment content is required' 
      });
    }

    const comment = await createComment(
      req.params.blogId,
      content,
      req.user.id
    );
    
    res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      data: comment,
    });
  } catch (error) {
    res.status(400).json({ 
      success: false,
      error: error.message 
    });
  }
};

// Update comment
export const updateCommentController = async (req, res) => {
  try {
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ 
        success: false,
        error: 'Comment content is required' 
      });
    }

    const comment = await updateComment(
      req.params.commentId,
      content,
      req.user.id
    );
    
    res.json({
      success: true,
      message: 'Comment updated successfully',
      data: comment,
    });
  } catch (error) {
    res.status(400).json({ 
      success: false,
      error: error.message 
    });
  }
};

// Delete comment
export const deleteCommentController = async (req, res) => {
  try {
    await deleteComment(
      req.params.commentId,
      req.user.id,
      req.user.role === 'ADMIN'
    );
    
    res.json({
      success: true,
      message: 'Comment deleted successfully',
    });
  } catch (error) {
    res.status(400).json({ 
      success: false,
      error: error.message 
    });
  }
};

// Get comments for a blog
export const getBlogCommentsController = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    const result = await getBlogComments(
      req.params.blogId,
      page,
      limit
    );
    
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