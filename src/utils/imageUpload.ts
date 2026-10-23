import { getSupabaseClient } from '../services/supabase';

export interface ProcessedImageResult {
  url: string;
  source: 'supabase-storage' | 'optimized-base64';
  sizeKb: number;
}

/**
 * Compresses and resizes an image file in the browser using HTML5 Canvas.
 * Keeps avatar sizes under ~40-60KB for lightning-fast database sync and mobile rendering.
 */
export async function compressImageFile(
  file: File,
  maxWidth = 400,
  maxHeight = 400,
  quality = 0.82
): Promise<{ dataUrl: string; blob: Blob; sizeKb: number }> {
  return new Promise((resolve, reject) => {
    // Validate that it is an image
    if (!file.type.startsWith('image/')) {
      reject(new Error('El archivo seleccionado no es una imagen válida.'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Error al leer el archivo de imagen.'));
    reader.onload = e => {
      const img = new Image();
      img.onerror = () => reject(new Error('No se pudo procesar la imagen seleccionada.'));
      img.onload = () => {
        // Calculate new dimensions preserving aspect ratio
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('No se pudo inicializar el procesador de imágenes.'));
          return;
        }

        // Draw image onto canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Try WebP first, fallback to JPEG
        let mimeType = 'image/webp';
        let dataUrl = canvas.toDataURL(mimeType, quality);
        if (!dataUrl.startsWith('data:image/webp')) {
          mimeType = 'image/jpeg';
          dataUrl = canvas.toDataURL(mimeType, quality);
        }

        canvas.toBlob(
          blob => {
            if (!blob) {
              // Fallback blob from base64
              const byteString = atob(dataUrl.split(',')[1]);
              const ab = new ArrayBuffer(byteString.length);
              const ia = new Uint8Array(ab);
              for (let i = 0; i < byteString.length; i++) {
                ia[i] = byteString.charCodeAt(i);
              }
              blob = new Blob([ab], { type: mimeType });
            }

            const sizeKb = Math.round((blob.size / 1024) * 10) / 10;
            resolve({ dataUrl, blob, sizeKb });
          },
          mimeType,
          quality
        );
      };

      img.src = e.target?.result as string;
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Handles doctor photo upload:
 * 1. Resizes & compresses the image in the browser (< 50KB).
 * 2. If Supabase is connected, attempts to upload to the 'doctor-photos' Storage bucket.
 * 3. If bucket is not created or Supabase is in local mode, gracefully returns the optimized Base64 data URL.
 */
export async function uploadDoctorPhoto(
  file: File,
  doctorId?: string
): Promise<ProcessedImageResult> {
  const { dataUrl, blob, sizeKb } = await compressImageFile(file, 400, 400, 0.82);

  const client = getSupabaseClient();
  if (!client) {
    // Offline / Local storage mode
    return {
      url: dataUrl,
      source: 'optimized-base64',
      sizeKb,
    };
  }

  try {
    const cleanId = doctorId ? doctorId.replace(/[^a-zA-Z0-9_-]/g, '') : Date.now().toString();
    const randomSuffix = Math.random().toString(36).substring(2, 7);
    const fileName = `doc_${cleanId}_${randomSuffix}.webp`;

    // Attempt upload to Supabase Storage bucket 'doctor-photos'
    const { error: uploadError } = await client.storage
      .from('doctor-photos')
      .upload(fileName, blob, {
        contentType: 'image/webp',
        upsert: true,
      });

    if (!uploadError) {
      const { data } = client.storage.from('doctor-photos').getPublicUrl(fileName);
      if (data?.publicUrl) {
        return {
          url: data.publicUrl,
          source: 'supabase-storage',
          sizeKb,
        };
      }
    } else {
      console.info(
        'Supabase Storage bucket "doctor-photos" no está configurado o requiere políticas. Usando imagen optimizada en base de datos:',
        uploadError.message
      );
    }
  } catch (err) {
    console.warn('Could not upload to Supabase Storage, falling back to optimized base64 data URL:', err);
  }

  // Graceful, 100% reliable fallback: optimized Base64 stored directly in the database
  return {
    url: dataUrl,
    source: 'optimized-base64',
    sizeKb,
  };
}
