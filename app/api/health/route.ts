import { NextResponse } from 'next/server';
import { fetchRealtyProyectos } from '@/lib/data';

export const revalidate = 0;
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const realty = await fetchRealtyProyectos();
    return NextResponse.json({
      ok: true,
      source: 'supabase',
      realty_count: realty.length,
      realty_names: realty.map((r) => r.name),
      ts: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
