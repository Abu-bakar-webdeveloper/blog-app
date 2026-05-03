import { generateUploadSignature, generateSignatures, verifySignature } from '../services/signature.service.js';

/**
 * @route   POST /api/upload/signature
 * @desc    Generate Cloudinary upload signature for client
 * @access  Private (Authenticated users only)
 */
export const getUploadSignature = async (req, res) => {
  try {
    const { purpose, folder, tags } = req.body;
    const userId = req.user.id;
    
    // Rate limiting check (optional)
    // You can implement rate limiting here
    
    let signatureData;
    
    // Generate signature based on purpose
    switch (purpose) {
      case 'blog':
        signatureData = generateSignatures.blogImage();
        break;
      case 'avatar':
        signatureData = generateSignatures.userAvatar();
        break;
      case 'featured':
        signatureData = generateSignatures.featuredImage();
        break;
      default:
        // Custom signature
        signatureData = generateUploadSignature({
          folder: folder || 'blog_app/uploads',
          tags: tags ? tags.split(',') : ['upload', `user_${userId}`],
          context: {
            user_id: userId,
            purpose: purpose || 'general',
            uploaded_at: new Date().toISOString()
          }
        });
    }
    
    // Add user info to response (optional)
    signatureData.user_id = userId;
    
    res.json({
      success: true,
      message: 'Upload signature generated',
      data: signatureData,
      // Client will use these to upload directly to Cloudinary
      upload_url: `https://api.cloudinary.com/v1_1/${signatureData.cloud_name}/upload`,
      upload_method: 'POST'
    });
  } catch (error) {
    console.error('Signature generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate upload signature'
    });
  }
};

/**
 * @route   POST /api/upload/verify
 * @desc    Verify uploaded image signature (for security)
 * @access  Private
 */
export const verifyUploadSignature = async (req, res) => {
  try {
    const { public_id, version, signature } = req.body;
    
    if (!public_id || !version || !signature) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters'
      });
    }
    
    const isValid = verifySignature(public_id, version, signature);
    
    res.json({
      success: true,
      data: { isValid },
      message: isValid ? 'Signature verified' : 'Invalid signature'
    });
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Verification failed'
    });
  }
};

/**
 * @route   GET /api/upload/config
 * @desc    Get upload configuration for client
 * @access  Public (or Private based on your needs)
 */
export const getUploadConfig = async (req, res) => {
  try {
    const config = {
      max_file_size: 5 * 1024 * 1024, // 5MB
      allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
      max_files: 10, // Maximum files per upload
      upload_endpoint: 'https://api.cloudinary.com/v1_1/upload',
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      // Note: NO API_SECRET exposed!
    };
    
    res.json({
      success: true,
      data: config,
      message: 'Upload configuration'
    });
  } catch (error) {
    console.error('Config error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get upload config'
    });
  }
};

/**
 * @route   POST /api/upload/webhook
 * @desc    Cloudinary webhook for upload notifications (optional)
 * @access  Public (Cloudinary calls this)
 */
export const handleWebhook = async (req, res) => {
  try {
    const webhookData = req.body;
    
    // Verify webhook signature (important for security)
    const signature = req.headers['x-cld-signature'];
    const timestamp = req.headers['x-cld-timestamp'];
    
    if (!signature || !timestamp) {
      return res.status(400).json({ error: 'Missing signature' });
    }
    
    // Verify signature logic here (optional)
    
    console.log('Cloudinary webhook received:', {
      event: webhookData.notification_type,
      public_id: webhookData.public_id,
      url: webhookData.secure_url,
      user_id: webhookData.context?.user_id
    });
    
    // You can update database or trigger other actions here
    
    res.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};