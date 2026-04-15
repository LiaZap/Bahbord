import { google } from 'googleapis';
import { Readable } from 'stream';

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

// Service Account credentials from env
const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  ? JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON)
  : null;

// Root folder in Drive where all Bahjira files go
const ROOT_FOLDER_ID = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || '';

function getAuth() {
  if (!credentials) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON não configurado');
  }
  return new google.auth.GoogleAuth({
    credentials,
    scopes: SCOPES,
  });
}

function getDrive() {
  return google.drive({ version: 'v3', auth: getAuth() });
}

/**
 * Folder structure in Google Drive:
 *
 * Bahjira Root/
 * ├── {workspace_name}/
 * │   ├── {project_prefix}/
 * │   │   ├── {ticket_key}/
 * │   │   │   ├── attachment1.pdf
 * │   │   │   └── screenshot.png
 * │   │   └── _project_docs/
 * │   └── _workspace_docs/
 * └── _shared/
 */

// Cache of folder IDs to avoid repeated lookups
const folderCache = new Map<string, string>();

export async function getOrCreateFolder(name: string, parentId?: string): Promise<string> {
  const cacheKey = `${parentId || 'root'}:${name}`;
  if (folderCache.has(cacheKey)) return folderCache.get(cacheKey)!;

  const drive = getDrive();
  const parent = parentId || ROOT_FOLDER_ID;

  // Check if folder exists
  const existing = await drive.files.list({
    q: `name='${name.replace(/'/g, "\\'")}' and '${parent}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)',
    spaces: 'drive',
  });

  if (existing.data.files && existing.data.files.length > 0) {
    const id = existing.data.files[0].id!;
    folderCache.set(cacheKey, id);
    return id;
  }

  // Create folder
  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parent ? [parent] : undefined,
    },
    fields: 'id',
  });

  const id = created.data.id!;
  folderCache.set(cacheKey, id);
  return id;
}

export async function getTicketFolderId(
  workspaceName: string,
  projectPrefix: string,
  ticketKey: string
): Promise<string> {
  const wsFolder = await getOrCreateFolder(workspaceName);
  const projectFolder = await getOrCreateFolder(projectPrefix, wsFolder);
  return getOrCreateFolder(ticketKey, projectFolder);
}

export interface UploadResult {
  file_id: string;
  file_name: string;
  file_url: string;
  file_size: number;
  mime_type: string;
  drive_folder_id: string;
}

export async function uploadToDrive(
  file: Buffer,
  fileName: string,
  mimeType: string,
  folderId: string
): Promise<UploadResult> {
  const drive = getDrive();

  const stream = new Readable();
  stream.push(file);
  stream.push(null);

  const response = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: stream,
    },
    fields: 'id, name, size, mimeType, webViewLink',
  });

  const fileData = response.data;

  // Make file accessible via link
  await drive.permissions.create({
    fileId: fileData.id!,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
  });

  return {
    file_id: fileData.id!,
    file_name: fileData.name!,
    file_url: fileData.webViewLink || `https://drive.google.com/file/d/${fileData.id}/view`,
    file_size: parseInt(fileData.size || '0'),
    mime_type: fileData.mimeType || mimeType,
    drive_folder_id: folderId,
  };
}

export async function deleteFromDrive(fileId: string): Promise<void> {
  const drive = getDrive();
  await drive.files.delete({ fileId });
}

export async function listDriveFiles(folderId: string) {
  const drive = getDrive();
  const response = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false`,
    fields: 'files(id, name, size, mimeType, webViewLink, createdTime)',
    orderBy: 'createdTime desc',
  });
  return response.data.files || [];
}

export function isDriveConfigured(): boolean {
  return !!credentials && !!ROOT_FOLDER_ID;
}
