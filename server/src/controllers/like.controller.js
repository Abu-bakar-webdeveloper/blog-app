import {
  toggleLike,
  checkLike,
  getLikesCount
} from '../services/like.service.js';

// Toggle like on blog
export const toggleLikeController = async (req, res) => {
  try {
    const result = await toggleLike(
      req.params.blogId,
      req.user.id
    );
    
    const message = result.liked ? 'Blog liked' : 'Blog unliked';
    
    res.json({
      success: true,
      message,
      data: result,
    });
  } catch (error) {
    res.status(400).json({ 
      success: false,
      error: error.message 
    });
  }
};

// Check if user liked a blog
export const checkLikeController = async (req, res) => {
  try {
    const result = await checkLike(
      req.params.blogId,
      req.user.id
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

// Get likes count for a blog
export const getLikesCountController = async (req, res) => {
  try {
    const count = await getLikesCount(req.params.blogId);
    
    res.json({
      success: true,
      data: { count },
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};