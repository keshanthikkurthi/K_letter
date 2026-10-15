import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { getLetterDetails } from '@/lib/db';

// GET only. Pass ?open=1 when the reader actually opens the letter, so
// first_opened_at is set on open (not when e.g. a reply modal peeks at it).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const markOpened = req.nextUrl.searchParams.get('open') === '1';
  const details = await getLetterDetails(id, session.personId, { markOpened });

  // Same 404 for "doesn't exist", "not yours" and "not delivered yet".
  if (!details) return NextResponse.json({ error: 'Letter not found.' }, { status: 404 });

  return NextResponse.json(
    { letter: details.letter, objects: details.objects, isSender: details.letter.sender_id === session.personId },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
