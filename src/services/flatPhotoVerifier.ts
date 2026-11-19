import {
  compressFlatImageFile,
  inferImageMimeType,
  prepareFlatPhotoForAiCheck,
} from '../utils/storage';

export interface FlatPhotoVerificationResult {
  accepted: boolean;
  isAiGenerated: boolean;
  isRealFlatPhoto: boolean;
  isFlatRelated: boolean;
  confidence: number;
  reason: string;
  detectedIndicators: string[];
  compressedDataUrl?: string;
}

/**
 * Inspects a flat photo through the server-side Gemini AI detector (/api/verify-flat-photo).
 * Any image identified as AI-generated, CGI-rendered, or not a real flat photo is rejected
 * and never returned as an accepted upload.
 */
export async function verifyAndCompressFlatPhoto(file: File): Promise<FlatPhotoVerificationResult> {
  const effectiveMime = inferImageMimeType(file);
  if (!effectiveMime.startsWith('image/')) {
    return {
      accepted: false,
      isAiGenerated: false,
      isRealFlatPhoto: false,
      isFlatRelated: false,
      confidence: 100,
      reason: 'Please select a valid photo file (JPG, PNG, or WEBP).',
      detectedIndicators: ['Invalid file type'],
    };
  }

  if (effectiveMime === 'image/svg+xml' || effectiveMime === 'image/gif') {
    return {
      accepted: false,
      isAiGenerated: false,
      isRealFlatPhoto: false,
      isFlatRelated: false,
      confidence: 100,
      reason: 'Vector SVG or GIF files are not accepted. Please upload a real camera photo of your flat.',
      detectedIndicators: ['Non-photographic image format'],
    };
  }

  if (file.size > 12 * 1024 * 1024) {
    return {
      accepted: false,
      isAiGenerated: false,
      isRealFlatPhoto: false,
      isFlatRelated: false,
      confidence: 100,
      reason: 'Flat image file size must be under 12MB.',
      detectedIndicators: ['File too large'],
    };
  }

  const { base64, mimeType } = await prepareFlatPhotoForAiCheck(file);

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 48000);

  let response: Response;
  try {
    response = await fetch('/api/verify-flat-photo', {
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
      throw new Error('AI photo verification timed out. Please try again in a few seconds.');
    }
    throw new Error('Network error contacting the AI photo verification server. Please try again.');
  } finally {
    window.clearTimeout(timeoutId);
  }

  const rawBody = await response.text();
  let payload: (Partial<FlatPhotoVerificationResult> & { error?: string }) = {};
  try {
    payload = rawBody ? (JSON.parse(rawBody) as Partial<FlatPhotoVerificationResult> & { error?: string }) : {};
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
        `AI photo verification endpoint (/api/verify-flat-photo) returned 404 on ${host}. Deploy the latest code (including /api routes and GEMINI_API_KEY) or use the AI Studio preview URL.`
      );
    }
    if (response.status === 502 || response.status === 503 || response.status === 504) {
      throw new Error(`AI photo verification service is temporarily busy (HTTP ${response.status}). Please retry in a few seconds.`);
    }
    throw new Error(`AI photo verification failed (HTTP ${response.status}). Please try again.`);
  }

  if (typeof payload.accepted !== 'boolean') {
    throw new Error('AI photo verification server returned an unexpected response. Please try again.');
  }

  const accepted =
    Boolean(payload.accepted) &&
    !Boolean(payload.isAiGenerated) &&
    Boolean(payload.isRealFlatPhoto) &&
    Boolean(payload.isFlatRelated);

  if (!accepted) {
    return {
      accepted: false,
      isAiGenerated: Boolean(payload.isAiGenerated),
      isRealFlatPhoto: Boolean(payload.isRealFlatPhoto),
      isFlatRelated: Boolean(payload.isFlatRelated),
      confidence: typeof payload.confidence === 'number' ? payload.confidence : 90,
      reason:
        payload.reason ||
        'This image was rejected because it appears AI-generated or not a genuine flat photograph.',
      detectedIndicators: Array.isArray(payload.detectedIndicators)
        ? payload.detectedIndicators.map(String)
        : [],
    };
  }

  const compressedDataUrl = await compressFlatImageFile(file);

  return {
    accepted: true,
    isAiGenerated: false,
    isRealFlatPhoto: true,
    isFlatRelated: true,
    confidence: typeof payload.confidence === 'number' ? payload.confidence : 95,
    reason: payload.reason || 'Verified as an authentic real-world flat photo.',
    detectedIndicators: Array.isArray(payload.detectedIndicators)
      ? payload.detectedIndicators.map(String)
      : [],
    compressedDataUrl,
  };
}
