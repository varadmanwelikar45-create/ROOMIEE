import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleServerlessPost, verifyFlatPhotoRequest } from '../server/visionVerifier.ts';

export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse
) {
  await handleServerlessPost(req, res, verifyFlatPhotoRequest);
}
