import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { query } from '@/lib/db';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const ticketId = formData.get('ticket_id') as string | null;

  if (!file || !ticketId) {
    return NextResponse.json({ error: 'file e ticket_id são obrigatórios' }, { status: 400 });
  }

  // Upload para Supabase Storage
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const fileName = `${ticketId}/${Date.now()}-${file.name}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('attachments')
    .upload(fileName, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    // Se o bucket não existe, criar e tentar novamente
    if (uploadError.message?.includes('not found') || uploadError.message?.includes('Bucket')) {
      await supabase.storage.createBucket('attachments', { public: true });
      const { error: retryError } = await supabase.storage
        .from('attachments')
        .upload(fileName, buffer, { contentType: file.type });

      if (retryError) {
        return NextResponse.json({ error: retryError.message }, { status: 500 });
      }
    } else {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }
  }

  // Gerar URL pública
  const { data: urlData } = supabase.storage
    .from('attachments')
    .getPublicUrl(fileName);

  const fileUrl = urlData?.publicUrl || null;

  // Buscar membro padrão
  const memberResult = await query(`SELECT id FROM members LIMIT 1`);
  const memberId = memberResult.rows[0]?.id;

  // Salvar no banco
  const result = await query(
    `INSERT INTO attachments (ticket_id, uploaded_by, file_name, file_url, file_size, mime_type)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [ticketId, memberId, file.name, fileUrl, file.size, file.type]
  );

  return NextResponse.json(result.rows[0], { status: 201 });
}
