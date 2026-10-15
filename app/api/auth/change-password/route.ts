import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession, setSessionCookie, isSameOrigin } from '@/lib/auth';
import { changePassword, LIMITS } from '@/lib/db';
import { verifyPassword } from '@/lib/security';

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { currentPassword, newPassword } = await req.json();
    const person = session.person;

    if (typeof newPassword !== 'string' || newPassword.length < LIMITS.passwordMinChars || newPassword.length > LIMITS.passwordMaxChars) {
      return NextResponse.json({ error: `New password must be at least ${LIMITS.passwordMinChars} characters.` }, { status: 400 });
    }

    // The current password is required, except right after first login / a reset
    // done on your behalf (must_prompt_change), where you just proved it by logging in.
    if (!person.must_prompt_change) {
      if (typeof currentPassword !== 'string' || !(await verifyPassword(currentPassword, person.password_hash))) {
        return NextResponse.json({ error: 'Your current password is not correct.' }, { status: 400 });
      }
    }

    const newVersion = await changePassword(person.id, newPassword);
    if (newVersion === null) return NextResponse.json({ error: 'Could not update password.' }, { status: 500 });

    // All older sessions (other devices) are now invalid; keep this one signed in.
    await setSessionCookie({ personId: person.id, slug: person.slug, name: person.name, sessionVersion: newVersion });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Could not update password.' }, { status: 500 });
  }
}
