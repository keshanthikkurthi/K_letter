import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { SessionPayload } from './types';

const BCRYPT_ROUNDS = 12;

export function getSessionTtlHours(): number {
  const n = Number(process.env.SESSION_TTL_HOURS);
  return Number.isFinite(n) && n > 0 ? n : 12;
}

/** Constant-time string comparison (compares SHA-256 digests so lengths match). */
export function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function encryptionKey(): Buffer {
  return crypto.createHash('sha256').update(`reset-banner:${getRawSessionSecret()}`).digest();
}

/** AES-256-GCM. Used so the reset link can be shown to the partner without storing it in plaintext. */
export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64url');
}

export function decryptSecret(payload: string): string | null {
  try {
    const buf = Buffer.from(payload, 'base64url');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

/** A session is valid only if its version matches the person's current session_version. */
export function isSessionCurrent(payload: SessionPayload | null, personSessionVersion: number | undefined): boolean {
  return Boolean(payload && personSessionVersion !== undefined && payload.sessionVersion === personSessionVersion);
}
const MAX_SVG_SIZE_BYTES = 200 * 1024; // 200 KB

/**
 * Generates 32 cryptographically secure random bytes as a URL-safe base64 string
 */
export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Computes SHA-256 hash in hex format
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

/**
 * Hashes a plaintext password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Compares plaintext password against bcrypt hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!password || !hash) return false;
  return bcrypt.compare(password, hash);
}

/**
 * Generates an encrypted/signed JWT session cookie using jose
 */
export async function createSessionToken(payload: SessionPayload): Promise<string> {
  const secretKey = getSessionSecretKey();
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${getSessionTtlHours()}h`)
    .sign(secretKey);
}

/**
 * Verifies JWT session cookie and returns decoded payload
 */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const secretKey = getSessionSecretKey();
    const { payload } = await jwtVerify(token, secretKey);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

function getRawSessionSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET must be set (at least 32 characters) in production.');
  }
  return 'private-letters-dev-only-secret-do-not-use-in-prod';
}

function getSessionSecretKey(): Uint8Array {
  return new TextEncoder().encode(getRawSessionSecret());
}

/**
 * Server-side SVG sanitizer. Defense in depth: the result is additionally only
 * ever rendered through <img src="data:image/svg+xml,...">, where browsers never
 * execute script or load external resources.
 */
export function sanitizeSvg(svgContent: string): { ok: boolean; sanitized?: string; error?: string } {
  if (!svgContent || typeof svgContent !== 'string') {
    return { ok: false, error: 'Empty or invalid SVG content' };
  }

  const byteLength = Buffer.byteLength(svgContent, 'utf8');
  if (byteLength > MAX_SVG_SIZE_BYTES) {
    return { ok: false, error: `SVG exceeds maximum size of 200 KB (actual: ${(byteLength / 1024).toFixed(1)} KB)` };
  }

  const dangerousElements = ['script', 'foreignObject', 'iframe', 'embed', 'object', 'animate', 'set', 'animateTransform', 'animateMotion', 'handler', 'listener'];

  const pass = (input: string): string => {
    let s = input;
    // XML declarations, DOCTYPE/ENTITY (XXE), processing instructions, CDATA
    s = s.replace(/<\?[\s\S]*?\?>/g, '');
    s = s.replace(/<!DOCTYPE[\s\S]*?(\[[\s\S]*?\])?\s*>/gi, '');
    s = s.replace(/<!ENTITY[\s\S]*?>/gi, '');
    s = s.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '');

    for (const tag of dangerousElements) {
      s = s.replace(new RegExp(`<${tag}\\b[^>]*\\/>`, 'gi'), '');
      s = s.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, 'gi'), '');
      s = s.replace(new RegExp(`<${tag}\\b[^>]*>`, 'gi'), '');
      s = s.replace(new RegExp(`<\\/${tag}\\s*>`, 'gi'), '');
    }

    // Event handlers: on*="..." / on*='...' / on*=bare
    s = s.replace(/\s(on[a-z]+)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');

    // Any href / xlink:href that is not an internal fragment (#id) is removed
    s = s.replace(/\s(?:xlink:)?href\s*=\s*("(?!#)[^"]*"|'(?!#)[^']*'|(?!["'#])[^\s>]+)/gi, '');

    // javascript:/vbscript: anywhere in attribute values
    s = s.replace(/(?:javascript|vbscript)\s*:/gi, '');

    // External url(...) references and @import in style attributes/elements
    s = s.replace(/url\(\s*(['"]?)(?!#)[^)]*\1\s*\)/gi, 'none');
    s = s.replace(/@import[^;]*;?/gi, '');
    return s;
  };

  let clean = svgContent;
  for (let i = 0; i < 5; i++) {
    const next = pass(clean);
    if (next === clean) break;
    clean = next;
  }

  if (!/<svg\b[^>]*>/i.test(clean) || !/<\/svg>/i.test(clean)) {
    return { ok: false, error: 'SVG must have valid <svg> root element' };
  }

  return { ok: true, sanitized: clean.trim() };
}

/**
 * Escapes plain text for safe display (never render raw HTML)
 */
export function escapePlainText(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
