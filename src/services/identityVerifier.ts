import { inferImageMimeType, prepareFlatPhotoForAiCheck } from '../utils/storage';
import { VerificationMethod } from '../types';

export interface IdentityCheckResponse {
  verified: boolean;
  isAiOrSpoof: boolean;
  confidence: number;
  reason: string;
  detectedIndicators: string[];
}

/**
 * Runs a strong server-side Gemini AI liveness/authenticity check on a selfie or physical ID photo.
 * Raw ID photos are inspected in-memory and never saved to public Firestore profiles.
 */
export async function verifyIdentityProof(
  file: File,
  verificationType: Exclude<VerificationMethod, 'google_only'>
): Promise<IdentityCheckResponse> {
  const effectiveMime = inferImageMimeType(file);
  if (!effectiveMime.startsWith('image/') || effectiveMime === 'image/svg+xml' || effectiveMime === 'image/gif') {
    return {
      verified: false,
      isAiOrSpoof: false,
      confidence: 100,
      reason: 'Please upload a valid camera photo (JPG, PNG, WEBP).',
      detectedIndicators: ['Invalid file type'],
    };
  }

  const { base64, mimeType } = await prepareFlatPhotoForAiCheck(file);

  const response = await fetch('/api/verify-identity', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageBase64: base64,
      mimeType,
      verificationType,
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as Partial<IdentityCheckResponse> & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error || 'Identity verification service failed. Please try again.');
  }

  return {
    verified: Boolean(payload.verified) && !Boolean(payload.isAiOrSpoof),
    isAiOrSpoof: Boolean(payload.isAiOrSpoof),
    confidence: typeof payload.confidence === 'number' ? payload.confidence : 88,
    reason: payload.reason || 'Verification check complete.',
    detectedIndicators: Array.isArray(payload.detectedIndicators)
      ? payload.detectedIndicators.map(String)
      : [],
  };
}
