/**
 * Cloudinary Configuration for MarketKoro
 *
 * NOTE: Only client-side public Cloud Name and Unsigned Upload Preset should be configured here.
 * NEVER put the Cloudinary API Secret or API Key in frontend code or repository.
 */

export const cloudinaryConfig = {
  cloudName: "marketkoro-cloud-placeholder",
  uploadPreset: "marketkoro_unsigned_preset_placeholder",
  folder: "marketkoro_products",
  maxFileSize: 2 * 1024 * 1024, // 2MB
  targetDimension: { width: 500, height: 500 }
};

export const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`;
