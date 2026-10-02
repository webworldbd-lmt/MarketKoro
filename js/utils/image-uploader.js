/**
 * Image Upload & Validation Utility for MarketKoro
 * Handles file validation (2MB max, mime type check) and Cloudinary upload.
 */

import { cloudinaryConfig, CLOUDINARY_UPLOAD_URL } from '../../config/cloudinary.js';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
const MAX_FILE_SIZE = cloudinaryConfig.maxFileSize || 2 * 1024 * 1024; // 2 MB

/**
 * Validates an image File object
 * @param {File} file
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateImageFile(file) {
  if (!file) {
    return { valid: false, error: "No file selected." };
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) {
    return { valid: false, error: "Only JPEG, PNG, and WebP image formats are supported." };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: "Image file size exceeds maximum limit of 2 MB." };
  }

  return { valid: true };
}

/**
 * Uploads image file to Cloudinary or converts to data URL as fallback
 * @param {File} file
 * @returns {Promise<string>} Image URL
 */
export async function uploadImage(file) {
  const validation = validateImageFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Attempt Cloudinary upload if configuration is not a placeholder
  if (
    cloudinaryConfig.cloudName &&
    cloudinaryConfig.cloudName !== 'marketkoro-cloud-placeholder' &&
    cloudinaryConfig.uploadPreset &&
    cloudinaryConfig.uploadPreset !== 'marketkoro_unsigned_preset_placeholder'
  ) {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', cloudinaryConfig.uploadPreset);
      if (cloudinaryConfig.folder) {
        formData.append('folder', cloudinaryConfig.folder);
      }

      const response = await fetch(CLOUDINARY_UPLOAD_URL, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.error?.message || 'Cloudinary upload failed.');
      }

      const data = await response.json();
      return data.secure_url;
    } catch (err) {
      console.warn("Cloudinary upload failed, falling back to FileReader:", err);
    }
  }

  // Fallback: Read file as Data URL for local presentation/testing
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (e) => reject(new Error("Failed to read image file."));
    reader.readAsDataURL(file);
  });
}
