import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleServerlessPost, verifyIdentityRequest } from '../server/visionVerifier.ts';

export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse
) {
  await handleServerlessPost(req, res, verifyIdentityRequest);
}
