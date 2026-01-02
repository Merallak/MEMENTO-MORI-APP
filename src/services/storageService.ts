import { supabase } from "@/integrations/supabase/client";

/**
 * Storage Service for Token Images
 * Handles uploading and managing token images in Supabase Storage
 */

const BUCKET_NAME = "MEMENTO MORI APP TOKEN IMAGES";
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
 * @param file - Image file to upload
 * @param userId - Current user ID
 * @returns Object with success status and public URL
 */
export async function uploadTokenImage(
  file: File,
  userId: string
): Promise<UploadResult> {
  try {
    // Validate file
    const validation = validateImageFile(file);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Generate unique filename
    const fileName = generateFileName(userId, file.name);
    const filePath = `${userId}/${fileName}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      console.error("Storage upload error:", error);
      return {
        success: false,
        error: "Error al subir la imagen. Intenta de nuevo.",
      };
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from(BUCKET_NAME).getPublicUrl(data.path);

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
 * Deletes token image from Storage (optional cleanup)
 */
export async function deleteTokenImage(imageUrl: string): Promise<boolean> {
  try {
    // Extract path from URL
    const urlParts = imageUrl.split(`/${BUCKET_NAME}/`);
    if (urlParts.length < 2) return false;

    const filePath = urlParts[1];

    const { error } = await supabase.storage.from(BUCKET_NAME).remove([filePath]);

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