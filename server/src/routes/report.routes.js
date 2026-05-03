import express from 'express';
import {
  getAllReportsController,
  updateReportStatusController,
  getReportStatsController
} from '../controllers/report.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Admin only routes
router.use(authenticate);
router.use(authorize('ADMIN'));

router.get('/', getAllReportsController);
router.put('/:reportId/status', updateReportStatusController);
router.get('/stats', getReportStatsController);

export default router;