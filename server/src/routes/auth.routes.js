import express from 'express';
import {
  registerController,
  loginController,
  getProfileController,
  updateProfileController
} from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.post('/register', registerController);
router.post('/login', loginController);

// Protected routes
router.get('/profile', authenticate, getProfileController);
router.put('/profile', authenticate, updateProfileController);

export default router;