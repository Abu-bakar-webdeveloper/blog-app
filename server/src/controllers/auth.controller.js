import { register, login, updateProfile } from '../services/auth.service.js';

export const registerController = async (req, res) => {
  try {
    const { email, password, username, name, bio, avatar } = req.body;
    
    if (!email || !password || !username) {
      return res.status(400).json({ 
        success: false,
        error: 'Email, password, and username are required' 
      });
    }

    const result = await register({ 
      email, 
      password, 
      username, 
      name, 
      bio,
      avatar 
    });
    
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: result,
    });
  } catch (error) {
    res.status(400).json({ 
      success: false,
      error: error.message 
    });
  }
};

export const loginController = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ 
        success: false,
        error: 'Email and password are required' 
      });
    }

    const result = await login(email, password);
    
    res.json({
      success: true,
      message: 'Login successful',
      data: result,
    });
  } catch (error) {
    res.status(401).json({ 
      success: false,
      error: error.message 
    });
  }
};

export const getProfileController = async (req, res) => {
  try {
    res.json({
      success: true,
      data: req.user,
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

export const updateProfileController = async (req, res) => {
  try {
    const { name, bio, avatar } = req.body;
    
    // Handle avatar upload
    if (req.file) {
      avatar = `/uploads/${req.file.filename}`;
    }

    const updatedUser = await updateProfile(req.user.id, {
      name,
      bio,
      avatar
    });
    
    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedUser,
    });
  } catch (error) {
    res.status(400).json({ 
      success: false,
      error: error.message 
    });
  }
};