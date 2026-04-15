import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { query, getDefaultMemberId } from '@/lib/db';
import { isDriveConfigured, uploadToDrive, getTicketFolderId } from '@/lib/google-drive';
import { getAuthMember } from '@/lib/api-auth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

export async function POST(request: Request) {
  try {
    const auth = await getAuthMember();

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const ticketId = formData.get('ticket_id') as string | null;

    if (!file || !ticketId) {
      return NextResponse.json({ error: 'file e ticket_id são obrigatórios' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let fileUrl: string | null = null;
    let storageProvider = 'none';

    // Strategy 1: Google Drive (preferred)
    if (isDriveConfigured()) {
      try {
        const ticketInfo = await query(
          `SELECT tf.ticket_key, w.name AS workspace_name,
            COALESCE(p.prefix, w.prefix) AS project_prefix
           FROM tickets t
           JOIN workspaces w ON w.id = t.workspace_id
           LEFT JOIN projects p ON p.id = t.project_id
           JOIN tickets_full tf ON tf.id = t.id
           WHERE t.id = $1`,
          [ticketId]
        );

        const info = ticketInfo.rows[0];
        const folderId = await getTicketFolderId(
          info?.workspace_name || 'default',
          info?.project_prefix || 'GEN',
          info?.ticket_key || ticketId.substring(0, 8)
        );

        const driveResult = await uploadToDrive(buffer, file.name, file.type, folderId);
        fileUrl = driveResult.file_url;
        storageProvider = 'google_drive';
      } catch (err) {
        console.error('Google Drive upload failed, falling back to Supabase:', err);
      }
    }

    // Strategy 2: Supabase Storage (fallback)
    if (!fileUrl && supabaseUrl && supabaseServiceKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const fileName = `${ticketId}/${Date.now()}-${file.name}`;

        const { error: uploadError } = await supabase.storage
          .from('attachments')
          .upload(fileName, buffer, { contentType: file.type, upsert: false });

        if (uploadError?.message?.includes('not found') || uploadError?.message?.includes('Bucket')) {
          await supabase.storage.createBucket('attachments', { public: true });
          await supabase.storage.from('attachments').upload(fileName, buffer, { contentType: file.type });
        }

        const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(fileName);
        fileUrl = urlData?.publicUrl || null;
        storageProvider = 'supabase';
      } catch (err) {
        console.error('Supabase upload failed:', err);
      }
    }

    // If no storage worked, return error
    if (!fileUrl) {
      return NextResponse.json(
        { error: 'Nenhum serviço de armazenamento configurado. Configure o Google Drive ou Supabase Storage.' },
        { status: 503 }
      );
    }

    // Use authenticated member
    let memberId = auth?.id;
    if (!memberId) {
      try { memberId = await getDefaultMemberId(); } catch {}
    }

    const result = await query(
      `INSERT INTO attachments (ticket_id, uploaded_by, file_name, file_url, file_size, mime_type)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [ticketId, memberId, file.name, fileUrl, file.size, file.type]
    );

    return NextResponse.json({ ...result.rows[0], storage_provider: storageProvider }, { status: 201 });
  } catch (err) {
    console.error('POST /api/attachments/upload error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
