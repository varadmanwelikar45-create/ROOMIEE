import 'dotenv/config';
import express, { Request, Response } from 'express';
import path from 'node:path';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const PORT = 3000;

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

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '8mb' }));

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
        reason: 'Only real camera image formats (JPG, PNG, WEBP, HEIC) are supported for flat photos.',
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
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: mimeType === 'image/jpg' ? 'image/jpeg' : mimeType,
                data: cleanedBase64,
              },
            },
            {
              text:
                'Inspect this image for a flatmate listing platform. Determine strictly: ' +
                '(1) Is it AI-generated, synthetic, or a 3D CGI architectural render? ' +
                '(2) Is it a genuine real-world camera photograph? ' +
                '(3) Does it actually show a flat, apartment, room, kitchen, bathroom, balcony, or residential building?',
            },
          ],
        },
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction:
            'You are a strict digital photo forensics and real-estate image authenticity inspector. ' +
            'Analyze the uploaded image carefully for signs of AI image generation (Midjourney, DALL-E, Flux, Stable Diffusion, Imagen, Adobe Firefly) or 3D CGI architectural renders (Blender/V-Ray showroom renders). ' +
            'Look closely for: hyper-smooth plastic textures, unnatural volumetric showroom lighting, warped or melting furniture legs/lines, impossible window mullions or door frames, asymmetrical tiles or ceiling fixtures, garbled text/numbers on clocks/appliances, floating decor, or AI generator watermarks/sparkles in corners. ' +
            'Conversely, authentic smartphone/camera flat photos typically show natural indoor lighting/shadows, real wall switches/wiring/AC pipes, lived-in details or clutter, realistic reflections, and authentic lens perspective. ' +
            'If the image is AI-generated, CGI-rendered, a cartoon/illustration, or NOT a real flat/room/building photo, mark it so it will be rejected. ' +
            'Return concise, helpful user-facing explanations in `reason` and specific visual cues in `detectedIndicators`.',
          responseMimeType: 'application/json',
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
                description:
                  'True ONLY if this is a genuine camera photograph captured in the real world.',
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
        },
      });

      const rawJson = (response.text || '').trim();
      const parsed = JSON.parse(rawJson) as GeminiPhotoCheckResult;

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
      const message = err instanceof Error ? err.message : 'Failed to verify image with AI detector.';
      res.status(502).json({
        error: `AI photo verification service error: ${message}`,
      });
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
