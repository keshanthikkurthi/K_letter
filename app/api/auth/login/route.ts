import { NextRequest, NextResponse } from 'next/server';
import { getPersonByToken, checkBruteForceLock, recordLoginAttempt } from '@/lib/db';
import { verifyPassword } from '@/lib/security';
import { setSessionCookie, getClientIp, isSameOrigin } from '@/lib/auth';

// One message for every failure (wrong link, wrong password, locked) so nothing leaks.
const GENERIC = 'That didn’t work. Check your password, or try again later.';

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: GENERIC }, { status: 403 });
  try {
    const { token, password } = await req.json();
    if (typeof token !== 'string' || typeof password !== 'string' || !password) {
      return NextResponse.json({ error: GENERIC }, { status: 401 });
    }

    const person = await getPersonByToken(token);
    if (!person) return NextResponse.json({ error: GENERIC }, { status: 401 });

    const ip = getClientIp(req.headers);
    if (await checkBruteForceLock(person.id, ip)) {
      return NextResponse.json({ error: GENERIC }, { status: 401 });
    }

    const ok = await verifyPassword(password, person.password_hash);
    await recordLoginAttempt(person.id, ip, ok);
    if (!ok) return NextResponse.json({ error: GENERIC }, { status: 401 });

    await setSessionCookie({
      personId: person.id,
      slug: person.slug,
      name: person.name,
      sessionVersion: person.session_version,
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: GENERIC }, { status: 401 });
  }
}
