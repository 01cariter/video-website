import { NextResponse } from 'next/server';
import { getCreditLedgerPage } from '@/lib/credits/server';
import { getAuthUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  }

  const search = new URL(request.url).searchParams;
  const page = Number(search.get('page') || 1);
  const pageSize = Number(search.get('pageSize') || 8);
  const ledger = await getCreditLedgerPage(user.id, page, pageSize);
  return NextResponse.json(ledger);
}
