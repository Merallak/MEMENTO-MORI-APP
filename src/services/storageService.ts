import { supabase } from "@/integrations/supabase/client";

/**
 * Storage Service for Token Images & Avatars
 */

const TOKEN_BUCKET_NAME = "MEMENTO MORI APP TOKEN IMAGES";
const AVATAR_BUCKET_NAME = "avatars"; 
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_FILE_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"];

interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * Validates image file before upload
 */
function validateImageFile(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: "Formato no soportado. Usa JPG, PNG, WebP o GIF.",
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: "La imagen es demasiado grande. Máximo 2MB.",
    };
  }

  return { valid: true };
}

/**
 * Generates unique filename with timestamp and user ID
 */
function generateFileName(userId: string, originalName: string): string {
  const timestamp = Date.now();
  const extension = originalName.split(".").pop() || "png";
  const sanitizedName = originalName
    .split(".")[0]
    .replace(/[^a-zA-Z0-9]/g, "_")
    .substring(0, 20);
  return `${userId}_${timestamp}_${sanitizedName}.${extension}`;
}

/**
 * Uploads token image to Supabase Storage
 */
export async function uploadTokenImage(
  file: File,
  userId: string
): Promise<UploadResult> {
  return uploadFileToBucket(file, userId, TOKEN_BUCKET_NAME);
}

/**
 * Uploads user avatar to Supabase Storage
 */
export async function uploadAvatarImage(
  file: File,
  userId: string
): Promise<UploadResult> {
  return uploadFileToBucket(file, userId, AVATAR_BUCKET_NAME);
}

/**
 * Generic upload function
 */
async function uploadFileToBucket(
  file: File,
  userId: string,
  bucketName: string
): Promise<UploadResult> {
  try {
    // Validate file
    const validation = validateImageFile(file);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Generate unique filename
    const fileName = generateFileName(userId, file.name);
    // IMPORTANTE: La estructura de carpeta debe coincidir con la política RLS (auth.uid())
    const filePath = `${userId}/${fileName}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      console.error(`Storage upload error (${bucketName}):`, error);
      return {
        success: false,
        error: "Error al subir la imagen. Intenta de nuevo.",
      };
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from(bucketName).getPublicUrl(data.path);

    return {
      success: true,
      url: publicUrl,
    };
  } catch (error) {
    console.error("Unexpected upload error:", error);
    return {
      success: false,
      error: "Error inesperado al subir la imagen.",
    };
  }
}

/**
 * Deletes image from Storage
 */
export async function deleteImage(imageUrl: string, bucketName: string = TOKEN_BUCKET_NAME): Promise<boolean> {
  try {
    const urlParts = imageUrl.split(`/${bucketName}/`);
    if (urlParts.length < 2) return false;

    const filePath = urlParts[1];
    const { error } = await supabase.storage.from(bucketName).remove([filePath]);

    if (error) {
      console.error("Storage delete error:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Unexpected delete error:", error);
    return false;
  }
}

// Retrocompatibilidad
export const deleteTokenImage = (url: string) => deleteImage(url, TOKEN_BUCKET_NAME);