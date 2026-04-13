import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  const result = await query(
    `SELECT id, emoji, label, position
    FROM quick_reactions
    ORDER BY position ASC`
  );

  return NextResponse.json(result.rows);
}
