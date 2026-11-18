import 'dotenv/config';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import path from 'node:path';
import {
  verifyFlatPhotoRequest,
  verifyIdentityRequest,
  verifyProfilePhotoRequest,
} from './server/visionVerifier.ts';
import type { VerifyPhotoRequestBody } from './server/visionVerifier.ts';

const PORT = Number(process.env.PORT) || 3000;

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
    const result = await verifyFlatPhotoRequest((req.body || {}) as VerifyPhotoRequestBody);
    res.status(result.status).json(result.body);
  });

  app.post('/api/verify-identity', async (req: Request, res: Response) => {
    const result = await verifyIdentityRequest((req.body || {}) as VerifyPhotoRequestBody);
    res.status(result.status).json(result.body);
  });

  app.post('/api/verify-profile-photo', async (req: Request, res: Response) => {
    const result = await verifyProfilePhotoRequest((req.body || {}) as VerifyPhotoRequestBody);
    res.status(result.status).json(result.body);
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
