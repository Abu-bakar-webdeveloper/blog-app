import {
  getUserProfile,
  getUserLikes,
  getUserComments,
  getAllUsers,
  updateUser
} from '../services/user.service.js';

// Get user profile
export const getProfileController = async (req, res) => {
  try {
    const user = await getUserProfile(req.params.userId || req.user.id);
    
    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(404).json({ 
      success: false,
      error: error.message 
    });
  }
};

// Get user's liked blogs
export const getLikedBlogsController = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const userId = req.params.userId || req.user.id;
    
    const result = await getUserLikes(userId, page, limit);
    
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

// Get user's comments
export const getUserCommentsController = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const userId = req.params.userId || req.user.id;
    
    const result = await getUserComments(userId, page, limit);
    
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

// Get all users (Admin only)
export const getAllUsersController = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    const result = await getAllUsers(page, limit);
    
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

// Update user (Admin only)
export const updateUserController = async (req, res) => {
  try {
    const { name, bio, role, isActive } = req.body;
    
    const user = await updateUser(req.params.id, {
      name,
      bio,
      role,
      isActive
    });
    
    res.json({
      success: true,
      message: 'User updated successfully',
      data: user,
    });
  } catch (error) {
    res.status(400).json({ 
      success: false,
      error: error.message 
    });
  }
};