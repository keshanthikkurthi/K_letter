import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession, isSameOrigin } from '@/lib/auth';
import { resetSealToDefault, updatePersonSettings } from '@/lib/db';

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { signature, sealColor, sealSvg, resetSeal } = await req.json();

    let defaultSvg: string | null = null;
    if (resetSeal === true) defaultSvg = await resetSealToDefault(session.personId);

    const result = await updatePersonSettings(session.personId, {
      signature: typeof signature === 'string' ? signature : undefined,
      sealColor: typeof sealColor === 'string' ? sealColor : undefined,
      sealSvg: !resetSeal && typeof sealSvg === 'string' ? sealSvg : undefined,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

    // Return the server-sanitized SVG so the client previews exactly what's stored.
    return NextResponse.json({ ok: true, sealSvg: defaultSvg ?? result.sealSvg });
  } catch {
    return NextResponse.json({ error: 'Could not save settings.' }, { status: 500 });
  }
}
