import { compressFlatImageFile, prepareFlatPhotoForAiCheck } from '../utils/storage';

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
  if (!file.type.startsWith('image/')) {
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

  if (file.type === 'image/svg+xml') {
    return {
      accepted: false,
      isAiGenerated: false,
      isRealFlatPhoto: false,
      isFlatRelated: false,
      confidence: 100,
      reason: 'SVG vector graphics are not accepted. Please upload a real camera photo of your flat.',
      detectedIndicators: ['Vector SVG file'],
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

  const response = await fetch('/api/verify-flat-photo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageBase64: base64,
      mimeType,
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as Partial<FlatPhotoVerificationResult> & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(
      payload.error || 'Could not run AI photo detection right now. Please try again.'
    );
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
