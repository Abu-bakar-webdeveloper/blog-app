import express from 'express';
import {
  getUploadSignature,
  verifyUploadSignature,
  getUploadConfig,
  handleWebhook
} from '../controllers/upload.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.get('/config', getUploadConfig);
router.post('/webhook', handleWebhook); // Cloudinary calls this

// Protected routes (require authentication)
router.use(authenticate);

// Generate signature for client upload
router.post('/signature', getUploadSignature);

// Verify uploaded image
router.post('/verify', verifyUploadSignature);

export default router;