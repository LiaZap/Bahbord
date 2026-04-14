import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const result = await query(
      `SELECT id, emoji, label, position
      FROM quick_reactions
      ORDER BY position ASC`
    );

    return NextResponse.json(result.rows);
  } catch (err) {
    console.error('GET /api/quick-reactions error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
