import { NextRequest, NextResponse } from 'next/server';
import { getResetRequestByToken, completePasswordReset, LIMITS } from '@/lib/db';
import { getCurrentSession, isSameOrigin } from '@/lib/auth';

const INVALID = 'This reset link is invalid, expired or has already been used.';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') ?? '';
  const found = await getResetRequestByToken(token);
  if (!found) return NextResponse.json({ error: INVALID }, { status: 404 });
  return NextResponse.json({ valid: true, targetName: found.person.name });
}

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: INVALID }, { status: 403 });
  try {
    const { token, newPassword } = await req.json();
    if (typeof newPassword !== 'string' || newPassword.length < LIMITS.passwordMinChars || newPassword.length > LIMITS.passwordMaxChars) {
      return NextResponse.json({ error: `Password must be at least ${LIMITS.passwordMinChars} characters.` }, { status: 400 });
    }

    const found = await getResetRequestByToken(String(token ?? ''));
    if (!found) return NextResponse.json({ error: INVALID }, { status: 400 });

    // If the opener is logged in as the OTHER person, they set it on the target's
    // behalf -> the target is asked to change it at next login.
    const session = await getCurrentSession();
    const setByOther = Boolean(session && session.personId !== found.person.id);

    const result = await completePasswordReset(String(token), newPassword, setByOther);
    if (!result.ok) return NextResponse.json({ error: result.error || INVALID }, { status: 400 });

    // Reset never logs anyone in.
    return NextResponse.json({ ok: true, targetName: result.targetName, setByOther });
  } catch {
    return NextResponse.json({ error: INVALID }, { status: 400 });
  }
}
