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

  const requestVerify = async (): Promise<{ response: Response; rawBody: string }> => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 48000);
    try {
      const response = await fetch('/api/verify-identity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType,
          verificationType,
        }),
        signal: controller.signal,
      });
      const rawBody = await response.text();
      return { response, rawBody };
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new Error('Identity verification timed out. Please try again in a few seconds.');
      }
      throw new Error('Network error contacting the identity verification server. Please try again.');
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  let { response, rawBody } = await requestVerify();
  if (response.status === 502 || response.status === 503 || response.status === 504) {
    await new Promise((resolve) => window.setTimeout(resolve, 1200));
    ({ response, rawBody } = await requestVerify());
  }

  let payload: (Partial<IdentityCheckResponse> & { error?: string }) = {};
  try {
    payload = rawBody ? (JSON.parse(rawBody) as Partial<IdentityCheckResponse> & { error?: string }) : {};
  } catch {
    payload = {};
  }

  if (!response.ok) {
    if (payload.error) {
      throw new Error(payload.error);
    }
    if (response.status === 413) {
      throw new Error('Identity photo is too large. Please upload a smaller image.');
    }
    if (response.status === 404) {
      const host = typeof window !== 'undefined' ? window.location.host : 'this host';
      throw new Error(
        `Identity verification endpoint (/api/verify-identity) returned 404 on ${host}. Deploy the latest code (including /api routes and GEMINI_API_KEY) or use the AI Studio preview URL.`
      );
    }
    throw new Error(`Identity verification service failed (HTTP ${response.status}). Please try again.`);
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
