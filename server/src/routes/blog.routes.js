import express from 'express';
import {
  createBlogController,
  getBlogsController,
  getBlogController,
  updateBlogController,
  deleteBlogController,
  getBlogStatsController
} from '../controllers/blog.controller.js';
import {
  createCommentController,
  updateCommentController,
  deleteCommentController,
  getBlogCommentsController
} from '../controllers/comment.controller.js';
import {
  toggleLikeController,
  checkLikeController,
  getLikesCountController
} from '../controllers/like.controller.js';
import {
  createReportController
} from '../controllers/report.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.get('/', getBlogsController);
router.get('/:id', getBlogController);
router.get('/:blogId/comments', getBlogCommentsController);
router.get('/:blogId/likes/count', getLikesCountController);

// Protected routes (require authentication)
router.use(authenticate);

// User actions
router.post('/:blogId/likes', toggleLikeController);
router.get('/:blogId/likes/check', checkLikeController);
router.post('/:blogId/comments', createCommentController);
router.post('/:blogId/reports', createReportController);

// Comment management (owner only)
router.put('/:blogId/comments/:commentId', updateCommentController);
router.delete('/:blogId/comments/:commentId', deleteCommentController);

// Admin routes - NO upload middleware needed!
router.post('/', authorize('ADMIN'), createBlogController);
router.put('/:id', authorize('ADMIN'), updateBlogController);
router.delete('/:id', authorize('ADMIN'), deleteBlogController);
router.get('/stats/dashboard', authorize('ADMIN'), getBlogStatsController);

export default router;