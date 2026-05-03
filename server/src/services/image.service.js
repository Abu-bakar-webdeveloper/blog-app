import { v2 as cloudinary } from 'cloudinary';
import {
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET,
  NODE_ENV
} from '../config/index.js';

// Configure Cloudinary
cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
  secure: true
});

/**
 * Delete image from Cloudinary
 */
export const deleteImage = async (publicId) => {
  try {
    if (!publicId) return { result: 'not_found' };
    
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    // Don't throw - fail silently for deletions
    return { result: 'not_found' };
  }
};

/**
 * Extract public_id from Cloudinary URL
 */
export const extractPublicId = (url) => {
  if (!url || !url.includes('cloudinary.com')) return null;
  
  try {
    // Remove protocol and domain
    const urlWithoutProtocol = url.replace(/^https?:\/\//, '');
    
    // Find the part after /upload/
    const uploadIndex = urlWithoutProtocol.indexOf('/upload/');
    if (uploadIndex === -1) return null;
    
    // Get everything after /upload/
    const afterUpload = urlWithoutProtocol.substring(uploadIndex + 8); // 8 = length of '/upload/'
    
    // Split by '/' and get the last part without extension
    const parts = afterUpload.split('/');
    const lastPart = parts[parts.length - 1];
    
    // Remove file extension
    const publicIdWithFolder = lastPart.split('.')[0];
    
    // If there are folders, reconstruct the full public_id
    if (parts.length > 1) {
      const folderParts = parts.slice(0, parts.length - 1);
      return `${folderParts.join('/')}/${publicIdWithFolder}`;
    }
    
    return publicIdWithFolder;
  } catch (error) {
    console.error('Error extracting public_id:', error);
    return null;
  }
};

/**
 * Transform image URL with Cloudinary transformations
 */
export const getTransformedUrl = (url, transformations = {}) => {
  if (!url || !url.includes('cloudinary.com')) return url;
  
  const { width, height, crop = 'fill', quality = 'auto', gravity = 'auto' } = transformations;
  
  if (!width && !height) return url;
  
  try {
    // Insert transformations into URL
    const parts = url.split('/upload/');
    if (parts.length !== 2) return url;
    
    const transformationString = `w_${width || 'auto'},h_${height || 'auto'},c_${crop},q_${quality},g_${gravity}`;
    
    return `${parts[0]}/upload/${transformationString}/${parts[1]}`;
  } catch (error) {
    console.error('Error transforming URL:', error);
    return url;
  }
};

/**
 * Validate if URL is a Cloudinary URL
 */
export const isCloudinaryUrl = (url) => {
  return url && url.includes('cloudinary.com');
};

/**
 * Clean up old images (for testing/development)
 */
export const cleanupTestImages = async (folder = 'blog_app') => {
  if (NODE_ENV !== 'development') {
    throw new Error('Cleanup only allowed in development');
  }
  
  try {
    const result = await cloudinary.api.delete_resources_by_prefix(`${folder}/`);
    return result;
  } catch (error) {
    console.error('Cleanup error:', error);
    throw error;
  }
};