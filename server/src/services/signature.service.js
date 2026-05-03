import { v2 as cloudinary } from 'cloudinary';
import {
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET
} from '../config/index.js';

// Configure Cloudinary
cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
  secure: true
});

/**
 * Generate upload signature for client-side direct upload
 * This is the SECRET part - only server has the API_SECRET
 */
export const generateUploadSignature = (options = {}) => {
  try {
    const {
      folder = 'blog_app',
      public_id = null,
      overwrite = false,
      tags = [],
      context = {}
    } = options;

    const timestamp = Math.round(Date.now() / 1000);
    
    // Parameters for signature
    const params = {
      timestamp,
      folder,
      allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
      max_file_size: 5242880, // 5MB in bytes
      resource_type: 'image',
      invalidate: true, // CDN cache invalidation
    };

    // Add optional parameters
    if (public_id) {
      params.public_id = public_id;
    }
    
    if (overwrite) {
      params.overwrite = overwrite;
    }
    
    if (tags.length > 0) {
      params.tags = tags.join(',');
    }
    
    if (Object.keys(context).length > 0) {
      params.context = Object.entries(context)
        .map(([key, value]) => `${key}=${value}`)
        .join('|');
    }

    // Generate signature using API_SECRET (NEVER expose this to client!)
    const signature = cloudinary.utils.api_sign_request(params, CLOUDINARY_API_SECRET);
    
    return {
      signature,
      timestamp,
      cloud_name: CLOUDINARY_CLOUD_NAME,
      api_key: CLOUDINARY_API_KEY,
      folder,
      ...params
    };
  } catch (error) {
    console.error('Error generating signature:', error);
    throw new Error('Failed to generate upload signature');
  }
};

/**
 * Generate signature for specific upload widget (with more options)
 */
export const generateWidgetSignature = (params = {}) => {
  const timestamp = Math.round(Date.now() / 1000);
  
  const defaultParams = {
    timestamp,
    source: 'uw', // Upload widget
    upload_preset: null, // Optional: use upload preset if configured
    ...params
  };

  const signature = cloudinary.utils.api_sign_request(
    defaultParams, 
    CLOUDINARY_API_SECRET
  );

  return {
    signature,
    timestamp,
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    ...defaultParams
  };
};

/**
 * Verify a signature (for security validation)
 */
export const verifySignature = (publicId, version, signature) => {
  try {
    const expectedSignature = cloudinary.utils.api_sign_request(
      { public_id: publicId, version },
      CLOUDINARY_API_SECRET
    );
    
    return expectedSignature === signature;
  } catch (error) {
    console.error('Signature verification failed:', error);
    return false;
  }
};

/**
 * Generate different signatures for different purposes
 */
export const generateSignatures = {
  // For blog images
  blogImage: () => generateUploadSignature({
    folder: 'blog_app/blogs',
    tags: ['blog', 'image'],
    context: { source: 'blog_upload' }
  }),
  
  // For user avatars
  userAvatar: () => generateUploadSignature({
    folder: 'blog_app/avatars',
    tags: ['avatar', 'profile'],
    context: { source: 'avatar_upload' }
  }),
  
  // For featured images
  featuredImage: () => generateUploadSignature({
    folder: 'blog_app/featured',
    tags: ['featured', 'banner'],
    context: { source: 'featured_upload' }
  })
};

export default cloudinary;