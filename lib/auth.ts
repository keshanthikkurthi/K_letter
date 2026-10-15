import { cookies } from 'next/headers';
import { verifySessionToken, createSessionToken, getSessionTtlHours, isSessionCurrent } from './security';
import { getPersonById } from './db';
import type { Person, SessionPayload } from './types';

const SESSION_COOKIE_NAME = 'pl_session';

/**
 * Current session, or null. Rejects sessions whose session_version no longer
 * matches the person's (i.e. issued before a password change or reset).
 */
export async function getCurrentSession(): Promise<(SessionPayload & { person: Person }) | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!raw) return null;

  const payload = await verifySessionToken(raw);
  if (!payload?.personId) return null;

  const person = await getPersonById(payload.personId);
  if (!person || !isSessionCurrent(payload, person.session_version)) return null;

  return { ...payload, person };
}

export async function setSessionCookie(payload: SessionPayload): Promise<void> {
  const token = await createSessionToken(payload);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: Math.round(getSessionTtlHours() * 3600),
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/** Client IP. On Vercel, x-forwarded-for's first entry is set by the platform. */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim().slice(0, 64);
  const realIp = headers.get('x-real-ip');
  if (realIp) return realIp.trim().slice(0, 64);
  return 'unknown';
}

/** Basic CSRF defense for state-changing routes, on top of SameSite=Lax. */
export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true; // same-origin fetches from some browsers omit it
  try {
    return new URL(origin).host === req.headers.get('host');
  } catch {
    return false;
  }
}
