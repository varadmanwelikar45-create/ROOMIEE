import {
  compressImageFile,
  inferImageMimeType,
  prepareFlatPhotoForAiCheck,
} from '../utils/storage';

export interface ProfilePhotoVerificationResult {
  accepted: boolean;
  isAiGenerated: boolean;
  isRealCameraPhoto: boolean;
  hasRealPerson: boolean;
  confidence: number;
  reason: string;
  detectedIndicators: string[];
  compressedDataUrl?: string;
}

/**
 * Inspects a profile photo through the server-side Gemini AI detector (/api/verify-profile-photo).
 * Rejects AI-generated portraits, avatars, stock watermarks, cartoons, and non-human uploads.
 */
export async function verifyAndCompressProfilePhoto(
  file: File
): Promise<ProfilePhotoVerificationResult> {
  const effectiveMime = inferImageMimeType(file);
  if (!effectiveMime.startsWith('image/')) {
    return {
      accepted: false,
      isAiGenerated: false,
      isRealCameraPhoto: false,
      hasRealPerson: false,
      confidence: 100,
      reason: 'Please select a valid image file (JPG, PNG, or WEBP).',
      detectedIndicators: ['Invalid file type'],
    };
  }

  if (effectiveMime === 'image/svg+xml' || effectiveMime === 'image/gif') {
    return {
      accepted: false,
      isAiGenerated: false,
      isRealCameraPhoto: false,
      hasRealPerson: false,
      confidence: 100,
      reason: 'SVG or GIF files are not accepted. Please upload a real camera photo of yourself.',
      detectedIndicators: ['Non-photographic image format'],
    };
  }

  if (file.size > 10 * 1024 * 1024) {
    return {
      accepted: false,
      isAiGenerated: false,
      isRealCameraPhoto: false,
      hasRealPerson: false,
      confidence: 100,
      reason: 'Profile image size must be under 10MB.',
      detectedIndicators: ['File too large'],
    };
  }

  const { base64, mimeType } = await prepareFlatPhotoForAiCheck(file);

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 28000);

  let response: Response;
  try {
    response = await fetch('/api/verify-profile-photo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: base64,
        mimeType,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('AI profile photo check timed out. Please try again in a few seconds.');
    }
    throw new Error('Network error contacting the AI photo verification server. Please try again.');
  } finally {
    window.clearTimeout(timeoutId);
  }

  const rawBody = await response.text();
  let payload: (Partial<ProfilePhotoVerificationResult> & { error?: string }) = {};
  try {
    payload = rawBody ? (JSON.parse(rawBody) as Partial<ProfilePhotoVerificationResult> & { error?: string }) : {};
  } catch {
    payload = {};
  }

  if (!response.ok) {
    if (payload.error) {
      throw new Error(payload.error);
    }
    if (response.status === 413) {
      throw new Error('Photo upload is too large for verification. Please choose a smaller photo.');
    }
    if (response.status === 404) {
      const host = typeof window !== 'undefined' ? window.location.host : 'this host';
      throw new Error(
        `AI photo verification endpoint (/api/verify-profile-photo) returned 404 on ${host}. Deploy the latest code (including /api routes and GEMINI_API_KEY) or use the AI Studio preview URL.`
      );
    }
    throw new Error(`AI profile photo verification failed (HTTP ${response.status}). Please try again.`);
  }

  if (typeof payload.accepted !== 'boolean') {
    throw new Error('AI photo verification server returned an unexpected response. Please try again.');
  }

  const accepted =
    Boolean(payload.accepted) &&
    !Boolean(payload.isAiGenerated) &&
    Boolean(payload.isRealCameraPhoto) &&
    Boolean(payload.hasRealPerson);

  if (!accepted) {
    return {
      accepted: false,
      isAiGenerated: Boolean(payload.isAiGenerated),
      isRealCameraPhoto: Boolean(payload.isRealCameraPhoto),
      hasRealPerson: Boolean(payload.hasRealPerson),
      confidence: typeof payload.confidence === 'number' ? payload.confidence : 90,
      reason:
        payload.reason ||
        'This photo was rejected because it appears AI-generated, stock-watermarked, or not a real photo of you.',
      detectedIndicators: Array.isArray(payload.detectedIndicators)
        ? payload.detectedIndicators.map(String)
        : [],
    };
  }

  const compressedDataUrl = await compressImageFile(file, 520, 0.72);

  return {
    accepted: true,
    isAiGenerated: false,
    isRealCameraPhoto: true,
    hasRealPerson: true,
    confidence: typeof payload.confidence === 'number' ? payload.confidence : 95,
    reason: payload.reason || 'Verified as an authentic real-world profile photo.',
    detectedIndicators: Array.isArray(payload.detectedIndicators)
      ? payload.detectedIndicators.map(String)
      : [],
    compressedDataUrl,
  };
}
