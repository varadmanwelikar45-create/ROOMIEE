const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

export interface GmailMessageSummary {
  id: string;
  threadId: string;
  snippet: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  bodyText: string;
  labelIds: string[];
  isUnread: boolean;
}

export class GmailAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GmailAuthError';
  }
}

interface GmailHeader {
  name?: string;
  value?: string;
}

interface GmailPart {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
}

interface GmailApiMessage {
  id: string;
  threadId?: string;
  snippet?: string;
  labelIds?: string[];
  payload?: {
    headers?: GmailHeader[];
    mimeType?: string;
    body?: { data?: string };
    parts?: GmailPart[];
  };
}

function decodeBase64Url(encoded: string): string {
  try {
    const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const padLen = (4 - (normalized.length % 4)) % 4;
    const padded = normalized + '='.repeat(padLen);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  } catch {
    return '';
  }
}

function encodeBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function stripHtmlTags(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractBodyText(payload?: GmailApiMessage['payload']): string {
  if (!payload) return '';

  const findPart = (parts: GmailPart[] | undefined, targetMime: string): string | null => {
    if (!parts) return null;
    for (const part of parts) {
      if (part.mimeType === targetMime && part.body?.data) {
        return decodeBase64Url(part.body.data);
      }
      if (part.parts) {
        const nested = findPart(part.parts, targetMime);
        if (nested) return nested;
      }
    }
    return null;
  };

  if (payload.body?.data) {
    const raw = decodeBase64Url(payload.body.data);
    return payload.mimeType === 'text/html' ? stripHtmlTags(raw) : raw;
  }

  const plain = findPart(payload.parts, 'text/plain');
  if (plain) return plain;

  const html = findPart(payload.parts, 'text/html');
  if (html) return stripHtmlTags(html);

  return '';
}

function getHeader(headers: GmailHeader[] | undefined, name: string): string {
  if (!headers) return '';
  const match = headers.find((h) => h.name?.toLowerCase() === name.toLowerCase());
  return match?.value || '';
}

async function gmailFetch<T>(url: string, accessToken: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers || {}),
    },
  });

  if (res.status === 401 || res.status === 403) {
    throw new GmailAuthError('Gmail authorization expired or missing permissions. Please sign in with Google again.');
  }

  if (!res.ok) {
    let errText = `Gmail API error (${res.status})`;
    try {
      const errJson = (await res.json()) as { error?: { message?: string } };
      if (errJson?.error?.message) errText = errJson.error.message;
    } catch {
      // ignore non-json error response
    }
    throw new Error(errText);
  }

  return (await res.json()) as T;
}

export async function getGmailUserProfile(accessToken: string): Promise<{ emailAddress: string; messagesTotal: number }> {
  const data = await gmailFetch<{ emailAddress?: string; messagesTotal?: number }>(
    `${GMAIL_API_BASE}/profile`,
    accessToken
  );
  return {
    emailAddress: data.emailAddress || '',
    messagesTotal: data.messagesTotal || 0,
  };
}

export async function listGmailMessages(
  accessToken: string,
  searchQuery = '',
  maxResults = 12
): Promise<GmailMessageSummary[]> {
  const params = new URLSearchParams({
    maxResults: String(maxResults),
  });
  if (searchQuery.trim()) {
    params.set('q', searchQuery.trim());
  }

  const listData = await gmailFetch<{ messages?: { id: string; threadId: string }[] }>(
    `${GMAIL_API_BASE}/messages?${params.toString()}`,
    accessToken
  );

  const refs = listData.messages || [];
  if (refs.length === 0) return [];

  const detailed = await Promise.all(
    refs.map((ref) =>
      gmailFetch<GmailApiMessage>(`${GMAIL_API_BASE}/messages/${encodeURIComponent(ref.id)}?format=full`, accessToken)
    )
  );

  return detailed.map((msg) => {
    const headers = msg.payload?.headers;
    const labelIds = msg.labelIds || [];
    const bodyText = extractBodyText(msg.payload) || msg.snippet || '';
    return {
      id: msg.id,
      threadId: msg.threadId || msg.id,
      snippet: msg.snippet || '',
      subject: getHeader(headers, 'Subject') || '(No Subject)',
      from: getHeader(headers, 'From') || 'Unknown Sender',
      to: getHeader(headers, 'To') || '',
      date: getHeader(headers, 'Date') || '',
      bodyText,
      labelIds,
      isUnread: labelIds.includes('UNREAD'),
    };
  });
}

export async function sendGmailMessage(
  accessToken: string,
  to: string,
  subject: string,
  body: string
): Promise<{ id: string }> {
  const cleanTo = to.trim();
  const cleanSubject = subject.trim() || 'Flatmate Connect via ROOMIE';
  const cleanBody = body.trim();

  const rawMime = [
    `To: ${cleanTo}`,
    `Subject: ${cleanSubject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    cleanBody,
  ].join('\r\n');

  const raw = encodeBase64Url(rawMime);

  return gmailFetch<{ id: string }>(`${GMAIL_API_BASE}/messages/send`, accessToken, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  });
}

export async function trashGmailMessage(accessToken: string, messageId: string): Promise<void> {
  await gmailFetch<unknown>(`${GMAIL_API_BASE}/messages/${encodeURIComponent(messageId)}/trash`, accessToken, {
    method: 'POST',
  });
}
