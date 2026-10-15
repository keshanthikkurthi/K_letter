import { NextRequest, NextResponse } from 'next/server';
import { setupSystem, isSystemConfigured, LIMITS } from '@/lib/db';
import { generateSecureToken, safeEqual } from '@/lib/security';

export async function GET() {
  return NextResponse.json({ configured: await isSystemConfigured() });
}

export async function POST(req: NextRequest) {
  try {
    if (await isSystemConfigured()) {
      return NextResponse.json({ error: 'Setup has already been completed and is permanently disabled.' }, { status: 403 });
    }

    const { setupSecret, harveyPassword, donnaDefaultPassword } = await req.json();
    const envSecret = process.env.SETUP_SECRET;
    if (!envSecret) {
      return NextResponse.json(
        { error: 'Setup is unavailable because SETUP_SECRET is not configured on the server. Configure it, then restart or redeploy the app.' },
        { status: 503 }
      );
    }
    if (typeof setupSecret !== 'string' || !safeEqual(setupSecret, envSecret)) {
      return NextResponse.json({ error: 'Invalid setup secret.' }, { status: 401 });
    }

    for (const [label, pw] of [['Harvey’s password', harveyPassword], ['Donna’s default password', donnaDefaultPassword]] as const) {
      if (typeof pw !== 'string' || pw.length < LIMITS.passwordMinChars || pw.length > LIMITS.passwordMaxChars) {
        return NextResponse.json({ error: `${label} must be at least ${LIMITS.passwordMinChars} characters.` }, { status: 400 });
      }
    }

    const harveyToken = generateSecureToken();
    const donnaToken = generateSecureToken();
    const result = await setupSystem({ harveyPassword, donnaDefaultPassword, harveyToken, donnaToken });
    if (!result.ok) {
      return NextResponse.json({ error: result.error || 'Setup failed.' }, { status: 409 });
    }

    // The only time the raw tokens ever leave the server.
    return NextResponse.json(
      { ok: true, harveyLink: `/l/${harveyToken}`, donnaLink: `/l/${donnaToken}` },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch {
    return NextResponse.json({ error: 'Setup failed.' }, { status: 500 });
  }
}
