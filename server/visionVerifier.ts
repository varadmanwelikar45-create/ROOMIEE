import 'dotenv/config';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

function getServerGeminiApiKey(): string {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    ''
  ).trim();
}

export interface VerifyPhotoRequestBody {
  imageBase64?: unknown;
  mimeType?: unknown;
  verificationType?: unknown;
}

export interface VerifierHttpResponse {
  status: number;
  body: Record<string, unknown>;
}

interface GeminiFlatCheckResult {
  isAiGenerated: boolean;
  isRealFlatPhoto: boolean;
  isFlatRelated: boolean;
  confidence: number;
  reason: string;
  detectedIndicators: string[];
}

interface GeminiProfileCheckResult {
  isAiGenerated: boolean;
  isRealCameraPhoto: boolean;
  hasRealPerson: boolean;
  isStockWatermarked: boolean;
  confidence: number;
  reason: string;
  detectedIndicators: string[];
}

interface GeminiIdentityCheckResult {
  isAuthenticRealWorldPhoto: boolean;
  matchesRequestedProof: boolean;
  isAiOrSpoof: boolean;
  confidence: number;
  reason: string;
  detectedIndicators: string[];
}

const ALLOWED_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

class GeminiServiceError extends Error {
  readonly statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

function getErrorStatusAndCode(err: unknown): { status?: number; rawMessage: string } {
  if (
    err instanceof Error &&
    (err.name === 'TimeoutError' || err.name === 'AbortError' || /timed out|aborted/i.test(err.message))
  ) {
    return { status: 504, rawMessage: err.message || 'Model request timed out' };
  }

  const rawMessage = err instanceof Error ? err.message : String(err || 'Unknown AI service error');
  const statusProp =
    typeof err === 'object' &&
    err !== null &&
    'status' in err &&
    typeof (err as { status: unknown }).status === 'number'
      ? (err as { status: number }).status
      : undefined;

  if (statusProp) {
    return { status: statusProp, rawMessage };
  }

  const codeMatch = rawMessage.match(/"code"\s*:\s*(\d{3})/);
  if (codeMatch) {
    return { status: Number(codeMatch[1]), rawMessage };
  }

  if (/UNAVAILABLE|high demand/i.test(rawMessage)) return { status: 503, rawMessage };
  if (/RESOURCE_EXHAUSTED|quota|rate limit/i.test(rawMessage)) return { status: 429, rawMessage };
  if (/PERMISSION_DENIED|API_KEY_INVALID|API key not valid/i.test(rawMessage)) return { status: 403, rawMessage };
  if (/NOT_FOUND/i.test(rawMessage)) return { status: 404, rawMessage };
  return { status: undefined, rawMessage };
}

function isRetryableStatus(status: number | undefined, rawMessage: string): boolean {
  if (status === 429 || status === 500 || status === 502 || status === 503 || status === 504) {
    return true;
  }
  return /UNAVAILABLE|RESOURCE_EXHAUSTED|high demand|fetch failed|ECONNRESET|ETIMEDOUT|Empty response|timed out|aborted/i.test(
    rawMessage
  );
}

function parseModelJson<T>(rawText: string | undefined): T {
  const trimmed = (rawText || '').trim();
  if (!trimmed) {
    throw new Error('Empty response from Gemini AI verifier.');
  }
  const withoutFences = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  return JSON.parse(withoutFences) as T;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const modelCooldownUntil = new Map<string, number>();

async function generateStructuredVisionJson<T>(params: {
  apiKey: string;
  mimeType: string;
  base64Data: string;
  promptText: string;
  systemInstruction: string;
  responseSchema: Record<string, unknown>;
}): Promise<T> {
  const ai = new GoogleGenAI({
    apiKey: params.apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const normalizedMime = params.mimeType === 'image/jpg' ? 'image/jpeg' : params.mimeType;

  const modelCandidates: Array<{
    model: string;
    thinkingLevel?: ThinkingLevel;
    attempts: number;
    timeoutMs: number;
  }> = [
    { model: 'gemini-3.1-flash-lite', attempts: 1, timeoutMs: 22000 },
    { model: 'gemini-4-hydrogen', thinkingLevel: ThinkingLevel.LOW, attempts: 1, timeoutMs: 22000 },
  ];

  const now = Date.now();
  const orderedCandidates = [
    ...modelCandidates.filter((c) => (modelCooldownUntil.get(c.model) || 0) <= now),
    ...modelCandidates.filter((c) => (modelCooldownUntil.get(c.model) || 0) > now),
  ];

  let lastError: unknown = null;

  for (const candidate of orderedCandidates) {
    for (let attempt = 1; attempt <= candidate.attempts; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: candidate.model,
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: normalizedMime,
                  data: params.base64Data,
                },
              },
              { text: params.promptText },
            ],
          },
          config: {
            abortSignal: AbortSignal.timeout(candidate.timeoutMs),
            ...(candidate.thinkingLevel ? { thinkingConfig: { thinkingLevel: candidate.thinkingLevel } } : {}),
            systemInstruction: params.systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: params.responseSchema,
          },
        });

        modelCooldownUntil.delete(candidate.model);
        return parseModelJson<T>(response.text);
      } catch (err) {
        lastError = err;
        const { status, rawMessage } = getErrorStatusAndCode(err);
        console.warn(
          `[Gemini Vision] model=${candidate.model} attempt=${attempt}/${candidate.attempts} failed (status=${status ?? 'unknown'}): ${rawMessage}`
        );

        if (status === 400 || status === 401 || status === 403) {
          throw new GeminiServiceError(
            status === 403 ? 403 : 500,
            'Gemini API key could not be validated. Please check your API key in Settings > Secrets (or deployment environment variables).'
          );
        }

        if (status === 503 || status === 504 || status === 429) {
          modelCooldownUntil.set(candidate.model, Date.now() + 60_000);
        }

        const retryable = isRetryableStatus(status, rawMessage) || status === 404;
        if (!retryable) {
          throw err;
        }

        if (attempt < candidate.attempts) {
          await sleep(500 * attempt);
        }
      }
    }
  }

  const { status } = getErrorStatusAndCode(lastError);
  if (status === 429) {
    throw new GeminiServiceError(
      429,
      'AI photo verification quota/rate limit reached right now. Please wait a few seconds and try again.'
    );
  }
  if (status === 503 || status === 504) {
    throw new GeminiServiceError(
      503,
      'AI photo verification service is experiencing temporary high demand. Please retry in a few seconds.'
    );
  }
  throw new GeminiServiceError(
    502,
    'Could not complete AI photo inspection right now. Please try again in a few seconds.'
  );
}

function parseAndValidateImagePayload(rawBody: VerifyPhotoRequestBody): {
  error?: VerifierHttpResponse;
  cleanedBase64: string;
  mimeType: string;
} {
  const rawBase64 = typeof rawBody.imageBase64 === 'string' ? rawBody.imageBase64.trim() : '';
  const mimeType = typeof rawBody.mimeType === 'string' ? rawBody.mimeType.trim().toLowerCase() : 'image/jpeg';

  if (!rawBase64) {
    return {
      error: { status: 400, body: { error: 'Missing imageBase64 payload.' } },
      cleanedBase64: '',
      mimeType,
    };
  }

  const cleanedBase64 = rawBase64.includes(',') ? rawBase64.split(',')[1] || '' : rawBase64;
  if (!cleanedBase64 || cleanedBase64.length > 6 * 1024 * 1024) {
    return {
      error: {
        status: 400,
        body: { error: 'Image payload is empty or exceeds the maximum 4MB inspection limit.' },
      },
      cleanedBase64: '',
      mimeType,
    };
  }

  return { cleanedBase64, mimeType };
}

export async function verifyFlatPhotoRequest(rawBody: VerifyPhotoRequestBody): Promise<VerifierHttpResponse> {
  const { error, cleanedBase64, mimeType } = parseAndValidateImagePayload(rawBody);
  if (error) return error;

  if (!ALLOWED_IMAGE_MIMES.has(mimeType)) {
    return {
      status: 200,
      body: {
        accepted: false,
        isAiGenerated: false,
        isRealFlatPhoto: false,
        isFlatRelated: false,
        confidence: 100,
        reason: 'Only real camera image formats (JPG, PNG, WEBP) are supported for flat photos.',
        detectedIndicators: ['Unsupported or non-photographic file format'],
      },
    };
  }

  const apiKey = getServerGeminiApiKey();
  if (!apiKey) {
    return {
      status: 500,
      body: {
        error:
          'GEMINI_API_KEY is not configured on this server. Add GEMINI_API_KEY in Settings > Secrets (AI Studio) or Project Settings > Environment Variables (Vercel) and redeploy.',
      },
    };
  }

  try {
    const parsed = await generateStructuredVisionJson<GeminiFlatCheckResult>({
      apiKey,
      mimeType,
      base64Data: cleanedBase64,
      promptText:
        'Inspect this image for a flatmate listing platform. Determine strictly: ' +
        '(1) Is it AI-generated, synthetic, or a 3D CGI architectural render? ' +
        '(2) Is it a genuine real-world camera photograph? ' +
        '(3) Does it actually show a flat, apartment, bedroom, living room, kitchen, bathroom, balcony, or residential building?',
      systemInstruction:
        'You are a strict digital photo forensics and real-estate image authenticity inspector. ' +
        'Analyze the uploaded image carefully for signs of AI image generation (Midjourney, DALL-E, Flux, Stable Diffusion, Imagen, Adobe Firefly) or 3D CGI architectural renders (Blender/V-Ray showroom renders). ' +
        'Look closely for: hyper-smooth plastic textures, unnatural volumetric showroom lighting or uniform HDR glow, warped or melting furniture legs/lines, impossible window mullions or door frames, asymmetrical tiles or ceiling fixtures, garbled text/numbers on clocks/appliances, floating decor, or AI generator watermarks/four-point sparkles in corners. ' +
        'Conversely, authentic smartphone/camera flat photos typically show natural indoor lighting/shadows, consistent geometry, real wall switches/wiring/AC pipes, lived-in details, realistic reflections, and authentic lens perspective. Do NOT falsely mark genuine tidy or sunlit real-world apartment photos as AI-generated unless real synthetic/CGI artifacts are present. ' +
        'If the image is AI-generated, CGI-rendered, a cartoon/illustration, or NOT a real flat/room/building photo, mark it so it will be rejected. ' +
        'Return concise, helpful user-facing explanations in `reason` and specific visual cues in `detectedIndicators`.',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          isAiGenerated: { type: Type.BOOLEAN },
          isRealFlatPhoto: { type: Type.BOOLEAN },
          isFlatRelated: { type: Type.BOOLEAN },
          confidence: { type: Type.INTEGER },
          reason: { type: Type.STRING },
          detectedIndicators: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: [
          'isAiGenerated',
          'isRealFlatPhoto',
          'isFlatRelated',
          'confidence',
          'reason',
          'detectedIndicators',
        ],
      },
    });

    const isAiGenerated = Boolean(parsed.isAiGenerated);
    const isRealFlatPhoto = Boolean(parsed.isRealFlatPhoto);
    const isFlatRelated = Boolean(parsed.isFlatRelated);
    const accepted = !isAiGenerated && isRealFlatPhoto && isFlatRelated;

    return {
      status: 200,
      body: {
        accepted,
        isAiGenerated,
        isRealFlatPhoto,
        isFlatRelated,
        confidence: typeof parsed.confidence === 'number' ? Math.max(0, Math.min(100, parsed.confidence)) : 85,
        reason:
          typeof parsed.reason === 'string' && parsed.reason.trim()
            ? parsed.reason.trim()
            : accepted
              ? 'Verified as a real flat photograph.'
              : 'Image rejected because it appears AI-generated or not a genuine flat photograph.',
        detectedIndicators: Array.isArray(parsed.detectedIndicators)
          ? parsed.detectedIndicators.slice(0, 4).map(String)
          : [],
      },
    };
  } catch (err) {
    console.error('Gemini flat photo verification error:', err);
    if (err instanceof GeminiServiceError) {
      return { status: err.statusCode, body: { error: err.message } };
    }
    return {
      status: 502,
      body: { error: 'Could not inspect this photo right now. Please try again in a moment.' },
    };
  }
}

export async function verifyProfilePhotoRequest(rawBody: VerifyPhotoRequestBody): Promise<VerifierHttpResponse> {
  const { error, cleanedBase64, mimeType } = parseAndValidateImagePayload(rawBody);
  if (error) return error;

  if (!ALLOWED_IMAGE_MIMES.has(mimeType)) {
    return {
      status: 200,
      body: {
        accepted: false,
        isAiGenerated: false,
        isRealCameraPhoto: false,
        hasRealPerson: false,
        confidence: 100,
        reason: 'Only real camera image formats (JPG, PNG, WEBP) are supported for profile photos.',
        detectedIndicators: ['Unsupported or non-photographic file format'],
      },
    };
  }

  const apiKey = getServerGeminiApiKey();
  if (!apiKey) {
    return {
      status: 500,
      body: {
        error:
          'GEMINI_API_KEY is not configured on this server. Add GEMINI_API_KEY in Settings > Secrets (AI Studio) or Project Settings > Environment Variables (Vercel) and redeploy.',
      },
    };
  }

  try {
    const parsed = await generateStructuredVisionJson<GeminiProfileCheckResult>({
      apiKey,
      mimeType,
      base64Data: cleanedBase64,
      promptText:
        'Inspect this user profile photo for a flatmate matching platform. Determine strictly: ' +
        '(1) Is it AI-generated, a synthetic portrait/deepfake, anime, cartoon, or 3D avatar? ' +
        '(2) Does it have stock photo watermarks? ' +
        '(3) Is it a genuine real-world camera photograph showing a real human person?',
      systemInstruction:
        'You are a strict digital photo authenticity inspector for user profile photos. ' +
        'Reject AI-generated faces/portraits (Midjourney, Flux, DALL-E, Imagen, Stable Diffusion, Lensa/Remini AI avatars), ' +
        'cartoons/anime/illustrations, CGI characters, watermarked stock photos, blank/solid graphics, or photos with no real human person. ' +
        'Look closely for waxy plastic skin, uncanny overly symmetrical eyes/teeth, melted hair/glasses/ears, surreal bokeh glow, or AI corner watermarks/sparkles. ' +
        'Conversely, approve genuine smartphone selfies, casual portraits, and real-world photos of real people (including natural indoor/outdoor lighting or standard phone portrait mode). ' +
        'Return concise user-facing feedback in `reason` and specific cues in `detectedIndicators`.',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          isAiGenerated: { type: Type.BOOLEAN },
          isRealCameraPhoto: { type: Type.BOOLEAN },
          hasRealPerson: { type: Type.BOOLEAN },
          isStockWatermarked: { type: Type.BOOLEAN },
          confidence: { type: Type.INTEGER },
          reason: { type: Type.STRING },
          detectedIndicators: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: [
          'isAiGenerated',
          'isRealCameraPhoto',
          'hasRealPerson',
          'isStockWatermarked',
          'confidence',
          'reason',
          'detectedIndicators',
        ],
      },
    });

    const isAiGenerated = Boolean(parsed.isAiGenerated);
    const isRealCameraPhoto = Boolean(parsed.isRealCameraPhoto);
    const hasRealPerson = Boolean(parsed.hasRealPerson);
    const isStockWatermarked = Boolean(parsed.isStockWatermarked);
    const accepted = !isAiGenerated && !isStockWatermarked && isRealCameraPhoto && hasRealPerson;

    return {
      status: 200,
      body: {
        accepted,
        isAiGenerated,
        isRealCameraPhoto,
        hasRealPerson,
        confidence: typeof parsed.confidence === 'number' ? Math.max(0, Math.min(100, parsed.confidence)) : 88,
        reason:
          typeof parsed.reason === 'string' && parsed.reason.trim()
            ? parsed.reason.trim()
            : accepted
              ? 'Verified as an authentic real-world profile photo.'
              : 'Image rejected because it appears AI-generated, stock-watermarked, or not a real person photo.',
        detectedIndicators: Array.isArray(parsed.detectedIndicators)
          ? parsed.detectedIndicators.slice(0, 4).map(String)
          : [],
      },
    };
  } catch (err) {
    console.error('Gemini profile photo verification error:', err);
    if (err instanceof GeminiServiceError) {
      return { status: err.statusCode, body: { error: err.message } };
    }
    return {
      status: 502,
      body: { error: 'Could not inspect this profile photo right now. Please try again in a moment.' },
    };
  }
}

export async function verifyIdentityRequest(rawBody: VerifyPhotoRequestBody): Promise<VerifierHttpResponse> {
  const { error, cleanedBase64, mimeType } = parseAndValidateImagePayload(rawBody);
  if (error) return error;

  if (
    rawBody.verificationType !== 'gov_id_ai_check' &&
    rawBody.verificationType !== 'workplace_id_ai_check'
  ) {
    return {
      status: 400,
      body: {
        error: 'Unsupported verificationType. Use gov_id_ai_check or workplace_id_ai_check.',
      },
    };
  }

  if (!ALLOWED_IMAGE_MIMES.has(mimeType)) {
    return {
      status: 200,
      body: {
        verified: false,
        isAiOrSpoof: false,
        confidence: 100,
        reason: 'Only JPG, PNG, or WEBP photo files are accepted for identity verification.',
        detectedIndicators: ['Unsupported file format'],
      },
    };
  }

  const apiKey = getServerGeminiApiKey();
  if (!apiKey) {
    return {
      status: 500,
      body: {
        error:
          'GEMINI_API_KEY is not configured on this server. Add GEMINI_API_KEY in Settings > Secrets (AI Studio) or Project Settings > Environment Variables (Vercel) and redeploy.',
      },
    };
  }

  try {
    const promptContext =
      rawBody.verificationType === 'gov_id_ai_check'
        ? 'Verify that this is a genuine, real-world photograph of a physical government ID card held or placed on a real surface (not an AI-generated mockup, not a blank/random image, and not an obvious digital template). Do NOT output or transcribe any sensitive ID numbers.'
        : 'Verify that this is a genuine, real-world photograph of a physical student or workplace ID card held or placed on a real surface (not an AI-generated mockup, not a blank/random image, and not an obvious digital template). Do NOT output or transcribe any sensitive ID numbers.';

    const parsed = await generateStructuredVisionJson<GeminiIdentityCheckResult>({
      apiKey,
      mimeType,
      base64Data: cleanedBase64,
      promptText: promptContext,
      systemInstruction:
        'You are a strict trust & safety identity verification inspector. ' +
        'Never return or repeat personal ID numbers or Aadhaar/PAN digits. ' +
        'Reject AI-generated mockups, screen-moiré recaptures (photos of another screen), cartoons, solid/blank frames, or irrelevant objects. ' +
        'Approve genuine real-world photographs of physical ID documents matching the requested verification type.',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          isAuthenticRealWorldPhoto: { type: Type.BOOLEAN },
          matchesRequestedProof: { type: Type.BOOLEAN },
          isAiOrSpoof: { type: Type.BOOLEAN },
          confidence: { type: Type.INTEGER },
          reason: { type: Type.STRING },
          detectedIndicators: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: [
          'isAuthenticRealWorldPhoto',
          'matchesRequestedProof',
          'isAiOrSpoof',
          'confidence',
          'reason',
          'detectedIndicators',
        ],
      },
    });

    const verified =
      Boolean(parsed.isAuthenticRealWorldPhoto) &&
      Boolean(parsed.matchesRequestedProof) &&
      !Boolean(parsed.isAiOrSpoof);

    return {
      status: 200,
      body: {
        verified,
        isAiOrSpoof: Boolean(parsed.isAiOrSpoof),
        confidence: typeof parsed.confidence === 'number' ? Math.max(0, Math.min(100, parsed.confidence)) : 85,
        reason:
          typeof parsed.reason === 'string' && parsed.reason.trim()
            ? parsed.reason.trim()
            : verified
              ? 'Identity verification check passed.'
              : 'Could not verify authenticity of submitted proof.',
        detectedIndicators: Array.isArray(parsed.detectedIndicators)
          ? parsed.detectedIndicators.slice(0, 4).map(String)
          : [],
      },
    };
  } catch (err) {
    console.error('Identity verification API error:', err);
    if (err instanceof GeminiServiceError) {
      return { status: err.statusCode, body: { error: err.message } };
    }
    return {
      status: 502,
      body: { error: 'Could not complete identity verification right now. Please try again.' },
    };
  }
}

export async function handleServerlessPost(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse,
  processor: (body: VerifyPhotoRequestBody) => Promise<VerifierHttpResponse>
): Promise<void> {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method not allowed. Use POST.' }));
    return;
  }

  let parsedBody: VerifyPhotoRequestBody = {};
  if (req.body && typeof req.body === 'object') {
    parsedBody = req.body as VerifyPhotoRequestBody;
  } else if (typeof req.body === 'string') {
    try {
      parsedBody = JSON.parse(req.body) as VerifyPhotoRequestBody;
    } catch {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Invalid JSON request body.' }));
      return;
    }
  } else {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const raw = Buffer.concat(chunks).toString('utf8').trim();
    if (raw) {
      try {
        parsedBody = JSON.parse(raw) as VerifyPhotoRequestBody;
      } catch {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Invalid JSON request body.' }));
        return;
      }
    }
  }

  const result = await processor(parsedBody);
  res.statusCode = result.status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(result.body));
}
