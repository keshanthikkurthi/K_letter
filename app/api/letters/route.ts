import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession, isSameOrigin } from '@/lib/auth';
import { getLettersForMailbox, createLetter, getOtherPerson, getActiveResetBannerForViewer } from '@/lib/db';

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [mailbox, resetBanner] = await Promise.all([
    getLettersForMailbox(session.personId),
    getActiveResetBannerForViewer(session.personId),
  ]);
  return NextResponse.json({ ...mailbox, resetBanner }, { headers: { 'Cache-Control': 'no-store' } });
}

// There is intentionally no PUT/PATCH/DELETE anywhere for letters.
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { body, signature, replyTo, deliverAt, objects } = await req.json();
    const recipient = await getOtherPerson(session.personId);
    if (!recipient) return NextResponse.json({ error: 'Recipient not found.' }, { status: 404 });

    const result = await createLetter({
      senderId: session.personId,
      recipientId: recipient.id,
      body,
      signature,
      replyTo: typeof replyTo === 'string' ? replyTo : null,
      deliverAt: typeof deliverAt === 'string' ? deliverAt : undefined,
      objects,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true, letterId: result.letterId, deliverAt: result.deliverAt });
  } catch {
    return NextResponse.json({ error: 'Could not send the letter.' }, { status: 500 });
  }
}
