export interface RegisteredAccount {
  id: string;
  email: string;
  phone: string;
  name: string;
  password: string;
  profile: import('../types').UserProfile;
}

export function safeGetStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function safeSetStorage(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function safeRemoveStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore storage access errors in restricted browser modes
  }
}

/**
 * Compresses an uploaded image file into a lightweight JPEG data URL
 * so photos render crisply while fitting safely within Firestore document & rule limits (<350KB).
 */
export function compressImageFile(file: File, maxDimension = 520, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = (event) => {
      const result = event.target?.result;
      if (typeof result !== 'string') {
        reject(new Error('Invalid image data.'));
        return;
      }

      const img = new Image();
      img.onerror = () => reject(new Error('Selected file is not a valid image.'));
      img.onload = () => {
        try {
          const renderScaled = (dim: number, q: number): string => {
            let { width, height } = img;
            if (width > dim || height > dim) {
              if (width >= height) {
                height = Math.round((height * dim) / width);
                width = dim;
              } else {
                width = Math.round((width * dim) / height);
                height = dim;
              }
            }
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, width);
            canvas.height = Math.max(1, height);
            const ctx = canvas.getContext('2d');
            if (!ctx) return result;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            return canvas.toDataURL('image/jpeg', q);
          };

          let compressed = renderScaled(maxDimension, quality);
          const attempts: [number, number][] = [
            [maxDimension, 0.56],
            [420, 0.5],
            [320, 0.42],
          ];
          for (const [dim, q] of attempts) {
            if (compressed.length <= 320000) break;
            compressed = renderScaled(dim, q);
          }

          if (compressed.length > 340000) {
            reject(new Error('Image is still too large after compression. Please pick a smaller photo.'));
            return;
          }
          resolve(compressed);
        } catch {
          reject(new Error('Failed to compress image.'));
        }
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Prepares a crisp <=1024px JPEG image for server-side Gemini AI-generated photo detection
 * so subtle AI artifacts remain visible during inspection.
 */
export function prepareFlatPhotoForAiCheck(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read flat image file.'));
    reader.onload = (event) => {
      const result = event.target?.result;
      if (typeof result !== 'string') {
        reject(new Error('Invalid image data.'));
        return;
      }

      const img = new Image();
      img.onerror = () => reject(new Error('Selected file is not a valid image.'));
      img.onload = () => {
        try {
          const maxDim = 1024;
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width >= height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, width);
          canvas.height = Math.max(1, height);
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Could not initialize image inspector canvas.'));
            return;
          }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
          const base64 = dataUrl.split(',')[1] || '';
          resolve({ base64, mimeType: 'image/jpeg' });
        } catch {
          reject(new Error('Could not prepare image for AI verification.'));
        }
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Compresses a verified flat photo under 175KB so up to 3 flat photos store reliably in Firestore.
 */
export function compressFlatImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read flat image file.'));
    reader.onload = (event) => {
      const result = event.target?.result;
      if (typeof result !== 'string') {
        reject(new Error('Invalid image data.'));
        return;
      }

      const img = new Image();
      img.onerror = () => reject(new Error('Selected file is not a valid image.'));
      img.onload = () => {
        try {
          const renderScaled = (dim: number, q: number): string => {
            let { width, height } = img;
            if (width > dim || height > dim) {
              if (width >= height) {
                height = Math.round((height * dim) / width);
                width = dim;
              } else {
                width = Math.round((width * dim) / height);
                height = dim;
              }
            }
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, width);
            canvas.height = Math.max(1, height);
            const ctx = canvas.getContext('2d');
            if (!ctx) return result;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            return canvas.toDataURL('image/jpeg', q);
          };

          const attempts: [number, number][] = [
            [720, 0.72],
            [640, 0.62],
            [520, 0.56],
            [420, 0.48],
            [320, 0.42],
          ];
          let compressed = '';
          for (const [dim, q] of attempts) {
            compressed = renderScaled(dim, q);
            if (compressed.length <= 172000) break;
          }

          if (compressed.length > 175000) {
            reject(new Error('Flat photo is still too large after compression. Please pick a smaller image.'));
            return;
          }
          resolve(compressed);
        } catch {
          reject(new Error('Failed to compress flat photo.'));
        }
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  });
}
