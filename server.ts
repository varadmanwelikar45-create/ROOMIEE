import 'dotenv/config';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import path from 'node:path';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const PORT = Number(process.env.PORT) || 3000;

interface VerifyFlatPhotoBody {
  imageBase64?: unknown;
  mimeType?: unknown;
}

interface GeminiPhotoCheckResult {
  isAiGenerated: boolean;
  isRealFlatPhoto: boolean;
  isFlatRelated: boolean;
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
    typeof err === 'object' && err !== null && 'status' in err && typeof (err as { status: unknown }).status === 'number'
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
    { model: 'gemini-4-hydrogen', thinkingLevel: ThinkingLevel.LOW, attempts: 1, timeoutMs: 7000 },
    { model: 'gemini-3.1-flash-lite', attempts: 2, timeoutMs: 9000 },
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

        // Immediately surface auth / invalid key errors without retrying
        if (status === 400 || status === 401 || status === 403) {
          throw new GeminiServiceError(
            status === 403 ? 403 : 500,
            'Gemini API key could not be validated. Please check your API key in Settings > Secrets.'
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

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '8mb' }));
  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (err && typeof err === 'object' && 'type' in err && (err as { type?: string }).type === 'entity.too.large') {
      res.status(413).json({
        error: 'Uploaded photo is too large to inspect. Please choose an image under 4MB.',
      });
      return;
    }
    if (err instanceof SyntaxError && 'body' in err) {
      res.status(400).json({ error: 'Invalid request payload sent to verification service.' });
      return;
    }
    next(err);
  });

  app.post('/api/verify-flat-photo', async (req: Request, res: Response) => {
    const body = (req.body || {}) as VerifyFlatPhotoBody;
    const rawBase64 = typeof body.imageBase64 === 'string' ? body.imageBase64.trim() : '';
    const mimeType = typeof body.mimeType === 'string' ? body.mimeType.trim().toLowerCase() : 'image/jpeg';

    if (!rawBase64) {
      res.status(400).json({ error: 'Missing imageBase64 payload.' });
      return;
    }

    if (!ALLOWED_IMAGE_MIMES.has(mimeType)) {
      res.status(200).json({
        accepted: false,
        isAiGenerated: false,
        isRealFlatPhoto: false,
        isFlatRelated: false,
        confidence: 100,
        reason: 'Only real camera image formats (JPG, PNG, WEBP) are supported for flat photos.',
        detectedIndicators: ['Unsupported or non-photographic file format'],
      });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(500).json({
        error: 'Server Gemini API key is not configured. Check Settings > Secrets.',
      });
      return;
    }

    const cleanedBase64 = rawBase64.includes(',') ? rawBase64.split(',')[1] || '' : rawBase64;
    if (!cleanedBase64 || cleanedBase64.length > 6 * 1024 * 1024) {
      res.status(400).json({
        error: 'Image payload is empty or exceeds the maximum 4MB inspection limit.',
      });
      return;
    }

    try {
      const parsed = await generateStructuredVisionJson<GeminiPhotoCheckResult>({
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
          'Look closely for: hyper-smooth plastic textures, unnatural volumetric showroom lighting, warped or melting furniture legs/lines, impossible window mullions or door frames, asymmetrical tiles or ceiling fixtures, garbled text/numbers on clocks/appliances, floating decor, or AI generator watermarks/sparkles in corners. ' +
          'Conversely, authentic smartphone/camera flat photos typically show natural indoor lighting/shadows, consistent geometry, real wall switches/wiring/AC pipes, lived-in details, realistic reflections, and authentic lens perspective. ' +
          'If the image is AI-generated, CGI-rendered, a cartoon/illustration, or NOT a real flat/room/building photo, mark it so it will be rejected. ' +
          'Return concise, helpful user-facing explanations in `reason` and specific visual cues in `detectedIndicators`.',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isAiGenerated: {
              type: Type.BOOLEAN,
              description:
                'True if the image is AI-generated, synthetic, heavily AI-altered, or a 3D CGI render.',
            },
            isRealFlatPhoto: {
              type: Type.BOOLEAN,
              description: 'True ONLY if this is a genuine camera photograph captured in the real world.',
            },
            isFlatRelated: {
              type: Type.BOOLEAN,
              description:
                'True if the image depicts a flat, apartment, bedroom, living room, kitchen, balcony, bathroom, or residential building.',
            },
            confidence: {
              type: Type.INTEGER,
              description: 'Confidence score from 0 to 100.',
            },
            reason: {
              type: Type.STRING,
              description: 'One short clear sentence explaining why the photo passed or failed verification.',
            },
            detectedIndicators: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Up to 4 short visual cues observed.',
            },
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

      res.status(200).json({
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
      });
    } catch (err) {
      console.error('Gemini flat photo verification error:', err);
      if (err instanceof GeminiServiceError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(502).json({
        error: 'Could not inspect this photo right now. Please try again in a moment.',
      });
    }
  });

  app.post('/api/verify-identity', async (req: Request, res: Response) => {
    const body = (req.body || {}) as VerifyFlatPhotoBody & { verificationType?: unknown; expectedName?: unknown };
    const rawBase64 = typeof body.imageBase64 === 'string' ? body.imageBase64.trim() : '';
    const mimeType = typeof body.mimeType === 'string' ? body.mimeType.trim().toLowerCase() : 'image/jpeg';
    const verificationType =
      body.verificationType === 'gov_id_ai_check' || body.verificationType === 'workplace_id_ai_check'
        ? body.verificationType
        : 'selfie_liveness';

    if (!rawBase64) {
      res.status(400).json({ error: 'Missing imageBase64 payload for identity check.' });
      return;
    }

    if (!ALLOWED_IMAGE_MIMES.has(mimeType)) {
      res.status(200).json({
        verified: false,
        isAiOrSpoof: false,
        confidence: 100,
        reason: 'Only real camera photo formats (JPG, PNG, WEBP) are accepted for identity verification.',
        detectedIndicators: ['Unsupported file format'],
      });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: 'Server Gemini API key is not configured. Check Settings > Secrets.' });
      return;
    }

    const cleanedBase64 = rawBase64.includes(',') ? rawBase64.split(',')[1] || '' : rawBase64;
    if (!cleanedBase64 || cleanedBase64.length > 6 * 1024 * 1024) {
      res.status(400).json({ error: 'Identity photo payload is invalid or exceeds 4MB.' });
      return;
    }

    try {
      const promptContext =
        verificationType === 'selfie_liveness'
          ? 'Verify that this is an authentic, unedited live camera selfie of a real human person (not AI-generated, not a cartoon, not a photo of another phone/monitor screen, and face is clearly visible).'
          : 'Verify that this is a genuine, real-world photograph of a physical student/workplace/government ID card held or placed on a real surface (not an AI-generated mockup, not a blank/random image, and not an obvious digital template). Do NOT output or transcribe any sensitive ID numbers.';

      const parsed = await generateStructuredVisionJson<{
        isAuthenticRealWorldPhoto: boolean;
        matchesRequestedProof: boolean;
        isAiOrSpoof: boolean;
        confidence: number;
        reason: string;
        detectedIndicators: string[];
      }>({
        apiKey,
        mimeType,
        base64Data: cleanedBase64,
        promptText: promptContext,
        systemInstruction:
          'You are a strict trust & safety identity verification inspector. ' +
          'Never return or repeat personal ID numbers or Aadhaar/PAN digits. ' +
          'Detect AI faces/deepfakes, screen-moiré recaptures, cartoons, or irrelevant objects. ' +
          'Approve ONLY genuine real-world camera photos matching the requested verification type.',
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

      res.status(200).json({
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
      });
    } catch (err) {
      console.error('Identity verification API error:', err);
      if (err instanceof GeminiServiceError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(502).json({ error: 'Could not complete identity verification right now. Please try again.' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(import.meta.dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ROOMIE server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
