import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

// AES-256-GCM em camada de aplicação. A chave fica em DOC_SECRETS_KEY (env).
// Idealmente base64 de 32 bytes; se vier string qualquer derivamos via sha256.
// O banco nunca vê plaintext nem a chave.

const ALGO = 'aes-256-gcm';

function getKey(): Buffer {
  const raw = process.env.DOC_SECRETS_KEY;
  if (!raw) {
    throw new Error('DOC_SECRETS_KEY não configurada — defina no .env (32 bytes base64).');
  }
  // Tenta base64 de 32 bytes; se não der, deriva sha256 da string (sempre 32 bytes).
  try {
    const buf = Buffer.from(raw, 'base64');
    if (buf.length === 32) return buf;
  } catch { /* fallthrough */ }
  return createHash('sha256').update(raw, 'utf8').digest();
}

export interface EncryptedSecret {
  ciphertext: string;
  iv: string;
  authTag: string;
}

export function encryptSecret(plaintext: string): EncryptedSecret {
  if (typeof plaintext !== 'string' || plaintext.length === 0) {
    throw new Error('Segredo vazio');
  }
  const key = getKey();
  const iv = randomBytes(12); // GCM padrão 12 bytes
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
  };
}

export function decryptSecret(enc: EncryptedSecret): string {
  const key = getKey();
  const iv = Buffer.from(enc.iv, 'base64');
  const authTag = Buffer.from(enc.authTag, 'base64');
  const ciphertext = Buffer.from(enc.ciphertext, 'base64');
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

export function isDocSecretsConfigured(): boolean {
  return !!process.env.DOC_SECRETS_KEY;
}
