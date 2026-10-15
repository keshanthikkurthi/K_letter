import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { publicProfile } from '@/lib/db';

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(publicProfile(session.person), { headers: { 'Cache-Control': 'no-store' } });
}
