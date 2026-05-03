import express from 'express';
import {
  getProfileController,
  getLikedBlogsController,
  getUserCommentsController,
  getAllUsersController,
  updateUserController
} from '../controllers/user.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.get('/:userId/profile', getProfileController);

// Protected routes
router.use(authenticate);

// User's own data
router.get('/profile', getProfileController);
router.get('/likes', getLikedBlogsController);
router.get('/comments', getUserCommentsController);
router.get('/:userId/likes', getLikedBlogsController);
router.get('/:userId/comments', getUserCommentsController);

// Admin routes
router.get('/', authorize('ADMIN'), getAllUsersController);
router.put('/:id', authorize('ADMIN'), updateUserController);

export default router;