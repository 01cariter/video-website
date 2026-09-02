import { NextResponse, type NextRequest } from 'next/server';
import { normalizeSearchQuery, suggestSearch } from '@/lib/search';

export const runtime = 'nodejs';

// GET /api/search?q= — typeahead for the search field. Public: it only returns
// what any reader can already see on /search.
export async function GET(request: NextRequest) {
  const query = normalizeSearchQuery(request.nextUrl.searchParams.get('q'));
  if (!query) {
    return NextResponse.json({ people: [], posts: [] });
  }
  try {
    const suggestions = await suggestSearch({ query });
    return NextResponse.json(suggestions, {
      headers: { 'cache-control': 'private, max-age=15' },
    });
  } catch (error) {
    console.error('[snackd] search suggest failed', {
      detail: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Suggestions are unavailable.' },
      { status: 500 },
    );
  }
}
