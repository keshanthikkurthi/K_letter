import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { dismissPromptChange } from '@/lib/db';

export async function POST() {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dismissPromptChange(session.personId);
  return NextResponse.json({ ok: true });
}
