import { NextResponse } from 'next/server';
import {
  getCreditPackages,
  getCreditWallet,
  publicCreditCosts,
} from '@/lib/credits/server';
import { getAuthUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  }
  const [wallet, packages] = await Promise.all([
    getCreditWallet(user.id),
    getCreditPackages(),
  ]);
  return NextResponse.json({
    wallet,
    packages,
    costs: publicCreditCosts(),
  });
}
