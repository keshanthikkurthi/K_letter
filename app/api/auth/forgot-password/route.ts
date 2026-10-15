import { NextRequest, NextResponse } from 'next/server';
import { getPersonByToken, createPasswordResetRequest } from '@/lib/db';
import { generateSecureToken } from '@/lib/security';
import { isSameOrigin } from '@/lib/auth';

// Always the same neutral answer, whether the link exists or is rate-limited.
const NEUTRAL = { ok: true, message: 'Your request was sent.' };

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json(NEUTRAL);
  try {
    const { token } = await req.json();
    const person = typeof token === 'string' ? await getPersonByToken(token) : null;
    if (person) await createPasswordResetRequest(person.id, generateSecureToken());
  } catch {
    // swallow: response must not reveal anything
  }
  return NextResponse.json(NEUTRAL);
}
